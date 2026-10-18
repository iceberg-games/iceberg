// End-to-end test of Iceberg Studio in headless Chromium (file:// build).
import { chromium } from 'playwright';
import path from 'path';
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
const p = await ctx.newPage();
const errs = []; p.on('console', m => m.type() === 'error' && errs.push(m.text())); p.on('pageerror', e => errs.push(e.stack));
const browserDialogs = []; p.on('dialog', d => { browserDialogs.push(d.type()); d.accept(d.type() === 'prompt' ? 'Wave2' : undefined); });
const results = []; const ok = (name, cond, info = '') => { results.push([cond ? 'PASS' : 'FAIL', name, info]); };
const ED = () => p.evaluate(() => !!window.iceberg.engine.game?.editing);
const count = () => p.evaluate(() => window.iceberg.engine.game.doc.instances.length);
const sel = () => p.evaluate(() => { const g = window.iceberg.engine.game; return g.doc.instances.find(i => i.id === g.selectedId); });
const setField = async (selector, value) => { await p.evaluate(([s, v]) => { const el = document.querySelector(s); if (el.type === 'checkbox') el.checked = v; else el.value = v; el.dispatchEvent(new Event('change', { bubbles: true })); }, [selector, value]); await p.waitForTimeout(80); };
const setVec = async (key, v) => { for (let i = 0; i < 3; i++) await setField(`[data-prop="${key}.${i}"]`, v[i]); };
const selectByName = (n) => p.evaluate((n) => { const g = window.iceberg.engine.game; const i = g.doc.instances.find(x => x.name === n); g.select(i.id); return i.id; }, n);

try {
await p.goto('file://' + path.resolve('dist/index.html'));
await p.click('#start-btn'); await p.waitForSelector('.game-card');
await p.click('#create-btn'); await p.click('[data-template=blank]'); await p.waitForTimeout(1200);
ok('studio opens', await ED() && await p.isVisible('#creator-panel'));
ok('game HUD hidden in studio', !(await p.isVisible('#hud')));

// Insert each part type
const n0 = await count();
for (const k of ['block', 'sphere', 'cylinder', 'wedge', 'kill-brick', 'checkpoint', 'coin']) { await p.click(`[data-insert="${k}"]`); await p.waitForTimeout(150); }
ok('insert block/sphere/cylinder/wedge/kill/checkpoint/coin', (await count()) === n0 + 7, `${n0} -> ${await count()}`);
const shapes = await p.evaluate(() => window.iceberg.engine.game.doc.instances.filter(i => i.type === 'part').map(i => i.shape));
ok('all 4 shapes present', ['box', 'sphere', 'cylinder', 'wedge'].every(s => shapes.includes(s)), shapes.join(','));

// Properties panel: position/rotation/size/color/material/transparency/anchored/collide
await selectByName('Part'); await p.waitForTimeout(100);
await setField('#prop-name', 'Floor'); await setVec('pos', [0, 0.5, 10]); await setVec('size', [12, 1, 12]); await setVec('rot', [0, 15, 0]);
await setField('#prop-color', '#33aa55'); await setField('#prop-material', 'neon'); await setField('#prop-transparency', 0.3);
await setField('#prop-anchored', false); await setField('#prop-anchored', true); await setField('#prop-collide', true);
let s = await sel();
ok('properties edit', s.name === 'Floor' && s.pos[2] === 10 && s.size[0] === 12 && s.rot[1] === 15 && s.color === '#33aa55' && s.material === 'neon' && s.transparency === 0.3 && s.anchored === true, JSON.stringify([s.name, s.pos, s.size, s.rot, s.color, s.material, s.transparency]));
await setVec('rot', [0, 0, 0]); await setField('#prop-material', 'plastic'); await setField('#prop-transparency', 0);

// Gizmo: Move tool attaches; drag the center handle with the mouse
await p.click('[data-tool=move]');
const giz = await p.evaluate(() => { const g = window.iceberg.engine.game; return !!g.tc.object && g.tc.object === g.world.entries.get(g.selectedId).root; });
ok('move gizmo attached to selection', giz);
await p.evaluate(() => window.iceberg.engine.game.focus());
await p.waitForTimeout(400);
const scr = await p.evaluate(() => { const g = window.iceberg.engine.game; const v = g.world.entries.get(g.selectedId).root.position.clone().project(window.iceberg.engine.camera); return [(v.x + 1) / 2 * innerWidth, (1 - v.y) / 2 * innerHeight]; });
const before = (await sel()).pos;
await p.mouse.move(scr[0], scr[1]); await p.waitForTimeout(200); await p.mouse.move(scr[0] + 2, scr[1] + 1); await p.waitForTimeout(200);
await p.mouse.down(); for (let i = 1; i <= 10; i++) { await p.mouse.move(scr[0] + i * 12, scr[1] + 1); await p.waitForTimeout(40); } await p.mouse.up(); await p.waitForTimeout(300);
let after = (await sel()).pos;
let viaMouse = JSON.stringify(before) !== JSON.stringify(after);
if (!viaMouse) { // fall back to driving the gizmo programmatically (same commit path)
  await p.evaluate(() => { const g = window.iceberg.engine.game, tc = g.tc; tc.dispatchEvent({ type: 'dragging-changed', value: true }); tc.object.position.x += 3; tc.dispatchEvent({ type: 'dragging-changed', value: false }); });
  after = (await sel()).pos;
}
ok('move gizmo drag commits position', JSON.stringify(before) !== JSON.stringify(after), `${viaMouse ? 'mouse drag' : 'programmatic drag'} ${JSON.stringify(before)} -> ${JSON.stringify(after)}`);
for (const [tool, change] of [['rotate', 'tc.object.rotation.y += Math.PI/4'], ['scale', 'tc.object.scale.set(2,1,1)']]) {
  await p.click(`[data-tool=${tool}]`);
  const r = await p.evaluate((change) => { const g = window.iceberg.engine.game, tc = g.tc; const mode = tc.mode; const before = JSON.stringify(g.doc.instances.find(i => i.id === g.selectedId)); tc.dispatchEvent({ type: 'dragging-changed', value: true }); eval(change); tc.dispatchEvent({ type: 'dragging-changed', value: false }); const a = g.doc.instances.find(i => i.id === g.selectedId); return [mode, before !== JSON.stringify(a), a.rot, a.size]; }, change);
  ok(`${tool} gizmo`, r[1] && r[0] === (tool === 'rotate' ? 'rotate' : 'scale'), JSON.stringify(r));
}
await setVec('rot', [0, 0, 0]); await setVec('size', [12, 1, 12]); await setVec('pos', [0, 0.5, 10]);

// Undo / redo
const c1 = await count();
await p.click('[data-insert=block]'); await p.waitForTimeout(100);
await p.click('#undo-btn'); const cu = await count(); await p.click('#redo-btn'); const cr = await count();
await p.keyboard.press('Control+z'); const ck = await count();
ok('undo/redo (buttons + Ctrl+Z)', cu === c1 && cr === c1 + 1 && ck === c1, `${c1} ${cu} ${cr} ${ck}`);
await selectByName('Floor'); const ck2 = await count(); await p.keyboard.press('Control+d'); const cd = await count(); await p.keyboard.press('Delete'); const cdel = await count();
ok('duplicate (Ctrl+D) + delete (Del)', cd === ck2 + 1 && cdel === ck2, `${ck2} ${cd} ${cdel}`);

// ---------- Multi-select, groups, clipboard ----------
const EV = (fn, arg) => p.evaluate(fn, arg);
const baseN = await count();
const mids = await EV(() => { const g = window.iceberg.engine.game; return [['MA', [-30, 0.5, -30]], ['MB', [-26, 0.5, -30]], ['MC', [-22, 0.5, -30]]].map(([name, pos]) => g.insert('part', { name, pos, color: '#ff0000' })); });
const selIds = () => EV(() => [...window.iceberg.engine.game.selection]);
await p.click('[data-tab=explorer]');
await p.click(`[data-node="${mids[0]}"]`); await p.click(`[data-node="${mids[1]}"]`, { modifiers: ['Control'] });
const s2 = await selIds();
await p.click(`[data-node="${mids[0]}"]`); await p.click(`[data-node="${mids[2]}"]`, { modifiers: ['Shift'] });
const s3 = await selIds();
ok('explorer Ctrl-click toggles + Shift-click range', s2.length === 2 && s3.length === 3 && mids.every(id => s3.includes(id)), `${s2.length} / ${s3.length}`);
ok('multi-edit properties panel shown', await p.isVisible('#multi-props'));
await setField('#mprop-color', '#22cc88'); await setField('[data-mprop="pos.1"]', 5);
let ms = await EV((ids) => ids.map(id => window.iceberg.engine.game.doc.instances.find(i => i.id === id)), mids);
ok('multi-edit color + position Y on all', ms.every(i => i.color === '#22cc88' && i.pos[1] === 5) && ms[0].pos[0] === -30 && ms[2].pos[0] === -22, JSON.stringify(ms.map(i => [i.color, i.pos])));
await p.keyboard.press('Control+z');
ms = await EV((ids) => ids.map(id => window.iceberg.engine.game.doc.instances.find(i => i.id === id)), mids);
ok('undo multi-edit', ms.every(i => i.pos[1] === 0.5 && i.color === '#22cc88'), JSON.stringify(ms.map(i => i.pos[1])));
// group gizmo: move then rotate around the selection centre
await p.click('[data-tool=move]');
const gm = await EV(() => { const g = window.iceberg.engine.game, tc = g.tc; const onPivot = tc.object === g.pivot; const c = g.pivot.position.toArray();
  tc.dispatchEvent({ type: 'dragging-changed', value: true }); g.pivot.position.x += 4; g.pivot.updateMatrixWorld(true); tc.dispatchEvent({ type: 'objectChange' }); tc.dispatchEvent({ type: 'dragging-changed', value: false });
  return { onPivot, c, pos: g.selection.map(id => g.doc.instances.find(i => i.id === id).pos) }; });
ok('group move gizmo on selection centre', gm.onPivot && Math.abs(gm.c[0] + 26) < 0.01 && gm.pos.map(q => q[0]).join() === '-26,-22,-18', JSON.stringify(gm));
await p.click('[data-tool=rotate]');
const gr = await EV(() => { const g = window.iceberg.engine.game, tc = g.tc;
  tc.dispatchEvent({ type: 'dragging-changed', value: true }); g.pivot.rotation.y = Math.PI / 2; g.pivot.updateMatrixWorld(true); tc.dispatchEvent({ type: 'objectChange' }); tc.dispatchEvent({ type: 'dragging-changed', value: false });
  return g.selection.map(id => { const i = g.doc.instances.find(x => x.id === id); return [i.pos, i.rot]; }); });
ok('group rotate around centre', Math.abs(gr[0][0][0] + 22) < 0.01 && Math.abs(gr[0][0][2] + 26) < 0.01 && Math.abs(gr[2][0][2] + 34) < 0.01 && Math.abs(gr[1][1][1] - 90) < 0.1, JSON.stringify(gr));
await p.click('[data-tool=scale]');
const gs = await EV(() => { const g = window.iceberg.engine.game, tc = g.tc;
  tc.dispatchEvent({ type: 'dragging-changed', value: true }); g.pivot.scale.set(2, 2, 2); g.pivot.updateMatrixWorld(true); tc.dispatchEvent({ type: 'objectChange' }); tc.dispatchEvent({ type: 'dragging-changed', value: false });
  return g.selection.map(id => { const i = g.doc.instances.find(x => x.id === id); return [i.pos, i.size]; }); });
ok('group scale around centre', Math.abs(gs[0][1][0] - 8) < 0.01 && Math.abs(gs[0][0][2] + 22) < 0.01, JSON.stringify(gs));
for (let i = 0; i < 3; i++) await p.keyboard.press('Control+z');
ms = await EV((ids) => ids.map(id => window.iceberg.engine.game.doc.instances.find(i => i.id === id).pos), mids);
ok('undo group transforms', ms.map(q => q[0]).join() === '-30,-26,-22', JSON.stringify(ms));
// group into a Model
await p.click('[data-tool=select]');
await EV((ids) => window.iceberg.engine.game.selectMany(ids), mids);
await p.keyboard.press('Control+g'); await p.waitForTimeout(100);
const grp = await EV(() => { const g = window.iceberg.engine.game; const m = g.doc.instances.find(i => i.id === g.selectedId); return m && { type: m.type, id: m.id, kids: g.childrenOf(m.id).length, pos: m.pos }; });
ok('Ctrl+G groups into a Model', grp?.type === 'group' && grp.kids === 3 && Math.abs(grp.pos[0] + 26) < 0.01, JSON.stringify(grp));
ok('explorer shows Model tree', await p.isVisible(`[data-node="${grp.id}"].group`) && await p.isVisible(`[data-twisty="${grp.id}"]`));
await EV(() => window.iceberg.engine.game.focus()); await p.waitForTimeout(300);
const scrC = await EV((id) => { const g = window.iceberg.engine.game; const v = g.world.entries.get(id).root.position.clone().project(window.iceberg.engine.camera); return [(v.x + 1) / 2 * innerWidth, (1 - v.y) / 2 * innerHeight]; }, mids[2]);
await EV(() => window.iceberg.engine.game.select(null));
await p.mouse.click(scrC[0], scrC[1]); await p.waitForTimeout(100);
ok('viewport click on a part inside a Model selects the Model', (await selIds()).join() === grp.id, JSON.stringify(await selIds()));
await p.keyboard.down('Shift'); await p.mouse.click(scrC[0], scrC[1]); await p.keyboard.up('Shift'); await p.waitForTimeout(100);
const afterShift = await selIds();
await p.keyboard.down('Control'); await p.mouse.click(scrC[0], scrC[1]); await p.keyboard.up('Control'); await p.waitForTimeout(100);
ok('viewport Shift/Ctrl-click toggles selection', afterShift.length === 0 && (await selIds()).join() === grp.id, `${afterShift.length} then ${(await selIds()).length}`);
// moving the Model moves its parts
await p.click('[data-tool=move]');
await EV(() => { const g = window.iceberg.engine.game, tc = g.tc; tc.dispatchEvent({ type: 'dragging-changed', value: true }); g.pivot.position.z += 2; g.pivot.updateMatrixWorld(true); tc.dispatchEvent({ type: 'objectChange' }); tc.dispatchEvent({ type: 'dragging-changed', value: false }); });
ms = await EV((ids) => ids.map(id => window.iceberg.engine.game.doc.instances.find(i => i.id === id).pos[2]), mids);
ok('gizmo on a Model moves everything inside', ms.every(z => z === -28), JSON.stringify(ms));
await p.keyboard.press('Control+z');
// duplicate the Model → new Model with new children
const nBeforeDup = await count();
await p.keyboard.press('Control+d'); await p.waitForTimeout(100);
const dupG = await EV(() => { const g = window.iceberg.engine.game; const m = g.doc.instances.find(i => i.id === g.selectedId); return { type: m.type, kids: g.childrenOf(m.id).map(c => c.name) }; });
ok('duplicate a Model (with children, ids remapped)', (await count()) === nBeforeDup + 4 && dupG.type === 'group' && dupG.kids.length === 3, JSON.stringify(dupG));
await p.keyboard.press('Delete'); await p.waitForTimeout(100);
ok('delete a Model deletes its children', (await count()) === nBeforeDup, `${await count()} vs ${nBeforeDup}`);
// rename via in-studio dialog
await p.dblclick(`[data-node="${grp.id}"]`); await p.waitForSelector('#name-dialog-input'); await p.fill('#name-dialog-input', 'Stairs'); await p.press('#name-dialog-input', 'Enter'); await p.waitForTimeout(100);
ok('rename via in-studio dialog', await EV((id) => window.iceberg.engine.game.doc.instances.find(i => i.id === id).name === 'Stairs', grp.id) && !browserDialogs.length);
await EV((id) => window.iceberg.engine.game.select(id), grp.id);
await p.keyboard.press('Control+Shift+g'); await p.waitForTimeout(100);
const ung = await EV((ids) => { const g = window.iceberg.engine.game; return { groups: g.doc.instances.filter(i => i.type === 'group').length, parents: ids.map(id => g.doc.instances.find(i => i.id === id).parent || null), sel: g.selection.length }; }, mids);
ok('Ctrl+Shift+G ungroups', ung.groups === 0 && ung.parents.every(x => x === null) && ung.sel === 3, JSON.stringify(ung));
await p.keyboard.press('Control+z'); const regrouped = await EV(() => window.iceberg.engine.game.doc.instances.filter(i => i.type === 'group').length);
await p.keyboard.press('Control+y'); const reung = await EV(() => window.iceberg.engine.game.doc.instances.filter(i => i.type === 'group').length);
ok('undo/redo group ops', regrouped === 1 && reung === 0, `${regrouped} ${reung}`);
// Ctrl+A, box select, copy/paste multiple
await EV(() => window.iceberg.engine.game.select(null));
await p.keyboard.press('Control+a');
ok('Ctrl+A selects everything', (await selIds()).length === await count(), `${(await selIds()).length} / ${await count()}`);
await EV(() => window.iceberg.engine.game.select(null));
await p.click('[data-tool=select]');
const rectPts = await EV((ids) => { const g = window.iceberg.engine.game; return ids.map(id => { const v = g.world.entries.get(id).root.position.clone().project(window.iceberg.engine.camera); return [(v.x + 1) / 2 * innerWidth, (1 - v.y) / 2 * innerHeight]; }); }, mids);
const xs = rectPts.map(q => q[0]), ys = rectPts.map(q => q[1]);
const x0 = Math.min(...xs) - 40, y0 = Math.max(...ys) + 60, x1 = Math.max(...xs) + 40, y1 = Math.min(...ys) - 40;
await p.mouse.move(x0, y0); await p.mouse.down(); for (let i = 1; i <= 8; i++) { await p.mouse.move(x0 + (x1 - x0) * i / 8, y0 + (y1 - y0) * i / 8); await p.waitForTimeout(20); } await p.mouse.up(); await p.waitForTimeout(100);
const boxSel = await selIds();
ok('box/marquee select by dragging', mids.every(id => boxSel.includes(id)) && await p.evaluate(() => document.querySelector('.st-marquee').classList.contains('hidden')), `${boxSel.length} selected`);
await EV((ids) => window.iceberg.engine.game.selectMany(ids), mids);
const nc = await count();
await p.keyboard.press('Control+c'); await p.keyboard.press('Control+v'); await p.waitForTimeout(100);
const pasted = await selIds();
ok('copy/paste multiple', (await count()) === nc + 3 && pasted.length === 3 && !pasted.some(id => mids.includes(id)) && await EV(() => !!localStorage.getItem('iceberg:v1:studioClipboard')), `${nc} -> ${await count()}`);
await p.keyboard.press('Control+d'); const nd = await count();
await p.keyboard.press('Delete'); const ndel = await count();
await p.keyboard.press('Control+z'); const nun = await count();
ok('duplicate/delete multiple + undo', nd === nc + 6 && ndel === nc + 3 && nun === nc + 6, `${nd} ${ndel} ${nun}`);
await EV((n) => { const g = window.iceberg.engine.game; g.selectMany(g.doc.instances.slice(n).map(i => i.id)); g.remove(); }, baseN);
ok('cleanup multi-select parts', (await count()) === baseN, `${await count()} vs ${baseN}`);
await p.click('[data-tool=move]');

// Arrange the course
await selectByName('KillBrick'); await setVec('pos', [0, 0.5, 30]);
await selectByName('Checkpoint'); await setVec('pos', [0, 0.2, 20]);
await selectByName('Coin'); await setVec('pos', [3, 1.2, 4]);
await selectByName('Sphere'); await setVec('pos', [-6, 1.5, 4]);
await selectByName('Wedge'); await setVec('pos', [6, 1, 4]);
await selectByName('Cylinder'); await setVec('pos', [0, 0.5, 40]); await setVec('size', [6, 1, 6]);

// Plain-words script: spinning part
await p.click('#add-script'); await p.fill('#script-text', 'Spin slowly forever'); await p.click('#script-apply'); await p.waitForTimeout(150);
const prev = await p.textContent('#script-preview');
ok('plain-words script preview (spin)', /Spins slowly forever/.test(prev), prev);
await p.check('#show-code'); ok('show code toggle', /"spin"/.test(await p.textContent('#script-code')));
await p.fill('#script-text', 'make it fly to the moon'); await p.click('#script-apply'); await p.waitForTimeout(150);
ok('unknown phrase gives helpful message', await p.isVisible('#script-unknown'), (await p.textContent('#script-unknown')).slice(0, 80));
ok('suggestion chips for unknown phrase', (await p.$$('#script-suggestions .st-chip')).length > 0);
await p.fill('#script-text', 'Spin slowly forever'); await p.click('#script-apply');
// second script on wedge: touch → give points + message
await selectByName('Wedge'); await p.waitForTimeout(100); await p.click('#add-script');
await p.fill('#script-text', 'When touched give 10 points and say "Nice!"'); await p.click('#script-apply'); await p.waitForTimeout(100);
ok('touch script preview', /give the player 10 points/.test(await p.textContent('#script-preview')));

// Phrases cheat-sheet panel: clicking a phrase gives the selected part a script
await selectByName('Sphere'); await p.click('[data-tab=phrases]'); await p.waitForTimeout(100);
const nPhr = await p.$$eval('[data-phrase]', e => e.length);
await p.click('[data-phrase="When clicked, turn green"]'); await p.waitForTimeout(150);
const sphScripts = await p.evaluate(() => window.iceberg.engine.game.doc.instances.find(i => i.name === 'Sphere').scripts.map(s => s.text));
ok('📖 Phrases panel (click example → script)', nPhr >= 40 && sphScripts.includes('When clicked, turn green'), `${nPhr} phrases; ${JSON.stringify(sphScripts)}`);
await p.click('[data-tab=explorer]');
// scenery for runtime checks: a moving platform, a lying (rotated) cylinder, a door + button by name
await EV(() => { const g = window.iceberg.engine.game;
  const lift = g.insert('part', { name: 'Lift', pos: [20, 0.5, -20], size: [6, 1, 6], color: '#3388ff' }); g.addScript(lift, 'Move between 20, 0.5, -20 and 32, 0.5, -20 every 4 seconds');
  g.insert('part', { name: 'Log', shape: 'cylinder', pos: [20, 1, 20], size: [2, 8, 2], rot: [0, 0, 90], color: '#8a5a34' });
  g.insert('part', { name: 'Gate', pos: [-20, 3.5, 20], size: [6, 7, 1], color: '#aa7744' });
  const btn = g.insert('part', { name: 'GateButton', pos: [-20, 0.3, 14], size: [2, 0.6, 2], color: '#ff3355' }); g.addScript(btn, 'When the button is clicked, open the door called Gate for 5 seconds');
});


// Gear from Toolbox
await p.click('[data-tab=toolbox]'); await p.click('[data-gear=speedCoil]'); await p.waitForTimeout(100);
await selectByName('SpeedCoilGiver'); await setVec('pos', [0, 0.5, 15]);
ok('gear giver inserted', !!(await sel()) && (await sel()).gearId === 'speedCoil');

// Upload .glb models (plain + rigged)
await p.setInputFiles('#studio-model-file', 'scripts/fixtures/box.glb'); await p.waitForTimeout(800);
await p.click('[data-tab=toolbox]');
await p.setInputFiles('#studio-model-file', 'scripts/fixtures/worm-rig.glb'); await p.waitForTimeout(800);
const mdl = await p.evaluate(() => window.iceberg.engine.game.doc.instances.filter(i => i.type === 'model').map(i => i.name));
const wormRig = await p.evaluate(() => { const g = window.iceberg.engine.game; const i = g.doc.instances.find(x => x.name === 'worm-rig'); const e = g.world.entries.get(i.id); return [!!e.rig, e.rig ? [...e.rig.bones.keys()] : [], (e.rig?.clips || []).map(c => c.name)]; });
ok('upload .glb models', mdl.includes('box') && mdl.includes('worm-rig'), mdl.join(','));
ok('rigged .glb detected (bones + embedded clip)', wormRig[0] && wormRig[1].includes('Tip') && wormRig[2].includes('Bend'), JSON.stringify(wormRig));
await selectByName('box'); await setVec('pos', [-6, 0, 12]);
await selectByName('worm-rig'); await setVec('pos', [6, 0, 12]);

// Animator: R6 rig
await p.click('[data-tab=toolbox]'); await p.click('text=R6 Rig'); await p.waitForTimeout(200);
await selectByName('R6 Rig'); await setVec('pos', [-3, 0, 8]);
await p.click('#animator-btn'); await p.waitForTimeout(200);
await p.selectOption('#anim-rig', await p.evaluate(() => window.iceberg.engine.game.doc.instances.find(x => x.name === 'R6 Rig').id));
await p.click('#anim-new'); await p.waitForSelector('#name-dialog-input'); await p.fill('#name-dialog-input', 'Wave2'); await p.click('#name-dialog-ok'); await p.waitForTimeout(150);
ok('in-studio name dialog for new animation (no browser popup)', await p.evaluate(() => window.iceberg.engine.game.currentAnim()?.name === 'Wave2') && !browserDialogs.includes('prompt'), JSON.stringify(browserDialogs));
await p.click('[data-bone="Right Arm"]');
await setField('[data-rot=Z]', 120); await p.waitForTimeout(100);
await p.evaluate(() => { window.iceberg.engine.game.poseAt(1.0); }); await p.click('[data-bone="Right Arm"]'); await setField('[data-rot=Z]', 30);
const anim = await p.evaluate(() => { const g = window.iceberg.engine.game; const a = g.currentAnim(); return a && { name: a.name, keys: (a.tracks['Right Arm'] || []).map(k => [k.t, k.rot[2]]) }; });
ok('animator keyframes on R6 rig', anim && anim.keys.length >= 2, JSON.stringify(anim));
const boneGizmo = await p.evaluate(() => { const g = window.iceberg.engine.game; return g.tc.object?.name === 'Right Arm' && g.tc.mode === 'rotate'; });
ok('bone rotate gizmo', boneGizmo);
await p.evaluate(() => window.iceberg.engine.game.poseAt(0.5));
const mid = await p.evaluate(() => { const g = window.iceberg.engine.game; return g.boneRotation()[2]; });
ok('animation interpolates between keys', mid > 30 && mid < 120, `z at 0.5s = ${mid}`);
// imported rig: play embedded clip
await p.selectOption('#anim-rig', await p.evaluate(() => window.iceberg.engine.game.doc.instances.find(x => x.name === 'worm-rig').id));
await p.waitForTimeout(100);
await p.click('text=▶ Bend'); await p.waitForTimeout(500);
const bent = await p.evaluate(() => { const g = window.iceberg.engine.game; const e = g.world.entries.get(g.animator.rigId); return e.rig.bones.get('Tip').quaternion.z; });
ok('embedded .glb animation plays in Animator', Math.abs(bent) > 0.01, `Tip.qz=${bent.toFixed(3)}`);
await p.click('#animator-btn');
// autoplay the R6 animation in game
await selectByName('R6 Rig'); await p.waitForTimeout(100);
await p.selectOption('#prop-autoplay', { index: 1 });

// Workspace settings: mobile + starter gear + name
await p.click('[data-tab=explorer]'); await p.click('[data-node=workspace]');
await setField('#game-name', 'Studio Test World'); await setField('#mobile-toggle', true);
ok('workspace settings', await p.evaluate(() => { const d = window.iceberg.engine.game.doc; return d.name === 'Studio Test World' && d.mobile === true; }));

// Save + Publish
await p.click('#save-game'); await p.waitForTimeout(200);
const draft = await p.evaluate(() => JSON.parse(localStorage.getItem('iceberg:v1:studioDrafts') || '[]').some(d => d.name === 'Studio Test World'));
ok('save draft', draft);
await p.click('#publish-game'); await p.waitForTimeout(200);
ok('publish → in Games list', await p.evaluate(() => window.iceberg.backend.loadCustomGames().some(g => g.name === 'Studio Test World')));

// Export
const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#export-game')]);
const exportPath = '/tmp/studio-export.iceberg.json'; await dl.saveAs(exportPath);
const exported = JSON.parse((await import('fs')).readFileSync(exportPath, 'utf8'));
ok('export file', exported.format === 'iceberg-game' && exported.game.instances.length > 10 && exported.models.length === 2, `${exported.game.instances.length} instances, ${exported.models.length} models`);

// Test-play from studio, then back to editor
await p.click('#test-game'); await p.waitForTimeout(1500);
ok('test-play runs with avatar', await p.evaluate(() => window.iceberg.engine.game.runtime === true && !!window.iceberg.engine.game.scene.getObjectByName('avatar')));
await p.click('#back-to-editor').catch(() => {}); await p.waitForTimeout(1200);
const backEd = await ED();
ok('back to editor after test', backEd);

// Exit and play from the Games menu
await p.click('#exit-editor'); await p.waitForTimeout(400);
const names = await p.$$eval('#your-games .gc-name', e => e.map(x => x.textContent));
ok('published game listed in menu', names.includes('Studio Test World'), names.join(','));
await p.evaluate(() => { window.__forceTouch = true; });
const card = p.locator('.game-card', { hasText: 'Studio Test World' }).first();
console.log('menu html has', await p.evaluate(() => [...document.querySelectorAll('.game-card .gc-name')].map(e=>e.textContent)));
await card.locator('.play').first().click({ timeout: 5000 }); await p.waitForTimeout(2000);
const G = (fn) => p.evaluate(fn);
ok('play from menu', await G(() => window.iceberg.engine.game?.runtime === true));
ok('mobile controls shown (touch device)', await p.isVisible('.rt-touch .joy'));
const sp = await G(() => window.iceberg.engine.player.pos.toArray());
ok('spawn at SpawnLocation', Math.abs(sp[0]) < 0.5 && Math.abs(sp[2]) < 0.5 && sp[1] > 0.3, JSON.stringify(sp));
// spinner rotates
const r1 = await G(() => { const g = window.iceberg.engine.game; return [...g.world.entries.values()].find(e => e.inst.name === 'Cylinder').root.rotation.y; });
await p.waitForTimeout(800);
const r2 = await G(() => { const g = window.iceberg.engine.game; return [...g.world.entries.values()].find(e => e.inst.name === 'Cylinder').root.rotation.y; });
ok('plain-words spin script runs', r2 > r1, `${r1.toFixed(3)} -> ${r2.toFixed(3)}`);
// animation autoplay
const arm = await G(() => { const g = window.iceberg.engine.game; const e = [...g.world.entries.values()].find(e => e.inst.name === 'R6 Rig'); return e.rig.bones.get('Right Arm').rotation.z; });
ok('rig animation autoplays in game', Math.abs(arm) > 0.05, `arm z=${arm.toFixed(2)}`);
const tp = async (x, y, z) => { await G(`window.iceberg.engine.player.teleport(new (window.iceberg.engine.player.pos.constructor)(${x},${y},${z}))`); await p.waitForTimeout(700); };
// coin
const bb0 = await G(() => window.iceberg.economy.coins); await tp(3, 0, 4); const bb1 = await G(() => window.iceberg.economy.coins);
ok('coin pickup', bb1 === bb0 + 5, `${bb0} -> ${bb1}`);
// touch script on wedge (points)
await tp(6, 2.2, 4); await p.waitForFunction(() => /10 points/.test(document.querySelector('.rt-score')?.textContent || ''), null, { timeout: 4000 }).catch(() => {}); ok('touch script gives points', /10 points/.test(await p.textContent('.rt-score').catch(() => '')), await p.textContent('.rt-score').catch(() => ''));
// gear
await tp(0, 1.1, 15); const bp = await G(() => window.iceberg.engine.game.backpack.items);
ok('gear giver gives Speed Coil', bp.includes('speedCoil'), JSON.stringify(bp));
await p.keyboard.press('Digit1'); await p.waitForTimeout(100);
ok('equip gear (key 1) → speed boost', await G(() => window.iceberg.engine.player.mods.speed > 1));

// clicking a part with a "when clicked" script; button opens the door called Gate
const clickAt = (name) => G(`(() => { const e = window.iceberg.engine, g = e.game; const ent = [...g.world.entries.values()].find(x => x.inst.name === '${name}'); const v = ent.root.position.clone().project(e.camera); const r = e.renderer.domElement.getBoundingClientRect(); e._setMouse({ clientX: r.left + (v.x + 1) / 2 * r.width, clientY: r.top + (1 - v.y) / 2 * r.height }); g.onClick({ ray: e._ray(), button: 0 }); return [v.x, v.y, v.z]; })()`);
const sphColor = () => G(() => { const ent = [...window.iceberg.engine.game.world.entries.values()].find(x => x.inst.name === 'Sphere'); let c = null; ent.root.traverse(o => { if (!c && o.material?.color) c = o.material.color.getHexString(); }); return c; });
await tp(-6, 1, 10); await p.waitForTimeout(300);
const sc0 = await sphColor(); await clickAt('Sphere'); await p.waitForTimeout(700); const sc1 = await sphColor();
ok('runtime: "when clicked, turn green" works', sc0 !== sc1, `${sc0} -> ${sc1}`);
await tp(-20, 1, 8); await p.waitForTimeout(300);
const gateState = () => G(() => { const e = [...window.iceberg.engine.game.world.entries.values()].find(x => x.inst.name === 'Gate'); return { open: !!e.doorOpen, solid: e.solid !== false }; });
const gate0 = await gateState();
await clickAt('GateButton'); await p.waitForTimeout(1500);
const gate1 = await gateState();
ok('runtime: button click opens the door called Gate', !gate0.open && gate0.solid && gate1.open && !gate1.solid, `${JSON.stringify(gate0)} -> ${JSON.stringify(gate1)}`);
// riding a moving platform
const liftX = () => G(() => [...window.iceberg.engine.game.world.entries.values()].find(x => x.inst.name === 'Lift').root.position.x);
const lx0 = await liftX(); await tp(lx0, 1.6, -20); await p.waitForTimeout(300);
const ride = []; for (let i = 0; i < 18; i++) { ride.push(await G(() => { const g = window.iceberg.engine.game; const l = [...g.world.entries.values()].find(x => x.inst.name === 'Lift').root.position.x; const pl = window.iceberg.engine.player.pos; return [l, pl.x, pl.y]; })); await p.waitForTimeout(300); }
const offs = ride.map(r => r[1] - r[0]), lxs = ride.map(r => r[0]);
ok('player rides a moving platform', Math.max(...lxs) - Math.min(...lxs) > 0.3 && Math.max(...offs) - Math.min(...offs) < 0.35 && ride.every(r => r[2] > 0.9), `platform moved ${(Math.max(...lxs) - Math.min(...lxs)).toFixed(2)}, offset drift ${(Math.max(...offs) - Math.min(...offs)).toFixed(3)}`);
// riding a spinning platform (the Cylinder spins slowly at 0,0.5,40)
await tp(2, 1.4, 40); await p.waitForTimeout(400);
const q0 = await G(() => window.iceberg.engine.player.pos.toArray()); await p.waitForTimeout(1200);
const q1 = await G(() => window.iceberg.engine.player.pos.toArray());
const a0 = Math.atan2(q0[2] - 40, q0[0]), a1 = Math.atan2(q1[2] - 40, q1[0]);
ok('player rides a rotating platform', Math.abs(a1 - a0) > 0.05 && Math.abs(Math.hypot(q1[0], q1[2] - 40) - Math.hypot(q0[0], q0[2] - 40)) < 0.3 && q1[1] > 0.9, `angle ${a0.toFixed(2)} -> ${a1.toFixed(2)}, r ${Math.hypot(q1[0], q1[2] - 40).toFixed(2)}`);
// curved collision: standing on a lying (rotated) cylinder off-centre lands on the curve, not on its bounding box
await tp(20, 4, 21.2); await p.waitForTimeout(900);
const onLog = await G(() => window.iceberg.engine.player.pos.toArray());
await tp(20, 4, 20); await p.waitForTimeout(900);
const onLogTop = await G(() => window.iceberg.engine.player.pos.toArray());
ok('accurate collision on a rotated cylinder', onLogTop[1] > 1.9 && onLogTop[1] < 2.1 && onLog[1] > 1.3 && onLog[1] < 1.85, `top y=${onLogTop[1].toFixed(2)}, off-centre y=${onLog[1].toFixed(2)} (box would be 2.00)`);
// checkpoint then kill brick
await tp(0, 0.45, 20); const rp = await G(() => window.iceberg.engine.player.pos.toArray());
await tp(0, 1.05, 30); const afterKill = await G(() => window.iceberg.engine.player.pos.toArray());
ok('checkpoint + kill brick respawns at checkpoint', Math.abs(afterKill[2] - 20) < 1.5 && afterKill[1] < 2, `after kill ${JSON.stringify(afterKill.map(v => +v.toFixed(2)))}`);
// walking works with analog input (mobile hook)
const w0 = await G(() => window.iceberg.engine.player.pos.toArray());
await G(() => { window.iceberg.engine.input.analog = { x: 0, y: 1 }; }); await p.waitForTimeout(600); await G(() => { window.iceberg.engine.input.analog = null; });
const w1 = await G(() => window.iceberg.engine.player.pos.toArray());
ok('analog move input (mobile hook)', Math.hypot(w1[0] - w0[0], w1[2] - w0[2]) > 0.5, `${w0.map(v => v.toFixed(1))} -> ${w1.map(v => v.toFixed(1))}`);

// Import the exported file back in the studio
await G(() => window.iceberg.goHome()); await p.click('#create-btn'); await p.click('[data-template=obby]'); await p.waitForTimeout(1200);
const obbyN = await count();
await p.setInputFiles('#import-game', []).catch(() => {});
const imp = p.locator('#creator-panel input[type=file][accept=".json"]');
await imp.setInputFiles(exportPath); await p.waitForTimeout(1500);
ok('obby template loads', obbyN > 15, `${obbyN} instances`);
ok('import game file into studio', await p.evaluate(() => window.iceberg.engine.game?.doc?.name === 'Studio Test World' && window.iceberg.engine.game.doc.instances.length > 10));

} catch (e) { results.push(['FAIL', 'test aborted', e.message.split('\n')[0]]); }
console.log(results.map(r => r.join(' | ')).join('\n'));
console.log('console errors:', errs);
console.log(`${results.filter(r => r[0] === 'PASS').length}/${results.length} passed`);
await b.close();
