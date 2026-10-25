// Rimebound procedural kit (Three.js, no Blender): flat-shaded Batch primitives + Forsaken-like palette.
import * as THREE from 'three';
import { Batch, glowMaterial } from './blocks.js';
export function rimeKit() {
  const B = new Batch(), G = new Batch(), glow = glowMaterial();
  const std = (c, r = 0.9, m = 0) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m, flatShading: true });
  const M = { stone: std('#3a3f4a'), dark: std('#23262e'), rime: std('#a8c4d8', 0.55), snow: std('#c9d6e2'), ice: std('#6f93ad', 0.2),
    iron: std('#1d1f24', 0.6, 0.6), rust: std('#4a2e26', 0.8, 0.35), rustL: std('#6b4334', 0.8, 0.3), steel: std('#4b535e', 0.55, 0.7),
    wood: std('#3b2c22'), woodD: std('#271d17'), conc: std('#555b63'), tarp: std('#2f3b3a'), water: std('#05080d', 0.15, 0.3) };
  const GEO = { box: new THREE.BoxGeometry(1, 1, 1), cyl: new THREE.CylinderGeometry(1, 1, 1, 12), cyl6: new THREE.CylinderGeometry(1, 1, 1, 6),
    cone: new THREE.ConeGeometry(1, 1, 6), ico: new THREE.IcosahedronGeometry(1, 0) };
  const k = { B, G, M, GEO, COLLIDERS: [], LANTERNS: [],
    box(m, x, y, z, w, h, d, ry = 0, solid = false) { B.box(M[m], x, y, z, w, h, d, 0xffffff, ry ? [0, ry, 0] : null);
      if (solid) { const c = Math.abs(Math.cos(ry)), s = Math.abs(Math.sin(ry)), hw = (w * c + d * s) / 2, hd = (w * s + d * c) / 2; k.COLLIDERS.push([x - hw, y - h / 2, z - hd, x + hw, y + h / 2, z + hd]); } },
    solid(x, y, z, w, h, d, ry = 0) { const c = Math.abs(Math.cos(ry)), s = Math.abs(Math.sin(ry)), hw = (w * c + d * s) / 2, hd = (w * s + d * c) / 2; k.COLLIDERS.push([x - hw, y - h / 2, z - hd, x + hw, y + h / 2, z + hd]); },
    rot(m, x, y, z, w, h, d, rot) { B.box(M[m], x, y, z, w, h, d, 0xffffff, rot); },
    cyl(m, x, y, z, r, h, solid = false, geo = 'cyl') { B.add(M[m], GEO[geo], x, y, z, r, h, r); if (solid) k.COLLIDERS.push([x - r, y - h / 2, z - r, x + r, y + h / 2, z + r]); },
    cone(m, x, y, z, r, h, rx = 0) { B.add(M[m], GEO.cone, x, y, z, r, h, r, 0xffffff, rx ? [rx, 0, 0] : null); },
    rock(m, x, y, z, s, R) { B.add(M[m], GEO.ico, x, y, z, s * (0.8 + R() * 0.5), s * (0.5 + R() * 0.4), s * (0.8 + R() * 0.5), 0xffffff, [0, R() * 6, 0]); },
    beam(m, a, b, t = 0.3) { const A = new THREE.Vector3(...a), Bv = new THREE.Vector3(...b), d = Bv.clone().sub(A), L = d.length();
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()), e = new THREE.Euler().setFromQuaternion(q);
      B.box(M[m], (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2, t, L, t, 0xffffff, [e.x, e.y, e.z]); },
    glowBox(c, x, y, z, w, h, d, s = 4) { const col = new THREE.Color(c).multiplyScalar(s); G.box(glow, x, y, z, w, h, d, [col.r, col.g, col.b]); },
    lantern(x, y, z, kk = 1, c = '#ffa24a') { k.box('iron', x, y + 0.42, z, 0.5, 0.06, 0.5); k.box('iron', x, y - 0.42, z, 0.44, 0.06, 0.44);
      for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) k.box('iron', x + dx * 0.2, y, z + dz * 0.2, 0.05, 0.8, 0.05);
      k.glowBox('#ff9a3c', x, y, z, 0.3, 0.55, 0.3, 5); k.LANTERNS.push([x, y, z, kk, c]); },
    post(x, z, g = 0, h = 3.2) { k.cyl('iron', x, g + h / 2, z, 0.09, h, true, 'cyl6'); k.box('iron', x + 0.35, g + h, z, 0.8, 0.08, 0.08); k.lantern(x + 0.7, g + h - 0.55, z); },
    icicles(x0, x1, y, z, n, R) { for (let i = 0; i < n; i++) { const L = 0.3 + R() * 1.3; k.cone('rime', x0 + (x1 - x0) * (i + R() * 0.6) / n, y - L / 2, z, 0.1, L, Math.PI); } },
    build(scene) { B.build(scene); G.build(scene, { cast: false, receive: false }); },
  };
  return k;
}
