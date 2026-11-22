// Repro for "avatar walks sideways": walk so the avatar yaw is > 90°, go Home (home avatar snapshot runs), re-enter a game, walk diagonally.
//   DISPLAY=:4 node scripts/_yawleak.mjs <baseUrl> <tag>
import { chromium } from 'playwright';
const BASE = process.argv[2], TAG = process.argv[3] || 'run';
const OUT = new URL('../designs/editor-hotfix/', import.meta.url).pathname;
const b = await chromium.launch({ headless: false, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
await p.goto(BASE + 'play/'); await p.waitForTimeout(1500); if (await p.$('#start-btn')) await p.click('#start-btn'); await p.waitForSelector('.game-card');
await p.evaluate(() => window.iceberg.play('frost-fields')); await p.waitForTimeout(2500);
await p.keyboard.down('KeyS'); await p.waitForTimeout(700); await p.keyboard.up('KeyS');   // face the camera (yaw ~ 0), then turn so |yaw| > 90°
await p.keyboard.down('KeyW'); await p.waitForTimeout(700); await p.keyboard.up('KeyW');   // away from the camera: yaw ~ 180°
await p.evaluate(async () => { window.iceberg.goHome(); await new Promise(r => setTimeout(r, 900)); window.iceberg.play('frost-fields'); await new Promise(r => setTimeout(r, 2500)); });
await p.evaluate(() => { window.iceberg.engine.player.camYaw = 0.6; }); await p.waitForTimeout(300);
const a0 = await p.evaluate(() => [window.iceberg.engine.player.pos.x, window.iceberg.engine.player.pos.z]);
await p.keyboard.down('KeyD'); await p.waitForTimeout(1100);
await p.screenshot({ path: OUT + `2-sideways-repro-${TAG}.png` });
const r = await p.evaluate(() => { const e = window.iceberg.engine, V = e.camera.position.constructor, f = new V(0, 0, 1).applyQuaternion(e.avatar.root.quaternion); return { pos: [e.player.pos.x, e.player.pos.z], heading: Math.atan2(f.x, f.z), euler: e.avatar.root.rotation.toArray().slice(0, 3) }; });
await p.keyboard.up('KeyD');
const mv = Math.atan2(r.pos[0] - a0[0], r.pos[1] - a0[1]); let d = r.heading - mv; d = Math.atan2(Math.sin(d), Math.cos(d));
console.log(TAG, JSON.stringify({ moveYaw: +mv.toFixed(2), heading: +r.heading.toFixed(2), error_deg: +(d * 180 / Math.PI).toFixed(1), euler: r.euler.map(v => +v.toFixed(2)) }));
await b.close(); process.exit(Math.abs(d) < 0.35 ? 0 : 1);
