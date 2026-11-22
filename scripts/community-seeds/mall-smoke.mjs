// Smoke scenario for "Midnight at Maple Mall" (called by scripts/community-seeds-smoke.mjs).
export async function run({ browser, open, studioThenPlay, helpers }) {
  const { goTo, setVar, visible, view, vars, toasts, G, OUT, ok } = helpers;
  const slug = 'midnight-at-maple-mall';
  const { p, doc } = await open(browser, slug);
  await studioThenPlay(p, doc, slug);
  const sim = (sec) => p.evaluate(async (sec) => { const r = window.iceberg.engine.game.runners[0]; const t0 = r.time; const s = performance.now(); while (r.time - t0 < sec && performance.now() - s < 120000) await new Promise(x => setTimeout(x, 40)); }, sec);
  const fast = (on) => p.evaluate((on) => { const r = window.iceberg.engine.renderer; r.shadowMap.enabled = !on; r.setPixelRatio(on ? 0.5 : 1); window.iceberg.engine.game.scene.traverse(o => { if (o.material) [].concat(o.material).forEach(m => { m.needsUpdate = true; }); }); }, on);
  const shot = async (name, settle = 1200) => { await fast(false); await p.waitForTimeout(settle); await p.screenshot({ path: `${OUT}/${slug}-${name}.png` }); await fast(true); };
  const ent = (name) => p.evaluate((n) => { const e = window.iceberg.engine.game.entries.find(x => x.inst.name === n); return e ? { visible: e.visible, y: e.root.position.y, doorOpen: !!e.doorOpen, solid: e.solid } : null; }, name);
  const touch = async (name, dy = 0.2, wait = 0.6) => { await goTo(p, name, dy); await sim(wait); };
  const walk = (from, yaw, keys, sec) => p.evaluate(async ({ from, yaw, keys, sec }) => {
    const eng = window.iceberg.engine, pl = eng.player; pl.teleport(pl.pos.clone().set(...from), 0); pl.camYaw = yaw; for (const k of keys) eng.input.keys.add(k);
    const r = eng.game.runners[0]; const t0 = r.time; let maxY = -1e9; const s = performance.now();
    while (r.time - t0 < sec && performance.now() - s < 120000) { await new Promise(x => setTimeout(x, 40)); maxY = Math.max(maxY, pl.pos.y); }
    for (const k of keys) eng.input.keys.delete(k); return { pos: pl.pos.toArray().map(v => +v.toFixed(2)), maxY: +maxY.toFixed(2) };
  }, { from, yaw, keys, sec });
  const T = async () => toasts(p);
  await sim(0.5);
  await view(p, { yaw: Math.PI, pitch: 0.3, dist: 9 }); await shot('2-spawn-foyer');
  ok(`${slug}: intro + timer + leaderboard`, (await p.evaluate('window.__toasts')).some(t => /Midnight at Maple Mall/.test(t)) && (await p.evaluate(`!document.querySelector('.rt-timer').classList.contains('hidden')`)));
  const keycardsStart = (await vars(p)).keycards || 0; ok(`${slug}: starts with 0 keycards`, keycardsStart === 0);

  // ---- locked gates say what they need
  await touch('Dock Gate Zone', 0.3, 0.8);
  ok(`${slug}: dock gate locked with 0 keycards (hint toast)`, (await T()).some(t => /Dock gate locked/.test(t)) && !(await ent('Dock Gate')).doorOpen);
  await touch('Service Gate Zone', 0.3, 0.8);
  ok(`${slug}: service elevator locked with 0 keycards`, (await T()).some(t => /Service elevator locked/.test(t)));
  await touch('Prize Counter Zone', -1, 0.8);
  ok(`${slug}: arcade prize case asks for 8 coins`, (await T()).some(t => /Prize Counter: bring 8/.test(t)) && !(await ent('Prize Case Door')).doorOpen);

  // ---- real walking: stairs up to the mezzanine (physics, not teleport)
  const st = await walk([-19, 0.3, -44.5], Math.PI, ['KeyW'], 5);
  ok(`${slug}: stairs are walkable up to the upper walkway`, st.maxY > 9.5, JSON.stringify(st));
  await view(p, { pos: [0, 10.4, -13.5], yaw: Math.PI, pitch: 0.25, dist: 12 }); await shot('3-upper-walkway');

  // ---- collect coins (native coin parts) -> 8 coins
  for (let i = 1; i <= 8; i++) await touch(`Lost Change ${i}`, -0.4, 0.25);
  ok(`${slug}: collected 8 Lost Change coins`, (await vars(p)).coins === 8, `coins=${(await vars(p)).coins}`);
  await view(p, { pos: [0, 0.6, -18], yaw: Math.PI, pitch: 0.28, dist: 15 }); await sim(0.5); await shot('4-atrium-fountain');

  // ---- keycards
  await touch('Keycard 1', -0.5); let v = await vars(p);
  ok(`${slug}: Keycard 1 (Food Court) collected`, v.keycards === 1 && v.points >= 100 && !(await ent('Keycard 1')).visible, JSON.stringify(v));
  await view(p, { pos: [-14, 0.6, 46], yaw: Math.PI, pitch: 0.3, dist: 14 }); await shot('5-food-court');
  await touch('Prize Counter Zone', -1, 1.2);
  ok(`${slug}: with 8 coins the prize case opens`, (await ent('Prize Case Door')).doorOpen, JSON.stringify(await ent('Prize Case Door')));
  await touch('Keycard 4', -0.5); await touch('Keycard 2', -0.5); await touch('Keycard 3', -0.5);
  v = await vars(p); ok(`${slug}: Keycards 2/3/4 collected (toy castle, hamster shelf, arcade case)`, v.keycards === 4, JSON.stringify(v));
  await view(p, { pos: [34, 0.6, 14], yaw: Math.PI, pitch: 0.3, dist: 12 }); await shot('6-arcade');
  // with >= 3 keycards the service elevator unlocks
  await touch('Service Gate Zone', 0.3, 1.5);
  ok(`${slug}: 3+ keycards unlock the service elevator`, (await ent('Service Door')).doorOpen);
  // elevator really moves
  const ys = []; for (let i = 0; i < 12; i++) { ys.push((await ent('Service Elevator Cab')).y); await sim(1); }
  ok(`${slug}: service elevator cab travels to the roof`, Math.max(...ys) - Math.min(...ys) > 15, `y range ${Math.min(...ys).toFixed(1)}..${Math.max(...ys).toFixed(1)}`);

  // ---- cinema puzzle
  await touch('Seat 1', 0.4, 0.8);
  ok(`${slug}: wrong cinema seat does nothing`, (await T()).some(t => /Not this seat/.test(t)) && !(await ent('Booth Door')).doorOpen);
  await touch('Seat 3', 0.4, 1.2);
  ok(`${slug}: centre back-row seat opens the booth`, (await ent('Booth Door')).doorOpen);
  await touch('Keycard 5', -0.5); v = await vars(p); ok(`${slug}: Keycard 5 (projection booth)`, v.keycards === 5, JSON.stringify(v));
  await view(p, { pos: [56, 0.6, 14], yaw: Math.PI, pitch: 0.3, dist: 12 }); await shot('7-cinema');
  await view(p, { pos: [-8, 23.2, 44], yaw: Math.PI, pitch: 0.28, dist: 14 }); await touch('Keycard 6', -0.5, 0.6);
  v = await vars(p); ok(`${slug}: Keycard 6 (rooftop telescope) -> 6 keycards`, v.keycards === 6, JSON.stringify(v));
  await view(p, { pos: [-8, 23.2, 44], yaw: Math.PI, pitch: 0.28, dist: 14 }); await shot('8-rooftop-garden');

  // ---- secrets: pull the book, collect 3 ducks, closet opens
  await touch('Strange Book', 0.3, 0.8);
  ok(`${slug}: pulling the pink book hides the fake shelf`, !(await ent('Fake Shelf')).visible);
  await touch('Golden Duck 1'); await touch('Golden Duck 2'); await touch('Golden Duck 3'); await sim(0.8);
  v = await vars(p); ok(`${slug}: 3 golden ducks found`, v.ducks === 3, JSON.stringify(v));
  ok(`${slug}: all ducks open the janitor closet`, (await ent('Closet Door')).doorOpen);
  // real physics: toy-block tower is climbable, ledge for the 3rd duck needs the Pogo Boots
  const tw = await walk([-47.2, 0.3, 21.2], Math.PI / 2, ['KeyW', 'Space'], 12);
  ok(`${slug}: toy-block tower can be climbed by jumping (physics)`, tw.maxY > 5.5, JSON.stringify(tw));
  // gear exists in the game and is free for creator-added gears
  ok(`${slug}: Pogo Boots gear giver present (gravity coil)`, await p.evaluate(`${G}.doc.instances.some(i => i.type === 'gear' && i.gearId === 'gravityCoil')`));
  await touch('Pogo Boots (Gravity Coil)', 0.3, 0.6);
  ok(`${slug}: touching the giver puts the Pogo Boots in the backpack`, await p.evaluate(`${G}.backpack.items.includes('gravityCoil')`));

  // ---- cleaning bots bump you
  await setVar(p, 'health', 100); await touch('Cleaning Bot B Body', 0.0, 1.0);
  ok(`${slug}: cleaning bot bump costs a little health`, (await vars(p)).health < 100, `health=${(await vars(p)).health}`);

  // ---- dock gate + finish
  await setVar(p, 'health', 100);
  await touch('Dock Gate Zone', 0.3, 1.5);
  ok(`${slug}: dock gate opens with 6 keycards`, (await ent('Dock Gate')).doorOpen);
  await view(p, { pos: [0, 0.6, 60], yaw: Math.PI, pitch: 0.3, dist: 12 }); await shot('9-dock-gate');
  await goTo(p, 'Dock Finish', -1.5); await sim(2);
  const t = await toasts(p);
  ok(`${slug}: escaping triggers the win (Mall Legend ending with 3 ducks)`, t.some(x => /Mall Legend/.test(x)), JSON.stringify(t.slice(-2)));
  await view(p, { pos: [0, 0.6, 76], yaw: Math.PI, pitch: 0.25, dist: 16 }); await shot('10-escaped-win', 2000);
  await p.context().close();
}
