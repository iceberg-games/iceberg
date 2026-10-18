// Natural Disasters event: the ONE file that talks to the server quest API.
//
// Real API (owned by Iceberg Publisher, src/core/quests.js / window.iceberg.quests):
//   quests.progress(questId, delta = 1)  -> {progress, goal, completed}   (rate-limited server-side)
//   await quests.complete(questId)       -> {granted, itemId, alreadyClaimed} | {granted:false, reason:'not_complete'}
//   quests.status(gameId?)               -> [{id, gameId, title, goal, progress, completed, claimed, itemId}]
// The SERVER grants the cosmetic, once per account. This client never grants or equips an item itself:
// it only reports progress and asks the server to complete the quest.
//
// Until src/core/quests.js lands on main, the API is resolved at runtime from window.iceberg.quests
// (falling back to the older economy.questProgress / claimQuestReward names). If neither exists the
// STUB below is used. It records calls, keeps local progress for the HUD, and grants nothing.
const LS = 'iceberg:v1:ndquest:';

function realApi() {
  const ic = (typeof window !== 'undefined' && window.iceberg) || {};
  if (ic.quests && typeof ic.quests.progress === 'function') return ic.quests;
  const e = ic.economy;
  if (e && typeof e.questProgress === 'function' && typeof e.claimQuestReward === 'function') {
    return { progress: (id, d) => e.questProgress(id, d), complete: (id) => e.claimQuestReward(id), status: (g) => e.questStatus?.(g) || [] };
  }
  return null;
}

// ---------------- STUB (no server API yet). Never grants anything. ----------------
export const STUB = {
  isStub: true,
  calls: { progress: [], complete: [] },
  progress(id, delta = 1) { this.calls.progress.push([id, delta]); return { progress: null, goal: null, completed: false, stub: true }; },
  async complete(id) { this.calls.complete.push(id); return { granted: false, itemId: null, alreadyClaimed: false, reason: 'server_api_pending' }; },
  status() { return []; },
};
if (typeof window !== 'undefined') window.__icebergQuestStub = STUB;
// -----------------------------------------------------------------------------------

export function questApi() { return realApi() || STUB; }

const load = (id) => { try { return JSON.parse(localStorage.getItem(LS + id)) || {}; } catch { return {}; } };
const store = (id, s) => { try { localStorage.setItem(LS + id, JSON.stringify(s)); } catch { /* private mode */ } };

/**
 * Track one quest. add() is called only on real gameplay events. Deltas are batched (at most one
 * progress call per flushMs) and complete() is called exactly once per session, when the goal is reached.
 * onChange(state) fires for the HUD: {progress, goal, done, claimed, pending, itemId}.
 */
export function createQuestTracker(quest, { onChange = () => {}, onResult = () => {}, flushMs = 3000 } = {}) {
  const saved = load(quest.id);
  const st = { progress: Math.min(quest.goal, saved.progress || 0), goal: quest.goal, claimed: !!saved.claimed, pending: false, itemId: quest.reward, done: false };
  st.done = st.progress >= st.goal;
  let queued = 0, timer = null, completing = false, disposed = false;
  const emit = () => { if (!disposed) onChange({ ...st }); };
  const persist = () => store(quest.id, { progress: st.progress, claimed: st.claimed });

  // adopt server state when available
  Promise.resolve().then(() => questApi().status?.(quest.gameId)).then((list) => {
    const s = Array.isArray(list) && list.find(q => q.id === quest.id);
    if (!s || disposed) return;
    st.progress = Math.max(st.progress, Math.min(st.goal, s.progress || 0));
    st.claimed = !!s.claimed; st.done = st.progress >= st.goal || !!s.completed;
    persist(); emit();
    if (st.done && !st.claimed) tryComplete();
  }).catch(() => {});

  async function tryComplete() {
    if (completing || st.claimed) return;
    completing = true; st.pending = true; emit();
    let res;
    try { res = await questApi().complete(quest.id); } catch (e) { res = { granted: false, reason: 'network' }; }
    st.pending = false;
    if (res?.granted || res?.alreadyClaimed) { st.claimed = true; st.itemId = res.itemId || quest.reward; persist(); }
    else if (res?.reason === 'not_complete') completing = false; // server disagrees; allow one more try after more progress
    emit(); onResult(res || {});
  }
  function flush() {
    clearTimeout(timer); timer = null;
    if (!queued) return;
    const d = queued; queued = 0;
    try {
      Promise.resolve(questApi().progress(quest.id, d)).then((r) => {
        if (r && r.progress != null) { st.progress = Math.max(st.progress, Math.min(st.goal, r.progress)); if (r.completed) st.done = true; persist(); emit(); }
        if (st.done && !st.claimed) tryComplete();
      }).catch(() => {});
    } catch { if (st.done && !st.claimed) tryComplete(); }
  }
  emit();
  return {
    quest,
    get state() { return { ...st }; },
    add(delta = 1) {
      if (st.claimed || st.done && completing) return;
      if (st.progress >= st.goal) { flush(); return; }
      const d = Math.min(delta, st.goal - st.progress);
      st.progress += d; queued += d; st.done = st.progress >= st.goal; persist(); emit();
      if (st.done) flush(); else if (!timer) timer = setTimeout(flush, flushMs);
    },
    flush,
    dispose() { flush(); disposed = true; },
  };
}
