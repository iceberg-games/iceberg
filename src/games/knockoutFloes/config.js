// Knockout Floes — tunables and save shape. BB rewards are modest and one-time.
export const GAME_ID = 'knockout-floes';
export const ROUND_SECS = 90;
export const BOT_COUNT = 5;
export const CENTER_R = 6.2, RING_R = 11, RING_N = 7, RING_FLOE_R = 4.6;
export const FOOT_TOL = 0.35;          // forgiveness past a floe's rim
export const SINK_START = 14;          // seconds before the first floe cracks
export const SINK_EVERY = 8.5;         // gap between floe collapses (shrinks late)
export const CRACK_SECS = 2.6;         // warning shake before a floe sinks
export const SHRINK_TO = 0.78;         // all floes slowly erode to this scale
export const BALL_SPEED = 24, BALL_GRAV = 10, BALL_R = 1.05;
export const KB_BASE = 10, KB_CHARGED = 19, CHARGE_SECS = 0.8;
export const THROW_CD = 0.38;
export const GRAV = 28, JUMP_V = 10;
export const BOT_NAMES = ['Pip', 'Mittens', 'Blizz', 'Nugget', 'Frosty', 'Tundra', 'Waddles', 'Sleet'];
export const BOT_COLORS = ['#ff5d73', '#ffb636', '#5be37d', '#b06cff', '#3fd0ff', '#ff7ad9'];
export const EMOTES = ['😂', '😤', '👋', '🥶'];
export const DEFAULT_SAVE = { wins: 0, rounds: 0, streak: 0, bestStreak: 0, kos: 0, milestones: [] };
export const MILESTONES = [
  { id: 'first-ko', bb: 5, label: 'First knockout', test: (r, s) => s.kos >= 1 },
  { id: 'first-win', bb: 15, label: 'First win', test: (r, s) => s.wins >= 1 },
  { id: 'streak-3', bb: 25, label: '3-win streak', test: (r, s) => s.bestStreak >= 3 },
  { id: 'kos-25', bb: 20, label: '25 knockouts lifetime', test: (r, s) => s.kos >= 25 },
  { id: 'ace', bb: 25, label: 'Knocked out every rival in one round', test: (r) => r.kos >= 5 },
];
