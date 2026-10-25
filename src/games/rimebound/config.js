// Rimebound — GM2 kits + lobby (match loop owned by GM1).
export const GAME_ID = 'rimebound';
export const SET_IDS = ['rimebound-lobby', 'rimebound-shipyard', 'rimebound-mines', 'rimebound-resort'];
export const SURVIVOR_KITS = ['survivor-pip', 'survivor-nell', 'survivor-juno'];
export const KILLER_KITS = ['killer-hullwarden', 'killer-kettle', 'killer-whitepeak'];
export const ALL_KITS = [...SURVIVOR_KITS, ...KILLER_KITS];
export const EMOTES = [
  { id: 'emote_wave', musical: false, cue: 'sfx_emote_wave' },
  { id: 'emote_shiver', musical: false, cue: 'sfx_emote_shiver' },
  { id: 'emote_campfire_jig', musical: true, cue: 'mus_emote_campfire_jig' },
  { id: 'emote_icebox_dance', musical: true, cue: 'mus_emote_icebox' },
  { id: 'emote_concierge_bow', musical: true, cue: 'mus_emote_concierge' },
];
export const DEFAULT_SAVE = { rounds: 0, picks: {}, milestones: [] };
