// Frostlings — blocky creature models built in code (per-species shape/ears/tail/wings/colours), hats, snares, tamers.
import * as THREE from 'three';
import { SPECIES_BY_ID, HATS } from './config.js';

const matCache = new Map();
export function clearMatCache() { matCache.clear(); }
export function mat(color, o = {}) {
  const { unique, ...rest } = o; const k = color + JSON.stringify(rest); if (!unique && matCache.has(k)) return matCache.get(k);
  const m = new THREE.MeshStandardMaterial({ color, roughness: 0.75, ...rest }); if (!unique) matCache.set(k, m); return m;
}
const BOX = new THREE.BoxGeometry(1, 1, 1);
function box(parent, w, h, d, m, x, y, z, rx = 0, ry = 0, rz = 0) {
  const b = new THREE.Mesh(BOX, m); b.scale.set(w, h, d); b.position.set(x, y, z); b.rotation.set(rx, ry, rz); b.castShadow = true; parent.add(b); return b;
}
const SHAPES = { round: [1.0, 0.85, 1.0], tall: [0.85, 1.15, 0.8], long: [0.9, 0.75, 1.45], tiny: [0.75, 0.7, 0.75] };

/** Build a Frostling model. Returns a Group; userData has parts for animation + flash(). */
export function buildFrostling(spId, { hat = null, scale = 1 } = {}) {
  const sp = SPECIES_BY_ID[spId], M = sp.model;
  const root = new THREE.Group(), rig = new THREE.Group(); root.add(rig);
  const glow = M.glow ? { emissive: M.glow, emissiveIntensity: 0.35 } : {};
  const mBody = mat(M.body, { ...glow, unique: true }), mBelly = mat(M.belly), mAcc = mat(M.accent, M.glow ? { emissive: M.accent, emissiveIntensity: 0.45 } : {});
  const mEye = mat('#1a1530', { roughness: 0.3 }), mWhite = mat('#ffffff', { emissive: '#ffffff', emissiveIntensity: 0.6 }), mCheek = mat('#ff9fb8');
  const [bw, bh, bd] = SHAPES[M.shape] || SHAPES.round;
  const legH = M.shape === 'tall' ? 0.35 : 0.22;
  // body
  const body = new THREE.Group(); body.position.y = legH; rig.add(body);
  box(body, bw, bh, bd, mBody, 0, bh / 2, 0);
  box(body, bw * 0.7, bh * 0.6, 0.06, mBelly, 0, bh * 0.42, bd / 2 + 0.03);
  // head
  const long = M.shape === 'long', hs = M.shape === 'tiny' ? 0.0 : 0.72;
  const head = new THREE.Group();
  if (hs) { head.position.set(0, long ? bh * 0.95 : bh + 0.32, long ? bd / 2 - 0.1 : 0.06); body.add(head); box(head, 0.78, 0.68, 0.7, mBody, 0, 0, 0); }
  else { head.position.set(0, bh * 0.62, 0); body.add(head); }   // tiny: face on the body
  const fz = hs ? 0.36 : bd / 2 + 0.01, fy = hs ? 0.02 : 0;
  for (const sx of [-1, 1]) {
    box(head, 0.13, 0.17, 0.04, mEye, sx * 0.17, fy + 0.04, fz);
    box(head, 0.05, 0.05, 0.02, mWhite, sx * 0.17 + 0.03, fy + 0.09, fz + 0.025);
    box(head, 0.12, 0.07, 0.03, mCheek, sx * 0.27, fy - 0.1, fz);
  }
  box(head, 0.12, 0.05, 0.03, mEye, 0, fy - 0.1, fz);   // smile
  const top = hs ? 0.34 : bh * 0.38;
  // ears
  const ears = [];
  for (const sx of [-1, 1]) {
    const e = new THREE.Group(); e.position.set(sx * (hs ? 0.25 : bw * 0.3), top, 0); head.add(e); ears.push(e);
    switch (M.ears) {
      case 'cat': box(e, 0.2, 0.24, 0.12, mBody, 0, 0.1, 0, 0, 0, sx * -0.2); box(e, 0.1, 0.14, 0.04, mAcc, 0, 0.08, 0.06, 0, 0, sx * -0.2); break;
      case 'bunny': box(e, 0.15, 0.55, 0.1, mBody, 0, 0.28, 0, -0.15, 0, sx * -0.12); box(e, 0.07, 0.4, 0.03, mAcc, 0, 0.26, 0.05, -0.15, 0, sx * -0.12); break;
      case 'round': box(e, 0.22, 0.2, 0.1, mAcc, sx * 0.04, 0.08, 0); break;
      case 'horn': box(e, 0.1, 0.32, 0.1, mAcc, sx * -0.02, 0.15, 0, 0, 0, sx * -0.35); break;
      case 'antler': box(e, 0.07, 0.4, 0.07, mAcc, 0, 0.2, 0, 0, 0, sx * -0.3); box(e, 0.18, 0.06, 0.06, mAcc, sx * 0.1, 0.32, 0); box(e, 0.06, 0.16, 0.06, mAcc, sx * 0.18, 0.42, 0); break;
      case 'fin': box(e, 0.06, 0.28, 0.3, mAcc, sx * 0.08, 0.08, -0.05, 0, 0, sx * -0.6); break;
    }
  }
  if (M.crest) for (let i = 0; i < 3; i++) box(head, 0.1, 0.18 - i * 0.03, 0.1, mAcc, 0, top + 0.08, 0.12 - i * 0.14, -0.3);
  if (M.cap) { box(head, 1.05, 0.28, 1.0, mAcc, 0, top + 0.12, 0); for (const [x, z] of [[-0.3, 0.2], [0.25, -0.15], [0.05, 0.3]]) box(head, 0.14, 0.05, 0.14, mWhite, x, top + 0.27, z); }
  // feet
  const feet = [], mFeet = mat(M.accent);
  const fx = bw * 0.3, fzz = M.shape === 'tall' ? [0.05] : [bd * 0.28, -bd * 0.28];
  for (const z of fzz) for (const sx of [-1, 1]) { const f = new THREE.Group(); f.position.set(sx * fx, legH, z); rig.add(f); box(f, 0.24, legH + 0.04, 0.26, mFeet, 0, -legH / 2, 0.02); feet.push(f); }
  // tail
  const tail = new THREE.Group(); tail.position.set(0, bh * 0.35, -bd / 2); body.add(tail);
  switch (M.tail) {
    case 'fluff': box(tail, 0.32, 0.32, 0.32, mBelly, 0, 0.1, -0.12); box(tail, 0.2, 0.2, 0.2, mAcc, 0, 0.22, -0.26); break;
    case 'fin': box(tail, 0.08, 0.38, 0.42, mAcc, 0, 0.12, -0.2, 0.4); break;
    case 'flame': { const fm = mat('#ffcf4a', { emissive: '#ff8a2a', emissiveIntensity: 0.9 }); box(tail, 0.12, 0.12, 0.35, mBody, 0, 0.05, -0.15, 0.5); box(tail, 0.24, 0.3, 0.24, fm, 0, 0.28, -0.32); box(tail, 0.12, 0.2, 0.12, mat('#fff3b0', { emissive: '#ffd27a', emissiveIntensity: 1 }), 0, 0.46, -0.32); break; }
    case 'crystal': { const cm = mat(M.accent, { emissive: M.accent, emissiveIntensity: 0.6, roughness: 0.2 }); box(tail, 0.14, 0.42, 0.14, cm, 0, 0.18, -0.12, 0.5, 0.78); box(tail, 0.1, 0.28, 0.1, cm, 0.12, 0.1, -0.08, 0.3, 0.78, 0.4); break; }
    case 'leaf': box(tail, 0.06, 0.3, 0.38, mAcc, 0, 0.2, -0.18, 0.7); break;
  }
  // wings / shell
  const wings = [];
  if (M.wings) for (const sx of [-1, 1]) { const w = new THREE.Group(); w.position.set(sx * bw / 2, bh * 0.65, -0.05); body.add(w); box(w, 0.5, 0.06, 0.42, mAcc, sx * 0.25, 0, 0, 0, 0, sx * 0.25); box(w, 0.32, 0.05, 0.3, mBelly, sx * 0.4, 0.03, -0.05, 0, 0, sx * 0.25); wings.push(w); }
  if (M.shell) { box(body, bw * 0.95, bh * 0.55, bd * 0.75, mAcc, 0, bh * 0.75, -bd * 0.2); for (const x of [-0.25, 0, 0.25]) box(body, 0.06, bh * 0.4, bd * 0.7, mat('#ffffff'), x, bh * 0.98, -bd * 0.2); }
  // hat anchor on top of head
  const hatAnchor = new THREE.Group(); hatAnchor.position.set(0, top + (M.cap ? 0.3 : 0.02), 0); head.add(hatAnchor);
  if (hat) addHat(hatAnchor, hat);
  const s = (M.scale || 1) * scale; root.scale.setScalar(s);
  root.userData = { sp: spId, rig, body, head, tail, wings, feet, ears, hatAnchor, bodyMat: mBody, baseEmissive: mBody.emissive.clone(), baseEI: mBody.emissiveIntensity, phase: Math.random() * 6, height: (legH + bh + (hs ? 0.7 : 0)) * s };
  return root;
}
export function addHat(anchor, id) {
  anchor.clear(); if (!id || !HATS[id]) return;
  const H = HATS[id], m = mat(H.color), w = mat('#ffffff');
  switch (id) {
    case 'bobble': box(anchor, 0.6, 0.22, 0.6, m, 0, 0.1, 0); box(anchor, 0.64, 0.1, 0.64, w, 0, 0.02, 0); box(anchor, 0.18, 0.18, 0.18, w, 0, 0.3, 0); break;
    case 'bow': box(anchor, 0.22, 0.2, 0.08, m, -0.14, 0.08, 0.2, 0, 0, 0.3); box(anchor, 0.22, 0.2, 0.08, m, 0.14, 0.08, 0.2, 0, 0, -0.3); box(anchor, 0.1, 0.1, 0.1, mat('#ffd2f2'), 0, 0.08, 0.2); break;
    case 'leaf': box(anchor, 0.06, 0.3, 0.06, mat('#6b4423'), 0, 0.12, 0); for (let i = 0; i < 3; i++) box(anchor, 0.3 - i * 0.08, 0.1, 0.3 - i * 0.08, m, 0, 0.12 + i * 0.1, 0, 0, i * 0.5); break;
    case 'scarf': box(anchor, 0.86, 0.14, 0.78, m, 0, -0.42, 0); box(anchor, 0.16, 0.34, 0.06, m, 0.24, -0.6, 0.4); break;
    case 'crown': { const g = mat('#ffcf4a', { metalness: 0.5, roughness: 0.3, emissive: '#ffb02e', emissiveIntensity: 0.3 }); box(anchor, 0.5, 0.14, 0.5, g, 0, 0.07, 0); for (const [x, z] of [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]]) box(anchor, 0.1, 0.18, 0.1, g, x, 0.22, z); box(anchor, 0.1, 0.1, 0.1, mat('#8fd8ff', { emissive: '#8fd8ff', emissiveIntensity: 0.8 }), 0, 0.12, 0.26); break; }
  }
}
/** Idle/hop animation. moving: 0..1 */
export function animFrostling(g, t, moving = 0, dt = 0.016) {
  const u = g.userData, p = t * (5 + moving * 6) + u.phase;
  u.rig.position.y = Math.abs(Math.sin(p)) * (0.05 + moving * 0.22);
  u.body.scale.set(1 + Math.sin(p * 2) * 0.03, 1 - Math.sin(p * 2) * 0.03, 1);
  u.tail.rotation.y = Math.sin(t * 6 + u.phase) * 0.5;
  u.head.rotation.z = Math.sin(t * 1.3 + u.phase) * 0.08;
  u.wings.forEach((w, i) => { w.rotation.z = (i ? -1 : 1) * Math.sin(t * 14 + u.phase) * (0.3 + moving * 0.4); });
  u.feet.forEach((f, i) => { f.rotation.x = Math.sin(p + i * Math.PI) * moving * 0.6; });
  u.ears.forEach((e, i) => { e.rotation.x = Math.sin(t * 3 + i) * 0.08; });
  if (u.flashT > 0) { u.flashT -= dt; const k = Math.max(0, u.flashT / 0.25); u.bodyMat.emissive.setRGB(k, k, k); u.bodyMat.emissiveIntensity = Math.max(u.baseEI, k); if (u.flashT <= 0) { u.bodyMat.emissive.copy(u.baseEmissive); u.bodyMat.emissiveIntensity = u.baseEI; } }
}
export function flash(g) { g.userData.flashT = 0.25; }

/** Snare: glowing ice ring by tier. */
export function buildSnare(tier = 'snare') {
  const col = tier === 'aurorasnare' ? '#ff7ad9' : tier === 'frostsnare' ? '#4fa3ff' : '#bfe6ff';
  const g = new THREE.Group();
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.11, 8, 20), mat(col, { emissive: col, emissiveIntensity: 0.8, roughness: 0.2, unique: true }));
  g.add(ring); const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.2), mat('#ffffff', { emissive: col, emissiveIntensity: 1 })); g.add(core);
  g.userData = { ring, core }; return g;
}

/** Blocky tamer NPC (village folk + area bosses). */
export function buildTamer(color, { hat = '#ffffff', skin = '#ffd9b0', scale = 1 } = {}) {
  const g = new THREE.Group(), b = new THREE.Group(); g.add(b);
  const shirt = mat(color), pants = mat('#2d3a5a'), sk = mat(skin), dark = mat('#1a1530');
  const legs = [-0.22, 0.22].map(x => { const p = new THREE.Group(); p.position.set(x, 0.8, 0); box(p, 0.38, 0.8, 0.4, pants, 0, -0.4, 0); b.add(p); return p; });
  box(b, 0.9, 0.85, 0.5, shirt, 0, 1.22, 0);
  const arms = [-0.6, 0.6].map(x => { const a = new THREE.Group(); a.position.set(x, 1.6, 0); box(a, 0.3, 0.8, 0.32, shirt, 0, -0.38, 0); b.add(a); return a; });
  box(b, 0.62, 0.62, 0.62, sk, 0, 1.96, 0);
  box(b, 0.1, 0.12, 0.05, dark, -0.14, 2.0, 0.32); box(b, 0.1, 0.12, 0.05, dark, 0.14, 2.0, 0.32);
  box(b, 0.7, 0.2, 0.7, mat(hat), 0, 2.33, 0); box(b, 0.4, 0.2, 0.4, mat(hat), 0, 2.5, 0);
  box(b, 0.95, 0.16, 0.56, mat('#ffffff'), 0, 1.66, 0);
  g.scale.setScalar(scale); g.userData = { legs, arms, body: b }; return g;
}

/** Render every species to a dataURL portrait once (Frostdex / party / cards). Silhouettes via CSS brightness(0). */
export function renderPortraits(ids, size = 160) {
  const out = {};
  let r = null;
  try {
    r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    r.setSize(size, size, false); r.setPixelRatio(1); r.outputColorSpace = THREE.SRGBColorSpace;
    const sc = new THREE.Scene(); sc.add(new THREE.HemisphereLight('#ffffff', '#8fb3d6', 2.2)); const d = new THREE.DirectionalLight('#fff', 1.6); d.position.set(2, 4, 5); sc.add(d);
    const cam = new THREE.PerspectiveCamera(32, 1, 0.1, 50);
    for (const id of ids) {
      const m = buildFrostling(id); sc.add(m); m.rotation.y = 0.55;
      const h = m.userData.height, dist = 2.2 + h * 1.6; cam.position.set(0, h * 0.62 + 0.25, dist); cam.lookAt(0, h * 0.5, 0);
      r.render(sc, cam); out[id] = r.domElement.toDataURL('image/png'); sc.remove(m);
    }
  } catch (e) { console.warn('frostlings portraits', e); }
  finally { try { r?.dispose(); r?.forceContextLoss(); } catch { /* */ } }
  return out;
}
