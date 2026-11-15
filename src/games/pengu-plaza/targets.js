// Pengu Plaza BIG — photo target catalog (metadata only; world.js gives each one a live position).
// kind: spot (stand on a ring, Snap auto-aims) · landmark · subject (penguin locals) · wildlife · event (shared-clock
// timers) · secret (hidden) · social (another real player). Rarity drives the album card + sting.
export const RARITY = {
  common: { label: 'Common', color: '#bfe3ff', pts: 1 },
  uncommon: { label: 'Uncommon', color: '#7fffc8', pts: 2 },
  rare: { label: 'Rare', color: '#c79bff', pts: 3 },
  legendary: { label: 'Legendary', color: '#ffd76a', pts: 5 },
};
export const ALBUM_PAGES = [
  { id: 'plaza', name: 'Pengu Plaza', icon: '🐧' },
  { id: 'ridge', name: 'Aurora Ridge', icon: '🌌' },
  { id: 'harbor', name: 'Frozen Harbor', icon: '⚓' },
  { id: 'grotto', name: 'Ice Cave Grotto', icon: '💎' },
  { id: 'woods', name: 'Snowy Pine Woods', icon: '🌲' },
  { id: 'village', name: 'Igloo Village', icon: '🔥' },
  { id: 'garden', name: 'Sculpture Garden', icon: '🗿' },
];
// [id, name, area, rarity, kind, icon, size(m), hint, bonus label]
const T = [
  // ---- Pengu Plaza (hub) ----
  ['fountain', 'Frost Fountain', 'plaza', 'common', 'spot', '⛲', 5, 'Stand on the glowing ring by the fountain.'],
  ['arch', 'Aurora Arch', 'plaza', 'common', 'spot', '🌈', 7, 'The ring just inside the plaza entrance.'],
  ['iceberg', 'Giant Ice Pengu', 'plaza', 'common', 'spot', '🧊', 8, 'A very big, very icy statue.'],
  ['rink', 'Rinkside', 'plaza', 'common', 'spot', '⛸', 4, 'A ring beside the ice rink.'],
  ['lantern', 'Lantern Lane', 'plaza', 'common', 'spot', '🏮', 4, 'Warm lights lead somewhere cozy.'],
  ['bell', 'Plaza Bell', 'plaza', 'common', 'landmark', '🛎️', 3.4, 'Ring it, then snap it mid-swing!', 'Mid-swing!'],
  ['barista', 'Cocoa Barista', 'plaza', 'common', 'subject', '☕', 2, 'The friendliest face in town.'],
  ['skaters', 'Rink Skaters', 'plaza', 'common', 'subject', '⛸', 1.8, 'They never stop gliding.'],
  ['waver', 'Waving Pengu', 'plaza', 'uncommon', 'subject', '👋', 1.8, 'Wave at a local — then catch them waving back.', 'Waving back!'],
  ['dance_crowd', 'Dance Party', 'plaza', 'rare', 'event', '💃', 3, 'Every few minutes the locals start a dance party by the bell.', 'Party time!'],
  ['friends', 'Friend Selfie', 'plaza', 'uncommon', 'social', '🤳', 2, 'Snap another real player. Bonus — not needed for 100%.'],
  // ---- Aurora Ridge ----
  ['summit', 'Summit Lookout', 'ridge', 'common', 'spot', '🔭', 6, 'The ring by the telescope on top of the ridge.'],
  ['lift', 'Sled Lift', 'ridge', 'common', 'landmark', '🚡', 4, 'Ride it, or just admire it.'],
  ['cairn', 'Wishing Cairn', 'ridge', 'common', 'landmark', '🪨', 2.5, 'Stacked stones on the ridge top.'],
  ['snow_angel', 'Snow Angel Pengu', 'ridge', 'uncommon', 'subject', '😇', 1.5, 'Somebody is flapping in the snow up high.', 'Flapping!'],
  ['shooting_star', 'Shooting Star', 'ridge', 'rare', 'event', '🌠', 10, 'Look up. Every minute or so something streaks across the sky.'],
  ['aurora', 'Aurora Curtain', 'ridge', 'legendary', 'event', '🌌', 40, 'Only at night. Face north from somewhere high.'],
  // ---- Frozen Harbor ----
  ['lighthouse', 'Lighthouse', 'harbor', 'common', 'landmark', '🗼', 11, 'Stripy and tall on the rocky point.'],
  ['lighthouse_beam', 'Lighthouse Beam', 'harbor', 'rare', 'event', '🔦', 11, 'The lamp only shines at night.'],
  ['fish_market', 'Fish Market', 'harbor', 'common', 'landmark', '🐟', 3.5, 'Smells… fresh.'],
  ['boats', 'Moored Boats', 'harbor', 'common', 'spot', '⛵', 4, 'A ring on the shore near the pier.'],
  ['fisher', 'Fisher Pengu', 'harbor', 'common', 'subject', '🎣', 1.8, 'At the end of the pier. Catch them catching!', 'Big catch!'],
  ['seal', 'Lazy Seal', 'harbor', 'common', 'wildlife', '🦭', 1.4, 'Lounging on an ice floe.'],
  ['seal_pup', 'Seal Pup', 'harbor', 'uncommon', 'wildlife', '🍼', 0.9, 'A tiny one on a far floe. Zoom in!'],
  ['puffins', 'Puffin Rock', 'harbor', 'uncommon', 'wildlife', '🐦', 1.6, 'Colourful beaks on a rock in the water.'],
  ['whale', 'Whale Breach', 'harbor', 'legendary', 'event', '🐋', 9, 'Watch the open water past the pier. It breaches about once a minute.', 'Peak breach!'],
  // ---- Ice Cave Grotto ----
  ['crystal_heart', 'Crystal Heart', 'grotto', 'uncommon', 'landmark', '💠', 5, 'The glowing centre of the cave.'],
  ['glow_pool', 'Glow Pool', 'grotto', 'common', 'spot', '🫧', 3, 'A ring near the shimmering water.'],
  ['icicle_falls', 'Frozen Falls', 'grotto', 'common', 'spot', '🧊', 7, 'A waterfall that froze mid-splash.'],
  ['moths', 'Glow-moth Swarm', 'grotto', 'uncommon', 'wildlife', '✨', 2.5, 'Little lights drifting in the dark.'],
  ['spelunker', 'Spelunker Pengu', 'grotto', 'common', 'subject', '⛑️', 1.8, 'Has a lamp on their hat.'],
  ['carving', 'Ancient Carving', 'grotto', 'rare', 'secret', '🗿', 3, 'Someone drew on the cave wall long ago…'],
  ['hidden_gem', 'Rainbow Gem', 'grotto', 'rare', 'secret', '🌈', 0.9, 'Tucked behind crystals in a dark corner.'],
  // ---- Snowy Pine Woods ----
  ['bridge', 'Creek Bridge', 'woods', 'common', 'landmark', '🌉', 3, 'Cross the frozen creek south of the plaza.'],
  ['old_pine', 'Grand Old Pine', 'woods', 'common', 'landmark', '🌲', 18, 'The oldest, tallest tree in the woods.'],
  ['hares', 'Snow Hares', 'woods', 'common', 'wildlife', '🐇', 0.8, 'Hop hop hop.'],
  ['fox', 'Arctic Fox', 'woods', 'uncommon', 'wildlife', '🦊', 0.9, 'It pounces into the snow now and then.', 'Pounce!'],
  ['reindeer', 'Reindeer', 'woods', 'uncommon', 'wildlife', '🦌', 2.4, 'Grazing near the edge of the woods.'],
  ['owl', 'Snowy Owl', 'woods', 'rare', 'wildlife', '🦉', 0.9, 'Perched up high. It moves between trees.', 'Head turn!'],
  ['golden_cone', 'Golden Pinecone', 'woods', 'rare', 'secret', '🌰', 0.6, 'Something shiny under a bush deep in the woods.'],
  ['yeti', 'Yeti Glimpse', 'woods', 'legendary', 'secret', '👣', 3.6, 'Follow the big footprints… only at night.'],
  // ---- Igloo Village ----
  ['igloo_row', 'Igloo Street', 'village', 'common', 'spot', '🛖', 4, 'A ring at the start of the igloo street.'],
  ['bonfire', 'Cocoa Bonfire', 'village', 'common', 'landmark', '🔥', 2.5, 'Warm hands, warm hearts.'],
  ['knit_market', 'Knit Market', 'village', 'common', 'landmark', '🧶', 3, 'Scarves in every colour.'],
  ['sledders', 'Sledding Pengus', 'village', 'common', 'subject', '🛷', 1.6, 'Wheee down the hill!', 'Mid-air!'],
  ['choir', 'Penguin Choir', 'village', 'uncommon', 'subject', '🎶', 2, 'Three voices, one honk.'],
  ['snowman', 'Snowman Builder', 'village', 'rare', 'event', '⛄', 2.6, 'Wait until the snowman is finished for the best shot.', 'Finished!'],
  // ---- Sculpture Garden ----
  ['ice_dragon', 'Ice Dragon', 'garden', 'uncommon', 'landmark', '🐉', 6, 'Carved from a single glacier block.'],
  ['ice_whale', 'Whale Sculpture', 'garden', 'common', 'landmark', '🐳', 4, 'A whale that will never breach.'],
  ['ice_castle', 'Ice Castle', 'garden', 'common', 'landmark', '🏰', 7, 'Towers and all.'],
  ['sculptor', 'Sculptor Pengu', 'garden', 'common', 'subject', '🔨', 1.8, 'Chip, chip, chip.', 'Chip!'],
  ['maze_heart', 'Maze Heart', 'garden', 'rare', 'secret', '🌹', 1.2, 'Find the middle of the snow maze.'],
];
export const TARGETS = T.map(([id, name, area, rarity, kind, icon, size, hint, bonus]) => ({ id, name, area, rarity, kind, icon, size, hint, bonus: bonus || null }));
export const TARGET_BY_ID = Object.fromEntries(TARGETS.map(t => [t.id, t]));
/** entries that count toward completion % (social is a bonus page entry) */
export const COUNTED = TARGETS.filter(t => t.kind !== 'social');
export const areaTargets = (area) => TARGETS.filter(t => t.area === area);
export function rarityCounts() { const c = {}; for (const t of TARGETS) c[t.rarity] = (c[t.rarity] || 0) + 1; return c; }
