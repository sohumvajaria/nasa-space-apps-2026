"""
Earth Jukebox - Step 1: turn NASA's sea-surface-temperature animation into numbers.

Source: NASA SVS #3912 "Global Sea Surface Currents and Temperature"
        https://svs.gsfc.nasa.gov/3912/

What this script does, in order:
  1. Downloads every Nth animation frame, the colorbar image, and the dates file.
  2. Reads the colorbar like a ruler: left end = 0 degC, right end = 32 degC.
  3. For each pixel in each frame, finds the closest color on the ruler and
     reads off its temperature. Black/land pixels are skipped.
  4. Averages the pixels into a 72 x 36 grid (5 deg x 5 deg boxes).
  5. Saves everything to src/data/sst.json for the website to play.

It also saves two images in check/ so you can SEE that it worked:
  tools/check/colorbar_read.png  - the colors the script found on the colorbar
  tools/check/frame0_decoded.png - the first frame, rebuilt from the decoded numbers

Run (from the repo folder):   python tools/preprocess_sst.py
Needs: numpy, pillow, scikit-learn   (pip install numpy pillow scikit-learn)
"""

import argparse
import json
import re
import sys
import urllib.request
from datetime import datetime, timedelta
from pathlib import Path

import numpy as np
from PIL import Image
from sklearn.neighbors import NearestNeighbors

# ---------------------------------------------------------------- settings
BASE = "https://svs.gsfc.nasa.gov/vis/a000000/a003900/a003912/"
FRAMES_URL = BASE + "frames/2048x1024_1x1_30p/orig/"
COLORBAR_URL = BASE + "sst_ecco2_cbar.png"
DATES_URL = BASE + "flat_ecco2_dates.txt"

T_MIN, T_MAX = 0.0, 32.0          # degC at the left and right ends of the colorbar
GRID_W, GRID_H = 72, 36           # 5-degree boxes: 72 across (longitude), 36 down (latitude)
START_DATE = datetime(2007, 3, 25)  # from the SVS page, used if the dates file can't be matched
END_DATE = datetime(2008, 3, 3)

TOOLS = Path(__file__).parent
RAW = TOOLS / "raw"                                   # downloaded frames (ignored by git)
CHECK = TOOLS / "check"                               # preview images (ignored by git)
OUT = TOOLS.parent / "src" / "data" / "sst.json"      # the website reads this file


# ---------------------------------------------------------------- 1. download
def download(url, dest):
    """Download url to dest unless we already have it (so re-runs are fast)."""
    if dest.exists() and dest.stat().st_size > 0:
        return dest
    dest.parent.mkdir(parents=True, exist_ok=True)
    print(f"  downloading {url.split('/')[-1]}")
    req = urllib.request.Request(url, headers={"User-Agent": "EarthJukebox/1.0 (NASA Space Apps)"})
    with urllib.request.urlopen(req, timeout=60) as r, open(dest, "wb") as f:
        f.write(r.read())
    return dest


def list_frame_names():
    """The frames folder is a web page listing file names; pull the image names out of it."""
    req = urllib.request.Request(FRAMES_URL, headers={"User-Agent": "EarthJukebox/1.0"})
    html = urllib.request.urlopen(req, timeout=60).read().decode("utf-8", "ignore")
    names = sorted(set(re.findall(r'href="([^"/?]+\.(?:png|jpg|tif))"', html, re.I)))
    if not names:
        sys.exit("Could not find frame files at " + FRAMES_URL + " - open it in a browser to check.")
    return names


# ---------------------------------------------------------------- 2. read the colorbar
def read_colorbar(path):
    """
    Find the colored strip inside the colorbar image and return its colors left -> right.
    The image also has text/tick labels, so we keep only strongly colored (saturated) pixels.
    """
    img = np.asarray(Image.open(path).convert("RGB")).astype(float)
    mx, mn = img.max(axis=2), img.min(axis=2)
    saturated = (mx - mn) > 40                       # grey/white/black text is not saturated

    rows = np.where(saturated.mean(axis=1) > 0.5)[0]  # rows that are mostly color = the strip
    if len(rows) == 0:
        sys.exit("Could not find the color strip in the colorbar image.")
    band = img[rows.min():rows.max() + 1]
    band_sat = saturated[rows.min():rows.max() + 1]

    cols = np.where(band_sat.mean(axis=0) > 0.5)[0]   # columns inside the strip
    # keep the longest unbroken run of columns (ignores stray colored bits)
    runs = np.split(cols, np.where(np.diff(cols) > 1)[0] + 1)
    cols = max(runs, key=len)
    colors = np.median(band[:, cols], axis=0)        # one color per column

    # Sanity check: the cold end should be bluer than the warm end. Flip if not.
    if colors[0, 2] - colors[0, 0] < colors[-1, 2] - colors[-1, 0]:
        colors = colors[::-1]
    values = np.linspace(T_MIN, T_MAX, len(colors))
    return colors, values


# ---------------------------------------------------------------- 3 + 4. decode a frame
def decode_frame(path, colors, values, knn, max_dist=45.0):
    """Turn one frame into a GRID_H x GRID_W array of temperatures (NaN = no ocean data)."""
    img = np.asarray(Image.open(path).convert("RGB"))
    h, w, _ = img.shape
    flat = img.reshape(-1, 3).astype(np.int32)

    # Speed trick: many pixels share the same color, so look up each unique color once.
    packed = (flat[:, 0] << 16) | (flat[:, 1] << 8) | flat[:, 2]
    uniq, inverse = np.unique(packed, return_inverse=True)
    uniq_rgb = np.stack([(uniq >> 16) & 255, (uniq >> 8) & 255, uniq & 255], axis=1)

    dist, idx = knn.kneighbors(uniq_rgb.astype(float))
    temp_u = values[idx[:, 0]]
    too_far = dist[:, 0] > max_dist                  # color isn't on the ruler (text, land, blur)
    too_dark = uniq_rgb.max(axis=1) < 35              # black background / land
    temp_u[too_far | too_dark] = np.nan
    temps = temp_u[inverse.ravel()]

    # Average pixels into boxes. Row 0 of the image = 90N, column 0 = 180W.
    ys, xs = np.divmod(np.arange(h * w), w)
    box = (ys * GRID_H // h) * GRID_W + (xs * GRID_W // w)
    ok = ~np.isnan(temps)
    total = np.bincount(box[ok], weights=temps[ok], minlength=GRID_W * GRID_H)
    count = np.bincount(box[ok], minlength=GRID_W * GRID_H)
    # A box needs a reasonable number of colored pixels to count as ocean.
    min_px = max(5, int(0.02 * (h / GRID_H) * (w / GRID_W)))
    with np.errstate(invalid="ignore", divide="ignore"):
        grid = np.where(count >= min_px, total / count, np.nan)
    return grid.reshape(GRID_H, GRID_W)


# ---------------------------------------------------------------- dates
def frame_dates(chosen_names, all_names, dates_path):
    """Match each chosen frame to a date; fall back to spacing dates evenly across the year."""
    lines = []
    if dates_path and dates_path.exists():
        lines = [l.strip() for l in dates_path.read_text(errors="ignore").splitlines() if l.strip()]
    out = []
    for name in chosen_names:
        i = all_names.index(name)
        if len(lines) >= len(all_names) - 5 and i < len(lines):
            out.append(lines[i])
        else:
            frac = i / max(1, len(all_names) - 1)
            out.append((START_DATE + (END_DATE - START_DATE) * frac).strftime("%Y-%m-%d"))
    return out


# ---------------------------------------------------------------- check images
def save_checks(colors, grid, palette_colors, palette_values):
    CHECK.mkdir(exist_ok=True)
    strip = np.repeat(colors[None, :, :], 40, axis=0).astype(np.uint8)
    Image.fromarray(strip).resize((max(300, len(colors) * 2), 40), Image.NEAREST).save(CHECK / "colorbar_read.png")

    rgb = np.zeros((GRID_H, GRID_W, 3), np.uint8)
    for y in range(GRID_H):
        for x in range(GRID_W):
            t = grid[y, x]
            if not np.isnan(t):
                rgb[y, x] = palette_colors[np.abs(palette_values - t).argmin()]
    Image.fromarray(rgb).resize((GRID_W * 10, GRID_H * 10), Image.NEAREST).save(CHECK / "frame0_decoded.png")


# ---------------------------------------------------------------- main
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--every", type=int, default=20, help="use every Nth frame (default 20, about 100 frames)")
    ap.add_argument("--local-dir", help="skip downloading; use frames/colorbar already in this folder (for testing)")
    args = ap.parse_args()

    print("Step 1/4  Getting files")
    if args.local_dir:
        src = Path(args.local_dir)
        all_names = sorted(p.name for p in src.glob("frame*.png"))
        frame_paths = {n: src / n for n in all_names}
        cbar_path, dates_path = src / "colorbar.png", src / "dates.txt"
        chosen = all_names[:: args.every]
    else:
        all_names = list_frame_names()
        chosen = all_names[:: args.every]
        print(f"  {len(all_names)} frames on the server, using {len(chosen)} (every {args.every}th)")
        cbar_path = download(COLORBAR_URL, RAW / "colorbar.png")
        try:
            dates_path = download(DATES_URL, RAW / "dates.txt")
        except Exception:
            dates_path = None
        frame_paths = {}
        for n in chosen:
            frame_paths[n] = download(FRAMES_URL + n, RAW / "frames" / n)

    print("Step 2/4  Reading the colorbar")
    colors, values = read_colorbar(cbar_path)
    print(f"  found {len(colors)} colors; cold end RGB {colors[0].astype(int)}, warm end RGB {colors[-1].astype(int)}")
    knn = NearestNeighbors(n_neighbors=1).fit(colors)

    print("Step 3/4  Decoding frames into temperatures")
    dates = frame_dates(chosen, all_names, dates_path)
    frames = []
    for k, (name, date) in enumerate(zip(chosen, dates)):
        grid = decode_frame(frame_paths[name], colors, values, knn)
        if k == 0:
            first = grid
        frames.append({
            "date": date,
            "mean": None if np.all(np.isnan(grid)) else round(float(np.nanmean(grid)), 2),
            "grid": [[None if np.isnan(v) else round(float(v), 1) for v in row] for row in grid],
        })
        print(f"\r  {k + 1}/{len(chosen)}  {date}  mean {frames[-1]['mean']} degC", end="")
    print()

    print("Step 4/4  Saving")
    # A small palette (32 colors) so the website can draw the map in NASA's own colors.
    pick = np.linspace(0, len(colors) - 1, 32).astype(int)
    palette = {"values": [round(float(values[i]), 2) for i in pick],
               "colors": [[int(c) for c in colors[i]] for i in pick]}
    out = {
        "meta": {
            "id": "sst",
            "title": "Global Sea Surface Temperature",
            "units": "°C",
            "vmin": T_MIN, "vmax": T_MAX,
            "grid": {"w": GRID_W, "h": GRID_H, "lat_top": 90, "lon_left": -180, "deg": 5},
            "source": "NASA SVS #3912, ECCO2 model (NASA/JPL), https://svs.gsfc.nasa.gov/3912/",
            "description": ("A year of ocean surface temperatures, March 2007 to March 2008. "
                            "Warm water near the equator, cold water near the poles, and the "
                            "seasons shifting the warm band north and south."),
        },
        "palette": palette,
        "frames": frames,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(out, separators=(",", ":")))
    save_checks(colors, first, np.array(palette["colors"]), np.array(palette["values"]))
    print(f"  saved {OUT}  ({OUT.stat().st_size / 1e6:.1f} MB)")
    print("  now open tools/check/colorbar_read.png and tools/check/frame0_decoded.png to confirm it looks right")


if __name__ == "__main__":
    main()
