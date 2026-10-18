#!/usr/bin/env node
// `npm test` — full smoke suite. Everything is built fresh into /tmp (never dist/),
// and screenshots go to /tmp/iceberg-test/shots.
//   1. catalog check (cosmetics prices + safe-chat phrases valid)
//   2. real-Postgres DB tests (PGlite): migrations, RLS, RPCs, price sync
//   3. single-file game build: menu, 3 games, device toggle, mobile mode, picker, Mobile Studio
//   4. site build (portal + play/ + PWA) against the local dev backend at a sub-path:
//      sign-up, guest migration, Play-in-new-tab, server-synced economy + colors,
//      Safe Chat room with 2 players (bubbles, talking, dispose on leave, rate limit), friends,
//      demo bucks disabled, SW scope/caching.
//   5. multiplayer (local Realtime stub, real RLS): 3-4 browser clients see each other move + chat,
//      cosmetics from the server roster, cap + overflow instance, Join friend from the portal,
//      Realtime Authorization, junk/spoofed broadcasts dropped, message budget.
import { spawnSync } from 'node:child_process';
import { createServer } from 'node:net';
import { existsSync, mkdirSync, rmSync, writeFileSync, readFileSync, unlinkSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
// Parallel runs (other worktrees/agents) must not share the temp dir or ports: a second run used to
// rmSync the first run's built site mid-test (-> waitForSelector timeouts). Each run takes a free slot.
const alive = (pid) => { try { process.kill(pid, 0); return true; } catch { return false; } };
const portFree = (port) => new Promise((ok) => { const srv = createServer().once('error', () => ok(false)).once('listening', () => srv.close(() => ok(true))).listen(port); });
const BASE_PORTS = [54420, 8420, 54430, 8430, 54431, 8431];   // other tools (studio e2e, dev servers) may hold these too
let SLOT = 0;
for (; SLOT < 10; SLOT++) {
  const lock = `/tmp/iceberg-e2e-${SLOT}.lock`;
  let got = false;
  try { writeFileSync(lock, String(process.pid), { flag: 'wx' }); got = true; }
  catch { const pid = +readFileSync(lock, 'utf8'); if (!alive(pid)) { writeFileSync(lock, String(process.pid)); got = true; } }
  if (!got) continue;
  if ((await Promise.all(BASE_PORTS.map(p => portFree(p + SLOT * 20)))).every(Boolean)) break;
  unlinkSync(lock);
}
if (SLOT === 10) throw new Error('e2e: 10 runs already in progress');
process.on('exit', () => { try { if (readFileSync(`/tmp/iceberg-e2e-${SLOT}.lock`, 'utf8') === String(process.pid)) unlinkSync(`/tmp/iceberg-e2e-${SLOT}.lock`); } catch { /* gone */ } });
if (SLOT) console.log(`e2e: default ports/dir busy (another run?), using slot ${SLOT} (ports +${SLOT * 20}, /tmp/iceberg-test-s${SLOT})`);
// re-checked when each section starts: other tools (older e2e copies, dev servers) may grab a port mid-run
const PORT = async (n) => { for (let k = 0; k < 20; k++) { const p = n + SLOT * 20 + k * 300; if (await portFree(p)) return p; } throw new Error(`e2e: no free port near ${n}`); };
const TMP = process.env.ICEBERG_TEST_TMP || `/tmp/iceberg-test-s${SLOT}`;   // explicit override wins;   // never the legacy /tmp/iceberg-test, which older copies of this script wipe at start
const SHOTS = resolve(TMP, 'shots');
rmSync(TMP, { recursive: true, force: true }); mkdirSync(SHOTS, { recursive: true });
const only = process.argv.slice(2);
const want = (k) => !only.length || only.includes(k);

const results = [];
const check = (name, ok, extra = '') => { results.push([ok ? 'PASS' : 'FAIL', name, extra]); if (!ok) console.error('  FAIL', name, extra); };
const run = (name, cmd, args, opts = {}) => {
  const r = spawnSync(cmd, args, { cwd: ROOT, encoding: 'utf8', ...opts, env: { ...process.env, ...(opts.env || {}) } });
  const out = (r.stdout || '') + (r.stderr || '');
  check(name, r.status === 0, r.status === 0 ? '' : out.split('\n').slice(-25).join('\n'));
  return out;
};

if (want('catalog')) run('catalog: prices + phrases valid', 'node', ['scripts/sync-catalog.mjs', '--check']);

if (want('db')) {
  if (!existsSync(resolve(ROOT, 'tools/db/node_modules/@electric-sql/pglite'))) run('db tools install', 'npm', ['ci', '--prefix', 'tools/db', '--no-audit', '--no-fund']);
  const out = run('db: migrations/RLS/RPCs on real Postgres (PGlite)', 'node', ['tools/db/test-db.mjs']);
  const m = out.match(/(\d+)\/(\d+) DB tests passed/); if (m) console.log(`  db: ${m[0]}`);
}

const { chromium } = await import('playwright');
const launch = () => chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const watch = (page, errs) => {
  page.on('pageerror', e => errs.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/favicon|Failed to load resource: the server responded with a status of 40[14]/.test(m.text())) errs.push(m.text()); });
};

// ---------------- 3. single-file game build ----------------
if (want('game')) {
  const out = resolve(TMP, 'single');
  run('build: single-file game (vite build)', 'npx', ['vite', 'build', '--outDir', out, '--emptyOutDir', '--logLevel', 'warn']);
  const file = pathToFileURL(resolve(out, 'index.html')).href;
  const b = await launch();
  const page = await b.newPage({ viewport: { width: 1280, height: 800 } });
  const errs = []; watch(page, errs);
  await page.goto(file);
  await page.click('#start-btn'); await page.waitForSelector('.game-card');
  const cards = await page.$$eval('.game-card .gc-name', e => e.map(x => x.textContent));
  check('game: menu lists built-in games', cards.length >= 4, JSON.stringify(cards));
  const ids = await page.evaluate(() => [...document.querySelectorAll('.game-card')].map(c => c.dataset.game).filter(id => id && id !== 'creator'));
  for (const id of ids) {
    const ok = await page.evaluate(async (id) => { try { await window.iceberg.play(id); return !!window.iceberg.engine.running; } catch (e) { return 'ERR ' + e.message; } }, id);
    await page.waitForTimeout(700);
    await page.screenshot({ path: resolve(SHOTS, `game-${id}.png`) });
    check(`game: ${id} loads`, ok === true, String(ok));
    await page.evaluate(() => window.iceberg.goHome());
  }
  const coins0 = await page.evaluate(() => window.iceberg.economy.coins);
  await page.evaluate(() => window.iceberg.economy.earn(5, 'Pickup'));
  check('game: guest earn works offline', (await page.evaluate(() => window.iceberg.economy.coins)) === coins0 + 5);
  check('game: demo grant allowed in non-site builds', (await page.evaluate(() => window.iceberg.economy.demoGrant(10))) === 10);
  check('game: no page errors', errs.length === 0, errs.join(' | '));
  await page.close();

  const r = spawnSync('node', ['scripts/device-smoke.mjs', resolve(out, 'index.html')], { cwd: ROOT, encoding: 'utf8' });
  check('device: Help toggle enabled + switches mode + window event', r.status === 0, (r.stdout + r.stderr).slice(-600));

  const ms = spawnSync('node', ['scripts/mobile-studio-e2e.mjs', resolve(out, 'index.html')], { cwd: ROOT, encoding: 'utf8', env: { ...process.env, MS_SHOTS: SHOTS } });
  const msSum = (ms.stdout.match(/\d+\/\d+ mobile studio checks passed/) || [''])[0]; if (msSum) console.log(`  ${msSum}`);
  check('mobile studio: phone viewport build/save/test-play (scripts/mobile-studio-e2e.mjs)', ms.status === 0, (ms.stdout + ms.stderr).split('\n').filter(l => /FAIL|Error/.test(l)).join('\n').slice(-1500));

  const p2 = await b.newPage({ viewport: { width: 1280, height: 800 } });
  const errs2 = []; watch(p2, errs2);
  await p2.goto(file + '?devicePicker=1');
  await p2.waitForSelector('#device-picker');
  const suggested = await p2.$eval('.device-opt.selected', e => e.dataset.mode);
  check('picker: shown first with detected device pre-selected', suggested === 'computer', suggested);
  await p2.screenshot({ path: resolve(SHOTS, 'device-picker.png') });
  await p2.click('.device-opt[data-mode="mobile"]'); await p2.click('#device-go');
  await p2.waitForSelector('#start-btn');
  check('picker: choice saved', (await p2.evaluate(() => localStorage.getItem('iceberg:v1:deviceMode'))) === 'mobile');
  await p2.click('#start-btn'); await p2.waitForSelector('.game-card');
  const creatorShown = await p2.evaluate(() => { const c = document.querySelector('.game-card[data-game="creator"]'); return !!c && getComputedStyle(c).display !== 'none'; });
  check('mobile: Create card shown (opens Mobile Studio)', creatorShown);
  await p2.evaluate(() => window.iceberg.play('frost-fields')); await p2.waitForTimeout(800);
  const touchVisible = await p2.evaluate(() => { const t = document.getElementById('touch-ui'); return !!t && !t.classList.contains('hidden'); });
  check('mobile: touch controls visible in game', touchVisible);
  const before = await p2.evaluate(() => window.iceberg.engine.player.pos.toArray());
  const box = await p2.$eval('#touch-stick', e => { const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  await p2.mouse.move(box.x, box.y); await p2.mouse.down(); await p2.mouse.move(box.x, box.y - 60, { steps: 4 });
  await p2.waitForTimeout(700); await p2.mouse.up();
  const after = await p2.evaluate(() => window.iceberg.engine.player.pos.toArray());
  const moved = Math.hypot(after[0] - before[0], after[2] - before[2]);
  check('mobile: joystick moves the player', moved > 0.5, `moved ${moved.toFixed(2)}`);
  await p2.screenshot({ path: resolve(SHOTS, 'mobile-touch.png') });
  await p2.goto(file);  // reload without the param: picker skipped because a choice is saved
  await p2.waitForSelector('#start-btn');
  check('picker: skipped once saved', !(await p2.$('#device-picker')));
  check('mobile: no page errors', errs2.length === 0, errs2.join(' | '));
  await b.close();
}

// ---------------- 4. site + dev backend ----------------
if (want('site')) {
  const { startDevServer, serveStatic, ANON_KEY } = await import(resolve(ROOT, 'tools/db/dev-server.mjs'));
  const API = await PORT(54420), WEB = await PORT(8420), BASE = `http://localhost:${WEB}/iceberg/`;
  const siteOut = resolve(TMP, 'site');
  run('build: site (portal + play/ + PWA)', 'node', ['scripts/build-site.mjs', '--out', siteOut],
    { env: { VITE_SUPABASE_URL: `http://localhost:${API}`, VITE_SUPABASE_ANON_KEY: ANON_KEY, VITE_USERNAME_EMAIL_DOMAIN: 'users.iceberg.test' } });
  const dev = await startDevServer({ port: API, quiet: true });
  const web = await serveStatic(siteOut, WEB, { prefix: '/iceberg/' });
  const b = await launch();
  const api = async (token, fn, args = {}) => (await fetch(`http://localhost:${API}/rest/v1/rpc/${fn}`, { method: 'POST',
    headers: { apikey: ANON_KEY, 'content-type': 'application/json', authorization: `Bearer ${token || ANON_KEY}` }, body: JSON.stringify(args) })).json();
  try {
    // --- player 1: guest progress, then sign up -> migration
    const c1 = await b.newContext({ viewport: { width: 1280, height: 860 } });
    const p1 = await c1.newPage(); const e1 = []; watch(p1, e1);
    await p1.goto(BASE);
    await p1.waitForSelector('#view-games .game-card');
    check('site: portal at root lists games', (await p1.$$('#view-games .game-card')).length >= 3);
    const sw = await p1.evaluate(async () => { const r = await navigator.serviceWorker.ready; return r.scope; });
    check('pwa: service worker registered with sub-path scope', sw === BASE, sw);
    const man = await p1.evaluate(async () => { const l = document.querySelector('link[rel=manifest]'); const r = await fetch(l.href); const j = await r.json(); return { ok: r.ok, scope: j.scope, icons: j.icons.length, url: l.href }; });
    check('pwa: manifest loads (relative scope, icons)', man.ok && man.scope === './' && man.icons >= 2, JSON.stringify(man));
    const iconOk = await p1.evaluate(async () => (await fetch('icons/icon-512.png')).ok);
    check('pwa: icons served', iconOk);
    await p1.evaluate(() => localStorage.setItem('iceberg:v1:profile', JSON.stringify({ coins: 300, demoGranted: 0, owned: ['cap', 'icerocket'], equipped: { hat: 'cap', back: 'icerocket' },
      cosmeticColors: { earmuffs: '#2f6f4a' }, rocketColors: { body: '#ff0000', fins: '#3f8fd0', trim: '#7fe3ff' } })));
    await p1.click('#p-signin-open');
    await p1.fill('#form-signup input[name=username]', 'frosty_fox');
    await p1.fill('#form-signup input[name=password]', 'snowball123');
    await p1.fill('#form-signup input[name=display]', 'Frosty');
    await p1.click('#form-signup button[type=submit]');
    await p1.waitForSelector('#p-user', { timeout: 15000 });
    const prof1 = await p1.evaluate(() => window.icebergPortal.economy.profile);
    check('auth: username/password sign-up signs in', prof1.username === 'frosty_fox');
    check('migration: guest coins + cheap items carried, premium dropped', prof1.coins === 300 && prof1.owned.join() === 'cap', JSON.stringify({ c: prof1.coins, o: prof1.owned }));
    check('migration: cosmeticColors + rocketColors carried', prof1.cosmeticColors.earmuffs === '#2f6f4a' && prof1.rocketColors.body === '#ff0000');
    const guestMarked = await p1.evaluate(() => JSON.parse(localStorage.getItem('iceberg:v1:profile')).migratedTo);
    check('migration: guest profile marked (moves to one account only)', !!guestMarked);
    const token1 = await p1.evaluate(() => JSON.parse(localStorage.getItem('iceberg:v1:session')).access_token);
    await p1.screenshot({ path: resolve(SHOTS, 'portal-games.png') });

    // --- Play opens play/ in a new tab with the shared session
    const [g1] = await Promise.all([c1.waitForEvent('page'), p1.click('#view-games .game-card[data-game="frost-fields"] .btn.play')]);
    const eg = []; watch(g1, eg);
    await g1.waitForLoadState();
    check('portal: Play opens play/?game= in a new tab', g1.url() === BASE + 'play/?game=frost-fields', g1.url());
    await g1.waitForSelector('#start-btn'); await g1.click('#start-btn');
    await g1.waitForFunction(() => window.iceberg?.engine?.running && window.iceberg.engine.def?.id === 'frost-fields', null, { timeout: 15000 });
    check('play: game auto-starts from ?game=', true);
    check('play: signed in from shared session', await g1.evaluate(() => window.iceberg.economy.signedIn));
    await g1.evaluate(() => window.iceberg.economy.flush());
    let s = await api(token1, 'get_my_profile');
    check('economy: daily bonus credited on server', s.coins === 400, String(s.coins));
    await g1.evaluate(() => { const e = window.iceberg.economy; e.earn(5, 'Pickup'); e.earn(5, 'Pickup'); e.spend(25, 'Skip stage'); });
    check('economy: optimistic balance immediately', (await g1.evaluate(() => window.iceberg.economy.coins)) === 385);
    await g1.evaluate(() => window.iceberg.economy.flush());
    s = await api(token1, 'get_my_profile');
    check('economy: server agrees after flush', s.coins === 385 && (await g1.evaluate(() => window.iceberg.economy.coins)) === 385, String(s.coins));
    await g1.evaluate(() => window.iceberg.economy.earn(500, 'Pickup'));     // per-call cap 5 on the server
    await g1.evaluate(() => window.iceberg.economy.flush());
    check('economy: server cap corrects optimistic balance', (await g1.evaluate(() => window.iceberg.economy.coins)) === 390);
    const buy = await g1.evaluate(() => { const r = window.iceberg.economy.buy('beanie'); window.iceberg.economy.equip('beanie'); return r.ok; });
    await g1.evaluate(async () => { window.iceberg.economy.setCosmeticColor('earmuffs', '#b3243c'); window.iceberg.economy.setRocketColor('fins', '#123456'); await window.iceberg.economy.syncLoadoutNow(); });
    s = await api(token1, 'get_my_profile');
    check('economy: buy_cosmetic on server (server price)', buy && s.owned.includes('beanie') && s.coins === 330, JSON.stringify({ c: s.coins, o: s.owned }));
    check('sync: equipped + cosmeticColors + rocketColors saved on server', s.equipped.hat === 'beanie' && s.cosmeticColors.earmuffs === '#b3243c' && s.rocketColors.fins === '#123456', JSON.stringify([s.equipped, s.cosmeticColors, s.rocketColors]));
    check('site: demo grants disabled in production build', (await g1.evaluate(() => window.iceberg.economy.demoGrant(5000))) === 0);
    await g1.evaluate(() => window.iceberg.ui.openDrawer?.('store')); await g1.waitForTimeout(300);
    const demoUi = await g1.evaluate(() => [...document.querySelectorAll('.dev, .dev-grant, .packs .price-btn')].filter(e => getComputedStyle(e).display !== 'none').length);
    check('site: demo pack / dev grant buttons hidden', demoUi === 0, String(demoUi));
    await g1.screenshot({ path: resolve(SHOTS, 'play-store-site.png') });
    await g1.evaluate(() => window.iceberg.ui.closeDrawer?.());
    // in-game Safe Chat bubble + talking
    await g1.click('#game-chat-btn'); await g1.click('#safe-chat-menu .sc-sub[data-section="hello"]');
    await g1.click('#safe-chat-menu .sc-phrase[data-phrase="hi"]');
    await g1.waitForSelector('.speech-bubble:not(.hidden)', { timeout: 5000 });
    check('game chat: bubble over own avatar', (await g1.$eval('.speech-bubble:not(.hidden)', e => e.textContent)) === 'Hi!');
    check('game chat: avatar.talk() animates mouth', await g1.evaluate(() => window.iceberg.avatar.isTalking?.() ?? 'no-api') === true);
    await g1.screenshot({ path: resolve(SHOTS, 'game-chat-bubble.png') });
    check('play: no page errors', eg.length === 0, eg.join(' | '));
    await g1.close();

    // --- Giant Rainbow Obby: per-game save data + server-validated gears (via the game's own buyGear)
    const ob = await c1.newPage(); const eo = []; watch(ob, eo);
    await ob.goto(BASE + 'play/?game=giant-rainbow-obby');
    await ob.waitForSelector('#start-btn'); await ob.click('#start-btn');
    await ob.waitForFunction(() => window.iceberg?.engine?.game?.obby, null, { timeout: 20000 });
    await ob.waitForTimeout(500);
    const live = Object.fromEntries((await api(null, 'list_game_stats')).map(g => [g.gameId, g]));
    check('stats: play page records a visit + heartbeat (live player)', live['giant-rainbow-obby'].playing >= 1 && live['giant-rainbow-obby'].visits7d >= 1, JSON.stringify(live['giant-rainbow-obby']));
    const coinsBefore = (await api(token1, 'get_my_profile')).coins;
    const bought = await ob.evaluate(() => window.iceberg.engine.game.obby.buyGear('speedCoil'));
    await ob.waitForTimeout(900); await ob.evaluate(() => window.iceberg.economy.flush());
    const owns = await api(token1, 'owns_gear', { p_game_id: 'giant-rainbow-obby', p_gear_id: 'speedCoil' });
    const ownsElsewhere = await api(token1, 'owns_gear', { p_game_id: 'rainbow-obby', p_gear_id: 'speedCoil' });
    const after = (await api(token1, 'get_my_profile')).coins;
    check('gears: Giant Obby purchase recorded by buy_gear (server price 75)', bought && owns === true && coinsBefore - after === 75, JSON.stringify({ bought, owns, coinsBefore, after }));
    check('gears: ownership scoped to the game it was bought in', ownsElsewhere === false);
    const gd = await api(token1, 'load_game_data', { p_game_id: 'giant-rainbow-obby' });
    check('game data: Giant Obby save stored server-side (game_data)', gd && typeof gd.checkpoint === 'number' && gd.gears.includes('speedCoil'), JSON.stringify(gd));
    await ob.evaluate(() => { const e = window.iceberg.economy; const d = e.cachedGameData('giant-rainbow-obby'); return e.saveGameData('giant-rainbow-obby', { ...d, gears: [...d.gears, 'magicCarpet'] }); });
    await ob.evaluate(() => window.iceberg.economy.flush());
    check('game data: gears in save data are not trusted', (await api(token1, 'owns_gear', { p_game_id: 'giant-rainbow-obby', p_gear_id: 'magicCarpet' })) === false);
    const lg = await ob.evaluate(async () => { const p = window.iceberg.economy.loadGameData('giant-rainbow-obby'); const cached = !!p.cached; const v = await p; return { cached, gears: v.gears }; });
    check('economy.loadGameData: Promise + sync cached value; gears from server', lg.cached && lg.gears.join() === 'speedCoil', JSON.stringify(lg));
    await ob.reload(); await ob.waitForSelector('#start-btn'); await ob.click('#start-btn');
    await ob.waitForFunction(() => window.iceberg?.engine?.game?.obby, null, { timeout: 20000 });
    const saveGears = await ob.evaluate(() => window.iceberg.engine.game.obby.save.gears);
    check('gears: still owned after reload (from server), tampered gear gone', saveGears.join() === 'speedCoil', JSON.stringify(saveGears));
    await ob.screenshot({ path: resolve(SHOTS, 'giant-obby-gear.png') });
    check('giant obby: no page errors', eo.length === 0, eo.join(' | '));
    await ob.close();

    // --- player 2 + Safe Chat room
    const c2 = await b.newContext({ viewport: { width: 1100, height: 800 } });
    const p2 = await c2.newPage(); const e2 = []; watch(p2, e2);
    await p2.goto(BASE + '?view=account');
    await p2.fill('#form-signup input[name=username]', 'polar_pal');
    await p2.fill('#form-signup input[name=password]', 'iglooigloo');
    await p2.click('#form-signup button[type=submit]');
    await p2.waitForSelector('#p-user', { timeout: 15000 });
    await p1.click('.p-tab[data-view="chat"]'); await p2.click('.p-tab[data-view="chat"]');
    await p1.waitForSelector('#chat-room canvas'); await p2.waitForSelector('#chat-room canvas');
    await p2.waitForFunction(() => document.querySelector('#chat-status')?.textContent.startsWith('2 here'), null, { timeout: 12000 });
    check('chat room: both players present', true);
    await p1.waitForFunction(() => document.querySelector('#chat-status')?.textContent.startsWith('2 here'), null, { timeout: 12000 });
    await p1.click('#chat-open');
    await p1.click('#safe-chat-menu .sc-sub[data-section="games"]');
    await p1.click('#safe-chat-menu .sc-sub[data-section="Let\'s play"]');
    await p1.click('#safe-chat-menu .sc-phrase[data-phrase="lets_play_the_rainbow_obby"]');
    await p2.waitForFunction(() => [...document.querySelectorAll('.speech-bubble:not(.hidden)')].some(e => e.textContent === "Let's play the Rainbow Obby!"), null, { timeout: 8000 });
    check('chat room: other player sees bubble (nested menu phrase)', true);
    const tags = await p2.evaluate(() => [...document.querySelectorAll('.name-tag')].map(e => e.textContent));
    check('chat room: name tags for both avatars', tags.length === 2, JSON.stringify(tags));
    check('chat room: speaker avatar talking (avatar.talk)', await p2.evaluate(() => window.icebergPortal.chatRoom.members.get('frosty_fox').avatar.isTalking?.()) === true);
    await p2.screenshot({ path: resolve(SHOTS, 'chat-room.png') });
    const rl = await p1.evaluate(async () => { const room = window.icebergPortal.chatRoom; const a = await room.say({ id: 'yes', text: 'Yes!' }); const b = await room.say({ id: 'no', text: 'No.' }); return [a.ok, b.reason, document.querySelector('#chat-status').textContent]; });
    check('chat: server rate limit (2 s) surfaced in the room', rl[1] === 'rate_limited' && /Slow down/.test(rl[2]), JSON.stringify(rl));
    const bad = await api(token1, 'post_chat', { p_room: 'lobby', p_phrase_id: 'free_text_here' });
    check('chat: free text / unknown phrase rejected by server', bad.reason === 'invalid_phrase');
    // leaving disposes the avatar on the other side
    await p1.evaluate(() => { window.__disposed = 0; const a = window.icebergPortal.chatRoom.members.get('polar_pal').avatar; const d = a.dispose?.bind(a); a.dispose = () => { window.__disposed++; d?.(); }; });
    await p2.click('.p-tab[data-view="friends"]');       // p2 leaves the chat room
    await p1.waitForFunction(() => document.querySelector('#chat-status')?.textContent.startsWith('1 here'), null, { timeout: 12000 })
      .then(() => {}, () => {});
    check('chat room: leaver removed and avatar.dispose() called', (await p1.evaluate(() => window.__disposed)) === 1);
    // friends
    await p1.click('.p-tab[data-view="friends"]');
    await p1.fill('#friend-name', 'polar_pal'); await p1.click('#friend-form button');
    await p1.waitForFunction(() => /Request sent/.test(document.querySelector('#friend-msg')?.textContent || ''));
    await p2.click('.p-tab[data-view="games"]'); await p2.click('.p-tab[data-view="friends"]');
    await p2.waitForSelector('.p-friend[data-user="frosty_fox"] button', { timeout: 10000 }).catch(async (e) => {
      console.error('friends debug:', await p2.evaluate(() => document.querySelector('#view-friends')?.innerText), await api(await p2.evaluate(() => JSON.parse(localStorage.getItem('iceberg:v1:session')).access_token), 'list_friends'));
      throw e;
    });
    await p2.click('.p-friend[data-user="frosty_fox"] button:has-text("Accept")');
    await p2.waitForFunction(() => /Friends \(1\)/.test(document.querySelector('#friends-lists')?.textContent || ''));
    await p1.click('.p-tab[data-view="games"]'); await p1.click('.p-tab[data-view="friends"]');
    await p1.waitForFunction(() => /Friends \(1\)/.test(document.querySelector('#friends-lists')?.textContent || ''));
    check('friends: request + accept by exact username', true);
    await p1.screenshot({ path: resolve(SHOTS, 'friends.png') });
    // --- featured banner + game tabs (online)
    await p1.click('.p-tab[data-view="games"]');
    await p1.waitForSelector('#featured-banner .fb-slide');
    const fb = await p1.evaluate(async () => {
      const el = document.querySelector('#featured-banner');
      const img = getComputedStyle(el.querySelector('.fb-img')).backgroundImage.match(/url\("?(.*?)"?\)/)[1];
      return { first: el.querySelector('.fb-slide').dataset.game, dots: el.querySelectorAll('.fb-dot').length, imgOk: (await fetch(img)).ok, title: el.querySelector('.fb-title').textContent };
    });
    check('featured: banner shows Giant Rainbow Obby first, 2 dots, image loads', fb.first === 'giant-rainbow-obby' && fb.dots === 2 && fb.imgOk, JSON.stringify(fb));
    await p1.click('#featured-banner .fb-next');
    check('featured: arrow goes to BIRG HQ', (await p1.$eval('#featured-banner .fb-slide', e => e.dataset.game)) === 'birg-hq');
    await p1.hover('#featured-banner .fb-title');
    check('featured: pauses on hover', await p1.evaluate(() => window.icebergPortal.banner.rotating === false && document.querySelector('#featured-banner').dataset.paused === 'true'));
    await p1.mouse.move(5, 5);
    check('featured: auto-rotates when not hovered', await p1.evaluate(() => window.icebergPortal.banner.rotating === true));
    const [fbTab] = await Promise.all([c1.waitForEvent('page'), p1.click('#featured-banner .fb-play')]);
    await fbTab.waitForLoadState();
    check('featured: Play opens the game in a new tab', fbTab.url() === BASE + 'play/?game=birg-hq', fbTab.url());
    await fbTab.close();
    const rm = await b.newContext({ reducedMotion: 'reduce' }); const rp = await rm.newPage();
    await rp.goto(BASE); await rp.waitForSelector('#featured-banner .fb-slide');
    check('featured: no auto-rotation with prefers-reduced-motion', await rp.evaluate(() => window.icebergPortal.banner.rotating === false && document.querySelector('#featured-banner').dataset.reducedMotion === 'true'));
    await rm.close();
    // make the ranking deterministic: BIRG HQ gets 2 visits, Frost Fields gets a live player
    const token2 = (await (await fetch(`http://localhost:${API}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { apikey: ANON_KEY, 'content-type': 'application/json' }, body: JSON.stringify({ email: 'polar_pal@users.iceberg.test', password: 'iglooigloo' }) })).json()).access_token;
    await api(token1, 'record_visit', { p_game_id: 'birg-hq' }); await api(token2, 'record_visit', { p_game_id: 'birg-hq' });
    await api(token1, 'record_visit', { p_game_id: 'birg-hq' });                       // deduped
    await api(token2, 'game_heartbeat', { p_game_id: 'frost-fields' });
    await api(token1, 'game_heartbeat', { p_game_id: 'frost-fields' });                // one row per user: moves player 1 off Giant Obby
    await p1.reload(); await p1.waitForSelector('#games-grid .game-card');
    const order = async (sort) => { await p1.click(`#games-sort button[data-sort="${sort}"]`); await p1.waitForTimeout(150); return p1.$$eval('#games-grid .game-card', e => e.map(x => x.dataset.game)); };
    const newest = await order('newest'), popular = await order('popular'), active = await order('active');
    check('tabs: Newest = publish date, newest first', newest.join() === 'giant-rainbow-obby,birg-hq,frost-fields', newest.join());
    check('tabs: Most Popular = 7-day plays (deduped), ties by all-time then newest', popular[0] === 'birg-hq' && popular.indexOf('giant-rainbow-obby') < popular.indexOf('frost-fields'), popular.join());
    check('tabs: Most Active Players = live heartbeats', active[0] === 'frost-fields' && /2 playing now/.test(await p1.$eval('#games-grid .game-card', e => e.textContent)), active.join());
    await p1.screenshot({ path: resolve(SHOTS, 'portal-featured-tabs.png') });
    check('portal: no page errors', e1.length === 0 && e2.length === 0, [...e1, ...e2].join(' | '));
    // sign out + wrong password (the browser logs the expected 400 from /auth/v1/token)
    await p2.click('#p-signout'); await p2.waitForSelector('#p-signin-open');
    await p2.click('#p-signin-open'); await p2.fill('#form-signin input[name=username]', 'polar_pal'); await p2.fill('#form-signin input[name=password]', 'wrongpass1');
    await p2.click('#form-signin button[type=submit]');
    await p2.waitForFunction(() => /Wrong username or password/.test(document.querySelector('#form-signin .p-error')?.textContent || ''));
    check('auth: wrong password rejected, signed out cleanly', true);
    // service worker must not cache API/auth
    const cached = await p1.evaluate(async () => { const out = []; for (const k of await caches.keys()) for (const r of await (await caches.open(k)).keys()) out.push(r.url); return out; });
    check('pwa: SW cached the shell only (no auth/API URLs)', cached.length > 0 && !cached.some(u => /\/(auth|rest)\/v1/.test(u) || u.includes(`:${API}`)), JSON.stringify(cached));
  } catch (e) { check('site: unexpected error', false, e.stack); }
  finally { await b.close(); web.close(); await dev.close(); }

  // --- offline site (no backend configured): banner from featured.json, local dates/plays
  const offOut = resolve(TMP, 'site-offline');
  run('build: site without backend (offline/guest)', 'node', ['scripts/build-site.mjs', '--out', offOut], { env: { VITE_SUPABASE_URL: '', VITE_SUPABASE_ANON_KEY: '' } });
  const web2 = await serveStatic(offOut, WEB + 1, { prefix: '/iceberg/' });
  const b2 = await launch();
  try {
    const c = await b2.newContext(); const p = await c.newPage(); const eoff = []; watch(p, eoff);
    const today = new Date().toISOString().slice(0, 10), old = new Date(Date.now() - 8 * 86400000).toISOString().slice(0, 10);
    await p.goto(`http://localhost:${WEB + 1}/iceberg/`);
    await p.evaluate(({ today, old }) => localStorage.setItem('iceberg:v1:playCounts', JSON.stringify({ 'frost-fields': { [today]: 3 }, 'birg-hq': { [old]: 50, [today]: 1 } })), { today, old });
    await p.reload(); await p.waitForSelector('#featured-banner .fb-slide'); await p.waitForSelector('#games-grid .game-card');
    check('offline: featured banner from site featured.json', (await p.$eval('#featured-banner .fb-slide', e => e.dataset.game)) === 'giant-rainbow-obby');
    const ord = async (sort) => { await p.click(`#games-sort button[data-sort="${sort}"]`); await p.waitForTimeout(150); return p.$$eval('#games-grid .game-card', e => e.map(x => x.dataset.game)); };
    check('offline: Newest uses local publish dates', (await ord('newest')).join() === 'giant-rainbow-obby,birg-hq,frost-fields');
    const pop = await ord('popular');
    check('offline: Most Popular = local plays in last 7 days (8-day-old plays ignored)', pop[0] === 'frost-fields' && pop[1] === 'birg-hq', pop.join());
    await ord('active');
    check('offline: Most Active shows "not available offline"', /not available offline/.test(await p.$eval('#games-note', e => e.textContent)));
    check('offline: no sign-in, no page errors', !(await p.$('#p-signin-open')) && eoff.length === 0, eoff.join(' | '));
    await p.screenshot({ path: resolve(SHOTS, 'portal-offline.png') });
  } catch (e) { check('offline site: unexpected error', false, e.stack); }
  finally { await b2.close(); web2.close(); }
}


// ---------------- 5. multiplayer ----------------
if (want('mp')) {
  const { startDevServer, serveStatic, ANON_KEY } = await import(resolve(ROOT, 'tools/db/dev-server.mjs'));
  const { PHRASES } = await import(pathToFileURL(resolve(ROOT, 'src/data/safeChat.js')).href);
  const API = await PORT(54430), WEB = await PORT(8430), BASE = `http://localhost:${WEB}/iceberg/`;
  const out = resolve(TMP, 'site-mp');
  run('build: site for multiplayer (local backend + realtime stub)', 'node', ['scripts/build-site.mjs', '--out', out],
    { env: { VITE_SUPABASE_URL: `http://localhost:${API}`, VITE_SUPABASE_ANON_KEY: ANON_KEY, VITE_USERNAME_EMAIL_DOMAIN: 'users.iceberg.test' } });
  const dev = await startDevServer({ port: API, quiet: true });
  const web = await serveStatic(out, WEB, { prefix: '/iceberg/' });
  const b = await launch();
  const authed = async (path, body) => (await fetch(`http://localhost:${API}${path}`, { method: 'POST', headers: { apikey: ANON_KEY, 'content-type': 'application/json' }, body: JSON.stringify(body) })).json();
  const api = async (token, fn, args = {}) => (await fetch(`http://localhost:${API}/rest/v1/rpc/${fn}`, { method: 'POST',
    headers: { apikey: ANON_KEY, 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: JSON.stringify(args) })).json();
  const users = {};
  for (const n of ['mp_ana', 'mp_ben', 'mp_cat', 'mp_dov']) {
    const r = await authed('/auth/v1/signup', { email: `${n}@users.iceberg.test`, password: 'icecream9', data: { username: n, display_name: n.slice(3).toUpperCase() } });
    users[n] = { token: r.access_token, session: { access_token: r.access_token, refresh_token: r.refresh_token, expires_at: r.expires_at, user: { id: r.user.id, username: n } } };
  }
  const friends = async (a, z) => { await api(users[a].token, 'send_friend_request', { p_username: z }); await api(users[z].token, 'respond_friend_request', { p_username: a, p_accept: true }); };
  await friends('mp_ana', 'mp_ben'); await friends('mp_ana', 'mp_dov'); await friends('mp_cat', 'mp_dov');
  await dev.db.query(`insert into public.inventory (user_id, item_id, source) select id, 'earmuffs', 'admin' from public.profiles where username = 'mp_ana'`);   // test fixture (local db only)
  const pages = {}; const errs = {};
  const open = async (n, url) => {
    const c = pages[n]?.context() || await b.newContext({ viewport: { width: 560, height: 380 } });
    const p = await c.newPage(); errs[n] = errs[n] || []; watch(p, errs[n]);
    await p.goto(BASE); await p.evaluate((s) => localStorage.setItem('iceberg:v1:session', JSON.stringify(s)), users[n].session);
    await p.goto(BASE + url);
    try { await p.waitForSelector('#start-btn'); } catch (e) {
      await p.screenshot({ path: resolve(SHOTS, `mp-open-fail-${n}.png`) }).catch(() => {});
      throw new Error(`${n}: no start button. errors: ${errs[n].join(' | ')} | text: ${(await p.evaluate(() => document.body.innerText).catch(() => '?')).slice(0, 300)}`);
    }
    await p.click('#start-btn');
    await p.waitForFunction(() => window.iceberg?.mp?.info?.instance, null, { timeout: 20000 });
    pages[n] = p; return p;
  };
  const info = (n) => pages[n].evaluate(() => window.iceberg.mp.info);
  const waitOthers = (n, names, ms = 15000) => pages[n].waitForFunction((names) => { const i = window.iceberg.mp.info; const vis = (i?.others || []).filter(o => o.visible).map(o => o.username).sort(); return JSON.stringify(vis) === JSON.stringify(names); }, names.slice().sort(), { timeout: ms });
  try {
    const t0 = Date.now();
    await open('mp_ana', 'play/?game=frost-fields');
    // ANA equips her earmuffs through the normal client path (save_loadout) before the others arrive
    await pages.mp_ana.evaluate(async () => { const e = window.iceberg.economy; await e.flush(); if (!e.isEquipped('earmuffs')) e.equip('earmuffs'); await e.syncLoadoutNow(); });
    await open('mp_ben', 'play/?game=frost-fields'); await open('mp_cat', 'play/?game=frost-fields');
    const ia = await info('mp_ana'), ib = await info('mp_ben'), ic = await info('mp_cat');
    check('mp: 3 players auto-placed in the same instance', ia.instance === 1 && ib.instance === 1 && ic.instance === 1 && ia.topic === 'game:frost-fields:1', JSON.stringify([ia.instance, ib.instance, ic.instance]));
    let seen = true; try { await waitOthers('mp_ana', ['mp_ben', 'mp_cat']); await waitOthers('mp_ben', ['mp_ana', 'mp_cat']); await waitOthers('mp_cat', ['mp_ana', 'mp_ben']); } catch { seen = false; }
    check('mp: every client sees the other two avatars', seen, JSON.stringify((await info('mp_ana')).others));
    check('mp: cosmetics come from the server roster (ANA wears her earmuffs for others)', (await info('mp_ben')).others.find(o => o.username === 'mp_ana')?.equipped.includes('earmuffs'), JSON.stringify((await info('mp_ben')).others));
    check('mp: chat room is per instance', (await pages.mp_ana.evaluate(() => window.iceberg.gameChat.room)) === 'game:frost-fields:1');
    // movement + interpolation
    const startB = (await info('mp_ben')).others.find(o => o.username === 'mp_ana').pos;
    const s0 = (await info('mp_ana')).stats.sent, tm0 = Date.now();
    // walk 9 units/s along +x for 1.5 s (driven by a timer, so it doesn't depend on swiftshader frame rate)
    await pages.mp_ana.evaluate(() => new Promise((ok) => { const pl = window.iceberg.engine.player; let n = 0; const id = setInterval(() => { pl.pos.x += 0.45; if (++n >= 30) { clearInterval(id); ok(); } }, 50); }));
    const sentHz = ((await info('mp_ana')).stats.sent - s0) / ((Date.now() - tm0) / 1000);
    await pages.mp_ben.waitForTimeout(1500);
    const realA = await pages.mp_ana.evaluate(() => window.iceberg.engine.player.pos.toArray());
    const seenA = (await info('mp_ben')).others.find(o => o.username === 'mp_ana').pos;
    const moved = Math.hypot(seenA[0] - startB[0], seenA[2] - startB[2]), err = Math.hypot(seenA[0] - realA[0], seenA[2] - realA[2]);
    check('mp: others see ANA walk (interpolated, settles on her real position)', moved > 3 && err < 0.3, JSON.stringify({ moved, err, seenA, realA }));
    check('mp: sender rate limited to <= 10 Hz while moving', sentHz > 3 && sentHz <= 10.5, sentHz.toFixed(1));
    // chat: phrase -> server -> bubble over ANA's avatar + her mouth moves on BEN's and CAT's screens
    const phrase = PHRASES.find(p => /hello/i.test(p.text)) || PHRASES[0];
    const said = await pages.mp_ana.evaluate((p) => window.iceberg.gameChat.say(p), { id: phrase.id, text: phrase.text });
    check('mp: chat post accepted by the server (phrase id)', said?.ok === true, JSON.stringify(said));
    let bubble = true;
    try { for (const n of ['mp_ben', 'mp_cat']) await pages[n].waitForFunction(() => window.iceberg.gameChat.bubbles.isShowing('mp_ana') && window.iceberg.mp.info.others.find(o => o.username === 'mp_ana')?.talking, null, { timeout: 6000 }); } catch { bubble = false; }
    check('mp: bubble above ANA + avatar.talk() on the other clients (< 6 s, via hint + re-poll)', bubble);
    check('mp: bubble text is the catalog phrase', (await pages.mp_ben.evaluate(() => [...document.querySelectorAll('.speech-bubble')].map(e => e.textContent))).includes(phrase.text));
    await pages.mp_ben.screenshot({ path: resolve(SHOTS, 'mp-ben-sees-ana.png') });
    // junk / spoofed / free-text broadcasts and an outsider socket (raw Phoenix frames from CAT's page)
    const dropped0 = (await info('mp_ana')).stats.dropped;
    const raw = await pages.mp_cat.evaluate(async ({ api, key, tok, outsider }) => {
      const sock = (t) => new Promise((ok) => { const ws = new WebSocket(`${api.replace('http', 'ws')}/realtime/v1/websocket?apikey=${key}&vsn=1.0.0`); ws.onopen = () => ok(ws); });
      const join = (ws, t) => new Promise((ok) => { ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.event === 'phx_reply' && m.ref === '1') ok(m.payload.status); }; ws.send(JSON.stringify({ topic: 'realtime:game:frost-fields:1', event: 'phx_join', ref: '1', join_ref: '1', payload: { config: { private: true, broadcast: { self: false }, presence: { key: 'x' } }, access_token: t } })); });
      const ws = await sock(); const st = await join(ws, tok);
      const send = (event, payload) => ws.send(JSON.stringify({ topic: 'realtime:game:frost-fields:1', event: 'broadcast', ref: null, join_ref: '1', payload: { type: 'broadcast', event, payload } }));
      send('s', { u: 'ghost_player', s: 1, p: [0, 0, 0], r: 0, a: 0 });          // not in roster
      send('s', { u: 'mp_cat', s: 1, p: [1e9, 0, 0], r: 0, a: 0 });             // absurd coords
      send('s', { u: 'mp_cat', s: 2, p: ['x', 0, 0], r: 0, a: 99 });            // junk types
      send('c', { u: 'mp_cat', text: 'free text should never show' });         // chat hint carries no text
      const ws2 = await sock(); const st2 = await join(ws2, outsider);
      ws.close(); ws2.close();
      return { member: st, outsider: st2 };
    }, { api: `http://localhost:${API}`, key: ANON_KEY, tok: users.mp_cat.token, outsider: users.mp_dov.token });
    await pages.mp_ana.waitForTimeout(800);
    check('mp: Realtime Authorization: non-member socket refused, member allowed', raw.member === 'ok' && raw.outsider === 'error', JSON.stringify(raw));
    check('mp: junk / unknown-sender broadcasts dropped', (await info('mp_ana')).stats.dropped - dropped0 >= 3);
    check('mp: no free text ever rendered', !(await pages.mp_ana.evaluate(() => document.body.innerText.includes('free text should never show'))));
    // leave: CAT goes home -> others drop + dispose her avatar
    await pages.mp_cat.evaluate(() => window.iceberg.goHome());
    let left = true; try { await waitOthers('mp_ana', ['mp_ben'], 8000); await waitOthers('mp_ben', ['mp_ana'], 8000); } catch { left = false; }
    check('mp: leaving removes the avatar for everyone', left, JSON.stringify((await info('mp_ana')).others));
    const catCtx = pages.mp_cat.context(); await pages.mp_cat.close();   // free the GPU (swiftshader) before the next tabs
    // cap: 2 per instance -> DOV (ANA's friend) asks to join ANA, server is full -> overflow instance 2
    await dev.db.query(`update public.app_config set value = '2' where key = 'mp_instance_cap'`);
    await open('mp_dov', 'play/?game=frost-fields&join=mp_ana');
    const idv = await info('mp_dov');
    check('mp: cap: full friend server -> placed in a new instance (with a toast)', idv.instance === 2 && idv.note === 'friend_full' && /full/i.test(await pages.mp_dov.evaluate(() => document.body.innerText)), JSON.stringify(idv));
    await pages.mp_dov.waitForTimeout(1500);
    check('mp: cap: instance 2 player sees nobody from instance 1', (await info('mp_dov')).others.length === 0 && (await info('mp_ana')).others.every(o => o.username !== 'mp_dov'));
    // Join friend from the portal: CAT (DOV's friend) clicks Join -> lands in DOV's instance 2, not the fuller instance 1
    await dev.db.query(`update public.app_config set value = '12' where key = 'mp_instance_cap'`);
    const pc = await catCtx.newPage(); watch(pc, errs.mp_cat);
    await pc.goto(BASE + '?view=friends').catch(() => {}); await pc.goto(BASE);
    await pc.click('.p-tab[data-view="friends"]');
    await pc.waitForSelector('#friends-lists a.join-friend[data-join="mp_dov"]', { timeout: 10000 });
    const [tab] = await Promise.all([pc.context().waitForEvent('page'), pc.click('#friends-lists a.join-friend[data-join="mp_dov"]')]);
    await tab.waitForLoadState(); watch(tab, errs.mp_cat);
    await tab.waitForSelector('#start-btn'); await tab.click('#start-btn');
    await tab.waitForFunction(() => window.iceberg?.mp?.info?.instance, null, { timeout: 20000 });
    const jc = await tab.evaluate(() => window.iceberg.mp.info);
    let together = true; try { await tab.waitForFunction(() => window.iceberg.mp.info.others.some(o => o.username === 'mp_dov' && o.visible), null, { timeout: 10000 }); } catch { together = false; }
    check('mp: portal "Join" puts CAT in her friend DOV\'s instance and they see each other', tab.url().endsWith('&join=mp_dov') && jc.instance === 2 && !jc.note && together, JSON.stringify({ url: tab.url(), jc }));
    await tab.screenshot({ path: resolve(SHOTS, 'mp-join-friend.png') });
    // budget: whole run stays well under the free plan's 100 events/s
    const peak = dev.realtime.maxPerSecond(t0);
    check('mp: realtime peak events/s within free-plan budget (< 100)', peak < 100, `peak ${peak}/s, total ${dev.realtime.stats.events}`);
    console.log(`  mp: realtime peak ${peak} events/s; ANA sent ${sentHz.toFixed(1)} Hz while moving`);
    const allErrs = Object.values(errs).flat().filter(e => !/401|403|Unauthorized/.test(e));
    check('mp: no page errors', allErrs.length === 0, allErrs.join(' | ').slice(0, 500));
  } catch (e) { check('mp: unexpected error', false, e.stack); }
  finally { await b.close(); web.close(); await dev.close(); }
}

if (want('quests')) {
  run('quests: local/offline (LocalBackend + facade)', 'node', ['tools/test-quests-local.mjs']);
  const { startDevServer, serveStatic, ANON_KEY } = await import(resolve(ROOT, 'tools/db/dev-server.mjs'));
  const { loadSources, toSQL } = await import(pathToFileURL(resolve(ROOT, 'scripts/sync-catalog.mjs')).href);
  const { withEvent, ND_GAME_ID } = await import(pathToFileURL(resolve(ROOT, 'tools/db/fixtures/event-fixture.mjs')).href);
  const API = await PORT(54431), WEB = await PORT(8431), BASE = `http://localhost:${WEB}/iceberg/`;
  const out = resolve(TMP, 'site-quests');
  run('build: site for quests (local backend)', 'node', ['scripts/build-site.mjs', '--out', out],
    { env: { VITE_SUPABASE_URL: `http://localhost:${API}`, VITE_SUPABASE_ANON_KEY: ANON_KEY, VITE_USERNAME_EMAIL_DOMAIN: 'users.iceberg.test' } });
  const dev = await startDevServer({ port: API, quiet: true });
  await dev.db.exec(toSQL(withEvent(await loadSources(ROOT))));   // event fixture rows (local db only) until Game Maker/Cosmetics land
  const { eventWindowSQL } = await import(pathToFileURL(resolve(ROOT, 'scripts/event-window.mjs')).href);
  const web = await serveStatic(out, WEB, { prefix: '/iceberg/' });
  const b = await launch();
  const r = await (await fetch(`http://localhost:${API}/auth/v1/signup`, { method: 'POST', headers: { apikey: ANON_KEY, 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'q_eve@users.iceberg.test', password: 'icecream9', data: { username: 'q_eve', display_name: 'Eve' } }) })).json();
  const session = { access_token: r.access_token, refresh_token: r.refresh_token, expires_at: r.expires_at, user: { id: r.user.id, username: 'q_eve' } };
  await dev.db.query(`update public.profiles set coins = 200 where username = 'q_eve'`);
  const errs = [];
  try {
    const c = await b.newContext({ viewport: { width: 560, height: 380 } }); const p = await c.newPage(); watch(p, errs);
    await p.goto(BASE); await p.evaluate((s) => localStorage.setItem('iceberg:v1:session', JSON.stringify(s)), session);
    await p.goto(BASE + 'play/?game=frost-fields'); await p.waitForSelector('#start-btn'); await p.click('#start-btn');
    await p.waitForFunction(() => window.iceberg?.economy?.signedIn, null, { timeout: 20000 });
    // event not scheduled yet (fresh migration): Hunt menu would show "starts soon"; progress refused
    const pre = await p.evaluate(async () => ({ st: await window.iceberg.quests.eventStatus('natural_disasters'), pr: await window.iceberg.quests.progress('nd_quest_disaster_survival') }));
    check('event: unscheduled -> inactive, progress event_not_started', pre.st.active === false && pre.st.startsAt === null && pre.pr.reason === 'event_not_started' && !!pre.st.serverNow, JSON.stringify(pre));
    await dev.db.exec(eventWindowSQL('natural_disasters', { start: 'now', days: 7 }));                  // = the release step
    const ev = await p.evaluate(() => window.iceberg.quests.eventStatus('natural_disasters', { refresh: true }));
    check('event: release step -> active, server countdown ~7 days', ev.active && Math.abs(ev.msLeft - 7 * 86400e3) < 120e3, JSON.stringify(ev));
    const res = await p.evaluate(async (nd) => {
      const q = window.iceberg.quests, e = window.iceberg.economy, o = {};
      o.status = await q.status(nd);
      o.early = await q.complete('nd_quest_disaster_survival');
      o.p1 = await q.progress('nd_quest_disaster_survival');
      o.fast = await q.progress('nd_quest_disaster_survival');
      o.bad = await e.questProgress('nd_quest_disaster_survival', 50);
      o.buyEvent = e.buy('tornado_hat');
      o.balloon = await new Promise(ok => { const r = e.buyGear(nd, 'greenBalloon', 150); e.flush().then(() => ok({ r, coins: e.coins, owns: e.ownsGear(nd, 'greenBalloon') })); });
      o.before = e.coins;
      o.apple = await e.buyConsumable(nd, 'apple', 10, 'e2e:apple:1');
      o.appleAgain = await e.buyConsumable(nd, 'apple', 10, 'e2e:apple:1');
      await e.resync(); o.coins = e.coins;
      return o;
    }, ND_GAME_ID);
    check('quests: status via server (anon-safe RPC, one ND quest)', res.status.length === 1 && res.status[0].itemId === 'tornado_hat' && res.status[0].progress === 0, JSON.stringify(res.status));
    check('quests: status carries the effective event window', res.status[0].eventId === 'natural_disasters' && res.status[0].live === true && Date.parse(res.status[0].endsAt) === Date.parse(ev.endsAt), JSON.stringify(res.status[0]));
    check('quests: complete() before goal -> not_complete', res.early.granted === false && res.early.reason === 'not_complete');
    check('quests: progress counted, spam -> too_fast, oversized delta refused', res.p1.ok && res.p1.added === 1 && res.fast.reason === 'too_fast' && res.bad.reason === 'invalid_delta', JSON.stringify([res.p1, res.fast, res.bad]));
    check('quests: event cosmetic not buyable from the client', res.buyEvent.ok === false || res.buyEvent.reason, JSON.stringify(res.buyEvent));
    check('disaster game: Green Balloon via buyGear (server price 150)', res.balloon.owns === true, JSON.stringify(res.balloon));
    check('disaster game: Apple via buyConsumable, same ref charged once', res.apple.ok && res.appleAgain.ok && res.appleAgain.coins === res.before - 10 && res.coins === res.before - 10, JSON.stringify([res.apple, res.appleAgain, res.coins]));
    // finish the quest server-side time-wise (fixture: pretend 4 more disasters over time), then claim twice
    for (let i = 0; i < 4; i++) {
      await dev.db.query(`update public.quest_progress set last_at = last_at - interval '5 seconds' where quest_id = 'nd_quest_disaster_survival'`);
      await p.evaluate(() => window.iceberg.quests.progress('nd_quest_disaster_survival'));
    }
    const claim = await p.evaluate(async () => { const q = window.iceberg.quests; const c1 = await q.complete('nd_quest_disaster_survival'); const c2 = await q.complete('nd_quest_disaster_survival');
      const st = await q.status('natural-disaster-survival'); await window.iceberg.economy.resync(); return { c1, c2, st, owns: window.iceberg.economy.owns('tornado_hat'), coins: window.iceberg.economy.coins }; });
    check('quests: complete() grants tornado_hat once, second call alreadyClaimed, no Birg Bucks', claim.c1.granted && claim.c1.itemId === 'tornado_hat' && claim.c2.alreadyClaimed && !claim.c2.granted && claim.owns && claim.coins === res.coins && claim.st[0].claimed, JSON.stringify(claim));
    // event ends: progress refused, an unfinished quest can't be claimed after the grace, owned reward stays
    await dev.db.exec(eventWindowSQL('natural_disasters', { start: new Date(Date.now() - 9 * 86400e3).toISOString(), end: new Date(Date.now() - 25 * 3600e3).toISOString() }));
    const after = await p.evaluate(async () => { const q = window.iceberg.quests; return { st: await q.eventStatus('natural_disasters', { refresh: true }),
      pr: await q.progress('nd_quest_giant_obby'), cl: await q.complete('nd_quest_giant_obby'), owns: window.iceberg.economy.owns('tornado_hat') }; });
    check('event: after end + grace -> inactive, event_ended, reward kept', !after.st.active && after.st.msLeft === 0 && after.pr.reason === 'event_ended' && after.cl.reason === 'event_ended' && after.owns, JSON.stringify(after));
    const inv = await dev.db.query(`select count(*)::int n from public.inventory i join public.profiles p on p.id = i.user_id where p.username = 'q_eve' and item_id = 'tornado_hat'`);
    check('quests: exactly one inventory row for the reward', inv.rows[0].n === 1);
    check('quests: no page errors', errs.filter(e => !/401|403|Unauthorized/.test(e)).length === 0, errs.join(' | ').slice(0, 500));
  } catch (e) { check('quests: unexpected error', false, e.stack); }
  finally { await b.close(); web.close(); await dev.close(); }
}

if (want('mobile')) {
  const out = resolve(TMP, 'site-mobile');
  run('build: site (guest) for mobile release checks', 'node', ['scripts/build-site.mjs', '--out', out]);
  const r = spawnSync('node', ['scripts/mobile-release-e2e.mjs', out], { cwd: ROOT, encoding: 'utf8' });
  const sum = (r.stdout.match(/\d+\/\d+ mobile release checks passed/) || [''])[0]; if (sum) console.log(`  ${sum}`);
  check('mobile: 2 phones: portal lists only mobile-playable games, one joystick in Studio games (scripts/mobile-release-e2e.mjs)', r.status === 0, (r.stdout + r.stderr).split('\n').filter(l => /FAIL|Error/.test(l)).join('\n').slice(-1500));
}

console.log('\n' + results.map(r => `${r[0]}  ${r[1]}${r[0] === 'FAIL' && r[2] ? '\n      ' + String(r[2]).replace(/\n/g, '\n      ') : ''}`).join('\n'));
const failed = results.filter(r => r[0] === 'FAIL').length;
console.log(`\n${results.length - failed}/${results.length} checks passed. Screenshots: ${SHOTS}`);
process.exit(failed ? 1 : 0);
