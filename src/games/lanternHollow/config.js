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
export const QUESTS = [
  { id: 'lh_q_first_light', title: 'First Light', giver: 'wick', kind: 'light:caves', goal: 1, reward: { embers: 40 } },
  { id: 'lh_q_slime_time', title: 'Slime Time', giver: 'board', kind: 'kill:slime', goal: 15, reward: { embers: 80, glowcap: 3 } },
  { id: 'lh_q_spore_sweep', title: 'Spore Sweep', giver: 'board', kind: 'kill:spore', goal: 8, reward: { embers: 90 } },
  { id: 'lh_q_mossmaw', title: 'The Mother Root', giver: 'wick', kind: 'boss:mossmaw', goal: 1, reward: { embers: 200, sigil: 1 } },
  { id: 'lh_q_hidden_veins', title: 'Hidden Veins', giver: 'ysolde', kind: 'reveal:vein', goal: 5, reward: { embers: 150, oil: 2 } },
  { id: 'lh_q_cogs', title: 'Cogs for Brann', giver: 'brann', kind: 'collect:rustcog', goal: 20, reward: { charm: 'swiftstep' } },
  { id: 'lh_q_drain', title: 'Drain the Gallery', giver: 'wick', kind: 'lever:mine', goal: 3, reward: { embers: 180 } },
  { id: 'lh_q_foreman', title: 'The Drowned Foreman', giver: 'wick', kind: 'boss:foreman', goal: 1, reward: { embers: 350, sigil: 1 } },
  { id: 'lh_q_kindred', title: 'Kindred Lights', giver: 'board', kind: 'kindred', goal: 3, reward: { charm: 'kindred' } },
  { id: 'lh_q_rekindle', title: 'Warm the Hollow', giver: 'moss', kind: 'hearth', goal: 3, reward: { embers: 300, tonics: 3 } },
  { id: 'lh_q_starstair', title: 'The Starstair', giver: 'wick', kind: 'light:throne', goal: 3, reward: { embers: 400 } },
  { id: 'lh_q_hollow_queen', title: 'Return the Aurora', giver: 'wick', kind: 'boss:queen', goal: 1, reward: { embers: 600, title: 'Lightbringer' } },
];

// One-time Birg Buck milestones (custom_game: <=50/call, 200/day). Total 120 per profile.
export const BB_MILESTONES = [
  { id: 'boss_mossmaw', bb: 15, what: 'Mother Mossmaw defeated' },
  { id: 'boss_foreman', bb: 25, what: 'Drowned Foreman defeated' },
  { id: 'boss_queen', bb: 50, what: 'Hollow Queen defeated' },
  { id: 'all_quests', bb: 30, what: 'all quests complete' },
];

const int = (v, max = 1e9) => Math.max(0, Math.min(max, Math.floor(Number(v) || 0)));
const TRACKS = Object.keys(UPGRADES);
const MATS = ['glowcap', 'rustcog', 'shard', 'sigil'];
export function newSave() { return normalizeSave(null); }
export function normalizeSave(s) {
  s = s && typeof s === 'object' ? s : {};
  const up = {}; for (const k of TRACKS) up[k] = int(s.up?.[k], 5);
  const mats = {}; for (const k of MATS) mats[k] = int(s.mats?.[k]);
  const quests = {};
  for (const q of QUESTS) { const r = s.quests?.[q.id]; if (r && typeof r === 'object') quests[q.id] = { p: int(r.p, q.goal), done: !!r.done, turnedIn: !!r.turnedIn }; }
  const list = (a, ok = () => true) => (Array.isArray(a) ? [...new Set(a.filter(x => typeof x === 'string' && ok(x)))] : []);
  return {
    v: SAVE_VERSION, embers: int(s.embers), mats, up, hearth: int(s.hearth, HEARTH_TIERS.length),
    charms: list(s.charms), equipped: list(s.equipped).slice(0, 3), tonics: int(s.tonics, 5), oil: int(s.oil, 9),
    unlocked: list(s.unlocked).length ? list(s.unlocked) : ['village', 'caves'], posts: s.posts && typeof s.posts === 'object' ? { ...s.posts } : {},
    bosses: { mossmaw: int(s.bosses?.mossmaw), foreman: int(s.bosses?.foreman), queen: int(s.bosses?.queen) },
    quests, tracked: list(s.tracked, id => QUESTS.some(q => q.id === id)).slice(0, 3), bbClaimed: list(s.bbClaimed, id => BB_MILESTONES.some(m => m.id === id)),
    stats: { kills: int(s.stats?.kills), revives: int(s.stats?.revives), deaths: int(s.stats?.deaths), playMs: int(s.stats?.playMs) },
    title: typeof s.title === 'string' ? s.title.slice(0, 24) : '',
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
  for (const q of QUESTS) { const x = a.quests[q.id], y = b.quests[q.id]; if (x || y) m.quests[q.id] = { p: Math.max(x?.p || 0, y?.p || 0), done: !!(x?.done || y?.done), turnedIn: !!(x?.turnedIn || y?.turnedIn) }; }
  m.posts = { ...b.posts, ...a.posts }; m.title = a.title || b.title;
  return m;
}
/** Effective stats from upgrade levels. */
export function statsFor(save) {
  const u = save.up;
  return { ...UPGRADES.blade.stat(u.blade), ...UPGRADES.lantern.stat(u.lantern), ...UPGRADES.hearts.stat(u.hearts), ...UPGRADES.dash.stat(u.dash),
    power: 1 + u.blade + u.lantern + u.hearts + u.dash };
}
