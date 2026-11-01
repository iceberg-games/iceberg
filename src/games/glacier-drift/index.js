// Game: Glacier Drift — 4-sled race down a sunny glacier with power-ups (QoL update, no event).
// Steer with A/D (or touch joystick), hop with Space / Jump, use the held power-up with E/Shift or the big
// USE button: 🚀 Boost, 🛡️ Shield (blocks bonks + freezes), 🧲 Magnet (pulls orbs + gates), ❄️ Freeze (ices the
// rival ahead). Thread gates (−0.35s), launch off kickers, dodge powder piles. Place + time → 1-3 stars; BB stubs.
// Module map: config.js, track.js (procedural course), audio.js (Sound pack ./sfx + procedural fallback), ui.js.
import * as THREE from 'three';
import { GAME_ID, REWARD_SOURCE, FIRST_FINISH_BB, FIRST_WIN_BB, THREE_STAR_BB, PHYS, POWER, POWER_IDS, RIVALS, GATE_BONUS, starsFor, normalizeSave, mergeSaves } from './config.js';
import { buildTrack, LENGTH, HALF, worldAt, heightAt, centerX } from './track.js';
import { GlacierAudio } from './audio.js';
import { GlacierUI } from './ui.js';
import { getDeviceMode } from '../../core/device.js';
import THUMB from './thumb.js';
import CREDITS from './CREDITS.md?raw';

const tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3();
function persist(economy, save) {
  if (typeof economy.saveGameData === 'function') return economy.saveGameData(GAME_ID, save);
  economy.profile.gameData = { ...(economy.profile.gameData || {}), [GAME_ID]: save };
  economy.backend?.saveProfile?.(economy.profile); return Promise.resolve({ ok: true });
}
function buildSled(color = '#e0435f', rider = null) {
  const g = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: '#c98a4b', roughness: 0.6 }), trim = new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.3 });
  for (let i = 0; i < 5; i++) { const s = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.08, 0.32), wood); s.position.set(0, 0.42, -0.9 + i * 0.4); g.add(s); }
  for (const x of [-0.5, 0.5]) {
    const r = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 2.2), trim); r.position.set(x, 0.06, 0); g.add(r);
    const tip = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.04, 6, 12, Math.PI), trim); tip.rotation.y = Math.PI / 2; tip.position.set(x, 0.28, -1.1); g.add(tip);
    for (const z of [-0.6, 0.6]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.36, 0.06), trim); p.position.set(x, 0.24, z); g.add(p); }
  }
  if (rider) { // blocky penguin rider for rivals
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.0, 0.7), new THREE.MeshStandardMaterial({ color: '#1d2b3a' })); body.position.y = 1.0; g.add(body);
    const belly = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.8, 0.05), new THREE.MeshStandardMaterial({ color: '#ffffff' })); belly.position.set(0, 0.95, -0.36); g.add(belly);
    const hat = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.6, 8), trim); hat.position.y = 1.8; g.add(hat);
    const pom = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), new THREE.MeshStandardMaterial({ color: '#fff' })); pom.position.y = 2.12; g.add(pom);
    const beak = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.3, 4), new THREE.MeshStandardMaterial({ color: '#ffb02e' })); beak.rotation.x = -Math.PI / 2; beak.position.set(0, 1.25, -0.48); g.add(beak);
  }
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return g;
}
class Particles {
  constructor(scene, n = 1400) {
    this.n = n; this.i = 0; this.p = new Float32Array(n * 3); this.v = new Float32Array(n * 3); this.life = new Float32Array(n); this.col = new Float32Array(n * 3);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(this.p, 3)); g.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    const c = document.createElement('canvas'); c.width = c.height = 32; const x = c.getContext('2d'), r = x.createRadialGradient(16, 16, 0, 16, 16, 16);
    r.addColorStop(0, '#fff'); r.addColorStop(0.4, 'rgba(255,255,255,.6)'); r.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = r; x.fillRect(0, 0, 32, 32);
    this.mat = new THREE.PointsMaterial({ size: 0.4, vertexColors: true, transparent: true, depthWrite: false, map: new THREE.CanvasTexture(c) });
    this.pts = new THREE.Points(g, this.mat); this.pts.frustumCulled = false; scene.add(this.pts); this.g = g; this.p.fill(-9999);
  }
  emit(pos, vel, spread, color, life = 0.8) {
    const k = this.i = (this.i + 1) % this.n;
    this.p.set([pos.x, pos.y, pos.z], k * 3);
    this.v.set([vel.x + (Math.random() - 0.5) * spread, vel.y + Math.random() * spread * 0.7, vel.z + (Math.random() - 0.5) * spread], k * 3);
    this.col.set([color.r, color.g, color.b], k * 3); this.life[k] = life * (0.6 + Math.random() * 0.6);
  }
  update(dt) {
    const { p, v, life, col } = this;
    for (let k = 0; k < this.n; k++) {
      if (life[k] <= 0) continue; life[k] -= dt; const j = k * 3;
      v[j + 1] -= 9 * dt; v[j] *= 0.97; v[j + 2] *= 0.97; p[j] += v[j] * dt; p[j + 1] += v[j + 1] * dt; p[j + 2] += v[j + 2] * dt;
      if (life[k] <= 0) p[j + 1] = -9999; else if (life[k] < 0.3) { col[j] *= 0.92; col[j + 1] *= 0.92; col[j + 2] *= 0.92; }
    }
    this.g.attributes.position.needsUpdate = true; this.g.attributes.color.needsUpdate = true;
  }
  dispose() { this.g.dispose(); this.mat.map.dispose(); this.mat.dispose(); }
}
const C = (h) => new THREE.Color(h);
const C_POWDER = C('#cfe6ff'), C_GOLD = C('#ffd84a'), C_CYAN = C('#7fe3ff'), C_PINK = C('#ff7ad9'), C_ICE = C('#bfe0ff');
const PCOL = Object.fromEntries(POWER_IDS.map(k => [k, C(POWER[k].color)]));

export default {
  id: GAME_ID,
  name: 'Glacier Drift',
  tagline: 'Sled race with power-ups — boost, shield, magnet, freeze!',
  description: 'Race three cheeky penguin rivals down a sparkling glacier. Grab power-ups — rocket boost, bubble shield, orb magnet and rival freeze — thread glowing gates, launch off kickers and drift to 1st place.',
  thumbnail: THUMB || 'frost',
  music: 'none', credits: CREDITS, features: {}, mobile: true, hideAvatar: false,

  async create(ctx) {
    const { engine, economy, music, avatar } = ctx;
    const player = engine.player, input = engine.input, cam = engine.camera;
    const mobile = getDeviceMode() === 'mobile';
    const camFar = cam.far, camFov = cam.fov;
    const track = buildTrack(); const scene = track.scene, items = track.items;
    cam.far = Math.max(camFar, 1400); cam.updateProjectionMatrix();

    const sled = buildSled('#2f9bea'); scene.add(sled);
    const shieldBubble = new THREE.Mesh(new THREE.SphereGeometry(1.9, 20, 14), new THREE.MeshBasicMaterial({ color: '#7fe3ff', transparent: true, opacity: 0.22, depthWrite: false })); scene.add(shieldBubble);
    const iceBlock = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.6, 2.8), new THREE.MeshStandardMaterial({ color: '#bfe8ff', transparent: true, opacity: 0.55, roughness: 0.05, metalness: 0.2 }));
    const fx = new Particles(scene);
    const audio = new GlacierAudio(music);
    const ui = new GlacierUI(mobile, () => usePower(S));

    let disposed = false;
    let save = normalizeSave(economy.cachedGameData ? economy.cachedGameData(GAME_ID) : economy.profile?.gameData?.[GAME_ID]);
    if (typeof economy.loadGameData === 'function') economy.loadGameData(GAME_ID).then(d => { if (!disposed) { save = mergeSaves(save, d); if (mode === 'intro') showIntro(); } }).catch(() => {});

    // ---- racers: S = player, rivals = AI ----
    const mkRacer = (o) => ({ d: 0, off: 0, v: 0, vLat: 0, y: 0, vy: 0, air: false, airT: 0, tumble: 0, spin: 0, lean: 0, held: null, fx: {}, finished: null, ...o });
    const S = mkRacer({ me: true, name: 'You', color: '#2f9bea', airTotal: 0, gates: 0, crashes: 0, powers: 0, shake: 0, whooshT: 0, steerPrev: 0, lastG: 0, lastVyg: 0, pos: new THREE.Vector3(), time: 0 });
    const rivals = RIVALS.map((r, i) => { const m = buildSled(r.color, true); scene.add(m); const b = iceBlock.clone(); b.material = iceBlock.material; b.visible = false; scene.add(b);
      return mkRacer({ ...r, mesh: m, block: b, lane: (i - 1) * 4, wob: Math.random() * 9, useT: 0, pos: new THREE.Vector3() }); });
    const racers = [S, ...rivals];
    ui.setRacers(racers.map(r => r.color));
    const myBlock = iceBlock; myBlock.visible = false; scene.add(myBlock);
    let mode = 'intro', countdown = 0, lastCount = 0, raceT = 0, finishOrder = [];

    function resetRun() {
      track.reset(); finishOrder = []; raceT = 0;
      Object.assign(S, { d: 4, off: 0, v: 0, vLat: 0, vy: 0, air: false, airT: 0, airTotal: 0, tumble: 0, spin: 0, lean: 0, time: 0, gates: 0, crashes: 0, powers: 0, shake: 0, held: null, fx: {}, finished: null });
      S.y = heightAt(S.d, 0); S.lastG = S.y; S.lastVyg = 0;
      rivals.forEach((r, i) => Object.assign(r, { d: 3 + i * 0.6, off: r.lane, v: 0, vLat: 0, y: heightAt(3, r.lane), vy: 0, air: false, tumble: 0, spin: 0, held: null, fx: {}, finished: null, useT: 2 + Math.random() * 3 }));
      rivals[1].off = -6; rivals[0].off = 6; S.off = 0; rivals[2].off = -3;
      place(0);
    }
    function showIntro() { mode = 'intro'; ui.showHud(false); resetRun(); audio.music_('bgm_glacier-lobby'); ui.showIntro(save, () => startRun()); }
    function startRun() {
      audio.ctx?.resume?.(); audio.play('sfx_pickup', 0.6); audio.music_('bgm_glacier-drift');
      ui.hideCard(); resetRun(); mode = 'count'; countdown = 3.0; lastCount = 4; ui.showHud(true);
    }
    const placeOf = () => 1 + finishOrder.filter(r => !r.me).length + (S.finished != null ? 0 : rivals.filter(r => r.finished == null && r.d > S.d).length);
    function finish() {
      S.finished = S.time; finishOrder.push(S); mode = 'result'; ui.showHud(false);
      const plc = finishOrder.indexOf(S) + 1, time = S.time, stars = starsFor(time, plc), newBest = save.best == null || time < save.best;
      const rewards = [];
      audio.play('sfx_finish'); ui.flash('rgba(255,215,90,.6)');
      for (let i = 0; i < 160; i++) fx.emit(tmp.copy(S.pos).add(tmp2.set(0, 2, 0)), tmp2.set(0, 9, 0), 16, [C_GOLD, C_CYAN, C_PINK][i % 3], 2.2);
      // BB stubs (one-time; Publisher owns caps)
      if (!save.cleared) { economy.earn?.(FIRST_FINISH_BB, 'Glacier Drift: first finish', { source: REWARD_SOURCE }); rewards.push(`+${FIRST_FINISH_BB} BB first finish`); save.cleared = true; }
      if (plc === 1 && !save.won) { economy.earn?.(FIRST_WIN_BB, 'Glacier Drift: first win', { source: REWARD_SOURCE }); rewards.push(`+${FIRST_WIN_BB} BB first win 🏆`); save.won = true; }
      if (stars === 3 && !save.threeStar) { economy.earn?.(THREE_STAR_BB, 'Glacier Drift: first 3-star', { source: REWARD_SOURCE }); rewards.push(`+${THREE_STAR_BB} BB ⭐⭐⭐`); save.threeStar = true; }
      save.runs++; if (plc === 1) save.wins++; save.stars = Math.max(save.stars, stars); if (newBest) save.best = time;
      persist(economy, save).catch(() => {});
      // project rival times for the board
      const board = [...racers].map(r => ({ r, t: r.finished ?? (S.time + (LENGTH - r.d) / Math.max(20, r.v)) })).sort((a, b) => a.t - b.t);
      const meIdx = board.findIndex(b => b.r === S); board.splice(meIdx, 1); board.splice(plc - 1, 0, { r: S, t: time });
      ui.showResult({ time, stars, newBest, place: plc, gates: S.gates, total: items.gates.length, air: S.airTotal, crashes: S.crashes, powers: S.powers, rewards,
        board: board.map(b => ({ name: b.r.name, color: b.r.color, time: b.t, me: b.r.me })) },
        (again) => { audio.play('sfx_pickup', 0.5); again ? startRun() : showIntro(); }, (i) => audio.play('sfx_star', 1, 1 + i * 0.12));
    }

    // ---- power-ups ----
    function grant(r, kind) {
      if (r.held) return false; r.held = kind;
      if (r.me) { S.powers++; audio.play('sfx_pickup'); ui.pop(`${POWER[kind].icon} ${POWER[kind].label}!`); ui.flash(POWER[kind].color + '66'); }
      return true;
    }
    function usePower(r) {
      if (!r.held || mode !== 'run' || r.fx.freeze > 0) return; const k = r.held; r.held = null;
      const P = POWER[k];
      if (k === 'boost') { r.fx.boost = P.secs; r.v = Math.min(PHYS.maxSpeed * 1.35, r.v + 12); }
      if (k === 'shield') r.fx.shield = P.secs;
      if (k === 'magnet') r.fx.magnet = P.secs;
      if (k === 'freeze') {
        // ice the nearest racer ahead (or the closest behind if leading)
        const others = racers.filter(o => o !== r && o.finished == null);
        const ahead = others.filter(o => o.d > r.d).sort((a, b) => a.d - b.d)[0] || others.sort((a, b) => Math.abs(a.d - r.d) - Math.abs(b.d - r.d))[0];
        if (ahead) {
          if (ahead.fx.shield > 0) { ahead.fx.shield = 0; if (ahead.me || r.me) { audio.play('sfx_shield'); ui.pop('🛡️ Blocked!'); } }
          else { ahead.fx.freeze = P.secs; ahead.v *= 0.35; if (ahead.me) { ui.say('FROZEN!', `${r.name} iced you`, 1100); S.shake = 0.5; } else if (r.me) ui.pop(`❄️ Froze ${ahead.name}!`); }
          for (let i = 0; i < 50; i++) fx.emit(tmp.copy(ahead.pos).add(tmp2.set(0, 1.4, 0)), tmp2.set(0, 3, 0), 6, C_ICE, 1.2);
        }
      }
      if (r.me || Math.abs(r.d - S.d) < 40) audio.play({ boost: 'sfx_boost', shield: 'sfx_shield', magnet: 'sfx_magnet', freeze: 'sfx_freeze_rival' }[k], r.me ? 1 : 0.5);
      if (r.me) { ui.flash(P.color + '88'); if (k === 'boost') { S.shake = 0.35; ui.say('BOOST!', '', 600); } if (k !== 'freeze' && k !== 'boost') ui.pop(`${P.icon} ${P.label} on!`); }
    }
    const tickFx = (r, dt) => { for (const k in r.fx) if (r.fx[k] > 0) r.fx[k] -= dt; };

    // ---- placement ----
    const orient = (r, obj, dt) => {
      worldAt(r.d, r.off, r.pos); r.pos.y = r.y;
      const dx = (centerX(r.d + 1) - centerX(r.d - 1)) / 2 * Math.max(r.v, 1) + r.vLat, yaw = Math.atan2(dx, -Math.max(r.v, 1));
      obj.position.copy(r.pos); obj.rotation.order = 'YXZ'; obj.rotation.y = yaw + Math.PI + r.spin;
      const pitch = r.air ? THREE.MathUtils.clamp(r.vy * 0.04, -0.4, 0.4) : Math.atan(heightAt(r.d - 0.8, r.off) - heightAt(r.d + 0.8, r.off)) * -0.6;
      obj.rotation.x = -pitch; obj.rotation.z = r.lean * 0.35; return { yaw, pitch };
    };
    function place(dt) {
      const { yaw, pitch } = orient(S, sled, dt);
      avatar.root.position.copy(S.pos).add(tmp.set(0, 0.25, 0));
      avatar.root.rotation.set(-pitch, yaw + Math.PI + S.spin, S.lean * 0.5, 'YXZ');
      avatar.animate?.(dt, { speed: 0, air: S.air });
      player.pos.copy(S.pos); player.facing = yaw + Math.PI; player.onGround = !S.air;
      shieldBubble.visible = S.fx.shield > 0; shieldBubble.position.copy(S.pos).add(tmp.set(0, 1, 0)); shieldBubble.material.opacity = 0.18 + Math.sin(performance.now() / 120) * 0.06;
      myBlock.visible = S.fx.freeze > 0; myBlock.position.copy(S.pos).add(tmp.set(0, 1.1, 0)); myBlock.rotation.y = yaw;
      for (const r of rivals) { orient(r, r.mesh, dt); r.block.visible = r.fx.freeze > 0; r.block.position.copy(r.pos).add(tmp.set(0, 1.1, 0)); r.block.rotation.y = r.mesh.rotation.y; }
    }

    // ---- shared vertical/ground physics ----
    function vertical(r, dt, wantJump) {
      const g = heightAt(r.d, r.off);
      if (r.air) {
        r.vy -= PHYS.airG * dt; r.y += r.vy * dt; r.airT += dt;
        if (r.y <= g) { r.air = false; r.y = g; if (r.me) landed(); }
      } else {
        const vyg = (g - (r.lastG ?? g)) / Math.max(dt, 1e-3);
        if ((r.lastVyg ?? 0) - vyg > 6 && r.lastVyg > 2.5) { r.air = true; r.vy = r.lastVyg; r.airT = 0; if (r.me) audio.play('sfx_whoosh', 0.8); }
        else if (wantJump) { r.air = true; r.vy = PHYS.jumpV + Math.max(0, vyg) * 0.5; r.airT = 0; if (r.me) audio.play('sfx_whoosh', 0.6); }
        else r.y = g;
        r.lastVyg = r.air ? 0 : vyg;
      }
      r.lastG = g;
    }
    function landed() {
      S.airTotal += S.airT; audio.play('sfx_land', Math.min(1, 0.5 + S.airT)); audio.play('sfx_powder', 0.6); S.shake = Math.min(0.5, S.airT * 0.4);
      for (let i = 0; i < 30; i++) fx.emit(S.pos, tmp2.set(0, 2.5, 0), 6, C_POWDER, 0.9);
      if (S.airT > 0.9) { ui.pop(`BIG AIR ${S.airT.toFixed(1)}s! ✨`); audio.play('sfx_star', 0.6); }
    }
    function speedStep(r, dt, brake) {
      const slope = heightAt(r.d, r.off) - heightAt(r.d + 1, r.off);
      let acc = slope * PHYS.slopeG - PHYS.drag * r.v * r.v - (brake ? 18 : 0);
      if (r.fx.boost > 0) acc += 14;
      if (r.fx.freeze > 0) acc = -20;
      if (!r.air) r.v = Math.max(r.fx.freeze > 0 ? 0 : PHYS.startSpeed, r.v + acc * dt);
      r.v = Math.min(r.v, PHYS.maxSpeed * (r.fx.boost > 0 ? 1.35 : 1) * (r.skill ?? 1));
    }

    function stepPlayer(dt) {
      const frozen = S.fx.freeze > 0;
      const steerIn = frozen ? 0 : THREE.MathUtils.clamp((input.analog?.x || 0) + ((input.down('KeyD') || input.down('ArrowRight')) ? 1 : 0) - ((input.down('KeyA') || input.down('ArrowLeft')) ? 1 : 0), -1, 1);
      const brake = input.down('KeyS') || input.down('ArrowDown') || (input.analog?.y || 0) < -0.6;
      if (S.tumble > 0) { S.tumble -= dt; S.spin += dt * 14 * Math.max(S.tumble, 0); if (S.tumble <= 0) S.spin = 0; }
      const ctrl = S.tumble > 0 ? 0 : S.air ? 0.35 : 1;
      speedStep(S, dt, brake);
      S.vLat += steerIn * PHYS.steer * ctrl * dt * (0.55 + 0.45 * Math.min(1, S.v / 30));
      S.vLat -= S.vLat * PHYS.lateralDamp * dt * (S.air ? 0.2 : 1);
      S.lean += (steerIn * ctrl - S.lean) * Math.min(1, dt * 8);
      if (Math.abs(steerIn) > 0.6 && Math.abs(S.steerPrev) <= 0.6 && !S.air) audio.play('sfx_powder', 0.4 + S.v / PHYS.maxSpeed * 0.4);
      S.steerPrev = steerIn;
      S.d += S.v * dt; S.off += S.vLat * dt;
      const lim = HALF - 0.7;
      if (Math.abs(S.off) > lim) {
        S.off = Math.sign(S.off) * lim; S.vLat = -S.vLat * 0.35; S.v *= Math.pow(PHYS.edgeSlow, dt * 3);
        if (Math.random() < 0.5) for (let i = 0; i < 4; i++) fx.emit(S.pos, tmp2.set(-Math.sign(S.off) * 3, 3, 0), 3, C_POWDER, 0.7);
      }
      vertical(S, dt, input.down('Space') && S.tumble <= 0 && !frozen);
      if (!S.air && S.v > 4) { const n = Math.round(1 + Math.abs(S.lean) * 4 + S.v / 12); for (let i = 0; i < n; i++) fx.emit(S.pos, tmp2.set(-S.lean * 4 + (Math.random() - 0.5) * 2, 1.5 + Math.abs(S.lean) * 2, S.v * 0.25), 1.5, C_POWDER, 0.6); }
      if (S.fx.boost > 0) for (let i = 0; i < 5; i++) fx.emit(S.pos, tmp2.set(0, 1, S.v * 0.45), 1.4, i % 2 ? C_GOLD : C_PINK, 0.55);
      if (S.fx.magnet > 0 && Math.random() < 0.5) fx.emit(tmp.copy(S.pos).add(tmp2.set(Math.sin(raceT * 9) * 2, 1.2, Math.cos(raceT * 9) * 2)), tmp2.set(0, 0.5, 0), 0.4, C_PINK, 0.4);
    }
    function stepRival(r, dt) {
      tickFx(r, dt);
      if (r.finished != null) { r.v = Math.max(0, r.v - 15 * dt); r.d += r.v * dt; r.y = heightAt(r.d, r.off); return; }
      if (r.tumble > 0) { r.tumble -= dt; r.spin += dt * 14 * Math.max(r.tumble, 0); if (r.tumble <= 0) r.spin = 0; }
      // rubber-band slightly so races stay close (cozy, not punishing)
      const gap = r.d - S.d; r.skill = (RIVALS.find(x => x.name === r.name).skill) * (gap > 25 ? 0.93 : gap < -25 ? 1.06 : 1);
      speedStep(r, dt, false);
      // target lateral: racing line toward next pickup if empty-handed, else gates, with wobble
      let target = r.lane + Math.sin(raceT * 0.7 + r.wob) * 3;
      if (!r.held) { const p = items.pickups.find(p => !p.taken && p.d > r.d + 4 && p.d < r.d + 40); if (p) target = p.off; }
      const pile = items.piles.find(p => !p.hit && p.d > r.d && p.d < r.d + 14 && Math.abs(p.off - r.off) < 2.4); if (pile) target = pile.off + (r.off > pile.off ? 3.5 : -3.5);
      const steer = r.fx.freeze > 0 || r.tumble > 0 ? 0 : THREE.MathUtils.clamp((target - r.off) * 0.6, -1, 1);
      r.vLat += steer * PHYS.steer * 0.8 * dt; r.vLat -= r.vLat * PHYS.lateralDamp * dt; r.lean += (steer - r.lean) * Math.min(1, dt * 6);
      r.d += r.v * dt; r.off = THREE.MathUtils.clamp(r.off + r.vLat * dt, -HALF + 0.8, HALF - 0.8);
      vertical(r, dt, false);
      if (!r.air && r.v > 6 && Math.random() < 0.6) fx.emit(r.pos, tmp2.set(-r.lean * 3, 1.3, r.v * 0.2), 1.3, C_POWDER, 0.5);
      if (r.fx.boost > 0) fx.emit(r.pos, tmp2.set(0, 1, r.v * 0.4), 1, C_GOLD, 0.5);
      // AI power use
      if (r.held) { r.useT -= dt; if (r.useT <= 0) { if (r.held !== 'freeze' || racers.some(o => o !== r && o.d > r.d && o.d - r.d < 60)) usePower(r); r.useT = 1.5 + Math.random() * 3; } }
      if (r.d >= LENGTH) { r.finished = raceT; finishOrder.push(r); if (Math.abs(r.d - S.d) < 80) ui.pop(`${r.name} finished!`, innerWidth / 2, innerHeight * 0.3); }
    }

    function events(r, prevD) {
      const mag = r.fx.magnet > 0;
      for (const p of items.pickups) {
        if (p.taken) continue;
        const dd = p.d - r.d, lat = Math.abs(p.off - r.off);
        if (mag && dd > -2 && dd < 14 && lat < 7) { p.off += (r.off - p.off) * 0.15; p.d -= Math.min(dd, 20 * (1 / 60)); }
        if (Math.abs(dd) < 1.6 && lat < 1.7 && grant(r, p.kind)) {
          p.taken = true; p.respawn = 5; p.mesh.visible = false;
          if (r.me || Math.abs(dd) < 60) for (let i = 0; i < 36; i++) fx.emit(p.mesh.position, tmp2.set(0, 3, r.v * 0.2), 7, PCOL[p.kind], 1);
        }
      }
      for (const pile of items.piles) if (!pile.hit && Math.abs(r.d - pile.d) < 1.3 && Math.abs(r.off - pile.off) < pile.r + 0.5 && r.y < heightAt(pile.d, pile.off) + 1.6) {
        if (r.fx.shield > 0 || r.fx.boost > 0) { // smash through
          pile.hit = true; pile.mesh.visible = false; if (r.me) { audio.play('sfx_powder'); ui.pop('SMASH! 💥'); S.shake = 0.25; }
        } else {
          pile.hit = true; pile.mesh.visible = false; r.tumble = 0.85; r.v *= 0.5; r.vLat = (r.off > pile.off ? 1 : -1) * 4;
          if (r.me) { S.crashes++; S.shake = 0.6; audio.play('sfx_crash'); ui.say('Whoops!', '', 600); }
        }
        if (r.me || Math.abs(r.d - S.d) < 60) for (let i = 0; i < 60; i++) fx.emit(pile.mesh.position.clone().add(tmp.set(0, 1, 0)), tmp2.set(0, 4, -r.v * 0.2), 8, C_POWDER, 1.2);
      }
      if (!r.me) return;
      for (const gt of items.gates) if (!gt.hit && prevD < gt.d && S.d >= gt.d) {
        const reach = gt.half + (mag ? 3.5 : 0);
        if (Math.abs(S.off - gt.off) < reach && S.y < heightAt(gt.d, gt.off) + 5) {
          gt.hit = true; S.gates++; S.time = Math.max(0, S.time - GATE_BONUS); audio.play('sfx_gate_pass', 1, 1 + Math.min(S.gates, 12) * 0.03);
          ui.pop(`−${GATE_BONUS}s ✦${mag && Math.abs(S.off - gt.off) >= gt.half ? ' 🧲' : ''}`); ui.flash(gt.mat.color.getStyle().replace('rgb', 'rgba').replace(')', ',.35)'));
          for (let i = 0; i < 40; i++) fx.emit(gt.mesh.position.clone().add(tmp.set(0, 2.2, 0)), tmp2.set(0, 2, S.v * 0.3), 7, gt.mat.color, 1.1);
          gt.mat.opacity = 0.25;
        } else { gt.hit = true; gt.mat.opacity = 0.12; }
      }
    }

    // ---- chase camera with lean + punch ----
    const camPos = new THREE.Vector3(), look = new THREE.Vector3();
    const cameraController = {
      drag() {}, wheel() {},
      update(dt) {
        const back = tmp.set(0, 0, 0); worldAt(S.d - 7, S.off * 0.75, back); back.y = Math.max(back.y, S.pos.y) + 3.1;
        const k = 1 - Math.exp(-dt * 6);
        if (camPos.lengthSq() === 0) camPos.copy(back);
        camPos.lerp(back, k); worldAt(S.d + 10, S.off * 0.8, look); look.y = S.pos.y + 0.5;
        cam.position.copy(camPos);
        if (S.shake > 0) { S.shake -= dt; cam.position.x += (Math.random() - 0.5) * S.shake; cam.position.y += (Math.random() - 0.5) * S.shake; }
        cam.lookAt(look); cam.rotateZ(-S.lean * 0.08);
        const fov = 68 + Math.min(1, S.v / PHYS.maxSpeed) * 14 + (S.fx.boost > 0 ? 10 : 0);
        cam.fov += (fov - cam.fov) * Math.min(1, dt * 4); cam.updateProjectionMatrix();
      },
    };

    const onKey = (e) => {
      if (disposed) return;
      if ((e.code === 'KeyE' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') && mode === 'run') usePower(S);
      if (e.code === 'KeyR' && (mode === 'run' || mode === 'result')) startRun();
      if (e.code === 'Enter' && (mode === 'intro' || mode === 'result')) startRun();
    };
    input.onKey(onKey);

    const game = {
      scene, collision: null, cameraController, hideAvatar: false,
      spawn: new THREE.Vector3(0, heightAt(0, 0), 0), spawnFacing: Math.PI, music: 'none',
      update(dt, t) {
        dt = Math.min(dt, 0.05);
        track.update(dt, t); fx.update(dt);
        if (mode === 'count') {
          countdown -= dt; const n = Math.ceil(countdown);
          if (n !== lastCount && n > 0) { lastCount = n; ui.say(String(n), n === 3 ? (mobile ? 'Joystick steer · tap ⚡ to use power-ups' : '←/→ steer · Space hop · E power-up') : '', 700); audio.play('sfx_countdown', 1, 1); }
          if (countdown <= 0) { mode = 'run'; ui.say('GO!', '', 700); audio.play('sfx_countdown', 1, 1.5); S.v = PHYS.startSpeed; rivals.forEach(r => r.v = PHYS.startSpeed * (0.9 + Math.random() * 0.2)); }
        }
        if (mode === 'run') {
          raceT += dt; S.time += dt; tickFx(S, dt);
          const prevD = S.d; stepPlayer(dt); events(S, prevD);
          for (const r of rivals) { const pd = r.d; stepRival(r, dt); events(r, pd); }
          S.whooshT -= dt; if (S.whooshT <= 0 && S.v > 20) { S.whooshT = 1.6 - S.v / PHYS.maxSpeed; audio.play('sfx_whoosh', Math.min(1, 0.3 + S.v / PHYS.maxSpeed * 0.6)); }
          if (S.d >= LENGTH) finish();
          else ui.setHud({ time: S.time, gates: S.gates, total: items.gates.length, kmh: S.v * 3.6, boosting: S.fx.boost > 0, speedK: S.v / PHYS.maxSpeed, place: placeOf(),
            progress: racers.map(r => r.d / LENGTH), held: S.held, frozen: S.fx.freeze > 0,
            active: ['boost', 'shield', 'magnet'].filter(k => S.fx[k] > 0).map(k => [k, S.fx[k]]) });
        } else if (mode === 'result') {
          raceT += dt; S.v = Math.max(0, S.v - 20 * dt); S.d += S.v * dt; S.y = heightAt(S.d, S.off);
          for (const r of rivals) { if (r.finished == null && r.d < LENGTH + 30) { r.d += r.v * dt; r.y = heightAt(r.d, r.off); } else { r.v = Math.max(0, r.v - 15 * dt); r.d += r.v * dt; r.y = heightAt(r.d, r.off); } }
        }
        audio.setSpeed(mode === 'run' ? S.v / PHYS.maxSpeed : 0, S.air);
        place(dt);
      },
      dispose() {
        disposed = true; audio.stop(); ui.dispose(); fx.dispose(); track.dispose();
        scene.traverse(o => { if (o.isMesh) { o.geometry?.dispose?.(); [].concat(o.material).forEach(m => m?.dispose?.()); } });
        avatar.root.rotation.set(0, 0, 0);
        cam.far = camFar; cam.fov = camFov; cam.updateProjectionMatrix();
        if (engine.glacierDrift === api) delete engine.glacierDrift;
      },
    };
    const api = { state: S, rivals, get mode() { return mode; }, start: startRun, finish, items, LENGTH, usePower: () => usePower(S),
      simulate(sec, dt = 1 / 60) { let t = 0; while (t < sec && mode !== 'result') { game.update(dt, t); t += dt; } return { mode, time: S.time, d: S.d, gates: S.gates, place: placeOf(), powers: S.powers }; } };
    engine.glacierDrift = api;
    showIntro();
    return game;
  },
};
