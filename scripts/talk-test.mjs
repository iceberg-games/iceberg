// Headless check of avatar.talk()/setTalking(): mouth frames, extension, face cosmetics.
import { chromium } from 'playwright';
import { createServer } from 'vite';
import { mkdirSync } from 'fs';
mkdirSync('screenshots/talk', { recursive: true });
const server = await createServer({ server: { port: 5198 }, logLevel: 'error' }); await server.listen();
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 400, height: 400 } });
const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && errs.push(m.text()));
await p.goto('http://localhost:5198/scripts/talk-test.html'); await p.waitForFunction(() => window.__ready);
const shot = (n) => p.locator('canvas').screenshot({ path: `screenshots/talk/${n}.png` });
const log = [];
for (const [label, face, cover] of [['plain', null, false], ['shades', 'shades', false], ['goggles-covering', 'goggles', true]]) {
  await p.evaluate(([f, c]) => setup(f, c), [face, cover]);
  log.push([label, 'idle', await p.evaluate(() => step(16))]); await shot(`${label}_closed`);
  await p.evaluate(() => av.talk(500));
  log.push([label, 'talk t0', await p.evaluate(() => step(16))]); await shot(`${label}_open`);
  log.push([label, '+130ms', await p.evaluate(() => step(130))]); await shot(`${label}_half`);
  await p.evaluate(() => av.talk(1000)); // extend
  log.push([label, '+700ms extended', await p.evaluate(() => { let r; for (let i = 0; i < 44; i++) r = step(16); return r; })]);
  log.push([label, '+1s done', await p.evaluate(() => { let r; for (let i = 0; i < 63; i++) r = step(16); return r; })]); await shot(`${label}_after`);
  await p.evaluate(() => av.setTalking(true));
  log.push([label, 'manual 3s', await p.evaluate(() => { let r; for (let i = 0; i < 190; i++) r = step(16); return r; })]);
  await p.evaluate(() => av.setTalking(false));
  log.push([label, 'manual off', await p.evaluate(() => step(16))]);
}
log.forEach(l => console.log(JSON.stringify(l)));
console.log('errors:', errs);
await b.close(); await server.close();
