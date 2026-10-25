// Winterhaven NPCs (blocky villagers with nametags + quest markers) and the glowing quest pickups.
import * as THREE from 'three';
import { groundHeight } from './layout.js';
import { PICKUP_ICON } from './logic.js';

function labelSprite(text, { bg = 'rgba(12,22,44,.78)', fg = '#ffffff', w = 512, h = 112, font = '800 54px sans-serif' } = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d');
  g.fillStyle = bg; const r = 40; g.beginPath(); g.roundRect ? g.roundRect(4, 4, w - 8, h - 8, r) : g.rect(4, 4, w - 8, h - 8); g.fill();
  g.strokeStyle = 'rgba(160,225,255,.8)'; g.lineWidth = 5; g.stroke();
  g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = fg; g.fillText(text, w / 2, h / 2 + 2);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: true, transparent: true, fog: false })); s.scale.set(w / h * 0.62, 0.62, 1); return s;
}
function markerSprite(ch, color) {
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  g.font = '900 112px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineWidth = 12; g.strokeStyle = '#13213a'; g.strokeText(ch, 64, 70); g.fillStyle = color; g.fillText(ch, 64, 70);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, fog: false, toneMapped: false })); s.scale.set(1.3, 1.3, 1); return s;
}

/** Small companions from the roster: Hoot the owl, Nimbus the wolf pup, the forest wisp. */
function makeCritter(npc, g, mats, M) {
  const add = (w, h, d, m, x, y, z) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); b.castShadow = true; g.add(b); return b; };
  const dark = M('#14161c'); let tagY = 1.6, body;
  if (npc.kind === 'owl') {
    const w = M('#f6faff'), beak = M('#ffb347'), post = M('#5a3a24');
    add(0.35, 1.0, 0.35, post, 0, 0.5, 0);
    body = add(0.7, 0.8, 0.6, w, 0, 1.4, 0); add(0.6, 0.5, 0.55, w, 0, 2.0, 0);
    add(0.16, 0.16, 0.02, M('#ffd34d'), -0.14, 2.05, 0.28); add(0.16, 0.16, 0.02, M('#ffd34d'), 0.14, 2.05, 0.28);
    add(0.07, 0.07, 0.03, dark, -0.14, 2.05, 0.3); add(0.07, 0.07, 0.03, dark, 0.14, 2.05, 0.3); add(0.1, 0.12, 0.1, beak, 0, 1.92, 0.31);
    add(0.12, 0.18, 0.1, w, -0.2, 2.32, 0); add(0.12, 0.18, 0.1, w, 0.2, 2.32, 0); tagY = 3.0;
  } else if (npc.kind === 'pup') {
    const fur = M('#c9d6e6'), belly = M('#f6faff');
    body = add(0.6, 0.55, 1.1, fur, 0, 0.6, 0); add(0.5, 0.5, 0.5, fur, 0, 0.95, 0.65); add(0.3, 0.22, 0.3, belly, 0, 0.85, 0.95);
    add(0.1, 0.08, 0.06, dark, 0, 0.9, 1.1); add(0.07, 0.07, 0.02, dark, -0.12, 1.05, 0.91); add(0.07, 0.07, 0.02, dark, 0.12, 1.05, 0.91);
    add(0.14, 0.22, 0.08, fur, -0.15, 1.3, 0.6); add(0.14, 0.22, 0.08, fur, 0.15, 1.3, 0.6);
    for (const [x, z] of [[-0.2, 0.4], [0.2, 0.4], [-0.2, -0.4], [0.2, -0.4]]) add(0.16, 0.35, 0.16, fur, x, 0.17, z);
    const tail = add(0.16, 0.16, 0.5, belly, 0, 0.85, -0.7); tail.rotation.x = 0.6; g.userData.tail = tail; tagY = 1.9;
  } else {
    const glowM = new THREE.MeshBasicMaterial({ color: new THREE.Color('#bff4ff').multiplyScalar(1.8), toneMapped: false, transparent: true, opacity: 0.85 }); mats.push(glowM);
    body = new THREE.Mesh(new THREE.SphereGeometry(0.45, 16, 12), glowM); body.position.y = 1.8; g.add(body);
    const l = new THREE.PointLight('#9fe8ff', 20, 8, 1.8); l.position.y = 1.8; g.add(l); tagY = 2.8;
  }
  const tag = labelSprite(npc.name); tag.position.set(0, tagY, 0); g.add(tag);
  const mark = markerSprite('!', '#ffd34d'); mark.position.set(0, tagY + 0.95, 0); g.add(mark);
  const y = groundHeight(npc.x, npc.z); g.position.set(npc.x, y, npc.z); g.rotation.y = npc.facing || 0;
  return {
    group: g, npc, mark, baseY: y,
    setMarker: markerSetter(mark),
    update(t, talking) {
      mark.position.y = tagY + 0.95 + Math.sin(t * 2.4) * 0.15;
      if (npc.kind === 'wisp') body.position.y = 1.8 + Math.sin(t * 1.7) * 0.3;
      if (npc.kind === 'pup' && g.userData.tail) g.userData.tail.rotation.y = Math.sin(t * (talking ? 18 : 6)) * 0.6;
      if (npc.kind === 'owl') g.children[2].rotation.y = Math.sin(t * 0.7) * 0.6;
    },
    dispose() { mats.forEach(m => m.dispose()); tag.material.map.dispose(); tag.material.dispose(); mark.material.map?.dispose(); mark.material.dispose(); },
  };
}
function markerSetter(mark) {
  return (kind) => { // 'accept' -> !, 'turnIn' -> ?, 'active' -> grey ?, 'none' -> hidden
    mark.visible = kind !== 'none'; if (kind === 'none') return;
    const want = kind === 'accept' ? '!' : '?', col = kind === 'active' ? '#b8c6d8' : '#ffd34d';
    if (mark.userData.k === want + col) return; mark.userData.k = want + col;
    const ns = markerSprite(want, col); mark.material.map.dispose(); mark.material.map = ns.material.map; mark.material.needsUpdate = true; ns.material.dispose();
  };
}

/** One villager: R6-style body, coat, hat with pom-pom, scarf. */
export function makeVillager(npc) {
  const g = new THREE.Group(); const mats = [];
  const M = (c, o = {}) => { const m = new THREE.MeshStandardMaterial({ color: c, roughness: 0.75, ...o }); mats.push(m); return m; };
  if (npc.kind === 'owl' || npc.kind === 'pup' || npc.kind === 'wisp') return makeCritter(npc, g, mats, M);
  const skin = M('#f1c9a5'), coat = M(npc.coat), pants = M('#2a3348'), hat = M(npc.hat), white = M('#f6faff'), scarf = M('#e2474b'), dark = M('#14161c');
  const add = (w, h, d, m, x, y, z) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); b.castShadow = true; g.add(b); return b; };
  const legL = add(0.48, 1.0, 0.5, pants, -0.25, 0.5, 0), legR = add(0.48, 1.0, 0.5, pants, 0.25, 0.5, 0);
  add(1.04, 1.04, 0.56, coat, 0, 1.52, 0); add(0.12, 0.9, 0.02, white, 0, 1.5, 0.29);            // coat + zip trim
  const armL = add(0.42, 1.0, 0.45, coat, -0.74, 1.5, 0), armR = add(0.42, 1.0, 0.45, coat, 0.74, 1.5, 0);
  add(0.44, 0.18, 0.47, white, -0.74, 1.02, 0); add(0.44, 0.18, 0.47, white, 0.74, 1.02, 0);       // mitten cuffs
  add(0.62, 0.62, 0.62, skin, 0, 2.33, 0);
  add(0.08, 0.12, 0.02, dark, -0.13, 2.38, 0.32); add(0.08, 0.12, 0.02, dark, 0.13, 2.38, 0.32);
  add(0.18, 0.05, 0.02, dark, 0, 2.2, 0.32);
  add(0.8, 0.2, 0.7, scarf, 0, 2.04, 0); add(0.22, 0.6, 0.08, scarf, 0.22, 1.75, 0.32);           // scarf + tail
  add(0.7, 0.34, 0.7, hat, 0, 2.74, 0); add(0.74, 0.12, 0.74, white, 0, 2.6, 0);
  const pom = new THREE.Mesh(new THREE.SphereGeometry(0.17, 10, 8), white); pom.position.set(0, 3.0, 0); g.add(pom);
  for (const l of [legL, legR, armL, armR]) { l.geometry.translate(0, -0.45, 0); l.position.y += 0.45; }
  const tag = labelSprite(npc.name); tag.position.set(0, 3.75, 0); g.add(tag);
  const mark = markerSprite('!', '#ffd34d'); mark.position.set(0, 4.7, 0); g.add(mark);
  const y = groundHeight(npc.x, npc.z);
  g.position.set(npc.x, y, npc.z); g.rotation.y = npc.facing || 0;
  return {
    group: g, npc, mark, armR, armL, baseY: y,
    setMarker: markerSetter(mark),
    update(t, talking) {
      mark.position.y = 4.7 + Math.sin(t * 2.4) * 0.15;
      armR.rotation.x = talking ? -1.9 + Math.sin(t * 6) * 0.35 : Math.sin(t * 1.3 + npc.x) * 0.08;
      armL.rotation.x = Math.sin(t * 1.3 + npc.x + 1) * 0.06;
    },
    dispose() { mats.forEach(m => m.dispose()); tag.material.map.dispose(); tag.material.dispose(); mark.material.map?.dispose(); mark.material.dispose(); },
  };
}

const GLOW = (hex, k = 2) => new THREE.MeshBasicMaterial({ color: new THREE.Color(hex).multiplyScalar(k), toneMapped: false });
/** Glowing quest item at {x,z,kind}; visible only while its quest is active. */
export function makePickup(p) {
  const g = new THREE.Group(); const mats = [];
  const keep = (m) => { mats.push(m); return m; };
  if (p.kind === 'spark') {
    const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.45, 1), keep(GLOW('#ffc061', 3))); g.add(core);
    const cage = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.1, 0.9), keep(new THREE.MeshStandardMaterial({ color: '#2a2f3a', metalness: 0.6, roughness: 0.4, wireframe: true }))); g.add(cage);
  } else if (p.kind === 'frost' || p.kind === 'crystal') {
    const col = p.kind === 'frost' ? '#9fe8ff' : '#c49bff';
    for (let i = 0; i < 4; i++) { const c = new THREE.Mesh(new THREE.OctahedronGeometry(0.45 - i * 0.07, 0), keep(GLOW(col, 2.2 - i * 0.3))); c.scale.y = 1.9; c.position.set(Math.cos(i * 1.7) * 0.35 * (i ? 1 : 0), 0, Math.sin(i * 1.7) * 0.35 * (i ? 1 : 0)); c.rotation.z = (i ? 0.4 : 0) * (i % 2 ? 1 : -1); g.add(c); }
  } else if (p.kind === 'cone') {
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.42, 1.1, 8), keep(GLOW('#9dff9a', 1.8))); cone.rotation.x = Math.PI; g.add(cone);
    for (let i = 0; i < 4; i++) { const s = new THREE.Mesh(new THREE.ConeGeometry(0.5 - i * 0.1, 0.18, 8), keep(new THREE.MeshStandardMaterial({ color: '#6b4a2a', roughness: 0.8 }))); s.position.y = 0.35 - i * 0.25; g.add(s); }
  } else if (p.kind !== 'banner') { // generic: floating emoji token with a glowing halo
    const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'); x.font = '96px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(PICKUP_ICON[p.kind] || '✨', 64, 70);
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; const sm = keep(new THREE.SpriteMaterial({ map: tex, fog: false })); const sp = new THREE.Sprite(sm); sp.scale.set(1.3, 1.3, 1); g.add(sp);
    const halo = new THREE.Mesh(new THREE.TorusGeometry(0.75, 0.06, 6, 32), keep(GLOW('#ffd34d', 2))); g.add(halo);
  } else if (p.kind === 'banner') {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 3.2, 8), keep(new THREE.MeshStandardMaterial({ color: '#c9d6e6', metalness: 0.7, roughness: 0.3 }))); pole.position.y = 0.6; g.add(pole);
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.9, 8, 1), keep(new THREE.MeshStandardMaterial({ color: '#3f8fd0', emissive: '#1d4d93', emissiveIntensity: 0.8, side: THREE.DoubleSide }))); flag.position.set(0.72, 1.7, 0); g.add(flag); g.userData.flag = flag;
    const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.2, 0), keep(GLOW('#bff4ff', 3))); star.position.set(0, 2.3, 0); g.add(star);
  }
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.25, 40).rotateX(-Math.PI / 2), keep(new THREE.MeshBasicMaterial({ color: new THREE.Color('#9fe8ff').multiplyScalar(1.4), transparent: true, opacity: 0.55, toneMapped: false, depthWrite: false })));
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.9, 14, 16, 1, true), keep(new THREE.MeshBasicMaterial({ color: new THREE.Color('#bfe8ff').multiplyScalar(1.2), transparent: true, opacity: 0.12, toneMapped: false, depthWrite: false, side: THREE.DoubleSide })));
  const root = new THREE.Group(); const y = groundHeight(p.x, p.z);
  root.position.set(p.x, y, p.z); g.position.y = 1.3; ring.position.y = 0.08; beam.position.y = 7;
  root.add(g, ring, beam);
  const light = new THREE.PointLight(p.kind === 'spark' ? '#ffb057' : p.kind === 'cone' ? '#9dff9a' : '#8fe8ff', 30, 10, 1.8); light.position.y = 1.6; root.add(light);
  return {
    root, p,
    update(t) { g.rotation.y = t * 1.4; g.position.y = 1.3 + Math.sin(t * 2.2) * 0.18; ring.scale.setScalar(1 + Math.sin(t * 3) * 0.08); if (g.userData.flag) g.userData.flag.rotation.y = Math.sin(t * 3) * 0.25 - g.rotation.y; },
    dispose() { mats.forEach(m => { m.map?.dispose(); m.dispose(); }); },
  };
}
