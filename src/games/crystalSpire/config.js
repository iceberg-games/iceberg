// Crystal Spire: numbers, save shape and one-time Birg Buck rewards (pure, no DOM).
export const GAME_ID = 'crystal-spire';
export const GAME_NAME = 'Crystal Spire';
export const REWARD_SOURCE = 'custom_game';
// One-time summit clears by time band (each paid once per profile, cumulative).
export const TIERS = [
  { id: 'bronze', name: 'Bronze', icon: '🥉', maxTime: Infinity, bb: 15 },
  { id: 'silver', name: 'Silver', icon: '🥈', maxTime: 300, bb: 25 },
  { id: 'gold', name: 'Gold', icon: '🥇', maxTime: 180, bb: 40 },
];
export const rewardReason = (tier) => `Reward in ${GAME_NAME}: ${tier} summit`;
export const FALL_DEATH = 13;          // metres of free fall that shatters you
export const PANE = { on: 2.6, warn: 0.9, off: 1.4 };
export const GUST = { min: 12, max: 25, push: 5.5, dur: 1.4 };

export function normalizeSave(s) {
  s = s && typeof s === 'object' ? s : {};
  return { best: Number.isFinite(s.best) && s.best > 0 ? s.best : null, claimed: Array.isArray(s.claimed) ? s.claimed.filter(x => TIERS.some(t => t.id === x)) : [],
    bestShards: Math.max(0, s.bestShards | 0), clears: Math.max(0, s.clears | 0), deaths: Math.max(0, s.deaths | 0) };
}
export function mergeSaves(a, b) {
  a = normalizeSave(a); b = normalizeSave(b);
  const best = [a.best, b.best].filter(Boolean);
  return { best: best.length ? Math.min(...best) : null, claimed: [...new Set([...a.claimed, ...b.claimed])], bestShards: Math.max(a.bestShards, b.bestShards), clears: Math.max(a.clears, b.clears), deaths: Math.max(a.deaths, b.deaths) };
}
export const starsFor = (time) => TIERS.filter(t => time <= t.maxTime).length;
/** Record a summit. Returns { save, stars, reward, newTiers, newBest }. Claims are recorded before paying. */
export function finishClimb(save, time, shards) {
  save = normalizeSave(save);
  const earned = TIERS.filter(t => time <= t.maxTime), newTiers = earned.filter(t => !save.claimed.includes(t.id));
  const newBest = !save.best || time < save.best;
  const next = { ...save, best: newBest ? time : save.best, claimed: [...save.claimed, ...newTiers.map(t => t.id)], bestShards: Math.max(save.bestShards, shards), clears: save.clears + 1 };
  return { save: next, stars: earned.length, reward: newTiers.reduce((n, t) => n + t.bb, 0), newTiers, newBest };
}
export const fmtTime = (s) => { if (s == null) return '--:--'; const m = Math.floor(s / 60), r = s - m * 60; return `${m}:${r < 10 ? '0' : ''}${r.toFixed(1)}`; };
