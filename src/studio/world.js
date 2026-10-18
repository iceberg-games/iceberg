// Scene construction shared by the Studio editor and the runtime player:
// sky/lighting/ground environment + 3D objects for every instance.
import * as THREE from 'three';
import { buildObject } from './instances.js';

export const SKIES = {
  day:    { name: 'Frosty Day',   top: '#7fb8e6', horizon: '#e9f5ff', sun: 1.6, hemi: 1.1, sunColor: '#fff8ee' },
  sunset: { name: 'Polar Sunset', top: '#5b6fb0', horizon: '#ffb38a', sun: 1.2, hemi: 0.8, sunColor: '#ffb070' },
  night:  { name: 'Aurora Night', top: '#081428', horizon: '#1f5a5a', sun: 0.35, hemi: 0.5, sunColor: '#9fb8ff', stars: true },
  space:  { name: 'Starry Space', top: '#000004', horizon: '#14143a', sun: 0.9, hemi: 0.5, sunColor: '#ffffff', stars: true },
};
export const GROUNDS = {
  baseplate: { name: 'Baseplate (512 studs)' },
  island: { name: 'Glacier island' },
  void: { name: 'None (void, for obbies)' },
};

function studTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  g.fillStyle = '#7d8a96'; g.fillRect(0, 0, 64, 64);
  g.strokeStyle = 'rgba(0,0,0,0.12)'; g.lineWidth = 2; g.strokeRect(0, 0, 64, 64);
  g.fillStyle = 'rgba(255,255,255,0.08)'; g.beginPath(); g.arc(32, 32, 14, 0, 7); g.fill();
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4; return t;
}

export function buildEnvironment(scene, doc) {
  const sky = SKIES[doc.sky] || SKIES.day;
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color(sky.top) }, horizon: { value: new THREE.Color(sky.horizon) } },
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader: 'uniform vec3 top; uniform vec3 horizon; varying vec3 vP; void main(){ float h = clamp(vP.y*1.6,0.0,1.0); gl_FragColor = vec4(mix(horizon, top, pow(h,0.8)),1.0);}',
  });
  const skyMesh = new THREE.Mesh(new THREE.SphereGeometry(900, 32, 16), skyMat); skyMesh.userData.env = true; scene.add(skyMesh);
  scene.fog = new THREE.Fog(sky.horizon, 150, 700);
  if (sky.stars) {
    const n = 900, p = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { const v = new THREE.Vector3().randomDirection(); v.y = Math.abs(v.y) + 0.05; v.normalize().multiplyScalar(800); p.set([v.x, v.y, v.z], i * 3); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    scene.add(new THREE.Points(g, new THREE.PointsMaterial({ color: '#ffffff', size: 1.5, sizeAttenuation: false, fog: false })));
  }
  scene.add(new THREE.HemisphereLight('#e6f2ff', '#8a96a3', sky.hemi));
  const sun = new THREE.DirectionalLight(sky.sunColor, sky.sun);
  sun.position.set(40, 80, 30); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -60, right: 60, top: 60, bottom: -60, far: 250 }); sun.shadow.bias = -0.0004;
  scene.add(sun, sun.target);

  let ground = null, bounds = null, floorY = 0;
  if (doc.ground === 'island') {
    ground = new THREE.Mesh(new THREE.CircleGeometry(64, 96), new THREE.MeshStandardMaterial({ color: '#eef5fb', roughness: 0.95 }));
    const water = new THREE.Mesh(new THREE.CircleGeometry(800, 32), new THREE.MeshStandardMaterial({ color: '#4f8fb8', roughness: 0.15, metalness: 0.3 }));
    water.rotation.x = -Math.PI / 2; water.position.y = -1.2; scene.add(water);
    bounds = { type: 'circle', r: 63 };
  } else if (doc.ground === 'void') {
    floorY = null;
  } else {
    const tex = studTexture(); tex.repeat.set(256, 256);
    ground = new THREE.Mesh(new THREE.PlaneGeometry(512, 512), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8 }));
    bounds = { type: 'box', minX: -255.5, maxX: 255.5, minZ: -255.5, maxZ: 255.5 };
  }
  if (ground) { ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; ground.userData.ground = true; scene.add(ground); }

  let snow = null, snowSpd;
  if (doc.snow) {
    const N = 1500, pos = new Float32Array(N * 3); snowSpd = new Float32Array(N);
    for (let i = 0; i < N; i++) { pos[i * 3] = (Math.random() - 0.5) * 90; pos[i * 3 + 1] = Math.random() * 40; pos[i * 3 + 2] = (Math.random() - 0.5) * 90; snowSpd[i] = 0.8 + Math.random() * 1.3; }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    snow = new THREE.Points(geo, new THREE.PointsMaterial({ color: '#fff', size: 0.15, transparent: true, opacity: 0.85, depthWrite: false }));
    snow.frustumCulled = false; scene.add(snow);
  }
  const update = (dt, focus) => {
    sun.position.set(focus.x + 40, focus.y + 80, focus.z + 30); sun.target.position.copy(focus);
    if (snow) { const a = snow.geometry.attributes.position.array; for (let i = 0; i < snowSpd.length; i++) { a[i * 3 + 1] -= snowSpd[i] * dt; if (a[i * 3 + 1] < 0) a[i * 3 + 1] += 40; } snow.geometry.attributes.position.needsUpdate = true; snow.position.set(focus.x, focus.y - 10, focus.z); }
  };
  return { ground, bounds, floorY, update };
}

export class StudioWorld {
  constructor(scene, doc, { models, editing = false }) {
    this.scene = scene; this.models = models; this.editing = editing;
    this.env = buildEnvironment(scene, doc);
    this.group = new THREE.Group(); scene.add(this.group);
    this.entries = new Map();
    for (const inst of doc.instances || []) this.add(inst);
    this.time = 0;
  }
  add(inst) {
    const entry = buildObject(inst, { models: this.models, editing: this.editing });
    entry.inst = inst;
    this.group.add(entry.root);
    this.entries.set(inst.id, entry);
    return entry;
  }
  remove(id) { const e = this.entries.get(id); if (e) { this.group.remove(e.root); this.entries.delete(id); } }
  rebuild(inst) { this.remove(inst.id); return this.add(inst); }
  rebuildAll(instances) { for (const id of [...this.entries.keys()]) this.remove(id); for (const i of instances) this.add(i); }
  pickables() { const out = []; for (const e of this.entries.values()) e.root.traverse(o => { if (o.isMesh || o.isSkinnedMesh) out.push(o); }); if (this.env.ground) out.push(this.env.ground); return out; }
  idFromObject(o) { while (o) { if (o.userData.instId) return o.userData.instId; o = o.parent; } return null; }
  update(dt, focus) {
    this.time += dt; this.env.update(dt, focus);
    for (const e of this.entries.values()) {
      if (e.inst.type === 'coin') e.body.rotation.y += dt * 2.5;
      if (e.icon) e.icon.rotation.y += dt * 1.5;
      if (e.inst.material === 'lava') e.root.traverse(o => { if (o.material?.userData?.lava) o.material.emissiveIntensity = 0.9 + Math.sin(this.time * 3) * 0.35; });
    }
  }
}
