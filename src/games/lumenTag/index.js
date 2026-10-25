// Game: Lumen Tag — arcade laser tag in a glowing crystal cavern under aurora light shafts.
// Score race: first to C.TAGS_TO_WIN tags (or most tags at 90s). Tagged players blink out and respawn in 1.6s.
// 5 local bots (chase / strafe / duck behind crystal pillars / grab powers). Power crystals: Prism (triple beam),
// Surge (speed + rapid fire), Shield (eats one tag). Files: config, audio, ui, cavern (arena + thumb), bots, this (loop).
// Perf: no shadows; pooled beams/flares/text pops; one Points pool. MP: local only for now (engine draws remotes).
import * as THREE from 'three';
import { Collision } from '../../engine/collision.js';
import { getDeviceMode } from '../../core/device.js';
import * as C from './config.js';
import { LumenAudio } from './audio.js';
import { LumenUI } from './ui.js';
import { buildCavern, drawThumb } from './cavern.js';
import { makeBotMesh, textSprite, botThink, takeCover } from './bots.js';

function loadSave(economy) { return { ...C.DEFAULT_SAVE, ...((economy.profile?.gameData || {})[C.GAME_ID] || {}) }; }
function persist(economy, save) {
  economy.profile.gameData = { ...(economy.profile.gameData || {}), [C.GAME_ID]: save };
  if (typeof economy.saveGameData === 'function') economy.saveGameData(C.GAME_ID, save);
  else economy.backend?.saveProfile?.(economy.profile);
}
const rand = (a, b) => a + Math.random() * (b - a);
const POPS = ['ZAP!', 'TAGGED!', 'LIT!', 'BZZT!', 'GLOW\'D!'];
let _thumb = null;

export default {
  id: C.GAME_ID, name: 'Lumen Tag', tagline: 'Laser tag in the crystal cavern.',
  description: 'Arcade laser tag in a glowing crystal cavern under aurora light shafts. Strafe between crystal pillars, zap rivals with neon lumen beams, grab Prism, Surge and Shield crystals, and race to 15 tags before the clock runs out. Instant respawns, fast rounds, chase your personal best.',
  get thumbnail() { if (!_thumb) { try { _thumb = drawThumb(); } catch { _thumb = 'frost'; } } return _thumb; },
  music: 'none',
  mobile: true,

  async create(ctx) {
    const { economy, engine, music } = ctx;
    const player = engine.player, cam = engine.camera;
    const mobile = getDeviceMode() === 'mobile';
    let save = loadSave(economy);
    const camFar = cam.far; cam.far = 400; cam.updateProjectionMatrix();
    const cav = buildCavern();
    const { scene, pillars, pads, glowTex } = cav;
    const collision = new Collision({ floorY: 0, bounds: { type: 'circle', r: C.ARENA_R } });
    for (const p of pillars) collision.addCircle(p.x, p.z, p.r * 1.05);
    const audio = new LumenAudio(music);

    // ---------- particles ----------
    const NP = 500, pGeo = new THREE.BufferGeometry(), pPos = new Float32Array(NP * 3), pCol = new Float32Array(NP * 3);
    pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3)); pGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 3));
    const pts = new THREE.Points(pGeo, new THREE.PointsMaterial({ size: 0.45, map: glowTex, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, fog: false }));
    pts.frustumCulled = false; scene.add(pts);
    const parts = Array.from({ length: NP }, () => ({ life: 0, max: 1, p: new THREE.Vector3(), v: new THREE.Vector3(), c: new THREE.Color(), g: 0 }));
    let pNext = 0;
    function burst(x, y, z, n, color, speed = 5, grav = 6, life = 0.7, dir = null) {
      const base = new THREE.Color(color);
      for (let i = 0; i < n; i++) {
        const q = parts[pNext]; pNext = (pNext + 1) % NP;
        q.p.set(x, y, z); q.v.set(rand(-1, 1), rand(-0.6, 1.2), rand(-1, 1)).normalize().multiplyScalar(speed * rand(0.3, 1));
        if (dir) q.v.addScaledVector(dir, speed * 0.5);
        q.c.copy(base).offsetHSL(rand(-0.04, 0.04), 0, rand(-0.05, 0.15)); q.life = q.max = life * rand(0.6, 1.2); q.g = grav;
      }
    }

    // ---------- beams + flares (pooled) ----------
    const beamGeo = new THREE.CylinderGeometry(1, 1, 1, 6, 1, true); beamGeo.rotateX(Math.PI / 2); beamGeo.translate(0, 0, 0.5);
    const addM = (c, o = 1) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, fog: false });
    const beams = Array.from({ length: 32 }, () => {
      const g = new THREE.Group(); const core = new THREE.Mesh(beamGeo, addM('#ffffff')); const glow = new THREE.Mesh(beamGeo, addM('#4fd8ff', 0.5));
      g.add(core, glow); g.visible = false; scene.add(g); return { g, core, glow, t: 0, w: 1 };
    });
    let beamNext = 0;
    function beam(a, b, color, width = 1) {
      const B = beams[beamNext]; beamNext = (beamNext + 1) % beams.length;
      B.g.visible = true; B.g.position.copy(a); B.g.lookAt(b); B.len = a.distanceTo(b); B.t = 0.22; B.w = width;
      B.glow.material.color.set(color); B.g.scale.set(1, 1, B.len); return B;
    }
    const flares = Array.from({ length: 24 }, () => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, fog: false })); s.visible = false; scene.add(s); return { s, t: 0, max: 1, size: 1 }; });
    let flareNext = 0;
    function flare(p, color, size = 2, life = 0.25) { const F = flares[flareNext]; flareNext = (flareNext + 1) % flares.length; F.s.visible = true; F.s.position.copy(p); F.s.material.color.set(color); F.t = F.max = life; F.size = size; }
    // shockwave rings for tags
    const ringGeo = new THREE.RingGeometry(0.8, 1, 40);
    const rings = Array.from({ length: 8 }, () => { const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: '#fff', transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, fog: false })); m.rotation.x = -Math.PI / 2; scene.add(m); return { m, t: 0 }; });
    let ringNext = 0;
    function ring(x, z, color) { const r = rings[ringNext]; ringNext = (ringNext + 1) % rings.length; r.m.position.set(x, 0.1, z); r.m.material.color.set(color); r.t = 0.5; }

    // ---------- text pops ----------
    const popPool = [];
    function pop(text, x, y, z, color = '#fff36b', scale = 1) {
      let s = popPool.find(p => p.t <= 0);
      if (!s) { if (popPool.length > 8) s = popPool[0]; else { s = { spr: null, t: 0 }; popPool.push(s); } }
      if (s.spr) { scene.remove(s.spr); s.spr.material.map.dispose(); s.spr.material.dispose(); }
      s.spr = textSprite(text, color, 1.5 * scale); s.spr.position.set(x, y, z); s.vy = 2.6; s.t = 0.9; s.base = s.spr.scale.clone(); scene.add(s.spr);
    }

    // ---------- entities ----------
    const ents = [];
    const meEnt = { name: 'You', color: C.ME_COLOR, me: true, pos: player.pos, score: 0 };
    ents.push(meEnt);
    const botNames = [...C.BOT_NAMES].sort(() => Math.random() - 0.5);
    for (let i = 0; i < C.BOT_COUNT; i++) {
      const color = C.BOT_COLORS[i], mesh = makeBotMesh(color, botNames[i]); scene.add(mesh);
      ents.push({ name: botNames[i], color, bot: true, mesh, pos: mesh.position, vel: new THREE.Vector3(), vy: 0, ground: true, score: 0, ai: {} });
    }
    const shieldGeo = new THREE.IcosahedronGeometry(1.4, 1);
    for (const e of ents) { e.bubble = new THREE.Mesh(shieldGeo, new THREE.MeshBasicMaterial({ color: C.POWERS.shield.color, wireframe: true, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, fog: false })); e.bubble.visible = false; scene.add(e.bubble); }

    // ---------- line of sight / hitscan ----------
    function rayPillar(ox, oz, dx, dz, maxT) {     // first entry t into any pillar along a 2D ray
      let best = maxT, hitP = null;
      for (const p of pillars) {
        const fx = ox - p.x, fz = oz - p.z, b = fx * dx + fz * dz, c = fx * fx + fz * fz - p.r * p.r;
        if (c < 0) continue; const disc = b * b - c; if (disc < 0) continue;
        const t = -b - Math.sqrt(disc); if (t > 0 && t < best) { best = t; hitP = p; }
      }
      return { t: best, p: hitP };
    }
    function los(a, b) { const dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz); if (d < 0.01) return true; return !rayPillar(a.x, a.z, dx / d, dz / d, d).p; }
    const tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3(), A = new THREE.Vector3(), Bv = new THREE.Vector3();
    function aimAssist(e, fwd, cone) {
      let best = null, bs = Infinity;
      for (const o of ents) {
        if (o === e || o.dead) continue;
        tmp.subVectors(o.pos, e.pos); tmp.y = 0; const d = tmp.length(); if (d > C.RANGE * 0.9 || d < 0.1) continue;
        const ang = Math.acos(Math.max(-1, Math.min(1, tmp.dot(fwd) / d))); if (ang > cone || !los(e.pos, o.pos)) continue;
        const sc = ang * 10 + d * 0.1; if (sc < bs) { bs = sc; best = o; }
      }
      return best;
    }
    function leadDir(e, t, out) {
      const v = t.me ? playerVel : t.vel, d = Math.hypot(t.pos.x - e.pos.x, t.pos.z - e.pos.z), lead = d / 90;
      return out.set(t.pos.x + v.x * lead - e.pos.x, 0, t.pos.z + v.z * lead - e.pos.z).normalize();
    }
    function fire(e, dir) {
      const prism = e.power === 'prism';
      const angs = prism ? [-C.PRISM_SPREAD, 0, C.PRISM_SPREAD] : [0];
      const near = e.me || Math.hypot(e.pos.x - player.pos.x, e.pos.z - player.pos.z) < 22;
      if (e.me || near) audio.sfx(prism ? 'beam_fire_prism' : 'beam_fire', e.me ? 1 : 0.3);
      const y0 = e.pos.y + 1.45;
      for (const a of angs) {
        const c = Math.cos(a), s = Math.sin(a), dx = dir.x * c - dir.z * s, dz = dir.x * s + dir.z * c;
        const ox = e.pos.x + dx * 0.9, oz = e.pos.z + dz * 0.9;
        const blk = rayPillar(ox, oz, dx, dz, C.RANGE);
        let hit = null, ht = blk.t; const hr = prism ? C.HIT_R_PRISM : C.HIT_R;
        for (const o of ents) {
          if (o === e || o.dead) continue;
          const rx = o.pos.x - ox, rz = o.pos.z - oz, t = rx * dx + rz * dz;
          if (t < 0 || t > ht) continue;
          if (Math.abs(rx * dz - rz * dx) < hr) { hit = o; ht = t; }
        }
        A.set(ox, y0, oz);
        Bv.set(ox + dx * ht, hit ? hit.pos.y + 1.3 : y0 - Math.min(0.6, ht * 0.01), oz + dz * ht);
        beam(A, Bv, e.color, prism ? 1.5 : 1);
        flare(A, e.color, 1.6, 0.12);
        if (hit) tag(hit, e, tmp2.set(dx, 0, dz));
        else if (blk.p) { flare(Bv, blk.p.color, 2.4, 0.3); burst(Bv.x, Bv.y, Bv.z, 8, blk.p.color, 4, 5, 0.5); blk.p.flash = Math.min(1, blk.p.flash + 0.5); if (near && Math.random() < 0.6) audio.sfx('beam_block'); }
      }
      if (e.bot) e.ai.shootAnim = 0.12;
    }

    // ---------- tagging ----------
    let R = null, phase = 'count', countT = 0, lastTick = -1, endT = 0, postT = 0;
    let shake = 0, hitstop = 0, firing = false, alive = true, leader = null;
    const playerVel = new THREE.Vector3(), prevPos = new THREE.Vector3();
    const camDist0 = player.camDist, baseSpeed = player.mods.speed;
    const tagHtml = (x) => `<b style="color:${x.color};text-shadow:0 0 8px ${x.color}">${x.name}</b>`;
    function tag(o, by, dir) {
      if (phase !== 'play' || o.inv > 0) return;
      if (o.power === 'shield') {
        o.power = null; o.inv = 0.5; flare(tmp.set(o.pos.x, o.pos.y + 1.3, o.pos.z), C.POWERS.shield.color, 5, 0.4); burst(o.pos.x, o.pos.y + 1.3, o.pos.z, 20, C.POWERS.shield.color, 6, 2, 0.5);
        if (o.me || by.me) { audio.sfx('shield_block'); pop('BLOCKED!', o.pos.x, o.pos.y + 3, o.pos.z, C.POWERS.shield.color); }
        return;
      }
      o.dead = true; o.deadT = C.RESPAWN_SECS; o.deaths = (o.deaths || 0) + 1; o.streak = 0; o.power = null; o.by = by;
      by.score++; by.streak = (by.streak || 0) + 1; by.streakBest = Math.max(by.streakBest || 0, by.streak);
      const hx = o.pos.x, hy = o.pos.y + 1.3, hz = o.pos.z;
      burst(hx, hy, hz, 34, o.color, 8, 4, 0.8, dir); burst(hx, hy, hz, 18, '#ffffff', 5, 2, 0.5); burst(hx, hy, hz, 12, by.color, 6, 3, 0.7);
      flare(tmp.set(hx, hy, hz), '#ffffff', 6, 0.35); ring(hx, hz, by.color);
      ui.feed(`${tagHtml(by)} ✦ ${tagHtml(o)}`);
      if (by.me) {
        R.tags++; ui.hitmark(); audio.sfx('beam_hit'); hitstop = 0.06; shake = Math.max(shake, 0.22);
        const combo = R.elapsed - (R.lastTagT ?? -9) < 3; R.lastTagT = R.elapsed;
        pop(combo ? 'DOUBLE TAG!' : POPS[(Math.random() * POPS.length) | 0], hx, hy + 1.6, hz, combo ? '#ff8be0' : '#fff36b', combo ? 1.4 : 1.1);
        if (combo) audio.sfx('combo_tag');
        if (by.streak === 5) ui.banner('🔥 ON FIRE', '5 tags without being tagged', 1200);
        if (C.TAGS_TO_WIN - by.score === 3) ui.banner('✦ 3 TO GO', 'finish it!', 1000);
      }
      if (o.me) {
        R.deaths++; ui.flash(); shake = Math.max(shake, 0.5); hitstop = 0.08; audio.sfx('tag_out'); player.enabled = false; firing = false;
      } else { o.mesh.visible = false; if (o.ai) o.ai.cover = null; }
      // bots that just got shot at duck for cover
      for (const e of ents) if (e.bot && !e.dead && e !== by && Math.hypot(e.pos.x - hx, e.pos.z - hz) < 8 && Math.random() < 0.5) takeCover(e, api, by);
      if (by.score >= C.TAGS_TO_WIN) finish(by);
    }
    function spawnPoint(e) {
      let best = null, bs = -1;
      for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2, x = Math.cos(a) * 25, z = Math.sin(a) * 25;
        let md = Infinity; for (const o of ents) if (o !== e && !o.dead) md = Math.min(md, Math.hypot(o.pos.x - x, o.pos.z - z));
        const sc = md * rand(0.7, 1.3); if (sc > bs) { bs = sc; best = { x, z }; } }
      return best;
    }
    function respawn(e) {
      const s = spawnPoint(e); e.dead = false; e.inv = C.INVULN_SECS;
      const face = Math.atan2(-s.x, -s.z);
      if (e.me) { player.teleport(new THREE.Vector3(s.x, 0, s.z), face); player.enabled = true; audio.sfx('respawn'); }
      else { e.pos.set(s.x, 0, s.z); e.vel.set(0, 0, 0); e.vy = 0; e.mesh.visible = true; e.mesh.rotation.y = face; e.ai.target = null; e.ai.retarget = 0; }
      burst(s.x, 1, s.z, 24, e.color, 4, -2, 0.8); ring(s.x, s.z, e.color);
    }

    const ui = new LumenUI(mobile, { onFireDown: () => { firing = true; }, onFireUp: () => { firing = false; } });
    function myForward(v) {
      if (mobile) return v.set(Math.sin(player.facing), 0, Math.cos(player.facing));
      return v.set(-Math.sin(player.camYaw), 0, -Math.cos(player.camYaw));
    }
    const dom = engine.renderer.domElement;
    const onDown = (e) => { if (e.button !== 0 || mobile) return; firing = true; };
    const onUp = () => { if (!mobile) firing = false; };
    dom.addEventListener('pointerdown', onDown); addEventListener('pointerup', onUp); addEventListener('blur', onUp);

    function newRound() {
      R = { time: C.ROUND_SECS, elapsed: 0, tags: 0, deaths: 0, fireCd: 0 };
      leader = null; player.mods.speed = baseSpeed * 1.1;
      for (const p of pads) { p.ready = !p.center; p.t = p.center ? 25 : 0; }
      ents.forEach((e, i) => {
        const a = i / ents.length * Math.PI * 2, sx = Math.cos(a) * 24, sz = Math.sin(a) * 24, face = Math.atan2(-sx, -sz);
        e.score = 0; e.dead = false; e.deadT = 0; e.inv = 0; e.power = null; e.powerT = 0; e.streak = 0; e.streakBest = 0; e.deaths = 0;
        if (e.me) { player.enabled = true; player.teleport(new THREE.Vector3(sx, 0, sz), face); player.camDist = 10; player.camPitch = 0.42; }
        else { e.pos.set(sx, 0, sz); e.vel.set(0, 0, 0); e.vy = 0; e.mesh.visible = true; e.mesh.rotation.set(0, face, 0); e.ai = { cd: rand(0.6, 1.4), retarget: 0, strafeT: 0, coverT: 0, react: 0, skill: rand(0.85, 1.15) }; }
      });
      phase = 'count'; countT = 3; lastTick = -1; firing = false;
      ui.hideEnd(); prevPos.copy(player.pos);
    }
    function ranking() { return [...ents].sort((a, b) => b.score - a.score || (a.me ? -1 : b.me ? 1 : 0)); }
    function myPlace() { return 1 + ents.filter(e => !e.me && e.score > meEnt.score).length; }
    function finish(winner) {
      if (phase !== 'play') return;
      phase = 'post'; postT = 2.2; firing = false;
      const won = winner ? winner.me : myPlace() === 1;
      R.won = won; R.winner = (winner || ranking()[0]).name; R.place = myPlace();
      if (won) {
        ui.banner('🏆 VICTORY!', winner ? `first to ${C.TAGS_TO_WIN}` : 'most tags at the buzzer', 2000); audio.sfx('win_fanfare');
        for (let i = 0; i < 5; i++) setTimeout(() => alive && burst(player.pos.x + rand(-3, 3), 3 + rand(0, 3), player.pos.z + rand(-3, 3), 34, ['#7af2ff', '#c08bff', '#ff8be0', '#8bffc4', '#ffe14f'][i], 8, 3, 1.3), i * 200);
      } else { ui.banner(`✦ ${R.winner} WINS`, `you placed #${R.place}`, 2000); audio.sfx('defeat'); }
    }
    function endRound() {
      phase = 'end'; endT = 8;
      const prevBest = save.bestTags || 0;
      save = { ...save, rounds: (save.rounds || 0) + 1, wins: (save.wins || 0) + (R.won ? 1 : 0), tags: (save.tags || 0) + R.tags,
        bestTags: Math.max(prevBest, R.tags), bestStreak: Math.max(save.bestStreak || 0, meEnt.streakBest || 0) };
      const rewards = [];
      for (const m of C.MILESTONES) {
        if (save.milestones.includes(m.id) || !m.test(R, save)) continue;
        save = { ...save, milestones: [...save.milestones, m.id] };
        try { economy.earn(m.bb, `Lumen Tag: ${m.label}`, { source: 'Lumen Tag' }); } catch {}
        rewards.push(m);
      }
      persist(economy, save);
      ui.showEnd({ ...R, total: ents.length, streakBest: meEnt.streakBest || 0, bestTags: save.bestTags, newBest: R.tags > prevBest && R.tags > 0, rewards }, () => { audio.sfx('ui_click'); newRound(); });
    }

    const api = { ents, pillars, pads, los, leadDir, fire, get R() { return R; } };
    newRound();
    let keyPrev = {};
    const edge = (code) => { const d = engine.input.down(code), p = keyPrev[code]; keyPrev[code] = d; return d && !p; };
    const game = {
      scene, collision, spawn: player.pos.clone(), spawnFacing: player.facing, music: 'none', maxCamDist: 13,
      lumen: { get state() { return { phase, ...(R || {}), place: myPlace(), score: meEnt.score }; }, restart: () => newRound(), skipCountdown: () => { countT = 0; },
        setTime: (v) => { if (R) R.time = v; }, ents: () => ents.map(e => ({ name: e.name, dead: !!e.dead, score: e.score, power: e.power || null, x: +e.pos.x.toFixed(1), z: +e.pos.z.toFixed(1) })),
        fireAt: (name) => { const t = ents.find(e => e.name === name); if (t) fire(meEnt, leadDir(meEnt, t, new THREE.Vector3())); },
        tag: (name) => { const t = ents.find(e => e.name === name); if (t) { t.inv = 0; tag(t, meEnt, new THREE.Vector3(1, 0, 0)); } },
        givePower: (type) => grant(meEnt, type) },   // test hooks
      update(dt0, t, pl) {
        if (!audio.amb) audio.start();
        cav.update(dt0, t);
        if (hitstop > 0) hitstop -= dt0;
        const dt = hitstop > 0 ? dt0 * 0.2 : dt0;
        if (edge('KeyR')) newRound();
        if (phase === 'end' && edge('Space')) newRound();
        const fKey = engine.input.down('KeyF') || engine.input.down('KeyE');

        if (phase === 'count') {
          countT -= dt0; const n = Math.ceil(countT);
          if (n !== lastTick && n > 0) { lastTick = n; ui.banner(String(n), 'lumens charging…', 700); audio.sfx('countdown_tick'); }
          if (countT <= 0) { phase = 'play'; ui.banner('LIGHT \'EM UP!', `first to ${C.TAGS_TO_WIN} tags`, 1000); audio.sfx('round_start'); }
        } else if (phase === 'play') {
          R.time -= dt; R.elapsed += dt; R.fireCd -= dt;
          if (R.time <= 10 && Math.ceil(R.time) !== lastTick) { lastTick = Math.ceil(R.time); if (lastTick > 0) audio.sfx('final_seconds'); if (lastTick === 10) ui.banner('⏱ 10 SECONDS', '', 900); }
          if (R.time <= 0) finish(null);
          // player fire
          if ((firing || fKey) && !meEnt.dead && R.fireCd <= 0) {
            const fwd = myForward(new THREE.Vector3());
            const tg = aimAssist(meEnt, fwd, mobile ? 0.6 : 0.14);
            const dir = tg ? leadDir(meEnt, tg, fwd) : fwd;
            player.facing = Math.atan2(dir.x, dir.z);
            fire(meEnt, dir); R.fireCd = C.FIRE_CD * (meEnt.power === 'surge' ? 0.55 : 1);
            cam.position.addScaledVector(dir, -0.08);
          }
          // lead change
          const top = ranking(); const lead = top[0].score > top[1].score ? top[0] : null;
          if (lead && lead !== leader) { if (lead.me) { audio.sfx('lead_take'); ui.banner('👑 YOU TAKE THE LEAD', '', 900); } leader = lead; }
        } else if (phase === 'post') { postT -= dt0; if (postT <= 0) endRound(); }
        else if (phase === 'end') { const before = Math.ceil(endT); endT -= dt0; if (Math.ceil(endT) !== before) ui.endCountdown(Math.max(0, Math.ceil(endT))); if (endT <= 0) newRound(); }
        const sim = phase === 'play';

        // ---- timers, respawn, powers ----
        for (const e of ents) {
          e.inv = Math.max(0, (e.inv || 0) - dt);
          if (e.dead && sim) { e.deadT -= dt; if (e.deadT <= 0) respawn(e); }
          if (e.power) { e.powerT -= dt; if (e.powerT <= 0) { e.power = null; if (e.me) player.mods.speed = baseSpeed * 1.1; } }
          e.bubble.visible = e.power === 'shield' && !e.dead;
          if (e.bubble.visible) { e.bubble.position.set(e.pos.x, e.pos.y + 1.3, e.pos.z); e.bubble.rotation.y = t; e.bubble.material.opacity = 0.35 + Math.sin(t * 8) * 0.15; }
          if (e.power && !e.dead && Math.random() < 0.4) burst(e.pos.x + rand(-0.4, 0.4), e.pos.y + rand(0.3, 2.2), e.pos.z + rand(-0.4, 0.4), 1, C.POWERS[e.power].color, 0.8, -1, 0.5);
        }
        for (const p of pads) {
          if (!p.ready) { if (sim) { p.t -= dt; if (p.t <= 0) { p.ready = true; flare(tmp.set(p.x, 1.4, p.z), C.POWERS[p.type].color, 5, 0.5); audio.sfx('power_spawn'); if (p.center) ui.feed(`🔺 <b style="color:${C.POWERS.prism.color}">Prism crystal</b> in the center!`); } } continue; }
          if (!sim) continue;
          for (const e of ents) if (!e.dead && Math.hypot(e.pos.x - p.x, e.pos.z - p.z) < 1.7) { grant(e, p.type); p.ready = false; p.t = C.POWER_RESPAWN + (p.center ? 6 : 0); break; }
        }

        // ---- player motion ----
        if (dt0 > 0) { playerVel.subVectors(pl.pos, prevPos).divideScalar(dt0); playerVel.y = 0; } prevPos.copy(pl.pos);
        if (!sim) { if (phase === 'count') { pl.vel.x = pl.vel.z = 0; } }

        // ---- bots ----
        for (const e of ents) {
          if (!e.bot || e.dead) continue;
          let want = tmp2.set(0, 0, 0);
          if (sim) want = botThink(e, api, dt, want);
          e.vel.lerp(want, 1 - Math.exp(-5 * dt));
          e.pos.addScaledVector(e.vel, dt);
          e.vy -= 26 * dt; e.pos.y += e.vy * dt; if (e.pos.y <= 0) { e.pos.y = 0; e.vy = 0; e.ground = true; }
          for (const p of pillars) { const dx = e.pos.x - p.x, dz = e.pos.z - p.z, d = Math.hypot(dx, dz), r = p.r + 0.55; if (d < r && d > 0.001) { e.pos.x = p.x + dx / d * r; e.pos.z = p.z + dz / d * r; } }
          const rr = Math.hypot(e.pos.x, e.pos.z); if (rr > C.ARENA_R) { e.pos.x *= C.ARENA_R / rr; e.pos.z *= C.ARENA_R / rr; }
          const sp = Math.hypot(e.vel.x, e.vel.z);
          e.ai.faceT = (e.ai.faceT || 0) - dt;
          if (e.ai.faceT <= 0 && sp > 0.5) e.mesh.rotation.y = Math.atan2(e.vel.x, e.vel.z);
          const u = e.mesh.userData, run = Math.sin(t * 15 + e.score) * Math.min(1, sp / 5) * 0.8;
          u.legs[0].rotation.x = run; u.legs[1].rotation.x = -run;
          e.ai.shootAnim = Math.max(0, (e.ai.shootAnim || 0) - dt); u.arm.rotation.x = -1.35 - e.ai.shootAnim * 3;
          u.glow.emissiveIntensity = e.inv > 0 ? (Math.sin(t * 40) > 0 ? 2.5 : 0.2) : 1.4 + Math.sin(t * 4) * 0.3;
          e.mesh.visible = !(e.inv > 0 && Math.sin(t * 30) < -0.6);
        }
        for (let i = 0; i < ents.length; i++) for (let j = i + 1; j < ents.length; j++) {
          const a = ents[i], b = ents[j]; if (a.dead || b.dead) continue;
          const dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z, d = Math.hypot(dx, dz);
          if (d < 1.1 && d > 0.001) { const k = (1.1 - d) / 2 / d; if (!a.me) { a.pos.x -= dx * k; a.pos.z -= dz * k; } if (!b.me) { b.pos.x += dx * k; b.pos.z += dz * k; } }
        }

        // ---- fx ----
        for (const B of beams) { if (B.t <= 0) continue; B.t -= dt0; const k = Math.max(0, B.t / 0.22);
          B.core.scale.set(0.08 * B.w * (0.4 + k), 0.08 * B.w * (0.4 + k), 1); B.glow.scale.set(0.34 * B.w * (0.5 + k), 0.34 * B.w * (0.5 + k), 1);
          B.core.material.opacity = k; B.glow.material.opacity = 0.6 * k; if (B.t <= 0) B.g.visible = false; }
        for (const F of flares) { if (F.t <= 0) continue; F.t -= dt0; const k = Math.max(0, F.t / F.max); F.s.scale.setScalar(F.size * (1.4 - k * 0.4)); F.s.material.opacity = k; if (F.t <= 0) F.s.visible = false; }
        for (const r of rings) { if (r.t <= 0) { r.m.material.opacity = 0; continue; } r.t -= dt0; const k = 1 - r.t / 0.5; r.m.scale.setScalar(0.5 + k * 5); r.m.material.opacity = (1 - k) * 0.9; }
        for (let i = 0; i < NP; i++) {
          const q = parts[i];
          if (q.life > 0) { q.life -= dt0; q.v.y -= q.g * dt0; q.v.multiplyScalar(Math.exp(-2 * dt0)); q.p.addScaledVector(q.v, dt0); if (q.p.y < 0.05) { q.p.y = 0.05; q.v.y *= -0.3; } }
          const k = Math.max(0, q.life / q.max);
          pPos[i * 3] = q.p.x; pPos[i * 3 + 1] = q.life > 0 ? q.p.y : -99; pPos[i * 3 + 2] = q.p.z;
          pCol[i * 3] = q.c.r * k; pCol[i * 3 + 1] = q.c.g * k; pCol[i * 3 + 2] = q.c.b * k;
        }
        pGeo.attributes.position.needsUpdate = true; pGeo.attributes.color.needsUpdate = true;
        for (const s of popPool) { if (s.t <= 0) continue; s.t -= dt0; s.spr.position.y += s.vy * dt0; s.vy *= Math.exp(-3 * dt0); const k = s.t > 0.75 ? 1 + (s.t - 0.75) * 4 : 1; s.spr.scale.copy(s.base).multiplyScalar(k); s.spr.material.opacity = Math.min(1, s.t * 3); s.spr.visible = s.t > 0; }

        shake = Math.max(0, shake - dt0 * 2);
        if (shake > 0) cam.position.add(tmp.set(rand(-1, 1), rand(-1, 1), rand(-1, 1)).multiplyScalar(shake * 0.3));

        const lockT = phase === 'play' && !meEnt.dead ? aimAssist(meEnt, myForward(new THREE.Vector3()), mobile ? 0.6 : 0.14) : null;
        const board = ranking().map(e => ({ name: e.name, color: e.color, me: e.me, score: e.score, dead: e.dead }));
        if (R) ui.hud({ tags: meEnt.score, time: phase === 'count' ? C.ROUND_SECS : R.time, place: `#${myPlace()}`, lock: lockT, board,
          power: meEnt.power, powerK: meEnt.power ? meEnt.powerT / C.POWER_SECS[meEnt.power] : 0, deadT: meEnt.dead ? meEnt.deadT : 0, deadBy: meEnt.by?.name });
      },
      dispose() {
        alive = false; audio.stop(); ui.dispose();
        dom.removeEventListener('pointerdown', onDown); removeEventListener('pointerup', onUp); removeEventListener('blur', onUp);
        player.enabled = true; player.mods.speed = baseSpeed; player.camDist = camDist0;
        cam.far = camFar; cam.updateProjectionMatrix();
        persist(economy, save);
        scene.traverse(o => { o.geometry?.dispose?.(); const m = o.material; (Array.isArray(m) ? m : m ? [m] : []).forEach(x => { x.map?.dispose?.(); x.dispose(); }); });
      },
    };
    function grant(e, type) {
      e.power = type; e.powerT = C.POWER_SECS[type]; const P = C.POWERS[type];
      burst(e.pos.x, 1.4, e.pos.z, 30, P.color, 6, -1, 0.8); flare(tmp.set(e.pos.x, 1.4, e.pos.z), P.color, 5, 0.4); ring(e.pos.x, e.pos.z, P.color);
      if (e.me) { audio.sfx(`power_${type}`); ui.banner(`${P.icon} ${P.label}!`, P.sub, 1100); if (type === 'surge') player.mods.speed = baseSpeed * 1.45; }
      else if (Math.hypot(e.pos.x - player.pos.x, e.pos.z - player.pos.z) < 18) ui.feed(`${tagHtml(e)} grabbed ${P.icon} ${P.label}`);
    }
    return game;
  },
};
