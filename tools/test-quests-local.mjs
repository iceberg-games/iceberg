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
assert.deepEqual(st, [{ id: 'nd_quest_disaster_survival', gameId: ND_GAME_ID, title: 'Survive 5 disasters', goal: 5, progress: 0, completed: false, claimed: false, itemId: 'tornado_hat',
  eventId: 'natural_disasters', startsAt: '2026-10-01T00:00:00.000Z', endsAt: '2099-01-01T00:00:00.000Z', live: true }]);
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
// Game Maker format: per-minute cap
{ let n = 0, r, t = Date.now(); for (let i = 0; i < 12; i++) { r = b.questProgress('nd_quest_birg_hq', 1, t + i); if (r.ok) n += r.added; }
  assert.equal(n, 10); assert.equal(r.reason, 'too_fast');
  assert.equal(b.questProgress('nd_quest_birg_hq', 1, t + 61000).added, 1); }
// ---- events offline: default 7-day window from first run, before/during/after/grace ----
registerQuests([{ id: 'zz_local_hunt', gameId: 'frost-fields', title: 'Local hunt', goal: 1, rewardItemId: 'blizzard_hat', eventId: 'zz_local', minIntervalMs: 0 }]);
const t0 = Date.now();
const ev = b.eventStatus('zz_local', t0);
assert.equal(ev.active, true); assert.equal(Date.parse(ev.endsAt) - Date.parse(ev.startsAt), 7 * 86400e3); assert.equal(ev.local, true);
assert.equal(Date.parse(b.eventStatus('zz_local', t0 + 5000).startsAt), Date.parse(ev.startsAt));         // stable: first run is remembered
assert.equal(b.questProgress('zz_local_hunt', 1, t0 - 1000).reason, 'event_not_started');
assert.equal(b.claimQuestReward('zz_local_hunt', t0 + 8 * 86400e3).reason, 'event_ended');                 // incomplete + past grace
assert.equal(b.questProgress('zz_local_hunt', 1, t0 + 7 * 86400e3 + 1).reason, 'event_ended');
assert.equal(b.questProgress('zz_local_hunt', 1, t0 + 1000).added, 1);                                       // during
assert.ok(b.getQuests('frost-fields', t0 + 7 * 86400e3 + 3600e3).some(x => x.id === 'zz_local_hunt'));     // ended, completed, in grace: listed
assert.equal(b.claimQuestReward('zz_local_hunt', t0 + 7 * 86400e3 + 3600e3).granted, true);                 // claim in grace
assert.equal(b.claimQuestReward('zz_local_hunt', t0 + 30 * 86400e3).alreadyClaimed, true);
assert.ok(eco.backend.loadProfile().owned.includes('blizzard_hat'));
assert.ok(!b.getQuests('frost-fields', t0 + 9 * 86400e3).some(x => x.id === 'zz_local_hunt'));
// ---- facade: eventStatus cache (60 s), serverNow advances, event:changed ----
{ const { bus } = await import('../src/core/events.js');
  let clock = 1_000_000, calls = 0, srv = { eventId: 'e', title: 'E', startsAt: new Date(0).toISOString(), endsAt: new Date(10 * 86400e3).toISOString(), active: true, serverNow: new Date(5 * 86400e3).toISOString() };
  const fakeEco = { eventStatus: async () => { calls++; return { ...srv }; } };
  const fq = createQuests(fakeEco, { now: () => clock });
  const changes = []; const off = bus.on('event:changed', (x) => changes.push(x));
  const s1 = await fq.eventStatus('e'); assert.equal(s1.msLeft, 5 * 86400e3); assert.equal(calls, 1);
  clock += 30e3; const s2 = await fq.eventStatus('e'); assert.equal(calls, 1); assert.equal(s2.msLeft, 5 * 86400e3 - 30e3);   // cached, clock advanced
  clock += 31e3; srv = { ...srv, endsAt: new Date(12 * 86400e3).toISOString() };                                              // admin extended it
  const s3 = await fq.eventStatus('e'); assert.equal(calls, 2); assert.equal(changes.length, 1); assert.equal(changes[0].endsAt, srv.endsAt);
  assert.equal((await fq.eventStatus('e', { refresh: true })).eventId, 'e'); assert.equal(calls, 3);
  off?.(); }
// limited-time shop items (Cosmetics' `event:` field, not earnOnly): sold only while the event is live
{ const { COSMETICS, COSMETIC_BY_ID } = await import('../src/data/cosmetics.js');
  const it = { id: 'zz_ltd_goggles', name: 'ZZ Goggles', slot: 'face', price: 200, event: 'zz_local' };
  COSMETICS.push(it); COSMETIC_BY_ID[it.id] = it;
  const t0 = Date.now();
  let av = eco.itemAvailability(it.id, t0);
  assert.equal(av.forSale, true); assert.equal(av.limited, true); assert.equal(av.state, 'live'); assert.ok(av.msLeft > 6 * 86400e3);
  assert.equal(eco.itemAvailability(it.id, t0 + 8 * 86400e3).state, 'event_ended');
  assert.deepEqual(eco.itemAvailability('scarf'), { forSale: true, limited: false });
  if (COSMETIC_BY_ID.tornado_hat) assert.equal(eco.itemAvailability('tornado_hat').state, 'not_for_sale');
  const real = eco.backend.eventStatus.bind(eco.backend);
  eco.profile.coins = 500;
  eco.backend.eventStatus = (id, now) => ({ ...real(id, now), startsAt: new Date(t0 + 3600e3).toISOString(), active: false });
  let r = eco.buy(it.id); assert.equal(r.ok, false); assert.equal(r.code, 'event_not_started'); assert.equal(eco.coins, 500);
  eco.backend.eventStatus = real;
  r = eco.buy(it.id); assert.equal(r.ok, true); assert.equal(eco.coins, 300); assert.ok(eco.owns(it.id));
  eco.backend.eventStatus = (id, now) => ({ ...real(id, now), endsAt: new Date(t0 - 1000).toISOString(), active: false });
  r = eco.buy(it.id); assert.equal(r.reason, 'Already owned');                                  // owned copy is kept
  assert.equal(eco.equip(it.id), true);
  eco.backend.eventStatus = real;
  // signed-in: unknown until the first event_status arrives, then the server window (serverNow offset applied)
  const fakeRemote = { eventStatus: async (id) => ({ eventId: id, startsAt: new Date(t0 - 86400e3).toISOString(), endsAt: new Date(t0 + 3600e3).toISOString(), active: true, serverNow: new Date().toISOString() }) };
  const eco2 = new Economy(new LocalBackend()); eco2.remote = fakeRemote;
  assert.equal(eco2.itemAvailability(it.id).state, 'unknown');
  await new Promise(r => setTimeout(r, 20));
  av = eco2.itemAvailability(it.id); assert.equal(av.state, 'live'); assert.ok(av.msLeft > 3500e3 && av.msLeft <= 3600e3);
  assert.equal(eco2.itemAvailability(it.id, Date.now() + 2 * 3600e3).state, 'event_ended');
  COSMETICS.splice(COSMETICS.indexOf(it), 1); delete COSMETIC_BY_ID[it.id]; }
console.log('quests (local/offline): all checks passed');
