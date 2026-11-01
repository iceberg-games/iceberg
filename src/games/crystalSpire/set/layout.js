// Crystal Spire (set id `crystal-spire`, for GM1 game `crystal-spire`): pure data (no THREE/DOM).
// A faceted crystal needle rising from a glacier cirque. Readable climb: one clockwise spiral of
// platforms around the needle, 4 checkpoint tiers (wide overlook ledges / crystal chambers), wind
// bridges out to satellite shards, glowing shard rings, summit with beacon sockets.
// Units ≈ meters; y up. Platforms: { x, y (top surface), z, w, d, rot, kind }.
export const NEEDLE = { x: 0, z: 0, baseR: 7, topR: 1.2, height: 78, sides: 7 };
export const needleRadius = (y) => NEEDLE.baseR + (NEEDLE.topR - NEEDLE.baseR) * Math.min(1, Math.max(0, y / NEEDLE.height));
export const BASE = { x: 0, z: 0, r: 16, y: 0 };               // base plaza (ring around needle foot)
export const SUMMIT = { x: 0, y: 66, z: 0, r: 4.2 };          // summit disc wraps the needle tip
export const BOUNDS = { minX: -60, maxX: 60, minZ: -60, maxZ: 60, maxY: 90 };

// ----- route generation (deterministic) -----
const P = [], STEP_RISE = 1.45, A_STEP = 0.36, START_A = Math.PI * 0.5;   // start on +z side (facing camera/spawn)
const CHECK_AT = [10, 20, 30];          // platform indices that become checkpoint tiers (plus summit = last)
const BRIDGE_AT = new Set([6, 15, 25, 35]);   // wind bridge: route swings out to a satellite shard and back
let a = START_A, y = 1.5;
for (let i = 0; i < 44; i++) {
  const r = needleRadius(y) + 3.2;
  const cp = CHECK_AT.includes(i);
  const kind = cp ? 'checkpoint' : (i % 7 === 3 ? 'slip' : i % 9 === 5 ? 'pane' : 'ledge');   // GM hazard tags
  P.push({ id: `p${i}`, i, x: +(Math.cos(a) * r).toFixed(2), y: +y.toFixed(2), z: +(Math.sin(a) * r).toFixed(2), a: +a.toFixed(3), r,
    w: cp ? 7 : 2.6, d: cp ? 5 : 2.2, rot: -a, kind });
  if (BRIDGE_AT.has(i)) { a += A_STEP * 0.9; y += 0.6; const R2 = r + 9;   // satellite shard platform
    P.push({ id: `p${i}s`, i, x: +(Math.cos(a) * R2).toFixed(2), y: +y.toFixed(2), z: +(Math.sin(a) * R2).toFixed(2), a: +a.toFixed(3), r: R2, w: 3.4, d: 3.4, rot: -a, kind: 'satellite' }); }
  a += cp ? A_STEP * 1.6 : A_STEP; y += cp ? 1.2 : STEP_RISE;
}
export const PLATFORMS = P;
// wind bridges = segments into/out of satellites (long, thin, gusty)
export const BRIDGES = [];
for (let k = 1; k < P.length; k++) if (P[k].kind === 'satellite' || P[k - 1].kind === 'satellite') BRIDGES.push({ id: `bridge-${BRIDGES.length}`, from: P[k - 1].id, to: P[k].id, a: [P[k - 1].x, P[k - 1].y, P[k - 1].z], b: [P[k].x, P[k].y, P[k].z], width: 1.2, gust: true });
export const STAIRS = BRIDGES;    // alias: the brief's "ramps" are the bridges
export const RAMPS = BRIDGES;

const last = P[P.length - 1];
export const CHECKPOINTS = [
  { id: 'cp0', name: 'Base Camp', x: 0, y: 0, z: BASE.r - 4, level: 0 },
  ...CHECK_AT.map((idx, n) => { const p = P.find(q => q.i === idx && q.kind === 'checkpoint'); return { id: `cp${n + 1}`, name: ['Echo Ledge', 'Prism Gallery', 'Wind Crown'][n], x: p.x, y: p.y, z: p.z, level: n + 1, platform: p.id }; }),
  { id: 'cp4', name: 'Summit', x: SUMMIT.x, y: SUMMIT.y, z: SUMMIT.z + 2.6, level: 4 },
];
export const FLOORS = CHECKPOINTS.map(c => ({ id: c.id, name: c.name, y: c.y, level: c.level }));
export const LEVELS = FLOORS;
export const CHAMBERS = CHECKPOINTS.slice(1, 4).map(c => ({ id: `chamber-${c.level}`, name: `${c.name} geode`, x: c.x, y: c.y, z: c.z, r: 4, glow: ['#7fd4ff', '#c49bff', '#4ff0d0'][c.level - 1] }));
export const OVERLOOKS = [...CHECKPOINTS.slice(1, 4).map(c => ({ id: `over-${c.level}`, x: c.x * 1.18, y: c.y, z: c.z * 1.18, look: [c.x * 3, c.y - 8, c.z * 3] })),
  { id: 'over-summit', x: 0, y: SUMMIT.y, z: SUMMIT.r, look: [0, 20, 60] }];
// glowing shard rings: hoops at gaps (fly-through juice) + collectible shards
export const SHARD_RINGS = P.filter((p, k) => k > 0 && k % 5 === 2).map((p, n) => { const q = P[P.indexOf(p) - 1];
  return { id: `ring-${n}`, x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 + 1.6, z: (p.z + q.z) / 2, r: 1.5, facing: Math.atan2(p.x - q.x, p.z - q.z), color: ['#7fd4ff', '#c49bff', '#ff8fd0', '#4ff0d0'][n % 4] }; });
export const SHARDS = P.filter((p, k) => k % 3 === 1 && p.kind !== 'checkpoint').map((p, n) => ({ id: `shard-${n}`, x: p.x, y: p.y + 1.1, z: p.z, value: 1 }));
export const BEACON_SOCKETS = [0, 1, 2, 3].map(k => { const t = k * Math.PI / 2 + Math.PI / 4; return { id: `socket-${k}`, x: +(Math.cos(t) * 3).toFixed(2), y: SUMMIT.y, z: +(Math.sin(t) * 3).toFixed(2) }; });
export const BEACON = { x: 0, y: SUMMIT.y + 14, z: 0 };     // the needle tip crystal (lights when sockets fill)
export const HAZARDS = P.filter(p => p.kind === 'slip' || p.kind === 'pane').map(p => ({ id: `hz-${p.id}`, kind: p.kind === 'slip' ? 'ice-slip' : 'disappearing-pane', platform: p.id, x: p.x, y: p.y, z: p.z }))
  .concat(BRIDGES.map(b => ({ id: `hz-${b.id}`, kind: 'wind-gust', bridge: b.id })));
export const CRYSTALS = [   // landmarks
  { id: 'needle', name: 'The Needle', x: 0, y: 0, z: 0, h: NEEDLE.height },
  ...[0, 1, 2, 3, 4, 5].map(k => { const t = k / 6 * Math.PI * 2 + 0.3; return { id: `sentinel-${k}`, name: 'Sentinel shard', x: +(Math.cos(t) * 30).toFixed(1), y: 0, z: +(Math.sin(t) * 30).toFixed(1), h: 10 + (k % 3) * 5 }; }),
];
export const CIRQUE = { r0: 38, r1: 75, peakH: 46 };
export const AREAS = [
  { id: 'cirque', name: 'Glacier Cirque', shape: 'ring', x: 0, z: 0, r0: BASE.r, r1: CIRQUE.r0 },
  { id: 'base', name: 'Base Camp Plaza', shape: 'circle', x: 0, z: 0, r: BASE.r, y0: 0, y1: 4 },
  ...CHECKPOINTS.slice(1).map((c, n, A) => ({ id: `tier-${c.level}`, name: c.name, shape: 'band', y0: c.y - 1, y1: (A[n + 1]?.y ?? c.y + 16) - 1 })),
];
export const SPAWN = { x: 0, y: 0, z: BASE.r - 2, facing: Math.PI };
export const ANCHORS = {
  spawn: SPAWN, baseCamp: CHECKPOINTS[0], routeStart: { x: P[0].x, y: P[0].y, z: P[0].z },
  summit: SUMMIT, beacon: BEACON, ...Object.fromEntries(CHECKPOINTS.map(c => [c.id, c])),
};
export const TRAILS = [
  { id: 'climb', pts: [[SPAWN.x, 0, SPAWN.z], ...P.map(p => [p.x, p.y, p.z]), [0, SUMMIT.y, SUMMIT.r - 1]] },
  { id: 'base-loop', pts: Array.from({ length: 13 }, (_, k) => [Math.cos(k / 12 * 6.283) * 12, 0, Math.sin(k / 12 * 6.283) * 12]) },
];
export function groundHeight(x, z) {
  const r = Math.hypot(x, z);
  if (r < BASE.r) return 0;
  const t = Math.max(0, (r - BASE.r) / (CIRQUE.r0 - BASE.r));
  return t * t * 3 + (r > CIRQUE.r0 ? (r - CIRQUE.r0) * 0.9 : 0);
}
// highest walkable surface at (x,z) at or below y+0.6 (platforms, summit, ground)
export function floorHeight(x, z, y = Infinity) {
  let best = groundHeight(x, z);
  const consider = (top) => { if (top <= y + 0.6 && top > best) best = top; };
  for (const p of P) { const c = Math.cos(p.rot), s = Math.sin(p.rot), dx = x - p.x, dz = z - p.z;
    const lx = dx * c - dz * s, lz = dx * s + dz * c; if (Math.abs(lx) <= p.d / 2 + 0.1 && Math.abs(lz) <= p.w / 2 + 0.1) consider(p.y); }
  for (const b of BRIDGES) { const [ax, ay, az] = b.a, [bx, by, bz] = b.b, vx = bx - ax, vz = bz - az, L2 = vx * vx + vz * vz;
    const t = Math.max(0, Math.min(1, ((x - ax) * vx + (z - az) * vz) / L2)), px = ax + vx * t, pz = az + vz * t;
    if (Math.hypot(x - px, z - pz) < b.width / 2 + 0.1) consider(ay + (by - ay) * t); }
  if (Math.hypot(x - SUMMIT.x, z - SUMMIT.z) < SUMMIT.r) consider(SUMMIT.y);
  return best;
}
export const floorAt = floorHeight;
