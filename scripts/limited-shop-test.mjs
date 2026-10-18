// Headless check: limited-time shop UI with a stubbed economy.itemAvailability (built game).
import { chromium } from 'playwright';
const url = 'file://' + (process.argv[2] || new URL('../dist/index.html', import.meta.url).pathname);
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errs = []; page.on('pageerror', e => errs.push(e.message));
await page.goto(url); await page.waitForFunction(() => window.iceberg);
const card = (id) => page.evaluate((id) => { const el = document.querySelector(`.card[data-id="${id}"]`); return el && { badge: el.querySelector('.limited-badge')?.textContent || null, btn: el.querySelector('button')?.textContent, disabled: !!el.querySelector('button')?.disabled }; }, id);
const toasts = () => page.evaluate(() => [...document.querySelectorAll('.toast, .ib-toast')].map(t => t.textContent));
await page.evaluate(async () => {
  const { economy } = window.iceberg; economy.demoGrant(5000);
  window.__state = 'live';
  economy.itemAvailability = (id) => {
    const c = window.iceberg.COSMETIC_BY_ID?.[id];
    const ev = ['storm_goggles', 'hail_umbrella', 'storm_slicker'].includes(id);
    if (!ev) return { forSale: true, limited: false, state: 'live' };
    const s = window.__state;
    return { forSale: s === 'live', limited: true, eventId: 'natural_disasters', state: s, hidden: s === 'event_not_started', msLeft: s === 'live' ? (3 * 24 + 4) * 3600e3 + 5e4 : undefined };
  };
  economy.buy('hail_umbrella'); // own one event item before the event "ends"
  economy.buy = ((orig) => (id) => window.__state === 'live' ? orig.call(economy, id) : { ok: false, code: window.__state, reason: window.__state === 'event_ended' ? 'This event item is no longer for sale.' : 'This item is not on sale yet.' })(economy.buy);
  await window.iceberg.play('frost-fields').catch(() => {});
});
await page.waitForTimeout(2000);
await page.keyboard.press('KeyT'); await page.waitForTimeout(500);
const res = { live: { slicker: await card('storm_slicker'), goggles: await card('storm_goggles'), skates: await card('ice_skates') } };
await page.screenshot({ path: 'screenshots/limited-shop-live.png' });
// before start: hidden entirely
await page.evaluate(() => { window.__state = 'event_not_started'; window.iceberg.ui.refreshDrawer(); }); await page.waitForTimeout(300);
res.beforeStart = { slicker: await card('storm_slicker') };
await page.evaluate(() => { window.__state = 'live'; window.iceberg.ui.refreshDrawer(); }); await page.waitForTimeout(300);
// buy refused path (server says ended between renders)
await page.evaluate(() => { window.__state = 'event_ended'; });
await page.locator('.card[data-id="storm_slicker"] button').click(); await page.waitForTimeout(200);
res.refusedToast = await toasts();
await page.evaluate(() => window.iceberg.ui.refreshDrawer());
await page.waitForTimeout(300);
res.ended = { slicker: await card('storm_slicker'), umbrellaOwned: await card('hail_umbrella') };
await page.screenshot({ path: 'screenshots/limited-shop-ended.png' });
await page.evaluate(() => { window.__state = 'event_not_started'; window.iceberg.ui.refreshDrawer(); });
await page.waitForTimeout(300);
res.notStarted = { slicker: await card('storm_slicker'), goggles: await card('storm_goggles'), umbrellaOwned: await card('hail_umbrella') };
const ok = res.live.slicker?.badge?.includes('3d 4h left') && res.live.slicker.btn === 'Buy' && !res.live.skates.badge
  && res.refusedToast.some(t => t.includes('no longer')) && res.ended.slicker.btn === 'Event ended' && res.ended.slicker.disabled
  && /Equip/.test(res.ended.umbrellaOwned.btn) && res.notStarted.slicker === null && res.notStarted.goggles === null && /Equip/.test(res.notStarted.umbrellaOwned?.btn || '') && res.beforeStart.slicker === null && !errs.length;
console.log(JSON.stringify(res, null, 1), 'errors:', errs, ok ? 'PASS' : 'FAIL');
await browser.close(); process.exit(ok ? 0 : 1);
