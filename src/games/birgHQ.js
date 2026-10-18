// Game: BIRG HQ — a cozy two-story log cabin with a crackling fireplace.
import * as THREE from 'three';
import { Reflector } from 'three/examples/jsm/objects/Reflector.js';
import { Collision } from '../engine/collision.js';

// ---------- procedural textures ----------
function canvasTex(w, h, draw, repeat = [1, 1]) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat);
  return t;
}
const logTex = () => canvasTex(256, 256, (g, w, h) => {
  for (let i = 0; i < 8; i++) {
    const y = i * 32, grad = g.createLinearGradient(0, y, 0, y + 32);
    grad.addColorStop(0, '#5a3a22'); grad.addColorStop(0.15, '#9a6a40'); grad.addColorStop(0.5, '#b07a4a'); grad.addColorStop(0.85, '#8a5a34'); grad.addColorStop(1, '#4a2e1a');
    g.fillStyle = grad; g.fillRect(0, y, w, 32);
    g.strokeStyle = 'rgba(60,35,15,0.25)';
    for (let k = 0; k < 6; k++) { g.beginPath(); const yy = y + 6 + Math.random() * 20; g.moveTo(0, yy); g.bezierCurveTo(80, yy + 3, 160, yy - 3, 256, yy); g.stroke(); }
  }
}, [3, 2]);
const plankTex = () => canvasTex(256, 256, (g, w, h) => {
  for (let i = 0; i < 8; i++) {
    const v = 110 + Math.random() * 30;
    g.fillStyle = `rgb(${v + 40},${v},${v - 40})`; g.fillRect(0, i * 32, w, 32);
    g.fillStyle = 'rgba(40,20,5,0.5)'; g.fillRect(0, i * 32, w, 2);
    g.fillRect(Math.random() * w, i * 32, 2, 32);
  }
}, [4, 4]);
const stoneTex = () => canvasTex(256, 256, (g, w, h) => {
  g.fillStyle = '#4a4440'; g.fillRect(0, 0, w, h);
  for (let y = 0; y < h; y += 32) for (let x = (y / 32) % 2 ? -24 : 0; x < w; x += 48) {
    const v = 110 + Math.random() * 50; g.fillStyle = `rgb(${v},${v - 8},${v - 16})`;
    g.beginPath(); g.roundRect(x + 2, y + 2, 44, 28, 8); g.fill();
  }
}, [1, 2]);
const rugTex = () => canvasTex(256, 256, (g, w, h) => {
  g.fillStyle = '#8e2a2a'; g.fillRect(0, 0, w, h);
  for (let r = 120; r > 0; r -= 18) { g.strokeStyle = r % 36 ? '#e8c27a' : '#2f4f6f'; g.lineWidth = 6; g.beginPath(); g.arc(128, 128, r, 0, Math.PI * 2); g.stroke(); }
});
const tileTex = () => canvasTex(128, 128, (g) => {
  for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) { g.fillStyle = (x + y) % 2 ? '#dfe9f0' : '#9fc3d8'; g.fillRect(x * 32, y * 32, 32, 32); }
}, [6, 6]);
const signTex = () => canvasTex(512, 128, (g, w, h) => {
  g.fillStyle = '#6b4226'; g.fillRect(0, 0, w, h);
  g.strokeStyle = '#3e2412'; g.lineWidth = 10; g.strokeRect(5, 5, w - 10, h - 10);
  g.fillStyle = '#ffe6b0'; g.font = 'bold 72px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('BIRG HQ', w / 2, h / 2 + 4);
});

export default {
  id: 'birg-hq',
  name: 'BIRG HQ',
  tagline: 'A cozy two-story log cabin',
  description: 'Warm up by the crackling fire, explore the bedroom and bathroom upstairs. Snow falls outside.',
  thumbnail: 'cabin',
  music: 'cozy',
  features: { build: false },

  async create() {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#1d2c47');
    scene.fog = new THREE.Fog('#2a3b5a', 30, 140);
    const collision = new Collision({ floorY: 0, bounds: { type: 'box', minX: -7.55, maxX: 7.55, minZ: -5.55, maxZ: 5.55 } });
    const occluders = [];

    const M = {
      log: new THREE.MeshStandardMaterial({ map: logTex(), roughness: 0.85 }),
      plank: new THREE.MeshStandardMaterial({ map: plankTex(), roughness: 0.8 }),
      stone: new THREE.MeshStandardMaterial({ map: stoneTex(), roughness: 0.95 }),
      dark: new THREE.MeshStandardMaterial({ color: '#141010', roughness: 1 }),
      wood: new THREE.MeshStandardMaterial({ color: '#7a4e2c', roughness: 0.7 }),
      darkwood: new THREE.MeshStandardMaterial({ color: '#4a2e1a', roughness: 0.7 }),
      white: new THREE.MeshStandardMaterial({ color: '#f4f4f0', roughness: 0.3 }),
      porcelain: new THREE.MeshStandardMaterial({ color: '#fbfbfb', roughness: 0.15, metalness: 0.05 }),
      chrome: new THREE.MeshStandardMaterial({ color: '#d0d6dc', roughness: 0.15, metalness: 1 }),
      couch: new THREE.MeshStandardMaterial({ color: '#3d6b5a', roughness: 0.95 }),
      cushion: new THREE.MeshStandardMaterial({ color: '#e0b25a', roughness: 0.95 }),
      blanket: new THREE.MeshStandardMaterial({ color: '#3f6fb0', roughness: 0.95 }),
      glass: new THREE.MeshStandardMaterial({ color: '#bfe3ff', transparent: true, opacity: 0.18, roughness: 0.05, metalness: 0.2, depthWrite: false }),
      snow: new THREE.MeshStandardMaterial({ color: '#e8f0ff', roughness: 1 }),
      roof: new THREE.MeshStandardMaterial({ color: '#3a2a22', roughness: 0.9 }),
      tile: new THREE.MeshStandardMaterial({ map: tileTex(), roughness: 0.3 }),
      water: new THREE.MeshStandardMaterial({ color: '#7fc8ee', roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.85 }),
    };

    /** box helper: (w,h,d) size, (x,y0,z) = center x/z and bottom y */
    const box = (w, h, d, mat, x, y0, z, { collide = true, occlude = false, cast = true, parent = scene } = {}) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      m.position.set(x, y0 + h / 2, z); m.castShadow = cast; m.receiveShadow = true;
      parent.add(m);
      if (collide) collision.addBox(x - w / 2, y0, z - d / 2, x + w / 2, y0 + h, z + d / 2);
      if (occlude) occluders.push(m);
      return m;
    };
    const cyl = (rt, rb, h, mat, x, y0, z, seg = 16) => {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat);
      m.position.set(x, y0 + h / 2, z); m.castShadow = true; m.receiveShadow = true; scene.add(m); return m;
    };

    /** Wall along an axis with rectangular openings (windows get glass). */
    const T = 0.4;
    function wall(axis, fixed, from, to, y0, y1, openings = [], mat = M.log) {
      const seg = (a, b, ya, yb) => {
        if (b - a < 0.01 || yb - ya < 0.01) return;
        const len = b - a, mid = (a + b) / 2;
        if (axis === 'x') box(len, yb - ya, T, mat, mid, ya, fixed, { occlude: true });
        else box(T, yb - ya, len, mat, fixed, ya, mid, { occlude: true });
      };
      let cur = from;
      for (const o of [...openings].sort((p, q) => p.a - q.a)) {
        seg(cur, o.a, y0, y1); seg(o.a, o.b, y0, o.y0); seg(o.a, o.b, o.y1, y1); cur = o.b;
        if (o.glass !== false) {
          const len = o.b - o.a, mid = (o.a + o.b) / 2, h = o.y1 - o.y0;
          const g = axis === 'x' ? box(len, h, 0.05, M.glass, mid, o.y0, fixed, { cast: false }) : box(0.05, h, len, M.glass, fixed, o.y0, mid, { cast: false });
          g.castShadow = false;
          // window frame cross
          if (axis === 'x') { box(0.08, h, 0.1, M.darkwood, mid, o.y0, fixed, { collide: false }); box(len, 0.08, 0.1, M.darkwood, mid, o.y0 + h / 2, fixed, { collide: false }); box(len + 0.2, 0.1, 0.6, M.darkwood, mid, o.y0 - 0.1, fixed, { collide: false }); }
          else { box(0.1, h, 0.08, M.darkwood, fixed, o.y0, mid, { collide: false }); box(0.1, 0.08, len, M.darkwood, fixed, o.y0 + h / 2, mid, { collide: false }); box(0.6, 0.1, len + 0.2, M.darkwood, fixed, o.y0 - 0.1, mid, { collide: false }); }
        }
      }
      seg(cur, to, y0, y1);
    }

    const F1 = 4.3, F2 = 8.3; // floor heights
    // ---------- floors & ceilings ----------
    box(16, 0.2, 12, M.plank, 0, -0.2, 0, { collide: false });
    box(9.5, 0.3, 11.2, M.plank, -2.85, 4.0, 0, { occlude: true });          // upstairs slab A (x -7.6..1.9)
    box(5.7, 0.3, 9.4, M.plank, 4.75, 4.0, 0.9, { occlude: true });         // slab B (x 1.9..7.6, z -3.8..5.6)
    box(15.2, 0.2, 11.2, M.plank, 0, F2, 0, { occlude: true });             // ceiling
    const bathFloor = new THREE.Mesh(new THREE.PlaneGeometry(7.6, 4.6), M.tile);
    bathFloor.rotation.x = -Math.PI / 2; bathFloor.position.set(3.8, F1 + 0.005, 3.3); bathFloor.receiveShadow = true; scene.add(bathFloor);

    // ---------- exterior walls ----------
    const win = (a, b, y0, y1) => ({ a, b, y0, y1 });
    // front (z=+5.8)
    wall('x', 5.8, -8, 8, 0, F1, [win(-5, -2.5, 1.2, 3.0), { a: -0.8, b: 0.8, y0: 0, y1: 2.9, glass: false }, win(2.5, 5, 1.2, 3.0)]);
    wall('x', 5.8, -8, 8, F1, F2, [win(-5, -3, 5.5, 7.3), win(4.2, 5.6, 6.0, 7.3)]);
    // back (z=-5.8)
    wall('x', -5.8, -8, 8, 0, F1, [win(-5, -2.5, 1.2, 3.0)]);
    wall('x', -5.8, -8, 8, F1, F2, [win(-5.5, -3, 5.5, 7.3)]);
    // left (x=-7.8) / right (x=+7.8)
    wall('z', -7.8, -5.6, 5.6, 0, F1, [win(2.8, 4.6, 1.2, 3.0)]);
    wall('z', -7.8, -5.6, 5.6, F1, F2, [win(-0.8, 1.6, 5.5, 7.3)]);
    wall('z', 7.8, -5.6, 5.6, 0, F1, [win(-1, 2, 1.2, 3.0)]);
    wall('z', 7.8, -5.6, 5.6, F1, F2, [win(-2.6, -0.8, 5.5, 7.3)]);
    // front door
    box(1.6, 2.9, 0.15, M.darkwood, 0, 0, 5.62);
    cyl(0.06, 0.06, 0.05, M.chrome, 0.6, 1.4, 5.5).rotation.x = Math.PI / 2;

    // ---------- upstairs interior walls ----------
    wall('z', 0, -5.6, 5.6, F1, F2, [{ a: -3.2, b: -1.6, y0: F1, y1: F1 + 2.9, glass: false }], M.plank);
    wall('x', 1.0, 0.2, 7.6, F1, F2, [{ a: 3.0, b: 4.6, y0: F1, y1: F1 + 2.9, glass: false }], M.plank);

    // ---------- stairs (11 steps along the back wall, climbing toward -x) ----------
    const N = 11, run = 0.56;
    for (let i = 1; i <= N; i++) {
      const x1 = 7.6 - run * (i - 1), x0 = 7.6 - run * i, top = (F1 * i) / N;
      box(run, top, 1.7, i % 2 ? M.wood : M.darkwood, (x0 + x1) / 2, 0, -4.75, { occlude: false });
    }
    // railing upstairs around the stairwell
    box(5.6, 1.0, 0.12, M.darkwood, 4.8, F1, -3.8);
    for (let x = 2.1; x < 7.6; x += 0.7) box(0.1, 1.0, 0.1, M.darkwood, x, F1, -3.8, { collide: false });

    // ---------- fireplace (left wall, ground floor) ----------
    box(0.6, F1, 3.2, M.stone, -7.3, 0, 0, { occlude: true });               // back
    box(1.2, F1, 0.7, M.stone, -7.0, 0, -1.25, { occlude: true });           // sides
    box(1.2, F1, 0.7, M.stone, -7.0, 0, 1.25, { occlude: true });
    box(1.2, F1 - 1.6, 1.8, M.stone, -7.0, 1.6, 0, { occlude: true });       // above firebox
    box(0.8, 0.15, 1.8, M.dark, -6.8, 0, 0, { collide: false });             // firebox floor
    box(1.0, 0.12, 4.0, M.stone, -5.9, 0, 0, { collide: false });            // hearth
    box(1.5, 0.15, 3.6, M.darkwood, -6.9, 1.6, 0, { collide: false });       // mantel
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.6), new THREE.MeshStandardMaterial({ map: signTex(), roughness: 0.7 }));
    sign.position.set(-6.38, 2.6, 0); sign.rotation.y = Math.PI / 2; scene.add(sign);
    // candles on the mantel
    for (const z of [-1.4, 1.4]) { cyl(0.06, 0.06, 0.25, M.white, -6.5, 1.75, z); const fl = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), new THREE.MeshBasicMaterial({ color: '#ffcf6b' })); fl.position.set(-6.5, 2.04, z); scene.add(fl); }
    // logs + flames
    for (const [z, r] of [[-0.35, 0.3], [0.35, -0.3]]) { const l = cyl(0.12, 0.12, 1.0, M.darkwood, -6.8, 0.1, z, 8); l.rotation.set(Math.PI / 2, 0, r); l.position.y = 0.25; }
    const flameMats = ['#ff5a1f', '#ff8c2a', '#ffc44d'].map(c => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }));
    const flames = [];
    for (let i = 0; i < 7; i++) {
      const f = new THREE.Mesh(new THREE.ConeGeometry(0.16 + Math.random() * 0.1, 0.6 + Math.random() * 0.4, 8), flameMats[i % 3]);
      f.position.set(-6.85 + (Math.random() - 0.5) * 0.3, 0.6, (Math.random() - 0.5) * 0.7);
      f.userData.phase = Math.random() * 10; scene.add(f); flames.push(f);
    }
    const fireLight = new THREE.PointLight('#ff8a3d', 40, 20, 1.6);
    fireLight.position.set(-6.2, 1.0, 0); fireLight.castShadow = true;
    fireLight.shadow.mapSize.set(1024, 1024); fireLight.shadow.bias = -0.002; fireLight.shadow.camera.near = 0.3;
    scene.add(fireLight);
    // embers
    const EM = 140, emPos = new Float32Array(EM * 3), emVel = [];
    const resetEmber = (i) => { emPos[i * 3] = -6.85 + (Math.random() - 0.5) * 0.4; emPos[i * 3 + 1] = 0.4 + Math.random() * 0.3; emPos[i * 3 + 2] = (Math.random() - 0.5) * 0.8; emVel[i] = [(Math.random() * 0.3) + 0.05, 0.6 + Math.random() * 1.0, (Math.random() - 0.5) * 0.3]; };
    for (let i = 0; i < EM; i++) { resetEmber(i); emPos[i * 3 + 1] += Math.random() * 1.2; }
    const emGeo = new THREE.BufferGeometry(); emGeo.setAttribute('position', new THREE.BufferAttribute(emPos, 3));
    const embers = new THREE.Points(emGeo, new THREE.PointsMaterial({ color: '#ffae42', size: 0.06, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    scene.add(embers);

    // ---------- living room ----------
    const rug = new THREE.Mesh(new THREE.CircleGeometry(2.3, 40), new THREE.MeshStandardMaterial({ map: rugTex(), roughness: 1 }));
    rug.rotation.x = -Math.PI / 2; rug.position.set(-4.1, 0.01, 0); rug.receiveShadow = true; scene.add(rug);
    // couch facing the fire
    box(1.1, 0.5, 3.4, M.couch, -2.3, 0, 0);
    box(0.35, 1.2, 3.4, M.couch, -1.6, 0, 0);
    box(1.1, 0.8, 0.3, M.couch, -2.2, 0, -1.85); box(1.1, 0.8, 0.3, M.couch, -2.2, 0, 1.85);
    box(0.9, 0.18, 1.5, M.cushion, -2.4, 0.5, -0.78, { collide: false }); box(0.9, 0.18, 1.5, M.cushion, -2.4, 0.5, 0.78, { collide: false });
    box(0.25, 0.5, 0.5, M.blanket, -1.95, 0.68, 1.1, { collide: false });
    // coffee table + mugs
    box(0.8, 0.08, 1.4, M.wood, -4.0, 0.5, 0); for (const [x, z] of [[-4.3, -0.6], [-3.7, -0.6], [-4.3, 0.6], [-3.7, 0.6]]) box(0.08, 0.5, 0.08, M.darkwood, x, 0, z, { collide: false });
    cyl(0.08, 0.07, 0.16, new THREE.MeshStandardMaterial({ color: '#c0392b' }), -4.0, 0.58, -0.3); cyl(0.08, 0.07, 0.16, new THREE.MeshStandardMaterial({ color: '#2e86c1' }), -3.9, 0.58, 0.3);
    // armchair
    box(1.0, 0.45, 1.0, M.couch, -4.2, 0, 3.6); box(1.0, 1.0, 0.25, M.couch, -4.2, 0, 4.2);
    // bookshelf (back wall)
    box(2.2, 2.6, 0.5, M.darkwood, -5.3, 0, -5.3);
    const bookColors = ['#c0392b', '#2e86c1', '#27ae60', '#f1c40f', '#8e44ad', '#e67e22'];
    for (let s = 0; s < 4; s++) for (let b = 0; b < 9; b++) box(0.18, 0.4 + Math.random() * 0.15, 0.3, new THREE.MeshStandardMaterial({ color: bookColors[(s * 3 + b) % 6] }), -6.2 + b * 0.22, 0.15 + s * 0.62, -5.12, { collide: false });
    // dining table on the right
    box(1.6, 0.08, 1.0, M.wood, 4.5, 0.75, 2.6); for (const [x, z] of [[3.85, 2.2], [5.15, 2.2], [3.85, 3.0], [5.15, 3.0]]) box(0.08, 0.75, 0.08, M.darkwood, x, 0, z, { collide: false });
    collision.addBox(3.7, 0, 2.1, 5.3, 0.83, 3.1);
    for (const x of [3.9, 5.1]) { box(0.45, 0.45, 0.45, M.wood, x, 0, 3.6, { collide: false }); box(0.45, 0.6, 0.06, M.wood, x, 0.45, 3.82, { collide: false }); }
    // cozy pine tree with lights in the corner
    const tree = new THREE.Group(); tree.position.set(6.6, 0, 4.6); scene.add(tree);
    const pine = new THREE.MeshStandardMaterial({ color: '#2d6b4f', flatShading: true });
    for (let k = 0; k < 3; k++) { const c = new THREE.Mesh(new THREE.ConeGeometry(0.9 - k * 0.22, 1.1, 8), pine); c.position.y = 0.8 + k * 0.7; c.castShadow = true; tree.add(c); }
    const bulbs = [];
    for (let i = 0; i < 18; i++) { const a = i * 2.4, y = 0.5 + i * 0.1, r = 0.85 - y * 0.25; const b = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 4), new THREE.MeshBasicMaterial({ color: ['#ff4d4d', '#ffd34d', '#4dd2ff', '#7dff7a'][i % 4] })); b.position.set(Math.cos(a) * r, y, Math.sin(a) * r); tree.add(b); bulbs.push(b); }
    const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.15), new THREE.MeshBasicMaterial({ color: '#ffe066' })); star.position.y = 2.8; tree.add(star);
    collision.addCircle(6.6, 4.6, 0.6);
    // ceiling lamp downstairs
    const lamp1 = new THREE.PointLight('#ffcf8a', 6, 10, 1.8); lamp1.position.set(3.5, 3.6, 1.5); scene.add(lamp1);
    const shade1 = new THREE.Mesh(new THREE.ConeGeometry(0.4, 0.35, 16, 1, true), new THREE.MeshStandardMaterial({ color: '#f2d7a0', emissive: '#ffb347', emissiveIntensity: 0.6, side: THREE.DoubleSide })); shade1.position.set(3.5, 3.75, 1.5); scene.add(shade1);

    // ---------- bedroom (upstairs, x<0) ----------
    box(2.2, 0.45, 3.0, M.wood, -5.6, F1, -4.1);              // bed frame
    box(2.0, 0.25, 2.8, M.white, -5.6, F1 + 0.45, -4.1, { collide: false }); // mattress
    box(2.05, 0.12, 1.9, M.blanket, -5.6, F1 + 0.7, -3.6, { collide: false });
    box(1.4, 0.18, 0.5, M.white, -5.6, F1 + 0.72, -5.15, { collide: false }); // pillow
    box(2.2, 1.2, 0.15, M.darkwood, -5.6, F1, -5.55, { collide: false });     // headboard
    box(0.7, 0.7, 0.6, M.darkwood, -7.1, F1, -2.1);           // nightstand
    cyl(0.12, 0.15, 0.3, M.chrome, -7.1, F1 + 0.7, -2.1);
    const lampShade = cyl(0.15, 0.28, 0.35, new THREE.MeshStandardMaterial({ color: '#ffe0a8', emissive: '#ffb347', emissiveIntensity: 0.9, side: THREE.DoubleSide }), -7.1, F1 + 1.0, -2.1);
    lampShade.castShadow = false;
    const bedLamp = new THREE.PointLight('#ffc77a', 7, 9, 1.8); bedLamp.position.set(-7.0, F1 + 1.2, -2.1); scene.add(bedLamp);
    const rug2 = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.8), new THREE.MeshStandardMaterial({ color: '#c7a6e8', roughness: 1 }));
    rug2.rotation.x = -Math.PI / 2; rug2.position.set(-4, F1 + 0.01, 0.2); scene.add(rug2);
    box(1.8, 1.0, 0.6, M.wood, -2.0, F1, 5.2);                // dresser
    box(0.5, 0.35, 0.05, new THREE.MeshStandardMaterial({ color: '#7fb8e6' }), -2.0, F1 + 1.2, 5.45, { collide: false }); // picture

    // ---------- bathroom (upstairs, x>0, z>1) ----------
    box(1.7, 0.65, 3.1, M.porcelain, 6.7, F1, 4.0);           // tub
    const tubWater = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 2.8), M.water); tubWater.rotation.x = -Math.PI / 2; tubWater.position.set(6.7, F1 + 0.66, 4.0); scene.add(tubWater);
    cyl(0.03, 0.03, 1.9, M.chrome, 7.45, F1 + 0.65, 5.3);     // shower pipe
    const head = cyl(0.15, 0.1, 0.06, M.chrome, 7.25, F1 + 2.5, 5.3); head.rotation.z = 0.5;
    const curtainRod = cyl(0.02, 0.02, 3.2, M.chrome, 5.85, F1 + 2.6, 4.0); curtainRod.rotation.x = Math.PI / 2; curtainRod.position.y = F1 + 2.6;
    // toilet
    box(0.55, 0.45, 0.6, M.porcelain, 1.0, F1, 4.95);
    cyl(0.28, 0.24, 0.12, M.porcelain, 1.0, F1 + 0.45, 4.8);
    box(0.6, 0.7, 0.25, M.porcelain, 1.0, F1 + 0.45, 5.42, { collide: false });
    // sink + cabinet + faucet
    box(1.1, 0.8, 0.55, M.wood, 3.2, F1, 5.3);
    cyl(0.32, 0.25, 0.14, M.porcelain, 3.2, F1 + 0.8, 5.25);
    box(0.06, 0.25, 0.06, M.chrome, 3.2, F1 + 0.85, 5.5, { collide: false }); box(0.06, 0.06, 0.2, M.chrome, 3.2, F1 + 1.06, 5.42, { collide: false });
    // mirror (real reflection)
    const mirror = new Reflector(new THREE.PlaneGeometry(1.0, 1.1), { textureWidth: 512, textureHeight: 512, color: '#c8d4dc' });
    mirror.position.set(3.2, F1 + 1.9, 5.57); mirror.rotation.y = Math.PI; scene.add(mirror);
    box(1.15, 1.25, 0.04, M.darkwood, 3.2, F1 + 1.27, 5.6, { collide: false });
    box(0.5, 0.5, 0.1, new THREE.MeshStandardMaterial({ color: '#7fd1c7' }), 1.8, F1 + 0.9, 1.25, { collide: false }); // towel
    const bathLight = new THREE.PointLight('#f2f6ff', 6, 9, 1.8); bathLight.position.set(3.8, F2 - 0.4, 3.3); scene.add(bathLight);
    const hallLight = new THREE.PointLight('#ffd9a0', 4, 9, 1.8); hallLight.position.set(3, F2 - 0.4, -1.5); scene.add(hallLight);

    // ---------- outside: snowy night ----------
    const ground = new THREE.Mesh(new THREE.CircleGeometry(220, 48), M.snow); ground.rotation.x = -Math.PI / 2; ground.position.y = -0.25; scene.add(ground);
    const pineOut = new THREE.MeshStandardMaterial({ color: '#244f3d', flatShading: true }), capOut = new THREE.MeshStandardMaterial({ color: '#f4f8ff', flatShading: true });
    for (let i = 0; i < 40; i++) {
      const a = Math.random() * Math.PI * 2, d = 14 + Math.random() * 50;
      const t = new THREE.Group(); t.position.set(Math.cos(a) * d, -0.25, Math.sin(a) * d);
      for (let k = 0; k < 3; k++) { const c = new THREE.Mesh(new THREE.ConeGeometry(2.2 - k * 0.55, 2.2, 7), pineOut); c.position.y = 1.8 + k * 1.3; t.add(c); const cap = new THREE.Mesh(new THREE.ConeGeometry(1.0 - k * 0.3, 0.8, 7), capOut); cap.position.y = 2.5 + k * 1.3; t.add(cap); }
      t.scale.setScalar(1 + Math.random()); scene.add(t);
    }
    // roof
    const roofL = box(17.5, 0.3, 7.6, M.roof, 0, 0, 0, { collide: false }); roofL.position.set(0, F2 + 1.9, -3.1); roofL.rotation.x = 0.6;
    const roofR = box(17.5, 0.3, 7.6, M.roof, 0, 0, 0, { collide: false }); roofR.position.set(0, F2 + 1.9, 3.1); roofR.rotation.x = -0.6;
    box(1.2, 3.5, 1.6, M.stone, -7.2, F2, 0, { collide: false });
    // moonlight through windows + dim ambient
    scene.add(new THREE.HemisphereLight('#6d85b8', '#3a2a1e', 0.35));
    const moon = new THREE.DirectionalLight('#9fb8ff', 0.35); moon.position.set(20, 30, 25); scene.add(moon);
    // snowfall outside only
    const SN = 1500, snPos = new Float32Array(SN * 3), snSpd = new Float32Array(SN);
    for (let i = 0; i < SN; i++) {
      let x, z; do { x = (Math.random() - 0.5) * 70; z = (Math.random() - 0.5) * 70; } while (Math.abs(x) < 9 && Math.abs(z) < 7);
      snPos[i * 3] = x; snPos[i * 3 + 1] = Math.random() * 20; snPos[i * 3 + 2] = z; snSpd[i] = 0.6 + Math.random();
    }
    const snGeo = new THREE.BufferGeometry(); snGeo.setAttribute('position', new THREE.BufferAttribute(snPos, 3));
    const snow = new THREE.Points(snGeo, new THREE.PointsMaterial({ color: '#ffffff', size: 0.12, transparent: true, opacity: 0.85, depthWrite: false }));
    snow.frustumCulled = false; scene.add(snow);

    return {
      scene, collision, occluders, maxCamDist: 6,
      spawn: new THREE.Vector3(1.5, 0, 1.5), spawnFacing: -Math.PI / 2,
      music: 'cozy', supportsBuild: false,
      fireLight,
      update(dt, t) {
        // flicker: layered sines + noise
        const fl = 0.75 + 0.15 * Math.sin(t * 9.3) + 0.1 * Math.sin(t * 23.7 + 1.3) + Math.random() * 0.08;
        fireLight.intensity = 40 * fl;
        fireLight.position.y = 1.0 + Math.sin(t * 7) * 0.05;
        for (const f of flames) { const p = f.userData.phase; f.scale.set(1 + Math.sin(t * 11 + p) * 0.15, 0.8 + Math.abs(Math.sin(t * 8 + p)) * 0.5, 1); f.position.y = 0.55 + f.scale.y * 0.25; }
        for (let i = 0; i < EM; i++) {
          const v = emVel[i];
          emPos[i * 3] += v[0] * dt; emPos[i * 3 + 1] += v[1] * dt; emPos[i * 3 + 2] += (v[2] + Math.sin(t * 3 + i) * 0.2) * dt;
          if (emPos[i * 3 + 1] > 1.7 || emPos[i * 3] > -5.6) resetEmber(i);
        }
        emGeo.attributes.position.needsUpdate = true;
        for (let i = 0; i < SN; i++) { snPos[i * 3 + 1] -= snSpd[i] * dt; if (snPos[i * 3 + 1] < 0) snPos[i * 3 + 1] += 20; }
        snGeo.attributes.position.needsUpdate = true;
        bulbs.forEach((b, i) => { b.visible = Math.sin(t * 2 + i) > -0.6; });
      },
    };
  },
};
