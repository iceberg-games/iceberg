// Snowcone Plaza (set id `snowcone-plaza`, GM1 game `snowcone-tycoon`): sunny frost boardwalk + striped snowcone stand (lobby, counter/serve, shaver kitchen, machine floor
// with buy pads, patio, upstairs loft, rooftop sign deck). Procedural Three.js only. Open: /sets/?set=snowcone-plaza
// Soft-GPU: 7 point lights, 1024 shadow map, instanced Batches, ~140 animated drips/mist sprites, yields in create.
import * as THREE from 'three';
import { Batch, glowMaterial, rng } from './lib/blocks.js';
import { createSky } from './lib/sky.js';
import * as L from './layout.js';
import { SHOTS } from './shots.js';

const yieldFrame = () => new Promise(r => setTimeout(r, 0));
const hdr = (hex, k) => { const c = new THREE.Color(hex); k *= 0.6; return [c.r * k, c.g * k, c.b * k]; };
function softBox(round = 0.5, seg = 3) {
  const g = new THREE.BoxGeometry(1, 1, 1, seg, seg, seg), p = g.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); const n = v.clone().normalize().multiplyScalar(0.62); v.lerp(n, round); p.setXYZ(i, v.x, v.y, v.z); }
  g.computeVertexNormals(); return g;
}
const PASTEL = ['#ff8fd0', '#4ff0d0', '#ffd36b', '#9b8cff', '#7fd4ff', '#ffb3a7'];

export default {
  id: 'snowcone-plaza',
  name: 'Snowcone Plaza (Snowcone Tycoon)',
  // runtime reads these from the returned object, see below
  async create({ renderer, gameplay = false }) {   // gameplay: the game renders bottles + live customers itself
    const R = rng(4242);
    const scene = new THREE.Scene();
    const B = new Batch(), G = new Batch();
    const soft = softBox(0.45), sphere = new THREE.SphereGeometry(1, 18, 12), cyl = new THREE.CylinderGeometry(1, 1, 1, 20),
      cone = new THREE.ConeGeometry(1, 1, 16), torus = new THREE.TorusGeometry(1, 0.18, 8, 24), dome = new THREE.SphereGeometry(1, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2);
    const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, ...o });
    const M = {
      snow: std('#f3f8ff', { roughness: 0.9 }), tile: std('#ffffff', { roughness: 0.35, metalness: 0.05 }),
      wall: std('#ffffff', { roughness: 0.55 }), trim: std('#ffffff', { roughness: 0.4 }),
      ice: std('#bfeaff', { roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.55 }),
      glass: std('#e6f7ff', { roughness: 0.05, transparent: true, opacity: 0.35 }),
      metal: std('#dfe9f5', { roughness: 0.25, metalness: 0.8 }), wood: std('#c99a6b', { roughness: 0.7 }),
      cone: std('#e6b070', { roughness: 0.8 }), shave: std('#ffffff', { roughness: 0.95 }),
    };
    const glow = glowMaterial();

    // ---------- sky / fog / lights (dusk-candy) ----------
    const sky = createSky(); scene.add(sky.mesh);
    sky.uniforms.uNightTop.value.set('#1a1446'); if (sky.uniforms.uDayTop) sky.uniforms.uDayTop.value.set('#6fb8ff'); if (sky.uniforms.uDayHorizon) sky.uniforms.uDayHorizon.value.set('#ffe1f0'); sky.uniforms.uNightHorizon.value.set('#b0619a');
    scene.fog = new THREE.FogExp2('#3a2f66', 0.012);
    const hemi = new THREE.HemisphereLight('#ffd6f2', '#5a6aa8', 0.7); scene.add(hemi);
    const key = new THREE.DirectionalLight('#ffe9f5', 0.8); key.position.set(-14, 26, 20); scene.add(key);
    key.castShadow = true; key.shadow.mapSize.set(1024, 1024);
    Object.assign(key.shadow.camera, { left: -26, right: 26, top: 26, bottom: -26, near: 2, far: 80 });
    const pl = (col, x, y, z, I, d = 16) => { const p = new THREE.PointLight(col, I * 0.4, d, 1.8); p.position.set(x, y, z); p.userData.base = I * 0.4; p.userData.k = 1; scene.add(p); return p; };
    const lights = [  // 7 point lights
      pl('#ff8fd0', -4, 3, -3, 30), pl('#4ff0d0', 4, 3, -3, 30), pl('#ffd36b', 0, 3.4, -9, 26),
      pl('#9b8cff', 0, 6.4, -6, 18), pl('#ff6fb0', 0, 11.5, -12, 34, 22), pl('#ffc58a', -12, 3, 17, 26, 18), pl('#7fd4ff', 12, 3, 17, 26, 18),
    ];

    // ---------- ground: snow + pastel checker plaza ----------
    { const g = new THREE.PlaneGeometry(120, 120, 60, 60); g.rotateX(-Math.PI / 2);
      const p = g.attributes.position; for (let i = 0; i < p.count; i++) p.setY(i, L.groundHeight(p.getX(i), p.getZ(i)) - 0.02 + (Math.hypot(p.getX(i), p.getZ(i) - 4) > 26 ? R() * 0.15 : 0));
      g.computeVertexNormals(); const m = new THREE.Mesh(g, M.snow); m.receiveShadow = true; scene.add(m); }
    for (let x = -22; x <= 22; x += 2) for (let z = -18; z <= 28; z += 2) {
      if (Math.hypot(x, z - 4) > 27 || (z >= 3 && z <= 10)) continue;
      B.box(M.tile, x, 0.03, z, 1.96, 0.06, 1.96, ((x + z) / 2) & 1 ? '#f2b8dc' : '#a9dcf2');
    }
    // snow drifts around plaza edge
    for (let i = 0; i < 70; i++) { const a = R() * Math.PI * 2, r = 27.5 + R() * 4; B.add(M.snow, sphere, Math.sin(a) * r, 0, Math.cos(a) * r + 4, 1.2 + R() * 2.4, 0.5 + R() * 1, 1.2 + R() * 2.4); }
    await yieldFrame();

    // ---------- main stand building ----------
    const S = L.SHOP, x0 = S.x - S.w / 2, x1 = S.x + S.w / 2, zb = S.z - S.d / 2, zf = S.z + S.d / 2;
    B.box(M.tile, S.x, 0.08, S.z, S.w, 0.1, S.d, '#fff4fb');
    B.box(M.wall, S.x, S.roofY / 2, zb, S.w, S.roofY, 0.4, '#ffd9ee');                    // back wall
    for (const sx of [x0, x1]) B.box(M.wall, sx, S.roofY / 2, S.z, 0.4, S.roofY, S.d, '#cfefff');
    // striped back wall bands
    for (let i = 0; i < 8; i++) B.box(M.trim, x0 + 1 + i * 2, S.h / 2 + 0.2, zb + 0.22, 1, S.h - 0.4, 0.05, i & 1 ? '#ffffff' : '#ffb8dd');
    // front pillars (candy cane wraps)
    for (const px of [x0 + 0.3, -4, 4, x1 - 0.3]) { B.add(M.trim, cyl, px, S.h / 2, zf, 0.22, S.h, 0.22, '#ffffff');
      for (let k = 0; k < 7; k++) B.add(M.trim, torus, px, 0.35 + k * 0.55, zf, 0.24, 0.24, 0.24, k & 1 ? '#ff5fa2' : '#4ff0d0', [Math.PI / 2 + 0.35, 0, 0]); }
    // loft floor slab + balcony rail (front half open over counter)
    B.box(M.tile, S.x, S.loftY - 0.1, S.z, S.w, 0.25, S.d, '#e8f8ff');
    for (let x = x0 + 0.5; x <= x1 - 0.5; x += 0.7) B.add(M.metal, cyl, x, S.loftY + 0.5, zf - 0.1, 0.04, 1, 0.04);
    B.box(M.trim, S.x, S.loftY + 1.0, zf - 0.1, S.w, 0.1, 0.14, '#ff8fd0');
    // loft glass windows on back wall
    for (let i = 0; i < 4; i++) G.box(glow, x0 + 2.2 + i * 3.9, S.loftY + 2, zb + 0.23, 2.6, 1.6, 0.05, hdr(PASTEL[i], 0.9));
    // roof deck + scalloped awning
    B.box(M.tile, S.x, S.roofY, S.z, S.w + 0.6, 0.3, S.d + 0.6, '#ffffff');
    for (let x = x0 + 0.5; x <= x1 - 0.5; x += 0.8) B.add(M.metal, cyl, x, S.roofY + 0.55, zf + 0.2, 0.04, 1.1, 0.04);
    for (let i = 0; i < 20; i++) { const x = x0 - 0.3 + (i + 0.5) * (S.w + 0.6) / 20;
      B.box(M.trim, x, S.h + 0.35, zf + 1.0, (S.w + 0.6) / 20, 0.08, 2.0, i & 1 ? '#ffffff' : '#ff8fd0', [0.35, 0, 0]);
      B.add(M.trim, sphere, x, S.h - 0.05, zf + 1.92, 0.42, 0.25, 0.25, i & 1 ? '#ffffff' : '#ff8fd0'); }
    // icicle drips under awning (ice) + snow cap on roof
    for (let i = 0; i < 26; i++) B.add(M.ice, cone, x0 + 0.3 + i * 0.6, S.h - 0.35, zf + 2.0, 0.07, 0.4 + R() * 0.5, 0.07, '#ffffff', [Math.PI, 0, 0]);
    B.box(M.snow, S.x, S.roofY + 0.2, zb + 0.5, S.w + 0.4, 0.2, 1.2);
    // outside stair to loft (south→north up along east side)
    { const st = L.STAIRS, n = 14; for (let i = 0; i < n; i++) { const t = (i + 0.5) / n, z = st.z0 + (st.z1 - st.z0) * t;
      B.box(M.tile, st.x, t * st.y1 - 0.08, z, st.w, 0.18, Math.abs(st.z1 - st.z0) / n + 0.02, i & 1 ? '#ffd6ef' : '#d6f3ff'); }
      B.box(M.tile, st.x - 0.5, st.y1 - 0.1, st.z1 - 0.5, 2.6, 0.25, 2, '#e8f8ff');
      for (let i = 0; i <= n; i += 2) { const t = i / n; B.add(M.metal, cyl, st.x + st.w / 2, t * st.y1 + 0.5, st.z0 + (st.z1 - st.z0) * t, 0.04, 1, 0.04); } }
    // rooftop ladder (inside loft, back corner)
    for (let i = 0; i < 9; i++) B.box(M.metal, x0 + 1.2, S.loftY + 0.4 + i * 0.47, zb + 0.6, 0.8, 0.05, 0.05);
    await yieldFrame();

    // ---------- rooftop sign: giant snowcone + letters ----------
    { const sx = 0, sy = S.roofY + 0.2, sz = S.z - 2;
      B.box(M.metal, sx - 3, sy + 1, sz, 0.15, 2, 0.15); B.box(M.metal, sx + 3, sy + 1, sz, 0.15, 2, 0.15);
      B.add(M.trim, soft, sx, sy + 2.6, sz, 11, 1.6, 0.4, '#2a2160');
      const word = 'SNOWCONES'; for (let i = 0; i < word.length; i++) G.add(glow, soft, sx - 4.8 + i * 1.2, sy + 2.6, sz + 0.25, 0.85, 1.05, 0.12, hdr(PASTEL[i % 6], 2.2));
      // giant cone
      B.add(M.cone, cone, sx, sy + 5.2, sz, 1.3, 3.4, 1.3, '#e6b070', [Math.PI, 0, 0]);
      const dc = ['#ff4d6d', '#3fa7ff', '#ffd36b']; dc.forEach((c, i) => G.add(glow, sphere, sx + (i - 1) * 0.5, sy + 7.3 + (i === 1 ? 0.5 : 0), sz, 1.1, 1.0, 1.1, hdr(c, 0.75)));
      B.add(M.shave, sphere, sx, sy + 8.2, sz, 0.6, 0.45, 0.6, '#ffffff');
      G.add(glow, sphere, sx, sy + 8.75, sz, 0.28, 0.28, 0.28, hdr('#ff2a4d', 1.8)); }   // cherry
    for (const [x, , z] of L.ROOF_SEATS.map(s => [s.x, 0, s.z])) {   // rooftop beanbag stools + mini umbrellas
      B.add(M.wall, soft, x, S.roofY + 0.45, z + 2.5, 0.9, 0.6, 0.9, PASTEL[(x + 4) / 4 | 0]); }
    // string lights over plaza from roof to lantern poles
    const strings = [[[-8, S.h + 0.5, -5], [-14, 3.6, 11]], [[8, S.h + 0.5, -5], [14, 3.6, 11]], [[-14, 3.6, 11], [14, 3.6, 11]], [[0, S.h + 0.5, -5], [0, 3.8, 12]], [[-20, 3.6, 18], [20, 3.6, 18]]];
    let bi = 0; for (const [a, b] of strings) for (let i = 0; i <= 22; i++) { const t = i / 22, sag = Math.sin(t * Math.PI) * 0.9;
      G.add(glow, sphere, a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t - sag, a[2] + (b[2] - a[2]) * t, 0.09, 0.11, 0.09, hdr(PASTEL[bi++ % 6], 2.4)); }
    await yieldFrame();

    // ---------- counter, register, syrups, shavers ----------
    const syrupGlows = [];
    for (const c of L.COUNTERS) {
      B.add(M.wall, soft, c.x, c.h / 2, c.z, c.w, c.h, c.d, '#d6f3ff');
      B.box(M.tile, c.x, c.h + 0.04, c.z, c.w + 0.2, 0.08, c.d + 0.2, '#ffffff');
      for (let i = 0; i < c.w / 0.5; i++) G.box(glow, c.x - c.w / 2 + 0.25 + i * 0.5, 0.15, c.z + c.d / 2 + 0.01, 0.38, 0.06, 0.02, hdr(PASTEL[i % 6], 1.6));
      // glass sneeze guard + cone display
      B.box(M.glass, c.x, c.h + 0.45, c.z + 0.35, c.w * 0.8, 0.8, 0.04);
      for (let i = 0; i < Math.min(9, c.w / 0.9); i++) { const x = c.x - c.w * 0.36 + i * 0.9;
        B.add(M.cone, cone, x, c.h + 0.32, c.z - 0.2, 0.12, 0.42, 0.12, '#e6b070', [Math.PI, 0, 0]);
        G.add(glow, sphere, x, c.h + 0.6, c.z - 0.2, 0.16, 0.15, 0.16, hdr(PASTEL[(i + 2) % 6], 1.1)); }
    }
    // kiosk mini stands (canopies)
    for (const k of L.STANDS.slice(1)) { const col = k.id.includes('left') ? '#ff8fd0' : '#4ff0d0';
      for (const s of [-1, 1]) B.add(M.trim, cyl, k.x + s * 1.6, 1.5, k.z - 0.7, 0.08, 3, 0.08);
      for (let i = 0; i < 8; i++) B.box(M.trim, k.x - 1.75 + i * 0.5 + 0.25, 3.05, k.z - 0.2, 0.5, 0.06, 1.8, i & 1 ? '#ffffff' : col, [0.25, 0, 0]);
      B.add(M.cone, cone, k.x, 3.9, k.z - 0.6, 0.45, 1.2, 0.45, '#e6b070', [Math.PI, 0, 0]); G.add(glow, sphere, k.x, 4.6, k.z - 0.6, 0.5, 0.45, 0.5, hdr(col, 1.3)); }
    // cash register
    { const r = L.CASH_REGISTER; B.add(M.wall, soft, r.x, r.y + 0.25, r.z, 0.8, 0.5, 0.6, '#ff8fd0'); B.box(M.trim, r.x, r.y + 0.62, r.z - 0.1, 0.6, 0.3, 0.06, '#2a2160', [-0.4, 0, 0]);
      G.box(glow, r.x, r.y + 0.63, r.z - 0.06, 0.5, 0.2, 0.02, hdr('#7dff9a', 1.8)); B.add(M.metal, sphere, r.x + 0.48, r.y + 0.1, r.z + 0.1, 0.12, 0.08, 0.12); }
    // syrup rainbow dispensers (bottles + taps on a back bar)
    for (const b of L.BACK_BARS) B.add(M.wall, soft, (b.x0 + b.x1) / 2, 0.55, b.z, b.x1 - b.x0, 1.1, b.d, '#ffe4f3');
    if (!gameplay) for (const s of L.SYRUPS) {
      B.add(M.glass, cyl, s.x, s.y + 0.6, s.z, 0.32, 1.2, 0.32);
      const gi = G.add(glow, cyl, s.x, s.y + 0.5, s.z, 0.26, 0.95, 0.26, hdr(s.color, 1.2));
      B.add(M.metal, cyl, s.x, s.y + 1.25, s.z, 0.12, 0.12, 0.12); B.add(M.metal, cyl, s.x, s.y + 0.05, s.z + 0.3, 0.05, 0.25, 0.05);
      syrupGlows.push(gi);
    }
    // shaver machines (cute: rounded body, ice block in glass hopper, crank)
    const blades = [];
    for (const m of L.MACHINES) {
      if (m.kind === 'hopper') {   // chrome ice hopper w/ spinning blades (GM: ICE_HOPPER)
        B.add(M.metal, soft, m.x, 0.7, m.z, 1.7, 1.4, 1.3, '#e9f1fa'); B.add(M.glass, cyl, m.x, 2.0, m.z, 0.72, 1.2, 0.72);
        for (let k = 0; k < 7; k++) B.add(M.ice, soft, m.x + (R() - 0.5) * 0.8, 1.6 + R() * 0.7, m.z + (R() - 0.5) * 0.8, 0.4, 0.4, 0.4, '#e6f8ff', [R(), R(), R()]);
        const bl = new THREE.Group(); bl.position.set(m.x, 1.45, m.z); for (let k = 0; k < 4; k++) { const v = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.03, 0.14), M.metal); v.rotation.y = k * Math.PI / 4; bl.add(v); }
        scene.add(bl); blades.push(bl); B.add(M.metal, cyl, m.x, 2.66, m.z, 0.8, 0.1, 0.8);
        B.add(M.shave, sphere, m.x, 0.95, m.z + 0.7, 0.45, 0.3, 0.3); G.box(glow, m.x, 0.3, m.z + 0.66, 1.4, 0.06, 0.02, hdr('#4ff0d0', 2)); continue; }
      B.add(M.wall, soft, m.x, 0.7, m.z, 1.5, 1.4, 1.2, ['#ffffff', '#cfefff', '#ffd6ef'][m.level - 1]);
      B.add(M.glass, cyl, m.x, 1.85, m.z, 0.5, 0.9, 0.5);
      B.add(M.ice, soft, m.x, 1.8, m.z, 0.62, 0.62, 0.62, '#dff6ff');
      B.add(M.metal, dome, m.x, 2.3, m.z, 0.55, 0.3, 0.55);
      B.box(M.metal, m.x + 0.8, 1.6, m.z, 0.06, 0.7, 0.06); B.add(M.wall, sphere, m.x + 0.8, 1.95, m.z, 0.12, 0.12, 0.12, '#ff5fa2');
      B.add(M.shave, sphere, m.x, 0.95, m.z + 0.62, 0.35, 0.25, 0.25);  // shaved ice mound in the chute
      for (let s = 0; s < m.level; s++) G.add(glow, sphere, m.x - 0.4 + s * 0.4, 1.2, m.z + 0.61, 0.08, 0.08, 0.03, hdr('#ffd36b', 2.5));   // level stars
    }
    // menu boards above counter
    for (let i = 0; i < 3; i++) { const x = -4.5 + i * 4.5; B.add(M.trim, soft, x, 3.35, zb + 0.4, 3.4, 1.4, 0.12, '#2a2160');
      for (let k = 0; k < 4; k++) G.box(glow, x - 1.2, 3.8 - k * 0.3, zb + 0.48, 0.18, 0.14, 0.02, hdr(PASTEL[(i + k) % 6], 2));
      for (let k = 0; k < 4; k++) G.box(glow, x + 0.2, 3.8 - k * 0.3, zb + 0.48, 1.8, 0.06, 0.02, [1.6, 1.6, 1.8]); }
    await yieldFrame();

    // ---------- machine floor wings + buy pads ----------
    for (const s of [-1, 1]) { B.box(M.tile, s * 12.5, 0.07, -10.6, 6, 0.08, 11, s < 0 ? '#ffeefa' : '#eafbff');
      for (const z of [-16.5, -4.7]) for (const dx of [-3, 3]) B.add(M.trim, cyl, s * 12.5 + dx, 1.5, z, 0.12, 3, 0.12);
      for (let i = 0; i < 12; i++) B.box(M.trim, s * 12.5 - 3 + i * 0.5 + 0.25, 3.05, -10.6, 0.5, 0.06, 12, i & 1 ? '#ffffff' : (s < 0 ? '#ff8fd0' : '#4ff0d0')); }
    const padGlows = [];
    for (const p of L.PLACE_SPOTS) { B.add(M.wall, cyl, p.x, 0.12, p.z, 1.2, 0.12, 1.2, '#ffffff');
      padGlows.push(G.add(glow, torus, p.x, 0.2, p.z, 1.05, 1.05, 0.6, hdr('#7dff9a', 1.6), [Math.PI / 2, 0, 0]));
      G.add(glow, soft, p.x, 0.22, p.z, 0.35, 0.04, 0.35, hdr('#ffd36b', 2)); }
    for (const u of L.UPGRADE_PADS) { B.add(M.wall, cyl, u.x, 0.1, u.z, 1.0, 0.1, 1.0, '#ffffff');
      G.add(glow, torus, u.x, 0.17, u.z, 0.85, 0.85, 0.5, hdr(u.color, 2), [Math.PI / 2, 0, 0]);
      G.add(glow, cone, u.x, 1.6, u.z, 0.22, 0.4, 0.22, hdr(u.color, 1.8)); }   // floating up arrow (animated below)
    // queue rope posts
    for (let i = 0; i < 4; i++) for (const x of [-2.4, 0, 2.4]) { B.add(M.metal, cyl, x, 0.5, -0.2 + i * 1.3, 0.06, 1, 0.06); B.add(M.metal, sphere, x, 1.02, -0.2 + i * 1.3, 0.09, 0.09, 0.09); }
    for (const x of [-2.4, 0, 2.4]) B.box(M.trim, x, 0.85, 1.75, 0.05, 0.08, 3.9, '#ff5fa2');
    // toppings barrels
    for (const b of L.BARRELS) { B.add(M.wood, cyl, b.x, 0.55, b.z, 0.55, 1.1, 0.55, '#d9a877');
      for (const y of [0.2, 0.9]) B.add(M.metal, torus, b.x, y, b.z, 0.56, 0.56, 0.3, '#ffffff', [Math.PI / 2, 0, 0]);
      for (let i = 0; i < 14; i++) { const a = R() * 6.28, r = R() * 0.4; G.add(glow, sphere, b.x + Math.cos(a) * r, 1.12 + R() * 0.12, b.z + Math.sin(a) * r, 0.07, 0.05, 0.07, hdr(PASTEL[i % 6], 1.2)); } }
    await yieldFrame();

    // ---------- patio: tables, umbrellas, fountain, lanterns, ice sculptures ----------
    for (const s of L.SEATS) { B.add(M.trim, cyl, s.x, 0.75, s.z, 0.9, 0.08, 0.9, '#ffffff'); B.add(M.metal, cyl, s.x, 0.38, s.z, 0.07, 0.76, 0.07);
      B.add(M.metal, cyl, s.x, 1.6, s.z, 0.04, 3.2, 0.04); B.add(M.wall, cone, s.x, 3.25, s.z, 1.7, 0.55, 1.7, s.umbrella);
      B.add(M.snow, cone, s.x, 3.4, s.z, 1.25, 0.3, 1.25);
      for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + 0.4; B.add(M.wall, soft, s.x + Math.cos(a) * 1.25, 0.32, s.z + Math.sin(a) * 1.25, 0.55, 0.55, 0.55, PASTEL[(k + s.x) & 3 ? k : 5]); }
      B.add(M.cone, cone, s.x + 0.2, 0.95, s.z, 0.08, 0.28, 0.08, '#e6b070', [Math.PI, 0, 0]); G.add(glow, sphere, s.x + 0.2, 1.15, s.z, 0.12, 0.11, 0.12, hdr(s.umbrella, 1.2)); }
    { const f = L.FOUNTAIN; B.add(M.wall, cyl, f.x, 0.35, f.z, f.r, 0.7, f.r, '#cfefff'); B.add(M.ice, cyl, f.x, 0.72, f.z, f.r - 0.2, 0.06, f.r - 0.2, '#9fe4ff');
      B.add(M.wall, cyl, f.x, 1.3, f.z, 0.35, 1.6, 0.35, '#ffffff'); B.add(M.wall, cyl, f.x, 2.1, f.z, 1.2, 0.2, 1.2, '#ffd6ef');
      B.add(M.cone, cone, f.x, 3.0, f.z, 0.6, 1.5, 0.6, '#e6b070', [Math.PI, 0, 0]);
      G.add(glow, sphere, f.x, 4.0, f.z, 0.75, 0.7, 0.75, hdr('#ff8fd0', 0.9)); G.add(glow, sphere, f.x, 4.65, f.z, 0.2, 0.2, 0.2, hdr('#ff2a4d', 1.8)); }
    for (const [x, z] of L.LANTERNS) { B.add(M.metal, cyl, x, 1.8, z, 0.08, 3.6, 0.08, '#ffffff');
      G.add(glow, soft, x, 3.7, z, 0.5, 0.6, 0.5, hdr(PASTEL[(x * 3 + z) & 3 ? 2 : 0], 2)); B.add(M.snow, dome, x, 4.0, z, 0.35, 0.18, 0.35); }
    // ice crystal sculptures at plaza corners + pines with candy baubles
    for (const [x, z] of [[-22, -4], [22, -4], [-24, 24], [24, 24]]) for (let i = 0; i < 5; i++)
      B.add(M.ice, cone, x + (R() - 0.5) * 1.6, 1, z + (R() - 0.5) * 1.6, 0.4 + R() * 0.3, 2 + R() * 2.5, 0.4 + R() * 0.3, '#ffffff', [R() * 0.4 - 0.2, 0, R() * 0.4 - 0.2]);
    for (let i = 0; i < 34; i++) { const a = R() * Math.PI * 2, r = 33 + R() * 14, x = Math.sin(a) * r, z = Math.cos(a) * r + 4; if (z < -16 && Math.abs(x) < 10) continue;
      const y = L.groundHeight(x, z), h = 4 + R() * 4; B.add(M.wood, cyl, x, y + 0.5, z, 0.25, 1, 0.25, '#5a3d2b');
      for (let k = 0; k < 3; k++) { const s = (1 - k * 0.28) * h * 0.38; B.add(M.wall, cone, x, y + 1 + k * h * 0.26 + s * 0.5, z, s, s * 1.1, s, '#2f6b5c'); B.add(M.snow, cone, x, y + 1.15 + k * h * 0.26 + s * 0.62, z, s * 0.8, s * 0.5, s * 0.8); }
      G.add(glow, sphere, x + 0.6, y + 2.2, z + 0.4, 0.16, 0.16, 0.16, hdr(PASTEL[i % 6], 2)); }
    // ---------- frost boardwalk, ice railings, glacier backdrop, topping bar, customer slots ----------
    { const W = L.BOARDWALK; for (let z = W.minZ + 0.25; z < W.maxZ; z += W.plank) B.box(M.wood, 0, 0.06, z, W.maxX - W.minX, 0.12, W.plank - 0.04, (z * 4 | 0) % 3 ? '#cfa57a' : '#bb9068');
      for (let x = W.minX; x <= W.maxX; x += 4) B.box(M.snow, x + R(), 0.14, W.maxZ - 0.3 - R() * 0.4, 1.4 + R(), 0.08, 0.5); }
    for (const r of L.RAILINGS) { const [ax, az] = r.from, [bx, bz] = r.to, len = Math.hypot(bx - ax, bz - az), n = Math.round(len / 1.6);
      for (let i = 0; i <= n; i++) { const t = i / n; B.add(M.ice, cyl, ax + (bx - ax) * t, 0.55, az + (bz - az) * t, 0.09, 1.1, 0.09, '#dff6ff'); }
      B.box(M.ice, (ax + bx) / 2, 1.12, (az + bz) / 2, Math.abs(bx - ax) + 0.15, 0.12, Math.abs(bz - az) + 0.15, '#c8efff');
      B.box(M.snow, (ax + bx) / 2, 1.22, (az + bz) / 2, Math.abs(bx - ax) + 0.1, 0.06, Math.abs(bz - az) + 0.1); }
    const glacierM = std('#cfe9ff', { roughness: 0.35, flatShading: true, emissive: '#5a8cc4', emissiveIntensity: 0.08 });
    for (const g of L.GLACIERS) { B.add(glacierM, cone, g.x, g.h / 2 - 1, g.z, g.r, g.h, g.r * 0.8, '#d9efff', [0, R() * 3, 0]);
      B.add(glacierM, cone, g.x + g.r * 0.6, g.h * 0.32, g.z + 4, g.r * 0.6, g.h * 0.66, g.r * 0.5, '#bfe2ff', [0, R() * 3, 0.1]);
      B.add(M.snow, cone, g.x, g.h * 0.84 - 1, g.z, g.r * 0.34, g.h * 0.34, g.r * 0.28); }
    { const T = L.TOPPING_BAR; B.add(M.wall, soft, T.x, 0.55, T.z, 1.6, 1.1, 1.1, '#ffd6ef'); const tc = ['#ff8fd0', '#ff2a4d', '#ffffff', '#7fd4ff'];
      T.toppings.forEach((_, i) => { const x = T.x - 0.55 + i * 0.37; B.add(M.glass, cyl, x, T.y + 0.18, T.z, 0.16, 0.34, 0.16);
        for (let k = 0; k < 5; k++) G.add(glow, sphere, x + (R() - 0.5) * 0.15, T.y + 0.08 + R() * 0.2, T.z + (R() - 0.5) * 0.15, 0.04, 0.04, 0.04, hdr(tc[i], 1.4)); }); }
    L.CUSTOMER_SLOTS.forEach((c, i) => { G.add(glow, torus, c.x, 0.15, c.z, 0.55, 0.55, 0.3, hdr(PASTEL[i], 1.6), [Math.PI / 2, 0, 0]);
      for (let k = 0; k <= i; k++) G.add(glow, sphere, c.x - i * 0.1 + k * 0.2, 0.16, c.z + 0.75, 0.06, 0.03, 0.06, [1.4, 1.4, 1.4]); });
    B.build(scene); const gMeshes = G.build(scene, { cast: false, receive: false });
    await yieldFrame();

    // ---------- customers (cute blob NPCs) ----------
    const custGeo = softBox(0.7), custs = [];
    const mat = new Map(), mm = (h) => { if (!mat.has(h)) mat.set(h, std(h, { roughness: 0.55 })); return mat.get(h); };
    const eye = std('#141824', { roughness: 0.2 });
    function npc(x, y, z, facing, col, kind, holding) {
      const g = new THREE.Group(), b = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = facing; g.add(b);
      const add = (geo, m, px, py, pz, sx, sy, sz) => { const o = new THREE.Mesh(geo, m); o.position.set(px, py, pz); o.scale.set(sx, sy, sz); o.castShadow = true; b.add(o); return o; };
      add(custGeo, mm(col), 0, 0.5, 0, 0.8, 0.9, 0.7); add(custGeo, mm(kind === 'pen' ? '#2a3042' : '#f6e3d0'), 0, 1.25, 0, 0.75, 0.68, 0.68);
      if (kind === 'pen') add(custGeo, mm('#ffffff'), 0, 1.2, 0.2, 0.55, 0.5, 0.35);
      if (kind === 'bunny') for (const s of [-1, 1]) add(custGeo, mm('#ffffff'), s * 0.18, 1.8, 0, 0.16, 0.55, 0.12);
      else add(custGeo, mm(PASTEL[(custs.length + 3) % 6]), 0, 1.62, 0, 0.78, 0.22, 0.72);   // beanie
      for (const s of [-1, 1]) add(sphere, eye, s * 0.15, 1.28, 0.34, 0.05, 0.065, 0.03);
      if (holding) { add(cone, M.cone, 0.38, 0.75, 0.3, 0.08, 0.26, 0.08).rotation.x = Math.PI; add(sphere, mm(holding), 0.38, 0.93, 0.3, 0.12, 0.11, 0.12); }
      scene.add(g); custs.push({ b, ph: R() * 6.28, hop: kind === 'pen' }); return g;
    }
    const kinds = ['kid', 'pen', 'bunny'];
    if (!gameplay) L.CUSTOMER_SLOTS.forEach((q, i) => npc(q.x, 0.08, q.z, q.facing, PASTEL[(i + 2) % 6], kinds[(i + 1) % 3], null));
    if (!gameplay) L.QUEUE.forEach((q, i) => i < 5 && npc(q.x, 0.08, q.z, q.facing, PASTEL[i % 6], kinds[i % 3], null));
    L.SEATS.forEach((s, i) => { npc(s.x + Math.cos(0.4) * 1.25, 0.55, s.z + Math.sin(0.4) * 1.25, -Math.PI / 2 - 0.4 + Math.PI, PASTEL[(i + 1) % 6], kinds[(i + 1) % 3], PASTEL[i % 6]);
      if (i % 2) npc(s.x - 1.25 * Math.cos(0.4), 0.55, s.z - 1.25 * Math.sin(0.4), Math.PI / 2 - 0.4 + Math.PI, PASTEL[(i + 4) % 6], kinds[i % 3], PASTEL[(i + 2) % 6]); });
    for (const [x, z, f] of [...(gameplay ? [] : [[-5.6, -7.2, Math.PI], [5.6, -7.2, Math.PI]]), [-16, 4.6, Math.PI], [16, 4.6, Math.PI]]) npc(x, 0.08, z, 0, '#ffffff', 'kid', null);   // staff in aprons
    L.LOFT_SEATS.forEach((s, i) => i % 2 === 0 && npc(s.x, s.y, s.z, 0, PASTEL[(i + 2) % 6], kinds[i % 3], PASTEL[i % 6]));
    npc(-3, L.SHOP.roofY + 0.15, -8, 0.3, '#9b8cff', 'bunny', '#4ff0d0');
    [[-6, 18], [5, 20], [-3, 9], [8, 10], [-12, 8]].forEach(([x, z], i) => npc(x, 0.08, z, R() * 6, PASTEL[i], kinds[i % 3], i % 2 ? PASTEL[i + 1] : null));

    // ---------- sensory: syrup drips, ice mist, floating coin/ding sparkles ----------
    const dripGeo = new THREE.SphereGeometry(0.05, 8, 6), drips = [];
    for (const s of L.SYRUPS) for (let k = 0; k < 3; k++) { const m = new THREE.Mesh(dripGeo, glowMaterial({ color: new THREE.Color(s.color).multiplyScalar(1.4) }));
      m.scale.set(1, 1.6, 1); scene.add(m); drips.push({ m, x: s.x, z: s.z + 0.32, y0: s.y - 0.12, ph: k / 3 + R() * 0.1, sp: 0.6 + R() * 0.3 }); }
    const mistTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'); const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
      g.addColorStop(0, 'rgba(255,255,255,0.55)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
    const mists = [];
    for (const m of L.MACHINES) for (let k = 0; k < 6; k++) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: mistTex, color: '#e8f8ff', transparent: true, depthWrite: false, opacity: 0.4 }));
      scene.add(sp); mists.push({ sp, x: m.x, z: m.z + 0.6, ph: k / 6 }); }
    for (let k = 0; k < 10; k++) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: mistTex, color: '#cfe8ff', transparent: true, depthWrite: false, opacity: 0.25 }));   // fountain mist
      scene.add(sp); mists.push({ sp, x: L.FOUNTAIN.x, z: L.FOUNTAIN.z, ph: k / 10, wide: 1 }); }
    const sparkGeo = new THREE.OctahedronGeometry(0.12), sparks = [];
    for (let k = 0; k < 24; k++) { const m = new THREE.Mesh(sparkGeo, glowMaterial({ color: new THREE.Color(k % 3 ? '#ffd36b' : '#ffffff').multiplyScalar(1.6) })); scene.add(m);
      sparks.push({ m, ph: R(), x: L.CASH_REGISTER.x + (R() - 0.5) * 0.6, z: L.CASH_REGISTER.z + (R() - 0.5) * 0.4 }); }
    const coins = []; for (const u of L.UPGRADE_PADS) { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.06, 18), glowMaterial({ color: new THREE.Color('#ffd36b').multiplyScalar(1.8) }));
      m.rotation.x = Math.PI / 2; m.position.set(u.x, 2.3, u.z); scene.add(m); coins.push(m); }

    // ---------- look ----------
    const look = { night: 1, weather: 0 };
    function applyLook() { const n = look.night;
      scene.fog.density = 0.006 + n * 0.008 + look.weather * 0.012; scene.fog.color.set('#3a2f66').lerp(new THREE.Color('#cfe6ff'), 1 - n);
      hemi.intensity = 0.7 + (1 - n) * 0.6; key.intensity = 0.8 + (1 - n) * 1.9; key.color.set('#ffe9f5').lerp(new THREE.Color('#fff2d6'), 1 - n); lights.forEach((l, i) => { l.userData.k = 0.35 + 0.65 * n; });
      sky.uniforms.uNight.value = n; renderer.toneMappingExposure = 0.92; }
    applyLook();

    return {
      scene, shots: SHOTS, blades, defaultNight: 0, defaultSnow: 1,
      snow: { count: 4000, box: 60, height: 26 },
      spawn: { pos: [L.SPAWN.x, 0.1, L.SPAWN.z], facing: L.SPAWN.facing },
      walkBounds: { type: 'box', ...L.BOUNDS },
      groundHeight: L.floorHeight,
      layout: L,
      setNight(v) { if (v !== look.night) { look.night = v; applyLook(); } },
      setWeather(v) { if (v !== look.weather) { look.weather = v; applyLook(); } },
      wind: (w) => ({ speed: 0.8 + w * 4, wind: [0.2 + w * 6, 0.1 + w * 2] }),
      avatarColors: { skin: '#f1c9a5', shirt: '#ff8fd0', pants: '#2a2160' },
      bloom: (n) => ({ strength: 0.4 + n * 0.2, radius: 0.5, threshold: 1.05 }),
      update(dt, t) {
        sky.uniforms.uTime.value = t;
        for (const d of drips) { const u = (t * d.sp + d.ph) % 1; d.m.position.set(d.x, d.y0 - u * 0.9, d.z); d.m.scale.setScalar(u < 0.15 ? u / 0.15 : 1).y *= 1.6; }
        for (const m of mists) { const u = (t * 0.25 + m.ph) % 1, w = m.wide ? 1.6 : 0.4;
          m.sp.position.set(m.x + Math.sin(u * 6 + m.ph * 9) * w * 0.5, (m.wide ? 0.9 : 1.1) + u * (m.wide ? 3.2 : 1.8), m.z + Math.cos(u * 5 + m.ph * 7) * w * 0.3);
          m.sp.scale.setScalar(0.4 + u * (m.wide ? 2.2 : 1.1)); m.sp.material.opacity = (m.wide ? 0.12 : 0.2) * Math.sin(u * Math.PI); }
        const ding = (t % 3.2) / 3.2;   // order-ding burst every 3.2s
        for (const s of sparks) { const u = (ding + s.ph * 0.3) % 1; s.m.position.set(s.x + Math.sin(s.ph * 40) * u * 0.8, L.CASH_REGISTER.y + 0.7 + u * 1.6, s.z + Math.cos(s.ph * 40) * u * 0.5);
          s.m.scale.setScalar(Math.max(0, 1 - u) * 1.2); s.m.rotation.y = t * 3; }
        coins.forEach((c, i) => { c.rotation.z = t * 2 + i; c.position.y = 2.3 + Math.sin(t * 2 + i) * 0.15; });
        for (const c of custs) { const s = Math.sin(t * (c.hop ? 5 : 2.2) + c.ph); c.b.position.y = c.hop ? Math.max(0, s) * 0.12 : 0; c.b.scale.set(1 + s * 0.025, 1 - s * 0.03, 1 + s * 0.025); }
        lights.forEach(l => { l.intensity = l.userData.base * l.userData.k; }); lights[4].intensity *= (0.85 + 0.15 * Math.sin(t * 2.1));
        for (const b of blades) b.rotation.y = t * 9;
      },
    };
  },
};
