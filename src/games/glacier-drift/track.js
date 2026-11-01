// Glacier Drift course: fully procedural daytime glacier (no shared set). Course math in (d = distance
// downhill, off = lateral). Builds terrain ribbon, ice walls, pines, ice crystals, gates, power-up orbs,
// powder piles (soft obstacles), kickers and the finish arch.
import * as THREE from 'three';
import { TRACK, POWER, POWER_IDS } from './config.js';

export const LENGTH = TRACK.length, HALF = TRACK.halfWidth;
export const centerX = (d) => Math.sin(d * 0.011) * 26 + Math.sin(d * 0.027 + 1.3) * 9;
const KICKERS = [150, 330, 520, 660];
const kick = (d) => { let h = 0; for (const k of KICKERS) { const u = (d - k) / 9; if (u > -1 && u < 0.15) h += Math.max(0, 1.8 * (1 - u * u)) * (u < 0 ? 1 : 1 - u / 0.15); } return h; };
export const heightAt = (d, off = 0) => -d * 0.3 + Math.sin(d * 0.05) * 2.2 + kick(d) + Math.pow(Math.abs(off) / HALF, 3) * 2.4;
export const worldAt = (d, off, out = new THREE.Vector3()) => out.set(centerX(d) + off, heightAt(d, off), -d);
export const headingAt = (d) => Math.atan2(centerX(d + 1) - centerX(d - 1), 2);

function rng(seed) { return () => ((seed = (seed * 16807) % 2147483647) / 2147483647); }

function skyMat() {
  return new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, fog: false, uniforms: { t: { value: 0 } },
    vertexShader: 'varying vec3 v; void main(){ v = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
    fragmentShader: `uniform float t; varying vec3 v; void main(){ float h = clamp(v.y*.5+.5,0.,1.);
      vec3 c = mix(vec3(.86,.95,1.), vec3(.32,.62,.95), smoothstep(.45,.95,h));
      float sun = pow(max(dot(v, normalize(vec3(.4,.35,-.8))),0.), 180.); c += vec3(1.,.95,.8)*sun*1.5;
      float band = sin(v.x*6.+t*.2)*sin(v.z*4.-t*.15); c += vec3(.3,1.,.8)*smoothstep(.6,1.,h)*max(band,0.)*.12;
      gl_FragColor = vec4(c,1.); }` });
}

export function buildTrack() {
  const scene = new THREE.Scene(); scene.fog = new THREE.Fog('#d6efff', 90, 420);
  const disposables = []; const own = (x) => { disposables.push(x); return x; };
  const sky = own(skyMat()); const skyM = new THREE.Mesh(own(new THREE.SphereGeometry(900, 32, 16)), sky); skyM.frustumCulled = false; scene.add(skyM);
  scene.add(new THREE.HemisphereLight('#dff3ff', '#7aa6d6', 1.25));
  const sun = new THREE.DirectionalLight('#fff4e0', 1.4); sun.position.set(60, 120, 40); scene.add(sun);
  const root = new THREE.Group(); scene.add(root);
  const R = rng(TRACK.seed);

  // terrain ribbon (lane + banks) with vertex colours: groomed lane, blue ice edges, white banks
  const SEG = 380, COLS = 24, W = HALF * 4;
  const pos = new Float32Array((SEG + 1) * (COLS + 1) * 3), col = new Float32Array(pos.length), idx = [];
  const cLane = new THREE.Color('#f4fbff'), cEdge = new THREE.Color('#9fd6ff'), cBank = new THREE.Color('#ffffff'), cStripe = new THREE.Color('#e3f3ff');
  for (let i = 0; i <= SEG; i++) {
    const d = -20 + (LENGTH + 60) * i / SEG;
    for (let j = 0; j <= COLS; j++) {
      const off = -W + 2 * W * j / COLS, k = (i * (COLS + 1) + j) * 3, a = Math.abs(off);
      const h = a <= HALF ? heightAt(d, off) : heightAt(d, Math.sign(off) * HALF) + (a - HALF) * 0.9 + Math.sin(d * 0.2 + off) * 0.6;
      pos[k] = centerX(d) + off; pos[k + 1] = h; pos[k + 2] = -d;
      const c = a < HALF - 1.2 ? ((i >> 2) % 2 ? cLane : cStripe) : a < HALF + 1 ? cEdge : cBank; col.set([c.r, c.g, c.b], k);
      if (i < SEG && j < COLS) { const p = i * (COLS + 1) + j; idx.push(p, p + 1, p + COLS + 1, p + 1, p + COLS + 2, p + COLS + 1); }
    }
  }
  const tg = own(new THREE.BufferGeometry()); tg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); tg.setAttribute('color', new THREE.BufferAttribute(col, 3)); tg.setIndex(idx); tg.computeVertexNormals();
  root.add(new THREE.Mesh(tg, own(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.05 }))));

  // pines + ice crystals + distant bergs
  const pineG = own(new THREE.ConeGeometry(1.6, 4.5, 7)), trunkG = own(new THREE.CylinderGeometry(0.25, 0.3, 1.2, 6));
  const pineM = own(new THREE.MeshStandardMaterial({ color: '#2f7d6a', flatShading: true })), capM = own(new THREE.MeshStandardMaterial({ color: '#ffffff', flatShading: true })), trunkM = own(new THREE.MeshStandardMaterial({ color: '#7a4b2a' }));
  for (let i = 0; i < 170; i++) {
    const d = R() * (LENGTH + 40), side = R() < 0.5 ? -1 : 1, off = side * (HALF + 4 + R() * 26), s = 0.8 + R() * 1.1;
    const t = new THREE.Group(), cone = new THREE.Mesh(pineG, pineM), cap = new THREE.Mesh(pineG, capM), tr = new THREE.Mesh(trunkG, trunkM);
    cone.position.y = 3; cap.scale.setScalar(0.5); cap.position.y = 4.6; tr.position.y = 0.6; t.add(cone, cap, tr); t.scale.setScalar(s);
    const a = Math.abs(off); t.position.set(centerX(d) + off, heightAt(d, side * HALF) + (a - HALF) * 0.9 - 0.3, -d); root.add(t);
  }
  const crystalG = own(new THREE.OctahedronGeometry(1, 0)), crystalM = own(new THREE.MeshStandardMaterial({ color: '#9ee8ff', emissive: '#2a8fd0', emissiveIntensity: 0.5, transparent: true, opacity: 0.85, roughness: 0.1, metalness: 0.3, flatShading: true }));
  const crystals = [];
  for (let i = 0; i < 90; i++) {
    const d = R() * LENGTH, side = R() < 0.5 ? -1 : 1, off = side * (HALF + 1.5 + R() * 8), m = new THREE.Mesh(crystalG, crystalM);
    m.scale.set(0.6 + R(), 1.5 + R() * 3, 0.6 + R()); m.rotation.set(R() * 0.5, R() * 3, side * 0.3);
    m.position.set(centerX(d) + off, heightAt(d, side * HALF) + (Math.abs(off) - HALF) * 0.9 + 0.8, -d); root.add(m); crystals.push(m);
  }
  const bergM = own(new THREE.MeshStandardMaterial({ color: '#cfeaff', flatShading: true }));
  for (let i = 0; i < 26; i++) { const b = new THREE.Mesh(own(new THREE.IcosahedronGeometry(30 + R() * 40, 0)), bergM); const d = R() * LENGTH, s = R() < 0.5 ? -1 : 1; b.position.set(centerX(d) + s * (120 + R() * 140), heightAt(d) - 20, -d); b.scale.y = 1.4 + R(); root.add(b); }

  const items = { gates: [], pickups: [], piles: [], kickers: KICKERS.map(d => ({ d })) };
  // gates (glowing ice arches)
  const gateG = own(new THREE.TorusGeometry(1, 0.15, 8, 32, Math.PI));
  for (let i = 0; i < TRACK.gates; i++) {
    const d = 30 + i * (LENGTH - 70) / TRACK.gates + R() * 5;
    if (KICKERS.some(k => Math.abs(k - d) < 14)) continue;
    const off = (R() - 0.5) * (HALF * 2 - 7), hue = i % 2 ? '#5fe1ff' : '#ff8ae0';
    const mat = own(new THREE.MeshBasicMaterial({ color: hue, transparent: true, opacity: 0.95, fog: false }));
    const arch = new THREE.Mesh(gateG, mat); worldAt(d, off, arch.position); arch.scale.setScalar(2.6); arch.rotation.y = headingAt(d); root.add(arch);
    items.gates.push({ d, off, half: 2.4, mesh: arch, mat, hit: false });
  }
  // power-up orbs: floating glass cubes with icon colour
  const boxG = own(new THREE.BoxGeometry(1.1, 1.1, 1.1)), haloG = own(new THREE.TorusGeometry(0.95, 0.06, 6, 24));
  for (let i = 0; i < TRACK.pickups; i++) {
    const d = 45 + i * (LENGTH - 100) / TRACK.pickups;
    for (const off of [-HALF * 0.5, 0, HALF * 0.5]) {
      if (R() < 0.35 && off !== 0) continue;
      const kind = POWER_IDS[Math.floor(R() * POWER_IDS.length)], c = POWER[kind].color;
      const m = new THREE.Mesh(boxG, own(new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.55, transparent: true, opacity: 0.85, roughness: 0.15 })));
      const halo = new THREE.Mesh(haloG, own(new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.7 })));
      const g = new THREE.Group(); g.add(m, halo); worldAt(d, off, g.position); g.position.y += 1.4; root.add(g);
      items.pickups.push({ d, off, kind, mesh: g, cube: m, taken: false, respawn: 0 });
    }
  }
  // powder piles (soft obstacles)
  const pileG = own(new THREE.SphereGeometry(1, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2)), pileM = own(new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.9 }));
  for (let i = 0; i < 26; i++) {
    const d = 60 + R() * (LENGTH - 100), off = (R() - 0.5) * (HALF * 2 - 3);
    if ([...items.gates, ...items.pickups].some(o => Math.abs(o.d - d) < 7) || KICKERS.some(k => Math.abs(k - d) < 16)) continue;
    const m = new THREE.Mesh(pileG, pileM); m.scale.set(1.4, 1.1, 1.4); worldAt(d, off, m.position); root.add(m); items.piles.push({ d, off, r: 1.3, mesh: m, hit: false });
  }
  // kicker chevrons
  const chevM = own(new THREE.MeshBasicMaterial({ color: '#ffd84a' }));
  for (const k of KICKERS) for (const off of [-HALF + 1, HALF - 1]) { const c = new THREE.Mesh(own(new THREE.ConeGeometry(0.5, 1.4, 4)), chevM); worldAt(k - 6, off, c.position); c.position.y += 0.8; root.add(c); }
  // start + finish arches
  const archM = own(new THREE.MeshStandardMaterial({ color: '#2f9bea', emissive: '#1d6fb3', emissiveIntensity: 0.4 })), flagM = own(new THREE.MeshBasicMaterial({ color: '#ffffff', side: THREE.DoubleSide }));
  const mkArch = (d, label) => {
    const g = new THREE.Group(); worldAt(d, 0, g.position); g.rotation.y = headingAt(d);
    for (const x of [-HALF - 0.5, HALF + 0.5]) { const p = new THREE.Mesh(own(new THREE.BoxGeometry(0.8, 8, 0.8)), archM); p.position.set(x, 4, 0); g.add(p); }
    const bar = new THREE.Mesh(own(new THREE.BoxGeometry(HALF * 2 + 2, 1.6, 0.8)), archM); bar.position.y = 8; g.add(bar);
    const c = document.createElement('canvas'); c.width = 512; c.height = 64; const x = c.getContext('2d');
    for (let i = 0; i < 16; i++) { x.fillStyle = i % 2 ? '#0e2a45' : '#fff'; x.fillRect(i * 32, 0, 32, 64); }
    x.font = '900 44px system-ui'; x.textAlign = 'center'; x.fillStyle = '#ffd84a'; x.strokeStyle = '#0e2a45'; x.lineWidth = 8; x.strokeText(label, 256, 48); x.fillText(label, 256, 48);
    const tex = own(new THREE.CanvasTexture(c)); const ban = new THREE.Mesh(own(new THREE.PlaneGeometry(HALF * 2, 1.5)), own(new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide })));
    ban.position.set(0, 8, 0.45); g.add(ban); root.add(g); return g;
  };
  mkArch(2, 'GLACIER DRIFT'); const finishArch = mkArch(LENGTH, 'FINISH');
  void flagM;

  return {
    scene, root, items, finishArch,
    update(dt, t) {
      sky.uniforms.t.value = t;
      for (const gt of items.gates) if (!gt.hit) gt.mesh.scale.setScalar(2.6 + Math.sin(t * 4 + gt.d) * 0.12);
      for (const p of items.pickups) {
        if (p.taken) { p.respawn -= dt; if (p.respawn <= 0) { p.taken = false; p.mesh.visible = true; p.mesh.scale.setScalar(0.01); } continue; }
        p.mesh.scale.setScalar(Math.min(1, p.mesh.scale.x + dt * 3)); p.cube.rotation.set(t * 1.3 + p.d, t * 1.7, 0); p.mesh.children[1].rotation.set(Math.PI / 2 + Math.sin(t * 2) * 0.3, 0, t * 2);
        p.mesh.position.y = heightAt(p.d, p.off) + 1.4 + Math.sin(t * 3 + p.d) * 0.25;
      }
      for (let i = 0; i < crystals.length; i += 3) crystals[i].material.emissiveIntensity = 0.45 + Math.sin(t * 2) * 0.15;
    },
    reset() {
      for (const gt of items.gates) { gt.hit = false; gt.mat.opacity = 0.95; }
      for (const p of items.pickups) { p.taken = false; p.mesh.visible = true; p.mesh.scale.setScalar(1); }
      for (const r of items.piles) { r.hit = false; r.mesh.visible = true; }
    },
    dispose() { disposables.forEach(x => x.dispose?.()); },
  };
}
