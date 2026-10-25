// Starfall Observatory layout: pure data + math (no THREE / DOM), so Game Maker can reuse it.
// A rocky snow peak. Summit plaza (y 40) holds a glass dome and a star-map courtyard; a ring terrace
// (y 35) circles it with stairs down on E / W / N; the approach ridge climbs in from the south.

export const PLAZA = { r: 24, y: 40 };
export const TERRACE = { r0: 24, r1: 33, y: 35 };
export const DOME = { x: 0, z: -6, r: 11, wall: 1.4, door: 2.2 };           // door faces +z
export const COURTYARD = { x: 0, z: 14, r: 7 };                            // star-map pedestal
export const RIDGE = { half: 3, z0: 33, z1: 150, y0: 35, slope: 0.2 };    // south approach
export const STAIRS = [0, Math.PI / 2, Math.PI, -Math.PI / 2].map((a) => ({ a, half: 2.2 })); // E, N(-z), W, S ; angle = atan2(-z, x)
export const ANCHORS = {
  spawn: { x: 0, z: 46, facing: Math.PI },
  domeDoor: { x: 0, z: DOME.z + DOME.r },
  domeCentre: { x: DOME.x, z: DOME.z },
  pedestal: { x: COURTYARD.x, z: COURTYARD.z },
  overlookEast: { x: 30, z: 0 },
  overlookWest: { x: -30, z: 0 },
  ridgeFoot: { x: 0, z: 140 },
};

function h21(x, y) { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); }
function n2(x, y) {
  const ix = Math.floor(x), iy = Math.floor(y); let fx = x - ix, fy = y - iy; fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
  const a = h21(ix, iy), b = h21(ix + 1, iy), c = h21(ix, iy + 1), d = h21(ix + 1, iy + 1);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}
export function fbm(x, z) { let s = 0, a = 0.5, f = 1; for (let i = 0; i < 4; i++) { s += a * n2(x * f, z * f); a *= 0.5; f *= 2.03; } return s; }

export const ridgeY = (z) => RIDGE.y0 - Math.max(0, z - RIDGE.z0) * RIDGE.slope;

/** Rocky mountain surface (the terrain mesh). Kept under the built walk surfaces. */
export function height(x, z) {
  const r = Math.hypot(x, z);
  let h = r < TERRACE.r1 ? 34.4 : 34.4 - (r - TERRACE.r1) * 0.55 - Math.max(0, r - 60) * 0.15;
  h += (fbm(x * 0.04, z * 0.04) - 0.5) * Math.min(1, Math.max(0, (r - 36) / 20)) * 18;
  // ridge spine to the south
  if (z > 20) { const sp = ridgeY(z) - 0.4 - Math.abs(x) * 0.35 - (fbm(x * 0.1, z * 0.1) - 0.5) * 2; h = Math.max(h, sp); }
  // distant peaks ring
  h += Math.max(0, r - 170) * 0.45 * (0.35 + fbm(x * 0.008, z * 0.008)) + Math.max(0, r - 170) * 0.5 * Math.max(0, fbm(x * 0.02, z * 0.02) - 0.45);
  return Math.max(-6, h);
}

/** Stair height for a point in a stair corridor (plaza edge → terrace), else null. */
function stairY(x, z) {
  const r = Math.hypot(x, z); if (r < PLAZA.r - 0.5 || r > PLAZA.r + 6) return null;
  for (const s of STAIRS) {
    const dx = Math.cos(s.a), dz = -Math.sin(s.a);
    const along = x * dx + z * dz, lat = Math.abs(-x * dz + z * dx);
    if (along > 0 && lat < s.half) { const k = Math.min(10, Math.max(0, Math.ceil((along - PLAZA.r) / 0.6))); return PLAZA.y - k * 0.5; }
  }
  return null;
}

/** Walkable height (plaza, stairs, terrace, ridge path, else terrain). */
export function groundHeight(x, z) {
  const r = Math.hypot(x, z);
  if (r <= PLAZA.r) return PLAZA.y;
  const s = stairY(x, z); if (s !== null) return s;
  if (r <= TERRACE.r1) return TERRACE.y;
  if (Math.abs(x) < RIDGE.half + 0.5 && z > RIDGE.z0 - 2 && z < RIDGE.z1) return ridgeY(z) + 0.1;
  return height(x, z);
}
