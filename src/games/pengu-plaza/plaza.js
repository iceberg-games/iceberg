// Pengu Plaza procedural set: snowy round plaza at blue-hour, frozen fountain, ice rink, cocoa hut,
// benches, Aurora Arch, Giant Ice Pengu statue, lantern lane, pines, falling snow + aurora sky.
import * as THREE from 'three';
import { PLAZA_R, RINK, COCOA, BELL, SEATS } from './config.js';

function tex(w, h, draw, rep = [1, 1]) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...rep); return t; }
const snowTex = () => tex(256, 256, (g, w, h) => { g.fillStyle = '#e9f2ff'; g.fillRect(0, 0, w, h); for (let i = 0; i < 900; i++) { const v = 220 + Math.random() * 35; g.fillStyle = `rgba(${v - 20},${v - 5},255,.35)`; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); } }, [14, 14]);
const cobbleTex = () => tex(256, 256, (g, w, h) => { g.fillStyle = '#8ea3c2'; g.fillRect(0, 0, w, h); for (let y = 0; y < h; y += 32) for (let x = (y / 32) % 2 ? -16 : 0; x < w; x += 32) { const v = 150 + Math.random() * 40; g.fillStyle = `rgb(${v - 20},${v},${v + 30})`; g.beginPath(); g.roundRect(x + 2, y + 2, 28, 28, 7); g.fill(); g.fillStyle = 'rgba(255,255,255,.5)'; g.fillRect(x + 6, y + 4, 12, 3); } }, [10, 10]);
const iceTex = () => tex(256, 256, (g, w, h) => { const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#bfeaff'); gr.addColorStop(1, '#8fd0ff'); g.fillStyle = gr; g.fillRect(0, 0, w, h); g.strokeStyle = 'rgba(255,255,255,.55)'; for (let i = 0; i < 40; i++) { g.lineWidth = Math.random() * 1.5; g.beginPath(); const x = Math.random() * w, y = Math.random() * h; g.moveTo(x, y); g.quadraticCurveTo(x + 30, y + (Math.random() - .5) * 40, x + 60 + Math.random() * 60, y + (Math.random() - .5) * 30); g.stroke(); } }, [3, 2]);
const signTex = (text, bg = '#2b4a7a', fg = '#fff3d6') => tex(512, 128, (g, w, h) => { g.fillStyle = bg; g.beginPath(); g.roundRect(4, 4, w - 8, h - 8, 30); g.fill(); g.strokeStyle = '#bfe8ff'; g.lineWidth = 8; g.stroke(); g.fillStyle = fg; g.font = '900 64px system-ui,sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, w / 2, h / 2 + 4); });

export function buildPenguin(colors = {}) {
  const g = new THREE.Group();
  const body = new THREE.MeshStandardMaterial({ color: colors.body || '#1f2740', roughness: 0.55 }), belly = new THREE.MeshStandardMaterial({ color: '#fbfbff', roughness: 0.6 }), beak = new THREE.MeshStandardMaterial({ color: '#ff9a2e', roughness: 0.4 }), eye = new THREE.MeshBasicMaterial({ color: '#111' }), scarf = new THREE.MeshStandardMaterial({ color: colors.scarf || '#ff5f7e', roughness: 0.8 });
  const s = new THREE.SphereGeometry(1, 18, 14);
  const b = new THREE.Mesh(s, body); b.scale.set(0.55, 0.7, 0.5); b.position.y = 0.7; g.add(b);
  const bl = new THREE.Mesh(s, belly); bl.scale.set(0.42, 0.55, 0.3); bl.position.set(0, 0.65, 0.24); g.add(bl);
  const h = new THREE.Mesh(s, body); h.scale.setScalar(0.38); h.position.y = 1.45; g.add(h);
  const f = new THREE.Mesh(s, belly); f.scale.set(0.27, 0.24, 0.2); f.position.set(0, 1.42, 0.22); g.add(f);
  const k = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.28, 8), beak); k.rotation.x = Math.PI / 2; k.position.set(0, 1.4, 0.45); g.add(k);
  for (const x of [-0.12, 0.12]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), eye); e.position.set(x, 1.52, 0.36); g.add(e); const ft = new THREE.Mesh(s, beak); ft.scale.set(0.14, 0.05, 0.22); ft.position.set(x * 1.6, 0.04, 0.12); g.add(ft); }
  const sc = new THREE.Mesh(new THREE.TorusGeometry(0.33, 0.08, 8, 20), scarf); sc.rotation.x = Math.PI / 2; sc.position.y = 1.14; g.add(sc);
  const wings = [-1, 1].map(sd => { const w = new THREE.Mesh(s, body); w.scale.set(0.1, 0.45, 0.25); w.position.set(sd * 0.55, 0.8, 0); w.rotation.z = sd * 0.25; g.add(w); return w; });
  if (colors.hat) { const hat = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.5, 12), new THREE.MeshStandardMaterial({ color: colors.hat })); hat.position.y = 1.92; g.add(hat); const pom = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), belly); pom.position.y = 2.18; g.add(pom); }
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  g.userData.wings = wings; return g;
}

export function buildPlaza({ mobile = false } = {}) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#203a6b'); scene.fog = new THREE.Fog('#2c4a80', 40, 140);
  const disposables = [], colliders = [], seatsOut = [];
  const M = (o) => { const m = new THREE.MeshStandardMaterial(o); disposables.push(m); return m; };
  const add = (geo, mat, x, y, z, parent = scene) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; parent.add(m); disposables.push(geo); return m; };

  // lights: cool moon + warm fill
  scene.add(new THREE.HemisphereLight('#bcd8ff', '#3a4a6a', 0.9));
  const moon = new THREE.DirectionalLight('#dfe9ff', 1.1); moon.position.set(-20, 40, 20); moon.castShadow = !mobile; moon.shadow.mapSize.set(1024, 1024); Object.assign(moon.shadow.camera, { left: -40, right: 40, top: 40, bottom: -40 }); scene.add(moon);

  // sky dome with aurora ribbons
  const sky = new THREE.Mesh(new THREE.SphereGeometry(300, 32, 16), new THREE.MeshBasicMaterial({ side: THREE.BackSide, fog: false, map: tex(1024, 512, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#0a1433'); gr.addColorStop(0.45, '#1d3570'); gr.addColorStop(0.55, '#4a6fb0'); gr.addColorStop(1, '#2c4a80'); g.fillStyle = gr; g.fillRect(0, 0, w, h); for (let i = 0; i < 300; i++) { g.fillStyle = `rgba(255,255,255,${Math.random() * 0.8})`; g.fillRect(Math.random() * w, Math.random() * h * 0.45, 2, 2); } for (let k = 0; k < 3; k++) { g.beginPath(); for (let x = 0; x <= w; x += 8) g.lineTo(x, 110 + k * 30 + Math.sin(x / 90 + k) * 30); g.lineWidth = 30 - k * 7; g.strokeStyle = ['rgba(90,255,190,.35)', 'rgba(130,190,255,.3)', 'rgba(220,130,255,.3)'][k]; g.shadowColor = '#7fffd0'; g.shadowBlur = 30; g.stroke(); } }) }));
  disposables.push(sky.geometry, sky.material.map, sky.material); scene.add(sky);

  // ground
  const ground = add(new THREE.CircleGeometry(120, 64), M({ map: snowTex(), roughness: 0.95 }), 0, 0, 0); ground.rotation.x = -Math.PI / 2;
  const cob = add(new THREE.RingGeometry(3, PLAZA_R - 6, 64), M({ map: cobbleTex(), roughness: 0.8 }), 0, 0.01, 6); cob.rotation.x = -Math.PI / 2;
  // ice rink: glossy ellipse + snow rim + boards
  const iceMat = M({ map: iceTex(), roughness: 0.05, metalness: 0.15, color: '#d8f3ff' });
  const rink = add(new THREE.CircleGeometry(1, 64), iceMat, RINK.x, 0.03, RINK.z); rink.rotation.x = -Math.PI / 2; rink.scale.set(RINK.rx, RINK.rz, 1);
  const rim = add(new THREE.TorusGeometry(1, 0.06, 8, 64), M({ color: '#ffffff', roughness: 0.9 }), RINK.x, 0.15, RINK.z); rim.rotation.x = Math.PI / 2; rim.scale.set(RINK.rx + 0.3, RINK.rz + 0.3, 3);
  const flagMat = [M({ color: '#ff6f91' }), M({ color: '#6fe0ff' }), M({ color: '#ffd36b' })];
  for (let i = 0; i < 18; i++) { const a = i / 18 * Math.PI * 2; if (Math.abs(a - Math.PI / 2) < 0.4) continue; const x = RINK.x + Math.cos(a) * (RINK.rx + 0.8), z = RINK.z + Math.sin(a) * (RINK.rz + 0.8); add(new THREE.CylinderGeometry(0.05, 0.05, 2.2, 6), M({ color: '#dfe8f5' }), x, 1.1, z); const fl = add(new THREE.ConeGeometry(0.25, 0.5, 4), flagMat[i % 3], x, 2.3, z); fl.rotation.z = Math.PI; }
  const rs = new THREE.Mesh(new THREE.PlaneGeometry(5, 1.25), new THREE.MeshBasicMaterial({ map: signTex('⛸ Pengu Rink'), transparent: true })); rs.position.set(RINK.x, 3.2, RINK.z + RINK.rz + 1.2); disposables.push(rs.geometry, rs.material.map, rs.material); scene.add(rs);

  // frozen fountain (center-front)
  const stone = M({ color: '#b9c9e2', roughness: 0.7 }), crystal = M({ color: '#aee6ff', roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.8, emissive: '#2a6c9a', emissiveIntensity: 0.4 });
  add(new THREE.CylinderGeometry(3.2, 3.4, 0.8, 32), stone, 0, 0.4, 6); add(new THREE.CylinderGeometry(2.8, 2.8, 0.1, 32), crystal, 0, 0.82, 6);
  add(new THREE.CylinderGeometry(0.35, 0.5, 2.4, 12), stone, 0, 1.6, 6); add(new THREE.CylinderGeometry(1.4, 0.3, 0.4, 24), stone, 0, 2.9, 6);
  const spire = add(new THREE.OctahedronGeometry(0.8, 0), crystal, 0, 3.9, 6); spire.scale.y = 1.8;
  colliders.push(['circle', 0, 6, 3.4, 0.85]);
  // fountain-rim seats front/back of fountain are SEATS[5..6]

  // bell post
  add(new THREE.CylinderGeometry(0.12, 0.15, 3.2, 8), M({ color: '#6b4a2b' }), BELL.x, 1.6, BELL.z);
  add(new THREE.BoxGeometry(1.4, 0.15, 0.15), M({ color: '#6b4a2b' }), BELL.x, 3.2, BELL.z);
  const bell = add(new THREE.CylinderGeometry(0.2, 0.42, 0.6, 16, 1, true), M({ color: '#ffcf5a', metalness: 0.8, roughness: 0.3, side: THREE.DoubleSide }), BELL.x, 2.8, BELL.z);
  colliders.push(['circle', BELL.x, BELL.z, 0.3, 3.3]);

  // cocoa hut
  const wood = M({ color: '#9a5f36', roughness: 0.8 }), red = M({ color: '#e0435f', roughness: 0.6 }), cream = M({ color: '#fff3e0' });
  add(new THREE.BoxGeometry(3.6, 1.1, 1.6), wood, COCOA.x, 0.55, COCOA.z);
  add(new THREE.BoxGeometry(3.8, 0.12, 1.8), cream, COCOA.x, 1.16, COCOA.z);
  for (const dx of [-1.7, 1.7]) add(new THREE.CylinderGeometry(0.08, 0.08, 2.4, 6), wood, COCOA.x + dx, 2.3, COCOA.z);
  for (let i = 0; i < 6; i++) { const r = add(new THREE.BoxGeometry(0.65, 0.12, 2.4), i % 2 ? cream : red, COCOA.x - 1.62 + i * 0.65, 3.55, COCOA.z + 0.2); r.rotation.x = 0.25; }
  const mugs = []; for (let i = 0; i < 4; i++) mugs.push(add(new THREE.CylinderGeometry(0.13, 0.11, 0.26, 10), M({ color: ['#ff8a8a', '#8ad0ff', '#ffe08a', '#b28aff'][i] }), COCOA.x - 1.2 + i * 0.8, 1.35, COCOA.z + 0.3));
  const cs = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 0.8), new THREE.MeshBasicMaterial({ map: signTex('☕ Hot Cocoa', '#7a3b22'), transparent: true })); cs.position.set(COCOA.x, 4.1, COCOA.z + 1.4); cs.rotation.x = -0.15; disposables.push(cs.geometry, cs.material.map, cs.material); scene.add(cs);
  colliders.push(['box', COCOA.x - 1.9, 0, COCOA.z - 0.9, COCOA.x + 1.9, 1.2, COCOA.z + 0.9]);
  const cocoaBarista = buildPenguin({ scarf: '#7a3b22', hat: '#fff3e0' }); cocoaBarista.position.set(COCOA.x, 0, COCOA.z - 1.6); scene.add(cocoaBarista);
  colliders.push(['circle', COCOA.x, COCOA.z - 1.6, 0.6, 2]);

  // benches at seats (fountain-rim seats have no bench)
  const bench = M({ color: '#b5703c', roughness: 0.7 }), iron = M({ color: '#33405a', metalness: 0.6, roughness: 0.4 });
  SEATS.forEach((s, i) => {
    const grp = new THREE.Group(); grp.position.set(s.x, 0, s.z); grp.rotation.y = s.rot; scene.add(grp);
    if (i < 5) {
      for (let k = 0; k < 3; k++) add(new THREE.BoxGeometry(2.2, 0.08, 0.18), bench, 0, 0.55, -0.15 + k * 0.2, grp);
      for (let k = 0; k < 2; k++) { const bk = add(new THREE.BoxGeometry(2.2, 0.16, 0.06), bench, 0, 0.85 + k * 0.25, -0.4, grp); bk.rotation.x = -0.15; }
      for (const dx of [-0.95, 0.95]) add(new THREE.BoxGeometry(0.08, 0.55, 0.6), iron, dx, 0.27, -0.1, grp);
      const snowcap = add(new THREE.BoxGeometry(2.1, 0.06, 0.12), cream, 0, 1.22, -0.43, grp);
    }
    seatsOut.push({ ...s, y: i < 5 ? 0.55 : 0.85 });
  });

  // Aurora Arch (entrance)
  const archMat = M({ color: '#cfefff', emissive: '#58d6ff', emissiveIntensity: 0.6, roughness: 0.2, transparent: true, opacity: 0.9 });
  const arch = add(new THREE.TorusGeometry(4.2, 0.45, 12, 40, Math.PI), archMat, 0, 0, 33);
  colliders.push(['circle', -4.2, 33, 0.6, 9], ['circle', 4.2, 33, 0.6, 9]);
  const as = new THREE.Mesh(new THREE.PlaneGeometry(6, 1.5), new THREE.MeshBasicMaterial({ map: signTex('Pengu Plaza'), transparent: true })); as.position.set(0, 4.9, 32.6); as.rotation.y = Math.PI; disposables.push(as.geometry, as.material.map, as.material); scene.add(as);

  // Giant Ice Pengu statue
  const statue = buildPenguin({ body: '#9fd8ff', scarf: '#5fd0ff' }); statue.scale.setScalar(4); statue.position.set(-25, 0.6, -22); statue.rotation.y = 0.8;
  statue.traverse(o => { if (o.isMesh && o.material.isMeshStandardMaterial) { o.material = o.material.clone(); o.material.transparent = true; o.material.opacity = 0.85; o.material.emissive = new THREE.Color('#3a8cc0'); o.material.emissiveIntensity = 0.35; o.material.roughness = 0.1; disposables.push(o.material); } }); scene.add(statue);
  add(new THREE.CylinderGeometry(3, 3.3, 0.6, 24), stone, -25, 0.3, -22);
  colliders.push(['circle', -25, -22, 3.3, 9]);

  // lantern lane (warm glows; real point lights only on desktop)
  const lanternMat = M({ color: '#ffd08a', emissive: '#ffae4a', emissiveIntensity: 1.6 }), lanterns = [];
  const lanternSpots = [[16, 12], [20, 16], [24, 20], [-16, 14], [-20, -10], [8, -26], [-8, -26], [26, -2]];
  lanternSpots.forEach(([x, z], i) => { add(new THREE.CylinderGeometry(0.08, 0.1, 3, 8), iron, x, 1.5, z); const l = add(new THREE.SphereGeometry(0.3, 12, 8), lanternMat, x, 3.1, z); lanterns.push(l); colliders.push(['circle', x, z, 0.25, 3.2]); if (!mobile && i % 2 === 0) { const p = new THREE.PointLight('#ffb460', 6, 12, 1.6); p.position.set(x, 3, z); scene.add(p); } });

  // pines + snow mounds around the edge
  const pine = M({ color: '#1f5a4e', roughness: 0.9 }), trunk = M({ color: '#5a3a22' }), snowM = M({ color: '#f4f8ff', roughness: 1 });
  for (let i = 0; i < 34; i++) { const a = i / 34 * Math.PI * 2 + Math.sin(i) * 0.05, r = PLAZA_R + 3 + (i % 3) * 2.5, x = Math.cos(a) * r, z = Math.sin(a) * r + 2; if (Math.abs(x) < 7 && z > 25) continue; const s = 0.8 + (i * 37 % 10) / 15; add(new THREE.CylinderGeometry(0.25 * s, 0.3 * s, 1.4 * s, 6), trunk, x, 0.7 * s, z); for (let k = 0; k < 3; k++) { add(new THREE.ConeGeometry((2 - k * 0.5) * s, 2 * s, 8), pine, x, (2 + k * 1.2) * s, z); add(new THREE.ConeGeometry((1.2 - k * 0.3) * s, 0.6 * s, 8), snowM, x, (2.7 + k * 1.2) * s, z); } }
  for (let i = 0; i < 16; i++) { const a = i * 2.4, r = 20 + (i % 4) * 3; const m = add(new THREE.SphereGeometry(1, 12, 8), snowM, Math.cos(a) * r, -0.3, Math.sin(a) * r + 4); m.scale.set(1.6, 0.8, 1.3); }

  // falling snow
  const SN = mobile ? 900 : 2500, sp = new Float32Array(SN * 3); for (let i = 0; i < SN; i++) sp.set([(Math.random() - 0.5) * 90, Math.random() * 40, (Math.random() - 0.5) * 90], i * 3);
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  const snowPts = new THREE.Points(sg, new THREE.PointsMaterial({ color: '#ffffff', size: 0.18, transparent: true, opacity: 0.85, depthWrite: false })); snowPts.frustumCulled = false; scene.add(snowPts); disposables.push(sg, snowPts.material);

  return {
    scene, seats: seatsOut, colliders, mugs, bell, spire, lanterns, barista: cocoaBarista, arch, sky,
    update(dt, t) {
      for (let i = 0; i < SN; i++) { const j = i * 3; sp[j + 1] -= dt * (1.2 + (i % 5) * 0.2); sp[j] += Math.sin(t * 0.7 + i) * dt * 0.3; if (sp[j + 1] < 0) sp[j + 1] = 40; }
      sg.attributes.position.needsUpdate = true;
      spire.rotation.y = t * 0.4; archMat.emissiveIntensity = 0.5 + Math.sin(t * 1.5) * 0.25;
      lanterns.forEach((l, i) => l.scale.setScalar(1 + Math.sin(t * 3 + i) * 0.05));
      cocoaBarista.rotation.y = Math.sin(t * 0.5) * 0.3; cocoaBarista.position.y = Math.abs(Math.sin(t * 2)) * 0.05;
    },
    dispose() { disposables.forEach(d => { d.map?.dispose?.(); d.dispose?.(); }); },
  };
}
