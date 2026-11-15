// Frostlings smoke: portal card -> play -> starter -> village/meadow -> wild battle -> catch -> tamer (Holly) -> gate -> panels.
// Run: URL=http://localhost:5201/ node scripts/frostlings-smoke.mjs   (or against dist/index.html)
import { chromium } from 'playwright';
const b = await chromium.launch({ headless: !process.env.DISPLAY, executablePath: process.env.CHROME || '/usr/bin/google-chrome', args: ['--window-position=0,0', '--ignore-gpu-blocklist', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const mobile = process.env.MOBILE === '1';
const p = await b.newPage(mobile ? { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true } : { viewport: { width: 1280, height: 800 } });
p.setDefaultTimeout(180000);
const errs = []; p.on('console', m => m.type() === 'error' && errs.push(m.text())); p.on('pageerror', e => errs.push('PAGEERR ' + e.message));
if (mobile) await p.addInitScript(() => { try { localStorage.setItem('iceberg.deviceMode', 'mobile'); } catch {} });
await p.goto(process.env.URL || 'file://' + process.cwd() + '/dist/index.html');
await p.click('#start-btn'); await p.waitForSelector('.game-card');
const names = await p.$$eval('.game-card .gc-name', e => e.map(x => x.textContent));
console.log('card present', names.includes('Frostlings'));
await p.evaluate(() => window.iceberg.play('frostlings'));
await p.waitForTimeout(2500);
const H = 'window.iceberg.engine.game.frostlings';
const st = () => p.evaluate(`${H}.state`);
const shot = (n) => p.screenshot({ path: `screenshots/frostlings-${mobile ? 'm-' : ''}${n}.png` });
await shot('starter');
await p.evaluate(`${H}.chooseStarter('flurrip')`); await p.waitForTimeout(800);
console.log('after starter', JSON.stringify(await st()));
await shot('village');
async function autoBattle(maxMs = 90000, strategy = 'fight') {
  const t0 = Date.now();
  while (Date.now() - t0 < maxMs) {
    const s = await st(); if (s.mode !== 'battle') return s;
    if (await p.evaluate(`${H}.ok()`)) { await p.waitForTimeout(300); continue; }
    const o = await p.evaluate(`${H}.options()`);
    if (o.length) {
      if (o[0].includes('FIGHT')) await p.evaluate(`${H}.clickOption(${strategy === 'snare' && s.battle && s.battle.foe < 6 ? 2 : 0})`);
      else if (o.some(x => x.includes('Keep old moves'))) await p.evaluate(`${H}.clickOption(${o.length - 1})`);
      else if (o[0].includes('Snare') || o[0].includes('⭕')) await p.evaluate(`${H}.clickOption(0)`);
      else { const i = o.findIndex(x => !x.startsWith('(x)') && !x.includes('Back')); await p.evaluate(`${H}.clickOption(${Math.max(0, i)})`); }
    }
    await p.waitForTimeout(250);
  }
  return st();
}
// walk to meadow
await p.evaluate(`${H}.teleport(0, -90)`); await p.waitForTimeout(3000);
await shot('meadow');
console.log('meadow', JSON.stringify(await st()));
// wild battle
await p.evaluate(`${H}.startWild('puffpaw', 3)`); await p.waitForTimeout(3500);
await shot('battle');
console.log('battle', JSON.stringify((await st()).battle), await p.evaluate(`${H}.options()`));
await p.evaluate(`${H}.clickOption(0)`); await p.waitForTimeout(400); await shot('moves');
console.log('after wild', JSON.stringify(await autoBattle()));
// catch attempt: weak target + lots of snares
await p.evaluate(`${H}.addItems('snare', 20)`);
let caught = false;
for (let i = 0; i < 4 && !caught; i++) {
  const before = (await st()).mons;
  await p.evaluate(`${H}.startWild('breezlet', 2)`); await p.waitForTimeout(3200);
  await autoBattle(90000, 'snare');
  caught = (await st()).mons > before;
}
console.log('caught', caught, JSON.stringify(await st()));
// strong mon -> Holly
await p.evaluate(`${H}.giveMon('blizzaroo', 14)`);
await p.evaluate(`${H}.startTamer('holly')`); await p.waitForTimeout(1500); await shot('boss-intro'); await p.waitForTimeout(2500);
console.log('holly', JSON.stringify(await autoBattle(150000)));
await p.evaluate(`${H}.teleport(30, 0)`); await p.waitForTimeout(1500); await shot('gate');
// panels
for (const id of ['dex', 'den', 'shop', 'quests', 'bag', 'ring']) { await p.evaluate(`${H}.openPanel('${id}')`); await p.waitForTimeout(500); await shot('panel-' + id); await p.keyboard.press('Escape'); await p.evaluate(() => document.querySelector('.fl-x')?.click()); await p.waitForTimeout(200); }
// night + caverns
await p.evaluate(`${H}.setPhase(0.8)`); await p.evaluate(`${H}.teleport(105, 0)`); await p.waitForTimeout(3000); await shot('caverns-night');
await p.evaluate(`${H}.beat('quartz')`); await p.evaluate(`${H}.beat('brine')`); await p.evaluate(`${H}.teleport(-100, 5)`); await p.waitForTimeout(3000); await shot('peak-aurora');
await p.evaluate(`${H}.teleport(0, 100)`); await p.evaluate(`${H}.setPhase(0.2)`); await p.waitForTimeout(3000); await shot('coast');
console.log('final', JSON.stringify(await st()));
console.log('save', await p.evaluate(() => JSON.stringify(window.iceberg.economy.profile.gameData?.frostlings).slice(0, 300)));
await p.evaluate(() => window.iceberg.goHome()); await p.waitForTimeout(500);
console.log('errors', errs.slice(0, 20));
await b.close();
