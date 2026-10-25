// Game: Winterhaven (Winterhaven event). A big walk-around snowy village at night: talk to villagers,
// take their quests, find the glowing items around the valley and bring them back for event cosmetics.
// The Frostgate arch in Frostgate Plaza starts the Frostgate Run, a short ice gate race on Mirrorfrost Lake.
//   Map: Iceberg Set Builder's Winterhaven set (layout.js copy + scene.js port); collision built here.
//   Quests: per player, server-side (quests.progress / quests.complete, event 'winterhaven'); the server grants items.
//   Input: engine.input only (touch joystick/jump simulate keys) + big DOM buttons for Talk / Accept / Turn in.
//   Multiplayer: remote avatars are drawn by the engine. Pickups, gates and turn-ins only ever look at the
//   LOCAL player's position, so other players can't collect or complete anything for you.
import * as THREE from 'three';
import { Collision } from '../../engine/collision.js';
import { getDeviceMode } from '../../core/device.js';
import { COSMETIC_BY_ID } from '../../data/cosmetics.js';
import { questApi } from '../_event/questAdapter.js';
import * as C from './config.js';
import { QUESTS } from './quests.js';
import { ANCHORS, areaAt, groundHeight } from './layout.js';
import { buildScene } from './scene.js';
import { createSnow } from './lib/snow.js';
import { NPCS, HUB, PICKUP_ICON, FLOW, QUEST_ORDER, FALLBACK_ITEMS, initialStates, step, npcOffer, pickupHit, doneCount, fmtTime, fmtCountdown } from './logic.js';
import { makeVillager, makePickup } from './villagers.js';
import { WinterAudio } from './audio.js';
import { WinterUI } from './ui.js';
import { FrostgateRun } from './minigame.js';
import THUMB from './thumb.js';
import { installFilm } from './film.js';

const QUEST_BY_ID = Object.fromEntries(QUESTS.map(q => [q.id, q]));
/** Item display: cosmetics.js when it has the item (Cosmetics bot), else the local fallback list. */
export function itemInfo(id) {
  const c = COSMETIC_BY_ID?.[id], f = FALLBACK_ITEMS[id] || {};
  return { name: c?.name || f.name || id, icon: c?.icon || f.icon || '🎁', rarity: String(c?.rarity || f.rarity || '').toLowerCase(), earnIn: c?.earnIn || f.earnIn || '' };
}
const LS = 'iceberg:v1:winterhaven';
function loadSave(economy) {
  let s = null; try { s = economy.cachedGameData?.(C.GAME_ID) || economy.profile?.gameData?.[C.GAME_ID] || null; } catch { /* */ }
  if (!s) try { s = JSON.parse(localStorage.getItem(LS) || 'null'); } catch { /* */ }
  return { states: {}, paid: {}, claimed: {}, runBest: null, runs: 0, ...(s || {}) };
}

export default {
  id: C.GAME_ID, name: 'Winterhaven', tagline: 'Village quests under the northern lights',
  description: 'Explore a cozy snowy village at night. Help the villagers of Winterhaven with their quests, climb to Frostspire Castle, find Glimmer Cave and race the Frostgate Run on the frozen lake to earn limited-time Winterhaven cosmetics.',
  thumbnail: THUMB || 'frost', music: 'none', credits: C.CREDITS, mobile: true,

  async create(ctx) {
    const { engine, economy, music } = ctx;
    const player = engine.player, renderer = engine.renderer, camera = engine.camera;
    const mobile = getDeviceMode() === 'mobile';
    const exposure0 = renderer.toneMappingExposure, far0 = camera.far;
    const built = buildScene({ renderer, mobile });
    const scene = built.scene;
    camera.far = 1600; camera.updateProjectionMatrix();
    const snow = createSnow({ count: mobile ? 14000 : 45000, box: 90, height: 50 }); scene.add(snow.points);
    snow.uniforms.uIntensity.value = 0.55; snow.uniforms.uPixel.value = Math.min(2, window.devicePixelRatio || 1);

    // ---------- collision: terrain heightfield (floor follows groundHeight under the player) + set colliders ----------
    const wb = built.walkBounds;
    const collision = new Collision({ floorY: 0, bounds: { type: 'box', minX: wb.minX, maxX: wb.maxX, minZ: wb.minZ, maxZ: wb.maxZ } });
    Object.defineProperty(collision, 'floorY', { get: () => groundHeight(player.pos.x, player.pos.z), configurable: true });
    built.addColliders(collision);
    // A few roster stand points sit inside a cabin / castle wall collider: step them out to the nearest open side.
    for (const n of Object.values(NPCS)) {
      for (const b of collision.boxes) {
        if (b.maxY - b.minY < 10 || n.x <= b.minX || n.x >= b.maxX || n.z <= b.minZ || n.z >= b.maxZ) continue;
        const opts = [[b.minX - 1, n.z, n.x - b.minX], [b.maxX + 1, n.z, b.maxX - n.x], [n.x, b.minZ - 1, n.z - b.minZ], [n.x, b.maxZ + 1, b.maxZ - n.z]].sort((a, c) => a[2] - c[2]);
        n.x = opts[0][0]; n.z = opts[0][1]; n.nudged = true;
      }
      const rt = Math.hypot(n.x, n.z); if (rt < 12) { n.x *= 12.5 / rt; n.z *= 12.5 / rt; n.nudged = true; } // out from under the big tree's lowest skirt (r 10.7)
      collision.addCircle(n.x, n.z, n.kind === 'villager' ? 0.7 : 0.45, groundHeight(n.x, n.z) + 3);
    }

    // ---------- state ----------
    const save = loadSave(economy);
    const states = initialStates(save.states);
    const persist = () => {
      save.states = { ...states };
      const data = { states: save.states, paid: save.paid, claimed: save.claimed, runBest: save.runBest, runs: save.runs };
      try { localStorage.setItem(LS, JSON.stringify(data)); } catch { /* private mode */ }
      try { economy.saveGameData?.(C.GAME_ID, { ...(economy.cachedGameData?.(C.GAME_ID) || {}), ...data }); } catch { /* */ }
    };
    let live = true;
    const audio = new WinterAudio(music);
    const ui = new WinterUI({ onAction: () => doAction(), onEvent: () => openEvent(), onExitRun: () => exitRun(), sfx: (n) => audio.ui(n) });

    // ---------- NPCs + pickups ----------
    const villagers = Object.values(NPCS).map(n => { const v = makeVillager(n); scene.add(v.group); return v; });
    const pickups = {};
    for (const id of QUEST_ORDER) { const p = FLOW[id].pickup; if (p) { pickups[id] = makePickup(p); scene.add(pickups[id].root); } }

    // ---------- server quest state ----------
    const api = () => questApi();
    let eventStatus = null, eventFetchedAt = 0;
    async function refreshEvent() {
      try { eventStatus = await api().eventStatus?.(C.EVENT_ID); eventFetchedAt = performance.now(); } catch { eventStatus = null; }
      updateEventSub();
    }
    async function claim(id, { quiet = false } = {}) { // report goal 1 then ask the server to grant (idempotent server-side)
      let res = null;
      try {
        const pr = await api().progress(id, 1);
        if (pr && pr.ok === false && !['too_fast'].includes(pr.reason)) { if (!quiet) ui.popup({ icon: '⏳', title: 'Reward is saved', sub: pr.reason === 'event_not_started' ? 'It unlocks when the Winterhaven event starts.' : pr.reason === 'event_ended' ? 'The Winterhaven event has ended.' : 'We\'ll try again next time you visit.', ms: 3200 }); return pr; }
        res = await api().complete(id);
      } catch (e) { res = { granted: false, reason: 'network' }; }
      if (!live) return res;
      if (res?.granted || res?.alreadyClaimed) {
        save.claimed[id] = true; persist();
        if (!quiet && res.granted) { const it = itemInfo(QUEST_BY_ID[id].rewardItemId); setTimeout(() => live && ui.popup({ icon: it.icon, title: `Unlocked: ${it.name}`, sub: `${it.rarity} · equip it in your Locker`, ms: 3600 }), 1400); audio.ui('play'); }
      } else if (!quiet && res?.reason && res.reason !== 'network') ui.popup({ icon: '⏳', title: 'Reward is saved', sub: 'We\'ll finish claiming it next time you visit.', ms: 3000 });
      return res;
    }
    Promise.resolve().then(() => api().status?.(C.GAME_ID)).then((list) => {
      if (!live || !Array.isArray(list)) return;
      for (const s of list) if (states[s.id] != null && s.claimed) { states[s.id] = step(states[s.id], 'serverDone'); save.claimed[s.id] = true; }
      persist(); refreshWorld();
      for (const id of QUEST_ORDER) if (states[id] === 'done' && !save.claimed[id]) claim(id, { quiet: true }); // finish claims that didn't go through
    }).catch(() => {});
    refreshEvent();

    // ---------- quest actions ----------
    const giverName = (id) => NPCS[FLOW[id].giver].name.split(' ')[0];
    function hintFor(id) {
      if (states[id] === 'carrying') return `Bring the ${FLOW[id].pickup.label.toLowerCase()} to ${giverName(id)} (or Frosty at the market)`;
      if (id === 'wh_quest_frostgate') return 'Step through the Frostgate arch (Frostgate Plaza, west)';
      const p = FLOW[id].pickup, a = areaAt(p.x, p.z); return `Find the ${p.label.toLowerCase()}${a ? ' in ' + a.name : ''}`;
    }
    function refreshWorld() {
      for (const id of QUEST_ORDER) if (pickups[id]) pickups[id].root.visible = states[id] === 'active';
      for (const v of villagers) v.setMarker(npcOffer(v.npc.id, states).kind);
      const rows = QUEST_ORDER.filter(id => states[id] === 'active' || states[id] === 'carrying').map(id => ({ title: QUEST_BY_ID[id].title, hint: hintFor(id), carry: states[id] === 'carrying' }));
      ui.setTracker(rows.sort((a, b) => b.carry - a.carry).slice(0, 4), doneCount(states), QUEST_ORDER.length);
      updateEventSub();
    }
    function updateEventSub() { ui.setEventSub(`${doneCount(states)}/${QUEST_ORDER.length} quests${eventStatus?.active === false && eventStatus?.msToStart > 0 ? ' · soon' : ''}`); }
    function accept(id) {
      const was = states[id]; states[id] = step(states[id], 'accept'); if (states[id] === was) return;
      persist(); refreshWorld(); ui.closeDialog(true); audio.sfx('accept');
      ui.popup({ icon: '📜', title: `Quest: ${QUEST_BY_ID[id].title}`, sub: hintFor(id), ms: 2800 });
    }
    function turnIn(id, atNpc = null) {
      if (states[id] !== 'carrying') return;            // only once: state flips to done before anything async
      states[id] = step(states[id], 'turnIn'); persist(); refreshWorld();
      const it = itemInfo(QUEST_BY_ID[id].rewardItemId), f = FLOW[id];
      ui.dialog({ who: atNpc && atNpc !== f.giver ? NPCS[atNpc].name : NPCS[f.giver].name, say: atNpc && atNpc !== f.giver ? `Wonderful! I'll make sure ${NPCS[f.giver].name} gets it. They asked me to give you this.` : f.thanks, reward: { ...it, extra: save.paid[id] ? '' : `+${C.QUEST_TURN_IN_BB} Birg Bucks` }, buttons: [{ label: 'Thanks!', cls: 'go', id: 'wh-thanks', on: () => ui.closeDialog() }] });
      audio.sfx('win');
      if (!save.paid[id]) { save.paid[id] = true; persist(); economy.earn(C.QUEST_TURN_IN_BB, `Winterhaven quest: ${QUEST_BY_ID[id].title}`, { source: C.EARN_SOURCE }); }
      claim(id);
    }
    function talk(v) {
      const n = v.npc, offer = npcOffer(n.id, states), id = offer.questId;
      const pitch = n.kind === 'villager' ? 0.9 + ((n.id.length * 7) % 5) * 0.06 : 1.35;   // each NPC gets its own voice pitch
      audio.sfx(offer.kind === 'active' ? 'think' : 'greet'); audio.chatter(3, pitch);
      if (offer.kind === 'accept') {
        const it = itemInfo(QUEST_BY_ID[id].rewardItemId);
        const viaHub = n.id === HUB && FLOW[id].giver !== HUB;
        ui.dialog({ who: n.name, say: viaHub ? `${doneCount(states) === 0 ? n.greet + ' ' : ''}${NPCS[FLOW[id].giver].name} needs help: "${FLOW[id].ask}"` : FLOW[id].ask, reward: it,
          buttons: [{ label: 'Not now', id: 'wh-later', on: () => { audio.sfx('disagree'); ui.closeDialog(true); } }, { label: '✔ Accept', cls: 'go', id: 'wh-accept', on: () => accept(id) }] });
      } else if (offer.kind === 'turnIn') {
        ui.dialog({ who: n.name, say: `You found the ${FLOW[id].pickup.label.toLowerCase()}!`, reward: itemInfo(QUEST_BY_ID[id].rewardItemId),
          buttons: [{ label: '🎁 Turn in', cls: 'gold', id: 'wh-turnin', on: () => turnIn(id, n.id) }] });
      } else if (offer.kind === 'active') {
        if (id === 'wh_quest_frostgate') ui.dialog({ who: n.name, say: FLOW[id].ask, reward: null, buttons: [{ label: 'Later', id: 'wh-ok', on: () => ui.closeDialog() }, { label: '❄ Start the run', cls: 'go', id: 'wh-start', on: () => enterRun() }] });
        else ui.dialog({ who: n.name, say: `Still looking? ${hintFor(id)}.`, reward: null, buttons: [{ label: 'On my way', cls: 'go', id: 'wh-ok', on: () => ui.closeDialog() }] });
      } else if (n.id === 'portal-keeper') {
        ui.dialog({ who: n.name, say: `${save.runBest != null ? `Your best Frostgate Run is ${fmtTime(save.runBest)}. ` : ''}Want another go on the ice?`, reward: null, buttons: [{ label: 'Bye!', id: 'wh-bye', on: () => { audio.sfx('bye'); ui.closeDialog(true); } }, { label: '❄ Race again', cls: 'go', id: 'wh-start', on: () => enterRun() }] });
      } else {
        const more = QUEST_ORDER.some(q => states[q] !== 'done');
        ui.dialog({ who: n.name, say: `${n.greet}${more ? '' : ' Thank you for everything you\'ve done for Winterhaven!'}`, reward: null, buttons: [{ label: 'Bye!', id: 'wh-bye', on: () => { audio.sfx('bye'); ui.closeDialog(true); } }] });
      }
    }

    // ---------- event menu ----------
    function renderEvent() {
      let cd = 'Winterhaven event';
      if (eventStatus) {
        const el = performance.now() - eventFetchedAt;
        if (eventStatus.active) cd = `⏳ Ends in ${fmtCountdown((eventStatus.msLeft ?? (Date.parse(eventStatus.endsAt) - Date.parse(eventStatus.serverNow))) - el)}`;
        else if ((eventStatus.msToStart ?? 0) > 0 || (eventStatus.startsAt && Date.parse(eventStatus.startsAt) > Date.parse(eventStatus.serverNow))) cd = `🎉 Starts in ${fmtCountdown((eventStatus.msToStart ?? (Date.parse(eventStatus.startsAt) - Date.parse(eventStatus.serverNow))) - el)}`;
        else if (eventStatus.unscheduled) cd = 'Event dates coming soon';
        else cd = 'The event has ended';
      }
      ui.renderEvent(cd, QUEST_ORDER.map(id => {
        const q = QUEST_BY_ID[id], it = itemInfo(q.rewardItemId), s = states[id];
        const status = save.claimed[id] ? '✅ Unlocked' : s === 'done' ? '⏳ Claiming…' : s === 'carrying' ? `🎒 Return to ${giverName(id)}` : s === 'active' ? '📜 In progress' : `💬 Talk to ${giverName(id)}`;
        return { questId: id, ...it, title: q.title, description: q.description, status, done: s === 'done' };
      }));
    }
    let evTimer = null;
    function openEvent() { if (ui.eventOpen) { ui.closeEvent(); clearInterval(evTimer); return; } ui.closeDialog(true); refreshEvent().then(() => live && ui.eventOpen && renderEvent()); ui.openEvent(renderEvent); clearInterval(evTimer); evTimer = setInterval(() => { if (!ui.eventOpen) clearInterval(evTimer); else renderEvent(); }, 1000); }

    // ---------- Frostgate Run ----------
    const run = new FrostgateRun(scene, {
      player, ui, audio,
      onFinish: (time) => {
        save.runs++;
        if (time == null) { ui.popup({ icon: '⌛', title: 'Out of time!', sub: 'Exit and try the Frostgate again.', ms: 2600 }); setTimeout(() => live && exitRun(), 2400); persist(); return; }
        const best = save.runBest == null || time < save.runBest; if (best) save.runBest = time;
        const first = !save.paid.run;
        ui.popup({ icon: '🏁', title: `Frostgate Run: ${fmtTime(time)}`, sub: `${best ? 'New best!' : `Best ${fmtTime(save.runBest)}`}${first ? ` · +${C.RUN_FIRST_FINISH_BB} Birg Bucks` : ''}`, ms: 3400 });
        if (first) { save.paid.run = true; economy.earn(C.RUN_FIRST_FINISH_BB, 'Winterhaven Frostgate Run finished', { source: C.EARN_SOURCE }); }
        const qid = 'wh_quest_frostgate';
        if (states[qid] !== 'done') { states[qid] = 'done'; claim(qid); }
        persist(); refreshWorld();
        setTimeout(() => live && exitRun(), 3200);
      },
      onEnd: () => { const a = ANCHORS.portal; player.teleport(new THREE.Vector3(a.x + 6, groundHeight(a.x + 6, a.z) + 0.2, a.z), Math.PI / 2); },
    });
    function enterRun() { if (run.active) return; ui.closeDialog(true); ui.closeEvent(); audio.ui('play'); run.start(); }
    function exitRun() { run.stop(); refreshWorld(); }

    // ---------- interaction ----------
    let near = null;          // { kind: 'npc'|'portal', v? }
    function doAction() {
      if (!near || ui.dialogOpen || ui.eventOpen || run.active) return;
      if (near.kind === 'npc') talk(near.v); else if (near.kind === 'portal') enterRun();
    }
    const prev = {};
    const pressed = (code) => { const d = engine.input.down(code), was = prev[code]; prev[code] = d; return d && !was; };
    let lastArea = null, areaCheckT = 0, worldDirty = true;
    refreshWorld();
    const spawnY = groundHeight(ANCHORS.spawn.x, ANCHORS.spawn.z);
    setTimeout(() => live && ui.showArea('Winterhaven', 'Welcome to'), 400);

    let film = null;
    const game = {
      scene, collision,
      spawn: new THREE.Vector3(ANCHORS.spawn.x, spawnY + 0.2, ANCHORS.spawn.z), spawnFacing: ANCHORS.spawn.facing,
      music: 'none', maxCamDist: 22,
      onFall: () => player.teleport(new THREE.Vector3(ANCHORS.spawn.x, spawnY + 0.5, ANCHORS.spawn.z), ANCHORS.spawn.facing),
      // test/debug handle (read-only use by Playwright; never trusted for rewards — the server grants)
      get debug() { return { states: { ...states }, near: near?.kind === 'npc' ? near.v.npc.id : near?.kind || null, run: run.state, music: audio.track.state, musicPlaying: audio.playing, muted: audio.muted, sfxPlayed: audio.samples, sfxLoaded: Object.values(audio.bank).filter(b => b.buf).length, ambience: Object.keys(audio.amb).filter(k => audio.amb[k].src), claimed: { ...save.claimed }, paid: { ...save.paid } }; },
      update(dt, t) {
        if (!live) return;
        built.update(dt, t);
        built.sky.mesh.position.copy(camera.position);
        snow.update(dt, t, camera.position, { speed: 2.2, wind: [0.7, 0.25] });
        audio.update();
        if (!run.active) { const ar = lastArea; audio.ambience(ar === 'market' || ar === 'square' ? 'market' : ar === 'lane' ? 'hearth' : 'village'); } else audio.ambience('village');
        const p = player.pos;
        for (const v of villagers) { v.update(t, ui.dialogOpen && near?.v === v); }
        for (const id in pickups) if (pickups[id].root.visible) pickups[id].update(t);
        if (run.active) { run.update(dt, t); const g = run.guide(); if (g) { const fx = -Math.sin(player.camYaw), fz = -Math.cos(player.camYaw), rx = Math.cos(player.camYaw), rz = -Math.sin(player.camYaw); ui.setArrow(`Gate ${run.next + 1} · ${Math.round(g.d)}m`, Math.atan2(g.dx * rx + g.dz * rz, g.dx * fx + g.dz * fz)); } else ui.setArrow(null); ui.setAction(null); return; }
        ui.setArrow(null);

        // pickups: LOCAL player only
        for (const id of QUEST_ORDER) if (pickupHit(id, states[id], p, C.PICKUP_RADIUS)) {
          states[id] = step(states[id], 'pickup'); persist(); worldDirty = true; audio.sfx('collect');
          ui.popup({ icon: PICKUP_ICON[FLOW[id].pickup.kind] || '✨', title: `Found: ${FLOW[id].pickup.label}`, sub: `Bring it to ${NPCS[FLOW[id].giver].name} or Frosty Quill`, ms: 2600 });
        }
        if (worldDirty) { worldDirty = false; refreshWorld(); }

        // nearest interactable
        let best = null, bd = Infinity;
        for (const v of villagers) { const d = Math.hypot(p.x - v.npc.x, p.z - v.npc.z); if (d < (v.npc.talk || C.TALK_RADIUS) && d < bd) { bd = d; best = { kind: 'npc', v }; } }
        const a = ANCHORS.portal, dp = Math.hypot(p.x - a.x, p.z - a.z); if (dp < C.PORTAL_RADIUS && dp < bd) best = { kind: 'portal' };
        if (near?.v !== best?.v || near?.kind !== best?.kind) { near = best; if (!best && ui.dialogOpen) ui.closeDialog(); }
        if (!near) ui.setAction(null);
        else if (near.kind === 'npc') ui.setAction(`💬 Talk to ${near.v.npc.name.split(' ')[0]}`, 'talk');
        else ui.setAction(`❄ Enter Frostgate Run`, 'portal');
        if (pressed('KeyE') && near && !ui.dialogOpen && !ui.eventOpen) { audio.ui('click'); doAction(); }
        if (pressed('Escape')) { if (ui.dialogOpen) ui.closeDialog(); else if (ui.eventOpen) ui.closeEvent(); }
        if (pressed('KeyQ') && !ui.dialogOpen) { audio.ui('click'); openEvent(); }

        // area banner
        areaCheckT -= dt; if (areaCheckT <= 0) { areaCheckT = 0.4; const ar = areaAt(p.x, p.z); const id = ar?.id || null; if (id !== lastArea) { lastArea = id; if (ar) ui.showArea(ar.name); } }
      },
      dispose() {
        live = false; clearInterval(evTimer); film?.dispose();
        run.stop(); run.dispose(); audio.stop(); ui.dispose();
        villagers.forEach(v => v.dispose()); Object.values(pickups).forEach(pk => pk.dispose());
        player.enabled = true; player.mods.speed = 1;
        renderer.toneMappingExposure = exposure0; camera.far = far0; camera.updateProjectionMatrix();
        scene.traverse(o => { const m = o.material; if (m) (Array.isArray(m) ? m : [m]).forEach(x => { x.map?.dispose?.(); x.dispose?.(); }); });
        persist();
      },
    };
    film = installFilm({ game, engine, ui, anchors: ANCHORS, npcs: NPCS, villagers, states, flow: FLOW, step, refreshWorld, persist, groundHeight, run });
    return game;
  },
};
