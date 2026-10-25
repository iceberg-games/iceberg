// Five trailer shots for Knockout Floes. King floe at origin (top y 1); ring of 7 floes at r 11.
const orbit = (cx, cz, r, a0, a1, y0, y1, n = 12) => Array.from({ length: n }, (_, i) => {
  const t = i / (n - 1), a = a0 + (a1 - a0) * t; return [cx + Math.cos(a) * r, y0 + (y1 - y0) * t, cz + Math.sin(a) * r];
});
export const SHOTS = [
  { id: 'establish', name: 'Wide arena establish', duration: 14, ease: 'inOutSine', hold: 1.5,
    pos: [[-48, 26, 52], [-30, 20, 40], [-14, 14, 30]], look: [[0, 0, 0], [0, 1, 0], [0, 1.5, 0]], fov: [38, 46] },
  { id: 'weave', name: 'Fly between floes', duration: 14, ease: 'inOutSine',
    pos: orbit(0, 0, 16, 2.6, 2.6 + Math.PI * 1.1, 2.2, 3.4, 10), look: [[0, 1.5, 0], [0, 2, 0]], fov: 54 },
  { id: 'totem', name: 'King totem orbit', duration: 16, ease: 'inOutSine',
    pos: orbit(0, 0, 3.7, 0.3, 0.3 + Math.PI * 1.3, 2.4, 4.0, 12), look: [[0, 3.2, 0], [0, 3.6, 0]], fov: 50 },
  { id: 'chase', name: 'Low chase across gaps', duration: 10, ease: 'inOutCubic',
    pos: [[22, 1.6, 4], [14, 1.5, 2], [6, 1.9, 0.6], [-4, 1.7, -1], [-14, 1.7, -3]], look: [[10, 1.4, 2.5], [0, 1.6, 0], [-12, 1.5, -3], [-26, 1.4, -5]], fov: [62, 58] },
  { id: 'hero', name: 'Neon night hero look-up', duration: 12, ease: 'inOutSine', hold: 2,
    pos: [[2.6, 1.5, 3.2], [2.2, 1.4, 2.7], [1.8, 1.35, 2.3]], look: [[0, 3.5, 0], [-2, 12, -10], [-10, 60, -80]], fov: [56, 70] },
];
