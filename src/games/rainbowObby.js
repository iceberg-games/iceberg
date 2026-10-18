// Game: Rainbow Obby — 25 colorful stages over glowing lava, with checkpoints
// and a "skip stage" option that costs Birg Bucks.
import * as THREE from 'three';
import { Collision } from '../engine/collision.js';
import { bus } from '../core/events.js';

const STAGES = 25, SKIP_COST = 25, LEN = 14, TOP = 4;

export default {
  id: 'rainbow-obby', name: 'Rainbow Obby', tagline: '25 stages over glowing lava',
  description: 'Jump across rainbow platforms. Checkpoints save your progress. Stuck? Skip a stage for 25 BB.',
  thumbnail: 'obby', music: 'winter',

  async create(ctx) {
    const { economy, engine } = ctx;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#9fd3f5'); scene.fog = new THREE.Fog('#c6e6fa', 40, 160);
    scene.add(new THREE.HemisphereLight('#ffffff', '#ff7a3d', 1.0));
    const sun = new THREE.DirectionalLight('#ffffff', 1.4); sun.position.set(20, 40, 10); scene.add(sun);
    const collision = new Collision({ floorY: 0, bounds: { type: 'box', minX: -12, maxX: 12, minZ: -8, maxZ: STAGES * LEN + 12 } });

    // glowing lava floor
    const lavaMat = new THREE.MeshStandardMaterial({ color: '#ff4a1c', emissive: '#ff3300', emissiveIntensity: 1.2, roughness: 0.6 });
    const lava = new THREE.Mesh(new THREE.PlaneGeometry(30, STAGES * LEN + 40), lavaMat);
    lava.rotation.x = -Math.PI / 2; lava.position.set(0, 0.01, STAGES * LEN / 2); scene.add(lava);

    const box = (w, h, d, color, x, top, z, glow = 0.15) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: glow, roughness: 0.4 }));
      m.position.set(x, top - h / 2, z); scene.add(m);
      collision.addBox(x - w / 2, top - h, z - d / 2, x + w / 2, top, z + d / 2);
      return m;
    };
    const checkpoints = [];
    for (let i = 0; i <= STAGES; i++) {
      const z = i * LEN, color = new THREE.Color().setHSL((i / STAGES) * 0.85, 0.85, 0.55);
      const pad = box(5, 1, 4, i === STAGES ? '#ffd34d' : '#ffffff', 0, TOP, z, i === STAGES ? 0.6 : 0.05);
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(5.02, 0.2, 4.02), new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.5 }));
      stripe.position.set(0, TOP - 0.1, z); scene.add(stripe);
      checkpoints.push(new THREE.Vector3(0, TOP, z));
      if (i === STAGES) break;
      const size = Math.max(1.3, 2.4 - i * 0.04), n = 3;
      for (let k = 1; k <= n; k++) {
        const pz = z + 2 + k * ((LEN - 4) / (n + 1)) + 0.5;
        const px = ((i + k) % 3 - 1) * (1.2 + (i % 4) * 0.3);
        const top = TOP + (i % 3 === 2 && k === 2 ? 1 : 0);
        box(size, 0.6, size, new THREE.Color().setHSL(((i + k / n) / STAGES) * 0.85, 0.9, 0.55), px, top, pz, 0.3);
      }
    }
    const trophy = new THREE.Mesh(new THREE.OctahedronGeometry(0.8), new THREE.MeshStandardMaterial({ color: '#ffd34d', emissive: '#ffb000', emissiveIntensity: 0.8, metalness: 0.6 }));
    trophy.position.set(0, TOP + 2, STAGES * LEN); scene.add(trophy);

    let stage = 0, won = false;
    const label = document.createElement('div'); label.className = 'obby-label';
    const skip = document.createElement('button'); skip.className = 'btn obby-skip'; skip.id = 'skip-stage';
    skip.textContent = `⏭ Skip stage (${SKIP_COST} BB)`;
    const app = document.getElementById('app'); app.append(label, skip);
    const setStage = (s, msg) => { stage = s; label.textContent = `Stage ${stage} / ${STAGES}`; if (msg) bus.emit('toast', { text: msg, icon: '🚩' }); };
    const respawn = () => { engine.player.teleport(checkpoints[stage].clone(), 0); bus.emit('toast', { text: 'Oof! Back to the checkpoint', icon: '🔥' }); };
    skip.onclick = () => {
      if (stage >= STAGES) return;
      const r = economy.spend ? economy.spend(SKIP_COST) : false;
      if (!r) { bus.emit('toast', { text: `You need ${SKIP_COST} Birg Bucks to skip`, icon: '😕' }); return; }
      setStage(stage + 1, `Skipped to stage ${stage + 1}`); engine.player.teleport(checkpoints[stage].clone(), 0);
    };
    setStage(0);

    return {
      scene, collision, music: 'winter', spawn: checkpoints[0].clone(), spawnFacing: 0,
      onFall: respawn,
      update(dt, t, player) {
        lavaMat.emissiveIntensity = 1.0 + Math.sin(t * 3) * 0.3;
        trophy.rotation.y += dt * 2;
        if (player.pos.y <= 0.05) respawn();
        // reached a new checkpoint?
        for (let i = stage + 1; i <= STAGES; i++) {
          const c = checkpoints[i];
          if (Math.abs(player.pos.z - c.z) < 2.2 && Math.abs(player.pos.x) < 2.7 && Math.abs(player.pos.y - TOP) < 0.2) {
            setStage(i, i === STAGES ? null : `Checkpoint! Stage ${i}`);
            if (i === STAGES && !won) { won = true; economy.earn(100, 'Rainbow Obby complete'); bus.emit('toast', { text: 'You beat the Rainbow Obby! +100 BB', icon: '🏆' }); }
          }
        }
      },
      dispose() { label.remove(); skip.remove(); },
    };
  },
};
