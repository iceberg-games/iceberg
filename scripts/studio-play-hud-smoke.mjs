// Headless Test-play click-through: HUD stays fixed, button grants coins,
// first-person toggle works. Usage: npm run build && node scripts/studio-play-hud-smoke.mjs
import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';

const outDir = path.resolve('designs/editor-ai-chat');
fs.mkdirSync(outDir, { recursive: true });

const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
const p = await ctx.newPage();
const errs = [];
p.on('pageerror', (e) => errs.push(e.stack || e.message));
p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
const results = [];
const ok = (name, cond, info = '') => { results.push([cond ? 'PASS' : 'FAIL', name, info]); if (!cond) console.log('FAIL:', name, info); };

try {
  await p.goto('file://' + path.resolve('dist/index.html'));
  await p.click('#start-btn');
  await p.waitForSelector('.game-card');
  await p.click('#create-btn');
  await p.click('[data-template=blank]');
  await p.waitForTimeout(1200);
  ok('studio opens', await p.evaluate(() => !!window.iceberg?.engine?.game?.editing));

  const setup = await p.evaluate(() => {
    const ed = window.iceberg.engine.game;
    ed.addGui({ type: 'label', bind: 'coins', text: 'Coins', anchor: 'top-right', name: 'Coin counter' });
    const coinBtn = ed.addGui({ type: 'button', text: 'Get coins', anchor: 'bottom', name: 'Get coins' });
    const fpBtn = ed.addGui({ type: 'button', text: 'First person', anchor: 'bottom-left', name: 'First person' });
    const byId = (id) => (ed.doc.gui || []).find((g) => g.id === id);
    const c = byId(coinBtn.id);
    c.scriptText = 'When clicked, give 10 coins';
    c.program = { continuous: [], rules: [{ trigger: { type: 'click' }, once: false, actions: [{ do: 'addVar', name: 'coins', amount: 10 }] }] };
    const f = byId(fpBtn.id);
    f.scriptText = 'When clicked, toggle first person';
    f.program = { continuous: [], rules: [{ trigger: { type: 'click' }, once: false, actions: [{ do: 'firstPerson', on: 'toggle' }] }] };
    f.x = 16; f.y = 16;
    ed.doc.firstPerson = false;
    return { gui: (ed.doc.gui || []).map((g) => g.type + ':' + g.text).join(',') };
  });
  ok('play fixtures added', /Coins/.test(setup.gui) && /Get coins/.test(setup.gui) && /First person/.test(setup.gui), setup.gui);

  await p.click('#test-game');
  await p.waitForTimeout(1800);
  ok('test-play is running', await p.evaluate(() => window.iceberg.engine.game?.runtime === true));
  ok('HUD root is on screen', await p.locator('.rt-gui').count() > 0);
  const hudCount = await p.locator('.rt-gui-el').count();
  ok('HUD has the three elements', hudCount >= 3, String(hudCount));

  const boxBefore = await p.locator('.rt-gui-el.rt-gui-label').first().boundingBox();
  ok('coin counter is visible', !!boxBefore && boxBefore.y < 200 && boxBefore.x > 1000, JSON.stringify(boxBefore));

  // orbit the camera; HUD must stay in the same screen place
  await p.mouse.move(720, 420);
  await p.mouse.down({ button: 'right' });
  await p.mouse.move(820, 500);
  await p.mouse.up();
  await p.waitForTimeout(200);
  const boxAfter = await p.locator('.rt-gui-el.rt-gui-label').first().boundingBox();
  const dx = Math.abs((boxAfter?.x || 0) - (boxBefore?.x || 0));
  const dy = Math.abs((boxAfter?.y || 0) - (boxBefore?.y || 0));
  ok('HUD stays fixed when the camera moves', dx < 2 && dy < 2, `dx=${dx.toFixed(2)} dy=${dy.toFixed(2)}`);

  const coins0 = await p.evaluate(() => window.iceberg.engine.game.vars.coins);
  ok('coins start at 0', coins0 === 0, String(coins0));
  await p.locator('.rt-gui-button', { hasText: 'Get coins' }).click();
  await p.waitForTimeout(200);
  const coins1 = await p.evaluate(() => window.iceberg.engine.game.vars.coins);
  ok('Get coins button awards 10 coins', coins1 === 10, String(coins1));
  const counterText = await p.locator('.rt-gui-el.rt-gui-label').first().innerText();
  ok('coin counter updates', /10/.test(counterText), counterText);

  const fp0 = await p.evaluate(() => !!window.iceberg.engine.player.firstPerson);
  ok('starts in third person', fp0 === false);
  await p.locator('.rt-gui-button', { hasText: 'First person' }).click();
  await p.waitForFunction(() => window.iceberg.engine.player.firstPerson === true, null, { timeout: 2000 }).catch(() => {});
  const fp1 = await p.evaluate(() => ({
    on: !!window.iceberg.engine.player.firstPerson,
    hidden: window.iceberg.engine.player.avatar?.root?.visible === false,
  }));
  ok('first-person button turns FP on', fp1.on === true, JSON.stringify(fp1));
  ok('avatar is hidden in first person', fp1.hidden === true, JSON.stringify(fp1));
  await p.locator('.rt-gui-button', { hasText: 'First person' }).click();
  await p.waitForFunction(() => window.iceberg.engine.player.firstPerson === false, null, { timeout: 2000 }).catch(() => {});
  const fp2 = await p.evaluate(() => !!window.iceberg.engine.player.firstPerson);
  ok('first-person button toggles back off', fp2 === false, String(fp2));

  await p.screenshot({ path: path.join(outDir, 'studio-play-hud.png') });
  ok('play screenshot written', fs.existsSync(path.join(outDir, 'studio-play-hud.png')));

  const pageErrors = errs.filter((e) => !/favicon|AudioContext|webkitAudio/i.test(String(e)));
  ok('no page errors', pageErrors.length === 0, pageErrors.slice(0, 3).join(' | '));
} finally {
  await b.close();
}

const pass = results.filter((r) => r[0] === 'PASS').length;
console.log(`${pass}/${results.length} studio play-HUD smoke checks passed`);
for (const r of results) if (r[0] === 'FAIL') console.log(' ', r[0], r[1], r[2] || '');
process.exit(pass === results.length ? 0 : 1);
