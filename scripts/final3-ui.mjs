// Headed: shop + locker tiles for the final showcase items, plus an in-game look. Uses the running dev server.
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
const BASE = process.env.BASE || 'http://127.0.0.1:5330', OUT = 'screenshots/final3';
mkdirSync(OUT, { recursive: true });
const IDS = ['fs_glacier_wings', 'fs_polar_cub_pal'];
const browser = await chromium.launch({ headless: false, executablePath: '/usr/bin/google-chrome', args: ['--window-position=0,0', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
const errs = []; page.on('pageerror', e => errs.push(e.message));
await page.goto(BASE + '/'); await page.waitForFunction(() => window.iceberg?.economy, null, { timeout: 60000 });
{ const st = page.getByText('▶ Start'); if (await st.isVisible().catch(() => false)) await st.click().catch(() => {}); }
await page.evaluate(() => { try { localStorage.setItem('iceberg:v1:bodyType', JSON.stringify('classic')); } catch {} });
await page.evaluate(() => window.iceberg.economy.demoGrant(60000));
await page.evaluate(async () => { await window.iceberg.play('frost-fields').catch(() => window.iceberg.play(window.iceberg.menu?.games?.[0]?.id)); });
await page.waitForTimeout(2500);
// shop BEFORE buying (price tiles)
await page.keyboard.press('KeyT'); await page.waitForTimeout(500);
await page.locator('.tab', { hasText: 'Premium' }).click(); await page.waitForTimeout(400);
await page.locator(`.card[data-id="${IDS[0]}"]`).scrollIntoViewIfNeeded();
await page.screenshot({ path: `${OUT}/shop_premium_tab.png` });
for (const id of IDS) await page.locator(`.card[data-id="${id}"]`).screenshot({ path: `${OUT}/shop_tile_${id}.png` });
// buy (Buy button = real economy path), equip both
for (const id of IDS) { await page.locator(`.card[data-id="${id}"] button.buy`).click(); await page.waitForTimeout(400); }
await page.evaluate((ids) => { for (const id of ids) if (!window.iceberg.economy.isEquipped(id)) window.iceberg.economy.equip(id); }, IDS);
await page.waitForTimeout(300);
await page.locator(`.card[data-id="${IDS[0]}"]`).scrollIntoViewIfNeeded();
await page.screenshot({ path: `${OUT}/shop_premium_owned.png` });
await page.keyboard.press('Escape'); await page.waitForTimeout(300);
await page.keyboard.press('KeyL'); await page.waitForTimeout(600);
for (const id of IDS) await page.locator(`.locker-item[data-id="${id}"]`).screenshot({ path: `${OUT}/locker_tile_${id}.png` });
await page.locator(`.cosmetic-custom[data-id="${IDS[1]}"] button`, { hasText: 'Mint' }).click(); await page.waitForTimeout(300);
await page.locator(`.cosmetic-custom[data-id="${IDS[0]}"] button`, { hasText: 'Aurora Violet' }).click(); await page.waitForTimeout(300);
await page.locator(`.cosmetic-custom[data-id="${IDS[0]}"]`).scrollIntoViewIfNeeded();
await page.screenshot({ path: `${OUT}/locker_colors.png` });
const state = await page.evaluate((ids) => ids.map(id => { const o = Object.values(window.iceberg.avatar.attached).find(o => o.userData.cosmeticId === id); return { id, attached: !!o, color: window.iceberg.economy.profile.cosmeticColors?.[id] }; }), IDS);
await page.keyboard.press('Escape'); await page.waitForTimeout(1500);
await page.screenshot({ path: `${OUT}/ingame_both.png` });
const fps = await page.evaluate(() => new Promise(r => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 3000) requestAnimationFrame(f); else r(n / 3); }; requestAnimationFrame(f); }));
console.log(JSON.stringify({ state, fps, errs }, null, 1));
if (!process.env.KEEP) await browser.close();
