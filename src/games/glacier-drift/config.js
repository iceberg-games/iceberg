// Glacier Drift: tuning, rewards (BB stubs) and save helpers. QoL update (no event).
export const GAME_ID = 'glacier-drift';
export const REWARD_SOURCE = 'glacier-drift';
export const FIRST_FINISH_BB = 15;   // stub: one-time first finish (Publisher sets caps)
export const FIRST_WIN_BB = 10;      // stub: one-time first 1st place
export const THREE_STAR_BB = 5;      // stub: one-time first 3-star
export const AUDIO_PACK_DIRS = ['./sfx/', '/workspace/iceberg-audio/glacier-drift/'];
export const BODY_TYPES = ['classic', 'tall', 'stout', 'pip', 'glacier', 'yeti']; // informational; never used to reject a body

export const TRACK = { length: 760, halfWidth: 9, gates: 22, pickups: 14, crystals: 12, seed: 2026 };
export const PHYS = { startSpeed: 9, maxSpeed: 44, drag: 0.011, slopeG: 30, steer: 28, lateralDamp: 4.6, jumpV: 8.5, airG: 22, edgeSlow: 0.55 };
export const POWER = {
  boost:  { icon: '🚀', label: 'Boost',  color: '#ffd84a', secs: 2.2 },
  shield: { icon: '🛡️', label: 'Shield', color: '#7fe3ff', secs: 6 },
  magnet: { icon: '🧲', label: 'Magnet', color: '#ff7ad9', secs: 7 },
  freeze: { icon: '❄️', label: 'Freeze', color: '#a9c8ff', secs: 2.6 },
};
export const POWER_IDS = Object.keys(POWER);
export const RIVALS = [
  { name: 'Frosty', color: '#ff6b8a', skill: 0.93 },
  { name: 'Nippy',  color: '#6be3a5', skill: 0.97 },
  { name: 'Blizz',  color: '#b18cff', skill: 1.0 },
];
export const STARS = { two: 24, three: 19 };  // finish = ★; also need 1st place for ★★★
export const GATE_BONUS = 0.35;
export const starsFor = (t, place) => place > 4 ? 0 : (t < STARS.three && place === 1) ? 3 : t < STARS.two ? 2 : 1;

export function normalizeSave(s) {
  s = s && typeof s === 'object' ? s : {};
  return { best: Number.isFinite(s.best) ? s.best : null, stars: s.stars | 0, runs: s.runs | 0, wins: s.wins | 0, cleared: !!s.cleared, won: !!s.won, threeStar: !!s.threeStar };
}
export function mergeSaves(a, b) {
  a = normalizeSave(a); b = normalizeSave(b);
  const best = a.best == null ? b.best : b.best == null ? a.best : Math.min(a.best, b.best);
  return { best, stars: Math.max(a.stars, b.stars), runs: Math.max(a.runs, b.runs), wins: Math.max(a.wins, b.wins), cleared: a.cleared || b.cleared, won: a.won || b.won, threeStar: a.threeStar || b.threeStar };
}
