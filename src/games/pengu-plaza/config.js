// Pengu Plaza tuning + save. Low stakes: no fail states, only cozy one-time "postcard" BB thanks.
export const GAME_ID = 'pengu-plaza';
export const REWARD_SOURCE = 'game:pengu-plaza';
export const PLAZA_R = 34;                 // walkable radius
export const RINK = { x: 0, z: -16, rx: 11, rz: 7 };   // ellipse skate zone
export const COCOA = { x: 14, z: 6 };
export const BELL = { x: 0, z: 2 };
export const SPAWN = { x: 0, z: 22, facing: Math.PI };
export const SEATS = [
  { x: -9, z: 8, rot: Math.PI / 2 }, { x: -9, z: 11, rot: Math.PI / 2 },
  { x: 9, z: 12, rot: -Math.PI / 2 }, { x: -14, z: -4, rot: Math.PI / 2 },
  { x: 18, z: -6, rot: -Math.PI / 2 }, { x: -3, z: 6.2, rot: Math.PI }, { x: 3, z: 6.2, rot: Math.PI },
];
export const PHOTO_SPOTS = [
  { id: 'fountain', name: 'Frost Fountain', x: 0, z: 11, look: [0, 3, 2] },
  { id: 'arch', name: 'Aurora Arch', x: 0, z: 30, look: [0, 5, 33] },
  { id: 'iceberg', name: 'Giant Ice Pengu', x: -22, z: -18, look: [-25, 6, -22] },
  { id: 'rink', name: 'Rinkside', x: 12, z: -22, look: [0, 1, -16] },
  { id: 'lantern', name: 'Lantern Lane', x: 22, z: 16, look: [26, 3, 20] },
];
export const EMOTES = [
  { id: 'wave', icon: '👋', label: 'Wave', key: 'Digit1', sfx: 'sfx_emote_wave', dur: 1.4 },
  { id: 'dance', icon: '💃', label: 'Dance', key: 'Digit2', sfx: 'sfx_emote_dance', dur: 3.0 },
  { id: 'cheer', icon: '🎉', label: 'Cheer', key: 'Digit3', sfx: 'sfx_emote_cheer', dur: 1.6 },
  { id: 'honk', icon: '🐧', label: 'Honk', key: 'Digit4', sfx: 'sfx_penguin_honk', dur: 0.9 },
];
export const NPC_COUNT = 9;
export const POSTCARD_BB = 15;  // one-time: snapped all 5 photo spots
export const PHYS = { skateSpeed: 1.7, skateGlide: 0.985 };
export function normalizeSave(s) {
  s = s && typeof s === 'object' ? s : {};
  return { photos: Array.isArray(s.photos) ? [...new Set(s.photos)] : [], cocoa: s.cocoa | 0, emotes: s.emotes | 0, skateTime: +s.skateTime || 0, postcard: !!s.postcard, visits: s.visits | 0 };
}
