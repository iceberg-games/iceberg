// Knockout Floes arena: aurora sky, dark rippling water, the floe ring (crack -> sink), ripples, thumbnail.
import * as THREE from 'three';
import * as C from './config.js';

const AURORA = `
float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float n21(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(h21(i), h21(i+vec2(1,0)), f.x), mix(h21(i+vec2(0,1)), h21(i+vec2(1,1)), f.x), f.y); }
vec3 aurora(vec3 d, float t){
  if (d.y < 0.02) return vec3(0.0);
  vec2 uv = d.xz / (d.y + 0.25); vec3 col = vec3(0.0);
  for (int i = 0; i < 3; i++){ float fi = float(i);
    float band = uv.y * 0.9 + sin(uv.x * (0.9 + fi*0.3) + t*(0.15 + fi*0.05) + fi*2.0) * 0.6 + n21(uv*1.4 + t*0.05 + fi) * 0.5 - 0.6 + fi*0.55;
    col += exp(-band*band*6.0) * (0.55 + 0.45 * n21(vec2(uv.x*5.0 + t*0.3, fi))) * mix(vec3(0.15, 1.0, 0.65), vec3(0.6, 0.35, 1.0), fi / 2.0); }
  return col * smoothstep(0.02, 0.25, d.y) * 0.9;
}`;
const rand = (a, b) => a + Math.random() * (b - a);

export function glowTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.3, 'rgba(255,255,255,.6)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export function buildArena() {
  const scene = new THREE.Scene(); scene.fog = new THREE.Fog('#0a1230', 50, 170);
  const sky = new THREE.Mesh(new THREE.SphereGeometry(800, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false, uniforms: { t: { value: 0 } },
    vertexShader: `varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `uniform float t; varying vec3 vD; ${AURORA}
      void main(){ vec3 d = normalize(vD); vec3 col = mix(vec3(0.07,0.09,0.2), vec3(0.01,0.015,0.05), smoothstep(0.0, 0.7, d.y));
        vec2 sp = d.xz / (abs(d.y)+0.3) * 60.0; float s = h21(floor(sp));
        col += vec3(0.9,0.95,1.0) * step(0.985, s) * smoothstep(0.42,0.0,length(fract(sp)-0.5)) * (0.6+0.4*sin(t*3.0+s*50.0)) * smoothstep(0.0,0.15,d.y);
        col += aurora(d, t); gl_FragColor = vec4(col, 1.0); }`,
  }));
  sky.frustumCulled = false; scene.add(sky);
  scene.add(new THREE.HemisphereLight('#a8d0ff', '#1a2a48', 1.3));
  const moon = new THREE.DirectionalLight('#d6e6ff', 1.3); moon.position.set(-30, 50, -20); scene.add(moon);
  const rim = new THREE.DirectionalLight('#7fffd0', 0.5); rim.position.set(20, 15, 30); scene.add(rim);

  const water = new THREE.Mesh(new THREE.PlaneGeometry(600, 600, 1, 1), new THREE.ShaderMaterial({
    uniforms: { t: { value: 0 }, cam: { value: new THREE.Vector3() } },
    vertexShader: `varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `uniform float t; uniform vec3 cam; varying vec3 vW; ${AURORA}
      void main(){ vec3 v = normalize(vW - cam);
        vec2 q = vW.xz * 0.35; float w1 = n21(q + vec2(t*0.3, t*0.2)) + n21(q*2.3 - vec2(t*0.25, -t*0.4)) * 0.5;
        vec3 r = normalize(vec3(v.x + (w1-0.75)*0.12, -v.y, v.z + (w1-0.75)*0.12));
        vec3 col = vec3(0.01,0.03,0.07) + aurora(r, t) * 0.55 + vec3(0.05,0.1,0.16) * pow(1.0 - abs(v.y), 4.0);
        col += vec3(0.6,0.8,1.0) * step(0.93, n21(vW.xz*1.8 + t*0.6)) * 0.12;
        float d = length(vW.xz); col += vec3(0.1,0.35,0.4) * smoothstep(17.0, 9.0, d) * 0.25;   // glow under the floes
        gl_FragColor = vec4(col, 1.0);
        #include <fog_fragment>
        #include <colorspace_fragment>
      }`,
  }));
  water.material.fog = false;
  water.rotation.x = -Math.PI / 2; water.position.y = -0.55; scene.add(water);

  // distant icebergs (instanced) + drifting chunks
  const bergs = new THREE.InstancedMesh(new THREE.ConeGeometry(1, 1, 5), new THREE.MeshStandardMaterial({ color: '#cfe6ff', roughness: 0.6, flatShading: true }), 26);
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), S = new THREE.Vector3(), P = new THREE.Vector3(), E = new THREE.Euler();
  for (let i = 0; i < 26; i++) { const a = i / 26 * Math.PI * 2 + rand(-0.1, 0.1), d = rand(60, 120), h = rand(6, 22);
    M.compose(P.set(Math.cos(a) * d, h / 2 - 1, Math.sin(a) * d), Q.setFromEuler(E.set(0, rand(0, 6), 0)), S.set(h * rand(0.6, 1.2), h, h * rand(0.6, 1.2))); bergs.setMatrixAt(i, M); }
  scene.add(bergs);
  const chunkMat = new THREE.MeshStandardMaterial({ color: '#e6f3ff', roughness: 0.7, flatShading: true });
  const chunks = Array.from({ length: 14 }, () => { const m = new THREE.Mesh(new THREE.DodecahedronGeometry(rand(0.4, 1.1), 0), chunkMat); const a = rand(0, 6.28), d = rand(19, 40);
    m.position.set(Math.cos(a) * d, -0.5, Math.sin(a) * d); m.scale.y = 0.4; m.userData = { a, d, s: rand(0.01, 0.03), p: rand(0, 6) }; scene.add(m); return m; });

  // ---- floes ----
  const topMat = new THREE.MeshStandardMaterial({ color: '#f4f9ff', roughness: 0.85 });
  const crackMat = () => new THREE.LineBasicMaterial({ color: '#1b4f8a', transparent: true, opacity: 0, depthWrite: false });
  const floes = [];
  function makeFloe(x, z, r, center) {
    const geo = new THREE.CylinderGeometry(r, r * 0.82, 1.4, 12, 1);
    const pos = geo.attributes.position, seed = rand(0, 10);
    for (let i = 0; i < pos.count; i++) { const px = pos.getX(i), pz = pos.getZ(i), a = Math.atan2(pz, px), k = 1 + Math.sin(a * 3 + seed) * 0.05 + Math.sin(a * 5 + seed * 2) * 0.03; pos.setX(i, px * k); pos.setZ(i, pz * k); }
    geo.translate(0, -0.7, 0); geo.computeVertexNormals();
    const sideMat = new THREE.MeshStandardMaterial({ color: '#8fd3ff', roughness: 0.35, emissive: '#1d5f8a', emissiveIntensity: 0.35 });
    const myTop = topMat.clone();
    const mesh = new THREE.Mesh(geo, [sideMat, myTop, sideMat]);
    const group = new THREE.Group(); group.add(mesh);
    // snow lumps
    for (let i = 0; i < 3; i++) { const l = new THREE.Mesh(new THREE.SphereGeometry(rand(0.3, 0.6), 8, 6), topMat); const a = rand(0, 6.28), d = rand(0.5, r * 0.75); l.position.set(Math.cos(a) * d, 0, Math.sin(a) * d); l.scale.y = 0.4; group.add(l); }
    // crack lines radiating from a point
    const pts = []; for (let k = 0; k < 6; k++) { let a = rand(0, 6.28), px = rand(-0.5, 0.5), pz = rand(-0.5, 0.5); for (let s = 0; s < 5; s++) { const nx = px + Math.cos(a) * r * 0.2, nz = pz + Math.sin(a) * r * 0.2; pts.push(new THREE.Vector3(px, 0.03, pz), new THREE.Vector3(nx, 0.03, nz)); px = nx; pz = nz; a += rand(-0.6, 0.6); } }
    const cracks = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), crackMat()); group.add(cracks);
    group.position.set(x, 0, z); scene.add(group);
    const f = { x, z, r0: r, center, scale: 1, target: 1, state: 'ok', t: 0, y: 0, gone: false, group, cracks, sideMat, top: myTop, phase: rand(0, 6) };
    floes.push(f); return f;
  }
  makeFloe(0, 0, C.CENTER_R, true);
  for (let i = 0; i < C.RING_N; i++) { const a = i / C.RING_N * Math.PI * 2; makeFloe(Math.cos(a) * C.RING_R, Math.sin(a) * C.RING_R, C.RING_FLOE_R, false); }

  // ripples
  const ripGeo = new THREE.RingGeometry(0.8, 1, 32); ripGeo.rotateX(-Math.PI / 2);
  const ripples = Array.from({ length: 10 }, () => { const m = new THREE.Mesh(ripGeo, new THREE.MeshBasicMaterial({ color: '#bfefff', transparent: true, opacity: 0, depthWrite: false })); m.position.y = -0.5; scene.add(m); return { m, t: 1, s: 1 }; });
  let rip = 0;

  const glowTex = glowTexture();
  return {
    scene, floes, glowTex,
    reset() { for (const f of floes) { f.state = 'ok'; f.t = 0; f.y = 0; f.gone = false; f.scale = f.target = 1; f.group.visible = true; f.group.position.set(f.x, 0, f.z); f.group.rotation.set(0, 0, 0); f.group.scale.set(1, 1, 1); f.cracks.material.opacity = 0; f.top.color.set('#f4f9ff'); } },
    crack(f) { f.state = 'crack'; f.t = 0; },
    erode(frac) {
      for (const f of floes) {
        if (f.center) f.target = frac < 0.6 ? 1 : Math.max(0.45, 1 - (frac - 0.6) / 0.32 * 0.55);
        else f.target = 1 - (1 - C.SHRINK_TO) * Math.min(1, frac / 0.6);
      }
    },
    ripple(x, z, s = 1) { const r = ripples[rip++ % ripples.length]; r.m.position.x = x; r.m.position.z = z; r.t = 0; r.s = s; },
    stepFloe(f, dt) {
      if (f.gone) return null;
      f.scale += (f.target - f.scale) * Math.min(1, dt * 1.5); f.group.scale.set(f.scale, 1, f.scale);
      if (f.state === 'crack') {
        f.t += dt; const k = f.t / C.CRACK_SECS, j = 0.04 + k * 0.12;
        f.group.position.set(f.x + rand(-j, j), rand(-j, j) * 0.5, f.z + rand(-j, j));
        f.cracks.material.opacity = Math.min(1, k * 1.4);
        f.top.color.setRGB(0.96 - k * 0.3, 0.97 - k * 0.2, 1);
        f.sideMat.emissiveIntensity = 0.35 + Math.sin(f.t * 18) * 0.25 * k;
        if (k >= 1) { f.state = 'sink'; f.t = 0; this.ripple(f.x, f.z, f.r0 * 0.8); return 'sink'; }
      } else if (f.state === 'sink') {
        f.t += dt; f.y = -f.t * f.t * 1.6 - f.t * 0.6; f.group.position.set(f.x, f.y, f.z); f.group.rotation.x = f.t * 0.25; f.group.rotation.z = -f.t * 0.18;
        if (f.y < -3) { f.gone = true; f.group.visible = false; }
      } else { f.group.rotation.x = Math.sin(performance.now() / 900 + f.phase) * 0.012; f.group.rotation.z = Math.cos(performance.now() / 1100 + f.phase) * 0.012; }
      return null;
    },
    update(dt, t, cam) {
      sky.material.uniforms.t.value = t; water.material.uniforms.t.value = t; water.material.uniforms.cam.value.copy(cam.position); sky.position.copy(cam.position);
      for (const r of ripples) { if (r.t >= 1) continue; r.t += dt * 0.9; r.m.scale.setScalar(r.s * (0.5 + r.t * 4)); r.m.material.opacity = (1 - r.t) * 0.7; }
      for (const c of chunks) { const u = c.userData; u.a += u.s * dt; c.position.set(Math.cos(u.a) * u.d, -0.5 + Math.sin(t + u.p) * 0.06, Math.sin(u.a) * u.d); c.rotation.y += dt * 0.1; }
    },
  };
}

export function drawThumb() {
  const c = document.createElement('canvas'); c.width = 480; c.height = 270; const g = c.getContext('2d');
  const bg = g.createLinearGradient(0, 0, 0, 270); bg.addColorStop(0, '#050a22'); bg.addColorStop(0.6, '#16234f'); bg.addColorStop(1, '#040a1c'); g.fillStyle = bg; g.fillRect(0, 0, 480, 270);
  for (let i = 0; i < 3; i++) { g.beginPath(); for (let x = 0; x <= 480; x += 8) g.lineTo(x, 50 + i * 24 + Math.sin(x / 55 + i * 2) * 16);
    g.lineWidth = 24 - i * 6; g.strokeStyle = ['rgba(60,255,170,.45)', 'rgba(120,200,255,.35)', 'rgba(180,110,255,.35)'][i]; g.shadowColor = '#5fffc0'; g.shadowBlur = 22; g.stroke(); }
  g.shadowBlur = 0; for (let i = 0; i < 60; i++) { g.fillStyle = `rgba(255,255,255,${0.3 + (i % 5) / 7})`; g.fillRect((i * 97) % 480, (i * 41) % 130, 2, 2); }
  g.fillStyle = '#06142e'; g.fillRect(0, 150, 480, 120);
  const floe = (x, y, w, crack) => { g.fillStyle = '#5fb8ee'; g.beginPath(); g.ellipse(x, y + 8, w, w * 0.32, 0, 0, 7); g.fill(); g.fillStyle = '#f4f9ff'; g.beginPath(); g.ellipse(x, y, w, w * 0.3, 0, 0, 7); g.fill();
    if (crack) { g.strokeStyle = '#1b4f8a'; g.lineWidth = 2; g.beginPath(); g.moveTo(x - w * 0.6, y - 3); g.lineTo(x - w * 0.2, y + 4); g.lineTo(x + w * 0.1, y - 4); g.lineTo(x + w * 0.5, y + 3); g.stroke(); } };
  floe(240, 200, 110); floe(70, 175, 55, true); floe(410, 178, 60); floe(110, 240, 50); floe(400, 245, 48, true);
  const kid = (x, y, col, s = 1) => { g.fillStyle = '#ffd34d'; g.fillRect(x - 6 * s, y - 34 * s, 12 * s, 11 * s); g.fillStyle = col; g.fillRect(x - 8 * s, y - 23 * s, 16 * s, 15 * s); g.fillRect(x - 7 * s, y - 40 * s, 14 * s, 6 * s); g.fillStyle = '#2d3a5a'; g.fillRect(x - 7 * s, y - 8 * s, 6 * s, 9 * s); g.fillRect(x + 1 * s, y - 8 * s, 6 * s, 9 * s); };
  kid(200, 205, '#3d7bd9', 1.4); kid(300, 200, '#ff5d73', 1.3);
  // snowball + impact
  g.fillStyle = '#fff'; g.shadowColor = '#bff'; g.shadowBlur = 14; g.beginPath(); g.arc(262, 160, 7, 0, 7); g.fill(); g.shadowBlur = 0;
  g.strokeStyle = 'rgba(255,255,255,.6)'; g.lineWidth = 3; g.beginPath(); g.moveTo(215, 170); g.quadraticCurveTo(240, 150, 258, 160); g.stroke();
  g.font = '900 22px sans-serif'; g.fillStyle = '#fff36b'; g.strokeStyle = '#3a1a00'; g.lineWidth = 5; g.strokeText('BONK!', 318, 150); g.fillText('BONK!', 318, 150);
  kid(410, 150, '#5be37d', 1); g.fillStyle = 'rgba(190,240,255,.8)'; for (let i = 0; i < 8; i++) { g.beginPath(); g.arc(440 + i * 4, 225 - (i % 3) * 8, 3, 0, 7); g.fill(); }
  g.font = '900 38px sans-serif'; g.lineWidth = 8; g.strokeStyle = '#06122a'; g.strokeText('KNOCKOUT FLOES', 20, 262);
  const tg = g.createLinearGradient(20, 0, 340, 0); tg.addColorStop(0, '#bff8ff'); tg.addColorStop(1, '#ffe08a'); g.fillStyle = tg; g.fillText('KNOCKOUT FLOES', 20, 262);
  return c.toDataURL('image/jpeg', 0.85);
}
