// Plain-words scripting: an offline, rule-based natural-language → behavior
// translator. Creators write e.g. "when a player touches this, kill them" and
// it compiles to a small, sandboxed behavior program (JSON, never eval'd):
//
// program = {
//   continuous: [ {type:'spin', axis, speed} | {type:'move', axis, distance, period}
//               | {type:'path', points:[[x,y,z]|'self'|partName], period, pause} ],
//   rules: [ { trigger: {type, seconds?, part?, var?, op?, value?}, once?, loop?,
//              if?: {var, op, value} | {gear}, actions: [Action], else?: [Action] } ],
// }
// trigger.type: start | touch | click | press (click or touch) | enter | leave |
//               every | countdownEnd | death | reach (a variable reaches a value)
// Action: {do: one of ACTION_TYPES, target?: partName, ...params}; 'random'
// carries {options:[Action]} and picks one.
//
// Pipeline: protect quotes / coordinates / part names → normalize numbers,
// units and synonyms → pull out trigger, condition and "otherwise" → split
// into clauses on and/then/commas → match each clause against ACTIONS.
// Anything a real AI model returns must pass validateProgram() before it runs
// (see ai.js), so the sandbox is the same whichever translator is used.

export const COLORS = {
  red: '#e2474b', blue: '#3f8fd0', green: '#2f9e6a', yellow: '#f5c542', orange: '#ff8c2a', purple: '#8b6cf0', violet: '#8b6cf0', pink: '#ff7ac8',
  white: '#ffffff', black: '#22262e', gray: '#a3a2a5', grey: '#a3a2a5', brown: '#8a5a34', cyan: '#4dd2ff', gold: '#f2c230', golden: '#f2c230',
  silver: '#c9d1d9', lime: '#9be15d', teal: '#2bb5a0', magenta: '#e04fd0', navy: '#1d3a6e', maroon: '#7a1f2b', beige: '#e8d9b5',
  'ice blue': '#bfe9ff', 'light blue': '#9fd3f5', 'sky blue': '#87ceeb', 'dark blue': '#1d4f8c', 'dark green': '#1e6b47', 'light green': '#9be1a5',
  'dark red': '#8f1d22', 'hot pink': '#ff3fa4', rainbow: 'rainbow', random: 'random',
};
export const SOUNDS = ['ding', 'beep', 'boom', 'explosion', 'chime', 'pop', 'whoosh', 'coin', 'win', 'buzz', 'bell', 'jump', 'click', 'laser', 'splash', 'zap', 'alarm'];
const SOUND_SYN = { buzzer: 'buzz', victory: 'win', fanfare: 'win', tada: 'win', kaboom: 'boom', bang: 'boom', blast: 'explosion', ring: 'bell', ping: 'ding', swoosh: 'whoosh', woosh: 'whoosh', boing: 'jump', siren: 'alarm', pew: 'laser', bloop: 'pop', 'ka-ching': 'coin', 'cha-ching': 'coin' };
export const PARTICLES = ['sparkles', 'confetti', 'fire', 'smoke', 'explosion', 'bubbles', 'snow', 'hearts', 'stars', 'fireworks'];
const PARTICLE_SYN = { sparkle: 'sparkles', sparks: 'sparkles', glitter: 'sparkles', flames: 'fire', flame: 'fire', bubble: 'bubbles', snowflakes: 'snow', heart: 'hearts', star: 'stars', firework: 'fireworks', explode: 'explosion', explodes: 'explosion', particles: 'sparkles', particle: 'sparkles' };
const GEAR_WORDS = { 'speed coil': 'speedCoil', 'gravity coil': 'gravityCoil', 'magic carpet': 'magicCarpet', carpet: 'magicCarpet' };

// ---------- numbers & units ----------
const SMALL = { zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19 };
const TENS = { twenty: 20, thirty: 30, forty: 40, fourty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };
const NUMW = [...Object.keys(SMALL), ...Object.keys(TENS), 'hundred', 'thousand'].join('|');
const NUMSEQ = new RegExp(`\\b(?:${NUMW})(?:(?:[\\s-]+(?:and[\\s-]+)?)(?:${NUMW}))*(?:\\s+and\\s+a\\s+half)?\\b`, 'g');
function wordsToNumber(s) {
  let total = 0, cur = 0;
  for (const w of s.replace(/and a half$/, '').split(/[\s-]+/)) {
    if (w in SMALL) cur += SMALL[w]; else if (w in TENS) cur += TENS[w];
    else if (w === 'hundred') cur = (cur || 1) * 100; else if (w === 'thousand') { total += (cur || 1) * 1000; cur = 0; }
  }
  return total + cur + (/and a half$/.test(s) ? 0.5 : 0);
}
/** "twenty five" → 25, "two minutes" → "120 seconds", "half a second" → "0.5 seconds" … */
export function normalizeNumbers(t) {
  return t.replace(/\b(a|an|one)\s+(hundred|thousand)\b/g, 'one $2').replace(/\b(every|each) (second|minute|hour)\b/g, '$1 1 $2')
    .replace(/\ba dozen\b/g, '12').replace(/\ba couple(?: of)?\b/g, '2').replace(/\ba few\b/g, '3').replace(/\bseveral\b/g, '4')
    .replace(/\bhalf (?:a|an)\s+(second|minute|hour|stud)\b/g, '0.5 $1s')
    .replace(/(?<!(?:times|spins|rotations|turns|revolutions|once|per) )\b(?:a|an)\s+(second|minute|hour|stud|moment|bit)\b/g, (m, u) => (u === 'moment' || u === 'bit' ? '1 second' : `1 ${u}`))
    .replace(/\bhalf\b(?=\s*(?:transparent|see[- ]through|invisible))/g, '50%')
    .replace(NUMSEQ, (m) => String(wordsToNumber(m)))
    .replace(/\btwice\b/g, '2 times').replace(/\bthrice\b/g, '3 times')
    .replace(/(\d+(?:\.\d+)?)\s*(?:milliseconds?|ms)\b/g, (m, n) => `${+n / 1000} seconds`)
    .replace(/(\d+(?:\.\d+)?)\s*(?:minutes?|mins?)\b/g, (m, n) => `${+n * 60} seconds`)
    .replace(/(\d+(?:\.\d+)?)\s*(?:hours?|hrs?)\b/g, (m, n) => `${+n * 3600} seconds`)
    .replace(/(\d+(?:\.\d+)?)\s*(?:seconds?|secs?|s)\b/g, '$1 seconds')
    .replace(/(?<!\b(?:drop|drops|spawn|spawns|create|creates|make|makes|throw|throws|summon|summons|clone|clones|rain|rains)\s)(\d+(?:\.\d+)?)\s*(?:studs?|blocks?|units?|meters?|metres?|m)\b(?!\w)/g, '$1 studs')
    .replace(/(\d+(?:\.\d+)?)\s*(?:feet|foot|ft)\b/g, (m, n) => `${Math.round(+n / 3.28 * 10) / 10} studs`);
}
const N = '(-?\\d+(?:\\.\\d+)?)';
const SEC = `${N} seconds`;
const num = (s, d) => { const n = parseFloat(s); return isFinite(n) ? n : d; };
const re = (s, f = '') => new RegExp(s, f);
const secsIn = (t, d) => { const m = t.match(re(`(?:for|over|in|during|within|lasting)\\s+${SEC}`)) || t.match(re(`${SEC}`)); return m ? num(m[1], d) : d; };

// ---------- shared vocabulary ----------
const PL = '(?:a |the |any |some |another )?(?:player|players|someone|somebody|anyone|anybody|person|people|user|character|avatar|you|they|he|she|we|i)';
const PART_WORDS = 'part|block|brick|button|pad|area|zone|region|platform|thing|object|door|wall|floor|plate|tile|one|spot|box|ball|sphere|cube|lamp|light|sign|portal|teleporter|elevator|lift';
const OBJ = `(?:it|this(?: (?:${PART_WORDS}))?|me|here|that|the (?:${PART_WORDS})|@p\\d+)`;
const WHEN = '(?:when(?:ever)?|if|once|as soon as|each time|every time|after|upon|(?:the )?first time|the next time)';
const COMMON_NAMES = new Set(['part', 'block', 'brick', 'sphere', 'ball', 'cylinder', 'wedge', 'door', 'button', 'coin', 'checkpoint', 'lava', 'platform', 'spawn', 'spawnlocation', 'floor', 'wall', 'light', 'lamp', 'model', 'rig', 'neon', 'glass', 'ice', 'trampoline', 'killbrick', 'it', 'this', 'me', 'player', 'score', 'points', 'timer', 'counter', 'goal', 'finish', 'start', 'end']);

let Q = [], P = [], C = [], RAW = '';
const nameOf = (tok) => { const m = String(tok).match(/@p(\d+)/); if (m) return P[+m[1]]; const q = String(tok).match(/"?q(\d+)"?/); return q ? Q[+q[1]] : null; };
const quoted = (t) => { const m = t.match(/"q(\d+)"/); return m ? Q[+m[1]] : null; };
function findTarget(t) { const m = t.match(/@p(\d+)/); return m ? P[+m[1]] : null; }
function findColor(t) {
  const hex = t.match(/#[0-9a-f]{6}\b/i); if (hex) return hex[0];
  for (const n of Object.keys(COLORS).sort((a, b) => b.length - a.length)) if (re(`\\b${n}\\b`).test(t)) return COLORS[n];
  return null;
}
function findColors(t) {
  const out = []; let rest = t;
  for (const n of Object.keys(COLORS).sort((a, b) => b.length - a.length)) {
    const r = re(`\\b${n}\\b`);
    while (r.test(rest)) { out.push({ n, i: rest.search(r) }); rest = rest.replace(r, ' '.repeat(n.length)); }
  }
  return out.sort((a, b) => a.i - b.i).map(x => COLORS[x.n]).filter(c => c !== 'random' && c !== 'rainbow');
}
const varName = (w) => {
  w = String(w || '').toLowerCase().replace(/^(?:the|their|his|her|my|your)\s+/, '').trim();
  if (/^(points?|score|scores)$/.test(w)) return 'points'; if (/^(coins?|bucks)$/.test(w)) return 'coins';
  if (/^(health|hp|lives|life)$/.test(w)) return 'health'; if (/^kills?$/.test(w)) return 'kills';
  if (/^touch(es)?$/.test(w)) return 'touches'; if (/^(clicks?|presses)$/.test(w)) return 'clicks';
  return w.replace(/[^\w]/g, '').slice(0, 20) || 'counter';
};
const OPS = [[/at least|no less than|or more|>=/, '>='], [/at most|no more than|or less|<=/, '<='], [/more than|greater than|over|above|bigger than|higher than|>/, '>'], [/less than|fewer than|under|below|smaller than|lower than|</, '<'], [/not|isn't|!=/, '!='], [/exactly|equal to|equals|=/, '==']];
const opOf = (w, d = '>=') => { for (const [r, o] of OPS) if (w && r.test(w)) return o; return d; };
function pointOf(tok) {
  const c = String(tok).match(/pt(\d+)/); if (c) return C[+c[1]];
  const n = nameOf(tok); if (n) return n;
  if (/\b(start|its start|original|where it (?:was|started)|home|here|its position)\b/.test(tok)) return 'self';
  return null;
}
const DIRS = { up: [0, 1, 0], upward: [0, 1, 0], upwards: [0, 1, 0], higher: [0, 1, 0], down: [0, -1, 0], downward: [0, -1, 0], downwards: [0, -1, 0], lower: [0, -1, 0], left: [-1, 0, 0], right: [1, 0, 0], forward: [0, 0, -1], forwards: [0, 0, -1], ahead: [0, 0, -1], backward: [0, 0, 1], backwards: [0, 0, 1], north: [0, 0, -1], south: [0, 0, 1], east: [1, 0, 0], west: [-1, 0, 0] };
function offsetOf(t, d = 5) {
  const dm = t.match(/\b(upwards?|downwards?|up|down|left|right|forwards?|backwards?|ahead|north|south|east|west|higher|lower)\b/);
  const dir = DIRS[dm?.[1] || 'up'];
  const dist = num((t.match(re(`${N} studs`)) || [])[1], d);
  return dir.map(v => v * dist);
}

// ---------- actions (first match per clause wins; order matters) ----------
const A = (name, test, make) => ({ name, test, make });
const ACTIONS = [
  A('random', /\b(?:randomly|at random|either|pick (?:one|a random one)(?: of)?|choose (?:one|randomly)(?: of)?|one of)\b.*\bor\b/, (t) => {
    const body = t.replace(/\b(?:randomly|at random|either|pick (?:one|a random one)(?: of)?|choose (?:one|randomly)(?: of)?|one of)\b\s*:?/g, ' ');
    const colors = findColors(body);
    if (colors.length >= 2 && /\b(turn|become|change|paint|colou?r)\b/.test(body) && !/\b(kill|teleport|say|give|play|bounce)\b/.test(body)) return { do: 'color', choices: colors, target: findTarget(body) };
    const opts = body.split(/\s*\bor\b\s*/).map(s => s.trim()).filter(Boolean).map(s => parseClause(s)).filter(x => x && x.length).map(x => x[0]);
    return opts.length >= 2 ? { do: 'random', options: opts.slice(0, 8) } : (opts[0] || null);
  }),
  A('countdown', /\b(count ?down|countdown)\b|\btimer (?:of|for) -?\d/, (t) => ({ do: 'countdown', seconds: num((t.match(re(`${N}(?: seconds)?`)) || [])[1], 10) })),
  A('timer', /\b(?:start|begin|stop|end|pause|reset) (?:the |a )?(?:timer|stopwatch|clock)\b|\b(?:timer|stopwatch) (?:starts?|stops?)\b/, (t) => ({ do: 'timer', start: !/\b(stop|end|pause)/.test(t), reset: /\breset\b/.test(t) })),
  A('leaderboard', /\b(leaderboard|leader board|leaderstats|scoreboard|score board|high ?scores?)\b/, (t) => ({ do: 'leaderboard', show: !/\b(hide|remove)\b/.test(t) })),
  A('elevator', /\b(elevator|lift)\b/, (t) => elevatorActions(t)),
  A('door', /\b(open(?:s|ed)?|unlock(?:s)?|act(?:s)? (?:like|as) a door|like a door|close(?:s)?|shut(?:s)?|lock(?:s)?)\b/, (t) => {
    const close = /\b(close|closes|shut|shuts|lock|locks)\b/.test(t) && !/\b(open|unlock)/.test(t);
    const stay = /\b(stay|stays|forever|permanently|for good)\b/.test(t);
    return { do: 'door', close, seconds: close || stay ? 0 : secsIn(t, 3), target: findTarget(t), style: /\b(slide|slides|sliding)\b/.test(t) ? 'slide' : 'fade' };
  }),
  A('spawn', /\b(spawn|spawns|create|creates|drop|drops|make|makes|clone|clones|summon|summons|throw|throws|shoot|shoots|rain|rains)\b.*\b(balls?|blocks?|cubes?|bricks?|parts?|coins?|copy|copies|clones?|rocks?|boulders?|spheres?|meteors?|bombs?)\b/, (t) => {
    const what = /\b(balls?|spheres?|rocks?|boulders?|meteors?|bombs?)\b/.test(t) ? 'ball' : /\bcoins?\b/.test(t) ? 'coin' : (findTarget(t) && /\b(copy|copies|clones?)\b/.test(t) ? 'clone' : 'block');
    const count = Math.min(10, Math.max(1, num((t.match(re(`${N}\\s+(?:\\w+\\s+){0,2}(?:balls?|blocks?|cubes?|bricks?|parts?|coins?|copies|clones|rocks?|boulders?|spheres?|meteors?|bombs?)`)) || [])[1], 1)));
    return { do: 'spawn', what, count, color: findColor(t), kill: /\b(lava|deadly|killer|kill|bomb|bombs|meteor|meteors|dangerous|hot)\b/.test(t), target: what === 'clone' ? findTarget(t) : null };
  }),
  A('heal', /\b(heal|heals|restore (?:their |the player'?s? )?health|give (?:them |the player )?(?:\d+ )?(?:health|hp|life))\b/, (t) => ({ do: 'heal', amount: num((t.match(re(`${N}\\s*(?:health|hp)?`)) || [])[1], 100) })),
  A('damage', /\b(damage|damages|hurt|hurts|harm|harms|injure|injures|deal -?\d+|do -?\d+|take -?\d+ (?:damage|health|hp)|lose -?\d+ (?:health|hp)|loses -?\d+ (?:health|hp)|sting|stings)\b/, (t) => ({ do: 'damage', amount: Math.abs(num((t.match(re(`${N}`)) || [])[1], 20)) })),
  A('kill', /\b(kill|kills|killed|slay|slays|eliminate|eliminates|die|dies|dead|deadly|instakill|instant death|oof|lava|reset (?:them|the player)|respawn (?:them|the player)|destroy (?:them|the player))\b/, () => ({ do: 'kill' })),
  A('win', /\b(win|wins|won|winner|victory|finish line|finish(?:es)? the (?:game|obby|level|race)|beat the (?:game|level)|complete the (?:game|level|obby)|end the game)\b/, (t) => ({ do: 'win', text: quoted(t) || 'You win! 🏆' })),
  A('checkpoint', /\b(checkpoint|save (?:their |the )?progress|set (?:their |the )?spawn|new spawn ?point)\b/, () => ({ do: 'checkpoint' })),
  A('teleport', /\b(teleport|teleports|teleporter|warp|warps|transport|transports|portal|send (?:them|the player|him|her) (?:to|back)|take (?:them|the player) to|move (?:them|the player|him|her) to|bring (?:them|the player) (?:to|back))\b/, (t) => {
    const c = t.match(/pt(\d+)/); if (c) return { do: 'teleport', to: C[+c[1]] };
    const name = findTarget(t); if (name) return { do: 'teleport', toPart: name };
    if (/\brandom checkpoint\b/.test(t)) return { do: 'teleport', to: 'randomCheckpoint' };
    if (/\bcheckpoint\b/.test(t)) return { do: 'teleport', to: 'checkpoint' };
    if (/\b(up|into the air|sky)\b/.test(t)) return { do: 'teleport', up: num((t.match(re(`${N} studs`)) || [])[1], 20) };
    return { do: 'teleport', to: 'spawn' };
  }),
  A('bounce', /\b(bounce|bounces|bouncy|launch|launches|fling|flings|trampoline|jump ?pad|boost (?:them |the player )?up|throw (?:them |the player )?(?:up|into the air)|catapult|catapults|spring|springy|yeet)\b/, (t) => {
    let p = 28; if (/really high|super|very high|huge|massive|to the sky/.test(t)) p = 55; else if (/\bhigh\b/.test(t)) p = 40; else if (/\b(small|little|low|gently|a bit)\b/.test(t)) p = 16;
    const n = t.match(/(?:power|strength|force)\s*(?:of\s*)?(\d+)/) || t.match(re(`${N} studs`)); if (n) p = Math.min(120, /studs/.test(n[0]) ? Math.sqrt(2 * 32 * +n[1]) : 8 + +n[1]);
    return { do: 'bounce', power: Math.round(p) };
  }),
  A('jump', /\b(jump (?:higher|boost|power|height)|higher jumps?|super jumps?|jump -?\d+ times (?:higher|as high)|double jump|set (?:their |the )?jump(?: ?power| ?height)? to|lower jumps?|can'?t jump|jump lower)\b/, (t) => {
    let mult = /\b(lower|can'?t)\b/.test(t) ? (/can'?t/.test(t) ? 0 : 0.6) : 1.6;
    const s = t.match(re(`jump(?: ?power| ?height)? to ${N}`)); if (s) mult = +s[1] / 50;
    const x = t.match(re(`${N} times (?:higher|as high)`)); if (x) mult = +x[1];
    return { do: 'jump', mult: Math.max(0, Math.min(4, mult)), seconds: /\b(forever|permanently|for good)\b/.test(t) ? 0 : secsIn(t, 10) };
  }),
  A('speed', /\b(faster|speed (?:them |the player )?up|speed boost|run fast|go fast|move fast|slow (?:them |the player |him |her )?down|slower|sprint|walk ?speed|set (?:their |the )?speed|times as fast|freeze (?:them|the player)|freezes (?:them|the player)|can'?t move|stop (?:them|the player) (?:from )?moving)\b/, (t) => {
    let mult = /\b(slow|slower)\b/.test(t) ? 0.5 : (/(really|super|very) fast/.test(t) ? 2.5 : 1.8);
    if (/\b(freeze|freezes|can'?t move|stop (?:them|the player))\b/.test(t)) mult = 0;
    const s = t.match(re(`speed to ${N}`)); if (s) mult = +s[1] / 16;
    const x = t.match(re(`${N} times (?:as )?(?:fast|faster)`)); if (x) mult = +x[1];
    const pc = t.match(re(`${N}%`)); if (pc && !s) mult = /slow/.test(t) ? 1 - +pc[1] / 100 : 1 + +pc[1] / 100;
    return { do: 'speed', mult: Math.max(0, Math.min(4, mult)), seconds: /\b(forever|permanently|for good)\b/.test(t) ? 0 : secsIn(t, mult === 0 ? 2 : 5) };
  }),
  A('gravity', /\b(low gravity|moon gravity|floaty|float(?:y)? jumps?|less gravity|high gravity|heavy|zero gravity|no gravity|more gravity)\b/, (t) => ({ do: 'gravity', mult: /high|heavy|more/.test(t) ? 1.8 : /zero|no gravity/.test(t) ? 0.1 : 0.35, seconds: /\b(forever|permanently)\b/.test(t) ? 0 : secsIn(t, 8) })),
  A('setVar', /\b(?:set|change)\s+(?:the |their |a )?\w+\s+(?:to|back to)\s+-?\d|\breset (?:the |their )?(?:score|points|counter|health|\w+)\b/, (t) => {
    const m = t.match(re(`\\b(?:set|change)\\s+(?:the |their |a )?(\\w+)\\s+(?:to|back to)\\s+${N}`)); if (m) return { do: 'setVar', name: varName(m[1]), value: +m[2] };
    const r = t.match(/\breset (?:the |their )?(\w+)/); return { do: 'setVar', name: varName(r[1]), value: varName(r[1]) === 'health' ? 100 : 0 };
  }),
  A('addVar', /\b(?:add|adds|increase|increases|increment|raise|subtract|decrease|decreases|decrement|reduce|take away|count|counts)\b.*\b(?:counter|count|variable|tally|touches|clicks|kills|laps|wins|\w+ by -?\d+|to (?:the |a )?[a-z]+$|from (?:the |a )?[a-z]+$)/, (t) => {
    if (/\bpoints?\b|\bscore\b/.test(t)) return pointsAction(t);
    const neg = /\b(subtract|decrease|decreases|decrement|lower|reduce|take away|remove)\b/.test(t);
    let m = t.match(re(`\\b(?:add|adds|subtract|take away|remove)\\s+${N}\\s+(?:to|from)\\s+(?:the |their |a )?(\\w+)`));
    if (m) return { do: 'addVar', name: varName(m[2]), amount: (neg ? -1 : 1) * Math.abs(+m[1]) };
    m = t.match(re(`\\b(?:increase|increases|decrease|decreases|raise|reduce|increment|decrement)\\s+(?:the |their |a )?(\\w+)(?:\\s+by\\s+${N})?`));
    if (m) return { do: 'addVar', name: varName(m[1]), amount: (neg ? -1 : 1) * Math.abs(num(m[2], 1)) };
    m = t.match(/\bcounts? (?:the |how many )?(\w+)/); if (m) return { do: 'addVar', name: varName(m[1]), amount: 1 };
    m = t.match(/\b(?:add|adds)\s+(?:to )?(?:the |a )?(\w+)/); return m ? { do: 'addVar', name: varName(m[1]), amount: 1 } : null;
  }),
  A('points', /\b(points?|score)\b/, (t) => (/\b(show|say|display|tell)\b/.test(t) && !/\b(give|add|award)\b/.test(t) ? null : pointsAction(t))),
  A('bucks', /\b(birg bucks|bucks|bb|money|cash|coins?)\b/, (t) => {
    const amt = t.match(re(`${N}\\s+(?:birg bucks|bucks|bb|money|cash|coins?)`));
    return { do: 'bucks', amount: Math.min(50, Math.max(1, num(amt?.[1], 5))) };
  }),
  A('particles', new RegExp(`\\b(${[...PARTICLES, ...Object.keys(PARTICLE_SYN)].join('|')}|burst|bursts)\\b`), (t) => {
    const kind = PARTICLES.find(k => re(`\\b${k}\\b`).test(t)) || Object.entries(PARTICLE_SYN).find(([k]) => re(`\\b${k}\\b`).test(t))?.[1] || 'sparkles';
    const acts = [{ do: 'particles', kind, seconds: secsIn(t, 1.5), target: findTarget(t) }];
    if (/\b(explode|explodes)\b/.test(t)) acts.push({ do: 'sound', sound: 'boom' });
    return acts;
  }),
  A('sound', new RegExp(`\\b(play (?:a |the |some )?(?:\\w+ )?(?:sound|noise|music|sfx)|make (?:a |the )?(?:\\w+ )?(?:sound|noise)|sound effect|${[...SOUNDS, ...Object.keys(SOUND_SYN)].join('|')})\\b`), (t) => ({ do: 'sound', sound: SOUNDS.find(s => re(`\\b${s}\\b`).test(t)) || Object.entries(SOUND_SYN).find(([k]) => re(`\\b${k}\\b`).test(t))?.[1] || 'ding' })),
  A('message', /\b(say|says|said|show (?:a |the )?(?:message|text|note|popup)|display|displays|tell (?:them|the player|him|her|everyone)|print|shout|yell|message|announce|announces|pop ?up|notify|write|show (?:the |their )?(?:score|points))\b/, (t) => {
    let text = quoted(t);
    if (!text && /\b(?:show|say|display) (?:the |their )?(?:score|points)\b/.test(t)) text = '⭐ Score: {points}';
    if (!text) { const m = t.match(/\b(?:say|says|shout|yell|announce|announces|display|displays|print|write|notify|tell (?:them|the player|him|her|everyone)|show (?:a |the )?(?:message|text|note|popup)(?: saying| that says| with)?)\s*:?\s*(?:that\s+)?(.+)$/); text = m ? origText(m[1]) : 'Hello!'; }
    return { do: 'message', text: text.slice(0, 120) };
  }),
  A('animation', /\b(play (?:the |an |a )?(?:animation|anim)|dance|dances|wave|waves|animate)\b/, (t) => ({ do: 'animation', name: quoted(t) || findTarget(t) || (t.match(/(?:animation|anim) (?:called |named )?([a-z][\w-]*)/) || [])[1] || (/\bdance/.test(t) ? 'Dance' : 'Wave'), loop: /\b(forever|loop|repeat|keep)\b/.test(t) })),
  A('light', /\b(lights? (?:on|off)|turn (?:on|off) (?:the |a )?(?:light|lamp|lights)|(?:turn|switch) (?:the |a )?(?:light|lamp|lights)(?: @p\d+| called @p\d+)? (?:on|off)|(?:light|lamp) that turns? (?:on|off)|switch (?:on|off)|turn @p\d+ (?:on|off)|turn (?:on|off) @p\d+|become a (?:light|lamp)|make (?:it|this) (?:a )?(?:light|lamp)|light up|lights up|emit light|shine|shines)\b/, (t) => ({ do: 'light', on: !/\boff\b/.test(t), color: findColor(t), target: findTarget(t) })),
  A('fade', /\bfade(?:s)? (?:out|away)\b|\bfade(?:s)? in\b/, (t) => /\bfade(?:s)? in\b/.test(t)
    ? [{ do: 'show', target: findTarget(t) }, { do: 'transparency', value: 0, seconds: secsIn(t, 1), target: findTarget(t) }]
    : [{ do: 'transparency', value: 1, seconds: secsIn(t, 1), target: findTarget(t) }, { do: 'wait', seconds: secsIn(t, 1) }, { do: 'hide', target: findTarget(t) }]),
  A('fall', /\b(fall|falls|falling|drop down|unanchor|unanchors|collapse|collapses|crumble|crumbles)\b/, (t) => ({ do: 'fall', seconds: /\b(come back|comes back|respawn|reappear|return)\b/.test(t) ? secsIn(t, 3) : 0, target: findTarget(t) })),
  A('hide', /\b(disappear|disappears|vanish|vanishes|go(?:es)? away|poof|hide|hides|break|breaks|shatter|shatters|destroy (?:it|itself|this)|delete (?:it|itself|this)|remove (?:it|itself|this)|despawn)\b/, (t) => {
    const back = /\b(come back|comes back|reappear|reappears|return|returns|respawn)\b/.test(t);
    const forM = t.match(re(`for\\s+${SEC}`));
    return { do: 'hide', seconds: forM ? num(forM[1], 3) : (back ? secsIn(t, 3) : null), target: findTarget(t) };
  }),
  A('show', /\b(appear|appears|reappear|reappears|come back|comes back|show up|shows up|become visible|unhide|show (?:it|itself|this|@p\d+))\b/, (t) => ({ do: 'show', target: findTarget(t) })),
  A('transparency', /\b(see[- ]through|transparent|transparency|ghostly|glassy|invisible|opaque|visible again)\b/, (t) => {
    let v = 0.6; const pc = t.match(re(`${N}%`)); const dec = t.match(re(`transparency (?:to |of )?${N}`));
    if (pc) v = +pc[1] / 100; else if (dec) v = +dec[1] > 1 ? +dec[1] / 100 : +dec[1]; else if (/\binvisible\b/.test(t)) v = 1; else if (/\b(opaque|visible again|not transparent)\b/.test(t)) v = 0;
    return { do: 'transparency', value: Math.max(0, Math.min(1, v)), seconds: /\b(slowly|gradually|over|smoothly|fade)\b/.test(t) ? secsIn(t, 1.5) : 0, target: findTarget(t) };
  }),
  A('collide', /\b(walk through|pass through|go through|can'?t be touched|no collision|not solid|non-?solid|can ?collide|become solid|solid again|make (?:it|this) solid|ghost)\b/, (t) => ({ do: 'collide', value: /\b(become solid|solid again|make (?:it|this) solid)\b/.test(t) || (/\bcan ?collide\b/.test(t) && !/\b(off|false|no|not)\b/.test(t)), target: findTarget(t) })),
  A('glow', /\b(glow|glows|glowing|neon)\b/, (t) => ({ do: 'glow', color: findColor(t), target: findTarget(t) })),
  A('color', /\b(turn|turns|change|changes|become|becomes|paint|paints|colou?r|make (?:it|this)|go|goes|flash|flashes|blink|blinks|fade|fades|tween|tweens)\b/, (t) => {
    const cs = findColors(t);
    const seconds = /\b(slowly|gradually|fade|fades|over|smoothly|tween)\b/.test(t) ? secsIn(t, 1.5) : 0;
    if (cs.length >= 2 && /\bor\b/.test(t)) return { do: 'color', choices: cs, seconds, target: findTarget(t) };
    const c = findColor(t);
    if (c) return { do: 'color', color: c, seconds, target: findTarget(t) };
    if (/\bcolou?r/.test(t)) return { do: 'color', color: 'random', seconds, target: findTarget(t) };
    return null;
  }),
  A('stop', /\b(stop|stops|freeze|freezes|pause|pauses)\b/, (t) => ({ do: 'stop', target: findTarget(t) })),
  A('resume', /\b(resume|resumes|start (?:spinning|moving) again|keep going|continue)\b/, (t) => ({ do: 'resume', target: findTarget(t) })),
];
function pointsAction(t) {
  const neg = /\b(lose|loses|take away|takes away|subtract|remove|minus|deduct|lower|decrease)\b/.test(t) || /-\d/.test(t);
  const rng = t.match(re(`(?:between|from) ${N} (?:and|&|to) ${N}`));
  if (rng) return { do: 'points', min: Math.min(+rng[1], +rng[2]), max: Math.max(+rng[1], +rng[2]), amount: 0 };
  if (/\bdouble\b/.test(t)) return { do: 'multVar', name: 'points', factor: 2 };
  const m = t.match(re(`[+]?${N}\\s+(?:extra |more |bonus )?(?:points?|score)`)) || t.match(re(`(?:points?|score)\\s+(?:by\\s+)?${N}`));
  return { do: 'points', amount: (neg ? -1 : 1) * Math.abs(num(m?.[1], 1)) };
}
function elevatorActions(t) {
  const clean = t.replace(/\b(elevator|lift)\b/g, ' ');
  const off = offsetOf(clean, 12);
  const stay = num((t.match(re(`(?:wait|waits|stay|stays|pause|pauses)\\s+(?:at the top\\s+)?(?:for\\s+)?${SEC}`)) || [])[1], 2);
  const travel = secsIn(t.replace(re(`(?:wait|waits|stay|stays|pause|pauses)\\s+(?:at the top\\s+)?(?:for\\s+)?${SEC}`), ''), 3);
  return [{ do: 'moveBy', offset: off, seconds: travel }, { do: 'wait', seconds: stay }, { do: 'return', seconds: travel }];
}

// ---------- motion ----------
function spinOf(t) {
  let speed = 90; if (/\b(slow|slowly|gently|lazily)\b/.test(t)) speed = 35; if (/\b(fast|quickly|rapidly|quick)\b/.test(t)) speed = 240; if (/(really|super|very|crazy) fast/.test(t)) speed = 480;
  const d = t.match(re(`${N}\\s*degrees?`)); if (d) speed = +d[1];
  const r = t.match(re(`${N}\\s*(?:times|spins|rotations|turns|revolutions)\\s*(?:a|per|every|each)\\s*second`)); if (r) speed = +r[1] * 360;
  const rpm = t.match(re(`${N}\\s*(?:rpm|times a minute|times per minute)`)); if (rpm) speed = +rpm[1] * 6;
  let axis = 'y'; if (/\b(sideways|like a wheel|on its side|roll|rolls|rolling)\b/.test(t)) axis = 'z'; if (/\b(flip|flips|forward|forwards|tumble|tumbles|somersault)\b/.test(t)) axis = 'x';
  if (/\b(?:x axis|around x)\b/.test(t)) axis = 'x'; if (/\b(?:z axis|around z)\b/.test(t)) axis = 'z'; if (/\b(?:y axis|around y)\b/.test(t)) axis = 'y';
  if (/\b(backwards|counter|anti|reverse|other way)\b/.test(t)) speed = -speed;
  return { speed, axis };
}
const SPIN_RE = /\b(spin|spins|spinning|rotate|rotates|rotating|turn(?:s|ing)? around|twirl|twirls|revolve|revolves|whirl|whirls|roll|rolls|rolling)\b/;
/** Clause in a triggered rule that describes motion: "move up 10 studs over 2 seconds" etc. */
function motionAction(c) {
  if (/\b(fall|falls|disappear|disappears|vanish|vanishes|hide|hides|break|breaks|collapse|crumble)\b/.test(c)) return null;
  if (SPIN_RE.test(c)) { const s = spinOf(c); return { do: 'spin', axis: s.axis, speed: s.speed, seconds: /\b(forever|keep|always)\b/.test(c) ? 0 : secsIn(c, 0) }; }
  if (/\b(go|goes|move|moves|slide|slides|come|comes|fly|flies)\b.*\bback\b(?!wards)|^(?:return|returns)\b/.test(c) && !/@p|pt\d/.test(c)) return { do: 'return', seconds: secsIn(c, 1) };
  const to = c.match(/\b(?:move|moves|go|goes|slide|slides|fly|flies|travel|travels)\s+(?:over\s+)?to\s+(?:the\s+)?(@p\d+|pt\d+)/);
  if (to) return { do: 'moveTo', to: pointOf(to[1]), seconds: secsIn(c, 1) };
  if (/\b(move|moves|go|goes|slide|slides|rise|rises|sink|sinks|lift|lifts|raise|raises|lower|lowers|fly|flies|float|floats|travel|travels|shift|shifts)\b/.test(c) && /\b(up|down|left|right|forwards?|backwards?|ahead|higher|lower|rise|rises|sink|sinks|north|south|east|west)\b|\d+ studs/.test(c)) {
    const t2 = c.replace(/\b(rise|rises|raise|raises|lift|lifts)\b/, 'up').replace(/\b(sink|sinks)\b/, 'down');
    return { do: 'moveBy', offset: offsetOf(t2, 5), seconds: secsIn(c, 1), target: findTarget(c) };
  }
  return null;
}
/** Continuous (always-on) behaviour in one clause, or null. */
function continuousOf(c) {
  if (SPIN_RE.test(c)) return { type: 'spin', ...spinOf(c) };
  const between = c.match(/\bbetween\s+(.+?)\s+&\s+(.+?)(?=$|\s+(?:every|each|in|over|taking|pausing|waiting)\b)/) || c.match(/\bfrom\s+(@p\d+|pt\d+|here|its start)\s+to\s+(@p\d+|pt\d+)/);
  const toBack = c.match(/\bto\s+(?:the\s+)?(@p\d+|pt\d+)\s+&\s+back\b/);
  if (between || toBack) {
    const pts = between ? [pointOf(between[1]), pointOf(between[2])] : ['self', pointOf(toBack[1])];
    if (pts.every(Boolean)) return { type: 'path', points: pts, period: num((c.match(re(`(?:every|each|in|over|taking)\\s+${SEC}`)) || [])[1], 3), pause: num((c.match(re(`(?:pausing|waiting|stopping)\\s+(?:for\\s+)?${SEC}`)) || [])[1], 0.5) };
  }
  if (/\b(move|moves|moving|go(?:es)?|slide|slides|sliding|float|floats|floating|bob|bobs|bobbing|hover|hovers|hovering|patrol|patrols|swing|swings|sway|sways|oscillate|oscillates)\b/.test(c) && !/\bmove (?:them|the player)\b/.test(c)) {
    let axis = 'y';
    if (/\b(back_and_forth|forward_and_back(?:ward)?|forwards?|backwards?)\b/.test(c)) axis = 'z';
    if (/\b(left_and_right|side-to-side|sideways|left|right)\b/.test(c)) axis = 'x';
    if (/\b(up_and_down|up|down|float|floats|bob|bobs|hover|hovers)\b/.test(c)) axis = 'y';
    const d = c.match(re(`${N} studs`));
    let distance = num(d?.[1], /float|bob|hover/.test(c) ? 1 : 5);
    if (/\bdown\b/.test(c) && !/\bup\b/.test(c)) distance = -distance;
    const p = c.match(re(`(?:every|each|over|in|taking)\\s+${SEC}`));
    let period = num(p?.[1], /float|bob|hover/.test(c) ? 2 : 3);
    if (/\b(slow|slowly)\b/.test(c)) period *= 1.8; if (/\b(fast|quickly)\b/.test(c)) period *= 0.5;
    return { type: 'move', axis, distance, period };
  }
  return null;
}

const FILLER = /^(?:(?:please|also|just|then|and|so|ok|okay|now)\s+|(?:it|this(?: \w+)?|the \w+) (?:should|will|must|can|shall|is going to|has to)\s+|make it so (?:that )?|i want (?:it |this )?to\s+|i want\s+|let'?s\s+|can you\s+|have it\s+|let it\s+)+/;
function parseClause(c) {
  c = c.replace(FILLER, '').trim();
  if (!c || /^(?:it|this|them|forever|always|slowly|please|ok|okay|now|too|again)$/.test(c)) return [];
  for (const a of ACTIONS) if (a.test.test(c)) { const act = a.make(c); if (act) return Array.isArray(act) ? act : [act]; }
  return null;
}
function origText(s) {
  const t = s.replace(/"q(\d+)"/g, (_, i) => Q[+i]).replace(/@p(\d+)/g, (_, i) => P[+i]).replace(/pt(\d+)/g, (_, i) => C[+i].join(', '));
  const i = RAW.toLowerCase().indexOf(t.toLowerCase());
  return (i >= 0 ? RAW.slice(i, i + t.length) : t).trim();
}

// ---------- triggers & conditions ----------
const TRIGGERS = [
  { type: 'countdownEnd', re: /\b(?:when|once|after|if) (?:the )?(?:countdown|timer|time|clock) (?:ends|finishes|is over|runs out|is up|hits 0|reaches 0)\b|\bwhen time(?:'s| is)? (?:up|over|runs out)\b/ },
  { type: 'death', re: re(`\\b${WHEN} ${PL} (?:dies|die|died|respawns|respawn|resets|falls off|gets killed)\\b`) },
  { type: 'reach', re: re(`\\b(?:when|once|as soon as) (?:the |their |his |her )?(score|points|coins|health|counter|touches|clicks|kills|[a-z]+) (?:reaches|reach|hits|gets to|is at least|goes above|goes over|drops to|drops below|falls below|is below)\\s+${N}`), make: (m) => ({ var: varName(m[1]), op: /below|drops to|falls/.test(m[0]) ? '<=' : '>=', value: +m[2] }) },
  { type: 'reach', re: re(`\\b(?:when|once|as soon as) ${PL} (?:has|have|gets?|got|reaches|reach|collects?|earns?|scores?) ${N} (points?|coins?|kills?|[a-z]+)`), make: (m) => ({ var: varName(m[2]), op: '>=', value: +m[1] }) },
  { type: 'enter', re: re(`\\b${WHEN}\\s+(?:${PL}\\s+)?(?:entered|enters?\\b|walks? into|steps? into|goes? into|comes? into|is inside|gets? inside|walks? in(?:to)?)\\s*(?:${OBJ})?`) },
  { type: 'leave', re: re(`\\b${WHEN}\\s+(?:${PL}\\s+)?(?:leaves?\\b|left\\b|exited|exits?\\b|walks? out of|steps? off(?: of)?|gets? off(?: of)?|goes? out of|walks? away from)\\s*(?:${OBJ})?`) },
  { type: 'click', re: re(`\\b${WHEN}\\s+(?:${PL}\\s+)?(?:clicked|clicks?|tapped|taps?)\\b(?:\\s+on)?\\s*(?:${OBJ})?|\\b${WHEN}\\s+(?:${OBJ}\\s+)?(?:is\\s+|gets\\s+)?(?:clicked|tapped)(?:\\s+(?:on|by ${PL}))?|\\bon click\\b`) },
  { type: 'press', re: re(`\\b${WHEN}\\s+(?:${PL}\\s+)?(?:pressed|press(?:es)?|pushed|push(?:es)?|activated|activates?)\\b\\s*(?:${OBJ})?|\\b${WHEN}\\s+(?:${OBJ}\\s+)?(?:is\\s+|gets\\s+)?(?:pressed|pushed|activated)(?:\\s+by ${PL})?`) },
  { type: 'touch', re: re(`\\b${WHEN}\\s+(?:${PL}\\s+)?(?:touch(?:es|ed)?\\b|steps? on|stepped on|stands? on|stood on|walks? (?:on|over)|lands? on|hits?|bumps? into|runs? into|collides? with|jumps? on|comes? in contact with)\\s*(?:${OBJ})?|\\b${WHEN}\\s+(?:${OBJ}\\s+)?(?:is\\s+|gets\\s+)?(?:touched|stepped on|hit|bumped(?: into)?|landed on|stood on|walked on)(?:\\s+by ${PL})?|\\b(?:on touch|on contact|upon contact|touching (?:it|this))\\b`) },
  { type: 'start', re: /\b(?:when (?:the )?(?:game|level|server|round|match|map) (?:starts|begins|loads|is loaded)|at the (?:start|beginning)(?: of the game)?|on start|right away|immediately|at start|when it starts|when it loads|as soon as the game starts|on load)\b/ },
  { type: 'every', re: re(`\\b(?:once )?(?:every|each)\\s+(?:${SEC}|second|other second)\\b`), make: (m) => ({ seconds: m[1] ? +m[1] : (/other/.test(m[0]) ? 2 : 1) }) },
];
const cut = (t, m) => (t.slice(0, m.index) + ' ' + t.slice(m.index + m[0].length)).replace(/^\s*,?\s*/, '').replace(/\s+/g, ' ').trim();
function extractTrigger(t) {
  for (const T of TRIGGERS) {
    const m = t.match(T.re); if (!m) continue;
    const tr = { type: T.type, ...(T.make ? T.make(m) : {}) };
    const part = m[0].match(/@p(\d+)/); if (part && ['touch', 'click', 'press', 'enter', 'leave'].includes(T.type)) tr.part = P[+part[1]];
    return { trigger: tr, rest: cut(t, m) };
  }
  return { trigger: null, rest: t };
}
const IF = '(?:if|only if|but only if|as long as)';
function extractCondition(t) {
  let m = t.match(re(`\\b${IF}\\s+${PL}\\s+(?:has|have|got|owns?|is holding|holds)\\s+(?:the |a )?(speed coil|gravity coil|magic carpet|carpet)\\b`));
  if (m) return { cond: { gear: GEAR_WORDS[m[1]] }, rest: cut(t, m) };
  m = t.match(re(`\\b${IF}\\s+(?:${PL}\\s+)?(?:has|have|got|scored|collected)\\s+(at least |more than |over |less than |fewer than |under |exactly |no more than )?${N}\\s+(points?|score|coins?|health|hp|kills?|[a-z]+)(\\s+or more|\\s+or less)?`));
  if (m) return { cond: { var: varName(m[3]), op: opOf((m[1] || '') + (m[4] || ''), '>='), value: +m[2] }, rest: cut(t, m) };
  m = t.match(re(`\\b${IF}\\s+(?:the |their |his |her )?(score|points|coins|health|hp|kills|[a-z]+)\\s+(?:is|are|=|>=|<=|>|<)\\s*(at least |at most |more than |greater than |over |above |bigger than |higher than |less than |fewer than |under |below |smaller than |lower than |exactly |equal to |not |no more than |no less than )?${N}(\\s+or more|\\s+or less)?`));
  if (m) return { cond: { var: varName(m[1]), op: opOf((m[2] || '') + (m[4] || '') + (m[0].match(/[<>]=?/)?.[0] || ''), '=='), value: +m[3] }, rest: cut(t, m) };
  return { cond: null, rest: t };
}
/** Split a sentence body into clauses joined by and/then/commas/semicolons. */
function clauses(t) {
  return t.split(/\s*(?:,\s*(?:and\s+)?then\b|,\s*and\b|\band then\b|\bafter that\b|\bthen\b|\band\b|,|;)\s*/).map(s => s.trim()).filter(Boolean);
}

// ---------- main entry ----------
const TOUCHY = ['kill', 'damage', 'heal', 'bounce', 'teleport', 'checkpoint', 'points', 'bucks', 'win', 'door', 'speed', 'jump', 'gravity'];
function protect(raw, names) {
  Q = []; P = []; C = []; RAW = raw;
  let t = raw.replace(/["“”]([^"“”]*)["“”]/g, (_, a) => `"q${Q.push(a) - 1}"`);
  t = t.replace(/\b(called|named)\s+"q(\d+)"/gi, (_, w, i) => `${w} @p${P.push(Q[+i]) - 1}`);
  for (const n of names) {
    const esc = n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    t = t.replace(re(`(\\b(?:called|named)\\s+)?(?<![\\w@"])(${esc})(?![\\w"])`, 'gi'), (m, pre, word, off) => {
      const common = COMMON_NAMES.has(n.toLowerCase()) || /^(part|block|sphere|cylinder|wedge|coin|checkpoint|ball)$/i.test(n);
      const capitalized = word === n && /[A-Z]/.test(n) && off > 0 && !/[.!?]\s*$/.test(t.slice(0, off));
      if (!pre && common && !capitalized) return m;
      return `${pre || ''}@p${P.push(n) - 1}`;
    });
  }
  t = t.replace(/\b(called|named)\s+([A-Za-z][\w-]*)/g, (m, w, name) => `${w} @p${P.push(name) - 1}`);
  t = t.toLowerCase()
    .replace(/\bcount (?:how many times|the number of times|the times) (?:it'?s|it is|this is|someone|a player|the player|players) (touch(?:es|ed)?|click(?:s|ed)?|press(?:es|ed)?)\b/g, (m, v) => (v.startsWith('touch') ? 'when touched count touches' : v.startsWith('click') ? 'when clicked count clicks' : 'when pressed count clicks'))
    .replace(/\b(?:the |a )?(?:part|block|brick|door|pad|platform|button|light|lamp|thing|object|one|wall|floor|sign|portal|model|area|zone) (?:called|named) (@p\d+)/g, '$1').replace(/\b(?:called|named) (@p\d+)/g, '$1')
    .replace(/\b(fall|falls|disappear|disappears|vanish|vanishes|hide|hides|break|breaks)\s+(?:and|then)\s+(come back|comes back|reappear|reappears|respawn|respawns|return|returns)\b/g, '$1 to $2');
  t = t.replace(/\(?\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\)?/g, (_, x, y, z) => ` pt${C.push([+x, +y, +z]) - 1} `);
  t = normalizeNumbers(t);
  t = t.replace(/\bx\s*=\s*(-?\d+(?:\.\d+)?)\s*,?\s*y\s*=\s*(-?\d+(?:\.\d+)?)\s*,?\s*z\s*=\s*(-?\d+(?:\.\d+)?)/g, (_, x, y, z) => `pt${C.push([+x, +y, +z]) - 1}`);
  t = t.replace(/\b(up) and (down)\b/g, '$1_and_$2').replace(/\b(back) and (forth)\b/g, '$1_and_$2').replace(/\b(left) and (right)\b/g, '$1_and_$2').replace(/\b(forward) and (back(?:ward)?)\b/g, '$1_and_$2').replace(/\bside to side\b/g, 'side-to-side')
    .replace(/\b(between\s+\S+(?:\s+\S+)?)\s+and\s+/g, '$1 & ').replace(/\b(to\s+(?:the\s+)?(?:@p\d+|pt\d+))\s+and\s+back\b/g, '$1 & back').replace(/\bover and over(?: again)?\b/g, 'forever')
    .replace(/\b(?:between|from) (-?\d+(?:\.\d+)?) and (-?\d+(?:\.\d+)?)\b/g, 'between $1 & $2')
    .replace(/\b(?:the user|a user|the person|a person|somebody|someone|anyone|anybody|the character|your character|the avatar)\b/g, 'the player').replace(/\bplayer's\b/g, 'player')
    .replace(/\s+/g, ' ').trim();
  return t;
}

/**
 * Translate plain words → { program, preview[], unknown[], suggestions[] }.
 * ctx.names: part names in this game, so "open Gate" can refer to a part.
 */
export function translate(text, ctx = {}) {
  const program = { continuous: [], rules: [] };
  const unknown = [];
  const names = [...new Set((ctx.names || []).filter(n => typeof n === 'string' && n.length > 1))].sort((a, b) => b.length - a.length);
  const src = String(text || '').replace(/\r/g, '').slice(0, 4000);
  const sentences = src.split(/(?<=[.!?])\s+|\n+/).map(s => s.trim().replace(/[.!?]+$/, '')).filter(Boolean);
  for (const raw of sentences) {
    const t = protect(raw, names);
    let { trigger: trig, rest } = extractTrigger(t);
    // "move up and down every 2 seconds": the 'every' is the motion's period, not a timer
    if (trig?.type === 'every' && clauses(rest).some(c => continuousOf(c)) && !clauses(rest).some(c => !continuousOf(c) && parseClause(c)?.length)) { trig = null; rest = t; }
    const { cond, rest: rest2 } = extractCondition(rest);
    let body = rest2, elseBody = null;
    const om = body.match(/\s*,?\s*\b(?:otherwise|or else|else|if not)\b\s*,?\s*/);
    if (om) { elseBody = body.slice(om.index + om[0].length); body = body.slice(0, om.index); }
    const ONCE = /\b(only once|just once|one time only|only one time|the first time|first time only)\b/;
    const once = ONCE.test(t) || (/^once\b/.test(raw.toLowerCase()) && !!trig && trig.type !== 'every');
    body = body.replace(new RegExp(ONCE.source, 'g'), ' ');
    let repeat = 1, loop = false;
    const rp = body.match(re(`\\b(?:repeat(?: this| that| it)?\\s+)?${N}\\s+times\\b(?!\\s*(?:as|higher|faster|a second|per|every|a minute))`));
    if (rp) { repeat = Math.min(20, Math.max(1, +rp[1])); body = body.replace(rp[0], ' '); }
    if (/\b(repeat forever|forever|keep (?:doing (?:it|this|that)|repeating)|on repeat|loop|repeat)\b/.test(body) && !SPIN_RE.test(body) && !/\b(move|moves|float|floats|bob|bobs|hover|hovers|slide|slides|patrol|patrols|between)\b/.test(body)) {
      loop = true; body = body.replace(/\b(repeat forever|forever|keep (?:doing (?:it|this|that)|repeating)|on repeat|loop|repeat)\b/g, ' ');
    }
    const triggered = (!!trig && trig.type !== 'start') || !!cond;
    const parseBody = (b, trg) => {
      const acts = [], conts = [];
      for (let c of clauses(b)) {
        c = c.replace(FILLER, '').trim(); if (!c) continue;
        const waitM = c.match(re(`^(?:wait|waits|pause|pauses|delay|hold on|sleep|after)\\s+(?:for\\s+)?${SEC}`)) || c.match(re(`^${SEC}\\s+later`)) || c.match(/^(?:wait|pause)(?: a bit| a moment)?$/);
        if (waitM) { acts.push({ do: 'wait', seconds: num(waitM[1], 1) }); c = c.replace(waitM[0], '').trim(); if (!c) continue; }
        const after = c.match(re(`\\bafter\\s+${SEC}(?:\\s+later)?\\b`)) || c.match(re(`\\b${SEC}\\s+later\\b`));
        if (after && !/\b(come|comes) back\b/.test(c)) { acts.push({ do: 'wait', seconds: num(after[1], 1) }); c = c.replace(after[0], '').trim(); if (!c) continue; }
        if (!/\b(elevator|lift|teleport|teleports|send|bring|take them)\b/.test(c) && !/\b(count ?down|countdown)\b/.test(c)) {
          if (/^(?:stop|stops|freeze|freezes|pause|pauses)\b/.test(c)) { /* handled by the stop action */ }
          else if (trg) { const m = motionAction(c); if (m) { acts.push(m); continue; } }
          else {
            const k = continuousOf(c); if (k) { conts.push(k); continue; }
            const m = motionAction(c);
            if (m?.offset) { const o = m.offset; const axis = o[0] ? 'x' : o[2] ? 'z' : 'y'; conts.push({ type: 'move', axis, distance: o[0] || o[1] || o[2], period: Math.max(0.5, m.seconds || 3) }); continue; }
          }
        }
        const r = parseClause(c);
        if (r) acts.push(...r); else if (c.length > 2) unknown.push(origText(c));
      }
      return { acts, conts };
    };
    const { acts: actions, conts } = parseBody(body, triggered);
    const elseActs = elseBody ? parseBody(elseBody, true).acts : [];
    if (actions.some(a => a.do !== 'wait') || elseActs.length) {
      const list = repeat > 1 ? Array.from({ length: repeat }, () => actions).flat() : actions;
      let tr = trig || { type: 'start' };
      if (!trig && /\bbutton\b/.test(t)) tr = { type: 'press' };
      else if (!trig && (list.some(a => TOUCHY.includes(a.do)) || /\b(teleporter|portal|elevator|lift)\b/.test(t))) tr = { type: 'touch' };
      // "open X ... close it after 4 seconds": the open stays until the close; "it" = the last door
      let lastDoor = null;
      for (const a of list) if (a.do === 'door') { if (a.close) { if (!a.target && lastDoor) a.target = lastDoor.target; if (lastDoor) lastDoor.seconds = 0; } else lastDoor = a; }
      const rule = { trigger: tr, once, actions: list };
      if (loop) rule.loop = true; if (cond) rule.if = cond; if (elseActs.length) rule.else = elseActs;
      program.rules.push(rule);
    }
    if (conts.length) program.continuous.push(...conts);
    if (!actions.length && !conts.length && !elseActs.length && !unknown.length) unknown.push(raw);
  }
  const safe = validateProgram(program);
  return { program: safe, preview: describe(safe), unknown, suggestions: unknown.length ? suggest(unknown) : [] };
}

// ---------- validation (the sandbox boundary) ----------
export const ACTION_TYPES = ['kill', 'damage', 'heal', 'color', 'hide', 'show', 'wait', 'points', 'bucks', 'setVar', 'addVar', 'multVar', 'message', 'sound', 'teleport', 'bounce', 'speed', 'jump', 'gravity', 'transparency', 'collide', 'glow', 'light', 'particles', 'door', 'checkpoint', 'win', 'animation', 'moveBy', 'moveTo', 'return', 'spin', 'stop', 'resume', 'fall', 'spawn', 'countdown', 'timer', 'leaderboard', 'random'];
export const TRIGGER_TYPES = ['start', 'touch', 'click', 'press', 'enter', 'leave', 'every', 'countdownEnd', 'death', 'reach'];
const ALLOWED = new Set(ACTION_TYPES);
const clamp = (v, a, b, d) => (typeof v === 'number' && isFinite(v) ? Math.min(b, Math.max(a, v)) : d);
const vec3 = (v) => Array.isArray(v) && v.length === 3 && v.every(n => typeof n === 'number' && isFinite(n));
const str = (v, n = 60) => (typeof v === 'string' ? v.slice(0, n) : null);
const OPS_OK = ['>=', '<=', '>', '<', '==', '!='];
function cleanAction(a, depth = 0) {
  if (!a || !ALLOWED.has(a.do)) return null;
  const o = { do: a.do };
  for (const [k, v] of Object.entries(a)) {
    if (k === 'do' || k === 'options' || k === 'choices') continue;
    if (typeof v === 'number') o[k] = clamp(v, -5000, 5000, 0);
    else if (typeof v === 'string') o[k] = v.slice(0, 120);
    else if (typeof v === 'boolean' || v === null) o[k] = v;
    else if (vec3(v)) o[k] = v.map(n => clamp(n, -5000, 5000, 0));
  }
  if (o.do === 'random') { if (depth > 1) return null; o.options = (a.options || []).map(x => cleanAction(x, depth + 1)).filter(Boolean).slice(0, 8); if (!o.options.length) return null; }
  if (o.do === 'color' && Array.isArray(a.choices)) o.choices = a.choices.filter(c => typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c)).slice(0, 8);
  if (o.do === 'color' && !o.color && !o.choices?.length) o.color = 'random';
  if (o.do === 'bucks') o.amount = clamp(o.amount, 0, 50, 5);
  if (o.do === 'spawn') o.count = clamp(o.count, 1, 10, 1);
  if (['wait', 'countdown'].includes(o.do)) o.seconds = clamp(o.seconds, 0, 3600, 1);
  if (o.do === 'moveTo' && !o.to) return null;
  if (o.do === 'moveBy' && !o.offset) return null;
  if (o.do === 'teleport' && !(o.to || o.toPart || typeof o.up === 'number')) o.to = 'spawn';
  if (['setVar', 'addVar', 'multVar'].includes(o.do)) o.name = varName(o.name);
  return o;
}
/** Sanitize any program (from the rule parser or an AI model) to the safe subset. */
export function validateProgram(p) {
  const out = { continuous: [], rules: [] };
  for (const c of (p?.continuous || []).slice(0, 6)) {
    if (c?.type === 'spin') out.continuous.push({ type: 'spin', axis: ['x', 'y', 'z'].includes(c.axis) ? c.axis : 'y', speed: clamp(c.speed, -1440, 1440, 90) });
    if (c?.type === 'move') out.continuous.push({ type: 'move', axis: ['x', 'y', 'z'].includes(c.axis) ? c.axis : 'y', distance: clamp(c.distance, -500, 500, 5), period: clamp(c.period, 0.2, 120, 3) });
    if (c?.type === 'path') { const pts = (c.points || []).filter(x => vec3(x) || typeof x === 'string').slice(0, 8).map(x => (typeof x === 'string' ? x.slice(0, 60) : x)); if (pts.length >= 2) out.continuous.push({ type: 'path', points: pts, period: clamp(c.period, 0.2, 120, 3), pause: clamp(c.pause, 0, 60, 0.5) }); }
  }
  for (const r of (p?.rules || []).slice(0, 24)) {
    const type = TRIGGER_TYPES.includes(r?.trigger?.type) ? r.trigger.type : 'touch';
    const tr = { type };
    if (type === 'every') tr.seconds = clamp(r.trigger.seconds, 0.1, 3600, 1);
    if (type === 'reach') { tr.var = varName(r.trigger.var); tr.op = OPS_OK.includes(r.trigger.op) ? r.trigger.op : '>='; tr.value = clamp(r.trigger.value, -1e6, 1e6, 0); }
    if (str(r.trigger?.part)) tr.part = str(r.trigger.part);
    const actions = (r.actions || []).map(a => cleanAction(a)).filter(Boolean).slice(0, 60);
    const elseA = (r.else || []).map(a => cleanAction(a)).filter(Boolean).slice(0, 30);
    if (!actions.length && !elseA.length) continue;
    const rule = { trigger: tr, once: !!r.once, actions };
    if (r.loop) rule.loop = true;
    if (elseA.length) rule.else = elseA;
    if (r.if?.gear && typeof r.if.gear === 'string') rule.if = { gear: r.if.gear.slice(0, 30) };
    else if (r.if && typeof r.if.var === 'string') rule.if = { var: varName(r.if.var), op: OPS_OK.includes(r.if.op) ? r.if.op : '>=', value: clamp(r.if.value, -1e6, 1e6, 0) };
    out.rules.push(rule);
  }
  return out;
}

// ---------- plain-English preview ----------
const secs = (n) => `${n} second${Number(n) === 1 ? '' : 's'}`;
const colorName = (c) => c === 'random' ? 'a random color' : c === 'rainbow' ? 'rainbow colors' : (Object.entries(COLORS).find(([, v]) => v === c)?.[0] || c);
const tgt = (a) => a.target ? `the part named "${a.target}"` : 'this part';
const ptName = (p) => p === 'self' ? 'its starting spot' : (Array.isArray(p) ? `(${p.join(', ')})` : `the part named "${p}"`);
const opWord = { '>=': 'at least', '<=': 'at most', '>': 'more than', '<': 'less than', '==': 'exactly', '!=': 'not' };
const dirWord = (o) => { const [x, y, z] = o; const d = Math.abs(x || y || z); const w = y > 0 ? 'up' : y < 0 ? 'down' : x > 0 ? 'right' : x < 0 ? 'left' : z < 0 ? 'forward' : 'backward'; return `${w} ${d} stud${d === 1 ? '' : 's'}`; };
function sayAction(a) {
  switch (a.do) {
    case 'kill': return 'send the player back to their checkpoint (they "die")';
    case 'damage': return `take ${a.amount} health from the player`;
    case 'heal': return `heal the player by ${a.amount}`;
    case 'color': return `${a.seconds ? 'smoothly ' : ''}turn ${tgt(a)} ${a.choices?.length ? `a random pick of ${a.choices.map(colorName).join(' or ')}` : colorName(a.color)}${a.seconds ? ` over ${secs(a.seconds)}` : ''}`;
    case 'hide': return `make ${tgt(a)} disappear${a.seconds ? ` for ${secs(a.seconds)}` : ''}`;
    case 'show': return `make ${tgt(a)} appear again`;
    case 'wait': return `wait ${secs(a.seconds)}`;
    case 'points': return a.max ? `give the player a random ${a.min}–${a.max} points` : a.amount < 0 ? `take ${-a.amount} point${a.amount === -1 ? '' : 's'} away` : `give the player ${a.amount} point${a.amount === 1 ? '' : 's'}`;
    case 'bucks': return `give the player ${a.amount} Birg Bucks (once per play)`;
    case 'setVar': return `set ${a.name} to ${a.value}`;
    case 'addVar': return a.amount < 0 ? `subtract ${-a.amount} from ${a.name}` : `add ${a.amount} to ${a.name}`;
    case 'multVar': return `multiply ${a.name} by ${a.factor}`;
    case 'message': return `show the message "${a.text}"`;
    case 'sound': return `play a "${a.sound}" sound`;
    case 'teleport': return a.toPart ? `teleport the player to the part named "${a.toPart}"` : a.up ? `teleport the player ${a.up} studs up` : a.to === 'spawn' ? 'teleport the player back to the spawn' : a.to === 'checkpoint' ? 'teleport the player to their last checkpoint' : a.to === 'randomCheckpoint' ? 'teleport the player to a random checkpoint' : `teleport the player to (${a.to.join(', ')})`;
    case 'bounce': return `launch the player into the air (power ${Math.round(a.power)})`;
    case 'speed': return a.mult === 0 ? `freeze the player for ${secs(a.seconds)}` : `make the player ${a.mult < 1 ? 'slower' : 'faster'} (${a.mult}× speed)${a.seconds ? ` for ${secs(a.seconds)}` : ' until they respawn'}`;
    case 'jump': return a.mult === 0 ? `stop the player from jumping for ${secs(a.seconds)}` : `make the player jump ${a.mult < 1 ? 'lower' : 'higher'} (${a.mult}×)${a.seconds ? ` for ${secs(a.seconds)}` : ' until they respawn'}`;
    case 'gravity': return `give the player ${a.mult < 1 ? 'low' : 'high'} gravity${a.seconds ? ` for ${secs(a.seconds)}` : ''}`;
    case 'transparency': return `${a.seconds ? 'fade' : 'make'} ${tgt(a)} ${a.value >= 1 ? 'invisible (still solid)' : a.value <= 0 ? 'fully visible' : `${Math.round(a.value * 100)}% see-through`}${a.seconds ? ` over ${secs(a.seconds)}` : ''}`;
    case 'collide': return a.value ? `make ${tgt(a)} solid again` : `let players walk through ${tgt(a)}`;
    case 'glow': return `make ${tgt(a)} glow${a.color ? ` ${colorName(a.color)}` : ''}`;
    case 'light': return `turn ${a.on ? 'on' : 'off'} the light on ${tgt(a)}${a.color && a.on ? ` (${colorName(a.color)})` : ''}`;
    case 'particles': return `make ${a.kind} come out of ${tgt(a)}`;
    case 'door': return a.close ? `close ${a.target ? `the door named "${a.target}"` : 'this door'}` : `open ${a.target ? `the door named "${a.target}"` : 'like a door'}${a.style === 'slide' ? ' (slides up)' : ''}${a.seconds ? ` for ${secs(a.seconds)}, then close` : ' and keep it open'}`;
    case 'checkpoint': return 'save the player\'s progress here (checkpoint)';
    case 'win': return `tell the player they won ("${a.text}")`;
    case 'animation': return `play the animation "${a.name}"${a.loop ? ' on repeat' : ''}`;
    case 'moveBy': return `move ${tgt(a)} ${dirWord(a.offset)} over ${secs(a.seconds)}`;
    case 'moveTo': return `move ${tgt(a)} to ${ptName(a.to)} over ${secs(a.seconds)}`;
    case 'return': return `move back to its starting spot over ${secs(a.seconds)}`;
    case 'spin': return `start spinning (${Math.abs(a.speed)}°/second)${a.seconds ? ` for ${secs(a.seconds)}` : ''}`;
    case 'stop': return `stop ${tgt(a)} moving/spinning`;
    case 'resume': return `start ${tgt(a)} moving again`;
    case 'fall': return `make ${tgt(a)} fall${a.seconds ? ` and come back after ${secs(a.seconds)}` : ''}`;
    case 'spawn': return `spawn ${a.count > 1 ? a.count + ' ' : 'a '}${a.color ? colorName(a.color) + ' ' : ''}${a.kill ? 'deadly ' : ''}${a.what === 'clone' ? `copy of "${a.target}"` : a.what}${a.count > 1 && a.what !== 'clone' ? 's' : ''}`;
    case 'countdown': return `show a ${a.seconds}-second countdown and wait for it`;
    case 'timer': return a.start ? 'start the on-screen timer' : 'stop the timer';
    case 'leaderboard': return a.show ? 'show the leaderboard (points and other values)' : 'hide the leaderboard';
    case 'random': return `randomly do one of: ${a.options.map(sayAction).join(' OR ')}`;
    default: return a.do;
  }
}
function sayTrigger(r) {
  const on = (what) => r.trigger.part ? `the part named "${r.trigger.part}"` : what;
  const first = r.once ? ' (only the first time)' : '';
  switch (r.trigger.type) {
    case 'touch': return `When a player touches ${on('this part')}${first}`;
    case 'click': return `When a player clicks ${on('this part')}${first}`;
    case 'press': return `When a player presses ${on('this button')} (click or step on it)${first}`;
    case 'enter': return `When a player enters ${on('this area')}${first}`;
    case 'leave': return `When a player leaves ${on('this area')}${first}`;
    case 'every': return `Every ${secs(r.trigger.seconds)}`;
    case 'countdownEnd': return 'When the countdown ends';
    case 'death': return 'When the player dies';
    case 'reach': return `When ${r.trigger.var} becomes ${opWord[r.trigger.op]} ${r.trigger.value}`;
    default: return 'When the game starts';
  }
}
export function describe(program) {
  const lines = [];
  for (const c of program.continuous || []) {
    if (c.type === 'spin') lines.push(`Spins ${Math.abs(c.speed) < 60 ? 'slowly' : Math.abs(c.speed) > 200 ? 'fast' : ''} forever around the ${c.axis.toUpperCase()} axis (${Math.abs(c.speed)}°/second${c.speed < 0 ? ', backwards' : ''}).`.replace('  ', ' '));
    if (c.type === 'move') lines.push(`Moves ${c.axis === 'y' ? 'up and down' : c.axis === 'x' ? 'left and right' : 'back and forth'} ${Math.abs(c.distance)} studs, taking ${secs(c.period)} each way, forever.`);
    if (c.type === 'path') lines.push(`Moves between ${c.points.map(ptName).join(' and ')}, taking ${secs(c.period)} each way${c.pause ? ` and pausing ${secs(c.pause)}` : ''}, forever (players can ride it).`);
  }
  for (const r of program.rules || []) {
    const cond = r.if ? (r.if.gear ? `, if the player has the ${r.if.gear.replace(/([A-Z])/g, ' $1').toLowerCase()}` : `, if ${r.if.var} is ${opWord[r.if.op]} ${r.if.value}`) : '';
    lines.push(`${sayTrigger(r)}${cond}: ${r.actions.length ? r.actions.map(sayAction).join(', then ') : 'do nothing'}${r.loop ? ' — and repeat forever' : ''}.${r.else ? ` Otherwise: ${r.else.map(sayAction).join(', then ')}.` : ''}`);
  }
  return lines;
}

// ---------- examples, cheat sheet & suggestions ----------
export const CHEATSHEET = [
  { title: 'Touch & click', items: ['When a player touches this, kill them', 'When touched, give 10 points and play a ding sound', 'When clicked, turn green', 'When the button is pressed, open the door called Gate for 5 seconds', 'When a player enters this area, say "Welcome!"', 'When a player leaves this area, say "Bye!"', 'The first time someone touches this, give them 5 Birg Bucks'] },
  { title: 'Moving & spinning', items: ['Spin slowly forever', 'Spin 2 times a second like a wheel', 'Move up and down 5 studs every 2 seconds', 'Move between 0, 5, 0 and 20, 5, 0 every 4 seconds', 'Move to the part called Goal and back every 3 seconds', 'Act as an elevator going up 20 studs', 'When touched, move up 10 studs over 2 seconds, wait 2 seconds, then go back', 'When touched, wait 1 second then fall and come back after 3 seconds'] },
  { title: 'Players', items: ['When touched, teleport them to the part called Finish', 'When touched, bounce them really high', 'When touched, make them 2 times faster for 5 seconds', 'When touched, make them jump higher for 10 seconds', 'When touched, give them low gravity', 'When touched, take 25 damage', 'When touched, heal them', 'When touched, save their progress', 'When touched, you win'] },
  { title: 'Looks & effects', items: ['Every 2 seconds, turn red or blue at random', 'When touched, slowly fade to purple over 3 seconds', 'When touched, fade out', 'Become 50% transparent', 'When clicked, turn the light on', 'When clicked, turn the light off', 'When touched, make sparkles and play a chime sound', 'When touched, explode and disappear for 3 seconds', 'Glow blue'] },
  { title: 'Score, timers & variables', items: ['When the game starts, show the leaderboard', 'When touched, add 1 to the counter', 'When touched, if the player has 10 points, open the door called Gate, otherwise say "You need 10 points!"', 'When the score reaches 50, say "Halfway there!"', 'When the game starts, start a 60 second countdown', 'When the countdown ends, say "Time is up!"', 'When touched, give a random number of points between 1 and 10'] },
  { title: 'Spawners & more', items: ['Every 3 seconds, drop a red ball', 'Every 5 seconds, spawn a deadly lava ball', 'When clicked, spawn a copy of the part called Crate', 'Every 2 seconds, disappear for 1 second', 'When touched, randomly either teleport them to the spawn or give them 5 points', 'Turn red, wait 1 second, turn blue, wait 1 second, repeat forever'] },
];
export const EXAMPLES = CHEATSHEET.flatMap(c => c.items.slice(0, 2));
export const HELP = 'Try short sentences like: "when touched, kill them", "spin slowly", "move up and down 4 studs", "every 3 seconds turn blue", "when clicked open the door called Gate", "when touched give 5 points and say Nice!". Open 📖 Phrases for more.';

const STOP = new Set(['the', 'a', 'an', 'to', 'it', 'this', 'them', 'and', 'then', 'of', 'for', 'is', 'be', 'make', 'when', 'player', 'players', 'they', 'with', 'on', 'in', 'that', 'my', 'me', 'you', 'i', 'want', 'should', 'will', 'can']);
const KEYWORDS = { explod: 'When touched, explode and disappear for 3 seconds', fly: 'When touched, bounce them really high', jump: 'When touched, make them jump higher for 10 seconds', fast: 'When touched, make them 2 times faster for 5 seconds', quick: 'When touched, make them 2 times faster for 5 seconds', slow: 'When touched, make them slower for 5 seconds', open: 'When touched, open like a door for 3 seconds', door: 'When the button is pressed, open the door called Gate for 5 seconds', gate: 'When the button is pressed, open the door called Gate for 5 seconds', score: 'When touched, give 10 points', money: 'When touched, give them 5 Birg Bucks', rich: 'When touched, give them 5 Birg Bucks', die: 'When a player touches this, kill them', dead: 'When a player touches this, kill them', hurt: 'When touched, take 25 damage', health: 'When touched, heal them', heal: 'When touched, heal them', light: 'When clicked, turn the light on', lamp: 'When clicked, turn the light on', fire: 'When touched, make fire', burn: 'When touched, make fire', music: 'When touched, play a chime sound', sound: 'When touched, play a ding sound', noise: 'When touched, play a ding sound', timer: 'When the game starts, start a 60 second countdown', clock: 'When the game starts, start a 60 second countdown', time: 'When the game starts, start a 60 second countdown', spawn: 'Every 3 seconds, drop a red ball', clone: 'When clicked, spawn a copy of the part called Crate', copy: 'When clicked, spawn a copy of the part called Crate', move: 'Move up and down 5 studs every 2 seconds', platform: 'Move between 0, 5, 0 and 20, 5, 0 every 4 seconds', elevator: 'Act as an elevator going up 20 studs', lift: 'Act as an elevator going up 20 studs', teleport: 'When touched, teleport them to the part called Finish', portal: 'When touched, teleport them to the part called Finish', color: 'When clicked, turn green', colour: 'When clicked, turn green', invisible: 'Become 50% transparent', ghost: 'Become 50% transparent', win: 'When touched, you win', button: 'When the button is pressed, open the door called Gate for 5 seconds', count: 'When touched, add 1 to the counter', leaderboard: 'When the game starts, show the leaderboard', random: 'Every 2 seconds, turn red or blue at random', kill: 'When a player touches this, kill them', freez: 'When touched, make them freeze for 2 seconds', fall: 'When touched, wait 1 second then fall and come back after 3 seconds', sparkl: 'When touched, make sparkles and play a chime sound', spin: 'Spin slowly forever', turn: 'Spin slowly forever', grow: 'When touched, slowly fade to purple over 3 seconds', shrink: 'When touched, fade out', bounc: 'When touched, bounce them really high' };
const stem = (w) => w.replace(/(ing|ed|es|s)$/, '');
const toks = (s) => s.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(w => w && !STOP.has(w)).map(stem);
/** Closest phrasings the translator understands, for text it didn't. */
export function suggest(unknownList, n = 3) {
  const corpus = CHEATSHEET.flatMap(c => c.items);
  const out = new Map();
  for (const u of unknownList) {
    for (const w of u.toLowerCase().split(/[^a-z]+/)) { const k = Object.keys(KEYWORDS).find(k => w.startsWith(k)); if (k && !out.has(KEYWORDS[k])) out.set(KEYWORDS[k], 10 - out.size * 0.01); }
    const ut = new Set(toks(u));
    for (const c of corpus) {
      const ct = new Set(toks(c)); let inter = 0; ut.forEach(w => { if (ct.has(w)) inter++; });
      const score = inter / Math.max(1, Math.min(ut.size, ct.size) + 0.5);
      if (score > 0.25) out.set(c, Math.max(out.get(c) || 0, score));
    }
  }
  const list = [...out.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([c]) => c);
  return list.length ? list : CHEATSHEET.map(c => c.items[0]).slice(0, n);
}
