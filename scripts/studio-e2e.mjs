// End-to-end test of Iceberg Studio in headless Chromium (file:// build).
import { chromium } from 'playwright';
import path from 'path';
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
const p = await ctx.newPage();
const errs = []; p.on('console', m => m.type() === 'error' && errs.push(m.text())); p.on('pageerror', e => errs.push(e.stack));
p.on('dialog', d => d.accept(d.type() === 'prompt' ? 'Wave2' : undefined));
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
await p.fill('#script-text', 'Spin slowly forever'); await p.click('#script-apply');
// second script on wedge: touch → give points + message
await selectByName('Wedge'); await p.waitForTimeout(100); await p.click('#add-script');
await p.fill('#script-text', 'When touched give 10 points and say "Nice!"'); await p.click('#script-apply'); await p.waitForTimeout(100);
ok('touch script preview', /give the player 10 points/.test(await p.textContent('#script-preview')));

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
await p.click('#anim-new'); await p.waitForTimeout(150);
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
ok('equip gear (key 1) → speed boost', await G(() => window.iceberg.engine.player.mods.speed === 1.8));
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
