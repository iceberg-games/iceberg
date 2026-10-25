// Rimebound Shipyard layout (pure data). Abandoned frozen docks: compact chase loop around warehouse, freighter, crane.
// Frame: x east, z south; water is north of z=-22 (pier juts north). Ground y=0 yard; pier/deck tops listed in SURFACES.
export const MAP = { minX: -46, maxX: 46, minZ: -58, maxZ: 40 };
export const WAREHOUSE = { x: -22, z: 10, w: 26, d: 18, h: 11, doors: [{ x: -22, z: 1 }, { x: -9, z: 10 }] };   // open both ends -> loop
export const CRANE = { x: 14, z: -18, h: 30, boomTo: [14, -44] };
export const FREIGHTER = { x: 26, z: -42, len: 44, beam: 11, deck: 5.5, ry: 0 };   // hull along x, moored at the quay
export const PIER = { minX: -14, maxX: -6, minZ: -54, maxZ: -22, top: 1.0 };
export const QUAY = { minX: -46, maxX: 46, minZ: -24, maxZ: 40, top: 0 };
export const CONTAINERS = [[6, 8, 0], [6, 14, 0], [12, 20, 0.3], [-2, 26, 1.57], [20, 4, 0], [20, 4, 0, 1], [28, 16, 0.2], [-36, -10, 1.57], [34, -4, 0]];
export const SURFACES = [
  [QUAY.minX, QUAY.minZ, QUAY.maxX, QUAY.maxZ, 0],
  [PIER.minX, PIER.minZ, PIER.maxX, PIER.maxZ, PIER.top],
  { ramp: [-10, -21, 0, -10, -24, 1.0, 8] },
  [FREIGHTER.x - 20, FREIGHTER.z - 4.5, FREIGHTER.x + 20, FREIGHTER.z + 4.5, FREIGHTER.deck],
  { ramp: [6, -22, 0.2, 6, -36.5, FREIGHTER.deck, 2.4] },   // gangway
  ...CONTAINERS.filter(c => c[3]).map(([x, z]) => [x - 3, z - 1.25, x + 3, z + 1.25, 5.2]),
];
export const AREAS = {
  warehouse: { minX: -35, maxX: -9, minZ: 1, maxZ: 19, label: 'Cold Storage Warehouse (pass-through, loop)' },
  crane: { x: 14, z: -18, r: 6, label: 'Gantry Crane (red beacon landmark)' },
  freighter: { minX: 6, maxX: 46, minZ: -47, maxZ: -37, y: 5.5, label: 'Frozen freighter "Hollow Mercy" deck' },
  pier: { minX: -14, maxX: -6, minZ: -54, maxZ: -22, label: 'Fog pier (dead end, lighthouse lantern)' },
  stacks: { minX: 0, maxX: 34, minZ: 0, maxZ: 26, label: 'Container maze' },
  shack: { x: -36, z: -12, r: 5, label: "Harbourmaster's shack" },
};
export const ANCHORS = {
  spawn: { x: 0, y: 0, z: 34, facing: Math.PI },
  killerSpawn: { x: -10, y: 1, z: -50, facing: 0 },
  survivorSpawns: [[-30, 30], [10, 32], [36, 24], [-40, -16]].map(([x, z]) => ({ x, y: 0, z })),
  generators: [[-28, 6], [24, -10], [-10, -46], [30, -42, 5.5], [2, 22]].map(([x, z, y = 0]) => ({ x, y, z })),
  exits: [{ id: 'west-gate', x: -45, y: 0, z: 28 }, { id: 'east-gate', x: 45, y: 0, z: 30 }],
};
export const TRAILS = {
  'main-loop': [[-36, 22], [-36, -2], [-8, -2], [-8, 22], [-36, 22]],
  'warehouse-run': [[-22, 22], [-22, -2]],
  'quay-run': [[-40, -18], [40, -18]],
  'gangway': [[6, -20], [6, -40], [30, -42]],
};
export const SIT_SPOTS = [{ id: 'shack-bench', x: -36, y: 0.5, z: -7, facing: 0 }];
export function groundHeight(x, z, y = Infinity) {
  let best = 0;
  for (const s of SURFACES) {
    let t = null;
    if (Array.isArray(s)) { if (x >= s[0] && x <= s[2] && z >= s[1] && z <= s[3]) t = s[4]; }
    else { const [x0, z0, y0, x1, z1, y1, w] = s.ramp, dx = x1 - x0, dz = z1 - z0, u = ((x - x0) * dx + (z - z0) * dz) / (dx * dx + dz * dz);
      if (u >= 0 && u <= 1 && Math.hypot(x - x0 - dx * u, z - z0 - dz * u) <= w / 2) t = y0 + (y1 - y0) * u; }
    if (t !== null && t <= y + 1.3 && t > best) best = t;
  }
  return best;
}

// ---- GM1 map hooks (Rimebound brief) ----
export const ENGINE_ROOM = { x: 38, z: -42, y: 1.2, label: 'Freighter engine room (stern, below deck via hatch)' };
export const spawns = {
  survivor: ANCHORS.survivorSpawns,
  killer: [ANCHORS.killerSpawn, { x: 40, y: 0, z: -20, facing: Math.PI / 2 }],
};
export const cores = [   // thaw core interact points
  { id: 'core-engine', x: ENGINE_ROOM.x, y: FREIGHTER.deck, z: ENGINE_ROOM.z, area: 'freighter' },
  { id: 'core-pier', x: -10, y: PIER.top, z: -50, area: 'pier' },
  { id: 'core-warehouse', x: -28, y: 0, z: 6, area: 'warehouse' },
  { id: 'core-crane', x: 14, y: 0, z: -14, area: 'crane' },
  { id: 'core-stacks', x: 2, y: 0, z: 22, area: 'stacks' },
];
export const exits = ANCHORS.exits;
export const hidingSpots = [
  { id: 'locker-wh-1', x: -34, y: 0, z: 17 }, { id: 'locker-wh-2', x: -10, y: 0, z: 17 },
  { id: 'container-open', x: 20, y: 0, z: 4 }, { id: 'shack-closet', x: -38, y: 0, z: -14 },
  { id: 'pier-crates', x: -7, y: 1, z: -40 }, { id: 'hull-hatch', x: 18, y: 5.5, z: -42 },
];
export const bounds = MAP;
export const lighting = { fog: '#0b1420', density: 0.03, note: 'cold blue moon + sparse warm lanterns; red crane beacon is the main landmark; cores glow cyan' };
