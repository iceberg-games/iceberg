// FINAL showcase cosmetics, lane 2 (Cosmetics 2): fs_aurora_lantern_staff (hand).
// Same builder contract as BUILDERS in avatar.js: returns { bone, object } with userData.tick / setColor.
// Authored in classic space at the right hand (bodyTypes 'handR' anchor; grip at the classic arm end).
// The anchor scales x/z with arm width per body type; the staff undoes that on its own group so the
// carved shaft and lantern keep their proportions on every body (the grip offset still follows the arm).
// Perf: shared geometries + canvas textures (module-level, built once), ~2k tris, 26 pooled sprites,
// no lights, no per-frame allocation. userData.dispose() frees the per-instance materials.
import * as THREE from 'three';

// ---------- palettes: each preset is its own look, not a hue swap ----------
const PALETTES = {
  '#3fe0c8': { // Aurora Teal: pale glacier ice, frost-silver trim, teal->violet borealis
    ice: '#c6f6ff', iceGlow: '#2fb8c8', trim: '#e9f6ff', trimRough: 0.25, metal: 0.35, wrap: '#1d4a5a',
    core: '#9ffff0', glow: '#3fe0c8', halo: '#6fd8ff', ribA: '#3fffc0', ribB: '#9a7dff', flake: '#ffffff', mote: '#bffff4' },
  '#ff8fb8': { // Rose Dawn: blush ice, pale-gold dawn trim, pink->peach sunrise
    ice: '#ffe3ee', iceGlow: '#ff8fb8', trim: '#ffe0a6', trimRough: 0.35, metal: 0.15, wrap: '#7a2f4f',
    core: '#ffd0e2', glow: '#ff7fae', halo: '#ffb08a', ribA: '#ff7fbf', ribB: '#ffc27a', flake: '#fff4f8', mote: '#ffd8b0' },
  '#9a6bff': { // Violet Night: lavender ice, dark night-steel trim, violet->deep-blue night sky with star motes
    ice: '#cfc6ff', iceGlow: '#7a4dff', trim: '#3b3270', trimRough: 0.35, metal: 0.5, wrap: '#1b1640',
    core: '#e2d4ff', glow: '#9a6bff', halo: '#5a7dff', ribA: '#b07dff', ribB: '#3f8cff', flake: '#e6e0ff', mote: '#fff6c8' },
  '#ffb84a': { // Ember Gold: warm amber ice, gold trim, gold->ember red with rising embers
    ice: '#fff0d2', iceGlow: '#ff9a2a', trim: '#f0b84a', trimRough: 0.3, metal: 0.3, wrap: '#5a2a14',
    core: '#fff1b8', glow: '#ffb84a', halo: '#ff7a3a', ribA: '#ffd24a', ribB: '#ff5a3a', flake: '#fff3d6', mote: '#ff9a4a' },
};
const DEFAULT_COLOR = '#3fe0c8';
const _c = new THREE.Color(), _hsl = { h: 0, s: 0, l: 0 };
const hslHex = (h, s, l) => '#' + _c.setHSL(((h % 1) + 1) % 1, Math.min(1, s), Math.min(1, l)).getHexString();
function paletteFor(hex) {
  const key = new THREE.Color(hex || DEFAULT_COLOR).getHexString();
  const hit = PALETTES['#' + key]; if (hit) return hit;
  new THREE.Color('#' + key).getHSL(_hsl); const { h, s } = _hsl;  // custom color: derive a full palette from its hue
  return { ice: hslHex(h, 0.7 * s + 0.2, 0.88), iceGlow: hslHex(h, s, 0.55), trim: hslHex(h, 0.25, 0.9), trimRough: 0.3, metal: 0.35, wrap: hslHex(h, 0.5, 0.2),
    core: hslHex(h, 0.9, 0.86), glow: '#' + key, halo: hslHex(h + 0.06, 0.9, 0.65), ribA: hslHex(h - 0.05, 1, 0.62), ribB: hslHex(h + 0.18, 1, 0.65),
    flake: '#ffffff', mote: hslHex(h, 0.8, 0.85) };
}

// ---------- shared textures (built once) ----------
let _tex = null;
function textures() {
  if (_tex) return _tex;
  const cv = (w, h, draw) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; };
  const glow = cv(64, 64, (g) => { const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,0.55)'); gr.addColorStop(0.6, 'rgba(255,255,255,0.12)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); });
  const flake = cv(64, 64, (g) => {
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 30); gr.addColorStop(0, 'rgba(255,255,255,0.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    g.strokeStyle = '#fff'; g.lineCap = 'round'; g.translate(32, 32);
    for (let i = 0; i < 6; i++) { g.lineWidth = 4; g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -25); g.stroke(); g.lineWidth = 3;
      g.beginPath(); g.moveTo(0, -12); g.lineTo(-7, -19); g.moveTo(0, -12); g.lineTo(7, -19); g.moveTo(0, -19); g.lineTo(-4, -24); g.moveTo(0, -19); g.lineTo(4, -24); g.stroke(); g.rotate(Math.PI / 3); }
  });
  // ribbon: soft across the width, fading at both ends, with faint vertical aurora streaks
  const ribbon = cv(128, 32, (g, w, h) => { const im = g.createImageData(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const u = x / (w - 1), v = y / (h - 1);
      const across = Math.pow(Math.sin(v * Math.PI), 0.9) * (0.75 + 0.25 * Math.sin(v * 9 + u * 3)), ends = Math.pow(Math.sin(u * Math.PI), 0.8), streak = 0.75 + 0.25 * Math.sin(u * 47) * Math.sin(u * 13 + 1);
      const a = Math.max(0, across * ends * streak), i = (y * w + x) * 4; im.data[i] = im.data[i + 1] = im.data[i + 2] = 255; im.data[i + 3] = a * 255; }
    g.putImageData(im, 0, 0); });
  _tex = { glow, flake, ribbon }; return _tex;
}

// ---------- shared geometries (built once) ----------
let _geo = null;
function geometries() {
  if (_geo) return _geo;
  // Faceted, spiral-carved ice shaft: 7-sided tapered prism twisted along its length (flat shaded).
  const shaft = new THREE.CylinderGeometry(0.044, 0.062, 1.52, 7, 16, false);
  { const p = shaft.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i), a = (y + 0.76) * 2.8, x = p.getX(i), z = p.getZ(i);
      const bulge = 1 + 0.07 * Math.sin((y + 0.76) * 12);   // subtle carved swells between rings
      p.setXYZ(i, (x * Math.cos(a) - z * Math.sin(a)) * bulge, y, (x * Math.sin(a) + z * Math.cos(a)) * bulge); } shaft.computeVertexNormals(); }
  shaft.translate(0, 0.76 - 0.3, 0); // spans y -0.3 .. 1.22 (grip at 0)
  const ring = new THREE.TorusGeometry(0.07, 0.016, 5, 14); ring.rotateX(Math.PI / 2);
  const band = new THREE.CylinderGeometry(0.076, 0.076, 0.035, 7);
  const grip = new THREE.CylinderGeometry(0.068, 0.068, 0.3, 8, 1, true);
  const wrapRing = new THREE.TorusGeometry(0.07, 0.012, 4, 12);
  const foot = new THREE.ConeGeometry(0.06, 0.17, 6); foot.rotateX(Math.PI);
  const shard = new THREE.OctahedronGeometry(0.05, 0);
  const collar = new THREE.CylinderGeometry(0.085, 0.045, 0.12, 7);
  const guardFin = new THREE.ConeGeometry(0.035, 0.16, 4);
  // cradle prong: rises out of the collar, swings out around the lantern, hooks back in over it
  const prongPath = new THREE.CatmullRomCurve3([new THREE.Vector3(0.04, 0, 0), new THREE.Vector3(0.12, 0.1, 0), new THREE.Vector3(0.17, 0.26, 0), new THREE.Vector3(0.15, 0.42, 0), new THREE.Vector3(0.08, 0.52, 0)]);
  const prong = new THREE.TubeGeometry(prongPath, 14, 0.017, 5, false);
  { const p = prong.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i), k = 1 - 0.55 * (y / 0.52); p.setXYZ(i, 0.04 + (p.getX(i) - 0.04) * 1, y, p.getZ(i) * k); } }
  const prongTip = new THREE.ConeGeometry(0.022, 0.09, 4);
  // lantern: open hex glass + pointed caps + edge struts; inner crystal
  const glass = new THREE.CylinderGeometry(0.1, 0.085, 0.2, 6, 1, true);
  const capTop = new THREE.ConeGeometry(0.115, 0.1, 6); const capBot = new THREE.ConeGeometry(0.1, 0.07, 6); capBot.rotateX(Math.PI);
  const strut = new THREE.BoxGeometry(0.014, 0.21, 0.014);
  const finial = new THREE.OctahedronGeometry(0.03, 0);
  const crystal = new THREE.OctahedronGeometry(0.06, 0);
  // aurora ribbon: a wavy partial ring (UV u along length), wrapped around the lantern
  const ribbon = new THREE.BufferGeometry(); { const N = 28, pos = [], uv = [], idx = [], col = [];
    for (let i = 0; i <= N; i++) { const u = i / N, a = u * Math.PI * 1.25, r = 0.24 + 0.02 * Math.sin(u * 9), y = 0.05 * Math.sin(u * 6.5), hw = 0.075 * (0.55 + 0.45 * Math.sin(u * Math.PI));
      pos.push(Math.cos(a) * r, y - hw, Math.sin(a) * r, Math.cos(a) * r, y + hw, Math.sin(a) * r); uv.push(u, 0, u, 1); col.push(1, 1, 1, 1, 1, 1);
      if (i < N) { const b = i * 2; idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2); } }
    ribbon.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); ribbon.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    ribbon.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); ribbon.setIndex(idx); }
  _geo = { shaft, ring, band, grip, wrapRing, foot, shard, collar, guardFin, prong, prongTip, glass, capTop, capBot, strut, finial, crystal, ribbon };
  return _geo;
}

const ADD = THREE.AdditiveBlending;
function buildAuroraLanternStaff(color) {
  const G = geometries(), T = textures();
  let P = paletteFor(color);
  const mats = [];
  const M = (m) => { mats.push(m); return m; };
  const mesh = (geo, mat, x = 0, y = 0, z = 0, parent) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; parent.add(m); return m; };

  const iceM = M(new THREE.MeshStandardMaterial({ color: P.ice, emissive: P.iceGlow, emissiveIntensity: 0.18, roughness: 0.18, metalness: 0.05, flatShading: true }));
  const trimM = M(new THREE.MeshStandardMaterial({ color: P.trim, roughness: P.trimRough, metalness: P.metal, flatShading: true }));
  const wrapM = M(new THREE.MeshStandardMaterial({ color: P.wrap, roughness: 0.85 }));
  const glassM = M(new THREE.MeshStandardMaterial({ color: P.ice, emissive: P.glow, emissiveIntensity: 0.35, roughness: 0.05, transparent: true, opacity: 0.38, side: THREE.DoubleSide, depthWrite: false, flatShading: true }));
  const crystalM = M(new THREE.MeshBasicMaterial({ color: P.core }));
  const tipM = M(new THREE.MeshStandardMaterial({ color: P.core, emissive: P.glow, emissiveIntensity: 0.9, roughness: 0.1, flatShading: true }));
  const spriteM = (map, c, op) => M(new THREE.SpriteMaterial({ map, color: c, transparent: true, opacity: op, depthWrite: false, blending: ADD }));

  // g: hand anchor offset (+ undo anchor's non-uniform scale); S: the tilted staff itself
  const g = new THREE.Group(); g.position.set(0, -0.9, 0.31);
  const S = new THREE.Group(); S.rotation.set(0.12, 0, -0.1); g.add(S);

  // shaft + carved bands. Glow rings are "runes" that carry an energy wave up to the lantern.
  mesh(G.shaft, iceM, 0, 0, 0, S);
  const runeYs = [0.3, 0.48, 0.66, 0.84, 1.02], runes = runeYs.map((y, i) => {
    const m = M(new THREE.MeshStandardMaterial({ color: P.core, emissive: P.glow, emissiveIntensity: 0.6, roughness: 0.2, flatShading: true }));
    const r = mesh(G.ring, m, 0, y, 0, S); r.scale.setScalar(0.92 - i * 0.05); r.rotation.y = i * 0.6; return { m, y };
  });
  [0.18, 1.14].forEach(y => mesh(G.band, trimM, 0, y, 0, S));
  // grip: leather wrap with diagonal lashings, ice cross-guard fins above the hand
  mesh(G.grip, wrapM, 0, 0.0, 0, S);
  for (let i = 0; i < 6; i++) { const w = mesh(G.wrapRing, trimM, 0, -0.12 + i * 0.048, 0, S); w.rotation.set(Math.PI / 2 + 0.32, 0, 0); }
  [-1, 1].forEach(s => { const f = mesh(G.guardFin, iceM, s * 0.09, 0.21, 0, S); f.rotation.z = -s * 1.0; f.scale.set(1, 1, 0.6); });
  // foot: banded icicle point
  mesh(G.band, trimM, 0, -0.27, 0, S).scale.set(0.85, 1, 0.85);
  mesh(G.foot, iceM, 0, -0.37, 0, S);
  // head: collar, three cradle prongs with glowing shard tips, small side shards
  const H = new THREE.Group(); H.position.y = 1.25; H.scale.setScalar(1.22); S.add(H);
  mesh(G.collar, trimM, 0, 0, 0, H);
  for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2 + Math.PI / 2; // one prong behind, two framing the front
    const pr = mesh(G.prong, iceM, 0, 0.03, 0, H); pr.rotation.y = a;
    const tip = mesh(G.prongTip, tipM, Math.cos(a) * 0.08, 0.6, -Math.sin(a) * 0.08, H); tip.rotation.set(-Math.sin(a) * 0.45, 0, -Math.cos(a) * 0.45);
    const sh = mesh(G.shard, iceM, Math.cos(a + Math.PI / 3) * 0.075, 0.02, -Math.sin(a + Math.PI / 3) * 0.075, H); sh.scale.set(0.6, 1.5, 0.6); sh.rotation.set(-Math.sin(a + Math.PI / 3) * 0.6, 0, -Math.cos(a + Math.PI / 3) * 0.6);
  }
  // floating lantern (no contact with prongs): bobs, turns, pulses
  const LC = new THREE.Group(); LC.position.y = 0.3; H.add(LC);   // lantern centre (orbit pivot)
  const L = new THREE.Group(); LC.add(L);
  mesh(G.glass, glassM, 0, 0, 0, L);
  mesh(G.capTop, trimM, 0, 0.15, 0, L); mesh(G.capBot, trimM, 0, -0.135, 0, L);
  for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; const s = mesh(G.strut, trimM, Math.cos(a) * 0.093, 0, Math.sin(a) * 0.093, L); s.rotation.y = -a; s.rotation.z = Math.cos(a) * 0.035; }
  mesh(G.finial, tipM, 0, 0.225, 0, L).scale.set(0.8, 1.6, 0.8);
  mesh(G.finial, tipM, 0, -0.19, 0, L).scale.set(0.6, 1.3, 0.6);
  const crystal = mesh(G.crystal, crystalM, 0, 0, 0, L); crystal.scale.set(0.75, 1.45, 0.75); crystal.castShadow = false;
  const coreGlow = new THREE.Sprite(spriteM(T.glow, P.glow, 0.8)); coreGlow.scale.setScalar(0.34); LC.add(coreGlow);
  const halo = new THREE.Sprite(spriteM(T.glow, P.halo, 0.35)); halo.scale.setScalar(0.95); LC.add(halo);

  // aurora ribbons: normal-blended (reads on bright snow too), vertex-coloured A->B, slowly circling the lantern on tilted planes
  const ribM = M(new THREE.MeshBasicMaterial({ map: T.ribbon, vertexColors: true, transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide }));
  const ribGeo = G.ribbon.clone(); // per-instance colours only (positions shared in shape)
  const paintRibbon = () => { const col = ribGeo.attributes.color, a = new THREE.Color(P.ribA), b = new THREE.Color(P.ribB), n = col.count / 2;
    for (let i = 0; i < n; i++) { _c.copy(a).lerp(b, i / (n - 1)); col.setXYZ(i * 2, _c.r, _c.g, _c.b); col.setXYZ(i * 2 + 1, _c.r, _c.g, _c.b); } col.needsUpdate = true; };
  paintRibbon();
  const ribbons = [[0.35, 0, 1], [-0.45, 2.2, -0.8]].map(([tilt, phase, dir]) => { const p = new THREE.Group(); p.rotation.set(tilt, 0, tilt * 0.6); LC.add(p);
    const r = new THREE.Mesh(ribGeo, ribM); r.rotation.y = phase; r.renderOrder = 3; p.add(r); return { r, phase, dir }; });

  // pooled particles: 10 orbiting snowflakes + 8 rising motes (embers / stars / sparkles per preset)
  const flakes = [], motes = [];
  for (let i = 0; i < 10; i++) { const s = new THREE.Sprite(spriteM(T.flake, P.flake, 0.9)); LC.add(s);
    flakes.push({ s, a: i / 10 * Math.PI * 2, r: 0.2 + (i % 3) * 0.05, y: ((i * 7) % 10) / 10 * 0.3 - 0.15, sp: 0.35 + (i % 4) * 0.06, sz: 0.045 + (i % 3) * 0.012, ph: i * 1.7 }); }
  for (let i = 0; i < 8; i++) { const s = new THREE.Sprite(spriteM(T.glow, P.mote, 0)); LC.add(s);
    motes.push({ s, life: i / 8, a: i * 2.4, r: 0.05 + (i % 3) * 0.03 }); }

  let t = 0;
  g.userData.tick = (dt = 0) => {
    t += dt;
    const p = g.parent; if (p) g.scale.set(1 / (p.scale.x || 1), 1, 1 / (p.scale.z || 1));
    const pulse = 0.5 + 0.5 * Math.sin(t * 2.4);            // ~2.6 s breathing pulse
    const pulse2 = pulse * pulse * (3 - 2 * pulse);
    LC.position.y = 0.3 + Math.sin(t * 1.5) * 0.025;
    L.rotation.y = t * 0.45; L.rotation.z = Math.sin(t * 1.1) * 0.05;
    crystal.rotation.y = -t * 1.2; crystal.scale.set(0.75 + pulse2 * 0.08, 1.45 + pulse2 * 0.12, 0.75 + pulse2 * 0.08);
    glassM.emissiveIntensity = 0.25 + pulse2 * 0.45; tipM.emissiveIntensity = 0.6 + pulse2 * 0.8;
    coreGlow.scale.setScalar(0.28 + pulse2 * 0.1); coreGlow.material.opacity = 0.55 + pulse2 * 0.3;
    halo.scale.setScalar(0.7 + pulse2 * 0.2); halo.material.opacity = 0.16 + pulse2 * 0.14;
    iceM.emissiveIntensity = 0.14 + pulse2 * 0.1;
    // energy wave climbs the rune rings toward the lantern every ~2.6 s
    for (let i = 0; i < runes.length; i++) { const w = Math.sin(t * 2.4 - i * 0.7); runes[i].m.emissiveIntensity = 0.35 + Math.max(0, w) * 1.1; }
    for (const rb of ribbons) rb.r.rotation.y = rb.phase + t * 0.35 * rb.dir;
    ribM.opacity = 0.75 + 0.18 * Math.sin(t * 0.9);
    for (const f of flakes) { const a = f.a + t * f.sp; f.s.position.set(Math.cos(a) * f.r, f.y + Math.sin(t * 0.8 + f.ph) * 0.05, Math.sin(a) * f.r);
      f.s.material.rotation = t * 0.6 + f.ph; f.s.scale.setScalar(f.sz); f.s.material.opacity = 0.55 + 0.4 * Math.sin(t * 1.3 + f.ph); }
    for (const m of motes) { m.life += dt * 0.32; if (m.life >= 1) m.life -= 1; const L2 = m.life, a = m.a + L2 * 2.5;
      m.s.position.set(Math.cos(a) * (m.r + L2 * 0.12), 0.12 + L2 * 0.5, Math.sin(a) * (m.r + L2 * 0.12));
      m.s.scale.setScalar(0.05 * (1 - L2) + 0.015); m.s.material.opacity = Math.sin(L2 * Math.PI) * 0.85; }
  };
  g.userData.setColor = (c) => { P = paletteFor(c);
    iceM.color.set(P.ice); iceM.emissive.set(P.iceGlow); trimM.color.set(P.trim); trimM.roughness = P.trimRough; trimM.metalness = P.metal; wrapM.color.set(P.wrap);
    glassM.color.set(P.ice); glassM.emissive.set(P.glow); crystalM.color.set(P.core); tipM.color.set(P.core); tipM.emissive.set(P.glow);
    runes.forEach(r => { r.m.color.set(P.core); r.m.emissive.set(P.glow); });
    coreGlow.material.color.set(P.glow); halo.material.color.set(P.halo); flakes.forEach(f => f.s.material.color.set(P.flake)); motes.forEach(m => m.s.material.color.set(P.mote));
    paintRibbon(); };
  g.userData.dispose = () => { mats.forEach(m => m.dispose()); ribGeo.dispose(); };
  g.userData.tick(0);
  return { bone: 'armR', object: g };
}

export const FINAL_SHOWCASE_LANE2_BUILDERS = {
  fs_aurora_lantern_staff: (_rc, c) => buildAuroraLanternStaff(c),
};

// Preview framing [x, y, z, dist] for scripts/cosmetic-preview.html (whole staff, foot to lantern)
export const FINAL_SHOWCASE_LANE2_PREVIEW_FOCUS = {
  fs_aurora_lantern_staff: [0.6, 1.95, 0.3, 4.8],
};
