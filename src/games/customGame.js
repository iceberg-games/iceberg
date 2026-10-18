// Runtime + editor for user-created games ("Create a Game").
// A game is a plain JSON document, so it can be saved, exported and shared:
// { id, name, sky, music, ground, snow, spawn:[x,y,z], blocks:[[x,y,z,type]],
//   coins:[[x,y,z]], models:[{modelId,x,y,z,rotY,scale}], thumbnail, createdAt, updatedAt }
import * as THREE from 'three';
import { Collision } from '../engine/collision.js';
import { Building } from '../game/building.js';
import { CoinField } from '../game/coins.js';
import { ModelPlacer } from '../game/models.js';
import { REWARDS } from '../core/economy.js';
import { bus } from '../core/events.js';

export const SKIES = {
  day:    { name: 'Frosty Day',   top: '#7fb8e6', horizon: '#e9f5ff', sun: 1.6, hemi: 1.1, sunColor: '#fff8ee' },
  sunset: { name: 'Polar Sunset', top: '#5b6fb0', horizon: '#ffb38a', sun: 1.2, hemi: 0.8, sunColor: '#ffb070' },
  night:  { name: 'Aurora Night', top: '#081428', horizon: '#1f5a5a', sun: 0.35, hemi: 0.45, sunColor: '#9fb8ff', stars: true },
};
export const GROUNDS = {
  baseplate: { name: 'Snow Baseplate (64×64)' },
  island:    { name: 'Glacier Island' },
};
export const TEMPLATES = {
  blank:  { name: 'Blank baseplate', make: () => ({ ground: 'baseplate', sky: 'day', blocks: [], coins: [], spawn: [0.5, 0, 0.5] }) },
  island: { name: 'Glacier island starter', make: () => {
    const blocks = [];
    for (let x = -3; x <= 3; x++) for (let z = -3; z <= 3; z++) if (Math.abs(x) === 3 || Math.abs(z) === 3) for (let y = 0; y < 2; y++) if (!(z === 3 && Math.abs(x) <= 1 && y < 2)) blocks.push([x + 8, y, z, y ? 'ice' : 'packed']);
    for (let i = 0; i < 6; i++) blocks.push([-6, i, -6 + i, 'glacier']);
    const coins = []; for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; coins.push([Math.cos(a) * 14, 1.1, Math.sin(a) * 14]); }
    coins.push([-6 + 0.5, 7, -0.5]);
    return { ground: 'island', sky: 'sunset', blocks, coins, spawn: [0.5, 0, 0.5] };
  } },
};

export function newGameDoc(template = 'blank') {
  const t = TEMPLATES[template] || TEMPLATES.blank;
  return { id: 'g_' + Date.now().toString(36), name: 'My Iceberg Game', music: 'winter', snow: true, models: [], ...t.make(), template, createdAt: Date.now(), updatedAt: Date.now() };
}

function buildEnvironment(scene, doc) {
  const sky = SKIES[doc.sky] || SKIES.day;
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color(sky.top) }, horizon: { value: new THREE.Color(sky.horizon) } },
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader: 'uniform vec3 top; uniform vec3 horizon; varying vec3 vP; void main(){ float h = clamp(vP.y*1.6,0.0,1.0); gl_FragColor = vec4(mix(horizon, top, pow(h,0.8)),1.0);}',
  });
  scene.add(new THREE.Mesh(new THREE.SphereGeometry(400, 32, 16), skyMat));
  scene.fog = new THREE.Fog(sky.horizon, 70, 300);
  if (sky.stars) {
    const n = 800, p = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { const v = new THREE.Vector3().randomDirection(); v.y = Math.abs(v.y) + 0.05; v.normalize().multiplyScalar(350); p.set([v.x, v.y, v.z], i * 3); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    scene.add(new THREE.Points(g, new THREE.PointsMaterial({ color: '#ffffff', size: 1.5, sizeAttenuation: false, fog: false })));
    // aurora ribbon
    const ribbon = new THREE.Mesh(new THREE.PlaneGeometry(500, 60, 1, 1), new THREE.MeshBasicMaterial({ color: '#4dffb0', transparent: true, opacity: 0.18, side: THREE.DoubleSide, fog: false, blending: THREE.AdditiveBlending, depthWrite: false }));
    ribbon.position.set(0, 120, -250); ribbon.rotation.x = -0.3; scene.add(ribbon);
  }
  scene.add(new THREE.HemisphereLight('#dff0ff', '#9fb6c8', sky.hemi));
  const sun = new THREE.DirectionalLight(sky.sunColor, sky.sun);
  sun.position.set(30, 50, 20); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -40, right: 40, top: 40, bottom: -40, far: 150 });
  scene.add(sun, sun.target);

  let ground, bounds;
  const snowMat = new THREE.MeshStandardMaterial({ color: '#eef5fb', roughness: 0.95 });
  if (doc.ground === 'island') {
    ground = new THREE.Mesh(new THREE.CircleGeometry(32, 64), snowMat);
    const water = new THREE.Mesh(new THREE.CircleGeometry(400, 32), new THREE.MeshStandardMaterial({ color: '#4f8fb8', roughness: 0.15, metalness: 0.3 }));
    water.rotation.x = -Math.PI / 2; water.position.y = -1.2; scene.add(water);
    const cliff = new THREE.Mesh(new THREE.CylinderGeometry(32, 33, 3, 64, 1, true), new THREE.MeshStandardMaterial({ color: '#cfe6f7', flatShading: true }));
    cliff.position.y = -1.5; scene.add(cliff);
    bounds = { type: 'circle', r: 31 };
  } else {
    const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
    g.fillStyle = '#eef5fb'; g.fillRect(0, 0, 64, 64); g.strokeStyle = '#c9dceb'; g.lineWidth = 2; g.strokeRect(0, 0, 64, 64);
    const tex = new THREE.CanvasTexture(c); tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(64, 64); tex.colorSpace = THREE.SRGBColorSpace;
    ground = new THREE.Mesh(new THREE.PlaneGeometry(64, 64), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 }));
    const under = new THREE.Mesh(new THREE.BoxGeometry(64, 2, 64), new THREE.MeshStandardMaterial({ color: '#b8cfe0' }));
    under.position.y = -1.01; scene.add(under);
    bounds = { type: 'box', minX: -31.5, maxX: 31.5, minZ: -31.5, maxZ: 31.5 };
  }
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);

  let snow = null, snowSpd;
  if (doc.snow) {
    const N = 1500, pos = new Float32Array(N * 3); snowSpd = new Float32Array(N);
    for (let i = 0; i < N; i++) { pos[i * 3] = (Math.random() - 0.5) * 80; pos[i * 3 + 1] = Math.random() * 35; pos[i * 3 + 2] = (Math.random() - 0.5) * 80; snowSpd[i] = 0.8 + Math.random() * 1.3; }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    snow = new THREE.Points(geo, new THREE.PointsMaterial({ color: '#fff', size: 0.15, transparent: true, opacity: 0.85, depthWrite: false }));
    snow.frustumCulled = false; scene.add(snow);
  }
  const update = (dt, focus) => {
    sun.position.set(focus.x + 30, 50, focus.z + 20); sun.target.position.copy(focus);
    if (snow) { const a = snow.geometry.attributes.position.array; for (let i = 0; i < snowSpd.length; i++) { a[i * 3 + 1] -= snowSpd[i] * dt; if (a[i * 3 + 1] < 0) a[i * 3 + 1] += 35; } snow.geometry.attributes.position.needsUpdate = true; snow.position.set(focus.x, 0, focus.z); }
  };
  return { ground, bounds, update };
}

/** Builds either the editor (editing=true) or the playable game for a doc. */
export async function createCustomGame(ctx, doc, editing) {
  const { engine, economy, models } = ctx;
  const scene = new THREE.Scene();
  const env = buildEnvironment(scene, doc);
  const collision = new Collision({ floorY: 0, bounds: env.bounds });
  const building = new Building(scene, { blocks: doc.blocks || [], groundMeshes: [env.ground], canPlace: (x, y, z) => y >= 0 && y < 64 });
  collision.voxels = building;
  const placer = new ModelPlacer(scene, models, collision, { placements: doc.models || [] });
  const spawn = new THREE.Vector3(...(doc.spawn || [0.5, 0, 0.5]));

  const game = { scene, collision, building, placer, spawn, music: doc.music || 'none', supportsBuild: false, doc, editing };

  if (!editing) {
    const total = (doc.coins || []).length;
    let got = 0;
    const coins = new CoinField(scene, { positions: doc.coins || [], onCollect: () => {
      economy.earn(REWARDS.coinPickup, 'Pickup');
      if (++got === total) bus.emit('toast', { text: `You collected all ${total} coins in ${doc.name}!`, icon: '🏆' });
    } });
    game.coins = coins;
    game.update = (dt, t, player) => { env.update(dt, player.pos); coins.update(dt, t, player.pos); };
    game.dispose = () => { building.dispose(); placer.dispose(); coins.dispose(); };
    return game;
  }

  // ---------- editor ----------
  building.setActive(true);
  const grid = new THREE.GridHelper(64, 64, '#6aa8d8', '#9cc8ea'); grid.position.y = 0.02; grid.material.transparent = true; grid.material.opacity = 0.35; scene.add(grid);
  const spawnPad = new THREE.Group();
  const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 0.12, 24), new THREE.MeshStandardMaterial({ color: '#3fd0ff', emissive: '#1a7fb0', emissiveIntensity: 0.8 }));
  pad.position.y = 0.06; spawnPad.add(pad);
  const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.6, 12), pad.material); arrow.position.y = 3.2; arrow.rotation.x = Math.PI; spawnPad.add(arrow);
  spawnPad.position.copy(spawn); scene.add(spawnPad);

  const coinMat = new THREE.MeshStandardMaterial({ color: '#ffd34d', metalness: 0.7, roughness: 0.3, emissive: '#5a3c00', emissiveIntensity: 0.6 });
  const coinGeo = new THREE.CylinderGeometry(0.45, 0.45, 0.1, 20);
  const coinMarkers = [];
  const addCoin = (p) => { const m = new THREE.Mesh(coinGeo, coinMat); m.rotation.z = Math.PI / 2; m.position.set(...p); m.userData.coin = true; scene.add(m); coinMarkers.push(m); };
  (doc.coins || []).forEach(addCoin);

  game.tool = 'block';
  game.selectedModel = null;
  game.setTool = (t) => { game.tool = t; building.setActive(t === 'block'); if (t !== 'block') building.ghost.visible = false; };
  game.onHover = (ray) => building.hover(ray, engine.input.down('ShiftLeft'));
  const pickRemovable = (ray) => {
    const hits = ray.intersectObjects([...coinMarkers, ...placer.meshes(), ...building.meshes], false);
    return hits[0];
  };
  game.onClick = (e) => {
    const removing = e.button === 2 || e.shift || game.tool === 'erase';
    if (removing) {
      const h = pickRemovable(e.ray); if (!h) return;
      if (h.object.userData.coin) { scene.remove(h.object); coinMarkers.splice(coinMarkers.indexOf(h.object), 1); }
      else if (h.object.userData.modelItem) placer.removeItem(h.object.userData.modelItem);
      else if (h.object.userData.cell) building.remove(...h.object.userData.cell);
      return;
    }
    if (e.button !== 0) return;
    const h = building.pick(e.ray); if (!h) return;
    if (game.tool === 'block') building.click(e);
    else if (game.tool === 'spawn') {
      const c = h.placeCell; spawn.set(c[0] + 0.5, c[1], c[2] + 0.5); spawnPad.position.copy(spawn);
      bus.emit('toast', { text: 'Spawn point set', icon: '📍' });
    } else if (game.tool === 'coin') {
      const c = h.placeCell; addCoin([c[0] + 0.5, c[1] + 1.1, c[2] + 0.5]);
    } else if (game.tool === 'model' && game.selectedModel) {
      placer.place(game.selectedModel, h.point);
    }
  };
  game.serialize = () => ({
    ...doc,
    blocks: building.serialize(),
    models: placer.serialize(),
    coins: coinMarkers.map(m => [+m.position.x.toFixed(2), +m.position.y.toFixed(2), +m.position.z.toFixed(2)]),
    spawn: [spawn.x, spawn.y, spawn.z],
    updatedAt: Date.now(),
  });
  game.update = (dt, t, player) => { env.update(dt, player.pos); coinMarkers.forEach(m => { m.rotation.y += dt * 2; }); };
  game.dispose = () => { building.dispose(); placer.dispose(); };
  return game;
}

// Game definitions -----------------------------------------------------------
export const creatorDef = {
  id: 'creator',
  name: 'Create a Game',
  tagline: 'Make your own world & share it',
  description: 'Desktop game creator: blocks, your 3D models, spawn point, coins, sky & music. Save it to the Games menu or export it as a file.',
  thumbnail: 'creator',
  isCreator: true,
  create: (ctx, { doc }) => createCustomGame(ctx, doc, true),
};
export function customGameDef(doc) {
  return {
    id: doc.id, name: doc.name, tagline: 'Made with Create a Game', description: `${(doc.blocks || []).length} blocks · ${(doc.coins || []).length} coins`,
    thumbnail: doc.thumbnail || 'custom', custom: true, doc,
    create: (ctx) => createCustomGame(ctx, doc, false),
  };
}
