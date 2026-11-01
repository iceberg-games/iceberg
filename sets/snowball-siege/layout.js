// Snowball Siege layout: pure data + math (no THREE / DOM) so Game Maker can reuse it.
// Valley runs along X. Red fort west (x<0), Blue fort east (x>0), capture crystal at origin.
export const FORT_X = 30;           // fort centre distance from midfield
export const FORT = { w: 16, d: 20, wallH: 4.2, towerH: 8.5, gateW: 4 };
export const COURT = { halfX: 46, halfZ: 26 };
export const bounds = { min: [-COURT.halfX, -2, -COURT.halfZ], max: [COURT.halfX, 30, COURT.halfZ] };
export const walkBounds = { type: 'box', minX: -COURT.halfX + 1, maxX: COURT.halfX - 1, minZ: -COURT.halfZ + 1, maxZ: COURT.halfZ - 1 };

/** Gentle snow drifts; flat inside forts and on the objective plinth. */
export function groundHeight(x, z) {
  const fortFlat = Math.abs(Math.abs(x) - FORT_X) < FORT.w / 2 + 1 && Math.abs(z) < FORT.d / 2 + 1;
  if (fortFlat) return 0.3;
  const d0 = Math.hypot(x, z);
  if (d0 < 4) return 0.6;          // plinth top
  const h = 0.25 * Math.sin(x * 0.21 + 1.3) * Math.cos(z * 0.17) + 0.15 * Math.sin(x * 0.07 - z * 0.11);
  const edge = Math.max(0, Math.abs(z) - (COURT.halfZ - 8)) * 0.35; // valley walls rise
  return 0.2 + h + edge * edge * 0.15;
}

const sp = (x, z, facing) => ({ pos: [x, groundHeight(x, z), z], facing });
export const spawns = {
  red: [sp(-34, -5, Math.PI / 2), sp(-34, 5, Math.PI / 2), sp(-28, -3, Math.PI / 2), sp(-28, 3, Math.PI / 2), sp(-31, 0, Math.PI / 2)],
  blue: [sp(34, -5, -Math.PI / 2), sp(34, 5, -Math.PI / 2), sp(28, -3, -Math.PI / 2), sp(28, 3, -Math.PI / 2), sp(31, 0, -Math.PI / 2)],
};
export const respawns = {
  red: [sp(-36, -7, Math.PI / 2), sp(-36, 7, Math.PI / 2), sp(-33, 0, Math.PI / 2)],
  blue: [sp(36, -7, -Math.PI / 2), sp(36, 7, -Math.PI / 2), sp(33, 0, -Math.PI / 2)],
};
export const objective = { id: 'siege-crystal', pos: [0, 0.6, 0], radius: 4, kind: 'capture' };
export const flags = { red: { id: 'red-banner', pos: [-FORT_X - 4, 0.3, 0] }, blue: { id: 'blue-banner', pos: [FORT_X + 4, 0.3, 0] } };

const P = (x, z, y = 0) => [x, groundHeight(x, z) + y, z];
export const ammoCrates = [
  [-24, -8], [-24, 8], [24, -8], [24, 8], [-10, 0], [10, 0], [0, -14], [0, 14],
].map(([x, z], i) => ({ id: `ammo${i + 1}`, pos: P(x, z) }));

// Mirrored cover so neither team is favoured.
const half = [
  [-17, -4, 'berm'], [-17, 5, 'crate'], [-13, -12, 'sled'], [-13, 12, 'iceWall'],
  [-7, -6, 'iceWall'], [-7, 7, 'berm'], [-5, -18, 'crate'], [-5, 18, 'sled'],
];
export const cover = [...half, ...half.map(([x, z, k]) => [-x, -z, k])]
  .map(([x, z, kind], i) => ({ id: `cover${i + 1}`, pos: P(x, z), kind, yaw: ((i * 37) % 10) / 10 - 0.5 }));

export const LANTERNS = [[-20, -10], [-20, 10], [20, -10], [20, 10], [-6, -2.5], [6, 2.5], [0, -22], [0, 22]].map(([x, z]) => P(x, z));

export const HOOKS = { id: 'snowball-siege', spawns, respawns, objective, flags, ammoCrates, cover, bounds, walkBounds, groundHeight, FORT_X, FORT };
