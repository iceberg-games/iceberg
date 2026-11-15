// Pengu Plaza BIG — album rewards. One-time BB thanks (each grant <= 25 so it fits the server per-call cap for
// unlisted sources) + in-game cosmetic unlocks (camera filters, photo frames, titles) + legendary badges.
import { TARGETS, COUNTED, ALBUM_PAGES, TARGET_BY_ID } from './targets.js';
export const FILTERS = [
  { id: 'none', name: 'Natural', css: '' },
  { id: 'warm', name: 'Cocoa Warm', css: 'sepia(.3) saturate(1.35) hue-rotate(-8deg) brightness(1.05)' },
  { id: 'mono', name: 'Snow Mono', css: 'grayscale(1) contrast(1.18) brightness(1.05)' },
  { id: 'frost', name: 'Frost', css: 'saturate(.75) brightness(1.12) hue-rotate(-12deg) contrast(1.05)' },
  { id: 'aurora', name: 'Aurora', css: 'hue-rotate(38deg) saturate(1.7) contrast(1.05)' },
  { id: 'vintage', name: 'Harbor Vintage', css: 'sepia(.6) contrast(.92) brightness(1.08) saturate(.9)' },
  { id: 'dream', name: 'Crystal Dream', css: 'saturate(1.45) brightness(1.12) contrast(.95) hue-rotate(-20deg)' },
];
export const FRAMES = [
  { id: 'polaroid', name: 'Polaroid', color: '#ffffff' },
  { id: 'postcard', name: 'Postcard', color: '#fff3d6' },
  { id: 'snowflake', name: 'Snowflake', color: '#bfe8ff' },
  { id: 'cozy', name: 'Cozy Knit', color: '#ff7f9e' },
  { id: 'ice', name: 'Carved Ice', color: '#9fe6ff' },
  { id: 'film', name: 'Film Strip', color: '#1b1d26' },
  { id: 'gold', name: 'Golden', color: '#ffd76a' },
];
export const TITLES = ['Tourist', 'Plaza Regular', 'Shutterbug', 'Snap Scout', 'Photo Ranger', 'Wildlife Pro', 'Legend Hunter', 'Social Butterfly', 'Master Photographer'];
const AREA_UNLOCK = { plaza: { title: 'Plaza Regular' }, ridge: { filter: 'aurora' }, harbor: { filter: 'vintage' }, grotto: { filter: 'dream' }, woods: { frame: 'snowflake' }, village: { frame: 'cozy' }, garden: { frame: 'ice' } };
const has = (s, id) => !!s.album[id];
const count = (s) => COUNTED.filter(t => has(s, t.id)).length;
const threeStars = (s) => Object.values(s.album).filter(v => v[1] >= 3).length;
export const areaDone = (s, area) => { const ts = TARGETS.filter(t => t.area === area && t.kind !== 'social'); return { got: ts.filter(t => has(s, t.id)).length, total: ts.length }; };
export const totals = (s) => ({ got: count(s), total: COUNTED.length, pct: Math.floor(100 * count(s) / COUNTED.length), stars3: threeStars(s), legend: TARGETS.filter(t => t.rarity === 'legendary' && has(s, t.id)).length });
const POSTCARD_IDS = ['fountain', 'arch', 'iceberg', 'rink', 'lantern'];
export const REWARDS = [
  { id: 'postcard', icon: '💌', name: 'Plaza Postcard', desc: 'Snap all 5 plaza photo spots', bb: 15, unlock: { frame: 'postcard' }, test: s => POSTCARD_IDS.every(id => has(s, id)) },
  { id: 'first', icon: '📸', name: 'First Snap', desc: 'Take your first album photo', bb: 0, unlock: { filter: 'warm' }, test: s => count(s) >= 1 },
  { id: 'm10', icon: '🥉', name: '10 in the Album', desc: 'Photograph 10 different things', bb: 10, unlock: { title: 'Shutterbug', filter: 'mono' }, test: s => count(s) >= 10 },
  { id: 'm25', icon: '🥈', name: '25 in the Album', desc: 'Photograph 25 different things', bb: 15, unlock: { title: 'Snap Scout', filter: 'frost' }, test: s => count(s) >= 25 },
  { id: 'm40', icon: '🥇', name: '40 in the Album', desc: 'Photograph 40 different things', bb: 25, unlock: { title: 'Photo Ranger' }, test: s => count(s) >= 40 },
  { id: 'm100', icon: '🏆', name: 'Album Complete', desc: 'Fill every page (100%)', bb: 25, unlock: { title: 'Master Photographer', frame: 'gold' }, test: s => count(s) >= COUNTED.length },
  { id: 'stars10', icon: '⭐', name: 'Ten Perfect Shots', desc: 'Get 3 stars on 10 entries', bb: 10, unlock: { frame: 'film' }, test: s => threeStars(s) >= 10 },
  { id: 'wildlife', icon: '🐾', name: 'Wildlife Pro', desc: 'Photograph every animal', bb: 10, unlock: { title: 'Wildlife Pro' }, test: s => TARGETS.filter(t => t.kind === 'wildlife').every(t => has(s, t.id)) },
  { id: 'legend_any', icon: '🌟', name: 'Legend Hunter', desc: 'Capture any legendary moment', bb: 0, unlock: { title: 'Legend Hunter' }, test: s => TARGETS.some(t => t.rarity === 'legendary' && has(s, t.id)) },
  { id: 'social', icon: '🤳', name: 'Social Butterfly', desc: 'Snap a selfie with a friend', bb: 0, unlock: { title: 'Social Butterfly' }, test: s => has(s, 'friends') },
  ...ALBUM_PAGES.map(p => ({ id: 'area_' + p.id, icon: p.icon, name: `${p.name} complete`, desc: `Every entry on the ${p.name} page`, bb: 20, unlock: AREA_UNLOCK[p.id], test: s => { const d = areaDone(s, p.id); return d.got >= d.total; } })),
  ...TARGETS.filter(t => t.rarity === 'legendary').map(t => ({ id: 'badge_' + t.id, icon: '🏅', name: `${t.name} badge`, desc: `Legendary shot: ${t.name}`, bb: 10, badge: true, test: s => has(s, t.id) })),
];
/** Apply newly earned rewards to the save; returns the list just earned (caller pays BB + shows toasts). */
export function checkRewards(save) {
  const out = [];
  if (save.postcard && !save.rewards.includes('postcard')) { save.rewards.push('postcard'); grantUnlock(save, REWARDS[0].unlock); }   // QoL build already paid it
  for (const r of REWARDS) { if (save.rewards.includes(r.id) || !r.test(save)) continue; save.rewards.push(r.id); if (r.id === 'postcard') save.postcard = true; grantUnlock(save, r.unlock); out.push(r); }
  return out;
}
function grantUnlock(save, u) { if (!u) return; if (u.filter && !save.filters.includes(u.filter)) save.filters.push(u.filter); if (u.frame && !save.frames.includes(u.frame)) save.frames.push(u.frame); if (u.title && !save.titles.includes(u.title)) save.titles.push(u.title); }
export const owned = (save, kind, id) => (kind === 'filter' ? id === 'none' || save.filters.includes(id) : kind === 'frame' ? id === 'polaroid' || save.frames.includes(id) : id === 'Tourist' || save.titles.includes(id));
export const unlockLabel = (u) => !u ? '' : [u.filter && `🎞 ${FILTERS.find(f => f.id === u.filter)?.name} filter`, u.frame && `🖼 ${FRAMES.find(f => f.id === u.frame)?.name} frame`, u.title && `🏷 “${u.title}” title`].filter(Boolean).join(' · ');
export { TARGET_BY_ID };
