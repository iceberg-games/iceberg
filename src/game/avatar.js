// Blocky Roblox-style avatar + 3D cosmetics. Shared across every game.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { COSMETIC_BY_ID } from '../data/cosmetics.js';

const DEFAULT = { skin: '#f5cd30', torso: '#3d7bd9', legs: '#4a9e4a' };

// Mouth frames for talking: 0 = neutral smile, 1 = half open, 2 = open.
function drawMouth(g, frame, cx = 64, cy = 70) {
  g.fillStyle = '#1b1b1b'; g.strokeStyle = '#1b1b1b'; g.lineWidth = 7; g.lineCap = 'round';
  if (frame === 0) { g.beginPath(); g.arc(cx, cy, 26, 0.2 * Math.PI, 0.8 * Math.PI); g.stroke(); return; }
  const h = frame === 1 ? 8 : 15;
  g.beginPath(); g.ellipse(cx, cy + 16, 17, h, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#b8484f';
  g.beginPath(); g.ellipse(cx, cy + 16 + h * 0.45, 10, h * 0.45, 0, 0, Math.PI * 2); g.fill();
}
function drawFace(g, frame = 0) {
  g.fillStyle = '#fff'; g.fillRect(0, 0, 128, 128);
  g.fillStyle = '#1b1b1b';
  g.beginPath(); g.ellipse(42, 52, 7, 11, 0, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.ellipse(86, 52, 7, 11, 0, 0, Math.PI * 2); g.fill();
  drawMouth(g, frame);
}
function faceTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  drawFace(g, 0);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  t.userData = { ctx: g };
  return t;
}

const std = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, ...extra });
function mesh(geo, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; return m;
}

// ---------- cosmetic model builders ----------
// Each returns { bone: 'head'|'torso'|'armR', object }
const BUILDERS = {
  earmuffs(_rc, color) { return buildEarmuffs(color); },
  snowglobe_pack(_rc, color) { return buildSnowGlobe(color); },
  cocoa_mug(_rc, color) { return buildCocoaMug(color); },
  tornado_hat(_rc, color) { return buildTornadoHat(color); },
  lightning_back(_rc, color) { return buildLightningBack(color); },
  meteor_pet(_rc, color) { return buildMeteorPet(color); },
  blizzard_hat(_rc, color) { return buildBlizzardHat(color); },
  owl_hood(_rc, color) { return buildOwlHood(color); },
  frost_specs(_rc, color) { return buildFrostSpecs(color); },
  cable_sweater(_rc, color) { return buildSweater(color); },
  frost_lantern(_rc, color) { return buildFrostLantern(color); },
  penguin_pal(_rc, color) { return buildPenguinPal(color); },
  cap() {
    const g = new THREE.Group(), m = std('#d83a3f');
    g.add(mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.2, 20, 1, false, 0, Math.PI * 2), m, 0, 0.72, 0));
    g.add(mesh(new THREE.SphereGeometry(0.34, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), m, 0, 0.8, 0));
    g.add(mesh(new THREE.BoxGeometry(0.5, 0.04, 0.35), m, 0, 0.64, 0.42));
    return { bone: 'head', object: g };
  },
  beanie() {
    const g = new THREE.Group();
    g.add(mesh(new THREE.SphereGeometry(0.36, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), std('#3f8fd0', { roughness: 1 }), 0, 0.62, 0));
    g.add(mesh(new THREE.CylinderGeometry(0.37, 0.37, 0.14, 20), std('#ffffff', { roughness: 1 }), 0, 0.64, 0));
    g.add(mesh(new THREE.SphereGeometry(0.11, 12, 8), std('#ffffff', { roughness: 1 }), 0, 1.0, 0));
    return { bone: 'head', object: g };
  },
  partyhat() {
    const g = new THREE.Group();
    g.add(mesh(new THREE.ConeGeometry(0.26, 0.6, 20), std('#e04fd0'), 0, 0.92, 0));
    g.add(rotated(mesh(new THREE.TorusGeometry(0.2, 0.03, 6, 20), std('#f5c542'), 0, 0.78, 0), 'x', Math.PI / 2));
    g.add(mesh(new THREE.SphereGeometry(0.07, 10, 8), std('#f5c542'), 0, 1.24, 0));
    return { bone: 'head', object: g };
  },
  tophat() {
    const g = new THREE.Group(), m = std('#1d1d22', { roughness: 0.4 });
    g.add(mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.04, 24), m, 0, 0.64, 0));
    g.add(mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.55, 24), m, 0, 0.92, 0));
    g.add(mesh(new THREE.CylinderGeometry(0.305, 0.305, 0.08, 24), std('#c0392b'), 0, 0.72, 0));
    return { bone: 'head', object: g };
  },
  icecrown() {
    const g = new THREE.Group();
    const ice = std('#aee8ff', { roughness: 0.05, metalness: 0.2, emissive: '#2a7fb0', emissiveIntensity: 0.35, transparent: true, opacity: 0.9, flatShading: true });
    g.add(mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.12, 8, 1, true), ice, 0, 0.68, 0));
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2, h = i % 2 ? 0.25 : 0.42;
      const c = mesh(new THREE.ConeGeometry(0.07, h, 5), ice, Math.sin(a) * 0.34, 0.74 + h / 2, Math.cos(a) * 0.34);
      g.add(c);
    }
    return { bone: 'head', object: g };
  },
  crown() {
    const g = new THREE.Group(), gold = std('#f2c230', { metalness: 0.9, roughness: 0.25 });
    g.add(mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.16, 16, 1, true), gold, 0, 0.7, 0));
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      g.add(mesh(new THREE.ConeGeometry(0.07, 0.2, 4), gold, Math.sin(a) * 0.34, 0.86, Math.cos(a) * 0.34));
      g.add(mesh(new THREE.SphereGeometry(0.04, 8, 6), std(i % 2 ? '#e74c3c' : '#3498db', { metalness: 0.3, roughness: 0.1 }), Math.sin(a) * 0.37, 0.7, Math.cos(a) * 0.37));
    }
    return { bone: 'head', object: g };
  },
  shades() {
    const g = new THREE.Group(), m = std('#111', { roughness: 0.1, metalness: 0.5 });
    g.add(mesh(new THREE.BoxGeometry(0.22, 0.12, 0.04), m, -0.14, 0.36, 0.33));
    g.add(mesh(new THREE.BoxGeometry(0.22, 0.12, 0.04), m, 0.14, 0.36, 0.33));
    g.add(mesh(new THREE.BoxGeometry(0.64, 0.03, 0.03), m, 0, 0.4, 0.33));
    return { bone: 'head', object: g };
  },
  goggles() {
    const g = new THREE.Group();
    g.add(mesh(new THREE.BoxGeometry(0.66, 0.1, 0.66), std('#222'), 0, 0.38, 0));
    g.add(mesh(new THREE.BoxGeometry(0.52, 0.2, 0.06), std('#ff9f2e', { metalness: 0.6, roughness: 0.1, emissive: '#7a3a00', emissiveIntensity: 0.4 }), 0, 0.38, 0.34));
    return { bone: 'head', object: g };
  },
  scarf() {
    const g = new THREE.Group(), red = std('#d83a3f', { roughness: 1 }), white = std('#fff', { roughness: 1 });
    const ring = mesh(new THREE.TorusGeometry(0.33, 0.1, 8, 20), red, 0, 0.5, 0); ring.rotation.x = Math.PI / 2; ring.scale.set(1.3, 0.9, 1);
    g.add(ring);
    g.add(mesh(new THREE.BoxGeometry(0.2, 0.55, 0.07), red, 0.22, 0.2, 0.3));
    g.add(mesh(new THREE.BoxGeometry(0.205, 0.08, 0.075), white, 0.22, 0.1, 0.3));
    return { bone: 'torso', object: g };
  },
  backpack() {
    const g = new THREE.Group();
    g.add(mesh(new THREE.BoxGeometry(0.7, 0.75, 0.3), std('#c96a2b'), 0, 0, -0.4));
    g.add(mesh(new THREE.BoxGeometry(0.5, 0.3, 0.12), std('#a85620'), 0, -0.15, -0.6));
    return { bone: 'torso', object: g };
  },
  icewings() {
    const g = new THREE.Group();
    const shape = new THREE.Shape();
    shape.moveTo(0, 0); shape.quadraticCurveTo(0.6, 0.9, 1.4, 0.9); shape.lineTo(1.1, 0.4); shape.lineTo(1.3, 0.1);
    shape.lineTo(0.9, -0.1); shape.lineTo(1.0, -0.5); shape.quadraticCurveTo(0.4, -0.4, 0, 0);
    const mat = std('#cdf1ff', { side: THREE.DoubleSide, transparent: true, opacity: 0.8, emissive: '#4fb4e6', emissiveIntensity: 0.35, roughness: 0.1 });
    const geo = new THREE.ShapeGeometry(shape);
    const L = new THREE.Mesh(geo, mat), R = new THREE.Mesh(geo, mat);
    const pl = new THREE.Group(), pr = new THREE.Group();
    pl.position.set(-0.15, 0.15, -0.3); pr.position.set(0.15, 0.15, -0.3);
    R.position.x = 0; L.scale.x = -1; pl.add(L); pr.add(R);
    g.add(pl, pr);
    g.userData.wings = [pl, pr];
    return { bone: 'torso', object: g };
  },
  sword() {
    const g = new THREE.Group();
    g.add(mesh(new THREE.BoxGeometry(0.08, 0.3, 0.08), std('#5a3a20'), 0, 0, 0));
    g.add(mesh(new THREE.BoxGeometry(0.4, 0.06, 0.1), std('#c9a227', { metalness: 0.8 }), 0, 0.16, 0));
    g.add(mesh(new THREE.BoxGeometry(0.1, 1.1, 0.03), std('#bfe9ff', { metalness: 0.7, roughness: 0.15, emissive: '#3a8fd0', emissiveIntensity: 0.3 }), 0, 0.74, 0));
    g.rotation.x = Math.PI / 2; g.position.set(0, -0.95, 0.1);
    return { bone: 'armR', object: g };
  },
  pickaxe() {
    const g = new THREE.Group();
    g.add(mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.0, 8), std('#7a5230'), 0, 0.35, 0));
    const head = mesh(new THREE.BoxGeometry(0.7, 0.1, 0.08), std('#9fdcff', { metalness: 0.6, roughness: 0.2 }), 0, 0.82, 0);
    g.add(head);
    g.rotation.x = Math.PI / 2; g.position.set(0, -0.95, 0.1);
    return { bone: 'armR', object: g };
  },
  icerocket(colors) {
    const g = new THREE.Group();
    const body = std(colors.body, { metalness: 0.5, roughness: 0.25 });
    const fins = std(colors.fins, { metalness: 0.3, roughness: 0.4 });
    const trim = std(colors.trim, { emissive: colors.trim, emissiveIntensity: 0.5, roughness: 0.2 });
    const r = new THREE.Group(); r.position.set(0, -0.05, -0.5);
    r.add(mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.8, 18), body, 0, 0, 0));
    r.add(mesh(new THREE.ConeGeometry(0.2, 0.35, 18), trim, 0, 0.57, 0));
    r.add(rotated(mesh(new THREE.TorusGeometry(0.2, 0.03, 6, 18), trim, 0, 0.25, 0), 'x', Math.PI / 2));
    r.add(rotated(mesh(new THREE.TorusGeometry(0.2, 0.03, 6, 18), trim, 0, -0.2, 0), 'x', Math.PI / 2));
    r.add(mesh(new THREE.CylinderGeometry(0.12, 0.17, 0.16, 14), std('#5b6b7a', { metalness: 0.9, roughness: 0.3 }), 0, -0.48, 0));
    for (let i = 0; i < 4; i++) {
      const f = mesh(new THREE.BoxGeometry(0.03, 0.32, 0.22), fins, 0, -0.3, 0);
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      f.position.set(Math.sin(a) * 0.24, -0.3, Math.cos(a) * 0.24); f.rotation.y = a;
      r.add(f);
    }
    // straps
    g.add(mesh(new THREE.BoxGeometry(1.02, 0.08, 0.54), std('#333'), 0, 0.25, 0));
    g.add(mesh(new THREE.BoxGeometry(1.02, 0.08, 0.54), std('#333'), 0, -0.25, 0));
    for (const x of [-0.28, 0.28]) { // shoulder straps
      g.add(mesh(new THREE.BoxGeometry(0.1, 0.03, 0.54), std('#333'), x, 0.505, 0));
      g.add(mesh(new THREE.BoxGeometry(0.1, 0.3, 0.03), std('#333'), x, 0.36, 0.265));
    }
    g.add(r);
    g.userData.nozzle = new THREE.Object3D(); g.userData.nozzle.position.set(0, -0.6, -0.5); g.add(g.userData.nozzle);
    g.userData.mats = { body, fins, trim };
    return { bone: 'torso', object: g };
  },
};

// ---------- customizable winter cosmetics ----------
const rotated = (m, axis, v) => { m.rotation[axis] = v; return m; };
const _tint = (hex, toward, t) => new THREE.Color(hex).lerp(new THREE.Color(toward), t);

// Greyscale knit pattern (rows of V stitches) used as map + bump.
let _knitTex = null;
function knitTexture() {
  if (_knitTex) return _knitTex;
  const c = document.createElement('canvas'); c.width = 64; c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#d8d8d8'; g.fillRect(0, 0, 64, 64);
  for (let row = 0; row < 4; row++) for (let col = 0; col < 4; col++) {
    const x = col * 16, y = row * 16;
    g.strokeStyle = '#ffffff'; g.lineWidth = 4; g.lineCap = 'round';
    g.beginPath(); g.moveTo(x + 2, y + 3); g.lineTo(x + 8, y + 13); g.lineTo(x + 14, y + 3); g.stroke();
    g.strokeStyle = '#9a9a9a'; g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(x + 8, y + 1); g.lineTo(x + 8, y + 15); g.stroke();
  }
  _knitTex = new THREE.CanvasTexture(c);
  _knitTex.wrapS = _knitTex.wrapT = THREE.RepeatWrapping; _knitTex.colorSpace = THREE.SRGBColorSpace;
  return _knitTex;
}

let _dotTex = null;
function softDotTexture() {
  if (_dotTex) return _dotTex;
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.6)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  _dotTex = new THREE.CanvasTexture(c);
  return _dotTex;
}

function snowflakeCharm(size = 0.05) {
  const g = new THREE.Group();
  const m = std('#eaf8ff', { metalness: 0.6, roughness: 0.2, emissive: '#7fd8ff', emissiveIntensity: 0.35 });
  for (let i = 0; i < 3; i++) {
    const arm = new THREE.Group(); arm.rotation.z = (i / 3) * Math.PI;
    arm.add(mesh(new THREE.BoxGeometry(size * 2, size * 0.18, size * 0.18), m));
    for (const s of [-1, 1]) for (const t of [-1, 1]) {
      const b = mesh(new THREE.BoxGeometry(size * 0.5, size * 0.14, size * 0.14), m, s * size * 0.62 + s * size * 0.12, t * size * 0.12, 0);
      b.rotation.z = s * t * 0.8; arm.add(b);
    }
    g.add(arm);
  }
  g.add(mesh(new THREE.SphereGeometry(size * 0.22, 8, 6), m));
  return g;
}

function buildEarmuffs(color) {
  const g = new THREE.Group();
  const tex = knitTexture().clone(); tex.needsUpdate = true; tex.repeat.set(14, 1);
  const knit = std(color, { map: tex, bumpMap: tex, bumpScale: 1.5, roughness: 0.95 });
  const fluff = std(_tint(color, '#ffffff', 0.25), { roughness: 1 });
  const fuzz = std(_tint(color, '#ffffff', 0.4), { roughness: 1 });
  const cup = std(_tint(color, '#000000', 0.35), { roughness: 0.9 });
  const PX = 0.4, PY = 0.4;
  // headband: hugs the head-box silhouette (head is 0.62 wide, top at y 0.62)
  const pts = [[-PX + 0.02, PY + 0.06], [-0.375, 0.58], [-0.33, 0.67], [-0.18, 0.705], [0, 0.712]];
  const curvePts = [...pts, ...pts.slice(0, -1).reverse().map(([x, y]) => [-x, y])].map(([x, y]) => new THREE.Vector3(x, y, 0));
  const curve = new THREE.CatmullRomCurve3(curvePts);
  g.add(mesh(new THREE.TubeGeometry(curve, 64, 0.045, 12, false), knit));
  // ribbed rings along the band
  for (let i = 1; i < 18; i++) {
    const t = i / 18, p = curve.getPointAt(t), tan = curve.getTangentAt(t);
    const r = mesh(new THREE.TorusGeometry(0.046, 0.007, 6, 16), knit, p.x, p.y, p.z);
    r.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), tan);
    g.add(r);
  }
  // ear puffs
  for (const side of [-1, 1]) {
    const puff = new THREE.Group(); puff.position.set(side * PX, PY, 0);
    puff.add(rotated(mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.03, 20), cup, -side * 0.06, 0, 0), "z", Math.PI / 2));
    const core = mesh(new THREE.SphereGeometry(0.135, 20, 14), fluff); core.scale.set(0.55, 1, 1); puff.add(core);
    let seed = side > 0 ? 7 : 3; const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
    for (let i = 0; i < 46; i++) {
      const u = rnd() * 2 - 1, a = rnd() * Math.PI * 2, rr = Math.sqrt(1 - u * u);
      const n = new THREE.Vector3(Math.abs(u) * 0.55 * side, rr * Math.cos(a), rr * Math.sin(a));
      if (n.x * side < 0.02) continue;
      const d = new THREE.Vector3(n.x * 0.074 / 0.55 * 0.55, n.y * 0.135, n.z * 0.135);
      puff.add(mesh(new THREE.SphereGeometry(0.026 + rnd() * 0.014, 8, 6), fuzz, d.x, d.y, d.z));
    }
    g.add(puff);
    if (side > 0) {
      const charm = snowflakeCharm(0.045); charm.position.set(0.12, -0.03, 0.05); charm.rotation.y = Math.PI / 2;
      puff.add(rotated(mesh(new THREE.TorusGeometry(0.012, 0.004, 6, 10), std('#cfe9f5', { metalness: 0.8, roughness: 0.2 }), 0.105, 0.025, 0.05), "y", Math.PI / 2));
      puff.add(charm);
    }
  }
  g.userData.setColor = (c) => {
    knit.color.set(c); fluff.color.copy(_tint(c, '#ffffff', 0.25));
    fuzz.color.copy(_tint(c, '#ffffff', 0.4)); cup.color.copy(_tint(c, '#000000', 0.35));
  };
  return { bone: 'head', object: g };
}

function buildSnowGlobe(color) {
  const g = new THREE.Group();
  const trim = std(color, { roughness: 0.5 });
  const wood = std('#8a5a33', { roughness: 0.8 });
  const woodDark = std('#5e3b1f', { roughness: 0.85 });
  // straps over the shoulders / around torso
  for (const x of [-0.28, 0.28]) {
    g.add(mesh(new THREE.BoxGeometry(0.12, 1.02, 0.03), trim, x, 0, -0.265));
    g.add(mesh(new THREE.BoxGeometry(0.12, 0.03, 0.52), trim, x, 0.505, 0));
    g.add(mesh(new THREE.BoxGeometry(0.12, 0.3, 0.03), trim, x, 0.36, 0.265));
    g.add(mesh(new THREE.BoxGeometry(0.06, 0.06, 0.02), std('#d9d9d9', { metalness: 0.8, roughness: 0.3 }), x, 0.22, 0.28));
  }
  const pack = new THREE.Group(); pack.position.set(0, -0.36, -0.56); pack.scale.setScalar(1.2); g.add(pack);
  // back plate linking globe to straps
  g.add(mesh(new THREE.BoxGeometry(0.66, 0.36, 0.04), woodDark, 0, -0.3, -0.28));
  // wooden base
  pack.add(mesh(new THREE.CylinderGeometry(0.27, 0.3, 0.16, 28), wood, 0, 0, 0));
  pack.add(mesh(new THREE.CylinderGeometry(0.305, 0.305, 0.03, 28), woodDark, 0, -0.08, 0));
  pack.add(rotated(mesh(new THREE.TorusGeometry(0.278, 0.018, 8, 32), trim, 0, 0.03, 0), "x", Math.PI / 2));
  pack.add(rotated(mesh(new THREE.TorusGeometry(0.24, 0.014, 8, 32), trim, 0, 0.085, 0), "x", Math.PI / 2));
  // scene inside
  const R = 0.23, cy = 0.08 + R * 0.75;
  pack.add(mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.04, 24), std('#f8fbff', { roughness: 0.9 }), 0, 0.1, 0));
  const tree = new THREE.Group(); tree.position.set(-0.07, 0.12, -0.02);
  tree.add(mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.04, 6), wood, 0, 0.02, 0));
  const pine = std('#1f6b3c', { roughness: 0.8 }), snowM = std('#ffffff', { roughness: 0.9 });
  [[0.075, 0.1, 0.07], [0.06, 0.09, 0.13], [0.04, 0.08, 0.19]].forEach(([r, h, y]) => {
    tree.add(mesh(new THREE.ConeGeometry(r, h, 10), pine, 0, y, 0));
    tree.add(mesh(new THREE.ConeGeometry(r * 0.45, h * 0.35, 10), snowM, 0, y + h * 0.33, 0));
  });
  tree.add(mesh(new THREE.OctahedronGeometry(0.014), std('#ffd84a', { emissive: '#ffb000', emissiveIntensity: 0.8 }), 0, 0.245, 0));
  pack.add(tree);
  const cabin = new THREE.Group(); cabin.position.set(0.07, 0.12, 0.04); cabin.rotation.y = -0.5;
  cabin.add(mesh(new THREE.BoxGeometry(0.1, 0.07, 0.08), std('#7a4a2a', { roughness: 0.9 }), 0, 0.035, 0));
  for (const sd of [-1, 1]) {
    const r = mesh(new THREE.BoxGeometry(0.075, 0.012, 0.1), std('#f4f8fb', { roughness: 0.9 }), sd * 0.027, 0.088, 0);
    r.rotation.z = -sd * 0.65; cabin.add(r);
  }
  const gable = new THREE.Shape(); gable.moveTo(-0.05, 0); gable.lineTo(0.05, 0); gable.lineTo(0, 0.04); gable.closePath();
  const gab = mesh(new THREE.ExtrudeGeometry(gable, { depth: 0.08, bevelEnabled: false }), std('#7a4a2a', { roughness: 0.9 }), 0, 0.07, -0.04);
  cabin.add(gab);
  cabin.add(mesh(new THREE.BoxGeometry(0.025, 0.025, 0.004), std('#ffd27a', { emissive: '#ffae3a', emissiveIntensity: 1 }), 0.025, 0.04, 0.041));
  cabin.add(mesh(new THREE.BoxGeometry(0.02, 0.04, 0.004), woodDark, -0.022, 0.02, 0.041));
  cabin.add(mesh(new THREE.BoxGeometry(0.015, 0.04, 0.015), std('#6d6d6d'), 0.03, 0.12, -0.02));
  pack.add(cabin);
  // glass dome
  const glass = new THREE.MeshPhysicalMaterial({ color: '#e8f6ff', roughness: 0.05, metalness: 0, transparent: true, opacity: 0.22, depthWrite: false, clearcoat: 1, side: THREE.DoubleSide });
  const dome = mesh(new THREE.SphereGeometry(R, 32, 20, 0, Math.PI * 2, 0, Math.PI * 0.78), glass, 0, cy, 0);
  dome.castShadow = false; dome.renderOrder = 2; pack.add(dome);
  // drifting snow
  const N = 70, pos = new Float32Array(N * 3), vel = new Float32Array(N);
  const reset = (i, top) => {
    let x, y, z; do { x = (Math.random() * 2 - 1) * R * 0.85; z = (Math.random() * 2 - 1) * R * 0.85; y = top ? R * 0.8 : (Math.random() * 2 - 1) * R * 0.8; } while (x * x + y * y + z * z > (R * 0.85) ** 2);
    pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z; vel[i] = 0.02 + Math.random() * 0.03;
  };
  for (let i = 0; i < N; i++) reset(i, false);
  const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const snow = new THREE.Points(pg, new THREE.PointsMaterial({ size: 0.026, map: softDotTexture(), transparent: true, depthWrite: false, color: '#ffffff' }));
  snow.position.y = cy; snow.renderOrder = 1; pack.add(snow);
  let t = 0;
  g.userData.tick = (dt) => {
    t += dt;
    for (let i = 0; i < N; i++) {
      pos[i * 3 + 1] -= vel[i] * dt;
      pos[i * 3] += Math.sin(t * 1.3 + i) * 0.01 * dt;
      pos[i * 3 + 2] += Math.cos(t * 1.1 + i * 1.7) * 0.01 * dt;
      const x = pos[i * 3], y = pos[i * 3 + 1], z = pos[i * 3 + 2];
      if (y < 0.12 - cy + 0.03 || x * x + y * y + z * z > (R * 0.9) ** 2) reset(i, true);
    }
    pg.attributes.position.needsUpdate = true;
  };
  g.userData.setColor = (c) => trim.color.set(c);
  return { bone: 'torso', object: g };
}

function buildCocoaMug(color) {
  const g = new THREE.Group();
  g.position.set(0, -0.9, 0.26); // in front of the right fist
  const glaze = std(color, { roughness: 0.25, metalness: 0.05 });
  const inner = std(_tint(color, '#ffffff', 0.5), { roughness: 0.3 });
  const H = 0.26, R = 0.13;
  const body = mesh(new THREE.CylinderGeometry(R, R * 0.92, H, 28, 1, true), glaze, 0, 0, 0.12); body.material.side = THREE.DoubleSide; g.add(body);
  g.add(mesh(new THREE.CylinderGeometry(R * 0.92, R * 0.92, 0.02, 28), glaze, 0, -H / 2 + 0.01, 0.12));
  g.add(rotated(mesh(new THREE.TorusGeometry(R, 0.012, 8, 32), inner, 0, H / 2, 0.12), "x", Math.PI / 2));
  g.add(rotated(mesh(new THREE.TorusGeometry(R * 0.93, 0.008, 6, 32), std('#ffffff', { roughness: 0.3 }), 0, -H * 0.15, 0.12), "x", Math.PI / 2));
  const handle = mesh(new THREE.TorusGeometry(0.065, 0.02, 10, 20, Math.PI * 1.15), glaze, R + 0.005, 0.0, 0.12);
  handle.rotation.z = -Math.PI * 0.575; g.add(handle);
  // cocoa + marshmallows
  g.add(mesh(new THREE.CylinderGeometry(R - 0.008, R - 0.008, 0.01, 28), std('#5a3220', { roughness: 0.35 }), 0, H / 2 - 0.03, 0.12));
  const mm = std('#fffaf2', { roughness: 0.9 });
  [[-0.04, 0.02, 0.4], [0.035, -0.03, 1.1], [0.02, 0.05, 2.2], [-0.02, -0.05, 0.1]].forEach(([x, z, r], i) => {
    const c = mesh(new THREE.BoxGeometry(0.045, 0.04, 0.045), mm, x, H / 2 - 0.015 + (i === 2 ? 0.012 : 0), 0.12 + z);
    c.rotation.set(i * 0.3, r, i === 2 ? 0.4 : 0.1); g.add(c);
  });
  // rising steam
  const N = 14, sprites = [];
  const steamMat = new THREE.SpriteMaterial({ map: softDotTexture(), color: '#ffffff', transparent: true, opacity: 0.4, depthWrite: false });
  for (let i = 0; i < N; i++) {
    const s = new THREE.Sprite(steamMat.clone()); s.userData.life = i / N; s.userData.ox = (Math.random() - 0.5) * 0.08;
    g.add(s); sprites.push(s);
  }
  let t = 0;
  const place = (s) => {
    const L = s.userData.life, y = H / 2 + L * 0.42;
    s.position.set(s.userData.ox + Math.sin(t * 2 + L * 6) * 0.03 * L, y, 0.12 + Math.cos(t * 1.5 + L * 5) * 0.02);
    s.scale.setScalar(0.05 + L * 0.11);
    s.material.opacity = Math.sin(L * Math.PI) * 0.42;
  };
  sprites.forEach(place);
  g.userData.tick = (dt) => {
    t += dt;
    for (const s of sprites) { s.userData.life += dt * 0.45; if (s.userData.life > 1) { s.userData.life -= 1; s.userData.ox = (Math.random() - 0.5) * 0.08; } place(s); }
  };
  g.userData.setColor = (c) => { glaze.color.set(c); inner.color.copy(_tint(c, '#ffffff', 0.5)); };
  return { bone: 'armR', object: g };
}

function buildFrostLantern(color) {
  const g = new THREE.Group(); g.position.set(0, -1.0, 0);
  const iron = std('#3c4652', { metalness: 0.8, roughness: 0.35 });
  const frost = std('#e9f6ff', { roughness: 0.9 });
  const glow = std(color, { emissive: color, emissiveIntensity: 2, roughness: 0.1, flatShading: true });
  const glass = new THREE.MeshPhysicalMaterial({ color: '#dff4ff', transparent: true, opacity: 0.25, roughness: 0.15, depthWrite: false, side: THREE.DoubleSide });
  // bail handle gripped by the fist
  g.add(mesh(new THREE.TorusGeometry(0.07, 0.012, 8, 20, Math.PI), iron, 0, -0.045, 0));
  const L = new THREE.Group(); L.position.y = -0.25; g.add(L);
  L.add(mesh(new THREE.CylinderGeometry(0.035, 0.11, 0.07, 6), iron, 0, 0.19, 0));      // cap
  L.add(mesh(new THREE.CylinderGeometry(0.03, 0.06, 0.03, 6), frost, 0, 0.235, 0));     // snow on cap
  L.add(mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.025, 6), iron, 0, 0.145, 0));
  L.add(mesh(new THREE.CylinderGeometry(0.125, 0.11, 0.04, 6), iron, 0, -0.14, 0));     // base
  L.add(mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.26, 6, 1, true), glass, 0, 0, 0));
  for (let i = 0; i < 6; i++) {
    const a = i / 6 * Math.PI * 2 + Math.PI / 6;
    L.add(mesh(new THREE.BoxGeometry(0.014, 0.27, 0.014), iron, Math.cos(a) * 0.103, 0, Math.sin(a) * 0.103));
  }
  // icicles hanging from the base
  [[0.06, 0.05], [-0.05, 0.035], [0.0, -0.07], [-0.07, -0.04]].forEach(([x, z], i) => {
    const ic = mesh(new THREE.ConeGeometry(0.012, 0.05 + (i % 2) * 0.03, 6), std('#c9f0ff', { roughness: 0.1, transparent: true, opacity: 0.85 }), x, -0.18 - (i % 2) * 0.015, z);
    ic.rotation.x = Math.PI; L.add(ic);
  });
  // crystal + halo
  const crystal = new THREE.Group(); L.add(crystal);
  crystal.add(mesh(new THREE.OctahedronGeometry(0.065), glow));
  const sh = mesh(new THREE.OctahedronGeometry(0.03), glow, 0.035, -0.04, 0.01); sh.rotation.z = 0.5; crystal.add(sh);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: softDotTexture(), color, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }));
  halo.scale.setScalar(0.32); L.add(halo);
  const light = new THREE.PointLight(color, 0.6, 2.2); L.add(light);
  let t = 0;
  g.userData.tick = (dt) => {
    t += dt;
    crystal.rotation.y += dt * 0.8; crystal.position.y = Math.sin(t * 2) * 0.01;
    const f = 1 + Math.sin(t * 7) * 0.06 + Math.sin(t * 13) * 0.04;
    glow.emissiveIntensity = 2 * f; halo.material.opacity = 0.55 * f; light.intensity = 0.6 * f;
    L.rotation.z = Math.sin(t * 1.6) * 0.06;
  };
  g.userData.setColor = (c) => { glow.color.set(c); glow.emissive.set(c); halo.material.color.set(c); light.color.set(c); };
  return { bone: 'armR', object: g };
}

function buildPenguinPal(color) {
  const g = new THREE.Group();
  const P = new THREE.Group(); P.position.set(-0.75, 0.5, 0); P.rotation.y = 0.35; g.add(P);
  const black = std('#1f2430', { roughness: 0.55 }), white = std('#f7f9fb', { roughness: 0.7 });
  const orange = std('#ff9a2e', { roughness: 0.5 }), scarfM = std(color, { roughness: 0.95 });
  const body = new THREE.Group(); P.add(body);
  const torso = mesh(new THREE.SphereGeometry(0.11, 20, 16), black, 0, 0.13, 0); torso.scale.set(1, 1.25, 0.95); body.add(torso);
  const belly = mesh(new THREE.SphereGeometry(0.09, 20, 16), white, 0, 0.115, 0.03); belly.scale.set(0.95, 1.2, 0.9); body.add(belly);
  const head = new THREE.Group(); head.position.y = 0.29; body.add(head);
  head.add(mesh(new THREE.SphereGeometry(0.08, 20, 16), black));
  const face = mesh(new THREE.SphereGeometry(0.062, 18, 14), white, 0, -0.008, 0.03); face.scale.set(1.05, 0.95, 0.8); head.add(face);
  for (const s of [-1, 1]) {
    head.add(mesh(new THREE.SphereGeometry(0.014, 10, 8), black, s * 0.027, 0.012, 0.075));
    head.add(mesh(new THREE.SphereGeometry(0.005, 6, 4), white, s * 0.027 + 0.004, 0.017, 0.087));
    head.add(mesh(new THREE.SphereGeometry(0.012, 8, 6), std('#ff9fb0', { roughness: 0.9 }), s * 0.045, -0.015, 0.068));
  }
  head.add(rotated(mesh(new THREE.ConeGeometry(0.018, 0.045, 10), orange, 0, -0.01, 0.095), 'x', Math.PI / 2));
  // scarf: wrap + tail
  body.add(rotated(mesh(new THREE.TorusGeometry(0.068, 0.02, 8, 20), scarfM, 0, 0.225, 0), 'x', Math.PI / 2));
  const tail = mesh(new THREE.BoxGeometry(0.035, 0.09, 0.012), scarfM, 0.04, 0.17, 0.07); tail.rotation.z = 0.25; body.add(tail);
  for (const y of [0.145, 0.135]) body.add(mesh(new THREE.BoxGeometry(0.036, 0.006, 0.013), white, 0.04 + (y - 0.14) * 2, y - 0.01, 0.071));
  // flippers & feet
  const flips = [-1, 1].map(s => {
    const piv = new THREE.Group(); piv.position.set(s * 0.1, 0.19, 0); body.add(piv);
    const f = mesh(new THREE.SphereGeometry(0.05, 12, 8), black, s * 0.012, -0.05, 0); f.scale.set(0.3, 1, 0.6); piv.add(f);
    piv.rotation.z = s * 0.25; return piv;
  });
  for (const s of [-1, 1]) { const ft = mesh(new THREE.SphereGeometry(0.03, 10, 6), orange, s * 0.045, 0.006, 0.05); ft.scale.set(1, 0.35, 1.5); P.add(ft); }
  let t = 0;
  g.userData.tick = (dt) => {
    t += dt;
    body.position.y = Math.abs(Math.sin(t * 2.4)) * 0.015;
    head.rotation.z = Math.sin(t * 1.3) * 0.12; head.rotation.y = Math.sin(t * 0.7) * 0.25;
    const flap = Math.max(0, Math.sin(t * 9)) * (Math.sin(t * 0.8) > 0.6 ? 0.7 : 0.08);
    flips[0].rotation.z = -0.25 - flap; flips[1].rotation.z = 0.25 + flap;
  };
  g.userData.setColor = (c) => scarfM.color.set(c);
  return { bone: 'torso', object: g };
}

// Draws a cable-knit panel in `color` (w x h px). band = snowflake/fair-isle band row.
function drawSweater(c, color, { band = true, cables = 4 } = {}) {
  const g = c.getContext('2d'), W = c.width, H = c.height;
  const base = new THREE.Color(color), dark = base.clone().lerp(new THREE.Color('#000'), 0.28), light = base.clone().lerp(new THREE.Color('#fff'), 0.18);
  const css = (col) => '#' + col.getHexString();
  const cream = base.getHSL({}).l > 0.6 ? '#7a5b3a' : '#f6f1e6';
  g.fillStyle = css(base); g.fillRect(0, 0, W, H);
  // purl texture
  for (let y = 0; y < H; y += 6) for (let x = (y / 6) % 2 * 3; x < W; x += 6) { g.fillStyle = css(dark); g.globalAlpha = 0.25; g.fillRect(x, y, 3, 3); }
  g.globalAlpha = 1;
  // cables: interlocking twisted ropes
  const cw = W / cables;
  for (let i = 0; i < cables; i++) {
    const cx = cw * (i + 0.5);
    g.fillStyle = css(dark); g.fillRect(cx - cw * 0.32, 0, 3, H); g.fillRect(cx + cw * 0.32 - 3, 0, 3, H);
    for (let y = -16; y < H + 16; y += 22) {
      for (const s of [-1, 1]) {
        g.save(); g.translate(cx, y); g.rotate(s * 0.6);
        g.fillStyle = css(light); g.beginPath(); g.ellipse(0, 0, cw * 0.13, 13, 0, 0, Math.PI * 2); g.fill();
        g.strokeStyle = css(dark); g.lineWidth = 2; g.stroke(); g.restore();
      }
    }
  }
  if (band) {
    const by = H * 0.18, bh = H * 0.2;
    g.fillStyle = css(dark); g.fillRect(0, by, W, bh);
    g.fillStyle = cream; g.fillRect(0, by + 3, W, 3); g.fillRect(0, by + bh - 6, W, 3);
    // snowflakes
    const n = Math.round(W / (bh * 1.1)), sx = W / n;
    g.strokeStyle = cream; g.lineWidth = 3; g.lineCap = 'round';
    for (let i = 0; i < n; i++) {
      const x = sx * (i + 0.5), y = by + bh / 2, r = bh * 0.3;
      for (let k = 0; k < 3; k++) {
        const a = k * Math.PI / 3, dx = Math.cos(a) * r, dy = Math.sin(a) * r;
        g.beginPath(); g.moveTo(x - dx, y - dy); g.lineTo(x + dx, y + dy); g.stroke();
      }
      g.fillStyle = cream; for (const ox of [-sx / 2, sx / 2]) { g.beginPath(); g.arc(x + ox, y, 2.5, 0, Math.PI * 2); g.fill(); }
    }
  }
}
function ribTexture(color) {
  const c = document.createElement('canvas'); c.width = 64; c.height = 16;
  const g = c.getContext('2d'), base = new THREE.Color(color), dark = base.clone().lerp(new THREE.Color('#000'), 0.3);
  g.fillStyle = '#' + base.getHexString(); g.fillRect(0, 0, 64, 16);
  g.fillStyle = '#' + dark.getHexString(); for (let x = 0; x < 64; x += 8) g.fillRect(x, 0, 3, 16);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping; return t;
}

function buildSweater(color) {
  const g = new THREE.Group();
  const panels = [];
  const panel = (w, h, opts, rep = 1) => {
    const c = document.createElement('canvas'); c.width = 256; c.height = Math.round(256 * h / w);
    drawSweater(c, color, opts);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.MeshStandardMaterial({ map: t, bumpMap: t, bumpScale: 0.6, roughness: 1 });
    panels.push({ c, t, opts }); return m;
  };
  const ribs = [];
  const rib = (rx = 1) => { const t = ribTexture(color); t.repeat.set(rx, 1); const m = new THREE.MeshStandardMaterial({ map: t, roughness: 1 }); ribs.push(m); return m; };
  // body: slightly larger than the 1 x 1 x 0.5 torso
  const front = panel(1.04, 0.92, { band: true, cables: 4 });
  const side = panel(0.54, 0.92, { band: true, cables: 2 });
  const top = panel(1.04, 0.54, { band: false, cables: 4 });
  g.add(mesh(new THREE.BoxGeometry(1.04, 0.92, 0.54), [side, side, top, top, front, front], 0, 0.06, 0));
  g.add(mesh(new THREE.BoxGeometry(1.06, 0.12, 0.56), rib(6), 0, -0.44, 0));                 // ribbed hem
  // fold-over collar around the neck
  const collar = mesh(new THREE.TorusGeometry(0.36, 0.055, 10, 32), rib(10), 0, 0.55, 0); collar.rotation.x = Math.PI / 2; collar.scale.set(1.05, 0.7, 1); g.add(collar);
  // sleeves (extras on arm bones)
  const sleeve = panel(0.54, 0.66, { band: true, cables: 2 });
  const extras = ['armL', 'armR'].map(bone => {
    const s = new THREE.Group();
    s.add(mesh(new THREE.BoxGeometry(0.54, 0.66, 0.54), sleeve, 0, -0.33, 0));
    s.add(mesh(new THREE.BoxGeometry(0.56, 0.12, 0.56), rib(3), 0, -0.7, 0));                // cuff
    return { bone, object: s };
  });
  g.userData.setColor = (col) => {
    for (const p of panels) { drawSweater(p.c, col, p.opts); p.t.needsUpdate = true; }
    for (const m of ribs) { const nt = ribTexture(col); nt.repeat.copy(m.map.repeat); m.map.dispose(); m.map = nt; m.needsUpdate = true; }
  };
  return { bone: 'torso', object: g, extras };
}

let _frostLensTex = null;
function frostLensTexture() {
  if (_frostLensTex) return _frostLensTex;
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 20, 64, 64, 64);
  gr.addColorStop(0, 'rgba(235,248,255,0.08)'); gr.addColorStop(0.65, 'rgba(235,248,255,0.25)'); gr.addColorStop(1, 'rgba(255,255,255,0.95)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  // frost ferns creeping in from the rim
  g.strokeStyle = 'rgba(255,255,255,0.85)'; g.lineCap = 'round';
  let seed = 11; const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
  const fern = (x, y, a, len, w) => {
    if (len < 4) return;
    const x2 = x + Math.cos(a) * len, y2 = y + Math.sin(a) * len;
    g.lineWidth = w; g.beginPath(); g.moveTo(x, y); g.lineTo(x2, y2); g.stroke();
    fern(x2, y2, a + 0.5, len * 0.6, w * 0.7); fern(x2, y2, a - 0.5, len * 0.6, w * 0.7);
  };
  for (let i = 0; i < 9; i++) { const a = rnd() * Math.PI * 2; fern(64 + Math.cos(a) * 62, 64 + Math.sin(a) * 62, a + Math.PI + (rnd() - 0.5) * 0.6, 12 + rnd() * 8, 2); }
  // glint
  g.strokeStyle = 'rgba(255,255,255,0.9)'; g.lineWidth = 5; g.beginPath(); g.arc(64, 64, 40, 3.6, 4.3); g.stroke();
  _frostLensTex = new THREE.CanvasTexture(c); _frostLensTex.colorSpace = THREE.SRGBColorSpace;
  return _frostLensTex;
}

function buildFrostSpecs(color) {
  const g = new THREE.Group();
  const frame = std(color, { metalness: 0.85, roughness: 0.25 });
  const lens = new THREE.MeshStandardMaterial({ map: frostLensTexture(), transparent: true, roughness: 0.1, metalness: 0, depthWrite: false });
  const EX = 0.107, EY = 0.368, Z = 0.335, R = 0.085;
  for (const s of [-1, 1]) {
    g.add(mesh(new THREE.TorusGeometry(R, 0.011, 8, 32), frame, s * EX, EY, Z));
    const l = mesh(new THREE.CircleGeometry(R, 32), lens, s * EX, EY, Z - 0.002); l.castShadow = false; l.renderOrder = 3; g.add(l);
    // hinge block + temple arm running back along the side of the head
    g.add(mesh(new THREE.BoxGeometry(0.03, 0.022, 0.022), frame, s * (EX + R + 0.01), EY + 0.01, Z - 0.005));
    g.add(mesh(new THREE.BoxGeometry(0.012, 0.014, 0.62), frame, s * 0.322, EY + 0.01, Z - 0.32));
    const tip = mesh(new THREE.BoxGeometry(0.012, 0.06, 0.014), frame, s * 0.322, EY - 0.025, -0.27); tip.rotation.x = 0.35; g.add(tip);
    // nose pad
    g.add(mesh(new THREE.SphereGeometry(0.012, 8, 6), std('#e8f4ff', { transparent: true, opacity: 0.7 }), s * 0.03, EY - 0.05, Z - 0.01));
  }
  // arched bridge
  const bridge = mesh(new THREE.TorusGeometry(0.03, 0.009, 6, 16, Math.PI), frame, 0, EY + 0.005, Z); g.add(bridge);
  // tiny snowflake stud on the right hinge
  const flake = snowflakeCharm(0.022); flake.position.set(EX + R + 0.025, EY + 0.012, Z + 0.01); g.add(flake);
  g.userData.setColor = (c) => frame.color.set(c);
  return { bone: 'head', object: g };
}

function drawFeathers(c, color) {
  const g = c.getContext('2d'), W = c.width, H = c.height;
  const base = new THREE.Color(color), dark = base.clone().lerp(new THREE.Color('#000'), 0.22), light = base.clone().lerp(new THREE.Color('#fff'), 0.25);
  g.fillStyle = '#' + base.getHexString(); g.fillRect(0, 0, W, H);
  const fw = 16, fh = 12;
  for (let row = -1; row < H / fh + 1; row++) for (let col = -1; col < W / fw + 1; col++) {
    const x = col * fw + (row % 2) * fw / 2, y = row * fh;
    g.fillStyle = '#' + light.getHexString(); g.beginPath(); g.arc(x, y, fw * 0.5, 0, Math.PI); g.fill();
    g.strokeStyle = '#' + dark.getHexString(); g.lineWidth = 1.5; g.beginPath(); g.arc(x, y, fw * 0.5, 0.15, Math.PI - 0.15); g.stroke();
    if ((row * 7 + col * 3) % 5 === 0) { g.fillStyle = '#' + dark.getHexString(); g.beginPath(); g.ellipse(x, y + 3, 1.6, 2.4, 0, 0, Math.PI * 2); g.fill(); }
  }
}

function buildOwlHood(color) {
  const g = new THREE.Group();
  const cv = document.createElement('canvas'); cv.width = cv.height = 256; drawFeathers(cv, color);
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(0.55, 0.55);
  const plume = new THREE.MeshStandardMaterial({ map: tex, bumpMap: tex, bumpScale: 0.8, roughness: 1 });
  const fluffM = std(_tint(color, '#ffffff', 0.55), { roughness: 1 });
  const tuftM = std(_tint(color, '#000000', 0.15), { roughness: 1 });
  const RB = (w, h, d, x, y, z) => mesh(new RoundedBoxGeometry(w, h, d, 3, 0.06), plume, x, y, z);
  // hood shell around the 0.62 head box (open at the front)
  g.add(RB(0.76, 0.12, 0.74, 0, 0.67, -0.02));     // crown
  g.add(RB(0.1, 0.62, 0.74, -0.35, 0.34, -0.02));  // sides
  g.add(RB(0.1, 0.62, 0.74, 0.35, 0.34, -0.02));
  g.add(RB(0.76, 0.66, 0.1, 0, 0.33, -0.36));      // back
  g.add(RB(0.86, 0.12, 0.6, 0, 0.03, -0.12));      // cape collar on the shoulders
  g.add(RB(0.56, 0.22, 0.12, 0, 0.8, 0.27));       // forehead crest that carries the owl face
  // fluffy trim framing the face
  let seed = 5; const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
  const rim = [];
  for (let i = 0; i <= 22; i++) { const t = i / 22; rim.push(t < 0.5 ? [-0.33 + t * 2 * 0.66, 0.66] : null); }
  const pts = [];
  for (let i = 0; i <= 16; i++) pts.push([-0.34, 0.04 + i * 0.04]);
  for (let i = 1; i < 17; i++) pts.push([-0.34 + i * 0.04, 0.68]);
  for (let i = 16; i >= 0; i--) pts.push([0.34, 0.04 + i * 0.04]);
  for (const [x, y] of pts) { const f = mesh(new THREE.SphereGeometry(0.042 + rnd() * 0.014, 10, 8), fluffM, x + (rnd() - 0.5) * 0.012, y + (rnd() - 0.5) * 0.01, 0.335); f.scale.z = 0.7; g.add(f); }
  // owl face on the crown front
  const eyeW = std('#f6c445', { roughness: 0.35, emissive: '#7a5200', emissiveIntensity: 0.2 });
  const pupil = std('#111', { roughness: 0.2 });
  for (const s of [-1, 1]) {
    const disc = mesh(new THREE.CircleGeometry(0.09, 24), fluffM, s * 0.12, 0.81, 0.335);  g.add(disc);
    const eye = mesh(new THREE.SphereGeometry(0.058, 20, 14), eyeW, s * 0.12, 0.81, 0.34); eye.scale.z = 0.5; g.add(eye);
    g.add(mesh(new THREE.SphereGeometry(0.03, 14, 10), pupil, s * 0.12, 0.81, 0.365));
    g.add(mesh(new THREE.SphereGeometry(0.01, 6, 4), std('#fff'), s * 0.12 + 0.012, 0.823, 0.392));
    // ear tufts
    const tuft = new THREE.Group(); tuft.position.set(s * 0.27, 0.72, 0.05); tuft.rotation.z = -s * 0.45;
    tuft.add(mesh(new THREE.ConeGeometry(0.07, 0.2, 10), tuftM, 0, 0.09, 0));
    tuft.add(rotated(mesh(new THREE.ConeGeometry(0.045, 0.15, 8), plume, s * 0.04, 0.06, 0), 'z', -s * 0.4));
    g.add(tuft);
  }
  const beak = mesh(new THREE.ConeGeometry(0.03, 0.08, 4), std('#e8a03a', { roughness: 0.5 }), 0, 0.755, 0.37); beak.rotation.x = Math.PI; g.add(beak);
  // brow feathers
  for (const s of [-1, 1]) { const b = mesh(new THREE.BoxGeometry(0.12, 0.022, 0.03), tuftM, s * 0.12, 0.905, 0.33); b.rotation.z = s * 0.3; g.add(b); }
  g.userData.setColor = (c) => {
    drawFeathers(cv, c); tex.needsUpdate = true;
    fluffM.color.copy(_tint(c, '#ffffff', 0.55)); tuftM.color.copy(_tint(c, '#000000', 0.15));
  };
  return { bone: 'head', object: g };
}

// ---------- Natural Disasters event cosmetics ----------
function buildTornadoHat(color) {
  const g = new THREE.Group();
  const spin = new THREE.Group(); spin.position.y = 0.63; spin.scale.setScalar(1.2); g.add(spin);
  // swirl texture for the funnel
  const c = document.createElement('canvas'); c.width = 128; c.height = 128;
  const x = c.getContext('2d'); x.clearRect(0, 0, 128, 128);
  for (let i = 0; i < 7; i++) { x.strokeStyle = `rgba(255,255,255,${0.35 + (i % 3) * 0.2})`; x.lineWidth = 6 + (i % 2) * 5; x.beginPath(); x.moveTo(-20 + i * 22, 128); x.bezierCurveTo(i * 22 + 10, 80, i * 22 - 10, 40, i * 22 + 25, 0); x.stroke(); }
  const tex = new THREE.CanvasTexture(c); tex.wrapS = THREE.RepeatWrapping; tex.repeat.set(2, 1);
  const funnelM = new THREE.MeshStandardMaterial({ color, map: tex, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false, emissive: color, emissiveIntensity: 0.25, roughness: 0.3 });
  const prof = []; for (let i = 0; i <= 12; i++) { const t = i / 12; prof.push(new THREE.Vector2(0.05 + Math.pow(t, 1.6) * 0.3, t * 0.55)); }
  const funnel = mesh(new THREE.LatheGeometry(prof, 32), funnelM); funnel.renderOrder = 2; funnel.castShadow = false; spin.add(funnel);
  // solid icy rings that wobble (gives the blocky R6 silhouette weight)
  const ringM = std(color, { roughness: 0.25, metalness: 0.1, emissive: color, emissiveIntensity: 0.15, flatShading: true });
  const rings = [];
  for (let i = 0; i < 5; i++) {
    const t = (i + 0.5) / 5, r = 0.06 + Math.pow(t, 1.6) * 0.3;
    const ring = rotated(mesh(new THREE.TorusGeometry(r, 0.022 + t * 0.012, 6, 18), ringM, 0, t * 0.55, 0), 'x', Math.PI / 2);
    spin.add(ring); rings.push(ring);
  }
  // base swirl puff touching the head
  spin.add(mesh(new THREE.CylinderGeometry(0.12, 0.16, 0.04, 16), ringM, 0, 0.0, 0));
  // orbiting debris: ice cubes + tiny planks + a mini block
  const orbit = new THREE.Group(); spin.add(orbit);
  const debris = [
    [new THREE.BoxGeometry(0.06, 0.06, 0.06), std('#d9f4ff', { roughness: 0.1, transparent: true, opacity: 0.9 })],
    [new THREE.BoxGeometry(0.1, 0.02, 0.035), std('#9a6a3a')],
    [new THREE.BoxGeometry(0.05, 0.05, 0.05), std('#e8f6ff', { roughness: 0.1 })],
    [new THREE.BoxGeometry(0.07, 0.07, 0.07), std('#7ab35a')],
    [new THREE.BoxGeometry(0.09, 0.018, 0.03), std('#8a5a33')],
    [new THREE.OctahedronGeometry(0.035), std('#bfeaff', { emissive: '#5fc8ff', emissiveIntensity: 0.4 })],
  ].map(([geo, m], i) => { const d = mesh(geo, m); d.userData = { a: i / 6 * Math.PI * 2, r: 0.22 + (i % 3) * 0.08, y: 0.12 + (i * 0.083) % 0.42, s: 1.5 + (i % 2) }; orbit.add(d); return d; });
  // swirling snow
  const N = 60, pos = new Float32Array(N * 3), seeds = [];
  for (let i = 0; i < N; i++) seeds.push({ a: Math.random() * 6.28, y: Math.random() * 0.6, sp: 2 + Math.random() * 2 });
  const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const snow = new THREE.Points(pg, new THREE.PointsMaterial({ size: 0.03, map: softDotTexture(), transparent: true, depthWrite: false })); spin.add(snow);
  let t = 0;
  const place = () => {
    funnel.rotation.y = -t * 6; tex.offset.x = t * 0.6;
    rings.forEach((r, i) => { r.position.x = Math.sin(t * 3 + i) * 0.015 * i; r.position.z = Math.cos(t * 3 + i) * 0.015 * i; });
    debris.forEach(d => { const u = d.userData, a = u.a + t * u.s; d.position.set(Math.cos(a) * u.r, u.y + Math.sin(t * 2 + u.a) * 0.03, Math.sin(a) * u.r); d.rotation.set(t * 3 + u.a, t * 2, 0); });
    seeds.forEach((sd, i) => { const yy = (sd.y + t * 0.15) % 0.6, rr = 0.06 + Math.pow(yy / 0.55, 1.6) * 0.32 + 0.03, a = sd.a + t * sd.sp; pos[i * 3] = Math.cos(a) * rr; pos[i * 3 + 1] = yy; pos[i * 3 + 2] = Math.sin(a) * rr; });
    pg.attributes.position.needsUpdate = true;
  };
  place();
  g.userData.tick = (dt) => { t += dt; place(); };
  g.userData.setColor = (col) => { funnelM.color.set(col); funnelM.emissive.set(col); ringM.color.set(col); ringM.emissive.set(col); };
  return { bone: 'head', object: g };
}

function rainbowColors(geo, axis = 'y') {
  geo.computeBoundingBox(); const bb = geo.boundingBox, p = geo.attributes.position, cols = new Float32Array(p.count * 3), col = new THREE.Color();
  for (let i = 0; i < p.count; i++) { const v = (p['get' + axis.toUpperCase()](i) - bb.min[axis]) / (bb.max[axis] - bb.min[axis] || 1); col.setHSL(0.83 * (1 - v), 1, 0.6); cols.set([col.r, col.g, col.b], i * 3); }
  geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
}
function buildLightningBack(color) {
  const g = new THREE.Group();
  const shape = new THREE.Shape();
  [[0.05, 0.5], [-0.17, 0.02], [-0.02, 0.02], [-0.12, -0.45], [0.18, 0.08], [0.03, 0.08], [0.16, 0.5]].forEach(([x, y], i) => i ? shape.lineTo(x, y) : shape.moveTo(x, y));
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.08, bevelEnabled: true, bevelSize: 0.015, bevelThickness: 0.015, bevelSegments: 2 });
  geo.translate(0, 0, -0.04); rainbowColors(geo);
  const bolt = new THREE.MeshStandardMaterial({ roughness: 0.15, metalness: 0.1, flatShading: true });
  const core = new THREE.MeshBasicMaterial({ color: '#ffffff' });
  const halo = new THREE.SpriteMaterial({ map: softDotTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const B = new THREE.Group(); B.position.set(0, 0.05, -0.36); B.rotation.z = -0.12; B.scale.setScalar(1.15); g.add(B);
  const rainbowM = new THREE.MeshBasicMaterial({ vertexColors: true });
  const boltMesh = mesh(geo, bolt); B.add(boltMesh);
  const coreGeo = new THREE.ExtrudeGeometry(shape, { depth: 0.02, bevelEnabled: false }); coreGeo.scale(0.55, 0.8, 1);
  const coreM = mesh(coreGeo, core, 0.01, 0.0, -0.075); B.add(coreM);
  const glow = new THREE.Sprite(halo); glow.scale.set(0.5, 0.8, 1); glow.position.z = -0.12; B.add(glow);
  // icy frost crystals clamping it to the straps
  const ice = std('#dff6ff', { roughness: 0.05, transparent: true, opacity: 0.85, flatShading: true });
  for (const [x, y] of [[0.0, 0.3], [-0.05, -0.2]]) B.add(mesh(new THREE.OctahedronGeometry(0.06), ice, x, y, 0.05));
  // straps
  const strap = std('#2c3440');
  g.add(mesh(new THREE.BoxGeometry(1.02, 0.07, 0.54), strap, 0, 0.3, 0));
  g.add(mesh(new THREE.BoxGeometry(1.02, 0.07, 0.54), strap, 0, -0.2, 0));
  g.add(mesh(new THREE.BoxGeometry(0.12, 0.6, 0.06), strap, 0, 0.05, -0.27));
  // sparks: short jagged lines that flicker
  const sparkM = new THREE.LineBasicMaterial({ transparent: true });
  const sparks = [];
  for (let i = 0; i < 5; i++) {
    const pts = []; let px = 0, py = 0; for (let k = 0; k < 4; k++) { pts.push(new THREE.Vector3(px, py, 0)); px += (Math.random() - 0.3) * 0.08; py += (Math.random() - 0.5) * 0.08; }
    const ln = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), sparkM); ln.position.set((i % 2 ? 0.12 : -0.12), -0.35 + i * 0.18, 0); ln.scale.x = i % 2 ? 1 : -1; B.add(ln); sparks.push(ln);
  }
  let rainbow = false;
  const apply = (col) => {
    rainbow = col === 'rainbow';
    boltMesh.material = rainbow ? rainbowM : bolt;
    const hex = rainbow ? '#ffffff' : col;
    bolt.color.set(hex); bolt.emissive.set(rainbow ? '#333333' : col); bolt.emissiveIntensity = 0.9;
    halo.color.set(rainbow ? '#ffe9ff' : col); sparkM.color.set(rainbow ? '#ffffff' : col);
  };
  apply(color);
  let t = 0, flash = 0;
  g.userData.tick = (dt) => {
    t += dt; flash = Math.max(0, flash - dt * 4); if (Math.random() < dt * 1.5) flash = 1;
    const f = 0.75 + Math.sin(t * 23) * 0.1 + flash * 0.6;
    bolt.emissiveIntensity = (rainbow ? 0.4 : 0.9) * f; halo.opacity = 0.18 + 0.3 * flash + Math.sin(t * 17) * 0.05;
    sparks.forEach((s, i) => { s.visible = (Math.sin(t * (9 + i * 3) + i) > 0.3) || flash > 0.5; });
  };
  g.userData.setColor = apply;
  return { bone: 'torso', object: g };
}

function buildMeteorPet(color) {
  const g = new THREE.Group();
  const P = new THREE.Group(); P.position.set(0.8, 0.85, 0.05); g.add(P);
  const geo = new THREE.IcosahedronGeometry(0.15, 1);
  const p = geo.attributes.position; let seed = 3; const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
  const map = new Map();
  for (let i = 0; i < p.count; i++) { const k = `${p.getX(i).toFixed(3)},${p.getY(i).toFixed(3)},${p.getZ(i).toFixed(3)}`; if (!map.has(k)) map.set(k, 0.88 + rnd() * 0.22); const s = map.get(k); p.setXYZ(i, p.getX(i) * s, p.getY(i) * s, p.getZ(i) * s); }
  geo.computeVertexNormals();
  const rock = std('#5d6878', { roughness: 0.85, flatShading: true });
  const iceM = std(color, { roughness: 0.15, emissive: color, emissiveIntensity: 0.6, flatShading: true, transparent: true, opacity: 0.92 });
  const body = new THREE.Group(); P.add(body);
  body.add(mesh(geo, rock));
  // frozen crystal crust poking out
  // frosty ice shell over the top/back + crystal crust (face area kept clear)
  const shellM = std(color, { roughness: 0.1, emissive: color, emissiveIntensity: 0.35, flatShading: true, transparent: true, opacity: 0.55 });
  const shell = mesh(new THREE.IcosahedronGeometry(0.162, 1), shellM, 0, 0.035, -0.04); shell.scale.set(1, 0.8, 0.85); body.add(shell);
  for (let i = 0, n = 0; n < 16 && i < 200; i++) {
    const v = new THREE.Vector3(rnd() * 2 - 1, rnd() * 2 - 1, rnd() * 2 - 1).normalize();
    if (v.z > 0.35 && v.y < 0.55) continue; n++;
    const cr = mesh(new THREE.ConeGeometry(0.03, 0.09, 5), iceM, v.x * 0.14, v.y * 0.14, v.z * 0.14);
    cr.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), v); body.add(cr);
  }
  // cute face on +Z
  const white = std('#ffffff'), black = std('#111');
  for (const s of [-1, 1]) {
    body.add(mesh(new THREE.SphereGeometry(0.03, 12, 10), white, s * 0.05, 0.03, 0.13));
    body.add(mesh(new THREE.SphereGeometry(0.018, 10, 8), black, s * 0.05, 0.03, 0.155));
    body.add(mesh(new THREE.SphereGeometry(0.006, 6, 4), white, s * 0.05 + 0.006, 0.04, 0.172));
    body.add(mesh(new THREE.SphereGeometry(0.016, 8, 6), std('#ff9fb0'), s * 0.085, -0.015, 0.12));
  }
  body.add(rotated(mesh(new THREE.TorusGeometry(0.025, 0.007, 6, 12, Math.PI), black, 0, -0.025, 0.145), 'z', Math.PI));
  // icy trail: sprites streaming back and down
  const trailM = []; const trail = [];
  for (let i = 0; i < 12; i++) {
    const m = new THREE.SpriteMaterial({ map: softDotTexture(), color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    const s = new THREE.Sprite(m); s.userData.life = i / 12; P.add(s); trail.push(s); trailM.push(m);
  }
  const glow = new THREE.PointLight(color, 0.4, 1.5); P.add(glow);
  let t = 0;
  const step = () => {
    body.position.y = Math.sin(t * 2.2) * 0.04; body.rotation.y = Math.sin(t * 0.9) * 0.4; body.rotation.z = Math.sin(t * 1.3) * 0.1;
    trail.forEach(s => { const L = s.userData.life; s.position.set(-0.02 - L * 0.05, body.position.y + 0.06 + L * 0.28, -0.08 - L * 0.32); s.scale.setScalar(0.16 * (1 - L) + 0.03); s.material.opacity = 0.7 * (1 - L); });
  };
  step();
  g.userData.tick = (dt) => { t += dt; trail.forEach(s => { s.userData.life = (s.userData.life + dt * 0.9) % 1; }); step(); };
  g.userData.setColor = (c) => { iceM.color.set(c); iceM.emissive.set(c); shellM.color.set(c); shellM.emissive.set(c); trailM.forEach(m => m.color.set(c)); glow.color.set(c); };
  return { bone: 'torso', object: g };
}

function buildBlizzardHat(color) {
  const g = new THREE.Group();
  const cloud = new THREE.Group(); cloud.position.y = 1.02; g.add(cloud);
  const top = std(color, { roughness: 1 }), under = std(_tint(color, '#000000', 0.3), { roughness: 1 });
  let seed = 9; const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
  for (const [x, y, z, r] of [[0, 0.04, 0, 0.17], [-0.17, 0, 0.02, 0.13], [0.17, 0.01, -0.01, 0.14], [0.06, 0.1, -0.06, 0.13], [-0.08, 0.08, 0.08, 0.11], [0.0, 0, 0.13, 0.11], [0.0, 0, -0.14, 0.12], [-0.26, -0.03, 0, 0.08], [0.28, -0.03, 0.02, 0.09]])
    cloud.add(mesh(new THREE.SphereGeometry(r, 16, 12), top, x, y, z));
  const base = mesh(new THREE.CylinderGeometry(0.3, 0.26, 0.08, 20), under, 0, -0.07, 0); base.scale.z = 0.75; cloud.add(base);
  // sleepy face
  for (const s of [-1, 1]) cloud.add(rotated(mesh(new THREE.TorusGeometry(0.022, 0.006, 6, 12, Math.PI), std('#2a2f3a'), s * 0.06, -0.005, 0.238), 'z', Math.PI));
  cloud.add(mesh(new THREE.SphereGeometry(0.012, 8, 6), std('#2a2f3a'), 0, -0.04, 0.236));
  for (const s of [-1, 1]) cloud.add(mesh(new THREE.SphereGeometry(0.018, 8, 6), std('#ffb3c6', { roughness: 1 }), s * 0.1, -0.03, 0.225));
  // falling snow column from cloud to the hat line (wraps)
  const N = 70, pos = new Float32Array(N * 3), vel = [];
  const reset = (i, y) => { const a = rnd() * 6.28, r = Math.sqrt(rnd()) * 0.27; pos[i * 3] = Math.cos(a) * r; pos[i * 3 + 1] = y; pos[i * 3 + 2] = Math.sin(a) * r * 0.75; vel[i] = 0.18 + rnd() * 0.15; };
  for (let i = 0; i < N; i++) reset(i, -0.1 - rnd() * 0.42);
  const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  cloud.add(new THREE.Points(pg, new THREE.PointsMaterial({ size: 0.05, color: '#f4fbff', map: softDotTexture(), transparent: true, depthWrite: false })));
  // chunky blocky flakes (R6 style) falling between the soft ones
  const flakeM = std('#ffffff', { roughness: 0.4, emissive: '#cfeaff', emissiveIntensity: 0.4 });
  const flakes = [];
  for (let i = 0; i < 16; i++) { const f = mesh(new THREE.BoxGeometry(0.03, 0.03, 0.03), flakeM); f.castShadow = false; f.userData.v = 0.2 + rnd() * 0.12; cloud.add(f); flakes.push(f); const a = rnd() * 6.28, r = Math.sqrt(rnd()) * 0.26; f.position.set(Math.cos(a) * r, -0.1 - rnd() * 0.42, Math.sin(a) * r * 0.75); }
  let t = 0;
  g.userData.tick = (dt) => {
    t += dt; cloud.position.y = 1.02 + Math.sin(t * 1.5) * 0.02; cloud.rotation.y = Math.sin(t * 0.4) * 0.15;
    for (let i = 0; i < N; i++) { pos[i * 3 + 1] -= vel[i] * dt; pos[i * 3] += Math.sin(t * 2 + i) * 0.02 * dt; if (pos[i * 3 + 1] < -0.52) reset(i, -0.1); }
    flakes.forEach((f, i) => { f.position.y -= f.userData.v * dt; f.rotation.set(t * 2 + i, t * 1.5, 0); if (f.position.y < -0.52) f.position.y = -0.1; });
    pg.attributes.position.needsUpdate = true;
  };
  g.userData.setColor = (c) => { top.color.set(c); under.color.copy(_tint(c, '#000000', 0.3)); };
  return { bone: 'head', object: g };
}

export class Avatar {
  constructor() {
    this.root = new THREE.Group();
    this.root.name = 'avatar';
    this.mats = { skin: std(DEFAULT.skin), torso: std(DEFAULT.torso), arms: std(DEFAULT.skin), legs: std(DEFAULT.legs) };
    const faceMat = new THREE.MeshStandardMaterial({ map: faceTexture(), color: DEFAULT.skin, roughness: 0.6 }); // per-avatar face canvas, texture & material
    this.faceMat = faceMat;
    // talking state (driven by animate(); no timers)
    this._talkLeft = 0;        // ms of auto talking remaining (talk())
    this._talkManual = false;  // setTalking(true)
    this._talkClock = 0; this._mouthFrame = 0; this._mouthSeq = 0; this._talkActive = false;
    this._mouthOverlay = null; // lazily built for face cosmetics that cover the mouth
    const limb = new THREE.BoxGeometry(0.5, 1, 0.5);

    this.bones = {};
    const mk = (name, x, y) => { const p = new THREE.Group(); p.position.set(x, y, 0); this.root.add(p); this.bones[name] = p; return p; };
    mk('legL', -0.25, 1).add(mesh(limb, this.mats.legs, 0, -0.5, 0));
    mk('legR', 0.25, 1).add(mesh(limb, this.mats.legs, 0, -0.5, 0));
    mk('torso', 0, 1.5).add(mesh(new THREE.BoxGeometry(1, 1, 0.5), this.mats.torso));
    mk('armL', -0.75, 2).add(mesh(limb, this.mats.arms, 0, -0.5, 0));
    mk('armR', 0.75, 2).add(mesh(limb, this.mats.arms, 0, -0.5, 0));
    // head: face texture on +Z (material index 4)
    const hm = this.mats.skin;
    this.headMesh = mesh(new THREE.BoxGeometry(0.62, 0.62, 0.62), [hm, hm, hm, hm, faceMat, hm], 0, 0.31, 0);
    mk('head', 0, 2).add(this.headMesh);

    this.attached = {}; // slot -> object
    this.custom = null;
    this.rocketColors = { body: '#e8f4ff', fins: '#3f8fd0', trim: '#7fe3ff' };
    this.cosmeticColors = {}; // id -> hex (customizable cosmetics)
    this.time = 0;
    this._initTrail();
  }

  setColors({ skin, shirt, pants }) {
    this.mats.skin.color.set(skin || DEFAULT.skin);
    this.faceMat.color.set(skin || DEFAULT.skin);
    this.mats.torso.color.set(shirt || DEFAULT.torso);
    this.mats.arms.color.set(shirt || skin || DEFAULT.skin);
    this.mats.legs.color.set(pants || DEFAULT.legs);
  }

  /** Apply equipped cosmetics from a profile. */
  /** Free this avatar's GPU resources (face canvas texture, materials, geometries). */
  dispose() {
    this.root.parent?.remove(this.root);
    const seen = new Set();
    this.root.traverse(o => {
      if (o.geometry && !seen.has(o.geometry)) { seen.add(o.geometry); o.geometry.dispose(); }
      for (const m of [].concat(o.material || [])) {
        if (seen.has(m)) continue; seen.add(m);
        m.map?.dispose(); m.dispose();
      }
    });
    this.attached = {}; this._mouthOverlay = null;
  }

  // ---------- talking ----------
  /** Flap the mouth for durationMs (default 2000). Calling again extends it. */
  talk(durationMs = 2000) {
    const ms = Number(durationMs);
    if (!(ms > 0)) return this;
    this._talkLeft += ms;
    return this;
  }
  /** Manual control: true = keep talking until setTalking(false). false also cancels talk(). */
  setTalking(on) {
    this._talkManual = !!on;
    if (!on) this._talkLeft = 0;
    if (!on) this._setMouthFrame(0);
    return this;
  }
  /** True while the mouth is animating. */
  isTalking() { return this._talkManual || this._talkLeft > 0; }

  _faceCoversMouth() {
    return Object.values(this.attached).some(o => o.userData.coversMouth);
  }
  _setMouthFrame(frame) {
    const covered = frame !== 0 && this._faceCoversMouth();
    // classic canvas face
    const tex = this.faceMat.map, g = tex?.userData?.ctx;
    if (g && this._mouthFrame !== frame) { drawFace(g, frame); tex.needsUpdate = true; }
    this._mouthFrame = frame;
    // overlay for face cosmetics that hide the mouth (set object.userData.coversMouth = true)
    if (covered && !this._mouthOverlay) this._buildMouthOverlay();
    if (this._mouthOverlay) {
      this._mouthOverlay.visible = covered;
      if (covered) { const og = this._mouthOverlay.userData.ctx; og.clearRect(0, 0, 64, 64); drawMouth(og, frame, 32, 14); this._mouthOverlay.material.map.needsUpdate = true; }
    }
  }
  _buildMouthOverlay() {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.31, 0.31), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false }));
    m.position.set(0, 0.213, 0.4); m.renderOrder = 5; m.userData.ctx = c.getContext('2d'); m.visible = false;
    this.bones.head.add(m); this._mouthOverlay = m;
  }
  _updateTalk(dt) {
    const ms = Math.max(0, dt * 1000);
    if (this._talkLeft > 0) this._talkLeft = Math.max(0, this._talkLeft - ms);
    if (!this.isTalking()) { if (this._talkActive || this._mouthFrame !== 0) this._setMouthFrame(0); this._talkActive = false; this._talkClock = 0; return; }
    this._talkClock += ms;
    if (this._talkClock >= 120 || !this._talkActive) {
      if (!this._talkActive) this._mouthSeq = -1;
      this._talkActive = true;
      this._talkClock %= 120;
      const seq = [2, 1, 2, 0, 1, 2, 1, 0];
      this._mouthSeq = (this._mouthSeq + 1) % seq.length;
      const f = seq[this._mouthSeq];
      this._setMouthFrame(f);
    }
  }

  applyLoadout(profile) {
    if (profile.rocketColors) this.rocketColors = { ...profile.rocketColors };
    if (profile.cosmeticColors) this.cosmeticColors = { ...profile.cosmeticColors };
    for (const slot of Object.keys(this.attached)) this._detach(slot);
    let skin = null, shirt = null, pants = null;
    for (const [slot, id] of Object.entries(profile.equipped || {})) {
      const item = COSMETIC_BY_ID[id];
      if (!item) continue;
      if (item.kind === 'skin') skin = item.color;
      else if (item.kind === 'shirt') { shirt = item.color; pants = item.pants; }
      else if (BUILDERS[id]) {
        const { bone, object, extras } = BUILDERS[id](this.rocketColors, this.cosmeticColors[id] || item.defaultColor);
        object.traverse(o => { if (o.isMesh) o.castShadow = true; });
        this.bones[bone].add(object);
        // optional extra pieces on other bones (e.g. sweater sleeves); removed with the main object
        object.userData.extras = (extras || []).map(e => { e.object.traverse(o => { if (o.isMesh) o.castShadow = true; }); this.bones[e.bone].add(e.object); return e.object; });
        object.userData.cosmeticId = id;
        this.attached[slot] = object;
      }
    }
    this.setColors({ skin, shirt, pants });
  }

  setRocketColors(colors) {
    this.rocketColors = { ...colors };
    const rocket = Object.values(this.attached).find(o => o.userData.cosmeticId === 'icerocket');
    if (rocket) {
      const m = rocket.userData.mats;
      m.body.color.set(colors.body); m.fins.color.set(colors.fins);
      m.trim.color.set(colors.trim); m.trim.emissive.set(colors.trim);
    }
  }
  /** Recolor a customizable cosmetic (e.g. earmuffs) live. */
  setCosmeticColor(id, color) {
    this.cosmeticColors = { ...this.cosmeticColors, [id]: color };
    const o = Object.values(this.attached).find(o => o.userData.cosmeticId === id);
    o?.userData.setColor?.(color);
  }
  setCosmeticColors(colors) { for (const [id, c] of Object.entries(colors || {})) this.setCosmeticColor(id, c); }
  hasRocket() { return Object.values(this.attached).some(o => o.userData.cosmeticId === 'icerocket'); }

  _detach(slot) {
    const o = this.attached[slot];
    if (o) { o.parent?.remove(o); (o.userData.extras || []).forEach(x => x.parent?.remove(x)); }
    delete this.attached[slot];
  }

  /** Attach a user-uploaded model as a custom cosmetic. wear = {bone, scale, x, y, z, rotY} */
  setCustomWear(object, wear) {
    if (this.custom) this.custom.parent?.remove(this.custom);
    this.custom = null;
    if (!object || !wear) return;
    const holder = new THREE.Group();
    holder.add(object);
    holder.position.set(wear.x || 0, wear.y || 0, wear.z || 0);
    holder.rotation.y = wear.rotY || 0;
    holder.scale.setScalar(wear.scale || 0.5);
    (this.bones[wear.bone] || this.bones.head).add(holder);
    this.custom = holder;
  }
  updateCustomWear(wear) {
    if (!this.custom || !wear) return;
    const bone = this.bones[wear.bone] || this.bones.head;
    if (this.custom.parent !== bone) bone.add(this.custom);
    this.custom.position.set(wear.x, wear.y, wear.z);
    this.custom.rotation.y = wear.rotY;
    this.custom.scale.setScalar(wear.scale);
  }

  // ---- rocket frost trail ----
  _initTrail() {
    const N = 300;
    this.trailData = Array.from({ length: N }, () => ({ life: 0, v: new THREE.Vector3() }));
    const pos = new Float32Array(N * 3), col = new Float32Array(N * 3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    this.trail = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.22, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.trail.frustumCulled = false;
    this.trailIdx = 0;
  }
  _emitTrail(count) {
    const rocket = Object.values(this.attached).find(o => o.userData.cosmeticId === 'icerocket');
    if (!rocket) return;
    const p = new THREE.Vector3(); rocket.userData.nozzle.getWorldPosition(p);
    const arr = this.trail.geometry.attributes.position.array;
    for (let k = 0; k < count; k++) {
      const i = this.trailIdx = (this.trailIdx + 1) % this.trailData.length;
      const d = this.trailData[i];
      d.life = 0.6 + Math.random() * 0.4;
      d.v.set((Math.random() - 0.5) * 1.5, -4 - Math.random() * 3, (Math.random() - 0.5) * 1.5);
      arr[i * 3] = p.x + (Math.random() - 0.5) * 0.15; arr[i * 3 + 1] = p.y; arr[i * 3 + 2] = p.z + (Math.random() - 0.5) * 0.15;
    }
  }
  _updateTrail(dt) {
    const pa = this.trail.geometry.attributes.position, ca = this.trail.geometry.attributes.color;
    const flame = new THREE.Color('#ffb347'), frost = new THREE.Color(this.rocketColors.trim);
    const c = new THREE.Color();
    this.trailData.forEach((d, i) => {
      if (d.life <= 0) { ca.array[i * 3] = ca.array[i * 3 + 1] = ca.array[i * 3 + 2] = 0; return; }
      d.life -= dt;
      pa.array[i * 3] += d.v.x * dt; pa.array[i * 3 + 1] += d.v.y * dt; pa.array[i * 3 + 2] += d.v.z * dt;
      const t = Math.max(0, d.life);
      c.copy(frost).lerp(flame, Math.min(1, t * 1.2)).multiplyScalar(t);
      ca.array[i * 3] = c.r; ca.array[i * 3 + 1] = c.g; ca.array[i * 3 + 2] = c.b;
    });
    pa.needsUpdate = true; ca.needsUpdate = true;
  }

  /** Animate limbs. speed: 0..1 walk amount; air: in air; flying: rocket thrust */
  animate(dt, { speed = 0, air = false, flying = false } = {}) {
    this.time += dt * (4 + speed * 6);
    const swing = air ? 0.5 : Math.sin(this.time) * 0.9 * speed;
    this.bones.legL.rotation.x = air ? 0.3 : swing;
    this.bones.legR.rotation.x = air ? -0.3 : -swing;
    this.bones.armL.rotation.x = flying ? -0.2 : -swing;
    this.bones.armR.rotation.x = flying ? -0.2 : swing;
    const wings = Object.values(this.attached).find(o => o.userData.wings);
    if (wings) {
      const f = Math.sin(performance.now() / (air ? 90 : 400)) * (air ? 0.6 : 0.15);
      wings.userData.wings[0].rotation.y = 0.5 + f; wings.userData.wings[1].rotation.y = -0.5 - f;
    }
    if (flying) this._emitTrail(8);
    else if (this.hasRocket() && Math.random() < 0.15) this._emitTrail(1);
    this._updateTrail(dt);
    for (const o of Object.values(this.attached)) o.userData.tick?.(dt);
    this._updateTalk(dt);
  }
}
