// Rimebound — lobby (GM2) + shipyard match loop (GM1)
import * as THREE from 'three';
import { Collision } from '../../engine/collision.js';
import * as C from './config.js';
import { get as getKit, list as listKits } from './kits/registry.js';
import { createLobbyState, pickRole, pickKit, setReady } from './lobby.js';
import { playEmote } from './emotes.js';
import { RimeUI } from './ui.js';
import { RimeAudio } from './audio.js';
import { createEffects } from './effects.js';
import { buildKitMesh } from './kits/mesh/index.js';
import * as L from './set/layout.js';

function loadSave(economy) { return { ...C.DEFAULT_SAVE, ...((economy.profile?.gameData || {})[C.GAME_ID] || {}) }; }
function persist(economy, save) {
  economy.profile.gameData = { ...(economy.profile.gameData || {}), [C.GAME_ID]: save };
  if (typeof economy.saveGameData === 'function') economy.saveGameData(C.GAME_ID, save);
  else economy.backend?.saveProfile?.(economy.profile);
}

function thumb() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 144;
  const g = c.getContext('2d');
  const grd = g.createLinearGradient(0, 0, 0, 144);
  grd.addColorStop(0, '#0a1a2e'); grd.addColorStop(1, '#1a3a55');
  g.fillStyle = grd; g.fillRect(0, 0, 256, 144);
  g.fillStyle = '#8ec7ff'; g.font = 'bold 28px sans-serif'; g.fillText('RIMEBOUND', 28, 78);
  g.fillStyle = '#5a8aaa'; g.font = '14px sans-serif'; g.fillText('asym horror · shipyard', 28, 104);
  return c.toDataURL('image/png');
}
let _thumb = null;

function makeBotMesh(color) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.45, 1.1, 4, 8),
    new THREE.MeshStandardMaterial({ color, roughness: 0.7 }),
  );
  body.position.y = 1.0; g.add(body);
  return g;
}

function makeCoreMarker(core) {
  const m = new THREE.Mesh(
    new THREE.CylinderGeometry(0.55, 0.7, 1.4, 12),
    new THREE.MeshStandardMaterial({ color: '#1a3a55', emissive: '#5fd4ff', emissiveIntensity: 0.9, roughness: 0.4 }),
  );
  m.position.set(core.x, (core.y || 0) + 0.7, core.z);
  m.userData.coreId = core.id;
  return m;
}

function makeExitMarker(ex) {
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(1.2, 4, 3),
    new THREE.MeshStandardMaterial({ color: '#4a2020', emissive: '#ff3b3b', emissiveIntensity: 0.2 }),
  );
  m.position.set(ex.x, 2, ex.z);
  m.userData.exitId = ex.id;
  return m;
}

async function loadShipyard(engine) {
  const light = () => {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(L.lighting.fog || '#0b1420');
    scene.fog = new THREE.FogExp2(L.lighting.fog || '#0b1420', L.lighting.density || 0.03);
    scene.add(new THREE.HemisphereLight(0x9ec9ff, 0x0a1520, 0.9));
    const dir = new THREE.DirectionalLight(0xcfe9ff, 0.5); dir.position.set(10, 24, 8); scene.add(dir);
    const ground = new THREE.Mesh(
      new THREE.BoxGeometry(L.bounds.maxX - L.bounds.minX, 0.4, L.bounds.maxZ - L.bounds.minZ),
      new THREE.MeshStandardMaterial({ color: '#1b3348', roughness: 0.95 }),
    );
    ground.position.set(0, -0.2, (L.bounds.minZ + L.bounds.maxZ) / 2); scene.add(ground);
    return {
      scene,
      addColliders(col) {
        col.addBox(L.bounds.minX - 2, -1, L.bounds.minZ - 2, L.bounds.minX, 8, L.bounds.maxZ + 2);
        col.addBox(L.bounds.maxX, -1, L.bounds.minZ - 2, L.bounds.maxX + 2, 8, L.bounds.maxZ + 2);
      },
      groundHeight: L.groundHeight,
      update() {},
      _light: true,
    };
  };

  try {
    const mod = await import('./set/index.js');
    const p = mod.default.create({ renderer: engine.renderer });
    const built = await Promise.race([
      p,
      new Promise((_, rej) => setTimeout(() => rej(new Error('set timeout')), C.MATCH.SET_TIMEOUT_MS)),
    ]);
    return built;
  } catch (e) {
    console.warn('[rimebound] shipyard set fallback', e);
    return light();
  }
}

export default {
  id: C.GAME_ID,
  name: 'Rimebound',
  tagline: 'Survive the freeze — or hunt those who try.',
  description: 'Asymmetrical horror on the ice. Survivors restart thaw cores while killers stalk the shipyard. Pick Pip, Nell, Juno, Hullwarden, Kettle, or Mrs. Whitepeak.',
  get thumbnail() { if (!_thumb) { try { _thumb = thumb(); } catch { _thumb = 'frost'; } } return _thumb; },
  music: 'none',
  mobile: true,

  async create(ctx) {
    const { economy, engine, music } = ctx;
    const player = engine.player;
    const save = loadSave(economy);
    const audio = new RimeAudio(music);
    audio.setBed('bgm_rimebound-lobby', 0.45);

    const lobbyScene = new THREE.Scene();
    lobbyScene.background = new THREE.Color('#071421');
    lobbyScene.fog = new THREE.FogExp2('#071421', 0.018);
    lobbyScene.add(new THREE.HemisphereLight(0x9ec9ff, 0x0a1520, 0.85));
    const dir = new THREE.DirectionalLight(0xcfe9ff, 0.55); dir.position.set(8, 20, 6); lobbyScene.add(dir);
    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(28, 48),
      new THREE.MeshStandardMaterial({ color: '#1b3348', roughness: 0.95, metalness: 0.05 }),
    );
    ground.rotation.x = -Math.PI / 2; lobbyScene.add(ground);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const m = new THREE.Mesh(
        new THREE.CylinderGeometry(1.1, 1.1, 0.15, 20),
        new THREE.MeshStandardMaterial({ color: i < 3 ? '#3d7ea6' : '#8a3a4a', emissive: i < 3 ? '#123' : '#300', emissiveIntensity: 0.4 }),
      );
      m.position.set(Math.cos(a) * 8, 0.08, Math.sin(a) * 8);
      lobbyScene.add(m);
    }

    let scene = lobbyScene;
    let collision = new Collision({ floorY: 0, bounds: { minX: -30, maxX: 30, minZ: -30, maxZ: 30 } });
    let built = null;

    const bannerEl = document.createElement('div');
    Object.assign(bannerEl.style, {
      position: 'fixed', top: '64px', left: '50%', transform: 'translateX(-50%)',
      zIndex: 70, padding: '8px 14px', borderRadius: '10px',
      background: 'rgba(8,18,32,.9)', border: '1px solid #7ec8ff',
      color: '#e8f4ff', fontWeight: 700, fontSize: '14px', opacity: 0, transition: 'opacity .15s',
      pointerEvents: 'none',
    });
    document.body.appendChild(bannerEl);
    let bannerTimer = 0;
    const banner = (msg) => {
      bannerEl.textContent = msg;
      bannerEl.style.opacity = '1';
      clearTimeout(bannerTimer);
      bannerTimer = setTimeout(() => { bannerEl.style.opacity = '0'; }, 1400);
    };

    const fx = createEffects({ scene: lobbyScene, player, engine, audio: (c) => audio.play(c), banner });

    let kitMesh = null;
    function spawnKitMesh(kitId) {
      if (kitMesh) { lobbyScene.remove(kitMesh); kitMesh = null; }
      kitMesh = buildKitMesh(kitId);
      if (kitMesh) { kitMesh.position.set(0, 0, -3); lobbyScene.add(kitMesh); }
    }

    let lobby = createLobbyState();
    let kit = null;
    const cds = Object.create(null);
    const cdUntil = Object.create(null);

    // match state
    let phase = 'lobby'; // lobby | match | results
    let role = 'survivor';
    let hp = C.MATCH.MAX_HP;
    let downed = 0;
    let frozen = false;
    let timer = C.MATCH.ROUND_SEC;
    let cores = [];
    let coreMeshes = [];
    let exits = [];
    let exitMeshes = [];
    let bots = [];
    let exitOpen = false;
    let result = '';
    let repairProg = 0;
    let exitHold = 0;
    let hitCd = 0;
    let terrorName = '';
    let chaseName = '';
    let hudAcc = 0;
    let starting = false;

    const abilityCtx = {
      onCd: (id) => (cdUntil[id] || 0) > performance.now() / 1000,
      setCd: (id, sec) => { cdUntil[id] = performance.now() / 1000 + sec; cds[id] = sec; },
      audio: (cue) => audio.play(cue),
      fx,
      applyPassive: (id) => fx[id]?.(),
      get player() { return player; },
      get engine() { return engine; },
      get role() { return role; },
    };

    const ui = new RimeUI({
      onRole: (r) => { lobby = pickRole(lobby, r); ui.renderLobby(lobby); },
      onKit: (id) => {
        lobby = pickKit(lobby, id);
        kit = getKit(id);
        spawnKitMesh(id);
        kit?.passive?.apply?.(abilityCtx);
        save.picks[id] = (save.picks[id] || 0) + 1;
        persist(economy, save);
        ui.renderLobby(lobby);
      },
      onReady: (v) => {
        lobby = setReady(lobby, v);
        if (lobby.ready && kit && !starting) startMatch();
        else if (!lobby.ready) ui.renderLobby(lobby);
      },
      onEmote: (id) => { playEmote(id, (c) => audio.play(c)); },
      onAbility: (id) => {
        if (!kit || phase !== 'match' || frozen) return;
        const a = kit.actives.find(x => x.id === id);
        a?.use?.(abilityCtx);
      },
    });

    function dist2(ax, az, bx, bz) { const dx = ax - bx, dz = az - bz; return Math.hypot(dx, dz); }

    function clearMatchActors() {
      for (const m of coreMeshes) scene.remove(m);
      for (const m of exitMeshes) scene.remove(m);
      for (const b of bots) scene.remove(b.mesh);
      coreMeshes = []; exitMeshes = []; bots = []; cores = []; exits = [];
    }

    async function startMatch() {
      starting = true;
      banner('Loading shipyard…');
      role = lobby.role || (C.SURVIVOR_KITS.includes(kit.id) ? 'survivor' : 'killer');
      built = await loadShipyard(engine);
      // Keep the same scene object (engine holds game.scene + avatar). Clear lobby, adopt set children.
      while (scene.children.length) scene.remove(scene.children[0]);
      if (built.scene) {
        scene.background = built.scene.background;
        scene.fog = built.scene.fog;
        for (const c of [...built.scene.children]) scene.add(c);
      } else {
        scene.background = new THREE.Color(L.lighting.fog || '#0b1420');
        scene.fog = new THREE.FogExp2(L.lighting.fog || '#0b1420', L.lighting.density || 0.03);
      }
      collision = new Collision({
        floorY: 0,
        bounds: { minX: L.bounds.minX, maxX: L.bounds.maxX, minZ: L.bounds.minZ, maxZ: L.bounds.maxZ },
      });
      try { built.addColliders?.(collision); } catch {}
      Object.defineProperty(collision, 'floorY', {
        get: () => (typeof built.groundHeight === 'function' ? built.groundHeight(player.pos.x, player.pos.z) : L.groundHeight(player.pos.x, player.pos.z)),
        configurable: true,
      });

      clearMatchActors();
      cores = L.cores.map(c => ({ ...c, prog: 0, done: false }));
      for (const c of cores) { const m = makeCoreMarker(c); coreMeshes.push(m); scene.add(m); }
      exits = L.exits.map(e => ({ ...e }));
      for (const e of exits) { const m = makeExitMarker(e); exitMeshes.push(m); scene.add(m); }

      // bots
      const killerKits = C.KILLER_KITS;
      const survKits = C.SURVIVOR_KITS;
      if (role === 'survivor') {
        const ks = L.spawns.killer[0];
        const b = { role: 'killer', kitId: killerKits[0], hp: C.MATCH.MAX_HP, mesh: makeBotMesh('#8a3a4a'), x: ks.x, z: ks.z, downed: 0, frozen: false };
        b.mesh.position.set(ks.x, 0, ks.z); scene.add(b.mesh); bots.push(b);
        for (let i = 1; i < L.spawns.survivor.length; i++) {
          const s = L.spawns.survivor[i];
          const bb = { role: 'survivor', kitId: survKits[i % survKits.length], hp: C.MATCH.MAX_HP, mesh: makeBotMesh('#3d7ea6'), x: s.x, z: s.z, downed: 0, frozen: false, target: i % cores.length };
          bb.mesh.position.set(s.x, 0, s.z); scene.add(bb.mesh); bots.push(bb);
        }
      } else {
        for (let i = 0; i < Math.min(4, L.spawns.survivor.length); i++) {
          const s = L.spawns.survivor[i];
          const bb = { role: 'survivor', kitId: survKits[i % survKits.length], hp: C.MATCH.MAX_HP, mesh: makeBotMesh('#3d7ea6'), x: s.x, z: s.z, downed: 0, frozen: false, target: i % cores.length };
          bb.mesh.position.set(s.x, 0, s.z); scene.add(bb.mesh); bots.push(bb);
        }
      }

      const spawn = role === 'killer' ? (L.spawns.killer[0] || L.ANCHORS.killerSpawn) : (L.spawns.survivor[0] || L.ANCHORS.spawn);
      const facing = spawn.facing ?? (role === 'killer' ? 0 : Math.PI);
      if (typeof player.teleport === 'function') player.teleport(new THREE.Vector3(spawn.x, (spawn.y || 0) + 0.2, spawn.z), facing);
      else { player.pos.set(spawn.x, (spawn.y || 0) + 0.2, spawn.z); }

      hp = C.MATCH.MAX_HP; downed = 0; frozen = false; timer = C.MATCH.ROUND_SEC;
      exitOpen = false; result = ''; repairProg = 0; exitHold = 0; hitCd = 0;
      phase = 'match';
      audio.clearBed('bgm_rimebound-lobby');
      audio.setBed('bgm_rimebound-shipyard', 0.5);
      terrorName = role === 'killer' ? `terror_${kit.id.replace('killer-', '')}` : '';
      chaseName = role === 'killer' ? `chase_${kit.id}` : '';
      // if player survivor, terror from bot killer
      const killerBot = bots.find(b => b.role === 'killer');
      if (role === 'survivor' && killerBot) {
        terrorName = `terror_${killerBot.kitId.replace('killer-', '')}`;
        chaseName = `chase_${killerBot.kitId}`;
      }
      ui.renderMatch(kit, cds);
      banner('Thaw the cores. Survive.');
      starting = false;
      save.rounds = (save.rounds || 0) + 1; persist(economy, save);
    }

    function endMatch(msg) {
      if (phase === 'results') return;
      phase = 'results';
      result = msg;
      banner(msg);
      audio.clearBed();
      audio.play(msg.toLowerCase().includes('killer') && role === 'killer' ? 'exit_gate' : 'heartbeat_sting');
    }

    function onKey(e) {
      if (phase === 'results' && e.key === 'Enter') {
        phase = 'lobby'; result = '';
        lobby = setReady(createLobbyState(), false);
        if (kit) lobby = pickKit(pickRole(lobby, role), kit.id);
        audio.clearBed(); audio.setBed('bgm_rimebound-lobby', 0.45);
        while (scene.children.length) scene.remove(scene.children[0]);
        scene.background = new THREE.Color('#071421');
        scene.fog = new THREE.FogExp2('#071421', 0.018);
        scene.add(new THREE.HemisphereLight(0x9ec9ff, 0x0a1520, 0.85));
        const d2 = new THREE.DirectionalLight(0xcfe9ff, 0.55); d2.position.set(8, 20, 6); scene.add(d2);
        const g2 = new THREE.Mesh(new THREE.CircleGeometry(28, 48), new THREE.MeshStandardMaterial({ color: '#1b3348', roughness: 0.95 }));
        g2.rotation.x = -Math.PI / 2; scene.add(g2);
        collision = new Collision({ floorY: 0, bounds: { minX: -30, maxX: 30, minZ: -30, maxZ: 30 } });
        player.pos.set(0, 0, 0);
        if (kit) spawnKitMesh(kit.id);
        ui.renderLobby(lobby);
        return;
      }
      if (phase !== 'match' || !kit || frozen) return;
      const key = e.key.toUpperCase();
      const a = kit.actives.find(x => x.key === key);
      if (a) a.use(abilityCtx);
      if (e.key === '1') playEmote(C.EMOTES[0]?.id, (c) => audio.play(c));
      if (e.key === '2') playEmote(C.EMOTES[1]?.id, (c) => audio.play(c));
      if (e.key === '3') playEmote(C.EMOTES[2]?.id, (c) => audio.play(c));
    }
    window.addEventListener('keydown', onKey);

    player.pos.set(0, 0, 0);

    return {
      get scene() { return scene; },
      get collision() { return collision; },
      update(dt) {
        audio.update();
        built?.update?.(dt, performance.now() / 1000);
        const now = performance.now() / 1000;
        for (const id of Object.keys(cdUntil)) cds[id] = Math.max(0, cdUntil[id] - now);

        if (phase !== 'match') return;

        timer = Math.max(0, timer - dt);
        hitCd = Math.max(0, hitCd - dt);
        const px = player.pos.x, pz = player.pos.z;
        const input = engine.input;
        const holding = input?.down?.('KeyE') || input?.down?.('KeyF') || input?.down?.('Space');

        // cores
        let coresDone = cores.filter(c => c.done).length;
        if (role === 'survivor' && !downed && !frozen) {
          let near = null, best = 2.6;
          for (const c of cores) {
            if (c.done) continue;
            const d = dist2(px, pz, c.x, c.z);
            if (d < best) { best = d; near = c; }
          }
          if (near && holding) {
            const rate = (fx.has?.('CoreSpark') ? 1.25 : 1) / C.MATCH.CORE_REPAIR_SEC;
            near.prog = Math.min(1, near.prog + dt * rate);
            audio.setBed('generator_hum', 0.35);
            if (near.prog >= 1) {
              near.done = true; coresDone++;
              audio.play('relay_repair');
              banner(`Core online (${coresDone}/${cores.length})`);
              const mi = cores.indexOf(near);
              if (coreMeshes[mi]) coreMeshes[mi].material.emissiveIntensity = 2.2;
            }
          } else {
            audio.clearBed('generator_hum');
          }
        }

        // bot survivors repair
        for (const b of bots) {
          if (b.role !== 'survivor' || b.frozen || b.downed > 0) continue;
          const c = cores[b.target % cores.length];
          if (!c || c.done) { b.target = (b.target + 1) % cores.length; continue; }
          const dx = c.x - b.x, dz = c.z - b.z, d = Math.hypot(dx, dz) || 1;
          if (d > 1.2) { b.x += (dx / d) * 3.2 * dt; b.z += (dz / d) * 3.2 * dt; }
          else { c.prog = Math.min(1, c.prog + dt / (C.MATCH.CORE_REPAIR_SEC * 1.4)); if (c.prog >= 1 && !c.done) { c.done = true; coresDone++; banner(`Core online (${coresDone}/${cores.length})`); } }
          b.mesh.position.set(b.x, L.groundHeight(b.x, b.z), b.z);
        }

        coresDone = cores.filter(c => c.done).length;
        if (!exitOpen && coresDone >= cores.length && cores.length) {
          exitOpen = true; banner('Exits OPEN'); audio.play('exit_gate');
          for (const m of exitMeshes) m.material.emissiveIntensity = 1.4;
        }

        // combat / chase
        const foes = bots.filter(b => b.role !== role && !b.frozen);
        let nearestFoe = null, foeD = 1e9;
        for (const b of foes) {
          const d = dist2(px, pz, b.x, b.z);
          if (d < foeD) { foeD = d; nearestFoe = b; }
        }
        // killer bot chases player
        for (const b of bots) {
          if (b.role !== 'killer' || b.frozen) continue;
          const dx = px - b.x, dz = pz - b.z, d = Math.hypot(dx, dz) || 1;
          b.x += (dx / d) * 4.0 * dt; b.z += (dz / d) * 4.0 * dt;
          b.mesh.position.set(b.x, L.groundHeight(b.x, b.z), b.z);
          if (role === 'survivor' && !frozen && d < 1.6 && hitCd <= 0) {
            hitCd = 1.1;
            if (downed <= 0) {
              hp -= C.MATCH.HIT_DAMAGE; audio.play('hit');
              if (hp <= 0) { downed = C.MATCH.DOWN_TIMER; audio.play('down'); banner('DOWNED'); }
            } else {
              downed = 0; frozen = true; banner('FROZEN'); audio.play('freeze_lock_place');
            }
          }
        }
        // player killer attacks
        if (role === 'killer' && nearestFoe && foeD < 1.7 && holding && hitCd <= 0) {
          hitCd = 0.9; audio.play('hit');
          if (nearestFoe.downed <= 0) {
            nearestFoe.hp -= C.MATCH.HIT_DAMAGE;
            if (nearestFoe.hp <= 0) { nearestFoe.downed = C.MATCH.DOWN_TIMER; audio.play('down'); banner('Survivor downed'); }
          } else {
            nearestFoe.frozen = true; nearestFoe.downed = 0; audio.play('freeze_lock_place'); banner('Survivor frozen');
          }
        }
        // player survivor revive bots / self timer
        if (role === 'survivor' && downed > 0) {
          downed -= dt;
          if (downed <= 0) { frozen = true; downed = 0; audio.play('freeze_lock_place'); banner('FROZEN'); }
        }
        if (role === 'survivor' && !downed && !frozen) {
          for (const b of bots) {
            if (b.role !== 'survivor' || b.downed <= 0 || b.frozen) continue;
            if (dist2(px, pz, b.x, b.z) < 2.2 && holding) {
              b.downed -= dt * (kit?.id === 'survivor-nell' ? 1.5 : 1);
              if (b.downed <= 0) { b.downed = 0; b.hp = C.MATCH.MAX_HP * 0.5; audio.play('sfx_nell_revive'); banner('Revived'); }
            }
          }
        }
        for (const b of bots) {
          if (b.downed > 0) { b.downed -= dt; if (b.downed <= 0) { b.frozen = true; b.downed = 0; } }
        }

        // terror / chase beds
        const chaseDist = role === 'survivor' ? foeD : foeD;
        const beds = [['bgm_rimebound-shipyard', chaseDist < C.MATCH.CHASE_R ? 0.2 : 0.5]];
        if (terrorName && chaseDist < C.MATCH.TERROR_R) beds.push([terrorName, 0.45]);
        if (chaseName && chaseDist < C.MATCH.CHASE_R) beds.push([chaseName, 0.55]);
        audio.setBeds(beds);
        if (chaseDist < C.MATCH.CHASE_R && Math.random() < dt * 0.4) audio.play('heartbeat_sting', { vol: 0.35 });

        // exits
        if (exitOpen && role === 'survivor' && !downed && !frozen) {
          let nearEx = null;
          for (const e of exits) if (dist2(px, pz, e.x, e.z) < 3.2) nearEx = e;
          if (nearEx && holding) {
            exitHold += dt;
            if (exitHold >= C.MATCH.EXIT_HOLD) endMatch('SURVIVORS ESCAPED');
          } else exitHold = 0;
        }
        // bot escapes
        if (exitOpen) {
          for (const b of bots) {
            if (b.role !== 'survivor' || b.frozen || b.downed > 0) continue;
            const e = exits[0]; if (!e) continue;
            const dx = e.x - b.x, dz = e.z - b.z, d = Math.hypot(dx, dz) || 1;
            b.x += (dx / d) * 3.5 * dt; b.z += (dz / d) * 3.5 * dt;
            b.mesh.position.set(b.x, L.groundHeight(b.x, b.z), b.z);
            if (d < 2) { b.escaped = true; }
          }
          if (bots.filter(b => b.role === 'survivor').every(b => b.frozen || b.escaped) && bots.some(b => b.escaped)) {
            if (role === 'killer') endMatch('SURVIVORS ESCAPED');
          }
        }

        // win checks
        const survivors = [{ role: 'survivor', frozen, escaped: false, isPlayer: role === 'survivor' }, ...bots.filter(b => b.role === 'survivor')];
        if (role === 'survivor' && frozen && bots.filter(b => b.role === 'survivor').every(b => b.frozen)) endMatch('KILLER WINS');
        if (role === 'killer' && bots.filter(b => b.role === 'survivor').every(b => b.frozen)) endMatch('KILLER WINS');
        if (timer <= 0 && phase === 'match') {
          const alive = (role === 'survivor' && !frozen) || bots.some(b => b.role === 'survivor' && !b.frozen);
          endMatch(alive ? 'SURVIVORS HOLD THE LINE' : 'KILLER WINS');
        }

        hudAcc += dt;
        if (hudAcc > 0.15) {
          hudAcc = 0;
          ui.renderMatch(kit, cds);
          ui.renderHud({
            role, coresDone, coresTotal: cores.length, hp, downed: downed > 0 ? downed : 0,
            exitOpen, timer, result,
            prompt: phase === 'match' && role === 'survivor' && !downed ? 'Hold E near cyan cores to thaw · Exits after all cores' : (role === 'killer' ? 'Hold E/F near survivors to strike' : ''),
          });
        }
      },
      dispose() {
        window.removeEventListener('keydown', onKey);
        ui.destroy();
        bannerEl.remove();
        audio.dispose();
        if (kitMesh) lobbyScene.remove(kitMesh);
      },
      getSelectedKit: () => kit,
      getLobbyState: () => ({ ...lobby }),
      listKits,
    };
  },
};
