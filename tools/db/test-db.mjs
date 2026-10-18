// Real-Postgres tests (PGlite) for the Supabase migrations, RLS and RPCs.
//   node tools/db/test-db.mjs
import assert from 'node:assert/strict';
import { createDb, createUser, rpc, as, ROOT } from './harness.mjs';
import { resolve } from 'node:path';

const results = [];
async function t(name, fn) {
  try { await fn(); results.push(['PASS', name]); }
  catch (e) { results.push(['FAIL', name, e.message]); }
}
const su = (db, sql, p) => db.query(sql, p).then(r => r.rows);
const denied = async (p) => { try { await p; } catch (e) { return e.message; } throw new Error('expected permission error'); };

const db = await createDb();
const A = await createUser(db, { username: 'alice_1', displayName: 'Alice' });
const B = await createUser(db, { username: 'bob_2' });
const C = await createUser(db, { username: 'cara_3' });

await t('migrations + signup trigger create profiles', async () => {
  const rows = await su(db, `select username, display_name, coins from public.profiles order by username`);
  assert.deepEqual(rows.map(r => r.username), ['alice_1', 'bob_2', 'cara_3']);
  assert.equal(rows[0].display_name, 'Alice'); assert.equal(Number(rows[0].coins), 0);
});

await t('invalid / reserved usernames rejected at signup', async () => {
  await denied(createUser(db, { username: 'No Spaces!' }));
  await denied(createUser(db, { username: 'theadmin' }));
  await denied(createUser(db, { username: 'alice_1' }));   // duplicate
});

await t('username_available works for anon', async () => {
  assert.equal(await rpc(db, null, 'username_available', { p_username: 'alice_1' }), false);
  assert.equal(await rpc(db, null, 'username_available', { p_username: 'fresh_name' }), true);
  assert.equal(await rpc(db, null, 'username_available', { p_username: 'x' }), false);
});

await t('RLS: users only see their own profile; anon sees none', async () => {
  const mine = await as(db, A, tx => tx.query('select username from public.profiles').then(r => r.rows));
  assert.deepEqual(mine.map(r => r.username), ['alice_1']);
  await denied(as(db, null, tx => tx.query('select * from public.profiles')));
});

await t('RLS/grants: no direct writes to wallet, inventory, ledger, caps', async () => {
  await denied(as(db, A, tx => tx.query(`update public.profiles set coins = 999999 where id = $1`, [A])));
  await denied(as(db, A, tx => tx.query(`insert into public.inventory (user_id, item_id) values ($1, 'crown')`, [A])));
  await denied(as(db, A, tx => tx.query(`insert into public.wallet_ledger (user_id, delta, balance_after, kind) values ($1, 5, 5, 'earn')`, [A])));
  await denied(as(db, A, tx => tx.query(`update public.earn_caps set daily_cap = 99999`)));
  await denied(as(db, A, tx => tx.query(`select * from public.earn_daily`)));
  await denied(as(db, A, tx => tx.query(`select * from public.chat_messages`)));
  await denied(as(db, A, tx => tx.query(`select * from public.friendships`)));
});

await t('internal helpers are not callable by clients', async () => {
  await denied(as(db, A, tx => tx.query(`select public._credit($1, 100000, 'admin', null, null, null)`, [A])));
  await denied(as(db, A, tx => tx.query(`select public._profile_json($1)`, [B])));
  await denied(as(db, A, tx => tx.query(`select public._clean_equipped($1, '{}')`, [A])));
  await denied(rpc(db, null, 'claim_daily_bonus'));             // anon cannot use the wallet
  await denied(rpc(db, null, 'get_my_profile'));
});

await t('catalog readable by anon; prices match src/data/cosmetics.js exactly', async () => {
  const { COSMETICS } = await import(resolve(ROOT, 'src/data/cosmetics.js'));
  const rows = await as(db, null, tx => tx.query('select id, price from public.catalog_items').then(r => r.rows));
  const server = Object.fromEntries(rows.map(r => [r.id, r.price]));
  const missing = COSMETICS.filter(c => !(c.id in server)).map(c => c.id);
  assert.deepEqual(missing, [], 'catalog items missing a server price');
  for (const c of COSMETICS) assert.equal(server[c.id], c.price, `price of ${c.id}`);
});

await t('daily bonus: once per UTC day', async () => {
  assert.deepEqual(await rpc(db, A, 'claim_daily_bonus'), { granted: 100, coins: 100 });
  assert.equal((await rpc(db, A, 'claim_daily_bonus')).granted, 0);
  // simulate the previous claim having happened yesterday
  await su(db, `update public.profiles set last_daily_bonus = public._today() - 1 where id = $1`, [A]);
  await su(db, `update public.wallet_ledger set ref = 'daily:' || (public._today() - 1) where user_id = $1 and kind = 'daily'`, [A]);
  assert.deepEqual(await rpc(db, A, 'claim_daily_bonus'), { granted: 100, coins: 200 });
});

await t('game_earn: per-call max, per-source daily cap, idempotent ref, unknown source', async () => {
  let r = await rpc(db, B, 'game_earn', { p_source: 'coin', p_amount: 50, p_reason: 'Pickup' });
  assert.equal(r.granted, 5); assert.equal(r.capped, true);
  for (let i = 0; i < 70; i++) r = await rpc(db, B, 'game_earn', { p_source: 'coin', p_amount: 5 });
  const coins = await su(db, `select coins from public.profiles where id = $1`, [B]);
  assert.equal(Number(coins[0].coins), 300); assert.equal(r.granted, 0); assert.equal(r.capped, true);
  for (let i = 0; i < 55; i++) r = await rpc(db, B, 'game_earn', { p_source: 'build', p_amount: 1 });
  assert.equal(Number((await su(db, `select coins from public.profiles where id = $1`, [B]))[0].coins), 350);
  assert.equal((await rpc(db, B, 'get_my_profile')).buildRewardToday, 50);
  r = await rpc(db, B, 'game_earn', { p_source: 'obby_finish', p_amount: 100, p_ref: 'run-1' });
  assert.equal(r.granted, 100);
  r = await rpc(db, B, 'game_earn', { p_source: 'obby_finish', p_amount: 100, p_ref: 'run-1' });
  assert.equal(r.granted, 0); assert.equal(r.duplicate, true);
  r = await rpc(db, B, 'game_earn', { p_source: 'hacks', p_amount: 1000 });
  assert.equal(r.granted, 25);                                  // falls back to 'other'
  r = await rpc(db, B, 'game_earn', { p_source: 'coin', p_amount: -50 });
  assert.equal(r.granted, 0);
});

await t('game_earn: total daily cap across all sources', async () => {
  await su(db, `update public.earn_daily set amount = 1490 where user_id = $1 and source = '*'`, [B]);
  const r = await rpc(db, B, 'game_earn', { p_source: 'obby_stage', p_amount: 50 });
  assert.equal(r.granted, 10); assert.equal(r.capped, true);
});

await t('game_spend: validation, insufficient funds, idempotent ref', async () => {
  assert.equal((await rpc(db, C, 'game_spend', { p_amount: 25, p_reason: 'skip' })).reason, 'insufficient_funds');
  assert.equal((await rpc(db, A, 'game_spend', { p_amount: 0 })).reason, 'invalid_amount');
  assert.equal((await rpc(db, A, 'game_spend', { p_amount: 999999 })).reason, 'invalid_amount');
  let r = await rpc(db, A, 'game_spend', { p_amount: 25, p_reason: 'Skip stage', p_ref: 'skip-1' });
  assert.deepEqual(r, { ok: true, coins: 175 });
  r = await rpc(db, A, 'game_spend', { p_amount: 25, p_reason: 'Skip stage', p_ref: 'skip-1' });
  assert.equal(r.duplicate, true); assert.equal(r.coins, 175);
});

await t('buy_cosmetic: server price, ownership, funds; ledger balances', async () => {
  assert.equal((await rpc(db, A, 'buy_cosmetic', { p_item_id: 'nope' })).reason, 'unknown_item');
  assert.equal((await rpc(db, A, 'buy_cosmetic', { p_item_id: 'crown' })).reason, 'insufficient_funds');
  let r = await rpc(db, A, 'buy_cosmetic', { p_item_id: 'cap' });
  assert.equal(r.ok, true); assert.equal(r.coins, 135); assert.equal(r.price, 40);
  assert.equal((await rpc(db, A, 'buy_cosmetic', { p_item_id: 'cap' })).reason, 'already_owned');
  const p = await rpc(db, A, 'get_my_profile');
  assert.deepEqual(p.owned, ['cap']); assert.equal(p.coins, 135);
  const [{ sum }] = await su(db, `select sum(delta)::int as sum from public.wallet_ledger where user_id = $1`, [A]);
  assert.equal(sum, 135);
});

await t('save_loadout: only owned items in the right slot; colors validated; cosmeticColors merged', async () => {
  let r = await rpc(db, A, 'save_loadout', { p_equipped: { hat: 'cap', back: 'icewings', face: 'cap' } });
  assert.deepEqual(r.equipped, { hat: 'cap' });
  r = await rpc(db, A, 'save_loadout', { p_rocket_colors: { body: '#112233', fins: 'red', evil: '#000000' } });
  assert.equal(r.rocketColors.body, '#112233'); assert.equal(r.rocketColors.fins, '#3f8fd0'); assert.equal(r.rocketColors.evil, undefined);
  r = await rpc(db, A, 'save_loadout', { p_cosmetic_colors: { earmuffs: '#b3243c', notanitem: '#ffffff', cocoa_mug: 'javascript:' } });
  assert.deepEqual(r.cosmeticColors, { earmuffs: '#b3243c' });
  r = await rpc(db, A, 'save_loadout', { p_cosmetic_colors: { cocoa_mug: '#2f6f4a' } });
  assert.deepEqual(r.cosmeticColors, { earmuffs: '#b3243c', cocoa_mug: '#2f6f4a' });
  r = await rpc(db, A, 'save_loadout', {});                    // nulls leave everything unchanged
  assert.deepEqual(r.equipped, { hat: 'cap' });
  const p = await rpc(db, A, 'get_my_profile');
  assert.deepEqual(p.cosmeticColors, { earmuffs: '#b3243c', cocoa_mug: '#2f6f4a' });
});

await t('game_data: own table, 16 KB cap, owner-only RLS, gears key stripped', async () => {
  assert.equal((await rpc(db, A, 'save_game_data', { p_game_id: 'giant-rainbow-obby', p_data: { checkpoint: 7, gears: ['magicCarpet'] } })).ok, true);
  assert.equal((await rpc(db, A, 'save_game_data', { p_game_id: 'x', p_data: { blob: 'a'.repeat(17000) } })).reason, 'too_large');
  assert.equal((await rpc(db, A, 'save_game_data', { p_game_id: '../evil', p_data: {} })).reason, 'invalid_game');
  assert.equal((await rpc(db, A, 'save_game_data', { p_game_id: 'x', p_data: [1, 2] })).reason, 'not_an_object');
  const loaded = await rpc(db, A, 'load_game_data', { p_game_id: 'giant-rainbow-obby' });
  assert.deepEqual(loaded, { checkpoint: 7, gears: [] });              // gear in the blob was NOT trusted
  assert.deepEqual((await rpc(db, A, 'get_my_profile')).gameData, { 'giant-rainbow-obby': { checkpoint: 7, gears: [] } });
  const mineOnly = await as(db, B, tx => tx.query('select * from public.game_data').then(r => r.rows));
  assert.equal(mineOnly.length, 0);
  await denied(as(db, A, tx => tx.query(`insert into public.game_data (user_id, game_id, data) values ($1, 'y', '{}')`, [A])));
  await denied(as(db, A, tx => tx.query(`insert into public.game_gears (user_id, game_id, gear_id) values ($1, 'giant-rainbow-obby', 'magicCarpet')`, [A])));
});

await t('gears: server price from game config, per-game ownership, funds, idempotent', async () => {
  const { GEAR_PRICES_BB, GAME_ID } = await import(resolve(ROOT, 'src/games/giantObby/config.js'));
  const prices = Object.fromEntries((await as(db, null, tx => tx.query('select gear_id, price from public.game_gear_prices where game_id = $1', [GAME_ID]))).rows.map(r => [r.gear_id, r.price]));
  assert.deepEqual(prices, GEAR_PRICES_BB);
  assert.equal((await rpc(db, A, 'buy_gear', { p_game_id: GAME_ID, p_gear_id: 'nope' })).reason, 'unknown_gear');
  assert.equal((await rpc(db, C, 'buy_gear', { p_game_id: GAME_ID, p_gear_id: 'speedCoil' })).reason, 'insufficient_funds');
  const before = (await rpc(db, A, 'get_my_profile')).coins;
  const r = await rpc(db, A, 'buy_gear', { p_game_id: GAME_ID, p_gear_id: 'speedCoil' });
  assert.equal(r.ok, true); assert.equal(r.coins, before - GEAR_PRICES_BB.speedCoil); assert.deepEqual(r.gears, ['speedCoil']);
  assert.equal((await rpc(db, A, 'buy_gear', { p_game_id: GAME_ID, p_gear_id: 'speedCoil' })).reason, 'already_owned');
  assert.equal(await rpc(db, A, 'owns_gear', { p_game_id: GAME_ID, p_gear_id: 'speedCoil' }), true);
  assert.equal(await rpc(db, A, 'owns_gear', { p_game_id: 'rainbow-obby', p_gear_id: 'speedCoil' }), false);   // other game
  assert.equal(await rpc(db, B, 'owns_gear', { p_game_id: GAME_ID, p_gear_id: 'speedCoil' }), false);           // other player
  assert.equal((await rpc(db, A, 'buy_gear', { p_game_id: 'rainbow-obby', p_gear_id: 'speedCoil' })).reason, 'unknown_gear');
  assert.deepEqual((await rpc(db, A, 'load_game_data', { p_game_id: GAME_ID })).gears, ['speedCoil']);
  await rpc(db, A, 'save_game_data', { p_game_id: GAME_ID, p_data: { checkpoint: 9, gears: [] } });   // blob can't remove ownership either
  assert.deepEqual(await rpc(db, A, 'load_game_data', { p_game_id: GAME_ID }), { checkpoint: 9, gears: ['speedCoil'] });
});

await t('first-login migration: demo grants removed, capped, premium excluded, colors kept, runs once', async () => {
  const D = await createUser(db, { username: 'dana_4' });
  const local = { coins: 150000, demoGranted: 100000, owned: ['icerocket', 'earmuffs', 'crown', 'fake_item', 'scarf'],
    equipped: { hat: 'earmuffs', back: 'icerocket', neck: 'scarf' }, rocketColors: { body: '#ff0000' },
    cosmeticColors: { earmuffs: '#2f6f4a', bogus: '#ffffff' }, gameData: { 'giant-rainbow-obby': { checkpoint: 3, gears: ['magicCarpet'] } } };
  const r = await rpc(db, D, 'migrate_local_profile', { p_local: local });
  assert.equal(r.ok, true); assert.equal(r.coins, 2000);         // (150000-100000) capped at 2000
  assert.deepEqual([...r.items].sort(), ['crown', 'earmuffs', 'scarf']);
  assert.deepEqual(r.profile.equipped, { hat: 'earmuffs', neck: 'scarf' });
  assert.deepEqual(r.profile.cosmeticColors, { earmuffs: '#2f6f4a' });
  assert.equal(r.profile.rocketColors.body, '#ff0000');
  assert.deepEqual(r.profile.gameData, { 'giant-rainbow-obby': { checkpoint: 3, gears: [] } });   // guest gears never carry over
  const again = await rpc(db, D, 'migrate_local_profile', { p_local: local });
  assert.equal(again.reason, 'already_migrated'); assert.equal(again.profile.coins, 2000);
  const E = await createUser(db, { username: 'eve_5' });
  const junk = await rpc(db, E, 'migrate_local_profile', { p_local: { coins: 'lots', owned: 'crown', demoGranted: -5 } });
  assert.equal(junk.ok, true); assert.equal(junk.coins, 0); assert.deepEqual(junk.items, []);
});

await t('safe chat: catalog phrases only, room validation, mute', async () => {
  assert.equal((await rpc(db, A, 'post_chat', { p_room: 'lobby', p_phrase_id: 'free text <script>' })).reason, 'invalid_phrase');
  assert.equal((await rpc(db, A, 'post_chat', { p_room: 'secret room', p_phrase_id: 'hi' })).reason, 'invalid_room');
  const r = await rpc(db, A, 'post_chat', { p_room: 'lobby', p_phrase_id: 'hi' });
  assert.equal(r.ok, true); assert.equal(r.text, 'Hi!');
  await su(db, `update public.profiles set chat_muted_until = now() + interval '5 minutes' where id = $1`, [C]);
  assert.equal((await rpc(db, C, 'post_chat', { p_room: 'lobby', p_phrase_id: 'hi' })).reason, 'muted');
});

await t('safe chat: rate limits (min interval + per-minute)', async () => {
  const r = await rpc(db, A, 'post_chat', { p_room: 'lobby', p_phrase_id: 'hello_everyone' });
  assert.equal(r.reason, 'rate_limited'); assert.ok(r.retryAfterMs > 0 && r.retryAfterMs <= 2000);
  for (let i = 0; i < 12; i++) {
    await su(db, `update public.chat_messages set created_at = created_at - interval '3 seconds' where user_id = $1`, [B]);
    const x = await rpc(db, B, 'post_chat', { p_room: 'lobby', p_phrase_id: 'yes' });
    if (i < 10) assert.equal(x.ok, true, 'post ' + i); else assert.equal(x.reason, 'rate_limited');
  }
});

await t('safe chat: get_chat + heartbeat expose only public info', async () => {
  const msgs = await rpc(db, C, 'get_chat', { p_room: 'lobby' });
  assert.ok(msgs.length >= 2); assert.equal(msgs[0].text, 'Hi!'); assert.equal(msgs[0].username, 'alice_1');
  assert.equal(msgs[0].mine, false);
  const after = await rpc(db, C, 'get_chat', { p_room: 'lobby', p_after_id: msgs.at(-1).id });
  assert.deepEqual(after, []);
  const members = await rpc(db, C, 'chat_heartbeat', { p_room: 'lobby' });
  const alice = members.find(m => m.username === 'alice_1');
  assert.deepEqual(Object.keys(alice).sort(), ['cosmeticColors', 'displayName', 'equipped', 'me', 'rocketColors', 'username']);
  assert.ok(members.find(m => m.username === 'cara_3').me);
  await rpc(db, C, 'chat_leave', { p_room: 'lobby' });
  assert.ok(!(await rpc(db, A, 'chat_heartbeat', { p_room: 'lobby' })).some(m => m.username === 'cara_3'));
});

await t('friends: request, incoming/outgoing, accept, mutual auto-accept, decline, remove', async () => {
  assert.equal((await rpc(db, A, 'send_friend_request', { p_username: 'ghost' })).reason, 'no_such_user');
  assert.equal((await rpc(db, A, 'send_friend_request', { p_username: 'alice_1' })).reason, 'self');
  assert.equal((await rpc(db, A, 'send_friend_request', { p_username: 'BOB_2' })).status, 'pending');
  let lb = await rpc(db, B, 'list_friends');
  assert.deepEqual(lb.incoming.map(f => f.username), ['alice_1']);
  assert.deepEqual((await rpc(db, A, 'list_friends')).outgoing.map(f => f.username), ['bob_2']);
  assert.equal((await rpc(db, A, 'respond_friend_request', { p_username: 'bob_2', p_accept: true })).reason, 'no_request'); // can't accept own
  assert.equal((await rpc(db, B, 'respond_friend_request', { p_username: 'alice_1', p_accept: true })).status, 'friends');
  const la = await rpc(db, A, 'list_friends');
  assert.deepEqual(la.friends.map(f => f.username), ['bob_2']); assert.equal(typeof la.friends[0].online, 'boolean');
  await rpc(db, A, 'send_friend_request', { p_username: 'cara_3' });
  assert.equal((await rpc(db, C, 'send_friend_request', { p_username: 'alice_1' })).status, 'friends');  // mutual
  await rpc(db, B, 'send_friend_request', { p_username: 'cara_3' });
  assert.equal((await rpc(db, C, 'respond_friend_request', { p_username: 'bob_2', p_accept: false })).status, 'declined');
  assert.deepEqual((await rpc(db, C, 'list_friends')).incoming, []);
  assert.equal((await rpc(db, A, 'remove_friend', { p_username: 'bob_2' })).ok, true);
  assert.deepEqual((await rpc(db, B, 'list_friends')).friends, []);
});

await t('price sync: re-run is idempotent; removed items deactivated; new prices applied', async () => {
  const { loadSources, toSQL } = await import(resolve(ROOT, 'scripts/sync-catalog.mjs'));
  const src = await loadSources(ROOT);
  await db.exec(toSQL(src));
  const n = (await su(db, `select count(*)::int n from public.catalog_items where active`))[0].n;
  assert.equal(n, src.items.length);
  const changed = { items: src.items.filter(c => c.id !== 'sword').map(c => c.id === 'cap' ? { ...c, price: 45 } : c), phrases: src.phrases };
  await db.exec(toSQL(changed));
  const rows = Object.fromEntries((await su(db, `select id, price, active from public.catalog_items`)).map(r => [r.id, r]));
  assert.equal(rows.sword.active, false); assert.equal(rows.cap.price, 45);
  assert.equal((await rpc(db, A, 'buy_cosmetic', { p_item_id: 'sword' })).reason, 'unknown_item');
  await db.exec(toSQL(src));
  assert.equal((await su(db, `select active from public.catalog_items where id = 'sword'`))[0].active, true);
});

await t('game stats: publish dates synced, deduped visits, live players via heartbeat (one row per user)', async () => {
  const { GAME_META } = await import(resolve(ROOT, 'src/data/gameMeta.js'));
  let stats = await rpc(db, null, 'list_game_stats');                       // anon can read aggregates
  const ids = stats.map(g => g.gameId);
  for (const [id, m] of Object.entries(GAME_META)) {
    if (m.retired) assert.ok(!ids.includes(id), id + ' should be retired');
    else assert.equal(Date.parse(stats.find(g => g.gameId === id).publishedAt), Date.parse(m.publishedAt), id);
  }
  assert.equal(stats[0].gameId, 'giant-rainbow-obby');                       // newest first
  assert.equal((await rpc(db, A, 'record_visit', { p_game_id: 'nope' })).reason, 'unknown_game');
  assert.equal((await rpc(db, A, 'record_visit', { p_game_id: 'birg-hq' })).counted, true);
  assert.equal((await rpc(db, A, 'record_visit', { p_game_id: 'birg-hq' })).counted, false);   // deduped
  assert.equal((await rpc(db, B, 'record_visit', { p_game_id: 'birg-hq' })).counted, true);
  await su(db, `update public.game_visit_last set last_at = now() - interval '31 minutes' where user_id = $1`, [A]);
  assert.equal((await rpc(db, A, 'record_visit', { p_game_id: 'birg-hq' })).visits, 3);       // new window counts again
  await denied(as(db, A, tx => tx.query(`update public.games set visits = 999999`)));
  await denied(as(db, A, tx => tx.query(`select * from public.game_presence`)));
  await denied(rpc(db, null, 'game_heartbeat', { p_game_id: 'birg-hq' }));                     // guests don't count
  assert.equal((await rpc(db, A, 'game_heartbeat', { p_game_id: 'frost-fields' })).playing, 1);
  assert.equal((await rpc(db, B, 'game_heartbeat', { p_game_id: 'frost-fields' })).playing, 2);
  await rpc(db, A, 'game_heartbeat', { p_game_id: 'birg-hq' });                                // A switches games
  const rows = await su(db, `select count(*)::int n from public.game_presence where user_id = $1`, [A]);
  assert.equal(rows[0].n, 1);                                                                   // one row per user
  await su(db, `update public.game_presence set last_seen = now() - interval '91 seconds' where user_id = $1`, [B]);
  stats = Object.fromEntries((await rpc(db, null, 'list_game_stats')).map(g => [g.gameId, g]));
  assert.equal(stats['frost-fields'].playing, 0); assert.equal(stats['birg-hq'].playing, 1);
  assert.equal(stats['birg-hq'].visits7d, 3); assert.equal(stats['birg-hq'].visitsAll, 3);
  await rpc(db, A, 'game_leave');
  assert.equal(Object.fromEntries((await rpc(db, null, 'list_game_stats')).map(g => [g.gameId, g]))['birg-hq'].playing, 0);
});

await t('most popular: rolling 7-day buckets; an 8-day-old visit does not count, all-time keeps it, buckets kept', async () => {
  const G = 'frost-fields';
  await su(db, `insert into public.game_visit_days (game_id, day, count) values ($1, public._today() - 8, 50), ($1, public._today() - 6, 2)
                on conflict (game_id, day) do update set count = excluded.count`, [G]);
  await su(db, `update public.games set visits = visits + 52 where game_id = $1`, [G]);
  const s = Object.fromEntries((await rpc(db, null, 'list_game_stats')).map(g => [g.gameId, g]));
  assert.equal(s[G].visits7d, 2, '8-day-old bucket must not count; 6-day-old must');
  assert.equal(s[G].visitsAll, 52);
  const D = await createUser(db, { username: 'visit_now' });
  assert.equal((await rpc(db, D, 'record_visit', { p_game_id: G })).counted, true);
  const s2 = Object.fromEntries((await rpc(db, null, 'list_game_stats')).map(g => [g.gameId, g]));
  assert.equal(s2[G].visits7d, 3); assert.equal(s2[G].visitsAll, 53);
  const today = await su(db, `select count::int c from public.game_visit_days where game_id = $1 and day = public._today()`, [G]);
  assert.equal(today[0].c, 1);
  assert.equal((await su(db, `select count(*)::int n from public.game_visit_days where game_id = $1 and day = public._today() - 8`, [G]))[0].n, 1);
  await denied(as(db, D, tx => tx.query(`select * from public.game_visit_days`)));
});

await t('featured games: public read, seeded, admin-only writes (no client can write the table)', async () => {
  const f = await rpc(db, null, 'list_featured');
  assert.deepEqual(f.map(x => x.gameId), ['giant-rainbow-obby', 'birg-hq']);
  await denied(as(db, A, tx => tx.query(`update public.featured_games set blurb = 'hacked'`)));
  await denied(as(db, A, tx => tx.query(`insert into public.featured_games (game_id) values ('frost-fields')`)));
  await denied(as(db, A, tx => tx.query(`update public.profiles set is_admin = true where id = $1`, [A])));
  await denied(rpc(db, A, 'set_featured_games', { p_items: [{ gameId: 'frost-fields' }] }));       // not admin
  await denied(rpc(db, null, 'set_featured_games', { p_items: [] }));                              // anon
  await su(db, `update public.profiles set is_admin = true where id = $1`, [C]);                    // done by Colin in the SQL editor
  const r = await rpc(db, C, 'set_featured_games', { p_items: [{ gameId: 'birg-hq', blurb: 'Cozy!' }, { gameId: 'frost-fields' }] });
  assert.equal(r.ok, true);
  assert.deepEqual((await rpc(db, null, 'list_featured')).map(x => [x.gameId, x.blurb]), [['birg-hq', 'Cozy!'], ['frost-fields', null]]);
  await denied(rpc(db, C, 'set_featured_games', { p_items: [{ gameId: 'not-a-game' }] }));
  assert.equal((await rpc(db, null, 'list_featured')).length, 2);                                    // failed call rolled back
  await rpc(db, C, 'set_featured_games', { p_items: [{ gameId: 'giant-rainbow-obby', image: 'featured/giant-rainbow-obby.png' }, { gameId: 'birg-hq', image: 'featured/birg-hq.png' }] });
  await su(db, `update public.profiles set is_admin = false where id = $1`, [C]);
  const { loadSources, toSQL } = await import(resolve(ROOT, 'scripts/sync-catalog.mjs'));
  await rpc(db, null, 'list_featured');
  await su(db, `update public.featured_games set blurb = 'admin edit' where game_id = 'birg-hq'`);
  await db.exec(toSQL(await loadSources(ROOT)));                                                     // deploy re-sync
  assert.equal((await rpc(db, null, 'list_featured')).find(x => x.gameId === 'birg-hq').blurb, 'admin edit');
});

await t('every safe-chat phrase in src/data/safeChat.js exists on the server', async () => {
  const { PHRASES } = await import(resolve(ROOT, 'src/data/safeChat.js'));
  const ids = new Set((await su(db, `select id from public.chat_phrases where active`)).map(r => r.id));
  assert.ok(PHRASES.length >= 150, 'need 150+ phrases');
  assert.deepEqual(PHRASES.filter(p => !ids.has(p.id)).map(p => p.id), []);
});

await db.close();
for (const r of results) console.log(r[0], r[1], r[2] ? '\n     ' + r[2] : '');
const failed = results.filter(r => r[0] === 'FAIL').length;
console.log(`\n${results.length - failed}/${results.length} DB tests passed (real Postgres via PGlite)`);
process.exit(failed ? 1 : 0);
