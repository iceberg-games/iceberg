// Shared builders for the tier-2/3 dungeons (Sunken Mine, Aurora Throne). Same uniform API as buildCaves:
// { group, posts, chests, veins, sacs, interactables, vlights, colliders(col), setGate, gateClosed, setExit, update }.
import * as THREE from 'three';
import { makeLantern } from './common.js';
import { makeGlowDecal } from '../fx.js';

function sdfShape(s, x, z) {
  if (s.c) return Math.hypot(x - s.c[0], z - s.c[1]) - s.r;
  const [x0, z0, x1, z1] = s.rect, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, hx = (x1 - x0) / 2, hz = (z1 - z0) / 2;
  const dx = Math.abs(x - cx) - hx, dz = Math.abs(z - cz) - hz;
  return Math.hypot(Math.max(dx, 0), Math.max(dz, 0)) + Math.min(Math.max(dx, dz), 0);
}
export const sdfOf = (shapes) => (x, z) => { let d = Infinity; for (const s of shapes) d = Math.min(d, sdfShape(s, x, z)); return d; };
export const hash = (x, z) => { const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return s - Math.floor(s); };
export const makeRnd = (seed) => { let s = seed; return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; };

export function makeKit({ area, lights, group, M }) {
  const circles = [], boxes = [], interactables = [], vlights = [];
  const add = (geo, mat, x, y, z, o = {}) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); if (o.ry) m.rotation.y = o.ry; if (o.rx) m.rotation.x = o.rx; if (o.rz) m.rotation.z = o.rz; m.castShadow = o.cast ?? true; m.receiveShadow = true; (o.parent || group).add(m); return m; };
  const vl = (x, y, z, color, intensity, distance, o) => { const v = lights.add(x, y, z, color, intensity, distance, { area, ...o }); vlights.push(v); return v; };
  const mx = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), pv = new THREE.Vector3(), eu = new THREE.Euler();
  /** Instanced mesh from [x,y,z, sx,sy,sz, rx,ry,rz] rows. */
  const inst = (geo, mat, rows, o = {}) => { if (!rows.length) return null; const im = new THREE.InstancedMesh(geo, mat, rows.length); im.castShadow = o.cast ?? true; im.receiveShadow = true;
    rows.forEach((r, i) => { q.setFromEuler(eu.set(r[6] || 0, r[7] || 0, r[8] || 0)); sc.set(r[3] ?? 1, r[4] ?? 1, r[5] ?? 1); pv.set(r[0], r[1], r[2]); mx.compose(pv, q, sc); im.setMatrixAt(i, mx); if (o.colors) im.setColorAt(i, o.colors[i]); });
    (o.parent || group).add(im); return im; };

  /** Vertex-coloured floor. fall(d) gives y outside the walkable area (rise for rock walls, drop for cliffs). */
  function floor(sdf, { cx, cz, w, h, seg = 2, colors, fall, rough = 0.9, metal = 0.02, flat = false, wobble = 0.04 }) {
    const g = new THREE.PlaneGeometry(w, h, Math.round(w * seg), Math.round(h * seg)); g.rotateX(-Math.PI / 2); g.translate(cx, 0, cz);
    const p = g.attributes.position, cols = new Float32Array(p.count * 3), [cA, cB, cC] = colors.map(c => new THREE.Color(c)), t = new THREE.Color();
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i), d = sdf(x, z), n = hash(Math.floor(x * 0.7), Math.floor(z * 0.7)) * 0.5 + hash(Math.floor(x * 0.23), Math.floor(z * 0.23)) * 0.5;
      t.copy(cA).lerp(cC, n * 0.6).lerp(cB, THREE.MathUtils.smoothstep(d, -3.5, -0.3) * 0.8); cols.set([t.r, t.g, t.b], i * 3);
      p.setY(i, d > 0 ? fall(d, x, z) : Math.sin(x * 1.3) * Math.cos(z * 1.1) * wobble); }
    g.setAttribute('color', new THREE.BufferAttribute(cols, 3)); g.computeVertexNormals();
    return add(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: rough, metalness: metal, flatShading: flat }), 0, 0, 0, { cast: false });
  }
  /** Walk the area edge on a grid: cb(x, z, d) for every jittered point with d in [dmin, dmax]. Also adds edge colliders. */
  function edge(sdf, { x0, x1, z0, z1, step = 1.5, top = 14 }, cb) {
    for (let x = x0; x <= x1; x += step) for (let z = z0; z <= z1; z += step) { const jx = x + (hash(x, z) - 0.5) * 0.6, jz = z + (hash(z, x) - 0.5) * 0.6, d = sdf(jx, jz);
      if (d > 0 && d < 1.7) circles.push([jx, jz, 0.95, top]); cb?.(jx, jz, d); }
  }
  /** Inward normal of the SDF at x,z. */
  const inward = (sdf, x, z) => { const e = 0.5, gx = sdf(x + e, z) - sdf(x - e, z), gz = sdf(x, z + e) - sdf(x, z - e), l = Math.hypot(gx, gz) || 1; return [-gx / l, -gz / l]; };

  function waystone(wx, wz, mat = M.stone) {
    add(new THREE.CylinderGeometry(2.6, 2.8, 0.25, 24), M.stoneDark, wx, 0.12, wz, { cast: false });
    const ring = add(new THREE.TorusGeometry(1.4, 0.16, 8, 32), mat, wx, 1.8, wz);
    const veil = add(new THREE.CircleGeometry(1.25, 32), new THREE.MeshBasicMaterial({ color: '#7fe3ff', transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }), wx, 1.8, wz, { cast: false });
    vl(wx, 1.8, wz, '#5fd0ff', 6, 10); circles.push([wx - 1.4, wz, 0.25, 4], [wx + 1.4, wz, 0.25, 4]);
    interactables.push({ id: 'waystone', name: 'Waystone', x: wx, z: wz - 2, r: 2.8, verb: 'Return' });
    return (t) => { veil.material.opacity = 0.28 + Math.sin(t * 2) * 0.08; veil.rotation.z = t * 0.4; ring.rotation.z = Math.sin(t * 0.5) * 0.05; };
  }
  function chest(c, name, mat) {
    const g = new THREE.Group(); g.position.set(c.x, 0, c.z); g.rotation.y = c.ry || 0; group.add(g);
    add(new THREE.BoxGeometry(1.3, 0.75, 0.85), mat, 0, 0.38, 0, { parent: g });
    for (const s of [-1, 1]) add(new THREE.BoxGeometry(0.1, 0.8, 0.9), M.brass, s * 0.5, 0.4, 0, { parent: g });
    const lid = new THREE.Group(); lid.position.set(0, 0.75, -0.42); g.add(lid);
    add(new THREE.CylinderGeometry(0.43, 0.43, 1.3, 12, 1, false, 0, Math.PI), mat, 0, 0, 0.42, { parent: lid }).rotation.set(0, 0, Math.PI / 2);
    add(new THREE.BoxGeometry(0.22, 0.26, 0.08), M.brass, 0, -0.05, 0.86, { parent: lid });
    const glow = makeGlowDecal('#ffd27a', 0.25); glow.scale.setScalar(1.8); glow.position.set(c.x, 0.07, c.z); group.add(glow);
    circles.push([c.x, c.z, 0.75, 1]);
    const rec = { ...c, g, lid, glow, open: false };
    rec.setOpen = (on) => { rec.open = on; lid.rotation.x = on ? -1.9 : 0; glow.visible = !on; };
    interactables.push({ id: c.id, kind: 'chest', name, x: c.x, z: c.z, r: 2.2, verb: 'Open' });
    return rec;
  }
  /** Return portal that appears when the boss falls. */
  function exitPortal(x, z, color = '#ffd27a') {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.visible = false; group.add(g);
    add(new THREE.TorusGeometry(1.4, 0.15, 8, 32), M.rune, 0, 1.8, 0, { parent: g });
    const veil = add(new THREE.CircleGeometry(1.25, 32), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.4, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }), 0, 1.8, 0, { parent: g, cast: false });
    return { g, set(on) { g.visible = on; const it = interactables.find(i => i.id === 'exit'); if (on && !it) interactables.push({ id: 'exit', name: 'Hearthward portal', x, z, r: 2.6, verb: 'Return home' }); if (!on && it) interactables.splice(interactables.indexOf(it), 1); },
      update(t) { veil.material.opacity = 0.35 + Math.sin(t * 3) * 0.1; veil.rotation.z = -t; } };
  }
  /** Gate box with a visual that sinks/rises. api.gateClosed tracks state. */
  function gate(G, visual, gateLight, sink = 6.5) {
    let box = null, k = 1, col = null;
    return { bind(c) { col = c; }, set(closed, api) { if (!col) return; if (closed && !box) box = col.addBox(G.x0, 0, G.z0, G.x1, 7, G.z1); if (!closed && box) { col.removeBox(box); box = null; } api.gateClosed = closed; },
      update(dt, closed) { const want = closed ? 1 : 0; k += (want - k) * Math.min(1, dt * 2); if (sink > 0) { visual.position.y = (k - 1) * sink; visual.visible = k > 0.02; } else visual.position.y = (1 - k) * -sink; if (gateLight) gateLight.mul = k; return k; } };
  }
  return { add, vl, inst, floor, edge, inward, waystone, chest, exitPortal, gate, circles, boxes, interactables, vlights, makeLantern, makeGlowDecal };
}
