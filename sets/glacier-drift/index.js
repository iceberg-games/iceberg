// Glacier Drift: night powder glacier race with power-up pedestals. Filming set (not a game).
// Procedural Three.js only (Iceberg original, no external assets).
import * as THREE from 'three';
import { Batch, glowMaterial, rng } from '../lib/blocks.js';
import { createSky } from '../lib/sky.js';
import * as L from './layout.js';
import { SHOTS } from './shots.js';

const C = (hex) => new THREE.Color(hex);
const hdr = (hex, k) => { const c = new THREE.Color(hex).multiplyScalar(k); return [c.r, c.g, c.b]; };
const WARM = '#ffb35c', GATE = '#7fe9ff';
const KIND_COL = { boost: '#2ef2ff', shield: '#ffcc33', magnet: '#b46bff', freeze: '#9fd8ff' };
const { TRACK, centerX, groundHeight, headingAt } = L;

function radialTex() {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c);
}
function groundGeometry() {
  const b = L.bounds, W = b.maxX - b.minX, D = b.maxZ - b.minZ;
  const g = new THREE.PlaneGeometry(W, D, 140, 380).rotateX(-Math.PI / 2); g.translate((b.maxX + b.minX) / 2, 0, (b.maxZ + b.minZ) / 2);
  const p = g.attributes.position, col = [], snow = C('#f1f7ff'), blue = C('#b9d4ee'), ice = C('#8fd0f2'), carved = C('#dbe9f8');
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i), y = groundHeight(x, z); p.setY(i, y);
    const d = Math.abs(x - centerX(z));
    let c;
    if (d < TRACK.halfWidth - 0.5) c = carved.clone().lerp(ice, (Math.sin(z * 0.7 + x * 0.3) * 0.5 + 0.5) * 0.25);
    else if (d > 30 && Math.sin(x * 0.11 + z * 0.05) * Math.cos(z * 0.09) > 0.55) c = ice.clone();
    else c = snow.clone().lerp(blue, Math.min(1, d / 140));
    col.push(c.r, c.g, c.b);
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.computeVertexNormals(); return g;
}

export default {
  id: 'glacier-drift',
  name: 'Glacier Drift',
  hooks: L.HOOKS,
  ...L.HOOKS,
  async create({ renderer } = {}) {
    const R = rng(4242);
    const scene = new THREE.Scene();
    const B = new Batch(), G = new Batch(), P = new Batch();
    const circles = [], banners = [], lights = [], pedestals = [];
    const look = { night: 1, weather: 0.3, storm: 0 };
    const M = {
      ground: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 }),
      snow: new THREE.MeshStandardMaterial({ color: '#f5faff', roughness: 0.95, flatShading: true }),
      ice: new THREE.MeshStandardMaterial({ color: '#bfe6ff', roughness: 0.15, metalness: 0.05, flatShading: true, emissive: '#1d5f8a', emissiveIntensity: 0.25 }),
      wood: new THREE.MeshStandardMaterial({ color: '#6a4528', roughness: 0.85 }),
      darkWood: new THREE.MeshStandardMaterial({ color: '#3f2716', roughness: 0.9 }),
      iron: new THREE.MeshStandardMaterial({ color: '#2a3140', roughness: 0.45, metalness: 0.7 }),
      rock: new THREE.MeshStandardMaterial({ color: '#4e5a73', roughness: 0.9, flatShading: true }),
      pine: new THREE.MeshStandardMaterial({ color: '#1d3833', roughness: 0.9, flatShading: true }),
      cloth: new THREE.MeshStandardMaterial({ roughness: 0.8, side: THREE.DoubleSide }),
    };
    const glow = glowMaterial(), glowGate = glowMaterial(), glowPU = glowMaterial();
    const poolMat = new THREE.MeshBasicMaterial({ map: radialTex(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -2 });
    poolMat.userData.noShadow = true;
    const POOL = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    const pool = (x, z, r, hex, k) => P.add(poolMat, POOL, x, groundHeight(x, z) + 0.06, z, r * 2, 1, r * 2, hdr(hex, k));
    const CYL = new THREE.CylinderGeometry(0.5, 0.5, 1, 10), SPH = new THREE.IcosahedronGeometry(0.5, 1), CONE = new THREE.ConeGeometry(0.5, 1, 7);
    const OCTA = new THREE.OctahedronGeometry(0.5, 0), TOR = new THREE.TorusGeometry(0.5, 0.06, 6, 40);

    // ---------- sky, fog, lights ----------
    const sky = createSky(); scene.add(sky.mesh); sky.uniforms.uAurora.value = 0.85;
    scene.fog = new THREE.FogExp2('#0d1c33', 0.006);
    const hemi = new THREE.HemisphereLight('#4a6aa8', '#0a1424', 0.8); scene.add(hemi);
    const key = new THREE.DirectionalLight('#a8c0ff', 1.1);
    key.castShadow = true; key.shadow.mapSize.set(2048, 2048);
    Object.assign(key.shadow.camera, { left: -120, right: 120, top: 120, bottom: -120, near: 10, far: 1400 });
    key.shadow.bias = -0.0004; key.shadow.normalBias = 0.06; scene.add(key, key.target);
    key.target.position.set(0, 70, -300);
    const MOON_DIR = sky.uniforms.uMoonDir.value, SUN_DIR = sky.uniforms.uSunDir.value;
    const ground = new THREE.Mesh(groundGeometry(), M.ground); ground.receiveShadow = true; scene.add(ground);

    function banner(x, y, z, hex, w, h, yaw = 0) {
      const geo = new THREE.PlaneGeometry(w, h, 10, 2); geo.translate(-w / 2, 0, 0);
      const mat = M.cloth.clone(); mat.color.set(hex); mat.emissive = new THREE.Color(hex); mat.emissiveIntensity = 0.4;
      const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.y = yaw; m.castShadow = true; scene.add(m);
      banners.push({ m, base: geo.attributes.position.array.slice(), ph: R() * 6, w, span: false });
      return m;
    }
    const lightAt = (hex, k, dist, x, y, z) => { const l = new THREE.PointLight(hex, k, dist, 1.6); l.position.set(x, y, z); scene.add(l); lights.push([l, k]); return l; };

    // ---------- lodge at the top ----------
    {
      const { x: lx, z: lz, w, d, deckY } = L.LODGE;
      B.box(M.darkWood, lx, deckY - 0.3, lz - 12, w + 10, 0.6, 14); // start deck
      for (let i = -6; i <= 6; i++) B.box(M.wood, lx + i * 2.2, deckY + 0.02, lz - 12, 2.0, 0.1, 13.6);
      B.box(M.wood, lx, deckY + 3, lz, w, 6, d);
      for (let k = 0; k < 7; k++) B.box(M.darkWood, lx, deckY + 0.4 + k * 0.85, lz - d / 2 - 0.05, w + 0.2, 0.2, 0.2);
      for (const s of [-1, 1]) { B.box(M.darkWood, lx + s * (w / 4 + 0.2), deckY + 8.2, lz, w / 2 + 2.2, 0.5, d + 2.5, '#ffffff', [0, 0, s * -0.5]);
        B.box(M.snow, lx + s * (w / 4 + 0.1), deckY + 8.55, lz, w / 2 + 2.0, 0.35, d + 2.3, '#ffffff', [0, 0, s * -0.5]); }
      B.box(M.rock, lx + 7, deckY + 9, lz + 2, 2, 7, 2); G.box(glow, lx + 7, deckY + 12.6, lz + 2, 1.2, 0.3, 1.2, hdr(WARM, 2));
      for (let i = 0; i < 6; i++) { const wx = lx - w / 2 + 2.5 + i * ((w - 5) / 5); G.box(glow, wx, deckY + 3.2, lz - d / 2 - 0.08, 1.6, 2.0, 0.05, hdr(WARM, 3.2)); B.box(M.darkWood, wx, deckY + 3.2, lz - d / 2 - 0.12, 0.12, 2.1, 0.05); }
      G.box(glow, lx, deckY + 6.0, lz - d / 2 - 0.1, 8, 0.8, 0.05, hdr(GATE, 3)); // GLACIER DRIFT sign bar
      pool(lx, lz - 10, 14, WARM, 0.35); lightAt(WARM, 60, 30, lx, deckY + 4, lz - 10);
      for (let x = -w / 2; x <= w / 2; x += 1.5) circles.push([lx + x, lz - d / 2, 0.8, deckY + 6], [lx + x, lz + d / 2, 0.8, deckY + 6]);
      // start gates
      for (const s of L.spawns.racer.slice(0, 4)) { const [x, y, z] = s.pos;
        B.box(M.iron, x - 1.6, y + 1, z - 1.2, 0.15, 2, 0.15); B.box(M.iron, x + 1.6, y + 1, z - 1.2, 0.15, 2, 0.15);
        G.box(glowGate, x, y + 2, z - 1.2, 3.3, 0.12, 0.12, hdr(GATE, 3)); G.box(glowGate, x, y + 0.05, z - 1.2, 3, 0.04, 0.2, hdr('#ff5a6a', 2)); }
      // start arch
      archGate(0, Math.PI, '#ff5a6a', 1.25);
    }

    // ---------- gate arches (checkpoints) ----------
    function archGate(z, yaw, hex = GATE, scale = 1) {
      const cx = centerX(z), y = groundHeight(cx, z), hw = (TRACK.halfWidth + 1.5) * scale, H = 8 * scale;
      const ax = Math.cos(yaw - Math.PI) , az = -Math.sin(yaw - Math.PI); // lateral axis (perp to heading)
      for (const s of [-1, 1]) { const px = cx + ax * hw * s, pz = z + az * hw * s, py = groundHeight(px, pz);
        for (let k = 0; k < Math.ceil((H + y - py) / 1.2); k++) B.box(M.ice, px, py + k * 1.2 + 0.6, pz, 1.2, 1.15, 1.2, C('#ffffff').lerp(C('#a8dcff'), R() * 0.5), [0, yaw, 0]);
        G.box(glowGate, px, py + (H + y - py) / 2, pz, 0.2, H + y - py, 1.3, hdr(hex, 1.6), [0, yaw, 0]); circles.push([px, pz, 0.9, y + H]); }
      const n = 15; for (let k = 0; k <= n; k++) { const a = Math.PI * k / n, r = hw;
        const px = cx + ax * Math.cos(a) * r, pz = z + az * Math.cos(a) * r, py = y + H + Math.sin(a) * 2.6 * scale;
        B.box(M.ice, px, py, pz, 1.3, 0.9, 1.3, '#dff2ff', [0, yaw, 0]); G.box(glowGate, px, py - 0.5, pz, 1.0, 0.1, 0.4, hdr(hex, 3), [0, yaw, 0]); }
      banner(cx + ax * hw * 0.9, y + H - 0.8, z + az * hw * 0.9, hex, hw * 1.8, 1.4, yaw + Math.PI / 2).userData.span = true;
      pool(cx, z, hw, hex, 0.35); lightAt(hex, 25, 26, cx, y + H - 1, z);
    }
    L.checkpoints.forEach((c) => archGate(c.pos[2], c.facing));
    // finish chute: big arch, banners, fence rails, checker strip
    {
      const { pos: [fx, fy, fz] } = L.finish;
      archGate(fz, Math.PI, '#ffd25a', 1.35);
      for (let k = 0; k < 10; k++) for (let j = 0; j < 2; j++) G.box(glowGate, fx - 9 + k * 2 + j * 1, fy + 0.04, fz + (j ? 0.5 : -0.5), 1, 0.03, 1, hdr((k + j) % 2 ? '#ffffff' : '#111111', (k + j) % 2 ? 2.2 : 0.02));
      for (let z = fz + 60; z > fz - 40; z -= 6) for (const s of [-1, 1]) { const x = centerX(z) + s * (TRACK.halfWidth + 0.6), y = groundHeight(x, z);
        B.box(M.wood, x, y + 0.6, z, 0.2, 1.2, 0.2); B.box(M.wood, x, y + 1.1, z - 3, 0.1, 0.12, 6);
        if (Math.round(z) % 12 === 0) { B.box(M.iron, x, y + 2.4, z, 0.1, 4.8, 0.1); banner(x, y + 4, z, ['#ff5a6a', '#2ef2ff', '#ffcc33', '#b46bff'][((z / 12) | 0) & 3 ^ (s > 0)], 1.2, 2.2, s > 0 ? Math.PI : 0); } }
      for (let i = 0; i < 30; i++) { const s = i % 2 ? 1 : -1, z = fz + 4 - i * 1.2, x = centerX(z) + s * (TRACK.halfWidth + 3 + R() * 3); // spectator snow-crowd blobs
        B.add(M.snow, SPH, x, groundHeight(x, z) + 0.6, z, 1.1, 1.4, 1.1); B.add(M.cloth, SPH, x, groundHeight(x, z) + 1.5, z, 0.7, 0.7, 0.7); }
    }

    // ---------- power-up plinths ----------
    for (const p of L.powerups) {
      const [x, y, z] = p.pos, hex = KIND_COL[p.kind];
      B.add(M.ice, CYL, x, y - 0.05, z, 2.4, 0.5, 2.4, '#e2f4ff'); B.add(M.iron, CYL, x, y + 0.25, z, 2.0, 0.12, 2.0);
      G.add(glowPU, TOR, x, y + 0.34, z, 2.2, 2.2, 2.2, hdr(hex, 3), [Math.PI / 2, 0, 0]);
      const mat = glowMaterial(); mat.color.set(hex).multiplyScalar(3);
      const geo = { boost: CONE, shield: SPH, magnet: TOR, freeze: OCTA }[p.kind];
      const m = new THREE.Mesh(geo, mat); m.position.set(x, y + 1.6, z); m.scale.setScalar(p.kind === 'magnet' ? 1.4 : 0.9); scene.add(m);
      const halo = new THREE.Mesh(TOR, mat); halo.position.copy(m.position); halo.scale.setScalar(1.8); scene.add(halo);
      pedestals.push({ m, halo, mat, hex, y: y + 1.6, ph: R() * 6 });
      pool(x, z, 3, hex, 0.55);
    }
    // a few real lights in powerup alley only (budget)
    for (const p of L.powerups.filter((q) => q.t > 0.45 && q.t < 0.57)) lightAt(KIND_COL[p.kind], 18, 12, p.pos[0], p.pos[1] + 2, p.pos[2]);

    // ---------- lantern posts along rails ----------
    const lanternGlow = glowMaterial();
    for (let z = -10, i = 0; z > TRACK.finishZ + 10; z -= L.LANTERN_STEP, i++) {
      const s = i % 2 ? 1 : -1, x = centerX(z) + s * (TRACK.halfWidth + 2.2), y = groundHeight(x, z);
      B.box(M.iron, x, y + 1.5, z, 0.14, 3, 0.14); B.box(M.iron, x - s * 0.4, y + 3, z, 0.9, 0.08, 0.08); B.box(M.iron, x - s * 0.8, y + 2.95, z, 0.4, 0.1, 0.4);
      G.box(lanternGlow, x - s * 0.8, y + 2.6, z, 0.32, 0.45, 0.32, hdr(WARM, 3.4)); pool(x - s * 2, z, 3.5, WARM, 0.4); circles.push([x, z, 0.25, y + 3]);
      // rail rope segments
      for (const ss of [-1, 1]) { const rx = centerX(z) + ss * (TRACK.halfWidth + 1.2), ry = groundHeight(rx, z);
        B.box(M.wood, rx, ry + 0.5, z, 0.18, 1, 0.18); G.box(glowGate, rx, ry + 0.95, z - L.LANTERN_STEP / 2, 0.05, 0.05, L.LANTERN_STEP, hdr(GATE, 0.9), [0, Math.atan2(centerX(z - L.LANTERN_STEP) - centerX(z), -L.LANTERN_STEP) - Math.PI, 0]); }
    }

    // ---------- ice ridges, pines, snow banks, distant cliffs ----------
    for (let i = 0; i < 70; i++) { // ice ridge shards close to track
      const z = -20 - R() * 600, s = R() < 0.5 ? -1 : 1, x = centerX(z) + s * (TRACK.halfWidth + 9 + R() * 18), y = groundHeight(x, z), h = 3 + R() * 9;
      B.add(M.ice, OCTA, x, y + h * 0.35, z, 2 + R() * 4, h, 2 + R() * 4, C('#ffffff').lerp(C('#7fc8f0'), R()), [R() * 0.3, R() * 3, R() * 0.3]); circles.push([x, z, 1.5, y + h * 0.8]);
    }
    for (let i = 0; i < 700; i++) {
      const z = 50 - R() * 720, s = R() < 0.5 ? -1 : 1, x = centerX(z) + s * (TRACK.halfWidth + 6 + R() * R() * 110);
      if (z > 10 && Math.abs(x) < 20) continue;
      const y = groundHeight(x, z), k0 = 0.8 + R() * 1.6;
      B.add(M.darkWood, CYL, x, y + k0 * 0.6, z, 0.4 * k0, 1.2 * k0, 0.4 * k0);
      for (let k = 0; k < 3; k++) { B.add(M.pine, CONE, x, y + k0 * (1.6 + k * 1.1), z, k0 * (2.6 - k * 0.7), k0 * 1.8, k0 * (2.6 - k * 0.7)); B.add(M.snow, CONE, x, y + k0 * (1.95 + k * 1.1), z, k0 * (1.8 - k * 0.5), k0 * 0.7, k0 * (1.8 - k * 0.5)); }
      if (Math.abs(x - centerX(z)) < 30) circles.push([x, z, 0.5 * k0, y + 5 * k0]);
    }
    for (let z = 0; z > TRACK.finishZ; z -= 5) for (const s of [-1, 1]) { const x = centerX(z) + s * (TRACK.halfWidth + 1.8 + R()), y = groundHeight(x, z);
      B.add(M.snow, SPH, x, y + 0.2, z, 2.6 + R(), 1.0 + R() * 0.6, 4 + R()); }
    for (let i = 0; i < 60; i++) { const z = 80 - R() * 820, s = R() < 0.5 ? -1 : 1, x = s * (170 + R() * 160), base = L.trackHeight(z) + 40, h = 60 + R() * 120;
      B.add(M.rock, CONE, x, base + h * 0.3, z, 50 + R() * 50, h, 40 + R() * 40, '#ffffff', [0, R() * 3, 0]);
      B.add(M.ice, CONE, x, base + h * 0.55, z, 30 + R() * 20, h * 0.5, 26 + R() * 16, '#cfeaff', [0, R() * 3, 0]); }

    // ---------- snow sparkle drifting over the run ----------
    const spray = (() => {
      const n = 3000, g = new THREE.BufferGeometry(), p = new Float32Array(n * 3), s = new Float32Array(n);
      for (let i = 0; i < n; i++) { const z = 20 - R() * 640, x = centerX(z) + (R() - 0.5) * 50; p.set([x, groundHeight(x, z) + R() * 6, z], i * 3); s[i] = R(); }
      g.setAttribute('position', new THREE.BufferAttribute(p, 3)); g.setAttribute('aPhase', new THREE.BufferAttribute(s, 1));
      const mat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
        uniforms: { uTime: { value: 0 }, uNight: { value: 1 }, uWind: { value: 1 } },
        vertexShader: `attribute float aPhase; uniform float uTime, uWind; varying float vA;
          void main(){ float t = fract(aPhase * 7.0 + uTime * 0.05); vec3 p = position; p.y += t * 3.0 - 0.5; p.x += t * 5.0 * uWind; p.z += sin(uTime * 0.5 + aPhase * 30.0) * 0.8;
            vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv;
            vA = smoothstep(0.0, 0.15, t) * smoothstep(1.0, 0.7, t) * (0.6 + 0.4 * sin(uTime * 3.0 + aPhase * 50.0)); gl_PointSize = min(6.0, (1.2 + 2.0 * fract(aPhase * 13.0)) * 260.0 / max(0.5, -mv.z)); }`,
        fragmentShader: `uniform float uNight; varying float vA; void main(){ float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.0, d) * vA * (0.35 + 0.65 * uNight); if (a < 0.01) discard; gl_FragColor = vec4(vec3(0.75, 0.95, 1.1) * 1.5 * a, a); }` });
      const pts = new THREE.Points(g, mat); pts.frustumCulled = false; scene.add(pts); return mat;
    })();

    B.build(scene); G.build(scene, { cast: false, receive: false });
    P.build(scene, { cast: false, receive: false }).forEach((m) => { m.renderOrder = 2; });

    // ---------- day / night + weather ----------
    const NIGHT = { fog: C('#0c1a31'), hemiSky: C('#4a68a6'), hemiGround: C('#0a1424'), hemiI: 0.75, key: C('#a8c0ff'), keyI: 1.05, exposure: 1.05, glow: 1, pool: 1 };
    const DAY = { fog: C('#cfe2f4'), hemiSky: C('#dff0ff'), hemiGround: C('#8fb0c8'), hemiI: 1.25, key: C('#fff1de'), keyI: 2.6, exposure: 0.95, glow: 0.3, pool: 0 };
    const STORM = { night: C('#4f6384'), day: C('#d5e0ec') };
    const tmp = new THREE.Color();
    function applyLook() {
      const n = look.night, w = look.weather, storm = THREE.MathUtils.smoothstep(w, 0.55, 1.0); look.storm = storm;
      scene.fog.color.copy(tmp.copy(DAY.fog).lerp(NIGHT.fog, n)).lerp(STORM.day.clone().lerp(STORM.night, n), storm);
      scene.fog.density = THREE.MathUtils.lerp(0.0035, 0.006, n) + storm * storm * 0.025 + w * 0.0015;
      sky.uniforms.uNight.value = n; sky.uniforms.uStorm.value = storm * 0.95; sky.uniforms.uStormColor.value.copy(scene.fog.color);
      hemi.color.copy(DAY.hemiSky).lerp(NIGHT.hemiSky, n); hemi.groundColor.copy(DAY.hemiGround).lerp(NIGHT.hemiGround, n);
      hemi.intensity = THREE.MathUtils.lerp(DAY.hemiI, NIGHT.hemiI, n) * (1 + storm * 0.25);
      key.color.copy(DAY.key).lerp(NIGHT.key, n); key.intensity = THREE.MathUtils.lerp(DAY.keyI, NIGHT.keyI, n) * (1 - storm * 0.7);
      key.position.copy(key.target.position).addScaledVector(SUN_DIR.clone().lerp(MOON_DIR, n).normalize(), 600);
      if (renderer) renderer.toneMappingExposure = THREE.MathUtils.lerp(DAY.exposure, NIGHT.exposure, n);
      const g = THREE.MathUtils.lerp(0.5, 1, n); glowGate.color.setScalar(g); glowPU.color.setScalar(g);
      poolMat.color.setScalar(THREE.MathUtils.lerp(DAY.pool, NIGHT.pool, n));
      lights.forEach(([l, k]) => { l.intensity = k * n; }); spray.uniforms.uNight.value = n;
    }
    applyLook();

    const s0 = L.anchors.lodgeDeck;
    return {
      scene, shots: SHOTS,
      spawn: { pos: [s0.pos[0], s0.pos[1] + 0.1, s0.pos[2]], facing: s0.facing },
      walkBounds: L.walkBounds, groundHeight, hooks: L.HOOKS, ...L.HOOKS,
      addColliders(col) { circles.forEach(([x, z, r, top]) => col.addCircle(x, z, r, top)); },
      setNight(v) { if (v !== look.night) { look.night = v; applyLook(); } },
      setWeather(v) { if (v !== look.weather) { look.weather = v; applyLook(); } },
      wind: (w) => ({ speed: 2.0 + w * 10, wind: [1 + w * w * 16, 0.3 + w * 3] }),
      avatarColors: { skin: '#f1c9a5', shirt: '#2ec6ff', pants: '#24324a' },
      bloom: (n, w) => ({ strength: THREE.MathUtils.lerp(0.25, 0.75, n) * (1 - 0.3 * w), radius: 0.45, threshold: THREE.MathUtils.lerp(1.6, 0.95, n) }),
      update(dt, t) {
        sky.uniforms.uTime.value = t; spray.uniforms.uTime.value = t; spray.uniforms.uWind.value = 1 + look.weather * 2;
        const night = THREE.MathUtils.lerp(DAY.glow, NIGHT.glow, look.night);
        glow.color.setScalar(night * (0.95 + 0.05 * Math.sin(t * 3)));
        lanternGlow.color.setScalar(night * (0.9 + 0.1 * Math.sin(t * 11.0) * Math.sin(t * 6.7)));
        glowGate.color.setScalar(THREE.MathUtils.lerp(0.5, 1, look.night) * (0.85 + 0.15 * Math.sin(t * 2.0)));
        for (const p of pedestals) { const k = 0.8 + 0.2 * Math.sin(t * 3 + p.ph);
          p.m.position.y = p.y + Math.sin(t * 1.8 + p.ph) * 0.25; p.m.rotation.y = t * 1.4 + p.ph; p.m.rotation.x = Math.sin(t + p.ph) * 0.3;
          p.halo.position.y = p.m.position.y; p.halo.rotation.x = Math.PI / 2 + Math.sin(t * 0.9 + p.ph) * 0.4; p.halo.scale.setScalar(1.8 + 0.15 * Math.sin(t * 3 + p.ph));
          p.mat.color.set(p.hex).multiplyScalar(THREE.MathUtils.lerp(1.2, 3.2, look.night) * k); }
        const wind = 1 + look.weather * 2;
        for (const b of banners) { const pa = b.m.geometry.attributes.position, a = pa.array, span = b.m.userData.span;
          for (let i = 0; i < pa.count; i++) { const x = b.base[i * 3], u = span ? Math.sin(Math.PI * (-x / b.w)) : -x / b.w;
            a[i * 3 + 2] = b.base[i * 3 + 2] + Math.sin(t * 2.4 * wind + x * 2.2 + b.ph) * (span ? 0.25 : 0.18) * u * wind; }
          pa.needsUpdate = true; }
      },
    };
  },
};
