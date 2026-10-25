// Rimebound Resort — abandoned ski lodge (asym horror, Forsaken-like). Filming set (not a game).
// Fully procedural Three.js geometry (no Blender / GLTF assets).
import * as THREE from 'three';
import { Batch, rng } from '../lib/blocks.js';
import { createSky } from '../lib/sky.js';
import { LODGE, SHED, GENERATORS, LOCKERS, LIFT_X, LIFT_Z, ANCHORS, SIGN, groundHeight } from './layout.js';
import { SHOTS } from './shots.js';

const C = (h) => new THREE.Color(h);

// ---------------- procedural geometry ----------------
function buildResort() {
  const R = rng(1337), root = new THREE.Group(); root.name = 'rimebound-resort';
  const B = new Batch(), E = new Batch(), BOXES = [];
  const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.9, flatShading: true, ...o });
  const em = (name, color, k) => { const m = new THREE.MeshStandardMaterial({ color: '#111', emissive: color, emissiveIntensity: k, roughness: 0.6 }); m.name = name; return m; };
  const M = {
    snow: std('#c9d6e6'), rime: std('#9fb4c8'), wood: std('#3b2a20'), plank: std('#4e3a2c'), dark: std('#1a1d24'),
    iron: std('#2b3038', { metalness: 0.6, roughness: 0.5 }), roof: std('#2a3442'), stone: std('#4a4f58'),
    ice: std('#a9d8f0', { transparent: true, opacity: 0.8, roughness: 0.05 }), locker: std('#3c5560', { metalness: 0.5, roughness: 0.6 }),
    rust: std('#5a3a26', { metalness: 0.4 }),
  };
  const neon = em('neon_dead', '#ff2a1a', 2.2), ember = em('ember', '#ff6a1a', 3), win = em('window_warm', '#ffa050', 1.4), gen = em('gen', '#ffb84a', 1.6);
  const emissive = [neon, ember, win, gen].map((m) => ({ m, base: m.emissiveIntensity, name: m.name }));
  const SPH = new THREE.IcosahedronGeometry(0.5, 1), CYL = new THREE.CylinderGeometry(0.5, 0.5, 1, 8), ICI = new THREE.ConeGeometry(0.08, 1, 5).rotateX(Math.PI);
  const solid = (mat, x, y, z, sx, sy, sz, rot) => { B.box(mat, x, y, z, sx, sy, sz, 0xffffff, rot); BOXES.push([x - sx / 2, y - sy / 2, z - sz / 2, x + sx / 2, y + sy / 2, z + sz / 2]); };

  // terrain: flat base + slope to the north, as a displaced plane
  const tg = new THREE.PlaneGeometry(240, 260, 80, 90).rotateX(-Math.PI / 2); tg.translate(0, 0, -40);
  const tp = tg.attributes.position;
  for (let i = 0; i < tp.count; i++) { const x = tp.getX(i), z = tp.getZ(i); tp.setY(i, groundHeight(x, z) - 0.02 + (Math.abs(x) > 60 ? (Math.abs(x) - 60) * 0.25 : 0)); }
  tg.computeVertexNormals(); const terrain = new THREE.Mesh(tg, M.snow); terrain.receiveShadow = true; root.add(terrain);

  // ---- A-frame lodge ----
  const L = LODGE, W = 0.4, cx = (L.x0 + L.x1) / 2, cz = (L.z0 + L.z1) / 2, D = L.z1 - L.z0;
  B.box(M.stone, cx, 0.1, cz, L.x1 - L.x0, 0.2, D);                 // floor
  // side walls (low) + back wall with back door gap at x 7
  solid(M.wood, L.x0, L.wallH / 2, cz, W, L.wallH, D); solid(M.wood, L.x1, L.wallH / 2, cz, W, L.wallH, D);
  solid(M.wood, (L.x0 + 6) / 2, L.wallH / 2, L.z0, 6 - L.x0, L.wallH, W); solid(M.wood, (8 + L.x1) / 2, L.wallH / 2, L.z0, L.x1 - 8, L.wallH, W);
  // front wall with 2.4 door gap at x 0
  solid(M.wood, (L.x0 - 1.2) / 2, L.wallH / 2, L.z1, -1.2 - L.x0, L.wallH, W); solid(M.wood, (1.2 + L.x1) / 2, L.wallH / 2, L.z1, L.x1 - 1.2, L.wallH, W);
  B.box(M.wood, 0, L.wallH - 0.4, L.z1, 2.4, 0.8, W);
  // A-frame roof: two slabs meeting at ridge, overhanging front/back; gable triangles of stacked planks
  const half = (L.x1 - L.x0) / 2 + 1.2, rise = L.ridge - L.wallH + 0.6, len = Math.hypot(half, rise), ang = Math.atan2(rise, half);
  for (const s of [-1, 1]) B.box(M.roof, s * half / 2, L.wallH - 0.3 + rise / 2, cz, len, 0.35, D + 3, 0xffffff, [0, 0, -s * ang]);
  for (const z of [L.z0, L.z1]) for (let y = L.wallH; y < L.ridge; y += 0.5) { const w = 2 * half * (1 - (y - L.wallH + 0.6) / rise); if (w > 0.3) B.box(M.plank, 0, y + 0.25, z, w, 0.45, 0.3); }
  // big gable window (warm glow) + boarded windows
  E.box(win, 0, 7.2, L.z1 + 0.2, 3.2, 2.4, 0.08);
  for (const [x, y, z, ry] of [[-6, 2.2, L.z1, 0], [6, 2.2, L.z1, 0], [L.x0, 2.2, -9, Math.PI / 2], [L.x0, 2.2, -15, Math.PI / 2], [L.x1, 2.2, -8, Math.PI / 2]]) {
    const n = ry ? [W / 2 + 0.06, 0] : [0, W / 2 + 0.06], sx = x < 0 && ry ? -1 : 1;
    E.box(win, x + n[0] * sx * (ry ? 1 : 0), y, z + n[1], ry ? 0.04 : 2, 1.4, ry ? 2 : 0.04, 0xffffff, [0, ry, 0]);
    for (let k = 0; k < 3; k++) B.box(M.plank, x + (ry ? sx * 0.32 : 0), y - 0.45 + k * 0.45, z + (ry ? 0 : 0.32), 2.5, 0.22, 0.08, 0xffffff, [0, ry, (R() - 0.5) * 0.5]);
  }
  // porch + steps + rails + icicles
  B.box(M.plank, 0, 0.35, L.z1 + 2, 10, 0.2, 4);
  for (const x of [-5, 5]) { B.box(M.wood, x, 1.6, L.z1 + 3.8, 0.25, 3.2, 0.25); BOXES.push([x - 0.2, 0, L.z1 + 3.6, x + 0.2, 3.2, L.z1 + 4]); }
  B.box(M.wood, 0, 3.2, L.z1 + 3.8, 10.4, 0.25, 0.3);
  for (let i = 0; i < 26; i++) { const x = -L.x1 - 1 + i * ((2 * L.x1 + 2) / 25), h = 0.3 + R() * 1.1;
    B.add(M.ice, ICI, x, L.wallH - 0.5 - h / 2, L.z1 + 1.6, 1, h, 1); }
  // interior: fireplace + chimney, couches, broken chandelier, lockers
  solid(M.stone, ANCHORS.fireplace.x, 1.4, L.z0 + 0.8, 3.2, 2.8, 1.2); B.box(M.stone, ANCHORS.fireplace.x, 7, L.z0 + 0.4, 1.4, 9, 1.2);
  B.box(M.dark, ANCHORS.fireplace.x, 0.8, L.z0 + 1.42, 1.8, 1.2, 0.05);
  for (let i = 0; i < 6; i++) E.add(ember, SPH, ANCHORS.fireplace.x + (R() - 0.5) * 1.2, 0.35, L.z0 + 1.5 + R() * 0.2, 0.3, 0.2, 0.3);
  solid(M.rust, -5, 0.45, -13, 3.2, 0.9, 1.1); solid(M.rust, 1, 0.45, -14, 1.1, 0.9, 2.6, [0, 0.4, 0]);
  B.box(M.plank, 3, 0.4, -10, 2, 0.1, 1.2, 0xffffff, [0.2, 0.3, 0.15]);                      // toppled table
  B.box(M.iron, 0, 6.8, -12, 0.05, 4, 0.05); B.add(M.iron, new THREE.TorusGeometry(1, 0.06, 5, 12).rotateX(Math.PI / 2), 0, 4.8, -12, 1, 1, 1, 0xffffff, [0.3, 0, 0.15]);
  for (const [x, z] of LOCKERS) { solid(M.locker, x, 1, z, 0.6, 2, 1.6); B.box(M.dark, x - 0.31, 1.5, z, 0.02, 0.2, 1.4); }

  // ---- dead neon OPEN sign on two poles ----
  for (const dx of [-2.2, 2.2]) solid(M.iron, SIGN.x + dx, 2.4, SIGN.z, 0.2, 4.8, 0.2);
  B.box(M.dark, SIGN.x, 4.6, SIGN.z, 5, 1.6, 0.25);
  const FONT = { O: ['111', '101', '101', '101', '111'], P: ['111', '101', '111', '100', '100'], E: ['111', '100', '110', '100', '111'], N: ['101', '111', '111', '111', '101'] };
  'OPEN'.split('').forEach((ch, i) => FONT[ch].forEach((row, r) => [...row].forEach((v, c) => {
    if (v === '1' && !(i === 3 && r < 2 && c === 2)) E.box(neon, SIGN.x - 1.75 + i * 1.15 + c * 0.24, 5.08 - r * 0.24, SIGN.z + 0.16, 0.2, 0.2, 0.05);   // last N half-dead
  })));
  B.box(M.dark, SIGN.x + 1.6, 4.0, SIGN.z + 0.2, 0.8, 0.5, 0.05, 0xffffff, [0, 0, 0.6]);   // broken panel

  // ---- ski shed + racks ----
  const S = SHED, scx = (S.x0 + S.x1) / 2, scz = (S.z0 + S.z1) / 2;
  solid(M.plank, S.x1, S.h / 2, scz, W, S.h, S.z1 - S.z0); solid(M.plank, scx, S.h / 2, S.z0, S.x1 - S.x0, S.h, W); solid(M.plank, scx, S.h / 2, S.z1, S.x1 - S.x0, S.h, W);
  B.box(M.roof, scx, S.h + 0.3, scz, S.x1 - S.x0 + 1.4, 0.25, S.z1 - S.z0 + 1.4, 0xffffff, [0.08, 0, 0]);
  for (let r = 0; r < 3; r++) { const x = S.x0 - 2 - r * 2.2; solid(M.iron, x, 0.9, scz, 0.2, 1.8, 7);
    for (let k = 0; k < 9; k++) if (R() > 0.25) B.box(R() > 0.5 ? M.rust : M.locker, x + 0.25, 1, S.z0 + 1 + k * 0.8, 0.06, 1.9, 0.12, 0xffffff, [0, 0, -0.2 - R() * 0.15]); }
  for (let k = 0; k < 6; k++) B.box(M.wood, scx + (R() - 0.5) * 6, 0.05, scz + (R() - 0.5) * 6, 0.12, 0.05, 1.8, 0xffffff, [0, R() * 3, 0]);

  // ---- chairlift: pylons, cable, swinging-dead chairs ----
  const tops = LIFT_Z.map((z) => new THREE.Vector3(LIFT_X, groundHeight(LIFT_X, z) + 8, z));
  LIFT_Z.forEach((z, i) => { const y0 = groundHeight(LIFT_X, z);
    solid(M.iron, LIFT_X, y0 + 4, z, 0.6, 8, 0.6); B.box(M.iron, LIFT_X, y0 + 8, z, 5, 0.35, 0.4);
    for (const s of [-2.2, 2.2]) B.add(M.iron, CYL, LIFT_X + s, y0 + 7.75, z, 0.5, 0.18, 0.5, 0xffffff, [Math.PI / 2, 0, 0]);
    if (i < LIFT_Z.length - 1) for (const s of [-2.2, 2.2]) {
      const a = tops[i].clone().setX(LIFT_X + s), b = tops[i + 1].clone().setX(LIFT_X + s), d = b.clone().sub(a), mid = a.clone().add(b).multiplyScalar(0.5);
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, d.length(), 4), M.dark); m.position.copy(mid).y -= 0.25;
      m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); root.add(m);
      for (let c = 1; c < 3; c++) { const p = a.clone().lerp(b, c / 3).add(new THREE.Vector3(0, -0.3, 0));
        B.box(M.iron, p.x, p.y - 1, p.z, 0.05, 2, 0.05); B.box(M.rust, p.x, p.y - 2, p.z, 1.4, 0.12, 0.6, 0xffffff, [0, 0, (R() - 0.5) * 0.3]); B.box(M.rust, p.x, p.y - 1.6, p.z - 0.3, 1.4, 0.7, 0.08); }
    } });
  B.box(M.wood, LIFT_X, 1.6, 18, 6, 3.2, 4);                                                    // bottom station hut
  BOXES.push([LIFT_X - 3, 0, 16, LIFT_X + 3, 3.2, 20]); B.box(M.roof, LIFT_X, 3.4, 18, 7, 0.3, 5);

  // ---- generators + fuel drums ----
  for (const [x, z] of GENERATORS) { const y0 = groundHeight(x, z);
    solid(M.rust, x, y0 + 0.6, z, 1.8, 1.2, 1.1); B.box(M.dark, x, y0 + 1.3, z, 1.4, 0.2, 0.7); B.add(M.iron, CYL, x + 0.6, y0 + 1.6, z, 0.18, 0.8, 0.18);
    E.box(gen, x - 0.5, y0 + 0.8, z + 0.56, 0.18, 0.18, 0.04);
    for (let k = 0; k < 2; k++) { const dx = x - 1.5 - k * 0.7, dz = z + (R() - 0.5); B.add(M.locker, CYL, dx, y0 + 0.5, dz, 0.6, 1, 0.6); BOXES.push([dx - 0.3, y0, dz - 0.3, dx + 0.3, y0 + 1, dz + 0.3]); } }

  // ---- snow drifts, dead pines, broken fence ----
  for (let i = 0; i < 70; i++) { const x = (R() - 0.5) * 110, z = 40 - R() * 140;
    if (x > L.x0 - 2 && x < L.x1 + 2 && z > L.z0 - 2 && z < L.z1 + 6) continue;
    const s = 1 + R() * 3; B.add(R() > 0.3 ? M.snow : M.rime, SPH, x, groundHeight(x, z) - s * 0.12, z, s * 2, s * 0.5, s * 1.3, 0xffffff, [0, R() * 3, 0]); }
  for (let i = 0; i < 46; i++) { const x = (R() > 0.5 ? 1 : -1) * (46 + R() * 20), z = 40 - R() * 150, y0 = groundHeight(x, z), h = 6 + R() * 7;
    B.add(M.dark, CYL, x, y0 + h / 2, z, 0.35, h, 0.35);
    for (let k = 0; k < 4; k++) B.box(M.dark, x, y0 + h * (0.4 + k * 0.14), z, 2.4 - k * 0.5, 0.08, 0.08, 0xffffff, [0, R() * 3, 0.2 - R() * 0.4]); }
  for (let i = 0; i < 18; i++) { if (R() < 0.25) continue; const x = -30 + i * 3.4; B.box(M.wood, x, 0.6, 26, 0.15, 1.2, 0.15, 0xffffff, [0, 0, (R() - 0.5) * 0.4]); B.box(M.wood, x + 1.7, 0.8, 26, 3.4, 0.1, 0.06); }

  B.build(root); E.build(root, { cast: false, receive: false });
  root.traverse((o) => { if (o.isMesh && o !== terrain) { o.castShadow = o.castShadow ?? true; } });
  return { root, emissive, BOXES };
}

export default {
  id: 'rimebound-resort',
  name: 'Rimebound Resort',
  async create({ renderer }) {
    const scene = new THREE.Scene();

    const { root, emissive, BOXES } = buildResort();
    scene.add(root);

    // ---------------- sky, fog, lights: cold blue outside, dim warm inside ----------------
    const sky = createSky(); scene.add(sky.mesh);
    sky.uniforms.uAurora.value = 0.0;
    sky.uniforms.uNightTop.value.set('#02040a'); sky.uniforms.uNightHorizon.value.set('#0e1a2c');
    scene.fog = new THREE.FogExp2('#0b1422', 0.02);
    const hemi = new THREE.HemisphereLight('#3a5478', '#07090f', 0.5); scene.add(hemi);
    const key = new THREE.DirectionalLight('#8fa8d8', 0.7);
    key.castShadow = true; key.shadow.mapSize.set(2048, 2048);
    Object.assign(key.shadow.camera, { left: -70, right: 70, top: 70, bottom: -70, near: 10, far: 900 });
    key.shadow.bias = -0.0004; key.shadow.normalBias = 0.05;
    key.target.position.set(0, 0, -10); scene.add(key, key.target);
    const MOON_DIR = sky.uniforms.uMoonDir.value, SUN_DIR = sky.uniforms.uSunDir.value;

    const WARM = '#ff8a3a';
    const fire = new THREE.PointLight(WARM, 40, 16, 1.6); fire.position.set(ANCHORS.fireplace.x, 1.2, ANCHORS.fireplace.z); scene.add(fire);
    const room = new THREE.PointLight('#ffb070', 12, 18, 1.8); room.position.set(4, 3.2, -10); scene.add(room);
    const porch = new THREE.PointLight('#ffd0a0', 10, 10, 1.8); porch.position.set(0, 3.6, LODGE.z1 + 2.5); scene.add(porch);
    const neon = new THREE.PointLight('#ff2a1a', 6, 8, 2); neon.position.set(SIGN.x, 4.6, SIGN.z + 1); scene.add(neon);
    const shedL = new THREE.PointLight('#9fc4ff', 6, 10, 2); shedL.position.set((SHED.x0 + SHED.x1) / 2, 2.8, 3); scene.add(shedL);
    const genLights = GENERATORS.map(([x, z]) => { const l = new THREE.PointLight('#ffb84a', 5, 7, 2); l.position.set(x, groundHeight(x, z) + 1.8, z); scene.add(l); return l; });

    // ---------------- low ground haze (cheap camera-free sprite layer) ----------------
    const haze = (() => {
      const n = 220, g = new THREE.BufferGeometry(), p = new Float32Array(n * 3), s = new Float32Array(n);
      let seed = 7; const R = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
      for (let i = 0; i < n; i++) { const x = (R() - 0.5) * 110, z = 40 - R() * 140; p.set([x, groundHeight(x, z) + 0.6 + R() * 1.5, z], i * 3); s[i] = R(); }
      g.setAttribute('position', new THREE.BufferAttribute(p, 3)); g.setAttribute('aPhase', new THREE.BufferAttribute(s, 1));
      const mat = new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, fog: false,
        uniforms: { uTime: { value: 0 }, uA: { value: 0.12 }, uCol: { value: C('#6f86a8') } },
        vertexShader: `attribute float aPhase; uniform float uTime; varying float vP;
          void main(){ vec3 p = position; p.x += sin(uTime * 0.05 + aPhase * 30.0) * 4.0; p.z += cos(uTime * 0.04 + aPhase * 20.0) * 3.0;
            vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv; vP = aPhase;
            gl_PointSize = clamp(2600.0 / -mv.z, 2.0, 420.0); }`,
        fragmentShader: `uniform float uA; uniform vec3 uCol; varying float vP;
          void main(){ float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.0, d) * uA * (0.5 + vP); if (a < 0.003) discard; gl_FragColor = vec4(uCol, a); }`,
      });
      const pts = new THREE.Points(g, mat); pts.frustumCulled = false; pts.renderOrder = 3; scene.add(pts);
      return mat;
    })();

    // ---------------- day / night + weather ----------------
    const look = { night: 1, weather: 0.35, storm: 0 };
    const NIGHT = { fog: C('#0b1422'), hemiSky: C('#3a5478'), hemiGround: C('#07090f'), hemiI: 0.5, key: C('#8fa8d8'), keyI: 0.7, exposure: 1.0 };
    const DAY = { fog: C('#8d9aab'), hemiSky: C('#a9b6c6'), hemiGround: C('#3c4450'), hemiI: 0.9, key: C('#d8dde6'), keyI: 1.2, exposure: 0.9 };  // overcast, still bleak
    const STORM = { night: C('#2c3a50'), day: C('#a6b0bd') };
    const tmp = new THREE.Color();
    function applyLook() {
      const n = look.night, w = look.weather, storm = THREE.MathUtils.smoothstep(w, 0.55, 1.0); look.storm = storm;
      scene.fog.color.copy(tmp.copy(DAY.fog).lerp(NIGHT.fog, n)).lerp(STORM.day.clone().lerp(STORM.night, n), storm);
      scene.fog.density = THREE.MathUtils.lerp(0.012, 0.02, n) + storm * storm * 0.03 + w * 0.004;
      sky.uniforms.uNight.value = n; sky.uniforms.uStorm.value = Math.max(0.35, storm * 0.95); sky.uniforms.uStormColor.value.copy(scene.fog.color);
      hemi.color.copy(DAY.hemiSky).lerp(NIGHT.hemiSky, n); hemi.groundColor.copy(DAY.hemiGround).lerp(NIGHT.hemiGround, n);
      hemi.intensity = THREE.MathUtils.lerp(DAY.hemiI, NIGHT.hemiI, n);
      key.color.copy(DAY.key).lerp(NIGHT.key, n); key.intensity = THREE.MathUtils.lerp(DAY.keyI, NIGHT.keyI, n) * (1 - storm * 0.6);
      key.position.copy(key.target.position).addScaledVector(SUN_DIR.clone().lerp(MOON_DIR, n).normalize(), 400);
      renderer.toneMappingExposure = THREE.MathUtils.lerp(DAY.exposure, NIGHT.exposure, n);
      haze.uniforms.uCol.value.copy(scene.fog.color).multiplyScalar(1.6); haze.uniforms.uA.value = 0.08 + 0.08 * n + storm * 0.1;
    }
    applyLook();

    return {
      scene,
      shots: SHOTS,
      spawn: { pos: [ANCHORS.spawn.x, groundHeight(ANCHORS.spawn.x, ANCHORS.spawn.z) + 0.1, ANCHORS.spawn.z], facing: ANCHORS.spawn.facing },
      walkBounds: { type: 'box', minX: -58, maxX: 58, minZ: -120, maxZ: 58 },
      groundHeight,
      layout: { LODGE, SHED, GENERATORS, LOCKERS, LIFT_X, LIFT_Z, ANCHORS },
      addColliders(col) { BOXES.forEach((b) => col.addBox(...b)); },
      setNight(v) { if (v !== look.night) { look.night = v; applyLook(); } },
      setWeather(v) { if (v !== look.weather) { look.weather = v; applyLook(); } },
      wind: (w) => ({ speed: 1.5 + w * 9, wind: [0.6 + w * w * 14, 0.2 + w * 3] }),
      avatarColors: { skin: '#e2c2a4', shirt: '#3d4a5c', pants: '#1a1f28' },
      bloom: (n, w) => ({ strength: THREE.MathUtils.lerp(0.2, 0.55, n) * (1 - 0.3 * w), radius: 0.5, threshold: THREE.MathUtils.lerp(1.4, 0.85, n) }),
      update(dt, t) {
        sky.uniforms.uTime.value = t; haze.uniforms.uTime.value = t;
        // fire flicker, sick neon buzz, sputtering generators
        const fl = 0.75 + 0.25 * Math.sin(t * 9.1) * Math.sin(t * 5.3 + 1) + 0.08 * Math.sin(t * 23.0);
        fire.intensity = 40 * fl * (0.4 + 0.6 * look.night);
        const buzz = (Math.sin(t * 1.7) > 0.55 && Math.sin(t * 37.0) > -0.2) ? 1 : 0.08;
        neon.intensity = 6 * buzz * look.night;
        genLights.forEach((l, i) => { l.intensity = 5 * look.night * (Math.sin(t * (2.1 + i * 0.7) + i) > -0.6 ? 1 : 0.15); });
        for (const e of emissive) {
          if (e.name === 'neon_dead') e.m.emissiveIntensity = e.base * (0.15 + 0.85 * buzz);
          else if (e.name === 'ember') e.m.emissiveIntensity = e.base * fl;
          else if (e.name === 'window_warm') e.m.emissiveIntensity = e.base * (0.25 + 0.75 * look.night) * (0.92 + 0.08 * fl);
        }
      },
    };
  },
};
