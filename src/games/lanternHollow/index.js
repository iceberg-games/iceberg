// Game: Lantern Hollow — co-op action RPG / dungeon adventure (GM1, final Iceberg batch). NOT published.
// Explore > fight > loot embers/gear > return to Frostlight Village > upgrade > take harder quests.
// Areas: Frostlight Village (hub), Glowroot Caves, Sunken Mine, Aurora Throne — one shared coordinate space (areas.js).
// Multiplayer: host-authoritative enemies per occupied area over the platform mp API (net.js, brief §9).
// Design: /workspace/iceberg-game-maker/designs/lantern-hollow-brief.md
// Phase 1 scaffold: village hub, lantern-lit player, NPC/waystone interactions (placeholders), HUD, save, net adapter.
// Modules: config.js (numbers/save/rewards), areas.js, net.js, audio.js, ui.js, thumb.js, world/ (common, village).
import * as THREE from 'three';
import { Collision } from '../../engine/collision.js';
import { getDeviceMode } from '../../core/device.js';
import { GAME_ID, GAME_NAME, QUESTS, normalizeSave, mergeSaves, statsFor } from './config.js';
import { AREAS, areaAt } from './areas.js';
import { createNet } from './net.js';
import { HollowAudio } from './audio.js';
import { HollowUI } from './ui.js';
import { drawThumb } from './thumb.js';
import { makeAuroraSky, makeSnow, makeMats, makeLantern } from './world/common.js';
import { buildVillage } from './world/village.js';

let thumbCache = null;
function persist(economy, save) {
  if (typeof economy.saveGameData === 'function') return economy.saveGameData(GAME_ID, save);
  economy.profile.gameData = { ...(economy.profile.gameData || {}), [GAME_ID]: save };
  economy.backend?.saveProfile?.(economy.profile);
  return Promise.resolve({ ok: true });
}
const NPC_LINES = {
  wick: ['Elder Wick', 'The aurora has gone dark, little light-bearer. The Glowroot Caves stir first. Light the Entrance Grotto lamp post and come back to me.'],
  brann: ['Smith Brann', 'Bring me embers and I\'ll make that blade sing. The forge opens once you\'ve got something worth hammering.'],
  ysolde: ['Lamplighter Ysolde', 'A bigger flame keeps the gloom further away. Lantern upgrades and Flares, as soon as you bring me embers.'],
  moss: ['Apothecary Moss', 'Glowberry tonics, lantern oil, and a sturdier heart. My shelves are almost stocked.'],
  board: ['Quest Board', 'Notices flutter in the cold: "Slime Time — 15 Glimmer Slimes", "Spore Sweep", "Hidden Veins"… The quest log opens in the next build.'],
  hearth: ['Great Hearth Lantern', 'The village\'s great flame burns low. Feed it embers to Rekindle the Hollow.'],
  waystone: ['Waystone', 'The rune for Glowroot Caves hums softly. The caves open in the next build.'],
};

export default {
  id: GAME_ID,
  name: GAME_NAME,
  tagline: 'Carry the light into the dark — together',
  description: 'The aurora has gone dark and the Hollow Queen\'s gloom creeps into Frostlight Village. Grab your lantern and blade, then dive into glowing caves, a flooded mine and the Aurora Throne. Fight telegraphed foes, collect embers, forge upgrades and take on quests. Play solo or with friends, and revive each other when the light gutters.',
  get thumbnail() { if (!thumbCache) { try { thumbCache = drawThumb(); } catch { thumbCache = 'frost'; } } return thumbCache; },
  music: 'none', // plays its own Sound-designed loops through the shared audio output
  features: {},
  mobile: true,  // shared joystick + jump, plus the game's own ⚔ / DASH / FLARE / E buttons

  async create(ctx) {
    const { engine, economy, music, avatar } = ctx;
    const player = engine.player, input = engine.input, renderer = engine.renderer, camera = engine.camera;
    const mobile = getDeviceMode() === 'mobile';
    const testMode = /[?&]lhtest=1\b/.test(location.search);
    const prev = { exposure: renderer.toneMappingExposure, far: camera.far, pitch: player.camPitch, dist: player.camDist };

    // ---------- scene ----------
    const scene = new THREE.Scene();
    let area = AREAS.village;
    scene.background = new THREE.Color(area.sky);
    scene.fog = new THREE.Fog(area.fog.color, area.fog.near, area.fog.far);
    renderer.toneMappingExposure = area.exposure;
    camera.far = Math.max(prev.far, 900); camera.updateProjectionMatrix();
    player.camPitch = 0.42; player.camDist = 11;
    scene.add(new THREE.HemisphereLight('#6f7fc8', '#2a2440', 0.7));
    const moon = new THREE.DirectionalLight('#b8c8ff', 0.9); moon.position.set(-30, 50, -20); moon.castShadow = true;
    moon.shadow.mapSize.set(mobile ? 1024 : 2048, mobile ? 1024 : 2048); Object.assign(moon.shadow.camera, { left: -40, right: 40, top: 40, bottom: -40, near: 1, far: 140 }); moon.shadow.bias = -0.0005;
    scene.add(moon, moon.target);
    const sky = makeAuroraSky({ top: '#04061a', horizon: '#1e2a5c', strength: 0.9 }); scene.add(sky.mesh);
    const snow = makeSnow(mobile ? 300 : 900); scene.add(snow.points);
    const village = buildVillage({ mobile }); scene.add(village.group);

    // ---------- collision ----------
    const b = area.bounds;
    const collision = new Collision({ floorY: 0, bounds: { type: 'box', minX: b.minX, maxX: b.maxX, minZ: b.minZ, maxZ: b.maxZ } });
    village.colliders(collision);

    // ---------- player lantern (left hand) + light ----------
    const mats = makeMats();
    const handLantern = makeLantern(mats, 1.25);
    const armL = avatar.bones?.armL, armLen = avatar.bodySlots?.limbs?.arm?.[1] || 1;
    if (armL) { handLantern.position.set(0, -armLen - 0.22, 0.05); armL.add(handLantern); }
    const lanternLight = new THREE.PointLight('#ffb35a', 14, 12, 1.6); lanternLight.castShadow = false; scene.add(lanternLight);

    // ---------- state, save, net, audio, ui ----------
    let save = normalizeSave(economy.cachedGameData?.(GAME_ID) ?? economy.profile?.gameData?.[GAME_ID]);
    economy.loadGameData?.(GAME_ID)?.then?.((d) => { if (d && !disposed) save = mergeSaves(save, d); }).catch?.(() => {});
    let dirty = false, saveT = 0, disposed = false;
    const stats = () => statsFor(save);
    const me = { hp: stats().hearts * 2, glow: stats().glow, carried: 0 };
    const net = createNet(engine);
    const party = new Map();
    net.onState('party', (p) => { party.clear(); for (const [id, v] of Object.entries(p || {})) party.set(id, v); });
    net.onEvent('at', (pl, meta) => { if (!net.isHost()) return; const cur = { ...Object.fromEntries(party) }; cur[meta?.from || pl?.id || 'local'] = { area: pl.area, power: pl.power | 0, down: !!pl.down }; net.setState('party', cur); });
    const announce = () => net.sendEvent('at', { area: area.id, power: stats().power, down: false });
    net.onPlayersChanged?.(() => announce());
    net.onHostChanged?.(() => announce());
    announce();

    const audio = new HollowAudio(music); audio.setArea(area.id);
    let panelFor = null;
    const ui = new HollowUI({ engine, onTap: (k) => taps.add(k), onClosePanel: () => { panelFor = null; audio.play('sfx_ui_close'); } });
    ui.banner(area.name, 'The great hearth burns low…', 3200);

    // keep the platform's rocket flight (F) out of this game: swallow KeyF before engine.input sees it
    const blockF = (e) => { if (e.code === 'KeyF') e.stopImmediatePropagation(); };
    addEventListener('keydown', blockF, true);

    // ---------- interactions + light swing ----------
    let prevKeys = new Set(), swing = 0;
    const taps = new Set(); const onKey = (e) => { if (!e.repeat) taps.add(e.code); };   // quick taps between frames still count
    input.onKey(onKey);
    const pressed = (c) => taps.has(c) || (input.down(c) && !prevKeys.has(c));
    function nearestInteractable() {
      let best = null, bd = Infinity;
      for (const it of village.interactables) { const d = Math.hypot(player.pos.x - it.x, player.pos.z - it.z); if (d < it.r && d < bd) { bd = d; best = it; } }
      return best;
    }
    function interact(it) {
      const [title, body] = NPC_LINES[it.id] || [it.name, '…'];
      panelFor = it.id; ui.openPanel(title, body); audio.play(it.id === 'waystone' ? 'sfx_waystone_travel' : 'sfx_npc_talk');
    }
    function attack() { if (swing > 0) return; swing = 0.35; audio.playVar('sfx_swing', 3); }

    const tmp = new THREE.Vector3();
    const game = {
      scene, collision, occluders: village.occluders, spawn: new THREE.Vector3(...area.spawn), spawnFacing: area.facing, maxCamDist: 16,
      onFall: () => player.teleport(new THREE.Vector3(...area.spawn), area.facing),
      onClick: ({ button }) => { if (button === 0 && !ui.panelOpen) attack(); },
      update(dt, t) {
        audio.tick();
        // input
        const it = ui.panelOpen ? null : nearestInteractable();
        ui.prompt(it ? `${it.verb} · ${it.name}` : null);
        if (pressed('KeyE') && it) interact(it);
        if (pressed('Escape') && ui.panelOpen) ui.closePanel();
        if (pressed('KeyK')) attack();
        prevKeys = new Set(input.keys); taps.clear();
        player.enabled = !ui.panelOpen;
        // swing pose (overrides the engine's arm swing after it animated this frame)
        if (swing > 0) { swing -= dt; const k = 1 - Math.max(0, swing) / 0.35; const armR = avatar.bones?.armR; if (armR) { armR.rotation.x = -2.6 + k * 3.2; armR.rotation.z = -0.3; } }
        if (armL) armL.rotation.x = -0.45 + Math.sin(t * 2) * 0.03;
        // lantern light follows the hand
        handLantern.getWorldPosition(tmp); lanternLight.position.copy(tmp).add(new THREE.Vector3(0, 0.3, 0));
        lanternLight.intensity = 13 + Math.sin(t * 9) * 0.8 + Math.sin(t * 17.3) * 0.5; lanternLight.distance = stats().radius * 2;
        if (handLantern.userData.flame) handLantern.userData.flame.scale.y = 1.5 + Math.sin(t * 13) * 0.2;
        // world
        const p = player.pos;
        moon.position.set(p.x - 30, 50, p.z - 20); moon.target.position.set(p.x, 0, p.z);
        sky.update(t, p); snow.update(dt, t, p); village.update(dt, t);
        // area tracking (other areas arrive in phase 2)
        const a = areaAt(p.x, p.z); if (a && a !== area.id) { area = AREAS[a]; audio.setArea(a); ui.banner(area.name); announce(); }
        // HUD
        const s = stats();
        me.glow = Math.min(s.glow, me.glow + 3 * dt);
        ui.setVitals({ hp: me.hp, maxHp: s.hearts * 2, glow: me.glow, maxGlow: s.glow, power: s.power });
        ui.setEmbers(save.embers, me.carried);
        const tracked = (save.tracked.length ? save.tracked : [QUESTS[0].id]).map(id => QUESTS.find(q => q.id === id)).filter(Boolean);
        ui.setQuests(tracked.map(q => ({ title: q.title, p: save.quests[q.id]?.p || 0, goal: q.goal })));
        // save (debounced)
        save.stats.playMs += dt * 1000; saveT += dt;
        if ((dirty && saveT > 3) || saveT > 30) { saveT = 0; dirty = false; persist(economy, save).catch?.(() => {}); }
      },
      dispose() {
        disposed = true; persist(economy, save).catch?.(() => {});
        removeEventListener('keydown', blockF, true);
        { const l = input.listeners?.keydown; const i = l ? l.indexOf(onKey) : -1; if (i >= 0) l.splice(i, 1); }
        audio.stop(); ui.dispose(); net.dispose?.();
        handLantern.removeFromParent();
        player.enabled = true; player.camPitch = prev.pitch; player.camDist = prev.dist;
        renderer.toneMappingExposure = prev.exposure; camera.far = prev.far; camera.updateProjectionMatrix();
        scene.traverse(o => { if (o === avatar.root) return; o.geometry?.dispose?.(); if (o.material) [].concat(o.material).forEach(m => { m.map?.dispose?.(); m.dispose?.(); }); });
        if (engine.lanternHollow === hooks) delete engine.lanternHollow;
        if (window.__lh === hooks) delete window.__lh;
      },
    };
    // Read-only QA hooks (+ ?lhtest=1 for headless runs)
    const hooks = engine.lanternHollow = {
      get area() { return area.id; }, get save() { return save; }, get me() { return me; }, get party() { return Object.fromEntries(party); },
      get isHost() { return net.isHost(); }, get online() { return net.online; }, get sfx() { return audio.loaded; }, get interactable() { return nearestInteractable()?.id || null; },
      interactables: village.interactables, player, collision,
      warpTo(x, y, z) { if (testMode) player.teleport(new THREE.Vector3(x, y, z), 0); },
    };
    if (testMode) window.__lh = hooks;
    return game;
  },
};
