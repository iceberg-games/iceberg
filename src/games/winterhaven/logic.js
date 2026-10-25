// Pure Winterhaven quest logic (no THREE / DOM), unit-tested in Node (scripts/winterhaven-unit.mjs).

import { NPCS as ROSTER } from './npcs.js';

/** Dialogue + look for every NPC in the Set Builder's shared roster (npcs.js, ids are stable). */
const LOOK = {
  'frosty-merchant': ['#b8323a', '#2a2f3a', 'Welcome to Winterhaven, traveller! I\'m Frosty Quill. Half the village needs a hand tonight, so I keep a list. Bring me anything you find and I\'ll make sure it gets home.'],
  'maple-stall': ['#2f7fc4', '#f2f6ff', 'Ornaments, mittens, warm socks! Everything in my stall is knitted by Winterhaven grannies.'],
  'oven-mira': ['#f2e6d0', '#ffffff', 'Mmm, smell that? Gingerbread! I just need one more thing for my secret recipe.'],
  'wrap-wren': ['#d94f7a', '#ffd34d', 'Every present under the big tree is wrapped by me. Don\'t peek!'],
  'crier-bole': ['#6b2fa0', '#2a2f3a', 'Hear ye, hear ye! The Winterhaven festival begins! And the carol needs its song sheet back.'],
  'owl-hoot': ['#f6faff', '#f6faff', 'Hoo! Hoo-hoo! (Hoot ruffles its snowy feathers.)'],
  'inn-hearth': ['#8a5a36', '#e2474b', 'Warm beds and hotter soup at the Hearth Inn. Folks say the castle lights flicker when the aurora is out.'],
  'tinker-cog': ['#4a4f5a', '#c98a2b', 'Clang, clang! I mend sleds, skates and lanterns. That castle on the hill? Built from pure ice, no nails.'],
  'lamp-lumen': ['#e0a030', '#7a2a2a', 'I keep the lanterns of Lantern Lane burning. One spark got away tonight!'],
  'kids-pip': ['#3fa06b', '#ff8a2b', 'Snowball fight later? Noll says the outskirts have the best snow!'],
  'courier-swift': ['#2f4f9f', '#ffd34d', 'Parcels for every door in Winterhaven, rain or snow. Mostly snow.'],
  'skate-sela': ['#3a7fd0', '#f2f6ff', 'The lake is like a mirror tonight. Glide with me!'],
  'cocoa-kip': ['#7a4a28', '#f2e6d0', 'Hot cocoa! Marshmallows on top, no extra charge for smiles.'],
  'ice-fisher': ['#2f5f6b', '#c9d6e6', 'Shh, the fish are listening. Been sitting by this hole since breakfast.'],
  'bridge-bryn': ['#5a7fa8', '#2a2f3a', 'This ice bridge has stood a hundred winters. Mind the slippery bit in the middle.'],
  'castle-steward': ['#4a5fa8', '#bfe9ff', 'Welcome to Frostspire Castle. The Snow Queen\'s banner should be flying, but it blew off its pole.'],
  'ice-architect': ['#7fd8ff', '#2a5f9f', 'Every tower of Frostspire was grown from a single snowflake. Ice remembers its shape.'],
  'guard-rim': ['#3a4f8a', '#c9d6e6', 'Halt! ...Oh, you\'re friendly. Carry on, traveller.'],
  'guard-holt': ['#3a4f8a', '#c9d6e6', 'Guard Rim and I have watched this gate for twelve winters. Nothing gets past. Except snow.'],
  'pine-ranger': ['#2f6b45', '#7a4a28', 'Shh! The pines whisper here. Keep your eyes open and you\'ll find all sorts of things.'],
  'wood-cleave': ['#a83a2a', '#2a2f3a', 'Every cabin in Winterhaven is warm thanks to my axe. Want to see me split a log?'],
  'lost-lark': ['#9fa8c9', '#5a3a24', 'Have I been walking in circles? These pines all look the same... at least the lanterns are pretty.'],
  'pine-wisp': ['#bff4ff', '#bff4ff', 'Wooo... the forest dreams of spring, but it loves the snow... wooo...'],
  'portal-keeper': ['#d94f7a', '#f2f6ff', 'Welcome to Frostgate Plaza! Step through the ice arch and the lake turns into a race course.'],
  'pass-guide': ['#c95f2a', '#2a2f3a', 'The pass is steep but the view from the top is worth every step.'],
  'crystal-miner': ['#6b4a2a', '#c9d6e6', 'Glimmer Cave is full of crystals that hum when you tap them. Listen!'],
  'cave-hermit': ['#5a4a6b', '#9a8ab0', 'Few find their way to old Opal. The crystals told me you were coming.'],
  'outskirt-fern': ['#7a9a3a', '#e8c440', 'Winter carrots are the sweetest. They grow right under the snow.'],
  'sled-rio': ['#e2474b', '#2a2f3a', 'Wheee! Best slope in the valley right here. Race you down!'],
  'snow-builder': ['#f2f6ff', '#3f8fd0', 'My snowman is nearly done! He just needs one important thing...'],
  'kids-noll': ['#e8c440', '#3f8fd0', 'Bet I can throw a snowball further than you! Well, I could, if I had my snowballs...'],
  'pup-nimbus': ['#c9d6e6', '#c9d6e6', 'Arf! Arf! (Nimbus wags its fluffy tail and looks at you hopefully.)'],
};
/** id -> NPC (roster position + look). Shop-stall NPCs get a larger talk radius (they stand behind their counters). */
export const NPCS = Object.fromEntries(ROSTER.map(n => { const l = LOOK[n.id] || ['#5a6b8a', '#2a2f3a', `Happy Winterhaven festival!`]; return [n.id, { ...n, coat: l[0], hat: l[1], greet: l[2], talk: n.area === 'market' && /stall|merchant/.test(n.id) ? 8 : undefined, kind: n.id === 'owl-hoot' ? 'owl' : n.id === 'pup-nimbus' ? 'pup' : n.id === 'pine-wisp' ? 'wisp' : 'villager' }]; }));
export const HUB = 'frosty-merchant';

/** quest id -> { giver, pickup ({x,z,kind,label} or null for the minigame), ask, thanks }.
 *  Fetch quests can be accepted and turned in at their giver OR at the hub (Frosty Quill). */
export const FLOW = {
  wh_quest_lantern: { giver: 'lamp-lumen', pickup: { x: 6.5, z: 72, kind: 'spark', label: 'Lantern spark' }, ask: 'A lantern spark blew away up the lane. Bring it back and Lantern Lane will glow again!', thanks: 'The lane is shining again! A Lantern Hat for you.' },
  wh_quest_skate: { giver: 'skate-sela', pickup: { x: 46, z: 3, kind: 'frost', label: 'Frost crystal' }, ask: 'A frost crystal is glittering on the west shore. Fetch it and I\'ll teach you to glide!', thanks: 'It\'s beautiful! Take this Aurora Scarf. It shimmers just like the sky.' },
  wh_quest_pine: { giver: 'pine-ranger', pickup: { x: -125, z: 70, kind: 'cone', label: 'Glowing pinecone' }, ask: 'Deep in the pines, west of here, a pinecone is glowing. Bring it to me?', thanks: 'The whispering cone! Wear this Pine Cloak. The forest will know you.' },
  wh_quest_ranger: { giver: 'pine-ranger', pickup: { x: -60, z: 112, kind: 'map', label: 'Ranger\'s trail map' }, ask: 'I dropped my trail map on the south-east loop, near where Lark keeps getting lost. Can you find it?', thanks: 'My map! You\'re a true ranger. Here is your Pine Ranger Badge.' },
  wh_quest_cave: { giver: 'crystal-miner', pickup: { x: -41, z: 203, kind: 'crystal', label: 'Glimmer crystal' }, ask: 'One crystal rolled deeper into the cave mouth. My back won\'t bend that far. Fetch it?', thanks: 'Ah, it still glimmers! This little Crystal Sprite wants to come with you.' },
  wh_quest_castle: { giver: 'castle-steward', pickup: { x: 0, z: -146, kind: 'banner', label: 'Frostspire banner' }, ask: 'The Queen\'s banner blew into the castle courtyard. Bring it back to me for the festival!', thanks: 'The Frostspire banner! The Queen would want you to have this crown.' },
  wh_quest_frostgate: { giver: 'portal-keeper', pickup: null, ask: 'Brave enough for the Frostgate Run? Step through the ice arch and skate all 8 gates on Mirrorfrost Lake before time runs out.', thanks: 'You beat the Frostgate Run!' },
  wh_quest_snowman: { giver: 'snow-builder', pickup: { x: 6, z: -25, kind: 'carrot', label: 'Carrot nose' }, ask: 'My snowman has no nose! Oven Mira by the market always has spare carrots. Could you get one?', thanks: 'Perfect! He looks so happy. Here, a carrot nose of your own!' },
  wh_quest_bridge: { giver: 'bridge-bryn', pickup: { x: -70, z: -66, kind: 'bell', label: 'Toll bell' }, ask: 'The little toll bell fell off the west bridge, upstream along the creek. Would you fetch it?', thanks: 'Ding! That\'s the sound of a safe crossing. Wear this Ice Bridge Medal.' },
  wh_quest_carol: { giver: 'crier-bole', pickup: { x: 5, z: 96, kind: 'sheet', label: 'Carol song sheet' }, ask: 'The carolers\' song sheet blew down Lantern Lane! Without it, there\'s no festival song.', thanks: 'Now we can sing! Take a Carol Handbell and ring along.' },
  wh_quest_pass: { giver: 'pass-guide', pickup: { x: -10, z: 240, kind: 'flake', label: 'Summit snowflake' }, ask: 'At the very top of Frostbite Pass, a giant snowflake never melts. Bring a piece back to prove you made it.', thanks: 'You climbed the whole pass! These Glacier Goggles are for real mountaineers.' },
  wh_quest_outskirts: { giver: 'kids-noll', pickup: { x: 58, z: 90, kind: 'sack', label: 'Snowball sack' }, ask: 'I left my snowball sack on the slope by Rio\'s sled run. Can you find it?', thanks: 'My snowballs! Here, you can have my spare Snowball Sack!' },
  wh_quest_baker: { giver: 'oven-mira', pickup: { x: -10, z: 38, kind: 'sugar', label: 'Ice sugar jar' }, ask: 'My ice sugar is at the Hearth Inn on Lantern Lane. Hettie keeps it by the door. Could you bring it?', thanks: 'Now the gingerbread will sparkle! A Gingerbread Baker Hat, fresh from the oven.' },
  wh_quest_fisher: { giver: 'ice-fisher', pickup: { x: 112, z: 6, kind: 'lure', label: 'Lost lure' }, ask: 'A big fish ran off with my lucky lure! It surfaced by the far east shore.', thanks: 'My lucky lure! Take this Ice Fishing Rod. May your line never freeze.' },
  wh_quest_courier: { giver: 'courier-swift', pickup: { x: 28, z: 48, kind: 'parcel', label: 'Parcel for Swift' }, ask: 'Fern the farmer has a parcel waiting on the outskirts and I\'m swamped. Pick it up for me?', thanks: 'Delivered! You\'re a natural. This Courier Parcel Satchel is yours.' },
  wh_quest_pup: { giver: 'pup-nimbus', pickup: { x: 14, z: -4, kind: 'ball', label: 'Nimbus\'s snowball toy' }, ask: 'Arf! (Nimbus looks toward the big tree in Town Square. Its toy must be over there!)', thanks: 'Arf arf arf! (Nimbus is overjoyed and decides to follow you everywhere. Wolf Pup Pal unlocked!)' },
};
export const QUEST_ORDER = ['wh_quest_lantern', 'wh_quest_skate', 'wh_quest_pine', 'wh_quest_cave', 'wh_quest_castle', 'wh_quest_frostgate', 'wh_quest_snowman', 'wh_quest_bridge', 'wh_quest_carol', 'wh_quest_pass', 'wh_quest_outskirts', 'wh_quest_baker', 'wh_quest_fisher', 'wh_quest_courier', 'wh_quest_ranger', 'wh_quest_pup'];

/** Display fallback until cosmetics.js has the items (Cosmetics bot's names/icons, cosmetics/winterhaven 6cf9ef8). */
export const FALLBACK_ITEMS = {
  wh_lantern_hat: { name: 'Lantern Hat', icon: '🏮', rarity: 'rare', earnIn: 'Lantern Lane' },
  wh_aurora_scarf: { name: 'Aurora Scarf', icon: '🧣', rarity: 'epic', earnIn: 'Mirrorfrost Lake' },
  wh_pine_cloak: { name: 'Pine Cloak', icon: '🌲', rarity: 'rare', earnIn: 'Whispering Pines' },
  wh_crystal_pet: { name: 'Crystal Sprite', icon: '💎', rarity: 'epic', earnIn: 'Glimmer Cave' },
  wh_frostspire_crown: { name: 'Frostspire Crown', icon: '👑', rarity: 'legendary', earnIn: 'Frostspire Hill' },
  wh_blizzard_back: { name: 'Frostgate Blizzard', icon: '🌨️', rarity: 'epic', earnIn: 'Frostgate Plaza' },
  wh_carrot_nose: { name: 'Snowman Carrot Nose', icon: '🥕', rarity: 'rare', earnIn: 'Snowdrift Outskirts' },
  wh_bridge_badge: { name: 'Ice Bridge Medal', icon: '🏅', rarity: 'rare', earnIn: 'Ice Bridge Creek' },
  wh_carol_bells: { name: 'Carol Handbell', icon: '🔔', rarity: 'epic', earnIn: 'Town Square' },
  wh_pass_goggles: { name: 'Frostbite Pass Glacier Goggles', icon: '🥽', rarity: 'epic', earnIn: 'Frostbite Pass' },
  wh_snowball_sack: { name: 'Snowball Sack', icon: '⚪', rarity: 'rare', earnIn: 'Snowdrift Outskirts' },
  wh_baker_hat: { name: 'Gingerbread Baker Hat', icon: '🧁', rarity: 'rare', earnIn: 'Winter Market' },
  wh_fishing_lure: { name: 'Ice Fishing Rod', icon: '🎣', rarity: 'rare', earnIn: 'Mirrorfrost Lake' },
  wh_parcel_satchel: { name: 'Courier Parcel Satchel', icon: '📦', rarity: 'epic', earnIn: 'Lantern Lane' },
  wh_ranger_badge: { name: 'Pine Ranger Badge', icon: '🛡️', rarity: 'epic', earnIn: 'Whispering Pines' },
  wh_wolf_pup_pal: { name: 'Wolf Pup Pal', icon: '🐺', rarity: 'legendary', earnIn: 'Snowdrift Outskirts' },
};

/** Quest state per quest: 'new' -> 'active' (accepted) -> 'carrying' (item picked up) -> 'done' (turned in). */
export function initialStates(saved = {}) {
  const s = {}; for (const id of QUEST_ORDER) s[id] = ['new', 'active', 'carrying', 'done'].includes(saved[id]) ? saved[id] : 'new'; return s;
}
/** Pure transition. Returns the new state, or the same state if the action is not allowed. */
export function step(state, action) {
  switch (action) {
    case 'accept': return state === 'new' ? 'active' : state;
    case 'pickup': return state === 'active' ? 'carrying' : state;
    case 'turnIn': return state === 'carrying' ? 'done' : state;
    case 'serverDone': return 'done';
    default: return state;
  }
}
/** What an NPC offers right now: first quest to turn in, else to accept, else in progress.
 *  The hub (Frosty Quill) also accepts/turns in every fetch quest (not the Frostgate minigame). */
export function npcOffer(npcId, states) {
  const mine = QUEST_ORDER.filter(id => FLOW[id].giver === npcId || (npcId === HUB && FLOW[id].pickup));
  const turnIn = mine.find(id => states[id] === 'carrying'); if (turnIn) return { kind: 'turnIn', questId: turnIn };
  const own = mine.filter(id => FLOW[id].giver === npcId);
  const fresh = (npcId === HUB ? mine : own).find(id => states[id] === 'new'); if (fresh) return { kind: 'accept', questId: fresh };
  const active = own.find(id => states[id] === 'active'); if (active) return { kind: 'active', questId: active };
  return { kind: 'none', questId: null };
}
/** Pickup check: only the LOCAL player position is passed in, so remote avatars can never collect. */
export function pickupHit(questId, state, pos, radius) {
  const p = FLOW[questId]?.pickup; if (!p || state !== 'active') return false;
  return Math.hypot(pos.x - p.x, pos.z - p.z) <= radius;
}
export const doneCount = (states) => QUEST_ORDER.filter(id => states[id] === 'done').length;

/** Gate ring for the Frostgate Run around Mirrorfrost Lake (ellipse, clockwise), n gates. */
export function runGates(lake, n = 8) {
  const out = [];
  for (let i = 0; i < n; i++) { const a = Math.PI + (i / n) * Math.PI * 2; out.push({ x: lake.x + Math.cos(a) * lake.rx * 0.66, z: lake.z + Math.sin(a) * lake.rz * 0.62, yaw: -a }); }
  return out;
}
export function fmtTime(s) { s = Math.max(0, s); const m = Math.floor(s / 60), r = s - m * 60; return `${m}:${r < 10 ? '0' : ''}${r.toFixed(1)}`; }
export function fmtCountdown(ms) {
  if (!(ms > 0)) return 'ended'; const d = Math.floor(ms / 86400e3), h = Math.floor(ms / 3600e3) % 24, m = Math.floor(ms / 60e3) % 60, s = Math.floor(ms / 1e3) % 60;
  return d ? `${d}d ${h}h ${m}m` : h ? `${h}h ${m}m ${s}s` : `${m}m ${s}s`;
}
/** Emoji for each pickup kind (popups + the floating icon on generic pickups). */
export const PICKUP_ICON = { spark: '🏮', frost: '❄️', cone: '🌲', crystal: '💎', banner: '🚩', map: '🗺️', carrot: '🥕', bell: '🔔', sheet: '🎼', flake: '❄️', sack: '⚪', sugar: '🍯', lure: '🎣', parcel: '📦', ball: '⚽' };
