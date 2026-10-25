// Five cinematic shots. Dome centre (0,-6) on the summit plaza (y 40); ridge climbs from the south (+z).
// Tweak here, or fly the free cam (F) and press C to copy a pose.
const orbit = (cx, cz, r, a0, a1, y0, y1, n = 10) => Array.from({ length: n }, (_, i) => {
  const t = i / (n - 1), a = a0 + (a1 - a0) * t;
  return [cx + Math.cos(a) * r, y0 + (y1 - y0) * t, cz + Math.sin(a) * r];
});

export const SHOTS = [
  {
    id: 'ridge', name: 'Approach up the ridge', duration: 16, ease: 'inOutSine',
    pos: [[-14, 34, 168], [-8, 30, 128], [-3, 32, 92], [0, 37.5, 62], [0, 38.5, 44]],
    look: [[0, 46, -6], [0, 45, -6], [0, 43, -6]],
    fov: [40, 46],
  },
  {
    id: 'enter', name: 'Into the dome', duration: 12, ease: 'inOutCubic', hold: 1.5,
    pos: [[0, 41.8, 24], [0, 41.7, 14], [0.6, 41.6, 6], [3, 41.8, 0]],
    look: [[0, 42, -6], [-0.5, 41.6, -10], [-2.5, 41.4, -14]],
    fov: [48, 56],
  },
  {
    id: 'floor', name: 'Orbit the constellation floor', duration: 18, ease: 'inOutSine',
    pos: orbit(0, -6, 7.2, 0.6, 0.6 + Math.PI * 1.2, 46.5, 44.2, 12),
    look: [[0, 40, -6], [0, 40.4, -6]],
    fov: 52,
  },
  {
    id: 'meteors', name: 'Look up: meteor shower', duration: 14, ease: 'inOutSine', hold: 2,
    pos: [[5.5, 41.5, -0.5], [5.0, 41.3, -1.5], [4.6, 41.1, -2.4]],
    look: [[3, 43, -16], [-2, 64, -42], [-8, 125, -90]],
    fov: [58, 72],
  },
  {
    id: 'overlook', name: 'Terrace overlook at night', duration: 16, ease: 'inOutSine', hold: 2,
    pos: [[27, 38.6, -10], [29.5, 38.8, -3], [31.5, 40, 5], [38, 45, 15]],
    look: [[140, 8, -80], [140, 6, 10], [0, 44, -6]],
    fov: [44, 40],
  },
];
