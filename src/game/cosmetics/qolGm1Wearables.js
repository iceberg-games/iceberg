// GM1 QoL wearables: Snowcone Tycoon (snowcone-tycoon) + Crystal Spire (crystal-spire). Owned by Iceberg Cosmetics.
// Classic-space builders: return { bone, object } with bone in head|torso|armR; avatar.js parents them through the
// bodyTypes anchor contract (head->hat, torso->back/neck, armR->handR), so they fit every body type and the R15 layer.
// Catalog entries: src/data/cosmetics.js (sc_* / cs_*). Lane 2's qolGameWearables.js is separate; do not merge maps.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

const std = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, ...extra });
function mesh(geo, mat, x = 0, y = 0, z = 0) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; return m; }
const rotated = (m, axis, v) => { m.rotation[axis] = v; return m; };
let _dot = null;
function softDotTexture() {
  if (_dot) return _dot;
  const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
  const gr = x.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = gr; x.fillRect(0, 0, 64, 64); _dot = new THREE.CanvasTexture(c); return _dot;
}

const _ice = (c, o = {}) => std(c, { roughness: 0.85, ...o });
function _gem(color, e = 0.5) { return std(color, { roughness: 0.08, metalness: 0.15, flatShading: true, transparent: true, opacity: 0.88, emissive: color, emissiveIntensity: e }); }
function _shard(mat, r, h) { const m = new THREE.Mesh(new THREE.OctahedronGeometry(r, 0), mat); m.scale.set(1, h / r / 2, 1); m.castShadow = true; return m; }
function _shavedDome(mat, r, y) { // bumpy shaved-ice dome
  const g = new THREE.Group(); g.add(mesh(new THREE.SphereGeometry(r, 20, 12, 0, Math.PI * 2, 0, Math.PI / 1.8), mat, 0, y, 0));
  for (let i = 0; i < 14; i++) { const a = i * 2.4, k = 0.35 + (i % 4) * 0.15; g.add(mesh(new THREE.IcosahedronGeometry(r * 0.22, 0), mat, Math.cos(a) * r * k, y + Math.sqrt(1 - k * k) * r * 0.85, Math.sin(a) * r * k)); }
  return g;
}
function _waffleMat() {
  const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
  x.fillStyle = '#e0a45a'; x.fillRect(0, 0, 64, 64); x.strokeStyle = '#a8692c'; x.lineWidth = 4;
  for (let i = -64; i < 128; i += 16) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i + 64, 64); x.stroke(); x.beginPath(); x.moveTo(i + 64, 0); x.lineTo(i, 64); x.stroke(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 2);
  return std('#ffffff', { map: t, roughness: 0.8 });
}

function buildScoopHat(color) {
  const g = new THREE.Group(), syrup = std(color, { roughness: 0.2, emissive: color, emissiveIntensity: 0.08 });
  const paper = std('#fff8ee', { roughness: 0.9 }), stripe = std(color, { roughness: 0.9 });
  const cup = mesh(new THREE.CylinderGeometry(0.4, 0.34, 0.22, 24, 1, true), paper, 0, 0.72, 0); cup.material.side = THREE.DoubleSide; g.add(cup);
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; const s = mesh(new THREE.BoxGeometry(0.06, 0.225, 0.01), stripe, Math.sin(a) * 0.372, 0.72, Math.cos(a) * 0.372); s.rotation.y = a; s.rotation.x = 0.27 * Math.cos(0); g.add(s); }
  g.add(_shavedDome(_ice('#ffffff'), 0.38, 0.8));
  const top = _shavedDome(syrup, 0.3, 0.98); top.scale.set(1.05, 0.8, 1.05); g.add(top);
  for (let i = 0; i < 6; i++) { const a = i * 1.1 + 0.3; const d = mesh(new THREE.CapsuleGeometry(0.03, 0.08 + (i % 3) * 0.04, 4, 8), syrup, Math.sin(a) * 0.37, 0.78 - (i % 3) * 0.03, Math.cos(a) * 0.37); g.add(d); }
  const cherry = mesh(new THREE.SphereGeometry(0.09, 16, 12), std('#d4142e', { roughness: 0.15, metalness: 0.1 }), 0.02, 1.2, 0.02); g.add(cherry);
  const stem = mesh(new THREE.CylinderGeometry(0.008, 0.01, 0.16, 6), std('#4a7a2a'), 0.05, 1.32, 0); stem.rotation.z = -0.4; g.add(stem);
  const spoon = mesh(new THREE.BoxGeometry(0.04, 0.32, 0.02), std('#ffffff', { roughness: 0.4 }), -0.2, 1.05, 0.12); spoon.rotation.z = 0.5; g.add(spoon);
  g.userData.tick = () => { cherry.position.y = 1.2 + Math.sin(performance.now() / 380) * 0.012; };
  g.userData.setColor = (c) => { syrup.color.set(c); syrup.emissive.set(c); stripe.color.set(c); };
  return { bone: 'head', object: g };
}

function buildSyrupBottle(color) {
  const g = new THREE.Group(); g.position.set(0, -0.92, 0.2);
  const plastic = std(color, { roughness: 0.25, transparent: true, opacity: 0.92 }), cap = std('#ffffff', { roughness: 0.35 });
  g.add(mesh(new RoundedBoxGeometry(0.2, 0.34, 0.2, 3, 0.07), plastic, 0, 0.05, 0));
  g.add(mesh(new THREE.BoxGeometry(0.205, 0.12, 0.205), std('#fff6e0', { roughness: 0.9 }), 0, 0.05, 0));
  g.add(mesh(new THREE.SphereGeometry(0.035, 10, 8), plastic, 0, 0.05, 0.105));
  g.add(mesh(new THREE.CylinderGeometry(0.075, 0.09, 0.07, 16), cap, 0, 0.255, 0));
  g.add(mesh(new THREE.ConeGeometry(0.035, 0.16, 12), cap, 0, 0.37, 0));
  const drip = mesh(new THREE.SphereGeometry(0.025, 10, 8), plastic, 0, 0.44, 0); drip.scale.y = 1.4; g.add(drip);
  g.userData.tick = () => { const t = (performance.now() / 1400) % 1; drip.scale.setScalar(0.6 + t * 0.6); drip.scale.y *= 1.4; };
  g.userData.setColor = (c) => plastic.color.set(c);
  return { bone: 'armR', object: g };
}

function buildConePack(color) {
  const g = new THREE.Group(); g.position.set(0, 0.05, -0.42);
  const cone = mesh(new THREE.ConeGeometry(0.3, 0.8, 24), _waffleMat(), 0, -0.1, 0); cone.rotation.x = Math.PI; g.add(cone);
  g.add(rotated(mesh(new THREE.TorusGeometry(0.29, 0.045, 10, 28), std('#c78a46', { roughness: 0.8 }), 0, 0.3, 0), 'x', Math.PI / 2));
  const cream = _ice(color, { roughness: 0.7 });
  const scoop = _shavedDome(cream, 0.33, 0.28); g.add(scoop);
  const sprMats = ['#ff5f8f', '#5fc8ff', '#ffe05f', '#8fe05a', '#ffffff'].map(c => std(c, { roughness: 0.5 }));
  for (let i = 0; i < 22; i++) { const a = i * 2.39, k = 0.2 + (i % 5) * 0.14; const sp = mesh(new THREE.CapsuleGeometry(0.012, 0.04, 2, 4), sprMats[i % 5], Math.cos(a) * 0.3 * k * 2.2, 0.3 + Math.sqrt(Math.max(0, 1 - k * k)) * 0.3, Math.sin(a) * 0.3 * k * 2.2); sp.rotation.set(a, i, 0); g.add(sp); }
  const strap = std('#8a5a2a', { roughness: 0.9 });
  [-0.2, 0.2].forEach(x => g.add(mesh(new THREE.BoxGeometry(0.06, 0.7, 0.04), strap, x, 0, 0.18)));
  g.userData.tick = () => { scoop.rotation.y = Math.sin(performance.now() / 900) * 0.08; };
  g.userData.setColor = (c) => cream.color.set(c);
  return { bone: 'torso', object: g };
}

function buildShopApron(color) {
  const g = new THREE.Group();
  const cloth = std('#ffffff', { roughness: 0.95 }), stripeM = std(color, { roughness: 0.95 });
  const bib = new THREE.Group(); bib.position.set(0, -0.05, 0.31); g.add(bib);
  bib.add(mesh(new THREE.BoxGeometry(0.62, 0.9, 0.03), cloth, 0, 0, 0));
  for (let i = 0; i < 5; i++) bib.add(mesh(new THREE.BoxGeometry(0.07, 0.9, 0.032), stripeM, -0.24 + i * 0.12, 0, 0.002));
  bib.add(mesh(new THREE.BoxGeometry(0.38, 0.16, 0.04), stripeM, 0, -0.2, 0.02));
  const sc = mesh(new THREE.SphereGeometry(0.05, 10, 8), std('#e0e6ec', { metalness: 0.7, roughness: 0.25 }), 0.08, -0.08, 0.04); bib.add(sc);
  bib.add(rotated(mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.18, 6), std('#e0e6ec', { metalness: 0.7 }), 0.1, -0.16, 0.04), 'z', 0.3));
  const badge = mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.02, 20), std('#ffd23f', { metalness: 0.5, roughness: 0.3 }), -0.16, 0.24, 0.03); badge.rotation.x = Math.PI / 2; bib.add(badge);
  g.add(rotated(mesh(new THREE.TorusGeometry(0.3, 0.025, 6, 20, Math.PI), stripeM, 0, 0.45, 0.05), 'x', -0.15));
  g.userData.setColor = (c) => stripeM.color.set(c);
  return { bone: 'torso', object: g };
}

function buildSpireCrown(color) {
  const g = new THREE.Group(), gem = _gem(color, 0.45), band = std('#e8f4ff', { metalness: 0.85, roughness: 0.2 });
  g.add(mesh(new THREE.CylinderGeometry(0.37, 0.37, 0.09, 8, 1, true), band, 0, 0.68, 0));
  g.add(rotated(mesh(new THREE.TorusGeometry(0.37, 0.02, 6, 8), band, 0, 0.72, 0), 'x', Math.PI / 2));
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2, h = i % 2 ? 0.2 : 0.32; const s = _shard(gem, 0.06, h); s.position.set(Math.sin(a) * 0.35, 0.74 + h / 2, Math.cos(a) * 0.35); s.rotation.z = Math.sin(a) * -0.18; s.rotation.x = Math.cos(a) * 0.18; g.add(s); }
  const spire = _shard(gem, 0.1, 0.7); spire.position.set(0, 1.08, 0); g.add(spire);
  const light = new THREE.PointLight(color, 0.6, 2.2); light.position.set(0, 1.1, 0); g.add(light);
  g.userData.tick = () => { const t = performance.now() / 1000; spire.rotation.y = t * 0.6; gem.emissiveIntensity = 0.35 + Math.sin(t * 2.2) * 0.2; light.intensity = 0.4 + Math.sin(t * 2.2) * 0.2; };
  g.userData.setColor = (c) => { gem.color.set(c); gem.emissive.set(c); light.color.set(c); };
  return { bone: 'head', object: g };
}

function buildClimberGlove(color) {
  const g = new THREE.Group(); g.position.set(0, -0.9, 0);
  const pad = std('#2b3a55', { roughness: 0.9 }), cuff = std(color, { roughness: 0.6 }), gem = _gem(color, 0.6);
  g.add(mesh(new RoundedBoxGeometry(0.54, 0.34, 0.54, 3, 0.08), pad, 0, 0, 0));
  g.add(mesh(new RoundedBoxGeometry(0.58, 0.14, 0.58, 2, 0.04), cuff, 0, 0.18, 0));
  for (let i = 0; i < 3; i++) { const s = _shard(gem, 0.04, 0.1); s.position.set(-0.13 + i * 0.13, -0.05, 0.25); s.rotation.x = Math.PI / 2; g.add(s); }
  const grip = _shard(gem, 0.07, 0.36); grip.position.set(0, -0.15, 0.3); grip.rotation.x = 0.4; g.add(grip);
  g.userData.tick = () => { gem.emissiveIntensity = 0.45 + Math.sin(performance.now() / 300) * 0.15; };
  g.userData.setColor = (c) => { cuff.color.set(c); gem.color.set(c); gem.emissive.set(c); };
  return { bone: 'armR', object: g };
}

function buildShardPin(color) {
  const g = new THREE.Group(), gold = std('#ffd24f', { metalness: 0.9, roughness: 0.25 }), gem = _gem(color, 0.7);
  const pin = new THREE.Group(); pin.position.set(-0.24, 0.28, 0.32); g.add(pin);
  pin.add(rotated(mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.03, 6), gold, 0, 0, 0), 'x', Math.PI / 2));
  pin.add(rotated(mesh(new THREE.TorusGeometry(0.1, 0.012, 6, 6), std('#fff1b0', { metalness: 1, roughness: 0.15 }), 0, 0, 0.018), 'z', Math.PI / 6));
  const s = _shard(gem, 0.045, 0.16); s.position.set(0, 0.02, 0.07); pin.add(s);
  const sparks = []; for (let i = 0; i < 3; i++) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: softDotTexture(), color, transparent: true, depthWrite: false })); sp.scale.setScalar(0.05); pin.add(sp); sparks.push(sp); }
  g.userData.tick = () => { const t = performance.now() / 1000; s.rotation.y = t * 1.8; s.position.y = 0.02 + Math.sin(t * 2) * 0.012;
    sparks.forEach((sp, i) => { const a = t * 2 + i * 2.1; sp.position.set(Math.cos(a) * 0.09, 0.02 + Math.sin(a * 1.3) * 0.05, 0.07 + Math.sin(a) * 0.03); sp.material.opacity = 0.5 + Math.sin(t * 5 + i) * 0.4; }); };
  g.userData.setColor = (c) => { gem.color.set(c); gem.emissive.set(c); sparks.forEach(sp => sp.material.color.set(c)); };
  return { bone: 'torso', object: g };
}

function buildCrystalPack(color) {
  const g = new THREE.Group(); g.position.set(0, 0, -0.38);
  const frame = std('#5a6a7a', { metalness: 0.6, roughness: 0.35 }), gem = _gem(color, 0.5);
  g.add(mesh(new RoundedBoxGeometry(0.6, 0.55, 0.16, 2, 0.05), std('#2b3a55', { roughness: 0.85 }), 0, -0.05, 0));
  [-0.27, 0.27].forEach(x => g.add(mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.9, 8), frame, x, 0.05, -0.06)));
  g.add(rotated(mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.58, 8), frame, 0, 0.48, -0.06), 'z', Math.PI / 2));
  const cluster = new THREE.Group(); cluster.position.set(0, 0.25, -0.12); g.add(cluster);
  [[0, 0, 0.12, 0.6, 0], [-0.14, -0.05, 0.08, 0.42, 0.35], [0.15, -0.06, 0.08, 0.38, -0.35], [-0.06, -0.12, 0.06, 0.3, 0.6], [0.08, -0.12, 0.06, 0.28, -0.6]]
    .forEach(([x, y, r, h, z]) => { const s = _shard(gem, r, h); s.position.set(x, y + h / 2, 0); s.rotation.z = z; cluster.add(s); });
  const motes = []; for (let i = 0; i < 6; i++) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: softDotTexture(), color, transparent: true, depthWrite: false })); sp.scale.setScalar(0.07); cluster.add(sp); motes.push(sp); }
  const light = new THREE.PointLight(color, 0.5, 2); light.position.set(0, 0.4, -0.2); g.add(light);
  g.userData.tick = () => { const t = performance.now() / 1000; gem.emissiveIntensity = 0.4 + Math.sin(t * 1.7) * 0.18;
    motes.forEach((m, i) => { const a = t * 1.1 + i * (Math.PI / 3); m.position.set(Math.cos(a) * 0.32, 0.3 + Math.sin(t * 1.6 + i) * 0.15, Math.sin(a) * 0.18); m.material.opacity = 0.45 + Math.sin(t * 4 + i) * 0.35; }); };
  g.userData.setColor = (c) => { gem.color.set(c); gem.emissive.set(c); light.color.set(c); motes.forEach(m => m.material.color.set(c)); };
  return { bone: 'torso', object: g };
}

export const QOL_GM1_BUILDERS = {
  sc_scoop_hat: (_rc, color) => buildScoopHat(color),
  sc_syrup_bottle: (_rc, color) => buildSyrupBottle(color),
  sc_cone_pack: (_rc, color) => buildConePack(color),
  sc_shop_apron: (_rc, color) => buildShopApron(color),
  cs_spire_crown: (_rc, color) => buildSpireCrown(color),
  cs_climber_glove: (_rc, color) => buildClimberGlove(color),
  cs_shard_pin: (_rc, color) => buildShardPin(color),
  cs_crystal_pack: (_rc, color) => buildCrystalPack(color),
};
