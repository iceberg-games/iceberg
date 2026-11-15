// Frostlings — data: types + chart, moves, species, areas, tamers, quests, shop, milestones, save shape.
export const GAME_ID = 'frostlings';
export const LEVEL_CAP = 20, PARTY_MAX = 3, MOVES_MAX = 4;
export const DAY_SECS = 480;           // full day/night cycle (synced via mp.now())
// phase of day 0..1: day < .55, dusk .55-.62, night .62-1 (aurora during .74-.92)
export const isNight = (ph) => ph >= 0.6;
export const isAurora = (ph) => ph >= 0.74 && ph < 0.92;

export const TYPES = {
  plain:   { name: 'Plain',   color: '#b9c3d1', dark: '#6b7686', icon: '●' },
  snow:    { name: 'Snow',    color: '#8fd8ff', dark: '#2f86c4', icon: '❄' },
  crystal: { name: 'Crystal', color: '#c79bff', dark: '#7a3fd0', icon: '◆' },
  tide:    { name: 'Tide',    color: '#4fa3ff', dark: '#1c5bb8', icon: '💧' },
  ember:   { name: 'Ember',   color: '#ff8a4c', dark: '#c4461a', icon: '🔥' },
  gale:    { name: 'Gale',    color: '#7fe3b4', dark: '#2a9a68', icon: '🌀' },
  aurora:  { name: 'Aurora',  color: '#ff7ad9', dark: '#a43b9a', icon: '✦' },
};
// attacker -> super effective against (x2) / resisted by (x0.5)
const SE = { snow: ['tide', 'gale'], crystal: ['snow', 'aurora'], tide: ['ember', 'crystal'], ember: ['snow', 'crystal'], gale: ['tide', 'aurora'], aurora: ['gale', 'ember'] };
const NVE = { snow: ['ember', 'snow'], crystal: ['tide', 'crystal'], tide: ['snow', 'tide'], ember: ['tide', 'ember'], gale: ['crystal', 'snow'], aurora: ['crystal', 'aurora'] };
export function typeMult(atk, def) {
  if (SE[atk]?.includes(def)) return 2;
  if (NVE[atk]?.includes(def)) return 0.5;
  return 1;
}
export const CHART = { SE, NVE };

// kind: dmg | heal | buff | status ; eff: { status, chance } ; buff: { stat, stages }
export const MOVES = {
  bonk:        { name: 'Bonk',           type: 'plain',   pow: 35, acc: 100, desc: 'A clumsy little headbutt.' },
  snuggle:     { name: 'Snuggle Slam',   type: 'plain',   pow: 60, acc: 95,  desc: 'Hug... but hard.' },
  zoomies:     { name: 'Zoomies',        type: 'plain',   kind: 'buff', buff: { stat: 'spd', stages: 2 }, acc: 100, desc: 'Runs in circles. Speed ↑↑' },
  restnap:     { name: 'Cozy Nap',       type: 'plain',   kind: 'heal', heal: 0.5, selfStatus: 'sleep', acc: 100, desc: 'Heals half HP, then dozes off.' },
  snowpuff:    { name: 'Snowpuff',       type: 'snow',    pow: 40, acc: 100, desc: 'A fluffy snowball.' },
  frostbreath: { name: 'Frost Breath',   type: 'snow',    pow: 55, acc: 95,  eff: { status: 'chill', chance: 0.25 }, desc: '25% chill.' },
  hailhug:     { name: 'Hail Hug',       type: 'snow',    pow: 70, acc: 95,  desc: 'A crunchy icy embrace.' },
  blizzard:    { name: 'Blizzard Burst', type: 'snow',    pow: 90, acc: 82,  eff: { status: 'chill', chance: 0.3 }, desc: 'Whiteout! 30% chill.' },
  shardtoss:   { name: 'Shard Toss',     type: 'crystal', pow: 40, acc: 100, desc: 'Flings a sparkly shard.' },
  gemguard:    { name: 'Gem Guard',      type: 'crystal', kind: 'buff', buff: { stat: 'def', stages: 2 }, acc: 100, desc: 'Crystal armour. Defense ↑↑' },
  prismbeam:   { name: 'Prism Beam',     type: 'crystal', pow: 65, acc: 95,  desc: 'Rainbow-split light beam.' },
  crystalcrash:{ name: 'Crystal Crash',  type: 'crystal', pow: 90, acc: 85,  desc: 'A geode-sized body slam.' },
  bubble:      { name: 'Bubble',         type: 'tide',    pow: 40, acc: 100, desc: 'Ploop!' },
  wavesplash:  { name: 'Wave Splash',    type: 'tide',    pow: 60, acc: 95,  desc: 'A cold, cold wave.' },
  tidelullaby: { name: 'Tide Lullaby',   type: 'tide',    kind: 'status', eff: { status: 'sleep', chance: 1 }, acc: 70, desc: 'Lapping waves. Sleep.' },
  tidalcrash:  { name: 'Tidal Crash',    type: 'tide',    pow: 90, acc: 85,  desc: 'The whole tidepool, at once.' },
  spark:       { name: 'Spark',          type: 'ember',   pow: 40, acc: 100, eff: { status: 'burn', chance: 0.1 }, desc: '10% burn.' },
  flamepounce: { name: 'Flame Pounce',   type: 'ember',   pow: 60, acc: 95,  eff: { status: 'burn', chance: 0.2 }, desc: '20% burn.' },
  warmglow:    { name: 'Warm Glow',      type: 'ember',   kind: 'heal', heal: 0.4, acc: 100, desc: 'Toasty. Heals 40%.' },
  inferno:     { name: 'Inferno',        type: 'ember',   pow: 90, acc: 82,  eff: { status: 'burn', chance: 0.3 }, desc: '30% burn.' },
  gust:        { name: 'Gust',           type: 'gale',    pow: 40, acc: 100, desc: 'Whoosh.' },
  tailwind:    { name: 'Tailwind',       type: 'gale',    kind: 'buff', buff: { stat: 'spd', stages: 2 }, acc: 100, desc: 'Speed ↑↑' },
  featherflurry:{ name: 'Feather Flurry',type: 'gale',    pow: 65, acc: 95,  desc: 'A storm of fluff.' },
  cyclone:     { name: 'Cyclone',        type: 'gale',    pow: 90, acc: 85,  desc: 'Spin to win.' },
  glimmer:     { name: 'Glimmer',        type: 'aurora',  pow: 45, acc: 100, desc: 'A twinkle that stings.' },
  dazzle:      { name: 'Dazzle Lullaby', type: 'aurora',  kind: 'status', eff: { status: 'sleep', chance: 1 }, acc: 75, desc: 'Hypnotic lights. Sleep.' },
  auroraveil:  { name: 'Aurora Veil',    type: 'aurora',  kind: 'heal', heal: 0.5, acc: 100, desc: 'Heals 50%.' },
  starfall:    { name: 'Starfall',       type: 'aurora',  pow: 100, acc: 85, desc: 'The sky falls (gently).' },
  rally:       { name: 'Rally Howl',     type: 'plain',   kind: 'buff', buff: { stat: 'atk', stages: 2 }, acc: 100, desc: 'Attack ↑↑' },
};

// rarity: catch base rate + xp yield + colour
export const RARITY = {
  common:    { name: 'Common',    rate: 0.6,  xp: 1,   color: '#cfd8e3' },
  uncommon:  { name: 'Uncommon',  rate: 0.42, xp: 1.2, color: '#7fe3b4' },
  rare:      { name: 'Rare',      rate: 0.26, xp: 1.5, color: '#6cb8ff' },
  legendary: { name: 'Legendary', rate: 0.07, xp: 2.5, color: '#ffcf4a' },
};

// model: shape round|tall|long|tiny, ears cat|bunny|round|horn|antler|fin|none, tail fluff|fin|flame|crystal|leaf|none,
//   wings, crest, glow, body/belly/accent colours. learn: [[level, moveId], ...]
const S = (id, name, type, rarity, base, learn, model, extra = {}) => ({ id, name, type, rarity, base, learn, model, ...extra });
export const SPECIES = [
  S('flurrip', 'Flurrip', 'snow', 'common', { hp: 48, atk: 50, def: 45, spd: 55 }, [[1, 'bonk'], [1, 'snowpuff'], [6, 'frostbreath'], [10, 'zoomies'], [15, 'hailhug']],
    { shape: 'round', body: '#eaf7ff', belly: '#ffffff', accent: '#8fd8ff', ears: 'cat', tail: 'fluff' }, { evolveAt: 12, evolveTo: 'blizzaroo', starter: true, blurb: 'A fluffy snow-kit that sneezes snowflakes.' }),
  S('blizzaroo', 'Blizzaroo', 'snow', 'uncommon', { hp: 72, atk: 78, def: 66, spd: 74 }, [[1, 'snowpuff'], [1, 'frostbreath'], [12, 'hailhug'], [16, 'blizzard']],
    { shape: 'tall', body: '#dff2ff', belly: '#ffffff', accent: '#3fa8ff', ears: 'bunny', tail: 'fluff', crest: true, scale: 1.3 }, { blurb: 'Hops through blizzards with springy legs.' }),
  S('puffpaw', 'Puffpaw', 'snow', 'common', { hp: 60, atk: 40, def: 55, spd: 40 }, [[1, 'bonk'], [1, 'snowpuff'], [7, 'restnap'], [12, 'hailhug']],
    { shape: 'round', body: '#ffffff', belly: '#e8f4ff', accent: '#b3d9f2', ears: 'round', tail: 'fluff', scale: 0.9 }, { blurb: 'Basically a snowball with paws.' }),
  S('mittensnout', 'Mittensnout', 'snow', 'uncommon', { hp: 56, atk: 62, def: 50, spd: 64 }, [[1, 'snowpuff'], [1, 'zoomies'], [8, 'frostbreath'], [14, 'hailhug']],
    { shape: 'long', body: '#5b6b8c', belly: '#dfe8ff', accent: '#ffffff', ears: 'cat', tail: 'fluff' }, { night: true, blurb: 'A night-time sniffer. Its mittens never come off.' }),
  S('glacieron', 'Glacieron', 'snow', 'legendary', { hp: 100, atk: 96, def: 100, spd: 80 }, [[1, 'hailhug'], [1, 'blizzard'], [1, 'gemguard'], [1, 'frostbreath']],
    { shape: 'tall', body: '#bfe9ff', belly: '#ffffff', accent: '#2f86c4', ears: 'antler', tail: 'crystal', crest: true, glow: '#8fd8ff', scale: 1.7 }, { night: true, blurb: 'Glaciers groan when it walks. Seen on Aurora Peak at night.' }),

  S('breezlet', 'Breezlet', 'gale', 'common', { hp: 44, atk: 48, def: 40, spd: 70 }, [[1, 'bonk'], [1, 'gust'], [6, 'tailwind'], [11, 'featherflurry']],
    { shape: 'tiny', body: '#c9f7e2', belly: '#ffffff', accent: '#7fe3b4', ears: 'none', tail: 'leaf', wings: true }, { evolveAt: 12, evolveTo: 'galecrest', blurb: 'Rides the breeze like a dandelion seed.' }),
  S('galecrest', 'Galecrest', 'gale', 'uncommon', { hp: 66, atk: 74, def: 58, spd: 94 }, [[1, 'gust'], [1, 'tailwind'], [12, 'featherflurry'], [17, 'cyclone']],
    { shape: 'tall', body: '#9eeccb', belly: '#f2fff9', accent: '#2a9a68', ears: 'none', tail: 'leaf', wings: true, crest: true, scale: 1.3 }, { blurb: 'Its crest points at the next storm.' }),
  S('squallray', 'Squallray', 'gale', 'rare', { hp: 70, atk: 80, def: 64, spd: 96 }, [[1, 'gust'], [1, 'wavesplash'], [12, 'featherflurry'], [16, 'cyclone']],
    { shape: 'long', body: '#5fd0c0', belly: '#e8fffb', accent: '#1d6f8a', ears: 'fin', tail: 'fin', wings: true, scale: 1.2 }, { blurb: 'Glides over the waves on frosty winds.' }),
  S('tempestra', 'Tempestra', 'gale', 'legendary', { hp: 92, atk: 104, def: 82, spd: 110 }, [[1, 'cyclone'], [1, 'featherflurry'], [1, 'tailwind'], [1, 'starfall']],
    { shape: 'tall', body: '#7fe3b4', belly: '#ffffff', accent: '#1a5a48', ears: 'horn', tail: 'leaf', wings: true, crest: true, glow: '#c9ffe9', scale: 1.7 }, { aurora: true, blurb: 'Dances inside the aurora winds.' }),

  S('cindermitt', 'Cindermitt', 'ember', 'uncommon', { hp: 50, atk: 60, def: 46, spd: 58 }, [[1, 'bonk'], [1, 'spark'], [7, 'warmglow'], [11, 'flamepounce']],
    { shape: 'round', body: '#ffb36b', belly: '#fff0d6', accent: '#ff6a2a', ears: 'round', tail: 'flame' }, { evolveAt: 14, evolveTo: 'hearthowl', day: true, blurb: 'Keeps paws warm by glowing softly. Out only by day.' }),
  S('hearthowl', 'Hearthowl', 'ember', 'rare', { hp: 74, atk: 84, def: 70, spd: 70 }, [[1, 'spark'], [1, 'warmglow'], [14, 'flamepounce'], [18, 'inferno']],
    { shape: 'tall', body: '#c46a3a', belly: '#ffe2b8', accent: '#ff8a4c', ears: 'cat', tail: 'flame', wings: true, scale: 1.3 }, { blurb: 'A hearth-warm owl that never lets its fire go out.' }),
  S('emberkit', 'Emberkit', 'ember', 'common', { hp: 46, atk: 56, def: 44, spd: 56 }, [[1, 'bonk'], [1, 'spark'], [6, 'rally'], [10, 'flamepounce']],
    { shape: 'round', body: '#ff9a5a', belly: '#ffe7c7', accent: '#c4461a', ears: 'cat', tail: 'flame' }, { evolveAt: 12, evolveTo: 'magmane', starter: true, blurb: 'A tiny campfire with ears.' }),
  S('magmane', 'Magmane', 'ember', 'uncommon', { hp: 72, atk: 86, def: 62, spd: 70 }, [[1, 'spark'], [1, 'flamepounce'], [12, 'rally'], [16, 'inferno']],
    { shape: 'long', body: '#e2632e', belly: '#ffd0a0', accent: '#ffcf4a', ears: 'cat', tail: 'flame', crest: true, scale: 1.35 }, { blurb: 'Its mane crackles like a cozy stove.' }),

  S('shardling', 'Shardling', 'crystal', 'common', { hp: 50, atk: 46, def: 62, spd: 40 }, [[1, 'bonk'], [1, 'shardtoss'], [7, 'gemguard'], [11, 'prismbeam']],
    { shape: 'tiny', body: '#d8c2ff', belly: '#f4edff', accent: '#9a6bff', ears: 'horn', tail: 'crystal' }, { evolveAt: 13, evolveTo: 'prismoth', blurb: 'A pebble that learned to wiggle.' }),
  S('prismoth', 'Prismoth', 'crystal', 'uncommon', { hp: 66, atk: 76, def: 74, spd: 72 }, [[1, 'shardtoss'], [1, 'gemguard'], [13, 'prismbeam'], [17, 'crystalcrash']],
    { shape: 'round', body: '#b994ff', belly: '#f1e6ff', accent: '#ff9ce8', ears: 'antler', tail: 'none', wings: true, glow: '#d8c2ff', scale: 1.25 }, { blurb: 'Its wings split cave-light into rainbows.' }),
  S('geodeer', 'Geodeer', 'crystal', 'uncommon', { hp: 70, atk: 70, def: 78, spd: 52 }, [[1, 'bonk'], [1, 'shardtoss'], [9, 'gemguard'], [13, 'crystalcrash']],
    { shape: 'long', body: '#8a7a9a', belly: '#e6dcf0', accent: '#c79bff', ears: 'antler', tail: 'fluff', scale: 1.2 }, { blurb: 'Grows a new gem on its antlers every winter.' }),

  S('splashpip', 'Splashpip', 'tide', 'common', { hp: 50, atk: 48, def: 50, spd: 54 }, [[1, 'bonk'], [1, 'bubble'], [6, 'tidelullaby'], [10, 'wavesplash']],
    { shape: 'round', body: '#6cc0ff', belly: '#e8f6ff', accent: '#1c5bb8', ears: 'fin', tail: 'fin' }, { evolveAt: 12, evolveTo: 'tidalbelle', starter: true, blurb: 'Blows bubbles when it is happy (always).' }),
  S('tidalbelle', 'Tidalbelle', 'tide', 'uncommon', { hp: 76, atk: 76, def: 70, spd: 68 }, [[1, 'bubble'], [1, 'tidelullaby'], [12, 'wavesplash'], [16, 'tidalcrash']],
    { shape: 'tall', body: '#3f8fe8', belly: '#dff0ff', accent: '#9ff0ff', ears: 'fin', tail: 'fin', crest: true, scale: 1.3 }, { blurb: 'Sings the tide in and out.' }),
  S('shellsnap', 'Shellsnap', 'tide', 'uncommon', { hp: 62, atk: 64, def: 84, spd: 36 }, [[1, 'bonk'], [1, 'bubble'], [9, 'gemguard'], [13, 'wavesplash']],
    { shape: 'round', body: '#ff9aa8', belly: '#ffe8ec', accent: '#2f6fb8', ears: 'none', tail: 'none', shell: true }, { blurb: 'Snaps at anything shiny. Mostly snowflakes.' }),
  S('foamfin', 'Foamfin', 'tide', 'common', { hp: 52, atk: 54, def: 46, spd: 62 }, [[1, 'bubble'], [1, 'zoomies'], [8, 'wavesplash'], [14, 'tidalcrash']],
    { shape: 'long', body: '#e9fbff', belly: '#ffffff', accent: '#4fa3ff', ears: 'fin', tail: 'fin', glow: '#bfefff' }, { night: true, blurb: 'Glows in the night surf like sea-foam.' }),

  S('lumicap', 'Lumicap', 'aurora', 'rare', { hp: 58, atk: 66, def: 58, spd: 60 }, [[1, 'glimmer'], [1, 'dazzle'], [10, 'auroraveil'], [15, 'prismbeam']],
    { shape: 'tiny', body: '#ffd2f2', belly: '#fff2fb', accent: '#ff7ad9', ears: 'round', tail: 'none', cap: true, glow: '#ff9ce8' }, { night: true, blurb: 'A glowing cave-mushroom friend. Night only.' }),
  S('glowisp', 'Glowisp', 'aurora', 'uncommon', { hp: 54, atk: 62, def: 50, spd: 70 }, [[1, 'glimmer'], [1, 'tailwind'], [10, 'dazzle'], [13, 'auroraveil']],
    { shape: 'tiny', body: '#c9b8ff', belly: '#ffffff', accent: '#ff7ad9', ears: 'bunny', tail: 'leaf', glow: '#e7d8ff' }, { evolveAt: 15, evolveTo: 'borealynx', blurb: 'A wisp of aurora that got curious.' }),
  S('borealynx', 'Borealynx', 'aurora', 'rare', { hp: 74, atk: 88, def: 68, spd: 88 }, [[1, 'glimmer'], [1, 'dazzle'], [15, 'auroraveil'], [18, 'starfall']],
    { shape: 'long', body: '#7a6ad8', belly: '#efe9ff', accent: '#5fffd0', ears: 'cat', tail: 'fluff', glow: '#9ff', crest: true, scale: 1.35 }, { blurb: 'Its fur ripples green and pink like the sky.' }),
  S('aurorion', 'Aurorion', 'aurora', 'legendary', { hp: 98, atk: 104, def: 90, spd: 100 }, [[1, 'starfall'], [1, 'auroraveil'], [1, 'dazzle'], [1, 'prismbeam']],
    { shape: 'tall', body: '#ffffff', belly: '#ffe9fb', accent: '#ff7ad9', ears: 'horn', tail: 'fluff', wings: true, crest: true, glow: '#ff9ce8', scale: 1.8 }, { aurora: true, blurb: 'The aurora itself, wearing a body. Appears only while the sky shines.' }),
];
export const SPECIES_BY_ID = Object.fromEntries(SPECIES.map((s, i) => [s.id, { ...s, no: i + 1 }]));
SPECIES.forEach((s, i) => { s.no = i + 1; });
export const STARTERS = ['flurrip', 'emberkit', 'splashpip'];

// world areas: center + radius, pool [[speciesId, weight]], levels, palette, unlock = tamer id beaten
export const AREAS = {
  village:  { id: 'village', name: 'Snowdrift Village', x: 0, z: 0, r: 34, fog: '#dcefff', sky: '#bfe4ff', ground: '#f4fbff', amb: null },
  meadow:   { id: 'meadow', name: 'Pinefrost Meadow', x: 0, z: -105, r: 52, lv: [2, 6], fog: '#e2f5ea', sky: '#bfe8d8', ground: '#eef9f1', amb: 'amb_meadow',
    pool: [['flurrip', 10], ['puffpaw', 10], ['breezlet', 9], ['cindermitt', 5], ['mittensnout', 6], ['emberkit', 3], ['splashpip', 3]], unlock: null },
  caverns:  { id: 'caverns', name: 'Crystal Caverns', x: 110, z: 0, r: 50, lv: [6, 10], fog: '#3a2f5c', sky: '#251d40', ground: '#4a3f66', amb: 'amb_caverns',
    pool: [['shardling', 11], ['geodeer', 7], ['emberkit', 8], ['lumicap', 4], ['puffpaw', 3]], unlock: 'holly' },
  coast:    { id: 'coast', name: 'Tidepool Coast', x: 0, z: 110, r: 52, lv: [10, 14], fog: '#d4ecf5', sky: '#a8d8ee', ground: '#efe6d2', amb: 'amb_coast',
    pool: [['splashpip', 9], ['shellsnap', 8], ['foamfin', 8], ['squallray', 4], ['breezlet', 5], ['mittensnout', 3]], unlock: 'quartz' },
  peak:     { id: 'peak', name: 'Aurora Peak', x: -110, z: 0, r: 50, lv: [14, 18], fog: '#2b2f5a', sky: '#1c1f45', ground: '#e6ecff', amb: 'amb_peak',
    pool: [['glowisp', 10], ['borealynx', 3], ['geodeer', 5], ['squallray', 4], ['lumicap', 4], ['glacieron', 1], ['aurorion', 1], ['tempestra', 1]], unlock: 'brine' },
};
export const AREA_ORDER = ['meadow', 'caverns', 'coast', 'peak'];

// area boss tamers (+ the repeatable Battle Ring champions)
export const TAMERS = {
  holly:    { id: 'holly', name: 'Ranger Holly', area: 'meadow', title: 'Pinefrost Ranger', color: '#2f7d5b', team: [['puffpaw', 6], ['breezlet', 7]], flakes: 120, quote: 'Let\'s see if your Frostlings are trail-ready!' },
  quartz:   { id: 'quartz', name: 'Miner Quartz', area: 'caverns', title: 'Gem Foreman', color: '#7a3fd0', team: [['geodeer', 12], ['shardling', 13], ['magmane', 14]], flakes: 220, quote: 'These caves are full of sparkle — and so are my pals!' },
  brine:    { id: 'brine', name: 'Captain Brine', area: 'coast', title: 'Tidepool Captain', color: '#1c5bb8', team: [['shellsnap', 16], ['squallray', 17], ['tidalbelle', 17]], flakes: 320, quote: 'Ahoy! The tide waits for no tamer!' },
  borealis: { id: 'borealis', name: 'Sage Borealis', area: 'peak', title: 'Keeper of the Lights', color: '#a43b9a', team: [['prismoth', 17], ['galecrest', 17], ['borealynx', 18]], flakes: 600, quote: 'The aurora sings for those who listen. Show me your bond.' },
};
export const TAMER_ORDER = ['holly', 'quartz', 'brine', 'borealis'];

// quests: type catch|catchType|catchSpecies|win|winArea|beat|evolve|bond|dex|ring|catchAurora|legend ; area = shown under that area
export const QUESTS = [
  { id: 'q-first',     name: 'First Friend',        desc: 'Tame your first wild Frostling', goal: { t: 'catch', n: 1 }, reward: { flakes: 40, items: { snare: 3 }, rankXp: 40 } },
  { id: 'q-meadow3',   name: 'Meadow Patrol',       desc: 'Win 3 battles in Pinefrost Meadow', goal: { t: 'winArea', area: 'meadow', n: 3 }, reward: { flakes: 50, items: { berry: 3 }, rankXp: 50 } },
  { id: 'q-night',     name: 'Night Sniffer',       desc: 'Tame a Mittensnout (night only)', goal: { t: 'catchSpecies', species: 'mittensnout', n: 1 }, reward: { flakes: 70, items: { potion: 2 }, rankXp: 60 } },
  { id: 'q-holly',     name: 'Ranger\'s Challenge', desc: 'Defeat Ranger Holly in the Meadow', goal: { t: 'beat', tamer: 'holly', n: 1 }, reward: { flakes: 80, items: { frostsnare: 3 }, rankXp: 120 } },
  { id: 'q-crystal2',  name: 'Shiny Rocks',         desc: 'Tame 2 Crystal-type Frostlings', goal: { t: 'catchType', type: 'crystal', n: 2 }, reward: { flakes: 90, items: { potion: 2 }, rankXp: 90 } },
  { id: 'q-cave5',     name: 'Cave Crawler',        desc: 'Win 5 battles in the Crystal Caverns', goal: { t: 'winArea', area: 'caverns', n: 5 }, reward: { flakes: 100, items: { berry: 4 }, rankXp: 100 } },
  { id: 'q-quartz',    name: 'Gem Foreman',         desc: 'Defeat Miner Quartz in the Caverns', goal: { t: 'beat', tamer: 'quartz', n: 1 }, reward: { flakes: 140, items: { superpotion: 2 }, rankXp: 180 } },
  { id: 'q-evolve',    name: 'Growing Up',          desc: 'Evolve a Frostling', goal: { t: 'evolve', n: 1 }, reward: { flakes: 120, items: { frostsnare: 2 }, rankXp: 150 } },
  { id: 'q-tide3',     name: 'Tidepool Pals',       desc: 'Tame 3 Tide-type Frostlings', goal: { t: 'catchType', type: 'tide', n: 3 }, reward: { flakes: 130, items: { berry: 4 }, rankXp: 150 } },
  { id: 'q-brine',     name: 'Captain\'s Wager',    desc: 'Defeat Captain Brine on the Coast', goal: { t: 'beat', tamer: 'brine', n: 1 }, reward: { flakes: 200, items: { aurorasnare: 2 }, rankXp: 260 } },
  { id: 'q-bond',      name: 'Best Buds',           desc: 'Reach Bond 3 with any Frostling', goal: { t: 'bond', n: 3 }, reward: { flakes: 90, items: { berry: 5 }, rankXp: 100 } },
  { id: 'q-dex12',     name: 'Frostdex Scholar',    desc: 'Register 12 species in the Frostdex', goal: { t: 'dex', n: 12 }, reward: { flakes: 200, items: { aurorasnare: 1 }, rankXp: 200 } },
  { id: 'q-ring',      name: 'Ring Rookie',         desc: 'Win 2 Battle Ring matches', goal: { t: 'ring', n: 2 }, reward: { flakes: 120, items: { superpotion: 1 }, rankXp: 120 } },
  { id: 'q-aurora',    name: 'Under the Lights',    desc: 'Tame an Aurora-type during the aurora', goal: { t: 'catchAurora', n: 1 }, reward: { flakes: 180, items: { aurorasnare: 1 }, rankXp: 200 } },
  { id: 'q-borealis',  name: 'Keeper of the Lights',desc: 'Defeat Sage Borealis on Aurora Peak', goal: { t: 'beat', tamer: 'borealis', n: 1 }, reward: { flakes: 400, items: { aurorasnare: 3 }, rankXp: 400 } },
  { id: 'q-legend',    name: 'Living Legend',       desc: 'Tame a legendary Frostling', goal: { t: 'legend', n: 1 }, reward: { flakes: 500, items: { superpotion: 3 }, rankXp: 500 } },
];

// items: snares (catch multiplier), berries (bond + catch boost), potions
export const ITEMS = {
  snare:       { name: 'Snare',        icon: '⭕', price: 20,  rank: 1, kind: 'snare', mult: 1,   desc: 'A woven ice ring. Basic catch power.' },
  frostsnare:  { name: 'Frost Snare',  icon: '🔷', price: 55,  rank: 3, kind: 'snare', mult: 1.6, desc: '1.6× catch power.' },
  aurorasnare: { name: 'Aurora Snare', icon: '🌈', price: 140, rank: 6, kind: 'snare', mult: 2.5, desc: '2.5× catch power. For legends.' },
  berry:       { name: 'Frostberry',   icon: '🫐', price: 15,  rank: 1, kind: 'berry', desc: 'Feed a wild one: +catch chance. Feed a pal: +bond.' },
  potion:      { name: 'Cocoa Potion', icon: '☕', price: 30,  rank: 1, kind: 'heal', heal: 0.5, desc: 'Heals 50% HP.' },
  superpotion: { name: 'Mega Cocoa',   icon: '🍫', price: 75,  rank: 4, kind: 'heal', heal: 1, desc: 'Fully heals and cures status.' },
};
// care-den hats (cosmetic, bought with flakes, equip per frostling)
export const HATS = {
  bobble: { name: 'Bobble Hat', icon: '🧶', price: 60,  rank: 1, color: '#ff5d8a' },
  bow:    { name: 'Ribbon Bow', icon: '🎀', price: 60,  rank: 1, color: '#ff7ad9' },
  leaf:   { name: 'Pine Sprig', icon: '🌲', price: 80,  rank: 2, color: '#2f7d5b' },
  scarf:  { name: 'Cozy Scarf', icon: '🧣', price: 90,  rank: 3, color: '#ffb02e' },
  crown:  { name: 'Ice Crown',  icon: '👑', price: 250, rank: 6, color: '#ffcf4a' },
};
export const BOND_LEVELS = [0, 3, 8, 15, 25, 40];      // bond points per level (0..5); +3% stats per level
export const RANK_XP = (r) => 80 + r * r * 40;          // tamer rank r -> r+1
export const RANK_MAX = 10;

// one-time BB milestones (economy.earn; pattern shared with other Iceberg games)
export const MILESTONES = [
  { id: 'first-tame', bb: 5,  label: 'First Frostling tamed', test: (s) => s.stats.caught >= 1 },
  { id: 'dex-6',      bb: 10, label: 'Frostdex 6 species', test: (s) => dexCount(s) >= 6 },
  { id: 'dex-12',     bb: 15, label: 'Frostdex 12 species', test: (s) => dexCount(s) >= 12 },
  { id: 'dex-18',     bb: 20, label: 'Frostdex 18 species', test: (s) => dexCount(s) >= 18 },
  { id: 'dex-all',    bb: 50, label: 'Frostdex complete!', test: (s) => dexCount(s) >= SPECIES.length },
  { id: 'evolve',     bb: 10, label: 'First evolution', test: (s) => s.stats.evolved >= 1 },
  { id: 'holly',      bb: 10, label: 'Beat Ranger Holly', test: (s) => s.beaten.includes('holly') },
  { id: 'quartz',     bb: 15, label: 'Beat Miner Quartz', test: (s) => s.beaten.includes('quartz') },
  { id: 'brine',      bb: 20, label: 'Beat Captain Brine', test: (s) => s.beaten.includes('brine') },
  { id: 'borealis',   bb: 30, label: 'Beat Sage Borealis', test: (s) => s.beaten.includes('borealis') },
  { id: 'legend',     bb: 25, label: 'Tamed a legendary', test: (s) => s.stats.legends >= 1 },
  { id: 'rank-5',     bb: 15, label: 'Tamer Rank 5', test: (s) => s.rank >= 5 },
];
export const dexCount = (s) => Object.values(s.dex || {}).filter(v => v === 2).length;   // 1 = seen, 2 = tamed

export const DEFAULT_SAVE = {
  v: 1, starter: null, mons: [], party: [], nextUid: 1,
  flakes: 60, items: { snare: 5, berry: 3, potion: 2 }, hats: [],
  dex: {}, quests: {}, questDone: [], beaten: [], rank: 1, rankXp: 0,
  stats: { caught: 0, wins: 0, evolved: 0, legends: 0, ring: 0, areaWins: {} },
  milestones: [], petAt: {},
};
export const EMOTES = ['👋', '😄', '❤️', '🎉'];
export const NPC_NAMES = ['Pip', 'Mittens', 'Juniper', 'Sleet', 'Biscuit', 'Waddles'];
