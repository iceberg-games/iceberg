// Knockout Floes smoke: portal card -> play -> throw/hit -> floe cracks -> KO -> end -> rematch.
// Run: npx vite build && node scripts/knockout-floes-smoke.mjs
import { chromium } from 'playwright';
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
const errs = []; p.on('console', m => m.type() === 'error' && errs.push(m.text())); p.on('pageerror', e => errs.push(e.message));
await p.goto(process.env.URL || 'file://' + process.cwd() + '/dist/index.html');
await p.click('#start-btn'); await p.waitForSelector('.game-card');
const names = await p.$$eval('.game-card .gc-name', e => e.map(x => x.textContent));
console.log('card present', names.includes('Knockout Floes'));
await p.evaluate(() => window.iceberg.play('knockout-floes'));
await p.waitForTimeout(1500);
const G = 'window.iceberg.engine.game.floes';
await p.evaluate(`${G}.skipCountdown()`); await p.waitForTimeout(500);
const st = () => p.evaluate(`(() => { const s = ${G}.state; return { phase: s.phase, alive: s.alive, kos: s.kos, hits: s.hits, time: +s.time.toFixed(1) }; })()`);
console.log('playing', await st());
await p.keyboard.down('KeyE'); await p.waitForTimeout(500); await p.keyboard.up('KeyE');
for (let i = 0; i < 6; i++) { await p.evaluate(`(() => { const t = ${G}.ents().find(e => !e.out && e.name !== 'You'); if (t) ${G}.throwAt(t.name, 1); })()`); await p.waitForTimeout(400); }
console.log('after throws', await st());
await p.waitForTimeout(6000);
await p.screenshot({ path: 'screenshots/knockout-floes-play.png' });
console.log('after bots brawl', await st(), await p.evaluate(`${G}.ents().map(e => e.name + (e.out ? ':out' : ''))`));
await p.evaluate(`(() => { const t = ${G}.ents().find(e => !e.out && e.name !== 'You'); if (t) ${G}.knock(t.name); })()`); await p.waitForTimeout(400);
console.log('after KO', await st());
await p.evaluate(`${G}.setTime(0.05)`);
await p.waitForFunction(`${G}.state.phase === 'end'`, null, { timeout: 20000 }).catch(() => {});
console.log('end panel', await p.$eval('.kof-end', e => e.innerText.replace(/\n+/g, ' | ')).catch(() => 'none'));
console.log('save', await p.evaluate(() => JSON.stringify(window.iceberg.economy.profile.gameData?.['knockout-floes'])));
await p.screenshot({ path: 'screenshots/knockout-floes-end.png' });
await p.click('[data-retry]').catch(() => {}); await p.waitForTimeout(500);
console.log('rematch', await st());
await p.evaluate(() => window.iceberg.goHome());
console.log('errors', errs);
await b.close();
