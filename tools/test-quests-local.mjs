// Guest/offline quests (LocalBackend + Economy + quests facade) in node with a localStorage shim.
import assert from 'node:assert/strict';
const mem = new Map();
globalThis.localStorage = { getItem: k => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, String(v)), removeItem: k => mem.delete(k) };
const { registerQuests } = await import('../src/core/questDefs.js');
const { QUESTS, ND_GAME_ID } = await import('./db/fixtures/event-fixture.mjs');
registerQuests(QUESTS);
const { LocalBackend } = await import('../src/backend/LocalBackend.js');
const { Economy } = await import('../src/core/economy.js');
const { createQuests } = await import('../src/core/quests.js');
const eco = new Economy(new LocalBackend()); const q = createQuests(eco);
let st = await q.status(ND_GAME_ID);
assert.deepEqual(st, [{ id: 'nd_quest_disaster_survival', gameId: ND_GAME_ID, title: 'Survive 5 disasters', goal: 5, progress: 0, completed: false, claimed: false, itemId: 'tornado_hat' }]);
assert.equal((await q.status()).length, 4);
assert.deepEqual(await q.complete('nd_quest_disaster_survival'), { granted: false, itemId: 'tornado_hat', alreadyClaimed: false, reason: 'not_complete' });
assert.equal((await q.progress('nd_quest_disaster_survival', 2)).reason, 'invalid_delta');
assert.equal((await q.progress('nd_quest_disaster_survival')).added, 1);
assert.equal((await q.progress('nd_quest_disaster_survival')).reason, 'too_fast');
const b = eco.backend; let now = Date.now();
for (let i = 0; i < 6; i++) { now += 2500; b.questProgress('nd_quest_disaster_survival', 1, now); }
st = await q.status(ND_GAME_ID);
assert.equal(st[0].progress, 5); assert.equal(st[0].completed, true);
const c = await q.complete('nd_quest_disaster_survival');
assert.deepEqual(c, { granted: true, itemId: 'tornado_hat', alreadyClaimed: false });
assert.ok(eco.owns('tornado_hat')); assert.equal(eco.coins, 0);
assert.deepEqual(await q.complete('nd_quest_disaster_survival'), { granted: false, itemId: 'tornado_hat', alreadyClaimed: true });
assert.equal((await eco.questProgress('nope')).reason, 'unknown_quest');
// economy.* names behave the same as the facade
assert.equal((await eco.getQuests('birg-hq'))[0].id, 'nd_quest_birg_hq');
assert.equal((await eco.claimQuestReward('nd_quest_birg_hq')).reason, 'not_complete');
// grant-only cosmetics can't be bought (when Cosmetics flags them eventOnly)
const { isGrantOnly } = await import('../src/core/economy.js');
assert.equal(isGrantOnly({ eventOnly: true }), true); assert.equal(isGrantOnly({ unlock: 'quest' }), true); assert.equal(isGrantOnly({ price: 50 }), false);
// consumables offline: local spend only
eco.profile.coins = 30;
assert.deepEqual(await eco.buyConsumable(ND_GAME_ID, 'apple', 10), { ok: true, coins: 20, local: true });
assert.equal((await eco.buyConsumable(ND_GAME_ID, 'biggerStorm', 25)).ok, false);
console.log('quests (local/offline): all checks passed');
