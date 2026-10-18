// Portal metadata for built-in games that registry.js does not carry (owned by the
// portal/backend, so game files never need edits). publishedAt drives the "Newest" tab.
// Games missing here fall back to the first git commit that added their file
// (scripts/sync-catalog.mjs) on the server, and sort last offline.
// mobile: true = plays fully with the touch joystick + jump + taps (shown in Mobile mode).
// Games without it are hidden from the portal in Mobile mode. Custom/Studio games use their
// own saved `doc.mobile` flag (Studio's "📱 Mobile-playable" checkbox, default on).
export const GAME_META = {
  'giant-rainbow-obby': { publishedAt: '2026-10-17T20:18:51-07:00', mobile: true },  // own touch layout (gro-mobile: big gear/skip/reset buttons)
  'birg-hq':            { publishedAt: '2026-10-16T21:55:48-07:00', mobile: true },  // walk/jump hub, no keyboard-only actions
  'frost-fields':       { publishedAt: '2026-10-16T21:54:06-07:00', mobile: true },  // walk/jump/coins; build mode via taps
  'corner-bakery':      { mobile: true },  // tap buttons for every station action (cbr mobile HUD) + shared joystick
  'rainbow-obby':       { publishedAt: '2026-10-16T22:11:58-07:00', retired: true },  // replaced by Giant Rainbow Obby
};

/** Is this game definition playable in Mobile mode? Built-ins: GAME_META[id].mobile; Studio games: doc.mobile. */
export function isMobilePlayable(def) {
  if (!def) return false;
  if (def.custom || def.doc) return (def.doc ?? def).mobile !== false;
  if (typeof def.mobile === 'boolean') return def.mobile;      // a game may declare it on its own definition
  return GAME_META[def.id]?.mobile === true;
}
