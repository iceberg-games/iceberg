// Frostlight Village (hub, brief §3.1): snowy hollow, Great Hearth Lantern plaza, Waystone circle (N),
// Forge (NE), Lamplighter (NW), Apothecary (SW), Quest Board + Elder Wick (SE), cottages, creek + bridge (S).
// Returns { group, colliders(col), interactables, lights, update(dt, t) }. North = −Z.
import * as THREE from 'three';
import { makeMats, makeEmbers, makeLantern } from './common.js';

const rnd = (() => { let s = 1337; return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; })();

export function buildVillage({ mobile = false, lights } = {}) {
  const vl = (x, y, z, c, i, d, o = {}) => lights.add(x, y, z, c, i, d, { area: 'village', ...o });
  const M = makeMats();
  const group = new THREE.Group(); group.name = 'village';
  const boxes = [], circles = [], interactables = [], animated = [], occluders = [];
  const add = (geo, mat, x, y, z, { rx = 0, ry = 0, rz = 0, cast = true, recv = true, parent = group } = {}) => {
    const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); m.castShadow = cast; m.receiveShadow = recv; parent.add(m); return m; };
  const solid = (x0, z0, x1, z1, h = 6) => boxes.push([Math.min(x0, x1), 0, Math.min(z0, z1), Math.max(x0, x1), h, Math.max(z0, z1)]);

  // ---------- ground: flat play area, rolling snowbanks beyond ----------
  const gGeo = new THREE.PlaneGeometry(220, 220, 110, 110); gGeo.rotateX(-Math.PI / 2);
  const gp = gGeo.attributes.position;
  for (let i = 0; i < gp.count; i++) { const x = gp.getX(i), z = gp.getZ(i), r = Math.hypot(x, z);
    const bank = THREE.MathUtils.smoothstep(r, 44, 70) * (6 + Math.sin(x * 0.11) * 2.5 + Math.cos(z * 0.13) * 2.5);
    gp.setY(i, bank + (r > 40 ? Math.sin(x * 0.7) * Math.cos(z * 0.6) * 0.25 : 0)); }
  gGeo.computeVertexNormals();
  add(gGeo, M.snow, 0, 0, 0, { cast: false });
  // trodden paths (slightly bluer snow)
  const pathMat = new THREE.MeshStandardMaterial({ color: '#c9d3ee', roughness: 1 });
  for (const [x, z, w, d, ry] of [[0, -15, 3.2, 28, 0], [0, 15, 3.2, 38, 0], [8, -6, 3, 22, -0.95], [-8, -6, 3, 22, 0.95], [8, 6, 3, 22, 0.95], [-8, 6, 3, 22, -0.95]])
    add(new THREE.PlaneGeometry(w, d), pathMat, x, 0.012, z, { rx: -Math.PI / 2, rz: ry, cast: false });
  add(new THREE.CircleGeometry(8.5, 40), new THREE.MeshStandardMaterial({ color: '#b7a796', roughness: 0.95 }), 0, 0.015, 0, { rx: -Math.PI / 2, cast: false }); // plaza cobbles
  for (let i = 0; i < 48; i++) { const a = rnd() * Math.PI * 2, r = 2.5 + rnd() * 6; add(new THREE.BoxGeometry(0.6 + rnd() * 0.4, 0.05, 0.5 + rnd() * 0.3), M.stoneDark, Math.cos(a) * r, 0.03, Math.sin(a) * r, { ry: rnd() * 3, cast: false }); }

  // ---------- Great Hearth Lantern ----------
  const hearth = new THREE.Group(); group.add(hearth);
  add(new THREE.CylinderGeometry(3.0, 3.3, 0.7, 14), M.stone, 0, 0.35, 0, { parent: hearth });
  add(new THREE.CylinderGeometry(2.2, 2.4, 0.5, 14), M.stoneDark, 0, 0.95, 0, { parent: hearth });
  for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2 + Math.PI / 4; add(new THREE.BoxGeometry(0.35, 4.2, 0.35), M.iron, Math.cos(a) * 1.7, 3.0, Math.sin(a) * 1.7, { parent: hearth, rz: Math.cos(a) * -0.18, rx: Math.sin(a) * 0.18 }); }
  add(new THREE.CylinderGeometry(1.6, 1.0, 0.8, 16, 1, true), M.iron, 0, 1.6, 0, { parent: hearth });
  add(new THREE.TorusGeometry(1.25, 0.12, 8, 24), M.brass, 0, 4.9, 0, { parent: hearth, rx: Math.PI / 2 });
  add(new THREE.ConeGeometry(1.0, 0.9, 12), M.iron, 0, 5.5, 0, { parent: hearth });
  const fire = new THREE.Group(); fire.position.y = 1.9; hearth.add(fire);
  const flames = [];
  for (let i = 0; i < 7; i++) { const f = new THREE.Mesh(new THREE.ConeGeometry(0.35 + rnd() * 0.25, 1.4 + rnd() * 0.8, 7), i % 2 ? M.flame : M.flameCore);
    const a = i / 7 * Math.PI * 2; f.position.set(Math.cos(a) * 0.45 * (i ? 1 : 0), 0.6, Math.sin(a) * 0.45 * (i ? 1 : 0)); fire.add(f); flames.push(f); }
  const hearthLight = vl(0, 3.2, 0, '#ff9a3c', 60, 34, { flicker: 0.12 });
  const embers = makeEmbers(new THREE.Vector3(0, 2.4, 0), mobile ? 30 : 70, 1.2); group.add(embers.points);
  circles.push([0, 0, 3.3, 6]);
  interactables.push({ id: 'hearth', name: 'Great Hearth', x: 0, z: 0, r: 4.8, verb: 'Rekindle' });

  // ---------- buildings ----------
  function cottage(x, z, ry, roofMat, w = 6, d = 5, h = 3.2) {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; group.add(g);
    add(new THREE.BoxGeometry(w + 0.3, 0.5, d + 0.3), M.stone, 0, 0.25, 0, { parent: g });
    add(new THREE.BoxGeometry(w, h, d), M.plank, 0, 0.5 + h / 2, 0, { parent: g });
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) add(new THREE.BoxGeometry(0.28, h, 0.28), M.woodDark, sx * (w / 2), 0.5 + h / 2, sz * (d / 2), { parent: g });
    // gable roof: two slabs + snow caps + triangle ends
    const rl = Math.hypot(w / 2 + 0.5, 1.9), ang = Math.atan2(1.9, w / 2 + 0.5);
    for (const s of [-1, 1]) {
      add(new THREE.BoxGeometry(rl, 0.22, d + 0.9), roofMat, s * (w / 4 + 0.2), 0.5 + h + 0.95, 0, { parent: g, rz: -s * ang });
      add(new THREE.BoxGeometry(rl * 0.92, 0.12, d + 0.95), M.snowCap, s * (w / 4 + 0.15), 0.5 + h + 1.1, 0, { parent: g, rz: -s * ang });
    }
    const tri = new THREE.Shape(); tri.moveTo(-w / 2, 0); tri.lineTo(w / 2, 0); tri.lineTo(0, 1.8); tri.closePath();
    for (const s of [-1, 1]) add(new THREE.ShapeGeometry(tri), M.plank, 0, 0.5 + h, s * (d / 2 + 0.001), { parent: g, ry: s < 0 ? Math.PI : 0 });
    // door, windows (warm), chimney
    add(new THREE.BoxGeometry(1.1, 2.0, 0.12), M.woodDark, 0, 1.5, d / 2 + 0.05, { parent: g });
    add(new THREE.SphereGeometry(0.06, 6, 6), M.brass, 0.38, 1.5, d / 2 + 0.13, { parent: g });
    for (const sx of [-1, 1]) { add(new THREE.BoxGeometry(0.9, 0.9, 0.08), M.window, sx * (w / 2 - 1.3), 2.3, d / 2 + 0.04, { parent: g, cast: false });
      add(new THREE.BoxGeometry(1.1, 0.12, 0.16), M.woodDark, sx * (w / 2 - 1.3), 1.8, d / 2 + 0.08, { parent: g });
      add(new THREE.BoxGeometry(0.08, 0.9, 0.1), M.woodDark, sx * (w / 2 - 1.3), 2.3, d / 2 + 0.09, { parent: g }); }
    add(new THREE.BoxGeometry(0.08, 0.9, 0.9), M.window, w / 2 + 0.04, 2.3, 0, { parent: g, cast: false });
    add(new THREE.BoxGeometry(0.8, 2.2, 0.8), M.stone, -w / 4, 0.5 + h + 1.6, -d / 4, { parent: g });
    add(new THREE.BoxGeometry(0.95, 0.15, 0.95), M.snowCap, -w / 4, 0.5 + h + 2.75, -d / 4, { parent: g });
    // world-space collider (rotation is a multiple of π/2 here)
    const c = Math.abs(Math.cos(ry)) > 0.5, hw = (c ? w : d) / 2 + 0.2, hd = (c ? d : w) / 2 + 0.2; solid(x - hw, z - hd, x + hw, z + hd, 7);
    occluders.push(g);
    return g;
  }
  for (const [x, z, ry, mat] of [[-31, -22, Math.PI / 2, M.roofRed], [31, -22, -Math.PI / 2, M.roof], [-35, 4, Math.PI / 2, M.roofGreen], [35, 4, -Math.PI / 2, M.roofRed], [-24, 34, 0, M.roof], [24, 34, 0, M.roofGreen]])
    cottage(x, z, ry, mat);

  // Forge (NE): open timber shed, brick forge with glow, anvil, quench barrel, training dummies
  const forge = new THREE.Group(); forge.position.set(17, 0, -13); group.add(forge);
  add(new THREE.BoxGeometry(8, 0.3, 6), M.stoneDark, 0, 0.15, 0, { parent: forge });
  for (const [px, pz] of [[-3.8, -2.8], [3.8, -2.8], [-3.8, 2.8], [3.8, 2.8]]) add(new THREE.BoxGeometry(0.35, 3.6, 0.35), M.woodDark, px, 1.95, pz, { parent: forge });
  add(new THREE.BoxGeometry(8.8, 0.3, 6.8), M.roofRed, 0, 3.9, 0, { parent: forge, rx: 0.12 });
  add(new THREE.BoxGeometry(8.6, 0.14, 6.6), M.snowCap, 0, 4.12, 0.05, { parent: forge, rx: 0.12 });
  add(new THREE.BoxGeometry(2.6, 1.6, 2.0), new THREE.MeshStandardMaterial({ color: '#7a4a3a', roughness: 0.9, flatShading: true }), -2.2, 1.1, -1.8, { parent: forge });
  add(new THREE.BoxGeometry(1.2, 0.6, 0.1), new THREE.MeshBasicMaterial({ color: '#ff7a3d', toneMapped: false }), -2.2, 1.2, -0.79, { parent: forge, cast: false });
  add(new THREE.BoxGeometry(0.8, 4.6, 0.8), M.stone, -2.8, 3.0, -2.3, { parent: forge });
  const anvil = new THREE.Group(); anvil.position.set(0.8, 0.3, 0); forge.add(anvil);
  add(new THREE.CylinderGeometry(0.35, 0.45, 0.7, 10), M.woodDark, 0, 0.35, 0, { parent: anvil });
  add(new THREE.BoxGeometry(1.1, 0.35, 0.45), M.iron, 0, 0.85, 0, { parent: anvil });
  add(new THREE.ConeGeometry(0.22, 0.5, 4), M.iron, 0.75, 0.88, 0, { parent: anvil, rz: Math.PI / 2 });
  add(new THREE.CylinderGeometry(0.5, 0.45, 0.9, 12), M.wood, 2.8, 0.75, -1.8, { parent: forge });
  const forgeLight = vl(17 - 2.2, 1.6, -13 - 0.4, '#ff6a2a', 18, 14, { flicker: 0.15 });
  solid(13, -16, 21, -10, 4.2); occluders.push(forge);
  const dummies = [];
  for (const [dx, dz] of [[6.5, 1], [6.5, 4]]) { const d = new THREE.Group(); d.position.set(17 + dx, 0, -13 + dz); group.add(d); dummies.push({ g: d, x: 17 + dx, z: -13 + dz, wob: 0 });
    add(new THREE.CylinderGeometry(0.1, 0.1, 1.8, 6), M.wood, 0, 0.9, 0, { parent: d }); add(new THREE.CylinderGeometry(0.35, 0.3, 0.9, 10), M.paper, 0, 1.5, 0, { parent: d });
    add(new THREE.BoxGeometry(1.2, 0.12, 0.12), M.wood, 0, 1.6, 0, { parent: d }); add(new THREE.SphereGeometry(0.25, 10, 8), M.paper, 0, 2.15, 0, { parent: d }); circles.push([d.position.x, d.position.z, 0.45, 2.4]); }
  interactables.push({ id: 'brann', name: 'Smith Brann', x: 17, z: -9, r: 3.2, verb: 'Forge' });

  // Lamplighter Ysolde (NW): round hut, conical roof, hanging lanterns
  const lamp = new THREE.Group(); lamp.position.set(-17, 0, -13); group.add(lamp);
  add(new THREE.CylinderGeometry(3, 3.2, 3.2, 14), M.plank, 0, 1.6, 0, { parent: lamp });
  add(new THREE.ConeGeometry(3.9, 3, 14), M.roof, 0, 4.6, 0, { parent: lamp });
  add(new THREE.ConeGeometry(3.95, 1.3, 14), M.snowCap, 0, 5.4, 0, { parent: lamp });
  add(new THREE.BoxGeometry(1.1, 2, 0.2), M.woodDark, 0, 1, 3.1, { parent: lamp });
  add(new THREE.BoxGeometry(2.6, 0.12, 1.4), M.wood, 0, 3.15, 3.6, { parent: lamp });
  for (let i = 0; i < 5; i++) { const l = makeLantern(M, 1.4); l.position.set(-1.1 + i * 0.55, 2.7, 4.1); lamp.add(l); animated.push({ o: l, swing: i }); }
  circles.push([-17, -13, 3.3, 6]); occluders.push(lamp);
  interactables.push({ id: 'ysolde', name: 'Lamplighter Ysolde', x: -17, z: -8.6, r: 3.2, verb: 'Lantern upgrades' });

  // Apothecary Moss (SW): small cottage + herb racks
  cottage(-18, 13, Math.PI / 2, M.roofGreen, 5, 4.4, 2.8);
  for (let i = 0; i < 3; i++) add(new THREE.SphereGeometry(0.28, 8, 6), new THREE.MeshStandardMaterial({ color: ['#7dffb0', '#ff8fd0', '#8fd4ff'][i], emissive: ['#2bd47a', '#d44a9a', '#3a9ad4'][i], emissiveIntensity: 1.2 }), -14.6, 1.2, 11.8 + i * 0.9);
  add(new THREE.BoxGeometry(0.8, 1, 3), M.wood, -14.6, 0.5, 12.7);
  interactables.push({ id: 'moss', name: 'Apothecary Moss', x: -13.6, z: 13, r: 3, verb: 'Shop' });

  // Quest Board + Elder Wick (SE)
  const board = new THREE.Group(); board.position.set(16, 0, 12); board.rotation.y = -Math.PI / 4; group.add(board);
  for (const s of [-1, 1]) add(new THREE.BoxGeometry(0.25, 3.2, 0.25), M.woodDark, s * 1.7, 1.6, 0, { parent: board });
  add(new THREE.BoxGeometry(3.6, 2, 0.15), M.plank, 0, 2.0, 0, { parent: board });
  add(new THREE.BoxGeometry(4.2, 0.18, 0.9), M.roofRed, 0, 3.25, 0, { parent: board, rx: 0.2 });
  add(new THREE.BoxGeometry(4.1, 0.08, 0.85), M.snowCap, 0, 3.37, 0.02, { parent: board, rx: 0.2 });
  for (let i = 0; i < 6; i++) add(new THREE.PlaneGeometry(0.6, 0.75), M.paper, -1.25 + (i % 3) * 1.25, 2.45 - Math.floor(i / 3) * 0.9, 0.09, { parent: board, rz: (rnd() - 0.5) * 0.2, cast: false });
  circles.push([16, 12, 1.9, 3.5]);
  interactables.push({ id: 'board', name: 'Quest Board', x: 14.4, z: 10.4, r: 3, verb: 'Quests' });
  interactables.push({ id: 'wick', name: 'Elder Wick', x: 11.5, z: 13.5, r: 2.6, verb: 'Talk' });

  // Waystone circle (N): 4 rune stones + portal ring
  const way = new THREE.Group(); way.position.set(0, 0, -31); group.add(way);
  add(new THREE.CylinderGeometry(7, 7.3, 0.25, 32), M.stoneDark, 0, 0.12, 0, { parent: way, cast: false });
  add(new THREE.RingGeometry(5.4, 5.8, 48), M.rune, 0, 0.26, 0, { parent: way, rx: -Math.PI / 2, cast: false });
  const runes = [];
  ['caves', 'mine', 'throne', 'village'].forEach((id, i) => { const a = i / 4 * Math.PI * 2 + Math.PI / 4, x = Math.cos(a) * 5.6, z = Math.sin(a) * 5.6;
    add(new THREE.BoxGeometry(1.1, 3.2, 0.7), M.stone, x, 1.6, z, { parent: way, ry: -a });
    const r = add(new THREE.BoxGeometry(0.5, 0.5, 0.05), M.rune.clone(), x - Math.cos(a) * 0.37, 2.2, z - Math.sin(a) * 0.37, { parent: way, ry: -a + Math.PI / 2, cast: false }); runes.push(r);
    circles.push([x, -31 + z, 0.8, 3.4]); });
  const portal = add(new THREE.TorusGeometry(2.2, 0.22, 10, 40), M.stone, 0, 2.6, 0, { parent: way });
  const veil = add(new THREE.CircleGeometry(2.0, 40), new THREE.MeshBasicMaterial({ color: '#7fe3ff', transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }), 0, 2.6, 0, { parent: way, cast: false });
  vl(0, 2.6, -31, '#5fd0ff', 10, 14);
  for (const s of [-1, 1]) circles.push([s * 2.2, -31, 0.35, 5]);
  interactables.push({ id: 'waystone', name: 'Waystone', x: 0, z: -28, r: 3.4, verb: 'Travel' });

  // Creek (S) + bridge
  add(new THREE.PlaneGeometry(90, 4.2), M.ice, 0, 0.02, 24, { rx: -Math.PI / 2, cast: false });
  for (const s of [-1, 1]) for (let i = 0; i < 24; i++) add(new THREE.SphereGeometry(0.7 + rnd() * 0.6, 7, 5), M.snowCap, -44 + i * 3.8 + rnd(), 0.05, 24 + s * (2.3 + rnd() * 0.4), { cast: false });
  add(new THREE.BoxGeometry(3.6, 0.18, 6), M.plank, 0, 0.09, 24);
  for (const s of [-1, 1]) { add(new THREE.BoxGeometry(0.12, 0.12, 6), M.woodDark, s * 1.75, 1.0, 24);
    for (let i = 0; i < 4; i++) add(new THREE.BoxGeometry(0.16, 1.0, 0.16), M.woodDark, s * 1.75, 0.5, 21.2 + i * 1.9); }

  // Lamp posts along paths (6 real lights, the rest emissive only)
  const posts = [[3, -10], [-3, -20], [3, -24], [-3, 10], [3, 18], [-3, 30], [9, -2], [-9, 2]];
  posts.forEach(([x, z], i) => { const p = new THREE.Group(); p.position.set(x, 0, z); group.add(p);
    add(new THREE.CylinderGeometry(0.1, 0.14, 3.2, 8), M.iron, 0, 1.6, 0, { parent: p });
    add(new THREE.BoxGeometry(0.7, 0.08, 0.08), M.iron, 0.3, 3.15, 0, { parent: p });
    const l = makeLantern(M, 1.6); l.position.set(0.6, 2.85, 0); p.add(l); animated.push({ o: l, swing: i + 7 });
    vl(x + 0.6, 2.8, z, '#ffb35a', 8, 12, { flicker: 0.05 });
    circles.push([x, z, 0.25, 3.3]); });

  // Pines: 3-tier cones with snow tips, instanced
  const tiers = [[2.2, 2.6, 1.4], [1.7, 2.2, 2.9], [1.15, 1.9, 4.2]];
  const trunkGeo = new THREE.CylinderGeometry(0.22, 0.3, 1.6, 6); trunkGeo.translate(0, 0.8, 0);
  const tierGeos = tiers.map(([r, h, y]) => { const g = new THREE.ConeGeometry(r, h, 8); g.translate(0, y + h / 2 - 0.3, 0); return g; });
  const capGeos = tiers.map(([r, h, y]) => { const g = new THREE.ConeGeometry(r * 0.55, h * 0.45, 8); g.translate(0, y + h - 0.3 - h * 0.22 + 0.05, 0); return g; });
  const spots = [];
  for (let i = 0; i < (mobile ? 110 : 190); i++) { const a = rnd() * Math.PI * 2, r = 42 + rnd() * 50; spots.push([Math.cos(a) * r, Math.sin(a) * r, 0.8 + rnd() * 0.9]); }
  for (const [x, z] of [[-24, -36], [24, -38], [-40, -10], [40, -8], [-38, 20], [40, 22], [-10, 40], [12, 42], [-28, -6], [28, -2]]) spots.push([x, z, 0.9 + rnd() * 0.4]);
  const groundY = (x, z) => { const r = Math.hypot(x, z); return THREE.MathUtils.smoothstep(r, 44, 70) * (6 + Math.sin(x * 0.11) * 2.5 + Math.cos(z * 0.13) * 2.5); };
  const inst = (geo, mat) => { const m = new THREE.InstancedMesh(geo, mat, spots.length); m.castShadow = true; m.receiveShadow = true; group.add(m); return m; };
  const tMesh = inst(trunkGeo, M.trunk), cones = tierGeos.map((g, i) => inst(g, i % 2 ? M.pineDark : M.pine)), caps = capGeos.map(g => inst(g, M.snowCap));
  const mx = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), pv = new THREE.Vector3();
  spots.forEach(([x, z, s], i) => { q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rnd() * 6.28); sc.set(s, s * (0.9 + rnd() * 0.3), s); pv.set(x, groundY(x, z) - 0.1, z); mx.compose(pv, q, sc);
    tMesh.setMatrixAt(i, mx); cones.forEach(c => c.setMatrixAt(i, mx)); caps.forEach(c => c.setMatrixAt(i, mx)); if (Math.hypot(x, z) < 46) circles.push([x, z, 0.5 * s, 8]); });

  // Cliffs + frozen waterfall to the north
  for (let i = 0; i < 14; i++) { const x = -60 + i * 9 + rnd() * 4, z = -58 - rnd() * 10, s = 7 + rnd() * 6;
    const r = add(new THREE.IcosahedronGeometry(s, 0), i % 3 ? M.stone : M.stoneDark, x, s * 0.6 + groundY(x, z) * 0.5, z, { ry: rnd() * 3 }); r.scale.y = 1.4 + rnd() * 0.6; }
  add(new THREE.BoxGeometry(5, 20, 1.5), M.ice, 6, 10, -55, { rx: 0.08 });

  // Villagers: block figures with lanterns (placeholders until the NPC module)
  const npc = (x, z, ry, coat, hat) => { const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; group.add(g);
    add(new THREE.BoxGeometry(0.9, 1.1, 0.55), coat, 0, 1.45, 0, { parent: g });
    add(new THREE.BoxGeometry(1.05, 0.5, 0.65), coat, 0, 0.75, 0, { parent: g });
    for (const s of [-1, 1]) add(new THREE.BoxGeometry(0.35, 0.6, 0.4), M.woodDark, s * 0.24, 0.3, 0, { parent: g });
    add(new THREE.BoxGeometry(0.7, 0.7, 0.7), new THREE.MeshStandardMaterial({ color: '#f1c9a5', roughness: 0.8 }), 0, 2.35, 0, { parent: g });
    add(new THREE.BoxGeometry(0.75, 0.3, 0.75), M.snowCap, 0, 2.05, 0.02, { parent: g }); // beard / scarf
    add(new THREE.ConeGeometry(0.5, 0.8, 8), hat, 0, 3.05, 0, { parent: g });
    for (const s of [-1, 1]) add(new THREE.BoxGeometry(0.1, 0.1, 0.02), new THREE.MeshBasicMaterial({ color: '#1a1a22' }), s * 0.16, 2.42, 0.36, { parent: g, cast: false });
    const l = makeLantern(M, 1.3); l.position.set(0.62, 1.2, 0.25); g.add(l); animated.push({ o: g, bob: x });
    circles.push([x, z, 0.6, 3]); return g; };
  npc(18.5, -9.4, Math.PI * 0.1, M.cloth, M.iron);           // Brann
  npc(-17, -8.8, 0, M.cloth2, M.roof);                        // Ysolde
  npc(-14.2, 15.2, -Math.PI / 2, M.roofGreen, M.roofGreen);   // Moss
  npc(11.5, 14.5, -Math.PI * 0.75, new THREE.MeshStandardMaterial({ color: '#5a4a7a' }), new THREE.MeshStandardMaterial({ color: '#8a7ab0' })); // Elder Wick

  const t0 = { v: 0 };
  return {
    group, interactables, runes, dummies, hearthLight, occluders: occluders.flatMap(g => { const out = []; g.traverse(o => { if (o.isMesh) out.push(o); }); return out; }), // camera ray is non-recursive
    colliders(col) { for (const b of boxes) col.addBox(...b); for (const [x, z, r, top] of circles) col.addCircle(x, z, r, top); },
    update(dt, t) {
      t0.v = t;
      flames.forEach((f, i) => { const k = 1 + Math.sin(t * (9 + i) + i * 1.7) * 0.18; f.scale.set(1 / Math.sqrt(k), k, 1 / Math.sqrt(k)); f.rotation.y = t * (0.6 + i * 0.1); });
      for (const d of dummies) { if (d.wob > 0) d.wob = Math.max(0, d.wob - dt * 2); d.g.rotation.z = Math.sin(t * 25) * d.wob * 0.25; }
      embers.update(dt, t);
      veil.material.opacity = 0.28 + Math.sin(t * 2) * 0.08; veil.rotation.z = t * 0.3; portal.rotation.z = Math.sin(t * 0.5) * 0.05;
      runes.forEach((r, i) => { r.material.emissiveIntensity = 1.1 + Math.sin(t * 2 + i) * 0.4; });
      for (const a of animated) { if (a.swing != null) a.o.rotation.z = Math.sin(t * 1.3 + a.swing) * 0.06; if (a.bob != null) a.o.position.y = Math.abs(Math.sin(t * 1.6 + a.bob)) * 0.05; }
    },
  };
}
