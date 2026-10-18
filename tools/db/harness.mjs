// PGlite harness: a real Postgres 16 (WASM) with the Supabase auth stub + our migrations.
import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

export async function createDb({ dataDir, seed = true, runMigrations = true } = {}) {
  const db = new PGlite(dataDir);
  await db.waitReady;
  const fresh = !(await db.query(`select 1 from pg_namespace where nspname = 'auth'`)).rows.length;
  if (fresh) await db.exec(readFileSync(resolve(ROOT, 'tools/db/auth_stub.sql'), 'utf8'));
  if (runMigrations) await migrate(db);
  if (seed) await syncCatalog(db);
  return db;
}

export async function migrate(db) {
  await db.exec(`create table if not exists public._migrations (name text primary key, applied_at timestamptz default now())`);
  const done = new Set((await db.query('select name from public._migrations')).rows.map(r => r.name));
  const dir = resolve(ROOT, 'supabase/migrations');
  const applied = [];
  for (const f of readdirSync(dir).filter(f => f.endsWith('.sql')).sort()) {
    if (done.has(f)) continue;
    await db.exec(readFileSync(resolve(dir, f), 'utf8'));
    await db.query('insert into public._migrations (name) values ($1)', [f]);
    applied.push(f);
  }
  return applied;
}

export async function syncCatalog(db) {
  const { loadSources, validate, toSQL } = await import(resolve(ROOT, 'scripts/sync-catalog.mjs'));
  const src = await loadSources(ROOT);
  const errs = validate(src);
  if (errs.length) throw new Error('catalog invalid: ' + errs.join('; '));
  await db.exec(toSQL(src));
  return src;
}

/** Create an auth user the way GoTrue does (fires the profile trigger). */
export async function createUser(db, { username, email, password = null, displayName } = {}) {
  const id = randomUUID();
  await db.query(`insert into auth.users (id, email, encrypted_password, raw_user_meta_data) values ($1, $2, $3, $4)`,
    [id, email || `${username}@users.iceberg.test`, password, JSON.stringify({ username, display_name: displayName })]);
  return id;
}

/** Run fn(tx) as `role` with auth.uid() = uid, exactly like PostgREST does per request. */
export async function as(db, uid, fn, role = uid ? 'authenticated' : 'anon') {
  return db.transaction(async (tx) => {
    await tx.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify(uid ? { sub: uid, role } : { role })]);
    await tx.exec(`set local role ${role}`);
    return fn(tx);
  });
}

/** Call an RPC with named args as a user; returns the JSON result. */
export async function rpc(db, uid, fn, args = {}) {
  if (!/^[a-z_][a-z0-9_]*$/.test(fn)) throw new Error('bad fn');
  const names = Object.keys(args);
  const sql = `select public.${fn}(${names.map((n, i) => `${n} => $${i + 1}`).join(', ')}) as r`;
  const vals = names.map(n => (args[n] !== null && typeof args[n] === 'object') ? JSON.stringify(args[n]) : args[n]);
  return as(db, uid, async (tx) => (await tx.query(sql, vals)).rows[0].r);
}

/** Supabase Realtime Authorization, as Realtime does it on channel join: as the user, with
 *  realtime.topic() = topic, try to insert + read a realtime.messages row under RLS (rolled back). */
export async function canUseTopic(db, uid, topic, extension = 'broadcast') {
  try {
    return await db.transaction(async (tx) => {
      await tx.query(`select set_config('request.jwt.claims', $1, true), set_config('realtime.topic', $2, true)`, [JSON.stringify(uid ? { sub: uid, role: 'authenticated' } : { role: 'anon' }), topic]);
      await tx.exec(`set local role ${uid ? 'authenticated' : 'anon'}`);
      await tx.query(`insert into realtime.messages (topic, extension, event) values ($1, $2, 'join-check')`, [topic, extension]);
      const ok = (await tx.query(`select exists (select 1 from realtime.messages where topic = $1 and extension = $2) ok`, [topic, extension])).rows[0].ok;
      await tx.rollback();
      return ok;
    });
  } catch { return false; }
}
