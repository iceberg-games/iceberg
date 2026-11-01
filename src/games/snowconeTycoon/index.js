// Game: Snowcone Tycoon. Run a snowcone stand on a sunny frost-plaza
// boardwalk: shave ice, pour syrup, add toppings and serve chilly tourists.
// Between shifts spend tip-coins on machines + stand upgrades that visibly
// grow the stand. Three days, 1-3 stars, one-time Birg Bucks (15/25/40) on the
// first clear of each day, saved per profile via economy.saveGameData.
//
// Modules: config.js (numbers/save), logic.js (pure rules), stand.js (scene),
// props.js (models + icons), customers.js (NPCs), audio.js (Sound pack),
// ui.js (HUD/hub/cards), thumb.js. Movement + USE come from engine.input.
import * as THREE from 'three';
import { GAME_ID, GAME_NAME, DAYS, FLAVORS, FLAVOR_ORDER, TOPPINGS, TOPPING_ORDER, REWARD_SOURCE, rewardReason, normalizeSave, mergeSaves, finishDay, dayUnlocked, mods, buy, shopItem } from './config.js';
import { Shift } from './logic.js';
import { buildStand, A } from './stand.js';
import { Bag, buildCone3D, makeIcons } from './props.js';
import { Customers, disposeCustomerCaches } from './customers.js';
import { SnowconeAudio } from './audio.js';
import { SnowconeUI } from './ui.js';
import { drawThumb } from './thumb.js';
import { getDeviceMode } from '../../core/device.js';


const DIGITS = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6'];
const TOP_KEYS = ['Digit7', 'Digit8', 'Digit9', 'Digit0'];
let thumbCache = null;

function persist(economy, save) {
  if (typeof economy.saveGameData === 'function') return economy.saveGameData(GAME_ID, save);
  economy.profile.gameData = { ...(economy.profile.gameData || {}), [GAME_ID]: save };
  economy.backend?.saveProfile?.(economy.profile);
  return Promise.resolve({ ok: true });
}

export default {
  id: GAME_ID,
  name: GAME_NAME,
  tagline: 'Shave, pour & serve on the frosty boardwalk',
  description: 'Run a cozy snowcone stand on a sunny frost plaza. Shave ice, pour neon syrups, crown cones with toppings and serve every chilly tourist before they lose patience. Spend tip-coins on machines and upgrades that grow your stand. 3 days, 3 stars each, and Birg Bucks the first time you clear each day.',
  get thumbnail() { if (!thumbCache) { try { thumbCache = drawThumb(); } catch { thumbCache = 'frost'; } } return thumbCache; },
  music: 'none', // plays its own Sound-designed loops through the shared audio output
  features: {},
  mobile: true,  // shared joystick + jump, plus the game's own USE button and big tap targets

  async create(ctx) {
    const { engine, economy, music, avatar } = ctx;
    const player = engine.player, input = engine.input;
    const scene = new THREE.Scene(); scene.fog = new THREE.Fog('#dcecff', 40, 170);
    // Snowcone Plaza set (Set Builder) as the world; gameplay stations follow its layout hooks.
    // Falls back to the built-in procedural stand if the set fails or times out.
    let set = null;
    try {
      const mod = await import('./set/index.js');
      set = await Promise.race([mod.default.create({ renderer: engine.renderer, gameplay: true }), new Promise((_, rej) => setTimeout(() => rej(new Error('set timeout')), 15000))]);
      set.setNight?.(0); set.setWeather?.(0); scene.add(set.scene); scene.fog = set.scene.fog;
    } catch (e) { console.warn('[snowcone] plaza set fallback', e); set = null; }
    const stand = buildStand(set); scene.add(stand.root);
    const camFar = engine.camera.far; engine.camera.far = Math.max(camFar, 700); engine.camera.updateProjectionMatrix();
    const exposure = engine.renderer.toneMappingExposure; engine.renderer.toneMappingExposure = 1.0;
    const prevCam = { pitch: player.camPitch, dist: player.camDist };
    const CAM = A.set ? { pitch: 0.4, dist: 9.5 } : { pitch: 0.78, dist: 12 }; // set: look under the awning
    player.camPitch = CAM.pitch; player.camDist = CAM.dist;

    const icons = makeIcons(96);
    const customers = new Customers(scene);
    const bag = new Bag();
    const held = buildCone3D(bag); held.name = 'sct-held'; held.position.set(0.0, 1.35, 0.75); held.scale.setScalar(1.3); avatar.root.add(held); held.visible = false;
    const audio = new SnowconeAudio(music);

    // ---------- state ----------
    let disposed = false, timeScale = 1;
    const testMode = /[?&]sctest=1\b/.test(location.search);
    const rng = testMode ? (() => { let a = 4242; return () => { a = (a * 16807) % 2147483647; return a / 2147483647; }; })() : Math.random;
    let save = normalizeSave(economy.cachedGameData ? economy.cachedGameData(GAME_ID) : economy.profile?.gameData?.[GAME_ID]);
    let saveReady = typeof economy.loadGameData !== 'function';
    const firstOpen = () => Math.min(3, Math.max(1, (DAYS.findIndex((d, i) => !save.stars[i]) + 1) || 3));
    let selected = firstOpen();
    let shift = null, mode = 'hub', paused = false, countdown = 0, lastCount = 4, resultShown = false, rewardPaid = 0;
    let target = null, prevKeys = new Set(), pourLock = 0, crunchT = 0, shaveFx = 0;

    const ui = new SnowconeUI({
      engine, icons,
      onAct: (k) => act(k), onPause: () => togglePause(),
      onOpen: () => startDay(selected),
      onSelectDay: (n) => { if (dayUnlocked(save, n)) { selected = n; showHub(); } else ui.banner('Locked', `Earn a star on Day ${n - 1} first`, 1300); },
      onBuy: (id, el) => doBuy(id, el),
    });
    ui.onStar = () => audio.play('sfx_order_ding', { gain: 0.45, rate: 1.5 });

    const showHub = () => {
      mode = 'hub'; ui.showShift(false); ui.hideCard(); stand.setDay(DAYS[selected - 1]); stand.applyUpgrades(save.upgrades);
      ui.showHub(true, { save, selected, loading: !saveReady }); audio.setMusic('lobby');
    };
    if (!saveReady) {
      const p = economy.loadGameData(GAME_ID), timeout = new Promise(r => setTimeout(() => r(undefined), 6000));
      Promise.race([p, timeout]).then((data) => { if (disposed) return; save = mergeSaves(save, data ?? economy.cachedGameData?.(GAME_ID)); saveReady = true; selected = firstOpen(); if (mode === 'hub') showHub(); })
        .catch(() => { saveReady = true; if (!disposed && mode === 'hub') showHub(); });
    }

    function doBuy(id, el) {
      const next = buy(save, id);
      if (!next) { audio.play('sfx_reject', { gain: 0.6 }); ui.banner('Not enough tip-coins', 'Serve more snowcones!', 1100); return; }
      save = next; persist(economy, save); stand.applyUpgrades(save.upgrades);
      const it = shopItem(id);
      audio.play(it.kind === 'machine' ? 'sfx_place_machine' : 'sfx_upgrade');
      const obj = { shaver: stand.shaver, pump: stand.bottles.blue.parent, heater: stand.heater, counter: stand.extension, neon: stand.sign, patio: stand.patio[Math.min(1, save.upgrades.patio - 1)] }[id];
      const at = { shaver: [A.shaver.x, 2.2, A.shaver.z + 0.5], pump: [A.bottles[2].x, 2, A.bottles[2].z], heater: [A.heater[0], 2.6, A.heater[1]], counter: A.set ? [A.extension[0], 1.4, A.extension[1]] : [3.3, 1.4, -2.3], neon: [stand.sign.position.x, stand.sign.position.y, stand.sign.position.z + 0.3], patio: [A.patio[0][0], 1.5, A.patio[0][1]] }[id];
      if (obj && obj !== stand.root) stand.punch(obj, 0.3);
      stand.burst(...at, { color: ['#7fe3ff', '#ffffff', '#ff7eb6', '#ffd23f'], n: 34, speed: 3.5, up: 3, size: 0.25, life: 1.2 });
      if (el) { const r = el.getBoundingClientRect(); ui.floatText(`${it.icon} ${it.name}!`, r.left - 40, r.top - 10, '#7fe3ff'); }
      ui.banner(it.kind === 'machine' ? 'Machine placed!' : 'Stand upgraded!', `${it.name} · ${it.effect(save.upgrades[id])}`, 1300);
      ui.showHub(true, { save, selected, loading: false });
    }

    function startDay(n) {
      if (!saveReady || !dayUnlocked(save, n)) return;
      selected = n; const day = DAYS[n - 1];
      shift = new Shift(day, { ...mods(save), walk: A.set ? 5 : 2.2, leave: A.set ? 5 : 3 }, { rng });
      customers.clear(); stand.setDay(day); stand.applyUpgrades(save.upgrades);
      resultShown = false; rewardPaid = 0; paused = false; ui.prevStars = 0;
      player.teleport(A.shiftSpawn, Math.PI); player.camPitch = CAM.pitch; player.camDist = Math.min(player.maxCamDist, CAM.dist); player.updateCamera?.();
      ui.showHub(false); ui.hideCard(); ui.showShift(true); ui.setStatus(shift);
      mode = 'countdown'; countdown = 3.2; lastCount = 4; audio.play('sfx_order_ding', { gain: 0.5 });
    }
    function togglePause() {
      if (mode !== 'open' && mode !== 'countdown') return;
      paused = !paused;
      if (paused) ui.showPause({ onResume: () => togglePause(), onQuit: () => { paused = false; shift = null; customers.clear(); showHub(); } });
      else ui.hideCard();
    }
    function endDay() {
      if (resultShown || !shift) return; resultShown = true;
      const d = shift.day.n;
      const r = finishDay(save, d, { score: shift.score, coins: shift.coins, served: shift.served, failed: shift.failed });
      save = r.save;
      persist(economy, save);            // record the claim first so a reload can never pay twice
      if (r.reward > 0) { economy.earn(r.reward, rewardReason(d), { source: REWARD_SOURCE }); rewardPaid = r.reward; }
      mode = 'result'; ui.showShift(false); audio.setMusic('lobby');
      if (r.stars > 0) { ui.confetti(d === 3 ? 140 : 80); stand.burst(0, 4.5, -5.6, { color: ['#7fe3ff', '#ff7eb6', '#ffd23f', '#5fd94a'], n: 60, speed: 5, up: 4, size: 0.3, life: 1.6 }); }
      else audio.play('sfx_reject');
      if (r.levelUp) setTimeout(() => { if (!disposed) { audio.play('sfx_level_up'); ui.banner(`Renown ${r.levelUp}!`, 'Your stand is the talk of the boardwalk', 1800); ui.confetti(60); } }, 1500);
      ui.showResult({ day: d, coins: shift.coins, served: shift.served, lost: shift.lost, combo: shift.bestCombo, stars: r.stars, failed: shift.failed, reward: r.reward, newBest: r.newBest && shift.score > 0, levelUp: r.levelUp, gift: r.gift }, {
        onHub: () => { shift = null; customers.clear(); selected = Math.min(3, Math.max(selected, firstOpen())); showHub(); },
        onRetry: () => startDay(d), onNext: () => startDay(Math.min(3, d + 1)), onStar: () => audio.play('sfx_order_ding', { gain: 0.5, rate: 1.25 }),
      });
    }

    // ---------- targeting ----------
    const tmpV = new THREE.Vector3();
    const toScreen = (v) => { tmpV.copy(v).project(engine.camera); const r = engine.renderer.domElement.getBoundingClientRect(); return [r.left + (tmpV.x + 1) / 2 * r.width, r.top + (1 - tmpV.y) / 2 * r.height, tmpV.z < 1]; };
    // Nearest useful station/guest around the player (works for the set and the fallback stand).
    function pickTarget() {
      if (!shift) return null;
      const p = player.pos, c = shift.cone, ready = !!c && c.ice >= 1 && !!c.syrup, iced = !!c && c.ice >= 1 && !c.syrup;
      const cands = [];
      const add = (t, x, z, reach, bonus = 0) => { const d = Math.hypot(p.x - x, p.z - z); if (d < reach) cands.push({ ...t, score: d - bonus }); };
      add({ id: 'shaver', name: 'Ice Hopper', sub: 'hold USE' }, A.shaver.px, A.shaver.pz, 1.25, !c || c.ice < 1 ? 0.6 : 0);
      for (const b of A.bottles) if (shift.day.flavors.includes(b.f)) add({ id: 'syrup', flavor: b.f, name: 'Syrup Bar', sub: FLAVORS[b.f].name }, b.px, b.pz, 0.75, iced ? 0.4 : 0);
      if (A.topping) { const i = Math.max(0, Math.min(3, Math.round((p.x - A.topping.x + 0.57) / 0.38))); add({ id: 'topping', topping: TOPPING_ORDER[i], name: 'Topping Bar', sub: shift.day.toppingChance ? TOPPINGS[TOPPING_ORDER[i]].name : 'opens Day 2' }, A.topping.px, A.topping.pz, 1.3, ready && !c.topping ? 0.3 : 0); }
      add({ id: 'trash', name: 'Trash', sub: 'start over' }, A.trash.px, A.trash.pz, 1.0, -0.3);
      for (const g of shift.customers) { if (g.phase !== 'wait') continue; const s = A.slots[g.slot];
        add({ id: 'serve', cust: g, name: `Guest #${g.slot + 1}`, sub: `${FLAVORS[g.order.syrup].short}${g.order.topping ? ' + ' + TOPPINGS[g.order.topping].name : ''}` }, s.x, A.servePZ, 1.25, ready ? 0.8 + (g.order.syrup === c.syrup && (g.order.topping || null) === (c.topping || null) ? 0.4 : 0) : -0.2); }
      cands.sort((a, b) => a.score - b.score); return cands[0] || null;
    }

    // ---------- actions ----------
    function pourFx(flavor) {
      const a = A.bottles.find(b => b.f === flavor), col = FLAVORS[flavor].color;
      const b = stand.bottles[flavor]; stand.punch(b, 0.12);
      stand.burst(a.x + 0.2, a.y + 1.0, a.z + 0.2, { color: [col, '#ffffff'], n: 16, speed: 1.2, up: 1.5, size: 0.14, life: 0.7 });
      const hp = avatar.root.localToWorld(new THREE.Vector3(0, 2.0, 0.8)); stand.burst(hp.x, hp.y, hp.z, { color: col, n: 18, speed: 1.6, up: 2, size: 0.16 });
    }
    function act(k) {
      if (mode !== 'open' || paused || !shift) return;
      if (k === 'trash') { shift.trash(); return; }
      if (k === 'serve' && target?.cust) { shift.serve(target.cust.id); return; }
      if (k.startsWith('f:')) { if (pourLock > 0) return; const d = shift.pour(k.slice(2)); if (d >= 0) pourLock = d; return; }
      if (k.startsWith('t:')) { shift.top(k.slice(2)); return; }
      if (k === 'use') {
        if (!target) return;
        if (target.id === 'syrup') act('f:' + target.flavor);
        else if (target.id === 'topping') act('t:' + target.topping);
        else if (target.id === 'trash') act('trash');
        else if (target.id === 'serve') act('serve');
      }
    }
    function handleEvents() {
      for (const e of shift.drain()) {
        switch (e.type) {
          case 'order': audio.play('sfx_order_ding'); customers.popBubble(e.c.id); break;
          case 'iceFull': { audio.play('sfx_ice_crunch', { gain: 0.8, rate: 1.2 }); const hp = avatar.root.localToWorld(new THREE.Vector3(0, 2.0, 0.8)); stand.burst(hp.x, hp.y, hp.z, { color: '#ffffff', n: 14, speed: 1.5, up: 2 }); break; }
          case 'pour': audio.play('sfx_syrup_pour'); pourFx(e.flavor); break;
          case 'top': { audio.play('sfx_order_ding', { gain: 0.35, rate: 1.6 }); const hp = avatar.root.localToWorld(new THREE.Vector3(0, 2.1, 0.8)); stand.burst(hp.x, hp.y, hp.z, { color: [TOPPINGS[e.topping].color, '#ffd23f', '#ff6fb5'], n: 16, speed: 1.4, up: 2, size: 0.12 }); break; }
          case 'trash': audio.play('sfx_place_machine', { gain: 0.45, rate: 0.7 }); break;
          case 'grab': break;
          case 'paid': {
            audio.play('sfx_serve'); setTimeout(() => { if (!disposed) audio.sale(); }, 180);
            const head = customers.headOf(e.c.id);
            if (head) { stand.burst(head.x, head.y, head.z, { color: ['#ffd23f', '#7fe3ff', '#ff7eb6', FLAVORS[e.c.order.syrup].color], n: 26, speed: 2.6, up: 3, size: 0.2 });
              const [x, y, vis] = toScreen(head); if (vis) { ui.floatText(`+${e.value}${e.tip ? ` (+${e.tip} tip)` : ''}`, x - 34, y - 30); ui.coinArc(x, y, 4 + Math.min(6, e.tip)); if (e.combo >= 3) ui.floatText(`Combo ×${e.combo}!`, x - 30, y - 64, '#ff7eb6'); } }
            break;
          }
          case 'wrong': audio.play('sfx_reject'); ui.flashWhy(`Wrong cone! They want ${FLAVORS[e.c.order.syrup].name}${e.c.order.topping ? ' + ' + TOPPINGS[e.c.order.topping].name : ''}`); break;
          case 'timeout': audio.play('sfx_reject'); ui.banner(e.strikes >= 3 ? 'Out of hearts!' : 'A guest walked off!', `${Math.max(0, 3 - e.strikes)} ❤️ left`, 1400); break;
          case 'deny': audio.play('sfx_reject', { gain: 0.35, minGap: 0.4 }); ui.flashWhy(e.why); break;
          case 'closing': audio.play('sfx_order_ding', { rate: 0.8 }); ui.banner('Closing time!', 'Serve the last guests', 1600); break;
        }
      }
    }
    function buttons() {
      const out = [], c = shift.cone;
      if (!target) { if (c) out.push({ key: 'trash', label: 'Trash cone', cls: 'wide gray' }); return out; }
      if (target.id === 'syrup') FLAVOR_ORDER.forEach((f, i) => { if (shift.day.flavors.includes(f)) out.push({ key: 'f:' + f, label: FLAVORS[f].short, img: icons[f], kbd: String(i + 1), off: !c || c.ice < 1 || !!c.syrup }); });
      else if (target.id === 'topping' && shift.day.toppingChance) TOPPING_ORDER.forEach((t, i) => out.push({ key: 't:' + t, label: TOPPINGS[t].name.replace('Mini ', ''), img: icons['t_' + t], kbd: String((i + 7) % 10), cls: 'pink', off: !c || !c.syrup || !!c.topping }));
      else if (target.id === 'serve') out.push({ key: 'serve', label: `Serve guest #${target.cust.slot + 1}`, img: icons[target.cust.order.syrup], kbd: 'E', cls: 'wide pink', off: !c || !c.syrup });
      else if (target.id === 'shaver') out.push({ key: 'noop', label: getDeviceMode() === 'mobile' ? 'Hold USE to shave' : 'Hold E to shave', img: icons.ice, cls: 'wide', off: !!c && (c.ice >= 1 || !!c.syrup) });
      if (c && target.id !== 'trash') out.push({ key: 'trash', label: 'Trash', cls: 'gray' });
      if (target.id === 'trash') out.push({ key: 'trash', label: 'Trash cone', cls: 'wide gray', off: !c });
      return out;
    }
    function hint() {
      const c = shift.cone;
      if (!c || c.ice < 1) return '① Shave ice at the shaver (left)';
      if (!c.syrup) return '② Pour the syrup a guest wants';
      if (shift.day.toppingChance && !c.topping && shift.customers.some(x => x.phase === 'wait' && x.order.syrup === c.syrup && x.order.topping)) return '③ Topping bar (right) — or serve now';
      return '④ Step to the counter and serve the match';
    }

    // ---------- input (engine.input only) ----------
    const pressed = (code) => input.down(code) && !prevKeys.has(code);
    function readInput(dt) {
      if (pressed('KeyP') || (pressed('Escape') && (mode === 'open' || mode === 'countdown'))) togglePause();
      if (mode === 'hub' && pressed('Enter')) startDay(selected);
      stand.shaving.on = false;
      if (mode === 'open' && !paused && shift) {
        const useDown = input.down('KeyE');
        if (target?.id === 'shaver' && useDown) {
          const on = shift.shave(dt); stand.shaving.on = on;
          if (on) { crunchT -= dt; if (crunchT <= 0) { audio.play('sfx_ice_crunch', { minGap: 0.2 }); crunchT = 0.42; }
            shaveFx -= dt; if (shaveFx <= 0) { shaveFx = 0.05; stand.burst(A.shaver.x, A.set ? 2.2 : 1.5, A.shaver.z + 0.4, { color: '#ffffff', n: 3, speed: 0.8, up: 0.6, size: 0.1, life: 0.6, grav: 2 }); } }
        } else crunchT = 0;
        if (pressed('KeyE') && target?.id !== 'shaver') act('use');
        DIGITS.forEach((d, i) => { if (pressed(d)) act('f:' + FLAVOR_ORDER[i]); });
        TOP_KEYS.forEach((d, i) => { if (pressed(d) && (target?.id === 'topping')) act('t:' + TOPPING_ORDER[i]); });
        if (pressed('KeyX')) act('trash');
      }
      prevKeys = new Set(input.keys);
    }

    // ---------- game object ----------
    const game = {
      scene, collision: stand.collision, occluders: stand.occluders,
      spawn: A.spawn.clone(), spawnFacing: Math.PI, maxCamDist: 15,
      update(dt, t) {
        dt *= timeScale; pourLock = Math.max(0, pourLock - dt);
        audio.tick();
        target = (mode === 'open' || mode === 'countdown') ? pickTarget() : null;
        readInput(dt);
        if (mode === 'countdown' && !paused) {
          countdown -= dt; const n = Math.ceil(countdown - 0.2);
          if (n < lastCount && n >= 1) { lastCount = n; ui.banner(String(n), `Day ${shift.day.n} · ${shift.day.name}`, 800); audio.play('sfx_order_ding', { gain: 0.3, rate: 1.4 }); }
          if (countdown <= 0) { mode = 'open'; ui.banner('Open!', 'Here come the tourists', 1100); audio.play('sfx_customer_happy'); }
        }
        if (mode === 'open' && !paused && shift) { shift.update(dt); handleEvents(); if (shift.over) endDay(); }
        stand.update(dt, t);
        const inShift = shift && (mode === 'open' || mode === 'countdown');
        customers.update(dt, shift && mode !== 'hub' ? shift.customers : [], t);
        // held cone + carry pose
        const cone = inShift ? shift.cone : null;
        held.userData.set(cone);
        if (cone) { avatar.bones.armR.rotation.x = -1.3; avatar.bones.armR.rotation.z = 0; held.position.y = 1.35 + Math.sin(t * 6) * 0.02; }
        if (inShift) {
          ui.setStatus(shift); ui.setHeld(shift.cone);
          ui.setActions(target && mode === 'open' ? target : null, mode === 'open' ? buttons() : [], mode === 'open' ? hint() : 'Get ready…');
          const waiting = shift.customers.filter(c => c.phase === 'wait').length;
          audio.setMusic(mode === 'open' && (waiting >= 2 || shift.left < 30) ? 'busy' : 'lobby');
        }
        // highlight queue stools for waiting guests
        stand.queueStools.forEach((s, i) => { const w = shift?.customers.find(c => c.slot === i && c.phase === 'wait'); s.material.emissiveIntensity = w ? 0.6 + Math.sin(t * 6) * 0.3 * (w.patience / w.maxPatience < 0.3 ? 2 : 0.4) : 0.2; if (w) s.material.emissive.set(w.patience / w.maxPatience < 0.3 ? '#ff4d5e' : '#4fd2ff'); });
      },
      dispose() {
        disposed = true;
        audio.stop(); ui.dispose(); customers.dispose(); disposeCustomerCaches();
        avatar.root.remove(held); bag.dispose();
        avatar.bones.armL.rotation.set(0, 0, 0); avatar.bones.armR.rotation.set(0, 0, 0);
        stand.dispose();
        engine.camera.far = camFar; engine.camera.updateProjectionMatrix(); engine.renderer.toneMappingExposure = exposure;
        player.camPitch = prevCam.pitch; player.camDist = prevCam.dist;
        if (engine.snowcone === hooks) delete engine.snowcone;
      },
    };
    // Read-only QA hooks + the same actions a player has.
    const hooks = engine.snowcone = {
      get mode() { return mode; }, get shift() { return shift; }, get save() { return save; }, get target() { return target?.id || null; },
      get rewardPaid() { return rewardPaid; }, get musicPlaying() { return audio.playing; }, get buffers() { return Object.keys(audio.buffers); },
      startDay, act, buy: (id) => doBuy(id), togglePause, anchors: A, get usingSet() { return A.set; }, player,
      setTimeScale(v) { if (testMode) timeScale = Math.max(0.1, Math.min(20, +v || 1)); },
    };
    if (testMode) window.__sct = hooks; // ?sctest=1 only, for headless QA
    showHub();
    return game;
  },
};
