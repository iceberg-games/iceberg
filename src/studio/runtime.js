// Runtime for user-made games: loads a Studio doc and makes it playable
// (collisions, spawn/checkpoints, kill bricks, coins, gears, plain-words
// scripts, animations, mobile controls).
import * as THREE from 'three';
import { Collision, aabbVsConvex } from '../engine/collision.js';
import { StudioWorld } from './world.js';
import { computeCollider, partMaterial } from './instances.js';
import { ScriptRunner } from './behaviors.js';
import { translate } from './nlscript.js';
import { GEARS, Backpack } from './gears.js';
import { sampleAnimation } from './animation.js';
import { bus } from '../core/events.js';
import { COLORS } from './nlscript.js';

const HW = 0.42, H = 2.6;
const sfxCtx = () => (window.__icebergSfx ||= new (window.AudioContext || window.webkitAudioContext)());
export function playSfx(kind = 'ding') {
  try {
    const ctx = sfxCtx(); const t = ctx.currentTime; const g = ctx.createGain(); g.connect(ctx.destination);
    const o = ctx.createOscillator();
    const presets = { ding: ['sine', 880, 1320, 0.5], chime: ['sine', 1046, 1568, 0.8], bell: ['sine', 660, 990, 1.2], coin: ['square', 988, 1319, 0.25], pop: ['sine', 400, 900, 0.12], beep: ['square', 660, 660, 0.18], click: ['square', 1200, 800, 0.05], jump: ['triangle', 300, 800, 0.25], whoosh: ['sawtooth', 200, 60, 0.5], boom: ['sawtooth', 120, 30, 0.8], explosion: ['sawtooth', 120, 20, 1.0], buzz: ['sawtooth', 110, 100, 0.4], laser: ['square', 1500, 200, 0.3], win: ['triangle', 523, 1046, 0.9] };
    const [type, f0, f1, dur] = presets[kind] || presets.ding;
    o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur * 0.6);
    g.gain.setValueAtTime(0.18, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); o.start(t); o.stop(t + dur + 0.05);
  } catch { /* audio unavailable */ }
}

export async function createRuntime(ctx, doc) {
  const { engine, economy, models, avatar } = ctx;
  const scene = new THREE.Scene();
  const world = new StudioWorld(scene, doc, { models, editing: false });
  const collision = new Collision({ floorY: world.env.floorY, bounds: world.env.bounds });
  const app = document.getElementById('app');
  const ui = document.createElement('div'); ui.className = 'rt-ui'; app.append(ui);
  const score = { points: 0 };
  const scoreEl = document.createElement('div'); scoreEl.className = 'rt-score hidden'; ui.append(scoreEl);
  const setScore = () => { scoreEl.textContent = `⭐ ${score.points} points`; scoreEl.classList.remove('hidden'); };

  // ---- colliders ----
  const entries = [...world.entries.values()];
  const solidOf = (e) => e.inst.collide !== false && e.inst.type !== 'coin';
  function refreshCollider(e) {
    if (e.collider) collision.removeConvex(e.collider);
    e.convex = computeCollider(e); e.collider = null;
    if (e.visible !== false && e.solid !== false && solidOf(e)) e.collider = collision.addConvex(e.convex);
  }
  entries.forEach(e => { e.visible = true; e.solid = e.inst.collide !== false; refreshCollider(e); });
  const byName = (name) => entries.find(e => e.inst.name.toLowerCase() === String(name).toLowerCase());

  // ---- spawn / respawn ----
  const spawnE = entries.find(e => e.inst.type === 'spawn');
  const topOf = (e) => { const b = e.convex.aabb; return new THREE.Vector3((b.minX + b.maxX) / 2, b.maxY + 0.05, (b.minZ + b.maxZ) / 2); };
  const spawn = spawnE ? topOf(spawnE) : new THREE.Vector3(0, world.env.floorY == null ? 10 : 0.1, 0);
  let respawnPoint = spawn.clone(), lastCheckpoint = null;
  const flash = document.createElement('div'); flash.className = 'rt-flash'; ui.append(flash);
  const backpack = new Backpack(engine.player, avatar, () => renderHotbar());
  function respawn(msg = 'Oof!') {
    engine.player.teleport(respawnPoint.clone(), engine.player.facing);
    flash.classList.remove('on'); void flash.offsetWidth; flash.classList.add('on');
    playSfx('pop'); if (msg) bus.emit('toast', { text: msg, icon: '💥' });
  }

  // ---- gears hotbar ----
  const hotbar = document.createElement('div'); hotbar.className = 'rt-hotbar'; ui.append(hotbar);
  function renderHotbar() {
    hotbar.innerHTML = '';
    backpack.items.forEach((id, i) => {
      const g = GEARS[id]; const b = document.createElement('button');
      b.className = 'rt-gear' + (backpack.equipped === id ? ' on' : ''); b.dataset.gear = id;
      b.innerHTML = `<span class="k">${i + 1}</span><span class="i">${g.icon}</span><span class="n">${g.name}</span>`;
      b.onclick = () => backpack.toggle(id); hotbar.append(b);
    });
  }
  (doc.starterGears || []).forEach(id => backpack.give(id));
  const onKey = (e) => { if (/^Digit[1-9]$/.test(e.code)) { const id = backpack.items[+e.code.slice(5) - 1]; if (id) backpack.toggle(id); } };
  addEventListener('keydown', onKey);

  // ---- animations ----
  const anims = doc.animations || [];
  const playing = new Map(); // instId -> {anim, t, loop} | clip action
  function playAnimation(instId, ref, loop = true) {
    const e = world.entries.get(instId); if (!e?.rig) return false;
    if (typeof ref === 'string' && ref.startsWith('clip:')) { e.rig.playClip(ref.slice(5), loop); playing.set(instId, { mixer: true }); return true; }
    const anim = anims.find(a => a.id === ref || a.name.toLowerCase() === String(ref).toLowerCase());
    if (anim) { playing.set(instId, { anim, t: 0, loop }); return true; }
    if (e.rig.clips?.length) { const c = e.rig.clips.find(c => c.name.toLowerCase() === String(ref).toLowerCase()) || e.rig.clips[0]; e.rig.playClip(c.name, loop); playing.set(instId, { mixer: true }); return true; }
    return false;
  }
  entries.forEach(e => { if (e.rig && e.inst.autoplay) playAnimation(e.inst.id, e.inst.autoplay, true); });

  // ---- scripts ----
  let gotBucks = 0;
  const api = {
    respawn, playAnimation,
    toast: (text) => bus.emit('toast', { text, icon: '💬' }),
    setVisible(id, v) { const e = world.entries.get(id); if (!e) return; e.visible = v; e.root.visible = v; refreshCollider(e); },
    act(a, runner) {
      const self = runner.entry; const target = a.target ? byName(a.target) : self;
      const p = engine.player;
      switch (a.do) {
        case 'kill': respawn('Oof!'); break;
        case 'color': if (target) { const c = a.color === 'random' || a.color === 'rainbow' ? new THREE.Color().setHSL(Math.random(), 0.8, 0.55) : new THREE.Color(a.color); (target.body.isMesh ? [target.body] : []).forEach(o => { o.material.color.copy(c); if (o.material.emissiveIntensity) o.material.emissive.copy(c); }); } break;
        case 'hide': if (target) { api.setVisible(target.inst.id, false); if (a.seconds) setTimeout(() => api.setVisible(target.inst.id, true), a.seconds * 1000); } break;
        case 'show': if (target) api.setVisible(target.inst.id, true); break;
        case 'points': score.points += a.amount; setScore(); break;
        case 'bucks': { const n = Math.min(a.amount, 50 - gotBucks); if (n > 0 && !runner._paid) { runner._paid = true; gotBucks += n; economy.earn(n, `Reward in ${doc.name}`); } break; }
        case 'message': bus.emit('toast', { text: a.text, icon: '💬' }); break;
        case 'sound': playSfx(a.sound); break;
        case 'teleport': { let to; if (a.toPart) { const t = byName(a.toPart); if (t) to = topOf(t); } else if (Array.isArray(a.to)) to = new THREE.Vector3(...a.to); else to = spawn.clone(); if (to) p.teleport(to, p.facing); break; }
        case 'bounce': p.vel.y = a.power; p.onGround = false; playSfx('jump'); break;
        case 'speed': { p.mods.speed = a.mult; clearTimeout(api._sp); api._sp = setTimeout(() => { p.mods.speed = backpack.equipped === 'speedCoil' ? 1.8 : 1; }, a.seconds * 1000); break; }
        case 'gravity': { p.mods.gravity = a.mult; clearTimeout(api._gr); api._gr = setTimeout(() => { p.mods.gravity = backpack.equipped === 'gravityCoil' ? 0.35 : 1; }, a.seconds * 1000); break; }
        case 'transparency': self.root.traverse(o => { if (o.isMesh && o.material) { o.material.transparent = true; o.material.opacity = 1 - a.value; } }); break;
        case 'collide': self.solid = !!a.value; refreshCollider(self); break;
        case 'glow': self.root.traverse(o => { if (o.isMesh && o.material?.emissive) { o.material.emissive.set(a.color && a.color !== 'random' ? a.color : o.material.color); o.material.emissiveIntensity = 1.2; } }); break;
        case 'door': { const d = target || self; d.solid = false; refreshCollider(d); d.root.traverse(o => { if (o.isMesh && o.material) { o.material.transparent = true; o.material.opacity = 0.25; } }); playSfx('click'); setTimeout(() => { d.solid = d.inst.collide !== false; refreshCollider(d); d.root.traverse(o => { if (o.isMesh && o.material) { o.material.opacity = 1 - (d.inst.transparency || 0); } }); }, a.seconds * 1000); break; }
        case 'checkpoint': respawnPoint = topOf(self); break;
        case 'win': bus.emit('toast', { text: a.text, icon: '🏆' }); playSfx('win'); break;
        case 'animation': playAnimation(self.inst.id, a.name, a.loop); break;
      }
    },
  };
  const runners = [];
  for (const e of entries) for (const s of e.inst.scripts || []) {
    if (s.enabled === false) continue;
    const program = s.program || translate(s.text || '').program;
    const r = new ScriptRunner(e.inst, e, program, api); r.entry = e; runners.push(r); (e.runners ||= []).push(r);
  }
  runners.forEach(r => r.start());

  // ---- mobile controls ----
  let touchUI = null;
  const coarse = window.matchMedia?.('(pointer: coarse)').matches || window.__forceTouch;
  if (doc.mobile && coarse) {
    touchUI = document.createElement('div'); touchUI.className = 'rt-touch';
    touchUI.innerHTML = '<div class="joy" id="rt-joy"><div class="knob"></div></div><button class="jump" id="rt-jump">⤒</button>';
    ui.append(touchUI);
    const joy = touchUI.querySelector('.joy'), knob = touchUI.querySelector('.knob'), jump = touchUI.querySelector('.jump');
    let jid = null;
    const setJoy = (e) => { const r = joy.getBoundingClientRect(); let x = (e.clientX - r.left - r.width / 2) / (r.width / 2), y = (e.clientY - r.top - r.height / 2) / (r.height / 2); const m = Math.hypot(x, y); if (m > 1) { x /= m; y /= m; } knob.style.transform = `translate(${x * 35}px, ${y * 35}px)`; engine.input.analog = { x, y: -y }; };
    joy.addEventListener('pointerdown', (e) => { jid = e.pointerId; joy.setPointerCapture(jid); setJoy(e); e.stopPropagation(); });
    joy.addEventListener('pointermove', (e) => { if (e.pointerId === jid) setJoy(e); });
    const endJoy = () => { jid = null; knob.style.transform = ''; engine.input.analog = null; };
    joy.addEventListener('pointerup', endJoy); joy.addEventListener('pointercancel', endJoy);
    jump.addEventListener('pointerdown', (e) => { engine.input.keys.add('Space'); e.stopPropagation(); });
    jump.addEventListener('pointerup', () => engine.input.keys.delete('Space'));
  }

  // ---- per-frame ----
  const touching = new Set();
  const tmpAabb = (p, pad) => [p.x - HW - pad, p.y - pad, p.z - HW - pad, p.x + HW + pad, p.y + H + pad, p.z + HW + pad];
  return {
    scene, collision, spawn, spawnFacing: 0, music: doc.music || 'none', doc, runtime: true, score,
    world, backpack, api, runners,
    onFall: () => respawn('You fell!'),
    update(dt, t, player) {
      world.update(dt, player.pos);
      // scripts + moving parts (carry players standing on them)
      for (const e of entries) {
        if (!e.runners) continue;
        const before = e.root.position.clone();
        const standing = e.convex && aabbVsConvex(...tmpAabb({ x: player.pos.x, y: player.pos.y - 0.12, z: player.pos.z }, 0), e.convex) && player.onGround;
        let moved = false; for (const r of e.runners) moved = r.update(dt) || moved;
        if (moved) { refreshCollider(e); if (standing) player.pos.add(e.root.position.clone().sub(before)); }
      }
      // unanchored parts fall
      for (const e of entries) {
        if (e.inst.anchored !== false || e.resting || !e.visible) continue;
        e.vy = (e.vy || 0) - 30 * dt; const dy = Math.max(-30, e.vy) * dt;
        e.root.position.y += dy; e.convex = computeCollider(e);
        const b = e.convex.aabb;
        const hitFloor = world.env.floorY != null && b.minY <= world.env.floorY;
        const hit = hitFloor || collision.convexes.some(c => c !== e.collider && aabbVsConvex(b.minX + 0.05, b.minY, b.minZ + 0.05, b.maxX - 0.05, b.maxY, b.maxZ - 0.05, c));
        if (hit) { e.root.position.y -= dy; e.resting = true; e.vy = 0; }
        refreshCollider(e);
        if (e.root.position.y < -60) { e.visible = false; e.root.visible = false; refreshCollider(e); }
      }
      // animations
      for (const e of entries) if (e.rig?.mixer) e.rig.mixer.update(dt);
      for (const [id, st] of playing) { if (st.anim) { st.t += dt; sampleAnimation({ ...st.anim, loop: st.loop }, world.entries.get(id).rig, st.t); } }
      // touches
      const box = tmpAabb(player.pos, 0.08);
      for (const e of entries) {
        if (!e.visible || !e.convex) continue;
        const hit = aabbVsConvex(...box, e.convex);
        if (!hit) { touching.delete(e.inst.id); continue; }
        const first = !touching.has(e.inst.id); touching.add(e.inst.id);
        const inst = e.inst;
        if (inst.kill || inst.material === 'lava') { respawn('Oof!'); touching.clear(); return; }
        if (inst.type === 'coin') { e.visible = false; e.root.visible = false; economy.earn(inst.value || 5, 'Pickup'); playSfx('coin'); continue; }
        if (first && inst.type === 'checkpoint' && lastCheckpoint !== inst.id) { lastCheckpoint = inst.id; respawnPoint = topOf(e); bus.emit('toast', { text: `Checkpoint ${inst.order || ''} reached!`, icon: '🚩' }); playSfx('chime'); }
        if (first && inst.type === 'gear' && GEARS[inst.gearId] && backpack.give(inst.gearId)) { bus.emit('toast', { text: `You got the ${GEARS[inst.gearId].name}! Press ${backpack.items.length} to equip`, icon: GEARS[inst.gearId].icon }); playSfx('ding'); }
        if (e.runners) for (const r of e.runners) r.touch();
      }
    },
    dispose() { removeEventListener('keydown', onKey); backpack.clear(); ui.remove(); engine.input.analog = null; engine.input.keys.delete('Space'); },
  };
}
