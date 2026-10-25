import pip from './survivorPip.js';
import nell from './survivorNell.js';
import juno from './survivorJuno.js';
import hullwarden from './killerHullwarden.js';
import kettle from './killerKettle.js';
import whitepeak from './killerWhitepeak.js';

const ALL = [pip, nell, juno, hullwarden, kettle, whitepeak];
const BY_ID = Object.fromEntries(ALL.map(k => [k.id, k]));

export function get(kitId) { return BY_ID[kitId] || null; }
export function list(role) {
  if (!role) return ALL.slice();
  return ALL.filter(k => k.role === role);
}
export function allKits() { return ALL.slice(); }
