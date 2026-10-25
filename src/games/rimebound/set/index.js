// Rimebound Shipyard: abandoned frozen docks (crane, freighter hull, cold-storage warehouse, fog pier, container maze).
// Procedural Three.js, Iceberg original. Open: /sets/?set=rimebound-shipyard
import * as THREE from 'three';
import { rng } from './lib/blocks.js';
import { rimeKit } from './lib/rimekit.js';
import { rimeAtmosphere, addLanterns, flicker, mistMotes, fogBank, lookControls } from './lib/rimebound.js';
import * as L from './layout.js';
import { SHOTS } from './shots.js';

export default {
  id: 'rimebound-shipyard', name: 'Rimebound Shipyard',
  async create({ renderer }) {
    const R = rng(4242), scene = new THREE.Scene(), k = rimeKit();
    const atm = rimeAtmosphere(scene, renderer, { fog: L.lighting.fog, density: L.lighting.density, shadowBox: 60 }); atm.scene = scene;
    atm.moon.shadow.mapSize.set(1024, 1024);   // soft-GPU friendly
    const { box, cyl, beam } = k;
    // ground: concrete quay slabs + snow drifts; black water north
    box('conc', 0, -0.3, 8, 92, 0.6, 64);
    for (let x = -44; x <= 44; x += 4) for (let z = -22; z <= 38; z += 4) if (R() < 0.15) box(R() < 0.5 ? 'stone' : 'dark', x, 0.02, z, 3.9, 0.05, 3.9);
    box('water', 0, -1.6, -60, 200, 0.2, 76);
    for (let i = 0; i < 14; i++) k.rock('snow', -44 + R() * 88, 0, R() < 0.5 ? 38 : -22 + R() * 60, 0.8 + R() * 1.4, R);
    for (let i = 0; i < 10; i++) k.rock('ice', -60 + R() * 120, -1.4, -30 - R() * 40, 1 + R() * 2.5, R);   // ice floes
    box('stone', 0, -0.8, -23, 92, 1.6, 1.2);   // quay edge
    for (let x = -42; x <= 42; x += 7) { cyl('iron', x, 0.4, -22.5, 0.35, 0.8, true); }   // bollards
    // perimeter fence + exit gates
    for (const [x0, z0, x1, z1] of [[-46, 40, 46, 40], [-46, -22, -46, 40], [46, -22, 46, 40]]) {
      const L2 = Math.hypot(x1 - x0, z1 - z0), n = Math.ceil(L2 / 3);
      for (let i = 0; i <= n; i++) cyl('iron', x0 + (x1 - x0) * i / n, 1.6, z0 + (z1 - z0) * i / n, 0.08, 3.2, false, 'cyl6');
      box('iron', (x0 + x1) / 2, 3.1, (z0 + z1) / 2, Math.abs(x1 - x0) + 0.1, 0.08, Math.abs(z1 - z0) + 0.1);
      k.solid((x0 + x1) / 2, 1.6, (z0 + z1) / 2, Math.abs(x1 - x0) + 0.2, 3.2, Math.abs(z1 - z0) + 0.2);
    }
    for (const e of L.exits) { const s = Math.sign(e.x);
      for (const dz of [-3, 3]) box('rust', e.x, 3, e.z + dz, 1, 6, 1, 0, true);
      box('rust', e.x, 6.2, e.z, 1, 0.6, 7.2); k.glowBox('#ff3b3b', e.x - s * 0.6, 6.2, e.z, 0.05, 0.25, 5, 4); k.post(e.x - s * 2, e.z + 5); }
    // WAREHOUSE (open both short ends + side door) — corrugated walls, roof trusses, icicles
    { const W = L.WAREHOUSE, x0 = W.x - W.w / 2, x1 = W.x + W.w / 2, z0 = W.z - W.d / 2, z1 = W.z + W.d / 2;
      box('rust', W.x, W.h / 2, z1, W.w, W.h, 0.5, 0, true);
      box('rust', W.x - 8, W.h / 2, z0, W.w - 16, W.h, 0.5, 0, true); box('rust', W.x + 8.5, W.h / 2, z0, W.w - 17, W.h, 0.5, 0, true);   // north door gap at x=-22
      box('rust', x0, W.h / 2, W.z + 5, 0.5, W.h, 8, 0, true); box('rust', x0, W.h / 2, W.z - 6, 0.5, W.h, 6, 0, true);
      box('rust', x1, W.h / 2, W.z + 6, 0.5, W.h, 6, 0, true); box('rust', x1, W.h / 2, W.z - 6, 0.5, W.h, 6, 0, true);
      for (let x = x0; x <= x1; x += 3) { box('rustL', x, W.h / 2, z1 + 0.3, 0.3, W.h, 0.15); }
      for (let x = x0 + 2; x < x1; x += 4) { beam('iron', [x, W.h, z0], [x, W.h + 3, W.z], 0.3); beam('iron', [x, W.h + 3, W.z], [x, W.h, z1], 0.3); beam('iron', [x, W.h, z0], [x, W.h, z1], 0.25); }
      k.rot('rust', W.x, W.h + 1.6, W.z - 4.6, W.w + 1, 0.2, 9.6, [0.33, 0, 0]);
      k.rot('rust', W.x, W.h + 1.6, W.z + 4.6, W.w + 1, 0.2, 9.6, [-0.33, 0, 0]);
      k.icicles(x0, x1, W.h, z1 + 0.4, 10, R); k.icicles(x0, x1, W.h, z0 - 0.4, 10, R);
      for (let i = 0; i < 4; i++) { box('woodD', x0 + 4 + i * 5.5, 1.5, W.z + 4, 3, 3, 2.4, 0, true); box('tarp', x0 + 4 + i * 5.5, 3.1, W.z + 4, 3.2, 0.2, 2.6); }   // pallet stacks (loop pillars)
      for (const [x, z] of [[-34, 17], [-10, 17]]) { box('steel', x, 1.1, z, 1.2, 2.2, 0.8, 0, true); }   // lockers
      k.lantern(W.x, 7, W.z, 1.2); k.lantern(W.x - 9, 6, W.z - 3, 0.8);
      box('dark', W.x, 9, z1 + 0.35, 8, 1.4, 0.1); k.glowBox('#9fe6ff', W.x, 9, z1 + 0.42, 6, 0.15, 0.05, 2.5); }
    // GANTRY CRANE — tall lattice legs, boom out over the water, red beacon
    { const C = L.CRANE, h = C.h;
      for (const [dx, dz] of [[-4, -4], [4, -4], [-4, 4], [4, 4]]) { box('rust', C.x + dx, h / 2, C.z + dz, 0.9, h, 0.9, 0, true);
        for (let y = 3; y < h; y += 8) box('rustL', C.x + dx, y, C.z + dz, 1.1, 0.25, 1.1); }
      for (let y = 4; y < h; y += 5) { beam('rust', [C.x - 4, y, C.z - 4], [C.x + 4, y + 5, C.z - 4], 0.25); beam('rust', [C.x - 4, y, C.z + 4], [C.x + 4, y + 5, C.z + 4], 0.25);
        beam('rust', [C.x - 4, y, C.z - 4], [C.x - 4, y + 5, C.z + 4], 0.25); beam('rust', [C.x + 4, y, C.z - 4], [C.x + 4, y + 5, C.z + 4], 0.25); }
      box('rust', C.x, h, C.z - 10, 3, 2, 34); box('steel', C.x, h + 2, C.z + 3, 6, 2.6, 5);   // boom + cab
      k.glowBox('#ffd27a', C.x, h + 2.2, C.z + 0.45, 4, 0.8, 0.05, 2);
      for (let z = C.z + 4; z > C.boomTo[1]; z -= 3) beam('rustL', [C.x - 1.5, h - 1, z], [C.x + 1.5, h + 1, z - 3], 0.15);
      beam('iron', [C.x, h - 1, -36], [C.x, 12, -36], 0.06); box('iron', C.x, 11, -36, 1.6, 1.2, 1.2);   // hook
      k.glowBox('#ff2020', C.x, h + 3.8, C.z + 3, 0.6, 0.6, 0.6, 8); k.LANTERNS.push([C.x, h + 4.5, C.z + 3, 2.5, '#ff3030']);
      for (let y = 1; y < 14; y += 1) box('iron', C.x + 4.6, y, C.z + 4, 0.6, 0.08, 0.08);   // climb ladder
      box('steel', C.x + 4, 14, C.z + 4, 3, 0.2, 3); }
    // FREIGHTER "Hollow Mercy" — black hull, rime crust, superstructure aft, list
    { const F = L.FREIGHTER, hx = F.len / 2, hb = F.beam / 2;
      box('iron', F.x, F.deck / 2 - 1.5, F.z, F.len, F.deck + 3, F.beam, 0, true);
      box('rust', F.x, 0.6, F.z, F.len + 0.2, 1.2, F.beam + 0.2);   // waterline rust band
      for (let i = 0; i < 3; i++) { k.cone('iron', F.x - hx - 2.5, F.deck - 0.5 - i * 0.6, F.z, hb * (1 - i * 0.12), 0.6); }
      box('iron', F.x - hx - 2, F.deck / 2 - 1.5, F.z, 4, F.deck + 3, F.beam * 0.6, 0, true);   // bow
      box('rime', F.x, F.deck + 0.05, F.z, F.len, 0.1, F.beam);
      for (const s of [-1, 1]) for (let x = F.x - hx; x <= F.x + hx; x += 4) cyl('steel', x, F.deck + 0.6, F.z + s * (hb - 0.2), 0.05, 1.2, false, 'cyl6');
      for (let i = 0; i < 3; i++) { box('rustL', F.x - 14 + i * 9, F.deck + 0.4, F.z, 6, 0.8, 7); }   // hatches
      box('steel', F.x + hx - 6, F.deck + 4, F.z, 8, 8, F.beam - 1, 0, true); box('dark', F.x + hx - 6, F.deck + 9.5, F.z, 6, 3, F.beam - 3);
      for (let z = -3; z <= 3; z += 2) k.glowBox('#ffb060', F.x + hx - 10.05, F.deck + 9.6, F.z + z, 0.05, 1, 1.2, 1.5);
      cyl('rust', F.x + hx - 4, F.deck + 13, F.z, 1.2, 5); k.icicles(F.x - hx, F.x + hx, F.deck, F.z + hb + 0.1, 14, R);
      // engine room glow under stern (core)
      k.glowBox('#5fd4ff', L.ENGINE_ROOM.x - 0.1, F.deck + 1, L.ENGINE_ROOM.z, 1, 1.4, 1, 4); k.LANTERNS.push([L.ENGINE_ROOM.x - 2, F.deck + 2, L.ENGINE_ROOM.z, 1.2, '#7fd8ff']);
      // gangway
      beam('steel', [6, 0.2, -22], [6, F.deck, -36.5], 0.15); k.rot('woodD', 6, F.deck / 2, -29.2, 2.4, 0.15, 15.2, [Math.atan2(F.deck, 14.5), 0, 0]);
      for (let x = F.x - hx; x < F.x + hx; x += 8) { beam('woodD', [x, 0, -23], [x, F.deck - 1, F.z + hb], 0.3); } }
    // PIER — timber planks on piles, fog, lighthouse lantern at the end
    { const P = L.PIER;
      for (let z = P.minZ; z < P.maxZ; z += 1.8) box(R() < 0.1 ? 'wood' : 'woodD', (P.minX + P.maxX) / 2, P.top - 0.1, z + 0.9, P.maxX - P.minX, 0.2, 1.7);
      for (let z = P.minZ; z <= P.maxZ; z += 4) for (const x of [P.minX, P.maxX]) cyl('woodD', x, -1, z, 0.3, 4.4, true, 'cyl6');
      box('wood', -10, 0.5, -22.5, 8, 1, 3);
      for (let z = P.minZ + 6; z < P.maxZ; z += 20) k.post(P.minX + 0.3, z, P.top, 3);
      cyl('stone', -10, 3, -56, 2.2, 6, true); cyl('dark', -10, 6.6, -56, 1.6, 1.4); k.lantern(-10, 7.6, -56, 2.2, '#ffc070'); k.cone('iron', -10, 8.8, -56, 1.8, 1.2);
      for (const [x, z] of [[-7, -40], [-7, -38.6]]) box('wood', x, P.top + 0.6, z, 1.3, 1.2, 1.3, 0.2, true);
      k.glowBox('#5fd4ff', -10, P.top + 0.6, -50, 0.8, 1.2, 0.8, 4); k.LANTERNS.push([-10, 2.5, -50, 1, '#7fd8ff']); }
    // CONTAINER MAZE
    const cc = ['#4a2e26', '#2c3a4a', '#3b4a3a', '#5a4a2a'];
    for (const [x, z, ry, up] of L.CONTAINERS) { const y = up ? 3.9 : 1.3, col = new THREE.Color(cc[Math.floor(R() * 4)]);
      k.B.box(k.M.rust, x, y, z, 6, 2.6, 2.5, col.multiplyScalar(1.6), [0, ry, 0]); if (!up) k.solid(x, y, z, 6, 2.6, 2.5, ry); else k.solid(x, 2.6, z, 6, 5.2, 2.5, ry);
      k.B.box(k.M.snow, x, y + 1.35, z, 5.8, 0.12, 2.3, 0xffffff, [0, ry, 0]); }
    k.post(10, 12); k.post(26, 22);
    // HARBOURMASTER SHACK
    box('wood', -36, 2, -12, 6, 4, 5, 0, true); k.rot('woodD', -36, 4.6, -12, 7, 0.3, 6, [0, 0, 0.25]); k.glowBox('#ffb060', -32.9, 2.2, -12, 0.05, 1.2, 1.6, 1.6);
    box('woodD', -36, 0.4, -7, 3, 0.15, 0.8); k.lantern(-33, 3.5, -9.5, 1);
    // scattered dressing: barrels, chains, dead lamp posts
    for (let i = 0; i < 8; i++) { const x = -42 + R() * 84, z = -20 + R() * 56; if (Math.abs(x - L.WAREHOUSE.x) < 15 && Math.abs(z - L.WAREHOUSE.z) < 11) continue; cyl(R() < 0.5 ? 'rust' : 'steel', x, 0.6, z, 0.45, 1.2, true); }
    k.post(-20, -16); k.post(0, -16);
    k.build(scene);
    const lit = addLanterns(scene, k.LANTERNS, { max: 6, power: 22, dist: 18 });   // few real lights: shader compile is the soft-GL killer
    const motes = mistMotes(scene, { sx: 100, sz: 100, cz: -8, y1: 14, count: 600 });
    fogBank(scene, { x: -10, z: -45, w: 40, d: 40, y: 1.2, opacity: 0.2, layers: 2 }); fogBank(scene, { x: 20, z: -40, w: 70, d: 30, y: 0.2, opacity: 0.18, layers: 1 });
    const lc = lookControls(atm, renderer); lc.apply();
    await new Promise(r => setTimeout(r, 0));   // yield before first render/compile
    const A = L.ANCHORS.spawn;
    return {
      scene, shots: SHOTS,
      snow: { count: 3000, box: 90, height: 45 },
      spawn: { pos: [A.x, A.y + 0.1, A.z], facing: A.facing },
      walkBounds: { type: 'box', ...L.MAP },
      groundHeight: L.groundHeight,
      layout: { AREAS: L.AREAS, ANCHORS: L.ANCHORS, TRAILS: L.TRAILS, spawns: L.spawns, cores: L.cores, exits: L.exits, hidingSpots: L.hidingSpots, bounds: L.bounds, lighting: L.lighting, colliders: k.COLLIDERS },
      addColliders(col) { k.COLLIDERS.forEach(b => col.addBox(...b)); },
      setNight: lc.setNight, setWeather: lc.setWeather,
      wind: (w) => ({ speed: 1 + w * 3, wind: [0.4 + w * 3, 0.2] }),
      avatarColors: { skin: '#d9b8a0', shirt: '#2c3a4a', pants: '#1a1d24' },
      bloom: () => ({ strength: 0.75, radius: 0.5, threshold: 0.95 }),
      update(dt, t) { flicker(lit, t); atm.sky.uniforms.uTime.value = t; motes.position.y = Math.sin(t * 0.4) * 0.3; },
    };
  },
};
