// Icy world: snowy island, glacier water, icebergs, ice spires, sky, snowfall.
import * as THREE from 'three';

export const WORLD_RADIUS = 60;   // walkable snowy island
export const BUILD_HEIGHT = 48;

function rng(seed) { // deterministic so the landscape is the same every load
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

function makeSnowTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#f4f9ff'; g.fillRect(0, 0, 256, 256);
  const r = rng(7);
  for (let i = 0; i < 2500; i++) {
    const v = 225 + Math.floor(r() * 30);
    g.fillStyle = `rgba(${v - 10},${v},255,${0.25 + r() * 0.35})`;
    g.fillRect(r() * 256, r() * 256, 1 + r() * 2, 1 + r() * 2);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(24, 24);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function makeIceChunk(r, size, color) {
  const geo = new THREE.IcosahedronGeometry(1, 1);
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  // jitter shared vertices consistently
  const cache = new Map();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const key = `${v.x.toFixed(3)},${v.y.toFixed(3)},${v.z.toFixed(3)}`;
    if (!cache.has(key)) cache.set(key, 0.75 + r() * 0.5);
    v.multiplyScalar(cache.get(key));
    if (v.y < 0) v.y *= 0.35; // flatter underwater part
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.25, metalness: 0.05, flatShading: true });
  const m = new THREE.Mesh(geo, mat);
  m.scale.set(size * (0.8 + r() * 0.6), size * (0.7 + r() * 0.9), size * (0.8 + r() * 0.6));
  m.castShadow = true; m.receiveShadow = true;
  return m;
}

export class World {
  constructor(scene) {
    this.scene = scene;
    this.colliders = []; // circles {x,z,r} the player can't walk through
    this.groundMeshes = [];
    const r = rng(42);

    // --- Sky: vertical gradient dome ---
    const skyGeo = new THREE.SphereGeometry(400, 32, 16);
    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { top: { value: new THREE.Color('#7fb8e6') }, horizon: { value: new THREE.Color('#e9f5ff') } },
      vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
      fragmentShader: 'uniform vec3 top; uniform vec3 horizon; varying vec3 vP; void main(){ float h = clamp(vP.y*1.6,0.0,1.0); gl_FragColor = vec4(mix(horizon, top, pow(h,0.8)),1.0);}',
    });
    this.sky = new THREE.Mesh(skyGeo, skyMat);
    scene.add(this.sky);
    scene.fog = new THREE.Fog('#e3f1fc', 60, 260);
    scene.background = new THREE.Color('#e3f1fc');

    // --- Lights ---
    scene.add(new THREE.HemisphereLight('#dff0ff', '#9fb6c8', 1.1));
    const sun = new THREE.DirectionalLight('#fff8ee', 1.6);
    sun.position.set(30, 50, 20);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const sc = sun.shadow.camera; sc.left = -40; sc.right = 40; sc.top = 40; sc.bottom = -40; sc.near = 1; sc.far = 150;
    sun.shadow.bias = -0.0005;
    scene.add(sun, sun.target);
    this.sun = sun;

    // --- Snowy island ---
    const snowMat = new THREE.MeshStandardMaterial({ map: makeSnowTexture(), roughness: 0.95, color: '#ffffff' });
    const ground = new THREE.Mesh(new THREE.CircleGeometry(WORLD_RADIUS, 96), snowMat);
    ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; ground.name = 'ground';
    scene.add(ground);
    this.ground = ground;
    this.groundMeshes.push(ground);
    const cliff = new THREE.Mesh(new THREE.CylinderGeometry(WORLD_RADIUS, WORLD_RADIUS + 2, 3, 96, 1, true),
      new THREE.MeshStandardMaterial({ color: '#cfe6f7', roughness: 0.6, flatShading: true }));
    cliff.position.y = -1.5; scene.add(cliff);

    // --- Glacier water ---
    const water = new THREE.Mesh(new THREE.CircleGeometry(420, 64),
      new THREE.MeshStandardMaterial({ color: '#4f8fb8', roughness: 0.15, metalness: 0.3 }));
    water.rotation.x = -Math.PI / 2; water.position.y = -1.2; scene.add(water);

    // --- Icebergs floating offshore ---
    const bergColors = ['#e6f6ff', '#cdeeff', '#b3e1fb', '#f5fbff'];
    for (let i = 0; i < 26; i++) {
      const a = r() * Math.PI * 2, d = 78 + r() * 120;
      const berg = makeIceChunk(r, 5 + r() * 12, bergColors[i % 4]);
      berg.position.set(Math.cos(a) * d, -1.2, Math.sin(a) * d);
      berg.rotation.y = r() * Math.PI;
      scene.add(berg);
    }
    // distant glacier wall ring
    for (let i = 0; i < 40; i++) {
      const a = (i / 40) * Math.PI * 2 + r() * 0.1, d = 260 + r() * 30;
      const g = makeIceChunk(r, 22 + r() * 18, i % 2 ? '#d9efff' : '#c3e4fa');
      g.position.set(Math.cos(a) * d, -2, Math.sin(a) * d);
      g.scale.y *= 1.4;
      scene.add(g);
    }

    // --- Ice spires (collidable) on the island ---
    const spireMat = new THREE.MeshStandardMaterial({ color: '#a9dcf7', roughness: 0.1, metalness: 0.1, flatShading: true, transparent: true, opacity: 0.88 });
    const spots = [[28, 18], [-32, 22], [-20, -34], [36, -26], [6, 44], [-46, -6]];
    for (const [x, z] of spots) {
      const cluster = new THREE.Group();
      const n = 3 + Math.floor(r() * 3);
      for (let k = 0; k < n; k++) {
        const h = 4 + r() * 8, rad = 0.8 + r() * 1.2;
        const cone = new THREE.Mesh(new THREE.ConeGeometry(rad, h, 6), spireMat);
        cone.position.set((r() - 0.5) * 3, h / 2, (r() - 0.5) * 3);
        cone.rotation.set((r() - 0.5) * 0.4, r() * 3, (r() - 0.5) * 0.4);
        cone.castShadow = true;
        cluster.add(cone);
      }
      cluster.position.set(x, 0, z);
      scene.add(cluster);
      this.colliders.push({ x, z, r: 3.2 });
    }

    // --- Snow drifts + pine trees for coziness (decor only) ---
    const driftMat = new THREE.MeshStandardMaterial({ color: '#f7fbff', roughness: 1 });
    for (let i = 0; i < 30; i++) {
      const a = r() * Math.PI * 2, d = 15 + r() * 42;
      const drift = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), driftMat);
      drift.scale.set(2 + r() * 3, 0.4 + r() * 0.4, 1.5 + r() * 2);
      drift.position.set(Math.cos(a) * d, 0, Math.sin(a) * d);
      drift.receiveShadow = true; scene.add(drift);
    }
    const trunkMat = new THREE.MeshStandardMaterial({ color: '#6b4a2f' });
    const pineMat = new THREE.MeshStandardMaterial({ color: '#2d6b4f', flatShading: true });
    const capMat = new THREE.MeshStandardMaterial({ color: '#ffffff', flatShading: true });
    for (let i = 0; i < 14; i++) {
      const a = r() * Math.PI * 2, d = 40 + r() * 16;
      const x = Math.cos(a) * d, z = Math.sin(a) * d;
      if (this.blockedAt(x, z, 2)) continue;
      const tree = new THREE.Group();
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.3, 1.2), trunkMat); trunk.position.y = 0.6;
      tree.add(trunk);
      for (let k = 0; k < 3; k++) {
        const cone = new THREE.Mesh(new THREE.ConeGeometry(1.8 - k * 0.45, 1.8, 7), pineMat);
        cone.position.y = 1.6 + k * 1.1; cone.castShadow = true; tree.add(cone);
        const cap = new THREE.Mesh(new THREE.ConeGeometry(0.9 - k * 0.25, 0.7, 7), capMat);
        cap.position.y = 2.2 + k * 1.1; tree.add(cap);
      }
      const s = 1 + r() * 0.6; tree.scale.setScalar(s);
      tree.position.set(x, 0, z); scene.add(tree);
      this.colliders.push({ x, z, r: 0.6 * s });
    }

    // --- Build grid (only visible in build mode) ---
    this.grid = new THREE.GridHelper(WORLD_RADIUS * 2, WORLD_RADIUS * 2, '#6aa8d8', '#9cc8ea');
    this.grid.position.y = 0.01; this.grid.material.transparent = true; this.grid.material.opacity = 0.35;
    this.grid.visible = false; scene.add(this.grid);

    this._makeSnowfall();
  }

  blockedAt(x, z, pad = 0) {
    return this.colliders.some(c => (x - c.x) ** 2 + (z - c.z) ** 2 < (c.r + pad) ** 2);
  }

  _makeSnowfall() {
    const N = 2200, box = { w: 90, h: 40 };
    const pos = new Float32Array(N * 3);
    this.snowSpeed = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      pos[i * 3] = (Math.random() - 0.5) * box.w;
      pos[i * 3 + 1] = Math.random() * box.h;
      pos[i * 3 + 2] = (Math.random() - 0.5) * box.w;
      this.snowSpeed[i] = 0.8 + Math.random() * 1.4;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const c = document.createElement('canvas'); c.width = c.height = 32;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(16, 16, 0, 16, 16, 16);
    grad.addColorStop(0, 'rgba(255,255,255,1)'); grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad; g.fillRect(0, 0, 32, 32);
    const mat = new THREE.PointsMaterial({ size: 0.28, map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false, opacity: 0.9 });
    this.snow = new THREE.Points(geo, mat);
    this.snow.frustumCulled = false;
    this.snowBox = box;
    this.scene.add(this.snow);
  }

  update(dt, t, focus) {
    // snowfall follows the player
    const p = this.snow.geometry.attributes.position, a = p.array, { w, h } = this.snowBox;
    for (let i = 0; i < this.snowSpeed.length; i++) {
      a[i * 3 + 1] -= this.snowSpeed[i] * dt;
      a[i * 3] += Math.sin(t * 0.7 + i) * 0.3 * dt;
      if (a[i * 3 + 1] < 0) a[i * 3 + 1] += h;
    }
    p.needsUpdate = true;
    this.snow.position.set(Math.round(focus.x / 10) * 10, 0, Math.round(focus.z / 10) * 10);
    // shadow camera follows the player
    this.sun.position.set(focus.x + 30, 50, focus.z + 20);
    this.sun.target.position.copy(focus);
  }
}
