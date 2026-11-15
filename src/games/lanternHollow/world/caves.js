// Glowroot Caves (tier 1, brief §3.2). Bioluminescent caverns: displaced rock walls, giant glowcap mushrooms,
// hanging/creeping roots with glowing bulbs, crystal clusters, animated glow pools, drifting spores.
// Walkable space = union of chamber circles + corridor rects (SDF); walls are rock colliders along the edge.
// Chambers (north = −Z): Entrance Grotto → Mushroom Hall → Root Bridge (glow pools) → [Moth Hollow, dark side cave]
//   → Spore Garden (3 waves open the root gate) → Mossmaw's Den (boss).
import * as THREE from 'three';
import { makeMats, makeLantern } from './common.js';
import { makeGlowDecal } from '../fx.js';

const Z = -1000;
export const CAVE = {
  shapes: [
    { c: [0, Z + 59], r: 11, id: 'grotto' }, { rect: [-3.2, Z + 44, 3.2, Z + 52] },
    { c: [0, Z + 29], r: 14, id: 'hall' }, { rect: [-3, Z + 12, 3, Z + 17] },
    { rect: [-7, Z - 7, 7, Z + 14], id: 'bridge' }, { rect: [-15, Z - 1, -6, Z + 7] },
    { c: [-21, Z + 4], r: 8, id: 'hollow' }, { rect: [-3, Z - 11, 3, Z - 5] },
    { c: [0, Z - 22], r: 13, id: 'garden' }, { rect: [-3, Z - 40, 3, Z - 33] },
    { c: [0, Z - 54], r: 15, id: 'den' },
  ],
  arrive: [0, 0, Z + 64], arriveFacing: Math.PI,
  waystone: [0, Z + 67],
  posts: [{ id: 'p0', x: 6, z: Z + 57, name: 'Entrance Grotto' }, { id: 'p1', x: 2.2, z: Z - 4, name: 'Root Bridge' }, { id: 'p2', x: 9, z: Z - 26, name: 'Spore Garden' }],
  chests: [{ id: 'cv_hall', x: -10.5, z: Z + 21 }, { id: 'cv_hollow', x: -24, z: Z + 1 }, { id: 'cv_garden', x: -9, z: Z - 30, needsWaves: true }],
  veins: [{ id: 'v1', x: 12.6, z: Z + 34 }, { id: 'v2', x: -13, z: Z + 32 }, { id: 'v3', x: 6.4, z: Z - 6.3 }, { id: 'v4', x: -27, z: Z + 7 }, { id: 'v5', x: 12, z: Z - 19 }],
  pools: [{ x0: -7, x1: -2.6, z0: Z - 3, z1: Z + 10 }, { x0: 2.6, x1: 7, z0: Z - 3, z1: Z + 10 }],
  chambers: {   // host spawns a chamber's enemies when a player first comes near
    grotto: { x: 0, z: Z + 59, r: 15, spawns: [['slime', -4, Z + 56], ['slime', 4, Z + 54], ['slime', 0, Z + 52]] },
    hall: { x: 0, z: Z + 29, r: 17, spawns: [['slime', -6, Z + 32], ['slime', 5, Z + 24], ['slimeBig', 0, Z + 27], ['spore', -8, Z + 25], ['spore', 8, Z + 33], ['spore', 9, Z + 22]] },
    bridge: { x: 0, z: Z + 4, r: 14, spawns: [['creeper', 0, Z + 8], ['creeper', 0, Z - 2], ['slime', 0, Z + 3], ['creeper', -1, Z + 12]] },
    hollow: { x: -21, z: Z + 4, r: 11, spawns: [['moth', -22, Z + 6], ['moth', -18, Z + 2], ['moth', -24, Z + 1], ['spore', -25, Z + 7]] },
  },
  garden: { x: 0, z: Z - 22, r: 12, waves: [
    [['slime', -6, Z - 18], ['slime', 6, Z - 18], ['slime', 0, Z - 28], ['spore', 0, Z - 20]],
    [['creeper', -5, Z - 24], ['creeper', 5, Z - 24], ['moth', -8, Z - 15], ['moth', 8, Z - 15], ['spore', 7, Z - 28]],
    [['slimeBig', -5, Z - 26], ['slimeBig', 5, Z - 26], ['spore', -9, Z - 22], ['spore', 9, Z - 20], ['moth', 0, Z - 15]],
  ] },
  gateRule: 'waves',
  gate: { x0: -3.2, x1: 3.2, z0: Z - 36.6, z1: Z - 35.4 },
  den: { x: 0, z: Z - 54, r: 15, boss: [0, Z - 58], bossId: 'mossmaw', sacR: 10, exit: [0, Z - 46] },
};

function sdfShape(s, x, z) {
  if (s.c) return Math.hypot(x - s.c[0], z - s.c[1]) - s.r;
  const [x0, z0, x1, z1] = s.rect, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, hx = (x1 - x0) / 2, hz = (z1 - z0) / 2;
  const dx = Math.abs(x - cx) - hx, dz = Math.abs(z - cz) - hz;
  return Math.hypot(Math.max(dx, 0), Math.max(dz, 0)) + Math.min(Math.max(dx, dz), 0);
}
export function caveSdf(x, z) { let d = Infinity; for (const s of CAVE.shapes) d = Math.min(d, sdfShape(s, x, z)); return d; }
export const caveWalkable = (x, z, pad = 0.6) => caveSdf(x, z) < -pad;
export const inPool = (x, z) => CAVE.pools.some(p => x > p.x0 && x < p.x1 && z > p.z0 && z < p.z1);

const rnd = (() => { let s = 4242; return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; })();
const hash = (x, z) => { const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return s - Math.floor(s); };

export function buildCaves({ lights, mobile = false } = {}) {
  const M = makeMats();
  const group = new THREE.Group(); group.name = 'caves';
  const circles = [], interactables = [], anim = [], vlights = [];
  const add = (geo, mat, x, y, z, o = {}) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); if (o.ry) m.rotation.y = o.ry; if (o.rx) m.rotation.x = o.rx; if (o.rz) m.rotation.z = o.rz; m.castShadow = o.cast ?? true; m.receiveShadow = true; (o.parent || group).add(m); return m; };
  const vl = (x, y, z, color, intensity, distance, o) => { const v = lights.add(x, y, z, color, intensity, distance, { area: 'caves', ...o }); vlights.push(v); return v; };

  // ---------- floor: dark stone with mossy, vertex-coloured variation ----------
  const fGeo = new THREE.PlaneGeometry(76, 156, 152, 312); fGeo.rotateX(-Math.PI / 2); fGeo.translate(0, 0, Z);
  const fp = fGeo.attributes.position, cols = new Float32Array(fp.count * 3), cA = new THREE.Color('#231a3d'), cB = new THREE.Color('#163a3a'), cC = new THREE.Color('#2f2450'), tmpC = new THREE.Color();
  for (let i = 0; i < fp.count; i++) { const x = fp.getX(i), z = fp.getZ(i), d = caveSdf(x, z);
    const n = hash(Math.floor(x * 0.7), Math.floor(z * 0.7)) * 0.5 + hash(Math.floor(x * 0.23), Math.floor(z * 0.23)) * 0.5;
    tmpC.copy(cA).lerp(cC, n * 0.6).lerp(cB, THREE.MathUtils.smoothstep(d, -3.5, -0.3) * 0.8);
    cols.set([tmpC.r, tmpC.g, tmpC.b], i * 3); fp.setY(i, d > 0 ? Math.min(3, d * 0.6) : Math.sin(x * 1.3) * Math.cos(z * 1.1) * 0.04); }
  fGeo.setAttribute('color', new THREE.BufferAttribute(cols, 3)); fGeo.computeVertexNormals();
  add(fGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0.02 }), 0, 0, 0, { cast: false });

  // ---------- rock walls (instanced displaced icosahedra) ----------
  const rockGeos = [0, 1, 2].map(k => { const g = new THREE.IcosahedronGeometry(1, 1), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const v = new THREE.Vector3().fromBufferAttribute(p, i); v.multiplyScalar(0.78 + hash(v.x * 3 + k, v.y * 3 + v.z * 5) * 0.42); p.setXYZ(i, v.x, v.y, v.z); }
    g.computeVertexNormals(); return g; });
  const rockMat = new THREE.MeshStandardMaterial({ color: '#3a3358', roughness: 0.95, flatShading: true });
  const rockMat2 = new THREE.MeshStandardMaterial({ color: '#2a2644', roughness: 0.95, flatShading: true });
  const rockSpots = [[], [], []], crystalSpots = [], rootSpots = [], STEP = 1.5;
  for (let x = -38; x <= 38; x += STEP) for (let z = Z - 78; z <= Z + 78; z += STEP) {
    const jx = x + (hash(x, z) - 0.5) * 0.6, jz = z + (hash(z, x) - 0.5) * 0.6, d = caveSdf(jx, jz);
    if (d > 0 && d < 1.7) circles.push([jx, jz, 0.95, 14]);
    if (d > 0.2 && d < 7.5 && hash(x * 1.7, z * 2.3) < (d < 2.5 ? 0.9 : 0.45)) rockSpots[Math.floor(hash(x, z * 3) * 3)].push([jx, jz, d]);
    if (d > -0.4 && d < 1.2 && hash(x * 3.1, z * 1.3) < 0.07) crystalSpots.push([jx, jz]);
    if (d > 0.4 && d < 2.2 && hash(x * 5.3, z * 4.1) < 0.06) rootSpots.push([jx, jz]);
  }
  const mx = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), pv = new THREE.Vector3(), eu = new THREE.Euler();
  rockSpots.forEach((spots, k) => { const im = new THREE.InstancedMesh(rockGeos[k], k === 1 ? rockMat2 : rockMat, spots.length); im.castShadow = im.receiveShadow = true;
    spots.forEach(([x, z, d], i) => { const h = d < 2.5 ? 2.5 + hash(x, z) * 4 : 5 + hash(z, x) * 9, w = 1.4 + hash(x * 2, z) * 1.6 + d * 0.15;
      q.setFromEuler(eu.set(hash(x, 1) * 0.6, hash(z, 2) * 6.28, hash(x, z) * 0.6)); sc.set(w, h, w * (0.8 + hash(z, 3) * 0.4)); pv.set(x, h * 0.35, z); mx.compose(pv, q, sc); im.setMatrixAt(i, mx); });
    group.add(im); });

  // ---------- crystals ----------
  const shardGeo = new THREE.CylinderGeometry(0, 0.22, 1, 6); shardGeo.translate(0, 0.5, 0);
  const crystalMats = [new THREE.MeshStandardMaterial({ color: '#b49bff', emissive: '#6a3aff', emissiveIntensity: 1.1, roughness: 0.2, flatShading: true }),
    new THREE.MeshStandardMaterial({ color: '#8ff7e6', emissive: '#19c6b0', emissiveIntensity: 1.1, roughness: 0.2, flatShading: true })];
  const crystalCluster = (x, z, s, mat) => { const g = new THREE.Group(); g.position.set(x, 0, z); group.add(g);
    for (let i = 0; i < 5; i++) { const m = new THREE.Mesh(shardGeo, mat); const a = i / 5 * 6.28 + rnd(); m.position.set(Math.cos(a) * 0.25 * s, 0, Math.sin(a) * 0.25 * s);
      m.rotation.set(Math.sin(a) * 0.5, rnd() * 6, -Math.cos(a) * 0.5); m.scale.set(s * (0.8 + rnd() * 0.6), s * (1.4 + rnd() * 1.8), s * (0.8 + rnd() * 0.6)); m.castShadow = true; g.add(m); }
    return g; };
  crystalSpots.forEach(([x, z], i) => { if (caveSdf(x, z) < -0.2 && hash(x, z) < 0.5) return; crystalCluster(x, z, 0.8 + hash(x, z) * 1.2, crystalMats[i % 2]); });
  const bigCrystals = [[-9, Z + 62, 0], [9, Z + 48, 1], [12, Z + 21, 0], [-10, Z + 36, 1], [-6.5, Z - 8, 1], [6, Z + 13, 0], [11, Z - 12, 1], [-11, Z - 28, 0], [-12, Z - 50, 1], [12, Z - 60, 0], [12, Z - 46, 1], [-11, Z - 63, 0]];
  for (const [x, z, k] of bigCrystals) { crystalCluster(x, z, 2 + rnd(), crystalMats[k]); vl(x, 2.4, z, k ? '#3ff0d0' : '#9a6aff', 9, 12, { flicker: 0.05 }); circles.push([x, z, 1.1, 5]); }

  // ---------- giant glowcap mushrooms ----------
  const stemProfile = [[0.0, 0], [0.42, 0], [0.34, 0.2], [0.28, 0.8], [0.3, 1.6], [0.36, 2.0], [0, 2.0]].map(([r, y]) => new THREE.Vector2(r, y));
  const stemGeo = new THREE.LatheGeometry(stemProfile, 14), capGeo = new THREE.SphereGeometry(1, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), gillGeo = new THREE.CircleGeometry(0.96, 24); gillGeo.rotateX(Math.PI / 2);
  const stemMat = new THREE.MeshStandardMaterial({ color: '#d9cfe8', roughness: 0.7, emissive: '#3a2a5a', emissiveIntensity: 0.3 });
  const capMats = [new THREE.MeshStandardMaterial({ color: '#7b4bd6', emissive: '#4a1ea0', emissiveIntensity: 0.55, roughness: 0.55 }), new THREE.MeshStandardMaterial({ color: '#1f9a8a', emissive: '#0c6a60', emissiveIntensity: 0.6, roughness: 0.55 })];
  const gillMats = [new THREE.MeshBasicMaterial({ color: '#ff9af0', toneMapped: false, side: THREE.DoubleSide }), new THREE.MeshBasicMaterial({ color: '#7dffe6', toneMapped: false, side: THREE.DoubleSide })];
  const spotGeo = new THREE.SphereGeometry(0.09, 8, 6), spotMat = new THREE.MeshBasicMaterial({ color: '#fff3b0', toneMapped: false });
  function mushroom(x, z, s, k, light = false) {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rnd() * 6; g.rotation.z = (rnd() - 0.5) * 0.12; group.add(g); g.scale.setScalar(s);
    add(stemGeo, stemMat, 0, 0, 0, { parent: g });
    const cap = add(capGeo, capMats[k], 0, 1.95, 0, { parent: g }); cap.scale.set(1.25, 0.6, 1.25);
    add(gillGeo, gillMats[k], 0, 1.96, 0, { parent: g, cast: false }).scale.setScalar(1.25);
    for (let i = 0; i < 9; i++) { const a = rnd() * 6.28, r = 0.3 + rnd() * 0.75, y = Math.sqrt(Math.max(0, 1 - r * r)) * 0.6; add(spotGeo, spotMat, Math.cos(a) * r * 1.25, 1.95 + y, Math.sin(a) * r * 1.25, { parent: g, cast: false }); }
    anim.push({ o: cap, breathe: x + z });
    if (light) vl(x, 2.0 * s, z, k ? '#4ff0d0' : '#d07aff', 8 * s, 6 + 3 * s, { flicker: 0.03 });
    if (s > 1.2) circles.push([x, z, 0.45 * s, 2 * s]);
  }
  for (const [x, z, s, k, l] of [[-7, Z + 63, 1.4, 1, 1], [7.5, Z + 61, 0.9, 0], [-9, Z + 29, 3.2, 0, 1], [9.5, Z + 28, 2.6, 1, 1], [-4, Z + 19, 1.6, 0], [3, Z + 37, 1.5, 1], [-11, Z + 24, 1.1, 1], [10, Z + 35, 1.0, 0],
    [-23, Z + 9, 1.2, 0], [9, Z - 20, 2.2, 0, 1], [-8, Z - 14, 1.8, 1, 1], [-10, Z - 20, 1.0, 0], [-9, Z - 58, 2.6, 1, 1], [9, Z - 50, 2.2, 0, 1]])
    mushroom(x, z, s, k, !!l);
  // small glowcaps carpeting the floor near walls
  const smallSpots = []; for (let i = 0; i < (mobile ? 140 : 260); i++) { const x = (rnd() - 0.5) * 70, z = Z + (rnd() - 0.5) * 150, d = caveSdf(x, z); if (d > -2.2 && d < -0.3) smallSpots.push([x, z]); }
  const sCap = new THREE.InstancedMesh(new THREE.SphereGeometry(0.22, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#c58bff', toneMapped: false }), smallSpots.length);
  const sStem = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.04, 0.06, 0.3, 5), stemMat, smallSpots.length);
  smallSpots.forEach(([x, z], i) => { const s = 0.6 + hash(x, z) * 1.1; q.identity(); sc.setScalar(s); pv.set(x, 0.3 * s, z); mx.compose(pv, q, sc); sCap.setMatrixAt(i, mx); pv.set(x, 0.15 * s, z); mx.compose(pv, q, sc); sStem.setMatrixAt(i, mx);
    sCap.setColorAt(i, new THREE.Color(hash(z, x) < 0.5 ? '#c58bff' : '#5ff5dc')); });
  group.add(sCap, sStem);

  // ---------- roots: tubes crawling from the walls with glowing bulbs ----------
  const rootMat = new THREE.MeshStandardMaterial({ color: '#4a3226', roughness: 0.85, emissive: '#1a2a10', emissiveIntensity: 0.4 });
  const bulbMat = new THREE.MeshBasicMaterial({ color: '#b6ff7a', toneMapped: false }), bulbGeo = new THREE.SphereGeometry(0.11, 8, 6);
  rootSpots.forEach(([x, z]) => { // walk inward along the SDF gradient
    const e = 0.5, gx = caveSdf(x + e, z) - caveSdf(x - e, z), gz = caveSdf(x, z + e) - caveSdf(x, z - e), gl = Math.hypot(gx, gz) || 1, ix = -gx / gl, iz = -gz / gl, sx = -iz, sz = ix;
    const pts = []; const len = 3 + rnd() * 4, wob = (rnd() - 0.5) * 2;
    for (let k = 0; k <= 6; k++) { const t = k / 6; pts.push(new THREE.Vector3(x + ix * len * t + sx * Math.sin(t * 3 + wob) * 0.8, (1 - t) * (3 + rnd() * 2) + 0.12, z + iz * len * t + sz * Math.sin(t * 3 + wob) * 0.8)); }
    const curve = new THREE.CatmullRomCurve3(pts), tube = new THREE.TubeGeometry(curve, 24, 0.14 + rnd() * 0.1, 6);
    add(tube, rootMat, 0, 0, 0, { cast: true });
    for (let k = 0; k < 3; k++) { const p = curve.getPoint(0.3 + k * 0.25); add(bulbGeo, bulbMat, p.x, p.y + 0.12, p.z, { cast: false }); }
  });

  // ---------- glow pools (Root Bridge) ----------
  const poolMat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: { uT: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `varying vec2 vUv; uniform float uT;
      void main(){ vec2 p = vUv * vec2(4.0, 10.0); float c = 0.0;
        for (int i = 0; i < 3; i++) { float fi = float(i); c += sin(p.x * (1.7 + fi) + uT * (0.9 + fi * 0.3) + sin(p.y * 1.3 + uT * 0.7 + fi)) * cos(p.y * (1.1 + fi * 0.5) - uT * 0.6); }
        c = pow(abs(c) / 3.0, 2.0); vec2 e = min(vUv, 1.0 - vUv); float edge = smoothstep(0.0, 0.12, min(e.x * 2.5, e.y));
        vec3 col = mix(vec3(0.02, 0.35, 0.4), vec3(0.4, 1.0, 0.9), c);
        gl_FragColor = vec4(col, 0.85 * edge); }` });
  for (const p of CAVE.pools) {
    const m = add(new THREE.PlaneGeometry(p.x1 - p.x0, p.z1 - p.z0), poolMat, (p.x0 + p.x1) / 2, 0.05, (p.z0 + p.z1) / 2, { rx: -Math.PI / 2, cast: false }); m.renderOrder = 1;
    for (let i = 0; i < 10; i++) add(new THREE.SphereGeometry(0.35 + rnd() * 0.3, 7, 5), rockMat2, (rnd() < 0.5 ? p.x0 : p.x1) + (rnd() - 0.5) * 0.4, 0.08, p.z0 + rnd() * (p.z1 - p.z0), { cast: false }).scale.y = 0.4;
    vl((p.x0 + p.x1) / 2, 1.2, (p.z0 + p.z1) / 2, '#3ff0d0', 7, 12);
  }

  // ---------- spores drifting (points) ----------
  const sporeN = mobile ? 160 : 360, sGeo = new THREE.BufferGeometry(), sPos = new Float32Array(sporeN * 3);
  for (let i = 0; i < sporeN; i++) { sPos[i * 3] = (rnd() - 0.5) * 30; sPos[i * 3 + 1] = rnd() * 8; sPos[i * 3 + 2] = (rnd() - 0.5) * 30; }
  sGeo.setAttribute('position', new THREE.BufferAttribute(sPos, 3));
  const spores = new THREE.Points(sGeo, new THREE.PointsMaterial({ color: '#b6ffcf', size: 0.09, transparent: true, opacity: 0.75, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false })); spores.frustumCulled = false; group.add(spores);

  // ---------- return waystone ----------
  const [wx, wz] = CAVE.waystone;
  add(new THREE.CylinderGeometry(2.6, 2.8, 0.25, 24), M.stoneDark, wx, 0.12, wz, { cast: false });
  const wring = add(new THREE.TorusGeometry(1.4, 0.16, 8, 32), M.stone, wx, 1.8, wz);
  const wveil = add(new THREE.CircleGeometry(1.25, 32), new THREE.MeshBasicMaterial({ color: '#7fe3ff', transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }), wx, 1.8, wz, { cast: false });
  vl(wx, 1.8, wz, '#5fd0ff', 6, 10); circles.push([wx - 1.4, wz, 0.25, 4], [wx + 1.4, wz, 0.25, 4]);
  interactables.push({ id: 'waystone', name: 'Waystone', x: wx, z: wz - 2, r: 2.8, verb: 'Return' });

  // ---------- lamp posts (light them: checkpoint + bank embers + refill glow) ----------
  const posts = CAVE.posts.map(p => {
    const g = new THREE.Group(); g.position.set(p.x, 0, p.z); group.add(g);
    add(new THREE.CylinderGeometry(0.55, 0.7, 0.4, 8), M.stoneDark, 0, 0.2, 0, { parent: g });
    add(new THREE.CylinderGeometry(0.12, 0.16, 3.0, 8), M.iron, 0, 1.9, 0, { parent: g });
    add(new THREE.TorusGeometry(0.3, 0.04, 6, 16), M.brass, 0, 3.0, 0, { parent: g, rx: Math.PI / 2 });
    const lan = makeLantern(M, 2.4); lan.position.set(0, 3.45, 0); g.add(lan);
    const glow = makeGlowDecal('#ffb347', 0); glow.scale.setScalar(6); glow.position.set(p.x, 0.07, p.z); group.add(glow);
    const light = vl(p.x, 3.6, p.z, '#ffb35a', 0, 14, { flicker: 0.08 }); light.mul = 0;
    circles.push([p.x, p.z, 0.6, 3.6]);
    const rec = { ...p, g, lan, glow, light, lit: false };
    rec.setLit = (on) => { rec.lit = on; light.mul = on ? 1 : 0; light.intensity = 16; glow.material.opacity = on ? 0.3 : 0; lan.children.forEach(c => { if (c.material?.emissive) c.material.emissiveIntensity = on ? 2.2 : 0.15; }); lan.userData.flame.visible = on; };
    rec.setLit(false);
    interactables.push({ id: p.id, kind: 'post', name: `${p.name} lamp post`, x: p.x, z: p.z, r: 2.6, verb: 'Light' });
    return rec;
  });

  // ---------- chests ----------
  const chestMat = new THREE.MeshStandardMaterial({ color: '#7a4a2a', roughness: 0.7 });
  const chests = CAVE.chests.map(c => {
    const g = new THREE.Group(); g.position.set(c.x, 0, c.z); g.rotation.y = Math.atan2(-c.x, (Z + 20) - c.z) * 0 + rnd() * 0.6; group.add(g);
    add(new THREE.BoxGeometry(1.3, 0.75, 0.85), chestMat, 0, 0.38, 0, { parent: g });
    for (const s of [-1, 1]) add(new THREE.BoxGeometry(0.1, 0.8, 0.9), M.brass, s * 0.5, 0.4, 0, { parent: g });
    const lid = new THREE.Group(); lid.position.set(0, 0.75, -0.42); g.add(lid);
    add(new THREE.CylinderGeometry(0.43, 0.43, 1.3, 12, 1, false, 0, Math.PI), chestMat, 0, 0, 0.42, { parent: lid, rz: Math.PI / 2 }).rotation.set(0, 0, Math.PI / 2);
    add(new THREE.BoxGeometry(0.22, 0.26, 0.08), M.brass, 0, -0.05, 0.86, { parent: lid });
    const glow = makeGlowDecal('#ffd27a', 0.25); glow.scale.setScalar(1.8); glow.position.set(c.x, 0.07, c.z); group.add(glow);
    circles.push([c.x, c.z, 0.75, 1]);
    const rec = { ...c, g, lid, glow, open: false };
    rec.setOpen = (on) => { rec.open = on; lid.rotation.x = on ? -1.9 : 0; glow.visible = !on; };
    interactables.push({ id: c.id, kind: 'chest', name: 'Glowroot chest', x: c.x, z: c.z, r: 2.2, verb: 'Open' });
    return rec;
  });

  // ---------- hidden ember veins (revealed by FLARE) ----------
  const veinMat = new THREE.MeshStandardMaterial({ color: '#5a2a1a', emissive: '#ff6a1a', emissiveIntensity: 0, roughness: 0.6, flatShading: true });
  const veins = CAVE.veins.map(v => {
    const g = new THREE.Group(); g.position.set(v.x, 0, v.z); group.add(g);
    const rock = add(rockGeos[2], new THREE.MeshStandardMaterial({ color: '#3a3358', roughness: 0.95, flatShading: true }), 0, 0.6, 0, { parent: g }); rock.scale.set(1.2, 1.1, 1.2);
    const ore = []; for (let i = 0; i < 6; i++) { const m = add(new THREE.OctahedronGeometry(0.22 + rnd() * 0.12), veinMat.clone(), (rnd() - 0.5) * 1.4, 0.4 + rnd() * 0.9, (rnd() - 0.5) * 1.4, { parent: g, cast: false }); ore.push(m); }
    circles.push([v.x, v.z, 1.0, 2]);
    const rec = { ...v, g, ore, revealed: false, mined: false };
    rec.setState = (revealed, mined) => { rec.revealed = revealed; rec.mined = mined; ore.forEach(o => { o.visible = !mined; o.material.emissiveIntensity = revealed ? 1.8 : 0; }); };
    interactables.push({ id: v.id, kind: 'vein', name: 'Ember vein', x: v.x, z: v.z, r: 2.4, verb: 'Mine' });
    return rec;
  });

  // ---------- root gate (Spore Garden → Den) ----------
  const gate = new THREE.Group(); group.add(gate);
  const G = CAVE.gate, gateMat = new THREE.MeshStandardMaterial({ color: '#3a2a1e', emissive: '#4a1a6a', emissiveIntensity: 0.6, roughness: 0.8 });
  for (let i = 0; i < 7; i++) { const x0 = G.x0 + i * (G.x1 - G.x0) / 6, a = (i % 2 ? 1 : -1);
    const c = new THREE.CatmullRomCurve3([new THREE.Vector3(x0, 0, (G.z0 + G.z1) / 2), new THREE.Vector3(x0 + a * 0.6, 2, (G.z0 + G.z1) / 2 + 0.2), new THREE.Vector3(x0 - a * 0.5, 4, (G.z0 + G.z1) / 2 - 0.2), new THREE.Vector3(x0 + a * 0.3, 6, (G.z0 + G.z1) / 2)]);
    add(new THREE.TubeGeometry(c, 16, 0.22, 6), gateMat, 0, 0, 0, { parent: gate }); }
  for (let i = 0; i < 4; i++) add(new THREE.SphereGeometry(0.25, 8, 6), new THREE.MeshBasicMaterial({ color: '#d07aff', toneMapped: false }), G.x0 + 0.8 + i * 1.6, 1.5 + (i % 2) * 2, (G.z0 + G.z1) / 2 + 0.3, { parent: gate, cast: false });
  const gateLight = vl(0, 2.5, (G.z0 + G.z1) / 2 + 1, '#b05aff', 6, 9);
  let gateBox = null, gateK = 1;

  // ---------- Mossmaw's den dressing (the boss itself is an enemy view) ----------
  const D = CAVE.den;
  add(new THREE.RingGeometry(D.r - 1.5, D.r - 1.1, 64), new THREE.MeshBasicMaterial({ color: '#7a3aff', transparent: true, opacity: 0.25, toneMapped: false, depthWrite: false }), D.x, 0.06, D.z, { rx: -Math.PI / 2, cast: false });
  const sacs = [0, 1, 2, 3].map(i => { const a = Math.PI / 4 + i * Math.PI / 2, x = D.boss[0] + Math.cos(a) * D.sacR, z = D.boss[1] + Math.sin(a) * D.sacR;
    const g = new THREE.Group(); g.position.set(x, 0, z); group.add(g);
    const stalk = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.3, 1, 0.1), new THREE.Vector3(-0.1, 2, 0)]);
    add(new THREE.TubeGeometry(stalk, 10, 0.12, 6), rootMat, 0, 0, 0, { parent: g });
    const bulb = add(new THREE.SphereGeometry(0.6, 16, 12), new THREE.MeshStandardMaterial({ color: '#fff08a', emissive: '#ffd23a', emissiveIntensity: 1.5, roughness: 0.4, transparent: true, opacity: 0.92 }), -0.1, 2.4, 0, { parent: g });
    const light = vl(x, 2.4, z, '#ffd23a', 0, 7); light.mul = 0;
    circles.push([x, z, 0.5, 3]);
    return { i, x, z, g, bulb, light, alive: true };
  });
  const denLight = vl(D.boss[0], 6, D.boss[1], '#ff6ad0', 14, 26, { flicker: 0.05 });
  const exit = new THREE.Group(); exit.position.set(D.exit[0], 0, D.exit[1]); exit.visible = false; group.add(exit);
  add(new THREE.TorusGeometry(1.4, 0.15, 8, 32), M.rune, 0, 1.8, 0, { parent: exit });
  const exitVeil = add(new THREE.CircleGeometry(1.25, 32), new THREE.MeshBasicMaterial({ color: '#ffd27a', transparent: true, opacity: 0.4, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }), 0, 1.8, 0, { parent: exit, cast: false });

  const api = {
    group, posts, chests, veins, sacs, interactables, vlights,
    colliders(col) { this._col = col; for (const [x, z, r, top] of circles) col.addCircle(x, z, r, top); this.setGate(true); },
    setGate(closed) { if (!this._col) return; if (closed && !gateBox) gateBox = this._col.addBox(G.x0, 0, G.z0, G.x1, 7, G.z1); if (!closed && gateBox) { this._col.removeBox(gateBox); gateBox = null; } api.gateClosed = closed; },
    gateClosed: true,
    setSacs(alive) { sacs.forEach((s, i) => { s.alive = !!alive[i]; }); },
    setExit(on) { exit.visible = on; const it = interactables.find(i => i.id === 'exit'); if (on && !it) interactables.push({ id: 'exit', name: 'Hearthward portal', x: D.exit[0], z: D.exit[1], r: 2.6, verb: 'Return home' }); if (!on && it) interactables.splice(interactables.indexOf(it), 1); },
    /** dark: 0..1 (boss phase 2 dims the den). */
    update(dt, t, { center, dark = 0, sacPhase = false } = {}) {
      poolMat.uniforms.uT.value = t;
      for (const a of anim) { const k = 1 + Math.sin(t * 1.2 + a.breathe) * 0.025; a.o.scale.set(1.25 * k, 0.6 / k, 1.25 * k); }
      if (center) { spores.position.set(center.x, 0, center.z); for (let i = 0; i < sporeN; i++) { sPos[i * 3 + 1] += dt * (0.15 + (i % 7) * 0.03); sPos[i * 3] += Math.sin(t * 0.5 + i) * dt * 0.1; if (sPos[i * 3 + 1] > 8) sPos[i * 3 + 1] = 0; } sGeo.attributes.position.needsUpdate = true; }
      wveil.material.opacity = 0.28 + Math.sin(t * 2) * 0.08; wveil.rotation.z = t * 0.4; wring.rotation.z = Math.sin(t * 0.5) * 0.05;
      exitVeil.material.opacity = 0.35 + Math.sin(t * 3) * 0.1; exitVeil.rotation.z = -t;
      // gate sinks when opened
      const want = api.gateClosed ? 1 : 0; gateK += (want - gateK) * Math.min(1, dt * 2); gate.position.y = (gateK - 1) * 6.5; gate.visible = gateK > 0.02; gateLight.mul = gateK;
      denLight.mul = 1 - dark * 0.85;
      sacs.forEach((s, i) => { s.g.visible = s.alive || s.bulb.scale.x > 0.05; const target = s.alive ? 1 : 0.01; s.bulb.scale.setScalar(s.bulb.scale.x + (target - s.bulb.scale.x) * Math.min(1, dt * 6));
        const pulse = sacPhase && s.alive ? 1 + Math.sin(t * 5 + i) * 0.12 : 1; s.bulb.scale.multiplyScalar(pulse); s.light.mul = sacPhase && s.alive ? 1 : 0; s.light.intensity = 8;
        s.bulb.material.emissiveIntensity = sacPhase && s.alive ? 2.4 : 0.6; });
      posts.forEach(p => { if (p.lit) p.lan.userData.flame.scale.y = 1.5 + Math.sin(t * 12 + p.x) * 0.25; });
      veins.forEach(v => { if (v.revealed && !v.mined) v.ore.forEach((o, i) => { o.material.emissiveIntensity = 1.5 + Math.sin(t * 4 + i) * 0.5; }); });
    },
  };
  return api;
}
