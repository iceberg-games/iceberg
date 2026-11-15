// Hearth Rekindle village glow-ups (brief §5.3): tier 1 garlands → 2 lantern strings → 3 festival stalls →
// 4 warm bunting lights → 5 the aurora returns + fireworks (fireworks driven from index.js).
import * as THREE from 'three';
export function buildHearthDecor() {
  const group = new THREE.Group(); group.name = 'hearthDecor';
  const tiers = [0, 1, 2, 3, 4].map(() => { const g = new THREE.Group(); g.visible = false; group.add(g); return g; });
  const circles = [];
  // tier 1: evergreen garlands with red bows around the hearth rim
  { const gm = new THREE.MeshStandardMaterial({ color: '#2f6a4a', roughness: 0.9 }), bow = new THREE.MeshStandardMaterial({ color: '#c0303a', roughness: 0.6 });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(3.15, 0.22, 6, 40), gm); ring.rotation.x = Math.PI / 2; ring.position.y = 0.75; tiers[0].add(ring);
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2, b = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), bow); b.position.set(Math.cos(a) * 3.2, 0.85, Math.sin(a) * 3.2); b.scale.set(1.4, 0.8, 0.6); b.rotation.y = -a; tiers[0].add(b); } }
  // tier 2: lantern strings sagging from the hearth crown to 8 poles around the plaza
  const bulbs = [];
  { const pole = new THREE.MeshStandardMaterial({ color: '#4a3222', roughness: 0.9 }), wire = new THREE.LineBasicMaterial({ color: '#2a1a10' }), cols = ['#ffcf7a', '#ff8a5a', '#9affd8', '#d0a8ff'];
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2 + Math.PI / 8, px = Math.cos(a) * 11, pz = Math.sin(a) * 11;
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 5, 6), pole); p.position.set(px, 2.5, pz); tiers[1].add(p); circles.push([px, pz, 0.25, 5]);
      const pts = []; for (let k = 0; k <= 12; k++) { const t = k / 12; pts.push(new THREE.Vector3(px * t, 5.4 * (1 - t) + 4.9 * t - Math.sin(t * Math.PI) * 1.1, pz * t)); }
      tiers[1].add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), wire));
      for (let k = 2; k <= 11; k += 2) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 6), new THREE.MeshBasicMaterial({ color: cols[(i + k) % 4], toneMapped: false })); b.position.copy(pts[k]).add(new THREE.Vector3(0, -0.15, 0)); tiers[1].add(b); bulbs.push(b); } } }
  // tier 3: festival stalls with striped awnings
  { const wood = new THREE.MeshStandardMaterial({ color: '#7a5434', roughness: 0.85 }), aw = [new THREE.MeshStandardMaterial({ color: '#c03a4a', roughness: 0.7 }), new THREE.MeshStandardMaterial({ color: '#f2e6cf', roughness: 0.7 })];
    for (const [x, z, ry] of [[7.6, 7.6, -Math.PI / 4], [-7.6, 7.6, Math.PI / 4], [7.6, -7.6, -Math.PI * 0.75], [-7.6, -7.6, Math.PI * 0.75]]) {
      const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; tiers[2].add(g);
      const c = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.0, 1.0), wood); c.position.y = 0.5; g.add(c);
      for (const sx of [-1, 1]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.4, 0.12), wood); p.position.set(sx * 1.05, 1.2, -0.45); g.add(p); }
      for (let i = 0; i < 6; i++) { const s = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.06, 1.4), aw[i % 2]); s.position.set(-1.0 + i * 0.4, 2.35, -0.1); s.rotation.x = 0.35; g.add(s); }
      for (let i = 0; i < 3; i++) { const j = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), new THREE.MeshStandardMaterial({ color: ['#ffcf7a', '#ff8a5a', '#9affd8'][i], emissive: ['#ff9a3a', '#ff5a2a', '#3affc0'][i], emissiveIntensity: 0.9 })); j.position.set(-0.6 + i * 0.6, 1.15, 0.1); g.add(j); }
      circles.push([x, z, 1.2, 2.5]); } }
  // tier 4: warm hanging star lanterns over the plaza
  { for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2, s = new THREE.Mesh(new THREE.OctahedronGeometry(0.28), new THREE.MeshBasicMaterial({ color: '#ffe0a0', toneMapped: false })); s.position.set(Math.cos(a) * 6, 4.4 + Math.sin(i) * 0.3, Math.sin(a) * 6); tiers[3].add(s); bulbs.push(s); } }
  return { group, circles,
    set(tier) { tiers.forEach((g, i) => { g.visible = tier > i; }); },
    update(t) { bulbs.forEach((b, i) => { b.scale.setScalar(1 + Math.sin(t * 3 + i * 1.7) * 0.15); }); } };
}
