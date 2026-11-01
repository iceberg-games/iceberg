// Game: Snowball Siege — cozy 4v4 team fortress snowball war.
// Win by bonking the enemy fort core to 0, or by holding the mid ring until it fills. Hold-to-charge throws,
// cover crates/walls, soft 3-hit HP + quick respawn, ammo + reload (or refill at your fort's snow piles).
// Solo: 3 bot teammates vs 4 bot rivals (roles: attack fort / hold mid / defend).
// Files: config.js, arena.js (procedural set), audio.js (Sound 2 pack + procedural fallback), ui.js, thumb.js, this (loop + bots).
import * as THREE from 'three';
import { Collision } from '../../engine/collision.js';
import { getDeviceMode } from '../../core/device.js';
import * as C from './config.js';
import { SiegeAudio } from './audio.js';
import { SiegeUI } from './ui.js';
import { buildArena } from './arena.js';
import { drawThumb } from './thumb.js';

function loadSave(economy) { return { ...C.DEFAULT_SAVE, ...((economy.profile?.gameData || {})[C.GAME_ID] || {}) }; }
function persist(economy, save) {
  economy.profile.gameData = { ...(economy.profile.gameData || {}), [C.GAME_ID]: save };
  if (typeof economy.saveGameData === 'function') economy.saveGameData(C.GAME_ID, save);
  else economy.backend?.saveProfile?.(economy.profile);
}
const rand = (a, b) => a + Math.random() * (b - a);
const POPS = ['BONK!', 'POW!', 'SPLAT!', 'THWAP!', 'FWUMP!'];
let _thumb = null;

function textSprite(text, color = '#fff', size = 1.6, emoji = false) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 128; const g = c.getContext('2d');
  g.textAlign = 'center'; g.textBaseline = 'middle';
  if (emoji) { g.fillStyle = 'rgba(255,255,255,.95)'; g.beginPath(); g.roundRect(68, 8, 120, 104, 30); g.fill(); g.font = '72px sans-serif'; g.fillText(text, 128, 64); }
  else { g.font = '900 54px sans-serif'; g.lineWidth = 10; g.strokeStyle = '#1a0f2e'; g.strokeText(text, 128, 64); g.fillStyle = color; g.fillText(text, 128, 64); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthTest: false, depthWrite: false })); s.renderOrder = 10;
  s.scale.set(size * 2, size, 1); return s;
}
function makeBotMesh(T, name) {
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  const m = (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.7 });
  const box = (w, h, d, mat, x, y, z) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); b.position.set(x, y, z); return b; };
  const shirt = m(T.color), skin = m('#ffd34d'), pants = m('#2d3a5a');
  const legs = [-0.22, 0.22].map(x => { const p = new THREE.Group(); p.position.set(x, 0.8, 0); p.add(box(0.38, 0.8, 0.4, pants, 0, -0.4, 0)); body.add(p); return p; });
  body.add(box(0.9, 0.85, 0.5, shirt, 0, 1.22, 0));
  const arm = new THREE.Group(); arm.position.set(0.6, 1.55, 0); arm.add(box(0.3, 0.8, 0.32, shirt, 0, -0.35, 0)); body.add(arm);
  body.add(box(0.3, 0.8, 0.32, shirt, -0.6, 1.2, 0), box(0.62, 0.62, 0.62, skin, 0, 1.96, 0));
  body.add(box(0.12, 0.12, 0.05, m('#1a1a2e'), -0.14, 2.0, 0.32), box(0.12, 0.12, 0.05, m('#1a1a2e'), 0.14, 2.0, 0.32));
  body.add(box(0.68, 0.26, 0.68, m(T.dark), 0, 2.36, 0));
  const pom = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), m('#ffffff')); pom.position.y = 2.6; body.add(pom);
  body.add(box(0.7, 0.14, 0.56, m('#ffffff'), 0, 1.66, 0));
  const tag = textSprite(name, T.color, 0.9); tag.position.y = 3.1; g.add(tag);
  g.userData = { legs, arm, body };
  return g;
}

export default {
  id: C.GAME_ID, name: 'Snowball Siege', tagline: 'Team fort snowball war — bonk their fort, hold the middle!',
  description: 'Two icy forts, one snowy battlefield. Team up 4v4, duck behind crates, charge up mega snowballs and bonk the enemy fort until it crumbles — or hold the middle ring to win the siege. Soft hits, quick respawns, lots of BONK.',
  get thumbnail() { if (!_thumb) { try { _thumb = drawThumb(); } catch { _thumb = 'frost'; } } return _thumb; },
  music: 'none',
  mobile: true,

  async create(ctx) {
    const { economy, engine, music } = ctx;
    const player = engine.player, cam = engine.camera;
    const mobile = getDeviceMode() === 'mobile';
    let save = loadSave(economy);
    const collision = new Collision({ floorY: 0, bounds: { type: 'box', minX: -C.HALF_X + 0.6, maxX: C.HALF_X - 0.6, minZ: -C.HALF_Z + 0.6, maxZ: C.HALF_Z - 0.6 } });
    const arena = buildArena(collision);
    const { scene, covers, forts, glowTex, mid } = arena;
    const audio = new SiegeAudio(music);
    let alive = true;

    // ---------- particles ----------
    const NP = 500, pGeo = new THREE.BufferGeometry(), pPos = new Float32Array(NP * 3), pCol = new Float32Array(NP * 3);
    pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3)); pGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 3));
    const pts = new THREE.Points(pGeo, new THREE.PointsMaterial({ size: 0.5, map: glowTex, vertexColors: true, transparent: true, depthWrite: false, toneMapped: false }));
    pts.frustumCulled = false; scene.add(pts);
    const parts = Array.from({ length: NP }, () => ({ life: 0, max: 1, p: new THREE.Vector3(), v: new THREE.Vector3(), c: new THREE.Color(), g: 0 }));
    let pNext = 0;
    function burst(x, y, z, n, color, speed = 5, grav = 9, life = 0.8, dir = null) {
      const base = new THREE.Color(color);
      for (let i = 0; i < n; i++) {
        const q = parts[pNext]; pNext = (pNext + 1) % NP;
        q.p.set(x, y, z); q.v.set(rand(-1, 1), rand(0.2, 1.3), rand(-1, 1)).normalize().multiplyScalar(speed * rand(0.35, 1));
        if (dir) q.v.addScaledVector(dir, speed * 0.5);
        q.c.copy(base).offsetHSL(0, 0, rand(-0.08, 0.05)); q.life = q.max = life * rand(0.6, 1.2); q.g = grav;
      }
    }
    // ---------- text pops + emotes ----------
    const popPool = [];
    function pop(text, x, y, z, color = '#fff36b', scale = 1) {
      let s = popPool.find(p => p.t <= 0);
      if (!s) { if (popPool.length > 10) s = popPool[0]; else { s = { spr: null, t: 0 }; popPool.push(s); } }
      if (s.spr) { scene.remove(s.spr); s.spr.material.map.dispose(); s.spr.material.dispose(); }
      s.spr = textSprite(text, color, 1.5 * scale); s.spr.position.set(x, y, z); s.vy = 2.5; s.t = 0.9; s.base = s.spr.scale.clone(); scene.add(s.spr);
    }
    function emote(e, i) {
      if (e.emote) { scene.remove(e.emote.spr); e.emote.spr.material.map.dispose(); e.emote.spr.material.dispose(); }
      const spr = textSprite(C.EMOTES[i], '#fff', 2.2, true); scene.add(spr); e.emote = { spr, t: 2.2 };
      if (e.me) audio.sfx('emote');
    }

    // ---------- entities (team 0 = Frost = you) ----------
    const ents = [];
    const meEnt = { name: 'You', team: 0, me: true, pos: player.pos, hp: C.HP, ammo: C.AMMO, down: 0, shield: 0, tags: 0 };
    ents.push(meEnt);
    const names = [...C.BOT_NAMES].sort(() => Math.random() - 0.5);
    const ROLES = ['attack', 'mid', 'defend', 'mid'];
    for (let t = 0; t < 2; t++) for (let i = t ? 0 : 1; i < C.TEAM_SIZE; i++) {
      const T = C.TEAMS[t], name = names.pop(); const mesh = makeBotMesh(T, name); scene.add(mesh);
      ents.push({ name, team: t, bot: true, mesh, pos: mesh.position, vel: new THREE.Vector3(), vy: 0, hp: C.HP, ammo: C.AMMO, down: 0, shield: 0, tags: 0, role: ROLES[i], ai: {} });
    }
    const tagOf = (e) => `<b style="color:${C.TEAMS[e.team].color}">${e.name}</b>`;

    // ---------- snowballs ----------
    const ballGeo = new THREE.SphereGeometry(0.3, 10, 8);
    const balls = Array.from({ length: 40 }, () => {
      const mesh = new THREE.Mesh(ballGeo, new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#9fd8ff', emissiveIntensity: 0.3, roughness: 0.6 }));
      mesh.visible = false; scene.add(mesh); return { mesh, p: mesh.position, v: new THREE.Vector3(), alive: false, owner: null, charge: 0, dodged: new Set() };
    });
    const tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3();
    const enemyFort = (e) => forts[1 - e.team], ownFort = (e) => forts[e.team];
    function aimAssist(e, fwd, cone) {
      let best = null, bs = Infinity;
      for (const o of ents) {
        if (o.team === e.team || o.down > 0) continue;
        tmp.subVectors(o.pos, e.pos); tmp.y = 0; const d = tmp.length(); if (d > 28 || d < 0.1) continue;
        const ang = Math.acos(Math.max(-1, Math.min(1, tmp.dot(fwd) / d))); if (ang > cone) continue;
        const sc = ang * 8 + d; if (sc < bs) { bs = sc; best = o; }
      }
      const f = enemyFort(e); if (!f.broken) { tmp.set(f.x - e.pos.x, 0, f.z - e.pos.z); const d = tmp.length(); const ang = Math.acos(Math.max(-1, Math.min(1, tmp.dot(fwd) / d))); if (d < 28 && ang < cone && ang * 8 + d + 4 < bs) best = { fort: f, pos: { x: f.x, y: 0, z: f.z } }; }
      return best;
    }
    function aimAt(e, target, out) {
      const tx = target.pos.x, tz = target.pos.z, d = Math.hypot(tx - e.pos.x, tz - e.pos.z), tf = d / C.BALL_SPEED;
      const v = target.fort ? null : target.me ? playerVel : target.vel;
      out.set(tx + (v ? v.x * tf * 0.7 : 0) - e.pos.x, 0, tz + (v ? v.z * tf * 0.7 : 0) - e.pos.z).normalize();
      out.y = target.fort ? Math.min(0.45, d / 70) : Math.min(0.25, d / 110);   // loft for range / tall fort core
      return out;
    }
    function throwBall(e, dir, charge) {
      const b = balls.find(b => !b.alive); if (!b) return;
      b.alive = true; b.owner = e; b.charge = charge; b.dodged.clear(); b.mesh.visible = true; b.mesh.scale.setScalar(1 + charge * 0.7);
      b.mesh.material.emissive.set(charge > 0.95 ? '#ffd24a' : '#9fd8ff');
      b.p.set(e.pos.x + dir.x * 0.7, e.pos.y + 1.6, e.pos.z + dir.z * 0.7);
      b.v.set(dir.x, 0, dir.z).normalize().multiplyScalar(C.BALL_SPEED * (1 + charge * 0.3)); b.v.y = 2.6 + (dir.y || 0) * C.BALL_SPEED;
      e.ammo--; if (e.ammo <= 0) startReload(e);
      if (e.me || Math.hypot(e.pos.x - player.pos.x, e.pos.z - player.pos.z) < 14) audio.sfx('sfx_throw_release', charge);
      burst(b.p.x, b.p.y, b.p.z, 4, '#ffffff', 2, 4, 0.3);
      if (e.bot) e.ai.throwAnim = 0.25;
    }
    function startReload(e) { if (e.reload > 0 || e.ammo >= C.AMMO) return; e.reload = C.RELOAD_SECS; if (e.me) audio.sfx('sfx_reload'); }

    function hitEnt(target, b) {
      const dmg = b.charge > 0.95 ? 2 : 1; const o = b.owner;
      b.alive = false; b.mesh.visible = false;
      burst(b.p.x, b.p.y, b.p.z, 16 + b.charge * 16, '#ffffff', 6 + b.charge * 4, 10, 0.6, tmp.set(b.v.x, 0, b.v.z).normalize());
      burst(b.p.x, b.p.y, b.p.z, 6, C.TEAMS[target.team].color, 4, 8, 0.6);
      if (target.shield > 0) { pop('🛡', b.p.x, b.p.y + 0.8, b.p.z, '#fff', 0.8); return; }
      target.hp -= dmg;
      const near = o.me || target.me || Math.hypot(b.p.x - player.pos.x, b.p.z - player.pos.z) < 16;
      if (near) audio.sfx('sfx_snowball_hit', b.charge);
      if (target.me) { ui.flash(); shake = Math.max(shake, 0.3 + b.charge * 0.3); audio.sfx('ow'); pop('OOF!', b.p.x, b.p.y + 1, b.p.z, '#9fe8ff'); player.vel.y = 4; player.onGround = false; }
      else { target.vy = 4 + b.charge * 2; target.kb = tmp2.set(b.v.x, 0, b.v.z).normalize().multiplyScalar(6 + b.charge * 6).clone(); }
      if (o.me) { R.hits++; hitstop = 0.06 + b.charge * 0.04; shake = Math.max(shake, 0.18 + b.charge * 0.25); pop(b.charge > 0.95 ? 'MEGA BONK!' : POPS[(Math.random() * POPS.length) | 0], b.p.x, b.p.y + 1, b.p.z, b.charge > 0.95 ? '#ff7a8a' : '#fff36b', 1 + b.charge * 0.4); }
      if (target.hp <= 0) knockDown(target, o);
    }
    function knockDown(e, by) {
      e.down = C.RESPAWN; e.hp = 0; by.tags++; R.tags[by.team]++;
      burst(e.pos.x, e.pos.y + 1, e.pos.z, 34, '#ffffff', 7, 10, 1);
      ui.feed(`${tagOf(by)} ☃ ${tagOf(e)}`);
      if (by.me) { R.myTags++; ui.banner('☃ SNOWED IN!', `${e.name} is a snowman for a sec`, 1000); pop('TAG!', e.pos.x, 2.8, e.pos.z, '#ff8ac0', 1.6); }
      if (e.me) { R.downs++; player.enabled = false; charging = false; charge = 0; audio._chargeStop(); }
      else { e.mesh.userData.body.visible = false; e.snowman = e.snowman || makeSnowman(); e.snowman.position.copy(e.pos); e.snowman.visible = true; }
      if (e.me && by.bot && Math.random() < 0.5) emote(by, 0);
    }
    const snowmanGeo = [new THREE.SphereGeometry(0.75, 12, 10), new THREE.SphereGeometry(0.5, 12, 10)], snowMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.9 });
    function makeSnowman() { const g = new THREE.Group(); const a = new THREE.Mesh(snowmanGeo[0], snowMat); a.position.y = 0.7; const b = new THREE.Mesh(snowmanGeo[1], snowMat); b.position.y = 1.7; g.add(a, b); scene.add(g); return g; }
    function respawn(e) {
      const f = ownFort(e); e.hp = C.HP; e.ammo = C.AMMO; e.reload = 0; e.down = 0; e.shield = C.SPAWN_SHIELD;
      const sx = f.spawn.x + (Math.random() < 0.5 ? -5 : 5) + rand(-1, 1), sz = f.spawn.z + rand(-0.6, 0.6);
      if (e.me) { player.enabled = true; player.teleport(new THREE.Vector3(sx, 0, sz), f.s > 0 ? Math.PI : 0); audio.sfx('sfx_respawn'); burst(sx, 1, sz, 24, C.TEAMS[0].color, 5, 4, 0.8); }
      else { e.pos.set(sx, 0, sz); e.vel.set(0, 0, 0); e.vy = 0; e.mesh.userData.body.visible = true; if (e.snowman) e.snowman.visible = false; }
    }
    function hitFort(f, b) {
      b.alive = false; b.mesh.visible = false;
      const dmg = b.charge > 0.95 ? C.CORE_DMG_CHARGED : C.CORE_DMG * (1 + b.charge * 0.5);
      f.hp = Math.max(0, f.hp - dmg); f.wob = 0.35;
      burst(b.p.x, b.p.y, b.p.z, 22, '#dff3ff', 6, 9, 0.7); burst(b.p.x, b.p.y, b.p.z, 6, C.TEAMS[f.team].color, 4, 8, 0.6);
      if (b.owner.me) { R.bonks++; pop(b.charge > 0.95 ? 'FORT SMASH!' : 'FORT BONK!', b.p.x, b.p.y + 1, b.p.z, '#7fe0ff', 1.1); shake = Math.max(shake, 0.2); }
      if (b.owner.me || Math.hypot(f.x - player.pos.x, f.z - player.pos.z) < 22) audio.sfx('sfx_fort_hit');
      if (f.team === 0 && f.hp > 0 && !R.warned && f.hp < 35) { R.warned = true; ui.banner('⚠ OUR FORT!', 'defend the core', 1300); }
      if (f.hp <= 0 && !f.broken) {
        f.broken = true; audio.sfx('sfx_fort_break'); shake = 0.8;
        burst(f.x, 3, f.z, 90, '#ffffff', 11, 9, 1.5); burst(f.x, 3, f.z, 40, C.TEAMS[f.team].color, 8, 8, 1.2);
        f.core.scale.set(1, 0.35, 1);
        if (b.owner.team === 0) save.fortsBroken = (save.fortsBroken || 0) + (b.owner.me ? 1 : 0);
        finish(1 - f.team, `${C.TEAMS[f.team].name} fort crumbled!`);
      }
    }

    // ---------- round ----------
    let R = null, phase = 'count', countT = 0, lastTick = -1, endT = 0;
    let shake = 0, hitstop = 0, charge = 0, charging = false, capTickT = 0;
    const playerVel = new THREE.Vector3(), prevPos = new THREE.Vector3();
    const camDist0 = player.camDist, baseSpeed = player.mods.speed;
    player.mods.speed = baseSpeed * 1.1;
    const ui = new SiegeUI(mobile, {
      onEmote: (i) => { if (meEnt.down <= 0) emote(meEnt, i); },
      onThrowDown: () => startCharge(), onThrowUp: () => releaseThrow(), onReload: () => startReload(meEnt),
    });
    function startCharge() { if (phase === 'play' && meEnt.down <= 0 && meEnt.ammo > 0 && !(meEnt.reload > 0)) { charging = true; charge = 0; audio.chargeStart(); } else if (phase === 'play' && meEnt.ammo <= 0) startReload(meEnt); }
    function releaseThrow() {
      if (!charging) return; charging = false;
      if (phase !== 'play' || meEnt.down > 0 || R.throwCd > 0 || meEnt.ammo <= 0) { charge = 0; audio._chargeStop(); return; }
      const fwd = myForward(new THREE.Vector3());
      const t = aimAssist(meEnt, fwd, mobile ? 0.7 : 0.4);
      const dir = t ? aimAt(meEnt, t, new THREE.Vector3()) : fwd.setY(mobile ? 0.05 : Math.max(-0.1, Math.min(0.5, (0.45 - player.camPitch) * 0.6)));
      throwBall(meEnt, dir, Math.min(1, charge));
      player.facing = Math.atan2(dir.x, dir.z);
      R.throwCd = C.THROW_CD; charge = 0;
    }
    function myForward(v) {
      if (mobile) return v.set(Math.sin(player.facing), 0, Math.cos(player.facing));
      return v.set(-Math.sin(player.camYaw), 0, -Math.cos(player.camYaw));
    }
    const dom = engine.renderer.domElement; let down = null;
    const onDown = (e) => { if (e.button !== 0 || mobile) return; down = { x: e.clientX, y: e.clientY }; startCharge(); };
    const onMove = (e) => { if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 14) { charging = false; charge = 0; audio._chargeStop(); down = null; } };
    const onUp = () => { if (!down) return; down = null; releaseThrow(); };
    dom.addEventListener('pointerdown', onDown); addEventListener('pointermove', onMove); addEventListener('pointerup', onUp);

    function newRound() {
      R = { time: C.ROUND_SECS, elapsed: 0, tags: [0, 0], cap: [0, 0], myTags: 0, hits: 0, bonks: 0, downs: 0, throwCd: 0, over: false, warned: false };
      for (const f of forts) { f.hp = C.FORT_HP; f.broken = false; f.core.scale.set(1, 1, 1); f.wob = 0; }
      for (const b of balls) { b.alive = false; b.mesh.visible = false; }
      for (const e of ents) { e.tags = 0; respawn(e); e.shield = 0; e.ai = { cd: rand(1, 2.5), retarget: 0 }; }
      player.camDist = 14; player.camPitch = 0.45;
      phase = 'count'; countT = 3; lastTick = -1; charging = false; charge = 0;
      audio.music_('bgm_siege-lobby'); ui.hideEnd(); prevPos.copy(player.pos);
    }
    function finish(winner, how) {
      if (R.over) return; R.over = true; R.winner = winner; R.how = how; phase = 'end'; endT = 10;
      charging = false; audio._chargeStop(); audio.music_('bgm_siege-lobby');
      const won = winner === 0, draw = winner < 0;
      audio.sfx(won ? 'sfx_cheer' : 'sfx_defeat');
      ui.banner(won ? '🏆 VICTORY!' : draw ? '🤝 DRAW!' : '☃ DEFEAT', how, 2200);
      if (won) for (let i = 0; i < 5; i++) setTimeout(() => alive && burst(player.pos.x + rand(-3, 3), 3 + rand(0, 2), player.pos.z + rand(-3, 3), 30, ['#ffd24a', '#5be37d', '#ff7ad9', '#3fd0ff', '#ffffff'][i], 8, 6, 1.3), i * 200);
      ents.filter(e => e.bot && e.down <= 0 && Math.random() < 0.6).forEach(e => emote(e, e.team === winner ? 0 : 3));
      const prevBest = save.bestStreak || 0, streak = won ? (save.streak || 0) + 1 : 0;
      save = { ...save, rounds: (save.rounds || 0) + 1, wins: (save.wins || 0) + (won ? 1 : 0), streak, bestStreak: Math.max(prevBest, streak), tags: (save.tags || 0) + R.myTags, caps: (save.caps || 0) + (won && R.capWin ? 1 : 0) };
      const rewards = [];
      for (const m of C.MILESTONES) {
        if (save.milestones.includes(m.id) || !m.test(R, save)) continue;
        save = { ...save, milestones: [...save.milestones, m.id] };
        try { economy.earn(m.bb, `Snowball Siege: ${m.label}`, { source: 'Snowball Siege' }); } catch {}
        rewards.push(m);
      }
      persist(economy, save);
      setTimeout(() => alive && phase === 'end' && ui.showEnd({ ...R, won, draw, streak, bestStreak: save.bestStreak, rewards }, () => newRound()), 1600);
    }

    // ---------- movement helpers for bots ----------
    function pushOut(p, r = 0.5) {
      for (const b of covers) {
        if (p.y > b.maxY - 0.05) continue;
        const cx = Math.max(b.minX, Math.min(p.x, b.maxX)), cz = Math.max(b.minZ, Math.min(p.z, b.maxZ));
        const dx = p.x - cx, dz = p.z - cz, d = Math.hypot(dx, dz);
        if (d < r) { if (d > 1e-4) { p.x = cx + dx / d * r; p.z = cz + dz / d * r; } else p.x += r; }
      }
      for (const f of forts) { const dx = p.x - f.x, dz = p.z - f.z, d = Math.hypot(dx, dz); if (d < 2.5 + r && d > 1e-4) { p.x = f.x + dx / d * (2.5 + r); p.z = f.z + dz / d * (2.5 + r); } }
      p.x = Math.max(-C.HALF_X + 0.8, Math.min(C.HALF_X - 0.8, p.x)); p.z = Math.max(-C.HALF_Z + 0.8, Math.min(C.HALF_Z - 0.8, p.z));
    }
    function blocked(a, bx, bz) {   // line of sight through cover (2D, at chest height)
      for (const c of covers) {
        if (c.maxY < 1.2) continue;
        for (let k = 0.15; k < 1; k += 0.15) { const x = a.x + (bx - a.x) * k, z = a.z + (bz - a.z) * k; if (x > c.minX && x < c.maxX && z > c.minZ && z < c.maxZ) return true; }
      }
      return false;
    }
    const v = new THREE.Vector3();
    function botThink(e, dt, want) {
      const ai = e.ai, SPEED = 6.2, ef = enemyFort(e), of = ownFort(e);
      ai.retarget -= dt; ai.cd -= dt; ai.strafeT = (ai.strafeT || 0) - dt;
      if (ai.strafeT <= 0) { ai.strafe = Math.random() < 0.5 ? -1 : 1; ai.strafeT = rand(0.8, 2); }
      if (ai.retarget <= 0 || !ai.target || ai.target.down > 0) {
        let best = null, bd = 22;
        for (const o of ents) { if (o.team === e.team || o.down > 0) continue; const d = Math.hypot(o.pos.x - e.pos.x, o.pos.z - e.pos.z) * rand(0.85, 1.15); if (d < bd) { bd = d; best = o; } }
        ai.target = best; ai.retarget = rand(1.2, 2.6);
      }
      // goal by role (defenders rush home if the core is under attack)
      let gx, gz;
      const threat = ents.some(o => o.team !== e.team && o.down <= 0 && Math.hypot(o.pos.x - of.x, o.pos.z - of.z) < 14);
      if (e.ammo <= 1 && !(e.reload > 0)) { gx = of.piles[0].x; gz = of.piles[0].z; }
      else if (e.role === 'defend' || (threat && e.role !== 'attack')) { gx = of.x + rand(-1, 1); gz = of.z - of.s * 9; }
      else if (e.role === 'mid') { gx = (ai.mx ??= rand(-3, 3)); gz = (ai.mz ??= rand(-3, 3)); }
      else { gx = ef.x + (ai.ax ??= rand(-6, 6)); gz = ef.z - ef.s * 12; }
      v.set(gx - e.pos.x, 0, gz - e.pos.z); const gd = v.length();
      if (gd > 1.2) want.copy(v).normalize().multiplyScalar(SPEED); else want.set(0, 0, 0);
      const tgt = ai.target;
      if (tgt) { // strafe while fighting
        v.set(tgt.pos.x - e.pos.x, 0, tgt.pos.z - e.pos.z).normalize();
        want.addScaledVector(tmp.set(-v.z, 0, v.x), ai.strafe * SPEED * 0.55);
        if (want.length() > SPEED) want.setLength(SPEED);
      }
      // dodge incoming
      for (const b of balls) {
        if (!b.alive || b.owner.team === e.team || b.dodged.has(e)) continue;
        v.set(e.pos.x - b.p.x, 0, e.pos.z - b.p.z);
        if (v.length() < 7 && v.dot(tmp.set(b.v.x, 0, b.v.z)) > 0) { b.dodged.add(e); if (Math.random() < 0.3) { tmp.normalize(); e.vel.set(-tmp.z, 0, tmp.x).multiplyScalar(SPEED * (Math.random() < 0.5 ? -1 : 1)); if (e.ground && Math.random() < 0.4) e.vy = C.JUMP_V * 0.8; } }
      }
      // throw: at players in LOS, else at the enemy fort when in range
      if (ai.cd <= 0 && e.ammo > 0 && !(e.reload > 0) && phase === 'play') {
        let aim = null;
        if (tgt && Math.hypot(tgt.pos.x - e.pos.x, tgt.pos.z - e.pos.z) < 20 && !blocked(e.pos, tgt.pos.x, tgt.pos.z)) aim = tgt;
        else if (!ef.broken && Math.hypot(ef.x - e.pos.x, ef.z - e.pos.z) < 22) aim = { fort: ef, pos: { x: ef.x, y: 0, z: ef.z } };
        if (aim) {
          aimAt(e, aim, v); const err = rand(-0.12, 0.12), c = Math.cos(err), s = Math.sin(err); const y = v.y;
          v.set(v.x * c - v.z * s, y, v.x * s + v.z * c);
          throwBall(e, v, aim.fort ? (Math.random() < 0.4 ? 1 : rand(0.3, 0.8)) : Math.random() < 0.2 ? 1 : rand(0, 0.4));
          e.mesh.rotation.y = Math.atan2(v.x, v.z); ai.cd = rand(1.0, 2.2);
        }
      }
      return want;
    }

    newRound();
    const keyPrev = {};
    const edge = (code) => { const d = engine.input.down(code), p = keyPrev[code]; keyPrev[code] = d; return d && !p; };
    const game = {
      scene, collision, spawn: forts[0].spawn.clone().setX(5), spawnFacing: Math.PI, music: 'none', maxCamDist: 22,
      siege: { get state() { return { phase, ...(R || {}), fort: forts.map(f => f.hp) }; }, restart: () => newRound(), skipCountdown: () => { countT = 0; },   // test hooks
        setTime: (t) => { if (R) R.time = t; }, bonkFort: (team, n = 1) => { for (let i = 0; i < n; i++) { const b = balls.find(b => !b.alive); b.alive = true; b.owner = meEnt; b.charge = 1; b.p.set(forts[team].x, 3, forts[team].z); hitFort(forts[team], b); } } },
      update(dt0, t, pl) {
        arena.update(dt0, t);
        if (!audio.bgm) audio.music_(phase === 'play' ? 'bgm_snowball-siege' : 'bgm_siege-lobby');
        if (hitstop > 0) hitstop -= dt0;
        const dt = hitstop > 0 ? dt0 * 0.2 : dt0;
        // keys
        if (phase === 'end' && edge('Space') && endT < 8.5) newRound();
        ['Digit1', 'Digit2', 'Digit3', 'Digit4'].forEach((k, i) => { if (edge(k) && meEnt.down <= 0) emote(meEnt, i); });
        if (edge('KeyQ')) startReload(meEnt);
        const eDown = engine.input.down('KeyE');
        if (eDown && !keyPrev.KeyE) startCharge(); if (!eDown && keyPrev.KeyE) releaseThrow(); keyPrev.KeyE = eDown;
        if (charging) charge = Math.min(1, charge + dt0 / C.CHARGE_SECS);

        // phase
        if (phase === 'count') {
          countT -= dt0; const n = Math.ceil(countT);
          if (n !== lastTick && n > 0) { lastTick = n; ui.banner(String(n), 'pack your snowballs…', 700); audio.sfx('tick', 0); }
          if (countT <= 0) { phase = 'play'; ui.banner('SIEGE!', 'bonk their fort · hold the middle', 1200); audio.sfx('tick', 1); audio.music_('bgm_snowball-siege'); }
        } else if (phase === 'play') {
          R.time -= dt; R.elapsed += dt; R.throwCd -= dt;
          if (R.time <= 10 && Math.ceil(R.time) !== lastTick) { lastTick = Math.ceil(R.time); if (lastTick > 0) audio.sfx('tick', 0); }
          // mid capture: tug of war
          const inRing = [0, 0];
          for (const e of ents) if (e.down <= 0 && Math.hypot(e.pos.x, e.pos.z) < C.CAP_R) inRing[e.team]++;
          const solo = inRing[0] > 0 && inRing[1] === 0 ? 0 : inRing[1] > 0 && inRing[0] === 0 ? 1 : -1;
          if (solo >= 0) {
            const o = 1 - solo, rate = dt / C.CAP_SECS * (1 + Math.min(2, inRing[solo] - 1) * 0.35);
            if (R.cap[o] > 0) R.cap[o] = Math.max(0, R.cap[o] - rate * 1.5); else R.cap[solo] = Math.min(1, R.cap[solo] + rate);
            capTickT -= dt; if (capTickT <= 0 && Math.hypot(pl.pos.x, pl.pos.z) < C.CAP_R + 6) { capTickT = 0.5; audio.sfx('sfx_capture_tick', R.cap[solo]); }
            if (R.cap[solo] >= 1) { R.capWin = true; audio.sfx('sfx_capture_win'); burst(0, 5, 0, 80, C.TEAMS[solo].color, 10, 6, 1.4); finish(solo, `${C.TEAMS[solo].name} held the middle!`); }
          }
          const lead = R.cap[0] > R.cap[1] ? 0 : R.cap[1] > R.cap[0] ? 1 : -1, col = lead < 0 ? '#ffffff' : C.TEAMS[lead].color;
          mid.fillMat.color.set(col); mid.ringMat.color.set(solo < 0 && inRing[0] ? '#ffd24a' : col); mid.beacon.material.color.set(col); mid.flag.material.color.set(col);
          mid.fillMat.opacity = 0.15 + Math.max(R.cap[0], R.cap[1]) * 0.45; mid.beacon.scale.y = 0.3 + Math.max(R.cap[0], R.cap[1]) * 0.7; mid.beacon.position.y = 3 * mid.beacon.scale.y;
          if (R.time <= 0 && !R.over) {
            const d = forts[0].hp - forts[1].hp, c = R.cap[0] - R.cap[1];
            if (Math.abs(d) > 0.5) finish(d > 0 ? 0 : 1, `time! ${d > 0 ? 'Frost' : 'Berry'} fort stood stronger`);
            else if (Math.abs(c) > 0.01) finish(c > 0 ? 0 : 1, `time! ${c > 0 ? 'Frost' : 'Berry'} led the middle`);
            else finish(-1, 'time! perfectly even');
          }
        } else if (phase === 'end') { const before = Math.ceil(endT); endT -= dt0; if (Math.ceil(endT) !== before) ui.endCountdown(Math.max(0, Math.ceil(endT))); if (endT <= 0) newRound(); }
        const sim = phase === 'play';

        // ---- per-entity timers ----
        for (const e of ents) {
          e.shield = Math.max(0, e.shield - dt);
          if (e.reload > 0) { e.reload -= dt; if (e.reload <= 0) { e.ammo = C.AMMO; if (e.me) { audio.sfx('sfx_reload'); pop('RELOADED', pl.pos.x, 2.8, pl.pos.z, '#9fe8ff', 0.7); } } }
          if (e.down > 0) { e.down -= dt; if (e.down <= 0 && phase !== 'end') respawn(e); else if (e.down <= 0) e.down = 0.01; }
          // snow piles in own fort = instant refill
          if (e.down <= 0 && e.ammo < C.AMMO && ownFort(e).piles.some(p => Math.hypot(p.x - e.pos.x, p.z - e.pos.z) < 2.6)) { e.ammo = C.AMMO; e.reload = 0; if (e.me) { audio.sfx('sfx_reload'); pop('REFILL!', pl.pos.x, 2.8, pl.pos.z, '#9fe8ff', 0.8); } }
        }
        if (dt0 > 0) { playerVel.subVectors(pl.pos, prevPos).divideScalar(dt0); playerVel.y = 0; } prevPos.copy(pl.pos);
        if (meEnt.shield > 0) burst(pl.pos.x, pl.pos.y + 1, pl.pos.z, 1, C.TEAMS[0].flag, 1.5, 0, 0.4);

        // ---- bots ----
        for (const e of ents) {
          if (!e.bot) continue;
          if (e.down > 0) { if (e.snowman) e.snowman.rotation.y += dt; continue; }
          const want = sim ? botThink(e, dt, tmp2.set(0, 0, 0)) : tmp2.set(0, 0, 0);
          e.vel.lerp(want, 1 - Math.exp(-4 * dt));
          e.pos.addScaledVector(e.vel, dt);
          if (e.kb) { e.pos.addScaledVector(e.kb, dt); e.kb.multiplyScalar(Math.exp(-4 * dt)); if (e.kb.lengthSq() < 0.01) e.kb = null; }
          e.vy -= C.GRAV * dt; e.pos.y += e.vy * dt; if (e.pos.y <= 0) { e.pos.y = 0; e.vy = 0; e.ground = true; } else e.ground = false;
          pushOut(e.pos);
          const sp = e.vel.length();
          if (sp > 0.5 && !(e.ai.throwAnim > 0)) e.mesh.rotation.y = Math.atan2(e.vel.x, e.vel.z);
          const ud = e.mesh.userData, run = Math.sin(t * 14) * Math.min(1, sp / 5) * 0.7;
          ud.legs[0].rotation.x = run; ud.legs[1].rotation.x = -run;
          e.ai.throwAnim = Math.max(0, (e.ai.throwAnim || 0) - dt); ud.arm.rotation.x = e.ai.throwAnim > 0 ? -2.6 * (e.ai.throwAnim / 0.25) : run * 0.6;
          ud.body.scale.y = 1 - Math.min(0.15, Math.abs(e.vy) * 0.01);
          if (e.shield > 0 && Math.random() < 0.4) burst(e.pos.x, 1, e.pos.z, 1, C.TEAMS[e.team].flag, 1.5, 0, 0.4);
        }
        for (let i = 0; i < ents.length; i++) for (let j = i + 1; j < ents.length; j++) {
          const a = ents[i], b = ents[j]; if (a.down > 0 || b.down > 0) continue;
          const dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z, d = Math.hypot(dx, dz);
          if (d < 1.1 && d > 0.001) { const k = (1.1 - d) / 2 / d; if (!a.me) { a.pos.x -= dx * k; a.pos.z -= dz * k; } if (!b.me) { b.pos.x += dx * k; b.pos.z += dz * k; } }
        }

        // ---- snowballs ----
        for (const b of balls) {
          if (!b.alive) continue;
          b.v.y -= C.BALL_GRAV * dt; b.p.addScaledVector(b.v, dt);
          if (Math.random() < 0.5) burst(b.p.x, b.p.y, b.p.z, 1, b.charge > 0.95 ? '#ffd24a' : '#cfefff', 0.3, 0, 0.25);
          let done = false;
          for (const e of ents) {
            if (e.team === b.owner.team || e.down > 0) continue;
            if ((e.pos.x - b.p.x) ** 2 + (e.pos.y + 1.1 - b.p.y) ** 2 + (e.pos.z - b.p.z) ** 2 < C.BALL_R ** 2) { hitEnt(e, b); done = true; break; }
          }
          if (done) continue;
          for (const f of forts) {
            if ((f.x - b.p.x) ** 2 + (f.z - b.p.z) ** 2 < 2.7 ** 2 && b.p.y < 6) {
              if (f.team !== b.owner.team && !f.broken && sim) hitFort(f, b);
              else { b.alive = false; b.mesh.visible = false; burst(b.p.x, b.p.y, b.p.z, 8, '#ffffff', 3, 9, 0.5); }
              done = true; break;
            }
          }
          if (done) continue;
          for (const c of covers) {
            if (b.p.x > c.minX && b.p.x < c.maxX && b.p.z > c.minZ && b.p.z < c.maxZ && b.p.y < c.maxY + 0.15) {
              burst(b.p.x, b.p.y, b.p.z, 10, '#ffffff', 3, 9, 0.5); b.alive = false; b.mesh.visible = false;
              if (Math.hypot(b.p.x - pl.pos.x, b.p.z - pl.pos.z) < 14) audio.sfx('sfx_snowball_whiff'); done = true; break;
            }
          }
          if (done) continue;
          if (b.p.y < 0.15) { burst(b.p.x, 0.15, b.p.z, 8, '#ffffff', 3, 9, 0.5); if (b.owner.me || Math.hypot(b.p.x - pl.pos.x, b.p.z - pl.pos.z) < 10) audio.sfx('sfx_snowball_whiff'); b.alive = false; b.mesh.visible = false; }
        }

        // ---- fort wobble + particles + pops ----
        for (const f of forts) if (f.wob > 0) { f.wob -= dt0; const k = Math.max(0, f.wob) * 0.25; f.core.scale.x = f.core.scale.z = 1 + Math.sin(t * 60) * k; if (f.wob <= 0) f.core.scale.x = f.core.scale.z = 1; f.ball.material?.emissive?.set?.('#000'); }
        for (let i = 0; i < NP; i++) {
          const q = parts[i];
          if (q.life > 0) { q.life -= dt0; q.v.y -= q.g * dt0; q.v.multiplyScalar(Math.exp(-1.6 * dt0)); q.p.addScaledVector(q.v, dt0); if (q.p.y < 0.05) { q.p.y = 0.05; q.v.y *= -0.2; } }
          const k = Math.max(0, q.life / q.max);
          pPos[i * 3] = q.p.x; pPos[i * 3 + 1] = q.life > 0 ? q.p.y : -99; pPos[i * 3 + 2] = q.p.z;
          pCol[i * 3] = q.c.r * k; pCol[i * 3 + 1] = q.c.g * k; pCol[i * 3 + 2] = q.c.b * k;
        }
        pGeo.attributes.position.needsUpdate = true; pGeo.attributes.color.needsUpdate = true;
        for (const s of popPool) { if (s.t <= 0) continue; s.t -= dt0; s.spr.position.y += s.vy * dt0; s.vy *= Math.exp(-3 * dt0); const k = s.t > 0.75 ? 1 + (s.t - 0.75) * 4 : 1; s.spr.scale.copy(s.base).multiplyScalar(k); s.spr.material.opacity = Math.min(1, s.t * 3); s.spr.visible = s.t > 0; }
        for (const e of ents) {
          if (!e.emote) continue; e.emote.t -= dt0;
          e.emote.spr.position.set(e.pos.x, e.pos.y + 3.4 + Math.sin(t * 5) * 0.1, e.pos.z);
          e.emote.spr.material.opacity = Math.min(1, e.emote.t * 2); if (e.emote.t <= 0) { scene.remove(e.emote.spr); e.emote.spr.material.map.dispose(); e.emote.spr.material.dispose(); e.emote = null; }
        }
        shake = Math.max(0, shake - dt0 * 1.8);
        if (shake > 0) cam.position.add(tmp.set(rand(-1, 1), rand(-1, 1), rand(-1, 1)).multiplyScalar(shake * 0.35));

        const lock = phase === 'play' && meEnt.down <= 0 ? aimAssist(meEnt, myForward(new THREE.Vector3()), mobile ? 0.7 : 0.4) : null;
        ui.hud({ time: phase === 'count' ? C.ROUND_SECS : R.time, fort: forts.map(f => f.hp / C.FORT_HP * 100), cap: R.cap, tags: R.tags, myTags: R.myTags,
          hp: meEnt.down > 0 ? 0 : meEnt.hp, ammo: Math.max(0, meEnt.ammo), reloading: meEnt.reload > 0, charge: charging ? charge : 0, lock, down: meEnt.down > 0 && phase !== 'end' ? meEnt.down : 0 });
      },
      dispose() {
        alive = false; audio.stop(); ui.dispose();
        dom.removeEventListener('pointerdown', onDown); removeEventListener('pointermove', onMove); removeEventListener('pointerup', onUp);
        player.enabled = true; player.mods.speed = baseSpeed; player.camDist = camDist0;
        persist(economy, save);
        scene.traverse(o => { o.geometry?.dispose?.(); const m = o.material; (Array.isArray(m) ? m : m ? [m] : []).forEach(x => { x.map?.dispose?.(); x.dispose(); }); });
      },
    };
    return game;
  },
};
