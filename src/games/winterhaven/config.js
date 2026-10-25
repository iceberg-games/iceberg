// Winterhaven event game: ids, Birg Bucks numbers and audio in one place.
export const GAME_ID = 'winterhaven';
export const EVENT_ID = 'winterhaven';
/** economy.earn(n, reason, { source: EARN_SOURCE }) — Publisher sets the server cap for this source. */
export const EARN_SOURCE = 'winterhaven';
/** One-time BB for the first turn-in of each quest (16 quests -> 160 BB total, once per device/account). */
export const QUEST_TURN_IN_BB = 10;
/** One-time BB for the first Frostgate Run finish (on top of the quest reward). */
export const RUN_FIRST_FINISH_BB = 20;

/** Interaction radii (studs). */
export const TALK_RADIUS = 5;
export const PICKUP_RADIUS = 2.6;
export const PORTAL_RADIUS = 5;

/** Frostgate Run (ice gate race on Mirrorfrost Lake). */
export const RUN_TIME_S = 75;
export const RUN_GATE_RADIUS = 3.6;
export const RUN_SPEED_MULT = 1.55;

export const AUDIO_DIR = 'audio/winterhaven/';
// Sound Designer's in-game loop: 40.00 s, 16 bars @ 96 BPM, sample-exact seamless (Ogg first, MP3 fallback).
export const MUSIC = { files: ['winterhaven_ingame_loop.ogg', 'winterhaven_ingame_loop.mp3'], loopSeconds: 40, gain: 0.7, fadeIn: 2 };
/** Sound Designer 2 ambience beds (manifest gains), crossfaded by area. Separate files next to the music. */
export const AMBIENCE = { village: { file: 'ambience_village_loop.ogg', gain: 0.45 * 0.6 }, market: { file: 'ambience_market_loop.ogg', gain: 0.4 * 0.7 }, hearth: { file: 'ambience_hearth_loop.ogg', gain: 0.4 * 0.7 } };
/** Manifest gains for the one-shots (npc_talk_* 0.8, plus_click/hover 0.8, the rest 1.0). */
export const SFX_GAIN = { npc_talk_1: 0.8, npc_talk_2: 0.8, npc_talk_3: 0.8, npc_talk_4: 0.8, plus_click_1: 0.8, plus_click_2: 0.8, plus_click_3: 0.8, plus_hover: 0.8 };
export const CREDITS = ['Map: Iceberg Set Builder (original procedural set)', 'Music: "Winterhaven" in-game loop, Iceberg Sound Designer (original)', 'Winterhaven SFX + ambience: Iceberg Sound Designer 2 (original)', 'UI sounds: Iceberg Frost Glass set'];
