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
export const POSTCARD_BB = 15;  // one-time: snapped all 5 plaza photo spots (kept from the QoL build)
export const PHYS = { skateSpeed: 1.7, skateGlide: 0.985 };
// Save (server per-game blob <= 16 KB, so thumbnails live in localStorage only — see album.js).
// album: { [targetId]: [bestScore, stars, firstSeenUnix, bonus(0|1)] }
export function normalizeSave(s) {
  s = s && typeof s === 'object' ? s : {};
  const arr = (v) => Array.isArray(v) ? [...new Set(v.filter(x => typeof x === 'string'))] : [];
  const album = {}; if (s.album && typeof s.album === 'object') for (const [k, v] of Object.entries(s.album)) if (Array.isArray(v) && v.length >= 2) album[k] = [Math.max(0, Math.min(100, v[0] | 0)), Math.max(1, Math.min(3, v[1] | 0)), v[2] | 0, v[3] ? 1 : 0];
  const photos = arr(s.photos);
  for (const id of photos) if (!album[id]) album[id] = [60, 2, 0, 0];   // QoL-build landmark snaps carry over as 2-star entries
  return { photos, album, areas: arr(s.areas), rewards: arr(s.rewards), filters: arr(s.filters), frames: arr(s.frames), titles: arr(s.titles),
    filter: typeof s.filter === 'string' ? s.filter : 'none', frame: typeof s.frame === 'string' ? s.frame : 'polaroid', title: typeof s.title === 'string' ? s.title : 'Tourist',
    shots: s.shots | 0, cocoa: s.cocoa | 0, emotes: s.emotes | 0, skateTime: +s.skateTime || 0, postcard: !!s.postcard, visits: s.visits | 0, lifts: s.lifts | 0 };
}
