// Cinematic camera tools: scripted shots (spline position + spline look-at, eased, deterministic)
// and a smooth free-fly camera.
import * as THREE from 'three';

export const EASE = {
  linear: (u) => u,
  inOutSine: (u) => 0.5 - 0.5 * Math.cos(Math.PI * u),
  inOutCubic: (u) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2),
  outCubic: (u) => 1 - Math.pow(1 - u, 3),
  inOutQuint: (u) => (u < 0.5 ? 16 * u ** 5 : 1 - Math.pow(-2 * u + 2, 5) / 2),
};

/**
 * A shot: { id, name, duration (s), ease, pos: [[x,y,z],...], look: [[x,y,z],...] (or a single point),
 *           fov: number | [from, to], roll: number | [from, to] (radians), hold: seconds held on the last frame }
 */
export class Shot {
  constructor(def) {
    this.def = def;
    const v = (a) => new THREE.Vector3(a[0], a[1], a[2]);
    this.pos = def.pos.length > 1 ? new THREE.CatmullRomCurve3(def.pos.map(v), false, 'centripetal') : null;
    this.p0 = v(def.pos[0]);
    const looks = Array.isArray(def.look[0]) ? def.look : [def.look];
    this.look = looks.length > 1 ? new THREE.CatmullRomCurve3(looks.map(v), false, 'centripetal') : null;
    this.l0 = v(looks[0]);
    this.ease = EASE[def.ease || 'inOutSine'];
    this.duration = def.duration;
  }
  /** Pose the camera at time t seconds into the shot. Returns true while the shot is still running. */
  apply(camera, t) {
    const u = this.ease(THREE.MathUtils.clamp(t / this.duration, 0, 1));
    if (this.pos) this.pos.getPointAt(u, camera.position); else camera.position.copy(this.p0);
    const target = this.look ? this.look.getPointAt(u) : this.l0;
    camera.up.set(0, 1, 0);
    camera.lookAt(target);
    const lerp = (x) => (Array.isArray(x) ? x[0] + (x[1] - x[0]) * u : x);
    if (this.def.roll) camera.rotateZ(lerp(this.def.roll));
    const fov = lerp(this.def.fov ?? 50);
    if (camera.fov !== fov) { camera.fov = fov; camera.updateProjectionMatrix(); }
    return t < this.duration + (this.def.hold ?? 0);
  }
}

/** Free-fly camera: WASD move, Q/E (or Ctrl/Space) down/up, drag to look, wheel = speed, Shift = 4x, smoothed. */
export class FreeCam {
  constructor(camera, dom) {
    this.camera = camera; this.dom = dom;
    this.speed = 12; this.enabled = false;
    this.yaw = 0; this.pitch = 0; this.vel = new THREE.Vector3();
    this.keys = new Set();
    this._ty = 0; this._tp = 0;
    addEventListener('keydown', (e) => this.keys.add(e.code));
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => this.keys.clear());
    let drag = null;
    dom.addEventListener('pointerdown', (e) => { if (this.enabled) { drag = { x: e.clientX, y: e.clientY }; dom.setPointerCapture(e.pointerId); } });
    dom.addEventListener('pointermove', (e) => {
      if (!drag || !this.enabled) return;
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag = { x: e.clientX, y: e.clientY };
      this._ty -= dx * 0.0025; this._tp = THREE.MathUtils.clamp(this._tp - dy * 0.0025, -1.5, 1.5);
    });
    dom.addEventListener('pointerup', () => { drag = null; });
    dom.addEventListener('wheel', (e) => {
      if (!this.enabled) return;
      this.speed = THREE.MathUtils.clamp(this.speed * (e.deltaY > 0 ? 0.85 : 1.18), 0.5, 200);
      this.onSpeed?.(this.speed);
      e.preventDefault();
    }, { passive: false });
  }
  /** Start from the current camera pose (so you can grab the frame a shot ended on). */
  takeOver() {
    const e = new THREE.Euler().setFromQuaternion(this.camera.quaternion, 'YXZ');
    this.yaw = this._ty = e.y; this.pitch = this._tp = e.x; this.vel.set(0, 0, 0);
  }
  update(dt) {
    if (!this.enabled) return;
    const k = (c) => this.keys.has(c);
    const s = this.speed * (k('ShiftLeft') || k('ShiftRight') ? 4 : 1) * (k('AltLeft') ? 0.25 : 1);
    const f = (k('KeyW') ? 1 : 0) - (k('KeyS') ? 1 : 0), r = (k('KeyD') ? 1 : 0) - (k('KeyA') ? 1 : 0);
    const u = (k('KeyE') || k('Space') ? 1 : 0) - (k('KeyQ') || k('ControlLeft') ? 1 : 0);
    // smoothed look (cinematic: no jitter from the mouse)
    const lk = 1 - Math.exp(-dt * 10);
    this.yaw += (this._ty - this.yaw) * lk; this.pitch += (this._tp - this.pitch) * lk;
    this.camera.quaternion.setFromEuler(new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ'));
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion);
    const want = new THREE.Vector3().addScaledVector(fwd, f).addScaledVector(right, r).addScaledVector(new THREE.Vector3(0, 1, 0), u);
    if (want.lengthSq() > 0) want.normalize().multiplyScalar(s);
    this.vel.lerp(want, 1 - Math.exp(-dt * 4));
    this.camera.position.addScaledVector(this.vel, dt);
  }
}
