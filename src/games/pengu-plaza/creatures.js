// Pengu Plaza BIG — low-poly wildlife + props builders (procedural, original). Each returns a THREE.Group
// with userData parts for animation. Materials are cached per colour so dozens of critters stay cheap.
import * as THREE from 'three';
const MATS = new Map();
export function mat(color, o = {}) { const k = color + JSON.stringify(o); if (!MATS.has(k)) MATS.set(k, new THREE.MeshStandardMaterial({ color, roughness: 0.7, ...o })); return MATS.get(k); }
export function disposeCreatureMats() { MATS.forEach(m => m.dispose()); MATS.clear(); GEO.forEach(g => g.dispose()); GEO.clear(); }
const GEO = new Map();
const geo = (k, f) => { if (!GEO.has(k)) GEO.set(k, f()); return GEO.get(k); };
const SPH = () => geo('s', () => new THREE.SphereGeometry(1, 14, 10));
const CONE = () => geo('c', () => new THREE.ConeGeometry(1, 1, 10));
const CYL = () => geo('y', () => new THREE.CylinderGeometry(1, 1, 1, 10));
const BOX = () => geo('b', () => new THREE.BoxGeometry(1, 1, 1));
function part(g, gm, m, x, y, z, sx, sy, sz, rx = 0, ry = 0, rz = 0) { const o = new THREE.Mesh(gm, m); o.position.set(x, y, z); o.scale.set(sx, sy, sz); o.rotation.set(rx, ry, rz); o.castShadow = true; g.add(o); return o; }
const EYE = () => mat('#101018', { roughness: 0.3 });

export function buildSeal(scale = 1, color = '#8f9cad') {
  const g = new THREE.Group(), m = mat(color), b = mat('#c9d3df');
  part(g, SPH(), m, 0, 0.45, 0, 0.55, 0.45, 1.1);
  const head = part(g, SPH(), m, 0, 0.85, 0.85, 0.38, 0.36, 0.4);
  part(g, SPH(), b, 0, 0.78, 1.18, 0.16, 0.12, 0.1);
  for (const s of [-1, 1]) { part(g, SPH(), EYE(), s * 0.15, 0.95, 1.13, 0.06, 0.07, 0.04); part(g, SPH(), m, s * 0.5, 0.25, 0.35, 0.12, 0.08, 0.35, 0, s * 0.5, 0); }
  const tail = part(g, SPH(), m, 0, 0.25, -1.1, 0.4, 0.08, 0.25);
  g.scale.setScalar(scale); g.userData = { head, tail }; return g;
}
export function buildPuffin(scale = 1) {
  const g = new THREE.Group(), k = mat('#1b1d26'), w = mat('#f4f4f0'), o = mat('#ff7a2a'), y = mat('#ffcf3a');
  part(g, SPH(), k, 0, 0.35, 0, 0.2, 0.3, 0.2); part(g, SPH(), w, 0, 0.33, 0.08, 0.15, 0.24, 0.14);
  const head = part(g, SPH(), k, 0, 0.7, 0.02, 0.15, 0.15, 0.15); part(g, SPH(), w, 0, 0.7, 0.09, 0.12, 0.1, 0.09);
  part(g, CONE(), o, 0, 0.68, 0.22, 0.07, 0.16, 0.09, Math.PI / 2, 0, 0); part(g, SPH(), y, 0, 0.73, 0.17, 0.04, 0.03, 0.03);
  for (const s of [-1, 1]) { part(g, SPH(), EYE(), s * 0.07, 0.74, 0.12, 0.025, 0.025, 0.02); part(g, SPH(), o, s * 0.07, 0.03, 0.05, 0.06, 0.02, 0.09); }
  const wings = [-1, 1].map(s => part(g, SPH(), k, s * 0.19, 0.4, -0.02, 0.05, 0.22, 0.14));
  g.scale.setScalar(scale); g.userData = { head, wings }; return g;
}
export function buildFox(scale = 1) {
  const g = new THREE.Group(), f = mat('#f5f7fb', { roughness: 0.9 }), d = mat('#20232e');
  part(g, SPH(), f, 0, 0.5, 0, 0.28, 0.28, 0.55);
  const head = new THREE.Group(); head.position.set(0, 0.75, 0.55); g.add(head);
  part(head, SPH(), f, 0, 0, 0, 0.22, 0.2, 0.22); part(head, CONE(), f, 0, -0.03, 0.22, 0.1, 0.22, 0.1, Math.PI / 2, 0, 0); part(head, SPH(), d, 0, -0.03, 0.34, 0.035, 0.03, 0.03);
  for (const s of [-1, 1]) { part(head, CONE(), f, s * 0.11, 0.2, -0.02, 0.07, 0.17, 0.05); part(head, SPH(), d, s * 0.08, 0.05, 0.17, 0.03, 0.035, 0.02); }
  const legs = [[-0.14, 0.32], [0.14, 0.32], [-0.14, -0.32], [0.14, -0.32]].map(([x, z]) => part(g, CYL(), f, x, 0.2, z, 0.05, 0.4, 0.05));
  const tail = part(g, SPH(), f, 0, 0.65, -0.72, 0.16, 0.16, 0.42, -0.5, 0, 0);
  g.scale.setScalar(scale); g.userData = { head, legs, tail }; return g;
}
export function buildHare(scale = 1) {
  const g = new THREE.Group(), f = mat('#fbfcff', { roughness: 0.95 }), p = mat('#ffb3c6');
  part(g, SPH(), f, 0, 0.28, 0, 0.22, 0.22, 0.3);
  const head = part(g, SPH(), f, 0, 0.5, 0.22, 0.15, 0.14, 0.15);
  for (const s of [-1, 1]) { part(g, SPH(), f, s * 0.06, 0.78, 0.18, 0.04, 0.17, 0.06, 0, 0, s * 0.15); part(g, SPH(), EYE(), s * 0.08, 0.54, 0.33, 0.025, 0.03, 0.02); }
  part(g, SPH(), p, 0, 0.47, 0.36, 0.025, 0.02, 0.02); part(g, SPH(), f, 0, 0.3, -0.3, 0.08, 0.08, 0.08);
  g.scale.setScalar(scale); g.userData = { head }; return g;
}
export function buildOwl(scale = 1) {
  const g = new THREE.Group(), w = mat('#fbfbff', { roughness: 0.9 }), s = mat('#2a2f3a'), y = mat('#ffd23a', { emissive: '#664400', emissiveIntensity: 0.5 });
  part(g, SPH(), w, 0, 0.35, 0, 0.26, 0.34, 0.24);
  for (let i = 0; i < 5; i++) part(g, SPH(), s, (i % 3 - 1) * 0.1, 0.25 + (i % 2) * 0.12, 0.2, 0.025, 0.02, 0.02);
  const head = new THREE.Group(); head.position.y = 0.72; g.add(head);
  part(head, SPH(), w, 0, 0, 0, 0.22, 0.19, 0.2);
  for (const k of [-1, 1]) { part(head, SPH(), y, k * 0.08, 0.02, 0.16, 0.055, 0.055, 0.03); part(head, SPH(), s, k * 0.08, 0.02, 0.185, 0.025, 0.025, 0.01); }
  part(head, CONE(), mat('#3a3a40'), 0, -0.05, 0.19, 0.025, 0.06, 0.025, Math.PI, 0, 0);
  const wings = [-1, 1].map(k => part(g, SPH(), w, k * 0.24, 0.38, -0.02, 0.06, 0.28, 0.18));
  g.scale.setScalar(scale); g.userData = { head, wings }; return g;
}
export function buildReindeer(scale = 1) {
  const g = new THREE.Group(), b = mat('#8a6446'), c = mat('#e9dcc8'), a = mat('#d9c6a0');
  part(g, SPH(), b, 0, 1.15, 0, 0.42, 0.42, 0.85); part(g, SPH(), c, 0, 1.25, 0.55, 0.3, 0.32, 0.3);
  const head = new THREE.Group(); head.position.set(0, 1.75, 0.85); g.add(head);
  part(head, SPH(), b, 0, 0, 0, 0.22, 0.22, 0.3); part(head, SPH(), mat('#2a1a14'), 0, -0.04, 0.3, 0.07, 0.06, 0.05);
  for (const s of [-1, 1]) { part(head, SPH(), EYE(), s * 0.13, 0.07, 0.15, 0.03, 0.035, 0.02); part(head, CYL(), a, s * 0.12, 0.35, -0.05, 0.03, 0.5, 0.03, 0, 0, s * 0.35); part(head, CYL(), a, s * 0.24, 0.55, 0.02, 0.025, 0.3, 0.025, 0.5, 0, s * 0.9); part(head, CYL(), a, s * 0.18, 0.5, -0.12, 0.022, 0.25, 0.022, -0.6, 0, s * 0.3); }
  const legs = [[-0.22, 0.45], [0.22, 0.45], [-0.22, -0.45], [0.22, -0.45]].map(([x, z]) => part(g, CYL(), b, x, 0.45, z, 0.07, 0.9, 0.07));
  g.scale.setScalar(scale); g.userData = { head, legs }; return g;
}
export function buildWhale() {
  const g = new THREE.Group(), b = mat('#3b4b66', { roughness: 0.4 }), w = mat('#d6dde8');
  part(g, SPH(), b, 0, 0, 0, 2.2, 2.0, 6.0); part(g, SPH(), w, 0, -0.8, 1.6, 1.7, 1.2, 4.0);
  for (const s of [-1, 1]) { part(g, SPH(), b, s * 2.6, -0.6, 1.8, 1.6, 0.18, 0.6, 0, s * 0.6, s * 0.4); part(g, SPH(), EYE(), s * 1.9, 0.2, 3.6, 0.2, 0.2, 0.2); }
  const tail = new THREE.Group(); tail.position.z = -6; g.add(tail);
  for (const s of [-1, 1]) part(tail, SPH(), b, s * 1.3, 0, -0.6, 1.6, 0.2, 0.7, 0, s * 0.4, 0);
  g.userData = { tail }; return g;
}
export function buildYeti(scale = 1) {
  const g = new THREE.Group(), f = mat('#e8f1ff', { roughness: 1 }), sk = mat('#8fb0d6'), d = mat('#18202e');
  part(g, SPH(), f, 0, 1.5, 0, 0.9, 1.25, 0.75); const head = part(g, SPH(), f, 0, 2.95, 0.1, 0.55, 0.5, 0.5);
  part(g, SPH(), sk, 0, 2.9, 0.48, 0.35, 0.3, 0.15);
  for (const s of [-1, 1]) { part(g, SPH(), d, s * 0.14, 3.0, 0.6, 0.06, 0.07, 0.03); part(g, SPH(), f, s * 1.0, 1.6, 0.1, 0.3, 0.9, 0.3, 0, 0, s * 0.2); part(g, SPH(), f, s * 0.4, 0.35, 0, 0.32, 0.45, 0.35); }
  g.scale.setScalar(scale); g.userData = { head }; return g;
}
export function buildMoth(color = '#9ff6ff') {
  return new THREE.Mesh(geo('moth', () => new THREE.SphereGeometry(0.09, 6, 4)), new THREE.MeshBasicMaterial({ color, toneMapped: false }));
}
export function buildBoat(color = '#e0435f') {
  const g = new THREE.Group(), h = mat(color), w = mat('#f3e7d3'), wood = mat('#8a5a3c');
  part(g, BOX(), h, 0, 0.5, 0, 2.2, 1, 6); part(g, BOX(), w, 0, 1.05, 0, 2.3, 0.12, 6.1);
  part(g, CONE(), h, 0, 0.5, 3.6, 1.1, 1.4, 0.5, Math.PI / 2, 0, 0);
  part(g, BOX(), w, 0, 1.6, -1, 1.6, 1.1, 1.8); part(g, CYL(), wood, 0, 3.2, 0.8, 0.07, 4, 0.07);
  const sail = part(g, BOX(), mat('#fff8ec'), 0, 3.4, 1.4, 0.04, 2.6, 1.2);
  g.userData = { sail }; return g;
}
