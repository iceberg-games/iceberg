#!/usr/bin/env node
// Generates the server price table + Safe Chat phrase table from the source of truth:
//   src/data/cosmetics.js  -> public.catalog_items (id, name, slot, price, premium, customizable)
//   src/data/safeChat.js   -> public.chat_phrases  (id, section, text)
//   src/games/*/config.js  -> public.game_gear_prices (game_id, gear_id, price)
//                             (a game folder's config.js exporting GAME_ID + GEAR_PRICES_BB)
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
  const gears = [];
  const gamesDir = resolve(root, 'src/games');
  for (const d of readdirSync(gamesDir, { withFileTypes: true })) {
    const cfg = resolve(gamesDir, d.name, 'config.js');
    if (!d.isDirectory() || !existsSync(cfg)) continue;
    const m = await import(pathToFileURL(cfg).href + bust);
    if (!m.GAME_ID || !m.GEAR_PRICES_BB) continue;
    for (const [gearId, price] of Object.entries(m.GEAR_PRICES_BB)) gears.push({ gameId: m.GAME_ID, gearId, price, from: `src/games/${d.name}/config.js` });
  }
  const games = await loadGames(root, bust, gears);
  const featuredFile = resolve(root, 'site/public/featured.json');
  const featured = existsSync(featuredFile) ? (JSON.parse(readFileSync(featuredFile, 'utf8')).featured || []) : [];
  return { items: COSMETICS, phrases: PHRASES, gears, games, featured };
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

export function validate({ items, phrases, gears = [], games = [], featured = [] }) {
  const errs = [];
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
    if (!Number.isInteger(c?.price) || c.price < 0) errs.push(`item ${c?.id}: price must be a non-negative integer (got ${c?.price})`);
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

export function toSQL({ items, phrases, gears = [], games = [], featured = [] }) {
  const rows = items.map(c => `  (${q(c.id)}, ${q(c.name)}, ${q(c.slot)}, ${c.price}, ${!!c.premium}, ${!!c.customizable}, true)`);
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
insert into public.catalog_items (id, name, slot, price, premium, customizable, active) values
${rows.join(',\n')}
on conflict (id) do update set name = excluded.name, slot = excluded.slot, price = excluded.price,
  premium = excluded.premium, customizable = excluded.customizable, active = true, updated_at = now()
  where (catalog_items.name, catalog_items.slot, catalog_items.price, catalog_items.premium, catalog_items.customizable, catalog_items.active)
    is distinct from (excluded.name, excluded.slot, excluded.price, excluded.premium, excluded.customizable, true);
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
  if (args.includes('--check')) { console.log(`catalog OK: ${src.items.length} items, ${src.phrases.length} phrases, ${src.gears.length} gears, ${src.games.length} games, ${src.featured.length} featured (${src.games.map(g => g.id + (g.active ? '' : ' [retired]') + ' ← ' + g.from).join('; ')})`); return; }
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
