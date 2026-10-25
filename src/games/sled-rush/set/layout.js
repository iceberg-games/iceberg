// Sled Rush: night powder mountain sled run. PURE DATA + math (no THREE, no DOM) so the game can copy it.
// World: lodge at the top (z ≈ +20, y ≈ 120), run descends toward -z, finish at z ≈ -560 (y ≈ 6).
// Units = blockworld units. Track is a [x,z] centerline polyline; height comes from trackHeight(z).

export const TRACK = {
  // centerline [x, z], top → bottom. Winding S-curves; ~600u long.
  points: [
    [0, 0], [0, -40], [14, -80], [34, -118], [36, -160], [14, -200], [-16, -236], [-34, -276],
    [-30, -318], [-6, -352], [22, -388], [34, -428], [24, -468], [6, -506], [0, -540], [0, -580],
  ],
  width: 16,          // playable width (center ± 8)
  halfWidth: 8,
  bankHeight: 3.2,    // snow-bank wall height at the edge
  topY: 120, slope: 0.2, // trackHeight(z) = topY + slope * z  (z negative going downhill)
  finishZ: -540,
};

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
function hash(x, z) { const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return s - Math.floor(s); }
function noise(x, z) {
  const ix = Math.floor(x), iz = Math.floor(z), fx = x - ix, fz = z - iz;
  const u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz);
  const a = hash(ix, iz), b = hash(ix + 1, iz), c = hash(ix, iz + 1), d = hash(ix + 1, iz + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
export function fbm(x, z) { return noise(x, z) * 0.55 + noise(x * 2.1, z * 2.1) * 0.3 + noise(x * 4.3, z * 4.3) * 0.15; }

/** Centerline x at a given z (linear between polyline points; z must be descending in points). */
export function centerX(z) {
  const P = TRACK.points;
  if (z >= P[0][1]) return P[0][0];
  for (let i = 1; i < P.length; i++) {
    if (z >= P[i][1]) { const [x0, z0] = P[i - 1], [x1, z1] = P[i]; const u = (z - z0) / (z1 - z0); const s = u * u * (3 - 2 * u); return x0 + (x1 - x0) * s; }
  }
  return P[P.length - 1][0];
}
/** Base track surface height at z (before ramps). Flattens at the lodge deck and the finish run-out. */
export function trackHeight(z) {
  const zz = clamp(z, TRACK.finishZ - 40, 10);
  let y = TRACK.topY + TRACK.slope * Math.min(zz, 0);
  if (zz < TRACK.finishZ) y = TRACK.topY + TRACK.slope * TRACK.finishZ - (TRACK.finishZ - zz) * 0.02; // gentle run-out
  return y;
}

// Ramps/jumps: kicker centered on the track at z; length along track, height of the lip.
export const RAMPS = [
  { id: 'jump1', z: -180, length: 10, height: 2.6, note: 'first kicker after the upper S-bend' },
  { id: 'jump2', z: -410, length: 12, height: 3.4, note: 'big air before the lower bowl, lands downhill' },
];
function rampBump(x, z) {
  let h = 0;
  for (const r of RAMPS) {
    const d = r.z - z;                      // 0 at back (uphill end) … length at lip
    const along = d + r.length;             // z from (r.z + length) down to r.z
    if (along >= 0 && along <= r.length && Math.abs(x - centerX(z)) < TRACK.halfWidth - 1) h += r.height * (along / r.length) ** 1.5;
  }
  return h;
}

/** Terrain height anywhere: trough along the run, banks at the edge, rising mountainside beyond. */
export function groundHeight(x, z) {
  const base = trackHeight(z);
  const d = Math.abs(x - centerX(z));
  const hw = TRACK.halfWidth;
  const bank = smooth(hw - 0.5, hw + 2.5, d) * TRACK.bankHeight - smooth(hw + 3, hw + 7, d) * TRACK.bankHeight * 0.6;
  const side = smooth(hw + 4, hw + 60, d) * (d - hw) * 0.35 + fbm(x * 0.04, z * 0.04) * 6 * smooth(hw + 6, hw + 30, d);
  return base + bank + side + rampBump(x, z);
}
/** Alias for game use. */
export const height = groundHeight;

/** Sample the centerline as [x, y, z] points (every `step` units of z). */
export function trackSamples(step = 4) {
  const out = []; for (let z = TRACK.points[0][1]; z >= TRACK.points[TRACK.points.length - 1][1]; z -= step) { const x = centerX(z); out.push([x, groundHeight(x, z), z]); } return out;
}

// t ∈ [0,1] along the run (by z) → point; handy for "along-track" placement.
export function atT(t) { const z0 = TRACK.points[0][1], z1 = TRACK.finishZ; const z = z0 + (z1 - z0) * t; const x = centerX(z); return { x, y: groundHeight(x, z), z }; }
export function heightAlongTrack(t) { return atT(t).y; }

// Boost pads (glowing chevrons on the snow). t = fraction along run (0 start, 1 finish line).
export const BOOST_PADS = [0.1, 0.24, 0.37, 0.52, 0.62, 0.8, 0.9].map((t, i) => {
  const p = atT(t); const off = [0, -4, 4, 0, 3, -3, 0][i];
  return { id: `boost${i + 1}`, t, x: +(p.x + off).toFixed(2), z: +p.z.toFixed(2), radius: 2.4 };
});

export const LODGE = { x: 0, z: 26, w: 22, d: 14, deckY: TRACK.topY };
export const FINISH = { x: centerX(TRACK.finishZ), z: TRACK.finishZ, archWidth: TRACK.width + 4, archHeight: 9 };

export const AREAS = [
  { id: 'lodge', name: 'Summit Lodge', z: [10, 40], note: 'warm cabin + start gate' },
  { id: 'upper', name: 'Upper Glades', z: [-150, 0], note: 'first S-bend, boosts 1-2' },
  { id: 'mid', name: 'Pine Chute', z: [-330, -150], note: 'jump1, tight pines' },
  { id: 'lower', name: 'Aurora Bowl', z: [-500, -330], note: 'jump2, wide sweeping turns' },
  { id: 'finish', name: 'Finish Flats', z: [-580, -500], note: 'banner arch + run-out' },
];

const anchor = (z, facing, note, dy = 0.2) => { const x = centerX(z); return { x: +x.toFixed(2), y: +(groundHeight(x, z) + dy).toFixed(2), z, facing, note }; };
// facing: radians yaw; Math.PI = looking toward -z (downhill)
export const ANCHORS = {
  spawn: { x: 0, y: TRACK.topY + 0.2, z: 18, facing: Math.PI, note: 'lodge deck, player spawn' },
  start: anchor(0, Math.PI, 'start gate line'),
  mid1: anchor(-200, Math.PI, 'checkpoint 1 after jump1'),
  mid2: anchor(-388, Math.PI, 'checkpoint 2 before jump2'),
  finish: anchor(TRACK.finishZ, Math.PI, 'finish line under the banner arch'),
  cameraOverlook: { x: 70, y: 165, z: 10, facing: -2.3, note: 'high side overlook looking down the run' },
};
