// Frostlings feature pass: evolution, quest turn-in + rank, shop buy, Care Den feed/pet/bond, tamers Brine + Borealis.
// Run with the dev server up: node scripts/frostlings-features.mjs
import { chromium } from 'playwright';
const b = await chromium.launch({ headless: !process.env.DISPLAY, executablePath: '/usr/bin/google-chrome', args: ['--window-position=0,0','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } }); p.setDefaultTimeout(180000);
const errs = []; p.on('pageerror', e => errs.push('PAGEERR ' + e.message)); p.on('console', m => m.type()==='error' && errs.push(m.text()));
await p.goto('http://localhost:5201/'); await p.click('#start-btn'); await p.waitForSelector('.game-card');
await p.evaluate(() => window.iceberg.play('frostlings')); await p.waitForTimeout(2500);
const H = 'window.iceberg.engine.game.frostlings', st = () => p.evaluate(`${H}.state`);
await p.evaluate(`${H}.resetSave()`); await p.evaluate(`${H}.chooseStarter('flurrip')`); await p.waitForTimeout(500);
await p.evaluate(`(() => { const m = ${H}.save.mons[0]; m.lv = 11; m.xp = 250; m.hp = 999; })()`);
async function auto(maxMs = 240000) { const t0 = Date.now(); let evo = false, cine = false;
  while (Date.now() - t0 < maxMs) { const s = await st(); if (s.mode !== 'battle') return s;
    if (await p.evaluate(`${H}.ok()`)) { const html = await p.evaluate(() => document.querySelector('.fl-cine')?.innerText || ''); if (!evo && /EVOLU/i.test(html)) { evo = true; await p.screenshot({ path: 'screenshots/frostlings-evolve.png' }); console.log('evolve cine seen'); } else if (!cine) { cine = true; await p.screenshot({ path: 'screenshots/frostlings-cine.png' }); } await p.evaluate(`${H}.ok()`) && await p.evaluate(() => document.querySelector('[data-ok]')?.click()); await p.waitForTimeout(250); continue; }
    const o = await p.evaluate(`${H}.options()`);
    if (o.length) { const i = o[0].includes('FIGHT') ? 0 : o.some(x => /Keep/.test(x)) ? o.length - 1 : Math.max(0, o.findIndex(x => !x.startsWith('(x)') && !x.includes('Back'))); await p.evaluate(`${H}.clickOption(${i})`); }
    await p.waitForTimeout(250); } console.log('TIMEOUT', await p.evaluate(`${H}.msg()`), await p.evaluate(`${H}.options()`)); return st(); }
await p.evaluate(`${H}.startWild('puffpaw', 2, 'meadow')`); await p.waitForTimeout(3000); await auto();
console.log('after evo battle', JSON.stringify((await st()).party));
await p.evaluate(`${H}.beat('holly')`); await p.evaluate(`${H}.beat('quartz')`);
for (const t of ['brine', 'borealis']) { await p.evaluate(`${H}.giveMon('tempestra', 20)`); await p.evaluate(`${H}.startTamer('${t}')`); await p.waitForTimeout(3000); if (t === 'borealis') await p.screenshot({ path: 'screenshots/frostlings-borealis.png' }); console.log(t, (await auto()).beaten); }
console.log('dex', (await st()).dex, 'rank', (await st()).rank, 'flakes', (await st()).flakes, 'errors', errs.slice(0, 10));
await b.close();
