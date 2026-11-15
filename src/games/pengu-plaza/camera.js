// Pengu Plaza BIG — camera mode: first-person viewfinder with zoom, filters, rule-of-thirds, live "subject in
// frame" read-out, and a shot scorer (framing + distance/size + pose/event bonus) that captures a thumbnail.
import * as THREE from 'three';
import { TARGET_BY_ID } from './targets.js';
import { FILTERS, FRAMES } from './rewards.js';
const EYE = 1.95, FOV0 = 62, ZMAX = 4;
const tmp = new THREE.Vector3(), dir = new THREE.Vector3(), ray = new THREE.Raycaster();
export const zoomToFov = (z) => THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(FOV0) / 2) / z));
export class PhotoCam {
  constructor({ engine, runtime, getArea }) {
    this.engine = engine; this.cam = engine.camera; this.player = engine.player; this.rt = runtime; this.getArea = getArea;
    this.active = false; this.zoom = 1; this.yaw = 0; this.pitch = 0; this.fov0 = this.cam.fov; this.filter = 'none';
    const self = this;
    this.controller = {
      drag(dx, dy) { const k = 0.0042 / Math.sqrt(self.zoom); self.yaw -= dx * k; self.pitch = THREE.MathUtils.clamp(self.pitch - dy * k, -1.2, 1.35); },
      wheel(dy) { self.setZoom(self.zoom * (dy > 0 ? 0.9 : 1.11)); },
      update(dt) { self.player.camYaw = self.yaw; self.player.update(dt, self.engine.game.collision); self.apply(); },
    };
  }
  enter(look = null) {
    if (this.active) return; this.active = true; this.fov0 = this.cam.fov; this.yaw = this.player.camYaw; this.pitch = 0.05;
    if (look) this.aim(look);
    this.player.mods.speed = 0.45; this.player.mods.jump = 0; if (this.engine.avatar?.root) this.engine.avatar.root.visible = false;
    this.setFilter(this.filter); this.apply();
  }
  exit() {
    if (!this.active) return; this.active = false; this.cam.fov = this.fov0; this.cam.updateProjectionMatrix(); this.player.mods.speed = 1; this.player.mods.jump = 1;
    this.player.camPitch = 0.35; if (this.engine.avatar?.root) this.engine.avatar.root.visible = true; this.engine.renderer.domElement.style.filter = '';
  }
  aim(look) { const p = this.player.pos; tmp.set(look[0] ?? look.x, look[1] ?? look.y, look[2] ?? look.z).sub(dir.set(p.x, p.y + EYE, p.z)); this.yaw = Math.atan2(-tmp.x, -tmp.z); this.pitch = Math.atan2(tmp.y, Math.hypot(tmp.x, tmp.z)); }
  setZoom(z) { this.zoom = THREE.MathUtils.clamp(z, 1, ZMAX); }
  setFilter(id) { this.filter = id; if (this.active) this.engine.renderer.domElement.style.filter = FILTERS.find(f => f.id === id)?.css || ''; }
  apply() {
    const p = this.player.pos, c = this.cam; c.position.set(p.x, p.y + EYE, p.z);
    dir.set(-Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), -Math.cos(this.yaw) * Math.cos(this.pitch));
    c.lookAt(tmp.copy(c.position).add(dir)); const f = zoomToFov(this.zoom); if (Math.abs(c.fov - f) > 0.01) { c.fov += (f - c.fov) * 0.35; c.updateProjectionMatrix(); }
  }
  /** Score every target that is in frame right now. Returns [{ id, meta, score, stars, bonus, sx, sy }] best first. */
  evaluate() {
    const c = this.cam, out = [], area = this.getArea()?.id || 'plaza', tanH = Math.tan(THREE.MathUtils.degToRad(c.fov) / 2), pp = this.player.pos;
    c.updateMatrixWorld(); c.getWorldDirection(dir);
    for (const [id, rt] of Object.entries(this.rt)) {
      const meta = TARGET_BY_ID[id]; if (!meta || !rt.active()) continue;
      if (rt.area && rt.area !== area) continue;
      if (meta.kind === 'spot' && rt.spot && Math.hypot(pp.x - rt.spot.x, pp.z - rt.spot.z) > 4.5) continue;
      const pts = typeof rt.pts === 'function' ? rt.pts() : rt.pts; let best = null;
      for (const P of pts) {
        tmp.set(P.x, P.y + (rt.yOff || 0), P.z); const toX = tmp.x - c.position.x, toY = tmp.y - c.position.y, toZ = tmp.z - c.position.z, d = Math.hypot(toX, toY, toZ);
        if (!rt.sky && d > rt.maxDist) continue; if (toX * dir.x + toY * dir.y + toZ * dir.z <= 0) continue;
        const sp = tmp.clone().project(c); if (Math.abs(sp.x) > 0.94 || Math.abs(sp.y) > 0.94) continue;
        if (!rt.sky && this.occluders?.length) { ray.set(c.position, tmp.clone().sub(c.position).normalize()); ray.far = d - 0.6; if (ray.intersectObjects(this.occluders, false).length) continue; }
        const cen = 1 - Math.min(1, Math.hypot(sp.x, sp.y) / 0.95), th = Math.min(...[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([a, b]) => Math.hypot(sp.x - a / 3, sp.y - b / 3))), framing = Math.max(cen, (1 - Math.min(1, th / 0.22)) * 0.95);
        let size; if (rt.sky) size = 0.85 + (meta.id === 'aurora' ? (this.zoom < 1.6 ? 0.15 : -0.1) : 0.15 * Math.min(1, this.zoom / 2));
        else { const a = meta.size / (2 * d * tanH); size = a < 0.05 ? (a / 0.05) * 0.35 : a < 0.18 ? 0.35 + (a - 0.05) / 0.13 * 0.65 : a <= 0.75 ? 1 : Math.max(0.45, 1 - (a - 0.75) * 1.2); }
        const bonus = !!rt.bonus(), atSpot = meta.kind === 'spot';
        const score = Math.round(Math.min(100, 100 * (0.45 * framing + 0.4 * size) + (bonus ? 18 : 0) + (atSpot ? 12 : 0) + (meta.kind === 'event' || meta.kind === 'secret' ? 6 : 0)));
        if (!best || score > best.score) best = { id, meta, score, bonus, sx: sp.x, sy: sp.y, d };
      }
      if (best && best.score >= 18) { best.stars = best.score >= 80 ? 3 : best.score >= 55 ? 2 : 1; out.push(best); }
    }
    return out.sort((a, b) => b.score - a.score);
  }
  /** Capture the current frame (last render) into a small framed card. */
  thumb(frameId = 'polaroid', label = '') {
    try {
      const src = this.engine.renderer.domElement, W = 224, H = 140, c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
      const fr = FRAMES.find(f => f.id === frameId) || FRAMES[0], pad = 7, ih = H - pad * 2 - 18, iw = W - pad * 2;
      g.fillStyle = fr.color; g.fillRect(0, 0, W, H);
      const ar = iw / ih, sar = src.width / src.height; let sw = src.width, sh = src.height, sx = 0, sy = 0; if (sar > ar) { sw = sh * ar; sx = (src.width - sw) / 2; } else { sh = sw / ar; sy = (src.height - sh) / 2; }
      const css = FILTERS.find(f => f.id === this.filter)?.css; if (css && 'filter' in g) g.filter = css;
      g.drawImage(src, sx, sy, sw, sh, pad, pad, iw, ih); g.filter = 'none';
      if (frameId === 'snowflake' || frameId === 'ice') { g.fillStyle = '#ffffffcc'; for (let i = 0; i < 14; i++) { g.beginPath(); g.arc((i * 37) % W, i % 2 ? 4 : H - 4, 2.5, 0, 7); g.fill(); } }
      if (frameId === 'film') { g.fillStyle = '#ffffff'; for (let x = 6; x < W; x += 14) { g.fillRect(x, 1, 7, 4); g.fillRect(x, H - 22, 7, 3); } }
      if (frameId === 'postcard') { g.strokeStyle = '#e0435f'; g.setLineDash([4, 3]); g.strokeRect(W - 34, pad + 3, 26, 30); g.setLineDash([]); }
      if (frameId === 'cozy') { g.strokeStyle = '#ffffff99'; g.lineWidth = 2; for (let x = 0; x < W; x += 8) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 4, 5); g.lineTo(x + 8, 0); g.stroke(); } }
      g.fillStyle = frameId === 'film' ? '#fff' : '#173a6e'; g.font = '700 11px system-ui,sans-serif'; g.textBaseline = 'middle'; g.fillText(label.slice(0, 32), pad + 2, H - 11);
      return c.toDataURL('image/jpeg', 0.72);
    } catch { return null; }
  }
}
