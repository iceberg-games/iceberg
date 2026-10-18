#!/usr/bin/env node
// Generates the server price table + Safe Chat phrase table from the source of truth:
//   src/data/cosmetics.js  -> public.catalog_items (id, name, slot, price, premium, customizable)
//   src/data/safeChat.js   -> public.chat_phrases  (id, section, text)
//   src/games/*/config.js  -> public.game_gear_prices (game_id, gear_id, price)
//                             (a game folder's config.js exporting GAME_ID + GEAR_PRICES_BB)
//   src/games/*/config.js  -> public.game_consumable_prices (CONSUMABLE_PRICES_BB: one-use paid items)
//   src/games/**/quests.js, src/games/*.quests.js -> public.quest_defs (QUESTS; see docs/ECONOMY_API.md)
//   cosmetics with earnOnly: true (Cosmetics' field; eventOnly / unlock: 'quest' also accepted) -> catalog_items.grant_only (not buyable)
//   src/data/gameMeta.js   -> public.games (game_id, published_at); built-in games missing
//                             there use the first git commit that added their file
// Items/phrases removed from the source are deactivated (never deleted: ledger/inventory/chat reference them).
//
//   node scripts/sync-catalog.mjs --out supabase/seed_catalog.sql   # write SQL (default: stdout)
//   node scripts/sync-catalog.mjs --check                            # validate only (exit 1 on problems)
//   SUPABASE_DB_URL=postgres://... node scripts/sync-catalog.mjs --apply   # psql -f (deploy step)
// Prices are never hardcoded anywhere else: the client and the server both derive from cosmetics.js.
import { writeFileSync, readdirSync, existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export async function loadSources(root = ROOT) {
  const bust = '?t=' + Date.now();
  const { COSMETICS } = await import(pathToFileURL(resolve(root, 'src/data/cosmetics.js')).href + bust);
  const { PHRASES } = await import(pathToFileURL(resolve(root, 'src/data/safeChat.js')).href + bust);
  const gears = [], consumables = [], quests = [];
  const gamesDir = resolve(root, 'src/games');
  const folderGameId = {};
  for (const d of readdirSync(gamesDir, { withFileTypes: true })) {
    const cfg = resolve(gamesDir, d.name, 'config.js');
    if (!d.isDirectory() || !existsSync(cfg)) continue;
    const m = await import(pathToFileURL(cfg).href + bust);
    if (m.GAME_ID) folderGameId[d.name] = m.GAME_ID;
    if (!m.GAME_ID) continue;
    for (const [gearId, price] of Object.entries(m.GEAR_PRICES_BB || {})) gears.push({ gameId: m.GAME_ID, gearId, price, from: `src/games/${d.name}/config.js` });
    for (const [itemId, price] of Object.entries(m.CONSUMABLE_PRICES_BB || {})) consumables.push({ gameId: m.GAME_ID, itemId, price, from: `src/games/${d.name}/config.js` });
  }
  const questFiles = [];
  for (const d of readdirSync(gamesDir, { withFileTypes: true })) {
    if (d.isDirectory() && existsSync(resolve(gamesDir, d.name, 'quests.js'))) questFiles.push([`src/games/${d.name}/quests.js`, folderGameId[d.name]]);
    else if (d.isFile() && d.name.endsWith('.quests.js')) questFiles.push([`src/games/${d.name}`, null]);
  }
  for (const [rel, dflt] of questFiles) {
    const m = await import(pathToFileURL(resolve(root, rel)).href + bust);
    for (const qd of m.QUESTS || []) quests.push({ ...normalizeQuest(qd), gameId: qd.gameId || m.GAME_ID || dflt, from: rel });
  }
  const games = await loadGames(root, bust, gears);
  const featuredFile = resolve(root, 'site/public/featured.json');
  const featured = existsSync(featuredFile) ? (JSON.parse(readFileSync(featuredFile, 'utf8')).featured || []) : [];
  return { items: COSMETICS, phrases: PHRASES, gears, games, featured, consumables, quests };
}

/** Built-in game ids + publish dates: gameMeta.js first, else first git commit of the game's file. */
async function loadGames(root, bust, gears) {
  const { GAME_META } = await import(pathToFileURL(resolve(root, 'src/data/gameMeta.js')).href + bust);
  const out = new Map(Object.entries(GAME_META).map(([id, m]) => [id, { id, publishedAt: m.publishedAt, active: !m.retired, from: 'gameMeta.js' }]));
  const gamesDir = resolve(root, 'src/games');
  const firstCommit = (file) => { try { return execFileSync('git', ['log', '--diff-filter=A', '--follow', '--format=%aI', '--', file], { cwd: root, encoding: 'utf8' }).trim().split('\n').pop() || null; } catch { return null; } };
  for (const d of readdirSync(gamesDir, { withFileTypes: true })) {
    let file = null, id = null;
    if (d.isFile() && d.name.endsWith('.js') && !['registry.js', 'customGame.js'].includes(d.name)) {
      file = resolve(gamesDir, d.name);
      id = (readFileSync(file, 'utf8').match(/export default \{[\s\S]{0,200}?\bid:\s*'([a-z0-9-]+)'/) || [])[1];
    } else if (d.isDirectory()) {
      const cfg = resolve(gamesDir, d.name, 'config.js');
      file = resolve(gamesDir, d.name, 'index.js');
      if (existsSync(cfg)) id = (readFileSync(cfg, 'utf8').match(/GAME_ID\s*=\s*'([a-z0-9-]+)'/) || [])[1];
    }
    if (!id || out.has(id) || !file || !existsSync(file)) continue;
    const date = firstCommit(file) || new Date().toISOString();
    out.set(id, { id, publishedAt: date, active: true, from: 'git ' + file.slice(root.length + 1) });
  }
  for (const g of gears) if (!out.has(g.gameId)) out.set(g.gameId, { id: g.gameId, publishedAt: new Date().toISOString(), active: true, from: 'gear config' });
  return [...out.values()];
}

/** Accept Game Maker's field names too: reward -> rewardItemId, event -> eventId (snake -> kebab ok),
 *  maxPerMinute -> per-minute cap (then minIntervalMs defaults to 0 and maxPerHour to 60 x maxPerMinute). */
export function normalizeQuest(qd) {
  const o = { ...qd };
  if (o.rewardItemId == null && o.reward != null) o.rewardItemId = o.reward;
  if (o.eventId == null && o.event != null) o.eventId = String(o.event);
  if (o.maxPerMinute != null) { o.minIntervalMs ??= 0; o.maxPerHour ??= Math.min(100000, o.maxPerMinute * 60); }
  return o;
}
export const isGrantOnly = (c) => !!(c && (c.earnOnly || c.eventOnly || c.grantOnly || c.unlock === 'quest'));
const priceOf = (c) => (isGrantOnly(c) && c.price == null ? 0 : c.price);

export function validate({ items, phrases, gears = [], games = [], featured = [], consumables = [], quests = [] }) {
  const errs = [];
  const cseen = new Set();
  for (const c of consumables) {
    if (!/^[a-zA-Z0-9_-]{1,40}$/.test(c.itemId)) errs.push(`bad consumable id ${c.gameId}/${c.itemId} (${c.from})`);
    if (!Number.isInteger(c.price) || c.price < 1) errs.push(`consumable ${c.gameId}/${c.itemId}: price must be a positive integer (${c.from})`);
    const k = c.gameId + '/' + c.itemId; if (cseen.has(k)) errs.push(`duplicate consumable ${k}`); cseen.add(k);
  }
  const qseen = new Set(), byId = new Map(items.map(c => [c?.id, c]));
  const knownGames = new Set([...games.map(g => g.id), ...gears.map(g => g.gameId), ...consumables.map(c => c.gameId)]);
  for (const qd of quests) {
    const w = `quest ${qd.id} (${qd.from})`;
    if (!/^[a-z0-9_]{1,60}$/.test(qd.id || '')) errs.push(`${w}: id must match [a-z0-9_]{1,60}`);
    if (qseen.has(qd.id)) errs.push(`duplicate quest id ${qd.id}`); qseen.add(qd.id);
    if (!qd.gameId || !knownGames.has(qd.gameId)) errs.push(`${w}: unknown gameId ${JSON.stringify(qd.gameId)}`);
    if (!qd.title || qd.title.length > 80) errs.push(`${w}: title must be 1-80 chars`);
    if (!Number.isInteger(qd.goal) || qd.goal < 1 || qd.goal > 100000) errs.push(`${w}: goal must be an integer 1..100000`);
    const item = byId.get(qd.rewardItemId);
    if (!item) errs.push(`${w}: reward cosmetic ${JSON.stringify(qd.rewardItemId)} is not in src/data/cosmetics.js`);
    else if (!isGrantOnly(item)) errs.push(`${w}: reward ${qd.rewardItemId} must be grant-only (set earnOnly: true in cosmetics.js)`);
    else if (item.unlock && item.unlock !== 'quest' && /^[a-z0-9_]{3,64}$/.test(item.unlock) && item.unlock !== qd.id && quests.some(o => o.id === item.unlock)) errs.push(`${w}: reward ${item.id} says unlock: '${item.unlock}' in cosmetics.js but quest ${qd.id} grants it`);
    for (const k of ['startsAt', 'endsAt']) if (qd[k] != null && Number.isNaN(Date.parse(qd[k]))) errs.push(`${w}: bad ${k}`);
    if (qd.startsAt && qd.endsAt && Date.parse(qd.endsAt) <= Date.parse(qd.startsAt)) errs.push(`${w}: endsAt must be after startsAt`);
    for (const [k, lo, hi] of [['maxPerCall', 1, 1000], ['minIntervalMs', 0, 3600000], ['maxPerHour', 1, 100000], ['maxPerMinute', 1, 10000]]) if (qd[k] != null && (!Number.isInteger(qd[k]) || qd[k] < lo || qd[k] > hi)) errs.push(`${w}: ${k} must be an integer ${lo}..${hi}`);
    if (qd.description != null && (typeof qd.description !== 'string' || qd.description.length > 200)) errs.push(`${w}: description must be <= 200 chars`);
    if (qd.eventId != null && !/^[a-z0-9_-]{1,40}$/.test(qd.eventId)) errs.push(`${w}: bad eventId`);
  }
  for (const f of featured) {
    if (!games.some(g => g.id === f.gameId && g.active)) errs.push(`featured.json: unknown or retired game ${JSON.stringify(f.gameId)}`);
    if (f.image && !existsSync(resolve(ROOT, 'site/public', f.image))) errs.push(`featured.json: missing image site/public/${f.image}`);
    if (f.blurb && f.blurb.length > 160) errs.push(`featured.json: blurb too long for ${f.gameId}`);
  }
  const seen = new Set();
  for (const c of items) {
    if (!c || typeof c.id !== 'string' || !/^[a-z0-9_]{1,40}$/.test(c.id)) errs.push(`bad item id: ${JSON.stringify(c && c.id)}`);
    else if (seen.has(c.id)) errs.push(`duplicate item id: ${c.id}`);
    seen.add(c?.id);
    if (!Number.isInteger(priceOf(c)) || priceOf(c) < 0) errs.push(`item ${c?.id}: price must be a non-negative integer (got ${c?.price})`);
    if (!c?.slot) errs.push(`item ${c?.id}: missing slot`);
    if (!c?.name) errs.push(`item ${c?.id}: missing name`);
  }
  const pseen = new Set();
  for (const p of phrases) {
    if (!/^[a-z0-9_.-]{1,64}$/.test(p.id)) errs.push(`bad phrase id: ${p.id}`);
    if (pseen.has(p.id)) errs.push(`duplicate phrase id: ${p.id} ("${p.text}")`);
    pseen.add(p.id);
    if (!p.text || p.text.length > 80) errs.push(`phrase ${p.id}: text must be 1-80 chars`);
  }
  for (const g of games) {
    if (!/^[a-zA-Z0-9_-]{1,40}$/.test(g.id)) errs.push(`bad game id ${g.id}`);
    if (Number.isNaN(Date.parse(g.publishedAt))) errs.push(`game ${g.id}: bad publishedAt ${g.publishedAt} (${g.from})`);
  }
  const gseen = new Set();
  for (const g of gears || []) {
    if (!/^[a-zA-Z0-9_-]{1,40}$/.test(g.gameId) || !/^[a-zA-Z0-9_-]{1,40}$/.test(g.gearId)) errs.push(`bad gear id ${g.gameId}/${g.gearId} (${g.from})`);
    if (!Number.isInteger(g.price) || g.price < 0) errs.push(`gear ${g.gameId}/${g.gearId}: price must be a non-negative integer (${g.from})`);
    const k = g.gameId + '/' + g.gearId; if (gseen.has(k)) errs.push(`duplicate gear ${k}`); gseen.add(k);
  }
  return errs;
}

const q = (s) => "'" + String(s).replace(/'/g, "''") + "'";

export function toSQL({ items, phrases, gears = [], games = [], featured = [], consumables = [], quests = [] }) {
  const rows = items.map(c => `  (${q(c.id)}, ${q(c.name)}, ${q(c.slot)}, ${priceOf(c)}, ${!!c.premium}, ${!!c.customizable}, ${isGrantOnly(c)}, true)`);
  const ts = (v) => (v == null ? 'null' : q(new Date(v).toISOString()));
  const games_sql = games.length ? `
insert into public.games (game_id, published_at, active) values
${games.map(g => `  (${q(g.id)}, ${q(g.publishedAt)}, ${!!g.active})`).join(',\n')}
on conflict (game_id) do update set published_at = excluded.published_at, active = excluded.active, updated_at = now()
  where (games.published_at, games.active) is distinct from (excluded.published_at, excluded.active);
update public.games set active = false, updated_at = now() where active and game_id not in (${games.map(g => q(g.id)).join(', ')});` : '';
  const prow = phrases.map(p => `  (${q(p.id)}, ${q(p.section)}, ${q(p.text)}, true)`);
  return `-- GENERATED by scripts/sync-catalog.mjs from src/data/cosmetics.js + src/data/safeChat.js. Do not edit.
-- ${items.length} catalog items, ${phrases.length} safe-chat phrases, ${gears.length} game gears, ${games.length} games.
begin;
insert into public.catalog_items (id, name, slot, price, premium, customizable, grant_only, active) values
${rows.join(',\n')}
on conflict (id) do update set name = excluded.name, slot = excluded.slot, price = excluded.price,
  premium = excluded.premium, customizable = excluded.customizable, grant_only = excluded.grant_only, active = true, updated_at = now()
  where (catalog_items.name, catalog_items.slot, catalog_items.price, catalog_items.premium, catalog_items.customizable, catalog_items.grant_only, catalog_items.active)
    is distinct from (excluded.name, excluded.slot, excluded.price, excluded.premium, excluded.customizable, excluded.grant_only, true);
update public.catalog_items set active = false, updated_at = now()
  where active and id not in (${items.map(c => q(c.id)).join(', ')});

insert into public.chat_phrases (id, section, text, active) values
${prow.join(',\n')}
on conflict (id) do update set section = excluded.section, text = excluded.text, active = true, updated_at = now()
  where (chat_phrases.section, chat_phrases.text, chat_phrases.active) is distinct from (excluded.section, excluded.text, true);
update public.chat_phrases set active = false, updated_at = now()
  where active and id not in (${phrases.map(p => q(p.id)).join(', ')});
${gears.length ? `
insert into public.game_gear_prices (game_id, gear_id, price, active) values
${gears.map(g => `  (${q(g.gameId)}, ${q(g.gearId)}, ${g.price}, true)`).join(',\n')}
on conflict (game_id, gear_id) do update set price = excluded.price, active = true, updated_at = now()
  where (game_gear_prices.price, game_gear_prices.active) is distinct from (excluded.price, true);` : ''}
update public.game_gear_prices set active = false, updated_at = now()
  where active and (game_id || '/' || gear_id) not in (${gears.length ? gears.map(g => q(g.gameId + '/' + g.gearId)).join(', ') : "''"});
${games_sql}
${consumables.length ? `
insert into public.game_consumable_prices (game_id, item_id, price, active) values
${consumables.map(c => `  (${q(c.gameId)}, ${q(c.itemId)}, ${c.price}, true)`).join(',\n')}
on conflict (game_id, item_id) do update set price = excluded.price, active = true, updated_at = now()
  where (game_consumable_prices.price, game_consumable_prices.active) is distinct from (excluded.price, true);` : ''}
update public.game_consumable_prices set active = false, updated_at = now()
  where active and (game_id || '/' || item_id) not in (${consumables.length ? consumables.map(c => q(c.gameId + '/' + c.itemId)).join(', ') : "''"});
${quests.some(x => x.eventId) ? `
-- events referenced by quests exist (unscheduled until set with scripts/event-window.mjs; never overwritten here)
insert into public.game_events (id, title) values
${[...new Set(quests.filter(x => x.eventId).map(x => x.eventId))].map(e => `  (${q(e)}, ${q(e.replace(/[_-]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase()))})`).join(',\n')}
on conflict (id) do nothing;` : ''}
${quests.length ? `
insert into public.quest_defs (quest_id, game_id, title, goal, reward_item_id, event_id, starts_at, ends_at, max_per_call, min_interval_ms, max_per_hour, max_per_minute, description, active) values
${quests.map(x => `  (${q(x.id)}, ${q(x.gameId)}, ${q(x.title)}, ${x.goal}, ${q(x.rewardItemId)}, ${x.eventId ? q(x.eventId) : 'null'}, ${ts(x.startsAt)}::timestamptz, ${ts(x.endsAt)}::timestamptz, ${x.maxPerCall ?? 1}, ${x.minIntervalMs ?? 2000}, ${x.maxPerHour ?? 60}, ${x.maxPerMinute ?? 'null'}, ${x.description ? q(x.description) : 'null'}, true)`).join(',\n')}
on conflict (quest_id) do update set game_id = excluded.game_id, title = excluded.title, goal = excluded.goal, reward_item_id = excluded.reward_item_id,
  event_id = excluded.event_id, starts_at = excluded.starts_at, ends_at = excluded.ends_at, max_per_call = excluded.max_per_call,
  min_interval_ms = excluded.min_interval_ms, max_per_hour = excluded.max_per_hour, max_per_minute = excluded.max_per_minute, description = excluded.description, active = true, updated_at = now()
  where (quest_defs.game_id, quest_defs.title, quest_defs.goal, quest_defs.reward_item_id, quest_defs.event_id, quest_defs.starts_at, quest_defs.ends_at,
         quest_defs.max_per_call, quest_defs.min_interval_ms, quest_defs.max_per_hour, quest_defs.max_per_minute, quest_defs.description, quest_defs.active)
    is distinct from (excluded.game_id, excluded.title, excluded.goal, excluded.reward_item_id, excluded.event_id, excluded.starts_at, excluded.ends_at,
         excluded.max_per_call, excluded.min_interval_ms, excluded.max_per_hour, excluded.max_per_minute, excluded.description, true);` : ''}
update public.quest_defs set active = false, updated_at = now()
  where active and quest_id not in (${quests.length ? quests.map(x => q(x.id)).join(', ') : "''"});
${featured.length ? `-- featured banner: seed ONLY when empty (first deploy); afterwards admins own it
insert into public.featured_games (game_id, sort_order, blurb, image)
select v.game_id, v.sort_order, v.blurb, v.image from (values
${featured.map((f, i) => `  (${q(f.gameId)}, ${i + 1}, ${f.blurb ? q(f.blurb) : 'null'}, ${f.image ? q(f.image) : 'null'})`).join(',\n')}
) v(game_id, sort_order, blurb, image)
where not exists (select 1 from public.featured_games) and exists (select 1 from public.games g where g.game_id = v.game_id);` : ''}
commit;
`;
}

async function main() {
  const args = process.argv.slice(2);
  const src = await loadSources();
  const errs = validate(src);
  if (errs.length) { console.error('Catalog problems:\n  ' + errs.join('\n  ')); process.exit(1); }
  if (args.includes('--check')) { console.log(`catalog OK: ${src.items.length} items, ${src.phrases.length} phrases, ${src.gears.length} gears, ${src.games.length} games, ${src.consumables.length} consumables, ${src.quests.length} quests, ${src.featured.length} featured (${src.games.map(g => g.id + (g.active ? '' : ' [retired]') + ' ← ' + g.from).join('; ')})`); return; }
  const sql = toSQL(src);
  const out = args.includes('--out') ? args[args.indexOf('--out') + 1] : null;
  if (out) { writeFileSync(out, sql); console.error(`wrote ${out} (${src.items.length} items, ${src.phrases.length} phrases)`); }
  if (args.includes('--apply')) {
    const url = process.env.SUPABASE_DB_URL;
    if (!url) { console.error('--apply needs SUPABASE_DB_URL'); process.exit(1); }
    execFileSync('psql', [url, '-v', 'ON_ERROR_STOP=1', '-q', '-c', sql], { stdio: 'inherit' });
    console.error('applied catalog to database');
  }
  if (!out && !args.includes('--apply')) process.stdout.write(sql);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
