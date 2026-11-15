// Pengu Plaza BIG — the world around the plaza: six new areas joined by paths, a bridge, a sled lift and a cave
// mouth. Static decor is instanced (set/lib/blocks.js Batch); critters + locals are small groups animated in update().
// Every coordinate comes from ./set/areas.js. Photo targets register here with live positions (see targets.js).
import * as THREE from 'three';
import { Batch, glowMaterial, rng } from './set/lib/blocks.js';
import * as A from './set/areas.js';
import { buildPenguin } from './plaza.js';
import { buildSeal, buildPuffin, buildFox, buildHare, buildOwl, buildReindeer, buildWhale, buildYeti, buildMoth, buildBoat, mat, disposeCreatureMats } from './creatures.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
function canvasTex(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; }
const signTex = (text, bg = '#2b4a7a') => canvasTex(512, 128, (g, w, h) => { g.fillStyle = bg; g.beginPath(); g.roundRect(4, 4, w - 8, h - 8, 26); g.fill(); g.strokeStyle = '#bfe8ff'; g.lineWidth = 7; g.stroke(); g.fillStyle = '#fff3d6'; g.font = '900 50px system-ui,sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, w / 2, h / 2 + 3); });
const segDist = (px, pz, ax, az, bx, bz) => { const dx = bx - ax, dz = bz - az, l = dx * dx + dz * dz; let t = l ? ((px - ax) * dx + (pz - az) * dz) / l : 0; t = Math.max(0, Math.min(1, t)); return Math.hypot(px - ax - dx * t, pz - az - dz * t); };
export const nearPath = (x, z, pad = 0) => A.PATHS.some(p => p.pts.some((q, i) => i > 0 && segDist(x, z, p.pts[i - 1][0], p.pts[i - 1][1], q[0], q[1]) < p.w / 2 + pad));
export function areaAt(x, z, y = 0) {
  for (const a of A.AREAS_BIG) if (Math.hypot(x - a.x, z - a.z) < a.r) return a;
  return null;
}

// Spatially chunked instancing: one Batch per 48 m cell so each InstancedMesh gets a tight bounding sphere and
// frustum / shadow-camera culling can skip far-away areas (a single world-wide batch is never culled).
class ChunkBatch {
  constructor(size = 48) { this.size = size; this.cells = new Map(); }
  _b(x, z) { const k = Math.floor(x / this.size) + ',' + Math.floor(z / this.size); let b = this.cells.get(k); if (!b) this.cells.set(k, b = new Batch()); return b; }
  box(mat, x, y, z, ...r) { return this._b(x, z).box(mat, x, y, z, ...r); }
  add(mat, geo, x, y, z, ...r) { return this._b(x, z).add(mat, geo, x, y, z, ...r); }
  build(parent, o) { for (const b of this.cells.values()) b.build(parent, o); }
}
export function buildWorld(scene, { mobile = false, fx = null, audio = null } = {}) {
  const R = rng(4242), B = new ChunkBatch(), G = new ChunkBatch(), disp = [], colliders = [], occluders = [], targets = {}, actors = [], lights = [];
  const box = new THREE.BoxGeometry(1, 1, 1), cyl = new THREE.CylinderGeometry(1, 1, 1, 12), cone = new THREE.ConeGeometry(1, 1, 10), sph = new THREE.SphereGeometry(1, 14, 10), oct = new THREE.OctahedronGeometry(1, 0), dode = new THREE.DodecahedronGeometry(1, 0), half = new THREE.SphereGeometry(1, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2);
  disp.push(box, cyl, cone, sph, oct, dode, half);
  const std = (o) => { const m = new THREE.MeshStandardMaterial({ color: '#ffffff', ...o }); disp.push(m); return m; };
  const M = { matte: std({ roughness: 0.95 }), semi: std({ roughness: 0.6 }), wood: std({ roughness: 0.85 }), metal: std({ roughness: 0.35, metalness: 0.6 }), ice: std({ roughness: 0.08, metalness: 0.15, transparent: true, opacity: 0.82 }), rock: std({ roughness: 0.9, flatShading: true }) };
  const glow = glowMaterial(); disp.push(glow);
  const add = (m) => { scene.add(m); return m; };
  const mesh = (g, m, x, y, z) => { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); o.castShadow = o.receiveShadow = true; return add(o); };
  const sign = (text, x, y, z, ry, bg, w = 4.4) => { const t = signTex(text, bg), m = new THREE.MeshBasicMaterial({ map: t, transparent: true, side: THREE.DoubleSide }), g = new THREE.PlaneGeometry(w, w / 4); disp.push(t, m, g); const o = new THREE.Mesh(g, m); o.position.set(x, y, z); o.rotation.y = ry; add(o); B.add(M.wood, cyl, x, y / 2, z, 0.08, y, 0.08, '#6b4a2b'); return o; };
  const target = (id, pts, o = {}) => { targets[id] = { pts: [].concat(pts), active: o.active || (() => true), bonus: o.bonus || (() => false), maxDist: o.maxDist ?? 40, yOff: o.yOff ?? 0, area: o.area || null, sky: !!o.sky }; return targets[id]; };
  const pine = (x, z, s = 1, y = 0, col = true) => {
    B.add(M.wood, cyl, x, y + 0.7 * s, z, 0.28 * s, 1.4 * s, 0.28 * s, '#5a3a22');
    for (let k = 0; k < 3; k++) { B.add(M.matte, cone, x, y + (2 + k * 1.2) * s, z, (2 - k * 0.5) * s, 2 * s, (2 - k * 0.5) * s, k % 2 ? '#1f5a4e' : '#235f52'); B.add(M.matte, cone, x, y + (2.7 + k * 1.2) * s, z, (1.2 - k * 0.3) * s, 0.6 * s, (1.2 - k * 0.3) * s, '#f4f8ff'); }
    if (col) colliders.push(['circle', x, z, 0.45 * s + 0.2, y + 5 * s]);
  };
  const rock = (x, y, z, s, c = '#6f7f99') => B.add(M.rock, dode, x, y, z, s, s * (0.6 + R() * 0.5), s, c, [R() * 3, R() * 3, 0]);
  const pengu = (x, z, o = {}) => { const m = buildPenguin({ scarf: o.scarf || ['#ff5f7e', '#5fd0ff', '#ffd36b', '#7fffc8', '#c79bff', '#ff9a3c'][(R() * 6) | 0], hat: o.hat, body: o.body }); m.position.set(x, o.y || 0, z); m.rotation.y = o.face ?? R() * 6; m.scale.setScalar(o.s || 0.85); add(m); return m; };
  const wanderer = (x, z, r = 4, area) => { const m = pengu(x, z); const a = { m, kind: 'wander', home: [x, z], r, tx: x, tz: z, wait: R() * 4, ph: R() * 6, area }; actors.push(a); return a; };

  // ---------- ground extension, distant mountains, scattered pines ----------
  { const g = new THREE.RingGeometry(118, 270, 64, 1), m = std({ color: '#e6efff', roughness: 1 }); disp.push(g); const o = new THREE.Mesh(g, m); o.rotation.x = -Math.PI / 2; o.position.y = -0.01; o.receiveShadow = true; add(o); }
  for (let i = 0; i < 46; i++) { const a = i / 46 * Math.PI * 2 + R() * 0.08; if (Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) < 0.55) continue; const r = 170 + R() * 60, s = 30 + R() * 34; B.add(M.rock, cone, Math.cos(a) * r, s * 0.45, Math.sin(a) * r, s * 0.9, s, s * 0.9, '#7488ad'); B.add(M.matte, cone, Math.cos(a) * r, s * 0.82, Math.sin(a) * r, s * 0.42, s * 0.28, s * 0.42, '#f2f7ff'); }
  const inArea = (x, z, pad) => A.AREAS_BIG.some(a => Math.hypot(x - a.x, z - a.z) < a.r + pad) || Math.hypot(x, z) < 44 || (x > A.HARBOR.shoreX - 4 && Math.abs(z) < 140) || (x > -20 && x < 26 && z > 60 && z < 104);
  for (let i = 0; i < 170; i++) { const a = R() * Math.PI * 2, r = 46 + R() * 76, x = Math.cos(a) * r, z = Math.sin(a) * r; if (inArea(x, z, 3) || nearPath(x, z, 3)) continue; pine(x, z, 0.8 + R() * 0.7); }

  // ---------- paths + lantern posts + plaza exit signs ----------
  for (const p of A.PATHS) for (let i = 1; i < p.pts.length; i++) {
    const [ax, az] = p.pts[i - 1], [bx, bz] = p.pts[i], len = Math.hypot(bx - ax, bz - az), ang = Math.atan2(bx - ax, bz - az);
    B.box(M.matte, (ax + bx) / 2, 0.02, (az + bz) / 2, p.w, 0.04, len + p.w * 0.6, '#cbd8ee', [0, ang, 0]);
    for (let d = 6; d < len; d += 9) { const k = d / len, x = ax + (bx - ax) * k, z = az + (bz - az) * k, ox = Math.cos(ang) * (p.w / 2 + 0.6), oz = -Math.sin(ang) * (p.w / 2 + 0.6), sd = (d / 9) % 2 < 1 ? 1 : -1;
      B.add(M.metal, cyl, x + ox * sd, 1.1, z + oz * sd, 0.06, 2.2, 0.06, '#33405a'); G.add(glow, sph, x + ox * sd, 2.3, z + oz * sd, 0.2, 0.2, 0.2, '#ffcf8a'); }
  }
  const signs = [];
  for (const e of A.PLAZA_EXITS) { const r = 30.5, x = Math.cos(e.a) * r + Math.cos(e.a + Math.PI / 2) * 3.6, z = Math.sin(e.a) * r + Math.sin(e.a + Math.PI / 2) * 3.6; if (e.to === 'ridge') continue; signs.push(sign(`${e.icon} ${e.label} →`, x, 2.6, z, Math.atan2(Math.cos(e.a), Math.sin(e.a)) + Math.PI, '#2b4a7a', 4.6)); colliders.push(['circle', x, z, 0.2, 3]); }
  sign('🌌 Aurora Ridge ↑', 4.5, 2.6, 40, Math.PI, '#3b2d7a', 4.6);

  // =====================================================================================
  // AURORA RIDGE — plateau, stairs, sled lift, telescope, cairn, snow angel, aurora sky
  // =====================================================================================
  const RG = A.RIDGE, pl = RG.plateau;
  { const cx = (pl.minX + pl.maxX) / 2, cz = (pl.minZ + pl.maxZ) / 2, w = pl.maxX - pl.minX, d = pl.maxZ - pl.minZ;
    B.box(M.rock, cx, pl.top / 2 - 0.05, cz, w, pl.top - 0.1, d, '#7184a6'); B.box(M.matte, cx, pl.top - 0.05, cz, w + 0.3, 0.12, d + 0.3, '#f4f8ff');
    colliders.push(['box', pl.minX, 0, pl.minZ, pl.maxX, pl.top, pl.maxZ]);
    // lift top deck (east of plateau)
    B.box(M.rock, 21.25, pl.top / 2, 89.5, 6.5, pl.top, 11, '#6d80a3'); B.box(M.matte, 21.25, pl.top - 0.05, 89.5, 6.8, 0.12, 11.3, '#f4f8ff'); colliders.push(['box', 18, 0, 84, 24.5, pl.top, 95]);
    for (let i = 0; i < 40; i++) { const side = i % 4, t = R(); const x = side === 0 ? pl.minX - 0.6 : side === 1 ? pl.maxX + 0.6 : pl.minX + t * w, z = side < 2 ? pl.minZ + t * d : side === 2 ? pl.maxZ + 0.6 : pl.minZ - 0.6; if (side === 3 && Math.abs(x) < 4.5) continue; if (side === 1 && z > 83 && z < 96) continue; rock(x, R() * pl.top * 0.8, z, 1 + R() * 1.6); }
    for (const [x, z] of [[-15, 99], [-15, 81], [15, 100], [-8, 100.5]]) pine(x, z, 0.8, pl.top);
    for (let i = 0; i < 8; i++) B.add(M.matte, sph, -14 + R() * 28, pl.top, 80 + R() * 20, 1.2 + R(), 0.4, 1 + R(), '#f6f9ff'); }
  { const s = RG.stairs; for (let i = 0; i < s.steps; i++) { const top = (i + 1) * s.rise, z0 = s.z0 + i; B.box(M.semi, s.x, top / 2, z0 + 0.5, s.w, top, s.depth, i % 2 ? '#e3ecfa' : '#d4e1f5'); colliders.push(['box', s.x - s.w / 2, 0, z0, s.x + s.w / 2, top, z0 + s.depth]);
      for (const sd of [-1, 1]) { B.box(M.rock, s.x + sd * (s.w / 2 + 0.5), top / 2 + 0.4, z0 + 0.5, 1, top + 0.8, 1.02, '#7a8db0'); colliders.push(['box', s.x + sd * (s.w / 2 + 0.5) - 0.5, 0, z0, s.x + sd * (s.w / 2 + 0.5) + 0.5, top + 0.8, z0 + 1]); if (i % 3 === 1) G.add(glow, sph, s.x + sd * (s.w / 2 + 0.5), top + 1.05, z0 + 0.5, 0.18, 0.18, 0.18, '#9fd8ff'); } } }
  // sled lift: stations, pylons, cable, moving chairs
  const L = RG.lift, liftY = (k) => L.top.y * Math.pow(Math.sin(Math.min(1, k) * Math.PI / 2), 0.7);
  const liftPos = (k, out = new THREE.Vector3()) => out.set(L.base.x, liftY(k), L.base.z + (L.top.z - L.base.z) * k);
  for (const [x, y, z] of [[L.base.x, 0, L.base.z], [L.top.x, L.top.y - 1, L.top.z]]) { B.box(M.wood, x, y + 1.6, z, 3.4, 3.2, 3, '#9a5f36'); B.add(M.semi, cone, x, y + 4, z, 3, 1.4, 3, '#e0435f', [0, Math.PI / 4, 0]); G.box(glow, x, y + 2.2, z + (z === L.base.z ? -1.55 : 1.55), 1.6, 0.6, 0.05, '#ffcf8a'); }
  colliders.push(['box', L.base.x - 1.7, 0, L.base.z - 1.5, L.base.x + 1.7, 3.2, L.base.z + 1.5]);
  for (let k = 0.2; k < 0.95; k += 0.25) { const p = liftPos(k); B.add(M.metal, cyl, p.x + 1.2, (p.y + 3.4) / 2, p.z, 0.15, p.y + 3.4, 0.15, '#5a6a88'); B.box(M.metal, p.x + 0.4, p.y + 3.4, p.z, 2, 0.15, 0.2, '#5a6a88'); }
  { const pts = []; for (let i = 0; i <= 24; i++) { const p = liftPos(i / 24); pts.push(new THREE.Vector3(p.x, p.y + 3.3, p.z)); } const g = new THREE.BufferGeometry().setFromPoints(pts), m = new THREE.LineBasicMaterial({ color: '#2b2f45' }); disp.push(g, m); add(new THREE.Line(g, m)); }
  const chairMat = mat('#e0435f'), chairs = [];
  const mkChair = () => { const c = new THREE.Group(); const s = new THREE.Mesh(box, chairMat); s.scale.set(1.3, 0.12, 0.8); c.add(s); const bk = new THREE.Mesh(box, chairMat); bk.scale.set(1.3, 0.8, 0.1); bk.position.set(0, 0.4, -0.4); c.add(bk); const bar = new THREE.Mesh(cyl, mat('#5a6a88')); bar.scale.set(0.04, 2.4, 0.04); bar.position.y = 1.4; c.add(bar); add(c); return c; };
  for (let i = 0; i < 4; i++) chairs.push(mkChair());
  const rideChair = mkChair(); rideChair.visible = false;
  sign('🚡 Sled Lift', L.base.x - 3.4, 2.8, L.base.z + 1, Math.PI, '#7a2b3b', 3.6);
  target('lift', [V(L.base.x, 3, L.base.z + 6)], { yOff: 0, maxDist: 45 });
  // telescope + cairn + flag
  { const t = RG.telescope, y = pl.top; B.add(M.metal, cyl, t.x, y + 0.7, t.z, 0.08, 1.4, 0.08, '#3a4560'); B.add(M.metal, cyl, t.x, y + 1.5, t.z + 0.3, 0.16, 1.2, 0.16, '#c9a24a', [1.2, 0, 0]); colliders.push(['circle', t.x, t.z, 0.4, y + 2]);
    const c = RG.cairn; for (let i = 0; i < 5; i++) B.add(M.rock, dode, c.x, y + 0.3 + i * 0.45, c.z, 0.8 - i * 0.12, 0.35, 0.7 - i * 0.1, ['#8d9ab3', '#a3acc0', '#7b879f'][i % 3], [0, i, 0]); colliders.push(['circle', c.x, c.z, 0.8, y + 2.5]);
    target('cairn', [V(c.x, y + 1.2, c.z)], { maxDist: 30 });
    const f = RG.flag; B.add(M.metal, cyl, f.x, y + 2, f.z, 0.06, 4, 0.06, '#dfe8f5'); colliders.push(['circle', f.x, f.z, 0.2, y + 4]); }
  const flag = (() => { const g = new THREE.PlaneGeometry(1.6, 1, 8, 1), m = new THREE.MeshStandardMaterial({ color: '#ff6f91', side: THREE.DoubleSide }); disp.push(g, m); const o = new THREE.Mesh(g, m); o.position.set(RG.flag.x + 0.8, pl.top + 3.4, RG.flag.z); return add(o); })();
  const angel = pengu(RG.snowAngel.x, RG.snowAngel.z, { y: pl.top + 0.35, scarf: '#ffd36b', s: 0.8 }); angel.rotation.set(-Math.PI / 2, 0, 0); angel.position.z -= 0.6;
  { const g = new THREE.CircleGeometry(1.4, 20), m = new THREE.MeshBasicMaterial({ color: '#cfe0ff', transparent: true, opacity: 0.6 }); disp.push(g, m); const o = new THREE.Mesh(g, m); o.rotation.x = -Math.PI / 2; o.position.set(RG.snowAngel.x, pl.top + 0.03, RG.snowAngel.z - 0.6); o.scale.set(1.2, 0.9, 1); add(o); }
  target('snow_angel', [V(RG.snowAngel.x, pl.top + 0.4, RG.snowAngel.z - 0.6)], { maxDist: 26, bonus: () => Math.sin(angelT * 5) > 0.6 });
  let angelT = 0;
  // aurora curtains (shader planes, night only) + shooting star
  const auroraMat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false, uniforms: { uT: { value: 0 }, uK: { value: 0 } },
    vertexShader: 'varying vec2 vUv; uniform float uT; void main(){ vUv = uv; vec3 p = position; p.z += sin(p.x * 0.02 + uT * 0.3) * 18.0; p.y += sin(p.x * 0.05 + uT * 0.5) * 4.0; gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0); }',
    fragmentShader: 'varying vec2 vUv; uniform float uT, uK; void main(){ float r = 0.55 + 0.45 * sin(vUv.x * 60.0 + uT * 1.3) * sin(vUv.x * 23.0 - uT * 0.7); float v = smoothstep(0.0, 0.25, vUv.y) * (1.0 - smoothstep(0.35, 1.0, vUv.y)); vec3 c = mix(vec3(0.15, 1.0, 0.6), vec3(0.6, 0.35, 1.0), vUv.y * 1.2 + 0.2 * sin(vUv.x * 9.0 + uT * 0.2)); gl_FragColor = vec4(c * r * v * uK * 0.9, 1.0); }' });
  disp.push(auroraMat); const auroras = [];
  for (let i = 0; i < 3; i++) { const g = new THREE.PlaneGeometry(320, 70, 64, 1); disp.push(g); const o = new THREE.Mesh(g, auroraMat); o.position.set(-30 + i * 40, 75 + i * 10, A.RIDGE.aurora.z - i * 25); o.rotation.y = (i - 1) * 0.25; o.renderOrder = 2; o.frustumCulled = false; o.visible = false; add(o); auroras.push(o); }
  target('aurora', [V(A.RIDGE.aurora.x, A.RIDGE.aurora.y, A.RIDGE.aurora.z)], { sky: true, active: () => ev.night > 0.6, bonus: () => playerY > 5 });
  const star = (() => { const g = new THREE.CylinderGeometry(0.0, 0.9, 26, 6, 1, true), m = new THREE.MeshBasicMaterial({ color: '#fff6c8', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }); g.rotateZ(Math.PI / 2); disp.push(g, m); const o = new THREE.Mesh(g, m); o.frustumCulled = false; o.renderOrder = 3; return add(o); })();
  const starHead = new THREE.Vector3(); let starLast = -1;
  target('shooting_star', [starHead], { sky: true, active: () => ev.star.active && ev.star.k > 0.05 && ev.star.k < 0.9 });

  // =====================================================================================
  // FROZEN HARBOR — water, pier, lighthouse, market, boats, seals, puffins, fisher, whale
  // =====================================================================================
  const H = A.HARBOR, waterY = 0.03;
  const water = (() => { const g = new THREE.PlaneGeometry(240, 520, 40, 60), m = new THREE.MeshStandardMaterial({ color: '#1f4f86', roughness: 0.15, metalness: 0.35, transparent: true, opacity: 0.94 }); g.rotateX(-Math.PI / 2); disp.push(g, m); const o = new THREE.Mesh(g, m); o.position.set(H.shoreX + 120, waterY, 0); o.receiveShadow = true; return add(o); })();
  const wPos = water.geometry.attributes.position, wBase = Float32Array.from(wPos.array);
  colliders.push(['box', H.shoreX, -1, -300, 400, 20, -H.pier.hw], ['box', H.shoreX, -1, H.pier.hw, 400, 20, 300], ['box', H.pier.x1 + 0.4, -1, -H.pier.hw, 400, 20, H.pier.hw]);
  for (let z = -60; z <= 60; z += 2.6) { if (Math.abs(z) < H.pier.hw + 1.5) continue; rock(H.shoreX + 0.5 + R(), 0.1, z + R(), 0.8 + R() * 1.1, '#6b7a94'); if (R() < 0.4) B.add(M.matte, sph, H.shoreX - 1.5, 0, z, 1.6, 0.5, 1.3, '#f4f8ff'); }
  { const p = H.pier, n = Math.round((p.x1 - p.x0) / 0.9); for (let i = 0; i < n; i++) B.box(M.wood, p.x0 + 0.45 + i * 0.9, 0.12, 0, 0.82, 0.16, p.hw * 2, i % 3 ? '#a8774e' : '#94663f');
    for (let x = p.x0 + 1; x <= p.x1; x += 4) for (const sd of [-1, 1]) { B.add(M.wood, cyl, x, 0.3, sd * (p.hw + 0.1), 0.16, 1.6, 0.16, '#6b4a2b'); if ((x - p.x0) % 8 < 4) { B.add(M.metal, cyl, x, 1.4, sd * (p.hw + 0.1), 0.05, 2, 0.05, '#33405a'); G.add(glow, sph, x, 2.5, sd * (p.hw + 0.1), 0.2, 0.2, 0.2, '#ffcf8a'); } }
    for (const sd of [-1, 1]) B.box(M.wood, (p.x0 + p.x1) / 2, 0.8, sd * (p.hw + 0.1), p.x1 - p.x0, 0.08, 0.08, '#7b5536'); }
  // lighthouse
  const LH = H.lighthouse;
  { rock(LH.x, 0.2, LH.z, 3.4, '#6b7a94'); rock(LH.x + 2.5, 0.1, LH.z + 1, 2, '#74839b'); for (let i = 0; i < 6; i++) B.add(M.semi, cyl, LH.x, 1.6 + i * 1.5, LH.z, 1.9 - i * 0.14, 1.5, 1.9 - i * 0.14, i % 2 ? '#ffffff' : '#e0435f');
    B.add(M.metal, cyl, LH.x, 10.7, LH.z, 1.4, 0.2, 1.4, '#2b2f45'); B.add(M.ice, cyl, LH.x, 11.5, LH.z, 0.85, 1.4, 0.85, '#fff6d0'); B.add(M.semi, cone, LH.x, 12.8, LH.z, 1.2, 1.2, 1.2, '#e0435f'); colliders.push(['circle', LH.x, LH.z, 2.3, 14]); }
  const lamp = mesh(sph, new THREE.MeshBasicMaterial({ color: '#fff2b0', toneMapped: false }), LH.x, 11.5, LH.z); lamp.scale.setScalar(0.55); disp.push(lamp.material);
  const beam = (() => { const g = new THREE.ConeGeometry(4, 40, 20, 1, true), m = new THREE.MeshBasicMaterial({ color: '#fff3c0', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }); g.translate(0, -20, 0); g.rotateZ(Math.PI / 2); disp.push(g, m); const o = new THREE.Mesh(g, m); o.position.set(LH.x, 11.5, LH.z); o.renderOrder = 2; return add(o); })();
  target('lighthouse', [V(LH.x, 6.5, LH.z)], { maxDist: 70 });
  target('lighthouse_beam', [V(LH.x, 11.5, LH.z)], { maxDist: 90, active: () => ev.night > 0.5 });
  sign('⚓ Frozen Harbor', 64, 2.8, -4.2, -Math.PI / 2, '#1f4f86', 4.4);
  // fish market
  const FM = H.market;
  { B.box(M.wood, FM.x, 0.55, FM.z, 4.4, 1.1, 1.8, '#8a5a3c'); for (const dx of [-2, 2]) B.add(M.wood, cyl, FM.x + dx, 1.6, FM.z - 0.7, 0.08, 3.2, 0.08, '#6b4a2b'); for (let i = 0; i < 7; i++) B.box(M.semi, FM.x - 2.1 + i * 0.7 + 0.35, 3.25, FM.z, 0.7, 0.1, 2.4, i % 2 ? '#ffffff' : '#2f8fd6', [0.22, 0, 0]);
    for (let i = 0; i < 9; i++) B.add(M.semi, sph, FM.x - 1.6 + (i % 5) * 0.8, 1.22, FM.z + 0.2 + ((i / 5) | 0) * 0.4, 0.3, 0.1, 0.12, ['#8fb7d6', '#ff9a7a', '#c0c8d6'][i % 3], [0, 0.3 * (i % 3), 0]);
    for (let i = 0; i < 3; i++) B.box(M.wood, FM.x + 3 + (i % 2) * 0.9, 0.35 + ((i / 2) | 0) * 0.7, FM.z + 0.4, 0.8, 0.7, 0.8, '#a8774e'); colliders.push(['box', FM.x - 2.3, 0, FM.z - 1, FM.x + 3.8, 1.3, FM.z + 1]);
    const fs = signTex('🐟 Fresh Fish', '#1f4f86'), fm = new THREE.MeshBasicMaterial({ map: fs, transparent: true }), fg = new THREE.PlaneGeometry(3, 0.75); disp.push(fs, fm, fg); const so = new THREE.Mesh(fg, fm); so.position.set(FM.x, 3.9, FM.z + 1.25); add(so);
    pengu(FM.x, FM.z - 1.6, { face: 0, scarf: '#2f8fd6', hat: '#ffffff', s: 0.8 }); colliders.push(['circle', FM.x, FM.z - 1.6, 0.6, 2]); }
  target('fish_market', [V(FM.x, 1.8, FM.z)], { maxDist: 35 });
  // boats, floes, seals, puffins
  const boats = H.boats.map((b, i) => { const o = buildBoat(['#e0435f', '#2f8fd6', '#ffb02e'][i % 3]); o.position.set(b.x, 0, b.z); o.rotation.y = b.rot + Math.PI / 2; add(o); return { o, b, ph: i * 2 }; });
  target('boats', boats.slice(0, 2).map(b => b.o.position), { yOff: 1.2, maxDist: 40 });
  const floe = (x, z, r) => { B.add(M.semi, cyl, x, 0.05, z, r, 0.4, r * 0.8, '#eaf6ff'); };
  floe(H.seal.x, H.seal.z, 2.6); floe(H.sealPup.x, H.sealPup.z, 1.8); floe(H.seal.x + 7, H.seal.z - 4, 1.6); floe(118, -2, 2.2);
  const seal = buildSeal(1.0); seal.position.set(H.seal.x, 0.25, H.seal.z); seal.rotation.y = 2.4; add(seal);
  const pup = buildSeal(0.55, '#d2dae6'); pup.position.set(H.sealPup.x, 0.25, H.sealPup.z); pup.rotation.y = -0.8; add(pup);
  target('seal', [seal.position], { yOff: 0.6, maxDist: 38 }); target('seal_pup', [pup.position], { yOff: 0.35, maxDist: 45 });
  { const p = H.puffinRock; rock(p.x, 0.4, p.z, 2.4, '#5d6a80'); rock(p.x + 1.8, 0.2, p.z - 1, 1.4, '#66748c'); }
  const puffins = [[-0.6, 0.4], [0.5, -0.3], [0.1, 0.9], [1.6, -0.8]].map(([dx, dz], i) => { const o = buildPuffin(1.1); o.position.set(H.puffinRock.x + dx, i === 3 ? 1.5 : 2.1, H.puffinRock.z + dz); o.rotation.y = -1.6 + R(); add(o); return o; });
  target('puffins', [V(H.puffinRock.x, 2.4, H.puffinRock.z)], { maxDist: 40 });
  // fisher
  const fisher = pengu(H.fisher.x, H.fisher.z, { face: Math.PI / 2, scarf: '#ffb02e', hat: '#2f8fd6', s: 0.85 }); colliders.push(['circle', H.fisher.x, H.fisher.z, 0.5, 2]);
  const rod = new THREE.Group(); rod.position.set(H.fisher.x + 0.4, 1.0, H.fisher.z); add(rod); { const r = new THREE.Mesh(cyl, mat('#6b4a2b')); r.scale.set(0.03, 2.6, 0.03); r.position.set(1.1, 0.6, 0); r.rotation.z = -1.1; rod.add(r); }
  const fish = mesh(sph, mat('#8fb7d6', { metalness: 0.4, roughness: 0.3 }), H.fisher.x + 3, -1, H.fisher.z); fish.scale.set(0.3, 0.14, 0.12);
  let fishT = 6;
  target('fisher', [fisher.position], { yOff: 0.9, maxDist: 30, bonus: () => fishT < 0 && fishT > -2.6 });
  // whale
  const whale = buildWhale(); whale.position.set(H.whale.x, -12, H.whale.z); add(whale);   // side-on to the pier: breaches along z
  let whaleWas = false;
  target('whale', [whale.position], { maxDist: 75, active: () => ev.whale.active && whale.position.y > -2.5, bonus: () => Math.abs(ev.whale.k - 0.5) < 0.16 });
  const harborWander = H.wander.map(([x, z]) => wanderer(x, z, 4, 'harbor'));

  // =====================================================================================
  // ICE CAVE GROTTO — rugged dome with a cave mouth, crystals, heart, pool, falls, secrets
  // =====================================================================================
  const GR = A.GROTTO;
  { const g0 = new THREE.SphereGeometry(GR.r, 56, 20, 0, Math.PI * 2, 0, Math.PI / 2), p0 = g0.attributes.position;
    for (let i = 0; i < p0.count; i++) { const x = p0.getX(i), y = p0.getY(i), z = p0.getZ(i), n = 1 + 0.05 * Math.sin(x * 0.9 + z * 0.7) + 0.04 * Math.sin(y * 1.3 + x * 0.4); p0.setXYZ(i, x * n, y * 0.62, z * n); }
    const g1 = g0.toNonIndexed(); g0.dispose(); const src = g1.attributes.position.array, keep = [];
    for (let i = 0; i < src.length; i += 9) { const cx = (src[i] + src[i + 3] + src[i + 6]) / 3, cy = (src[i + 1] + src[i + 4] + src[i + 7]) / 3, cz = (src[i + 2] + src[i + 5] + src[i + 8]) / 3; if (Math.abs(Math.atan2(cz, cx)) < GR.gap && cy < GR.doorH) continue; for (let k = 0; k < 9; k++) keep.push(src[i + k]); }
    g1.dispose(); const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(keep, 3)); g.computeVertexNormals();
    const m = new THREE.MeshStandardMaterial({ color: '#4a5d8c', roughness: 0.85, flatShading: true, side: THREE.DoubleSide }); disp.push(g, m);
    const dome = mesh(g, m, GR.x, 0, GR.z); occluders.push(dome);
    const sg = new THREE.SphereGeometry(GR.r + 0.5, 48, 10, 0, Math.PI * 2, 0, 0.85); const sm = std({ color: '#f4f8ff', roughness: 1 }); disp.push(sg); const cap = mesh(sg, sm, GR.x, -0.3, GR.z); cap.scale.y = 0.63;
    for (let a = GR.gap + 0.05; a < Math.PI * 2 - GR.gap; a += 0.09) { const x = GR.x + Math.cos(a) * (GR.r + 0.3), z = GR.z + Math.sin(a) * (GR.r + 0.3); colliders.push(['circle', x, z, 1.1, 30]); if (R() < 0.6) rock(GR.x + Math.cos(a) * (GR.r + 2.5), 0.6, GR.z + Math.sin(a) * (GR.r + 2.5), 2 + R() * 2.4, '#66779c'); }
    // cave mouth: rock frame + lintel + icicles
    const mx = GR.x + GR.r * Math.cos(GR.gap), hw = GR.r * Math.sin(GR.gap);
    for (const sd of [-1, 1]) { rock(mx + 0.4, 1.5, GR.z + sd * (hw + 0.6), 2.2, '#5b6c92'); rock(mx, 4.2, GR.z + sd * (hw - 0.2), 1.8, '#62739a'); colliders.push(['circle', mx + 0.4, GR.z + sd * (hw + 0.6), 1.6, 6]); }
    for (let i = -2; i <= 2; i++) rock(mx - 0.6, GR.doorH + 0.5, GR.z + i * hw * 0.42, 1.7, '#5b6c92');
    for (let i = 0; i < 11; i++) B.add(M.ice, cone, mx - 0.2 + (R() - 0.5), GR.doorH - 0.7, GR.z - hw + 1 + i * (hw * 2 - 2) / 10, 0.22, 1 + R() * 1.1, 0.22, '#cdefff', [Math.PI, 0, 0]);
    sign('💎 Ice Cave Grotto', -60, 3.2, -6.5, -Math.PI / 2 + Math.PI, '#3b2d7a', 4.4);
    const fg = new THREE.CircleGeometry(GR.r, 40); fg.rotateX(-Math.PI / 2); const fm = std({ color: '#3a4f86', roughness: 0.12, metalness: 0.3 }); disp.push(fg); mesh(fg, fm, GR.x, 0.025, GR.z); }
  // crystals (glow) ring + ceiling stalactites
  const crystalCols = ['#7ff6ff', '#c49bff', '#ff8fd0', '#9fd0ff'];
  for (let i = 0; i < 46; i++) { const a = R() * Math.PI * 2; if (Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) < GR.gap + 0.12) continue; const r = GR.r - 1.2 - R() * 2.2, x = GR.x + Math.cos(a) * r, z = GR.z + Math.sin(a) * r, h = 0.8 + R() * 2.2;
    G.add(glow, oct, x, h * 0.6, z, 0.3 + R() * 0.3, h, 0.3 + R() * 0.3, crystalCols[i % 4], [R() * 0.5 - 0.25, R() * 3, R() * 0.5 - 0.25]); }
  for (let i = 0; i < 26; i++) { const a = R() * Math.PI * 2, r = R() * (GR.r - 4), x = GR.x + Math.cos(a) * r, z = GR.z + Math.sin(a) * r, top = GR.r * 0.62 * Math.sqrt(Math.max(0.05, 1 - (r / GR.r) ** 2)); B.add(M.ice, cone, x, top - 0.9, z, 0.25 + R() * 0.25, 1.6 + R() * 1.4, 0.25 + R() * 0.25, '#bfe6ff', [Math.PI, 0, 0]); }
  // gem niche cluster (hides the gem from most angles)
  for (let i = 0; i < 7; i++) G.add(glow, oct, GR.gem.x + 2 + R() * 1.2 - 0.6, 0.9 + R() * 0.9, GR.gem.z - 0.6 + R() * 1.6, 0.35, 1.4 + R(), 0.35, crystalCols[(i + 1) % 4], [0, R() * 3, R() * 0.3]);
  const gemMat = new THREE.MeshBasicMaterial({ color: '#ff6fd8', toneMapped: false }); disp.push(gemMat);
  const gem = mesh(oct, gemMat, GR.gem.x, 0.7, GR.gem.z); gem.scale.set(0.35, 0.5, 0.35);
  target('hidden_gem', [gem.position], { maxDist: 9, area: 'grotto' });
  // crystal heart
  const HT = GR.heart;
  B.add(M.ice, cyl, HT.x, 0.4, HT.z, 2, 0.8, 2, '#9fd8ff'); colliders.push(['circle', HT.x, HT.z, 2, 1.2]);
  const heartMat = new THREE.MeshStandardMaterial({ color: '#bff6ff', emissive: '#3fd8ff', emissiveIntensity: 1.2, roughness: 0.05, transparent: true, opacity: 0.9 }); disp.push(heartMat);
  const heart = mesh(oct, heartMat, HT.x, 3.4, HT.z); heart.scale.set(1.1, 1.8, 1.1);
  const heartRing = mesh(new THREE.TorusGeometry(1.8, 0.06, 6, 40), new THREE.MeshBasicMaterial({ color: '#c49bff', toneMapped: false }), HT.x, 3.4, HT.z); disp.push(heartRing.geometry, heartRing.material);
  target('crystal_heart', [heart.position], { maxDist: 22, area: 'grotto' });
  // glow pool
  const PO = GR.pool; B.add(M.rock, cyl, PO.x, 0.1, PO.z, 3.3, 0.3, 3.3, '#5b6c92'); colliders.push(['circle', PO.x, PO.z, 3, 0.6]);
  const poolMat = new THREE.MeshBasicMaterial({ color: '#4ff0d0', transparent: true, opacity: 0.8, toneMapped: false }); disp.push(poolMat);
  const pool = mesh(new THREE.CircleGeometry(2.9, 32), poolMat, PO.x, 0.27, PO.z); pool.rotation.x = -Math.PI / 2; disp.push(pool.geometry);
  target('glow_pool', [V(PO.x, 0.5, PO.z)], { maxDist: 20, area: 'grotto' });
  // frozen falls
  const FA = GR.falls; for (let i = 0; i < 9; i++) B.add(M.ice, cyl, FA.x + (R() - 0.5) * 0.6, i * 0.9 + 0.45, FA.z + (R() - 0.5) * 2.6, 0.8 + R() * 0.6, 1.1, 0.5 + R() * 0.4, '#d8f4ff');
  for (let i = 0; i < 6; i++) B.add(M.ice, dode, FA.x + 1 + R() * 1.5, 0.3, FA.z - 1.5 + R() * 3, 0.7, 0.5, 0.7, '#cdefff'); colliders.push(['circle', FA.x + 0.6, FA.z, 1.8, 10]);
  target('icicle_falls', [V(FA.x, 4, FA.z)], { maxDist: 24, area: 'grotto' });
  // ancient carving (wall glyph)
  { const t = canvasTex(256, 128, (g, w, h) => { g.clearRect(0, 0, w, h); g.strokeStyle = 'rgba(160,240,255,.95)'; g.lineWidth = 5; g.lineCap = 'round'; const peng = (x, y, s) => { g.beginPath(); g.ellipse(x, y, 14 * s, 22 * s, 0, 0, 7); g.stroke(); g.beginPath(); g.arc(x, y - 30 * s, 10 * s, 0, 7); g.stroke(); g.beginPath(); g.moveTo(x + 8 * s, y - 31 * s); g.lineTo(x + 18 * s, y - 28 * s); g.stroke(); }; peng(50, 80, 1.2); peng(120, 84, 0.9); peng(180, 78, 1.3); g.beginPath(); g.arc(128, 26, 14, 0, 7); g.stroke(); for (let i = 0; i < 8; i++) { const a = i / 8 * 6.283; g.beginPath(); g.moveTo(128 + Math.cos(a) * 18, 26 + Math.sin(a) * 18); g.lineTo(128 + Math.cos(a) * 26, 26 + Math.sin(a) * 26); g.stroke(); } g.beginPath(); g.moveTo(10, 112); g.lineTo(246, 112); g.stroke(); });
    const m = new THREE.MeshBasicMaterial({ map: t, transparent: true, toneMapped: false }), g = new THREE.PlaneGeometry(4, 2); disp.push(t, m, g); const o = new THREE.Mesh(g, m); o.position.set(GR.carving.x, 2.4, GR.carving.z + 0.4); add(o); }
  target('carving', [V(GR.carving.x, 2.4, GR.carving.z + 0.4)], { maxDist: 14, area: 'grotto' });
  // moths
  const moths = []; for (let i = 0; i < 16; i++) { const o = buildMoth(i % 3 ? '#9ff6ff' : '#ffd6ff'); add(o); moths.push({ o, a: R() * 6.28, r: 0.8 + R() * 2.2, h: R() * 2, sp: 0.6 + R() }); }
  target('moths', [V(GR.moths.x, GR.moths.y, GR.moths.z)], { maxDist: 18, area: 'grotto' });
  // spelunker
  const spel = { ...wanderer(GR.spelunker.x, GR.spelunker.z, 3, 'grotto') }; actors[actors.length - 1] = spel;
  { const h = new THREE.Mesh(sph, mat('#ffd23a')); h.scale.set(0.42, 0.25, 0.42); h.position.y = 1.75; spel.m.add(h); const l = new THREE.Mesh(sph, new THREE.MeshBasicMaterial({ color: '#fff7c0', toneMapped: false })); disp.push(l.material); l.scale.setScalar(0.09); l.position.set(0, 1.85, 0.38); spel.m.add(l); }
  target('spelunker', [spel.m.position], { yOff: 0.9, maxDist: 20, area: 'grotto' });
  const caveLights = []; for (const [x, z, c] of (mobile ? [[GR.x, GR.z, '#7fdcff']] : [[HT.x, HT.z, '#7fdcff'], [PO.x, PO.z, '#4ff0d0'], [GR.x - 8, GR.z - 9, '#c49bff']])) { const p = new THREE.PointLight(c, mobile ? 30 : 18, 22, 1.4); p.position.set(x, 4, z); add(p); caveLights.push(p); }

  // =====================================================================================
  // SNOWY PINE WOODS — creek + bridge, dense pines, wildlife, old pine, yeti, golden cone
  // =====================================================================================
  const W = A.WOODS;
  { const c = W.creek; B.box(M.ice, 0, 0.03, c.z, c.x1 - c.x0, 0.04, c.hw * 2, '#a9dcff'); for (let x = c.x0; x < c.x1; x += 3) for (const sd of [-1, 1]) if (Math.abs(x) > 4 && R() < 0.7) B.add(M.matte, sph, x + R() * 2, -0.05, c.z + sd * (c.hw + 0.7), 1.2 + R(), 0.45, 0.9, '#f4f8ff');
    const b = W.bridge; for (let i = 0; i < 10; i++) { const z = c.z - b.len / 2 + i * (b.len / 9); B.box(M.wood, b.x, 0.22, z, b.hw * 2, 0.14, b.len / 9.5, i % 2 ? '#a8774e' : '#94663f'); }
    colliders.push(['box', b.x - b.hw, 0, c.z - b.len / 2, b.x + b.hw, 0.29, c.z + b.len / 2]);
    for (const sd of [-1, 1]) { for (let i = 0; i <= 4; i++) { const z = c.z - b.len / 2 + i * b.len / 4; B.add(M.wood, cyl, b.x + sd * b.hw, 0.8, z, 0.08, 1.2, 0.08, '#6b4a2b'); } B.box(M.wood, b.x + sd * b.hw, 1.35, c.z, 0.12, 0.1, b.len, '#7b5536'); G.add(glow, sph, b.x + sd * b.hw, 1.55, c.z - b.len / 2, 0.16, 0.16, 0.16, '#ffcf8a'); G.add(glow, sph, b.x + sd * b.hw, 1.55, c.z + b.len / 2, 0.16, 0.16, 0.16, '#ffcf8a'); }
    sign('🌲 Snowy Pine Woods', -4.6, 2.8, -41, 0, '#1f5a4e', 4.6); }
  target('bridge', [V(W.bridge.x, 0.8, W.creek.z)], { maxDist: 30 });
  const special = [[W.oldPine.x, W.oldPine.z, 5], [W.reindeer.x, W.reindeer.z, 4], [W.goldenCone.x, W.goldenCone.z, 2.5], [W.yeti.x, W.yeti.z, 3], [W.hares.x, W.hares.z, 4], ...W.owlPerches.map(p => [p[0], p[1], 1.5])];
  for (let i = 0; i < 120; i++) { const x = (R() - 0.5) * 64, z = -56 - R() * 62; if (Math.hypot(x - W.clearing.x, z - W.clearing.z) < W.clearing.r + 2 || (Math.abs(x) < 3.4 && z > -76) || special.some(([sx, sz, r]) => Math.hypot(x - sx, z - sz) < r) || Math.hypot(x, z) > A.WORLD_R - 2) continue; pine(x, z, 0.9 + R() * 0.8); }
  { const P = W.oldPine; pine(P.x, P.z, 3.4, 0, false); colliders.push(['circle', P.x, P.z, 1.6, 30]); for (let i = 0; i < 6; i++) { const a = i * 1.05; B.add(M.wood, cyl, P.x + Math.cos(a) * 1.2, 0.2, P.z + Math.sin(a) * 1.2, 0.35, 0.5, 0.9, '#5a3a22', [Math.PI / 2, a, 0]); } }
  target('old_pine', [V(W.oldPine.x, 9, W.oldPine.z)], { maxDist: 60 });
  // owl + perches
  for (const [x, z, h] of W.owlPerches) { B.add(M.wood, cyl, x, h / 2, z, 0.35, h, 0.35, '#5a3a22'); B.add(M.matte, cyl, x, h + 0.04, z, 0.4, 0.1, 0.4, '#f4f8ff'); colliders.push(['circle', x, z, 0.45, h]); }
  const owl = buildOwl(1.1); add(owl); let owlPerch = 0, owlFly = null, owlT = 18; const owlHome = (i) => V(W.owlPerches[i][0], W.owlPerches[i][2] + 0.1, W.owlPerches[i][1]); owl.position.copy(owlHome(0));
  target('owl', [owl.position], { yOff: 0.45, maxDist: 32, bonus: () => Math.abs(owl.userData.head.rotation.y) > 1.0 });
  // fox
  const fox = buildFox(1.15); fox.position.set(W.foxHome.x, 0, W.foxHome.z); add(fox); const foxS = { tx: fox.position.x, tz: fox.position.z, wait: 2, pounce: 9, pT: -1 };
  target('fox', [fox.position], { yOff: 0.5, maxDist: 28, bonus: () => foxS.pT >= 0 });
  // hares
  const hares = [0, 1, 2].map(i => { const o = buildHare(1.1); o.position.set(W.hares.x + i, 0, W.hares.z + i * 0.7); add(o); return { o, hop: R() * 2, tx: o.position.x, tz: o.position.z, y0: 0 }; });
  target('hares', hares.map(h => h.o.position), { yOff: 0.35, maxDist: 24 });
  // reindeer
  const deer = buildReindeer(1.2); deer.position.set(W.reindeer.x, 0, W.reindeer.z); deer.rotation.y = -2.2; add(deer); colliders.push(['circle', W.reindeer.x, W.reindeer.z, 1.1, 2.5]);
  target('reindeer', [deer.position], { yOff: 1.4, maxDist: 40 });
  // yeti + footprints (always) + golden pinecone
  const yeti = buildYeti(1.15); yeti.position.set(W.yeti.x, 0, W.yeti.z); yeti.rotation.y = 0.7; yeti.visible = false; add(yeti);
  { const g = new THREE.CircleGeometry(0.32, 10), m = new THREE.MeshBasicMaterial({ color: '#9fb6dd', transparent: true, opacity: 0.75, depthWrite: false }); g.rotateX(-Math.PI / 2); disp.push(g, m); const im = new THREE.InstancedMesh(g, m, 26); const o = new THREE.Object3D();
    for (let i = 0; i < 26; i++) { const k = i / 25, x = W.clearing.x - 4 + (W.yeti.x + 3 - (W.clearing.x - 4)) * k + Math.sin(k * 9) * 1.5 + (i % 2 ? 0.45 : -0.45), z = W.clearing.z - 5 + (W.yeti.z + 3 - (W.clearing.z - 5)) * k; o.position.set(x, 0.03, z); o.rotation.y = -0.6; o.scale.set(1, 1, 1.7); o.updateMatrix(); im.setMatrixAt(i, o.matrix); }
    add(im); }
  target('yeti', [yeti.position], { yOff: 1.8, maxDist: 34, active: () => yeti.visible && ev.night > 0.5 });
  { const g = W.goldenCone; for (let i = 0; i < 5; i++) B.add(M.matte, sph, g.x + Math.cos(i * 1.3) * 1.1, 0.4, g.z + Math.sin(i * 1.3) * 1.1, 0.9, 0.7, 0.9, i % 2 ? '#2f6a5a' : '#f4f8ff'); }
  const goldMat = new THREE.MeshStandardMaterial({ color: '#ffd76a', metalness: 0.9, roughness: 0.25, emissive: '#7a5200', emissiveIntensity: 0.6 }); disp.push(goldMat);
  const cone_ = mesh(cone, goldMat, W.goldenCone.x + 0.3, 0.28, W.goldenCone.z - 0.2); cone_.scale.set(0.22, 0.45, 0.22);
  target('golden_cone', [cone_.position], { maxDist: 10 });
  W.wander.forEach(([x, z]) => wanderer(x, z, 4, 'woods'));

  // =====================================================================================
  // IGLOO VILLAGE — igloo street, bonfire, choir, snowman builder, knit market, sled hill
  // =====================================================================================
  const VG = A.VILLAGE;
  const iglooMat = std({ color: '#f2f7ff', roughness: 0.75, map: canvasTex(256, 128, (g, w, h) => { g.fillStyle = '#f6f9ff'; g.fillRect(0, 0, w, h); g.strokeStyle = '#c6d5ee'; g.lineWidth = 3; for (let y = 0; y < h; y += 16) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); for (let x = ((y / 16) % 2) * 16; x < w; x += 32) { g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 16); g.stroke(); } } }) });
  iglooMat.map.wrapS = THREE.RepeatWrapping; iglooMat.map.repeat.set(3, 1); disp.push(iglooMat.map);
  for (const [x, z, f] of VG.igloos) { const o = mesh(half, iglooMat, x, 0, z); o.scale.set(2.8, 2.3, 2.8); const tun = mesh(half, iglooMat, x + Math.sin(f) * 2.6, 0, z + Math.cos(f) * 2.6); tun.scale.set(1.05, 1.45, 1.5); tun.rotation.y = f;
    G.box(glow, x + Math.sin(f) * 4.05, 0.6, z + Math.cos(f) * 4.05, 0.8, 0.95, 0.05, '#ffb060', [0, f, 0]); colliders.push(['circle', x, z, 2.7, 2.4], ['circle', x + Math.sin(f) * 2.7, z + Math.cos(f) * 2.7, 1, 1.2]); }
  target('igloo_row', VG.igloos.slice(0, 3).map(([x, z]) => V(x, 1.2, z)), { maxDist: 40 });
  // string lights between igloos
  for (let i = 0; i < VG.igloos.length; i++) { const [ax, az] = VG.igloos[i], [bx, bz] = VG.igloos[(i + 1) % VG.igloos.length]; for (let k = 1; k < 10; k++) { const t = k / 10; G.add(glow, sph, ax + (bx - ax) * t, 3.6 - Math.sin(t * Math.PI) * 1.1, az + (bz - az) * t, 0.12, 0.12, 0.12, ['#ff8fd0', '#ffd36b', '#7fffc8', '#9fd0ff'][k % 4]); } }
  // bonfire
  const BF = VG.bonfire; for (let i = 0; i < 5; i++) B.add(M.wood, cyl, BF.x + Math.cos(i * 1.26) * 0.5, 0.25, BF.z + Math.sin(i * 1.26) * 0.5, 0.15, 1.6, 0.15, '#5a3a22', [Math.PI / 2 - 0.35, -i * 1.26, 0]);
  for (let i = 0; i < 10; i++) { const a = i / 10 * 6.283; rock(BF.x + Math.cos(a) * 1.3, 0.15, BF.z + Math.sin(a) * 1.3, 0.35, '#7b879f'); }
  colliders.push(['circle', BF.x, BF.z, 1.4, 1.5]);
  const flames = [0, 1, 2].map(i => { const m = new THREE.MeshBasicMaterial({ color: ['#ffb030', '#ff7a2a', '#ffe08a'][i], transparent: true, opacity: 0.85, toneMapped: false }); disp.push(m); const o = mesh(cone, m, BF.x + (i - 1) * 0.25, 0.8, BF.z + (i % 2) * 0.2); o.castShadow = false; return o; });
  const fireLight = mobile ? null : (() => { const p = new THREE.PointLight('#ffa050', 20, 18, 1.5); p.position.set(BF.x, 2, BF.z); return add(p); })();
  for (let i = 0; i < 4; i++) { const a = i * 1.57 + 0.4; B.box(M.wood, BF.x + Math.cos(a) * 3.4, 0.35, BF.z + Math.sin(a) * 3.4, 1.8, 0.3, 0.6, '#9a5f36', [0, -a + Math.PI / 2, 0]); }
  target('bonfire', [V(BF.x, 1, BF.z)], { maxDist: 30 });
  sign('🔥 Igloo Village', 42, 2.8, 37, Math.PI * 0.75 + Math.PI, '#7a3b22', 4.2);
  // choir
  const CH = VG.choir, choir = [0, 1, 2].map(i => pengu(CH.x - 1.4 + i * 1.4, CH.z, { face: Math.PI * 0.85, scarf: ['#e0435f', '#2fbf78', '#ffd36b'][i], s: 0.75 + (i === 1 ? 0.12 : 0) }));
  B.add(M.metal, cyl, CH.x - 0.5, 0.6, CH.z - 1.8, 0.04, 1.2, 0.04, '#33405a'); B.box(M.semi, CH.x - 0.5, 1.25, CH.z - 1.8, 0.8, 0.5, 0.05, '#fff8ec', [-0.4, Math.PI * 0.85, 0]);
  choir.forEach(c => colliders.push(['circle', c.position.x, c.position.z, 0.5, 2]));
  let choirT = 0;
  target('choir', choir.map(c => c.position), { yOff: 0.9, maxDist: 26 });
  // snowman builder
  const SM = VG.snowman, snowBalls = [0.95, 0.7, 0.48].map((r, i) => { const o = mesh(sph, mat('#fbfdff', { roughness: 1 }), SM.x, 0, SM.z); o.userData.r = r; return o; });
  const smHat = mesh(cyl, mat('#22252e'), SM.x, 0, SM.z); smHat.scale.set(0.36, 0.5, 0.36); const smNose = mesh(cone, mat('#ff8a2a'), SM.x, 0, SM.z + 0.45); smNose.scale.set(0.07, 0.35, 0.07); smNose.rotation.x = Math.PI / 2;
  const builder = pengu(SM.x - 1.4, SM.z + 0.6, { face: 1.6, scarf: '#5fd0ff', hat: '#ff5f7e', s: 0.8 }); colliders.push(['circle', SM.x, SM.z, 1.1, 3], ['circle', SM.x - 1.4, SM.z + 0.6, 0.5, 2]);
  target('snowman', [V(SM.x, 1.4, SM.z)], { maxDist: 28, bonus: () => ev.snowman.done });
  // knit market
  const KM = VG.market; { B.box(M.wood, KM.x, 0.55, KM.z, 3.6, 1.1, 1.4, '#9a5f36'); for (const dx of [-1.7, 1.7]) B.add(M.wood, cyl, KM.x + dx, 1.5, KM.z - 0.5, 0.07, 3, 0.07, '#6b4a2b'); B.box(M.wood, KM.x, 2.9, KM.z - 0.5, 3.6, 0.08, 0.08, '#6b4a2b');
    for (let i = 0; i < 8; i++) B.box(M.matte, KM.x - 1.5 + i * 0.43, 2.3, KM.z - 0.5, 0.3, 1.1, 0.05, ['#e0435f', '#ffd36b', '#2fbf78', '#5fd0ff', '#c79bff', '#ff9a3c', '#ffffff', '#ff7fb0'][i]);
    for (let i = 0; i < 6; i++) B.add(M.matte, sph, KM.x - 1.3 + i * 0.5, 1.25, KM.z + 0.2, 0.2, 0.18, 0.2, ['#e0435f', '#ffd36b', '#2fbf78', '#5fd0ff', '#c79bff', '#ff9a3c'][i]);
    colliders.push(['box', KM.x - 1.8, 0, KM.z - 0.7, KM.x + 1.8, 1.2, KM.z + 0.7]); pengu(KM.x, KM.z - 1.4, { face: 0, scarf: '#c79bff', hat: '#ffd36b', s: 0.78 }); colliders.push(['circle', KM.x, KM.z - 1.4, 0.5, 2]); }
  target('knit_market', [V(KM.x, 1.6, KM.z)], { maxDist: 30 });
  // sled hill + sledders
  const SH = VG.sledHill; { const o = mesh(new THREE.SphereGeometry(1, 24, 10, 0, Math.PI * 2, 0, Math.PI / 2), std({ color: '#f4f8ff', roughness: 1 }), SH.x, 0, SH.z); disp.push(o.geometry); o.scale.set(SH.r, SH.h, SH.r); colliders.push(['circle', SH.x, SH.z, SH.r * 0.8, SH.h]); }
  const slope = (k, a) => { const r = SH.r * k; return V(SH.x + Math.cos(a) * r, SH.h * Math.sqrt(Math.max(0, 1 - k * k)) * 0.98, SH.z + Math.sin(a) * r); };
  const sledders = [0, 1].map(i => { const m = pengu(SH.x, SH.z, { scarf: ['#ff5f7e', '#5fd0ff'][i], hat: ['#ffd36b', '#7fffc8'][i], s: 0.7 }); const sled = new THREE.Mesh(box, mat(['#e0435f', '#2f8fd6'][i])); sled.scale.set(0.9, 0.12, 1.6); sled.position.y = 0.05; m.add(sled); return { m, a: Math.PI + 0.55 + i * 0.7, t: i * 3.3, air: false }; });
  target('sledders', sledders.map(s => s.m.position), { yOff: 0.7, maxDist: 32, bonus: () => sledders.some(s => s.air) });
  VG.wander.forEach(([x, z]) => wanderer(x, z, 3, 'village'));

  // =====================================================================================
  // SCULPTURE GARDEN — snow maze + heart, ice dragon, whale, castle, sculptor
  // =====================================================================================
  const GD = A.GARDEN, MZ = GD.maze, n = GD.mazeMap.length, half_ = (n * MZ.cell) / 2;
  const mazeCell = (r, c) => [MZ.x - half_ + c * MZ.cell + MZ.cell / 2, MZ.z + half_ - r * MZ.cell - MZ.cell / 2];
  let heartPos = V(MZ.x, 1, MZ.z);
  GD.mazeMap.forEach((row, r) => [...row].forEach((ch, c) => { const [x, z] = mazeCell(r, c);
    if (ch === '#') { B.box(M.matte, x, MZ.h / 2, z, MZ.cell, MZ.h, MZ.cell, (r + c) % 2 ? '#e8f1ff' : '#dfeafc'); B.box(M.matte, x, MZ.h + 0.08, z, MZ.cell * 0.9, 0.2, MZ.cell * 0.9, '#ffffff'); colliders.push(['box', x - MZ.cell / 2, 0, z - MZ.cell / 2, x + MZ.cell / 2, MZ.h, z + MZ.cell / 2]); }
    else if (ch === 'H') heartPos = V(x, 1.1, z);
    else if (ch === 'E') G.add(glow, sph, x, MZ.h + 0.4, z, 0.25, 0.25, 0.25, '#ff8fd0'); }));
  B.add(M.ice, cyl, heartPos.x, 0.35, heartPos.z, 0.5, 0.7, 0.5, '#bfe6ff');
  const rose = new THREE.Group(); rose.position.copy(heartPos); add(rose); { const rm = new THREE.MeshStandardMaterial({ color: '#ff6f91', emissive: '#c0204a', emissiveIntensity: 0.6, roughness: 0.2, transparent: true, opacity: 0.92 }); disp.push(rm); for (let i = 0; i < 6; i++) { const p = new THREE.Mesh(sph, rm); p.scale.set(0.18, 0.3, 0.09); p.position.set(Math.cos(i) * 0.12, 0.2, Math.sin(i) * 0.12); p.rotation.y = -i; p.rotation.z = 0.4; rose.add(p); } }
  target('maze_heart', [heartPos], { maxDist: 7 });
  sign('🗿 Sculpture Garden', -36, 2.8, -33, Math.PI * 0.25, '#2f5a80', 4.4);
  const iceM = M.ice;
  // dragon: serpentine body + head + wings on a plinth
  const DR = GD.dragon; B.add(M.rock, cyl, DR.x, 0.3, DR.z, 3.6, 0.6, 2.4, '#8d9ab3'); colliders.push(['circle', DR.x, DR.z, 3.4, 8]);
  for (let i = 0; i < 12; i++) { const k = i / 11, x = DR.x - 3 + k * 6, y = 1.2 + Math.sin(k * Math.PI * 1.5) * 1.4 + k * 1.6, s = 0.75 - Math.abs(k - 0.4) * 0.6; B.add(iceM, sph, x, y, DR.z, s, s, s, '#cdefff'); }
  B.add(iceM, sph, DR.x + 3.4, 4.6, DR.z, 0.7, 0.6, 0.6, '#d8f4ff'); B.add(iceM, cone, DR.x + 4.2, 4.5, DR.z, 0.35, 1.1, 0.35, '#d8f4ff', [0, 0, -Math.PI / 2]); for (const sd of [-1, 1]) { B.add(iceM, cone, DR.x + 3.2, 5.3, DR.z + sd * 0.3, 0.12, 0.8, 0.12, '#ffffff', [sd * 0.3, 0, 0.5]); B.add(iceM, box, DR.x + 0.4, 3.6, DR.z + sd * 1.6, 2.6, 0.08, 2, '#bfe6ff', [sd * 0.5, 0, 0.2]); }
  target('ice_dragon', [V(DR.x + 0.5, 3, DR.z)], { maxDist: 40 });
  // whale sculpture
  const WS = GD.whale; B.add(M.rock, cyl, WS.x, 0.3, WS.z, 2.4, 0.6, 2.4, '#8d9ab3'); colliders.push(['circle', WS.x, WS.z, 2.4, 6]);
  { const w = buildWhale(); w.scale.setScalar(0.42); w.position.set(WS.x, 2.8, WS.z); w.rotation.set(-0.7, 0.8, 0); w.traverse(o => { if (o.isMesh) o.material = iceM; }); add(w); }
  target('ice_whale', [V(WS.x, 2.8, WS.z)], { maxDist: 35 });
  // castle
  const CS = GD.castle; { B.box(iceM, CS.x, 1.5, CS.z, 5, 3, 4, '#cdefff'); for (const [dx, dz] of [[-2.5, -2], [2.5, -2], [-2.5, 2], [2.5, 2]]) { B.add(iceM, cyl, CS.x + dx, 2.4, CS.z + dz, 0.75, 4.8, 0.75, '#d8f4ff'); B.add(iceM, cone, CS.x + dx, 5.4, CS.z + dz, 0.95, 1.4, 0.95, '#bfe6ff'); } B.add(iceM, cyl, CS.x, 4.2, CS.z, 1, 2.6, 1, '#e4f8ff'); B.add(iceM, cone, CS.x, 6.4, CS.z, 1.3, 1.8, 1.3, '#bfe6ff'); colliders.push(['box', CS.x - 3.3, 0, CS.z - 2.8, CS.x + 3.3, 7, CS.z + 2.8]); }
  target('ice_castle', [V(CS.x, 3.5, CS.z)], { maxDist: 45 });
  // sculptor (with a block they chip at)
  const SC = GD.sculptor; B.box(iceM, SC.x + 1.3, 0.8, SC.z, 1.4, 1.6, 1.2, '#d8f4ff'); colliders.push(['box', SC.x + 0.6, 0, SC.z - 0.6, SC.x + 2, 1.6, SC.z + 0.6], ['circle', SC.x, SC.z, 0.5, 2]);
  const sculptor = pengu(SC.x, SC.z, { face: Math.PI / 2, scarf: '#ff9a3c', hat: '#c79bff', s: 0.82 }); let chipT = 0;
  const hammer = new THREE.Mesh(box, mat('#8a8f9c')); hammer.scale.set(0.12, 0.5, 0.12); sculptor.add(hammer); hammer.position.set(0.55, 1, 0.3);
  target('sculptor', [sculptor.position], { yOff: 0.9, maxDist: 24, bonus: () => chipT < 0.25 });
  for (const [x, z] of [[-48, -50], [-68, -54], [-50, -76], [-74, -60]]) { B.add(M.metal, cyl, x, 1.2, z, 0.06, 2.4, 0.06, '#33405a'); G.add(glow, oct, x, 2.6, z, 0.3, 0.45, 0.3, '#9ff6ff'); colliders.push(['circle', x, z, 0.2, 3]); }
  GD.wander.forEach(([x, z]) => wanderer(x, z, 3, 'garden'));
  // ridge wanderer
  wanderer(-4, 90, 4, 'ridge').m.position.y = pl.top;

  B.build(scene); G.build(scene, { cast: false, receive: false });

  // =====================================================================================
  let ev = null, playerY = 0;
  const tmp = new THREE.Vector3();
  const world = {
    colliders, occluders, targets, liftPos, lift: L, rideChair, signs,
    get yeti() { return yeti; },
    update(dt, t, ctx) {
      ev = ctx.ev; const p = ctx.player; playerY = p.y; const near = (x, z, r) => Math.hypot(p.x - x, p.z - z) < r;
      // aurora + shooting star
      auroraMat.uniforms.uT.value = t; auroraMat.uniforms.uK.value = ev.night; auroras.forEach(a => a.visible = ev.night > 0.02);
      if (ev.star.active) { const s = ev.star.seed, a0 = ((s * 2.399) % 6.283), k = ev.star.k, dx = Math.cos(a0), dz = Math.sin(a0); const cx = p.x + dx * -60 + dz * 30, cz = p.z + 120 + dz * -60;
        starHead.set(cx + dx * 140 * k, 110 - 40 * k, cz + dz * 50 * k); star.position.copy(starHead); star.rotation.set(0, -Math.atan2(dz * 50, dx * 140), -0.27); star.material.opacity = Math.sin(k * Math.PI) * 0.95; star.visible = true;
        if (starLast !== s) { starLast = s; if (k < 0.3) audio?.play('sfx_shooting_star', 0.6); } } else { star.visible = false; }
      // ridge
      angelT += dt; angel.userData.wings.forEach((w, i) => w.rotation.z = (i ? 1 : -1) * (0.4 + Math.max(0, Math.sin(angelT * 5)) * 1.1));
      { const pa = flag.geometry.attributes.position; for (let i = 0; i < pa.count; i++) { const x = pa.getX(i); pa.setZ(i, Math.sin(x * 3 + t * 5) * 0.12 * (x + 0.8)); } pa.needsUpdate = true; }
      chairs.forEach((c, i) => { const k = ((t * 0.06 + i / 4) % 1); liftPos(k, c.position); c.position.y += 1.9; c.position.x -= 0; });
      // harbor
      if (near(H.shoreX, 0, 80)) { for (let i = 0; i < wPos.count; i++) { const x = wBase[i * 3], z = wBase[i * 3 + 2]; wPos.array[i * 3 + 1] = Math.sin(x * 0.18 + t * 1.2) * 0.12 + Math.cos(z * 0.21 + t * 0.9) * 0.1; } wPos.needsUpdate = true; }
      boats.forEach(b => { b.o.position.y = Math.sin(t * 1.1 + b.ph) * 0.12 - 0.15; b.o.rotation.z = Math.sin(t * 0.8 + b.ph) * 0.05; b.o.userData.sail.rotation.y = Math.sin(t * 0.6 + b.ph) * 0.1; });
      seal.userData.head.rotation.x = Math.sin(t * 0.7) * 0.25; seal.userData.tail.rotation.x = Math.sin(t * 2) * 0.3; pup.userData.head.rotation.y = Math.sin(t * 1.3) * 0.5; pup.position.y = 0.25 + Math.abs(Math.sin(t * 1.7)) * 0.05;
      puffins.forEach((o, i) => { o.userData.head.rotation.y = Math.sin(t * 1.5 + i) * 0.6; o.userData.wings.forEach((w, j) => w.rotation.z = (j ? 1 : -1) * (0.1 + Math.max(0, Math.sin(t * 9 + i * 2)) * (i === 3 ? 1 : 0.2))); });
      fishT -= dt; if (fishT < -2.6) fishT = 14 + Math.random() * 8;
      { const c = fishT < 0, k = c ? Math.min(1, -fishT / 0.4) : 0; rod.rotation.z = c ? 0.7 * k : Math.sin(t * 1.4) * 0.05; fish.visible = c; if (c) { fish.position.set(H.fisher.x + 2.2 + (1 - k) * 0.8, 1.4 + k * 1.0 + Math.sin(t * 20) * 0.05, H.fisher.z); fish.rotation.z = Math.sin(t * 25) * 0.6; } fisher.position.y = c ? Math.abs(Math.sin(t * 10)) * 0.15 : 0; }
      { const on = ev.whale.active, k = ev.whale.k; if (on) { whale.position.y = -12 + Math.sin(k * Math.PI) * 15; whale.rotation.x = (k - 0.5) * 2.4; whale.position.z = H.whale.z + (k - 0.5) * 10; whale.userData.tail.rotation.x = Math.sin(t * 4) * 0.3;
          if (!whaleWas) { whaleWas = true; if (near(H.whale.x, H.whale.z, 90)) audio?.play('sfx_whale_breach', 0.9); fx?.burst(tmp.set(H.whale.x, 0, H.whale.z), 60, [new THREE.Color('#eaf6ff'), new THREE.Color('#9fd8ff')], { y: 0.5, up: 10, spread: 8, grav: 10, life: 1.6 }); }
          if (k > 0.82 && k < 0.86) fx?.burst(tmp.set(H.whale.x, 0, H.whale.z + 3), 50, [new THREE.Color('#eaf6ff'), new THREE.Color('#9fd8ff')], { y: 0.5, up: 9, spread: 9, grav: 10, life: 1.4 }); }
        else { whaleWas = false; whale.position.y = -12; } }
      beam.rotation.y = t * 0.8; beam.material.opacity = ev.night * 0.22; lamp.material.color.setRGB(1, 0.95, 0.7 + ev.night * 0.3);
      // grotto
      heart.rotation.y = t * 0.5; heart.position.y = 3.4 + Math.sin(t * 1.2) * 0.25; heartRing.rotation.x = Math.PI / 2 + Math.sin(t * 0.7) * 0.4; heartRing.rotation.y = t * 0.3; heartMat.emissiveIntensity = 1 + Math.sin(t * 2) * 0.3; heartRing.position.y = heart.position.y;
      poolMat.opacity = 0.65 + Math.sin(t * 2.3) * 0.15; gem.rotation.y = t * 1.5; gemMat.color.setHSL((t * 0.15) % 1, 0.9, 0.65);
      moths.forEach(m => { m.a += dt * m.sp; m.o.position.set(GR.moths.x + Math.cos(m.a) * m.r, GR.moths.y + m.h * 0.5 + Math.sin(m.a * 2.3) * 0.5, GR.moths.z + Math.sin(m.a * 1.3) * m.r); });
      caveLights.forEach((l, i) => l.intensity = (mobile ? 30 : 18) * (0.85 + Math.sin(t * 1.7 + i) * 0.15));
      // woods: owl perches + head turns, fox wander + pounce, hares hop, reindeer graze, yeti at night
      owl.userData.head.rotation.y = Math.sin(t * 0.45) * 1.5 * (Math.sin(t * 0.13) > 0 ? 1 : 0.3);
      owlT -= dt; if (!owlFly && owlT <= 0) { const nx = (owlPerch + 1 + (Math.random() * 2 | 0)) % W.owlPerches.length; owlFly = { from: owl.position.clone(), to: owlHome(nx), k: 0, i: nx }; if (near(owl.position.x, owl.position.z, 30)) audio?.play('sfx_owl_hoot', 0.6); }
      if (owlFly) { owlFly.k += dt / 3; const k = Math.min(1, owlFly.k); owl.position.lerpVectors(owlFly.from, owlFly.to, k); owl.position.y += Math.sin(k * Math.PI) * 4; owl.rotation.y = Math.atan2(owlFly.to.x - owlFly.from.x, owlFly.to.z - owlFly.from.z); owl.userData.wings.forEach((w, j) => w.rotation.z = (j ? 1 : -1) * (0.3 + Math.abs(Math.sin(t * 14)) * 1.2)); if (k >= 1) { owlPerch = owlFly.i; owlFly = null; owlT = 20 + Math.random() * 14; owl.userData.wings.forEach(w => w.rotation.z = 0); } }
      { const f = fox.position; foxS.pounce -= dt; if (foxS.pT >= 0) { foxS.pT += dt; const k = foxS.pT / 0.9; f.y = Math.sin(Math.min(1, k) * Math.PI) * 1.1; fox.rotation.x = (k - 0.5) * 1.2; if (k >= 1) { foxS.pT = -1; f.y = 0; fox.rotation.x = 0; fx?.burst(f, 18, new THREE.Color('#f4f8ff'), { y: 0.2, up: 3, spread: 3, life: 0.7 }); foxS.pounce = 9 + Math.random() * 6; } }
        else { const dx = foxS.tx - f.x, dz = foxS.tz - f.z, d = Math.hypot(dx, dz); if (d < 0.3) { foxS.wait -= dt; if (foxS.wait <= 0) { const a = Math.random() * 6.28, r = Math.random() * W.foxHome.r; foxS.tx = W.foxHome.x + Math.cos(a) * r; foxS.tz = W.foxHome.z + Math.sin(a) * r; foxS.wait = 1 + Math.random() * 3; } fox.userData.tail.rotation.y = Math.sin(t * 3) * 0.3; }
          else { f.x += dx / d * 2.6 * dt; f.z += dz / d * 2.6 * dt; fox.rotation.y = Math.atan2(dx, dz); fox.userData.legs.forEach((l, i) => l.rotation.x = Math.sin(t * 16 + i * 1.6) * 0.5); }
          if (foxS.pounce <= 0 && d < 0.3) { foxS.pT = 0; if (near(f.x, f.z, 25)) audio?.play('sfx_fox_yip', 0.6); } }
        fox.userData.head.rotation.x = Math.sin(t * 2) * 0.1; }
      hares.forEach((h, i) => { h.hop -= dt; const o = h.o; if (h.hop <= 0) { h.hop = 0.6 + Math.random() * 2.2; const a = Math.random() * 6.28; h.tx = W.hares.x + Math.cos(a) * 3; h.tz = W.hares.z + Math.sin(a) * 3; o.rotation.y = Math.atan2(h.tx - o.position.x, h.tz - o.position.z); h.k = 0; }
        if (h.k !== undefined && h.k < 1) { h.k = Math.min(1, h.k + dt * 2.5); o.position.x += (h.tx - o.position.x) * dt * 2.5; o.position.z += (h.tz - o.position.z) * dt * 2.5; o.position.y = Math.sin(h.k * Math.PI) * 0.35; } });
      deer.userData.head.rotation.x = 0.5 + Math.sin(t * 0.6) * 0.5; deer.userData.head.position.y = 1.75 - Math.max(0, Math.sin(t * 0.6)) * 0.6;
      { const want = ev.night > 0.5; if (want !== yeti.visible) yeti.visible = want; if (yeti.visible) { yeti.rotation.z = Math.sin(t * 0.8) * 0.06; yeti.position.x = W.yeti.x + Math.sin(t * 0.3) * 1.5; yeti.userData.head.rotation.y = Math.sin(t * 0.5) * 0.4; } }
      cone_.rotation.y = t;
      // village
      flames.forEach((f, i) => { const s = 0.4 + Math.sin(t * (9 + i * 3) + i) * 0.08; f.scale.set(s, 1.1 + Math.sin(t * 7 + i * 2) * 0.25 - i * 0.15, s); f.position.y = 0.75 + f.scale.y * 0.45; }); if (fireLight) fireLight.intensity = 18 + Math.sin(t * 13) * 3 + Math.sin(t * 7.3) * 2;
      if (near(BF.x, BF.z, 30) && Math.random() < dt * 8) fx?.emit(BF.x + (Math.random() - 0.5) * 0.6, 1.4, BF.z + (Math.random() - 0.5) * 0.6, 0, 1.6, 0, 0.6, new THREE.Color('#ffb060'), 1.2, -0.3);
      choirT += dt; const sing = (choirT % 10) < 6.5; choir.forEach((c, i) => { c.position.y = sing ? Math.abs(Math.sin(t * 4 + i)) * 0.12 : 0; c.rotation.x = sing ? -0.12 - Math.sin(t * 4 + i) * 0.06 : 0; c.userData.wings.forEach((w, j) => w.rotation.z = (j ? 1 : -1) * (sing ? 0.6 + Math.sin(t * 4 + i) * 0.3 : 0.25)); if (sing && near(CH.x, CH.z, 26) && Math.random() < dt * 1.2) fx?.emit(c.position.x, 2.1, c.position.z, 0, 1.4, 0, 0.5, new THREE.Color(['#ffd76a', '#ff7fb0', '#7fffc8'][i]), 1.4, -0.4); });
      { const k = ev.snowman.k; let y = 0; snowBalls.forEach((b, i) => { const g = Math.min(1, Math.max(0, k * 3 - i)); const r = b.userData.r * (0.2 + 0.8 * g); b.scale.setScalar(r); b.visible = g > 0; b.position.y = y + r * 0.9; y += r * 1.7; }); smHat.visible = smNose.visible = ev.snowman.done; smHat.position.y = y + 0.1; smNose.position.y = y - 0.35; builder.rotation.y = ev.snowman.done ? 0.3 : 1.6; builder.position.y = ev.snowman.done ? Math.abs(Math.sin(t * 6)) * 0.3 : 0; builder.userData.wings.forEach((w, j) => w.rotation.z = (j ? 1 : -1) * (ev.snowman.done ? 1.2 + Math.sin(t * 10) * 0.3 : 0.3 + Math.abs(Math.sin(t * 6)) * 0.4)); }
      sledders.forEach(s => { s.t += dt; const cyc = s.t % 7; if (cyc < 2.2) { const k = cyc / 2.2, pos = slope(Math.min(1, k * 1.15), s.a); s.m.position.copy(pos); if (k > 0.86) { s.air = true; s.m.position.y = Math.sin((k - 0.86) / 0.14 * Math.PI) * 0.6; tmp.set(Math.cos(s.a), 0, Math.sin(s.a)).multiplyScalar(SH.r * (1.15 + (k - 0.86) * 2)); s.m.position.x = SH.x + tmp.x; s.m.position.z = SH.z + tmp.z; } else s.air = false; s.m.rotation.y = Math.atan2(Math.cos(s.a), Math.sin(s.a)); s.m.rotation.x = 0.35 * (1 - k); }
        else { s.air = false; const k = (cyc - 2.2) / 4.8, pos = slope(1.25 - k * 1.25, s.a + 0.25); s.m.position.copy(pos); s.m.rotation.y = Math.atan2(-Math.cos(s.a), -Math.sin(s.a)); s.m.rotation.x = -0.2; } });
      // garden
      rose.rotation.y = t * 0.6; chipT += dt; if (chipT > 1.1) chipT = 0; hammer.rotation.x = -Math.min(1, chipT * 2) * 1.4 + (chipT < 0.15 ? 1.4 : 0); if (chipT < dt && near(SC.x, SC.z, 22)) fx?.burst(tmp.set(SC.x + 0.8, 0, SC.z), 6, new THREE.Color('#dff6ff'), { y: 1, up: 2, spread: 2, life: 0.5 });
      // wandering locals (cheap, within their home radius) + distance culling for groups
      for (const a of actors) { const m = a.m; a.ph += dt; const vis = near(m.position.x, m.position.z, mobile ? 55 : 75); m.visible = vis; if (!vis) continue;
        const dx = a.tx - m.position.x, dz = a.tz - m.position.z, d = Math.hypot(dx, dz); let mv = false;
        if (d < 0.3) { a.wait -= dt; if (a.wait <= 0) { const ang = Math.random() * 6.28, r = Math.random() * a.r; a.tx = a.home[0] + Math.cos(ang) * r; a.tz = a.home[1] + Math.sin(ang) * r; a.wait = 2 + Math.random() * 5; } }
        else { m.position.x += dx / d * 1.4 * dt; m.position.z += dz / d * 1.4 * dt; m.rotation.y = Math.atan2(dx, dz); mv = true; }
        m.rotation.z = mv ? Math.sin(a.ph * 9) * 0.12 : 0; m.userData.wings.forEach((w, i) => w.rotation.z = (i ? 1 : -1) * (0.25 + (mv ? Math.abs(Math.sin(a.ph * 9)) * 0.2 : 0))); }
      for (const g of [seal, pup, fox, deer, owl, whale, ...puffins]) g.visible = g === whale ? ev.whale.active : near(g.position.x, g.position.z, 110);
      // ambient critter calls when close
      if (Math.random() < dt * 0.12) { if (near(H.seal.x, H.seal.z, 26)) audio?.play('sfx_seal_bark', 0.5); else if (near(H.puffinRock.x, H.puffinRock.z, 22)) audio?.play('sfx_puffin', 0.5); else if (near(GR.x, GR.z, GR.r)) audio?.play('sfx_crystal_chime', 0.35); }
    },
    dispose() { disp.forEach(d => { d.map?.dispose?.(); d.dispose?.(); }); disposeCreatureMats(); },
  };
  return world;
}
