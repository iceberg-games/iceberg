// Visible-browser check of the live-release hotfix items against a PRODUCTION site build (scripts/build-site.mjs, served statically).
//   DISPLAY=:4 node scripts/hotfix-live-check.mjs <baseUrl e.g. http://127.0.0.1:8732/> <shotPrefix e.g. after>
import { chromium } from 'playwright';
const BASE = process.argv[2], TAG = process.argv[3] || 'run';
const OUT = new URL('../designs/editor-hotfix/', import.meta.url).pathname;
let fails = 0; const ok = (n, c, x = '') => { console.log(`${c ? 'PASS' : 'FAIL'}  ${n}${x ? '  ' + x : ''}`); if (!c) fails++; };
const b = await chromium.launch({ headless: false, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--window-size=1440,900'] });
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
// ---- 1. first open: ONE menu
await p.goto(BASE); await p.waitForTimeout(2500);
const first = { url: p.url(), titleScreen: !!(await p.$('.title-screen')), startBtn: !!(await p.$('#start-btn')), home: !!(await p.$('#pc-home')), portalList: !!(await p.$('#portal .portal, #portal [data-sort]')) };
console.log('first open', JSON.stringify(first));
await p.screenshot({ path: OUT + `1-first-open-${TAG}.png` });
ok('site root is the new home (no separate portal menu)', first.home && !first.portalList, p.url());
if (first.portalList) { await p.goto(BASE + 'play/'); await p.waitForTimeout(2000); await p.screenshot({ path: OUT + `1-play-page-start-${TAG}.png` }); }   // old behavior: the play page has its own start screen
if (await p.$('#start-btn')) { await p.click('#start-btn'); await p.waitForSelector('.game-card'); }
await p.waitForTimeout(1200);
await p.screenshot({ path: OUT + `1-after-start-${TAG}.png` });
ok('first open shows the new home directly (no title / old portal)', first.home && !first.titleScreen && !first.portalList, JSON.stringify(first));
// ---- 3. built-ins visible + open
const tiles = await p.$$eval('#games-carousel .game-card', e => e.map(x => x.dataset.game));
ok('home lists Birg HQ + Frost Fields', ['birg-hq', 'frost-fields'].every(x => tiles.includes(x)), tiles.join());
const inView = await p.evaluate(() => { const r = document.querySelector('#games-carousel')?.getBoundingClientRect(); return r ? r.top < innerHeight - 60 : false; });
ok('built-ins are on screen without scrolling', inView);
await p.fill('#pc-search', 'frost'); ok('search finds Frost Fields', (await p.$$eval('#search-results .game-card', e => e.map(x => x.dataset.game))).includes('frost-fields'));
await p.fill('#pc-search', 'hq'); ok('search finds Birg HQ', (await p.$$eval('#search-results .game-card', e => e.map(x => x.dataset.game))).includes('birg-hq'));
await p.fill('#pc-search', ''); await p.screenshot({ path: OUT + `3-home-builtins-${TAG}.png` });
// ---- open Frost Fields in-page (play) and check walking direction
await p.evaluate(() => window.iceberg.play('frost-fields')); await p.waitForFunction(() => window.iceberg.engine.game && window.iceberg.engine.running !== false, null, { timeout: 20000 }).catch(() => {});
await p.waitForTimeout(2500);
ok('Frost Fields opens', await p.evaluate(() => window.iceberg.engine.game?.def?.id === 'frost-fields' || window.iceberg.engine.def?.id === 'frost-fields'));
await p.screenshot({ path: OUT + `3-frost-fields-open-${TAG}.png` });
async function walkCheck(label, key) {
  const a0 = await p.evaluate(() => { const e = window.iceberg.engine; return [e.player.pos.x, e.player.pos.z]; });
  await p.keyboard.down(key); await p.waitForTimeout(1500);
  const r = await p.evaluate(() => { const e = window.iceberg.engine; return { pos: [e.player.pos.x, e.player.pos.z], yaw: (() => { const v = new e.camera.position.constructor(0, 0, 1).applyQuaternion(e.avatar.root.quaternion); return Math.atan2(v.x, v.z); })(), up: new e.camera.position.constructor(0, 1, 0).applyQuaternion(e.avatar.root.quaternion).y, facing: e.player.facing, camYaw: e.player.camYaw }; });
  await p.screenshot({ path: OUT + `2-walk-${label}-${TAG}.png` });
  await p.keyboard.up(key); await p.waitForTimeout(300);
  const dx = r.pos[0] - a0[0], dz = r.pos[1] - a0[1], moveYaw = Math.atan2(dx, dz);
  let d = r.yaw - moveYaw; d = Math.atan2(Math.sin(d), Math.cos(d));
  console.log(label, JSON.stringify({ dx: +dx.toFixed(2), dz: +dz.toFixed(2), yaw: +r.yaw.toFixed(2), moveYaw: +moveYaw.toFixed(2), err_deg: +(d * 180 / Math.PI).toFixed(1), up: +r.up.toFixed(2) }));
  ok(`avatar faces its direction of movement (${label})`, Math.hypot(dx, dz) > 0.5 && Math.abs(d) < 0.35 && r.up > 0.9, `error ${(d * 180 / Math.PI).toFixed(1)}°`);
}
await walkCheck('forward', 'KeyW'); await walkCheck('right', 'KeyD'); await walkCheck('back', 'KeyS');
// side-on view while walking forward, so a 90° error would be obvious
await p.evaluate(() => { const e = window.iceberg.engine; e.player.camYaw = e.player.facing + Math.PI / 2; e.player.updateCamera?.(); });
await p.keyboard.down('KeyW'); await p.waitForTimeout(900); await p.screenshot({ path: OUT + `2-walk-side-view-${TAG}.png` }); await p.keyboard.up('KeyW');
// Birg HQ
await p.evaluate(() => window.iceberg.goHome()); await p.waitForSelector('.game-card');
await p.evaluate(() => window.iceberg.play('birg-hq')); await p.waitForTimeout(3500);
ok('Birg HQ opens', await p.evaluate(() => (window.iceberg.engine.game?.def?.id || window.iceberg.engine.def?.id) === 'birg-hq'));
await p.screenshot({ path: OUT + `3-birg-hq-open-${TAG}.png` });
// round trip: home (the home avatar snapshot runs) -> back into a game, then walk in every direction
await p.evaluate(() => window.iceberg.goHome()); await p.waitForSelector('.game-card'); await p.waitForTimeout(500);
await p.evaluate(() => window.iceberg.play('frost-fields')); await p.waitForTimeout(3000);
await walkCheck('after-home-forward', 'KeyW'); await walkCheck('after-home-right', 'KeyD'); await walkCheck('after-home-left', 'KeyA'); await walkCheck('after-home-back', 'KeyS');
await p.evaluate(() => { const e = window.iceberg.engine; e.player.camYaw = 0.9; }); await p.waitForTimeout(300); await walkCheck('after-home-diagonal-camera', 'KeyW');
ok('no page errors', errs.length === 0, errs.slice(0, 3).join(' | '));
await b.close(); console.log(fails ? `${fails} FAILED` : 'ALL PASS'); process.exit(fails ? 1 : 0);
