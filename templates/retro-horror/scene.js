// PolyCast "retro-horror" template: "Route 9" (vertical 1080x1920, PS1-style low-poly horror). Car frame: +z = forward, camera usually at +z looking back at the guys.
export async function setup(L, app, tl, env) {
  const { THREE, M, MB, clamp, prog, ease, eout, lerp } = L;
  const FPS = 30;
  const Ln = Object.fromEntries(tl.lines.map(l => [l.id, l]));
  const cut = (a, b) => (Ln[a].end + Ln[b].start) / 2;
  const THUD = [Ln.l05.end + 0.15, Ln.l05.end + 0.5];
  const RADIO_ON = Ln.l07.start + 1.25;

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x121633, 0.045);
  const world = L.makeRoadWorld(scene, 11);
  const car = L.makeCar(0x55656e); scene.add(car.group);
  const inter = L.makeInterior(); scene.add(inter.group);
  const radio = inter.radio;

  // lights
  scene.add(new THREE.HemisphereLight(0x46527a, 0x0a0812, 1.1));
  const moon = new THREE.DirectionalLight(0x8fa0d8, 0.9); moon.position.set(-20, 30, -12); scene.add(moon);
  const key = new THREE.PointLight(0xb4c4ff, 1.9, 3.2, 0.6); key.position.set(0.15, 1.35, 1.0); scene.add(key);
  const rearRed = new THREE.PointLight(0xff2a2a, 3.2, 3.6, 0.8); rearRed.position.set(0, 1.0, -2.0); scene.add(rearRed);
  const flash = new THREE.SpotLight(0xfff4d6, 0, 6, 0.32, 0.5, 1); scene.add(flash, flash.target);
  const ghostLight = new THREE.PointLight(0xff3030, 0, 1.6, 1); ghostLight.position.set(0, 1.0, -0.9); scene.add(ghostLight);

  // characters (match reference: pale guy in yellow, darker guy in blue)
  const danny = L.makePerson({ skin: 0xc4beb4, shirt: 0xd9c23c, hair: 0x5a3c22, hairStyle: 'swoop', jaw: 0.45 });
  const nar = L.makePerson({ skin: 0x7b4c34, shirt: 0x2846d0, hair: 0x101014, hairStyle: 'cap', brow: 0x1a1210, jaw: 0.3 });
  const ghost = L.makePerson({ skin: 0xd6d8d2, shirt: 0x141418, ghost: true, jaw: 0.55, headScale: 0.12 });
  danny.root.position.set(-0.34, 0, -0.02); nar.root.position.set(0.34, 0, -0.02);
  for (const p of [danny, nar, ghost]) scene.add(p.root);
  const V = (x, y, z) => new THREE.Vector3(x, y, z);

  const cam = new THREE.PerspectiveCamera(60, 9 / 16, 0.05, 500);
  const chunks = L.buildChunks(tl.lines.filter(l => l.id !== 'l12'), 3);
  const R = '#ff3b3b', Y = '#ffd23f';
  const HL = { route: Y, '9': Y, three: R, am: Y, back: R, "i'm": Y, kicking: R, empty: R, radio: Y, passengers: R, tonight: R, two: Y, off: R };

  const SH = [
    ['hook', 0, cut('l01', 'l02')],
    ['chase', cut('l01', 'l02'), cut('l02', 'l03')],
    ['ask', cut('l02', 'l03'), cut('l03', 'l04')],
    ['notme', cut('l03', 'l04'), cut('l04', 'l05')],
    ['kick', cut('l04', 'l05'), Ln.l05.end + 0.9],
    ['parked', Ln.l05.end + 0.9, Ln.l06.start + 1.3],
    ['backseat', Ln.l06.start + 1.3, cut('l06', 'l07')],
    ['radioOn', cut('l06', 'l07'), cut('l07', 'l08')],
    ['whisper', cut('l07', 'l08'), cut('l08', 'l09')],
    ['laugh', cut('l08', 'l09'), cut('l09', 'l10')],
    ['look', cut('l09', 'l10'), cut('l10', 'l11')],
    ['off', cut('l10', 'l11'), Ln.l11.end + 0.5],
    ['reveal', Ln.l11.end + 0.5, Ln.l12.start - 0.4],
    ['end', Ln.l12.start - 0.4, tl.duration],
  ].map(([name, a, b]) => ({ name, a, b }));
  const SMASH = Ln.l12.start - 0.55;

  const STOP = SH.find(s => s.name === 'parked').a;
  const distAt = (t) => t < STOP - 1 ? 17 * t : 17 * (STOP - 1) + 17 * 0.5; // smooth-ish stop
  const driving = (t) => t < STOP;

  function drawRadio(mode, t) {
    const c = radio.ctx; c.fillStyle = '#000000'; c.fillRect(0, 0, 160, 48);
    if (mode === 'on' || mode === 'whisper') {
      const fl = mode === 'whisper' && Math.sin(t * 53) > 0.2;
      c.fillStyle = fl ? '#ff3b3b' : '#3dff8f'; c.font = 'bold 24px monospace'; c.textBaseline = 'middle';
      if (mode === 'whisper') {
        const e = env.woman[Math.round(t * FPS)] || 0;
        for (let i = 0; i < 16; i++) { const h = 4 + e * 34 * Math.abs(Math.sin(i * 1.7 + t * 19)); c.fillRect(8 + i * 9, 24 - h / 2, 6, h); }
      } else c.fillText('FM 101.3', 14, 25);
    }
    if (mode === 'reflect') { // faint face in the dead screen
      c.fillStyle = 'rgba(190,195,190,0.16)'; c.beginPath(); c.ellipse(110, 26, 15, 19, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#000'; c.fillRect(100, 20, 8, 3); c.fillRect(113, 20, 8, 3); c.fillRect(107, 33, 7, 5);
    }
    radio.tex.needsUpdate = true;
  }

  // ------------------------------------------------------------------ frame
  function frame(t) {
    const f = Math.round(t * FPS);
    const shot = SH.find(s => t >= s.a && t < s.b) || SH[SH.length - 1];
    const lt = t - shot.a, D = shot.b - shot.a, u = lt / D;
    const dist = distAt(t);
    world.update(dist); car.spin(dist);
    const drive = driving(t);
    const bump = drive ? Math.sin(t * 13.1) * 0.004 + Math.sin(t * 7.3) * 0.003 : 0;

    // defaults
    const ext = ['chase', 'parked', 'end'].includes(shot.name);
    car.group.visible = ext; inter.group.visible = !ext;
    danny.root.visible = nar.root.visible = !['backseat', 'parked', 'end'].includes(shot.name);
    if (shot.name === 'chase') danny.root.visible = nar.root.visible = false;
    if (['radioOn', 'whisper', 'off'].includes(shot.name)) nar.root.visible = false;
    ghost.root.visible = false; ghostLight.intensity = 0; flash.intensity = 0;
    const haz = !drive && Math.floor(t * 2.4) % 2 === 0 && t < SMASH; car.setHazard(haz);
    rearRed.intensity = drive ? 3.2 : (haz ? 2.2 : 1.2); rearRed.color.set(haz && !drive ? 0xff9a20 : 0xff2a2a);
    key.intensity = 1.9; key.color.set(0xb4c4ff);

    // characters: base pose
    for (const [p, s] of [[danny, 1], [nar, -1]]) {
      p.root.position.y = bump; p.root.rotation.set(0, 0, 0);
      p.headPivot.rotation.set(0.02 + Math.sin(t * 0.9 + s) * 0.02, Math.sin(t * 0.5 + s * 2) * 0.05, 0);
      const bl = ((t + (s > 0 ? 0 : 1.3)) % 3.4) < 0.13 ? 1 : 0; p.setBlink(bl);
    }
    danny.setMouth(env.danny[f] || 0); nar.setMouth(env.nar[f] || 0);
    for (const s of [-1, 1]) danny.setArm(s, V(s * 0.15 + 0.0, 0.98, 0.4), V(s * 0.7, 0.4, 0.0));
    nar.setArm(-1, V(-0.16, 0.6, 0.3)); nar.setArm(1, V(0.24, 0.62, 0.28));
    danny.root.position.z = -0.02; danny.root.rotation.x = 0;

    // radio state
    let rmode = t >= RADIO_ON ? 'on' : 'dark';
    if (shot.name === 'whisper') rmode = 'whisper';
    if (shot.name === 'off' || shot.name === 'reveal' || shot.name === 'end') rmode = (shot.name === 'off' && lt > 0.55 && lt < 0.72) ? 'reflect' : 'dark';
    drawRadio(rmode, t);
    radio.glow.intensity = rmode === 'on' ? 1.2 : rmode === 'whisper' ? 0.8 + Math.random() * 0.6 : 0;

    // handheld drift
    const hx = Math.sin(t * 0.7) * 0.012, hy = Math.sin(t * 0.53 + 1) * 0.01;
    let pos, look, fov = 60;

    switch (shot.name) {
      case 'hook': {
        pos = V(hx, 1.19 + hy, lerp(1.38, 1.24, ease(u))); look = V(0, 1.14, 0); fov = 58;
        nar.headPivot.rotation.y = lt > 2.2 && lt < 3.0 ? -0.5 * Math.sin(prog(lt, 2.2, 3.0) * Math.PI) : 0; // glance back
        if (t > 1.55 && t < 1.85) { ghost.root.visible = true; ghost.root.position.set(0.02, -0.18, -0.95); ghost.setMouth(0); }
        break;
      }
      case 'chase': {
        pos = V(3.0 - u * 0.8, 2.7 + hy, -9.5 + u * 1.2); look = V(0.4, 0.9, 3);
        fov = 50; break;
      }
      case 'ask': {
        pos = V(-0.08 + hx, 1.19 + hy, 1.18); look = V(-0.05, 1.14, 0); fov = 58;
        danny.headPivot.rotation.y = 0.55 * ease(prog(lt, 0.1, 0.45)); danny.headPivot.rotation.x = -0.05;
        if (t > Ln.l03.end - 0.2 && t < Ln.l03.end + 0.05) { ghost.root.visible = true; ghost.root.position.set(-0.02, -0.17, -0.95); }
        break;
      }
      case 'notme': {
        pos = V(0.22 + hx, 1.2 + hy, 0.62); look = V(0.34, 1.18, 0); fov = 46;
        nar.headPivot.rotation.y = -0.45 * ease(prog(lt, 0.0, 0.35));
        break;
      }
      case 'kick': {
        let sh = 0, jolt = 0;
        for (const th of THUD) { const k = t - th; if (k >= 0 && k < 0.45) { jolt += Math.exp(-k * 12) * 0.05; sh += Math.exp(-k * 10) * 0.03; } }
        danny.root.position.z = -0.02 + jolt; danny.headPivot.rotation.x = -jolt * 3;
        const scared = prog(t, THUD[0], THUD[0] + 0.2);
        danny.setBlink(0); danny.eyes.forEach(e => e.scale.y = 1 + scared * 0.6);
        pos = V(-0.2 + hx + (Math.random() - 0.5) * sh, 1.2 + hy + (Math.random() - 0.5) * sh, 0.6 - u * 0.08); look = V(-0.34, 1.18, 0); fov = 46;
        break;
      }
      case 'parked': { // watched from the trees beyond the guard rail
        pos = V(-5.2 + u * 0.4, 1.5 + hy * 2, 5.5 - u * 0.6); look = V(0.2, 0.8, -0.3); fov = 52;
        break;
      }
      case 'backseat': {
        pos = V(0.95 + hx, 1.15, -0.62); look = V(-0.3, 0.72, -0.85); fov = 66;
        flash.intensity = 14; flash.angle = 0.5; flash.position.set(0.9, 1.05, -0.5);
        flash.target.position.set(-0.1 + Math.sin(lt * 1.6) * 0.5, 0.7, -0.85);
        key.intensity = 0.4; break;
      }
      case 'radioOn': {
        pos = V(0.2 + hx * 0.5, 1.05 + hy * 0.5, -0.06); look = V(0.0, 0.79, 0.45); fov = 46;
        const reach = ease(prog(t, RADIO_ON - 0.7, RADIO_ON - 0.1)) * (1 - ease(prog(t, RADIO_ON + 0.25, RADIO_ON + 0.8)));
        const press = V(0.34, 0.78, 0.40), rest = V(0.15, 0.98, 0.4);
        danny.setArm(1, rest.clone().lerp(press, reach), V(0.6, 0.5, -0.2));
        danny.root.rotation.z = -0.06 * reach;
        break;
      }
      case 'whisper': {
        pos = V(0.0 + hx * 0.4, 0.95, 0.12 - u * 0.04); look = V(0.0, 0.79, 0.45); fov = 34;
        break;
      }
      case 'laugh': {
        pos = V(hx, 1.19 + hy, 1.25); look = V(0, 1.14, 0); fov = 58;
        const lf = env.danny[f] || 0;
        danny.headPivot.rotation.x = -0.12 * lf + Math.sin(t * 22) * 0.03 * lf; danny.headPivot.rotation.y = 0.3;
        nar.headPivot.rotation.y = -0.15;
        break;
      }
      case 'look': {
        pos = V(0.22 + hx, 1.2 + hy, 0.62); look = V(0.34, 1.16, 0); fov = 46;
        nar.headPivot.rotation.y = -0.35 * ease(prog(lt, 0.4, 1.2)); nar.headPivot.rotation.x = 0.35 * ease(prog(lt, 0.4, 1.2));
        break;
      }
      case 'off': {
        pos = V(0.17, 1.02, lerp(0.0, 0.08, ease(u))); look = V(0.0, 0.79, 0.45); fov = 42;
        key.intensity = 1.0; break;
      }
      case 'reveal': {
        pos = V(hx * 0.4, 1.19, lerp(1.3, 1.0, ease(u))); look = V(0, 1.14, 0); fov = 58;
        key.intensity = 1.4;
        danny.headPivot.rotation.set(0.0, 0.0, 0); nar.headPivot.rotation.set(0.32, -0.35, 0); danny.setBlink(0); nar.setBlink(0);
        ghost.root.visible = true; ghostLight.intensity = 2.2;
        const rise = ease(prog(lt, 0.15, 1.3)), lunge = ein(prog(t, SMASH - 0.45, SMASH));
        ghost.root.position.set(0, lerp(-0.55, -0.06, rise) + lunge * 0.02, lerp(-0.62, -0.5, rise) + lunge * 0.9);
        ghostLight.position.set(0, 1.0, ghost.root.position.z + 0.3);
        ghost.headPivot.rotation.set(0, 0, 0.32 * ease(prog(lt, 1.1, 1.5)) * (1 - lunge));
        ghost.setMouth(lunge > 0 ? 1 : 0.1); ghost.setBlink(0);
        break;
      }
      case 'end': {
        pos = V(-4 + u * 1.5, 3.2 + u * 1.5, -10 - u * 2); look = V(0.5, 0.6, 2); fov = 55;
        break;
      }
    }
    cam.fov = fov; cam.position.copy(pos); cam.lookAt(look); cam.updateProjectionMatrix();

    const { ctx, W, H } = app;
    if (t >= SMASH && shot.name !== 'end') { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); return; }
    app.compose(scene, cam, t, shot.name === 'end' ? { vignette: 0.8 } : {});
    if (shot.name === 'reveal' && t > SMASH - 0.07) { ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.fillRect(0, 0, W, H); }

    // VHS timestamp (interior/exterior story shots)
    if (shot.name !== 'end') {
      ctx.save(); ctx.font = 'bold 44px "Courier New", monospace'; ctx.textBaseline = 'top';
      const sec = 7 * 60 + 14 + Math.floor(t); const ts = `03:${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')} AM`;
      ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillText(ts, 64, 214); ctx.fillStyle = '#e8e8e0'; ctx.fillText(ts, 60, 210);
      ctx.fillText('RT 9', 60, 262);
      if (Math.floor(t * 1.5) % 2 === 0) { ctx.fillStyle = '#ff3030'; ctx.beginPath(); ctx.arc(890, 236, 14, 0, 7); ctx.fill(); ctx.fillStyle = '#e8e8e0'; ctx.fillText('REC', 912, 214); }
      ctx.restore();
      L.drawCaption(ctx, chunks, t, HL, 1330);
    }
    if (shot.name === 'end') endCard(ctx, t - shot.a, W, H);
    // scene fade-in
    const fin = 1 - ease(prog(lt, 0, 0.14));
    if (fin > 0 && shot.name !== 'off' && shot.name !== 'reveal') { ctx.fillStyle = `rgba(0,0,0,${fin})`; ctx.fillRect(0, 0, W, H); }
  }
  function ein(x) { x = clamp(x); return x * x * x; }

  function logo(ctx, x, y, s, a) {
    ctx.save(); ctx.globalAlpha = a; ctx.translate(x, y); ctx.scale(s, s);
    ctx.shadowColor = 'rgba(245,197,66,0.6)'; ctx.shadowBlur = 40;
    ctx.fillStyle = '#f3ead3'; ctx.beginPath(); ctx.arc(0, 0, 90, 0, Math.PI * 2); ctx.arc(38, -22, 78, 0, Math.PI * 2, true); ctx.fill('evenodd');
    ctx.shadowBlur = 0; ctx.fillStyle = '#f5c542'; ctx.beginPath(); // quill
    ctx.moveTo(10, 70); ctx.quadraticCurveTo(40, -10, 105, -95); ctx.quadraticCurveTo(70, 0, 22, 66); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#f5c542'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(14, 66); ctx.lineTo(0, 92); ctx.stroke();
    ctx.restore();
  }
  function pill(ctx, text, x, y, a) {
    ctx.save(); ctx.globalAlpha = a; ctx.font = '900 50px "Arial Black", sans-serif'; ctx.textBaseline = 'middle';
    const w = ctx.measureText(text).width + 90; ctx.fillStyle = '#f5c542';
    ctx.beginPath(); ctx.roundRect(x - w / 2, y - 50, w, 100, 50); ctx.fill(); ctx.fillStyle = '#0a0d22'; ctx.textAlign = 'center'; ctx.fillText(text, x, y + 2); ctx.restore();
  }
  function txt(ctx, s, x, y, size, col, a, font = '900', sp = 0, scale = 1) {
    ctx.save(); ctx.globalAlpha = a; ctx.font = `${font} ${size}px "Arial Black", Impact, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.letterSpacing = sp + 'px'; ctx.translate(x, y); ctx.scale(scale, scale);
    ctx.lineJoin = 'round'; ctx.lineWidth = size * 0.16; ctx.strokeStyle = 'rgba(0,0,0,0.9)'; ctx.strokeText(s, 0, 0); ctx.fillStyle = col; ctx.fillText(s, 0, 0); ctx.restore();
  }
  function endCard(ctx, lt, W, H) {
    ctx.fillStyle = 'rgba(5,7,20,0.55)'; ctx.fillRect(0, 0, W, H);
    const a0 = Ln.l12.start - SH[SH.length - 1].a; // "Want part two?"
    const k1 = eout(prog(lt, a0, a0 + 0.3));
    txt(ctx, 'WANT PART 2?', W / 2, 470, 110, '#ff3b3b', k1, '900', 0, 0.8 + 0.2 * k1);
    const a1 = a0 + 1.0, k2 = eout(prog(lt, a1, a1 + 0.5));
    txt(ctx, 'WHO WAS THE', W / 2, 800, 84, '#f3ead3', k2, '900');
    txt(ctx, 'THIRD PASSENGER?', W / 2, 910, 84, '#f3ead3', k2, '900');
    const a2 = a0 + 2.4, k3 = eout(prog(lt, a2, a2 + 0.35));
    pill(ctx, 'COMMENT BELOW 👇', W / 2, 1160, k3);
    txt(ctx, 'made with PolyCast', W / 2, 1300, 38, '#f5c542', ease(prog(lt, a2 + 0.6, a2 + 1.0)), '700');
  }

  return { frame, duration: tl.duration };
}
