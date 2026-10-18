#!/usr/bin/env node
// Pixel diff of the portal between two built sites (event inactive = storm theme off), e.g. before/after a theme change:
//   node scripts/theme-diff.mjs <baseSiteDir> <newSiteDir>
// Random/animated parts are frozen or masked: reduced motion, game-card thumbnails + featured banner art masked.
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
const [baseDir, newDir] = process.argv.slice(2);
if (!baseDir || !newDir) { console.error('usage: theme-diff.mjs <baseSiteDir> <newSiteDir>'); process.exit(2); }
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.webp': 'image/webp', '.ogg': 'audio/ogg', '.mp3': 'audio/mpeg' };
const serve = (dir) => new Promise((ok) => { const s = createServer(async (q, r) => { let p = decodeURIComponent(new URL(q.url, 'http://x').pathname); if (p.endsWith('/')) p += 'index.html';
  try { const b = await readFile(resolve(dir, '.' + p)); r.writeHead(200, { 'content-type': TYPES[extname(p)] || 'application/octet-stream' }); r.end(b); } catch { r.writeHead(404); r.end(); } }).listen(0, () => ok(s)); });
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
let worst = 0;
for (const vp of [{ width: 1280, height: 900 }, { width: 375, height: 667 }]) {
  const shots = [];
  for (const dir of [baseDir, newDir]) {
    const srv = await serve(dir);
    const c = await b.newContext({ viewport: vp, reducedMotion: 'reduce', serviceWorkers: 'block' }); const p = await c.newPage();
    await p.goto(`http://localhost:${srv.address().port}/`); await p.waitForSelector('#view-games .game-card'); await p.waitForTimeout(800);
    const storm = await p.evaluate(() => document.body.classList.contains('theme-storm') || !!document.getElementById('storm-layer'));
    if (storm) throw new Error('storm theme is on: this compares the event-inactive look');
    shots.push(await p.screenshot({ fullPage: true, mask: [p.locator('.thumb'), p.locator('.fb-img'), p.locator('.snowbg')], maskColor: '#ff00ff' }));
    await c.close(); srv.close();
  }
  const p = await (await b.newContext()).newPage();
  const diff = await p.evaluate(async ([a, bb]) => {
    const load = async (b64) => { const im = new Image(); im.src = 'data:image/png;base64,' + b64; await im.decode(); const c = new OffscreenCanvas(im.width, im.height); const g = c.getContext('2d'); g.drawImage(im, 0, 0); return { w: im.width, h: im.height, d: g.getImageData(0, 0, im.width, im.height).data }; };
    const A = await load(a), B = await load(bb);
    if (A.w !== B.w || A.h !== B.h) return { size: [A.w, A.h, B.w, B.h], n: -1 };
    let n = 0; for (let i = 0; i < A.d.length; i += 4) if (A.d[i] !== B.d[i] || A.d[i + 1] !== B.d[i + 1] || A.d[i + 2] !== B.d[i + 2]) n++;
    return { n, total: A.w * A.h };
  }, shots.map(s => s.toString('base64')));
  console.log(`${vp.width}x${vp.height}: ${diff.n === -1 ? 'SIZE DIFFERS ' + diff.size : `${diff.n} of ${diff.total} pixels differ`}`);
  worst = Math.max(worst, diff.n === -1 ? Infinity : diff.n);
}
await b.close();
console.log(worst === 0 ? 'PASS  storm off = identical to base' : 'FAIL  pixels differ');
process.exit(worst === 0 ? 0 : 1);
