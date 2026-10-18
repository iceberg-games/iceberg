// Game: Corner Bakery Rush. Run a cosy corner bakery on a snowy morning:
// bake, fry, frost and brew to fill customers' orders before they lose patience.
// Three days, 1-3 stars each, and a one-time Birg Bucks reward the first time
// each day is cleared (persisted per profile in economy.saveGameData).
//
// Module map: config.js (numbers + save helpers), logic.js (pure rules),
// shop.js (3D scene), props.js (Kenney CC0 models, see CREDITS.md),
// customers.js (NPCs), audio.js (procedural music/SFX), ui.js (HUD), thumb.js.
import * as THREE from 'three';
import { GAME_ID, DAYS, ITEMS, BURN_AFTER, REWARD_SOURCE, normalizeSave, mergeSaves, finishDay, dayUnlocked } from './config.js';
import { Shift } from './logic.js';
import { buildShop, STATIONS, SLOT_X, SLOT_Z } from './shop.js';
import { loadProps, prop, renderIcons } from './props.js';
import { Customers, disposeCustomerCaches } from './customers.js';
import { BakeryAudio } from './audio.js';
import { BakeryUI } from './ui.js';
import { drawThumb } from './thumb.js';
import { drawChalkboard } from './textures.js';
import { getDeviceMode } from '../../core/device.js';

const REACH = 1.75;             // how close the baker must stand to use a station
const SPAWN = new THREE.Vector3(-1.2, 0, -3.4);
// high three-quarter view: kitchen in front of the baker, customers at the counter below
const CAM_PITCH = 0.92, CAM_DIST = 11.5;
const ICON_LIST = [
  ['loaf', 'loaf'], ['baguette', 'loaf-baguette'], ['croissant', 'croissant'], ['donut', 'donut'],
  ['donutChoc', 'donut-chocolate'], ['donutSprk', 'donut-sprinkles'], ['coffee', 'cup-coffee'],
  ['cookie', 'cookie-chocolate'], ['cupcake', 'cupcake'], ['muffin', 'muffin'], ['cake', 'cake-birthday'],
  ['burnt', 'loaf', '#3a2a22'],
];
const BURNT_TINT = new THREE.Color('#2a1d16');
let thumbCache = null;

// ---------- per-profile save ----------
function persist(economy, save) {
  if (typeof economy.saveGameData === 'function') return economy.saveGameData(GAME_ID, save);
  economy.profile.gameData = { ...(economy.profile.gameData || {}), [GAME_ID]: save };
  economy.backend?.saveProfile?.(economy.profile);
  return Promise.resolve({ ok: true });
}

/** A small floating progress badge (canvas sprite) above a station. */
class Badge {
  constructor(root, pos, icons) {
    this.cv = document.createElement('canvas'); this.cv.width = this.cv.height = 128;
    this.tex = new THREE.CanvasTexture(this.cv); this.tex.colorSpace = THREE.SRGBColorSpace;
    this.mat = new THREE.SpriteMaterial({ map: this.tex, depthTest: false, transparent: true });
    this.s = new THREE.Sprite(this.mat); this.s.scale.set(0.95, 0.95, 1); this.s.position.set(...pos); this.s.renderOrder = 10; this.s.visible = false;
    this.base = pos[1]; root.add(this.s); this.icons = icons; this.key = '';
  }
  set(state, item, f, burnF, t) {
    if (state === 'idle' || !item) { this.s.visible = false; this.key = ''; return; }
    this.s.visible = true;
    const bob = state === 'ready' ? Math.abs(Math.sin(t * 5)) * 0.12 : 0; this.s.position.y = this.base + bob;
    const key = `${state}|${item}|${Math.round(f * 40)}|${Math.round(burnF * 30)}`;
    if (key === this.key) return; this.key = key;
    const g = this.cv.getContext('2d'); g.clearRect(0, 0, 128, 128);
    g.fillStyle = state === 'burnt' ? '#3b2b25' : '#fffaf0'; g.beginPath(); g.arc(64, 64, 50, 0, 7); g.fill();
    g.lineWidth = 11; g.lineCap = 'round';
    g.strokeStyle = 'rgba(0,0,0,.12)'; g.beginPath(); g.arc(64, 64, 52, 0, 7); g.stroke();
    if (state === 'busy') { g.strokeStyle = '#f39c12'; g.beginPath(); g.arc(64, 64, 52, -Math.PI / 2, -Math.PI / 2 + f * Math.PI * 2); g.stroke(); }
    else if (state === 'ready') {
      g.strokeStyle = '#2fbf5a'; g.beginPath(); g.arc(64, 64, 52, 0, 7); g.stroke();
      if (burnF > 0) { g.strokeStyle = burnF > 0.6 ? '#e74c3c' : '#ff9f43'; g.lineWidth = 7; g.beginPath(); g.arc(64, 64, 52, -Math.PI / 2, -Math.PI / 2 + burnF * Math.PI * 2); g.stroke(); }
    } else { g.strokeStyle = '#e74c3c'; g.beginPath(); g.arc(64, 64, 52, 0, 7); g.stroke(); }
    const img = this.icons[state === 'burnt' ? 'burnt' : item];
    if (img?.complete) g.drawImage(img, 22, 22, 84, 84);
    if (state === 'ready') { g.fillStyle = '#2fbf5a'; g.beginPath(); g.arc(104, 22, 18, 0, 7); g.fill(); g.fillStyle = '#fff'; g.font = '900 24px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('✓', 104, 23); }
    if (state === 'burnt') { g.fillStyle = '#e74c3c'; g.beginPath(); g.arc(104, 22, 18, 0, 7); g.fill(); g.fillStyle = '#fff'; g.font = '900 26px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('!', 104, 23); }
    this.tex.needsUpdate = true;
  }
  dispose() { this.tex.dispose(); this.mat.dispose(); }
}

export default {
  id: GAME_ID,
  name: 'Corner Bakery Rush',
  tagline: 'Bake, frost & serve the morning rush',
  description: 'Run a cosy corner bakery on a snowy morning. Bake bread, fry and frost donuts, brew coffee and fill every order before your customers lose patience. 3 days, 3 stars each, and Birg Bucks the first time you clear each day.',
  get thumbnail() { if (!thumbCache) { try { thumbCache = drawThumb(); } catch { thumbCache = 'frost'; } } return thumbCache; },
  music: 'none', // the game plays its own procedural café music through the shared audio output
  features: {},
  mobile: true, // fully playable with the shared joystick + the game's own tap buttons (portal Mobile mode)

  async create(ctx) {
    const { engine, economy, music, avatar } = ctx;
    const player = engine.player;
    await loadProps();

    // ---------- scene ----------
    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog('#f1c9a4', 34, 120);
    const shop = buildShop(); scene.add(shop.root);
    const camFar = engine.camera.far; engine.camera.far = Math.max(camFar, 700); engine.camera.updateProjectionMatrix();
    const exposure = engine.renderer.toneMappingExposure; engine.renderer.toneMappingExposure = 1.05;
    const prevCam = { pitch: player.camPitch, dist: player.camDist };
    player.camPitch = CAM_PITCH; player.camDist = CAM_DIST;

    // item icons (rendered from the same 3D models) for HUD, bubbles and badges
    const icons = renderIcons(engine.renderer, ICON_LIST, 112);
    const iconImgs = {}; for (const [k, url] of Object.entries(icons)) { const im = new Image(); im.src = url; iconImgs[k] = im; }
    const customers = new Customers(scene, icons);
    const badges = {}; for (const id of ['ovenA', 'ovenB', 'fryer', 'coffee']) badges[id] = new Badge(shop.root, STATIONS[id].badge, iconImgs);

    // oven interior props (one per oven, rebuilt when the item changes)
    const ovenProps = { ovenA: null, ovenB: null };
    const setOvenProp = (id, item, burnt) => {
      const o = shop.ovens[id], key = item ? `${item}|${burnt ? 1 : 0}` : '';
      if (o.item === key) return; o.item = key;
      if (ovenProps[id]) { o.inside.remove(ovenProps[id]); ovenProps[id].traverse(n => { if (n.isMesh && n.userData.ownMat) n.material.dispose(); }); ovenProps[id] = null; }
      if (!item) return;
      const p = prop(ITEMS[item].model, item === 'cake' ? 0.7 : item === 'baguette' ? 1.1 : 0.75);
      if (item === 'baguette') p.rotation.y = 0.2;
      if (burnt) p.traverse(n => { if (n.isMesh) { n.material = n.material.clone(); n.material.color.multiply(BURNT_TINT); n.userData.ownMat = true; } });
      p.position.y = 0.02; o.inside.add(p); ovenProps[id] = p;
    };
    let fryerBurnt = false;
    const fryerMats = [];
    const setFryerBurnt = (on) => {
      if (on === fryerBurnt) return; fryerBurnt = on;
      shop.fryer.donuts.traverse(n => {
        if (!n.isMesh) return;
        if (on) { n.userData.orig = n.material; n.material = n.material.clone(); n.material.color.multiply(BURNT_TINT); fryerMats.push(n.material); }
        else if (n.userData.orig) { n.material = n.userData.orig; }
      });
      if (!on) { fryerMats.forEach(m => m.dispose()); fryerMats.length = 0; }
    };

    // things the baker is carrying (attached to the avatar, removed on dispose)
    const held = new THREE.Group(); held.name = 'cbr-held'; avatar.root.add(held);
    let heldKey = '';
    const heldMats = [];
    const setHeld = (hands) => {
      const key = hands.join(); if (key === heldKey) return; heldKey = key;
      held.clear(); heldMats.forEach(m => m.dispose()); heldMats.length = 0;
      hands.forEach((item, i) => {
        const def = ITEMS[item]; const p = prop(def.model, item === 'cake' ? 0.85 : item === 'baguette' ? 1.0 : 0.55);
        if (def.burnt) p.traverse(n => { if (n.isMesh) { n.material = n.material.clone(); n.material.color.multiply(BURNT_TINT); heldMats.push(n.material); } });
        const x = hands.length === 1 ? 0 : (i === 0 ? -0.36 : 0.36);
        p.position.set(x, 1.55, 0.72); held.add(p);
      });
    };

    // ---------- state ----------
    let disposed = false, timeScale = 1;
    const testMode = /[?&]cbrtest=1\b/.test(location.search);
    const rng = testMode ? (() => { let a = 12345; return () => { a = (a * 16807) % 2147483647; return a / 2147483647; }; })() : Math.random;
    let save = normalizeSave(economy.cachedGameData ? economy.cachedGameData(GAME_ID) : economy.profile.gameData?.[GAME_ID]);
    let saveReady = typeof economy.loadGameData !== 'function';
    let selected = Math.min(3, Math.max(1, DAYS.findIndex((d, i) => !save.stars[i]) + 1 || 3));
    let shift = null, mode = 'intro', paused = false, countdown = 0, lastCount = 0, resultShown = false, rewardPaid = 0;
    let target = null, smokeT = 0, steamT = 0, warnT = 0, doorWasOpen = false, lastAudioIntensity = -1;
    const audio = new BakeryAudio(music);
    const ui = new BakeryUI({
      icons,
      onAction: (i) => act(i),
      onPause: () => togglePause(),
      onStartDay: (n, go) => { audio.sfx('ui'); if (go) startDay(n); else { selected = n; showIntro(); } },
    });

    const drawBoard = (day) => {
      const items = []; const seen = new Set();
      for (const [id] of day.menu) if (!seen.has(id)) { seen.add(id); items.push([ITEMS[id].name, ITEMS[id].price]); }
      if (day.cakeAt) items.push([ITEMS.cake.name + ' ★', ITEMS.cake.price]);
      const g = shop.chalk.canvas.getContext('2d'); g.clearRect(0, 0, shop.chalk.canvas.width, shop.chalk.canvas.height);
      drawChalkboard(g, shop.chalk.canvas.width, shop.chalk.canvas.height, day, items.slice(0, 10)); shop.chalk.tex.needsUpdate = true;
    };
    const previewDay = (n) => {
      const d = DAYS[n - 1];
      shop.display.layout(d.display); shop.display.setStock(Object.fromEntries(d.display.map(i => [i, 4])));
      shop.fryer.lock.visible = !d.fryer; shop.frost.lock.visible = !d.fryer;
      drawBoard(d);
    };
    const showIntro = () => { mode = 'intro'; ui.showHud(false); previewDay(selected); ui.showIntro(save, selected, { loading: !saveReady }); };

    if (!saveReady) {
      const p = economy.loadGameData(GAME_ID);
      const timeout = new Promise(r => setTimeout(() => r(undefined), 6000));
      Promise.race([p, timeout]).then((data) => {
        if (disposed) return;
        save = mergeSaves(save, data ?? economy.cachedGameData?.(GAME_ID));
        saveReady = true; if (mode === 'intro') { selected = Math.min(3, Math.max(1, DAYS.findIndex((d, i) => !save.stars[i]) + 1 || 3)); showIntro(); }
      }).catch(() => { saveReady = true; if (!disposed && mode === 'intro') showIntro(); });
    }
    function startDay(n) {
      if (!saveReady || !dayUnlocked(save, n)) return;
      selected = n; const day = DAYS[n - 1];
      shift = new Shift(day, { rng });
      customers.clear(); previewDay(n); setHeld([]); heldKey = '';
      for (const id of ['ovenA', 'ovenB']) setOvenProp(id, null);
      resultShown = false; rewardPaid = 0; paused = false;
      player.teleport(SPAWN, Math.PI); player.camPitch = CAM_PITCH; player.camDist = Math.min(player.maxCamDist, CAM_DIST); player.updateCamera();
      ui.hideCard(); ui.showHud(true); ui.setStatus(shift); ui.setTickets([]);
      mode = 'countdown'; countdown = 3.2; lastCount = 4;
    }
    function togglePause() {
      if (mode !== 'open' && mode !== 'countdown') return;
      paused = !paused; audio.sfx('ui');
      if (paused) ui.showPause({ onResume: () => togglePause(), onQuit: () => { paused = false; ui.hideCard(); shift = null; customers.clear(); setHeld([]); showIntro(); } });
      else ui.hideCard();
    }
    function act(i) {
      if (mode !== 'open' || paused || !shift || !target) return;
      shift.act(target.id, i);
    }
    function endDay() {
      if (resultShown || !shift) return; resultShown = true;
      const d = shift.day.n;
      const r = finishDay(save, d, shift.score, { failed: shift.failed });
      save = r.save;
      persist(economy, save);                 // record the claim first, so a reload can never pay twice
      if (r.reward > 0) { economy.earn(r.reward, `Corner Bakery Rush: Day ${d} cleared`, { source: REWARD_SOURCE }); rewardPaid = r.reward; }
      mode = 'result'; ui.showHud(false); setHeld([]);
      audio.sfx(r.stars > 0 ? (d === 3 ? 'fanfare' : 'clear') : 'fail');
      if (r.stars > 0) ui.confettiBurst(d === 3 ? 140 : 70);
      ui.showResult({ day: d, score: shift.score, tips: shift.tips, served: shift.served, lost: shift.lost, stars: r.stars, failed: shift.failed, reward: r.reward, newBest: r.newBest && shift.score > 0, best: save.best[d - 1], onStar: () => audio.sfx('star') });
    }

    // ---------- input ----------
    const onKey = (e) => {
      if (e.repeat || e.target?.tagName === 'INPUT' || e.target?.tagName === 'TEXTAREA') return;
      if (e.code === 'KeyP' || (e.code === 'Escape' && (mode === 'open' || mode === 'countdown'))) { togglePause(); e.preventDefault(); return; }
      if (mode === 'intro' && (e.code === 'Enter')) { startDay(selected); return; }
      if (e.code === 'KeyE' || e.code === 'Digit1') act(0);
      else if (e.code === 'Digit2') act(1); else if (e.code === 'Digit3') act(2); else if (e.code === 'Digit4') act(3);
    };
    window.addEventListener('keydown', onKey);
    const onVis = () => { if (document.hidden && mode === 'open' && !paused) togglePause(); };
    document.addEventListener('visibilitychange', onVis);

    // ---------- helpers ----------
    const tmpV = new THREE.Vector3();
    const toScreen = (v) => { tmpV.copy(v).project(engine.camera); const r = engine.renderer.domElement.getBoundingClientRect(); return [r.left + (tmpV.x + 1) / 2 * r.width, r.top + (1 - tmpV.y) / 2 * r.height, tmpV.z < 1]; };
    const nameOf = (id) => STATIONS[id]?.name || id;
    function pickTarget() {
      if (!shift) return null;
      const p = player.pos; let best = null, bd = REACH;
      for (const [id, s] of Object.entries(STATIONS)) {
        const d = Math.hypot(p.x - s.x, p.z - s.z); if (d < bd) { bd = d; best = { id, x: s.x, z: s.z }; }
      }
      // customers are served across the front counter (stand behind it at z ≈ -2)
      for (const c of shift.customers) {
        if (c.phase !== 'wait') continue;
        const x = SLOT_X[c.slot], d = Math.hypot(p.x - x, (p.z - -2.05) * 1.4);
        if (d < bd + 0.15) { bd = d - 0.15; best = { id: `cust:${c.id}`, x, z: SLOT_Z, cust: c }; }
      }
      return best;
    }
    function subLabel(id) {
      if (id.startsWith('cust:')) { const c = shift.customers.find(x => `cust:${x.id}` === id); return c ? `wants ${c.order.map(o => ITEMS[o].name).join(' + ')}` : ''; }
      const s = shift.stations[id]; if (!s) return '';
      if (s.locked) return 'locked';
      if (s.state === 'busy') return `${Math.max(0, Math.ceil(s.cook - s.t))}s`;
      if (s.state === 'ready') return BURN_AFTER[s.item] != null ? 'Ready! Take it out' : 'Ready!';
      if (s.state === 'burnt') return 'Burnt!';
      return '';
    }

    function handleEvents() {
      for (const e of shift.drain()) {
        switch (e.type) {
          case 'ready': audio.sfx('ding'); { const s = STATIONS[e.station]; shop.emitPuff(s.x, 2.3, -5.8, { color: '#ffffff', size: 0.8, life: 1.3 }); } break;
          case 'burnt': audio.sfx('buzzer'); ui.banner_('Burnt!', `${nameOf(e.station)} — toss it in the trash`, 1400); break;
          case 'start': audio.sfx(e.station === 'fryer' ? 'fry' : e.station === 'coffee' ? 'brew' : 'start'); break;
          case 'take': audio.sfx(e.item === 'burnt' ? 'deny' : 'pickup'); break;
          case 'frost': audio.sfx('frost'); break;
          case 'trash': audio.sfx('trash'); break;
          case 'give': audio.sfx('give'); break;
          case 'paid': {
            audio.sfx('chaching'); audio.sfx('happy');
            const head = customers.headOf(e.c.id); if (head) { const [x, y, vis] = toScreen(head); if (vis) ui.floatText(`+${e.value}${e.tip ? ` (+${e.tip} tip)` : ''}`, x - 30, y - 30); }
            break;
          }
          case 'leave': if (e.mood === 'angry') audio.sfx('angry'); break;
          case 'strike': ui.banner_(e.strikes >= 3 ? 'Out of hearts!' : 'A customer walked out!', `${3 - e.strikes} ❤️ left`, 1500); break;
          case 'deny': audio.sfx('deny'); ui.flashWhy(e.why); break;
          case 'closing': audio.sfx('closing'); ui.banner_('Closing time!', 'finishing up…', 1800); break;
          case 'end': break;
        }
      }
    }

    function updateStations(t, dt) {
      const st = shift ? shift.stations : null;
      let glowSum = 0;
      for (const id of ['ovenA', 'ovenB']) {
        const s = st?.[id], o = shop.ovens[id];
        const state = s?.state || 'idle';
        let glow = 0.12, lamp = 0, lampCol = '#40ff7a';
        if (state === 'busy') { glow = 0.7 + 0.8 * (s.t / s.cook) + Math.sin(t * 9) * 0.05; lamp = 0.9; lampCol = '#ffb030'; }
        else if (state === 'ready') { glow = 1.6 + Math.sin(t * 7) * 0.2; lamp = 2.5 + Math.sin(t * 10) * 1.2; }
        else if (state === 'burnt') { glow = 0.5; lamp = Math.sin(t * 12) > 0 ? 3 : 0.3; lampCol = '#ff3020'; }
        o.glowMat.emissiveIntensity += (glow - o.glowMat.emissiveIntensity) * Math.min(1, dt * 5);
        o.lampMat.emissive.set(lampCol); o.lampMat.emissiveIntensity = lamp;
        glowSum += Math.max(0, o.glowMat.emissiveIntensity - 0.12);
        setOvenProp(id, state === 'idle' ? null : s.item, state === 'burnt');
        if (state === 'burnt' && smokeT <= 0) shop.emitPuff(o.x + (Math.random() - 0.5) * 0.8, 2.6, -5.5, { color: '#4a4440', size: 0.9, life: 2.2, rise: 1.2 });
      }
      shop.ovenLight.intensity = glowSum * 2.2;
      // fryer
      const f = st?.fryer, fs = f?.state || 'idle';
      shop.fryer.donuts.visible = fs !== 'idle'; setFryerBurnt(fs === 'burnt');
      if (fs !== 'idle') shop.fryer.donuts.position.y = 1.05 + 0.2 + (fs === 'busy' ? Math.sin(t * 6) * 0.015 : 0.03);
      const bub = shop.fryer.bubbles, bs = shop.fryer.bubState, m4 = new THREE.Matrix4();
      const nb = fs === 'busy' ? 24 : fs === 'ready' ? 10 : fs === 'burnt' ? 6 : 3;
      for (let i = 0; i < nb; i++) { const b = bs[i]; b.t = (b.t + dt * (fs === 'busy' ? 2.2 : 0.8)) % 1; const sc = Math.sin(b.t * Math.PI) * 1.2; m4.makeScale(sc, sc, sc).setPosition(b.x, 0.01 + b.t * 0.04, b.z); bub.setMatrixAt(i, m4); }
      bub.count = nb; bub.instanceMatrix.needsUpdate = true;
      shop.fryer.oilMat.emissiveIntensity = fs === 'busy' ? 0.8 + Math.sin(t * 8) * 0.1 : 0.45;
      if (fs === 'burnt' && smokeT <= 0) shop.emitPuff(-1.8 + (Math.random() - 0.5), 1.6, -6.3, { color: '#4a4440', size: 0.8, life: 2, rise: 1.1 });
      if (fs === 'busy' && steamT <= 0) shop.emitPuff(-1.8 + (Math.random() - 0.5) * 1.2, 1.4, -6.3, { color: '#fff6e0', size: 0.45, life: 1.1, rise: 0.8 });
      // coffee
      const c = st?.coffee, cs = c?.state || 'idle';
      shop.coffee.cup.visible = cs !== 'idle';
      if (cs === 'busy' && steamT <= 0) shop.emitPuff(3.4, 1.9, -6.0, { color: '#ffffff', size: 0.5, life: 1.2 });
      if (cs === 'ready' && steamT <= 0 && Math.random() < 0.4) shop.emitPuff(3.4, 1.45, -6.0, { color: '#ffffff', size: 0.3, life: 1.2, rise: 0.5 });
      // display
      if (st) shop.display.setStock(st.display.stock);
      // badges
      for (const id of ['ovenA', 'ovenB', 'fryer', 'coffee']) {
        const s = st?.[id]; if (!s) { badges[id].set('idle'); continue; }
        const burn = BURN_AFTER[s.item];
        const burnF = s.state === 'ready' && burn != null ? Math.min(1, (s.t - s.cook) / burn) : 0;
        badges[id].set(s.state, s.item, s.cook ? Math.min(1, s.t / s.cook) : 0, burnF, t);
        // warn ping when something is about to burn
        if (burnF > 0.7 && warnT <= 0) { audio.sfx('warn'); warnT = 1.2; }
      }
      if (smokeT <= 0) smokeT = 0.18; if (steamT <= 0) steamT = 0.22;
    }

    function updateDoor() {
      let near = false;
      for (const v of customers.views.values()) { const p = v.root.position; if (Math.abs(p.x) < 2.2 && Math.abs(p.z - 7.1) < 1.8) { near = true; break; } }
      shop.door.target = near ? 1 : 0;
      if (near && !doorWasOpen) audio.sfx('doorbell');
      doorWasOpen = near;
    }

    // ---------- game object ----------
    const game = {
      scene,
      collision: shop.collision,
      occluders: shop.occluders,
      spawn: SPAWN.clone(), spawnFacing: Math.PI,
      maxCamDist: 13,
      update(dt, t) {
        dt *= timeScale;
        smokeT -= dt; steamT -= dt; warnT -= dt;
        audio.start();
        shop.update(dt, t);
        if (mode === 'countdown' && !paused) {
          countdown -= dt; const n = Math.ceil(countdown - 0.2);
          if (n < lastCount && n >= 1) { lastCount = n; ui.banner_(String(n), `Day ${shift.day.n} · ${shift.day.name}`, 800); audio.sfx('tick'); }
          if (countdown <= 0) { mode = 'open'; ui.banner_('Open!', 'Here come the customers', 1100); audio.sfx('go'); }
        }
        if (mode === 'open' && !paused && shift) {
          shift.update(dt); handleEvents();
          if (shift.over) endDay();
        }
        // carrying pose: lift both arms forward while holding something (after the shared walk animation)
        const hands = shift && mode !== 'result' && mode !== 'intro' ? shift.hands : [];
        setHeld(hands);
        if (hands.length) { avatar.bones.armL.rotation.x = -1.2; avatar.bones.armR.rotation.x = -1.2; avatar.bones.armL.rotation.z = 0; avatar.bones.armR.rotation.z = 0; }
        customers.update(dt, shift && mode !== 'intro' ? shift.customers : []);
        updateDoor();
        updateStations(t, dt);
        // target + HUD
        target = mode === 'open' || mode === 'countdown' ? pickTarget() : null;
        shop.ring.visible = !!target && mode === 'open';
        if (target) { shop.ring.position.x = target.x; shop.ring.position.z = target.cust ? SLOT_Z : target.z + 0.2; }
        if (shift && mode !== 'intro' && mode !== 'result') {
          ui.setStatus(shift); ui.setTickets(shift.customers);
          const acts = target && mode === 'open' ? shift.actions(target.id) : [];
          ui.setActions(shift.hands, target && mode === 'open' ? { id: target.id, name: target.cust ? `Customer #${target.cust.slot + 1}` : nameOf(target.id), sub: subLabel(target.id) } : null, acts, getDeviceMode() !== 'mobile');
        }
        // music intensity follows the rush
        let inten = 0;
        if (shift && mode === 'open') { const waiting = shift.customers.filter(c => c.phase === 'wait').length; inten = Math.min(1, waiting / 4 + (shift.left < 30 ? 0.5 : 0)); }
        if (Math.abs(inten - lastAudioIntensity) > 0.05) { audio.setIntensity(inten); lastAudioIntensity = inten; }
        // wall clock hands follow the day
        if (shop.chalk.clock && shift) { const f = shift.time / shift.day.length; shop.chalk.clock.hand.rotation.x = -(6 + f * 3) / 12 * Math.PI * 2; shop.chalk.clock.hand2.rotation.x = -f * 3 * Math.PI * 2; }
      },
      dispose() {
        disposed = true;
        window.removeEventListener('keydown', onKey); document.removeEventListener('visibilitychange', onVis);
        audio.stop(); ui.dispose(); customers.dispose(); disposeCustomerCaches();
        avatar.root.remove(held); held.clear(); heldMats.forEach(m => m.dispose()); fryerMats.forEach(m => m.dispose());
        avatar.bones.armL.rotation.set(0, 0, 0); avatar.bones.armR.rotation.set(0, 0, 0);
        for (const id of ['ovenA', 'ovenB']) setOvenProp(id, null);
        Object.values(badges).forEach(b => b.dispose());
        shop.dispose();
        engine.camera.far = camFar; engine.camera.updateProjectionMatrix(); engine.renderer.toneMappingExposure = exposure;
        player.camPitch = prevCam.pitch; player.camDist = prevCam.dist;
        if (engine.game === game) delete engine.bakery;
      },
    };
    // Inspection hooks for automated QA (read-only state + the same actions a player has).
    engine.bakery = {
      get mode() { return mode; }, get shift() { return shift; }, get save() { return save; }, get target() { return target?.id || null; },
      get rewardPaid() { return rewardPaid; }, get musicPlaying() { return !!audio.timer; }, get saveReady() { return saveReady; }, get paused() { return paused; },
      startDay, act, togglePause, stations: STATIONS, slotX: SLOT_X,
      // ?cbrtest=1 only: run game time faster so headless (software GL) QA can finish a day
      setTimeScale(v) { if (testMode) timeScale = Math.max(0.1, Math.min(20, +v || 1)); },
    };
    showIntro();
    return game;
  },
};
