// Rimebound — GM2 slice: lobby + all 6 kits + emotes. Match loop hooks reserved for GM1.
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
  g.fillStyle = '#5a8aaa'; g.font = '14px sans-serif'; g.fillText('asym horror · kits live', 28, 104);
  return c.toDataURL('image/png');
}
let _thumb = null;

export default {
  id: C.GAME_ID,
  name: 'Rimebound',
  tagline: 'Survive the freeze — or hunt those who try.',
  description: 'Asymmetrical horror on the ice. Survivors restart thaw cores while killers stalk the shipyard, mines, and resort. Pick a kit in the lobby — Pip, Nell, Juno, Hullwarden, Kettle, or Mrs. Whitepeak — each with unique abilities.',
  get thumbnail() { if (!_thumb) { try { _thumb = thumb(); } catch { _thumb = 'frost'; } } return _thumb; },
  music: 'none',
  mobile: true,

  async create(ctx) {
    const { economy, engine, music } = ctx;
    const player = engine.player;
    const save = loadSave(economy);
    const audio = new RimeAudio(music);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#071421');
    scene.fog = new THREE.FogExp2('#071421', 0.018);
    const hemi = new THREE.HemisphereLight(0x9ec9ff, 0x0a1520, 0.85);
    const dir = new THREE.DirectionalLight(0xcfe9ff, 0.55); dir.position.set(8, 20, 6);
    scene.add(hemi, dir);
    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(28, 48),
      new THREE.MeshStandardMaterial({ color: '#1b3348', roughness: 0.95, metalness: 0.05 }),
    );
    ground.rotation.x = -Math.PI / 2; scene.add(ground);
    // lobby marker pads
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const m = new THREE.Mesh(
        new THREE.CylinderGeometry(1.1, 1.1, 0.15, 20),
        new THREE.MeshStandardMaterial({ color: i < 3 ? '#3d7ea6' : '#8a3a4a', emissive: i < 3 ? '#123' : '#300', emissiveIntensity: 0.4 }),
      );
      m.position.set(Math.cos(a) * 8, 0.08, Math.sin(a) * 8);
      scene.add(m);
    }
    const collision = new Collision({ floorY: 0, bounds: { minX: -30, maxX: 30, minZ: -30, maxZ: 30 } });

    
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

    const fx = createEffects({
      scene, player, engine, audio: (c) => audio.play(c), banner,
    });

    let kitMesh = null;
    function spawnKitMesh(kitId) {
      if (kitMesh) { scene.remove(kitMesh); kitMesh = null; }
      kitMesh = buildKitMesh(kitId);
      if (kitMesh) { kitMesh.position.set(0, 0, -3); scene.add(kitMesh); }
    }

let lobby = createLobbyState();
    let kit = null;
    const cds = Object.create(null);
    const cdUntil = Object.create(null);

    const abilityCtx = {
      onCd: (id) => (cdUntil[id] || 0) > performance.now() / 1000,
      setCd: (id, sec) => { cdUntil[id] = performance.now() / 1000 + sec; cds[id] = sec; },
      audio: (cue) => audio.play(cue),
      fx,
      applyPassive: (id) => fx[id]?.(),
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
        if (lobby.ready && kit) ui.renderMatch(kit, cds);
        else ui.renderLobby(lobby);
      },
      onEmote: (id) => { playEmote(id, (c) => audio.play(c)); },
      onAbility: (id) => {
        if (!kit || !lobby.ready) return;
        const a = kit.actives.find(x => x.id === id);
        a?.use?.(abilityCtx);
      },
    });

    // keyboard ability + emote hotkeys once ready
    function onKey(e) {
      if (!lobby.ready || !kit) return;
      const key = e.key.toUpperCase();
      const a = kit.actives.find(x => x.key === key);
      if (a) a.use(abilityCtx);
      if (e.key === '1') playEmote(C.EMOTES[0]?.id, (c) => audio.play(c));
      if (e.key === '2') playEmote(C.EMOTES[1]?.id, (c) => audio.play(c));
      if (e.key === '3') playEmote(C.EMOTES[2]?.id, (c) => audio.play(c));
    }
    window.addEventListener('keydown', onKey);

    player.pos.set(0, 0, 0);
    let acc = 0;
    return {
      scene,
      collision,
      update(dt) {
        acc += dt;
        const now = performance.now() / 1000;
        for (const id of Object.keys(cdUntil)) {
          cds[id] = Math.max(0, cdUntil[id] - now);
        }
        if (lobby.ready && kit && acc > 0.2) {
          acc = 0;
          ui.renderMatch(kit, cds);
        }
      },
      dispose() {
        window.removeEventListener('keydown', onKey);
        ui.destroy();
        bannerEl.remove();
        if (kitMesh) scene.remove(kitMesh);
      },
      // GM1 hooks
      getSelectedKit: () => kit,
      getLobbyState: () => ({ ...lobby }),
      listKits,
    };
  },
};
