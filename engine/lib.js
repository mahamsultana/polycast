// PolyCast engine: low-poly characters (IK limbs, lip-sync mouths), car + road world, compositor (clean or PS1 dither), captions.
import * as THREE from 'three';
export { THREE };

// ------------------------------------------------------------------ PS1 materials
export const SNAP = { value: new THREE.Vector2(100, 178) }; // vertex snap grid in NDC units (wobble)
export function psx(mat) {
  mat.flatShading = true;
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uSnap = SNAP;
    sh.vertexShader = 'uniform vec2 uSnap;\n' + sh.vertexShader.replace('#include <project_vertex>',
      `#include <project_vertex>
       { vec4 sp = gl_Position; sp.xy /= sp.w; sp.xy = floor(sp.xy * uSnap + 0.5) / uSnap; sp.xy *= sp.w; gl_Position = sp; }`);
  };
  mat.customProgramCacheKey = () => 'psx';
  return mat;
}
export const M = (color, o = {}) => psx(new THREE.MeshLambertMaterial({ color, ...o }));
export const MB = (color, o = {}) => psx(new THREE.MeshBasicMaterial({ color, ...o }));
const UP = new THREE.Vector3(0, 1, 0);
const V = (x, y, z) => new THREE.Vector3(x, y, z);
export function mesh(geo, mat, x = 0, y = 0, z = 0, parent) {
  const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); if (parent) parent.add(m); return m;
}
export function box(w, h, d, mat, x, y, z, parent) { return mesh(new THREE.BoxGeometry(w, h, d), mat, x, y, z, parent); }

// seeded rng
export function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
export const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
export const prog = (t, a, b) => clamp((t - a) / (b - a));
export const ease = (x) => { x = clamp(x); return x * x * (3 - 2 * x); };
export const eout = (x) => { x = clamp(x); return 1 - (1 - x) ** 3; };
export const lerp = (a, b, x) => a + (b - a) * x;

// ------------------------------------------------------------------ limbs / IK
export function limb(r1, r2, mat, parent) {
  const g = new THREE.CylinderGeometry(r1, r2, 1, 6); g.translate(0, 0.5, 0);
  const m = new THREE.Mesh(g, mat); parent.add(m); return m;
}
export function setLimb(m, a, b) {
  const d = new THREE.Vector3().subVectors(b, a); const L = d.length();
  m.position.copy(a); m.scale.set(1, L, 1); m.quaternion.setFromUnitVectors(UP, d.normalize());
}
// two-bone IK: returns elbow position
export function ik(sh, target, l1, l2, pole) {
  const d = new THREE.Vector3().subVectors(target, sh);
  let L = clamp(d.length(), Math.abs(l1 - l2) + 1e-3, l1 + l2 - 1e-3);
  const dir = d.clone().normalize();
  const a = (l1 * l1 - l2 * l2 + L * L) / (2 * L);
  const h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  const p = pole.clone().sub(sh); p.sub(dir.clone().multiplyScalar(p.dot(dir))).normalize();
  return sh.clone().addScaledVector(dir, a).addScaledVector(p, h);
}

// ------------------------------------------------------------------ characters
function headGeo(jaw = 0.4) {
  const geo = new THREE.IcosahedronGeometry(1, 1);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    x *= 0.8; z *= 0.9; y *= 1.1;
    if (y < -0.15) x *= 1 - Math.min(1, (-0.15 - y) / 1.0) * jaw; // jaw taper
    if (y < -0.6 && z > 0.2) z += 0.1;                               // chin forward
    if (y > 0.05 && y < 0.45 && z > 0.45) z += 0.08;                 // brow ridge
    if (z < -0.3) z *= 1.08;                                          // back of skull
    p.setXYZ(i, x, y, z);
  }
  geo.computeVertexNormals();
  return geo;
}

// opts: skin, shirt, hair, hairStyle('swoop'|'cap'|'none'), ghost
export function makePerson(o) {
  const root = new THREE.Group();
  const skin = M(o.skin, o.ghost ? { emissive: 0x2a2d30 } : {});
  const shirt = M(o.shirt);
  const dark = MB(0x0b0b0e);
  // torso
  const torso = mesh(new THREE.CylinderGeometry(0.2, 0.15, 0.5, 6), shirt, 0, 0.74, 0, root); torso.scale.z = 0.62;
  const sh = mesh(new THREE.SphereGeometry(0.2, 6, 3, 0, Math.PI * 2, 0, Math.PI / 2), shirt, 0, 0.985, 0, root); sh.scale.set(1.02, 0.42, 0.64);
  if (o.collar) box(0.16, 0.03, 0.05, M(o.collar), 0, 1.03, 0.1, root);
  mesh(new THREE.CylinderGeometry(0.052, 0.06, 0.14, 6), skin, 0, 1.06, 0, root);
  // head
  const headPivot = new THREE.Group(); headPivot.position.set(0, 1.1, 0); root.add(headPivot);
  const head = new THREE.Group(); head.scale.setScalar(o.headScale || 0.115); head.position.y = 0.11; headPivot.add(head);
  mesh(headGeo(o.jaw ?? 0.4), skin, 0, 0, 0, head);
  const eyes = [];
  const ew = o.ghost ? 0.34 : 0.27, eh = o.ghost ? 0.16 : 0.07;
  for (const s of [-1, 1]) {
    if (o.eyes === 'cartoon') {
      const e = new THREE.Group(); e.position.set(s * 0.3, 0.14, 0.72); head.add(e);
      const wh = mesh(new THREE.SphereGeometry(0.17, 8, 6), M(0xf6f1ea), 0, 0, 0, e); wh.scale.set(1, 1.2, 0.55);
      const pu = mesh(new THREE.SphereGeometry(0.085, 6, 5), MB(0x15100e), s * -0.02, -0.01, 0.08, e); pu.scale.set(1, 1.15, 0.6);
      e.userData.pupil = pu; eyes.push(e);
    } else { const e = box(ew, eh, 0.14, dark, s * 0.3, 0.12, 0.78, head); e.rotation.z = s * (o.ghost ? -0.15 : 0.04); eyes.push(e); }
    if (!o.ghost) { const b = box(0.34, o.eyes === 'cartoon' ? 0.09 : 0.06, 0.12, M(o.brow ?? o.hair ?? 0x222222), s * 0.3, 0.33, 0.84, head); b.rotation.z = s * -0.08; }
    box(0.1, 0.3, 0.2, skin, s * 0.8, 0.0, 0, head); // ears
  }
  const nose = mesh(new THREE.ConeGeometry(0.13, 0.36, 4), M(o.skin), 0, -0.05, 0.92, head); nose.rotation.x = Math.PI / 2 + 0.35;
  const mouth = box(o.ghost ? 0.22 : 0.32, 0.05, 0.12, MB(o.ghost ? 0x050505 : 0x2a1210), 0, -0.43, 0.78, head);
  // hair
  const hairM = o.hair != null ? M(o.hair) : null;
  if (o.hairStyle === 'swoop' || o.hairStyle === 'cap') {
    const cap = mesh(new THREE.SphereGeometry(1.07, 8, 5, 0, Math.PI * 2, 0, o.hairStyle === 'cap' ? 1.25 : 1.15), hairM, 0, 0.05, -0.04, head);
    cap.scale.set(0.84, 1.08, 0.95); cap.rotation.x = -0.38;
    if (o.hairStyle === 'swoop') { const q = mesh(new THREE.SphereGeometry(0.9, 7, 4), hairM, 0.12, 0.62, 0.3, head); q.scale.set(0.95, 0.5, 0.85); q.rotation.z = -0.15; }
  }
  if (o.hairStyle === 'long') {
    const cap = mesh(new THREE.SphereGeometry(1.08, 8, 5, 0, Math.PI * 2, 0, 1.3), hairM, 0, 0.06, -0.04, head);
    cap.scale.set(0.86, 1.08, 0.96); cap.rotation.x = -0.3;
    box(1.55, 1.7, 0.45, hairM, 0, -0.55, -0.5, head);                       // back fall
    for (const s of [-1, 1]) { const st = box(0.32, 1.45, 0.55, hairM, s * 0.8, -0.45, 0.05, head); st.rotation.z = s * 0.06; }
  }
  if (o.glasses) {
    const gm = MB(0x101014);
    for (const s of [-1, 1]) {
      box(0.46, 0.06, 0.06, gm, s * 0.3, 0.3, 0.9, head); box(0.46, 0.06, 0.06, gm, s * 0.3, -0.04, 0.88, head);
      box(0.06, 0.38, 0.06, gm, s * 0.08, 0.13, 0.92, head); box(0.06, 0.38, 0.06, gm, s * 0.53, 0.13, 0.84, head);
      box(0.05, 0.05, 0.75, gm, s * 0.8, 0.22, 0.45, head);
    }
  }
  // legs (root-local; feet on y=0 when standing)
  const legs = {};
  if (o.legs) {
    const pants = M(o.pants ?? 0x2b3350), shoe = M(o.shoes ?? 0x15161a);
    mesh(new THREE.CylinderGeometry(0.15, 0.16, 0.12, 6), pants, 0, 0.5, 0, root).scale.z = 0.7;
    for (const s of [-1, 1]) {
      const th = limb(0.068, 0.058, pants, root), sn = limb(0.056, 0.046, pants, root);
      const foot = box(0.085, 0.055, 0.17, shoe, 0, 0, 0, root);
      legs[s] = { th, sn, foot, hip: V(s * 0.085, 0.5, 0) };
    }
  }
  // arms (root-local coordinates)
  const arms = {};
  for (const s of [-1, 1]) {
    const up = limb(0.05, 0.045, shirt, root), fo = limb(0.043, 0.036, skin, root);
    const hand = box(0.06, 0.09, 0.045, skin, 0, 0, 0, root);
    arms[s] = { up, fo, hand, sh: V(s * 0.19, 0.97, 0) };
  }
  const p = {
    root, headPivot, head, eyes, mouth, arms,
    setArm(s, wrist, pole) {
      const a = arms[s];
      const el = ik(a.sh, wrist, 0.29, 0.27, pole || V(s * 0.6, 0.6, -0.4));
      setLimb(a.up, a.sh, el); setLimb(a.fo, el, wrist);
      a.hand.position.copy(wrist).add(new THREE.Vector3().subVectors(wrist, el).normalize().multiplyScalar(0.045));
      a.hand.quaternion.copy(a.fo.quaternion);
    },
    legs,
    setLeg(s, ankle, pole) {
      const l = legs[s]; if (!l) return;
      const kn = ik(l.hip, ankle, 0.27, 0.25, pole || V(s * 0.05, 0.3, 1));
      setLimb(l.th, l.hip, kn); setLimb(l.sn, kn, ankle);
      l.foot.position.set(ankle.x, ankle.y - 0.02, ankle.z + 0.04);
    },
    stand(spread = 0.09) { for (const s of [-1, 1]) p.setLeg(s, V(s * spread, 0.045, 0.01)); },
    setMouth(v) { mouth.scale.y = 1 + clamp(v) * (o.ghost ? 6 : 3.2); },
    setBlink(v) { for (const e of eyes) e.scale.y = Math.max(0.12, 1 - v); },
    look(dx, dy) { for (const e of eyes) if (e.userData.pupil) e.userData.pupil.position.set(dx * 0.06, dy * 0.05 - 0.01, 0.08); },
  };
  p.setArm(-1, V(-0.22, 0.6, 0.28)); p.setArm(1, V(0.22, 0.6, 0.28));
  if (o.legs) p.stand();
  return p;
}

// ------------------------------------------------------------------ world
function skyDome(top, horizon, glow) {
  const g = new THREE.SphereGeometry(400, 24, 12);
  const c = [], p = g.attributes.position, A = new THREE.Color(top), B = new THREE.Color(horizon), G = new THREE.Color(glow);
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i) / 400; const col = new THREE.Color();
    if (y > 0.12) col.copy(B).lerp(A, Math.min(1, (y - 0.12) / 0.5));
    else col.copy(G).lerp(B, clamp((y + 0.05) / 0.17));
    c.push(col.r, col.g, col.b);
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(c, 3));
  return new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
}

// Road along z. Car frame at origin heading +z. Road center at x = +1.75 (car in right lane).
export function makeRoadWorld(scene, seed = 7) {
  const R = rng(seed), L = 240;
  const sky = skyDome(0x03040d, 0x121633, 0x3a1424); scene.add(sky);
  // stars
  const sp = [];
  for (let i = 0; i < 700; i++) {
    const th = R() * Math.PI * 2, ph = 0.12 + R() * 1.3;
    sp.push(Math.cos(th) * Math.cos(ph) * 380, Math.sin(ph) * 380, Math.sin(th) * Math.cos(ph) * 380);
  }
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
  const stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xdfe6ff, size: 1.6, sizeAttenuation: false, fog: false }));
  scene.add(stars);
  const g = new THREE.Group(); scene.add(g);
  box(7, 0.02, 2 * L, M(0x24262d), 1.75, 0, 0, g);
  box(80, 0.02, 2 * L, M(0x0d1410), -42.2, -0.02, 0, g);
  box(80, 0.02, 2 * L, M(0x0d1410), 45.7, -0.02, 0, g);
  box(0.12, 0.025, 2 * L, MB(0x8c8a80), -1.55, 0.005, 0, g);
  box(0.12, 0.025, 2 * L, MB(0x8c8a80), 5.05, 0.005, 0, g);
  box(0.06, 0.25, 2 * L, M(0x7d8590), -2.35, 0.62, 0, g); // guard rail beam
  const movers = [];
  const dashM = MB(0xc9b458);
  for (let i = 0; i < 30; i++) movers.push({ m: box(0.13, 0.025, 3, dashM, 1.75, 0.006, 0, g), z0: i * 8, L: 240 });
  const postM = M(0x5c636d);
  for (let i = 0; i < 60; i++) movers.push({ m: box(0.1, 0.7, 0.1, postM, -2.4, 0.35, 0, g), z0: i * 4, L: 240 });
  // trees (instanced pines)
  const fol = new THREE.ConeGeometry(1, 1, 6);
  const N = 190;
  const tIM = new THREE.InstancedMesh(fol, M(0x10261d), N * 3);
  const trunkIM = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.14, 0.18, 1, 5), M(0x2a1c14), N);
  g.add(tIM, trunkIM);
  const trees = [];
  for (let i = 0; i < N; i++) {
    const side = R() < 0.55 ? -1 : 1;
    const x = side < 0 ? -3.8 - R() * 30 : 6.8 + R() * 30;
    trees.push({ x, z0: R() * L, h: 6 + R() * 7, w: 1.4 + R() * 1.1, ry: R() * 6 });
  }
  const tmp = new THREE.Object3D();
  function update(dist) {
    for (const mv of movers) mv.m.position.z = ((((mv.z0 - dist) % mv.L) + mv.L) % mv.L) - mv.L / 2;
    trees.forEach((tr, i) => {
      const z = ((((tr.z0 - dist) % L) + L) % L) - L / 2;
      tmp.rotation.set(0, tr.ry, 0);
      tmp.position.set(tr.x, 1.2, z); tmp.scale.set(0.35, 2.4, 0.35); tmp.updateMatrix(); trunkIM.setMatrixAt(i, tmp.matrix);
      for (let k = 0; k < 3; k++) {
        const s = tr.w * (1 - k * 0.27), hh = tr.h * 0.42;
        tmp.position.set(tr.x, 2.2 + hh / 2 + k * tr.h * 0.24, z); tmp.scale.set(s, hh, s); tmp.updateMatrix();
        tIM.setMatrixAt(i * 3 + k, tmp.matrix);
      }
    });
    tIM.instanceMatrix.needsUpdate = true; trunkIM.instanceMatrix.needsUpdate = true;
  }
  update(0);
  return { group: g, sky, stars, update };
}

// exterior sedan, centered at origin, heading +z
export function makeCar(color = 0x5d6f78) {
  const g = new THREE.Group();
  const body = M(color), glass = M(0x0b0e18), black = M(0x111214);
  box(1.8, 0.55, 4.3, body, 0, 0.62, 0, g);
  const cab = new THREE.BoxGeometry(1.62, 0.56, 2.3); const p = cab.attributes.position;
  for (let i = 0; i < p.count; i++) if (p.getY(i) > 0) { p.setX(i, p.getX(i) * 0.9); p.setZ(i, p.getZ(i) * 0.72 - 0.1); }
  cab.computeVertexNormals();
  mesh(cab, glass, 0, 1.17, -0.25, g);
  box(1.7, 0.05, 1.4, body, 0, 1.46, -0.35, g);
  const wheels = [];
  for (const x of [-0.86, 0.86]) for (const z of [-1.35, 1.35]) {
    const w = mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.24, 8), black, x, 0.34, z, g); w.rotation.z = Math.PI / 2; wheels.push(w);
  }
  const hl = MB(0xfff2c0), tl = MB(0xff1a1a), amber = MB(0x3a2200);
  box(0.36, 0.13, 0.05, hl, -0.6, 0.72, 2.16, g); box(0.36, 0.13, 0.05, hl, 0.6, 0.72, 2.16, g);
  box(0.42, 0.12, 0.05, tl, -0.6, 0.76, -2.16, g); box(0.42, 0.12, 0.05, tl, 0.6, 0.76, -2.16, g);
  const haz = [box(0.14, 0.1, 0.06, amber, -0.86, 0.72, 2.12, g), box(0.14, 0.1, 0.06, amber, 0.86, 0.72, 2.12, g),
               box(0.14, 0.1, 0.06, amber, -0.86, 0.76, -2.12, g), box(0.14, 0.1, 0.06, amber, 0.86, 0.76, -2.12, g)];
  const head = new THREE.SpotLight(0xfff0c8, 40, 45, 0.55, 0.6, 1.2); head.position.set(0, 0.8, 2.2);
  head.target.position.set(0, 0, 14); g.add(head, head.target);
  const tail = new THREE.PointLight(0xff2020, 3, 7, 1.2); tail.position.set(0, 0.8, -2.6); g.add(tail);
  const hazL = new THREE.PointLight(0xff9a20, 0, 9, 1.2); hazL.position.set(0, 1.0, 0); g.add(hazL);
  return {
    group: g, wheels, head, tail,
    setHazard(on) { for (const h of haz) h.material.color.set(on ? 0xffa524 : 0x3a2200); hazL.intensity = on ? 4 : 0; },
    spin(dist) { for (const w of wheels) w.rotation.x = -dist / 0.34; },
  };
}

// car interior, same car frame (front seats z~0, rear bench z~-0.9, dashboard z~+0.6)
export function makeInterior() {
  const g = new THREE.Group();
  const seat = M(0x2a2e3b), shell = M(0x1a1d27), dash = M(0x14161d), trim = M(0x262a35);
  box(1.56, 0.04, 2.3, shell, 0, 1.52, -0.35, g);                     // roof
  for (const s of [-1, 1]) {
    box(0.05, 0.55, 2.6, trim, s * 0.78, 0.7, -0.3, g);                 // doors
    box(0.1, 0.62, 0.14, shell, s * 0.74, 1.2, -1.36, g);               // C pillar
    box(0.08, 0.55, 0.1, shell, s * 0.77, 1.22, -0.35, g);              // B pillar
    box(0.08, 0.6, 0.08, shell, s * 0.74, 1.2, 0.72, g);                // A pillar
    // front seat
    const x = s * 0.34;
    const back = box(0.48, 0.64, 0.12, seat, x, 0.86, -0.19, g); back.rotation.x = -0.1;
    box(0.25, 0.17, 0.1, seat, x, 1.36, -0.24, g);                      // headrest
    box(0.04, 0.12, 0.04, trim, x - 0.07, 1.25, -0.23, g); box(0.04, 0.12, 0.04, trim, x + 0.07, 1.25, -0.23, g);
    box(0.48, 0.12, 0.5, seat, x, 0.5, 0.05, g);
    box(0.24, 0.16, 0.1, seat, s * 0.42, 1.17, -1.1, g);               // rear headrests
  }
  box(1.38, 0.52, 0.14, seat, 0, 0.82, -1.06, g);                       // rear bench back
  box(1.38, 0.12, 0.46, seat, 0, 0.55, -0.8, g);                        // rear cushion
  box(1.5, 0.05, 0.32, shell, 0, 1.0, -1.27, g);                        // parcel shelf
  box(1.5, 0.07, 0.1, shell, 0, 1.49, -1.4, g);                         // rear window top
  box(1.7, 0.3, 0.7, M(0x262e33), 0, 0.82, -1.8, g);                    // trunk lid (outside)
  box(0.18, 0.26, 0.6, trim, 0, 0.56, 0.12, g);                         // console
  box(1.56, 0.22, 0.36, dash, 0, 0.82, 0.64, g);                        // dashboard
  box(1.56, 0.08, 0.2, dash, 0, 0.95, 0.74, g);
  // steering wheel (in front of driver at x=-0.34)
  const wheel = mesh(new THREE.TorusGeometry(0.17, 0.022, 4, 12), M(0x0e0f12), -0.34, 0.96, 0.42, g); wheel.rotation.x = -0.35;
  const col = limb(0.03, 0.03, M(0x0e0f12), g); setLimb(col, V(-0.34, 0.96, 0.42), V(-0.34, 0.86, 0.62));
  // radio (faces -z, toward occupants)
  const rad = new THREE.Group(); rad.position.set(0, 0.79, 0.455); g.add(rad);
  box(0.32, 0.15, 0.03, M(0x2a2e36), 0, 0, 0, rad);
  const rc = document.createElement('canvas'); rc.width = 160; rc.height = 48;
  const tex = new THREE.CanvasTexture(rc); tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter;
  const disp = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.06), new THREE.MeshBasicMaterial({ map: tex }));
  disp.rotation.y = Math.PI; disp.position.set(0, 0.02, -0.017); rad.add(disp);
  for (const s of [-1, 1]) { const k = mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.03, 8), M(0x3a3d44), s * 0.125, -0.035, -0.025, rad); k.rotation.x = Math.PI / 2; }
  const radioGlow = new THREE.PointLight(0x40ff9a, 0, 0.9, 1.5); radioGlow.position.set(0, 0.85, 0.3); g.add(radioGlow);
  return { group: g, wheel, radio: { group: rad, canvas: rc, ctx: rc.getContext('2d'), tex, glow: radioGlow } };
}

// ------------------------------------------------------------------ app / compositing
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
export function createApp(LW = 360, LH = 640, W = 1080, H = 1920) {
  const gl = document.createElement('canvas'); gl.width = LW; gl.height = LH;
  const renderer = new THREE.WebGLRenderer({ canvas: gl, antialias: false, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1); renderer.setSize(LW, LH, false);
  const small = document.createElement('canvas'); small.width = LW; small.height = LH;
  const sctx = small.getContext('2d', { willReadFrequently: true });
  const big = document.createElement('canvas'); big.width = W; big.height = H; document.body.appendChild(big);
  const ctx = big.getContext('2d');
  function compose(scene, camera, t, { grain = 0.05, levels = 40, vignette = 0.6, post = true, render = null } = {}) {
    if (render) render(); else renderer.render(scene, camera);
    if (!post) { ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high'; ctx.drawImage(gl, 0, 0, W, H); }
    else {
    sctx.drawImage(gl, 0, 0);
    const img = sctx.getImageData(0, 0, LW, LH), d = img.data, q = 255 / (levels - 1);
    let seed = (Math.floor(t * 30) * 7919 + 17) >>> 0;
    for (let y = 0; y < LH; y++) for (let x = 0; x < LW; x++) {
      const i = (y * LW + x) * 4, b = (BAYER[(y & 3) * 4 + (x & 3)] / 16 - 0.47) * q;
      seed = (seed * 1664525 + 1013904223) >>> 0; const n = (seed / 4294967296 - 0.5) * grain * 255;
      for (let c = 0; c < 3; c++) { let v = Math.round((d[i + c] + b + n) / q) * q; d[i + c] = v < 0 ? 0 : v > 255 ? 255 : v; }
    }
    sctx.putImageData(img, 0, 0);
    ctx.imageSmoothingEnabled = false; ctx.drawImage(small, 0, 0, W, H);
    }
    if (vignette) {
      const gr = ctx.createRadialGradient(W / 2, H / 2, H * 0.28, W / 2, H / 2, H * 0.72);
      gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, `rgba(0,0,0,${vignette})`); ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H);
    }
  }
  return { renderer, ctx, big, W, H, LW, LH, compose };
}

// ------------------------------------------------------------------ captions
// lines: [{start,end,text}], chunks of <=maxW words timed proportionally to characters
export function buildChunks(lines, maxW = 3) {
  const out = [];
  for (const ln of lines) {
    const words = ln.text.split(/\s+/); const chunks = [];
    let cur = [];
    for (const w of words) { cur.push(w); if (cur.length >= maxW || /[.?!,]$/.test(w)) { chunks.push(cur); cur = []; } }
    if (cur.length) chunks.push(cur);
    const tot = chunks.reduce((a, c) => a + c.join(' ').length + 3, 0);
    let t = ln.start;
    for (const c of chunks) {
      const d = (ln.end - ln.start) * (c.join(' ').length + 3) / tot;
      out.push({ start: t, end: t + d, words: c, who: ln.who }); t += d;
    }
  }
  for (let i = 0; i < out.length; i++) out[i].show = Math.min(out[i].end + 0.35, out[i + 1] ? out[i + 1].start : 1e9);
  return out;
}
export function drawCaption(ctx, chunks, t, hilite, y = 1330, W = 1080) {
  const c = chunks.find(c => t >= c.start && t < c.show); if (!c) return;
  const pop = 1 + 0.18 * (1 - eout(prog(t, c.start, c.start + 0.12)));
  const size = 96;
  ctx.save(); ctx.font = `900 ${size}px "Arial Black", Impact, sans-serif`; ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  const words = c.words.map(w => w.toUpperCase());
  const sp = ctx.measureText(' ').width;
  let widths = words.map(w => ctx.measureText(w).width), total = widths.reduce((a, b) => a + b, 0) + sp * (words.length - 1);
  const sc = Math.min(1, 940 / total);
  ctx.translate(W / 2, y); ctx.scale(pop * sc, pop * sc);
  let x = -total / 2;
  words.forEach((w, i) => {
    const key = c.words[i].toLowerCase().replace(/[^a-z0-9']/g, '');
    const col = hilite[key] || '#ffffff';
    ctx.lineWidth = 18; ctx.strokeStyle = '#000'; ctx.strokeText(w, x, 0);
    ctx.fillStyle = col; ctx.fillText(w, x, 0);
    x += widths[i] + sp;
  });
  ctx.restore();
}
