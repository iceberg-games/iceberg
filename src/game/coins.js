// Collectible Birg Buck pickups (spinning icy-gold coins).
import * as THREE from 'three';

const geo = new THREE.CylinderGeometry(0.45, 0.45, 0.1, 24);
const mat = new THREE.MeshStandardMaterial({ color: '#ffd34d', metalness: 0.8, roughness: 0.25, emissive: '#5a3c00', emissiveIntensity: 0.6 });
const rimMat = new THREE.MeshStandardMaterial({ color: '#9fe3ff', emissive: '#2a8fd0', emissiveIntensity: 0.6 });
const rimGeo = new THREE.TorusGeometry(0.45, 0.05, 8, 24);

export class CoinField {
  /**
   * positions: fixed [[x,y,z]] list, or count + randomPos() for random spawns.
   * respawn: seconds until a collected coin reappears (null = never).
   */
  constructor(scene, { positions = null, count = 0, randomPos = null, respawn = null, onCollect }) {
    this.scene = scene; this.onCollect = onCollect; this.respawn = respawn; this.randomPos = randomPos;
    this.group = new THREE.Group(); scene.add(this.group);
    this.coins = [];
    const list = positions || Array.from({ length: count }, () => randomPos());
    for (const p of list) this._spawn(p);
  }
  _spawn(p) {
    const c = new THREE.Group();
    const disc = new THREE.Mesh(geo, mat); disc.rotation.x = Math.PI / 2; disc.castShadow = true;
    const rim = new THREE.Mesh(rimGeo, rimMat);
    c.add(disc, rim);
    c.position.set(p[0], p[1], p[2]);
    c.userData = { base: p[1], timer: 0, active: true, phase: Math.random() * 6 };
    this.group.add(c); this.coins.push(c);
  }
  get activeCount() { return this.coins.filter(c => c.userData.active).length; }

  update(dt, t, playerPos) {
    for (const c of this.coins) {
      const u = c.userData;
      if (!u.active) {
        if (this.respawn != null && (u.timer -= dt) <= 0) {
          const p = this.randomPos ? this.randomPos() : [c.position.x, u.base, c.position.z];
          c.position.set(p[0], p[1], p[2]); u.base = p[1]; u.active = true; c.visible = true;
        }
        continue;
      }
      c.rotation.y += dt * 2.5;
      c.position.y = u.base + Math.sin(t * 2 + u.phase) * 0.15;
      const dx = c.position.x - playerPos.x, dz = c.position.z - playerPos.z, dy = c.position.y - (playerPos.y + 1.2);
      if (dx * dx + dz * dz < 1.6 && Math.abs(dy) < 1.9) {
        u.active = false; c.visible = false; u.timer = this.respawn ?? 0;
        this.onCollect?.(c);
      }
    }
  }
  dispose() { this.scene.remove(this.group); }
}
