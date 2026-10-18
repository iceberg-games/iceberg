// Runtime for user-made games: loads a Studio doc and makes it playable
// (collisions, spawn/checkpoints, kill bricks, coins, gears, plain-words
// scripts with events/variables/effects, riding moving platforms,
// animations, mobile controls).
import * as THREE from 'three';
import { Collision, aabbVsConvex } from '../engine/collision.js';
import { StudioWorld } from './world.js';
import { computeCollider, makeInstance, newId } from './instances.js';
import { Motion, ScriptRunner, compare } from './behaviors.js';
import { translate } from './nlscript.js';
import { GEARS, Backpack, creatorGearsOf, gearMods } from './gears.js';
import { sampleAnimation } from './animation.js';
import { bus } from '../core/events.js';
import { getDeviceMode, onDeviceChange } from '../core/device.js';

const HW = 0.42, H = 2.6;
const sfxCtx = () => (window.__icebergSfx ||= new (window.AudioContext || window.webkitAudioContext)());
export function playSfx(kind = 'ding') {
  if (window.icebergUi?.isMuted?.() ?? !!window.iceberg?.music?.muted) return;   // site mute (audio/uiSounds.js isMuted)
  try {
    const ctx = sfxCtx(); const t = ctx.currentTime; const g = ctx.createGain(); g.connect(ctx.destination);
    const o = ctx.createOscillator();
    const presets = { ding: ['sine', 880, 1320, 0.5], chime: ['sine', 1046, 1568, 0.8], bell: ['sine', 660, 990, 1.2], coin: ['square', 988, 1319, 0.25], pop: ['sine', 400, 900, 0.12], beep: ['square', 660, 660, 0.18], click: ['square', 1200, 800, 0.05], jump: ['triangle', 300, 800, 0.25], whoosh: ['sawtooth', 200, 60, 0.5], boom: ['sawtooth', 120, 30, 0.8], explosion: ['sawtooth', 120, 20, 1.0], buzz: ['sawtooth', 110, 100, 0.4], laser: ['square', 1500, 200, 0.3], win: ['triangle', 523, 1046, 0.9], splash: ['triangle', 600, 150, 0.4], zap: ['square', 2000, 300, 0.15], alarm: ['square', 880, 440, 0.9] };
    const [type, f0, f1, dur] = presets[kind] || presets.ding;
    o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur * 0.6);
    g.gain.setValueAtTime(0.18, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); o.start(t); o.stop(t + dur + 0.05);
  } catch { /* audio unavailable */ }
}

// ---------- particles ----------
const PFX = {
  sparkles: { colors: ['#fff6b0', '#ffffff', '#ffd34d'], n: 40, speed: 3, up: 2, grav: -1, life: 1.2, size: 0.25 },
  confetti: { colors: ['#e2474b', '#3f8fd0', '#2f9e6a', '#f5c542', '#ff7ac8', '#8b6cf0'], n: 80, speed: 7, up: 8, grav: 12, life: 2, size: 0.3 },
  fire: { colors: ['#ff4a1c', '#ff8c2a', '#ffd34d'], n: 60, speed: 1.2, up: 4, grav: -2, life: 1, size: 0.45 },
  smoke: { colors: ['#9aa3ad', '#c9d1d9', '#6b737c'], n: 40, speed: 1, up: 2, grav: -0.5, life: 2.2, size: 0.9 },
  explosion: { colors: ['#ff4a1c', '#ffd34d', '#ff8c2a', '#555555'], n: 120, speed: 14, up: 3, grav: 6, life: 1, size: 0.5 },
  bubbles: { colors: ['#bfe9ff', '#e9f8ff', '#9fd3f5'], n: 35, speed: 1, up: 3, grav: -1, life: 2, size: 0.4 },
  snow: { colors: ['#ffffff', '#e9f5ff'], n: 70, speed: 3, up: 3, grav: 2, life: 2.5, size: 0.25 },
  hearts: { colors: ['#ff7ac8', '#e2474b', '#ff3fa4'], n: 30, speed: 2, up: 3, grav: -1, life: 1.6, size: 0.5 },
  stars: { colors: ['#f5c542', '#fff6b0', '#ffffff'], n: 40, speed: 4, up: 3, grav: 1, life: 1.4, size: 0.4 },
  fireworks: { colors: ['#e2474b', '#4dd2ff', '#9be15d', '#f5c542', '#e04fd0'], n: 150, speed: 12, up: 6, grav: 5, life: 1.8, size: 0.35 },
};
class Burst {
  constructor(scene, kind, at, seconds) {
    const c = PFX[kind] || PFX.sparkles; this.c = c; this.scene = scene; this.left = c.life + (seconds || 0); this.emit = seconds || 0; this.at = at.clone();
    const n = c.n * (seconds > 1 ? 2 : 1); this.n = n;
    this.pos = new Float32Array(n * 3); this.vel = new Float32Array(n * 3); this.age = new Float32Array(n); const col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { this.spawn(i, -Math.random() * (seconds || 0)); const cc = new THREE.Color(c.colors[i % c.colors.length]); col.set([cc.r, cc.g, cc.b], i * 3); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    this.points = new THREE.Points(g, new THREE.PointsMaterial({ size: c.size, vertexColors: true, transparent: true, depthWrite: false }));
    this.points.frustumCulled = false; scene.add(this.points);
  }
  spawn(i, age = 0) { const c = this.c; const d = new THREE.Vector3().randomDirection(); this.pos.set([this.at.x, this.at.y, this.at.z], i * 3); this.vel.set([d.x * c.speed, Math.abs(d.y) * c.speed * 0.5 + c.up * (0.5 + Math.random() * 0.5), d.z * c.speed], i * 3); this.age[i] = age; }
  update(dt) {
    this.left -= dt; const c = this.c;
    for (let i = 0; i < this.n; i++) {
      this.age[i] += dt; if (this.age[i] < 0) { this.pos[i * 3 + 1] = -9999; continue; }
      if (this.age[i] > c.life && this.left > c.life) this.spawn(i);
      this.vel[i * 3 + 1] -= c.grav * dt;
      for (let k = 0; k < 3; k++) this.pos[i * 3 + k] += this.vel[i * 3 + k] * dt;
    }
    this.points.geometry.attributes.position.needsUpdate = true;
    this.points.material.opacity = Math.min(1, this.left / 0.5);
    if (this.left <= 0) { this.scene.remove(this.points); this.points.geometry.dispose(); this.points.material.dispose(); return false; }
    return true;
  }
}

export async function createRuntime(ctx, doc) {
  const { engine, economy, models, avatar } = ctx;
  const scene = new THREE.Scene();
  const world = new StudioWorld(scene, doc, { models, editing: false });
  const collision = new Collision({ floorY: world.env.floorY, bounds: world.env.bounds });
  const app = document.getElementById('app');
  const ui = document.createElement('div'); ui.className = 'rt-ui'; app.append(ui);
  const el = (cls, html = '') => { const d = document.createElement('div'); d.className = cls; d.innerHTML = html; ui.append(d); return d; };

  // ---- variables (score, health, counters...) ----
  const vars = { points: 0, health: 100, coins: 0 };
  const score = { get points() { return vars.points; }, set points(v) { vars.points = v; } };
  const scoreEl = el('rt-score hidden');
  const boardEl = el('rt-board hidden');
  const healthEl = el('rt-health hidden', '<i></i><span></span>');
  const countdownEl = el('rt-countdown hidden');
  const timerEl = el('rt-timer hidden');
  let boardOn = false;
  const setScore = () => { scoreEl.textContent = `⭐ ${vars.points} points`; scoreEl.classList.remove('hidden'); renderBoard(); };
  function renderBoard() {
    if (!boardOn) return;
    const keys = Object.keys(vars).filter(k => k !== 'health' && (k !== 'coins' || vars.coins));
    boardEl.innerHTML = `<b>🏆 Leaderboard</b><table><tr><th>Player</th>${keys.map(k => `<th>${k[0].toUpperCase() + k.slice(1)}</th>`).join('')}</tr><tr><td>You</td>${keys.map(k => `<td>${Math.round(vars[k] * 100) / 100}</td>`).join('')}</tr></table>`;
    boardEl.classList.remove('hidden');
  }
  const renderHealth = () => { healthEl.classList.remove('hidden'); healthEl.querySelector('i').style.width = `${Math.max(0, vars.health)}%`; healthEl.querySelector('span').textContent = `❤️ ${Math.max(0, Math.round(vars.health))}`; };
  const setVar = (name, v) => { vars[name] = Math.round(v * 1000) / 1000; if (name === 'points') setScore(); else if (name === 'health') { if (vars.health <= 0) { vars.health = 100; respawn('You died!'); } renderHealth(); } else renderBoard(); };
  const getVar = (name) => vars[name] ?? 0;
  const fillText = (text) => String(text).replace(/\{(\w+)\}/g, (_, k) => getVar(k === 'score' ? 'points' : k));

  // ---- colliders ----
  const entries = [...world.entries.values()].filter(e => !e.isGroup); // groups (Models) are only containers
  const solidOf = (e) => e.inst.collide !== false && e.inst.type !== 'coin';
  function refreshCollider(e) {
    if (e.collider) collision.removeConvex(e.collider);
    e.convex = computeCollider(e); e.collider = null;
    if (e.visible !== false && e.solid !== false && solidOf(e)) e.collider = collision.addConvex(e.convex);
  }
  const initEntry = (e) => { e.visible = true; e.solid = e.inst.collide !== false; refreshCollider(e); e.home = { pos: e.root.position.clone(), rot: e.root.rotation.clone() }; };
  entries.forEach(initEntry);
  const byName = (name) => entries.find(e => e.inst.name.toLowerCase() === String(name).toLowerCase() && !e.spawned);
  const topOf = (e) => { const b = e.convex.aabb; return new THREE.Vector3((b.minX + b.maxX) / 2, b.maxY + 0.05, (b.minZ + b.maxZ) / 2); };
  const resolvePoint = (self) => (p) => {
    if (p === 'self') return self.home.pos.clone();
    if (Array.isArray(p)) return new THREE.Vector3(...p);
    const t = byName(p); return t ? t.home.pos.clone() : null;
  };
  entries.forEach(e => { e.motion = new Motion(e, resolvePoint(e)); });

  // ---- spawn / respawn ----
  const spawnE = entries.find(e => e.inst.type === 'spawn');
  const spawn = spawnE ? topOf(spawnE) : new THREE.Vector3(0, world.env.floorY == null ? 10 : 0.1, 0);
  let respawnPoint = spawn.clone(), lastCheckpoint = null;
  const flash = el('rt-flash');
  const backpack = new Backpack(engine.player, avatar, () => renderHotbar(), { gameId: doc.id, creatorGears: creatorGearsOf(doc) });
  const timed = {}; // speed/jump/gravity effects from scripts
  const baseMods = () => gearMods(backpack.equipped);
  function resetEffects() { for (const k of Object.keys(timed)) { clearTimeout(timed[k]); delete timed[k]; } const b = baseMods(); Object.assign(engine.player.mods, { speed: b.speed, gravity: b.gravity, jump: b.jump }); }
  let dying = false;
  function respawn(msg = 'Oof!') {
    engine.player.teleport(respawnPoint.clone(), engine.player.facing);
    flash.classList.remove('on'); void flash.offsetWidth; flash.classList.add('on');
    playSfx('pop'); if (msg) bus.emit('toast', { text: msg, icon: '💥' });
    resetEffects();
    if (!dying) { dying = true; try { fireAll('death'); } finally { dying = false; } }
  }

  // ---- gears hotbar ----
  const hotbar = el('rt-hotbar');
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
  const playing = new Map();
  function playAnimation(instId, ref, loop = true) {
    const e = world.entries.get(instId); if (!e?.rig) return false;
    if (typeof ref === 'string' && ref.startsWith('clip:')) { e.rig.playClip(ref.slice(5), loop); playing.set(instId, { mixer: true }); return true; }
    const anim = anims.find(a => a.id === ref || a.name.toLowerCase() === String(ref).toLowerCase());
    if (anim) { playing.set(instId, { anim, t: 0, loop }); return true; }
    if (e.rig.clips?.length) { const c = e.rig.clips.find(c => c.name.toLowerCase() === String(ref).toLowerCase()) || e.rig.clips[0]; e.rig.playClip(c.name, loop); playing.set(instId, { mixer: true }); return true; }
    return false;
  }
  entries.forEach(e => { if (e.rig && e.inst.autoplay) playAnimation(e.inst.id, e.inst.autoplay, true); });

  // ---- tweens, effects, spawned parts ----
  const tweens = []; const bursts = []; const spawned = [];
  const meshesOf = (e) => { const out = []; e.root.traverse(o => { if (o.isMesh && o.material && !o.userData.fx) out.push(o); }); return out; };
  function tweenColor(e, color, seconds) {
    for (const o of meshesOf(e)) {
      const from = o.material.color.clone(), to = new THREE.Color(color), emissive = o.material.emissiveIntensity > 0;
      if (!seconds) { o.material.color.copy(to); if (emissive) o.material.emissive.copy(to); continue; }
      let t = 0; tweens.push((dt) => { t += dt; const k = Math.min(1, t / seconds); o.material.color.copy(from).lerp(to, k); if (emissive) o.material.emissive.copy(o.material.color); return k < 1; });
    }
  }
  function tweenOpacity(e, transparency, seconds) {
    for (const o of meshesOf(e)) {
      o.material.transparent = true; o.material.depthWrite = transparency < 0.5;
      const from = o.material.opacity, to = 1 - transparency;
      if (!seconds) { o.material.opacity = to; continue; }
      let t = 0; tweens.push((dt) => { t += dt; const k = Math.min(1, t / seconds); o.material.opacity = from + (to - from) * k; return k < 1; });
    }
  }
  const later = (sec, fn) => { let t = 0; tweens.push((dt) => { t += dt; if (t >= sec) { fn(); return false; } return true; }); };
  function setLight(e, on, color) {
    if (!e.light) { e.light = new THREE.PointLight(color || e.inst.color || '#ffffff', 0, 40, 1.5); e.light.userData.fx = true; e.root.add(e.light); }
    if (color) e.light.color.set(color);
    e.light.intensity = on ? 30 : 0;
    for (const o of meshesOf(e)) if (o.material.emissive) { o.material.emissive.copy(on ? (color ? new THREE.Color(color) : o.material.color) : new THREE.Color('#000')); o.material.emissiveIntensity = on ? 1 : 0; }
  }
  function spawnPart(a, src) {
    if (spawned.length >= 40) { const old = spawned.shift(); removeEntry(old); }
    const top = topOf(src);
    let inst;
    if (a.what === 'clone' && a.target) { const t = byName(a.target); if (!t) return; inst = JSON.parse(JSON.stringify(t.inst)); inst.id = newId(); inst.scripts = []; inst.pos = [top.x + (Math.random() - 0.5), top.y + inst.size[1] / 2 + 0.5, top.z + (Math.random() - 0.5)]; inst.anchored = false; }
    else if (a.what === 'coin') inst = makeInstance('coin', { pos: [top.x, top.y + 1, top.z] });
    else inst = makeInstance('part', { shape: a.what === 'ball' ? 'sphere' : 'box', size: a.what === 'ball' ? [2, 2, 2] : [2, 2, 2], color: a.color && a.color !== 'random' ? a.color : (a.kill ? '#ff4a1c' : new THREE.Color().setHSL(Math.random(), 0.7, 0.55).getHexString().replace(/^/, '#')), material: a.kill ? 'lava' : 'plastic', kill: !!a.kill, anchored: false, pos: [top.x + (Math.random() - 0.5) * 0.6, top.y + 1.5, top.z + (Math.random() - 0.5) * 0.6], name: 'Spawned' });
    const e = world.add(inst); e.spawned = true; initEntry(e); e.motion = new Motion(e, resolvePoint(e)); e.life = 20;
    entries.push(e); spawned.push(e);
  }
  function removeEntry(e) { if (e.collider) collision.removeConvex(e.collider); world.remove(e.inst.id); const i = entries.indexOf(e); if (i >= 0) entries.splice(i, 1); }

  // countdown / timer
  let countdown = null, timer = null;
  function startCountdown(seconds) { countdown = { left: seconds }; countdownEl.classList.remove('hidden'); }

  // ---- script actions ----
  let gotBucks = 0;
  const api = {
    respawn, playAnimation, vars, getVar, setVar,
    toast: (text) => bus.emit('toast', { text, icon: '💬' }),
    setVisible(id, v) { const e = world.entries.get(id); if (!e) return; e.visible = v; e.root.visible = v; refreshCollider(e); },
    check(cond) { if (cond.gear) return backpack.items.includes(cond.gear); return compare(getVar(cond.var), cond.op, cond.value); },
    /** run one action; returns seconds the script should wait afterwards (e.g. countdowns) */
    act(a, runner) {
      const self = runner.entry; const target = a.target ? byName(a.target) : self;
      const p = engine.player;
      const timedMod = (key, mult, seconds) => {
        clearTimeout(timed[key]); p.mods[key] = baseMods()[key] * mult;
        if (seconds) timed[key] = setTimeout(() => { p.mods[key] = baseMods()[key]; delete timed[key]; }, seconds * 1000);
      };
      switch (a.do) {
        case 'kill': respawn('Oof!'); break;
        case 'damage': setVar('health', vars.health - a.amount); flash.classList.remove('on'); void flash.offsetWidth; flash.classList.add('on'); playSfx('buzz'); break;
        case 'heal': setVar('health', Math.min(100, vars.health + a.amount)); playSfx('chime'); break;
        case 'color': if (target) { const pick = a.choices?.length ? a.choices[Math.floor(Math.random() * a.choices.length)] : a.color; const c = pick === 'random' || pick === 'rainbow' ? new THREE.Color().setHSL(Math.random(), 0.8, 0.55) : new THREE.Color(pick); tweenColor(target, c, a.seconds); } break;
        case 'hide': if (target) { api.setVisible(target.inst.id, false); if (a.seconds) later(a.seconds, () => api.setVisible(target.inst.id, true)); } break;
        case 'show': if (target) { api.setVisible(target.inst.id, true); } break;
        case 'points': setVar('points', vars.points + (a.max ? Math.floor(a.min + Math.random() * (a.max - a.min + 1)) : a.amount)); break;
        case 'setVar': setVar(a.name, a.value); break;
        case 'addVar': setVar(a.name, getVar(a.name) + a.amount); break;
        case 'multVar': setVar(a.name, getVar(a.name) * a.factor); break;
        case 'bucks': { const n = Math.min(a.amount, 50 - gotBucks); if (n > 0 && !runner._paid) { runner._paid = true; gotBucks += n; economy.earn(n, `Reward in ${doc.name}`); } break; }
        case 'message': bus.emit('toast', { text: fillText(a.text), icon: '💬' }); break;
        case 'sound': playSfx(a.sound); break;
        case 'teleport': {
          let to = null;
          if (a.toPart) { const t = byName(a.toPart); if (t) to = topOf(t); }
          else if (Array.isArray(a.to)) to = new THREE.Vector3(...a.to);
          else if (a.up) to = p.pos.clone().add(new THREE.Vector3(0, a.up, 0));
          else if (a.to === 'checkpoint') to = respawnPoint.clone();
          else if (a.to === 'randomCheckpoint') { const cps = entries.filter(e => e.inst.type === 'checkpoint'); to = cps.length ? topOf(cps[Math.floor(Math.random() * cps.length)]) : spawn.clone(); }
          else to = spawn.clone();
          if (to) { p.teleport(to, p.facing); playSfx('whoosh'); }
          break;
        }
        case 'bounce': p.vel.y = a.power; p.onGround = false; playSfx('jump'); break;
        case 'speed': timedMod('speed', a.mult, a.seconds); break;
        case 'jump': timedMod('jump', a.mult, a.seconds); break;
        case 'gravity': timedMod('gravity', a.mult, a.seconds); break;
        case 'transparency': if (target) tweenOpacity(target, a.value, a.seconds); break;
        case 'collide': if (target) { target.solid = !!a.value; refreshCollider(target); } break;
        case 'glow': if (target) for (const o of meshesOf(target)) if (o.material.emissive) { o.material.emissive.set(a.color && a.color !== 'random' ? a.color : o.material.color); o.material.emissiveIntensity = 1.2; } break;
        case 'light': if (target) setLight(target, a.on, a.color); break;
        case 'particles': if (target) { const b = new THREE.Box3().setFromObject(target.root); const c = b.getCenter(new THREE.Vector3()); c.y = b.max.y; bursts.push(new Burst(scene, a.kind, c, a.seconds)); } break;
        case 'door': {
          const d = target || self; if (!d) break;
          const close = () => { d.solid = d.inst.collide !== false; refreshCollider(d); if (d.doorStyle === 'slide') d.motion.goBack(0.6); else tweenOpacity(d, d.inst.transparency || 0, 0.2); d.doorOpen = false; };
          if (a.close) { if (d.doorOpen) close(); break; }
          d.doorStyle = a.style; d.doorOpen = true; d.solid = false; refreshCollider(d); playSfx('click');
          if (a.style === 'slide') d.motion.moveBy([0, d.inst.size[1] + 0.2, 0], 0.6); else tweenOpacity(d, 0.75, 0.2);
          clearTimeout(d._doorT); if (a.seconds) d._doorT = setTimeout(close, a.seconds * 1000);
          break;
        }
        case 'checkpoint': respawnPoint = topOf(self); break;
        case 'win': bus.emit('toast', { text: fillText(a.text), icon: '🏆' }); playSfx('win'); bursts.push(new Burst(scene, 'confetti', p.pos.clone().add(new THREE.Vector3(0, 3, 0)), 0)); if (timer) timer.running = false; break;
        case 'animation': playAnimation((target || self).inst.id, a.name, a.loop); break;
        case 'moveBy': if (target) target.motion.moveBy(a.offset, a.seconds); break;
        case 'moveTo': if (target) { const pt = resolvePoint(target)(a.to); if (pt) { if (typeof a.to === 'string' && a.to !== 'self') { const t = byName(a.to); if (t) pt.y = t.convex.aabb.maxY + (target.convex.aabb.maxY - target.convex.aabb.minY) / 2; } target.motion.moveTo(pt, a.seconds); } } break;
        case 'return': if (target) target.motion.goBack(a.seconds); return a.seconds || 0;
        case 'spin': if (target) target.motion.spin(a.axis, a.speed, a.seconds); break;
        case 'stop': if (target) target.motion.stop(); break;
        case 'resume': if (target) target.motion.resume(); break;
        case 'fall': if (target) {
          target.falling = true; target.resting = false; target.vy = 0;
          if (a.seconds) later(a.seconds + 0.01, () => { target.falling = false; target.resting = false; target.vy = 0; target.root.position.copy(target.home.pos); target.root.rotation.copy(target.home.rot); target.visible = true; target.root.visible = true; refreshCollider(target); });
        } break;
        case 'spawn': for (let i = 0; i < a.count; i++) spawnPart(a, self); break;
        case 'countdown': startCountdown(a.seconds); return a.seconds;
        case 'timer': if (a.start) { timer = { t: a.reset || !timer ? 0 : timer.t, running: true }; timerEl.classList.remove('hidden'); } else if (timer) timer.running = false; break;
        case 'leaderboard': boardOn = !!a.show; if (boardOn) renderBoard(); else boardEl.classList.add('hidden'); break;
      }
      // moving a part along a tween makes the action take that long only for 'return'
      if ((a.do === 'moveBy' || a.do === 'moveTo') && a.seconds) return a.seconds;
      return 0;
    },
  };
  const runners = [];
  const names = entries.map(e => e.inst.name);
  for (const e of entries) for (const s of e.inst.scripts || []) {
    if (s.enabled === false) continue;
    const program = translate(s.text || '', { names }).program; // re-translate so older saves get newer phrases
    const r = new ScriptRunner(e.inst, e, (s.text ? program : s.program) || program, api); runners.push(r); (e.runners ||= []).push(r);
  }
  const fireAll = (type, src = null) => { for (const r of runners) r.fire(type, src); };
  const fireOn = (type, e) => { for (const r of runners) r.fire(type, e); };
  runners.forEach(r => r.start());
  const clickable = () => entries.filter(e => e.visible && runners.some(r => r.program.rules.some(x => (x.trigger.type === 'click' || x.trigger.type === 'press') && (x.trigger.part ? x.trigger.part.toLowerCase() === e.inst.name.toLowerCase() : r.entry === e))));

  // ---- mobile controls ----
  let touchUI = null;
  const coarse = window.matchMedia?.('(pointer: coarse)').matches || window.__forceTouch;
  if (doc.mobile && coarse) {
    touchUI = el('rt-touch', '<div class="joy" id="rt-joy"><div class="knob"></div></div><button class="jump" id="rt-jump">⤒</button>');
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
  // Only ONE set of touch controls: when the app's shared joystick (ui/touchControls.js, #touch-ui,
  // shown in Mobile mode) is active, hide these runtime controls; they remain for coarse-pointer
  // devices in Computer mode (where #touch-ui is hidden) and builds without the shared controls.
  const syncTouch = () => {
    if (!touchUI) return;
    const shared = typeof document !== 'undefined' && document.getElementById('touch-ui') && getDeviceMode() === 'mobile';
    touchUI.style.display = shared ? 'none' : '';
    if (shared) { touchUI.querySelector('.knob').style.transform = ''; }
  };
  syncTouch();
  const offDevice = touchUI ? onDeviceChange(syncTouch) : null;

  // ---- per-frame ----
  const touching = new Set();
  const tmpAabb = (p, pad) => [p.x - HW - pad, p.y - pad, p.z - HW - pad, p.x + HW + pad, p.y + H + pad, p.z + HW + pad];
  const before = new THREE.Matrix4(), delta = new THREE.Matrix4(), q = new THREE.Quaternion(), eul = new THREE.Euler();
  const pickHit = (ray, list) => { const meshes = []; for (const e of list) e.root.traverse(o => { if (o.isMesh && !o.userData.fx) meshes.push(o); }); const h = ray.intersectObjects(meshes, false)[0]; return h ? entries.find(e => e.inst.id === world.idFromObject(h.object)) : null; };

  return {
    scene, collision, spawn, spawnFacing: 0, music: doc.music || 'none', doc, runtime: true, score, vars,
    world, backpack, api, runners, entries, fireAll,
    onFall: () => respawn('You fell!'),
    onClick({ ray, button }) {
      if (button !== 0) return;
      const e = pickHit(ray, clickable()); if (!e) return;
      fireOn('click', e); fireOn('press', e); playSfx('click');
    },
    onHover(ray) { const c = clickable(); engine.renderer.domElement.style.cursor = c.length && pickHit(ray, c) ? 'pointer' : ''; },
    update(dt, t, player) {
      world.update(dt, player.pos);
      const feet = tmpAabb({ x: player.pos.x, y: player.pos.y - 0.15, z: player.pos.z }, -0.02);
      // scripts first (they start tweens), then motion with platform riding
      for (const r of runners) { r.update(dt); r.checkReach(getVar); }
      for (const e of entries) {
        if (!e.motion?.active) continue;
        const standing = player.onGround && e.visible && e.convex && aabbVsConvex(...feet, e.convex);
        e.root.updateMatrixWorld(true); before.copy(e.root.matrixWorld);
        if (!e.motion.update(dt)) continue;
        e.root.updateMatrixWorld(true);
        refreshCollider(e);
        if (standing) {
          // carry the player with the platform: same translation + rotation (and turn the camera with it)
          delta.copy(e.root.matrixWorld).multiply(before.clone().invert());
          player.pos.applyMatrix4(delta);
          q.setFromRotationMatrix(delta); eul.setFromQuaternion(q, 'YXZ');
          if (Math.abs(eul.y) > 1e-6) { player.facing += eul.y; player.camYaw += eul.y; if (avatar?.root) avatar.root.rotation.y += eul.y; }
        } else if (e.collider && aabbVsConvex(...tmpAabb(player.pos, 0), e.convex)) {
          // a moving part pushed into the player: shove them along with it
          const d = new THREE.Vector3().setFromMatrixPosition(e.root.matrixWorld).sub(new THREE.Vector3().setFromMatrixPosition(before));
          player.pos.add(d); if (collision.overlaps(...tmpAabb(player.pos, 0))) player.pos.y += 0.1;
        }
        if (standing || e.collider) { /* keep avatar glued to the carried position */ avatar.root.position.copy(player.pos); }
      }
      // unanchored / falling parts
      for (const e of entries) {
        if ((e.inst.anchored !== false && !e.falling) || e.resting || !e.visible) continue;
        e.vy = (e.vy || 0) - 30 * dt; const dy = Math.max(-30, e.vy) * dt;
        e.root.position.y += dy; e.convex = computeCollider(e);
        const b = e.convex.aabb;
        const hitFloor = world.env.floorY != null && b.minY <= world.env.floorY;
        const hit = hitFloor || collision.convexes.some(c => c !== e.collider && aabbVsConvex(b.minX + 0.05, b.minY, b.minZ + 0.05, b.maxX - 0.05, b.maxY, b.maxZ - 0.05, c));
        if (hit) { e.root.position.y -= dy; e.resting = true; e.vy = 0; }
        refreshCollider(e);
        if (e.root.position.y < -60) { e.visible = false; e.root.visible = false; refreshCollider(e); }
      }
      for (const e of [...spawned]) { e.life -= dt; if (e.life <= 0 || !e.visible) { removeEntry(e); spawned.splice(spawned.indexOf(e), 1); } }
      // tweens / particles / countdown / timer
      for (let i = tweens.length - 1; i >= 0; i--) if (!tweens[i](dt)) tweens.splice(i, 1);
      for (let i = bursts.length - 1; i >= 0; i--) if (!bursts[i].update(dt)) bursts.splice(i, 1);
      if (countdown) { countdown.left -= dt; countdownEl.textContent = `⏳ ${Math.max(0, Math.ceil(countdown.left))}`; if (countdown.left <= 0) { countdown = null; countdownEl.classList.add('hidden'); playSfx('alarm'); fireAll('countdownEnd'); } }
      if (timer?.running) { timer.t += dt; timerEl.textContent = `⏱ ${timer.t.toFixed(1)}s`; }
      // animations
      for (const e of entries) if (e.rig?.mixer) e.rig.mixer.update(dt);
      for (const [id, st] of playing) { if (st.anim) { st.t += dt; sampleAnimation({ ...st.anim, loop: st.loop }, world.entries.get(id).rig, st.t); } }
      // touches / enter / leave
      const box = tmpAabb(player.pos, 0.08);
      for (const e of [...entries]) {
        if (!e.visible || !e.convex) { if (touching.delete(e.inst.id)) fireOn('leave', e); continue; }
        const hit = aabbVsConvex(...box, e.convex);
        if (!hit) { if (touching.delete(e.inst.id)) fireOn('leave', e); continue; }
        const first = !touching.has(e.inst.id); touching.add(e.inst.id);
        const inst = e.inst;
        if (inst.kill || inst.material === 'lava') { respawn('Oof!'); touching.clear(); return; }
        if (inst.type === 'coin') { e.visible = false; e.root.visible = false; economy.earn(inst.value || 5, 'Pickup'); setVar('coins', vars.coins + 1); playSfx('coin'); continue; }
        if (first && inst.type === 'checkpoint' && lastCheckpoint !== inst.id) { lastCheckpoint = inst.id; respawnPoint = topOf(e); bus.emit('toast', { text: `Checkpoint ${inst.order || ''} reached!`, icon: '🚩' }); playSfx('chime'); }
        if (first && inst.type === 'gear' && GEARS[inst.gearId] && backpack.give(inst.gearId)) { bus.emit('toast', { text: `You got the ${GEARS[inst.gearId].name}! Press ${backpack.items.length} to equip`, icon: GEARS[inst.gearId].icon }); playSfx('ding'); }
        if (first) { fireOn('enter', e); fireOn('press', e); }
        fireOn('touch', e);
      }
    },
    dispose() {
      removeEventListener('keydown', onKey); offDevice?.(); backpack.clear(); resetEffects(); ui.remove();
      engine.input.analog = null; engine.input.keys.delete('Space'); engine.renderer.domElement.style.cursor = '';
      for (const b of bursts) scene.remove(b.points);
      for (const e of entries) clearTimeout(e._doorT);
    },
  };
}
