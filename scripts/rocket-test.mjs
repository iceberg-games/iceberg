import { chromium } from 'playwright'; import { createServer } from 'vite'; import { mkdirSync } from 'fs';
mkdirSync('screenshots/icerocket', { recursive: true });
const s = await createServer({ server: { port: 5195 }, logLevel: 'error' }); await s.listen();
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] }); const p = await b.newPage({ viewport: { width: 480, height: 480 } });
const errs = []; p.on('pageerror', e => errs.push(e.message));
await p.goto('http://localhost:5195/scripts/rocket-test.html'); await p.waitForFunction(() => window.__ready);
const combos = { frost: { body: '#e8f4ff', fins: '#3f8fd0', trim: '#7fe3ff' }, ember: { body: '#f2f2f2', fins: '#e2474b', trim: '#ffb347' } };
for (const [cn, c] of Object.entries(combos)) for (const [an, yaw] of [['back', Math.PI], ['side', Math.PI / 2], ['backthreequarter', Math.PI * 0.75]]) {
  const res = await p.evaluate(([y, c]) => shot(y, c), [yaw, c]);
  await p.locator('canvas').screenshot({ path: `screenshots/icerocket/${cn}_${an}.png` });
  if (an === 'back') console.log(cn, JSON.stringify(res));
}
console.log('errors:', errs); await b.close(); await s.close();
