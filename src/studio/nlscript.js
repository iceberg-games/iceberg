const secs = (n) => `${n} second${Number(n) === 1 ? '' : 's'}`;
// Plain-words scripting: an offline, rule-based natural-language → behavior
// translator. Creators write e.g. "when a player touches this, kill them" and
// we compile it to a small, sandboxed behavior program (JSON, no eval):
//
// program = {
//   continuous: [ {type:'spin', axis, speed} | {type:'move', axis, distance, period} ],
//   rules: [ { trigger: {type:'start'|'touch'|'every', seconds?}, once?, actions: [Action] } ],
// }
// Action = {do:'kill'|'color'|'hide'|'show'|'wait'|'points'|'bucks'|'message'|'sound'|'teleport'|
//               'bounce'|'speed'|'gravity'|'transparency'|'collide'|'glow'|'door'|'checkpoint'|'win'|'animation',
//           target?: partName, ...params}
//
// Anything a real AI model returns must pass validateProgram() before it runs,
// so the sandbox stays the same whichever translator is used (see ai.js).

export const COLORS = {
  red: '#e2474b', blue: '#3f8fd0', green: '#2f9e6a', yellow: '#f5c542', orange: '#ff8c2a', purple: '#8b6cf0', pink: '#ff7ac8',
  white: '#ffffff', black: '#22262e', gray: '#a3a2a5', grey: '#a3a2a5', brown: '#8a5a34', cyan: '#4dd2ff', gold: '#f2c230',
  silver: '#c9d1d9', lime: '#9be15d', teal: '#2bb5a0', magenta: '#e04fd0', 'ice blue': '#bfe9ff', 'light blue': '#9fd3f5',
  'dark blue': '#1d4f8c', 'dark green': '#1e6b47', rainbow: 'rainbow', random: 'random',
};
const NUMBER_WORDS = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, fifteen: 15, twenty: 20, thirty: 30, fifty: 50, hundred: 100, half: 0.5 };
const SOUNDS = ['beep', 'ding', 'boom', 'explosion', 'chime', 'pop', 'whoosh', 'coin', 'win', 'buzz', 'bell', 'jump', 'click', 'laser'];

function num(str, fallback) {
  if (str == null) return fallback;
  const n = parseFloat(str); if (!isNaN(n)) return n;
  return NUMBER_WORDS[str.trim()] ?? fallback;
}
const NUM = '(\\d+(?:\\.\\d+)?|a|an|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty|thirty|fifty|hundred|half)';
const SECS = `${NUM}\\s*(?:seconds?|secs?|s)\\b`;
const re = (s) => new RegExp(s, 'i');

function findColor(t) {
  const hex = t.match(/#[0-9a-f]{6}\b/i); if (hex) return hex[0];
  const names = Object.keys(COLORS).sort((a, b) => b.length - a.length);
  for (const n of names) if (re(`\\b${n}\\b`).test(t)) return COLORS[n];
  return null;
}
function findTarget(t) {
  const m = t.match(/\b(?:part|block|door|wall|brick|platform|object|thing)?\s*(?:named|called)\s+["']?([\w -]+?)["']?(?=$|[,.]|\s+(?:to|for|after|and|then|disappear|vanish|open|turn|change|become|move|spin|appear))/i)
    || t.match(/\bthe\s+["']([\w -]+)["']/i);
  if (!m) return null;
  const q = m[1].match(/^q(\d+)$/); if (q) return QUOTES[+q[1]];
  return origCase(m[1].trim());
}
let QUOTES = [], RAW = '';
function quoted(t) { const m = t.match(/"q(\d+)"/); if (m) return QUOTES[+m[1]]; const n = t.match(/["“]([^"”]+)["”]/); return n ? n[1] : null; }
const origCase = (name) => { const i = RAW.toLowerCase().indexOf(name.toLowerCase()); return i >= 0 ? RAW.slice(i, i + name.length) : name; };

// ---------- action patterns (order matters: first match per clause wins) ----------
const ACTIONS = [
  { name: 'door', test: /\b(open(s)?|act(s)? (like|as) a door|like a door)\b/, make: (t) => ({ do: 'door', seconds: num((t.match(re(`for\\s+${SECS}`)) || [])[1], 3), target: findTarget(t) }) },
  { name: 'kill', test: /\b(kill|kills|killed|die|dies|dead|reset (them|the player)|respawn|oof|eliminate|lava|deadly|hurt|damage|destroy (them|the player))\b/, make: () => ({ do: 'kill' }) },
  { name: 'win', test: /\b(win|wins|winner|victory|finish(es)? the (game|obby)|beat the (game|level))\b/, make: (t) => ({ do: 'win', text: quoted(t) || 'You win! 🏆' }) },
  { name: 'checkpoint', test: /\b(checkpoint|save (their )?progress|set (their )?spawn)\b/, make: () => ({ do: 'checkpoint' }) },
  { name: 'teleport', test: /\b(teleport|warp|send (them|the player) to|transport)\b/, make: (t) => {
      const c = t.match(/(-?\d+(?:\.\d+)?)\s*,?\s+(-?\d+(?:\.\d+)?)\s*,?\s+(-?\d+(?:\.\d+)?)/) || t.match(/(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/);
      if (c) return { do: 'teleport', to: [+c[1], +c[2], +c[3]] };
      const name = findTarget(t); if (name) return { do: 'teleport', toPart: name };
      return { do: 'teleport', to: 'spawn' };
    } },
  { name: 'bounce', test: /\b(bounce|bounces|launch|launches|fling|trampoline|jump pad|boost (them )?up|throw (them )?(up|into the air)|super jump)\b/, make: (t) => {
      let p = 28; if (/really high|super|very high|huge/.test(t)) p = 55; else if (/\bhigh\b/.test(t)) p = 40; else if (/\b(small|little|low)\b/.test(t)) p = 16;
      const n = t.match(/(?:power|strength|force)\s*(?:of\s*)?(\d+)/) || t.match(/(\d+)\s*studs?\s*(?:high|up)/); if (n) p = Math.min(120, 8 + +n[1] * (/studs/.test(n[0]) ? 2.5 : 1));
      return { do: 'bounce', power: p };
    } },
  { name: 'speed', test: /\b(faster|speed (them )?up|speed boost|run fast|go fast|slow (them )?down|slower)\b/, make: (t) => ({ do: 'speed', mult: /slow/.test(t) ? 0.5 : (/(really|super|very) fast/.test(t) ? 2.5 : 1.8), seconds: num((t.match(re(`for\\s+${SECS}`)) || [])[1], 5) }) },
  { name: 'gravity', test: /\b(low gravity|moon gravity|float(y)? jumps?|less gravity|high gravity|heavy)\b/, make: (t) => ({ do: 'gravity', mult: /high|heavy/.test(t) ? 1.8 : 0.35, seconds: num((t.match(re(`for\\s+${SECS}`)) || [])[1], 8) }) },
  { name: 'points', test: /\b(points?|score)\b/, make: (t) => ({ do: 'points', amount: num((t.match(re(`${NUM}\\s+(?:points?|score)`)) || [])[1], 1) }) },
  { name: 'bucks', test: /\b(coins?|bucks|birg bucks|bb|money|cash)\b/, make: (t) => ({ do: 'bucks', amount: Math.min(50, num((t.match(re(`${NUM}\\s+(?:coins?|bucks|birg bucks|bb|money|cash)`)) || [])[1], 5)) }) },
  { name: 'sound', test: new RegExp(`\\b(play (a |the )?(\\w+ )?(sound|noise|music)|make (a )?(\\w+ )?(sound|noise)|${SOUNDS.join('|')})\\b`), make: (t) => ({ do: 'sound', sound: SOUNDS.find(s => re(`\\b${s}\\b`).test(t)) || 'ding' }) },
  { name: 'message', test: /\b(say|says|show (a )?(message|text)|display|tell (them|the player)|print|shout|message|announce|pop ?up)\b/, make: (t) => {
      let text = quoted(t);
      if (!text) { const m = t.match(/\b(?:say|says|shout|announce|display|print|tell (?:them|the player)|show (?:a )?(?:message|text)(?: saying| that says)?)\s*:?\s*(.+)$/i); text = m ? m[1].replace(/\b(and|then)\b.*$/, '').trim() : 'Hello!'; }
      return { do: 'message', text: text.slice(0, 120) };
    } },
  { name: 'animation', test: /\b(play (the )?(animation|anim)|dance|wave)\b/, make: (t) => ({ do: 'animation', name: quoted(t) || (t.match(/animation (?:called|named)?\s*([\w-]+)/i) || [])[1] || (/\bdance\b/.test(t) ? 'Dance' : 'Wave'), loop: /\b(forever|loop|repeat)\b/.test(t) }) },
  { name: 'hide', test: /\b(disappear|disappears|vanish|vanishes|go(es)? away|fade( away| out)?|become invisible|turn invisible|hide|hides|break|breaks|destroy (it|itself|this)|delete (it|itself|this)|remove (it|itself))\b/, make: (t) => {
      const forM = t.match(re(`for\\s+${SECS}`)); const back = /\b(come back|reappear|return)\b/.test(t);
      return { do: 'hide', seconds: forM ? num(forM[1], 3) : (back ? 3 : null), target: findTarget(t) };
    } },
  { name: 'show', test: /\b(appear|appears|reappear|come back|comes back|show up|become visible|unhide)\b/, make: (t) => ({ do: 'show', target: findTarget(t) }) },
  { name: 'transparency', test: /\b(see[- ]through|transparent|ghostly|glassy)\b/, make: () => ({ do: 'transparency', value: 0.6 }) },
  { name: 'collide', test: /\b(walk through|pass through|can'?t be touched|no collision|not solid|become solid|solid again)\b/, make: (t) => ({ do: 'collide', value: /become solid|solid again/.test(t) }) },
  { name: 'glow', test: /\b(glow|glows|light up|lights up|shine|neon)\b/, make: (t) => ({ do: 'glow', color: findColor(t) }) },
  { name: 'color', test: /\b(turn|turns|change|changes|become|becomes|paint|color|colour|make (it|this))\b/, make: (t) => { const c = findColor(t); return c ? { do: 'color', color: c, target: findTarget(t) } : (/\bcolou?r/.test(t) ? { do: 'color', color: 'random', target: findTarget(t) } : null); } },
];

// continuous behaviours
function continuous(t) {
  const out = [];
  if (/\b(spin|spins|spinning|rotate|rotates|rotating|turn(s)? around|twirl|twirls|revolve)\b/.test(t)) {
    let speed = 90; if (/\b(slow|slowly|gently)\b/.test(t)) speed = 35; if (/\b(fast|quickly|rapidly)\b/.test(t)) speed = 240; if (/(really|super|very) fast/.test(t)) speed = 480;
    const d = t.match(/(\d+)\s*degrees?/); if (d) speed = +d[1];
    const r = t.match(re(`${NUM}\\s*(?:times|spins|rotations|turns)\\s*(?:a|per|every)\\s*second`)); if (r) speed = num(r[1], 1) * 360;
    let axis = 'y'; if (/\b(sideways|like a wheel|on its side|roll)\b/.test(t)) axis = 'z'; if (/\b(flip|forward|tumble)\b/.test(t)) axis = 'x';
    if (/\b(backwards|counter|anti)/.test(t)) speed = -speed;
    out.push({ type: 'spin', axis, speed });
  }
  const mv = t.match(/\b(move|moves|moving|go(es)?|slide|slides|float|floats|bob|bobs|hover|hovers|patrol|swing)\b/);
  if (mv && !/\bmove (them|the player)\b/.test(t)) {
    let axis = 'y';
    if (/\b(back and forth|forward and back(ward)?|forwards?|backwards?)\b/.test(t)) axis = 'z';
    if (/\b(left and right|side to side|sideways|left|right)\b/.test(t)) axis = 'x';
    if (/\b(up and down|up|down|float|bob|hover)\b/.test(t)) axis = 'y';
    const d = t.match(re(`${NUM}\\s*(?:studs?|blocks?|units?|meters?|feet)`));
    let distance = num(d?.[1], /float|bob|hover/.test(t) ? 1 : 5);
    if (/\bdown\b/.test(t) && !/\bup\b/.test(t)) distance = -distance;
    const p = t.match(re(`(?:every|each|over|in)\\s+${SECS}`));
    let period = num(p?.[1], /float|bob|hover/.test(t) ? 2 : 3);
    if (/\b(slow|slowly)\b/.test(t)) period *= 1.8; if (/\b(fast|quickly)\b/.test(t)) period *= 0.5;
    out.push({ type: 'move', axis, distance, period });
  }
  return out;
}

function trigger(t) {
  if (/\b(when|whenever|if|once)\b.*\b(touch|touches|touched|step|steps|stepped|stand|stands|walk(s)? on|land(s)? on|hit|hits|bump|bumps|collide|press|presses|pressed|click|clicks|clicked|jump(s)? on)\b/.test(t)
    || /\b(on touch|on contact|touching (this|it)|step on (this|it))\b/.test(t)) {
    return { type: 'touch', once: /\b(once|first time|only one time)\b/.test(t) };
  }
  const ev = t.match(re(`\\b(?:every|each)\\s+(?:${SECS}|second)`));
  if (ev) return { type: 'every', seconds: num(ev[1], 1) };
  if (/\b(when the game starts|at the start|on start|when it starts|at start|when the level loads)\b/.test(t)) return { type: 'start' };
  return null;
}

/** Split a sentence into action clauses joined by and/then/commas. */
function clauses(t) {
  return t.split(/\s*(?:,\s*(?:and\s+)?then\b|,\s*and\b|\band then\b|\bthen\b|\band\b|,|;)\s*/i).map(s => s.trim()).filter(Boolean);
}

/** Translate plain words → { program, preview[], unknown[] } */
export function translate(text) {
  const program = { continuous: [], rules: [] };
  const unknown = [];
  const sentences = String(text || '').replace(/\r/g, '').split(/(?<=[.!?])\s+|\n+/).map(s => s.trim().replace(/[.!?]+$/, '')).filter(Boolean);
  for (const raw of sentences) {
    QUOTES = []; RAW = raw;
    const t = raw.replace(/["“]([^"”]*)["”]/g, (_, q) => `"q${QUOTES.push(q) - 1}"`).toLowerCase()
      .replace(/(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/g, '$1 $2 $3');
    const trig = trigger(t);
    const cont = continuous(t);
    // body: strip the trigger phrase
    let body = t.replace(/^(when(ever)?|if|once)\b[^,]*?\b(touch(es|ed)?( it| this| me)?|steps? on( it| this)?|stands? on( it| this)?|walks? on( it| this)?|lands? on( it| this)?|hits?( it| this)?|bumps?( into)?( it| this)?|press(es|ed)?( it| this| the button)?|click(s|ed)?( it| this)?|jumps? on( it| this)?)\b\s*,?\s*/, '')
      .replace(re(`^(every|each)\\s+(${SECS}|second)\\s*,?\\s*`), '').replace(/^(when the game starts|at the start|on start|at start)\s*,?\s*/, '');
    const actions = [];
    let repeat = 1;
    const rp = body.match(re(`repeat\\s+${NUM}\\s+times`)); if (rp) { repeat = Math.min(20, num(rp[1], 1)); body = body.replace(rp[0], ''); }
    body = body.replace(/\b(up) and (down)\b/g, '$1-$2').replace(/\b(back) and (forth)\b/g, '$1-$2').replace(/\b(left) and (right)\b/g, '$1-$2').replace(/\b(forward) and (back(ward)?)\b/g, '$1-$2');
    for (const c of clauses(body)) {
      const waitM = c.match(re(`^(?:wait|after|pause( for)?)\\s+${SECS}`)) || c.match(re(`^${SECS}\\s+later`));
      if (waitM) { actions.push({ do: 'wait', seconds: num(waitM[waitM.length - 1] && isNaN(+waitM[1]) && !NUMBER_WORDS[waitM[1]] ? waitM[2] : waitM[1], 1) }); const rest = c.replace(waitM[0], '').trim(); if (!rest) continue; pushAction(rest); continue; }
      const after = c.match(re(`\\bafter\\s+${SECS}`));
      if (after) { actions.push({ do: 'wait', seconds: num(after[1], 1) }); pushAction(c.replace(after[0], '').trim()); continue; }
      pushAction(c);
    }
    function pushAction(c) {
      if (!c) return;
      if (/\b(spin|rotat|twirl|revolve|move|moving|slide|float|bob|hover|patrol|forever|always)\b/.test(c) && !ACTIONS.slice(0, 3).some(a => a.test.test(c))) return; // handled as continuous
      for (const a of ACTIONS) if (a.test.test(c)) { const act = a.make(c); if (act) { actions.push(act); return; } }
      if (c.length > 2 && !/^(it|this|them|forever|always|slowly|please)$/.test(c)) unknown.push(c);
    }
    if (actions.length && !actions.every(a => a.do === 'wait')) {
      let list = actions; if (repeat > 1) list = Array.from({ length: repeat }, () => actions).flat();
      const tr = trig || ((cont.length && !trig) ? { type: 'start' } : { type: 'start' });
      // "kill" with no explicit trigger usually means "on touch" (e.g. "this is lava, kill players")
      if (!trig && actions.some(a => ['kill', 'bounce', 'teleport', 'checkpoint', 'points', 'bucks', 'win', 'door', 'speed', 'gravity'].includes(a.do))) tr.type = 'touch';
      program.rules.push({ trigger: { type: tr.type, seconds: tr.seconds }, once: !!(trig && trig.once), actions: list });
    }
    if (cont.length) program.continuous.push(...cont);
    if (!actions.length && !cont.length && !unknown.some(u => t.includes(u))) unknown.push(raw);
  }
  return { program: validateProgram(program), preview: describe(program), unknown };
}

const ALLOWED = new Set(['kill', 'color', 'hide', 'show', 'wait', 'points', 'bucks', 'message', 'sound', 'teleport', 'bounce', 'speed', 'gravity', 'transparency', 'collide', 'glow', 'door', 'checkpoint', 'win', 'animation']);
const clamp = (v, a, b, d) => (typeof v === 'number' && isFinite(v) ? Math.min(b, Math.max(a, v)) : d);
/** Sanitize any program (from the rule parser or an AI model) to the safe subset. */
export function validateProgram(p) {
  const out = { continuous: [], rules: [] };
  for (const c of (p?.continuous || []).slice(0, 4)) {
    if (c.type === 'spin') out.continuous.push({ type: 'spin', axis: ['x', 'y', 'z'].includes(c.axis) ? c.axis : 'y', speed: clamp(c.speed, -1440, 1440, 90) });
    if (c.type === 'move') out.continuous.push({ type: 'move', axis: ['x', 'y', 'z'].includes(c.axis) ? c.axis : 'y', distance: clamp(c.distance, -200, 200, 5), period: clamp(c.period, 0.2, 120, 3) });
  }
  for (const r of (p?.rules || []).slice(0, 16)) {
    const type = ['start', 'touch', 'every'].includes(r?.trigger?.type) ? r.trigger.type : 'touch';
    const actions = (r.actions || []).filter(a => a && ALLOWED.has(a.do)).slice(0, 40).map(a => {
      const o = { do: a.do };
      for (const [k, v] of Object.entries(a)) {
        if (k === 'do') continue;
        if (typeof v === 'number') o[k] = clamp(v, -1000, 1000, 0);
        else if (typeof v === 'string') o[k] = v.slice(0, 120);
        else if (typeof v === 'boolean' || v === null) o[k] = v;
        else if (Array.isArray(v) && v.length === 3 && v.every(n => typeof n === 'number')) o[k] = v.map(n => clamp(n, -5000, 5000, 0));
      }
      if (o.do === 'bucks') o.amount = clamp(o.amount, 0, 50, 5);
      return o;
    });
    if (actions.length) out.rules.push({ trigger: { type, seconds: type === 'every' ? clamp(r.trigger.seconds, 0.1, 3600, 1) : undefined }, once: !!r.once, actions });
  }
  return out;
}

// ---------- plain-English preview ----------
const colorName = (c) => c === 'random' ? 'a random color' : c === 'rainbow' ? 'rainbow colors' : (Object.entries(COLORS).find(([, v]) => v === c)?.[0] || c);
const tgt = (a) => a.target ? `the part named "${a.target}"` : 'this part';
function sayAction(a) {
  switch (a.do) {
    case 'kill': return 'send the player back to their checkpoint (they "die")';
    case 'color': return `turn ${tgt(a)} ${colorName(a.color)}`;
    case 'hide': return `make ${tgt(a)} disappear${a.seconds ? ` for ${secs(a.seconds)}` : ''}`;
    case 'show': return `make ${tgt(a)} appear again`;
    case 'wait': return `wait ${a.seconds} second${a.seconds === 1 ? '' : 's'}`;
    case 'points': return `give the player ${a.amount} point${a.amount === 1 ? '' : 's'}`;
    case 'bucks': return `give the player ${a.amount} Birg Bucks (once per play)`;
    case 'message': return `show the message "${a.text}"`;
    case 'sound': return `play a "${a.sound}" sound`;
    case 'teleport': return a.toPart ? `teleport the player to the part named "${a.toPart}"` : (a.to === 'spawn' ? 'teleport the player back to the spawn' : `teleport the player to (${a.to.join(', ')})`);
    case 'bounce': return `launch the player into the air (power ${Math.round(a.power)})`;
    case 'speed': return `make the player ${a.mult < 1 ? 'slower' : 'faster'} for ${secs(a.seconds)}`;
    case 'gravity': return `give the player ${a.mult < 1 ? 'low' : 'high'} gravity for ${secs(a.seconds)}`;
    case 'transparency': return 'make this part see-through';
    case 'collide': return a.value ? 'make this part solid again' : 'let players walk through this part';
    case 'glow': return `make this part glow${a.color ? ` ${colorName(a.color)}` : ''}`;
    case 'door': return `open ${a.target ? `the door named "${a.target}"` : 'like a door'} for ${secs(a.seconds)}, then close`;
    case 'checkpoint': return 'save the player\'s progress here (checkpoint)';
    case 'win': return `tell the player they won ("${a.text}")`;
    case 'animation': return `play the animation "${a.name}"${a.loop ? ' on repeat' : ''}`;
    default: return a.do;
  }
}
export function describe(program) {
  const lines = [];
  for (const c of program.continuous || []) {
    if (c.type === 'spin') lines.push(`Spins ${Math.abs(c.speed) < 60 ? 'slowly' : Math.abs(c.speed) > 200 ? 'fast' : ''} forever around the ${c.axis.toUpperCase()} axis (${Math.abs(c.speed)}°/second${c.speed < 0 ? ', backwards' : ''}).`.replace('  ', ' '));
    if (c.type === 'move') lines.push(`Moves ${c.axis === 'y' ? 'up and down' : c.axis === 'x' ? 'left and right' : 'back and forth'} ${Math.abs(c.distance)} studs, taking ${secs(c.period)} each way, forever.`);
  }
  for (const r of program.rules || []) {
    const when = r.trigger.type === 'touch' ? `When a player touches this part${r.once ? ' (only the first time)' : ''}` : r.trigger.type === 'every' ? `Every ${secs(r.trigger.seconds)}` : 'When the game starts';
    lines.push(`${when}: ${r.actions.map(sayAction).join(', then ')}.`);
  }
  return lines;
}

export const EXAMPLES = [
  'When a player touches this, kill them',
  'Spin slowly forever',
  'Move up and down 5 studs every 2 seconds',
  'When touched give 10 points and play a ding sound',
  'Turn red when touched then disappear after 3 seconds',
  'When touched, bounce them really high',
  'When touched, open like a door for 3 seconds',
  'Every 2 seconds turn a random color',
  'When touched, say "Welcome to my game!"',
  'When touched, make the part named Door disappear for 5 seconds',
  'When touched, teleport them to 0, 20, 0',
  'When touched, you win',
];
export const HELP = 'Try simple sentences like: "when touched, kill them", "spin slowly", "move up and down 4 studs", "every 3 seconds turn blue", "when touched give 5 points and say Nice!".';
