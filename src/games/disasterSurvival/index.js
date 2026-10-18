// Game: Natural Disaster Survival. Round-based survival on Frostbay, an icy island town:
// lobby -> teleport to the map -> warning -> random disaster -> survivors earn Birg Bucks -> reset.
// Map data in map.js, disasters in disasters.js, BB numbers in config.js, HUD in ui.js,
// music/SFX in audio.js. All input goes through engine.input (touch controls simulate keys).
// Multiplayer: the engine has no multiplayer on main yet. The round clock, disaster choice and
// map are deterministic data (map.js + a seeded round plan), so a server can drive them later.
import * as THREE from 'three';
import { Collision } from '../../engine/collision.js';
import { bus } from '../../core/events.js';
import * as C from './config.js';
import THUMB from './thumbnail.js';
import { ISLAND_R, LOBBY, BUILDINGS, CELL, buildBlocks, buildBunker, inBunker, BUNKER, hillBoxes, groundHeight, HILL_TOP, TREES, spawnPoints } from './map.js';
import { DISASTERS, findDisaster, seedDisasterRng, drand } from './disasters.js';
import { createNet, mulberry32 } from './net.js';
import { DisasterAudio } from './audio.js';
import { UI_FILES, makePlayUi } from './uiSounds.js';
import { DisasterUI } from './ui.js';
import { HuntMenu } from './hunt.js';
import { QUESTS } from './quests.js';
import { createQuestTracker } from '../_event/questAdapter.js';
import { QuestHud } from '../_event/questHud.js';

const HW = 0.42, PH = 2.6, MAX_DEBRIS = 420, MAX_PARTS = 260;
const BOT_NAMES = ['Frosty', 'Pingu_99', 'IceQueen', 'Birgo', 'Blizz', 'PolarPal', 'SnowCone'];

// ---------- textures ----------
function canvasTex(w, h, draw, rep = [1, 1]) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...rep); t.anisotropy = 4; return t;
}
const snowTex = () => canvasTex(512, 512, (g, w, h) => {
  g.fillStyle = '#eef4fa'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 2600; i++) { const v = 215 + Math.random() * 40 | 0; g.fillStyle = `rgba(${v - 12},${v - 4},${v},${0.25 + Math.random() * 0.3})`; const s = 1 + Math.random() * 5; g.fillRect(Math.random() * w, Math.random() * h, s, s); }
  for (let i = 0; i < 40; i++) { g.fillStyle = 'rgba(170,205,235,.18)'; g.beginPath(); g.ellipse(Math.random() * w, Math.random() * h, 10 + Math.random() * 40, 5 + Math.random() * 18, Math.random() * 3, 0, 7); g.fill(); }
}, [14, 14]);
const blockTex = () => canvasTex(128, 128, (g, w, h) => {
  g.fillStyle = '#fff'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 400; i++) { const v = 225 + Math.random() * 30 | 0; g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
  g.strokeStyle = 'rgba(0,0,0,.28)'; g.lineWidth = 6; g.strokeRect(0, 0, w, h);
  g.strokeStyle = 'rgba(255,255,255,.5)'; g.lineWidth = 2; g.strokeRect(5, 5, w - 10, h - 10);
});
const metalTex = () => canvasTex(128, 128, (g, w, h) => {
  const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#f2f4f6'); gr.addColorStop(1, '#d8dde2'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 60; i++) { g.fillStyle = `rgba(255,255,255,${Math.random() * 0.25})`; g.fillRect(0, Math.random() * h, w, 1); }
  g.strokeStyle = 'rgba(30,35,40,.45)'; g.lineWidth = 5; g.strokeRect(0, 0, w, h);
  g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 2; g.strokeRect(5, 5, w - 10, h - 10);
  for (const [x, y] of [[12, 12], [w - 12, 12], [12, h - 12], [w - 12, h - 12], [w / 2, 12], [w / 2, h - 12]]) { g.fillStyle = 'rgba(40,45,50,.55)'; g.beginPath(); g.arc(x, y, 4.5, 0, 7); g.fill(); g.fillStyle = 'rgba(255,255,255,.7)'; g.beginPath(); g.arc(x - 1, y - 1, 2, 0, 7); g.fill(); }
  const fr = g.createLinearGradient(0, 0, 0, 22); fr.addColorStop(0, 'rgba(235,248,255,.85)'); fr.addColorStop(1, 'rgba(235,248,255,0)'); g.fillStyle = fr; g.fillRect(0, 0, w, 22); // frost on the top edge
});
const stripeTex = () => canvasTex(256, 32, (g, w, h) => { g.fillStyle = '#f2c230'; g.fillRect(0, 0, w, h); g.fillStyle = '#1c1c1c'; for (let x = -32; x < w + 32; x += 32) { g.beginPath(); g.moveTo(x, h); g.lineTo(x + 16, h); g.lineTo(x + 32, 0); g.lineTo(x + 16, 0); g.fill(); } }, [3, 1]);
const signTex = () => canvasTex(1024, 256, (g, w, h) => {
  const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#1d3557'); gr.addColorStop(1, '#0d1b2a'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
  g.strokeStyle = '#9fdcff'; g.lineWidth = 10; g.strokeRect(8, 8, w - 16, h - 16);
  g.font = '900 86px sans-serif'; g.textAlign = 'center'; g.fillStyle = '#ffffff'; g.fillText('NATURAL DISASTER', w / 2, 112);
  g.fillStyle = '#ffb347'; g.fillText('SURVIVAL', w / 2, 210);
});
function skyMaterial() {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color('#5aa8e8') }, bottom: { value: new THREE.Color('#e4f2fc') }, flash: { value: 0 } },
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'uniform vec3 top; uniform vec3 bottom; uniform float flash; varying vec3 vP; void main(){ float h = clamp(vP.y*1.3+0.2,0.0,1.0); vec3 c = mix(bottom, top, h); gl_FragColor = vec4(c + flash*vec3(0.75,0.82,0.95), 1.0); }',
  });
}
const CALM = { top: '#5aa8e8', bottom: '#e4f2fc', fog: '#d8e9f5', near: 60, far: 300, sun: 2.0, hemi: 1.0 };

export function drawThumb() {
  const c = document.createElement('canvas'); c.width = 480; c.height = 270; const g = c.getContext('2d');
  const sky = g.createLinearGradient(0, 0, 0, 270); sky.addColorStop(0, '#2d3646'); sky.addColorStop(0.6, '#8a6a64'); sky.addColorStop(1, '#d8a070'); g.fillStyle = sky; g.fillRect(0, 0, 480, 270);
  // tornado
  for (let i = 0; i < 14; i++) { const y = 20 + i * 14, w = 110 - i * 6.5; g.fillStyle = `rgba(${170 + i * 4},${175 + i * 4},${180 + i * 3},.85)`; g.beginPath(); g.ellipse(345 + Math.sin(i * 0.7) * 8, y, w, 9, 0, 0, 7); g.fill(); }
  // meteors
  for (const [x, y] of [[80, 40], [190, 22], [40, 110]]) { const gr = g.createLinearGradient(x - 50, y - 40, x, y); gr.addColorStop(0, 'rgba(255,180,80,0)'); gr.addColorStop(1, 'rgba(255,200,90,.95)'); g.strokeStyle = gr; g.lineWidth = 7; g.beginPath(); g.moveTo(x - 50, y - 40); g.lineTo(x, y); g.stroke(); g.fillStyle = '#ff7020'; g.beginPath(); g.arc(x, y, 7, 0, 7); g.fill(); }
  // snow island + houses
  g.fillStyle = '#4a6f8f'; g.fillRect(0, 232, 480, 38);
  g.fillStyle = '#eef4fa'; g.beginPath(); g.ellipse(240, 238, 260, 22, 0, 0, 7); g.fill();
  const houses = [[60, 50, 40, '#c8473d'], [130, 36, 60, '#e8c440'], [200, 60, 30, '#4a78c8'], [262, 30, 90, '#f2f2f2']];
  for (const [x, w, h, col] of houses) { g.fillStyle = col; g.fillRect(x, 232 - h, w, h); g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(x + w * 0.35, 232 - 22, w * 0.3, 22); g.fillStyle = '#3a2a22'; g.fillRect(x - 3, 232 - h - 6, w + 6, 7); }
  g.fillStyle = 'rgba(255,255,255,.85)'; for (let i = 0; i < 60; i++) g.fillRect((i * 97) % 480, (i * 53) % 230, 2, 2);
  g.font = '900 38px sans-serif'; g.lineWidth = 8; g.strokeStyle = '#1d2a3a'; g.textAlign = 'left';
  g.strokeText('DISASTER', 22, 58); g.fillStyle = '#fff'; g.fillText('DISASTER', 22, 58);
  g.strokeText('SURVIVAL', 22, 100); g.fillStyle = '#ffb347'; g.fillText('SURVIVAL', 22, 100);
  return c.toDataURL('image/jpeg', 0.85);
}

function loadSave(economy) { return { ...C.DEFAULT_SAVE, ...(economy.cachedGameData?.(C.GAME_ID) || economy.profile?.gameData?.[C.GAME_ID] || {}) }; }
function persist(economy, save) {
  const data = { rounds: save.rounds, survived: save.survived, best: save.best };
  if (typeof economy.saveGameData === 'function') economy.saveGameData(C.GAME_ID, { ...(economy.cachedGameData?.(C.GAME_ID) || {}), ...data });
}

// ---------- NPC survivors (solo play) ----------
function makeBotMesh(color) {
  const g = new THREE.Group();
  const M = (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.7 });
  const skin = M('#f5cd30'), shirt = M(color), pants = M('#2f4f7f');
  const add = (w, h, d, m, x, y, z) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); b.castShadow = true; g.add(b); return b; };
  const legL = add(0.48, 1.0, 0.5, pants, -0.25, 0.5, 0), legR = add(0.48, 1.0, 0.5, pants, 0.25, 0.5, 0);
  add(1.0, 1.0, 0.5, shirt, 0, 1.5, 0);
  const armL = add(0.42, 1.0, 0.45, skin, -0.72, 1.5, 0), armR = add(0.42, 1.0, 0.45, skin, 0.72, 1.5, 0);
  const head = add(0.6, 0.6, 0.6, skin, 0, 2.3, 0);
  const eye = M('#111'); add(0.08, 0.12, 0.02, eye, -0.13, 2.36, 0.31); add(0.08, 0.12, 0.02, eye, 0.13, 2.36, 0.31);
  for (const l of [legL, legR, armL, armR]) l.geometry.translate(0, -0.45, 0), l.position.y += 0.45;
  return { g, legL, legR, armL, armR, head };
}

let _thumb = null;
export default {
  id: C.GAME_ID, name: 'Natural Disaster Survival', tagline: 'Survive tornadoes, blizzards & meteors',
  description: 'Round-based survival on an icy island town. A random disaster strikes every round: tornado, blizzard, avalanche, earthquake, flood, meteor shower or lightning. Survive to earn Birg Bucks.',
  get thumbnail() { if (THUMB) return THUMB; if (!_thumb) { try { _thumb = drawThumb(); } catch { _thumb = 'frost'; } } return _thumb; },
  music: 'none',
  credits: C.CREDITS, mobile: true,  // tap HUD + joystick (Portal Mobile mode)

  async create(ctx) {
    const { economy, engine, avatar, music } = ctx;
    const player = engine.player;
    let save = loadSave(economy);
    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(CALM.fog, CALM.near, CALM.far);
    const sky = new THREE.Mesh(new THREE.SphereGeometry(800, 24, 12), skyMaterial()); sky.frustumCulled = false; scene.add(sky);
    const hemi = new THREE.HemisphereLight('#ffffff', '#9ab4cc', 1.0); scene.add(hemi);
    const sun = new THREE.DirectionalLight('#fff4e0', 2.0); sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -50, right: 50, top: 50, bottom: -50, near: 1, far: 200 });
    sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.04; scene.add(sun, sun.target);
    const camFar = engine.camera.far; engine.camera.far = 900; engine.camera.updateProjectionMatrix();
    const collision = new Collision({ floorY: 0, bounds: null });
    const disposables = [];
    const keep = (...xs) => { disposables.push(...xs); return xs[0]; };

    // ---------- island, ocean, mountains, trees ----------
    const sTex = keep(snowTex());
    const island = new THREE.Mesh(new THREE.CylinderGeometry(ISLAND_R + 2, ISLAND_R + 8, 6, 72, 1), [keep(new THREE.MeshStandardMaterial({ color: '#b8d4ea', roughness: 0.4 })), keep(new THREE.MeshStandardMaterial({ map: sTex, roughness: 0.92 })), keep(new THREE.MeshStandardMaterial({ color: '#8fb0c8' }))]);
    island.position.y = -3; island.receiveShadow = true; scene.add(island);
    const oceanM = keep(new THREE.MeshStandardMaterial({ color: '#2f6f9a', roughness: 0.25, metalness: 0.1, transparent: true, opacity: 0.92 }));
    const ocean = new THREE.Mesh(new THREE.PlaneGeometry(2400, 2400), oceanM); ocean.rotation.x = -Math.PI / 2; ocean.position.y = -0.6; scene.add(ocean);
    // ice floes
    const floeM = keep(new THREE.MeshStandardMaterial({ color: '#e8f4ff', roughness: 0.5 }));
    for (let i = 0; i < 26; i++) { const a = i * 2.39, r = ISLAND_R + 18 + (i * 37 % 90); const f = new THREE.Mesh(new THREE.CylinderGeometry(2 + (i % 5), 2.5 + (i % 5), 0.8, 7), floeM); f.position.set(Math.cos(a) * r, -0.4, Math.sin(a) * r); f.rotation.y = i; scene.add(f); }
    // mountains behind the island (where avalanches come from)
    const mtM = keep(new THREE.MeshStandardMaterial({ color: '#d8e6f2', roughness: 0.95, flatShading: true }));
    const rockM = keep(new THREE.MeshStandardMaterial({ color: '#5d6b78', roughness: 1, flatShading: true }));
    for (let i = 0; i < 9; i++) {
      const h = 50 + (i * 31 % 45), r = 30 + (i * 17 % 20);
      const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, 7), i % 3 ? mtM : rockM); m.position.set(-ISLAND_R - 55 - (i % 3) * 25, h / 2 - 4, -150 + i * 38); m.rotation.y = i; scene.add(m);
      if (!(i % 3)) { const cap = new THREE.Mesh(new THREE.ConeGeometry(r * 0.42, h * 0.42, 7), mtM); cap.position.set(m.position.x, h - h * 0.21 - 4, m.position.z); cap.rotation.y = i; scene.add(cap); }
    }
    // trees
    const trunkM = keep(new THREE.MeshStandardMaterial({ color: '#5a3c22' })), pineM = keep(new THREE.MeshStandardMaterial({ color: '#2f5a3c', roughness: 0.9, flatShading: true })), tipM = keep(new THREE.MeshStandardMaterial({ color: '#f4f8ff', flatShading: true }));
    for (const [x, z, s] of TREES) {
      const t = new THREE.Group(); t.position.set(x, 0, z); t.scale.setScalar(s);
      const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.45, 2), trunkM); tr.position.y = 1; t.add(tr);
      for (let k = 0; k < 3; k++) { const c = new THREE.Mesh(new THREE.ConeGeometry(2.6 - k * 0.7, 2.6, 8), pineM); c.position.y = 2.4 + k * 1.5; c.castShadow = true; t.add(c); const sn = new THREE.Mesh(new THREE.ConeGeometry(1.2 - k * 0.3, 0.9, 8), tipM); sn.position.y = 3.3 + k * 1.5; t.add(sn); }
      scene.add(t); collision.addCircle(x, z, 0.5 * s, 8 * s);
    }
    // hill (permanent terraces)
    const hillM = keep(new THREE.MeshStandardMaterial({ map: sTex, color: '#dce8f2', roughness: 0.9 }));
    for (const b of hillBoxes()) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(b.maxX - b.minX, b.maxY - b.minY, b.maxZ - b.minZ), hillM);
      m.position.set((b.minX + b.maxX) / 2, (b.minY + b.maxY) / 2, (b.minZ + b.maxZ) / 2); m.receiveShadow = m.castShadow = true; scene.add(m);
      collision.addBox(b.minX, b.minY, b.minZ, b.maxX, b.maxY, b.maxZ);
    }
    // flag on the hill top
    { const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 5), trunkM); pole.position.set(HILL_TOP.x, HILL_TOP.y + 2.5, HILL_TOP.z); scene.add(pole);
      const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.1), keep(new THREE.MeshStandardMaterial({ color: '#e24a3b', side: THREE.DoubleSide }))); flag.position.set(HILL_TOP.x + 0.9, HILL_TOP.y + 4.4, HILL_TOP.z); scene.add(flag); }
    // lamps
    const lampM = keep(new THREE.MeshStandardMaterial({ color: '#2a3440' })), bulbM = keep(new THREE.MeshStandardMaterial({ color: '#fff3c0', emissive: '#ffd27a', emissiveIntensity: 1.5 }));
    for (const [x, z] of [[-10, 14], [4, 6], [22, -2], [-18, -6], [6, 40], [-26, 28], [24, 30], [-14, -26]]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 4), lampM); p.position.set(x, 2, z); scene.add(p); const b = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8), bulbM); b.position.set(x, 4.1, z); scene.add(b); }

    // ---------- destructible blocks ----------
    const bunker = buildBunker();
    const specs = [...buildBlocks().map(b => ({ ...b, mat: 'house' })), ...bunker.blocks];
    const bTex = keep(blockTex()), mTex = keep(metalTex());
    const blockMat = keep(new THREE.MeshStandardMaterial({ map: bTex, roughness: 0.75 }));
    const metalMat = keep(new THREE.MeshStandardMaterial({ map: mTex, roughness: 0.45, metalness: 0.18 }));
    const box1 = keep(new THREE.BoxGeometry(1, 1, 1));
    const meshes = {};
    for (const [mat, material] of [['house', blockMat], ['metal', metalMat]]) {
      const list = specs.filter(s => s.mat === mat);
      const m = new THREE.InstancedMesh(box1, material, list.length); m.castShadow = m.receiveShadow = true; m.frustumCulled = false; scene.add(m); meshes[mat] = m;
      list.forEach((s, j) => { s.li = j; });
    }
    const debrisMesh = new THREE.InstancedMesh(box1, keep(metalMat.clone()), MAX_DEBRIS); debrisMesh.castShadow = true; debrisMesh.frustumCulled = false; debrisMesh.count = 0; scene.add(debrisMesh);
    debrisMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), S = new THREE.Vector3(), P = new THREE.Vector3(), COL = new THREE.Color(), E = new THREE.Euler();
    // decor (no collision): bolts, plates, struts, warning stripes, lights, frost
    {
      const kinds = { metal: keep(metalMat.clone()), stripe: keep(new THREE.MeshStandardMaterial({ map: keep(stripeTex()), roughness: 0.6 })), snow: keep(new THREE.MeshStandardMaterial({ color: '#f4f8ff', roughness: 1 })), light: keep(new THREE.MeshStandardMaterial({ color: '#fff4d0', emissive: '#ffd890', emissiveIntensity: 2.2 })) };
      const all = [...bunker.decor, ...bunker.lights.map(([x, y, z]) => ({ x, y, z, w: 0.7, h: 0.18, d: 0.7, c: 0xffffff, kind: 'light' }))];
      for (const kind of Object.keys(kinds)) {
        const list = all.filter(d => d.kind === kind); if (!list.length) continue;
        const m = new THREE.InstancedMesh(box1, kinds[kind], list.length); m.castShadow = kind !== 'light'; m.receiveShadow = true;
        list.forEach((d, j) => { P.set(d.x, d.y, d.z); S.set(d.w, d.h, d.d); Q.setFromEuler(E.set(0, d.ry || 0, d.rz || 0)); M4.compose(P, Q, S); m.setMatrixAt(j, M4); m.setColorAt(j, COL.setHex(kind === 'metal' ? d.c : 0xffffff)); });
        scene.add(m);
      }
      for (const y of [BUNKER.floor0 + 3.2, BUNKER.floor1 + 3.2]) { const l = new THREE.PointLight('#ffe2b0', 22, 22, 1.6); l.position.set(BUNKER.x, y, BUNKER.z); scene.add(l); }
    }
    let blocks = [];
    let mapDirty = false;
    function setBlockMatrix(b, hide) { const m = meshes[b.mat]; if (hide) { P.set(0, -999, 0); S.set(0.0001, 0.0001, 0.0001); } else { P.set(b.x, b.y, b.z); S.set(b.w, b.h, b.d); } M4.compose(P, Q.identity(), S); m.setMatrixAt(b.li, M4); }
    function resetMap() {
      for (const b of blocks) if (b.box) collision.removeBox(b.box);
      blocks = specs.map((s, i) => ({ ...s, i, alive: true, box: collision.addBox(s.x - s.w / 2, s.y - s.h / 2, s.z - s.d / 2, s.x + s.w / 2, s.y + s.h / 2, s.z + s.d / 2) }));
      for (const b of blocks) { setBlockMatrix(b, false); meshes[b.mat].setColorAt(b.li, COL.setHex(b.c)); }
      for (const m of Object.values(meshes)) { m.instanceMatrix.needsUpdate = true; m.instanceColor.needsUpdate = true; }
      debris.length = 0; debrisMesh.count = 0; mapDirty = false;
    }
    const debris = [];
    function detach(b, vx = 0, vy = 0, vz = 0) {
      if (!b.alive || b.perm) return;
      b.alive = false; mapDirty = true; collision.removeBox(b.box); b.box = null;
      setBlockMatrix(b, true); meshes[b.mat].instanceMatrix.needsUpdate = true;
      if (debris.length >= MAX_DEBRIS) debris.shift();
      debris.push({ p: new THREE.Vector3(b.x, b.y, b.z), v: new THREE.Vector3(vx, vy, vz), r: new THREE.Vector3(), av: new THREE.Vector3(Math.random() * 6 - 3, Math.random() * 6 - 3, Math.random() * 6 - 3), w: b.w, h: b.h, d: b.d, c: b.c, life: 9 + Math.random() * 3, hit: new Set() });
    }
    const forBlocksNear = (x, z, r, fn) => { for (const b of blocks) if (b.alive && !b.perm && Math.hypot(b.x - x, b.z - z) < r) fn(b); };

    // ---------- lobby: a floating icy tower over the sea, facing the island ----------
    const lobby = new THREE.Group(); scene.add(lobby);
    const LX = LOBBY.x, LY = LOBBY.y, LZ = LOBBY.z, LR = LOBBY.r;
    const boards = {};
    {
      const iceM = keep(new THREE.MeshStandardMaterial({ color: '#d6ecfa', roughness: 0.25, metalness: 0.05 }));
      const deckTex = keep(canvasTex(512, 512, (g, w, h) => { g.fillStyle = '#8a5a3a'; g.fillRect(0, 0, w, h); for (let i = 0; i < 16; i++) { const v = 120 + Math.random() * 40 | 0; g.fillStyle = `rgb(${v + 20},${v - 20},${v - 50})`; g.fillRect(0, i * 32 + 2, w, 28); g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect((i * 137) % w, i * 32, 3, 32); } }, [3, 3]));
      const deckM = keep(new THREE.MeshStandardMaterial({ map: deckTex, roughness: 0.8 }));
      const rockM2 = keep(new THREE.MeshStandardMaterial({ color: '#6f8293', roughness: 0.95, flatShading: true }));
      const snowM = keep(new THREE.MeshStandardMaterial({ color: '#f6faff', roughness: 1 }));
      const woodM = keep(new THREE.MeshStandardMaterial({ color: '#6a4426', roughness: 0.8 }));
      const metalM = keep(new THREE.MeshStandardMaterial({ color: '#2c3540', roughness: 0.5, metalness: 0.6 }));
      const glowM = keep(new THREE.MeshStandardMaterial({ color: '#fff1c8', emissive: '#ffc970', emissiveIntensity: 2 }));
      const add = (m, x, y, z) => { m.position.set(x, y, z); lobby.add(m); return m; };
      // deck + snowy rim + floating rock underside with icicles
      add(new THREE.Mesh(new THREE.CylinderGeometry(LR, LR, 0.5, 48), deckM), LX, LY - 0.25, LZ).receiveShadow = true;
      add(new THREE.Mesh(new THREE.CylinderGeometry(LR + 0.6, LR + 0.3, 1.0, 48), iceM), LX, LY - 1.0, LZ);
      add(new THREE.Mesh(new THREE.TorusGeometry(LR + 0.35, 0.35, 8, 48), snowM), LX, LY - 0.45, LZ).rotation.x = Math.PI / 2;
      const under = add(new THREE.Mesh(new THREE.ConeGeometry(LR + 0.2, 13, 11, 3), rockM2), LX, LY - 8, LZ); under.rotation.x = Math.PI;
      const under2 = add(new THREE.Mesh(new THREE.ConeGeometry(LR * 0.55, 7, 9), iceM), LX + 2, LY - 15, LZ - 1); under2.rotation.x = Math.PI;
      const icG = new THREE.ConeGeometry(0.25, 1, 6); icG.rotateX(Math.PI); icG.translate(0, -0.5, 0);
      const icicles = new THREE.InstancedMesh(icG, iceM, 40);
      for (let i = 0; i < 40; i++) { const a = i / 40 * Math.PI * 2, l = 0.8 + ((i * 37) % 10) / 4; M4.compose(P.set(LX + Math.cos(a) * (LR + 0.45), LY - 1.4, LZ + Math.sin(a) * (LR + 0.45)), Q.identity(), S.set(1, l, 1)); icicles.setMatrixAt(i, M4); }
      lobby.add(icicles);
      // snowy railing: posts + rails with snow caps (gap-free ring, collision via the lobby clamp)
      const postG = new THREE.BoxGeometry(0.22, 1.2, 0.22), posts = new THREE.InstancedMesh(postG, woodM, 36);
      for (let i = 0; i < 36; i++) { const a = i / 36 * Math.PI * 2; M4.compose(P.set(LX + Math.cos(a) * (LR - 0.3), LY + 0.6, LZ + Math.sin(a) * (LR - 0.3)), Q.identity(), S.set(1, 1, 1)); posts.setMatrixAt(i, M4); }
      lobby.add(posts);
      add(new THREE.Mesh(new THREE.TorusGeometry(LR - 0.3, 0.09, 6, 64), woodM), LX, LY + 1.2, LZ).rotation.x = Math.PI / 2;
      add(new THREE.Mesh(new THREE.TorusGeometry(LR - 0.3, 0.07, 6, 64), woodM), LX, LY + 0.6, LZ).rotation.x = Math.PI / 2;
      const cap = add(new THREE.Mesh(new THREE.TorusGeometry(LR - 0.3, 0.14, 6, 64), snowM), LX, LY + 1.3, LZ); cap.rotation.x = Math.PI / 2; cap.scale.z = 0.6;
      // back wall (away from the island) carrying the boards, with a snowy roof canopy on ice pillars
      const wallZ = LZ - LR + 2.2;
      add(new THREE.Mesh(new THREE.BoxGeometry(11.4, 6.5, 0.6), iceM), LX, LY + 3.25, wallZ - 0.4);
      collision.addBox(LX - 5.7, LY, wallZ - 0.7, LX + 5.7, LY + 6.5, wallZ - 0.1);
      const canopy = add(new THREE.Mesh(new THREE.BoxGeometry(12.4, 0.5, 5), woodM), LX, LY + 6.7, wallZ + 1.6);
      add(new THREE.Mesh(new THREE.BoxGeometry(12.8, 0.35, 5.4), snowM), LX, LY + 7.1, wallZ + 1.6);
      for (const sx of [-5.6, 5.6]) { add(new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.35, 6.5, 10), iceM), LX + sx, LY + 3.25, wallZ + 3.6); collision.addCircle(LX + sx, wallZ + 3.6, 0.35, LY + 7); }
      // the big round board + stats sign (canvas textures, redrawn when their text changes)
      const mkBoard = (w, h, cw, ch, x, z, ry) => {
        const c = document.createElement('canvas'); c.width = cw; c.height = ch;
        const tex = keep(new THREE.CanvasTexture(c)); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
        const frame = add(new THREE.Mesh(new THREE.BoxGeometry(w + 0.4, h + 0.4, 0.25), metalM), x, LY + 3.4, z); frame.rotation.y = ry;
        const m = add(new THREE.Mesh(new THREE.PlaneGeometry(w, h), keep(new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }))), x, LY + 3.4, z); m.rotation.y = ry;
        m.translateZ(0.14);
        return { c, g: c.getContext('2d'), tex, key: '' };
      };
      boards.round = mkBoard(6.0, 3.33, 900, 500, LX - 2.2, wallZ - 0.05, 0);
      boards.stats = mkBoard(3.0, 3.33, 450, 500, LX + 3.4, wallZ - 0.05, 0);
      const sign = add(new THREE.Mesh(new THREE.PlaneGeometry(8, 2), keep(new THREE.MeshBasicMaterial({ map: keep(signTex()), toneMapped: false }))), LX, LY + 6.2, wallZ + 4.12);
      sign.position.set(LX, LY + 5.9, wallZ - 0.05); sign.translateZ(0.12); sign.scale.setScalar(0.55); sign.position.y = LY + 6.1;
      // benches facing the island
      const benchG = new THREE.Group();
      { const seat = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.18, 0.7), woodM); seat.position.y = 0.55; const back = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.6, 0.12), woodM); back.position.set(0, 0.95, -0.33);
        const sn = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.08, 0.66), snowM); sn.position.y = 0.68; sn.scale.x = 0.9;
        benchG.add(seat, back, sn); for (const lx of [-1.1, 1.1]) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.55, 0.6), metalM); l.position.set(lx, 0.27, 0); benchG.add(l); } }
      for (const [bx, bz, ry] of [[-4.5, 6.6, 0.45], [4.5, 6.6, -0.45], [-7.6, 2.2, 1.1], [7.6, 2.2, -1.1]]) {
        const b = benchG.clone(); b.position.set(LX + bx, LY, LZ + bz); b.rotation.y = ry; lobby.add(b);
        collision.addBox(LX + bx - 1.1, LY, LZ + bz - 0.4, LX + bx + 1.1, LY + 0.64, LZ + bz + 0.4);
      }
      // lamps (emissive bulbs; one shared warm light keeps it cheap)
      for (const [x, z] of [[-8.6, -3], [8.6, -3], [-6.5, 7.6], [6.5, 7.6]]) {
        add(new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 3.2, 8), metalM), LX + x, LY + 1.6, LZ + z);
        add(new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 8), glowM), LX + x, LY + 3.3, LZ + z);
        add(new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.3, 8), snowM), LX + x, LY + 3.6, LZ + z);
        collision.addCircle(LX + x, LZ + z, 0.15, LY + 3.3);
      }
      // potted pines + snow piles + a cocoa fire pit in the middle
      const potM = keep(new THREE.MeshStandardMaterial({ color: '#b5533c', roughness: 0.8 }));
      for (const [x, z] of [[-9, 0.5], [9, 0.5], [-3.6, -5.5], [8.2, -5.2], [-8.2, -5.2]]) {
        add(new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.42, 0.7, 10), potM), LX + x, LY + 0.35, LZ + z);
        for (let k = 0; k < 3; k++) { add(new THREE.Mesh(new THREE.ConeGeometry(0.9 - k * 0.22, 1.0, 8), pineM), LX + x, LY + 1.1 + k * 0.6, LZ + z); add(new THREE.Mesh(new THREE.ConeGeometry(0.4 - k * 0.1, 0.35, 8), tipM), LX + x, LY + 1.5 + k * 0.6, LZ + z); }
        collision.addCircle(LX + x, LZ + z, 0.55, LY + 3);
      }
      for (const [x, z, s] of [[-2, 8.8, 1], [2.6, 8.6, 0.8], [-9.6, -2, 0.9], [0, -6.2, 0.7]]) { const sp = add(new THREE.Mesh(new THREE.SphereGeometry(0.8 * s, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), snowM), LX + x, LY, LZ + z); sp.scale.y = 0.6; }
      add(new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.25, 0.6, 14), keep(new THREE.MeshStandardMaterial({ color: '#7d8a96', roughness: 1, flatShading: true }))), LX, LY + 0.3, LZ + 1.5);
      const flame = add(new THREE.Mesh(new THREE.ConeGeometry(0.55, 1.2, 8), keep(new THREE.MeshBasicMaterial({ color: '#ffb040', transparent: true, opacity: 0.9, toneMapped: false }))), LX, LY + 1.1, LZ + 1.5);
      boards.flame = flame;
      collision.addCircle(LX, LZ + 1.5, 1.25, LY + 0.9);
      const ll = new THREE.PointLight('#ffc27a', 45, 22, 1.6); ll.position.set(LX, LY + 2.6, LZ + 1.5); lobby.add(ll); boards.fireLight = ll;
      // walkable floor (box) — the round deck is clamped to its circle in update()
      const s = LR * 0.98; collision.addBox(LX - s, LY - 1.2, LZ - s, LX + s, LY, LZ + s);
    }
    const drawBoards = () => {
      const R = boards.round, ST = boards.stats; if (!R) return;
      const phaseTxt = api.phase === 'intermission' ? 'NEXT ROUND IN' : api.phase === 'warning' ? '⚠ WARNING' : api.phase === 'disaster' ? 'DISASTER IN PROGRESS' : 'ROUND OVER';
      const secs = Math.max(0, Math.ceil(api.timer));
      const dName = current ? `${current.def.icon} ${current.big ? 'BIGGER ' : ''}${current.def.name.toUpperCase()}` : stormQueued ? `🌪️ NEXT: BIGGER ${findDisaster(stormQueued).name.toUpperCase()}` : '❓ RANDOM DISASTER';
      const aliveN = (alive && onMap ? 1 : 0) + bots.filter(b => b.alive && b.onMap).length;
      const key = [api.phase, secs, dName, aliveN, api.round, lastSurvivors].join('|');
      if (key !== R.key) {
        R.key = key; const g = R.g, w = 900, h = 500;
        const bg = g.createLinearGradient(0, 0, 0, h); bg.addColorStop(0, '#10233d'); bg.addColorStop(1, '#07111f'); g.fillStyle = bg; g.fillRect(0, 0, w, h);
        g.strokeStyle = api.phase === 'intermission' ? '#7fd0ff' : '#ff7a5a'; g.lineWidth = 12; g.strokeRect(6, 6, w - 12, h - 12);
        g.textAlign = 'center'; g.fillStyle = '#9fdcff'; g.font = '800 44px sans-serif'; g.fillText(`ROUND ${api.round + (api.phase === 'intermission' ? 1 : 0)}`, w / 2, 70);
        g.fillStyle = '#ffffff'; g.font = '900 54px sans-serif'; g.fillText(phaseTxt, w / 2, 150);
        g.fillStyle = api.phase === 'intermission' ? '#ffe680' : '#ff8a6a'; g.font = '900 150px sans-serif'; g.fillText(`0:${String(secs).padStart(2, '0')}`, w / 2, 300);
        g.fillStyle = '#ffffff'; g.font = '800 46px sans-serif'; g.fillText(dName, w / 2, 380);
        g.fillStyle = '#9fdcff'; g.font = '700 34px sans-serif';
        g.fillText(api.phase === 'intermission' ? (lastSurvivors != null ? `Last round: ${lastSurvivors} survivor${lastSurvivors === 1 ? '' : 's'}` : 'Get ready on Frostbay Island!') : `👥 ${aliveN} alive`, w / 2, 450);
        R.tex.needsUpdate = true;
      }
      const top = [{ n: 'You', s: sessionWins.you }, ...bots.map(b => ({ n: b.name, s: sessionWins[b.name] || 0 }))].sort((a, b) => b.s - a.s).slice(0, 5);
      const sk = JSON.stringify([top, save.survived, save.rounds, save.best, paid]);
      if (sk !== ST.key) {
        ST.key = sk; const g = ST.g, w = 450, h = 500;
        g.fillStyle = '#f4fbff'; g.fillRect(0, 0, w, h); g.fillStyle = '#1d3557'; g.fillRect(0, 0, w, 70);
        g.textAlign = 'center'; g.fillStyle = '#fff'; g.font = '900 36px sans-serif'; g.fillText('🏆 SURVIVORS', w / 2, 48);
        g.textAlign = 'left'; g.font = '700 28px sans-serif';
        top.forEach((e, i) => { g.fillStyle = e.n === 'You' ? '#c0392b' : '#1d3557'; g.fillText(`${i + 1}. ${e.n}`, 26, 115 + i * 40); g.textAlign = 'right'; g.fillText(String(e.s), w - 26, 115 + i * 40); g.textAlign = 'left'; });
        g.fillStyle = '#1d3557'; g.fillRect(20, 318, w - 40, 3);
        g.font = '800 24px sans-serif'; g.fillStyle = '#1d3557';
        g.fillText(`Your survivals: ${save.survived} / ${save.rounds}`, 26, 358); g.fillText(`Best streak: ${save.best || 0}`, 26, 392); g.fillText(`BB this session: ${paid} / ${C.SESSION_EARN_CAP_BB}`, 26, 426);
        g.font = 'italic 600 16px sans-serif'; g.fillStyle = '#5b7891'; g.textAlign = 'center'; C.CREDITS.forEach((c, i) => g.fillText(c, w / 2, 462 + i * 20));
        ST.tex.needsUpdate = true;
      }
    };
    let lastSurvivors = null; const sessionWins = { you: 0 };
    const lobbySpawn = () => new THREE.Vector3(LOBBY.x + (Math.random() - 0.5) * 5, LOBBY.y + 0.05, LOBBY.z + 4.5 + Math.random() * 2);

    // ---------- particles, precipitation, flood water ----------
    const partMesh = new THREE.InstancedMesh(box1, keep(new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false })), MAX_PARTS); partMesh.count = 0; partMesh.frustumCulled = false; scene.add(partMesh);
    const parts = [];
    function burst(at, color, n = 20, speed = 8, size = 0.35) {
      for (let i = 0; i < n; i++) { if (parts.length >= MAX_PARTS) parts.shift(); parts.push({ p: at.clone(), v: new THREE.Vector3((Math.random() - 0.5) * speed * 2, Math.random() * speed * 1.4, (Math.random() - 0.5) * speed * 2), c: Array.isArray(color) ? color[i % color.length] : color, life: 0.8 + Math.random() * 0.8, s: size * (0.6 + Math.random() * 0.8) }); }
    }
    let precip = null;
    function setPrecip(o) {
      if (precip) { scene.remove(precip.pts); precip.pts.geometry.dispose(); precip.pts.material.dispose(); precip = null; }
      if (!o) return;
      const N = o.count, pos = new Float32Array(N * 3);
      for (let i = 0; i < N; i++) { pos[i * 3] = (Math.random() - 0.5) * 80; pos[i * 3 + 1] = Math.random() * 40; pos[i * 3 + 2] = (Math.random() - 0.5) * 80; }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const pts = new THREE.Points(g, new THREE.PointsMaterial({ color: o.color, size: o.size * (o.streak ? 2.2 : 1), transparent: true, opacity: o.streak ? 0.55 : 0.9, depthWrite: false }));
      pts.frustumCulled = false; scene.add(pts); precip = { pts, o, pos };
    }
    const waterM = keep(new THREE.MeshStandardMaterial({ color: '#3a7fb0', roughness: 0.15, metalness: 0.15, transparent: true, opacity: 0.78 }));
    const water = new THREE.Mesh(new THREE.CircleGeometry(ISLAND_R + 30, 64), waterM); water.rotation.x = -Math.PI / 2; water.visible = false; scene.add(water);
    let flood = 0;

    // ---------- world API for disasters ----------
    let shakeAmt = 0;
    let curMood = { ...CALM }, moodTarget = { ...CALM };
    const W = {
      scene, debris, audio: null, ui: null, fogOverride: null, playerExposed: false,
      get flood() { return flood; },
      setFlood(l) { flood = l; water.visible = l > 0.02; water.position.y = l; },
      playerPos: () => player.pos, playerAlive: () => alive && onMap,
      randomPoint(frac = 0.9, avoidBunker = false) { for (;;) { const a = drand() * Math.PI * 2, r = Math.sqrt(drand()) * ISLAND_R * frac, x = Math.cos(a) * r, z = Math.sin(a) * r; if (!avoidBunker || !inBunker(x, z)) return new THREE.Vector3(x, 0, z); } },
      bunker, bunkerBox: BUNKER, bunkerMinX: BUNKER.x - BUNKER.hx, nearOpening(p) { return bunker.openings.some(o => Math.abs(o.x - p.x) < 3.5 && Math.abs(o.z - p.z) < 3.5 && p.y > o.y - 1 && p.y < o.y + 4); },
      surfaceAt(x, z) { let y = groundHeight(x, z); for (const b of blocks) if (b.alive && Math.abs(b.x - x) < b.w / 2 && Math.abs(b.z - z) < b.d / 2) y = Math.max(y, b.y + b.h / 2); return y; },
      forBlocksNear,
      forBlocksInBox(x0, x1, h, fn) { for (const b of blocks) if (b.alive && !b.perm && b.x > x0 && b.x < x1 && b.y - b.h / 2 < h) fn(b); },
      detach, shake(a) { shakeAmt = Math.max(shakeAmt, a); },
      randomBlock(highBias) { let best = null; for (let k = 0; k < (highBias ? 3 : 1); k++) { const b = blocks[(drand() * blocks.length) | 0]; if (b && b.alive && !b.perm && (!best || b.y > best.y)) best = b; } return best; },
      collapseBuilding() { const alive = [...BUILDINGS.map((_, i) => i), 100].filter(i => blocks.some(b => b.b === i && b.alive && !b.perm)); const bi = alive[(drand() * alive.length) | 0]; if (bi == null) return; blocks.filter(b => b.b === bi && b.alive && !b.perm && (bi !== 100 || b.part === 'catwalk' || drand() < 0.35)).forEach((b, k) => setTimeout(() => { if (alive && b.alive && api.phase === 'disaster') detach(b, (drand() - 0.5) * 4, -2, (drand() - 0.5) * 4); }, k * 12)); },
      precip: setPrecip,
      skyFlash(a) { sky.material.uniforms.flash.value = a; },
      explode(at, r, dmg, opts = {}) {
        forBlocksNear(at.x, at.z, r, (b) => { if (Math.abs(b.y - at.y) < r) { const dx = b.x - at.x, dz = b.z - at.z, d = Math.hypot(dx, dz) + 0.1; detach(b, dx / d * 14, 8 + Math.random() * 8, dz / d * 14); } });
        burst(at.clone().setY(at.y + 0.5), opts.lightning ? [0xffffff, 0x9fd8ff, 0xfff6a0] : [0xff7a20, 0xffc040, 0xff3a10, 0x553322], opts.lightning ? 16 : 34, opts.lightning ? 9 : 13);
        if (!opts.lightning) audio.sfx('boom', Math.max(0.2, 1 - player.pos.distanceTo(at) / 70));
        for (const e of entities()) {
          const d = e.pos.distanceTo(at.clone().setY(Math.max(at.y, e.pos.y > at.y ? at.y : e.pos.y)));
          const R2 = r * 1.5; if (d < R2) { e.damage(dmg * (1 - d / R2) + 10, opts.lightning ? 'lightning' : 'meteor'); e.knock(e.pos.x - at.x, e.pos.z - at.z, 10); }
        }
        const pd = player.pos.distanceTo(at); if (pd < 40) W.shake(0.5 * (1 - pd / 40));
      },
    };

    const audio = new DisasterAudio(music, { dir: C.AUDIO_DIR, files: { ...C.AUDIO_FILES, ...UI_FILES }, kit: C.KIT_SFX, beds: C.DISASTER_BEDS }); W.audio = audio;
    const playUi = makePlayUi(audio); W.playUi = playUi;

    // ---------- player state ----------
    let hp = C.MAX_HP, alive = true, onMap = false, dyingT = 0, hurtSfxT = 0, lastVy = 0, wasGround = true;
    const playerSheltered = (p) => collision.overlaps(p.x - 0.25, p.y + PH + 0.05, p.z - 0.25, p.x + 0.25, p.y + 18, p.z + 0.25);
    function damagePlayer(n, why) {
      if (!alive || !onMap || n <= 0 || api.godMode) return;
      hp = Math.max(0, hp - n); ui.setHp(hp, C.MAX_HP);
      if (n >= 3 || hurtSfxT <= 0) { ui.flash(); audio.sfx('hurt'); hurtSfxT = 0.45; }
      if (hp <= 0) killPlayer(why);
    }
    function killPlayer(why) {
      if (!alive) return;
      alive = false; dyingT = 2.2; player.enabled = false; avatar.root.visible = false;
      if (roundState && onMap) net.sendEvent('eliminated', { n: roundState.n });
      burst(player.pos.clone().setY(player.pos.y + 1.3), [0xf5cd30, 0x3d7bd9, 0x4a9e4a, 0xffffff], 28, 9, 0.45);
      audio.stinger('lose', 0.8, 'death'); // local player only
      const msg = { tornado: 'Swept away by the tornado', blizzard: 'Frozen solid', avalanche: 'Buried by the avalanche', flood: 'Swept away by icy water', meteor: 'Flattened by a meteor', lightning: 'Struck by lightning', debris: 'Hit by falling debris', fall: 'Took a nasty fall' }[why] || 'You didn\'t make it';
      popup('eliminated', { icon: '💀', title: 'ELIMINATED', sub: `${msg}. Wait for the next round!`, ms: 3200 });
    }
    const playerEnt = { player: true, get pos() { return player.pos; }, damage: (n, why) => damagePlayer(n, why), knock: (dx, dz, s) => { const d = Math.hypot(dx, dz) + 0.01; pushPlayer(dx / d * s * 0.05, dz / d * s * 0.05); player.vel.y = Math.max(player.vel.y, 6); } };
    function pushPlayer(dx, dz) {
      const p = player.pos;
      for (const [ax, d] of [['x', dx], ['z', dz]]) { if (!d) continue; p[ax] += d; if (collision.overlaps(p.x - HW, p.y, p.z - HW, p.x + HW, p.y + PH, p.z + HW)) p[ax] -= d; }
    }

    // ---------- bots ----------
    const shirtCols = ['#e24a3b', '#3d7bd9', '#4ea85a', '#e8a33a', '#9a6ac8', '#2fb8a8', '#e86aa0'];
    const bots = BOT_NAMES.map((name, i) => {
      const m = makeBotMesh(shirtCols[i]); scene.add(m.g);
      const lab = (() => { const c = document.createElement('canvas'); c.width = 256; c.height = 64; const g = c.getContext('2d'); g.font = '700 30px sans-serif'; g.textAlign = 'center'; g.lineWidth = 6; g.strokeStyle = 'rgba(0,0,0,.6)'; g.strokeText(name, 128, 42); g.fillStyle = '#fff'; g.fillText(name, 128, 42); const t = new THREE.CanvasTexture(c); keep(t); const s = new THREE.Sprite(keep(new THREE.SpriteMaterial({ map: t, depthTest: true, transparent: true }))); s.scale.set(2.4, 0.6, 1); s.position.y = 3.1; return s; })();
      m.g.add(lab);
      const bot = { name, m, pos: new THREE.Vector3(), vy: 0, hp: C.MAX_HP, alive: true, onMap: false, target: null, way: [], think: 0, walk: Math.random() * 6, dieT: 0, smart: Math.random() < 0.72 };
      bot.damage = (n) => { if (!bot.alive || !bot.onMap) return; bot.hp -= n; if (bot.hp <= 0) { bot.alive = false; bot.dieT = 1.0; } };
      bot.knock = (dx, dz, s) => { const d = Math.hypot(dx, dz) + 0.01; bot.pos.x += dx / d * s * 0.05; bot.pos.z += dz / d * s * 0.05; bot.vy = Math.max(bot.vy, 6); };
      return bot;
    });
    const entities = () => [playerEnt, ...bots.filter(b => b.alive && b.onMap).map(b => ({ pos: b.pos, damage: b.damage, knock: b.knock }))];
    const botBlocked = (x, y, z) => collision.overlaps(x - 0.35, y + 0.35, z - 0.35, x + 0.35, y + 2.4, z + 0.35);
    function botPlan(bot) {
      const id = current?.def.id, smart = bot.smart;
      bot.way = [];
      const nearestBuilding = () => { let best = null, bd = 1e9; for (const B of BUILDINGS) { const d = Math.hypot(B.x - bot.pos.x, B.z - bot.pos.z); if (d < bd) { bd = d; best = B; } } return best; };
      if (smart && (id === 'flood' || id === 'avalanche')) bot.way = [new THREE.Vector3(HILL_TOP.x + (Math.random() - 0.5) * 3, 0, HILL_TOP.z + (Math.random() - 0.5) * 3)];
      else if (smart && (id === 'blizzard' || id === 'acidrain' || id === 'gritstorm')) { const B = nearestBuilding(); const dx = B.x - B.cw * CELL / 2 + Math.floor(B.cw / 2) * CELL + CELL / 2; bot.way = [new THREE.Vector3(dx, 0, B.z + B.cd * CELL / 2 + 2.5), new THREE.Vector3(dx, 0, B.z)]; }
      else if (smart && id === 'tornado' && current?.inst?.pos) { const tp = current.inst.pos, d = new THREE.Vector3(bot.pos.x - tp.x, 0, bot.pos.z - tp.z).normalize(); bot.way = [bot.pos.clone().addScaledVector(d, 25)]; }
      else if (smart && id === 'earthquake') { for (let k = 0; k < 10; k++) { const p = W.randomPoint(0.85, true); if (BUILDINGS.every(B => Math.hypot(B.x - p.x, B.z - p.z) > 14)) { bot.way = [p]; break; } } }
      if (!bot.way.length) bot.way = [W.randomPoint(0.85, true)];
      for (const w of bot.way) { const r = Math.hypot(w.x, w.z); if (r > ISLAND_R - 3) w.multiplyScalar((ISLAND_R - 3) / r); }
    }
    function updateBots(dt, t) {
      for (const bot of bots) {
        const g = bot.m.g;
        if (!bot.alive) {
          if (bot.dieT > 0) { bot.dieT -= dt; g.rotation.x = Math.min(Math.PI / 2, g.rotation.x + dt * 5); if (bot.dieT <= 0) { burst(bot.pos.clone().setY(bot.pos.y + 1), [0xf5cd30, 0xffffff, 0x3d7bd9], 16, 7); g.visible = false; } }
          continue;
        }
        g.visible = true; g.rotation.x = 0;
        let moving = false;
        if (bot.onMap) {
          bot.think -= dt;
          if (bot.think <= 0 || !bot.way.length) { bot.think = 2 + Math.random() * 2; if (api.phase === 'disaster' || api.phase === 'warning' || !bot.way.length) botPlan(bot); }
          const w = bot.way[0];
          if (w) {
            const dx = w.x - bot.pos.x, dz = w.z - bot.pos.z, d = Math.hypot(dx, dz);
            if (d < 1.2) bot.way.shift();
            else {
              const sp = 7 * dt, nx = bot.pos.x + dx / d * sp, nz = bot.pos.z + dz / d * sp;
              const gy = (x, z) => groundHeight(x, z);
              let ok = false;
              if (!botBlocked(nx, gy(nx, nz), bot.pos.z) || gy(nx, bot.pos.z) - bot.pos.y < 0.8 && !botBlocked(nx, gy(nx, bot.pos.z), bot.pos.z)) { if (!botBlocked(nx, gy(nx, bot.pos.z), bot.pos.z)) { bot.pos.x = nx; ok = true; } }
              if (!botBlocked(bot.pos.x, gy(bot.pos.x, nz), nz)) { bot.pos.z = nz; ok = true; }
              if (!ok) { bot.way = [W.randomPoint(0.85, true)]; }
              g.rotation.y = Math.atan2(dx, dz); moving = true;
            }
          }
          const r = Math.hypot(bot.pos.x, bot.pos.z); if (r > ISLAND_R - 1) { bot.pos.x *= (ISLAND_R - 1) / r; bot.pos.z *= (ISLAND_R - 1) / r; }
          // vertical: ground (terraces), flood buoyancy, lifts
          const ground = groundHeight(bot.pos.x, bot.pos.z);
          bot.vy -= 32 * dt; bot.pos.y += bot.vy * dt;
          if (flood > 0.02 && bot.pos.y < flood - 1.6) { bot.vy = Math.max(bot.vy, 3); }
          if (bot.pos.y < ground) { if (bot.vy < -24) bot.damage((-bot.vy - 24) * 5); bot.pos.y = ground; bot.vy = 0; }
          // disaster hazard
          if (current && api.phase === 'disaster') {
            const h = current.inst.hazard({ pos: bot.pos, sheltered: botBlocked(bot.pos.x, bot.pos.y + 3, bot.pos.z) || playerSheltered(bot.pos) }, dt);
            if (h) { bot.damage((h.dmg || 0) * dt); bot.pos.x += (h.px || 0) * dt; bot.pos.z += (h.pz || 0) * dt; if (h.lift) bot.vy = Math.max(bot.vy, h.lift); }
          }
        } else {
          // lobby idle wander
          bot.think -= dt;
          if (bot.think <= 0) { bot.think = 2 + Math.random() * 3; bot.target = lobbySpawn(); }
          if (bot.target) { const dx = bot.target.x - bot.pos.x, dz = bot.target.z - bot.pos.z, d = Math.hypot(dx, dz); if (d > 0.5) { bot.pos.x += dx / d * 4 * dt; bot.pos.z += dz / d * 4 * dt; g.rotation.y = Math.atan2(dx, dz); moving = true; } }
          bot.pos.y = LOBBY.y;
        }
        bot.walk += dt * (moving ? 10 : 0);
        const sw = moving ? Math.sin(bot.walk) * 0.7 : 0;
        bot.m.legL.rotation.x = sw; bot.m.legR.rotation.x = -sw; bot.m.armL.rotation.x = -sw; bot.m.armR.rotation.x = sw;
        g.position.copy(bot.pos);
      }
    }

    // ---------- items ----------
    const owned = () => !!(economy.ownsGear?.(C.GAME_ID, 'greenBalloon'));
    let balloonOn = false, balloonMesh = null;
    function setBalloon(on) {
      balloonOn = on;
      player.mods.gravity = on ? 0.42 : 1; player.mods.jump = on ? 1.18 : 1;
      if (on && !balloonMesh) {
        balloonMesh = new THREE.Group();
        const b = new THREE.Mesh(new THREE.SphereGeometry(0.55, 16, 12), new THREE.MeshStandardMaterial({ color: '#3ad65a', roughness: 0.25, emissive: '#1a6a2a', emissiveIntensity: 0.3 })); b.scale.y = 1.2; b.position.y = 2.6;
        const s = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 2.1), new THREE.MeshBasicMaterial({ color: '#eee' })); s.position.y = 1.2;
        balloonMesh.add(b, s); balloonMesh.position.set(0, -0.9, 0.1);
        (avatar.bones?.armR || avatar.root).add(balloonMesh);
      } else if (!on && balloonMesh) { balloonMesh.parent?.remove(balloonMesh); balloonMesh.traverse(o => { o.geometry?.dispose(); o.material?.dispose(); }); balloonMesh = null; }
      ui.setBalloon(owned(), on, C.GEAR_PRICES_BB.greenBalloon);
    }
    /** Popup + its sound. Sound names live in C.POPUP_SFX so the Sound Designer's files can be swapped in one place. */
    function popup(kind, opts, withSound = true) { ui.popup(kind, opts, () => playUi('popup_close')); playUi('popup_open'); const snd = C.POPUP_SFX[kind]; if (withSound && snd) audio.sfx(snd); }
    const deny = (text) => { playUi('error'); bus.emit('toast', { text, icon: '😕' }); };
    // Paid one-use items go through the Publisher's economy.buyConsumable (server prices them from
    // CONSUMABLE_PRICES_BB). The effect is applied only once it resolves ok. A per-purchase ref makes retries free.
    const sess = Math.random().toString(36).slice(2, 8);
    let buySeq = 0;
    async function buyConsumable(id) {
      const price = C.CONSUMABLE_PRICES_BB[id];
      const r = await economy.buyConsumable(C.GAME_ID, id, price, `nds:${sess}:r${api.round}:${id}:${++buySeq}`);
      return !!(r && r.ok);
    }
    let lastCount = 0;
    const hatPos = [];
    function feedHatProximity() {
      const fn = avatar?.updateProximity, nd = avatar?.setNearbyDistance; if (!fn && !nd) return;
      hatPos.length = 0;
      for (const b of bots) if (b.alive && b.onMap && b.hat === 'tornado_hat') hatPos.push(b.pos);
      try { const peers = window.iceberg?.mp?.nearby?.() || []; for (const p of peers) if (p?.pos && (p.equipped?.hat === 'tornado_hat' || p.wearing?.includes?.('tornado_hat'))) hatPos.push(p.pos); } catch { /* optional API */ }
      try {
        if (fn) avatar.updateProximity(hatPos);
        else { let d = Infinity; for (const p of hatPos) d = Math.min(d, Math.hypot(p.x - player.pos.x, p.y - player.pos.y, p.z - player.pos.z)); avatar.setNearbyDistance(d); }
      } catch (e) { console.warn('hat proximity', e); }
    }
    let stormQueued = null, buying = false, applesThisRound = 0, lastAppleT = -1e9, stormsBoughtRound = -1;
    const nowS = () => performance.now() / 1000;
    const api = {
      phase: 'intermission', timer: C.T_INTERMISSION, round: 0, bots, get hp() { return hp; }, get alive() { return alive; }, get onMap() { return onMap; },
      get disaster() { return current?.def.id || null; }, get inst() { return current?.inst || null; }, get blocksAlive() { return blocks.filter(b => b.alive).length; }, get debris() { return debris.length; },
      get music() { const tr = audio.track; return { state: tr?.state || 'none', file: tr?.file || null, error: tr?.error || null, playingTrack: audio.usingTrack, mode: audio.mode, samples: Object.fromEntries(Object.entries(audio.bank || {}).map(([k, v]) => [k, v.state])), loops: Object.keys(audio.sl || {}) }; },
      get balloonOn() { return balloonOn; }, get stormQueued() { return stormQueued; }, get paidThisSession() { return paid; }, quest: null,
      damage: (n, why = 'debris') => damagePlayer(n, why), get flood() { return flood; }, W,
      balloon() {
        if (owned()) { setBalloon(!balloonOn); audio.sfx('balloon'); return true; }
        const r = economy.buyGear?.(C.GAME_ID, 'greenBalloon', C.GEAR_PRICES_BB.greenBalloon);
        if (!r || !r.ok) { deny(`You need ${C.GEAR_PRICES_BB.greenBalloon} Birg Bucks for the Green Balloon`); return false; }
        popup('bought', { icon: '🎈', title: 'Green Balloon', sub: 'Yours forever. Works in Natural Disaster Survival only.' });
        setBalloon(true); return true;
      },
      apple() {
        if (!alive) { deny('You can eat an apple once you are back in the game'); return false; }
        if (hp >= C.MAX_HP) { deny('You are already at full health'); return false; }
        if (applesThisRound >= C.APPLES_PER_ROUND) { deny(`Only ${C.APPLES_PER_ROUND} Apples per round`); return false; }
        const wait = C.APPLE_COOLDOWN_S - (nowS() - lastAppleT);
        if (wait > 0) { deny(`Still chewing… ${Math.ceil(wait)}s`); return false; }
        if (buying) return false;
        buying = true; applesThisRound++; lastAppleT = nowS(); // reserve before the await so double taps can't slip through
        return buyConsumable('apple').then((ok) => {
          buying = false;
          if (!ok) { applesThisRound--; lastAppleT = -1e9; deny(`You need ${C.APPLE_PRICE_BB} Birg Bucks for an Apple`); return false; }
          if (!alive) return true;
          eatApple(); return true;
        });
      },
      get applesThisRound() { return applesThisRound; },
    };
    function eatApple() {
        hp = Math.min(C.MAX_HP, hp + C.APPLE_HEAL); ui.setHp(hp, C.MAX_HP); audio.sfx('eat');
        burst(player.pos.clone().setY(player.pos.y + 2), [0x7dff6a, 0xffffff], 12, 3, 0.2);
        popup('bought', { icon: '🍎', title: `Crunch! +${C.APPLE_HEAL} HP`, sub: `${C.APPLES_PER_ROUND - applesThisRound} Apple${C.APPLES_PER_ROUND - applesThisRound === 1 ? '' : 's'} left this round`, ms: 1800 });
    }
    Object.assign(api, {
      storm() { if (stormsBoughtRound === api.round) { deny('One Bigger Storm per round'); return false; } if (stormQueued) { deny(`Bigger Storm already set: ${findDisaster(stormQueued).name}`); return false; } ui.showPick(); return true; },
      pickStorm(id) {
        if (stormQueued || buying || stormsBoughtRound === api.round || !findDisaster(id)) return false;
        buying = true; const forRound = api.round; stormsBoughtRound = forRound; ui.hidePick();
        return buyConsumable('biggerStorm').then((ok) => {
          buying = false;
          if (!ok) { if (stormsBoughtRound === forRound) stormsBoughtRound = -1; deny(`You need ${C.BIGGER_STORM_PRICE_BB} Birg Bucks for a Bigger Storm`); return false; }
          stormQueued = id; ui.setStormQueued(findDisaster(id).name);
          if (!net.isHost()) net.sendEvent('storm', { id }); // the host owns the round pick (one Bigger Storm per round, server-wide)
          popup('bought', { icon: findDisaster(id).icon, title: 'Bigger Storm ready', sub: `Next round: a BIGGER ${findDisaster(id).name}!` }); return true;
        });
      },
      /** Test/debug: jump straight to a round with this disaster. */
      startRound(id, big = false) { if (current) endDisaster(); if (!alive) toLobby(); if (id) { forced = { id, big }; } api.phase = 'intermission'; if (id) nextPhase(); else { toLobby(); api.timer = C.T_INTERMISSION; } },
      endPhase() { nextPhase(); },
      /** Console/filming helper: start this disaster right now (skips the lobby and the warning). */
      forceDisaster(id, big = false) { if (!findDisaster(id)) return false; api.startRound(id, big); nextPhase(); return true; },
      /** Console/filming helper: end the lobby wait now (next round starts with its warning). */
      skipLobby() { if (api.phase === 'intermission') nextPhase(); return api.phase; },
      /** Console/filming helper: freeze the round clock. */
      paused: false,
      /** Console/filming helper: walk around the map between rounds (pauses the clock). */
      visitMap() { api.paused = true; if (!onMap) teleportToMap(); return true; },
      /** Console/filming helper: no damage while true. */
      godMode: false,
    });
    const ui = new DisasterUI({ prices: C.CONSUMABLE_PRICES_BB, disasters: DISASTERS, onBalloon: api.balloon, onApple: api.apple, onStorm: api.storm, onPick: api.pickStorm, onHunt: () => hunt.toggle(), onPress: () => playUi('click') });
    const hunt = new HuntMenu({ sfx: (n) => (n === 'open' ? playUi('popup_open') : n === 'close' ? playUi('popup_close') : n === 'click' ? playUi('click') : n === 'deny' ? playUi('error') : n === 'big' ? playUi('play') : audio.sfx(n)), ambience: (on) => audio.sampleLoop('hunt', on ? 0.75 : 0, { name: 'huntAmb', freq: 380, type: 'lowpass', lfo: 0.25 }) });
    api.hunt = hunt;
    W.ui = ui;
    ui.setHp(hp, C.MAX_HP); ui.setBalloon(owned(), false, C.GEAR_PRICES_BB.greenBalloon);

    // ---------- event quest ----------
    const quest = QUESTS[0];
    const qhud = new QuestHud(quest);
    let lastQP = null;
    const tracker = createQuestTracker(quest, { onChange: (s) => { if (lastQP != null && s.progress > lastQP) playUi('notification'); lastQP = s.progress; qhud.update(s); }, onResult: (r) => { if (r.granted) { hunt.celebrate(r.itemId || quest.rewardItemId); if (hunt.open) hunt.refresh(); } } });
    api.quest = tracker;

    // ---------- round flow ----------
    let current = null, forced = null, lastId = null, paid = 0;
    function applyMood(m, k = 1) { moodTarget = { ...m }; if (k >= 1) curMood = { ...m }; }
    function teleportToMap() {
      const pts = spawnPoints().sort(() => Math.random() - 0.5);
      onMap = true; alive = true; hp = C.MAX_HP; ui.setHp(hp, C.MAX_HP);
      player.enabled = true; avatar.root.visible = true;
      const [x, z] = pts[0]; player.teleport(new THREE.Vector3(x, groundHeight(x, z) + 0.2, z), Math.atan2(-x, -z));
      bots.forEach((b, i) => { const [bx, bz] = pts[(i + 1) % pts.length]; b.pos.set(bx + Math.random() * 2, groundHeight(bx, bz), bz + Math.random() * 2); b.alive = true; b.hp = C.MAX_HP; b.onMap = true; b.way = []; b.think = 0; b.vy = 0; b.smart = Math.random() < 0.72; });
      audio.sfx('teleport');
    }
    function toLobby() {
      onMap = false; alive = true; hp = C.MAX_HP; ui.setHp(hp, C.MAX_HP); player.enabled = true; avatar.root.visible = true;
      player.teleport(lobbySpawn(), Math.PI);
      bots.forEach(b => { b.onMap = false; b.alive = true; b.hp = C.MAX_HP; b.pos.copy(lobbySpawn()); });
    }
    // ---------- shared rounds (net.js) ----------
    const net = createNet(ctx);
    let lastBotSurv = 0;
    let roundState = null, roundSurvivors = new Set(), resultsShownFor = 0;
    function startFromState(r) {
      if (!r || (roundState && r.n <= roundState.n)) return;
      roundState = r; roundSurvivors = new Set();
      if (current) endDisaster();
      if (!alive) toLobby();
      if (mapDirty) resetMap();
      const pick = r.disaster, big = !!r.big;
      lastId = pick;
      current = { def: findDisaster(pick), big, inst: null };
      seedDisasterRng(mulberry32(r.seed));
        api.round = r.n; applesThisRound = 0;
        teleportToMap();
        api.phase = 'warning'; api.timer = Math.max(0, Math.min(C.T_WARNING, (r.startsAt - net.now()) / 1000));
        applyMood(current.def.mood, 0);
        audio.setMode('storm');
        popup('warning', { icon: current.def.icon, title: `${big ? 'BIGGER ' : ''}${current.def.name.toUpperCase()}!`, sub: current.def.warn, ms: 4400 });
    }
    Object.defineProperties(api, { roundState: { get: () => roundState }, net: { get: () => net } });
    net.onState('round', startFromState);
    net.onState('results', (res) => {
      if (!res || res.n !== roundState?.n || resultsShownFor === res.n) return; resultsShownFor = res.n;
      const names = (res.survivors || []).map(id => (id === net.selfId ? 'You' : id));
      lastSurvivors = names.length;
      const subTxt = (names.length ? names.slice(0, 8).join(', ') + (names.length > 8 ? ` +${names.length - 8}` : '') : 'No players made it') + (lastBotSurv ? ` · ${lastBotSurv} bot${lastBotSurv === 1 ? '' : 's'}` : '');
      setTimeout(() => live && popup('info', { icon: '🏁', title: `Round ${res.n} survivors`, sub: subTxt, ms: 3200 }, false), 2000);
      api.lastResults = res;
    });
    net.onEvent('storm', (e) => { if (net.isHost() && e.from !== net.selfId && !stormQueued && findDisaster(e.id)) { stormQueued = e.id; ui.setStormQueued(findDisaster(e.id).name); } });
    net.onEvent('survived', (e) => { if (e?.n === roundState?.n) roundSurvivors.add(e.from); });
    net.onEvent('eliminated', (e) => { if (e?.n === roundState?.n) roundSurvivors.delete(e.from); });
    net.onHostChanged?.(() => { if (net.isHost() && api.phase === 'intermission' && api.timer > C.T_INTERMISSION) api.timer = C.T_INTERMISSION; }); // new host carries on from the current state
    function publishResults() {
      if (!net.isHost() || !roundState) return;
      const n = roundState.n, ids = [...roundSurvivors];
      // NPC bots are simulated per client (local flavour), so only real players go into the shared list
      setTimeout(() => net.setState('results', { n, survivors: ids }), net.online ? 600 : 0);
    }
    function beginDisaster() {
      const big = !!current.big;
      if (roundState) seedDisasterRng(mulberry32(roundState.seed ^ 0x9e3779b9)); // same randomness on every client
      current.inst = current.def.create(W, big ? C.BIG_STORM_MULT : 1);
      audio.setMode('storm');
    }
    function endDisaster() {
      if (!current) return;
      try { current.inst?.end(); } catch (e) { console.warn(e); }
      current = null; audio.setMode('calm'); audio.stopLoops(); audio.stopSampleLoops(); applyMood(CALM, 0);
      W.setFlood(0); W.fogOverride = null; ui.setFrost(0); setPrecip(null);
    }
    function nextPhase() {
      if (api.phase === 'intermission') {
        if (mapDirty) resetMap();
        let pick, big = false;
        // Host-authoritative: only the host picks; everyone (host included) starts the round from the 'round' state.
        if (!net.isHost()) { api.timer = 1; return; } // wait for the host's round
        if (forced) { pick = forced.id; big = forced.big; forced = null; }
        else if (stormQueued) { pick = stormQueued; big = true; stormQueued = null; ui.setStormQueued(null); }
        else { const pool = DISASTERS.filter(d => d.id !== lastId); pick = pool[(Math.random() * pool.length) | 0].id; }
        net.setState('round', { n: (roundState?.n || api.round) + 1, startsAt: net.now() + C.T_WARNING * 1000, disaster: pick, big, seed: (Math.random() * 2 ** 32) >>> 0, mapVariant: 0 });
      } else if (api.phase === 'warning') {
        beginDisaster(); api.phase = 'disaster'; api.timer = C.T_DISASTER;
      } else if (api.phase === 'disaster') {
        const name = current.def.name, dIcon = current.def.icon;
        endDisaster();
        const botSurv = bots.filter(b => b.alive && b.onMap).length;
        bots.forEach(b => { if (b.alive && b.onMap) sessionWins[b.name] = (sessionWins[b.name] || 0) + 1; });
        if (alive && onMap) sessionWins.you++;
        lastSurvivors = botSurv + (alive && onMap ? 1 : 0); lastBotSurv = botSurv;
        if (alive && onMap && roundState) net.sendEvent('survived', { n: roundState.n });
        publishResults();
        save = { ...save, rounds: save.rounds + 1 };
        if (alive && onMap) {
          save.survived++; save.streak = (save.streak || 0) + 1; save.best = Math.max(save.best, save.streak);
          const pay = C.survivalPayout(paid);
          audio.stinger('win', 0.9, 'survive');
          popup('survived', { icon: '🎉', title: 'YOU SURVIVED!', sub: `${botSurv} other${botSurv === 1 ? '' : 's'} made it · streak ${save.streak}`, ms: 3500 }, false);
          if (pay > 0) { paid += pay; economy.earn(pay, C.EARN_REASON); setTimeout(() => live && popup('reward', { title: `+${pay} Birg Bucks`, sub: `${C.SESSION_EARN_CAP_BB - paid} BB left to earn this session`, ms: 2600 }), 700); }
          else popup('reward', { icon: '🧊', title: 'Session reward limit reached', sub: 'Keep playing for the quest and bragging rights!', ms: 2600 }, false);
          tracker.add(1);
        } else { save.streak = 0; popup('info', { icon: dIcon, title: `${name} is over`, sub: `${botSurv} survivor${botSurv === 1 ? '' : 's'}`, ms: 3000 }); }
        persist(economy, save);
        api.phase = 'results'; api.timer = C.T_RESULTS;
      } else {
        toLobby(); api.phase = 'intermission'; api.timer = C.T_INTERMISSION;
      }
    }

    // ---------- input (engine.input, edge-detected; works for touch-simulated keys) ----------
    const prevKeys = {};
    const pressed = (code) => { const d = engine.input.down(code), was = prevKeys[code]; prevKeys[code] = d; return d && !was; };
    let live = true;
    const hot = (code) => { if (code === 'Digit1') api.balloon(); else if (code === 'Digit2') api.apple(); else if (code === 'Digit3') api.storm(); else if (code === 'KeyH') hunt.toggle(); };
    engine.input.onKey((e) => { if (!live || engine.game !== game || prevKeys[e.code]) return; if (/^Digit[1-3]$/.test(e.code)) { prevKeys[e.code] = true; hot(e.code); } else if (e.code === 'KeyH') { prevKeys[e.code] = true; hot(e.code); } else if (e.code === 'Escape' && hunt.open) hunt.close(); });

    resetMap();
    toLobby();
    const spawn = player.pos.clone();
    let lastTick = 0;

    const game = {
      scene, collision, spawn, spawnFacing: Math.PI, music: 'none', maxCamDist: 22, nds: api,
      onFall: () => { if (!onMap) player.teleport(lobbySpawn(), Math.PI); },
      update(dt, t, pl) {
        // Frost Tornado Hat proximity (effect owned by Cosmetics): feed the local avatar the positions of others wearing it.
        if (api.phase === 'disaster' || api.phase === 'warning') feedHatProximity();
        if (api.phase === 'warning' && current?.def.warnLoop) audio.sampleLoop(current.def.warnLoop[0], current.def.warnLoop[1]); // ground starts rumbling during the warning
        if (!audio.timer) audio.start();
        for (const code of ['Digit1', 'Digit2', 'Digit3', 'KeyH']) if (pressed(code)) hot(code);
        // timers
        if (!api.paused) api.timer -= dt; hurtSfxT -= dt;
        if (api.timer <= 0) nextPhase();
        const secs = Math.max(0, Math.ceil(api.timer));
        if (api.phase === 'warning' && secs !== lastTick && secs <= 3) { audio.sfx('tick'); }
        lastTick = secs;
        const aliveCount = (alive && onMap ? 1 : 0) + bots.filter(b => b.alive && b.onMap).length;
        const mmss = `0:${String(secs).padStart(2, '0')}`;
        if (api.phase === 'intermission' && api.timer <= 3.5 && !api.paused) { const n = Math.ceil(api.timer); if (n !== lastCount && n >= 1) { lastCount = n; popup('round', { title: `ROUND ${api.round + 1}`, count: n, sub: n === 1 ? 'Get ready to teleport!' : 'Survive the disaster to earn Birg Bucks', ms: 950 }); } } else if (api.phase !== 'intermission') lastCount = 0;
        if (api.phase === 'intermission') ui.setPanel('Intermission', `Next round in ${mmss}`, stormQueued ? `🌪️ Bigger Storm queued: ${findDisaster(stormQueued).name}` : `Round ${api.round + 1} · ${save.survived} survived all-time`);
        else if (api.phase === 'warning') ui.setPanel(`⚠ ${current.big ? 'Bigger ' : ''}${current.def.name} warning`, `${current.def.icon} Get ready! ${mmss}`, current.def.warn, true);
        else if (api.phase === 'disaster') ui.setPanel(`${current.def.icon} ${current.big ? 'Bigger ' : ''}${current.def.name}`, `Survive! ${mmss}`, `👥 ${aliveCount} / ${bots.length + 1} alive${!alive ? ' · you are out' : ''}`, true);
        else ui.setPanel('Round over', 'Back to the lobby…', `👥 ${aliveCount} survived`);

        // disaster update
        if (current?.inst) current.inst.update(dt, t, 1 - Math.max(0, api.timer) / C.T_DISASTER);

        // player hazards
        if (onMap && alive) {
          const p = pl.pos;
          const r = Math.hypot(p.x, p.z); if (r > ISLAND_R - 1) { p.x *= (ISLAND_R - 1) / r; p.z *= (ISLAND_R - 1) / r; }
          const sheltered = playerSheltered(p);
          W.playerExposed = !sheltered;
          if (current?.inst && api.phase === 'disaster') {
            const h = current.inst.hazard({ pos: p, sheltered, player: true }, dt);
            if (h) {
              if (h.dmg) damagePlayer(h.dmg * dt, current.def.id);
              pushPlayer((h.px || 0) * dt, (h.pz || 0) * dt);
              if (h.lift) pl.vel.y = Math.max(pl.vel.y, h.lift);
              if (h.swim != null && p.y < h.swim - 1.7) pl.vel.y = Math.max(pl.vel.y, 3.5);
            }
          }
          // fall damage
          if (!wasGround && pl.onGround && lastVy < -24) damagePlayer((-lastVy - 24) * 5, 'fall');
          wasGround = pl.onGround; lastVy = pl.vel.y;
          if (balloonOn && pl.vel.y < -9) pl.vel.y = -9;
        } else if (!onMap) {
          const p = pl.pos, dx = p.x - LOBBY.x, dz = p.z - LOBBY.z, d = Math.hypot(dx, dz), R = LOBBY.r - 1;
          if (d > R) { p.x = LOBBY.x + dx / d * R; p.z = LOBBY.z + dz / d * R; }
          if (p.y < LOBBY.y - 6) pl.teleport(lobbySpawn(), Math.PI);
          W.playerExposed = false;
        }
        if (!alive) { dyingT -= dt; if (dyingT <= 0) { toLobby(); ui.setPanel('', '', ''); } }

        // debris physics + damage
        const ents = entities();
        let n = 0;
        for (let i = debris.length - 1; i >= 0; i--) {
          const q = debris[i]; q.life -= dt;
          if (q.life <= 0) { debris.splice(i, 1); continue; }
          q.v.y -= 30 * dt; q.p.addScaledVector(q.v, dt); q.r.addScaledVector(q.av, dt);
          const floor = Math.max(groundHeight(q.p.x, q.p.z), flood > 0.02 ? flood - 0.3 : -99) + q.h / 2;
          if (q.p.y < floor) { q.p.y = floor; q.v.y = Math.abs(q.v.y) > 4 ? -q.v.y * 0.3 : 0; q.v.x *= 0.7; q.v.z *= 0.7; q.av.multiplyScalar(0.7); }
          const sp = q.v.length();
          if (sp > 7) for (const e of ents) {
            if (q.hit.has(e.pos)) continue;
            const ep = e.pos;
            if (Math.abs(ep.x - q.p.x) < 0.5 + q.w / 2 && Math.abs(ep.z - q.p.z) < 0.5 + q.d / 2 && q.p.y > ep.y - q.h / 2 && q.p.y < ep.y + PH + q.h / 2) { q.hit.add(ep); e.damage(Math.min(35, sp * 1.6), 'debris'); }
          }
        }
        for (const q of debris) {
          const s = q.life < 1 ? q.life : 1;
          P.copy(q.p); S.set(q.w * s, q.h * s, q.d * s); Q.setFromEuler(E.set(q.r.x, q.r.y, q.r.z)); M4.compose(P, Q, S);
          debrisMesh.setMatrixAt(n, M4); debrisMesh.setColorAt(n, COL.setHex(q.c)); n++;
        }
        debrisMesh.count = n; debrisMesh.instanceMatrix.needsUpdate = true; if (debrisMesh.instanceColor) debrisMesh.instanceColor.needsUpdate = true;

        // particles
        let pn = 0;
        for (let i = parts.length - 1; i >= 0; i--) { const q = parts[i]; q.life -= dt; if (q.life <= 0) { parts.splice(i, 1); continue; } q.v.y -= 20 * dt; q.p.addScaledVector(q.v, dt); }
        for (const q of parts) { P.copy(q.p); const s = q.s * Math.min(1, q.life * 2); S.set(s, s, s); M4.compose(P, Q.identity(), S); partMesh.setMatrixAt(pn, M4); partMesh.setColorAt(pn, COL.setHex(q.c)); pn++; }
        partMesh.count = pn; partMesh.instanceMatrix.needsUpdate = true; if (partMesh.instanceColor) partMesh.instanceColor.needsUpdate = true;

        // precipitation follows the camera
        if (precip) {
          const { pos: pp, o } = precip, cp = engine.camera.position, N = o.count;
          for (let i = 0; i < N; i++) {
            let x = pp[i * 3] + o.wind[0] * dt, y = pp[i * 3 + 1] - o.fall * dt * (0.7 + (i % 7) * 0.08), z = pp[i * 3 + 2] + o.wind[1] * dt;
            if (y < Math.max(0, flood)) { y += 40; }
            if (x - cp.x > 40) x -= 80; else if (x - cp.x < -40) x += 80;
            if (z - cp.z > 40) z -= 80; else if (z - cp.z < -40) z += 80;
            pp[i * 3] = x; pp[i * 3 + 1] = y; pp[i * 3 + 2] = z;
          }
          precip.pts.position.y = 0; precip.pts.geometry.attributes.position.needsUpdate = true;
        }

        // mood (sky, fog, light) eases toward the target
        const k = Math.min(1, dt * 0.8);
        for (const key of ['near', 'far', 'sun', 'hemi']) curMood[key] += (moodTarget[key] - curMood[key]) * k;
        const lerpC = (u, a, b) => u.lerp(new THREE.Color(b), k);
        lerpC(sky.material.uniforms.top.value, null, moodTarget.top); lerpC(sky.material.uniforms.bottom.value, null, moodTarget.bottom); lerpC(scene.fog.color, null, moodTarget.fog);
        const fo = W.fogOverride;
        scene.fog.near += ((fo ? fo.near : curMood.near) - scene.fog.near) * k; scene.fog.far += ((fo ? fo.far : curMood.far) - scene.fog.far) * k;
        sun.intensity = curMood.sun; hemi.intensity = curMood.hemi;
        sky.position.copy(engine.camera.position);
        sun.position.set(pl.pos.x + 40, pl.pos.y + 70, pl.pos.z + 25); sun.target.position.set(pl.pos.x, pl.pos.y, pl.pos.z);
        oceanM.color.setHSL(0.56, 0.5, 0.3 + Math.sin(t * 0.5) * 0.02);
        if (water.visible) { waterM.opacity = 0.75 + Math.sin(t * 2) * 0.04; water.position.y = flood + Math.sin(t * 1.5) * 0.06; }

        updateBots(dt, t);
        drawBoards();
        if (boards.flame) { boards.flame.scale.set(1 + Math.sin(t * 13) * 0.12, 0.85 + Math.abs(Math.sin(t * 9)) * 0.35, 1); boards.fireLight.intensity = 40 + Math.sin(t * 17) * 6 + Math.random() * 4; }

        // camera shake (applied after the player's camera update, before render)
        if (shakeAmt > 0.001) { const c = engine.camera.position; c.x += (Math.random() - 0.5) * shakeAmt; c.y += (Math.random() - 0.5) * shakeAmt; c.z += (Math.random() - 0.5) * shakeAmt; if (onMap && alive && api.phase === 'disaster') pushPlayer((Math.random() - 0.5) * shakeAmt * 0.3, (Math.random() - 0.5) * shakeAmt * 0.3); }
        shakeAmt *= Math.pow(0.02, dt);
      },
      dispose() {
        live = false;
        endDisaster(); setBalloon(false); audio.stop(); ui.dispose(); hunt.dispose(); net.dispose?.(); tracker.dispose(); qhud.dispose();
        avatar.root.visible = true; player.enabled = true;
        engine.camera.far = camFar; engine.camera.updateProjectionMatrix();
        for (const d of disposables) d.dispose?.();
        bots.forEach(b => b.m.g.traverse(o => o.material?.dispose?.()));
        persist(economy, save);
      },
    };
    return game;
  },
};
