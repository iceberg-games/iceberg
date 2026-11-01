// Crystal Spire (set id `crystal-spire`, GM1 game `crystal-spire`): faceted crystal needle over a glacier cirque.
// Spiral climb of crystal ledges, 3 checkpoint geode tiers + summit w/ beacon sockets, wind bridges to satellite
// shards, glowing shard rings, aurora sky, prismatic light shafts, layered fog. Procedural Three.js only.
// Open: /sets/?set=crystal-spire   Soft-GPU: 6 point lights, 1024 shadow map, instanced Batches, yields in create.
import * as THREE from 'three';
import { Batch, glowMaterial, rng } from './lib/blocks.js';
import { createSky } from './lib/sky.js';
import * as L from './layout.js';
import { SHOTS } from './shots.js';

const yieldFrame = () => new Promise(r => setTimeout(r, 0));
const hdr = (hex, k) => { const c = new THREE.Color(hex); return [c.r * k, c.g * k, c.b * k]; };
const PRISM = ['#7fd4ff', '#c49bff', '#ff8fd0', '#4ff0d0', '#ffe08a'];

// faceted crystal: low-side cylinder w/ pointed top, jittered for facets
function crystalGeo(sides = 6, R = rng(1), tip = 0.35) {
  const g = new THREE.CylinderGeometry(0.75, 1, 1, sides, 2, false); const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const y = p.getY(i); if (y > 0.49) { p.setX(i, 0); p.setZ(i, 0); p.setY(i, 0.5 + tip); } }
  g.computeVertexNormals(); return g.toNonIndexed();
}

export default {
  id: 'crystal-spire',
  name: 'Crystal Spire',
  async create({ renderer, gameplay = false }) {   // gameplay: the game renders disappearing panes itself
    const R = rng(9001);
    const scene = new THREE.Scene();
    const B = new Batch(), G = new Batch();
    const cyl = new THREE.CylinderGeometry(1, 1, 1, 7), box = new THREE.BoxGeometry(1, 1, 1), sphere = new THREE.SphereGeometry(1, 14, 10),
      torus = new THREE.TorusGeometry(1, 0.07, 6, 40), oct = new THREE.OctahedronGeometry(1), shard = crystalGeo(6), shard5 = crystalGeo(5, R, 0.6), cone = new THREE.ConeGeometry(1, 1, 6);
    const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.5, ...o });
    const M = {
      snow: std('#eef5ff', { roughness: 0.92 }),
      rock: std('#7484a8', { roughness: 0.85, flatShading: true }),
      glacier: std('#bfe2ff', { roughness: 0.3, flatShading: true, emissive: '#3d6aa8', emissiveIntensity: 0.12 }),
      crystal: std('#a9e4ff', { roughness: 0.08, metalness: 0.15, flatShading: true, transparent: true, opacity: 0.82, emissive: '#2f6fd0', emissiveIntensity: 0.35 }),
      crystalSolid: std('#cdeeff', { roughness: 0.12, metalness: 0.2, flatShading: true, emissive: '#3b7fe0', emissiveIntensity: 0.25 }),
      ledge: std('#e6f6ff', { roughness: 0.18, metalness: 0.1, flatShading: true, emissive: '#4d8ce0', emissiveIntensity: 0.1 }),
      floor: std('#d8eeff', { roughness: 0.06, metalness: 0.35 }),   // reflective-ish polished ice
      metal: std('#c9d6e8', { roughness: 0.3, metalness: 0.8 }),
    };
    const glow = glowMaterial();

    // ---------- sky / fog / lights ----------
    const sky = createSky(); scene.add(sky.mesh);
    sky.uniforms.uNightTop.value.set('#0e1f4e'); sky.uniforms.uNightHorizon.value.set('#2c5596');
    scene.fog = new THREE.FogExp2('#14244c', 0.011);
    const hemi = new THREE.HemisphereLight('#9fc4ff', '#2a2f55', 0.8); scene.add(hemi);
    const key = new THREE.DirectionalLight('#d6e6ff', 0.9); key.position.set(-30, 70, 40); scene.add(key);
    key.castShadow = true; key.shadow.mapSize.set(1024, 1024);
    Object.assign(key.shadow.camera, { left: -30, right: 30, top: 80, bottom: -10, near: 5, far: 160 });
    const pl = (col, x, y, z, I, d = 22) => { const p = new THREE.PointLight(col, I, d, 1.6); p.position.set(x, y, z); p.userData.base = I; scene.add(p); return p; };
    const cps = L.CHECKPOINTS;
    const lights = [pl('#7fd4ff', 0, 3, 11, 30, 26), ...L.CHAMBERS.map(c => pl(c.glow, c.x * 1.1, c.y + 2.5, c.z * 1.1, 26)), pl('#ffe08a', 0, L.SUMMIT.y + 3, 0, 40, 26), pl('#c49bff', 0, L.BEACON.y, 0, 60, 40)];  // 6

    // ---------- cirque: snow bowl, rock ridge, glacier tongues ----------
    { const g = new THREE.PlaneGeometry(260, 260, 110, 110); g.rotateX(-Math.PI / 2); const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i); p.setY(i, L.groundHeight(x, z) + (Math.hypot(x, z) > L.BASE.r + 2 ? (R() - 0.5) * 0.3 : 0)); }
      g.computeVertexNormals(); const m = new THREE.Mesh(g, M.snow); m.receiveShadow = true; scene.add(m); }
    for (let k = 0; k < 34; k++) { const a = k / 34 * Math.PI * 2 + R() * 0.1, r = L.CIRQUE.r0 + 36 + R() * 18, h = L.CIRQUE.peakH * (0.55 + R() * 0.6) * (Math.abs(Math.sin(a - 0.4)) * 0.4 + 0.7);
      const x = Math.cos(a) * r, z = Math.sin(a) * r, y = L.groundHeight(x, z);
      B.add(M.rock, cone, x, y + h / 2 - 2, z, 9 + R() * 8, h, 9 + R() * 8, '#8090b4', [0, R() * 3, 0]);
      B.add(M.snow, cone, x, y + h * 0.82 - 2, z, (9 + R() * 4) * 0.42, h * 0.38, (9 + R() * 4) * 0.42, '#ffffff', [0, R() * 3, 0]); }
    for (let k = 0; k < 7; k++) { const a = k / 7 * Math.PI * 2 + 0.6, r0 = L.CIRQUE.r0 - 6;   // glacier tongues flowing into the bowl
      for (let s = 0; s < 6; s++) { const r = r0 + s * 4, x = Math.cos(a) * r, z = Math.sin(a) * r;
        B.add(M.glacier, box, x, L.groundHeight(x, z) + 0.6 + s * 0.6, z, 6 - s * 0.3, 1.6 + s * 0.8, 4.2, '#cfeaff', [0.1, -a, 0.05 * s]); } }
    await yieldFrame();

    // ---------- base camp plaza: polished ice floor, rune ring, sentinel shards, tents ----------
    { const fl = new THREE.Mesh(new THREE.CylinderGeometry(L.BASE.r, L.BASE.r + 0.4, 0.3, 48), M.floor); fl.position.y = -0.12; fl.receiveShadow = true; scene.add(fl); }
    for (let k = 0; k < 48; k++) { const a = k / 48 * Math.PI * 2; G.add(glow, box, Math.cos(a) * (L.BASE.r - 0.6), 0.05, Math.sin(a) * (L.BASE.r - 0.6), 0.5, 0.04, 0.12, hdr(PRISM[k % 5], 1.3), [0, -a, 0]); }
    for (let k = 0; k < 24; k++) { const a = k / 24 * Math.PI * 2; G.add(glow, box, Math.cos(a) * 9.5, 0.05, Math.sin(a) * 9.5, 1.2, 0.03, 0.08, hdr('#7fd4ff', 1.1), [0, -a, 0]); }
    for (const c of L.CRYSTALS.slice(1)) { const y = L.groundHeight(c.x, c.z);
      B.add(M.crystal, shard, c.x, y + c.h / 2 - 0.5, c.z, c.h * 0.16, c.h, c.h * 0.16, '#bfe8ff', [R() * 0.2 - 0.1, R() * 3, R() * 0.2 - 0.1]);
      for (let j = 0; j < 4; j++) B.add(M.crystal, shard5, c.x + (R() - 0.5) * 5, y + 1, c.z + (R() - 0.5) * 5, 0.5 + R() * 0.6, 2 + R() * 3, 0.5 + R() * 0.6, PRISM[j % 5], [R() - 0.5, R() * 3, R() - 0.5]);
      G.add(glow, sphere, c.x, y + 0.2, c.z, 1.6, 0.1, 1.6, hdr('#7fd4ff', 0.6)); }
    for (const [a, col] of [[2.2, '#ff8fd0'], [2.7, '#ffe08a'], [0.8, '#4ff0d0']]) { const x = Math.cos(a) * 12.5, z = Math.sin(a) * 12.5;   // base camp tents w/ lanterns
      B.add(M.ledge, cone, x, 1.1, z, 1.8, 2.2, 1.8, col, [0, a, 0]); G.add(glow, sphere, x + 1.4, 1.6, z, 0.18, 0.22, 0.18, hdr('#ffd08a', 2.2)); B.add(M.metal, cyl, x + 1.4, 0.8, z, 0.04, 1.6, 0.04); }
    await yieldFrame();

    // ---------- the needle: faceted, layered collars, embedded glow veins ----------
    const N = L.NEEDLE;
    { const g = new THREE.CylinderGeometry(N.topR, N.baseR, N.height, N.sides, 16); const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) { const y = p.getY(i); const tw = (y / N.height + 0.5) * 0.9; const x = p.getX(i), z = p.getZ(i);   // twist + facet jitter
        const j = 1 + (Math.sin(i * 12.9898) * 0.5) * 0.05; p.setX(i, (x * Math.cos(tw) - z * Math.sin(tw)) * j); p.setZ(i, (x * Math.sin(tw) + z * Math.cos(tw)) * j); }
      const ng = g.toNonIndexed(); ng.computeVertexNormals();
      const nm = new THREE.Mesh(ng, M.crystalSolid); nm.position.set(N.x, N.height / 2, N.z); nm.castShadow = nm.receiveShadow = true; scene.add(nm);
      const shell = new THREE.Mesh(ng, M.crystal); shell.scale.set(1.06, 1.0, 1.06); shell.position.copy(nm.position); scene.add(shell); }
    // tip crystal (beacon) above summit
    const tip = new THREE.Mesh(oct, glowMaterial({ color: new THREE.Color('#d8c4ff').multiplyScalar(1.6) })); tip.scale.set(1.6, 4.5, 1.6); tip.position.set(0, L.BEACON.y, 0); scene.add(tip);
    // glow veins spiraling up the needle (reads the climb direction)
    for (let i = 0; i < 260; i++) { const t = i / 260, y = t * N.height * 0.96, a = t * Math.PI * 9 + 0.3, r = L.needleRadius(y) * 1.03;
      G.add(glow, box, Math.cos(a) * r, y, Math.sin(a) * r, 0.25, 0.6, 0.08, hdr(PRISM[(i >> 3) % 5], 1.2), [0, -a + Math.PI / 2, 0.5]); }
    // secondary spikes off the needle
    for (let i = 0; i < 26; i++) { const y = 4 + R() * 60, a = R() * Math.PI * 2, r = L.needleRadius(y), s = 0.5 + R() * 0.9;
      B.add(M.crystal, shard, Math.cos(a) * r, y, Math.sin(a) * r, s, 3 + R() * 4, s, '#d0efff', [Math.sin(a) * 1.1, 0, -Math.cos(a) * 1.1]); }
    await yieldFrame();

    // ---------- route: ledges, checkpoint geode tiers, satellites, bridges, struts ----------
    for (const p of L.PLATFORMS) {
      if (gameplay && p.kind === 'pane') continue;
      const th = p.kind === 'checkpoint' ? 0.8 : 0.5, rot = [0, p.rot, 0];
      const col = p.kind === 'slip' ? '#bff2ff' : p.kind === 'pane' ? '#e9dcff' : p.kind === 'satellite' ? '#dff0ff' : '#eef8ff';
      B.add(p.kind === 'pane' ? M.crystal : M.ledge, box, p.x, p.y - th / 2, p.z, p.d, th, p.w, col, rot);
      // underside crystal cluster (pointing down) to sell "grown from crystal"
      B.add(M.crystal, shard5, p.x, p.y - th - 0.9, p.z, p.d * 0.3, 1.8, p.w * 0.3, PRISM[p.i % 5], [Math.PI, p.rot, 0]);
      // rim glow strip on the outer edge (readable route line at night)
      const ox = Math.cos(p.a) * p.d / 2, oz = Math.sin(p.a) * p.d / 2;
      G.add(glow, box, p.x + ox, p.y + 0.02, p.z + oz, 0.08, 0.06, p.w * 0.9, hdr(p.kind === 'slip' ? '#4ff0d0' : p.kind === 'pane' ? '#c49bff' : '#7fd4ff', 1.6), rot);
      if (p.kind === 'satellite') { const y0 = L.groundHeight(p.x, p.z);   // satellite shard pillar rising from the cirque
        B.add(M.crystal, shard, p.x, (p.y + y0) / 2 - 1, p.z, 1.6, p.y - y0 - 1.5, 1.6, '#c4e9ff', [0, R() * 3, 0]);
        for (let j = 0; j < 3; j++) B.add(M.crystal, shard5, p.x + (R() - 0.5) * 2.5, p.y + 0.8, p.z + (R() - 0.5) * 2.5, 0.25, 1.4 + R(), 0.25, PRISM[j], [R() - 0.5, 0, R() - 0.5]); }
      else { const ir = L.needleRadius(p.y); B.box(M.ledge, Math.cos(p.a) * (ir + (p.r - ir) / 2 - 0.5), p.y - th - 0.15, Math.sin(p.a) * (ir + (p.r - ir) / 2 - 0.5), p.r - ir, 0.3, 0.8, '#d6ecff', rot); }
    }
    for (const c of L.CHAMBERS) {   // geode tier: crystal cluster walls + floor glyph
      const a = Math.atan2(c.z, c.x), r = Math.hypot(c.x, c.z);
      for (let j = 0; j < 14; j++) { const t = a + (j / 13 - 0.5) * 1.3, rr = r + 2.6 + R() * 0.6, h = 1.2 + R() * 3.2;
        B.add(M.crystal, shard, Math.cos(t) * rr, c.y + h / 2 - 0.2, Math.sin(t) * rr, 0.35 + R() * 0.4, h, 0.35 + R() * 0.4, j % 3 ? '#d8f0ff' : c.glow, [Math.cos(t) * 0.3, 0, -Math.sin(t) * 0.3]); }
      G.add(glow, torus, c.x, c.y + 0.05, c.z, 1.6, 1.6, 1.2, hdr(c.glow, 2), [Math.PI / 2, 0, 0]);   // checkpoint pad
      G.add(glow, cyl, c.x, c.y + 0.03, c.z, 1.3, 0.03, 1.3, hdr(c.glow, 0.7));
      B.add(M.metal, cyl, c.x - Math.sin(a) * 2.6, c.y + 1.2, c.z + Math.cos(a) * 2.6, 0.06, 2.4, 0.06);   // banner pole
      G.add(glow, box, c.x - Math.sin(a) * 2.6 + 0.4, c.y + 2.0, c.z + Math.cos(a) * 2.6, 0.8, 0.6, 0.04, hdr(c.glow, 1.6), [0, -a, 0]);
    }
    { const c = L.CHECKPOINTS[0]; G.add(glow, torus, c.x, 0.06, c.z, 1.6, 1.6, 1.2, hdr('#7fd4ff', 2), [Math.PI / 2, 0, 0]); G.add(glow, cyl, c.x, 0.04, c.z, 1.3, 0.03, 1.3, hdr('#7fd4ff', 0.7)); }
    for (const b of L.BRIDGES) {   // wind bridges: thin plank + ice-rope rails + pennant flags
      const [ax, ay, az] = b.a, [bx, by, bz] = b.b, dx = bx - ax, dy = by - ay, dz = bz - az, len = Math.hypot(dx, dz), yaw = Math.atan2(dx, dz), pitch = -Math.atan2(dy, len);
      const n = Math.ceil(len / 0.6); for (let i = 0; i < n; i++) { const t = (i + 0.5) / n; B.box(M.ledge, ax + dx * t, ay + dy * t - 0.12, az + dz * t, b.width, 0.12, len / n - 0.06, i & 1 ? '#e0f2ff' : '#cbe6ff', [0, yaw, 0]); }
      for (const s of [-1, 1]) { const ox = Math.cos(yaw) * s * b.width / 2, oz = -Math.sin(yaw) * s * b.width / 2;
        for (let i = 0; i <= n; i += 3) { const t = i / n; B.add(M.metal, cyl, ax + dx * t + ox, ay + dy * t + 0.5, az + dz * t + oz, 0.03, 1, 0.03); }
        G.add(glow, box, (ax + bx) / 2 + ox, (ay + by) / 2 + 1.0, (az + bz) / 2 + oz, 0.04, 0.04, len, hdr('#9fe4ff', 1.4), [pitch, yaw, 0]); }
    }
    // summit: disc around needle tip, 4 beacon sockets, ring of standing crystals
    { const S = L.SUMMIT; B.add(M.floor, cyl, 0, S.y - 0.4, 0, S.r, 0.8, S.r, '#e8f6ff');
      B.add(M.crystal, shard5, 0, S.y - 2.5, 0, S.r * 0.7, 4, S.r * 0.7, '#a9d8ff', [Math.PI, 0, 0]);
      for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2; B.add(M.crystal, shard, Math.cos(a) * (S.r - 0.3), S.y + 0.6, Math.sin(a) * (S.r - 0.3), 0.18, 1.3 + (k % 3) * 0.4, 0.18, PRISM[k % 5]); }
      for (const s of L.BEACON_SOCKETS) { B.add(M.metal, cyl, s.x, s.y + 0.4, s.z, 0.45, 0.8, 0.45); G.add(glow, torus, s.x, s.y + 0.82, s.z, 0.38, 0.38, 0.6, hdr('#ffe08a', 2), [Math.PI / 2, 0, 0]); }
      // beam from summit to tip
      G.add(glow, cyl, 0, (S.y + L.BEACON.y) / 2, 0, 0.12, L.BEACON.y - S.y, 0.12, hdr('#e8d8ff', 1.2)); }
    // shard rings (fly-through hoops)
    const rings = [];
    for (const r of L.SHARD_RINGS) { const m = new THREE.Mesh(torus, glowMaterial({ color: new THREE.Color(r.color).multiplyScalar(1.8) }));
      m.position.set(r.x, r.y, r.z); m.scale.setScalar(r.r); m.rotation.y = r.facing; scene.add(m); rings.push(m);
      for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; B.add(M.crystal, oct, r.x + Math.cos(r.facing) * Math.cos(a) * r.r, r.y + Math.sin(a) * r.r, r.z - Math.sin(r.facing) * Math.cos(a) * r.r, 0.14, 0.3, 0.14, r.color); } }
    B.build(scene); G.build(scene, { cast: false, receive: false });
    await yieldFrame();

    // ---------- collectibles + sensory: floating shards, light shafts, fog layers, prism motes ----------
    const shardMats = PRISM.map(c => glowMaterial({ color: new THREE.Color(c).multiplyScalar(1.5) }));
    const shards = L.SHARDS.map((s, i) => { const m = new THREE.Mesh(oct, shardMats[i % 5]); m.scale.set(0.22, 0.38, 0.22); m.position.set(s.x, s.y, s.z); scene.add(m); return { m, s, ph: i * 0.7 }; });
    const shaftMat = new THREE.MeshBasicMaterial({ color: '#bfe0ff', transparent: true, opacity: 0.06, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
    const shafts = [];
    for (let k = 0; k < 7; k++) { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 2.2, 70, 8, 1, true), shaftMat.clone());
      m.material.color.set(PRISM[k % 5]); const a = k / 7 * Math.PI * 2; m.position.set(Math.cos(a) * 22, 34, Math.sin(a) * 22); m.rotation.set(Math.sin(a) * 0.25, 0, -Math.cos(a) * 0.25); scene.add(m); shafts.push(m); }
    const fogTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'); const g = x.createRadialGradient(64, 64, 8, 64, 64, 64);
      g.addColorStop(0, 'rgba(255,255,255,0.5)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c); })();
    const fogs = [];
    for (const [y, op, sz] of [[5, 0.2, 90], [9, 0.1, 70]]) { const m = new THREE.Mesh(new THREE.PlaneGeometry(sz, sz), new THREE.MeshBasicMaterial({ map: fogTex, color: '#9fc0ee', transparent: true, opacity: op, depthWrite: false, fog: false, side: THREE.DoubleSide }));
      m.rotation.x = -Math.PI / 2; m.position.y = y; scene.add(m); fogs.push(m); }
    const moteN = 500, mg = new THREE.BufferGeometry(), mp = new Float32Array(moteN * 3), mc = new Float32Array(moteN * 3);
    for (let i = 0; i < moteN; i++) { const a = R() * 6.283, r = 3 + R() * 16, y = R() * 72; mp.set([Math.cos(a) * r, y, Math.sin(a) * r], i * 3); const c = new THREE.Color(PRISM[i % 5]); mc.set([c.r, c.g, c.b], i * 3); }
    mg.setAttribute('position', new THREE.BufferAttribute(mp, 3)); mg.setAttribute('color', new THREE.BufferAttribute(mc, 3));
    const motes = new THREE.Points(mg, new THREE.PointsMaterial({ size: 0.14, vertexColors: true, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false })); scene.add(motes);

    // ---------- look ----------
    const look = { night: 1, weather: 0 };
    function applyLook() { const n = look.night;
      scene.fog.density = 0.006 + n * 0.005 + look.weather * 0.012; scene.fog.color.set('#14244c').lerp(new THREE.Color('#c4dcf5'), 1 - n);
      hemi.intensity = 0.8 + (1 - n) * 0.8; key.intensity = 0.9 + (1 - n) * 1.4; lights.forEach(l => { l.userData.k = 0.4 + 0.6 * n; });
      shafts.forEach(s => { s.visible = n > 0.3; }); sky.uniforms.uNight.value = n; renderer.toneMappingExposure = 1.0; }
    applyLook();

    return {
      scene, shots: SHOTS, defaultNight: 1, defaultSnow: 1,
      snow: { count: 5000, box: 70, height: 80 },
      spawn: { pos: [L.SPAWN.x, 0.1, L.SPAWN.z], facing: L.SPAWN.facing },
      walkBounds: { type: 'box', ...L.BOUNDS },
      groundHeight: L.groundHeight, floorHeight: L.floorHeight,
      layout: L, shardMeshes: shards.map(s => s.m), ringMeshes: rings, tip,
      setNight(v) { if (v !== look.night) { look.night = v; applyLook(); } },
      setWeather(v) { if (v !== look.weather) { look.weather = v; applyLook(); } },
      wind: (w) => ({ speed: 1.5 + w * 6, wind: [1 + w * 9, 0.2 + w * 3] }),
      avatarColors: { skin: '#f1c9a5', shirt: '#7fd4ff', pants: '#24305a' },
      bloom: (n) => ({ strength: 0.6 + n * 0.3, radius: 0.6, threshold: 0.95 }),
      update(dt, t) {
        sky.uniforms.uTime.value = t;
        for (const { m, s, ph } of shards) { m.position.y = s.y + Math.sin(t * 1.6 + ph) * 0.18; m.rotation.y = t * 1.4 + ph; }
        rings.forEach((r, i) => { r.rotation.z = t * 0.6 + i; const s = 1 + Math.sin(t * 2 + i) * 0.04; r.scale.setScalar(L.SHARD_RINGS[i].r * s); });
        shafts.forEach((s, i) => { s.material.opacity = 0.025 + 0.015 * Math.sin(t * 0.5 + i * 1.7); s.rotation.y = t * 0.02; });
        fogs.forEach((f, i) => { f.rotation.z = t * 0.01 * (i & 1 ? -1 : 1); });
        motes.rotation.y = t * 0.03;
        tip.rotation.y = t * 0.5;
        lights.forEach((l, i) => { l.intensity = l.userData.base * l.userData.k * (0.85 + 0.15 * Math.sin(t * 1.3 + i)); });
      },
    };
  },
};
