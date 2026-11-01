// Pengu Plaza tuning + save. Low stakes: no fail states, only cozy one-time "postcard" BB thanks.
export const GAME_ID = 'pengu-plaza';
export const REWARD_SOURCE = 'game:pengu-plaza';
// Plaza anchors come from Iceberg Set Builder's Pengu Plaza bones (./set, copied from blockworld-sets @ 2c06cbf).
// The set layout is the single source of truth for coordinates; if you move one, edit set/layout.js and ping Set Builder to resync.
export { PLAZA_R, RINK, COCOA, BELL, SPAWN, SEATS, PHOTO_SPOTS, PROPS, NPC_POINTS, AREAS, ANCHORS } from './set/layout.js';
export const EMOTES = [
  { id: 'wave', icon: '👋', label: 'Wave', key: 'Digit1', sfx: 'sfx_emote_wave', dur: 1.4 },
  { id: 'dance', icon: '💃', label: 'Dance', key: 'Digit2', sfx: 'sfx_emote_dance', dur: 3.0 },
  { id: 'cheer', icon: '🎉', label: 'Cheer', key: 'Digit3', sfx: 'sfx_emote_cheer', dur: 1.6 },
  { id: 'honk', icon: '🐧', label: 'Honk', key: 'Digit4', sfx: 'sfx_penguin_honk', dur: 0.9 },
];
import { NPC_POINTS as _NPC } from './set/layout.js';
export const NPC_COUNT = _NPC.length;   // 9 stand points from the set bones
export const POSTCARD_BB = 15;  // one-time: snapped all 5 photo spots
export const PHYS = { skateSpeed: 1.7, skateGlide: 0.985 };
export function normalizeSave(s) {
  s = s && typeof s === 'object' ? s : {};
  return { photos: Array.isArray(s.photos) ? [...new Set(s.photos)] : [], cocoa: s.cocoa | 0, emotes: s.emotes | 0, skateTime: +s.skateTime || 0, postcard: !!s.postcard, visits: s.visits | 0 };
}
