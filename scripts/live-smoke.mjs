#!/usr/bin/env node
// Smoke test against a REAL Supabase project over HTTPS (no Postgres port needed).
//   SUPABASE_URL=https://<ref>.supabase.co SUPABASE_ANON_KEY=<anon> \
//   [SUPABASE_ACCESS_TOKEN=<PAT> SUPABASE_PROJECT_REF=<ref>]   # enables schema checks + cleanup
//   node scripts/live-smoke.mjs [--cleanup-only] [--keep]
// Uses ONLY the test accounts zz_test_publisher_1 / zz_test_publisher_2 and deletes ONLY them
// (and their rows, via ON DELETE CASCADE) at the end. Never prints keys or tokens.
import assert from 'node:assert/strict';
const URL_ = (process.env.SUPABASE_URL || '').replace(/\/+$/, ''), ANON = process.env.SUPABASE_ANON_KEY;
const DOMAIN = process.env.VITE_USERNAME_EMAIL_DOMAIN || 'users.iceberg.invalid';
if (!URL_ || !ANON) { console.error('Set SUPABASE_URL and SUPABASE_ANON_KEY'); process.exit(1); }
const TEST = ['zz_test_publisher_1', 'zz_test_publisher_2'];
const PW = 'zz-Test-' + Math.random().toString(36).slice(2, 10) + '!';
const hasMgmt = !!(process.env.SUPABASE_ACCESS_TOKEN && process.env.SUPABASE_PROJECT_REF);
const mgmt = hasMgmt ? await import('./supabase-mgmt.mjs') : null;
let pass = 0, fail = 0;
const check = async (name, fn) => { try { await fn(); pass++; console.log('PASS ', name); } catch (e) { fail++; console.log('FAIL ', name, '\n      ', String(e.message || e).slice(0, 300)); } };

async function http(path, { method = 'POST', body, token, prefer } = {}) {
  const r = await fetch(URL_ + path, { method, headers: { apikey: ANON, authorization: `Bearer ${token || ANON}`, 'content-type': 'application/json', ...(prefer ? { prefer } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
  const t = await r.text(); let j = null; try { j = t ? JSON.parse(t) : null; } catch { j = t; }
  return { status: r.status, ok: r.ok, body: j };
}
const rpc = async (token, fn, args = {}) => { const r = await http(`/rest/v1/rpc/${fn}`, { body: args, token }); if (!r.ok) throw new Error(`${fn} ${r.status} ${JSON.stringify(r.body).slice(0, 200)}`); return r.body; };
const emailOf = (u) => `${u}@${DOMAIN}`;

async function cleanup() {
  if (!mgmt) { console.log('NOTE  cleanup skipped (no SUPABASE_ACCESS_TOKEN): delete users', TEST.map(emailOf).join(', '), 'in Auth → Users'); return; }
  const list = TEST.map(u => `'${emailOf(u)}'`).join(',');
  const [{ n }] = await mgmt.mgmtQuery(`with d as (delete from auth.users where email in (${list}) returning id) select count(*)::int n from d`);
  const [{ left }] = await mgmt.mgmtQuery(`select (select count(*) from auth.users where email in (${list})) + (select count(*) from public.profiles where username in (${TEST.map(u => `'${u}'`).join(',')}))::int as left`);
  console.log(`cleanup: removed ${n} test users; leftover test rows: ${left}`);
  assert.equal(Number(left), 0);
}
if (process.argv.includes('--cleanup-only')) { await cleanup(); process.exit(0); }
await cleanup();   // start clean if a previous run died

if (mgmt) {
  await check('schema: every public table has RLS enabled', async () => {
    const bad = await mgmt.mgmtQuery(`select relname from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity`);
    assert.deepEqual(bad, []);
  });
  await check('schema: all RPCs exist', async () => {
    const want = ['claim_daily_bonus','buy_cosmetic','game_earn','game_spend','get_my_profile','save_loadout','migrate_local_profile','post_chat','get_chat','chat_heartbeat','send_friend_request','respond_friend_request','remove_friend','save_game_data','load_game_data','buy_gear','owns_gear','record_visit','game_heartbeat','game_leave','list_game_stats','list_featured','set_featured_games','username_available'];
    const have = new Set((await mgmt.mgmtQuery(`select proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public'`)).map(r => r.proname));
    assert.deepEqual(want.filter(f => !have.has(f)), []);
  });
  await check('schema: all 6 migrations recorded', async () => assert.equal((await mgmt.mgmtQuery('select count(*)::int n from public._migrations'))[0].n, 6));
}

await check('auth settings: email signup on, "Confirm email" OFF', async () => {
  const s = (await http('/auth/v1/settings', { method: 'GET' })).body;
  assert.equal(s.external?.email, true); assert.equal(s.disable_signup, false);
  assert.equal(s.mailer_autoconfirm, true, 'turn OFF Authentication → Sign In / Providers → Email → "Confirm email"');
});
await check('anon: public reads work (featured, stats, username_available)', async () => {
  assert.ok((await rpc(null, 'list_featured')).length >= 1);
  assert.ok((await rpc(null, 'list_game_stats')).length >= 3);
  assert.equal(await rpc(null, 'username_available', { p_username: TEST[0] }), true);
});
await check('anon: cannot write wallets/profiles/inventory/featured or call player RPCs', async () => {
  for (const [t, row] of [['profiles', { coins: 999999 }], ['wallet_ledger', { delta: 999999 }], ['inventory', { item_id: 'earmuffs' }], ['featured_games', { game_id: 'frost-fields' }], ['catalog_items', { id: 'x', price: 0 }]]) {
    const r = await http(`/rest/v1/${t}`, { body: row, prefer: 'return=minimal' });
    assert.ok(!r.ok, `${t} insert was allowed (${r.status})`);
  }
  const p = await http('/rest/v1/profiles?id=not.is.null', { method: 'PATCH', body: { coins: 999999 }, prefer: 'return=representation' });
  assert.ok(!p.ok || (Array.isArray(p.body) && p.body.length === 0), 'anon PATCH profiles changed rows');
  assert.ok(!(await http('/rest/v1/rpc/claim_daily_bonus', { body: {} })).ok);
  assert.ok(!(await http('/rest/v1/rpc/game_earn', { body: { p_source: 'obby_stage', p_amount: 5 } })).ok);
});

const tok = {};
await check('auth: sign up both test users with username → synthetic email', async () => {
  for (const u of TEST) {
    const r = await http('/auth/v1/signup', { body: { email: emailOf(u), password: PW, data: { username: u, display_name: u } } });
    assert.ok(r.ok, `signup ${u}: ${r.status} ${JSON.stringify(r.body).slice(0, 200)}`);
    assert.ok(r.body.access_token, 'no session returned (Confirm email still on?)');
  }
});
await check('auth: login with password; wrong password rejected', async () => {
  for (const u of TEST) {
    const r = await http('/auth/v1/token?grant_type=password', { body: { email: emailOf(u), password: PW } });
    assert.ok(r.ok, `login ${u} ${r.status}`); tok[u] = r.body.access_token;
  }
  assert.equal((await http('/auth/v1/token?grant_type=password', { body: { email: emailOf(TEST[0]), password: PW + 'x' } })).status, 400);
  const p = await rpc(tok[TEST[0]], 'get_my_profile'); assert.equal(p.username, TEST[0]);
});
const [A, B] = TEST.map(u => () => tok[u]);
await check('economy: daily bonus once per day', async () => {
  const r1 = await rpc(A(), 'claim_daily_bonus'); assert.ok(r1.granted > 0 && r1.coins >= r1.granted, JSON.stringify(r1));
  const r2 = await rpc(A(), 'claim_daily_bonus'); assert.equal(r2.granted, 0, JSON.stringify(r2));
});
await check('economy: user cannot write own coins directly', async () => {
  const before = (await rpc(A(), 'get_my_profile')).coins;
  await http('/rest/v1/profiles?username=eq.' + TEST[0], { method: 'PATCH', body: { coins: 999999 }, token: A() });
  await http('/rest/v1/wallet_ledger', { body: { delta: 999999 }, token: A(), prefer: 'return=minimal' });
  assert.equal((await rpc(A(), 'get_my_profile')).coins, before);
});
await check('economy: game earn (capped) + spend', async () => {
  const e = await rpc(A(), 'game_earn', { p_source: 'obby_stage', p_amount: 5, p_reason: 'live smoke', p_ref: 'zz-live-' + Date.now() });
  assert.ok(e.granted === 5, JSON.stringify(e));
  const s = await rpc(A(), 'game_spend', { p_amount: 3, p_reason: 'live smoke', p_ref: 'zz-live-s-' + Date.now() });
  assert.ok(s.ok && s.coins === e.coins - 3, JSON.stringify(s));
  const big = await rpc(A(), 'game_earn', { p_source: 'obby_stage', p_amount: 100000, p_ref: 'zz-live-big-' + Date.now() });
  assert.ok(big.granted < 100000 && big.coins - s.coins < 100000, 'cap not enforced: ' + JSON.stringify(big));
});
await check('economy: buy cosmetic (server price), not twice, not unaffordable', async () => {
  const items = await mgmt?.mgmtQuery(`select id, price from public.catalog_items where price > 0 order by price limit 1`);
  const item = items?.[0]?.id || 'cocoa_mug';
  const p = await rpc(A(), 'get_my_profile');
  const r = await rpc(A(), 'buy_cosmetic', { p_item_id: item });
  if (p.coins >= (items?.[0]?.price ?? 120)) { assert.ok(r.ok, JSON.stringify(r)); assert.equal((await rpc(A(), 'buy_cosmetic', { p_item_id: item })).ok, false); }
  else assert.equal(r.ok, false);
  assert.equal((await rpc(B(), 'buy_cosmetic', { p_item_id: 'penguin_pal' })).ok, false);   // new user can't afford it
});
await check('chat: safe-chat phrase posts; free text rejected', async () => {
  const room = 'game:zz-live-smoke';
  const r = await rpc(A(), 'post_chat', { p_room: room, p_phrase_id: (await import('../src/data/safeChat.js')).PHRASES[0].id });
  assert.ok(r.ok !== false, JSON.stringify(r));
  const bad = await http('/rest/v1/rpc/post_chat', { body: { p_room: room, p_phrase_id: 'you are dumb' }, token: A() });
  assert.ok(!bad.ok || bad.body?.ok === false);
  const msgs = await rpc(B(), 'get_chat', { p_room: room, p_after_id: 0 });
  assert.ok(JSON.stringify(msgs).includes(TEST[0]));
});
await check('friends: request + accept', async () => {
  assert.ok((await rpc(A(), 'send_friend_request', { p_username: TEST[1] })).ok !== false);
  assert.ok((await rpc(B(), 'respond_friend_request', { p_username: TEST[0], p_accept: true })).ok !== false);
});
await check('game data: save/load, owner-only, gears key stripped', async () => {
  await rpc(A(), 'save_game_data', { p_game_id: 'giant-rainbow-obby', p_data: { stage: 7, gears: ['speed_coil'] } });
  const d = await rpc(A(), 'load_game_data', { p_game_id: 'giant-rainbow-obby' });
  const dd = d.data ?? d; assert.equal(dd.stage, 7); assert.ok(!dd.gears || dd.gears.length === 0, 'client-sent gears were trusted: ' + JSON.stringify(dd.gears));
  const other = await rpc(B(), 'load_game_data', { p_game_id: 'giant-rainbow-obby' });
  assert.ok(other == null || (other.data ?? other) == null || (other.data ?? other).stage === undefined);
  assert.equal(await rpc(A(), 'owns_gear', { p_game_id: 'giant-rainbow-obby', p_gear_id: 'speed_coil' }), false);
});
await check('stats: record visit (deduped) + heartbeat → live player', async () => {
  await rpc(A(), 'record_visit', { p_game_id: 'frost-fields' }); await rpc(A(), 'record_visit', { p_game_id: 'frost-fields' });
  await rpc(A(), 'game_heartbeat', { p_game_id: 'frost-fields' });
  const g = (await rpc(null, 'list_game_stats')).find(x => x.gameId === 'frost-fields');
  assert.ok(g.playing >= 1 && g.visits7d >= 1, JSON.stringify(g));
  await rpc(A(), 'game_leave');
});

if (!process.argv.includes('--keep')) await check('cleanup: only the zz_test_publisher_* users and their rows removed', cleanup);
console.log(`\n${pass}/${pass + fail} live checks passed`);
process.exit(fail ? 1 : 0);
