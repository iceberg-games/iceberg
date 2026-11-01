// PC Studio QoL smoke: terrain brushes + undo, snap grid, cross-game clipboard,
// script stack order, chase/wander AI templates, hotkey cheat sheet, Ctrl+R.
// Usage: npm run build && node scripts/studio-qol-e2e.mjs
import { chromium } from 'playwright';
import path from 'path';
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
const errs = []; p.on('pageerror', e => errs.push(e.stack));
const res = []; const ok = (n, c, i = '') => res.push([c ? 'PASS' : 'FAIL', n, i]);
const EV = (f, a) => p.evaluate(f, a);
try {
  await p.goto('file://' + path.resolve('dist/index.html'));
  await p.click('#start-btn'); await p.waitForSelector('.game-card');
  await p.click('#create-btn'); await p.click('[data-template=blank]'); await p.waitForTimeout(1200);
  // terrain
  await p.keyboard.press('5'); await p.waitForTimeout(100);
  ok('5 = terrain tool + brush panel', await p.isVisible('#terrain-panel'));
  const h1 = await EV(() => { const g = window.iceberg.engine.game; for (let i = 0; i < 10; i++) g.terrainDab(0, 0, 'raise'); return g.terrainHeightAt(0, 0); });
  ok('raise brush lifts snow terrain', h1 > 2, h1);
  const h2 = await EV(() => { const g = window.iceberg.engine.game; g.checkpoint(); for (let i = 0; i < 6; i++) g.terrainDab(0, 0, 'lower'); return g.terrainHeightAt(0, 0); });
  ok('lower brush digs', h2 < h1, `${h1}->${h2}`);
  const h3 = await EV(() => { const g = window.iceberg.engine.game; g.undo(); return g.terrainHeightAt(0, 0); });
  ok('terrain stroke undoable', Math.abs(h3 - h1) < 1e-6, h3);
  // real mouse stroke
  const sum = () => EV(() => window.iceberg.engine.game.doc.terrain.heights.reduce((a, v) => a + v, 0));
  const before = await sum(); const scr = [720, 600];
  await p.mouse.move(scr[0], scr[1]); await p.mouse.down(); for (let i = 0; i < 8; i++) { await p.mouse.move(scr[0] + i * 3, scr[1]); await p.waitForTimeout(40); } await p.mouse.up();
  const after = await sum();
  ok('mouse drag paints terrain', after > before, `${before}->${after}`);
  await p.keyboard.press('Escape');
  // grid
  const g0 = await EV(() => window.iceberg.engine.game.showGrid()); await p.keyboard.press('g');
  ok('G toggles grid', (await EV(() => window.iceberg.engine.game.showGrid())) === !g0);
  await p.keyboard.press('g');
  // script stack
  const order = await EV(() => { const g = window.iceberg.engine.game; const id = g.insert('part'); const a = g.addScript(id, 'Spin slowly forever'); const b2 = g.addScript(id, 'When touched, kill them'); g.moveScript(id, b2, -1); return g.doc.instances.find(i => i.id === id).scripts.map(s => s.id === b2 ? 'B' : 'A').join(''); });
  ok('multi-script reorder', order === 'BA', order);
  await p.waitForTimeout(150);
  ok('script stack shows run order', await p.isVisible('#script-stack .st-order'));
  // AI templates
  await p.click('[data-tab=toolbox]'); await p.click('[data-ai=chase]'); await p.waitForTimeout(150);
  const chase = await EV(() => { const g = window.iceberg.engine.game; const i = g.doc.instances.find(x => x.id === g.selectedId); return i.scripts.map(s => s.program.continuous[0]?.type || 'rule').join(','); });
  ok('Chaser NPC template', chase.startsWith('chase'), chase);
  await p.click('[data-ai=wander]'); await p.waitForTimeout(150);
  const wan = await EV(() => { const g = window.iceberg.engine.game; const i = g.doc.instances.find(x => x.id === g.selectedId); return i.scripts[0].program.continuous[0]?.type; });
  ok('Wanderer NPC template', wan === 'wander', wan);
  // Ctrl+R
  const r0 = await EV(() => window.iceberg.engine.game.doc.instances.find(i => i.id === window.iceberg.engine.game.selectedId).rot[1]);
  await p.mouse.move(700, 450); await p.keyboard.press('Control+r'); await p.waitForTimeout(100);
  const r1 = await EV(() => window.iceberg.engine.game.doc.instances.find(i => i.id === window.iceberg.engine.game.selectedId).rot[1]);
  ok('Ctrl+R rotates 90°', Math.abs(Math.abs(r1 - r0) - 90) < 0.1, `${r0}->${r1}`);
  // copy, cheat sheet
  await p.keyboard.press('Control+c');
  const clip = await EV(() => window.iceberg.engine.game.clipboardInfo());
  ok('clipboard tagged with source game', clip?.count === 1 && !!clip.gameName, JSON.stringify(clip));
  const n0 = await EV(() => window.iceberg.engine.game.doc.instances.length); await p.keyboard.press('Control+v'); await p.waitForTimeout(100);
  ok('Ctrl+V pastes', (await EV(() => window.iceberg.engine.game.doc.instances.length)) === n0 + 1);
  await p.keyboard.press('F1'); ok('F1 opens shortcut cheat sheet', await p.isVisible('#hotkey-help'));
  await p.keyboard.press('Escape'); ok('Esc closes cheat sheet', !(await p.isVisible('#hotkey-help')));
  // play test: terrain + NPC run
  await p.click('#test-game'); await p.waitForTimeout(6000);
  const rt = await EV(() => { const g = window.iceberg.engine.game; const n = g.entries?.find(e => e.inst.name === 'Wanderer'); return { runtime: !!g.runtime, moved: n ? n.motion.offset.length() : -1, active: n?.motion.active, conts: n?.motion.conts.length }; });
  ok('playtest runs; wanderer moves', rt.runtime && rt.moved > 0, JSON.stringify(rt));
  await p.screenshot({ path: '/tmp/studio-qol-play.png' });
} catch (e) { errs.push(e.stack); }
ok('no page errors', !errs.length, errs.join('\n').slice(0, 800));
for (const r of res) console.log(r.join(' | '));
console.log(`${res.filter(r => r[0] === 'PASS').length}/${res.length} studio QoL checks passed`);
await b.close(); process.exit(res.every(r => r[0] === 'PASS') ? 0 : 1);
