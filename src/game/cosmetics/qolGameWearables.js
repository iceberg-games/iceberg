// QoL GM2 game wearables (Cosmetics 2 lane) — Glacier Drift (gd_), Snowball Siege (ss_), Pengu Plaza (pp_).
// Each builder returns { bone: 'head'|'torso'|'armR', object } with userData.tick + userData.setColor,
// same contract as BUILDERS in avatar.js. Self-contained so it merges cleanly beside other lanes.
//
// Glacier Drift  : gd_boost_helmet (hat), gd_drift_visor (face), gd_magnet_scarf (neck), gd_rocket_sled (back)
// Snowball Siege : ss_fort_helm (hat), ss_war_paint (face), ss_ammo_bandolier (neck), ss_flag_banner (back), ss_snowball_launcher (hand)
// Pengu Plaza    : pp_beanie_pompom (hat), pp_cocoa_mug (hand), pp_pengu_backpack (back), pp_photo_camera (neck)
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

const std = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, ...extra });
const mesh = (geo, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; return m; };
const tint = (hex, toward, t) => new THREE.Color(hex).lerp(new THREE.Color(toward), t);
let _dot = null;
function dotTex() {
  if (_dot) return _dot;
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.4, 'rgba(255,255,255,0.6)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64); _dot = new THREE.CanvasTexture(c); return _dot;
}
const glow = (color, size, opacity = 1) => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTex(), color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending })); s.scale.setScalar(size); return s; };
// simple looping particle stream: spawn(p) sets start, step(p, life) positions it
function stream(parent, n, color, size, spawn, step) {
  const ps = []; for (let i = 0; i < n; i++) { const s = glow(color, size, 0.8); parent.add(s); const p = { s, life: i / n, d: {} }; spawn(p); ps.push(p); }
  return { ps, tick(dt, rate = 1) { for (const p of ps) { p.life += dt * rate; if (p.life >= 1) { p.life -= 1; spawn(p); } step(p, p.life); } }, setColor(c) { ps.forEach(p => p.s.material.color.set(c)); } };
}

// ================= Glacier Drift =================
function gdBoostHelmet(color) {
  const g = new THREE.Group(); const H = new THREE.Group(); H.position.y = 0.32; g.add(H);
  const shell = std(color, { roughness: 0.2, metalness: 0.3, emissive: color, emissiveIntensity: 0.1 });
  const dome = mesh(new THREE.SphereGeometry(0.4, 28, 16, 0, Math.PI * 2, 0, Math.PI / 2), shell); dome.scale.set(1, 0.85, 1.1); H.add(dome);
  const stripeM = std('#ffffff', { roughness: 0.3 });
  const stripe = mesh(new THREE.BoxGeometry(0.1, 0.36, 0.86), stripeM, 0, 0.17, 0); H.add(stripe);
  const finM = std(tint(color, '#ffffff', 0.5), { roughness: 0.3 });
  const fin = mesh(new THREE.BoxGeometry(0.05, 0.16, 0.34), finM, 0, 0.38, -0.08); fin.rotation.x = -0.25; H.add(fin);
  const boltM = std('#ffe14a', { emissive: '#ffcc00', emissiveIntensity: 0.8 });
  [-1, 1].forEach(s => { const b = mesh(new THREE.ConeGeometry(0.06, 0.18, 4), boltM, s * 0.4, 0.12, 0); b.rotation.z = s * -Math.PI / 2; H.add(b); });
  const trail = stream(H, 14, color, 0.09, p => { p.d.x = (Math.random() - 0.5) * 0.3; }, (p, L) => { p.s.position.set(p.d.x * (1 + L), 0.15 + L * 0.1, -0.42 - L * 0.7); p.s.material.opacity = 0.8 * (1 - L); p.s.scale.setScalar(0.1 * (1 - L) + 0.02); });
  let t = 0;
  g.userData.tick = (dt) => { t += dt; const pulse = (t % 1.8) < 0.25 ? Math.sin((t % 1.8) / 0.25 * Math.PI) : 0;
    H.scale.set(1 + pulse * 0.05, 1 - pulse * 0.04, 1 + pulse * 0.05); boltM.emissiveIntensity = 0.6 + pulse * 1.4; fin.rotation.x = -0.25 + Math.sin(t * 9) * 0.04; trail.tick(dt, 1.2 + pulse * 2); };
  g.userData.setColor = (c) => { shell.color.set(c); shell.emissive.set(c); finM.color.set(tint(c, '#ffffff', 0.5)); trail.setColor(c); };
  return { bone: 'head', object: g };
}
function gdDriftVisor(color) {
  const g = new THREE.Group();
  const lensM = new THREE.MeshPhysicalMaterial({ color, transparent: true, opacity: 0.6, roughness: 0.05, iridescence: 1, emissive: color, emissiveIntensity: 0.4, depthWrite: false });
  const lens = new THREE.Mesh(new RoundedBoxGeometry(0.66, 0.16, 0.05, 4, 0.06), lensM); lens.position.set(0, 0.37, 0.34); g.add(lens);
  const frameM = std('#1f2a44', { roughness: 0.4 });
  g.add(mesh(new THREE.BoxGeometry(0.7, 0.03, 0.06), frameM, 0, 0.46, 0.33));
  const strap = mesh(new THREE.TorusGeometry(0.37, 0.025, 6, 32), std(tint(color, '#ffffff', 0.3)), 0, 0.37, 0); strap.rotation.x = Math.PI / 2; g.add(strap);
  const glint = glow('#ffffff', 0.08, 0); g.add(glint);
  const sp = [0, 1, 2].map(i => { const s = glow(color, 0.05, 0.9); g.add(s); return s; });
  let t = 0;
  g.userData.tick = (dt) => { t += dt; const ph = (t % 2.4) / 0.6; glint.material.opacity = ph < 1 ? Math.sin(ph * Math.PI) : 0; glint.position.set(-0.3 + Math.min(ph, 1) * 0.6, 0.42, 0.41); glint.scale.setScalar(0.06 + glint.material.opacity * 0.12);
    sp.forEach((s, i) => { const a = t * 2 + i * 2.1; s.position.set(Math.cos(a) * 0.45, 0.4 + Math.sin(a * 1.3) * 0.08, Math.sin(a) * 0.45); }); };
  g.userData.setColor = (c) => { lensM.color.set(c); lensM.emissive.set(c); strap.material.color.set(tint(c, '#ffffff', 0.3)); sp.forEach(s => s.material.color.set(c)); };
  return { bone: 'head', object: g };
}
function gdMagnetScarf(color) {
  const g = new THREE.Group();
  const knit = std(color, { roughness: 0.9 });
  const ring = mesh(new THREE.TorusGeometry(0.3, 0.07, 10, 28), knit, 0, 0.42, 0.04); ring.rotation.x = Math.PI / 2; ring.scale.set(1.15, 1, 1); g.add(ring);
  const M = new THREE.Group(); M.position.set(0.14, 0.28, 0.36); g.add(M);
  const redM = std('#ff4a5a', { roughness: 0.4 }), tipM = std('#e8f4ff', { metalness: 0.6, roughness: 0.2 });
  const u = mesh(new THREE.TorusGeometry(0.07, 0.03, 8, 16, Math.PI), redM); u.rotation.z = Math.PI; M.add(u);
  [-1, 1].forEach(s => M.add(mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.04, 10), tipM, s * 0.07, 0.02, 0)));
  const tail = mesh(new THREE.BoxGeometry(0.12, 0.32, 0.04), knit, -0.12, 0.22, 0.34); g.add(tail);
  const bits = stream(M, 10, '#bff4ff', 0.04, p => { const a = Math.random() * 6.28; p.d = { x: Math.cos(a) * 0.35, y: Math.sin(a) * 0.3 + 0.1 }; }, (p, L) => { const k = 1 - L * L; p.s.position.set(p.d.x * k, p.d.y * k + 0.04, 0.05); p.s.material.opacity = 0.9 * L; });
  let t = 0;
  g.userData.tick = (dt) => { t += dt; M.rotation.z = Math.sin(t * 3) * 0.2; M.position.y = 0.28 + Math.sin(t * 2) * 0.015; tail.rotation.z = Math.sin(t * 2.3) * 0.12; tail.rotation.x = -0.1 + Math.sin(t * 1.7) * 0.08; bits.tick(dt, 0.9); };
  g.userData.setColor = (c) => knit.color.set(c);
  return { bone: 'torso', object: g };
}
function gdRocketSled(color) {
  const g = new THREE.Group(); const S = new THREE.Group(); S.position.set(0, 0.45, -0.4); S.rotation.x = -0.25; S.scale.setScalar(1.3); g.add(S);
  const body = std(color, { roughness: 0.3, metalness: 0.2 });
  const deck = mesh(new RoundedBoxGeometry(0.42, 0.7, 0.08, 3, 0.03), body); S.add(deck);
  const nose = mesh(new THREE.TorusGeometry(0.12, 0.03, 8, 16, Math.PI), std('#e6f4ff', { metalness: 0.5, roughness: 0.2 }), 0, 0.35, -0.08); nose.rotation.y = Math.PI / 2; S.add(nose);
  const stripeM = std('#ffffff', { roughness: 0.4 }), boltM = std('#ffe14a', { emissive: '#ffcc00', emissiveIntensity: 0.7 });
  S.add(mesh(new THREE.BoxGeometry(0.08, 0.66, 0.02), stripeM, 0, 0, -0.05));
  const bolt = mesh(new THREE.ConeGeometry(0.07, 0.18, 3), boltM, 0, 0.05, -0.065); bolt.rotation.x = -Math.PI / 2; S.add(bolt);
  const finM = std(tint(color, '#ffffff', 0.4), { roughness: 0.3 });
  [-1, 1].forEach(sx => { const f = mesh(new THREE.BoxGeometry(0.16, 0.22, 0.03), finM, sx * 0.28, -0.25, -0.02); f.rotation.z = sx * 0.35; S.add(f); });
  const runM = std('#dfefff', { metalness: 0.7, roughness: 0.2 });
  [-1, 1].forEach(s => S.add(mesh(new THREE.BoxGeometry(0.03, 0.74, 0.03), runM, s * 0.19, 0, -0.07)));
  const jetM = std('#2b3550', { roughness: 0.4 });
  const jets = [-1, 1].map(s => { const j = mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.16, 12), jetM, s * 0.1, -0.42, -0.02); S.add(j); return j; });
  const flame = stream(S, 18, '#9fe8ff', 0.1, p => { p.d.x = (Math.random() < 0.5 ? -1 : 1) * 0.1 + (Math.random() - 0.5) * 0.04; }, (p, L) => { p.s.position.set(p.d.x, -0.5 - L * 0.5, -0.02 - L * 0.15); p.s.material.opacity = 0.9 * (1 - L); p.s.scale.setScalar(0.12 * (1 - L) + 0.03); });
  const core = jets.map(j => { const c = glow('#ffffff', 0.14, 0.9); c.position.set(j.position.x, -0.52, -0.02); S.add(c); return c; });
  let t = 0;
  g.userData.tick = (dt) => { t += dt; S.rotation.z = Math.sin(t * 1.4) * 0.04; S.position.y = 0.45 + Math.sin(t * 7) * 0.008; const f = 0.8 + Math.sin(t * 23) * 0.2; boltM.emissiveIntensity = 0.5 + f * 0.5; core.forEach(c => c.scale.setScalar(0.12 * f)); flame.tick(dt, 2.4); };
  g.userData.setColor = (c) => { body.color.set(c); finM.color.set(tint(c, '#ffffff', 0.4)); };
  return { bone: 'torso', object: g };
}

// ================= Snowball Siege =================
function ssFortHelm(color) {
  const g = new THREE.Group(); const F = new THREE.Group(); F.position.y = 0.58; g.add(F);
  const snow = std('#f4fbff', { roughness: 0.95 }), trim = std(color, { roughness: 0.7 });
  F.add(mesh(new THREE.CylinderGeometry(0.36, 0.38, 0.18, 8), snow));
  F.add(mesh(new THREE.CylinderGeometry(0.385, 0.385, 0.05, 8), trim, 0, -0.08, 0));
  const merlons = []; for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; const b = mesh(new THREE.BoxGeometry(0.12, 0.12, 0.1), snow, Math.cos(a) * 0.32, 0.14, Math.sin(a) * 0.32); b.rotation.y = -a; F.add(b); merlons.push(b); }
  const pole = mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.36), std('#8a6a4a'), 0, 0.26, 0); F.add(pole);
  const flagM = std(color, { side: THREE.DoubleSide, emissive: color, emissiveIntensity: 0.15 });
  const flag = mesh(new THREE.PlaneGeometry(0.2, 0.12, 6, 1), flagM, 0.1, 0.38, 0); F.add(flag);
  const base = flag.geometry.attributes.position.array.slice();
  const puffs = stream(F, 8, '#ffffff', 0.07, p => { const a = Math.random() * 6.28; p.d = { a }; }, (p, L) => { p.s.position.set(Math.cos(p.d.a) * 0.34, 0.2 + L * 0.2, Math.sin(p.d.a) * 0.34); p.s.material.opacity = 0.6 * (1 - L); });
  let t = 0;
  g.userData.tick = (dt) => { t += dt; const pos = flag.geometry.attributes.position; for (let i = 0; i < pos.count; i++) { const x = base[i * 3]; pos.setZ(i, Math.sin(t * 8 - x * 25) * 0.025 * (x + 0.1) * 5); } pos.needsUpdate = true;
    merlons.forEach((m, i) => { m.position.y = 0.14 + Math.max(0, Math.sin(t * 4 - i * 0.8)) * 0.02; }); puffs.tick(dt, 0.5); };
  g.userData.setColor = (c) => { trim.color.set(c); flagM.color.set(c); flagM.emissive.set(c); };
  return { bone: 'head', object: g };
}
function ssWarPaint(color) {
  const g = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({ color, roughness: 0.5, emissive: color, emissiveIntensity: 0.25 });
  const strokes = [];
  [-1, 1].forEach(s => { for (let k = 0; k < 2; k++) { const m = mesh(new RoundedBoxGeometry(0.14, 0.035, 0.01, 2, 0.012), paint, s * 0.16, 0.26 - k * 0.06, 0.362); m.rotation.z = s * 0.15; g.add(m); strokes.push(m); } });
  const flake = glow('#ffffff', 0.06, 0.9); g.add(flake);
  let t = 0;
  g.userData.tick = (dt) => { t += dt; paint.emissiveIntensity = 0.2 + Math.max(0, Math.sin(t * 2.5)) * 0.35; const a = t * 1.7; flake.position.set(Math.sin(a) * 0.2, 0.58 + Math.abs(Math.sin(a * 2)) * 0.05, 0.38); flake.material.rotation = t; };
  g.userData.setColor = (c) => { paint.color.set(c); paint.emissive.set(c); };
  return { bone: 'head', object: g };
}
function ssAmmoBandolier(color) {
  const g = new THREE.Group(); const S = new THREE.Group(); S.rotation.z = -0.78; g.add(S);
  const strapM = std(color, { roughness: 0.8 });
  [0.27, -0.27].forEach(z => S.add(mesh(new THREE.BoxGeometry(0.14, 1.3, 0.03), strapM, 0, 0, z)));
  const ballM = std('#f8fdff', { roughness: 0.95 });
  const balls = []; for (let i = 0; i < 6; i++) { const b = mesh(new THREE.SphereGeometry(0.065, 12, 10), ballM, 0, -0.42 + i * 0.17, 0.32); S.add(b); balls.push(b); }
  const sp = glow('#dff6ff', 0.12, 0); S.add(sp);
  let t = 0;
  g.userData.tick = (dt) => { t += dt; balls.forEach((b, i) => { const k = Math.max(0, Math.sin(t * 3 - i * 0.7)); b.scale.set(1 + k * 0.12, 1 - k * 0.1, 1 + k * 0.12); });
    const i = Math.floor(t / 0.5) % balls.length, f = (t % 0.5) / 0.5; sp.position.copy(balls[i].position).add(new THREE.Vector3(0.03, 0.04, 0.06)); sp.material.opacity = Math.sin(f * Math.PI) * 0.9; };
  g.userData.setColor = (c) => strapM.color.set(c);
  return { bone: 'torso', object: g };
}
function ssFlagBanner(color) {
  const g = new THREE.Group(); const B = new THREE.Group(); B.position.set(0.18, 0.1, -0.32); B.rotation.z = -0.12; B.scale.setScalar(1.3); g.add(B);
  B.add(mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.4, 8), std('#8a6a4a'), 0, 0.55, 0));
  B.add(mesh(new THREE.SphereGeometry(0.06, 12, 10), std('#f8fdff', { roughness: 0.9 }), 0, 1.27, 0));
  const flagM = std(color, { side: THREE.DoubleSide, emissive: color, emissiveIntensity: 0.15, roughness: 0.7 });
  const flag = mesh(new THREE.PlaneGeometry(0.5, 0.34, 12, 4), flagM, -0.26, 1.04, 0); flag.rotation.y = Math.PI; B.add(flag);
  const emM = std('#ffffff', { roughness: 0.6, side: THREE.DoubleSide }); const em = mesh(new THREE.CircleGeometry(0.08, 16), emM, -0.26, 1.04, -0.012); em.rotation.y = Math.PI; B.add(em);
  const base = flag.geometry.attributes.position.array.slice();
  const fl = stream(B, 10, '#ffffff', 0.05, p => { p.d = { x: -Math.random() * 0.5, y: 1.0 + Math.random() * 0.2 }; }, (p, L) => { p.s.position.set(p.d.x - L * 0.3, p.d.y - L * 0.5, Math.sin(L * 9) * 0.05); p.s.material.opacity = 0.8 * (1 - L); });
  let t = 0;
  g.userData.tick = (dt) => { t += dt; const pos = flag.geometry.attributes.position; for (let i = 0; i < pos.count; i++) { const x = base[i * 3] + 0.25; pos.setZ(i, Math.sin(t * 6 + x * 12) * 0.05 * x); } pos.needsUpdate = true;
    em.position.z = -0.012 - Math.sin(t * 6 + 3) * 0.012; B.rotation.z = -0.12 + Math.sin(t * 1.5) * 0.03; fl.tick(dt, 0.7); };
  g.userData.setColor = (c) => { flagM.color.set(c); flagM.emissive.set(c); };
  return { bone: 'torso', object: g };
}
function ssSnowballLauncher(color) {
  const g = new THREE.Group(); g.position.set(0, -0.98, 0.3);
  const bodyM = std(color, { roughness: 0.4, metalness: 0.15 });
  const L = new THREE.Group(); g.add(L);
  L.add(mesh(new RoundedBoxGeometry(0.12, 0.12, 0.26, 3, 0.03), bodyM, 0, 0, 0.05));
  const tube = mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.34, 16, 1, true), std('#e6f2ff', { metalness: 0.5, roughness: 0.25, side: THREE.DoubleSide }), 0, 0.05, 0.3); tube.rotation.x = Math.PI / 2; L.add(tube);
  L.add(mesh(new THREE.BoxGeometry(0.05, 0.14, 0.06), bodyM, 0, -0.1, 0));
  const hopper = mesh(new THREE.SphereGeometry(0.09, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshPhysicalMaterial({ color: '#ffffff', transparent: true, opacity: 0.35, roughness: 0, depthWrite: false }), 0, 0.07, 0.04); L.add(hopper);
  const snowM = std('#f8fdff', { roughness: 0.95 });
  [0, 1, 2].forEach(i => L.add(mesh(new THREE.SphereGeometry(0.035, 10, 8), snowM, (i - 1) * 0.04, 0.1, 0.04)));
  const shot = mesh(new THREE.SphereGeometry(0.05, 12, 10), snowM); L.add(shot);
  const burst = stream(L, 10, '#ffffff', 0.05, p => { const a = Math.random() * 6.28; p.d = { x: Math.cos(a) * 0.15, y: Math.sin(a) * 0.15 }; }, () => {});
  let t = 0;
  g.userData.tick = (dt) => { t += dt; const ph = t % 2.2, fire = ph < 0.6;
    shot.visible = fire; if (fire) { const k = ph / 0.6; shot.position.set(0, 0.05 + k * 0.1 - k * k * 0.3, 0.45 + k * 1.2); }
    L.position.z = ph < 0.1 ? -Math.sin(ph / 0.1 * Math.PI) * 0.04 : 0;
    burst.ps.forEach(p => { const k = ph / 0.4; p.s.position.set(p.d.x * k, 0.05 + p.d.y * k, 0.48 + k * 0.05); p.s.material.opacity = ph < 0.4 ? 0.8 * (1 - k) : 0; }); };
  g.userData.setColor = (c) => bodyM.color.set(c);
  return { bone: 'armR', object: g };
}

// ================= Pengu Plaza =================
function ppBeaniePompom(color) {
  const g = new THREE.Group(); const B = new THREE.Group(); B.position.y = 0.42; g.add(B);
  const knit = std(color, { roughness: 1 });
  const cap = mesh(new THREE.SphereGeometry(0.4, 24, 14, 0, Math.PI * 2, 0, Math.PI / 2), knit); cap.scale.set(1.02, 0.8, 1.02); B.add(cap);
  const cuffM = std(tint(color, '#ffffff', 0.55), { roughness: 1 });
  B.add(mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.12, 24), cuffM, 0, 0.02, 0));
  const P = new THREE.Group(); P.position.y = 0.34; B.add(P);
  const pom = mesh(new THREE.IcosahedronGeometry(0.1, 2), cuffM); P.add(pom);
  // tiny penguin face on the cuff
  const bk = std('#1a2440'), wh = std('#ffffff'), ob = std('#ffa63a');
  const face = new THREE.Group(); face.position.set(0, 0.03, 0.42); B.add(face);
  face.add(mesh(new THREE.CircleGeometry(0.06, 16), bk)); face.add(mesh(new THREE.CircleGeometry(0.045, 16), wh, 0, -0.005, 0.001));
  const eyes = [-1, 1].map(s => { const e = mesh(new THREE.CircleGeometry(0.008, 8), bk, s * 0.016, 0.01, 0.002); face.add(e); return e; });
  const beak = mesh(new THREE.ConeGeometry(0.012, 0.025, 6), ob, 0, -0.012, 0.008); beak.rotation.x = Math.PI / 2; face.add(beak);
  const hearts = stream(B, 5, '#ff9fc8', 0.06, p => { p.d.x = (Math.random() - 0.5) * 0.3; }, (p, L) => { p.s.position.set(p.d.x + Math.sin(L * 8) * 0.03, 0.4 + L * 0.4, 0); p.s.material.opacity = 0.8 * Math.sin(L * Math.PI); });
  let t = 0;
  g.userData.tick = (dt) => { t += dt; P.position.x = Math.sin(t * 2.4) * 0.04; P.position.y = 0.34 + Math.abs(Math.sin(t * 4.8)) * 0.03; pom.scale.setScalar(1 + Math.sin(t * 9.6) * 0.04);
    const bl = (t % 3.2) < 0.12 ? 0.15 : 1; eyes.forEach(e => e.scale.y = bl); hearts.tick(dt, 0.35); };
  g.userData.setColor = (c) => { knit.color.set(c); cuffM.color.set(tint(c, '#ffffff', 0.55)); };
  return { bone: 'head', object: g };
}
function ppCocoaMug(color) {
  const g = new THREE.Group(); g.position.set(0, -0.96, 0.3);
  const mugM = std(color, { roughness: 0.35 });
  g.add(mesh(new THREE.CylinderGeometry(0.1, 0.09, 0.2, 20), mugM));
  const handle = mesh(new THREE.TorusGeometry(0.05, 0.018, 8, 16), mugM, 0.11, 0, 0); g.add(handle);
  const coc = mesh(new THREE.CircleGeometry(0.088, 20), std('#6b3a24', { roughness: 0.3 }), 0, 0.09, 0); coc.rotation.x = -Math.PI / 2; g.add(coc);
  const mm = std('#ffffff', { roughness: 0.9 }); const mms = [0, 1, 2].map(i => { const m = mesh(new RoundedBoxGeometry(0.04, 0.035, 0.04, 2, 0.01), mm, Math.cos(i * 2.1) * 0.04, 0.1, Math.sin(i * 2.1) * 0.04); g.add(m); return m; });
  const steamM = new THREE.SpriteMaterial({ map: dotTex(), color: '#ffffff', transparent: true, opacity: 0.5, depthWrite: false });
  const steam = []; for (let i = 0; i < 9; i++) { const s = new THREE.Sprite(steamM.clone()); g.add(s); steam.push({ s, L: i / 9, x: 0 }); }
  
  let t = 0;
  g.userData.tick = (dt) => { t += dt; mms.forEach((m, i) => { const a = t * 0.8 + i * 2.1; m.position.set(Math.cos(a) * 0.045, 0.1 + Math.sin(t * 3 + i) * 0.006, Math.sin(a) * 0.045); m.rotation.y = a; });
    for (const p of steam) { p.L += dt * 0.5; if (p.L > 1) { p.L -= 1; p.x = (Math.random() - 0.5) * 0.06; } p.s.position.set(p.x + Math.sin(t * 2 + p.L * 6) * 0.03 * p.L, 0.12 + p.L * 0.35, 0); p.s.scale.setScalar(0.05 + p.L * 0.1); p.s.material.opacity = 0.3 * Math.sin(p.L * Math.PI); } };
  g.userData.setColor = (c) => mugM.color.set(c);
  return { bone: 'armR', object: g };
}
function ppPenguBackpack(color) {
  // Blocky plush penguin riding on your back: body behind torso, head peeks above the shoulders so it reads from the front too.
  const g = new THREE.Group(); const P = new THREE.Group(); P.position.set(0, 0.05, -0.47); g.add(P);
  const bodyM = std(color, { roughness: 0.75 }), bellyM = std('#ffffff', { roughness: 0.85 }), orange = std('#ffa63a', { roughness: 0.45 });
  const dark = std('#10182c', { roughness: 0.3 }), shine = std('#ffffff', { emissive: '#ffffff', emissiveIntensity: 0.6 }), blushM = std('#ff9fc0', { roughness: 1 });
  const rb = (w, h, d, m, x, y, z, r = 0.06) => { const o = mesh(new RoundedBoxGeometry(w, h, d, 3, r), m, x, y, z); P.add(o); return o; };
  rb(0.62, 0.72, 0.4, bodyM, 0, 0, 0, 0.12);                       // body
  rb(0.44, 0.52, 0.06, bellyM, 0, -0.06, -0.19, 0.08);              // belly patch (outward face)
  const H = new THREE.Group(); H.position.set(0.3, 0.6, 0.06); H.rotation.z = -0.18; P.add(H); // head (peeks over shoulders)
  H.add(mesh(new RoundedBoxGeometry(0.5, 0.42, 0.4, 3, 0.12), bodyM));
  const faceFor = (z, dir) => { // white mask + eyes + beak on given side
    const F = new THREE.Group(); F.position.z = z; F.rotation.y = dir < 0 ? Math.PI : 0; H.add(F);
    F.add(mesh(new RoundedBoxGeometry(0.4, 0.28, 0.04, 2, 0.06), bellyM, 0, -0.03, 0));
    const eyes = [-1, 1].map(sx => { const e = new THREE.Group(); e.position.set(sx * 0.09, 0.03, 0.03); F.add(e);
      e.add(mesh(new THREE.BoxGeometry(0.07, 0.09, 0.03), dark)); e.add(mesh(new THREE.BoxGeometry(0.025, 0.025, 0.01), shine, 0.015, 0.02, 0.02)); return e; });
    [-1, 1].forEach(sx => F.add(mesh(new THREE.BoxGeometry(0.06, 0.03, 0.01), blushM, sx * 0.15, -0.06, 0.025)));
    const beak = mesh(new THREE.ConeGeometry(0.05, 0.12, 4), orange, 0, -0.07, 0.07); beak.rotation.x = Math.PI / 2; beak.rotation.y = Math.PI / 4; F.add(beak);
    return eyes;
  };
  const eyes = [...faceFor(-0.21, -1), ...faceFor(0.21, 1)]; // faces outward (back view) and peeks forward over your head
  const tuft = mesh(new THREE.ConeGeometry(0.05, 0.12, 4), bodyM, 0, 0.26, 0); H.add(tuft);
  const flippers = [-1, 1].map(sx => { const f = new THREE.Group(); f.position.set(sx * 0.33, 0.15, 0); P.add(f);
    const w = mesh(new RoundedBoxGeometry(0.08, 0.42, 0.24, 2, 0.04), bodyM, sx * 0.03, -0.2, 0); f.add(w); return f; });
  [-1, 1].forEach(sx => rb(0.16, 0.06, 0.2, orange, sx * 0.14, -0.38, -0.06, 0.03)); // feet
  const scarfM = std('#7fd8ff', { roughness: 0.9 }); rb(0.6, 0.08, 0.42, scarfM, 0, 0.37, 0, 0.03); // icy scarf between head and body
  const strapM = std(tint(color, '#000000', 0.3)); [-1, 1].forEach(sx => g.add(mesh(new THREE.BoxGeometry(0.07, 0.7, 0.03), strapM, sx * 0.22, 0.05, 0.27)));
  const notes = stream(P, 6, '#bfe8ff', 0.08, p => { p.d.x = (Math.random() - 0.5) * 0.4; }, (p, L) => { p.s.position.set(p.d.x + Math.sin(L * 7) * 0.05, 0.85 + L * 0.4, -0.1); p.s.material.opacity = 0.85 * Math.sin(L * Math.PI); });
  let t = 0;
  g.userData.tick = (dt) => { t += dt; const w = Math.max(0, Math.sin(t * 1.3)) ** 6;
    flippers[0].rotation.z = -0.15 - w * (0.6 + Math.sin(t * 18) * 0.4); flippers[1].rotation.z = 0.15 + Math.sin(t * 2.2) * 0.08;
    P.rotation.z = Math.sin(t * 2.2) * 0.06; P.position.y = 0.05 + Math.abs(Math.sin(t * 2.2)) * 0.02;
    H.rotation.y = Math.sin(t * 0.9) * 0.25; H.rotation.z = -0.18 + Math.sin(t * 1.7) * 0.06;
    const bl = (t % 2.8) < 0.12 ? 0.12 : 1; eyes.forEach(e => e.scale.y = bl); notes.tick(dt, 0.4); };
  g.userData.setColor = (c) => { bodyM.color.set(c); strapM.color.set(tint(c, '#000000', 0.3)); };
  return { bone: 'torso', object: g };
}
function ppPhotoCamera(color) {
  const g = new THREE.Group();
  const cordM = std('#2a3550', { roughness: 0.6 });
  for (let i = 0; i <= 14; i++) { const a = Math.PI * (i / 14); g.add(mesh(new THREE.SphereGeometry(0.014, 6, 4), cordM, Math.cos(a) * 0.28, 0.42 - Math.sin(a) * 0.14, 0.04 + Math.sin(a) * 0.28)); }
  const C = new THREE.Group(); C.position.set(0, 0.22, 0.37); g.add(C);
  const bodyM = std(color, { roughness: 0.4 });
  C.add(mesh(new RoundedBoxGeometry(0.24, 0.15, 0.08, 3, 0.03), bodyM));
  const lens = mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.05, 18), std('#1a2440', { metalness: 0.4, roughness: 0.2 }), 0, 0, 0.06); lens.rotation.x = Math.PI / 2; C.add(lens);
  const glass = mesh(new THREE.CircleGeometry(0.035, 18), new THREE.MeshPhysicalMaterial({ color: '#8fd8ff', roughness: 0, iridescence: 1, emissive: '#3a8fff', emissiveIntensity: 0.3 }), 0, 0, 0.086); C.add(glass);
  C.add(mesh(new THREE.BoxGeometry(0.05, 0.025, 0.03), std('#ff6a8a'), 0.07, 0.085, 0));
  const flash = glow('#ffffff', 0.05, 0); flash.position.set(-0.08, 0.05, 0.06); C.add(flash);
  const fl = mesh(new THREE.BoxGeometry(0.04, 0.025, 0.01), std('#e6f4ff', { emissive: '#ffffff', emissiveIntensity: 0.2 }), -0.08, 0.05, 0.041); C.add(fl);
  const stars = stream(C, 6, '#fff3a8', 0.05, p => { const a = Math.random() * 6.28; p.d = { x: Math.cos(a), y: Math.sin(a) }; }, () => {});
  let t = 0;
  g.userData.tick = (dt) => { t += dt; C.rotation.z = Math.sin(t * 1.8) * 0.08; const ph = t % 3.5, f = ph < 0.25 ? Math.sin(ph / 0.25 * Math.PI) : 0;
    flash.material.opacity = f; flash.scale.setScalar(0.05 + f * 0.5); fl.material.emissiveIntensity = 0.2 + f * 2; C.scale.setScalar(1 - f * 0.05);
    stars.ps.forEach(p => { const k = Math.min(1, ph / 0.6); p.s.position.set(-0.08 + p.d.x * k * 0.25, 0.05 + p.d.y * k * 0.25, 0.08); p.s.material.opacity = ph < 0.6 ? 0.9 * (1 - k) : 0; }); };
  g.userData.setColor = (c) => bodyM.color.set(c);
  return { bone: 'torso', object: g };
}

export const QOL_GAME_BUILDERS = {
  gd_boost_helmet: (_rc, c) => gdBoostHelmet(c), gd_drift_visor: (_rc, c) => gdDriftVisor(c), gd_magnet_scarf: (_rc, c) => gdMagnetScarf(c), gd_rocket_sled: (_rc, c) => gdRocketSled(c),
  ss_fort_helm: (_rc, c) => ssFortHelm(c), ss_war_paint: (_rc, c) => ssWarPaint(c), ss_ammo_bandolier: (_rc, c) => ssAmmoBandolier(c), ss_flag_banner: (_rc, c) => ssFlagBanner(c), ss_snowball_launcher: (_rc, c) => ssSnowballLauncher(c),
  pp_beanie_pompom: (_rc, c) => ppBeaniePompom(c), pp_cocoa_mug: (_rc, c) => ppCocoaMug(c), pp_pengu_backpack: (_rc, c) => ppPenguBackpack(c), pp_photo_camera: (_rc, c) => ppPhotoCamera(c),
};

// Preview framing [x, y, z, dist] for scripts/cosmetic-preview.html
export const QOL_GAME_PREVIEW_FOCUS = {
  gd_boost_helmet: [0, 2.7, -0.2, 3.0], gd_drift_visor: [0, 2.4, 0.15, 2.4], gd_magnet_scarf: [0, 1.75, 0.25, 2.4], gd_rocket_sled: [0, 1.4, -0.5, 4.2],
  ss_fort_helm: [0, 2.85, 0, 2.8], ss_war_paint: [0, 2.3, 0.2, 1.9], ss_ammo_bandolier: [0, 1.4, 0.2, 3.2], ss_flag_banner: [0, 2.0, -0.4, 5.0], ss_snowball_launcher: [0.75, 0.9, 0.7, 2.6],
  pp_beanie_pompom: [0, 2.7, 0, 2.6], pp_cocoa_mug: [0.75, 0.95, 0.35, 2.2], pp_pengu_backpack: [0, 1.8, -0.4, 3.4], pp_photo_camera: [0, 1.65, 0.3, 2.2],
};
