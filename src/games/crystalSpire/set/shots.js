// Crystal Spire shots — vertical-readable (try ?w=1080&h=1920 too): wide exterior, climb path, chambers, summit.
import { PLATFORMS, CHECKPOINTS, CHAMBERS, SUMMIT, BEACON, BRIDGES } from './layout.js';
const P = (i) => PLATFORMS.filter(p => p.kind !== 'satellite')[i];
const spiral = (y0, y1, r, a0, turns, n = 14) => Array.from({ length: n }, (_, k) => { const t = k / (n - 1), a = a0 + t * turns * Math.PI * 2; return [Math.cos(a) * r, y0 + (y1 - y0) * t, Math.sin(a) * r]; });
const cam = (c, d = 6, up = 2.2) => { const a = Math.atan2(c.z, c.x), r = Math.hypot(c.x, c.z); return [Math.cos(a + 0.25) * (r + d), c.y + up, Math.sin(a + 0.25) * (r + d)]; };
const b0 = BRIDGES[2];
export const SHOTS = [
  { id: 'cirque-reveal', name: 'Cirque reveal: base → needle tip tilt-up', duration: 16, ease: 'inOutSine',
    pos: [[-14, 6, 44], [-8, 20, 42], [-2, 38, 40]], look: [[0, 10, 0], [0, 34, 0], [0, BEACON.y - 8, 0]], fov: [62, 58] },
  { id: 'climb-spiral', name: 'Climb path spiral (route ledges + glow veins)', duration: 20, ease: 'inOutSine',
    pos: spiral(4, SUMMIT.y + 6, 24, Math.PI * 0.5, 1.1), look: spiral(1, SUMMIT.y, 0.1, 0, 0, 14), fov: 50 },
  { id: 'echo-geode', name: `Chamber close-up: ${CHAMBERS[0].name}`, duration: 10, ease: 'inOutSine', hold: 1,
    pos: [cam(CHAMBERS[0], 9, 3), cam(CHAMBERS[0], 5.5, 1.8)], look: [[CHAMBERS[0].x, CHAMBERS[0].y + 1, CHAMBERS[0].z], [CHAMBERS[0].x, CHAMBERS[0].y + 0.8, CHAMBERS[0].z]], fov: [46, 40] },
  { id: 'wind-bridge', name: 'Wind bridge out to a satellite shard', duration: 12, ease: 'inOutSine',
    pos: [[b0.a[0] * 0.75, b0.a[1] + 2.2, b0.a[2] * 0.75], [b0.b[0] * 0.92, b0.b[1] + 2.4, b0.b[2] * 0.92]], look: [b0.b, [b0.b[0] * 1.3, b0.b[1] - 4, b0.b[2] * 1.3]], fov: 56 },
  { id: 'prism-gallery', name: `Chamber close-up: ${CHAMBERS[1].name}`, duration: 10, ease: 'inOutSine', hold: 1,
    pos: [cam(CHAMBERS[1], 8, 4), cam(CHAMBERS[1], 5, 2)], look: [[CHAMBERS[1].x, CHAMBERS[1].y + 1, CHAMBERS[1].z], [CHAMBERS[1].x, CHAMBERS[1].y + 1.2, CHAMBERS[1].z]], fov: [46, 40] },
  { id: 'silhouette', name: 'Full-height silhouette (vertical Shorts framing)', duration: 14, ease: 'inOutSine',
    pos: [[30, 10, -34], [36, 40, -26]], look: [[0, 20, 0], [0, 50, 0]], fov: [64, 60] },
  { id: 'summit-beacon', name: 'Summit: beacon sockets + tip crystal', duration: 14, ease: 'inOutSine',
    pos: spiral(SUMMIT.y + 9, SUMMIT.y + 13, 10, 0.4, 0.35, 8), look: [[0, SUMMIT.y, 0], [0, SUMMIT.y + 6, 0]], fov: [48, 54] },
  { id: 'route-pov', name: 'Climber POV up the first ledges', duration: 12, ease: 'linear',
    pos: [0, 1, 2, 3, 4, 5].map(i => { const p = P(i); return [p.x * 1.08, p.y + 1.7, p.z * 1.08]; }), look: [1, 2, 3, 4, 5, 6].map(i => { const p = P(i); return [p.x, p.y + 1.2, p.z]; }), fov: 66 },
];
