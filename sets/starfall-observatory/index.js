// Starfall Observatory: a glass-domed night observatory on a rocky snow peak. Filming set (not a game).
// Procedural Three.js geometry + shaders only (Iceberg original, no external assets).
import * as THREE from 'three';
import { Batch, glowMaterial, worldPattern, rng } from '../lib/blocks.js';
import { createSky } from '../lib/sky.js';
import { PLAZA, TERRACE, DOME, COURTYARD, RIDGE, STAIRS, ANCHORS, height, groundHeight, ridgeY, fbm } from './layout.js';
import { SHOTS } from './shots.js';

const C = (hex) => new THREE.Color(hex);
const hdr = (hex, k) => { const c = new THREE.Color(hex).multiplyScalar(k); return [c.r, c.g, c.b]; };
const WARM = '#ffb35c', COLD = '#8fe3ff';

function radialTex() {
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

// Procedural constellations for the mosaic floor (local disc coords, radius ~1).
function makeConstellations(R) {
  const stars = [], lines = [];
  for (let c = 0; c < 7; c++) {
    const a = c / 7 * Math.PI * 2 + R() * 0.4, rr = c === 0 ? 0 : 0.55 + R() * 0.2;
    let px = Math.cos(a) * rr, pz = Math.sin(a) * rr; const n = 4 + Math.floor(R() * 3), first = stars.length;
    for (let i = 0; i < n; i++) {
      stars.push([px, pz, 0.6 + R() * 0.8]);
      if (i) lines.push([stars[first + i - 1][0], stars[first + i - 1][1], px, pz]);
      const d = R() * Math.PI * 2; px += Math.cos(d) * 0.16; pz += Math.sin(d) * 0.16;
      const L = Math.hypot(px, pz); if (L > 0.9) { px *= 0.9 / L; pz *= 0.9 / L; }
    }
  }
  return { stars: stars.slice(0, 40), lines: lines.slice(0, 40) };
}

function constellationMaterial(R) {
  const { stars, lines } = makeConstellations(R);
  const S = Array.from({ length: 40 }, (_, i) => new THREE.Vector3(...(stars[i] || [9, 9, 0])));
  const L = Array.from({ length: 40 }, (_, i) => new THREE.Vector4(...(lines[i] || [9, 9, 9, 9])));
  return new THREE.ShaderMaterial({
    toneMapped: false, fog: false,
    uniforms: { uTime: { value: 0 }, uNight: { value: 1 }, uStars: { value: S }, uLines: { value: L } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv * 2.0 - 1.0; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
      uniform float uTime, uNight; uniform vec3 uStars[40]; uniform vec4 uLines[40]; varying vec2 vUv;
      float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float seg(vec2 p, vec2 a, vec2 b){ vec2 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0); return length(pa - ba * h); }
      void main(){
        vec2 p = vUv; float r = length(p);
        // mosaic tiles (polar-ish bricks), deep blue with variation
        float ang = atan(p.y, p.x); float ring = floor(r * 14.0); float cells = max(6.0, floor(ring * 6.0));
        vec2 tid = vec2(ring, floor((ang / 6.2831853 + 0.5) * cells + mod(ring, 2.0) * 0.5));
        vec2 f = vec2(fract(r * 14.0), fract((ang / 6.2831853 + 0.5) * cells + mod(ring, 2.0) * 0.5));
        float grout = smoothstep(0.0, 0.07, f.x) * smoothstep(1.0, 0.93, f.x) * smoothstep(0.0, 0.07, f.y) * smoothstep(1.0, 0.93, f.y);
        vec3 tile = mix(vec3(0.03, 0.05, 0.13), vec3(0.08, 0.10, 0.26), h21(tid));
        tile = mix(tile, vec3(0.10, 0.06, 0.22), step(0.85, h21(tid + 3.1)));
        vec3 col = tile * mix(0.35, 1.0, grout);
        // gold rim rings
        col += vec3(1.0, 0.7, 0.3) * (smoothstep(0.012, 0.0, abs(r - 0.97)) + smoothstep(0.008, 0.0, abs(r - 0.5)) * 0.5) * 1.4;
        // faint background dust stars on tiles
        float dust = step(0.985, h21(floor(p * 60.0))) * (0.5 + 0.5 * sin(uTime * 2.0 + h21(floor(p * 60.0) + 7.0) * 40.0));
        col += vec3(0.6, 0.75, 1.0) * dust * 0.8;
        // constellation lines + stars (glowing, twinkling)
        float ln = 1e3; for (int i = 0; i < 40; i++) ln = min(ln, seg(p, uLines[i].xy, uLines[i].zw));
        col += vec3(0.35, 0.75, 1.3) * smoothstep(0.009, 0.0, ln) * (0.8 + 0.2 * sin(uTime * 1.3));
        col += vec3(0.2, 0.45, 0.9) * smoothstep(0.05, 0.0, ln) * 0.25;
        for (int i = 0; i < 40; i++) {
          float d = length(p - uStars[i].xy); float tw = 0.65 + 0.35 * sin(uTime * (1.5 + uStars[i].z) + float(i) * 2.3);
          col += vec3(1.0, 0.92, 0.7) * uStars[i].z * tw * (smoothstep(0.03, 0.0, d) * 3.0 + exp(-d * 45.0) * 0.6);
        }
        col *= mix(0.6, 1.0, uNight);
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
}

export default {
  id: 'starfall-observatory',
  name: 'Starfall Observatory',
  async create({ renderer }) {
    const R = rng(1987);
    const scene = new THREE.Scene();
    const B = new Batch(), G = new Batch(), P = new Batch();
    const animated = [];                 // (t, dt, camera) => void
    const colliders = [];                // boxes for walk mode
    const circles = [];                  // [x, z, r, top]
    const flags = [];
    const FLAG_COLS = ['#ffd36b', '#7fd8ff', '#ff7aa8', '#b49bff', '#9dffb0', '#ffffff'];

    // ---------------- materials ----------------
    const M = {
      stone: worldPattern(new THREE.MeshStandardMaterial({ color: '#8f9bb0', roughness: 0.88 }),
        `vec2 p = (abs(vWN.y) > 0.5 ? vWP.xz : vec2(vWP.x + vWP.z, vWP.y)) * vec2(1.1, 1.9);
         p.x += step(1.0, mod(floor(p.y), 2.0)) * 0.5; vec2 f = fract(p);
         float m = smoothstep(0.0, 0.07, f.x) * smoothstep(1.0, 0.93, f.x) * smoothstep(0.0, 0.09, f.y) * smoothstep(1.0, 0.91, f.y);
         float snow = abs(vWN.y) > 0.5 ? smoothstep(0.55, 0.8, n2(vWP.xz * 0.4)) : 0.0;
         return mix(mix(0.55, 1.0, m) * (0.85 + 0.25 * h21(floor(p))), 1.35, snow);`),
      slate: worldPattern(new THREE.MeshStandardMaterial({ color: '#56627a', roughness: 0.7 }),
        `vec2 p = vWP.xz * 0.7; p.x += step(1.0, mod(floor(p.y), 2.0)) * 0.5; vec2 f = fract(p);
         float m = smoothstep(0.0, 0.06, f.x) * smoothstep(1.0, 0.94, f.x) * smoothstep(0.0, 0.06, f.y) * smoothstep(1.0, 0.94, f.y);
         float snow = smoothstep(0.5, 0.78, n2(vWP.xz * 0.3));
         return mix(mix(0.6, 1.0, m) * (0.85 + 0.25 * h21(floor(p))), 2.0, snow);`),
      rock: new THREE.MeshStandardMaterial({ color: '#66758c', roughness: 0.9, flatShading: true }),
      snow: new THREE.MeshStandardMaterial({ color: '#f3f8ff', roughness: 0.92, flatShading: true }),
      brass: new THREE.MeshStandardMaterial({ color: '#c79a4a', roughness: 0.35, metalness: 0.85 }),
      iron: new THREE.MeshStandardMaterial({ color: '#2a3140', roughness: 0.45, metalness: 0.7 }),
      wood: new THREE.MeshStandardMaterial({ color: '#5a3a24', roughness: 0.8 }),
      crystal: new THREE.MeshStandardMaterial({ color: '#bfe8ff', roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.6, emissive: '#3a8fd8', emissiveIntensity: 0.45 }),
      glass: new THREE.MeshPhysicalMaterial({ color: '#cfe9ff', roughness: 0.04, metalness: 0.0, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false, emissive: '#1b3f66', emissiveIntensity: 0.1 }),
      flag: new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.85, side: THREE.DoubleSide, vertexColors: false }),
    };
    M.crystal.userData.noShadow = true; M.glass.userData.noShadow = true;
    const glow = glowMaterial(), glowCold = glowMaterial();
    const poolMat = new THREE.MeshBasicMaterial({ map: radialTex(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -2 });
    poolMat.userData.noShadow = true;
    const POOL = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    const pool = (x, z, r, hex, k) => P.add(poolMat, POOL, x, groundHeight(x, z) + 0.07, z, r * 2, 1, r * 2, hdr(hex, k));
    const CYL = new THREE.CylinderGeometry(0.5, 0.5, 1, 10), CONE = new THREE.ConeGeometry(0.5, 1, 6), ROCK = new THREE.DodecahedronGeometry(1, 0);
    const OCT = new THREE.OctahedronGeometry(0.5, 0);

    // ---------------- sky, fog, lights ----------------
    const sky = createSky(); scene.add(sky.mesh);
    sky.uniforms.uAurora.value = 0.35;   // a whisper of aurora; the show is meteors
    scene.fog = new THREE.FogExp2('#13223f', 0.0022);
    const hemi = new THREE.HemisphereLight('#4a6aa8', '#141c30', 0.8); scene.add(hemi);
    const key = new THREE.DirectionalLight('#a8c0ff', 1.15);
    key.castShadow = true; key.shadow.mapSize.set(2048, 2048);
    Object.assign(key.shadow.camera, { left: -60, right: 60, top: 60, bottom: -60, near: 10, far: 900 });
    key.shadow.bias = -0.0004; key.shadow.normalBias = 0.05;
    key.target.position.set(0, 36, 0); scene.add(key, key.target);
    const MOON_DIR = sky.uniforms.uMoonDir.value, SUN_DIR = sky.uniforms.uSunDir.value;

    // ---------------- terrain (mountain) ----------------
    {
      const S = 1400, N = 220;
      const geo = new THREE.PlaneGeometry(S, S, N, N).rotateX(-Math.PI / 2);
      const pos = geo.attributes.position;
      for (let i = 0; i < pos.count; i++) pos.setY(i, height(pos.getX(i), pos.getZ(i)));
      geo.computeVertexNormals();
      const nrm = geo.attributes.normal, col = new Float32Array(pos.count * 3), c = new THREE.Color();
      for (let i = 0; i < pos.count; i++) {
        const ny = nrm.getY(i), x = pos.getX(i), z = pos.getZ(i);
        const rock = THREE.MathUtils.smoothstep(0.9, 0.66, ny);
        c.set('#eef5ff').lerp(C('#d3e0f2'), fbm(x * 0.05, z * 0.05) * 0.7).lerp(C('#4f5d74'), rock * 0.9);
        col.set([c.r, c.g, c.b], i * 3);
      }
      geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
      const t = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.93, flatShading: true }));
      t.receiveShadow = true; t.name = 'terrain'; scene.add(t);
      // scattered boulders on the slopes
      for (let i = 0; i < 160; i++) {
        const a = R() * Math.PI * 2, r = 36 + R() * 120, x = Math.cos(a) * r, z = Math.sin(a) * r;
        if (Math.abs(x) < 7 && z > 20) continue;
        const s = 1 + R() * 3.5; B.add(M.rock, ROCK, x, height(x, z) + s * 0.3, z, s * (1 + R()), s, s * (1 + R()), '#ffffff', [R() * 3, R() * 3, R() * 3]);
      }
    }

    // ---------------- far valley hamlet lights (tiny warm glows far below) ----------------
    for (let i = 0; i < 70; i++) {
      const cl = Math.floor(i / 10), ca = cl * 0.9 + 0.3, cr = 110 + (cl % 3) * 35;
      const x = Math.cos(ca) * cr + (R() - 0.5) * 22, z = -Math.sin(ca) * cr + (R() - 0.5) * 22;
      if (Math.abs(x) < 10 && z > 0) continue;
      G.box(glow, x, height(x, z) + 0.8, z, 0.9, 0.9, 0.9, hdr(R() < 0.8 ? WARM : '#ffe2a8', 4));
    }

    // ---------------- summit plaza, terrace, stairs ----------------
    {
      const plaza = new THREE.Mesh(new THREE.CylinderGeometry(PLAZA.r, PLAZA.r + 0.6, 6, 72), M.slate);
      plaza.position.y = PLAZA.y - 3; plaza.receiveShadow = plaza.castShadow = true; scene.add(plaza);
      const terr = new THREE.Mesh(new THREE.CylinderGeometry(TERRACE.r1, TERRACE.r1 + 1.5, 5, 96), M.stone);
      terr.position.y = TERRACE.y - 2.5; terr.receiveShadow = true; scene.add(terr);
      for (const s of STAIRS) {
        const dx = Math.cos(s.a), dz = -Math.sin(s.a);
        for (let k = 1; k <= 10; k++) {
          const along = PLAZA.r + (k - 0.5) * 0.6, top = PLAZA.y - k * 0.5, h = top - (TERRACE.y - 1);
          B.box(M.stone, dx * along, top - h / 2, dz * along, 0.62, h, s.half * 2, '#ffffff', [0, s.a, 0]);
        }
        // glowing stair-side lanterns
        for (const side of [-1, 1]) { const lx = dx * (PLAZA.r + 3) - dz * side * (s.half + 0.4), lz = dz * (PLAZA.r + 3) + dx * side * (s.half + 0.4);
          lantern(lx, lz, 0.9); }
      }
      // plaza-edge parapet (gaps at stairs) and terrace railing (gap at the ridge)
      const inStair = (a, r, extra = 0) => STAIRS.some((s) => { const lat = Math.abs(Math.sin(a - s.a)) * r; return Math.cos(a - s.a) > 0 && lat < s.half + extra; });
      for (let i = 0; i < 120; i++) {
        const a = i / 120 * Math.PI * 2, x = Math.cos(a) * (PLAZA.r - 0.4), z = -Math.sin(a) * (PLAZA.r - 0.4);
        if (inStair(a, PLAZA.r, 0.3)) continue;
        B.box(M.stone, x, PLAZA.y + 0.45, z, 1.3, 0.9, 0.7, '#ffffff', [0, a + Math.PI / 2, 0]);
        if (i % 2 === 0) circles.push([x, z, 0.65, PLAZA.y + 1.2]);
      }
      for (let i = 0; i < 170; i++) {
        const a = i / 170 * Math.PI * 2, x = Math.cos(a) * (TERRACE.r1 - 0.5), z = -Math.sin(a) * (TERRACE.r1 - 0.5);
        if (Math.abs(x) < RIDGE.half + 0.6 && z > 0) continue;
        B.box(M.stone, x, TERRACE.y + 0.35, z, 1.25, 0.7, 0.6, '#ffffff', [0, a + Math.PI / 2, 0]);
        if (i % 10 === 0) { B.box(M.stone, x, TERRACE.y + 0.75, z, 0.7, 1.5, 0.7); }
        if (i % 2 === 0) circles.push([x, z, 0.6, TERRACE.y + 1.2]);
      }
      // cliff below plaza edge where there are no stairs (keeps walkers from stepping off the plaza)
      // (handled by the parapet circles above)
    }

    // ---------------- ridge path ----------------
    {
      const th = Math.atan(RIDGE.slope);
      for (let z = RIDGE.z0 - 2; z < RIDGE.z1; z += 2) {
        const zc = z + 1, y = (z + 1 <= RIDGE.z0 ? RIDGE.y0 : ridgeY(zc)) + 0.1;
        B.box(M.slate, 0, y - 0.5, zc, RIDGE.half * 2, 1, 2.08, '#ffffff', zc > RIDGE.z0 ? [th, 0, 0] : null);
      }
      for (let z = RIDGE.z0 + 6, i = 0; z < RIDGE.z1; z += 12, i++) lantern((i % 2 ? 1 : -1) * (RIDGE.half + 0.7), z, 0.9);
      // prayer-flag style ribbon lines along the ridge
      for (let z = RIDGE.z0 + 6; z < RIDGE.z1 - 12; z += 24) ribbonLine([-RIDGE.half - 0.7, z], [RIDGE.half + 0.7, z + 12], 2.6);
    }

    // ---------------- lanterns (warm) ----------------
    function lantern(x, z, s = 1) {
      const y0 = groundHeight(x, z);
      B.box(M.iron, x, y0 + 1.2 * s, z, 0.14 * s, 2.4 * s, 0.14 * s);
      B.box(M.iron, x, y0 + 2.55 * s, z, 0.5 * s, 0.1 * s, 0.5 * s);
      G.box(glow, x, y0 + 2.3 * s, z, 0.34 * s, 0.4 * s, 0.34 * s, hdr(WARM, 3.2));
      pool(x, z, 3.2 * s, WARM, 0.35);
      circles.push([x, z, 0.25, y0 + 3]);
    }

    // ---------------- wind ribbons + flags (CPU-waved, cheap) ----------------
    function flag(x, y, z, yaw, w, h, color, segs = 12) {
      const g = new THREE.PlaneGeometry(w, h, segs, 2); g.translate(w / 2, 0, 0);
      const m = new THREE.Mesh(g, M.flag.clone()); m.material.color.set(color);
      m.material.emissive = new THREE.Color(color); m.material.emissiveIntensity = 0.12;
      m.position.set(x, y, z); m.rotation.y = yaw; m.castShadow = true; scene.add(m);
      flags.push({ g, base: Float32Array.from(g.attributes.position.array), w, ph: R() * 10 });
    }
    function ribbonLine([ax, az], [bx, bz], hgt) {
      const ya = groundHeight(ax, az), yb = groundHeight(bx, bz);
      B.box(M.wood, ax, ya + hgt / 2, az, 0.15, hgt, 0.15); B.box(M.wood, bx, yb + hgt / 2, bz, 0.15, hgt, 0.15);
      const n = 7, yaw = Math.atan2(-(bz - az), bx - ax);
      for (let i = 0; i < n; i++) {
        const u = (i + 0.5) / n, x = ax + (bx - ax) * u, z = az + (bz - az) * u, y = ya + (yb - ya) * u + hgt - 0.35 - Math.sin(u * Math.PI) * 0.5;
        flag(x, y, z, yaw + Math.PI / 2, 0.55, 0.5, FLAG_COLS[i % FLAG_COLS.length], 4);
      }
    }
    // tall pennant poles around the terrace
    for (let i = 0; i < 10; i++) {
      const a = (i + 0.5) / 10 * Math.PI * 2, r = TERRACE.r1 - 1.6, x = Math.cos(a) * r, z = -Math.sin(a) * r;
      if (Math.abs(x) < 6 && z > 0) continue;
      const y0 = TERRACE.y; B.box(M.iron, x, y0 + 3.5, z, 0.16, 7, 0.16); G.box(glowCold, x, y0 + 7.1, z, 0.25, 0.25, 0.25, hdr(COLD, 3), [0.7, 0.7, 0]);
      flag(x, y0 + 6.2, z, 0, 3.2, 0.9, FLAG_COLS[i % FLAG_COLS.length]);
      flag(x, y0 + 5.0, z, 0, 2.2, 0.35, FLAG_COLS[(i + 3) % FLAG_COLS.length], 10);
      circles.push([x, z, 0.3, y0 + 8]);
    }

    // ---------------- wind chimes ----------------
    const chimes = [];
    function chime(x, y, z) {
      const grp = new THREE.Group(); grp.position.set(x, y, z); scene.add(grp);
      const top = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.06, 12), M.brass); grp.add(top);
      for (let k = 0; k < 6; k++) {
        const a = k / 6 * Math.PI * 2, len = 0.5 + k * 0.12;
        const piv = new THREE.Group(); piv.position.set(Math.cos(a) * 0.26, -0.05, Math.sin(a) * 0.26); grp.add(piv);
        const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, len, 6), M.crystal); rod.position.y = -0.2 - len / 2; piv.add(rod);
        const tip = new THREE.Mesh(OCT, glowCold); tip.scale.setScalar(0.09); tip.position.y = -0.22 - len; piv.add(tip);
        chimes.push({ piv, ph: R() * 6.28, k });
      }
    }

    // ---------------- glass dome ----------------
    {
      const { x: cx, z: cz, r, wall } = DOME, y0 = PLAZA.y;
      const seg = 48;
      for (let i = 0; i < seg; i++) {
        const a = (i + 0.5) / seg * Math.PI * 2, x = cx + Math.cos(a) * r, z = cz - Math.sin(a) * r;
        if (Math.abs(x - cx) < DOME.door && z > cz) continue;                     // door gap (+z)
        B.box(M.stone, x, y0 + wall / 2, z, 1.5, wall, 0.8, '#ffffff', [0, a + Math.PI / 2, 0]);
        circles.push([x, z, 0.6, y0 + 6]);
      }
      // glass hemisphere + iron ribs + latitude rings
      const dome = new THREE.Mesh(new THREE.SphereGeometry(r, 64, 20, 0, Math.PI * 2, 0, Math.PI / 2), M.glass);
      dome.position.set(cx, y0 + wall, cz); dome.renderOrder = 3; scene.add(dome);
      for (let k = 0; k < 16; k++) {
        const az = k / 16 * Math.PI * 2;
        for (let j = 0; j < 14; j++) {
          const e = (j + 0.5) / 14 * Math.PI / 2, rr = Math.cos(e) * r, y = Math.sin(e) * r;
          B.box(M.iron, cx + Math.cos(az) * rr, y0 + wall + y, cz - Math.sin(az) * rr, 0.16, r * Math.PI / 2 / 14 + 0.05, 0.16, '#ffffff', [0, az, e]);
        }
      }
      for (const e of [0.35, 0.75, 1.15]) {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(Math.cos(e) * r, 0.09, 6, 96), M.iron);
        ring.rotation.x = Math.PI / 2; ring.position.set(cx, y0 + wall + Math.sin(e) * r, cz); scene.add(ring);
      }
      // brass finial with crystal + ribbon streamers
      B.box(M.brass, cx, y0 + wall + r + 0.5, cz, 0.5, 1.0, 0.5);
      G.add(glowCold, OCT, cx, y0 + wall + r + 1.6, cz, 1.1, 1.6, 1.1, hdr('#bff4ff', 3.5));
      for (let k = 0; k < 4; k++) flag(cx, y0 + wall + r + 0.8, cz, k * Math.PI / 2, 4.5, 0.28, FLAG_COLS[k], 14);
      // door arch (warm glow spilling out)
      for (const s of [-1, 1]) B.box(M.stone, cx + s * (DOME.door + 0.3), y0 + 1.9, cz + r, 0.7, 3.8, 1.1);
      B.box(M.stone, cx, y0 + 4.0, cz + r, DOME.door * 2 + 1.3, 0.6, 1.1);
      G.box(glow, cx, y0 + 3.5, cz + r + 0.56, DOME.door * 2 - 0.3, 0.12, 0.05, hdr(WARM, 2.5));
      pool(cx, cz + r + 2.5, 5, WARM, 0.45);
      // constellation mosaic floor
      const floorMat = constellationMaterial(R);
      const floor = new THREE.Mesh(new THREE.CircleGeometry(r - 0.4, 96).rotateX(-Math.PI / 2), floorMat);
      floor.position.set(cx, y0 + 0.03, cz); scene.add(floor);
      animated.push((t) => { floorMat.uniforms.uTime.value = t; floorMat.uniforms.uNight.value = look.night; });
      // interior warm lamps on brass posts
      for (let i = 0; i < 8; i++) {
        const a = (i + 0.5) / 8 * Math.PI * 2, x = cx + Math.cos(a) * (r - 1.4), z = cz - Math.sin(a) * (r - 1.4);
        if (Math.abs(x - cx) < 3 && z > cz) continue;
        B.box(M.brass, x, y0 + 0.9, z, 0.12, 1.8, 0.12);
        G.add(glow, new THREE.SphereGeometry(0.5, 12, 8), x, y0 + 1.95, z, 0.45, 0.45, 0.45, hdr(WARM, 3.5));
      }
      // big crystal telescope on a brass mount, aimed up through the glass to the north-west
      const scope = new THREE.Group(); scope.position.set(cx, y0, cz - 1); scene.add(scope);
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.3, 1.6, 16), M.brass); base.position.y = 0.8; base.castShadow = true; scope.add(base);
      const yoke = new THREE.Group(); yoke.position.y = 2.1; scope.add(yoke);
      const tilt = new THREE.Group(); tilt.rotation.x = -0.75; yoke.add(tilt);
      const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.85, 6.5, 20, 1, true), M.crystal); tube.rotation.x = Math.PI / 2; tube.position.z = -1.2; tilt.add(tube);
      for (const zz of [-4.3, -2.2, 0.4, 1.8]) { const band = new THREE.Mesh(new THREE.TorusGeometry(zz < -4 ? 0.58 : 0.75, 0.07, 8, 32), M.brass); band.position.z = zz; tilt.add(band); }
      const lens = new THREE.Mesh(new THREE.CircleGeometry(0.55, 32), glowCold); lens.position.z = -4.45; lens.rotation.y = Math.PI; tilt.add(lens);
      const eye = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, 0.8, 10), M.brass); eye.rotation.x = Math.PI / 2; eye.position.z = 2.3; tilt.add(eye);
      const core = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 6, 8), glowCold); core.rotation.x = Math.PI / 2; core.position.z = -1.2; tilt.add(core);
      animated.push((t) => { yoke.rotation.y = 0.6 + Math.sin(t * 0.07) * 0.35; });
      circles.push([cx, cz - 1, 1.4, y0 + 8]);
      // floating crystal lenses orbiting the telescope
      for (let i = 0; i < 6; i++) {
        const lg = new THREE.Group(); scene.add(lg);
        const ringM = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.05, 8, 32), M.brass); lg.add(ringM);
        const disc = new THREE.Mesh(new THREE.CircleGeometry(0.42, 24), M.crystal); disc.material = M.crystal; lg.add(disc);
        const sp = new THREE.Mesh(OCT, glowCold); sp.scale.setScalar(0.12); lg.add(sp);
        const a0 = i / 6 * Math.PI * 2, rad = 3.6 + (i % 2) * 1.2, hy = 3.2 + (i % 3) * 0.9;
        animated.push((t) => { const a = a0 + t * 0.12; lg.position.set(cx + Math.cos(a) * rad, y0 + hy + Math.sin(t * 0.8 + i) * 0.25, cz - 1 - Math.sin(a) * rad); lg.lookAt(cx, y0 + 4, cz - 1); lg.rotateY(Math.sin(t * 0.5 + i) * 0.6); });
      }
      // a few chimes hanging inside the door arch and from the dome ring
      chime(cx - 1.4, y0 + 3.3, cz + r + 0.3); chime(cx + 1.4, y0 + 3.3, cz + r + 0.3);
    }

    // ---------------- courtyard: star-map pedestal ----------------
    {
      const { x, z, r } = COURTYARD, y0 = PLAZA.y;
      const ringFloor = new THREE.Mesh(new THREE.RingGeometry(r - 0.6, r, 64).rotateX(-Math.PI / 2), glowCold); ringFloor.position.set(x, y0 + 0.04, z); scene.add(ringFloor);
      B.add(M.stone, CYL, x, y0 + 0.2, z, 4, 0.4, 4);
      B.add(M.stone, CYL, x, y0 + 0.9, z, 1.4, 1.4, 1.4);
      B.add(M.brass, CYL, x, y0 + 1.68, z, 2.4, 0.16, 2.4);
      const mapMat = constellationMaterial(rng(77));
      const disc = new THREE.Mesh(new THREE.CircleGeometry(1.1, 48).rotateX(-Math.PI / 2), mapMat); disc.position.set(x, y0 + 1.77, z); scene.add(disc);
      animated.push((t) => { mapMat.uniforms.uTime.value = t; disc.rotation.y = t * 0.05; });
      // armillary rings floating above the pedestal
      const arm = new THREE.Group(); arm.position.set(x, y0 + 3.2, z); scene.add(arm);
      const rings = [1.3, 1.05, 0.8].map((rr, i) => { const m = new THREE.Mesh(new THREE.TorusGeometry(rr, 0.04, 8, 64), i === 1 ? glow : glowCold); arm.add(m); return m; });
      const orb = new THREE.Mesh(new THREE.IcosahedronGeometry(0.28, 1), glow); arm.add(orb);
      animated.push((t) => { rings[0].rotation.set(t * 0.3, 0, 0.4); rings[1].rotation.set(0.9, t * 0.45, 0); rings[2].rotation.set(t * 0.2, t * 0.6, 1.1); orb.scale.setScalar(1 + 0.08 * Math.sin(t * 2)); arm.position.y = y0 + 3.2 + Math.sin(t * 0.7) * 0.12; });
      pool(x, z, 6, COLD, 0.3);
      circles.push([x, z, 2.1, y0 + 6]);
      // benches + braziers around the courtyard
      for (const s of [-1, 1]) {
        B.box(M.wood, x + s * 5, y0 + 0.45, z, 0.8, 0.12, 3); B.box(M.iron, x + s * 5, y0 + 0.2, z - 1.2, 0.6, 0.4, 0.15); B.box(M.iron, x + s * 5, y0 + 0.2, z + 1.2, 0.6, 0.4, 0.15);
        colliders.push([x + s * 5 - 0.4, y0, z - 1.5, x + s * 5 + 0.4, y0 + 0.55, z + 1.5]);
        B.add(M.iron, CYL, x + s * 3.5, y0 + 0.5, z + 4.5, 0.9, 1.0, 0.9);
        G.add(glow, CONE, x + s * 3.5, y0 + 1.3, z + 4.5, 0.7, 0.9, 0.7, hdr('#ff9a3c', 3.5));
        pool(x + s * 3.5, z + 4.5, 4, WARM, 0.45);
        circles.push([x + s * 3.5, z + 4.5, 0.6, y0 + 2]);
      }
      // plaza lanterns ring
      for (let i = 0; i < 10; i++) { const a = (i + 0.5) / 10 * Math.PI * 2, rr = PLAZA.r - 2.2; const lx = Math.cos(a) * rr, lz = -Math.sin(a) * rr;
        if (Math.hypot(lx - DOME.x, lz - DOME.z) < DOME.r + 1.5) continue; lantern(lx, lz, 1); }
    }

    // ---------------- terrace props: brass telescopes, chimes, crystal clusters ----------------
    {
      const scopes = [[0.15, 28.5], [-0.2, 28.5], [Math.PI - 0.2, 28.5], [Math.PI + 0.25, 28.5], [Math.PI / 2 + 0.3, 28.5]];
      for (const [a, r] of scopes) {
        const x = Math.cos(a) * r, z = -Math.sin(a) * r, y0 = TERRACE.y, yaw = a;
        for (let k = 0; k < 3; k++) { const la = k / 3 * Math.PI * 2; B.box(M.wood, x + Math.cos(la) * 0.35, y0 + 0.65, z + Math.sin(la) * 0.35, 0.07, 1.4, 0.07, '#ffffff', [Math.sin(la) * 0.25, 0, -Math.cos(la) * 0.25]); }
        const g = new THREE.Group(); g.position.set(x, y0 + 1.4, z); g.rotation.y = yaw - Math.PI / 2; scene.add(g);
        const tb = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.17, 1.6, 12), M.brass); tb.rotation.x = Math.PI / 2 - 0.45; tb.castShadow = true; g.add(tb);
        const ln = new THREE.Mesh(new THREE.CircleGeometry(0.12, 16), glowCold); ln.position.set(0, 0.35, -0.72); ln.rotation.x = 0.45; ln.rotation.y = Math.PI; g.add(ln);
        circles.push([x, z, 0.5, y0 + 2]);
      }
      // crystal clusters on the terrace (cold blue against the warm lanterns)
      for (let i = 0; i < 14; i++) {
        const a = R() * Math.PI * 2, r = 30 + R() * 1.6, x = Math.cos(a) * r, z = -Math.sin(a) * r;
        if (Math.abs(x) < 5 && z > 0) continue;
        if (STAIRS.some((s) => Math.abs(Math.atan2(Math.sin(a - s.a), Math.cos(a - s.a))) < 0.18)) continue;
        for (let k = 0; k < 4; k++) { const h = 0.6 + R() * 1.6; G.add(glowCold, new THREE.ConeGeometry(0.25, 1, 5), x + (R() - 0.5), TERRACE.y + h / 2, z + (R() - 0.5), 0.8, h, 0.8, hdr(['#7fe3ff', '#b49bff', '#9fffe8'][k % 3], 1.9), [R() * 0.4, R() * 3, R() * 0.4]); }
        pool(x, z, 2.5, COLD, 0.2);
      }
      // chimes on short posts near the overlooks
      for (const [a, r] of [[0.05, 31], [Math.PI - 0.05, 31], [Math.PI / 2, 31]]) {
        const x = Math.cos(a) * r, z = -Math.sin(a) * r; B.box(M.iron, x, TERRACE.y + 1.5, z, 0.12, 3, 0.12); B.box(M.iron, x - 0.4, TERRACE.y + 2.95, z, 0.9, 0.08, 0.08);
        chime(x - 0.75, TERRACE.y + 2.85, z); circles.push([x, z, 0.3, TERRACE.y + 3]);
      }
      // terrace lanterns
      for (let i = 0; i < 16; i++) { const a = (i + 0.25) / 16 * Math.PI * 2, rr = TERRACE.r1 - 1.0, lx = Math.cos(a) * rr, lz = -Math.sin(a) * rr; if (Math.abs(lx) < 5 && lz > 0) continue; lantern(lx, lz, 0.85); }
    }

    // ---------------- real lights (few) ----------------
    const domeLight = new THREE.PointLight(WARM, 45, 24, 1.6); domeLight.position.set(DOME.x, PLAZA.y + 5, DOME.z); scene.add(domeLight);
    const doorLight = new THREE.PointLight(WARM, 60, 14, 1.8); doorLight.position.set(DOME.x, PLAZA.y + 2.5, DOME.z + DOME.r + 1.5); scene.add(doorLight);
    const mapLight = new THREE.PointLight(COLD, 40, 12, 1.8); mapLight.position.set(COURTYARD.x, PLAZA.y + 3.5, COURTYARD.z); scene.add(mapLight);

    // ---------------- meteors (camera-facing streak quads, deterministic) ----------------
    const METEORS = 22;
    const meteor = (() => {
      const g = new THREE.BufferGeometry();
      const pos = new Float32Array(METEORS * 4 * 3), col = new Float32Array(METEORS * 4 * 3), idx = [];
      for (let i = 0; i < METEORS; i++) { const a = i * 4; idx.push(a, a + 1, a + 2, a + 2, a + 1, a + 3); }
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.setIndex(idx);
      const mat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, fog: false, side: THREE.DoubleSide });
      const mesh = new THREE.Mesh(g, mat); mesh.frustumCulled = false; mesh.renderOrder = 1; scene.add(mesh);
      const defs = Array.from({ length: METEORS }, () => {
        const az = (R() - 0.5) * Math.PI * 1.6 - Math.PI / 2, el = 0.35 + R() * 0.75;   // mostly north (-z) sky
        const start = new THREE.Vector3(Math.cos(az) * Math.cos(el), Math.sin(el), Math.sin(az) * Math.cos(el)).multiplyScalar(420);
        const dir = new THREE.Vector3((R() - 0.5) * 2, -0.6 - R() * 0.6, (R() - 0.5) * 0.6).normalize();
        return { start, dir, period: 3 + R() * 6, off: R() * 10, len: 30 + R() * 50, speed: 140 + R() * 120, hue: R() < 0.7 ? '#fff4d6' : (R() < 0.5 ? '#9fe6ff' : '#ffb0e0') };
      });
      const hd = new THREE.Vector3(), tl = new THREE.Vector3(), side = new THREE.Vector3(), view = new THREE.Vector3(), c = new THREE.Color();
      return {
        mat,
        update(t, camera) {
          const cam = camera ? camera.position : new THREE.Vector3(0, 40, 0);
          defs.forEach((d, i) => {
            const u = ((t + d.off) % d.period) / d.period, life = 0.32, k = u < life ? u / life : -1;
            const a = i * 12;
            if (k < 0) { for (let q = 0; q < 12; q++) pos[a + q] = 0; for (let q = 0; q < 12; q++) col[a + q] = 0; return; }
            const travel = k * d.period * life * d.speed;
            hd.copy(d.start).addScaledVector(d.dir, travel).add(cam);
            tl.copy(hd).addScaledVector(d.dir, -Math.min(d.len, travel + 4));
            view.copy(hd).sub(cam).normalize(); side.copy(d.dir).cross(view).normalize().multiplyScalar(0.9);
            const fade = Math.sin(Math.PI * k) * 2.6 * look.night * (1 - look.storm);
            c.set(d.hue);
            const P4 = [[hd, 1], [hd, -1], [tl, 1], [tl, -1]];
            P4.forEach(([p, s], j) => {
              const w = j < 2 ? 1 : 0.15; pos[a + j * 3] = p.x + side.x * s * w; pos[a + j * 3 + 1] = p.y + side.y * s * w; pos[a + j * 3 + 2] = p.z + side.z * s * w;
              const b = j < 2 ? fade * 1.6 : 0; col[a + j * 3] = c.r * b; col[a + j * 3 + 1] = c.g * b; col[a + j * 3 + 2] = c.b * b;
            });
          });
          g.attributes.position.needsUpdate = true; g.attributes.color.needsUpdate = true;
        },
      };
    })();

    // ---------------- drifting star-sparkles around the summit ----------------
    const sparkles = (() => {
      const n = 900, g = new THREE.BufferGeometry(), p = new Float32Array(n * 3), s = new Float32Array(n);
      for (let i = 0; i < n; i++) { const a = R() * Math.PI * 2, r = Math.sqrt(R()) * 36; p.set([Math.cos(a) * r, PLAZA.y + R() * 18, Math.sin(a) * r], i * 3); s[i] = R(); }
      g.setAttribute('position', new THREE.BufferAttribute(p, 3)); g.setAttribute('aPhase', new THREE.BufferAttribute(s, 1));
      const mat = new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
        uniforms: { uTime: { value: 0 }, uNight: { value: 1 }, uWind: { value: 1 } },
        vertexShader: `attribute float aPhase; uniform float uTime, uWind; varying float vA; varying float vH;
          void main(){ float t = fract(aPhase * 7.0 + uTime * 0.025); vec3 p = position; p.y -= t * 18.0; p.x += sin(uTime * 0.4 + aPhase * 40.0) * 1.2 * uWind; p.z += cos(uTime * 0.3 + aPhase * 30.0) * 1.2;
            vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv;
            vA = smoothstep(0.0, 0.1, t) * smoothstep(1.0, 0.8, t) * (0.5 + 0.5 * sin(uTime * 3.0 + aPhase * 60.0)); vH = aPhase;
            gl_PointSize = min(7.0, (1.5 + 2.5 * fract(aPhase * 13.0)) * 300.0 / -mv.z); }`,
        fragmentShader: `uniform float uNight; varying float vA; varying float vH;
          void main(){ float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.0, d) * vA * uNight; if (a < 0.01) discard;
            vec3 c = mix(vec3(1.0, 0.85, 0.5), vec3(0.55, 0.85, 1.0), step(0.5, fract(vH * 5.0))); gl_FragColor = vec4(c * 2.2 * a, a); }`,
      });
      const pts = new THREE.Points(g, mat); pts.frustumCulled = false; scene.add(pts);
      return mat;
    })();

    // ---------------- build batches ----------------
    B.build(scene);
    G.build(scene, { cast: false, receive: false });
    P.build(scene, { cast: false, receive: false }).forEach((m) => { m.renderOrder = 2; });

    // ---------------- day / night + weather ----------------
    const look = { night: 1, weather: 0.35, storm: 0 };
    const NIGHT = { fog: C('#12213e'), hemiSky: C('#4a68a6'), hemiGround: C('#121a2e'), hemiI: 0.75, key: C('#a8c0ff'), keyI: 1.1, exposure: 1.05, glow: 1, pool: 1 };
    const DAY = { fog: C('#d9e9f8'), hemiSky: C('#dff0ff'), hemiGround: C('#a4b8cc'), hemiI: 1.25, key: C('#fff1de'), keyI: 2.6, exposure: 0.95, glow: 0.25, pool: 0 };
    const STORM = { night: C('#56698a'), day: C('#d5e0ec') };
    const tmp = new THREE.Color();
    function applyLook() {
      const n = look.night, w = look.weather, storm = THREE.MathUtils.smoothstep(w, 0.55, 1.0); look.storm = storm;
      scene.fog.color.copy(tmp.copy(DAY.fog).lerp(NIGHT.fog, n)).lerp(STORM.day.clone().lerp(STORM.night, n), storm);
      scene.fog.density = THREE.MathUtils.lerp(0.0016, 0.0022, n) + storm * storm * 0.024 + w * 0.0015;
      sky.uniforms.uNight.value = n; sky.uniforms.uStorm.value = storm * 0.95; sky.uniforms.uStormColor.value.copy(scene.fog.color);
      hemi.color.copy(DAY.hemiSky).lerp(NIGHT.hemiSky, n); hemi.groundColor.copy(DAY.hemiGround).lerp(NIGHT.hemiGround, n);
      hemi.intensity = THREE.MathUtils.lerp(DAY.hemiI, NIGHT.hemiI, n) * (1 + storm * 0.25);
      key.color.copy(DAY.key).lerp(NIGHT.key, n); key.intensity = THREE.MathUtils.lerp(DAY.keyI, NIGHT.keyI, n) * (1 - storm * 0.7);
      key.position.copy(key.target.position).addScaledVector(SUN_DIR.clone().lerp(MOON_DIR, n).normalize(), 400);
      renderer.toneMappingExposure = THREE.MathUtils.lerp(DAY.exposure, NIGHT.exposure, n);
      glowCold.color.setScalar(THREE.MathUtils.lerp(0.35, 1, n));
      poolMat.color.setScalar(THREE.MathUtils.lerp(DAY.pool, NIGHT.pool, n));
      domeLight.intensity = 45 * (0.3 + 0.7 * n); doorLight.intensity = 60 * n; mapLight.intensity = 40 * n;
      sparkles.uniforms.uNight.value = n * (1 - storm * 0.7);
    }
    applyLook();

    return {
      scene,
      shots: SHOTS,
      spawn: { pos: [ANCHORS.spawn.x, groundHeight(ANCHORS.spawn.x, ANCHORS.spawn.z) + 0.1, ANCHORS.spawn.z], facing: ANCHORS.spawn.facing },
      walkBounds: { type: 'box', minX: -36, maxX: 36, minZ: -36, maxZ: 150 },
      groundHeight,
      layout: { PLAZA, TERRACE, DOME, COURTYARD, RIDGE, STAIRS, ANCHORS },
      addColliders(col) { colliders.forEach((b) => col.addBox(...b)); circles.forEach(([x, z, r, top]) => col.addCircle(x, z, r, top)); },
      setNight(v) { if (v !== look.night) { look.night = v; applyLook(); } },
      setWeather(v) { if (v !== look.weather) { look.weather = v; applyLook(); } },
      wind: (w) => ({ speed: 2.0 + w * 10, wind: [0.8 + w * w * 16, 0.3 + w * 3] }),
      avatarColors: { skin: '#f1c9a5', shirt: '#6a4fc4', pants: '#24324a' },
      bloom: (n, w) => ({ strength: THREE.MathUtils.lerp(0.25, 0.6, n) * (1 - 0.3 * w), radius: 0.4, threshold: THREE.MathUtils.lerp(1.6, 0.95, n) }),
      update(dt, t, camera) {
        sky.uniforms.uTime.value = t;
        animated.forEach((f) => f(t, dt, camera));
        const windK = 1 + look.weather * 2.5;
        for (const f of flags) {
          const a = f.g.attributes.position.array, b = f.base;
          for (let i = 0; i < a.length; i += 3) { const u = b[i] / f.w; a[i + 2] = b[i + 2] + Math.sin(u * 5 - t * 4 * windK + f.ph) * u * 0.28 * windK; a[i + 1] = b[i + 1] + Math.sin(u * 3 - t * 3 * windK + f.ph) * u * 0.08; }
          f.g.attributes.position.needsUpdate = true;
        }
        for (const c of chimes) { c.piv.rotation.z = Math.sin(t * (1.6 + c.k * 0.13) + c.ph) * 0.12 * windK; c.piv.rotation.x = Math.cos(t * 1.3 + c.ph) * 0.08 * windK; }
        meteor.update(t, camera);
        sparkles.uniforms.uTime.value = t; sparkles.uniforms.uWind.value = windK;
        glow.color.setScalar(THREE.MathUtils.lerp(DAY.glow, NIGHT.glow, look.night) * (0.96 + 0.04 * Math.sin(t * 11.0) * Math.sin(t * 6.7)));
      },
    };
  },
};
