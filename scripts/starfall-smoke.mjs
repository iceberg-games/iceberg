// Starfall Lake smoke: portal card -> play -> catch stars -> constellation -> end -> retry.
// Run: npx vite build && node scripts/starfall-smoke.mjs
import { chromium } from 'playwright';
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
const errs = []; p.on('console', m => m.type() === 'error' && errs.push(m.text())); p.on('pageerror', e => errs.push(e.message));
await p.goto('file://' + process.cwd() + '/dist/index.html');
await p.click('#start-btn'); await p.waitForSelector('.game-card');
const names = await p.$$eval('.game-card .gc-name', e => e.map(x => x.textContent));
console.log('card present', names.includes('Starfall Lake'));
await p.evaluate(() => window.iceberg.play('starfall-lake'));
await p.waitForTimeout(1500); await p.evaluate(() => window.iceberg.engine.game.starfall.skipCountdown()); await p.waitForTimeout(800);
const st = () => p.evaluate(() => { const s = window.iceberg.engine.game.starfall.state; return { phase: s.phase, score: s.score, caught: s.caught, cons: s.cons, combo: s.combo, time: +s.time.toFixed(1) }; });
console.log('after countdown', await st());
await p.keyboard.down('KeyW'); await p.waitForTimeout(700); await p.keyboard.up('KeyW');
const a = await p.evaluate(() => window.iceberg.engine.player.pos.toArray()); await p.waitForTimeout(500);
const b2 = await p.evaluate(() => window.iceberg.engine.player.pos.toArray());
console.log('glide after release', a.map(v => v.toFixed(2)), '->', b2.map(v => v.toFixed(2)));
for (let i = 0; i < 60; i++) {   // chase resting/low stars by teleport
  await p.evaluate(() => { const s = window.iceberg.engine.game.starfall.stars().find(s => s.state === 'rest'); if (s) window.iceberg.engine.player.pos.set(s.x, 0, s.z); });
  await p.waitForTimeout(250);
}
console.log('after catching', await st());
await p.screenshot({ path: 'screenshots/starfall-play.png' });
await p.evaluate(() => { window.iceberg.engine.game.starfall.state; }); 
await p.evaluate(() => { const g = window.iceberg.engine.game; /* fast-forward */ g.starfall.setTime(0.1); });
await p.waitForFunction(() => window.iceberg.engine.game.starfall.state.phase === 'end', null, { timeout: 90000 });
console.log('end panel', await p.$eval('.sfl-end', e => e.innerText.replace(/\n+/g, ' | ')));
console.log('save', await p.evaluate(() => JSON.stringify(window.iceberg.economy.profile.gameData?.['starfall-lake'])));
await p.screenshot({ path: 'screenshots/starfall-end.png' });
await p.click('[data-retry]'); await p.waitForTimeout(500);
console.log('retry', await st());
await p.evaluate(() => window.iceberg.goHome());
console.log('errors', errs);
await b.close();
