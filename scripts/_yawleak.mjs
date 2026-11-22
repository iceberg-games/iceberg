import { chromium } from 'playwright';
const BASE = process.argv[2];
const b = await chromium.launch({ headless: false, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
await p.goto(BASE + 'play/'); await p.waitForTimeout(1500); if (await p.$('#start-btn')) await p.click('#start-btn'); await p.waitForSelector('.game-card');
await p.evaluate(() => window.iceberg.play('frost-fields')); await p.waitForTimeout(2500);
for (const yaw of [2.0, -2.5, 3.0]) {
  const r = await p.evaluate(async (yaw) => {
    const e = window.iceberg.engine, root = e.avatar.root; root.rotation.y = yaw; e.player.facing = yaw;
    const head = () => { const q = root.quaternion; const V = e.camera.position.constructor; const f = new V(0, 0, 1).applyQuaternion(q), u = new V(0, 1, 0).applyQuaternion(q); return { heading: +Math.atan2(f.x, f.z).toFixed(2), up: +u.y.toFixed(2), euler: root.rotation.toArray().slice(0, 3).map(v => +v.toFixed(2)) }; };
    const before = head();
    window.iceberg.goHome(); await new Promise(r => setTimeout(r, 800));
    const home = head();
    window.iceberg.play('frost-fields'); await new Promise(r => setTimeout(r, 2500));
    return { before, home, afterReload: head() };
  }, yaw);
  console.log('yaw', yaw, JSON.stringify(r));
}
await b.close();
