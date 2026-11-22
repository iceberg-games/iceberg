// Ephemeral check of supabase/migrations/20261122000020_ugc_accessories.sql in an IN-MEMORY PGlite
// (WASM Postgres; no data dir, nothing remote). node tools/db/ugc-test.mjs
import { createDb, createUser, rpc, as } from './harness.mjs';
const db = await createDb();   // in-memory: all migrations + catalog sync
const a = await createUser(db, { username: 'maker', displayName: 'Maker' });
const b = await createUser(db, { username: 'buyer', displayName: 'Buyer' });
await db.query(`update public.profiles set coins = 1000 where id = $1`, [b]);
const spec = { v: 1, template: 'hat', slot: 'hat', parts: [{ p: 'cylinder', pos: [0, 0.9, 0], rot: [0, 0, 0], scl: [0.6, 0.5, 0.6], c: '#26324a', m: 'glossy' }] };
const out = {}; const check = (k, cond, v) => { out[k] = cond ? 'ok' : `FAIL ${JSON.stringify(v)}`; };
let r = await rpc(db, a, 'save_ugc_draft', { p_draft_key: 'd_abc', p_name: 'Topper', p_spec: spec }); check('save_draft', r.ok, r);
const drafts = await as(db, a, async (tx) => (await tx.query('select public.list_my_ugc_drafts() as r')).rows.map(x => x.r)); check('list_drafts', drafts.length === 1, drafts);
const other = await as(db, b, async (tx) => (await tx.query('select count(*)::int n from public.ugc_drafts')).rows[0].n); check('rls_drafts_owner_only', other === 0, other);
r = await rpc(db, a, 'publish_ugc_item', { p_draft_key: 'd_abc', p_name: 'sh1t hat', p_spec: spec, p_price: 150 }); check('reject_bad_name', r.reason === 'bad_name', r);
r = await rpc(db, a, 'publish_ugc_item', { p_draft_key: 'd_abc', p_name: 'Topper', p_spec: spec, p_price: 9999 }); check('reject_price', r.reason === 'bad_price', r);
r = await rpc(db, a, 'publish_ugc_item', { p_draft_key: 'd_abc', p_name: 'Topper', p_spec: { ...spec, parts: [{ ...spec.parts[0], scl: [5, 5, 5] }] }, p_price: 150 }); check('reject_giant', r.reason === 'bad_spec', r);
r = await rpc(db, a, 'publish_ugc_item', { p_draft_key: 'd_abc', p_name: 'Topper', p_spec: { ...spec, parts: Array(25).fill(spec.parts[0]) }, p_price: 150 }); check('reject_25_parts', r.reason === 'bad_spec', r);
r = await rpc(db, a, 'publish_ugc_item', { p_draft_key: 'd_abc', p_name: 'Frostbyte Topper', p_spec: spec, p_price: 150 }); check('publish', r.ok && /^ugc_[a-z0-9]{10}$/.test(r.id), r);
const id = r.id;
const prof = await rpc(db, a, 'get_my_profile'); check('creator_owns_free', prof.owned.includes(id), prof.owned);
const listed = await as(db, null, async (tx) => (await tx.query('select public.list_ugc_items(10) as r')).rows.map(x => x.r)); check('anon_list', listed.length === 1 && listed[0].creator_name === 'Maker', listed);
r = await rpc(db, b, 'buy_cosmetic', { p_item_id: id }); check('buy_cosmetic_refuses_ugc', r.ok === false, r);
r = await rpc(db, b, 'buy_ugc_item', { p_item_id: id }); check('buy', r.ok && r.coins === 850, r);
r = await rpc(db, b, 'buy_ugc_item', { p_item_id: id }); check('no_double_buy', r.reason === 'already_owned', r);
const coinsA = (await db.query('select coins from public.profiles where id = $1', [a])).rows[0].coins; check('creator_share_30pct', Number(coinsA) === 45, coinsA);
r = await rpc(db, b, 'save_loadout', { p_equipped: { hat: id } }); const pb = await rpc(db, b, 'get_my_profile'); check('equip_survives_clean_equipped', pb.equipped.hat === id, pb.equipped);
await db.query(`update public.profiles set coins = 10 where id = $1`, [b]);
const c = await createUser(db, { username: 'poor', displayName: 'Poor' });
r = await rpc(db, c, 'buy_ugc_item', { p_item_id: id }); check('insufficient_funds', r.reason === 'insufficient_funds', r);
const { loadSources, toSQL } = await import('../../scripts/sync-catalog.mjs'); await db.exec(toSQL(await loadSources()));
const act = (await db.query('select active from public.catalog_items where id = $1', [id])).rows[0].active; check('catalog_sync_keeps_ugc_active', act === true, act);
console.log(out); process.exit(Object.values(out).some(v => v !== 'ok') ? 1 : 0);
