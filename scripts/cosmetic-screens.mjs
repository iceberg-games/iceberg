// Usage: node scripts/cosmetic-screens.mjs <id> [angles comma list]
import { chromium } from 'playwright';
import { createServer } from 'vite';
import { mkdirSync } from 'fs';
import { COSMETIC_BY_ID } from '../src/data/cosmetics.js';
const id = process.argv[2] || 'earmuffs';
const angles = (process.argv[3] || (id === 'snowglobe_pack' ? 'back,side,backthreequarter' : 'front,side,threequarter')).split(',');
const item = COSMETIC_BY_ID[id];
const out = `screenshots/${id}`; mkdirSync(out, { recursive: true });
const server = await createServer({ server: { port: 5199 }, logLevel: 'error' }); await server.listen();
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 640, height: 640 } });
const files = [];
for (const [name, hex] of (item.colorPresets || [['Default', '']])) for (const a of angles) {
  const slug = name.toLowerCase().replace(/\s+/g, '-');
  await page.goto(`http://localhost:5199/scripts/cosmetic-preview.html?id=${id}&color=${encodeURIComponent(hex)}&angle=${a}`);
  await page.waitForFunction(() => window.__ready, null, { timeout: 30000 });
  const f = `${out}/${slug}_${a}.png`; await page.locator('canvas').screenshot({ path: f }); files.push([name, a, f]);
}
// contact sheet: rows = colors, cols = angles
const imgs = await Promise.all(files.map(async ([n, a, f]) => [n, a, (await import('fs')).readFileSync(f).toString('base64')]));
await page.setViewportSize({ width: angles.length * 320, height: (item.colorPresets || [1]).length * 340 + 50 });
await page.setContent(`<body style="margin:0;background:#fff;font:bold 15px sans-serif"><div style="padding:12px">${item.icon} ${item.name} — ${item.price} BB</div><div style="display:grid;grid-template-columns:repeat(${angles.length},320px)">${imgs.map(([n, a, b]) => `<div style="text-align:center"><img src="data:image/png;base64,${b}" width=320 height=320><div style="font-weight:normal;font-size:12px">${n} · ${a}</div></div>`).join('')}</div></body>`);
await page.screenshot({ path: `${out}/contact-sheet.png`, fullPage: true });
await browser.close(); await server.close();
console.log(files.length + 1, 'images ->', out);
