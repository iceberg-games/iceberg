// Game: Pengu Plaza — cozy social hangout (QoL update, no event). Waddle around a snowy blue-hour plaza,
// sit on benches, emote (wave/dance/cheer/honk), glide on the ice rink, sip hot cocoa, ring the bell,
// snap the 5 landmark photo spots, and hang with ambient penguin NPCs who react to your emotes.
// No fail states. One-time +15 BB "postcard" for snapping all 5 spots.
// Module map: config.js (tuning/save), plaza.js (procedural set + penguin builder), audio.js
// (Sound Designer pack ./sfx + procedural fallback), ui.js (mobile-safe HUD), thumb.js.
import * as THREE from 'three';
import { Collision } from '../../engine/collision.js';
import { getDeviceMode } from '../../core/device.js';
import { GAME_ID, REWARD_SOURCE, PLAZA_R, RINK, COCOA, BELL, SPAWN, PHOTO_SPOTS, EMOTES, NPC_COUNT, NPC_POINTS, POSTCARD_BB, PHYS, normalizeSave } from './config.js';
import { buildPlaza, buildPenguin } from './plaza.js';
import { PlazaAudio } from './audio.js';
import { PlazaUI } from './ui.js';
import drawThumb from './thumb.js';
import CREDITS from './CREDITS.md?raw';

const LS = 'iceberg:v1:pengu-plaza';
function loadSave(economy) { let s = null; try { s = economy.cachedGameData?.(GAME_ID) || economy.profile?.gameData?.[GAME_ID] || null; } catch {} if (!s) try { s = JSON.parse(localStorage.getItem(LS) || 'null'); } catch {} return normalizeSave(s); }
function persist(economy, save) { try { localStorage.setItem(LS, JSON.stringify(save)); } catch {} try { economy.saveGameData?.(GAME_ID, save); } catch {} }
const inRink = (x, z) => ((x - RINK.x) / RINK.rx) ** 2 + ((z - RINK.z) / RINK.rz) ** 2 < 1;

class Puffs { // pooled soft particles: snow kicks, hearts/sparkles, steam, confetti
  constructor(scene, n = 700) {
    this.n = n; this.i = 0; this.p = new Float32Array(n * 3); this.v = new Float32Array(n * 3); this.life = new Float32Array(n); this.c = new Float32Array(n * 3); this.grav = new Float32Array(n);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(this.p, 3)); g.setAttribute('color', new THREE.BufferAttribute(this.c, 3));
    const cv = document.createElement('canvas'); cv.width = cv.height = 32; const x = cv.getContext('2d'), r = x.createRadialGradient(16, 16, 0, 16, 16, 16); r.addColorStop(0, '#fff'); r.addColorStop(0.45, 'rgba(255,255,255,.6)'); r.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = r; x.fillRect(0, 0, 32, 32);
    this.mat = new THREE.PointsMaterial({ size: 0.32, vertexColors: true, transparent: true, depthWrite: false, map: new THREE.CanvasTexture(cv) });
    this.pts = new THREE.Points(g, this.mat); this.pts.frustumCulled = false; scene.add(this.pts); this.g = g; this.p.fill(-9999);
  }
  emit(x, y, z, vx, vy, vz, spread, col, life = 0.8, grav = 6) {
    const k = this.i = (this.i + 1) % this.n; this.p.set([x, y, z], k * 3);
    this.v.set([vx + (Math.random() - 0.5) * spread, vy + Math.random() * spread * 0.6, vz + (Math.random() - 0.5) * spread], k * 3);
    this.c.set([col.r, col.g, col.b], k * 3); this.life[k] = life * (0.6 + Math.random() * 0.6); this.grav[k] = grav;
  }
  burst(pos, n, col, { up = 4, spread = 5, life = 1, grav = 6, y = 1.2 } = {}) { const cs = [].concat(col); for (let i = 0; i < n; i++) this.emit(pos.x, pos.y + y, pos.z, 0, up, 0, spread, cs[i % cs.length], life, grav); }
  update(dt) {
    const { p, v, life } = this;
    for (let k = 0; k < this.n; k++) { if (life[k] <= 0) continue; life[k] -= dt; const j = k * 3; v[j + 1] -= this.grav[k] * dt; v[j] *= 0.97; v[j + 2] *= 0.97; p[j] += v[j] * dt; p[j + 1] += v[j + 1] * dt; p[j + 2] += v[j + 2] * dt; if (life[k] <= 0) p[j + 1] = -9999; }
    this.g.attributes.position.needsUpdate = true; this.g.attributes.color.needsUpdate = true;
  }
  dispose() { this.g.dispose(); this.mat.map.dispose(); this.mat.dispose(); }
}
const C = { snow: new THREE.Color('#eaf4ff'), ice: new THREE.Color('#9fe6ff'), gold: new THREE.Color('#ffd76a'), pink: new THREE.Color('#ff7fb0'), mint: new THREE.Color('#7fffc8'), cocoa: new THREE.Color('#f5e6d6'), lilac: new THREE.Color('#c79bff') };

let _thumb = null;
export default {
  id: GAME_ID,
  name: 'Pengu Plaza',
  tagline: 'Cozy penguin hangout — cocoa, skating & selfies',
  description: 'A snowy blue-hour plaza to just chill. Waddle around, sit on benches, wave and dance with the locals, glide on the ice rink, sip hot cocoa, ring the plaza bell and snap all five landmark photo spots for a postcard. No timers, no losing.',
  get thumbnail() { if (!_thumb) { try { _thumb = drawThumb(); } catch { _thumb = 'frost'; } } return _thumb; },
  music: 'none',
  credits: CREDITS,
  features: { build: false },
  mobile: true,

  async create(ctx) {
    const { engine, economy, music, avatar } = ctx;
    const player = engine.player, cam = engine.camera;
    const mobile = getDeviceMode() === 'mobile';
    const set = buildPlaza({ mobile }), scene = set.scene;
    const collision = new Collision({ floorY: 0, bounds: { type: 'circle', r: PLAZA_R } });
    for (const c of set.colliders) { if (c[0] === 'circle') collision.addCircle(c[1], c[2], c[3], c[4]); else collision.addBox(...c.slice(1)); }
    const fx = new Puffs(scene), audio = new PlazaAudio(music);
    const save = loadSave(economy); save.visits++; persist(economy, save);
    let live = true;

    // ---- ambient NPC penguins ----
    const scarves = ['#ff5f7e', '#5fd0ff', '#ffd36b', '#7fffc8', '#c79bff', '#ff9a3c', '#ffffff', '#6fa8ff', '#ff7fb0'];
    const npcs = [];
    for (let i = 0; i < NPC_COUNT; i++) {
      const m = buildPenguin({ scarf: scarves[i % scarves.length], hat: i % 3 === 0 ? scarves[(i + 4) % 9] : null }); const s = 0.8 + (i % 4) * 0.08; m.scale.setScalar(s); scene.add(m);
      const pt = NPC_POINTS[i], skater = pt.pose === 'skate';   // Set Builder stand points + poses
      const n = { m, skater, pose: pt.pose, x: pt.x, z: pt.z, tx: pt.x, tz: pt.z, wait: 2 + Math.random() * 4, phase: Math.random() * 6, react: 0, kind: null, honkT: 4 + Math.random() * 10 };
      m.rotation.y = pt.facing; m.position.set(pt.x, 0, pt.z);
      if (pt.pose === 'cocoa' || pt.pose === 'sit') n.wait = 8 + Math.random() * 6;   // linger at the stand / bench before wandering
      if (pt.pose === 'dance' || pt.pose === 'wave') { n.react = 3; n.kind = pt.pose; n.face = pt.facing; }
      npcs.push(n);
    }
    function pickTarget(n) { for (let k = 0; k < 10; k++) { const a = Math.random() * 7, r = 4 + Math.random() * (PLAZA_R - 8), x = Math.cos(a) * r, z = Math.sin(a) * r; if (!inRink(x, z) && Math.hypot(x, z - 6) > 4.5 && Math.hypot(x - COCOA.x, z - COCOA.z) > 3) { n.tx = x; n.tz = z; return; } } }
    function npcReact(kind) { const p = player.pos; for (const n of npcs) if (Math.hypot(n.x - p.x, n.z - p.z) < 10) { n.react = 2.2; n.kind = kind; n.face = Math.atan2(p.x - n.x, p.z - n.z); } }

    // ---- interactions ----
    const P = new THREE.Vector3();
    const actions = [
      ...set.seats.map((s, i) => ({ type: 'sit', icon: '🪑', label: 'Sit', x: s.x, z: s.z, r: 1.8, seat: s, i })),
      { type: 'cocoa', icon: '☕', label: 'Hot cocoa', x: COCOA.x, z: COCOA.z + 1.6, r: 2.6 },
      { type: 'bell', icon: '🛎️', label: 'Ring bell', x: BELL.x, z: BELL.z, r: 2.2 },
      ...PHOTO_SPOTS.map(p => ({ type: 'photo', icon: '📷', label: 'Snap ' + p.name.split(' ').pop(), x: p.x, z: p.z, r: 2.4, spot: p })),
    ];
    // glowing photo-spot rings on the ground
    const ringMats = [];
    for (const p of PHOTO_SPOTS) { const mat = new THREE.MeshBasicMaterial({ color: '#ffe08a', transparent: true, opacity: 0.7, depthWrite: false }); ringMats.push(mat); const r = new THREE.Mesh(new THREE.RingGeometry(1.1, 1.4, 32), mat); r.rotation.x = -Math.PI / 2; r.position.set(p.x, 0.05, p.z); scene.add(r); p._mat = mat; }
    let near = null, sit = null, emote = null, cocoaT = 0, photoCam = null, bellT = 0;
    const mug = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.1, 0.24, 10), new THREE.MeshStandardMaterial({ color: '#ff8a8a' })); mug.visible = false; scene.add(mug);

    function doEmote(id) {
      if (!live) return; const e = EMOTES.find(x => x.id === id); if (!e) return;
      audio.play(e.sfx); emote = { id, t: 0, dur: e.dur }; save.emotes++; npcReact(id);
      const col = { wave: [C.gold, C.snow], dance: [C.pink, C.mint, C.lilac, C.gold], cheer: [C.gold, C.pink, C.mint], honk: [C.snow] }[id];
      fx.burst(player.pos, id === 'dance' ? 30 : 18, col, { y: 2.2, up: 3, spread: 4, grav: id === 'honk' ? 1 : 4 });
      ui.pop(e.icon, innerWidth / 2, innerHeight * 0.38);
    }
    function doAct() {
      if (!live) return;
      if (sit) return standUp();
      if (!near) { doEmote('honk'); return; }
      const a = near;
      if (a.type === 'sit') { sit = a; player.enabled = false; player.teleport(P.set(a.seat.x, 0, a.seat.z), a.seat.rot); audio.play('sfx_sit'); fx.burst(player.pos, 12, C.snow, { y: 0.4, up: 2, spread: 3 }); ui.say('Ahh, cozy', mobile ? 'Tap Stand to get up' : 'E / move to stand', 1300); }
      else if (a.type === 'cocoa') { audio.play('sfx_cocoa'); cocoaT = 3; save.cocoa++; mug.material.color.set(['#ff8a8a', '#8ad0ff', '#ffe08a', '#b28aff'][save.cocoa % 4]); ui.say('☕ Mmm, toasty!', `${save.cocoa} cup${save.cocoa > 1 ? 's' : ''} enjoyed`, 1500); fx.burst(player.pos, 20, [C.pink, C.gold], { y: 2.3, up: 2, spread: 2, grav: -1, life: 1.4 }); persist(economy, save); }
      else if (a.type === 'bell') { if (bellT > 0) return; bellT = 1.2; audio.play('sfx_bell_chime'); set.bell.userData.swing = 1; npcReact('cheer'); fx.burst(P.set(BELL.x, 2, BELL.z), 30, [C.gold, C.snow], { y: 1, up: 3, spread: 6, grav: 2 }); ui.say('🛎️ Ding-dong!', 'Everyone says hi', 1200); }
      else if (a.type === 'photo') snap(a.spot);
    }
    function standUp() { if (!sit) return; const s = sit.seat; sit = null; player.enabled = true; player.teleport(P.set(s.x + Math.sin(s.rot) * 1.3, 0, s.z + Math.cos(s.rot) * 1.3), s.rot); audio.play('sfx_foot_crunch'); }
    function snap(spot) {
      audio.play('sfx_camera_shutter'); ui.flash(0.95); photoCam = { t: 1.6, look: new THREE.Vector3(...spot.look) };
      for (const n of npcs) if (Math.hypot(n.x - spot.x, n.z - spot.z) < 12) { n.react = 1.6; n.kind = 'cheer'; n.face = Math.atan2(spot.x - n.x, spot.z - n.z); }
      if (!save.photos.includes(spot.id)) {
        save.photos.push(spot.id); spot._mat.color.set('#7fffc8');
        ui.say(`📸 ${spot.name}!`, `${save.photos.length}/${PHOTO_SPOTS.length} landmarks`, 1800);
        fx.burst(player.pos, 40, [C.gold, C.mint, C.pink], { y: 2, up: 6, spread: 7 });
        if (save.photos.length === PHOTO_SPOTS.length && !save.postcard) {
          save.postcard = true; economy.earn?.(POSTCARD_BB, 'Pengu Plaza: postcard complete', { source: REWARD_SOURCE });
          setTimeout(() => { if (!live) return; audio.play('sfx_bell_chime'); audio.play('sfx_emote_cheer'); ui.say('💌 Postcard complete!', `+${POSTCARD_BB} BB — thanks for visiting!`, 3000); fx.burst(player.pos, 120, [C.gold, C.pink, C.mint, C.lilac], { y: 3, up: 9, spread: 12, life: 2 }); }, 1700);
        }
      } else ui.say(`📸 ${spot.name}`, 'Lovely shot!', 1200);
      persist(economy, save);
    }
    const ui = new PlazaUI(mobile, { onEmote: doEmote, onAct: doAct });
    PHOTO_SPOTS.forEach(p => save.photos.includes(p.id) && p._mat.color.set('#7fffc8'));
    ui.setStats(save);
    const onKey = (e) => { if (!live || e.repeat) return; const em = EMOTES.find(x => x.key === e.code); if (em) doEmote(em.id); if (e.code === 'KeyE' || e.code === 'Enter') doAct(); };
    engine.input.onKey(onKey);

    // ---- skating + steps ----
    const glide = new THREE.Vector3(); let skating = false, stepT = 0, wasMoving = false, skateSpeed = 0;
    const prev = new THREE.Vector3().copy(player.pos);
    const started = { v: false };
    const start = () => { started.v = true; audio.ok(); audio.startMusic(); audio.play('sfx_bell_chime', 0.6); ui.say('Welcome to Pengu Plaza!', 'Say hi to the locals 👋', 2200); };
    ui.welcome(save, start);

    const game = {
      scene, collision, spawn: new THREE.Vector3(SPAWN.x, 0.1, SPAWN.z), spawnFacing: SPAWN.facing, music: 'none', maxCamDist: 18, occluders: [],
      onFall: () => player.teleport(new THREE.Vector3(SPAWN.x, 0.5, SPAWN.z), SPAWN.facing),
      get debug() { return { near: near?.type || null, sit: !!sit, skating, emote: emote?.id || null, save: { ...save }, sfxPlayed: audio.played, npcs: npcs.length }; },
      api: { emote: doEmote, act: doAct, teleport: (x, z) => player.teleport(new THREE.Vector3(x, 0, z), 0) },
      update(dt, t) {
        if (!live) return;
        set.update(dt, t); fx.update(dt); bellT = Math.max(0, bellT - dt);
        const p = player.pos, root = avatar?.root;
        if (sit && engine.input.analog && Math.hypot(engine.input.analog.x || 0, engine.input.analog.y || 0) > 0.5) standUp();
        if (sit && ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown'].some(k => engine.input.down(k))) standUp();

        // skating: faster + glide momentum on the rink
        const onIce = inRink(p.x, p.z) && !sit;
        const vx = (p.x - prev.x) / Math.max(dt, 1e-4), vz = (p.z - prev.z) / Math.max(dt, 1e-4);
        if (onIce) {
          player.mods.speed = PHYS.skateSpeed;
          glide.x += (vx - glide.x) * Math.min(1, dt * 1.6); glide.z += (vz - glide.z) * Math.min(1, dt * 1.6); glide.multiplyScalar(PHYS.skateGlide);
          const moving = Math.hypot(player.vel.x, player.vel.z) > 0.3;
          if (!moving) { p.x += glide.x * dt; p.z += glide.z * dt; collision.clampBounds?.(p); }
          skateSpeed = Math.hypot(moving ? vx : glide.x, moving ? vz : glide.z) / 10;
          if (!skating) { skating = true; ui.say('⛸ Skate!', 'Let go to glide', 1100); }
          if (skateSpeed > 0.2 && Math.random() < skateSpeed) fx.emit(p.x, 0.1, p.z, -glide.x * 0.1, 0.8, -glide.z * 0.1, 1, C.ice, 0.5);
          if (wasMoving && !moving && skateSpeed > 0.6) { audio.play('sfx_skate_stop'); fx.burst(p, 16, C.ice, { y: 0.1, up: 1.5, spread: 4 }); }
          wasMoving = moving; if (root) root.rotation.z = THREE.MathUtils.clamp(-(glide.x * Math.cos(player.facing) - glide.z * Math.sin(player.facing)) * 0.02, -0.25, 0.25);
        } else if (skating) { skating = false; player.mods.speed = 1; glide.set(0, 0, 0); if (skateSpeed > 0.4) audio.play('sfx_skate_stop'); skateSpeed = 0; }
        audio.setSkating(skating, skateSpeed);
        // footstep crunches + snow kicks
        if (!onIce && !sit && player.onGround && Math.hypot(player.vel.x, player.vel.z) > 0.5) { stepT -= dt; if (stepT <= 0) { stepT = 0.34; audio.play('sfx_foot_crunch'); fx.emit(p.x, 0.05, p.z, 0, 1, 0, 1.2, C.snow, 0.4); } }
        prev.copy(p);

        // emote / sit / cocoa poses (applied after player.update positioned the avatar)
        if (root) {
          if (sit) { root.position.y = sit.seat.y - 0.45; root.rotation.y = sit.seat.rot; }
          if (emote) {
            emote.t += dt; const k = emote.t;
            if (emote.id === 'wave') root.rotation.z = Math.sin(k * 14) * 0.12;
            else if (emote.id === 'dance') { root.rotation.y += Math.sin(k * 6) * 0.6; root.position.y += Math.abs(Math.sin(k * 8)) * 0.35; root.scale.set(1 + Math.sin(k * 16) * 0.06, 1 - Math.sin(k * 16) * 0.06, 1); }
            else if (emote.id === 'cheer') { root.position.y += Math.max(0, Math.sin(k * Math.PI / 0.8)) * 0.9; }
            else if (emote.id === 'honk') { const s = 1 + Math.sin(Math.min(1, k / 0.4) * Math.PI) * 0.15; root.scale.set(s, 1 / s, s); }
            if (k >= emote.dur) { emote = null; root.scale.set(1, 1, 1); if (!skating) root.rotation.z = 0; }
          }
        }
        if (cocoaT > 0) { cocoaT -= dt; mug.visible = true; mug.position.set(p.x + Math.sin(player.facing) * 0.5, 1.4 + Math.sin(t * 4) * 0.04, p.z + Math.cos(player.facing) * 0.5); if (Math.random() < 0.3) fx.emit(mug.position.x, mug.position.y + 0.2, mug.position.z, 0, 0.6, 0, 0.2, C.cocoa, 0.8, -0.5); } else mug.visible = false;
        if (set.bell.userData.swing > 0) { set.bell.userData.swing -= dt * 0.7; set.bell.rotation.z = Math.sin(t * 12) * 0.5 * set.bell.userData.swing; }
        for (const s of PHOTO_SPOTS) s._mat.opacity = 0.45 + Math.sin(t * 3 + s.x) * 0.25;

        // nearest interaction
        near = null; let best = 1e9;
        if (!sit) for (const a of actions) { const d = Math.hypot(a.x - p.x, a.z - p.z); if (d < a.r && d < best) { best = d; near = a; } }
        ui.setAction(sit ? { icon: '🧍', label: 'Stand' } : near);
        ui.setZone(skating ? '⛸ Pengu Rink' : Math.hypot(p.x - COCOA.x, p.z - COCOA.z) < 6 ? '☕ Cocoa Hut' : p.z > 26 ? '🌌 Aurora Arch' : Math.hypot(p.x + 25, p.z + 22) < 9 ? '🧊 Giant Ice Pengu' : '🐧 Pengu Plaza');
        if (((t * 2) | 0) !== this._st) { this._st = (t * 2) | 0; ui.setStats(save); }

        // NPCs: wander / skate loops / react to emotes, honk now and then
        for (const n of npcs) {
          n.phase += dt; let moving = false;
          if (n.react > 0) {
            n.react -= dt; n.m.rotation.y = n.face; const k = n.phase;
            n.m.position.y = n.kind === 'dance' ? Math.abs(Math.sin(k * 8)) * 0.3 : n.kind === 'cheer' ? Math.max(0, Math.sin(k * 7)) * 0.5 : 0;
            n.m.userData.wings.forEach((w, i) => w.rotation.z = (i ? 1 : -1) * (n.kind === 'wave' && i ? 1.4 + Math.sin(k * 14) * 0.4 : 0.25 + Math.abs(Math.sin(k * 10)) * (n.kind === 'cheer' ? 1.2 : 0.3)));
            if (n.react <= 0 && n.kind !== 'honk' && Math.random() < 0.5) audio.play('sfx_penguin_honk', 0.35);
          } else if (n.skater) {
            const a = n.phase * 0.35 + (npcs.indexOf(n) * 2.094); n.x = RINK.x + Math.cos(a) * (RINK.rx - 2.5); n.z = RINK.z + Math.sin(a) * (RINK.rz - 2); n.m.rotation.y = Math.atan2(-Math.sin(a), Math.cos(a)); n.m.rotation.z = 0.15; n.m.position.y = 0;
          } else {
            const dx = n.tx - n.x, dz = n.tz - n.z, d = Math.hypot(dx, dz);
            if (d < 0.3) { n.wait -= dt; if (n.wait <= 0) { pickTarget(n); n.wait = 2 + Math.random() * 5; } }
            else { const sp = 1.6 * dt; n.x += dx / d * sp; n.z += dz / d * sp; n.m.rotation.y = Math.atan2(dx, dz); moving = true; }
            n.m.rotation.z = moving ? Math.sin(n.phase * 9) * 0.12 : 0; n.m.position.y = moving ? Math.abs(Math.sin(n.phase * 9)) * 0.08 : 0;
            n.m.userData.wings.forEach((w, i) => w.rotation.z = (i ? 1 : -1) * (0.25 + (moving ? Math.abs(Math.sin(n.phase * 9)) * 0.2 : 0)));
            // gentle personal-space push from the player
            const pd = Math.hypot(n.x - p.x, n.z - p.z); if (pd < 1.2 && pd > 0.01) { n.x += (n.x - p.x) / pd * (1.2 - pd); n.z += (n.z - p.z) / pd * (1.2 - pd); }
          }
          n.m.position.x = n.x; n.m.position.z = n.z;
          n.honkT -= dt; if (n.honkT <= 0) { n.honkT = 8 + Math.random() * 14; if (Math.hypot(n.x - p.x, n.z - p.z) < 12) audio.play('sfx_penguin_honk', 0.3); }
        }

        // photo camera: brief cinematic framing toward the landmark
        if (photoCam) { photoCam.t -= dt; const k = Math.min(1, (1.6 - photoCam.t) * 3); cam.position.lerp(P.set(p.x, 2.6, p.z), k * 0.2); cam.lookAt(photoCam.look); if (photoCam.t <= 0) photoCam = null; }
      },
      dispose() {
        live = false; audio.stop(); ui.dispose(); fx.dispose(); set.dispose(); player.enabled = true; player.mods.speed = 1;
        ringMats.forEach(m => m.dispose()); mug.material.dispose();
        const i = engine.input.listeners?.keydown?.indexOf(onKey); if (i >= 0) engine.input.listeners.keydown.splice(i, 1);
        if (avatar?.root) { avatar.root.rotation.z = 0; avatar.root.scale.set(1, 1, 1); }
        if (engine.penguPlaza === game) delete engine.penguPlaza;
      },
    };
    engine.penguPlaza = game;
    if (typeof location !== 'undefined' && /[?&]pptest=1/.test(location.search)) window.__pp = game;   // headless smoke hook
    return game;
  },
};
