// Snowball Siege: two snow forts across a contested night courtyard. Filming set (not a game).
// Procedural Three.js only (Iceberg original, no external assets).
import * as THREE from 'three';
import { Batch, glowMaterial, rng } from '../lib/blocks.js';
import { createSky } from '../lib/sky.js';
import * as L from './layout.js';
import { SHOTS } from './shots.js';

const C = (hex) => new THREE.Color(hex);
const hdr = (hex, k) => { const c = new THREE.Color(hex).multiplyScalar(k); return [c.r, c.g, c.b]; };
const WARM = '#ffb35c', RED = '#ff4a5a', BLUE = '#4fd8ff', CRYSTAL = '#9ff6ff';
const { FORT_X, FORT, groundHeight } = L;

function radialTex() {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c);
}

function groundGeometry() {
  const W = L.COURT.halfX * 2 + 60, D = L.COURT.halfZ * 2 + 30, g = new THREE.PlaneGeometry(W, D, 160, 90).rotateX(-Math.PI / 2);
  const p = g.attributes.position, col = [], snow = C('#eef5ff'), blue = C('#c6dcf2'), ice = C('#9fd4f0');
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i), y = groundHeight(x, z); p.setY(i, y);
    const icy = Math.sin(x * 0.33 + z * 0.12) * Math.cos(z * 0.41 - x * 0.05) > 0.72 && Math.abs(x) < 22 && Math.hypot(x, z) > 5;
    const c = icy ? ice : snow.clone().lerp(blue, Math.min(1, Math.max(0, 0.5 - y)));
    col.push(c.r, c.g, c.b);
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.computeVertexNormals(); return g;
}

export default {
  id: 'snowball-siege',
  name: 'Snowball Siege',
  hooks: L.HOOKS,
  async create({ renderer }) {
    const R = rng(1717);
    const scene = new THREE.Scene();
    const B = new Batch(), G = new Batch(), P = new Batch();
    const circles = [], banners = [], lanternLights = [];
    const look = { night: 1, weather: 0.35, storm: 0 };

    const M = {
      ground: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, flatShading: false }),
      snow: new THREE.MeshStandardMaterial({ color: '#f5faff', roughness: 0.95, flatShading: true }),
      iceBlock: new THREE.MeshStandardMaterial({ color: '#cfe9fb', roughness: 0.25, metalness: 0.05, flatShading: true }),
      iceWall: new THREE.MeshStandardMaterial({ color: '#a9ddff', roughness: 0.1, transparent: true, opacity: 0.8, emissive: '#2a7fb0', emissiveIntensity: 0.3 }),
      wood: new THREE.MeshStandardMaterial({ color: '#6a4528', roughness: 0.85 }),
      darkWood: new THREE.MeshStandardMaterial({ color: '#3f2716', roughness: 0.9 }),
      iron: new THREE.MeshStandardMaterial({ color: '#2a3140', roughness: 0.45, metalness: 0.7 }),
      rock: new THREE.MeshStandardMaterial({ color: '#56627a', roughness: 0.9, flatShading: true }),
      pine: new THREE.MeshStandardMaterial({ color: '#1f3b36', roughness: 0.9, flatShading: true }),
      cloth: new THREE.MeshStandardMaterial({ vertexColors: false, roughness: 0.8, side: THREE.DoubleSide }),
    };
    M.iceWall.userData.noShadow = true;
    const glow = glowMaterial(), glowTeam = glowMaterial(), glowCrystal = glowMaterial();
    const tex = radialTex();
    const poolMat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -2 });
    poolMat.userData.noShadow = true;
    const POOL = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    const pool = (x, z, r, hex, k) => P.add(poolMat, POOL, x, groundHeight(x, z) + 0.05, z, r * 2, 1, r * 2, hdr(hex, k));
    const CYL = new THREE.CylinderGeometry(0.5, 0.5, 1, 10), SPH = new THREE.IcosahedronGeometry(0.5, 1), CONE = new THREE.ConeGeometry(0.5, 1, 7);
    const OCTA = new THREE.OctahedronGeometry(0.5, 0);

    // ---------- sky, fog, lights ----------
    const sky = createSky(); scene.add(sky.mesh); sky.uniforms.uAurora.value = 0.7;
    scene.fog = new THREE.FogExp2('#0d1c33', 0.008);
    const hemi = new THREE.HemisphereLight('#4a6aa8', '#0a1424', 0.8); scene.add(hemi);
    const key = new THREE.DirectionalLight('#a8c0ff', 1.1);
    key.castShadow = true; key.shadow.mapSize.set(2048, 2048);
    Object.assign(key.shadow.camera, { left: -55, right: 55, top: 40, bottom: -40, near: 10, far: 900 });
    key.shadow.bias = -0.0004; key.shadow.normalBias = 0.05; scene.add(key, key.target);
    const MOON_DIR = sky.uniforms.uMoonDir.value, SUN_DIR = sky.uniforms.uSunDir.value;

    // ---------- ground ----------
    const ground = new THREE.Mesh(groundGeometry(), M.ground); ground.receiveShadow = true; scene.add(ground);

    // ---------- forts ----------
    function fort(side) {
      const sx = side === 'red' ? -1 : 1, cx = sx * FORT_X, team = side === 'red' ? RED : BLUE;
      const hw = FORT.w / 2, hd = FORT.d / 2, y0 = 0.3, H = FORT.wallH;
      const inner = cx - sx * hw; // wall facing midfield
      // walls: ice blocks stacked with timber bands; gate gap in inner wall
      const wall = (x0, z0, x1, z1, gate) => {
        const len = Math.hypot(x1 - x0, z1 - z0), n = Math.round(len / 1.2), yaw = Math.atan2(z1 - z0, x1 - x0);
        for (let i = 0; i < n; i++) {
          const u = (i + 0.5) / n, x = x0 + (x1 - x0) * u, z = z0 + (z1 - z0) * u;
          if (gate && Math.abs(z) < FORT.gateW / 2) continue;
          for (let r = 0; r < 3; r++) B.box(M.iceBlock, x, y0 + r * 1.2 + 0.6, z, 1.18, 1.15, 1.3, C('#ffffff').lerp(C('#bfe0ff'), R() * 0.5), [0, -yaw, 0]);
          B.box(M.wood, x, y0 + H - 0.5, z, 1.2, 0.35, 1.45, '#ffffff', [0, -yaw, 0]);
          if (i % 2 === 0) B.box(M.iceBlock, x, y0 + H + 0.2, z, 0.9, 0.9, 1.2, '#e6f4ff', [0, -yaw, 0]); // battlements
          B.box(M.snow, x, y0 + H - 0.25, z, 1.25, 0.15, 1.5, '#ffffff', [0, -yaw, 0]);
        }
      };
      wall(inner, -hd, inner, hd, true); wall(cx + sx * hw, -hd, cx + sx * hw, hd, false);
      wall(cx - hw, -hd, cx + hw, -hd, false); wall(cx - hw, hd, cx + hw, hd, false);
      // gate arch
      for (const gz of [-1, 1]) B.box(M.darkWood, inner, y0 + 2.6, gz * (FORT.gateW / 2 + 0.2), 1.4, 5.2, 0.6);
      for (let k = 0; k < 9; k++) { const a = Math.PI * k / 8; B.box(M.iceBlock, inner, y0 + 5.0 + Math.sin(a) * 1.3, Math.cos(a) * (FORT.gateW / 2 + 0.2), 1.3, 0.7, 0.7, '#ddf0ff', [a, 0, 0]); }
      G.box(glowTeam, inner - sx * 0.7, y0 + 6.5, 0, 0.12, 0.5, 2.4, hdr(team, 3));
      // corner towers
      for (const tz of [-hd, hd]) for (const tx of [cx - hw, cx + hw]) {
        const th = FORT.towerH + (tx === inner ? 1.5 : 0);
        B.add(M.iceBlock, CYL, tx, y0 + th / 2, tz, 3.2, th, 3.2, '#d9eeff');
        for (let r = 0; r < Math.floor(th / 1.4); r++) B.add(M.wood, CYL, tx, y0 + r * 1.4 + 0.7, tz, 3.3, 0.12, 3.3);
        B.add(M.darkWood, CONE, tx, y0 + th + 1.4, tz, 4.2, 2.8, 4.2);
        B.add(M.snow, CONE, tx, y0 + th + 1.9, tz, 3.0, 1.6, 3.0);
        for (let w = 0; w < 4; w++) { const a = w * Math.PI / 2 + Math.PI / 4; G.box(glow, tx + Math.cos(a) * 1.62, y0 + th - 1.2, tz + Math.sin(a) * 1.62, 0.4, 0.6, 0.4, hdr(WARM, 3)); }
        // banner pole + cloth
        B.box(M.iron, tx, y0 + th + 3.6, tz, 0.1, 2.6, 0.1);
        banner(tx, y0 + th + 4.0, tz, team, 1.6, 1.0);
        circles.push([tx, tz, 1.7, y0 + th]);
      }
      // keep inside: timber hall with team flag
      B.box(M.wood, cx + sx * 3, y0 + 1.8, 0, 5, 3.6, 7);
      B.box(M.darkWood, cx + sx * 3, y0 + 4.0, 0, 5.6, 0.6, 7.6, '#ffffff', [0, 0, 0]);
      B.box(M.snow, cx + sx * 3, y0 + 4.4, 0, 5.4, 0.3, 7.4);
      G.box(glow, cx + sx * 3 - sx * 2.52, y0 + 1.6, 0, 0.05, 1.4, 1.2, hdr(WARM, 2.6));
      B.box(M.iron, L.flags[side].pos[0], y0 + 4, 0, 0.14, 8, 0.14);
      banner(L.flags[side].pos[0], y0 + 7, 0, team, 2.6, 1.6);
      // ramparts walkway + snowball stockpile inside
      for (const z of [-hd + 1.5, hd - 1.5]) B.box(M.wood, cx, y0 + H - 1.0, z, FORT.w - 2, 0.25, 1.8);
      for (let i = 0; i < 18; i++) B.add(M.snow, SPH, cx - sx * 4 + (R() - 0.5) * 2, y0 + 0.25 + (i % 3) * 0.3, (i < 9 ? -6 : 6) + (R() - 0.5) * 2, 0.45, 0.45, 0.45);
      // team glow strip along inner wall base + pools
      G.box(glowTeam, inner - sx * 0.8, y0 + 0.08, 0, 0.15, 0.08, FORT.d, hdr(team, 2.4));
      pool(inner - sx * 2, 0, 6, team, 0.35); pool(cx, 0, 8, WARM, 0.18);
      const pl = new THREE.PointLight(team, 30, 26, 1.6); pl.position.set(inner - sx * 2, 4, 0); scene.add(pl); lanternLights.push([pl, 30, true]);
      // colliders along walls (coarse)
      for (let z = -hd; z <= hd; z += 1.5) { if (Math.abs(z) > FORT.gateW / 2) circles.push([inner, z, 0.8, y0 + H]); circles.push([cx + sx * hw, z, 0.8, y0 + H]); }
      for (let x = cx - hw; x <= cx + hw; x += 1.5) { circles.push([x, -hd, 0.8, y0 + H]); circles.push([x, hd, 0.8, y0 + H]); }
    }
    // banners: segmented quads animated in update
    function banner(x, y, z, hex, w, h) {
      const geo = new THREE.PlaneGeometry(w, h, 8, 2); geo.translate(w / 2, 0, 0);
      const mat = M.cloth.clone(); mat.color.set(hex); mat.emissive = new THREE.Color(hex); mat.emissiveIntensity = 0.35;
      const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.y = R() * 0.6 - 0.3; m.castShadow = true; scene.add(m);
      banners.push({ m, base: geo.attributes.position.array.slice(), ph: R() * 6, w });
    }
    fort('red'); fort('blue');

    // ---------- midfield capture crystal ----------
    B.add(M.rock, CYL, 0, 0.3, 0, 8, 0.6, 8); B.add(M.iceBlock, CYL, 0, 0.62, 0, 6.4, 0.08, 6.4, '#e9f6ff');
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; B.box(M.rock, Math.cos(a) * 3.7, 0.9, Math.sin(a) * 3.7, 0.7, 0.7, 0.7, '#ffffff', [0, a, 0]);
      G.box(glowCrystal, Math.cos(a) * 3.2, 0.68, Math.sin(a) * 3.2, 0.9, 0.03, 0.12, hdr(CRYSTAL, 2), [0, -a, 0]); }
    const crystal = new THREE.Group(); crystal.position.set(0, 0.6, 0); scene.add(crystal);
    const cMat = glowMaterial(); cMat.color.set(CRYSTAL).multiplyScalar(2.4);
    const core = new THREE.Mesh(OCTA, cMat); core.scale.set(1.6, 3.2, 1.6); core.position.y = 2.6; crystal.add(core);
    const shards = [];
    for (let i = 0; i < 6; i++) { const s = new THREE.Mesh(OCTA, cMat); const a = i / 6 * Math.PI * 2; s.scale.set(0.5, 1.2, 0.5); s.userData = { a, r: 2.2 }; crystal.add(s); shards.push(s); }
    const ring = new THREE.Mesh(new THREE.TorusGeometry(2.6, 0.06, 6, 64), cMat); ring.rotation.x = Math.PI / 2; ring.position.y = 0.2; crystal.add(ring);
    pool(0, 0, 7, CRYSTAL, 0.6);
    const crystalLight = new THREE.PointLight(CRYSTAL, 60, 22, 1.5); crystalLight.position.set(0, 3.5, 0); scene.add(crystalLight);
    circles.push([0, 0, 1.4, 6]);

    // ---------- cover ----------
    for (const c of L.cover) {
      const [x, y, z] = c.pos, yaw = c.yaw;
      if (c.kind === 'berm') { for (let i = 0; i < 5; i++) B.add(M.snow, SPH, x + (i - 2) * 0.9 * Math.cos(yaw), y + 0.3, z + (i - 2) * 0.9 * Math.sin(yaw), 1.8, 1.2 + R() * 0.4, 1.4); circles.push([x, z, 2.0, y + 1]); }
      else if (c.kind === 'crate') { for (const [dx, dy, dz] of [[0, 0, 0], [1.1, 0, 0.1], [0.5, 1, 0]]) { B.box(M.wood, x + dx, y + 0.5 + dy, z + dz, 1, 1, 1, '#ffffff', [0, yaw, 0]); B.box(M.darkWood, x + dx, y + 0.5 + dy, z + dz, 1.04, 0.15, 1.04, '#ffffff', [0, yaw, 0]); }
        B.box(M.snow, x + 0.5, y + 2.05, z, 0.9, 0.12, 0.9); circles.push([x + 0.5, z, 1.3, y + 2]); }
      else if (c.kind === 'iceWall') { for (let i = 0; i < 4; i++) B.box(M.iceWall, x, y + 0.9, z + (i - 1.5) * 1.05, 0.6, 1.8 + (i % 2) * 0.3, 1.0, '#ffffff', [0, yaw * 0.3, 0]);
        G.box(glowCrystal, x, y + 0.05, z, 0.7, 0.04, 4.2, hdr(BLUE, 0.9)); circles.push([x, z - 1, 0.8, y + 1.8], [x, z + 1, 0.8, y + 1.8]); }
      else if (c.kind === 'sled') { B.box(M.wood, x, y + 0.7, z, 3, 0.15, 1.2, '#ffffff', [0.9, yaw, 0]); for (const s of [-0.5, 0.5]) B.box(M.iron, x, y + 0.2, z + s, 3.2, 0.08, 0.08, '#ffffff', [0, yaw, 0]);
        B.add(M.snow, SPH, x - 0.6, y + 0.2, z, 1.6, 0.7, 1.6); circles.push([x, z, 1.4, y + 1.3]); }
    }
    // ---------- ammo snowball piles ----------
    for (const a of L.ammoCrates) {
      const [x, y, z] = a.pos;
      B.box(M.wood, x, y + 0.25, z, 1.6, 0.5, 1.6);
      for (const [ph, h, n, r] of [[0, 0.65, 6, 0.5], [0.3, 0.95, 3, 0.25], [0, 1.2, 1, 0]]) for (let i = 0; i < n; i++) { const t = ph + i / n * Math.PI * 2;
        G.add(glowCrystal, SPH, x + Math.cos(t) * r, y + h, z + Math.sin(t) * r, 0.42, 0.42, 0.42, hdr('#e8fdff', 1.4)); }
      pool(x, z, 2, BLUE, 0.3); circles.push([x, z, 0.9, y + 1.3]);
    }
    // ---------- lanterns ----------
    for (const [x, y, z] of L.LANTERNS) {
      B.box(M.iron, x, y + 1.2, z, 0.14, 2.4, 0.14); B.box(M.iron, x, y + 2.55, z, 0.5, 0.1, 0.5);
      G.box(glow, x, y + 2.3, z, 0.34, 0.4, 0.34, hdr(WARM, 3.4)); pool(x, z, 3.2, WARM, 0.4); circles.push([x, z, 0.25, y + 2.6]);
    }
    // ---------- valley dressing: pines, rocks, distant ridges ----------
    for (let i = 0; i < 160; i++) {
      const x = (R() - 0.5) * 160, side = R() < 0.5 ? -1 : 1, z = side * (L.COURT.halfZ - 2 + R() * 30);
      const y = groundHeight(x, Math.sign(z) * Math.min(Math.abs(z), L.COURT.halfZ + 10)), s = 0.8 + R() * 1.4;
      B.add(M.darkWood, CYL, x, y + s * 0.6, z, 0.4 * s, 1.2 * s, 0.4 * s);
      for (let k = 0; k < 3; k++) { B.add(M.pine, CONE, x, y + s * (1.6 + k * 1.1), z, s * (2.6 - k * 0.7), s * 1.8, s * (2.6 - k * 0.7)); B.add(M.snow, CONE, x, y + s * (1.95 + k * 1.1), z, s * (1.8 - k * 0.5), s * 0.7, s * (1.8 - k * 0.5)); }
    }
    for (let i = 0; i < 40; i++) { const a = R() * Math.PI * 2, r = 120 + R() * 120, s = 20 + R() * 40;
      B.add(M.rock, CONE, Math.cos(a) * r, s * 0.4, Math.sin(a) * r, s * 1.6, s * (1 + R()), s * 1.4); B.add(M.snow, CONE, Math.cos(a) * r, s * 0.4 + s * 0.35, Math.sin(a) * r, s * 0.9, s * 0.6, s * 0.8); }

    // ---------- drifting snow sparkle ----------
    const spray = (() => {
      const n = 900, g = new THREE.BufferGeometry(), p = new Float32Array(n * 3), s = new Float32Array(n);
      for (let i = 0; i < n; i++) { p.set([(R() - 0.5) * 90, R() * 8, (R() - 0.5) * 50], i * 3); s[i] = R(); }
      g.setAttribute('position', new THREE.BufferAttribute(p, 3)); g.setAttribute('aPhase', new THREE.BufferAttribute(s, 1));
      const mat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
        uniforms: { uTime: { value: 0 }, uNight: { value: 1 }, uWind: { value: 1 } },
        vertexShader: `attribute float aPhase; uniform float uTime, uWind; varying float vA;
          void main(){ float t = fract(aPhase * 7.0 + uTime * 0.05); vec3 p = position; p.y += t * 3.0 - 0.5; p.x += t * 6.0 * uWind; p.z += sin(uTime * 0.5 + aPhase * 30.0) * 0.8;
            vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv;
            vA = smoothstep(0.0, 0.15, t) * smoothstep(1.0, 0.7, t); gl_PointSize = min(6.0, (1.2 + 2.0 * fract(aPhase * 13.0)) * 260.0 / max(0.5, -mv.z)); }`,
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
      scene.fog.density = THREE.MathUtils.lerp(0.005, 0.008, n) + storm * storm * 0.03 + w * 0.002;
      sky.uniforms.uNight.value = n; sky.uniforms.uStorm.value = storm * 0.95; sky.uniforms.uStormColor.value.copy(scene.fog.color);
      hemi.color.copy(DAY.hemiSky).lerp(NIGHT.hemiSky, n); hemi.groundColor.copy(DAY.hemiGround).lerp(NIGHT.hemiGround, n);
      hemi.intensity = THREE.MathUtils.lerp(DAY.hemiI, NIGHT.hemiI, n) * (1 + storm * 0.25);
      key.color.copy(DAY.key).lerp(NIGHT.key, n); key.intensity = THREE.MathUtils.lerp(DAY.keyI, NIGHT.keyI, n) * (1 - storm * 0.7);
      key.position.copy(key.target.position).addScaledVector(SUN_DIR.clone().lerp(MOON_DIR, n).normalize(), 400);
      if (renderer) renderer.toneMappingExposure = THREE.MathUtils.lerp(DAY.exposure, NIGHT.exposure, n);
      glowTeam.color.setScalar(THREE.MathUtils.lerp(0.5, 1, n)); glowCrystal.color.setScalar(THREE.MathUtils.lerp(0.5, 1, n));
      poolMat.color.setScalar(THREE.MathUtils.lerp(DAY.pool, NIGHT.pool, n));
      lanternLights.forEach(([l, k]) => { l.intensity = k * n; }); crystalLight.intensity = 60 * (0.3 + 0.7 * n);
      spray.uniforms.uNight.value = n;
    }
    applyLook();

    const s0 = L.spawns.red[4];
    return {
      scene, shots: SHOTS,
      spawn: { pos: [s0.pos[0], s0.pos[1] + 0.1, s0.pos[2]], facing: s0.facing },
      walkBounds: L.walkBounds, groundHeight,
      hooks: L.HOOKS, spawns: L.spawns, respawns: L.respawns, objective: L.objective, ammoCrates: L.ammoCrates, cover: L.cover, bounds: L.bounds, flags: L.flags,
      addColliders(col) { circles.forEach(([x, z, r, top]) => col.addCircle(x, z, r, top)); },
      setNight(v) { if (v !== look.night) { look.night = v; applyLook(); } },
      setWeather(v) { if (v !== look.weather) { look.weather = v; applyLook(); } },
      wind: (w) => ({ speed: 2.0 + w * 10, wind: [1 + w * w * 16, 0.3 + w * 3] }),
      avatarColors: { skin: '#f1c9a5', shirt: '#e8434f', pants: '#24324a' },
      bloom: (n, w) => ({ strength: THREE.MathUtils.lerp(0.25, 0.7, n) * (1 - 0.3 * w), radius: 0.45, threshold: THREE.MathUtils.lerp(1.6, 0.95, n) }),
      update(dt, t) {
        sky.uniforms.uTime.value = t; spray.uniforms.uTime.value = t; spray.uniforms.uWind.value = 1 + look.weather * 2;
        // crystal pulse + orbiting shards
        const pulse = 0.8 + 0.2 * Math.sin(t * 2.4);
        cMat.color.set(CRYSTAL).multiplyScalar(THREE.MathUtils.lerp(1.0, 2.6, look.night) * pulse);
        core.rotation.y = t * 0.5; core.position.y = 2.6 + Math.sin(t * 1.3) * 0.15;
        shards.forEach((s, i) => { const a = s.userData.a + t * 0.6; s.position.set(Math.cos(a) * 2.2, 2.2 + Math.sin(t * 1.7 + i) * 0.4, Math.sin(a) * 2.2); s.rotation.y = a; });
        ring.scale.setScalar(1 + 0.05 * Math.sin(t * 2.4)); crystalLight.intensity = 60 * (0.3 + 0.7 * look.night) * pulse;
        // lantern flicker
        glow.color.setScalar(THREE.MathUtils.lerp(DAY.glow, NIGHT.glow, look.night) * (0.93 + 0.07 * Math.sin(t * 11.0) * Math.sin(t * 6.7)));
        // banner flutter
        const wind = 1 + look.weather * 2;
        for (const b of banners) { const pa = b.m.geometry.attributes.position, a = pa.array;
          for (let i = 0; i < pa.count; i++) { const x = b.base[i * 3], u = x / b.w; a[i * 3 + 2] = b.base[i * 3 + 2] + Math.sin(t * 4 * wind * 0.6 + x * 2.5 + b.ph) * 0.18 * u * wind; }
          pa.needsUpdate = true; }
      },
    };
  },
};
