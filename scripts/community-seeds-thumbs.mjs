#!/usr/bin/env node
// Captures community-seeds/<slug>.png (960x540) and <slug>.thumb.jpg (320x180) straight from the game canvas
// (engine.snapshot, same as Studio's own thumbnail). Then run: node scripts/build-community-seeds.mjs to embed the JPEG.
// Needs a dev server (URL=http://localhost:5203/).
import { chromium } from 'playwright';
import fs from 'node:fs';
const URL = process.env.URL || 'http://localhost:5203/';
const b = await chromium.launch({ headless: true, executablePath: '/usr/bin/google-chrome', args: ['--ignore-gpu-blocklist', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const sim = (p, sec) => p.evaluate(async (sec) => { const r = window.iceberg.engine.game.runners[0]; const t0 = r.time; const s = performance.now(); while (r.time - t0 < sec && performance.now() - s < 90000) await new Promise(x => setTimeout(x, 40)); }, sec);
const goTo = (p, name, dy = 0.6) => p.evaluate(([name, dy]) => { const pl = window.iceberg.engine.player, g = window.iceberg.engine.game; const e = g.entries.find(x => x.inst.name === name); const bb = e.convex.aabb; pl.teleport(pl.pos.clone().set((bb.minX + bb.maxX) / 2, bb.maxY + dy, (bb.minZ + bb.maxZ) / 2), pl.facing); }, [name, dy]);
const view = (p, v) => p.evaluate((v) => { const pl = window.iceberg.engine.player; if (v.pos) pl.teleport(pl.pos.clone().set(...v.pos), v.facing ?? 0); pl.camYaw = v.yaw ?? Math.PI; pl.camPitch = v.pitch ?? 0.4; pl.maxCamDist = Math.max(16, v.dist ?? 9); pl.camDist = v.dist ?? 9; }, v);
async function capture(slug, prep) {
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } }); p.setDefaultTimeout(90000);
  await p.goto(URL); await p.waitForTimeout(1200);
  const doc = JSON.parse(fs.readFileSync(`community-seeds/${slug}.json`, 'utf8'));
  await p.evaluate(async (doc) => { const { customGameDef } = await import('/src/games/customGame.js'); document.getElementById('start-btn')?.click(); await new Promise(r => setTimeout(r, 500)); window.iceberg.menu.hide(); await window.iceberg.engine.loadGame(customGameDef(doc)); const r = window.iceberg.engine.renderer; r.shadowMap.enabled = false; r.setPixelRatio(0.5); }, doc);
  await p.waitForTimeout(1500); await prep(p);
  await p.evaluate(() => { const r = window.iceberg.engine.renderer; r.shadowMap.enabled = true; r.setPixelRatio(1); window.iceberg.engine.game.scene.traverse(o => { if (o.material) [].concat(o.material).forEach(m => { m.needsUpdate = true; }); }); });
  await p.waitForTimeout(2500);
  const out = await p.evaluate(() => ({ big: window.iceberg.engine.snapshot(960, 540), small: window.iceberg.engine.snapshot(320, 180) }));
  fs.writeFileSync(`community-seeds/${slug}.png`, Buffer.from(out.big.split(',')[1], 'base64')); // NB: JPEG bytes; converted to real PNG below
  fs.writeFileSync(`community-seeds/${slug}.thumb.jpg`, Buffer.from(out.small.split(',')[1], 'base64'));
  console.log(slug, 'big', out.big.slice(0, 22), out.big.length, 'small', out.small.slice(0, 23), out.small.length);
  await p.close();
}
await capture('suds-and-duds-laundromat', async (p) => {
  for (const pad of ['Pad Detergent', 'Pad Cart', 'Pad Washer 1', 'Pad Washer 2', 'Pad Dryer 1', 'Pad Washer 3', 'Pad Dryer 2']) { await p.evaluate(() => window.iceberg.engine.game.api.setVar('cash', 1e6)); await goTo(p, pad); await sim(p, 1.3); }
  await view(p, { pos: [-2, 0.6, 1], yaw: Math.PI, pitch: 0.5, dist: 17, facing: 0 }); await sim(p, 0.3);
});
await capture('midnight-at-maple-mall', async (p) => { await view(p, { pos: [0, 0.6, -27], yaw: Math.PI, pitch: 0.3, dist: 15, facing: 0 }); await sim(p, 0.5); });
await b.close();
import { execFileSync } from 'node:child_process';
for (const sl of ['suds-and-duds-laundromat', 'midnight-at-maple-mall']) execFileSync('python3', ['-c', `from PIL import Image; Image.open('community-seeds/${sl}.png').convert('RGB').save('community-seeds/${sl}.png','PNG')`]);
