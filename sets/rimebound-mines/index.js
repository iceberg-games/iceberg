// Rimebound Mines — abandoned ice mines (asym horror, Forsaken-like). THIN procedural stub. No Blender/GLTF.
import * as THREE from 'three';
import { TUNNELS, CEIL, spawns, cores, exits, hidingSpots, bounds, walkBounds, HOOKS, groundHeight } from './layout.js';
import { SHOTS } from './shots.js';

export { spawns, cores, exits, hidingSpots, bounds, HOOKS };

export default {
  id: 'rimebound-mines',
  name: 'Rimebound Mines',
  async create({ renderer }) {
    const scene = new THREE.Scene(), BOXES = [], root = new THREE.Group(); scene.add(root);
    const std = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.9, flatShading: true, ...o });
    const rock = std('#1c222c'), rime = std('#7f9bb4', { roughness: 0.3 }), timber = std('#3a2a1e'), iron = std('#2b3038', { metalness: 0.6 });
    const ice = std('#8fd0f0', { emissive: '#1e6a90', emissiveIntensity: 0.6, transparent: true, opacity: 0.85 });
    const lamp = std('#111', { emissive: '#ffa050', emissiveIntensity: 2 }), coreM = std('#111', { emissive: '#ff3a1a', emissiveIntensity: 1.5 });
    const box = (m, x, y, z, sx, sy, sz, col) => { const b = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), m); b.position.set(x, y, z); b.castShadow = b.receiveShadow = true; root.add(b);
      if (col) BOXES.push([x - sx / 2, y - sy / 2, z - sz / 2, x + sx / 2, y + sy / 2, z + sz / 2]); return b; };
    // floor + ceiling slab
    box(rock, 0, -0.25, 0, 84, 0.5, 84); box(rock, 0, CEIL + 0.25, 0, 84, 0.5, 84);
    // solid rock: fill 4m grid cells not inside any tunnel
    const inside = (x, z) => TUNNELS.some(([a, b, c, d]) => x >= a && x <= c && z >= b && z <= d);
    for (let x = -42; x <= 42; x += 4) for (let z = -42; z <= 42; z += 4) if (!inside(x, z)) {
      const near = [[4, 0], [-4, 0], [0, 4], [0, -4]].some(([dx, dz]) => inside(x + dx, z + dz));
      if (near) box(Math.random() < 0.3 ? rime : rock, x, CEIL / 2, z, 4, CEIL, 4, true);
    }
    // timber sets + lamps along tunnels, ice crystals
    const lights = [];
    TUNNELS.forEach(([a, b, c, d], i) => { const long = (c - a) < (d - b), n = Math.floor((long ? d - b : c - a) / 8);
      for (let k = 0; k <= n; k++) { const t = n ? k / n : 0.5, x = long ? (a + c) / 2 : a + (c - a) * t, z = long ? b + (d - b) * t : (b + d) / 2;
        box(timber, x, CEIL - 0.2, z, long ? (c - a) : 0.3, 0.3, long ? 0.3 : (d - b));
        if (k % 2 === 0) { box(lamp, x, CEIL - 0.6, z, 0.2, 0.3, 0.2); if (lights.length < 12) { const l = new THREE.PointLight('#ffa050', 6, 10, 2); l.position.set(x, CEIL - 0.9, z); scene.add(l); lights.push(l); } }
        if (Math.random() < 0.5) { const cr = new THREE.Mesh(new THREE.ConeGeometry(0.25, 1.4, 5), ice); cr.position.set(x + (Math.random() - 0.5) * 2, 0.6, z + (Math.random() - 0.5) * 2); cr.rotation.z = (Math.random() - 0.5); root.add(cr); }
      } });
    // rails in drifts
    for (const [x0, z0, x1, z1] of [[-40, 0, 40, 0], [0, -40, 0, 40]]) box(iron, (x0 + x1) / 2, 0.05, (z0 + z1) / 2, Math.max(0.15, x1 - x0), 0.1, Math.max(0.15, z1 - z0));
    // hooks visualised
    const coreLights = cores.map((c) => { box(iron, c.pos[0], 0.7, c.pos[2], 1.6, 1.4, 1.2, true); box(coreM, c.pos[0], 1.5, c.pos[2] + 0.62, 0.3, 0.3, 0.05);
      const l = new THREE.PointLight('#ff3a1a', 4, 6, 2); l.position.set(c.pos[0], 2, c.pos[2]); scene.add(l); return l; });
    hidingSpots.forEach((h) => box(timber, h.pos[0], 0.55, h.pos[2], 1.2, 1.1, 1.8));
    exits.forEach((e) => { box(iron, e.pos[0], 1.8, e.pos[2], 3, 3.6, 0.3); const l = new THREE.PointLight('#7fd8ff', 8, 10, 2); l.position.set(e.pos[0], 2.5, e.pos[2]); scene.add(l); });

    scene.background = new THREE.Color('#03050a'); scene.fog = new THREE.FogExp2('#05080f', 0.06);
    const hemi = new THREE.HemisphereLight('#3a5478', '#07090f', 0.35); scene.add(hemi);
    const look = { night: 1, weather: 0.3 };
    const apply = () => { scene.fog.density = 0.04 + 0.03 * look.night + 0.03 * look.weather; hemi.intensity = 0.6 - 0.3 * look.night; renderer.toneMappingExposure = 1; };
    apply();
    const sp = spawns.survivor[0];
    return {
      scene, shots: SHOTS, groundHeight, walkBounds, hooks: HOOKS, spawns, cores, exits, hidingSpots, bounds,
      spawn: { pos: [sp.pos[0], 0.1, sp.pos[2]], facing: sp.facing },
      addColliders(col) { BOXES.forEach((b) => col.addBox(...b)); },
      setNight(v) { look.night = v; apply(); },
      setWeather(v) { look.weather = v; apply(); },
      wind: () => ({ speed: 0.5, wind: [0.2, 0.1] }),
      update(dt, t) {
        lights.forEach((l, i) => { l.intensity = 6 * (Math.sin(t * (3 + i) + i * 7) > -0.85 ? 1 : 0.1); });
        coreLights.forEach((l, i) => { l.intensity = 3 + 1.5 * Math.sin(t * 2 + i); });
      },
    };
  },
};
