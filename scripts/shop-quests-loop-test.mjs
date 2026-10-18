// Headless check (built game): with earnOnly event items visible and a stubbed async getQuests that returns a
// fresh (but equal) array every call, the shop must not re-render in a loop.
import { chromium } from 'playwright';
const url = 'file://' + (process.argv[2] || new URL('../dist/index.html', import.meta.url).pathname);
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errs = []; page.on('pageerror', e => errs.push(e.message));
await page.goto(url); await page.waitForFunction(() => window.iceberg);
await page.evaluate(async () => {
  const { economy, ui } = window.iceberg;
  window.__calls = 0; window.__renders = 0;
  economy.itemAvailability = () => ({ forSale: true, limited: true, eventId: 'natural_disasters', state: 'live', hidden: false, msLeft: 5 * 864e5 });
  economy.shopVisible = () => true;
  economy.getQuests = () => { window.__calls++; return new Promise(r => setTimeout(() => r([{ id: 'nd_quest_disaster_survival', progress: 1, target: 3, live: true }]), 20)); };
  const orig = ui.refreshDrawer.bind(ui); ui.refreshDrawer = () => { window.__renders++; return orig(); };
  await window.iceberg.play('frost-fields').catch(() => {});
});
await page.waitForTimeout(1500);
await page.evaluate(() => { window.__calls = 0; window.__renders = 0; });
await page.keyboard.press('KeyT');
await page.waitForTimeout(4000);
const r = await page.evaluate(() => ({ calls: window.__calls, renders: window.__renders, earnCards: [...document.querySelectorAll('.card')].filter(c => /tornado_hat|lightning_back/.test(c.dataset.id)).length }));
const ok = r.calls <= 2 && r.renders <= 4 && r.earnCards > 0 && !errs.length;
console.log(JSON.stringify(r), 'errors:', errs, ok ? 'PASS' : 'FAIL');
await browser.close(); process.exit(ok ? 0 : 1);
