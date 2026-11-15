# Earth Jukebox

**NASA International Space Apps Challenge 2026, "The Earth Information Jukebox"**

Earth Jukebox turns real NASA satellite data into sound you can move through, so people who cannot see a map can still explore it. Use headphones and a keyboard, your voice, or a touch screen.

**Live site:** https://nasa-space-apps-2026-sandy.vercel.app

## Two ways in, one set of data

| Page | What it is |
|---|---|
| [`index.html`](src/index.html) **Explore a place** | One region as a 3D landscape (intensity becomes height). A sound source sits at the center; walk toward it and a second note grows louder and brighter where the data is stronger. |
| [`navigator.html`](src/navigator.html) **World navigator** | The whole planet on a 3D globe. Pitch is the data value under your cursor, a metronome guides you to a target, and an AI guide (typed or spoken) can take you places and change settings. |
| [`features.html`](src/features.html) | A tour of every feature and every key. |

## Data

Six layers, all real NASA data:

- **Rain**: GPM IMERG precipitation rate (GIBS)
- **Land heat**: MODIS Terra land surface temperature (GIBS)
- **Plants**: MODIS Terra vegetation index, NDVI (GIBS)
- **Ocean today**: GHRSST MUR sea surface temperature (GIBS)
- **Haze**: MODIS Terra aerosol optical depth (GIBS)
- **Ocean year (EIC)**: NASA Earth Information Center / ECCO2 sea surface temperature, a year of seasons, from [NASA SVS #3912](https://svs.gsfc.nasa.gov/3912/)

GIBS layers arrive as colorized images. [`src/layers.js`](src/layers.js) converts each pixel's color back to a position along that layer's own NASA legend, then to a calibrated level, so every layer has clearly separate levels (light, moderate, heavy, extreme...).

## Run it

It is a static site. From the repo folder:

```bash
python3 -m http.server 8000 --directory src
```

Then open http://localhost:8000. The AI guide needs the serverless function in [`api/`](api/assistant.js), which only runs on Vercel.

## Rebuild the EIC ocean data

`src/data/sst.json` is generated from NASA's animation frames:

```bash
pip install numpy pillow scikit-learn certifi
python tools/preprocess_sst.py --every 60
```

The script reads each frame's color (hue) back into a temperature using the colorbar, and averages it into a 5 degree grid.

## Deploy

`vercel.json` serves `src/` as a static site, and `api/assistant.js` becomes `/api/assistant`. For the AI guide, add `ANTHROPIC_API_KEY` in the Vercel project's environment variables and set a monthly spend limit in the Anthropic console, because the endpoint is public (it has best-effort rate limiting, but the spend limit is the real safeguard).

## Layout

```
src/index.html        Explore a place (3D terrain)
src/navigator.html    World navigator (3D globe, guide, settings)
src/features.html     Feature tour
src/earth.js          Shared 3D Earth (Three.js): day/night, city lights, atmosphere, markers
src/layers.js         Shared NASA layer definitions and color-to-value conversion
src/navigator.js      World navigator logic, audio, assistant, settings
src/places.js         Place names for the guide
src/site.css          Shared look
src/data/sst.json     EIC ocean temperature year (generated)
api/assistant.js      Serverless AI guide (Claude)
tools/preprocess_sst.py  Builds sst.json
```

## Credits

Data courtesy of NASA Earth Science Data Systems, GIBS, and the NASA Earth Information Center. Built by Sohum Vajaria and Pranav (pranav-ysv). MIT licensed.
