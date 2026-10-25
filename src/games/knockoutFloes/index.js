// Game: Knockout Floes — last-one-standing snowball brawl on cracking ice floes under the aurora.
// Throw snowballs to knock rivals into the arctic water; floes crack, shrink and sink as the round goes on.
// 5 local bots (chase / throw / dodge / hop gaps), KO feed + standings, emotes, instant rematch,
// win streak + one-time BB milestones. Files: config.js, audio.js, ui.js, floes.js (arena), bots.js (rivals), this (loop).
// Perf: no shadows, one Points pool, pooled snowballs + text pops. MP: local only for now (engine draws remotes).
import * as THREE from 'three';
import { Collision } from '../../engine/collision.js';
import { getDeviceMode } from '../../core/device.js';
import * as C from './config.js';
import { FloesAudio } from './audio.js';
import { FloesUI } from './ui.js';
import { buildArena, drawThumb } from './floes.js';
import { makeBotMesh, textSprite, botThink } from './bots.js';

function loadSave(economy) { return { ...C.DEFAULT_SAVE, ...((economy.profile?.gameData || {})[C.GAME_ID] || {}) }; }
function persist(economy, save) {
  economy.profile.gameData = { ...(economy.profile.gameData || {}), [C.GAME_ID]: save };
  if (typeof economy.saveGameData === 'function') economy.saveGameData(C.GAME_ID, save);
  else economy.backend?.saveProfile?.(economy.profile);
}
const rand = (a, b) => a + Math.random() * (b - a);
const POPS = ['BONK!', 'POW!', 'SMACK!', 'THWAP!', 'SPLAT!'];
let _thumb = null;

export default {
  id: C.GAME_ID, name: 'Knockout Floes', tagline: 'Last one standing on the cracking ice.',
  description: 'A snowball brawl on drifting ice floes under the aurora. Charge up throws to knock rivals into the freezing water, hop gaps as floes crack and sink, and be the last one standing. Fast rounds, instant rematch, chase your win streak.',
  get thumbnail() { if (!_thumb) { try { _thumb = drawThumb(); } catch { _thumb = 'frost'; } } return _thumb; },
  music: 'none',
  mobile: true,

  async create(ctx) {
    const { economy, engine, music } = ctx;
    const player = engine.player, cam = engine.camera;
    const mobile = getDeviceMode() === 'mobile';
    let save = loadSave(economy);
    const camFar = cam.far; cam.far = 1000; cam.updateProjectionMatrix();
    const arena = buildArena();
    const { scene, floes, glowTex } = arena;
    const collision = new Collision({ floorY: null, bounds: null });
    const audio = new FloesAudio(music);

    // ---------- particles ----------
    const NP = 420, pGeo = new THREE.BufferGeometry(), pPos = new Float32Array(NP * 3), pCol = new Float32Array(NP * 3);
    pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3)); pGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 3));
    const pts = new THREE.Points(pGeo, new THREE.PointsMaterial({ size: 0.5, map: glowTex, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
    pts.frustumCulled = false; scene.add(pts);
    const parts = Array.from({ length: NP }, () => ({ life: 0, max: 1, p: new THREE.Vector3(), v: new THREE.Vector3(), c: new THREE.Color(), g: 0, floor: -0.5 }));
    let pNext = 0;
    function burst(x, y, z, n, color, speed = 5, grav = 9, life = 0.8, dir = null) {
      const base = new THREE.Color(color);
      for (let i = 0; i < n; i++) {
        const q = parts[pNext]; pNext = (pNext + 1) % NP;
        q.p.set(x, y, z); q.v.set(rand(-1, 1), rand(0.2, 1.3), rand(-1, 1)).normalize().multiplyScalar(speed * rand(0.35, 1));
        if (dir) q.v.addScaledVector(dir, speed * 0.6);
        q.c.copy(base).offsetHSL(rand(-0.03, 0.03), 0, rand(-0.1, 0.1)); q.life = q.max = life * rand(0.6, 1.2); q.g = grav;
      }
    }

    // ---------- text pops (BONK!) + emotes ----------
    const popPool = [];
    function pop(text, x, y, z, color = '#fff36b', scale = 1) {
      let s = popPool.find(p => p.t <= 0);
      if (!s) { if (popPool.length > 8) s = popPool[0]; else { s = { spr: null, t: 0 }; popPool.push(s); } }
      if (s.spr) { scene.remove(s.spr); s.spr.material.map.dispose(); s.spr.material.dispose(); }
      s.spr = textSprite(text, color, 1.6 * scale); s.spr.position.set(x, y, z); s.vy = 2.5; s.t = 0.9; s.base = s.spr.scale.clone(); scene.add(s.spr);
    }

    // ---------- entities ----------
    const ents = [];
    const meEnt = { name: 'You', color: '#ffe680', me: true, pos: player.pos, kb: new THREE.Vector3(), out: false };
    ents.push(meEnt);
    const botNames = [...C.BOT_NAMES].sort(() => Math.random() - 0.5);
    for (let i = 0; i < C.BOT_COUNT; i++) {
      const color = C.BOT_COLORS[i];
      const mesh = makeBotMesh(color, botNames[i]); scene.add(mesh);
      ents.push({ name: botNames[i], color, bot: true, mesh, pos: mesh.position, vel: new THREE.Vector3(), kb: new THREE.Vector3(), vy: 0, out: false, ai: {} });
    }
    function emote(e, i) {
      if (e.emote) { scene.remove(e.emote.spr); e.emote.spr.material.map.dispose(); e.emote.spr.material.dispose(); }
      const spr = textSprite(C.EMOTES[i], '#fff', 2.2, true); scene.add(spr); e.emote = { spr, t: 2.2 };
      if (e.me || Math.random() < 0.5) audio.sfx('emote');
    }

    // ---------- snowballs ----------
    const ballGeo = new THREE.SphereGeometry(0.3, 10, 8);
    const balls = Array.from({ length: 28 }, () => {
      const mesh = new THREE.Mesh(ballGeo, new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#9fd8ff', emissiveIntensity: 0.35, roughness: 0.6 }));
      mesh.visible = false; scene.add(mesh); return { mesh, p: mesh.position, v: new THREE.Vector3(), alive: false, owner: null, charge: 0, dodged: new Set() };
    });
    const UP = new THREE.Vector3(0, 1, 0), tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3();
    function aimAssist(e, fwd, cone) {
      let best = null, bs = Infinity;
      for (const o of ents) {
        if (o === e || o.out) continue;
        tmp.subVectors(o.pos, e.pos); tmp.y = 0; const d = tmp.length(); if (d > 26 || d < 0.1) continue;
        const ang = Math.acos(Math.max(-1, Math.min(1, tmp.dot(fwd) / d))); if (ang > cone) continue;
        const sc = ang * 8 + d; if (sc < bs) { bs = sc; best = o; }
      }
      return best;
    }
    function leadDir(e, target, out) {
      const d = Math.hypot(target.pos.x - e.pos.x, target.pos.z - e.pos.z), tf = d / C.BALL_SPEED;
      const v = target.me ? playerVel : target.vel;
      out.set(target.pos.x + (v.x + target.kb.x) * tf * 0.7 - e.pos.x, 0, target.pos.z + (v.z + target.kb.z) * tf * 0.7 - e.pos.z).normalize();
      return out;
    }
    function throwBall(e, dir, charge) {
      const b = balls.find(b => !b.alive); if (!b) return;
      b.alive = true; b.owner = e; b.charge = charge; b.dodged.clear(); b.mesh.visible = true; b.mesh.scale.setScalar(1 + charge * 0.6);
      b.p.set(e.pos.x + dir.x * 0.7, e.pos.y + 1.5, e.pos.z + dir.z * 0.7);
      b.v.copy(dir).multiplyScalar(C.BALL_SPEED * (1 + charge * 0.3)); b.v.y = 2.4;
      audio.sfx('throw', charge);
      burst(b.p.x, b.p.y, b.p.z, 4, '#ffffff', 2, 4, 0.3);
      if (e.bot) { e.ai.throwAnim = 0.25; }
    }
    function hit(target, b) {
      const R_ = R; tmp.set(b.v.x, 0, b.v.z).normalize();
      target.heat = (target.heat || 0);
      const kb = (C.KB_BASE + (C.KB_CHARGED - C.KB_BASE) * b.charge) * (1 + target.heat);
      target.heat += 0.14;
      target.kb.addScaledVector(tmp, kb);
      if (target.me) { player.vel.y = 5 + b.charge * 3; player.onGround = false; ui.flash(); shake = Math.max(shake, 0.35 + b.charge * 0.4); }
      else { target.vy = 5 + b.charge * 3; target.ground = false; shake = Math.max(shake, b.owner.me ? 0.25 + b.charge * 0.3 : 0.08); }
      target.lastCharge = b.charge; if (kb > 14) audio.sfx('slide'); target.lastHitBy = b.owner; target.lastHitT = R_.elapsed;
      hitstop = b.owner.me || target.me ? 0.07 + b.charge * 0.05 : 0.02;
      burst(b.p.x, b.p.y, b.p.z, 18 + b.charge * 16, '#ffffff', 6 + b.charge * 4, 10, 0.6, tmp);
      burst(b.p.x, b.p.y, b.p.z, 6, target.color, 4, 8, 0.6);
      audio.sfx('hit', b.charge);
      if (b.owner.me) { R_.hits++; pop(b.charge > 0.75 ? 'MEGA BONK!' : POPS[(Math.random() * POPS.length) | 0], b.p.x, b.p.y + 1, b.p.z, b.charge > 0.75 ? '#ff7a8a' : '#fff36b', 1 + b.charge * 0.5); }
      else if (target.me) pop('OOF!', b.p.x, b.p.y + 1, b.p.z, '#9fe8ff');
      if (target.bot && Math.random() < 0.15) setTimeout(() => !target.out && alive && emote(target, 1), 400);
      b.alive = false; b.mesh.visible = false;
    }

    // ---------- round ----------
    let R = null, phase = 'count', countT = 0, lastTick = -1, endT = 0, postT = 0;
    let shake = 0, hitstop = 0, charge = 0, charging = false, alive = true;
    let airT = 0, stepD = 0, warnT = 0;
    const playerVel = new THREE.Vector3(), prevPos = new THREE.Vector3();
    const camDist0 = player.camDist, baseSpeed = player.mods.speed;
    player.mods.speed = baseSpeed * 1.12;
    const ui = new FloesUI(mobile, {
      onEmote: (i) => { if (!meEnt.out) emote(meEnt, i); },
      onThrowDown: () => startCharge(), onThrowUp: () => releaseThrow(),
    });
    function startCharge() { if (phase === 'play' && !meEnt.out) { charging = true; charge = 0; } }
    function releaseThrow() {
      if (!charging) return; charging = false;
      if (phase !== 'play' || meEnt.out || R.throwCd > 0) { charge = 0; return; }
      const fwd = myForward(new THREE.Vector3());
      const t = aimAssist(meEnt, fwd, mobile ? 0.75 : 0.42);
      throwBall(meEnt, t ? leadDir(meEnt, t, fwd) : fwd, Math.min(1, charge));
      if (t || true) player.facing = Math.atan2(fwd.x, fwd.z);
      R.throwCd = C.THROW_CD; charge = 0;
    }
    function myForward(v) {
      if (mobile) return v.set(Math.sin(player.facing), 0, Math.cos(player.facing));
      return v.set(-Math.sin(player.camYaw), 0, -Math.cos(player.camYaw));
    }
    // desktop mouse: click = throw (hold to charge); drag = camera (cancels)
    const dom = engine.renderer.domElement; let down = null;
    const onDown = (e) => { if (e.button !== 0 || mobile) return; down = { x: e.clientX, y: e.clientY }; startCharge(); };
    const onMove = (e) => { if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 14) { charging = false; charge = 0; down = null; } };
    const onUp = () => { if (!down) return; down = null; releaseThrow(); };
    dom.addEventListener('pointerdown', onDown); addEventListener('pointermove', onMove); addEventListener('pointerup', onUp);

    function newRound() {
      R = { time: C.ROUND_SECS, elapsed: 0, kos: 0, hits: 0, throwCd: 0, nextSink: C.SINK_START, by: null };
      arena.reset();
      for (const b of balls) { b.alive = false; b.mesh.visible = false; }
      const ring = floes.filter(f => !f.center);
      const order = [...ring].sort(() => Math.random() - 0.5);
      ents.forEach((e, i) => {
        const f = order[i % order.length];
        e.out = false; e.kb.set(0, 0, 0); e.heat = 0; e.kos = 0; e.lastHitBy = null; e.sinkT = 0;
        const sx = f.x * 0.92, sz = f.z * 0.92;
        if (e.me) { player.enabled = true; player.teleport(new THREE.Vector3(sx, 0, sz), Math.atan2(-sx, -sz)); player.camDist = 13; player.camPitch = 0.5; }
        else { e.pos.set(sx, 0, sz); e.vel.set(0, 0, 0); e.vy = 0; e.mesh.visible = true; e.mesh.rotation.set(0, Math.atan2(-sx, -sz), 0); e.ai = { cd: rand(1, 2.5), retarget: 0 }; }
      });
      phase = 'count'; countT = 3; lastTick = -1; charging = false; charge = 0;
      audio.heartbeat(false); ui.hideEnd(); prevPos.copy(player.pos);
    }
    function aliveEnts() { return ents.filter(e => !e.out); }
    function eliminate(e) {
      if (e.me && R.win) { player.pos.y = 0; player.vel.y = 0; return; }   // winner is safe during the celebration
      e.out = true; e.sinkT = 0;
      burst(e.pos.x, -0.4, e.pos.z, 34, '#bfe9ff', 7, 12, 0.9); burst(e.pos.x, -0.4, e.pos.z, 10, e.color, 4, 8, 0.8);
      audio.sfx('splash'); arena.ripple(e.pos.x, e.pos.z);
      const credit = e.lastHitBy && !e.lastHitBy.out && R.elapsed - (e.lastHitT || -99) < 5 ? e.lastHitBy : (e.lastHitBy && R.elapsed - (e.lastHitT || -99) < 5 ? e.lastHitBy : null);
      if (credit) credit.kos = (credit.kos || 0) + 1;
      const left = aliveEnts().length;
      const tag = (x) => `<b style="color:${x.color}">${x.name}</b>`;
      ui.feed(credit ? `${tag(credit)} 💥 ${tag(e)}` : `${tag(e)} 💦 fell in`);
      if (credit?.me) {
        R.kos++; audio.sfx('ko'); if (R.kos >= 2) audio.sfx('combo'); if ((e.lastCharge || 0) > 0.6) audio.sfx('ooh'); shake = Math.max(shake, 0.5);
        ui.banner('💥 KNOCKOUT!', `${e.name} is swimming · ${left - 1} rival${left - 1 === 1 ? '' : 's'} left`, 1300);
        pop('KO!', e.pos.x, 2.5, e.pos.z, '#ff6b7f', 1.8);
      } else if (credit?.bot && Math.random() < 0.7) setTimeout(() => !credit.out && alive && emote(credit, Math.random() < 0.6 ? 0 : 2), 300);
      if (e.bot && Math.random() < 0.6) emote(e, 3);
      if (e.me) {
        R.by = credit?.name || null; R.place = left + 1;
        player.enabled = false; phase = 'post'; postT = 1.6;
        ui.banner('💦 SPLASH!', credit ? `${credit.name} got you` : 'into the drink', 1500); audio.sfx('lose');
      } else if (left === 1 && !meEnt.out) win(false);
      else if (left === 2 && !meEnt.out) audio.heartbeat(true), ui.banner('⚔ FINAL DUEL', 'last one standing wins', 1300);
    }
    function win(timeout) {
      if (R.win || meEnt.out) return;
      R.win = true; R.survived = timeout; R.place = 1; phase = 'post'; postT = 2.2;
      ui.banner(timeout ? '⏱ SURVIVED!' : '🏆 VICTORY!', 'last one standing', 2000); audio.sfx('win');
      for (let i = 0; i < 4; i++) setTimeout(() => alive && burst(player.pos.x + rand(-2, 2), 3 + rand(0, 2), player.pos.z + rand(-2, 2), 30, ['#ffd24a', '#5be37d', '#ff7ad9', '#3fd0ff'][i], 8, 6, 1.3), i * 220);
      emote(meEnt, 0);
    }
    function endRound() {
      phase = 'end'; endT = 8; audio.heartbeat(false);
      const won = !!R.win;
      const prevBest = save.bestStreak || 0;
      const streak = won ? (save.streak || 0) + 1 : 0;
      save = { ...save, rounds: (save.rounds || 0) + 1, wins: (save.wins || 0) + (won ? 1 : 0), streak, bestStreak: Math.max(prevBest, streak), kos: (save.kos || 0) + R.kos };
      const rewards = [];
      for (const m of C.MILESTONES) {
        if (save.milestones.includes(m.id) || !m.test(R, save)) continue;
        save = { ...save, milestones: [...save.milestones, m.id] };
        try { economy.earn(m.bb, `Knockout Floes: ${m.label}`, { source: 'Knockout Floes' }); } catch {}
        rewards.push(m);
      }
      persist(economy, save);
      ui.showEnd({ ...R, total: ents.length, streak, bestStreak: save.bestStreak, newBest: won && streak > prevBest && streak > 1, rewards }, () => { audio.sfx('rematch'); newRound(); });
    }

    // ---------- floe support ----------
    function floeAt(x, z) {
      let best = null;
      for (const f of floes) { if (f.gone) continue; const r = f.r0 * f.scale + C.FOOT_TOL; if ((x - f.x) ** 2 + (z - f.z) ** 2 < r * r && (!best || f.y > best.y)) best = f; }
      return best;
    }
    const api = { ents, floes, balls, floeAt, aimAssist, leadDir, throwBall, emote, get R() { return R; } };

    newRound();
    let keyPrev = {};
    const edge = (code) => { const d = engine.input.down(code), p = keyPrev[code]; keyPrev[code] = d; return d && !p; };
    const game = {
      scene, collision, spawn: player.pos.clone(), spawnFacing: player.facing, music: 'none', maxCamDist: 20,
      floes: { get state() { return { phase, alive: aliveEnts().length, ...(R || {}) }; }, restart: () => newRound(), skipCountdown: () => { countT = 0; },
        setTime: (v) => { if (R) R.time = v; }, ents: () => ents.map(e => ({ name: e.name, out: e.out, x: e.pos.x, y: e.pos.y, z: e.pos.z, kos: e.kos || 0 })),
        throwAt: (name, c = 1) => { const t = ents.find(e => e.name === name); if (t) throwBall(meEnt, leadDir(meEnt, t, new THREE.Vector3()), c); },
        knock: (name) => { const t = ents.find(e => e.name === name); if (t) { t.lastHitBy = meEnt; t.lastHitT = R.elapsed; t.pos.y = -2; } } },   // test hooks
      update(dt0, t, pl) {
        if (!audio.amb) audio.start();
        arena.update(dt0, t, cam);
        if (hitstop > 0) { hitstop -= dt0; }
        const dt = hitstop > 0 ? dt0 * 0.15 : dt0;

        // keys
        if (edge('KeyR')) newRound();
        if (phase === 'end' && edge('Space')) newRound();
        ['Digit1', 'Digit2', 'Digit3', 'Digit4'].forEach((k, i) => { if (edge(k) && !meEnt.out) emote(meEnt, i); });
        const eDown = engine.input.down('KeyE');
        if (eDown && !keyPrev.KeyE) startCharge(); if (!eDown && keyPrev.KeyE) releaseThrow(); keyPrev.KeyE = eDown;
        if (edge('Space') && pl.onGround && phase !== 'end') audio.sfx('jump');
        if (charging) charge = Math.min(1, charge + dt0 / C.CHARGE_SECS);

        // phase
        if (phase === 'count') {
          countT -= dt0; const n = Math.ceil(countT);
          if (n !== lastTick && n > 0) { lastTick = n; ui.banner(String(n), 'snowballs ready…', 700); audio.sfx('tick', 0); }
          if (countT <= 0) { phase = 'play'; ui.banner('BRAWL!', 'knock them into the water', 900); audio.sfx('tick', 1); }
        } else if (phase === 'play') {
          R.time -= dt; R.elapsed += dt; R.throwCd -= dt;
          if (R.time <= 5 && Math.ceil(R.time) !== lastTick) { lastTick = Math.ceil(R.time); if (lastTick > 0) audio.sfx('tick', 0); }
          // floe collapse schedule
          if (R.elapsed >= R.nextSink) {
            const cand = floes.filter(f => !f.center && f.state === 'ok');
            // prefer crowded floes: more drama
            cand.sort((a, b) => ents.filter(e => !e.out && floeAt(e.pos.x, e.pos.z) === b).length - ents.filter(e => !e.out && floeAt(e.pos.x, e.pos.z) === a).length + rand(-0.8, 0.8));
            if (cand[0]) { arena.crack(cand[0]); audio.sfx('crack'); if (floeAt(pl.pos.x, pl.pos.z) === cand[0]) ui.banner('⚠ CRACKING!', 'hop to another floe', 1100); }
            R.nextSink += Math.max(4.5, C.SINK_EVERY - R.elapsed / 20);
          }
          arena.erode(R.elapsed / C.ROUND_SECS);
          if (R.time <= 0 && !meEnt.out) win(true);
        } else if (phase === 'post') { postT -= dt0; if (postT <= 0) endRound(); }
        else if (phase === 'end') { const before = Math.ceil(endT); endT -= dt0; if (Math.ceil(endT) !== before) ui.endCountdown(Math.max(0, Math.ceil(endT))); if (endT <= 0) newRound(); }
        for (const f of floes) { const ev = arena.stepFloe(f, dt); if (ev === 'sink') { audio.sfx('sink'); burst(f.x, 0, f.z, 30, '#bfe9ff', 5, 9, 1); } }

        const sim = phase === 'play' || phase === 'post';
        // ---- player support + knockback ----
        if (!meEnt.out) {
          if (sim) { pl.pos.addScaledVector(meEnt.kb, dt); }
          meEnt.kb.multiplyScalar(Math.exp(-2.4 * dt));
          if (phase === 'count') meEnt.kb.set(0, 0, 0);
          const f = floeAt(pl.pos.x, pl.pos.z);
          if (f && pl.pos.y <= f.y + 0.05 && pl.pos.y > f.y - 0.9 && pl.vel.y <= 0.01) {
            if (!pl.onGround && airT > 0.25) { audio.sfx('land'); burst(pl.pos.x, f.y + 0.1, pl.pos.z, 6, '#ffffff', 2, 6, 0.4); }
            pl.pos.y = f.y; pl.vel.y = 0; pl.onGround = true; airT = 0;
            stepD += playerVel.length() * dt0; if (stepD > 1.6) { stepD = 0; audio.sfx('step'); }
            const edgeD = f.r0 * f.scale - Math.hypot(pl.pos.x - f.x, pl.pos.z - f.z); warnT -= dt0;
            if (sim && edgeD < 0.6 && warnT <= 0 && !floes.some(o => o !== f && !o.gone && Math.hypot(pl.pos.x - o.x, pl.pos.z - o.z) < o.r0 * o.scale + 1)) { audio.sfx('warn'); warnT = 2.5; }
          }
          else { pl.onGround = false; airT += dt0; }
          if (pl.pos.y < -0.9 && sim) eliminate(meEnt);
          else if (pl.pos.y < -0.9) { pl.pos.y = 0; }
          if (meEnt.kb.length() > 5) burst(pl.pos.x, pl.pos.y + 0.8, pl.pos.z, 1, '#ffe680', 1, 0, 0.5);
        } else { pl.pos.y = Math.max(pl.pos.y, -1.6); pl.vel.set(0, 0, 0); }
        if (dt0 > 0) { playerVel.subVectors(pl.pos, prevPos).divideScalar(dt0); playerVel.y = 0; } prevPos.copy(pl.pos);

        // ---- bots ----
        for (const e of ents) {
          if (!e.bot) continue;
          if (e.out) { e.sinkT += dt; e.pos.y -= dt * 1.5; e.mesh.rotation.z += dt * 2; if (e.pos.y < -4) e.mesh.visible = false; continue; }
          let want = tmp2.set(0, 0, 0);
          if (phase === 'play') want = botThink(e, api, dt, want);
          e.vel.lerp(want, 1 - Math.exp(-3.2 * dt));
          if (sim) e.pos.addScaledVector(e.vel, dt).addScaledVector(e.kb, dt);
          e.kb.multiplyScalar(Math.exp(-2.4 * dt));
          e.vy -= C.GRAV * dt; e.pos.y += e.vy * dt;
          const f = floeAt(e.pos.x, e.pos.z);
          if (f && e.pos.y <= f.y + 0.05 && e.pos.y > f.y - 0.9 && e.vy <= 0) { e.pos.y = f.y; e.vy = 0; e.ground = true; } else e.ground = false;
          if (e.pos.y < -0.9) { if (sim) eliminate(e); else { e.pos.y = 0; e.vy = 0; } continue; }
          const sp = e.vel.length();
          if (sp > 0.5) e.mesh.rotation.y = Math.atan2(e.vel.x, e.vel.z);
          const legs = e.mesh.userData.legs, run = Math.sin(t * 14) * Math.min(1, sp / 5) * 0.7;
          legs[0].rotation.x = run; legs[1].rotation.x = -run;
          const arm = e.mesh.userData.arm; e.ai.throwAnim = Math.max(0, (e.ai.throwAnim || 0) - dt); arm.rotation.x = e.ai.throwAnim > 0 ? -2.6 * (e.ai.throwAnim / 0.25) : run * 0.6;
          const kbl = e.kb.length(); e.mesh.rotation.x = Math.min(0.5, kbl * 0.03);
          if (kbl > 5) burst(e.pos.x, e.pos.y + 0.8, e.pos.z, 1, e.color, 1, 0, 0.5);
        }
        // separation (bump each other a bit)
        for (let i = 0; i < ents.length; i++) for (let j = i + 1; j < ents.length; j++) {
          const a = ents[i], b = ents[j]; if (a.out || b.out) continue;
          const dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z, d = Math.hypot(dx, dz);
          if (d < 1.1 && d > 0.001) { const k = (1.1 - d) / 2 / d; a.pos.x -= dx * k; a.pos.z -= dz * k; b.pos.x += dx * k; b.pos.z += dz * k; }
        }

        // ---- snowballs ----
        for (const b of balls) {
          if (!b.alive) continue;
          b.v.y -= C.BALL_GRAV * dt; b.p.addScaledVector(b.v, dt);
          if (Math.random() < 0.5) burst(b.p.x, b.p.y, b.p.z, 1, b.charge > 0.6 ? '#ffd24a' : '#cfefff', 0.3, 0, 0.25);
          let done = false;
          for (const e of ents) {
            if (e === b.owner || e.out) continue;
            if ((e.pos.x - b.p.x) ** 2 + (e.pos.y + 1.1 - b.p.y) ** 2 + (e.pos.z - b.p.z) ** 2 < C.BALL_R ** 2) { hit(e, b); done = true; break; }
          }
          if (done) continue;
          const f = floeAt(b.p.x, b.p.z);
          if (f && b.p.y < f.y + 0.2) { burst(b.p.x, f.y + 0.2, b.p.z, 8, '#ffffff', 3, 9, 0.5); audio.sfx('splat'); b.alive = false; b.mesh.visible = false; }
          else if (b.p.y < -0.5) { burst(b.p.x, -0.45, b.p.z, 6, '#9fd8ff', 2.5, 9, 0.5); arena.ripple(b.p.x, b.p.z, 0.4); audio.sfx('water'); b.alive = false; b.mesh.visible = false; }
        }

        // ---- particles ----
        for (let i = 0; i < NP; i++) {
          const q = parts[i];
          if (q.life > 0) { q.life -= dt0; q.v.y -= q.g * dt0; q.v.multiplyScalar(Math.exp(-1.6 * dt0)); q.p.addScaledVector(q.v, dt0); if (q.p.y < -0.5) { q.p.y = -0.5; q.v.y *= -0.2; } }
          const k = Math.max(0, q.life / q.max);
          pPos[i * 3] = q.p.x; pPos[i * 3 + 1] = q.life > 0 ? q.p.y : -99; pPos[i * 3 + 2] = q.p.z;
          pCol[i * 3] = q.c.r * k; pCol[i * 3 + 1] = q.c.g * k; pCol[i * 3 + 2] = q.c.b * k;
        }
        pGeo.attributes.position.needsUpdate = true; pGeo.attributes.color.needsUpdate = true;
        for (const s of popPool) { if (s.t <= 0) continue; s.t -= dt0; s.spr.position.y += s.vy * dt0; s.vy *= Math.exp(-3 * dt0); const k = s.t > 0.75 ? 1 + (s.t - 0.75) * 4 : 1; s.spr.scale.copy(s.base).multiplyScalar(k); s.spr.material.opacity = Math.min(1, s.t * 3); if (s.t <= 0) s.spr.visible = false; else s.spr.visible = true; }
        for (const e of ents) {
          if (!e.emote) continue; e.emote.t -= dt0;
          e.emote.spr.position.set(e.pos.x, e.pos.y + 3.3 + Math.sin(t * 5) * 0.1, e.pos.z);
          e.emote.spr.material.opacity = Math.min(1, e.emote.t * 2); if (e.emote.t <= 0) { scene.remove(e.emote.spr); e.emote.spr.material.map.dispose(); e.emote.spr.material.dispose(); e.emote = null; }
        }

        // ---- camera punch ----
        shake = Math.max(0, shake - dt0 * 1.8);
        if (shake > 0) cam.position.add(tmp.set(rand(-1, 1), rand(-1, 1), rand(-1, 1)).multiplyScalar(shake * 0.35));

        const lockT = phase === 'play' && !meEnt.out ? aimAssist(meEnt, myForward(new THREE.Vector3()), mobile ? 0.75 : 0.42) : null;
        const board = [...ents].sort((a, b) => (a.out - b.out) || ((b.kos || 0) - (a.kos || 0))).map(e => ({ name: e.name, color: e.color, out: e.out, me: e.me, kos: e.kos || 0 }));
        if (R) ui.hud({ alive: aliveEnts().length, time: phase === 'count' ? C.ROUND_SECS : R.time, kos: R.kos, streak: save.streak || 0, charge: charging ? charge : 0, lock: lockT, board });
      },
      dispose() {
        alive = false; audio.stop(); ui.dispose();
        dom.removeEventListener('pointerdown', onDown); removeEventListener('pointermove', onMove); removeEventListener('pointerup', onUp);
        player.enabled = true; player.mods.speed = baseSpeed; player.camDist = camDist0;
        cam.far = camFar; cam.updateProjectionMatrix();
        persist(economy, save);
        scene.traverse(o => { o.geometry?.dispose?.(); const m = o.material; (Array.isArray(m) ? m : m ? [m] : []).forEach(x => { x.map?.dispose?.(); x.dispose(); }); });
      },
    };
    return game;
  },
};
