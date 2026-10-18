// Game: Giant Rainbow Obby — 1000 stages of classic 2016-style obby over a
// glowing lava floor. Layout logic lives in layout.js (engine-agnostic), BB
// numbers in config.js, gears in gears.js, music/SFX in audio.js, HUD in ui.js.
// Performance: only a window of nearby stages is built (instanced meshes and
// collision boxes), rebuilt as the player progresses.
import * as THREE from 'three';
import { Collision } from '../../engine/collision.js';
import { bus } from '../../core/events.js';
import * as L from './layout.js';
import { GAME_ID, SKIP_STAGE_COST_BB, DEFAULT_SAVE, reachStage, milestoneReward } from './config.js';
import { OBBY_GEARS, OBBY_GEAR_LIST, Backpack, canUseGear } from './gears.js';
import { ObbyAudio } from './audio.js';
import { ObbyUI } from './ui.js';

const WIN_BACK = 2, WIN_AHEAD = 10, HW = 0.42, PH = 2.6;
const CAP = { solid: 2400, kill: 600, glow: 2400, cloud: 200 };

// ---------- per-game save (public economy API only: economy.profile + a save hook) ----------
function loadSave(economy) {
  const all = economy.profile.gameData || {};
  return { ...DEFAULT_SAVE, ...(all[GAME_ID] || {}) };
}
function persist(economy, save) {
  economy.profile.gameData = { ...(economy.profile.gameData || {}), [GAME_ID]: save };
  if (typeof economy.saveGameData === 'function') economy.saveGameData(GAME_ID, save);
  else economy.backend?.saveProfile?.(economy.profile);
}

// ---------- visuals ----------
function blockMaterial() {
  const m = new THREE.MeshStandardMaterial({ roughness: 0.42, metalness: 0.02 });
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vGroW; varying vec3 vGroN;')
      .replace('#include <project_vertex>', `#include <project_vertex>
        vec4 groW = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          groW = instanceMatrix * groW;
        #endif
        vGroW = (modelMatrix * groW).xyz; vGroN = normal;`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vGroW; varying vec3 vGroN;')
      .replace('#include <color_fragment>', `#include <color_fragment>
        vec3 an = abs(vGroN);
        vec2 gc = an.x > 0.5 ? vGroW.zy : (an.y > 0.5 ? vGroW.xz : vGroW.xy);
        vec2 fg = abs(fract(gc * 0.5) - 0.5);
        float line = smoothstep(0.46, 0.5, max(fg.x, fg.y));
        diffuseColor.rgb *= 1.0 - line * 0.16;
        if (an.y > 0.5 && vGroN.y > 0.0) { float sd = length(fract(vGroW.xz * 0.5) - 0.5); diffuseColor.rgb *= 1.0 + 0.10 * (1.0 - smoothstep(0.16, 0.2, sd)) - 0.05 * smoothstep(0.2, 0.24, sd) * (1.0 - smoothstep(0.24, 0.28, sd)); }
        else if (an.y > 0.5) diffuseColor.rgb *= 0.75;`);
  };
  m.customProgramCacheKey = () => 'gro-block';
  return m;
}
function lavaTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
  g.fillStyle = '#ff3d00'; g.fillRect(0, 0, 256, 256);
  const r = L.rng(77);
  for (let i = 0; i < 140; i++) {
    const x = r() * 256, y = r() * 256, rad = 6 + r() * 30;
    const gr = g.createRadialGradient(x, y, 0, x, y, rad);
    const col = r() < 0.5 ? '255,200,40' : '255,120,10';
    gr.addColorStop(0, `rgba(${col},0.9)`); gr.addColorStop(1, `rgba(${col},0)`);
    for (const dx of [-256, 0, 256]) for (const dy of [-256, 0, 256]) { g.save(); g.translate(dx, dy); g.fillStyle = gr; g.beginPath(); g.arc(x, y, rad, 0, 7); g.fill(); g.restore(); }
  }
  for (let i = 0; i < 40; i++) { g.fillStyle = 'rgba(120,10,0,0.35)'; g.beginPath(); g.arc(r() * 256, r() * 256, 2 + r() * 8, 0, 7); g.fill(); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; return t;
}
function trussTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  g.strokeStyle = '#c9d2dc'; g.lineWidth = 6; g.strokeRect(3, 3, 58, 58);
  g.beginPath(); g.moveTo(3, 3); g.lineTo(61, 61); g.moveTo(61, 3); g.lineTo(3, 61); g.lineWidth = 5; g.stroke();
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; return t;
}
function signTexture(text, sub, gold) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 128; const g = c.getContext('2d');
  g.fillStyle = gold ? '#ffcf3f' : '#ffffff'; g.beginPath(); g.roundRect(4, 4, 248, 120, 18); g.fill();
  g.lineWidth = 6; g.strokeStyle = gold ? '#b8860b' : '#2d3b4f'; g.stroke();
  g.fillStyle = '#1d2a3a'; g.textAlign = 'center'; g.font = '900 52px sans-serif'; g.fillText(text, 128, sub ? 66 : 82);
  if (sub) { g.font = '800 22px sans-serif'; g.fillText(sub, 128, 104); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function skyMaterial() {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color('#5fb6ff') }, bottom: { value: new THREE.Color('#d9f1ff') } },
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'uniform vec3 top; uniform vec3 bottom; varying vec3 vP; void main(){ float h = clamp(vP.y*1.4+0.25,0.0,1.0); gl_FragColor = vec4(mix(bottom, top, h), 1.0); }',
  });
}

export function drawThumb() {
  const c = document.createElement('canvas'); c.width = 480; c.height = 270; const g = c.getContext('2d');
  const sky = g.createLinearGradient(0, 0, 0, 270); sky.addColorStop(0, '#4aa8ff'); sky.addColorStop(1, '#d9f1ff'); g.fillStyle = sky; g.fillRect(0, 0, 480, 270);
  g.fillStyle = 'rgba(255,255,255,.9)'; for (const [x, y, w] of [[60, 50, 70], [330, 35, 90], [410, 90, 50]]) { g.fillRect(x, y, w, 18); g.fillRect(x + 12, y - 10, w - 24, 12); }
  const lava = g.createLinearGradient(0, 215, 0, 270); lava.addColorStop(0, '#ffb000'); lava.addColorStop(1, '#ff3d00'); g.fillStyle = lava; g.fillRect(0, 215, 480, 55);
  g.fillStyle = 'rgba(255,240,120,.55)'; for (let i = 0; i < 18; i++) { g.beginPath(); g.arc((i * 53) % 480, 228 + (i * 17) % 36, 4 + (i % 4) * 3, 0, 7); g.fill(); }
  const cols = ['#ff4d4d', '#ff9f1c', '#ffe14d', '#4dd964', '#3fa9ff', '#9b5cff'];
  cols.forEach((col, i) => { const x = 30 + i * 72, y = 190 - i * 22; g.fillStyle = col; g.fillRect(x, y, 54, 16); g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(x, y + 12, 54, 4); });
  g.fillStyle = '#ff2d1a'; g.fillRect(250, 115, 60, 8);
  // noob
  const x = 412, y = 66, s = 16;
  g.fillStyle = '#4a9e4a'; g.fillRect(x - 8, y, 7, s); g.fillRect(x + 1, y, 7, s);
  g.fillStyle = '#3d7bd9'; g.fillRect(x - 8, y - s, 16, s); g.fillStyle = '#f5cd30'; g.fillRect(x - 16, y - s, 7, s); g.fillRect(x + 9, y - s, 7, s); g.fillRect(x - 5, y - s - 10, 10, 10);
  g.font = '900 34px sans-serif'; g.textAlign = 'left'; g.lineWidth = 7; g.strokeStyle = '#1d2a3a'; g.strokeText('1000 STAGES', 24, 46);
  const tg = g.createLinearGradient(24, 0, 260, 0); cols.forEach((col, i) => tg.addColorStop(i / 5, col)); g.fillStyle = tg; g.fillText('1000 STAGES', 24, 46);
  return c.toDataURL('image/jpeg', 0.85);
}

let _thumb = null;
export default {
  id: GAME_ID, name: 'Giant Rainbow Obby', tagline: '1000 stages over glowing lava',
  description: 'A classic giant obby: jumps, moving platforms, lava bars, spinners and trusses across 10 colorful worlds. Checkpoints save, milestones pay Birg Bucks, and gears can help.',
  get thumbnail() { if (!_thumb) { try { _thumb = drawThumb(); } catch { _thumb = 'obby'; } } return _thumb; },
  music: 'none',

  async create(ctx) {
    const { economy, engine, avatar, music } = ctx;
    const player = engine.player;
    const plan = L.planCourse();
    let save = loadSave(economy);
    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog('#d9f1ff', 70, 280);
    const sky = new THREE.Mesh(new THREE.SphereGeometry(900, 24, 12), skyMaterial()); sky.frustumCulled = false; scene.add(sky);
    const hemi = new THREE.HemisphereLight('#ffffff', '#ffa070', 1.1); scene.add(hemi);
    const sun = new THREE.DirectionalLight('#fff6e6', 2.1); sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -45, right: 45, top: 45, bottom: -45, near: 1, far: 160 });
    sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.03; scene.add(sun, sun.target);
    const camFar = engine.camera.far; engine.camera.far = 1200; engine.camera.updateProjectionMatrix();

    const collision = new Collision({ floorY: 0, bounds: { type: 'box', minX: -70, maxX: 70, minZ: -20, maxZ: plan.totalLength + 30 } });

    // lava kill floor
    const lavaTex = lavaTexture(); lavaTex.repeat.set(40, 40);
    const lavaMat = new THREE.MeshStandardMaterial({ color: '#ff5a1a', emissive: '#ffffff', emissiveMap: lavaTex, emissiveIntensity: 1.0, roughness: 0.7, map: lavaTex });
    const lava = new THREE.Mesh(new THREE.PlaneGeometry(1200, 1200), lavaMat); lava.rotation.x = -Math.PI / 2; lava.position.y = 0.01; scene.add(lava);
    const lavaGlow = new THREE.PointLight('#ff6a20', 30, 30, 1.5); scene.add(lavaGlow);

    // instanced pools
    const box = new THREE.BoxGeometry(1, 1, 1);
    const solidMesh = new THREE.InstancedMesh(box, blockMaterial(), CAP.solid);
    const killMesh = new THREE.InstancedMesh(box, new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false }), CAP.kill);
    const glowMesh = new THREE.InstancedMesh(box, new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false }), CAP.glow);
    const cloudMesh = new THREE.InstancedMesh(box, new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1, emissive: '#ffffff', emissiveIntensity: 0.35, transparent: true, opacity: 0.92 }), CAP.cloud);
    for (const m of [solidMesh, killMesh, glowMesh, cloudMesh]) { m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.frustumCulled = false; m.count = 0; scene.add(m); }
    solidMesh.castShadow = solidMesh.receiveShadow = true; killMesh.castShadow = true;
    const trussTex = trussTexture();
    const trussMat = new THREE.MeshStandardMaterial({ map: trussTex, alphaTest: 0.5, side: THREE.DoubleSide, metalness: 0.4, roughness: 0.4, color: '#dfe6ee' });
    const trussGroup = new THREE.Group(); scene.add(trussGroup);
    const signGroup = new THREE.Group(); scene.add(signGroup);
    const signCache = new Map();
    const trophy = new THREE.Group();
    { const gm = new THREE.MeshStandardMaterial({ color: '#ffd34d', emissive: '#ffb000', emissiveIntensity: 0.6, metalness: 0.7, roughness: 0.25 });
      const cup = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 0.6, 2, 16), gm); cup.position.y = 3;
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 1.4, 8), gm); stem.position.y = 1.4;
      const base = new THREE.Mesh(new THREE.BoxGeometry(2, 0.6, 2), gm); base.position.y = 0.3;
      trophy.add(cup, stem, base); const f = L.stageInfo(L.STAGE_COUNT); trophy.scale.setScalar(1.6); trophy.position.set(0, f.y, f.z + 14); scene.add(trophy); }

    const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), S = new THREE.Vector3(), P = new THREE.Vector3(), C = new THREE.Color(), UP = new THREE.Vector3(0, 1, 0);
    const setInst = (mesh, idx, x, y, z, w, h, d, rotY = 0) => { P.set(x, y, z); S.set(w, h, d); Q.setFromAxisAngle(UP, rotY); M.compose(P, Q, S); mesh.setMatrixAt(idx, M); };

    // ---------- stage window ----------
    let win = { lo: -1, hi: -1 }, movers = [], spinners = [], fades = [], kills = [], pads = [], trusses = [];
    function rebuild(center) {
      const lo = Math.max(0, center - WIN_BACK), hi = Math.min(L.STAGE_COUNT, center + WIN_AHEAD);
      if (lo === win.lo && hi === win.hi) return;
      win = { lo, hi };
      collision.boxes = []; movers = []; spinners = []; fades = []; kills = []; pads = []; trusses = [];
      let ns = 0, nk = 0, ng = 0, nc = 0;
      for (const t of trussGroup.children) t.material.map?.dispose?.();
      trussGroup.clear();
      for (let i = lo; i <= hi; i++) {
        for (const q of L.buildStage(i)) {
          if (q.k === 'solid' || q.k === 'pad') {
            if (ns >= CAP.solid) continue;
            setInst(solidMesh, ns, q.x, q.y, q.z, q.w, q.h, q.d); solidMesh.setColorAt(ns, C.setHex(q.c));
            const b = collision.addBox(q.x - q.w / 2, q.y - q.h / 2, q.z - q.d / 2, q.x + q.w / 2, q.y + q.h / 2, q.z + q.d / 2);
            if (q.m) movers.push({ q, idx: ns, b, off: 0 });
            if (q.k === 'pad') pads.push({ stage: q.stage, b });
            ns++;
          } else if (q.k === 'fade') {
            setInst(solidMesh, ns, q.x, q.y, q.z, q.w, q.h, q.d); solidMesh.setColorAt(ns, C.setHex(q.c));
            const b = collision.addBox(q.x - q.w / 2, q.y - q.h / 2, q.z - q.d / 2, q.x + q.w / 2, q.y + q.h / 2, q.z + q.d / 2);
            fades.push({ q, idx: ns, b, base: { ...b }, vis: true }); ns++;
          } else if (q.k === 'kill') {
            if (nk >= CAP.kill) continue;
            setInst(killMesh, nk, q.x, q.y, q.z, q.w, q.h, q.d); killMesh.setColorAt(nk, C.setHex(q.c));
            if (q.spin) spinners.push({ q, idx: nk });
            else kills.push({ q, idx: nk, off: 0 });
            nk++;
          } else if (q.k === 'glow') {
            if (ng >= CAP.glow) continue;
            setInst(glowMesh, ng, q.x, q.y, q.z, q.w, q.h, q.d); glowMesh.setColorAt(ng, C.setHex(q.c)); ng++;
          } else if (q.k === 'cloud') {
            if (nc >= CAP.cloud) continue;
            setInst(cloudMesh, nc++, q.x, q.y, q.z, q.w, q.h, q.d);
          } else if (q.k === 'truss') {
            const tex = trussTex.clone(); tex.needsUpdate = true; tex.repeat.set(1, q.h / 2);
            const mat = trussMat.clone(); mat.map = tex;
            const mesh = new THREE.Mesh(box, mat); mesh.position.set(q.x, q.y, q.z); mesh.scale.set(q.w, q.h, q.d); mesh.castShadow = true; trussGroup.add(mesh);
            collision.addBox(q.x - q.w / 2, q.y - q.h / 2, q.z - q.d / 2, q.x + q.w / 2, q.y + q.h / 2, q.z + q.d / 2);
            trusses.push(q);
          }
        }
      }
      solidMesh.count = ns; killMesh.count = nk; glowMesh.count = ng; cloudMesh.count = nc;
      for (const m of [solidMesh, killMesh, glowMesh, cloudMesh]) { m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; }
      // signs (cached per stage, only the window is kept)
      for (const [i, sp] of signCache) if (i < lo || i > hi) { signGroup.remove(sp); sp.material.map.dispose(); sp.material.dispose(); signCache.delete(i); }
      for (let i = lo; i <= hi; i++) {
        if (signCache.has(i)) continue;
        const s = L.stageInfo(i), big = L.isMilestone(i) || i === L.STAGE_COUNT;
        const sub = i === L.STAGE_COUNT ? 'YOU WIN!' : big ? L.SECTIONS[L.sectionOf(i)].name : (L.isRest(i) ? 'Rest stop' : null);
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: signTexture(i === 0 ? 'START' : String(i), sub, big), fog: true }));
        const w = big ? 8 : 3.2; sp.scale.set(w, w / 2, 1);
        if (big) sp.position.set(0, s.y + 9, s.z + (i === L.STAGE_COUNT ? 18 : L.PAD_D + 6)); else sp.position.set(-L.PAD_W / 2 - 1.2, s.y + 3.4, s.z + L.PAD_D - 0.5);
        signGroup.add(sp); signCache.set(i, sp);
      }
    }

    // ---------- state ----------
    const audio = new ObbyAudio(music);
    let stage = Math.min(save.checkpoint, L.STAGE_COUNT), dying = 0, deaths = 0, lastSection = -1, prevGround = true, t0 = 0;
    const purchases = () => ({ [GAME_ID]: save.gears });
    const backpack = new Backpack(player, avatar, () => ui.refreshGears(backpack.items, backpack.equipped));
    const ui = new ObbyUI({
      gears: OBBY_GEAR_LIST, skipCost: SKIP_STAGE_COST_BB, total: L.STAGE_COUNT,
      onSkip: () => api.skip(), onBuy: (id) => api.buyGear(id), onToggleGear: (id) => api.toggleGear(id), onReset: () => { if (dying <= 0) die('reset'); },
    });
    for (const g of OBBY_GEAR_LIST) if (canUseGear(g.id, GAME_ID, purchases())) backpack.give(g.id);
    ui.refreshGears(backpack.items, backpack.equipped);

    const updateSection = (announce) => {
      const si = L.sectionOf(Math.min(stage, L.STAGE_COUNT - 1)), sec = L.SECTIONS[si];
      ui.setStage(stage, `World ${si + 1}: ${sec.name}`);
      if (si !== lastSection) {
        sky.material.uniforms.top.value.set(sec.sky[0]); sky.material.uniforms.bottom.value.set(sec.sky[1]);
        scene.fog.color.set(sec.sky[1]);
        const night = si === 8; hemi.intensity = night ? 0.7 : 1.1; sun.intensity = night ? 1.0 : 2.1;
        if (announce) ui.showBanner(sec.name, `WORLD ${si + 1}`);
        lastSection = si;
      }
    };
    const respawnPos = () => { const c = L.checkpointPos(stage); return new THREE.Vector3(c.x, c.y + 0.05, c.z); };
    const setStage = (s, how) => {
      const before = stage; stage = s;
      const res = reachStage(save, s); save = res.save;
      if (how === 'skip') save.skips++;
      persist(economy, save);
      if (res.reward) {
        economy.earn(res.reward, `Giant Rainbow Obby stage ${s}`);
        audio.sfx('milestone'); ui.showBanner(s === L.STAGE_COUNT ? '🏆 YOU WIN! 🏆' : `STAGE ${s}!`, `+${res.reward} BIRG BUCKS`);
      } else if (s === L.STAGE_COUNT) { audio.sfx('milestone'); ui.showBanner('🏆 YOU WIN! 🏆', 'Already claimed your reward'); }
      else if (how !== 'skip') audio.sfx('checkpoint');
      updateSection(L.sectionOf(before) !== L.sectionOf(s));
    };

    const die = (why = 'lava') => {
      if (dying > 0) return;
      dying = 0.75; deaths++; save.deaths++;
      player.enabled = false; avatar.root.visible = false;
      burst(player.pos);
      audio.sfx('death'); ui.flashDeath();
    };
    const finishRespawn = () => {
      player.teleport(respawnPos(), 0); player.enabled = true; avatar.root.visible = true;
      rebuild(stage);
      if (OBBY_GEAR_LIST.some(g => !save.gears.includes(g.id)) || deaths % 3 === 1) ui.showPopup();
    };

    // death particles
    const parts = new THREE.InstancedMesh(box, new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false }), 24); parts.count = 0; parts.frustumCulled = false; scene.add(parts);
    let particles = [];
    function burst(at) {
      const cols = [0xf5cd30, 0x3d7bd9, 0x4a9e4a, 0xff7a20];
      particles = [...Array(24)].map((_, i) => ({ p: at.clone().add(new THREE.Vector3(0, 1.4, 0)), v: new THREE.Vector3((Math.random() - 0.5) * 10, 4 + Math.random() * 8, (Math.random() - 0.5) * 10), c: cols[i % 4] }));
      particles.forEach((q, i) => parts.setColorAt(i, C.setHex(q.c))); parts.instanceColor.needsUpdate = true; parts.count = 24;
    }

    const api = {
      get stage() { return stage; }, get save() { return save; }, get deaths() { return deaths; }, get window() { return { ...win, boxes: collision.boxes.length, solids: solidMesh.count }; },
      backpack, layout: L,
      die, teleportToStage(s) { stage = Math.max(0, Math.min(L.STAGE_COUNT, s)); rebuild(stage); player.teleport(respawnPos(), 0); updateSection(false); },
      skip() {
        if (stage >= L.STAGE_COUNT) return false;
        if (!economy.spend(SKIP_STAGE_COST_BB)) { audio.sfx('deny'); bus.emit('toast', { text: `You need ${SKIP_STAGE_COST_BB} Birg Bucks to skip a stage`, icon: '😕' }); return false; }
        audio.sfx('skip'); setStage(stage + 1, 'skip'); rebuild(stage); player.teleport(respawnPos(), 0);
        bus.emit('toast', { text: `Skipped to stage ${stage}`, icon: '⏭' }); return true;
      },
      buyGear(id) {
        const g = OBBY_GEARS[id]; if (!g) return false;
        if (save.gears.includes(id)) { api.toggleGear(id); return true; }
        if (!economy.spend(g.price)) { audio.sfx('deny'); bus.emit('toast', { text: `You need ${g.price} Birg Bucks for the ${g.name}`, icon: '😕' }); return false; }
        save = { ...save, gears: [...save.gears, id] }; persist(economy, save);
        backpack.give(id); if (backpack.equipped !== id) backpack.toggle(id);
        audio.sfx('buy'); bus.emit('toast', { text: `Bought the ${g.name}! It works in this obby only.`, icon: g.icon });
        ui.hidePopup(); return true;
      },
      toggleGear(id) { if (backpack.toggle(id)) audio.sfx('equip'); },
    };

    // Gear / reset hotkeys are read from engine.input (edge-detected in update), so
    // simulated keys from on-screen touch controls work exactly like a keyboard.
    const prevKeys = {};
    const pressed = (code) => { const d = engine.input.down(code), was = prevKeys[code]; prevKeys[code] = d; return d && !was; };
    const pollKeys = () => {
      for (let n = 1; n <= 3; n++) if (pressed(`Digit${n}`) && !engine.game?.buildMode) { const id = backpack.items[n - 1]; if (id) api.toggleGear(id); }
      if (pressed('KeyR') && dying <= 0) die('reset');
    };

    rebuild(stage); updateSection(false);
    const spawn = respawnPos();
    const aabbHit = (p, minX, minY, minZ, maxX, maxY, maxZ) => p.x + HW > minX && p.x - HW < maxX && p.y + PH > minY && p.y < maxY && p.z + HW > minZ && p.z - HW < maxZ;

    const game = {
      scene, collision, spawn, spawnFacing: 0, music: 'none', maxCamDist: 24, obby: api,
      onFall: () => die('fall'),
      update(dt, t, pl) {
        if (!audio.timer) audio.start();
        // lava shimmer
        lavaTex.offset.set(t * 0.01, t * 0.006);
        lavaMat.emissiveIntensity = 0.9 + Math.sin(t * 2.2) * 0.15;
        lava.position.x = Math.round(pl.pos.x / 30) * 30; lava.position.z = Math.round(pl.pos.z / 30) * 30;
        lavaGlow.position.set(pl.pos.x, 2.5, pl.pos.z);
        sky.position.copy(engine.camera.position);
        sun.position.set(pl.pos.x + 30, pl.pos.y + 60, pl.pos.z - 20); sun.target.position.set(pl.pos.x, pl.pos.y, pl.pos.z + 10);
        trophy.rotation.y += dt * 1.2;

        // particles
        if (parts.count) {
          particles.forEach((q, i) => { q.v.y -= 30 * dt; q.p.addScaledVector(q.v, dt); setInst(parts, i, q.p.x, q.p.y, q.p.z, 0.45, 0.45, 0.45, t * 5 + i); });
          parts.instanceMatrix.needsUpdate = true;
        }
        pollKeys();
        if (dying > 0) { dying -= dt; if (dying <= 0) { parts.count = 0; finishRespawn(); } return; }

        // stream stages
        rebuild(L.stageAtZ(pl.pos.z));

        // movers (+ carry the rider)
        let rider = null;
        for (const mv of movers) { const b = mv.b; if (Math.abs(pl.pos.y - b.maxY) < 0.15 && pl.pos.x + HW > b.minX && pl.pos.x - HW < b.maxX && pl.pos.z + HW > b.minZ && pl.pos.z - HW < b.maxZ) rider = mv; }
        for (const mv of movers) {
          const q = mv.q, off = L.partOffset(q, t), d = off - mv.off; mv.off = off; mv.delta = d;
          const ax = q.m.axis; const key = ax === 'x' ? ['minX', 'maxX'] : ax === 'y' ? ['minY', 'maxY'] : ['minZ', 'maxZ'];
          mv.b[key[0]] += d; mv.b[key[1]] += d;
          setInst(solidMesh, mv.idx, q.x + (ax === 'x' ? off : 0), q.y + (ax === 'y' ? off : 0), q.z + (ax === 'z' ? off : 0), q.w, q.h, q.d);
        }
        if (rider) pl.pos[rider.q.m.axis] += rider.delta;
        for (const f of fades) {
          const vis = L.fadeVisible(f.q, t);
          if (vis !== f.vis) {
            f.vis = vis; const q = f.q;
            if (vis) Object.assign(f.b, f.base); else { f.b.minY = -1e6; f.b.maxY = -1e6 + 0.1; }
            setInst(solidMesh, f.idx, q.x, q.y, q.z, vis ? q.w : 0.0001, vis ? q.h : 0.0001, vis ? q.d : 0.0001);
          } else if (vis) {
            // blink a warning in the last 20% of the visible window
            const ph = ((t / f.q.fade.period + f.q.fade.phase) % 1 + 1) % 1;
            const warn = ph > f.q.fade.on * 0.75 && Math.floor(t * 10) % 2 === 0;
            solidMesh.setColorAt(f.idx, C.setHex(warn ? 0xffffff : f.q.c));
          }
        }
        // kill parts
        let dead = pl.pos.y <= 0.06;
        for (const k of kills) {
          const q = k.q; const off = L.partOffset(q, t);
          if (q.m) setInst(killMesh, k.idx, q.x, q.y + off, q.z, q.w, q.h, q.d);
          const y = q.y + off;
          if (!dead && aabbHit(pl.pos, q.x - q.w / 2, y - q.h / 2, q.z - q.d / 2, q.x + q.w / 2, y + q.h / 2, q.z + q.d / 2)) dead = true;
        }
        for (const s of spinners) {
          const q = s.q, a = q.spin.phase + t * q.spin.speed;
          setInst(killMesh, s.idx, q.x, q.y, q.z, q.w, q.h, q.d, a);
          if (!dead && pl.pos.y < q.y + q.h / 2 && pl.pos.y + PH > q.y - q.h / 2) {
            // distance from player to the bar segment in XZ
            const dx = Math.cos(a), dz = -Math.sin(a), px = pl.pos.x - q.x, pz = pl.pos.z - q.z;
            const along = Math.max(-q.w / 2, Math.min(q.w / 2, px * dx + pz * dz));
            if (Math.hypot(px - along * dx, pz - along * dz) < HW + q.d / 2) dead = true;
          }
        }
        solidMesh.instanceMatrix.needsUpdate = true; killMesh.instanceMatrix.needsUpdate = true; if (solidMesh.instanceColor) solidMesh.instanceColor.needsUpdate = true;
        if (dead) { die(pl.pos.y <= 0.06 ? 'lava' : 'kill'); return; }

        // trusses: push into one (W or Space) to climb
        const climbing = engine.input.down('KeyW') || engine.input.down('ArrowUp') || engine.input.down('Space');
        for (const q of trusses) {
          const m = 0.25;
          if (climbing && aabbHit(pl.pos, q.x - q.w / 2 - m, q.y - q.h / 2, q.z - q.d / 2 - m, q.x + q.w / 2 + m, q.y + q.h / 2 + 0.2, q.z + q.d / 2 + m)) { pl.vel.y = 7; }
        }
        // jump sfx
        if (prevGround && !pl.onGround && pl.vel.y > 8) audio.sfx('jump');
        prevGround = pl.onGround;

        // checkpoints
        if (pl.onGround) for (const p of pads) {
          if (p.stage > stage && Math.abs(pl.pos.y - p.b.maxY) < 0.3 && pl.pos.x > p.b.minX && pl.pos.x < p.b.maxX && pl.pos.z > p.b.minZ && pl.pos.z < p.b.maxZ) setStage(p.stage, 'touch');
        }
      },
      dispose() {
                backpack.dispose(); audio.stop(); ui.dispose();
        avatar.root.visible = true; player.enabled = true;
        engine.camera.far = camFar; engine.camera.updateProjectionMatrix();
        lavaTex.dispose(); trussTex.dispose();
        for (const sp of signCache.values()) { sp.material.map.dispose(); sp.material.dispose(); }
        for (const t of trussGroup.children) { t.material.map?.dispose(); t.material.dispose(); }
        [solidMesh, killMesh, glowMesh, cloudMesh, parts].forEach(m => m.material.dispose());
        persist(economy, save);
      },
    };
    return game;
  },
};
