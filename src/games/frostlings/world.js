// Frostlings world: Snowdrift Village hub + 4 areas joined by corridors (one scene, so everyone shares it in MP).
// Builds terrain, boundaries (instanced trees/rocks/spires w/ collision circles), stations, area props, gates,
// sky (day/night + aurora + stars) and a per-player battle stage far from the map.
import * as THREE from 'three';
import { AREAS, TAMERS } from './config.js';
import { mat } from './models.js';

const rand = (a, b) => a + Math.random() * (b - a);
function seeded(seed) { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; }
export function glowTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.3, 'rgba(255,255,255,.6)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
export function textSprite(text, { color = '#fff', size = 1, bg = null, font = 900, px = 46, w = 512 } = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = 128; const g = c.getContext('2d');
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `${font} ${px}px system-ui, sans-serif`;
  if (bg) { const tw = Math.min(w - 8, g.measureText(text).width + 44); g.fillStyle = bg; g.beginPath(); g.roundRect((w - tw) / 2, 18, tw, 92, 40); g.fill(); }
  else { g.lineWidth = 10; g.strokeStyle = 'rgba(16,20,48,.9)'; g.strokeText(text, w / 2, 64); }
  g.fillStyle = color; g.fillText(text, w / 2, 66);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false })); s.scale.set(size * w / 128, size, 1); s.renderOrder = 5; return s;
}

// instanced props: parts = [{geo, mat, y, sx, sy, sz}] ; transforms = [{x, z, s, ry}]
function instanced(scene, parts, items) {
  const dummy = new THREE.Object3D(), out = [];
  for (const p of parts) {
    const im = new THREE.InstancedMesh(p.geo, p.mat, items.length); im.castShadow = !!p.shadow;
    items.forEach((it, i) => { dummy.position.set(it.x, (it.y || 0) + p.y * it.s, it.z); dummy.rotation.set(0, it.ry || 0, 0); dummy.scale.set(p.sx * it.s, p.sy * it.s, p.sz * it.s); dummy.updateMatrix(); im.setMatrixAt(i, dummy.matrix); });
    scene.add(im); out.push(im);
  }
  return out;
}
const CONE = new THREE.ConeGeometry(1, 1, 7), CYL = new THREE.CylinderGeometry(1, 1, 1, 7), BOXG = new THREE.BoxGeometry(1, 1, 1), DODE = new THREE.DodecahedronGeometry(1, 0), OCTA = new THREE.OctahedronGeometry(1, 0);
const PINE = () => [
  { geo: CYL, mat: mat('#6b4423'), y: 0.9, sx: 0.35, sy: 1.8, sz: 0.35 },
  { geo: CONE, mat: mat('#2f7d5b'), y: 2.6, sx: 2.2, sy: 2.6, sz: 2.2, shadow: true }, { geo: CONE, mat: mat('#ffffff'), y: 3.5, sx: 1.4, sy: 1.0, sz: 1.4 },
  { geo: CONE, mat: mat('#36906a'), y: 4.0, sx: 1.6, sy: 2.2, sz: 1.6, shadow: true }, { geo: CONE, mat: mat('#ffffff'), y: 4.8, sx: 0.9, sy: 0.8, sz: 0.9 },
];
const ROCK = (c = '#8d94a8') => [{ geo: DODE, mat: mat(c, { flatShading: true }), y: 0.6, sx: 1.6, sy: 1.3, sz: 1.5, shadow: true }];
const SPIRE = (c = '#bfe6ff') => [{ geo: CONE, mat: mat(c, { roughness: 0.15, metalness: 0.1, emissive: c, emissiveIntensity: 0.15 }), y: 2.5, sx: 1.1, sy: 5, sz: 1.1, shadow: true }];
const CRYSTAL = (c) => [{ geo: OCTA, mat: mat(c, { roughness: 0.15, emissive: c, emissiveIntensity: 0.55 }), y: 1.3, sx: 0.6, sy: 1.6, sz: 0.6 }];

// corridor directions from village: area -> unit vector
export const DIRS = { meadow: [0, -1], caverns: [1, 0], coast: [0, 1], peak: [-1, 0] };
const CORR_W = 6;     // half-width of path corridors

export function buildWorld(collision) {
  const scene = new THREE.Scene();
  const V = AREAS.village;
  scene.background = new THREE.Color(V.sky); scene.fog = new THREE.Fog(V.fog, 60, 170);
  const hemi = new THREE.HemisphereLight('#eaf6ff', '#8fb3d6', 1.4); scene.add(hemi);
  const sun = new THREE.DirectionalLight('#fff4dc', 1.5); sun.position.set(40, 70, 25); sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024); Object.assign(sun.shadow.camera, { left: -40, right: 40, top: 40, bottom: -40, near: 1, far: 200 }); scene.add(sun, sun.target);
  const amb = new THREE.AmbientLight('#9fb8ff', 0.15); scene.add(amb);
  const glowTex = glowTexture();
  const disc = (r, color, x, z, y = 0.01, seg = 48) => { const m = new THREE.Mesh(new THREE.CircleGeometry(r, seg), mat(color)); m.rotation.x = -Math.PI / 2; m.position.set(x, y, z); m.receiveShadow = true; scene.add(m); return m; };
  const bx = (w, h, d, m, x, y, z, solid = false, ry = 0) => { const b = new THREE.Mesh(BOXG, m); b.scale.set(w, h, d); b.position.set(x, y + h / 2, z); b.rotation.y = ry; b.castShadow = b.receiveShadow = true; scene.add(b); if (solid) collision.addBox(x - w / 2, y, z - d / 2, x + w / 2, y + h, z + d / 2); return b; };

  // ground
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(700, 700), mat('#f2f8ff')); ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
  for (const a of Object.values(AREAS)) disc(a.r + 3, a.ground, a.x, a.z, 0.012, 64);
  // paths
  const pathM = mat('#d9e4ef');
  for (const [id, [dx, dz]] of Object.entries(DIRS)) {
    const A = AREAS[id], len = Math.hypot(A.x, A.z), mid = len / 2;
    const p = new THREE.Mesh(new THREE.PlaneGeometry(CORR_W * 1.4, len), pathM); p.rotation.x = -Math.PI / 2; p.rotation.z = Math.atan2(dx, -dz) ; p.position.set(dx * mid, 0.02, dz * mid); p.receiveShadow = true; scene.add(p);
  }
  disc(14, '#e6eef7', 0, 0, 0.022);

  // ---------- boundaries: ring of props around each region with gaps for corridors ----------
  const ringItems = { pine: [], rock: [], spire: [], crystal: [] };
  const inCorridor = (x, z) => { for (const [id, [dx, dz]] of Object.entries(DIRS)) { const A = AREAS[id], len = Math.hypot(A.x, A.z), along = x * dx + z * dz, lat = Math.abs(x * dz - z * dx); if (along > 20 && along < len - 20 && lat < CORR_W + 1.5) return true; if (along > 0 && along < len && lat < CORR_W + 1.2) return true; } return false; };
  const R = seeded(42);
  const ringFor = (A, kind, step = 3.4) => {
    const n = Math.round(Math.PI * 2 * (A.r + 1) / step);
    for (let i = 0; i < n; i++) {
      const a = i / n * Math.PI * 2, x = A.x + Math.cos(a) * (A.r + 1), z = A.z + Math.sin(a) * (A.r + 1);
      if (inCorridor(x, z)) continue;
      const s = 0.85 + R() * 0.5; ringItems[kind].push({ x, z, s, ry: R() * 6 }); collision.addCircle(x, z, 1.5);
      // second, outer row for depth (no collision)
      const x2 = A.x + Math.cos(a + 0.05) * (A.r + 5 + R() * 3), z2 = A.z + Math.sin(a + 0.05) * (A.r + 5 + R() * 3);
      if (!inCorridor(x2, z2)) ringItems[kind].push({ x: x2, z: z2, s: s * 1.2, ry: R() * 6 });
    }
  };
  ringFor(AREAS.village, 'pine'); ringFor(AREAS.meadow, 'pine'); ringFor(AREAS.caverns, 'rock', 3); ringFor(AREAS.coast, 'rock', 3.2); ringFor(AREAS.peak, 'spire', 3.2);
  // corridor walls (hedge of pines/rocks) + collision boxes
  for (const [id, [dx, dz]] of Object.entries(DIRS)) {
    const A = AREAS[id], len = Math.hypot(A.x, A.z), from = AREAS.village.r - 2, to = len - A.r + 2;
    for (const side of [-1, 1]) {
      const lx = dz * side * (CORR_W + 1.2), lz = -dx * side * (CORR_W + 1.2);   // perpendicular offset
      for (let d = from; d <= to; d += 3) ringItems[id === 'caverns' || id === 'coast' ? 'rock' : id === 'peak' ? 'spire' : 'pine'].push({ x: dx * d + lx, z: dz * d + lz, s: 0.9 + R() * 0.3, ry: R() * 6 });
      const cx = dx * (from + to) / 2 + lx, cz = dz * (from + to) / 2 + lz, hl = (to - from) / 2;
      collision.addBox(cx - (dx ? hl : 1), 0, cz - (dz ? hl : 1), cx + (dx ? hl : 1), 6, cz + (dz ? hl : 1));
    }
  }
  // interior decor
  const deco = (A, kind, n, minR = 10, solid = true, s0 = 0.8, s1 = 1.4) => {
    for (let i = 0; i < n; i++) {
      const a = R() * Math.PI * 2, r = minR + R() * (A.r - minR - 6), x = A.x + Math.cos(a) * r, z = A.z + Math.sin(a) * r;
      if (inCorridor(x, z)) continue; const s = s0 + R() * (s1 - s0);
      ringItems[kind].push({ x, z, s, ry: R() * 6 }); if (solid) collision.addCircle(x, z, kind === 'crystal' ? 0.7 * s : 1.2 * s);
    }
  };
  deco(AREAS.meadow, 'pine', 16, 12); deco(AREAS.caverns, 'rock', 10, 12); deco(AREAS.coast, 'rock', 9, 12, true, 0.6, 1.1); deco(AREAS.peak, 'spire', 12, 12, true, 0.5, 1);
  instanced(scene, PINE(), ringItems.pine); instanced(scene, ROCK('#7d7290'), ringItems.rock.filter(t => Math.hypot(t.x - AREAS.caverns.x, t.z) < 70));
  instanced(scene, ROCK('#8d9aa8'), ringItems.rock.filter(t => Math.hypot(t.x - AREAS.caverns.x, t.z) >= 70)); instanced(scene, SPIRE(), ringItems.spire);
  // caverns crystals (+ tall rock walls behind ring for a cave feel)
  const cr = [], cr2 = []; const C = AREAS.caverns;
  for (let i = 0; i < 40; i++) { const a = R() * 6.283, r = 8 + R() * (C.r - 12), x = C.x + Math.cos(a) * r, z = C.z + Math.sin(a) * r; if (inCorridor(x, z)) continue; (i % 2 ? cr : cr2).push({ x, z, s: 0.5 + R() * 1.1, ry: R() * 6 }); if (i % 3 === 0) collision.addCircle(x, z, 0.6); }
  instanced(scene, CRYSTAL('#c79bff'), cr); instanced(scene, CRYSTAL('#7fe8ff'), cr2);
  const wallItems = []; for (let i = 0; i < 48; i++) { const a = i / 48 * 6.283, x = C.x + Math.cos(a) * (C.r + 9), z = C.z + Math.sin(a) * (C.r + 9); if (!inCorridor(x, z) && x > 50) wallItems.push({ x, z, s: 2.4 + R() * 1.5, ry: R() * 6 }); }
  instanced(scene, [{ geo: DODE, mat: mat('#4a3f66', { flatShading: true }), y: 2.5, sx: 2.2, sy: 3.4, sz: 2.2 }], wallItems);
  const glowMush = []; for (let i = 0; i < 22; i++) { const a = R() * 6.283, r = 6 + R() * (C.r - 8); glowMush.push({ x: C.x + Math.cos(a) * r, z: Math.sin(a) * r, s: 0.4 + R() * 0.4, ry: 0 }); }
  instanced(scene, [{ geo: CYL, mat: mat('#e8dcff'), y: 0.4, sx: 0.15, sy: 0.8, sz: 0.15 }, { geo: new THREE.SphereGeometry(1, 10, 6, 0, 6.283, 0, 1.6), mat: mat('#ff9ce8', { emissive: '#ff7ad9', emissiveIntensity: 0.9 }), y: 0.8, sx: 0.55, sy: 0.4, sz: 0.55 }], glowMush);
  // meadow flowers + pond + Holly's tent
  const M = AREAS.meadow, flowers = [[], [], []];
  for (let i = 0; i < 120; i++) { const a = R() * 6.283, r = R() * (M.r - 4); flowers[i % 3].push({ x: M.x + Math.cos(a) * r, z: M.z + Math.sin(a) * r, s: 1, ry: R() * 3 }); }
  ['#ff9fd0', '#ffe066', '#a8d8ff'].forEach((c, i) => instanced(scene, [{ geo: BOXG, mat: mat(c, { emissive: c, emissiveIntensity: 0.15 }), y: 0.18, sx: 0.22, sy: 0.22, sz: 0.22 }, { geo: BOXG, mat: mat('#5fae7a'), y: 0.06, sx: 0.06, sy: 0.12, sz: 0.06 }], flowers[i]));
  const pond = disc(7, '#9fd8ff', M.x - 18, M.z + 8, 0.03); pond.material = mat('#9fd8ff', { roughness: 0.1, metalness: 0.2 });
  const tent = new THREE.Mesh(new THREE.ConeGeometry(3.4, 4, 4), mat('#2f7d5b')); tent.position.set(M.x + 6, 2, M.z - 38); tent.rotation.y = Math.PI / 4; scene.add(tent); collision.addCircle(M.x + 6, M.z - 38, 2.6);
  // coast: ocean beyond the south rim + tidepools + dock + boat
  const K = AREAS.coast;
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(260, 120, 40, 20), new THREE.MeshStandardMaterial({ color: '#4fa3ff', roughness: 0.15, metalness: 0.25, transparent: true, opacity: 0.92 }));
  sea.rotation.x = -Math.PI / 2; sea.position.set(0, -0.05, K.z + K.r + 50); scene.add(sea);
  const shore = new THREE.Mesh(new THREE.PlaneGeometry(130, 26, 30, 4), new THREE.MeshStandardMaterial({ color: '#7cc6ff', roughness: 0.1, transparent: true, opacity: 0.75 })); shore.rotation.x = -Math.PI / 2; shore.position.set(0, 0.04, K.z + 34); scene.add(shore);
  collision.addBox(-60, 0, K.z + 30, 60, 4, K.z + 60);   // no swimming
  for (let i = 0; i < 9; i++) { const a = R() * 6.283, r = 8 + R() * 28; const tp = disc(1.5 + R() * 2, '#5fb4ff', K.x + Math.cos(a) * r, K.z - 8 + Math.sin(a) * r * 0.6, 0.03, 20); tp.material = mat('#5fb4ff', { roughness: 0.1, metalness: 0.3, emissive: '#1c5bb8', emissiveIntensity: 0.15 }); }
  const shells = []; for (let i = 0; i < 40; i++) { const a = R() * 6.283, r = R() * 40; shells.push({ x: K.x + Math.cos(a) * r, z: K.z + Math.sin(a) * r * 0.7, s: 0.25 + R() * 0.2, ry: R() * 6 }); }
  instanced(scene, [{ geo: new THREE.SphereGeometry(1, 8, 5, 0, 6.283, 0, 1.4), mat: mat('#ffd2dc'), y: 0, sx: 1, sy: 0.6, sz: 1 }], shells);
  const wood = mat('#a8774a'), woodD = mat('#7a5232');
  bx(4, 0.4, 16, wood, 12, 0.3, K.z + 26); for (const z of [K.z + 20, K.z + 26, K.z + 32]) for (const x of [10.3, 13.7]) bx(0.4, 1.6, 0.4, woodD, x, -0.5, z);
  const boat = new THREE.Group(); boat.position.set(20, 0, K.z + 32); scene.add(boat);
  const hull = new THREE.Mesh(BOXG, mat('#c0392b')); hull.scale.set(4, 1.4, 8); hull.position.y = 0.4; boat.add(hull);
  const mast = new THREE.Mesh(BOXG, woodD); mast.scale.set(0.3, 7, 0.3); mast.position.y = 4; boat.add(mast);
  const sail = new THREE.Mesh(BOXG, mat('#ffffff')); sail.scale.set(0.1, 4, 3.4); sail.position.set(0, 4.6, 0.2); boat.add(sail);
  // peak: shrine + snow mounds
  const P = AREAS.peak;
  const shrineM = mat('#e6ecff'), shrineA = mat('#ff7ad9', { emissive: '#ff7ad9', emissiveIntensity: 0.6 });
  for (let i = 0; i < 6; i++) { const a = i / 6 * 6.283; bx(1, 5, 1, shrineM, P.x - 30 + Math.cos(a) * 7, 0, P.z + Math.sin(a) * 7, true); bx(1.3, 0.4, 1.3, shrineA, P.x - 30 + Math.cos(a) * 7, 5, P.z + Math.sin(a) * 7); }
  disc(6, '#ffe9fb', P.x - 30, P.z, 0.03);
  const mounds = []; for (let i = 0; i < 18; i++) { const a = R() * 6.283, r = R() * 44; mounds.push({ x: P.x + Math.cos(a) * r, z: P.z + Math.sin(a) * r, s: 1 + R() * 2, ry: 0 }); }
  instanced(scene, [{ geo: new THREE.SphereGeometry(1, 12, 6, 0, 6.283, 0, 1.3), mat: mat('#ffffff'), y: -0.3, sx: 2, sy: 0.6, sz: 2 }], mounds);

  // ---------- village ----------
  const stations = [];
  const cottage = (x, z, wall, roof, ry = 0, w = 7, d = 6) => {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; scene.add(g);
    const b = new THREE.Mesh(BOXG, mat(wall)); b.scale.set(w, 3.6, d); b.position.y = 1.8; b.castShadow = b.receiveShadow = true; g.add(b);
    const r = new THREE.Mesh(new THREE.ConeGeometry(Math.hypot(w, d) / 2 + 0.6, 3, 4), mat(roof)); r.rotation.y = Math.PI / 4; r.position.y = 5.1; r.scale.z = d / w; r.castShadow = true; g.add(r);
    const snow = new THREE.Mesh(new THREE.ConeGeometry(Math.hypot(w, d) / 2 + 0.3, 1.2, 4), mat('#ffffff')); snow.rotation.y = Math.PI / 4; snow.position.y = 6.3; snow.scale.z = d / w; g.add(snow);
    const door = new THREE.Mesh(BOXG, mat('#7a5232')); door.scale.set(1.4, 2.3, 0.2); door.position.set(0, 1.15, d / 2 + 0.05); g.add(door);
    for (const sx of [-1, 1]) { const wn = new THREE.Mesh(BOXG, mat('#ffe9a8', { emissive: '#ffcf6a', emissiveIntensity: 0.6 })); wn.scale.set(1.1, 1, 0.15); wn.position.set(sx * (w / 2 - 1.5), 2.1, d / 2 + 0.05); g.add(wn); }
    const c = Math.cos(ry), s = Math.sin(ry), hw = Math.abs(c) * w / 2 + Math.abs(s) * d / 2, hd = Math.abs(s) * w / 2 + Math.abs(c) * d / 2;
    collision.addBox(x - hw, 0, z - hd, x + hw, 4, z + hd); return g;
  };
  const sign = (text, x, y, z, bg = 'rgba(255,255,255,.92)', color = '#1d4f7a') => { const s = textSprite(text, { bg, color, size: 1.3, px: 52 }); s.position.set(x, y, z); scene.add(s); return s; };
  // Care Den (NW), Shop (NE), Frostdex kiosk (W), Quest board (E), Battle Ring (S)
  cottage(-19, -16, '#ffd9e6', '#d94b7a', Math.PI / 4); sign('🏠 Care Den', -19, 8.4, -16);
  stations.push({ id: 'den', x: -15.5, z: -12.5, r: 3.6, label: 'Care Den', icon: '🏠' });
  cottage(19, -16, '#fff0c8', '#2f86c4', -Math.PI / 4); sign('🛒 Snow Shop', 19, 8.4, -16);
  stations.push({ id: 'shop', x: 15.5, z: -12.5, r: 3.6, label: 'Snow Shop', icon: '🛒' });
  for (const [x, z, ry, wall, roof] of [[-24, 4, Math.PI / 2, '#e6f0ff', '#7a3fd0'], [24, 6, -Math.PI / 2, '#e8ffe6', '#2a9a68'], [-12, 26, Math.PI * 0.8, '#fff', '#c4461a'], [13, 26, -Math.PI * 0.8, '#f0e6ff', '#a43b9a']]) cottage(x, z, wall, roof, ry, 6, 5);
  // quest board
  const qb = new THREE.Group(); qb.position.set(9, 0, -2); qb.rotation.y = -Math.PI / 2.4; scene.add(qb);
  for (const sx of [-1.6, 1.6]) { const p = new THREE.Mesh(BOXG, woodD); p.scale.set(0.3, 3.4, 0.3); p.position.set(sx, 1.7, 0); qb.add(p); }
  const board = new THREE.Mesh(BOXG, wood); board.scale.set(3.8, 2.2, 0.2); board.position.y = 2.3; qb.add(board);
  ['#fff6c8', '#ffd2f2', '#dff3ff', '#e8ffe6'].forEach((c, i) => { const n = new THREE.Mesh(BOXG, mat(c)); n.scale.set(0.7, 0.8, 0.05); n.position.set(-1.2 + i * 0.8, 2.3 + (i % 2) * 0.3, 0.12); n.rotation.z = (i - 1.5) * 0.08; qb.add(n); });
  collision.addCircle(9, -2, 1.6); sign('📜 Quests', 9, 4.6, -2);
  stations.push({ id: 'quests', x: 9, z: -2, r: 3.4, label: 'Quest Board', icon: '📜' });
  // Frostdex kiosk
  const kiosk = new THREE.Group(); kiosk.position.set(-9, 0, -2); scene.add(kiosk);
  const ped = new THREE.Mesh(CYL, mat('#bfe6ff', { roughness: 0.2 })); ped.scale.set(1, 1.6, 1); ped.position.y = 0.8; kiosk.add(ped);
  const book = new THREE.Mesh(BOXG, mat('#ff7ad9', { emissive: '#ff7ad9', emissiveIntensity: 0.5 })); book.scale.set(1.4, 0.25, 1); book.position.y = 1.9; book.rotation.x = -0.3; kiosk.add(book);
  const orb = new THREE.Mesh(new THREE.IcosahedronGeometry(0.4, 1), mat('#ffffff', { emissive: '#8fd8ff', emissiveIntensity: 1 })); orb.position.y = 2.8; kiosk.add(orb);
  collision.addCircle(-9, -2, 1.3); sign('📖 Frostdex', -9, 4.4, -2);
  stations.push({ id: 'dex', x: -9, z: -2, r: 3.2, label: 'Frostdex', icon: '📖' });
  // frozen fountain (center north)
  const f = new THREE.Mesh(CYL, mat('#cfe8ff', { roughness: 0.2 })); f.scale.set(4, 0.8, 4); f.position.set(0, 0.4, -10); scene.add(f);
  const f2 = new THREE.Mesh(CONE, mat('#bfe6ff', { roughness: 0.1, emissive: '#8fd8ff', emissiveIntensity: 0.25 })); f2.scale.set(1.3, 4, 1.3); f2.position.set(0, 2.6, -10); scene.add(f2);
  collision.addCircle(0, -10, 4.1, 0.8);
  // Battle Ring (south)
  const RING = { x: 0, z: 16, r: 6 };
  const ringPlat = new THREE.Mesh(CYL, mat('#e8f0ff')); ringPlat.scale.set(RING.r, 0.3, RING.r); ringPlat.position.set(RING.x, 0.15, RING.z); ringPlat.receiveShadow = true; scene.add(ringPlat);
  const ringLine = new THREE.Mesh(new THREE.TorusGeometry(RING.r - 0.4, 0.12, 6, 48), mat('#ff5d8a', { emissive: '#ff5d8a', emissiveIntensity: 0.5 })); ringLine.rotation.x = -Math.PI / 2; ringLine.position.set(RING.x, 0.32, RING.z); scene.add(ringLine);
  for (let i = 0; i < 8; i++) { const a = i / 8 * 6.283; const p = new THREE.Mesh(BOXG, mat(i % 2 ? '#3fa8ff' : '#ff5d8a')); p.scale.set(0.4, 1.6, 0.4); p.position.set(RING.x + Math.cos(a) * RING.r, 0.8, RING.z + Math.sin(a) * RING.r); scene.add(p); }
  sign('⚔ Battle Ring', RING.x, 4.2, RING.z + RING.r + 0.5);
  stations.push({ id: 'ring', x: RING.x, z: RING.z, r: RING.r, label: 'Battle Ring', icon: '⚔' });
  // lamp posts w/ glow
  const lampItems = []; for (let i = 0; i < 12; i++) { const a = i / 12 * 6.283 + 0.26; lampItems.push({ x: Math.cos(a) * 29, z: Math.sin(a) * 29, s: 1, ry: 0 }); }
  instanced(scene, [{ geo: BOXG, mat: mat('#3a3550'), y: 1.6, sx: 0.2, sy: 3.2, sz: 0.2 }, { geo: BOXG, mat: mat('#fff3c4', { emissive: '#ffcf6a', emissiveIntensity: 1.2 }), y: 3.4, sx: 0.5, sy: 0.6, sz: 0.5 }], lampItems);
  // area entrance signs
  const areaSign = {};
  for (const [id, [dx, dz]] of Object.entries(DIRS)) { const s = sign(`${AREAS[id].name}`, dx * 40, 5.5, dz * 40, 'rgba(16,30,60,.78)', '#ffffff'); areaSign[id] = s; }

  // ---------- gates (ice walls on locked corridors) ----------
  const gates = {};
  for (const id of ['caverns', 'coast', 'peak']) {
    const [dx, dz] = DIRS[id], d = 46, x = dx * d, z = dz * d, w = CORR_W * 2 + 2;
    const m = new THREE.Mesh(BOXG, new THREE.MeshStandardMaterial({ color: '#bfe6ff', roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.82, emissive: '#5fb4ff', emissiveIntensity: 0.25 }));
    m.scale.set(dx ? 1.6 : w, 6, dz ? 1.6 : w); m.position.set(x, 3, z); scene.add(m);
    const box = collision.addBox(x - (dx ? 0.8 : w / 2), 0, z - (dz ? 0.8 : w / 2), x + (dx ? 0.8 : w / 2), 6, z + (dz ? 0.8 : w / 2));
    const T = TAMERS[AREAS[id].unlock];
    const lock = textSprite(`🔒 Beat ${T.name}`, { bg: 'rgba(16,30,60,.85)', color: '#ffe680', size: 1.1, px: 44 }); lock.position.set(x - dx * 1.5, 7.3, z - dz * 1.5); scene.add(lock);
    gates[id] = { mesh: m, box, lock, open: false, melt: 0 };
  }
  function openGate(id, instant = false) {
    const g = gates[id]; if (!g || g.open) return; g.open = true; collision.removeBox(g.box); g.lock.visible = false;
    if (instant) { g.mesh.visible = false; g.melt = 0; } else g.melt = 1.2;
  }

  // ---------- sky: stars + aurora ribbons ----------
  const starGeo = new THREE.BufferGeometry(), sp = [];
  for (let i = 0; i < 700; i++) { const u = Math.random(), v = Math.random() * 0.45 + 0.05, th = u * 6.283, ph = v * Math.PI / 2; sp.push(Math.cos(th) * Math.cos(ph) * 300, Math.sin(ph) * 300 + 10, Math.sin(th) * Math.cos(ph) * 300); }
  starGeo.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
  const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ size: 2.2, map: glowTex, transparent: true, opacity: 0, depthWrite: false, fog: false, color: '#ffffff' })); scene.add(stars);
  const auroraMat = new THREE.ShaderMaterial({
    uniforms: { t: { value: 0 }, k: { value: 0 } }, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, fog: false,
    vertexShader: 'varying vec2 vUv; uniform float t; void main(){ vUv=uv; vec3 p=position; p.z+=sin(p.x*0.03+t*0.4)*14.0; p.y+=sin(p.x*0.05+t*0.7)*3.0; gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.0); }',
    fragmentShader: 'varying vec2 vUv; uniform float t; uniform float k; void main(){ float band=smoothstep(0.0,0.35,vUv.y)*(1.0-smoothstep(0.45,1.0,vUv.y)); float w=0.55+0.45*sin(vUv.x*40.0+t*1.3)*sin(vUv.x*13.0-t*0.7); vec3 c=mix(vec3(0.2,1.0,0.7),vec3(1.0,0.4,0.85),vUv.y); gl_FragColor=vec4(c*band*w*k,band*w*k*0.9); }',
  });
  const auroras = [];
  for (let i = 0; i < 3; i++) { const m = new THREE.Mesh(new THREE.PlaneGeometry(420, 50, 80, 1), auroraMat); m.position.set(-60 + i * 50, 85 + i * 8, -120 + i * 70); m.rotation.y = 0.3 - i * 0.35; scene.add(m); auroras.push(m); }

  // region weighting for palette blending
  function regionAt(x, z) {
    let best = 'village', bw = 0;
    for (const a of Object.values(AREAS)) { const d = Math.hypot(x - a.x, z - a.z); const w = 1 - Math.min(1, Math.max(0, (d - a.r * 0.55) / (a.r * 0.6))); if (w > bw) { bw = w; best = a.id; } }
    return { id: best, w: bw };
  }
  const cSky = new THREE.Color(), cFog = new THREE.Color(), tmpC = new THREE.Color(), night = new THREE.Color('#141a3a'), nightFog = new THREE.Color('#1b2348');
  function update(dt, t, ph, auroraK, nightK, px, pz, sx = px, sz = pz) {
    const reg = regionAt(px, pz), A = AREAS[reg.id], V = AREAS.village;
    cSky.set(V.sky).lerp(tmpC.set(A.sky), reg.w); cFog.set(V.fog).lerp(tmpC.set(A.fog), reg.w);
    cSky.lerp(night, nightK * 0.85); cFog.lerp(nightFog, nightK * 0.8);
    scene.background.lerp(cSky, 1 - Math.exp(-3 * dt)); scene.fog.color.lerp(cFog, 1 - Math.exp(-3 * dt));
    const cave = reg.id === 'caverns' ? reg.w : 0;
    sun.intensity = (1.6 * (1 - nightK) + 0.25) * (1 - cave * 0.6); hemi.intensity = (1.4 * (1 - nightK * 0.6)) * (1 - cave * 0.35) + 0.2;
    sun.color.set(nightK > 0.5 ? '#a8b8ff' : '#fff4dc');
    sun.position.set(sx + 40, 70, sz + 25); sun.target.position.set(sx, 0, sz);
    stars.material.opacity = nightK * (1 - cave);
    auroraMat.uniforms.t.value = t; auroraMat.uniforms.k.value = Math.max(auroraK, reg.id === 'peak' ? reg.w * 0.35 + auroraK : 0) * (1 - cave);
    for (const m of auroras) m.position.x += Math.sin(t * 0.05) * 0.01;
    // sea + gates melt + kiosk orb
    const pos = sea.geometry.attributes.position; for (let i = 0; i < pos.count; i += 1) { const x = pos.getX(i), y = pos.getY(i); pos.setZ(i, Math.sin(x * 0.12 + t * 1.4) * 0.35 + Math.cos(y * 0.2 + t) * 0.3); } pos.needsUpdate = true;
    shore.material.opacity = 0.55 + Math.sin(t * 1.2) * 0.2;
    for (const g of Object.values(gates)) if (g.melt > 0) { g.melt -= dt; g.mesh.scale.y = Math.max(0.01, 6 * g.melt / 1.2); g.mesh.position.y = g.mesh.scale.y / 2; if (g.melt <= 0) g.mesh.visible = false; }
    orb.position.y = 2.8 + Math.sin(t * 2) * 0.15; orb.rotation.y = t;
    return reg;
  }
  // boss spots (stand + interact)
  const bossSpots = {
    holly: { x: M.x, z: M.z - 34 }, quartz: { x: C.x + 34, z: C.z }, brine: { x: K.x + 12, z: K.z + 18 }, borealis: { x: P.x - 30, z: P.z },
  };
  return { scene, sun, hemi, stations, gates, openGate, update, regionAt, bossSpots, glowTex, RING, areaSign };
}

// ---------- battle stage: built far away per player (offset) so the avatar can stand in it ----------
export function buildStage(scene, ox, oz) {
  const g = new THREE.Group(); g.position.set(ox, 0, oz); scene.add(g);
  const plat = new THREE.Mesh(new THREE.CylinderGeometry(16, 17, 1, 40), mat('#f4fbff')); plat.position.y = -0.5; plat.receiveShadow = true; g.add(plat);
  const ground = new THREE.Mesh(new THREE.CircleGeometry(90, 40), mat('#e6f0f8')); ground.rotation.x = -Math.PI / 2; ground.position.y = -0.9; g.add(ground);
  const padMat = mat('#bfe6ff', { emissive: '#5fb4ff', emissiveIntensity: 0.2 });
  const pad = (x, z) => { const p = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.6, 0.25, 32), padMat); p.position.set(x, 0.12, z); p.receiveShadow = true; g.add(p); return p; };
  const myPad = { x: -4.5, z: 3.5 }, foePad = { x: 4.5, z: -3.5 };
  pad(myPad.x, myPad.z); pad(foePad.x, foePad.z);
  // themed backdrops
  const themes = {};
  const th = (id) => { const t = new THREE.Group(); g.add(t); t.visible = false; themes[id] = t; return t; };
  const ring = (t, n, r, make) => { for (let i = 0; i < n; i++) { const a = -0.3 - i / n * 2.6 + Math.PI * 0.05; const o = make(i); o.position.set(Math.cos(a) * r + (Math.random() - 0.5) * 3, 0, Math.sin(a) * r * 0.8 - 6); t.add(o); } };
  const pineG = () => { const o = new THREE.Group(); const tr = new THREE.Mesh(CYL, mat('#6b4423')); tr.scale.set(0.4, 2, 0.4); tr.position.y = 1; o.add(tr); for (let k = 0; k < 3; k++) { const c = new THREE.Mesh(CONE, mat(k % 2 ? '#36906a' : '#2f7d5b')); c.scale.set(2.6 - k * 0.6, 2.6, 2.6 - k * 0.6); c.position.y = 2.8 + k * 1.5; o.add(c); const s = new THREE.Mesh(CONE, mat('#ffffff')); s.scale.set(1.3 - k * 0.3, 0.8, 1.3 - k * 0.3); s.position.y = 3.9 + k * 1.5; o.add(s); } o.scale.setScalar(1.2 + Math.random() * 0.8); return o; };
  ring(th('meadow'), 14, 24, pineG); ring(th('village'), 12, 24, pineG);
  ring(th('caverns'), 16, 22, (i) => { const o = new THREE.Group(); const r = new THREE.Mesh(DODE, mat('#4a3f66', { flatShading: true })); r.scale.set(3, 6 + Math.random() * 4, 3); r.position.y = 3; o.add(r); const c = new THREE.Mesh(OCTA, mat(i % 2 ? '#c79bff' : '#7fe8ff', { emissive: i % 2 ? '#c79bff' : '#7fe8ff', emissiveIntensity: 0.7 })); c.scale.set(0.8, 2.2, 0.8); c.position.set(1.5, 1.6, 3); o.add(c); return o; });
  ring(th('coast'), 12, 24, (i) => { const o = new THREE.Group(); const r = new THREE.Mesh(DODE, mat('#8d9aa8', { flatShading: true })); r.scale.set(2 + Math.random() * 2, 1.5 + Math.random() * 2, 2); r.position.y = 0.6; o.add(r); return o; });
  { const sea = new THREE.Mesh(new THREE.PlaneGeometry(200, 60), mat('#4fa3ff', { roughness: 0.1, metalness: 0.3 })); sea.rotation.x = -Math.PI / 2; sea.position.set(0, -0.7, -45); themes.coast.add(sea); }
  ring(th('peak'), 14, 23, (i) => { const o = new THREE.Group(); const s = new THREE.Mesh(CONE, mat('#bfe6ff', { roughness: 0.1, emissive: '#ff7ad9', emissiveIntensity: i % 3 ? 0.05 : 0.3 })); s.scale.set(1.4, 7 + Math.random() * 5, 1.4); s.position.y = 3.5; o.add(s); return o; });
  ring(th('ring'), 16, 22, (i) => { const o = new THREE.Group(); const p = new THREE.Mesh(BOXG, mat(i % 2 ? '#3fa8ff' : '#ff5d8a')); p.scale.set(0.8, 3, 0.8); p.position.y = 1.5; o.add(p); const fl = new THREE.Mesh(BOXG, mat('#ffffff')); fl.scale.set(1.6, 1, 0.1); fl.position.set(0.8, 2.6, 0); o.add(fl); return o; });
  const setTheme = (id) => { for (const [k, t] of Object.entries(themes)) t.visible = k === (themes[id] ? id : 'village'); };
  const w = (p) => new THREE.Vector3(ox + p.x, 0, oz + p.z);
  return { group: g, setTheme, myPos: w(myPad), foePos: w(foePad), myTamer: w({ x: myPad.x - 2.2, z: myPad.z - 3.6 }), foeTamer: w({ x: foePad.x + 3.6, z: foePad.z + 2.2 }),
    cam: w({ x: -11, z: 11.5 }).setY(5.6), look: w({ x: 1.6, z: -1.2 }).setY(1.3), center: w({ x: 0, z: 0 }) };
}
