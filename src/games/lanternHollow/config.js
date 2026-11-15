// Lantern Hollow: ids, tuning numbers, upgrade/quest tables, save shape and one-time Birg Buck rewards (pure, no DOM).
// Full design: /workspace/iceberg-game-maker/designs/lantern-hollow-brief.md
export const GAME_ID = 'lantern-hollow';
export const GAME_NAME = 'Lantern Hollow';
export const REWARD_SOURCE = 'custom_game';
export const rewardReason = (what) => `Reward in ${GAME_NAME}: ${what}`;
export const SAVE_VERSION = 1;

// Player baseline (upgrades raise these; see UPGRADES).
export const PLAYER = { hearts: 3, glow: 100, glowRegen: 3, lightRadius: 6, dashCooldown: 1.2, dashDist: 6, iframes: 0.6 };

// 5-level upgrade tracks (brief §5.2). cost[i] = price of level i+1.
export const UPGRADES = {
  blade:   { name: 'Blade',   npc: 'brann',  icon: '⚔️', stat: (l) => ({ damage: [10, 13, 16, 20, 24, 28][l] }),
    cost: [{ embers: 60 }, { embers: 150 }, { embers: 300, glowcap: 10 }, { embers: 550, rustcog: 12 }, { embers: 900, shard: 8, sigil: 1 }] },
  lantern: { name: 'Lantern', npc: 'ysolde', icon: '🏮', stat: (l) => ({ radius: [6, 7, 8, 9, 10, 11][l], glow: [100, 112, 124, 136, 148, 160][l] }),
    cost: [{ embers: 50 }, { embers: 140 }, { embers: 280, glowcap: 10 }, { embers: 500, rustcog: 12 }, { embers: 850, shard: 8 }] },
  hearts:  { name: 'Hearts',  npc: 'moss',   icon: '❤️', stat: (l) => ({ hearts: 3 + l }),
    cost: [{ embers: 80 }, { embers: 180 }, { embers: 320, glowcap: 8 }, { embers: 600, rustcog: 10 }, { embers: 950, shard: 8, sigil: 1 }] },
  dash:    { name: 'Dash',    npc: 'brann',  icon: '💨', stat: (l) => ({ cooldown: [1.2, 1.05, 0.9, 0.8, 0.7, 0.6][l], charges: l >= 3 ? 2 : 1 }),
    cost: [{ embers: 70 }, { embers: 160 }, { embers: 300, rustcog: 10 }, { embers: 520 }, { embers: 800, shard: 6 }] },
};
export const HEARTH_TIERS = [200, 500, 1000, 1800, 3000];

// Quests (brief §6). kind = event counted by quests.js; goal = count.
// req = quest id that must be turned in first; area = area the quest needs (locked areas show "coming soon").
export const QUESTS = [
  { id: 'lh_q_first_light', title: 'First Light', giver: 'wick', kind: 'light:caves', goal: 1, desc: 'Travel to the Glowroot Caves by the Waystone and light the Entrance Grotto lamp post.', reward: { embers: 40 } },
  { id: 'lh_q_slime_time', title: 'Slime Time', giver: 'board', kind: 'kill:slime', goal: 15, req: 'lh_q_first_light', desc: 'Glimmer Slimes are clogging the grotto. Pop 15 of them (little ones count).', reward: { embers: 80, glowcap: 3 } },
  { id: 'lh_q_spore_sweep', title: 'Spore Sweep', giver: 'board', kind: 'kill:spore', goal: 8, req: 'lh_q_first_light', desc: 'Pop 8 Spore Puffs in the Mushroom Hall. Back off when they swell up!', reward: { embers: 90 } },
  { id: 'lh_q_mossmaw', title: 'The Mother Root', giver: 'wick', kind: 'boss:mossmaw', goal: 1, req: 'lh_q_first_light', desc: 'Clear the Spore Garden to open Mossmaw\'s Den, then defeat Mother Mossmaw. Flare her glowing spore sacs when the den goes dark.', reward: { embers: 200, sigil: 1 } },
  { id: 'lh_q_hidden_veins', title: 'Hidden Veins', giver: 'ysolde', kind: 'reveal:vein', goal: 5, req: 'lh_q_first_light', desc: 'Hold FLARE near cave walls to reveal 5 hidden ember veins in the Glowroot Caves.', reward: { embers: 150, oil: 2 } },
  { id: 'lh_q_cogs', title: 'Cogs for Brann', giver: 'brann', kind: 'collect:rustcog', goal: 20, req: 'lh_q_mossmaw', area: 'mine', desc: 'Bring Brann 20 Rustcogs from the Sunken Mine.', reward: { charm: 'swiftstep' } },
  { id: 'lh_q_drain', title: 'Drain the Gallery', giver: 'wick', kind: 'lever:mine', goal: 3, req: 'lh_q_mossmaw', area: 'mine', desc: 'Pull the three Flooded Gallery levers in the Sunken Mine.', reward: { embers: 180 } },
  { id: 'lh_q_foreman', title: 'The Drowned Foreman', giver: 'wick', kind: 'boss:foreman', goal: 1, req: 'lh_q_drain', area: 'mine', desc: 'Defeat the Drowned Foreman in the Foreman\'s Pit.', reward: { embers: 350, sigil: 1 } },
  { id: 'lh_q_kindred', title: 'Kindred Lights', giver: 'board', kind: 'kindred', goal: 3, req: 'lh_q_first_light', desc: 'Revive allies 3 times, or (solo) fight inside a lit lamp post\'s glow: every 150 damage dealt in shared light counts.', reward: { charm: 'kindred' } },
  { id: 'lh_q_rekindle', title: 'Warm the Hollow', giver: 'moss', kind: 'hearth', goal: 3, req: 'lh_q_first_light', desc: 'Feed embers to the Great Hearth until it reaches tier 3.', reward: { embers: 300, tonics: 3 } },
  { id: 'lh_q_starstair', title: 'The Starstair', giver: 'wick', kind: 'light:throne', goal: 3, req: 'lh_q_foreman', area: 'throne', desc: 'Light all three Aurora Pillars on the Starstair.', reward: { embers: 400 } },
  { id: 'lh_q_hollow_queen', title: 'Return the Aurora', giver: 'wick', kind: 'boss:queen', goal: 1, req: 'lh_q_starstair', area: 'throne', desc: 'Defeat the Hollow Queen and return the aurora to the sky.', reward: { embers: 600, title: 'Lightbringer' } },
];

// One-time Birg Buck milestones (custom_game: <=50/call, 200/day). Total 120 per profile.
export const BB_MILESTONES = [
  { id: 'boss_mossmaw', bb: 15, what: 'Mother Mossmaw defeated' },
  { id: 'boss_foreman', bb: 25, what: 'Drowned Foreman defeated' },
  { id: 'boss_queen', bb: 50, what: 'Hollow Queen defeated' },
  { id: 'all_quests', bb: 30, what: 'all quests complete' },
];

export const NPC_NAMES = { wick: 'Elder Wick', board: 'Quest Board', ysolde: 'Lamplighter Ysolde', brann: 'Smith Brann', moss: 'Apothecary Moss' };
export const MAT_INFO = { embers: ['🔥', 'Embers'], glowcap: ['🍄', 'Glowcap'], rustcog: ['⚙️', 'Rustcog'], shard: ['💠', 'Aurora Shard'], sigil: ['🔱', 'Boss Sigil'] };
export const BUILT_AREAS = ['village', 'caves', 'mine', 'throne'];
export const TONIC = { price: 25, heal: 4, max: 3 };   // +1 max per Hearth tier 1
export const CARRY_LOSS = 0.3;                        // carried embers dropped as an Ember Wisp on a wipe
export const POST_BANK = 0.5;                         // lighting a lamp post banks this share of carried embers (75% at Hearth 2)
export const postBank = (save) => (save.hearth >= 2 ? 0.75 : POST_BANK);
export const charmSlots = (save) => (save.hearth >= 4 ? 3 : 2);
export const throneOpen = (save) => save.bosses.foreman > 0 && save.hearth >= 3;
export const OIL = { price: 30, refill: 60, max: 3 };   // Lantern Oil: auto-used when glow runs dry

// Hearth Rekindle perks (brief §5.3), shown in the Rekindle dialog.
export const HEARTH_PERKS = ['Tonic capacity +1', 'Lamp posts bank 75% of carried embers', 'Unlocks the Aurora Throne (with the Foreman defeated)', 'A 3rd charm slot', 'The aurora returns over the village, with fireworks'];

// Charms (brief §5.2): crafted at Brann's forge or found; equip 2 (3 at Hearth 4).
export const CHARMS = {
  magnet:     { name: 'Ember Magnet', icon: '🧲', desc: 'Embers and motes fly to you from twice as far.', cost: { embers: 120, glowcap: 6 } },
  swiftstep:  { name: 'Swiftstep', icon: '👟', desc: '+10% move speed.', from: 'Quest: Cogs for Brann' },
  steadywick: { name: 'Steady Wick', icon: '🕯️', desc: 'Glow does not drain while you stand still and flare.', cost: { embers: 300, glowcap: 8, rustcog: 4 } },
  thornlight: { name: 'Thornlight', icon: '🌵', desc: 'Reflect 20% of damage taken from shadow enemies.', from: 'Chest in the Wraith Tunnels' },
  kindred:    { name: 'Kindred Spark', icon: '✨', desc: 'Kindred Glow damage bonus +10% (25% total).', from: 'Quest: Kindred Lights' },
  secondwind: { name: 'Second Wind', icon: '🌬️', desc: 'Once per run, get back up at 2 hearts when you would go down.', cost: { embers: 400, shard: 6 } },
};

// Repeatable bounties (brief §6): 3 at a time from this pool, refreshed on each return to the village.
export const BOUNTY_POOL = [
  { k: 'kill:slime', goal: 12, embers: 50, t: 'Pop 12 Glimmer Slimes', area: 'caves' },
  { k: 'kill:spore', goal: 6, embers: 50, t: 'Burst 6 Spore Puffs', area: 'caves' },
  { k: 'kill:creeper', goal: 6, embers: 70, t: 'Uproot 6 Root Creepers', area: 'caves' },
  { k: 'kill:moth', goal: 6, embers: 70, t: 'Chase off 6 Gloom Moths', area: 'caves' },
  { k: 'kill:golem', goal: 10, embers: 120, t: 'Defeat 10 Rust Golems', area: 'mine' },
  { k: 'kill:bat', goal: 10, embers: 90, t: 'Swat 10 Lamp-Eater Bats', area: 'mine' },
  { k: 'kill:kobold', goal: 8, embers: 90, t: 'Rout 8 Frost Kobolds', area: 'mine' },
  { k: 'kill:wraith', goal: 6, embers: 110, t: 'Banish 6 Gloom Wraiths', area: 'mine' },
  { k: 'kill:sentinel', goal: 6, embers: 140, t: 'Topple 6 Aurora Sentinels', area: 'throne' },
  { k: 'kill:wisp', goal: 8, embers: 130, t: 'Shatter 8 Shard Wisps', area: 'throne' },
  { k: 'kill:knight', goal: 4, embers: 160, t: 'Defeat 4 Frost Knights', area: 'throne' },
  { k: 'kill:shade', goal: 6, embers: 150, t: 'Dispel 6 Gloom Shades', area: 'throne' },
];
export const GLOOM = { hp: 1.6, dmg: 1.3, embers: 1.5 };   // Gloom+ (after the Queen)

const int = (v, max = 1e9) => Math.max(0, Math.min(max, Math.floor(Number(v) || 0)));
const TRACKS = Object.keys(UPGRADES);
const MATS = ['glowcap', 'rustcog', 'shard', 'sigil'];
const isCharm = (c) => c in CHARMS;
export function newSave() { return normalizeSave(null); }
export function normalizeSave(s) {
  s = s && typeof s === 'object' ? s : {};
  const up = {}; for (const k of TRACKS) up[k] = int(s.up?.[k], 5);
  const mats = {}; for (const k of MATS) mats[k] = int(s.mats?.[k]);
  const quests = {};
  for (const q of QUESTS) { const r = s.quests?.[q.id]; if (r && typeof r === 'object') quests[q.id] = { a: r.a !== false, p: int(r.p, q.goal), done: !!r.done, turnedIn: !!r.turnedIn }; }
  const list = (a, ok = () => true) => (Array.isArray(a) ? [...new Set(a.filter(x => typeof x === 'string' && ok(x)))] : []);
  return {
    v: SAVE_VERSION, embers: int(s.embers), mats, up, hearth: int(s.hearth, HEARTH_TIERS.length),
    charms: list(s.charms, isCharm), equipped: list(s.equipped, isCharm).slice(0, 3), tonics: int(s.tonics, 5), oil: int(s.oil, 9),
    unlocked: list(s.unlocked).length ? list(s.unlocked) : ['village', 'caves'], posts: s.posts && typeof s.posts === 'object' ? { ...s.posts } : {},
    bosses: { mossmaw: int(s.bosses?.mossmaw), foreman: int(s.bosses?.foreman), queen: int(s.bosses?.queen) },
    quests, tracked: list(s.tracked, id => QUESTS.some(q => q.id === id)).slice(0, 3), bbClaimed: list(s.bbClaimed, id => BB_MILESTONES.some(m => m.id === id)),
    stats: { kills: int(s.stats?.kills), revives: int(s.stats?.revives), deaths: int(s.stats?.deaths), playMs: int(s.stats?.playMs) },
    title: typeof s.title === 'string' ? s.title.slice(0, 24) : '',
    chests: list(s.chests), veins: list(s.veins), kindredDmg: int(s.kindredDmg),
    crystals: int(s.crystals), gloomPlus: !!s.gloomPlus, ending: !!s.ending,
    bounties: Array.isArray(s.bounties) ? s.bounties.filter(b => b && BOUNTY_POOL[b.i]).slice(0, 3).map(b => ({ i: int(b.i, BOUNTY_POOL.length - 1), p: int(b.p, BOUNTY_POOL[b.i].goal), done: !!b.done, paid: !!b.paid })) : [],
    wisp: s.wisp && typeof s.wisp === 'object' && Number.isFinite(s.wisp.x) && Number.isFinite(s.wisp.z) ? { area: String(s.wisp.area || 'caves'), x: s.wisp.x, z: s.wisp.z, embers: int(s.wisp.embers) } : null,
  };
}
/** Merge two saves (guest->account, stale resync): never lose progress. */
export function mergeSaves(a, b) {
  a = normalizeSave(a); b = normalizeSave(b);
  const m = normalizeSave(a);
  m.embers = Math.max(a.embers, b.embers); m.hearth = Math.max(a.hearth, b.hearth); m.tonics = Math.max(a.tonics, b.tonics); m.oil = Math.max(a.oil, b.oil);
  for (const k of TRACKS) m.up[k] = Math.max(a.up[k], b.up[k]);
  for (const k of MATS) m.mats[k] = Math.max(a.mats[k], b.mats[k]);
  for (const k of Object.keys(m.bosses)) m.bosses[k] = Math.max(a.bosses[k], b.bosses[k]);
  for (const k of Object.keys(m.stats)) m.stats[k] = Math.max(a.stats[k], b.stats[k]);
  m.charms = [...new Set([...a.charms, ...b.charms])]; m.unlocked = [...new Set([...a.unlocked, ...b.unlocked])]; m.bbClaimed = [...new Set([...a.bbClaimed, ...b.bbClaimed])];
  for (const q of QUESTS) { const x = a.quests[q.id], y = b.quests[q.id]; if (x || y) m.quests[q.id] = { a: !!(x?.a || y?.a), p: Math.max(x?.p || 0, y?.p || 0), done: !!(x?.done || y?.done), turnedIn: !!(x?.turnedIn || y?.turnedIn) }; }
  m.posts = { ...b.posts, ...a.posts }; m.title = a.title || b.title;
  m.chests = [...new Set([...a.chests, ...b.chests])]; m.veins = [...new Set([...a.veins, ...b.veins])]; m.kindredDmg = Math.max(a.kindredDmg, b.kindredDmg); m.wisp = a.wisp || b.wisp;
  m.equipped = (a.equipped.length ? a.equipped : b.equipped).filter(c => m.charms.includes(c)); m.crystals = Math.max(a.crystals, b.crystals); m.ending = a.ending || b.ending; m.gloomPlus = a.gloomPlus || b.gloomPlus;
  m.bounties = a.bounties.length ? a.bounties : b.bounties;
  return m;
}
export const canAfford = (save, cost) => Object.entries(cost).every(([k, v]) => (k === 'embers' ? save.embers : save.mats[k] || 0) >= v);
export function pay(save, cost) { for (const [k, v] of Object.entries(cost)) { if (k === 'embers') save.embers -= v; else save.mats[k] -= v; } }
export function grant(save, r) {
  for (const [k, v] of Object.entries(r)) {
    if (k === 'embers') save.embers += v; else if (k in save.mats) save.mats[k] += v;
    else if (k === 'tonics') save.tonics = Math.min(5, save.tonics + v); else if (k === 'oil') save.oil = Math.min(9, save.oil + v);
    else if (k === 'charm' && !save.charms.includes(v)) save.charms.push(v); else if (k === 'title') save.title = v;
  }
}
/** Quest state for the board: 'locked' | 'available' | 'active' | 'ready' | 'done' (+ reason). */
export function questStatus(save, q) {
  const r = save.quests[q.id];
  if (r?.turnedIn) return { st: 'done' };
  if (r?.a) return { st: r.done ? 'ready' : 'active' };
  if (q.req && !save.quests[q.req]?.turnedIn) return { st: 'locked', why: `After “${QUESTS.find(x => x.id === q.req).title}”` };
  if (q.area && !BUILT_AREAS.includes(q.area)) return { st: 'locked', why: 'Opens in a later update' };
  if (q.area === 'throne' && !throneOpen(save)) return { st: 'locked', why: 'Needs Hearth tier 3' };
  if (q.area && !save.unlocked.includes(q.area)) return { st: 'locked', why: 'Area still sealed' };
  return { st: 'available' };
}
export const tonicMax = (save) => TONIC.max + (save.hearth >= 1 ? 1 : 0);
/** Effective stats from upgrade levels + equipped charms. */
export function statsFor(save) {
  const u = save.up, eq = (c) => save.equipped.includes(c) && save.charms.includes(c);
  return { ...UPGRADES.blade.stat(u.blade), ...UPGRADES.lantern.stat(u.lantern), ...UPGRADES.hearts.stat(u.hearts), ...UPGRADES.dash.stat(u.dash),
    power: 1 + u.blade + u.lantern + u.hearts + u.dash,
    flareCost: u.lantern >= 5 ? 0.7 : 1, spinWave: u.blade >= 5, magnet: eq('magnet') ? 7 : 3.5, speed: eq('swiftstep') ? 1.1 : 1, steady: eq('steadywick'),
    thorn: eq('thornlight'), kindredMul: eq('kindred') ? 1.25 : 1.15, secondWind: eq('secondwind') };
}
/** Bounty helpers: roll 3 distinct bounties from areas the player has unlocked. */
export function rollBounties(save, rand = Math.random) {
  const pool = BOUNTY_POOL.map((b, i) => ({ ...b, i })).filter(b => save.unlocked.includes(b.area)), out = [];
  while (out.length < 3 && pool.length) out.push(pool.splice(Math.floor(rand() * pool.length), 1)[0].i);
  return out.map(i => ({ i, p: 0, done: false, paid: false }));
}
