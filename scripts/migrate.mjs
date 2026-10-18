#!/usr/bin/env node
// Apply supabase/migrations (in filename order, each once) and the catalog/gear/phrase sync.
//   node scripts/migrate.mjs --local .devdb            # PGlite data dir (dev backend), creates it if needed
//   SUPABASE_DB_URL=postgres://... node scripts/migrate.mjs --remote [--dry-run]
// --remote uses psql and records applied files in public._migrations (same as the local harness).
// For Supabase you can equally use the Supabase CLI: `supabase db push` (see DEPLOY.md).
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, writeFileSync, mkdtempSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const dir = resolve(ROOT, 'supabase/migrations');
const files = readdirSync(dir).filter(f => f.endsWith('.sql')).sort();

if (args.includes('--local')) {
  const dataDir = resolve(ROOT, args[args.indexOf('--local') + 1] || '.devdb');
  const { createDb, migrate, syncCatalog } = await import(resolve(ROOT, 'tools/db/harness.mjs'));
  const db = await createDb({ dataDir, seed: false, runMigrations: false });
  const applied = await migrate(db);
  const src = await syncCatalog(db);
  console.log(`local db ${dataDir}: ${applied.length ? 'applied ' + applied.join(', ') : 'migrations up to date'}; synced ${src.items.length} items, ${src.gears.length} gears, ${src.phrases.length} phrases`);
  await db.close();
} else if (args.includes('--remote')) {
  const url = process.env.SUPABASE_DB_URL;
  if (!url) { console.error('Set SUPABASE_DB_URL (Supabase → Project Settings → Database → connection string).'); process.exit(1); }
  const psql = (sql) => execFileSync('psql', [url, '-v', 'ON_ERROR_STOP=1', '-qAt', '-c', sql], { encoding: 'utf8' });
  psql('create table if not exists public._migrations (name text primary key, applied_at timestamptz default now()); alter table public._migrations enable row level security;');
  const done = new Set(psql('select name from public._migrations').split('\n').filter(Boolean));
  const todo = files.filter(f => !done.has(f));
  console.log(todo.length ? `pending: ${todo.join(', ')}` : 'migrations up to date');
  if (args.includes('--dry-run')) process.exit(0);
  for (const f of todo) {
    const tmp = join(mkdtempSync(join(tmpdir(), 'mig-')), f);
    writeFileSync(tmp, `begin;\n${readFileSync(resolve(dir, f), 'utf8')}\ninsert into public._migrations (name) values ('${f}');\ncommit;\n`);
    execFileSync('psql', [url, '-v', 'ON_ERROR_STOP=1', '-q', '-f', tmp], { stdio: 'inherit' });
    console.log('applied', f);
  }
  execFileSync('node', [resolve(ROOT, 'scripts/sync-catalog.mjs'), '--apply'], { stdio: 'inherit', env: process.env });
} else if (args.includes('--mgmt-api')) {
  // Same as --remote, but over HTTPS via the Supabase Management API (for networks that block
  // Postgres ports). Needs SUPABASE_ACCESS_TOKEN (personal access token) + SUPABASE_PROJECT_REF.
  const { mgmtQuery } = await import('./supabase-mgmt.mjs');
  await mgmtQuery('create table if not exists public._migrations (name text primary key, applied_at timestamptz default now()); alter table public._migrations enable row level security;');
  const done = new Set((await mgmtQuery('select name from public._migrations')).map(r => r.name));
  const todo = files.filter(f => !done.has(f));
  console.log(todo.length ? `pending: ${todo.join(', ')}` : 'migrations up to date');
  if (args.includes('--dry-run')) process.exit(0);
  for (const f of todo) {
    await mgmtQuery(`begin;\n${readFileSync(resolve(dir, f), 'utf8')}\ninsert into public._migrations (name) values ('${f}');\ncommit;`);
    console.log('applied', f);
  }
  const { loadSources, validate, toSQL } = await import('./sync-catalog.mjs');
  const src = await loadSources(); const errs = validate(src);
  if (errs.length) { console.error(errs.join('\n')); process.exit(1); }
  await mgmtQuery(toSQL(src));
  console.log(`synced ${src.items.length} items, ${src.gears.length} gears, ${src.phrases.length} phrases, ${src.games.length} games, ${src.featured.length} featured`);
} else {
  console.log('usage: migrate.mjs --local <dataDir> | --remote [--dry-run] | --mgmt-api [--dry-run]'); process.exit(1);
}
