// Frost Tornado Hat hooks: proximity factor/spin and wind-audio attach (no-op while the loop file is missing).
import { chromium } from 'playwright'; import { createServer } from 'vite';
const s = await createServer({ server: { port: 5194 }, logLevel: 'error' }); await s.listen();
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const p = await b.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
await p.goto('http://localhost:5194/scripts/tornado-test.html'); await p.waitForFunction(() => window.__ready);
const r = await p.evaluate(() => run());
const ok = r.defaultProx === 0 && r.factors.join() === '0,0,0.5,1,1' && r.fromList === 0.8 && r.emptyList === 0 && r.spinNear > r.spinFar * 1.5 && !r.windFar && r.windCreated && r.windPlaying && r.highLayer && (r.ctxState !== 'running' || r.highGain > 0.5) && r.windHysteresis && r.windStoppedFar && !r.windAfterUnequip && !errs.length;
console.log(JSON.stringify(r), 'errors:', errs, ok ? 'PASS' : 'FAIL');
await b.close(); await s.close(); process.exit(ok ? 0 : 1);
