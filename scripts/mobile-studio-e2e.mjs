#!/usr/bin/env node
// Mobile Studio end-to-end test at phone viewports (375x667 portrait + 667x375
// landscape, touch). Build first:  npx vite build --outDir /tmp/iceberg-dist
// then:  node scripts/mobile-studio-e2e.mjs [/tmp/iceberg-dist/index.html]
// Covers: Create visible on mobile → Mobile Studio opens (desktop panel hidden),
// compact bar fits with >=40px targets and does not overlap the 3D view, set spawn,
// change color, tap-place / remove / paint / undo, orbit + pinch + two-finger pan,
// name + save (drafts) + publish (Games menu, mobile-playable), test-play, back to
// editor, landscape layout, and the desktop Studio still opens unchanged.
import { chromium } from 'playwright';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const file = pathToFileURL(resolve(process.argv[2] || 'dist/index.html')).href;
const SHOT = process.env.MS_SHOTS || null;
const results = [];
const ok = (name, cond, info = '') => { results.push([cond ? 'PASS' : 'FAIL', name, info]); if (!cond) console.error('  FAIL', name, info); };
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const errs = [];
const watch = (p) => { p.on('pageerror', e => errs.push('pageerror: ' + e.message)); p.on('console', m => { if (m.type() === 'error' && !/favicon/.test(m.text())) errs.push(m.text()); }); };

try {
  const ctx = await b.newContext({ viewport: { width: 375, height: 667 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  await ctx.addInitScript(() => { try { localStorage.setItem('iceberg:v1:deviceMode', 'mobile'); } catch {} });
  const p = await ctx.newPage(); watch(p);
  const cdp = await ctx.newCDPSession(p);
  const tapSel = async (sel) => { await p.$eval(sel, e => e.scrollIntoView({ block: 'center', inline: 'center' })); await p.waitForTimeout(60); const r = await p.$eval(sel, e => { const b = e.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; }); await p.touchscreen.tap(r.x, r.y); await p.waitForTimeout(120); };
  const G = (fn, arg) => p.evaluate(fn, arg);
  const screenOf = (pt) => G(([x, y, z]) => { const { engine } = window.iceberg; engine.camera.updateMatrixWorld(); const v = new engine.camera.position.constructor(x, y, z).project(engine.camera); const r = engine.renderer.domElement.getBoundingClientRect(); return { x: r.left + (v.x + 1) / 2 * r.width, y: r.top + (1 - v.y) / 2 * r.height, inView: Math.abs(v.x) < 0.95 && Math.abs(v.y) < 0.95 && v.z < 1 }; }, pt);
  const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y], i) => ({ x, y, id: i + 1 })) });
  const docOf = () => G(() => JSON.parse(JSON.stringify(window.iceberg.engine.game.doc)));
  const parts = async () => (await docOf()).instances.filter(i => i.type === 'part');
  const camState = () => G(() => { const c = window.iceberg.engine.game.cameraController; return { pos: c.pos.toArray(), yaw: c.yaw, pitch: c.pitch, dist: window.iceberg.mobileStudio.dist }; });

  await p.goto(file);
  await p.waitForSelector('#start-btn'); await tapSel('#start-btn');
  await p.waitForSelector('.game-card');
  ok('device mode is mobile', await G(() => document.body.classList.contains('device-mobile')));
  ok('Create card visible on mobile', await p.isVisible('.game-card[data-game="creator"] #create-btn'));
  await tapSel('#create-btn');
  await p.waitForSelector('#create-dialog');
  const dlg = await p.$eval('#create-dialog .dialog', e => { const r = e.getBoundingClientRect(); return r.right <= innerWidth && r.left >= 0; });
  ok('create dialog fits the phone', dlg);
  await tapSel('[data-template=blank]');
  await p.waitForSelector('#mobile-studio:not(.hidden)', { timeout: 8000 }); await p.waitForTimeout(600);
  ok('Mobile Studio opens in editing mode', await G(() => !!window.iceberg.engine.game?.editing && window.iceberg.mobileStudio.active));
  ok('desktop Studio panel hidden on mobile', !(await p.isVisible('#creator-panel')));
  ok('HUD + joystick hidden while building', !(await p.isVisible('#hud')) && !(await p.isVisible('#touch-stick')));

  // ---- compact layout (portrait) ----
  const layout = async () => G(() => {
    const bar = document.querySelector('#mobile-studio').getBoundingClientRect();
    const cv = document.querySelector('#game-canvas').getBoundingClientRect();
    const btns = [...document.querySelectorAll('#mobile-studio .ms-btn')].map(e => e.getBoundingClientRect());
    const sw = [...document.querySelectorAll('#mobile-studio .ms-swatch')].map(e => e.getBoundingClientRect());
    const pal = document.querySelector('#ms-palette').getBoundingClientRect();
    return { barTop: bar.top, barH: bar.height, cvBottom: cv.bottom, cvH: cv.height, vw: innerWidth, vh: innerHeight,
      btnsFit: btns.every(r => r.left >= 0 && r.right <= innerWidth + 0.5 && r.bottom <= innerHeight + 0.5),
      minBtn: Math.min(...btns.map(r => Math.min(r.width, r.height))), minSw: Math.min(...sw.map(r => Math.min(r.width, r.height))),
      palFits: pal.left >= 0 && pal.right <= innerWidth + 0.5, nBtns: btns.length };
  });
  let L = await layout();
  ok('portrait: bar is compact (<= 110px)', L.barH <= 110, `bar ${L.barH}px`);
  ok('portrait: all tool buttons fit on screen', L.btnsFit && L.nBtns === 8, JSON.stringify(L));
  ok('portrait: tap targets >= 40px', L.minBtn >= 40 && L.minSw >= 40, `btn ${L.minBtn} swatch ${L.minSw}`);
  ok('portrait: palette fits width', L.palFits);
  ok('portrait: 3D view ends above the bar (no overlap)', L.cvBottom <= L.barTop + 1 && L.cvH >= 0.75 * (L.vh - L.barH), JSON.stringify(L));
  if (SHOT) await p.screenshot({ path: resolve(SHOT, 'mobile-studio-portrait.png') });

  // ---- set spawn ----
  await tapSel('[data-mtool=spawn]');
  ok('spawn tool selected', await G(() => window.iceberg.mobileStudio.tool === 'spawn'));
  let s = await screenOf([-4, 0, 4]);
  ok('spawn target point in view', s.inView, JSON.stringify(s));
  await p.touchscreen.tap(s.x, s.y); await p.waitForTimeout(150);
  let doc = await docOf(); let spawn = doc.instances.filter(i => i.type === 'spawn');
  ok('spawn moved to tapped spot (one spawn)', spawn.length === 1 && Math.abs(spawn[0].pos[0] + 4) <= 1 && Math.abs(spawn[0].pos[2] - 4) <= 1 && Math.abs(spawn[0].pos[1] - 0.2) < 0.05, JSON.stringify(spawn.map(x => x.pos)));

  // ---- change color + place ----
  await tapSel('[data-color="#2f9e6a"]');
  ok('color changed + Place auto-selected', await G(() => window.iceberg.mobileStudio.color === '#2f9e6a' && window.iceberg.mobileStudio.tool === 'place'));
  ok('palette shows selection', await G(() => document.querySelector('[data-color="#2f9e6a"]').classList.contains('on')));
  const n0 = (await parts()).length;
  s = await screenOf([5, 0, -3]);
  await p.touchscreen.tap(s.x, s.y); await p.waitForTimeout(150);
  let ps = await parts(); const blk = ps.find(x => x.name.startsWith('Block'));
  ok('tap places a block', ps.length === n0 + 1 && !!blk, `${n0} -> ${ps.length}`);
  ok('block uses picked color + 2-stud grid', blk && blk.color === '#2f9e6a' && blk.size.join() === '2,2,2' && blk.pos[1] === 1 && blk.pos.every(v => Math.abs(v % 2) === 1), JSON.stringify(blk));
  ok('no desktop gizmo attached after placing', await G(() => !window.iceberg.engine.game.tc.object));
  // stack on top of it
  s = await screenOf([blk.pos[0], 2, blk.pos[2]]);
  await p.touchscreen.tap(s.x, s.y); await p.waitForTimeout(150);
  ps = await parts();
  ok('tap on a block stacks a new block on its face', ps.length === n0 + 2 && ps.some(x => x.pos[1] === 3 && x.pos[0] === blk.pos[0] && x.pos[2] === blk.pos[2]), JSON.stringify(ps.map(x => x.pos)));
  // undo
  await tapSel('#ms-undo'); await p.waitForTimeout(100);
  ok('undo removes the last block', (await parts()).length === n0 + 1);
  // paint
  await tapSel('[data-color="#e2474b"]'); await tapSel('[data-mtool=paint]');
  s = await screenOf(blk.pos); await p.touchscreen.tap(s.x, s.y); await p.waitForTimeout(150);
  ok('paint recolors a block', (await parts()).find(x => x.id === blk.id)?.color === '#e2474b');
  // remove (and spawn is protected)
  await tapSel('[data-mtool=remove]');
  s = await screenOf(blk.pos); await p.touchscreen.tap(s.x, s.y); await p.waitForTimeout(150);
  ok('remove deletes the tapped block', !(await parts()).some(x => x.id === blk.id));
  spawn = (await docOf()).instances.find(i => i.type === 'spawn');
  s = await screenOf(spawn.pos); await p.touchscreen.tap(s.x, s.y); await p.waitForTimeout(150);
  ok('spawn point cannot be removed', (await docOf()).instances.some(i => i.type === 'spawn'));
  // put a green block back for the play test
  await tapSel('[data-color="#2f9e6a"]');
  s = await screenOf([5, 0, -3]); await p.touchscreen.tap(s.x, s.y); await p.waitForTimeout(150);
  const finalBlock = (await parts()).find(x => x.pos[0] === blk.pos[0] && x.pos[2] === blk.pos[2] && x.pos[1] === 1);
  ok('block placed again', !!finalBlock && finalBlock.color === '#2f9e6a');

  // ---- touch camera ----
  const cnt = (await docOf()).instances.length;
  let c0 = await camState();
  await touch('touchStart', [[150, 250]]);
  for (let i = 1; i <= 6; i++) await touch('touchMove', [[150 + i * 15, 250 + i * 4]]);
  await touch('touchEnd', []); await p.waitForTimeout(80);
  let c1 = await camState();
  ok('one-finger drag orbits (no block placed)', Math.abs(c1.yaw - c0.yaw) > 0.3 && (await docOf()).instances.length === cnt, `yaw ${c0.yaw.toFixed(2)} -> ${c1.yaw.toFixed(2)}`);
  await touch('touchStart', [[140, 250], [240, 250]]);
  for (let i = 1; i <= 5; i++) await touch('touchMove', [[140 - i * 10, 250], [240 + i * 10, 250]]);
  await touch('touchEnd', []); await p.waitForTimeout(80);
  const c2 = await camState();
  ok('pinch out zooms in', c2.dist < c1.dist * 0.75 && (await docOf()).instances.length === cnt, `dist ${c1.dist.toFixed(1)} -> ${c2.dist.toFixed(1)}`);
  await touch('touchStart', [[150, 250], [230, 250]]);
  for (let i = 1; i <= 5; i++) await touch('touchMove', [[150 + i * 12, 250 + i * 8], [230 + i * 12, 250 + i * 8]]);
  await touch('touchEnd', []); await p.waitForTimeout(80);
  const c3 = await camState();
  const moved = Math.hypot(...c3.pos.map((v, i) => v - c2.pos[i]));
  ok('two-finger drag pans', moved > 0.5 && Math.abs(c3.dist - c2.dist) < c2.dist * 0.05 && Math.abs(c3.yaw - c2.yaw) < 1e-6, `moved ${moved.toFixed(2)}`);

  // ---- name + save + publish ----
  await tapSel('#ms-more'); await p.waitForSelector('#ms-sheet');
  ok('mobile-playable on by default', await p.isChecked('#ms-mobile'));
  await p.fill('#ms-name', 'Phone Fort'); await p.dispatchEvent('#ms-name', 'change');
  await tapSel('#ms-sheet-save');
  const draft = await G(() => JSON.parse(localStorage.getItem('iceberg:v1:studioDrafts') || '[]').find(d => d.name === 'Phone Fort'));
  ok('save writes the draft (same path as desktop)', !!draft && draft.mobile === true && draft.instances.some(i => i.color === '#2f9e6a' && i.size.join() === '2,2,2'), draft ? `${draft.instances.length} instances` : 'no draft');
  ok('draft has the moved spawn', !!draft && Math.abs(draft.instances.find(i => i.type === 'spawn').pos[0] + 4) <= 1);
  await tapSel('#ms-save');
  await tapSel('#ms-more'); await p.waitForSelector('#ms-sheet'); await tapSel('#ms-publish');
  const pub = await G(() => window.iceberg.backend.loadCustomGames().find(g => g.name === 'Phone Fort'));
  ok('publish adds it to the Games list as mobile-playable', !!pub && pub.mobile === true && pub.published === true);

  // ---- test-play ----
  await tapSel('#ms-test'); await p.waitForTimeout(1200);
  const play = await G(() => { const { engine } = window.iceberg; const g = engine.game; return { editing: !!g?.editing, running: engine.running, id: engine.def?.id, blocks: (engine.def?.doc?.instances || []).filter(i => i.type === 'part').length, player: engine.player.pos.toArray() }; });
  ok('Test plays the game (not editing)', !play.editing && play.running && play.id === draft.id && play.blocks >= 1, JSON.stringify(play));
  ok('player starts at the mobile spawn', Math.abs(play.player[0] + 4) <= 2.5 && Math.abs(play.player[2] - 4) <= 2.5, JSON.stringify(play.player));
  ok('Mobile Studio bar hidden while testing, joystick shown', !(await p.isVisible('#mobile-studio')) && (await p.isVisible('#touch-stick')));
  const sticks = await G(() => [...document.querySelectorAll('#touch-stick, .rt-touch .joy')].filter(e => e.offsetParent !== null && getComputedStyle(e).display !== 'none').length);
  ok('only one joystick while test-playing (runtime controls defer to the shared one)', sticks === 1, `${sticks} visible`);
  const cv = await G(() => document.querySelector('#game-canvas').getBoundingClientRect().height);
  ok('canvas back to full screen while testing', Math.abs(cv - 667) <= 1, String(cv));
  ok('back-to-editor button shown', await p.isVisible('#back-to-editor'));
  await tapSel('#back-to-editor'); await p.waitForSelector('#mobile-studio:not(.hidden)'); await p.waitForTimeout(400);
  ok('back to Mobile Studio keeps the build', (await parts()).some(x => x.color === '#2f9e6a' && x.pos[1] === 1) && (await docOf()).name === 'Phone Fort');

  // ---- landscape ----
  await p.setViewportSize({ width: 667, height: 375 }); await p.waitForTimeout(300);
  L = await layout();
  ok('landscape: single compact row (<= 60px)', L.barH <= 60, `bar ${L.barH}px`);
  ok('landscape: buttons fit, targets >= 40px', L.btnsFit && L.minBtn >= 40 && L.minSw >= 40, JSON.stringify(L));
  ok('landscape: no overlap with 3D view', L.cvBottom <= L.barTop + 1, JSON.stringify(L));
  if (SHOT) await p.screenshot({ path: resolve(SHOT, 'mobile-studio-landscape.png') });

  // ---- exit → game shows in the menu ----
  await p.setViewportSize({ width: 375, height: 667 });
  await tapSel('#ms-more'); await p.waitForSelector('#ms-sheet'); await tapSel('#ms-exit');
  await p.waitForSelector('#your-games'); 
  ok('exit returns to menu with the game listed', (await p.$$eval('#your-games .gc-name', e => e.map(x => x.textContent))).includes('Phone Fort'));
  ok('edit button visible on mobile', await p.isVisible('#your-games .edit-btn'));
  await ctx.close();

  // ---- desktop unchanged ----
  const dctx = await b.newContext({ viewport: { width: 1280, height: 800 } });
  await dctx.addInitScript(() => { try { localStorage.setItem('iceberg:v1:deviceMode', 'computer'); } catch {} });
  const d = await dctx.newPage(); watch(d);
  await d.goto(file); await d.click('#start-btn'); await d.waitForSelector('.game-card');
  await d.click('#create-btn'); await d.click('[data-template=blank]'); await d.waitForTimeout(1000);
  ok('desktop: full Studio opens, Mobile Studio hidden', (await d.isVisible('#creator-panel')) && !(await d.isVisible('#mobile-studio')));
  const dcv = await d.evaluate(() => document.querySelector('#game-canvas').getBoundingClientRect().height);
  ok('desktop: canvas full height', Math.abs(dcv - 800) <= 1, String(dcv));
  await dctx.close();
  ok('no page errors', errs.length === 0, errs.join(' | '));
} catch (e) {
  ok('mobile studio script ran without exceptions', false, e.stack);
} finally { await b.close(); }

for (const [r, n, i] of results) console.log(r, n, r === 'FAIL' && i ? '— ' + String(i).slice(0, 400) : '');
const failed = results.filter(r => r[0] === 'FAIL').length;
console.log(`${results.length - failed}/${results.length} mobile studio checks passed`);
process.exit(failed ? 1 : 0);
