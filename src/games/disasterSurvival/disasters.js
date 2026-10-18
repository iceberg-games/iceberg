// Disasters for Natural Disaster Survival. Each entry: { id, name, icon, warn, mood, create(W, mult) }
// create() returns { update(dt, t, k), hazard(ent, dt) -> {dmg, px, pz, lift}, end() }, where k is the
// 0..1 progress through the disaster and ent = { pos, sheltered: bool, player: bool }.
// W is the world API from index.js (scene, blocks, detach, debris, burst, audio, ui, shake, precip, ...).
import * as THREE from 'three';
import { ISLAND_R } from './map.js';

const rand = (a, b) => a + Math.random() * (b - a);
const xz = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

function swirlTexture() {
  const c = document.createElement('canvas'); c.width = 128; c.height = 256; const g = c.getContext('2d');
  g.clearRect(0, 0, 128, 256);
  for (let i = 0; i < 70; i++) {
    const y = Math.random() * 256, a = 0.35 + Math.random() * 0.45, v = 120 + Math.random() * 80;
    g.strokeStyle = `rgba(${v},${v},${v + 10},${a})`; g.lineWidth = 2 + Math.random() * 7;
    g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(40, y - 20, 90, y + 20, 128, y - 8); g.stroke();
  }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}

export const DISASTERS = [
  // ------------------------------------------------------------------ TORNADO
  {
    id: 'tornado', name: 'Tornado', icon: '🌪️', warn: 'A tornado is forming! Stay away from the funnel.',
    mood: { top: '#4b5560', bottom: '#9aa3a8', fog: '#8d969b', near: 30, far: 190, sun: 0.7, hemi: 0.75 },
    create(W, mult) {
      const R = 6 * mult, H = 46;
      const grp = new THREE.Group(); W.scene.add(grp);
      const tex = swirlTexture();
      const layers = [];
      for (let i = 0; i < 6; i++) {
        const t = tex.clone(); t.needsUpdate = true; t.repeat.set(2 + i * 0.3, 1);
        const m = new THREE.MeshBasicMaterial({ map: t, transparent: true, opacity: 0.95 - i * 0.06, depthWrite: false, side: THREE.DoubleSide, color: i % 2 ? '#6e767e' : '#545c64', fog: true });
        const rBot = (1.4 + i * 0.5) * mult, rTop = (11 + i * 1.6) * mult;
        const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBot, H, 28, 1, true), m); mesh.position.y = H / 2; grp.add(mesh); layers.push(mesh);
      }
      const dust = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 8), new THREE.MeshBasicMaterial({ color: '#c8c2b8', transparent: true, opacity: 0.55, depthWrite: false }));
      dust.scale.set(R * 1.4, 2.4, R * 1.4); grp.add(dust);
      const cloud = new THREE.Mesh(new THREE.CylinderGeometry(60, 28, 6, 32, 1, true), new THREE.MeshBasicMaterial({ color: '#5a636b', transparent: true, opacity: 0.7, depthWrite: false, side: THREE.DoubleSide })); cloud.position.y = H + 2; grp.add(cloud);
      const pos = new THREE.Vector3(-ISLAND_R * 0.9, 0, rand(-30, 30)); let target = W.randomPoint(0.7);
      grp.position.copy(pos); grp.scale.setScalar(0.05);
      let ripT = 0;
      return {
        pos,
        update(dt, t, k) {
          grp.scale.setScalar(Math.min(1, grp.scale.x + dt * 0.5));
          if (xz(pos, target) < 4) target = Math.random() < 0.4 ? W.playerPos().clone() : W.randomPoint(0.75);
          const d = new THREE.Vector3(target.x - pos.x, 0, target.z - pos.z).normalize();
          pos.addScaledVector(d, (5 + mult * 1.5) * dt);
          grp.position.set(pos.x + Math.sin(t * 1.7) * 0.6, 0, pos.z + Math.cos(t * 1.3) * 0.6);
          layers.forEach((l, i) => { l.rotation.y -= dt * (3.2 - i * 0.3); l.material.map.offset.y += dt * (0.2 + i * 0.05); l.position.x = Math.sin(t * 0.8 + i) * i * 0.35; });
          dust.rotation.y += dt * 2;
          const near = Math.max(0.25, 1 - xz(W.playerPos(), pos) / 70);
          W.audio.sampleLoop('tornado', 0.6 * near, { name: 'wind', freq: 500, type: 'bandpass', q: 0.8, lfo: 1.3 });
          // rip blocks off buildings
          ripT += dt;
          if (ripT > 0.05) { ripT = 0; W.forBlocksNear(pos.x, pos.z, R * 1.1, (b) => { if (Math.random() < 0.18 * mult) { const a = Math.atan2(b.z - pos.z, b.x - pos.x) + Math.PI / 2; W.detach(b, Math.cos(a) * 14, rand(10, 18), Math.sin(a) * 14); } }); }
          // swirl loose debris
          for (const p of W.debris) {
            const dx = p.p.x - pos.x, dz = p.p.z - pos.z, dd = Math.hypot(dx, dz);
            if (dd < R * 1.8 && p.p.y < H) { const tx = -dz / (dd + 0.1), tz = dx / (dd + 0.1); p.v.x += (tx * 30 - dx * 2) * dt; p.v.z += (tz * 30 - dz * 2) * dt; p.v.y += (dd < R ? 42 : 20) * dt; p.life = Math.max(p.life, 4); }
          }
        },
        hazard(e, dt) {
          const dx = e.pos.x - pos.x, dz = e.pos.z - pos.z, d = Math.hypot(dx, dz) + 0.01;
          if (d < R) return { dmg: 24 * mult, px: (-dz / d) * 11 - (dx / d) * 3, pz: (dx / d) * 11 - (dz / d) * 3, lift: 13 };
          if (d < R * 2.6) { const s = 5 * (1 - d / (R * 2.6)); return { dmg: 0, px: (-dx / d) * s, pz: (-dz / d) * s }; }
          return null;
        },
        end() { W.scene.remove(grp); layers.forEach(l => { l.geometry.dispose(); l.material.map.dispose(); l.material.dispose(); }); tex.dispose(); dust.geometry.dispose(); cloud.geometry.dispose(); W.audio.sampleLoop('tornado', 0); W.audio.loop('wind', 0); },
      };
    },
  },
  // ------------------------------------------------------------------ BLIZZARD
  {
    id: 'blizzard', name: 'Blizzard', icon: '❄️', warn: 'A blizzard is rolling in! Get indoors before you freeze.',
    mood: { top: '#c7d3de', bottom: '#eef3f7', fog: '#e6edf3', near: 2, far: 34, sun: 0.35, hemi: 1.0 },
    create(W, mult) {
      const ang = rand(0, Math.PI * 2), wx = Math.cos(ang), wz = Math.sin(ang);
      W.precip({ count: 6000, color: '#ffffff', size: 0.16, fall: 5, wind: [wx * 16 * mult, wz * 16 * mult], streak: false });
      W.fogOverride = { near: 2, far: 34 / Math.sqrt(mult) };
      return {
        update(dt, t, k) {
          W.audio.loop('wind', 0.75 + Math.sin(t * 0.7) * 0.2, { freq: 900, type: 'bandpass', q: 1.2, lfo: 0.9 });
          W.ui.setFrost(W.playerExposed ? Math.min(1, 0.4 + k) : 0.15);
          if (Math.random() < dt * 3) W.forBlocksNear(rand(-60, 60), rand(-60, 60), 3, (b) => { if (b.y > 3 && Math.random() < 0.08) W.detach(b, wx * 8, 2, wz * 8); });
        },
        hazard(e) { if (e.sheltered) { if (W.nearOpening(e.pos)) return { dmg: 1.6 * mult, cold: true }; return null; } return { dmg: 4.8 * mult, px: wx * 3 * mult, pz: wz * 3 * mult, cold: true }; },
        end() { W.precip(null); W.fogOverride = null; W.ui.setFrost(0); W.audio.loop('wind', 0); },
      };
    },
  },
  // ------------------------------------------------------------------ AVALANCHE
  {
    id: 'avalanche', name: 'Avalanche', icon: '🏔️', warn: 'The glacier is breaking loose! Get to high ground.',
    mood: { top: '#7fa6c8', bottom: '#dfeaf2', fog: '#d6e3ec', near: 40, far: 240, sun: 1.2, hemi: 1.0 },
    create(W, mult) {
      const Hh = 5.2 * mult, BAND = 14;
      const geo = new THREE.BoxGeometry(BAND, 1, 190, 10, 1, 60);
      const p = geo.attributes.position;
      for (let i = 0; i < p.count; i++) { if (p.getY(i) > 0) { p.setY(i, 0.5 + Math.sin(p.getZ(i) * 0.35) * 0.08 + Math.random() * 0.12 - (p.getX(i) > 0 ? 0.25 : 0)); } }
      geo.computeVertexNormals();
      const wall = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: '#f4f8ff', roughness: 1, emissive: '#c8d8ea', emissiveIntensity: 0.25 })); wall.castShadow = true;
      wall.scale.y = Hh; wall.position.y = Hh / 2; W.scene.add(wall);
      // powder cloud in front of the wall
      const N = 900, pp = new Float32Array(N * 3), seeds = new Float32Array(N);
      for (let i = 0; i < N; i++) { seeds[i] = Math.random(); pp[i * 3 + 2] = rand(-95, 95); }
      const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(pp, 3));
      const powder = new THREE.Points(pg, new THREE.PointsMaterial({ color: '#ffffff', size: 1.6, transparent: true, opacity: 0.55, depthWrite: false })); powder.frustumCulled = false; W.scene.add(powder);
      let xf = -ISLAND_R - 30, wave = 0, rumble = 0, baseH = Hh, curH = Hh;
      const speed = 13 + mult * 2;
      W.audio.sfx('boom', 0.6);
      return {
        get front() { return xf; },
        update(dt, t, k) {
          rumble = Math.max(0, 1 - Math.abs(W.playerPos().x - xf) / 90);
          W.audio.loop('rumble', 0.4 + rumble * 0.8, { freq: 140, type: 'lowpass' });
          W.shake(0.05 + rumble * 0.25);
          xf += speed * dt;
          if (xf > ISLAND_R + 40 && wave < 1) { wave++; xf = -ISLAND_R - 60; baseH *= 1.12; }
          const bx0 = W.bunkerMinX ?? 1e9, h0 = baseH;
          const h = curH = xf > bx0 ? h0 * Math.max(0.3, 1 - (xf - bx0) / 18) : h0; // the holdout breaks the wave: it hits the west side hardest
          wall.scale.y = h; wall.position.set(xf - BAND / 2, h / 2 - 0.05, 0);
          for (let i = 0; i < N; i++) { const s = seeds[i], ph = (t * 0.6 + s) % 1; pp[i * 3] = xf + ph * 6 - 2; pp[i * 3 + 1] = h * (0.3 + ph * 0.9) + Math.sin(s * 40 + t) * 0.6; }
          pg.attributes.position.needsUpdate = true;
          W.forBlocksInBox(xf - 2, xf + 1, h, (b) => W.detach(b, rand(14, 22), rand(2, 7), rand(-3, 3)));
        },
        hazard(e) {
          const h = curH;
          if (e.pos.x > xf - BAND && e.pos.x < xf + 1 && e.pos.y < h) return { dmg: 75, px: speed + 3, pz: 0, lift: 2, bury: true };
          return null;
        },
        end() { W.scene.remove(wall, powder); geo.dispose(); wall.material.dispose(); pg.dispose(); powder.material.dispose(); W.audio.loop('rumble', 0); },
      };
    },
  },
  // ------------------------------------------------------------------ EARTHQUAKE
  {
    id: 'earthquake', name: 'Earthquake', icon: '🌋', warn: 'The ground is shaking! Get out of the buildings.',
    mood: { top: '#a8907a', bottom: '#e8d8c4', fog: '#d8c8b4', near: 40, far: 230, sun: 1.1, hemi: 0.9 },
    create(W, mult) {
      const cracks = new THREE.Group(); W.scene.add(cracks);
      const cm = new THREE.MeshBasicMaterial({ color: '#1a1410' });
      const crackList = [];
      for (let i = 0; i < 14; i++) { const p = W.randomPoint(0.9); const m = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.04, 1), cm); m.position.set(p.x, 0.03, p.z); m.rotation.y = rand(0, Math.PI); m.scale.z = 0.01; cracks.add(m); crackList.push({ m, len: rand(8, 24) }); }
      let acc = 0, collapsed = false;
      return {
        update(dt, t, k) {
          const s = (0.18 + 0.25 * Math.sin(k * Math.PI)) * mult;
          W.shake(s);
          W.audio.loop('rumble', 0.6 + s, { freq: 90 + Math.sin(t * 3) * 20, type: 'lowpass' });
          for (const c of crackList) c.m.scale.z = Math.min(c.len, c.m.scale.z + dt * 3);
          acc += dt * (4 + 14 * k) * mult;
          while (acc > 1) { acc--; const b = W.randomBlock(true); if (b) { W.detach(b, rand(-2, 2), rand(0, 2), rand(-2, 2)); if (Math.random() < 0.15) W.audio.sfx('crack', 0.6); } }
          if (!collapsed && k > 0.55) { collapsed = true; W.collapseBuilding(); W.audio.sfx('boom', 0.8); }
        },
        hazard(e) { return { dmg: 0, px: Math.sin(performance.now() * 0.03) * 2.2 * mult, pz: Math.cos(performance.now() * 0.027) * 2.2 * mult }; },
        end() { W.scene.remove(cracks); crackList.forEach(c => c.m.geometry.dispose()); cm.dispose(); W.audio.loop('rumble', 0); },
      };
    },
  },
  // ------------------------------------------------------------------ FLOOD
  {
    id: 'flood', name: 'Flood', icon: '🌊', warn: 'The sea is rising! Climb as high as you can.',
    mood: { top: '#5a7a96', bottom: '#b8ccd8', fog: '#a8bccb', near: 30, far: 200, sun: 0.7, hemi: 0.9 },
    create(W, mult) {
      const top = Math.min(10, 6 * mult);
      W.precip({ count: 3000, color: '#a8c8ff', size: 0.09, fall: 30, wind: [3, 1], streak: true });
      W.setFlood(0.01);
      return {
        get level() { return W.flood; },
        update(dt, t, k) {
          const target = k < 0.5 ? top * Math.min(1, k / 0.45) : k > 0.88 ? top * (1 - (k - 0.88) / 0.12) : top;
          W.setFlood(Math.max(0.01, target));
          W.audio.sampleLoop('tsunami', 0.6, { name: 'water', freq: 700, type: 'lowpass', lfo: 0.5 });
        },
        hazard(e) {
          const lv = W.flood;
          if (e.pos.y < lv - 0.4) return { dmg: 7 * mult, px: 1.2, pz: 0.6, swim: lv, cold: true };
          return null;
        },
        end() { W.setFlood(0); W.precip(null); W.audio.sampleLoop('tsunami', 0); W.audio.loop('water', 0); },
      };
    },
  },
  // ------------------------------------------------------------------ METEOR SHOWER
  {
    id: 'meteor', name: 'Meteor Shower', icon: '☄️', warn: 'Meteors incoming! Watch the sky for red rings.',
    mood: { top: '#1b1530', bottom: '#7a3a3a', fog: '#4a2a34', near: 40, far: 220, sun: 0.45, hemi: 0.5 },
    create(W, mult) {
      const rock = new THREE.IcosahedronGeometry(1, 0);
      const rockM = new THREE.MeshStandardMaterial({ color: '#5a3020', emissive: '#ff6a10', emissiveIntensity: 1.4, roughness: 0.8, flatShading: true });
      const trailG = new THREE.ConeGeometry(1, 1, 10, 1, true); trailG.translate(0, -0.5, 0);
      const trailM = new THREE.MeshBasicMaterial({ color: '#ffb050', transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false });
      const ringG = new THREE.RingGeometry(0.85, 1, 32); ringG.rotateX(-Math.PI / 2);
      const craterG = new THREE.CircleGeometry(1, 20); craterG.rotateX(-Math.PI / 2);
      const craterM = new THREE.MeshBasicMaterial({ color: '#2a1e18', transparent: true, opacity: 0.8, depthWrite: false });
      const list = [], craters = [];
      let acc = 0.5;
      const dir = new THREE.Vector3(rand(-0.4, 0.4), -1, rand(-0.4, 0.4)).normalize();
      const fire = new THREE.PointLight('#ff7a20', 0, 30, 1.6); W.scene.add(fire);
      return {
        update(dt, t, k) {
          acc += dt * (1.2 + k * 1.2) * mult;
          while (acc > 1) {
            acc--;
            const tgt = Math.random() < 0.35 ? W.playerPos().clone().add(new THREE.Vector3(rand(-6, 6), 0, rand(-6, 6))) : W.randomPoint(0.95);
            tgt.y = W.surfaceAt(tgt.x, tgt.z);
            const size = rand(0.8, 1.6) * Math.sqrt(mult);
            const m = new THREE.Mesh(rock, rockM); m.scale.setScalar(size);
            const tr = new THREE.Mesh(trailG, trailM); tr.scale.set(size * 0.9, size * 9, size * 0.9); m.add(tr);
            tr.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().negate()); tr.scale.set(0.9, 9, 0.9);
            const ring = new THREE.Mesh(ringG, new THREE.MeshBasicMaterial({ color: '#ff2a1a', transparent: true, opacity: 0.9, depthWrite: false })); ring.position.set(tgt.x, tgt.y + 0.06, tgt.z); ring.scale.setScalar(4 * size);
            W.scene.add(m, ring);
            list.push({ m, ring, tgt, size, tt: 2.0 });
            if (Math.random() < 0.3) W.audio.sfx('whoosh', 0.7);
          }
          fire.intensity = Math.max(0, fire.intensity - dt * 120);
          for (let i = list.length - 1; i >= 0; i--) {
            const q = list[i]; q.tt -= dt;
            q.m.position.copy(q.tgt).addScaledVector(dir, -q.tt * 45); q.m.rotation.x += dt * 4;
            q.ring.material.opacity = 0.5 + 0.5 * Math.sin(t * 20);
            if (q.tt <= 0) {
              W.scene.remove(q.m, q.ring); q.ring.material.dispose(); list.splice(i, 1);
              const r = 3.2 * q.size;
              W.explode(q.tgt, r, 70 * q.size);
              fire.position.copy(q.tgt).setY(q.tgt.y + 2); fire.intensity = 400;
              const c = new THREE.Mesh(craterG, craterM); c.position.set(q.tgt.x, q.tgt.y + 0.04, q.tgt.z); c.scale.setScalar(r * 0.9); W.scene.add(c); craters.push(c);
            }
          }
          W.audio.loop('rumble', 0.25, { freq: 200, type: 'lowpass' });
        },
        hazard() { return null; }, // damage comes from W.explode
        end() { for (const q of list) { W.scene.remove(q.m, q.ring); q.ring.material.dispose(); } for (const c of craters) W.scene.remove(c); W.scene.remove(fire); [rock, trailG, ringG, craterG].forEach(g => g.dispose()); [rockM, trailM, craterM].forEach(m => m.dispose()); W.audio.loop('rumble', 0); },
      };
    },
  },
  // ------------------------------------------------------------------ LIGHTNING STORM
  {
    id: 'lightning', name: 'Lightning Storm', icon: '⚡', warn: 'Thunderstorm overhead! Lightning strikes the highest points. Stay low.',
    mood: { top: '#1e2430', bottom: '#4a5466', fog: '#3a4454', near: 25, far: 170, sun: 0.25, hemi: 0.45 },
    create(W, mult) {
      W.precip({ count: 3500, color: '#9ab8e8', size: 0.08, fall: 34, wind: [-4, 2], streak: true });
      const boltM = new THREE.MeshBasicMaterial({ color: '#e8f4ff', transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false });
      const markG = new THREE.CylinderGeometry(1, 1, 1, 16, 1, true);
      const flashL = new THREE.PointLight('#cfe4ff', 0, 60, 1.2); W.scene.add(flashL);
      const pend = [], bolts = [];
      let acc = 0.2;
      function bolt(from, to) {
        const g = new THREE.Group(); let a = from.clone();
        for (let i = 0; i < 9; i++) {
          const b = i === 8 ? to.clone() : a.clone().lerp(to, 1 / (9 - i)).add(new THREE.Vector3(rand(-2, 2), 0, rand(-2, 2)));
          const len = a.distanceTo(b), seg = new THREE.Mesh(new THREE.BoxGeometry(0.25, len, 0.25), boltM);
          seg.position.copy(a).lerp(b, 0.5); seg.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize()); g.add(seg); a = b;
        }
        W.scene.add(g); bolts.push({ g, life: 0.25 });
      }
      return {
        update(dt, t, k) {
          acc += dt * (0.9 + k) * mult;
          while (acc > 1) {
            acc--;
            let tgt;
            const pp = W.playerPos();
            if (pp.y > 3.5 && Math.random() < 0.5) tgt = pp.clone().add(new THREE.Vector3(rand(-1.5, 1.5), 0, rand(-1.5, 1.5)));
            else { const b = W.randomBlock(true); tgt = b && Math.random() < 0.7 ? new THREE.Vector3(b.x, b.y + b.h / 2, b.z) : W.randomPoint(0.9); }
            tgt.y = Math.max(tgt.y, W.surfaceAt(tgt.x, tgt.z));
            const mk = new THREE.Mesh(markG, new THREE.MeshBasicMaterial({ color: '#8fd0ff', transparent: true, opacity: 0.25, depthWrite: false, side: THREE.DoubleSide }));
            mk.scale.set(2.6, 30, 2.6); mk.position.set(tgt.x, tgt.y + 15, tgt.z); W.scene.add(mk);
            pend.push({ tgt, mk, tt: 1.3 });
          }
          for (let i = pend.length - 1; i >= 0; i--) {
            const q = pend[i]; q.tt -= dt; q.mk.material.opacity = 0.12 + 0.25 * (1 - q.tt / 1.3) * (0.6 + 0.4 * Math.sin(t * 30));
            if (q.tt <= 0) {
              W.scene.remove(q.mk); q.mk.material.dispose(); pend.splice(i, 1);
              bolt(q.tgt.clone().setY(70).add(new THREE.Vector3(rand(-8, 8), 0, rand(-8, 8))), q.tgt);
              flashL.position.copy(q.tgt).setY(q.tgt.y + 6); flashL.intensity = 900;
              W.explode(q.tgt, 2.4, 55, { lightning: true });
              const near = W.playerPos().distanceTo(q.tgt);
              W.audio.sfx('thunder', Math.max(0.25, 1 - near / 80)); if (near < 40) W.ui.whiteFlash(0.5 * (1 - near / 40));
            }
          }
          for (let i = bolts.length - 1; i >= 0; i--) { const b = bolts[i]; b.life -= dt; b.g.visible = Math.floor(b.life * 40) % 3 !== 0; if (b.life <= 0) { W.scene.remove(b.g); b.g.children.forEach(s => s.geometry.dispose()); bolts.splice(i, 1); } }
          flashL.intensity = Math.max(0, flashL.intensity - dt * 4000);
          W.skyFlash(flashL.intensity / 900);
          W.audio.loop('water', 0.35, { freq: 2500, type: 'highpass' });
        },
        hazard() { return null; },
        end() { for (const q of pend) { W.scene.remove(q.mk); q.mk.material.dispose(); } for (const b of bolts) W.scene.remove(b.g); W.scene.remove(flashL); markG.dispose(); boltM.dispose(); W.skyFlash(0); W.precip(null); W.audio.loop('water', 0); },
      };
    },
  },
];
export const DISASTER_IDS = DISASTERS.map(d => d.id);
export const findDisaster = (id) => DISASTERS.find(d => d.id === id);
