// Blocky Roblox-style avatar + 3D cosmetics. Shared across every game.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { COSMETIC_BY_ID } from '../data/cosmetics.js';
import WIND_MAIN_OGG from '../assets/audio/tornado_hat_wind_loop.ogg?url';
import WIND_MAIN_MP3 from '../assets/audio/tornado_hat_wind_loop.mp3?url';
import WIND_HIGH_OGG from '../assets/audio/tornado_hat_wind_loop_high.ogg?url';

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
  wh_carrot_nose(_rc, color) { return buildCarrotNose(color); },
  wh_bridge_badge(_rc, color) { return buildBridgeBadge(color); },
  wh_carol_bells(_rc, color) { return buildCarolBells(color); },
  wh_pass_goggles(_rc, color) { return buildPassGoggles(color); },
  wh_snowball_sack(_rc, color) { return buildSnowballSack(color); },
  wh_baker_hat(_rc, color) { return buildBakerHat(color); },
  wh_fishing_lure(_rc, color) { return buildFishingLure(color); },
  wh_parcel_satchel(_rc, color) { return buildParcelSatchel(color); },
  wh_ranger_badge(_rc, color) { return buildRangerBadge(color); },
  wh_wolf_pup_pal(_rc, color) { return buildWolfPup(color); },
  wh_wool_mittens(_rc, color) { return buildWoolMittens(color); },
  wh_puffer_vest(_rc, color) { return buildPufferVest(color); },
  wh_jingle_hat(_rc, color) { return buildJingleHat(color); },
  wh_earflap_cap(_rc, color) { return buildEarflapCap(color); },
  wh_hot_cocoa(_rc, color) { return buildHotCocoa(color); },
  wh_lantern_hat(_rc, color) { return buildLanternHat(color); },
  wh_aurora_scarf(_rc, color) { return buildAuroraScarf(color); },
  wh_pine_cloak(_rc, color) { return buildPineCloak(color); },
  wh_crystal_pet(_rc, color) { return buildCrystalPet(color); },
  wh_frostspire_crown(_rc, color) { return buildFrostspireCrown(color); },
  wh_blizzard_back(_rc, color) { return buildBlizzardBack(color); },
  wh_peppermint_shades(_rc, color) { return buildPeppermintShades(color); },
  wh_snowflake_halo(_rc, color) { return buildSnowflakeHalo(color); },
  wh_holly_garland(_rc, color) { return buildHollyGarland(color); },
  wh_gift_bow(_rc, color) { return buildGiftBow(color); },
  wh_plus_frost_wings(_rc, color) { return buildPlusFrostWings(color); },
  wh_plus_aurora_crown(_rc, color) { return buildPlusAuroraCrown(color); },
  wh_plus_crystal_scepter(_rc, color) { return buildPlusCrystalScepter(color); },
  earmuffs(_rc, color) { return buildEarmuffs(color); },
  snowglobe_pack(_rc, color) { return buildSnowGlobe(color); },
  cocoa_mug(_rc, color) { return buildCocoaMug(color); },
  storm_goggles(_rc, color) { return buildStormGoggles(color); },
  hail_umbrella(_rc, color) { return buildHailUmbrella(color); },
  ice_skates(_rc, color) { return buildIceSkates(color); },
  storm_slicker(_rc, color) { return buildStormSlicker(color); },
  tornado_hat(_rc, color) { return buildTornadoHat(color); },
  lightning_back(_rc, color) { return buildLightningBack(color); },
  meteor_pet(_rc, color) { return buildMeteorPet(color); },
  blizzard_hat(_rc, color) { return buildBlizzardHat(color); },
  owl_hood(_rc, color) { return buildOwlHood(color); },
  frost_specs(_rc, color) { return buildFrostSpecs(color); },
  cable_sweater(_rc, color) { return buildSweater(color); },
  frost_lantern(_rc, color) { return buildFrostLantern(color); },
  bubble_wand(_rc, color) { return buildBubbleWand(color); },
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

function buildBubbleWand(color) {
  const g = new THREE.Group(); g.position.set(0, -0.92, 0.22); // in front of the right fist
  const W = new THREE.Group(); W.rotation.x = 0.35; g.add(W); // tilt the wand forward a touch
  const stickM = std('#f4f1ea', { roughness: 0.4 });
  const accent = std(color, { roughness: 0.3, metalness: 0.1 });
  const stripe = std(_tint(color, '#ffffff', 0.55), { roughness: 0.35 });
  // candy-striped handle
  W.add(mesh(new THREE.CylinderGeometry(0.02, 0.024, 0.5, 12), stickM, 0, 0.1, 0));
  for (let i = 0; i < 5; i++) {
    const r = mesh(new THREE.TorusGeometry(0.023, 0.006, 6, 14), i % 2 ? stripe : accent, 0, -0.08 + i * 0.09, 0);
    r.rotation.x = Math.PI / 2 + 0.25; W.add(r);
  }
  W.add(mesh(new THREE.SphereGeometry(0.032, 14, 10), accent, 0, -0.16, 0)); // pommel
  // loop tip with a little star knob and soap film
  const tip = new THREE.Group(); tip.position.y = 0.45; W.add(tip);
  const ring = mesh(new THREE.TorusGeometry(0.1, 0.014, 10, 32), accent); tip.add(ring);
  tip.add(mesh(new THREE.CylinderGeometry(0.018, 0.02, 0.06, 10), accent, 0, -0.1, 0));
  const star = mesh(new THREE.OctahedronGeometry(0.03), stripe, 0, 0.115, 0); star.scale.set(1, 1.3, 0.5); tip.add(star);
  const filmM = new THREE.MeshPhysicalMaterial({ color: _tint(color, '#ffffff', 0.6), transparent: true, opacity: 0.32, roughness: 0.05,
    iridescence: 1, iridescenceIOR: 1.3, iridescenceThicknessRange: [120, 480], depthWrite: false, side: THREE.DoubleSide,
    emissive: color, emissiveIntensity: 0.15 });
  const film = new THREE.Mesh(new THREE.CircleGeometry(0.095, 28), filmM); film.castShadow = false; tip.add(film);
  // bubbles: iridescent shells + additive rim glow + specular glint
  const dot = softDotTexture();
  const N = 10, bubbles = [];
  const shellGeo = new THREE.SphereGeometry(1, 16, 12);
  for (let i = 0; i < N; i++) {
    const shellM = new THREE.MeshPhysicalMaterial({ color: _tint(color, '#ffffff', 0.5), transparent: true, opacity: 0.28, roughness: 0.02,
      iridescence: 1, iridescenceIOR: 1.33, iridescenceThicknessRange: [100, 600], depthWrite: false,
      emissive: color, emissiveIntensity: 0.2 });
    const b = new THREE.Group();
    const shell = new THREE.Mesh(shellGeo, shellM); b.add(shell);
    const rim = new THREE.Sprite(new THREE.SpriteMaterial({ map: dot, color, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending }));
    rim.scale.setScalar(2.6); b.add(rim);
    const glint = new THREE.Sprite(new THREE.SpriteMaterial({ map: dot, color: '#ffffff', transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending }));
    glint.scale.setScalar(0.45); glint.position.set(-0.4, 0.45, 0.6); b.add(glint);
    g.add(b);
    bubbles.push({ b, shell, rim, glint, life: i / N * 2.6, max: 2.2 + Math.random() * 0.9, size: 0.035 + Math.random() * 0.05,
      vx: (Math.random() - 0.5) * 0.25, vz: 0.12 + Math.random() * 0.2, ph: Math.random() * 6.28, x: 0, y: 0, z: 0 });
  }
  const origin = new THREE.Vector3();
  const spawn = (p) => { // emerge from the ring
    origin.set((Math.random() - 0.5) * 0.08, 0.45 + (Math.random() - 0.5) * 0.08, 0).applyEuler(W.rotation);
    p.x = origin.x; p.y = origin.y; p.z = origin.z + 0.03; p.life = 0; p.max = 2.2 + Math.random() * 0.9;
    p.size = 0.035 + Math.random() * 0.05; p.vx = (Math.random() - 0.5) * 0.25; p.vz = 0.12 + Math.random() * 0.2;
  };
  bubbles.forEach(p => { const l = p.life; spawn(p); p.life = l; p.x += p.vx * l; p.y += 0.22 * l; p.z += p.vz * l; });
  let t = 0;
  g.userData.tick = (dt) => {
    t += dt;
    W.rotation.z = Math.sin(t * 1.3) * 0.08;
    filmM.opacity = 0.26 + Math.sin(t * 3) * 0.08; film.scale.setScalar(1 + Math.sin(t * 5) * 0.03);
    for (const p of bubbles) {
      p.life += dt;
      if (p.life >= p.max) spawn(p);
      const k = p.life / p.max;
      p.x += (p.vx + Math.sin(t * 2.2 + p.ph) * 0.12) * dt; p.y += (0.18 + k * 0.12) * dt; p.z += p.vz * dt;
      const grow = Math.min(1, p.life / 0.35);                 // blown out of the ring
      const pop = k > 0.9 ? 1 + (k - 0.9) * 4 : 1;             // swell right before the pop
      const fade = k > 0.9 ? Math.max(0, 1 - (k - 0.9) * 10) : 1;
      const s = p.size * grow * pop;
      p.b.position.set(p.x, p.y, p.z);
      p.b.scale.set(s * (1 + Math.sin(t * 9 + p.ph) * 0.07), s * (1 + Math.cos(t * 8 + p.ph) * 0.07), s); // wobble
      p.shell.material.opacity = 0.28 * fade; p.rim.material.opacity = 0.35 * fade * (1 + (pop - 1) * 2);
      p.glint.material.opacity = 0.9 * fade;
    }
  };
  g.userData.setColor = (c) => {
    accent.color.set(c); stripe.color.copy(_tint(c, '#ffffff', 0.55));
    filmM.color.copy(_tint(c, '#ffffff', 0.6)); filmM.emissive.set(c);
    for (const p of bubbles) { p.shell.material.color.copy(_tint(c, '#ffffff', 0.5)); p.shell.material.emissive.set(c); p.rim.material.color.set(c); }
  };
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
// Wind loop for a worn Frost Tornado Hat (in-house audio by Iceberg Sound Designer).
// Imported with ?url so the single-file build inlines them. Main loop .ogg with .mp3 fallback
// (Safari), plus an optional in-sync "high" layer that fades in when another player is very close.
export const TORNADO_WIND_URL = WIND_MAIN_OGG;
export const WIND_START_DIST = 20, WIND_STOP_DIST = 30;
const _windBufs = new WeakMap(); // AudioContext -> Promise<{ main, high }>
async function decodeFirst(ctx, urls) {
  for (const u of urls) {
    try { const ab = await (await fetch(u)).arrayBuffer(); return await ctx.decodeAudioData(ab); } catch {}
  }
  return null;
}
function loadWindBuffers(ctx) {
  if (!_windBufs.has(ctx)) _windBufs.set(ctx, (async () => ({ main: await decodeFirst(ctx, [WIND_MAIN_OGG, WIND_MAIN_MP3]), high: await decodeFirst(ctx, [WIND_HIGH_OGG]) }))());
  return _windBufs.get(ctx);
}

const FUNNEL_VS = `
  uniform float uTime, uTwist;
  varying vec2 vUv; varying float vFres;
  void main() {
    vUv = uv;
    vec3 p = position;
    float a = uTwist * uv.y + sin(uTime * 2.0 + uv.y * 6.0) * 0.15;
    float c = cos(a), s = sin(a);
    p.xz = mat2(c, -s, s, c) * p.xz;
    p.x += sin(uTime * 3.0 + uv.y * 5.0) * 0.02 * uv.y;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vec3 n = normalize(normalMatrix * normal);
    vFres = 1.0 - abs(dot(n, normalize(-mv.xyz)));
    gl_Position = projectionMatrix * mv;
  }`;
const FUNNEL_FS = `
  uniform float uTime, uSpeed, uOpacity, uFlash, uShimmer;
  uniform vec3 uColor;
  varying vec2 vUv; varying float vFres;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
  void main() {
    vec2 uv = vec2(vUv.x * 3.0 - uTime * uSpeed + vUv.y * 1.6, vUv.y * 2.0 - uTime * 0.4);
    float n = noise(uv * vec2(4.0, 3.0)) * 0.6 + noise(uv * vec2(9.0, 7.0)) * 0.4;
    float bands = smoothstep(0.35, 0.75, sin((vUv.x * 6.2832 * 3.0) + vUv.y * 9.0 - uTime * uSpeed * 6.0) * 0.5 + 0.5);
    float a = (n * 0.45 + bands * 0.55) * (0.25 + vFres * 0.85);
    a *= smoothstep(0.0, 0.08, vUv.y) * (1.0 - smoothstep(0.88, 1.0, vUv.y) * 0.6);
    vec3 aur = 0.5 + 0.5 * cos(6.2832 * (vec3(0.0, 0.33, 0.67) + vUv.y * 0.6 + uTime * 0.15));
    vec3 col = mix(uColor, mix(uColor, aur, 0.55), uShimmer * (0.4 + 0.6 * bands));
    col = mix(col, vec3(1.0), n * 0.12 + uFlash * 0.5);
    col *= 0.85 + bands * 0.3;
    gl_FragColor = vec4(col, clamp(a * uOpacity + uFlash * 0.25 * a, 0.0, 1.0));
  }`;

function buildTornadoHat(color) {
  const g = new THREE.Group();
  const spin = new THREE.Group(); spin.position.y = 0.63; g.add(spin);
  const H = 0.78;
  const radius = (t) => 0.06 + Math.pow(t, 1.5) * 0.36;
  const mats = [];
  // three twisted translucent shells (outer -> inner), each scrolling at its own speed
  [[1.0, 0.8, 1.0, 3.5], [0.78, 0.75, -1.4, 4.5], [0.55, 0.45, 1.9, 6.0]].forEach(([sc, op, sp, tw], i) => {
    const prof = []; for (let k = 0; k <= 24; k++) { const t = k / 24; prof.push(new THREE.Vector2(radius(t) * sc + 0.006 * i, t * H)); }
    const m = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: i * 3.1 }, uSpeed: { value: sp * 0.35 }, uTwist: { value: tw }, uOpacity: { value: op }, uFlash: { value: 0 }, uShimmer: { value: 0.8 }, uColor: { value: new THREE.Color(color) } },
      vertexShader: FUNNEL_VS, fragmentShader: FUNNEL_FS, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: i === 2 ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    const shell = new THREE.Mesh(new THREE.LatheGeometry(prof, 48, 0, Math.PI * 2), m); shell.renderOrder = 3 + i; shell.userData.sp = sp;
    spin.add(shell); mats.push(m);
  });
  // frosty crown: icy ring with crystal spikes hugging the top of the head
  const iceM = std(color, { roughness: 0.08, metalness: 0.2, emissive: color, emissiveIntensity: 0.35, flatShading: true, transparent: true, opacity: 0.95 });
  const frostM = std('#f4fbff', { roughness: 0.6 });
  g.add(rotated(mesh(new THREE.TorusGeometry(0.29, 0.035, 8, 32), frostM, 0, 0.635, 0), 'x', Math.PI / 2));
  g.add(rotated(mesh(new THREE.TorusGeometry(0.29, 0.016, 6, 32), iceM, 0, 0.67, 0), 'x', Math.PI / 2));
  for (let i = 0; i < 10; i++) {
    const a = i / 10 * Math.PI * 2, tall = i % 2 ? 0.09 : 0.15;
    const sp = mesh(new THREE.ConeGeometry(0.035, tall, 5), iceM, Math.cos(a) * 0.29, 0.66 + tall / 2, Math.sin(a) * 0.29);
    sp.rotation.set(Math.sin(a) * 0.25, 0, -Math.cos(a) * 0.25); g.add(sp);
  }
  for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2 + Math.PI / 4; const gem = mesh(new THREE.OctahedronGeometry(0.03), std('#ffffff', { emissive: color, emissiveIntensity: 1, roughness: 0.1 }), Math.cos(a) * 0.31, 0.64, Math.sin(a) * 0.31); g.add(gem); }
  // base swirl puff + glow
  spin.add(mesh(new THREE.CylinderGeometry(0.1, 0.16, 0.035, 20), iceM, 0, 0.0, 0));
  const glowM = new THREE.SpriteMaterial({ map: softDotTexture(), color, transparent: true, opacity: 0.18, depthWrite: false, blending: THREE.AdditiveBlending });
  const glow = new THREE.Sprite(glowM); glow.scale.set(0.8, 0.9, 1); glow.position.y = H * 0.45; spin.add(glow);
  // lightning flickers inside the funnel
  const boltM = new THREE.LineBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0 });
  const boltGeo = new THREE.BufferGeometry(); boltGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(8 * 3), 3));
  const bolt = new THREE.Line(boltGeo, boltM); spin.add(bolt);
  const reBolt = () => { const p = boltGeo.attributes.position; let a = Math.random() * 6.28; for (let k = 0; k < 8; k++) { const t = 0.15 + k / 7 * 0.75, r = radius(t) * 0.55; a += (Math.random() - 0.5) * 1.2; p.setXYZ(k, Math.cos(a) * r, t * H, Math.sin(a) * r); } p.needsUpdate = true; };
  // dense orbiting snow (Points) — positions computed analytically each frame
  const N = 260, pos = new Float32Array(N * 3), seeds = new Float32Array(N * 4);
  for (let i = 0; i < N; i++) seeds.set([Math.random() * 6.28, Math.random(), 1.5 + Math.random() * 2.5, 0.9 + Math.random() * 0.5], i * 4);
  const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const snowM = new THREE.PointsMaterial({ size: 0.028, map: softDotTexture(), transparent: true, depthWrite: false, color: '#ffffff' });
  spin.add(new THREE.Points(pg, snowM));
  // instanced ice shards + debris
  const DN = 18, dummy = new THREE.Object3D();
  const shards = new THREE.InstancedMesh(new THREE.OctahedronGeometry(0.03), std('#dff6ff', { roughness: 0.05, emissive: color, emissiveIntensity: 0.3, flatShading: true }), DN);
  const planks = new THREE.InstancedMesh(new THREE.BoxGeometry(0.08, 0.016, 0.03), std('#8a5a33'), 6);
  const blocks = new THREE.InstancedMesh(new THREE.BoxGeometry(0.045, 0.045, 0.045), std('#e8f6ff', { roughness: 0.15 }), 6);
  [shards, planks, blocks].forEach(m => { m.castShadow = false; spin.add(m); });
  const orbit = (m, n, base, t, k) => { for (let i = 0; i < n; i++) { const ph = i / n * 6.28 + base, y = ((i * 0.37 + base) % 1) * H * 0.9 + 0.06, r = radius(y / H) + 0.07 + (i % 3) * 0.03, a = ph + t * (2 + (i % 3) * 0.6) * k; dummy.position.set(Math.cos(a) * r, y + Math.sin(t * 2 + i) * 0.02, Math.sin(a) * r); dummy.rotation.set(t * 3 + i, t * 2 + i, 0); dummy.updateMatrix(); m.setMatrixAt(i, dummy.matrix); } m.instanceMatrix.needsUpdate = true; };
  let t = 0, phase = 0, flash = 0;
  const step = (dt) => {
    const prox = g.userData.proximity ?? 0, speed = 1 + prox * 1.8;
    phase += dt * speed; t += dt;
    flash = Math.max(0, flash - dt * 5);
    if (Math.random() < dt * (0.5 + prox * 2.5)) { flash = 1; reBolt(); }
    boltM.opacity = flash > 0.3 ? flash : 0;
    for (const m of mats) { m.uniforms.uTime.value += dt * speed; m.uniforms.uFlash.value = flash; }
    spin.children.forEach(c => { if (c.userData.sp) c.rotation.y = -phase * c.userData.sp * 2; });
    glowM.opacity = 0.16 + 0.06 * Math.sin(t * 3) + flash * 0.35 + prox * 0.15;
    const p = pg.attributes.position;
    for (let i = 0; i < N; i++) { const a0 = seeds[i * 4], y0 = seeds[i * 4 + 1], sp = seeds[i * 4 + 2], rs = seeds[i * 4 + 3]; const y = (y0 + phase * 0.12) % 1, r = radius(y) * rs + 0.02, a = a0 + phase * sp; p.setXYZ(i, Math.cos(a) * r, y * H, Math.sin(a) * r); }
    p.needsUpdate = true;
    orbit(shards, DN, 0.1, phase, 1); orbit(planks, 6, 0.55, phase, 0.8); orbit(blocks, 6, 0.3, phase, 0.9);
  };
  step(0.016);
  g.userData.tick = step;
  g.userData.isTornado = true;
  g.userData.setColor = (c) => { mats.forEach(m => m.uniforms.uColor.value.set(c)); iceM.color.set(c); iceM.emissive.set(c); glowM.color.set(c); shards.material.emissive.set(c); };
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
  // frosted mount plate with a color trim ring behind the bolt
  const trimM = std(color === 'rainbow' ? '#ffffff' : color, { emissive: color === 'rainbow' ? '#ffffff' : color, emissiveIntensity: 0.6, roughness: 0.2, metalness: 0.4 });
  const plate = mesh(new THREE.CylinderGeometry(0.27, 0.27, 0.03, 6), std('#dcecf7', { roughness: 0.35, metalness: 0.3 }), 0, 0.03, 0.07); plate.rotation.x = Math.PI / 2; plate.rotation.y = Math.PI / 6; B.add(plate);
  { const tr = mesh(new THREE.TorusGeometry(0.27, 0.02, 6, 6), trimM, 0, 0.03, 0.05); tr.rotation.z = Math.PI / 6; B.add(tr); }
  // two small branch bolts
  for (const [x, y, r, sc] of [[-0.16, 0.18, 0.9, 0.32], [0.17, -0.12, -2.3, 0.26]]) {
    const br = mesh(geo, bolt, x, y, 0.0); br.scale.setScalar(sc); br.rotation.z = r; br.userData.branch = true; B.add(br);
  }
  // crackle sparks drifting around the bolt (Points)
  const SN = 40, spos = new Float32Array(SN * 3), sseed = [];
  for (let i = 0; i < SN; i++) sseed.push([Math.random() * 6.28, (Math.random() - 0.5) * 1.0, 0.12 + Math.random() * 0.15, 1 + Math.random() * 3]);
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(spos, 3));
  const sparkPtsM = new THREE.PointsMaterial({ size: 0.03, map: softDotTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  B.add(new THREE.Points(sg, sparkPtsM));
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
    halo.color.set(rainbow ? '#ffe9ff' : col); sparkM.color.set(rainbow ? '#ffffff' : col); sparkPtsM.color.set(rainbow ? '#fff4c0' : col);
    trimM.color.set(rainbow ? '#ffffff' : col); trimM.emissive.set(rainbow ? '#ff7fd8' : col);
    B.children.forEach(c => { if (c.userData.branch) c.material = rainbow ? rainbowM : bolt; });
  };
  apply(color);
  let t = 0, flash = 0;
  g.userData.tick = (dt) => {
    t += dt; flash = Math.max(0, flash - dt * 4); if (Math.random() < dt * 1.5) flash = 1;
    const f = 0.75 + Math.sin(t * 23) * 0.1 + flash * 0.6;
    bolt.emissiveIntensity = (rainbow ? 0.4 : 0.9) * f; halo.opacity = 0.18 + 0.3 * flash + Math.sin(t * 17) * 0.05;
    sparks.forEach((s, i) => { s.visible = (Math.sin(t * (9 + i * 3) + i) > 0.3) || flash > 0.5; });
    for (let i = 0; i < SN; i++) { const [a0, y0, r, sp] = sseed[i]; const a = a0 + t * sp; spos[i * 3] = Math.cos(a) * r; spos[i * 3 + 1] = y0 + Math.sin(t * sp + i) * 0.04; spos[i * 3 + 2] = Math.sin(a) * r * 0.4 - 0.02; }
    sg.attributes.position.needsUpdate = true; sparkPtsM.opacity = 0.6 + flash * 0.4;
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
  // tilted glowing orbit ring with three instanced ice moonlets + twinkling sparkles
  const ringM = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending });
  const orbitG = new THREE.Group(); orbitG.rotation.set(1.15, 0, 0.35); P.add(orbitG);
  orbitG.add(mesh(new THREE.TorusGeometry(0.24, 0.006, 6, 48), ringM));
  const moons = new THREE.InstancedMesh(new THREE.OctahedronGeometry(0.028), iceM, 3); moons.castShadow = false; orbitG.add(moons);
  const KN = 30, kpos = new Float32Array(KN * 3), kseed = [];
  for (let i = 0; i < KN; i++) { const v = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize().multiplyScalar(0.2 + Math.random() * 0.12); kpos.set([v.x, v.y, v.z], i * 3); kseed.push(Math.random() * 6.28); }
  const kg = new THREE.BufferGeometry(); kg.setAttribute('position', new THREE.BufferAttribute(kpos, 3));
  const kM = new THREE.PointsMaterial({ size: 0.025, map: softDotTexture(), color: '#ffffff', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const kPts = new THREE.Points(kg, kM); P.add(kPts);
  const dm = new THREE.Object3D();
  let t = 0;
  const step = () => {
    body.position.y = Math.sin(t * 2.2) * 0.04; body.rotation.y = Math.sin(t * 0.9) * 0.4; body.rotation.z = Math.sin(t * 1.3) * 0.1;
    for (let i = 0; i < 3; i++) { const a = t * 1.6 + i * 2.094; dm.position.set(Math.cos(a) * 0.24, Math.sin(a) * 0.24, 0); dm.rotation.set(t * 2 + i, t, 0); dm.updateMatrix(); moons.setMatrixAt(i, dm.matrix); }
    moons.instanceMatrix.needsUpdate = true; orbitG.position.y = body.position.y; kPts.position.y = body.position.y; kPts.rotation.y = t * 0.3; kM.opacity = 0.55 + Math.sin(t * 5) * 0.3;
    trail.forEach(s => { const L = s.userData.life; s.position.set(-0.02 - L * 0.05, body.position.y + 0.06 + L * 0.28, -0.08 - L * 0.32); s.scale.setScalar(0.16 * (1 - L) + 0.03); s.material.opacity = 0.7 * (1 - L); });
  };
  step();
  g.userData.tick = (dt) => { t += dt; trail.forEach(s => { s.userData.life = (s.userData.life + dt * 0.9) % 1; }); step(); };
  g.userData.setColor = (c) => { iceM.color.set(c); iceM.emissive.set(c); shellM.color.set(c); shellM.emissive.set(c); trailM.forEach(m => m.color.set(c)); glow.color.set(c); ringM.color.set(c); };
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
  // silver lining under the cloud + inner lightning flicker + wind swirl ribbons
  const liningM = new THREE.MeshBasicMaterial({ color: _tint(color, '#ffffff', 0.6), transparent: true, opacity: 0.7, depthWrite: false });
  const lining = mesh(new THREE.TorusGeometry(0.29, 0.012, 6, 40), liningM, 0, -0.1, 0); lining.rotation.x = Math.PI / 2; lining.scale.y = 0.75; cloud.add(lining);
  const flashM = new THREE.SpriteMaterial({ map: softDotTexture(), color: '#fff6c8', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  const flashS = new THREE.Sprite(flashM); flashS.scale.set(0.7, 0.45, 1); flashS.position.set(0, 0.0, 0.05); cloud.add(flashS);
  const windM = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.45, depthWrite: false, side: THREE.DoubleSide });
  const winds = [0, 1].map(i => { const w = mesh(new THREE.TorusGeometry(0.36 + i * 0.05, 0.008, 4, 40, Math.PI * 0.9), windM, 0, 0.12 + i * 0.08, 0); w.rotation.x = Math.PI / 2 + (i ? 0.1 : -0.08); w.castShadow = false; cloud.add(w); return w; });
  let zap = 0;
  // chunky blocky flakes (R6 style) falling between the soft ones
  const flakeM = std('#ffffff', { roughness: 0.4, emissive: '#cfeaff', emissiveIntensity: 0.4 });
  const flakes = [];
  for (let i = 0; i < 16; i++) { const f = mesh(new THREE.BoxGeometry(0.03, 0.03, 0.03), flakeM); f.castShadow = false; f.userData.v = 0.2 + rnd() * 0.12; cloud.add(f); flakes.push(f); const a = rnd() * 6.28, r = Math.sqrt(rnd()) * 0.26; f.position.set(Math.cos(a) * r, -0.1 - rnd() * 0.42, Math.sin(a) * r * 0.75); }
  let t = 0;
  g.userData.tick = (dt) => {
    t += dt; cloud.position.y = 1.02 + Math.sin(t * 1.5) * 0.02; cloud.rotation.y = Math.sin(t * 0.4) * 0.15;
    for (let i = 0; i < N; i++) { pos[i * 3 + 1] -= vel[i] * dt; pos[i * 3] += Math.sin(t * 2 + i) * 0.02 * dt; if (pos[i * 3 + 1] < -0.52) reset(i, -0.1); }
    winds.forEach((w, i) => { w.rotation.z = t * (i ? -1.6 : 1.2); });
    zap = Math.max(0, zap - dt * 5); if (Math.random() < dt * 0.35) zap = 1; flashM.opacity = zap > 0.2 ? zap * 0.8 : 0;
    flakes.forEach((f, i) => { f.position.y -= f.userData.v * dt; f.rotation.set(t * 2 + i, t * 1.5, 0); if (f.position.y < -0.52) f.position.y = -0.1; });
    pg.attributes.position.needsUpdate = true;
  };
  g.userData.setColor = (c) => { top.color.set(c); under.color.copy(_tint(c, '#000000', 0.3)); liningM.color.copy(_tint(c, '#ffffff', 0.6)); };
  return { bone: 'head', object: g };
}

function buildStormGoggles(color) {
  const g = new THREE.Group();
  const frame = std('#2b3038', { roughness: 0.5, metalness: 0.3 });
  const rubber = std('#15181d', { roughness: 0.9 });
  const metal = std('#aeb8c4', { metalness: 0.9, roughness: 0.25 });
  // animated radar HUD on the visor
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 96;
  const ctx = cv.getContext('2d'), tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  let hud = color;
  const blips = [[0.3, 0.4], [0.62, 0.7], [0.8, 0.3]];
  const drawHud = (a) => {
    const c = new THREE.Color(hud), css = (k) => `rgba(${c.r * 255 | 0},${c.g * 255 | 0},${c.b * 255 | 0},${k})`;
    ctx.fillStyle = '#0b1a24'; ctx.fillRect(0, 0, 256, 96);
    const grd = ctx.createLinearGradient(0, 0, 0, 96); grd.addColorStop(0, css(0.35)); grd.addColorStop(1, css(0.1)); ctx.fillStyle = grd; ctx.fillRect(0, 0, 256, 96);
    for (const cx of [64, 192]) {
      ctx.strokeStyle = css(0.6); ctx.lineWidth = 1.5;
      for (const r of [14, 28, 40]) { ctx.beginPath(); ctx.arc(cx, 48, r, 0, Math.PI * 2); ctx.stroke(); }
      ctx.beginPath(); ctx.moveTo(cx - 42, 48); ctx.lineTo(cx + 42, 48); ctx.moveTo(cx, 6); ctx.lineTo(cx, 90); ctx.stroke();
      const sw = ctx.createConicGradient ? ctx.createConicGradient(a - 0.8, cx, 48) : null;
      if (sw) { sw.addColorStop(0, css(0)); sw.addColorStop(0.12, css(0.75)); sw.addColorStop(0.125, css(0)); ctx.fillStyle = sw; ctx.beginPath(); ctx.arc(cx, 48, 40, 0, Math.PI * 2); ctx.fill(); }
      ctx.strokeStyle = css(1); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(cx, 48); ctx.lineTo(cx + Math.cos(a) * 40, 48 + Math.sin(a) * 40); ctx.stroke();
      for (const [bx, by] of blips) { const x = cx - 40 + bx * 80, y = 8 + by * 80, ang = Math.atan2(y - 48, x - cx); const fade = ((a - ang) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2); ctx.fillStyle = css(Math.max(0.15, 1 - fade / 3)); ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill(); }
    }
    ctx.fillStyle = css(0.9); ctx.font = 'bold 10px monospace'; ctx.fillText('WIND 87', 104, 14); ctx.fillText('▲ F3', 112, 90);
    tex.needsUpdate = true;
  };
  drawHud(0);
  const lens = new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: '#ffffff', emissiveIntensity: 0.9, roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.95 });
  const Y = 0.37, Z = 0.33;
  // strap wrapping the head + buckle
  g.add(mesh(new THREE.BoxGeometry(0.665, 0.09, 0.665), rubber, 0, Y, 0));
  g.add(mesh(new THREE.BoxGeometry(0.08, 0.1, 0.03), metal, 0, Y, -0.335));
  // chunky frame with rounded visor
  g.add(mesh(new RoundedBoxGeometry(0.6, 0.2, 0.07, 3, 0.03), frame, 0, Y, Z));
  const visor = mesh(new THREE.PlaneGeometry(0.52, 0.15), lens, 0, Y, Z + 0.036); visor.castShadow = false; g.add(visor);
  g.add(mesh(new THREE.BoxGeometry(0.03, 0.15, 0.02), frame, 0, Y, Z + 0.04)); // nose divider
  for (const s of [-1, 1]) {
    g.add(rotated(mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.05, 12), metal, s * 0.31, Y, Z - 0.01), 'z', Math.PI / 2));
    const vent = mesh(new THREE.BoxGeometry(0.06, 0.02, 0.02), rubber, s * 0.18, Y + 0.105, Z + 0.02); g.add(vent);
  }
  // brow lamp with glow, plus a little antenna
  const lampM = std('#ffffff', { emissive: color, emissiveIntensity: 1.2 });
  g.add(mesh(new RoundedBoxGeometry(0.12, 0.06, 0.06, 2, 0.015), frame, 0, Y + 0.14, Z + 0.0));
  g.add(rotated(mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.012, 14), lampM, 0, Y + 0.14, Z + 0.033), 'x', Math.PI / 2));
  const glowM = new THREE.SpriteMaterial({ map: softDotTexture(), color, transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending });
  const glow = new THREE.Sprite(glowM); glow.scale.setScalar(0.14); glow.position.set(0, Y + 0.14, Z + 0.05); g.add(glow);
  g.add(mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.16, 6), metal, 0.25, Y + 0.17, Z - 0.03));
  const tip = mesh(new THREE.SphereGeometry(0.015, 8, 6), lampM, 0.25, Y + 0.255, Z - 0.03); g.add(tip);
  let a = 0, acc = 0, t = 0;
  g.userData.tick = (dt) => {
    a += dt * 2.4; acc += dt; t += dt;
    if (acc > 1 / 20) { acc = 0; drawHud(a); }   // 20 fps HUD redraw
    glowM.opacity = 0.45 + Math.sin(t * 4) * 0.15; tip.visible = Math.sin(t * 6) > -0.2;
  };
  g.userData.setColor = (c) => { hud = c; drawHud(a); lampM.emissive.set(c); glowM.color.set(c); };
  return { bone: 'head', object: g };
}

function survivorBadgeTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
  x.fillStyle = '#1d2733'; x.beginPath(); x.arc(64, 64, 62, 0, Math.PI * 2); x.fill();
  x.fillStyle = '#f3ead2'; x.beginPath(); x.arc(64, 64, 54, 0, Math.PI * 2); x.fill();
  x.strokeStyle = '#d9a21e'; x.lineWidth = 4; x.beginPath(); x.arc(64, 64, 50, 0, Math.PI * 2); x.stroke();
  // tiny tornado emblem: stacked swirls narrowing downward
  x.strokeStyle = '#3c4a5c'; x.lineCap = 'round';
  for (let i = 0; i < 6; i++) {
    const y = 26 + i * 9, w = 30 - i * 4.6, cx = 64 + Math.sin(i * 0.9) * 4;
    x.lineWidth = 5 - i * 0.5; x.beginPath(); x.ellipse(cx, y, w, 3.5, 0, 0, Math.PI * 2); x.stroke();
  }
  x.fillStyle = '#c0392b'; x.font = 'bold 17px sans-serif'; x.textAlign = 'center'; x.fillText('SURVIVOR', 64, 101);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

function buildStormSlicker(color) {
  const g = new THREE.Group();
  const vinyl = new THREE.MeshPhysicalMaterial({ color, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.08 });
  const lining = std(_tint(color, '#000000', 0.35), { roughness: 0.6 });
  const placketM = new THREE.MeshPhysicalMaterial({ color: _tint(color, '#000000', 0.15), roughness: 0.35, clearcoat: 1, clearcoatRoughness: 0.1 });
  const reflect = std('#dfe3e8', { metalness: 0.7, roughness: 0.22, emissive: '#5a6068', emissiveIntensity: 0.6 });
  const neon = std('#c8f53a', { roughness: 0.5, emissive: '#6a8a10', emissiveIntensity: 0.35 });
  const wood = std('#7a4f2a', { roughness: 0.7 }), cord = std('#2a2a2a', { roughness: 0.9 });
  // body
  g.add(mesh(new RoundedBoxGeometry(1.06, 0.96, 0.56, 3, 0.04), vinyl, 0, 0.03, 0));
  // reflective stripes: silver band edged in neon, wrapped around the torso
  for (const y of [-0.08, -0.3]) {
    g.add(mesh(new THREE.BoxGeometry(1.075, 0.06, 0.575), reflect, 0, y, 0));
    for (const d of [-0.04, 0.04]) g.add(mesh(new THREE.BoxGeometry(1.072, 0.018, 0.572), neon, 0, y + d, 0));
  }
  // front placket + toggle buttons on cord loops
  g.add(mesh(new THREE.BoxGeometry(0.1, 0.92, 0.02), placketM, 0, 0.04, 0.285));
  for (const y of [0.38, 0.18, -0.19, -0.4]) {
    g.add(rotated(mesh(new THREE.CapsuleGeometry(0.018, 0.08, 4, 8), wood, 0, y, 0.305), 'z', Math.PI / 2));
    for (const x of [-0.05, 0.05]) g.add(mesh(new THREE.BoxGeometry(0.035, 0.012, 0.012), cord, x, y, 0.3));
  }
  // hem
  g.add(mesh(new THREE.BoxGeometry(1.08, 0.06, 0.58), placketM, 0, -0.43, 0));
  // high collar
  const collar = mesh(new THREE.TorusGeometry(0.34, 0.06, 10, 32), placketM, 0, 0.53, 0); collar.rotation.x = Math.PI / 2; collar.scale.set(1.05, 0.72, 1); g.add(collar);
  // survivor badge (left chest)
  const badge = mesh(new THREE.CircleGeometry(0.11, 32), new THREE.MeshStandardMaterial({ map: survivorBadgeTexture(), roughness: 0.8 }), 0.27, 0.27, 0.283);
  g.add(badge);
  g.add(mesh(new THREE.TorusGeometry(0.112, 0.008, 6, 32), std('#d9a21e', { metalness: 0.6, roughness: 0.4 }), 0.27, 0.27, 0.284));
  // folded hood at back of neck: shell + lining, hinged so it flaps in the wind
  const hood = new THREE.Group(); hood.position.set(0, 0.44, -0.27); g.add(hood);
  const shell = mesh(new THREE.SphereGeometry(0.32, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), vinyl, 0, 0, -0.06);
  shell.scale.set(1.15, 0.45, 0.55); shell.rotation.x = -Math.PI / 2 - 0.35; hood.add(shell);
  const inner = mesh(new THREE.SphereGeometry(0.3, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), lining, 0, 0.005, -0.055);
  inner.scale.set(1.1, 0.4, 0.5); inner.rotation.x = -Math.PI / 2 - 0.35; inner.material.side = THREE.BackSide; hood.add(inner);
  const hoodTrim = mesh(new THREE.TorusGeometry(0.33, 0.02, 6, 32, Math.PI), reflect, 0, 0.02, -0.02);
  hoodTrim.scale.set(1.12, 0.6, 1); hoodTrim.rotation.x = -0.35; hood.add(hoodTrim);
  // sleeves
  const extras = ['armL', 'armR'].map(bone => {
    const s = new THREE.Group();
    s.add(mesh(new RoundedBoxGeometry(0.56, 0.68, 0.56, 3, 0.04), vinyl, 0, -0.33, 0));
    s.add(mesh(new THREE.BoxGeometry(0.575, 0.06, 0.575), reflect, 0, -0.48, 0));
    for (const d of [-0.04, 0.04]) s.add(mesh(new THREE.BoxGeometry(0.572, 0.018, 0.572), neon, 0, -0.48 + d, 0));
    s.add(mesh(new THREE.BoxGeometry(0.58, 0.08, 0.58), placketM, 0, -0.68, 0));
    return { bone, object: s };
  });
  // raindrops / frost beads sliding down the slicker surfaces
  const N = 26, dropM = new THREE.MeshPhysicalMaterial({ color: '#eaf6ff', roughness: 0.05, transparent: true, opacity: 0.7, clearcoat: 1 });
  const drops = new THREE.InstancedMesh(new THREE.SphereGeometry(0.018, 8, 6), dropM, N);
  const st = [], d = new THREE.Object3D();
  const spawn = (i, anyY) => {
    const face = i % 4; const u = Math.random() - 0.5;
    const p = face === 0 ? [u * 0.95, 0, 0.292] : face === 1 ? [u * 0.95, 0, -0.292] : face === 2 ? [0.542, 0, u * 0.5] : [-0.542, 0, u * 0.5];
    p[1] = anyY ? -0.4 + Math.random() * 0.9 : 0.5;
    if (face === 0 && Math.abs(p[0]) < 0.08) p[0] += 0.12;            // keep off the placket
    st[i] = { p, v: 0.05 + Math.random() * 0.12, frost: Math.random() < 0.3, pause: Math.random() * 2 };
  };
  for (let i = 0; i < N; i++) spawn(i, true);
  g.add(drops);
  g.userData.tick = (dt) => {
    const t = performance.now() / 1000;
    hood.rotation.x = Math.sin(t * 2.3) * 0.08 + Math.sin(t * 5.1) * 0.03;
    hood.rotation.z = Math.sin(t * 1.7) * 0.04;
    for (let i = 0; i < N; i++) {
      const s = st[i];
      if (s.pause > 0) s.pause -= dt; else s.p[1] -= s.v * dt * (s.frost ? 0.4 : 1);   // drops stick, then slide
      if (Math.random() < dt * 0.6) s.pause = Math.random() * 0.4;
      if (s.p[1] < -0.44) spawn(i, false);
      d.position.set(...s.p);
      if (s.frost) d.scale.set(0.8, 0.8, 0.5); else d.scale.set(0.9, 1.5 + s.v * 4, 0.55);
      d.updateMatrix(); drops.setMatrixAt(i, d.matrix);
      drops.setColorAt(i, s.frost ? _fc.set('#ffffff') : _fc.set('#d8eeff'));
    }
    drops.instanceMatrix.needsUpdate = true; if (drops.instanceColor) drops.instanceColor.needsUpdate = true;
  };
  g.userData.tick(0);
  g.userData.setColor = (c) => {
    vinyl.color.set(c); placketM.color.copy(_tint(c, '#000000', 0.15)); lining.color.copy(_tint(c, '#000000', 0.35));
  };
  return { bone: 'torso', object: g, extras };
}
const _fc = new THREE.Color();

// ===================== Winterhaven =====================
function fairIsleTexture(color) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 32; const x = c.getContext('2d');
  const base = '#' + new THREE.Color(color).getHexString(), cream = '#f3ead6';
  x.fillStyle = cream; x.fillRect(0, 0, 256, 32);
  x.fillStyle = base; x.fillRect(0, 0, 256, 4); x.fillRect(0, 28, 256, 4);
  for (let i = 0; i < 256; i += 8) { x.fillRect(i, 6, 4, 2); x.fillRect(i + 4, 24, 4, 2); }   // tiny checks
  for (let i = 16; i < 256; i += 32) {                                                          // snowflakes
    x.fillRect(i - 1, 10, 2, 12); x.fillRect(i - 6, 15, 12, 2);
    x.save(); x.translate(i, 16); x.rotate(Math.PI / 4); x.fillRect(-1, -5, 2, 10); x.fillRect(-5, -1, 10, 2); x.restore();
  }
  for (let i = 0; i < 256; i += 32) { x.beginPath(); x.moveTo(i, 16); x.lineTo(i + 3, 12); x.lineTo(i + 6, 16); x.lineTo(i + 3, 20); x.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping; return t;
}
function pomPom(mat, r = 0.1) {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.IcosahedronGeometry(r, 2), mat));
  let s = 3; const rnd = () => (s = (s * 9301 + 49297) % 233280) / 233280;
  for (let i = 0; i < 26; i++) {
    const v = new THREE.Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).normalize().multiplyScalar(r * 0.85);
    g.add(mesh(new THREE.IcosahedronGeometry(r * 0.38, 0), mat, v.x, v.y, v.z));
  }
  return g;
}

function buildEarflapCap(color) {
  const g = new THREE.Group();
  const tex = knitTexture().clone(); tex.needsUpdate = true; tex.repeat.set(10, 3);
  const knit = std(color, { map: tex, bumpMap: tex, bumpScale: 1.4, roughness: 0.95 });
  const cream = std('#f3ead6', { roughness: 1 });
  let band = fairIsleTexture(color); band.repeat.set(2, 1);
  const bandM = new THREE.MeshStandardMaterial({ map: band, bumpMap: band, bumpScale: 0.4, roughness: 1 });
  // crown: rounded box hugging the head, plus a soft dome
  g.add(mesh(new RoundedBoxGeometry(0.7, 0.22, 0.7, 3, 0.08), knit, 0, 0.6, 0));
  const dome = mesh(new THREE.SphereGeometry(0.37, 28, 12, 0, Math.PI * 2, 0, Math.PI / 2), knit, 0, 0.66, 0); dome.scale.set(1, 0.55, 1); g.add(dome);
  // Fair Isle band (open cylinder => texture wraps all the way round)
  const bandMesh = mesh(new THREE.CylinderGeometry(0.47, 0.47, 0.15, 4, 1, true, Math.PI / 4), bandM, 0, 0.47, 0); bandMesh.material.side = THREE.DoubleSide; g.add(bandMesh);
  for (const y of [0.395, 0.545]) g.add(mesh(new THREE.CylinderGeometry(0.48, 0.48, 0.025, 4, 1, false, Math.PI / 4), knit, 0, y, 0));
  // earflaps with braided ties
  const ties = [];
  for (const sx of [-1, 1]) {
    const flap = mesh(new RoundedBoxGeometry(0.08, 0.34, 0.36, 3, 0.035), knit, sx * 0.345, 0.25, 0); g.add(flap);
    g.add(mesh(new RoundedBoxGeometry(0.085, 0.05, 0.37, 2, 0.02), cream, sx * 0.347, 0.37, 0));
    const tie = new THREE.Group(); tie.position.set(sx * 0.35, 0.08, 0); g.add(tie); ties.push(tie);
    for (let i = 0; i < 6; i++) tie.add(rotated(mesh(new THREE.SphereGeometry(0.03, 8, 6), i % 2 ? cream : knit, (i % 2 ? 0.008 : -0.008), -i * 0.045, 0), 'z', 0.4));
    const tp = pomPom(cream, 0.045); tp.position.set(0, -0.3, 0); tie.add(tp);
  }
  // big pom-pom
  const pom = pomPom(cream, 0.13); pom.position.set(0, 0.92, 0); g.add(pom);
  g.userData.tick = () => { const t = performance.now() / 1000; ties.forEach((ti, i) => { ti.rotation.z = Math.sin(t * 2.1 + i) * 0.12; ti.rotation.x = Math.sin(t * 1.6 + i * 2) * 0.1; }); pom.rotation.z = Math.sin(t * 1.8) * 0.06; };
  g.userData.setColor = (c) => { knit.color.set(c); const nb = fairIsleTexture(c); nb.repeat.copy(band.repeat); bandM.map.dispose(); bandM.map = nb; bandM.bumpMap = nb; bandM.needsUpdate = true; band = nb; };
  return { bone: 'head', object: g };
}

function buildHotCocoa(color) {
  const g = new THREE.Group(); g.position.set(0, -0.92, 0.27);
  const enamel = new THREE.MeshPhysicalMaterial({ color, roughness: 0.3, clearcoat: 0.8, clearcoatRoughness: 0.15 });
  const steel = std('#e6ebef', { metalness: 0.5, roughness: 0.3 });
  const cream = std('#f5efe0', { roughness: 0.5 });
  const R = 0.105, H = 0.46;
  g.add(mesh(new THREE.CylinderGeometry(R, R, H, 32), enamel, 0, 0.02, 0));
  g.add(mesh(new THREE.CylinderGeometry(R * 1.02, R * 1.02, 0.05, 32), steel, 0, 0.02 - H / 2 + 0.02, 0));     // base band
  g.add(mesh(new THREE.CylinderGeometry(R * 1.02, R * 1.02, 0.07, 32), cream, 0, 0.1, 0));                   // cream label band
  for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; g.add(mesh(new THREE.BoxGeometry(0.012, 0.012, 0.012), enamel, Math.sin(a) * R * 1.05, 0.1, Math.cos(a) * R * 1.05)); }
  const flake = snowflakeCharm(0.035); flake.position.set(0, -0.06, R + 0.005); g.add(flake);
  // shoulder + cup-lid (steel cup sitting upturned-open on top, full of cocoa)
  g.add(mesh(new THREE.CylinderGeometry(R * 0.75, R, 0.05, 32), steel, 0, 0.02 + H / 2 + 0.02, 0));
  const cupY = 0.02 + H / 2 + 0.1;
  const cup = mesh(new THREE.CylinderGeometry(R * 0.95, R * 0.82, 0.12, 32, 1, true), steel, 0, cupY, 0); cup.material = steel.clone(); cup.material.side = THREE.DoubleSide; g.add(cup);
  g.add(rotated(mesh(new THREE.TorusGeometry(R * 0.95, 0.008, 6, 32), steel, 0, cupY + 0.06, 0), 'x', Math.PI / 2));
  g.add(rotated(mesh(new THREE.CircleGeometry(R * 0.92, 28), std('#5a3220', { roughness: 0.35 }), 0, cupY + 0.04, 0), 'x', -Math.PI / 2));
  for (const [x, z] of [[0.03, 0.02], [-0.03, -0.01], [0.0, -0.04]]) g.add(mesh(new RoundedBoxGeometry(0.035, 0.03, 0.035, 2, 0.01), std('#fffaf4', { roughness: 0.8 }), x, cupY + 0.05, z));
  // carry handle
  const handle = mesh(new THREE.TorusGeometry(0.1, 0.014, 8, 20, Math.PI), std('#2b2b2b', { roughness: 0.6 }), R + 0.005, 0.02, 0); handle.rotation.z = -Math.PI / 2; g.add(handle);
  // steam wisps
  const N = 14, pos = new Float32Array(N * 3), life = new Float32Array(N);
  const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const steam = new THREE.Points(pg, new THREE.PointsMaterial({ map: softDotTexture(), size: 0.09, transparent: true, opacity: 0.55, depthWrite: false, color: '#ffffff' }));
  for (let i = 0; i < N; i++) life[i] = Math.random();
  g.add(steam);
  g.userData.tick = (dt) => { const t = performance.now() / 1000;
    for (let i = 0; i < N; i++) { life[i] += dt * 0.45; if (life[i] > 1) life[i] -= 1; const l = life[i];
      pos[i * 3] = Math.sin(t * 1.5 + i) * 0.03 * l; pos[i * 3 + 1] = cupY + 0.06 + l * 0.35; pos[i * 3 + 2] = Math.cos(t * 1.2 + i * 2) * 0.03 * l; }
    pg.attributes.position.needsUpdate = true; };
  g.userData.tick(0);
  g.userData.setColor = (c) => enamel.color.set(c);
  return { bone: 'armR', object: g };
}

function buildLanternHat(color) {
  const g = new THREE.Group();
  const tex = knitTexture().clone(); tex.needsUpdate = true; tex.repeat.set(10, 3);
  const knit = std('#3a4a6b', { map: tex, bumpMap: tex, bumpScale: 1.4, roughness: 0.95 });
  const rib = std('#e9e2d0', { roughness: 1 });
  g.add(mesh(new RoundedBoxGeometry(0.7, 0.2, 0.7, 3, 0.08), knit, 0, 0.6, 0));
  const dome = mesh(new THREE.SphereGeometry(0.37, 28, 12, 0, Math.PI * 2, 0, Math.PI / 2), knit, 0, 0.66, 0); dome.scale.set(1, 0.7, 1); g.add(dome);
  g.add(mesh(new RoundedBoxGeometry(0.72, 0.13, 0.72, 3, 0.05), rib, 0, 0.5, 0));
  // stalk: curved wire from the top to a hook
  const wire = std('#2c2c2c', { metalness: 0.6, roughness: 0.4 });
  const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0.9, 0), new THREE.Vector3(0.02, 1.08, 0), new THREE.Vector3(0.14, 1.18, 0), new THREE.Vector3(0.26, 1.12, 0)]);
  g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 20, 0.012, 6), wire));
  g.add(mesh(new THREE.CylinderGeometry(0.045, 0.06, 0.04, 12), rib, 0, 0.9, 0));
  // lantern swings from the hook
  const L = new THREE.Group(); L.position.set(0.26, 1.12, 0); L.scale.setScalar(1.35); g.add(L);
  const brass = std('#b88a3a', { metalness: 0.8, roughness: 0.3 });
  const glow = std(color, { emissive: color, emissiveIntensity: 2.2, roughness: 0.3 });
  const glass = new THREE.MeshPhysicalMaterial({ color: '#fff7e6', transparent: true, opacity: 0.35, roughness: 0.05, transmission: 0 });
  L.add(rotated(mesh(new THREE.TorusGeometry(0.025, 0.006, 6, 12), brass, 0, -0.02, 0), 'y', Math.PI / 2));
  L.add(mesh(new THREE.ConeGeometry(0.075, 0.05, 4), brass, 0, -0.06, 0));
  L.add(mesh(new THREE.BoxGeometry(0.11, 0.015, 0.11), brass, 0, -0.09, 0));
  L.add(mesh(new THREE.BoxGeometry(0.095, 0.12, 0.095), glass, 0, -0.155, 0));
  for (const [x, z] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) L.add(mesh(new THREE.BoxGeometry(0.012, 0.13, 0.012), brass, x * 0.05, -0.155, z * 0.05));
  L.add(mesh(new THREE.BoxGeometry(0.11, 0.02, 0.11), brass, 0, -0.225, 0));
  const flame = mesh(new THREE.SphereGeometry(0.03, 12, 8), glow, 0, -0.15, 0); flame.scale.set(1, 1.5, 1); L.add(flame);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: softDotTexture(), color, transparent: true, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending }));
  halo.scale.setScalar(0.32); halo.position.set(0, -0.155, 0); L.add(halo);
  g.userData.tick = () => { const t = performance.now() / 1000; L.rotation.z = Math.sin(t * 2.2) * 0.22; L.rotation.x = Math.sin(t * 1.5) * 0.1;
    const f = 1 + Math.sin(t * 13) * 0.08 + Math.sin(t * 7.3) * 0.06; flame.scale.set(f, 1.5 * f, f); halo.material.opacity = 0.55 + 0.15 * f; };
  g.userData.setColor = (c) => { glow.color.set(c); glow.emissive.set(c); halo.material.color.set(c); };
  return { bone: 'head', object: g };
}

function auroraStripeTexture(color) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 64; const x = c.getContext('2d');
  x.fillStyle = '#' + new THREE.Color(color).getHexString(); x.fillRect(0, 0, 256, 64);
  const cols = ['#5dffb0', '#3fd6ff', '#9a7bff', '#ff8ad8'];
  for (let k = 0; k < 4; k++) {
    const gr = x.createLinearGradient(0, 0, 256, 0);
    for (let i = 0; i <= 4; i++) gr.addColorStop(i / 4, cols[(i + k) % 4]);
    x.fillStyle = gr; x.globalAlpha = 0.9; x.fillRect(0, 6 + k * 15, 256, 6); x.globalAlpha = 1;
  }
  x.fillStyle = 'rgba(0,0,0,0.12)'; for (let i = 0; i < 256; i += 4) x.fillRect(i, 0, 1, 64);   // knit ribs
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}
function buildAuroraScarf(color) {
  const g = new THREE.Group();
  let tex = auroraStripeTexture(color); tex.repeat.set(3, 1);
  const knit = new THREE.MeshStandardMaterial({ map: tex, bumpMap: knitTexture(), bumpScale: 0.8, roughness: 0.95, emissive: '#ffffff', emissiveMap: tex, emissiveIntensity: 0.18 });
  const wrap = mesh(new THREE.TorusGeometry(0.34, 0.1, 12, 40), knit, 0, 0.53, 0); wrap.rotation.x = Math.PI / 2; wrap.scale.set(1.35, 0.95, 1.7); g.add(wrap);
  const knot = mesh(new RoundedBoxGeometry(0.2, 0.16, 0.12, 3, 0.05), knit, 0.2, 0.42, 0.3); g.add(knot);
  let ttex = auroraStripeTexture(color); ttex.repeat.set(0.5, 1.5);
  const tailM = new THREE.MeshStandardMaterial({ map: ttex, roughness: 0.95, emissive: '#ffffff', emissiveMap: ttex, emissiveIntensity: 0.18 });
  const tails = [];
  const fringe = std('#f0f4f8', { roughness: 1 });
  const tail = (x, z, len, rot) => {
    const t = new THREE.Group(); t.position.set(x, 0.42, z); t.rotation.z = rot; g.add(t); tails.push(t);
    t.add(mesh(new RoundedBoxGeometry(0.2, len, 0.06, 2, 0.025), tailM, 0, -len / 2, 0));
    for (let i = 0; i < 6; i++) t.add(mesh(new THREE.CylinderGeometry(0.008, 0.006, 0.09, 5), fringe, -0.085 + i * 0.034, -len - 0.04, 0));
    return t;
  };
  tail(0.22, 0.31, 0.5, 0.06); tail(0.08, 0.32, 0.38, -0.1);
  g.userData.tick = (dt) => { const t = performance.now() / 1000;
    tex.offset.x = (tex.offset.x + dt * 0.05) % 1; knit.emissiveIntensity = tailM.emissiveIntensity = 0.16 + Math.sin(t * 1.3) * 0.06; ttex.offset.x = tex.offset.x * 0.3;
    tails.forEach((tl, i) => { tl.rotation.x = 0.08 + Math.sin(t * 1.9 + i * 1.4) * 0.12; tl.rotation.z = (i ? -0.1 : 0.06) + Math.sin(t * 1.3 + i) * 0.05; }); };
  g.userData.setColor = (c) => { const nt = auroraStripeTexture(c); nt.repeat.copy(tex.repeat); nt.offset.copy(tex.offset); knit.map.dispose(); knit.map = nt; knit.emissiveMap = nt; knit.needsUpdate = true; tex = nt;
    const n2 = auroraStripeTexture(c); n2.repeat.copy(ttex.repeat); tailM.map.dispose(); tailM.map = n2; tailM.emissiveMap = n2; tailM.needsUpdate = true; ttex = n2; };
  return { bone: 'torso', object: g };
}

function buildPineCloak(color) {
  const g = new THREE.Group();
  const bough = std(color, { roughness: 0.85, flatShading: true });
  const dark = std(_tint(color, '#000000', 0.3), { roughness: 0.9, flatShading: true });
  const light = std(_tint(color, '#ffffff', 0.15), { roughness: 0.85, flatShading: true });
  const snow = std('#ffffff', { roughness: 0.9 });
  const cape = new THREE.Group(); cape.position.set(0, 0.5, -0.28); g.add(cape);
  // shoulder mantle
  g.add(mesh(new RoundedBoxGeometry(1.12, 0.1, 0.62, 2, 0.04), dark, 0, 0.52, 0));
  // backing cloth so no gaps show between boughs
  const backing = mesh(new RoundedBoxGeometry(1.04, 1.02, 0.03, 2, 0.012), dark, 0, -0.5, 0.0); cape.add(backing);
  // layered bough rows hanging from the shoulders (rows get wider toward the hem)
  const rows = 5;
  for (let r = 0; r < rows; r++) {
    const y = -0.08 - r * 0.2, n = 7, w = 1.02 + r * 0.05;
    for (let i = 0; i < n; i++) {
      const x = -w / 2 + (i + 0.5) * (w / n);
      const needle = mesh(new THREE.ConeGeometry(0.13, 0.34, 6), (i + r) % 2 ? bough : light, x, y, -0.03 - 0.025 * r);
      needle.rotation.x = Math.PI; needle.rotation.y = (i * 1.3) % 1; needle.scale.set(1, 1, 0.45); cape.add(needle);
      if (r < 3 || i % 2 === 0) { const sn = mesh(new THREE.SphereGeometry(0.07, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), snow, x, y + 0.1, -0.06 - 0.025 * r); sn.scale.set(1.3, 0.55, 0.7); cape.add(sn); }
    }
  }
  // front clasp: pinecone + cord
  const cone = new THREE.Group(); cone.position.set(0, 0.42, 0.3); g.add(cone);
  const brown = std('#7a4e2a', { roughness: 0.8, flatShading: true });
  for (let i = 0; i < 4; i++) cone.add(mesh(new THREE.ConeGeometry(0.055 - i * 0.01, 0.05, 6), brown, 0, -i * 0.03, 0));
  for (const sx of [-1, 1]) g.add(rotated(mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.36, 6), std('#c9a96b', { roughness: 0.8 }), sx * 0.17, 0.46, 0.28), 'z', sx * 1.2));
  g.userData.tick = () => { const t = performance.now() / 1000; cape.rotation.x = -0.06 - Math.sin(t * 1.4) * 0.04; cape.children.forEach((c, i) => { if (c !== backing) c.rotation.z = Math.sin(t * 2 + i * 0.7) * 0.05; }); };
  g.userData.setColor = (c) => { bough.color.set(c); light.color.copy(_tint(c, '#ffffff', 0.15)); dark.color.copy(_tint(c, '#000000', 0.3)); };
  return { bone: 'torso', object: g };
}

function buildCrystalPet(color) {
  const g = new THREE.Group();
  const P = new THREE.Group(); P.position.set(0.75, 0.82, 0); g.add(P);
  const crystal = new THREE.MeshPhysicalMaterial({ color, emissive: color, emissiveIntensity: 0.45, roughness: 0.08, metalness: 0.1, clearcoat: 1, transparent: true, opacity: 0.92, flatShading: true });
  const core = mesh(new THREE.OctahedronGeometry(0.13, 0), crystal); core.scale.set(1, 1.35, 1); P.add(core);
  const shards = [];
  for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; const s = mesh(new THREE.OctahedronGeometry(0.045, 0), crystal, Math.cos(a) * 0.13, -0.08 + (i % 2) * 0.06, Math.sin(a) * 0.13); s.scale.set(0.7, 1.6, 0.7); s.rotation.z = Math.cos(a) * 0.5; s.rotation.x = -Math.sin(a) * 0.5; P.add(s); shards.push(s); }
  const eyeM = std('#16202c', { roughness: 0.3 });
  for (const sx of [-1, 1]) { P.add(mesh(new THREE.SphereGeometry(0.022, 10, 8), eyeM, sx * 0.04, 0.03, 0.105)); P.add(mesh(new THREE.SphereGeometry(0.007, 6, 4), std('#ffffff', { emissive: '#ffffff' }), sx * 0.04 + 0.007, 0.04, 0.125)); }
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: softDotTexture(), color, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending })); halo.scale.setScalar(0.4); halo.material.opacity = 0.32; P.add(halo);
  // orbiting sparkles
  const N = 10, pos = new Float32Array(N * 3), pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const sp = new THREE.Points(pg, new THREE.PointsMaterial({ map: softDotTexture(), size: 0.05, color: '#ffffff', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); P.add(sp);
  g.userData.tick = () => { const t = performance.now() / 1000;
    P.position.y = 0.82 + Math.sin(t * 2) * 0.04; P.rotation.y = Math.sin(t * 0.8) * 0.5;
    shards.forEach((s, i) => s.position.y = -0.08 + (i % 2) * 0.06 + Math.sin(t * 3 + i) * 0.01);
    for (let i = 0; i < N; i++) { const a = t * 1.2 + i / N * Math.PI * 2; pos[i * 3] = Math.cos(a) * 0.22; pos[i * 3 + 1] = Math.sin(a * 2 + i) * 0.08; pos[i * 3 + 2] = Math.sin(a) * 0.22; }
    pg.attributes.position.needsUpdate = true; crystal.emissiveIntensity = 0.4 + Math.sin(t * 2.5) * 0.12; };
  g.userData.tick();
  g.userData.setColor = (c) => { crystal.color.set(c); crystal.emissive.set(c); halo.material.color.set(c); };
  return { bone: 'torso', object: g };
}

function buildFrostspireCrown(color) {
  const g = new THREE.Group();
  const ice = new THREE.MeshPhysicalMaterial({ color, emissive: color, emissiveIntensity: 0.25, roughness: 0.05, metalness: 0.15, clearcoat: 1, transparent: true, opacity: 0.88, flatShading: true });
  const silver = std('#f2f7fb', { metalness: 0.35, roughness: 0.25, emissive: '#5a6a78', emissiveIntensity: 0.4 });
  const gemM = new THREE.MeshPhysicalMaterial({ color, emissive: color, emissiveIntensity: 1.1, roughness: 0.05, clearcoat: 1, flatShading: true });
  // band: 4-sided to fit the block head, with a silver rim top and bottom
  const band = mesh(new THREE.CylinderGeometry(0.47, 0.47, 0.12, 4, 1, true, Math.PI / 4), ice, 0, 0.66, 0); band.material = ice.clone(); band.material.side = THREE.DoubleSide; g.add(band);
  for (const y of [0.6, 0.72]) g.add(mesh(new THREE.CylinderGeometry(0.485, 0.485, 0.02, 4, 1, false, Math.PI / 4), silver, 0, y, 0));
  // spires: tall in the middle of each face, smaller at corners
  const spires = [];
  const spire = (x, z, h, r) => { const s = mesh(new THREE.ConeGeometry(r, h, 6), ice, x, 0.72 + h / 2, z); g.add(s); spires.push(s);
    g.add(mesh(new THREE.OctahedronGeometry(r * 0.55, 0), silver, x, 0.73, z)); return s; };
  const W = 0.33;
  for (const [x, z] of [[0, W], [0, -W], [W, 0], [-W, 0]]) spire(x, z, x === 0 && z > 0 ? 0.5 : 0.36, 0.06);
  for (const [x, z] of [[W, W], [W, -W], [-W, W], [-W, -W]]) spire(x, z, 0.22, 0.045);
  for (const [x, z] of [[0.15, W], [-0.15, W], [0.15, -W], [-0.15, -W], [W, 0.15], [W, -0.15], [-W, 0.15], [-W, -0.15]]) spire(x, z, 0.14, 0.03);
  // heart gem on the front
  const gem = mesh(new THREE.OctahedronGeometry(0.07, 0), gemM, 0, 0.66, 0.35); gem.scale.set(1, 1.3, 0.6); g.add(gem);
  g.add(rotated(mesh(new THREE.TorusGeometry(0.075, 0.01, 6, 20), silver, 0, 0.66, 0.35), 'x', 0));
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: softDotTexture(), color, transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending })); halo.scale.setScalar(0.3); halo.position.set(0, 0.66, 0.38); g.add(halo);
  // sparkle particles drifting up around the spires
  const N = 26, pos = new Float32Array(N * 3), life = new Float32Array(N), seed = [];
  const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const spark = new THREE.Points(pg, new THREE.PointsMaterial({ map: softDotTexture(), size: 0.06, color: '#ffffff', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.9 }));
  for (let i = 0; i < N; i++) { life[i] = Math.random(); seed[i] = Math.random() * Math.PI * 2; }
  g.add(spark);
  g.userData.tick = (dt = 0) => { const t = performance.now() / 1000;
    for (let i = 0; i < N; i++) { life[i] += dt * 0.35; if (life[i] > 1) { life[i] -= 1; seed[i] = Math.random() * Math.PI * 2; }
      const a = seed[i] + t * 0.4, r = 0.36 + Math.sin(i) * 0.06; pos[i * 3] = Math.cos(a) * r; pos[i * 3 + 1] = 0.72 + life[i] * 0.55; pos[i * 3 + 2] = Math.sin(a) * r; }
    pg.attributes.position.needsUpdate = true; spark.material.size = 0.05 + Math.sin(t * 6) * 0.012;
    gemM.emissiveIntensity = 1 + Math.sin(t * 2.2) * 0.3; halo.material.opacity = 0.5 + Math.sin(t * 2.2) * 0.15; };
  g.userData.tick(0);
  g.userData.setColor = (c) => { ice.color.set(c); ice.emissive.set(c); band.material.color.set(c); band.material.emissive.set(c); gemM.color.set(c); gemM.emissive.set(c); halo.material.color.set(c); };
  return { bone: 'head', object: g };
}

function buildBlizzardBack(color) {
  const g = new THREE.Group();
  const V = new THREE.Group(); V.position.set(0, 0.05, -0.62); g.add(V);
  // swirl ribbons: thin tori with a soft gradient alpha
  const c = document.createElement('canvas'); c.width = 128; c.height = 8; const x = c.getContext('2d');
  const gr = x.createLinearGradient(0, 0, 128, 0); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.5, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = gr; x.fillRect(0, 0, 128, 8);
  const rt = new THREE.CanvasTexture(c); rt.wrapS = THREE.RepeatWrapping;
  const ribbonM = new THREE.MeshBasicMaterial({ color, map: rt, transparent: true, opacity: 0.75, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
  const rings = [];
  for (let i = 0; i < 4; i++) { const r = mesh(new THREE.TorusGeometry(0.22 + i * 0.1, 0.018 - i * 0.002, 6, 48, Math.PI * 1.4), ribbonM, 0, 0, -i * 0.02); rings.push(r); V.add(r); }
  const core = new THREE.Sprite(new THREE.SpriteMaterial({ map: softDotTexture(), color, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending })); core.scale.setScalar(0.45); V.add(core);
  // snow particles spiralling in the vortex
  const N = 70, pos = new Float32Array(N * 3), ang = new Float32Array(N), rad = new Float32Array(N);
  for (let i = 0; i < N; i++) { ang[i] = Math.random() * Math.PI * 2; rad[i] = 0.1 + Math.random() * 0.45; }
  const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const snow = new THREE.Points(pg, new THREE.PointsMaterial({ map: softDotTexture(), size: 0.07, color: '#ffffff', transparent: true, depthWrite: false })); V.add(snow);
  // anchor disc on the back (frosted rune plate)
  g.add(mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.04, 6), std('#dfeaf4', { metalness: 0.7, roughness: 0.25 }), 0, 0.05, -0.27).rotateX(Math.PI / 2));
  const gem = mesh(new THREE.OctahedronGeometry(0.06, 0), std(color, { emissive: color, emissiveIntensity: 1 }), 0, 0.05, -0.3); g.add(gem);
  g.userData.tick = (dt = 0) => { const t = performance.now() / 1000;
    rings.forEach((r, i) => r.rotation.z = t * (1.6 - i * 0.25) * (i % 2 ? -1 : 1));
    for (let i = 0; i < N; i++) { ang[i] += dt * (2.6 / (rad[i] + 0.2)); rad[i] -= dt * 0.05; if (rad[i] < 0.08) rad[i] = 0.55;
      pos[i * 3] = Math.cos(ang[i]) * rad[i]; pos[i * 3 + 1] = Math.sin(ang[i]) * rad[i]; pos[i * 3 + 2] = Math.sin(ang[i] * 3 + i) * 0.04; }
    pg.attributes.position.needsUpdate = true; core.material.opacity = 0.6 + Math.sin(t * 3) * 0.15; };
  g.userData.tick(0);
  g.userData.setColor = (c) => { ribbonM.color.set(c); core.material.color.set(c); gem.material.color.set(c); gem.material.emissive.set(c); };
  return { bone: 'torso', object: g };
}

function buildWoolMittens(color) {
  const mats = [];
  const make = (side) => {
    const g = new THREE.Group();
    const tex = knitTexture().clone(); tex.needsUpdate = true; tex.repeat.set(4, 2);
    const knit = std(color, { map: tex, bumpMap: tex, bumpScale: 1.4, roughness: 0.95 }); mats.push(['knit', knit]);
    let band = fairIsleTexture(color); band.repeat.set(1, 1);
    const bandM = new THREE.MeshStandardMaterial({ map: band, bumpMap: band, bumpScale: 0.4, roughness: 1 }); mats.push(['band', bandM]);
    const cuffTex = ribTexture('#f3ead6'); cuffTex.repeat.set(6, 1);
    const cuff = new THREE.MeshStandardMaterial({ map: cuffTex, roughness: 1 });
    g.add(mesh(new RoundedBoxGeometry(0.56, 0.3, 0.56, 3, 0.1), knit, 0, -0.9, 0));          // mitt
    g.add(mesh(new RoundedBoxGeometry(0.5, 0.08, 0.5, 2, 0.04), knit, 0, -1.07, 0));         // rounded fingertip end
    const thumb = mesh(new RoundedBoxGeometry(0.15, 0.22, 0.12, 2, 0.05), knit, -side * 0.14, -0.9, 0.3); thumb.rotation.z = side * 0.3; g.add(thumb);
    const bandMesh = mesh(new THREE.CylinderGeometry(0.405, 0.405, 0.1, 4, 1, true, Math.PI / 4), bandM, 0, -0.82, 0); bandMesh.material.side = THREE.DoubleSide; g.add(bandMesh);
    g.add(mesh(new RoundedBoxGeometry(0.6, 0.12, 0.6, 2, 0.04), cuff, 0, -0.72, 0));          // ribbed cuff
    const pom = pomPom(std('#f3ead6', { roughness: 1 }), 0.045); pom.position.set(side * 0.12, -0.74, 0.32); g.add(pom);
    return g;
  };
  const R = make(1), L = make(-1);
  R.userData.setColor = (c) => {
    for (const [k, m] of mats) {
      if (k === 'knit') m.color.set(c);
      else { const nb = fairIsleTexture(c); nb.repeat.copy(m.map.repeat); m.map.dispose(); m.map = nb; m.bumpMap = nb; m.needsUpdate = true; }
    }
  };
  return { bone: 'armR', object: R, extras: [{ bone: 'armL', object: L }] };
}

function buildPufferVest(color) {
  const g = new THREE.Group();
  const shell = new THREE.MeshPhysicalMaterial({ color, roughness: 0.38, clearcoat: 0.6, clearcoatRoughness: 0.3, sheen: 0.4 });
  const seam = std(_tint(color, '#000000', 0.3), { roughness: 0.6 });
  const fleece = std('#f1ece2', { roughness: 1 });
  const zipM = std('#c9ced4', { metalness: 0.7, roughness: 0.3 });
  // quilted body: stacked puffy channels (front+back halves each side of the zip)
  for (let i = 0; i < 5; i++) {
    const y = 0.38 - i * 0.2;
    const p = mesh(new RoundedBoxGeometry(1.08, 0.2, 0.6, 3, 0.08), shell, 0, y, 0); g.add(p);
    g.add(mesh(new THREE.BoxGeometry(1.085, 0.014, 0.605), seam, 0, y - 0.1, 0));
  }
  // vertical stitch lines on the front for the diamond-ish quilting
  for (const x of [-0.3, 0.3]) g.add(mesh(new THREE.BoxGeometry(0.012, 0.98, 0.012), seam, x, -0.02, 0.302));
  // arm holes trim (sleeveless): dark piping at the shoulders
  for (const sx of [-1, 1]) g.add(mesh(new RoundedBoxGeometry(0.06, 0.5, 0.62, 2, 0.02), seam, sx * 0.53, 0.25, 0));
  // zip + pull
  g.add(mesh(new THREE.BoxGeometry(0.035, 0.96, 0.02), zipM, 0, -0.02, 0.31));
  const pull = mesh(new RoundedBoxGeometry(0.035, 0.08, 0.012, 2, 0.006), zipM, 0, 0.34, 0.325); g.add(pull);
  // fleece collar
  const collar = mesh(new THREE.TorusGeometry(0.34, 0.07, 10, 32), fleece, 0, 0.52, 0); collar.rotation.x = Math.PI / 2; collar.scale.set(1.08, 0.75, 1.3); g.add(collar);
  // chest pocket with a snowflake patch
  g.add(mesh(new RoundedBoxGeometry(0.22, 0.03, 0.02, 2, 0.008), seam, -0.26, 0.3, 0.315));
  const flake = snowflakeCharm(0.04); flake.position.set(0.26, 0.3, 0.32); g.add(flake);
  g.userData.tick = () => { pull.rotation.x = Math.sin(performance.now() / 600) * 0.15; };
  g.userData.setColor = (c) => { shell.color.set(c); seam.color.copy(_tint(c, '#000000', 0.3)); };
  return { bone: 'torso', object: g };
}

function buildJingleHat(color) {
  const g = new THREE.Group();
  const tex = knitTexture().clone(); tex.needsUpdate = true; tex.repeat.set(8, 4);
  const knit = std(color, { map: tex, bumpMap: tex, bumpScale: 1.3, roughness: 0.95 });
  const stripe = std('#f3ead6', { roughness: 1 });
  const fur = std('#fbf8f2', { roughness: 1 });
  // fluffy fur brim around the head
  const brim = mesh(new RoundedBoxGeometry(0.72, 0.14, 0.72, 4, 0.07), fur, 0, 0.56, 0); g.add(brim);
  // slouchy stocking: chain of tapering segments that droop to the side and swing
  const base = new THREE.Group(); base.position.set(0, 0.62, 0); g.add(base);
  const segs = []; let parent = base; const N = 7;
  for (let i = 0; i < N; i++) {
    const r0 = 0.34 * (1 - i / N) + 0.03, r1 = 0.34 * (1 - (i + 1) / N) + 0.03, h = 0.21;
    const s = new THREE.Group(); s.position.y = i === 0 ? 0 : 0.15; parent.add(s);
    const m = mesh(new THREE.CylinderGeometry(r1, r0, h, i < 2 ? 4 : 12, 1, false, Math.PI / 4), i % 2 ? stripe : knit, 0, h / 2, 0);
    if (i < 2) m.scale.set(1.35, 1, 1.35);
    s.add(m); segs.push(s); parent = s;
  }
  // jingle bell at the tip
  const gold = std('#f0c040', { metalness: 0.5, roughness: 0.25, emissive: '#6a4a00', emissiveIntensity: 0.5 });
  const bell = new THREE.Group(); bell.position.y = 0.2; parent.add(bell);
  bell.add(mesh(new THREE.SphereGeometry(0.07, 18, 14), gold));
  bell.add(mesh(new THREE.BoxGeometry(0.1, 0.008, 0.012), std('#4a3510', { roughness: 0.6 }), 0, -0.01, 0.066));
  bell.add(mesh(new THREE.SphereGeometry(0.012, 8, 6), std('#4a3510'), 0, -0.04, 0.06));
  bell.add(rotated(mesh(new THREE.TorusGeometry(0.02, 0.006, 6, 12), gold, 0, 0.075, 0), 'y', Math.PI / 2));
  g.userData.tick = () => { const t = performance.now() / 1000;
    segs.forEach((s, i) => { s.rotation.z = (i < 2 ? -0.1 : -0.38) + Math.sin(t * 2 - i * 0.5) * 0.05 * (i / N); s.rotation.x = (i > 2 ? 0.12 : 0) + Math.sin(t * 1.5 - i * 0.4) * 0.04 * (i / N); });
    bell.rotation.z = Math.sin(t * 6) * 0.25; };
  g.userData.tick();
  g.userData.setColor = (c) => knit.color.set(c);
  return { bone: 'head', object: g };
}

// ---- Winterhaven quest rewards (batch 2) ----
function emblemTexture(draw, bg = '#e9eef3', rim = '#8a97a6') {
  const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
  x.fillStyle = rim; x.beginPath(); x.arc(64, 64, 63, 0, Math.PI * 2); x.fill();
  x.fillStyle = bg; x.beginPath(); x.arc(64, 64, 55, 0, Math.PI * 2); x.fill();
  draw(x);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

function buildCarrotNose(color) {
  const g = new THREE.Group();
  const carrot = std(color, { roughness: 0.6 });
  const ridge = std(_tint(color, '#000000', 0.25), { roughness: 0.7 });
  const nose = new THREE.Group(); nose.position.set(0, 0.31, 0.31); g.add(nose);
  const cone = mesh(new THREE.ConeGeometry(0.06, 0.3, 14), carrot, 0, 0, 0.15); cone.rotation.x = Math.PI / 2; nose.add(cone);
  for (let i = 0; i < 4; i++) { const r = mesh(new THREE.TorusGeometry(0.052 - i * 0.011, 0.004, 4, 16), ridge, 0, 0, 0.05 + i * 0.055); nose.add(r); }
  nose.add(rotated(mesh(new THREE.CylinderGeometry(0.062, 0.062, 0.02, 14), carrot, 0, 0, 0.005), 'x', Math.PI / 2));
  // coal-button cheeks
  const coal = std('#1c1c1f', { roughness: 0.85, flatShading: true });
  for (const sx of [-1, 1]) for (let i = 0; i < 3; i++) g.add(mesh(new THREE.DodecahedronGeometry(0.022, 0), coal, sx * (0.16 + i * 0.035), 0.24 - i * 0.03 + (i === 2 ? 0.035 : 0), 0.32));
  g.userData.tick = () => { const t = performance.now() / 1000; nose.rotation.z = Math.sin(t * 1.3) * 0.04; nose.rotation.x = Math.sin(t * 2.1) * 0.03; };
  g.userData.setColor = (c) => { carrot.color.set(c); ridge.color.copy(_tint(c, '#000000', 0.25)); };
  return { bone: 'head', object: g };
}

function medalRibbon(g, ribbonM, stripeM, y0 = 0.53, dropY = 0.12) {
  // V-shaped ribbon from around the collar down to the medal
  for (const sx of [-1, 1]) {
    const r = mesh(new THREE.BoxGeometry(0.09, 0.42, 0.015), ribbonM, sx * 0.1, (y0 + dropY) / 2 + 0.02, 0.27); r.rotation.z = sx * 0.42; g.add(r);
    const s = mesh(new THREE.BoxGeometry(0.025, 0.42, 0.017), stripeM, sx * 0.1, (y0 + dropY) / 2 + 0.02, 0.272); s.rotation.z = sx * 0.42; g.add(s);
  }
  const back = mesh(new THREE.TorusGeometry(0.3, 0.02, 6, 32), ribbonM, 0, y0 - 0.02, -0.01); back.rotation.x = Math.PI / 2; back.scale.set(1.1, 0.85, 1); g.add(back);
}

// Flat ribbon strip following a smooth curve (soft drape instead of stiff boxes).
function ribbonStrip(points, width, mat, segs = 48, offset = 0) {
  const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal');
  const pos = [], idx = [], uv = [];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs, p = curve.getPointAt(t), tan = curve.getTangentAt(t);
    // side vector: perpendicular to tangent, lying on the body surface (normal ~ outward from torso centre)
    const out = new THREE.Vector3(p.x, 0, p.z).normalize(); if (out.lengthSq() < 1e-6) out.set(0, 0, 1);
    const side = new THREE.Vector3().crossVectors(tan, out).normalize().multiplyScalar(width / 2);
    const o = out.clone().multiplyScalar(offset);
    pos.push(p.x - side.x + o.x, p.y - side.y + o.y, p.z - side.z + o.z, p.x + side.x + o.x, p.y + side.y + o.y, p.z + side.z + o.z);
    uv.push(0, t, 1, t);
    if (i < segs) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(idx); geo.computeVertexNormals();
  const m = mesh(geo, mat); m.material = mat; return m;
}

function buildBridgeBadge(color) {
  const g = new THREE.Group();
  const ribbon = std(color, { roughness: 0.55, side: THREE.DoubleSide }), stripe = std('#f4f1ea', { roughness: 0.55, side: THREE.DoubleSide });
  // soft flat loop: from the medal, up the chest, round the back of the collar and down again
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const loop = [V(-0.02, 0.2, 0.3), V(-0.12, 0.33, 0.305), V(-0.2, 0.47, 0.29), V(-0.26, 0.55, 0.16), V(-0.22, 0.58, -0.08), V(0, 0.585, -0.24),
    V(0.22, 0.58, -0.08), V(0.26, 0.55, 0.16), V(0.2, 0.47, 0.29), V(0.12, 0.33, 0.305), V(0.02, 0.2, 0.3)];
  g.add(ribbonStrip(loop, 0.085, ribbon, 64));
  g.add(ribbonStrip(loop, 0.024, stripe, 64, 0.004));
  // pleated fold where the ribbon meets the medal
  const fold = mesh(new RoundedBoxGeometry(0.12, 0.05, 0.02, 2, 0.008), ribbon, 0, 0.2, 0.305); g.add(fold);
  const silver = std('#dfe6ee', { metalness: 0.6, roughness: 0.25 });
  const tex = emblemTexture((x) => {
    x.strokeStyle = '#4b6a8a'; x.lineWidth = 6; x.beginPath(); x.arc(64, 92, 38, Math.PI * 1.1, Math.PI * 1.9); x.stroke();   // arch
    x.lineWidth = 4; x.beginPath(); x.moveTo(20, 80); x.lineTo(108, 80); x.stroke();
    for (let i = 30; i <= 98; i += 12) { x.beginPath(); x.moveTo(i, 80); x.lineTo(i, 92 - Math.sqrt(Math.max(0, 38 * 38 - (i - 64) ** 2)) + 6); x.stroke(); }
    x.fillStyle = '#7fc4ef'; x.fillRect(20, 84, 88, 10);    // icy creek
    x.fillStyle = '#4b6a8a'; x.font = 'bold 14px sans-serif'; x.textAlign = 'center'; x.fillText('ICE BRIDGE', 64, 36);
  }, '#eef4f9', '#9aa8b6');
  const medal = new THREE.Group(); medal.position.set(0, 0.06, 0.29); g.add(medal);
  medal.add(rotated(mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.025, 32), silver), 'x', Math.PI / 2));
  medal.add(mesh(new THREE.CircleGeometry(0.1, 32), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.35, metalness: 0.3 }), 0, 0, 0.014));
  medal.add(mesh(new THREE.TorusGeometry(0.105, 0.008, 6, 32), silver, 0, 0, 0.012));
  medal.add(mesh(new THREE.BoxGeometry(0.1, 0.03, 0.02), silver, 0, 0.12, 0));
  const flake = snowflakeCharm(0.025); flake.position.set(0.085, 0.085, 0.02); medal.add(flake);
  medal.position.y = 0.07;
  g.userData.tick = () => { const t = performance.now() / 1000; medal.rotation.z = Math.sin(t * 1.4) * 0.05; medal.rotation.x = Math.sin(t * 1.9) * 0.04; fold.rotation.z = medal.rotation.z * 0.5; };
  g.userData.setColor = (c) => ribbon.color.set(c);
  return { bone: 'torso', object: g };
}

function buildCarolBells(color) {
  const g = new THREE.Group(); g.position.set(0, -0.92, 0.27);
  const metal = std(color, { metalness: 0.75, roughness: 0.22, emissive: _tint(color, '#000000', 0.7), emissiveIntensity: 0.6 });
  const wood = std('#6b3f22', { roughness: 0.6 });
  const swing = new THREE.Group(); g.add(swing);
  // handle in the fist
  swing.add(mesh(new THREE.CylinderGeometry(0.035, 0.04, 0.24, 14), wood, 0, 0.08, 0));
  swing.add(mesh(new THREE.SphereGeometry(0.05, 14, 10), wood, 0, 0.22, 0));
  swing.add(mesh(new THREE.CylinderGeometry(0.03, 0.05, 0.04, 14), metal, 0, -0.06, 0));
  // bell (lathe profile), opening downward
  const pts = [[0.0, 0], [0.05, -0.005], [0.075, -0.04], [0.085, -0.1], [0.11, -0.17], [0.14, -0.2], [0.135, -0.21]].map(([r, y]) => new THREE.Vector2(r, y));
  const bellGeo = new THREE.LatheGeometry(pts, 32); const bell = mesh(bellGeo, metal, 0, -0.07, 0); bell.material = metal; bell.material.side = THREE.DoubleSide; swing.add(bell);
  const clapper = mesh(new THREE.SphereGeometry(0.03, 10, 8), std('#3a3a3a', { metalness: 0.5 }), 0, -0.26, 0); swing.add(clapper);
  swing.add(rotated(mesh(new THREE.TorusGeometry(0.138, 0.008, 6, 32), metal, 0, -0.275, 0), 'x', Math.PI / 2));
  // holly sprig with ribbon at the collar
  const leaf = std('#1f6b3c', { roughness: 0.5 }), berry = std('#d0242c', { roughness: 0.3 });
  for (const [a, x] of [[0.6, 0.05], [-0.6, -0.05]]) { const l = mesh(new THREE.SphereGeometry(0.04, 8, 6), leaf, x, -0.04, 0.045); l.scale.set(1.6, 0.5, 0.25); l.rotation.z = a; swing.add(l); }
  for (const [x, y] of [[0, -0.03], [0.02, -0.05], [-0.02, -0.05]]) swing.add(mesh(new THREE.SphereGeometry(0.016, 8, 6), berry, x, y, 0.06));
  // little musical sparkles
  const N = 10, pos = new Float32Array(N * 3), life = new Float32Array(N); for (let i = 0; i < N; i++) life[i] = Math.random();
  const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const sp = new THREE.Points(pg, new THREE.PointsMaterial({ map: softDotTexture(), size: 0.06, color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); g.add(sp);
  g.userData.tick = (dt = 0) => { const t = performance.now() / 1000; const ring = Math.sin(t * 5);
    swing.rotation.z = ring * 0.35; clapper.position.x = -ring * 0.06;
    for (let i = 0; i < N; i++) { life[i] += dt * 0.6; if (life[i] > 1) life[i] -= 1; const l = life[i], a = i * 2.4;
      pos[i * 3] = Math.cos(a) * (0.12 + l * 0.2); pos[i * 3 + 1] = -0.3 + l * 0.1 + Math.sin(a) * 0.05; pos[i * 3 + 2] = Math.sin(a) * (0.12 + l * 0.2); }
    pg.attributes.position.needsUpdate = true; };
  g.userData.tick(0);
  g.userData.setColor = (c) => { metal.color.set(c); metal.emissive.copy(_tint(c, '#000000', 0.7)); sp.material.color.set(c); };
  return { bone: 'armR', object: g };
}

function buildPassGoggles(color) {
  const g = new THREE.Group();
  const EX = 0.12, EY = 0.37, Z = 0.345, R = 0.085;
  const brass = std('#a8823a', { metalness: 0.75, roughness: 0.3 });
  const leather = std('#5a3a22', { roughness: 0.8 });
  const lens = new THREE.MeshPhysicalMaterial({ color, metalness: 0.9, roughness: 0.08, iridescence: 1, iridescenceIOR: 1.6, emissive: color, emissiveIntensity: 0.2, clearcoat: 1 });
  const frost = std('#f4faff', { roughness: 0.9 });
  for (const s of [-1, 1]) {
    const cup = mesh(new THREE.CylinderGeometry(R + 0.012, R + 0.025, 0.06, 28, 1, true), leather, s * EX, EY, Z - 0.03); cup.rotation.x = Math.PI / 2; cup.material.side = THREE.DoubleSide; g.add(cup);
    g.add(mesh(new THREE.TorusGeometry(R + 0.008, 0.014, 8, 28), brass, s * EX, EY, Z));
    const l = mesh(new THREE.SphereGeometry(R, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), lens, s * EX, EY, Z - 0.005); l.rotation.x = Math.PI / 2; l.scale.set(1, 0.35, 1); g.add(l);
    // side shield vents
    for (let i = 0; i < 3; i++) g.add(mesh(new THREE.BoxGeometry(0.006, 0.05, 0.012), brass, s * (EX + R + 0.022), EY - 0.03 + i * 0.03, Z - 0.03));
    // frost rime on the rims
    for (let i = 0; i < 6; i++) { const a = Math.PI * (0.15 + i * 0.13) * (s > 0 ? 1 : -1) + (s > 0 ? 0 : Math.PI); g.add(mesh(new THREE.IcosahedronGeometry(0.009, 0), frost, s * EX + Math.cos(a) * (R + 0.015), EY + Math.abs(Math.sin(a)) * (R + 0.015), Z + 0.006)); }
    // strap to the back of the head
    g.add(mesh(new THREE.BoxGeometry(0.02, 0.05, 0.64), leather, s * 0.325, EY, 0.0));
  }
  g.add(mesh(new THREE.BoxGeometry(0.66, 0.05, 0.02), leather, 0, EY, -0.325));
  g.add(mesh(new THREE.BoxGeometry(0.06, 0.03, 0.03), brass, 0, EY, -0.335));
  const bridge = mesh(new THREE.TorusGeometry(0.035, 0.01, 6, 12, Math.PI), brass, 0, EY + 0.005, Z); g.add(bridge);
  // glint sweep
  const glint = new THREE.Sprite(new THREE.SpriteMaterial({ map: softDotTexture(), color: '#ffffff', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })); glint.scale.setScalar(0.07); g.add(glint);
  g.userData.tick = () => { const t = (performance.now() / 1000) % 3.5; const k = Math.min(1, t / 0.6);
    glint.position.set(-EX - R + k * 2 * (EX + R), EY + 0.03, Z + 0.02); glint.material.opacity = t < 0.6 ? Math.sin(k * Math.PI) * 0.9 : 0; };
  g.userData.setColor = (c) => { lens.color.set(c); lens.emissive.set(c); };
  return { bone: 'head', object: g };
}

function buildSnowballSack(color) {
  const g = new THREE.Group();
  const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
  x.fillStyle = '#ffffff'; x.fillRect(0, 0, 64, 64); x.fillStyle = 'rgba(0,0,0,0.18)';
  for (let i = 0; i < 64; i += 4) { x.fillRect(i, 0, 1, 64); x.fillRect(0, i, 64, 1); }
  const weave = new THREE.CanvasTexture(c); weave.wrapS = weave.wrapT = THREE.RepeatWrapping; weave.repeat.set(4, 4);
  const sackM = std(color, { map: weave, bumpMap: weave, bumpScale: 1, roughness: 1 });
  const rope = std('#d8c08a', { roughness: 0.9 });
  const snow = std('#ffffff', { roughness: 0.75 });
  // strap diagonally across the chest
  const strap = mesh(new THREE.BoxGeometry(0.08, 1.25, 0.025), rope, 0, 0, 0.27); strap.rotation.z = 0.78; g.add(strap);
  const strapB = mesh(new THREE.BoxGeometry(0.08, 1.25, 0.025), rope, 0, 0, -0.27); strapB.rotation.z = -0.78; g.add(strapB);
  const sack = new THREE.Group(); sack.position.set(0.05, -0.1, -0.5); g.add(sack);
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.3, 24, 16), sackM); body.scale.set(1.05, 1.25, 0.75); sack.add(body);
  const neck = mesh(new THREE.CylinderGeometry(0.12, 0.2, 0.14, 18), sackM, 0, 0.36, 0); sack.add(neck);
  const lip = mesh(new THREE.CylinderGeometry(0.2, 0.13, 0.08, 18, 1, true), sackM, 0, 0.46, 0); lip.material = sackM.clone(); lip.material.side = THREE.DoubleSide; sack.add(lip);
  sack.add(rotated(mesh(new THREE.TorusGeometry(0.125, 0.018, 6, 24), rope, 0, 0.38, 0), 'x', Math.PI / 2));
  for (const sx of [-1, 1]) { const end = mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.16, 6), rope, sx * 0.07, 0.3, 0.12); end.rotation.z = sx * 0.3; sack.add(end); }
  // snowballs heaped in the mouth
  const balls = [];
  for (const [bx, by, bz, r] of [[0, 0.52, 0, 0.09], [-0.09, 0.49, 0.03, 0.075], [0.09, 0.5, -0.02, 0.08], [0.02, 0.6, 0.04, 0.07], [-0.04, 0.5, -0.08, 0.07]]) {
    const b = mesh(new THREE.IcosahedronGeometry(r, 2), snow, bx, by, bz); sack.add(b); balls.push(b);
  }
  // patch
  sack.add(mesh(new RoundedBoxGeometry(0.16, 0.14, 0.02, 2, 0.01), std(_tint(color, '#ffffff', 0.35), { roughness: 1 }), 0.12, -0.05, -0.23));
  g.userData.tick = () => { const t = performance.now() / 1000; sack.rotation.z = Math.sin(t * 1.6) * 0.05; balls.forEach((b, i) => b.position.y += Math.sin(t * 4 + i) * 0.0004); };
  g.userData.setColor = (c) => { sackM.color.set(c); lip.material.color.set(c); };
  return { bone: 'torso', object: g };
}

function buildBakerHat(color) {
  const g = new THREE.Group();
  const cloth = std('#fbfaf6', { roughness: 0.9 });
  const ribbonM = std(color, { roughness: 0.5 });
  g.add(mesh(new THREE.CylinderGeometry(0.47, 0.47, 0.22, 4, 1, false, Math.PI / 4), cloth, 0, 0.6, 0));
  for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; g.add(mesh(new THREE.BoxGeometry(0.01, 0.2, 0.01), std('#e8e4da'), Math.cos(a) * 0.33, 0.6, Math.sin(a) * 0.33)); }
  // puffy toque top: cluster of soft spheres
  const puff = new THREE.Group(); puff.position.y = 0.9; g.add(puff);
  puff.add(mesh(new THREE.SphereGeometry(0.3, 20, 14), cloth, 0, 0, 0));
  for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; puff.add(mesh(new THREE.SphereGeometry(0.2, 16, 12), cloth, Math.cos(a) * 0.22, -0.05, Math.sin(a) * 0.22)); }
  puff.scale.set(1.1, 0.8, 1.1);
  // ribbon band + bow
  g.add(mesh(new THREE.CylinderGeometry(0.476, 0.476, 0.07, 4, 1, false, Math.PI / 4), ribbonM, 0, 0.56, 0));
  for (const sx of [-1, 1]) { const loop = mesh(new THREE.SphereGeometry(0.05, 10, 8), ribbonM, sx * 0.05, 0.57, 0.35); loop.scale.set(1.3, 0.8, 0.5); g.add(loop); }
  g.add(mesh(new THREE.SphereGeometry(0.025, 8, 6), ribbonM, 0, 0.57, 0.36));
  // gingerbread cookie tucked in the band
  const cookie = new THREE.Group(); cookie.position.set(0.22, 0.66, 0.34); cookie.rotation.z = -0.25; g.add(cookie);
  const ginger = std('#b5652b', { roughness: 0.8 }), icing = std('#ffffff', { roughness: 0.5 });
  cookie.add(mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.025, 14), ginger, 0, 0.07, 0).rotateX(Math.PI / 2));
  cookie.add(mesh(new RoundedBoxGeometry(0.07, 0.07, 0.025, 2, 0.01), ginger, 0, 0.01, 0));
  for (const sx of [-1, 1]) { const arm = mesh(new RoundedBoxGeometry(0.06, 0.025, 0.025, 2, 0.01), ginger, sx * 0.05, 0.025, 0); arm.rotation.z = sx * 0.3; cookie.add(arm); const leg = mesh(new RoundedBoxGeometry(0.025, 0.06, 0.025, 2, 0.01), ginger, sx * 0.02, -0.045, 0); cookie.add(leg); }
  for (const y of [0.025, 0.0]) cookie.add(mesh(new THREE.SphereGeometry(0.007, 6, 4), icing, 0, y, 0.014));
  for (const sx of [-1, 1]) cookie.add(mesh(new THREE.SphereGeometry(0.006, 6, 4), std('#3a2010'), sx * 0.012, 0.075, 0.018));
  g.userData.tick = () => { puff.rotation.z = Math.sin(performance.now() / 900) * 0.03; };
  g.userData.setColor = (c) => ribbonM.color.set(c);
  return { bone: 'head', object: g };
}

function buildFishingLure(color) {
  const g = new THREE.Group(); g.position.set(0, -0.92, 0.27);
  const cork = std('#c89a62', { roughness: 0.9 }), rodM = std('#2d3a4a', { roughness: 0.4, metalness: 0.3 });
  const reelM = std('#c9ced4', { metalness: 0.8, roughness: 0.3 });
  const rod = new THREE.Group(); rod.rotation.x = 0.9; g.add(rod);
  rod.add(mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.2, 12), cork, 0, 0, 0));
  rod.add(mesh(new THREE.CylinderGeometry(0.012, 0.02, 0.6, 8), rodM, 0, 0.4, 0));
  rod.add(mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.035, 18), reelM, 0.05, 0.1, 0).rotateZ(Math.PI / 2));
  rod.add(mesh(new THREE.BoxGeometry(0.01, 0.04, 0.01), reelM, 0.08, 0.13, 0));
  for (let i = 0; i < 3; i++) rod.add(mesh(new THREE.TorusGeometry(0.012, 0.003, 4, 10), reelM, 0, 0.25 + i * 0.15, 0.02));
  const tipLocal = new THREE.Vector3(0, 0.7, 0);
  // line + bobber + lure dangling from the tip (world-down)
  const hang = new THREE.Group(); g.add(hang);
  const tipPos = tipLocal.clone().applyEuler(rod.rotation); hang.position.copy(tipPos);
  const lineM = new THREE.LineBasicMaterial({ color: '#e8eef4' });
  const lineGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, -0.45, 0)]);
  hang.add(new THREE.Line(lineGeo, lineM));
  const bobber = new THREE.Group(); bobber.position.y = -0.2; hang.add(bobber);
  const bobTop = std(color, { roughness: 0.35 });
  bobber.add(mesh(new THREE.SphereGeometry(0.04, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), bobTop));
  bobber.add(mesh(new THREE.SphereGeometry(0.04, 16, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), std('#ffffff', { roughness: 0.35 })));
  bobber.add(mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.03, 6), bobTop, 0, 0.05, 0));
  const lure = new THREE.Group(); lure.position.y = -0.45; hang.add(lure);
  const fishM = std('#dfe8f0', { metalness: 0.9, roughness: 0.15, emissive: color, emissiveIntensity: 0.15 });
  const body = mesh(new THREE.SphereGeometry(0.03, 12, 8), fishM); body.scale.set(0.6, 1.6, 0.4); lure.add(body);
  lure.add(mesh(new THREE.ConeGeometry(0.025, 0.04, 4), fishM, 0, -0.06, 0).rotateX(Math.PI));
  lure.add(mesh(new THREE.TorusGeometry(0.012, 0.003, 4, 10, Math.PI * 1.4), reelM, 0, -0.09, 0));
  g.userData.tick = () => { const t = performance.now() / 1000; hang.rotation.z = Math.sin(t * 1.7) * 0.15; hang.rotation.x = Math.sin(t * 1.2) * 0.08; bobber.position.y = -0.2 + Math.sin(t * 3) * 0.01; lure.rotation.y = t * 2; };
  g.userData.setColor = (c) => { bobTop.color.set(c); fishM.emissive.set(c); };
  return { bone: 'armR', object: g };
}

function buildParcelSatchel(color) {
  const g = new THREE.Group();
  const leather = std(color, { roughness: 0.55 });
  const dark = std(_tint(color, '#000000', 0.35), { roughness: 0.6 });
  const brass = std('#c8a045', { metalness: 0.8, roughness: 0.3 });
  // cross-body strap (front + back) with buckle
  for (const z of [0.27, -0.27]) { const s = mesh(new THREE.BoxGeometry(0.09, 1.3, 0.02), dark, 0, 0, z); s.rotation.z = z > 0 ? -0.8 : 0.8; g.add(s); }
  g.add(mesh(new RoundedBoxGeometry(0.1, 0.08, 0.02, 2, 0.01), brass, -0.12, 0.12, 0.285));
  // satchel on the back, slung low on one side
  const bag = new THREE.Group(); bag.position.set(-0.12, -0.25, -0.42); bag.rotation.z = 0.08; g.add(bag);
  bag.add(mesh(new RoundedBoxGeometry(0.7, 0.46, 0.26, 3, 0.06), leather, 0, 0, 0));
  const flap = mesh(new RoundedBoxGeometry(0.72, 0.28, 0.03, 3, 0.012), dark, 0, 0.1, -0.14); bag.add(flap);
  for (const sx of [-0.2, 0.2]) { bag.add(mesh(new THREE.BoxGeometry(0.05, 0.22, 0.012), dark, sx, -0.06, -0.158)); bag.add(mesh(new RoundedBoxGeometry(0.06, 0.05, 0.015, 2, 0.006), brass, sx, -0.14, -0.164)); }
  // stitching
  for (let i = 0; i < 14; i++) bag.add(mesh(new THREE.BoxGeometry(0.025, 0.005, 0.004), std('#f0e2c0'), -0.33 + i * 0.05, -0.02, -0.158));
  // parcels poking out the top: wrapped boxes with string + a rolled letter
  const paper = [std('#e9d9b5', { roughness: 0.9 }), std('#c94a3a', { roughness: 0.7 }), std('#4a7ab0', { roughness: 0.7 })];
  const twine = std('#7a5a3a');
  [[-0.18, 0.28, 0.02, 0.2, 0.18, 0.16, 0], [0.06, 0.3, 0.0, 0.17, 0.22, 0.14, 1], [0.24, 0.26, 0.03, 0.15, 0.14, 0.13, 2]].forEach(([x, y, z, w, h, d, k]) => {
    const p = mesh(new THREE.BoxGeometry(w, h, d), paper[k], x, y, z); p.rotation.z = (k - 1) * 0.15; bag.add(p);
    p.add(mesh(new THREE.BoxGeometry(w + 0.004, 0.012, d + 0.004), twine)); p.add(mesh(new THREE.BoxGeometry(0.012, h + 0.004, d + 0.004), twine));
  });
  const letter = mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.26, 12), std('#f6efe0'), -0.02, 0.32, 0.08); letter.rotation.z = 1.1; bag.add(letter);
  bag.add(mesh(new THREE.CylinderGeometry(0.034, 0.034, 0.02, 12), std('#b3242a', { roughness: 0.4 }), -0.02, 0.32, 0.08).rotateZ(1.1));
  // postal emblem on the flap
  const em = emblemTexture((x) => { x.fillStyle = '#b3242a'; x.font = 'bold 60px serif'; x.textAlign = 'center'; x.fillText('✉', 64, 86); }, '#f3ead6', '#c8a045');
  bag.add(mesh(new THREE.CircleGeometry(0.07, 24), new THREE.MeshStandardMaterial({ map: em, roughness: 0.6 }), 0, 0.12, -0.157).rotateY(Math.PI));
  g.userData.tick = () => { bag.rotation.z = 0.08 + Math.sin(performance.now() / 650) * 0.04; };
  g.userData.setColor = (c) => { leather.color.set(c); dark.color.copy(_tint(c, '#000000', 0.35)); };
  return { bone: 'torso', object: g };
}

function buildRangerBadge(color) {
  const g = new THREE.Group();
  const cord = std(color, { roughness: 0.7 }), stripe = std('#d8c08a', { roughness: 0.7 });
  medalRibbon(g, cord, stripe, 0.53, 0.18);
  const brass = std('#c8a045', { metalness: 0.75, roughness: 0.28 });
  // shield shape
  const sh = new THREE.Shape(); sh.moveTo(0, 0.13); sh.quadraticCurveTo(0.1, 0.12, 0.11, 0.09); sh.lineTo(0.1, -0.02); sh.quadraticCurveTo(0.07, -0.1, 0, -0.14); sh.quadraticCurveTo(-0.07, -0.1, -0.1, -0.02); sh.lineTo(-0.11, 0.09); sh.quadraticCurveTo(-0.1, 0.12, 0, 0.13);
  const badge = new THREE.Group(); badge.position.set(0, 0.08, 0.28); g.add(badge);
  badge.add(mesh(new THREE.ExtrudeGeometry(sh, { depth: 0.02, bevelEnabled: true, bevelSize: 0.008, bevelThickness: 0.006, bevelSegments: 2 }), brass));
  const inner = new THREE.Shape(sh.getPoints(24).map(p => p.clone().multiplyScalar(0.78)));
  const enamel = std(color, { roughness: 0.3 });
  badge.add(mesh(new THREE.ShapeGeometry(inner), enamel, 0, 0, 0.031));
  // pine tree emblem
  const pine = std('#f3ead6', { roughness: 0.5 });
  for (let i = 0; i < 3; i++) badge.add(mesh(new THREE.ConeGeometry(0.05 - i * 0.012, 0.05, 3), pine, 0, -0.02 + i * 0.035, 0.035).rotateY(Math.PI / 6));
  badge.add(mesh(new THREE.BoxGeometry(0.012, 0.02, 0.006), pine, 0, -0.06, 0.035));
  for (const sx of [-1, 1]) badge.add(mesh(new THREE.OctahedronGeometry(0.012, 0), brass, sx * 0.065, 0.075, 0.035));
  // compass charm hanging beside it
  const comp = new THREE.Group(); comp.position.set(0.15, 0.1, 0.285); g.add(comp);
  comp.add(rotated(mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.015, 20), brass), 'x', Math.PI / 2));
  comp.add(mesh(new THREE.CircleGeometry(0.032, 20), std('#f6f2e6'), 0, 0, 0.009));
  const needle = mesh(new THREE.BoxGeometry(0.006, 0.05, 0.003), std('#c0392b'), 0, 0, 0.012); comp.add(needle);
  g.userData.tick = () => { const t = performance.now() / 1000; needle.rotation.z = Math.sin(t * 0.9) * 0.6; badge.rotation.z = Math.sin(t * 1.1) * 0.04; comp.rotation.z = Math.sin(t * 1.4 + 1) * 0.08; };
  g.userData.setColor = (c) => { cord.color.set(c); enamel.color.set(c); };
  return { bone: 'torso', object: g };
}

function buildWolfPup(color) {
  const g = new THREE.Group();
  const P = new THREE.Group(); P.position.set(-0.75, 0.5, 0.02); P.rotation.y = 0.4; g.add(P);
  const furW = std('#eef2f6', { roughness: 1 }), furG = std('#a9b4c2', { roughness: 1 }), dark = std('#2a2f38', { roughness: 0.5 });
  const scarfM = std(color, { roughness: 0.95 });
  // body (sitting), chest fluff
  const body = mesh(new THREE.SphereGeometry(0.15, 18, 14), furG, 0, 0.14, -0.02); body.scale.set(1, 1.05, 1.2); P.add(body);
  P.add(mesh(new THREE.SphereGeometry(0.1, 14, 10), furW, 0, 0.12, 0.09));
  for (const sx of [-1, 1]) { P.add(mesh(new THREE.CylinderGeometry(0.035, 0.04, 0.14, 10), furW, sx * 0.06, 0.05, 0.09)); P.add(mesh(new THREE.SphereGeometry(0.045, 10, 8), furW, sx * 0.06, -0.01, 0.11)); P.add(mesh(new THREE.SphereGeometry(0.06, 10, 8), furG, sx * 0.1, 0.03, -0.06)); }
  // head
  const H = new THREE.Group(); H.position.set(0, 0.34, 0.04); P.add(H);
  H.add(mesh(new THREE.SphereGeometry(0.12, 18, 14), furG));
  const muzzle = mesh(new THREE.SphereGeometry(0.065, 14, 10), furW, 0, -0.03, 0.1); muzzle.scale.set(1, 0.8, 1.2); H.add(muzzle);
  H.add(mesh(new THREE.SphereGeometry(0.02, 10, 8), dark, 0, -0.01, 0.175));
  for (const sx of [-1, 1]) {
    H.add(mesh(new THREE.SphereGeometry(0.075, 10, 8), furW, sx * 0.07, -0.02, 0.06));   // cheek fluff
    H.add(mesh(new THREE.SphereGeometry(0.022, 10, 8), dark, sx * 0.05, 0.03, 0.1));
    H.add(mesh(new THREE.SphereGeometry(0.007, 6, 4), std('#ffffff', { emissive: '#ffffff' }), sx * 0.05 + 0.007, 0.04, 0.12));
    const ear = mesh(new THREE.ConeGeometry(0.045, 0.1, 4), furG, sx * 0.07, 0.12, -0.01); ear.rotation.z = -sx * 0.3; H.add(ear);
    H.add(mesh(new THREE.ConeGeometry(0.025, 0.06, 4), std('#f2c4c8', { roughness: 1 }), sx * 0.068, 0.115, 0.012).rotateZ(-sx * 0.3));
  }
  // fluffy tail
  const tail = new THREE.Group(); tail.position.set(0, 0.1, -0.17); P.add(tail);
  const t1 = mesh(new THREE.SphereGeometry(0.06, 12, 10), furG, 0, 0.05, -0.04); t1.scale.set(1, 1.6, 1); tail.add(t1);
  tail.add(mesh(new THREE.SphereGeometry(0.045, 10, 8), furW, 0, 0.14, -0.06));
  // scarf
  const sc = mesh(new THREE.TorusGeometry(0.095, 0.03, 8, 20), scarfM, 0, 0.25, 0.03); sc.rotation.x = Math.PI / 2 - 0.2; P.add(sc);
  const tailS = mesh(new RoundedBoxGeometry(0.05, 0.12, 0.02, 2, 0.008), scarfM, 0.05, 0.18, 0.13); tailS.rotation.z = 0.2; P.add(tailS);
  g.userData.tick = () => { const t = performance.now() / 1000;
    P.position.y = 0.5 + Math.abs(Math.sin(t * 2.6)) * 0.03; H.rotation.z = Math.sin(t * 1.3) * 0.12; H.rotation.x = Math.sin(t * 0.9) * 0.08;
    tail.rotation.z = Math.sin(t * 8) * 0.5; tailS.rotation.x = Math.sin(t * 2.6) * 0.15; };
  g.userData.tick();
  g.userData.setColor = (c) => scarfM.color.set(c);
  return { bone: 'torso', object: g };
}

function buildIceSkates(color) {
  const g = new THREE.Group();
  const leather = std(color, { roughness: 0.55 });
  const cuff = std(_tint(color, '#ffffff', 0.18), { roughness: 0.9 });
  const sole = std('#3b2a1e', { roughness: 0.7 });
  const steel = std('#e8eef5', { metalness: 0.55, roughness: 0.25 });
  const laceM = std('#fbfbf6', { roughness: 0.9 });
  function skate() {
    const s = new THREE.Group();
    s.add(mesh(new RoundedBoxGeometry(0.34, 0.13, 0.15, 3, 0.05), leather, 0.02, 0, 0));          // foot
    s.add(mesh(new RoundedBoxGeometry(0.17, 0.3, 0.16, 3, 0.05), leather, -0.07, 0.17, 0));       // shaft
    s.add(mesh(new RoundedBoxGeometry(0.19, 0.06, 0.18, 2, 0.025), cuff, -0.07, 0.33, 0));        // padded cuff
    s.add(mesh(new THREE.BoxGeometry(0.36, 0.03, 0.155), sole, 0.02, -0.075, 0));
    s.add(mesh(new THREE.BoxGeometry(0.08, 0.06, 0.155), sole, -0.12, -0.1, 0));                  // heel
    for (const x of [-0.12, 0.13]) s.add(mesh(new THREE.BoxGeometry(0.04, 0.07, 0.03), steel, x, -0.125, 0));
    s.add(mesh(new THREE.BoxGeometry(0.42, 0.035, 0.018), steel, 0.01, -0.17, 0));                // blade
    s.add(rotated(mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.018, 16, 1, false, 0, Math.PI), steel, 0.22, -0.17, 0), 'x', Math.PI / 2)); // curled toe pick
    for (let i = 0; i < 4; i++) {                                                                  // criss-cross laces on the front
      const y = 0.04 + i * 0.07;
      for (const sgn of [-1, 1]) s.add(rotated(mesh(new THREE.BoxGeometry(0.01, 0.014, 0.15), laceM, 0.02, y + 0.06, 0), 'x', sgn * 0.45));
    }
    return s;
  }
  const front = skate(); front.position.set(0.24, -0.02, 0.35); front.rotation.set(0, 0, -0.35); front.scale.setScalar(0.9);
  const back = skate(); back.position.set(0.24, -0.02, -0.35); back.rotation.set(0, Math.PI, 0.35); back.scale.setScalar(0.9);
  // laces on the front face need to sit on the shaft front: shift
  g.add(front, back);
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.2, 0.28, 0.35), new THREE.Vector3(0.28, 0.5, 0.29), new THREE.Vector3(0.3, 0.56, 0),
    new THREE.Vector3(0.28, 0.5, -0.29), new THREE.Vector3(0.2, 0.28, -0.35)]);
  g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 32, 0.015, 6), laceM));
  g.userData.setColor = (c) => { leather.color.set(c); cuff.color.copy(_tint(c, '#ffffff', 0.18)); };
  return { bone: 'torso', object: g };
}

function buildHailUmbrella(color) {
  const g = new THREE.Group(); g.position.set(0, -0.95, 0.31); g.rotation.z = 0.22; g.rotation.x = -0.06; // lean the canopy over the head
  const ribs = 8, R = 0.66, top = 2.12;
  // canopy: alternating panel shades + scalloped trim
  const panelA = std(color, { roughness: 0.55, side: THREE.DoubleSide, flatShading: true });
  const panelB = std(_tint(color, '#ffffff', 0.18), { roughness: 0.55, side: THREE.DoubleSide, flatShading: true });
  const trimM = std(_tint(color, '#000000', 0.35), { roughness: 0.6 });
  const metal = std('#c9d2db', { metalness: 0.9, roughness: 0.25 });
  const canopy = new THREE.Group(); canopy.position.y = top; g.add(canopy);
  for (let i = 0; i < ribs; i++) {
    const a0 = i / ribs * Math.PI * 2, a1 = (i + 1) / ribs * Math.PI * 2;
    const geo = new THREE.BufferGeometry();
    const pt = (a, r) => { const sag = Math.pow(r / R, 1.6) * 0.22; return [Math.cos(a) * r, -sag, Math.sin(a) * r]; };
    const v = [];
    const segs = 4;
    for (let k = 0; k < segs; k++) {
      const r0 = k / segs * R, r1 = (k + 1) / segs * R;
      const p00 = pt(a0, r0), p01 = pt(a1, r0), p10 = pt(a0, r1), p11 = pt(a1, r1), pm = pt((a0 + a1) / 2, r1 * 0.97);
      v.push(...p00, ...p10, ...pm, ...p00, ...pm, ...p01, ...p01, ...pm, ...p11);
    }
    geo.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); geo.computeVertexNormals();
    canopy.add(mesh(geo, i % 2 ? panelA : panelB));
    // rib + tip
    const tipP = pt(a0, R);
    const tipV = new THREE.Vector3(...tipP), rib = mesh(new THREE.CylinderGeometry(0.006, 0.006, tipV.length(), 5), metal, tipP[0] / 2, tipP[1] / 2 - 0.004, tipP[2] / 2);
    rib.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tipV.clone().normalize()); canopy.add(rib);
    canopy.add(mesh(new THREE.SphereGeometry(0.018, 8, 6), trimM, ...tipP));
  }
  canopy.add(rotated(mesh(new THREE.TorusGeometry(R * 0.985, 0.012, 6, 48), trimM, 0, -0.215, 0), 'x', Math.PI / 2));
  canopy.add(mesh(new THREE.ConeGeometry(0.03, 0.12, 10), metal, 0, 0.06, 0));          // ferrule
  canopy.add(mesh(new THREE.SphereGeometry(0.03, 10, 8), trimM, 0, 0.0, 0));
  // shaft + crook handle in the fist
  g.add(mesh(new THREE.CylinderGeometry(0.016, 0.016, top + 0.05, 8), metal, 0, top / 2 - 0.02, 0));
  const handle = mesh(new THREE.TorusGeometry(0.06, 0.022, 8, 16, Math.PI), std('#6b4426', { roughness: 0.5 }), -0.06, -0.04, 0);
  handle.rotation.z = Math.PI; g.add(handle);
  g.add(mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.12, 10), std('#6b4426', { roughness: 0.5 }), 0, 0.02, 0));
  // hailstones: instanced, fall onto the canopy and bounce off
  const HN = 22, hail = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.028, 0), std('#eef8ff', { roughness: 0.15, transparent: true, opacity: 0.92, flatShading: true }), HN);
  hail.castShadow = false; g.add(hail);
  const st = [], dm = new THREE.Object3D();
  const spawn = (h, first) => { const a = Math.random() * 6.28, r = Math.sqrt(Math.random()) * R * 0.9; h.x = Math.cos(a) * r; h.z = Math.sin(a) * r; h.y = top + 0.5 + (first ? Math.random() * 0.8 : Math.random() * 0.3); h.vx = 0; h.vz = 0; h.vy = -1.2; h.bounced = false; h.life = 0; };
  for (let i = 0; i < HN; i++) { const h = {}; spawn(h, true); st.push(h); }
  const surf = (x, z) => top - Math.pow(Math.min(1, Math.hypot(x, z) / R), 1.6) * 0.22 + 0.03;
  const step = (dt) => {
    for (let i = 0; i < HN; i++) {
      const h = st[i]; h.vy -= 4.5 * dt; h.x += h.vx * dt; h.y += h.vy * dt; h.z += h.vz * dt; h.life += dt;
      const inside = Math.hypot(h.x, h.z) < R;
      if (inside && !h.bounced && h.y <= surf(h.x, h.z)) {
        const r = Math.hypot(h.x, h.z) || 1;   // bounce outward along the slope
        h.y = surf(h.x, h.z); h.vy = 0.9 + Math.random() * 0.4; h.vx = h.x / r * (0.5 + Math.random() * 0.4); h.vz = h.z / r * (0.5 + Math.random() * 0.4); h.bounced = true;
      }
      if (h.y < top - 0.9 || h.life > 3) spawn(h, false);
      dm.position.set(h.x, h.y, h.z); dm.rotation.set(h.life * 5, h.life * 3, 0); dm.updateMatrix(); hail.setMatrixAt(i, dm.matrix);
    }
    hail.instanceMatrix.needsUpdate = true;
  };
  step(0.016);
  g.userData.tick = (dt) => step(Math.min(dt, 0.05));
  g.userData.setColor = (c) => { panelA.color.set(c); panelB.color.copy(_tint(c, '#ffffff', 0.18)); trimM.color.copy(_tint(c, '#000000', 0.35)); };
  return { bone: 'armR', object: g };
}

// Aurora shimmer for shimmer skins: patches skin materials once; uAur=0 means no effect.
function addAuroraShimmer(mat, uniforms) {
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uniforms);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vAurPos;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvAurPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vAurPos; uniform float uAur, uAurTime; uniform vec3 uAurColor;')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        if (uAur > 0.0) {
          float b1 = sin(vAurPos.y * 7.0 + vAurPos.x * 3.0 - uAurTime * 1.6) * 0.5 + 0.5;
          float b2 = sin(vAurPos.y * 11.0 - vAurPos.z * 4.0 + uAurTime * 1.1) * 0.5 + 0.5;
          vec3 shift = 0.5 + 0.5 * cos(6.2832 * (vec3(0.0, 0.33, 0.67) + vAurPos.y * 0.35 + uAurTime * 0.08));
          vec3 aur = mix(uAurColor, shift, 0.45);
          float keep = smoothstep(0.12, 0.45, dot(diffuseColor.rgb, vec3(0.333)));   // keep face features dark
          totalEmissiveRadiance += aur * (pow(b1, 3.0) * 0.55 + pow(b2, 4.0) * 0.35 + 0.12) * uAur * keep;
        }`);
  };
  mat.customProgramCacheKey = () => 'aurora-shimmer';
  mat.needsUpdate = true;
}

export class Avatar {
  constructor() {
    this.root = new THREE.Group();
    this.root.name = 'avatar';
    this.mats = { skin: std(DEFAULT.skin), torso: std(DEFAULT.torso), arms: std(DEFAULT.skin), legs: std(DEFAULT.legs) };
    const faceMat = new THREE.MeshStandardMaterial({ map: faceTexture(), color: DEFAULT.skin, roughness: 0.6 }); // per-avatar face canvas, texture & material
    this.faceMat = faceMat;
    // talking state (driven by animate(); no timers)
    // aurora shimmer skin (shared uniforms across skin materials of this avatar)
    this._aurU = { uAur: { value: 0 }, uAurTime: { value: 0 }, uAurColor: { value: new THREE.Color('#8fe8ff') } };
    for (const m of [this.mats.skin, this.mats.arms, faceMat]) addAuroraShimmer(m, this._aurU);
    this._shimmerId = null;
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
    this._lastColors = { skin, shirt, pants };
    this.mats.skin.color.set(skin || DEFAULT.skin);
    this.faceMat.color.set(skin || DEFAULT.skin);
    this.mats.torso.color.set(shirt || DEFAULT.torso);
    this.mats.arms.color.set(shirt || skin || DEFAULT.skin);
    this.mats.legs.color.set(pants || DEFAULT.legs);
  }

  /** Apply equipped cosmetics from a profile. */
  /** Free this avatar's GPU resources (face canvas texture, materials, geometries). */
  dispose() {
    this._stopWind?.();
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

  // ---------- Frost Tornado Hat: proximity + wind audio ----------
  /** Engine/multiplayer hook: distance (world units) to the nearest other player. Infinity/null = nobody near. */
  setNearbyDistance(d) {
    this._nearDist = Number.isFinite(d) ? Math.max(0, d) : Infinity;
    this._proxKnown = true;
    return this;
  }
  /** Same, from a list of other players' world positions ({x,y,z} or THREE.Vector3). */
  updateProximity(positions = []) {
    const me = this.root.getWorldPosition(new THREE.Vector3());
    let best = Infinity;
    for (const q of positions || []) { if (!q) continue; const dx = q.x - me.x, dy = (q.y || 0) - me.y, dz = q.z - me.z; best = Math.min(best, Math.hypot(dx, dy, dz)); }
    return this.setNearbyDistance(best);
  }
  /** 0 (≥12 units away) … 1 (≤2 units). */
  proximityFactor() {
    const d = this._nearDist ?? Infinity;
    return Math.min(1, Math.max(0, (12 - d) / 10));
  }
  /**
   * Give the avatar the scene's THREE.AudioListener (the engine adds it to the camera).
   * While a Frost Tornado Hat is worn and another player is within WIND_START_DIST (20u), the wind
   * loop plays from a PannerNode on the wearer (HRTF, inverse, ref 3.5, rolloff 1.3, max 28);
   * it stops beyond WIND_STOP_DIST (30u). Safe no-op without a listener, WebAudio, or decodable audio.
   */
  attachWindAudio(listener) {
    this._audioListener = listener && listener.context && typeof listener.getInput === 'function' ? listener : null;
    const ctx = this._audioListener?.context;
    if (ctx && !this._resumeHooked && typeof addEventListener === 'function') {
      // browsers keep the AudioContext suspended until a user gesture
      this._resumeHooked = true;
      const resume = () => { if (ctx.state === 'suspended') ctx.resume().catch(() => {}); };
      addEventListener('pointerdown', resume, { passive: true }); addEventListener('keydown', resume);
    }
    if (!this._audioListener) this._stopWind();
    return this;
  }
  _tornadoObj() { return Object.values(this.attached).find(o => o.userData.isTornado) || null; }
  _syncWind() { if (!this._tornadoObj()) this._stopWind(); }
  _startWind() {
    const listener = this._audioListener, ctx = listener?.context;
    if (!ctx || this._wind) return;
    const w = this._wind = { ctx, starting: true };
    loadWindBuffers(ctx).then(({ main, high }) => {
      if (this._wind !== w || !main) { if (this._wind === w) this._wind = null; return; }
      try {
        const panner = ctx.createPanner();
        Object.assign(panner, { panningModel: 'HRTF', distanceModel: 'inverse', refDistance: 3.5, rolloffFactor: 1.3, maxDistance: 28 });
        panner.connect(listener.getInput());
        const layer = (buf, gain) => { const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true; const g = ctx.createGain(); g.gain.value = gain; src.connect(g).connect(panner); return { src, g }; };
        w.main = layer(main, 1.0);
        if (high) w.high = layer(high, 0);
        const when = ctx.currentTime + 0.05;          // same start time keeps the layers in sync
        w.main.src.start(when); w.high?.src.start(when);
        w.panner = panner; w.starting = false;
      } catch { this._stopWind(); }
    });
  }
  _stopWind() {
    const w = this._wind; this._wind = null;
    if (!w) return;
    try { w.main?.src.stop(); w.high?.src.stop(); } catch {}
    try { w.panner?.disconnect(); } catch {}
  }
  _updateWind(dt) {
    const hat = this._tornadoObj();
    const p = this._proxKnown ? this.proximityFactor() : 0;
    if (hat) hat.userData.proximity = p;
    const d = this._nearDist ?? Infinity;
    if (!hat || !this._audioListener) { this._stopWind(); return; }
    if (!this._wind && d < WIND_START_DIST) this._startWind();
    else if (this._wind && d > WIND_STOP_DIST) { this._stopWind(); return; }
    const w = this._wind;
    if (!w || !w.panner) return;
    const pos = hat.getWorldPosition(new THREE.Vector3());
    const t = w.ctx.currentTime;
    try {
      if (w.panner.positionX) { w.panner.positionX.setTargetAtTime(pos.x, t, 0.05); w.panner.positionY.setTargetAtTime(pos.y + 1, t, 0.05); w.panner.positionZ.setTargetAtTime(pos.z, t, 0.05); }
      else w.panner.setPosition(pos.x, pos.y + 1, pos.z);
      if (w.high) w.high.g.gain.setTargetAtTime(Math.min(1, Math.max(0, (6 - d) / 4)), t, 0.15);
    } catch {}
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
    this._shimmerId = null; this._aurU.uAur.value = 0;
    for (const [slot, id] of Object.entries(profile.equipped || {})) {
      const item = COSMETIC_BY_ID[id];
      if (!item) continue;
      if (item.kind === 'skin') {
        skin = (item.customizable && this.cosmeticColors[id]) || item.color;
        if (item.shimmer) { this._shimmerId = id; this._aurU.uAur.value = 1; this._aurU.uAurColor.value.set(skin); }
      }
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
    this._syncWind?.();
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
    if (this._shimmerId === id) { this._aurU.uAurColor.value.set(color); this.setColors({ ...this._lastColors, skin: color }); }
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
    this._updateWind(dt);
    if (this._shimmerId) this._aurU.uAurTime.value += dt;
    for (const o of Object.values(this.attached)) o.userData.tick?.(dt);
    this._updateTalk(dt);
  }
}

// ---------- Winterhaven shop wave 2 + Plus perk showpieces ----------
function candyStripeTexture(color) {
  const c = document.createElement('canvas'); c.width = 64; c.height = 16; const x = c.getContext('2d');
  x.fillStyle = '#fbf7f2'; x.fillRect(0, 0, 64, 16); x.fillStyle = new THREE.Color(color).getStyle();
  for (let i = -16; i < 80; i += 16) { x.beginPath(); x.moveTo(i, 16); x.lineTo(i + 8, 16); x.lineTo(i + 16, 0); x.lineTo(i + 8, 0); x.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}
function swirlTexture(color) {
  const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
  x.fillStyle = '#fbf7f2'; x.beginPath(); x.arc(32, 32, 32, 0, Math.PI * 2); x.fill(); x.fillStyle = new THREE.Color(color).getStyle();
  for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; x.beginPath(); x.moveTo(32, 32); x.arc(32, 32, 32, a, a + Math.PI / 6); x.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

function buildPeppermintShades(color) {
  const g = new THREE.Group();
  let stripe = candyStripeTexture(color); stripe.repeat.set(4, 1);
  const frame = std('#ffffff', { map: stripe, roughness: 0.3 });
  let sw = swirlTexture(color);
  const lens = new THREE.MeshPhysicalMaterial({ map: sw, roughness: 0.15, clearcoat: 1, transparent: true, opacity: 0.92 });
  const candy = new THREE.MeshPhysicalMaterial({ color, roughness: 0.2, clearcoat: 1 });
  const lenses = [];
  for (const sx of [-1, 1]) {
    const rim = mesh(new THREE.TorusGeometry(0.1, 0.022, 10, 28), frame, sx * 0.14, 0.33, 0.33); g.add(rim);
    const l = mesh(new THREE.CircleGeometry(0.095, 28), lens, sx * 0.14, 0.33, 0.335); g.add(l); lenses.push(l);
    g.add(rotated(mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.03, 14), candy, sx * 0.255, 0.35, 0.32), 'z', Math.PI / 2)); // peppermint hinge
    g.add(mesh(new THREE.BoxGeometry(0.02, 0.025, 0.32), frame, sx * 0.27, 0.35, 0.16)); // arm
  }
  g.add(rotated(mesh(new THREE.TorusGeometry(0.04, 0.016, 8, 12, Math.PI), frame, 0, 0.34, 0.33), 'z', 0)); // bridge
  g.userData.tick = () => { const t = performance.now() / 1000; lenses.forEach((l, i) => { l.rotation.z = t * (i ? -0.6 : 0.6); }); };
  g.userData.setColor = (c) => { candy.color.set(c);
    const ns = candyStripeTexture(c); ns.repeat.copy(stripe.repeat); frame.map.dispose(); frame.map = ns; frame.needsUpdate = true; stripe = ns;
    const nw = swirlTexture(c); lens.map.dispose(); lens.map = nw; lens.needsUpdate = true; sw = nw; };
  return { bone: 'head', object: g };
}

function buildSnowflakeHalo(color) {
  const g = new THREE.Group();
  const glow = new THREE.MeshPhysicalMaterial({ color, emissive: color, emissiveIntensity: 0.6, roughness: 0.1, clearcoat: 1, transparent: true, opacity: 0.85 });
  const ring = new THREE.Group(); ring.position.set(0, 1.0, 0); g.add(ring);
  ring.add(rotated(mesh(new THREE.TorusGeometry(0.36, 0.012, 8, 48), glow), 'x', Math.PI / 2));
  const flakes = [];
  for (let i = 0; i < 6; i++) {
    const a = i / 6 * Math.PI * 2, f = snowflakeCharm(0.07);
    f.position.set(Math.cos(a) * 0.36, 0, Math.sin(a) * 0.36); f.rotation.y = -a + Math.PI / 2; ring.add(f); flakes.push(f);
    f.traverse(o => { if (o.isMesh) o.material = glow; });
  }
  g.userData.tick = () => { const t = performance.now() / 1000; ring.rotation.y = t * 0.5; ring.position.y = 1.0 + Math.sin(t * 1.4) * 0.025;
    flakes.forEach((f, i) => { f.rotation.z = t * 1.2 + i; const s = 1 + Math.sin(t * 3 + i * 1.7) * 0.12; f.scale.setScalar(s); });
    glow.emissiveIntensity = 0.5 + Math.sin(t * 2.2) * 0.15; };
  g.userData.setColor = (c) => { glow.color.set(c); glow.emissive.set(c); };
  return { bone: 'head', object: g };
}

function buildHollyGarland(color) {
  const g = new THREE.Group();
  const leafA = std('#2c7a3f', { roughness: 0.5, flatShading: true });
  const leafB = std('#1f5a2f', { roughness: 0.5, flatShading: true });
  const berry = new THREE.MeshPhysicalMaterial({ color, roughness: 0.2, clearcoat: 1 });
  const gold = std('#e6c25a', { metalness: 0.7, roughness: 0.3 });
  const rope = mesh(new THREE.TorusGeometry(0.34, 0.035, 8, 40), leafB, 0, 0.5, 0); rope.rotation.x = Math.PI / 2; rope.scale.set(1.4, 1.75, 1); g.add(rope);
  const N = 22;
  for (let i = 0; i < N; i++) {
    const a = i / N * Math.PI * 2, x = Math.cos(a) * 0.48, z = Math.sin(a) * 0.6;
    for (const s of [-1, 1]) {
      const leaf = mesh(new THREE.ConeGeometry(0.045, 0.16, 4), (i + (s > 0)) % 2 ? leafA : leafB, x, 0.52, z);
      leaf.scale.set(1, 1, 0.3); leaf.rotation.set(Math.PI / 2, 0, a + s * 0.9); leaf.rotation.x += 0.3; g.add(leaf);
    }
    if (i % 2 === 0) for (let b = 0; b < 3; b++) g.add(mesh(new THREE.SphereGeometry(0.028, 10, 8), berry, x + (b - 1) * 0.025, 0.56 + (b === 1) * 0.02, z));
  }
  const bell = new THREE.Group(); bell.position.set(0, 0.47, 0.62); g.add(bell);
  bell.add(mesh(new THREE.SphereGeometry(0.05, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.6), gold, 0, -0.04, 0));
  bell.add(rotated(mesh(new THREE.TorusGeometry(0.052, 0.008, 6, 16), gold, 0, -0.07, 0), 'x', Math.PI / 2));
  bell.add(mesh(new THREE.SphereGeometry(0.015, 8, 6), gold, 0, -0.1, 0));
  g.userData.tick = () => { const t = performance.now() / 1000; bell.rotation.x = Math.sin(t * 3.1) * 0.25; bell.rotation.z = Math.sin(t * 2.3) * 0.15; };
  g.userData.setColor = (c) => berry.color.set(c);
  return { bone: 'torso', object: g };
}

function buildGiftBow(color) {
  const g = new THREE.Group();
  const satin = new THREE.MeshPhysicalMaterial({ color, roughness: 0.35, sheen: 1, sheenColor: '#ffffff', clearcoat: 0.4 });
  const inner = std(_tint(color, '#000000', 0.3), { roughness: 0.5 });
  const bow = new THREE.Group(); bow.position.set(0, 0.25, -0.36); g.add(bow);
  // loops: flattened tori angled out
  for (const sx of [-1, 1]) {
    const loop = mesh(new THREE.TorusGeometry(0.17, 0.06, 10, 28), satin, sx * 0.19, 0.04, 0);
    loop.scale.set(1.2, 0.8, 0.45); loop.rotation.z = sx * 0.35; bow.add(loop);
    const shade = mesh(new THREE.SphereGeometry(0.1, 12, 8), inner, sx * 0.19, 0.04, 0.01); shade.scale.set(1.3, 0.7, 0.15); bow.add(shade);
  }
  bow.add(mesh(new RoundedBoxGeometry(0.13, 0.13, 0.11, 3, 0.04), satin, 0, 0.03, -0.02)); // knot
  // curling tails
  const tails = [];
  for (const sx of [-1, 1]) {
    const tl = new THREE.Group(); tl.position.set(sx * 0.04, -0.02, -0.02); bow.add(tl); tails.push(tl);
    for (let i = 0; i < 9; i++) { const seg = mesh(new THREE.BoxGeometry(0.09, 0.06, 0.015), satin, sx * (0.03 * i + Math.sin(i * 0.8) * 0.03), -0.05 * i, -Math.sin(i * 0.9) * 0.02);
      seg.rotation.z = sx * (0.35 + i * 0.05); seg.rotation.y = Math.sin(i * 0.9) * 0.6; tl.add(seg); }
    tl.add(rotated(mesh(new THREE.ConeGeometry(0.045, 0.06, 3), satin, sx * 0.3, -0.47, 0), 'z', Math.PI));
  }
  // ribbon straps over the shoulders
  for (const sx of [-1, 1]) g.add(mesh(new THREE.BoxGeometry(0.07, 0.025, 0.62), satin, sx * 0.22, 0.52, 0));
  g.userData.tick = () => { const t = performance.now() / 1000; bow.rotation.z = Math.sin(t * 1.4) * 0.03; tails.forEach((tl, i) => { tl.rotation.x = Math.sin(t * 2 + i) * 0.12; tl.rotation.z = Math.sin(t * 1.6 + i * 2) * 0.06; }); };
  g.userData.setColor = (c) => { satin.color.set(c); inner.color.copy(_tint(c, '#000000', 0.3)); };
  return { bone: 'torso', object: g };
}

function buildPlusFrostWings(color) {
  const g = new THREE.Group();
  const crystal = new THREE.MeshPhysicalMaterial({ color, emissive: color, emissiveIntensity: 0.45, roughness: 0.05, clearcoat: 1, transmission: 0.25, transparent: true, opacity: 0.85, flatShading: true, side: THREE.DoubleSide });
  const edge = new THREE.MeshPhysicalMaterial({ color: _tint(color, '#ffffff', 0.6), emissive: color, emissiveIntensity: 0.9, roughness: 0.1, flatShading: true });
  const silver = std('#e9f1f7', { metalness: 0.7, roughness: 0.2 });
  const root = new THREE.Group(); root.position.set(0, 0.3, -0.34); g.add(root);
  root.add(mesh(new THREE.OctahedronGeometry(0.09, 0), edge)); // heart gem
  root.add(mesh(new THREE.TorusGeometry(0.11, 0.015, 6, 20), silver));
  const wings = [];
  const feather = (len, w) => { const s = new THREE.Shape(); s.moveTo(0, 0); s.quadraticCurveTo(w, len * 0.4, w * 0.3, len); s.lineTo(0, len * 0.92); s.lineTo(-w * 0.3, len * 0.7); s.quadraticCurveTo(-w * 0.4, len * 0.3, 0, 0);
    return new THREE.ExtrudeGeometry(s, { depth: 0.015, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.008, bevelSegments: 1 }); };
  for (const sx of [-1, 1]) {
    const wing = new THREE.Group(); wing.position.set(sx * 0.06, 0, 0); root.add(wing); wings.push({ wing, sx });
    const tiers = [[7, 0.85, 0.16, 0.05], [6, 0.6, 0.13, 0.0], [5, 0.4, 0.11, -0.05]];
    tiers.forEach(([n, L, W, dz], ti) => {
      for (let i = 0; i < n; i++) {
        const a = (i / (n - 1)) * 1.5 - 0.15, f = mesh(feather(L * (1 - i * 0.04), W), ti === 0 && i === 0 ? edge : crystal, 0, 0, dz - ti * 0.02);
        f.rotation.z = -sx * (Math.PI / 2 - a) ; f.rotation.y = sx * 0.15; wing.add(f);
      }
    });
    for (let i = 0; i < 3; i++) wing.add(rotated(mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.5 - i * 0.1, 6), silver, sx * (0.24 - i * 0.02), 0.12 + i * 0.08, 0.02), 'z', sx * (1.0 + i * 0.25)));
  }
  // sparkle points
  const N = 40, pg = new THREE.BufferGeometry(), pos = new Float32Array(N * 3), life = new Float32Array(N);
  pg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const sparkM = new THREE.PointsMaterial({ map: softDotTexture(), size: 0.07, transparent: true, opacity: 0.8, depthWrite: false, color });
  const sparks = new THREE.Points(pg, sparkM); root.add(sparks);
  for (let i = 0; i < N; i++) life[i] = Math.random();
  g.userData.tick = (dt) => { const t = performance.now() / 1000;
    wings.forEach(({ wing, sx }) => { wing.rotation.y = sx * (0.35 + Math.sin(t * 1.8) * 0.22); wing.rotation.z = Math.sin(t * 1.8) * 0.05 * sx; });
    crystal.emissiveIntensity = 0.4 + Math.sin(t * 2.4) * 0.12;
    for (let i = 0; i < N; i++) { life[i] += dt * 0.35; if (life[i] > 1) life[i] -= 1; const l = life[i], s = i % 2 ? 1 : -1;
      pos[i * 3] = s * (0.15 + ((i * 37) % 70) / 100); pos[i * 3 + 1] = 0.6 - ((i * 53) % 90) / 100 - l * 0.4; pos[i * 3 + 2] = -0.05 - l * 0.1; }
    pg.attributes.position.needsUpdate = true; sparkM.opacity = 0.8; };
  g.userData.tick(0);
  g.userData.setColor = (c) => { crystal.color.set(c); crystal.emissive.set(c); edge.color.copy(_tint(c, '#ffffff', 0.6)); edge.emissive.set(c); sparkM.color.set(c); };
  return { bone: 'torso', object: g };
}

function buildPlusAuroraCrown(color) {
  const g = new THREE.Group();
  const silver = std('#eef4fa', { metalness: 0.85, roughness: 0.18 });
  const gemM = new THREE.MeshPhysicalMaterial({ color, emissive: color, emissiveIntensity: 1.0, roughness: 0.05, clearcoat: 1, flatShading: true });
  let tex = auroraStripeTexture(color); tex.repeat.set(1, 1);
  const ribbonM = new THREE.MeshStandardMaterial({ map: tex, emissive: '#ffffff', emissiveMap: tex, emissiveIntensity: 0.6, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false });
  g.add(mesh(new THREE.CylinderGeometry(0.47, 0.47, 0.1, 4, 1, false, Math.PI / 4), silver, 0, 0.64, 0));
  for (const y of [0.59, 0.69]) g.add(mesh(new THREE.CylinderGeometry(0.49, 0.49, 0.018, 4, 1, false, Math.PI / 4), silver, 0, y, 0));
  // points with small gems on each face and corner
  for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2 + Math.PI / 4, r = i % 2 ? 0.33 : 0.46, h = i % 2 ? 0.2 : 0.14;
    const x = Math.sin(a) * r, z = Math.cos(a) * r;
    g.add(mesh(new THREE.ConeGeometry(0.06, h, 4), silver, x, 0.69 + h / 2, z));
    g.add(mesh(new THREE.OctahedronGeometry(0.035, 0), gemM, x, 0.69 + h + 0.03, z)); }
  for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2; g.add(mesh(new THREE.OctahedronGeometry(0.04, 0), gemM, Math.sin(a) * 0.475, 0.64, Math.cos(a) * 0.475)); }
  // aurora ribbons: wavy open cylinders rising from the crown
  const ribbons = [];
  for (let k = 0; k < 2; k++) { const geo = new THREE.CylinderGeometry(0.36 - k * 0.08, 0.42 - k * 0.08, 0.3, 40, 6, true);
    const r = mesh(geo, ribbonM, 0, 0.88 + k * 0.06, 0); r.userData.base = geo.attributes.position.array.slice(); g.add(r); ribbons.push(r); }
  const star = new THREE.Group(); star.position.set(0, 1.18, 0); g.add(star);
  star.add(mesh(new THREE.OctahedronGeometry(0.08, 0), gemM)); star.add(rotated(mesh(new THREE.OctahedronGeometry(0.06, 0), gemM), 'y', Math.PI / 4));
  g.userData.tick = (dt) => { const t = performance.now() / 1000;
    tex.offset.x = (tex.offset.x + dt * 0.08) % 1;
    ribbons.forEach((r, k) => { const p = r.geometry.attributes.position, b = r.userData.base;
      for (let i = 0; i < p.count; i++) { const x = b[i * 3], y = b[i * 3 + 1], z = b[i * 3 + 2], a = Math.atan2(z, x);
        p.array[i * 3 + 1] = y + Math.sin(a * 3 + t * 1.5 + k) * 0.05 * (y + 0.15) * 4; }
      p.needsUpdate = true; r.rotation.y = t * (k ? -0.2 : 0.15); });
    star.rotation.y = t * 1.2; star.position.y = 1.18 + Math.sin(t * 1.7) * 0.03; gemM.emissiveIntensity = 0.9 + Math.sin(t * 2.6) * 0.25; };
  g.userData.setColor = (c) => { gemM.color.set(c); gemM.emissive.set(c); const nt = auroraStripeTexture(c); nt.repeat.copy(tex.repeat); ribbonM.map.dispose(); ribbonM.map = nt; ribbonM.emissiveMap = nt; ribbonM.needsUpdate = true; tex = nt; };
  return { bone: 'head', object: g };
}

function buildPlusCrystalScepter(color) {
  const g = new THREE.Group(); g.position.set(0, -0.92, 0.27);
  const silver = std('#eef4fa', { metalness: 0.85, roughness: 0.18 });
  const wrap = std(_tint(color, '#1a2030', 0.55), { roughness: 0.7 });
  const ice = new THREE.MeshPhysicalMaterial({ color, emissive: color, emissiveIntensity: 0.7, roughness: 0.05, clearcoat: 1, transparent: true, opacity: 0.9, flatShading: true });
  g.add(mesh(new THREE.CylinderGeometry(0.028, 0.034, 1.1, 12), silver, 0, 0.1, 0));
  for (let i = 0; i < 6; i++) g.add(rotated(mesh(new THREE.TorusGeometry(0.036, 0.01, 6, 14), wrap, 0, -0.08 + i * 0.045, 0), 'x', Math.PI / 2 + 0.25));
  g.add(mesh(new THREE.SphereGeometry(0.045, 12, 8), silver, 0, -0.46, 0));
  // claw holding the crystal
  const head = new THREE.Group(); head.position.set(0, 0.7, 0); g.add(head);
  head.add(mesh(new THREE.CylinderGeometry(0.07, 0.035, 0.07, 12), silver, 0, -0.06, 0));
  for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2, c = mesh(new THREE.ConeGeometry(0.018, 0.18, 5), silver, Math.sin(a) * 0.07, 0.05, Math.cos(a) * 0.07); c.rotation.set(Math.cos(a) * 0.35, 0, -Math.sin(a) * 0.35); head.add(c); }
  const gem = new THREE.Group(); gem.position.y = 0.12; head.add(gem);
  const core = mesh(new THREE.OctahedronGeometry(0.11, 0), ice); core.scale.set(0.8, 1.6, 0.8); gem.add(core);
  for (let i = 0; i < 3; i++) { const s = mesh(new THREE.OctahedronGeometry(0.045, 0), ice, Math.sin(i * 2.1) * 0.08, -0.04, Math.cos(i * 2.1) * 0.08); s.scale.set(0.7, 1.6, 0.7); s.rotation.z = Math.sin(i * 2.1) * 0.5; gem.add(s); }
  const motes = [];
  for (let i = 0; i < 5; i++) { const m = mesh(new THREE.SphereGeometry(0.015, 8, 6), ice); head.add(m); motes.push(m); }
  g.userData.tick = () => { const t = performance.now() / 1000; gem.rotation.y = t * 0.9; gem.position.y = 0.12 + Math.sin(t * 2) * 0.015;
    motes.forEach((m, i) => { const a = t * 1.4 + i / 5 * Math.PI * 2; m.position.set(Math.cos(a) * 0.17, 0.12 + Math.sin(a * 2 + i) * 0.06, Math.sin(a) * 0.17); });
    ice.emissiveIntensity = 0.6 + Math.sin(t * 2.8) * 0.2; };
  g.userData.setColor = (c) => { ice.color.set(c); ice.emissive.set(c); wrap.color.copy(_tint(c, '#1a2030', 0.55)); };
  return { bone: 'armR', object: g };
}
