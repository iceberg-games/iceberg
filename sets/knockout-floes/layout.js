// Knockout Floes layout: pure data + math (no THREE / DOM), so Game Maker can reuse it.
// Scale mirrors GM2's knockoutFloes/config.js: CENTER_R 6.2, RING_R 11, RING_N 7, RING_FLOE_R 4.6.
export const WATER_Y = -0.6;
export const CENTER = { x: 0, z: 0, r: 6.2, top: 1.0 };
export const RING_R = 11, RING_N = 7, RING_FLOE_R = 4.6;
const H = [0.25, -0.15, 0.4, 0.05, -0.2, 0.35, 0.1];
export const FLOES = [
  { id: 'king', ...CENTER },
  ...Array.from({ length: RING_N }, (_, i) => {
    const a = i / RING_N * Math.PI * 2 + 0.22;
    return { id: `floe${i + 1}`, x: Math.cos(a) * RING_R, z: Math.sin(a) * RING_R, r: RING_FLOE_R, top: 0.9 + H[i], a };
  }),
];
// Thin ice bridges: king -> floes 1, 3, 5 ; floes 2-3 and 6-7 ring links. Others are jump gaps.
export const BRIDGES = [[0, 1], [0, 3], [0, 5], [2, 3], [6, 7]].map(([a, b]) => ({ a: FLOES[a], b: FLOES[b], half: 0.8 }));
export const ANCHORS = { spawn: { x: 0, z: 3.2, facing: Math.PI }, totem: { x: 0, z: 0 } };

// Irregular rim: radius wobble per floe (deterministic).
export function rimR(f, ang) { const s = f.x * 0.37 + f.z * 0.71; return f.r * (1 + 0.06 * Math.sin(ang * 3 + s) + 0.04 * Math.sin(ang * 7 + s * 2)); }

function bridgeY(x, z) {
  for (const b of BRIDGES) {
    const dx = b.b.x - b.a.x, dz = b.b.z - b.a.z, L = Math.hypot(dx, dz), ux = dx / L, uz = dz / L;
    const px = x - b.a.x, pz = z - b.a.z, along = px * ux + pz * uz, lat = Math.abs(-px * uz + pz * ux);
    if (along > 0 && along < L && lat < b.half) { const u = along / L; return b.a.top + (b.b.top - b.a.top) * u - 0.15 + Math.sin(u * Math.PI) * 0.25; }
  }
  return null;
}

/** Walkable height: floe top, bridge deck, or null over open water (fall void). */
export function groundHeight(x, z) {
  for (const f of FLOES) { const dx = x - f.x, dz = z - f.z, d = Math.hypot(dx, dz); if (d <= rimR(f, Math.atan2(dz, dx))) return f.top; }
  return bridgeY(x, z);
}
