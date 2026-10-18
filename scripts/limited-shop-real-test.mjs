// Limited-time shop UI against the REAL economy API (itemAvailability / shopVisible / buy(); guest rules).
// 1) As shipped (natural_disasters unscheduled): every event item is HIDDEN; regular items are on sale.
// 2) Then only the event window is moved (LocalBackend.eventStatus), so the real gating code runs end to end:
//    live (badge + countdown, buy works) -> ended while open (real buy() refuses, coins kept, owned item still equips)
//    -> not started (hidden again).
//   npx vite build && node scripts/limited-shop-real-test.mjs [dist/index.html]
import { chromium } from 'playwright';
const url = 'file://' + (process.argv[2] || new URL('../dist/index.html', import.meta.url).pathname);
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errs = []; page.on('pageerror', e => errs.push(e.message));
await page.goto(url); await page.waitForFunction(() => window.iceberg?.economy, null, { timeout: 30000 });
const card = (id) => page.evaluate((id) => { const el = document.querySelector(`.card[data-id="${id}"]`); return el && { badge: el.querySelector('.limited-badge')?.textContent || null, btn: el.querySelector('button')?.textContent, disabled: !!el.querySelector('button')?.disabled }; }, id);
const shopIds = () => page.evaluate(() => [...document.querySelectorAll('.card[data-id]')].map(e => e.dataset.id));
const toasts = () => page.evaluate(() => [...document.querySelectorAll('.toast')].map(t => t.textContent));
const refresh = () => page.evaluate(() => window.iceberg.ui.refreshDrawer()).then(() => page.waitForTimeout(300));
const setWindow = (mode) => page.evaluate((mode) => {
  const b = window.iceberg.economy.backend, real = (window.__realES ||= b.eventStatus.bind(b)), H = 3600e3;
  b.eventStatus = (id, now = Date.now()) => {
    const st = real(id, now);
    if (mode === 'live') return { ...st, startsAt: new Date(now - 24 * H).toISOString(), endsAt: new Date(now + (3 * 24 + 4) * H + 5e4).toISOString(), active: true };
    if (mode === 'ended') return { ...st, startsAt: new Date(now - 9 * 24 * H).toISOString(), endsAt: new Date(now - 2 * H).toISOString(), active: false };
    return { ...st, startsAt: new Date(now + 5 * H).toISOString(), endsAt: new Date(now + 7 * 24 * H).toISOString(), active: false };
  };
}, mode);
const { COSMETICS } = await import('../src/data/cosmetics.js');
const hiddenIds = COSMETICS.filter(c => c.event).map(c => c.id);       // buyable event items + earnOnly event rewards
await page.evaluate(() => { window.iceberg.economy.profile.coins = 5000; });
await page.evaluate(() => window.iceberg.play('frost-fields').catch(() => {}));
await page.waitForTimeout(2500);
await page.evaluate(() => window.iceberg.ui.openDrawer?.('shop')); await page.waitForTimeout(500);
const res = {};
// 1) as shipped
const ids0 = await shopIds();
res.unscheduled = { listed: ids0.length, eventShown: hiddenIds.filter(i => ids0.includes(i)), storm: ['storm_goggles', 'hail_umbrella', 'storm_slicker'].filter(i => ids0.includes(i)),
  aurora: await card('aurora_skin'), skates: await card('ice_skates'),
  buy: await page.evaluate(() => window.iceberg.economy.buy('storm_slicker')), av: await page.evaluate(() => window.iceberg.economy.itemAvailability('storm_goggles')) };
// 2) live
await setWindow('live'); await refresh();
res.live = { slicker: await card('storm_slicker'), skates: await card('ice_skates'), umbrellaBuy: await page.evaluate(() => window.iceberg.economy.buy('hail_umbrella').ok) };
// ended while the shop is open: the real buy() refuses
await setWindow('ended');
const coins0 = await page.evaluate(() => window.iceberg.economy.coins);
await page.locator('.card[data-id="storm_slicker"] button').click(); await page.waitForTimeout(250);
res.refusedToast = await toasts();
res.coinsKept = (await page.evaluate(() => window.iceberg.economy.coins)) === coins0 && !(await page.evaluate(() => window.iceberg.economy.owns('storm_slicker')));
await refresh();
res.ended = { slicker: await card('storm_slicker'), umbrellaOwned: await card('hail_umbrella'), aurora: await card('aurora_skin') };
// not started again: hidden (owned umbrella still listed)
await setWindow('soon'); await refresh();
res.notStarted = { slicker: await card('storm_slicker'), umbrellaOwned: await card('hail_umbrella') };
await page.screenshot({ path: 'screenshots/limited-shop-real.png' }).catch(() => {});
const ok = res.unscheduled.storm.length === 0 && res.unscheduled.eventShown.length === 0 && res.unscheduled.listed > 10
  && res.unscheduled.aurora?.btn === 'Buy' && res.unscheduled.skates?.btn === 'Buy'
  && res.unscheduled.buy.ok === false && res.unscheduled.buy.code === 'event_not_started' && res.unscheduled.av.hidden === true
  && /3d 4h left/.test(res.live.slicker?.badge || '') && res.live.slicker.btn === 'Buy' && !res.live.skates?.badge && res.live.umbrellaBuy
  && res.refusedToast.some(t => /event has ended/.test(t)) && res.coinsKept
  && res.ended.slicker?.btn === 'Event ended' && res.ended.slicker.disabled && /Equip/.test(res.ended.umbrellaOwned?.btn || '') && !res.ended.aurora?.disabled
  && res.notStarted.slicker === null && /Equip/.test(res.notStarted.umbrellaOwned?.btn || '') && !errs.length;
console.log(JSON.stringify(res, null, 1), 'errors:', errs, ok ? 'PASS' : 'FAIL');
await browser.close(); process.exit(ok ? 0 : 1);
