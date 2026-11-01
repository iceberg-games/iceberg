// Snowcone Tycoon: every tuning number, the BB rewards and the save format.
// BB rewards (15 / 25 / 40, once per day per profile) mirror the approved
// Corner Bakery pattern. Tip-coins are in-game currency only (never BB).

export const GAME_ID = 'snowcone-tycoon';
export const GAME_NAME = 'Snowcone Tycoon';
/** One-time Birg Bucks reward for clearing Day 1 / 2 / 3 for the first time. */
export const DAY_CLEAR_REWARD_BB = [15, 25, 40];
export const REWARD_SOURCE = 'custom_game';
/** Reason must match /^Reward in / for the custom_game source (docs/ECONOMY_API.md). */
export const rewardReason = (day) => `Reward in ${GAME_NAME}: Day ${day} cleared`;

// Flavors: readable colors + a colorblind-safe pattern for each.
export const FLAVORS = {
  blue:    { name: 'Blue Glacier',  color: '#2f8bff', pattern: 'stripe', short: 'Blue' },
  cherry:  { name: 'Cherry Freeze', color: '#ff3b5c', pattern: 'dots',   short: 'Cherry' },
  lime:    { name: 'Lime Frost',    color: '#5fd94a', pattern: 'swirl',  short: 'Lime' },
  grape:   { name: 'Grape Rime',    color: '#9b5cff', pattern: 'zigzag', short: 'Grape' },
  orange:  { name: 'Orange Slush',  color: '#ff9a2e', pattern: 'check',  short: 'Orange' },
  vanilla: { name: 'Vanilla Snow',  color: '#f6e7c1', pattern: 'star',   short: 'Vanilla' },
};
export const FLAVOR_ORDER = ['blue', 'cherry', 'lime', 'grape', 'orange', 'vanilla'];
export const TOPPINGS = {
  sprinkles: { name: 'Sprinkles',        icon: '✨', color: '#ff6fb5' },
  cherry:    { name: 'Cherry',           icon: '🍒', color: '#d6213b' },
  mallow:    { name: 'Mini Marshmallow', icon: '☁️', color: '#ffffff' },
  flake:     { name: 'Candy Flake',      icon: '❄️', color: '#8fe3ff' },
};
export const TOPPING_ORDER = ['sprinkles', 'cherry', 'mallow', 'flake'];

export const ICE_FILL_TIME = 1.6;   // seconds of held USE to fill a cone (before upgrades)
export const POUR_TIME = 0.55;      // seconds per syrup pour (before pump)
export const BASE_PRICE = 8, SYRUP_BONUS = 0, TOPPING_PRICE = 4;
export const TIP_RATE = 0.7;        // tip = price * rate * patience left
export const STRIKES = 3;

// ---------- days ----------
export const DAYS = [
  { n: 1, name: 'Opening Stand', length: 150, patience: 40, spawn: [9, 13], flavors: ['blue', 'cherry', 'lime'], toppingChance: 0,
    stars: [50, 85, 115], tip: 'Hold USE at the ice shaver, tap a syrup bottle, then serve the matching customer.' },
  { n: 2, name: 'Syrup Rush', length: 165, patience: 42, spawn: [8, 11.5], flavors: ['blue', 'cherry', 'lime', 'grape', 'orange'], toppingChance: 0.45,
    stars: [80, 130, 175], tip: 'New: Grape & Orange! The topping bar opens — some guests want sprinkles or a cherry on top.' },
  { n: 3, name: 'Boardwalk Festival', length: 180, patience: 40, spawn: [6.5, 9.5], flavors: FLAVOR_ORDER, toppingChance: 0.7,
    stars: [120, 190, 250], tip: 'Festival crowds! Vanilla Snow joins the menu and almost everyone wants a topping.' },
];
export function starsFor(day, score) { const s = DAYS[day - 1].stars; return score >= s[2] ? 3 : score >= s[1] ? 2 : score >= s[0] ? 1 : 0; }

// ---------- stand shop (tip-coins) ----------
// kind 'machine' = place machine, 'upgrade' = stand upgrade. Levels are cumulative.
export const SHOP = [
  { id: 'shaver', kind: 'machine', name: 'Turbo Shaver', icon: '🧊', desc: 'Shave ice faster', costs: [40, 90], effect: (l) => `${[1, 1.5, 2.1][l]}× shave speed` },
  { id: 'pump',   kind: 'machine', name: 'Syrup Pumps',  icon: '🧴', desc: 'Pour syrup in a flash', costs: [50], effect: (l) => l ? 'instant pours' : 'normal pours' },
  { id: 'heater', kind: 'machine', name: 'Cozy Heater',  icon: '🔥', desc: 'Guests wait longer', costs: [60], effect: (l) => `+${l * 20}% patience` },
  { id: 'counter', kind: 'upgrade', name: 'Longer Counter', icon: '🪵', desc: 'Room for a 4th guest', costs: [70], effect: (l) => `${3 + l} queue spots` },
  { id: 'neon',   kind: 'upgrade', name: 'Neon Sign',     icon: '💡', desc: 'Brighter sign, bigger tips', costs: [35, 80, 140], effect: (l) => `+${l * 10}% tips` },
  { id: 'patio',  kind: 'upgrade', name: 'Patio Seating', icon: '⛱️', desc: 'Tables, lights & happier guests', costs: [55, 110], effect: (l) => `+${l * 8}% patience` },
];
export const shopItem = (id) => SHOP.find(s => s.id === id);
export const level = (save, id) => save.upgrades[id] || 0;
export function buyCost(save, id) { const it = shopItem(id), l = level(save, id); return l < it.costs.length ? it.costs[l] : null; }
/** Gameplay modifiers derived from owned upgrades. */
export function mods(save) {
  return {
    shave: [1, 1.5, 2.1][level(save, 'shaver')],
    instantPour: level(save, 'pump') > 0,
    patience: 1 + level(save, 'heater') * 0.2 + level(save, 'patio') * 0.08,
    slots: 3 + level(save, 'counter'),
    tips: 1 + level(save, 'neon') * 0.1,
  };
}

// ---------- renown ----------
export const RENOWN_XP = [0, 12, 30, 55, 90, 140]; // xp (guests served) to reach level 1..6
export const renownLevel = (xp) => { let l = 1; for (let i = 1; i < RENOWN_XP.length; i++) if (xp >= RENOWN_XP[i]) l = i + 1; return l; };
export const RENOWN_BONUS = (lvl) => 10 + lvl * 10; // tip-coin gift on level-up

// ---------- save (per profile, economy.saveGameData(GAME_ID, ...)) ----------
export const DEFAULT_SAVE = { v: 1, best: [0, 0, 0], stars: [0, 0, 0], claimed: [], coins: 0, xp: 0, upgrades: {}, plays: 0 };
export function normalizeSave(raw) {
  const s = { ...DEFAULT_SAVE, ...(raw || {}) };
  const arr3 = (a) => [0, 1, 2].map(i => Math.max(0, Math.floor(+((a || [])[i]) || 0)));
  s.best = arr3(s.best); s.stars = arr3(s.stars).map(x => Math.min(3, x));
  s.claimed = [...new Set((Array.isArray(s.claimed) ? s.claimed : []).filter(d => d === 1 || d === 2 || d === 3))].sort();
  s.coins = Math.max(0, Math.floor(+s.coins || 0)); s.xp = Math.max(0, Math.floor(+s.xp || 0)); s.plays = Math.max(0, +s.plays || 0);
  const up = {}; for (const it of SHOP) up[it.id] = Math.min(it.costs.length, Math.max(0, Math.floor(+(s.upgrades || {})[it.id] || 0)));
  s.upgrades = up; s.v = 1;
  return s;
}
/** Merge two saves (local cache + server) without ever losing a claim. */
export function mergeSaves(a, b) {
  const x = normalizeSave(a), y = normalizeSave(b);
  const pickY = y.plays > x.plays; // coins/upgrades follow the more-played copy
  const up = {}; for (const it of SHOP) up[it.id] = Math.max(x.upgrades[it.id], y.upgrades[it.id]);
  return normalizeSave({
    best: x.best.map((v, i) => Math.max(v, y.best[i])), stars: x.stars.map((v, i) => Math.max(v, y.stars[i])),
    claimed: [...x.claimed, ...y.claimed], coins: pickY ? y.coins : x.coins, xp: Math.max(x.xp, y.xp), upgrades: up, plays: Math.max(x.plays, y.plays),
  });
}
export const dayUnlocked = (save, day) => day === 1 || save.stars[day - 2] > 0;

/** Pure: record a finished shift. Reward paid only on the FIRST pass of that day. */
export function finishDay(save, day, { score, coins, served, failed }) {
  const s = normalizeSave(save);
  const stars = failed ? 0 : starsFor(day, score);
  const newBest = score > s.best[day - 1];
  s.best[day - 1] = Math.max(s.best[day - 1], score);
  s.stars[day - 1] = Math.max(s.stars[day - 1], stars);
  s.plays++; s.coins += coins;
  const before = renownLevel(s.xp); s.xp += served; const after = renownLevel(s.xp);
  let gift = 0; for (let l = before + 1; l <= after; l++) gift += RENOWN_BONUS(l); s.coins += gift;
  let reward = 0;
  if (stars > 0 && !s.claimed.includes(day)) { s.claimed = [...s.claimed, day].sort(); reward = DAY_CLEAR_REWARD_BB[day - 1]; }
  return { save: s, reward, stars, newBest, levelUp: after > before ? after : 0, gift };
}
export function buy(save, id) {
  const s = normalizeSave(save), c = buyCost(s, id);
  if (c == null || s.coins < c) return null;
  s.coins -= c; s.upgrades[id]++; return s;
}
