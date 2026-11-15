// Game: Pengu Plaza — cozy social hangout, now BIG. The snowy blue-hour plaza is the hub; paths, a creek bridge, a
// sled lift and a cave mouth lead to six new areas (Aurora Ridge, Frozen Harbor, Ice Cave Grotto, Snowy Pine Woods,
// Igloo Village, Sculpture Garden). Camera mode (zoom, filters, thirds grid, subject read-out) scores photos of 52
// targets — landmarks, locals, wildlife, shared-clock events (whale breach, shooting star, aurora night, dance
// party) and secrets — into an album with per-area pages, stars, rewards (one-time BB + filters/frames/titles).
// No fail states. Module map: config.js (tuning/save) · plaza.js (hub set + penguin builder) · world.js (new areas)
// · set/areas.js (new anchors, Set Builder resync) · targets.js · events.js · camera.js · album.js · rewards.js ·
// audio.js (Sound 2 pack + procedural fallback + ambience) · ui.js (HUD) · creatures.js · thumb.js.
import * as THREE from 'three';
import { Collision } from '../../engine/collision.js';
import { getDeviceMode } from '../../core/device.js';
import { GAME_ID, REWARD_SOURCE, PLAZA_R, RINK, COCOA, BELL, SPAWN, PHOTO_SPOTS, EMOTES, NPC_COUNT, NPC_POINTS, PHYS, normalizeSave } from './config.js';
import { buildPlaza, buildPenguin } from './plaza.js';
import { buildWorld, areaAt } from './world.js';
import * as A from './set/areas.js';
import { TARGETS, TARGET_BY_ID, COUNTED, RARITY } from './targets.js';
import { eventState } from './events.js';
import { PhotoCam } from './camera.js';
import { AlbumUI, loadThumbs, saveThumbs } from './album.js';
import { checkRewards, totals, FILTERS, owned, unlockLabel } from './rewards.js';
import { PlazaAudio } from './audio.js';
import { PlazaUI } from './ui.js';
import drawThumb from './thumb.js';
import CREDITS from './CREDITS.md?raw';

const LS = 'iceberg:v1:pengu-plaza';
function loadSave(economy) { let s = null; try { s = economy.cachedGameData?.(GAME_ID) || economy.profile?.gameData?.[GAME_ID] || null; } catch {} if (!s) try { s = JSON.parse(localStorage.getItem(LS) || 'null'); } catch {} return normalizeSave(s); }
function persist(economy, save) { try { localStorage.setItem(LS, JSON.stringify(save)); } catch {} try { economy.saveGameData?.(GAME_ID, save); } catch {} }
const inRink = (x, z) => ((x - RINK.x) / RINK.rx) ** 2 + ((z - RINK.z) / RINK.rz) ** 2 < 1;
const PLAZA_AREA = { id: 'plaza', name: 'Pengu Plaza', icon: '🐧', fog: '#2c4a80', hemi: 0.9, amb: null };

class Puffs { // pooled soft particles: snow kicks, hearts/sparkles, steam, confetti, splashes
  constructor(scene, n = 900) {
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
const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

let _thumb = null;
export default {
  id: GAME_ID,
  name: 'Pengu Plaza',
  tagline: 'Cozy penguin hangout — explore, photograph, collect',
  description: 'A snowy blue-hour plaza and six cozy places around it: Aurora Ridge, Frozen Harbor, an Ice Cave Grotto, Snowy Pine Woods, Igloo Village and a Sculpture Garden. Waddle, skate, sip cocoa, ride the sled lift — and photograph 50+ things (wildlife, locals, secrets, whale breaches, shooting stars, the aurora) to fill your photo album for rewards. No timers, no losing.',
  get thumbnail() { if (!_thumb) { try { _thumb = drawThumb(); } catch { _thumb = 'frost'; } } return _thumb; },
  music: 'none',
  credits: CREDITS,
  features: { build: false },
  mobile: true,

  async create(ctx) {
    const { engine, economy, music, avatar } = ctx;
    const mp = ctx.mp || engine.mp || (typeof window !== 'undefined' ? window.iceberg?.mp : null) || null;
    const player = engine.player, cam = engine.camera;
    const mobile = getDeviceMode() === 'mobile';
    const set = buildPlaza({ mobile }), scene = set.scene;
    const fx = new Puffs(scene), audio = new PlazaAudio(music);
    const world = buildWorld(scene, { mobile, fx, audio });
    const collision = new Collision({ floorY: 0, bounds: { type: 'circle', r: A.WORLD_R } });
    for (const c of [...set.colliders, ...world.colliders]) { if (c[0] === 'circle') collision.addCircle(c[1], c[2], c[3], c[4]); else collision.addBox(...c.slice(1)); }
    let save = loadSave(economy); save.visits++; checkRewards(save); persist(economy, save);
    let thumbs = loadThumbs();
    let live = true, debugOffset = 0;
    const clock = () => (typeof mp?.now === 'function' ? mp.now() : Date.now()) / 1000 + debugOffset;
    let ev = eventState(clock());
    const unsubs = [];

    // ---- ambient NPC penguins (Set Builder stand points) + dance-party crowd ----
    const scarves = ['#ff5f7e', '#5fd0ff', '#ffd36b', '#7fffc8', '#c79bff', '#ff9a3c', '#ffffff', '#6fa8ff', '#ff7fb0'];
    const npcs = [];
    for (let i = 0; i < NPC_COUNT; i++) {
      const m = buildPenguin({ scarf: scarves[i % scarves.length], hat: i % 3 === 0 ? scarves[(i + 4) % 9] : null }); const s = 0.8 + (i % 4) * 0.08; m.scale.setScalar(s); scene.add(m);
      const pt = NPC_POINTS[i], skater = pt.pose === 'skate';
      const n = { m, skater, pose: pt.pose, x: pt.x, z: pt.z, tx: pt.x, tz: pt.z, wait: 2 + Math.random() * 4, phase: Math.random() * 6, react: 0, kind: null, honkT: 4 + Math.random() * 10 };
      m.rotation.y = pt.facing; m.position.set(pt.x, 0, pt.z);
      if (pt.pose === 'cocoa' || pt.pose === 'sit') n.wait = 8 + Math.random() * 6;
      if (pt.pose === 'dance' || pt.pose === 'wave') { n.react = 3; n.kind = pt.pose; n.face = pt.facing; }
      npcs.push(n);
    }
    const DC = A.EVENTS.danceCrowd, crowd = [];
    for (let i = 0; i < 8; i++) { const m = buildPenguin({ scarf: scarves[(i + 3) % 9], hat: i % 2 ? scarves[i] : null }); m.scale.setScalar(0.78 + (i % 3) * 0.06); m.visible = false; scene.add(m); const a = i / 8 * Math.PI * 2; crowd.push({ m, a, home: new THREE.Vector3(-60 + i * 3, 0, -30), ph: Math.random() * 6 }); }
    function pickTarget(n) { for (let k = 0; k < 10; k++) { const a = Math.random() * 7, r = 4 + Math.random() * (PLAZA_R - 8), x = Math.cos(a) * r, z = Math.sin(a) * r; if (!inRink(x, z) && Math.hypot(x, z - 6) > 4.5 && Math.hypot(x - COCOA.x, z - COCOA.z) > 3) { n.tx = x; n.tz = z; return; } } }
    function npcReact(kind, at = player.pos) { for (const n of npcs) if (Math.hypot(n.x - at.x, n.z - at.z) < 10) { n.react = kind === 'wave' ? 3.2 : 2.2; n.kind = kind; n.face = Math.atan2(at.x - n.x, at.z - n.z); } }

    // ---- photo target runtime (world registers its own; plaza ones here) ----
    const runtime = { ...world.targets };
    const V = (a) => new THREE.Vector3(a[0], a[1], a[2]);
    for (const s of PHOTO_SPOTS) runtime[s.id] = { pts: [V(s.look)], active: () => true, bonus: () => false, maxDist: 45, yOff: 0, spot: s };
    for (const s of A.SPOTS_BIG) { if (!runtime[s.id]) runtime[s.id] = { pts: [V(s.look)], active: () => true, bonus: () => false, maxDist: 60, yOff: 0, sky: s.id === 'summit' }; runtime[s.id].spot = s; }
    runtime.bell = { pts: [new THREE.Vector3(BELL.x, 2.6, BELL.z)], active: () => true, bonus: () => set.bell.userData.swing > 0.25, maxDist: 26, yOff: 0 };
    runtime.barista = { pts: [set.barista.position], active: () => true, bonus: () => false, maxDist: 22, yOff: 1 };
    runtime.skaters = { pts: npcs.filter(n => n.skater).map(n => n.m.position), active: () => true, bonus: () => false, maxDist: 30, yOff: 0.9 };
    runtime.waver = { pts: () => npcs.filter(n => n.react > 0 && n.kind === 'wave').map(n => n.m.position), active: () => npcs.some(n => n.react > 0 && n.kind === 'wave'), bonus: () => true, maxDist: 22, yOff: 0.9 };
    runtime.dance_crowd = { pts: crowd.map(c => c.m.position), active: () => ev.dance.active && crowd[0].m.visible, bonus: () => true, maxDist: 30, yOff: 0.9 };
    const friendPts = []; runtime.friends = { pts: () => friendPts, active: () => friendPts.length > 0, bonus: () => false, maxDist: 20, yOff: 1.3 };
    const pcam = new PhotoCam({ engine, runtime, getArea: () => curArea }); pcam.occluders = world.occluders; pcam.filter = save.filter; pcam.setZoom(1);

    // ---- interactions ----
    const P = new THREE.Vector3();
    const allSpots = [...PHOTO_SPOTS.map(s => ({ ...s, y: 0, area: 'plaza' })), ...A.SPOTS_BIG.map(s => ({ ...s, y: s.y || 0 }))];
    const actions = [
      ...set.seats.map((s, i) => ({ type: 'sit', icon: '🪑', label: 'Sit', x: s.x, z: s.z, r: 1.8, seat: s, i })),
      { type: 'cocoa', icon: '☕', label: 'Hot cocoa', x: COCOA.x, z: COCOA.z + 1.6, r: 2.6 },
      { type: 'bell', icon: '🛎️', label: 'Ring bell', x: BELL.x, z: BELL.z, r: 2.2 },
      ...allSpots.map(p => ({ type: 'photo', icon: '📷', label: 'Snap ' + p.name.split(' ').pop(), x: p.x, z: p.z, y: p.y, r: 2.4, spot: p })),
      { type: 'lift', icon: '🚡', label: 'Ride up', x: A.RIDGE.lift.base.x - 2.6, z: A.RIDGE.lift.base.z + 0.5, r: 2.6, up: true },
      { type: 'lift', icon: '🚡', label: 'Ride down', x: A.RIDGE.lift.top.x - 2.4, z: A.RIDGE.lift.top.z - 1.5, y: A.RIDGE.plateau.top, r: 2.6, up: false },
      { type: 'scope', icon: '🔭', label: 'Look north', x: A.RIDGE.telescope.x, z: A.RIDGE.telescope.z - 1.3, y: A.RIDGE.plateau.top, r: 1.8 },
      { type: 'warm', icon: '🔥', label: 'Warm up', x: A.VILLAGE.bonfire.x, z: A.VILLAGE.bonfire.z, r: 3.4 },
    ];
    const ringMats = [], ringGeo = new THREE.RingGeometry(1.1, 1.4, 32);
    for (const p of allSpots) { const mat = new THREE.MeshBasicMaterial({ color: '#ffe08a', transparent: true, opacity: 0.7, depthWrite: false }); ringMats.push(mat); const r = new THREE.Mesh(ringGeo, mat); r.rotation.x = -Math.PI / 2; r.position.set(p.x, (p.y || 0) + 0.05, p.z); scene.add(r); p._mat = mat; }
    const paintRings = () => allSpots.forEach(p => p._mat.color.set(save.album[p.id] ? '#7fffc8' : '#ffe08a'));
    let near = null, sit = null, emote = null, cocoaT = 0, bellT = 0, ride = null, curArea = PLAZA_AREA, grid = true, uiTick = 0;
    const mug = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.1, 0.24, 10), new THREE.MeshStandardMaterial({ color: '#ff8a8a' })); mug.visible = false; scene.add(mug);

    function doEmote(id, remote = false) {
      if (!live) return; const e = EMOTES.find(x => x.id === id); if (!e) return;
      audio.play(e.sfx); emote = { id, t: 0, dur: e.dur }; save.emotes++; npcReact(id);
      const col = { wave: [C.gold, C.snow], dance: [C.pink, C.mint, C.lilac, C.gold], cheer: [C.gold, C.pink, C.mint], honk: [C.snow] }[id];
      fx.burst(player.pos, id === 'dance' ? 30 : 18, col, { y: 2.2, up: 3, spread: 4, grav: id === 'honk' ? 1 : 4 });
      ui.pop(e.icon, innerWidth / 2, innerHeight * 0.38);
      if (!remote) try { mp?.sendEvent?.('pp_emote', { e: id }); } catch {}
    }
    function doAct() {
      if (!live || ride) return;
      if (album.isOpen) return;
      if (pcam.active) return shutter();
      if (sit) return standUp();
      if (!near) { doEmote('honk'); return; }
      const a = near;
      if (a.type === 'sit') { sit = a; player.enabled = false; player.teleport(P.set(a.seat.x, 0, a.seat.z), a.seat.rot); audio.play('sfx_sit'); fx.burst(player.pos, 12, C.snow, { y: 0.4, up: 2, spread: 3 }); ui.say('Ahh, cozy', mobile ? 'Tap Stand to get up' : 'E / move to stand', 1300); }
      else if (a.type === 'cocoa') { audio.play('sfx_cocoa'); cocoaT = 3; save.cocoa++; mug.material.color.set(['#ff8a8a', '#8ad0ff', '#ffe08a', '#b28aff'][save.cocoa % 4]); ui.say('☕ Mmm, toasty!', `${save.cocoa} cup${save.cocoa > 1 ? 's' : ''} enjoyed`, 1500); fx.burst(player.pos, 20, [C.pink, C.gold], { y: 2.3, up: 2, spread: 2, grav: -1, life: 1.4 }); persist(economy, save); }
      else if (a.type === 'bell') { if (bellT > 0) return; bellT = 1.2; audio.play('sfx_bell_chime'); set.bell.userData.swing = 1; npcReact('cheer'); fx.burst(P.set(BELL.x, 2, BELL.z), 30, [C.gold, C.snow], { y: 1, up: 3, spread: 6, grav: 2 }); ui.say('🛎️ Ding-dong!', 'Quick — snap it mid-swing!', 1300); }
      else if (a.type === 'photo') openCamera(a.spot.look);
      else if (a.type === 'scope') { openCamera([A.RIDGE.aurora.x, A.RIDGE.aurora.y, A.RIDGE.aurora.z]); pcam.setZoom(1.2); ui.setZoom(1.2); if (ev.night < 0.5) ui.say('🔭 Clear skies', `The aurora shows at night — next night in ${fmt(ev.nightIn)}`, 2600); }
      else if (a.type === 'lift') startRide(a.up);
      else if (a.type === 'warm') { audio.play('sfx_cocoa', 0.7); fx.burst(player.pos, 24, [C.pink, C.gold], { y: 1.6, up: 2.5, spread: 3, grav: -1, life: 1.3 }); ui.say('🔥 So warm…', 'The choir is taking requests', 1400); }
    }
    function standUp() { if (!sit) return; const s = sit.seat; sit = null; player.enabled = true; player.teleport(P.set(s.x + Math.sin(s.rot) * 1.3, 0, s.z + Math.cos(s.rot) * 1.3), s.rot); audio.play('sfx_foot_crunch'); }
    function startRide(up) { ride = { up, k: 0 }; player.enabled = false; player.mods.gravity = 0; audio.play('sfx_sled_lift'); world.rideChair.visible = true; save.lifts++; ui.say(up ? '🚡 Up we go!' : '🚡 Down we go!', 'Enjoy the view', 1500); }

    // ---- camera mode ----
    function openCamera(look = null) { if (pcam.active || ride || album.isOpen) return; if (sit) standUp(); pcam.enter(look); ui.setCamera(true); ui.setZoom(pcam.zoom); ui.setFilter(FILTERS.find(f => f.id === pcam.filter)?.name || 'Natural'); ui.setGrid(grid); audio.play('sfx_camera_mode'); }
    function closeCamera() { if (!pcam.active) return; pcam.exit(); pcam.setZoom(1); ui.setCamera(false); audio.play('sfx_camera_mode', 0.6); }
    function toggleCamera() { pcam.active ? closeCamera() : openCamera(); }
    function cycleFilter(d) { const list = FILTERS.filter(f => owned(save, 'filter', f.id)); const i = list.findIndex(f => f.id === pcam.filter); const f = list[(i + d + list.length) % list.length]; pcam.setFilter(f.id); save.filter = f.id; ui.setFilter(f.name + (list.length < FILTERS.length ? `  (${list.length}/${FILTERS.length})` : '')); audio.play('sfx_zoom'); }
    function shutter() {
      if (!pcam.active) return; const res = pcam.evaluate(); save.shots++;
      audio.play('sfx_camera_shutter'); ui.flash(0.9);
      for (const n of npcs) if (Math.hypot(n.x - player.pos.x, n.z - player.pos.z) < 12) { n.react = 1.4; n.kind = 'cheer'; n.face = Math.atan2(player.pos.x - n.x, player.pos.z - n.z); }
      if (!res.length) { ui.toast('Nothing to file in the album — get a subject in frame', { icon: '🤔', ms: 2200 }); persist(economy, save); return; }
      const now = Math.floor(Date.now() / 1000); let img = null, top = null, newCount = 0;
      for (const r of res.slice(0, 4)) {
        const prev = save.album[r.id], isNew = !prev, better = prev && r.score > prev[0];
        if (!isNew && !better) continue;
        save.album[r.id] = [Math.max(r.score, prev?.[0] || 0), Math.max(r.stars, prev?.[1] || 0), prev?.[2] || now, (r.bonus || prev?.[3]) ? 1 : 0];
        if (!img) img = pcam.thumb(save.frame, `${r.meta.name} ${'★'.repeat(r.stars)}`); if (img) { thumbs[r.id] = img; }
        if (isNew) { newCount++; if (PHOTO_SPOTS.some(p => p.id === r.id) && !save.photos.includes(r.id)) save.photos.push(r.id); }
        if (!top || (isNew && !top.isNew)) top = { ...r, isNew };
        const R = RARITY[r.meta.rarity];
        ui.toast(`<b>${isNew ? 'NEW! ' : 'Better shot! '}${r.meta.icon} ${r.meta.name}</b><br>${'★'.repeat(r.stars)}${'☆'.repeat(3 - r.stars)} · ${r.score} pts · <span style="color:${R.color}">${R.label}</span>${r.bonus && r.meta.bonus ? ` · ✨${r.meta.bonus}` : ''}`, { img, border: R.color });
        if (isNew && (r.meta.rarity === 'rare' || r.meta.rarity === 'legendary')) try { mp?.sendEvent?.('pp_snap', { id: r.id, s: r.stars }); } catch {}
      }
      if (!saveThumbs(thumbs)) { thumbs = {}; saveThumbs(thumbs); }
      if (top) {
        const rar = top.meta.rarity; audio.play(rar === 'legendary' ? 'sfx_photo_legendary' : rar === 'rare' ? 'sfx_photo_rare' : 'sfx_photo_new');
        if (top.isNew) { const T = totals(save); ui.say(`📸 ${top.meta.name}!`, `${T.got}/${T.total} in your album`, 1800); fx.burst(player.pos, rar === 'legendary' ? 90 : 40, [C.gold, C.mint, C.pink], { y: 2, up: 6, spread: 7 }); }
      } else ui.toast(`${res[0].meta.icon} ${res[0].meta.name} — your album already has a better one (${save.album[res[0].id][0]} pts)`, { icon: '🖼️', ms: 2400 });
      paintRings(); grantRewards(); persist(economy, save); album.refresh();
    }
    function grantRewards() {
      const got = checkRewards(save); let delay = 900;
      for (const r of got) {
        if (r.bb > 0) economy.earn?.(r.bb, `Pengu Plaza: ${r.name}`, { source: REWARD_SOURCE });
        setTimeout(() => { if (!live) return; audio.play('sfx_reward'); ui.toast(`<b>${r.icon} ${r.name}</b>${r.bb ? ` · +${r.bb} BB` : ''}${r.unlock ? `<br>${unlockLabel(r.unlock)}` : ''}${r.badge ? '<br>🏅 Badge earned!' : ''}`, { icon: r.icon, border: '#ffd76a', ms: 5000 }); fx.burst(player.pos, 60, [C.gold, C.pink, C.mint, C.lilac], { y: 3, up: 8, spread: 10, life: 1.6 }); }, delay);
        delay += 1300;
      }
    }

    // ---- UI + album ----
    const ui = new PlazaUI(mobile, { onEmote: doEmote, onAct: doAct, onCamera: toggleCamera, onAlbum: () => toggleAlbum(), onZoom: (z) => { pcam.setZoom(z); ui.setZoom(pcam.zoom); }, onFilter: cycleFilter, onGrid: () => { grid = !grid; ui.setGrid(grid); } });
    const album = new AlbumUI({ getSave: () => save, getThumbs: () => thumbs, getPlayer: () => player.pos, onFlip: () => audio.play('sfx_page_flip'),
      onSelect: (kind, id) => { if (!owned(save, kind, id)) return; if (kind === 'filter') { save.filter = id; pcam.setFilter(id); } else if (kind === 'frame') save.frame = id; else save.title = id; audio.play('sfx_zoom'); persist(economy, save); },
      onClose: () => { audio.play('sfx_album_open', 0.7); player.enabled = !sit && !ride; } });
    function toggleAlbum(page) { if (album.isOpen) return album.close(); if (pcam.active) closeCamera(); album.open(page || (curArea?.id && curArea.id !== 'hub' ? curArea.id : 'plaza')); audio.play('sfx_album_open'); player.enabled = false; }
    paintRings();
    const statText = () => { const T = totals(save); return `☕ ${save.cocoa} · 📷 ${T.got}/${T.total}${save.title !== 'Tourist' ? ` · 🏷 ${save.title}` : ''}`; };
    ui.setStats(statText()); ui.setAlbum(totals(save).pct);
    const onKey = (e) => {
      if (!live || e.repeat) return;
      if (album.isOpen) { if (e.code === 'KeyB' || e.code === 'Escape') album.close(); return; }
      if (e.code === 'KeyC') return toggleCamera();
      if (e.code === 'KeyB') return toggleAlbum();
      if (pcam.active) {
        if (e.code === 'KeyE' || e.code === 'Space') shutter();
        else if (e.code === 'KeyR') cycleFilter(1);
        else if (e.code === 'KeyG') { grid = !grid; ui.setGrid(grid); }
        else if (e.code === 'Equal' || e.code === 'NumpadAdd') { pcam.setZoom(pcam.zoom * 1.15); ui.setZoom(pcam.zoom); audio.play('sfx_zoom'); }
        else if (e.code === 'Minus' || e.code === 'NumpadSubtract') { pcam.setZoom(pcam.zoom / 1.15); ui.setZoom(pcam.zoom); audio.play('sfx_zoom'); }
        else if (e.code === 'Escape') closeCamera();
        return;
      }
      const em = EMOTES.find(x => x.key === e.code); if (em) doEmote(em.id); if (e.code === 'KeyE') doAct();
    };
    engine.input.onKey(onKey);

    // ---- multiplayer: shared clock events are automatic; emotes + rare snaps are broadcast ----
    const remoteName = (from) => { try { return mp.players().find(p => p.id === from)?.name || 'A friend'; } catch { return 'A friend'; } };
    if (typeof mp?.onEvent === 'function') {
      unsubs.push(mp.onEvent('pp_emote', (pl, meta) => { if (!live || meta?.from === mp.localId?.()) return; const e = EMOTES.find(x => x.id === pl?.e); if (!e) return; const who = mp.nearby?.(40)?.find(p => p.id === meta.from); if (who) { fx.burst(P.set(who.position.x, who.position.y, who.position.z), 16, [C.gold, C.pink, C.mint], { y: 2.4, up: 3, spread: 3 }); npcReact(e.id, who.position); } }));
      unsubs.push(mp.onEvent('pp_snap', (pl, meta) => { if (!live || meta?.from === mp.localId?.()) return; const t = TARGET_BY_ID[pl?.id]; if (!t) return; ui.toast(`<b>${remoteName(meta.from)}</b> snapped <b>${t.icon} ${t.name}</b>!`, { icon: '🌟', border: RARITY[t.rarity].color, ms: 4200 }); }));
    }

    // ---- skating + steps ----
    const glide = new THREE.Vector3(); let skating = false, stepT = 0, wasMoving = false, skateSpeed = 0;
    const prev = new THREE.Vector3().copy(player.pos);
    const start = () => { audio.ok(); audio.startMusic(); audio.play('sfx_bell_chime', 0.6); ui.say('Welcome to Pengu Plaza!', 'Follow the signs — there’s lots to photograph 📷', 2400); };
    ui.welcome(save, COUNTED.length, start);

    // ---- area look (fog / light / ambience) + night blend ----
    const fogCol = new THREE.Color(), fogTarget = new THREE.Color(), bg = new THREE.Color('#203a6b'), nightBg = new THREE.Color('#0a1330'), skyNight = new THREE.Color('#6a78a8'), white = new THREE.Color('#ffffff');
    let hemiK = 0.9, indoorK = 0;
    fogCol.set(scene.fog.color);

    const game = {
      scene, collision, spawn: new THREE.Vector3(SPAWN.x, 0.1, SPAWN.z), spawnFacing: SPAWN.facing, music: 'none', maxCamDist: 18, occluders: world.occluders,
      get cameraController() { return pcam.active ? pcam.controller : undefined; },
      onClick() { if (pcam.active && !mobile) shutter(); },
      onFall: () => player.teleport(new THREE.Vector3(SPAWN.x, 0.5, SPAWN.z), SPAWN.facing),
      get debug() { return { near: near?.type || null, sit: !!sit, skating, emote: emote?.id || null, area: curArea.id, camera: pcam.active, ride: !!ride, album: album.isOpen, ev, save: JSON.parse(JSON.stringify(save)), totals: totals(save), sfxPlayed: audio.played, npcs: npcs.length, targets: Object.keys(runtime).length }; },
      api: {
        emote: doEmote, act: doAct, camera: (on = true) => (on ? openCamera() : closeCamera()), shutter, album: toggleAlbum,
        teleport: (x, z, y = 0, facing = 0) => { ride = null; world.rideChair.visible = false; player.mods.gravity = 1; player.enabled = !album.isOpen; player.teleport(new THREE.Vector3(x, y, z), facing); },
        aim: (x, y, z) => pcam.aim([x, y, z]), zoom: (z) => { pcam.setZoom(z); ui.setZoom(pcam.zoom); }, evaluate: () => pcam.evaluate().map(r => ({ id: r.id, score: r.score, stars: r.stars, bonus: r.bonus })),
        setClock: (T) => { debugOffset = T - (clock() - debugOffset); }, runtime, targetPos: (id) => { const rt = runtime[id]; const pts = typeof rt.pts === 'function' ? rt.pts() : rt.pts; const p = pts[0]; return p ? { x: p.x, y: p.y + (rt.yOff || 0), z: p.z } : null; },
      },
      update(dt, t) {
        if (!live) return;
        ev = eventState(clock());
        set.update(dt, t); fx.update(dt); bellT = Math.max(0, bellT - dt);
        const p = player.pos, root = avatar?.root;
        if (sit && engine.input.analog && Math.hypot(engine.input.analog.x || 0, engine.input.analog.y || 0) > 0.5) standUp();
        if (sit && ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown'].some(k => engine.input.down(k))) standUp();

        // sled lift ride
        if (ride) {
          ride.k = Math.min(1, ride.k + dt / A.RIDGE.lift.ride); const k = ride.up ? ride.k : 1 - ride.k;
          world.liftPos(k, P); player.vel.set(0, 0, 0); p.set(P.x - 0.2, P.y + 0.6, P.z); world.rideChair.position.set(P.x, P.y + 2.5, P.z);
          player.facing = ride.up ? 0 : Math.PI; if (root) { root.position.copy(p); root.rotation.y = player.facing; }
          if (Math.random() < dt * 3) fx.emit(p.x, p.y + 0.3, p.z, 0, -1, 0, 1, C.snow, 0.8, 2);
          if (ride.k >= 1) { const ex = ride.up ? A.RIDGE.lift.exit : { x: A.RIDGE.lift.base.x - 4, z: A.RIDGE.lift.base.z - 1 }; player.mods.gravity = 1; player.enabled = !album.isOpen; player.teleport(P.set(ex.x, ride.up ? A.RIDGE.plateau.top + 0.2 : 0, ex.z), ride.up ? -Math.PI / 2 : Math.PI); world.rideChair.visible = false; ride = null; ui.say(ride === null && p.y > 3 ? '🌌 Aurora Ridge' : '🐾 Back down', p.y > 3 ? 'Best view in town' : '', 1300); }
        }

        // skating
        const onIce = inRink(p.x, p.z) && !sit && p.y < 0.5 && !pcam.active;
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
        } else if (skating) { skating = false; if (!pcam.active) player.mods.speed = 1; glide.set(0, 0, 0); if (skateSpeed > 0.4) audio.play('sfx_skate_stop'); skateSpeed = 0; if (root) root.rotation.z = 0; }
        audio.setSkating(skating, skateSpeed);
        if (!onIce && !sit && !ride && player.onGround && Math.hypot(player.vel.x, player.vel.z) > 0.5) { stepT -= dt; if (stepT <= 0) { stepT = pcam.active ? 0.5 : 0.34; audio.play('sfx_foot_crunch', pcam.active ? 0.5 : 1); fx.emit(p.x, p.y + 0.05, p.z, 0, 1, 0, 1.2, C.snow, 0.4); } }
        prev.copy(p);

        // emote / sit / cocoa poses
        if (root && !ride) {
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
        if (cocoaT > 0) { cocoaT -= dt; mug.visible = !pcam.active; mug.position.set(p.x + Math.sin(player.facing) * 0.5, p.y + 1.4 + Math.sin(t * 4) * 0.04, p.z + Math.cos(player.facing) * 0.5); if (Math.random() < 0.3) fx.emit(mug.position.x, mug.position.y + 0.2, mug.position.z, 0, 0.6, 0, 0.2, C.cocoa, 0.8, -0.5); } else mug.visible = false;
        if (set.bell.userData.swing > 0) { set.bell.userData.swing -= dt * 0.7; set.bell.rotation.z = Math.sin(t * 12) * 0.5 * set.bell.userData.swing; }
        for (const s of allSpots) s._mat.opacity = 0.45 + Math.sin(t * 3 + s.x) * 0.25;

        // world (areas, critters, events)
        world.update(dt, t, { ev, player: p });

        // area: zone chip, discovery, ambience + look
        const a = areaAt(p.x, p.z) || (Math.hypot(p.x, p.z) < PLAZA_R + 4 ? PLAZA_AREA : null);
        const zoneArea = a || PLAZA_AREA;
        if (a && a !== curArea) {
          curArea = a; audio.setAmbience(a.amb || null);
          if (a.id !== 'plaza' && !save.areas.includes(a.id)) { save.areas.push(a.id); persist(economy, save); audio.play('sfx_area_discover'); ui.say(`✨ ${a.icon} ${a.name}`, 'New area discovered!', 2400); ui.toast(`Discovered <b>${a.icon} ${a.name}</b> — new album page!`, { icon: '🗺', border: '#7fffc8' }); }
        } else if (!a && curArea !== PLAZA_AREA && Math.hypot(p.x - curArea.x, p.z - curArea.z) > curArea.r + 6) { curArea = { ...PLAZA_AREA, id: 'hub', name: 'Snowfield' }; audio.setAmbience('amb_woods'); }
        const indoor = curArea.indoor ? 1 : 0; indoorK += (indoor - indoorK) * Math.min(1, dt * 2);
        fogTarget.set(curArea.fog || PLAZA_AREA.fog).lerp(nightBg, ev.night * 0.55 * (1 - indoorK)); fogCol.lerp(fogTarget, Math.min(1, dt * 1.5)); scene.fog.color.copy(fogCol);
        scene.fog.near = 45 - indoorK * 30; scene.fog.far = 175 - indoorK * 120;
        scene.background = scene.background || new THREE.Color(); scene.background.copy(bg).lerp(nightBg, ev.night * 0.8).lerp(fogCol, indoorK);
        hemiK += ((curArea.hemi ?? 0.9) * (1 - ev.night * 0.3) - hemiK) * Math.min(1, dt * 1.5); if (set.hemi) set.hemi.intensity = hemiK; if (set.moon) set.moon.intensity = 1.1 * (1 - indoorK * 0.85) * (1 - ev.night * 0.25);
        if (set.sky?.material) set.sky.material.color.copy(white).lerp(skyNight, ev.night);
        if (set.lanternMat) set.lanternMat.emissiveIntensity = 1.6 + ev.night * 1.2;
        if (set.snowPts) { set.snowPts.visible = indoorK < 0.5; set.snowPts.position.set(p.x, Math.max(0, p.y - 2), p.z); }

        // nearest interaction
        near = null; let best = 1e9;
        if (!sit && !ride && !pcam.active) for (const ac of actions) { if (ac.y !== undefined && Math.abs(p.y - ac.y) > 2) continue; if (ac.y === undefined && p.y > 2) continue; const d = Math.hypot(ac.x - p.x, ac.z - p.z); if (d < ac.r && d < best) { best = d; near = ac; } }
        ui.setAction(pcam.active ? { icon: '📸', label: 'SNAP', key: 'E' } : sit ? { icon: '🧍', label: 'Stand', key: 'E' } : ride ? { icon: '🚡', label: 'Riding…' } : near ? { ...near, key: 'E' } : null);
        ui.setZone(skating ? '⛸ Pengu Rink' : zoneArea === PLAZA_AREA && curArea.id === 'hub' ? '❄️ Snowfield' : `${zoneArea.icon} ${zoneArea.name}`);

        // friends in frame (social target)
        uiTick -= dt;
        if (uiTick <= 0) {
          uiTick = 0.12;
          friendPts.length = 0; try { for (const o of mp?.nearby?.(24) || []) friendPts.push(new THREE.Vector3(o.position.x, o.position.y, o.position.z)); } catch {}
          ui.setStats(statText()); ui.setAlbum(totals(save).pct);
          const evs = [];
          if (ev.night > 0.5) evs.push(`🌌 Aurora night ${fmt(ev.nightLeft)}`); else if (ev.nightIn < 60) evs.push(`🌙 Night in ${fmt(ev.nightIn)}`);
          if (ev.dance.active) evs.push(`💃 Dance party! ${fmt(ev.dance.left)}`); else if (ev.dance.next < 30 && Math.hypot(p.x, p.z) < 60) evs.push(`💃 Party in ${fmt(ev.dance.next)}`);
          if (curArea.id === 'harbor') evs.push(ev.whale.active ? '🐋 WHALE!' : `🐋 Whale in ${fmt(ev.whale.next)}`);
          if (curArea.id === 'village' && ev.snowman.done) evs.push('⛄ Snowman finished!');
          ui.setEvent(evs.join(' · '));
          if (pcam.active) { const r = pcam.evaluate(), b = r[0] || null; ui.setSubject(b, b ? !!save.album[b.id] : false, b && save.album[b.id] ? save.album[b.id][1] : 0); }
        }

        // NPCs: wander / skate loops / react to emotes, honk now and then
        for (const n of npcs) {
          n.phase += dt; let moving = false;
          if (n.react > 0) {
            n.react -= dt; n.m.rotation.y = n.face; const k = n.phase;
            n.m.position.y = n.kind === 'dance' ? Math.abs(Math.sin(k * 8)) * 0.3 : n.kind === 'cheer' ? Math.max(0, Math.sin(k * 7)) * 0.5 : 0;
            n.m.userData.wings.forEach((w, i) => w.rotation.z = (i ? 1 : -1) * (n.kind === 'wave' && i ? 1.4 + Math.sin(k * 14) * 0.4 : 0.25 + Math.abs(Math.sin(k * 10)) * (n.kind === 'cheer' ? 1.2 : 0.3)));
            if (n.react <= 0 && n.kind !== 'honk' && Math.random() < 0.5) audio.play('sfx_penguin_honk', 0.35);
          } else if (n.skater) {
            const a2 = n.phase * 0.35 + (npcs.indexOf(n) * 2.094); n.x = RINK.x + Math.cos(a2) * (RINK.rx - 2.5); n.z = RINK.z + Math.sin(a2) * (RINK.rz - 2); n.m.rotation.y = Math.atan2(-Math.sin(a2), Math.cos(a2)); n.m.rotation.z = 0.15; n.m.position.y = 0;
          } else {
            const dx = n.tx - n.x, dz = n.tz - n.z, d = Math.hypot(dx, dz);
            if (d < 0.3) { n.wait -= dt; if (n.wait <= 0) { pickTarget(n); n.wait = 2 + Math.random() * 5; } }
            else { const sp = 1.6 * dt; n.x += dx / d * sp; n.z += dz / d * sp; n.m.rotation.y = Math.atan2(dx, dz); moving = true; }
            n.m.rotation.z = moving ? Math.sin(n.phase * 9) * 0.12 : 0; n.m.position.y = moving ? Math.abs(Math.sin(n.phase * 9)) * 0.08 : 0;
            n.m.userData.wings.forEach((w, i) => w.rotation.z = (i ? 1 : -1) * (0.25 + (moving ? Math.abs(Math.sin(n.phase * 9)) * 0.2 : 0)));
            const pd = Math.hypot(n.x - p.x, n.z - p.z); if (pd < 1.2 && pd > 0.01) { n.x += (n.x - p.x) / pd * (1.2 - pd); n.z += (n.z - p.z) / pd * (1.2 - pd); }
          }
          n.m.position.x = n.x; n.m.position.z = n.z;
          n.honkT -= dt; if (n.honkT <= 0) { n.honkT = 8 + Math.random() * 14; if (Math.hypot(n.x - p.x, n.z - p.z) < 12) audio.play('sfx_penguin_honk', 0.3); }
        }
        // dance party crowd (shared clock): waddle in, dance in a ring, waddle off
        { const on = ev.dance.active, k = ev.dance.k, L = A.EVENTS.danceCrowd.len, tIn = 4 / L, tOut = 1 - 4 / L;
          crowd.forEach((c, i) => { c.ph += dt; const m = c.m; m.visible = on && Math.hypot(p.x, p.z) < 90; if (!m.visible) return;
            const ring = P.set(DC.x + Math.cos(c.a + t * 0.4) * DC.r, 0, DC.z + Math.sin(c.a + t * 0.4) * DC.r), from = c.home;
            const w = k < tIn ? k / tIn : k > tOut ? 1 - (k - tOut) / (1 - tOut) : 1;
            m.position.set(from.x + (ring.x - from.x) * w, 0, from.z + (ring.z - from.z) * w);
            if (w >= 1) { m.rotation.y = Math.atan2(DC.x - m.position.x, DC.z - m.position.z) + Math.sin(c.ph * 6) * 0.6; m.position.y = Math.abs(Math.sin(c.ph * 8 + i)) * 0.35; m.userData.wings.forEach((wg, j) => wg.rotation.z = (j ? 1 : -1) * (0.6 + Math.abs(Math.sin(c.ph * 8 + i)) * 1.0)); }
            else { m.rotation.y = Math.atan2(ring.x - from.x, ring.z - from.z) * (k < tIn ? 1 : -1); m.rotation.z = Math.sin(c.ph * 9) * 0.12; m.position.y = Math.abs(Math.sin(c.ph * 9)) * 0.08; } });
          if (on && Math.hypot(p.x - DC.x, p.z - DC.z) < 20 && Math.random() < dt * 6) fx.emit(DC.x + (Math.random() - 0.5) * 6, 2.5, DC.z + (Math.random() - 0.5) * 6, 0, 2, 0, 2, [C.pink, C.mint, C.lilac, C.gold][(Math.random() * 4) | 0], 1, 3); }
      },
      dispose() {
        live = false; closeCamera(); audio.stop(); ui.dispose(); album.dispose(); fx.dispose(); set.dispose(); world.dispose(); player.enabled = true; player.mods.speed = 1; player.mods.gravity = 1; player.mods.jump = 1;
        unsubs.forEach(u => { try { u?.(); } catch {} });
        ringMats.forEach(m => m.dispose()); ringGeo.dispose(); mug.material.dispose();
        engine.renderer.domElement.style.filter = '';
        const i = engine.input.listeners?.keydown?.indexOf(onKey); if (i >= 0) engine.input.listeners.keydown.splice(i, 1);
        if (avatar?.root) { avatar.root.rotation.z = 0; avatar.root.scale.set(1, 1, 1); avatar.root.visible = true; }
        if (engine.penguPlaza === game) delete engine.penguPlaza;
      },
    };
    engine.penguPlaza = game;
    if (typeof location !== 'undefined' && /[?&]pptest=1/.test(location.search)) window.__pp = game;   // headless smoke hook
    return game;
  },
};
