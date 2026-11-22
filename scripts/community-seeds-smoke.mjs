#!/usr/bin/env node
// Smoke test + screenshots for the community seeds, through the real Studio code path:
//   seed JSON -> drafts.save (store.js) -> Studio editor (CREATOR) -> "▶ Test" -> runtime play mode
// then plays the core loop (earn + buy / collect + reach) and takes screenshots.
// Needs a dev server:  npx vite --host --port 5203     (URL=http://localhost:5203/ GAME=suds|mall|both)
// No network/DB writes: everything stays in the headless browser's localStorage.
import { chromium } from 'playwright';
import fs from 'node:fs';
const URL = process.env.URL || 'http://localhost:5203/';
const which = process.env.GAME || 'both';
const OUT = process.env.OUT || 'community-seeds/screenshots';
fs.mkdirSync(OUT, { recursive: true });
const results = []; const ok = (name, cond, info = '') => { results.push([cond ? 'PASS' : 'FAIL', name, info]); console.log(cond ? 'PASS' : 'FAIL', name, info); };
const errs = [];

async function open(browser, slug, { mobile = false } = {}) {
  const ctx = await browser.newContext(mobile ? { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true } : { viewport: { width: 1280, height: 720 } });
  if (mobile) await ctx.addInitScript(() => { try { localStorage.setItem('iceberg.deviceMode', 'mobile'); } catch {} window.__forceTouch = true; });
  const p = await ctx.newPage(); p.setDefaultTimeout(60000);
  p.on('console', (m) => m.type() === 'error' && errs.push(`[${slug}] ${m.text()}`)); p.on('pageerror', (e) => errs.push(`[${slug}] PAGEERR ${e.message}`));
  await p.goto(URL); await p.waitForTimeout(1200);
  const doc = JSON.parse(fs.readFileSync(`community-seeds/${slug}.json`, 'utf8'));
  await p.evaluate(async (doc) => {
    document.getElementById('start-btn')?.click();
    const { drafts } = await import('/src/studio/store.js'); await drafts.save({ ...doc, updatedAt: Date.now() });
    window.__toasts = []; const { bus } = await import('/src/core/events.js'); bus.on('toast', (t) => window.__toasts.push(t.text));
  }, doc);
  return { p, doc, ctx };
}
// The headless software renderer runs the game at a fraction of real time (dt is capped per frame),
// so waits that matter are in GAME seconds (script-runner clock), and heavy rendering is switched off between screenshots.
const sim = (p, sec) => p.evaluate(async (sec) => { const r = window.iceberg.engine.game.runners[0]; const t0 = r.time; const s = performance.now(); while (r.time - t0 < sec && performance.now() - s < 90000) await new Promise(x => setTimeout(x, 40)); }, sec);
const fast = (p, on) => p.evaluate((on) => { const r = window.iceberg.engine.renderer; r.shadowMap.enabled = !on; r.setPixelRatio(on ? 0.5 : 1); window.iceberg.engine.game.scene.traverse(o => { if (o.material) [].concat(o.material).forEach(m => { m.needsUpdate = true; }); }); }, on);
const shot = async (p, path, settle = 1200) => { await fast(p, false); await p.waitForTimeout(settle); await p.screenshot({ path }); await fast(p, true); };
const dismissHelp = (p) => p.evaluate(() => { for (const b of document.querySelectorAll('button')) if (/^got it/i.test(b.textContent.trim())) b.click(); });
const G = 'window.iceberg.engine.game';
const vars = (p) => p.evaluate(`({ ...${G}.vars })`);
const toasts = (p) => p.evaluate('window.__toasts.slice(-8)');
async function studioThenPlay(p, doc, slug, mobile = false) {
  // 1) Studio editor with the project
  await p.evaluate(async (id) => { const { drafts } = await import('/src/studio/store.js'); await window.iceberg.edit(drafts.get(id)); }, doc.id);
  await p.waitForTimeout(2500);
  const ed = await p.evaluate(`({ editing: !!${G}.editing, n: ${G}.doc.instances.length, name: ${G}.doc.name })`);
  ok(`${slug}: opens in Studio editor`, ed.editing && ed.n === doc.instances.length, JSON.stringify(ed));
  if (!mobile) { await p.evaluate(() => { const g = window.iceberg.engine.game; g.select?.(g.doc.instances.find(i => i.name === 'Sorting Table' || i.name === 'Directory Kiosk')?.id); g.focus?.(); }); await p.waitForTimeout(800); await p.screenshot({ path: `${OUT}/${slug}-1-studio-editor.png` }); }
  // 2) Test = play mode
  await p.click('#test-game'); await p.waitForTimeout(3000); await dismissHelp(p); await fast(p, true); await p.waitForTimeout(500);
  const rt = await p.evaluate(`({ runtime: !!${G}.runtime, runners: ${G}.runners.length, entries: ${G}.entries.length })`);
  ok(`${slug}: ▶ Test enters play mode`, rt.runtime && rt.runners > 0, JSON.stringify(rt));
}
const proj = (p, name) => p.evaluate((name) => { const g = window.iceberg.engine.game, cam = window.iceberg.engine.camera; const e = g.entries.find(x => x.inst.name === name); const v = e.root.position.clone(); v.y += (e.convex.aabb.maxY - e.convex.aabb.minY) * 0.5; v.project(cam); return [(v.x + 1) / 2 * innerWidth, (1 - v.y) / 2 * innerHeight]; }, name);
const goTo = (p, name, dy = 0.6) => p.evaluate(([name, dy]) => { const pl = window.iceberg.engine.player, g = window.iceberg.engine.game; const e = g.entries.find(x => x.inst.name === name); const b = e.convex.aabb; pl.teleport(pl.pos.clone().set((b.minX + b.maxX) / 2, b.maxY + dy, (b.minZ + b.maxZ) / 2), pl.facing); }, [name, dy]);
const setVar = (p, k, v) => p.evaluate(([k, v]) => window.iceberg.engine.game.api.setVar(k, v), [k, v]);
const visible = (p, name) => p.evaluate((name) => window.iceberg.engine.game.entries.find(x => x.inst.name === name)?.visible, name);
const view = (p, v) => p.evaluate((v) => { const pl = window.iceberg.engine.player; if (v.pos) pl.teleport(pl.pos.clone().set(...v.pos), v.facing ?? 0); pl.camYaw = v.yaw ?? Math.PI; pl.camPitch = v.pitch ?? 0.4; pl.maxCamDist = Math.max(16, v.dist ?? 9); pl.camDist = v.dist ?? 9; }, v);

// ---------------------------------------------------------------- Suds & Duds
async function suds(browser) {
  const slug = 'suds-and-duds-laundromat';
  const { p, doc } = await open(browser, slug);
  await studioThenPlay(p, doc, slug);
  await p.waitForTimeout(1500);
  await view(p, { yaw: Math.PI, pitch: 0.42, dist: 13 }); await p.waitForTimeout(800);
  await shot(p, `${OUT}/${slug}-2-play-start.png`);
  ok(`${slug}: machines + later pads start hidden`, !(await visible(p, 'Washer 1 Body')) && !(await visible(p, 'Pad Washer 2')) && (await visible(p, 'Pad Washer 1')));
  // core loop: real mouse clicks on the Sorting Table earn cash
  await view(p, { yaw: Math.PI, pitch: 0.5, dist: 12 }); await p.waitForTimeout(600);
  const [x, y] = await proj(p, 'Sorting Table');
  const c0 = (await vars(p)).cash || 0;
  for (let i = 0; i < 24; i++) { await p.mouse.move(x, y); await p.mouse.click(x, y); await p.waitForTimeout(40); }
  const v1 = await vars(p);
  ok(`${slug}: clicking the Sorting Table earns cash`, (v1.cash || 0) - c0 >= 20, JSON.stringify(v1));
  await shot(p, `${OUT}/${slug}-3-clicking-cash.png`);
  // buy Detergent ($30): skill 1 -> clicks worth $3
  await setVar(p, 'cash', 30);
  await goTo(p, 'Pad Detergent'); await sim(p, 1.5);
  const v2 = await vars(p);
  ok(`${slug}: buy upgrade (Better Detergent $30)`, v2.skill === 1 && v2.cash < 5 && !(await visible(p, 'Pad Detergent')) && (await visible(p, 'Pad Cart')), JSON.stringify(v2));
  await view(p, { pos: [0, 0.6, -2], yaw: Math.PI, pitch: 0.4, dist: 13, facing: 0 }); await p.waitForTimeout(700);
  const [x2, y2] = await proj(p, 'Sorting Table'); const c1 = (await vars(p)).cash || 0;
  await p.mouse.click(x2, y2); await sim(p, 0.2);
  ok(`${slug}: click now worth $3 after the upgrade`, ((await vars(p)).cash || 0) - c1 === 3, `${c1} -> ${(await vars(p)).cash}`);
  // buy first washer + passive income
  await setVar(p, 'cash', 20); await goTo(p, 'Pad Washer 1'); await sim(p, 1.5);
  const v3 = await vars(p); ok(`${slug}: buy Washer #1 ($20): level 1, machine appears`, v3.level === 1 && await visible(p, 'Washer 1 Body') && !(await visible(p, 'Plot Washer 1')), JSON.stringify(v3));
  const cash3 = v3.cash || 0; await sim(p, 4.6);
  ok(`${slug}: passive income ticks (every 2 s)`, ((await vars(p)).cash || 0) > cash3, `${cash3} -> ${(await vars(p)).cash}`);
  await view(p, { pos: [-15, 0.6, -6], yaw: Math.PI, pitch: 0.35, dist: 12, facing: 0 }); await p.waitForTimeout(900);
  await shot(p, `${OUT}/${slug}-4-first-washer.png`);
  // fast-forward through the whole chain with generous cash (proves every pad + the wing + the finale)
  const chain = ['Pad Washer 2', 'Pad Dryer 1', 'Pad Washer 3', 'Pad Dryer 2', 'Pad Vending', 'Pad Expand', 'Pad Press', 'Pad Robot', 'Pad Arcade', 'Pad Coffee'];
  const skills = ['Pad Cart', 'Pad Helper', 'Pad Cards'];
  const buyUntil = async (pad, check) => { for (let k = 0; k < 4; k++) { await setVar(p, 'cash', 1e6); await goTo(p, pad); await sim(p, 1.2); if (check(await vars(p))) return true; } return false; };
  let sk = 1; for (const pad of skills) { sk++; await buyUntil(pad, (v) => v.skill >= sk); }
  for (const pad of chain) {
    await setVar(p, 'cash', 1e6); await goTo(p, pad); await sim(p, 1.3);
    if (pad === 'Pad Dryer 2') { await view(p, { yaw: Math.PI, pitch: 0.35, dist: 15 }); await p.waitForTimeout(500); await shot(p, `${OUT}/${slug}-5-store-full.png`); }
    if (pad === 'Pad Expand') { await p.waitForTimeout(600); await view(p, { yaw: Math.PI, pitch: 0.55, dist: 18 }); await p.waitForTimeout(500); await shot(p, `${OUT}/${slug}-6-wall-down.png`); }
  }
  const v4 = await vars(p);
  ok(`${slug}: full machine chain bought (level 11), skills maxed (4), wing open`, v4.level === 11 && v4.skill === 4 && !(await visible(p, 'Partition A')) && await visible(p, 'Coffee Bar Bar Top'), JSON.stringify(v4));
  await view(p, { pos: [30, 0.6, -2], yaw: Math.PI, pitch: 0.4, dist: 15 }); await p.waitForTimeout(900);
  await shot(p, `${OUT}/${slug}-7-dry-cleaning-wing.png`);
  await setVar(p, 'cash', 100000); await goTo(p, 'Pad Grand'); await sim(p, 2.5);
  await view(p, { pos: [0, 0.6, -6], yaw: 0, pitch: 0.22, dist: 24, facing: 0 }); await p.waitForTimeout(1500);
  await shot(p, `${OUT}/${slug}-8-grand-reopening-win.png`);
  const t = await toasts(p);
  ok(`${slug}: Grand Reopening finale triggers the win message`, t.some(x => /GRAND REOPENING/.test(x)) && (await vars(p)).level === 12, JSON.stringify(t.slice(-3)));
  await setVar(p, 'points', 260000); await sim(p, 0.5);
  ok(`${slug}: milestones fire when points pass the thresholds`, (await p.evaluate('window.__toasts')).some(x => /250,000 earned/.test(x)), '');
  await p.context().close();
}

// ---------------------------------------------------------------- mall
async function mall(browser) { const m = await import('./community-seeds/mall-smoke.mjs'); await m.run({ browser, open, studioThenPlay, helpers: { proj, goTo, setVar, visible, view, vars, toasts, G, OUT, ok, errs } }); }

const browser = await chromium.launch({ headless: !process.env.DISPLAY || process.env.HEADLESS === '1', executablePath: process.env.CHROME || '/usr/bin/google-chrome', args: ['--ignore-gpu-blocklist', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  if (which === 'suds' || which === 'both') await suds(browser);
  if (which === 'mall' || which === 'both') await mall(browser);
} catch (e) { ok('smoke run completed', false, e.stack || String(e)); }
await browser.close();
console.log('\nconsole/page errors:', errs.length); errs.slice(0, 20).forEach(e => console.log('  ', e));
const fails = results.filter(r => r[0] === 'FAIL');
fs.writeFileSync(`${OUT}/smoke-results.txt`, results.map(r => r.join('  ')).join('\n') + `\n\nconsole/page errors: ${errs.length}\n${errs.join('\n')}\n`);
console.log(`\n${results.length - fails.length}/${results.length} checks passed`);
process.exit(fails.length ? 1 : 0);
