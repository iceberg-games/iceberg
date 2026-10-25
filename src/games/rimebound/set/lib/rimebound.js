// Rimebound runtime kit (Iceberg asym-horror sets): loads a Blender-exported .glb blockout and dresses it for
// Forsaken-like dark stylized horror — heavy cold fog, dim moon, sparse flickering warm lanterns, cold rime glows,
// drifting mist motes. Shared by rimebound-lobby / -shipyard / -mines.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { createSky } from './sky.js';
import { rng } from './blocks.js';

export async function loadGLB(url) {
  const gltf = await new GLTFLoader().loadAsync(url);
  gltf.scene.traverse((o) => {
    if (!o.isMesh) return;
    const glowing = o.material.emissive && o.material.emissive.getHex() !== 0;
    o.castShadow = !glowing; o.receiveShadow = !glowing;
    o.material.flatShading = true; o.material.needsUpdate = true;
    if (glowing) { o.material.toneMapped = false; o.material.emissiveIntensity = Math.max(o.material.emissiveIntensity, 1) * 1.6; }
  });
  return gltf.scene;
}

// SURFACES rows: [minX,minZ,maxX,maxZ,top] | {ramp:[x0,z0,y0,x1,z1,y1,w]} | {disc:[x,z,r,top]}
export function surfaceTops(SURFACES, x, z) {
  const out = [];
  for (const s of SURFACES) {
    if (Array.isArray(s)) { if (x >= s[0] && x <= s[2] && z >= s[1] && z <= s[3]) out.push(s[4]); }
    else if (s.disc) { const [cx, cz, r, top] = s.disc; if (Math.hypot(x - cx, z - cz) <= r) out.push(top); }
    else if (s.ramp) {
      const [x0, z0, y0, x1, z1, y1, w] = s.ramp, dx = x1 - x0, dz = z1 - z0, L2 = dx * dx + dz * dz;
      const t = ((x - x0) * dx + (z - z0) * dz) / L2; if (t < 0 || t > 1) continue;
      if (Math.hypot(x - (x0 + dx * t), z - (z0 + dz * t)) <= w / 2) out.push(y0 + (y1 - y0) * t);
    }
  }
  return out;
}
// highest surface not more than `step` above the current foot height (so decks overhead don't teleport you up)
export function makeGroundHeight(SURFACES, base = -Infinity, step = 1.3) {
  return (x, z, y = Infinity) => {
    let best = base;
    for (const t of surfaceTops(SURFACES, x, z)) if (t <= y + step && t > best) best = t;
    return best === -Infinity ? 0 : best;
  };
}

export function rimeAtmosphere(scene, renderer, { fog = '#0b1018', density = 0.022, moon = 0.35, hemi = 0.28, shadowBox = 70,
  moonPos = [-60, 110, -40], horizon = '#141c28', top = '#03050a' } = {}) {
  const sky = createSky(); scene.add(sky.mesh);
  sky.uniforms.uNightTop.value.set(top); sky.uniforms.uNightHorizon.value.set(horizon); sky.uniforms.uAurora.value = 0.15;
  scene.fog = new THREE.FogExp2(fog, density); scene.background = null;
  const hemiL = new THREE.HemisphereLight('#5b6f8f', '#120f14', hemi); scene.add(hemiL);
  const moonL = new THREE.DirectionalLight('#8fa8d8', moon); moonL.position.set(...moonPos); scene.add(moonL, moonL.target);
  moonL.castShadow = true; moonL.shadow.mapSize.set(2048, 2048);
  Object.assign(moonL.shadow.camera, { left: -shadowBox, right: shadowBox, top: shadowBox, bottom: -shadowBox, near: 5, far: 400 });
  moonL.shadow.bias = -0.0005; moonL.shadow.normalBias = 0.3;
  renderer.toneMappingExposure = 1.0;
  return { sky, hemi: hemiL, moon: moonL, base: { fog, density, moon, hemi } };
}

// warm lantern point lights (flickering) — capped so big maps stay fast; extra lanterns only glow (emissive)
export function addLanterns(scene, LANTERNS, { max = 22, power = 14, dist = 13 } = {}) {
  const R = rng(99), out = [];
  const pick = [...LANTERNS].sort((a, b) => b[3] - a[3]).slice(0, max);
  for (const [x, y, z, k, c] of pick) {
    const L = new THREE.PointLight(c, power * k, dist * Math.sqrt(k), 1.6); L.position.set(x, y, z); scene.add(L);
    out.push({ L, base: power * k, ph: R() * 100, sp: 6 + R() * 6 });
  }
  return out;
}
export function addGlows(scene, GLOWS, { power = 30, dist = 22 } = {}) {
  return GLOWS.map(([x, y, z, k, c]) => { const L = new THREE.PointLight(c, power * k, dist * Math.sqrt(k), 1.5); L.position.set(x, y, z); scene.add(L); return { L, base: power * k }; });
}
export function flicker(list, t) {
  for (const f of list) f.L.intensity = f.base * (0.78 + 0.14 * Math.sin(t * f.sp + f.ph) + 0.08 * Math.sin(t * 23 + f.ph * 3));
}

// slow drifting mist/ash motes inside a box
export function mistMotes(scene, { count = 2500, cx = 0, cz = 0, sx = 80, sz = 80, y0 = 0, y1 = 10, color = '#9fb4cc', size = 0.07 } = {}) {
  const R = rng(5), p = [];
  for (let i = 0; i < count; i++) p.push(cx + (R() - 0.5) * sx, y0 + R() * (y1 - y0), cz + (R() - 0.5) * sz);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  const m = new THREE.Points(g, new THREE.PointsMaterial({ color, size, transparent: true, opacity: 0.45, depthWrite: false }));
  scene.add(m); return m;
}

// low ground-fog sheets (stacked additive-free transparent planes) for pier/yard banks
export function fogBank(scene, { x = 0, z = 0, w = 40, d = 40, y = 0.6, layers = 3, color = '#506177', opacity = 0.16 } = {}) {
  const cv = document.createElement('canvas'); cv.width = cv.height = 128; const g = cv.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 4, 64, 64, 64); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128); const tex = new THREE.CanvasTexture(cv);
  const grp = new THREE.Group();
  for (let i = 0; i < layers; i++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshBasicMaterial({ map: tex, color, transparent: true, opacity, depthWrite: false }));
    m.rotation.x = -Math.PI / 2; m.position.set(x, y + i * 0.9, z); grp.add(m);
  }
  scene.add(grp); return grp;
}

// standard set return object pieces
export function lookControls(atm, renderer, extra = () => {}) {
  const look = { night: 1, weather: 0.3 };
  const apply = () => {
    const n = look.night, w = look.weather, b = atm.base;
    atm.scene.fog.density = b.density * (0.8 + w * 0.9) * (n > 0.5 ? 1 : 0.7);
    atm.scene.fog.color.set(b.fog).lerp(new THREE.Color('#58687c'), (1 - n) * 0.8);
    atm.hemi.intensity = b.hemi + (1 - n) * 0.9; atm.moon.intensity = b.moon + (1 - n) * 1.2;
    atm.sky.uniforms.uNight.value = Math.max(n, 0.35);
    renderer.toneMappingExposure = n > 0.5 ? 1.0 : 0.9; extra(look);
  };
  return { look, apply,
    setNight(v) { if (v !== look.night) { look.night = v; apply(); } },
    setWeather(v) { if (v !== look.weather) { look.weather = v; apply(); } } };
}
