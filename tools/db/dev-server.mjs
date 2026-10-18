#!/usr/bin/env node
// Local dev backend: speaks the subset of the Supabase HTTP API the client uses
// (GoTrue /auth/v1 + PostgREST /rest/v1/rpc), backed by a REAL Postgres (PGlite)
// running supabase/migrations with the auth stub. Optional static file server for
// the built site so the portal can be exercised end to end.
//
//   node tools/db/dev-server.mjs [--port 54321] [--data .devdb] [--static dist-site --static-port 8080]
//   build the site with VITE_SUPABASE_URL=http://localhost:54321 VITE_SUPABASE_ANON_KEY=dev-anon-key
//
// STUB parts (not production): opaque random tokens instead of JWTs, scrypt hashes in
// auth.users, no email flows, no rate limiting on auth endpoints.
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, join, normalize } from 'node:path';
import { randomBytes, scryptSync, timingSafeEqual, randomUUID } from 'node:crypto';
import { createDb } from './harness.mjs';
import { attachRealtime } from './realtime-stub.mjs';

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const PORT = Number(arg('--port', process.env.PORT || 54321));
const DATA = arg('--data', null);
const STATIC = arg('--static', null);
const STATIC_PORT = Number(arg('--static-port', 8080));
export const ANON_KEY = process.env.ICEBERG_DEV_ANON_KEY || 'dev-anon-key';
const TOKEN_TTL = 3600;

export async function startDevServer({ port = PORT, dataDir = DATA, staticDir = STATIC, staticPort = STATIC_PORT, quiet = false, anonKey = ANON_KEY } = {}) {
  const db = await createDb({ dataDir: dataDir || undefined });
  const access = new Map();   // token -> { uid, exp }
  const refresh = new Map();  // token -> uid

  const hash = (pw) => { const salt = randomBytes(16); return 'scrypt$' + salt.toString('hex') + '$' + scryptSync(pw, salt, 32).toString('hex'); };
  const verify = (pw, stored) => {
    const [, s, h] = String(stored || '').split('$'); if (!s || !h) return false;
    const a = scryptSync(pw, Buffer.from(s, 'hex'), 32), b = Buffer.from(h, 'hex');
    return a.length === b.length && timingSafeEqual(a, b);
  };
  const session = async (uid) => {
    const at = randomBytes(24).toString('hex'), rt = randomBytes(24).toString('hex');
    const exp = Math.floor(Date.now() / 1000) + TOKEN_TTL;
    access.set(at, { uid, exp }); refresh.set(rt, uid);
    const u = (await db.query('select id, email, raw_user_meta_data from auth.users where id = $1', [uid])).rows[0];
    return { access_token: at, token_type: 'bearer', expires_in: TOKEN_TTL, expires_at: exp, refresh_token: rt,
      user: { id: u.id, email: u.email, user_metadata: u.raw_user_meta_data, role: 'authenticated' } };
  };

  const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info, prefer',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' };
  const send = (res, status, body) => { res.writeHead(status, { 'Content-Type': 'application/json', ...cors }); res.end(body === undefined ? '' : JSON.stringify(body)); };
  const readBody = (req) => new Promise((ok, bad) => { let b = ''; req.on('data', c => { b += c; if (b.length > 1e6) req.destroy(); }); req.on('end', () => { try { ok(b ? JSON.parse(b) : {}); } catch (e) { bad(e); } }); });

  const pgError = (res, e, uid) => {
    const code = e.code || null;
    if (code === '42501') return send(res, uid ? 403 : 401, { code, message: e.message, details: null, hint: null });
    if (code === '42883') return send(res, 404, { code: 'PGRST202', message: e.message, details: null, hint: null });
    if (code === '28000') return send(res, 401, { code, message: e.message });
    return send(res, 400, { code, message: e.message, details: e.detail || null, hint: e.hint || null });
  };

  async function rpc(uid, fn, args) {
    const names = Object.keys(args || {});
    for (const n of names) if (!/^[a-z_][a-z0-9_]*$/.test(n)) throw Object.assign(new Error('bad argument name'), { code: '22023' });
    const vals = names.map(n => (args[n] !== null && typeof args[n] === 'object') ? JSON.stringify(args[n]) : args[n]);
    const sql = `select to_jsonb(public.${fn}(${names.map((n, i) => `${n} => $${i + 1}`).join(', ')})) as r`;
    const role = uid ? 'authenticated' : 'anon';
    return db.transaction(async (tx) => {
      await tx.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify(uid ? { sub: uid, role } : { role })]);
      await tx.exec(`set local role ${role}`);
      return (await tx.query(sql, vals)).rows[0].r;
    });
  }

  const server = http.createServer(async (req, res) => {
    try {
      if (req.method === 'OPTIONS') return send(res, 204);
      const url = new URL(req.url, 'http://x');
      if (url.pathname === '/health') return send(res, 200, { ok: true });
      if (req.headers.apikey !== anonKey) return send(res, 401, { message: 'Invalid API key' });
      const bearer = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
      const tok = access.get(bearer);
      const uid = tok && tok.exp > Date.now() / 1000 ? tok.uid : null;
      if (bearer && bearer !== anonKey && !uid && url.pathname.startsWith('/rest/')) return send(res, 401, { code: 'PGRST301', message: 'JWT expired' });

      if (url.pathname === '/auth/v1/signup' && req.method === 'POST') {
        const { email, password, data } = await readBody(req);
        if (!email || !password || String(password).length < 6) return send(res, 422, { code: 422, error_code: 'weak_password', msg: 'Password should be at least 6 characters.' });
        const exists = (await db.query('select 1 from auth.users where lower(email) = lower($1)', [email])).rows.length;
        if (exists) return send(res, 422, { code: 422, error_code: 'user_already_exists', msg: 'User already registered' });
        const id = randomUUID();
        try {
          await db.query('insert into auth.users (id, email, encrypted_password, raw_user_meta_data) values ($1, lower($2), $3, $4)',
            [id, email, hash(password), JSON.stringify(data || {})]);
        } catch (e) { return send(res, 500, { code: 500, error_code: 'unexpected_failure', msg: 'Database error saving new user' }); }
        return send(res, 200, await session(id));
      }
      if (url.pathname === '/auth/v1/token' && req.method === 'POST') {
        const body = await readBody(req);
        if (url.searchParams.get('grant_type') === 'password') {
          const u = (await db.query('select id, encrypted_password from auth.users where lower(email) = lower($1)', [body.email || ''])).rows[0];
          if (!u || !verify(String(body.password || ''), u.encrypted_password)) return send(res, 400, { error: 'invalid_grant', error_description: 'Invalid login credentials' });
          return send(res, 200, await session(u.id));
        }
        if (url.searchParams.get('grant_type') === 'refresh_token') {
          const id = refresh.get(body.refresh_token); refresh.delete(body.refresh_token);
          if (!id) return send(res, 400, { error: 'invalid_grant', error_description: 'Invalid Refresh Token' });
          return send(res, 200, await session(id));
        }
        return send(res, 400, { error: 'unsupported_grant_type' });
      }
      if (url.pathname === '/auth/v1/logout') { access.delete(bearer); return send(res, 204); }
      if (url.pathname === '/auth/v1/user') {
        if (!uid) return send(res, 401, { msg: 'invalid token' });
        return send(res, 200, (await session(uid)).user);
      }
      const m = url.pathname.match(/^\/rest\/v1\/rpc\/([a-z_][a-z0-9_]*)$/);
      if (m && req.method === 'POST') {
        try { return send(res, 200, await rpc(uid, m[1], await readBody(req))); }
        catch (e) { return pgError(res, e, uid); }
      }
      return send(res, 404, { message: 'not found (dev stub implements /auth/v1 and /rest/v1/rpc only)' });
    } catch (e) { return send(res, 500, { message: String(e.message || e) }); }
  });
  const realtime = attachRealtime(server, { db, anonKey: ANON_KEY, uidForToken: (t) => { const a = access.get(t); return a && a.exp > Date.now() / 1000 ? a.uid : null; } });
  await new Promise(ok => server.listen(port, ok));
  let staticServer = null;
  if (staticDir) staticServer = await serveStatic(resolve(staticDir), staticPort);
  if (!quiet) console.log(`[dev-backend] API http://localhost:${port} (anon key "${anonKey}", data ${dataDir || 'in-memory'})` +
    (staticServer ? `\n[dev-backend] site http://localhost:${staticPort}/` : ''));
  return { db, server, staticServer, realtime, close: async () => { server.close(); staticServer?.close(); await db.close(); } };
}

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.txt': 'text/plain' };
export async function serveStatic(root, port, { prefix = '/' } = {}) {
  const s = http.createServer(async (req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (!p.startsWith(prefix)) { res.writeHead(404); return res.end(); }
    p = normalize(p.slice(prefix.length - 1)).replace(/^(\.\.[/\\])+/, '');
    let f = join(root, p);
    try { if ((await stat(f)).isDirectory()) f = join(f, 'index.html'); } catch { /* 404 below */ }
    try {
      const buf = await readFile(f);
      res.writeHead(200, { 'Content-Type': MIME[extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      res.end(buf);
    } catch { res.writeHead(404); res.end('not found'); }
  });
  await new Promise(ok => s.listen(port, ok));
  return s;
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname)) await startDevServer();
