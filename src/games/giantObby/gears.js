// Gears for the Giant Rainbow Obby, written in the same plain-object format as
// the Toolbox gears in wip/gears/gears.js (id, name, icon, color, desc,
// handModel(), equip(player, avatar), unequip(player, avatar)), so the Studio
// Toolbox can reuse them once it ships.
//
// Usage rules (see canUseGear):
//   - a gear BOUGHT by a player works only in the game it was bought in;
//   - a gear a CREATOR adds to their own game works there for everyone, no purchase needed.
import * as THREE from 'three';
import { GEAR_PRICES_BB } from './config.js';

const coil = (color) => () => {
  const g = new THREE.Group();
  const m = new THREE.MeshStandardMaterial({ color, metalness: 0.6, roughness: 0.3, emissive: color, emissiveIntensity: 0.3 });
  const helix = new THREE.Mesh(new THREE.TorusKnotGeometry(0.14, 0.04, 48, 6, 1, 6), m);
  helix.scale.set(1, 2.2, 1); g.add(helix);
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.3, 8), new THREE.MeshStandardMaterial({ color: '#333' }));
  handle.position.y = -0.4; g.add(handle);
  return g;
};

function carpetMesh() {
  const c = document.createElement('canvas'); c.width = 128; c.height = 64; const g = c.getContext('2d');
  g.fillStyle = '#8e2a5a'; g.fillRect(0, 0, 128, 64); g.strokeStyle = '#f5c542'; g.lineWidth = 6; g.strokeRect(6, 6, 116, 52);
  g.fillStyle = '#3fb5c9'; for (let i = 0; i < 4; i++) { g.beginPath(); g.arc(24 + i * 27, 32, 8, 0, 7); g.fill(); }
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const carpet = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.08, 3), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 }));
  carpet.position.y = -0.05; carpet.castShadow = true; carpet.name = 'magicCarpet';
  return carpet;
}

export const OBBY_GEARS = {
  speedCoil: {
    id: 'speedCoil', name: 'Speed Coil', icon: '⚡', color: '#e2474b', desc: 'Run 1.6× faster', price: GEAR_PRICES_BB.speedCoil,
    handModel: coil('#e2474b'),
    equip(p) { p.mods.speed = 1.6; }, unequip(p) { p.mods.speed = 1; },
  },
  gravityCoil: {
    id: 'gravityCoil', name: 'Gravity Coil', icon: '🌙', color: '#8b6cf0', desc: 'Low gravity: floaty, high jumps', price: GEAR_PRICES_BB.gravityCoil,
    handModel: coil('#8b6cf0'),
    equip(p) { p.mods.gravity = 0.4; p.mods.jump = 1.12; }, unequip(p) { p.mods.gravity = 1; p.mods.jump = 1; },
  },
  magicCarpet: {
    id: 'magicCarpet', name: 'Magic Carpet', icon: '🧞', color: '#d4a017', desc: 'Hover and fly. Space = up, Q = down', price: GEAR_PRICES_BB.magicCarpet,
    handModel: () => new THREE.Group(),
    equip(p, avatar) { p.mods.carpet = true; p.mods.speed = 1.4; this._carpet = carpetMesh(); avatar.root.add(this._carpet); },
    unequip(p, avatar) { p.mods.carpet = false; p.mods.speed = 1; if (this._carpet) { avatar.root.remove(this._carpet); this._carpet.geometry.dispose(); } this._carpet = null; },
  },
};
export const OBBY_GEAR_LIST = Object.values(OBBY_GEARS);

/**
 * Can this gear be used in this game?
 * @param gearId
 * @param gameId          the game being played
 * @param purchases       { [gameId]: [gearId...] } gears the player bought, per game
 * @param creatorGears    gear ids the game's creator added to this game (free, no limits)
 */
export function canUseGear(gearId, gameId, purchases = {}, creatorGears = []) {
  if (creatorGears.includes(gearId)) return true;
  return (purchases[gameId] || []).includes(gearId);
}

/** Holds the usable gears for one game session and which one is equipped. */
export class Backpack {
  constructor(player, avatar, onChange = () => {}) { this.player = player; this.avatar = avatar; this.items = []; this.equipped = null; this.onChange = onChange; this._hand = null; }
  give(id) { if (!OBBY_GEARS[id] || this.items.includes(id)) return false; this.items.push(id); this.onChange(); return true; }
  toggle(id) {
    if (!this.items.includes(id)) return false;
    if (this.equipped === id) { this.unequip(); return true; }
    this.unequip();
    const g = OBBY_GEARS[id];
    g.equip(this.player, this.avatar);
    this._hand = g.handModel(); this._hand.position.set(0, -1.0, 0.15); this.avatar.bones.armR?.add(this._hand);
    this.equipped = id; this.onChange(); return true;
  }
  unequip() {
    if (!this.equipped) return;
    OBBY_GEARS[this.equipped].unequip(this.player, this.avatar);
    if (this._hand) this._hand.parent?.remove(this._hand); this._hand = null;
    this.equipped = null; this.onChange();
  }
  dispose() { this.unequip(); this.items = []; }
}
