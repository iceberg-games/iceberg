// Natural Disasters event: adds one quest to an existing game WITHOUT editing that game's module.
// withEventQuest(def, quest, hook) returns a copy of the game definition whose create() wraps the
// original game instance: it chains update()/dispose() and shows the quest HUD. Remove the wrapper
// in registry.js to end the event.
import * as THREE from 'three';
import { createQuestTracker } from './questAdapter.js';
import { QuestHud } from './questHud.js';
import { bus } from '../../core/events.js';
import { QUESTS as EVENT_QUESTS } from './quests.js';
import { QUESTS as OBBY_QUESTS } from '../giantObby/quests.js';

export function withEventQuest(def, quest, hook) {
  const out = Object.defineProperties({}, Object.getOwnPropertyDescriptors(def));
  out.create = async function (ctx, params) {
    const game = await def.create.call(def, ctx, params);
    const hud = new QuestHud(quest);
    const tracker = createQuestTracker(quest, {
      onChange: (s) => hud.update(s),
      onResult: (r) => { if (r.granted) bus.emit('toast', { text: `Quest complete! ${quest.rewardName} unlocked`, icon: '🎁' }); },
    });
    const h = hook(game, ctx, tracker) || {};
    const up = game.update, disp = game.dispose;
    game.update = function (dt, t, pl) { up?.call(this, dt, t, pl); h.update?.(dt, t, pl); };
    game.dispose = function () { h.dispose?.(); tracker.dispose(); hud.dispose(); disp?.call(this); };
    game.eventQuest = { tracker, quest };
    return game;
  };
  return out;
}

const q = (id) => [...EVENT_QUESTS, ...OBBY_QUESTS].find(x => x.id === id);

/** Frost Fields: place blocks (counts real placements from the building grid). */
export const frostQuest = [q('nd_quest_frost_fields'), (game, ctx, tr) => {
  let last = game.building?.count ?? 0;
  return { update() { const n = game.building?.count ?? 0; if (n > last && game.buildMode) tr.add(n - last); last = n; } };
}];

/** Giant Rainbow Obby: new stages reached on foot (skips and teleports don't count). */
export const obbyQuest = [q('nd_quest_giant_obby'), (game, ctx, tr) => {
  const o = game.obby; if (!o) return {};
  let last = o.stage, skips = o.save.skips;
  return { update() {
    const s = o.stage, k = o.save.skips;
    if (k !== skips) { skips = k; last = s; return; }
    if (s > last && s - last <= 3) tr.add(s - last); // pads reached on foot (a jump can clear a pad)
    last = s;
  } };
}];

/** BIRG HQ: five glowing frozen meteor shards placed around the cabin; touch to collect. */
export const HQ_SHARDS = [[1.5, 0, -3.2], [-3.4, 0, 3.4], [6.5, 0, 3.8], [-5.4, 4.3, -1.6], [4.6, 4.3, 3.2]];
export const hqQuest = [q('nd_quest_birg_hq'), (game, ctx, tr) => {
  const key = 'iceberg:v1:ndquest:hqShards';
  let got = []; try { got = JSON.parse(localStorage.getItem(key)) || []; } catch { /* */ }
  if (tr.state.claimed || tr.state.done) return {};
  const geo = new THREE.OctahedronGeometry(0.28, 0);
  const mat = new THREE.MeshStandardMaterial({ color: '#9fe8ff', emissive: '#3fb8ff', emissiveIntensity: 1.6, roughness: 0.2, metalness: 0.3 });
  const shards = [];
  HQ_SHARDS.forEach(([x, y, z], i) => {
    if (got.includes(i)) return;
    // keep clear of furniture: lift until the spot is free
    let yy = y + 0.9; for (let k = 0; k < 12 && game.collision.overlaps(x - 0.3, yy - 0.3, z - 0.3, x + 0.3, yy + 0.3, z + 0.3); k++) yy += 0.25;
    const m = new THREE.Mesh(geo, mat); m.position.set(x, yy, z); m.scale.set(1, 1.6, 1);
    const glow = new THREE.PointLight('#5fc8ff', 3, 3.5, 2); m.add(glow);
    game.scene.add(m); shards.push({ i, m });
  });
  return {
    update(dt, t, pl) {
      for (const s of shards) {
        if (!s.m.parent) continue;
        s.m.rotation.y = t * 2 + s.i; s.m.position.y += Math.sin(t * 3 + s.i) * 0.002;
        const c = s.m.position;
        if (Math.abs(pl.pos.x - c.x) < 0.9 && Math.abs(pl.pos.z - c.z) < 0.9 && c.y > pl.pos.y - 0.3 && c.y < pl.pos.y + 3) {
          game.scene.remove(s.m); got.push(s.i);
          try { localStorage.setItem(key, JSON.stringify(got)); } catch { /* */ }
          tr.add(1);
          bus.emit('toast', { text: `Meteor shard ${tr.state.progress}/5 found!`, icon: '☄️' });
        }
      }
    },
    dispose() { for (const s of shards) game.scene.remove(s.m); geo.dispose(); mat.dispose(); },
  };
}];
