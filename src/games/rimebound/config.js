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
export const MATCH = { ROUND_SEC: 240, CORE_REPAIR_SEC: 8, DOWN_TIMER: 20, EXIT_HOLD: 2, TERROR_R: 18, CHASE_R: 10, HIT_DAMAGE: 34, MAX_HP: 100, REVIVE_SEC: 4, SET_TIMEOUT_MS: 6000 };
