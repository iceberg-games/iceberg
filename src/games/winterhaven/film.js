// Filming helpers for the Winterhaven trailer. FILMING ONLY: active only with ?whfilm=1 in the URL.
// Nothing here talks to the server or the economy. forceAcceptQuest / completeQuestForFilm change the
// LOCAL quest display state only (markers, pickups, tracker), so they can't grant cosmetics or Birg Bucks.
//   ?whfilm=1   enable window.whFilm      ?whclean=1  start with no UI      ?whfreecam=1  start in free cam
//   ?what=<anchor|npc id>  start at that spot
import * as THREE from 'three';

export const filmEnabled = () => { try { return new URLSearchParams(location.search).get('whfilm') === '1'; } catch { return false; } };
const q = (k) => { try { return new URLSearchParams(location.search).get(k); } catch { return null; } };

/** Free-fly camera (engine cameraController): WASD move, R/F up/down, Shift fast, drag to look, wheel = speed. */
class FreeCam {
  constructor(camera) { this.camera = camera; const e = new THREE.Euler().setFromQuaternion(camera.quaternion, 'YXZ'); this.yaw = e.y; this.pitch = e.x; this.speed = 14; }
  drag(dx, dy) { this.yaw -= dx * 0.004; this.pitch = Math.max(-1.5, Math.min(1.5, this.pitch - dy * 0.004)); }
  wheel(dy) { this.speed = Math.max(2, Math.min(120, this.speed * (dy > 0 ? 0.85 : 1.18))); }
  update(dt, input) {
    const k = (c) => input.down(c), sp = this.speed * (k('ShiftLeft') || k('ShiftRight') ? 3 : 1) * dt;
    const f = (k('KeyW') ? 1 : 0) - (k('KeyS') ? 1 : 0), s = (k('KeyD') ? 1 : 0) - (k('KeyA') ? 1 : 0), u = (k('KeyR') ? 1 : 0) - (k('KeyF') ? 1 : 0);
    const an = input.analog; const af = an && Math.abs(an.y) > 0.05 ? an.y : f, as = an && Math.abs(an.x) > 0.05 ? an.x : s;
    const c = this.camera; c.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
    const fw = new THREE.Vector3(0, 0, -1).applyQuaternion(c.quaternion), rt = new THREE.Vector3(1, 0, 0).applyQuaternion(c.quaternion);
    c.position.addScaledVector(fw, af * sp).addScaledVector(rt, as * sp); c.position.y += u * sp;
  }
}

export function installFilm({ game, engine, ui, anchors, npcs, villagers, states, flow, step, refreshWorld, persist, groundHeight, run }) {
  if (!filmEnabled()) return null;
  const style = document.createElement('style');
  style.textContent = 'body.wh-clean #app > :not(canvas){display:none!important} body.wh-clean #wh-ui{display:none!important} body.wh-clean > :not(#app):not(script):not(style){display:none!important}';
  document.head.append(style);
  let cam = null;
  const api = {
    note: 'FILMING ONLY (?whfilm=1). Local display state only: no server calls, no rewards.',
    anchors: Object.keys(anchors), npcs: Object.keys(npcs),
    teleportTo(key, { face } = {}) {
      const a = npcs[key] || anchors[key]; if (!a) throw new Error(`unknown spot ${key}; try ${api.anchors.concat(api.npcs).join(', ')}`);
      let x = a.x, z = a.z, f = a.facing ?? 0;
      if (npcs[key]) { const nf = a.facing || 0, dd = a.talk ? 8 : 4; x += Math.sin(nf) * dd; z += Math.cos(nf) * dd; f = nf + Math.PI; } // stand in front of the NPC, facing them
      else if (key === 'market') { x += Math.sin(f) * 8; z += Math.cos(f) * 8; f += Math.PI; } // set anchor sits inside the stall collider
      engine.player.teleport(new THREE.Vector3(x, groundHeight(x, z) + 0.2, z), face ?? f); engine.player.updateCamera?.();
      return { x: +x.toFixed(2), y: +groundHeight(x, z).toFixed(2), z: +z.toFixed(2) };
    },
    forceAcceptQuest(id) { if (!(id in states)) throw new Error('unknown quest ' + id); states[id] = 'active'; refreshWorld(); return states[id]; },
    forceCarry(id) { if (!(id in states)) throw new Error('unknown quest ' + id); states[id] = 'carrying'; refreshWorld(); return states[id]; },
    /** Shows the quest as done locally (NPC marker/tracker). Does NOT call quests.complete or pay BB. */
    completeQuestForFilm(id) { if (!(id in states)) throw new Error('unknown quest ' + id); states[id] = 'done'; refreshWorld(); return states[id]; },
    resetFilmQuests() { for (const id in states) states[id] = 'new'; refreshWorld(); },
    clean(on = true) { document.body.classList.toggle('wh-clean', !!on); return !!on; },
    nametags(on = true) { villagers.forEach(v => { v.group.children.forEach(c => { if (c.isSprite) c.visible = !!on; }); }); },
    freeCam(on = true) {
      if (on && !cam) { cam = new FreeCam(engine.camera); game.cameraController = cam; }
      else if (!on && cam) { cam = null; delete game.cameraController; engine.player.updateCamera?.(); }
      return !!cam;
    },
    camPose() { const c = engine.camera, e = new THREE.Euler().setFromQuaternion(c.quaternion, 'YXZ'); return { pos: c.position.toArray().map(v => +v.toFixed(2)), yaw: +e.y.toFixed(3), pitch: +e.x.toFixed(3) }; },
    setCamPose({ pos, yaw, pitch }) { api.freeCam(true); engine.camera.position.fromArray(pos); cam.yaw = yaw; cam.pitch = pitch; },
    hidePlayer(on = true) { engine.avatar.root.visible = !on; },
    startRun() { run.start(); },
    /** Every roster NPC with its in-game stand point (after any step-out from a cabin collider) and linked quests. */
    npcTable() { return Object.values(npcs).map(n => ({ id: n.id, name: n.name, area: n.area, role: n.role, x: +n.x.toFixed(2), y: +groundHeight(n.x, n.z).toFixed(2), z: +n.z.toFixed(2), facing: +(n.facing || 0).toFixed(2), nudged: !!n.nudged, quests: Object.keys(flow).filter(q => flow[q].giver === n.id) })); },
    flow, states,
  };
  window.whFilm = api;
  if (q('whclean') === '1') api.clean(true);
  const at = q('what'); if (at) setTimeout(() => { try { api.teleportTo(at); } catch { /* */ } }, 50);
  if (q('whfreecam') === '1') setTimeout(() => api.freeCam(true), 100);
  void step; void persist;
  return { dispose() { style.remove(); document.body.classList.remove('wh-clean'); if (window.whFilm === api) delete window.whFilm; } };
}
