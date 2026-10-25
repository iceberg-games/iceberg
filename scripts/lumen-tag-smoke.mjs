// Lumen Tag smoke: portal card -> play -> fire/tag -> bots fight -> power -> end -> rematch.
// Run: URL=http://127.0.0.1:5176/ node scripts/lumen-tag-smoke.mjs   (or vite build + file://dist)
import { chromium } from 'playwright';
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
const errs = []; p.on('console', m => m.type() === 'error' && errs.push(m.text())); p.on('pageerror', e => errs.push(e.message));
await p.goto(process.env.URL || 'file://' + process.cwd() + '/dist/index.html');
await p.click('#start-btn'); await p.waitForSelector('.game-card');
const names = await p.$$eval('.game-card .gc-name', e => e.map(x => x.textContent));
console.log('card present', names.includes('Lumen Tag'), 'KF present', names.includes('Knockout Floes'));
await p.evaluate(() => window.iceberg.play('lumen-tag'));
await p.waitForTimeout(2000);
const G = 'window.iceberg.engine.game.lumen';
await p.evaluate(`${G}.skipCountdown()`); await p.waitForTimeout(500);
const st = () => p.evaluate(`(() => { const s = ${G}.state; return { phase: s.phase, tags: s.tags, deaths: s.deaths, place: s.place, time: +s.time.toFixed(1) }; })()`);
console.log('playing', await st());
await p.keyboard.down('KeyF'); await p.waitForTimeout(900); await p.keyboard.up('KeyF');
for (let i = 0; i < 4; i++) { await p.evaluate(`(() => { const t = ${G}.ents().find(e => !e.dead && e.name !== 'You'); if (t) ${G}.tag(t.name); })()`); await p.waitForTimeout(250); }
await p.evaluate(`${G}.givePower('prism')`); await p.keyboard.down('KeyF'); await p.waitForTimeout(400);
await p.screenshot({ path: 'screenshots/lumen-tag-fire.png' }); await p.keyboard.up('KeyF');
console.log('after tags', await st());
await p.waitForTimeout(8000);
await p.screenshot({ path: 'screenshots/lumen-tag-play.png' });
console.log('after bots fight', await st(), JSON.stringify(await p.evaluate(`${G}.ents().map(e => e.name + ':' + e.score)`)));
await p.evaluate(`${G}.setTime(0.05)`);
await p.waitForFunction(`${G}.state.phase === 'end'`, null, { timeout: 20000 }).catch(() => {});
console.log('end panel', await p.$eval('.lmt-end', e => e.innerText.replace(/\n+/g, ' | ')).catch(() => 'none'));
console.log('save', await p.evaluate(() => JSON.stringify(window.iceberg.economy.profile.gameData?.['lumen-tag'])));
await p.screenshot({ path: 'screenshots/lumen-tag-end.png' });
await p.click('[data-retry]').catch(() => {}); await p.waitForTimeout(500);
console.log('rematch', await st());
await p.evaluate(() => window.iceberg.goHome());
console.log('errors', errs);
await b.close();
