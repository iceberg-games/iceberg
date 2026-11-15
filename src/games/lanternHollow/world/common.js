// Shared Lantern Hollow world helpers: materials, aurora sky dome, starfield, snowfall, ember particles.
import * as THREE from 'three';

export const PALETTE = { amber: '#ffb347', ember: '#ff7a3d', night: '#0b1030', snow: '#eef3ff', wood: '#6b4a32', woodDark: '#4a3222', stone: '#8a8fa3', roof: '#3d4a6b' };

export function makeMats() {
  const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...o });
  return {
    snow: std('#e9eefc', { roughness: 0.95 }), snowCap: std('#f6f9ff', { roughness: 0.9 }),
    wood: std(PALETTE.wood), woodDark: std(PALETTE.woodDark), plank: std('#8a6444'),
    stone: std(PALETTE.stone, { roughness: 0.9, flatShading: true }), stoneDark: std('#5e6378', { roughness: 0.9, flatShading: true }),
    roof: std(PALETTE.roof, { roughness: 0.7 }), roofRed: std('#6b3b44', { roughness: 0.7 }), roofGreen: std('#2f5249', { roughness: 0.7 }),
    pine: std('#1f4a3f', { roughness: 0.9, flatShading: true }), pineDark: std('#173a33', { roughness: 0.9, flatShading: true }), trunk: std('#4b3324'),
    iron: std('#3b3f4a', { roughness: 0.45, metalness: 0.7 }), brass: std('#c79a4a', { roughness: 0.35, metalness: 0.8 }),
    window: new THREE.MeshStandardMaterial({ color: '#ffcf7a', emissive: '#ffae42', emissiveIntensity: 1.6, roughness: 0.4 }),
    flame: new THREE.MeshBasicMaterial({ color: '#ffd27a', toneMapped: false }), flameCore: new THREE.MeshBasicMaterial({ color: '#fff3c4', toneMapped: false }),
    ice: std('#bfe6ff', { roughness: 0.15, metalness: 0.05, transparent: true, opacity: 0.85 }),
    rune: new THREE.MeshStandardMaterial({ color: '#6fe3ff', emissive: '#3fc8ff', emissiveIntensity: 1.4, roughness: 0.3 }),
    cloth: std('#7a3f5a'), cloth2: std('#3f5a7a'), paper: std('#efe3c4', { roughness: 0.95 }),
  };
}

/** Sky dome with animated aurora ribbons + stars. Returns { mesh, update(t) }. */
export function makeAuroraSky({ top = '#050818', horizon = '#1b2a55', strength = 1 } = {}) {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { uTime: { value: 0 }, uTop: { value: new THREE.Color(top) }, uHor: { value: new THREE.Color(horizon) }, uStr: { value: strength } },
    vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `
      varying vec3 vDir; uniform float uTime; uniform vec3 uTop; uniform vec3 uHor; uniform float uStr;
      float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
      float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x), f.y); }
      void main(){
        float y = clamp(vDir.y, 0.0, 1.0);
        vec3 col = mix(uHor, uTop, pow(y, 0.55));
        vec2 sp = vDir.xz / max(0.15, vDir.y + 0.35);
        float a = 0.0;
        for (int i = 0; i < 3; i++) { float fi = float(i);
          float wave = sin(sp.x * (0.9 + fi * 0.35) + uTime * (0.12 + fi * 0.05) + fi * 2.1) * 0.6 + n(sp * 0.8 + vec2(uTime * 0.05, fi)) * 0.9;
          float band = exp(-pow((sp.y + 1.2 - fi * 0.9 - wave) * 1.6, 2.0));
          float rays = 0.55 + 0.45 * n(vec2(sp.x * 6.0 + fi * 7.0, uTime * 0.3));
          a += band * rays * (0.9 - fi * 0.2); }
        a *= smoothstep(0.05, 0.35, y) * uStr;
        vec3 aur = mix(vec3(0.15, 1.0, 0.65), vec3(0.75, 0.35, 1.0), clamp(y * 1.3 - 0.2, 0.0, 1.0));
        col += aur * a * 0.55;
        float st = step(0.9975, h(floor(vDir.xz / max(0.05, vDir.y) * 140.0))) * smoothstep(0.1, 0.5, y);
        col += vec3(st) * (0.6 + 0.4 * sin(uTime * 3.0 + h(floor(vDir.xz * 300.0)) * 6.28));
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(450, 32, 16), mat); mesh.renderOrder = -10; mesh.frustumCulled = false;
  return { mesh, update(t, center) { mat.uniforms.uTime.value = t; if (center) mesh.position.set(center.x, 0, center.z); } };
}

/** Gentle snowfall around a moving center. */
export function makeSnow(count = 900, size = 60) {
  const geo = new THREE.BufferGeometry(), pos = new Float32Array(count * 3), spd = new Float32Array(count);
  for (let i = 0; i < count; i++) { pos[i * 3] = (Math.random() - 0.5) * size; pos[i * 3 + 1] = Math.random() * 30; pos[i * 3 + 2] = (Math.random() - 0.5) * size; spd[i] = 0.6 + Math.random() * 0.9; }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({ color: '#ffffff', size: 0.12, transparent: true, opacity: 0.8, depthWrite: false }));
  pts.frustumCulled = false;
  return { points: pts, update(dt, t, center) {
    pts.position.set(center.x, 0, center.z);
    for (let i = 0; i < count; i++) { pos[i * 3 + 1] -= spd[i] * dt; pos[i * 3] += Math.sin(t * 0.7 + i) * 0.15 * dt; if (pos[i * 3 + 1] < 0) pos[i * 3 + 1] = 30; }
    geo.attributes.position.needsUpdate = true; } };
}

/** Rising embers above a fire. */
export function makeEmbers(at, count = 60, spread = 1.2) {
  const geo = new THREE.BufferGeometry(), pos = new Float32Array(count * 3), life = new Float32Array(count);
  const reset = (i) => { pos[i * 3] = at.x + (Math.random() - 0.5) * spread; pos[i * 3 + 1] = at.y; pos[i * 3 + 2] = at.z + (Math.random() - 0.5) * spread; life[i] = Math.random() * 2.5; };
  for (let i = 0; i < count; i++) reset(i);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({ color: '#ffb347', size: 0.14, transparent: true, opacity: 0.95, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
  pts.frustumCulled = false;
  return { points: pts, update(dt, t) { for (let i = 0; i < count; i++) { life[i] -= dt; pos[i * 3 + 1] += dt * (1.2 + (i % 5) * 0.25); pos[i * 3] += Math.sin(t * 2 + i) * dt * 0.3; if (life[i] <= 0) reset(i); } geo.attributes.position.needsUpdate = true; } };
}

/** Lantern prop (used by the player, NPCs, lamp posts). Returns a Group with userData.flame. */
export function makeLantern(mats, scale = 1) {
  const g = new THREE.Group();
  const frame = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.04, 8), mats.brass); frame.position.y = -0.14; g.add(frame);
  const cap = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.1, 8), mats.brass); cap.position.y = 0.14; g.add(cap);
  const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.24, 8, 1, true), new THREE.MeshStandardMaterial({ color: '#ffe2a8', emissive: '#ffa53a', emissiveIntensity: 1.8, transparent: true, opacity: 0.8, side: THREE.DoubleSide }));
  g.add(glass);
  for (let i = 0; i < 4; i++) { const bar = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.26, 0.015), mats.brass); const a = i / 4 * Math.PI * 2 + Math.PI / 4; bar.position.set(Math.cos(a) * 0.105, 0, Math.sin(a) * 0.105); g.add(bar); }
  const flame = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), mats.flameCore); flame.scale.y = 1.6; g.add(flame);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.01, 6, 12), mats.brass); ring.position.y = 0.22; g.add(ring);
  g.scale.setScalar(scale); g.userData.flame = flame;
  return g;
}
