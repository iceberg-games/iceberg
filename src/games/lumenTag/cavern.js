// Lumen Tag cavern: crystal dome, glowing vein floor, crystal pillars (cover), aurora light shafts,
// power-crystal pads, drifting motes, thumbnail. Perf: no shadows, emissive/additive only, 3 point lights.
import * as THREE from 'three';
import * as C from './config.js';
const rand = (a, b) => a + Math.random() * (b - a);
const NOISE = `
float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float n21(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(h21(i), h21(i+vec2(1,0)), f.x), mix(h21(i+vec2(0,1)), h21(i+vec2(1,1)), f.x), f.y); }`;

export function glowTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const add = (c) => ({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, fog: false, color: c });

// pillar layout: inner ring, outer ring, a few lone shards. {x,z,r,h,color}
function layout() {
  const P = [], hues = ['#2fc8ff', '#9a4dff', '#ff4fc8', '#2fffa8'];
  for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2 + 0.3; P.push({ x: Math.cos(a) * 9, z: Math.sin(a) * 9, r: 1.5, h: 9, color: hues[i % 4] }); }
  for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2 + 0.05; P.push({ x: Math.cos(a) * 19.5, z: Math.sin(a) * 19.5, r: 1.9, h: 13, color: hues[(i + 1) % 4] }); }
  for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2 + 0.55; P.push({ x: Math.cos(a) * 14.5, z: Math.sin(a) * 14.5, r: 0.9, h: 4, color: hues[(i + 2) % 4], low: true }); }
  return P;
}
export const PADS = [0, 1, 2].map(i => { const a = i / 3 * Math.PI * 2 + Math.PI / 2; return { x: Math.cos(a) * 14.5, z: Math.sin(a) * 14.5, type: ['prism', 'surge', 'shield'][i] }; })
  .concat([{ x: 0, z: 0, type: 'prism', center: true }]);

export function buildCavern() {
  const scene = new THREE.Scene(); scene.fog = new THREE.FogExp2('#0a0820', 0.018);
  scene.background = new THREE.Color('#05040f');
  const glowTex = glowTexture();
  scene.add(new THREE.HemisphereLight('#7f9bff', '#2a0f3a', 0.55));
  const key = new THREE.DirectionalLight('#bfe8ff', 0.7); key.position.set(10, 40, 8); scene.add(key);
  const lights = [['#5fe8ff', 0, 0], ['#c07aff', 18, -10], ['#ff7ad8', -16, 12]].map(([c, x, z]) => { const l = new THREE.PointLight(c, 60, 40, 1.6); l.position.set(x, 7, z); scene.add(l); return l; });

  // dome
  const dome = new THREE.Mesh(new THREE.SphereGeometry(C.ARENA_R + 22, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.ShaderMaterial({
    side: THREE.BackSide, fog: false, uniforms: { t: { value: 0 } },
    vertexShader: `varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `uniform float t; varying vec3 vP; ${NOISE}
      void main(){ vec3 d = normalize(vP); vec2 uv = vec2(atan(d.z, d.x) * 6.0, d.y * 10.0);
        float rock = n21(uv * 1.5) * 0.6 + n21(uv * 5.0) * 0.4;
        vec3 col = mix(vec3(0.02,0.015,0.05), vec3(0.07,0.04,0.13), rock) * (1.0 - d.y * 0.5);
        vec2 g = uv * 3.0; float s = h21(floor(g)); float tw = 0.5 + 0.5 * sin(t * 2.0 + s * 40.0);
        col += mix(vec3(0.3,0.9,1.0), vec3(0.9,0.4,1.0), s) * step(0.965, s) * smoothstep(0.45, 0.0, length(fract(g) - 0.5)) * tw * 1.6;
        col += vec3(0.05,0.25,0.3) * smoothstep(0.25, 0.0, d.y) * 0.6;
        gl_FragColor = vec4(col, 1.0); }`,
  })); dome.position.y = -1; scene.add(dome);

  // floor with glowing crystal veins + spawn ring
  const floor = new THREE.Mesh(new THREE.CircleGeometry(C.ARENA_R + 24, 64), new THREE.ShaderMaterial({
    uniforms: { t: { value: 0 } }, fog: false,
    vertexShader: `varying vec2 vW; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `uniform float t; varying vec2 vW; ${NOISE}
      void main(){ float n = n21(vW * 0.18) + n21(vW * 0.5) * 0.5;
        float vein = smoothstep(0.06, 0.0, abs(fract(n * 3.0) - 0.5) - 0.01);
        float pulse = 0.55 + 0.45 * sin(t * 1.5 - length(vW) * 0.25);
        vec3 col = vec3(0.012,0.01,0.03) + vec3(0.02,0.015,0.05) * n21(vW * 2.0);
        col += mix(vec3(0.2,0.8,1.0), vec3(0.8,0.35,1.0), n21(vW * 0.05 + 3.0)) * vein * pulse * 0.22;
        float r = length(vW); col += vec3(0.3,0.9,1.0) * smoothstep(0.25, 0.0, abs(r - ${C.ARENA_R.toFixed(1)})) * 0.8;
        col *= smoothstep(${(C.ARENA_R + 20).toFixed(1)}, ${(C.ARENA_R + 2).toFixed(1)}, r) * 0.85 + 0.15;
        gl_FragColor = vec4(col, 1.0);
      }`,
  })); floor.rotation.x = -Math.PI / 2; scene.add(floor);

  // pillars
  const pillars = layout();
  const coreGeo = new THREE.CylinderGeometry(1, 1.18, 1, 6); coreGeo.translate(0, 0.5, 0);
  const tipGeo = new THREE.ConeGeometry(1, 1, 6); tipGeo.translate(0, 0.5, 0);
  for (const p of pillars) {
    const g = new THREE.Group(); g.position.set(p.x, 0, p.z); g.rotation.y = rand(0, 6);
    const mat = new THREE.MeshStandardMaterial({ color: p.color, emissive: p.color, emissiveIntensity: 0.45, roughness: 0.15, metalness: 0.3, flatShading: true, transparent: true, opacity: 0.82 });
    const body = new THREE.Mesh(coreGeo, mat); body.scale.set(p.r, p.h * 0.8, p.r); g.add(body);
    const tip = new THREE.Mesh(tipGeo, mat); tip.position.y = p.h * 0.8; tip.scale.set(p.r * 1.18, p.h * 0.25, p.r * 1.18); g.add(tip);
    const inner = new THREE.Mesh(coreGeo, new THREE.MeshBasicMaterial(add('#ffffff'))); inner.scale.set(p.r * 0.35, p.h * 0.75, p.r * 0.35); inner.material.opacity = 0.35; g.add(inner);
    // satellite shards
    for (let k = 0; k < 3; k++) { const s = new THREE.Mesh(tipGeo, mat); const a = rand(0, 6), d = p.r + rand(0.2, 0.7); s.position.set(Math.cos(a) * d, 0, Math.sin(a) * d); s.scale.set(0.35, rand(1.2, 2.6), 0.35); s.rotation.set(rand(-0.4, 0.4), 0, rand(-0.4, 0.4)); g.add(s); }
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, ...add(p.color), opacity: 0.55 })); halo.scale.set(p.r * 6, p.r * 3, 1); halo.position.y = 0.6; g.add(halo);
    p.mat = mat; p.inner = inner; p.flash = 0; p.group = g; scene.add(g);
  }
  // wall crystal clusters (instanced, decor only)
  const N = 70, wall = new THREE.InstancedMesh(tipGeo, new THREE.MeshStandardMaterial({ color: '#8fd8ff', emissive: '#5f7cff', emissiveIntensity: 0.6, flatShading: true }), N);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), cols = ['#7af2ff', '#c08bff', '#ff8be0', '#8bffc4'];
  for (let i = 0; i < N; i++) { const a = i / N * Math.PI * 2 + rand(-0.05, 0.05), d = C.ARENA_R + rand(11, 17), s = rand(1, 2.8);
    e.set(rand(-0.5, 0.5), 0, rand(-0.5, 0.5)); q.setFromEuler(e); m4.compose(new THREE.Vector3(Math.cos(a) * d, -0.2, Math.sin(a) * d), q, new THREE.Vector3(s, s * rand(2, 5), s));
    wall.setMatrixAt(i, m4); wall.setColorAt(i, new THREE.Color(cols[i % 4])); }
  scene.add(wall);
  // stalactites
  const stal = new THREE.InstancedMesh(new THREE.ConeGeometry(1, 1, 5), new THREE.MeshStandardMaterial({ color: '#2a1d4a', emissive: '#3a1f6a', emissiveIntensity: 0.4, flatShading: true }), 40);
  for (let i = 0; i < 40; i++) { const a = rand(0, 6.28), d = rand(6, C.ARENA_R + 14), s = rand(0.6, 1.6), h = rand(3, 8);
    e.set(Math.PI, 0, 0); q.setFromEuler(e); m4.compose(new THREE.Vector3(Math.cos(a) * d, Math.sqrt(Math.max(0, (C.ARENA_R + 22) ** 2 - d * d)) - 1 - h / 2, Math.sin(a) * d), q, new THREE.Vector3(s, h, s)); stal.setMatrixAt(i, m4); }
  scene.add(stal);

  // aurora light shafts from ceiling cracks
  const shaftMat = (hue) => new THREE.ShaderMaterial({ ...add(), uniforms: { t: { value: 0 }, hue: { value: hue } }, side: THREE.DoubleSide,
    vertexShader: `varying vec2 vU; varying vec3 vN; void main(){ vU = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `uniform float t; uniform float hue; varying vec2 vU; ${NOISE}
      vec3 hsv(float h){ return clamp(abs(mod(h*6.0+vec3(0,4,2),6.0)-3.0)-1.0, 0.0, 1.0); }
      void main(){ float wave = n21(vec2(vU.x * 9.0 + t * 0.4, vU.y * 2.0 - t * 0.3));
        float a = pow(vU.y, 1.6) * (0.35 + 0.65 * wave) * 0.05 * smoothstep(0.0, 0.25, 1.0 - vU.y + 0.1);
        gl_FragColor = vec4(mix(hsv(hue + 0.08 * sin(t*0.3 + vU.y*2.0)), vec3(1.0), 0.15) * a, 1.0); }` });
  const shafts = [];
  [[0, 0, 3.4, 0.45], [12, -14, 3.2, 0.78], [-15, -6, 3.6, 0.33], [-6, 17, 3, 0.9], [17, 10, 2.8, 0.55]].forEach(([x, z, r, hue]) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.55, r, 40, 24, 1, true), shaftMat(hue)); m.position.set(x, 20, z); scene.add(m); shafts.push(m);
    const pool = new THREE.Mesh(new THREE.CircleGeometry(r * 1.1, 32), new THREE.MeshBasicMaterial({ map: glowTex, ...add('#9ff6ff'), opacity: 0.35 })); pool.rotation.x = -Math.PI / 2; pool.position.set(x, 0.03, z); scene.add(pool); });

  // drifting motes
  const NM = 260, mg = new THREE.BufferGeometry(), mp = new Float32Array(NM * 3), seeds = [];
  for (let i = 0; i < NM; i++) { const a = rand(0, 6.28), d = Math.sqrt(Math.random()) * C.ARENA_R; seeds.push([Math.cos(a) * d, rand(0.5, 16), Math.sin(a) * d, rand(0, 6)]); }
  mg.setAttribute('position', new THREE.BufferAttribute(mp, 3));
  const motes = new THREE.Points(mg, new THREE.PointsMaterial({ map: glowTex, size: 0.35, ...add('#bff4ff'), opacity: 0.8 })); motes.frustumCulled = false; scene.add(motes);

  // power pads
  const pads = PADS.map(p => {
    const g = new THREE.Group(); g.position.set(p.x, 0, p.z); scene.add(g);
    const col = C.POWERS[p.type].color;
    const ring = new THREE.Mesh(new THREE.RingGeometry(1.1, 1.4, 32), new THREE.MeshBasicMaterial({ ...add(col), side: THREE.DoubleSide, opacity: 0.8 })); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.05; g.add(ring);
    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.55), new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 1.2, flatShading: true })); gem.scale.y = 1.5; gem.position.y = 1.4; g.add(gem);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, ...add(col), opacity: 0.8 })); halo.scale.setScalar(3); halo.position.y = 1.4; g.add(halo);
    return { ...p, group: g, ring, gem, halo, ready: !p.center, t: p.center ? 25 : 0 };
  });

  return {
    scene, pillars, pads, glowTex,
    update(dt, t) {
      dome.material.uniforms.t.value = t; floor.material.uniforms.t.value = t;
      for (const s of shafts) s.material.uniforms.t.value = t;
      for (let i = 0; i < NM; i++) { const s = seeds[i]; mp[i * 3] = s[0] + Math.sin(t * 0.3 + s[3]) * 1.2; mp[i * 3 + 1] = (s[1] + t * 0.25 + s[3]) % 16; mp[i * 3 + 2] = s[2] + Math.cos(t * 0.25 + s[3]) * 1.2; }
      mg.attributes.position.needsUpdate = true;
      lights.forEach((l, i) => { l.intensity = 50 + Math.sin(t * 1.3 + i * 2) * 14; });
      for (const p of pillars) { p.flash = Math.max(0, p.flash - dt * 3); p.mat.emissiveIntensity = 0.42 + Math.sin(t * 1.2 + p.x) * 0.12 + p.flash * 1.6; p.inner.material.opacity = 0.3 + p.flash * 0.6; }
      for (const p of pads) { p.gem.visible = p.halo.visible = p.ready; p.gem.rotation.y = t * 2; p.gem.position.y = p.halo.position.y = 1.4 + Math.sin(t * 3 + p.x) * 0.2;
        p.ring.material.opacity = p.ready ? 0.6 + Math.sin(t * 5) * 0.3 : 0.15; p.ring.scale.setScalar(p.ready ? 1 + Math.sin(t * 4) * 0.06 : 0.8); }
    },
  };
}

export function drawThumb() {
  const c = document.createElement('canvas'); c.width = 480; c.height = 270; const g = c.getContext('2d');
  const bg = g.createRadialGradient(240, 120, 10, 240, 140, 320); bg.addColorStop(0, '#1d1446'); bg.addColorStop(1, '#03020a'); g.fillStyle = bg; g.fillRect(0, 0, 480, 270);
  g.globalCompositeOperation = 'lighter';
  [[240, 70, 'rgba(90,255,220,.22)'], [90, 50, 'rgba(190,120,255,.2)'], [390, 40, 'rgba(255,120,230,.18)']].forEach(([x, w, col]) => { const gr = g.createLinearGradient(0, 0, 0, 230); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, col); g.fillStyle = gr; g.beginPath(); g.moveTo(x - w * 0.3, 0); g.lineTo(x + w * 0.3, 0); g.lineTo(x + w, 230); g.lineTo(x - w, 230); g.fill(); });
  const crystal = (x, y, w, h, col) => { g.shadowColor = col; g.shadowBlur = 24; g.fillStyle = col; g.beginPath(); g.moveTo(x, y - h); g.lineTo(x + w, y - h * 0.75); g.lineTo(x + w, y); g.lineTo(x - w, y); g.lineTo(x - w, y - h * 0.75); g.closePath(); g.fill();
    g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(x - w * 0.2, y - h * 0.7, w * 0.4, h * 0.65); };
  crystal(60, 235, 26, 170, 'rgba(120,230,255,.75)'); crystal(420, 235, 30, 190, 'rgba(200,130,255,.75)'); crystal(150, 225, 14, 80, 'rgba(255,130,220,.7)'); crystal(340, 228, 16, 95, 'rgba(130,255,200,.7)');
  const beam = (x1, y1, x2, y2, col) => { g.shadowColor = col; g.shadowBlur = 18; g.strokeStyle = col; g.lineWidth = 9; g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke(); g.strokeStyle = '#fff'; g.lineWidth = 3; g.stroke(); };
  beam(110, 175, 300, 150, '#4fd8ff'); beam(380, 120, 230, 170, '#ff4f8b');
  g.shadowBlur = 30; g.shadowColor = '#fff'; g.fillStyle = '#fff'; g.beginPath(); g.arc(300, 150, 10, 0, 7); g.fill();
  g.globalCompositeOperation = 'source-over'; g.shadowBlur = 0;
  const kid = (x, y, col, s = 1) => { g.fillStyle = '#ffd34d'; g.fillRect(x - 6 * s, y - 34 * s, 12 * s, 11 * s); g.fillStyle = col; g.fillRect(x - 8 * s, y - 23 * s, 16 * s, 15 * s); g.fillStyle = '#fff'; g.shadowColor = col; g.shadowBlur = 10; g.fillRect(x - 6 * s, y - 31 * s, 12 * s, 3 * s); g.shadowBlur = 0; g.fillStyle = '#1c1840'; g.fillRect(x - 7 * s, y - 8 * s, 6 * s, 9 * s); g.fillRect(x + 1 * s, y - 8 * s, 6 * s, 9 * s); };
  kid(105, 200, '#4fd8ff', 1.5); kid(305, 178, '#5bff9c', 1.3); kid(385, 150, '#ff4f8b', 1.2);
  g.font = '900 24px sans-serif'; g.fillStyle = '#fff36b'; g.strokeStyle = '#2a0a3a'; g.lineWidth = 5; g.strokeText('TAGGED!', 280, 118); g.fillText('TAGGED!', 280, 118);
  g.font = '900 44px sans-serif'; g.lineWidth = 9; g.strokeStyle = '#0a0620'; g.strokeText('LUMEN TAG', 20, 258);
  const tg = g.createLinearGradient(20, 0, 260, 0); tg.addColorStop(0, '#7af2ff'); tg.addColorStop(0.5, '#e7b0ff'); tg.addColorStop(1, '#ff8be0'); g.fillStyle = tg; g.shadowColor = '#b06cff'; g.shadowBlur = 16; g.fillText('LUMEN TAG', 20, 258);
  return c.toDataURL('image/jpeg', 0.85);
}
