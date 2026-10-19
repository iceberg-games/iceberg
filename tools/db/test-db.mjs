// Real-Postgres tests (PGlite) for the Supabase migrations, RLS and RPCs.
//   node tools/db/test-db.mjs
import assert from 'node:assert/strict';
import { createDb, createUser, rpc, as, ROOT, canUseTopic } from './harness.mjs';
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

await t("game_earn: Corner Bakery day clears (15/25/40 BB, source custom_game) are paid in full", async () => {
  const U = await createUser(db, { username: 'zz_bakery' });
  for (const amt of [15, 25, 40]) {
    const r = await rpc(db, U, 'game_earn', { p_source: 'custom_game', p_amount: amt, p_reason: 'Corner Bakery Rush: Day cleared' });
    assert.equal(r.granted, amt); assert.equal(r.capped, false);
  }
  const caps = await su(db, `select per_call_max, daily_cap from public.earn_caps where source = 'custom_game'`);
  assert.ok(caps[0].per_call_max >= 40 && caps[0].daily_cap >= 80, JSON.stringify(caps[0]));
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
  assert.equal(stats[0].gameId, Object.entries(GAME_META).filter(([, m]) => !m.retired && m.publishedAt).sort((a, b) => Date.parse(b[1].publishedAt) - Date.parse(a[1].publishedAt))[0][0]);   // newest first
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


await t('multiplayer: instance pick/create with cap, reload keeps instance, stale members ignored', async () => {
  await su(db, `update public.app_config set value = '3' where key = 'mp_instance_cap'`);
  const us = [];
  for (let i = 0; i < 4; i++) us.push(await createUser(db, { username: `mp_user_${i}` }));
  const j = [];
  for (const u of us) j.push(await rpc(db, u, 'mp_join', { p_game_id: 'frost-fields' }));
  assert.deepEqual(j.map(r => r.instance), [1, 1, 1, 2]);                       // 4th player overflows into a new instance
  assert.equal(j[0].topic, 'game:frost-fields:1'); assert.equal(j[3].cap, 3);
  assert.deepEqual(j[2].roster.map(p => p.username), ['mp_user_0', 'mp_user_1', 'mp_user_2']);
  assert.equal(Object.keys(j[2].roster[0]).sort().join(), 'cosmeticColors,displayName,equipped,joinedAt,rocketColors,username');   // public info only (+ joinedAt, 0011: host = earliest)
  assert.equal((await rpc(db, us[1], 'mp_join', { p_game_id: 'frost-fields' })).instance, 1);      // reload: same instance
  await su(db, `update public.mp_members set last_seen = now() - interval '2 minutes' where user_id = $1`, [us[0]]);
  const x = await createUser(db, { username: 'mp_user_x' });
  assert.equal((await rpc(db, x, 'mp_join', { p_game_id: 'frost-fields' })).instance, 1);          // stale seat is free again
  assert.equal((await rpc(db, us[0], 'mp_heartbeat', { p_game_id: 'frost-fields', p_instance: 1 })).ok, true);   // (row still matches)
  const other = await rpc(db, us[3], 'mp_join', { p_game_id: 'birg-hq' });
  assert.equal(other.instance, 1);                                                                  // per game; one row per player
  assert.equal((await su(db, `select count(*)::int n from public.mp_members where user_id = $1`, [us[3]]))[0].n, 1);
  for (const u of [...us, x]) await rpc(db, u, 'mp_leave');
  assert.equal((await su(db, `select count(*)::int n from public.mp_members`))[0].n, 0);
});

await t('multiplayer: 12-player cap holds; 13th gets a new instance', async () => {
  await su(db, `update public.app_config set value = '12' where key = 'mp_instance_cap'`);
  const us = []; for (let i = 0; i < 13; i++) us.push(await createUser(db, { username: `cap_user_${i}` }));
  const inst = []; for (const u of us) inst.push((await rpc(db, u, 'mp_join', { p_game_id: 'giant-rainbow-obby' })).instance);
  assert.equal(inst.filter(i => i === 1).length, 12); assert.equal(inst[12], 2);
  const hz = (await rpc(db, us[0], 'mp_heartbeat', { p_game_id: 'giant-rainbow-obby', p_instance: 1 })).sendHz;
  assert.ok(Number(hz) >= 1 && Number(hz) < 10, `budget should throttle a full server (got ${hz})`);   // 60 / (144 + 1) -> 1 Hz floor
  for (const u of us) await rpc(db, u, 'mp_leave');
  const solo = await rpc(db, us[0], 'mp_join', { p_game_id: 'giant-rainbow-obby' });
  assert.equal(Number(solo.sendHz), 10);                                                            // quiet project: full 10 Hz
  await rpc(db, us[0], 'mp_leave');
});

await t('multiplayer: join friend (accepted friends only), full friend server falls back', async () => {
  await su(db, `update public.app_config set value = '2' where key = 'mp_instance_cap'`);
  const f1 = await createUser(db, { username: 'fr_one' }), f2 = await createUser(db, { username: 'fr_two' });
  const s1 = await createUser(db, { username: 'fr_stranger' }), f3 = await createUser(db, { username: 'fr_three' });
  await rpc(db, f1, 'send_friend_request', { p_username: 'fr_two' }); await rpc(db, f2, 'respond_friend_request', { p_username: 'fr_one', p_accept: true });
  await rpc(db, f1, 'send_friend_request', { p_username: 'fr_three' }); await rpc(db, f3, 'respond_friend_request', { p_username: 'fr_one', p_accept: true });
  // fr_one is alone in instance 2 (instance 1 is full of others)
  const filler = []; for (let i = 0; i < 2; i++) { filler.push(await createUser(db, { username: `fr_fill_${i}` })); await rpc(db, filler[i], 'mp_join', { p_game_id: 'birg-hq' }); }
  assert.equal((await rpc(db, f1, 'mp_join', { p_game_id: 'birg-hq' })).instance, 2);
  assert.deepEqual((await rpc(db, f2, 'friends_playing')).map(f => [f.username, f.gameId, f.instance, f.full]), [['fr_one', 'birg-hq', 2, false]]);
  assert.deepEqual(await rpc(db, s1, 'friends_playing'), []);
  const s = await rpc(db, s1, 'mp_join', { p_game_id: 'birg-hq', p_friend: 'fr_one' });
  assert.equal(s.note, 'not_friends');                                                              // strangers can't target players
  await rpc(db, s1, 'mp_leave');
  const j2 = await rpc(db, f2, 'mp_join', { p_game_id: 'birg-hq', p_friend: 'FR_ONE' });
  assert.equal(j2.instance, 2); assert.equal(j2.note, null);
  const j3 = await rpc(db, f3, 'mp_join', { p_game_id: 'birg-hq', p_friend: 'fr_one' });
  assert.equal(j3.note, 'friend_full'); assert.equal(j3.instance, 3);                                // full -> next free instance
  assert.equal((await rpc(db, f2, 'mp_join', { p_game_id: 'frost-fields', p_friend: 'fr_one' })).note, 'friend_not_here');
  for (const u of [f1, f2, f3, ...filler]) await rpc(db, u, 'mp_leave');
  await su(db, `update public.app_config set value = '12' where key = 'mp_instance_cap'`);
});

await t('multiplayer: tables RPC-only; Realtime Authorization only for current members of that topic', async () => {
  const u = await createUser(db, { username: 'rt_member' }), o = await createUser(db, { username: 'rt_outsider' });
  await denied(as(db, u, tx => tx.query(`select * from public.mp_members`)));
  await denied(as(db, u, tx => tx.query(`insert into public.mp_members (user_id, game_id, instance_id) values ($1, 'x', 1)`, [u])));
  await denied(rpc(db, null, 'mp_join', { p_game_id: 'birg-hq' }));
  const j = await rpc(db, u, 'mp_join', { p_game_id: 'birg-hq' });
  assert.equal(await canUseTopic(db, u, j.topic), true);
  assert.equal(await canUseTopic(db, u, j.topic, 'presence'), true);
  assert.equal(await canUseTopic(db, o, j.topic), false);                       // not a member
  assert.equal(await canUseTopic(db, null, j.topic), false);                    // anon
  assert.equal(await canUseTopic(db, u, 'game:birg-hq:99'), false);             // another instance
  assert.equal(await canUseTopic(db, u, 'lobby'), false);
  await rpc(db, u, 'mp_leave');
  assert.equal(await canUseTopic(db, u, j.topic), false);                       // left -> no access
  assert.equal((await rpc(db, u, 'post_chat', { p_room: 'game:birg-hq:1', p_phrase_id: (await su(db, `select id from public.chat_phrases limit 1`))[0].id })).ok, true);   // per-instance chat rooms
  assert.equal((await rpc(db, u, 'post_chat', { p_room: 'game:birg-hq:1:2', p_phrase_id: 'x' })).reason, 'invalid_room');
});


await t('event: fixture validates + syncs (grant-only cosmetics, ND gear + consumables, 4 quests); re-sync idempotent', async () => {
  const { loadSources, validate, toSQL } = await import(resolve(ROOT, 'scripts/sync-catalog.mjs'));
  const { withEvent } = await import(resolve(ROOT, 'tools/db/fixtures/event-fixture.mjs'));
  const src = withEvent(await loadSources(ROOT));
  assert.deepEqual(validate(src), []);
  await db.exec(toSQL(src));
  const fp = async () => JSON.stringify(await su(db, `select (select json_agg(q order by quest_id) from public.quest_defs q) q, (select json_agg(c order by item_id) from public.game_consumable_prices c) c, (select json_agg(i order by id) from public.catalog_items i) i`));
  const a = await fp(); await db.exec(toSQL(src)); assert.equal(await fp(), a);
  // the event exists but is unscheduled until the release step sets its window
  const ev0 = (await su(db, `select starts_at, ends_at, claim_grace::text g, active from public.game_events where id = 'natural_disasters'`))[0];
  assert.deepEqual([ev0.starts_at, ev0.ends_at, ev0.g, ev0.active], [null, null, '24:00:00', true]);
  const pre = await createUser(db, { username: 'ev_early' });
  assert.equal((await rpc(db, pre, 'quest_progress', { p_quest_id: 'nd_quest_disaster_survival', p_delta: 1 })).reason, 'event_not_started');
  assert.equal((await rpc(db, null, 'event_status', { p_event_id: 'natural_disasters' })).active, false);
  // release step (scripts/event-window.mjs): started yesterday, 8 days long
  const { eventWindowSQL } = await import(resolve(ROOT, 'scripts/event-window.mjs'));
  await db.exec(eventWindowSQL('natural_disasters', { start: new Date(Date.now() - 86400e3).toISOString(), days: 8 }));
  assert.equal((await rpc(db, null, 'event_status', { p_event_id: 'natural_disasters' })).active, true);
  assert.deepEqual((await su(db, `select id from public.catalog_items where grant_only order by id`)).map(r => r.id), ['blizzard_hat', 'lightning_back', 'meteor_pet', 'tornado_hat']);
  assert.equal((await su(db, `select count(*)::int n from public.quest_defs where active`))[0].n, 4);
  // validation catches a buyable reward and an unknown game
  const bad = { ...src, quests: [{ ...src.quests.at(-1), id: 'zz_bad', rewardItemId: 'earmuffs', gameId: 'nope' }] };
  const errs = validate(bad).join('\n');
  assert.match(errs, /must be grant-only/); assert.match(errs, /unknown gameId/);
});

await t('event: event cosmetics cannot be bought or imported from a guest save', async () => {
  const u = await createUser(db, { username: 'ev_buyer' });
  await su(db, `update public.profiles set coins = 5000 where id = $1`, [u]);
  assert.equal((await rpc(db, u, 'buy_cosmetic', { p_item_id: 'tornado_hat' })).reason, 'not_for_sale');
  assert.equal((await rpc(db, u, 'buy_cosmetic', { p_item_id: 'earmuffs' })).ok, true);   // normal items still work
  const m = await rpc(db, u, 'migrate_local_profile', { p_local: { coins: 0, owned: ['tornado_hat', 'meteor_pet', 'cocoa_mug'] } });
  assert.deepEqual(m.items, ['cocoa_mug']);
  assert.equal((await su(db, `select count(*)::int n from public.inventory where user_id = $1 and item_id in ('tornado_hat','meteor_pet')`, [u]))[0].n, 0);
});

await t('quests: progress only via RPC, per-call max, min interval, hourly cap, goal cap, live window', async () => {
  const u = await createUser(db, { username: 'ev_quester' });
  await denied(as(db, u, tx => tx.query(`insert into public.quest_progress (user_id, quest_id, count) values ($1, 'nd_quest_birg_hq', 3)`, [u])));
  await denied(as(db, u, tx => tx.query(`update public.quest_progress set count = 999`)));
  await denied(rpc(db, null, 'quest_progress', { p_quest_id: 'nd_quest_birg_hq', p_delta: 1 }));
  assert.equal((await rpc(db, u, 'quest_progress', { p_quest_id: 'nd_quest_disaster_survival', p_delta: 2 })).reason, 'invalid_delta');   // maxPerCall 1
  assert.equal((await rpc(db, u, 'quest_progress', { p_quest_id: 'nope', p_delta: 1 })).reason, 'unknown_quest');
  let r = await rpc(db, u, 'quest_progress', { p_quest_id: 'nd_quest_disaster_survival', p_delta: 1 });
  assert.equal(r.ok, true); assert.equal(r.quest.progress, 1);
  r = await rpc(db, u, 'quest_progress', { p_quest_id: 'nd_quest_disaster_survival', p_delta: 1 });
  assert.equal(r.reason, 'too_fast'); assert.ok(r.retryAfterMs > 0 && r.retryAfterMs <= 2000);       // can't farm instantly
  const back = (s) => su(db, `update public.quest_progress set last_at = last_at - interval '${s} seconds' where user_id = $1`, [u]);
  for (let i = 0; i < 10; i++) { await back(3); await rpc(db, u, 'quest_progress', { p_quest_id: 'nd_quest_disaster_survival', p_delta: 1 }); }
  r = (await rpc(db, u, 'get_quests', { p_game_id: 'natural-disaster-survival' }))[0];
  assert.deepEqual([r.progress, r.completed, r.claimed, r.itemId], [5, true, false, 'tornado_hat']);   // capped at goal
  // hourly cap: frost quest maxPerHour 40, maxPerCall 5, goal 20 -> set goal high to hit the cap
  await su(db, `update public.quest_defs set goal = 1000 where quest_id = 'nd_quest_frost_fields'`);
  let added = 0;
  for (let i = 0; i < 12; i++) { await back(2); const x = await rpc(db, u, 'quest_progress', { p_quest_id: 'nd_quest_frost_fields', p_delta: 5 }); if (x.ok) added += x.added; else assert.equal(x.reason, 'hourly_cap'); }
  assert.equal(added, 40);
  await su(db, `update public.quest_progress set hour_start = hour_start - interval '61 minutes' where user_id = $1 and quest_id = 'nd_quest_frost_fields'`, [u]);
  await back(2); assert.equal((await rpc(db, u, 'quest_progress', { p_quest_id: 'nd_quest_frost_fields', p_delta: 5 })).added, 5);   // next hour
  await su(db, `update public.quest_defs set goal = 20 where quest_id = 'nd_quest_frost_fields'`);
  // outside the window: no progress
  await su(db, `update public.quest_defs set ends_at = now() - interval '1 minute' where quest_id = 'nd_quest_birg_hq'`);
  assert.equal((await rpc(db, u, 'quest_progress', { p_quest_id: 'nd_quest_birg_hq', p_delta: 1 })).reason, 'event_ended');   // quest's own end narrows the event window
  assert.ok(!(await rpc(db, null, 'get_quests', {})).some(q => q.id === 'nd_quest_birg_hq'));        // ended quests hidden
  await su(db, `update public.quest_defs set ends_at = '2099-01-01' where quest_id = 'nd_quest_birg_hq'`);
  assert.equal((await rpc(db, null, 'get_quests', {})).find(q => q.id === 'nd_quest_birg_hq').progress, 0);   // anon read
});

await t('quests: claim_quest_reward grants the cosmetic once (no BB), not before completion', async () => {
  const u = (await su(db, `select id from public.profiles where username = 'ev_quester'`))[0].id;
  const coins = (await su(db, `select coins from public.profiles where id = $1`, [u]))[0].coins;
  assert.deepEqual(await rpc(db, u, 'claim_quest_reward', { p_quest_id: 'nd_quest_giant_obby' }), { granted: false, reason: 'not_complete', itemId: 'lightning_back', progress: 0, goal: 50 });
  const c1 = await rpc(db, u, 'claim_quest_reward', { p_quest_id: 'nd_quest_disaster_survival' });
  assert.equal(c1.granted, true); assert.equal(c1.itemId, 'tornado_hat'); assert.ok(c1.profile.owned.includes('tornado_hat'));
  const c2 = await rpc(db, u, 'claim_quest_reward', { p_quest_id: 'nd_quest_disaster_survival' });
  assert.deepEqual([c2.granted, c2.alreadyClaimed], [false, true]);
  assert.equal((await su(db, `select count(*)::int n from public.inventory where user_id = $1 and item_id = 'tornado_hat'`, [u]))[0].n, 1);
  assert.equal((await su(db, `select coins from public.profiles where id = $1`, [u]))[0].coins, coins);          // no Birg Bucks moved
  assert.equal((await su(db, `select count(*)::int n from public.wallet_ledger where user_id = $1 and source like 'quest%'`, [u]))[0].n, 0);
  // equipping the event cosmetic works once granted
  const lo = await rpc(db, u, 'save_loadout', { p_equipped: { hat: 'tornado_hat' }, p_rocket_colors: null, p_cosmetic_colors: null });
  assert.equal((lo.profile || lo).equipped?.hat ?? (await su(db, `select equipped->>'hat' h from public.profiles where id = $1`, [u]))[0].h, 'tornado_hat');
  // claim still works after the event ends (completed in time)
  await su(db, `update public.quest_defs set ends_at = now() - interval '1 hour', starts_at = now() - interval '9 days' where quest_id = 'nd_quest_frost_fields'`);
  const fr = (await rpc(db, u, 'get_quests', {})).find(q => q.id === 'nd_quest_frost_fields');
  assert.ok(fr && fr.completed && !fr.claimed && fr.live === false);
  assert.equal((await rpc(db, u, 'claim_quest_reward', { p_quest_id: 'nd_quest_frost_fields' })).granted, true);
  await su(db, `update public.quest_defs set ends_at = '2099-01-01', starts_at = '2026-10-01' where quest_id = 'nd_quest_frost_fields'`);
});

await t('disaster game: Green Balloon via buy_gear, Apple/Bigger Storm via buy_consumable (server price, idempotent ref, funds)', async () => {
  const u = await createUser(db, { username: 'nd_player' });
  await su(db, `update public.profiles set coins = 200 where id = $1`, [u]);
  const g = await rpc(db, u, 'buy_gear', { p_game_id: 'natural-disaster-survival', p_gear_id: 'greenBalloon' });
  assert.deepEqual([g.ok, g.price, g.coins], [true, 150, 50]);
  assert.equal(await rpc(db, u, 'owns_gear', { p_game_id: 'natural-disaster-survival', p_gear_id: 'greenBalloon' }), true);
  const a1 = await rpc(db, u, 'buy_consumable', { p_game_id: 'natural-disaster-survival', p_item_id: 'apple', p_ref: 'round7:apple:1' });
  assert.deepEqual([a1.ok, a1.price, a1.coins], [true, 10, 40]);
  const a2 = await rpc(db, u, 'buy_consumable', { p_game_id: 'natural-disaster-survival', p_item_id: 'apple', p_ref: 'round7:apple:1' });
  assert.deepEqual([a2.ok, a2.duplicate, a2.coins], [true, true, 40]);                                   // retry is free
  assert.equal((await rpc(db, u, 'buy_consumable', { p_game_id: 'natural-disaster-survival', p_item_id: 'biggerStorm', p_ref: 'round7:storm' })).coins, 15);
  assert.equal((await rpc(db, u, 'buy_consumable', { p_game_id: 'natural-disaster-survival', p_item_id: 'biggerStorm', p_ref: 'round8:storm' })).reason, 'insufficient_funds');
  assert.equal((await rpc(db, u, 'buy_consumable', { p_game_id: 'natural-disaster-survival', p_item_id: 'goldenApple', p_ref: 'round8:x' })).reason, 'unknown_item');
  assert.equal((await rpc(db, u, 'buy_consumable', { p_game_id: 'frost-fields', p_item_id: 'apple', p_ref: 'round8:y' })).reason, 'unknown_item');   // per game
  assert.equal((await rpc(db, u, 'buy_consumable', { p_game_id: 'natural-disaster-survival', p_item_id: 'apple', p_ref: 'x' })).reason, 'invalid_ref');
  await denied(as(db, u, tx => tx.query(`insert into public.game_consumable_purchases (user_id, game_id, item_id, price, ref) values ($1, 'a', 'b', 0, 'zzzz')`, [u])));
  await denied(as(db, u, tx => tx.query(`update public.game_consumable_prices set price = 0`)));
  const led = await su(db, `select sum(delta)::int s from public.wallet_ledger where user_id = $1`, [u]);
  assert.equal(led[0].s, -185);                                                                          // 150 + 10 + 25
});


await t("quests: Game Maker format (reward/event/maxPerMinute) syncs; per-minute cap -> too_fast, next minute ok", async () => {
  const d = (await su(db, `select reward_item_id, event_id, max_per_minute, min_interval_ms, max_per_hour, description from public.quest_defs where quest_id = 'nd_quest_birg_hq'`))[0];
  assert.deepEqual(d, { reward_item_id: 'meteor_pet', event_id: 'natural_disasters', max_per_minute: 10, min_interval_ms: 0, max_per_hour: 600, description: 'Find the 5 frozen meteor shards hidden in the cabin.' });
  const u = await createUser(db, { username: 'ev_minute' });
  let ok = 0, last;
  for (let i = 0; i < 12; i++) { last = await rpc(db, u, 'quest_progress', { p_quest_id: 'nd_quest_birg_hq', p_delta: 1 }); if (last.ok) ok += last.added; }
  assert.equal(ok, 10); assert.equal(last.reason, 'too_fast'); assert.ok(last.retryAfterMs > 0 && last.retryAfterMs <= 60000);
  await su(db, `update public.quest_progress set minute_start = minute_start - interval '61 seconds' where user_id = $1`, [u]);
  assert.equal((await rpc(db, u, 'quest_progress', { p_quest_id: 'nd_quest_birg_hq', p_delta: 1 })).added, 1);
  assert.equal((await rpc(db, null, 'get_quests', { p_game_id: 'birg-hq' }))[0].description, 'Find the 5 frozen meteor shards hidden in the cabin.');
});

await t('events: event_status (anon, serverNow), admin-only window, quest window = narrower of quest + event; before / during / after / grace / after grace', async () => {
  // a separate test event + quest so the ND fixtures stay untouched
  await su(db, `insert into public.game_events (id, title, starts_at, ends_at) values ('zz_hunt', 'ZZ Hunt', now() + interval '1 day', now() + interval '8 days')`);
  await su(db, `insert into public.quest_defs (quest_id, game_id, title, goal, reward_item_id, event_id, min_interval_ms, ends_at) values ('zz_hunt_q', 'frost-fields', 'Hunt', 2, 'lightning_back', 'zz_hunt', 0, now() + interval '5 days')`);
  // writes: no direct table writes; set_event_window is admin-only
  const usr = await createUser(db, { username: 'zz_hunter_1' }), u2 = await createUser(db, { username: 'zz_hunter_2' }), u3 = await createUser(db, { username: 'zz_hunter_3' });
  await denied(as(db, usr, tx => tx.query(`update public.game_events set ends_at = now() + interval '99 days' where id = 'zz_hunt'`)));
  await denied(as(db, usr, tx => tx.query(`insert into public.game_events (id, title) values ('zz_x', 'x')`)));
  await denied(rpc(db, usr, 'set_event_window', { p_event_id: 'zz_hunt', p_starts_at: null, p_ends_at: null }));
  await denied(rpc(db, null, 'set_event_window', { p_event_id: 'zz_hunt', p_starts_at: null, p_ends_at: null }));
  const setWin = (s0, e0) => su(db, `update public.game_events set starts_at = now() + interval '${s0}', ends_at = now() + interval '${e0}' where id = 'zz_hunt'`);
  // BEFORE start
  let st = await rpc(db, null, 'event_status', { p_event_id: 'zz_hunt' });
  assert.equal(st.active, false); assert.equal(st.title, 'ZZ Hunt'); assert.ok(Math.abs(Date.parse(st.serverNow) - Date.now()) < 60e3);
  assert.ok(Date.parse(st.endsAt) - Date.parse(st.serverNow) > 7 * 86400e3);
  assert.equal((await rpc(db, usr, 'quest_progress', { p_quest_id: 'zz_hunt_q', p_delta: 1 })).reason, 'event_not_started');
  let q = (await rpc(db, null, 'get_quests', { p_game_id: 'frost-fields' })).find(x => x.id === 'zz_hunt_q');
  assert.equal(q.live, false); assert.equal(q.eventId, 'zz_hunt');                                   // upcoming: listed, not live
  assert.equal((await rpc(db, usr, 'claim_quest_reward', { p_quest_id: 'zz_hunt_q' })).reason, 'not_complete');
  { const n = await rpc(db, null, 'event_status', { p_event_id: 'nope' }); assert.equal(n.active, false); assert.equal(n.unknown, true); assert.ok(n.serverNow); }
  // DURING (event: -1d..+7d, quest own end +5d -> effective end = quest's)
  await setWin('-1 day', '7 days');
  st = await rpc(db, null, 'event_status', { p_event_id: 'zz_hunt' }); assert.equal(st.active, true);
  q = (await rpc(db, usr, 'get_quests', { p_game_id: 'frost-fields' })).find(x => x.id === 'zz_hunt_q');
  const qEnd = (await su(db, `select ends_at from public.quest_defs where quest_id = 'zz_hunt_q'`))[0].ends_at;
  assert.equal(q.live, true); assert.equal(Date.parse(q.endsAt), qEnd.getTime()); assert.equal(Date.parse(q.startsAt), st.startsAt && Date.parse(st.startsAt));
  for (const u of [usr, usr, u3, u3]) assert.equal((await rpc(db, u, 'quest_progress', { p_quest_id: 'zz_hunt_q', p_delta: 1 })).ok, true);   // usr + u3 complete
  assert.equal((await rpc(db, u2, 'quest_progress', { p_quest_id: 'zz_hunt_q', p_delta: 1 })).ok, true);                                // u2: 1/2
  // narrower: event ends before the quest's own end
  await setWin('-1 day', '2 days');
  q = (await rpc(db, null, 'get_quests', { p_game_id: 'frost-fields' })).find(x => x.id === 'zz_hunt_q');
  assert.equal(Date.parse(q.endsAt), Date.parse((await rpc(db, null, 'event_status', { p_event_id: 'zz_hunt' })).endsAt));
  // AFTER end, inside the 24 h grace: no more progress; completed quests still claim
  await setWin('-3 days', '-1 hour');
  assert.equal((await rpc(db, null, 'event_status', { p_event_id: 'zz_hunt' })).active, false);
  assert.equal((await rpc(db, u2, 'quest_progress', { p_quest_id: 'zz_hunt_q', p_delta: 1 })).reason, 'event_ended');
  assert.equal((await rpc(db, u2, 'claim_quest_reward', { p_quest_id: 'zz_hunt_q' })).reason, 'not_complete');
  q = (await rpc(db, usr, 'get_quests', { p_game_id: 'frost-fields' })).find(x => x.id === 'zz_hunt_q');
  assert.ok(q && q.completed && !q.live && Date.parse(q.claimUntil) > Date.now());                     // still listed for claiming
  const c = await rpc(db, usr, 'claim_quest_reward', { p_quest_id: 'zz_hunt_q' });
  assert.equal(c.granted, true); assert.equal(c.itemId, 'lightning_back');
  // AFTER grace: claims refused with event_ended; granted items stay owned; nothing listed
  await setWin('-9 days', '-25 hours');
  assert.deepEqual(await rpc(db, u3, 'claim_quest_reward', { p_quest_id: 'zz_hunt_q' }), { granted: false, reason: 'event_ended', itemId: 'lightning_back' });
  assert.equal((await rpc(db, u2, 'claim_quest_reward', { p_quest_id: 'zz_hunt_q' })).reason, 'event_ended');
  assert.equal((await rpc(db, usr, 'claim_quest_reward', { p_quest_id: 'zz_hunt_q' })).alreadyClaimed, true);
  assert.ok((await rpc(db, usr, 'get_my_profile')).owned.includes('lightning_back'));                 // never revoked
  assert.ok(!(await rpc(db, u3, 'get_quests', { p_game_id: 'frost-fields' })).some(x => x.id === 'zz_hunt_q'));
  // admin sets/extends via RPC; script SQL extends ends_at
  const adm = await createUser(db, { username: 'zz_evadm' });
  await su(db, `update public.profiles set is_admin = true where id = $1`, [adm]);
  const s1 = await rpc(db, adm, 'set_event_window', { p_event_id: 'zz_hunt', p_starts_at: new Date(Date.now() - 3600e3).toISOString(), p_ends_at: new Date(Date.now() + 7 * 86400e3).toISOString() });
  assert.equal(s1.ok, true); assert.equal(s1.status.active, true);
  assert.equal((await rpc(db, adm, 'set_event_window', { p_event_id: 'nope', p_starts_at: null, p_ends_at: null })).reason, 'unknown_event');
  const { eventWindowSQL } = await import(resolve(ROOT, 'scripts/event-window.mjs'));
  const before = Date.parse((await rpc(db, null, 'event_status', { p_event_id: 'zz_hunt' })).endsAt);
  await db.exec(eventWindowSQL('zz_hunt', { extendDays: 2 }));
  assert.equal(Date.parse((await rpc(db, null, 'event_status', { p_event_id: 'zz_hunt' })).endsAt) - before, 2 * 86400e3);
  await db.exec(eventWindowSQL('zz_hunt', { active: false }));
  assert.equal((await rpc(db, null, 'event_status', { p_event_id: 'zz_hunt' })).active, false);           // paused by flag
  assert.equal((await rpc(db, u2, 'quest_progress', { p_quest_id: 'zz_hunt_q', p_delta: 1 })).reason, 'event_ended');
  assert.throws(() => eventWindowSQL("x'; drop table y; --", {}));
  await su(db, `delete from public.quest_defs where quest_id = 'zz_hunt_q' and not exists (select 1 from public.quest_progress where quest_id = 'zz_hunt_q')`);
});
await t('limited-time shop items: buy_cosmetic sells event items only while the event is live (no grace); owned kept; guest import window', async () => {
  await su(db, `insert into public.game_events (id, title, starts_at, ends_at) values ('zz_sale', 'ZZ Sale', now() + interval '1 day', now() + interval '8 days')`);
  await su(db, `insert into public.catalog_items (id, name, slot, price, event_id) values ('zz_sale_goggles', 'ZZ Goggles', 'hat', 200, 'zz_sale'), ('zz_sale_skates', 'ZZ Skates', 'back', 180, 'zz_sale')`);
  const U = await createUser(db, { username: 'zz_shopper' }), V = await createUser(db, { username: 'zz_shopper2' });
  await su(db, `update public.profiles set coins = 1000 where id = any($1)`, [[U, V]]);
  const setWin = (s0, e0) => su(db, `update public.game_events set starts_at = now() + interval '${s0}', ends_at = now() + interval '${e0}' where id = 'zz_sale'`);
  const coins = async (u) => Number((await su(db, `select coins from public.profiles where id = $1`, [u]))[0].coins);
  let r = await rpc(db, U, 'buy_cosmetic', { p_item_id: 'zz_sale_goggles' });
  assert.equal(r.ok, false); assert.equal(r.reason, 'event_not_started'); assert.equal(r.event, 'zz_sale'); assert.equal(await coins(U), 1000);
  await su(db, `update public.game_events set starts_at = null where id = 'zz_sale'`);          // unscheduled = not started
  assert.equal((await rpc(db, U, 'buy_cosmetic', { p_item_id: 'zz_sale_goggles' })).reason, 'event_not_started');
  await setWin('-1 day', '6 days');
  r = await rpc(db, U, 'buy_cosmetic', { p_item_id: 'zz_sale_goggles' });
  assert.equal(r.ok, true); assert.equal(r.coins, 800);
  assert.equal((await rpc(db, U, 'buy_cosmetic', { p_item_id: 'zz_sale_goggles' })).reason, 'already_owned');
  await su(db, `update public.game_events set active = false where id = 'zz_sale'`);           // paused by admin
  assert.equal((await rpc(db, V, 'buy_cosmetic', { p_item_id: 'zz_sale_goggles' })).reason, 'event_ended');
  await su(db, `update public.game_events set active = true where id = 'zz_sale'`);
  await setWin('-8 days', '-1 hour');                                                          // ended, inside claim grace: no sales
  r = await rpc(db, V, 'buy_cosmetic', { p_item_id: 'zz_sale_skates' });
  assert.equal(r.ok, false); assert.equal(r.reason, 'event_ended'); assert.equal(await coins(V), 1000);
  assert.equal((await rpc(db, U, 'buy_cosmetic', { p_item_id: 'zz_sale_goggles' })).reason, 'already_owned');
  const inv = await su(db, `select item_id from public.inventory where user_id = $1 and item_id = 'zz_sale_goggles'`, [U]);
  assert.equal(inv.length, 1);                                                                  // kept forever
  r = await rpc(db, U, 'save_loadout', { p_equipped: { hat: 'zz_sale_goggles' } });
  assert.equal(r.equipped?.hat ?? r.profile?.equipped?.hat, 'zz_sale_goggles');                // still equippable after the event
  // guest import: limited items only from event start until end + claim grace
  const W = await createUser(db, { username: 'zz_importer' }), X = await createUser(db, { username: 'zz_importer2' });
  r = await rpc(db, W, 'migrate_local_profile', { p_local: { coins: 0, owned: ['zz_sale_skates', 'scarf'] } });
  assert.deepEqual([...r.items].sort(), ['scarf', 'zz_sale_skates']);                         // ended 1 h ago: inside 24 h grace
  await setWin('-9 days', '-2 days');
  r = await rpc(db, X, 'migrate_local_profile', { p_local: { coins: 0, owned: ['zz_sale_skates', 'scarf'] } });
  assert.deepEqual([...r.items], ['scarf']);
  // sync writes event_id from Cosmetics' `event:` field
  const { toSQL, validate } = await import(resolve(ROOT, 'scripts/sync-catalog.mjs'));
  const items = [{ id: 'zz_sale_goggles', name: 'ZZ Goggles', slot: 'hat', price: 200, event: 'zz_sale2', rarity: 'rare' }];
  assert.deepEqual(validate({ items, phrases: [] }), []);
  assert.match(toSQL({ items, phrases: [] }), /insert into public\.game_events \(id, title\) values\n  \('zz_sale2'/);
  assert.deepEqual(validate({ items: [{ ...items[0], event: 'Bad Id!' }], phrases: [] }).length, 1);
});

await t('dev access (0009): is_dev false by default, dev_accounts RLS, admin-only writes, dev-access.mjs SQL', async () => {
  const { devAccessSQL, toUsername } = await import(resolve(ROOT, 'scripts/dev-access.mjs'));
  const D = await createUser(db, { username: 'gooberr478' }), N = await createUser(db, { username: 'zz_nondev' });
  assert.equal(await rpc(db, null, 'is_dev'), false);                                          // anon
  assert.equal(await rpc(db, N, 'is_dev'), false);
  assert.equal(await rpc(db, D, 'is_dev'), false);
  // clients can never write the table
  await denied(as(db, N, tx => tx.query(`insert into public.dev_accounts (user_id) values ($1)`, [N])));
  await denied(as(db, D, tx => tx.query(`insert into public.dev_accounts (user_id) values ($1)`, [D])));
  await denied(as(db, null, tx => tx.query(`select * from public.dev_accounts`)));
  await denied(rpc(db, N, 'set_dev_account', { p_username: 'zz_nondev', p_on: true }));      // not admin
  await denied(rpc(db, null, 'set_dev_account', { p_username: 'zz_nondev', p_on: true }));
  // script (runs as the DB owner via the Management API): username and synthetic email both resolve
  assert.equal(toUsername('GooBerr478@users.iceberg.invalid'), 'gooberr478');
  assert.throws(() => toUsername('bad name'));
  let r = (await su(db, devAccessSQL('add', 'gooberr478', { note: "Colin's account" })))[0];
  assert.deepEqual([r.found, Number(r.changed)], [true, 1]);
  r = (await su(db, devAccessSQL('add', 'gooberr478@users.iceberg.test')))[0];                 // idempotent, note kept
  assert.deepEqual([r.found, Number(r.changed)], [true, 1]);
  r = (await su(db, devAccessSQL('add', 'nobody_here')))[0];
  assert.deepEqual([r.found, Number(r.changed)], [false, 0]);
  assert.equal(await rpc(db, D, 'is_dev'), true);
  assert.equal(await rpc(db, N, 'is_dev'), false);
  // RLS: a dev reads only their own row; others read nothing
  assert.equal((await as(db, D, tx => tx.query(`select note from public.dev_accounts`))).rows.map(x => x.note).join(), "Colin's account");
  assert.equal((await as(db, N, tx => tx.query(`select * from public.dev_accounts`))).rows.length, 0);
  await denied(as(db, D, tx => tx.query(`delete from public.dev_accounts where user_id = $1`, [D])));
  await denied(as(db, D, tx => tx.query(`update public.dev_accounts set note = 'x'`)));
  // admins count as devs and can manage the list through the RPC
  const C = await createUser(db, { username: 'zz_boss_dev' });
  assert.equal(await rpc(db, C, 'is_dev'), false);
  await su(db, `update public.profiles set is_admin = true where id = $1`, [C]);                 // SQL editor, as for featured games
  assert.equal(await rpc(db, C, 'is_dev'), true);
  assert.equal((await rpc(db, C, 'set_dev_account', { p_username: 'zz_nondev', p_on: true, p_note: 'tester' })).ok, true);
  assert.equal(await rpc(db, N, 'is_dev'), true);
  assert.equal((await rpc(db, C, 'set_dev_account', { p_username: 'zz_nondev', p_on: false })).ok, true);
  assert.equal(await rpc(db, N, 'is_dev'), false);
  assert.equal((await rpc(db, C, 'set_dev_account', { p_username: 'no_such_one', p_on: true })).reason, 'no_such_user');
  const list = (await su(db, devAccessSQL('list'))).filter(x => ['gooberr478', 'zz_boss_dev', 'zz_nondev'].includes(x.username));
  assert.deepEqual(list.map(x => [x.username, x.source]), [['gooberr478', 'dev_accounts'], ['zz_boss_dev', 'admin']]);
  assert.ok(!JSON.stringify(list).includes(D));                                                // no ids in output
  r = (await su(db, devAccessSQL('remove', 'gooberr478')))[0];
  assert.deepEqual([r.found, Number(r.changed)], [true, 1]);
  assert.equal(await rpc(db, D, 'is_dev'), false);
  assert.throws(() => devAccessSQL('drop', 'x'));
  // additive: re-running the migration is a no-op
  const { readFileSync } = await import('node:fs');
  await db.exec(readFileSync(resolve(ROOT, 'supabase/migrations/20261018000009_dev_access.sql'), 'utf8'));
});
await t("game_earn 'disaster_survival' (0010): 5 BB per round paid, max 9 per call, 100 per day", async () => {
  const U = await createUser(db, { username: 'zz_nds_earn' });
  let r = await rpc(db, U, 'game_earn', { p_source: 'disaster_survival', p_amount: 5, p_reason: 'Natural Disaster Survival round survived' });
  assert.equal(r.granted, 5);
  r = await rpc(db, U, 'game_earn', { p_source: 'disaster_survival', p_amount: 50 });
  assert.equal(r.granted, 9); assert.equal(r.capped, true);
  for (let i = 0; i < 30; i++) r = await rpc(db, U, 'game_earn', { p_source: 'disaster_survival', p_amount: 5 });
  assert.equal(r.granted, 0);
  assert.equal(Number((await su(db, `select coins from public.profiles where id = $1`, [U]))[0].coins), 100);
});

await t('bans (0012): dev-only ban/unban, cannot ban a dev, is_banned, chat/mp/earn refused, spending ok', async () => {
  const D = await createUser(db, { username: 'zz_ban_dev' }), V = await createUser(db, { username: 'zz_ban_victim' }), O = await createUser(db, { username: 'zz_ban_other' });
  await su(db, `insert into public.dev_accounts (user_id) values ($1)`, [D]);
  assert.equal((await rpc(db, O, 'ban_user', { p_username: 'zz_ban_victim' })).reason, 'not_dev');
  assert.equal((await rpc(db, D, 'ban_user', { p_username: 'zz_ban_dev' })).reason, 'cannot_ban_dev');
  assert.equal((await rpc(db, D, 'ban_user', { p_username: 'nobody_here' })).reason, 'no_such_user');
  assert.equal(await rpc(db, V, 'is_banned'), false);
  assert.equal((await rpc(db, V, 'game_earn', { p_source: 'coin', p_amount: 5 })).granted, 5);
  assert.equal((await rpc(db, D, 'ban_user', { p_username: 'ZZ_Ban_Victim', p_reason: 'test' })).ok, true);
  assert.equal(await rpc(db, V, 'is_banned'), true); assert.equal(await rpc(db, O, 'is_banned'), false);
  const refused = async (fn, args) => { try { await rpc(db, V, fn, args); return false; } catch (e) { return /banned/.test(e.message); } };
  assert.ok(await refused('game_earn', { p_source: 'coin', p_amount: 5 }), 'earn');
  assert.ok(await refused('mp_join', { p_game_id: 'giant-rainbow-obby' }), 'mp_join');
  assert.ok(await refused('claim_daily_bonus', {}), 'daily');
  const ph = (await su(db, `select id from public.chat_phrases limit 1`))[0].id;
  assert.ok(await refused('post_chat', { p_room: 'lobby', p_phrase_id: ph }), 'chat');
  assert.equal((await rpc(db, O, 'game_earn', { p_source: 'coin', p_amount: 5 })).granted, 5);   // others unaffected
  assert.equal((await rpc(db, O, 'unban_user', { p_username: 'zz_ban_victim' })).reason, 'not_dev');
  assert.equal((await rpc(db, D, 'unban_user', { p_username: 'zz_ban_victim' })).ok, true);
  assert.equal(await rpc(db, V, 'is_banned'), false);
  assert.equal((await rpc(db, V, 'game_earn', { p_source: 'coin', p_amount: 5 })).granted, 5);
  await denied(as(db, V, tx => tx.query('select * from public.bans')));
});

await db.close();
for (const r of results) console.log(r[0], r[1], r[2] ? '\n     ' + r[2] : '');
const failed = results.filter(r => r[0] === 'FAIL').length;
console.log(`\n${results.length - failed}/${results.length} DB tests passed (real Postgres via PGlite)`);
process.exit(failed ? 1 : 0);
