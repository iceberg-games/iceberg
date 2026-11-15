// The Sunken Mine (tier 2, brief §3.3). An abandoned dwarf-and-kobold mine half-flooded with freezing water:
// timber frames, rails and minecarts, rusty machinery, cold blue water, guttering lamps, blue crystal veins.
// Chambers (north = −Z): Lift Shaft → Rail Junction (minecart lanes) → Flooded Gallery (3 levers drain it, sluice opens)
//   → [Wraith Tunnels, optional] → Crystal Vein Hall (crystal minigame) → Foreman's Pit (boss).
import * as THREE from 'three';
import { makeMats } from './common.js';
import { makeKit, sdfOf, hash, makeRnd } from './dungeon.js';

const X = 1000, Z = -1000;
export const MINE = {
  shapes: [
    { c: [X, Z + 58], r: 10, id: 'shaft' }, { rect: [X - 3, Z + 44, X + 3, Z + 50] },
    { rect: [X - 15, Z + 28, X + 15, Z + 45], id: 'junction' }, { rect: [X - 3, Z + 19, X + 3, Z + 29] },
    { c: [X, Z + 8], r: 13, id: 'gallery' }, { rect: [X - 28, Z + 5, X - 11, Z + 11] }, { c: [X - 32, Z + 8], r: 6.5, id: 'tunnels' },
    { rect: [X - 3, Z - 14, X + 3, Z - 4] }, { c: [X, Z - 22], r: 11, id: 'veinhall' }, { rect: [X - 3, Z - 37, X + 3, Z - 31] },
    { c: [X, Z - 50], r: 16, id: 'pit' },
  ],
  arrive: [X, 0, Z + 62], arriveFacing: Math.PI, waystone: [X - 5.5, Z + 61.5],
  posts: [{ id: 'm0', x: X + 6, z: Z + 55, name: 'Lift Shaft' }, { id: 'm1', x: X + 12, z: Z + 42, name: 'Rail Junction' }, { id: 'm2', x: X + 8, z: Z + 14, name: 'Flooded Gallery' }, { id: 'm3', x: X - 8, z: Z - 16, name: 'Crystal Vein Hall' }],
  chests: [{ id: 'mn_junction', x: X - 13, z: Z + 30.5 }, { id: 'mn_wraith', x: X - 34.5, z: Z + 5.5, charm: 'thornlight' }, { id: 'mn_vein', x: X + 8, z: Z - 28 }],
  veins: [],
  levers: [{ id: 'l0', x: X - 10, z: Z + 13 }, { id: 'l1', x: X + 11, z: Z + 5 }, { id: 'l2', x: X - 6, z: Z - 1.5 }],
  crystals: [{ id: 'c0', x: X - 9, z: Z - 21 }, { id: 'c1', x: X + 9, z: Z - 24 }, { id: 'c2', x: X - 3, z: Z - 30 }, { id: 'c3', x: X + 6, z: Z - 15.5 }],
  lanes: [{ z: Z + 40, x0: X - 15, x1: X + 15, period: 6500, off: 0, dir: 1 }, { z: Z + 33, x0: X - 15, x1: X + 15, period: 8000, off: 2900, dir: -1 }],
  water: { x: X, z: Z + 8, r: 13 },
  chambers: {
    shaft: { x: X, z: Z + 58, r: 13, spawns: [['kobold', X - 4, Z + 52], ['bat', X + 3, Z + 50]] },
    junction: { x: X, z: Z + 36, r: 17, spawns: [['kobold', X - 11, Z + 43], ['kobold', X + 11, Z + 30], ['bat', X - 5, Z + 36], ['bat', X + 6, Z + 38], ['golem', X, Z + 30]] },
    gallery: { x: X, z: Z + 8, r: 16, spawns: [['golem', X - 6, Z + 4], ['golem', X + 6, Z + 10], ['kobold', X, Z + 15], ['bat', X + 3, Z + 2]] },
    tunnels: { x: X - 27, z: Z + 8, r: 12, spawns: [['wraith', X - 30, Z + 10], ['wraith', X - 34, Z + 6], ['wraith', X - 22, Z + 8]] },
    veinhall: { x: X, z: Z - 22, r: 14, spawns: [['bat', X - 6, Z - 18], ['bat', X + 5, Z - 26], ['bat', X, Z - 30], ['golem', X, Z - 24], ['wraith', X + 6, Z - 20]] },
  },
  gateRule: 'levers',
  gate: { x0: X - 3.2, x1: X + 3.2, z0: Z - 6.6, z1: Z - 5.4 },
  den: { x: X, z: Z - 50, r: 16, boss: [X, Z - 53], bossId: 'foreman', exit: [X, Z - 40],
    lamps: [[X - 7, Z - 50], [X + 7, Z - 50]], carts: [[X - 10, Z - 45, 0.4], [X + 10, Z - 45, -0.4], [X - 7, Z - 59, -0.3], [X + 7, Z - 59, 0.3]] },
};
export const mineSdf = sdfOf(MINE.shapes);
/** Minecart lane schedule: the next pass time (ms) for lane i at server time now. */
export function laneNext(i, now) { const L = MINE.lanes[i]; return Math.floor((now - L.off) / L.period + 1) * L.period + L.off; }
export const CART_WARN = 1300;

export function buildMine({ lights, mobile = false } = {}) {
  const M = makeMats(), rnd = makeRnd(7171);
  const group = new THREE.Group(); group.name = 'mine';
  const K = makeKit({ area: 'mine', lights, group, M }), { add, vl, inst, circles, interactables } = K;
  const anim = [];
  const timber = new THREE.MeshStandardMaterial({ color: '#6a4a30', roughness: 0.9, flatShading: true }), timberDark = new THREE.MeshStandardMaterial({ color: '#4a3220', roughness: 0.92, flatShading: true });
  const rust = new THREE.MeshStandardMaterial({ color: '#7a4a32', roughness: 0.7, metalness: 0.55, flatShading: true }), steel = new THREE.MeshStandardMaterial({ color: '#5a6170', roughness: 0.45, metalness: 0.8 });
  const blueCr = new THREE.MeshStandardMaterial({ color: '#8fd8ff', emissive: '#2a8cff', emissiveIntensity: 1.2, roughness: 0.15, flatShading: true });

  // ---------- floor: packed earth + wet stone; walls rise into rock ----------
  K.floor(mineSdf, { cx: X, cz: Z, w: 84, h: 150, colors: ['#2b2420', '#2a3442', '#3a2e26'], fall: (d) => Math.min(3, d * 0.6) });

  // ---------- rock walls ----------
  const rockGeos = [0, 1, 2].map(k => { const g = new THREE.DodecahedronGeometry(1, 1), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const v = new THREE.Vector3().fromBufferAttribute(p, i); v.multiplyScalar(0.75 + hash(v.x * 3 + k, v.y * 3 + v.z * 5) * 0.45); p.setXYZ(i, v.x, v.y, v.z); } g.computeVertexNormals(); return g; });
  const rockMats = [new THREE.MeshStandardMaterial({ color: '#4a4048', roughness: 0.95, flatShading: true }), new THREE.MeshStandardMaterial({ color: '#3a3440', roughness: 0.95, flatShading: true })];
  const rocks = [[], [], []], crystalSpots = [], frameSpots = [];
  K.edge(mineSdf, { x0: X - 42, x1: X + 42, z0: Z - 74, z1: Z + 74 }, (x, z, d) => {
    const camLane = z > Z + 62 && Math.abs(x - X) < 9;   // keep the arrival camera (south of the lift) out of the rock
    if (d > 0.2 && d < 7.5 && hash(x * 1.7, z * 2.3) < (d < 2.5 ? 0.9 : 0.45)) { const h = camLane ? 0.8 + hash(x, z) * 1.2 : d < 2.5 ? 2.6 + hash(x, z) * 4 : 5 + hash(z, x) * 9, w = 1.4 + hash(x * 2, z) * 1.6 + d * 0.15;
      rocks[Math.floor(hash(x, z * 3) * 3)].push([x, h * 0.35, z, w, h, w * (0.8 + hash(z, 3) * 0.4), hash(x, 1) * 0.6, hash(z, 2) * 6.28, hash(x, z) * 0.6]); }
    if (d > -0.3 && d < 1.0 && hash(x * 3.1, z * 1.3) < 0.05) crystalSpots.push([x, z]);
  });
  rocks.forEach((rows, k) => inst(rockGeos[k], rockMats[k % 2], rows));

  // ---------- timber support frames along corridors and chamber walls ----------
  const fx = [], fb = [];
  const frame = (x, z, ry, w = 6.4, h = 4.2) => { const c = Math.cos(ry), s = Math.sin(ry);
    for (const sgn of [-1, 1]) fx.push([x + c * sgn * w / 2, h / 2, z - s * sgn * w / 2, 0.38, h, 0.38, 0, ry, 0]);
    // N-S corridor frames sit between the follow camera and the player, so they get corbels instead of a full lintel
    if (ry === 0 && w > 5) for (const sgn of [-1, 1]) fb.push([x + sgn * (w / 2 - 0.3), h + 0.2, z, 1.2, 0.42, 0.46, 0, 0, 0]);
    else fb.push([x, h + 0.2, z, w + 0.8, 0.42, 0.46, 0, ry, 0]); };
  for (const zz of [Z + 46, Z + 49]) frame(X, zz, 0);
  for (const zz of [Z + 21, Z + 25]) frame(X, zz, 0);
  for (const zz of [Z - 8, Z - 12]) frame(X, zz, 0, 6.6);
  for (const zz of [Z - 33, Z - 36]) frame(X, zz, 0);
  for (let xx = X - 26; xx <= X - 13; xx += 4.2) frame(xx, Z + 8, Math.PI / 2, 6.4, 3.8);
  for (let xx = X - 12; xx <= X + 12; xx += 8) { frame(xx, Z + 44.3, 0, 2.4, 4.6); frame(xx, Z + 28.7, 0, 2.4, 4.6); }
  inst(new THREE.BoxGeometry(1, 1, 1), timber, fx); inst(new THREE.BoxGeometry(1, 1, 1), timberDark, fb);
  // chamber ring props: slanted props against walls in round rooms
  const props = [];
  for (const [cx, cz, r, n] of [[X, Z + 58, 10, 9], [X, Z + 8, 13, 12], [X, Z - 22, 11, 10], [X, Z - 50, 16, 14]]) for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2 + 0.2;
    const px = cx + Math.cos(a) * (r - 0.5), pz = cz + Math.sin(a) * (r - 0.5); if (mineSdf(px, pz) > 0.4 || Math.abs(px - X) < 4) continue; props.push([px, 2.2, pz, 0.36, 4.6, 0.36, Math.sin(a) * 0.18, 0, -Math.cos(a) * 0.18]); }
  inst(new THREE.BoxGeometry(1, 1, 1), timber, props);

  // ---------- rails: main line + junction lanes (instanced ties + steel rails) ----------
  const ties = [], rails = [];
  const track = (x0, z0, x1, z1) => { const len = Math.hypot(x1 - x0, z1 - z0), ry = Math.atan2(x1 - x0, z1 - z0), n = Math.floor(len / 0.9);
    for (let i = 0; i <= n; i++) { const t = i / n; ties.push([x0 + (x1 - x0) * t, 0.06, z0 + (z1 - z0) * t, 1.7, 0.12, 0.28, 0, ry, 0]); }
    const c = Math.cos(ry), s = Math.sin(ry); for (const o of [-0.55, 0.55]) rails.push([(x0 + x1) / 2 + c * o, 0.16, (z0 + z1) / 2 - s * o, 0.08, 0.1, len, 0, ry, 0]); };
  track(X - 1.6, Z + 64, X - 1.6, Z + 45); track(X - 1.6, Z + 28, X - 1.6, Z + 20);
  for (const L of MINE.lanes) track(L.x0 - 3, L.z, L.x1 + 3, L.z);
  track(X + 1.5, Z - 34, X + 1.5, Z - 40);
  inst(new THREE.BoxGeometry(1, 1, 1), timberDark, ties, { cast: false }); inst(new THREE.BoxGeometry(1, 1, 1), steel, rails, { cast: false });

  // ---------- minecart model ----------
  const oreMat = blueCr;
  function minecart(full = true) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.9, 2.4), rust); body.position.y = 0.75; body.castShadow = true; g.add(body);
    const rim = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.12, 2.55), steel); rim.position.y = 1.22; g.add(rim);
    for (const sx of [-0.7, 0.7]) for (const sz of [-0.8, 0.8]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.14, 12), steel); w.rotation.z = Math.PI / 2; w.position.set(sx * 1.05, 0.28, sz); g.add(w); }
    if (full) for (let i = 0; i < 6; i++) { const o = new THREE.Mesh(new THREE.OctahedronGeometry(0.22 + (i % 3) * 0.06), i % 2 ? oreMat : rockMats[0]); o.position.set((i % 3 - 1) * 0.45, 1.25 + (i % 2) * 0.1, (Math.floor(i / 3) - 0.5) * 0.8); g.add(o); }
    return g;
  }
  // parked carts as dressing
  for (const [x, z, ry, f] of [[X + 3.2, Z + 52, 0, 1], [X + 7, Z + 61, 0.6, 0], [X - 12, Z + 37, 1.4, 1], [X + 9, Z + 18, 2.2, 0], [X - 7, Z - 27, 0.9, 1]]) { const c = minecart(!!f); c.position.set(x, 0, z); c.rotation.y = ry; group.add(c); circles.push([x, z, 1.25, 1.5]); }
  // the junction lanes' moving carts
  const laneCarts = MINE.lanes.map(L => { const c = minecart(true); c.rotation.y = Math.PI / 2; c.position.set(L.x0 - 6, 0, L.z); c.visible = false; group.add(c); const lamp = vl(L.x0 - 3, 1.6, L.z, '#ffcf7a', 0, 8); lamp.mul = 0; return { c, lamp, L }; });
  // horn signal lamps on the junction walls
  const signals = MINE.lanes.map(L => { const m = add(new THREE.SphereGeometry(0.22, 10, 8), new THREE.MeshBasicMaterial({ color: '#661010', toneMapped: false }), L.x0 + 0.6, 2.6, L.z - 1.4, { cast: false }); add(new THREE.BoxGeometry(0.15, 2.6, 0.15), M.iron, L.x0 + 0.6, 1.3, L.z - 1.4); return m; });

  // ---------- hanging miner lamps (guttering) ----------
  const hang = (x, z, h = 3.6, color = '#ffb35a', inten = 10, dist = 13) => { const lan = K.makeLantern(M, 2.2); lan.position.set(x, h, z); group.add(lan); add(new THREE.CylinderGeometry(0.02, 0.02, 1.2, 4), M.iron, x, h + 0.75, z, { cast: false }); vl(x, h - 0.2, z, color, inten, dist, { flicker: 0.22 }); return lan; };
  for (const [x, z] of [[X - 4, Z + 60], [X + 4, Z + 47.5], [X - 8, Z + 36.5], [X + 8, Z + 36.5], [X + 2.4, Z + 23], [X - 18, Z + 8], [X - 30, Z + 8], [X + 2.4, Z - 10], [X - 2.4, Z - 34.5]]) hang(x, z);
  // cold blue fill from water + crystals
  vl(X, 2, Z + 8, '#3a8cff', 6, 18); vl(X, 3, Z + 36, '#ffb070', 4, 22, { flicker: 0.05 });

  // ---------- crystal veins (blue) ----------
  const shardGeo = new THREE.CylinderGeometry(0, 0.24, 1, 6); shardGeo.translate(0, 0.5, 0);
  const cluster = (x, z, s, mat = blueCr) => { const g = new THREE.Group(); g.position.set(x, 0, z); group.add(g);
    for (let i = 0; i < 5; i++) { const m = new THREE.Mesh(shardGeo, mat); const a = i / 5 * 6.28 + rnd(); m.position.set(Math.cos(a) * 0.25 * s, 0, Math.sin(a) * 0.25 * s); m.rotation.set(Math.sin(a) * 0.5, rnd() * 6, -Math.cos(a) * 0.5); m.scale.set(s * (0.8 + rnd() * 0.6), s * (1.4 + rnd() * 1.8), s * (0.8 + rnd() * 0.6)); m.castShadow = true; g.add(m); } return g; };
  crystalSpots.forEach(([x, z]) => cluster(x, z, 0.6 + hash(x, z) * 0.8));
  for (const [x, z, s] of [[X - 10, Z - 14, 2.4], [X + 10, Z - 30, 2.6], [X + 11, Z - 17, 1.8], [X - 11, Z - 28, 2.0]]) { cluster(x, z, s); vl(x, 2.4, z, '#4ab0ff', 9, 12, { flicker: 0.04 }); circles.push([x, z, 1.1, 4]); }

  // crystal minigame nodes: pulse on a shared schedule; strike while glowing
  const nodeMat = () => new THREE.MeshStandardMaterial({ color: '#bfe8ff', emissive: '#4ad0ff', emissiveIntensity: 0.3, roughness: 0.1, flatShading: true });
  const crystals = MINE.crystals.map((c, i) => { const g = cluster(c.x, c.z, 1.3, nodeMat()); const mats = g.children.map(m => m.material); g.children.forEach(m => { m.material = mats[0]; });
    const light = vl(c.x, 1.8, c.z, '#7ae0ff', 0, 7); light.mul = 0; circles.push([c.x, c.z, 0.9, 3]);
    return { ...c, g, mat: mats[0], light, phase: i * 1.37 }; });
  /** Glow window for crystal i at time t (s): 1.3 s out of every 4.5 s. */
  const crystalGlow = (i, t) => ((t + crystals[i].phase) % 4.5) < 1.3;

  // ---------- Flooded Gallery: water, levers, sluice gate ----------
  const W = MINE.water;
  const waterMat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: { uT: { value: 0 }, uA: { value: 0.8 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `varying vec2 vUv; uniform float uT; uniform float uA;
      void main(){ vec2 p = (vUv - 0.5) * 14.0; float c = 0.0;
        for (int i = 0; i < 3; i++) { float fi = float(i); c += sin(p.x * (1.3 + fi * 0.4) + uT * (0.8 + fi * 0.3) + sin(p.y * 1.1 + uT * 0.5 + fi)) * cos(p.y * (1.2 + fi * 0.3) - uT * 0.5); }
        c = pow(abs(c) / 3.0, 2.5); float r = length(vUv - 0.5) * 2.0; float edge = 1.0 - smoothstep(0.9, 1.0, r);
        vec3 col = mix(vec3(0.03, 0.12, 0.25), vec3(0.45, 0.8, 1.0), c);
        gl_FragColor = vec4(col, uA * edge); }` });
  const water = add(new THREE.CircleGeometry(W.r + 0.6, 48), waterMat, W.x, 0.35, W.z, { rx: -Math.PI / 2, cast: false }); water.renderOrder = 2;
  const corrWater = add(new THREE.PlaneGeometry(6, 9), waterMat, X, 0.35, Z - 8.5, { rx: -Math.PI / 2, cast: false }); corrWater.renderOrder = 2;
  const levers = MINE.levers.map(l => { const g = new THREE.Group(); g.position.set(l.x, 0, l.z); g.rotation.y = Math.atan2(W.x - l.x, W.z - l.z); group.add(g);
    add(new THREE.BoxGeometry(1.2, 0.9, 0.8), rust, 0, 0.45, 0, { parent: g }); add(new THREE.CylinderGeometry(0.12, 0.12, 1.3, 8), steel, 0, 0.95, 0, { parent: g, rz: Math.PI / 2 });
    const arm = new THREE.Group(); arm.position.set(0, 0.95, 0); g.add(arm); add(new THREE.CylinderGeometry(0.06, 0.06, 1.4, 6), M.iron, 0, 0.7, 0, { parent: arm }); add(new THREE.SphereGeometry(0.14, 8, 6), new THREE.MeshStandardMaterial({ color: '#c03020', roughness: 0.5 }), 0, 1.4, 0, { parent: arm });
    const bulb = add(new THREE.SphereGeometry(0.13, 8, 6), new THREE.MeshBasicMaterial({ color: '#ff4a2a', toneMapped: false }), 0.45, 0.95, 0.42, { parent: g, cast: false });
    arm.rotation.x = -0.7; circles.push([l.x, l.z, 0.7, 1.2]);
    interactables.push({ id: l.id, kind: 'lever', name: 'Drain lever', x: l.x, z: l.z, r: 2.2, verb: 'Pull' });
    const rec = { ...l, arm, bulb, pulled: false }; rec.set = (on) => { rec.pulled = on; arm.rotation.x = on ? 0.7 : -0.7; bulb.material.color.set(on ? '#5aff7a' : '#ff4a2a'); }; return rec; });
  // sluice: an iron portcullis that rises when all three levers are pulled
  const G = MINE.gate, sluice = new THREE.Group(); group.add(sluice);
  for (let i = 0; i <= 6; i++) add(new THREE.BoxGeometry(0.14, 5.2, 0.14), rust, G.x0 + i * (G.x1 - G.x0) / 6, 2.6, (G.z0 + G.z1) / 2, { parent: sluice });
  for (const y of [0.8, 2.4, 4.0]) add(new THREE.BoxGeometry(G.x1 - G.x0 + 0.2, 0.2, 0.2), rust, X, y, (G.z0 + G.z1) / 2, { parent: sluice });
  frame(X, (G.z0 + G.z1) / 2 + 0.2, 0, 6.8, 5.6);
  const gateLight = vl(X, 2.5, G.z1 + 1.5, '#ff6a3a', 4, 8);
  const gate = K.gate(G, sluice, gateLight, -5.4);
  let drainK = 0;

  // ---------- Foreman's Pit ----------
  const D = MINE.den;
  add(new THREE.RingGeometry(D.r - 1.4, D.r - 1.0, 64), new THREE.MeshBasicMaterial({ color: '#ff9a3a', transparent: true, opacity: 0.18, toneMapped: false, depthWrite: false }), D.x, 0.06, D.z, { rx: -Math.PI / 2, cast: false });
  // grated floor plates + puddles
  const plates = []; for (let i = 0; i < 26; i++) { const a = rnd() * 6.28, r = rnd() * (D.r - 3); plates.push([D.x + Math.cos(a) * r, 0.03, D.z + Math.sin(a) * r, 1.6 + rnd(), 0.05, 1.6 + rnd(), 0, rnd() * 3, 0]); }
  inst(new THREE.BoxGeometry(1, 1, 1), steel, plates, { cast: false });
  // platform carts (stand on them to dodge the Flood Wave)
  const platBoxes = D.carts.map(([x, z, ry]) => { const c = minecart(false); c.position.set(x, 0, z); c.rotation.y = ry; group.add(c);
    const lid = add(new THREE.BoxGeometry(1.7, 0.1, 2.5), timber, 0, 1.2, 0, { parent: c }); lid.castShadow = false;
    const hw = Math.abs(Math.cos(ry)) * 0.85 + Math.abs(Math.sin(ry)) * 1.25, hd = Math.abs(Math.sin(ry)) * 0.85 + Math.abs(Math.cos(ry)) * 1.25; return [x - hw, 0, z - hd, x + hw, 1.15, z + hd]; });
  // the big drill rig behind the boss + pipes
  const rig = new THREE.Group(); rig.position.set(D.x, 0, D.z - 14.5); group.add(rig);
  add(new THREE.BoxGeometry(6, 5, 2.2), rust, 0, 2.5, 0, { parent: rig }); add(new THREE.CylinderGeometry(1.2, 1.2, 2.6, 16), steel, 0, 5.3, 0, { parent: rig, rz: Math.PI / 2 });
  for (const sx of [-3.8, 3.8]) add(new THREE.CylinderGeometry(0.35, 0.35, 9, 10), rust, sx, 4.5, 0.4, { parent: rig });
  const gear = add(new THREE.TorusGeometry(1.6, 0.3, 6, 12), steel, 0, 2.8, 1.25, { parent: rig }); anim.push({ o: gear, spin: 0.4 });
  circles.push([D.x - 2, D.z - 14.5, 1.6, 6], [D.x + 2, D.z - 14.5, 1.6, 6]);
  // overhead swinging lamps (Lamp Swing pivots) + den lights that die in phase 2
  const lamps = D.lamps.map(([x, z]) => { const piv = new THREE.Group(); piv.position.set(x, 7.5, z); group.add(piv);
    add(new THREE.CylinderGeometry(0.03, 0.03, 4, 4), M.iron, 0, -2, 0, { parent: piv, cast: false });
    const head = add(new THREE.ConeGeometry(0.7, 0.8, 12, 1, true), rust, 0, -4.2, 0, { parent: piv }); const bulb = add(new THREE.SphereGeometry(0.3, 10, 8), new THREE.MeshBasicMaterial({ color: '#ffd27a', toneMapped: false }), 0, -4.5, 0, { parent: piv, cast: false });
    const light = vl(x, 3.0, z, '#ffc070', 14, 16, { flicker: 0.1 }); return { piv, bulb, light, x, z }; });
  for (const [x, z] of [[D.x - 11, D.z + 7], [D.x + 11, D.z + 7], [D.x, D.z - 11]]) hang(x, z, 4.2);
  const exit = K.exitPortal(...D.exit);
  const wsUpdate = K.waystone(...MINE.waystone, rust);

  // arrival lift cage (purely visual)
  const cage = new THREE.Group(); cage.position.set(X, 0, Z + 62); group.add(cage);
  for (const [sx, sz] of [[-1.6, -1.6], [1.6, -1.6], [-1.6, 1.6], [1.6, 1.6]]) add(new THREE.BoxGeometry(0.12, 4, 0.12), steel, sx, 2, sz, { parent: cage });
  add(new THREE.BoxGeometry(3.4, 0.15, 3.4), timber, 0, 0.08, 0, { parent: cage, cast: false });
  for (const sz of [-1.6, 1.6]) add(new THREE.BoxGeometry(3.4, 0.12, 0.12), steel, 0, 4, sz, { parent: cage, cast: false });
  for (const sx of [-1.6, 1.6]) add(new THREE.CylinderGeometry(0.04, 0.04, 30, 4), M.iron, sx, 19, 0, { parent: cage, cast: false });
  vl(X, 3.2, Z + 62, '#ffd8a0', 8, 14, { flicker: 0.05 });

  // ---------- drips/dust motes ----------
  const dustN = mobile ? 120 : 260, dGeo = new THREE.BufferGeometry(), dPos = new Float32Array(dustN * 3);
  for (let i = 0; i < dustN; i++) { dPos[i * 3] = (rnd() - 0.5) * 30; dPos[i * 3 + 1] = rnd() * 7; dPos[i * 3 + 2] = (rnd() - 0.5) * 30; }
  dGeo.setAttribute('position', new THREE.BufferAttribute(dPos, 3));
  const dust = new THREE.Points(dGeo, new THREE.PointsMaterial({ color: '#cfe6ff', size: 0.06, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false })); dust.frustumCulled = false; group.add(dust);

  // ---------- lamp posts (timber post + iron lantern) ----------
  const posts = MINE.posts.map(p => { const g = new THREE.Group(); g.position.set(p.x, 0, p.z); group.add(g);
    add(new THREE.BoxGeometry(0.5, 3.6, 0.5), timber, 0, 1.8, 0, { parent: g }); add(new THREE.BoxGeometry(1.3, 0.25, 0.3), timberDark, 0.45, 3.5, 0, { parent: g });
    const lan = K.makeLantern(M, 2.4); lan.position.set(0.95, 3.0, 0); g.add(lan);
    const glow = K.makeGlowDecal('#ffb347', 0); glow.scale.setScalar(6); glow.position.set(p.x, 0.07, p.z); group.add(glow);
    const light = vl(p.x + 0.9, 3.1, p.z, '#ffb35a', 0, 14, { flicker: 0.08 }); light.mul = 0; circles.push([p.x, p.z, 0.5, 3.6]);
    const rec = { ...p, g, lan, glow, light, lit: false };
    rec.setLit = (on) => { rec.lit = on; light.mul = on ? 1 : 0; light.intensity = 16; glow.material.opacity = on ? 0.3 : 0; lan.children.forEach(c => { if (c.material?.emissive) c.material.emissiveIntensity = on ? 2.2 : 0.15; }); lan.userData.flame.visible = on; };
    rec.setLit(false); interactables.push({ id: p.id, kind: 'post', name: `${p.name} lamp post`, x: p.x, z: p.z, r: 2.6, verb: 'Light' }); return rec; });
  const chests = MINE.chests.map(c => K.chest(c, 'Miner\'s strongbox', rust));

  const api = {
    group, posts, chests, veins: [], sacs: [], levers, crystals, crystalGlow, interactables, vlights: K.vlights, laneCarts,
    colliders(col) { this._col = col; gate.bind(col); for (const [x, z, r, top] of circles) col.addCircle(x, z, r, top); for (const b of platBoxes) col.addBox(...b); this.setGate(true); },
    setGate(closed) { gate.set(closed, api); }, gateClosed: true,
    setLevers(arr) { levers.forEach((l, i) => l.set(!!arr[i])); },
    setSacs() {}, setExit(on) { exit.set(on); },
    /** opts: center, dark (0..1 den lights out), now (server ms), lampDirs (Lamp Swing aim per lamp or null), bossAt */
    update(dt, t, { center, dark = 0, now = 0, lampSwing = null } = {}) {
      waterMat.uniforms.uT.value = t; wsUpdate(t); exit.update(t);
      for (const a of anim) a.o.rotation.z += dt * a.spin;
      const k = gate.update(dt, api.gateClosed);
      drainK += ((api.gateClosed ? 0 : 1) - drainK) * Math.min(1, dt * 0.6);
      water.position.y = corrWater.position.y = 0.35 - drainK * 0.3; waterMat.uniforms.uA.value = 0.8 * (1 - drainK * 0.75);
      if (center) { dust.position.set(center.x, 0, center.z); for (let i = 0; i < dustN; i++) { dPos[i * 3 + 1] -= dt * (0.25 + (i % 5) * 0.1); if (dPos[i * 3 + 1] < 0) dPos[i * 3 + 1] = 7; } dGeo.attributes.position.needsUpdate = true; }
      // junction minecarts (deterministic from the shared clock: no network)
      laneCarts.forEach(({ c, lamp, L }, i) => { const t1 = laneNext(i, now - 700), u = (now - t1) / 700 + 0.5; const warn = t1 - now < CART_WARN && t1 > now;
        signals[i].material.color.set(warn || (u >= 0 && u <= 1) ? (Math.floor(t * 8) % 2 ? '#ff3a1a' : '#661010') : '#661010');
        if (u >= 0 && u <= 1) { const x = L.dir > 0 ? L.x0 - 4 + (L.x1 - L.x0 + 8) * u : L.x1 + 4 - (L.x1 - L.x0 + 8) * u; c.visible = true; c.position.set(x, 0, L.z); lamp.pos.set(x, 1.6, L.z); lamp.mul = 1; } else { c.visible = false; lamp.mul = 0; } });
      crystals.forEach((c, i) => { const on = crystalGlow(i, t) && !c.cool; c.mat.emissiveIntensity += ((on ? 2.6 : c.cool ? 0.05 : 0.3) - c.mat.emissiveIntensity) * Math.min(1, dt * 10); c.light.mul = on ? 1 : 0; c.light.intensity = 8; });
      lamps.forEach((l, i) => { const want = lampSwing && lampSwing[i] != null ? Math.sin(t * 9) * 0.25 + 0.5 : Math.sin(t * 0.8 + i) * 0.05; l.piv.rotation.z += (want - l.piv.rotation.z) * Math.min(1, dt * 4); if (lampSwing && lampSwing[i] != null) l.piv.rotation.y = -lampSwing[i] + Math.PI / 2;
        l.light.mul = 1 - dark * 0.95; l.bulb.material.color.set(dark > 0.5 ? '#3a2a1a' : '#ffd27a'); });
      posts.forEach(p => { if (p.lit) p.lan.userData.flame.scale.y = 1.5 + Math.sin(t * 12 + p.x) * 0.25; });
    },
  };
  return api;
}
