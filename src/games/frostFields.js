// Game: Frost Fields — the open icy sandbox (build, collect Birg Bucks, place models).
import * as THREE from 'three';
import { World, WORLD_RADIUS, BUILD_HEIGHT } from '../game/world.js';
import { Collision } from '../engine/collision.js';
import { Building } from '../game/building.js';
import { CoinField } from '../game/coins.js';
import { ModelPlacer } from '../game/models.js';
import { backend, modelPrefs } from '../backend/LocalBackend.js';
import { REWARDS } from '../core/economy.js';
import { bus } from '../core/events.js';

export default {
  id: 'frost-fields',
  name: 'Frost Fields',
  tagline: 'Build on a snowy glacier island',
  description: 'Open icy sandbox. Build with snow & ice blocks, collect Birg Bucks, place your own 3D models.',
  thumbnail: 'frost',
  music: 'winter',
  features: { build: true, models: true },

  async create(ctx) {
    const { economy, models, engine } = ctx;
    const scene = new THREE.Scene();
    const world = new World(scene);
    const collision = new Collision({ floorY: 0, bounds: { type: 'circle', r: WORLD_RADIUS - 1 } });
    world.colliders.forEach(c => collision.addCircle(c.x, c.z, c.r));

    const playerOverlaps = (x, y, z) => {
      const p = engine.player.pos;
      return x + 1 > p.x - 0.42 && x < p.x + 0.42 && z + 1 > p.z - 0.42 && z < p.z + 0.42 && y + 1 > p.y && y < p.y + 2.6;
    };
    const building = new Building(scene, {
      blocks: backend.loadBuild(),
      groundMeshes: [world.ground],
      canPlace: (x, y, z) => y >= 0 && y < BUILD_HEIGHT && Math.hypot(x + 0.5, z + 0.5) < WORLD_RADIUS - 1 && !world.blockedAt(x + 0.5, z + 0.5, 0.3) && !playerOverlaps(x, y, z),
      onChange: () => backend.saveBuild(building.serialize()),
    });
    collision.voxels = building;

    const placer = new ModelPlacer(scene, models, collision, {
      placements: modelPrefs.loadPlacements(),
      onChange: () => modelPrefs.savePlacements(placer.serialize()),
    });

    const randomPos = () => {
      for (let i = 0; i < 50; i++) {
        const a = Math.random() * Math.PI * 2, d = 4 + Math.random() * 48;
        const x = Math.cos(a) * d, z = Math.sin(a) * d;
        if (!world.blockedAt(x, z, 1) && !building.has(Math.floor(x), 0, Math.floor(z))) return [x, 1.1, z];
      }
      return [0, 1.1, 5];
    };
    const coins = new CoinField(scene, {
      count: 18, randomPos, respawn: 12,
      onCollect: () => economy.earn(REWARDS.coinPickup, 'Pickup'),
    });

    let buildMode = false;
    const game = {
      scene, collision, building, placer, coins, world,
      spawn: new THREE.Vector3(0, 0, 8), spawnFacing: Math.PI,
      music: 'winter', supportsBuild: true, supportsModels: true,
      get buildMode() { return buildMode; },
      setBuildMode(on) { buildMode = on; building.setActive(on); world.grid.visible = on; },
      beginPlaceModel(id) { placer.pending = id; bus.emit('toast', { text: 'Click the ground or a block to place your model', icon: '📦' }); },
      onHover(ray) { building.hover(ray, engine.input.down('ShiftLeft') || engine.input.down('ShiftRight')); },
      onClick(e) {
        if (placer.pending && e.button === 0) {
          const h = building.pick(e.ray);
          if (h) { placer.place(placer.pending, h.point); bus.emit('toast', { text: 'Model placed', icon: '📦' }); }
          placer.pending = null; return;
        }
        if (!buildMode) return;
        if (e.button === 2 || e.shift) { // remove a placed model first if one is under the cursor
          const mh = e.ray.intersectObjects(placer.meshes(), false)[0];
          const bh = building.pick(e.ray);
          if (mh && (!bh || mh.distance <= bh.point.distanceTo(e.ray.ray.origin) + 0.01)) { placer.removeItem(mh.object.userData.modelItem); return; }
        }
        const r = building.click(e);
        if (r === 'placed') economy.rewardBlockPlaced();
      },
      update(dt, t, player) { world.update(dt, t, player.pos); coins.update(dt, t, player.pos); },
      dispose() { building.dispose(); placer.dispose(); coins.dispose(); },
    };
    return game;
  },
};
