// Lumen Tag rivals: blocky kids with glowing visors + lumen blasters; chase / strafe / take cover / grab powers.
import * as THREE from 'three';
import * as C from './config.js';
const rand = (a, b) => a + Math.random() * (b - a);

export function textSprite(text, color = '#fff', size = 1.6) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 128; const g = c.getContext('2d');
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = '900 52px sans-serif';
  g.lineWidth = 10; g.strokeStyle = '#120828'; g.strokeText(text, 128, 64); g.shadowColor = color; g.shadowBlur = 18; g.fillStyle = color; g.fillText(text, 128, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthTest: false, depthWrite: false, fog: false })); s.renderOrder = 10;
  s.scale.set(size * 2, size, 1); return s;
}

export function makeBotMesh(color, name) {
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  const m = (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.6 });
  const glow = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1.4, toneMapped: false });
  const box = (w, h, d, mat, x, y, z) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); b.position.set(x, y, z); return b; };
  const suit = m('#1d1838'), skin = m('#ffd34d');
  const legs = [-0.22, 0.22].map(x => { const p = new THREE.Group(); p.position.set(x, 0.8, 0); p.add(box(0.38, 0.8, 0.4, suit, 0, -0.4, 0)); p.add(box(0.4, 0.08, 0.42, glow, 0, -0.55, 0)); body.add(p); return p; });
  body.add(box(0.9, 0.85, 0.5, suit, 0, 1.22, 0));
  body.add(box(0.94, 0.22, 0.54, glow, 0, 1.36, 0));               // glowing vest band
  const arm = new THREE.Group(); arm.position.set(0.6, 1.55, 0); arm.add(box(0.3, 0.8, 0.32, suit, 0, -0.35, 0));
  const gun = box(0.18, 0.18, 0.75, m('#dfe8ff'), 0, -0.72, 0.28); arm.add(gun); arm.add(box(0.1, 0.1, 0.1, glow, 0, -0.72, 0.68));
  arm.rotation.x = -1.35; body.add(arm);
  body.add(box(0.3, 0.8, 0.32, suit, -0.6, 1.2, 0));
  body.add(box(0.62, 0.62, 0.62, skin, 0, 1.96, 0));
  body.add(box(0.66, 0.16, 0.12, glow, 0, 2.02, 0.3));             // visor
  body.add(box(0.68, 0.18, 0.68, suit, 0, 2.32, 0));
  const tag = textSprite(name, color, 0.9); tag.position.y = 3.1; g.add(tag);
  g.userData = { legs, arm, glow, body };
  return g;
}

const v = new THREE.Vector3(), w = new THREE.Vector3();
export function botThink(e, api, dt, want) {
  const ai = e.ai, { ents, pillars, pads } = api;
  let SPEED = C.BOT_SPEED * (e.power === 'surge' ? 1.35 : 1) * (ai.skill || 1);
  ai.retarget -= dt; ai.cd -= dt; ai.strafeT -= dt; ai.coverT -= dt; ai.react -= dt;
  if (ai.strafeT <= 0) { ai.strafe = Math.random() < 0.5 ? -1 : 1; ai.strafeT = rand(0.6, 1.6); if (e.ground && Math.random() < 0.18) { e.vy = 9; e.ground = false; } }
  // pick target: nearest visible rival (slight preference for the player and the leader)
  if (ai.retarget <= 0 || !ai.target || ai.target.dead) {
    let best = null, bd = Infinity; const lead = Math.max(...ents.map(o => o.score));
    for (const o of ents) { if (o === e || o.dead) continue;
      let d = Math.hypot(o.pos.x - e.pos.x, o.pos.z - e.pos.z) * (o.me ? 0.85 : 1) * (o.score === lead && lead > 2 ? 0.8 : 1) * rand(0.85, 1.15);
      if (!api.los(e.pos, o.pos)) d *= 1.8; if (d < bd) { bd = d; best = o; } }
    if (best !== ai.target) ai.react = rand(0.25, 0.5);
    ai.target = best; ai.retarget = rand(1.2, 2.6);
  }
  const tgt = ai.target, sees = tgt && !tgt.dead && api.los(e.pos, tgt.pos);
  const td = tgt ? Math.hypot(tgt.pos.x - e.pos.x, tgt.pos.z - e.pos.z) : 99;
  // power crystal nearby?
  let pad = null; for (const p of pads) if (p.ready && Math.hypot(p.x - e.pos.x, p.z - e.pos.z) < 11) pad = p;
  if (ai.coverT > 0 && ai.cover) {                         // ducking behind a crystal
    want.set(ai.cover.x - e.pos.x, 0, ai.cover.z - e.pos.z); const d = want.length();
    want.normalize().multiplyScalar(d < 0.6 ? 0 : SPEED);
  } else if (pad && !e.power && (!sees || td > 9)) {
    want.set(pad.x - e.pos.x, 0, pad.z - e.pos.z).normalize().multiplyScalar(SPEED);
  } else if (tgt) {
    v.set(tgt.pos.x - e.pos.x, 0, tgt.pos.z - e.pos.z).normalize();
    const along = !sees ? 1 : td > 17 ? 0.9 : td < 8 ? -0.6 : 0.05;
    want.set(v.x * along - v.z * ai.strafe, 0, v.z * along + v.x * ai.strafe).normalize().multiplyScalar(SPEED * (sees ? 0.8 : 1));
  } else want.set(-e.pos.x, 0, -e.pos.z).normalize().multiplyScalar(SPEED * 0.5);
  // steer around pillars ahead
  if (want.lengthSq() > 0.01) {
    w.copy(want).normalize();
    for (const p of pillars) { const dx = p.x - e.pos.x, dz = p.z - e.pos.z, d = Math.hypot(dx, dz); if (d > p.r + 3) continue;
      if (dx * w.x + dz * w.z > 0) { const side = dx * w.z - dz * w.x > 0 ? 1 : -1; want.x += w.z * side * SPEED * 0.8; want.z -= w.x * side * SPEED * 0.8; } }
    const r = Math.hypot(e.pos.x, e.pos.z); if (r > C.ARENA_R - 3) { want.x -= e.pos.x / r * SPEED; want.z -= e.pos.z / r * SPEED; }
    if (want.length() > SPEED) want.setLength(SPEED);
  }
  // fire
  if (sees && ai.cd <= 0 && ai.react <= 0 && td < C.RANGE * 0.8) {
    api.leadDir(e, tgt, v);
    const err = rand(-1, 1) * (0.05 + td * 0.004) / (ai.skill || 1);
    const c = Math.cos(err), s = Math.sin(err); v.set(v.x * c - v.z * s, 0, v.x * s + v.z * c);
    api.fire(e, v);
    e.mesh.rotation.y = Math.atan2(v.x, v.z); ai.faceT = 0.35;
    ai.cd = rand(...C.BOT_FIRE_CD) * (e.power === 'surge' ? 0.55 : 1);
    ai.shots = (ai.shots || 0) + 1;
    if (ai.shots >= 3 && Math.random() < 0.4) takeCover(e, api, tgt);
  }
  return want;
}
export function takeCover(e, api, threat) {
  const ai = e.ai; if (!threat) return; let best = null, bd = Infinity;
  for (const p of api.pillars) { const d = Math.hypot(p.x - e.pos.x, p.z - e.pos.z); if (d < bd && d < 14) { bd = d; best = p; } }
  if (!best) return;
  v.set(best.x - threat.pos.x, 0, best.z - threat.pos.z).normalize();
  ai.cover = { x: best.x + v.x * (best.r + 1.3), z: best.z + v.z * (best.r + 1.3) }; ai.coverT = rand(0.9, 1.6); ai.shots = 0;
}
