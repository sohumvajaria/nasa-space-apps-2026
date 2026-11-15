// Earth Jukebox: shared 3D Earth (Three.js r128).
// Used by the main page (hero globe) and the World navigator (the interactive map).
//
// What you see: NASA Blue Marble relief on the day side, NASA Black Marble city lights on the night side,
// a warm twilight band, an ocean glint, a sun-tinted atmosphere, a starfield, and the active data layer
// wrapped on top. Markers (beacons with beams and rings), a window outline, a great-circle arc and a
// latitude/longitude graticule can be added on top.
//
// Usage:  const earth = EarthGL.create(canvas, { interactive: true });
//         earth.setOverlay(canvasOrImageOrUrl); earth.focus(lat, lon); ... earth.render(performance.now());
(function () {
  'use strict';
  if (typeof THREE === 'undefined') { window.EarthGL = null; return; }

  const GIBS = 'https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi';
  const wms = (layer, extra) => `${GIBS}?SERVICE=WMS&REQUEST=GetMap&VERSION=1.1.1&LAYERS=${layer}&SRS=EPSG:4326` +
    `&BBOX=-180,-90,180,90&WIDTH=2048&HEIGHT=1024&FORMAT=image/jpeg${extra || ''}`;

  // lat/lon (degrees) -> point on a sphere. Longitude 0 faces +x, 90E faces -z (matches three's sphere UVs).
  function ll(lat, lon, r) {
    const a = lat * Math.PI / 180, o = lon * Math.PI / 180;
    return new THREE.Vector3(r * Math.cos(a) * Math.cos(o), r * Math.sin(a), -r * Math.cos(a) * Math.sin(o));
  }

  function glowTexture(inner, outer) {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const x = c.getContext('2d'), gr = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, inner || 'rgba(255,236,190,1)'); gr.addColorStop(0.28, outer || 'rgba(244,214,160,0.42)'); gr.addColorStop(1, 'rgba(244,214,160,0)');
    x.fillStyle = gr; x.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  }

  const EARTH_VERT = `
    varying vec2 vUv; varying vec3 vWN;
    void main() {
      vUv = uv;
      vWN = normalize(mat3(modelMatrix) * normal);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`;
  const EARTH_FRAG = `
    uniform sampler2D dayTex; uniform sampler2D nightTex; uniform vec3 sunDir;
    varying vec2 vUv; varying vec3 vWN;
    void main() {
      vec3 n = normalize(vWN), s = normalize(sunDir);
      float d = dot(n, s);
      float day = smoothstep(-0.14, 0.30, d);
      vec3 dayC = texture2D(dayTex, vUv).rgb;
      vec3 nightC = texture2D(nightTex, vUv).rgb;
      // night side: a faint ghost of the relief so continents stay readable, plus glowing city lights
      vec3 night = dayC * vec3(0.045, 0.075, 0.12) + nightC * vec3(1.3, 0.95, 0.55);
      vec3 lit = dayC * (0.42 + 0.78 * clamp(d, 0.0, 1.0));
      vec3 col = mix(night, lit, day);
      // warm band where day turns to night
      float tw = exp(-pow((d - 0.02) / 0.13, 2.0));
      col += vec3(0.55, 0.27, 0.09) * tw * 0.2;
      // glint on the sea (blueish pixels), strongest toward the sun
      float ocean = clamp((dayC.b - dayC.r - 0.04) * 3.2, 0.0, 1.0);
      vec3 h = normalize(s + vec3(0.0, 0.0, 1.0));
      float spec = pow(max(dot(n, h), 0.0), 70.0) * ocean * day;
      col += vec3(0.75, 0.88, 1.0) * spec * 0.55;
      gl_FragColor = vec4(col, 1.0);
    }`;
  const ATM_VERT = `
    varying vec3 vVN; varying vec3 vWN;
    void main() {
      vVN = normalize(normalMatrix * normal);
      vWN = normalize(mat3(modelMatrix) * normal);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`;
  const ATM_FRAG = `
    uniform float uI; uniform vec3 sunDir; uniform float uMode;
    varying vec3 vVN; varying vec3 vWN;
    void main() {
      float facing = dot(normalize(vWN), normalize(sunDir));
      float sunSide = smoothstep(-0.55, 0.65, facing);
      float tw = exp(-pow(facing / 0.35, 2.0));
      vec3 blue = vec3(0.30, 0.62, 1.0);
      vec3 warm = vec3(1.0, 0.55, 0.26);
      vec3 col = mix(blue, warm, tw * 0.75);
      float rim;
      if (uMode < 0.5) rim = pow(max(0.0, 0.74 - dot(vVN, vec3(0.0, 0.0, 1.0))), 2.5) * 0.9;          // outer halo (back faces)
      else             rim = pow(1.0 - max(dot(vVN, vec3(0.0, 0.0, 1.0)), 0.0), 3.2) * 0.7;          // inner rim (front faces)
      float k = rim * uI * (0.3 + 0.5 * sunSide);
      gl_FragColor = vec4(col, 1.0) * k;
    }`;

  function create(canvas, opts) {
    opts = opts || {};
    const reduceMotion = opts.reduceMotion != null ? opts.reduceMotion : matchMedia('(prefers-reduced-motion: reduce)').matches;
    let renderer;
    try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true }); } catch (e) { return null; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, opts.maxDpr || 1.75));
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 400);
    const camZ = opts.camZ || 5;
    camera.position.set(0, 0, camZ);
    const root = new THREE.Group(); root.position.y = opts.offsetY != null ? opts.offsetY : 0.3; scene.add(root);
    const spin = new THREE.Group(); root.add(spin);

    const loader = new THREE.TextureLoader(); loader.setCrossOrigin('anonymous');
    const maxAniso = renderer.capabilities.getMaxAnisotropy ? renderer.capabilities.getMaxAnisotropy() : 4;
    const tex = url => { const t = loader.load(url); t.anisotropy = Math.min(8, maxAniso); return t; };
    const sphere = r => new THREE.SphereGeometry(r, 128, 96);

    // ---- the planet: day relief, night lights, terminator, glint
    const sunDir = new THREE.Vector3(0.55, 0.34, 0.76).normalize();
    const earthMat = new THREE.ShaderMaterial({
      vertexShader: EARTH_VERT, fragmentShader: EARTH_FRAG,
      uniforms: {
        dayTex: { value: tex(wms('BlueMarble_ShadedRelief_Bathymetry')) },
        nightTex: { value: tex(wms('VIIRS_Black_Marble', '&TIME=2016-01-01')) },
        sunDir: { value: sunDir },
      },
    });
    spin.add(new THREE.Mesh(sphere(1), earthMat));

    // ---- the data layer on top
    const overlay = new THREE.Mesh(sphere(1.004), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.93, depthWrite: false }));
    overlay.visible = false; spin.add(overlay);
    let overlayTex = null;
    function setOverlay(src) {
      if (overlayTex) { overlayTex.dispose(); overlayTex = null; }
      if (!src) { overlay.visible = false; return; }
      if (typeof src === 'string') overlayTex = tex(src);
      else { overlayTex = new THREE.CanvasTexture(src); overlayTex.anisotropy = 4; }
      overlay.material.map = overlayTex; overlay.material.needsUpdate = true; overlay.visible = true;
    }
    function refreshOverlay() { if (overlayTex) overlayTex.needsUpdate = true; }

    // ---- atmosphere: sun-tinted halo outside, rim inside
    const atmUniforms = () => ({ uI: { value: 1 }, sunDir: { value: sunDir }, uMode: { value: 0 } });
    const mkAtm = (r, side, mode) => {
      const u = atmUniforms(); u.uMode.value = mode;
      const m = new THREE.Mesh(sphere(r), new THREE.ShaderMaterial({
        vertexShader: ATM_VERT, fragmentShader: ATM_FRAG, uniforms: u, side, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      }));
      root.add(m); return m;
    };
    const halo = mkAtm(1.14, THREE.BackSide, 0), rim = mkAtm(1.012, THREE.FrontSide, 1);

    // ---- stars: two shells for a little parallax, with varied color and size
    const starShells = [];
    [[1500, 55, 1.15, 0.55], [500, 34, 1.9, 0.8]].forEach(([n, rad, size, op]) => {
      const pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        const r = rad + Math.random() * 18, u = Math.random() * 2 - 1, t = Math.random() * Math.PI * 2, q = Math.sqrt(1 - u * u);
        pos[3 * i] = r * q * Math.cos(t); pos[3 * i + 1] = r * u; pos[3 * i + 2] = r * q * Math.sin(t);
        const warm = Math.random(), b = 0.55 + Math.random() * 0.45;
        col[3 * i] = b * (0.82 + 0.18 * warm); col[3 * i + 1] = b * (0.88 + 0.06 * warm); col[3 * i + 2] = b * (1.0 - 0.18 * warm);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
      const pts = new THREE.Points(g, new THREE.PointsMaterial({ size, sizeAttenuation: false, vertexColors: true, transparent: true, opacity: op, depthWrite: false }));
      scene.add(pts); starShells.push(pts);
    });

    // ---- graticule: lines every 30 degrees; the equator and prime meridian in gold
    let graticule = null;
    function buildGraticule() {
      const grey = [], gold = [];
      const seg = (arr, a, b) => { arr.push(a.x, a.y, a.z, b.x, b.y, b.z); };
      for (let lat = -60; lat <= 60; lat += 30) {
        if (lat === 0) continue;
        for (let lon = -180; lon < 180; lon += 5) seg(grey, ll(lat, lon, 1.0035), ll(lat, lon + 5, 1.0035));
      }
      for (let lon = -150; lon <= 180; lon += 30) {
        if (lon === 0) continue;
        for (let lat = -85; lat < 85; lat += 5) seg(grey, ll(lat, lon, 1.0035), ll(lat + 5, lon, 1.0035));
      }
      for (let lon = -180; lon < 180; lon += 4) seg(gold, ll(0, lon, 1.0045), ll(0, lon + 4, 1.0045));
      for (let lat = -88; lat < 88; lat += 4) seg(gold, ll(lat, 0, 1.0045), ll(lat + 4, 0, 1.0045));
      const mk = (arr, color, op) => {
        const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3));
        return new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color, transparent: true, opacity: op, depthWrite: false }));
      };
      graticule = new THREE.Group(); graticule.add(mk(grey, 0xdfe8e2, 0.13), mk(gold, 0xdcbf8f, 0.75));
      spin.add(graticule);
    }
    function setGraticule(on) { if (on && !graticule) buildGraticule(); if (graticule) graticule.visible = !!on; }

    // ---- window outline (a lat/lon rectangle), a great-circle arc, and markers
    const outlineGeo = new THREE.BufferGeometry();
    const outline = new THREE.LineLoop(outlineGeo, new THREE.LineBasicMaterial({ color: 0xdcbf8f, transparent: true, opacity: 0.9 }));
    outline.visible = false; spin.add(outline);
    function setWindow(lat, lon, half) {
      if (lat == null) { outline.visible = false; return; }
      const pts = [], n = 14;
      for (let i = 0; i < n; i++) pts.push(ll(lat - half, lon - half + 2 * half * i / n, 1.012));
      for (let i = 0; i < n; i++) pts.push(ll(lat - half + 2 * half * i / n, lon + half, 1.012));
      for (let i = 0; i < n; i++) pts.push(ll(lat + half, lon + half - 2 * half * i / n, 1.012));
      for (let i = 0; i < n; i++) pts.push(ll(lat + half - 2 * half * i / n, lon - half, 1.012));
      outlineGeo.setFromPoints(pts); outline.visible = true;
    }

    const arcGeo = new THREE.BufferGeometry();
    const arc = new THREE.Line(arcGeo, new THREE.LineDashedMaterial({ color: 0xffc060, dashSize: 0.025, gapSize: 0.02, transparent: true, opacity: 0.85 }));
    arc.visible = false; spin.add(arc);
    let arcKey = '';
    function setArc(a, b) {
      if (!a || !b) { arc.visible = false; arcKey = ''; return; }
      const key = [a.lat, a.lon, b.lat, b.lon].map(v => v.toFixed(2)).join();
      if (key === arcKey) return;
      arcKey = key;
      const A = ll(a.lat, a.lon, 1), B = ll(b.lat, b.lon, 1);
      const ang = Math.acos(Math.max(-1, Math.min(1, A.dot(B))));
      const pts = [], N = 72;
      for (let i = 0; i <= N; i++) {
        const t = i / N;
        const v = ang < 1e-4 ? A.clone() : A.clone().multiplyScalar(Math.sin((1 - t) * ang)).add(B.clone().multiplyScalar(Math.sin(t * ang))).multiplyScalar(1 / Math.sin(ang));
        pts.push(v.normalize().multiplyScalar(1.012 + 0.16 * (ang / Math.PI) * Math.sin(Math.PI * t)));
      }
      arcGeo.setFromPoints(pts); arc.computeLineDistances(); arc.visible = true;
    }

    const glowTex = glowTexture();
    const markers = {};
    function addMarker(id, o) {
      o = o || {};
      const color = new THREE.Color(o.color != null ? o.color : 0xffb03c), size = o.size || 1;
      const g = new THREE.Group();
      const core = new THREE.Mesh(new THREE.SphereGeometry(0.014 * size, 20, 20), new THREE.MeshBasicMaterial({ color: o.core != null ? o.core : 0xfff0c8 }));
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
      halo.scale.set(0.2 * size, 0.2 * size, 1);
      g.add(core, halo);
      const rings = [];
      if (o.rings !== false) for (let i = 0; i < 2; i++) {
        const r = new THREE.Mesh(new THREE.RingGeometry(0.028 * size, 0.032 * size, 48), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
        g.add(r); rings.push(r);
      }
      let beam = null;
      if (o.beam) {
        const cg = new THREE.CylinderGeometry(0.0015, 0.007 * size, 0.3, 10, 1, true); cg.rotateX(Math.PI / 2); cg.translate(0, 0, 0.15);
        beam = new THREE.Mesh(cg, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
        g.add(beam);
      }
      g.visible = false; spin.add(g);
      markers[id] = { g, halo, rings, beam, size, color };
    }
    function setMarker(id, lat, lon) {
      const m = markers[id]; if (!m) return;
      if (lat == null) { m.g.visible = false; return; }
      const p = ll(lat, lon, 1.012); m.g.position.copy(p); m.g.lookAt(p.clone().multiplyScalar(2)); m.g.visible = true;
    }
    function setMarkerColor(id, hex) { const m = markers[id]; if (!m) return; m.color.set(hex); m.halo.material.color.set(hex); m.rings.forEach(r => r.material.color.set(hex)); if (m.beam) m.beam.material.color.set(hex); }

    // ---- camera behaviour: ease to a focus point, drag to look around, wheel to zoom, fly in on load
    const st = {
      rotY: -1.2, rotX: 0.2, tgtY: -1.2, tgtX: 0.2, dragging: false, lastDrag: -1e9, glow: 1, glowTarget: 1,
      zoom: camZ, zoomTarget: camZ, t0: performance.now(), wobble: opts.wobble != null ? opts.wobble : 0.12,
    };
    function focus(lat, lon, tilt) {
      let ty = -Math.PI / 2 - lon * Math.PI / 180;
      ty += Math.PI * 2 * Math.round((st.rotY - ty) / (Math.PI * 2));   // take the short way round
      st.tgtY = ty; st.tgtX = lat * Math.PI / 180 * (tilt != null ? tilt : 0.55);
    }
    function snapTo(lat, lon) { focus(lat, lon); st.rotY = st.tgtY; st.rotX = st.tgtX; }

    if (opts.interactive) {
      canvas.addEventListener('pointerdown', e => { if (opts.touchSteers && e.pointerType === 'touch') return; st.dragging = true; try { canvas.setPointerCapture(e.pointerId); } catch (err) {} });
      canvas.addEventListener('pointermove', e => {
        if (!st.dragging) return;
        st.rotY += e.movementX * 0.006; st.rotX = Math.max(-1.1, Math.min(1.1, st.rotX + e.movementY * 0.004)); st.lastDrag = performance.now();
      });
      const up = () => { st.dragging = false; st.lastDrag = performance.now(); };
      canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
      canvas.addEventListener('wheel', e => {
        if (!opts.zoomable) return;
        e.preventDefault(); st.zoomTarget = Math.max(3.1, Math.min(8, st.zoomTarget * (1 + Math.sign(e.deltaY) * 0.08)));
      }, { passive: false });
    }

    function render(now) {
      const w = canvas.clientWidth, h = canvas.clientHeight;
      if (!w || !h) return;
      const pr = renderer.getPixelRatio();
      if (canvas.width !== Math.round(w * pr) || canvas.height !== Math.round(h * pr)) {
        renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
      }
      // fly-in
      const it = reduceMotion ? 1 : Math.min(1, (now - st.t0) / 2600), ease = 1 - Math.pow(1 - it, 3);
      st.zoom += (st.zoomTarget - st.zoom) * (reduceMotion ? 1 : 0.1);
      camera.position.z = st.zoom + (1 - ease) * 5.5;

      if (!st.dragging && now - st.lastDrag > 3500) {
        const k = reduceMotion ? 1 : (opts.follow || 0.03);
        st.rotY += (st.tgtY + (reduceMotion ? 0 : Math.sin(now / 5200) * st.wobble) - st.rotY) * k;
        st.rotX += (st.tgtX - st.rotX) * k;
      }
      spin.rotation.y = st.rotY + (1 - ease) * 1.4; root.rotation.x = st.rotX;
      starShells[0].rotation.y = now * 0.000008; starShells[1].rotation.y = -now * 0.000014;
      st.glow += (st.glowTarget - st.glow) * 0.06;
      halo.material.uniforms.uI.value = st.glow; rim.material.uniforms.uI.value = st.glow * 0.9;

      const tt = now / 1000;
      for (const id in markers) {
        const m = markers[id]; if (!m.g.visible) continue;
        const pulse = 1 + 0.22 * Math.sin(tt * 4.2);
        m.halo.scale.set(0.2 * m.size * pulse, 0.2 * m.size * pulse, 1);
        m.rings.forEach((r, i) => { const ph = reduceMotion ? 0.4 : ((tt / 2.2) + i / 2) % 1; r.scale.setScalar(1 + ph * 3.2); r.material.opacity = 0.55 * (1 - ph); });
        if (m.beam) m.beam.material.opacity = 0.22 + 0.1 * Math.sin(tt * 2.6);
      }
      renderer.render(scene, camera);
    }

    return {
      renderer, scene, camera, setOverlay, refreshOverlay, setGraticule, setWindow, setArc, addMarker, setMarker, setMarkerColor,
      focus, snapTo, render, setGlow: v => { st.glowTarget = v; }, isDragging: () => st.dragging, ll,
      setOverlayOpacity: v => { overlay.material.opacity = v; },
    };
  }

  window.EarthGL = { create, ll };
})();
