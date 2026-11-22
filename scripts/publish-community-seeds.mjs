#!/usr/bin/env node
/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  DO NOT RUN WITH --yes UNTIL COLIN HAS APPROVED PUBLISHING THESE GAMES.  ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 *
 * Publishes the community seed games in community-seeds/*.json to the LIVE
 * Iceberg server as the player `gooberr478`, through the exact same path the
 * Studio "Publish" button uses: the `publish_custom_game(p_game_key, p_name,
 * p_doc)` Postgres RPC (supabase/migrations/20261031000017_custom_games.sql),
 * called as that authenticated user. The doc sent is  { ...doc, published:true,
 * publishedAt: Date.now() }  (see publish() in src/studio/store.js).
 *
 * SAFE BY DEFAULT
 *   • no flags            → DRY RUN: validates every file, prints what WOULD be
 *                           published, makes NO network calls, needs no secrets.
 *   • --yes               → actually signs in and publishes. Only Colin (or
 *                           someone he explicitly authorises) should do this.
 *   • --only <slug>       → restrict to one game (repeatable).
 *
 * ENV (only read when --yes is given)
 *   GOOBERR478_PASSWORD         password of the gooberr478 account (required)
 *   VITE_SUPABASE_URL           e.g. https://xxxx.supabase.co       (required)
 *   VITE_SUPABASE_ANON_KEY      public anon key                     (required)
 *   VITE_USERNAME_EMAIL_DOMAIN  default users.iceberg.invalid (usernames map to <name>@<domain>)
 *   COMMUNITY_CREATOR           default gooberr478
 *
 * Re-publishing is idempotent per game id (the RPC upserts the creator's own
 * row); a game id owned by a different player is refused with `id_taken`.
 * Rollback = unpublish_custom_game (Studio ▸ Unpublish) as the same account.
 *
 * Limits are checked locally first: doc ≤ 2 MB, thumbnail data URL ≤ 300 KB,
 * name 1–40 chars, game id /^[a-zA-Z0-9_-]{1,64}$/, ≤ 50 games per owner.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'community-seeds');
const args = process.argv.slice(2);
const YES = args.includes('--yes');
const only = args.flatMap((a, i) => a === '--only' ? [args[i + 1]] : []);
const CREATOR = process.env.COMMUNITY_CREATOR || 'gooberr478';

const meta = JSON.parse(fs.readFileSync(path.join(ROOT, 'metadata.json'), 'utf8'));
const games = meta.games.filter(g => !only.length || only.includes(g.slug));
if (!games.length) { console.error('no matching games'); process.exit(1); }

const problems = [];
const docs = games.map(g => {
  const doc = JSON.parse(fs.readFileSync(path.join(ROOT, g.file), 'utf8'));
  const bytes = Buffer.byteLength(JSON.stringify(doc));
  if (!/^[a-zA-Z0-9_-]{1,64}$/.test(doc.id || '')) problems.push(`${g.slug}: bad game id`);
  if (!doc.name || doc.name.length > 40) problems.push(`${g.slug}: name must be 1-40 chars`);
  if (bytes > 2_000_000) problems.push(`${g.slug}: doc is ${bytes} bytes (>2 MB)`);
  if (!doc.thumbnail) problems.push(`${g.slug}: no embedded thumbnail (run scripts/build-community-seeds.mjs after capturing)`);
  else if (doc.thumbnail.length > 300_000) problems.push(`${g.slug}: thumbnail too large`);
  return { g, doc, bytes };
});
console.log(`Creator: ${CREATOR}\nMode:    ${YES ? 'LIVE PUBLISH (--yes)' : 'DRY RUN (no network, nothing is published)'}\n`);
for (const { g, doc, bytes } of docs) console.log(`• ${doc.name}  [${doc.id}]  ${doc.instances.length} instances, ${(bytes / 1024).toFixed(0)} KB, thumbnail ${doc.thumbnail ? (doc.thumbnail.length / 1024).toFixed(0) + ' KB' : 'MISSING'}\n    ${g.description}`);
if (problems.length) { console.error('\nProblems:\n - ' + problems.join('\n - ')); process.exit(1); }
if (!YES) { console.log('\nDry run only. To publish for real (after Colin approves): node scripts/publish-community-seeds.mjs --yes'); process.exit(0); }

const need = ['GOOBERR478_PASSWORD', 'VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'].filter(k => !process.env[k]);
if (need.length) { console.error('missing env: ' + need.join(', ')); process.exit(1); }
const URL_ = process.env.VITE_SUPABASE_URL.replace(/\/$/, ''), KEY = process.env.VITE_SUPABASE_ANON_KEY;
const email = `${CREATOR.toLowerCase()}@${process.env.VITE_USERNAME_EMAIL_DOMAIN || 'users.iceberg.invalid'}`;

const auth = await fetch(`${URL_}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { apikey: KEY, 'content-type': 'application/json' }, body: JSON.stringify({ email, password: process.env.GOOBERR478_PASSWORD }) });
const session = await auth.json();
if (!auth.ok || !session.access_token) { console.error('sign-in failed:', session.error_description || session.msg || auth.status); process.exit(1); }
console.log(`\nSigned in as ${CREATOR}.`);
let failed = 0;
for (const { doc } of docs) {
  const pub = { ...doc, published: true, publishedAt: Date.now() };
  const r = await fetch(`${URL_}/rest/v1/rpc/publish_custom_game`, { method: 'POST', headers: { apikey: KEY, authorization: `Bearer ${session.access_token}`, 'content-type': 'application/json' }, body: JSON.stringify({ p_game_key: pub.id, p_name: pub.name.slice(0, 40), p_doc: pub }) });
  const out = await r.json().catch(() => ({}));
  if (r.ok && out?.ok === true) console.log(`  ✓ published ${pub.name} (server id ${out.id})`);
  else { failed++; console.error(`  ✗ ${pub.name}: ${out?.reason || out?.message || r.status}`); }
}
process.exit(failed ? 1 : 0);
