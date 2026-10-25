// Game: Sled Rush — short, juicy downhill sled runs on Aurora Mountain at night.
// Lean with A/D (or the touch joystick), hop with Space / Jump, thread glowing gates, hit boost pads,
// catch air off the kickers, dodge snowmen. Time + 1-3 stars; one-time BB on first finish and first 3-star;
// 3 stars completes quest sr_quest_finish (server grants sr_powder_scarf).
//
// Module map: config.js (tuning/save), track.js (course layer over ./set = Set Builder's night run),
// audio.js (Sound Designer pack + procedural fallback), ui.js (ICE HUD), quests.js, thumb.js.
import * as THREE from 'three';
import { GAME_ID, REWARD_SOURCE, FIRST_CLEAR_BB, THREE_STAR_BB, COSMETIC, PHYS, GATE_BONUS, starsFor, normalizeSave, mergeSaves } from './config.js';
import { buildTrack, LENGTH, HALF, worldAt, heightAt, centerX } from './track.js';
import { SledAudio } from './audio.js';
import { SledUI } from './ui.js';
import { questApi } from '../_event/questAdapter.js';
import { COSMETIC_BY_ID } from '../../data/cosmetics.js';
import { getDeviceMode } from '../../core/device.js';
import THUMB from './thumb.js';
import CREDITS from './CREDITS.md?raw';

const G = 30;            // game gravity along the slope (arcadey)
const tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3();

function persist(economy, save) {
  if (typeof economy.saveGameData === 'function') return economy.saveGameData(GAME_ID, save);
  economy.profile.gameData = { ...(economy.profile.gameData || {}), [GAME_ID]: save };
  economy.backend?.saveProfile?.(economy.profile); return Promise.resolve({ ok: true });
}

function buildSled() {
  const g = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: '#c0793c', roughness: 0.6 }), red = new THREE.MeshStandardMaterial({ color: '#e0435f', roughness: 0.4, metalness: 0.3 });
  for (let i = 0; i < 5; i++) { const s = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.08, 0.32), wood); s.position.set(0, 0.42, -0.9 + i * 0.4); g.add(s); }
  for (const x of [-0.5, 0.5]) {
    const r = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 2.2), red); r.position.set(x, 0.06, 0); g.add(r);
    const tip = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.04, 6, 12, Math.PI), red); tip.rotation.y = Math.PI / 2; tip.position.set(x, 0.28, -1.1); g.add(tip);
    for (const z of [-0.6, 0.6]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.36, 0.06), red); p.position.set(x, 0.24, z); g.add(p); }
  }
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return g;
}

/** Pooled additive particles: powder spray, sparkles, poofs. */
class Particles {
  constructor(scene, n = 900) {
    this.n = n; this.i = 0; this.p = new Float32Array(n * 3); this.v = new Float32Array(n * 3); this.life = new Float32Array(n); this.col = new Float32Array(n * 3);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(this.p, 3)); g.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    this.mat = new THREE.PointsMaterial({ size: 0.35, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, map: dot() });
    this.pts = new THREE.Points(g, this.mat); this.pts.frustumCulled = false; scene.add(this.pts); this.g = g;
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
      v[j + 1] -= 9 * dt; v[j] *= 0.97; v[j + 2] *= 0.97;
      p[j] += v[j] * dt; p[j + 1] += v[j + 1] * dt; p[j + 2] += v[j + 2] * dt;
      if (life[k] <= 0) { p[j + 1] = -9999; } else if (life[k] < 0.3) { col[j] *= 0.9; col[j + 1] *= 0.9; col[j + 2] *= 0.9; }
    }
    this.g.attributes.position.needsUpdate = true; this.g.attributes.color.needsUpdate = true;
  }
  dispose() { this.g.dispose(); this.mat.map.dispose(); this.mat.dispose(); }
}
function dot() { const c = document.createElement('canvas'); c.width = c.height = 32; const g = c.getContext('2d'); const r = g.createRadialGradient(16, 16, 0, 16, 16, 16); r.addColorStop(0, '#fff'); r.addColorStop(0.4, 'rgba(255,255,255,.6)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, 32, 32); return new THREE.CanvasTexture(c); }

const C_POWDER = new THREE.Color(0.75, 0.85, 1), C_GOLD = new THREE.Color(1, 0.85, 0.3), C_CYAN = new THREE.Color(0.4, 1, 1), C_PINK = new THREE.Color(1, 0.5, 0.9);

export default {
  id: GAME_ID,
  name: 'Sled Rush',
  tagline: 'Rip down Aurora Mountain — one more run!',
  description: 'Short, juicy downhill sled runs under the northern lights. Lean through glowing gates, hit boost pads, catch big air off the kickers and dodge the snowmen. Beat the clock for 3 stars and the Powder Scarf.',
  thumbnail: THUMB || 'frost',
  music: 'none',          // own loop from the Sound Designer pack through the shared output
  credits: CREDITS,
  features: {},
  mobile: true,           // joystick lean + shared Jump button + big tap buttons
  hideAvatar: false,

  async create(ctx) {
    const { engine, economy, music, avatar } = ctx;
    const player = engine.player, input = engine.input, cam = engine.camera;
    const mobile = getDeviceMode() === 'mobile';
    const exposure = engine.renderer.toneMappingExposure, camFar = cam.far, camFov = cam.fov;
    const track = await buildTrack(engine.renderer);
    const scene = track.scene;
    cam.far = Math.max(camFar, 1400); cam.updateProjectionMatrix();

    const sled = buildSled(); scene.add(sled);
    const fx = new Particles(scene);
    const audio = new SledAudio(music);
    const ui = new SledUI(mobile);
    const items = track.items;

    // ---- save ----
    let disposed = false;
    let save = normalizeSave(economy.cachedGameData ? economy.cachedGameData(GAME_ID) : economy.profile?.gameData?.[GAME_ID]);
    if (typeof economy.loadGameData === 'function') economy.loadGameData(GAME_ID).then(d => { if (!disposed) { save = mergeSaves(save, d); if (mode === 'intro') showIntro(); } }).catch(() => {});

    // ---- run state ----
    const S = { d: 0, off: 0, v: 0, vLat: 0, y: 0, vy: 0, air: false, airT: 0, airTotal: 0, tumble: 0, spin: 0, boost: 0, time: 0, gates: 0, crashes: 0, lastG: 0, lastVyg: 0, lean: 0, shake: 0, whooshT: 0, steerPrev: 0, pos: new THREE.Vector3() };
    let mode = 'intro', countdown = 0, lastCount = 0;

    function resetRun() {
      track.reset();
      Object.assign(S, { d: 4, off: 0, v: 0, vLat: 0, vy: 0, air: false, airT: 0, airTotal: 0, tumble: 0, spin: 0, boost: 0, time: 0, gates: 0, crashes: 0, lean: 0, shake: 0 });
      S.y = heightAt(S.d, 0); S.lastG = S.y; S.lastVyg = 0; place(0);
    }
    function showIntro() { mode = 'intro'; ui.showHud(false); resetRun(); ui.showIntro(save, () => { audio.play('ui_confirm'); startRun(); }); }
    function startRun() {
      audio.ctx?.resume?.(); audio.startMusic();
      ui.hideCard(); resetRun(); mode = 'count'; countdown = 3.0; lastCount = 4; ui.showHud(true);
    }
    function finish() {
      mode = 'result'; ui.showHud(false);
      const time = S.time, stars = starsFor(time, true), newBest = save.best == null || time < save.best;
      const rewards = [];
      audio.play('finish_fanfare'); ui.flash('rgba(255,215,90,.6)');
      for (let i = 0; i < 120; i++) fx.emit(tmp.copy(S.pos).add(new THREE.Vector3(0, 2, 0)), tmp2.set(0, 8, 0), 14, [C_GOLD, C_CYAN, C_PINK][i % 3], 2);
      if (!save.cleared) { economy.earn?.(FIRST_CLEAR_BB, 'Sled Rush: first finish', { source: REWARD_SOURCE }); rewards.push(`+${FIRST_CLEAR_BB} BB first finish`); save.cleared = true; }
      if (stars === 3 && !save.threeStar) { economy.earn?.(THREE_STAR_BB, 'Sled Rush: first 3-star run', { source: REWARD_SOURCE }); rewards.push(`+${THREE_STAR_BB} BB ⭐⭐⭐`); save.threeStar = true; }
      save.runs++; save.stars = Math.max(save.stars, stars); if (newBest) save.best = time;
      if (stars === 3 && !save.questDone) claimScarf();
      persist(economy, save).catch(() => {});
      ui.showResult({ time, stars, newBest, gates: S.gates, total: items.gates.length, air: S.airTotal, crashes: S.crashes, rewards },
        (again) => { audio.play('ui_click_soft_1'); again ? startRun() : showIntro(); }, () => audio.play('near_miss', 0.9));
    }
    async function claimScarf() {
      // Server grants the item. Feature-detect the Cosmetics catalog so we never name an item that isn't shipped.
      const known = !!COSMETIC_BY_ID?.[COSMETIC.itemId];
      try {
        const api = questApi(); if (!api?.complete) return;
        await api.progress?.(COSMETIC.questId, 1);
        const r = await api.complete(COSMETIC.questId);
        if (r?.granted || r?.alreadyClaimed) { save.questDone = true; persist(economy, save).catch(() => {}); if (r.granted && !disposed) ui.addReward(known ? `🧣 ${COSMETIC_BY_ID[COSMETIC.itemId].name || 'Powder Scarf'} unlocked!` : '🧣 Reward unlocked!'); }
      } catch { /* offline / not wired: try again next 3-star run */ }
    }

    // ---- placement (sled + avatar + mp position) ----
    const up = new THREE.Vector3(0, 1, 0);
    function place(dt) {
      worldAt(S.d, S.off, S.pos); S.pos.y = S.y;
      const dx = (centerX(S.d + 1) - centerX(S.d - 1)) / 2 * Math.max(S.v, 1) + S.vLat;
      const yaw = Math.atan2(dx, -Math.max(S.v, 1));
      sled.position.copy(S.pos); sled.rotation.set(0, 0, 0); sled.rotation.order = 'YXZ';
      sled.rotation.y = yaw + Math.PI + S.spin;
      const pitch = S.air ? THREE.MathUtils.clamp(S.vy * 0.04, -0.4, 0.4) : Math.atan(heightAt(S.d - 0.8, S.off) - heightAt(S.d + 0.8, S.off)) * -0.6;
      sled.rotation.x = -pitch; sled.rotation.z = S.lean * 0.35;
      avatar.root.position.copy(S.pos).add(tmp.set(0, 0.25, 0));
      avatar.root.rotation.set(0, yaw + Math.PI + S.spin, 0); avatar.root.rotation.z = S.lean * 0.5; avatar.root.rotation.x = -pitch;
      avatar.animate?.(dt, { speed: 0, air: S.air });
      player.pos.copy(S.pos); player.facing = yaw + Math.PI; player.onGround = !S.air;
    }

    // ---- physics step ----
    function step(dt) {
      const steerIn = THREE.MathUtils.clamp((input.analog?.x || 0) + ((input.down('KeyD') || input.down('ArrowRight')) ? 1 : 0) - ((input.down('KeyA') || input.down('ArrowLeft')) ? 1 : 0), -1, 1);
      const brake = input.down('KeyS') || input.down('ArrowDown') || (input.analog?.y || 0) < -0.6;
      if (S.tumble > 0) { S.tumble -= dt; S.spin += dt * 14 * Math.max(S.tumble, 0); if (S.tumble <= 0) S.spin = 0; }
      const ctrl = S.tumble > 0 ? 0 : S.air ? 0.35 : 1;
      // slope + drag + boost
      const slope = (heightAt(S.d, S.off) - heightAt(S.d + 1, S.off));
      let acc = slope * G - PHYS.drag * S.v * S.v - (brake ? 18 : 0);
      if (S.boost > 0) { S.boost -= dt; acc += 10; }
      if (!S.air) S.v = Math.max(PHYS.startSpeed * (mode === 'run' ? 1 : 0), S.v + acc * dt);
      S.v = Math.min(S.v, PHYS.maxSpeed * (S.boost > 0 ? 1.25 : 1));
      // lean / carve
      S.vLat += steerIn * PHYS.steer * ctrl * dt * (0.55 + 0.45 * Math.min(1, S.v / 30));
      S.vLat -= S.vLat * PHYS.lateralDamp * dt * (S.air ? 0.2 : 1);
      S.lean += (steerIn * ctrl - S.lean) * Math.min(1, dt * 8);
      if (Math.abs(steerIn) > 0.6 && Math.abs(S.steerPrev) <= 0.6 && !S.air) audio.play('sled_turn', 0.5 + S.v / PHYS.maxSpeed * 0.5);
      S.steerPrev = steerIn;
      S.d += S.v * dt; S.off += S.vLat * dt;
      const lim = HALF - 0.7;
      if (Math.abs(S.off) > lim) { // snow bank: soft bounce + slow + powder burst
        S.off = Math.sign(S.off) * lim; S.vLat = -S.vLat * 0.35; S.v *= Math.pow(PHYS.edgeSlow, dt * 3);
        if (Math.random() < 0.5) for (let i = 0; i < 4; i++) fx.emit(S.pos, tmp2.set(-Math.sign(S.off) * 3, 3, 0), 3, C_POWDER, 0.7);
      }
      // vertical: follow ground, launch off lips, jump
      const g = heightAt(S.d, S.off);
      if (S.air) {
        S.vy -= PHYS.airG * dt; S.y += S.vy * dt; S.airT += dt;
        if (S.y <= g) {
          S.air = false; S.y = g; S.airTotal += S.airT;
          audio.play('land_soft', Math.min(1, 0.5 + S.airT)); S.shake = Math.min(0.5, S.airT * 0.4);
          for (let i = 0; i < 26; i++) fx.emit(S.pos, tmp2.set(0, 2.5, 0), 6, C_POWDER, 0.9);
          if (S.airT > 0.9) { ui.pop(`BIG AIR ${S.airT.toFixed(1)}s!`); audio.play('near_miss'); }
        }
      } else {
        const vyg = (g - S.lastG) / Math.max(dt, 1e-3);
        if (S.lastVyg - vyg > 6 && S.lastVyg > 2.5) { S.air = true; S.vy = S.lastVyg; S.airT = 0; audio.play('jump_launch'); }
        else if (input.down('Space') && S.tumble <= 0 && mode === 'run') { S.air = true; S.vy = PHYS.jumpV + Math.max(0, vyg) * 0.5; S.airT = 0; audio.play('jump_launch', 0.8); }
        else S.y = g;
        S.lastVyg = S.air ? 0 : vyg;
      }
      S.lastG = g;
      // powder spray behind runners (more when carving / fast)
      if (!S.air && S.v > 4) {
        const n = Math.round(1 + Math.abs(S.lean) * 4 + S.v / 12);
        for (let i = 0; i < n; i++) fx.emit(S.pos, tmp2.set(-S.lean * 4 + (Math.random() - 0.5) * 2, 1.5 + Math.abs(S.lean) * 2, S.v * 0.25), 1.5, C_POWDER, 0.6);
      }
      if (S.boost > 0) for (let i = 0; i < 3; i++) fx.emit(S.pos, tmp2.set(0, 1, S.v * 0.4), 1.2, C_GOLD, 0.5);
    }

    function events(prevD) {
      for (const gt of items.gates) if (!gt.hit && prevD < gt.d && S.d >= gt.d) {
        if (Math.abs(S.off - gt.off) < gt.half && S.y < heightAt(gt.d, gt.off) + 5) {
          gt.hit = true; S.gates++; S.time = Math.max(0, S.time - GATE_BONUS); audio.play('gate_pass');
          ui.pop(`−${GATE_BONUS}s ✦`); ui.flash(gt.mat.color.getStyle().replace('rgb', 'rgba').replace(')', ',.35)'));
          for (let i = 0; i < 40; i++) fx.emit(gt.mesh.position.clone().add(tmp.set(0, 2.2, 0)), tmp2.set(0, 2, S.v * 0.3), 7, gt.mat.color, 1.1);
          gt.mat.opacity = 0.25;
        } else { gt.hit = true; gt.mat.opacity = 0.12; }
      }
      for (const b of items.boosts) if (!b.used && Math.abs(S.d - b.d) < b.len && Math.abs(S.off - b.off) < b.half && !S.air) {
        b.used = true; S.boost = 1.4; S.v = Math.min(PHYS.maxSpeed * 1.25, S.v + PHYS.boostSpeed); audio.play('boost_pad'); ui.pop('BOOST!'); ui.flash('rgba(255,230,107,.45)');
      }
      for (const r of items.rocks) if (!r.hit && Math.abs(S.d - r.d) < 1.2) {
        const lat = Math.abs(S.off - r.off);
        if (lat < r.r + 0.6 && S.y < heightAt(r.d, r.off) + 2.2) { // bonk: soft tumble, snowman poofs
          r.hit = true; r.mesh.visible = false; S.crashes++; S.tumble = 0.9; S.v *= 0.45; S.vLat = (S.off > r.off ? 1 : -1) * 4; S.shake = 0.6;
          audio.play('crash_soft'); ui.say('Whoops!', '', 600);
          for (let i = 0; i < 60; i++) fx.emit(r.mesh.position.clone().add(tmp.set(0, 1.2, 0)), tmp2.set(0, 4, -S.v * 0.2), 8, C_POWDER, 1.2);
        } else if (lat < r.r + 2.0 && prevD < r.d && S.d >= r.d) {
          r.hit = true; audio.play('near_miss'); ui.pop('Close one! ✨');
          for (let i = 0; i < 18; i++) fx.emit(S.pos, tmp2.set(0, 3, 0), 4, C_CYAN, 0.8);
        }
      }
    }

    // ---- chase camera ----
    const camPos = new THREE.Vector3(), look = new THREE.Vector3();
    const cameraController = {
      drag() {}, wheel() {},
      update(dt) {
        const back = tmp.set(0, 0, 0); worldAt(S.d - 6.8, S.off * 0.75, back); back.y = Math.max(back.y, S.pos.y) + 3.0;
        const k = 1 - Math.exp(-dt * 6);
        if (camPos.lengthSq() === 0) camPos.copy(back);
        camPos.lerp(back, k);
        worldAt(S.d + 10, S.off * 0.8, look); look.y = S.pos.y + 0.5;
        cam.position.copy(camPos);
        if (S.shake > 0) { S.shake -= dt; cam.position.x += (Math.random() - 0.5) * S.shake; cam.position.y += (Math.random() - 0.5) * S.shake; }
        cam.lookAt(look); cam.rotateZ(-S.lean * 0.06);
        const fov = 68 + Math.min(1, S.v / PHYS.maxSpeed) * 14 + (S.boost > 0 ? 8 : 0);
        cam.fov += (fov - cam.fov) * Math.min(1, dt * 4); cam.updateProjectionMatrix();
      },
    };

    const onKey = (e) => { if (disposed) return; if (e.code === 'KeyR' && (mode === 'run' || mode === 'result')) startRun(); if ((e.code === 'Enter') && (mode === 'intro' || mode === 'result')) startRun(); };
    input.onKey(onKey);

    const game = {
      scene, collision: null, cameraController, hideAvatar: false,
      spawn: new THREE.Vector3(0, heightAt(0, 0), 0), spawnFacing: Math.PI, music: 'none',
      update(dt, t) {
        track.update(dt, t); fx.update(dt);
        if (mode === 'count') {
          countdown -= dt; const n = Math.ceil(countdown);
          if (n !== lastCount && n > 0) { lastCount = n; ui.say(String(n), n === 3 ? 'Lean with ← →  ·  Space to hop' : '', 700); audio.play('ui_click_soft_1'); }
          if (countdown <= 0) { mode = 'run'; ui.say('GO!', '', 700); audio.play('ui_start'); S.v = PHYS.startSpeed; }
        }
        if (mode === 'run') {
          const prevD = S.d; S.time += dt; step(dt); events(prevD);
          S.whooshT -= dt; if (S.whooshT <= 0 && S.v > 18) { S.whooshT = 1.6 - S.v / PHYS.maxSpeed; audio.play('sled_whoosh', Math.min(1, 0.35 + S.v / PHYS.maxSpeed * 0.65)); }
          if (S.d >= LENGTH) finish();
          ui.setHud(S.time, S.gates, items.gates.length, S.v * 3.6, S.boost > 0, S.v / PHYS.maxSpeed);
        } else if (mode === 'result') { S.v = Math.max(0, S.v - 20 * dt); S.d += S.v * dt; S.y = heightAt(S.d, S.off); }
        audio.setSpeed(mode === 'run' ? S.v / PHYS.maxSpeed : 0, S.air);
        place(dt);
      },
      dispose() {
        disposed = true; audio.stop(); ui.dispose(); fx.dispose(); track.dispose();
        sled.traverse(o => { if (o.isMesh) o.material.dispose(); });
        avatar.root.rotation.set(0, 0, 0);
        engine.renderer.toneMappingExposure = exposure; cam.far = camFar; cam.fov = camFov; cam.updateProjectionMatrix();
        if (engine.sledRush === api) delete engine.sledRush;
      },
    };
    // test/film hooks (headless smoke + Social Media capture)
    const api = { state: S, simulate(sec, dt = 1 / 60) { let t = 0; while (t < sec && mode !== 'result') { game.update(dt, t); t += dt; } return { mode, time: S.time, d: S.d, gates: S.gates, crashes: S.crashes, air: S.airTotal }; }, get mode() { return mode; }, start: startRun, finish, items, LENGTH };
    engine.sledRush = api;
    if (typeof location !== 'undefined' && /[?&]srtest=1/.test(location.search)) window.__srsim = (sec) => api.simulate(sec);
    showIntro();
    return game;
  },
};
