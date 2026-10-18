#!/usr/bin/env node
// Database backups.
//   node scripts/db-backup.mjs --local .devdb [--out /workspace/backups]     PGlite dev db -> .tar.gz (restorable)
//   SUPABASE_DB_URL=postgres://... node scripts/db-backup.mjs --remote       pg_dump of the public schema data + schema
//   node scripts/db-backup.mjs --restore-local <file.tar.gz> <dataDir>       restore a local dump into a new data dir
// Supabase free tier has no automatic point-in-time backups; run --remote on a schedule (DEPLOY.md).
import { execFileSync } from 'node:child_process';
import { writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
const outDir = resolve(opt('--out', process.env.BACKUP_DIR || '/workspace/backups'));
const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
mkdirSync(outDir, { recursive: true });

if (args.includes('--local')) {
  const { PGlite } = await import(resolve(ROOT, 'tools/db/node_modules/@electric-sql/pglite/dist/index.js'));
  const db = new PGlite(resolve(ROOT, opt('--local', '.devdb')));
  await db.waitReady;
  const blob = await db.dumpDataDir('gzip');
  const file = resolve(outDir, `iceberg-devdb-${stamp}.tar.gz`);
  writeFileSync(file, Buffer.from(await blob.arrayBuffer()));
  const n = (await db.query('select count(*)::int n from public.profiles')).rows[0].n;
  await db.close();
  console.log(`local backup: ${file} (${n} profiles)`);
} else if (args.includes('--restore-local')) {
  const [file, dataDir] = [opt('--restore-local'), args[args.indexOf('--restore-local') + 2]];
  const { PGlite } = await import(resolve(ROOT, 'tools/db/node_modules/@electric-sql/pglite/dist/index.js'));
  const db = new PGlite(resolve(dataDir), { loadDataDir: new Blob([readFileSync(file)]) });
  await db.waitReady;
  const n = (await db.query('select count(*)::int n from public.profiles')).rows[0].n;
  await db.close();
  console.log(`restored ${file} -> ${dataDir} (${n} profiles)`);
} else if (args.includes('--remote')) {
  const url = process.env.SUPABASE_DB_URL;
  if (!url) { console.error('Set SUPABASE_DB_URL'); process.exit(1); }
  const file = resolve(outDir, `iceberg-supabase-${stamp}.sql`);
  execFileSync('pg_dump', ['--no-owner', '--no-privileges', '--schema=public', '--file', file, url], { stdio: 'inherit' });
  console.log(`remote backup: ${file}  (auth.users is managed by Supabase; export it from the dashboard if needed)`);
} else { console.log('usage: db-backup.mjs --local <dataDir> | --restore-local <file> <dataDir> | --remote'); process.exit(1); }
