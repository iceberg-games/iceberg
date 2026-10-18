// Headless check: locker color presets recolor the avatar in the built game.
import { chromium } from 'playwright';
const url = 'file://' + (process.argv[2] || new URL('../dist/index.html', import.meta.url).pathname);
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const SETS = { base: [['earmuffs', 'Cranberry'], ['snowglobe_pack', 'Gold Ribbon'], ['cocoa_mug', 'Mint'], ['frost_lantern', 'Aurora Green'], ['penguin_pal', 'Sky Scarf'], ['cable_sweater', 'Fjord Blue'], ['frost_specs', 'Rose Copper'], ['owl_hood', 'Tawny']],
  nd: [['storm_goggles', 'Siren Red'], ['hail_umbrella', 'Cherry'], ['aurora_skin', 'Violet Sky'], ['ice_skates', 'Berry'], ['storm_slicker', 'Glacier Blue']] };
const LIST = SETS[process.env.SET || 'base'];
const errs = []; page.on('pageerror', e => errs.push(e.message));
await page.goto(url); await page.waitForFunction(() => window.iceberg);
await page.evaluate(async (ids) => {
  const { economy } = window.iceberg; economy.demoGrant(5000);
  for (const id of ids) { economy.buy?.(id) ?? economy.purchase?.(id); economy.equip(id); }
  await window.iceberg.play('frost-fields').catch(() => window.iceberg.play(window.iceberg.menu?.games?.[0]?.id));
}, LIST.map(x => x[0]));
await page.waitForTimeout(2500);
await page.keyboard.press('KeyL'); await page.waitForTimeout(500);
const res = {};
for (const [id, preset] of LIST) {
  await page.locator(`.cosmetic-custom[data-id="${id}"] button`, { hasText: preset }).click();
  res[id] = await page.evaluate((id) => {
    const o = Object.values(window.iceberg.avatar.attached).find(o => o.userData.cosmeticId === id);
    let mesh = null; o?.traverse(m => { if (!mesh && m.isMesh) mesh = m; });
    return { saved: window.iceberg.economy.profile.cosmeticColors[id], avatar: window.iceberg.avatar.cosmeticColors[id], attached: !!o, meshColor: mesh && [].concat(mesh.material)[0].map ? 'textured' : mesh && '#' + [].concat(mesh.material)[0].color.getHexString() };
  }, id);
}
await page.screenshot({ path: `screenshots/locker-colors${process.env.SET ? '-' + process.env.SET : ''}.png` });
console.log(JSON.stringify(res, null, 1), 'errors:', errs);
await browser.close();
