// Quests facade for games (window.iceberg.quests). Thin, stable names over core/economy.js:
//   quests.progress(questId, delta = 1)  -> Promise<{ ok, added?, reason?, retryAfterMs?, quest? }>   (= economy.questProgress)
//   quests.complete(questId)             -> Promise<{ granted, itemId, alreadyClaimed, reason? }>       (claim_quest_reward)
//        reason 'not_complete' when the goal isn't reached yet. The SERVER owns questId -> itemId and
//        the once-per-account check; calling it again is safe ({ granted:false, alreadyClaimed:true }).
//   quests.status(gameId?)               -> Promise<[{ id, gameId, title, goal, progress, completed, claimed, itemId,
//                                                     eventId, startsAt, endsAt, live }]>   (effective window: quest narrowed by its event)
//   quests.eventStatus(eventId, { refresh }) -> Promise<{ eventId, title, startsAt, endsAt, claimUntil, active, serverNow, msLeft, msToStart }>
//        Server time is the truth: serverNow is advanced locally since the fetch, msLeft = endsAt - serverNow.
//        Cached 60 s per event; emits bus 'event:changed' when a fetch changes active/startsAt/endsAt.
// Guests/offline use LocalBackend's local-only copy (rewards stay on the device and are not imported
// into an account at sign-up). Events: bus 'quest:progress' and 'quest:reward'.
import { bus } from './events.js';

const EVENT_TTL_MS = 60e3;

export function createQuests(economy, { now = () => Date.now() } = {}) {
  const cache = new Map();   // eventId -> { status, at (local ms when fetched) }
  const view = ({ status, at }) => {
    const sn = Date.parse(status.serverNow) + (now() - at);              // server clock, advanced locally
    const ends = status.endsAt ? Date.parse(status.endsAt) : null, starts = status.startsAt ? Date.parse(status.startsAt) : null;
    const active = !!status.active && (ends == null || sn < ends) && (starts == null || sn >= starts);
    return { ...status, active, serverNow: new Date(sn).toISOString(), msLeft: ends == null ? null : Math.max(0, ends - sn),
      msToStart: starts == null ? null : Math.max(0, starts - sn) };
  };
  return {
    async eventStatus(eventId, { refresh = false } = {}) {
      const c = cache.get(eventId);
      if (c && !refresh && now() - c.at < EVENT_TTL_MS) return view(c);
      const status = await economy.eventStatus(eventId);
      if (status?.error) return c ? view(c) : view({ status, at: now() });      // network: keep the last good value
      const next = { status, at: now() };
      cache.set(eventId, next);
      const key = (x) => x && `${x.active}|${x.startsAt}|${x.endsAt}`;
      if (c && key(c.status) !== key(status)) bus.emit('event:changed', view(next));
      return view(next);
    },
    async progress(questId, delta = 1) {
      const r = await economy.questProgress(questId, delta);
      if (r?.ok && r.added) bus.emit('quest:progress', r.quest);
      return r;
    },
    async complete(questId) {
      const r = await economy.claimQuestReward(questId);
      return { granted: !!r.granted, itemId: r.itemId ?? null, alreadyClaimed: !!r.alreadyClaimed, ...(r.reason ? { reason: r.reason } : {}) };
    },
    async status(gameId) {
      const list = await economy.getQuests(gameId ?? null);
      return (list || []).map(q => ({ id: q.id, gameId: q.gameId, title: q.title, goal: q.goal, progress: q.progress,
        completed: !!q.completed, claimed: !!q.claimed, itemId: q.itemId,
        eventId: q.eventId ?? null, startsAt: q.startsAt ?? null, endsAt: q.endsAt ?? null, live: !!q.live }));
    },
  };
}

let _default = null;
/** Shared instance bound to the app's economy (set by main.js / portal). */
export const quests = {
  progress: (...a) => need().progress(...a),
  complete: (...a) => need().complete(...a),
  status: (...a) => need().status(...a),
  eventStatus: (...a) => need().eventStatus(...a),
};
export function bindQuests(economy) { _default = createQuests(economy); return quests; }
function need() { if (!_default) throw new Error('quests: not bound yet (bindQuests(economy))'); return _default; }
