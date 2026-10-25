// Knockout Floes: a neon-lit knockout arena on floating ice. Filming set (not a game).
// Procedural Three.js geometry + shaders only (Iceberg original, no external assets).
import * as THREE from 'three';
import { Batch, glowMaterial, rng } from '../lib/blocks.js';
import { createSky } from '../lib/sky.js';
import { WATER_Y, CENTER, FLOES, BRIDGES, ANCHORS, RING_R, groundHeight, rimR } from './layout.js';
import { SHOTS } from './shots.js';

const C = (hex) => new THREE.Color(hex);
const hdr = (hex, k) => { const c = new THREE.Color(hex).multiplyScalar(k); return [c.r, c.g, c.b]; };
const WARM = '#ffb35c', CYAN = '#5ff0ff';

function radialTex() {
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c);
}

// Irregular floe slab: top cap + skirt down below the waterline.
function floeGeometry(f, seg = 40) {
  const pos = [], col = [], idx = [], top = f.top, bot = WATER_Y - 1.6;
  const cTop = C('#eef6ff'), cSide = C('#7fc4e6'), cDeep = C('#1d4f74');
  pos.push(0, top + 0.05, 0); col.push(cTop.r, cTop.g, cTop.b);
  for (let i = 0; i < seg; i++) {
    const a = i / seg * Math.PI * 2, r = rimR(f, a), x = Math.cos(a) * r, z = Math.sin(a) * r;
    pos.push(x, top, z, x * 1.02, top - 0.25, z * 1.02, x * 1.08, bot, z * 1.08);
    col.push(cTop.r, cTop.g, cTop.b, cSide.r, cSide.g, cSide.b, cDeep.r, cDeep.g, cDeep.b);
  }
  for (let i = 0; i < seg; i++) {
    const a = 1 + i * 3, b = 1 + ((i + 1) % seg) * 3;
    idx.push(0, b, a, a, b, b + 1, a, b + 1, a + 1, a + 1, b + 1, b + 2, a + 1, b + 2, a + 2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx); g.computeVertexNormals(); return g;
}

function waterMaterial() {
  return new THREE.ShaderMaterial({
    fog: true, uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uTime: { value: 0 }, uNight: { value: 1 }, uFloes: { value: FLOES.map((f) => new THREE.Vector3(f.x, f.z, f.r)) } }]),
    vertexShader: `varying vec3 vWP;
#include <fog_pars_vertex>
      void main(){ vec4 wp = modelMatrix * vec4(position, 1.0); vWP = wp.xyz; vec4 mvPosition = viewMatrix * wp; gl_Position = projectionMatrix * mvPosition;
#include <fog_vertex>
      }`,
    fragmentShader: `uniform float uTime, uNight; uniform vec3 uFloes[8]; varying vec3 vWP;
#include <fog_pars_fragment>
      float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      void main(){
        vec2 p = vWP.xz; float w = sin(p.x * 0.35 + uTime * 0.8) * sin(p.y * 0.41 - uTime * 0.6) + sin((p.x + p.y) * 0.9 + uTime * 1.3) * 0.4;
        vec3 deep = mix(vec3(0.25, 0.42, 0.55), vec3(0.008, 0.025, 0.05), uNight);
        vec3 col = deep + vec3(0.02, 0.06, 0.09) * w;
        float dmin = 1e3;
        for (int i = 0; i < 8; i++) { float d = length(p - uFloes[i].xy) - uFloes[i].z * 1.05; dmin = min(dmin, d);
          // splash ripples: expanding rings that spawn around floes now and then
          float ph = fract(uTime * 0.18 + float(i) * 0.37); float rr = ph * 5.0; float ring = smoothstep(0.18, 0.0, abs(d - rr)) * (1.0 - ph) * step(0.0, d);
          col += vec3(0.45, 0.95, 1.1) * ring * 0.55 * (0.4 + 0.6 * uNight); }
        col += vec3(0.25, 0.9, 1.1) * exp(-max(dmin, 0.0) * 1.4) * 0.35 * uNight;          // neon spill near rims
        col += vec3(1.0, 0.7, 0.35) * step(0.997, h21(floor(p * 3.0 + uTime * 0.2))) * 0.6 * uNight; // lantern glints
        gl_FragColor = vec4(col, 1.0);
        #include <fog_fragment>
      }`,
  });
}

export default {
  id: 'knockout-floes',
  name: 'Knockout Floes',
  async create({ renderer }) {
    const R = rng(4242);
    const scene = new THREE.Scene();
    const B = new Batch(), G = new Batch(), P = new Batch();
    const animated = [], circles = [];
    const look = { night: 1, weather: 0.3, storm: 0 };

    const M = {
      ice: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.35, metalness: 0.05, flatShading: true }),
      snow: new THREE.MeshStandardMaterial({ color: '#f5faff', roughness: 0.95, flatShading: true }),
      iron: new THREE.MeshStandardMaterial({ color: '#2a3140', roughness: 0.45, metalness: 0.7 }),
      wood: new THREE.MeshStandardMaterial({ color: '#6a4528', roughness: 0.85 }),
      berg: new THREE.MeshStandardMaterial({ color: '#cfe6f5', roughness: 0.6, flatShading: true }),
      igloo: new THREE.MeshStandardMaterial({ color: '#dfeaf6', roughness: 0.9, flatShading: true }),
      bridge: new THREE.MeshStandardMaterial({ color: '#bfe8ff', roughness: 0.1, transparent: true, opacity: 0.75, emissive: '#2a7fb0', emissiveIntensity: 0.35 }),
    };
    M.bridge.userData.noShadow = true;
    const glow = glowMaterial(), glowCyan = glowMaterial();
    const poolMat = new THREE.MeshBasicMaterial({ map: radialTex(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -2 });
    poolMat.userData.noShadow = true;
    const POOL = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    const pool = (x, y, z, r, hex, k) => P.add(poolMat, POOL, x, y + 0.04, z, r * 2, 1, r * 2, hdr(hex, k));
    const CYL = new THREE.CylinderGeometry(0.5, 0.5, 1, 10), SPH = new THREE.IcosahedronGeometry(0.5, 1), CONE = new THREE.ConeGeometry(0.5, 1, 7);

    // ---------- sky, fog, lights ----------
    const sky = createSky(); scene.add(sky.mesh);
    sky.uniforms.uAurora.value = 0.55;
    scene.fog = new THREE.FogExp2('#0d1c33', 0.006);
    const hemi = new THREE.HemisphereLight('#4a6aa8', '#0a1424', 0.8); scene.add(hemi);
    const key = new THREE.DirectionalLight('#a8c0ff', 1.1);
    key.castShadow = true; key.shadow.mapSize.set(2048, 2048);
    Object.assign(key.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, near: 10, far: 900 });
    key.shadow.bias = -0.0004; key.shadow.normalBias = 0.05; key.target.position.set(0, 0, 0); scene.add(key, key.target);
    const MOON_DIR = sky.uniforms.uMoonDir.value, SUN_DIR = sky.uniforms.uSunDir.value;

    // ---------- water ----------
    const waterMat = waterMaterial();
    const water = new THREE.Mesh(new THREE.PlaneGeometry(1600, 1600, 1, 1).rotateX(-Math.PI / 2), waterMat);
    water.position.y = WATER_Y; water.receiveShadow = false; scene.add(water);
    animated.push((t) => { waterMat.uniforms.uTime.value = t; waterMat.uniforms.uNight.value = look.night; });

    // ---------- floes ----------
    const rimMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(CYAN).multiplyScalar(2.6), toneMapped: false });
    rimMat.userData.noShadow = true;
    const rims = [];
    for (const f of FLOES) {
      const m = new THREE.Mesh(floeGeometry(f), M.ice); m.position.set(f.x, 0, f.z); m.castShadow = m.receiveShadow = true; scene.add(m);
      // neon rim line just below the top edge
      const pts = []; for (let i = 0; i <= 64; i++) { const a = i / 64 * Math.PI * 2, r = rimR(f, a) * 1.015; pts.push(new THREE.Vector3(Math.cos(a) * r, f.top - 0.12, Math.sin(a) * r)); }
      const rim = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 96, 0.06, 5, true), rimMat);
      rim.position.set(f.x, 0, f.z); scene.add(rim); rims.push(rim);
      // snow drifts + crack hints on top
      for (let k = 0; k < 6; k++) { const a = R() * Math.PI * 2, r = Math.sqrt(R()) * f.r * 0.75; const s = 0.6 + R() * 1.2;
        B.add(M.snow, SPH, f.x + Math.cos(a) * r, f.top - s * 0.15, f.z + Math.sin(a) * r, s * 1.6, s * 0.4, s * 1.2, '#ffffff', [0, R() * 3, 0]); }
      for (let k = 0; k < 4; k++) { // glowing crack zig-zags
        let a = R() * Math.PI * 2, r = f.r * (0.25 + R() * 0.3), x = f.x + Math.cos(a) * r, z = f.z + Math.sin(a) * r; let d = R() * Math.PI * 2;
        for (let s = 0; s < 4; s++) { const L = 0.5 + R() * 0.7, nx = x + Math.cos(d) * L, nz = z + Math.sin(d) * L;
          if (Math.hypot(nx - f.x, nz - f.z) > f.r * 0.92) break;
          G.box(glowCyan, (x + nx) / 2, f.top + 0.02, (z + nz) / 2, L, 0.02, 0.05, hdr('#9ff6ff', 1.6), [0, -d, 0]); x = nx; z = nz; d += (R() - 0.5) * 1.6; }
      }
      if (f.id !== 'king') {
        // warm lantern posts on the far side + a snowball crate / glowing pile
        const out = Math.atan2(f.z, f.x);
        for (const s of [-0.7, 0.7]) lantern(f.x + Math.cos(out + s) * f.r * 0.72, f.z + Math.sin(out + s) * f.r * 0.72, f.top);
        const ca = out + Math.PI + (R() - 0.5), cx = f.x + Math.cos(ca) * f.r * 0.45, cz = f.z + Math.sin(ca) * f.r * 0.45;
        if (R() < 0.55) crate(cx, cz, f.top, R() * 3); else snowPile(cx, cz, f.top);
      }
    }
    function lantern(x, z, y0) {
      B.box(M.iron, x, y0 + 1.1, z, 0.14, 2.2, 0.14); B.box(M.iron, x, y0 + 2.35, z, 0.5, 0.1, 0.5);
      G.box(glow, x, y0 + 2.1, z, 0.34, 0.4, 0.34, hdr(WARM, 3.4)); pool(x, y0, z, 3, WARM, 0.4); circles.push([x, z, 0.25, y0 + 2.6]);
    }
    function crate(x, z, y0, yaw) {
      B.box(M.wood, x, y0 + 0.4, z, 1.2, 0.8, 0.9, '#ffffff', [0, yaw, 0]);
      for (let i = 0; i < 6; i++) B.add(M.snow, SPH, x + ((i % 3) - 1) * 0.32, y0 + 0.95, z + (i < 3 ? -0.18 : 0.18), 0.36, 0.36, 0.36);
      circles.push([x, z, 0.7, y0 + 0.8]);
    }
    function snowPile(x, z, y0) {
      const layers = [[0, 0.18, 6, 0.75], [0.1, 0.48, 4, 0.45], [0, 0.76, 1, 0]];
      for (const [ph, y, n, r] of layers) for (let i = 0; i < n; i++) { const a = ph + i / n * Math.PI * 2;
        G.add(glowCyan, SPH, x + Math.cos(a) * r, y0 + y, z + Math.sin(a) * r, 0.38, 0.38, 0.38, hdr('#d8fbff', 1.5)); }
      pool(x, y0, z, 2.2, CYAN, 0.35); circles.push([x, z, 0.8, y0 + 1]);
    }

    // ---------- bridges ----------
    for (const b of BRIDGES) {
      const dx = b.b.x - b.a.x, dz = b.b.z - b.a.z, L = Math.hypot(dx, dz), yaw = -Math.atan2(dz, dx), n = Math.ceil(L / 0.8);
      for (let i = 0; i < n; i++) { const u = (i + 0.5) / n, x = b.a.x + dx * u, z = b.a.z + dz * u, y = groundHeight(x, z);
        if (y == null) continue;
        B.box(M.bridge, x, y - 0.15, z, L / n + 0.02, 0.3, b.half * 2, '#ffffff', [0, yaw, 0]);
        if (i % 3 === 1) G.box(glowCyan, x, y + 0.01, z, 0.14, 0.03, 0.14, hdr(CYAN, 2.5)); }
    }

    // ---------- king floe: neon ring + score totem with brazier ----------
    const T = CENTER.top;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(2.6, 0.07, 8, 96), rimMat); ring.rotation.x = Math.PI / 2; ring.position.set(0, T + 0.05, 0); scene.add(ring);
    const halo = new THREE.Mesh(new THREE.TorusGeometry(1.2, 0.05, 8, 64), glowCyan); halo.position.set(0, T + 5.6, 0); scene.add(halo);
    B.add(M.snow, CYL, 0, T + 0.25, 0, 2.2, 0.5, 2.2);
    for (let k = 0; k < 4; k++) B.box(M.igloo, 0, T + 0.9 + k * 0.85, 0, 1.1 - k * 0.12, 0.8, 1.1 - k * 0.12, '#ffffff', [0, k * 0.4, 0]);
    for (let k = 0; k < 4; k++) G.box(glowCyan, 0, T + 0.9 + k * 0.85, 0, 1.14 - k * 0.12, 0.08, 1.14 - k * 0.12, hdr(CYAN, 2.2), [0, k * 0.4, 0]);
    B.add(M.iron, CYL, 0, T + 4.35, 0, 1.0, 0.3, 1.0);
    const flame = new THREE.Mesh(CONE, glow); flame.position.set(0, T + 4.95, 0); flame.scale.set(0.7, 0.9, 0.7); scene.add(flame);
    animated.push((t) => { flame.scale.y = 0.9 + Math.sin(t * 9) * 0.08 + Math.sin(t * 13.7) * 0.05; halo.rotation.set(Math.PI / 2 + Math.sin(t * 0.6) * 0.25, t * 0.5, 0); halo.position.y = T + 5.6 + Math.sin(t * 1.1) * 0.15; ring.scale.setScalar(1 + Math.sin(t * 2) * 0.015); });
    circles.push([0, 0, 0.9, T + 6]);
    pool(0, T, 0, 5, WARM, 0.35);
    for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2 + 0.4; lantern(Math.cos(a) * 4.6, Math.sin(a) * 4.6, T); }
    crate(-3.1, -1.6, T, 0.5); snowPile(3.0, -2.0, T);
    const brazier = new THREE.PointLight(WARM, 40, 14, 1.7); brazier.position.set(0, T + 5, 0); scene.add(brazier);
    const cyanL = new THREE.PointLight(CYAN, 25, 22, 1.6); cyanL.position.set(0, T + 1.5, 0); scene.add(cyanL);

    // ---------- horizon: icebergs + igloo silhouettes (not a town) ----------
    for (let i = 0; i < 26; i++) {
      const a = R() * Math.PI * 2, r = 70 + R() * 140, x = Math.cos(a) * r, z = Math.sin(a) * r, s = 4 + R() * 14;
      B.add(M.berg, new THREE.DodecahedronGeometry(1, 0), x, WATER_Y + s * 0.2, z, s * (1 + R()), s * (0.7 + R() * 1.6), s * (1 + R()), '#ffffff', [R() * 0.4, R() * 3, R() * 0.4]);
    }
    for (let i = 0; i < 5; i++) {
      const a = -1.2 + i * 0.22, r = 120, x = Math.cos(a) * r, z = Math.sin(a) * r;
      B.add(M.berg, new THREE.CylinderGeometry(1, 1.3, 1, 8), x, WATER_Y + 1, z, 14, 3, 10);
      const ig = new THREE.Mesh(new THREE.SphereGeometry(2.2, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), M.igloo); ig.position.set(x, WATER_Y + 2.5, z); scene.add(ig);
      G.box(glow, x - Math.cos(a) * 2.1, WATER_Y + 3.0, z - Math.sin(a) * 2.1, 0.8, 0.9, 0.8, hdr(WARM, 3.5));
    }

    // ---------- snow spray sparkles drifting over the arena ----------
    const spray = (() => {
      const n = 700, g = new THREE.BufferGeometry(), p = new Float32Array(n * 3), s = new Float32Array(n);
      for (let i = 0; i < n; i++) { const a = R() * Math.PI * 2, r = Math.sqrt(R()) * (RING_R + 8); p.set([Math.cos(a) * r, R() * 6, Math.sin(a) * r], i * 3); s[i] = R(); }
      g.setAttribute('position', new THREE.BufferAttribute(p, 3)); g.setAttribute('aPhase', new THREE.BufferAttribute(s, 1));
      const mat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
        uniforms: { uTime: { value: 0 }, uNight: { value: 1 }, uWind: { value: 1 } },
        vertexShader: `attribute float aPhase; uniform float uTime, uWind; varying float vA;
          void main(){ float t = fract(aPhase * 7.0 + uTime * 0.06); vec3 p = position; p.y += t * 3.0 - 0.5; p.x += t * 6.0 * uWind; p.z += sin(uTime * 0.5 + aPhase * 30.0) * 0.8;
            vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv;
            vA = smoothstep(0.0, 0.15, t) * smoothstep(1.0, 0.7, t); gl_PointSize = min(6.0, (1.2 + 2.0 * fract(aPhase * 13.0)) * 260.0 / max(0.5, -mv.z)); }`,
        fragmentShader: `uniform float uNight; varying float vA; void main(){ float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.0, d) * vA * (0.35 + 0.65 * uNight); if (a < 0.01) discard; gl_FragColor = vec4(vec3(0.75, 0.95, 1.1) * 1.6 * a, a); }` });
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
      scene.fog.density = THREE.MathUtils.lerp(0.004, 0.006, n) + storm * storm * 0.03 + w * 0.002;
      sky.uniforms.uNight.value = n; sky.uniforms.uStorm.value = storm * 0.95; sky.uniforms.uStormColor.value.copy(scene.fog.color);
      hemi.color.copy(DAY.hemiSky).lerp(NIGHT.hemiSky, n); hemi.groundColor.copy(DAY.hemiGround).lerp(NIGHT.hemiGround, n);
      hemi.intensity = THREE.MathUtils.lerp(DAY.hemiI, NIGHT.hemiI, n) * (1 + storm * 0.25);
      key.color.copy(DAY.key).lerp(NIGHT.key, n); key.intensity = THREE.MathUtils.lerp(DAY.keyI, NIGHT.keyI, n) * (1 - storm * 0.7);
      key.position.copy(key.target.position).addScaledVector(SUN_DIR.clone().lerp(MOON_DIR, n).normalize(), 400);
      renderer.toneMappingExposure = THREE.MathUtils.lerp(DAY.exposure, NIGHT.exposure, n);
      glowCyan.color.setScalar(THREE.MathUtils.lerp(0.4, 1, n)); rimMat.color.set(CYAN).multiplyScalar(THREE.MathUtils.lerp(0.9, 2.6, n));
      poolMat.color.setScalar(THREE.MathUtils.lerp(DAY.pool, NIGHT.pool, n));
      brazier.intensity = 40 * (0.3 + 0.7 * n); cyanL.intensity = 25 * n; spray.uniforms.uNight.value = n;
    }
    applyLook();

    return {
      scene, shots: SHOTS,
      spawn: { pos: [ANCHORS.spawn.x, CENTER.top + 0.1, ANCHORS.spawn.z], facing: ANCHORS.spawn.facing },
      walkBounds: { type: 'box', minX: -60, maxX: 60, minZ: -60, maxZ: 60 },
      groundHeight,   // null over open water -> you fall; player respawns at (0,5,0) = king floe
      layout: { FLOES, BRIDGES, ANCHORS, WATER_Y },
      addColliders(col) { circles.forEach(([x, z, r, top]) => col.addCircle(x, z, r, top)); },
      setNight(v) { if (v !== look.night) { look.night = v; applyLook(); } },
      setWeather(v) { if (v !== look.weather) { look.weather = v; applyLook(); } },
      wind: (w) => ({ speed: 2.0 + w * 10, wind: [1 + w * w * 16, 0.3 + w * 3] }),
      avatarColors: { skin: '#f1c9a5', shirt: '#2fb7d6', pants: '#24324a' },
      bloom: (n, w) => ({ strength: THREE.MathUtils.lerp(0.25, 0.65, n) * (1 - 0.3 * w), radius: 0.45, threshold: THREE.MathUtils.lerp(1.6, 0.95, n) }),
      update(dt, t) {
        sky.uniforms.uTime.value = t; animated.forEach((f) => f(t, dt));
        spray.uniforms.uTime.value = t; spray.uniforms.uWind.value = 1 + look.weather * 2;
        const pulse = 0.85 + 0.15 * Math.sin(t * 2.2); rims.forEach((r, i) => { r.position.y = Math.sin(t * 0.7 + i * 0.9) * 0.03; });
        rimMat.color.set(CYAN).multiplyScalar(THREE.MathUtils.lerp(0.9, 2.6, look.night) * pulse);
        glow.color.setScalar(THREE.MathUtils.lerp(DAY.glow, NIGHT.glow, look.night) * (0.96 + 0.04 * Math.sin(t * 11.0) * Math.sin(t * 6.7)));
      },
    };
  },
};
