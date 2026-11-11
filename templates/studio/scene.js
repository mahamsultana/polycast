// PolyCast "studio" template: a host + a floating AI orb in a warm low-poly podcast studio.
// Landscape 1920x1080. Edit the CONFIG block; everything below it is the engine for this set.
//
// Timing: every cue is [lineId, word?]. The cue fires when that word of that line is spoken,
// so the video stays in sync if you regenerate the voices.
export const RES = [1280, 720, 1920, 1080];          // render size, output size. Vertical: [720, 1280, 1080, 1920]

export const CONFIG = {
  // --- look
  host: { skin: 0xd9a77f, shirt: 0x2f8f83, hair: 0x2a1c14, hairStyle: 'swoop', pants: 0x2a2f4a },   // hairStyle: swoop | cap | long
  orbColor: 0xe0703f,
  neon: 'POLYCAST',
  note: ['SCRIPT', '.JSON'],                 // sticky note on the desk
  piggy: ['VOICE BILL', '$0.00'],            // label on the piggy bank
  // --- topic card (top-left), with an optional sticker that pops in on a cue
  topic: { title: 'POLYCAST', pill: 'TEXT → VIDEO', sticker: { text: '*free', at: ['o05'] } },
  // --- camera: [cue, shot]. Shots: two, wide, hostClose, orbClose, monL, monR
  camera: [
    [['o01'], 'two'], [['h01'], 'hostClose'], [['o02'], 'orbClose'], [['h02'], 'monL'], [['o03'], 'orbClose'],
    [['h03'], 'two'], [['o04'], 'orbClose'], [['h04'], 'monR'], [['o05'], 'orbClose'], [['h05'], 'monL'],
    [['o06'], 'orbClose'], [['h06'], 'wide'],
  ],
  // --- wall monitors: [cue, leftScreen, rightScreen]
  // Screens: chart | json | render | voices | skill | img:<file in img/> (real screenshots, e.g. img:app.png)
  monitors: [
    [['o01'], 'chart', 'chart'], [['h01', 'JSON'], 'json', 'chart'], [['h02'], 'render', 'chart'],
    [['h04'], 'render', 'voices'], [['h05'], 'skill', 'voices'], [['h06'], 'skill', 'chart'],
  ],
  // --- orb expressions + host head turns: [fromCue, toCue, { orb, hostTurn, hostLook, orbTurn, wave }]
  // orb: normal | smug | side | flat | happy | shock | loading | dots.  hostTurn: 0 = camera, 0.5 = toward the orb
  acting: [
    [['o01'], ['h01'], { orb: 'side', hostTurn: 0.5 }],
    [['h01'], ['o02'], { orb: 'dots', hostTurn: 0.05, wave: true }],
    [['o02'], ['h02'], { orb: 'smug' }],
    [['o03'], ['h03'], { orb: 'flat', hostTurn: 0.55 }],
    [['h03', 'talent'], ['o04'], { orb: 'happy' }],
    [['o04'], ['h04'], { orb: 'side' }],
    [['o05'], ['h05'], { orb: 'shock', orbTurn: 0 }],
    [['o06'], ['h06'], { orb: 'smug' }],
    [['h06', 'Especially'], ['h06', 'free'], { orb: 'happy', hostTurn: 0.5 }],
    [['h06', 'free'], null, { orb: 'happy', hostTurn: 0, wave: true }],
  ],
  // --- pop-in stat cards (right side): [cue, untilCue, big, small, color]
  cards: [
    [['h01', 'JSON'], ['o02'], '1 JSON → 1 MP4', 'the whole video', '#7fd8ff'],
    [['h02'], ['o03'], 'THREE.JS', 'rendered frame by frame', '#f5c542'],
    [['h03', 'mouth'], ['o04'], 'LIP-SYNC', 'to the real audio', '#5cc98a'],
    [['h04', 'free'], ['o05', "I'm"], '$0 VOICES', 'free system TTS', '#5cc98a'],
    [['h05'], ['o06'], 'CLAUDE SKILL', 'describe it, get a video', '#ff9a3c'],
  ],
  captionHighlights: ['json', 'three.js', 'frame', 'voice', 'mouth', 'audio', 'cartesia', 'free', 'claude', 'skill', 'polycast', 'open', 'source', 'jokes'],
  // --- contact card (top-center) and end card
  contact: { at: ['h06', 'free'], until: null, big: '★ PolyCast', small: 'free & open source · make your own' },
  end: { title: 'PolyCast', sub: 'write a script · get a low-poly video', pill: 'free & open source' },
};

// =====================================================================================================
export async function setup(L, app, tl, env) {
  const C = CONFIG;
  const { THREE, M, MB, box, mesh, limb, setLimb, clamp, prog, ease, eout, lerp } = L;
  const FPS = 30, W = app.W, H = app.H;
  L.SNAP.value.set(4000, 4000);                     // clean low-poly (no PS1 vertex wobble)
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const Ln = Object.fromEntries(tl.lines.map(l => [l.id, l]));
  const at = (id, word) => { const l = Ln[id]; if (!l) return Infinity; if (!word) return l.start; const i = Math.max(0, l.text.toLowerCase().indexOf(word.toLowerCase())); return l.start + (l.end - l.start) * i / l.text.length; };
  const cue = (c) => c ? at(c[0], c[1]) : Infinity;
  const back = (x) => { x = clamp(x); const c1 = 1.9, c3 = c1 + 1; return 1 + c3 * (x - 1) ** 3 + c1 * (x - 1) ** 2; };
  const HOST = Object.keys(env).find(k => /host|m$/.test(k)) || 'host', ORB = Object.keys(env).find(k => /orb|c$/.test(k)) || 'orb';
  const renderer = app.renderer;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.1;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x15110f);
  const canvasTex = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return { c, x: c.getContext('2d'), t }; };
  const SM = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.75, metalness: 0.05, flatShading: true, ...o });

  // ---------------------------------------------------------------- studio set
  box(8, 0.05, 6, SM(0x2a211c), 0, -0.025, -0.4, scene);
  box(8, 3.6, 0.1, SM(0x3a3330), 0, 1.8, -1.7, scene);
  for (let i = 0; i < 22; i++) box(0.055, 3.4, 0.07, SM(0xc98a4e, { roughness: 0.6 }), -0.95 + i * 0.09, 1.7, -1.6, scene);
  box(2.1, 3.4, 0.02, SM(0x1f1814), 0, 1.7, -1.65, scene);
  const neon = canvasTex(1024, 256);
  { const x = neon.x; x.font = '900 150px "Segoe UI", "Helvetica Neue", Arial'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.lineJoin = 'round'; x.shadowColor = '#ffd7b0'; x.shadowBlur = 30; x.strokeStyle = '#fff3e6'; x.lineWidth = 9;
    const tw = x.measureText(C.neon).width; if (tw > 960) x.font = `900 ${Math.floor(150 * 960 / tw)}px "Segoe UI", Arial`;
    x.strokeText(C.neon, 512, 132); x.shadowBlur = 60; x.strokeText(C.neon, 512, 132); neon.t.needsUpdate = true; }
  const neonM = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.375), new THREE.MeshBasicMaterial({ map: neon.t, transparent: true, toneMapped: false }));
  neonM.position.set(0, 2.42, -1.55); scene.add(neonM);
  const neonL = new THREE.PointLight(0xffe2c4, 1.2, 2.5, 1.5); neonL.position.set(0, 2.4, -1.2); scene.add(neonL);
  const monTex = [canvasTex(1024, 576), canvasTex(1024, 576)];
  const monPos = [V(-1.62, 1.62, -1.6), V(1.62, 1.62, -1.6)];
  monPos.forEach((p, i) => {
    box(1.02, 0.6, 0.05, SM(0x0d0d10), p.x, p.y, p.z, scene);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.96, 0.54), new THREE.MeshBasicMaterial({ map: monTex[i].t, toneMapped: false }));
    m.position.set(p.x, p.y, p.z + 0.03); scene.add(m);
    const gl_ = new THREE.PointLight(0x7fd8ff, 0.6, 1.8, 1.5); gl_.position.set(p.x, p.y, p.z + 0.5); scene.add(gl_);
  });
  box(0.9, 0.04, 0.25, SM(0x6b4a34), 1.62, 2.35, -1.55, scene);
  box(0.12, 0.16, 0.1, SM(0xd6d2cc), 1.4, 2.45, -1.55, scene); box(0.1, 0.1, 0.09, SM(0xd6d2cc), 1.4, 2.58, -1.55, scene);
  mesh(new THREE.SphereGeometry(0.02, 6, 4), MB(0x7fd8ff), 1.38, 2.59, -1.5, scene);
  mesh(new THREE.CylinderGeometry(0.07, 0.055, 0.12, 7), SM(0xc0674a), 1.85, 2.43, -1.55, scene);
  for (let i = 0; i < 5; i++) { const lf = mesh(new THREE.ConeGeometry(0.035, 0.22, 4), SM(0x3f9b63), 1.85, 2.56, -1.55, scene); lf.rotation.set(Math.sin(i * 2.1) * 0.6, i, Math.cos(i * 1.7) * 0.6); }
  for (const x of [-2.6, 2.6]) for (const y of [1.0, 1.7]) box(0.5, 0.5, 0.06, SM(0x4a2f2a), x, y, -1.62, scene);
  // desk
  box(3.0, 0.07, 0.8, SM(0x2b2725, { roughness: 0.5 }), 0, 0.74, 0.1, scene);
  box(3.0, 0.62, 0.05, SM(0x221e1c), 0, 0.42, 0.5, scene);
  const led = box(3.0, 0.025, 0.02, MB(0xff9a3c), 0, 0.7, 0.53, scene); led.material.toneMapped = false;
  const ledL = new THREE.PointLight(0xff8a30, 0.8, 2.0, 1.2); ledL.position.set(0, 0.6, 0.9); scene.add(ledL);
  box(0.5, 0.025, 0.16, SM(0x1d1d22), -0.75, 0.79, 0.22, scene);
  for (let i = 0; i < 12; i++) for (let r = 0; r < 3; r++) box(0.032, 0.012, 0.035, SM(i % 5 === 0 ? 0xff9a3c : 0xe8e2d8), -0.98 + i * 0.04, 0.808, 0.17 + r * 0.045, scene);
  const note = canvasTex(256, 256);
  { const x = note.x; x.fillStyle = '#ffe9a8'; x.fillRect(0, 0, 256, 256); x.fillStyle = '#3a2a20'; x.font = 'italic bold 44px "Segoe Print", "Comic Sans MS", cursive'; x.textAlign = 'center';
    C.note.forEach((s, i) => x.fillText(s, 128, 110 + i * 64 - (C.note.length - 2) * 30)); note.t.needsUpdate = true; }
  const noteM = new THREE.Mesh(new THREE.PlaneGeometry(0.13, 0.13), new THREE.MeshStandardMaterial({ map: note.t, roughness: 0.9 }));
  noteM.position.set(-0.05, 0.86, 0.32); noteM.rotation.set(-0.25, 0.1, 0.05); scene.add(noteM);
  box(0.02, 0.1, 0.02, SM(0x6b4a34), -0.05, 0.8, 0.3, scene);
  const pig = new THREE.Group(); pig.position.set(0.95, 0.86, 0.22); pig.rotation.y = -0.5; scene.add(pig);
  const pinkM = SM(0xf0c4b6);
  const pb = mesh(new THREE.IcosahedronGeometry(0.11, 1), pinkM, 0, 0, 0, pig); pb.scale.set(1.25, 0.9, 0.9);
  mesh(new THREE.CylinderGeometry(0.035, 0.04, 0.04, 7), pinkM, 0.14, 0.0, 0, pig).rotation.z = Math.PI / 2;
  for (const [x, z] of [[-0.07, -0.05], [0.07, -0.05], [-0.07, 0.05], [0.07, 0.05]]) mesh(new THREE.CylinderGeometry(0.018, 0.02, 0.06, 5), pinkM, x, -0.09, z, pig);
  for (const z of [-0.04, 0.04]) mesh(new THREE.ConeGeometry(0.025, 0.04, 4), pinkM, 0.1, 0.08, z, pig);
  const lab = canvasTex(256, 128);
  { const x = lab.x; x.fillStyle = '#f6f1ea'; x.fillRect(0, 0, 256, 128); x.fillStyle = '#222'; x.font = 'italic bold 36px "Segoe Print", cursive'; x.textAlign = 'center'; x.fillText(C.piggy[0], 128, 55); x.fillStyle = '#c0392b'; x.font = 'bold 34px "Segoe UI", Arial'; x.fillText(C.piggy[1] || '', 128, 100); lab.t.needsUpdate = true; }
  const labM = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.08), new THREE.MeshStandardMaterial({ map: lab.t })); labM.position.set(0, 0.0, 0.1); pig.add(labM);
  mesh(new THREE.CylinderGeometry(0.045, 0.04, 0.1, 8), SM(0xe8e2d8), -0.38, 0.83, 0.3, scene);
  function mic(base, head) {
    const m = SM(0x1b1b1e, { metalness: 0.4, roughness: 0.4 });
    const a = limb(0.012, 0.012, m, scene), b = limb(0.012, 0.012, m, scene);
    const elbow = V(base.x * 0.65 + head.x * 0.35, head.y + 0.1, base.z - 0.08);
    setLimb(a, base, elbow); setLimb(b, elbow, head);
    mesh(new THREE.CylinderGeometry(0.035, 0.03, 0.16, 8), SM(0x2a2a2e, { metalness: 0.5, roughness: 0.35 }), head.x, head.y - 0.08, head.z, scene);
    const pf = mesh(new THREE.TorusGeometry(0.07, 0.006, 4, 16), m, head.x + (head.x < 0 ? 0.04 : -0.04), head.y - 0.06, head.z - 0.09, scene); pf.rotation.y = 0.2;
  }
  mic(V(-1.0, 0.78, 0.0), V(-0.24, 1.02, 0.02));          // keep mic heads below chin level so faces stay clear
  mic(V(1.05, 0.78, 0.0), V(0.62, 1.02, -0.05));
  box(0.5, 0.06, 0.45, SM(0x2a2a30), -0.45, 0.46, -0.42, scene); box(0.52, 0.7, 0.07, SM(0x2a2a30), -0.45, 0.9, -0.7, scene);

  // ---------------------------------------------------------------- host
  const host = L.makePerson({ ...C.host, brow: C.host.hair, jaw: 0.45, legs: true, eyes: 'cartoon' });
  host.root.position.set(-0.45, 0.0, -0.4); scene.add(host.root);
  for (const s of [-1, 1]) host.setLeg(s, V(s * 0.1, 0.1, 0.36), V(s * 0.05, 0.9, 1));

  // ---------------------------------------------------------------- orb
  const orb = (() => {
    const g = new THREE.Group(); g.position.set(0.45, 1.24, -0.32); scene.add(g);
    const tilt = new THREE.Group(); g.add(tilt);
    const og = new THREE.IcosahedronGeometry(0.24, 2); const op = og.attributes.position;
    for (let i = 0; i < op.count; i++) if (op.getZ(i) > 0.14) op.setZ(i, 0.14);           // flat visor front for the face
    og.computeVertexNormals(); mesh(og, SM(C.orbColor, { roughness: 0.55 }), 0, 0, 0, tilt);
    const dark = new THREE.Color(C.orbColor).multiplyScalar(0.8).getHex();
    mesh(new THREE.TorusGeometry(0.175, 0.016, 6, 32), SM(dark), 0, 0, 0.145, tilt);
    const face = canvasTex(256, 256);
    const faceM = new THREE.Mesh(new THREE.CircleGeometry(0.165, 32), new THREE.MeshBasicMaterial({ map: face.t, toneMapped: false }));
    faceM.position.set(0, 0, 0.143); tilt.add(faceM);
    for (const s of [-1, 1]) { const e = mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.06, 8), SM(dark), s * 0.235, 0, 0, tilt); e.rotation.z = Math.PI / 2; }
    const ant = limb(0.006, 0.006, SM(0x1b1b1e), tilt); setLimb(ant, V(0, 0.23, 0), V(0, 0.33, 0));
    const bulb = mesh(new THREE.SphereGeometry(0.022, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffd84a, toneMapped: false }), 0, 0.34, 0, tilt);
    const ring = mesh(new THREE.TorusGeometry(0.36, 0.004, 4, 64), new THREE.MeshBasicMaterial({ color: 0xffe0c8, transparent: true, opacity: 0.6, toneMapped: false }), 0, 0, 0, g);
    const glow = new THREE.PointLight(0xffa06a, 0.7, 1.4, 1.5); glow.position.set(0, 0, 0.45); g.add(glow);
    return { g, tilt, face, ring, bulb };
  })();
  function drawFace(expr, mouth, t, blink) {
    const x = orb.face.x; x.fillStyle = '#0d0b0b'; x.fillRect(0, 0, 256, 256);
    x.fillStyle = '#fff1dc'; x.strokeStyle = '#fff1dc'; x.lineWidth = 10; x.lineCap = 'round'; x.shadowColor = '#ffb27a'; x.shadowBlur = 14;
    const eye = (cx, cy, ew, eh) => { x.beginPath(); x.roundRect(cx - ew / 2, cy - eh / 2, ew, eh, Math.min(ew, eh) / 2); x.fill(); };
    const E = 104;
    if (expr === 'side') { eye(80, E, 26, 22); eye(150, E, 26, 22); x.fillStyle = '#0d0b0b'; x.fillRect(60, E - 30, 120, 18); x.fillStyle = '#fff1dc'; x.beginPath(); x.moveTo(130, 70); x.lineTo(176, 62); x.stroke(); }
    else if (expr === 'dots') { for (let i = 0; i < 3; i++) if ((t * 3) % 3 > i) { x.beginPath(); x.arc(92 + i * 36, 120, 10, 0, 7); x.fill(); } }
    else if (expr === 'smug') { x.beginPath(); x.arc(92, 112, 20, Math.PI * 1.1, Math.PI * 1.9); x.stroke(); x.beginPath(); x.arc(164, 112, 20, Math.PI * 1.1, Math.PI * 1.9); x.stroke(); }
    else if (expr === 'shock') { x.beginPath(); x.arc(92, E, 26, 0, 7); x.fill(); x.beginPath(); x.arc(164, E, 26, 0, 7); x.fill(); x.fillStyle = '#0d0b0b'; x.beginPath(); x.arc(92, E, 9, 0, 7); x.fill(); x.beginPath(); x.arc(164, E, 9, 0, 7); x.fill(); x.fillStyle = '#fff1dc'; }
    else if (expr === 'happy') { x.beginPath(); x.moveTo(72, 116); x.lineTo(92, 92); x.lineTo(112, 116); x.stroke(); x.beginPath(); x.moveTo(144, 116); x.lineTo(164, 92); x.lineTo(184, 116); x.stroke(); }
    else if (expr === 'flat') { eye(92, E + 6, 34, 12); eye(164, E + 6, 34, 12); }
    else if (expr === 'loading') { x.beginPath(); x.arc(128, 120, 34, t * 6, t * 6 + 4.2); x.stroke(); }
    else { eye(92, E, 22, blink ? 4 : 44); eye(164, E, 22, blink ? 4 : 44); }
    if (expr !== 'loading' && expr !== 'dots') { const mw = 30 + mouth * 14, mh = 6 + mouth * 22; x.beginPath(); x.roundRect(128 - mw / 2, 168 - mh / 2, mw, mh, mh / 2); x.fill(); }
    x.shadowBlur = 0; orb.face.t.needsUpdate = true;
  }

  // ---------------------------------------------------------------- lights
  scene.add(new THREE.HemisphereLight(0x6a5a50, 0x1a1210, 0.7));
  const key = new THREE.SpotLight(0xffd2a8, 26, 9, 0.6, 0.6, 1.5); key.position.set(-1.6, 3.2, 2.4); key.target.position.set(0, 1.0, -0.4);
  key.castShadow = true; key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -0.0004; key.shadow.radius = 4; scene.add(key, key.target);
  const wash = new THREE.SpotLight(0xffb070, 18, 5, 0.55, 0.8, 1.5); wash.position.set(0, 3.4, -0.6); wash.target.position.set(0, 1.4, -1.6); scene.add(wash, wash.target);
  const fill = new THREE.PointLight(0x8fb4ff, 0.6, 6, 1.2); fill.position.set(2.2, 1.6, 1.8); scene.add(fill);
  scene.traverse(o => { if (o.isMesh && !(o.material && o.material.isMeshBasicMaterial)) { o.castShadow = true; o.receiveShadow = true; } });

  // ---------------------------------------------------------------- monitor screens
  const CREAM = '#f3ead3', YEL = '#f5c542', GRN = '#5cc98a', ORANGE = '#ff9a3c', CYAN = '#7fd8ff';
  const imgs = {};
  for (const m of C.monitors) for (const s of [m[1], m[2]]) if (s && s.startsWith('img:') && !imgs[s]) {
    imgs[s] = await new Promise(res => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = new URL('./img/' + s.slice(4), import.meta.url).href; });
  }
  function rr(x, X, Y, w, h, r, fill) { x.beginPath(); x.roundRect(X, Y, w, h, r); x.fillStyle = fill; x.fill(); }
  function drawMon(tex, mode, lt, t) {
    const x = tex.x, w = 1024, h = 576;
    const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#0f1a22'); g.addColorStop(1, '#081016'); x.fillStyle = g; x.fillRect(0, 0, w, h);
    x.textBaseline = 'middle'; x.textAlign = 'left';
    const mono = '32px Consolas, "SF Mono", Menlo, monospace';
    if (mode.startsWith('img:')) {
      const im = imgs[mode];
      if (im) { const z = 1 + 0.06 * Math.min(1, lt / 6), sc = Math.max(w / im.width, h / im.height) * z, dw = im.width * sc, dh = im.height * sc;
        x.drawImage(im, (w - dw) * (0.2 + 0.6 * Math.min(1, lt / 6)), (h - dh) * 0.15, dw, dh); }
      else { x.fillStyle = CREAM; x.font = '40px "Segoe UI"'; x.fillText('missing ' + mode, 40, 280); }
    } else if (mode === 'json') {
      const L1 = ['{', '  "who": "orb",', '  "text": "So you think a text file', '           can make a whole video?",', '  "after": 0.25', '},', '{ "who": "host", ...'];
      x.font = mono; L1.forEach((s, i) => { const k = Math.floor(Math.max(0, lt * 38 - i * 18)); x.fillStyle = i === 1 ? ORANGE : i < 4 && i > 1 ? GRN : CREAM; x.fillText(s.slice(0, k), 50, 70 + i * 62); });
      x.fillStyle = '#7fa8b8'; x.font = 'bold 26px "Segoe UI"'; x.fillText('lines.json', 50, 530);
    } else if (mode === 'render') {
      const f = Math.floor(lt * 61) % 1650;
      x.fillStyle = CREAM; x.font = 'bold 44px "Segoe UI"'; x.fillText('Rendering…', 50, 70);
      x.font = mono; x.fillStyle = CYAN; x.fillText(`frame ${String(f).padStart(4, ' ')} / 1650`, 50, 150);
      rr(x, 50, 200, 924, 36, 18, '#13303d'); rr(x, 50, 200, 924 * f / 1650, 36, 18, ORANGE);
      for (let i = 0; i < 6; i++) { rr(x, 50 + i * 156, 290, 140, 200, 10, '#13303d'); x.fillStyle = ['#c98a4e', '#e0703f', '#2f8f83', '#f5c542', '#7fd8ff', '#5cc98a'][(i + Math.floor(lt * 4)) % 6]; x.fillRect(66 + i * 156, 306, 108, 168); }
    } else if (mode === 'voices') {
      x.fillStyle = CREAM; x.font = 'bold 44px "Segoe UI"'; x.fillText('Voices', 50, 70);
      const chips = [['Cartesia', 'studio'], ['System TTS', 'free']];
      chips.forEach(([a, b], i) => { rr(x, 50 + i * 330, 120, 300, 64, 32, i ? GRN : '#1f3a4a'); x.fillStyle = i ? '#081016' : CREAM; x.font = 'bold 28px "Segoe UI"'; x.fillText(`${a} · ${b}`, 80 + i * 330, 153); });
      for (let r = 0; r < 2; r++) for (let i = 0; i < 40; i++) { const hh = 8 + 80 * Math.abs(Math.sin(t * (7 + r * 3) + i * 0.6)) * (0.3 + 0.7 * Math.abs(Math.sin(t * 1.5 + i * 0.2 + r))); rr(x, 50 + i * 23, 300 + r * 140 - hh / 2, 12, hh, 6, r ? ORANGE : CYAN); }
    } else if (mode === 'skill') {
      const L1 = [['> make a polycast video about my bakery', CREAM], ['● writing script (12 lines)…', '#7fa8b8'], ['● generating voices…  ✓', GRN], ['● directing scene…    ✓', GRN], ['● rendering 1650 frames…', YEL], ['✓ bakery-reel.mp4', ORANGE]];
      x.font = mono; L1.forEach(([s, c], i) => { if (lt < i * 0.8) return; x.fillStyle = c; x.fillText(i === 0 ? s.slice(0, Math.floor(lt * 30)) : s, 50, 70 + i * 74); });
    } else {
      x.fillStyle = CYAN; x.font = 'bold 26px "Segoe UI"'; x.fillText('STUDIO METRICS', 40, 44);
      for (let k = 0; k < 3; k++) { x.strokeStyle = [CYAN, GRN, YEL][k]; x.lineWidth = 6; x.beginPath();
        for (let i = 0; i <= 40; i++) { const X = 40 + i * 24, Y = 330 - k * 40 - 90 * Math.sin(i * 0.35 + t * 1.2 + k) * (0.5 + 0.5 * Math.sin(i * 0.13 + k)); i ? x.lineTo(X, Y) : x.moveTo(X, Y); } x.stroke(); }
    }
    tex.t.needsUpdate = true;
  }

  // ---------------------------------------------------------------- camera
  const cam = new THREE.PerspectiveCamera(34, RES[2] / RES[3], 0.05, 40);
  const SHOTS = {
    wide: [V(0, 1.38, 3.0), V(0, 1.25, -0.4), 34],
    two: [V(0, 1.32, 2.0), V(0, 1.22, -0.35), 34],
    hostClose: [V(-0.18, 1.3, 0.95), V(-0.45, 1.24, -0.38), 30],
    orbClose: [V(0.2, 1.3, 0.95), V(0.45, 1.24, -0.32), 30],
    monL: [V(-1.2, 1.6, 0.35), V(-1.62, 1.62, -1.6), 28],
    monR: [V(1.2, 1.6, 0.35), V(1.62, 1.62, -1.6), 28],
  };
  const KEYS = C.camera.map(([c, s]) => [Math.max(0, cue(c) - 0.12), s]).sort((a, b) => a[0] - b[0]);
  const keyAt = (t) => { let k = 0; for (let i = 0; i < KEYS.length; i++) if (t >= KEYS[i][0]) k = i; return k; };
  function camAt(t) {
    const k = keyAt(t), cur = SHOTS[KEYS[k][1]], prev = k > 0 ? SHOTS[KEYS[k - 1][1]] : cur;
    const u = ease(prog(t, KEYS[k][0], KEYS[k][0] + 0.5));
    const p = prev[0].clone().lerp(cur[0], u), l = prev[1].clone().lerp(cur[1], u);
    p.x += Math.sin(t * 0.45) * 0.025; p.y += Math.sin(t * 0.31) * 0.012;
    return [p, l, lerp(prev[2], cur[2], u)];
  }
  const MON = C.monitors.map(([c, a, b]) => [Math.max(0, cue(c) - 0.4), a, b]).sort((a, b) => a[0] - b[0]);
  const composer = new (await import('three/addons/postprocessing/EffectComposer.js')).EffectComposer(renderer);
  composer.setPixelRatio(1); composer.setSize(app.LW, app.LH);
  composer.addPass(new (await import('three/addons/postprocessing/RenderPass.js')).RenderPass(scene, cam));
  const bokeh = new (await import('three/addons/postprocessing/BokehPass.js')).BokehPass(scene, cam, { focus: 2.0, aperture: 0.006, maxblur: 0.008 });
  composer.addPass(bokeh); composer.addPass(new (await import('three/addons/postprocessing/OutputPass.js')).OutputPass());

  // ---------------------------------------------------------------- 2D overlays
  const ctx = app.ctx;
  const S = W / 1920;                                  // overlay scale (works for vertical too)
  function topicCard(t) {
    const k = eout(prog(t, 0.0, 0.35)) * (1 - prog(t, cue(C.contact.at) - 0.4, cue(C.contact.at))); if (k <= 0) return;
    ctx.save(); ctx.translate(60 * S, 60 * S); ctx.scale(S * (0.9 + 0.1 * k), S * (0.9 + 0.1 * k)); ctx.globalAlpha = k;
    ctx.font = '900 84px "Segoe UI", Arial'; const tw = Math.max(400, ctx.measureText(C.topic.title).width + 80);
    ctx.fillStyle = 'rgba(14,12,12,0.9)'; ctx.beginPath(); ctx.roundRect(0, 0, tw, 230, 22); ctx.fill();
    ctx.strokeStyle = ORANGE; ctx.lineWidth = 6; ctx.lineCap = 'round';
    for (const [cx, cy, dx, dy] of [[14, 14, 1, 1], [tw - 14, 14, -1, 1], [14, 216, 1, -1], [tw - 14, 216, -1, -1]]) { ctx.beginPath(); ctx.moveTo(cx, cy + dy * 34); ctx.lineTo(cx, cy); ctx.lineTo(cx + dx * 34, cy); ctx.stroke(); }
    ctx.fillStyle = '#fff'; ctx.textBaseline = 'middle'; ctx.textAlign = 'left'; ctx.fillText(C.topic.title, 40, 88);
    ctx.font = '900 38px "Segoe UI", Arial'; const pw = ctx.measureText(C.topic.pill).width + 44;
    ctx.fillStyle = ORANGE; ctx.beginPath(); ctx.roundRect(40, 140, pw, 64, 18); ctx.fill();
    ctx.fillStyle = '#1a0e06'; ctx.fillText(C.topic.pill, 62, 173);
    const st = C.topic.sticker; const ks = st ? back(prog(t, cue(st.at), cue(st.at) + 0.3)) : 0;
    if (ks > 0) { ctx.save(); ctx.translate(40 + pw + 20, 196); ctx.rotate(-0.12); ctx.scale(ks * 1.4, ks * 1.4);
      ctx.font = 'italic 800 30px "Segoe UI"'; const sw = ctx.measureText(st.text).width + 28;
      ctx.fillStyle = '#e0703f'; ctx.beginPath(); ctx.roundRect(-10, -26, sw, 52, 12); ctx.fill(); ctx.fillStyle = '#fff'; ctx.fillText(st.text, 4, 1); ctx.restore(); }
    ctx.restore();
  }
  const HL = new Set(C.captionHighlights.map(s => s.toLowerCase()));
  function caption(t) {
    for (const l of tl.lines) {
      if (t < l.start - 0.05 || t > l.end + 0.3) continue;
      const words = l.text.split(' '); const per = (l.end - l.start) / words.length;
      const cur = Math.min(words.length - 1, Math.floor((t - l.start) / per));
      const startW = Math.floor(Math.max(0, cur) / 7) * 7; const seg = words.slice(startW, startW + 7);
      ctx.font = `bold ${66 * S}px Georgia, serif`; ctx.textBaseline = 'middle';
      const sp = ctx.measureText(' ').width, ws = seg.map(w => ctx.measureText(w).width), tot = ws.reduce((a, b) => a + b, 0) + sp * (seg.length - 1);
      let X = W / 2 - tot / 2; const Y = H - 115 * S * (H > W ? 3 : 1);
      ctx.lineJoin = 'round';
      seg.forEach((w, i) => { const k = w.toLowerCase().replace(/[^a-z0-9%'.$-]/g, '').replace(/\.$/, '');
        ctx.lineWidth = 10 * S; ctx.strokeStyle = 'rgba(0,0,0,0.75)'; ctx.strokeText(w, X, Y);
        ctx.fillStyle = HL.has(k) ? YEL : '#fff'; ctx.globalAlpha = startW + i <= cur ? 1 : 0.55; ctx.fillText(w, X, Y); ctx.globalAlpha = 1; X += ws[i] + sp; });
      ctx.fillStyle = l.who === HOST ? '#8f7bff' : '#e0703f'; ctx.beginPath(); ctx.arc(W / 2 - tot / 2 - 36 * S, Y, 12 * S, 0, 7); ctx.fill();
      return;
    }
  }
  function statCard(big, small, k, accent) {
    if (k <= 0) return; const s = back(k) * S;
    ctx.save(); ctx.translate(W - 360 * S, 300 * S); ctx.scale(s, s); ctx.globalAlpha = clamp(k * 2);
    const fb = '900 70px "Segoe UI", Arial', fs = '600 28px "Segoe UI", Arial';
    ctx.font = fb; let w = ctx.measureText(big).width; ctx.font = fs; w = Math.max(w, ctx.measureText(small).width) + 70;
    ctx.fillStyle = 'rgba(14,12,12,0.88)'; ctx.beginPath(); ctx.roundRect(-w / 2, -75, w, 150, 20); ctx.fill();
    ctx.strokeStyle = accent; ctx.lineWidth = 4; ctx.stroke();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = fb; ctx.fillStyle = accent; ctx.fillText(big, 0, -18); ctx.font = fs; ctx.fillStyle = CREAM; ctx.fillText(small, 0, 44);
    ctx.restore();
  }

  // ---------------------------------------------------------------- frame
  function frame(t) {
    const f = Math.round(t * FPS);
    const lh = env[HOST]?.[f] || 0, lo = env[ORB]?.[f] || 0;
    let act = {};
    for (const [a, b, o] of C.acting) if (t >= cue(a) - 0.1 && t < (b ? cue(b) - 0.1 : Infinity)) act = o;
    const hostTurn = act.hostTurn ?? 0.25, expr = act.orb || 'normal';
    host.setMouth(lh); host.setBlink(((t + 0.7) % 3.6) < 0.12 ? 1 : 0);
    host.headPivot.rotation.set(0.03 * Math.sin(t * 1.1) + (lh > 0.05 ? 0.03 * Math.sin(t * 7) : 0), hostTurn + 0.05 * Math.sin(t * 0.8), 0);
    host.look(act.hostLook ?? (hostTurn > 0.3 ? 1 : 0), 0);
    const ty = (s) => 0.8 + 0.01 * Math.max(0, Math.sin(t * 16 + s * 2));
    host.setArm(-1, V(-0.15, ty(-1), 0.42), V(-0.6, 0.6, -0.2));
    host.setArm(1, act.wave ? V(0.22, 1.05 + 0.04 * Math.sin(t * 6), 0.42) : hostTurn > 0.4 ? V(0.42, 1.02 + 0.03 * Math.sin(t * 8), 0.3) : V(0.15, ty(1), 0.42), V(0.6, 0.6, -0.2));
    orb.g.position.y = 1.24 + 0.03 * Math.sin(t * 1.6);
    const oY = act.orbTurn ?? (expr === 'side' ? -0.45 : -0.22);
    orb.tilt.rotation.set(0.05 * Math.sin(t * 1.1) + (expr === 'happy' ? 0.08 * Math.sin(t * 10) : 0), oY + 0.06 * Math.sin(t * 0.7), 0.05 * Math.sin(t * 0.9));
    orb.ring.rotation.set(1.25 + 0.1 * Math.sin(t * 0.5), t * 0.6, 0.3);
    drawFace(expr, lo, t, ((t + 1.9) % 4.1) < 0.12);
    orb.bulb.material.color.set(lo > 0.05 ? 0xfff2a0 : 0xffc84a);

    const m = MON.filter(e => t >= e[0]).pop() || MON[0];
    drawMon(monTex[0], m[1], t - m[0], t); drawMon(monTex[1], m[2], t - m[0], t);

    const [p, l, fov] = camAt(t);
    cam.position.copy(p); cam.lookAt(l); cam.fov = fov; cam.updateProjectionMatrix();
    bokeh.uniforms.focus.value = p.distanceTo(l) * (KEYS[keyAt(t)][1].startsWith('mon') ? 1 : 0.92);
    app.compose(scene, cam, t, { post: false, vignette: 0.45, render: () => composer.render() });

    topicCard(t);
    for (const [a, b, big, small, col] of C.cards) { const k = prog(t, cue(a) - 0.2, cue(a) + 0.15) * (1 - prog(t, cue(b) - 0.2, cue(b) + 0.05)); statCard(big, small, k, col); }
    const ct = C.contact, kc = prog(t, cue(ct.at) - 0.1, cue(ct.at) + 0.25) * (1 - prog(t, tl.duration - 1.6, tl.duration - 1.3));
    if (kc > 0) {
      const sc = back(kc) * S; ctx.save(); ctx.translate(W / 2, 330 * S); ctx.scale(sc, sc); ctx.globalAlpha = clamp(kc * 2);
      ctx.font = '900 58px "Segoe UI", Arial'; const cw = Math.max(ctx.measureText(ct.big).width, 500) + 140;
      ctx.fillStyle = 'rgba(14,12,12,0.92)'; ctx.beginPath(); ctx.roundRect(-cw / 2, -130, cw, 260, 26); ctx.fill();
      ctx.strokeStyle = ORANGE; ctx.lineWidth = 5; ctx.stroke(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = '#fff'; ctx.fillText(ct.big, 0, -42); ctx.fillStyle = YEL; ctx.font = '700 40px "Segoe UI", Arial'; ctx.fillText(ct.small, 0, 50);
      ctx.restore();
    }
    caption(t);
    const ke = eout(prog(t, tl.duration - 1.5, tl.duration - 0.9));
    if (ke > 0) {
      ctx.fillStyle = `rgba(10,8,8,${0.75 * ke})`; ctx.fillRect(0, 0, W, H);
      ctx.save(); ctx.globalAlpha = ke; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.translate(W / 2, H / 2); ctx.scale(S, S);
      ctx.fillStyle = '#fff'; ctx.font = '900 110px "Segoe UI", Arial'; ctx.fillText(C.end.title, 0, -130);
      ctx.fillStyle = YEL; ctx.font = '600 46px "Segoe UI", Arial'; ctx.fillText(C.end.sub, 0, -30);
      ctx.font = '900 42px "Segoe UI", Arial'; const pw = ctx.measureText(C.end.pill).width + 90;
      ctx.fillStyle = ORANGE; ctx.beginPath(); ctx.roundRect(-pw / 2, 50, pw, 100, 50); ctx.fill();
      ctx.fillStyle = '#1a0e06'; ctx.fillText(C.end.pill, 0, 101); ctx.restore();
    }
    if (t > tl.duration - 0.35) { ctx.fillStyle = `rgba(0,0,0,${prog(t, tl.duration - 0.35, tl.duration)})`; ctx.fillRect(0, 0, W, H); }
  }
  return { frame, duration: tl.duration };
}
