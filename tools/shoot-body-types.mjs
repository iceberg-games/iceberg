// node tools/shoot-body-types.mjs  (needs `npx vite --port 5191` running)
import { chromium } from 'playwright';
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 1200, height: 1400 } });
p.on('pageerror', e => console.error('pageerror', e.message)); p.on('console', m => m.type() === 'error' && console.error(m.text()));
await p.goto('http://localhost:5191/tools/body-types-preview.html'); await p.waitForFunction('window.__ready', null, { timeout: 60000 });
await p.screenshot({ path: 'screenshots/body-types/body-types-grid.png' }); await b.close(); console.log('ok');
