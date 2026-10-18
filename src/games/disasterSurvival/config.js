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
  kit_ui_click: { files: ['kit/ui_click.ogg'], gain: 0.5 }, kit_ui_open: { files: ['kit/ui_open.ogg'], gain: 0.45 },
  kit_ui_close: { files: ['kit/ui_close.ogg'], gain: 0.45 }, kit_ui_deny: { files: ['kit/ui_deny.ogg'], gain: 0.5 },
  kit_hurt: { files: ['kit/hurt.ogg'], gain: 0.8 }, kit_death_fall: { files: ['kit/death_fall.ogg'], gain: 0.6 },
  kit_powerup: { files: ['kit/powerup.ogg'], gain: 0.5 }, kit_coin_collect: { files: ['kit/coin_collect.ogg'], gain: 0.45 },
  // Hunt menu (Sound Designer): 24 s seamless ambience loop (fade in 1 s / out 0.5 s) + 0.95 s collect jingle
  hunt: { files: ['hunt_menu_ambience_loop.ogg', 'hunt_menu_ambience_loop.mp3'], loopSeconds: 24, fadeIn: 1, fadeOut: 0.5 },
  collected: { files: ['item_collected.ogg', 'item_collected.mp3'], gain: 0.8 },
};
/** Our sfx names -> kit sample (used when loaded, else the procedural sound plays). */
export const KIT_SFX = { deny: 'kit_ui_deny', click: 'kit_ui_click', open: 'kit_ui_open', close: 'kit_ui_close', hurt: 'kit_hurt', fall: 'kit_death_fall',
  buy: 'kit_powerup', eat: 'kit_powerup', balloon: 'kit_powerup', coin: 'kit_coin_collect' };
const _unused = {};
export const CREDITS = ['Music: Iceberg original soundtrack', 'Sound effects: Iceberg original sound design'];
void _unused;
