// Natural Disaster Survival: every Birg Bucks number and timing lives here so it
// can be reviewed/approved in one place. Context: daily bonus 100 BB, cosmetics
// 30-600 BB, Giant Rainbow Obby gears 75/120/250 BB.
export const GAME_ID = 'natural-disaster-survival';

/** BB paid to the player for surviving one round. */
export const SURVIVE_REWARD_BB = 5;
/** At most this many BB from survival per play session (10 rounds). The server also caps game earnings per day. */
export const SESSION_EARN_CAP_BB = 50;
/** Earn source/reason: economy.earn(pay, reason, { source: 'disaster_survival' }). */
export const EARN_SOURCE = 'disaster_survival';   // Publisher migration: capped at 9 BB per call, 100 BB per day
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
/** Cosmetics-approved guards for paid items. */
export const APPLES_PER_ROUND = 3;         // at most 3 Apples per round...
export const APPLE_COOLDOWN_S = 4;         // ...and a few seconds between them
export const BIGGER_STORMS_PER_ROUND = 1;  // one queued Bigger Storm per round (solo; see report re: server-wide)
/** Hard ceiling for one round's survival payout. Must stay below 10 BB so that 10 BB Apples can never pay for themselves. */
export const MAX_ROUND_PAYOUT_BB = 9;
if (SURVIVE_REWARD_BB > MAX_ROUND_PAYOUT_BB || MAX_ROUND_PAYOUT_BB >= APPLE_PRICE_BB) throw new Error('NDS config: survival payout must stay under the Apple price');
export function survivalPayout(paidThisSession) {
  return Math.max(0, Math.min(SURVIVE_REWARD_BB, MAX_ROUND_PAYOUT_BB, SESSION_EARN_CAP_BB - paidThisSession));
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
  // Sound Designer starter kit (approved by Colin): generic UI / item / hurt sounds, Ogg only (procedural fallback)
  kit_hurt: { files: ['kit/hurt.ogg'], gain: 0.8 }, kit_death_fall: { files: ['kit/death_fall.ogg'], gain: 0.6 },
  kit_powerup: { files: ['kit/powerup.ogg'], gain: 0.5 }, kit_win_fanfare: { files: ['kit/win_fanfare.ogg'], gain: 0.6 }, kit_coin_collect: { files: ['kit/coin_collect.ogg'], gain: 0.45 },
  // Hunt menu (Sound Designer): 24 s seamless ambience loop (fade in 1 s / out 0.5 s) + 0.95 s collect jingle
  hunt: { files: ['hunt_menu_ambience_loop.ogg', 'hunt_menu_ambience_loop.mp3'], loopSeconds: 24, fadeIn: 1, fadeOut: 0.5 },
  collected: { files: ['item_collected.ogg', 'item_collected.mp3'], gain: 0.8 },
  // Sound Designer batch 3: disaster beds (keys = disaster ids) + one-shots
  volcano: { files: ['volcano_lava_loop.ogg', 'volcano_lava_loop.mp3'], loopSeconds: 11, fadeIn: 1.8, fadeOut: 2 },
  volcano_eruption: { files: ['volcano_eruption.ogg', 'volcano_eruption.mp3'], gain: 0.95 },
  gritstorm: { files: ['sandstorm_loop.ogg', 'sandstorm_loop.mp3'], loopSeconds: 11, fadeIn: 2.5, fadeOut: 3 },
  acidrain: { files: ['acid_rain_loop.ogg', 'acid_rain_loop.mp3'], loopSeconds: 11, fadeIn: 2, fadeOut: 2 },
  acid_sizzle: { files: ['acid_sizzle.ogg', 'acid_sizzle.mp3'], gain: 0.85 },
  lightning: { files: ['storm_ambience_loop.ogg', 'storm_ambience_loop.mp3'], loopSeconds: 12, fadeIn: 2, fadeOut: 2 },
  lightning_strike_1: { files: ['lightning_strike_1.ogg', 'lightning_strike_1.mp3'], gain: 0.95 }, lightning_strike_2: { files: ['lightning_strike_2.ogg', 'lightning_strike_2.mp3'], gain: 0.95 }, lightning_strike_3: { files: ['lightning_strike_3.ogg', 'lightning_strike_3.mp3'], gain: 0.95 },
  sinkhole: { files: ['sinkhole_rumble_loop.ogg', 'sinkhole_rumble_loop.mp3'], loopSeconds: 10, fadeIn: 2, fadeOut: 2 },
  sinkhole_collapse: { files: ['sinkhole_collapse.ogg', 'sinkhole_collapse.mp3'], gain: 0.95 },
};
/** Popup kind -> sfx name (swap to the Sound Designer's popup sounds here). survived/eliminated use the win/lose stingers. */
export const POPUP_SFX = { round: 'tick', warning: 'siren', survived: null, eliminated: null, reward: 'coin', bought: 'buy', info: 'open' };
/** Disaster beds that count for the 'two disasters overlap -> drop to ~0.45' rule. */
export const DISASTER_BEDS = ['tornado', 'tsunami', 'volcano', 'gritstorm', 'acidrain', 'lightning', 'sinkhole'];
/** Our sfx names -> kit sample (used when loaded, else the procedural sound plays). */
export const KIT_SFX = { deny: 'ui_error', click: 'ui_click', open: 'ui_popup_open', close: 'ui_popup_close', hurt: 'kit_hurt', fall: 'kit_death_fall',
  buy: 'kit_powerup', eat: 'kit_powerup', balloon: 'kit_powerup', coin: 'kit_coin_collect', tick: 'ui_click', survive: 'kit_win_fanfare' };
const _unused = {};
export const CREDITS = ['Music: Iceberg original soundtrack', 'Sound effects: Iceberg original sound design'];
void _unused;
