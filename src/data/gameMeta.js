// Portal metadata for built-in games that registry.js does not carry (owned by the
// portal/backend, so game files never need edits). publishedAt drives the "Newest" tab.
// Games missing here fall back to the first git commit that added their file
// (scripts/sync-catalog.mjs) on the server, and sort last offline.
export const GAME_META = {
  'giant-rainbow-obby': { publishedAt: '2026-10-17T20:18:51-07:00' },
  'birg-hq':            { publishedAt: '2026-10-16T21:55:48-07:00' },
  'frost-fields':       { publishedAt: '2026-10-16T21:54:06-07:00' },
  'rainbow-obby':       { publishedAt: '2026-10-16T22:11:58-07:00', retired: true },  // replaced by Giant Rainbow Obby
};
