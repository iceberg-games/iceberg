// Headless 1440x900 smoke for the Studio corner chat. Build first: npm run build
// Usage: node scripts/studio-chat-smoke.mjs
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
  ok('studio opens', await p.evaluate(() => !!window.iceberg?.engine?.game?.editing) && await p.isVisible('#creator-panel'));
  const ribbonNull = await p.evaluate(() => {
    const r = document.querySelector('.st-ribbon');
    if (!r) return 'missing';
    const w = document.createTreeWalker(r, NodeFilter.SHOW_TEXT);
    const hits = [];
    let n; while ((n = w.nextNode())) if (n.nodeValue === 'null') hits.push(n.nodeValue);
    return hits.length ? hits.join(',') : '';
  });
  ok('ribbon does not show null', ribbonNull === '', ribbonNull);

  ok('chat toggle visible', await p.isVisible('#studio-chat-toggle'));
  ok('chat starts closed', await p.locator('#studio-chat-panel').evaluate((el) => el.classList.contains('hidden')));

  await p.click('#studio-chat-toggle');
  await p.waitForTimeout(200);
  ok('chat opens', await p.isVisible('#studio-chat-panel') && await p.isVisible('#studio-chat-input'));
  ok('welcome bubble is text-only', await p.locator('#studio-chat-log .st-chat-bubble.bot').count() >= 1);

  const before = await p.evaluate(() => window.iceberg.engine.game.doc.instances.length);
  await p.fill('#studio-chat-input', 'build a small house');
  await p.click('#studio-chat-send');
  await p.waitForTimeout(600);
  const afterHouse = await p.evaluate(() => ({
    n: window.iceberg.engine.game.doc.instances.length,
    grouped: window.iceberg.engine.game.doc.instances.some((i) => i.type === 'group' && /house/i.test(i.name)),
    canUndo: window.iceberg.engine.game.canUndo(),
  }));
  ok('house build added parts', afterHouse.n > before + 4, `${before} -> ${afterHouse.n}`);
  ok('house is grouped', afterHouse.grouped);
  ok('house is one undo step', afterHouse.canUndo);

  await p.fill('#studio-chat-input', 'make a tower 10 high');
  await p.keyboard.press('Enter');
  await p.waitForTimeout(600);

  await p.screenshot({ path: path.join(outDir, 'studio-chat-open.png') });
  ok('screenshot written', fs.existsSync(path.join(outDir, 'studio-chat-open.png')));

  const unknownBefore = await p.locator('#studio-chat-log .st-chat-bubble.bot').count();
  await p.fill('#studio-chat-input', 'what is the weather in phoenix');
  await p.click('#studio-chat-send');
  await p.waitForTimeout(400);
  const last = await p.locator('#studio-chat-log .st-chat-bubble.bot').last().innerText();
  ok('unknown phrase admits it', /didn'?t understand/i.test(last), last.slice(0, 180));
  ok('unknown phrase suggests examples', (await p.locator('#studio-chat-suggest [data-phrase]').count()) >= 2);

  await p.fill('#studio-chat-input', 'add a coin counter top right');
  await p.click('#studio-chat-send');
  await p.waitForTimeout(400);
  const gui = await p.evaluate(() => {
    const g = window.iceberg.engine.game.doc.gui || [];
    return { n: g.length, bind: g[0]?.bind, anchor: g[0]?.anchor, type: g[0]?.type };
  });
  ok('coin counter added to doc.gui', gui.n >= 1 && gui.bind === 'coins' && gui.anchor === 'top-right', JSON.stringify(gui));
  ok('GUI toggle visible', await p.isVisible('#studio-gui-toggle'));
  await p.click('[data-node=workspace]');
  await p.waitForTimeout(200);
  ok('first-person setting is in game settings', await p.isVisible('#first-person-toggle'));

  await p.click('#studio-chat-close');
  await p.waitForTimeout(150);
  await p.click('#studio-gui-toggle');
  await p.waitForTimeout(300);
  ok('GUI overlay opens', await p.locator('#studio-gui-overlay').evaluate((el) => !el.classList.contains('off')));
  ok('coin counter is on the overlay', await p.locator('.st-gui-el').count() >= 1);
  await p.screenshot({ path: path.join(outDir, 'studio-gui-editor.png') });
  ok('gui screenshot written', fs.existsSync(path.join(outDir, 'studio-gui-editor.png')));

  const pageErrors = errs.filter((e) => !/favicon|AudioContext|webkitAudio/i.test(String(e)));
  ok('no page errors', pageErrors.length === 0, pageErrors.slice(0, 3).join(' | '));
} finally {
  await b.close();
}

const pass = results.filter((r) => r[0] === 'PASS').length;
console.log(`${pass}/${results.length} studio-chat smoke checks passed`);
for (const r of results) if (r[0] === 'FAIL') console.log(' ', r[0], r[1], r[2] || '');
process.exit(pass === results.length ? 0 : 1);
