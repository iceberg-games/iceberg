// Quests facade for games (window.iceberg.quests). Thin, stable names over core/economy.js:
//   quests.progress(questId, delta = 1)  -> Promise<{ ok, added?, reason?, retryAfterMs?, quest? }>   (= economy.questProgress)
//   quests.complete(questId)             -> Promise<{ granted, itemId, alreadyClaimed, reason? }>       (claim_quest_reward)
//        reason 'not_complete' when the goal isn't reached yet. The SERVER owns questId -> itemId and
//        the once-per-account check; calling it again is safe ({ granted:false, alreadyClaimed:true }).
//   quests.status(gameId?)               -> Promise<[{ id, gameId, title, goal, progress, completed, claimed, itemId }]>
// Guests/offline use LocalBackend's local-only copy (rewards stay on the device and are not imported
// into an account at sign-up). Events: bus 'quest:progress' and 'quest:reward'.
import { bus } from './events.js';

export function createQuests(economy) {
  return {
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
        completed: !!q.completed, claimed: !!q.claimed, itemId: q.itemId }));
    },
  };
}

let _default = null;
/** Shared instance bound to the app's economy (set by main.js / portal). */
export const quests = {
  progress: (...a) => need().progress(...a),
  complete: (...a) => need().complete(...a),
  status: (...a) => need().status(...a),
};
export function bindQuests(economy) { _default = createQuests(economy); return quests; }
function need() { if (!_default) throw new Error('quests: not bound yet (bindQuests(economy))'); return _default; }
