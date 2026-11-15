// Game: Frostlings — cozy creature-taming adventure.
// Snowdrift Village hub (Care Den, Snow Shop, Quest Board, Frostdex, Battle Ring) + 4 areas (Pinefrost Meadow,
// Crystal Caverns, Tidepool Coast, Aurora Peak) unlocked by beating each area's tamer. Walk into a wild Frostling
// for a turn-based battle (party of 3, type chart, chill/sleep/burn), weaken it and throw a snare to tame it.
// Level up (cap 20), learn moves, evolve, raise bond, fill the Frostdex, turn in quests, rank up.
// MP: shared world (platform avatars) + your lead Frostling visible to others + emotes + friendly PvP duels at the Ring.
// Files: config.js (data), battle.js (pure rules), models.js, world.js, audio.js, ui.js, panels.js, thumb.js.
import * as THREE from 'three';
import { Collision } from '../../engine/collision.js';
import { getDeviceMode } from '../../core/device.js';
import * as C from './config.js';
import * as B from './battle.js';
import { buildFrostling, animFrostling, flash, buildSnare, buildTamer, renderPortraits, clearMatCache } from './models.js';
import { buildWorld, buildStage, textSprite } from './world.js';
import { FrostAudio } from './audio.js';
import { FrostUI, typeBadge } from './ui.js';
import { createPanels } from './panels.js';
import { drawThumb } from './thumb.js';
import { createBattle } from './battleFlow.js';

const { SPECIES_BY_ID: SP, TYPES, AREAS, TAMERS, ITEMS } = C;
function loadSave(economy) {
  const raw = (economy.profile?.gameData || {})[C.GAME_ID] || {};
  const s = { ...structuredClone(C.DEFAULT_SAVE), ...raw };
  s.stats = { ...C.DEFAULT_SAVE.stats, ...(raw.stats || {}) }; s.stats.areaWins = { ...(raw.stats?.areaWins || {}) };
  s.items = { ...(raw.items || C.DEFAULT_SAVE.items) };
  s.mons = (s.mons || []).filter(m => SP[m.sp]); s.party = (s.party || []).filter(u => s.mons.some(m => m.uid === u));
  return s;
}
function persist(economy, save) {
  economy.profile.gameData = { ...(economy.profile.gameData || {}), [C.GAME_ID]: save };
  if (typeof economy.saveGameData === 'function') economy.saveGameData(C.GAME_ID, save);
  else economy.backend?.saveProfile?.(economy.profile);
}
const rand = (a, b) => a + Math.random() * (b - a);
const hash = (s) => { let h = 2166136261; for (const ch of String(s)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
let _thumb = null;

export default {
  id: C.GAME_ID, name: 'Frostlings', tagline: 'Tame, raise and battle adorable ice creatures!',
  description: 'Explore Snowdrift Village and four frosty lands, walk into wild Frostlings and tame them in cozy turn-based battles. 24 species across 6 elements, evolutions, bonds, hats, quests, area tamers, legendary Frostlings under the aurora, and friendly duels with other tamers at the Battle Ring.',
  get thumbnail() { if (!_thumb) { try { _thumb = drawThumb(); } catch { _thumb = 'frost'; } } return _thumb; },
  music: 'none',
  mobile: true,

  async create(ctx) {
    const { economy, engine, music } = ctx;
    const player = engine.player, cam = engine.camera;
    const mobile = getDeviceMode() === 'mobile';
    const G = { save: loadSave(economy) };   // shared state bag for split modules
    const BOUNDS = { type: 'box', minX: -175, maxX: 175, minZ: -175, maxZ: 175 };
    const collision = new Collision({ floorY: 0, bounds: BOUNDS });
    const world = buildWorld(collision);
    const { scene, glowTex } = world;
    const audio = new FrostAudio(music);
    const portraits = renderPortraits(C.SPECIES.map(s => s.id));
    const mp = engine.mp || window.iceberg?.mp || null;
    const has = (k) => mp && typeof mp[k] === 'function';
    const localId = () => { try { return has('localId') ? String(mp.localId()) : 'local'; } catch { return 'local'; } };
    const nowMs = () => { try { return has('now') ? mp.now() : Date.now(); } catch { return Date.now(); } };
    const offs = [];
    const myHash = hash(localId() + ':' + Math.random().toString(36).slice(2, 6));
    const stage = buildStage(scene, 1200 + (myHash % 6) * 160, 1200 + ((myHash >> 4) % 6) * 160);
    let timeOffset = 0;
    const dayPhase = () => (((nowMs() / 1000 + timeOffset) % C.DAY_SECS) + C.DAY_SECS) % C.DAY_SECS / C.DAY_SECS;
    Object.assign(G, { alive: true, mode: 'world', mobile, economy, engine, player, cam, collision, world, scene, audio, portraits, stage, BOUNDS, dayPhase, mp, has, localId });

    // ---------- particles ----------
    const NP = 700, pGeo = new THREE.BufferGeometry(), pPos = new Float32Array(NP * 3), pCol = new Float32Array(NP * 3);
    pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3)); pGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 3));
    const pts = new THREE.Points(pGeo, new THREE.PointsMaterial({ size: 0.45, map: glowTex, vertexColors: true, transparent: true, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending }));
    pts.frustumCulled = false; scene.add(pts);
    const parts = Array.from({ length: NP }, () => ({ life: 0, max: 1, p: new THREE.Vector3(), v: new THREE.Vector3(), c: new THREE.Color(), g: 0 }));
    let pNext = 0;
    G.burst = function burst(x, y, z, n, color, speed = 5, grav = 6, life = 0.8, dir = null) {
      const base = new THREE.Color(color);
      for (let i = 0; i < n; i++) {
        const q = parts[pNext]; pNext = (pNext + 1) % NP;
        q.p.set(x, y, z); q.v.set(rand(-1, 1), rand(-0.2, 1.3), rand(-1, 1)).normalize().multiplyScalar(speed * rand(0.3, 1));
        if (dir) q.v.addScaledVector(dir, speed * 0.6);
        q.c.copy(base).offsetHSL(0, 0, rand(-0.08, 0.08)); q.life = q.max = life * rand(0.6, 1.2); q.g = grav;
      }
    };
    const burst = G.burst;
    const popPool = [];
    G.pop = function pop(text, x, y, z, color = '#fff36b', scale = 1) {
      let s = popPool.find(p => p.t <= 0); if (!s) { if (popPool.length > 12) s = popPool[0]; else { s = { spr: null, t: 0 }; popPool.push(s); } }
      if (s.spr) { scene.remove(s.spr); s.spr.material.map.dispose(); s.spr.material.dispose(); }
      s.spr = textSprite(text, { color, size: 1.2 * scale, px: 60 }); s.spr.position.set(x, y, z); s.vy = 2.4; s.t = 1.0; s.base = s.spr.scale.clone(); scene.add(s.spr);
    };
    const tweens = []; G.fx = { hitstop: 0, shake: 0 };
    G.tween = (dur, fn) => new Promise(res => tweens.push({ t: 0, dur, fn, res }));

    // ---------- save helpers ----------
    const monBy = G.monBy = (uid) => G.save.mons.find(m => m.uid === uid);
    const partyMons = G.partyMons = () => G.save.party.map(monBy).filter(Boolean);
    G.addMon = (spId, lv) => { const s = G.save, m = B.makeMon(spId, lv, s.nextUid++); s.mons.push(m); if (s.party.length < C.PARTY_MAX) s.party.push(m.uid); return m; };
    G.setDex = (spId, v) => { const was = G.save.dex[spId] || 0; if (v > was) G.save.dex[spId] = v; return was; };
    let saveT = 0;
    const commit = G.commit = () => { saveT = 0; persist(economy, G.save); };
    const maxBond = () => Math.max(0, ...G.save.mons.map(m => B.bondLevel(m.bond)));
    const unlocked = G.unlocked = (areaId) => { const u = AREAS[areaId].unlock; return !u || G.save.beaten.includes(u); };

    G.checkMilestones = function () {
      for (const m of C.MILESTONES) {
        if (G.save.milestones.includes(m.id) || !m.test(G.save)) continue;
        G.save.milestones.push(m.id);
        try { economy.earn(m.bb, `Frostlings: ${m.label}`, { source: 'Frostlings' }); } catch { /* */ }
        ui.toast(`🏅 <b>+${m.bb} BB</b> · ${m.label}`, 4500);
      }
    };
    G.addRankXp = function (n) {
      const s = G.save; if (s.rank >= C.RANK_MAX) return;
      s.rankXp += n;
      while (s.rank < C.RANK_MAX && s.rankXp >= C.RANK_XP(s.rank)) { s.rankXp -= C.RANK_XP(s.rank); s.rank++; audio.sfx('sfx_quest_complete'); ui.banner(`⭐ Tamer Rank ${s.rank}!`, 'new shop stock unlocked', 2200); }
      G.checkMilestones();
    };
    // ---------- quests ----------
    const questState = G.questState = (q) => {
      const g = q.goal, s = G.save; let have = s.quests[q.id] || 0;
      if (g.t === 'beat') have = s.beaten.includes(g.tamer) ? 1 : 0;
      else if (g.t === 'dex') have = C.dexCount(s);
      else if (g.t === 'bond') have = maxBond();
      return { have, n: g.n, ready: have >= g.n };
    };
    const activeQuests = G.activeQuests = () => C.QUESTS.filter(q => !G.save.questDone.includes(q.id)).slice(0, 4);
    const readyNotified = new Set();
    G.questEvent = function (t, data = {}) {
      for (const q of activeQuests()) {
        const g = q.goal; if (g.t !== t) continue;
        if (t === 'winArea' && g.area !== data.area) continue;
        if (t === 'catchType' && g.type !== data.type) continue;
        if (t === 'catchSpecies' && g.species !== data.species) continue;
        G.save.quests[q.id] = (G.save.quests[q.id] || 0) + 1;
      }
      G.notifyReady();
    };
    G.notifyReady = function () {
      for (const q of activeQuests()) if (questState(q).ready && !readyNotified.has(q.id)) { readyNotified.add(q.id); audio.sfx('sfx_quest_complete'); ui.toast(`📜 Quest ready: <b>${q.name}</b> — turn in at the Quest Board!`, 4500); }
    };
    function turnIn(q) {
      const s = G.save; if (!questState(q).ready || s.questDone.includes(q.id)) return;
      s.questDone.push(q.id); const r = q.reward;
      s.flakes += r.flakes || 0; for (const [k, v] of Object.entries(r.items || {})) s.items[k] = (s.items[k] || 0) + v;
      audio.sfx('sfx_quest_complete'); burst(player.pos.x, 2.5, player.pos.z, 40, '#ffd24a', 6, 3, 1.2);
      ui.banner('📜 Quest complete!', q.name, 2000);
      ui.toast(`+${r.flakes} ❄ ${Object.entries(r.items || {}).map(([k, v]) => `+${v} ${ITEMS[k].icon}`).join(' ')}`);
      G.addRankXp(r.rankXp || 0); G.notifyReady(); commit();
    }

    // ---------- UI + panels ----------
    const ui = G.ui = new FrostUI(mobile, {
      onButton: (b) => openPanel(b), onEmote: (i) => emote(i), onInteract: () => interact(),
      onClick: () => audio.sfx('ui_click'), onModalClosed: () => { commit(); refreshCompanion(); },
    });
    const panels = G.panels = createPanels({ ui, C, B, portraits, audio, get save() { return G.save; }, monBy, partyMons, questState, activeQuests, turnIn, commit, checkMilestones: () => G.checkMilestones(), questEvent: (...a) => G.questEvent(...a),
      heal: (m, amt) => { const mx = B.statsOf(m).hp; m.hp = Math.min(mx, (m.hp || 0) + Math.round(mx * amt)); if (amt >= 1) m.status = null; },
      onRest: () => { burst(player.pos.x, 2, player.pos.z, 40, '#5be37d', 4, -1, 1.2); }, refreshCompanion: () => refreshCompanion(),
      challengeRing: () => battle.startRing(), challengePlayer: (id, name) => battle.requestDuel(id, name), nearbyPlayers: () => nearbyPlayers(10), atBoard: () => prompt?.id === 'quests' });
    function openPanel(id) { if (G.mode !== 'world') return; audio.sfx('ui_click'); panels.open(id); }

    // ---------- companion ----------
    let comp = null;
    function refreshCompanion() {
      const lead = partyMons()[0];
      const sig = lead ? lead.sp + ':' + (lead.hat || '') : '';
      if (comp?.sig === sig) return;
      if (comp) scene.remove(comp.mesh);
      comp = null; G.comp = null; if (!lead) return;
      const mesh = buildFrostling(lead.sp, { hat: lead.hat, scale: 0.85 }); mesh.position.copy(player.pos).add(new THREE.Vector3(1.5, 0, 1.5)); scene.add(mesh);
      comp = G.comp = { mesh, sig };
      sendNet({ k: 'pal', sp: lead.sp, hat: lead.hat || null }); lastPalSent = performance.now();
    }
    G.refreshCompanion = refreshCompanion;

    // ---------- wild Frostlings ----------
    const wilds = G.wilds = [];
    const exclaim = textSprite('!', { color: '#ffe066', size: 1.4, px: 90, w: 128 });
    function spawnPool(areaId) {
      const A = AREAS[areaId], ph = dayPhase(), night = C.isNight(ph), aur = C.isAurora(ph);
      return A.pool.filter(([id]) => { const s = SP[id]; if (s.rarity === 'legendary' && !G.save.beaten.includes('borealis')) return false; if (s.aurora) return aur; if (s.night) return night; if (s.day) return !night; return true; });
    }
    function spawnWild(areaId) {
      const A = AREAS[areaId], pool = spawnPool(areaId); if (!pool.length) return;
      const tot = pool.reduce((a, [, w]) => a + w, 0); let r = Math.random() * tot, id = pool[0][0];
      for (const [sid, w] of pool) { r -= w; if (r <= 0) { id = sid; break; } }
      const s = SP[id], lv = s.rarity === 'legendary' ? 18 : Math.round(rand(A.lv[0], A.lv[1]));
      let x, z, tries = 0; do { const a = Math.random() * 6.283, d = rand(8, A.r - 6); x = A.x + Math.cos(a) * d; z = A.z + Math.sin(a) * d; tries++; } while (tries < 10 && Math.hypot(x - player.pos.x, z - player.pos.z) < 14);
      const mesh = buildFrostling(id, { scale: 0.9 }); mesh.position.set(x, 0, z); mesh.rotation.y = Math.random() * 6; scene.add(mesh);
      const tag = textSprite(`${s.name} Lv${lv}`, { color: s.rarity === 'common' ? '#ffffff' : C.RARITY[s.rarity].color, size: 0.55, px: 40 }); tag.position.y = mesh.userData.height / mesh.scale.y + 0.8; mesh.add(tag);
      wilds.push({ id, lv, area: areaId, mesh, pos: mesh.position, goal: new THREE.Vector3(x, 0, z), wait: rand(0, 2), bold: Math.random() < 0.45, seen: false, cool: 0, sparkle: s.rarity === 'rare' || s.rarity === 'legendary' });
      G.setDex(id, 1);
    }
    G.removeWild = function (w) { const i = wilds.indexOf(w); if (i >= 0) wilds.splice(i, 1); if (exclaim.userData.w === w) { exclaim.removeFromParent(); exclaim.userData.w = null; } scene.remove(w.mesh); w.mesh.traverse(o => { if (o.isSprite && o !== exclaim) { o.material.map?.dispose(); o.material.dispose(); } }); };
    let spawnT = 0;
    function manageWilds(dt) {
      spawnT -= dt;
      for (const w of [...wilds]) { const A = AREAS[w.area]; if (Math.hypot(player.pos.x - A.x, player.pos.z - A.z) > A.r + 80) G.removeWild(w); }
      if (spawnT > 0) return; spawnT = 1.2;
      for (const id of C.AREA_ORDER) {
        const A = AREAS[id]; if (!unlocked(id)) continue;
        if (Math.hypot(player.pos.x - A.x, player.pos.z - A.z) > A.r + 45) continue;
        const n = wilds.filter(w => w.area === id).length; if (n < 7) spawnWild(id); if (n < 3) spawnWild(id);
      }
      for (const w of [...wilds]) { if (!spawnPool(w.area).some(([id]) => id === w.id) && Math.hypot(w.pos.x - player.pos.x, w.pos.z - player.pos.z) > 25) G.removeWild(w); }
    }
    function updateWilds(dt, t) {
      for (const w of wilds) {
        const A = AREAS[w.area], dp = Math.hypot(w.pos.x - player.pos.x, w.pos.z - player.pos.z);
        w.cool = Math.max(0, w.cool - dt);
        let moving = 0;
        if (dp < 8 && w.cool <= 0 && G.mode === 'world') {
          if (!w.seen) { w.seen = true; w.alertT = 1.2; }
          if (w.bold) w.goal.set(player.pos.x, 0, player.pos.z);
        }
        w.wait -= dt;
        const dx = w.goal.x - w.pos.x, dz = w.goal.z - w.pos.z, d = Math.hypot(dx, dz);
        if (d > 0.4 && w.wait <= 0) {
          const sp = (w.bold && dp < 8 ? 4.2 : 2.2) * dt; w.pos.x += dx / d * Math.min(sp, d); w.pos.z += dz / d * Math.min(sp, d); moving = 1;
          const ry = Math.atan2(dx, dz); let df = ry - w.mesh.rotation.y; df = Math.atan2(Math.sin(df), Math.cos(df)); w.mesh.rotation.y += df * Math.min(1, dt * 8);
        } else if (w.wait <= 0) { w.wait = rand(1, 4); const a = Math.random() * 6.283, r = rand(4, A.r - 6); w.goal.set(A.x + Math.cos(a) * r, 0, A.z + Math.sin(a) * r); }
        const off = Math.hypot(w.pos.x - A.x, w.pos.z - A.z); if (off > A.r - 3) { w.pos.x = A.x + (w.pos.x - A.x) / off * (A.r - 3); w.pos.z = A.z + (w.pos.z - A.z) / off * (A.r - 3); }
        animFrostling(w.mesh, t, moving, dt);
        if (w.sparkle && Math.random() < dt * 8) burst(w.pos.x + rand(-0.6, 0.6), rand(0.5, 2), w.pos.z + rand(-0.6, 0.6), 1, C.RARITY[SP[w.id].rarity].color, 0.8, -1, 0.9);
        if (w.alertT > 0) { w.alertT -= dt; if (exclaim.userData.w !== w) { w.mesh.add(exclaim); exclaim.userData.w = w; exclaim.position.y = w.mesh.userData.height / w.mesh.scale.y + 1.6; } exclaim.visible = true; exclaim.scale.set(0.55 * 1 + Math.sin(t * 20) * 0.04, 0.55 + Math.sin(t * 20) * 0.04, 1); }
        else if (exclaim.userData.w === w) exclaim.visible = false;
        if (G.mode === 'world' && !ui.modalOpen && w.cool <= 0 && dp < 1.9) { battle.startWild(w); return; }
      }
    }

    // ---------- NPCs ----------
    const npcs = [];
    for (const [id, spot] of Object.entries(world.bossSpots)) {
      const T = TAMERS[id], A = AREAS[T.area];
      const mesh = buildTamer(T.color, { hat: T.color, scale: 1.05 }); mesh.position.set(spot.x, 0, spot.z); mesh.rotation.y = Math.atan2(A.x - spot.x, A.z - spot.z); scene.add(mesh);
      collision.addCircle(spot.x, spot.z, 0.7, 3);
      const tag = textSprite(`⚔ ${T.name}`, { color: '#ffe680', size: 0.8, px: 46 }); tag.position.set(spot.x, 3.7, spot.z); scene.add(tag);
      const pal = buildFrostling(T.team[T.team.length - 1][0], { scale: 0.8 }); pal.position.set(spot.x + 1.8, 0, spot.z + 0.8); pal.rotation.y = mesh.rotation.y; scene.add(pal);
      npcs.push({ id, kind: 'tamer', mesh, pal, x: spot.x, z: spot.z, r: 4.2, label: `Challenge ${T.name}`, icon: '⚔' });
    }
    { const elder = buildTamer('#7a5232', { hat: '#ffffff', skin: '#f2c9a0' }); elder.position.set(-11, 0, -16); elder.rotation.y = 0.6; scene.add(elder); collision.addCircle(-11, -16, 0.6, 3);
      const tag = textSprite('Elder Pine', { color: '#ffffff', size: 0.7, px: 44 }); tag.position.set(-11, 3.4, -16); scene.add(tag);
      npcs.push({ id: 'elder', kind: 'elder', mesh: elder, x: -11, z: -16, r: 3.2, label: 'Talk to Elder Pine', icon: '💬' });
      const champ = buildTamer('#ff5d8a', { hat: '#3fa8ff' }); champ.position.set(6.5, 0.3, 16); champ.rotation.y = -Math.PI / 2; scene.add(champ);
      const ct = textSprite('Ring Champ Juno', { color: '#ffe680', size: 0.7, px: 44 }); ct.position.set(6.5, 3.6, 16); scene.add(ct);
      npcs.push({ id: 'champ', kind: 'champ', mesh: champ, x: 6.5, z: 16, r: 0, label: '', icon: '' }); }
    G.refreshNpcTags = function () { for (const n of npcs) if (n.kind === 'tamer') { const T = TAMERS[n.id]; n.label = G.save.beaten.includes(n.id) ? `Rematch ${T.name}` : `Challenge ${T.name}`; } };
    for (const id of ['caverns', 'coast', 'peak']) if (unlocked(id)) world.openGate(id, true);

    // ---------- interaction ----------
    let prompt = null;
    function findPrompt() {
      if (G.mode !== 'world') return null;
      const px = player.pos.x, pz = player.pos.z; let best = null, bd = Infinity;
      for (const s of world.stations) { const d = Math.hypot(px - s.x, pz - s.z); if (d < s.r && d < bd) { bd = d; best = s; } }
      for (const n of npcs) { if (!n.r) continue; const d = Math.hypot(px - n.x, pz - n.z); if (d < n.r && d < bd) { bd = d; best = n; } }
      return best;
    }
    function interact() {
      if (G.mode !== 'world' || ui.modalOpen || !prompt) return;
      audio.sfx('ui_click');
      const p = prompt;
      if (p.kind === 'tamer') return battle.startTamer(p.id);
      if (p.kind === 'elder') return panels.elder();
      panels.open(p.id);
    }
    // ---------- emotes ----------
    const emotes = [];
    function showEmote(i, getPos) { const spr = textSprite(C.EMOTES[i] || '👋', { size: 1.2, px: 80, w: 128, bg: 'rgba(255,255,255,.92)' }); scene.add(spr); emotes.push({ spr, t: 2.4, getPos }); }
    let emoteCd = 0;
    function emote(i) { if (emoteCd > 0 || G.mode !== 'world') return; emoteCd = 0.8; showEmote(i, () => player.pos); audio.sfx('sfx_care'); sendNet({ k: 'emote', i }); }

    // ---------- multiplayer: pals + emotes + duel messages ----------
    const remotes = new Map();
    let lastPalSent = 0, nearbyCache = [], nearbyT = 0;
    const sendNet = G.sendNet = (p) => { try { if (has('sendEvent')) mp.sendEvent('fl', p); } catch { /* */ } };
    function nearbyPlayers(r) { try { return has('nearby') ? mp.nearby(r) : []; } catch { return []; } }
    if (has('onEvent')) offs.push(mp.onEvent('fl', (p, meta) => {
      const from = String(meta?.from ?? p?.from ?? ''); if (!p || !from || from === localId()) return;
      if (p.k === 'pal' && SP[p.sp]) { const r = remotes.get(from) || {}; const hat = C.HATS[p.hat] ? p.hat : null; if (r.sp !== p.sp || r.hat !== hat) { if (r.mesh) scene.remove(r.mesh); r.mesh = null; } Object.assign(r, { sp: p.sp, hat }); remotes.set(from, r); }
      else if (p.k === 'emote') showEmote(+p.i | 0, () => (nearbyCache.find(n => String(n.id) === from)?.position) || null);
      else if (p.k === 'duel') battle.onDuelMsg(from, p);
    }));
    function updateRemotes(dt, t) {
      nearbyT -= dt; if (nearbyT <= 0) { nearbyT = 0.2; nearbyCache = nearbyPlayers(70); }
      for (const [id, r] of remotes) {
        const n = nearbyCache.find(x => String(x.id) === id);
        if (!n || G.mode !== 'world') { if (r.mesh) r.mesh.visible = false; continue; }
        if (!r.mesh) { r.mesh = buildFrostling(r.sp, { hat: r.hat, scale: 0.85 }); scene.add(r.mesh); r.mesh.position.set(n.position.x + 1.5, 0, n.position.z + 1.5); }
        r.mesh.visible = true;
        const tx = n.position.x + 1.4, tz = n.position.z + 1.4, dx = tx - r.mesh.position.x, dz = tz - r.mesh.position.z, d = Math.hypot(dx, dz);
        if (d > 30) r.mesh.position.set(tx, 0, tz); else if (d > 1.2) { r.mesh.position.x += dx * Math.min(1, dt * 3); r.mesh.position.z += dz * Math.min(1, dt * 3); r.mesh.rotation.y = Math.atan2(dx, dz); }
        animFrostling(r.mesh, t, d > 1.2 ? 1 : 0, dt);
      }
      if (performance.now() - lastPalSent > 12000 && comp) { lastPalSent = performance.now(); const lead = partyMons()[0]; if (lead) sendNet({ k: 'pal', sp: lead.sp, hat: lead.hat || null }); }
    }
    if (has('onPlayersChanged')) offs.push(mp.onPlayersChanged(() => { lastPalSent = 0; }));

    // ---------- battles (battleFlow.js) ----------
    const battle = G.battle = createBattle(G);

    // ---------- starter ----------
    G.refreshNpcTags();
    if (!G.save.starter) {
      setTimeout(() => G.alive && panels.starter((sp) => {
        const s = G.save; s.starter = sp; const m = G.addMon(sp, 5); G.setDex(sp, 2); m.bond = 3; s.items = { ...C.DEFAULT_SAVE.items }; commit();
        audio.sfx('sfx_catch_success'); ui.banner(`${SP[sp].name} is your partner!`, 'head north to Pinefrost Meadow', 2600); refreshCompanion();
        burst(player.pos.x, 1.5, player.pos.z, 60, TYPES[SP[sp].type].color, 6, 3, 1.3);
      }), 400);
    } else refreshCompanion();

    const keyPrev = {};
    const edge = G.edge = (code) => { const d = engine.input.down(code), p = keyPrev[code]; keyPrev[code] = d; return d && !p; };
    const camDist0 = player.camDist; player.camDist = 11; player.camPitch = 0.42;
    let lastReg = null;
    const camTmp = new THREE.Vector3();
    const game = {
      scene, collision, spawn: new THREE.Vector3(0, 0, 6), spawnFacing: Math.PI, music: 'none', maxCamDist: 20,
      frostlings: {   // test hooks (scripts/frostlings-smoke.mjs)
        get audio() { return audio; },
        get state() { const s = G.save, BT = battle.current; return { mode: G.mode, flakes: s.flakes, rank: s.rank, starter: s.starter, party: partyMons().map(m => ({ sp: m.sp, lv: m.lv, hp: m.hp, xp: m.xp, moves: m.moves })), mons: s.mons.length, dex: C.dexCount(s), beaten: [...s.beaten], wild: wilds.length, quests: activeQuests().map(q => q.id + ':' + questState(q).have), items: { ...s.items }, battle: BT ? { kind: BT.kind, turn: BT.b.turn, me: B.active(BT.b, BT.ME)?.hp, foe: B.active(BT.b, BT.FOE)?.hp, foeSp: B.active(BT.b, BT.FOE)?.sp } : null }; },
        get save() { return G.save; }, chooseStarter: (sp) => panels._starterPick?.(sp),
        startWild: (sp, lv = 4, area = 'meadow') => battle.startWild({ id: sp, lv, area, mesh: new THREE.Group(), pos: new THREE.Vector3(), cool: 0, fake: true }),
        startTamer: (id) => battle.startTamer(id), startRing: () => battle.startRing(), giveMon: (sp, lv) => { const m = G.addMon(sp, lv); G.setDex(sp, 2); refreshCompanion(); return m.uid; },
        beat: (id) => { if (!G.save.beaten.includes(id)) G.save.beaten.push(id); const a = C.AREA_ORDER.find(x => AREAS[x].unlock === id); if (a) world.openGate(a, true); G.refreshNpcTags(); },
        setPhase: (ph) => { timeOffset = 0; timeOffset = ((ph * C.DAY_SECS) - ((nowMs() / 1000) % C.DAY_SECS) + C.DAY_SECS * 2) % C.DAY_SECS; },
        teleport: (x, z) => player.teleport(new THREE.Vector3(x, 0, z), 0), addItems: (k, n) => { G.save.items[k] = (G.save.items[k] || 0) + n; },
        clickOption: (i) => { const b = document.querySelectorAll('.fl-opt')[i]; if (b && !b.disabled) b.click(); return b?.textContent; }, options: () => [...document.querySelectorAll('.fl-opt')].map(b => (b.disabled ? '(x)' : '') + b.textContent),
        ok: () => { const b = document.querySelector('.fl-cine [data-ok]'); b?.click(); return !!b; }, msg: () => document.querySelector('.fl-msg')?.textContent,
        resetSave: () => { G.save = structuredClone(C.DEFAULT_SAVE); commit(); }, openPanel: (id) => panels.open(id), turnInAll: () => activeQuests().forEach(turnIn),
      },
      update(dt0, t, pl) {
        const fx = G.fx;
        if (fx.hitstop > 0) fx.hitstop -= dt0;
        const dt = fx.hitstop > 0 ? dt0 * 0.15 : dt0;
        emoteCd -= dt0;
        const ph = dayPhase(), nightK = Math.min(1, Math.max(0, ph < 0.5 ? 0 : ph < 0.62 ? (ph - 0.5) / 0.12 : ph > 0.96 ? (1 - ph) / 0.04 : 1)), auroraK = C.isAurora(ph) ? Math.min(1, (ph - 0.74) / 0.03, (0.92 - ph) / 0.03) : 0;
        if (G.mode === 'battle') battle.update(dt0, dt, t, ph, auroraK, nightK);
        else {
          const reg = world.update(dt0, t, ph, auroraK, nightK, pl.pos.x, pl.pos.z);
          if (reg.w > 0.5 && reg.id !== lastReg) {
            lastReg = reg.id; const A = AREAS[reg.id];
            if (reg.id !== 'village') ui.banner(A.name, `Lv ${A.lv[0]}–${A.lv[1]} · ${C.isAurora(ph) ? 'the aurora is out!' : C.isNight(ph) ? 'night creatures roam…' : 'daytime'}`, 2200);
            audio.amb(A.amb); audio.music_(reg.id === 'village' ? 'bgm_village' : null);
          }
          if (!audio.bgm && lastReg === 'village') audio.music_('bgm_village');
          if (!audio.ambName && lastReg && AREAS[lastReg].amb) audio.amb(AREAS[lastReg].amb);
          manageWilds(dt); updateWilds(dt, t);
          if (comp) {
            const m = comp.mesh, tx = pl.pos.x - Math.sin(pl.facing) * 1.8 + Math.cos(pl.facing) * 1.1, tz = pl.pos.z - Math.cos(pl.facing) * 1.8 - Math.sin(pl.facing) * 1.1;
            const dx = tx - m.position.x, dz = tz - m.position.z, d = Math.hypot(dx, dz);
            if (d > 25) m.position.set(tx, 0, tz); else if (d > 0.5) { const sp = Math.min(d, Math.max(3, d * 3) * dt); m.position.x += dx / d * sp; m.position.z += dz / d * sp; const ry = Math.atan2(dx, dz); let df = ry - m.rotation.y; df = Math.atan2(Math.sin(df), Math.cos(df)); m.rotation.y += df * Math.min(1, dt * 8); }
            m.position.y = pl.pos.y > 0.5 ? pl.pos.y : 0;
            animFrostling(m, t, d > 0.6 ? 1 : 0, dt);
          }
          updateRemotes(dt, t);
          for (const n of npcs) { n.mesh.userData.arms?.forEach((a, i) => { a.rotation.x = Math.sin(t * 1.6 + i * 2) * 0.12; }); if (n.pal) animFrostling(n.pal, t, 0, dt); }
          if (!ui.modalOpen) {
            if (edge('KeyE')) interact();
            if (edge('KeyP')) openPanel('party'); if (edge('KeyB')) openPanel('bag'); if (edge('KeyX')) openPanel('dex'); if (edge('KeyJ')) openPanel('quests');
            ['Digit1', 'Digit2', 'Digit3', 'Digit4'].forEach((k, i) => { if (edge(k)) emote(i); });
          } else if (edge('Escape')) ui.closeModal();
          prompt = ui.modalOpen ? null : findPrompt();
          const pm = partyMons(), s = G.save;
          ui.hud({ timeIcon: C.isAurora(ph) ? '🌌' : C.isNight(ph) ? '🌙' : ph > 0.5 ? '🌇' : '☀', area: AREAS[reg.w > 0.5 ? reg.id : 'village'].name, flakes: s.flakes, rank: s.rank, rankFrac: s.rank >= C.RANK_MAX ? 1 : s.rankXp / C.RANK_XP(s.rank),
            party: pm.map(m => ({ uid: m.uid, sp: m.sp, hat: m.hat, name: SP[m.sp].name, lv: m.lv, status: m.status?.id, hpFrac: m.hp / B.statsOf(m).hp, xpFrac: m.lv >= C.LEVEL_CAP ? 1 : m.xp / B.xpToNext(m.lv) })),
            portraits, quests: activeQuests().slice(0, 3).map(q => ({ name: q.name, desc: q.desc, ...questState(q) })), prompt });
        }
        for (let i = emotes.length - 1; i >= 0; i--) { const e = emotes[i]; e.t -= dt0; const p = e.getPos(); if (p && G.mode === 'world') { e.spr.visible = true; e.spr.position.set(p.x, (p.y || 0) + 4 + Math.sin(t * 5) * 0.1, p.z); } else e.spr.visible = false; e.spr.material.opacity = Math.min(1, e.t * 2); if (e.t <= 0) { scene.remove(e.spr); e.spr.material.map.dispose(); e.spr.material.dispose(); emotes.splice(i, 1); } }
        for (let i = tweens.length - 1; i >= 0; i--) { const w = tweens[i]; w.t += dt; const k = Math.min(1, w.t / w.dur); try { w.fn(k); } catch { /* */ } if (k >= 1) { tweens.splice(i, 1); w.res(); } }
        for (let i = 0; i < NP; i++) {
          const q = parts[i];
          if (q.life > 0) { q.life -= dt0; q.v.y -= q.g * dt0; q.v.multiplyScalar(Math.exp(-1.6 * dt0)); q.p.addScaledVector(q.v, dt0); if (q.p.y < 0.05) { q.p.y = 0.05; q.v.y *= -0.2; } }
          const k = Math.max(0, q.life / q.max);
          pPos[i * 3] = q.p.x; pPos[i * 3 + 1] = q.life > 0 ? q.p.y : -99; pPos[i * 3 + 2] = q.p.z;
          pCol[i * 3] = q.c.r * k; pCol[i * 3 + 1] = q.c.g * k; pCol[i * 3 + 2] = q.c.b * k;
        }
        pGeo.attributes.position.needsUpdate = true; pGeo.attributes.color.needsUpdate = true;
        for (const s of popPool) { if (s.t <= 0) continue; s.t -= dt0; s.spr.position.y += s.vy * dt0; s.vy *= Math.exp(-3 * dt0); const k = s.t > 0.85 ? 1 + (s.t - 0.85) * 4 : 1; s.spr.scale.copy(s.base).multiplyScalar(k); s.spr.material.opacity = Math.min(1, s.t * 3); s.spr.visible = s.t > 0; }
        fx.shake = Math.max(0, fx.shake - dt0 * 1.8);
        if (fx.shake > 0) cam.position.add(camTmp.set(rand(-1, 1), rand(-1, 1), rand(-1, 1)).multiplyScalar(fx.shake * 0.3));
        saveT += dt0; if (saveT > 30) commit();
      },
      dispose() {
        G.alive = false; audio.stop(); ui.dispose(); offs.forEach(f => { try { f?.(); } catch { /* */ } });
        player.enabled = true; player.camDist = camDist0; collision.bounds = BOUNDS;
        for (const w of tweens) w.res(); tweens.length = 0;
        persist(economy, G.save);
        scene.traverse(o => { o.geometry?.dispose?.(); const m = o.material; (Array.isArray(m) ? m : m ? [m] : []).forEach(x => { x.map?.dispose?.(); x.dispose(); }); });
        clearMatCache();
      },
    };
    return game;
  },
};
