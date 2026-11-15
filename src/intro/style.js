// Earth Jukebox intro tutorial, "Pin Wall" style (rebuilt from the Pin Wall reference for the Earth Jukebox).
// Needs THREE (three.js 0.187.0), stage.js (K, registerStyle) and geo.js (window.EJ_GEO, Natural Earth outlines) first.
// The app runs this file with THREE, K and registerStyle passed in, so it never meets the app's own older three.js.
// Written with AI assistance (Claude).
{
  // ---------------------------------------------------------------- content
  // The wall is the whole world as ONE MOVING RELIEF of steel pins: x = longitude, y = latitude (1 unit = 15 degrees),
  // Null Island (0 N, 0 E) in the middle. Land stands a little proud of the sea. On top of that, the story:
  //   1  a pulse rings out from Null Island: home
  //   2  "you" (a bright raised group of pins) walk from beside home into a band of Atlantic rain
  //   3  the rain layer rises out of the wall: more rain stands taller and shines brighter (louder + brighter)
  //   4  the storm's extreme core trembles (the app's extreme tremble)
  //   5  the other four layers rise in their Earth Orchestra colours: one relief, one chord
  //   6  then & now: a wipe of light takes the wall back to 2006 (ocean heat lower, cooler), and a second wipe returns
  // The data shapes are ILLUSTRATIVE (where these things usually are), not a NASA frame.
  const DURATION = 30;
  const WALL_W = 24, WALL_H = 12, DEG = 15;          // 360 x 180 degrees on a 24 x 12 wall
  // say: the caption on the plate. speak: the line the app's voice reads at that moment (for listeners who cannot see it)
  const BEATS = [
    { at: 0.0, say: 'This pulse is home', note: 'Null Island, 0° N 0° E', speak: 'Welcome. This soft pulse is home. Press S to skip.' },
    { at: 5.5, say: 'Walk with the arrow keys', speak: 'Walk with the arrow keys, or W A S D.' },
    { at: 10.5, say: 'More rain: louder and brighter', speak: 'More rain plays louder and brighter.' },
    { at: 16.0, say: 'A tremble means extreme', speak: 'A tremble means extreme.' },
    { at: 20.0, say: 'Press 6: five layers, one chord', speak: 'Press 6 to hear all five layers as one chord.' },
    { at: 25.5, say: 'Press T: then and now', note: '20 years apart', speak: 'Press T to hear twenty years ago. Now, your turn.' },
  ];
  // the app's own Earth Orchestra colours (index.html ORCHESTRA), plus the wall's resting tints
  const TINT = {
    sea: '#3f6098', land: '#c9a57a', home: '#ffd36a', you: '#f4f6fa',
    rain: '#5082ff', heat: '#ff5a32', plants: '#50e164', ocean: '#28d7d7', haze: '#ffc83c', extreme: '#ff6a46',
  };
  const SEA = 0.35, LAND = 0.11;                     // resting heights
  const BPM = 72, BEAT = 60 / BPM;                   // the app's pulse tempo
  const RING = { speed: 3.2, width: 0.4, life: 3.2, height: 0.3 };
  const STORM = [-24, 8];                            // Atlantic rain band off West Africa (lon, lat)
  const START = [12, -8];                            // where the app first places you (index.html: 12 E, 8 S)
  const WALK = { from: 5.8, to: 9.9 };
  const RAIN = { at: 10.6, front: 5.5, height: 1.0 }; // the rain layer rises outwards from you
  const TREMBLE = { at: 16.0, rate: 7, depth: 0.13 }; // 7 Hz, as in the app
  const LAYERS = [                                    // the orchestra roll call (app order after rain)
    { key: 'heat', at: 20.35 }, { key: 'plants', at: 20.95 }, { key: 'ocean', at: 21.55 }, { key: 'haze', at: 22.15 },
  ];
  const ORCH = { front: 7, height: 0.85 };
  const WIPES = [{ at: 25.75, to: 1 }, { at: 27.75, to: 0 }];   // to 2006 (then = 1), back to 2026
  const WIPE_LEN = 1.0;
  const THEN = { ocean: 0.62 };                       // illustrative: in 2006 the warm ocean stands lower

  const N = K.noise(11), TAU = Math.PI * 2;
  const g = (lon, lat, cx, cy, rx, ry) => Math.exp(-Math.pow((lon - cx) / rx, 2) - Math.pow((lat - cy) / ry, 2));
  const toXY = (lon, lat) => [lon / DEG, lat / DEG];
  const youPath = K.path([[0, toXY(...START)], [WALK.from, toXY(...START)], [WALK.to, toXY(STORM[0] + 1.5, STORM[1] - 0.5)], [DURATION, toXY(STORM[0] + 1.5, STORM[1] - 0.5)]]);

  // land mask from the Natural Earth outlines (geo.js), drawn once on a small canvas and softened at the coasts
  let landData = null;
  function landMask() {
    const w = 720, h = 360, c = document.createElement('canvas'); c.width = w; c.height = h;
    const x = c.getContext('2d'); x.fillStyle = '#fff';
    for (const [, , polys] of (window.EJ_GEO || { countries: [] }).countries) for (const rings of polys) {
      x.beginPath();
      for (const r of rings) { for (let i = 0; i < r.length; i += 2) { const px = (r[i] + 180) * 2, py = (90 - r[i + 1]) * 2; i ? x.lineTo(px, py) : x.moveTo(px, py); } x.closePath(); }
      x.fill('evenodd');
    }
    const b = document.createElement('canvas'); b.width = w; b.height = h;
    const bx = b.getContext('2d'); bx.filter = 'blur(1.2px)'; bx.drawImage(c, 0, 0);
    landData = { d: bx.getImageData(0, 0, w, h).data, w, h };
  }
  const landAt = (lon, lat) => {
    const { d, w, h } = landData, px = Math.max(0, Math.min(w - 1, Math.round((lon + 180) * 2))), py = Math.max(0, Math.min(h - 1, Math.round((90 - lat) * 2)));
    return d[(py * w + px) * 4] / 255;
  };

  function setup(x, y) {
    const lon = x * DEG, lat = y * DEG, land = landAt(lon, lat), sea = 1 - land, n = N.fbm(x * 0.9, y * 0.9, 2, 3);
    const band = Math.exp(-Math.pow((lat - 7 - 3 * Math.sin(lon / 40)) / 6.5, 2)) * K.clamp(0.55 + 0.9 * n);
    const storm = g(lon, lat, ...STORM, 7.5, 5);
    const rain = K.clamp(Math.max(0.62 * band, 0.5 * g(lon, lat, 92, 14, 14, 7) * K.clamp(0.6 + n), 0.42 * g(lon, lat, 130, -8, 22, 6), storm * 0.98) + 0.06 * n);
    const heat = land * K.clamp(Math.max(g(lon, lat, 12, 22, 22, 9), 0.95 * g(lon, lat, 45, 23, 10, 8), 0.9 * g(lon, lat, 133, -24, 14, 8), 0.7 * g(lon, lat, -112, 33, 9, 6), 0.55 * g(lon, lat, 70, 30, 12, 8), 0.5 * g(lon, lat, -65, -28, 7, 8)) + 0.08 * n);
    const plants = land * K.clamp(Math.max(g(lon, lat, -62, -5, 14, 10), 0.9 * g(lon, lat, 22, 0, 10, 7), 0.85 * g(lon, lat, 110, 0, 14, 8), 0.5 * g(lon, lat, -90, 50, 28, 8), 0.45 * g(lon, lat, 20, 52, 28, 7), 0.42 * g(lon, lat, 90, 58, 45, 6)) + 0.06 * n);
    const ocean = 0.58 * sea * K.clamp((0.22 + 0.78 * Math.exp(-Math.pow(lat / 24, 2))) * (0.85 + 0.3 * g(lon, lat, 150, 5, 35, 14)) + 0.05 * n);
    const haze = K.clamp(Math.max(g(lon, lat, -20, 16, 22, 6), 0.8 * g(lon, lat, 8, 20, 15, 7), 0.8 * g(lon, lat, 80, 25, 12, 6), 0.72 * g(lon, lat, 115, 32, 10, 6)) * (0.75 + 0.5 * n));
    return {
      x, y, land, rough: land * 0.07 * N.fbm(x * 2.2, y * 2.2, 5, 3), r: Math.hypot(x, y), rnd: K.hash(x * 9.1, y * 7.3),
      rain, core: K.smooth(0.72, 0.95, storm), layer: { heat, plants, ocean, haze },
      lo: (lon + 180) / 360,                         // 0 at the left edge, 1 at the right (for the wipes)
    };
  }

  function moment(t) {
    const you = youPath(t);
    // the last pulse beat, for the glow at home
    const k = Math.floor(t / BEAT), since = t - k * BEAT;
    const wipes = WIPES.map((w) => ({ ...w, x: K.lerp(-0.08, 1.08, K.seg(t, w.at, w.at + WIPE_LEN, K.ease.inOut)) }));
    return {
      you, beatGlow: Math.exp(-since / 0.25),
      walking: K.seg(t, WALK.from, WALK.from + 0.3) * (1 - K.seg(t, WALK.to - 0.3, WALK.to)),
      tremble: K.seg(t, TREMBLE.at, TREMBLE.at + 0.35) * (1 - 0.55 * K.seg(t, 22.5, 24.5)),
      orch: K.seg(t, LAYERS[0].at - 0.2, LAYERS[0].at + 0.5),
      wipes, ring: 1 - 0.5 * K.seg(t, 20, 22),
    };
  }

  const col = Object.fromEntries(Object.entries(TINT).map(([k, v]) => [k, new THREE.Color(v)]));
  const tmp = new THREE.Color();
  function relief(p, m, t, o) {
    // ---- resting wall: sea and a little land
    let lift = SEA + LAND * p.land + p.rough, glow = 0;
    tmp.copy(col.sea).lerp(col.land, p.land);

    // ---- the pulse: a ring leaves Null Island on every beat and fades with distance (it gets quieter far from home)
    for (let b = Math.max(0, Math.floor((t - RING.life) / BEAT)); b * BEAT <= t; b++) {
      const tau = t - b * BEAT; if (tau <= 0) continue;
      const u = (p.r - RING.speed * tau) / RING.width;
      if (u > -4 && u < 3) lift += m.ring * RING.height * (Math.exp(-u * u) - 0.4 * Math.exp(-Math.pow(u + 1.6, 2))) * Math.exp(-p.r / 5) * (1 - tau / RING.life);
    }
    const home = Math.exp(-Math.pow(p.r / 0.13, 2));
    if (home > 0.01) { lift += home * (0.3 + 0.12 * m.beatGlow); glow += home * (0.45 + 0.55 * m.beatGlow); tmp.lerp(col.home, home); }

    // ---- the rain layer rises outwards from you; more rain stands taller and shines brighter
    const dy = Math.hypot(p.x - m.you[0], p.y - m.you[1]);
    const rt = t - RAIN.at - dy / RAIN.front - p.rnd * 0.05;
    let layerTop = 0;
    const mixC = [0, 0, 0]; let mixW = 0;
    const addLayer = (amt, c) => { if (amt <= 0.004) return; layerTop = Math.max(layerTop, amt); mixC[0] += c.r * amt; mixC[1] += c.g * amt; mixC[2] += c.b * amt; mixW += amt; };
    if (rt > 0) {
      const rise = rt > 2.5 ? 1 : K.spring(rt, 1.9, 0.5);
      const amt = p.rain * rise;
      addLayer(amt, p.core > 0.05 ? tmp.clone().copy(col.rain).lerp(col.extreme, p.core * K.seg(t, TREMBLE.at, TREMBLE.at + 0.4)) : col.rain);
      glow += 0.55 * Math.pow(amt, 2.2);
    }
    // ---- the extreme core trembles (7 times a second), and glows a little hotter
    if (p.core > 0.01 && m.tremble > 0) {
      lift += m.tremble * TREMBLE.depth * p.core * Math.sin(TAU * TREMBLE.rate * t + p.rnd * 2.0);
      glow += m.tremble * p.core * (0.5 + 0.35 * Math.sin(TAU * TREMBLE.rate * t));
    }
    // ---- the orchestra: the other four layers rise in turn, each in its instrument's colour
    let then = 0;
    for (const w of m.wipes) if (w.x > p.lo) then = w.to;            // which year this pin shows after the wipes passed
    for (const L of LAYERS) {
      const v = p.layer[L.key]; if (v < 0.02) continue;
      const tau = t - L.at - p.r / ORCH.front - p.rnd * 0.05; if (tau <= 0) continue;
      let amt = v * (tau > 2.5 ? 1 : K.spring(tau, 2.0, 0.5));
      if (L.key === 'ocean') {                                      // then & now: the ocean layer stands lower in 2006
        let f = 1;
        for (const w of m.wipes) { const pass = w.at + WIPE_LEN * K.clamp((p.lo + 0.08) / 1.16); const ta = t - pass; if (ta > 0) f = K.lerp(w.to ? 1 : THEN.ocean, w.to ? THEN.ocean : 1, ta > 2 ? 1 : K.spring(ta, 2.4, 0.5)); }
        amt *= f;
      }
      addLayer(amt * 0.92, col[L.key]);
    }
    if (mixW > 0) {
      const top = Math.max(mixC[0], mixC[1], mixC[2]) / mixW, sc = 1 / Math.max(1e-3, top);
      const lc = new THREE.Color(mixC[0] / mixW * sc, mixC[1] / mixW * sc, mixC[2] / mixW * sc);
      tmp.lerp(lc, K.clamp(layerTop * 2.2));
      lift += ORCH.height * layerTop + (RAIN.height - ORCH.height) * 0;
    }
    // ---- the wipes: a line of light runs across the wall, the pins it passes jump and settle
    for (const w of m.wipes) {
      const d = (p.lo - w.x) / 0.025;
      if (d > -6 && d < 3) { const e = Math.exp(-d * d); lift += 0.16 * e; glow += 0.8 * e; tmp.lerp(col.you, 0.6 * e); }
    }
    // ---- you: a bright raised group of pins; while walking the pins round it bob
    const yo = Math.exp(-Math.pow(dy / 0.12, 2));
    if (yo > 0.01) { lift += yo * (0.62 + 0.04 * Math.sin(t * 9) * m.walking); glow += yo * 0.35; tmp.lerp(col.you, yo); }
    if (m.walking > 0 && dy < 0.6) lift += m.walking * 0.05 * Math.exp(-dy / 0.2) * Math.sin(18 * dy - 14 * t);

    o.lift = lift; o.glow = K.clamp(glow, 0, 1.6); o.r = tmp.r; o.g = tmp.g; o.b = tmp.b;
  }

  // ---------------------------------------------------------------- the mechanism (as in the Pin Wall reference)
  const PITCH = 0.1;

  registerStyle({
    id: 'pin-wall-earth-jukebox',
    name: 'Pin Wall',
    family: 'Flat content made physical',
    topic: 'How to use the Earth Jukebox',
    duration: DURATION,
    beats: BEATS,
    fonts: ['500 60px "Oswald"', '500 40px "Inter"'],
    render: { samples: 40, shutter: 0.55, tone: 'filmic', exposure: 1.2, bloom: 0.4, bloomThreshold: 1.3, vignette: 0.4, grain: 0.012, saturation: 1.12, fov: 28, background: '#030304' },

    build(S) {
      const { THREE, K, scene, camera } = S;
      landMask();

      // pins: one instanced mesh; per pin a lift + glow (aPin) and a tint (aTint), written every moment
      const U = {};
      const patch = (m, lit) => {
        m.onBeforeCompile = (sh) => {
          Object.assign(sh.uniforms, U);
          sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec2 aPin; attribute vec3 aTint; varying vec2 vPin; varying vec3 vTint; varying float vShaft;')
            .replace('#include <begin_vertex>', '#include <begin_vertex>\nvShaft = position.z; vPin = aPin; vTint = aTint; transformed.z += aPin.x;');
          if (lit) sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec2 vPin; varying vec3 vTint; varying float vShaft;')
            .replace('#include <color_fragment>', '#include <color_fragment>\nfloat head = smoothstep(-0.085, -0.03, vShaft);\ndiffuseColor.rgb *= vTint * mix(0.42, 1.0, head);')
            .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += vTint * 7.0 * vPin.y * vPin.y * mix(0.3, 1.0, head);');
        };
        return m;
      };
      const R = PITCH * 0.47, LEN = 7, prof = [];
      for (const q of [0, 0.3, 0.55, 0.75, 0.9, 0.98, 1]) prof.push(new THREE.Vector2(Math.max(1e-4, q * R), -0.62 * R * (1 - Math.sqrt(1 - q * q * 0.985))));
      prof.push(new THREE.Vector2(R, -0.075), new THREE.Vector2(R * 0.9, -0.085), new THREE.Vector2(R * 0.9, -LEN));
      const pinGeo = new THREE.LatheGeometry(prof.reverse(), 12); pinGeo.rotateX(Math.PI / 2);
      const cols = Math.floor(WALL_W / PITCH), rowH = PITCH * Math.sqrt(3) / 2, rows = Math.floor(WALL_H / rowH), count = cols * rows;
      const aPin = new THREE.InstancedBufferAttribute(new Float32Array(count * 2), 2); aPin.setUsage(THREE.DynamicDrawUsage);
      const aTint = new THREE.InstancedBufferAttribute(new Float32Array(count * 3), 3); aTint.setUsage(THREE.DynamicDrawUsage);
      pinGeo.setAttribute('aPin', aPin); pinGeo.setAttribute('aTint', aTint);
      const pins = new THREE.InstancedMesh(pinGeo, patch(new THREE.MeshStandardMaterial({ color: '#c3c7cf', metalness: 0.9, roughness: 0.3 }), true), count);
      pins.customDepthMaterial = patch(new THREE.MeshDepthMaterial(), false);
      pins.castShadow = pins.receiveShadow = true; pins.frustumCulled = false;
      const shade = new THREE.Color(), spots = [];
      for (let r = 0, i = 0; r < rows; r++) for (let c = 0; c < cols; c++, i++) {
        const x = (c - (cols - 1) / 2 + (r % 2 ? 0.25 : -0.25)) * PITCH, y = (r - (rows - 1) / 2) * rowH;
        K.place(pins, i, [x, y, 0]); spots.push(setup(x, y));
        pins.setColorAt(i, shade.setScalar(0.86 + 0.14 * K.hash(c, r)));
      }
      scene.add(pins);
      const out = { lift: 0, glow: 0, r: 0, g: 0, b: 0 }, bp = aPin.array, bt = aTint.array;
      let shown = null, now = null;
      const show = (t) => {
        if (t === shown) return; shown = t; now = moment(t);
        for (let i = 0; i < count; i++) { relief(spots[i], now, t, out); bp[2 * i] = out.lift; bp[2 * i + 1] = out.glow; bt[3 * i] = out.r; bt[3 * i + 1] = out.g; bt[3 * i + 2] = out.b; }
        aPin.needsUpdate = true; aTint.needsUpdate = true;
      };

      // the frame, and darkness behind
      const coat = new THREE.MeshStandardMaterial({ color: '#0a0a0b', roughness: 0.7, metalness: 0.2 });
      const add = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; scene.add(m); return m; };
      const FB = 0.8, FRONT_Z = SEA + 0.3, FD = 2.2;
      for (const s of [-1, 1]) {
        add(K.roundedBox(WALL_W + FB * 2, FB, FD, 0.08, 4), coat, 0, s * (WALL_H + FB) / 2, FRONT_Z - FD / 2);
        add(K.roundedBox(FB, WALL_H + FB * 2, FD, 0.08, 4), coat, s * (WALL_W + FB) / 2, 0, FRONT_Z - FD / 2);
      }
      const bolt = new THREE.CylinderGeometry(0.11, 0.11, 0.08, 16); bolt.rotateX(Math.PI / 2);
      const boltMat = new THREE.MeshStandardMaterial({ color: '#3a3d42', roughness: 0.4, metalness: 0.9 });
      for (let i = 0; i < 14; i++) for (const s of [-1, 1]) add(bolt, boltMat, (i - 6.5) * 1.85, s * (WALL_H + FB) / 2, FRONT_Z + 0.02);
      for (let i = 0; i < 7; i++) for (const s of [-1, 1]) add(bolt, boltMat, s * (WALL_W + FB) / 2, (i - 3) * 1.85, FRONT_Z + 0.02);
      add(new THREE.PlaneGeometry(WALL_W, WALL_H), new THREE.MeshStandardMaterial({ color: '#020202', roughness: 1 }), 0, 0, -0.6);

      // light: low raking key from the far left, blue fill from the other side, a warm lamp over home
      K.env(S, { top: '#0a0c10', horizon: '#0b0c0f', bottom: '#040405', intensity: 0.75, panels: [
        { pos: [-14, 12, 16], size: [14, 8], color: '#eef3ff', power: 2.6 },
        { pos: [16, -6, 12], size: [5, 12], color: '#cfe0ff', power: 1.2 },
      ] });
      const key = K.sun(S, { pos: [-26, 6, 9.5], target: [0, 0, 0], color: '#fff4e6', power: 7, size: 14, soft: 1.1, mapSize: 4096, bias: -0.0012, normalBias: 0.01 });
      K.sun(S, { pos: [18, -9, 3.4], target: [0, 0, 0], color: '#5a98ff', power: 2.8, shadow: false });
      const lamp = new THREE.PointLight(TINT.home, 0, 0, 2); lamp.position.set(0, 0, 1.2); scene.add(lamp);
      const stormLamp = new THREE.PointLight(TINT.extreme, 0, 0, 2); scene.add(stormLamp);

      // camera: one continuous crane. Low across the pins at home, follows you into the rain, then rises over the world
      const S0 = toXY(STORM[0] + 1.5, STORM[1] - 0.5);
      const cam = {
        pos: K.path([[0, [2.4, -5.0, 2.1]], [5.5, [2.0, -5.6, 2.7]], [10.5, [0.2, -5.8, 3.3]], [16.0, [-0.6, -5.4, 3.5]], [19.6, [-0.8, -7.0, 4.6]], [24.0, [0.0, -19.5, 17.0]], [DURATION, [1.0, -20.5, 17.8]]]),
        aim: K.path([[0, [0.2, 0.25, 0.4]], [5.5, [0.0, 0.0, 0.45]], [10.5, [S0[0] + 0.5, S0[1] - 0.1, 0.6]], [16.0, [S0[0] + 0.2, S0[1], 0.85]], [19.6, [S0[0] + 0.4, S0[1] - 0.2, 0.8]], [24.0, [0, -0.2, 0.5]], [DURATION, [0.1, -0.2, 0.5]]]),
        ap: K.path([[0, 0.07], [10.5, 0.05], [19.6, 0.04], [24, 0.02], [DURATION, 0.018]]),
        foc: K.path([[0, [0.3, 0, SEA]], [5.5, [0.5, -0.3, SEA]], [10.5, [S0[0], S0[1], 0.8]], [19.6, [S0[0], S0[1], 0.8]], [24, [0, -1, 0.6]], [DURATION, [0, -1, 0.6]]]),
      };

      return {
        update(t) {
          show(t);
          lamp.intensity = 1.6 * (0.4 + 0.6 * now.beatGlow);
          stormLamp.position.set(S0[0], S0[1], 1.6); stormLamp.intensity = 2.2 * now.tremble * (0.75 + 0.25 * Math.sin(TAU * TREMBLE.rate * t));
          key.position.set(-26, 6 + t * 0.12, 9.5);
          camera.position.set(...cam.pos(t)); camera.up.set(0, 0, 1); camera.lookAt(...cam.aim(t));
          K.focus(camera, cam.foc(t), cam.ap(t));
        },
        overlay(ctx, t, W, H) {
          const sc = W / 1920; ctx.scale(sc, sc); W = 1920; H = 1080;   // captions are laid out for 1080p and scale with the frame
          BEATS.forEach((b, i) => {
            const next = BEATS[i + 1], a = (i ? K.seg(t, b.at + 0.05, b.at + 0.45, K.ease.out) : 1) * (next ? 1 - K.seg(t, next.at - 0.3, next.at) : 1);
            if (a <= 0) return;
            ctx.save(); ctx.globalAlpha = a; ctx.textBaseline = 'middle';
            ctx.font = '500 52px "Oswald"'; ctx.letterSpacing = '3px';
            const main = b.say.toUpperCase(), wMain = ctx.measureText(main).width;
            ctx.font = '500 38px "Inter"'; ctx.letterSpacing = '0px';
            const wNote = b.note ? ctx.measureText(b.note).width + 56 : 0;
            const w = wMain + wNote + 112, h = 96, x = (W - w) / 2, y = H - 150 + (1 - a) * 10;
            ctx.fillStyle = 'rgba(9,10,13,0.86)'; ctx.beginPath(); ctx.roundRect(x, y, w, h, 12); ctx.fill();
            ctx.strokeStyle = 'rgba(200,210,225,0.34)'; ctx.lineWidth = 2; ctx.stroke();
            ctx.fillStyle = 'rgba(200,210,225,0.5)';
            for (const sx of [x + 24, x + w - 24]) { ctx.beginPath(); ctx.arc(sx, y + h / 2, 5, 0, 7); ctx.fill(); }
            ctx.font = '500 52px "Oswald"'; ctx.letterSpacing = '3px'; ctx.fillStyle = '#eef1f6'; ctx.fillText(main, x + 56, y + h / 2 + 3);
            if (b.note) {
              ctx.fillStyle = 'rgba(200,210,225,0.34)'; ctx.fillRect(x + 56 + wMain + 26, y + 24, 2, h - 48);
              ctx.font = '500 38px "Inter"'; ctx.letterSpacing = '0px'; ctx.fillStyle = '#b9c3d2'; ctx.fillText(b.note, x + 56 + wMain + 56, y + h / 2 + 2);
            }
            ctx.restore();
          });
          // the year, on a small plate top left, only during then & now
          const ya = K.seg(t, 25.6, 25.9) * (1 - K.seg(t, 29.6, 30));
          if (ya > 0) {
            const year = t > WIPES[1].at + WIPE_LEN * 0.5 ? '2026' : t > WIPES[0].at + WIPE_LEN * 0.5 ? '2006' : '2026';
            ctx.save(); ctx.globalAlpha = ya; ctx.fillStyle = 'rgba(9,10,13,0.86)'; ctx.beginPath(); ctx.roundRect(72, 64, 220, 96, 12); ctx.fill();
            ctx.strokeStyle = 'rgba(200,210,225,0.34)'; ctx.lineWidth = 2; ctx.stroke();
            ctx.font = '500 60px "Oswald"'; ctx.letterSpacing = '6px'; ctx.textBaseline = 'middle'; ctx.textAlign = 'center'; ctx.fillStyle = year === '2006' ? '#9fd8ff' : '#eef1f6';
            ctx.fillText(year, 182, 115); ctx.restore();
          }
        },
      };
    },

    // ---------------------------------------------------------------- sound: the app's own notes, made of metal and air
    sound(k) {
      const K = globalThis.K;
      k.bed('room', 0, DURATION, { gain: 0.9 });
      // the pulse: a soft round A3 on every beat (the app's home pulse), fading a little as you walk away
      for (let b = 0; b * BEAT < DURATION - 0.2; b++) {
        const t = b * BEAT, far = K.seg(t, WALK.from, WALK.to);
        k.tone(t, { f: 'A3', dur: 1.6, gain: (b % 4 ? 0.09 : 0.13) * (1 - 0.55 * far) * (t > 20 ? 0.6 : 1), a: 0.12, filter: 'lowpass', f2: 1100, pan: -0.35 * far });
      }
      // the pins sliding in their holes, all the time
      k.withMinor(() => { for (let t = 0, j = 0; t < DURATION; t += 0.03, j++) k.play('tick', t + 0.012 * K.hash(j, 5), { gain: 0.05 + 0.04 * K.hash(j, 1), f: 4200 + 3600 * K.hash(j, 2), pan: K.hash(j, 3) * 1.6 - 0.8 }); });
      // walking: soft footsteps of pins
      for (let t = WALK.from, j = 0; t < WALK.to; t += 0.32, j++) k.play('tock', t, { f: 520 + 60 * (j % 2), gain: 0.22, pan: j % 2 ? 0.15 : -0.15 });
      // rain rises: a violin-like A4 that grows louder and brighter, with a rush of pins
      k.play('riser', RAIN.at - 0.2, { dur: 1.6, gain: 0.5 });
      k.tone(RAIN.at, { f: 'A4', type: 'sawtooth', dur: TREMBLE.at - RAIN.at + 0.3, gain: 0.07, a: 4.2, hold: 0.6, filter: 'lowpass', f2: [[0, 500], [4.5, 3200]], verb: 0.2 });
      k.tone(RAIN.at, { f: 'A4', type: 'triangle', detune: 6, dur: TREMBLE.at - RAIN.at + 0.3, gain: 0.05, a: 4.2, hold: 0.6, verb: 0.2 });
      k.withMinor(() => { for (let t = RAIN.at, j = 0; t < RAIN.at + 2.6; t += 0.012, j++) k.play('tick', t, { gain: 0.3 * Math.pow(1 - (t - RAIN.at) / 2.6, 1.3), f: 2800 + 3800 * K.hash(j, 7), pan: (K.hash(j, 8) - 0.5) * 1.4 }); });
      // the tremble: the same note, shivering 7 times a second, with a metallic rattle of pins
      for (let t = TREMBLE.at, j = 0; t < 20.2; t += 1 / TREMBLE.rate, j++) {
        const fade = 1 - K.seg(t, 19.2, 20.2);
        k.tone(t, { f: 'A4', type: 'sawtooth', dur: 0.13, gain: 0.085 * fade, a: 0.02, filter: 'lowpass', f2: 3400 });
        k.play('tick', t, { gain: 0.25 * fade, f: 3200 + 600 * (j % 3), pan: (j % 2 ? 0.3 : -0.3) });
      }
      k.play('thud', TREMBLE.at, { gain: 0.45, f: 110 });
      // the orchestra roll call: cello, flute, clarinet, horn join the violin (app notes A2, E5, E3, C#4), then hold
      const NOTE = { heat: ['A2', 'triangle'], plants: ['E5', 'sine'], ocean: ['E3', 'square'], haze: ['C#4', 'sawtooth'] };
      k.tone(20.0, { f: 'A4', type: 'triangle', dur: 9.6, gain: 0.04, a: 0.4, hold: 7.5, verb: 0.25 });
      LAYERS.forEach((L, i) => {
        const [n, type] = NOTE[L.key];
        k.play('tock', L.at, { f: 700 - i * 90, gain: 0.3 });
        k.tone(L.at, { f: n, type, dur: DURATION - L.at, gain: type === 'square' ? 0.02 : type === 'sawtooth' ? 0.025 : 0.05, a: 0.35, hold: DURATION - L.at - 1.6, filter: 'lowpass', f2: 1600, verb: 0.25 });
        k.withMinor(() => { for (let t = L.at, j = 0; t < L.at + 0.8; t += 0.015, j++) k.play('tick', t, { gain: 0.22 * (1 - (t - L.at) / 0.8), f: 3000 + 3000 * K.hash(j, i, 3), pan: (K.hash(j, i, 4) - 0.5) * 1.6 }); });
      });
      // then & now: a sweep of light across the wall, there and back, each landing with a bell
      WIPES.forEach((w, i) => {
        k.play('whoosh', w.at, { dur: WIPE_LEN + 0.2, gain: 0.5, top: i ? 3000 : 1800, pan: 0 });
        k.play('ding', w.at + WIPE_LEN, { f: i ? 'E6' : 'A5', gain: 0.22 });
      });
      // the end: the chord settles and the pulse goes on
      k.play('ding', 29.0, { f: 'A5', gain: 0.18 });
    },
  });
}
