// Rimebound Resort layout: pure data + math (no THREE / DOM). Procedural set — no Blender assets.
export const LODGE = { x0: -12, x1: 12, z0: -20, z1: -4, wallH: 4.2, ridge: 11 };   // front door faces +z
export const SHED = { x0: 18, x1: 28, z0: -2, z1: 8, h: 3.2 };
export const LIFT_X = -40;
export const LIFT_Z = [14, -8, -32, -56, -80, -104];                 // pylon stations
export const SIGN = { x: -16, z: 4 };
export const GENERATORS = [[14, -14], [-17, -10], [24, 12], [-34, 8]];
export const LOCKERS = [[11.2, -12, 0], [11.2, -14, 0], [11.2, -16, 0]];     // inside lodge east wall
export const ANCHORS = {
  spawn: { x: 0, z: 30, facing: Math.PI },
  frontDoor: { x: 0, z: LODGE.z1 },
  fireplace: { x: -3, z: LODGE.z0 + 2 },
  backDoor: { x: 7, z: LODGE.z0 },
  sign: SIGN,
};

/** Walkable height. Flat resort base, slope climbs north (-z). */
export function groundHeight(x, z) {
  return z > -30 ? 0 : (-30 - z) * 0.28;
}
