// The Aurora Throne (tier 3, brief §3.4). A frozen palace floating above a sea of cloud under the strongest aurora:
// flat-shaded ice terraces with crystalline cliff edges, ruined pillars, mirror panels, braziers, the Queen's throne.
// Starstair (3 terraces, each ending in an Aurora Pillar lit by FLARE) → Hall of Mirrors (bolts bounce) → Throne Arena.
import * as THREE from 'three';
import { makeMats } from './common.js';
import { makeKit, sdfOf, hash, makeRnd } from './dungeon.js';

const X = -1000, Z = -1000;
export const THRONE = {
  shapes: [
    { c: [X, Z + 76], r: 9, id: 't1' }, { rect: [X - 2.5, Z + 56, X + 2.5, Z + 68] },
    { c: [X, Z + 48], r: 9.5, id: 't2' }, { rect: [X - 2.5, Z + 28, X + 2.5, Z + 40] },
    { c: [X, Z + 20], r: 9.5, id: 't3' }, { rect: [X - 2.5, Z + 7, X + 2.5, Z + 12] },
    { rect: [X - 12, Z - 16, X + 12, Z + 8], id: 'hall' }, { rect: [X - 3, Z - 35, X + 3, Z - 15] },
    { c: [X, Z - 50], r: 16, id: 'arena' },
  ],
  arrive: [X, 0, Z + 81], arriveFacing: Math.PI, waystone: [X - 5, Z + 79],
  posts: [{ id: 't0', x: X + 5.5, z: Z + 72, name: 'First Terrace', flare: true }, { id: 't1', x: X - 5.5, z: Z + 45, name: 'Second Terrace', flare: true }, { id: 't2', x: X + 5.5, z: Z + 17, name: 'Third Terrace', flare: true }],
  chests: [{ id: 'th_t2', x: X + 6, z: Z + 52 }, { id: 'th_hall', x: X + 9.5, z: Z - 13 }],
  veins: [],
  mirrors: [{ x: X - 11.4, z: Z - 4, nx: 1, nz: 0, hw: 9 }, { x: X + 11.4, z: Z - 4, nx: -1, nz: 0, hw: 9 }, { x: X - 4.5, z: Z - 7, nx: 0.7071, nz: 0.7071, hw: 1.6 }, { x: X + 4.5, z: Z + 1, nx: -0.7071, nz: 0.7071, hw: 1.6 }],
  chambers: {
    t1: { x: X, z: Z + 76, r: 12, spawns: [['sentinel', X - 3, Z + 71], ['sentinel', X + 3, Z + 70]] },
    t2: { x: X, z: Z + 48, r: 12, spawns: [['sentinel', X, Z + 44], ['wisp', X - 5, Z + 50], ['wisp', X + 5, Z + 46]] },
    t3: { x: X, z: Z + 20, r: 12, spawns: [['knight', X, Z + 16], ['shade', X - 5, Z + 22], ['sentinel', X + 4, Z + 20]] },
    hall: { x: X, z: Z - 4, r: 15, spawns: [['wisp', X - 7, Z - 10], ['wisp', X + 7, Z + 3], ['wisp', X, Z - 13], ['knight', X, Z - 6], ['sentinel', X - 5, Z + 2], ['shade', X + 6, Z - 9]] },
  },
  gateRule: 'posts',
  gate: { x0: X - 3.2, x1: X + 3.2, z0: Z - 24.6, z1: Z - 23.4 },
  den: { x: X, z: Z - 50, r: 16, boss: [X, Z - 52], bossId: 'queen', exit: [X, Z - 42], throne: [X, Z - 64.5],
    braziers: [[X + 9.2, Z - 40.8], [X - 9.2, Z - 40.8], [X - 9.2, Z - 59.2], [X + 9.2, Z - 59.2]] },
};
export const throneSdf = sdfOf(THRONE.shapes);

export function buildThrone({ lights, mobile = false } = {}) {
  const M = makeMats(), rnd = makeRnd(9191);
  const group = new THREE.Group(); group.name = 'throne';
  const K = makeKit({ area: 'throne', lights, group, M }), { add, vl, inst, circles, interactables } = K;
  const anim = [];
  const ice = new THREE.MeshStandardMaterial({ color: '#cfe7ff', roughness: 0.22, metalness: 0.08, flatShading: true });
  const iceDeep = new THREE.MeshStandardMaterial({ color: '#7fa8e0', roughness: 0.3, metalness: 0.1, flatShading: true });
  const marble = new THREE.MeshStandardMaterial({ color: '#e6ecf8', roughness: 0.5, flatShading: true });
  const glowIce = new THREE.MeshStandardMaterial({ color: '#d8fff4', emissive: '#4affd0', emissiveIntensity: 0.6, roughness: 0.15, flatShading: true });
  const violet = new THREE.MeshStandardMaterial({ color: '#c9a8ff', emissive: '#7a3aff', emissiveIntensity: 0.8, roughness: 0.2, flatShading: true });

  // ---------- floor: ice terraces whose edges shear away into crystalline cliffs ----------
  K.floor(throneSdf, { cx: X, cz: Z, w: 70, h: 176, seg: 1.5, colors: ['#9fb8de', '#dff0ff', '#b9c6ee'], flat: true, rough: 0.35, metal: 0.05, wobble: 0.02,
    fall: (d, x, z) => -Math.min(22, d * 5 + hash(Math.floor(x * 2), Math.floor(z * 2)) * 3 * Math.min(1, d)) });
  // hanging icicles under the terraces
  const icicles = []; for (let i = 0; i < (mobile ? 90 : 180); i++) { const x = X + (rnd() - 0.5) * 60, z = Z + (rnd() - 0.5) * 170, d = throneSdf(x, z); if (d < 0.3 || d > 3) continue; const h = 2 + rnd() * 6; icicles.push([x, -h / 2 - 0.6 - d * 2, z, 0.4 + rnd() * 0.6, h, 0.4 + rnd() * 0.6, Math.PI, rnd() * 3, 0]); }
  inst(new THREE.ConeGeometry(0.6, 1, 5), iceDeep, icicles, { cast: false });

  // ---------- balustrade: ice crenellations along the edge (colliders keep you on the terraces) ----------
  const balus = [], rails = [];
  K.edge(throneSdf, { x0: X - 34, x1: X + 34, z0: Z - 88, z1: Z + 88, step: 1.4, top: 14 }, (x, z, d) => { if (d > 0.05 && d < 0.75 && hash(x * 2.1, z * 1.7) < 0.55) { const h = 0.8 + hash(x, z) * 0.6; balus.push([x, h / 2, z, 0.42, h, 0.42, 0, hash(z, x) * 3, 0]); } });
  inst(new THREE.CylinderGeometry(0.6, 0.75, 1, 6), ice, balus);

  // ---------- cloud sea far below (scrolling noise) ----------
  const cloudMat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, fog: false, uniforms: { uT: { value: 0 } },
    vertexShader: 'varying vec2 vW; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: `varying vec2 vW; uniform float uT;
      float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
      float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x), f.y); }
      float fbm(vec2 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 5; i++) { s += a * n(p); p *= 2.03; a *= 0.5; } return s; }
      void main(){ vec2 p = vW * 0.035 + vec2(uT * 0.02, uT * 0.008); float c = fbm(p) * 0.7 + fbm(p * 2.3 - uT * 0.01) * 0.3;
        vec3 col = mix(vec3(0.16, 0.12, 0.35), vec3(0.75, 0.68, 0.95), smoothstep(0.35, 0.8, c));
        col += vec3(0.1, 0.4, 0.3) * smoothstep(0.6, 0.9, c) * 0.5;
        float far = smoothstep(380.0, 120.0, length(vW - cameraPosition.xz));
        gl_FragColor = vec4(col, far * (0.75 + c * 0.25)); }` });
  const clouds = add(new THREE.PlaneGeometry(900, 900), cloudMat, X, -26, Z, { rx: -Math.PI / 2, cast: false }); clouds.renderOrder = -5;
  // distant ruined spires floating in the cloud sea
  for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI * 2 + rnd(), r = 70 + rnd() * 60, x = X + Math.cos(a) * r, z = Z + Math.sin(a) * r * 1.2, h = 14 + rnd() * 30;
    const sp = add(new THREE.CylinderGeometry(0.3 + rnd() * 1.2, 2 + rnd() * 3, h, 6), i % 3 ? iceDeep : ice, x, -26 + h / 2 + rnd() * 6, z, { cast: false }); sp.rotation.z = (rnd() - 0.5) * 0.2;
    add(new THREE.OctahedronGeometry(2 + rnd() * 2), glowIce, x, -20 + h + rnd() * 6, z, { cast: false }); }

  // ---------- ruined pillars around terraces + arches over the bridges ----------
  const colRows = [], capRows = [], rubble = [];
  const pillar = (x, z, h, broken) => { colRows.push([x, h / 2, z, 1, h, 1, 0, rnd() * 3, broken ? (rnd() - 0.5) * 0.12 : 0]); if (!broken) capRows.push([x, h + 0.3, z, 1.5, 0.6, 1.5, 0, 0, 0]);
    else for (let i = 0; i < 3; i++) rubble.push([x + (rnd() - 0.5) * 3, 0.25, z + (rnd() - 0.5) * 3, 0.5 + rnd() * 0.5, 0.4 + rnd() * 0.4, 0.5 + rnd() * 0.5, rnd(), rnd() * 3, rnd()]); circles.push([x, z, 0.75, h]); };
  for (const [cx, cz, r] of [[X, Z + 76, 9], [X, Z + 48, 9.5], [X, Z + 20, 9.5]]) for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2 + 0.5; const x = cx + Math.cos(a) * (r - 1.3), z = cz + Math.sin(a) * (r - 1.3); if (Math.abs(x - X) < 3.5 || Math.hypot(x - THRONE.waystone[0], z - THRONE.waystone[1]) < 4 || THRONE.posts.some(p => Math.hypot(x - p.x, z - p.z) < 3) || THRONE.chests.some(c => Math.hypot(x - c.x, z - c.z) < 2.5)) continue; pillar(x, z, 3 + rnd() * 4, rnd() < 0.5); }
  for (let zz = Z - 14; zz <= Z + 6; zz += 5) for (const sx of [-1, 1]) pillar(X + sx * 9.6, zz, 7.5, false);
  for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; if (Math.abs(Math.sin(a) - 1) < 0.2) continue; const x = X + Math.cos(a) * 15, z = Z - 50 + Math.sin(a) * 15; if (z > Z - 37 && Math.abs(x - X) < 5) continue; pillar(x, z, 6 + (i % 3) * 1.5, i % 4 === 1); }
  inst(new THREE.CylinderGeometry(0.62, 0.72, 1, 8), marble, colRows); inst(new THREE.BoxGeometry(1, 1, 1), marble, capRows); inst(new THREE.DodecahedronGeometry(1), marble, rubble);
  // arches fade out while the follow camera is passing through them (player just north of the arch)
  const arches = [];
  const arch = (z, w = 6) => { const mat = ice.clone(); mat.transparent = true; const ms = [add(new THREE.TorusGeometry(w / 2, 0.35, 6, 18, Math.PI), mat, X, 3.2, z)];
    for (const s of [-1, 1]) ms.push(add(new THREE.BoxGeometry(0.7, 3.2, 0.7), mat, X + s * w / 2, 1.6, z)); arches.push({ z, mat, ms, k: 1 }); };
  arch(Z + 67); arch(Z + 57); arch(Z + 39); arch(Z + 29); arch(Z + 10.5); arch(Z - 19, 6.8); arch(Z - 33, 6.8);
  // floating aurora shards drifting overhead
  const shards = []; for (let i = 0; i < 18; i++) { const m = add(new THREE.OctahedronGeometry(0.35 + rnd() * 0.4), i % 2 ? glowIce : violet, X + (rnd() - 0.5) * 30, 5 + rnd() * 5, Z + (rnd() - 0.5) * 150, { cast: false }); m.scale.y = 2; shards.push({ m, y: m.position.y, s: rnd() * 6 }); }

  // ---------- light: cool moonlit fill, crystal glows ----------
  for (const [x, z] of [[X, Z + 76], [X, Z + 48], [X, Z + 20]]) vl(x, 6, z, '#9ad8ff', 7, 20);
  vl(X - 8, 4, Z - 4, '#c8a8ff', 7, 16); vl(X + 8, 4, Z - 4, '#8affd8', 7, 16);

  // ---------- Aurora Pillars (posts: light with FLARE) ----------
  const posts = THRONE.posts.map(p => { const g = new THREE.Group(); g.position.set(p.x, 0, p.z); group.add(g);
    add(new THREE.CylinderGeometry(1.0, 1.3, 0.5, 8), marble, 0, 0.25, 0, { parent: g });
    const crys = add(new THREE.CylinderGeometry(0.15, 0.55, 4.6, 6), new THREE.MeshStandardMaterial({ color: '#aac8e8', emissive: '#4affd0', emissiveIntensity: 0.05, roughness: 0.1, flatShading: true }), 0, 2.8, 0, { parent: g });
    const ring = add(new THREE.TorusGeometry(0.9, 0.06, 6, 24), M.brass, 0, 2.2, 0, { parent: g, rx: Math.PI / 2 });
    const beam = add(new THREE.CylinderGeometry(0.25, 0.6, 40, 12, 1, true), new THREE.MeshBasicMaterial({ color: '#7affd8', transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }), 0, 25, 0, { parent: g, cast: false });
    const glow = K.makeGlowDecal('#5affd0', 0); glow.scale.setScalar(7); glow.position.set(p.x, 0.07, p.z); group.add(glow);
    const light = vl(p.x, 3.6, p.z, '#6affd8', 0, 16, { flicker: 0.03 }); light.mul = 0; circles.push([p.x, p.z, 0.9, 6]);
    const lan = { userData: { flame: { scale: { y: 1 } } } };
    const rec = { ...p, g, lan, glow, light, lit: false, ring };
    rec.setLit = (on) => { rec.lit = on; light.mul = on ? 1 : 0; light.intensity = 18; glow.material.opacity = on ? 0.35 : 0; crys.material.emissiveIntensity = on ? 1.8 : 0.05; beam.material.opacity = on ? 0.22 : 0; };
    rec.setLit(false); interactables.push({ id: p.id, kind: 'post', flare: true, name: `${p.name} Aurora Pillar`, x: p.x, z: p.z, r: 3.0, verb: 'FLARE to light' }); return rec; });

  // ---------- Hall of Mirrors ----------
  const mirMat = new THREE.MeshStandardMaterial({ color: '#dcefff', roughness: 0.04, metalness: 0.9, emissive: '#3a5a9a', emissiveIntensity: 0.25 });
  const edgeMat = new THREE.MeshBasicMaterial({ color: '#9ae8ff', toneMapped: false });
  for (const m of THRONE.mirrors) { const ry = Math.atan2(m.nx, m.nz), w = m.hw * 2;
    if (m.hw > 4) { for (let k = -2; k <= 2; k++) { const px = m.x - m.nz * k * 3.6 * 0 + (m.nx ? 0 : k * 3.6), pz = m.z + (m.nx ? k * 3.6 : 0); add(new THREE.BoxGeometry(3.2, 5.4, 0.12), mirMat, px, 2.9, pz, { ry }); add(new THREE.BoxGeometry(3.4, 0.12, 0.2), edgeMat, px, 5.65, pz, { ry, cast: false }); } }
    else { add(new THREE.BoxGeometry(w, 4.4, 0.14), mirMat, m.x, 2.4, m.z, { ry }); add(new THREE.BoxGeometry(w + 0.2, 0.12, 0.22), edgeMat, m.x, 4.65, m.z, { ry, cast: false }); add(new THREE.BoxGeometry(w + 0.4, 0.3, 0.6), marble, m.x, 0.15, m.z, { ry });
      const c = Math.cos(ry), s = Math.sin(ry); for (let k = -1; k <= 1; k++) circles.push([m.x + c * k * m.hw * 0.7, m.z - s * k * m.hw * 0.7, 0.45, 5]); } }
  // hall floor inlay
  add(new THREE.PlaneGeometry(4, 22), new THREE.MeshStandardMaterial({ color: '#3a4a8a', emissive: '#2a3a8a', emissiveIntensity: 0.5, roughness: 0.3 }), X, 0.03, Z - 4, { rx: -Math.PI / 2, cast: false });

  // ---------- aurora barrier gate (opens when all three pillars are lit) ----------
  const G = THRONE.gate, barrier = new THREE.Group(); group.add(barrier);
  const veilMat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide, uniforms: { uT: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `varying vec2 vUv; uniform float uT; void main(){ float w = sin(vUv.x * 20.0 + uT * 2.0 + sin(vUv.y * 6.0 - uT) * 2.0) * 0.5 + 0.5; vec3 c = mix(vec3(0.2, 1.0, 0.7), vec3(0.7, 0.4, 1.0), vUv.y); gl_FragColor = vec4(c, (0.25 + w * 0.35) * (1.0 - vUv.y * 0.6)); }` });
  add(new THREE.PlaneGeometry(G.x1 - G.x0, 6), veilMat, X, 3, (G.z0 + G.z1) / 2, { parent: barrier, cast: false });
  const gateLight = vl(X, 2.5, G.z1 + 1.2, '#7affd8', 6, 9);
  const gate = K.gate(G, barrier, gateLight, 6.5);

  // ---------- Throne Arena ----------
  const D = THRONE.den;
  const dais = add(new THREE.CylinderGeometry(D.r - 0.5, D.r, 0.3, 48), new THREE.MeshStandardMaterial({ color: '#c8d8f4', roughness: 0.25, metalness: 0.1, flatShading: true }), D.x, -0.12, D.z, { cast: false });
  const runeRing = add(new THREE.RingGeometry(D.r - 2, D.r - 1.5, 64), new THREE.MeshBasicMaterial({ color: '#7affd8', transparent: true, opacity: 0.3, toneMapped: false, depthWrite: false }), D.x, 0.05, D.z, { rx: -Math.PI / 2, cast: false });
  const starGeo = new THREE.RingGeometry(3, 3.3, 6); add(starGeo, new THREE.MeshBasicMaterial({ color: '#c8a8ff', transparent: true, opacity: 0.35, toneMapped: false, depthWrite: false }), D.x, 0.05, D.z, { rx: -Math.PI / 2, cast: false });
  // the throne
  const th = new THREE.Group(); th.position.set(D.throne[0], 0, D.throne[1]); group.add(th);
  add(new THREE.BoxGeometry(5, 1.2, 3.4), marble, 0, 0.6, 0, { parent: th }); add(new THREE.BoxGeometry(3, 1.1, 2.2), ice, 0, 1.75, 0.3, { parent: th });
  add(new THREE.BoxGeometry(3.2, 6, 0.6), ice, 0, 4.3, -0.9, { parent: th });
  for (let i = 0; i < 7; i++) { const a = (i - 3) * 0.32; add(new THREE.ConeGeometry(0.35, 3 + (3 - Math.abs(i - 3)) * 1.4, 5), i % 2 ? glowIce : violet, Math.sin(a) * 2, 7.5 + (3 - Math.abs(i - 3)) * 0.6, -0.9 - Math.cos(a) * 0.2, { parent: th, rz: -a * 0.6 }); }
  for (const s of [-1, 1]) add(new THREE.BoxGeometry(0.6, 1.6, 2.2), ice, s * 1.7, 2.2, 0.3, { parent: th });
  circles.push([D.throne[0], D.throne[1], 2.6, 8]);
  vl(D.throne[0], 6, D.throne[1] + 1, '#b08aff', 10, 18, { flicker: 0.04 });
  // braziers (light with FLARE during the Long Night)
  const braziers = D.braziers.map(([x, z], i) => { const g = new THREE.Group(); g.position.set(x, 0, z); group.add(g);
    add(new THREE.CylinderGeometry(0.35, 0.6, 1.6, 8), marble, 0, 0.8, 0, { parent: g }); add(new THREE.CylinderGeometry(1.0, 0.5, 0.6, 12, 1, true), M.brass, 0, 1.85, 0, { parent: g });
    const fire = new THREE.Group(); fire.position.y = 2.0; g.add(fire);
    const f1 = add(new THREE.ConeGeometry(0.55, 1.4, 8), new THREE.MeshBasicMaterial({ color: '#7affd8', transparent: true, opacity: 0.9, toneMapped: false, blending: THREE.AdditiveBlending, depthWrite: false }), 0, 0.6, 0, { parent: fire, cast: false });
    const f2 = add(new THREE.ConeGeometry(0.3, 0.9, 8), new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false }), 0, 0.4, 0, { parent: fire, cast: false });
    const glow = K.makeGlowDecal('#7affd8', 0); glow.scale.setScalar(5); glow.position.set(x, 0.07, z); group.add(glow);
    const light = vl(x, 2.8, z, '#7affd8', 0, 12, { flicker: 0.1 }); light.mul = 0; circles.push([x, z, 0.7, 2.4]);
    return { i, x, z, fire, glow, light, lit: false, k: 0 }; });
  const exit = K.exitPortal(...D.exit, '#9affd8');
  const wsUpdate = K.waystone(...THRONE.waystone, ice);

  // ---------- snow glitter ----------
  const sN = mobile ? 160 : 320, sGeo = new THREE.BufferGeometry(), sPos = new Float32Array(sN * 3);
  for (let i = 0; i < sN; i++) { sPos[i * 3] = (rnd() - 0.5) * 34; sPos[i * 3 + 1] = rnd() * 12; sPos[i * 3 + 2] = (rnd() - 0.5) * 34; }
  sGeo.setAttribute('position', new THREE.BufferAttribute(sPos, 3));
  const glitter = new THREE.Points(sGeo, new THREE.PointsMaterial({ color: '#e8f4ff', size: 0.08, transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false })); glitter.frustumCulled = false; group.add(glitter);

  const chests = THRONE.chests.map(c => K.chest(c, 'Frost-bound chest', new THREE.MeshStandardMaterial({ color: '#6a7aa8', roughness: 0.4, metalness: 0.3 })));
  const api = {
    group, posts, chests, veins: [], sacs: [], braziers, interactables, vlights: K.vlights,
    colliders(col) { this._col = col; gate.bind(col); for (const [x, z, r, top] of circles) col.addCircle(x, z, r, top); this.setGate(true); },
    setGate(closed) { gate.set(closed, api); }, gateClosed: true,
    setSacs() {}, setExit(on) { exit.set(on); },
    /** opts: center, braz (bool[4] lit), night (Long Night 0..1), aurora (Rekindled Aurora on) */
    update(dt, t, { center, braz = null, night = 0, aurora = false } = {}) {
      if (center) for (const a of arches) { const dz = a.z - center.z, want = dz > 0 && dz < 13 && Math.abs(center.x - X) < 12 ? 0.18 : 1; if (Math.abs(a.k - want) > 0.01) { a.k += (want - a.k) * Math.min(1, dt * 6); a.mat.opacity = a.k; a.mat.depthWrite = a.k > 0.9; a.ms.forEach(m => { m.castShadow = a.k > 0.9; }); } }
      cloudMat.uniforms.uT.value = t; veilMat.uniforms.uT.value = t; wsUpdate(t); exit.update(t);
      gate.update(dt, api.gateClosed);
      shards.forEach(s => { s.m.position.y = s.y + Math.sin(t * 0.7 + s.s) * 0.5; s.m.rotation.y = t * 0.4 + s.s; });
      if (center) { glitter.position.set(center.x, 0, center.z); for (let i = 0; i < sN; i++) { sPos[i * 3 + 1] -= dt * (0.3 + (i % 5) * 0.08); if (sPos[i * 3 + 1] < 0) sPos[i * 3 + 1] = 12; } sGeo.attributes.position.needsUpdate = true; }
      braziers.forEach((b, i) => { const on = !!(braz && braz[i]); b.k += ((on ? 1 : 0) - b.k) * Math.min(1, dt * 5); b.fire.visible = b.k > 0.03; b.fire.scale.set(b.k, b.k * (1 + Math.sin(t * 13 + i) * 0.12), b.k); b.light.mul = b.k; b.light.intensity = aurora ? 16 : 11; b.glow.material.opacity = b.k * 0.35; });
      runeRing.material.opacity = aurora ? 0.6 + Math.sin(t * 6) * 0.2 : night ? 0.08 : 0.3; runeRing.material.color.set(aurora ? '#ffffff' : '#7affd8');
      posts.forEach(p => { p.ring.rotation.z = t * (p.lit ? 1.2 : 0.2); });
    },
  };
  return api;
}
