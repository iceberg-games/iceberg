// Snowcone Tycoon scene: frost-plaza boardwalk, the stand (awning, counter,
// shaver, syrup bottles, topping bar, neon sign), upgrade props, snowfall and
// a juice-particle pool. Station anchors are exported for index.js.
import * as THREE from 'three';
import { Collision } from '../../engine/collision.js';
import { FLAVOR_ORDER, FLAVORS, TOPPING_ORDER, TOPPINGS } from './config.js';
import { Bag, buildBottle } from './props.js';

export const BOTTLE_X = FLAVOR_ORDER.map((_, i) => -2.2 + i * 0.75);
/** Live gameplay anchors. Filled by buildStand(): Snowcone Plaza set hooks when the set
 *  loaded, else the built-in procedural stand. Every station position comes from here. */
export const A = {};
function fallbackAnchors() {
  return {
    set: false,
    bottles: FLAVOR_ORDER.map((f, i) => ({ f, x: BOTTLE_X[i], y: 0.98, z: -5.35, px: BOTTLE_X[i], pz: -4.4, scale: 1.15 })),
    shaver: { x: STATIONS.shaver.x, z: -5.45, px: STATIONS.shaver.x, pz: -4.4 },
    topping: { x: STATIONS.topping.x, z: -5.4, px: STATIONS.topping.x, pz: -4.4, y: 0.98 },
    trash: { x: STATIONS.trash.x, z: -4.9, px: STATIONS.trash.x, pz: -4.4 },
    slots: SLOT_X.map(x => ({ x, z: SLOT_Z })), servePZ: SERVE_Z,
    spawn: SPAWN.clone(), shiftSpawn: SPAWN.clone(),
    pathIn: (x) => [[15, 1.6], [x + 1.2, 1.6], [x, SLOT_Z]], pathOut: (x) => [[x, SLOT_Z], [x - 0.8, 1.8], [-16, 2.2]],
    heater: [-7, -1.4], patio: [[-8.5, 3.5], [-4.5, 4.6], [4.5, 4.6], [8.5, 3.5]], bulbsZ: 5.6, bulbsY: 3.0,
    sign: [0, 4.55, -5.9, 1], standLight: [0, 3.2, -3.6], extension: null,
  };
}
function setAnchors(L) {
  const sz = L.SERVE_WINDOW.customerZ, cz = L.SERVE_WINDOW.z;
  return {
    set: true,
    bottles: L.SYRUPS.map((s, i) => ({ f: FLAVOR_ORDER[i], x: s.x, y: s.y, z: s.z, px: s.x, pz: -5.75, scale: 1.45 })),
    shaver: { x: L.ICE_HOPPER.x, z: L.ICE_HOPPER.z, px: L.ICE_HOPPER.x, pz: -6.7 },
    topping: { x: L.TOPPING_BAR.x, z: L.TOPPING_BAR.z, px: L.TOPPING_BAR.x + 0.2, pz: -5.0, y: 1.0, cart: true },
    trash: { x: L.TRASH.x, z: L.TRASH.z, px: L.TRASH.x - 0.3, pz: -5.1 },
    slots: L.CUSTOMER_SLOTS.map(s => ({ x: s.x, z: s.z })), servePZ: L.SERVE_WINDOW.playerZ,
    spawn: new THREE.Vector3(0, 0, 7), shiftSpawn: new THREE.Vector3(0, 0, -5.45),
    pathIn: (x) => [[x * 0.3, 24], [x * 0.6, 6], [x, sz + 1.2], [x, sz]], pathOut: (x) => [[x, sz], [x * 0.8, sz + 2.5], [x < 0 ? -24 : 24, 6.5]],
    heater: [-6.2, -1.6], patio: [[-21.5, 0], [-18, 1.5], [18, 1.5], [21.5, 0]], bulbsZ: 0.5, bulbsY: 3.4,
    sign: [0, 5.75, -5.55, 0.62], standLight: [0, 3.4, -5.4], extension: [6.4, cz],
  };
}
export const SLOT_X = [-3, -1, 1, 3];
export const SLOT_Z = -1.35;          // where customers stand
export const SERVE_Z = -3.0;          // where the player stands to serve
export const STATIONS = {
  shaver:  { x: -3.9, z: -4.4, name: 'Ice Shaver' },
  syrup:   { x: -0.33, z: -4.4, name: 'Syrup Bar', wide: 2.4 },
  topping: { x: 3.25, z: -4.4, name: 'Topping Bar' },
  trash:   { x: 4.85, z: -4.4, name: 'Trash' },
};
export const SPAWN = new THREE.Vector3(0, 0, -3.8);
export const pathIn = (x) => [[15, 1.6], [x + 1.2, 1.6], [x, SLOT_Z]];
export const pathOut = (x) => [[x, SLOT_Z], [x - 0.8, 1.8], [-16, 2.2]];

function canvasTex(bag, w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = bag.add(new THREE.CanvasTexture(c)); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; }

export function buildStand(set = null) {
  Object.keys(A).forEach(k => delete A[k]); Object.assign(A, set ? setAnchors(set.layout) : fallbackAnchors());
  const SET = A.set;
  const bag = new Bag(), root = new THREE.Group(), anim = [];
  const collision = new Collision({ floorY: 0, bounds: SET ? { type: 'box', minX: -27, maxX: 27, minZ: -16, maxZ: 27 } : { type: 'box', minX: -15, maxX: 15, minZ: -9, maxZ: 7.5 } });
  const occluders = [];
  const M = {
    wood: bag.mat({ color: '#b07a4a', roughness: 0.75 }), woodDark: bag.mat({ color: '#7a5030', roughness: 0.8 }),
    white: bag.mat({ color: '#f4f8ff', roughness: 0.55 }), chrome: bag.mat({ color: '#dfe7ef', metalness: 0.85, roughness: 0.22 }),
    ice: bag.mat({ color: '#bfe8ff', roughness: 0.1, metalness: 0.05, transparent: true, opacity: 0.75 }), snow: bag.mat({ color: '#f3f8ff', roughness: 0.95 }),
    teal: bag.mat({ color: '#38b6c9', roughness: 0.5 }), pink: bag.mat({ color: '#ff7eb6', roughness: 0.5 }),
  };
  const box = (w, h, d, mat, x, y, z, { collide = false, cast = true } = {}) => {
    const m = new THREE.Mesh(bag.geo(new THREE.BoxGeometry(w, h, d)), mat); m.position.set(x, y, z); m.castShadow = cast; m.receiveShadow = true; root.add(m);
    if (collide) collision.addBox(x - w / 2, y - h / 2, z - d / 2, x + w / 2, y + h / 2, z + d / 2);
    return m;
  };
  const rbox = (w, h, d, r, mat) => { const s = new THREE.Shape(); const x = -w / 2, y = -h / 2; s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r); s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h); s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r); s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
    const g = bag.geo(new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 2 })); g.translate(0, 0, -d / 2); const m = new THREE.Mesh(g, mat); m.castShadow = m.receiveShadow = true; return m; };

  if (!SET) {
  // ---------- sky, light, fog ----------
  const skyMat = bag.add(new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, uniforms: {},
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
    fragmentShader: 'varying vec3 vP; void main(){ float h = clamp(vP.y*1.4+.1,0.,1.); vec3 c = mix(vec3(1.0,.86,.78), vec3(.42,.68,.98), h); c = mix(c, vec3(1.,.95,.85), pow(max(0.,dot(vP, normalize(vec3(.5,.25,-.8)))),24.)*.8); gl_FragColor = vec4(c,1.); }' }));
  const sky = new THREE.Mesh(bag.geo(new THREE.SphereGeometry(300, 32, 16)), skyMat); sky.frustumCulled = false; root.add(sky);
  root.add(new THREE.HemisphereLight('#d6ebff', '#8a9ab8', 1.0));
  const sun = new THREE.DirectionalLight('#ffe2b8', 2.2); sun.position.set(12, 18, 10); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 16, bottom: -16, near: 1, far: 60 }); sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.03;
  root.add(sun, sun.target);
  const fill = new THREE.DirectionalLight('#9cc9ff', 0.6); fill.position.set(-10, 8, -6); root.add(fill);
  }
  const standLight = new THREE.PointLight('#ffd9a8', SET ? 3 : 6, 9, 1.6); standLight.position.set(...A.standLight); root.add(standLight);
  let extension, extStub = new THREE.Group(), cfMat, counterTop = bag.mat({ color: '#fbfdff', roughness: 0.25, metalness: 0.05 });
  if (!SET) {

  // ---------- plaza ----------
  const snowTex = canvasTex(bag, 256, 256, (g) => { g.fillStyle = '#eef5ff'; g.fillRect(0, 0, 256, 256); for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(${180 + Math.random() * 60},${210 + Math.random() * 40},255,${Math.random() * 0.25})`; g.fillRect(Math.random() * 256, Math.random() * 256, 2, 2); } });
  snowTex.wrapS = snowTex.wrapT = THREE.RepeatWrapping; snowTex.repeat.set(30, 30);
  const ground = new THREE.Mesh(bag.geo(new THREE.CircleGeometry(140, 48)), bag.mat({ map: snowTex, roughness: 0.95 })); ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; root.add(ground);
  // boardwalk planks
  const plankTex = canvasTex(bag, 512, 128, (g, w, h) => { for (let y = 0; y < h; y += 16) { g.fillStyle = `hsl(28,${35 + Math.random() * 10}%,${52 + Math.random() * 8}%)`; g.fillRect(0, y, w, 15); g.fillStyle = 'rgba(60,35,15,.35)'; g.fillRect(0, y + 15, w, 1); for (let x = Math.random() * 120; x < w; x += 120 + Math.random() * 80) g.fillRect(x, y, 1, 15); } });
  plankTex.wrapS = plankTex.wrapT = THREE.RepeatWrapping; plankTex.repeat.set(4, 4);
  const walk = new THREE.Mesh(bag.geo(new THREE.BoxGeometry(34, 0.08, 16)), bag.mat({ map: plankTex, roughness: 0.8 })); walk.position.set(0, 0.04, -0.5); walk.receiveShadow = true; root.add(walk);
  // ice railings along the front edge
  for (let x = -16; x <= 16; x += 2) { const p = new THREE.Mesh(bag.geo(new THREE.CylinderGeometry(0.09, 0.11, 1.0, 8)), M.ice); p.position.set(x, 0.5, 7.3); root.add(p); const cap = new THREE.Mesh(bag.geo(new THREE.SphereGeometry(0.13, 10, 8)), M.snow); cap.position.set(x, 1.05, 7.3); root.add(cap); }
  const rail = new THREE.Mesh(bag.geo(new THREE.CylinderGeometry(0.06, 0.06, 32, 8)), M.ice); rail.rotation.z = Math.PI / 2; rail.position.set(0, 0.9, 7.3); root.add(rail);
  // distant glaciers
  const glacierMat = bag.mat({ color: '#cfe6fb', roughness: 0.4, flatShading: true });
  for (let i = 0; i < 16; i++) { const a = -Math.PI * 0.95 + i * (Math.PI * 1.9 / 15), r = 90 + (i % 3) * 20, h = 18 + ((i * 37) % 23);
    const m = new THREE.Mesh(bag.geo(new THREE.ConeGeometry(10 + (i % 4) * 4, h, 5 + (i % 3))), glacierMat); m.position.set(Math.sin(a) * r, h / 2 - 2, -Math.cos(a) * r); m.rotation.y = i; root.add(m); }
  // snow mounds + pine-ish ice trees around the plaza
  for (let i = 0; i < 14; i++) { const x = (i % 2 ? 1 : -1) * (9 + (i * 13) % 6), z = -8 + (i * 7) % 15; const m = new THREE.Mesh(bag.geo(new THREE.SphereGeometry(0.9 + (i % 3) * 0.3, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2)), M.snow); m.position.set(x + (i % 3), 0.02, z - 3); m.scale.y = 0.55; root.add(m); }
  for (const [x, z] of [[-11, -7], [11, -7.5], [-13, -2], [13, -1.5]]) {
    for (let k = 0; k < 3; k++) { const c = new THREE.Mesh(bag.geo(new THREE.ConeGeometry(1.3 - k * 0.32, 1.4, 8)), bag.mat({ color: k === 2 ? '#f5faff' : '#3d8f86', roughness: 0.7 })); c.position.set(x, 0.9 + k * 0.85, z); c.castShadow = true; root.add(c); }
    collision.addCircle(x, z, 0.8, 3);
  }

  // ---------- the stand ----------
  // floor deck
  box(11.6, 0.14, 4.2, M.woodDark, 0, 0.07, -4.1, { cast: false });
  // back wall with vertical planks + window strip
  const wallTex = canvasTex(bag, 512, 256, (g, w, h) => { for (let x = 0; x < w; x += 32) { g.fillStyle = `hsl(195,${40 + Math.random() * 10}%,${82 + Math.random() * 5}%)`; g.fillRect(x, 0, 31, h); } g.fillStyle = 'rgba(0,60,90,.18)'; for (let x = 31; x < w; x += 32) g.fillRect(x, 0, 1, h); });
  const back = box(11.6, 3.4, 0.25, bag.mat({ map: wallTex, roughness: 0.7 }), 0, 1.7, -6.15, { collide: true });
  occluders.push(back);
  // shelf along back
  box(11.2, 0.9, 0.9, M.wood, 0, 0.45, -5.45, { collide: true });
  box(11.2, 0.08, 0.95, counterTop, 0, 0.94, -5.45);
  // corner posts (candy-cane striped)
  const caneTex = canvasTex(bag, 64, 256, (g) => { g.fillStyle = '#fff'; g.fillRect(0, 0, 64, 256); g.fillStyle = '#ff5a8a'; for (let y = -64; y < 256; y += 48) { g.beginPath(); g.moveTo(0, y); g.lineTo(64, y + 32); g.lineTo(64, y + 52); g.lineTo(0, y + 20); g.fill(); } });
  const caneMat = bag.mat({ map: caneTex, roughness: 0.4 });
  for (const x of [-5.6, 5.6]) for (const z of [-6.0, -2.3]) { const p = new THREE.Mesh(bag.geo(new THREE.CylinderGeometry(0.11, 0.11, 3.6, 12)), caneMat); p.position.set(x, 1.8, z); p.castShadow = true; root.add(p); collision.addCircle(x, z, 0.14, 3.6); }
  // front counter (customer side) — base + extension (upgrade)
  const counterFront = canvasTex(bag, 512, 128, (g, w, h) => { g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h); const cs = ['#2f8bff', '#ff3b5c', '#5fd94a', '#9b5cff', '#ff9a2e']; for (let x = 0; x < w; x += 40) { g.fillStyle = cs[(x / 40) % 5]; g.beginPath(); g.arc(x + 20, h, 28, Math.PI, 0); g.fill(); } g.fillStyle = 'rgba(0,0,0,.06)'; g.fillRect(0, 0, w, 6); });
  cfMat = bag.mat({ map: counterFront, roughness: 0.6 });
  const counter = new THREE.Group(); root.add(counter);
  const mkCounter = (x0, x1, grp) => { const w = x1 - x0, cx = (x0 + x1) / 2; const b = rbox(w, 1.0, 0.7, 0.08, cfMat); b.position.set(cx, 0.5, -2.35); grp.add(b); const t = rbox(w + 0.2, 0.08, 0.9, 0.04, counterTop); t.position.set(cx, 1.04, -2.35); grp.add(t); };
  mkCounter(-4.6, 2.0, counter); collision.addBox(-4.6, 0, -2.7, 4.6, 1.1, -2.0);
  extension = new THREE.Group(); mkCounter(2.0, 4.6, extension); root.add(extension);
  extStub = box(2.6, 0.5, 0.6, M.woodDark, 3.3, 0.25, -2.35); // stub until upgraded
  // striped awning (curved, scalloped edge)
  const awTex = canvasTex(bag, 512, 64, (g, w, h) => { for (let x = 0; x < w; x += 32) { g.fillStyle = (x / 32) % 2 ? '#ffffff' : '#2fa8e0'; g.fillRect(x, 0, 32, h); } });
  awTex.wrapS = THREE.RepeatWrapping; awTex.repeat.x = 1;
  const awMat = bag.mat({ map: awTex, side: THREE.DoubleSide, roughness: 0.7 });
  const awGeo = bag.geo(new THREE.CylinderGeometry(2.4, 2.4, 12, 40, 1, true, -Math.PI * 0.18, Math.PI * 0.5)); awGeo.rotateZ(Math.PI / 2);
  const awning = new THREE.Mesh(awGeo, awMat); awning.position.set(0, 1.25, -4.4); awning.castShadow = true; root.add(awning);
  const scallops = new THREE.InstancedMesh(bag.geo(new THREE.CircleGeometry(0.25, 16, 0, Math.PI)), bag.mat({ color: '#2fa8e0', side: THREE.DoubleSide }), 24);
  { const m = new THREE.Matrix4(), q = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI, 0, 0)); for (let i = 0; i < 24; i++) { m.compose(new THREE.Vector3(-5.75 + i * 0.5, 3.07, -2.15), q, new THREE.Vector3(1, 1, 1)); scallops.setMatrixAt(i, m); scallops.setColorAt(i, new THREE.Color(i % 2 ? '#ffffff' : '#2fa8e0')); } }
  root.add(scallops);
  // roof cap with snow
  const roofSnow = new THREE.Mesh(bag.geo(new THREE.CapsuleGeometry(0.35, 11.4, 4, 12)), M.snow); roofSnow.rotation.z = Math.PI / 2; roofSnow.scale.set(1, 1, 1.6); roofSnow.position.set(0, 3.75, -5.4); root.add(roofSnow);

  } else {
    // Snowcone Plaza set: gameplay collision for walls, counter, split back bar and machines
    const L = set.layout, S = L.SHOP, x0 = S.x - S.w / 2, x1 = S.x + S.w / 2, zb = S.z - S.d / 2, zf = S.z + S.d / 2;
    collision.addBox(x0 - 0.2, 0, zb - 0.2, x1 + 0.2, 9, zb + 0.2);
    for (const sx of [x0, x1]) collision.addBox(sx - 0.2, 0, zb, sx + 0.2, 9, zf);
    for (const c of L.COUNTERS) collision.addBox(c.x - c.w / 2, 0, c.z - c.d / 2, c.x + c.w / 2, c.h + 0.1, c.z + c.d / 2);
    for (const b of L.BACK_BARS) collision.addBox(b.x0, 0, b.z - b.d / 2, b.x1, 1.2, b.z + b.d / 2);
    for (const m of L.MACHINES) collision.addBox(m.x - 0.8, 0, m.z - 0.65, m.x + 0.8, 2.8, m.z + 0.65);
    for (const s of L.SEATS) collision.addCircle(s.x, s.z, 0.8, 1.2);
    collision.addCircle(L.FOUNTAIN.x, L.FOUNTAIN.z, L.FOUNTAIN.r, 2);
    for (const b of L.BARRELS) collision.addCircle(b[0] ?? b.x, b[1] ?? b.z, 0.6, 1.2);
    // counter-extension cart (Longer Counter upgrade)
    cfMat = bag.mat({ color: '#d6f3ff', roughness: 0.5 });
    extension = new THREE.Group(); extension.position.set(A.extension[0], 0, A.extension[1]); root.add(extension);
    { const b = rbox(1.8, 1.0, 1.1, 0.12, cfMat); b.position.y = 0.55; extension.add(b); const t = rbox(2.0, 0.08, 1.3, 0.04, counterTop); t.position.y = 1.1; extension.add(t);
      for (const sx of [-0.7, 0.7]) { const w = new THREE.Mesh(bag.geo(new THREE.TorusGeometry(0.18, 0.06, 8, 16)), M.chrome); w.position.set(sx, 0.18, 0.56); extension.add(w); } }
  }
  // ---------- neon sign ----------
  const signCv = document.createElement('canvas'); signCv.width = 1024; signCv.height = 256;
  const signTex = bag.add(new THREE.CanvasTexture(signCv)); signTex.colorSpace = THREE.SRGBColorSpace;
  const signMat = bag.add(new THREE.MeshStandardMaterial({ map: signTex, emissiveMap: signTex, emissive: '#ffffff', emissiveIntensity: 0.4, transparent: true, roughness: 0.4 }));
  const sign = new THREE.Group(); sign.position.set(A.sign[0], A.sign[1], A.sign[2]); sign.userData.base = A.sign[3]; sign.scale.setScalar(A.sign[3]); root.add(sign);
  const board = rbox(5.2, 1.3, 0.12, 0.2, bag.mat({ color: '#1a2a44', roughness: 0.6 })); sign.add(board);
  const signFace = new THREE.Mesh(bag.geo(new THREE.PlaneGeometry(5.0, 1.25)), signMat); signFace.position.z = 0.1; sign.add(signFace);
  const signLight = new THREE.PointLight('#7fe3ff', 0, 7, 2); signLight.position.set(A.sign[0], A.sign[1] - 0.3, A.sign[2] + 0.9); root.add(signLight);
  const drawSign = (lvl) => {
    const g = signCv.getContext('2d'), w = 1024, h = 256; g.clearRect(0, 0, w, h);
    g.font = '900 150px "Arial Rounded MT Bold", Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    const glow = [6, 18, 30, 44][lvl];
    g.shadowColor = lvl ? '#5fe1ff' : 'rgba(0,0,0,0)'; g.shadowBlur = glow; g.lineWidth = 10; g.strokeStyle = lvl ? '#bff4ff' : '#6b8aa8'; g.strokeText('SNOWCONES', w / 2, h / 2 + 6);
    g.fillStyle = lvl ? (lvl >= 2 ? '#ffffff' : '#dff8ff') : '#9fb6cc'; g.fillText('SNOWCONES', w / 2, h / 2 + 6);
    if (lvl >= 3) { g.shadowColor = '#ff7eb6'; g.fillStyle = '#ffd1e6'; for (const x of [60, w - 60]) { g.beginPath(); for (let i = 0; i < 10; i++) { const a = i * Math.PI / 5 - Math.PI / 2, r = i % 2 ? 18 : 42; g.lineTo(x + Math.cos(a) * r, h / 2 + Math.sin(a) * r); } g.fill(); } }
    signTex.needsUpdate = true;
  };

  // ---------- ice shaver (chrome hopper with spinning blades) ----------
  const shaver = new THREE.Group(); shaver.position.set(A.shaver.x, SET ? 1.3 : 0.98, A.shaver.z); root.add(shaver);
  const base = rbox(0.9, 0.45, 0.7, 0.1, M.teal); base.position.y = 0.22; shaver.add(base);
  const hopperProf = [[0.12, 0], [0.18, 0.05], [0.42, 0.55], [0.45, 0.6]].map(([x, y]) => new THREE.Vector2(x, y));
  const hopper = new THREE.Mesh(bag.geo(new THREE.LatheGeometry(hopperProf, 28)), bag.mat({ color: '#eaf3fa', metalness: 0.9, roughness: 0.18, side: THREE.DoubleSide })); hopper.position.y = 0.75; shaver.add(hopper);
  const iceBlock = new THREE.Mesh(bag.geo(new THREE.IcosahedronGeometry(0.3, 1)), M.ice); iceBlock.position.y = 1.2; shaver.add(iceBlock);
  const neck = new THREE.Mesh(bag.geo(new THREE.CylinderGeometry(0.13, 0.13, 0.32, 16)), M.chrome); neck.position.y = 0.6; shaver.add(neck);
  const blades = new THREE.Group(); blades.position.y = 0.5; shaver.add(blades);
  for (let i = 0; i < 4; i++) { const b = new THREE.Mesh(bag.geo(new THREE.BoxGeometry(0.34, 0.02, 0.06)), M.chrome); b.rotation.y = i * Math.PI / 2; b.position.set(Math.cos(i * Math.PI / 2) * 0.12, 0, -Math.sin(i * Math.PI / 2) * 0.12); blades.add(b); }
  const ringMat = bag.mat({ color: '#7fe3ff', emissive: '#4fd2ff', emissiveIntensity: 0.4 });
  const ring = new THREE.Mesh(bag.geo(new THREE.TorusGeometry(0.47, 0.03, 8, 32)), ringMat); ring.rotation.x = Math.PI / 2; ring.position.y = 1.36; shaver.add(ring);
  const turbo = new THREE.Group(); shaver.add(turbo);   // turbo shaver upgrade: side motor + glowing fins
  { const motor = new THREE.Mesh(bag.geo(new THREE.CylinderGeometry(0.16, 0.16, 0.4, 16)), M.pink); motor.rotation.z = Math.PI / 2; motor.position.set(0.55, 0.3, 0); turbo.add(motor);
    for (let i = 0; i < 3; i++) { const f = new THREE.Mesh(bag.geo(new THREE.BoxGeometry(0.03, 0.34, 0.34)), ringMat); f.position.set(0.42 + i * 0.1, 0.3, 0); turbo.add(f); } }
  const turbo2 = new THREE.Mesh(bag.geo(new THREE.TorusGeometry(0.47, 0.03, 8, 32)), ringMat); turbo2.rotation.x = Math.PI / 2; turbo2.position.y = 1.0; shaver.add(turbo2);
  if (SET) { for (const o of [base, hopper, iceBlock, neck, blades]) o.visible = false; ring.position.y = 1.45; ring.scale.setScalar(1.7); turbo2.position.y = 1.2; turbo2.scale.setScalar(1.7); turbo.position.set(0.5, -0.6, 0.3); }
  const shaveLight = new THREE.PointLight('#9be8ff', 0, 3, 2); shaveLight.position.set(A.shaver.x, 2.2, A.shaver.z + 0.8); root.add(shaveLight);

  // ---------- syrup bottles ----------
  const bottles = {};
  A.bottles.forEach((a) => { const b = buildBottle(bag, FLAVORS[a.f].color); b.position.set(a.x, a.y, a.z); b.scale.setScalar(a.scale); root.add(b); bottles[a.f] = b; });
  // flavor tags (pattern swatches) under bottles
  const tagTex = canvasTex(bag, 768, 96, (g, w, h) => { FLAVOR_ORDER.forEach((f, i) => { const x = i * 128 + 8; g.fillStyle = FLAVORS[f].color; g.beginPath(); g.roundRect(x, 8, 112, 80, 14); g.fill(); g.save(); g.beginPath(); g.roundRect(x, 8, 112, 80, 14); g.clip(); const s = 22; g.fillStyle = g.strokeStyle = 'rgba(255,255,255,.65)'; g.lineWidth = 5;
    const k = FLAVORS[f].pattern; if (k === 'stripe') for (let j = -80; j < 200; j += s) { g.beginPath(); g.moveTo(x + j, 88); g.lineTo(x + j + 80, 8); g.stroke(); } else if (k === 'dots') for (let yy = 20; yy < 88; yy += s) for (let xx = x + 12; xx < x + 112; xx += s) { g.beginPath(); g.arc(xx, yy, 5, 0, 7); g.fill(); } else if (k === 'swirl') { g.beginPath(); for (let a = 0; a < 16; a += 0.2) g.lineTo(x + 56 + Math.cos(a) * a * 2.4, 48 + Math.sin(a) * a * 2.4); g.stroke(); } else if (k === 'zigzag') for (let yy = 22; yy < 88; yy += 22) { g.beginPath(); for (let xx = x, n = 0; xx <= x + 112; xx += 12, n++) g.lineTo(xx, yy + (n % 2 ? -6 : 6)); g.stroke(); } else if (k === 'check') for (let yy = 8; yy < 88; yy += 16) for (let xx = x + ((yy / 16) % 2) * 16; xx < x + 112; xx += 32) g.fillRect(xx, yy, 16, 16); else { g.fillStyle = 'rgba(190,130,50,.7)'; g.font = '30px serif'; g.fillText('★ ★ ★', x + 8, 60); }
    g.restore(); g.fillStyle = 'rgba(0,0,0,.55)'; g.font = '900 22px sans-serif'; g.textAlign = 'center'; g.fillText(String(i + 1), x + 56, 56); g.textAlign = 'left'; }); });
  const tags = new THREE.Mesh(bag.geo(new THREE.PlaneGeometry(4.5, 0.56)), bag.mat({ map: tagTex, roughness: 0.6 })); tags.position.set(-0.33, 0.62, -4.99); if (!SET) root.add(tags);
  if (SET) A.bottles.forEach((a, i) => { const tg = new THREE.Mesh(bag.geo(new THREE.PlaneGeometry(0.85, 0.6)), bag.mat({ map: tagTex, roughness: 0.6 })); const uv = tg.geometry.attributes.uv; for (let k = 0; k < uv.count; k++) uv.setX(k, (i + uv.getX(k)) / 6); tg.position.set(a.x, 0.6, a.z + 0.47); root.add(tg); });

  // ---------- topping bar ----------
  const toppingBar = new THREE.Group(); toppingBar.position.set(A.topping.x, A.topping.y, A.topping.z); root.add(toppingBar);
  if (A.topping.cart) { const cart = rbox(1.9, 1.0, 1.0, 0.12, M.pink); cart.position.set(A.topping.x, 0.5, A.topping.z); root.add(cart); collision.addBox(A.topping.x - 0.95, 0, A.topping.z - 0.5, A.topping.x + 0.95, 1.1, A.topping.z + 0.5); toppingBar.rotation.y = 0; }
  const tray = rbox(1.6, 0.14, 0.8, 0.05, M.white); tray.position.y = 0.07; toppingBar.add(tray);
  const bins = {};
  TOPPING_ORDER.forEach((t, i) => {
    const bin = new THREE.Mesh(bag.geo(new THREE.CylinderGeometry(0.17, 0.15, 0.2, 20, 1, true)), bag.mat({ color: '#e6f4ff', transparent: true, opacity: 0.55, side: THREE.DoubleSide }));
    bin.position.set(-0.57 + i * 0.38, 0.24, 0); toppingBar.add(bin);
    const fillM = new THREE.Mesh(bag.geo(new THREE.CylinderGeometry(0.155, 0.14, 0.12, 20)), bag.mat({ color: TOPPINGS[t].color, emissive: TOPPINGS[t].color, emissiveIntensity: t === 'flake' ? 0.5 : 0.15, roughness: 0.7 }));
    fillM.position.set(-0.57 + i * 0.38, 0.2, 0); toppingBar.add(fillM); bins[t] = fillM;
  });
  const tarp = rbox(1.75, 0.45, 0.9, 0.12, bag.mat({ color: '#6d7f99', roughness: 0.9 })); tarp.position.set(0, 0.3, 0); toppingBar.add(tarp);
  // trash bin
  const trash = new THREE.Mesh(bag.geo(new THREE.CylinderGeometry(0.3, 0.25, 0.75, 18)), bag.mat({ color: '#5a6b82', roughness: 0.5 })); trash.position.set(A.trash.x, 0.52, A.trash.z); root.add(trash); collision.addCircle(A.trash.x, A.trash.z, 0.3, 1);
  const lid = new THREE.Mesh(bag.geo(new THREE.CylinderGeometry(0.33, 0.33, 0.06, 18)), M.chrome); lid.position.set(A.trash.x, 0.92, A.trash.z); root.add(lid);

  // ---------- upgrade props ----------
  // heater
  const heater = new THREE.Group(); heater.position.set(A.heater[0], 0, A.heater[1]); root.add(heater);
  { const pole = new THREE.Mesh(bag.geo(new THREE.CylinderGeometry(0.06, 0.06, 2.4, 10)), M.chrome); pole.position.y = 1.2; heater.add(pole);
    const foot = new THREE.Mesh(bag.geo(new THREE.CylinderGeometry(0.4, 0.45, 0.12, 20)), M.chrome); foot.position.y = 0.06; heater.add(foot);
    const hood = new THREE.Mesh(bag.geo(new THREE.ConeGeometry(0.75, 0.35, 24, 1, true)), bag.mat({ color: '#dfe7ef', metalness: 0.85, roughness: 0.25, side: THREE.DoubleSide })); hood.position.y = 2.6; heater.add(hood);
    const glowM = bag.mat({ color: '#ff8a3d', emissive: '#ff6a1d', emissiveIntensity: 2 }); const el = new THREE.Mesh(bag.geo(new THREE.CylinderGeometry(0.15, 0.15, 0.3, 12)), glowM); el.position.y = 2.3; heater.add(el);
    const hl = new THREE.PointLight('#ff9a50', 3, 5, 2); hl.position.y = 2.1; heater.add(hl); heater.userData.glow = glowM; }
  collision.addCircle(A.heater[0], A.heater[1], 0.4, 3);
  // patio tables (2 per level) + string lights at level 2
  const patio = [new THREE.Group(), new THREE.Group()]; patio.forEach(p => root.add(p));
  const umbCols = ['#ff7eb6', '#2fa8e0', '#ffd23f', '#5fd94a'];
  A.patio.forEach(([x, z], i) => {
    const t = new THREE.Group(); t.position.set(x, 0, z); patio[i < 2 ? 0 : 1].add(t);
    const top = new THREE.Mesh(bag.geo(new THREE.CylinderGeometry(0.7, 0.7, 0.07, 24)), M.white); top.position.y = 0.8; t.add(top);
    const leg = new THREE.Mesh(bag.geo(new THREE.CylinderGeometry(0.06, 0.06, 0.8, 8)), M.chrome); leg.position.y = 0.4; t.add(leg);
    const umb = new THREE.Mesh(bag.geo(new THREE.ConeGeometry(1.3, 0.5, 8, 1, true)), bag.mat({ color: umbCols[i], side: THREE.DoubleSide, roughness: 0.7 })); umb.position.y = 2.3; umb.castShadow = true; t.add(umb);
    const pole = new THREE.Mesh(bag.geo(new THREE.CylinderGeometry(0.03, 0.03, 1.6, 6)), M.chrome); pole.position.y = 1.5; t.add(pole);
    for (const a of [0, Math.PI]) { const st = new THREE.Mesh(bag.geo(new THREE.CylinderGeometry(0.25, 0.25, 0.5, 14)), M.teal); st.position.set(Math.cos(a) * 1.0, 0.25, Math.sin(a) * 1.0); t.add(st); }
    t.userData.collider = [x, z];
  });
  const patioColliders = [[], []];
  const bulbs = new THREE.InstancedMesh(bag.geo(new THREE.SphereGeometry(0.07, 8, 6)), bag.mat({ color: '#ffffff', emissive: '#ffffff', emissiveIntensity: 1.6 }), 28);
  { const m = new THREE.Matrix4(); const cs = ['#ffd23f', '#ff7eb6', '#7fe3ff', '#9dff8a']; for (let i = 0; i < 28; i++) { const side = i < 14 ? -1 : 1, k = i % 14, x = SET ? side * (16.5 + k * 0.5) : -9.5 + i * 0.7; m.makeTranslation(x, A.bulbsY - Math.sin(k / 13 * Math.PI) * 0.5, A.bulbsZ); bulbs.setMatrixAt(i, m); bulbs.setColorAt(i, new THREE.Color(cs[i % 4])); } }
  patio[1].add(bulbs);
  const patioLight = new THREE.PointLight('#ffd9a8', 0, 12, 1.5); patioLight.position.set(SET ? 0 : 0, 3, SET ? 1 : 5); root.add(patioLight);
  const queueStools = A.slots.map(({ x, z }) => { const s = new THREE.Mesh(bag.geo(new THREE.CylinderGeometry(0.22, 0.22, 0.06, 16)), bag.mat({ color: '#7fe3ff', emissive: '#4fd2ff', emissiveIntensity: 0.3 })); s.position.set(x, 0.1, z); root.add(s); return s; });

  // ---------- snowfall ----------
  const N = 900, pos = new Float32Array(N * 3), vel = new Float32Array(N);
  for (let i = 0; i < N; i++) { pos[i * 3] = (Math.random() - 0.5) * 50; pos[i * 3 + 1] = Math.random() * 18; pos[i * 3 + 2] = (Math.random() - 0.5) * 40; vel[i] = 0.6 + Math.random() * 0.8; }
  const flakeTex = canvasTex(bag, 32, 32, (g) => { const gr = g.createRadialGradient(16, 16, 0, 16, 16, 16); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 32, 32); });
  const snowGeo = bag.geo(new THREE.BufferGeometry()); snowGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const snow = new THREE.Points(snowGeo, bag.add(new THREE.PointsMaterial({ size: 0.16, map: flakeTex, transparent: true, depthWrite: false, opacity: 0.9 }))); snow.frustumCulled = false; root.add(snow);

  // ---------- juice particles (sprites) ----------
  const pMat = bag.add(new THREE.SpriteMaterial({ map: flakeTex, transparent: true, depthWrite: false }));
  const parts = []; for (let i = 0; i < 160; i++) { const s = new THREE.Sprite(pMat.clone()); bag.add(s.material); s.visible = false; root.add(s); parts.push({ s, life: 0, v: new THREE.Vector3() }); }
  let pi = 0;
  function burst(x, y, z, { color = '#ffffff', n = 14, speed = 2.5, size = 0.18, life = 0.9, up = 2.2, grav = 6 } = {}) {
    for (let k = 0; k < n; k++) { const p = parts[pi++ % parts.length]; p.s.visible = true; p.s.position.set(x, y, z); p.s.material.color.set(Array.isArray(color) ? color[k % color.length] : color); p.s.scale.setScalar(size * (0.6 + Math.random() * 0.8));
      const a = Math.random() * Math.PI * 2; p.v.set(Math.cos(a) * speed * Math.random(), up + Math.random() * up, Math.sin(a) * speed * Math.random()); p.life = p.max = life * (0.7 + Math.random() * 0.6); p.grav = grav; }
  }
  // punch animations for placed machines/upgrades
  const punches = [];
  const punch = (obj, amt = 0.35) => { punches.push({ obj, t: 0, amt, base: obj.scale.clone() }); };

  // ---------- upgrades → visuals ----------
  let neonLvl = 0;
  function applyUpgrades(up, day = 1) {
    turbo.visible = up.shaver >= 1; turbo2.visible = up.shaver >= 2;
    for (const f of FLAVOR_ORDER) { const u = bottles[f].userData; u.head.visible = up.pump >= 1; }
    heater.visible = up.heater >= 1;
    extension.visible = up.counter >= 1; extStub.visible = !extension.visible;
    if (SET) { if (up.counter >= 1 && !extension.userData.col) extension.userData.col = collision.addBox(A.extension[0] - 0.9, 0, A.extension[1] - 0.55, A.extension[0] + 0.9, 1.1, A.extension[1] + 0.55); } queueStools[3].visible = up.counter >= 1;
    neonLvl = up.neon; drawSign(up.neon); sign.scale.setScalar(sign.userData.base * (1 + up.neon * 0.08));
    signMat.emissiveIntensity = [0.35, 1.1, 1.8, 2.6][up.neon]; signLight.intensity = [0, 3, 6, 10][up.neon];
    patio[0].visible = up.patio >= 1; patio[1].visible = up.patio >= 2; patioLight.intensity = up.patio >= 2 ? 4 : 0;
    // patio colliders (rebuild)
    for (const c of patioColliders.flat()) { const i = collision.circles.indexOf(c); if (i >= 0) collision.circles.splice(i, 1); }
    patioColliders[0] = []; patioColliders[1] = [];
    patio.forEach((p, li) => { if (!p.visible) return; for (const t of p.children) if (t.userData.collider) { const [x, z] = t.userData.collider; collision.addCircle(x, z, 0.75, 1); patioColliders[li].push(collision.circles[collision.circles.length - 1]); } });
  }
  function setDay(day) {
    for (const f of FLAVOR_ORDER) { const on = day.flavors.includes(f), u = bottles[f].userData; u.liquid.visible = on; u.liquidMat.emissiveIntensity = on ? 0.55 : 0; }
    tarp.visible = !day.toppingChance; for (const b of Object.values(bins)) b.visible = !!day.toppingChance;
  }

  // ---------- per-frame ----------
  const shaving = { on: false }; let spinAcc = 0;
  function update(dt, t) {
    // snow
    const a = snowGeo.attributes.position.array;
    for (let i = 0; i < N; i++) { a[i * 3 + 1] -= vel[i] * dt; a[i * 3] += Math.sin(t * 0.7 + i) * dt * 0.25; if (a[i * 3 + 1] < 0) a[i * 3 + 1] = 18; }
    snowGeo.attributes.position.needsUpdate = true;
    // shaver
    blades.rotation.y += dt * (shaving.on ? 40 : 0.6); spinAcc += dt * (shaving.on ? 30 : 0);
    if (SET && set.blades) for (const b of set.blades) b.rotation.y = t * 9 + spinAcc; iceBlock.rotation.y += dt * (shaving.on ? 3 : 0.2);
    iceBlock.position.y = 1.2 + (shaving.on ? Math.sin(t * 50) * 0.01 : 0);
    ringMat.emissiveIntensity += ((shaving.on ? 2.4 : 0.4 + Math.sin(t * 2) * 0.15) - ringMat.emissiveIntensity) * Math.min(1, dt * 8);
    shaveLight.intensity += ((shaving.on ? 3 : 0) - shaveLight.intensity) * Math.min(1, dt * 8);
    // neon flicker/buzz shimmer
    if (neonLvl) signMat.emissiveIntensity = [0.35, 1.1, 1.8, 2.6][neonLvl] * (0.94 + Math.sin(t * 3) * 0.04 + (Math.random() < 0.01 ? -0.3 : 0));
    // bottle liquid slosh
    FLAVOR_ORDER.forEach((f, i) => { const u = bottles[f].userData; u.liquid.rotation.z = Math.sin(t * 1.3 + i) * 0.03; });
    // particles
    for (const p of parts) { if (p.life <= 0) continue; p.life -= dt; p.v.y -= p.grav * dt; p.s.position.addScaledVector(p.v, dt); p.s.material.opacity = Math.max(0, p.life / p.max); if (p.life <= 0) p.s.visible = false; }
    for (let i = punches.length - 1; i >= 0; i--) { const q = punches[i]; q.t += dt; const k = q.t / 0.5; const s = 1 + Math.sin(Math.min(1, k) * Math.PI) * q.amt * (1 - k * 0.5); q.obj.scale.copy(q.base).multiplyScalar(s); if (k >= 1) { q.obj.scale.copy(q.base); punches.splice(i, 1); } }
    bulbs.material.emissiveIntensity = 1.4 + Math.sin(t * 4) * 0.3;
  }
  drawSign(0);
  return {
    root, collision, occluders, bottles, bins, shaver, sign, heater, extension, patio, toppingBar, shaving, queueStools,
    applyUpgrades, setDay, update, burst, punch,
    dispose() { root.traverse(o => { if (o.isInstancedMesh) o.dispose(); }); bag.dispose(); },
  };
}
