// Built game: equip Ice Rocket, recolor, fly with F; check nozzle sits at rocket bottom.
import { chromium } from 'playwright';
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
const errs = []; p.on('pageerror', e => errs.push(e.message));
await p.addInitScript(() => { try { localStorage.setItem('iceberg.device', 'computer'); } catch {} });
await p.goto('file://' + process.cwd() + '/dist/index.html'); await p.waitForFunction(() => window.iceberg);
await p.evaluate(async () => { const { economy } = window.iceberg; economy.demoGrant(100000); economy.buy('icerocket'); economy.equip('icerocket'); economy.setRocketColor('fins', '#e2474b'); await window.iceberg.play('frost-fields'); });
await p.waitForTimeout(2000);
const y0 = await p.evaluate(() => window.iceberg.engine.player?.pos?.y ?? window.iceberg.avatar.root.position.y);
await p.keyboard.down('KeyF'); await p.waitForTimeout(1500);
const st = await p.evaluate(() => {
  const av = window.iceberg.avatar, r = Object.values(av.attached).find(o => o.userData.cosmeticId === 'icerocket');
  const n = r.userData.nozzle.getWorldPosition(new av.root.position.constructor());
  const head = av.bones.head.getWorldPosition(new av.root.position.constructor());
  return { flying: window.iceberg.engine.player.flying, y: av.root.position.y, nozzleBelowHead: +(head.y - n.y).toFixed(2), fins: '#' + r.userData.mats.fins.color.getHexString() };
});
await p.screenshot({ path: 'screenshots/icerocket/in-game-flying.png' });
await p.keyboard.up('KeyF');
console.log(JSON.stringify({ y0, ...st }), 'errors:', errs); await b.close();
