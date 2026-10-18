// Third-person character controller: movement, jumping, rocket flight,
// collision resolution, and an orbit camera that avoids walls.
import * as THREE from 'three';

const HW = 0.42, HEIGHT = 2.6, STEP = 0.8;
const GRAVITY = 32, JUMP = 11.5, SPEED = 9, ROCKET_THRUST = 55, ROCKET_MAX_UP = 9;

export class PlayerController {
  constructor(camera, avatar, input) {
    this.camera = camera; this.avatar = avatar; this.input = input;
    this.pos = new THREE.Vector3(); this.vel = new THREE.Vector3();
    this.facing = 0; this.onGround = false; this.flying = false;
    this.camYaw = Math.PI; this.camPitch = 0.35; this.camDist = 9; this.maxCamDist = 16;
    this.occluders = [];
    this.ray = new THREE.Raycaster();
    this.enabled = true;
    this.distanceWalked = 0;
    // gear / gameplay modifiers
    this.mods = { speed: 1, gravity: 1, jump: 1, carpet: false };
    this.onFall = null; // callback when falling out of the world
  }

  teleport(v, facing = 0) {
    this.pos.copy(v); this.vel.set(0, 0, 0); this.facing = facing; this.camYaw = facing + Math.PI;
  }

  orbit(dx, dy) {
    this.camYaw -= dx * 0.006;
    this.camPitch = Math.min(1.3, Math.max(-0.25, this.camPitch + dy * 0.005));
  }
  zoom(delta) { this.camDist = Math.min(this.maxCamDist, Math.max(3, this.camDist + delta * 0.01)); }

  _hits(col, p) { return col.overlaps(p.x - HW, p.y, p.z - HW, p.x + HW, p.y + HEIGHT, p.z + HW); }

  update(dt, col) {
    const k = (c) => this.enabled && this.input.down(c);
    const f = (k('KeyW') || k('ArrowUp') ? 1 : 0) - (k('KeyS') || k('ArrowDown') ? 1 : 0);
    const s = (k('KeyD') || k('ArrowRight') ? 1 : 0) - (k('KeyA') || k('ArrowLeft') ? 1 : 0);
    // camera looks along -camForward; forward for movement is away from camera
    const fx = -Math.sin(this.camYaw), fz = -Math.cos(this.camYaw);
    const rx = Math.cos(this.camYaw), rz = -Math.sin(this.camYaw);
    // Optional analog input (mobile joystick): input.analog = {x, y} in -1..1 (y = forward)
    const an = this.enabled && this.input.analog;
    let af = f, as = s, mag = 1;
    if (an && (Math.abs(an.x) > 0.05 || Math.abs(an.y) > 0.05)) { af = an.y; as = an.x; mag = Math.min(1, Math.hypot(an.x, an.y)); }
    let mx = fx * af + rx * as, mz = fz * af + rz * as;
    let len = Math.hypot(mx, mz);
    if (len > 0) { mx = (mx / len) * mag; mz = (mz / len) * mag; this.facing = Math.atan2(mx, mz); len = mag; }
    this.vel.x = mx * SPEED * this.mods.speed; this.vel.z = mz * SPEED * this.mods.speed;

    if (this.mods.carpet) {
      // magic carpet: hover, Space = rise, Q / C = descend
      const up = (k('Space') ? 1 : 0) - (k('KeyQ') || k('KeyC') ? 1 : 0);
      this.vel.y = up * 7;
      this.flying = false;
    } else {
      if (k('Space') && this.onGround) { this.vel.y = JUMP * this.mods.jump; this.onGround = false; }
      this.flying = k('KeyF') && this.avatar.hasRocket();
      if (this.flying) this.vel.y = Math.min(ROCKET_MAX_UP, this.vel.y + ROCKET_THRUST * dt);
      this.vel.y -= GRAVITY * this.mods.gravity * dt * (this.flying ? 0.5 : 1);
    }
    this.vel.y = Math.max(this.vel.y, -30);

    const steps = 4, h = dt / steps, p = this.pos;
    const before = p.clone();
    for (let i = 0; i < steps; i++) {
      for (const axis of ['x', 'z']) {
        const d = this.vel[axis] * h; if (!d) continue;
        p[axis] += d;
        if (this._hits(col, p)) {
          // try stepping up (stairs, small ledges)
          const oy = p.y; let stepped = false;
          if (this.onGround) {
            for (let up = 0.1; up <= STEP + 1e-6; up += 0.1) { p.y = oy + up; if (!this._hits(col, p)) { stepped = true; break; } }
          }
          if (!stepped) { p.y = oy; p[axis] -= d; }
        }
      }
      const dy = this.vel.y * h;
      p.y += dy;
      let grounded = false;
      if (this._hits(col, p)) {
        // bisect back toward the free position to close gaps
        let lo = p.y - dy, hi = p.y;
        for (let j = 0; j < 8; j++) { const m = (lo + hi) / 2; p.y = m; if (this._hits(col, p)) hi = m; else lo = m; }
        p.y = lo;
        if (dy < 0) grounded = true;
        this.vel.y = 0;
      }
      if (col.floorY != null && p.y < col.floorY) { p.y = col.floorY; this.vel.y = Math.max(0, this.vel.y); grounded = true; }
      if (p.y < -30) { this.vel.set(0, 0, 0); if (this.onFall) this.onFall(); else p.set(0, 5, 0); } // fell off the world
      col.clampBounds(p);
      this.onGround = grounded || (this.vel.y <= 0 && this._hits(col, new THREE.Vector3(p.x, p.y - 0.05, p.z))) || (col.floorY != null && p.y <= col.floorY + 1e-3);
    }
    this.distanceWalked += Math.hypot(p.x - before.x, p.z - before.z);

    // avatar
    this.avatar.root.position.copy(p);
    const cur = this.avatar.root.rotation.y;
    let diff = this.facing - cur; diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    this.avatar.root.rotation.y = cur + diff * Math.min(1, dt * 12);
    this.avatar.animate(dt, { speed: len > 0 ? 1 : 0, air: !this.onGround && !this.mods.carpet, flying: this.flying });

    this.updateCamera();
  }

  updateCamera() {
    const target = this.pos.clone().add(new THREE.Vector3(0, 2.2, 0));
    const dir = new THREE.Vector3(Math.sin(this.camYaw) * Math.cos(this.camPitch), Math.sin(this.camPitch), Math.cos(this.camYaw) * Math.cos(this.camPitch));
    let dist = this.camDist;
    if (this.occluders.length) {
      this.ray.set(target, dir); this.ray.far = dist;
      const hit = this.ray.intersectObjects(this.occluders, false)[0];
      if (hit) dist = Math.max(0.8, hit.distance - 0.3);
    }
    this.camera.position.copy(target).addScaledVector(dir, dist);
    if (this.camera.position.y < 0.3) this.camera.position.y = 0.3;
    this.camera.lookAt(target);
  }
}
