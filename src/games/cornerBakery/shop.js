// Corner Bakery Rush: the 3D bakery, street and lighting.
// Layout (x: left/right, z: back(-) to front(+)):
//   back wall z=-7  ovens · fryer · frosting · coffee · sink · trash
//   aisle            the baker's side
//   front counter z=-1.5..-0.5 (glass display case at the left end)
//   customer area    tables, door at x=0 in the front wall z=7
//   sidewalk z=7.3..11, street, buildings across the road
import * as THREE from 'three';
import { Collision } from '../../engine/collision.js';
import { prop } from './props.js';
import * as T from './textures.js';
import { mulberry } from './logic.js';

export const ROOM = { minX: -9, maxX: 9, minZ: -7, maxZ: 7, H: 5.2, FACADE_H: 9.6 };
export const SLOT_X = [-3.4, -0.9, 1.6, 4.1];
export const SLOT_Z = 0.65;
const COUNTER_TOP = 1.05, FRONT_TOP = 1.18;

/** Where the baker interacts with each target (x, z) and where its progress badge floats. */
export const STATIONS = {
  ovenA:   { name: 'Oven 1',          x: -7.2, z: -5.25, badge: [-7.2, 3.35, -5.7] },
  ovenB:   { name: 'Oven 2',          x: -4.6, z: -5.25, badge: [-4.6, 3.35, -5.7] },
  fryer:   { name: 'Donut Fryer',     x: -1.8, z: -5.25, badge: [-1.8, 2.25, -6.2] },
  frost:   { name: 'Frosting Bench',  x: 0.85, z: -5.25, badge: [0.85, 2.25, -6.2] },
  coffee:  { name: 'Coffee Machine',  x: 3.4,  z: -5.25, badge: [3.4, 2.65, -6.2] },
  display: { name: 'Pastry Case',     x: -7.4, z: -1.95, badge: [-7.4, 2.75, -1.0] },
  trash:   { name: 'Trash Bin',       x: 7.9,  z: -4.55, badge: [7.9, 1.9, -5.0] },
};

// ---------- geometry helpers ----------
/** Box from min/max corners with world-space UVs (seamless across boxes). */
function worldBoxGeo(x0, y0, z0, x1, y1, z1) {
  const g = new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0);
  g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  const p = g.attributes.position, n = g.attributes.normal, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i));
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    if (ax > 0.5) uv.setXY(i, n.getX(i) > 0 ? -z : z, y);
    else if (ay > 0.5) uv.setXY(i, x, -z);
    else uv.setXY(i, n.getZ(i) > 0 ? x : -x, y);
  }
  return g;
}
const m = (o) => new THREE.MeshStandardMaterial({ roughness: 0.7, ...o });
const worldTex = (t, meters) => { t.repeat.set(1 / meters[0], 1 / (meters[1] || meters[0])); return t; };

export function buildShop() {
  const root = new THREE.Group();
  const collision = new Collision({ floorY: 0, bounds: { type: 'box', minX: -14, maxX: 14, minZ: ROOM.minZ + 0.45, maxZ: 10.6 } });
  const occluders = [];
  const anim = [];   // per-frame callbacks (dt, t, ctx)
  const mats = [];
  const keep = (mat) => { mats.push(mat); return mat; };

  // ---------- materials ----------
  const M = {
    checker: keep(m({ map: worldTex(T.checkerTex('#f4ead7', '#3f6f69'), [3]), roughness: 0.42 })),
    ktile: keep(m({ map: worldTex(T.kitchenTileTex(), [2.4]), roughness: 0.5 })),
    plaster: keep(m({ map: worldTex(T.plasterTex('#f7e6cb'), [4]), roughness: 0.95 })),
    subway: keep(m({ map: worldTex(T.subwayTex(), [1.6]), roughness: 0.25 })),
    bead: keep(m({ map: worldTex(T.beadboardTex('#4c8a7d'), [1.2, 1.2]), roughness: 0.6 })),
    beadCream: keep(m({ map: worldTex(T.beadboardTex('#efe1c6'), [1.2, 1.2]), roughness: 0.6 })),
    brick: keep(m({ map: worldTex(T.brickTex(), [2.2]), roughness: 0.9 })),
    brick2: keep(m({ map: worldTex(T.brickTex([1, 1], 200), [2.2]), roughness: 0.9 })),
    wood: keep(m({ map: worldTex(T.woodTex([156, 102, 60]), [2, 1]), roughness: 0.55 })),
    darkWood: keep(m({ map: worldTex(T.woodTex([92, 60, 38]), [2, 1]), roughness: 0.55 })),
    marble: keep(m({ map: worldTex(T.marbleTex(), [2]), roughness: 0.18, metalness: 0.02 })),
    trimWhite: keep(m({ color: '#fbf6ec', roughness: 0.5 })),
    trimGreen: keep(m({ color: '#2f5b55', roughness: 0.5 })),
    brass: keep(m({ color: '#d4a64a', metalness: 0.85, roughness: 0.3 })),
    copper: keep(m({ color: '#c8794a', metalness: 0.85, roughness: 0.32 })),
    steel: keep(m({ color: '#c9d0d6', metalness: 0.75, roughness: 0.32 })),
    darkSteel: keep(m({ color: '#3a4048', metalness: 0.6, roughness: 0.4 })),
    black: keep(m({ color: '#1d2126', roughness: 0.5 })),
    glass: keep(new THREE.MeshStandardMaterial({ color: '#cfe8f2', transparent: true, opacity: 0.16, roughness: 0.04, metalness: 0.1, depthWrite: false })),
    sidewalk: keep(m({ map: worldTex(T.sidewalkTex(), [3]), roughness: 0.85 })),
    road: keep(m({ map: T.roadTex(), roughness: 0.75 })),
    snow: keep(m({ map: worldTex(T.snowTex(), [4]), color: '#ffffff', roughness: 0.92 })),
    snowFlat: keep(m({ color: '#f5f9ff', roughness: 0.9, flatShading: true })),
    awning: keep(m({ map: T.awningTex(), roughness: 0.8, side: THREE.DoubleSide })),
    lampGlow: keep(new THREE.MeshStandardMaterial({ color: '#fff1c9', emissive: '#ffd27a', emissiveIntensity: 2.2 })),
  };
  M.road.map.repeat.set(1 / 16, 1 / 8); M.road.map.offset.set(0, 0.5 - 15 / 8);

  const add = (mesh, { cast = true, receive = true } = {}) => { mesh.castShadow = cast; mesh.receiveShadow = receive; root.add(mesh); return mesh; };
  /** Solid world box. opts: collide, occlude, cast. */
  const box = (x0, y0, z0, x1, y1, z1, mat, { collide = false, occlude = false, cast = true, receive = true } = {}) => {
    const mesh = add(new THREE.Mesh(worldBoxGeo(x0, y0, z0, x1, y1, z1), mat), { cast, receive });
    if (collide) collision.addBox(x0, y0, z0, x1, y1, z1);
    if (occlude) occluders.push(mesh);
    return mesh;
  };
  const place = (obj, x, y, z, ry = 0) => { obj.position.set(x, y, z); obj.rotation.y = ry; root.add(obj); return obj; };

  // ---------- floors ----------
  box(-9, -0.2, -7, 9, 0, -1.5, M.ktile, { cast: false });
  box(-9, -0.2, -1.5, 9, 0, 7, M.checker, { cast: false });
  box(-1.2, -0.2, 7, 1.2, 0.02, 7.3, M.darkWood, { cast: false }); // threshold

  // ---------- interior walls (with wainscot) ----------
  const T_ = 0.3, H = ROOM.H;
  // back wall: subway tile band behind the counters
  box(-9.3, 0, -7.3, 9.3, H, -7, M.plaster, { collide: true, occlude: true });
  box(-9, 1.0, -7.02, 9, 3.05, -6.99, M.subway, { cast: false });
  box(-9, 3.05, -7.0, 9, 3.13, -6.92, M.trimWhite, { cast: false });
  // side walls
  for (const s of [-1, 1]) {
    const x0 = s < 0 ? -9.3 : 9, x1 = s < 0 ? -9 : 9.3;
    box(x0, 0, -7.3, x1, H, 7.3, M.plaster, { collide: true, occlude: true });
    const ix0 = s < 0 ? -9.0 : 8.96, ix1 = s < 0 ? -8.96 : 9.0;
    box(ix0, 0, -1.5, ix1, 1.2, 7, M.bead, { cast: false });
    box(s < 0 ? -9 : 8.9, 1.2, -1.5, s < 0 ? -8.9 : 9, 1.28, 7, M.darkWood, { cast: false });
    box(ix0, 1.0, -7, ix1, 3.05, -1.5, M.subway, { cast: false });
  }
  // wall caps (seen from the dollhouse camera)
  box(-9.35, H, -7.35, 9.35, H + 0.12, -6.95, M.trimGreen, { cast: false });
  box(-9.35, H, -7.35, -8.95, H + 0.12, 7.0, M.trimGreen, { cast: false });
  box(8.95, H, -7.35, 9.35, H + 0.12, 7.0, M.trimGreen, { cast: false });

  // ---------- front wall + facade (door x -1.2..1.2, windows x 2.2..7.6) ----------
  const FH = ROOM.FACADE_H, Z0 = 7, Z1 = 7.3;
  const front = (x0, y0, x1, y1) => {
    const g = worldBoxGeo(x0, y0, Z0, x1, y1, Z1);
    // groups: +x,-x,+y,-y,+z(outside),-z(inside)
    const mesh = add(new THREE.Mesh(g, [M.brick, M.brick, M.brick, M.brick, M.brick, y0 >= H ? M.brick : M.plaster]));
    collision.addBox(x0, y0, Z0, x1, y1, Z1); occluders.push(mesh); return mesh;
  };
  front(-9.3, 0, -7.6, FH); front(7.6, 0, 9.3, FH);
  front(-2.2, 0, -1.2, FH); front(1.2, 0, 2.2, FH);
  front(-1.2, 3.4, 1.2, FH);
  for (const s of [-1, 1]) { const a = s < 0 ? -7.6 : 2.2, b = s < 0 ? -2.2 : 7.6; front(a, 0, b, 0.9); front(a, 3.7, b, FH); }
  // inside wainscot on the front wall
  for (const [a, b] of [[-9, -7.6], [-7.6, -2.2], [-2.2, -1.2], [1.2, 2.2], [2.2, 7.6], [7.6, 9]]) box(a, 0, 6.96, b, Math.min(a > -7.6 && a < 7.6 && !(a === -2.2 || a === 1.2) ? 0.9 : 1.2, 1.2), 7.0, M.bead, { cast: false });
  // windows: frames, mullions, glass
  const glassPanes = [];
  for (const s of [-1, 1]) {
    const a = s < 0 ? -7.6 : 2.2, b = s < 0 ? -2.2 : 7.6, cx = (a + b) / 2;
    box(a - 0.05, 0.84, 6.9, b + 0.05, 0.98, 7.42, M.trimWhite);                 // sill
    box(a, 3.62, 6.95, b, 3.72, 7.35, M.trimWhite);                               // head
    for (const x of [a, cx, b]) box(x - 0.07, 0.9, 7.08, x + 0.07, 3.7, 7.22, M.trimWhite);
    box(a, 2.75, 7.1, b, 2.84, 7.2, M.trimWhite);                                 // transom bar
    const pane = add(new THREE.Mesh(new THREE.PlaneGeometry(b - a, 2.8), M.glass), { cast: false, receive: false });
    pane.position.set(cx, 2.3, 7.15); pane.renderOrder = 2; glassPanes.push(pane); occluders.push(pane);
  }
  // window lettering (outside of the left window) and neon OPEN sign (right window)
  { const t = T.windowLetterTex('Corner Bakery', 'fresh every morning');
    const mat = keep(new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, toneMapped: false, color: '#ffffff' }));
    const l = add(new THREE.Mesh(new THREE.PlaneGeometry(4.6, 2.3), mat), { cast: false, receive: false }); l.position.set(-4.9, 2.05, 7.24); l.renderOrder = 3;
    const neon = keep(new THREE.MeshBasicMaterial({ map: T.neonTex(), toneMapped: false }));
    const n = add(new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.75), neon), { cast: false, receive: false }); n.position.set(6.2, 2.2, 7.0);
    const nb = add(new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.75), M.black), { cast: false }); nb.position.set(6.2, 2.2, 6.99); nb.rotation.y = Math.PI;
    anim.push((dt, t2) => { neon.color.setScalar(0.85 + 0.15 * Math.sin(t2 * 3.1) + (Math.sin(t2 * 23) > 0.97 ? -0.4 : 0)); });
  }
  // door frame + glass door (hinged on the left, swings inward)
  box(-1.3, 0, 6.9, -1.2, 3.45, 7.4, M.trimGreen); box(1.2, 0, 6.9, 1.3, 3.45, 7.4, M.trimGreen); box(-1.3, 3.4, 6.9, 1.3, 3.52, 7.4, M.trimGreen);
  const door = new THREE.Group(); door.position.set(-1.15, 0, 7.12); root.add(door);
  { const fr = (x0, y0, x1, y1) => { const b = new THREE.Mesh(worldBoxGeo(x0, y0, -0.05, x1, y1, 0.05), M.trimGreen); b.castShadow = true; door.add(b); };
    fr(0, 0, 2.3, 0.35); fr(0, 3.15, 2.3, 3.35); fr(0, 0, 0.14, 3.35); fr(2.16, 0, 2.3, 3.35); fr(0, 1.45, 2.3, 1.55);
    const dg = new THREE.Mesh(new THREE.PlaneGeometry(2.02, 2.8), M.glass); dg.position.set(1.15, 1.75, 0); door.add(dg);
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.7, 8), M.brass); handle.position.set(1.95, 1.3, -0.12); door.add(handle);
    const bell = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), M.brass); bell.rotation.x = Math.PI; bell.position.set(0.9, 3.3, -0.32); root.add(bell); bell.position.add(door.position);
  }
  const doorState = { open: 0, target: 0 };
  anim.push((dt) => { doorState.open += (doorState.target - doorState.open) * Math.min(1, dt * 6); door.rotation.y = doorState.open * 1.45; });

  // ---------- back counter run, ovens, stations ----------
  // cabinets + marble top (x from -3.3 to 9; ovens fill the left)
  box(-3.3, 0, -7, 9, 0.12, -5.75, M.black, { collide: true });
  box(-3.3, 0.12, -7, 9, COUNTER_TOP - 0.08, -5.78, M.beadCream, { collide: true });
  box(-3.35, COUNTER_TOP - 0.08, -7, 9, COUNTER_TOP, -5.68, M.marble, { collide: true });
  for (let x = -3.3; x < 9; x += 1.55) box(x + 0.7, 0.62, -5.8, x + 0.85, 0.66, -5.74, M.brass, { cast: false }); // drawer pulls

  // two deck ovens (x centres -7.2 and -4.6)
  const ovens = {};
  for (const [id, cx] of [['ovenA', -7.2], ['ovenB', -4.6]]) {
    const x0 = cx - 1.2, x1 = cx + 1.2;
    box(x0, 0, -7, x1, 0.9, -5.6, M.darkSteel, { collide: true });
    box(x0 + 0.1, 0.1, -5.62, x1 - 0.1, 0.8, -5.58, M.black, { cast: false });
    box(x0, 0.9, -7, x1, 2.55, -5.55, M.steel, { collide: true });
    box(x0, 2.55, -7, x1, 3.0, -5.7, M.brick2, { collide: true }); // brick crown
    box(x0 + 0.25, 1.1, -5.56, x1 - 0.25, 2.25, -5.5, M.black, { cast: false }); // door recess
    const glowMat = keep(new THREE.MeshStandardMaterial({ color: '#2a1408', emissive: '#ff7a2a', emissiveIntensity: 0.15, transparent: true, opacity: 0.72, roughness: 0.1 }));
    const win = add(new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.75), glowMat), { cast: false }); win.position.set(cx, 1.68, -5.48); win.renderOrder = 2;
    const handle = add(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.8, 10), M.brass)); handle.rotation.z = Math.PI / 2; handle.position.set(cx, 2.42, -5.42);
    for (const k of [-0.5, -0.2]) { const knob = add(new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.08, 14), M.black)); knob.rotation.x = Math.PI / 2; knob.position.set(cx + 0.95 + k * 0, 1.2 + (k + 0.5) * 1.4, -5.5); }
    const lampMat = keep(new THREE.MeshStandardMaterial({ color: '#333', emissive: '#40ff7a', emissiveIntensity: 0 }));
    const lamp = add(new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 8), lampMat), { cast: false }); lamp.position.set(cx + 0.95, 0.97 + 0.0, -5.5); lamp.position.y = 2.42 - 0.24;
    const inside = new THREE.Group(); inside.position.set(cx, 1.32, -6.05); root.add(inside);
    const plateMat = M.darkSteel; const rack = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.04, 0.9), plateMat); inside.add(rack);
    ovens[id] = { glowMat, lampMat, inside, x: cx, item: null };
  }
  // copper hood over the ovens
  { box(-7.6, 3.25, -7, -4.2, 3.55, -6.05, M.copper, { cast: false });          // canopy
    box(-7.65, 3.18, -6.1, -4.15, 3.28, -5.98, M.brass, { cast: false });       // lip
    box(-6.5, 3.55, -7, -5.3, ROOM.H, -6.5, M.copper, { cast: false }); }       // flue
  // fryer (x -2.9..-0.7)
  const fryer = {};
  { box(-2.95, COUNTER_TOP, -7, -0.65, COUNTER_TOP + 0.2, -5.7, M.steel, { collide: true });
    const oilMat = keep(new THREE.MeshStandardMaterial({ color: '#c78a2c', emissive: '#6a3a08', emissiveIntensity: 0.5, roughness: 0.15, metalness: 0.2 }));
    const oil = add(new THREE.Mesh(new THREE.PlaneGeometry(1.7, 0.85), oilMat), { cast: false }); oil.rotation.x = -Math.PI / 2; oil.position.set(-1.8, COUNTER_TOP + 0.205, -6.3);
    const rim = (x0, z0, x1, z1) => box(x0, COUNTER_TOP + 0.2, z0, x1, COUNTER_TOP + 0.27, z1, M.darkSteel, { cast: false });
    rim(-2.75, -6.8, -0.85, -6.72); rim(-2.75, -5.88, -0.85, -5.8); rim(-2.75, -6.8, -2.67, -5.8); rim(-0.93, -6.8, -0.85, -5.8);
    const basketHandle = add(new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.9, 8), M.black)); basketHandle.rotation.x = Math.PI / 2.6; basketHandle.position.set(-1.8, COUNTER_TOP + 0.55, -5.75);
    const donuts = new THREE.Group(); donuts.position.set(-1.8, COUNTER_TOP + 0.2, -6.3); root.add(donuts);
    for (const dx of [-0.35, 0.35]) { const d = prop('donut', 0.42); d.position.x = dx; d.position.y = -0.06; donuts.add(d); }
    donuts.visible = false;
    // bubbles
    const bubGeo = new THREE.SphereGeometry(0.04, 6, 4), bubMat = keep(new THREE.MeshStandardMaterial({ color: '#ffe0a0', roughness: 0.2, transparent: true, opacity: 0.8 }));
    const bubbles = new THREE.InstancedMesh(bubGeo, bubMat, 24); bubbles.position.copy(donuts.position); bubbles.count = 0; root.add(bubbles);
    const bubState = Array.from({ length: 24 }, (_, i) => ({ x: (Math.random() - 0.5) * 1.5, z: (Math.random() - 0.5) * 0.7, t: Math.random() }));
    Object.assign(fryer, { oilMat, donuts, bubbles, bubState, lock: null });
    // little "Day 2" chain sign shown while locked
    const lockSign = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.42), keep(new THREE.MeshBasicMaterial({ map: T.canvasTex(256, 96, (g, w, h) => { g.fillStyle = '#fff6df'; g.beginPath(); g.roundRect(4, 4, w - 8, h - 8, 16); g.fill(); g.strokeStyle = '#c28b2c'; g.lineWidth = 6; g.stroke(); g.fillStyle = '#6b4a1e'; g.font = '800 38px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('Opens Day 2', w / 2, h / 2 + 2); }) })));
    lockSign.position.set(-1.8, COUNTER_TOP + 0.7, -5.66); root.add(lockSign); fryer.lock = lockSign;
  }
  // frosting bench (x -0.3..2.0): chocolate + pink bowls, sprinkle jar, piping bag
  const frost = {};
  { const bowl = (x, color, top) => {
      const b = prop('bowl', 0.62); b.traverse(o => { if (o.isMesh) { o.material = o.material.clone(); o.material.color.set(color); keep(o.material); } }); place(b, x, COUNTER_TOP, -6.25);
      const fill = add(new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.22, 0.04, 20), keep(m({ color: top, roughness: 0.35 }))), { cast: false }); fill.position.set(x, COUNTER_TOP + 0.17, -6.25);
    };
    bowl(0.3, '#f2efe8', '#5b331d'); bowl(1.35, '#f2efe8', '#ff8fc1');
    const jar = add(new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.36, 16), keep(new THREE.MeshStandardMaterial({ map: T.canvasTex(128, 64, (g, w, h) => { g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); const cols = ['#ff5a7a', '#ffd23f', '#4dd0e1', '#7bd389', '#b28dff']; for (let i = 0; i < 140; i++) { g.fillStyle = cols[i % 5]; g.fillRect(Math.random() * w, Math.random() * h, 5, 2); } }), roughness: 0.3 }))));
    jar.position.set(1.85, COUNTER_TOP + 0.18, -6.55);
    const bag = add(new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.5, 14), keep(m({ color: '#fff4fa', roughness: 0.5 })))); bag.rotation.z = Math.PI / 2.4; bag.position.set(0.85, COUNTER_TOP + 0.12, -5.95);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.42), fryer.lock.material); sign.position.set(0.85, COUNTER_TOP + 0.7, -5.66); root.add(sign); frost.lock = sign;
  }
  // coffee machine + cups
  const coffee = {};
  { const cm = prop('kitchenCoffeeMachine', 0.95, { by: 'height' }); place(cm, 3.4, COUNTER_TOP, -6.35, 0);
    for (let i = 0; i < 3; i++) { const c = prop('cup-saucer', 0.32); place(c, 4.35, COUNTER_TOP + i * 0.09, -6.4 + 0 * i); }
    const cup = prop('cup-coffee', 0.3); place(cup, 3.4, COUNTER_TOP, -6.0); cup.visible = false;
    coffee.cup = cup;
  }
  // sink + trash
  { box(5.1, COUNTER_TOP - 0.01, -6.75, 6.9, COUNTER_TOP + 0.005, -5.95, M.steel, { cast: false });
    box(5.25, COUNTER_TOP - 0.02, -6.62, 6.75, COUNTER_TOP + 0.01, -6.08, M.darkSteel, { cast: false });
    const tap = add(new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.035, 8, 16, Math.PI), M.steel)); tap.position.set(6.0, COUNTER_TOP + 0.3, -6.8); tap.rotation.y = 0;
    const tb = add(new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.32, 8), M.steel)); tb.position.set(5.78, COUNTER_TOP + 0.16, -6.8);
    const trash = prop('trashcan', 1.05, { by: 'height' }); place(trash, 7.9, 0, -5.0);
    collision.addCircle(7.9, -5.0, 0.45, 1.05);
    const roll = prop('rollingPin', 0.8); place(roll, 7.3, COUNTER_TOP, -6.4, 0.3);
    const cb = prop('cutting-board', 0.9); place(cb, 8.1, COUNTER_TOP, -6.3, -0.2);
    const wh = prop('whisk', 0.5); place(wh, 8.2, COUNTER_TOP + 0.05, -6.2, 0.7);
  }
  // back-wall shelves with bread + chalkboard menu
  const chalk = {};
  { for (const y of [3.45, 4.35]) {
      box(3.0, y, -7, 8.8, y + 0.08, -6.55, M.darkWood);
      for (const x of [3.3, 8.5]) box(x - 0.04, y - 0.3, -7, x + 0.04, y, -6.7, M.brass, { cast: false });
    }
    const r = mulberry(77);
    const breads = ['loaf', 'loaf-baguette', 'loaf-round', 'pie', 'bag', 'loaf', 'loaf-round', 'cake'];
    let k = 0;
    for (const y of [3.53, 4.43]) for (let x = 3.6; x < 8.5; x += 0.95) { const name = breads[k++ % breads.length]; const p = prop(name, name === 'loaf-baguette' ? 0.9 : 0.6); place(p, x + r() * 0.1, y, -6.78, name === 'loaf-baguette' ? 0.15 : r() * 0.6); }
    // chalkboard
    const c = document.createElement('canvas'); c.width = 768; c.height = 432;
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
    const board = add(new THREE.Mesh(new THREE.PlaneGeometry(4.6, 2.6), keep(new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85 }))), { cast: false });
    board.position.set(0.3, 4.2, -6.96);
    Object.assign(chalk, { canvas: c, tex });
    // wall clock
    const clockTex = T.canvasTex(128, 128, (g, w) => { g.fillStyle = '#fffaf0'; g.beginPath(); g.arc(64, 64, 60, 0, 7); g.fill(); g.lineWidth = 6; g.strokeStyle = '#2f5b55'; g.stroke(); g.fillStyle = '#333'; for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; g.fillRect(64 + Math.sin(a) * 48 - 2, 64 - Math.cos(a) * 48 - 2, 4, 4); } });
    const clock = add(new THREE.Mesh(new THREE.CircleGeometry(0.42, 32), keep(new THREE.MeshStandardMaterial({ map: clockTex }))), { cast: false }); clock.position.set(-8.97, 4.0, 2.5); clock.rotation.y = Math.PI / 2;
    const hand = add(new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.3, 0.02), M.black), { cast: false }); hand.geometry.translate(0, 0.13, 0); hand.position.set(-8.94, 4.0, 2.5); hand.rotation.y = Math.PI / 2;
    const hand2 = add(new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.2, 0.02), M.black), { cast: false }); hand2.geometry.translate(0, 0.09, 0); hand2.position.set(-8.93, 4.0, 2.5); hand2.rotation.y = Math.PI / 2;
    chalk.clock = { hand, hand2 };
  }

  // ---------- front counter + display case ----------
  const display = {};
  { const z0 = -1.5, z1 = -0.5;
    box(-8.9, 0, z0, 5.4, 0.15, z1, M.darkWood, { collide: true });
    box(-8.9, 0.15, z0 + 0.06, 5.4, FRONT_TOP - 0.08, z1, M.bead, { collide: true });
    box(-8.98, FRONT_TOP - 0.08, z0 - 0.04, 5.48, FRONT_TOP, z1 + 0.1, M.marble, { collide: true });
    box(-8.9, 0.95, z1 + 0.02, 5.4, 1.0, z1 + 0.06, M.brass, { cast: false });
    // display case on the left end
    const cx0 = -8.85, cx1 = -6.0;
    box(cx0, FRONT_TOP, z0, cx1, FRONT_TOP + 0.12, z1, M.darkWood, { collide: true });
    const gl = add(new THREE.Mesh(worldBoxGeo(cx0 + 0.05, FRONT_TOP + 0.12, z0 + 0.05, cx1 - 0.05, FRONT_TOP + 1.0, z1 - 0.05), M.glass), { cast: false, receive: false }); gl.renderOrder = 2;
    collision.addBox(cx0, FRONT_TOP, z0, cx1, FRONT_TOP + 1.0, z1);
    { const lid = add(new THREE.Mesh(worldBoxGeo(cx0, FRONT_TOP + 1.0, z0, cx1, FRONT_TOP + 1.03, z1), M.glass), { cast: false, receive: false }); lid.renderOrder = 2;
      for (const [a, b2] of [[cx0, cx0 + 0.06], [cx1 - 0.06, cx1]]) box(a, FRONT_TOP + 1.0, z0, b2, FRONT_TOP + 1.06, z1, M.darkWood); }
    box(cx0 + 0.1, FRONT_TOP + 0.55, z0 + 0.1, cx1 - 0.1, FRONT_TOP + 0.58, z1 - 0.1, M.glass, { cast: false });
    const caseLight = new THREE.PointLight('#fff2d6', 2.2, 3.2, 2); caseLight.position.set((cx0 + cx1) / 2, FRONT_TOP + 0.9, -1.0); root.add(caseLight);
    display.slots = {}; display.group = new THREE.Group(); root.add(display.group);
    display.layout = (items) => {
      display.group.clear(); display.slots = {};
      items.forEach((item, row) => {
        display.slots[item] = [];
        for (let i = 0; i < 4; i++) {
          const shelf = row < 2 ? 0 : 1, col = (row % 2) * 4 + i;
          const p = prop(item === 'cookie' ? 'cookie-chocolate' : item, 0.3);
          p.position.set(cx0 + 0.32 + col * 0.33, FRONT_TOP + 0.12 + shelf * 0.46, -1.0 + (shelf ? 0.05 : 0));
          p.rotation.y = i * 0.7; display.group.add(p); display.slots[item].push(p);
        }
      });
    };
    display.setStock = (stock) => { for (const [item, list] of Object.entries(display.slots)) list.forEach((p, i) => { p.visible = i < (stock[item] ?? 0); }); };
    // register, tip jar, cake dome, bell
    const reg = box(-5.4, FRONT_TOP, -1.35, -4.5, FRONT_TOP + 0.35, -0.75, M.trimGreen);
    box(-5.3, FRONT_TOP + 0.35, -1.3, -4.6, FRONT_TOP + 0.62, -1.24, M.black);
    const scr = add(new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.22), keep(new THREE.MeshBasicMaterial({ map: T.canvasTex(128, 48, (g, w, h) => { g.fillStyle = '#163a2c'; g.fillRect(0, 0, w, h); g.fillStyle = '#7dffb2'; g.font = '700 26px monospace'; g.fillText('$ 0.00', 10, 34); }), toneMapped: false }))), { cast: false });
    scr.position.set(-4.95, FRONT_TOP + 0.5, -1.235); scr.rotation.y = Math.PI;
    const jar = add(new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.36, 18, 1, true), M.glass), { cast: false }); jar.position.set(-4.1, FRONT_TOP + 0.18, -0.85);
    const coins = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.05, 0.05, 0.015, 10), keep(m({ color: '#e8b84a', metalness: 0.9, roughness: 0.3 })), 30); coins.count = 0; root.add(coins);
    display.tipJar = { coins, n: 0, add(n) { const M4 = new THREE.Matrix4(); for (let k = 0; k < n && coins.count < 30; k++) { const i = coins.count++; M4.makeRotationFromEuler(new THREE.Euler(Math.random() * 0.6, 0, Math.random() * 0.6)); M4.setPosition(-4.1 + (Math.random() - 0.5) * 0.18, FRONT_TOP + 0.02 + i * 0.012, -0.85 + (Math.random() - 0.5) * 0.18); coins.setMatrixAt(i, M4); } coins.instanceMatrix.needsUpdate = true; }, reset() { coins.count = 0; } };
    const cake = prop('cake', 0.55); place(cake, 4.6, FRONT_TOP + 0.08, -1.0);
    const stand = add(new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.2, 0.08, 24), M.trimWhite)); stand.position.set(4.6, FRONT_TOP + 0.04, -1.0);
    const dome = add(new THREE.Mesh(new THREE.SphereGeometry(0.44, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), M.glass), { cast: false }); dome.position.set(4.6, FRONT_TOP + 0.08, -1.0); dome.renderOrder = 2;
    const sb = add(new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), M.brass)); sb.position.set(3.7, FRONT_TOP, -0.8);
    for (const x of [-2.2, 0.3, 2.9]) { const pl = prop('plate', 0.45); place(pl, x, FRONT_TOP, -0.95); }
  }
  // counter gap (x 5.4..8.9) has a hinged flap drawn raised
  box(5.45, FRONT_TOP - 0.06, -1.5, 5.55, 2.2, -0.5, M.darkWood, { cast: true });

  // ---------- customer area ----------
  { for (const [x, z] of [[-6.4, 4.3], [6.3, 4.3]]) {
      const t = prop('tableRound', 1.05, { by: 'height' }); place(t, x, 0, z); collision.addCircle(x, z, 0.62, 1.05);
      for (const a of [0, Math.PI]) { const c = prop('chairCushion', 1.25, { by: 'height' }); place(c, x + Math.sin(a + 1.57) * 1.15, 0, z + Math.cos(a + 1.57) * 1.15, a - 1.57); collision.addCircle(x + Math.sin(a + 1.57) * 1.15, z + Math.cos(a + 1.57) * 1.15, 0.38, 1.2); }
      const cup = prop('cup-saucer', 0.3); place(cup, x + 0.2, 1.05, z - 0.1);
      const cr = prop('croissant', 0.32); place(cr, x - 0.2, 1.05, z + 0.12, 0.5);
    }
    for (const [x, z, n] of [[-8.3, 6.3, 'pottedPlant'], [8.3, 6.3, 'pottedPlant'], [-8.3, 0.4, 'plantSmall1'], [8.3, 0.4, 'plantSmall2']]) {
      const p = prop(n, n === 'pottedPlant' ? 1.9 : 1.1, { by: 'height' }); place(p, x, 0, z); collision.addCircle(x, z, 0.42);
    }
    const rug = prop('rugDoormat', 2.2); place(rug, 0, 0.005, 6.1);
    for (const z of [-0.2, 4.6]) for (const s of [-1, 1]) { const l = prop('lampWall', 0.55); place(l, s * 8.85, 2.6, z, s < 0 ? Math.PI / 2 : -Math.PI / 2); }
    // framed pictures
    const pic = (x, z, ry, hue) => {
      const t = T.canvasTex(128, 160, (g, w, h) => { g.fillStyle = '#c9a25a'; g.fillRect(0, 0, w, h); g.fillStyle = '#fff9ec'; g.fillRect(10, 10, w - 20, h - 20); g.fillStyle = `hsl(${hue},55%,62%)`; g.beginPath(); g.arc(64, 70, 34, 0, 7); g.fill(); g.fillStyle = '#e0a458'; g.beginPath(); g.ellipse(64, 108, 42, 14, 0, 0, 7); g.fill(); g.fillStyle = '#8a5a2b'; g.font = '700 16px Georgia'; g.textAlign = 'center'; g.fillText('since 1926', 64, 142); });
      const f = add(new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.12), keep(new THREE.MeshStandardMaterial({ map: t }))), { cast: false }); f.position.set(x, 3.2, z); f.rotation.y = ry;
    };
    pic(-8.97, 1.8, Math.PI / 2, 30); pic(-8.97, 5.6, Math.PI / 2, 200); pic(8.97, 2.2, -Math.PI / 2, 350); pic(8.97, 5.6, -Math.PI / 2, 120);
  }

  // ---------- pendant lights ----------
  const pendants = [];
    for (const [x, z, y] of [[-4.2, -3.4, 4.55], [3.0, -3.4, 4.55], [-4.0, -1.0, 4.4], [1.8, -1.0, 4.4], [0, 4.2, 4.4]]) {
    const cord = add(new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, ROOM.H - y, 6), M.black), { cast: false }); cord.position.set(x, (ROOM.H + y) / 2, z);
    const rose = add(new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.05, 12), M.brass), { cast: false }); rose.position.set(x, ROOM.H, z);
    const shade = add(new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.36, 0.3, 20, 1, true), keep(m({ color: '#2f5b55', roughness: 0.4, metalness: 0.3, side: THREE.DoubleSide }))), { cast: false }); shade.position.set(x, y, z);
    const bulb = add(new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 10), M.lampGlow), { cast: false }); bulb.position.set(x, y - 0.1, z); bulb.scale.setScalar(0.8);
    const L = new THREE.PointLight('#ffc98a', 9, 13, 1.5); L.position.set(x, y - 0.35, z); root.add(L); pendants.push(L);
  }
  // shared warm oven glow light
  const ovenLight = new THREE.PointLight('#ff8a3d', 0, 6, 1.8); ovenLight.position.set(-5.9, 1.7, -4.9); root.add(ovenLight);

  // ---------- facade: awnings, sign, upper floor ----------
  for (const [a, b] of [[-7.8, -2.0], [2.0, 7.8], [-1.4, 1.4]]) {
    const w = b - a, depth = 1.5, cx = (a + b) / 2;
    const aw = add(new THREE.Mesh(new THREE.PlaneGeometry(w, depth), M.awning)); aw.position.set(cx, 4.12, 7.3 + depth / 2 * Math.cos(0.5)); aw.rotation.x = -Math.PI / 2 + 0.5;
    const val = add(new THREE.Mesh(new THREE.PlaneGeometry(w, 0.32), M.awning)); val.position.set(cx, 3.87 - 0.28, 7.32 + depth * Math.cos(0.5)); val.position.y = 4.12 - depth / 2 * Math.sin(0.5) - 0.16;
    // snow on top of awning
    const sn = add(new THREE.Mesh(new THREE.BoxGeometry(w - 0.1, 0.08, depth * 0.85), M.snowFlat)); sn.position.copy(aw.position); sn.position.y += 0.06; sn.rotation.x = 0.5;
  }
  { const sign = add(new THREE.Mesh(new THREE.PlaneGeometry(8.2, 2.05), keep(new THREE.MeshStandardMaterial({ map: T.signTex('Corner Bakery', 'BREAD · PASTRY · COFFEE'), roughness: 0.5, emissive: '#3a2a10', emissiveIntensity: 0.25 }))));
    sign.position.set(0, 5.6, 7.33);
    for (const x of [-3, 3]) { const lmp = add(new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.3, 12, 1, true), M.trimGreen)); lmp.position.set(x, 6.85, 7.75); lmp.rotation.x = 0.9; const arm = add(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.6, 6), M.trimGreen)); arm.rotation.x = Math.PI / 2; arm.position.set(x, 6.85, 7.5); }
    // upper floor windows
    for (const x of [-6.2, -2.1, 2.1, 6.2]) {
      box(x - 1.0, 6.9, 7.28, x + 1.0, 8.75, 7.36, M.trimWhite, { cast: false });
      const lit = x === -2.1 || x === 6.2;
      const wm = add(new THREE.Mesh(new THREE.PlaneGeometry(1.7, 1.55), keep(new THREE.MeshStandardMaterial({ color: lit ? '#ffd9a0' : '#3a4e70', emissive: lit ? '#ffb45e' : '#1a2338', emissiveIntensity: lit ? 1.2 : 0.3, roughness: 0.2 }))), { cast: false });
      wm.position.set(x, 7.82, 7.37);
      box(x - 1.1, 6.78, 7.3, x + 1.1, 6.9, 7.6, M.trimWhite); box(x - 1.05, 6.9, 7.36, x + 1.05, 6.98, 7.58, M.snowFlat, { cast: false });
      box(x - 0.04, 6.9, 7.36, x + 0.04, 8.7, 7.4, M.trimWhite, { cast: false });
    }
    box(-9.5, FH, 6.9, 9.5, FH + 0.35, 7.7, M.trimGreen);
    box(-9.5, FH + 0.35, 6.9, 9.5, FH + 0.5, 7.7, M.snowFlat, { cast: false });
  }

  // ---------- street ----------
  box(-40, -0.25, 7.3, 40, 0, 11, M.sidewalk, { cast: false });
  box(-40, -0.25, 11, 40, -0.02, 11.25, M.trimWhite, { cast: false }); // curb
  box(-40, -0.6, 11.25, 40, -0.2, 19, M.road, { cast: false });
  box(-40, -0.25, 19, 40, 0, 22, M.sidewalk, { cast: false });
  // neighbours on our side
  const neigh = (x0, x1, hgt, mat, seed) => {
    const fac = T.facadeTex(seed % 2 ? '#c96f53' : '#7f9cb4', seed, 3, 3);
    const mm = keep(new THREE.MeshStandardMaterial({ map: fac, roughness: 0.85 }));
    const g = worldBoxGeo(x0, 0, -8, x1, hgt, 7.3);
    const mesh = add(new THREE.Mesh(g, [mat, mat, M.snowFlat, mat, mm, mat]));
    // remap the front face to the facade texture once (0..1)
    const uv = g.attributes.uv, n = g.attributes.normal, p = g.attributes.position;
    for (let i = 0; i < uv.count; i++) if (n.getZ(i) > 0.5) uv.setXY(i, (p.getX(i) - x0) / (x1 - x0), p.getY(i) / hgt);
    occluders.push(mesh); collision.addBox(x0, 0, -8, x1, hgt, 7.3); return mesh;
  };
  neigh(-26, -9.3, 8.4, M.brick2, 3); neigh(9.3, 24, 10.5, M.brick, 4);
  // shuttered shop fronts on the neighbours
  for (const [x0, x1] of [[-16, -11], [11, 17]]) { box(x0, 0, 7.3, x1, 3.2, 7.4, keep(m({ map: T.canvasTex(64, 64, (g, w, h) => { g.fillStyle = '#8b939c'; g.fillRect(0, 0, w, h); g.fillStyle = 'rgba(0,0,0,.25)'; for (let y = 0; y < h; y += 6) g.fillRect(0, y, w, 2); }), metalness: 0.4, roughness: 0.5 })), { cast: false }); }
  // buildings across the street
  const across = [[-34, -20, 13, '#d9b48a', 7], [-20, -8, 10, '#86a8c8', 8], [-8, 6, 14, '#e2a073', 9], [6, 18, 11, '#9fbf9a', 10], [18, 34, 13, '#cf8f8f', 11]];
  for (const [x0, x1, hgt, col, seed] of across) {
    const fac = T.facadeTex(col, seed, 4, 4);
    const mm = keep(new THREE.MeshStandardMaterial({ map: fac, roughness: 0.85, emissive: '#ffffff', emissiveMap: fac, emissiveIntensity: 0.18 }));
    const g = worldBoxGeo(x0, 0, 22, x1, hgt, 30);
    const uv = g.attributes.uv, n = g.attributes.normal, p = g.attributes.position;
    for (let i = 0; i < uv.count; i++) if (n.getZ(i) < -0.5) uv.setXY(i, 1 - (p.getX(i) - x0) / (x1 - x0), p.getY(i) / hgt);
    const side = keep(m({ color: col, roughness: 0.9 }));
    add(new THREE.Mesh(g, [side, side, M.snowFlat, side, side, mm]), { cast: false });
    box(x0 - 0.2, hgt, 21.8, x1 + 0.2, hgt + 0.3, 30, M.snowFlat, { cast: false });
  }
  // snowbanks along the curb, lamp posts, bench, A-frame sign, snowman
  { const r = mulberry(91), geo = new THREE.IcosahedronGeometry(1, 1);
    for (let x = -38; x < 38; x += 1.6 + r() * 1.6) {
      if (Math.abs(x) < 3) continue;
      const s = add(new THREE.Mesh(geo, M.snowFlat), { cast: false }); s.scale.set(1 + r() * 1.2, 0.35 + r() * 0.35, 0.6 + r() * 0.3); s.position.set(x, -0.05, 11.1 + r() * 0.3); s.rotation.y = r() * 3;
    }
    for (let x = -38; x < 38; x += 2 + r() * 2.5) { const s = add(new THREE.Mesh(geo, M.snowFlat), { cast: false }); s.scale.set(1.2 + r(), 0.3 + r() * 0.3, 0.7); s.position.set(x, -0.02, 19.4 + r() * 0.5); }
    for (const x of [-10.8, 10.8]) {
      const pole = add(new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 4.6, 10), M.trimGreen)); pole.position.set(x, 2.3, 10.3);
      const head = add(new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.32, 0.6, 6), M.lampGlow), { cast: false }); head.position.set(x, 4.75, 10.3);
      const cap = add(new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.35, 6), M.trimGreen)); cap.position.set(x, 5.22, 10.3);
      const capSnow = add(new THREE.Mesh(new THREE.ConeGeometry(0.36, 0.14, 6), M.snowFlat), { cast: false }); capSnow.position.set(x, 5.4, 10.3);
      collision.addCircle(x, 10.3, 0.25);
      const glow = new THREE.Sprite(keep(new THREE.SpriteMaterial({ map: T.canvasTex(64, 64, (g, w) => { const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,214,140,.9)'); gr.addColorStop(1, 'rgba(255,190,110,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, w); }), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })));
      glow.scale.set(2.6, 2.6, 1); glow.position.set(x, 4.75, 10.3); root.add(glow);
    }
    const bench = prop('benchCushion', 2.2); place(bench, -5.2, 0, 8.3, Math.PI); collision.addBox(-6.3, 0, 7.9, -4.1, 0.9, 8.7);
    // A-frame chalk sign
    const sTex = T.canvasTex(256, 320, (g, w, h) => { g.fillStyle = '#6b4a2c'; g.fillRect(0, 0, w, h); g.fillStyle = '#26302b'; g.fillRect(12, 12, w - 24, h - 24); g.fillStyle = '#fdf6e3'; g.textAlign = 'center'; g.font = '700 40px "Comic Sans MS", cursive'; g.fillText('Fresh', w / 2, 90); g.fillText('Croissants', w / 2, 140); g.fillStyle = '#ffd98a'; g.font = '700 34px "Comic Sans MS", cursive'; g.fillText('& hot', w / 2, 210); g.fillText('coffee!', w / 2, 252); });
    const sm = keep(new THREE.MeshStandardMaterial({ map: sTex, roughness: 0.9 }));
    for (const s of [-1, 1]) { const pl = add(new THREE.Mesh(new THREE.BoxGeometry(0.85, 1.15, 0.04), [M.darkWood, M.darkWood, M.darkWood, M.darkWood, s > 0 ? sm : M.darkWood, s > 0 ? M.darkWood : sm])); pl.position.set(2.9, 0.56, 8.3 + s * 0.17); pl.rotation.x = s * 0.27; }
    collision.addBox(2.4, 0, 7.95, 3.4, 1.1, 8.65);
    // snowman across the street
    const sn = new THREE.Group(); sn.position.set(-13, 0, 20.5);
    for (const [r2, y] of [[0.75, 0.6], [0.55, 1.6], [0.38, 2.3]]) { const b = new THREE.Mesh(new THREE.SphereGeometry(r2, 16, 12), M.snowFlat); b.position.y = y; b.castShadow = true; sn.add(b); }
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.35, 8), keep(m({ color: '#ff8a2a' }))); nose.rotation.x = -Math.PI / 2; nose.position.set(0, 2.3, -0.5); sn.add(nose);
    const hat = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.4, 14), M.black); hat.position.y = 2.75; sn.add(hat);
    root.add(sn);
  }

  // ---------- sky, fog, sun ----------
  const skyMat = keep(new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color('#4f74b8') }, mid: { value: new THREE.Color('#f2b28a') }, low: { value: new THREE.Color('#ffe3b8') }, sunDir: { value: new THREE.Vector3(-0.35, 0.22, 0.91).normalize() } },
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `uniform vec3 top; uniform vec3 mid; uniform vec3 low; uniform vec3 sunDir; varying vec3 vP;
      void main(){ float h = vP.y; vec3 c = h > 0.12 ? mix(mid, top, smoothstep(0.12, 0.65, h)) : mix(low, mid, smoothstep(-0.05, 0.12, h));
        float s = max(dot(normalize(vP), sunDir), 0.0); c += vec3(1.0,0.78,0.5) * (pow(s, 24.0) * 0.6 + pow(s, 400.0) * 2.0);
        gl_FragColor = vec4(c, 1.0); }`,
  }));
  const sky = new THREE.Mesh(new THREE.SphereGeometry(320, 32, 16), skyMat); sky.frustumCulled = false; root.add(sky);

  const hemi = new THREE.HemisphereLight('#c8d8ff', '#7a5a3e', 0.75); root.add(hemi);
  const sun = new THREE.DirectionalLight('#ffd4a3', 2.6);
  sun.position.set(-14, 13, 34); sun.target.position.set(0, 0, 0);
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -15, right: 15, top: 13, bottom: -13, near: 5, far: 75 });
  sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.035;
  root.add(sun, sun.target);

  // ---------- falling snow (outside only) ----------
  const SN = 1400, snPos = new Float32Array(SN * 3), snSpd = new Float32Array(SN);
  { const r = mulberry(99); for (let i = 0; i < SN; i++) { snPos[i * 3] = (r() - 0.5) * 56; snPos[i * 3 + 1] = r() * 16; snPos[i * 3 + 2] = 7.6 + r() * 18; snSpd[i] = 0.7 + r() * 0.8; } }
  const snGeo = new THREE.BufferGeometry(); snGeo.setAttribute('position', new THREE.BufferAttribute(snPos, 3));
  const flake = T.canvasTex(32, 32, (g) => { const gr = g.createRadialGradient(16, 16, 0, 16, 16, 16); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 32, 32); });
  const snow = new THREE.Points(snGeo, keep(new THREE.PointsMaterial({ map: flake, color: '#ffffff', size: 0.16, transparent: true, depthWrite: false })));
  snow.frustumCulled = false; root.add(snow);
  anim.push((dt, t) => {
    for (let i = 0; i < SN; i++) { snPos[i * 3 + 1] -= snSpd[i] * dt; snPos[i * 3] += Math.sin(t * 0.7 + i) * 0.2 * dt; if (snPos[i * 3 + 1] < 0) snPos[i * 3 + 1] += 16; }
    snGeo.attributes.position.needsUpdate = true;
  });

  // ---------- smoke / steam particles ----------
  const puffTex = T.canvasTex(64, 64, (g) => { const gr = g.createRadialGradient(32, 32, 2, 32, 32, 30); gr.addColorStop(0, 'rgba(255,255,255,.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); });
  const puffs = [];
  const puffMatFor = (color) => keep(new THREE.SpriteMaterial({ map: puffTex, color, transparent: true, depthWrite: false, opacity: 0 }));
  for (let i = 0; i < 48; i++) { const s = new THREE.Sprite(puffMatFor('#ffffff')); s.visible = false; root.add(s); puffs.push({ s, life: 0, max: 1, v: new THREE.Vector3() }); }
  let puffI = 0;
  function emitPuff(x, y, z, { color = '#ffffff', size = 0.6, life = 1.6, rise = 0.9, spread = 0.25 } = {}) {
    const p = puffs[puffI = (puffI + 1) % puffs.length];
    p.s.material.color.set(color); p.s.position.set(x + (Math.random() - 0.5) * spread, y, z + (Math.random() - 0.5) * spread);
    p.size = size; p.life = life; p.max = life; p.v.set((Math.random() - 0.5) * 0.25, rise * (0.7 + Math.random() * 0.6), (Math.random() - 0.5) * 0.2); p.s.visible = true;
  }
  anim.push((dt) => {
    for (const p of puffs) if (p.life > 0) {
      p.life -= dt; const k = 1 - p.life / p.max;
      p.s.position.addScaledVector(p.v, dt); const sz = p.size * (0.6 + k * 1.4); p.s.scale.set(sz, sz, 1);
      p.s.material.opacity = Math.sin(Math.min(1, k) * Math.PI) * 0.55; if (p.life <= 0) p.s.visible = false;
    }
  });

  // ---------- floor ring that marks the targeted station ----------
  const ringMat = keep(new THREE.MeshBasicMaterial({ color: '#ffd45a', transparent: true, opacity: 0.85, depthWrite: false, toneMapped: false }));
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.68, 40), ringMat); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.03; ring.visible = false; ring.renderOrder = 1; root.add(ring);
  anim.push((dt, t) => { const s = 1 + Math.sin(t * 6) * 0.06; ring.scale.set(s, s, s); ringMat.opacity = 0.65 + Math.sin(t * 6) * 0.2; });

  return {
    root, collision, occluders, anim, mats, sky, sun, hemi, pendants, ovenLight,
    ovens, fryer, frost, coffee, display, chalk, door: doorState, ring, emitPuff,
    update(dt, t) { for (const f of anim) f(dt, t); },
    dispose() { for (const mm of mats) mm.dispose(); T.disposeTextures(); },
  };
}

/** Customer walking paths (in through the door, out to a random side). */
export function pathIn(slot, side) {
  const x = SLOT_X[slot];
  return [[side * 17, 9.1], [side * 2.4, 9.1], [0, 8.3], [0, 6.4], [0, 3.4], [x * 0.6, 2.0], [x, SLOT_Z + 0.4], [x, SLOT_Z]];
}
export function pathOut(slot, side) {
  const x = SLOT_X[slot];
  return [[x, SLOT_Z], [x, SLOT_Z + 0.9], [x * 0.5, 2.6], [0, 4.0], [0, 6.4], [0, 8.3], [side * 2.4, 9.3], [side * 17, 9.3]];
}
