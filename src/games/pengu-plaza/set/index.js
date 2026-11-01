// Pengu Plaza bones (filming set). GM2 owns the playable game in /workspace/bw-pengu-plaza — this is a
// lightweight procedural stand-in matching GM2's config coordinates. Open: /sets/?set=pengu-plaza  (5 point lights)
import * as THREE from 'three';
import { Batch, glowMaterial, rng } from './lib/blocks.js';
import { createSky } from './lib/sky.js';
import * as L from './layout.js';
import { SHOTS } from './shots.js';
const hdr = (h, k) => { const c = new THREE.Color(h); return [c.r * k, c.g * k, c.b * k]; };
const yieldFrame = () => new Promise(r => setTimeout(r, 0));
export default {
  id: 'pengu-plaza', name: 'Pengu Plaza (bones)',
  async create({ renderer }) {
    const R = rng(77), scene = new THREE.Scene(), B = new Batch(), G = new Batch(), glow = glowMaterial();
    const box = new THREE.BoxGeometry(1, 1, 1), cyl = new THREE.CylinderGeometry(1, 1, 1, 20), sph = new THREE.SphereGeometry(1, 16, 12), cone = new THREE.ConeGeometry(1, 1, 12), tor = new THREE.TorusGeometry(1, 0.12, 8, 40);
    const std = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.6, ...o });
    const M = { snow: std('#f1f7ff', { roughness: 0.9 }), stone: std('#dfe8f5'), ice: std('#bfe9ff', { roughness: 0.05, metalness: 0.3 }), wood: std('#8a5a3c'), paint: std('#ffffff'), glass: std('#cfefff', { transparent: true, opacity: 0.6, roughness: 0.1 }) };
    const sky = createSky(); scene.add(sky.mesh); scene.fog = new THREE.FogExp2('#1b2a52', 0.016);
    const hemi = new THREE.HemisphereLight('#bcd2ff', '#40466a', 0.85); scene.add(hemi);
    const key = new THREE.DirectionalLight('#dfe9ff', 0.8); key.position.set(-20, 30, 20); key.castShadow = true; key.shadow.mapSize.set(1024, 1024);
    Object.assign(key.shadow.camera, { left: -36, right: 36, top: 36, bottom: -36, near: 2, far: 90 }); scene.add(key);
    const lights = [['#ffb070', L.COCOA.x, 3, L.COCOA.z], ['#8ff0ff', 0, 3, -16], ['#ffd08a', 0, 4, 2], ['#c49bff', 0, 5, 33], ['#ffb070', 24, 3, 18]].map(([c, x, y, z]) => { const p = new THREE.PointLight(c, 14, 20, 1.6); p.position.set(x, y, z); scene.add(p); return p; });
    { const g = new THREE.PlaneGeometry(140, 140, 60, 60); g.rotateX(-Math.PI / 2); const p = g.attributes.position; for (let i = 0; i < p.count; i++) p.setY(i, L.groundHeight(p.getX(i), p.getZ(i)));
      g.computeVertexNormals(); const m = new THREE.Mesh(g, M.snow); m.receiveShadow = true; scene.add(m); }
    // cobble rings
    for (let r = 3; r < L.PLAZA_R; r += 1.4) { const n = Math.floor(r * 4); for (let i = 0; i < n; i++) { const a = i / n * 6.283 + r; const x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (((x - L.RINK.x) / L.RINK.rx) ** 2 + ((z - L.RINK.z) / L.RINK.rz) ** 2 < 1.1) continue; B.box(M.stone, x, 0.03, z, 1.1, 0.06, 0.9, (i + r | 0) % 3 ? '#e4ecf7' : '#cdd9ea', [0, -a, 0]); } }
    // rink
    { const g = new THREE.CircleGeometry(1, 48); g.rotateX(-Math.PI / 2); const m = new THREE.Mesh(g, M.ice); m.scale.set(L.RINK.rx, 1, L.RINK.rz); m.position.set(L.RINK.x, 0.07, L.RINK.z); m.receiveShadow = true; scene.add(m);
      for (let i = 0; i < 64; i++) { const a = i / 64 * 6.283, x = L.RINK.x + Math.cos(a) * (L.RINK.rx + 0.3), z = L.RINK.z + Math.sin(a) * (L.RINK.rz + 0.3);
        B.box(M.paint, x, 0.35, z, 0.25, 0.7, 1.1, i % 2 ? '#ffffff' : '#7fd4ff', [0, -Math.atan2(Math.sin(a) * L.RINK.rx, Math.cos(a) * L.RINK.rz), 0]); if (i % 8 === 0) G.add(glow, sph, x, 0.85, z, 0.12, 0.12, 0.12, hdr('#ffd08a', 2)); } }
    // cocoa stand
    { const c = L.COCOA; B.box(M.wood, c.x, 0.55, c.z, 3.4, 1.1, 1.4); for (const s of [-1, 1]) B.add(M.wood, cyl, c.x + s * 1.6, 1.5, c.z - 0.5, 0.08, 3, 0.08);
      for (let i = 0; i < 8; i++) B.box(M.paint, c.x - 1.75 + i * 0.5 + 0.25, 3.0, c.z, 0.5, 0.06, 1.9, i % 2 ? '#ffffff' : '#c8743c', [0.2, 0, 0]);
      for (let i = 0; i < 5; i++) { B.add(M.paint, cyl, c.x - 1.2 + i * 0.6, 1.25, c.z + 0.3, 0.13, 0.28, 0.13, '#f6e6d6'); B.add(M.wood, cyl, c.x - 1.2 + i * 0.6, 1.38, c.z + 0.3, 0.11, 0.02, 0.11, '#5a3020'); }
      G.box(glow, c.x, 2.4, c.z + 0.7, 2.2, 0.4, 0.05, hdr('#ffb070', 1.6)); }
    // bell
    { const b = L.BELL; B.add(M.stone, cyl, b.x, 0.2, b.z, 1.2, 0.4, 1.2); for (const s of [-1, 1]) B.add(M.wood, cyl, b.x + s * 0.9, 1.6, b.z, 0.1, 2.8, 0.1); B.box(M.wood, b.x, 3.0, b.z, 2.1, 0.18, 0.2);
      B.add(M.paint, cone, b.x, 2.5, b.z, 0.5, 0.75, 0.5, '#ffd36b'); }
    // fountain at PROPS.fountain (0,6) = GM2 game fountain, arch, ice pengu, lantern lane
    { const f = L.PROPS.fountain; B.add(M.stone, cyl, f.x, 0.35, f.z, 2.6, 0.7, 2.6); B.add(M.ice, cyl, f.x, 0.72, f.z, 2.3, 0.05, 2.3); B.add(M.ice, cone, f.x, 2, f.z, 0.6, 2.4, 0.6, '#dff6ff'); }
    { const a = L.PROPS.arch; const m = new THREE.Mesh(new THREE.TorusGeometry(5, 0.45, 10, 40, Math.PI), M.ice); m.position.set(a.x, 0, a.z); m.castShadow = true; scene.add(m);
      for (let i = 0; i <= 20; i++) { const t = i / 20 * Math.PI; G.add(glow, sph, a.x + Math.cos(t) * 5, Math.sin(t) * 5, a.z + 0.5, 0.14, 0.14, 0.14, hdr(['#7fd4ff', '#c49bff', '#4ff0d0'][i % 3], 2.2)); } }
    { const p = L.PROPS.icePengu; B.add(M.ice, sph, p.x, 3, p.z, 2.6, 3.4, 2.3, '#cdefff'); B.add(M.ice, sph, p.x, 6.6, p.z, 1.8, 1.7, 1.7, '#dff6ff'); B.add(M.paint, cone, p.x, 6.4, p.z + 1.8, 0.35, 0.8, 0.35, '#ffb02e', [Math.PI / 2, 0, 0]);
      for (const s of [-1, 1]) { B.add(M.ice, sph, p.x + s * 2.5, 3, p.z, 0.5, 2, 0.9, '#cdefff', [0, 0, s * 0.3]); B.add(M.paint, sph, p.x + s * 0.6, 7, p.z + 1.5, 0.18, 0.22, 0.1, '#141824'); } }
    for (let i = 0; i < 6; i++) { const x = 18 + i * 1.8, z = 12 + i * 1.6; B.add(M.wood, cyl, x, 1.6, z, 0.07, 3.2, 0.07, '#2b2f45'); G.add(glow, box, x, 3.3, z, 0.35, 0.45, 0.35, hdr('#ffc070', 2)); }
    // benches (seats) + photo markers
    for (const s of L.SEATS) B.box(M.wood, s.x, 0.45, s.z, 1.8, 0.12, 0.6, '#a0704a', [0, s.rot, 0]);
    for (const s of L.SEATS) B.box(M.wood, s.x + Math.sin(s.rot) * -0.3, 0.8, s.z + Math.cos(s.rot) * -0.3, 1.8, 0.5, 0.08, '#a0704a', [0, s.rot, 0]);
    for (const p of L.PHOTO_SPOTS) { G.add(glow, tor, p.x, 0.08, p.z, 0.7, 0.7, 0.5, hdr('#ff8fd0', 1.6), [Math.PI / 2, 0, 0]); B.add(M.paint, box, p.x + 0.9, 0.6, p.z, 0.08, 1.2, 0.08, '#2b2f45'); B.add(M.paint, box, p.x + 0.9, 1.25, p.z, 0.4, 0.3, 0.05, '#ff8fd0'); }
    // pines
    for (let i = 0; i < 40; i++) { const a = R() * 6.283, r = L.PLAZA_R + 3 + R() * 16, x = Math.cos(a) * r, z = Math.sin(a) * r, y = L.groundHeight(x, z), h = 4 + R() * 4;
      for (let k = 0; k < 3; k++) { const s = (1 - k * 0.28) * h * 0.38; B.add(M.paint, cone, x, y + 1 + k * h * 0.26 + s * 0.5, z, s, s * 1.1, s, '#1f4a3c'); B.add(M.snow, cone, x, y + 1.15 + k * h * 0.26 + s * 0.62, z, s * 0.8, s * 0.5, s * 0.8); } }
    await yieldFrame();
    // penguin NPCs at stand points
    const peng = [];
    for (const n of L.NPC_POINTS) { const g = new THREE.Group(); g.position.set(n.x, 0, n.z); g.rotation.y = n.facing;
      const add = (geo, c, x, y, z, sx, sy, sz) => { const o = new THREE.Mesh(geo, std(c)); o.position.set(x, y, z); o.scale.set(sx, sy, sz); o.castShadow = true; g.add(o); };
      add(sph, '#2a3042', 0, 0.6, 0, 0.5, 0.62, 0.45); add(sph, '#f7f7f2', 0, 0.55, 0.18, 0.38, 0.5, 0.3); add(sph, '#2a3042', 0, 1.25, 0, 0.36, 0.34, 0.34);
      add(cone, '#ffb02e', 0, 1.2, 0.38, 0.08, 0.18, 0.08); for (const s of [-1, 1]) { add(sph, '#141824', s * 0.13, 1.32, 0.3, 0.05, 0.06, 0.03); add(sph, '#ffb02e', s * 0.16, 0.05, 0.15, 0.13, 0.05, 0.2); }
      add(tor, ['#ff5fa2', '#4ff0d0', '#ffd36b', '#9b8cff'][peng.length % 4], 0, 1.0, 0, 0.36, 0.36, 0.6); g.children.at(-1).rotation.x = Math.PI / 2;
      scene.add(g); peng.push({ g, n, ph: R() * 6 }); }
    B.build(scene); G.build(scene, { cast: false, receive: false });
    const look = { night: 1, weather: 0 };
    const apply = () => { const n = look.night; scene.fog.color.set('#1b2a52').lerp(new THREE.Color('#c9d8ec'), 1 - n); scene.fog.density = 0.012 + look.weather * 0.02; hemi.intensity = 0.85 + (1 - n) * 0.7; key.intensity = 0.8 + (1 - n); sky.uniforms.uNight.value = n; lights.forEach(l => l.visible = n > 0.25); };
    apply();
    return { scene, shots: SHOTS, snow: { count: 5000, box: 60, height: 26 }, spawn: { pos: [L.SPAWN.x, 0.1, L.SPAWN.z], facing: L.SPAWN.facing }, walkBounds: { type: 'box', ...L.BOUNDS },
      groundHeight: L.groundHeight, layout: L,
      setNight(v) { look.night = v; apply(); }, setWeather(v) { look.weather = v; apply(); },
      bloom: (n) => ({ strength: 0.45 + n * 0.2, radius: 0.5, threshold: 1 }),
      update(dt, t) { sky.uniforms.uTime.value = t;
        for (const p of peng) { const s = Math.sin(t * 3 + p.ph);
          if (p.n.pose === 'skate') { const a = t * 0.35 + p.ph; p.g.position.set(L.RINK.x + Math.cos(a) * L.RINK.rx * 0.6, 0.07, L.RINK.z + Math.sin(a) * L.RINK.rz * 0.6); p.g.rotation.y = -a; p.g.rotation.z = 0.12; }
          else if (p.n.pose === 'dance') { p.g.rotation.y = t * 2; p.g.position.y = Math.abs(s) * 0.2; }
          else p.g.rotation.z = s * 0.06; } } };
  },
};
