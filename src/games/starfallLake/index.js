// Game: Starfall Lake — night skating on a mirror-frozen lake under the aurora.
// Stars fall; skate under them to catch them in your glowing aura before they wink out.
// Every N caught stars completes a constellation (drawn in the sky) for a big bonus.
// 75-second rounds, instant retry, personal best + one-time BB milestones.
// Files: config.js (tunables), audio.js (procedural sfx/pad), ui.js (HUD), this file (scene + loop).
// Perf: no shadows, one Points pool for all sparkles, ≤7 live stars. MP: remotes are drawn by the
// engine; stars/score are purely local.
import * as THREE from 'three';
import { Collision } from '../../engine/collision.js';
import { bus } from '../../core/events.js';
import * as C from './config.js';
import { StarfallAudio } from './audio.js';
import { StarfallUI } from './ui.js';

// ---------- save (public economy API only) ----------
function loadSave(economy) { return { ...C.DEFAULT_SAVE, ...((economy.profile.gameData || {})[C.GAME_ID] || {}) }; }
function persist(economy, save) {
  economy.profile.gameData = { ...(economy.profile.gameData || {}), [C.GAME_ID]: save };
  if (typeof economy.saveGameData === 'function') economy.saveGameData(C.GAME_ID, save);
  else economy.backend?.saveProfile?.(economy.profile);
}

// ---------- shared aurora GLSL (sky + its reflection in the ice) ----------
const AURORA = `
float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float n21(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(h21(i), h21(i+vec2(1,0)), f.x), mix(h21(i+vec2(0,1)), h21(i+vec2(1,1)), f.x), f.y); }
vec3 aurora(vec3 d, float t){
  if (d.y < 0.02) return vec3(0.0);
  vec2 uv = d.xz / (d.y + 0.25);
  vec3 col = vec3(0.0);
  for (int i = 0; i < 3; i++){
    float fi = float(i);
    float band = uv.y * 0.9 + sin(uv.x * (0.9 + fi*0.3) + t*(0.15 + fi*0.05) + fi*2.0) * 0.6 + n21(uv*1.4 + t*0.05 + fi) * 0.5 - 0.6 + fi*0.55;
    float a = exp(-band*band*6.0) * (0.55 + 0.45 * n21(vec2(uv.x*5.0 + t*0.3, fi)));
    col += a * mix(vec3(0.15, 1.0, 0.65), vec3(0.6, 0.35, 1.0), fi / 2.0);
  }
  return col * smoothstep(0.02, 0.25, d.y) * 0.85;
}`;
function skyMaterial() {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false, uniforms: { t: { value: 0 } },
    vertexShader: `varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `uniform float t; varying vec3 vD; ${AURORA}
      void main(){ vec3 d = normalize(vD);
        vec3 col = mix(vec3(0.07,0.09,0.2), vec3(0.01,0.015,0.05), smoothstep(0.0, 0.7, d.y));
        col += vec3(0.25,0.15,0.08) * exp(-max(d.y,0.0)*14.0);            // warm horizon glow (town lanterns)
        vec2 sp = d.xz / (abs(d.y)+0.3) * 60.0; float s = h21(floor(sp));
        float tw = 0.6 + 0.4 * sin(t*3.0 + s*50.0);
        col += vec3(0.9,0.95,1.0) * step(0.985, s) * smoothstep(0.42,0.0,length(fract(sp)-0.5)) * tw * smoothstep(0.0,0.15,d.y);
        col += aurora(d, t);
        gl_FragColor = vec4(col, 1.0); }`,
  });
}
function iceMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { t: { value: 0 }, cam: { value: new THREE.Vector3() }, pl: { value: new THREE.Vector3() }, aura: { value: C.CATCH_R } },
    vertexShader: `varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `uniform float t; uniform vec3 cam; uniform vec3 pl; uniform float aura; varying vec3 vW; ${AURORA}
      void main(){
        vec3 v = normalize(vW - cam);
        // wobbly cracks / scratches perturb the mirror
        float cr = n21(vW.xz*0.6) * 0.06 + n21(vW.xz*3.0) * 0.02;
        vec3 r = normalize(vec3(v.x + cr, -v.y, v.z + cr));
        vec3 col = vec3(0.03,0.06,0.13) + aurora(r, t) * 0.75;
        float fres = pow(1.0 - abs(v.y), 3.0); col += vec3(0.08,0.12,0.2) * fres;
        // frosty scratches + skate glints
        float sc = smoothstep(0.96, 1.0, n21(vW.xz*vec2(9.0,0.7)+vec2(0.0,n21(vW.xz)*4.0)));
        col += sc * 0.08;
        float gl = step(0.996, h21(floor(vW.xz*6.0))) * (0.5+0.5*sin(t*4.0+h21(floor(vW.xz*6.0))*40.0));
        col += vec3(0.7,0.9,1.0) * gl * 0.6;
        // edge frost
        float rr = length(vW.xz); col = mix(col, vec3(0.75,0.85,0.95), smoothstep(${(C.LAKE_R - 3).toFixed(1)}, ${(C.LAKE_R + 2).toFixed(1)}, rr));
        // player aura ring on the ice
        float d = length(vW.xz - pl.xz);
        col += vec3(0.5,1.0,0.9) * (smoothstep(aura, aura-0.12, d) * smoothstep(aura-0.35, aura-0.12, d)) * (0.8 + 0.2*sin(t*6.0));
        col += vec3(0.25,0.6,0.55) * smoothstep(aura, 0.0, d) * 0.18;
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }`,
  });
}
function glowTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,.7)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function starTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.2, 'rgba(255,255,255,.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  g.fillStyle = '#fff'; g.beginPath();
  for (let i = 0; i < 10; i++) { const a = i * Math.PI / 5 - Math.PI / 2, r = i % 2 ? 14 : 40; g.lineTo(64 + Math.cos(a) * r, 64 + Math.sin(a) * r); }
  g.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

// ---------- portal thumbnail ----------
function drawThumb() {
  const c = document.createElement('canvas'); c.width = 480; c.height = 270; const g = c.getContext('2d');
  const bg = g.createLinearGradient(0, 0, 0, 270); bg.addColorStop(0, '#050a22'); bg.addColorStop(0.55, '#14204a'); bg.addColorStop(1, '#0a1430'); g.fillStyle = bg; g.fillRect(0, 0, 480, 270);
  for (let i = 0; i < 3; i++) {   // aurora ribbons
    g.beginPath(); for (let x = 0; x <= 480; x += 8) g.lineTo(x, 60 + i * 26 + Math.sin(x / 60 + i * 2) * 18);
    g.lineWidth = 26 - i * 6; g.strokeStyle = ['rgba(60,255,170,.45)', 'rgba(120,200,255,.35)', 'rgba(180,110,255,.35)'][i]; g.shadowColor = '#5fffc0'; g.shadowBlur = 24; g.stroke();
  }
  g.shadowBlur = 0;
  for (let i = 0; i < 70; i++) { g.fillStyle = `rgba(255,255,255,${0.3 + (i % 5) / 7})`; g.fillRect((i * 97) % 480, (i * 41) % 150, 2, 2); }
  const ice = g.createLinearGradient(0, 170, 0, 270); ice.addColorStop(0, '#2a4c7a'); ice.addColorStop(1, '#0c1a38'); g.fillStyle = ice; g.fillRect(0, 170, 480, 100);
  g.fillStyle = 'rgba(90,255,190,.18)'; g.fillRect(0, 190, 480, 14);
  // pines + warm lanterns
  for (let i = 0; i < 9; i++) { const x = i * 58 + 10; g.fillStyle = '#081226'; g.beginPath(); g.moveTo(x, 172); g.lineTo(x + 16, 118 - (i % 3) * 10); g.lineTo(x + 32, 172); g.fill(); }
  [70, 250, 420].forEach(x => { const lg = g.createRadialGradient(x, 160, 0, x, 160, 30); lg.addColorStop(0, 'rgba(255,190,90,.95)'); lg.addColorStop(1, 'rgba(255,150,40,0)'); g.fillStyle = lg; g.fillRect(x - 30, 130, 60, 60); });
  // falling stars + constellation
  const pts = [[300, 70], [350, 95], [400, 80], [380, 130]]; g.strokeStyle = 'rgba(255,240,170,.8)'; g.lineWidth = 2; g.beginPath(); pts.forEach(p => g.lineTo(...p)); g.stroke();
  pts.forEach(([x, y]) => { g.fillStyle = '#fff6b0'; g.shadowColor = '#ffe680'; g.shadowBlur = 14; g.beginPath(); g.arc(x, y, 5, 0, 7); g.fill(); });
  g.shadowBlur = 0;
  [[140, 40], [200, 90]].forEach(([x, y]) => { const tg = g.createLinearGradient(x - 50, y - 50, x, y); tg.addColorStop(0, 'rgba(255,255,255,0)'); tg.addColorStop(1, 'rgba(255,255,255,.9)'); g.strokeStyle = tg; g.lineWidth = 4; g.beginPath(); g.moveTo(x - 50, y - 50); g.lineTo(x, y); g.stroke(); });
  // skater
  g.fillStyle = '#ffd34d'; g.fillRect(226, 182, 14, 12); g.fillStyle = '#3d7bd9'; g.fillRect(224, 194, 18, 18); g.fillStyle = '#4a9e4a'; g.fillRect(222, 212, 8, 12); g.fillRect(236, 212, 8, 12);
  g.strokeStyle = 'rgba(120,255,220,.7)'; g.lineWidth = 3; g.beginPath(); g.ellipse(233, 228, 26, 7, 0, 0, 7); g.stroke();
  g.font = '900 36px sans-serif'; g.lineWidth = 8; g.strokeStyle = '#06122a'; g.strokeText('STARFALL LAKE', 22, 252);
  const tg = g.createLinearGradient(22, 0, 300, 0); tg.addColorStop(0, '#bff8ff'); tg.addColorStop(1, '#ffe08a'); g.fillStyle = tg; g.fillText('STARFALL LAKE', 22, 252);
  return c.toDataURL('image/jpeg', 0.85);
}

const rand = (a, b) => a + Math.random() * (b - a);
let _thumb = null;
export default {
  id: C.GAME_ID, name: 'Starfall Lake', tagline: 'Skate under the aurora, catch falling stars',
  description: 'Night skating on a mirror-frozen lake. Stars fall from the aurora: glide beneath them to catch them before they wink out, chain combos, and complete constellations for big bursts. 75-second rounds, instant retry, chase your best.',
  get thumbnail() { if (!_thumb) { try { _thumb = drawThumb(); } catch { _thumb = 'frost'; } } return _thumb; },
  music: 'none',
  mobile: true,

  async create(ctx) {
    const { economy, engine, music } = ctx;
    const player = engine.player;
    let save = loadSave(economy);
    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog('#0a1230', 60, 160);
    const camFar = engine.camera.far; engine.camera.far = 1000; engine.camera.updateProjectionMatrix();

    const sky = new THREE.Mesh(new THREE.SphereGeometry(800, 32, 16), skyMaterial()); sky.frustumCulled = false; scene.add(sky);
    scene.add(new THREE.HemisphereLight('#9fc8ff', '#203050', 1.2));
    const moon = new THREE.DirectionalLight('#cfe0ff', 1.0); moon.position.set(-30, 50, -20); scene.add(moon);   // no shadows (SWGL)

    // lake + snowy shore
    const iceMat = iceMaterial();
    const ice = new THREE.Mesh(new THREE.CircleGeometry(C.LAKE_R + 3, 64), iceMat); ice.rotation.x = -Math.PI / 2; scene.add(ice);
    const shore = new THREE.Mesh(new THREE.RingGeometry(C.LAKE_R + 2.5, 140, 64, 1), new THREE.MeshStandardMaterial({ color: '#dfe9f7', roughness: 0.95 }));
    shore.rotation.x = -Math.PI / 2; shore.position.y = 0.02; scene.add(shore);
    // snowbank lip so the lake edge reads
    const bank = new THREE.Mesh(new THREE.TorusGeometry(C.LAKE_R + 3.2, 1.1, 8, 72), new THREE.MeshStandardMaterial({ color: '#eef4ff', roughness: 1 }));
    bank.rotation.x = Math.PI / 2; bank.scale.z = 0.45; scene.add(bank);
    // pines (instanced)
    const PINES = 70;
    const pineMesh = new THREE.InstancedMesh(new THREE.ConeGeometry(1, 1, 7), new THREE.MeshStandardMaterial({ color: '#1d3b38', roughness: 0.9 }), PINES * 2);
    const snowCap = new THREE.InstancedMesh(new THREE.ConeGeometry(1, 1, 7), new THREE.MeshStandardMaterial({ color: '#f4f8ff', roughness: 1 }), PINES);
    const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), S = new THREE.Vector3(), P = new THREE.Vector3();
    for (let i = 0; i < PINES; i++) {
      const a = (i / PINES) * Math.PI * 2 + rand(-0.04, 0.04), d = C.LAKE_R + rand(7, 30), h = rand(5, 11), w = h * 0.33;
      const x = Math.cos(a) * d, z = Math.sin(a) * d;
      M.compose(P.set(x, h / 2, z), Q, S.set(w, h, w)); pineMesh.setMatrixAt(i * 2, M);
      M.compose(P.set(x, h * 0.95, z), Q, S.set(w * 0.6, h * 0.5, w * 0.6)); pineMesh.setMatrixAt(i * 2 + 1, M);
      M.compose(P.set(x, h * 1.08, z), Q, S.set(w * 0.35, h * 0.3, w * 0.35)); snowCap.setMatrixAt(i, M);
    }
    scene.add(pineMesh, snowCap);

    // warm lanterns around the shore (cozy against the cold): emissive boxes + glow sprites, 3 real lights
    const glowTex = glowTexture(), starTex = starTexture();
    const lanterns = new THREE.Group(); scene.add(lanterns);
    const postMat = new THREE.MeshStandardMaterial({ color: '#4a3326', roughness: 0.8 });
    const lampMat = new THREE.MeshBasicMaterial({ color: '#ffc46b', toneMapped: false });
    const lampGlowMat = new THREE.SpriteMaterial({ map: glowTex, color: '#ffae4a', transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending });
    const lampSprites = [];
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 + 0.3, d = C.LAKE_R + 5;
      const g = new THREE.Group(); g.position.set(Math.cos(a) * d, 0, Math.sin(a) * d);
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.25, 2.6, 0.25), postMat); post.position.y = 1.3;
      const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.65, 0.55), lampMat); lamp.position.y = 2.8;
      const sp = new THREE.Sprite(lampGlowMat); sp.scale.setScalar(4); sp.position.y = 2.8; lampSprites.push(sp);
      g.add(post, lamp, sp); lanterns.add(g);
      if (i % 3 === 0) { const l = new THREE.PointLight('#ffa040', 18, 22, 1.6); l.position.y = 2.8; g.add(l); }
    }

    const collision = new Collision({ floorY: 0, bounds: { type: 'circle', r: C.LAKE_R } });

    // ---------- star + sparkle pools ----------
    const stars = [];   // { state:'fall'|'rest', t, x, z, gold, sprite, marker, trail }
    const starGroup = new THREE.Group(); scene.add(starGroup);
    const markerGeo = new THREE.RingGeometry(0.7, 0.95, 28); markerGeo.rotateX(-Math.PI / 2);
    const TRAIL = 10;
    function makeStar() {
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: starTex, color: '#fff6c8', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
      const marker = new THREE.Mesh(markerGeo, new THREE.MeshBasicMaterial({ color: '#bffff0', transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
      const tg = new THREE.BufferGeometry(); tg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(TRAIL * 3), 3));
      const col = new Float32Array(TRAIL * 3); for (let i = 0; i < TRAIL; i++) { const k = 1 - i / TRAIL; col[i * 3] = k; col[i * 3 + 1] = k; col[i * 3 + 2] = k * 0.9; }
      tg.setAttribute('color', new THREE.BufferAttribute(col, 3));
      const trail = new THREE.Line(tg, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
      trail.frustumCulled = false;
      starGroup.add(sprite, marker, trail);
      return { sprite, marker, trail, hist: [] };
    }
    const starPool = Array.from({ length: C.MAX_STARS }, makeStar);
    starPool.forEach(s => { s.sprite.visible = s.marker.visible = s.trail.visible = false; });

    const NP = 260;   // sparkle particles (catch bursts, constellation fireworks, skate frost)
    const pGeo = new THREE.BufferGeometry();
    const pPos = new Float32Array(NP * 3), pCol = new Float32Array(NP * 3);
    pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3)); pGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 3));
    const pts = new THREE.Points(pGeo, new THREE.PointsMaterial({ size: 0.45, map: glowTex, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
    pts.frustumCulled = false; scene.add(pts);
    const parts = Array.from({ length: NP }, () => ({ life: 0, max: 1, p: new THREE.Vector3(), v: new THREE.Vector3(), c: new THREE.Color(), g: 0 }));
    let pNext = 0;
    function burst(x, y, z, n, color, speed = 5, grav = 6, life = 0.9) {
      const base = new THREE.Color(color);
      for (let i = 0; i < n; i++) {
        const q = parts[pNext]; pNext = (pNext + 1) % NP;
        q.p.set(x, y, z); q.v.set(rand(-1, 1), rand(0.2, 1.4), rand(-1, 1)).normalize().multiplyScalar(speed * rand(0.4, 1));
        q.c.copy(base).offsetHSL(rand(-0.05, 0.05), 0, rand(-0.1, 0.15)); q.life = q.max = life * rand(0.6, 1.2); q.g = grav;
      }
    }

    // constellation lines drawn in the sky above the lake
    const conGroup = new THREE.Group(); scene.add(conGroup);
    const constellations = [];   // { line, nodes, t }
    function drawConstellation(points, gold) {
      const SKY_Y = 34, sc = 0.9;
      const v = points.map(p => new THREE.Vector3(p.x * sc, SKY_Y + (p.z * 0.25), p.z * sc - 10));
      const g = new THREE.BufferGeometry().setFromPoints(v);
      const line = new THREE.Line(g, new THREE.LineBasicMaterial({ color: gold ? '#ffd27a' : '#fff1b8', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, fog: false }));
      const nodes = v.map(p => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: starTex, color: '#fff6c8', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, toneMapped: false })); s.position.copy(p); s.scale.setScalar(3); conGroup.add(s); return s; });
      line.frustumCulled = false; conGroup.add(line);
      const c = { line, nodes, t: 0, drawn: 1 }; constellations.push(c);
      v.forEach((p, i) => setTimeout(() => alive && burst(p.x, p.y, p.z, 10, '#fff1b8', 6, 0, 1.4), i * 90));
      g.setDrawRange(0, 1);
      return c;
    }

    // ---------- round state ----------
    const audio = new StarfallAudio(music);
    const ui = new StarfallUI(document.body);
    let alive = true;
    let R = null;      // current round
    let phase = 'count';   // 'count' | 'play' | 'end'
    let countT = 0, lastTick = -1;
    function newRound() {
      R = { score: 0, time: C.ROUND_SECS, combo: 1, comboT: 0, maxCombo: 1, caught: 0, missed: 0, cons: 0,
        conPts: [], conNeed: 3, conName: C.CONSTELLATION_NAMES[0], conIdx: 0, spawnT: 0.6, elapsed: 0 };
      for (const s of stars.splice(0)) hideStar(s);
      for (const c of constellations.splice(0)) { conGroup.remove(c.line); c.line.geometry.dispose(); c.line.material.dispose(); c.nodes.forEach(n => { conGroup.remove(n); n.material.dispose(); }); }
      phase = 'count'; countT = 3; lastTick = -1;
      ui.hideEnd();
      player.teleport(new THREE.Vector3(0, 0, 10), Math.PI);
      glide.set(0, 0, 0);
    }
    function hideStar(s) { s.sprite.visible = s.marker.visible = s.trail.visible = false; starPool.push(s); }
    function spawnStar() {
      const s = starPool.pop(); if (!s) return;
      // land somewhere reachable: biased toward but not on the player, inside the lake
      let x, z;
      for (let k = 0; k < 10; k++) {
        const a = rand(0, Math.PI * 2), d = rand(4, 16 + Math.min(10, R.elapsed / 5));
        x = player.pos.x + Math.cos(a) * d; z = player.pos.z + Math.sin(a) * d;
        if (Math.hypot(x, z) < C.LAKE_R - 2) break;
        x = rand(-0.6, 0.6) * C.LAKE_R; z = rand(-0.6, 0.6) * C.LAKE_R;
      }
      s.x = x; s.z = z; s.t = 0; s.state = 'fall'; s.gold = Math.random() < C.GOLD_CHANCE;
      s.sx = x + rand(-14, 14); s.sz = z + rand(-14, 14); s.sy = 38;
      s.sprite.material.color.set(s.gold ? '#ffd24a' : '#fff6c8'); s.marker.material.color.set(s.gold ? '#ffd24a' : '#bffff0');
      s.sprite.visible = s.marker.visible = s.trail.visible = true; s.hist.length = 0;
      s.marker.position.set(x, 0.04, z);
      stars.push(s);
    }
    const catchR = () => C.CATCH_R + (R ? (R.combo - 1) * 0.12 : 0);
    function catchStar(s) {
      const pts = s.gold ? 3 : 1;
      R.combo = Math.min(C.MAX_COMBO, R.comboT > 0 ? R.combo + 1 : 1);
      R.maxCombo = Math.max(R.maxCombo, R.combo);
      R.comboT = C.COMBO_WINDOW + (s.gold ? 1.5 : 0);
      const gain = C.STAR_POINTS * pts * R.combo; R.score += gain; R.caught++;
      const y = s.sprite.position.y;
      burst(s.sprite.position.x, y, s.z, s.gold ? 34 : 20, s.gold ? '#ffd24a' : '#bffff0', 5, 7, 0.8);
      burst(s.sprite.position.x, y, s.z, 8, '#ffb35a', 2.5, 2, 1.0);   // warm inner pop
      audio.sfx(s.gold ? 'gold' : 'catch', R.combo);
      punch = 1;
      if (s.gold) ui.banner('✨ Golden star!', `+${gain}`, 900);
      R.conPts.push(new THREE.Vector3(s.x, 0, s.z));
      if (R.conPts.length >= R.conNeed) completeConstellation();
      stars.splice(stars.indexOf(s), 1); hideStar(s);
    }
    function completeConstellation() {
      const n = R.conPts.length, bonus = 150 * n * R.combo;
      R.score += bonus; R.cons++; save.constellations = (save.constellations || 0) + 1;
      drawConstellation(R.conPts, R.combo >= 4);
      ui.banner(`✦ ${R.conName} ✦`, `Constellation! +${bonus.toLocaleString()}`, 1600); ui.flash();
      audio.sfx('constellation', n);
      burst(player.pos.x, 1.5, player.pos.z, 40, '#cfffee', 8, 5, 1.2);
      R.comboT = Math.max(R.comboT, C.COMBO_WINDOW);   // reward: refresh combo window
      R.conIdx++; R.conName = C.CONSTELLATION_NAMES[R.conIdx % C.CONSTELLATION_NAMES.length];
      R.conNeed = Math.min(5, 3 + Math.floor(R.conIdx / 2)); R.conPts = [];
    }
    function endRound() {
      phase = 'end';
      for (const s of stars.splice(0)) hideStar(s);
      const newBest = R.score > (save.best || 0);
      save = { ...save, best: Math.max(save.best || 0, R.score), rounds: (save.rounds || 0) + 1 };
      const rewards = [];
      for (const m of C.MILESTONES) {
        if (save.milestones.includes(m.id) || !m.test(R, save)) continue;
        save = { ...save, milestones: [...save.milestones, m.id] };
        try { economy.earn(m.bb, `Starfall Lake: ${m.label}`, { source: 'Starfall Lake' }); } catch {}
        rewards.push(m);
      }
      persist(economy, save);
      audio.sfx(newBest ? 'best' : 'end');
      if (newBest) burst(player.pos.x, 2, player.pos.z, 60, '#ffd24a', 9, 5, 1.5);
      ui.showEnd({ ...R, best: save.best, newBest, rewards }, () => newRound());
    }

    // ---------- skating feel: ice momentum layered over engine movement ----------
    const glide = new THREE.Vector3(), prev = new THREE.Vector3(), tmp = new THREE.Vector3();
    let punch = 0, frostT = 0;
    const baseSpeed = player.mods.speed; player.mods.speed = baseSpeed * 1.35;
    const camDist0 = player.camDist;
    let rPrev = false, spPrev = false;

    newRound(); prev.copy(player.pos);
    const game = {
      scene, collision, spawn: new THREE.Vector3(0, 0, 10), spawnFacing: Math.PI, music: 'none', maxCamDist: 22,
      starfall: { get state() { return { phase, ...(R || {}) }; }, restart: () => newRound(),
        stars: () => stars.map(s => ({ x: s.sprite.position.x, y: s.sprite.position.y, z: s.z, state: s.state })),
        skipCountdown: () => { countT = 0; }, setTime: (v) => { if (R) R.time = v; } },   // test hooks
      update(dt, t, pl) {
        if (!audio.pad) audio.start();
        sky.material.uniforms.t.value = t; iceMat.uniforms.t.value = t;
        iceMat.uniforms.cam.value.copy(engine.camera.position); iceMat.uniforms.pl.value.copy(pl.pos);
        sky.position.copy(engine.camera.position);
        lampSprites.forEach((s, i) => { s.material.opacity = 0.7 + Math.sin(t * 3 + i) * 0.08; });

        // glide: intended move this frame becomes momentum that coasts after you let go
        tmp.subVectors(pl.pos, prev); tmp.y = 0;
        if (dt > 0 && dt < 0.1) {
          const intended = tmp.clone().divideScalar(dt);
          glide.lerp(intended, 1 - Math.exp(-2.5 * dt));
          if (intended.lengthSq() < 0.5) glide.multiplyScalar(Math.exp(-1.1 * dt));
          pl.pos.addScaledVector(glide, dt * 0.55);
          const r = Math.hypot(pl.pos.x, pl.pos.z);
          if (r > C.LAKE_R - 0.5) { const k = (C.LAKE_R - 0.5) / r; pl.pos.x *= k; pl.pos.z *= k; glide.multiplyScalar(-0.4); }
          // frost spray while skating fast
          frostT -= dt;
          if (glide.length() > 6 && frostT <= 0 && pl.onGround) { frostT = 0.06; burst(pl.pos.x, 0.15, pl.pos.z, 2, '#dff4ff', 1.5, 3, 0.5); }
        }
        prev.copy(pl.pos);

        // sparkles
        for (let i = 0; i < NP; i++) {
          const q = parts[i];
          if (q.life > 0) { q.life -= dt; q.v.y -= q.g * dt; q.v.multiplyScalar(Math.exp(-1.5 * dt)); q.p.addScaledVector(q.v, dt); if (q.p.y < 0.05) { q.p.y = 0.05; q.v.y *= -0.3; } }
          const k = Math.max(0, q.life / q.max);
          pPos[i * 3] = q.p.x; pPos[i * 3 + 1] = q.life > 0 ? q.p.y : -99; pPos[i * 3 + 2] = q.p.z;
          pCol[i * 3] = q.c.r * k; pCol[i * 3 + 1] = q.c.g * k; pCol[i * 3 + 2] = q.c.b * k;
        }
        pGeo.attributes.position.needsUpdate = true; pGeo.attributes.color.needsUpdate = true;

        // constellations: draw lines node by node, then slowly fade
        for (let i = constellations.length - 1; i >= 0; i--) {
          const c = constellations[i]; c.t += dt;
          const n = c.nodes.length, shown = Math.min(n, 1 + Math.floor(c.t / 0.09));
          c.line.geometry.setDrawRange(0, shown);
          const fade = c.t < 8 ? Math.min(1, c.t * 2) : Math.max(0.25, 1 - (c.t - 8) / 6);   // older ones linger dimly
          c.line.material.opacity = fade * 0.9;
          c.nodes.forEach((s, j) => { s.material.opacity = j < shown ? fade : 0; s.scale.setScalar(3 + Math.sin(t * 3 + j) * 0.4 + Math.max(0, 1 - c.t) * 3); });
        }

        // aura punch on catch (scale pulse)
        punch = Math.max(0, punch - dt * 4);
        iceMat.uniforms.aura.value = catchR() * (1 + punch * 0.35);

        // restart key (edge)
        const rDown = engine.input.down('KeyR'), spDown = engine.input.down('Space');
        if (rDown && !rPrev) newRound();
        if (phase === 'end' && spDown && !spPrev) newRound();
        rPrev = rDown; spPrev = spDown;

        if (phase === 'count') {
          countT -= dt; const n = Math.ceil(countT);
          if (n !== lastTick && n > 0) { lastTick = n; ui.banner(String(n), 'get ready to skate', 700); audio.sfx('tick', 0); }
          if (countT <= 0) { phase = 'play'; ui.banner('Catch the stars!', '', 900); audio.sfx('tick', 1); }
        } else if (phase === 'play') {
          R.time -= dt; R.elapsed += dt;
          if (R.time <= 5 && Math.ceil(R.time) !== lastTick) { lastTick = Math.ceil(R.time); if (lastTick > 0) audio.sfx('tick', 0); }
          R.comboT -= dt; if (R.comboT <= 0 && R.combo > 1) { R.combo = 1; }
          // spawn faster as the night goes on (and in the final 15s: meteor shower)
          R.spawnT -= dt;
          const rate = R.time < 15 ? 0.45 : Math.max(0.7, 1.3 - R.elapsed / 90);
          if (R.spawnT <= 0) { R.spawnT = rate * rand(0.8, 1.2); spawnStar(); }
          if (R.time <= 15 && R.time + dt > 15) ui.banner('☄ Meteor shower!', 'stars fall faster', 1200);
          if (R.time <= 0) { endRound(); }
        }

        // stars
        const cr = catchR();
        for (let i = stars.length - 1; i >= 0; i--) {
          const s = stars[i]; s.t += dt;
          let x = s.x, y = 1.1, z = s.z;
          if (s.state === 'fall') {
            const k = Math.min(1, s.t / C.FALL_SECS), e = k * k;
            x = s.sx + (s.x - s.sx) * k; z = s.sz + (s.z - s.sz) * k; y = s.sy + (1.1 - s.sy) * e;
            s.sprite.scale.setScalar(1.2 + k * 0.6);
            s.marker.material.opacity = 0.2 + k * 0.6; s.marker.scale.setScalar(1.8 - k * 0.8);
            if (k >= 1) { s.state = 'rest'; s.t = 0; burst(x, 0.3, z, 10, s.gold ? '#ffd24a' : '#bffff0', 3, 4, 0.6); }
          } else {
            const life = s.t / C.REST_SECS, blink = life > 0.7 ? (Math.floor(s.t * 10) % 2 ? 0.35 : 1) : 1;
            y = 1.1 + Math.sin(s.t * 4) * 0.12;
            s.sprite.scale.setScalar((1.8 + Math.sin(s.t * 6) * 0.15) * blink);
            s.marker.material.opacity = 0.7 * blink; s.marker.scale.setScalar(1 + Math.sin(s.t * 5) * 0.08);
            if (life >= 1) { // wink out
              burst(x, y, z, 6, '#7f9fff', 1.5, -0.5, 0.8); audio.sfx('wink');
              R.missed++; R.combo = Math.max(1, Math.floor(R.combo / 2));
              stars.splice(i, 1); hideStar(s); continue;
            }
          }
          s.sprite.position.set(x, y, z);
          s.hist.unshift(x, y, z); if (s.hist.length > TRAIL * 3) s.hist.length = TRAIL * 3;
          const arr = s.trail.geometry.attributes.position.array;
          for (let j = 0; j < TRAIL * 3; j++) arr[j] = s.hist[j] ?? s.hist[j % 3];
          s.trail.geometry.attributes.position.needsUpdate = true;
          s.trail.visible = s.state === 'fall';
          if (phase === 'play' && y < 3.2 && Math.hypot(x - pl.pos.x, z - pl.pos.z) < cr) catchStar(s);
        }

        if (R) ui.hud({ score: R.score, time: phase === 'count' ? C.ROUND_SECS : R.time, combo: R.combo, comboFrac: Math.max(0, R.comboT / C.COMBO_WINDOW), conName: R.conName, conGot: R.conPts.length, conNeed: R.conNeed });
      },
      dispose() {
        alive = false; audio.stop(); ui.dispose();
        player.mods.speed = baseSpeed; player.camDist = camDist0;
        engine.camera.far = camFar; engine.camera.updateProjectionMatrix();
        persist(economy, save);
        scene.traverse(o => { o.geometry?.dispose?.(); const m = o.material; (Array.isArray(m) ? m : m ? [m] : []).forEach(x => x.dispose()); });
        glowTex.dispose(); starTex.dispose();
      },
    };
    void bus;
    return game;
  },
};
