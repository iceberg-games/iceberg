// DEV PREVIEW gate. Runs (with top-level await) BEFORE any app module: the preview bundle is one
// file and Rollup keeps module order, so if this never resolves the game/portal never boots.
//  1. Read the REAL site's sign-in (same origin) read-only; never refresh or write it.
//  2. Ask the PROD server is_dev() with it (prod anon key, read-only RPC).
//  3. Not signed in / not a dev / error => 'Developers only' screen, app never starts.
//  4. Devs: make sure a SANDBOX account with the same username exists and is signed in
//     (random password kept only in the preview's own storage). All game traffic goes to the sandbox.
import { readRealItem } from './isolate.js';
import { SupabaseClient } from '../net/supabaseClient.js';
import { signIn, signUp } from '../net/auth.js';
import { CONFIG } from '../net/config.js';

const env = import.meta.env || {};
const PROD = { url: (env.VITE_PROD_SUPABASE_URL || '').replace(/\/+$/, ''), anonKey: env.VITE_PROD_SUPABASE_ANON_KEY || '' };
const REAL_SESSION_KEY = 'iceberg:v1:session';
const ACCOUNT_KEY = 'iceberg:v1:preview-account';      // inside the preview namespace (see isolate.js)
const siteRoot = new URL(document.querySelector('meta[name="iceberg-main-site"]')?.content || '../', location.href).href;

const css = `
.dvp-banner{position:fixed;top:0;left:0;right:0;z-index:2147483000;pointer-events:none;text-align:center;font:800 12px/24px system-ui,sans-serif;letter-spacing:.4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#2b1a00;background:repeating-linear-gradient(45deg,#ffd23f 0 14px,#ffc300 14px 28px);box-shadow:0 2px 8px rgba(0,0,0,.25)}
body.dvp{padding-top:24px}
.dvp-gate{position:fixed;inset:0;z-index:2147482000;display:flex;align-items:center;justify-content:center;background:linear-gradient(160deg,#0e2a45,#1d4f7a);color:#fff;font-family:system-ui,sans-serif;padding:24px}
.dvp-card{max-width:420px;text-align:center;background:rgba(255,255,255,.08);border-radius:18px;padding:28px 24px;box-shadow:0 10px 40px rgba(0,0,0,.35)}
.dvp-card h1{margin:0 0 8px;font-size:26px}.dvp-card p{margin:8px 0;opacity:.9;line-height:1.4}
.dvp-card a{display:inline-block;margin-top:12px;padding:10px 18px;border-radius:999px;background:#fff;color:#0e2a45;font-weight:800;text-decoration:none}`;
document.head.append(Object.assign(document.createElement('style'), { textContent: css }));
document.body.classList.add('dvp');
const banner = Object.assign(document.createElement('div'), { className: 'dvp-banner', id: 'dev-preview-banner', textContent: '🧪 DEV PREVIEW · test data only', title: 'Sandbox accounts and Birg Bucks, not your real ones' });
document.body.append(banner);

function screen(title, text, id) {
  document.getElementById('dev-preview-gate')?.remove();
  const g = document.createElement('div'); g.className = 'dvp-gate'; g.id = 'dev-preview-gate'; g.dataset.state = id;
  const c = document.createElement('div'); c.className = 'dvp-card';
  const hh = document.createElement('h1'); hh.textContent = title;
  const p = document.createElement('p'); p.textContent = text;
  c.append(hh, p);
  if (id !== 'checking') { const a = document.createElement('a'); a.href = siteRoot; a.textContent = 'Go to Iceberg'; c.append(a); }
  g.append(c); document.body.append(g);
}

export async function prodDevCheck() {
  let s = null; try { s = JSON.parse(readRealItem(REAL_SESSION_KEY) || 'null'); } catch { s = null; }
  if (!s?.access_token || !PROD.url || !PROD.anonKey) return { ok: false, why: 'signed_out' };
  if (s.expires_at && s.expires_at - 30 < Date.now() / 1000) return { ok: false, why: 'expired' };
  try {
    const r = await fetch(`${PROD.url}/rest/v1/rpc/is_dev`, { method: 'POST', body: '{}',
      headers: { apikey: PROD.anonKey, Authorization: `Bearer ${s.access_token}`, 'Content-Type': 'application/json' } });
    if (r.status === 401) return { ok: false, why: 'expired' };
    return (r.ok && (await r.json()) === true) ? { ok: true, username: s.user?.username || null } : { ok: false, why: 'not_dev' };
  } catch { return { ok: false, why: 'error' }; }
}

async function ensureSandboxAccount(username) {
  if (!username || !CONFIG.supabaseUrl || !CONFIG.anonKey) return 'no_username';
  const client = new SupabaseClient({ url: CONFIG.supabaseUrl, anonKey: CONFIG.anonKey });   // preview-namespaced storage
  if (client.signedIn && client.user?.username === username) return 'signed_in';
  let acct = null; try { acct = JSON.parse(localStorage.getItem(ACCOUNT_KEY) || 'null'); } catch { acct = null; }
  if (acct?.username === username && acct.password) {
    try { await signIn(client, acct); return 'signed_in'; } catch { /* fall through: maybe the sandbox was reset */ }
  }
  const pw = Array.from(crypto.getRandomValues(new Uint8Array(24)), b => b.toString(16).padStart(2, '0')).join('');
  localStorage.setItem(ACCOUNT_KEY, JSON.stringify({ username, password: pw, created: new Date().toISOString() }));   // saved first: never lose it
  try { await signUp(client, { username, password: pw, displayName: username }); return 'created'; }
  catch (e) { console.warn('[dev preview] sandbox account', e.message); return 'taken'; }
}

screen('Checking developer access…', 'One moment.', 'checking');
const res = await prodDevCheck();
if (!res.ok) {
  if (res.why === 'expired') screen('🔒 Developers only', 'Your sign-in needs a refresh. Open the main Iceberg site (it refreshes automatically), then press New Update again.', 'expired');
  else screen('🔒 Developers only', 'This page is only for Iceberg developers. Sign in on the main site with a developer account, then press New Update (Developers Only).', 'denied');
  await new Promise(() => {});            // never boot the app for non-devs
}
const acct = await ensureSandboxAccount(res.username);
window.__icebergPreview = { username: res.username, sandboxAccount: acct };
if (acct === 'taken') { banner.textContent = `🧪 DEV PREVIEW · sign in to sandbox @${res.username}`; banner.title = "This sandbox account was created on another device or browser"; }
document.getElementById('dev-preview-gate')?.remove();
