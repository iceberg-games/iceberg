// Five cinematic shots. Lodge front door at (0, -4), sign at (-16, 4), shed at x 18..28, lift at x -40.
const orbit = (cx, cz, r, a0, a1, y0, y1, n = 10) => Array.from({ length: n }, (_, i) => {
  const t = i / (n - 1), a = a0 + (a1 - a0) * t;
  return [cx + Math.cos(a) * r, y0 + (y1 - y0) * t, cz + Math.sin(a) * r];
});

export const SHOTS = [
  {
    id: 'arrival', name: 'Arrival: dead OPEN sign', duration: 14, ease: 'inOutSine', hold: 1.5,
    pos: [[-4, 1.6, 46], [-10, 1.7, 22], [-13, 2.2, 11]],
    look: [[0, 6, -10], [-10, 5, -4], [-16, 4.6, 4]],
    fov: [42, 50],
  },
  {
    id: 'porch', name: 'Porch push to the door', duration: 12, ease: 'inOutCubic', hold: 1.5,
    pos: [[7, 1.7, 8], [3, 1.65, 2.5], [0.4, 1.6, -2.2], [0, 1.6, -6]],
    look: [[0, 2.2, -4], [0, 1.8, -10], [-3, 1.2, -19]],
    fov: [50, 58],
  },
  {
    id: 'greatroom', name: 'Great room by the dying fire', duration: 16, ease: 'inOutSine',
    pos: orbit(-1, -12, 5.5, 0.4, 0.4 + Math.PI * 0.9, 2.6, 1.8, 10),
    look: [[-3, 1.2, -17], [-1, 1.0, -12]],
    fov: 60,
  },
  {
    id: 'lift', name: 'Chairlift up the slope', duration: 16, ease: 'inOutSine', hold: 2,
    pos: [[-32, 2, 14], [-34, 5, -10], [-33, 14, -50], [-30, 24, -84]],
    look: [[-40, 8, -20], [-40, 14, -60], [-40, 22, -100], [0, 6, -10]],
    fov: [46, 40],
  },
  {
    id: 'overview', name: 'Forsaken overview (loops)', duration: 18, ease: 'inOutSine', hold: 2,
    pos: orbit(0, -6, 52, Math.PI * 0.3, Math.PI * 0.85, 30, 22, 12),
    look: [[0, 2, -6], [-4, 3, -10]],
    fov: [42, 46],
  },
];
