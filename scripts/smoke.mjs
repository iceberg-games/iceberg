import { chromium } from 'playwright';
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
const errs = []; p.on('console', m => m.type() === 'error' && errs.push(m.text())); p.on('pageerror', e => errs.push(e.message));
await p.goto('file://' + process.cwd() + '/dist/index.html');
await p.click('#start-btn');
await p.waitForSelector('.game-card');
console.log('cards', await p.$$eval('.game-card .gc-name', e => e.map(x => x.textContent)));
for (const id of ['frost-fields', 'birg-hq']) {
  await p.evaluate(id => window.iceberg.play(id), id);
  await p.waitForTimeout(1500);
  const a = await p.evaluate(() => window.iceberg.engine.player.pos.toArray());
  await p.keyboard.down('KeyW'); await p.waitForTimeout(800); await p.keyboard.up('KeyW');
  const b2 = await p.evaluate(() => window.iceberg.engine.player.pos.toArray());
  console.log(id, 'moved', a.map(v=>v.toFixed(1)), '->', b2.map(v=>v.toFixed(1)));
  await p.screenshot({ path: `screenshots/${id}.png` });
  await p.evaluate(() => window.iceberg.goHome());
}
// coins + shop + build + creator
await p.evaluate(() => window.iceberg.play('frost-fields')); await p.waitForTimeout(800);
const r = await p.evaluate(() => { const g = window.iceberg.engine.game; const c = g.coins.coins.find(c=>c.userData.active); const before = window.iceberg.economy.coins;
  window.iceberg.engine.player.teleport(c.position.clone().setY(0)); return before; });
await p.waitForTimeout(500);
console.log('bucks', r, '->', await p.evaluate(() => window.iceberg.economy.coins));
await p.evaluate(() => { const e = window.iceberg.economy; e.demoGrant(100000); e.buy('icerocket'); e.equip('icerocket'); e.buy('icecrown'); e.equip('icecrown'); });
console.log('equipped', await p.evaluate(() => JSON.stringify(window.iceberg.economy.profile.equipped)));
await p.keyboard.press('KeyB'); await p.mouse.click(640, 560); await p.waitForTimeout(300);
console.log('blocks', await p.evaluate(() => window.iceberg.engine.game.building.count));
await p.evaluate(() => window.iceberg.goHome()); await p.click('#create-btn'); await p.click('[data-template=island]'); await p.waitForTimeout(1200);
await p.click('#save-game'); await p.click('#exit-editor'); await p.waitForTimeout(300);
console.log('your games', await p.$$eval('#your-games .gc-name', e => e.map(x => x.textContent)));
console.log('errors', errs);
await b.close();
