// Winterhaven layout: pure data + math (no THREE / DOM), so Game Maker can reuse it for the playable
// Winterhaven LOBBY (quest hub) and it can be checked in Node.
// Units: studs (avatar is ~2.6 tall). +y up. The town tree is at the origin; Lantern Lane runs south (+z);
// Mirrorfrost Lake is east; Ice Bridge Creek + Frostspire Castle hill are north (-z);
// Whispering Pines + Frostgate Plaza are west; Frostbite Pass + Glimmer Cave climb south out of the valley.
// Every walkable surface height is groundHeight(x, z).
export const SQUARE = { x: 0, z: 0, r: 19 };
export const STREET = { z0: 18, z1: 112, half: 5 };
export const LAKE = { x: 86, z: 14, rx: 38, rz: 27 };
export const CASTLE = { x: 0, z: -160, top: 28, plateau: 31 };
export const CREEK = [[64, -2], [52, -30], [30, -52], [0, -60], [-34, -57], [-70, -66], [-120, -64], [-190, -80], [-300, -70]];
export const BRIDGES = [{ x: 0, z: -60, dir: 0 }, { x: -70, z: -66, dir: 0.18 }];
export const CASTLE_PATH = [[0, -19], [0, -45], [0, -75], [0, -100], [0, -120], [0, -137]];

const fract = (x) => x - Math.floor(x);
const hash = (x, z) => fract(Math.sin(x * 127.1 + z * 311.7) * 43758.5453);
function vnoise(x, z) {
  const xi = Math.floor(x), zi = Math.floor(z); let xf = x - xi, zf = z - zi;
  xf = xf * xf * (3 - 2 * xf); zf = zf * zf * (3 - 2 * zf);
  const a = hash(xi, zi), b = hash(xi + 1, zi), c = hash(xi, zi + 1), d = hash(xi + 1, zi + 1);
  return a + (b - a) * xf + (c - a) * zf + (a - b - c + d) * xf * zf;
}
export function fbm(x, z) { let s = 0, a = 0.5, f = 1; for (let i = 0; i < 5; i++) { s += a * vnoise(x * f, z * f); f *= 2.03; a *= 0.5; } return s / 0.97; }
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export function distToPolyline(x, z, pts) {
  let best = Infinity;
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i], [bx, bz] = pts[i + 1];
    const dx = bx - ax, dz = bz - az, L = dx * dx + dz * dz;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / L));
    best = Math.min(best, Math.hypot(x - ax - dx * t, z - az - dz * t));
  }
  return best;
}
export function inLake(x, z, pad = 0) { const u = (x - LAKE.x) / (LAKE.rx + pad), v = (z - LAKE.z) / (LAKE.rz + pad); return u * u + v * v < 1; }

/** Flat village rectangle (signed distance, 0 inside). */
function villageDist(x, z) { const dx = Math.max(-62 - x, x - 132, 0), dz = Math.max(-52 - z, z - 122, 0); return Math.hypot(dx, dz); }

export function hillHeight(x, z) {
  const d = Math.hypot(x - CASTLE.x, z - CASTLE.z);
  if (d < CASTLE.plateau) return CASTLE.top;
  return CASTLE.top * Math.exp(-(((d - CASTLE.plateau) / 34) ** 2));
}

export function height(x, z) {
  const r = Math.hypot(x * 0.85, z - 20);
  const wall = Math.max(0, r - 150);
  let h = wall * wall * 0.0048 + wall * 0.22;
  h += (fbm(x * 0.006 + 3.1, z * 0.006) - 0.3) * (4 + wall * 0.75);
  h += Math.max(0, fbm(x * 0.02 + 1.7, z * 0.02 + 4.2) - 0.55) * wall * 0.8;   // craggy peaks
  // a lower pass to the south, so the flyover comes in between two ridges
  if (z > 0) h *= 1 - 0.5 * Math.exp(-(((x + 10) / 70) ** 2)) * smooth(150, 260, z);
  // gentle rolling snow drifts outside the village
  h += (fbm(x * 0.03 + 9, z * 0.03) - 0.5) * 3.0;
  h *= smooth(0, 28, villageDist(x, z));
  // Frostgate Plaza clearing (flat)
  { const d = Math.hypot(x + 84, z - 18); h *= smooth(16, 34, d); }
  h = Math.max(h, hillHeight(x, z));
  // creek carve
  const dc = distToPolyline(x, z, CREEK);
  if (dc < 12) h = Math.min(h, -0.6 + (h + 0.6) * smooth(5, 12, dc));
  // lake basin
  if (inLake(x, z, 4)) h = Math.min(h, -0.4);
  return h;
}

/** Cabins: [x, z, facing (radians, 0 = front faces +z), w, d, h, variant] */
export function cabins() {
  const out = [];
  let i = 0;
  for (let z = 26; z <= 104; z += 15.5) {
    const v = i++;
    out.push([-14.5, z, Math.PI / 2, 8 + (v % 3), 9, 4.6 + (v % 2) * 0.8, v]);
    out.push([14.5, z + 6, -Math.PI / 2, 8 + ((v + 1) % 3), 9, 4.6 + ((v + 1) % 2) * 0.8, v + 7]);
  }
  // around the square (outside the orbit radius)
  out.push([-34, -6, Math.PI / 2 + 0.25, 10, 10, 5.4, 20], [36, -10, -Math.PI / 2 - 0.3, 9, 9, 5, 21]);
  out.push([-28, -32, 0.6, 8, 8, 4.6, 22], [26, -34, -0.5, 8, 9, 4.8, 23]);
  // outskirts / lakeside
  out.push([40, 58, -2.2, 8, 8, 4.4, 24], [-40, 44, 1.9, 9, 9, 4.8, 25], [-46, 88, 1.4, 8, 8, 4.4, 26], [36, 96, -1.6, 8, 8, 4.4, 27]);
  out.push([58, -32, -0.7, 8, 8, 4.4, 28], [-48, 30, 1.2, 8, 9, 4.6, 29], [44, 78, -1.9, 8, 8, 4.4, 30]);
  return out;
}

// ---------------- lobby data (areas, trails, anchors) ----------------
export const MARKET = { merchant: { x: -17, z: -17, facing: Math.PI / 4 }, stall: { x: 17, z: -17, facing: -Math.PI / 4 } };
export const PORTAL = { x: -84, z: 18, r: 13, facing: Math.PI / 2 };          // Frostgate Plaza (minigame entrance)
export const CAVE = { x: -40, z: 205, facing: Math.PI / 2 };                  // Glimmer Cave mouth (faces east onto the pass)

/** Walkable trails (centre lines, [x, z]) linking every area. Width in studs. */
export const TRAILS = [
  { id: 'lake-trail', name: 'Lakeside Walk', width: 4.5, pts: [[18, 4], [30, 7], [42, 10], [50, 12]] },
  { id: 'west-trail', name: 'Pinewood Trail', width: 4.5, pts: [[-18, 4], [-34, 12], [-52, 18], [-71, 18]] },
  { id: 'forest-loop', name: 'Whispering Pines Loop', width: 3.5, pts: [[-95, 22], [-112, 48], [-100, 86], [-64, 110], [-20, 118], [-5, 118]] },
  { id: 'pass-trail', name: 'Frostbite Pass Trail', width: 4.5, pts: [[0, 140], [-3, 165], [-6, 190], [-8, 215], [-10, 245]] },
  { id: 'cave-spur', name: 'Cave Spur', width: 3.5, pts: [[-6, 198], [-20, 202], [-33, 205]] },
];

/**
 * Named areas. shape: circle {x,z,r} | rect {minX,maxX,minZ,maxZ} | ellipse {x,z,rx,rz}.
 * Use areaAt(x, z) to find where a player is (first match wins, so small areas come first).
 */
export const AREAS = [
  { id: 'market', name: 'Winter Market', blurb: 'Merchant stall and market stand on the north side of the square.', shape: { type: 'rect', minX: -25, maxX: 25, minZ: -26, maxZ: -11 } },
  { id: 'square', name: 'Town Square', blurb: 'Cobbled plaza around the giant decorated tree. Main spawn.', shape: { type: 'circle', x: 0, z: 0, r: 26 } },
  { id: 'portal', name: 'Frostgate Plaza', blurb: 'Empty plaza + ice archway in a forest clearing, reserved for the minigame entrance.', shape: { type: 'circle', x: PORTAL.x, z: PORTAL.z, r: PORTAL.r + 3 } },
  { id: 'cave', name: 'Glimmer Cave', blurb: 'Crystal-lit cave mouth in the mountainside off the pass.', shape: { type: 'circle', x: CAVE.x, z: CAVE.z, r: 14 } },
  { id: 'lane', name: 'Lantern Lane', blurb: 'Main street of warm-lit cabins and string lights.', shape: { type: 'rect', minX: -22, maxX: 22, minZ: 18, maxZ: 122 } },
  { id: 'lake', name: 'Mirrorfrost Lake', blurb: 'Frozen lake with skate trails, benches and snowy shore.', shape: { type: 'ellipse', x: LAKE.x, z: LAKE.z, rx: LAKE.rx + 8, rz: LAKE.rz + 8 } },
  { id: 'castle', name: 'Frostspire Hill', blurb: 'The ice castle on its hill; gate faces the village.', shape: { type: 'circle', x: CASTLE.x, z: CASTLE.z, r: 62 } },
  { id: 'creek', name: 'Ice Bridge Creek', blurb: 'Frozen creek between village and castle, two ice bridges.', shape: { type: 'rect', minX: -130, maxX: 70, minZ: -82, maxZ: -40 } },
  { id: 'pass', name: 'Frostbite Pass', blurb: 'Trail climbing south between the ridges (flyover comes in here).', shape: { type: 'rect', minX: -60, maxX: 40, minZ: 122, maxZ: 260 } },
  { id: 'forest', name: 'Whispering Pines', blurb: 'Dense pine forest west of town, with a trail loop.', shape: { type: 'rect', minX: -150, maxX: -40, minZ: -45, maxZ: 125 } },
  { id: 'outskirts', name: 'Snowdrift Outskirts', blurb: 'Scattered cabins on the edge of town (east + south).', shape: { type: 'rect', minX: 22, maxX: 70, minZ: 40, maxZ: 120 } },
];

/** Gameplay anchor points (world [x, y, z] + facing radians; y from groundHeight). Scenery only for now. */
export const ANCHORS = {
  spawn: { x: 0, z: 34, facing: Math.PI, note: 'Lantern Lane, looking north at the tree' },
  merchant: { x: MARKET.merchant.x + 1.4, z: MARKET.merchant.z + 1.4, facing: MARKET.merchant.facing, note: 'stand point in front of the merchant counter (NPC spot)' },
  market: { x: MARKET.stall.x - 1.4, z: MARKET.stall.z + 1.4, facing: MARKET.stall.facing, note: 'second stall' },
  portal: { x: PORTAL.x - 2, z: PORTAL.z, facing: PORTAL.facing, note: 'centre of the Frostgate arch: minigame entrance trigger' },
  castleGate: { x: CASTLE.x, z: CASTLE.z + 24, facing: 0, note: 'castle gate (quest destination)' },
  lakeShore: { x: LAKE.x - LAKE.rx - 8, z: LAKE.z - 2, facing: -Math.PI / 2, note: 'west shore benches' },
  bridge: { x: 0, z: -60, facing: 0, note: 'top of the main ice bridge' },
  cave: { x: CAVE.x + 3, z: CAVE.z, facing: CAVE.facing, note: 'cave mouth' },
  passTop: { x: -10, z: 240, facing: 0, note: 'top of the pass, view back over the valley' },
  forestClearing: { x: -110, z: 50, facing: 0, note: 'clearing on the pines loop' },
};

export function inShape(s, x, z) {
  if (s.type === 'circle') return Math.hypot(x - s.x, z - s.z) <= s.r;
  if (s.type === 'rect') return x >= s.minX && x <= s.maxX && z >= s.minZ && z <= s.maxZ;
  const u = (x - s.x) / s.rx, v = (z - s.z) / s.rz; return u * u + v * v <= 1;
}
export function areaAt(x, z) { return AREAS.find((a) => inShape(a.shape, x, z)) || null; }
export function distToTrail(x, z) { return Math.min(...TRAILS.map((t) => distToPolyline(x, z, t.pts) - t.width / 2)); }
/** Height a player stands on (terrain, but frozen water surfaces are walkable ice). */
export function groundHeight(x, z) {
  let h = height(x, z);
  if (inLake(x, z)) h = Math.max(h, 0.06);
  if (distToPolyline(x, z, CREEK) < 4.5) h = Math.max(h, 0.2);
  return h;
}
export { NPCS } from './npcs.js';
