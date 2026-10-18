// Gears: reusable tool modules a player can carry (Roblox-style). Each gear is
// a plain object; add new ones to GEARS and they appear in the Studio Toolbox.
//   equip(player, avatar) / unequip(player, avatar): apply/remove effects
//   handModel(): a small mesh shown in the avatar's right hand
import * as THREE from 'three';

const coil = (color) => () => {
  const g = new THREE.Group();
  const m = new THREE.MeshStandardMaterial({ color, metalness: 0.6, roughness: 0.3, emissive: color, emissiveIntensity: 0.25 });
  const helix = new THREE.Mesh(new THREE.TorusKnotGeometry(0.14, 0.04, 48, 6, 1, 6), m);
  helix.scale.set(1, 2.2, 1); g.add(helix);
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.3, 8), new THREE.MeshStandardMaterial({ color: '#333' }));
  handle.position.y = -0.4; g.add(handle);
  return g;
};

export const GEARS = {
  speedCoil: {
    id: 'speedCoil', name: 'Speed Coil', icon: '⚡', color: '#e2474b', desc: 'Run 1.8× faster',
    handModel: coil('#e2474b'),
    equip(p) { p.mods.speed = 1.8; }, unequip(p) { p.mods.speed = 1; },
  },
  gravityCoil: {
    id: 'gravityCoil', name: 'Gravity Coil', icon: '🌙', color: '#8b6cf0', desc: 'Low gravity, floaty high jumps',
    handModel: coil('#8b6cf0'),
    equip(p) { p.mods.gravity = 0.35; p.mods.jump = 1.15; }, unequip(p) { p.mods.gravity = 1; p.mods.jump = 1; },
  },
  magicCarpet: {
    id: 'magicCarpet', name: 'Magic Carpet', icon: '🧞', color: '#d4a017', desc: 'Hover & fly. Space = up, Q = down',
    handModel: () => new THREE.Group(),
    equip(p, avatar) {
      p.mods.carpet = true; p.mods.speed = 1.5;
      const c = document.createElement('canvas'); c.width = 128; c.height = 64; const g = c.getContext('2d');
      g.fillStyle = '#8e2a5a'; g.fillRect(0, 0, 128, 64); g.strokeStyle = '#f5c542'; g.lineWidth = 6; g.strokeRect(6, 6, 116, 52);
      g.fillStyle = '#3fb5c9'; for (let i = 0; i < 4; i++) { g.beginPath(); g.arc(24 + i * 27, 32, 8, 0, 7); g.fill(); }
      const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
      const carpet = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.08, 3), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 }));
      carpet.position.y = -0.05; carpet.castShadow = true; carpet.name = 'magicCarpet';
      avatar.root.add(carpet); this._carpet = carpet;
    },
    unequip(p, avatar) { p.mods.carpet = false; p.mods.speed = 1; if (this._carpet) avatar.root.remove(this._carpet); this._carpet = null; },
  },
};
export const GEAR_LIST = Object.values(GEARS);

/** Tracks which gears a player carries + which is equipped. */
export class Backpack {
  constructor(player, avatar, onChange = () => {}) { this.player = player; this.avatar = avatar; this.items = []; this.equipped = null; this.onChange = onChange; this._hand = null; }
  give(id) { if (!GEARS[id] || this.items.includes(id)) return false; this.items.push(id); this.onChange(); return true; }
  toggle(id) {
    if (this.equipped === id) return this.unequip();
    this.unequip();
    const g = GEARS[id]; if (!g) return;
    g.equip(this.player, this.avatar);
    this._hand = g.handModel(); this._hand.position.set(0, -1.0, 0.15); this.avatar.bones.armR.add(this._hand);
    this.equipped = id; this.onChange();
  }
  unequip() {
    if (!this.equipped) return;
    GEARS[this.equipped].unequip(this.player, this.avatar);
    if (this._hand) this._hand.parent?.remove(this._hand); this._hand = null;
    this.equipped = null; this.onChange();
  }
  clear() { this.unequip(); this.items = []; this.onChange(); }
}
