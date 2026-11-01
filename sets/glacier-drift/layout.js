// Glacier Drift: night powder glacier race + power-ups. PURE DATA + math (no THREE, no DOM) so the game can copy it.
// World: lodge deck at the top (z ≈ +24, y ≈ 130), track descends toward -z, finish at z ≈ -600.
// Track DNA shared with sled-rush (polyline centerline, smoothstep S-curves, banked trough) but its own route.
export const TRACK = {
  points: [
    [0, 0], [0, -36], [-18, -78], [-40, -120], [-38, -162], [-10, -200], [26, -236], [42, -280],
    [30, -326], [0, -360], [-30, -396], [-44, -440], [-28, -486], [4, -520], [10, -560], [10, -600], [10, -640],
  ],
  width: 18, halfWidth: 9, bankHeight: 3.6,
  topY: 130, slope: 0.2, finishZ: -600,
};
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
function hash(x, z) { const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return s - Math.floor(s); }
function noise(x, z) {
  const ix = Math.floor(x), iz = Math.floor(z), fx = x - ix, fz = z - iz, u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz);
  const a = hash(ix, iz), b = hash(ix + 1, iz), c = hash(ix, iz + 1), d = hash(ix + 1, iz + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
export function fbm(x, z) { return noise(x, z) * 0.55 + noise(x * 2.1, z * 2.1) * 0.3 + noise(x * 4.3, z * 4.3) * 0.15; }

export function centerX(z) {
  const P = TRACK.points;
  if (z >= P[0][1]) return P[0][0];
  for (let i = 1; i < P.length; i++) if (z >= P[i][1]) { const [x0, z0] = P[i - 1], [x1, z1] = P[i]; const u = (z - z0) / (z1 - z0); return x0 + (x1 - x0) * u * u * (3 - 2 * u); }
  return P[P.length - 1][0];
}
export function trackHeight(z) {
  const zz = clamp(z, TRACK.finishZ - 60, 12);
  if (zz < TRACK.finishZ) return TRACK.topY + TRACK.slope * TRACK.finishZ - (TRACK.finishZ - zz) * 0.02;
  return TRACK.topY + TRACK.slope * Math.min(zz, 0);
}
/** Terrain: carved trough, raised banks, glacier slopes beyond. */
export function groundHeight(x, z) {
  const d = Math.abs(x - centerX(z)), hw = TRACK.halfWidth;
  const bank = smooth(hw - 0.5, hw + 2.5, d) * TRACK.bankHeight - smooth(hw + 3, hw + 7, d) * TRACK.bankHeight * 0.55;
  const side = smooth(hw + 4, hw + 60, d) * (d - hw) * 0.4 + fbm(x * 0.04, z * 0.04) * 7 * smooth(hw + 6, hw + 30, d);
  const lodge = z > 6 ? smooth(6, 14, z) * (TRACK.topY + 0.2 - (trackHeight(z) + bank + side)) * smooth(40, 24, d) : 0; // flat deck
  return trackHeight(z) + bank + side + lodge;
}
export const height = groundHeight;
export function atT(t) { const z = TRACK.points[0][1] + (TRACK.finishZ - TRACK.points[0][1]) * t, x = centerX(z); return { x, y: groundHeight(x, z), z }; }
/** Downhill heading (yaw, radians) at z — Math.PI looks toward -z. */
export function headingAt(z) { const dx = centerX(z - 2) - centerX(z + 2); return Math.atan2(dx, -4) ; }
export function trackSamples(step = 4) { const out = []; for (let z = 0; z >= TRACK.points.at(-1)[1]; z -= step) { const x = centerX(z); out.push([x, groundHeight(x, z), z]); } return out; }
const r2 = (v) => +v.toFixed(2);
const P = (x, z, dy = 0) => [r2(x), r2(groundHeight(x, z) + dy), r2(z)];

export const LODGE = { x: 0, z: 30, w: 24, d: 14, deckY: TRACK.topY + 0.2 };
export const spawns = { racer: [-6, -2, 2, 6].map((o) => ({ pos: P(o, -2), facing: Math.PI })) };
spawns.racer.push(...[-6, -2, 2, 6].map((o) => ({ pos: P(o, 2), facing: Math.PI })));

const KINDS = ['boost', 'shield', 'magnet', 'freeze'];
// t along run + lateral offset; 'powerup alley' cluster mid-run at t≈0.5.
const PU = [[0.08, 0], [0.15, -4], [0.15, 4], [0.27, -3], [0.33, 3], [0.44, 0], [0.49, -5], [0.51, -1.7], [0.53, 1.7], [0.55, 5], [0.66, -3], [0.74, 3], [0.82, 0], [0.9, -4]];
export const powerups = PU.map(([t, o], i) => { const p = atT(t); return { id: `pu${i + 1}`, kind: KINDS[i % 4], t, pos: P(p.x + o, p.z, 0.2) }; });

export const GATE_T = [0.1, 0.22, 0.36, 0.5, 0.64, 0.78, 0.9];
export const checkpoints = GATE_T.map((t, i) => { const p = atT(t); return { id: `cp${i + 1}`, index: i, t, pos: P(p.x, p.z), facing: r2(headingAt(p.z)), width: TRACK.width + 2 }; });
export const finish = { pos: P(centerX(TRACK.finishZ), TRACK.finishZ), facing: Math.PI, width: TRACK.width + 4, archHeight: 10 };
export const LANTERN_STEP = 18;
export const anchors = {
  lodgeDeck: { pos: [0, LODGE.deckY, 16], facing: Math.PI, note: 'lodge deck spawn / lobby' },
  start: { pos: P(0, 0), facing: Math.PI, note: 'start line' },
  powerupAlley: { pos: P(atT(0.51).x, atT(0.51).z), facing: Math.PI, note: 'dense power-up cluster' },
  finish: { pos: finish.pos, facing: Math.PI, note: 'finish banner gate' },
  overlook: { pos: [90, 180, 0], facing: -2.4, note: 'high side overlook' },
};
export const bounds = { minX: -140, maxX: 140, minZ: -680, maxZ: 60 };
export const walkBounds = { minX: -60, maxX: 60, minZ: -660, maxZ: 46 };
export const HOOKS = { id: 'glacier-drift', TRACK, spawns, powerups, checkpoints, finish, lodge: LODGE, anchors, bounds, walkBounds, groundHeight, centerX, trackHeight, atT, headingAt };
