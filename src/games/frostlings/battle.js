// Frostlings battle core — pure logic (no DOM/THREE) so solo, tamer and PvP duels resolve identically.
// A turn takes one action per side, resolves in a fixed order from a seeded RNG, and returns a log
// of events the UI plays back (move, dmg, status, heal, faint...).
import { SPECIES_BY_ID, MOVES, RARITY, typeMult, LEVEL_CAP, MOVES_MAX, BOND_LEVELS } from './config.js';

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export const bondLevel = (pts = 0) => { let l = 0; for (let i = 0; i < BOND_LEVELS.length; i++) if (pts >= BOND_LEVELS[i]) l = i; return l; };
export const xpToNext = (lv) => lv >= LEVEL_CAP ? Infinity : lv * lv * 2 + 14;

export function statsOf(mon) {
  const s = SPECIES_BY_ID[mon.sp], b = s.base, L = mon.lv, k = 1 + bondLevel(mon.bond) * 0.03;
  return {
    hp: Math.floor((Math.floor(2 * b.hp * L / 100) + L + 16) * k),
    atk: Math.floor((Math.floor(2 * b.atk * L / 100) + 5) * k),
    def: Math.floor((Math.floor(2 * b.def * L / 100) + 5) * k),
    spd: Math.floor((Math.floor(2 * b.spd * L / 100) + 5) * k),
  };
}
export function movesAt(spId, lv) {
  const known = [];
  for (const [l, m] of SPECIES_BY_ID[spId].learn) if (l <= lv && !known.includes(m)) known.push(m);
  return known.slice(-MOVES_MAX);
}
export function makeMon(spId, lv, uid = 0) {
  const m = { uid, sp: spId, lv, xp: 0, moves: movesAt(spId, lv), bond: 0, hat: null, status: null };
  m.hp = statsOf(m).hp; return m;
}
/** Runtime combatant (copy of stats; hp/status write back to the mon for the player's side). */
export function combatant(mon, owner) {
  const st = statsOf(mon), sp = SPECIES_BY_ID[mon.sp];
  return { mon, owner, sp: mon.sp, name: sp.name, type: sp.type, lv: mon.lv, maxHp: st.hp, hp: Math.min(st.hp, mon.hp ?? st.hp),
    atk: st.atk, def: st.def, spd: st.spd, moves: [...mon.moves], stages: { atk: 0, def: 0, spd: 0 }, status: mon.status ? { ...mon.status } : null, bondLv: bondLevel(mon.bond), seen: false };
}
const stageMult = (s) => s >= 0 ? (2 + s) / 2 : 2 / (2 - s);
const effSpd = (c) => c.spd * stageMult(c.stages.spd) * (c.status?.id === 'chill' ? 0.5 : 1);

export function damageCalc(a, d, moveId, rng) {
  const mv = MOVES[moveId];
  const eff = typeMult(mv.type, d.type), stab = mv.type === a.type ? 1.25 : 1;
  const crit = rng() < (a.bondLv >= 5 ? 0.12 : 0.06) ? 1.5 : 1;
  const atk = a.atk * stageMult(a.stages.atk) * (a.status?.id === 'burn' ? 0.75 : 1), def = d.def * stageMult(d.stages.def);
  const base = ((2 * a.lv / 5 + 2) * mv.pow * atk / def) / 50 + 2;
  return { dmg: Math.max(1, Math.floor(base * stab * eff * crit * (0.85 + rng() * 0.15))), eff, crit: crit > 1 };
}

export function newBattle(teams, { kind = 'wild', seed = 1 } = {}) {
  return { kind, turn: 0, rng: mulberry32(seed), sides: teams.map(t => ({ team: t, active: t.findIndex(c => c.hp > 0), participants: new Set() })), over: false, winner: -1 };
}
export const active = (b, side) => b.sides[side].team[b.sides[side].active];

/** Simple AI: heal when low, open with a buff sometimes, else best expected damage (with a little noise). */
export function aiChoose(b, side) {
  const me = active(b, side), foe = active(b, 1 - side), r = b.rng;
  const heal = me.moves.find(m => MOVES[m].kind === 'heal');
  if (heal && me.hp / me.maxHp < 0.35 && r() < 0.6) return { kind: 'move', move: heal };
  const buff = me.moves.find(m => MOVES[m].kind === 'buff');
  if (buff && b.turn <= 1 && r() < 0.35) return { kind: 'move', move: buff };
  const sleep = me.moves.find(m => MOVES[m].kind === 'status');
  if (sleep && !foe.status && r() < 0.25) return { kind: 'move', move: sleep };
  let best = me.moves[0], bs = -1;
  for (const m of me.moves) { const mv = MOVES[m]; if (!mv.pow) continue; const sc = mv.pow * (mv.acc / 100) * typeMult(mv.type, foe.type) * (mv.type === me.type ? 1.25 : 1) * (0.75 + r() * 0.5); if (sc > bs) { bs = sc; best = m; } }
  return { kind: 'move', move: best };
}
export function nextAlive(b, side) { return b.sides[side].team.findIndex(c => c.hp > 0); }

function applyStatus(t, id, log, side) {
  if (t.status || t.hp <= 0) return false;
  t.status = { id, turns: id === 'sleep' ? 2 : id === 'chill' ? 3 : 4 };
  log.push({ t: 'status', side, status: id }); return true;
}
function doMove(b, side, moveId, log) {
  const a = active(b, side), foeSide = 1 - side, d = active(b, foeSide), r = b.rng, mv = MOVES[moveId];
  if (a.hp <= 0) return;
  // status gates
  if (a.status?.id === 'sleep') {
    if (a.status.turns-- > 0) { log.push({ t: 'skip', side, why: 'sleep' }); return; }
    a.status = null; log.push({ t: 'wake', side });
  }
  if (a.status?.id === 'chill' && r() < 0.2) { log.push({ t: 'skip', side, why: 'chill' }); return; }
  log.push({ t: 'move', side, move: moveId, name: a.name });
  if (r() * 100 >= mv.acc) { log.push({ t: 'miss', side }); return; }
  if (mv.kind === 'heal') {
    const amt = Math.max(1, Math.round(a.maxHp * mv.heal)); a.hp = Math.min(a.maxHp, a.hp + amt);
    log.push({ t: 'heal', side, amt, hp: a.hp });
    if (mv.selfStatus) { a.status = null; applyStatus(a, mv.selfStatus, log, side); }
    else if (a.status?.id === 'burn') { a.status = null; log.push({ t: 'cure', side }); }
    return;
  }
  if (mv.kind === 'buff') { const s = mv.buff.stat; a.stages[s] = Math.min(4, a.stages[s] + mv.buff.stages); log.push({ t: 'buff', side, stat: s }); return; }
  if (mv.kind === 'status') { if (!applyStatus(d, mv.eff.status, log, foeSide)) log.push({ t: 'fail', side }); return; }
  const { dmg, eff, crit } = damageCalc(a, d, moveId, r);
  d.hp = Math.max(0, d.hp - dmg);
  log.push({ t: 'dmg', side: foeSide, amt: dmg, eff, crit, hp: d.hp, type: mv.type });
  if (d.hp > 0 && mv.eff && r() < mv.eff.chance) applyStatus(d, mv.eff.status, log, foeSide);
  if (d.hp <= 0) log.push({ t: 'faint', side: foeSide, name: d.name });
}

/** Resolve one turn. actions[side] = {kind:'move',move} | {kind:'swap',idx} | {kind:'pass'} (items/snares are applied by the caller first). */
export function resolveTurn(b, actions) {
  const log = []; b.turn++;
  for (const side of [0, 1]) b.sides[side].participants.add(b.sides[side].active);
  // swaps go first
  for (const side of [0, 1]) {
    const a = actions[side];
    if (a?.kind === 'swap' && b.sides[side].team[a.idx]?.hp > 0) { b.sides[side].active = a.idx; b.sides[side].participants.add(a.idx); log.push({ t: 'swap', side, idx: a.idx, name: active(b, side).name }); }
  }
  const movers = [0, 1].filter(s => actions[s]?.kind === 'move');
  movers.sort((x, y) => { const d = effSpd(active(b, y)) - effSpd(active(b, x)); return d !== 0 ? d : (b.rng() < 0.5 ? -1 : 1); });
  for (const side of movers) {
    if (active(b, side).hp <= 0 || active(b, 1 - side).hp <= 0) continue;
    doMove(b, side, actions[side].move, log);
  }
  // end of turn: burn ticks, chill thaws
  for (const side of [0, 1]) {
    const c = active(b, side); if (c.hp <= 0 || !c.status) continue;
    if (c.status.id === 'burn') { const amt = Math.max(1, Math.floor(c.maxHp / 12)); c.hp = Math.max(0, c.hp - amt); log.push({ t: 'burn', side, amt, hp: c.hp }); if (c.hp <= 0) log.push({ t: 'faint', side, name: c.name }); }
    if (c.status && c.status.id !== 'sleep' && --c.status.turns <= 0) { log.push({ t: 'thaw', side, status: c.status.id }); c.status = null; }
  }
  checkOver(b);
  return log;
}
export function checkOver(b) {
  for (const side of [0, 1]) if (b.sides[side].team.every(c => c.hp <= 0)) { b.over = true; b.winner = 1 - side; }
  return b.over;
}

export function catchChance(target, snareMult, berries) {
  const rate = RARITY[SPECIES_BY_ID[target.sp].rarity].rate;
  const p = rate * (1 - 0.72 * target.hp / target.maxHp) * snareMult * (target.status ? 1.4 : 1) * (1 + 0.3 * Math.min(3, berries));
  return Math.max(0.02, Math.min(0.97, p));
}
/** -> number of successful shakes (0..3); 3 = caught */
export function rollCatch(p, rng = Math.random) { const each = Math.pow(p, 1 / 3); let n = 0; while (n < 3 && rng() < each) n++; return n; }
export const xpYield = (c, tamer) => Math.round((10 + c.lv * 7) * RARITY[SPECIES_BY_ID[c.sp].rarity].xp * (tamer ? 1.5 : 1));

/** Add xp to a mon. Returns [{lv, learned:[ids], pending:[ids] (moves needing a forget choice)}] per level gained. */
export function addXp(mon, amt) {
  const out = [];
  if (mon.lv >= LEVEL_CAP) return out;
  mon.xp += amt;
  while (mon.lv < LEVEL_CAP && mon.xp >= xpToNext(mon.lv)) {
    mon.xp -= xpToNext(mon.lv); const before = statsOf(mon); mon.lv++;
    const after = statsOf(mon); mon.hp = Math.min(after.hp, (mon.hp ?? before.hp) + (after.hp - before.hp));
    const ev = { lv: mon.lv, learned: [], pending: [], gain: { hp: after.hp - before.hp, atk: after.atk - before.atk, def: after.def - before.def, spd: after.spd - before.spd } };
    for (const [l, m] of SPECIES_BY_ID[mon.sp].learn) if (l === mon.lv && !mon.moves.includes(m)) { if (mon.moves.length < MOVES_MAX) { mon.moves.push(m); ev.learned.push(m); } else ev.pending.push(m); }
    out.push(ev);
  }
  if (mon.lv >= LEVEL_CAP) mon.xp = 0;
  return out;
}
export function canEvolve(mon) { const s = SPECIES_BY_ID[mon.sp]; return s.evolveTo && mon.lv >= s.evolveAt ? s.evolveTo : null; }
export function evolve(mon) {
  const to = canEvolve(mon); if (!to) return null;
  const hpFrac = mon.hp / statsOf(mon).hp; mon.sp = to;
  const learned = [];
  for (const [l, m] of SPECIES_BY_ID[to].learn) if (l <= mon.lv && !mon.moves.includes(m)) { if (mon.moves.length < MOVES_MAX) { mon.moves.push(m); learned.push(m); } }
  mon.hp = Math.max(1, Math.round(statsOf(mon).hp * hpFrac));
  return { to, learned };
}
