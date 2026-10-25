// Frostgate Run: short ice gate race on Mirrorfrost Lake. Enter through the Frostgate arch, skate
// through all gates in order before the timer runs out, then return to the plaza. Local only:
// every check uses the local player's position, so remote avatars can't pass gates for you.
import * as THREE from 'three';
import { LAKE, groundHeight } from './layout.js';
import { runGates, fmtTime } from './logic.js';
import { RUN_TIME_S, RUN_GATE_RADIUS, RUN_SPEED_MULT } from './config.js';

export class FrostgateRun {
  constructor(scene, { player, ui, audio, onFinish, onEnd }) {
    Object.assign(this, { scene, player, ui, audio, onFinish, onEnd });
    this.gates = runGates(LAKE, 8); this.state = 'idle'; this.mats = [];
    this.group = new THREE.Group(); this.group.visible = false; scene.add(this.group);
    const iceM = this._m(new THREE.MeshStandardMaterial({ color: '#bfe8ff', roughness: 0.1, metalness: 0.1, emissive: '#2a7fc4', emissiveIntensity: 0.5 }));
    this.glowNext = this._m(new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffd34d').multiplyScalar(2.2), toneMapped: false }));
    this.glowIdle = this._m(new THREE.MeshBasicMaterial({ color: new THREE.Color('#8fe8ff').multiplyScalar(1.4), toneMapped: false }));
    this.glowDone = this._m(new THREE.MeshBasicMaterial({ color: new THREE.Color('#7be36b').multiplyScalar(1.3), toneMapped: false, transparent: true, opacity: 0.35 }));
    const ring = new THREE.TorusGeometry(RUN_GATE_RADIUS, 0.32, 10, 40), inner = new THREE.TorusGeometry(RUN_GATE_RADIUS - 0.35, 0.09, 6, 40), post = new THREE.BoxGeometry(0.7, 1.2, 0.7);
    this.meshes = this.gates.map((g, i) => {
      const y = groundHeight(g.x, g.z), m = new THREE.Group(); m.position.set(g.x, y, g.z); m.rotation.y = g.yaw;
      const r = new THREE.Mesh(ring, iceM); r.position.y = RUN_GATE_RADIUS + 0.4; r.castShadow = true; m.add(r);
      const gl = new THREE.Mesh(inner, this.glowIdle); gl.position.y = r.position.y; m.add(gl);
      for (const s of [-1, 1]) { const p = new THREE.Mesh(post, iceM); p.position.set(s * RUN_GATE_RADIUS, 0.6, 0); m.add(p); }
      const num = this._label(String(i + 1)); num.position.y = RUN_GATE_RADIUS * 2 + 1.4; m.add(num);
      this.group.add(m); return { m, gl };
    });
    this.light = new THREE.PointLight('#ffd34d', 60, 16, 1.6); this.group.add(this.light);
    this.geos = [ring, inner, post];
  }
  _m(m) { this.mats.push(m); return m; }
  _label(t) {
    const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
    g.font = '900 96px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineWidth = 10; g.strokeStyle = '#13213a'; g.strokeText(t, 64, 68); g.fillStyle = '#fff'; g.fillText(t, 64, 68);
    const tex = new THREE.CanvasTexture(c); const m = this._m(new THREE.SpriteMaterial({ map: tex, toneMapped: false, fog: false })); const s = new THREE.Sprite(m); s.scale.set(1.6, 1.6, 1); return s;
  }
  get active() { return this.state !== 'idle'; }
  start() {
    const a = Math.PI - 0.42, x = LAKE.x + Math.cos(a) * LAKE.rx * 0.66, z = LAKE.z + Math.sin(a) * LAKE.rz * 0.62;
    const g0 = this.gates[0], facing = Math.atan2(g0.x - x, g0.z - z);
    this.player.teleport(new THREE.Vector3(x, groundHeight(x, z) + 0.2, z), facing);
    this.player.camYaw = facing + Math.PI; this.player.updateCamera?.();
    this.next = 0; this.time = 0; this.countT = 3.2; this.lastCount = 4; this.state = 'count'; this.group.visible = true;
    this.player.enabled = false; this.player.mods.speed = RUN_SPEED_MULT; this._paint();
    this.ui.runHud(true, fmtTime(RUN_TIME_S), `0/${this.gates.length}`);
  }
  _paint() { this.meshes.forEach((g, i) => { g.gl.material = i < this.next ? this.glowDone : i === this.next ? this.glowNext : this.glowIdle; }); const g = this.gates[this.next]; if (g) this.light.position.set(g.x, groundHeight(g.x, g.z) + RUN_GATE_RADIUS + 0.4, g.z); this.light.visible = !!g; }
  /** Direction (radians, screen-relative) + distance to the next gate, for the HUD arrow. */
  guide() { const g = this.gates[this.next]; if (!g || this.state !== 'race') return null; const p = this.player.pos; return { dx: g.x - p.x, dz: g.z - p.z, d: Math.hypot(g.x - p.x, g.z - p.z) }; }
  update(dt, t) {
    if (this.state === 'idle') return;
    this.meshes.forEach((g, i) => { g.gl.rotation.z = t * (i === this.next ? 2 : 0.5); });
    if (this.state === 'count') {
      this.countT -= dt; const n = Math.ceil(this.countT - 0.2);
      if (n !== this.lastCount) { this.lastCount = n; if (n > 0) { this.ui.count(String(n)); this.audio.sfx('count'); } else { this.ui.count('GO!'); this.audio.sfx('go'); this.state = 'race'; this.player.enabled = true; setTimeout(() => this.ui.count(null), 700); } }
      return;
    }
    if (this.state === 'race') {
      this.time += dt; const left = RUN_TIME_S - this.time, p = this.player.pos, g = this.gates[this.next];
      if (g && Math.hypot(p.x - g.x, p.z - g.z) <= RUN_GATE_RADIUS && p.y < groundHeight(g.x, g.z) + RUN_GATE_RADIUS * 2 + 0.4) {
        this.next++; this.audio.sfx('gate'); this._paint();
        if (this.next >= this.gates.length) { this.state = 'done'; this.player.mods.speed = 1; this.audio.sfx('win'); this.ui.runHud(true, fmtTime(this.time), `${this.next}/${this.gates.length}`); this.onFinish?.(this.time); return; }
      }
      this.ui.runHud(true, fmtTime(left), `${this.next}/${this.gates.length}`);
      if (left <= 0) { this.state = 'done'; this.player.mods.speed = 1; this.audio.sfx('fail'); this.onFinish?.(null); }
    }
  }
  /** Leave the race (finished, timed out, or Exit pressed) and hide the course. */
  stop() {
    if (this.state === 'idle') return;
    this.state = 'idle'; this.group.visible = false; this.player.enabled = true; this.player.mods.speed = 1;
    this.ui.runHud(false); this.ui.count(null); this.onEnd?.();
  }
  dispose() { this.scene.remove(this.group); this.mats.forEach(m => { m.map?.dispose(); m.dispose(); }); this.geos.forEach(g => g.dispose()); }
}
