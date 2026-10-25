// Knockout Floes rivals: blocky old-Roblox-style kids + simple chase / throw / dodge / hop AI.
import * as THREE from 'three';
import * as C from './config.js';
const rand = (a, b) => a + Math.random() * (b - a);

export function textSprite(text, color = '#fff', size = 1.6, emoji = false) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 128; const g = c.getContext('2d');
  g.textAlign = 'center'; g.textBaseline = 'middle';
  if (emoji) { g.fillStyle = 'rgba(255,255,255,.95)'; g.beginPath(); g.roundRect(68, 8, 120, 104, 30); g.fill(); g.font = '72px sans-serif'; g.fillText(text, 128, 64); }
  else { g.font = '900 54px sans-serif'; g.lineWidth = 10; g.strokeStyle = '#1a0f2e'; g.strokeText(text, 128, 64); g.fillStyle = color; g.fillText(text, 128, 64); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthTest: false, depthWrite: false })); s.renderOrder = 10;
  s.scale.set(size * 2, size, 1); return s;
}

export function makeBotMesh(color, name) {
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  const m = (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.7 });
  const box = (w, h, d, mat, x, y, z) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); b.position.set(x, y, z); return b; };
  const shirt = m(color), skin = m('#ffd34d'), pants = m('#2d3a5a');
  const legs = [-0.22, 0.22].map(x => { const p = new THREE.Group(); p.position.set(x, 0.8, 0); p.add(box(0.38, 0.8, 0.4, pants, 0, -0.4, 0)); body.add(p); return p; });
  body.add(box(0.9, 0.85, 0.5, shirt, 0, 1.22, 0));
  const arm = new THREE.Group(); arm.position.set(0.6, 1.55, 0); arm.add(box(0.3, 0.8, 0.32, shirt, 0, -0.35, 0)); body.add(arm);
  const arm2 = box(0.3, 0.8, 0.32, shirt, -0.6, 1.2, 0); body.add(arm2);
  body.add(box(0.62, 0.62, 0.62, skin, 0, 1.96, 0));
  body.add(box(0.12, 0.12, 0.05, m('#1a1a2e'), -0.14, 2.0, 0.32), box(0.12, 0.12, 0.05, m('#1a1a2e'), 0.14, 2.0, 0.32));
  body.add(box(0.68, 0.26, 0.68, shirt, 0, 2.36, 0));                  // beanie
  const pom = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), m('#ffffff')); pom.position.y = 2.6; body.add(pom);
  const scarf = box(0.7, 0.14, 0.56, m('#ffffff'), 0, 1.66, 0); body.add(scarf);
  const tag = textSprite(name, color, 0.9); tag.position.y = 3.1; g.add(tag);
  g.userData = { legs, arm };
  return g;
}

const v = new THREE.Vector3(), w = new THREE.Vector3();
export function botThink(e, api, dt, want) {
  const ai = e.ai, { ents, floes, floeAt } = api;
  const SPEED = 6.4;
  ai.retarget -= dt; ai.cd -= dt; ai.strafeT = (ai.strafeT || 0) - dt;
  if (ai.strafeT <= 0) { ai.strafe = Math.random() < 0.5 ? -1 : 1; ai.strafeT = rand(0.8, 2); }
  if (ai.retarget <= 0 || !ai.target || ai.target.out) {
    let best = null, bd = Infinity;
    for (const o of ents) { if (o === e || o.out) continue; const d = Math.hypot(o.pos.x - e.pos.x, o.pos.z - e.pos.z) * (o.me ? 0.8 : 1) * rand(0.85, 1.15); if (d < bd) { bd = d; best = o; } }
    ai.target = best; ai.retarget = rand(1.5, 3.2);
  }
  const cur = floeAt(e.pos.x, e.pos.z);
  const safe = floes.filter(f => !f.gone && f.state === 'ok');
  const tgt = ai.target;
  // 1) recovering from a knock: skate hard back toward the middle of the floe
  if (cur && e.kb.length() > 4) { want.set(cur.x - e.pos.x, 0, cur.z - e.pos.z).normalize().multiplyScalar(SPEED * 1.1); }
  // 2) floe is cracking (or none): evacuate to the nearest safe floe
  else if (!cur || cur.state !== 'ok') {
    let goal = null, gd = Infinity; for (const f of safe) { const d = Math.hypot(f.x - e.pos.x, f.z - e.pos.z) - (f.center ? 2 : 0); if (d < gd) { gd = d; goal = f; } }
    if (goal) { want.set(goal.x - e.pos.x, 0, goal.z - e.pos.z).normalize().multiplyScalar(SPEED); ai.goal = goal; }
  } else if (tgt) {
    v.set(tgt.pos.x - e.pos.x, 0, tgt.pos.z - e.pos.z); const d = v.length(); v.normalize();
    const along = d > 12 ? 1 : d < 6 ? -0.8 : 0.1;
    want.set(v.x * along - v.z * ai.strafe * 0.7, 0, v.z * along + v.x * ai.strafe * 0.7).normalize().multiplyScalar(SPEED * (d > 12 ? 1 : 0.7));
    ai.goal = floeAt(tgt.pos.x, tgt.pos.z);
  }
  // edge safety: don't skate off unless hopping to another floe
  if (cur && want.lengthSq() > 0.01) {
    w.copy(want).normalize();
    const ahead = floeAt(e.pos.x + w.x * 1.3, e.pos.z + w.z * 1.3);
    if (!ahead || (ahead !== cur && ahead.state !== 'ok')) {
      const far = floeAt(e.pos.x + w.x * 3.2, e.pos.z + w.z * 3.2);
      if (far && far !== cur && far.state === 'ok' && e.ground && Math.random() < 0.6) { e.vy = C.JUMP_V; e.ground = false; e.vel.copy(w).multiplyScalar(SPEED); }
      else want.set(cur.x - e.pos.x, 0, cur.z - e.pos.z).normalize().multiplyScalar(SPEED * 0.6);
    }
  }
  // dodge incoming snowballs (once per ball)
  for (const b of api.balls) {
    if (!b.alive || b.owner === e || b.dodged.has(e)) continue;
    v.set(e.pos.x - b.p.x, 0, e.pos.z - b.p.z); const d = v.length();
    if (d < 7 && v.dot(w.set(b.v.x, 0, b.v.z)) > 0) {
      b.dodged.add(e); if (Math.random() > 0.3) continue;
      if (e.ground && Math.random() < 0.5) { e.vy = C.JUMP_V * 0.8; e.ground = false; }
      else { w.normalize(); e.vel.set(-w.z, 0, w.x).multiplyScalar(SPEED * (Math.random() < 0.5 ? -1 : 1)); }
    }
  }
  // throw
  if (tgt && ai.cd <= 0 && e.ground) {
    const d = Math.hypot(tgt.pos.x - e.pos.x, tgt.pos.z - e.pos.z);
    if (d < 20) {
      api.leadDir(e, tgt, v); const err = rand(-0.14, 0.14); const c = Math.cos(err), s = Math.sin(err);
      v.set(v.x * c - v.z * s, 0, v.x * s + v.z * c);
      api.throwBall(e, v, Math.random() < 0.25 ? rand(0.5, 1) : rand(0, 0.35));
      e.mesh.rotation.y = Math.atan2(v.x, v.z);
      ai.cd = rand(1.2, 2.6);
    }
  }
  return want;
}
