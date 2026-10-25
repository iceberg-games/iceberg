// Sled Rush shot presets. pos/look are spline control points (world units). F + C in the viewer copies a pose.
import { atT, centerX, groundHeight } from './layout.js';
const at = (t, dy = 0, dx = 0) => { const p = atT(t); return [p.x + dx, p.y + dy, p.z]; };
const chase = (t0, t1, dy, n = 8, back = 0.025) => Array.from({ length: n }, (_, i) => at(t0 + (t1 - t0) * i / (n - 1) - back, dy));
const lead = (t0, t1, dy, n = 6) => Array.from({ length: n }, (_, i) => at(t0 + (t1 - t0) * i / (n - 1), dy));

export const SHOTS = [
  { id: 'overlook', name: 'Start: overlook down the run', duration: 12, ease: 'inOutSine',
    pos: [[70, 165, 10], [52, 150, 0], [30, 136, 8]], look: [at(0.0, 2), at(0.25), at(0.5)], fov: [48, 44] },
  { id: 'chase', name: 'Mid chase through Pine Chute', duration: 12, ease: 'linear',
    pos: chase(0.2, 0.5, 3.2), look: lead(0.23, 0.55, 1.2), fov: 62 },
  { id: 'jump', name: 'Jump crest (jump2) low-side', duration: 8, ease: 'inOutSine',
    pos: [[centerX(-404) + 11, groundHeight(centerX(-404), -404) + 1.5, -400], [centerX(-414) + 10, groundHeight(centerX(-414), -414) + 2.5, -414], [centerX(-424) + 9, groundHeight(centerX(-424), -424) + 3, -426]],
    look: [at(0.75, 3), at(0.78, 2), at(0.82, 0)], fov: 50 },
  { id: 'finish', name: 'Finish approach under the banner', duration: 10, ease: 'inOutCubic', hold: 2,
    pos: chase(0.86, 1.0, 2.6, 6, 0.03), look: [at(0.92, 4), at(1.0, 5), at(1.06, 4)], fov: [55, 48] },
];
