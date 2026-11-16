// Terra-fic Tunes Navigator (navigator.html): explore the whole world by ear.
// A separate page from index.html for now; the two can be combined later.
//
// SOUND DEFINITIONS: each sound means exactly one thing.
//   Steady tone (pitch)      = the data value right where you are (e.g. ocean temperature)
//   Silence + soft thud      = land (no ocean data)
//   Chime                    = you crossed the equator or the prime meridian (the two axes)
//   Metronome speed          = how far away the target is (faster = closer)
//   Metronome direction (3D) = which way the target is (left ear = west, right ear = east;
//                              higher ticks = target is north, lower = south)
//   Rising chord             = you arrived at the target
//   Voice                    = coordinates, place, value, date (press I, or it speaks when you stop)
//
// Coordinates: the equator (latitude 0) and the prime meridian (longitude 0) are the axes.
// (0, 0) is "Null Island" in the Atlantic. Space jumps back there.
(() => {
  'use strict';

  // =====================================================================
  // SETTINGS (everything the user, or the assistant, can change)
  // =====================================================================
  const SETTINGS_SCHEMA = [
    { key: 'masterVolume', label: 'Master volume', type: 'range', min: 0, max: 1, step: 0.05, def: 0.9, words: ['master volume', 'volume', 'overall'] },
    { key: 'dataVoice', label: 'Data tone on', type: 'toggle', def: true, words: ['data tone', 'data voice', 'tone', 'data sound'] },
    { key: 'instrument', label: 'Data tone instrument', type: 'select', def: 'synth', options: [['synth', 'Synth pad'], ['808', '808 bass beat'], ['sine', 'Pure tone']], words: ['instrument', 'sound style', 'timbre'] },
    { key: 'dataVolume', label: 'Data tone volume', type: 'range', min: 0, max: 1, step: 0.05, def: 0.6, words: ['data volume', 'tone volume'] },
    { key: 'musicality', label: 'Data ↔ Music (0 = exact data pitch, 1 = musical scale + harmony)', type: 'range', min: 0, max: 1, step: 0.05, def: 0.7, words: ['musicality', 'music', 'data music', 'musical'] },
    { key: 'scale', label: 'Musical scale', type: 'select', def: 'pentatonic', options: [['pentatonic', 'Pentatonic (always pleasant)'], ['major', 'Major (bright)'], ['minor', 'Minor (dark)'], ['chromatic', 'Chromatic (every note)']], words: ['scale', 'key'] },
    { key: 'lowNote', label: 'Lowest pitch (MIDI note, 48 = C3)', type: 'range', min: 24, max: 72, step: 1, def: 48, words: ['lowest pitch', 'low pitch', 'low note', 'bottom'] },
    { key: 'highNote', label: 'Highest pitch (MIDI note, 84 = C6)', type: 'range', min: 48, max: 100, step: 1, def: 84, words: ['highest pitch', 'high pitch', 'high note', 'top'] },
    { key: 'metronome', label: 'Distance metronome on', type: 'toggle', def: true, words: ['metronome', 'ticks', 'ticking', 'beat'] },
    { key: 'metroVolume', label: 'Metronome volume', type: 'range', min: 0, max: 1, step: 0.05, def: 0.7, words: ['metronome volume', 'tick volume', 'beat volume'] },
    { key: 'metroSlowBpm', label: 'Metronome speed when far (beats per minute)', type: 'range', min: 20, max: 120, step: 5, def: 40, words: ['slowest', 'far speed', 'slow tempo'] },
    { key: 'metroFastBpm', label: 'Metronome speed when close (beats per minute)', type: 'range', min: 100, max: 480, step: 10, def: 240, words: ['fastest', 'close speed', 'fast tempo'] },
    { key: 'metroSound', label: 'Metronome sound', type: 'select', def: 'wood', options: [['wood', 'Wood block'], ['click', 'Click'], ['beep', 'Beep']], words: ['metronome sound', 'tick sound', 'beat sound'] },
    { key: 'northSouthPitch', label: 'Higher ticks when target is north', type: 'toggle', def: true, words: ['north south', 'north-south', 'pitch cue'] },
    { key: 'chimes', label: 'Chime when crossing the equator or prime meridian', type: 'toggle', def: true, words: ['chime', 'chimes', 'axis', 'equator sound'] },
    { key: 'landThud', label: 'Thud when moving onto land', type: 'toggle', def: true, words: ['thud', 'land sound', 'bump'] },
    { key: 'speech', label: 'Built-in voice (turn off if you use a screen reader)', type: 'toggle', def: true, words: ['voice', 'speech', 'talking', 'speak'] },
    { key: 'speechRate', label: 'Voice speed', type: 'range', min: 0.6, max: 2, step: 0.1, def: 1.1, words: ['voice speed', 'speech rate', 'talk speed', 'speaking speed'] },
    { key: 'autoAnnounce', label: 'Speak your location when you stop moving', type: 'toggle', def: true, words: ['auto announce', 'announce', 'announcements'] },
    { key: 'speed', label: 'Movement speed (degrees per second)', type: 'range', min: 2, max: 40, step: 1, def: 12, words: ['movement speed', 'move speed', 'walking speed', 'speed'] },
    { key: 'assistant', label: 'AI assistant (Claude) for questions', type: 'toggle', def: true, words: ['assistant', 'ai', 'claude'] },
    { key: 'dataset', label: 'Data layer', type: 'select', def: 'auto', options: [['auto', 'Automatic (EIC ocean temperature if available)'], ['sst', 'EIC sea surface temperature'], ['imerg', 'IMERG rainfall (live, backup)']], words: ['data layer', 'dataset', 'data set', 'layer'] },
  ];
  const SCHEMA = Object.fromEntries(SETTINGS_SCHEMA.map(s => [s.key, s]));
  const STORE = 'earthJukeboxSettings.v1';

  const settings = {};
  SETTINGS_SCHEMA.forEach(s => settings[s.key] = s.def);
  try { Object.assign(settings, sanitizeAll(JSON.parse(localStorage.getItem(STORE) || '{}'))); } catch (e) { /* storage unavailable */ }

  function sanitize(key, value) {
    const s = SCHEMA[key];
    if (!s) return undefined;
    if (s.type === 'toggle') {
      if (typeof value === 'string') return !/^(false|off|no|0)$/i.test(value.trim());
      return Boolean(value);
    }
    if (s.type === 'range') {
      const v = Number(value);
      if (!Number.isFinite(v)) return undefined;
      return Math.min(s.max, Math.max(s.min, v));
    }
    if (s.type === 'select') {
      const v = String(value).toLowerCase();
      const hit = s.options.find(([val, label]) => val.toLowerCase() === v || label.toLowerCase().includes(v));
      return hit ? hit[0] : undefined;
    }
  }
  function sanitizeAll(obj) {
    const out = {};
    for (const k in obj) { const v = sanitize(k, obj[k]); if (v !== undefined) out[k] = v; }
    return out;
  }
  function setSetting(key, value, quiet) {
    const v = sanitize(key, value);
    if (v === undefined) return false;
    settings[key] = v;
    try { localStorage.setItem(STORE, JSON.stringify(settings)); } catch (e) { /* ignore */ }
    syncSettingsForm();
    applySettings(key);
    if (!quiet) say(`${SCHEMA[key].label.split(' (')[0]}: ${describeSetting(key)}.`);
    return true;
  }
  function describeSetting(key) {
    const s = SCHEMA[key], v = settings[key];
    if (s.type === 'toggle') return v ? 'on' : 'off';
    if (s.type === 'select') return (s.options.find(o => o[0] === v) || [v, v])[1];
    if (s.max <= 1) return Math.round(v * 100) + ' percent';
    return String(v);
  }

  // =====================================================================
  // GEOGRAPHY HELPERS
  // =====================================================================
  const R_EARTH = 6371;
  const ARRIVE_KM = 300;
  const rad = d => d * Math.PI / 180;
  const wrapLon = lon => ((lon + 540) % 360) - 180;
  const clampLat = lat => Math.max(-89, Math.min(89, lat));
  const fmtLat = v => `${Math.abs(v).toFixed(0)} degrees ${v >= 0 ? 'north' : 'south'}`;
  const fmtLon = v => `${Math.abs(v).toFixed(0)} degrees ${v >= 0 ? 'east' : 'west'}`;
  const fmtLatShort = v => `${Math.abs(v).toFixed(1)}°${v >= 0 ? 'N' : 'S'}`;
  const fmtLonShort = v => `${Math.abs(v).toFixed(1)}°${v >= 0 ? 'E' : 'W'}`;

  function distanceKm(a, b) {   // great-circle (true) distance
    const dLat = rad(b.lat - a.lat), dLon = rad(b.lon - a.lon);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
    return 2 * R_EARTH * Math.asin(Math.min(1, Math.sqrt(h)));
  }
  // Direction in "arrow-key space": the way the arrows would take you on the map grid.
  // 0 = north, 90 = east. (Matches the arrow keys better than a great-circle bearing.)
  function gridBearing(a, b) {
    const dLon = wrapLon(b.lon - a.lon);
    const dLat = b.lat - a.lat;
    const x = dLon * Math.cos(rad((a.lat + b.lat) / 2));
    return (Math.atan2(x, dLat) * 180 / Math.PI + 360) % 360;
  }
  function compassWord(bearing) {
    return ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'][Math.round(bearing / 45) % 8];
  }
  function oceanName(lat, lon) {
    if (lat > 66) return 'Arctic Ocean';
    if (lat < -58) return 'Southern Ocean';
    if (lat > 30 && lat < 46 && lon > -6 && lon < 36) return 'Mediterranean Sea';
    if (lat > 18 && lat < 31 && lon > -98 && lon < -81) return 'Gulf of Mexico';
    if (lat > 9 && lat < 22 && lon > -88 && lon < -60) return 'Caribbean Sea';
    const ns = Math.abs(lat) < 8 ? ', near the equator' : '';
    const hemi = lat >= 0 ? 'North' : 'South';
    if (lon >= 20 && lon < 120 && lat < 30) return `Indian Ocean${ns}`;
    if (lon >= 120 && lon < 147 && lat < -10) return `Indian Ocean${ns}`;
    if (lat >= 0 ? (lon >= -100 && lon < 0) : (lon >= -68 && lon < 20)) return `${hemi} Atlantic${ns}`;
    if (lat >= 0 && lon >= 0 && lon < 20 && lat < 66) return `${hemi} Atlantic${ns}`;
    return `${hemi} Pacific${ns}`;
  }
  const WATERY = /Ocean|Sea\b|Atlantic|Pacific|Current|Stream|Trench|Reef|region|Null Island|Point Nemo|Gulf|Bay/;
  function nearestPlace(lat, lon, maxKm, landOnly) {
    let best = null, bestD = Infinity;
    for (const p of window.PLACES || []) {
      if (landOnly && WATERY.test(p[0])) continue;
      const d = distanceKm({ lat, lon }, { lat: p[1], lon: p[2] });
      if (d < bestD) { bestD = d; best = p; }
    }
    return best && bestD <= maxKm ? { name: best[0], km: bestD } : null;
  }
  function placeName(lat, lon, isLand) {
    const near = nearestPlace(lat, lon, isLand ? 1500 : 700, isLand);
    if (isLand) return near ? `land near ${near.name}` : 'over land';
    const sea = oceanName(lat, lon);
    return near && !sea.startsWith(near.name) ? `${sea}, near ${near.name}` : sea;
  }
  function findPlace(text) {
    const t = ' ' + text.toLowerCase().replace(/[^a-z0-9 ]/g, ' ') + ' ';
    let best = null, bestLen = 0;
    for (const p of window.PLACES || []) {
      for (const alias of [p[0].toLowerCase(), ...p.slice(3)]) {
        if (alias.length > bestLen && t.includes(' ' + alias + ' ')) { best = p; bestLen = alias.length; }
      }
    }
    return best ? { name: best[0], lat: best[1], lon: best[2] } : null;
  }
  function parseCoords(text) {   // "30 north 40 west", "30N 40W", "-12.5, 130"
    const m = text.toLowerCase().match(/(-?\d+(?:\.\d+)?)\s*°?\s*(n|s|north|south)?\s*[, ]\s*(?:and\s+)?(-?\d+(?:\.\d+)?)\s*°?\s*(e|w|east|west)?/);
    if (!m) return null;
    let lat = parseFloat(m[1]), lon = parseFloat(m[3]);
    if (m[2] && m[2][0] === 's') lat = -Math.abs(lat);
    if (m[4] && m[4][0] === 'w') lon = -Math.abs(lon);
    if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
    return { name: `${fmtLatShort(lat)}, ${fmtLonShort(lon)}`, lat, lon };
  }

  // =====================================================================
  // DATA LAYERS
  // Each layer answers: valueAt(lat, lon) -> { norm 0..1, land, spoken, short }
  // =====================================================================
  const layer = {
    kind: null, ready: false, frame: 0, title: '', source: '', units: '',
    grid: null, frames: [], palette: null, w: 0, h: 0, img: null,
    valueAt: () => ({ norm: 0, land: false, spoken: 'no data', short: '-' }),
    dateText: () => '',
  };

  async function loadLayer() {
    layer.ready = false;
    const stat = document.getElementById('datastat');
    stat.textContent = 'Loading NASA data...';
    const want = settings.dataset;
    if (want === 'sst' || want === 'auto') {
      try { await loadSST(); return; } catch (e) {
        console.warn('EIC SST layer not available:', e);
        if (want === 'sst') { stat.textContent = 'EIC ocean temperature file (data/sst.json) not found. Run tools/preprocess_sst.py first.'; return; }
      }
    }
    try { await loadIMERG(); } catch (e) {
      stat.textContent = 'Could not load NASA data right now.';
      console.warn(e);
    }
  }

  // ---- EIC sea surface temperature (made by tools/preprocess_sst.py from NASA SVS #3912)
  async function loadSST() {
    const r = await fetch('data/sst.json', { cache: 'no-cache' });
    if (!r.ok) throw new Error('data/sst.json: HTTP ' + r.status);
    const j = await r.json();
    const g = j.meta.grid;
    Object.assign(layer, {
      kind: 'sst', title: j.meta.title, source: j.meta.source, units: j.meta.units,
      w: g.w, h: g.h, deg: g.deg, latTop: g.lat_top, lonLeft: g.lon_left,
      vmin: j.meta.vmin, vmax: j.meta.vmax, palette: j.palette,
      frames: j.frames, frame: 0, description: j.meta.description,
    });
    layer.grid = layer.frames[0].grid;
    layer.cellAt = (lat, lon) => {
      const r = Math.min(layer.h - 1, Math.max(0, Math.floor((layer.latTop - lat) / layer.deg)));
      const c = Math.min(layer.w - 1, Math.max(0, Math.floor((wrapLon(lon) - layer.lonLeft) / layer.deg)));
      return [r, c];
    };
    layer.raw = (lat, lon) => { const [r, c] = layer.cellAt(lat, lon); return layer.grid[r][c]; };
    layer.valueAt = (lat, lon) => {
      const v = layer.raw(lat, lon);
      if (v === null || v === undefined) return { norm: 0, land: true, spoken: 'land, no ocean data', short: 'land', value: null };
      const norm = (v - layer.vmin) / (layer.vmax - layer.vmin);
      return { norm: Math.max(0, Math.min(1, norm)), land: false, value: v,
        spoken: `${v.toFixed(0)} degrees Celsius`, short: `${v.toFixed(1)} °C` };
    };
    layer.dateText = () => {
      const d = new Date(String(layer.frames[layer.frame].date).slice(0, 10) + 'T12:00:00Z');
      return isNaN(d) ? String(layer.frames[layer.frame].date) :
        d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
    };
    layer.setFrame = i => {
      layer.frame = (i + layer.frames.length) % layer.frames.length;
      layer.grid = layer.frames[layer.frame].grid;
      renderLayer();
    };
    layer.ready = true;
    renderLayer();
    document.getElementById('datastat').textContent =
      `Data: ${layer.title}, NASA Earth Information Center visualization (SVS #3912), ${layer.frames.length} dates from ${layer.dateText()}. ` +
      (layer.frames.length > 1 ? 'Press [ and ] to change the date, P to play the year at your spot.' : '');
  }

  // ---- IMERG precipitation via NASA GIBS (the team's original prototype layer, kept as a backup)
  const GIBS = 'https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi';
  const IMERG_TIME = '2026-11-13T17:00:00Z';
  function imergIntensity(r, g, b) {   // legend colors -> 0..1 (from the original prototype)
    r /= 255; g /= 255; b /= 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
    let h = 0;
    if (d) h = mx === r ? ((g - b) / d + 6) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h *= 60;
    if (h >= 170) return Math.max(0, Math.min(0.2, 0.2 * (230 - h) / 60));
    if (h >= 76) return 0.2 + 0.35 * Math.max(0, Math.min(1, (158 - h) / 82));
    const base = 0.55 + 0.30 * (76 - h) / 76;
    return h < 10 ? Math.min(1, 0.85 + 0.15 * Math.max(0, Math.min(1, (1 - mx) / 0.41))) : base;
  }
  async function loadIMERG() {
    const W = 720, H = 360;
    const url = `${GIBS}?SERVICE=WMS&REQUEST=GetMap&VERSION=1.1.1&LAYERS=IMERG_Precipitation_Rate&SRS=EPSG:4326` +
      `&BBOX=-180,-90,180,90&WIDTH=${W}&HEIGHT=${H}&FORMAT=image/png&TRANSPARENT=TRUE&TIME=${IMERG_TIME}`;
    const img = await new Promise((res, rej) => {
      const i = new Image(); i.crossOrigin = 'anonymous';
      i.onload = () => res(i); i.onerror = () => rej(new Error('GIBS image failed')); i.src = url;
    });
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(img, 0, 0);
    const d = x.getImageData(0, 0, W, H).data, field = new Float32Array(W * H);
    for (let i = 0; i < field.length; i++) field[i] = d[4 * i + 3] < 20 ? 0 : Math.max(0.03, imergIntensity(d[4 * i], d[4 * i + 1], d[4 * i + 2]));
    const tier = v => v < 0.03 ? 'dry' : v < 0.12 ? 'light rain' : v < 0.3 ? 'moderate rain' : v < 0.55 ? 'heavy rain' : v < 0.85 ? 'very heavy rain' : 'extreme rain';
    Object.assign(layer, {
      kind: 'imerg', title: 'IMERG precipitation rate', units: '', img, w: W, h: H, frames: [], frame: 0,
      source: 'NASA IMERG via GIBS', description: 'Rainfall rate around the world at one moment in time.',
    });
    layer.raw = (lat, lon) => {
      const px = Math.min(W - 1, Math.max(0, Math.floor((wrapLon(lon) + 180) / 360 * W)));
      const py = Math.min(H - 1, Math.max(0, Math.floor((90 - lat) / 180 * H)));
      return field[py * W + px];
    };
    layer.valueAt = (lat, lon) => {
      const v = Math.min(1, Math.pow(layer.raw(lat, lon) / 0.9, 2));
      return { norm: v, land: false, value: v, spoken: tier(v), short: `${Math.round(v * 100)}% (${tier(v)})` };
    };
    layer.dateText = () => IMERG_TIME.slice(0, 16).replace('T', ' ') + ' UTC';
    layer.setFrame = () => {};
    layer.ready = true;
    renderLayer();
    document.getElementById('datastat').textContent =
      `Data: NASA IMERG precipitation (GIBS), ${layer.dateText()}. Backup layer: the challenge asks for EIC visuals, so add data/sst.json for the main demo.`;
  }

  // ---- smart targets
  function smartTarget(kind) {
    if (!layer.ready) return null;
    let best = null, bestScore = -Infinity;
    const here = player;
    const consider = (lat, lon, score) => {
      // tie-break toward the closest one
      const s = score - distanceKm(here, { lat, lon }) * 1e-6;
      if (s > bestScore) { bestScore = s; best = { lat, lon }; }
    };
    if (layer.kind === 'sst') {
      for (let r = 0; r < layer.h; r++) for (let c = 0; c < layer.w; c++) {
        const lat = layer.latTop - (r + 0.5) * layer.deg, lon = layer.lonLeft + (c + 0.5) * layer.deg;
        let score;
        if (kind === 'warmest' || kind === 'coldest') {
          const v = layer.grid[r][c];
          if (v === null) continue;
          score = kind === 'warmest' ? v : -v;
        } else if (kind === 'biggest_change') {
          let lo = Infinity, hi = -Infinity;
          for (const f of layer.frames) { const v = f.grid[r][c]; if (v !== null) { lo = Math.min(lo, v); hi = Math.max(hi, v); } }
          if (hi === -Infinity) continue;
          score = hi - lo;
        } else return null;
        consider(lat, lon, score);
      }
    } else if (layer.kind === 'imerg') {
      if (kind !== 'heaviest_rain' && kind !== 'warmest') return null;
      for (let lat = -60; lat <= 60; lat += 1) for (let lon = -179.5; lon < 180; lon += 1) {
        let s = 0;   // a little smoothing so we find a storm, not one pixel
        for (let a = -2; a <= 2; a++) for (let b = -2; b <= 2; b++) s += layer.raw(lat + a * 0.5, lon + b * 0.5);
        consider(lat, lon, s);
      }
    }
    if (!best) return null;
    const names = { warmest: 'the warmest water', coldest: 'the coldest water', biggest_change: 'the biggest temperature change this year', heaviest_rain: 'the heaviest rain' };
    return { ...best, name: names[kind] || kind };
  }

  // percentile of the value here among all ocean cells (for local explanations)
  function percentileHere() {
    if (layer.kind !== 'sst') return null;
    const v = layer.raw(player.lat, player.lon);
    if (v === null) return null;
    let below = 0, n = 0;
    for (const row of layer.grid) for (const x of row) if (x !== null) { n++; if (x < v) below++; }
    return Math.round(100 * below / n);
  }

  // =====================================================================
  // STATE
  // =====================================================================
  const player = { lat: 0, lon: 0 };
  let target = { lat: 0, lon: 0, name: 'Null Island, the center', arrived: true };
  const keys = new Set();
  let movedAt = 0, announcedStop = true, lastCell = '', lastLand = false;
  let playTimer = null;

  // =====================================================================
  // SPEECH + LIVE REGION
  // =====================================================================
  const live = document.getElementById('live');
  let lastSaid = '';
  function say(text, interrupt = true) {
    lastSaid = text;
    live.textContent = '';
    setTimeout(() => { live.textContent = text; }, 30);   // re-set so screen readers repeat it
    if (settings.speech && 'speechSynthesis' in window) {
      if (interrupt) speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.rate = settings.speechRate;
      speechSynthesis.speak(u);
    }
  }
  function whereText(full) {
    const v = layer.valueAt(player.lat, player.lon);
    const place = placeName(player.lat, player.lon, v.land);
    let s = v.land ? `${place[0].toUpperCase() + place.slice(1)}, no ocean data.` : `${place}. ${v.spoken}.`;
    if (full) {
      s = `${fmtLat(player.lat)}, ${fmtLon(player.lon)}. ${s}`;
      if (layer.ready) s += ` ${layer.dateText()}.`;
      s += ' ' + targetText();
    }
    return s;
  }
  function targetText() {
    if (!target) return 'No target set.';
    const d = distanceKm(player, target);
    if (d < ARRIVE_KM) return `You are at ${target.name}.`;
    return `${target.name} is ${Math.round(d).toLocaleString()} kilometers to the ${compassWord(gridBearing(player, target))}.`;
  }

  // =====================================================================
  // AUDIO
  // =====================================================================
  let ctx = null, master = null, muted = false;
  let dataOut, synthOut, bassOut, sineOut, oscs = [], harmony, harmonyGain, dataFilter;
  let metroOut, metroPanner, nextTick = 0, scheduler = null;
  let nextStep = 0, stepTime = 0, dataFreq = 220;

  const SCALES = {
    pentatonic: [0, 2, 4, 7, 9], major: [0, 2, 4, 5, 7, 9, 11],
    minor: [0, 2, 3, 5, 7, 8, 10], chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
  };
  const midiToHz = m => 440 * Math.pow(2, (m - 69) / 12);
  function snapToScale(midi) {
    const sc = SCALES[settings.scale] || SCALES.pentatonic;
    const base = Math.floor(midi / 12) * 12;
    let best = midi, bestD = Infinity;
    for (let o = -12; o <= 12; o += 12) for (const s of sc) {
      const m = base + o + s, d = Math.abs(m - midi);
      if (d < bestD) { bestD = d; best = m; }
    }
    return best;
  }
  function pitchFor(norm) {
    const lo = Math.min(settings.lowNote, settings.highNote), hi = Math.max(settings.lowNote, settings.highNote);
    const exact = lo + norm * (hi - lo);
    const m = settings.musicality;
    return exact * (1 - m) + snapToScale(exact) * m;   // slides from exact data pitch to scale notes
  }

  function buildAudio() {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain(); master.gain.value = settings.masterVolume; master.connect(ctx.destination);

    // ---- Data tone: centered (not spatial), because it is about where YOU are.
    dataOut = ctx.createGain(); dataOut.gain.value = 0; dataOut.connect(master);
    dataFilter = ctx.createBiquadFilter(); dataFilter.type = 'lowpass'; dataFilter.frequency.value = 2200; dataFilter.Q.value = 0.7;
    dataFilter.connect(dataOut);

    synthOut = ctx.createGain(); synthOut.connect(dataFilter);
    const tremolo = ctx.createGain(); tremolo.gain.value = 0.85; tremolo.connect(synthOut);
    const lfo = ctx.createOscillator(), lfoDepth = ctx.createGain();
    lfo.frequency.value = 0.6; lfoDepth.gain.value = 0.15; lfo.connect(lfoDepth).connect(tremolo.gain); lfo.start();
    [['sawtooth', -6, 0.09, 1], ['sawtooth', 6, 0.09, 1], ['triangle', 0, 0.18, 0.5]].forEach(([type, detune, gain, mult]) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type; o.detune.value = detune; o.frequency.value = dataFreq * mult; g.gain.value = gain;
      o.connect(g).connect(tremolo); o.start(); oscs.push({ o, mult });
    });
    // harmony: a fifth above, louder the more "musical" the setting
    harmony = ctx.createOscillator(); harmony.type = 'triangle'; harmony.frequency.value = dataFreq * 1.5;
    harmonyGain = ctx.createGain(); harmonyGain.gain.value = 0; harmony.connect(harmonyGain).connect(synthOut); harmony.start();

    sineOut = ctx.createGain(); sineOut.connect(dataFilter);
    const sine = ctx.createOscillator(); sine.type = 'sine'; sine.frequency.value = dataFreq;
    const sg = ctx.createGain(); sg.gain.value = 0.35; sine.connect(sg).connect(sineOut); sine.start();
    oscs.push({ o: sine, mult: 1 });

    build808();

    // ---- Metronome: one HRTF (3D) source placed in the direction of the target.
    metroPanner = ctx.createPanner();
    metroPanner.panningModel = 'HRTF';
    metroPanner.distanceModel = 'inverse'; metroPanner.refDistance = 1; metroPanner.rolloffFactor = 0;
    metroOut = ctx.createGain(); metroOut.gain.value = settings.metroVolume;
    metroOut.connect(metroPanner).connect(master);
    // Listener stays at the origin facing north (map up = Web Audio -z), so source direction = target direction.
    const L = ctx.listener;
    if (L.forwardX) {
      L.forwardX.value = 0; L.forwardY.value = 0; L.forwardZ.value = -1;
      L.upX.value = 0; L.upY.value = 1; L.upZ.value = 0;
      L.positionX.value = 0; L.positionY.value = 0; L.positionZ.value = 0;
    } else { L.setOrientation(0, 0, -1, 0, 1, 0); L.setPosition(0, 0, 0); }

    applySettings();
    nextTick = ctx.currentTime + 0.1; stepTime = ctx.currentTime + 0.05;
    scheduler = setInterval(schedule, 25);
  }

  // ---- 808 bass (from the original prototype), now transposed by the data value
  const BPM = 130, STEP = 60 / BPM / 4;
  const BASS_PATTERN = [[0, 55.0, 0.9], [3, 55.0, 0.3], [6, 65.41, 0.5], [8, 49.0, 0.9], [11, 49.0, 0.3], [12, 55.0, 0.5], [14, 73.42, 0.3]];
  let shaper, hatBuf, noiseBuf;
  function build808() {
    bassOut = ctx.createGain(); bassOut.connect(dataOut);
    shaper = ctx.createWaveShaper();
    const curve = new Float32Array(1024);
    for (let i = 0; i < 1024; i++) curve[i] = Math.tanh(2.6 * (i / 512 - 1));
    shaper.curve = curve; shaper.oversample = '4x'; shaper.connect(bassOut);
    hatBuf = ctx.createBuffer(1, ctx.sampleRate * 0.1, ctx.sampleRate);
    const d = hatBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 3);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.05, ctx.sampleRate);
    const n = noiseBuf.getChannelData(0);
    for (let i = 0; i < n.length; i++) n[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n.length, 6);
  }
  function voice808(t, freq, len, amp) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(freq * 3, t);
    o.frequency.exponentialRampToValueAtTime(freq, t + 0.06);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(amp, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    o.connect(g).connect(shaper); o.start(t); o.stop(t + len + 0.05);
  }
  function hat(t, vol) {
    const n = ctx.createBufferSource(), hp = ctx.createBiquadFilter(), g = ctx.createGain();
    n.buffer = hatBuf; hp.type = 'highpass'; hp.frequency.value = 6500; g.gain.value = vol;
    n.connect(hp).connect(g).connect(bassOut); n.start(t);
  }

  // ---- one-shot sounds
  function tone(freq, t, len, vol, type = 'sine', dest = master) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    o.connect(g).connect(dest); o.start(t); o.stop(t + len + 0.05);
  }
  function tick(t, northness) {
    const shift = settings.northSouthPitch ? Math.pow(2, (7 * northness) / 12) : 1;   // up to +-7 semitones
    if (settings.metroSound === 'wood') {
      tone(900 * shift, t, 0.07, 0.6, 'sine', metroOut);
      tone(2400 * shift, t, 0.03, 0.25, 'sine', metroOut);
    } else if (settings.metroSound === 'beep') {
      tone(1000 * shift, t, 0.05, 0.25, 'square', metroOut);
    } else {
      const n = ctx.createBufferSource(), bp = ctx.createBiquadFilter(), g = ctx.createGain();
      n.buffer = noiseBuf; bp.type = 'bandpass'; bp.frequency.value = 3000 * shift; bp.Q.value = 2; g.gain.value = 1.2;
      n.connect(bp).connect(g).connect(metroOut); n.start(t);
    }
  }
  function chime(kind) {
    if (!ctx || !settings.chimes) return;
    const t = ctx.currentTime;
    const notes = kind === 'equator' ? [1046.5, 1318.5] : [1568, 1174.7];   // equator rises, meridian falls
    notes.forEach((f, i) => tone(f, t + i * 0.12, 0.6, 0.18, 'sine'));
  }
  function thud() {
    if (!ctx || !settings.landThud) return;
    const t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(50, t + 0.15);
    g.gain.setValueAtTime(0.5, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
    o.connect(g).connect(master); o.start(t); o.stop(t + 0.25);
  }
  function arrivalChord() {
    if (!ctx) return;
    const t = ctx.currentTime;
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, t + i * 0.09, 0.9, 0.16, 'triangle'));
  }

  // ---- scheduler: metronome ticks + 808 steps, with lookahead for steady timing
  function metroBpm(km) {
    const far = 20000;
    const x = Math.log(Math.max(km, ARRIVE_KM) / ARRIVE_KM) / Math.log(far / ARRIVE_KM);   // 0 close .. 1 far
    return settings.metroFastBpm - (settings.metroFastBpm - settings.metroSlowBpm) * Math.min(1, x);
  }
  function schedule() {
    if (!ctx) return;
    const now = ctx.currentTime;
    // metronome
    const active = settings.metronome && target && !target.arrived;
    if (!active) nextTick = now + 0.05;
    while (active && nextTick < now + 0.12) {
      const b = gridBearing(player, target);
      const x = Math.sin(rad(b)), z = -Math.cos(rad(b));   // east = +x (right ear), north = -z (ahead)
      if (metroPanner.positionX) {
        metroPanner.positionX.setValueAtTime(x * 2, nextTick); metroPanner.positionY.setValueAtTime(0, nextTick); metroPanner.positionZ.setValueAtTime(z * 2, nextTick);
      } else metroPanner.setPosition(x * 2, 0, z * 2);
      tick(nextTick, Math.cos(rad(b)));
      nextTick += 60 / metroBpm(distanceKm(player, target));
    }
    // 808 beat
    if (settings.instrument !== '808') { nextStep = 0; stepTime = now + 0.05; return; }
    while (stepTime < now + 0.15) {
      const s = nextStep % 16;
      const ratio = dataFreq / midiToHz(Math.min(settings.lowNote, settings.highNote));
      BASS_PATTERN.forEach(([st, f, l]) => { if (st === s) voice808(stepTime, f * ratio, l, 0.9); });
      if (s % 2 === 0) hat(stepTime, s % 4 === 2 ? 0.18 : 0.08);
      nextStep++; stepTime += STEP;
    }
  }

  function updateDataTone() {
    if (!ctx) return;
    const v = layer.ready ? layer.valueAt(player.lat, player.lon) : { norm: 0, land: true };
    const t = ctx.currentTime, glide = 0.03 + 0.15 * settings.musicality;
    dataFreq = midiToHz(pitchFor(v.norm));
    oscs.forEach(({ o, mult }) => o.frequency.setTargetAtTime(dataFreq * mult, t, glide));
    harmony.frequency.setTargetAtTime(dataFreq * 1.5, t, glide);
    harmonyGain.gain.setTargetAtTime(0.08 * settings.musicality, t, 0.1);
    const on = settings.dataVoice && layer.ready && !v.land && !muted;
    dataOut.gain.setTargetAtTime(on ? settings.dataVolume : 0, t, 0.05);
  }

  function applySettings(changed) {
    if (changed === 'dataset') { loadLayer(); return; }
    if (!ctx) return;
    const t = ctx.currentTime;
    master.gain.setTargetAtTime(muted ? 0 : settings.masterVolume, t, 0.02);
    synthOut.gain.setTargetAtTime(settings.instrument === 'synth' ? 1 : 0, t, 0.05);
    bassOut.gain.setTargetAtTime(settings.instrument === '808' ? 1.1 : 0, t, 0.05);
    sineOut.gain.setTargetAtTime(settings.instrument === 'sine' ? 1 : 0, t, 0.05);
    metroOut.gain.setTargetAtTime(settings.metroVolume, t, 0.05);
    updateDataTone();
  }

  // =====================================================================
  // MOVEMENT + EVENTS
  // =====================================================================
  function moveTo(lat, lon, why) {
    player.lat = clampLat(lat); player.lon = wrapLon(lon);
    lastCell = ''; checkCell(true);
    if (why) say(why + ' ' + whereText(false));
  }
  function setTarget(t, mode) {
    if (!t) return false;
    target = { lat: clampLat(t.lat), lon: wrapLon(t.lon), name: t.name, arrived: false };
    if (mode === 'jump') { moveTo(target.lat, target.lon); target.arrived = true; say(`Jumped to ${t.name}. ${whereText(false)}`); }
    else say(`Target set: ${targetText()} Follow the ticks: they speed up as you get closer.`);
    return true;
  }
  function goHome() {
    moveTo(0, 0);
    target = { lat: 0, lon: 0, name: 'Null Island, the center', arrived: true };
    say('Home: zero, zero, where the equator meets the prime meridian. ' + whereText(false));
  }

  function checkCell(silent) {
    if (!layer.ready) return;
    const v = layer.valueAt(player.lat, player.lon);
    const cell = `${Math.floor(player.lat / 2.5)},${Math.floor(player.lon / 2.5)}`;
    if (cell !== lastCell) {
      lastCell = cell;
      updateDataTone();
      if (v.land && !lastLand && !silent) thud();
      lastLand = v.land;
    }
  }

  const KEYMAP = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', w: 'up', s: 'down', a: 'left', d: 'right' };
  const isTyping = el => el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);

  window.addEventListener('keydown', e => {
    if (e.key === 'Escape') { document.getElementById('map').focus(); return; }
    if (isTyping(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
    // let Space/Enter press a focused button or open a settings section, as usual
    if ((e.key === ' ' || e.key === 'Enter') && /^(BUTTON|SUMMARY|A)$/.test(e.target.tagName)) return;
    if (e.target.closest && e.target.closest('#settings') && e.key !== 'o') return;
    const k = KEYMAP[e.key] || KEYMAP[e.key.toLowerCase()];
    if (k) { keys.add(k); e.preventDefault(); stopPlay(); return; }
    if (e.key === 'Shift') { keys.add('shift'); return; }
    const key = e.key.toLowerCase();
    const actions = {
      ' ': () => goHome(),
      i: () => say(whereText(true)),
      t: () => say(targetText()),
      h: () => say(HELP),
      m: () => { muted = !muted; applySettings(); say(muted ? 'Muted.' : 'Sound on.'); },
      '1': () => setSetting('instrument', 'synth'),
      '2': () => setSetting('instrument', '808'),
      '3': () => setSetting('instrument', 'sine'),
      '[': () => stepDate(-1),
      ']': () => stepDate(1),
      p: () => playYear(),
      '/': () => document.getElementById('ask').focus(),
      v: () => listen(),
      o: () => { const s = document.getElementById('settings'); s.open = !s.open; if (s.open) s.querySelector('input,select').focus(); },
    };
    if (actions[key]) { e.preventDefault(); ensureAudio(); actions[key](); }
  });
  window.addEventListener('keyup', e => {
    const k = KEYMAP[e.key] || KEYMAP[e.key.toLowerCase()];
    if (k) keys.delete(k);
    if (e.key === 'Shift') keys.delete('shift');
  });
  window.addEventListener('blur', () => keys.clear());

  function stepDate(dir) {
    if (layer.frames.length < 2) { say('This data layer has only one date.'); return; }
    layer.setFrame(layer.frame + dir);
    updateDataTone();
    say(`${layer.dateText()}. ${layer.valueAt(player.lat, player.lon).spoken}.`);
  }
  function playYear() {
    if (playTimer) { stopPlay(); say('Stopped.'); return; }
    if (layer.frames.length < 2) { say('This data layer has only one date.'); return; }
    say(`Playing the year at ${placeName(player.lat, player.lon, false)}. Press P to stop.`);
    playTimer = setInterval(() => { layer.setFrame(layer.frame + 1); updateDataTone(); }, 250);
  }
  function stopPlay() { if (playTimer) { clearInterval(playTimer); playTimer = null; } }

  async function ensureAudio() {
    if (!ctx) buildAudio();
    if (ctx.state !== 'running') await ctx.resume();
    const b = document.getElementById('start'); if (b) b.remove();
  }
  document.getElementById('start').addEventListener('click', async () => {
    await ensureAudio();
    document.getElementById('map').focus();
    say('Terra-fic Tunes ready. ' + whereText(true) + ' Press H for help.');
  });

  const HELP = 'Arrow keys move, hold Shift to go faster. Space goes home to zero, zero. ' +
    'I tells you where you are, T tells you about your target. Left and right square brackets change the date, P plays the year. ' +
    'Slash opens the assistant, V lets you speak to it. O opens settings, M mutes, Escape returns to the map. ' +
    'The steady tone is the data where you are. The ticks are your target: faster means closer, and they come from its direction.';

  // =====================================================================
  // ASSISTANT: local commands first (work offline), Claude for everything else
  // =====================================================================
  const chat = document.getElementById('chat');
  const history = [];
  function log(who, text) {
    const p = document.createElement('p');
    p.innerHTML = `<b>${who}:</b> `;
    p.appendChild(document.createTextNode(text));
    chat.appendChild(p); chat.scrollTop = chat.scrollHeight;
  }
  function reply(text) { log('Guide', text); say(text); history.push({ role: 'assistant', text }); }

  function matchSetting(t) {
    let best = null, len = 0;
    for (const s of SETTINGS_SCHEMA) for (const w of s.words) if (w.length > len && t.includes(w)) { best = s; len = w.length; }
    return best;
  }
  function parseValue(s, t) {
    if (s.type === 'toggle') return /\b(off|disable|stop|no)\b/.test(t) ? false : true;
    if (s.type === 'select') {
      for (const [val, label] of s.options) if (t.includes(val) || t.includes(label.toLowerCase().split(' (')[0])) return val;
      return undefined;
    }
    const m = t.match(/(-?\d+(?:\.\d+)?)\s*(%|percent)?/);
    if (!m) {
      if (/\b(max|maximum|highest|full)\b/.test(t)) return s.max;
      if (/\b(min|minimum|lowest)\b/.test(t)) return s.min;
      return undefined;
    }
    let v = parseFloat(m[1]);
    if (s.max <= 1 && (m[2] || v > 1)) v /= 100;
    return v;
  }

  function localCommand(text) {
    const t = text.toLowerCase().trim();
    const mode = /\b(jump|teleport|instantly|put me)\b/.test(t) ? 'jump' : 'guide';
    if (/^(help|what can (you|i) do|commands)/.test(t)) return { reply: HELP };
    if (/where am i|where are we|my location/.test(t)) return { reply: whereText(true) };
    if (/\b(go|take me|bring me|jump|teleport)\b.*\b(home|center|centre|origin|zero)\b|^home$/.test(t)) return { run: goHome };
    const smart = /\b(warmest|hottest)\b/.test(t) ? 'warmest' : /\b(coldest|coolest)\b/.test(t) ? 'coldest'
      : /\b(biggest|most|largest)\b.*\bchange/.test(t) ? 'biggest_change' : /\b(heaviest|most|strongest)\b.*\b(rain|storm)|wettest|storm/.test(t) ? 'heaviest_rain' : null;
    if (smart && /\b(take|go|find|guide|show|where|jump|teleport|bring|navigate)\b/.test(t)) {
      const st = smartTarget(smart);
      return st ? { run: () => setTarget(st, mode) } : { reply: 'That smart target is not available for this data layer.' };
    }
    if (/\b(next|forward)\b.*\b(month|date|week|frame)\b/.test(t)) return { run: () => stepDate(1) };
    if (/\b(previous|back|earlier)\b.*\b(month|date|week|frame)\b/.test(t)) return { run: () => stepDate(-1) };
    if (/\bplay\b.*\byear\b/.test(t)) return { run: playYear };
    if (/\b(unmute)\b/.test(t)) return { run: () => { muted = false; applySettings(); say('Sound on.'); } };
    if (/^mute\b/.test(t)) return { run: () => { muted = true; applySettings(); say('Muted.'); } };
    if (/\blouder\b/.test(t)) return { run: () => setSetting('masterVolume', settings.masterVolume + 0.15) };
    if (/\b(quieter|softer)\b/.test(t)) return { run: () => setSetting('masterVolume', settings.masterVolume - 0.15) };
    if (/more musical|music mode/.test(t)) return { run: () => setSetting('musicality', 1) };
    if (/data mode|more exact|exact data|raw data/.test(t)) return { run: () => setSetting('musicality', 0) };
    if (/\b(use|switch to|play|turn on|change to)\b.*\b(808|synth|pure tone|sine)\b/.test(t)) return { run: () => setSetting('instrument', t.includes('808') ? '808' : t.includes('synth') ? 'synth' : 'sine') };
    if (/\b(reset)\b.*\bsettings\b/.test(t)) return { run: resetSettings };

    // settings: "turn off the chimes", "set metronome volume to 40%", "make the voice speed 1.5"
    if (/\b(turn|switch|set|change|make|put|enable|disable|increase|decrease|raise|lower)\b|\b(on|off)$/.test(t)) {
      const s = matchSetting(t);
      if (s) {
        let v = parseValue(s, t);
        if (v === undefined && s.type === 'range' && /\b(increase|raise|up|higher|faster)\b/.test(t)) v = settings[s.key] + (s.max - s.min) / 5;
        if (v === undefined && s.type === 'range' && /\b(decrease|lower|down|slower)\b/.test(t)) v = settings[s.key] - (s.max - s.min) / 5;
        if (v !== undefined) return { run: () => setSetting(s.key, v) };
      }
    }
    // navigation: "take me to Tokyo", "guide me to 30 north 40 west", "jump to Hawaii"
    const nav = t.match(/\b(?:take me|go|guide me|bring me|navigate|jump|teleport|fly|move|put me)\b(?: me)?(?: back)?(?: to| over to| towards?)\s+(.+)/);
    if (nav) {
      const place = parseCoords(nav[1]) || findPlace(nav[1]);
      if (place) return { run: () => setTarget(place, mode) };
      return { ai: true, fallback: `I don't know where "${nav[1]}" is yet. Try a city, an ocean, or coordinates like 30 north 40 west.` };
    }
    return { ai: true, fallback: explainLocally() };
  }

  function explainLocally() {
    const v = layer.valueAt(player.lat, player.lon);
    if (v.land) return `You are ${placeName(player.lat, player.lon, true)}. This layer only has ocean data, so it is quiet on land.`;
    const p = percentileHere();
    let s = `You are in the ${placeName(player.lat, player.lon, false)}, at ${v.spoken}.`;
    if (p !== null) s += ` That is warmer than ${p} percent of the ocean on ${layer.dateText()}.`;
    if (layer.kind === 'sst') s += Math.abs(player.lat) < 23 ? ' The tropics get the most direct sunlight all year, so the water stays warm.'
      : Math.abs(player.lat) > 50 ? ' Sunlight hits this far from the equator at a low angle, so the water stays cold.'
      : ' In the mid-latitudes the water warms and cools with the seasons.';
    return s;
  }

  function assistantContext() {
    const v = layer.valueAt(player.lat, player.lon);
    return {
      position: { lat: +player.lat.toFixed(2), lon: +player.lon.toFixed(2) },
      place: placeName(player.lat, player.lon, v.land),
      data_layer: layer.title, data_source: layer.source, date: layer.ready ? layer.dateText() : null,
      value_here: v.land ? 'land (no ocean data)' : v.short,
      percent_of_ocean_colder_than_here: percentileHere(),
      target: target ? { name: target.name, km: Math.round(distanceKm(player, target)), direction: compassWord(gridBearing(player, target)), arrived: target.arrived } : null,
      settings, settings_schema: SETTINGS_SCHEMA.map(({ key, label, type, min, max, options }) => ({ key, label, type, min, max, options: options && options.map(o => o[0]) })),
    };
  }

  function runAiAction(a) {
    const inp = a.input || {};
    if (a.tool === 'go_to_place' && Number.isFinite(+inp.lat) && Number.isFinite(+inp.lon)) {
      setTarget({ lat: +inp.lat, lon: +inp.lon, name: String(inp.name || 'that place').slice(0, 80) }, inp.mode === 'jump' ? 'jump' : 'guide');
      return true;
    }
    if (a.tool === 'find_smart_target') {
      if (inp.kind === 'home') { goHome(); return true; }
      const st = smartTarget(inp.kind);
      if (st) { setTarget(st, inp.mode === 'jump' ? 'jump' : 'guide'); return true; }
    }
    if (a.tool === 'change_setting') return setSetting(inp.key, inp.value, true);
    if (a.tool === 'change_date' && Number.isFinite(+inp.steps)) { stepDate(Math.sign(+inp.steps) || 1); return true; }
    return false;
  }

  async function ask(text) {
    text = text.trim();
    if (!text) return;
    log('You', text);
    history.push({ role: 'user', text });
    const local = localCommand(text);
    if (local.run) {   // ran on this device: show what it said in the chat log too
      lastSaid = ''; local.run();
      if (lastSaid) { log('Guide', lastSaid); history.push({ role: 'assistant', text: lastSaid }); }
      return;
    }
    if (local.reply) { reply(local.reply); return; }
    if (settings.assistant) {
      try {
        say('Thinking...');
        const r = await fetch('api/assistant', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: text, context: assistantContext(), history: history.slice(-7, -1) }),
        });
        if (r.ok) {
          const j = await r.json();
          const did = (j.actions || []).map(runAiAction).some(Boolean);
          if (j.reply) reply(j.reply);
          else if (!did) reply(local.fallback);
          return;
        }
        console.warn('assistant HTTP', r.status, await r.text());
      } catch (e) { console.warn('assistant unavailable', e); }
    }
    reply(local.fallback);
  }

  document.getElementById('askForm').addEventListener('submit', e => {
    e.preventDefault();
    ensureAudio();
    const box = document.getElementById('ask');
    ask(box.value); box.value = '';
  });

  // voice input (Chrome, Edge, Safari)
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const micBtn = document.getElementById('mic');
  if (!SR) micBtn.hidden = true;
  function listen() {
    if (!SR) { say('Voice input is not supported in this browser. Press slash to type instead.'); return; }
    const rec = new SR(); rec.lang = 'en-US'; rec.interimResults = false;
    if ('speechSynthesis' in window) speechSynthesis.cancel();
    rec.onresult = e => ask(e.results[0][0].transcript);
    rec.onerror = () => say('I did not catch that.');
    micBtn.setAttribute('aria-pressed', 'true'); rec.onend = () => micBtn.setAttribute('aria-pressed', 'false');
    tone && ctx && tone(880, ctx.currentTime, 0.12, 0.2);   // "listening" blip
    rec.start();
  }
  micBtn.addEventListener('click', () => { ensureAudio(); listen(); });

  // =====================================================================
  // SETTINGS PANEL (built from the schema, so new settings appear automatically)
  // =====================================================================
  const form = document.getElementById('settingsForm');
  SETTINGS_SCHEMA.forEach(s => {
    const row = document.createElement('div'); row.className = 'row';
    const id = 'set_' + s.key;
    let input;
    if (s.type === 'toggle') {
      input = document.createElement('input'); input.type = 'checkbox';
      input.addEventListener('change', () => setSetting(s.key, input.checked, true));
    } else if (s.type === 'range') {
      input = document.createElement('input'); input.type = 'range';
      input.min = s.min; input.max = s.max; input.step = s.step;
      input.addEventListener('input', () => setSetting(s.key, input.value, true));
    } else {
      input = document.createElement('select');
      s.options.forEach(([v, l]) => { const o = document.createElement('option'); o.value = v; o.textContent = l; input.appendChild(o); });
      input.addEventListener('change', () => setSetting(s.key, input.value, true));
    }
    input.id = id;
    const label = document.createElement('label'); label.htmlFor = id; label.textContent = s.label;
    const out = document.createElement('output'); out.id = id + '_out'; out.htmlFor = id;
    if (s.type === 'toggle') row.append(input, label);
    else if (s.type === 'select') row.append(label, input);
    else row.append(label, input, out);
    form.appendChild(row);
  });
  function syncSettingsForm() {
    SETTINGS_SCHEMA.forEach(s => {
      const el = document.getElementById('set_' + s.key), out = document.getElementById('set_' + s.key + '_out');
      if (s.type === 'toggle') el.checked = settings[s.key]; else el.value = settings[s.key];
      if (out) out.textContent = describeSetting(s.key);
      if (s.type === 'range') el.setAttribute('aria-valuetext', describeSetting(s.key));
    });
  }
  function resetSettings() {
    SETTINGS_SCHEMA.forEach(s => settings[s.key] = s.def);
    try { localStorage.removeItem(STORE); } catch (e) { /* ignore */ }
    syncSettingsForm(); applySettings(); loadLayer();
    say('Settings reset to defaults.');
  }
  document.getElementById('resetSettings').addEventListener('click', resetSettings);
  syncSettingsForm();

  // =====================================================================
  // DRAWING
  // =====================================================================
  const canvas = document.getElementById('c');
  const g = canvas.getContext('2d');
  const CW = canvas.width, CH = canvas.height;
  const X = lon => (wrapLon(lon) + 180) / 360 * CW;
  const Y = lat => (90 - lat) / 180 * CH;
  const layerCanvas = document.createElement('canvas'); layerCanvas.width = CW; layerCanvas.height = CH;

  function colorFor(v) {
    const p = layer.palette;
    let best = 0;
    for (let i = 1; i < p.values.length; i++) if (Math.abs(p.values[i] - v) < Math.abs(p.values[best] - v)) best = i;
    return `rgb(${p.colors[best].join(',')})`;
  }
  function renderLayer() {
    const lg = layerCanvas.getContext('2d');
    lg.fillStyle = '#0d1426'; lg.fillRect(0, 0, CW, CH);
    if (layer.kind === 'sst') {
      const cw = CW / layer.w, ch = CH / layer.h;
      for (let r = 0; r < layer.h; r++) for (let c = 0; c < layer.w; c++) {
        const v = layer.grid[r][c];
        lg.fillStyle = v === null ? '#1b2238' : colorFor(v);
        lg.fillRect(c * cw, r * ch, cw + 0.5, ch + 0.5);
      }
    } else if (layer.kind === 'imerg' && layer.img) {
      lg.globalAlpha = 0.9; lg.drawImage(layer.img, 0, 0, CW, CH); lg.globalAlpha = 1;
    }
  }

  function draw(now) {
    g.drawImage(layerCanvas, 0, 0);
    // lat/lon grid every 30 degrees; the axes (equator, prime meridian) brighter
    g.lineWidth = 1; g.font = '13px system-ui'; g.fillStyle = '#8aa0c8';
    for (let lon = -180; lon <= 180; lon += 30) {
      g.strokeStyle = lon === 0 ? '#9fb8ff' : 'rgba(255,255,255,0.08)'; g.lineWidth = lon === 0 ? 2 : 1;
      g.beginPath(); g.moveTo(X(lon) - (lon === 180 ? 1 : 0), 0); g.lineTo(X(lon) - (lon === 180 ? 1 : 0), CH); g.stroke();
    }
    for (let lat = -90; lat <= 90; lat += 30) {
      g.strokeStyle = lat === 0 ? '#9fb8ff' : 'rgba(255,255,255,0.08)'; g.lineWidth = lat === 0 ? 2 : 1;
      g.beginPath(); g.moveTo(0, Y(lat)); g.lineTo(CW, Y(lat)); g.stroke();
    }
    g.fillStyle = '#c9d6ff';
    g.fillText('Equator', 8, Y(0) - 6);
    g.save(); g.translate(X(0) + 6, 16); g.fillText('Prime meridian', 0, 0); g.restore();

    // target: pulsing rings
    if (target) {
      const tx = X(target.lon), ty = Y(target.lat);
      for (let i = 0; i < 3; i++) {
        const ph = ((now / 1800) + i / 3) % 1;
        g.strokeStyle = `rgba(255,176,60,${0.6 * (1 - ph)})`; g.lineWidth = 2;
        g.beginPath(); g.arc(tx, ty, 5 + ph * 40, 0, Math.PI * 2); g.stroke();
      }
      g.fillStyle = '#ffb03c'; g.beginPath(); g.arc(tx, ty, 6, 0, Math.PI * 2); g.fill();
      if (!target.arrived) {
        g.strokeStyle = 'rgba(255,176,60,0.4)'; g.setLineDash([6, 6]);
        g.beginPath(); g.moveTo(X(player.lon), Y(player.lat)); g.lineTo(tx, ty); g.stroke(); g.setLineDash([]);
      }
    }
    // player
    const px = X(player.lon), py = Y(player.lat);
    g.fillStyle = '#ffffff'; g.beginPath(); g.arc(px, py, 9, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#4da3ff'; g.beginPath(); g.arc(px, py, 6, 0, Math.PI * 2); g.fill();
  }

  // =====================================================================
  // MAIN LOOP
  // =====================================================================
  const hud = {};
  ['pos', 'place', 'value', 'date', 'tgt', 'dist', 'dir'].forEach(id => hud[id] = document.getElementById(id));
  let last = performance.now();

  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    const ax = (keys.has('right') ? 1 : 0) - (keys.has('left') ? 1 : 0);
    const ay = (keys.has('up') ? 1 : 0) - (keys.has('down') ? 1 : 0);
    if (ax || ay) {
      const len = Math.hypot(ax, ay), sp = settings.speed * (keys.has('shift') ? 3 : 1) * dt;
      const before = { lat: player.lat, lon: player.lon };
      player.lat = clampLat(player.lat + (ay / len) * sp);
      // moving east/west covers fewer degrees near the poles... we keep it simple: degrees per second
      player.lon = wrapLon(player.lon + (ax / len) * sp);
      if (Math.sign(before.lat) !== Math.sign(player.lat) && before.lat !== 0) { chime('equator'); say(`Crossed the equator into the ${player.lat > 0 ? 'Northern' : 'Southern'} Hemisphere.`, false); }
      if (Math.sign(before.lon) !== Math.sign(player.lon) && before.lon !== 0 && Math.abs(before.lon) < 90) { chime('meridian'); say(`Crossed the prime meridian into the ${player.lon > 0 ? 'Eastern' : 'Western'} Hemisphere.`, false); }
      checkCell(false);
      movedAt = now; announcedStop = false;
    } else if (!announcedStop && now - movedAt > 700) {
      announcedStop = true;
      if (settings.autoAnnounce) say(whereText(false), false);
    }

    // arrival
    if (target) {
      const d = distanceKm(player, target);
      if (!target.arrived && d < ARRIVE_KM) { target.arrived = true; arrivalChord(); say(`You've arrived at ${target.name}. ${whereText(false)}`); }
      else if (target.arrived && d > ARRIVE_KM * 2) target.arrived = false;
    }

    // HUD
    const v = layer.valueAt(player.lat, player.lon);
    hud.pos.textContent = `${fmtLatShort(player.lat)}, ${fmtLonShort(player.lon)}`;
    hud.place.textContent = layer.ready ? placeName(player.lat, player.lon, v.land) : '-';
    hud.value.textContent = layer.ready ? v.short : 'loading';
    hud.date.textContent = layer.ready ? layer.dateText() : '-';
    if (target) {
      const d = distanceKm(player, target);
      hud.tgt.textContent = target.name;
      hud.dist.textContent = `${Math.round(d).toLocaleString()} km`;
      hud.dir.textContent = d < ARRIVE_KM ? 'here' : compassWord(gridBearing(player, target));
    }
    draw(now);
    requestAnimationFrame(frame);
  }

  loadLayer().then(() => { lastCell = ''; checkCell(true); });
  requestAnimationFrame(frame);

  // for testing in the browser console
  window.EarthJukebox = { settings, setSetting, ask, player, layer, smartTarget, localCommand, get target() { return target; } };
})();
