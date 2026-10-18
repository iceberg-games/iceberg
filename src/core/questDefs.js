// Quest definitions bundled with the client (the same files scripts/sync-catalog.mjs pushes to
// public.quest_defs). Used ONLY for guests / offline (LocalBackend); signed-in players get the
// server's copy from get_quests. File format: see docs/ECONOMY_API.md#quests.
//   src/games/<dir>/quests.js   export const QUESTS = [...]  (gameId defaults to <dir>/config.js GAME_ID)
//   src/games/<name>.quests.js  export const QUESTS = [...]; export const GAME_ID = '...'
let files = {}, configs = {};
try {
  files = import.meta.glob(['../games/*/quests.js', '../games/*.quests.js'], { eager: true });
  configs = import.meta.glob('../games/*/config.js', { eager: true, import: 'GAME_ID' });
} catch { /* not bundled by Vite (node tests): no bundled quests */ }

const extra = [];
function normalize(q, fileGameId) {
  return {
    id: q.id, gameId: q.gameId || fileGameId || null, title: q.title || q.id, goal: Math.max(1, q.goal | 0 || 1),
    itemId: q.rewardItemId || q.itemId || null, eventId: q.eventId || null,
    startsAt: q.startsAt || null, endsAt: q.endsAt || null,
    maxPerCall: q.maxPerCall ?? 1, minIntervalMs: q.minIntervalMs ?? 2000, maxPerHour: q.maxPerHour ?? 60,
  };
}
export function questDefs() {
  const out = [];
  for (const [path, mod] of Object.entries(files)) {
    const dir = path.match(/\.\.\/games\/([^/]+)\/quests\.js$/)?.[1];
    const fileGame = mod.GAME_ID || (dir ? configs[`../games/${dir}/config.js`] : null);
    for (const q of mod.QUESTS || []) out.push(normalize(q, fileGame));
  }
  for (const q of extra) if (!out.some(o => o.id === q.id)) out.push(q);
  return out;
}
/** Register quests at runtime (tests, or a game that ships quests outside the standard files). */
export function registerQuests(list, gameId = null) { for (const q of list || []) extra.push(normalize(q, gameId)); }
export const questLive = (q, now = Date.now()) =>
  (!q.startsAt || Date.parse(q.startsAt) <= now) && (!q.endsAt || Date.parse(q.endsAt) > now);
