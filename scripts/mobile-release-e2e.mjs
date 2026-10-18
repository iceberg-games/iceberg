#!/usr/bin/env node
// Release check for Mobile mode on 2 emulated phones (iPhone-size portrait, Pixel-size landscape):
//  * portal: in Mobile mode every games tab and the featured banner list only mobile-playable games
//  * test-play / play of a Studio game with doc.mobile shows exactly ONE joystick (no runtime + shared stacking)
//  * unit: isMobilePlayable() for built-ins, unmarked games, and Studio docs
// usage: node scripts/mobile-release-e2e.mjs <site-dir built by build-site.mjs>
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = resolve(new URL('..', import.meta.url).pathname);
const SITE = resolve(process.argv[2] || '/tmp/iceberg-site-mobile');
const results = []; const ok = (n, c, x = '') => { results.push([c ? 'PASS' : 'FAIL', n, x]); if (!c) console.error('  FAIL', n, x); };

// unit
const { isMobilePlayable, GAME_META } = await import(pathToFileURL(resolve(ROOT, 'src/data/gameMeta.js')).href);
ok('unit: built-ins marked mobile', ['giant-rainbow-obby', 'birg-hq', 'frost-fields'].every(id => isMobilePlayable({ id })));
ok('unit: unmarked / retired built-in hidden', !isMobilePlayable({ id: 'rainbow-obby' }) && !isMobilePlayable({ id: 'some-new-game' }));
ok('unit: game may declare mobile on its def', isMobilePlayable({ id: 'x', mobile: true }) && !isMobilePlayable({ id: 'frost-fields', mobile: false }));
ok('unit: Studio games follow doc.mobile', isMobilePlayable({ id: 'g1', custom: true, doc: { mobile: true } }) && !isMobilePlayable({ id: 'g2', custom: true, doc: { mobile: false } }) && isMobilePlayable({ id: 'g3', custom: true, doc: {} }));
const MOBILE_IDS = Object.keys(GAME_META).filter(id => GAME_META[id].mobile && !GAME_META[id].retired);

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml' };
const srv = createServer(async (q, r) => {
  let p = decodeURIComponent(new URL(q.url, 'http://x').pathname).replace(/^\/iceberg/, '') || '/';
  if (p.endsWith('/')) p += 'index.html';
  try { const b = await readFile(resolve(SITE, '.' + p)); r.writeHead(200, { 'content-type': MIME[extname(p)] || 'application/octet-stream' }); r.end(b); }
  catch { r.writeHead(404); r.end(); }
}).listen(0);
const BASE = `http://localhost:${srv.address().port}/iceberg/`;

const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const PHONES = [
  { name: 'phone A (375x667 portrait)', viewport: { width: 375, height: 667 }, deviceScaleFactor: 2 },
  { name: 'phone B (915x412 landscape)', viewport: { width: 915, height: 412 }, deviceScaleFactor: 2.6 },
];
const DOC = { id: 'g_phone_test', version: 2, name: 'Phone Test', mobile: true, music: 'none', starterGears: [], animations: [], published: true,
  instances: [{ id: 'sp', type: 'spawn', name: 'Spawn', pos: [0, 0.5, 0], size: [2, 1, 2], rot: [0, 0, 0], color: '#3f8fd0' },
              { id: 'p1', type: 'part', name: 'Floor', pos: [0, -0.5, 0], size: [30, 1, 30], rot: [0, 0, 0], color: '#cfe8f5', anchored: true }],
  createdAt: Date.now(), updatedAt: Date.now() };
try {
  for (const ph of PHONES) {
    const ctx = await b.newContext({ viewport: ph.viewport, deviceScaleFactor: ph.deviceScaleFactor, hasTouch: true, isMobile: true });
    await ctx.addInitScript((doc) => { try { localStorage.setItem('iceberg:v1:deviceMode', 'mobile'); if (!localStorage.getItem('iceberg:v1:customGames')) localStorage.setItem('iceberg:v1:customGames', JSON.stringify([doc])); } catch {} }, DOC);
    // featured list that also names a non-mobile game: the banner must skip it in Mobile mode
    await ctx.route('**/featured.json', (r) => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ featured: [{ gameId: 'rainbow-obby' }, ...MOBILE_IDS.map(gameId => ({ gameId }))] }) }));
    const p = await ctx.newPage(); const errs = [];
    p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/favicon|404/.test(m.text())) errs.push(m.text()); });
    await p.goto(BASE); await p.waitForSelector('#games-grid .game-card', { timeout: 15000 });
    const tabs = {};
    for (const sort of ['newest', 'popular', 'active']) {
      await p.click(`#games-sort button[data-sort="${sort}"]`); await p.waitForTimeout(250);
      tabs[sort] = await p.$$eval('#games-grid .game-card', els => els.map(e => e.dataset.game));
    }
    ok(`${ph.name}: every tab lists only mobile-playable games`, Object.values(tabs).every(l => l.length > 0 && l.every(id => MOBILE_IDS.includes(id))), JSON.stringify(tabs));
    await p.waitForSelector('#featured-banner', { timeout: 8000 }).catch(() => {});
    const slides = [];
    for (let k = 0; k < MOBILE_IDS.length + 2; k++) {
      const id = await p.$eval('#featured-banner .fb-slide', e => e.dataset.game).catch(() => null); if (id && !slides.includes(id)) slides.push(id);
      if (!(await p.$('#featured-banner .fb-next'))) break; await p.click('#featured-banner .fb-next'); await p.waitForTimeout(150);
    }
    ok(`${ph.name}: featured banner skips non-mobile games`, slides.length > 0 && !slides.includes('rainbow-obby') && slides.every(id => MOBILE_IDS.includes(id)), JSON.stringify(slides));
    const dots = await p.$$eval('#featured-banner .fb-dot', e => e.length);
    ok(`${ph.name}: banner has one dot per mobile game`, dots === 0 ? slides.length === 1 : dots === MOBILE_IDS.length, `${dots} dots`);
    // play a Studio game marked mobile on the phone: exactly one joystick
    const g = await ctx.newPage(); g.on('pageerror', e => errs.push(e.message));
    await g.goto(BASE + 'play/'); await g.waitForSelector('#start-btn'); await g.tap('#start-btn');
    await g.waitForFunction(() => window.iceberg?.play, null, { timeout: 15000 });
    await g.evaluate((id) => window.iceberg.play(id), DOC.id); await g.waitForTimeout(1500);
    const sticks = await g.evaluate(() => [...document.querySelectorAll('#touch-stick, .rt-touch .joy')].filter(e => e.offsetParent !== null && getComputedStyle(e).display !== 'none').map(e => e.id || e.className));
    const jumps = await g.evaluate(() => [...document.querySelectorAll('#touch-jump, .rt-touch .jump')].filter(e => e.offsetParent !== null && getComputedStyle(e).display !== 'none').length);
    ok(`${ph.name}: Studio game (doc.mobile) shows one joystick + one jump button`, sticks.length === 1 && jumps === 1, JSON.stringify({ sticks, jumps }));
    // the remaining joystick actually drives the player
    const before = await g.evaluate(() => window.iceberg.engine.player.pos.toArray());
    const box = await g.$eval('#touch-stick', e => { const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
    const cdp = await ctx.newCDPSession(g);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: box.x, y: box.y, id: 1 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: box.x, y: box.y - 45, id: 1 }] });
    await g.waitForTimeout(900);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    const after = await g.evaluate(() => window.iceberg.engine.player.pos.toArray());
    ok(`${ph.name}: joystick moves the player`, Math.hypot(after[0] - before[0], after[2] - before[2]) > 0.5, JSON.stringify({ before, after }));
    await g.screenshot({ path: `/tmp/mobile-release-${ph.viewport.width}.png` });
    ok(`${ph.name}: no page errors`, errs.length === 0, errs.join(' | ').slice(0, 400));
    await ctx.close();
  }
} catch (e) { ok('unexpected error', false, e.stack); }
finally { await b.close(); srv.close(); }
console.log(results.map(r => `${r[0]}  ${r[1]}${r[0] === 'FAIL' && r[2] ? '\n      ' + r[2] : ''}`).join('\n'));
const failed = results.filter(r => r[0] === 'FAIL').length;
console.log(`${results.length - failed}/${results.length} mobile release checks passed`);
process.exit(failed ? 1 : 0);
