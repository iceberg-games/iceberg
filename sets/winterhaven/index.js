// Winterhaven: blocky snowy village in a valley at night. Filming set for the winter event trailer.
// Everything here is procedural Three.js geometry + canvas textures (Iceberg original, no external assets).
import * as THREE from 'three';
import { Reflector } from 'three/examples/jsm/objects/Reflector.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Batch, glowMaterial, worldPattern, rng } from '../lib/blocks.js';
import { createSky } from '../lib/sky.js';
import { SQUARE, STREET, LAKE, CASTLE, CREEK, BRIDGES, CASTLE_PATH, TRAILS, MARKET, PORTAL, CAVE, AREAS, ANCHORS, height, groundHeight, cabins, inLake, distToPolyline, distToTrail, fbm } from './layout.js';
import { SHOTS } from './shots.js';

const C = (hex) => new THREE.Color(hex);
const hdr = (hex, k) => { const c = new THREE.Color(hex).multiplyScalar(k); return [c.r, c.g, c.b]; };
const WARM = '#ffb057', CANDLE = '#ffd27a';
const BULBS = ['#ffcf73', '#ff6a5c', '#7fe3ff', '#ffe9b8', '#9dff9a', '#ffcf73', '#ff9bd0'];

function canvasTex(size, draw, repeat = 1) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat, repeat); t.anisotropy = 8;
  return t;
}
function radialTex() {
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

export default {
  id: 'winterhaven',
  name: 'Winterhaven',
  async create({ renderer, camera }) {
    const R = rng(2026);
    const scene = new THREE.Scene();
    const B = new Batch();          // shadowed solids
    const G = new Batch();          // glow (unlit HDR)
    const P = new Batch();          // light pools on the snow (additive)
    const animated = [];            // { update(t) }

    // ---------------- materials ----------------
    const M = {
      snow: new THREE.MeshStandardMaterial({ color: '#f3f8ff', roughness: 0.92, flatShading: true }),
      logs: worldPattern(new THREE.MeshStandardMaterial({ color: '#8a5a36', roughness: 0.85 }),
        `float y = vWP.y * 1.55; float f = fract(y); float seam = smoothstep(0.0, 0.12, f) * smoothstep(1.0, 0.85, f);
         float grain = 0.88 + 0.12 * n2(vec2((vWP.x + vWP.z) * 1.7, floor(y) * 7.0));
         return mix(0.45, 1.0, seam) * grain * (0.9 + 0.2 * h21(vec2(floor(y), 3.0)));`),
      wood: new THREE.MeshStandardMaterial({ color: '#5a3a24', roughness: 0.8 }),
      stone: worldPattern(new THREE.MeshStandardMaterial({ color: '#8d99ab', roughness: 0.9 }),
        `vec2 p = (abs(vWN.y) > 0.5 ? vWP.xz : vec2(vWP.x + vWP.z, vWP.y)) * vec2(1.4, 2.2);
         p.x += step(1.0, mod(floor(p.y), 2.0)) * 0.5; vec2 f = fract(p);
         float m = smoothstep(0.0, 0.08, f.x) * smoothstep(1.0, 0.92, f.x) * smoothstep(0.0, 0.1, f.y) * smoothstep(1.0, 0.9, f.y);
         return mix(0.55, 1.0, m) * (0.85 + 0.25 * h21(floor(p)));`),
      cobble: worldPattern(new THREE.MeshStandardMaterial({ color: '#a7b4c6', roughness: 0.75 }),
        `vec2 p = vWP.xz * 0.9; p.x += step(1.0, mod(floor(p.y), 2.0)) * 0.5; vec2 f = fract(p);
         float m = smoothstep(0.0, 0.1, f.x) * smoothstep(1.0, 0.9, f.x) * smoothstep(0.0, 0.1, f.y) * smoothstep(1.0, 0.9, f.y);
         float snow = smoothstep(0.45, 0.75, n2(vWP.xz * 0.35));
         return mix(mix(0.6, 1.0, m) * (0.85 + 0.2 * h21(floor(p))), 1.25, snow);`),
      road: worldPattern(new THREE.MeshStandardMaterial({ color: '#c9d6e6', roughness: 0.85 }),
        `float t = n2(vWP.xz * vec2(0.6, 0.15)); float tracks = smoothstep(0.35, 0.0, abs(abs(vWP.x) - 1.8)) * 0.18;
         return 0.92 + 0.12 * t - tracks;`),
      pine: new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.8, flatShading: true, vertexColors: true }),
      ice: worldPattern(new THREE.MeshStandardMaterial({ color: '#a8dcff', roughness: 0.12, metalness: 0.05, emissive: '#1d5d93', emissiveIntensity: 0.32, flatShading: true }),
        `vec2 p = vec2(vWP.x + vWP.z, vWP.y) * vec2(0.5, 0.9); if (abs(vWN.y) > 0.5) p = vWP.xz * 0.5;
         p.x += step(1.0, mod(floor(p.y), 2.0)) * 0.5; vec2 f = fract(p);
         float m = smoothstep(0.0, 0.04, f.x) * smoothstep(1.0, 0.96, f.x) * smoothstep(0.0, 0.06, f.y) * smoothstep(1.0, 0.94, f.y);
         return mix(0.7, 1.0, m) * (0.9 + 0.2 * h21(floor(p)));`),
      iceClear: new THREE.MeshStandardMaterial({ color: '#bfe8ff', roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.72, emissive: '#2a7fc4', emissiveIntensity: 0.22 }),
      iron: new THREE.MeshStandardMaterial({ color: '#2a2f3a', roughness: 0.5, metalness: 0.6 }),
      white: new THREE.MeshStandardMaterial({ color: '#f6faff', roughness: 0.9, flatShading: true }),
      coal: new THREE.MeshStandardMaterial({ color: '#15161a', roughness: 0.6 }),
      carrot: new THREE.MeshStandardMaterial({ color: '#ff8a2b', roughness: 0.6 }),
      fabric: new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.9 }),
      rock: new THREE.MeshStandardMaterial({ color: '#6b7a90', roughness: 0.9, flatShading: true }),
    };
    M.iceClear.userData.noShadow = true;
    const glow = glowMaterial();                                 // windows, lanterns, bulbs
    const glowCold = glowMaterial();                             // castle light, bridges (separate level)
    const twinkle = [0, 1, 2].map(() => glowMaterial());        // tree / string lights twinkle in 3 phases
    const poolMat = new THREE.MeshBasicMaterial({ map: radialTex(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -2 });
    poolMat.userData.noShadow = true;
    const POOL = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    const pool = (x, z, r, hex, k) => P.add(poolMat, POOL, x, height(x, z) + 0.06, z, r * 2, 1, r * 2, hdr(hex, k));

    // ---------------- sky, fog, lights ----------------
    const sky = createSky(); scene.add(sky.mesh);
    scene.fog = new THREE.FogExp2('#1b2e4d', 0.003);
    const hemi = new THREE.HemisphereLight('#4a6aa0', '#18223a', 0.9); scene.add(hemi);
    const key = new THREE.DirectionalLight('#a9c2ff', 1.2);
    key.castShadow = true; key.shadow.mapSize.set(4096, 4096);
    Object.assign(key.shadow.camera, { left: -170, right: 170, top: 170, bottom: -170, near: 10, far: 700 });
    key.shadow.bias = -0.0004; key.shadow.normalBias = 0.05;
    key.target.position.set(10, 0, -40);
    scene.add(key, key.target);
    const MOON_DIR = sky.uniforms.uMoonDir.value, SUN_DIR = sky.uniforms.uSunDir.value;

    // ---------------- terrain ----------------
    {
      const S = 1700, N = 280;
      const geo = new THREE.PlaneGeometry(S, S, N, N).rotateX(-Math.PI / 2);
      const pos = geo.attributes.position, col = new Float32Array(pos.count * 3);
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i), z = pos.getZ(i);
        pos.setY(i, height(x, z));
      }
      geo.computeVertexNormals();
      const nrm = geo.attributes.normal, c = new THREE.Color();
      for (let i = 0; i < pos.count; i++) {
        const y = pos.getY(i), ny = nrm.getY(i), x = pos.getX(i), z = pos.getZ(i);
        const rock = THREE.MathUtils.smoothstep(0.86, 0.7, ny) * THREE.MathUtils.smoothstep(15, 40, y);
        c.set('#f2f7ff').lerp(C('#dbe7f7'), fbm(x * 0.05, z * 0.05) * 0.6).lerp(C('#5f6f88'), rock * 0.85);
        col.set([c.r, c.g, c.b], i * 3);
      }
      geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
      const terrain = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.93, flatShading: true }));
      terrain.receiveShadow = true; terrain.castShadow = true; terrain.name = 'terrain';
      scene.add(terrain);
    }

    // ---------------- ribbons (street, castle path, creek) ----------------
    function ribbon(pts, width, mat, yOff = 0.04, step = 2) {
      const curve = new THREE.CatmullRomCurve3(pts.map(([x, z]) => new THREE.Vector3(x, 0, z)));
      const n = Math.ceil(curve.getLength() / step), verts = [], idx = [], uv = [];
      for (let i = 0; i <= n; i++) {
        const u = i / n, p = curve.getPointAt(u), t = curve.getTangentAt(u);
        const nx = -t.z, nz = t.x;
        for (const s of [-1, 1]) {
          const x = p.x + nx * s * width / 2, z = p.z + nz * s * width / 2;
          verts.push(x, Math.max(height(x, z), height(p.x, p.z)) + yOff, z); uv.push(s * 0.5 + 0.5, u * n);
        }
        if (i < n) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      g.setIndex(idx); g.computeVertexNormals();
      const m = new THREE.Mesh(g, mat); m.receiveShadow = true; scene.add(m); return m;
    }
    ribbon([[0, STREET.z0 - 4], [0, 60], [0, STREET.z1 + 30]], STREET.half * 2, M.road, 0.05);
    ribbon(CASTLE_PATH, 6, M.road, 0.08, 1.5);
    for (const t of TRAILS) ribbon(t.pts, t.width, M.road, 0.09, 1.5);
    const creekIce = new THREE.MeshStandardMaterial({ color: '#9fd3f5', roughness: 0.08, metalness: 0.15, emissive: '#123e66', emissiveIntensity: 0.4 });
    ribbon(CREEK, 9, creekIce, 0.15, 2).position.y = 0.05;

    // plaza
    {
      const g = new THREE.CircleGeometry(SQUARE.r, 64).rotateX(-Math.PI / 2);
      const m = new THREE.Mesh(g, M.cobble); m.position.y = 0.07; m.receiveShadow = true; scene.add(m);
      // low stone ring + snow
      for (let i = 0; i < 40; i++) {
        const a = (i / 40) * Math.PI * 2; if (Math.abs(Math.sin(a)) > 0.97 && Math.cos(a) < 0.3 && Math.sin(a) > 0) continue;   // gap for street
        if (Math.sin(a) < -0.97) continue;      // gap toward the castle path
        const x = Math.cos(a) * SQUARE.r, z = Math.sin(a) * SQUARE.r;
        B.box(M.stone, x, 0.35, z, 2.9, 0.7, 0.9, '#ffffff', [0, -a + Math.PI / 2, 0]);
        B.box(M.snow, x, 0.78, z, 2.9, 0.18, 0.95, '#ffffff', [0, -a + Math.PI / 2, 0]);
      }
    }

    // ---------------- pines (shared octagonal tier geometry, instanced) ----------------
    function pineGeometry(tiers = 4) {
      const parts = []; const colr = (g, hex) => { const c = C(hex), n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) a.set([c.r, c.g, c.b], i * 3); g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g; };
      parts.push(colr(new THREE.CylinderGeometry(0.35, 0.45, 2, 6).translate(0, 1, 0), '#5b3b22'));
      for (let i = 0; i < tiers; i++) {
        const r = 2.6 - i * 0.55, y = 1.4 + i * 1.55, hgt = 2.2;
        parts.push(colr(new THREE.CylinderGeometry(r * 0.35, r, hgt, 8).translate(0, y + hgt / 2, 0), i % 2 ? '#2a6b52' : '#245e49'));
        parts.push(colr(new THREE.CylinderGeometry(r * 0.32, r * 0.62, 0.55, 8).translate(0, y + hgt * 0.82, 0), '#f4f9ff'));
      }
      parts.push(colr(new THREE.ConeGeometry(0.55, 1.4, 8).translate(0, 1.4 + tiers * 1.55 + 0.4, 0), '#f4f9ff'));
      return mergeGeometries(parts.map(p => p.toNonIndexed()));
    }
    const PINE = pineGeometry(4);
    const pine = (x, z, s) => B.add(M.pine, PINE, x, height(x, z) - 0.2, z, s, s * (0.9 + R() * 0.3), s, '#ffffff', [0, R() * 6.28, 0]);
    {
      let placed = 0;
      for (let tries = 0; tries < 9000 && placed < 1500; tries++) {
        const x = (R() - 0.5) * 900, z = (R() - 0.5) * 900 - 40;
        const h = height(x, z);
        if (h > 75 || h < -0.2) continue;
        if (inLake(x, z, 8)) continue;
        if (distToPolyline(x, z, CREEK) < 9) continue;
        if (Math.abs(x) < 12 && z > -150 && z < 140) continue;        // street + castle path
        if (Math.hypot(x - CASTLE.x, z - CASTLE.z) < CASTLE.plateau + 2) continue;
        if (distToTrail(x, z) < 2.5) continue;
        if (Math.hypot(x - PORTAL.x, z - PORTAL.z) < PORTAL.r + 4) continue;
        if (Math.hypot(x - CAVE.x, z - CAVE.z) < 24 || (x < CAVE.x + 30 && x > CAVE.x - 4 && Math.abs(z - CAVE.z) < 12)) continue;
        if (x > -26 && x < 26 && z > -27 && z < -8) continue;              // market
        const village = x > -62 && x < 132 && z > -52 && z < 122;
        const clump = fbm(x * 0.02 + 40, z * 0.02);
        if (village && (R() > 0.06 || Math.hypot(x, z) < 42)) continue;
        if (!village && clump < 0.42 && R() > 0.25) continue;
        if (cabins().some(([cx, cz]) => Math.hypot(cx - x, cz - z) < 9)) continue;
        pine(x, z, 1.1 + R() * 1.5 + Math.min(1, Math.max(0, h) / 60)); placed++;
      }
    }

    // ---------------- cabins ----------------
    const colliders = [];
    const lightSpots = [];   // candidate positions for real point lights (street)
    const windowLights = [];
    function cabin([cx, cz, face, W, D, H, v]) {
      const base = height(cx, cz);
      const cs = Math.cos(face), sn = Math.sin(face);
      const L = (x, z) => [cx + x * cs + z * sn, cz - x * sn + z * cs];   // local → world (front = +z local)
      const box = (batch, mat, x, y, z, sx, sy, sz, color = '#ffffff', extraRot = null) => {
        const [wx, wz] = L(x, z);
        batch.box(mat, wx, base + y, wz, sx, sy, sz, color, extraRot ? [extraRot[0], face + (extraRot[1] || 0), extraRot[2], 'YXZ'] : [0, face, 0]);
      };
      const logTint = ['#ffffff', '#f0d9c2', '#e6c7a8', '#ffe8d6'][v % 4];
      box(B, M.stone, 0, 0.35, 0, W + 0.6, 0.7, D + 0.6);
      box(B, M.logs, 0, 0.7 + H / 2, 0, W, H, D, logTint);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(B, M.wood, sx * (W / 2 + 0.05), 0.7 + H / 2, sz * (D / 2 + 0.05), 0.55, H + 0.2, 0.55);
      // gable roof: two slabs + snow, ridge runs front-to-back (local z)
      const pitch = 0.62, half = W / 2 + 0.9, rise = Math.tan(pitch) * half, slab = half / Math.cos(pitch);
      const top = 0.7 + H;
      for (const s of [-1, 1]) {
        const x = s * half / 2, y = top + rise / 2 + 0.15;
        box(B, M.wood, x, y, 0, slab + 0.3, 0.32, D + 1.6, '#7a4a30', [0, 0, -s * pitch]);
        box(B, M.snow, x - s * Math.sin(pitch) * 0.0, y + Math.cos(pitch) * 0.36, 0, slab + 0.35, 0.42, D + 1.75, '#ffffff', [0, 0, -s * pitch]);
      }
      // gable ends (stacked log boxes shrinking toward the ridge)
      for (let k = 0; k < 6; k++) {
        const t = (k + 0.5) / 6, w = (W) * (1 - t);
        box(B, M.logs, 0, top + rise * 0.92 * t, 0, w, rise / 6 + 0.02, D - 0.2, logTint);
      }
      // chimney
      box(B, M.stone, W * 0.22, top + rise * 0.9, -D * 0.25, 1.2, rise * 1.4 + 1.6, 1.2);
      box(B, M.snow, W * 0.22, top + rise * 0.9 + (rise * 1.4 + 1.6) / 2 + 0.1, -D * 0.25, 1.35, 0.25, 1.35);
      // door + warm lamp
      box(B, M.wood, 0, 0.7 + 1.35, D / 2 + 0.08, 1.7, 2.7, 0.18, '#a0623a');
      box(B, M.wood, 0, 0.7 + 2.8, D / 2 + 0.3, 2.3, 0.2, 0.7);
      box(G, glow, 0.95, 0.7 + 2.4, D / 2 + 0.25, 0.32, 0.42, 0.32, hdr(CANDLE, 3.2));
      // wreath (ring of green blocks with red bow)
      for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; box(B, M.fabric, Math.cos(a) * 0.42, 0.7 + 2.05 + Math.sin(a) * 0.42, D / 2 + 0.2, 0.26, 0.26, 0.12, '#2f7d4f'); }
      box(B, M.fabric, 0, 0.7 + 1.62, D / 2 + 0.22, 0.32, 0.22, 0.12, '#d93a3a');
      // windows: front pair, sides x2, gable
      const win = (x, y, z, rotY, w = 1.3, h = 1.5) => {
        const lit = v % 7 !== 3 || y > H;           // a few windows dark for variety
        const [wx, wz] = L(x, z);
        const color = lit ? hdr(R() > 0.3 ? WARM : '#ffc985', 1.5 + R() * 0.9) : [0.03, 0.04, 0.06];
        G.box(glow, wx, base + y, wz, w, h, 0.1, color, [0, face + rotY, 0]);
        // frame + cross mullion + snowy sill
        const fr = (dx, dy, sx, sy) => { const nx = Math.cos(rotY) * dx, nz = -Math.sin(rotY) * dx; const [fx, fz] = L(x + nx + Math.sin(rotY) * 0.06, z + nz + Math.cos(rotY) * 0.06); B.box(M.wood, fx, base + y + dy, fz, sx, sy, 0.14, '#3a2516', [0, face + rotY, 0]); };
        fr(0, 0, 0.12, h); fr(0, 0, w, 0.12); fr(-w / 2, 0, 0.16, h + 0.16); fr(w / 2, 0, 0.16, h + 0.16); fr(0, h / 2, w + 0.16, 0.16);
        const [sx_, sz_] = L(x + Math.sin(rotY) * 0.18, z + Math.cos(rotY) * 0.18);
        B.box(M.snow, sx_, base + y - h / 2 - 0.1, sz_, w + 0.4, 0.22, 0.5, '#ffffff', [0, face + rotY, 0]);
        if (lit) { const [px, pz] = L(x + Math.sin(rotY) * 2.6, z + Math.cos(rotY) * 2.6); if (y < H) { pool(px, pz, 2.4, WARM, 0.3); windowLights.push([px, base + y, pz]); } }
      };
      const wy = 0.7 + H * 0.52;
      win(-W * 0.3, wy, D / 2 + 0.06, 0); win(W * 0.3, wy, D / 2 + 0.06, 0);
      win(W / 2 + 0.06, wy, -D * 0.2, Math.PI / 2); win(W / 2 + 0.06, wy, D * 0.25, Math.PI / 2);
      win(-W / 2 - 0.06, wy, -D * 0.2, -Math.PI / 2); win(-W / 2 - 0.06, wy, D * 0.25, -Math.PI / 2);
      win(0, top + rise * 0.38, D / 2 - 0.02, 0, 0.9, 0.9);
      win(0, top + rise * 0.38, -D / 2 + 0.02, Math.PI, 0.9, 0.9);
      // string lights along the front gable edges
      for (const s of [-1, 1]) {
        for (let i = 0; i <= 9; i++) {
          const t = i / 9, x = s * (half - 0.2) * (1 - t), y = top + 0.15 + rise * t + 0.05;
          const [wx, wz] = L(x, D / 2 + 0.95);
          twinkleBulb(wx, base + y - 0.15, wz, (i + v) % BULBS.length, 0.11);
        }
      }
      const [dx, dz] = L(0, D / 2 + 2.4); pool(dx, dz, 2.0, CANDLE, 0.22);
      // collider (axis aligned bound of the rotated footprint)
      const ex = Math.abs(cs) * W / 2 + Math.abs(sn) * D / 2 + 0.3, ez = Math.abs(sn) * W / 2 + Math.abs(cs) * D / 2 + 0.3;
      colliders.push([cx - ex, base, cz - ez, cx + ex, base + 12, cz + ez]);
      lightSpots.push(L(0, D / 2 + 3));
    }
    function twinkleBulb(x, y, z, ci, s = 0.18) { G.add(twinkle[ci % 3], BULB, x, y, z, s, s * 1.25, s, hdr(BULBS[ci % BULBS.length], 2.0)); }
    const BULB = new THREE.SphereGeometry(1, 8, 6);
    const CABINS = cabins();
    CABINS.forEach(cabin);

    // string lights across the street (catenary)
    {
      const wire = [];
      for (let z = 34; z <= 104; z += 15.5) {
        const a = new THREE.Vector3(-10.5, 6.2, z + 1), b = new THREE.Vector3(10.5, 6.6, z + 4.5);
        const n = 28;
        for (let i = 0; i <= n; i++) {
          const t = i / n, p = a.clone().lerp(b, t); p.y -= Math.sin(Math.PI * t) * 1.6;
          wire.push(p);
          if (i % 1 === 0 && i > 0 && i < n) twinkleBulb(p.x, p.y - 0.22, p.z, i, 0.12);
        }
        wire.push(null);
        for (const e of [a, b]) B.box(M.wood, e.x + Math.sign(e.x) * 0.0, e.y / 2, e.z, 0.3, e.y, 0.3, '#3a2516');
      }
      const pts = []; for (let i = 0; i < wire.length - 1; i++) if (wire[i] && wire[i + 1]) pts.push(wire[i], wire[i + 1]);
      scene.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: '#1a1410' })));
    }

    // ---------------- lanterns ----------------
    function lantern(x, z, k = 1) {
      const y0 = height(x, z);
      B.box(M.iron, x, y0 + 1.7, z, 0.22, 3.4, 0.22);
      B.box(M.stone, x, y0 + 0.2, z, 0.6, 0.4, 0.6);
      B.box(M.iron, x, y0 + 3.45, z, 0.75, 0.1, 0.75);
      G.box(glow, x, y0 + 3.85, z, 0.5, 0.7, 0.5, hdr('#ffc56b', 2.6 * k));
      B.box(M.iron, x, y0 + 4.3, z, 0.8, 0.18, 0.8);
      B.box(M.snow, x, y0 + 4.45, z, 0.7, 0.14, 0.7);
      pool(x, z, 4.0, '#ffb760', 0.28 * k);
    }
    for (let z = 22; z <= 108; z += 15.5) { lantern(-6.6, z + 7); lantern(6.6, z + 1); }
    for (let i = 0; i < 8; i++) { const a = (i + 0.5) / 8 * Math.PI * 2; lantern(Math.cos(a) * (SQUARE.r - 2.2), Math.sin(a) * (SQUARE.r - 2.2)); }
    for (let z = -28; z >= -130; z -= 13) { lantern(-4.4, z, 0.9); lantern(4.4, z - 6, 0.9); }
    for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; const x = LAKE.x + Math.cos(a) * (LAKE.rx + 4), z = LAKE.z + Math.sin(a) * (LAKE.rz + 4); if (i % 2 === 0) lantern(x, z, 0.9); }

    // ---------------- the town tree ----------------
    const TREE = { x: 0, z: 0 };
    {
      B.add(M.wood, new THREE.CylinderGeometry(0.9, 1.2, 4, 8), TREE.x, 2, TREE.z);
      B.add(M.stone, new THREE.CylinderGeometry(3.4, 3.8, 1.0, 8), TREE.x, 0.5, TREE.z);
      B.add(M.snow, new THREE.CylinderGeometry(3.5, 3.5, 0.2, 8), TREE.x, 1.05, TREE.z);
      const tierGeo = new THREE.CylinderGeometry(1, 1, 1, 8);
      const tiers = 9;
      for (let i = 0; i < tiers; i++) {
        const t = i / tiers, r = 9.5 * (1 - t) + 1.2, y = 3.4 + i * 2.55, hgt = 3.4;
        const g = new THREE.CylinderGeometry(r * 0.42, r, hgt, 8);
        B.add(M.pine, g.toNonIndexed(), TREE.x, y + hgt / 2, TREE.z, 1, 1, 1, i % 2 ? '#1f5e45' : '#1a5240', [0, i * 0.39, 0]);
        B.add(M.snow, new THREE.CylinderGeometry(r * 0.4, r * 0.66, 0.6, 8), TREE.x, y + hgt * 0.83, TREE.z, 1, 1, 1, '#ffffff', [0, i * 0.39, 0]);
        // ornaments on the tier skirt
        const n = Math.round(10 + r * 2.2);
        for (let j = 0; j < n; j++) {
          const a = j / n * Math.PI * 2 + i, rr = r * 0.97, yy = y + 0.35 + R() * 0.6;
          const col = ['#ff3b4e', '#ffd34d', '#4fd8ff', '#ff7ad1', '#ffffff'][(j + i) % 5];
          G.box(glow, TREE.x + Math.cos(a) * rr, yy, TREE.z + Math.sin(a) * rr, 0.3, 0.3, 0.3, hdr(col, 1.6), [0.6, a, 0.6]);
        }
      }
      // spiral string lights
      const top = 3.4 + tiers * 2.55;
      for (let i = 0; i < 420; i++) {
        const t = i / 420, y = 4 + t * (top - 5), a = t * Math.PI * 2 * 7.5;
        const ti = (y - 3.4) / 2.55, frac = ti - Math.floor(ti), tr = 9.5 * (1 - Math.floor(ti) / tiers) + 1.2;
        const r = (tr * (1 - frac * 0.58)) + 0.25;
        twinkleBulb(TREE.x + Math.cos(a) * r, y, TREE.z + Math.sin(a) * r, i % 3 === 0 ? 3 : 0, 0.12);
      }
      // star
      const star = new THREE.Mesh(new THREE.OctahedronGeometry(1.5, 0), glowMaterial({ color: new THREE.Color(CANDLE).multiplyScalar(4) }));
      star.position.set(TREE.x, top + 1.6, TREE.z); star.scale.set(1, 1.3, 0.5); scene.add(star);
      const star2 = star.clone(); star2.rotation.y = Math.PI / 2; star.add(star2); star2.position.set(0, 0, 0); star2.scale.set(1, 1, 1);
      animated.push((t) => { star.rotation.y = t * 0.6; });
      const starLight = new THREE.PointLight('#ffcf7a', 120, 60, 1.6); starLight.position.set(TREE.x, top - 2, TREE.z); scene.add(starLight);
      const treeLight = new THREE.PointLight('#ffb35c', 80, 36, 1.6); treeLight.position.set(TREE.x + 6, 8, TREE.z + 10); scene.add(treeLight);
      pool(TREE.x, TREE.z, 14, '#ffb35c', 0.16);
      // presents
      for (let i = 0; i < 12; i++) {
        const a = i / 12 * Math.PI * 2 + 0.2, r = 4.6 + R() * 1.2, s = 0.8 + R() * 0.7;
        const col = ['#e2474b', '#3f8fd0', '#f5c542', '#2f8f5b', '#8b6cf0', '#ffffff'][i % 6];
        const x = Math.cos(a) * r, z = Math.sin(a) * r;
        B.box(M.fabric, x, s / 2, z, s, s, s, col, [0, a, 0]);
        B.box(M.fabric, x, s / 2 + 0.01, z, s + 0.04, s + 0.02, 0.18, '#fff4d6', [0, a, 0]);
        B.box(M.fabric, x, s / 2 + 0.01, z, 0.18, s + 0.02, s + 0.04, '#fff4d6', [0, a, 0]);
      }
      Object.assign(TREE, { top });
    }

    // ---------------- frozen lake ----------------
    {
      const geo = new THREE.CircleGeometry(1, 96).rotateX(-Math.PI / 2);
      const mirror = new Reflector(new THREE.CircleGeometry(1, 96), { textureWidth: 1024, textureHeight: 1024, color: '#5f7488', clipBias: 0.003 });
      mirror.rotation.x = -Math.PI / 2; mirror.scale.set(LAKE.rx, LAKE.rz, 1); mirror.position.set(LAKE.x, 0.02, LAKE.z);
      scene.add(mirror);
      // skate marks + frosty patches (overlay)
      const tex = canvasTex(1024, (g, s) => {
        g.clearRect(0, 0, s, s);
        const r = rng(9);
        // frost patches
        g.fillStyle = 'rgba(190,220,245,0.22)'; g.fillRect(0, 0, s, s);
        for (let i = 0; i < 110; i++) { const x = r() * s, y = r() * s, rad = 30 + r() * 140; const gr = g.createRadialGradient(x, y, 0, x, y, rad); gr.addColorStop(0, 'rgba(225,240,255,0.5)'); gr.addColorStop(1, 'rgba(225,240,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, s, s); }
        // skate loops
        g.lineCap = 'round';
        for (let i = 0; i < 40; i++) {
          g.strokeStyle = `rgba(255,255,255,${0.3 + r() * 0.4})`; g.lineWidth = 1 + r() * 1.6;
          const cx = s / 2 + (r() - 0.5) * s * 0.55, cy = s / 2 + (r() - 0.5) * s * 0.55, rx = 60 + r() * 260, ry = 40 + r() * 200, rot = r() * 3;
          g.beginPath(); g.ellipse(cx, cy, rx, ry, rot, r() * 6, r() * 6 + 2 + r() * 4); g.stroke();
        }
        for (let i = 0; i < 18; i++) { g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 1.2; g.beginPath(); let x = r() * s, y = r() * s; g.moveTo(x, y); for (let k = 0; k < 6; k++) { x += (r() - 0.5) * 140; y += (r() - 0.5) * 140; g.quadraticCurveTo(x + (r() - 0.5) * 80, y + (r() - 0.5) * 80, x, y); } g.stroke(); }
        // thin cracks
        g.strokeStyle = 'rgba(200,235,255,0.25)'; g.lineWidth = 0.8;
        for (let i = 0; i < 14; i++) { g.beginPath(); let x = r() * s, y = r() * s; g.moveTo(x, y); for (let k = 0; k < 8; k++) { x += (r() - 0.5) * 60; y += (r() - 0.5) * 60; g.lineTo(x, y); } g.stroke(); }
      });
      tex.colorSpace = THREE.SRGBColorSpace;
      const over = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: tex, transparent: true, color: '#ffffff', roughness: 0.35, depthWrite: false }));
      over.scale.set(LAKE.rx, 1, LAKE.rz); over.position.set(LAKE.x, 0.06, LAKE.z); over.receiveShadow = true; scene.add(over);
      // snowy shore drifts
      const drift = new THREE.IcosahedronGeometry(1, 1);
      for (let i = 0; i < 70; i++) {
        const a = i / 70 * Math.PI * 2 + R() * 0.05, k = 1.0 + R() * 0.06;
        const x = LAKE.x + Math.cos(a) * LAKE.rx * k, z = LAKE.z + Math.sin(a) * LAKE.rz * k;
        B.add(M.white, drift, x, -0.1, z, 2 + R() * 2.5, 0.5 + R() * 0.7, 2 + R() * 2.5, '#ffffff', [0, R() * 3, 0]);
      }
      // a couple of benches on the shore
      for (const a of [2.6, 3.4, 4.2]) {
        const x = LAKE.x + Math.cos(a) * (LAKE.rx + 7), z = LAKE.z + Math.sin(a) * (LAKE.rz + 7);
        B.box(M.wood, x, 0.6, z, 3, 0.2, 0.9, '#7a4a30', [0, -a, 0]); B.box(M.snow, x, 0.75, z, 3, 0.12, 0.85, '#ffffff', [0, -a, 0]);
        for (const s of [-1.2, 1.2]) B.box(M.iron, x + Math.cos(-a) * s, 0.3, z - Math.sin(-a) * s, 0.15, 0.6, 0.7, '#ffffff', [0, -a, 0]);
      }
    }

    // ---------------- ice bridges over the creek ----------------
    for (const br of BRIDGES) {
      const len = 20, w = 5.5, n = 22, cs = Math.cos(br.dir), sn = Math.sin(br.dir);
      for (let i = 0; i < n; i++) {
        const t = (i + 0.5) / n, zl = -len / 2 + t * len, y = 0.4 + Math.sin(Math.PI * t) * 2.6;
        const slope = Math.cos(Math.PI * t) * Math.PI * 2.6 / len;
        const x = br.x + zl * sn, z = br.z + zl * cs;
        B.box(M.ice, x, y, z, w, 0.6, len / n + 0.05, '#ffffff', [-Math.atan(slope), br.dir, 0, 'YXZ']);
        for (const s of [-1, 1]) {
          const rx = x + s * (w / 2 - 0.25) * cs, rz = z - s * (w / 2 - 0.25) * sn;
          if (i % 3 === 1) { B.box(M.ice, rx, y + 0.9, rz, 0.5, 1.6, 0.5); G.box(glowCold, rx, y + 1.85, rz, 0.32, 0.32, 0.32, hdr('#8fe8ff', 4)); }
          B.box(M.iceClear, rx, y + 1.3, rz, 0.3, 0.25, len / n + 0.1, '#ffffff', [-Math.atan(slope), br.dir, 0, 'YXZ']);
        }
      }
      pool(br.x, br.z, 9, '#6fd8ff', 0.35);
    }

    // ---------------- snowmen ----------------
    const ball = new THREE.IcosahedronGeometry(1, 2);
    function snowman(x, z, face, hat = 0, s = 1) {
      const y = height(x, z), d = (a, b) => [x + Math.sin(face) * a + Math.cos(face) * b, z + Math.cos(face) * a - Math.sin(face) * b];
      B.add(M.white, ball, x, y + 0.9 * s, z, 1.15 * s, 1.0 * s, 1.15 * s);
      B.add(M.white, ball, x, y + 2.25 * s, z, 0.82 * s, 0.78 * s, 0.82 * s);
      B.add(M.white, ball, x, y + 3.25 * s, z, 0.56 * s, 0.56 * s, 0.56 * s);
      for (const e of [-0.2, 0.2]) { const [ex, ez] = d(0.5 * s, e * s); B.box(M.coal, ex, y + 3.38 * s, ez, 0.11 * s, 0.11 * s, 0.11 * s); }
      for (const k of [0, 1, 2]) { const [bx, bz] = d(0.8 * s, 0); B.box(M.coal, bx, y + (1.95 + k * 0.32) * s, bz, 0.12 * s, 0.12 * s, 0.12 * s); }
      const [nx, nz] = d(0.75 * s, 0);
      B.add(M.carrot, new THREE.ConeGeometry(0.09, 0.6, 6).rotateX(Math.PI / 2), nx, y + 3.22 * s, nz, s, s, s, '#ffffff', [0, face, 0]);
      const scarf = ['#e2474b', '#3f8fd0', '#2f8f5b', '#f5c542'][hat % 4];
      B.add(M.fabric, new THREE.CylinderGeometry(0.6, 0.66, 0.24, 10), x, y + 2.85 * s, z, s, s, s, scarf);
      const [tx, tz] = d(0.45 * s, 0.35 * s); B.box(M.fabric, tx, y + 2.5 * s, tz, 0.22 * s, 0.6 * s, 0.1 * s, scarf, [0.3, face, 0]);
      if (hat % 2) { B.add(M.coal, new THREE.CylinderGeometry(0.5, 0.5, 0.06, 12), x, y + 3.72 * s, z, s, s, s); B.add(M.coal, new THREE.CylinderGeometry(0.34, 0.34, 0.6, 12), x, y + 4.02 * s, z, s, s, s); }
      else { B.add(M.fabric, new THREE.ConeGeometry(0.42, 0.75, 10), x, y + 3.92 * s, z, s, s, s, scarf); B.add(M.white, ball, x, y + 4.32 * s, z, 0.13 * s, 0.13 * s, 0.13 * s); }
      // stick arms
      for (const sd of [-1, 1]) { const [ax, az] = d(0, sd * 1.05 * s); B.box(M.wood, ax, y + 2.45 * s, az, 0.08, 0.08, 1.1 * s, '#4a2f1c', [sd * 0.5, face + Math.PI / 2, 0, 'YXZ']); }
      colliders.push([x - 1.1 * s, y, z - 1.1 * s, x + 1.1 * s, y + 4 * s, z + 1.1 * s]);
    }
    snowman(9, 22, -0.6, 1); snowman(-9.5, 26, 0.5, 2, 0.9); snowman(22, 20, -2.4, 3); snowman(-22, 17, 2.2, 0, 1.05);
    snowman(52, 4, -1.4, 1, 1.1); snowman(46, 26, -1.9, 2, 0.8); snowman(-7, -48, 0.2, 3); snowman(-20, 70, 1.5, 0, 0.9);

    // ---------------- the ice castle ----------------
    const castleBase = CASTLE.top;
    {
      const cx = CASTLE.x, cz = CASTLE.z, y0 = castleBase;
      const octa = new THREE.CylinderGeometry(1, 1, 1, 8);
      const spire = new THREE.ConeGeometry(1, 1, 8);
      // curtain walls with crenellations (gate gap in the front wall)
      const wall = (x0, z0, x1, z1) => {
        const len = Math.hypot(x1 - x0, z1 - z0), ang = Math.atan2(x1 - x0, z1 - z0), n = Math.round(len / 2);
        for (let i = 0; i < n; i++) {
          const t = (i + 0.5) / n, x = cx + x0 + (x1 - x0) * t, z = cz + z0 + (z1 - z0) * t;
          if (Math.abs(x - cx) < 4 && z > cz + 20) { // gate
            B.box(M.ice, x, y0 + 8.2, z, 2.1, 2.2, 2.4, '#ffffff', [0, ang, 0]);
          } else B.box(M.ice, x, y0 + 4.5, z, 2.05, 9, 2.4, '#ffffff', [0, ang, 0]);
          if (i % 2 === 0) B.box(M.ice, x, y0 + 9.7, z, 1.2, 1.4, 2.6, '#ffffff', [0, ang, 0]);
        }
      };
      const S = 22;
      wall(-S, S, S, S); wall(S, S, S, -S); wall(S, -S, -S, -S); wall(-S, -S, -S, S);
      G.box(glowCold, cx, y0 + 3.6, cz + S + 0.3, 6, 7.2, 0.3, hdr('#7fe0ff', 1.1));       // glowing gate
      // corner towers
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        const x = cx + sx * S, z = cz + sz * S;
        B.add(M.ice, octa, x, y0 + 11, z, 4.6, 22, 4.6);
        B.add(M.ice, octa, x, y0 + 22.6, z, 5.4, 1.4, 5.4);
        for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; B.box(M.ice, x + Math.cos(a) * 4.9, y0 + 24, z + Math.sin(a) * 4.9, 1.4, 1.6, 1.4, '#ffffff', [0, -a, 0]); }
        B.add(M.iceClear, spire, x, y0 + 30, z, 4.2, 12, 4.2);
        G.add(glowCold, new THREE.OctahedronGeometry(1, 0), x, y0 + 36.6, z, 0.7, 1.2, 0.7, hdr('#bff4ff', 6));
        for (let k = 0; k < 3; k++) for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2 + 0.4 + k; G.box(glowCold, x + Math.cos(a) * 4.62, y0 + 7 + k * 5, z + Math.sin(a) * 4.62, 0.6, 1.6, 0.2, hdr('#9feaff', 2), [0, -a + Math.PI / 2, 0]); }
      }
      // keep + great tower
      B.box(M.ice, cx, y0 + 9, cz - 4, 20, 18, 18);
      for (let i = -4; i <= 4; i++) for (const s of [-1, 1]) { B.box(M.ice, cx + i * 2.2, y0 + 18.8, cz - 4 + s * 9, 1.2, 1.6, 1.2); B.box(M.ice, cx + s * 10, y0 + 18.8, cz - 4 + i * 2, 1.2, 1.6, 1.2); }
      for (let i = -3; i <= 3; i++) for (const r of [0, 1]) G.box(glowCold, cx + i * 2.6, y0 + 6 + r * 6, cz + 5.05, 0.8, 2.2, 0.2, hdr('#a6ecff', 1.8));
      for (const sx of [-1, 1]) {
        B.add(M.ice, octa, cx + sx * 9, y0 + 17, cz - 10, 3.8, 34, 3.8);
        B.add(M.iceClear, spire, cx + sx * 9, y0 + 40, cz - 10, 3.6, 12, 3.6);
        G.add(glowCold, new THREE.OctahedronGeometry(1, 0), cx + sx * 9, y0 + 46.8, cz - 10, 0.6, 1.1, 0.6, hdr('#bff4ff', 6));
        for (let k = 0; k < 5; k++) G.box(glowCold, cx + sx * 9, y0 + 8 + k * 5, cz - 10 + 3.85, 0.6, 1.8, 0.2, hdr('#9feaff', 2));
      }
      B.add(M.ice, octa, cx, y0 + 25, cz - 8, 6.4, 50, 6.4);
      B.add(M.ice, octa, cx, y0 + 50.8, cz - 8, 7.6, 1.6, 7.6);
      for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; B.box(M.ice, cx + Math.cos(a) * 7, y0 + 52.4, cz - 8 + Math.sin(a) * 7, 1.6, 1.8, 1.6, '#ffffff', [0, -a, 0]); }
      B.add(M.iceClear, spire, cx, y0 + 62, cz - 8, 6, 22, 6);
      for (let k = 0; k < 8; k++) G.box(glowCold, cx, y0 + 8 + k * 5.2, cz - 8 + 6.45, 0.9, 2.4, 0.2, hdr('#b4f0ff', 2.2));
      // crown crystal + orbiting shards
      const crown = new THREE.Mesh(new THREE.OctahedronGeometry(1.6, 0), glowMaterial({ color: new THREE.Color('#c9f7ff').multiplyScalar(8) }));
      crown.position.set(cx, y0 + 75.5, cz - 8); crown.scale.set(1, 2, 1); scene.add(crown);
      const shards = new THREE.Group(); shards.position.copy(crown.position).y -= 8; scene.add(shards);
      const shardMat = glowMaterial({ color: new THREE.Color('#8fe8ff').multiplyScalar(5) });
      for (let i = 0; i < 9; i++) { const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.5, 0), shardMat); const a = i / 9 * Math.PI * 2; m.position.set(Math.cos(a) * 9, Math.sin(a * 3) * 1.5, Math.sin(a) * 9); m.scale.y = 1.8; shards.add(m); }
      animated.push((t) => { crown.rotation.y = t * 0.4; shards.rotation.y = t * 0.15; shards.children.forEach((m, i) => { m.rotation.y = t * 1.2 + i; }); });
      const castleLight = new THREE.PointLight('#7fd9ff', 260, 90, 1.6); castleLight.position.set(cx, y0 + 30, cz + 20); scene.add(castleLight);
      const crownLight = new THREE.PointLight('#bff4ff', 220, 60, 1.6); crownLight.position.copy(crown.position); scene.add(crownLight);
      Object.assign(CASTLE, { crown: crown.position.clone(), lights: [castleLight, crownLight] });
      // courtyard ice sculptures / crystals around the plateau edge
      for (let i = 0; i < 26; i++) {
        const a = i / 26 * Math.PI * 2, r = CASTLE.plateau - 2 + R() * 3, x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
        if (Math.abs(x - cx) < 6 && z > cz) continue;
        const h = 2 + R() * 4;
        B.add(M.iceClear, spire, x, height(x, z) + h / 2, z, 0.8 + R() * 0.6, h, 0.8 + R() * 0.6, '#ffffff', [R() * 0.3, R() * 3, R() * 0.3]);
      }
      pool(cx, cz + 30, 14, '#59c8ff', 0.3);
    }

    // ---------------- distant ice spires on the ridges ----------------
    for (let i = 0; i < 40; i++) {
      const a = R() * Math.PI * 2, r = 230 + R() * 260, x = Math.cos(a) * r, z = Math.sin(a) * r;
      const h = 10 + R() * 25;
      B.add(M.rock, new THREE.ConeGeometry(1, 1, 5), x, height(x, z) + h / 2 - 2, z, 4 + R() * 6, h, 4 + R() * 6, '#ffffff', [0, R() * 3, 0]);
    }

    // ---------------- lobby scenery: market stalls, Frostgate Plaza, Glimmer Cave, trail lanterns ----------------
    function stall({ x: sx, z: sz, facing }, big, canopy) {
      const y0 = height(sx, sz), cs = Math.cos(facing), sn = Math.sin(facing);
      const L = (x, z) => [sx + x * cs + z * sn, sz - x * sn + z * cs];
      const box = (bt, mat, x, y, z, a, b, c, col = '#ffffff', rot = null) => { const [wx, wz] = L(x, z); bt.box(mat, wx, y0 + y, wz, a, b, c, col, rot ? [rot[0], facing + rot[1], rot[2], 'YXZ'] : [0, facing, 0]); };
      const W = big ? 7 : 5, D = big ? 3.4 : 2.8;
      box(B, M.logs, 0, 0.6, 0.6, W, 1.2, 1.2, '#f0d9c2');                       // counter
      box(B, M.wood, 0, 1.25, 0.65, W + 0.3, 0.12, 1.45, '#6a4128');
      box(B, M.snow, 0, 1.36, 0.75, W + 0.2, 0.1, 0.9);
      for (const px of [-W / 2, W / 2]) for (const pz of [-D / 2, D / 2]) box(B, M.wood, px, 1.9, pz, 0.28, 3.8, 0.28, '#5a3a24');
      // striped canopy (two pitched halves, alternating stripes)
      const n = big ? 9 : 7;
      for (let i = 0; i < n; i++) {
        const x = -W / 2 + (i + 0.5) * (W / n), col = i % 2 ? '#f4efe6' : canopy;
        box(B, M.fabric, x, 4.05, 0.55, W / n + 0.01, 0.12, D / 2 + 1.0, col, [0.32, 0, 0]);
        box(B, M.fabric, x, 4.05, -0.95, W / n + 0.01, 0.12, D / 2 + 0.6, col, [-0.32, 0, 0]);
        box(B, M.fabric, x, 3.55, D / 2 + 0.85, W / n + 0.01, 0.5, 0.06, col);        // valance
      }
      box(B, M.snow, 0, 4.42, -0.2, W + 0.2, 0.2, 1.3);
      // back shelf with goods (glowing jars + wrapped bundles)
      box(B, M.wood, 0, 1.6, -D / 2 + 0.3, W - 0.4, 0.12, 0.6, '#6a4128'); box(B, M.wood, 0, 2.5, -D / 2 + 0.3, W - 0.4, 0.12, 0.6, '#6a4128');
      for (let i = 0; i < (big ? 8 : 5); i++) {
        const x = -W / 2 + 0.8 + i * ((W - 1.6) / ((big ? 8 : 5) - 1));
        box(G, glow, x, 1.88, -D / 2 + 0.3, 0.3, 0.42, 0.3, hdr(['#7fe3ff', '#ffcf73', '#ff8fb0', '#9dff9a'][i % 4], 1.6));
        box(B, M.fabric, x + 0.1, 2.75, -D / 2 + 0.3, 0.42, 0.38, 0.42, ['#e2474b', '#3f8fd0', '#f5c542', '#2f8f5b'][i % 4]);
      }
      for (const px of [-W / 2 + 0.2, W / 2 - 0.2]) box(G, glow, px, 3.25, D / 2 + 0.3, 0.38, 0.5, 0.38, hdr(CANDLE, 2.6));
      // crates + barrel out front
      box(B, M.wood, W / 2 + 0.9, 0.45, 1.0, 0.9, 0.9, 0.9, '#9a6b43'); box(B, M.wood, W / 2 + 0.8, 1.2, 1.1, 0.7, 0.6, 0.7, '#8a5a36');
      box(B, M.snow, W / 2 + 0.8, 1.55, 1.1, 0.72, 0.1, 0.72);
      const [bx, bz] = L(-W / 2 - 0.9, 0.9); B.add(M.wood, new THREE.CylinderGeometry(0.45, 0.45, 1.1, 10), bx, y0 + 0.55, bz, 1, 1, 1, '#7a4a30');
      if (big) { // blank hanging sign board (no text: scenery only)
        box(B, M.wood, 0, 4.9, D / 2 + 0.6, 2.6, 0.9, 0.12, '#5a3a24'); box(G, glow, 0, 4.9, D / 2 + 0.68, 0.5, 0.5, 0.04, hdr('#9fe3ff', 1.6), [0, 0, Math.PI / 4]);
      }
      const [px, pz] = L(0, D / 2 + 2); pool(px, pz, 4, CANDLE, 0.25);
      const ex = W / 2 + 1.5, ez = D / 2 + 1; colliders.push([sx - ex, y0, sz - ex, sx + ex, y0 + 4, sz + ex]);
    }
    stall(MARKET.merchant, true, '#d9433f');
    stall(MARKET.stall, false, '#2f7fc4');

    // Frostgate Plaza: paved clearing + ice archway, reserved for the minigame entrance (no portal effect)
    {
      const y0 = height(PORTAL.x, PORTAL.z);
      const disc = new THREE.Mesh(new THREE.CircleGeometry(PORTAL.r, 64).rotateX(-Math.PI / 2), M.cobble);
      disc.position.set(PORTAL.x, y0 + 0.08, PORTAL.z); disc.receiveShadow = true; scene.add(disc);
      for (let i = 0; i < 16; i++) {                                       // ring of short ice posts with cold lights
        const a = i / 16 * Math.PI * 2; if (Math.abs(Math.cos(a) - 1) < 0.15) continue;     // opening toward the trail (east)
        const x = PORTAL.x + Math.cos(a) * PORTAL.r, z = PORTAL.z + Math.sin(a) * PORTAL.r;
        B.box(M.ice, x, y0 + 0.9, z, 0.9, 1.8, 0.9, '#ffffff', [0, -a, 0]);
        if (i % 2 === 0) G.box(glowCold, x, y0 + 2.05, z, 0.4, 0.4, 0.4, hdr('#8fe8ff', 2.4), [0.6, -a, 0.6]);
      }
      // archway: two pillars + stepped arch, facing the trail (+x)
      const ax = PORTAL.x - 3;
      for (const s_ of [-1, 1]) { B.box(M.ice, ax, y0 + 4, PORTAL.z + s_ * 4.2, 1.8, 8, 1.8); B.box(M.iceClear, ax, y0 + 9.2, PORTAL.z + s_ * 4.2, 1.2, 2.4, 1.2); }
      for (let i = 0; i <= 12; i++) { const t = i / 12, a = Math.PI * t, z = PORTAL.z - Math.cos(a) * 4.2, y = y0 + 8 + Math.sin(a) * 2.6; B.box(M.ice, ax, y, z, 1.8, 1.1, 1.3, '#ffffff', [Math.PI / 2 - a, 0, 0]); }
      G.box(glowCold, ax, y0 + 10.9, PORTAL.z, 0.6, 0.9, 0.6, hdr('#bff4ff', 3), [0, 0.8, 0]);
      for (const s_ of [-1, 1]) for (let k = 0; k < 4; k++) G.box(glowCold, ax + 0.92, y0 + 1.2 + k * 1.8, PORTAL.z + s_ * 4.2, 0.06, 0.9, 0.5, hdr('#8fe8ff', 1.6));
      B.box(M.ice, ax, y0 + 0.2, PORTAL.z, 1.8, 0.4, 7);                    // threshold step
      pool(PORTAL.x, PORTAL.z, 11, '#59c8ff', 0.2);
      for (const s_ of [-1, 1]) colliders.push([ax - 0.9, y0, PORTAL.z + s_ * 4.2 - 0.9, ax + 0.9, y0 + 10, PORTAL.z + s_ * 4.2 + 0.9]);
    }

    // Glimmer Cave mouth (rock arch into the mountainside, crystals glowing inside)
    {
      const y0 = height(CAVE.x, CAVE.z), cx = CAVE.x - 2;
      const dark = new THREE.MeshBasicMaterial({ color: '#05070d' });
      B.box(dark, cx - 6, y0 + 4, CAVE.z, 12, 9, 9);
      const rockG = new THREE.DodecahedronGeometry(1, 0);
      for (let i = 0; i < 26; i++) { const t = i / 25, a = Math.PI * t, z = CAVE.z - Math.cos(a) * 6.5, y = y0 + Math.sin(a) * 8.5 - 0.5; B.add(M.rock, rockG, cx + 0.6 + R(), y, z, 2.2 + R() * 1.4, 2 + R() * 1.4, 2.2 + R() * 1.4, '#ffffff', [R() * 3, R() * 3, 0]); }
      for (let i = 0; i < 12; i++) B.add(M.rock, rockG, cx - 4 - R() * 10, y0 + 9 + R() * 6, CAVE.z + (R() - 0.5) * 18, 5 + R() * 4, 4 + R() * 3, 5 + R() * 4, '#ffffff', [R(), R() * 3, 0]);
      for (let i = 0; i < 9; i++) { const z = CAVE.z + (R() - 0.5) * 9, x = cx - 1 - R() * 5, h = 1 + R() * 2.4; G.add(glowCold, new THREE.ConeGeometry(0.4, 1, 5), x, y0 + h / 2, z, 0.8, h, 0.8, hdr(['#7fe3ff', '#b49bff'][i % 2], 2.2), [R() * 0.4, R() * 3, R() * 0.4]); }
      for (let i = 0; i < 6; i++) G.add(glowCold, new THREE.ConeGeometry(0.3, 1, 5), cx - 1 - R() * 4, y0 + 7.5 - R() * 0.6, CAVE.z + (R() - 0.5) * 8, 0.7, 1.4 + R(), 0.7, hdr('#9feaff', 2), [Math.PI, 0, 0]);
      pool(CAVE.x + 3, CAVE.z, 7, '#6fd8ff', 0.25);
      colliders.push([cx - 12, y0, CAVE.z - 9, cx - 3, y0 + 12, CAVE.z + 9]);
    }
    // sparse lanterns along the trails
    for (const t of TRAILS) {
      const pts = t.pts; let acc = 0;
      for (let i = 0; i < pts.length - 1; i++) {
        const [ax, az] = pts[i], [bx, bz] = pts[i + 1], len = Math.hypot(bx - ax, bz - az);
        for (let d = 0; d < len; d += 4) { acc += 4; if (acc % 24) continue; const u = d / len, nx = -(bz - az) / len, nz = (bx - ax) / len, s_ = (acc / 24) % 2 ? 1 : -1;
          lantern(ax + (bx - ax) * u + nx * s_ * (t.width / 2 + 1.2), az + (bz - az) * u + nz * s_ * (t.width / 2 + 1.2), 0.8); }
      }
    }
    // castle walls are solid for walk mode (gate open)
    { const cx = CASTLE.x, cz = CASTLE.z, y0 = CASTLE.top, S = 22;
      colliders.push([cx - S - 1.2, y0, cz - S - 1.2, cx + S + 1.2, y0 + 10, cz - S + 1.2], [cx - S - 1.2, y0, cz - S, cx - S + 1.2, y0 + 10, cz + S], [cx + S - 1.2, y0, cz - S, cx + S + 1.2, y0 + 10, cz + S],
        [cx - S, y0, cz + S - 1.2, cx - 3.2, y0 + 10, cz + S + 1.2], [cx + 3.2, y0, cz + S - 1.2, cx + S, y0 + 10, cz + S + 1.2], [cx - 10, y0, cz - 13, cx + 10, y0 + 20, cz + 5]); }

    // ---------------- real point lights (a few, on the street; the rest is emissive + light pools) ----------------
    const streetLights = [];
    for (let i = 0; i < CABINS.length && streetLights.length < 6; i += 3) {
      const [x, z] = lightSpots[i]; const l = new THREE.PointLight(WARM, 70, 22, 1.7); l.position.set(x, 2.6, z); scene.add(l); streetLights.push(l);
    }

    // ---------------- chimney smoke (soft sprites) ----------------
    const smoke = (() => {
      const PER = 60, n = CABINS.length * PER, g = new THREE.BufferGeometry(), p = new Float32Array(n * 3), s = new Float32Array(n);
      CABINS.forEach(([cx, cz, face, W, D, H], ci) => {
        const cs = Math.cos(face), sn = Math.sin(face), lx = W * 0.22, lz = -D * 0.25;
        const half = W / 2 + 0.9, rise = Math.tan(0.62) * half;
        const x = cx + lx * cs + lz * sn, z = cz - lx * sn + lz * cs, y = height(cx, cz) + 0.7 + H + rise * 0.9 + (rise * 1.4 + 1.6) / 2;
        for (let k = 0; k < PER; k++) { const i = ci * PER + k; p.set([x + (Math.random() - 0.5) * 0.4, y, z + (Math.random() - 0.5) * 0.4], i * 3); s[i] = k / PER + Math.random() * 0.01; }
      });
      g.setAttribute('position', new THREE.BufferAttribute(p, 3)); g.setAttribute('aPhase', new THREE.BufferAttribute(s, 1));
      const mat = new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, uniforms: { uTime: { value: 0 }, uWind: { value: 1 }, uAlpha: { value: 0.08 }, uColor: { value: C('#9aa9c4') }, uPx: { value: 1 } },
        vertexShader: `attribute float aPhase; uniform float uTime, uWind, uPx; varying float vA;
          void main(){ float t = fract(aPhase + uTime * 0.07); vec3 p = position; p.y += t * 9.0; p.x += t * t * 6.0 * uWind; p.z += sin(t * 6.0 + aPhase * 30.0) * 0.6;
            vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv; vA = smoothstep(0.0, 0.15, t) * (1.0 - t);
            gl_PointSize = uPx * (1.2 + t * 4.0) * 600.0 / -mv.z; }`,
        fragmentShader: `uniform vec3 uColor; uniform float uAlpha; varying float vA; void main(){ float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.0, d) * vA * uAlpha; if (a < 0.003) discard; gl_FragColor = vec4(uColor, a); }`,
      });
      const pts = new THREE.Points(g, mat); pts.frustumCulled = false; scene.add(pts);
      return mat;
    })();

    // ---------------- build instanced batches ----------------
    B.build(scene);
    G.build(scene, { cast: false, receive: false });
    P.build(scene, { cast: false, receive: false }).forEach(m => { m.renderOrder = 2; });

    // ---------------- day / night + weather ----------------
    const look = { night: 1, weather: 0.55 };
    const NIGHT = { fog: C('#1a2d4c'), hemiSky: C('#4d6ea8'), hemiGround: C('#141c30'), hemiI: 0.85, key: C('#a8c0ff'), keyI: 1.25, exposure: 1.05, glow: 1, pool: 1, ice: 0.32, smoke: C('#8796b3') };
    const DAY = { fog: C('#d9e9f8'), hemiSky: C('#dff0ff'), hemiGround: C('#a4b8cc'), hemiI: 1.25, key: C('#fff1de'), keyI: 2.6, exposure: 0.95, glow: 0.18, pool: 0.0, ice: 0.25, smoke: C('#e8eef6') };
    const STORM = { night: C('#5d7192'), day: C('#d5e0ec') };
    const tmp = new THREE.Color();
    function applyLook() {
      const n = look.night, w = look.weather, storm = THREE.MathUtils.smoothstep(w, 0.55, 1.0);
      const fogBase = tmp.copy(DAY.fog).lerp(NIGHT.fog, n);
      const stormCol = STORM.day.clone().lerp(STORM.night, n);
      scene.fog.color.copy(fogBase).lerp(stormCol, storm);
      scene.fog.density = THREE.MathUtils.lerp(THREE.MathUtils.lerp(0.0018, 0.0028, n), 0.026, storm * storm) + w * 0.002;
      sky.uniforms.uNight.value = n; sky.uniforms.uStorm.value = storm * 0.95; sky.uniforms.uStormColor.value.copy(scene.fog.color);
      sky.uniforms.uNightHorizon.value.set('#22406a').lerp(NIGHT.fog, 0.3);
      hemi.color.copy(DAY.hemiSky).lerp(NIGHT.hemiSky, n); hemi.groundColor.copy(DAY.hemiGround).lerp(NIGHT.hemiGround, n);
      hemi.intensity = THREE.MathUtils.lerp(DAY.hemiI, NIGHT.hemiI, n) * (1 + storm * 0.25);
      key.color.copy(DAY.key).lerp(NIGHT.key, n); key.intensity = THREE.MathUtils.lerp(DAY.keyI, NIGHT.keyI, n) * (1 - storm * 0.7);
      const dir = SUN_DIR.clone().lerp(MOON_DIR, n).normalize(); key.position.copy(key.target.position).addScaledVector(dir, 400);
      renderer.toneMappingExposure = THREE.MathUtils.lerp(DAY.exposure, NIGHT.exposure, n);
      const g = THREE.MathUtils.lerp(DAY.glow, NIGHT.glow, n);
      glow.color.setScalar(g); glowCold.color.setScalar(THREE.MathUtils.lerp(0.35, 1, n));
      poolMat.color.setScalar(THREE.MathUtils.lerp(DAY.pool, NIGHT.pool, n));
      M.ice.emissiveIntensity = THREE.MathUtils.lerp(DAY.ice, NIGHT.ice, n);
      streetLights.forEach(l => { l.intensity = 40 * n; });
      CASTLE.lights.forEach((l, i) => { l.intensity = (i ? 220 : 260) * (0.25 + 0.75 * n); });
      smoke.uniforms.uColor.value.copy(DAY.smoke).lerp(NIGHT.smoke, n); smoke.uniforms.uWind.value = 1 + w * 4; smoke.uniforms.uAlpha.value = 0.08 * (1 - storm);
    }
    applyLook();

    return {
      scene,
      shots: SHOTS,
      spawn: { pos: [ANCHORS.spawn.x, 0.1, ANCHORS.spawn.z], facing: ANCHORS.spawn.facing },
      walkBounds: { type: 'box', minX: -150, maxX: 140, minZ: -215, maxZ: 250 },
      groundHeight,
      layout: { AREAS, ANCHORS, TRAILS },
      addColliders(col) { colliders.forEach(b => col.addBox(...b)); col.addCircle(0, 0, 4.2); },
      setNight(v) { if (v !== look.night) { look.night = v; applyLook(); } },
      setWeather(v) { if (v !== look.weather) { look.weather = v; applyLook(); } },
      wind: (w) => ({ speed: 2.0 + w * 10, wind: [0.6 + w * w * 16, 0.2 + w * 3] }),
      avatarColors: { skin: '#f1c9a5', shirt: '#2f7fc4', pants: '#24324a' },
      bloom: (n, w) => ({ strength: THREE.MathUtils.lerp(0.2, 0.5, n) * (1 - 0.3 * w), radius: 0.35, threshold: THREE.MathUtils.lerp(1.6, 1.0, n) }),
      update(dt, t) {
        animated.forEach(f => f(t));
        twinkle.forEach((m, i) => m.color.setScalar((0.25 + 0.75 * look.night) * (0.72 + 0.28 * Math.sin(t * 2.1 + i * 2.1))));
        glow.color.setScalar(THREE.MathUtils.lerp(DAY.glow, NIGHT.glow, look.night) * (0.97 + 0.03 * Math.sin(t * 13.0) * Math.sin(t * 7.3)));
        smoke.uniforms.uTime.value = t;
      },
    };
  },
};
