// Natural Disasters event: the ONE file that talks to the server quest API.
//
// Real API (owned by Iceberg Publisher, src/core/quests.js / window.iceberg.quests):
//   quests.progress(questId, delta = 1)  -> {progress, goal, completed}   (rate-limited server-side)
//   await quests.complete(questId)       -> {granted, itemId, alreadyClaimed} | {granted:false, reason:'not_complete'}
//   quests.status(gameId?)               -> [{id, gameId, title, goal, progress, completed, claimed, itemId}]
// The SERVER grants the cosmetic, once per account. This client never grants or equips an item itself:
// it only reports progress and asks the server to complete the quest.
//
// Wired to the Publisher's real API (src/core/quests.js, bound by main.js). If it isn't bound (e.g. a
// standalone test page) every call fails soft and only local HUD progress is kept: nothing is granted.
import { quests as coreQuests } from '../../core/quests.js';

export function questApi() {
  const w = typeof window !== 'undefined' && window.iceberg?.quests;
  return w && typeof w.progress === 'function' ? w : coreQuests;
}
const unwrap = (r) => (r && r.quest ? { ...r, progress: r.quest.progress, goal: r.quest.goal, completed: r.quest.completed } : r);

const load = (id) => { try { return JSON.parse(localStorage.getItem(LS + id)) || {}; } catch { return {}; } };
const store = (id, s) => { try { localStorage.setItem(LS + id, JSON.stringify(s)); } catch { /* private mode */ } };

/**
 * Track one quest. add() is called only on real gameplay events. Deltas are batched (at most one
 * progress call per flushMs) and complete() is called exactly once per session, when the goal is reached.
 * onChange(state) fires for the HUD: {progress, goal, done, claimed, pending, itemId}.
 */
export function createQuestTracker(quest, { onChange = () => {}, onResult = () => {}, flushMs } = {}) {
  const maxPerCall = quest.maxPerCall ?? 1;
  flushMs = flushMs ?? Math.max(3000, (quest.minIntervalMs ?? 2000) + 250); // never faster than the server allows
  const saved = load(quest.id);
  const st = { progress: Math.min(quest.goal, saved.progress || 0), goal: quest.goal, claimed: !!saved.claimed, pending: false, itemId: quest.rewardItemId, done: false };
  st.done = st.progress >= st.goal;
  // Pending = local progress the server hasn't confirmed yet. One request in flight at a time, spaced by flushMs;
  // too_fast/network -> retry later (never spam). Survives leaving the game because progress is persisted locally.
  let srv = Math.min(quest.goal, saved.srv || 0), timer = null, inflight = false, completing = false, disposed = false;
  const pending = () => Math.max(0, st.progress - srv);
  const emit = () => { if (!disposed) onChange({ ...st }); };
  const persist = () => store(quest.id, { progress: st.progress, claimed: st.claimed, srv });
  const schedule = (ms) => { if (!timer && !disposed) timer = setTimeout(flush, ms); };

  // adopt server state when available
  Promise.resolve().then(() => questApi().status?.(quest.gameId)).then((list) => {
    const s = Array.isArray(list) && list.find(q => q.id === quest.id);
    if (!s || disposed) return;
    srv = Math.min(st.goal, s.progress || 0);
    st.progress = Math.max(st.progress, srv);
    st.claimed = !!s.claimed; st.done = st.progress >= st.goal || !!s.completed;
    persist(); emit();
    if (pending() && !st.claimed) schedule(500); else if (s.completed && !st.claimed) tryComplete();
  }).catch(() => {});

  async function tryComplete() {
    if (completing || st.claimed) return;
    completing = true; st.pending = true; emit();
    let res;
    try { res = await questApi().complete(quest.id); } catch (e) { res = { granted: false, reason: 'network' }; }
    st.pending = false;
    if (res?.granted || res?.alreadyClaimed) { st.claimed = true; st.itemId = res.itemId || quest.rewardItemId; persist(); }
    else completing = false; // not_complete / network / event_ended: may retry after more progress
    emit(); onResult(res || {});
  }
  function flush() {
    clearTimeout(timer); timer = null;
    if (inflight || st.claimed) return;
    const need = pending();
    if (!need) { if (st.done && !st.claimed && srv >= st.goal) tryComplete(); return; }
    const d = Math.min(need, maxPerCall); inflight = true;
    Promise.resolve().then(() => questApi().progress(quest.id, d)).then((raw) => {
      inflight = false;
      const r = unwrap(raw);
      if (r && r.ok === false) {
        if (r.reason === 'too_fast' || r.reason === 'network') schedule(Math.max(flushMs, r.retryAfterMs || 0));
        return; // event_ended / not_live / caps: stop quietly
      }
      if (r && r.progress != null) { srv = Math.min(st.goal, r.progress); st.progress = Math.max(st.progress, srv); if (r.completed) st.done = true; }
      else srv = Math.min(st.goal, srv + d);
      persist(); emit();
      if (pending()) schedule(flushMs); else if (srv >= st.goal && !st.claimed) tryComplete();
    }).catch(() => { inflight = false; schedule(flushMs); });
  }
  emit();
  return {
    quest,
    get state() { return { ...st }; },
    add(delta = 1) {
      if (st.claimed || st.progress >= st.goal) return;
      st.progress += Math.min(delta, st.goal - st.progress); st.done = st.progress >= st.goal; persist(); emit();
      schedule(st.done ? 0 : flushMs);
    },
    flush,
    dispose() { if (!inflight) flush(); disposed = true; clearTimeout(timer); },
  };
}
