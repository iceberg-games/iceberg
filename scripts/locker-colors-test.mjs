// Headless check: locker color presets recolor the avatar in the built game.
import { chromium } from 'playwright';
const url = 'file://' + (process.argv[2] || new URL('../dist/index.html', import.meta.url).pathname);
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errs = []; page.on('pageerror', e => errs.push(e.message));
await page.goto(url); await page.waitForFunction(() => window.iceberg);
await page.evaluate(async () => {
  const { economy } = window.iceberg; economy.demoGrant(5000);
  for (const id of ['earmuffs', 'snowglobe_pack', 'cocoa_mug', 'frost_lantern', 'penguin_pal', 'cable_sweater']) { economy.buy?.(id) ?? economy.purchase?.(id); economy.equip(id); }
  await window.iceberg.play('frost-fields').catch(() => window.iceberg.play(window.iceberg.menu?.games?.[0]?.id));
});
await page.waitForTimeout(2500);
await page.keyboard.press('KeyL'); await page.waitForTimeout(500);
const res = {};
for (const [id, preset] of [['earmuffs', 'Cranberry'], ['snowglobe_pack', 'Gold Ribbon'], ['cocoa_mug', 'Mint'], ['frost_lantern', 'Aurora Green'], ['penguin_pal', 'Sky Scarf'], ['cable_sweater', 'Fjord Blue']]) {
  await page.locator(`.cosmetic-custom[data-id="${id}"] button`, { hasText: preset }).click();
  res[id] = await page.evaluate((id) => {
    const o = Object.values(window.iceberg.avatar.attached).find(o => o.userData.cosmeticId === id);
    let mesh = null; o?.traverse(m => { if (!mesh && m.isMesh) mesh = m; });
    return { saved: window.iceberg.economy.profile.cosmeticColors[id], avatar: window.iceberg.avatar.cosmeticColors[id], attached: !!o, meshColor: mesh && [].concat(mesh.material)[0].map ? 'textured' : mesh && '#' + [].concat(mesh.material)[0].color.getHexString() };
  }, id);
}
await page.screenshot({ path: 'screenshots/locker-colors.png' });
console.log(JSON.stringify(res, null, 1), 'errors:', errs);
await browser.close();
