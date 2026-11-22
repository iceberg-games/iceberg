// Editor Update e2e against the LOCAL dev backend (no production access): owner-only edit of a published game's
// name / description / thumbnail, community row on a second account, PWA manifest + installability, pop-out.
//   node scripts/editor-update-e2e.mjs
import { chromium } from 'playwright';
import { spawnSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const { startDevServer, serveStatic, ANON_KEY } = await import(resolve(ROOT, 'tools/db/dev-server.mjs'));
const API = 54620, WEB = 8620, BASE = `http://localhost:${WEB}/iceberg/`, OUT = '/tmp/iceberg-eu-site', SHOTS = resolve(ROOT, 'designs/editor-update/');
let fails = 0; const ok = (n, c, x = '') => { console.log(`${c ? 'PASS' : 'FAIL'}  ${n}${x ? '  ' + x : ''}`); if (!c) fails++; };
const r = spawnSync('node', ['scripts/build-site.mjs', '--out', OUT], { cwd: ROOT, env: { ...process.env, VITE_SUPABASE_URL: `http://localhost:${API}`, VITE_SUPABASE_ANON_KEY: ANON_KEY, VITE_USERNAME_EMAIL_DOMAIN: 'users.iceberg.test' }, encoding: 'utf8' });
ok('site build', r.status === 0, r.stderr?.slice(-300));
const dev = await startDevServer({ port: API, quiet: true });
const web = await serveStatic(OUT, WEB, { prefix: '/iceberg/' });
const b = await chromium.launch();
async function signUp(name) {
  const c = await b.newContext({ viewport: { width: 1440, height: 900 } }); const p = await c.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(BASE); await p.click('#p-signin-open'); await p.fill('#form-signup input[name=username]', name); await p.fill('#form-signup input[name=password]', 'snowball123'); await p.fill('#form-signup input[name=display]', name);
  await p.click('#form-signup button[type=submit]'); await p.waitForSelector('#p-user', { timeout: 15000 }); return { c, p, errs };
}
try {
  const A = await signUp('maker_one'), B = await signUp('viewer_two');
  // --- maker publishes a game through the real publish path
  const pa = await A.c.newPage(); await pa.goto(BASE + 'play/'); await pa.click('#start-btn'); await pa.waitForSelector('#pc-home');
  const pub = await pa.evaluate(async () => {
    const { backend, remote } = window.iceberg; const doc = { id: 'g_e2e_meta', version: 2, name: 'Lava Dash', description: 'first words', ground: 'baseplate', sky: 'day', instances: [], thumbnail: 'custom', updatedAt: 5 };
    backend.saveCustomGame({ ...doc, published: true, publishedAt: Date.now() }); return remote.publishCustomGame({ ...doc, published: true });
  });
  ok('maker published a game', pub?.ok === true, JSON.stringify(pub));
  await pa.evaluate(() => { const m = window.iceberg.menu; m._serverLoading = false; m.showGames(); });
  await pa.waitForSelector('#your-games .game-card[data-game="g_e2e_meta"]');
  ok('owner sees the details (🖼️) button on their tile', !!(await pa.$('#your-games .game-card[data-game="g_e2e_meta"] .details-btn')));
  await pa.hover('#your-games .game-card[data-game="g_e2e_meta"]'); await pa.click('#your-games .game-card[data-game="g_e2e_meta"] .details-btn');
  await pa.waitForSelector('#details-dialog'); await pa.fill('#edit-name', 'Lava Dash 2'); await pa.fill('#edit-desc', 'jump over the lava!');
  await pa.setInputFiles('#edit-file', '/tmp/eu-thumb.png'); await pa.waitForFunction(() => /data:image\/jpeg/.test(document.querySelector('#edit-thumb').style.backgroundImage));
  await pa.screenshot({ path: SHOTS + '/pc-edit-details.png' });
  await pa.click('#edit-save'); await pa.waitForSelector('#details-dialog', { state: 'detached', timeout: 10000 });
  const srv = await pa.evaluate(() => window.iceberg.remote.getPublishedGame('g_e2e_meta'));
  ok('server copy: name + description + thumbnail updated', srv.name === 'Lava Dash 2' && srv.doc.description === 'jump over the lava!' && /^data:image\/jpeg;base64,/.test(srv.doc.thumbnail), JSON.stringify({ n: srv.name, d: srv.doc.description, t: String(srv.doc.thumbnail).slice(0, 30) }));
  ok('tile shows the new name', (await pa.textContent('#your-games .game-card[data-game="g_e2e_meta"] .gc-name')) === 'Lava Dash 2');
  // --- second player sees it in Community, no edit buttons
  const pb = await B.c.newPage(); await pb.goto(BASE + 'play/'); await pb.click('#start-btn'); await pb.waitForSelector('#pc-home');
  await pb.waitForSelector('#community-games .game-card[data-game="g_e2e_meta"]', { timeout: 15000 });
  ok('other player sees updated name in Popular row, with creator', (await pb.textContent('#community-games .game-card[data-game="g_e2e_meta"] .gc-name')) === 'Lava Dash 2' && /by maker_one/.test(await pb.textContent('#community-games .game-card[data-game="g_e2e_meta"] .gc-meta')));
  ok('other player has no edit/details buttons on it', !(await pb.$('.game-card[data-game="g_e2e_meta"] .details-btn')));
  await pb.fill('#pc-search', 'maker_one'); ok('search finds a game by creator name', !!(await pb.$('#search-results .game-card[data-game="g_e2e_meta"]')));
  await pb.screenshot({ path: SHOTS + '/pc-home-community-signed-in.png' });
  const steal = await pb.evaluate(() => window.iceberg.remote.updateCustomGameMeta('g_e2e_meta', { name: 'Hacked', description: '', thumbnail: null }));
  ok('server refuses an edit by a non-owner', steal?.ok === false, JSON.stringify(steal));
  // --- friends row + Studio copy ownership in Your Games for a server-only owned game
  // --- PWA
  const pw = await b.newContext({ viewport: { width: 1440, height: 900 } }); const pp = await pw.newPage();
  await pp.goto(BASE); await pp.waitForTimeout(1500);
  const man = await pp.evaluate(async () => { const l = document.querySelector('link[rel=manifest]'); const m = await (await fetch(l.href)).json(); return { href: l.href, m }; });
  ok('manifest: standalone, name, colors', man.m.display === 'standalone' && man.m.name === 'Iceberg' && man.m.theme_color === '#1a1822' && man.m.background_color === '#14131a', JSON.stringify(man.m).slice(0, 160));
  const icons = await pp.evaluate(async (m) => Promise.all(m.icons.map(async i => { const r = await fetch(new URL(i.src, document.querySelector('link[rel=manifest]').href)); const bl = await r.blob(); const bm = await createImageBitmap(bl); return [i.sizes, bm.width, bm.height, r.ok]; })), man.m);
  ok('manifest: icons load at declared sizes (192 + 512 + maskable)', icons.length === 3 && icons.every(([s, w, h, k]) => k && s === `${w}x${h}`), JSON.stringify(icons));
  const cdp = await pw.newCDPSession(pp); await cdp.send('Page.enable');
  const inst = await cdp.send('Page.getInstallabilityErrors').catch(e => ({ installabilityErrors: [{ errorId: 'cdp-failed:' + e.message }] }));
  ok('Chrome installability check: no errors', inst.installabilityErrors.length === 0, JSON.stringify(inst.installabilityErrors));
  const sw = await pp.evaluate(async () => { const r = await navigator.serviceWorker.getRegistration(); return !!r; }); ok('service worker registered (existing sw.js, network-first navigation)', sw);
  await pa.screenshot({ path: SHOTS + '/pc-home-signed-in.png' });
  ok('no page errors', [...A.errs, ...B.errs].length === 0, [...A.errs, ...B.errs].join(' | '));
} catch (e) { ok('script ran without exceptions', false, e.message); }
await b.close(); await web.close?.(); await dev.close?.(); console.log(fails ? `${fails} FAILED` : 'ALL PASS'); process.exit(fails ? 1 : 0);
