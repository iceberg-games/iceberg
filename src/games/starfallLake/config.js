// Starfall Lake — tunables and save shape. All BB rewards are modest and one-time.
export const GAME_ID = 'starfall-lake';
export const LAKE_R = 36;            // skateable radius (shore beyond)
export const ROUND_SECS = 75;
export const MAX_STARS = 7;          // live stars at once (SWGL-friendly)
export const FALL_SECS = 1.9;        // sky -> ice
export const REST_SECS = 4.2;        // lies glowing on the ice before winking out
export const CATCH_R = 1.7;          // base aura radius, grows with combo
export const COMBO_WINDOW = 3.2;     // seconds to chain catches
export const MAX_COMBO = 8;
export const STAR_POINTS = 50;
export const GOLD_CHANCE = 0.12;     // golden star = 3x points + extra combo time
export const DEFAULT_SAVE = { best: 0, rounds: 0, constellations: 0, milestones: [] };
// One-time Birg Buck milestones (source "Starfall Lake").
export const MILESTONES = [
  { id: 'first-constellation', bb: 10, label: 'First constellation', test: (r, s) => s.constellations >= 1 },
  { id: 'score-5k', bb: 15, label: 'Scored 5,000', test: (r) => r.score >= 5000 },
  { id: 'score-15k', bb: 25, label: 'Scored 15,000', test: (r) => r.score >= 15000 },
  { id: 'constellations-25', bb: 25, label: '25 constellations lifetime', test: (r, s) => s.constellations >= 25 },
];
export const CONSTELLATION_NAMES = ['The Sled', 'Birg Major', 'The Lantern', 'Snow Hare', 'The Kite', 'Frost Crown', 'The Narwhal', 'Little Igloo', 'The Skater', 'Aurora Fox'];
// How to run: from the worktree, `npx vite build && node scripts/starfall-smoke.mjs` (headless smoke),
// or `npx vite` and pick "Starfall Lake" on the portal. Controls: WASD/joystick skate, Space jump, R restart.
