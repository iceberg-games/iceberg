// node tools/shoot-default-avatar.mjs [outDir]   (needs vite running; PORT env, default 5193)
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const port = process.env.PORT || 5193, out = process.argv[2] || 'screenshots/default-avatar';
mkdirSync(out, { recursive: true });
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 1400, height: 1000 } });
p.on('pageerror', e => console.error('pageerror', e.message)); p.on('console', m => m.type() === 'error' && console.error(m.text()));
const shot = async (qs, file) => { await p.goto(`http://localhost:${port}/tools/default-avatar-preview.html?still=1&${qs}`); await p.waitForFunction('window.__ready', null, { timeout: 60000 }); await p.screenshot({ path: `${out}/${file}` }); console.log(`${out}/${file}`); };
await shot('', 'default-avatar.png');
await shot('talk=1', 'default-avatar-talk.png');
await p.goto(`http://localhost:${port}/tools/body-types-preview.html`); await p.waitForFunction('window.__ready', null, { timeout: 60000 });
await p.setViewportSize({ width: 2000, height: 1400 }); await p.goto(`http://localhost:${port}/tools/body-types-preview.html`); await p.waitForFunction('window.__ready', null, { timeout: 60000 });
await p.screenshot({ path: `${out}/body-types-grid.png` }); console.log(`${out}/body-types-grid.png`);
await b.close();
