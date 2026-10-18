// Giant Rainbow Obby: Birg Bucks amounts and persistence keys.
// All BB numbers live here so they can be reviewed/approved in one place.
// Context: daily bonus is 100 BB, cosmetics cost 30-600 BB.

export const GAME_ID = 'giant-rainbow-obby';

/** One-time reward for reaching each 100-stage milestone (100, 200, ... 900, except 500). */
export const MILESTONE_REWARD_BB = 15;
/** One-time reward for reaching the halfway milestone (stage 500), instead of the normal milestone reward. */
export const HALFWAY_REWARD_BB = 40;
/** One-time reward for reaching the winner pad (stage 1000). */
export const FINISH_REWARD_BB = 100;
/** Cost to skip one stage. Larger than any per-stage share of rewards, so skipping can't farm BB. */
export const SKIP_STAGE_COST_BB = 15;
/** Gear prices in the death popup. A bought gear is permanent but only works in this game. */
export const GEAR_PRICES_BB = { speedCoil: 75, gravityCoil: 120, magicCarpet: 250 };

/** Reward (BB) for reaching stage i for the first time, or 0. Each is paid at most once per profile. */
export function milestoneReward(i) {
  if (i === 1000) return FINISH_REWARD_BB;
  if (i === 500) return HALFWAY_REWARD_BB;
  if (i > 0 && i < 1000 && i % 100 === 0) return MILESTONE_REWARD_BB;
  return 0;
}
/** Total BB a player can ever earn from this game (one-time): 8*15 + 40 + 100 = 260. */
export const MAX_TOTAL_REWARD_BB = [...Array(1001).keys()].reduce((s, i) => s + milestoneReward(i), 0);

// ---------- per-game save data (stored on the shared profile under gameData[GAME_ID]) ----------
export const DEFAULT_SAVE = { checkpoint: 0, best: 0, claimed: [], gears: [], deaths: 0, skips: 0 };

/** Pure helper: returns { save, reward } after reaching stage i. Never pays twice. */
export function reachStage(save, i, { skipped = false } = {}) {
  const s = { ...save, claimed: [...save.claimed] };
  if (i > s.checkpoint) s.checkpoint = i;
  if (i > s.best) s.best = i;
  let reward = 0;
  const r = milestoneReward(i);
  // Skipping onto a milestone never pays it (skip 15 -> earn 15/40/100 would be a loophole).
  if (r && !skipped && !s.claimed.includes(i)) { s.claimed.push(i); reward = r; }
  return { save: s, reward };
}
