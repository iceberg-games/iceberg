// The five trailer shots. pos/look are spline control points (world units); timing is eased and
// deterministic, so every take is identical. Tweak here, or fly the free cam (F) and press C to copy a pose.
const orbit = (cx, cz, r, a0, a1, y0, y1, n = 10) => Array.from({ length: n }, (_, i) => {
  const t = i / (n - 1), a = a0 + (a1 - a0) * t;
  return [cx + Math.cos(a) * r, y0 + (y1 - y0) * t, cz + Math.sin(a) * r];
});

export const SHOTS = [
  {
    id: 'flyover', name: 'Flyover in from the mountains', duration: 16, ease: 'inOutSine',
    pos: [[-12, 168, 368], [-7, 128, 300], [-3, 82, 228], [0, 46, 160], [2, 30, 100], [4, 24, 64]],
    look: [[0, 22, 20], [0, 16, 10], [0, 12, 0], [0, 14, -40]],
    fov: [42, 46],
  },
  {
    id: 'street', name: 'Dolly through the main street', duration: 14, ease: 'inOutSine',
    pos: [[-2.2, 3.4, 118], [-1.2, 3.1, 92], [0.8, 3.3, 66], [1.6, 3.8, 46], [1.2, 4.6, 34]],
    look: [[0, 5.5, 60], [0, 7, 30], [0, 10, 4], [0, 12.5, 0]],
    fov: 42,
  },
  {
    id: 'lake', name: 'Low across the frozen lake', duration: 12, ease: 'inOutSine',
    pos: [[128, 1.1, 34], [110, 0.75, 25], [92, 0.6, 16], [74, 0.7, 8]],
    look: [[20, 6, 4], [0, 9, 0]],
    fov: 38,
  },
  {
    id: 'tree', name: 'Orbit the town tree', duration: 18, ease: 'inOutSine',
    pos: orbit(0, 0, 31, 0.35, -Math.PI + 0.35, 5, 9.5, 12),
    look: [[0, 12, 0], [0, 15, 0]],
    fov: 50,
  },
  {
    id: 'castle', name: 'Push-in on the ice castle (title reveal)', duration: 14, ease: 'inOutCubic', hold: 3,
    pos: [[0, 4.5, -34], [0.5, 9, -52], [0.5, 19, -68], [0, 29, -80]],
    look: [[0, 30, -160], [0, 48, -168], [0, 56, -168]],
    fov: [44, 42],
  },
];
