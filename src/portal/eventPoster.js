// THE event poster (one place). Iceberg Social Media's art; a new poster = replace the two .webp files
// (same names) or point these imports at new files. Wide on desktop, square (full poster on a blurred
// backdrop, nothing cropped) on phones. Web copies are made from /workspace/iceberg-events/*.jpg
// (wide 1280x720, square 900x900, webp q78).
// Pages build: scripts/build-site.mjs copies src/assets/events/* to <site>/events/ and the popup loads them lazily
// (not inlined into the portal HTML). Single-file/dev builds inline the imports instead.
import wideInline from '../assets/events/natural-disasters-poster.webp';
import squareInline from '../assets/events/natural-disasters-poster-square.webp';

const PAGES = import.meta.env.VITE_ICEBERG_PAGES === '1';
const root = () => (typeof document !== 'undefined' && document.querySelector('meta[name="iceberg-root"]')?.content) || './';
const wide = PAGES ? `${root()}events/natural-disasters-poster.webp` : wideInline;
const square = PAGES ? `${root()}events/natural-disasters-poster-square.webp` : squareInline;

export const EVENT_POSTER = {
  eventId: 'natural_disasters',                 // server game_events.id (quests.eventStatus)
  gameId: 'natural-disaster-survival',          // Play opens this game
  title: 'New Event!',
  blurb: 'A tornado is tearing through Natural Disaster Survival. Survive it and collect limited-time event items before the Hunt ends!',
  alt: 'Tornado Event! New event in Natural Disaster Survival',
  wide, wideSize: [1280, 720],
  square, squareSize: [900, 900],
  phoneQuery: '(max-width: 640px)',
};
