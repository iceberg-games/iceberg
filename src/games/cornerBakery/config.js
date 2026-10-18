// Corner Bakery Rush: Birg Bucks amounts, day tuning and the save format.
// Every BB number lives here so it can be reviewed in one place.
// Approved by the Iceberg Cosmetics bot (2026-10-17): first-clear rewards
// 15 / 25 / 40 BB, paid once per day per profile.

export const GAME_ID = 'corner-bakery';

/** One-time Birg Bucks reward for clearing Day 1 / 2 / 3 for the first time. */
export const DAY_CLEAR_REWARD_BB = [15, 25, 40];
/** Server earning source (docs/ECONOMY_API.md): 'custom_game' allows 50 per call. */
export const REWARD_SOURCE = 'custom_game';
/** Total BB this game can ever pay a profile: 15 + 25 + 40 = 80. */
export const MAX_TOTAL_REWARD_BB = DAY_CLEAR_REWARD_BB.reduce((a, b) => a + b, 0);

// ---------- items (coins here are in-game score, not Birg Bucks) ----------
export const ITEMS = {
  loaf:      { name: 'Loaf',            price: 8,  model: 'loaf',             icon: '🍞' },
  baguette:  { name: 'Baguette',        price: 9,  model: 'loaf-baguette',    icon: '🥖' },
  croissant: { name: 'Croissant',       price: 10, model: 'croissant',        icon: '🥐' },
  donut:     { name: 'Plain Donut',     price: 6,  model: 'donut',            icon: '🍩' },
  donutChoc: { name: 'Choco Donut',     price: 10, model: 'donut-chocolate',  icon: '🍩' },
  donutSprk: { name: 'Sprinkle Donut',  price: 10, model: 'donut-sprinkles',  icon: '🍩' },
  coffee:    { name: 'Coffee',          price: 6,  model: 'cup-coffee',       icon: '☕' },
  cookie:    { name: 'Cookie',          price: 5,  model: 'cookie-chocolate', icon: '🍪' },
  cupcake:   { name: 'Cupcake',         price: 7,  model: 'cupcake',          icon: '🧁' },
  muffin:    { name: 'Muffin',          price: 6,  model: 'muffin',           icon: '🧁' },
  cake:      { name: 'Birthday Cake',   price: 30, model: 'cake-birthday',    icon: '🎂' },
  burnt:     { name: 'Burnt!',          price: 0,  model: 'loaf',             icon: '💨', burnt: true },
};

/** Seconds to make each item, and how long after "done" an oven/fryer item burns. */
export const COOK_TIME = { loaf: 6, baguette: 7, croissant: 6.5, cake: 11, donut: 4, coffee: 3 };
export const BURN_AFTER = { loaf: 8, baguette: 8, croissant: 7, cake: 9, donut: 6 };
export const DISPLAY_STOCK = 4;          // per display item
export const DISPLAY_RESTOCK_EVERY = 10; // seconds per restocked display item
export const HANDS = 2;                  // items the baker can carry
export const SLOTS = 4;                  // customers waiting at the counter
export const STRIKES = 3;                // hearts per day
export const TIP_RATE = 0.6;             // tip = order value * rate * patience left

// ---------- days ----------
// menu: [item, weight]. stars: score thresholds for 1/2/3 stars (1 star = pass).
export const DAYS = [
  {
    n: 1, name: 'Opening Day', length: 150, patience: 46, spawn: [11, 15], maxItems: 2, multiChance: 0.35,
    menu: [['loaf', 3], ['baguette', 3], ['coffee', 3], ['cookie', 2], ['cupcake', 2]],
    oven: ['loaf', 'baguette'], fryer: false, display: ['cookie', 'cupcake'],
    stars: [70, 110, 140], tip: 'Bake bread in the ovens, brew coffee, and grab treats from the glass case.',
  },
  {
    n: 2, name: 'Croissant Craze', length: 150, patience: 48, spawn: [10.5, 14], maxItems: 2, multiChance: 0.45,
    menu: [['croissant', 4], ['loaf', 2], ['baguette', 2], ['coffee', 3], ['donutChoc', 2], ['donutSprk', 2], ['muffin', 2], ['cookie', 1]],
    oven: ['loaf', 'baguette', 'croissant'], fryer: true, display: ['cookie', 'muffin', 'cupcake'],
    stars: [100, 150, 195], tip: 'New: croissants! Fry donuts, then frost them chocolate or sprinkles.',
  },
  {
    n: 3, name: 'Snow-Day Rush', length: 165, patience: 46, spawn: [8.5, 11.5], maxItems: 3, multiChance: 0.55,
    menu: [['croissant', 3], ['loaf', 2], ['baguette', 2], ['coffee', 4], ['donutChoc', 2], ['donutSprk', 2], ['donut', 1], ['muffin', 1], ['cupcake', 1], ['cookie', 1]],
    oven: ['loaf', 'baguette', 'croissant', 'cake'], fryer: true, display: ['cookie', 'muffin', 'cupcake'],
    cakeAt: [35, 100], // seconds into the shift when a birthday-cake order arrives
    stars: [160, 240, 320], tip: 'Snow day! Big orders, and two birthday-cake specials (bake a cake in an oven).',
  },
];

export function starsFor(day, score) {
  const s = DAYS[day - 1].stars; return score >= s[2] ? 3 : score >= s[1] ? 2 : score >= s[0] ? 1 : 0;
}

// ---------- save data (per profile, economy.saveGameData(GAME_ID, ...)) ----------
export const DEFAULT_SAVE = { v: 1, best: [0, 0, 0], stars: [0, 0, 0], claimed: [], plays: 0, wins: 0 };

export function normalizeSave(raw) {
  const s = { ...DEFAULT_SAVE, ...(raw || {}) };
  const arr3 = (a) => [0, 1, 2].map(i => Math.max(0, Math.floor(+((a || [])[i]) || 0)));
  s.best = arr3(s.best); s.stars = arr3(s.stars).map(x => Math.min(3, x));
  s.claimed = [...new Set((Array.isArray(s.claimed) ? s.claimed : []).filter(d => d === 1 || d === 2 || d === 3))].sort();
  s.plays = Math.max(0, +s.plays || 0); s.wins = Math.max(0, +s.wins || 0);
  return s;
}
/** Merge two saves (e.g. local cache + server copy) without ever losing a claim. */
export function mergeSaves(a, b) {
  const x = normalizeSave(a), y = normalizeSave(b);
  return normalizeSave({
    v: 1, best: x.best.map((v, i) => Math.max(v, y.best[i])), stars: x.stars.map((v, i) => Math.max(v, y.stars[i])),
    claimed: [...x.claimed, ...y.claimed], plays: Math.max(x.plays, y.plays), wins: Math.max(x.wins, y.wins),
  });
}
export const dayUnlocked = (save, day) => day === 1 || save.stars[day - 2] > 0;

/**
 * Pure: record a finished day. Returns { save, reward, stars, newBest }.
 * The reward is paid only on the FIRST pass of that day for this profile.
 */
export function finishDay(save, day, score, { failed = false } = {}) {
  const s = normalizeSave(save);
  const stars = failed ? 0 : starsFor(day, score);
  const newBest = score > s.best[day - 1];
  s.best[day - 1] = Math.max(s.best[day - 1], score);
  s.stars[day - 1] = Math.max(s.stars[day - 1], stars);
  s.plays++;
  let reward = 0;
  if (stars > 0 && !s.claimed.includes(day)) { s.claimed = [...s.claimed, day].sort(); reward = DAY_CLEAR_REWARD_BB[day - 1]; }
  if (stars > 0 && day === 3) s.wins++;
  return { save: s, reward, stars, newBest };
}
