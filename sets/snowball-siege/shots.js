// Snowball Siege trailer shots. Red fort x=-30, Blue fort x=+30, crystal at origin.
const orbit = (cx, cz, r, a0, a1, y0, y1, n = 12) => Array.from({ length: n }, (_, i) => {
  const t = i / (n - 1), a = a0 + (a1 - a0) * t; return [cx + Math.cos(a) * r, y0 + (y1 - y0) * t, cz + Math.sin(a) * r];
});
export const SHOTS = [
  { id: 'establish', name: 'Valley wide establish', duration: 14, ease: 'inOutSine', hold: 1.5,
    pos: [[0, 34, 70], [0, 24, 52], [0, 16, 38]], look: [[0, 2, 0], [0, 2, 0], [0, 3, 0]], fov: [40, 50] },
  { id: 'red-push', name: 'Red fort push-in', duration: 11, ease: 'inOutCubic',
    pos: [[-6, 3, 10], [-14, 3.5, 5], [-20, 4, 2]], look: [[-30, 5, 0], [-30, 5, 0], [-30, 6, 0]], fov: [55, 44] },
  { id: 'blue-push', name: 'Blue fort push-in', duration: 11, ease: 'inOutCubic',
    pos: [[6, 3, -10], [14, 3.5, -5], [20, 4, -2]], look: [[30, 5, 0], [30, 5, 0], [30, 6, 0]], fov: [55, 44] },
  { id: 'crystal', name: 'Midfield crystal orbit', duration: 16, ease: 'inOutSine',
    pos: orbit(0, 0, 9, 0.4, 0.4 + Math.PI * 1.4, 2.4, 4.5, 12), look: [[0, 2.8, 0], [0, 3.2, 0]], fov: 50 },
  { id: 'trench', name: 'Low dolly through cover', duration: 10, ease: 'inOutSine',
    pos: [[-24, 1.2, 14], [-12, 1.1, 10], [0, 1.3, 9], [12, 1.1, 10], [24, 1.2, 14]], look: [[-10, 1.5, 4], [0, 2, 0], [10, 1.8, 0], [24, 2, -4], [30, 4, 0]], fov: [60, 56] },
];
