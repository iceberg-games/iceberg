// Sled Rush: tuning numbers, rewards and save helpers.
export const GAME_ID = 'sled-rush';
export const REWARD_SOURCE = 'sled-rush';
export const FIRST_CLEAR_BB = 20;          // one-time, first finish (Publisher cap: sled-rush 25 per day / 100 total)
export const THREE_STAR_BB = 5;            // one-time, first 3-star run
export const COSMETIC = { questId: 'sr_quest_finish', itemId: 'sr_powder_scarf' }; // Cosmetics-owned (neck, epic, earnOnly)
// Optional deliveries: Set Builder (sets/sled-rush) and Sound (iceberg-audio/sled-rush). Hooks in audio.js.
export const AUDIO_PACK_BASE = null;       // e.g. '/audio/sled-rush/' once the pack is copied into public/

export const TRACK = {
  length: 900,         // metres downhill (z goes negative)
  width: 16,           // groomed lane width
  slope: 0.32,         // drop per metre
  gates: 24, boosts: 9, ramps: 5, rocks: 16,
};
export const PHYS = {
  gravity: 9.0, startSpeed: 8, maxSpeed: 46, boostSpeed: 8, drag: 0.012,
  steer: 26, lateralDamp: 4.5, edgeSlow: 0.55, jumpV: 8.5, airG: 22,
};
// par times in seconds for stars (★ finish, ★★ < two, ★★★ < three)
export const STARS = { two: 20, three: 15 };
export const GATE_BONUS = 0.4;   // seconds shaved per gate
export const starsFor = (t, finished) => !finished ? 0 : t < STARS.three ? 3 : t < STARS.two ? 2 : 1;

export function normalizeSave(s) {
  s = s && typeof s === 'object' ? s : {};
  return { best: Number.isFinite(s.best) ? s.best : null, stars: s.stars | 0, runs: s.runs | 0, cleared: !!s.cleared, threeStar: !!s.threeStar, questDone: !!s.questDone };
}
export function mergeSaves(a, b) {
  a = normalizeSave(a); b = normalizeSave(b);
  const best = a.best == null ? b.best : b.best == null ? a.best : Math.min(a.best, b.best);
  return { best, stars: Math.max(a.stars, b.stars), runs: Math.max(a.runs, b.runs), cleared: a.cleared || b.cleared, threeStar: a.threeStar || b.threeStar, questDone: a.questDone || b.questDone };
}
