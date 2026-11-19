// Offline "Something's wrong?" helper for plain-words Studio scripts.
// No network, no model API. Call checkScript() with translator output plus
// part names (and optionally other scripts in the place).

const SPECIAL_TO = new Set(['spawn', 'checkpoint', 'randomCheckpoint', 'self']);

function walkActions(program, fn) {
  const visit = (a) => {
    if (!a || typeof a !== 'object') return;
    fn(a);
    if (a.do === 'random' && Array.isArray(a.options)) a.options.forEach(visit);
  };
  for (const r of program?.rules || []) {
    (r.actions || []).forEach(visit);
    (r.else || []).forEach(visit);
  }
}

function partRefs(program) {
  const refs = [];
  const add = (name, via) => {
    if (typeof name === 'string' && name.trim() && !SPECIAL_TO.has(name)) refs.push({ name, via });
  };
  walkActions(program, (a) => {
    if (a.target) add(a.target, a.do);
    if (a.toPart) add(a.toPart, 'teleport');
    if (typeof a.to === 'string') add(a.to, a.do === 'moveTo' ? 'move' : a.do);
  });
  for (const r of program?.rules || []) if (r.trigger?.part) add(r.trigger.part, 'trigger');
  for (const c of program?.continuous || []) {
    if (c.type === 'path' && Array.isArray(c.points)) {
      for (const pt of c.points) if (typeof pt === 'string') add(pt, 'path');
    }
  }
  return refs;
}

function nameSet(names) {
  return new Set((names || []).filter((n) => typeof n === 'string' && n).map((n) => n.toLowerCase()));
}

function countBucks(program) {
  let n = 0;
  walkActions(program, (a) => { if (a.do === 'bucks') n++; });
  return n;
}

function isEmptyProgram(program) {
  return !program || (!(program.rules || []).length && !(program.continuous || []).length);
}

/**
 * @param {object} opts
 * @param {string} [opts.text]
 * @param {object} [opts.program]
 * @param {string[]} [opts.unknown]
 * @param {string[]} [opts.suggestions]
 * @param {string[]} [opts.names] part names in this place
 * @param {Array<{ text?: string, program?: object, label?: string }>} [opts.placeScripts]
 * @returns {Array<{ severity: 'error'|'warning'|'info', message: string, suggestion?: string }>}
 */
export function checkScript({ text = '', program, unknown = [], suggestions = [], names = [], placeScripts = [] } = {}) {
  const issues = [];
  const trimmed = String(text || '').trim();
  if (!trimmed) {
    issues.push({ severity: 'info', message: 'This script is empty. Type what you want the part to do, or pick a phrase from Ideas.' });
    return issues;
  }

  if (Array.isArray(unknown) && unknown.length) {
    const bits = unknown.map((u) => `"${u}"`).join(', ');
    issues.push({
      severity: 'warning',
      message: `I didn't understand ${bits}.`,
      suggestion: suggestions?.length ? `Try: ${suggestions[0]}` : 'Open 📖 Phrases for examples the translator already knows.',
    });
  }

  if (isEmptyProgram(program)) {
    issues.push({
      severity: 'error',
      message: 'The text is not empty, but no script was produced.',
      suggestion: suggestions?.length ? `Try: ${suggestions[0]}` : 'Try a short sentence like "when touched, kill them" or "spin slowly".',
    });
  }

  const known = nameSet(names);
  const missing = [];
  const seen = new Set();
  for (const { name, via } of partRefs(program)) {
    const key = name.toLowerCase();
    if (known.has(key) || seen.has(key)) continue;
    seen.add(key);
    missing.push({ name, via });
  }
  for (const { name, via } of missing) {
    const hint = names.length ? `Parts in this game: ${names.slice(0, 8).join(', ')}${names.length > 8 ? '…' : ''}.` : 'Add or rename a part to match, or change the name in the script.';
    const what = via === 'teleport' ? 'teleport to' : via === 'door' ? 'open/close' : via === 'trigger' ? 'listen to' : via === 'path' || via === 'move' ? 'move to' : 'use';
    issues.push({
      severity: 'error',
      message: `This script wants to ${what} a part named "${name}", but there is no part with that name in the game.`,
      suggestion: hint,
    });
  }

  const bucksHere = countBucks(program);
  if (bucksHere > 1) {
    issues.push({
      severity: 'warning',
      message: 'This script awards Birg Bucks more than once. Only the first award is paid (once per play).',
      suggestion: 'Keep a single Birg Bucks gift, and use coins or points for repeat rewards.',
    });
  }

  const others = (placeScripts || []).filter((s) => s && s !== program && (s.program || s.text));
  const otherBucks = others.filter((s) => countBucks(s.program) > 0);
  if (bucksHere > 0 && otherBucks.length) {
    const labels = otherBucks.slice(0, 3).map((s) => s.label || 'another script').join(', ');
    issues.push({
      severity: 'warning',
      message: `More than one script in this place awards Birg Bucks (${labels}${otherBucks.length > 3 ? '…' : ''}). Each script can pay at most once per play, but several gifts add up.`,
      suggestion: 'Prefer a single modest Birg Bucks reward. Use coins or points for the rest.',
    });
  }

  return issues;
}

export { partRefs, countBucks, isEmptyProgram };
