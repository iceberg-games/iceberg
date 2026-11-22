// Offline intent router for the Studio corner chat.
// Classifies a message as build, script, help, gui, setting, or unknown.
// Never pretends: if it cannot tell, it returns unknown + example phrasings.
import { COLORS, translate, normalizeNumbers, suggest as suggestPhrases } from './nlscript.js';

export const EXAMPLE_PHRASES = [
  'build a small house',
  'make a 3 story building',
  'make a 10 jump obby',
  'make a maze',
  'add a tree',
  'make a tower 10 high',
  'add 5 coins in a line',
  'make the red part kill players',
  'my door doesn\'t work',
  'add a coin counter top right',
  'make it bigger',
  'undo that',
];

const COLOR_NAMES = Object.keys(COLORS).filter((k) => k !== 'rainbow' && k !== 'random').sort((a, b) => b.length - a.length);

function norm(text) {
  return normalizeNumbers(String(text || '').replace(/\s+/g, ' ').trim().toLowerCase());
}

function colorIn(t) {
  for (const name of COLOR_NAMES) {
    if (new RegExp(`\\b${name.replace(/ /g, '\\s+')}\\b`).test(t)) return { name, hex: COLORS[name] };
  }
  return null;
}

function numberIn(t, re, fallback = null) {
  const m = t.match(re);
  if (!m) return fallback;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : fallback;
}

const HELP_RE = /\b((?:it |this |my |the )?\w+\s+)?(doesn'?t work|does not work|isn'?t working|not working)|something'?s wrong|what'?s wrong|whats wrong|why (isn'?t|doesn'?t|won'?t|is it broken)|check (this |my |the )?(script|door|part)|fix (this|my|it|the script)|help (me )?(with|fix|check)\b/;

const GUI_KIND_RE = /\b(coin counter|score counter|health bar|timer bar|timer|hud|gui|button|label|frame|panel|image|progress bar|on[ -]?screen)\b/;
const GUI_VERB_RE = /\b(add|make|create|place|put|show|build)\b/;

const BUILD_KINDS = [
  { kind: 'town', re: /\b(towns?|cit(?:y|ies)|villages?|hamlets?|neighbou?rhoods?|suburbs?|settlements?|streets?|downtown|houses\b)/ },
  { kind: 'fountain', re: /\b(fountains?|water feature)\b/ },
  { kind: 'obby', re: /\b(obby|obstacle course|jump course)\b/ },
  { kind: 'building', re: /\b(building|apartments?)\b/ },
  { kind: 'maze', re: /\bmazes?\b/ },
  { kind: 'arena', re: /\b(arena|stadium|courtyard)\b/ },
  { kind: 'lamp', re: /\b(lamp\s*posts?|lampposts?|street ?lamps?|lantern posts?)\b/ },
  { kind: 'ladder', re: /\bladders?\b/ },
  { kind: 'fence', re: /\b(fences?|fencing)\b/ },
  { kind: 'shop', re: /\b(shop stand|market stall|stall|kiosk|booth|shop)\b/ },
  { kind: 'car', re: /\b(cars?|vehicles?|karts?)\b/ },
  { kind: 'tree', re: /\b(trees?|pine tree|pines)\b/ },
  { kind: 'house', re: /\b(house|home|hut|cabin|cottage)\b/ },
  { kind: 'tower', re: /\b(tower|turret|spire)\b/ },
  { kind: 'bridge', re: /\bbridges?\b/ },
  { kind: 'coins', re: /\bcoins?\b/ },
  { kind: 'checkpoint', re: /\bcheckpoints?\b/ },
  { kind: 'stairs', re: /\b(stairs|staircase|steps)\b/ },
  { kind: 'wall', re: /\bwalls?\b/ },
  { kind: 'platform', re: /\bplatforms?\b/ },
];
const MAT_WORDS = { wood: 'wood', wooden: 'wood', metal: 'metal', iron: 'metal', steel: 'metal', ice: 'ice', glass: 'glass', neon: 'neon', snow: 'snow', plastic: 'plastic', lava: 'lava' };
function materialIn(t) {
  for (const [w, m] of Object.entries(MAT_WORDS)) {
    if (new RegExp(`\\b${w}\\b`).test(t)) return m;
  }
  return null;
}
const BUILD_VERB_RE = /\b(build|make|add|place|create|spawn|put|drop)\b/;
const SCRIPT_ON_PART_RE = /\bmake\s+(?:the\s+|this\s+|my\s+)?(.+?)\s+(kill|hurt|heal|damage|teleport|spin|open|close|bounce|give|award|say|play|disappear|hide|show|turn|become)\b/;

function sizeWord(t) {
  if (/\b(tiny|mini|very small)\b/.test(t)) return 0.5;
  if (/\bsmall\b/.test(t)) return 0.7;
  if (/\b(huge|giant|very large|massive)\b/.test(t)) return 1.8;
  if (/\b(large|big|tall)\b/.test(t)) return 1.4;
  return 1;
}

const SCRIPT_CUE = /\b(when|whenever|once|every|this is|on spawn|on click|touched|clicked|pressed|spin|rotate|teleport|kill|heal|hurt|damage|bounce|lava|hide|show|open|close|door|give|award|win|leaderboard|countdown|faster|slower|jump|gravity|glow|light|particles|sound|message|say |tell |announce)\b/;

const BUILD_VERBS = 'build|make|create|generate|design|construct|draw|add|place|spawn|craft|set up|setup|throw up|whip up';
const FILLER_RES = [
  /^(?:hey|hi|hello|ok|okay|yo|so|um|uh|well)\b[ ,!.]*/,
  /^(?:please|pls|plz)\b[ ,]*/,
  /^(?:can|could|would|will) (?:you|u|ya)(?: please)?(?: just)?(?: go ahead and)?\s+/,
  /^(?:i|we)(?:'d| would| want| wanna| need| would like| 'd like|'d love| love)(?: to)?(?: you to)?\s*/,
  /^i (?:want|need|wanna|would like|'d like) (?:you )?to\s+/,
  /^(?:let'?s|lets)\s+/,
  /^(?:go ahead and|just)\s+/,
];
/** Strip polite/filler words so "can you please make me a little house" reads like "make a house". */
export function polish(text) {
  let t = ` ${text} `;
  t = t.replace(/[!?.,;:]+/g, ' ').replace(/\s+/g, ' ').trim();
  for (let pass = 0; pass < 3; pass++) {
    const before = t;
    for (const re of FILLER_RES) t = t.replace(re, '').trim();
    if (t === before) break;
  }
  t = t.replace(/^(?:give|get) (?:me|us)\b/, 'make');
  t = t
    .replace(/\b(?:please|pls|plz|thanks|thank you|for me|right now|real quick|quickly|asap|now)\b/g, ' ')
    .replace(/\b(make|build|create|generate|design|construct|draw|give|get|craft|add|place|put|spawn|drop) (?:me|us|my)\b/g, '$1')
    .replace(/\b(a little|a small little|a tiny little|a bit of|a few|some|a nice|a cool|a simple|a basic|a quick|a pretty|a neat|just a|the)\b/g, (m) => (/^(a little|a small little|a tiny little)$/.test(m) ? 'a small' : /^a few|some$/.test(m) ? 'a few' : 'a'))
    .replace(/\ba (?=[aeiou])/g, 'a ')
    .replace(/\s+/g, ' ').trim();
  return t;
}

// Closest template for things the builder does not have, so a build request never dead-ends.
const CLOSEST = [
  ['town', /\b(city|cities|village|hamlet|neighbou?rhood|suburb|settlement|community|kingdom|district|streets?|downtown|campus|resort|world|map)\b/],
  ['building', /\b(skyscraper|hotel|office|mall|factory|apartment|condo|hospital|school|museum|library|warehouse|casino|tall building)\b/],
  ['house', /\b(castle|fort|fortress|base|mansion|palace|igloo|barn|garage|church|room|lodge|treehouse|clubhouse|hideout|bunker|temple|villa|farm|shed)\b/],
  ['tower', /\b(lighthouse|rocket|pillar|column|watchtower|monument|statue|obelisk|chimney|pyramid)\b/],
  ['car', /\b(boat|ship|truck|bus|train|plane|jet|vehicle|bike|bicycle|tank|sled|sleigh|taxi|van|ufo|robot)\b/],
  ['tree', /\b(forest|bush|flower|garden|plant|park|woods|jungle|cactus|bush)\b/],
  ['fountain', /\b(pool|pond|lake|waterfall|water|well|swimming)\b/],
  ['obby', /\b(parkour|course|race|racetrack|challenge|obstacle|level|game|minigame|speedrun)\b/],
  ['arena', /\b(playground|field|ring|pit|colosseum|court|cage|battle|boss|dungeon|room)\b/],
  ['maze', /\b(labyrinth|puzzle|corridor)\b/],
  ['bridge', /\b(path|walkway|dock|pier|boardwalk|crossing|road|runway)\b/],
  ['shop', /\b(store|restaurant|cafe|bakery|market|stand|vendor|diner|bar|cart)\b/],
  ['platform', /\b(island|floor|stage|ground|pad|raft)\b/],
  ['stairs', /\b(ramp|slide|escalator|steps)\b/],
  ['wall', /\b(barrier|barricade|border|divider)\b/],
];
const NOUN_STOP = new Set(['a', 'an', 'the', 'my', 'me', 'us', 'some', 'something', 'anything', 'thing', 'one', 'new', 'few', 'big', 'small', 'large', 'huge', 'tiny', 'little', 'cool', 'nice']);
function requestedNoun(tb) {
  const words = tb.replace(new RegExp(`^(?:${BUILD_VERBS})\\s+`), '').split(/\s+/).filter((w) => w && !NOUN_STOP.has(w) && !/^\d+$/.test(w));
  return words.slice(0, 3).join(' ');
}
export function closestTemplate(tb) {
  for (const [tpl, re] of CLOSEST) if (re.test(tb)) return tpl;
  return /\b(something|anything|stuff|thing|surprise)\b/.test(tb) ? 'town' : 'house';
}

function parseBuild(t) {
  const hit = BUILD_KINDS.find((k) => k.re.test(t));
  if (!hit) return null;
  const color = colorIn(t);
  const count = numberIn(t, /\b(\d+(?:\.\d+)?)\s+(?:coins?|checkpoints?|jumps?|platforms?|parts?|blocks?|stories|storeys|floors|cells?)\b/)
    ?? numberIn(t, /\b(\d+)[ -]jump\b/, hit.kind === 'coins' ? 5 : hit.kind === 'obby' ? 10 : 1);
  const height = numberIn(t, /\b(\d+(?:\.\d+)?)\s*(?:high|tall|studs?\s+tall|studs?\s+high)\b/)
    ?? numberIn(t, /\b(?:height|tall(?:ness)?)\s+(?:of\s+)?(\d+(?:\.\d+)?)\b/);
  const length = numberIn(t, /\b(\d+(?:\.\d+)?)\s*(?:long|studs?\s+long|in\s+length)\b/)
    ?? numberIn(t, /\blength\s+(?:of\s+)?(\d+(?:\.\d+)?)\b/);
  const width = numberIn(t, /\b(\d+(?:\.\d+)?)\s*(?:wide|studs?\s+wide)\b/)
    ?? numberIn(t, /\bwidth\s+(?:of\s+)?(\d+(?:\.\d+)?)\b/);
  const stories = numberIn(t, /\b(\d+)\s*[ -]?(?:story|stories|storey|storeys|floor|floors)\b/);
  const line = /\b(in a line|in a row|lined up|a line of)\b/.test(t);
  const mat = materialIn(t);
  const tpl = hit.kind === 'house' && stories != null && stories > 1 ? 'building' : hit.kind;
  return {
    kind: 'build',
    template: tpl,
    color: color?.hex || null,
    colorName: color?.name || null,
    material: mat,
    count: Math.max(1, Math.min(40, Math.round(count))),
    height: height != null ? Math.max(1, Math.min(80, height)) : null,
    length: length != null ? Math.max(1, Math.min(120, length)) : null,
    width: width != null ? Math.max(1, Math.min(40, width)) : null,
    stories: stories != null ? Math.max(1, Math.min(8, Math.round(stories))) : (tpl === 'building' ? 3 : null),
    scale: sizeWord(t),
    line,
    around: /\baround\b/.test(t),
  };
}

const UNDO_LAST_RE = /^(undo that|undo it|undo the last(?: build)?|delete that|remove that|scratch that|never mind that)\.?$/;
function parseTweak(t) {
  if (UNDO_LAST_RE.test(t)) return { kind: 'undoLast' };
  const aboutLast = /\b(it|that|the last(?: build)?|the last thing)\b/.test(t) || /^(make it|paint it|colour it|color it|turn it)\b/.test(t);
  if (!aboutLast) return null;
  const color = colorIn(t);
  const material = materialIn(t);
  let scale = null;
  if (/\b(twice as (?:big|large)|two times (?:as )?(?:big|bigger|large)|2 times (?:as )?(?:big|bigger))\b/.test(t) || /\b(much bigger|huge)\b/.test(t)) scale = 2;
  else if (/\b(bigger|larger|make it big)\b/.test(t)) scale = 1.4;
  else if (/\b(a bit bigger|slightly bigger)\b/.test(t)) scale = 1.2;
  else if (/\b(smaller|tinier|make it small)\b/.test(t)) scale = 0.7;
  if (scale == null && !color && !material) return null;
  return { kind: 'tweak', scale, color: color?.hex || null, colorName: color?.name || null, material };
}

const ANCHORS = {
  'top-left': /\btop[ -]?left\b/,
  'top-right': /\btop[ -]?right\b/,
  'bottom-left': /\bbottom[ -]?left\b/,
  'bottom-right': /\bbottom[ -]?right\b/,
  top: /\b(top|top[ -]?center|top[ -]?middle)\b/,
  bottom: /\b(bottom|bottom[ -]?center)\b/,
  left: /\b(left side|on the left)\b/,
  right: /\b(right side|on the right)\b/,
  center: /\b(center|middle)\b/,
};

function parseAnchor(t) {
  for (const [a, re] of Object.entries(ANCHORS)) if (re.test(t)) return a;
  return null;
}

function parseGui(t) {
  let type = 'label';
  let bind = null;
  let text = '';
  let togglesPanel = false;
  if (/\bshop\b/.test(t) && /\bbutton\b/.test(t)) {
    type = 'button'; text = 'Shop'; togglesPanel = true;
  } else if (/\bbutton\b/.test(t)) {
    type = 'button';
    const label = t.match(/\b(?:button\s+(?:called|named|that says|labelled|labeled)\s+)["']?([^"'.]+?)["']?(?:\s+that|\s*$)/)
      || t.match(/\b["']([^"']+)["']\s+button\b/);
    text = label ? label[1].trim().slice(0, 24) : (/shop/.test(t) ? 'Shop' : 'Button');
    togglesPanel = /\b(opens?|toggles?|shows?)\s+(a\s+)?(panel|menu|shop|frame)\b/.test(t);
  } else if (/\b(health bar|hp bar|health)\b/.test(t)) {
    type = 'bar'; bind = 'health'; text = 'Health';
  } else if (/\b(timer bar|timer)\b/.test(t)) {
    type = 'bar'; bind = 'timer'; text = 'Timer';
  } else if (/\b(coin counter|coins?\b)/.test(t)) {
    type = 'label'; bind = 'coins'; text = 'Coins';
  } else if (/\b(score counter|points? counter|scoreboard|score)\b/.test(t)) {
    type = 'label'; bind = 'points'; text = 'Score';
  } else if (/\b(image|picture|icon)\b/.test(t)) {
    type = 'image'; text = 'Image';
  } else if (/\b(frame|panel|box)\b/.test(t)) {
    type = 'frame'; text = 'Panel';
  } else if (/\blabel\b|\btext\b/.test(t)) {
    type = 'label'; text = 'Label';
  } else if (/\b(coin counter)\b/.test(t) === false && GUI_KIND_RE.test(t)) {
    type = 'label'; text = 'Label';
  }
  const color = colorIn(t);
  return {
    kind: 'gui',
    type,
    bind,
    text,
    anchor: parseAnchor(t) || (type === 'bar' && bind === 'health' ? 'top-left' : 'top-right'),
    color: color?.hex || null,
    togglesPanel,
  };
}

function namedPart(t, names = []) {
  const list = [...new Set((names || []).filter((n) => typeof n === 'string' && n.length > 1))]
    .sort((a, b) => b.length - a.length);
  const lower = t.toLowerCase();
  for (const n of list) {
    if (lower.includes(n.toLowerCase())) return n;
  }
  return null;
}

function parseScriptTarget(t, names = []) {
  const named = namedPart(t, names);
  const color = colorIn(t);
  const m = t.match(SCRIPT_ON_PART_RE);
  return {
    name: named,
    color: color?.hex || null,
    colorName: color?.name || null,
    described: m ? m[1].trim() : (color ? `${color.name} part` : null),
  };
}

const SETTING_RE = /\b(first[ -]?person|first person camera|fpv|toggle first person)\b/;

function isSetting(t) {
  return SETTING_RE.test(t) && /\b(toggle|enable|turn on|switch to|use|set|go|camera)\b/.test(t);
}

const TEMPLATE_WORD = { town: 'a little town', house: 'a house', building: 'a building', tower: 'a tower', car: 'a car', tree: 'a tree', fountain: 'a fountain', obby: 'an obby', arena: 'an arena', maze: 'a maze', bridge: 'a bridge', shop: 'a shop', platform: 'a platform', stairs: 'stairs', wall: 'a wall' };
function fallbackNote(noun, template) {
  const what = noun ? `I don't have a "${noun}" yet, so` : 'I wasn\'t sure exactly what you meant, so';
  return `${what} I built the closest thing I know — ${TEMPLATE_WORD[template] || template}. Say "make it bigger", "make it blue" or "undo that" to adjust.`;
}
function withNote(intent, tb) {
  if (intent.template === 'town' && /\b(cit(?:y|ies))\b/.test(tb)) { intent.city = true; intent.note = 'A city is a town with taller buildings — here you go.'; }
  else if (intent.template === 'town' && /\bhouses\b/.test(tb)) intent.note = 'A few houses together make a little town — here you go.';
  return intent;
}

/**
 * @param {string} text
 * @param {{ names?: string[] }} [ctx]
 * @returns {object}
 */
export function classifyIntent(text, ctx = {}) {
  const raw = String(text || '').trim();
  if (!raw) {
    return { kind: 'unknown', text: raw, suggestions: EXAMPLE_PHRASES.slice(0, 3) };
  }
  const t = norm(raw);

  const tweak = parseTweak(t);
  if (tweak) return { ...tweak, text: raw };

  if (HELP_RE.test(t)) return { kind: 'help', text: raw, query: t };

  if (isSetting(t)) {
    const on = /\b(off|third[ -]?person|disable|turn off)\b/.test(t) ? false
      : /\b(toggle|switch)\b/.test(t) ? 'toggle'
        : true;
    return { kind: 'setting', text: raw, setting: 'firstPerson', value: on };
  }

  const looksGui = GUI_KIND_RE.test(t) && (GUI_VERB_RE.test(t) || /\b(top[ -]?(left|right)|hud)\b/.test(t));
  if (looksGui) return { ...parseGui(t), text: raw };

  const scriptOnPart = SCRIPT_ON_PART_RE.test(t);
  const tb = polish(t);
  const kindHit = BUILD_KINDS.some((k) => k.re.test(tb));
  const startsBuild = new RegExp(`^(?:${BUILD_VERBS})\\b`).test(tb);
  const wantsPhrase = /^(?:an? |some |\d+ )?[a-z -]{2,40}$/.test(tb) && tb.split(' ').length <= 5 && !SCRIPT_CUE.test(tb);
  const looksBuild = (BUILD_VERB_RE.test(tb) || ((startsBuild || wantsPhrase) && !SCRIPT_CUE.test(tb))) && kindHit && !scriptOnPart;
  if (looksBuild) return withNote({ ...parseBuild(tb), text: raw }, tb);

  const translated = translate(raw, { names: ctx.names || [] });
  const hasProgram = (translated.program?.rules || []).length + (translated.program?.continuous || []).length > 0;
  // The translator is greedy (e.g. "write a poem" becomes a start-message). The chat
  // must not pretend: only treat it as a script when the wording looks like one.
  if (hasProgram && (scriptOnPart || SCRIPT_CUE.test(t))) {
    return { kind: 'script', text: raw, target: parseScriptTarget(t, ctx.names), translation: translated };
  }

  if (looksGui) return { ...parseGui(t), text: raw };

  // A build request we have no template for: use the closest one (never a dead end).
  const generic = startsBuild && !scriptOnPart && !/\b(script|code|poem|story|song|essay|joke)\b/.test(tb);
  const wantMatch = /^(?:i (?:want|need|wanna|would like|'d like)|can you|could you|would you)\b/.test(t) && /\b(make|build|create|have|get|see|a|an|some)\b/.test(t) && !/\b(script|code|poem|story|song|essay|joke|help|fix|kill|teleport)\b/.test(t);
  if (generic || (wantMatch && !SCRIPT_CUE.test(tb))) {
    const forced = { template: closestTemplate(tb) };
    const base = parseBuild(forced.template + ' ' + tb) || {};
    return { ...base, kind: 'build', template: forced.template, text: raw, fallbackOf: requestedNoun(tb) || null, note: fallbackNote(requestedNoun(tb), forced.template) };
  }

  const suggestions = [
    ...new Set([
      ...(translated.suggestions || []),
      ...suggestPhrases(translated.unknown?.length ? translated.unknown : [raw], 3),
      ...EXAMPLE_PHRASES.slice(0, 3),
    ]),
  ].slice(0, 3);
  return {
    kind: 'unknown',
    text: raw,
    unknown: translated.unknown || [raw],
    suggestions,
  };
}

export { parseBuild, parseGui, parseTweak, colorIn, materialIn, norm };
