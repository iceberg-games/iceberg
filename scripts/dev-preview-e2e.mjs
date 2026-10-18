#!/usr/bin/env node
// End-to-end test of the developers-only preview, with TWO local backends (real Postgres via PGlite):
// "prod" (dev allowlist, is_dev) and "sandbox" (what the preview app talks to).
//   node scripts/dev-preview-e2e.mjs [--preview-root <app tree, e.g. a release/a worktree>] [--compare-ref <git ref>]
// Checks: SW bypass of /preview/ (unit + real browser cache), no button / 'Developers only' for guests and
// non-devs, button + booted preview for a dev against the sandbox, real-site storage untouched, missing RPC
// handled silently, and (with --compare-ref) that the main build differs from that ref only by the button code.
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, statSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { resolve, dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const PREVIEW_ROOT = resolve(arg('--preview-root', ROOT));
const COMPARE = arg('--compare-ref', null);
const W = '/tmp/iceberg-dev-preview-e2e';
const PROD_PORT = 54391, SB_PORT = 54392, WEB_PORT = 8391, PROD_KEY = 'prod-anon-key', SB_KEY = 'sandbox-anon-key';
let pass = 0, fail = 0; const check = (n, ok, d = '') => { ok ? pass++ : fail++; console.log(ok ? 'PASS' : 'FAIL', n, ok ? '' : String(d).slice(0, 400)); };

// ---------- 1. service worker unit test: /preview/ is never intercepted ----------
{
  const src = readFileSync(resolve(ROOT, 'site/public/sw.js'), 'utf8');
  const handlers = {};
  const self = { location: new URL('https://x.test/iceberg/sw.js'), registration: { scope: 'https://x.test/iceberg/' },
    addEventListener: (t, f) => { handlers[t] = f; }, skipWaiting() {}, clients: { claim() {} } };
  vm.runInNewContext(src, { self, URL, caches: { match: async () => null, open: async () => ({ put() {} }) }, fetch: async () => ({ ok: true, clone() { return this; } }) });
  const hit = (url, mode = 'no-cors') => { let used = false; handlers.fetch({ request: { url, method: 'GET', mode, headers: { has: () => false } }, respondWith: () => { used = true; } }); return used; };
  check('sw: /preview/ navigation bypassed', !hit('https://x.test/iceberg/preview/', 'navigate'));
  check('sw: /preview/play/ + assets bypassed', !hit('https://x.test/iceberg/preview/play/?game=x', 'navigate') && !hit('https://x.test/iceberg/preview/bakery.glb'));
  check('sw: main pages still served by the SW', hit('https://x.test/iceberg/', 'navigate') && hit('https://x.test/iceberg/play/index.html'));
  check('sw: look-alike path /previews/ still handled normally', hit('https://x.test/iceberg/previews/x.png'));
}

// ---------- 2. builds: main site at /iceberg/, preview at /iceberg/preview/ ----------
rmSync(W, { recursive: true, force: true }); mkdirSync(W, { recursive: true });
const SITE = join(W, 'site');
const env = { ...process.env, VITE_USERNAME_EMAIL_DOMAIN: 'users.iceberg.test' };
execFileSync('node', [resolve(ROOT, 'scripts/build-site.mjs'), '--out', SITE], { cwd: ROOT, stdio: 'pipe',
  env: { ...env, VITE_SUPABASE_URL: `http://localhost:${PROD_PORT}`, VITE_SUPABASE_ANON_KEY: PROD_KEY } });
execFileSync('node', [resolve(ROOT, 'scripts/build-preview.mjs'), '--root', PREVIEW_ROOT, '--out', join(SITE, 'preview')], { cwd: ROOT, stdio: 'pipe',
  env: { ...env, VITE_PREVIEW_SUPABASE_URL: `http://localhost:${SB_PORT}`, VITE_PREVIEW_SUPABASE_ANON_KEY: SB_KEY,
    VITE_PROD_SUPABASE_URL: `http://localhost:${PROD_PORT}`, VITE_PROD_SUPABASE_ANON_KEY: PROD_KEY } });
const pv = readFileSync(join(SITE, 'preview/index.html'), 'utf8');
check('preview build: noindex, no manifest, banner, sandbox backend', pv.includes('noindex') && !pv.includes('rel="manifest"') && pv.includes('dev-preview-banner') && pv.includes(`localhost:${SB_PORT}`));
check('preview build: no service worker / manifest files', !existsSync(join(SITE, 'preview/sw.js')) && !existsSync(join(SITE, 'preview/manifest.webmanifest')));
check('main build: button code present, preview code absent', readFileSync(join(SITE, 'index.html'), 'utf8').includes('New Update (Developers Only)') && !readFileSync(join(SITE, 'index.html'), 'utf8').includes('dev-preview-banner'));

// ---------- 3. browser ----------
const { startDevServer, serveStatic } = await import(resolve(ROOT, 'tools/db/dev-server.mjs'));
const prod = await startDevServer({ port: PROD_PORT, quiet: true, anonKey: PROD_KEY });
const sandbox = await startDevServer({ port: SB_PORT, quiet: true, anonKey: SB_KEY });
const web = await serveStatic(SITE, WEB_PORT, { prefix: '/iceberg/' });
const BASE = `http://localhost:${WEB_PORT}/iceberg/`;
const q = (db, sql, p) => db.query(sql, p).then(r => r.rows);
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const watch = (p, errs, sbHits) => {
  p.on('pageerror', e => errs.push(String(e)));
  p.on('console', m => { if (m.type() === 'error' && !/40[134]|favicon|Failed to load resource/.test(m.text())) errs.push(m.text()); });
  if (sbHits) p.on('request', r => { if (r.url().includes(`:${SB_PORT}`)) sbHits.push(r.url()); });
};
async function signUpMain(p, username) {
  await p.goto(BASE); await p.click('#p-signin-open');
  await p.fill('#form-signup input[name=username]', username);
  await p.fill('#form-signup input[name=password]', 'devpreview-' + username);
  await p.click('#form-signup button[type=submit]');
  await p.waitForSelector('#p-user', { timeout: 15000 });
}
const isDevSettled = (p) => p.waitForResponse(r => r.url().endsWith('/rest/v1/rpc/is_dev'), { timeout: 10000 }).catch(() => null);
const realKeys = (p) => p.evaluate(() => Object.fromEntries(Object.keys(localStorage).sort().map(k => [k, localStorage.getItem(k)])));
try {
  // guest
  {
    const ctx = await b.newContext(); const p = await ctx.newPage(); const errs = [], sb = []; watch(p, errs, sb);
    await p.goto(BASE); await p.waitForSelector('#games-grid .game-card'); await p.waitForTimeout(800);
    check('guest: no dev button in the DOM', (await p.$('#dev-update')) === null);
    await p.goto(BASE + 'preview/');
    await p.waitForSelector('#dev-preview-gate[data-state="denied"]', { timeout: 10000 });
    check('guest: /preview/ shows Developers only', /Developers only/.test(await p.textContent('#dev-preview-gate')));
    check('guest: preview app never booted (no portal DOM, no sandbox requests)', (await p.$eval('#portal', e => e.childElementCount)) === 0 && sb.length === 0, sb.join());
    await p.goto(BASE + 'preview/play/?game=frost-fields');
    await p.waitForSelector('#dev-preview-gate[data-state="denied"]', { timeout: 10000 });
    check('guest: /preview/play/ also gated', (await p.$eval('#app', e => e.childElementCount)) === 0 && sb.length === 0);
    check('guest: no page errors', errs.length === 0, errs.join(' | '));
    await ctx.close();
  }
  // non-dev account
  {
    const ctx = await b.newContext(); const p = await ctx.newPage(); const errs = [], sb = []; watch(p, errs, sb);
    const settled = isDevSettled(p); await signUpMain(p, 'zz_player'); const r = await settled;
    check('non-dev: is_dev() asked and false', r && (await r.json()) === false);
    await p.waitForTimeout(300);
    check('non-dev: no dev button in the DOM', (await p.$('#dev-update')) === null);
    await p.goto(BASE + 'preview/');
    await p.waitForSelector('#dev-preview-gate[data-state="denied"]', { timeout: 10000 });
    check('non-dev: /preview/ shows Developers only, no sandbox traffic', sb.length === 0 && (await p.$eval('#portal', e => e.childElementCount)) === 0);
    check('non-dev: no page errors', errs.length === 0, errs.join(' | '));
    await ctx.close();
  }
  // dev (Colin): allowlisted in PROD by the dev-access script SQL, mixed-case username
  {
    const ctx = await b.newContext({ viewport: { width: 375, height: 740 }, isMobile: true, hasTouch: true }); const p = await ctx.newPage(); const errs = [], sb = []; watch(p, errs, sb);
    await signUpMain(p, 'gooberr478');
    const { devAccessSQL } = await import(resolve(ROOT, 'scripts/dev-access.mjs'));
    const r = (await q(prod.db, devAccessSQL('add', 'Gooberr478', { note: 'Colin' })))[0];
    check('dev-access add Gooberr478 (case-insensitive)', r.found === true && Number(r.changed) === 1, JSON.stringify(r));
    await p.evaluate(() => localStorage.setItem('iceberg:v1:zz-real-guest-data', 'keep-me'));
    await p.reload(); await p.waitForSelector('#dev-update', { timeout: 10000 });
    const box = await p.$eval('#dev-update', e => { const r = e.getBoundingClientRect(); const u = document.querySelector('.p-header').getBoundingClientRect(); return { top: r.top, bottom: r.bottom, w: r.width, left: r.left, right: r.right, headerBottom: u.bottom, vw: innerWidth }; });
    check('dev: button directly under the username/balance row, fully visible at 375px', box.top >= box.headerBottom - 1 && box.top - box.headerBottom < 30 && box.left >= 0 && box.right <= box.vw && box.bottom < 300, JSON.stringify(box));
    check('dev: button opens ./preview/ in a new tab', (await p.$eval('#dev-update', e => [e.getAttribute('href'), e.target].join())) === './preview/,_blank');
    await p.screenshot({ path: join(W, 'dev-button-375.png') });
    const before = await realKeys(p);
    const prodUsers = Number((await q(prod.db, 'select count(*) n from auth.users'))[0].n);
    const [tab] = await Promise.all([ctx.waitForEvent('page'), p.click('#dev-update')]);
    const e2 = [], sb2 = []; watch(tab, e2, sb2);
    await tab.waitForSelector('#p-user', { timeout: 20000 });
    check('dev: preview booted, signed in to the SANDBOX as the same username (auto-created)', /gooberr478/.test(await tab.textContent('#p-user')) &&
      (await q(sandbox.db, `select count(*) n from public.profiles where username = 'gooberr478'`))[0].n == 1);
    check('dev: preview banner visible', await tab.isVisible('#dev-preview-banner'));
    check('dev: preview talks to the sandbox only', sb2.length > 0 && (await tab.evaluate(() => window.__icebergPreview?.sandboxAccount)) === 'created');
    check('dev: prod got no new accounts', Number((await q(prod.db, 'select count(*) n from auth.users'))[0].n) === prodUsers);
    await tab.screenshot({ path: join(W, 'preview-portal-375.png') });
    const [game] = await Promise.all([ctx.waitForEvent('page'), tab.click('#view-games .game-card[data-game="frost-fields"] .btn.play')]);
    await game.waitForLoadState(); const e3 = []; watch(game, e3);
    check('dev: preview Play stays inside /preview/', game.url().startsWith(BASE + 'preview/play/'), game.url());
    await game.waitForSelector('#start-btn', { timeout: 20000 }); await game.click('#start-btn');
    await game.waitForFunction(() => window.iceberg?.engine?.running, null, { timeout: 20000 });
    check('dev: preview game boots, signed in on the sandbox', await game.evaluate(() => window.iceberg.economy.signedIn));
    await game.evaluate(() => window.iceberg.economy.flush?.()); await game.close(); await tab.close();
    const after = await realKeys(p);
    const realOnly = (o) => Object.fromEntries(Object.entries(o).filter(([k]) => !k.startsWith('iceberg-preview:')));
    check('dev: real-site storage byte-identical after using the preview (session, guest data)', JSON.stringify(realOnly(before)) === JSON.stringify(realOnly(after)),
      JSON.stringify(Object.keys(realOnly(after)).filter(k => before[k] !== after[k])));
    check('dev: preview data lives only under iceberg-preview:*', Object.keys(after).some(k => k.startsWith('iceberg-preview:iceberg:v1:session')));
    // main SW never cached anything under /preview/
    const sw = await p.evaluate(async () => { const r = await Promise.race([navigator.serviceWorker.ready, new Promise(r => setTimeout(() => r(null), 8000))]);
      const urls = []; for (const k of await caches.keys()) for (const req of await (await caches.open(k)).keys()) urls.push(req.url); return { active: !!r?.active, urls }; });
    check('real SW active on the main site and caches nothing under /preview/', sw.active && sw.urls.length > 0 && !sw.urls.some(u => u.includes('/preview/')), JSON.stringify(sw));
    // second visit: already signed in, no new sandbox account
    const t2 = await ctx.newPage(); await t2.goto(BASE + 'preview/'); await t2.waitForSelector('#p-user', { timeout: 20000 });
    check('dev: second visit reuses the sandbox session', (await t2.evaluate(() => window.__icebergPreview?.sandboxAccount)) === 'signed_in');
    await t2.close();
    check('dev: no page errors (main + preview)', errs.length + e2.length + e3.length === 0, [...errs, ...e2, ...e3].join(' | '));
    // missing RPC (older prod database): no button, silently
    await q(prod.db, 'drop function public.is_dev()');
    const errs4 = []; const p4 = await ctx.newPage(); watch(p4, errs4);
    const st = isDevSettled(p4); await p4.goto(BASE); const rr = await st; await p4.waitForTimeout(500);
    check('pre-migration (no is_dev RPC): no button, no errors', rr && rr.status() === 404 && (await p4.$('#dev-update')) === null && errs4.length === 0, errs4.join(' | '));
    await p4.goto(BASE + 'preview/'); await p4.waitForSelector('#dev-preview-gate[data-state="denied"]', { timeout: 10000 });
    check('pre-migration: /preview/ denied', true);
    await ctx.close();
  }
} finally { await b.close(); web.close(); await prod.close(); await sandbox.close(); }

// ---------- 4. main build differs from --compare-ref only by the button (+ SW bypass) ----------
if (COMPARE) {
  const wt = join(W, 'cmp-src'), out = join(W, 'cmp-site');
  execFileSync('git', ['-C', ROOT, 'worktree', 'add', '--detach', wt, COMPARE], { stdio: 'pipe' });
  try {
    execFileSync('ln', ['-s', resolve(ROOT, 'node_modules'), join(wt, 'node_modules')]);
    const e = { ...env, VITE_SUPABASE_URL: `http://localhost:${PROD_PORT}`, VITE_SUPABASE_ANON_KEY: PROD_KEY };
    const mine = join(W, 'mine-site');
    execFileSync('node', [join(wt, 'scripts/build-site.mjs'), '--out', out], { cwd: wt, stdio: 'pipe', env: e });
    execFileSync('node', [resolve(ROOT, 'scripts/build-site.mjs'), '--out', mine], { cwd: ROOT, stdio: 'pipe', env: e });
    const list = (d) => { const r = []; const walk = (x) => { for (const f of readdirSync(x)) { const pth = join(x, f); statSync(pth).isDirectory() ? walk(pth) : r.push(relative(d, pth)); } }; walk(d); return r.sort(); };
    const A = list(out), B = list(mine);
    check(`compare ${COMPARE}: same file list`, JSON.stringify(A) === JSON.stringify(B), JSON.stringify([A.filter(f => !B.includes(f)), B.filter(f => !A.includes(f))]));
    const changed = B.filter(f => A.includes(f) && !readFileSync(join(out, f)).equals(readFileSync(join(mine, f))));
    check(`compare ${COMPARE}: only index.html (button) and sw.js (bypass + build id) differ`, changed.every(f => ['index.html', 'sw.js'].includes(f)), changed.join());
    const norm = (s) => s.replace(/const VERSION = '[^']+'/, '');
    const swA = norm(readFileSync(join(out, 'sw.js'), 'utf8')).split('\n'), swB = norm(readFileSync(join(mine, 'sw.js'), 'utf8')).split('\n');
    const added = swB.filter(l => !swA.includes(l)), removed = swA.filter(l => !swB.includes(l));
    check('compare: sw.js only adds the /preview/ bypass', removed.length === 0 && added.every(l => /preview|^\s*\/\//.test(l)), JSON.stringify({ added, removed }));
    const dA = readFileSync(join(out, 'index.html')).length, dB = readFileSync(join(mine, 'index.html')).length;
    check(`compare: portal grows by the button code only (+${dB - dA} bytes)`, dB - dA > 0 && dB - dA < 3000, dB - dA);
    check('compare: play page byte-identical', !changed.includes('play/index.html'));
  } finally { execFileSync('git', ['-C', ROOT, 'worktree', 'remove', '--force', wt], { stdio: 'pipe' }); }
}
console.log(`\n${pass}/${pass + fail} dev-preview checks passed`);
process.exit(fail ? 1 : 0);
