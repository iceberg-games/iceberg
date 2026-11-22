// Prod-build smoke for the live chat: Colin's exact phrases must BUILD something, never refuse.
// Usage: npm run build && npx vite preview --port 4173 &  node scripts/studio-chat-live-smoke.mjs [baseUrl] [--headed]
import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';

const base = process.argv.find((a) => /^https?:/.test(a)) || 'http://localhost:4173/';
const headed = process.argv.includes('--headed');
const outDir = path.resolve('designs/ai-chat-live');
fs.mkdirSync(outDir, { recursive: true });
const results = [];
const ok = (name, cond, info = '') => { results.push([cond ? 'PASS' : 'FAIL', name, info]); if (!cond) console.log('FAIL:', name, info); };

const b = await chromium.launch({ headless: !headed, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });

async function open(tpl = 'blank') {
  const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  p.errs = [];
  p.on('pageerror', (e) => p.errs.push(e.stack || e.message));
  p.on('console', (m) => { if (m.type() === 'error') p.errs.push(m.text()); });
  await p.goto(base); await p.waitForTimeout(1200);
  await p.click('#start-btn'); await p.waitForSelector('.game-card');
  await p.click('#create-btn'); await p.click(`[data-template=${tpl}]`); await p.waitForTimeout(1500);
  await p.click('#studio-chat-toggle'); await p.waitForTimeout(200);
  return p;
}
const count = (p) => p.evaluate(() => window.iceberg.engine.game.doc.instances.length);
async function say(p, text) {
  const n0 = await count(p);
  await p.fill('#studio-chat-input', text); await p.click('#studio-chat-send'); await p.waitForTimeout(450);
  const reply = (await p.locator('#studio-chat-log .st-chat-bubble.bot').last().innerText()).replace(/\s+/g, ' ');
  return { n0, n1: await count(p), reply };
}

try {
  const p = await open('blank');
  const phrases = ['make me a town', 'make me a house', 'build me a house', 'can you make a town', 'make a city', 'make me a little village', 'i want a house', 'please make me some trees', 'make me a spaceship'];
  for (const ph of phrases) {
    const r = await say(p, ph);
    ok(`"${ph}" builds something`, r.n1 > r.n0, `${r.n0}->${r.n1} | ${r.reply.slice(0, 90)}`);
    ok(`"${ph}" is friendly (no refusal)`, !/can'?t|cannot|didn'?t understand/i.test(r.reply), r.reply.slice(0, 90));
  }
  ok('no page errors (builds)', p.errs.filter((e) => !/AudioContext|favicon/i.test(e)).length === 0, p.errs.slice(0, 2).join(' | '));

  // the new build must be in view: its group centre projects inside the viewport
  const house = await open('island');
  await say(house, 'make me a house');
  const vis = await house.evaluate(() => {
    const g = window.iceberg.engine.game; const grp = g.doc.instances.find((i) => i.type === 'group' && /House/.test(i.name));
    const cam = window.iceberg.engine.camera; if (!grp || !cam) return { ok: false };
    const v = cam.position.clone ? cam.position.clone() : null; if (!v) return { ok: false };
    v.set(grp.pos[0], grp.pos[1], grp.pos[2]).project(cam);
    return { ok: v.x > -1 && v.x < 1 && v.y > -1 && v.y < 1 && v.z < 1, x: v.x, y: v.y };
  });
  ok('house on the island template is in view after building', vis.ok, JSON.stringify(vis));
  await house.screenshot({ path: path.join(outDir, 'house-built.png') });

  const town = await open('blank');
  await say(town, 'make me a town');
  await town.waitForTimeout(600);
  await town.screenshot({ path: path.join(outDir, 'town-built.png') });
  ok('screenshots written', fs.existsSync(path.join(outDir, 'town-built.png')) && fs.existsSync(path.join(outDir, 'house-built.png')));
  ok('no page errors (town)', town.errs.filter((e) => !/AudioContext|favicon/i.test(e)).length === 0, town.errs.slice(0, 2).join(' | '));
} finally {
  await b.close();
}
const pass = results.filter((r) => r[0] === 'PASS').length;
console.log(`${pass}/${results.length} studio chat live smoke checks passed (${base})`);
process.exit(pass === results.length ? 0 : 1);
