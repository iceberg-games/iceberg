// Glacier Drift trailer shots. Lodge at top (z≈30, y≈130), run descends toward -z, finish z=-600.
import { atT, centerX, groundHeight, finish } from './layout.js';
const on = (t, dx = 0, dy = 3, dz = 0) => { const p = atT(t); return [p.x + dx, p.y + dy, p.z + dz]; };
const fz = finish.pos[2], fx = finish.pos[0];
export const SHOTS = [
  { id: 'lodge', name: 'Lodge establish', duration: 13, ease: 'inOutSine', hold: 1.5,
    pos: [[38, 150, -40], [30, 142, -18], [18, 137, -6]], look: [[0, 132, 28], [0, 132, 26], [0, 132, 20]], fov: [42, 52] },
  { id: 'first-curve', name: 'First curve flyover', duration: 12, ease: 'inOutCubic',
    pos: [on(0.03, 10, 22), on(0.12, 18, 16), on(0.2, 8, 12)], look: [on(0.1, 0, 0), on(0.18, 0, 0), on(0.27, 0, 0)], fov: [48, 56] },
  { id: 'chase', name: 'Mid-run chase', duration: 11, ease: 'linear',
    pos: [0.34, 0.37, 0.4, 0.43, 0.46].map((t) => on(t, 0, 2.6, 7)), look: [0.37, 0.4, 0.43, 0.46, 0.49].map((t) => on(t, 0, 1.2)), fov: 64 },
  { id: 'powerup-alley', name: 'Power-up alley dolly', duration: 12, ease: 'inOutSine',
    pos: [on(0.47, -7, 1.6), on(0.51, -6, 1.8), on(0.55, -7, 1.6)], look: [on(0.5, 1, 0.9), on(0.53, 1, 0.9), on(0.57, 1, 0.9)], fov: [58, 50] },
  { id: 'finish', name: 'Finish approach', duration: 12, ease: 'inOutCubic', hold: 1,
    pos: [[centerX(fz + 70), groundHeight(centerX(fz + 70), fz + 70) + 6, fz + 70], [fx + 4, finish.pos[1] + 4, fz + 30], [fx + 6, finish.pos[1] + 3, fz + 12]],
    look: [[fx, finish.pos[1] + 5, fz], [fx, finish.pos[1] + 6, fz], [fx, finish.pos[1] + 7, fz - 2]], fov: [50, 44] },
  { id: 'overlook', name: 'Glacier overlook', duration: 16, ease: 'inOutSine',
    pos: [[110, 190, 20], [120, 160, -200], [100, 120, -420]], look: [on(0.1, 0, 0), on(0.4, 0, 0), on(0.75, 0, 0)], fov: [45, 45] },
];
