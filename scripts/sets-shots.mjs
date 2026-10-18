#!/usr/bin/env node
// Headless stills of every shot preset of a filming set (frame-exact via window.sets.seek).
//   npm run build:sets && node scripts/sets-shots.mjs [--set winterhaven] [--out sets/winterhaven/shots] [--w 1280 --h 720] [--at 0.15,0.5,0.95] [--extra]
import { chromium } from 'playwright';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { mkdir } from 'node:fs/promises';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const SET = arg('--set', 'winterhaven'), W = +arg('--w', 1280), H = +arg('--h', 720);
const OUT = resolve(ROOT, arg('--out', `sets/${SET}/shots`));
const AT = arg('--at', '0.1,0.55,1').split(',').map(Number);
const ONLY = arg('--only', '');
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: W, height: H } });
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log('[page]', m.text()); });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
const url = pathToFileURL(resolve(ROOT, 'dist-sets/sets/index.html')).href + `?set=${SET}&clean=1&fixed=1&w=${W}&h=${H}`;
await page.goto(url);
await page.waitForFunction(() => window.sets?.ready, null, { timeout: 120000 });
const shots = await page.evaluate(() => window.sets.shots.map(s => ({ id: s.id, duration: s.duration })));
import { writeFile } from 'node:fs/promises';
const snap = async (name) => {
  const t0 = Date.now();
  const data = await page.evaluate(() => window.sets.renderer.domElement.toDataURL('image/png'));
  await writeFile(`${OUT}/${name}.png`, Buffer.from(data.split(',')[1], 'base64'));
  console.log(name, `${Date.now() - t0}ms`);
};
for (const [i, s] of shots.entries()) {
  if (ONLY && !ONLY.split(',').includes(String(i + 1))) continue;
  for (const u of AT) {
    await page.evaluate(([n, t]) => { window.sets.seek(n, t, 1 / 30); window.sets.step(1 / 30); }, [i + 1, u * s.duration]);
    await snap(`${i + 1}-${s.id}-${Math.round(u * 100)}`);
  }
}
if (process.argv.includes('--extra')) {
  // day, blizzard variants of the street + castle shots
  if (!process.argv.includes('--no-day')) {
  await page.evaluate(() => { window.sets.night(0); window.sets.seek(2, 7, 1 / 30); });
  await snap('x-day-street');
  await page.evaluate(() => { window.sets.seek(1, 12, 1 / 30); });
  await snap('x-day-flyover');
  }
  await page.evaluate(() => { window.sets.night(1); window.sets.weather(1); for (let i = 0; i < 10; i++) window.sets.step(1 / 30); window.sets.seek(2, 9, 1 / 30); });
  await snap('x-blizzard-street');
  await page.evaluate(() => { window.sets.weather(0.8); window.sets.seek(5, 10, 1 / 30); });
  await snap('x-heavy-castle');
}
await browser.close();
