// Game: Lantern Hollow — co-op action RPG / dungeon adventure (GM1, final Iceberg batch). NOT published.
// Loop: explore > fight > loot embers/materials > return to Frostlight Village > upgrade > take harder quests.
// Areas (one shared coordinate space, areas.js): Frostlight Village (hub) + Glowroot Caves (Phase 2); Mine/Throne in Phase 3.
// Multiplayer (brief §9): host simulates enemies/boss/dungeon per occupied area (enemies.js AreaSim) and publishes
//   en.<area> / boss.<area> / dun.<area> / party; clients send 'hit' / 'light' / 'revive' / 'at' events; every client
//   resolves its own damage from timestamped telegraphs and rolls its own loot from host 'slain' seeds. No BB from mp.
// Design: /workspace/iceberg-game-maker/designs/lantern-hollow-brief.md
import * as THREE from 'three';
import { Collision } from '../../engine/collision.js';
import { getDeviceMode } from '../../core/device.js';
import { GAME_ID, GAME_NAME, REWARD_SOURCE, rewardReason, QUESTS, UPGRADES, HEARTH_TIERS, BB_MILESTONES, NPC_NAMES, TONIC, CARRY_LOSS, POST_BANK, BUILT_AREAS,
  normalizeSave, mergeSaves, statsFor, canAfford, pay, tonicMax } from './config.js';
import { AREAS, areaAt } from './areas.js';
import { createNet } from './net.js';
import { HollowAudio, ENEMY_SFX } from './audio.js';
import { HollowUI, costChips, rewardChips, esc } from './ui.js';
import { drawThumb } from './thumb.js';
import { makeAuroraSky, makeSnow, makeMats, makeLantern } from './world/common.js';
import { buildVillage } from './world/village.js';
import { buildCaves, CAVE, caveWalkable, inPool } from './world/caves.js';
import { LightPool } from './lights.js';
import { Particles, Telegraphs, Pickups, inShape, makeGlowDecal } from './fx.js';
import { DEF, BOSS, ST, AreaSim, packEnemies, unpackEnemies, enemyShapes, bossShapes, mulberry32, strHash } from './enemies.js';
import { EnemyViews, MossmawView } from './enemyViews.js';
import { PlayerCombat } from './combat.js';
import { QuestLog } from './quests.js';

let thumbCache = null;
function persist(economy, save) {
  if (typeof economy.saveGameData === 'function') return economy.saveGameData(GAME_ID, save);
  economy.profile.gameData = { ...(economy.profile.gameData || {}), [GAME_ID]: save };
  economy.backend?.saveProfile?.(economy.profile);
  return Promise.resolve({ ok: true });
}
const LOOKS = {
  village: { bg: '#0b1030', fog: ['#1a2140', 30, 140], hemi: ['#6f7fc8', '#2a2440', 0.7], moon: ['#b8c8ff', 0.9], exposure: 1.05, sky: true },
  caves: { bg: '#05030c', fog: ['#0d0820', 12, 62], hemi: ['#7a6ac0', '#160c28', 0.62], moon: ['#8a7aff', 0.32], exposure: 1.2, sky: false },
};
const NPC_LINES = {
  wick: 'The aurora has gone dark, little light-bearer, and the gloom stirs below. Carry your lantern where the Hollow needs it most.',
  brann: 'Embers in, steel out. Bring me enough and I\'ll make that blade sing, and your feet quicker than a spooked hare.',
  ysolde: 'A bigger flame keeps the gloom further away. Moths and shades hate a bright lantern. Flare it and watch them squirm.',
  moss: 'Glowberry tonics, brewed fresh! And a stout heart never hurt anyone. Well, nobody I\'ve met.',
  board: 'Notices flutter in the cold wind, pinned with icicles.',
};
const ICON = { wick: '🧙', brann: '⚒️', ysolde: '🏮', moss: '🧪', board: '📜' };

export default {
  id: GAME_ID,
  name: GAME_NAME,
  tagline: 'Carry the light into the dark — together',
  description: 'The aurora has gone dark and the Hollow Queen\'s gloom creeps into Frostlight Village. Grab your lantern and blade, then dive into glowing caves, a flooded mine and the Aurora Throne. Fight telegraphed foes, collect embers, forge upgrades and take on quests. Play solo or with friends, and revive each other when the light gutters.',
  get thumbnail() { if (!thumbCache) { try { thumbCache = drawThumb(); } catch { thumbCache = 'frost'; } } return thumbCache; },
  music: 'none', // plays its own Sound-designed loops through the shared audio output
  features: {},
  mobile: true,  // shared joystick + jump, plus the game's own ⚔ / DASH / FLARE / ✋ / 🧪 buttons

  async create(ctx) {
    const { engine, economy, music, avatar } = ctx;
    const player = engine.player, input = engine.input, renderer = engine.renderer, camera = engine.camera;
    const mobile = getDeviceMode() === 'mobile';
    const testMode = /[?&]lhtest=1\b/.test(location.search);
    const prev = { exposure: renderer.toneMappingExposure, far: camera.far, pitch: player.camPitch, dist: player.camDist };
    const V = (x, y, z) => new THREE.Vector3(x, y, z);

    // ---------- scene + lighting rig ----------
    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog('#1a2140', 30, 140); scene.background = new THREE.Color('#0b1030');
    camera.far = Math.max(prev.far, 900); camera.updateProjectionMatrix();
    player.camPitch = 0.5; player.camDist = 11.5;
    const hemi = new THREE.HemisphereLight('#6f7fc8', '#2a2440', 0.7); scene.add(hemi);
    const moon = new THREE.DirectionalLight('#b8c8ff', 0.9); moon.castShadow = true;
    moon.shadow.mapSize.set(mobile ? 1024 : 2048, mobile ? 1024 : 2048); Object.assign(moon.shadow.camera, { left: -32, right: 32, top: 32, bottom: -32, near: 1, far: 140 }); moon.shadow.bias = -0.0005;
    scene.add(moon, moon.target);
    const sky = makeAuroraSky({ top: '#04061a', horizon: '#1e2a5c', strength: 0.9 }); scene.add(sky.mesh);
    const snow = makeSnow(mobile ? 300 : 900); scene.add(snow.points);
    const lights = new LightPool(scene, mobile ? 6 : 10);
    const village = buildVillage({ mobile, lights }); scene.add(village.group);
    const caves = buildCaves({ lights, mobile }); scene.add(caves.group);

    // ---------- collision (one set; bounds follow the current area) ----------
    const collision = new Collision({ floorY: 0, bounds: { type: 'box', ...AREAS.village.bounds } });
    village.colliders(collision); caves.colliders(collision);
    const bossCircle = { x: CAVE.den.boss[0], z: CAVE.den.boss[1], r: 3.0, top: 8 };

    // ---------- save, quests, net, audio, fx ----------
    let save = normalizeSave(economy.cachedGameData?.(GAME_ID) ?? economy.profile?.gameData?.[GAME_ID]);
    let disposed = false, dirty = false, saveT = 0;
    economy.loadGameData?.(GAME_ID)?.then?.((d) => { if (d && !disposed) { save = mergeSaves(save, d); } }).catch?.(() => {});
    const markDirty = () => { dirty = true; };
    const saveNow = () => { saveT = 0; dirty = false; return persist(economy, save)?.catch?.(() => {}); };
    const stats = () => statsFor(save);
    const audio = new HollowAudio(music);
    const net = createNet(engine, { testMode });
    const me = () => net.localId();
    const particles = new Particles(scene, mobile ? 300 : 600), telegraphs = new Telegraphs(scene), pickups = new Pickups(scene);
    const views = new EnemyViews(scene, camera), mossmaw = new MossmawView(scene, CAVE.den.boss);
    let area = 'village', carried = 0;
    const tmpV = new THREE.Vector3();
    const toScreen = (x, y, z) => { tmpV.set(x, y, z).project(camera); if (tmpV.z > 1) return [null, null]; const r = renderer.domElement.getBoundingClientRect(); return [r.left + (tmpV.x + 1) / 2 * r.width, r.top + (1 - tmpV.y) / 2 * r.height]; };
    const near = (x, z, d = 22) => Math.hypot(player.pos.x - x, player.pos.z - z) < d;

    const quests = new QuestLog(() => save, {
      onProgress: (q, r) => { if (!r.done) { audio.play('sfx_quest_progress', { minGap: 0.4 }); if (q.goal > 1) ui.toast(`📜 ${esc(q.title)} <b>${r.p}/${q.goal}</b>`, 1800); } markDirty(); },
      onReady: (q) => { audio.play('sfx_quest_complete', { minGap: 0.3 }); ui.toast(`✔ <b>${esc(q.title)}</b> complete! Return to ${NPC_NAMES[q.giver]}.`, 3500); markDirty(); },
      onTurnIn: (q) => { audio.play('sfx_quest_complete'); ui.toast(`🎉 ${esc(q.title)}: ${rewardChips(q.reward)}`, 3500); if (quests.allDone) awardBB('all_quests'); combat.hp = Math.min(combat.maxHp, combat.hp); saveNow(); },
    });
    function awardBB(id) {
      if (save.bbClaimed.includes(id)) return 0; const m = BB_MILESTONES.find(x => x.id === id); if (!m) return 0;
      save.bbClaimed.push(id); saveNow();                               // claim recorded before paying (Crystal Spire pattern)
      economy.earn(m.bb, rewardReason(m.what), { source: REWARD_SOURCE }); ui.toast(`💎 +${m.bb} Birg Bucks: ${esc(m.what)}`, 4000); return m.bb;
    }

    // ---------- UI ----------
    const taps = new Set(); const onKey = (e) => { if (!e.repeat) taps.add(e.code); }; input.onKey(onKey);
    const ui = new HollowUI({ engine, onTap: (k) => taps.add(k), onAct: (a, v) => onAct(a, v), onCloseModal: () => { audio.play('sfx_ui_close'); } });
    const blockF = (e) => { if (e.code === 'KeyF') e.stopImmediatePropagation(); };   // no Ice Rocket flight in here
    addEventListener('keydown', blockF, true);

    // ---------- player: lantern + light + sword (combat) ----------
    const mats = makeMats(), handLantern = makeLantern(mats, 1.25);
    const armL = avatar.bones?.armL, armLen = avatar.bodySlots?.limbs?.arm?.[1] || 1;
    if (armL) { handLantern.position.set(0, -armLen - 0.22, 0.05); armL.add(handLantern); }
    const lanternLight = new THREE.PointLight('#ffb35a', 16, 14, 1.5); scene.add(lanternLight);
    const lightDecal = makeGlowDecal('#ffb347', 0.16); scene.add(lightDecal);
    const flareRing = new THREE.Mesh(new THREE.RingGeometry(0.96, 1, 64), new THREE.MeshBasicMaterial({ color: '#ffd27a', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
    flareRing.rotation.x = -Math.PI / 2; scene.add(flareRing);
    const combat = new PlayerCombat({ engine, avatar, audio, particles, scene, mobile, stats,
      onHits: (hits, info) => onHits(hits, info), onDown: () => { announce(true); ui.banner('Downed!', 'Hold on, the light isn\'t out yet…', 1800); },
      onHurt: (n) => { ui.hurt(); shake = 0.25; const [x, y] = toScreen(player.pos.x, player.pos.y + 2.6, player.pos.z); ui.float(`-${n / 2}❤`, x, y, 'hurt'); announceSoon(); },
      onTonic: () => useTonic() });

    // ---------- multiplayer: party + host sim ----------
    const party = new Map();            // id -> { a, hp, mhp, pw, dn, r, name }
    const sims = {};                    // host only: area -> AreaSim
    const snaps = {}, dun = {}, boss = {}; // latest shared state per area
    const interp = new Map();           // client: id -> render record (smoothed)
    let lastAnnounce = 0, announcePending = false, hitQueue = [], bossHitQ = 0, sacQ = null, hitFlushT = 0, publishT = 0, emptyT = {}, shake = 0;
    const selfRecord = () => ({ a: area, hp: combat.hp, mhp: combat.maxHp, pw: stats().power, dn: !!combat.down, r: Math.round(combat.radius * 10) / 10, name: economy.profile?.displayName || 'You' });
    function announce(force) { const now = performance.now(); if (!force && now - lastAnnounce < 900) { announcePending = true; return; } lastAnnounce = now; announcePending = false; net.sendEvent('at', selfRecord()); }
    const announceSoon = () => announce(false);
    net.onEvent('at', (p, meta) => {
      const id = meta?.from; if (!id || !p) return; party.set(id, { ...party.get(id), ...p });
      if (net.isHost()) publishParty();
    });
    function publishParty() { const ids = new Set(net.players().map(p => p.id)); const o = {}; for (const [id, v] of party) if (ids.has(id) || id === me()) o[id] = v; net.setState('party', o); }
    net.onState('party', (p) => { if (net.isHost()) return; for (const [id, v] of Object.entries(p || {})) party.set(id, { ...party.get(id), ...v }); for (const id of [...party.keys()]) if (!(id in (p || {}))) party.delete(id);
      const mine = p?.[me()]; if (mine && combat.down && mine.dn === false && reviveCredit) { /* revived handled by event */ } });
    net.onPlayersChanged?.(() => { announce(true); if (net.isHost()) publishParty(); });
    net.onHostChanged?.(() => { announce(true); if (net.isHost()) for (const a of Object.keys(snaps)) ensureSim(a, true); });
    let reviveCredit = 0;

    function ensureSim(a, adopt = false) {
      if (sims[a] || a !== 'caves') return sims[a];
      const sim = sims[a] = new AreaSim(a, {
        canWalk: (x, z) => caveWalkable(x, z, 0.5) && !(caves.gateClosed && z < CAVE.gate.z1 + 0.6 && z > CAVE.gate.z0 - 0.6) && Math.hypot(x - bossCircle.x, z - bossCircle.z) > 3.6,
        litAt: (x, z) => litAt(x, z, a), now: () => net.now(), send: (n, p) => net.sendEvent(n, p),
        onDun: (d) => { net.setState(`dun.${a}`, d); },
      }, CAVE);
      if (adopt) sim.adopt(snaps[a], dun[a], boss[a]);
      else if (dun[a]) sim.dun = { ...sim.dun, ...dun[a] };
      sim.dirtyDun();
      return sim;
    }
    function playersIn(a) {   // [{ id, x, z, r, down }] incl. me
      const out = [];
      if (area === a) out.push({ id: me(), x: player.pos.x, z: player.pos.z, r: combat.radius, down: !!combat.down });
      for (const n of net.nearby(5000)) { const ar = areaAt(n.position.x, n.position.z); if (ar !== a) continue; const pi = party.get(n.id); out.push({ id: n.id, x: n.position.x, z: n.position.z, r: pi?.r || 6, down: !!pi?.dn }); }
      return out;
    }
    function litAt(x, z, a) {
      for (const t of playersIn(a)) if (Math.hypot(t.x - x, t.z - z) < t.r) return true;
      if (a === 'caves') for (const p of caves.posts) if (p.lit && Math.hypot(p.x - x, p.z - z) < 6) return true;
      return false;
    }
    // host: apply hits / lights / revives
    net.onEvent('hit', (p, meta) => {
      if (!net.isHost() || !p) return; const sim = ensureSim(p.a); if (!sim) return;
      for (const [id, dmg] of (p.h || []).slice(0, 16)) sim.applyHit(id, dmg, { flare: !!p.fl, kx: p.x, kz: p.z, k: 0.6, from: meta?.from });
      if (p.b) sim.hitBoss(p.b, { from: meta?.from });
      if (p.s != null) sim.hitBoss(0, { sac: p.s | 0, from: meta?.from });
    });
    net.onEvent('light', (p) => { if (!net.isHost() || !p) return; const sim = ensureSim(p.a); if (!sim || !sim.dun.posts || sim.dun.posts[p.i] == null) return; if (!sim.dun.posts[p.i]) { sim.dun.posts[p.i] = 1; sim.dirtyDun(); } });
    net.onEvent('revive', (p, meta) => {
      if (!net.isHost() || !p?.t) return; const target = party.get(p.t); if (!target?.dn) return;
      const pos = (id) => id === me() ? { x: player.pos.x, z: player.pos.z } : net.nearby(5000).find(n => n.id === id)?.position;
      const a = pos(meta?.from), b = pos(p.t); if (!a || !b || Math.hypot(a.x - b.x, a.z - b.z) > 3.5) return;
      target.dn = false; party.set(p.t, target); publishParty(); net.sendEvent('revived', { t: p.t, by: meta.from });
    });
    net.onEvent('revived', (p) => {
      if (!p) return; const pi = party.get(p.t); if (pi) pi.dn = false;
      if (p.t === me() && combat.down) { combat.reset(false); combat.hp = Math.max(2, Math.ceil(combat.maxHp / 2)); audio.play('sfx_revive'); ui.banner('Revived!', `${partyName(p.by)} rekindled your lantern`, 2000); announce(true); burstAt(player.pos.x, player.pos.z, ['#9dffb0', '#ffffff', '#ffd27a'], 30); }
      if (p.by === me() && p.t !== me()) { save.stats.revives++; quests.emit('kindred'); audio.play('sfx_revive'); ui.toast(`💚 You revived ${esc(partyName(p.t))}`); markDirty(); }
      const f = net.fakes?.find(x => x.id === p.t); if (f) f.down = false;
    });
    const partyName = (id) => party.get(id)?.name || net.players().find(x => x.id === id)?.name || id;
    // everyone: shared state
    for (const a of ['caves']) {
      net.onState(`en.${a}`, (s) => { snaps[a] = s; if (net.isHost()) return; const now = net.now(); const seen = new Set();
        for (const r of unpackEnemies(s)) { seen.add(r.id); const cur = interp.get(r.id); if (cur) Object.assign(cur, { ...r, x: cur.x, z: cur.z, tx: r.x, tz: r.z }); else interp.set(r.id, { ...r, tx: r.x, tz: r.z }); }
        for (const id of [...interp.keys()]) if (!seen.has(id)) interp.delete(id); void now; });
      net.onState(`boss.${a}`, (b) => { boss[a] = b; });
      net.onState(`dun.${a}`, (d) => applyDun(a, d));
    }
    function applyDun(a, d) {
      const old = dun[a]; dun[a] = d; if (!d || a !== 'caves') return;
      if (old && old.rid !== d.rid) resetRunLocal();
      d.posts?.forEach((v, i) => { const p = caves.posts[i]; if (p && !!v !== p.lit) { p.setLit(!!v); if (v && area === 'caves') onPostLit(i); } });
      caves.setGate(!!d.gate); caves.setExit(!!d.bossDead);
      if (area === 'caves' && old) {
        if (d.waveOn && (!old.waveOn || old.wave !== d.wave)) { ui.banner(`Wave ${d.wave + 1} / 3`, 'Defend the Spore Garden!', 1800); audio.play('sfx_enemy_telegraph', { rate: 0.8 }); }
        if (!d.gate && old.gate) { ui.banner('The root gate opens!', 'Mossmaw\'s Den lies beyond…', 2600); audio.play('sfx_door_open'); }
      }
    }
    const run = { chests: new Set(), veins: new Map() };   // per dungeon run (resets with dun.rid)
    function resetRunLocal() { run.chests.clear(); run.veins.clear(); caves.chests.forEach(c => c.setOpen(false)); caves.veins.forEach(v => v.setState(false, false)); pickups.clear(); }

    // loot, kills, bosses
    function burstAt(x, z, cols, n = 20, y = 1) { particles.burst(V(x, y, z), cols, n, 3.5, { up: 4, size: 0.12, life: 0.8 }); }
    net.onEvent('slain', (p) => {
      if (!p) return; const d = DEF[p.t];
      if (area === p.a) { burstAt(p.x, p.z, ['#ffd27a', '#ff9a3c', '#ffffff', d?.kind === 'moth' ? '#b07aff' : '#4ff0d0'], 26); if (near(p.x, p.z)) audio.play(ENEMY_SFX[p.t]?.death || 'sfx_enemy_poof', { rate: ENEMY_SFX[p.t]?.rate || 1 }); }
      if (area !== p.a || !near(p.x, p.z, 45) || !d) return;
      const rng = mulberry32((p.s ^ strHash(me())) >>> 0), n = d.embers[0] + Math.floor(rng() * (d.embers[1] - d.embers[0] + 1));
      const orbs = Math.min(5, n); for (let i = 0; i < orbs; i++) pickups.spawn('ember', p.x, p.z, Math.floor(n / orbs) + (i < n % orbs ? 1 : 0));
      if (rng() < d.glowcap) pickups.spawn('glowcap', p.x, p.z, 1);
      if (d.mote) pickups.spawn('mote', p.x, p.z, 25);
      audio.play('sfx_loot_drop', { minGap: 0.1, gain: 0.7 });
      save.stats.kills++; quests.emit(`kill:${p.t}`); markDirty();
    });
    net.onEvent('phase', (p) => { if (p?.a !== area) return; audio.play(ENEMY_SFX.boss.phase); setTimeout(() => { if (!disposed && area === p.a) { ui.banner('The den goes dark!', 'FLARE the glowing spore sacs to stun Mossmaw', 3200); shake = 0.6; } }, Math.max(0, (p.at || net.now()) - net.now())); });
    net.onEvent('sac', (p) => { if (p?.a !== area) return; const s = caves.sacs[p.i]; if (s) { burstAt(s.x, s.z, ['#fff08a', '#ffd23a', '#ffffff'], 40, 2.4); audio.play('sfx_spore_burst'); } ui.banner('Mossmaw is stunned!', 'Strike now!', 1600); });
    net.onEvent('bossDown', (p) => {
      if (p?.a !== area || area !== 'caves') return; const [bx, bz] = CAVE.den.boss;
      audio.play(ENEMY_SFX.boss.defeat); shake = 0.8; burstAt(bx, bz, ['#ff8fd0', '#ffd27a', '#ffffff', '#9dff7a'], 120, 3);
      for (let i = 0; i < 12; i++) pickups.spawn('ember', bx, bz + 4, 10);
      pickups.spawn('sigil', bx, bz + 4, 1);
      const first = !save.bosses.mossmaw; save.bosses.mossmaw++; quests.emit('boss:mossmaw');
      if (!save.unlocked.includes('mine')) save.unlocked.push('mine');
      const bb = awardBB('boss_mossmaw'); saveNow();
      ui.banner('Mother Mossmaw falls!', 'The Glowroot Caves breathe easy', 3000);
      setTimeout(() => { if (disposed) return; openResult('🌸', 'Mother Mossmaw defeated!', `${first ? 'First victory! ' : ''}Grab the embers and the Boss Sigil, then take the Hearthward portal home.`,
        [['🔥', '120 embers'], ['🔱', 'Boss Sigil'], ...(bb ? [['💎', `${bb} Birg Bucks`]] : []), ...(first ? [['🗺️', 'Sunken Mine unsealed']] : [])]); }, 2600);
    });

    // ---------- area travel ----------
    let traveling = false;
    function applyLook(a) {
      const L = LOOKS[a] || LOOKS.village; scene.background.set(L.bg); scene.fog.color.set(L.fog[0]); scene.fog.near = L.fog[1]; scene.fog.far = L.fog[2];
      hemi.color.set(L.hemi[0]); hemi.groundColor.set(L.hemi[1]); hemi.intensity = L.hemi[2]; hemi.userData.base = L.hemi[2]; moon.color.set(L.moon[0]); moon.intensity = L.moon[1];
      renderer.toneMappingExposure = L.exposure; sky.mesh.visible = L.sky; snow.points.visible = a === 'village';
      village.group.visible = a === 'village'; caves.group.visible = a === 'caves';
      Object.assign(collision.bounds, AREAS[a].bounds);
    }
    function enterArea(a, pos, facing) {
      const fromVillage = area === 'village'; area = a; applyLook(a); player.teleport(pos, facing); player.vel.set(0, 0, 0);
      audio.setArea(a); ui.setArea(AREAS[a].name); ui.banner(AREAS[a].name, a === 'village' ? 'Warm hearths, safe paths' : 'Glowing roots… and things that hate the light', 2600);
      telegraphs.clear(); pending.clear(); pickups.clear(); announce(true);
      if (a === 'village' && carried) { save.embers += carried; ui.toast(`🔥 Banked <b>${carried}</b> embers`); carried = 0; saveNow(); }
      if (a === 'caves' && fromVillage && save.wisp?.area === 'caves') ui.toast('✨ Your Ember Wisp is still glowing somewhere in the caves…');
    }
    function travel(a) {
      if (traveling || !BUILT_AREAS.includes(a)) return; traveling = true; ui.closeModal(); ui.fade(true); audio.play('sfx_waystone_travel');
      setTimeout(() => {
        if (disposed) return;
        if (a === 'village') enterArea('village', V(0, 0, -25.5), 0 + Math.PI);
        else enterArea('caves', V(...CAVE.arrive), CAVE.arriveFacing);
        combat.reset(true); setTimeout(() => { ui.fade(false); traveling = false; }, 250);
      }, 480);
    }

    // ---------- interactions ----------
    let reviveHold = 0;
    function interactables() { return area === 'village' ? village.interactables : area === 'caves' ? caves.interactables : []; }
    function nearestInteractable() {
      let best = null, bd = Infinity;
      for (const it of interactables()) { const d = Math.hypot(player.pos.x - it.x, player.pos.z - it.z); if (d < it.r && d < bd) { bd = d; best = it; } }
      return best;
    }
    function downedAllyNear() {
      for (const n of net.nearby(5000)) { const pi = party.get(n.id); if (pi?.dn && Math.hypot(n.position.x - player.pos.x, n.position.z - player.pos.z) < 2.4) return { id: n.id, name: pi.name || n.name }; }
      return null;
    }
    function promptFor(it) {
      if (it.kind === 'post') { const p = caves.posts.find(x => x.id === it.id); return p?.lit ? `Rest · refill glow & bank embers` : `Light the ${it.name}`; }
      if (it.kind === 'chest') { const c = caves.chests.find(x => x.id === it.id); if (run.chests.has(it.id)) return null; if (c.needsWaves && (dun.caves?.wave || 0) < 3) return 'Sealed by roots… clear the Spore Garden'; return 'Open the chest'; }
      if (it.kind === 'vein') { const v = run.veins.get(it.id); return v?.mined ? null : v?.revealed ? 'Mine the ember vein' : null; }
      if (it.id === 'hearth') return `Rekindle · Great Hearth (tier ${save.hearth}/5)`;
      const npc = NPC_NAMES[it.id]; if (npc) { const r = quests.readyCount(it.id), av = quests.availableCount(it.id); return `${it.verb} · ${it.name}${r ? ' · ✔ quest ready' : av ? ' · ❗ new quest' : ''}`; }
      return `${it.verb} · ${it.name}`;
    }
    function interact(it) {
      if (NPC_NAMES[it.id]) { audio.play('sfx_npc_talk'); return openGiver(it.id); }
      if (it.id === 'hearth') { audio.play('sfx_ui_open'); return openHearth(); }
      if (it.id === 'waystone') { if (area === 'caves') return travel('village'); audio.play('sfx_ui_open'); return openWaystone(); }
      if (it.id === 'exit') return travel('village');
      if (it.kind === 'post') return usePost(it.id);
      if (it.kind === 'chest') return openChest(it.id);
      if (it.kind === 'vein') return mineVein(it.id);
    }
    function usePost(id) {
      const i = caves.posts.findIndex(p => p.id === id), p = caves.posts[i];
      if (!p.lit) { net.sendEvent('light', { a: 'caves', i }); p.setLit(true); onPostLit(i, true); }
      else { combat.glow = stats().glow; combat.heal(2); const b = Math.floor(carried * POST_BANK); if (b) { carried -= b; save.embers += b; ui.toast(`🔥 Banked <b>${b}</b> embers at the lamp post`); saveNow(); } audio.play('sfx_lantern_refill'); }
    }
    function onPostLit(i, mine = false) {
      const p = caves.posts[i]; save.posts.caves = p.id; burstAt(p.x, p.z, ['#ffd27a', '#ff9a3c', '#ffffff'], 30, 3.4);
      audio.play('sfx_lamppost_light', { minGap: 0.3 }); combat.glow = stats().glow; combat.heal(2);
      const b = Math.floor(carried * POST_BANK); if (b) { carried -= b; save.embers += b; }
      ui.toast(`🏮 ${esc(p.name)} lamp post lit${b ? ` · banked <b>${b}</b> 🔥` : ''}`); quests.emit('light:caves'); saveNow(); void mine;
    }
    function openChest(id) {
      const c = caves.chests.find(x => x.id === id); if (run.chests.has(id) || (c.needsWaves && (dun.caves?.wave || 0) < 3)) return;
      run.chests.add(id); c.setOpen(true); audio.play('sfx_chest_open'); burstAt(c.x, c.z, ['#ffd27a', '#ffffff', '#ff9a3c'], 30, 1.2);
      const first = !save.chests.includes(id);
      if (first) { save.chests.push(id); for (let i = 0; i < 6; i++) pickups.spawn('ember', c.x, c.z, 10); for (let i = 0; i < 3; i++) pickups.spawn('glowcap', c.x, c.z, 1); save.tonics = Math.min(tonicMax(save), save.tonics + 1); ui.toast('🎁 Treasure! 60 🔥, 3 🍄 and a 🧪 tonic'); }
      else { for (let i = 0; i < 3; i++) pickups.spawn('ember', c.x, c.z, 4); ui.toast('🎁 A few embers left behind'); }
      markDirty();
    }
    function mineVein(id) {
      const v = run.veins.get(id); if (!v?.revealed || v.mined) return; v.mined = true; const rec = caves.veins.find(x => x.id === id); rec.setState(true, true);
      for (let i = 0; i < 5; i++) pickups.spawn('ember', rec.x, rec.z, 3); audio.play('sfx_hit_crit', { rate: 0.8 }); burstAt(rec.x, rec.z, ['#ff9a3c', '#ffd27a'], 30, 1);
    }
    function revealVeins() {
      const r = combat.radius;
      for (const v of caves.veins) { const st = run.veins.get(v.id) || {}; if (st.revealed || Math.hypot(v.x - player.pos.x, v.z - player.pos.z) > r) continue;
        st.revealed = true; run.veins.set(v.id, st); v.setState(true, false); audio.play('sfx_vein_reveal'); burstAt(v.x, v.z, ['#ff9a3c', '#ffd27a', '#ffffff'], 24, 1.2);
        if (!save.veins.includes(v.id)) { save.veins.push(v.id); quests.emit('reveal:vein'); ui.toast('✨ A hidden ember vein!'); markDirty(); } }
    }
    function useTonic() {
      if (combat.down || save.tonics <= 0 || combat.hp >= combat.maxHp) { if (save.tonics <= 0) audio.play('sfx_ui_error'); return; }
      save.tonics--; combat.heal(TONIC.heal); burstAt(player.pos.x, player.pos.z, ['#9dffb0', '#ffffff'], 18, 1.4); announceSoon(); markDirty();
    }

    // ---------- modals ----------
    function questCards(entries) {
      return entries.map(({ q, st, why, r }) => {
        const act = st === 'available' ? `<button class="lh-btn" data-act="accept" data-v="${q.id}">Accept</button>` : st === 'ready' ? `<button class="lh-btn go" data-act="turnin" data-v="${q.id}">Turn in</button>` : '';
        const prog = (st === 'active' || st === 'ready') ? `<div class="lh-pbar"><b style="width:${Math.min(100, (r?.p || 0) / q.goal * 100)}%"></b></div><div class="meta">${r?.p || 0} / ${q.goal}</div>` : '';
        return `<div class="lh-card ${st}"><div class="ic">${st === 'done' ? '✅' : st === 'locked' ? '🔒' : st === 'ready' ? '🌟' : '📜'}</div><div class="mid"><h4>${esc(q.title)}</h4><div class="d">${esc(st === 'locked' ? why : q.desc)}</div>${prog}<div>${st !== 'done' ? rewardChips(q.reward) : ''}</div></div>${act}</div>`; }).join('');
    }
    function upgradeCard(track) {
      const U = UPGRADES[track], lv = save.up[track], cur = U.stat(lv), nxt = lv < 5 ? U.stat(lv + 1) : null, cost = lv < 5 ? U.cost[lv] : null;
      const line = { blade: (a, b) => `Damage ${a.damage}${b ? ` → <b>${b.damage}</b>` : ''}`, lantern: (a, b) => `Light ${a.radius} m · Glow ${a.glow}${b ? ` → <b>${b.radius} m · ${b.glow}</b>` : ''}`,
        hearts: (a, b) => `${a.hearts} hearts${b ? ` → <b>${b.hearts}</b>` : ''}`, dash: (a, b) => `Cooldown ${a.cooldown}s · ${a.charges} charge${a.charges > 1 ? 's' : ''}${b ? ` → <b>${b.cooldown}s · ${b.charges}</b>` : ''}` }[track](cur, nxt);
      const note = { blade: lv < 2 ? 'Level 3: wider spin finisher' : '', dash: lv < 3 ? 'Level 3: second dash charge' : '', lantern: 'Bigger light = moths & shades stay hittable', hearts: '' }[track];
      return `<div class="lh-card"><div class="ic">${U.icon}</div><div class="mid"><h4>${U.name}</h4><div class="lh-pips">${[1, 2, 3, 4, 5].map(i => `<i class="${i <= lv ? 'on' : ''}"></i>`).join('')}</div><div class="d">${line}${note ? ` <span style="opacity:.7">· ${note}</span>` : ''}</div><div>${cost ? costChips(cost, save) : '<span class="lh-chip ok">MAX</span>'}</div></div>${cost ? `<button class="lh-btn" data-act="upgrade" data-v="${track}" ${canAfford(save, cost) ? '' : 'disabled'}>Upgrade</button>` : ''}</div>`;
    }
    function openGiver(giver) {
      const tracks = { brann: ['blade', 'dash'], ysolde: ['lantern'], moss: ['hearts'] }[giver] || [];
      let body = `<p class="lh-say">“${esc(NPC_LINES[giver])}”</p>`;
      if (tracks.length) body += `<h4 style="margin:4px 0 8px;color:#ffcf8a">Upgrades</h4>${tracks.map(upgradeCard).join('')}`;
      if (giver === 'moss') { const mx = tonicMax(save); body += `<div class="lh-card"><div class="ic">🧪</div><div class="mid"><h4>Glowberry Tonic</h4><div class="d">Heals ${TONIC.heal / 2} hearts (R / 🧪). Carry up to ${mx}. You have ${save.tonics}.</div><div>${costChips({ embers: TONIC.price }, save)}</div></div><button class="lh-btn" data-act="tonic" ${save.tonics >= mx || save.embers < TONIC.price ? 'disabled' : ''}>Buy</button></div>`; }
      const qs = quests.forGiver(giver).filter(e => e.st !== 'locked' || giver === 'wick' || giver === 'board');
      if (qs.length) body += `<h4 style="margin:12px 0 8px;color:#ffcf8a">Quests</h4>${questCards(qs)}`;
      ui.modal(ICON[giver], NPC_NAMES[giver], giver === 'board' ? 'Bounties & odd jobs' : `${save.embers} 🔥 banked`, body, { kind: 'giver', id: giver });
    }
    function openHearth() {
      const t = save.hearth, cost = HEARTH_TIERS[t], perks = ['Carry one more tonic', 'Lamp posts bank more (soon)', 'Unseals the Aurora Throne road (Phase 3)', 'Third charm slot (soon)', 'The aurora returns over the village'];
      const body = `<p class="lh-say">The great flame crackles hungrily. Each tier warms the whole Hollow.</p>
        <div class="lh-card"><div class="ic">🔥</div><div class="mid"><h4>Tier ${t} / 5</h4><div class="lh-pips">${[1, 2, 3, 4, 5].map(i => `<i class="${i <= t ? 'on' : ''}"></i>`).join('')}</div>
        ${cost ? `<div class="d">Next: <b>${perks[t]}</b></div><div class="lh-pbar"><b style="width:${Math.min(100, save.embers / cost * 100)}%"></b></div><div class="meta">${save.embers} / ${cost} 🔥</div>` : '<div class="d">The Hearth burns at full glory!</div>'}</div>
        ${cost ? `<button class="lh-btn" data-act="rekindle" ${save.embers >= cost ? '' : 'disabled'}>Feed ${cost} 🔥</button>` : ''}</div>
        ${perks.map((p, i) => `<div class="d" style="margin:4px 0;opacity:${i < t ? 1 : 0.6}">${i < t ? '✅' : '▫️'} Tier ${i + 1}: ${p}</div>`).join('')}`;
      ui.modal('🔥', 'Great Hearth Lantern', 'Rekindle the Hollow', body, { kind: 'hearth' });
    }
    function openWaystone() {
      const card = (id, icon, desc) => { const A = AREAS[id], here = area === id, built = BUILT_AREAS.includes(id), open = save.unlocked.includes(id) && built, pw = stats().power;
        const why = !save.unlocked.includes(id) ? (id === 'mine' ? 'Defeat Mother Mossmaw' : 'Defeat the Drowned Foreman · Hearth tier 3') : !built ? 'Opens in a later update' : '';
        return `<div class="lh-card ${open || id === 'village' ? '' : 'locked'}"><div class="ic">${icon}</div><div class="mid"><h4>${A.name}</h4><div class="d">${desc}</div><div class="meta">${id === 'village' ? 'Safe hub' : `Recommended Power ${A.power}+ · you: ${pw}`}${why ? ` · 🔒 ${why}` : ''}</div></div>
          ${here ? '<span class="lh-chip">You are here</span>' : (open || id === 'village') ? `<button class="lh-btn alt" data-act="travel" data-v="${id}">Travel</button>` : ''}</div>`; };
      ui.modal('🌀', 'Waystone', 'Where will the light go next?', card('village', '🏘️', 'Frostlight Village: quests, forge, hearth.') + card('caves', '🍄', 'Bioluminescent caverns, slimes, spores and the Mother Root.') + card('mine', '⛏️', 'A flooded crystal mine. Rust Golems and the Drowned Foreman.') + card('throne', '👑', 'Floating ice terraces under a stolen aurora.'), { kind: 'waystone' });
    }
    function openJournal() {
      const act = QUESTS.map(q => ({ q, ...quests.status(q), r: save.quests[q.id] })).filter(e => e.st === 'active' || e.st === 'ready');
      const done = QUESTS.filter(q => save.quests[q.id]?.turnedIn).length;
      const body = (act.length ? questCards(act).replace(/<button[^>]*data-act="turnin"[^>]*>Turn in<\/button>/g, '<span class="lh-chip ok">Return to giver</span>') : '<p class="lh-say">No active quests. Visit Elder Wick and the Quest Board in the village.</p>')
        + `<div class="meta" style="margin-top:10px">Completed ${done} / ${QUESTS.length} · Kills ${save.stats.kills} · Revives ${save.stats.revives} · Veins ${save.veins.length}/5</div>`;
      ui.modal('📜', 'Quest Journal', `${act.length} active`, body, { kind: 'journal' });
    }
    function openParty() {
      const rows = net.players().map(p => { const pi = p.id === me() ? selfRecord() : party.get(p.id) || {}; return `<div class="lh-card ${pi.dn ? 'locked' : ''}"><div class="ic">${pi.dn ? '💀' : '🏮'}</div><div class="mid"><h4>${esc(pi.name || p.name)}${p.isHost ? ' <span class="lh-chip">host</span>' : ''}${p.id === me() ? ' <span class="lh-chip">you</span>' : ''}</h4><div class="d">${esc(AREAS[pi.a]?.name || '…')} · Power ${pi.pw || '?'} · ${pi.hp != null ? `${(pi.hp / 2).toFixed(1)}/${(pi.mhp || 6) / 2} ❤` : ''}</div></div></div>`; }).join('');
      ui.modal('👥', 'Party', `${net.players().length} in this server · ${net.online ? 'online' : 'solo'}`, rows + '<p class="d" style="opacity:.75;margin-top:8px">Everyone in the server shares dungeon progress. Loot is personal, so helping friends always pays. Downed friends can be revived by holding ✋/E next to them.</p>', { kind: 'party' });
    }
    function openResult(icon, title, sub, loot) { ui.modal(icon, title, '', `<div class="lh-res"><p class="lh-say">${esc(sub)}</p><div class="loot">${loot.map(([i, t]) => `<span class="lh-chip">${i} ${esc(t)}</span>`).join('')}</div><button class="lh-btn" data-act="close">Onward</button></div>`, { kind: 'result' }); audio.play('sfx_quest_complete'); }
    function refreshModal() { const t = ui.modalTag; if (!t) return; if (t.kind === 'giver') openGiver(t.id); else if (t.kind === 'hearth') openHearth(); }
    function onAct(a, v) {
      audio.play('sfx_ui_click');
      if (a === 'journal') return ui.modalTag?.kind === 'journal' ? ui.closeModal() : openJournal();
      if (a === 'party') return ui.modalTag?.kind === 'party' ? ui.closeModal() : openParty();
      if (a === 'accept') { if (quests.accept(v)) { audio.play('sfx_quest_accept'); ui.toast(`📜 Accepted <b>${esc(QUESTS.find(q => q.id === v).title)}</b>`); saveNow(); } }
      if (a === 'turnin') quests.turnIn(v);
      if (a === 'upgrade') { const U = UPGRADES[v], lv = save.up[v], cost = U.cost[lv]; if (lv < 5 && canAfford(save, cost)) { pay(save, cost); save.up[v]++; audio.play(v === 'lantern' ? 'sfx_upgrade_lantern' : 'sfx_upgrade_forge'); ui.toast(`${U.icon} ${U.name} → level ${save.up[v]}!`); if (v === 'hearts') combat.hp += 2; burstAt(player.pos.x, player.pos.z, ['#ffd27a', '#ff9a3c', '#ffffff'], 30, 1.5); announce(true); saveNow(); } else audio.play('sfx_ui_error'); }
      if (a === 'tonic') { if (save.embers >= TONIC.price && save.tonics < tonicMax(save)) { save.embers -= TONIC.price; save.tonics++; audio.play('sfx_purchase'); saveNow(); } else audio.play('sfx_ui_error'); }
      if (a === 'rekindle') { const c = HEARTH_TIERS[save.hearth]; if (c && save.embers >= c) { save.embers -= c; save.hearth++; audio.play('sfx_hearth_rekindle'); quests.emit('hearth', 0); ui.banner('The Hearth roars!', `Tier ${save.hearth} · the Hollow grows warmer`, 2600); burstAt(0, 0, ['#ffd27a', '#ff9a3c', '#ffffff', '#ff6a3a'], 80, 4); village.hearthLight.intensity = 60 + save.hearth * 12; saveNow(); } }
      if (a === 'travel') return travel(v);
      refreshModal();
    }

    // ---------- combat hooks ----------
    function hitTargets() {
      const out = [];
      if (area === 'village') village.dummies.forEach((d, i) => out.push({ id: `d${i}`, kind: 'dummy', x: d.x, z: d.z, r: 0.5, hittable: true }));
      for (const r of renderList()) { const d = DEF[r.type]; const lit = r.lit || Math.hypot(r.x - player.pos.x, r.z - player.pos.z) < combat.radius;
        out.push({ id: r.id, kind: 'enemy', x: r.x, z: r.z, r: d.r, hittable: r.st !== ST.burrowed && (!d.shadow || lit), shadow: d.shadow }); }
      const b = boss.caves; if (area === 'caves' && b && !b.dead) out.push({ id: 'boss', kind: 'boss', x: bossCircle.x, z: bossCircle.z, r: 3.0, hittable: true });
      return out;
    }
    function inSharedLight() { // lamp-post glow or overlap with an ally's lantern
      if (area === 'caves' && caves.posts.some(p => p.lit && Math.hypot(p.x - player.pos.x, p.z - player.pos.z) < 6)) return true;
      return net.nearby(5000).some(n => { const pi = party.get(n.id); return pi && !pi.dn && Math.hypot(n.position.x - player.pos.x, n.position.z - player.pos.z) < combat.radius + (pi.r || 6) * 0.6; });
    }
    function onHits(hits, info) {
      let total = 0;
      for (const { t, dmg, crit } of hits) {
        const [sx, sy] = toScreen(t.x, 2.2, t.z); ui.float(String(dmg), sx, sy, crit ? 'crit' : '');
        particles.burst(V(t.x, 1.1, t.z), ['#ffffff', '#ffd27a', t.kind === 'boss' ? '#ff8fd0' : '#7ff0d0'], 8, 3, { up: 2, size: 0.09, life: 0.4 });
        if (t.kind === 'dummy') { village.dummies[+t.id.slice(1)].wob = 1; continue; }
        total += dmg;
        if (t.kind === 'boss') { mossmaw.flash(); bossHitQ += dmg; } else { views.flash(t.id); hitQueue.push([t.id, dmg]); }
      }
      audio.play(hits.some(h => h.crit) ? 'sfx_hit_crit' : `sfx_hit_${1 + Math.floor(Math.random() * 3)}`, { rate: 0.95 + Math.random() * 0.1 });
      if (hits.some(h => h.t.kind !== 'dummy')) audio.play('sfx_enemy_hurt', { gain: 0.6, rate: 0.9 + Math.random() * 0.2, minGap: 0.08 });
      if (total && inSharedLight()) { save.kindredDmg += total; while (save.kindredDmg >= 150) { save.kindredDmg -= 150; quests.emit('kindred'); } }
      shake = Math.max(shake, 0.08); void info;
    }
    function flushHits() {
      if (!hitQueue.length && !bossHitQ && sacQ == null) return;
      net.sendEvent('hit', { a: area, h: hitQueue.splice(0, 16), b: Math.round(bossHitQ) || undefined, s: sacQ ?? undefined, fl: combat.flaring ? 1 : 0, x: +player.pos.x.toFixed(1), z: +player.pos.z.toFixed(1) });
      bossHitQ = 0; sacQ = null;
    }
    let flareTick = 0;
    function flareEffects(dt) {
      if (!combat.flaring) { flareTick = 0; return; }
      flareTick -= dt; if (flareTick > 0) return; flareTick = 0.5;
      const r = combat.radius;
      for (const e of renderList()) { const d = DEF[e.type]; if (d.shadow && Math.hypot(e.x - player.pos.x, e.z - player.pos.z) < r) { hitQueue.push([e.id, 6]); views.flash(e.id); const [sx, sy] = toScreen(e.x, 2.4, e.z); ui.float('6🔥', sx, sy, 'gain'); } }
      const b = boss.caves; if (area === 'caves' && b && b.ph === 2 && net.now() >= (b.phAt || 0)) caves.sacs.forEach((s, i) => { if (b.sacs?.[i] && sacQ == null && Math.hypot(s.x - player.pos.x, s.z - player.pos.z) < Math.max(3.5, r * 0.6)) sacQ = i; });
      if (area === 'caves') revealVeins();
    }

    // ---------- render records + damage resolution ----------
    function renderList() {
      if (area !== 'caves') return [];
      if (net.isHost()) { const sim = sims.caves; return sim ? sim.list.map(e => ({ id: e.id, type: e.type, x: e.x, z: e.z, hpPct: e.hp / e.maxHp * 100, st: e.st, lit: e.lit, atkAt: e.atkAt, ax: e.ax, az: e.az, facing: e.facing, dir: e.dir })) : []; }
      return [...interp.values()];
    }
    const pending = new Map();   // attack key -> { s, t1, dmg, slow, id, src, bossAt }
    function scheduleAttacks(recs, b, now) {
      const add = (sh, src, id) => { if (pending.has(sh.key) || now > sh.t1 + 150) return; pending.set(sh.key, { ...sh, src, id, t0: sh.t0 });
        const dist = Math.hypot(sh.s.x - player.pos.x, sh.s.z - player.pos.z);
        if (dist < 24) { const win = (sh.t1 - now) / 1000; if (src === 'enemy') { audio.telegraph(win, 0.8); const E = ENEMY_SFX[recs.find(r => r.id === id)?.type]; if (E) pending.get(sh.key).sfx = { name: E.attack, at: E.atImpact ? sh.t1 : sh.t0 + DEF[recs.find(r => r.id === id).type].windup * 1000, rate: E.rate || 1 }; }
          else { if (sh.key.endsWith(':0') || !sh.key.includes(':', 3)) audio.telegraph(Math.min(1, win), 1); pending.get(sh.key).sfx = { name: sh.key.startsWith('b1') || sh.key.startsWith('b2') ? ENEMY_SFX.boss.slam : 'sfx_spore_burst', at: sh.t1, rate: sh.key.startsWith('b2') ? 1.2 : 1 }; } } };
      for (const r of recs) for (const sh of enemyShapes(r)) add(sh, 'enemy', r.id);
      if (b && area === 'caves') for (const sh of bossShapes(b, CAVE.den.boss)) add(sh, 'boss', null);
      if (b?.atk === 3 && b.atkAt && !pending.has(`b3:${b.atkAt}`)) { pending.set(`b3:${b.atkAt}`, { key: `b3:${b.atkAt}`, s: null, t1: b.atkAt, src: 'roar' }); audio.play(ENEMY_SFX.boss.roar); }
    }
    function resolveAttacks(recs, b, now) {
      const alive = new Set(recs.map(r => r.id));
      for (const [k, a] of pending) {
        if (a.src === 'enemy' && !alive.has(a.id) && now < a.t1) { pending.delete(k); telegraphs.clear(k); continue; }
        if (a.src === 'boss' && (!b || b.dead || (b.stunUntil > now && now < a.t1))) { pending.delete(k); continue; }
        if (a.s) telegraphs.show(k, a.s, a.t0 / 1000, a.t1 / 1000);
        if (a.sfx && now >= a.sfx.at) { audio.play(a.sfx.name, { rate: a.sfx.rate, minGap: 0.05 }); a.sfx = null; }
        if (now >= a.t1) {
          if (a.s && !a.done) { a.done = true;
            if (inShape(a.s, player.pos.x, player.pos.z) && player.pos.y < 2.2) combat.takeDamage(a.dmg, { slow: a.slow });
            if (a.src === 'boss' && (k.startsWith('b1') || k.startsWith('b2'))) { shake = Math.max(shake, 0.25); particles.burst(V(a.s.x, 0.3, a.s.z), ['#9dff7a', '#5a3a26'], 14, 4, { up: 3, size: 0.14 }); }
            if (DEF[recs.find(r => r.id === a.id)?.type]?.kind === 'spore') particles.burst(V(a.s.x, 1, a.s.z), ['#e8a0ff', '#fff08a', '#c86bd8'], 30, 4, { up: 1.5, size: 0.12, life: 1.1, grav: 0.5, drag: 2 }); }
          if (now > a.t1 + 400) pending.delete(k);
        }
      }
    }
    function smoothClients(dt) {
      for (const r of interp.values()) { const k = Math.min(1, dt * (r.st === ST.strike ? 14 : 8)); r.x += (r.tx - r.x) * k; r.z += (r.tz - r.z) * k; }
    }

    // ---------- host tick ----------
    function hostTick(dt) {
      if (!net.isHost()) return;
      const a = 'caves', targets = playersIn(a);
      if (targets.length) ensureSim(a);
      const sim = sims[a]; if (!sim) return;
      if (!targets.length) { emptyT[a] = (emptyT[a] || 0) + dt; if (emptyT[a] > 60 && (sim.list.length || sim.dun.posts.some(Boolean) || sim.dun.wave || sim.dun.bossDead)) { sim.reset(); emptyT[a] = 0; } }
      else { emptyT[a] = 0; sim.step(dt, targets); }
      publishT -= dt;
      if (publishT <= 0) { publishT = 0.2;
        if (sim.dirty || sim.list.length) { net.setState(`en.${a}`, packEnemies(sim.list, net.now())); sim.dirty = false; }
        if (sim.bossDirty) { net.setState(`boss.${a}`, sim.packBoss()); sim.bossDirty = false; } }
    }

    // ---------- ghosts for QA transports (platform draws real avatars) + downed markers ----------
    const ghosts = new Map();
    const ghostMat = new THREE.MeshStandardMaterial({ color: '#9fb8ff', emissive: '#3a5aaa', emissiveIntensity: 0.4, transparent: true, opacity: 0.85 });
    function updateGhosts(t) {
      const list = net.nearby(5000), seen = new Set();
      for (const n of list) { seen.add(n.id); let g = ghosts.get(n.id);
        if (!g) { g = new THREE.Group(); if (net.transport !== 'platform') { const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 1.2, 4, 10), ghostMat); body.position.y = 1.1; g.add(body); const l = makeLantern(mats, 1.3); l.position.set(0.5, 1.0, 0.2); g.add(l); }
          const ring = makeGlowDecal('#ff5a5a', 0); ring.scale.setScalar(1.6); ring.position.y = 0.08; g.add(ring); g.userData.ring = ring; scene.add(g); ghosts.set(n.id, g); }
        g.position.set(n.position.x, n.position.y || 0, n.position.z); const pi = party.get(n.id);
        g.userData.ring.material.opacity = pi?.dn ? 0.5 + Math.sin(t * 6) * 0.3 : 0; if (g.children[0]?.isMesh && g.children[0] !== g.userData.ring) g.children[0].rotation.z = pi?.dn ? Math.PI / 2 : 0; }
      for (const [id, g] of ghosts) if (!seen.has(id)) { scene.remove(g); ghosts.delete(id); }
    }

    // ---------- per-frame ----------
    let prevKeys = new Set(), stepT = 0, prevGround = true, poolT = 0, downT = 0, wispMesh = null;
    const pressed = (c) => taps.has(c) || (input.down(c) && !prevKeys.has(c));
    const held = (c) => input.down(c);
    function updateWisp(t) {
      const w = save.wisp, show = w && w.area === area;
      if (show && !wispMesh) { wispMesh = new THREE.Group(); const core = new THREE.Mesh(new THREE.SphereGeometry(0.35, 14, 10), new THREE.MeshBasicMaterial({ color: '#ffd27a', toneMapped: false })); core.position.y = 1.2; wispMesh.add(core); const gl = makeGlowDecal('#ffb347', 0.4); gl.scale.setScalar(2.2); gl.position.y = 0.08; wispMesh.add(gl); scene.add(wispMesh); }
      if (!show && wispMesh) { scene.remove(wispMesh); wispMesh = null; }
      if (!wispMesh) return; wispMesh.position.set(w.x, Math.sin(t * 2) * 0.2, w.z);
      if (Math.hypot(w.x - player.pos.x, w.z - player.pos.z) < 1.6) { carried += w.embers; ui.toast(`✨ Recovered your Ember Wisp: <b>+${w.embers}</b> 🔥`); audio.ember(); save.wisp = null; markDirty(); }
    }
    function gutter() {
      const lost = Math.floor(carried * CARRY_LOSS); if (lost > 0 && area !== 'village') { save.wisp = { area, x: +player.pos.x.toFixed(1), z: +player.pos.z.toFixed(1), embers: lost }; carried -= lost; }
      save.stats.deaths++; saveNow();
      const d = dun.caves, lit = d?.posts ? d.posts.map((v, i) => v ? i : -1).filter(i => i >= 0) : [];
      const post = area === 'caves' && lit.length ? CAVE.posts[lit[lit.length - 1]] : null;
      ui.fade(true);
      setTimeout(() => { if (disposed) return; if (area === 'caves') player.teleport(post ? V(post.x - 1.5, 0, post.z + 1.5) : V(...CAVE.arrive), CAVE.arriveFacing); else player.teleport(V(0, 0, 8), Math.PI);
        combat.reset(true); announce(true); ui.fade(false); ui.banner('Your lantern guttered…', lost ? `${lost} embers drifted away as an Ember Wisp. Go get them!` : 'Back at the last lamp post', 3000); }, 600);
    }

    const game = {
      scene, collision, occluders: village.occluders, spawn: V(...AREAS.village.spawn), spawnFacing: AREAS.village.facing, maxCamDist: 16,
      onFall: () => player.teleport(V(...AREAS[area].spawn), AREAS[area].facing),
      onClick: ({ button }) => { if (button === 0 && !ui.modalOpen && !traveling) taps.add('KeyK'); },
      update(dt, t) {
        audio.tick();
        const now = net.now(), modal = ui.modalOpen;
        player.enabled = !modal && !traveling; player.flying = false;
        // keys
        if (pressed('KeyJ')) onAct('journal'); if (pressed('KeyP')) onAct('party');
        if (pressed('Escape') && modal) ui.closeModal();
        // host simulation
        hostTick(dt); if (!net.isHost()) smoothClients(dt);
        const recs = renderList(), b = area === 'caves' ? boss.caves : null;
        // combat
        const targets = hitTargets();
        let regen = 1; if (area === 'caves' && caves.posts.some(p => p.lit && Math.hypot(p.x - player.pos.x, p.z - player.pos.z) < 6)) regen = 4; else if (inSharedLight()) regen = 2;
        if (!modal && !traveling) combat.update(dt, t, { pressed, held, targets, collision, regenMul: regen });
        flareEffects(dt);
        hitFlushT -= dt; if (hitFlushT <= 0) { hitFlushT = 0.25; flushHits(); }
        // telegraphs + own damage
        scheduleAttacks(recs, b, now); resolveAttacks(recs, b, now); telegraphs.update(now / 1000);
        // hazards: glow pools
        if (area === 'caves' && !combat.down && inPool(player.pos.x, player.pos.z) && !combat.dashing) { poolT -= dt; if (poolT <= 0) { poolT = 1; if (combat.takeDamage(1, { slow: 1.2 })) particles.burst(player.pos.clone().add(V(0, 0.3, 0)), ['#3ff0d0', '#ffffff'], 16, 2, { up: 3 }); } } else poolT = 0;
        // downed / gutter
        if (combat.down) {
          const allies = [...party.entries()].filter(([id, v]) => id !== me() && v.a === area && !v.dn && net.players().some(p => p.id === id));
          downT += dt; const limit = allies.length ? 20 : 2.4;
          ui.setDowned(true, allies.length ? `Hang on! ${allies.map(([, v]) => v.name).join(', ')} can revive you.` : 'No allies nearby…', Math.max(0, 1 - downT / limit));
          if (downT >= limit) { downT = 0; ui.setDowned(false); gutter(); }
        } else { downT = 0; ui.setDowned(false); }
        // interactions (E) + revive (hold E)
        const ally = !combat.down && !modal ? downedAllyNear() : null;
        if (ally) { if (held('KeyE')) { reviveHold += dt; if (reviveHold >= 2.5) { reviveHold = 0; net.sendEvent('revive', { t: ally.id }); } } else reviveHold = 0; ui.prompt(`Hold to revive ${ally.name}`, 'E', reviveHold > 0 ? reviveHold / 2.5 : null); }
        else { reviveHold = 0; const it = modal || combat.down ? null : nearestInteractable(); const txt = it ? promptFor(it) : null; ui.prompt(txt); if (txt && pressed('KeyE')) interact(it); }
        prevKeys = new Set(input.keys); taps.clear();
        // views
        const gone = views.update(recs, dt, t, now); for (const g of gone) { if (area === 'caves') burstAt(g.x, g.z, ['#ffd27a', '#ffffff'], 10); }
        mossmaw.update(area === 'caves' ? b : null, dt, t, now);
        if (b && !b.dead && area === 'caves') { if (!collision.circles.includes(bossCircle)) collision.circles.push(bossCircle); } else { const i = collision.circles.indexOf(bossCircle); if (i >= 0) collision.circles.splice(i, 1); }
        if (area === 'caves' && b) caves.setSacs(b.sacs || [1, 1, 1, 1]);
        // pickups
        for (const g of pickups.update(dt, t, player.pos, 3.5)) {
          if (g.kind === 'ember') { carried += g.value; audio.ember(); }
          else if (g.kind === 'glowcap') { save.mats.glowcap++; audio.play('sfx_material_pickup'); markDirty(); }
          else if (g.kind === 'mote') { combat.glow = Math.min(stats().glow, combat.glow + g.value); audio.play('sfx_lantern_refill', { gain: 0.6 }); }
          else if (g.kind === 'sigil') { save.mats.sigil++; audio.play('sfx_material_pickup', { rate: 0.7 }); ui.toast('🔱 Boss Sigil collected!'); markDirty(); } }
        updateWisp(t); updateGhosts(t);
        // lantern light + decals
        const s = stats(), r = combat.radius;
        handLantern.getWorldPosition(tmpV); lanternLight.position.copy(tmpV).add(V(0, 0.4, 0));
        const glowK = combat.glow <= 0 ? 0.45 : 1;
        lanternLight.intensity = (combat.flaring ? 34 : 16) * glowK * (1 + Math.sin(t * 9) * 0.04 + Math.sin(t * 17.3) * 0.03) * (combat.down ? 0.35 : 1); lanternLight.distance = r * 2.4;
        lightDecal.position.set(player.pos.x, player.pos.y + 0.06, player.pos.z); lightDecal.scale.setScalar(r); lightDecal.material.opacity = area === 'caves' ? 0.2 : 0.1;
        flareRing.position.set(player.pos.x, player.pos.y + 0.08, player.pos.z); flareRing.scale.setScalar(r); flareRing.material.opacity = combat.flaring ? 0.5 + Math.sin(t * 12) * 0.2 : 0;
        if (handLantern.userData.flame) { handLantern.userData.flame.scale.setScalar(combat.flaring ? 1.6 : 1); handLantern.userData.flame.scale.y = (combat.flaring ? 2.4 : 1.5) + Math.sin(t * 13) * 0.2; }
        if (armL && !combat.down) armL.rotation.x = (combat.flaring ? -2.4 : -0.45) + Math.sin(t * 2) * 0.03;
        // steps / jump / land
        const moving = Math.hypot(player.vel.x, player.vel.z) > 1 && player.onGround && !combat.dashing;
        if (moving) { stepT -= dt; if (stepT <= 0) { stepT = combat.down ? 0.6 : 0.32; audio.step(area === 'village' ? 'snow' : 'stone'); } } else stepT = 0.05;
        if (prevGround && !player.onGround && player.vel.y > 4) audio.play('sfx_jump', { gain: 0.7 });
        if (!prevGround && player.onGround) audio.play('sfx_land', { gain: 0.6 });
        prevGround = player.onGround;
        // world + lighting
        const p = player.pos;
        moon.position.set(p.x - 25, 45, p.z - 15); moon.target.position.set(p.x, 0, p.z);
        const ph2dark = area === 'caves' && b && !b.dead && b.ph === 2 && now >= (b.phAt || 0) ? (now < b.stunUntil ? 0.5 : 1) : 0;
        hemi.intensity += ((hemi.userData.base ?? 0.7) * (1 - ph2dark * 0.7) - hemi.intensity) * Math.min(1, dt * 2);
        lights.update(t, p, area);
        if (area === 'village') { sky.update(t, p); snow.update(dt, t, p); village.update(dt, t); }
        if (area === 'caves') caves.update(dt, t, { center: p, dark: ph2dark, sacPhase: !!(b && b.ph === 2 && !b.dead && now >= (b.phAt || 0)) });
        particles.update(dt);
        // music: boss loop while the den fight is on (falls back to the area loop until bgm_boss exists)
        const inDen = area === 'caves' && Math.hypot(p.x - CAVE.den.x, p.z - CAVE.den.z) < CAVE.den.r + 1;
        audio.setMusic(inDen && b && !b.dead ? 'bgm_boss' : `bgm_${area}`);
        // HUD
        ui.setVitals({ hp: combat.hp, maxHp: combat.maxHp, glow: combat.glow, maxGlow: s.glow, power: s.power, flaring: combat.flaring, dashCharges: combat.dash.charges, dashMax: s.charges, tonics: save.tonics, title: save.title });
        ui.setEmbers(save.embers, carried, save.mats);
        ui.setQuests(quests.tracked().map(({ q, r: qr }) => ({ title: q.title, p: qr?.p || 0, goal: q.goal, ready: !!qr?.done })), quests.readyCount() || '');
        ui.setBoss(area === 'caves' && b && !b.dead && inDen ? { name: BOSS.mossmaw.name, hp: b.hp, max: b.max, status: now < b.stunUntil ? '✨ STUNNED: strike now!' : b.ph === 2 ? 'Armoured · FLARE a glowing spore sac' : '' } : null);
        ui.setAllies([...party.entries()].filter(([id]) => id !== me() && net.players().some(x => x.id === id)).map(([, v]) => ({ name: v.name || '?', power: v.pw || 1, hpPct: v.mhp ? v.hp / v.mhp * 100 : 100, down: v.dn })));
        if (announcePending) announce(false);
        // camera shake
        if (shake > 0) { shake = Math.max(0, shake - dt * 1.6); camera.position.add(V((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake)); }
        // save
        save.stats.playMs += dt * 1000; saveT += dt;
        if ((dirty && saveT > 3) || saveT > 30) saveNow();
      },
      dispose() {
        disposed = true; saveNow();
        removeEventListener('keydown', blockF, true);
        { const l = input.listeners?.keydown; const i = l ? l.indexOf(onKey) : -1; if (i >= 0) l.splice(i, 1); }
        audio.stop(); ui.dispose(); combat.dispose(); net.dispose?.(); lights.dispose(); views.clear(); mossmaw.dispose();
        handLantern.removeFromParent();
        player.enabled = true; player.camPitch = prev.pitch; player.camDist = prev.dist;
        renderer.toneMappingExposure = prev.exposure; camera.far = prev.far; camera.updateProjectionMatrix();
        scene.traverse(o => { if (o === avatar.root || o.parent === avatar.root) return; o.geometry?.dispose?.(); if (o.material) [].concat(o.material).forEach(m => { m.map?.dispose?.(); m.dispose?.(); }); });
        if (engine.lanternHollow === hooks) delete engine.lanternHollow;
        if (window.__lh === hooks) delete window.__lh;
      },
    };

    // ---------- QA hooks (read-only + player-equivalent actions; cheats only with ?lhtest=1) ----------
    const hooks = engine.lanternHollow = {
      get area() { return area; }, get save() { return save; }, get carried() { return carried; }, get party() { return Object.fromEntries(party); },
      get me() { return { hp: combat.hp, maxHp: combat.maxHp, glow: combat.glow, down: !!combat.down, flaring: combat.flaring, radius: combat.radius }; },
      get isHost() { return net.isHost(); }, get transport() { return net.transport; }, get enemies() { return renderList(); }, get boss() { return boss.caves; }, get dun() { return dun.caves; },
      get sfx() { return audio.loaded; }, get interactable() { return nearestInteractable()?.id || null; }, get modal() { return ui.modalTag; }, get pending() { return pending.size; },
      player, collision, travel, openWaystone, openJournal, CAVE,
    };
    if (testMode) Object.assign(hooks, {
      warpTo(x, z, facing = 0) { player.teleport(V(x, 0, z), facing); const a = areaAt(x, z); if (a && a !== area) { area = a; applyLook(a); audio.setArea(a); } },
      give(o) { for (const [k, v] of Object.entries(o)) { if (k === 'embers') save.embers += v; else if (k in save.mats) save.mats[k] += v; else if (k === 'carried') carried += v; } markDirty(); },
      setSave(o) { save = normalizeSave({ ...save, ...o }); },
      damageAll(n = 999) { if (!net.isHost()) return; const sim = sims.caves; for (const e of [...(sim?.list || [])]) sim.applyHit(e.id, n, { flare: 1 }); },
      damageBoss(n) { sims.caves?.hitBoss(n); }, burstSac(i) { sims.caves?.hitBoss(0, { sac: i }); },
      hurt(n) { combat.iframes = 0; return combat.takeDamage(n); }, press(code) { taps.add(code); },
      addAlly(o = {}) { const f = net.addFake?.({ id: o.id || 'Pip', name: o.name || 'Pip', position: { x: player.pos.x + 1.5, y: 0, z: player.pos.z }, down: !!o.down }); if (!f) return null;
        net.fakeEvent(f.id, 'at', { a: area, hp: o.down ? 0 : 6, mhp: 6, pw: 3, dn: !!o.down, r: 6, name: f.name }); return f.id; },
      allyDown(id, down = true) { const f = net.fakes?.find(x => x.id === id); if (f) { f.down = down; net.fakeEvent(id, 'at', { a: area, hp: down ? 0 : 6, mhp: 6, pw: 3, dn: down, r: 6, name: f.name }); } },
      allyRevivesMe(id) { const f = net.fakes?.find(x => x.id === id); if (!f) return; f.position = { x: player.pos.x + 1, y: 0, z: player.pos.z }; net.fakeEvent(id, 'revive', { t: me() }); },
      sims, net,
    });
    if (testMode) window.__lh = hooks;

    // ---------- start ----------
    applyLook('village'); ui.setArea(AREAS.village.name); audio.setArea('village');
    ui.banner(AREAS.village.name, save.quests.lh_q_first_light ? 'Welcome back, light-bearer' : 'Elder Wick is waiting by the Quest Board', 3200);
    if (!save.quests.lh_q_first_light && !save.tracked.length) ui.toast('❗ Talk to <b>Elder Wick</b> (by the Quest Board) to begin', 5000);
    announce(true);
    return game;
  },
};
