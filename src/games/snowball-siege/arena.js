// Snowball Siege arena (procedural): sunny snowfield, two icy forts with cores, cover crates/walls, mid capture ring.
// Returns scene + collision boxes + `covers` (AABBs that stop snowballs) + fort/flag refs.
import * as THREE from 'three';
import * as C from './config.js';

export function glowTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.3, 'rgba(255,255,255,.6)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export function buildArena(collision) {
  const scene = new THREE.Scene(); scene.background = new THREE.Color('#bfe4ff'); scene.fog = new THREE.Fog('#d6eeff', 70, 190);
  scene.add(new THREE.HemisphereLight('#eaf6ff', '#8fb3d6', 1.5));
  const sun = new THREE.DirectionalLight('#fff4dc', 1.5); sun.position.set(30, 60, 20); scene.add(sun);
  const mat = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.85, ...o });
  const covers = [];
  const box = (w, h, d, m, x, y, z, solid = true) => {
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y + h / 2, z); scene.add(b);
    if (solid) { const bb = { minX: x - w / 2, minY: y, minZ: z - d / 2, maxX: x + w / 2, maxY: y + h, maxZ: z + d / 2 }; collision.addBox(bb.minX, bb.minY, bb.minZ, bb.maxX, bb.maxY, bb.maxZ); covers.push(bb); }
    return b;
  };
  // ground + bumpy snow edge
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), mat('#f4fbff')); ground.rotation.x = -Math.PI / 2; scene.add(ground);
  const field = new THREE.Mesh(new THREE.PlaneGeometry(C.HALF_X * 2, C.HALF_Z * 2), mat('#ffffff')); field.rotation.x = -Math.PI / 2; field.position.y = 0.01; scene.add(field);
  const snowMat = mat('#ffffff'), iceMat = mat('#bfe6ff', { roughness: 0.3, metalness: 0.05 }), woodMat = mat('#c98b4f'), woodDark = mat('#8a5a2e');
  // boundary snowbanks (solid, keep players in)
  for (const s of [-1, 1]) {
    box(1.6, 2.2, C.HALF_Z * 2 + 3.2, snowMat, s * (C.HALF_X + 0.8), 0, 0);
    box(C.HALF_X * 2, 2.2, 1.6, snowMat, 0, 0, s * (C.HALF_Z + 0.8));
  }
  // pine trees outside
  const treeMat = mat('#2f7d5b'), trunk = mat('#6b4423');
  for (let i = 0; i < 40; i++) {
    const a = i / 40 * Math.PI * 2, r = 46 + (i * 37 % 20);
    const x = Math.cos(a) * r * 0.75, z = Math.sin(a) * r * 1.1;
    const t = new THREE.Group(); t.position.set(x, 0, z);
    const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.5, 2, 6), trunk); tr.position.y = 1; t.add(tr);
    for (let k = 0; k < 3; k++) { const c = new THREE.Mesh(new THREE.ConeGeometry(2.6 - k * 0.6, 3, 7), treeMat); c.position.y = 3 + k * 1.6; t.add(c); const cap = new THREE.Mesh(new THREE.ConeGeometry(1.4 - k * 0.3, 1, 7), snowMat); cap.position.y = 4.1 + k * 1.6; t.add(cap); }
    scene.add(t);
  }
  // forts: team 0 at +Z, team 1 at -Z
  const forts = C.TEAMS.map((T, ti) => {
    const s = ti === 0 ? 1 : -1, z0 = s * C.FORT_Z, tm = mat(T.color), td = mat(T.dark);
    // front wall with a gap in the middle, side walls, crenellations
    const fz = z0 - s * 5;
    box(7, 2.2, 1.2, iceMat, -6.5, 0, fz); box(7, 2.2, 1.2, iceMat, 6.5, 0, fz);
    for (const x of [-9, -6, -3, 3, 6, 9]) box(1.1, 0.7, 1.3, snowMat, x, 2.2, fz, false);
    box(1.2, 2.2, 7, iceMat, -10.4, 0, z0 - s * 1.5); box(1.2, 2.2, 7, iceMat, 10.4, 0, z0 - s * 1.5);
    // core: snow-tower with a flag (target)
    const core = new THREE.Group(); core.position.set(0, 0, z0 + s * 2); scene.add(core);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.6, 3.2, 12), iceMat); base.position.y = 1.6; core.add(base);
    const top = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 2.3, 0.6, 12), td); top.position.y = 3.4; core.add(top);
    const ball = new THREE.Mesh(new THREE.SphereGeometry(1.2, 14, 10), snowMat); ball.position.y = 4.6; core.add(ball);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 3.4), woodDark); pole.position.y = 6.6; core.add(pole);
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.1), new THREE.MeshStandardMaterial({ color: T.color, side: THREE.DoubleSide, emissive: T.color, emissiveIntensity: 0.25 })); flag.position.set(0.9, 7.6, 0); core.add(flag);
    collision.addCircle(core.position.x, core.position.z, 2.5, 3.8);
    // spawn pad + snow pile (refill)
    const pad = new THREE.Mesh(new THREE.CircleGeometry(3, 24), new THREE.MeshBasicMaterial({ color: T.color, transparent: true, opacity: 0.35 })); pad.rotation.x = -Math.PI / 2; pad.position.set(-5, 0.03, z0 - s * 2.6); scene.add(pad); const pad2 = pad.clone(); pad2.position.x = 5; scene.add(pad2);
    const pile = new THREE.Mesh(new THREE.SphereGeometry(1.4, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), snowMat); pile.position.set(-6, 0, z0); scene.add(pile);
    const pile2 = pile.clone(); pile2.position.x = 6; scene.add(pile2);
    // team banners on walls
    for (const x of [-6.5, 6.5]) { const bn = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 1.2), new THREE.MeshStandardMaterial({ color: T.color, side: THREE.DoubleSide })); bn.position.set(x, 1.3, fz - s * 0.62); bn.rotation.y = s > 0 ? Math.PI : 0; scene.add(bn); }
    return { team: ti, core, flag, ball, x: 0, z: core.position.z, spawn: new THREE.Vector3(0, 0, z0 - s * 2.6), piles: [pile.position, pile2.position], s, hp: C.FORT_HP, broken: false, mats: [base.material] };
  });
  // midfield cover: crates + low snow walls, mirrored
  const crate = (x, z, sz = 1.6) => { const b = box(sz, sz, sz, woodMat, x, 0, z); const band = new THREE.Mesh(new THREE.BoxGeometry(sz + 0.02, 0.2, sz + 0.02), woodDark); band.position.copy(b.position); b.parent.add(band); const cap = new THREE.Mesh(new THREE.BoxGeometry(sz * 0.9, 0.25, sz * 0.9), snowMat); cap.position.set(x, sz + 0.12, z); scene.add(cap); };
  for (const s of [-1, 1]) {
    crate(-12 * s, 14 * s); crate(-10.4 * s, 14.4 * s, 1.2); crate(12 * s, 11 * s);
    box(6, 1.3, 1, snowMat, -5 * s, 0, 9 * s); box(6, 1.3, 1, snowMat, 7 * s, 0, 16 * s);
    crate(15 * s, 4 * s); crate(-3 * s, 17 * s, 1.3);
    box(1, 1.3, 4.5, iceMat, -13 * s, 0, 3 * s);
  }
  // mid capture ring + beacon
  const ringMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.5, side: THREE.DoubleSide });
  const ring = new THREE.Mesh(new THREE.RingGeometry(C.CAP_R - 0.4, C.CAP_R, 48), ringMat); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.04; scene.add(ring);
  const fillMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.25 });
  const fill = new THREE.Mesh(new THREE.CircleGeometry(C.CAP_R - 0.4, 48), fillMat); fill.rotation.x = -Math.PI / 2; fill.position.y = 0.03; scene.add(fill);
  const beacon = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 6, 8), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.5 })); beacon.position.y = 3; scene.add(beacon);
  const midFlag = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1), new THREE.MeshStandardMaterial({ color: '#ffffff', side: THREE.DoubleSide })); midFlag.position.set(0.8, 6, 0); scene.add(midFlag);
  // falling snow
  const N = 500, sg = new THREE.BufferGeometry(), sp = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) { sp[i * 3] = (Math.random() - 0.5) * 90; sp[i * 3 + 1] = Math.random() * 30; sp[i * 3 + 2] = (Math.random() - 0.5) * 110; }
  sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  const glowTex = glowTexture();
  const snow = new THREE.Points(sg, new THREE.PointsMaterial({ size: 0.35, map: glowTex, transparent: true, depthWrite: false, color: '#ffffff' })); snow.frustumCulled = false; scene.add(snow);
  return {
    scene, covers, forts, glowTex,
    mid: { ring, ringMat, fill, fillMat, beacon, flag: midFlag },
    update(dt, t) {
      for (let i = 0; i < N; i++) { sp[i * 3 + 1] -= dt * (1.2 + (i % 5) * 0.2); sp[i * 3] += Math.sin(t + i) * dt * 0.3; if (sp[i * 3 + 1] < 0) sp[i * 3 + 1] = 30; }
      sg.attributes.position.needsUpdate = true;
      for (const f of forts) f.flag.rotation.y = Math.sin(t * 3 + f.team) * 0.25;
      midFlag.rotation.y = Math.sin(t * 2.6) * 0.3; ring.rotation.z += dt * 0.3;
    },
  };
}
