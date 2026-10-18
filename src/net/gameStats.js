// Game list ordering for the portal tabs + play-session reporting.
//   Newest:              publishedAt (server games table, else src/data/gameMeta.js)
//   Most Popular:        deduped plays in the last 7 days (server daily buckets), else this device's last 7 days
//   Most Active Players: players with a heartbeat in the last 90 s (server only)
import { GAME_META } from '../data/gameMeta.js';

const PLAYS_KEY = 'iceberg:v1:playCounts';
const HEARTBEAT_MS = 30000;

// local plays: { gameId: { 'YYYY-MM-DD': n } } (UTC days, like the server buckets)
const day = (d = new Date()) => d.toISOString().slice(0, 10);
function readPlays() { try { const v = JSON.parse(localStorage.getItem(PLAYS_KEY) || '{}'); return v && typeof v === 'object' ? v : {}; } catch { return {}; } }
export function recordLocalPlay(gameId) {
  const c = readPlays(); const g = (c[gameId] && typeof c[gameId] === 'object') ? c[gameId] : {};
  g[day()] = (g[day()] || 0) + 1; c[gameId] = g;
  try { localStorage.setItem(PLAYS_KEY, JSON.stringify(c)); } catch { /* private mode */ }
}
/** { gameId: { last7, all } } from this device. */
export function localPlayCounts(now = new Date()) {
  const cutoff = day(new Date(now.getTime() - 6 * 86400000));   // today + previous 6 days
  const out = {};
  for (const [id, days] of Object.entries(readPlays())) {
    if (!days || typeof days !== 'object') continue;
    let last7 = 0, all = 0;
    for (const [d, n] of Object.entries(days)) { all += n; if (d >= cutoff) last7 += n; }
    out[id] = { last7, all };
  }
  return out;
}

/** Merge games with stats. Returns { games: [{def, publishedAt, visits, playing}], online }. */
export async function loadGameStats(defs, remote) {
  let server = null;
  if (remote) { try { server = Object.fromEntries((await remote.listGameStats()).map(s => [s.gameId, s])); } catch { server = null; } }
  const local = localPlayCounts();
  const games = defs.map((def, i) => {
    const s = server?.[def.id];
    return { def, order: i,
      publishedAt: s?.publishedAt || GAME_META[def.id]?.publishedAt || null,
      visits: server ? (s?.visits7d ?? 0) : (local[def.id]?.last7 || 0),
      visitsAll: server ? (s?.visitsAll ?? 0) : (local[def.id]?.all || 0),
      playing: server ? (s?.playing ?? 0) : null };
  });
  return { games, online: !!server };
}

export const SORTS = {
  newest: (a, b) => (Date.parse(b.publishedAt) || 0) - (Date.parse(a.publishedAt) || 0) || a.order - b.order,
  popular: (a, b) => b.visits - a.visits || b.visitsAll - a.visitsAll || SORTS.newest(a, b),   // 7 days, then all-time, then newest
  active: (a, b) => (b.playing ?? -1) - (a.playing ?? -1) || SORTS.popular(a, b),
};

/** While a game is open: count one visit (server dedupes) and send heartbeats every 30 s. */
export function startPlaySession(remote, gameId) {
  recordLocalPlay(gameId);
  if (!remote?.signedIn) return { stop() {} };
  let alive = true;
  remote.recordVisit(gameId).catch(() => {});
  const beat = () => { if (alive && document.visibilityState !== 'hidden') remote.gameHeartbeat(gameId).catch(() => {}); };
  beat();
  const t = setInterval(beat, HEARTBEAT_MS);
  const onHide = () => { if (document.visibilityState === 'hidden') remote.gameLeave().catch(() => {}); else beat(); };
  document.addEventListener('visibilitychange', onHide);
  const onUnload = () => { try { remote.gameLeave(); } catch { /* ignore */ } };
  addEventListener('pagehide', onUnload);
  return { stop() { alive = false; clearInterval(t); document.removeEventListener('visibilitychange', onHide); removeEventListener('pagehide', onUnload); remote.gameLeave().catch(() => {}); } };
}
