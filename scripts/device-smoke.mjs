// Device-mode smoke test. Build fresh first:  npx vite build --outDir /tmp/iceberg-dist
// then:  node scripts/device-smoke.mjs [/tmp/iceberg-dist/index.html]
// Checks: Help panel (H) device toggle is enabled, switches mode both ways,
// persists to localStorage, and emits 'device:changed' on window with {mode}.
import { chromium } from 'playwright';
import { resolve } from 'node:path';
const file = resolve(process.argv[2] || 'dist/index.html');
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && errs.push(m.text()));
await p.goto('file://' + file);
await p.evaluate(() => { window.__dev = []; addEventListener('device:changed', e => window.__dev.push(e.detail && e.detail.mode)); });
await p.click('#start-btn');
await p.waitForSelector('.game-card');
// Help is part of the in-game HUD, so enter a game first, then press H.
await p.evaluate(() => window.iceberg.play('frost-fields'));
await p.waitForTimeout(1200);
await p.evaluate(() => window.iceberg.ui.toggleHelp(true)); // HUD auto-opens Help on first game; force it open
await p.waitForFunction(() => document.querySelector('#device-toggle button[data-mode="mobile"]')?.disabled === false, null, { timeout: 5000 });
const state = () => p.evaluate(() => ({
  on: document.querySelector('#device-toggle button.on')?.dataset.mode,
  stored: localStorage.getItem('iceberg:v1:deviceMode'),
  body: document.body.className,
}));
const fail = [];
for (const mode of ['mobile', 'computer']) {
  await p.click(`#device-toggle button[data-mode="${mode}"]`);
  const s = await state();
  if (s.on !== mode || s.stored !== mode || !s.body.includes('device-' + mode)) fail.push(`${mode}: ${JSON.stringify(s)}`);
}
const events = await p.evaluate(() => window.__dev);
if (events.join(',') !== 'mobile,computer') fail.push('window events: ' + JSON.stringify(events));
if (errs.length) fail.push('page errors: ' + JSON.stringify(errs));
await b.close();
if (fail.length) { console.error('DEVICE SMOKE FAIL\n' + fail.join('\n')); process.exit(1); }
console.log('device smoke OK', events);
