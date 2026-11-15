// Shared-clock world events. Pure functions of T = mp.now()/1000 (+ optional debug offset), so every player in an
// instance sees the same whale breach / shooting star / aurora night / dance party at the same moment, no host needed.
import { EVENTS as E } from './set/areas.js';
const ph = (T, period, offset = 0) => (((T - offset) % period) + period) % period;
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
export function eventState(T) {
  const n = ph(T, E.night.period), ns = E.night.start, ne = ns + E.night.len;
  const night = smooth(ns - 12, ns + 8, n) * (1 - smooth(ne - 8, ne + 12, n));   // 0 dusk .. 1 deep night
  const nightLeft = n >= ns && n < ne ? ne - n : 0, nightIn = n < ns ? ns - n : E.night.period - n + ns;
  const w = ph(T, E.whale.period, E.whale.offset), whale = { active: w < E.whale.len, k: w / E.whale.len, next: E.whale.period - w };
  const s = ph(T, E.shootingStar.period, E.shootingStar.offset), star = { active: s < E.shootingStar.len, k: s / E.shootingStar.len, seed: Math.floor((T - E.shootingStar.offset) / E.shootingStar.period) };
  const d = ph(T, E.danceCrowd.period, E.danceCrowd.offset), dance = { active: d < E.danceCrowd.len, k: d / E.danceCrowd.len, left: E.danceCrowd.len - d, next: E.danceCrowd.period - d };
  const m = ph(T, E.snowman.period), snowman = { k: Math.min(1, m / E.snowman.done), done: m >= E.snowman.done };
  return { night, nightOn: night > 0.6, nightLeft, nightIn, whale, star, dance, snowman };
}
