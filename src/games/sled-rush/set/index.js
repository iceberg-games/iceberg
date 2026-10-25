// Sled Rush: night powder mountain sled run (lodge → winding track → finish banner). Filming set + gameplay source.
// Procedural Three.js only (Iceberg original). Layout/terrain math lives in layout.js (pure data) for the game to copy.
import * as THREE from 'three';
import { Batch, glowMaterial, rng } from './lib/blocks.js';
import { createSky } from './lib/sky.js';
import { TRACK, RAMPS, BOOST_PADS, LODGE, FINISH, AREAS, ANCHORS, centerX, groundHeight, trackSamples, fbm } from './layout.js';
import { SHOTS } from './shots.js';

const C = (h) => new THREE.Color(h);
const hdr = (hex, k) => { const c = new THREE.Color(hex).multiplyScalar(k); return [c.r, c.g, c.b]; };

export default {
  id: 'sled-rush',
  name: 'Sled Rush',
  async create({ renderer }) {
    const R = rng(777);
    const scene = new THREE.Scene();
    const B = new Batch(), G = new Batch();
    const animated = [];
    const M = {
      wood: new THREE.MeshStandardMaterial({ color: '#7a4a2a', roughness: 0.85 }),
      dark: new THREE.MeshStandardMaterial({ color: '#3b2618', roughness: 0.9 }),
      snow: new THREE.MeshStandardMaterial({ color: '#f4f8ff', roughness: 0.9, flatShading: true }),
      pine: new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.8, flatShading: true }),
      stone: new THREE.MeshStandardMaterial({ color: '#7d8798', roughness: 0.9, flatShading: true }),
      flag: new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.7 }),
      ice: new THREE.MeshStandardMaterial({ color: '#bfe6ff', roughness: 0.15, emissive: '#2a7fc4', emissiveIntensity: 0.35 }),
    };
    const glow = glowMaterial(), boostGlow = glowMaterial(), archGlow = glowMaterial();

    // ---- sky / light ----
    const sky = createSky(); scene.add(sky.mesh);
    sky.uniforms.uAurora.value = 1.3;
    scene.fog = new THREE.FogExp2('#16294a', 0.0028);
    const hemi = new THREE.HemisphereLight('#5577b8', '#141c30', 0.9); scene.add(hemi);
    const key = new THREE.DirectionalLight('#a9c2ff', 1.3);
    key.position.set(-120, 260, -200); key.target.position.set(0, 60, -260);
    key.castShadow = true; key.shadow.mapSize.set(2048, 2048);
    Object.assign(key.shadow.camera, { left: -340, right: 340, top: 340, bottom: -340, near: 10, far: 900 });
    key.shadow.bias = -0.0004; key.shadow.normalBias = 0.06;
    scene.add(key, key.target);

    // ---- terrain (vertex colored; groomed track tinted blue-white with sled grooves) ----
    {
      const W = 520, L = 760, nx = 260, nz = 380;
      const geo = new THREE.PlaneGeometry(W, L, nx, nz).rotateX(-Math.PI / 2).translate(0, 0, -260);
      const pos = geo.attributes.position;
      for (let i = 0; i < pos.count; i++) pos.setY(i, groundHeight(pos.getX(i), pos.getZ(i)));
      geo.computeVertexNormals();
      const col = new Float32Array(pos.count * 3), c = new THREE.Color();
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i), z = pos.getZ(i), d = Math.abs(x - centerX(z));
        const onTrack = d < TRACK.halfWidth;
        c.set('#eef4ff').lerp(C('#d3e0f2'), fbm(x * 0.07, z * 0.07) * 0.7);
        if (onTrack) { c.set('#dfeaff'); if (Math.abs(d - 2.5) < 0.45 || Math.abs(d - 5.5) < 0.45) c.set('#b8cbe8'); }
        col.set([c.r, c.g, c.b], i * 3);
      }
      geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
      const t = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, flatShading: true }));
      t.receiveShadow = true; scene.add(t);
    }

    // ---- edge markers: lantern posts + red/blue gate poles along both banks ----
    const S = trackSamples(4);
    S.forEach(([x, , z], i) => {
      const dz = (S[Math.min(i + 1, S.length - 1)][0] - x);
      for (const s of [-1, 1]) {
        const ex = x + s * (TRACK.halfWidth + 1.2) + dz * 0, ey = groundHeight(ex, z);
        if (i % 3 === 0) { B.box(M.dark, ex, ey + 1.1, z, 0.25, 2.2, 0.25); G.box(glow, ex, ey + 2.4, z, 0.55, 0.55, 0.55, hdr(i % 6 ? '#ffb057' : '#7fe3ff', 3)); }
        else if (i % 3 === 1) B.box(M.flag, ex, ey + 0.8, z, 0.2, 1.6, 0.2, s < 0 ? '#ff4d5a' : '#3f8cff');
      }
    });

    // ---- pines lining the run + forest beyond ----
    const pine = (x, z, s) => {
      const y = groundHeight(x, z);
      B.box(M.dark, x, y + s * 0.6, z, s * 0.35, s * 1.2, s * 0.35);
      for (let k = 0; k < 4; k++) {
        const w = s * (2.4 - k * 0.5), yy = y + s * (1.2 + k * 0.85);
        B.box(M.pine, x, yy, z, w, s * 0.8, w, k % 2 ? '#1f5a3a' : '#24684a');
        B.box(M.snow, x, yy + s * 0.42, z, w * 0.8, s * 0.12, w * 0.8);
      }
    };
    for (let z = 30; z > -600; z -= 5) {
      for (const s of [-1, 1]) {
        if (R() < 0.6) pine(centerX(z) + s * (TRACK.halfWidth + 5 + R() * 6), z + R() * 3, 1.4 + R() * 1.2);
        for (let k = 0; k < 2; k++) if (R() < 0.5) pine(centerX(z) + s * (TRACK.halfWidth + 14 + R() * 120), z + R() * 5, 1.5 + R() * 2);
      }
    }
    // rocks
    for (let i = 0; i < 90; i++) { const z = -R() * 580, x = centerX(z) + (R() < 0.5 ? -1 : 1) * (TRACK.halfWidth + 10 + R() * 80), s = 1 + R() * 3; B.box(M.stone, x, groundHeight(x, z) + s * 0.3, z, s * 1.4, s, s * 1.2, 0xffffff, [0, R() * 3, 0]); }

    // ---- summit lodge (warm windows) + start gate ----
    {
      const { x, z, w, d, deckY: y } = LODGE;
      B.box(M.wood, x, y - 1, z - 4, w + 10, 2, d + 18);                  // deck
      B.box(M.wood, x, y + 4, z + 2, w, 8, d);                            // cabin
      for (let k = 0; k < 6; k++) B.box(M.dark, x, y + 8.4 + k * 0.9, z + 2, w + 2 - k * 4, 0.9, d + 2, 0xffffff);   // stepped roof
      for (let k = 0; k < 6; k++) B.box(M.snow, x, y + 8.9 + k * 0.9, z + 2, w + 2.2 - k * 4, 0.25, d + 2.2);
      B.box(M.stone, x + 7, y + 11, z + 4, 2, 8, 2);                       // chimney
      for (let k = -3; k <= 3; k++) if (k) G.box(glow, x + k * 2.8, y + 4, z + 2 - d / 2 - 0.05, 1.6, 2.2, 0.1, hdr('#ffb057', 4));
      G.box(glow, x, y + 3, z + 2 - d / 2 - 0.06, 2.4, 5, 0.1, hdr('#ffd27a', 2.5));   // door glow
      const warm = new THREE.PointLight('#ffa64d', 60, 40, 1.6); warm.position.set(x, y + 4, z - 8); scene.add(warm);
      // start gate
      for (const s of [-1, 1]) B.box(M.wood, s * (TRACK.halfWidth + 0.5), y + 3, 0, 0.8, 6, 0.8);
      B.box(M.wood, 0, y + 6.2, 0, TRACK.width + 2, 0.8, 0.8);
      for (let k = 0; k < 9; k++) G.box(glow, -8 + k * 2, y + 5.6, -0.45, 0.5, 0.5, 0.2, hdr(['#ffcf73', '#ff6a5c', '#7fe3ff'][k % 3], 4));
      // lantern string from lodge to gate
      for (let k = 0; k < 10; k++) G.box(glow, -6 + k * 1.3, y + 4.5 - Math.sin(k / 9 * Math.PI) * 0.8, 10, 0.35, 0.45, 0.35, hdr('#ffcf73', 5));
    }

    // ---- ramps (blocky ice kickers) ----
    for (const r of RAMPS) {
      for (let k = 0; k < 8; k++) {
        const z = r.z + r.length - (k + 0.5) * r.length / 8, x = centerX(z);
        G.box(glow, x - TRACK.halfWidth + 1.4, groundHeight(x, z) + 0.15, z, 0.3, 0.3, r.length / 8 - 0.2, hdr('#7fe3ff', 3));
        G.box(glow, x + TRACK.halfWidth - 1.4, groundHeight(x, z) + 0.15, z, 0.3, 0.3, r.length / 8 - 0.2, hdr('#7fe3ff', 3));
      }
      const lx = centerX(r.z); B.box(M.ice, lx, groundHeight(lx, r.z + 0.4) - 0.2, r.z + 0.2, TRACK.width - 3, 0.6, 0.6);
    }

    // ---- boost pads: glowing chevrons (pulse) ----
    for (const b of BOOST_PADS) {
      const y = groundHeight(b.x, b.z) + 0.08;
      for (let k = 0; k < 3; k++) for (const s of [-1, 1])
        G.box(boostGlow, b.x + s * 0.8, y, b.z + 1.4 - k * 1.3, 1.8, 0.1, 0.4, hdr('#ff9a2e', 1), [0, s * 0.6, 0]);
      G.box(boostGlow, b.x, y - 0.02, b.z, b.radius * 2, 0.04, b.radius * 2, hdr('#ff5a1a', 0.25));
    }

    // ---- finish banner arch ----
    {
      const { x, z, archWidth: w, archHeight: h } = FINISH, y = groundHeight(x, z);
      for (const s of [-1, 1]) { B.box(M.ice, x + s * w / 2, y + h / 2, z, 1.6, h, 1.6); G.box(archGlow, x + s * w / 2, y + h + 0.6, z, 1.2, 1.2, 1.2, hdr('#ffcf73', 5)); }
      B.box(M.flag, x, y + h - 0.8, z, w, 2.4, 0.3, '#ff3b4e');            // banner
      for (let k = 0; k < 12; k++) B.box(M.flag, x - w / 2 + 1 + k * (w - 2) / 11, y + h - 0.8, z - 0.2, (w - 2) / 24, 2.0, 0.1, k % 2 ? '#111111' : '#ffffff');
      for (let k = 0; k < 16; k++) G.box(archGlow, x - w / 2 + k * w / 15, y + h + 0.6, z, 0.4, 0.4, 0.4, hdr(['#ffcf73', '#ff6a5c', '#7fe3ff', '#9dff9a'][k % 4], 5));
      for (let k = -8; k <= 8; k++) B.box(M.flag, x + k, y + 0.03, z, 1, 0.05, 0.8, (k & 1) ? '#111111' : '#ffffff');   // checkered line
      // warm hut + bonfire at the run-out
      B.box(M.wood, x + 18, y + 2.5, z - 20, 8, 5, 6); G.box(glow, x + 18, y + 2.5, z - 16.95, 3, 1.6, 0.1, hdr('#ffb057', 4));
      G.box(glow, x - 14, y + 0.8, z - 18, 1.2, 1.6, 1.2, hdr('#ff7a2a', 6));
      const fire = new THREE.PointLight('#ff8a3c', 50, 30, 1.6); fire.position.set(x - 14, y + 2, z - 18); scene.add(fire);
      animated.push((t) => { fire.intensity = 45 + 10 * Math.sin(t * 11) * Math.sin(t * 7.3); });
    }

    B.build(scene); G.build(scene, { cast: false, receive: false });

    // powder spray puffs: kicked-up sparkle drifting over the track (cheap Points)
    {
      const n = 4000, p = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { const z = 20 - Math.random() * 580, x = centerX(z) + (Math.random() - 0.5) * TRACK.width * 1.2; p.set([x, groundHeight(x, z) + Math.random() * 1.5, z], i * 3); }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3));
      const pts = new THREE.Points(g, new THREE.PointsMaterial({ color: '#e8f2ff', size: 0.18, transparent: true, opacity: 0.7, depthWrite: false }));
      scene.add(pts); animated.push((t) => { pts.material.opacity = 0.5 + 0.25 * Math.sin(t * 1.7); });
    }

    let night = 1, weather = 0.55;
    const apply = () => {
      sky.uniforms.uNight.value = night; sky.uniforms.uStorm.value = Math.max(0, weather - 0.6) * 2;
      scene.fog.color.set('#d9e9f8').lerp(C('#16294a'), night); scene.fog.density = 0.0022 + weather * 0.004;
      hemi.intensity = THREE.MathUtils.lerp(1.3, 0.9, night); key.intensity = THREE.MathUtils.lerp(2.6, 1.3, night);
      key.color.set('#fff1de').lerp(C('#a9c2ff'), night);
      renderer.toneMappingExposure = THREE.MathUtils.lerp(0.95, 1.05, night);
    };
    apply();

    return {
      scene, shots: SHOTS,
      spawn: { pos: [ANCHORS.spawn.x, ANCHORS.spawn.y, ANCHORS.spawn.z], facing: ANCHORS.spawn.facing },
      walkBounds: { type: 'box', minX: -200, maxX: 200, minZ: -620, maxZ: 60 },
      groundHeight: (x, z) => (Math.abs(x - LODGE.x) < (LODGE.w + 10) / 2 && Math.abs(z - (LODGE.z - 4)) < (LODGE.d + 18) / 2 ? Math.max(LODGE.deckY, groundHeight(x, z)) : groundHeight(x, z)),
      layout: { TRACK, AREAS, ANCHORS, BOOST_PADS, RAMPS },
      setNight(v) { if (v !== night) { night = v; apply(); } },
      setWeather(v) { if (v !== weather) { weather = v; apply(); } },
      wind: (w) => ({ speed: 2.4 + w * 10, wind: [0.4 + w * w * 14, -1.2 - w * 3] }),
      bloom: (n) => ({ strength: THREE.MathUtils.lerp(0.2, 0.55, n), radius: 0.4, threshold: THREE.MathUtils.lerp(1.6, 1.0, n) }),
      update(dt, t) {
        sky.uniforms.uTime.value = t;
        animated.forEach(f => f(t));
        const k = 0.35 + 0.65 * night;
        boostGlow.color.setScalar(k * (2.2 + 1.6 * Math.sin(t * 6)));
        archGlow.color.setScalar(k * (0.8 + 0.2 * Math.sin(t * 3)));
        glow.color.setScalar(k);
      },
    };
  },
};
