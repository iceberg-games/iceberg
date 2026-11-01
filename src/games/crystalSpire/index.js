// Game: Crystal Spire. Tall icy parkour up a faceted crystal needle (Set Builder's `crystal-spire` set):
// a spiral of 48 ledges, 3 checkpoint geodes, wind bridges to satellite shards, glowing shard rings and
// a summit beacon. Hazards: slippery cyan ledges, vanishing violet panes, wind gusts on the bridges and
// high up, and fall-shatter. Collect shards, fly through rings (−1 s each), light the beacon. One-time
// Birg Bucks for Bronze/Silver/Gold summit times (15/25/40), saved per profile via economy.saveGameData.
// Modules: config.js (numbers/save), audio.js (Sound pack), ui.js (HUD/cards), thumb.js, set/ (folded set).
// Movement comes from the engine player; game keys (Enter/R) are read from engine.input only.
import * as THREE from 'three';
import { Collision, makeConvex } from '../../engine/collision.js';
import { GAME_ID, GAME_NAME, REWARD_SOURCE, rewardReason, normalizeSave, mergeSaves, finishClimb, fmtTime, FALL_DEATH, PANE, GUST } from './config.js';
import { SpireAudio } from './audio.js';
import { SpireUI } from './ui.js';
import { drawThumb } from './thumb.js';
import * as L from './set/layout.js';

const HW = 0.42, V = (x, y, z) => new THREE.Vector3(x, y, z);
let thumbCache = null;

function persist(economy, save) {
  if (typeof economy.saveGameData === 'function') return economy.saveGameData(GAME_ID, save);
  economy.profile.gameData = { ...(economy.profile.gameData || {}), [GAME_ID]: save };
  economy.backend?.saveProfile?.(economy.profile);
  return Promise.resolve({ ok: true });
}
// oriented box collider (axes orthonormal)
function obb(c, ax, ay, az, hx, hy, hz) {
  const verts = [];
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1])
    verts.push([c.x + ax.x * hx * sx + ay.x * hy * sy + az.x * hz * sz, c.y + ax.y * hx * sx + ay.y * hy * sy + az.y * hz * sz, c.z + ax.z * hx * sx + ay.z * hy * sy + az.z * hz * sz]);
  const A = [ax, ay, az].map(v => [v.x, v.y, v.z]); return makeConvex(verts, A, A);
}
function prism(x, z, r, y0, y1, n) {
  const verts = [], normals = [[0, 1, 0]], edges = [[0, 1, 0]];
  for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2, b = (i + 1) / n * Math.PI * 2;
    verts.push([x + Math.cos(a) * r, y0, z + Math.sin(a) * r], [x + Math.cos(a) * r, y1, z + Math.sin(a) * r]);
    const m = (a + b) / 2; normals.push([Math.cos(m), 0, Math.sin(m)]); edges.push([Math.cos(b) - Math.cos(a), 0, Math.sin(b) - Math.sin(a)]); }
  return makeConvex(verts, normals, edges);
}
const inRect = (p, x, z, pad = 0.1) => { const c = Math.cos(p.rot), s = Math.sin(p.rot), dx = x - p.x, dz = z - p.z; return Math.abs(dx * c - dz * s) <= p.d / 2 + pad && Math.abs(dx * s + dz * c) <= p.w / 2 + pad; };

export default {
  id: GAME_ID,
  name: GAME_NAME,
  tagline: 'Race the light up a frozen crystal needle',
  description: 'Climb a glittering 78 m crystal spire above a glacier cirque. Leap faceted ledges, dodge slippery ice and vanishing panes, brave the wind bridges, grab shards and fly through glowing rings, then light the summit beacon. Beat the clock for Bronze, Silver and Gold — each pays Birg Bucks the first time.',
  get thumbnail() { if (!thumbCache) { try { thumbCache = drawThumb(); } catch { thumbCache = 'frost'; } } return thumbCache; },
  music: 'none', // plays its own Sound-designed loops through the shared audio output
  features: {},
  mobile: true,  // shared joystick + jump; respawn button sits top-right, clear of touch controls

  async create(ctx) {
    const { engine, economy, music, avatar } = ctx;
    const player = engine.player, input = engine.input;
    const mod = await import('./set/index.js');
    const set = await mod.default.create({ renderer: engine.renderer, gameplay: true });
    set.setNight?.(0.85); set.setWeather?.(0);
    const scene = set.scene;
    const camFar = engine.camera.far; engine.camera.far = Math.max(camFar, 600); engine.camera.updateProjectionMatrix();
    const exposure = engine.renderer.toneMappingExposure;
    const prevCam = { pitch: player.camPitch, dist: player.camDist };
    player.camPitch = 0.32; player.camDist = 11;

    // ---------- collision ----------
    const collision = new Collision({ floorY: null, bounds: { type: 'box', minX: L.BOUNDS.minX, maxX: L.BOUNDS.maxX, minZ: L.BOUNDS.minZ, maxZ: L.BOUNDS.maxZ } });
    collision.heightAt = (x, z) => L.groundHeight(x, z);
    const platBox = (p) => { const th = p.kind === 'checkpoint' ? 0.8 : 0.5, c = Math.cos(p.rot), s = Math.sin(p.rot);
      return obb(V(p.x, p.y - th / 2, p.z), V(c, 0, -s), V(0, 1, 0), V(s, 0, c), p.d / 2, th / 2, p.w / 2); };
    for (const p of L.PLATFORMS) if (p.kind !== 'pane') collision.addConvex(platBox(p));
    for (const b of L.BRIDGES) { const a = V(...b.a), e = V(...b.b), d = e.clone().sub(a), len = d.length(); d.normalize();
      const side = V(-d.z, 0, d.x).normalize(), up = new THREE.Vector3().crossVectors(side, d).normalize(); if (up.y < 0) up.negate();
      collision.addConvex(obb(a.clone().add(e).multiplyScalar(0.5).addScaledVector(up, -0.2), d, up, side, len / 2, 0.2, b.width / 2)); }
    collision.addConvex(prism(L.SUMMIT.x, L.SUMMIT.z, L.SUMMIT.r, L.SUMMIT.y - 0.6, L.SUMMIT.y, 14));
    for (let y = 0; y < L.NEEDLE.height; y += 6) collision.addConvex(prism(0, 0, L.needleRadius(y + 6) * 0.92, y, y + 6, L.NEEDLE.sides));

    // ---------- disappearing panes (game-rendered) ----------
    const paneMat = new THREE.MeshStandardMaterial({ color: '#e9dcff', roughness: 0.06, metalness: 0.2, transparent: true, opacity: 0.85, emissive: '#8a5cff', emissiveIntensity: 0.45, flatShading: true });
    const panes = L.PLATFORMS.filter(p => p.kind === 'pane').map((p, i) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(p.d, 0.5, p.w), paneMat.clone()); m.position.set(p.x, p.y - 0.25, p.z); m.rotation.y = p.rot; m.castShadow = m.receiveShadow = true; scene.add(m);
      return { p, m, col: platBox(p), on: false, phase: i * 1.3 };
    });
    const paneCycle = PANE.on + PANE.warn + PANE.off;
    function updatePanes(t) {
      for (const q of panes) { const k = (t + q.phase) % paneCycle, on = k < PANE.on + PANE.warn, warn = k >= PANE.on && on;
        if (on !== q.on) { q.on = on; if (on) collision.addConvex(q.col); else { collision.removeConvex(q.col); if (player.pos.distanceTo(q.m.position) < 12) { audio.play('sfx_crystal_step_2', { rate: 1.7, gain: 0.6, minGap: 0.1 }); burst(q.m.position, ['#e9dcff', '#c49bff', '#ffffff'], 18, 2.5); } } }
        q.m.material.opacity = on ? (warn ? 0.35 + 0.5 * (Math.sin(t * 28) > 0 ? 1 : 0) : 0.85) : 0.07;
        q.m.material.emissiveIntensity = on ? (warn ? 1.2 : 0.45) : 0.05; q.m.scale.y = on ? 1 : 0.3; }
    }

    // ---------- beacon sockets (light one per checkpoint) ----------
    const glowMat = (c) => new THREE.MeshBasicMaterial({ color: c, toneMapped: false, transparent: true, opacity: 0.25 });
    const sockets = L.BEACON_SOCKETS.map((s, i) => { const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.45), glowMat(['#7fd4ff', '#c49bff', '#4ff0d0', '#ffe08a'][i])); m.position.set(s.x, s.y + 1.4, s.z); scene.add(m); return m; });
    const beaconLight = new THREE.PointLight('#ffe08a', 0, 60, 1.4); beaconLight.position.set(0, L.BEACON.y, 0); scene.add(beaconLight);
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 2.4, 140, 16, 1, true), new THREE.MeshBasicMaterial({ color: '#ffe8b0', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false }));
    beam.position.set(0, L.BEACON.y + 70, 0); scene.add(beam);
    // checkpoint pillars of light (glow when reached)
    const cpPillars = L.CHECKPOINTS.slice(1, 4).map(c => { const m = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 6, 16, 1, true), new THREE.MeshBasicMaterial({ color: '#7fd4ff', transparent: true, opacity: 0.12, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide })); m.position.set(c.x, c.y + 3, c.z); scene.add(m); return m; });

    // ---------- particles ----------
    const PN = 400, pGeo = new THREE.OctahedronGeometry(1), pMesh = new THREE.InstancedMesh(pGeo, new THREE.MeshBasicMaterial({ toneMapped: false }), PN);
    pMesh.frustumCulled = false; pMesh.count = 0; scene.add(pMesh);
    const parts = []; const Mx = new THREE.Matrix4(), Qx = new THREE.Quaternion(), Sx = new THREE.Vector3(), Cx = new THREE.Color();
    function burst(at, colors, n = 20, speed = 4, { up = 3, size = 0.14, life = 0.9, grav = 9 } = {}) {
      for (let i = 0; i < n; i++) { if (parts.length >= PN) parts.shift();
        parts.push({ p: at.clone(), v: V((Math.random() - 0.5) * speed * 2, Math.random() * up + up * 0.3, (Math.random() - 0.5) * speed * 2), c: colors[i % colors.length], life, max: life, size: size * (0.6 + Math.random() * 0.8), grav, r: Math.random() * 6 }); }
    }
    function updateParts(dt) {
      let n = 0;
      for (let i = parts.length - 1; i >= 0; i--) { const q = parts[i]; q.life -= dt; if (q.life <= 0) { parts.splice(i, 1); continue; } }
      for (const q of parts) { q.v.y -= q.grav * dt; q.p.addScaledVector(q.v, dt); q.r += dt * 8; const s = q.size * Math.min(1, q.life / q.max * 1.6);
        Qx.setFromEuler(new THREE.Euler(q.r, q.r * 0.7, 0)); Sx.set(s, s * 1.6, s); Mx.compose(q.p, Qx, Sx); pMesh.setMatrixAt(n, Mx); pMesh.setColorAt(n, Cx.set(q.c)); n++; }
      pMesh.count = n; pMesh.instanceMatrix.needsUpdate = true; if (pMesh.instanceColor) pMesh.instanceColor.needsUpdate = true;
    }
    // gust streaks
    const streakN = 60, sGeo = new THREE.BufferGeometry(), sPos = new Float32Array(streakN * 6); sGeo.setAttribute('position', new THREE.BufferAttribute(sPos, 3));
    const streaks = new THREE.LineSegments(sGeo, new THREE.LineBasicMaterial({ color: '#e6f6ff', transparent: true, opacity: 0 })); streaks.frustumCulled = false; scene.add(streaks);

    // ---------- state ----------
    const audio = new SpireAudio(music);
    const testMode = /[?&]csptest=1\b/.test(location.search);
    let save = normalizeSave(economy.cachedGameData ? economy.cachedGameData(GAME_ID) : economy.profile?.gameData?.[GAME_ID]);
    let saveReady = typeof economy.loadGameData !== 'function';
    let disposed = false, mode = 'lobby', time = 0, cp = 0, deaths = 0, got = new Set(), rings = new Set(), dying = 0, rewardPaid = 0;
    let airPeak = 0, prevGround = true, prevVy = 0, stepT = 0, grabCool = 0, slide = V(0, 0, 0), onSlip = false, gust = { t: 14, on: 0, dir: V(1, 0, 0), str: 0 }, bridgeArmed = true, musicHold = -Infinity, prevKeys = new Set();
    const H = L.SUMMIT.y, CPS = L.CHECKPOINTS, shardMeshes = set.shardMeshes || [];
    const ui = new SpireUI({ engine, cps: CPS.slice(1, 4), height: H, onStart: () => startClimb() });
    const showLobby = () => { mode = 'lobby'; ui.showRun(false); ui.showStart(save, !saveReady); };
    if (!saveReady) {
      Promise.race([economy.loadGameData(GAME_ID), new Promise(r => setTimeout(() => r(undefined), 6000))])
        .then((d) => { if (disposed) return; save = mergeSaves(save, d ?? economy.cachedGameData?.(GAME_ID)); saveReady = true; if (mode === 'lobby') showLobby(); })
        .catch(() => { saveReady = true; if (!disposed && mode === 'lobby') showLobby(); });
    }
    const spawnPos = () => V(L.SPAWN.x, 0.1, L.SPAWN.z);
    const cpPos = (k) => { const c = CPS[k]; return k === 0 ? spawnPos() : V(c.x, c.y + 0.1, c.z); };
    const cpFacing = (k) => { if (k === 0) return L.SPAWN.facing; const c = CPS[k], p = L.PLATFORMS.find(q => q.id === c.platform); const a = (p?.a ?? 0) + 0.6; return Math.atan2(Math.cos(a) * 10 - c.x, Math.sin(a) * 10 - c.z) || 0; };
    const resetRunFx = () => { got.clear(); rings.clear(); shardMeshes.forEach(m => { m.visible = true; }); sockets.forEach(s => { s.material.opacity = 0.25; }); cpPillars.forEach(p => { p.material.opacity = 0.12; p.material.color.set('#7fd4ff'); }); beaconLight.intensity = 0; beam.material.opacity = 0; };
    function startClimb() {
      if (!saveReady) return;
      resetRunFx(); time = 0; cp = 0; deaths = 0; dying = 0; rewardPaid = 0; slide.set(0, 0, 0);
      player.enabled = true; avatar.root.visible = true; player.teleport(spawnPos(), L.SPAWN.facing); player.camPitch = 0.32; player.updateCamera?.();
      ui.hideCard(); ui.showRun(true); mode = 'climb'; airPeak = 0; audio.setMusic('base');
      ui.banner('Climb!', 'Race the light to the summit beacon', 1600); audio.play('sfx_checkpoint', { rate: 1.25, gain: 0.6 });
    }
    function reachCp(k) {
      cp = k; audio.checkpoint(); ui.flash(); sockets[k - 1].material.opacity = 1;
      const pil = cpPillars[k - 1]; pil.material.opacity = 0.45; pil.material.color.set('#ffe08a');
      burst(V(CPS[k].x, CPS[k].y + 1.2, CPS[k].z), ['#7fd4ff', '#c49bff', '#ffe08a', '#ffffff'], 46, 4.5, { up: 6, size: 0.2, life: 1.4 });
      ui.banner(CPS[k].name, `Checkpoint ${k}/3 · ${fmtTime(time)}`, 1700);
    }
    function summit() {
      if (mode !== 'climb') return; mode = 'result';
      audio.summit(); ui.confetti(140); ui.flash(); sockets[3].material.opacity = 1; beaconLight.intensity = 260; beam.material.opacity = 0.35;
      burst(V(0, L.SUMMIT.y + 2, 0), ['#ffe08a', '#ffffff', '#c49bff', '#7fd4ff', '#ff8fd0'], 120, 7, { up: 10, size: 0.26, life: 2.2, grav: 5 });
      const r = finishClimb(save, time, got.size); save = r.save; persist(economy, save);   // claims recorded before paying
      for (const t of r.newTiers) economy.earn(t.bb, rewardReason(t.name), { source: REWARD_SOURCE });
      rewardPaid = r.reward;
      ui.banner('SUMMIT!', `${fmtTime(time)} · ${got.size} shards`, 2600);
      setTimeout(() => { if (!disposed && mode === 'result') { ui.showRun(false); ui.showResult({ ...r, time, shards: got.size, total: L.SHARDS.length, deaths }, save, { onAgain: () => startClimb(), onLobby: () => { player.teleport(spawnPos(), L.SPAWN.facing); showLobby(); } }); } }, 2400);
    }
    function die() {
      if (dying > 0 || mode === 'result') return;
      dying = 0.95; deaths++; save.deaths++;
      audio.death(); ui.flash();
      burst(player.pos.clone().add(V(0, 1.3, 0)), ['#a9e4ff', '#ffffff', '#c49bff', '#7fd4ff'], 50, 5, { up: 5, size: 0.18, life: 1.2 });
      player.enabled = false; avatar.root.visible = false; player.vel.set(0, 0, 0);
    }
    function respawn() {
      player.teleport(cpPos(cp), cpFacing(cp)); player.enabled = true; avatar.root.visible = true; airPeak = player.pos.y; slide.set(0, 0, 0);
      audio.setMusic('base'); musicHold = player.pos.y + 3;
      burst(player.pos.clone().add(V(0, 1, 0)), ['#7fd4ff', '#ffffff'], 24, 2, { up: 3 });
    }

    // what's under the player
    function surface(x, z, y) {
      for (const p of L.PLATFORMS) if (Math.abs(p.y - y) < 0.15 && inRect(p, x, z, 0.3)) return { kind: p.kind, p };
      for (const b of L.BRIDGES) { const [ax, ay, az] = b.a, [bx, by, bz] = b.b, vx = bx - ax, vz = bz - az, t = Math.max(0, Math.min(1, ((x - ax) * vx + (z - az) * vz) / (vx * vx + vz * vz)));
        if (Math.hypot(x - ax - vx * t, z - az - vz * t) < b.width / 2 + 0.4) return { kind: 'bridge', b }; }
      if (Math.hypot(x, z) < L.SUMMIT.r + 0.3 && Math.abs(y - L.SUMMIT.y) < 0.3) return { kind: 'summit' };
      return { kind: 'ground' };
    }
    const tmpV = new THREE.Vector3();
    const toScreen = (v) => { tmpV.copy(v).project(engine.camera); const r = engine.renderer.domElement.getBoundingClientRect(); return [r.left + (tmpV.x + 1) / 2 * r.width, r.top + (1 - tmpV.y) / 2 * r.height, tmpV.z < 1]; };
    const free = (x, y, z) => !collision.overlaps(x - HW, y + 0.05, z - HW, x + HW, y + 2.5, z + HW);

    function climbUpdate(dt, t) {
      const p = player.pos, g = player.onGround;
      time += dt;
      // jump / land / steps
      if (prevGround && !g && player.vel.y > 5) audio.play('sfx_jump', { rate: 0.97 + Math.random() * 0.06 });
      if (!g) { airPeak = Math.max(airPeak, p.y); if (prevVy < -16 || airPeak - p.y > 7) audio.startFall(); }
      if (g && !prevGround) {
        audio.stopFall(false);
        if (airPeak - p.y > FALL_DEATH) { die(); return; }
        if (prevVy < -5) { audio.play('sfx_land', { gain: Math.min(1, -prevVy / 16) }); burst(p.clone().add(V(0, 0.1, 0)), ['#ffffff', '#cfeaff'], 10, 1.6, { up: 1.2, size: 0.09, life: 0.5 }); }
      }
      if (g) airPeak = p.y;
      const hs = Math.hypot(player.vel.x, player.vel.z);
      if (g && hs > 1) { stepT -= dt; if (stepT <= 0) { audio.step(); stepT = 0.31; } } else stepT = 0.05;
      // ledge grab assist
      grabCool -= dt;
      if (!g && player.vel.y < 3 && grabCool <= 0 && hs > 1) {
        const fx = player.vel.x / hs, fz = player.vel.z / hs, x = p.x + fx * 0.55, z = p.z + fz * 0.55, top = L.floorHeight(x, z, p.y + 0.35);
        const pane = panes.find(q => !q.on && Math.abs(q.p.y - top) < 0.05 && inRect(q.p, x, z));
        if (!pane && top > p.y + 0.2 && top - p.y <= 0.95 && free(x, top + 0.02, z)) {
          p.set(x, top + 0.02, z); player.vel.y = 0; grabCool = 0.5; audio.play('sfx_ledge_grab');
          burst(p.clone().add(V(0, 0.1, 0)), ['#a9e4ff', '#ffffff'], 12, 1.5, { up: 1.5, size: 0.1, life: 0.5 });
        }
      }
      // surfaces: slip ice, bridges
      const s = g ? surface(p.x, p.z, p.y) : null;
      const slipNow = s?.kind === 'slip';
      if (slipNow && !onSlip) { audio.play('sfx_slip'); burst(p.clone(), ['#4ff0d0', '#ffffff'], 10, 1.5, { up: 1, size: 0.08, life: 0.5 }); }
      onSlip = slipNow;
      if (slipNow) { slide.lerp(V(player.vel.x, 0, player.vel.z), Math.min(1, dt * 1.4)); const out = V(p.x, 0, p.z).normalize().multiplyScalar(0.8); slide.addScaledVector(out, dt * 2); }
      else slide.multiplyScalar(g ? Math.max(0, 1 - dt * 6) : Math.max(0, 1 - dt * 0.8));
      if (s?.kind === 'bridge' && bridgeArmed && gust.on <= 0) { gust.t = Math.min(gust.t, 1.2); bridgeArmed = false; }
      if (s && s.kind !== 'bridge') bridgeArmed = true;
      // gusts: mid-height+ every 12–25 s, strong on bridges
      gust.t -= dt;
      if (gust.t <= 0 && (p.y > H * 0.4 || s?.kind === 'bridge')) {
        gust.t = GUST.min + Math.random() * (GUST.max - GUST.min); gust.on = GUST.dur;
        const a = Math.atan2(p.z, p.x) + (Math.random() < 0.5 ? 1.2 : -1.2); gust.dir.set(Math.cos(a), 0, Math.sin(a));
        audio.play('sfx_wind_gust'); ui.banner('💨 Gust!', '', 900);
      }
      if (gust.on > 0) { gust.on -= dt; const k = Math.sin(Math.max(0, gust.on) / GUST.dur * Math.PI); const onBridge = s?.kind === 'bridge' || (!g && p.y > H * 0.4);
        gust.str = k * (onBridge ? GUST.push : GUST.push * 0.35); } else gust.str = 0;
      const dx = (slide.x * (slipNow ? 0.9 : 0.6) + gust.dir.x * gust.str) * dt, dz = (slide.z * (slipNow ? 0.9 : 0.6) + gust.dir.z * gust.str) * dt;
      if ((dx || dz) && free(p.x + dx, p.y + 0.02, p.z + dz)) { p.x += dx; p.z += dz; }
      // shards + rings
      const chest = p.clone().add(V(0, 1.2, 0));
      L.SHARDS.forEach((sh, i) => { if (got.has(i)) return; if (chest.distanceTo(tmpV.set(sh.x, sh.y, sh.z)) < 1.5) {
        got.add(i); if (shardMeshes[i]) shardMeshes[i].visible = false; const n = audio.shard();
        const at = V(sh.x, sh.y, sh.z); burst(at, ['#7fd4ff', '#c49bff', '#ff8fd0', '#4ff0d0', '#ffe08a'], 22 + n * 6, 2.5, { up: 3, size: 0.12 });
        const [x, y, vis] = toScreen(at); if (vis) ui.floatText(n >= 3 ? '💎 ×4 chain!' : '+💎', x - 20, y - 20, ['#7fd4ff', '#c49bff', '#ff8fd0', '#ffe08a'][n]); } });
      L.SHARD_RINGS.forEach((r, i) => { if (rings.has(i)) return; const nx = Math.sin(r.facing), nz = Math.cos(r.facing), rx = chest.x - r.x, ry = chest.y - r.y, rz = chest.z - r.z, along = rx * nx + rz * nz;
        if (Math.abs(along) < 0.9 && Math.hypot(rx - along * nx, ry, rz - along * nz) < r.r) {
          rings.add(i); time = Math.max(0, time - 1); audio.play('sfx_shard_collect', { rate: 2, gain: 0.8 }); audio.play('sfx_checkpoint', { rate: 1.5, gain: 0.35 });
          burst(V(r.x, r.y, r.z), [r.color, '#ffffff'], 36, 4, { up: 2, size: 0.13, grav: 2 }); const rm = set.ringMeshes?.[i]; if (rm) rm.userData.pop = 0.5;
          const [x, y, vis] = toScreen(V(r.x, r.y, r.z)); if (vis) ui.floatText('Ring! −1.0s', x - 40, y - 30, '#4ff0d0'); } });
      // checkpoints + summit
      if (g && cp < 3) { const c = CPS[cp + 1], pl = L.PLATFORMS.find(q => q.id === c.platform); if (pl && Math.abs(p.y - pl.y) < 0.3 && inRect(pl, p.x, p.z, 0.3)) reachCp(cp + 1); }
      if (g && cp >= 3 && Math.hypot(p.x, p.z) < L.SUMMIT.r + 0.3 && p.y > L.SUMMIT.y - 0.3) summit();
      // fall-out safety
      if (p.y < -5) die();
      // music + wind
      if (p.y > musicHold || p.y < musicHold - 6) musicHold = -Infinity;
      audio.setMusic(musicHold === -Infinity && (p.y > H * 0.4 || cp >= 2) ? 'ascent' : 'base');
    }

    function readKeys() {
      const pressed = (c) => input.down(c) && !prevKeys.has(c);
      if (mode === 'lobby' && pressed('Enter')) startClimb();
      if (mode === 'climb' && pressed('KeyR') && dying <= 0) die();
      prevKeys = new Set(input.keys);
    }

    const game = {
      scene, collision, occluders: [],
      spawn: spawnPos(), spawnFacing: L.SPAWN.facing, maxCamDist: 18,
      onFall: () => die(),
      update(dt, t) {
        audio.tick(); readKeys();
        set.update?.(dt, t); updatePanes(t);
        if (mode === 'climb') {
          if (dying > 0) { dying -= dt; if (dying <= 0) respawn(); }
          else climbUpdate(dt, t);
          ui.setRun({ time, shards: got.size, total: L.SHARDS.length, cpName: CPS[cp].name, y: player.pos.y, cpLevel: cp - 1 });
        }
        prevGround = player.onGround; prevVy = player.vel.y;
        const y = player.pos.y; audio.setWind(y > H * 0.45 ? 0.35 + 0.65 * (y - H * 0.45) / (H * 0.55) : y > H * 0.3 ? 0.15 : 0);
        // juice: sockets bob, pillars pulse, beacon throb, ring pops, gust streaks
        sockets.forEach((m, i) => { m.rotation.y = t * 1.5 + i; m.position.y = L.SUMMIT.y + 1.4 + Math.sin(t * 2 + i) * 0.15; });
        cpPillars.forEach((m, i) => { m.scale.x = m.scale.z = 1 + Math.sin(t * 3 + i) * 0.06; });
        if (beam.material.opacity > 0) { beam.material.opacity = 0.25 + Math.sin(t * 2) * 0.1; beaconLight.intensity = 200 + Math.sin(t * 3) * 60; if (set.tip) set.tip.scale.set(1.6 + Math.sin(t * 4) * 0.2, 4.5, 1.6 + Math.sin(t * 4) * 0.2); }
        (set.ringMeshes || []).forEach((m, i) => { if (m.userData.pop > 0) { m.userData.pop -= dt; m.scale.multiplyScalar(1 + m.userData.pop * 0.8); } if (rings.has(i) && m.material?.opacity != null) { m.material.transparent = true; m.material.opacity = 0.35; } });
        streaks.material.opacity = Math.min(0.55, gust.str / GUST.push * 0.7);
        if (streaks.material.opacity > 0.01) { const p = player.pos; for (let i = 0; i < streakN; i++) { const ph = (t * 1.7 + i * 0.137) % 1, off = (i * 7.31) % 1 - 0.5, h = (i * 3.17) % 1;
          const bx = p.x + (-gust.dir.z) * off * 14 + gust.dir.x * (ph - 0.5) * 18, bz = p.z + gust.dir.x * off * 14 + gust.dir.z * (ph - 0.5) * 18, by = p.y + h * 5;
          sPos.set([bx, by, bz, bx + gust.dir.x * 1.6, by, bz + gust.dir.z * 1.6], i * 6); } sGeo.attributes.position.needsUpdate = true; }
        updateParts(dt);
      },
      dispose() {
        disposed = true; audio.stop(); ui.dispose();
        player.enabled = true; avatar.root.visible = true;
        engine.camera.far = camFar; engine.camera.updateProjectionMatrix(); engine.renderer.toneMappingExposure = exposure;
        player.camPitch = prevCam.pitch; player.camDist = prevCam.dist;
        scene.traverse(o => { o.geometry?.dispose?.(); if (o.material) [].concat(o.material).forEach(m => { m.map?.dispose?.(); m.dispose?.(); }); });
        if (engine.crystalSpire === hooks) delete engine.crystalSpire;
      },
    };
    // Read-only QA hooks + the same actions a player has.
    const hooks = engine.crystalSpire = {
      get mode() { return mode; }, get time() { return time; }, get cp() { return cp; }, get shards() { return got.size; }, get rings() { return rings.size; }, get save() { return save; },
      get rewardPaid() { return rewardPaid; }, get musicPlaying() { return audio.playing; }, get music() { return audio.want; }, get buffers() { return Object.keys(audio.buffers); }, get deaths() { return deaths; },
      startClimb, die, layout: L, player, collision,
      warp(k) { if (testMode) { cp = Math.max(0, Math.min(3, k)); player.teleport(cpPos(cp), cpFacing(cp)); } },
      warpTo(x, y, z) { if (testMode) player.teleport(V(x, y, z), 0); },
    };
    if (testMode) window.__csp = hooks; // ?csptest=1 only, for headless QA
    player.teleport(spawnPos(), L.SPAWN.facing);
    showLobby();
    return game;
  },
};
