import * as THREE from 'three';

/** Runtime ability FX shared by all kits. Mutates scene/player/ui banners. */
export function createEffects({ scene, player, engine, audio, banner }) {
  const tmp = new THREE.Vector3();
  const look = new THREE.Vector3();
  let fogBase = scene.fog ? scene.fog.density : 0.018;
  const statuses = new Set();
  const overlays = [];

  function flash(color = '#ffffff', ms = 350) {
    const el = document.createElement('div');
    Object.assign(el.style, {
      position: 'fixed', inset: '0', background: color, opacity: '0.55',
      pointerEvents: 'none', zIndex: 80, transition: 'opacity 0.25s',
    });
    document.body.appendChild(el);
    overlays.push(el);
    setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 280); }, ms);
  }

  function pulseRing(color, y = 0.2) {
    const m = new THREE.Mesh(
      new THREE.RingGeometry(0.6, 1.4, 32),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85, side: THREE.DoubleSide }),
    );
    m.rotation.x = -Math.PI / 2;
    m.position.copy(player.pos); m.position.y = y;
    scene.add(m);
    const t0 = performance.now();
    function tick() {
      const t = (performance.now() - t0) / 600;
      if (t >= 1) { scene.remove(m); m.geometry.dispose(); m.material.dispose(); return; }
      m.scale.setScalar(1 + t * 3); m.material.opacity = 0.85 * (1 - t);
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  function facing() {
    look.set(0, 0, -1).applyQuaternion(engine.camera.quaternion); look.y = 0;
    if (look.lengthSq() < 1e-6) look.set(0, 0, -1);
    return look.normalize();
  }

  function dash(dist, up = 0) {
    const d = facing();
    player.pos.addScaledVector(d, dist);
    player.pos.y = Math.max(0, player.pos.y + up);
  }

  const api = {
    statuses,
    has: (id) => statuses.has(id),
    clearStatus: (id) => { statuses.delete(id); banner?.(`cleared ${id}`); },
    applyStatus: (id, ms = 2000) => {
      statuses.add(id); banner?.(id);
      setTimeout(() => statuses.delete(id), ms);
    },
    CoreSpark() { statuses.add('CoreSpark'); banner?.('CoreSpark +25% repair'); pulseRing(0x5fe3ff); audio?.('sfx_pip_repair_spark'); },
    FlareBlind() { flash('#fff6c8', 450); pulseRing(0xffe28a, 1.2); banner?.('FlareBlind!'); audio?.('sfx_pip_flare'); api.applyStatus('blinded-out', 2000); },
    WarmHands() { statuses.add('WarmHands'); banner?.('WarmHands +40% revive'); pulseRing(0xffb48a); audio?.('sfx_nell_revive'); },
    ThawKit() { flash('#9dffe0', 300); ['slow', 'freeze', 'rooted'].forEach(s => statuses.delete(s)); pulseRing(0x6dffe0); banner?.('ThawKit — cleansed'); audio?.('sfx_nell_thaw'); },
    RidgeRunner() { statuses.add('RidgeRunner'); banner?.('RidgeRunner stamina'); },
    IceGrapple() { dash(10, 2.2); pulseRing(0x9ec9ff, 1); banner?.('IceGrapple'); audio?.('sfx_juno_grapple'); },
    Slide() { dash(7, 0); flash('#cfe9ff', 180); banner?.('Slide'); audio?.('sfx_juno_slide'); },
    IronHull() { statuses.add('IronHull'); banner?.('IronHull resist'); },
    RimeHook() {
      const d = facing();
      // visual chain
      const geo = new THREE.BufferGeometry().setFromPoints([
        player.pos.clone().add(new THREE.Vector3(0, 1.2, 0)),
        player.pos.clone().addScaledVector(d, 14).add(new THREE.Vector3(0, 1.2, 0)),
      ]);
      const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xb8c7d6 }));
      scene.add(line);
      setTimeout(() => { scene.remove(line); geo.dispose(); line.material.dispose(); }, 280);
      dash(6, 0); banner?.('RimeHook'); audio?.('sfx_hullwarden_hook');
    },
    ShatterSwing() { pulseRing(0xd0e6ff, 0.4); flash('#dbeaff', 200); banner?.('ShatterSwing'); audio?.('sfx_hullwarden_shatter'); },
    CanaryEar() { statuses.add('CanaryEar'); banner?.('CanaryEar listening'); },
    LanternSweep() {
      const light = new THREE.SpotLight(0x88e0ff, 4, 28, Math.PI / 5, 0.4, 1);
      light.position.copy(player.pos).add(new THREE.Vector3(0, 2.2, 0));
      const tgt = player.pos.clone().addScaledVector(facing(), 16);
      light.target.position.copy(tgt); scene.add(light); scene.add(light.target);
      banner?.('LanternSweep'); audio?.('sfx_kettle_lantern');
      setTimeout(() => { scene.remove(light); scene.remove(light.target); light.dispose?.(); }, 3000);
    },
    GasVent() {
      const cloud = new THREE.Mesh(
        new THREE.SphereGeometry(3.2, 16, 12),
        new THREE.MeshBasicMaterial({ color: 0x6a9a4a, transparent: true, opacity: 0.35 }),
      );
      cloud.position.copy(player.pos).addScaledVector(facing(), 4); cloud.position.y = 1.2;
      scene.add(cloud); banner?.('GasVent'); audio?.('sfx_kettle_gas'); api.applyStatus('slow', 4000);
      const t0 = performance.now();
      (function fade() {
        const t = (performance.now() - t0) / 4000;
        if (t >= 1) { scene.remove(cloud); cloud.geometry.dispose(); cloud.material.dispose(); return; }
        cloud.material.opacity = 0.35 * (1 - t); requestAnimationFrame(fade);
      })();
    },
    ConciergeSmile() { statuses.add('ConciergeSmile'); banner?.('ConciergeSmile terror+'); },
    Whiteout() {
      if (scene.fog) scene.fog.density = fogBase * 4.5;
      flash('#e8f2ff', 600); banner?.('Whiteout'); audio?.('sfx_whitepeak_whiteout');
      setTimeout(() => { if (scene.fog) scene.fog.density = fogBase; }, 6000);
    },
    CheckIn() {
      const bell = new THREE.Mesh(
        new THREE.CylinderGeometry(0.35, 0.5, 0.7, 12),
        new THREE.MeshStandardMaterial({ color: 0xf4f7fb, emissive: 0x88aacc, emissiveIntensity: 0.6 }),
      );
      bell.position.copy(player.pos).addScaledVector(facing(), 3); bell.position.y = 0.35;
      scene.add(bell); banner?.('CheckIn snare'); audio?.('sfx_whitepeak_checkin'); api.applyStatus('rooted', 1500);
      setTimeout(() => { scene.remove(bell); bell.geometry.dispose(); bell.material.dispose(); }, 8000);
    },
  };
  return api;
}
