#!/usr/bin/env node
// `npm test` — full smoke suite. Everything is built fresh into /tmp (never dist/),
// and screenshots go to /tmp/iceberg-test/shots.
//   1. catalog check (cosmetics prices + safe-chat phrases valid)
//   2. real-Postgres DB tests (PGlite): migrations, RLS, RPCs, price sync
//   3. single-file game build: menu, 3 games, device toggle, mobile mode, picker
//   4. site build (portal + play/ + PWA) against the local dev backend at a sub-path:
//      sign-up, guest migration, Play-in-new-tab, server-synced economy + colors,
//      Safe Chat room with 2 players (bubbles, talking, dispose on leave, rate limit), friends,
//      demo bucks disabled, SW scope/caching.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const TMP = '/tmp/iceberg-test';
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
  const creatorHidden = await p2.evaluate(() => { const c = document.querySelector('.game-card[data-game="creator"]'); return !c || getComputedStyle(c).display === 'none'; });
  check('mobile: Create card hidden', creatorHidden);
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
  const API = 54420, WEB = 8420, BASE = `http://localhost:${WEB}/iceberg/`;
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
    check('portal: no page errors', e1.length === 0 && e2.length === 0, [...e1, ...e2].join(' | '));
    // sign out + wrong password (the browser logs the expected 400 from /auth/v1/token)
    await p2.click('#p-signout'); await p2.waitForSelector('#p-signin-open');
    await p2.click('#p-signin-open'); await p2.fill('#form-signin input[name=username]', 'polar_pal'); await p2.fill('#form-signin input[name=password]', 'wrongpass1');
    await p2.click('#form-signin button[type=submit]');
    await p2.waitForFunction(() => /Wrong username or password/.test(document.querySelector('#form-signin .p-error')?.textContent || ''));
    check('auth: wrong password rejected, signed out cleanly', true);
    // service worker must not cache API/auth
    const cached = await p1.evaluate(async () => { const out = []; for (const k of await caches.keys()) for (const r of await (await caches.open(k)).keys()) out.push(r.url); return out; });
    check('pwa: SW cached the shell only (no auth/API URLs)', cached.length > 0 && !cached.some(u => /\/(auth|rest)\/v1|:54420/.test(u)), JSON.stringify(cached));
  } catch (e) { check('site: unexpected error', false, e.stack); }
  finally { await b.close(); web.close(); await dev.close(); }
}

console.log('\n' + results.map(r => `${r[0]}  ${r[1]}${r[0] === 'FAIL' && r[2] ? '\n      ' + String(r[2]).replace(/\n/g, '\n      ') : ''}`).join('\n'));
const failed = results.filter(r => r[0] === 'FAIL').length;
console.log(`\n${results.length - failed}/${results.length} checks passed. Screenshots: ${SHOTS}`);
process.exit(failed ? 1 : 0);
