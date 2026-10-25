// Lumen Tag — tunables and save shape. BB rewards are modest and one-time.
export const GAME_ID = 'lumen-tag';
export const ROUND_SECS = 90;
export const TAGS_TO_WIN = 15;
export const BOT_COUNT = 5;
export const ARENA_R = 30;                 // playable radius
export const RANGE = 46;                   // beam reach
export const HIT_R = 0.95, HIT_R_PRISM = 1.5;
export const FIRE_CD = 0.3, BOT_FIRE_CD = [0.75, 1.5];
export const RESPAWN_SECS = 1.6, INVULN_SECS = 1.4;
export const POWER_SECS = { prism: 6, surge: 6, shield: 9 };
export const POWER_RESPAWN = 11;
export const PRISM_SPREAD = 0.12;          // radians between prism beams
export const BOT_SPEED = 7.2;
export const BOT_NAMES = ['Glint', 'Prism', 'Nova', 'Quartz', 'Flicker', 'Opal', 'Zephyr', 'Spark'];
export const BOT_COLORS = ['#ff4f8b', '#ffb238', '#5bff9c', '#b46cff', '#ff6e3a', '#3fe6ff'];
export const ME_COLOR = '#4fd8ff';
export const POWERS = {
  prism:  { color: '#ff7af0', label: 'PRISM', icon: '🔺', sub: 'triple beams' },
  surge:  { color: '#ffe14f', label: 'SURGE', icon: '⚡', sub: 'speed + rapid fire' },
  shield: { color: '#6bffcf', label: 'SHIELD', icon: '🛡', sub: 'blocks one tag' },
};
export const DEFAULT_SAVE = { rounds: 0, wins: 0, tags: 0, bestTags: 0, bestStreak: 0, milestones: [] };
export const MILESTONES = [
  { id: 'first-tag', bb: 5, label: 'First tag', test: (r, s) => s.tags >= 1 },
  { id: 'first-win', bb: 15, label: 'First win', test: (r, s) => s.wins >= 1 },
  { id: 'streak-5', bb: 15, label: '5 tags without being tagged', test: (r, s) => s.bestStreak >= 5 },
  { id: 'tags-100', bb: 20, label: '100 tags lifetime', test: (r, s) => s.tags >= 100 },
  { id: 'flawless', bb: 25, label: 'Won without being tagged', test: (r) => r.won && r.deaths === 0 },
];
