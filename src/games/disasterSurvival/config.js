// Natural Disaster Survival: every Birg Bucks number and timing lives here so it
// can be reviewed/approved in one place. Context: daily bonus 100 BB, cosmetics
// 30-600 BB, Giant Rainbow Obby gears 75/120/250 BB.
export const GAME_ID = 'natural-disaster-survival';

/** BB paid to the player for surviving one round. */
export const SURVIVE_REWARD_BB = 5;
/** At most this many BB from survival per play session (10 rounds). The server also caps game earnings per day. */
export const SESSION_EARN_CAP_BB = 50;
/** Earn source/reason. Proposed server cap row: source 'disaster_survival', 5 per call, 100 per day. */
export const EARN_SOURCE = 'disaster_survival';
export const EARN_REASON = 'Natural Disaster Survival round survived';

/** Permanent gears (economy.buyGear / ownsGear, scoped to this game only). Read by scripts/sync-catalog.mjs. */
export const GEAR_PRICES_BB = { greenBalloon: 150 };
/** Single-use items (economy.buyConsumable(GAME_ID, id) when available). */
export const APPLE_PRICE_BB = 10;
export const BIGGER_STORM_PRICE_BB = 25;
export const CONSUMABLES = {
  apple: { price: APPLE_PRICE_BB, consumable: true },
  biggerStorm: { price: BIGGER_STORM_PRICE_BB, consumable: true },
};
export const CONSUMABLE_PRICES_BB = { apple: APPLE_PRICE_BB, biggerStorm: BIGGER_STORM_PRICE_BB };

export const APPLE_HEAL = 50;
export const MAX_HP = 100;

/** Round timings (seconds). */
export const T_INTERMISSION = 12;
export const T_WARNING = 5;
export const T_DISASTER = 32;
export const T_RESULTS = 4;

/** Intensity multiplier for a round boosted with Bigger Storm. Reward is NOT boosted (no farming). */
export const BIG_STORM_MULT = 1.6;

export const DEFAULT_SAVE = { rounds: 0, survived: 0, best: 0 };

/** Pure: how much to pay for a survival given what was already paid this session. */
export function survivalPayout(paidThisSession) {
  return Math.max(0, Math.min(SURVIVE_REWARD_BB, SESSION_EARN_CAP_BB - paidThisSession));
}

/** Audio assets (all original, Colin-owned). Served as separate files from site/public/audio/nds/
 *  (copied to the site root by build-site.mjs) and loaded lazily with fetch + decodeAudioData, so the
 *  single-file build stays small. Ogg Vorbis first; .m4a/.mp3 only where Ogg can't decode (older iOS Safari).
 *  If nothing loads (e.g. the single-file dist opened via file://) the original procedural audio plays. */
export const AUDIO_DIR = 'audio/nds/';
export const AUDIO_FILES = {
  // Social Media bot's disaster track: 36 bars @ 140 BPM, D minor, loops at exactly 61.714 s
  music: { files: ['disaster_loop.ogg', 'disaster_loop.m4a'], loopSeconds: 36 * 4 * 60 / 140 },
  // Sound Designer bot's SFX kit (12 s seamless loops + stingers)
  tornado: { files: ['tornado_wind_loop.ogg', 'tornado_wind_loop.mp3'], loopSeconds: 12 },
  tsunami: { files: ['tsunami_water_rush_loop.ogg', 'tsunami_water_rush_loop.mp3'], loopSeconds: 12 },
  win: { files: ['win_survived.ogg', 'win_survived.mp3'] },
  lose: { files: ['lose_eliminated.ogg', 'lose_eliminated.mp3'] },
};
export const CREDITS = ['Music: Iceberg original soundtrack', 'Sound effects: Iceberg original sound design'];
