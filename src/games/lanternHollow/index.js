// Game: Lantern Hollow — co-op action RPG / dungeon adventure (GM1, final Iceberg batch). NOT published.
// Loop: explore > fight > loot embers/materials > return to Frostlight Village > upgrade > take harder quests.
// Areas (one shared coordinate space, areas.js): Frostlight Village (hub), Glowroot Caves, Sunken Mine, Aurora Throne.
// Multiplayer (brief §9): host simulates enemies/boss/dungeon per occupied area (enemies.js AreaSim) and publishes
//   en.<area> / boss.<area> / dun.<area> / party; clients send 'hit' / 'light' / 'revive' / 'at' events; every client
//   resolves its own damage from timestamped telegraphs and rolls its own loot from host 'slain' seeds. No BB from mp.
// Design: /workspace/iceberg-game-maker/designs/lantern-hollow-brief.md
import * as THREE from 'three';
import { Collision } from '../../engine/collision.js';
import { getDeviceMode } from '../../core/device.js';
import { GAME_ID, GAME_NAME, REWARD_SOURCE, rewardReason, QUESTS, UPGRADES, HEARTH_TIERS, BB_MILESTONES, NPC_NAMES, TONIC, CARRY_LOSS, BUILT_AREAS,
  normalizeSave, mergeSaves, statsFor, canAfford, pay, tonicMax, postBank, charmSlots, throneOpen, OIL, HEARTH_PERKS, CHARMS, BOUNTY_POOL, GLOOM, MAT_INFO } from './config.js';
import { AREAS, areaAt } from './areas.js';
import { createNet } from './net.js';
import { HollowAudio, ENEMY_SFX } from './audio.js';
import { HollowUI, costChips, rewardChips, esc } from './ui.js';
import { drawThumb } from './thumb.js';
import { makeAuroraSky, makeSnow, makeMats, makeLantern } from './world/common.js';
import { buildVillage } from './world/village.js';
import { buildCaves, CAVE, caveSdf, inPool } from './world/caves.js';
import { buildMine, MINE, mineSdf, laneNext, CART_WARN } from './world/mine.js';
import { buildThrone, THRONE, throneSdf } from './world/throne.js';
import { buildHearthDecor } from './world/hearthDecor.js';
import { mapSVG } from './mapView.js';
import { LightPool } from './lights.js';
import { Particles, Telegraphs, Pickups, inShape, makeGlowDecal } from './fx.js';
import { DEF, BOSSES, ST, AreaSim, packEnemies, unpackEnemies, enemyShapes, bossShapes, mulberry32, strHash } from './enemies.js';
import { EnemyViews, BOSS_VIEWS } from './enemyViews.js';
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
  mine: { bg: '#03070b', fog: ['#0c1824', 12, 64], hemi: ['#7a98c0', '#2a1c12', 0.8], moon: ['#8ab0ff', 0.35], exposure: 1.3, sky: false },
  throne: { bg: '#0d0a2a', fog: ['#2a2260', 45, 260], hemi: ['#a8b8ff', '#3a2a6a', 0.85], moon: ['#d8e4ff', 1.05], exposure: 1.08, sky: true, skyStr: 1.9, skyTop: '#060420', skyHor: '#3a2a78' },
};
const AREA_SUB = { village: 'Warm hearths, safe paths', caves: 'Glowing roots… and things that hate the light', mine: 'Cold water, rusted rails… and something drilling below', throne: 'Above the clouds, the stolen aurora burns' };
const PHASE_TXT = {
  mossmaw: { 2: ['The den goes dark!', 'FLARE the glowing spore sacs to stun Mossmaw'] },
  foreman: { 2: ['The lamps go out!', 'Get behind him and FLARE his glowing back vents'] },
  queen: { 2: ['The Queen calls her court!', 'Shades, knights and mirror-clone dashes'], 3: ['The Long Night falls', 'She is untouchable: FLARE all four braziers to rekindle the aurora'] },
};
const BOSS_SFX_AT = { slam: ['sfx_boss_slam', 't1', 1], sweep: ['sfx_boss_slam', 't1', 1.2], spore: ['sfx_spore_burst', 't1', 1], drill: ['sfx_drill', 't0', 1], flood: ['sfx_flood_wave', 't0', 1],
  lamp: ['sfx_swing_3', 't1', 0.6], dash: ['sfx_dash', 't1', 0.85], icicle: ['sfx_icicle_fall', 'pre', 1] };
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
    const mine = buildMine({ lights, mobile }); scene.add(mine.group);
    const throne = buildThrone({ lights, mobile }); scene.add(throne.group);
    const decor = buildHearthDecor(); scene.add(decor.group);
    // one dungeon table: every area-specific path goes through DUNS[area]
    const DUNS = { caves: { L: CAVE, w: caves, sdf: caveSdf }, mine: { L: MINE, w: mine, sdf: mineSdf }, throne: { L: THRONE, w: throne, sdf: throneSdf } };
    const isDun = (a) => !!DUNS[a];

    // ---------- collision (one set; bounds follow the current area) ----------
    const collision = new Collision({ floorY: 0, bounds: { type: 'box', ...AREAS.village.bounds } });
    village.colliders(collision); caves.colliders(collision); mine.colliders(collision); throne.colliders(collision);
    for (const [x, z, r, top] of decor.circles) collision.addCircle(x, z, r, top);
    const bossCircle = { x: 0, z: 0, r: 3.0, top: 8 }, bossCircleA = { a: null };   // follows the current area's boss

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
    const views = new EnemyViews(scene, camera);
    const bossViews = Object.fromEntries(Object.entries(DUNS).map(([a, D]) => [a, new BOSS_VIEWS[D.L.den.bossId](scene, D.L.den.boss)]));
    let area = 'village', carried = 0;
    const tmpV = new THREE.Vector3();
    const toScreen = (x, y, z) => { tmpV.set(x, y, z).project(camera); if (tmpV.z > 1) return [null, null]; const r = renderer.domElement.getBoundingClientRect(); return [r.left + (tmpV.x + 1) / 2 * r.width, r.top + (1 - tmpV.y) / 2 * r.height]; };
    const near = (x, z, d = 22) => Math.hypot(player.pos.x - x, player.pos.z - z) < d;

    const quests = new QuestLog(() => save, {
      onProgress: (q, r) => { if (!r.done) { audio.play('sfx_quest_progress', { minGap: 0.4 }); if (q.goal > 1) ui.toast(`📜 ${esc(q.title)} <b>${r.p}/${q.goal}</b>`, 1800); } markDirty(); },
      onReady: (q) => { audio.play('sfx_quest_complete', { minGap: 0.3 }); ui.toast(`✔ <b>${esc(q.title)}</b> complete! Return to ${NPC_NAMES[q.giver]}.`, 3500); markDirty(); },
      onBounty: (B) => { audio.play('sfx_quest_complete', { minGap: 0.3 }); ui.toast(`📌 Bounty done: <b>${esc(B.t)}</b>. Collect ${B.embers} 🔥 at the Quest Board.`, 3500); markDirty(); },
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
      onTonic: () => useTonic(), onSecondWind: () => { if (!stats().secondWind || runSW) return false; runSW = true; ui.banner('Second Wind!', 'Your charm flares: back on your feet', 1800); audio.play('sfx_revive'); burstAt(player.pos.x, player.pos.z, ['#bfffe8', '#ffffff'], 30); markDirty(); return true; } });
    let runSW = false;

    // ---------- multiplayer: party + host sim ----------
    const party = new Map();            // id -> { a, hp, mhp, pw, dn, r, name }
    const sims = {};                    // host only: area -> AreaSim
    const snaps = {}, dun = {}, boss = {}; // latest shared state per area
    const interp = new Map();           // client: id -> render record (smoothed)
    let lastAnnounce = 0, announcePending = false, hitQueue = [], bossHitQ = 0, sacQ = null, hitFlushT = 0, publishT = 0, emptyT = {}, shake = 0;
    const selfRecord = () => ({ a: area, hp: combat.hp, mhp: combat.maxHp, pw: stats().power, dn: !!combat.down, r: Math.round(combat.radius * 10) / 10, gp: save.gloomPlus ? 1 : 0, name: economy.profile?.displayName || 'You' });
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
      if (sims[a] || !isDun(a)) return sims[a];
      const D = DUNS[a], G = D.L.gate, B = AREAS[a].bounds;
      const sim = sims[a] = new AreaSim(a, {
        canWalk: (x, z) => D.sdf(x, z) < -0.5 && !(D.w.gateClosed && z < G.z1 + 0.6 && z > G.z0 - 0.6 && x > G.x0 - 0.6 && x < G.x1 + 0.6) && !(sim.boss && !sim.boss.dead && Math.hypot(x - sim.boss.x, z - sim.boss.z) < BOSSES[D.L.den.bossId].r + 0.6),
        inBounds: (x, z) => x > B.minX + 1 && x < B.maxX - 1 && z > B.minZ + 1 && z < B.maxZ - 1 && D.sdf(x, z) < 4,
        litAt: (x, z) => litAt(x, z, a), now: () => net.now(), send: (n, p) => net.sendEvent(n, p),
        onDun: (d) => { net.setState(`dun.${a}`, d); },
      }, D.L);
      if (adopt) sim.adopt(snaps[a], dun[a], boss[a]);
      else if (dun[a]) sim.dun = { ...sim.dun, ...dun[a] };
      sim.dirtyDun();
      return sim;
    }
    function playersIn(a) {   // [{ id, x, z, r, down }] incl. me
      const out = [];
      if (area === a) out.push({ id: me(), x: player.pos.x, z: player.pos.z, r: combat.radius, down: !!combat.down, gp: !!save.gloomPlus });
      for (const n of net.nearby(5000)) { const ar = areaAt(n.position.x, n.position.z); if (ar !== a) continue; const pi = party.get(n.id); out.push({ id: n.id, x: n.position.x, z: n.position.z, r: pi?.r || 6, down: !!pi?.dn, gp: !!pi?.gp }); }
      return out;
    }
    function litAt(x, z, a) {
      for (const t of playersIn(a)) if (Math.hypot(t.x - x, t.z - z) < t.r) return true;
      if (isDun(a)) for (const p of DUNS[a].w.posts) if (p.lit && Math.hypot(p.x - x, p.z - z) < 6) return true;
      return false;
    }
    // host: apply hits / lights / revives
    net.onEvent('hit', (p, meta) => {
      if (!net.isHost() || !p) return; const sim = ensureSim(p.a); if (!sim) return;
      for (const [id, dmg] of (p.h || []).slice(0, 16)) sim.applyHit(id, dmg, { flare: !!p.fl, kx: p.x, kz: p.z, k: 0.6, from: meta?.from });
      if (p.b) sim.hitBoss(p.b, { from: meta?.from });
      if (p.s != null) sim.hitBoss(0, { sac: p.s | 0, from: meta?.from, x: p.x, z: p.z });
    });
    net.onEvent('light', (p) => { if (!net.isHost() || !p) return; const sim = ensureSim(p.a); if (!sim || !sim.dun.posts || sim.dun.posts[p.i] == null) return; if (!sim.dun.posts[p.i]) { sim.dun.posts[p.i] = 1; sim.dirtyDun(); sim.checkGate(); } });
    net.onEvent('lever', (p) => { if (!net.isHost() || !p) return; const sim = ensureSim(p.a); if (!sim || sim.dun.levers?.[p.i] == null) return; if (!sim.dun.levers[p.i]) { sim.dun.levers[p.i] = 1; sim.dirtyDun(); sim.checkGate(); } });
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
    // joiners interpolate only their own area's enemy snapshot (ids are per-area; other areas' snapshots must not evict ours)
    function applySnap(a) { const s = snaps[a]; if (net.isHost() || a !== area || !s) return; const seen = new Set();
      for (const r of unpackEnemies(s)) { seen.add(r.id); const cur = interp.get(r.id); if (cur) Object.assign(cur, { ...r, x: cur.x, z: cur.z, tx: r.x, tz: r.z }); else interp.set(r.id, { ...r, tx: r.x, tz: r.z }); }
      for (const id of [...interp.keys()]) if (!seen.has(id)) interp.delete(id); }
    for (const a of Object.keys(DUNS)) {
      net.onState(`en.${a}`, (s) => { snaps[a] = s; applySnap(a); });
      net.onState(`boss.${a}`, (b) => { boss[a] = b; });
      net.onState(`dun.${a}`, (d) => applyDun(a, d));
    }
    const GATE_TXT = { caves: ['The root gate opens!', 'Mossmaw\'s Den lies beyond…'], mine: ['The gallery drains!', 'The sluice gate grinds open'], throne: ['The aurora barrier parts!', 'The Throne Arena awaits…'] };
    function applyDun(a, d) {
      const old = dun[a]; dun[a] = d; if (!d || !isDun(a)) return; const W = DUNS[a].w;
      if (old && old.rid !== d.rid) resetRunLocal(a);
      d.posts?.forEach((v, i) => { const p = W.posts[i]; if (p && !!v !== p.lit) { p.setLit(!!v); if (v && area === a) onPostLit(a, i); } });
      if (W.levers) d.levers?.forEach((v, i) => { const l = W.levers[i]; if (l && !!v !== l.pulled) { l.set(!!v); if (v && area === a) { audio.play('sfx_lever_pull'); quests.emit('lever:mine'); ui.toast(`⚙️ Lever ${d.levers.filter(Boolean).length} / ${d.levers.length} pulled`); markDirty(); } } });
      W.setGate(!!d.gate); W.setExit(!!d.bossDead);
      if (area === a && old) {
        if (a === 'caves' && d.waveOn && (!old.waveOn || old.wave !== d.wave)) { ui.banner(`Wave ${d.wave + 1} / 3`, 'Defend the Spore Garden!', 1800); audio.play('sfx_enemy_telegraph', { rate: 0.8 }); }
        if (!d.gate && old.gate) { ui.banner(...GATE_TXT[a], 2600); audio.play('sfx_door_open'); }
      }
    }
    const run = { chests: new Set(), veins: new Map(), crystals: new Map() };   // per dungeon run (resets with dun.rid)
    function resetRunLocal(a) { const W = DUNS[a]?.w; if (!W) return; run.chests.forEach(id => { if (W.chests.some(c => c.id === id)) run.chests.delete(id); }); W.chests.forEach(c => c.setOpen(false));
      if (a === 'caves') { run.veins.clear(); caves.veins.forEach(v => v.setState(false, false)); } if (area === a) pickups.clear(); }

    // loot, kills, bosses
    function burstAt(x, z, cols, n = 20, y = 1) { particles.burst(V(x, y, z), cols, n, 3.5, { up: 4, size: 0.12, life: 0.8 }); }
    net.onEvent('slain', (p) => {
      if (!p) return; const d = DEF[p.t];
      if (area === p.a) { burstAt(p.x, p.z, ['#ffd27a', '#ff9a3c', '#ffffff', d?.kind === 'moth' ? '#b07aff' : '#4ff0d0'], 26); if (near(p.x, p.z)) audio.play(ENEMY_SFX[p.t]?.death || 'sfx_enemy_poof', { rate: ENEMY_SFX[p.t]?.rate || 1 }); }
      if (area !== p.a || !near(p.x, p.z, 45) || !d) return;
      const rng = mulberry32((p.s ^ strHash(me())) >>> 0), n0 = d.embers[0] + Math.floor(rng() * (d.embers[1] - d.embers[0] + 1)), n = Math.round(n0 * (p.adds ? 0.5 : 1) * (save.gloomPlus ? GLOOM.embers : 1));
      const orbs = Math.min(5, n); for (let i = 0; i < orbs; i++) pickups.spawn('ember', p.x, p.z, Math.floor(n / orbs) + (i < n % orbs ? 1 : 0));
      if (d.mat && rng() < d.mat[1] * (p.adds ? 0.5 : 1)) pickups.spawn(d.mat[0], p.x, p.z, 1);
      if (d.mote) pickups.spawn('mote', p.x, p.z, 25);
      audio.play('sfx_loot_drop', { minGap: 0.1, gain: 0.7 });
      save.stats.kills++; quests.emit(`kill:${d.kind}`); markDirty();
    });
    net.onEvent('phase', (p) => { if (p?.a !== area) return; audio.play(ENEMY_SFX.boss.phase);   // boss_phase builds 1.7 s: started now, its boom lands on p.at
      const txt = PHASE_TXT[p.b]?.[p.ph]; setTimeout(() => { if (!disposed && area === p.a) { if (txt) ui.banner(txt[0], txt[1], 3400); shake = 0.6; } }, Math.max(0, (p.at || net.now()) - net.now())); });
    net.onEvent('sac', (p) => { if (p?.a !== area) return; const s = caves.sacs[p.i]; if (s) { burstAt(s.x, s.z, ['#fff08a', '#ffd23a', '#ffffff'], 40, 2.4); audio.play('sfx_spore_burst'); } ui.banner('Mossmaw is stunned!', 'Strike now!', 1600); });
    net.onEvent('stagger', (p) => { if (p?.a !== area) return; const b = boss[area]; if (b) burstAt(b.x, b.z, ['#ffb060', '#ffffff', '#ff7a2a'], 50, 4); audio.play('sfx_shield_break', { rate: 0.7 }); ui.banner('The Foreman staggers!', 'His vents are blown: strike now!', 1800); shake = 0.4; });
    net.onEvent('brazier', (p) => { if (p?.a !== area || !throne.braziers[p.i]) return; const z = throne.braziers[p.i]; burstAt(z.x, z.z, ['#7affd8', '#ffffff', '#c8a8ff'], 36, 2.6); audio.play(ENEMY_SFX.queen.brazier); });
    net.onEvent('aurora', (p) => { if (p?.a !== area) return; audio.play('sfx_hearth_rekindle', { rate: 1.2 }); ui.banner('Rekindled Aurora!', 'The Queen is exposed: double damage!', 2600); shake = 0.5; burstAt(THRONE.den.x, THRONE.den.z, ['#7affd8', '#c8a8ff', '#ffffff'], 120, 6); });
    net.onEvent('night', (p) => { if (p?.a !== area) return; ui.toast('🌑 The aurora fades. Light the braziers again!', 2600); });
    net.onEvent('shield', (p) => { if (p?.a !== area || !near(p.x, p.z, 18)) return; if (p.broke) { audio.play(ENEMY_SFX.knight.break); burstAt(p.x, p.z, ['#bfe8ff', '#ffffff'], 26, 1.6); } else audio.play(ENEMY_SFX.knight.block, { minGap: 0.2 }); });
    net.onEvent('bossDown', (p) => {
      if (p?.a !== area || !isDun(area)) return; const id = DUNS[area].L.den.bossId, B = BOSSES[id], bs = boss[area], bx = bs?.x ?? DUNS[area].L.den.boss[0], bz = bs?.z ?? DUNS[area].L.den.boss[1];
      audio.play(ENEMY_SFX.boss.defeat); setTimeout(() => { if (!disposed) audio.stinger('sfx_victory_fanfare'); }, 1400); shake = 0.8;
      burstAt(bx, bz, id === 'queen' ? ['#7affd8', '#c8a8ff', '#ffffff', '#ffd27a'] : id === 'foreman' ? ['#ffb060', '#8ad8ff', '#ffffff'] : ['#ff8fd0', '#ffd27a', '#ffffff', '#9dff7a'], 140, 3);
      const R = B.reward, mul = save.gloomPlus ? GLOOM.embers : 1;
      for (let i = 0; i < 12; i++) pickups.spawn('ember', bx, bz + 3, Math.round(R.embers / 12 * mul), 1, true);
      pickups.spawn('sigil', bx, bz + 3, 1, 1, true); for (const m of ['rustcog', 'shard']) if (R[m]) for (let i = 0; i < R[m]; i++) pickups.spawn(m, bx, bz + 3, 1, 1, true);
      const first = !save.bosses[id]; save.bosses[id]++; quests.emit(`boss:${id}`);
      const extra = [];
      if (id === 'mossmaw' && !save.unlocked.includes('mine')) { save.unlocked.push('mine'); extra.push(['🗺️', 'Sunken Mine unsealed']); }
      if (id === 'foreman') { if (throneOpen(save) && !save.unlocked.includes('throne')) { save.unlocked.push('throne'); extra.push(['👑', 'Aurora Throne unsealed']); } else if (!throneOpen(save)) extra.push(['🔥', 'Rekindle the Hearth to tier 3 to open the Throne']); }
      const bb = awardBB(B.bb); saveNow();
      ui.banner(`${B.name} falls!`, id === 'queen' ? 'The aurora is free!' : 'The light pushes deeper', 3000);
      const loot = [['🔥', `${Math.round(R.embers * mul)} embers`], ['🔱', 'Boss Sigil'], ...(R.rustcog ? [['⚙️', `${R.rustcog} Rustcogs`]] : []), ...(R.shard ? [['💠', `${R.shard} Aurora Shards`]] : []), ...(bb ? [['💎', `${bb} Birg Bucks`]] : []), ...extra];
      setTimeout(() => { if (disposed) return;
        if (id === 'queen') { const firstEnd = !save.ending; save.ending = true; saveNow(); openEnding(loot, firstEnd); }
        else openResult(B.icon, `${B.name} defeated!`, `${first ? 'First victory! ' : ''}Grab the loot, then take the Hearthward portal home.`, loot); }, 2600);
    });

    // ---------- area travel ----------
    let traveling = false;
    function applyLook(a) {
      const L = LOOKS[a] || LOOKS.village; scene.background.set(L.bg); scene.fog.color.set(L.fog[0]); scene.fog.near = L.fog[1]; scene.fog.far = L.fog[2];
      hemi.color.set(L.hemi[0]); hemi.groundColor.set(L.hemi[1]); hemi.intensity = L.hemi[2]; hemi.userData.base = L.hemi[2]; moon.color.set(L.moon[0]); moon.intensity = L.moon[1];
      renderer.toneMappingExposure = L.exposure; sky.mesh.visible = L.sky; snow.points.visible = a === 'village';
      const U = sky.mesh.material.uniforms, auroraBack = save.ending || save.hearth >= 5;
      U.uStr.value = a === 'throne' ? L.skyStr : auroraBack ? 1.6 : 0.55; U.uTop.value.set(L.skyTop || '#04061a'); U.uHor.value.set(L.skyHor || (auroraBack && a === 'village' ? '#24306a' : '#1e2a5c'));
      village.group.visible = decor.group.visible = a === 'village'; caves.group.visible = a === 'caves'; mine.group.visible = a === 'mine'; throne.group.visible = a === 'throne';
      Object.assign(collision.bounds, AREAS[a].bounds);
    }
    function enterArea(a, pos, facing) {
      const fromVillage = area === 'village'; area = a; applyLook(a); player.teleport(pos, facing); player.vel.set(0, 0, 0);
      audio.setArea(a); audio.stinger('sfx_area_enter'); ui.setArea(AREAS[a].name); ui.showKeys(6000); ui.banner(AREAS[a].name, AREA_SUB[a] + (save.gloomPlus && a !== 'village' ? ' · GLOOM+' : ''), 2600);
      telegraphs.clear(); pending.clear(); for (const g of pickups.takeHoming()) grant(g); pickups.clear(); views.clear(); interp.clear(); applySnap(a); announce(true);
      if (a === 'village') { if (carried) { save.embers += carried; ui.toast(`🔥 Banked <b>${carried}</b> embers`); carried = 0; } if (quests.refreshBounties()) ui.toast('📌 New bounties on the Quest Board', 2600); saveNow(); }
      else { runSW = false; const pw = stats().power; if (pw < AREAS[a].power) setTimeout(() => !disposed && ui.toast(`⚠️ Recommended Power ${AREAS[a].power}+ (you: ${pw}). Upgrade in the village!`, 4000), 2800); }
      if (isDun(a) && fromVillage && save.wisp?.area === a) ui.toast(`✨ Your Ember Wisp is still glowing somewhere in the ${AREAS[a].name}…`);
      if (a === 'mine') liftT = 2.2;
    }
    function travel(a) {
      if (traveling || !BUILT_AREAS.includes(a)) return; traveling = true; ui.closeModal(); ui.fade(true); audio.play('sfx_waystone_travel');
      setTimeout(() => {
        if (disposed) return;
        if (a === 'village') enterArea('village', V(0, 0, -25.5), 0 + Math.PI);
        else enterArea(a, V(...DUNS[a].L.arrive), DUNS[a].L.arriveFacing);
        combat.reset(true); setTimeout(() => { ui.fade(false); traveling = false; }, 250);
      }, 480);
    }

    // ---------- interactions ----------
    let reviveHold = 0;
    function interactables() { return area === 'village' ? village.interactables : isDun(area) ? DUNS[area].w.interactables : []; }
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
      const W = DUNS[area]?.w;
      if (it.kind === 'post') { const p = W.posts.find(x => x.id === it.id); return p?.lit ? `Rest · refill glow & bank embers` : it.flare ? `Hold FLARE (Q) to light the ${it.name}` : `Light the ${it.name}`; }
      if (it.kind === 'chest') { const c = W.chests.find(x => x.id === it.id); if (run.chests.has(it.id)) return null; if (c.needsWaves && (dun.caves?.wave || 0) < 3) return 'Sealed by roots… clear the Spore Garden'; return `Open the ${it.name}`; }
      if (it.kind === 'lever') { const i = W.levers.findIndex(l => l.id === it.id); return dun[area]?.levers?.[i] ? null : 'Pull the drain lever'; }
      if (it.kind === 'vein') { const v = run.veins.get(it.id); return v?.mined ? null : v?.revealed ? 'Mine the ember vein' : null; }
      if (it.id === 'hearth') return `Rekindle · Great Hearth (tier ${save.hearth}/5)`;
      const npc = NPC_NAMES[it.id]; if (npc) { const r = quests.readyCount(it.id), av = quests.availableCount(it.id); return `${it.verb} · ${it.name}${r ? ' · ✔ quest ready' : av ? ' · ❗ new quest' : ''}`; }
      return `${it.verb} · ${it.name}`;
    }
    function interact(it) {
      if (NPC_NAMES[it.id]) { audio.play('sfx_npc_talk'); return openGiver(it.id); }
      if (it.id === 'hearth') { audio.play('sfx_ui_open'); return openHearth(); }
      if (it.id === 'waystone') { if (isDun(area)) return travel('village'); audio.play('sfx_ui_open'); return openWaystone(); }
      if (it.id === 'board') { audio.play('sfx_npc_talk'); return openGiver('board'); }
      if (it.id === 'exit') return travel('village');
      if (it.kind === 'post') return usePost(it.id);
      if (it.kind === 'chest') return openChest(it.id);
      if (it.kind === 'vein') return mineVein(it.id);
      if (it.kind === 'lever') { const i = mine.levers.findIndex(l => l.id === it.id); if (dun.mine?.levers?.[i]) return; net.sendEvent('lever', { a: 'mine', i }); audio.play('sfx_lever_pull'); return; }
    }
    function usePost(id, byFlare = false) {
      const W = DUNS[area].w, i = W.posts.findIndex(p => p.id === id), p = W.posts[i];
      if (!p.lit) { if (p.flare && !byFlare) { ui.toast('✨ Aurora Pillars only answer a FLARE: hold <b>Q</b> beside it'); audio.play('sfx_ui_error'); return; } net.sendEvent('light', { a: area, i }); p.setLit(true); onPostLit(area, i); }
      else { combat.glow = stats().glow; combat.heal(2); const b = Math.floor(carried * postBank(save)); if (b) { carried -= b; save.embers += b; ui.toast(`🔥 Banked <b>${b}</b> embers at the lamp post`); saveNow(); } audio.play('sfx_lantern_refill'); }
    }
    function onPostLit(a, i) {
      const p = DUNS[a].w.posts[i]; save.posts[a] = p.id; burstAt(p.x, p.z, p.flare ? ['#7affd8', '#c8a8ff', '#ffffff'] : ['#ffd27a', '#ff9a3c', '#ffffff'], 30, 3.4);
      audio.play(p.flare ? 'sfx_brazier_light' : 'sfx_lamppost_light', { minGap: 0.3 }); combat.glow = stats().glow; combat.heal(2);
      const b = Math.floor(carried * postBank(save)); if (b) { carried -= b; save.embers += b; }
      ui.toast(`${p.flare ? '✨' : '🏮'} ${esc(p.name)} ${p.flare ? 'Aurora Pillar' : 'lamp post'} lit${b ? ` · banked <b>${b}</b> 🔥` : ''}`); quests.emit(`light:${a}`); saveNow();
    }
    function openChest(id) {
      const c = DUNS[area].w.chests.find(x => x.id === id); if (run.chests.has(id) || (c.needsWaves && (dun.caves?.wave || 0) < 3)) return;
      run.chests.add(id); c.setOpen(true); audio.play('sfx_chest_open'); burstAt(c.x, c.z, ['#ffd27a', '#ffffff', '#ff9a3c'], 30, 1.2);
      const first = !save.chests.includes(id);
      const mat = area === 'mine' ? 'rustcog' : area === 'throne' ? 'shard' : 'glowcap', emb = { caves: 10, mine: 16, throne: 22 }[area] || 10;
      if (first) { save.chests.push(id); for (let i = 0; i < 6; i++) pickups.spawn('ember', c.x, c.z, emb); for (let i = 0; i < 3; i++) pickups.spawn(mat, c.x, c.z, 1); save.tonics = Math.min(tonicMax(save), save.tonics + 1);
        let extra = ''; if (c.charm && !save.charms.includes(c.charm)) { save.charms.push(c.charm); extra = ` and the <b>${CHARMS[c.charm].icon} ${CHARMS[c.charm].name}</b> charm!`; audio.play('sfx_upgrade_lantern'); }
        ui.toast(`🎁 Treasure! ${emb * 6} 🔥, 3 ${MAT_INFO[mat][0]}, a 🧪 tonic${extra}`, 3600); }
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
      if (giver === 'moss') { const mx = tonicMax(save); body += `<h4 style="margin:12px 0 8px;color:#ffcf8a">Shop</h4><div class="lh-card"><div class="ic">🧪</div><div class="mid"><h4>Glowberry Tonic</h4><div class="d">Heals ${TONIC.heal / 2} hearts (R / 🧪). Carry up to ${mx}. You have ${save.tonics}.</div><div>${costChips({ embers: TONIC.price }, save)}</div></div><button class="lh-btn" data-act="tonic" ${save.tonics >= mx || save.embers < TONIC.price ? 'disabled' : ''}>Buy</button></div>`;
        body += `<div class="lh-card"><div class="ic">🛢️</div><div class="mid"><h4>Lantern Oil</h4><div class="d">Auto-used when your glow runs dry: +${OIL.refill} glow. Carry up to ${OIL.max}. You have ${save.oil}.</div><div>${costChips({ embers: OIL.price }, save)}</div></div><button class="lh-btn" data-act="oil" ${save.oil >= OIL.max || save.embers < OIL.price ? 'disabled' : ''}>Buy</button></div>`; }
      if (giver === 'brann') body += charmSection();
      if (giver === 'board') body += bountySection();
      const qs = quests.forGiver(giver).filter(e => e.st !== 'locked' || giver === 'wick' || giver === 'board');
      if (qs.length) body += `<h4 style="margin:12px 0 8px;color:#ffcf8a">Quests</h4>${questCards(qs)}`;
      ui.modal(ICON[giver], NPC_NAMES[giver], giver === 'board' ? 'Bounties & odd jobs' : `${save.embers} 🔥 banked`, body, { kind: 'giver', id: giver });
    }
    function charmSection() {
      const slots = charmSlots(save), eq = save.equipped;
      return `<h4 style="margin:12px 0 8px;color:#ffcf8a">Charms · ${eq.length}/${slots} equipped${slots < 3 ? ' <span style="opacity:.65;font-weight:600">(3rd slot at Hearth tier 4)</span>' : ''}</h4>` + Object.entries(CHARMS).map(([id, C]) => {
        const own = save.charms.includes(id), on = eq.includes(id);
        const act = own ? `<button class="lh-btn ${on ? 'alt' : ''}" data-act="equip" data-v="${id}" ${!on && eq.length >= slots ? 'disabled' : ''}>${on ? 'Unequip' : 'Equip'}</button>` : C.cost ? `<button class="lh-btn" data-act="craft" data-v="${id}" ${canAfford(save, C.cost) ? '' : 'disabled'}>Craft</button>` : '';
        return `<div class="lh-card ${own ? '' : 'locked'}"><div class="ic">${C.icon}</div><div class="mid"><h4>${C.name}${on ? ' <span class="lh-chip ok">equipped</span>' : ''}</h4><div class="d">${C.desc}</div><div>${own ? '' : C.cost ? costChips(C.cost, save) : `<span class="lh-chip">🔒 ${esc(C.from)}</span>`}</div></div>${act}</div>`; }).join('');
    }
    function bountySection() {
      if (!save.bounties.length) quests.refreshBounties();
      return `<h4 style="margin:12px 0 8px;color:#ffcf8a">Bounties <span style="opacity:.65;font-weight:600">(new ones each time you come home)</span></h4>` + save.bounties.map((b, i) => { const B = BOUNTY_POOL[b.i];
        return `<div class="lh-card ${b.paid ? 'done' : ''}"><div class="ic">${b.paid ? '✅' : b.done ? '🌟' : '📌'}</div><div class="mid"><h4>${esc(B.t)}</h4><div class="d">${esc(AREAS[B.area].name)}</div><div class="lh-pbar"><b style="width:${b.p / B.goal * 100}%"></b></div><div class="meta">${b.p} / ${B.goal}</div><div>${rewardChips({ embers: B.embers })}</div></div>${b.done && !b.paid ? `<button class="lh-btn go" data-act="bounty" data-v="${i}">Collect</button>` : ''}</div>`; }).join('');
    }
    function openHearth() {
      const t = save.hearth, cost = HEARTH_TIERS[t], perks = HEARTH_PERKS;
      const body = `<p class="lh-say">The great flame crackles hungrily. Each tier warms the whole Hollow.</p>
        <div class="lh-card"><div class="ic">🔥</div><div class="mid"><h4>Tier ${t} / 5</h4><div class="lh-pips">${[1, 2, 3, 4, 5].map(i => `<i class="${i <= t ? 'on' : ''}"></i>`).join('')}</div>
        ${cost ? `<div class="d">Next: <b>${perks[t]}</b></div><div class="lh-pbar"><b style="width:${Math.min(100, save.embers / cost * 100)}%"></b></div><div class="meta">${save.embers} / ${cost} 🔥</div>` : '<div class="d">The Hearth burns at full glory!</div>'}</div>
        ${cost ? `<button class="lh-btn" data-act="rekindle" ${save.embers >= cost ? '' : 'disabled'}>Feed ${cost} 🔥</button>` : ''}</div>
        ${perks.map((p, i) => `<div class="d" style="margin:4px 0;opacity:${i < t ? 1 : 0.6}">${i < t ? '✅' : '▫️'} Tier ${i + 1}: ${p}</div>`).join('')}`;
      ui.modal('🔥', 'Great Hearth Lantern', 'Rekindle the Hollow', body, { kind: 'hearth' });
    }
    function openWaystone() {
      const card = (id, icon, desc) => { const A = AREAS[id], here = area === id, built = BUILT_AREAS.includes(id), open = save.unlocked.includes(id) && built, pw = stats().power;
        const why = !save.unlocked.includes(id) ? (id === 'mine' ? 'Defeat Mother Mossmaw' : `${save.bosses.foreman ? '✔' : '✖'} Defeat the Drowned Foreman · ${save.hearth >= 3 ? '✔' : '✖'} Hearth tier 3`) : !built ? 'Opens in a later update' : '';
        return `<div class="lh-card ${open || id === 'village' ? '' : 'locked'}"><div class="ic">${icon}</div><div class="mid"><h4>${A.name}</h4><div class="d">${desc}</div><div class="meta">${id === 'village' ? 'Safe hub' : `Recommended Power ${A.power}+ · you: ${pw}`}${why ? ` · 🔒 ${why}` : ''}</div></div>
          ${here ? '<span class="lh-chip">You are here</span>' : (open || id === 'village') ? `<button class="lh-btn alt" data-act="travel" data-v="${id}">Travel</button>` : ''}</div>`; };
      ui.modal('🌀', 'Waystone', 'Where will the light go next?', card('village', '🏘️', 'Frostlight Village: quests, forge, hearth.') + card('caves', '🍄', 'Bioluminescent caverns, slimes, spores and the Mother Root.') + card('mine', '⛏️', 'A flooded crystal mine. Rust Golems and the Drowned Foreman.') + card('throne', '👑', 'Floating ice terraces under a stolen aurora.')
        + (save.bosses.queen ? `<div class="lh-card"><div class="ic">🌑</div><div class="mid"><h4>Gloom+ ${save.gloomPlus ? '<span class="lh-chip ok">ON</span>' : ''}</h4><div class="d">Replay every area with +60% enemy HP, +30% damage and ${GLOOM.embers}× embers.</div></div><button class="lh-btn alt" data-act="gloom">${save.gloomPlus ? 'Turn off' : 'Turn on'}</button></div>` : ''), { kind: 'waystone' });
    }
    function openJournal() {
      const act = QUESTS.map(q => ({ q, ...quests.status(q), r: save.quests[q.id] })).filter(e => e.st === 'active' || e.st === 'ready');
      const done = QUESTS.filter(q => save.quests[q.id]?.turnedIn).length;
      const body = (act.length ? questCards(act).replace(/<button[^>]*data-act="turnin"[^>]*>Turn in<\/button>/g, '<span class="lh-chip ok">Return to giver</span>') : '<p class="lh-say">No active quests. Visit Elder Wick and the Quest Board in the village.</p>')
        + (save.bounties.some(b => !b.paid) ? `<h4 style="margin:12px 0 6px;color:#ffcf8a">Bounties</h4>` + save.bounties.filter(b => !b.paid).map(b => { const B = BOUNTY_POOL[b.i]; return `<div class="d" style="margin:3px 0">${b.done ? '🌟' : '📌'} ${esc(B.t)} · <b>${b.p}/${B.goal}</b> · ${B.embers} 🔥</div>`; }).join('') : '')
        + `<div class="meta" style="margin-top:10px">Completed ${done} / ${QUESTS.length} · Kills ${save.stats.kills} · Revives ${save.stats.revives} · Veins ${save.veins.length}/5 · Charms ${save.charms.length}/${Object.keys(CHARMS).length}${save.title ? ` · Title: ${esc(save.title)}` : ''}</div>`;
      ui.modal('📜', 'Quest Journal', `${act.length} active`, body, { kind: 'journal' });
    }
    function openParty() {
      const rows = net.players().map(p => { const pi = p.id === me() ? selfRecord() : party.get(p.id) || {}; return `<div class="lh-card ${pi.dn ? 'locked' : ''}"><div class="ic">${pi.dn ? '💀' : '🏮'}</div><div class="mid"><h4>${esc(pi.name || p.name)}${p.isHost ? ' <span class="lh-chip">host</span>' : ''}${p.id === me() ? ' <span class="lh-chip">you</span>' : ''}</h4><div class="d">${esc(AREAS[pi.a]?.name || '…')} · Power ${pi.pw || '?'} · ${pi.hp != null ? `${(pi.hp / 2).toFixed(1)}/${(pi.mhp || 6) / 2} ❤` : ''}</div></div></div>`; }).join('');
      ui.modal('👥', 'Party', `${net.players().length} in this server · ${net.online ? 'online' : 'solo'}`, rows + '<p class="d" style="opacity:.75;margin-top:8px">Everyone in the server shares dungeon progress. Loot is personal, so helping friends always pays. Downed friends can be revived by holding ✋/E next to them.</p>', { kind: 'party' });
    }
    // what the tracker says when no quest is active: the next real step, from actual quest state
    let hintCache = { t: -1, s: '' };
    function trackerHint() {
      const now = performance.now(); if (now - hintCache.t < 1000) return hintCache.s; hintCache.t = now;
      const st = QUESTS.map(q => ({ q, ...quests.status(q) })), done = st.filter(x => x.st === 'done').length;
      const av = st.filter(x => x.st === 'available'), lock = st.find(x => x.st === 'locked');
      return (hintCache.s = done === QUESTS.length ? `✔ All ${QUESTS.length} quests complete` : av.length
        ? `❗ ${av.length} new quest${av.length > 1 ? 's' : ''}: ${[...new Set(av.map(x => NPC_NAMES[x.q.giver]))].join(', ')} <span>${done}/${QUESTS.length}</span>`
        : lock ? `Next: ${esc(lock.q.title)} (${esc(lock.why)}) <span>${done}/${QUESTS.length}</span>` : 'Visit Elder Wick by the Quest Board');
    }
    // camera vs rock walls (caves + mine): march the camera boom over the walkable SDF and pull the camera in
    // before it would sit inside the rock band; eases back out. The player's own zoom (camPref) is preserved.
    let camPref = null, camSet = null;
    function camClip(dt) {
      const pl = player; if (camPref == null || (camSet != null && Math.abs(pl.camDist - camSet) > 0.01)) camPref = pl.camDist;
      if (area !== 'caves' && area !== 'mine') { if (camSet != null) { pl.camDist = camPref; camSet = null; } return; }
      const sdf = DUNS[area].sdf, cp = Math.cos(pl.camPitch), sx = Math.sin(pl.camYaw) * cp, sz = Math.cos(pl.camYaw) * cp;
      let clear = camPref; for (let d = 1.5; d <= camPref + 0.01; d += 0.5) if (sdf(pl.pos.x + sx * d, pl.pos.z + sz * d) > 0.9) { clear = Math.max(4.5, d - 1); break; }
      const cur = camSet ?? pl.camDist, next = cur + (clear - cur) * Math.min(1, dt * (clear < cur ? 12 : 2.5));
      pl.camDist = next; camSet = next;
    }
    function grant(g) {   // a collected pickup
      if (g.kind === 'ember') { carried += g.value; audio.ember(); }
          else if (g.kind === 'glowcap' || g.kind === 'rustcog' || g.kind === 'shard') { save.mats[g.kind]++; audio.play('sfx_material_pickup'); quests.emit(`collect:${g.kind}`); markDirty(); }
          else if (g.kind === 'mote') { combat.glow = Math.min(stats().glow, combat.glow + g.value); audio.play('sfx_lantern_refill', { gain: 0.6 }); }
          else if (g.kind === 'sigil') { save.mats.sigil++; audio.play('sfx_material_pickup', { rate: 0.7 }); ui.toast('🔱 Boss Sigil collected!'); markDirty(); }
    }
    function openMap() {
      const dots = [{ x: player.pos.x, z: player.pos.z, me: true }];
      for (const n of net.nearby(5000)) { if (areaAt(n.position.x, n.position.z) !== area) continue; const pi = party.get(n.id); dots.push({ x: n.position.x, z: n.position.z, name: pi?.name || n.name, down: !!pi?.dn }); }
      let svg, legend;
      if (area === 'village') {
        const marks = village.interactables.map(it => ({ x: it.x, z: it.z, icon: ICON[it.id] || (it.id === 'hearth' ? '🔥' : it.id === 'waystone' ? '🌀' : '•'), label: NPC_NAMES[it.id] || it.name }));
        svg = mapSVG({ shapes: [{ c: [0, 0], r: 40 }], marks, dots, theme: { fill: '#1e2a52', edge: '#7a9aff' } }); legend = 'Frostlight Village · talk to the folk, feed the Hearth, travel by the Waystone';
      } else {
        const D = DUNS[area], d = dun[area] || {}, b = boss[area], L = D.L, marks = [];
        L.posts.forEach((p, i) => marks.push({ x: p.x, z: p.z, icon: d.posts?.[i] ? (p.flare ? '✨' : '🏮') : '▫️', size: 3.6 }));
        L.chests.forEach(c => marks.push({ x: c.x, z: c.z, icon: run.chests.has(c.id) ? '📭' : '🎁', size: 3.4 }));
        (L.levers || []).forEach((l, i) => marks.push({ x: l.x, z: l.z, icon: d.levers?.[i] ? '✅' : '⚙️', size: 3.4 }));
        marks.push({ x: L.waystone[0], z: L.waystone[1], icon: '🌀', size: 3.6 });
        marks.push({ x: L.den.x, z: L.den.z, icon: d.bossDead ? '✔️' : '💀', label: BOSSES[L.den.bossId].name, size: 6 });
        svg = mapSVG({ shapes: L.shapes, marks, dots, gate: { ...L.gate, closed: !!d.gate }, theme: { caves: { fill: '#2a2450', edge: '#9a6aff' }, mine: { fill: '#22303a', edge: '#4ab0ff' }, throne: { fill: '#2a3a6a', edge: '#7affd8' } }[area] });
        legend = `${d.posts ? d.posts.filter(Boolean).length : 0}/${L.posts.length} ${area === 'throne' ? 'pillars' : 'lamp posts'} lit${L.levers ? ` · ${(d.levers || []).filter(Boolean).length}/3 levers` : ''} · gate ${d.gate ? '🔒 closed' : '🔓 open'}${b && !b.dead ? ` · boss ${Math.round(b.hp / b.max * 100)}%` : ''}`;
      }
      ui.modal('🗺️', `Map · ${AREAS[area].name}`, legend, `<div class="lh-mapwrap">${svg}</div><div class="meta" style="text-align:center;margin-top:6px">🟡 you · 🔵 allies · 🔴 downed · North is up</div>`, { kind: 'map' });
    }
    function openEnding(loot, first) {
      const s = save.stats, m = Math.floor(s.playMs / 60000), mins = m < 1 ? '<1' : m >= 60 ? `${Math.floor(m / 60)} h ${m % 60}` : m;
      const credits = ['A game for the Iceberg platform', 'Design, code and worlds: Iceberg Game Maker', 'Sound: the Iceberg Sound Designer pack', 'Thank you for carrying the light'];
      ui.modal('🌌', first ? 'The Aurora Returns' : 'The Queen is quieted again', 'Lantern Hollow · ending',
        `<div class="lh-end"><div class="aur"></div><p class="lh-say">The Hollow Queen's crown shatters into a thousand motes of green and violet light. They rise, and the sky over Frostlight Village remembers its colours. Down in the plaza the Great Hearth roars, and someone starts a song.</p>
        <div class="loot">${loot.map(([i, t]) => `<span class="lh-chip">${i} ${esc(t)}</span>`).join('')}</div>
        <div class="stats"><span>⏱ ${mins} min</span><span>⚔️ ${s.kills} foes</span><span>💚 ${s.revives} revives</span><span>💀 ${s.deaths} gutterings</span></div>
        <div class="cred">${credits.map(c => `<div>${esc(c)}</div>`).join('')}</div>
        <p class="d" style="opacity:.8">${save.quests.lh_q_hollow_queen?.a && !save.quests.lh_q_hollow_queen?.turnedIn ? 'Turn in “Return the Aurora” to Elder Wick for the <b>Lightbringer</b> title. ' : ''}<b>Gloom+</b> is now available at the Waystone.</p>
        <button class="lh-btn" data-act="close">Carry on</button></div>`, { kind: 'ending' });
      audio.play('sfx_quest_complete');
    }
    function openResult(icon, title, sub, loot) { ui.modal(icon, title, '', `<div class="lh-res"><p class="lh-say">${esc(sub)}</p><div class="loot">${loot.map(([i, t]) => `<span class="lh-chip">${i} ${esc(t)}</span>`).join('')}</div><button class="lh-btn" data-act="close">Onward</button></div>`, { kind: 'result' }); audio.play('sfx_quest_complete'); }
    function refreshModal() { const t = ui.modalTag; if (!t) return; if (t.kind === 'giver') openGiver(t.id); else if (t.kind === 'hearth') openHearth(); else if (t.kind === 'waystone') openWaystone(); }
    function onAct(a, v) {
      audio.play('sfx_ui_click');
      if (a === 'journal') return ui.modalTag?.kind === 'journal' ? ui.closeModal() : openJournal();
      if (a === 'party') return ui.modalTag?.kind === 'party' ? ui.closeModal() : openParty();
      if (a === 'map') return ui.modalTag?.kind === 'map' ? ui.closeModal() : openMap();
      if (a === 'oil') { if (save.embers >= OIL.price && save.oil < OIL.max) { save.embers -= OIL.price; save.oil++; audio.play('sfx_purchase'); saveNow(); } else audio.play('sfx_ui_error'); }
      if (a === 'craft') { const C = CHARMS[v]; if (C?.cost && !save.charms.includes(v) && canAfford(save, C.cost)) { pay(save, C.cost); save.charms.push(v); if (save.equipped.length < charmSlots(save)) save.equipped.push(v); audio.play('sfx_upgrade_forge'); ui.toast(`${C.icon} Crafted <b>${C.name}</b>!`); burstAt(player.pos.x, player.pos.z, ['#ffd27a', '#ffffff'], 24, 1.5); saveNow(); } else audio.play('sfx_ui_error'); }
      if (a === 'equip') { const i = save.equipped.indexOf(v); if (i >= 0) save.equipped.splice(i, 1); else if (save.charms.includes(v) && save.equipped.length < charmSlots(save)) save.equipped.push(v); else audio.play('sfx_ui_error'); announce(true); saveNow(); }
      if (a === 'bounty') { const e = quests.payBounty(+v); if (e) { save.embers += e; audio.play('sfx_purchase'); ui.toast(`📌 Bounty paid: <b>+${e}</b> 🔥`); saveNow(); } }
      if (a === 'gloom') { save.gloomPlus = !save.gloomPlus; ui.toast(save.gloomPlus ? '🌑 Gloom+ on: tougher foes, richer embers' : '🌕 Gloom+ off'); announce(true); saveNow(); }
      if (a === 'accept') { if (quests.accept(v)) { audio.play('sfx_quest_accept'); ui.toast(`📜 Accepted <b>${esc(QUESTS.find(q => q.id === v).title)}</b>`); saveNow(); } }
      if (a === 'turnin') quests.turnIn(v);
      if (a === 'upgrade') { const U = UPGRADES[v], lv = save.up[v], cost = U.cost[lv]; if (lv < 5 && canAfford(save, cost)) { pay(save, cost); save.up[v]++; audio.play(v === 'lantern' ? 'sfx_upgrade_lantern' : 'sfx_upgrade_forge'); ui.toast(`${U.icon} ${U.name} → level ${save.up[v]}!`); if (v === 'hearts') combat.hp += 2; burstAt(player.pos.x, player.pos.z, ['#ffd27a', '#ff9a3c', '#ffffff'], 30, 1.5); announce(true); saveNow(); } else audio.play('sfx_ui_error'); }
      if (a === 'tonic') { if (save.embers >= TONIC.price && save.tonics < tonicMax(save)) { save.embers -= TONIC.price; save.tonics++; audio.play('sfx_purchase'); saveNow(); } else audio.play('sfx_ui_error'); }
      if (a === 'rekindle') { const c = HEARTH_TIERS[save.hearth]; if (c && save.embers >= c) { save.embers -= c; save.hearth++; audio.play('sfx_hearth_rekindle'); quests.emit('hearth', 0); ui.banner('The Hearth roars!', `Tier ${save.hearth}: ${HEARTH_PERKS[save.hearth - 1]}`, 3000); burstAt(0, 0, ['#ffd27a', '#ff9a3c', '#ffffff', '#ff6a3a'], 80, 4); village.hearthLight.intensity = 60 + save.hearth * 12; decor.set(save.hearth);
        if (throneOpen(save) && !save.unlocked.includes('throne')) { save.unlocked.push('throne'); setTimeout(() => !disposed && ui.toast('👑 The Aurora Throne is unsealed! Travel by the Waystone.', 4500), 1500); }
        if (save.hearth >= 5) applyLook('village'); saveNow(); } }
      if (a === 'travel') return travel(v);
      refreshModal();
    }

    // ---------- combat hooks ----------
    function hitTargets() {
      const out = [];
      if (area === 'village') village.dummies.forEach((d, i) => out.push({ id: `d${i}`, kind: 'dummy', x: d.x, z: d.z, r: 0.5, hittable: true }));
      for (const r of renderList()) { const d = DEF[r.type]; const lit = r.lit || Math.hypot(r.x - player.pos.x, r.z - player.pos.z) < combat.radius;
        out.push({ id: r.id, kind: 'enemy', x: r.x, z: r.z, r: d.r, hittable: r.st !== ST.burrowed && (!d.shadow || lit), shadow: d.shadow }); }
      const b = boss[area]; if (isDun(area) && b && !b.dead) out.push({ id: 'boss', kind: 'boss', x: b.x, z: b.z, r: BOSSES[b.id]?.r || 3, hittable: true });
      if (area === 'mine') mine.crystals.forEach((c, i) => { const cool = (run.crystals.get(c.id) || 0) > performance.now(); c.cool = cool; if (!cool && mine.crystalGlow(i, gameT)) out.push({ id: c.id, kind: 'crystal', x: c.x, z: c.z, r: 1.0, hittable: true }); });
      return out;
    }
    function inSharedLight() { // lamp-post glow or overlap with an ally's lantern
      if (isDun(area) && DUNS[area].w.posts.some(p => p.lit && Math.hypot(p.x - player.pos.x, p.z - player.pos.z) < 6)) return true;
      return net.nearby(5000).some(n => { const pi = party.get(n.id); return pi && !pi.dn && Math.hypot(n.position.x - player.pos.x, n.position.z - player.pos.z) < combat.radius + (pi.r || 6) * 0.6; });
    }
    function onHits(hits, info) {
      let total = 0; const kin = inSharedLight() ? stats().kindredMul : 1;
      for (const h of hits) { const { t, crit } = h, dmg = Math.round(h.dmg * kin);
        const [sx, sy] = toScreen(t.x, 2.2, t.z); ui.float(String(dmg), sx, sy, crit ? 'crit' : '');
        particles.burst(V(t.x, 1.1, t.z), ['#ffffff', '#ffd27a', t.kind === 'boss' ? '#ff8fd0' : '#7ff0d0'], 8, 3, { up: 2, size: 0.09, life: 0.4 });
        if (t.kind === 'dummy') { village.dummies[+t.id.slice(1)].wob = 1; continue; }
        if (t.kind === 'crystal') { hitCrystal(t.id); continue; }
        total += dmg;
        if (t.kind === 'boss') { bossViews[area]?.flash(); bossHitQ += dmg; } else { views.flash(t.id); hitQueue.push([t.id, dmg]); }
      }
      audio.play(hits.some(h => h.crit) ? 'sfx_hit_crit' : `sfx_hit_${1 + Math.floor(Math.random() * 3)}`, { rate: 0.95 + Math.random() * 0.1 });
      if (hits.some(h => h.t.kind !== 'dummy')) audio.play('sfx_enemy_hurt', { gain: 0.6, rate: 0.9 + Math.random() * 0.2, minGap: 0.08 });
      if (total && kin > 1) { save.kindredDmg += total; while (save.kindredDmg >= 150) { save.kindredDmg -= 150; quests.emit('kindred'); } }
      shake = Math.max(shake, 0.08); void info;
    }
    function flushHits() {
      if (!hitQueue.length && !bossHitQ && sacQ == null) return;
      net.sendEvent('hit', { a: area, h: hitQueue.splice(0, 16), b: Math.round(bossHitQ) || undefined, s: sacQ ?? undefined, fl: combat.flaring ? 1 : 0, x: +player.pos.x.toFixed(1), z: +player.pos.z.toFixed(1) });
      bossHitQ = 0; sacQ = null;
    }
    function hitCrystal(id) {   // Crystal Vein Hall minigame: strike a crystal while it glows
      const c = mine.crystals.find(x => x.id === id); if (!c) return; run.crystals.set(id, performance.now() + 25000); c.cool = true;
      pickups.spawn('rustcog', c.x, c.z, 1); for (let i = 0; i < 3; i++) pickups.spawn('ember', c.x, c.z, 4); save.crystals++;
      burstAt(c.x, c.z, ['#8ad8ff', '#ffffff', '#4ab0ff'], 36, 1.6); audio.play('sfx_vein_reveal', { rate: 1.3 }); ui.toast('💎 Perfect strike! The crystal sheds a Rustcog'); markDirty();
    }
    let flareTick = 0;
    function flareEffects(dt) {
      if (!combat.flaring) { flareTick = 0; return; }
      flareTick -= dt; if (flareTick > 0) return; flareTick = 0.5;
      const r = combat.radius;
      for (const e of renderList()) { const d = DEF[e.type]; if (d.shadow && Math.hypot(e.x - player.pos.x, e.z - player.pos.z) < r) { hitQueue.push([e.id, 6]); views.flash(e.id); const [sx, sy] = toScreen(e.x, 2.4, e.z); ui.float('6🔥', sx, sy, 'gain'); } }
      const b = boss[area], now = net.now();
      if (area === 'caves' && b && b.ph === 2 && now >= (b.phAt || 0)) caves.sacs.forEach((s, i) => { if (b.sacs?.[i] && sacQ == null && Math.hypot(s.x - player.pos.x, s.z - player.pos.z) < Math.max(3.5, r * 0.6)) sacQ = i; });
      if (area === 'mine' && b && !b.dead && b.ph >= 2 && now >= (b.phAt || 0) && now >= b.stunUntil && Math.hypot(b.x - player.pos.x, b.z - player.pos.z) < 6.5) sacQ = 0;   // host checks you're behind him
      if (area === 'throne' && b && !b.dead && b.night && !(b.aur > now)) throne.braziers.forEach((z, i) => { if (sacQ == null && !(b.braz?.[i] > now) && Math.hypot(z.x - player.pos.x, z.z - player.pos.z) < 3.6) sacQ = i; });
      if (area === 'throne') throne.posts.forEach(p => { if (!p.lit && Math.hypot(p.x - player.pos.x, p.z - player.pos.z) < 3.4) usePost(p.id, true); });
      if (area === 'caves') revealVeins();
    }

    // ---------- render records + damage resolution ----------
    function renderList() {
      if (!isDun(area)) return [];
      if (net.isHost()) { const sim = sims[area]; return sim ? sim.list.map(e => ({ id: e.id, type: e.type, x: e.x, z: e.z, hpPct: e.hp / e.maxHp * 100, st: e.st, lit: e.lit, broken: e.broken, atkAt: e.atkAt, ax: e.ax, az: e.az, facing: e.facing, dir: e.dir, k: e.k || 0, bx: e.bx, bz: e.bz, bd: e.bd, bl: e.bl })) : []; }
      return [...interp.values()];
    }
    const pending = new Map();   // attack key -> { s, t1, dmg, slow, id, src, bossAt }
    function scheduleAttacks(recs, b, now) {
      const add = (sh, src, id) => { if (pending.has(sh.key) || now > sh.t1 + 150) return; const P = { ...sh, src, id, t0: sh.t0 }; pending.set(sh.key, P);
        const dist = Math.hypot(sh.s.x - player.pos.x, sh.s.z - player.pos.z), win = (sh.t1 - now) / 1000;
        if (src === 'enemy') { if (dist > 24) return; audio.telegraph(win, 0.8); const type = recs.find(r => r.id === id)?.type, E = ENEMY_SFX[type]; if (!E?.attack) return;
          const k = recs.find(r => r.id === id)?.k || 0, A = DEF[type].atks[k];
          if (type === 'golem' && k === 1) P.sfx = { name: E.slam, at: sh.t1 };   // bass-heavy slam lands on impact
          else P.sfx = E.fit ? { name: E.attack, at: sh.t0, fit: (sh.t1 - sh.t0) / 1000 } : { name: E.attack, at: E.atImpact ? sh.t1 : sh.t0 + A.windup * 1000, rate: E.rate || 1, voices: E.voices }; }
        else if (src === 'hazard') { if (dist < 30) { audio.play(ENEMY_SFX.foreman.horn, { minGap: 0.5 }); audio.telegraph(win, 0.6); } }
        else { if (dist > 40) return; const first = /:0$/.test(sh.key) || !/:\d+$/.test(sh.key.slice(3)); if (first) audio.telegraph(Math.min(1, win), 1);
          const S = BOSS_SFX_AT[sh.sfx]; if (S) P.sfx = { name: S[0], at: S[1] === 't0' ? sh.t0 : S[1] === 'pre' ? sh.t1 - 650 : sh.t1, rate: S[2], voices: sh.sfx === 'icicle' ? 3 : 0 }; } };
      for (const r of recs) for (const sh of enemyShapes(r)) add(sh, 'enemy', r.id);
      if (b && isDun(area)) for (const sh of bossShapes(b, DUNS[area].L.den)) add(sh, 'boss', null);
      const summonAtk = { mossmaw: 3, foreman: 4, queen: 3 }[b?.id];
      if (b && b.atk === summonAtk && b.atkAt && !pending.has(`sum:${b.atkAt}`)) { pending.set(`sum:${b.atkAt}`, { key: `sum:${b.atkAt}`, s: null, t1: b.atkAt, src: 'roar' }); audio.play(ENEMY_SFX.boss.roar); }
      if (area === 'mine' && !combat.down) MINE.lanes.forEach((L, i) => { const t1 = laneNext(i, now); if (t1 - now > CART_WARN) return;
        add({ key: `cart${i}:${t1}`, s: { kind: 'line', x: L.x0 - 3, z: L.z, dir: Math.PI / 2, len: L.x1 - L.x0 + 6, w: 2.4 }, t0: t1 - CART_WARN, t1, dmg: 2 }, 'hazard', null); });
    }
    function resolveAttacks(recs, b, now) {
      const alive = new Set(recs.map(r => r.id)), dmgMul = save.gloomPlus ? GLOOM.dmg : 1;
      for (const [k, a] of pending) {
        if (a.src === 'enemy' && !alive.has(a.id) && now < a.t1) { pending.delete(k); telegraphs.clear(k); continue; }
        if (a.src === 'boss' && (!b || b.dead || (b.stunUntil > now && now < a.t1))) { pending.delete(k); telegraphs.clear(k); continue; }
        if (a.s) telegraphs.show(k, a.s, a.t0 / 1000, a.t1 / 1000);
        if (a.sfx && now >= a.sfx.at) { const x = a.sfx; a.sfx = null; if (x.fit) audio.playFit(x.name, x.fit); else if (x.voices) audio.playCapped(x.name, x.voices, { rate: x.rate }); else audio.play(x.name, { rate: x.rate, minGap: 0.05 }); }   // golem_charge: fit to the window; wraith_wail: voice-capped
        if (now >= a.t1) {
          if (a.s && !a.done) { a.done = true;
            const safe = a.s.safeY != null && player.pos.y >= a.s.safeY;   // Flood Wave: stand on a minecart
            if (!safe && inShape(a.s, player.pos.x, player.pos.z) && player.pos.y < 2.2) { const n = combat.takeDamage(Math.ceil(a.dmg * dmgMul), { slow: a.slow, root: a.root });
              if (n && a.steal) { combat.glow = Math.max(0, combat.glow - a.steal); ui.toast('🦇 A bat gulped some of your glow!', 1400); }
              if (n && a.src === 'enemy' && DEF[recs.find(r => r.id === a.id)?.type]?.shadow && stats().thorn) { hitQueue.push([a.id, 14]); views.flash(a.id); } }
            if (a.src === 'boss') { shake = Math.max(shake, 0.25); const col = b?.id === 'queen' ? ['#bfe8ff', '#ffffff'] : b?.id === 'foreman' ? ['#8ad8ff', '#5a6170'] : ['#9dff7a', '#5a3a26']; particles.burst(V(a.s.x, 0.3, a.s.z), col, 14, 4, { up: 3, size: 0.14 }); }
            if (a.src === 'hazard') particles.burst(V(player.pos.x, 0.5, a.s.z), ['#ffcf7a', '#8a5a3a'], 10, 3, { up: 2 });
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
      publishT -= dt; const pub = publishT <= 0; if (pub) publishT = 0.2;
      for (const a of Object.keys(DUNS)) {
        const targets = playersIn(a);
        if (targets.length) ensureSim(a);
        const sim = sims[a]; if (!sim) continue;
        if (!targets.length) { emptyT[a] = (emptyT[a] || 0) + dt; if (emptyT[a] > (sim.dun.bossDead ? 20 : 60) && (sim.list.length || sim.dun.posts.some(Boolean) || sim.dun.wave || sim.dun.bossDead || sim.dun.levers?.some(Boolean))) { sim.reset(); emptyT[a] = 0; } }
        else { emptyT[a] = 0; sim.step(dt, targets); }
        if (pub) {
          if (sim.dirty || sim.list.length) { net.setState(`en.${a}`, packEnemies(sim.list, net.now())); sim.dirty = false; }
          if (sim.bossDirty) { const pb = sim.packBoss(); net.setState(`boss.${a}`, pb); boss[a] = pb; sim.bossDirty = false; } }
        else if (sim.bossDirty) boss[a] = sim.packBoss();   // host renders its own boss without waiting for the echo
      }
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
    let prevKeys = new Set(), stepT = 0, prevGround = true, poolT = 0, downT = 0, wispMesh = null, gameT = 0, liftT = 0;
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
      save.stats.deaths++; saveNow(); audio.stinger('sfx_guttered');
      const D = DUNS[area], d = dun[area], lit = d?.posts ? d.posts.map((v, i) => v ? i : -1).filter(i => i >= 0) : [];
      const post = D && lit.length ? D.L.posts[lit[lit.length - 1]] : null;
      ui.fade(true);
      setTimeout(() => { if (disposed) return; if (D) player.teleport(post ? V(post.x - 1.5, 0, post.z + 1.5) : V(...D.L.arrive), D.L.arriveFacing); else player.teleport(V(0, 0, 8), Math.PI);
        combat.reset(true); announce(true); ui.fade(false); ui.banner('Your lantern guttered…', lost ? `${lost} embers drifted away as an Ember Wisp. Go get them!` : 'Back at the last lamp post', 3000); }, 600);
    }

    function bossStatus(b, now) {
      if (now < b.stunUntil) return '✨ STUNNED: strike now!';
      if (b.id === 'mossmaw') return b.ph === 2 ? 'Armoured · FLARE a glowing spore sac' : '';
      if (b.id === 'foreman') return b.ph === 2 ? 'Armoured · get behind him and FLARE his vents' : 'Stand on a minecart when the Flood Wave comes';
      if (b.id === 'queen') { if (b.night) { if (b.aur > now) return `🌌 REKINDLED AURORA · double damage (${Math.ceil((b.aur - now) / 1000)}s)`; const n = (b.braz || []).filter(x => x > now).length; return `🌑 Long Night · invulnerable · braziers ${n}/4 (FLARE them)`; } return b.ph === 2 ? 'Phase 2 · beware mirror clones' : ''; }
      return '';
    }
    let fwT = 0;
    function fireworks(dt) { fwT -= dt; if (fwT > 0) return; fwT = 0.9 + Math.random() * 1.4; const a = Math.random() * 6.28, r = 10 + Math.random() * 18, cols = [['#ff8a5a', '#ffd27a'], ['#9affd8', '#ffffff'], ['#d0a8ff', '#ff8fd0'], ['#7ad0ff', '#ffffff']][Math.floor(Math.random() * 4)];
      particles.burst(V(Math.cos(a) * r, 16 + Math.random() * 8, Math.sin(a) * r), cols, mobile ? 40 : 70, 7, { up: 1, size: 0.18, life: 1.6, grav: 2.5, drag: 0.6 }); if (Math.random() < 0.5) audio.play('sfx_flare_start', { gain: 0.25, rate: 1.6 + Math.random() * 0.4, minGap: 0.3 }); }
    const game = {
      scene, collision, occluders: village.occluders, spawn: V(...AREAS.village.spawn), spawnFacing: AREAS.village.facing, maxCamDist: 16,
      onFall: () => player.teleport(V(...AREAS[area].spawn), AREAS[area].facing),
      onClick: ({ button }) => { if (button === 0 && !ui.modalOpen && !traveling) taps.add('KeyK'); },
      update(dt, t) {
        audio.tick();
        const now = net.now(), modal = ui.modalOpen;
        player.enabled = !modal && !traveling; player.flying = false;
        // keys
        gameT = t; if (pressed('KeyJ')) onAct('journal'); if (pressed('KeyP')) onAct('party'); if (pressed('KeyN')) onAct('map');
        if (pressed('Escape') && modal) ui.closeModal();
        // host simulation
        hostTick(dt); if (!net.isHost()) smoothClients(dt);
        const recs = renderList(), b = isDun(area) ? boss[area] : null, DA = DUNS[area];
        // combat
        const targets = hitTargets();
        let regen = 1; if (DA && DA.w.posts.some(p => p.lit && Math.hypot(p.x - player.pos.x, p.z - player.pos.z) < 6)) regen = 4; else if (inSharedLight()) regen = 2;
        if (!modal && !traveling) combat.update(dt, t, { pressed, held, targets, collision, regenMul: regen });
        flareEffects(dt);
        if (DA && combat.glow <= 0 && !combat.down && save.oil > 0) { save.oil--; combat.glow = Math.min(stats().glow, OIL.refill); audio.play('sfx_lantern_refill'); ui.toast(`🛢️ Lantern Oil used (${save.oil} left)`, 1800); markDirty(); }
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
        const realDt = Math.min(0.5, (performance.now() - (game._lastT || performance.now())) / 1000); game._lastT = performance.now();   // hold timers are wall-clock
        if (ally) { if (held('KeyE')) { reviveHold += Math.max(dt, realDt); if (reviveHold >= 2.5) { reviveHold = 0; net.sendEvent('revive', { t: ally.id }); } } else reviveHold = 0; ui.prompt(`Hold to revive ${ally.name}`, 'E', reviveHold > 0 ? reviveHold / 2.5 : null); }
        else { reviveHold = 0; const it = modal || combat.down ? null : nearestInteractable(); const txt = it ? promptFor(it) : null; ui.prompt(txt); if (txt && pressed('KeyE')) interact(it); }
        prevKeys = new Set(input.keys); taps.clear();
        // views
        const gone = views.update(recs, dt, t, now); for (const g of gone) { if (DA) burstAt(g.x, g.z, ['#ffd27a', '#ffffff'], 10); }
        for (const [a, bv] of Object.entries(bossViews)) bv.update(area === a ? b : null, dt, t, now);
        if (b && !b.dead && DA) { const r = BOSSES[b.id]?.r || 3; bossCircle.x = b.x; bossCircle.z = b.z; bossCircle.r = r; if (!collision.circles.includes(bossCircle)) collision.circles.push(bossCircle); } else { const i = collision.circles.indexOf(bossCircle); if (i >= 0) collision.circles.splice(i, 1); }
        if (area === 'caves' && b) caves.setSacs(b.sacs || [1, 1, 1, 1]);
        // pickups
        for (const g of pickups.update(dt, t, player.pos, stats().magnet)) grant(g);
        updateWisp(t); updateGhosts(t);
        // lantern light + decals
        const s = stats(), r = combat.radius;
        handLantern.getWorldPosition(tmpV); lanternLight.position.copy(tmpV).add(V(0, 0.4, 0));
        const glowK = combat.glow <= 0 ? 0.45 : 1;
        lanternLight.intensity = (combat.flaring ? 34 : 16) * glowK * (1 + Math.sin(t * 9) * 0.04 + Math.sin(t * 17.3) * 0.03) * (combat.down ? 0.35 : 1); lanternLight.distance = r * 2.4;
        lightDecal.position.set(player.pos.x, player.pos.y + 0.06, player.pos.z); lightDecal.scale.setScalar(r); lightDecal.material.opacity = area === 'caves' || area === 'mine' ? 0.2 : 0.1;
        flareRing.position.set(player.pos.x, player.pos.y + 0.08, player.pos.z); flareRing.scale.setScalar(r); flareRing.material.opacity = combat.flaring ? 0.5 + Math.sin(t * 12) * 0.2 : 0;
        if (handLantern.userData.flame) { handLantern.userData.flame.scale.setScalar(combat.flaring ? 1.6 : 1); handLantern.userData.flame.scale.y = (combat.flaring ? 2.4 : 1.5) + Math.sin(t * 13) * 0.2; }
        if (armL && !combat.down) armL.rotation.x = (combat.flaring ? -2.4 : -0.45) + Math.sin(t * 2) * 0.03;
        // steps / jump / land
        const moving = Math.hypot(player.vel.x, player.vel.z) > 1 && player.onGround && !combat.dashing;
        if (moving) { stepT -= dt; if (stepT <= 0) { stepT = combat.down ? 0.6 : 0.32; audio.step(area === 'village' || area === 'throne' ? 'snow' : 'stone'); } } else stepT = 0.05;
        if (prevGround && !player.onGround && player.vel.y > 4) audio.play('sfx_jump', { gain: 0.7 });
        if (!prevGround && player.onGround) audio.play('sfx_land', { gain: 0.6 });
        prevGround = player.onGround;
        // world + lighting
        const p = player.pos;
        moon.position.set(p.x - 25, 45, p.z - 15); moon.target.position.set(p.x, 0, p.z);
        const bossLive = b && !b.dead, ph2 = bossLive && b.ph >= 2 && now >= (b.phAt || 0);
        const ph2dark = (area === 'caves' || area === 'mine') && ph2 ? (now < b.stunUntil ? 0.5 : 1) : area === 'throne' && bossLive && b.night ? (b.aur > now ? 0 : 0.85) : 0;
        hemi.intensity += ((hemi.userData.base ?? 0.7) * (1 - ph2dark * 0.7) - hemi.intensity) * Math.min(1, dt * 2);
        lights.update(t, p, area);
        if (sky.mesh.visible) sky.update(t, p);
        if (area === 'village') { snow.update(dt, t, p); village.update(dt, t); decor.update(t); if (save.hearth >= 5 || save.ending) fireworks(dt); }
        if (area === 'caves') caves.update(dt, t, { center: p, dark: ph2dark, sacPhase: !!ph2 });
        if (area === 'mine') { liftT = Math.max(0, liftT - dt); mine.update(dt, t, { center: p, dark: ph2dark, now, lampSwing: bossLive && b.atk === 3 && now < b.atkAt + 400 ? (b.pts || []).map(x => x[0] / 100) : null }); }
        if (area === 'throne') throne.update(dt, t, { center: p, braz: bossLive && b.braz ? b.braz.map(x => x > now) : null, night: bossLive && b.night ? 1 : 0, aurora: bossLive && b.aur > now });
        particles.update(dt); camClip(dt);
        // music: crossfade to the boss loop in the arena; the Queen's intense layer rises with her phases
        const inDen = DA && Math.hypot(p.x - DA.L.den.x, p.z - DA.L.den.z) < DA.L.den.r + 1, fight = inDen && bossLive;
        audio.setMusic(fight ? BOSSES[b.id].music : `bgm_${area}`);
        if (fight && b.id === 'queen') audio.setIntensity(b.ph >= 3 && now >= (b.phAt || 0) ? 1 : b.ph >= 2 && now >= (b.phAt || 0) ? 0.5 : 0); else if (audio.intensity) audio.setIntensity(0);
        // HUD
        ui.setVitals({ hp: combat.hp, maxHp: combat.maxHp, glow: combat.glow, maxGlow: s.glow, power: s.power, flaring: combat.flaring, dashCharges: combat.dash.charges, dashMax: s.charges, tonics: save.tonics, title: save.title });
        ui.setEmbers(save.embers, carried, save.mats);
        ui.setQuests(quests.tracked().map(({ q, r: qr }) => ({ title: q.title, p: qr?.p || 0, goal: q.goal, ready: !!qr?.done })), quests.readyCount() || '', trackerHint());
        ui.setBoss(fight ? { name: BOSSES[b.id].name, hp: b.hp, max: b.max, status: bossStatus(b, now) } : null);
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
        audio.stop(); ui.dispose(); combat.dispose(); net.dispose?.(); lights.dispose(); views.clear(); Object.values(bossViews).forEach(v => v.dispose());
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
      get isHost() { return net.isHost(); }, get transport() { return net.transport; }, get enemies() { return renderList(); }, get boss() { return boss[area] || boss.caves; }, get dun() { return dun[area] || dun.caves; }, get bosses() { return boss; }, get duns() { return dun; },
      get sfx() { return audio.loaded; }, get interactable() { return nearestInteractable()?.id || null; }, get modal() { return ui.modalTag; }, get pending() { return pending.size; },
      get music() { return { bgm: audio.want.bgm, cur: audio.cur.bgm?.name || null, intensity: audio.intensity }; },
      player, collision, travel, openWaystone, openJournal, openMap, openGiver, openHearth, quests, CAVE, MINE, THRONE,
    };
    if (testMode) Object.defineProperties(hooks, Object.getOwnPropertyDescriptors({   // descriptors keep getters live
      warpTo(x, z, facing = 0) { player.teleport(V(x, 0, z), facing); const a = areaAt(x, z); if (a && a !== area) { area = a; applyLook(a); audio.setArea(a); views.clear(); interp.clear(); applySnap(a); } },
      give(o) { for (const [k, v] of Object.entries(o)) { if (k === 'embers') save.embers += v; else if (k in save.mats) save.mats[k] += v; else if (k === 'carried') carried += v; } markDirty(); },
      setSave(o) { save = normalizeSave({ ...save, ...o }); },
      damageAll(n = 999) { if (!net.isHost()) return; const sim = sims[area]; for (const e of [...(sim?.list || [])]) { if (e.st === ST.burrowed) e.st = ST.exposed; for (let k = 0; k < 20 && sim.list.includes(e); k++) sim.applyHit(e.id, n, { flare: 1 }); } },
      damageBoss(n) { for (let k = 0; k < Math.ceil(n / 60); k++) sims[area]?.hitBoss(Math.min(60, n - k * 60)); }, burstSac(i, x, z) { return sims[area]?.hitBoss(0, { sac: i, x, z }); },
      god(on = true) { if (on && !combat._td) { combat._td = combat.takeDamage; combat.takeDamage = () => 0; } else if (!on && combat._td) { combat.takeDamage = combat._td; delete combat._td; } },
      openGate() { const s = sims[area]; if (s) { s.dun.gate = 0; s.dirtyDun(); } }, killAdds() { const s = sims[area]; if (s) for (const e of [...s.list]) if (e.boss) s.kill(e); },
      hurt(n) { combat.iframes = 0; return combat.takeDamage(n); }, press(code) { taps.add(code); },
      addAlly(o = {}) { const f = net.addFake?.({ id: o.id || 'Pip', name: o.name || 'Pip', position: { x: player.pos.x + 1.5, y: 0, z: player.pos.z }, down: !!o.down }); if (!f) return null;
        net.fakeEvent(f.id, 'at', { a: area, hp: o.down ? 0 : 6, mhp: 6, pw: 3, dn: !!o.down, r: 6, name: f.name }); return f.id; },
      allyDown(id, down = true) { const f = net.fakes?.find(x => x.id === id); if (f) { f.down = down; net.fakeEvent(id, 'at', { a: area, hp: down ? 0 : 6, mhp: 6, pw: 3, dn: down, r: 6, name: f.name }); } },
      allyRevivesMe(id) { const f = net.fakes?.find(x => x.id === id); if (!f) return; f.position = { x: player.pos.x + 1, y: 0, z: player.pos.z }; net.fakeEvent(id, 'revive', { t: me() }); },
      sims, net, pickups, get allyNear() { return downedAllyNear(); }, get reviveHold() { return reviveHold; }, get modalOpen() { return ui.modalOpen; },
    }));
    if (testMode) window.__lh = hooks;

    // ---------- start ----------
    decor.set(save.hearth); if (!save.bounties.length) quests.refreshBounties();
    if (throneOpen(save) && !save.unlocked.includes('throne')) save.unlocked.push('throne');
    applyLook('village'); ui.setArea(AREAS.village.name); audio.setArea('village');
    ui.banner(AREAS.village.name, save.quests.lh_q_first_light ? 'Welcome back, light-bearer' : 'Elder Wick is waiting by the Quest Board', 3200);
    if (!save.quests.lh_q_first_light && !save.tracked.length) ui.toast('❗ Talk to <b>Elder Wick</b> (by the Quest Board) to begin', 5000);
    announce(true);
    return game;
  },
};
