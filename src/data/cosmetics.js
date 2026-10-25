// Cosmetics catalog. On a real backend this would be served by the server
// (prices validated server-side). `slot` = one equipped item per slot.
// `kind`: 'model' attaches a 3D mesh; 'skin'/'shirt' recolor body parts.
export const SLOTS = ['hat', 'face', 'skin', 'shirt', 'neck', 'back', 'hand'];

export const COSMETICS = [
  // Hats
  { id: 'cap',       name: 'Ball Cap',       slot: 'hat',   price: 40,  icon: '🧢', kind: 'model' },
  { id: 'beanie',    name: 'Snow Beanie',    slot: 'hat',   price: 60,  icon: '🎿', kind: 'model', winter: true },
  { id: 'partyhat',  name: 'Party Hat',      slot: 'hat',   price: 80,  icon: '🥳', kind: 'model' },
  { id: 'tophat',    name: 'Top Hat',        slot: 'hat',   price: 150, icon: '🎩', kind: 'model' },
  { id: 'icecrown',  name: 'Ice Crown',      slot: 'hat',   price: 400, icon: '❄️', kind: 'model', winter: true },
  { id: 'crown',     name: 'Golden Crown',   slot: 'hat',   price: 600, icon: '👑', kind: 'model' },
  // Face
  { id: 'shades',    name: 'Cool Shades',    slot: 'face',  price: 90,  icon: '🕶️', kind: 'model' },
  { id: 'goggles',   name: 'Ski Goggles',    slot: 'face',  price: 120, icon: '🥽', kind: 'model', winter: true },
  // Skins
  { id: 'skin_frost',name: 'Frostbite Skin', slot: 'skin',  price: 150, icon: '🥶', kind: 'skin', color: '#9fd8ff', winter: true },
  { id: 'skin_gold', name: 'Golden Skin',    slot: 'skin',  price: 300, icon: '✨', kind: 'skin', color: '#f2c94c' },
  // Shirts
  { id: 'shirt_red', name: 'Red Shirt',      slot: 'shirt', price: 30,  icon: '👕', kind: 'shirt', color: '#d83a3f', pants: '#2b3a55' },
  { id: 'shirt_green',name:'Pine Shirt',     slot: 'shirt', price: 30,  icon: '👕', kind: 'shirt', color: '#2f8f5b', pants: '#3b3b3b' },
  { id: 'parka',     name: 'Arctic Parka',   slot: 'shirt', price: 110, icon: '🧥', kind: 'shirt', color: '#f2f7fb', pants: '#4a6a8a', winter: true },
  // Neck
  { id: 'scarf',     name: 'Cozy Scarf',     slot: 'neck',  price: 70,  icon: '🧣', kind: 'model', winter: true },
  // Back
  { id: 'backpack',  name: 'Backpack',       slot: 'back',  price: 120, icon: '🎒', kind: 'model' },
  { id: 'icewings',  name: 'Ice Wings',      slot: 'back',  price: 450, icon: '🪽', kind: 'model', winter: true },
  // Hand
  { id: 'sword',     name: 'Frost Sword',    slot: 'hand',  price: 200, icon: '🗡️', kind: 'model' },
  { id: 'pickaxe',   name: 'Ice Pickaxe',    slot: 'hand',  price: 140, icon: '⛏️', kind: 'model', winter: true },
];
export const COSMETIC_BY_ID = Object.fromEntries(COSMETICS.map(c => [c.id, c]));

// Premium: the customizable Ice Rocket (jetpack). Hold F to fly while equipped.
COSMETICS.push({
  id: 'icerocket', name: 'Ice Rocket', slot: 'back', price: 100000, icon: '🚀',
  kind: 'model', winter: true, premium: true, customizable: true,
  desc: 'Strap-on rocket with a frost trail. Hold F to fly! Recolor body, fins & trim.',
});
COSMETIC_BY_ID.icerocket = COSMETICS[COSMETICS.length - 1];

// Customizable winter cosmetics. `colorPresets` = [name, hex]; the chosen color
// is stored in profile.cosmeticColors[id] (falls back to defaultColor).
const CUSTOM_COSMETICS = [
  {
    id: 'earmuffs', name: 'Frosty Knit Earmuffs', slot: 'hat', price: 180, icon: '🎧',
    kind: 'model', winter: true, customizable: true, defaultColor: '#7fc8f0',
    colorPresets: [['Icy Blue', '#7fc8f0'], ['Cranberry', '#b3243c'], ['Snow White', '#f4f7fa'], ['Pine Green', '#2f6f4a']],
    desc: 'Hand-knit headband with two fluffy ear puffs and a tiny snowflake charm. Keeps your ears toasty on the iciest builds.',
  },
  {
    id: 'snowglobe_pack', name: 'Snow Globe Backpack', slot: 'back', price: 300, icon: '🔮',
    kind: 'model', winter: true, customizable: true, defaultColor: '#c0392b',
    colorPresets: [['Holly Red', '#c0392b'], ['Frost Blue', '#3f8fd0'], ['Gold Ribbon', '#d4a531'], ['Evergreen', '#2f7a4f']],
    desc: 'A little cabin in the pines, carried everywhere in a glass dome where the snow never stops falling.',
  },
  {
    id: 'cocoa_mug', name: 'Cocoa Mug', slot: 'hand', price: 120, icon: '☕',
    kind: 'model', winter: true, customizable: true, defaultColor: '#d83a3f',
    colorPresets: [['Candy Red', '#d83a3f'], ['Cream', '#f1e6cf'], ['Midnight Blue', '#2b3a6b'], ['Mint', '#7fd1b0']],
    desc: 'Steaming hot cocoa topped with marshmallows. The perfect warm-up between snowball fights.',
  },
];
for (const c of CUSTOM_COSMETICS) { COSMETICS.push(c); COSMETIC_BY_ID[c.id] = c; }

// More cozy winter extras (color = glow / scarf color).
for (const c of [
  {
    id: 'frost_lantern', name: 'Frost Lantern', slot: 'hand', price: 220, icon: '🏮',
    kind: 'model', winter: true, customizable: true, defaultColor: '#7fe3ff',
    colorPresets: [['Glacier Glow', '#7fe3ff'], ['Aurora Green', '#5dffb0'], ['Ember Gold', '#ffb347'], ['Twilight Violet', '#b18cff']],
    desc: 'A frosted iron lantern with a glowing ice crystal inside. Lights the way through long polar nights.',
  },
  {
    id: 'penguin_pal', name: 'Penguin Pal', slot: 'neck', price: 350, icon: '🐧',
    kind: 'model', winter: true, customizable: true, defaultColor: '#d83a3f',
    colorPresets: [['Red Scarf', '#d83a3f'], ['Sky Scarf', '#4aa8e8'], ['Sunny Scarf', '#f2c230'], ['Mint Scarf', '#4fc59a']],
    desc: 'A tiny penguin buddy who rides on your shoulder, flaps happily and wears a scarf you pick.',
  },
]) { COSMETICS.push(c); COSMETIC_BY_ID[c.id] = c; }

// Wearable 3D outfit (kind 'model' in the shirt slot: knit body + sleeves over the torso/arms).
COSMETICS.push({
  id: 'cable_sweater', name: 'Cozy Cable-Knit Sweater', slot: 'shirt', price: 260, icon: '🧶',
  kind: 'model', winter: true, customizable: true, defaultColor: '#b3243c',
  colorPresets: [['Cranberry', '#b3243c'], ['Oatmeal', '#d9c7a3'], ['Fjord Blue', '#2f5d8a'], ['Forest', '#2f6b45']],
  desc: 'Chunky cable-knit with a snowflake band, ribbed cuffs and a fold-over collar. Instant fireside vibes.',
});
COSMETIC_BY_ID.cable_sweater = COSMETICS[COSMETICS.length - 1];

// Frosted spectacles (face) — color = frame color.
COSMETICS.push({
  id: 'frost_specs', name: 'Frosted Round Spectacles', slot: 'face', price: 160, icon: '👓',
  kind: 'model', winter: true, customizable: true, defaultColor: '#c9a24a',
  colorPresets: [['Antique Gold', '#c9a24a'], ['Silver Frost', '#cfd8e0'], ['Rose Copper', '#c27a5e'], ['Ink Black', '#24262c']],
  desc: 'Round wire spectacles with lenses frosted at the edges, like a window on a snowy morning.',
});
COSMETIC_BY_ID.frost_specs = COSMETICS[COSMETICS.length - 1];

// Snow Owl Hood (hat) — color = plumage.
COSMETICS.push({
  id: 'owl_hood', name: 'Snow Owl Hood', slot: 'hat', price: 280, icon: '🦉',
  kind: 'model', winter: true, customizable: true, defaultColor: '#f4f1ea',
  colorPresets: [['Snowy White', '#f4f1ea'], ['Tawny', '#a8743f'], ['Arctic Grey', '#9aa4ad'], ['Midnight', '#2c3550']],
  desc: 'A plush feathered hood with ear tufts, big golden owl eyes and a fluffy trim that frames your face.',
});
COSMETIC_BY_ID.owl_hood = COSMETICS[COSMETICS.length - 1];

// ---- Natural Disasters event: free, quest-earned only (never sold). Grants come from the
// server (Publisher) / quests (Game Maker); `unlock` = quest id that grants it.
// `earnIn` = game whose quest awards it. A preset value of 'rainbow' renders a rainbow gradient.
const ND = { price: 0, earnOnly: true, event: 'natural_disasters', unlock: null, kind: 'model', winter: true, customizable: true };
for (const c of [
  { id: 'tornado_hat', rarity: 'legendary', unlock: 'nd_quest_disaster_survival', name: 'Frost Tornado Hat', slot: 'hat', earnIn: 'Natural Disaster Survival', icon: '🌪️', defaultColor: '#9fdcff',
    colorPresets: [['Glacier', '#9fdcff'], ['Storm Grey', '#8c96a3'], ['Aurora', '#7dffc4'], ['Twilight', '#a98cff']],
    desc: 'A tiny icy twister spinning on your head, whirling snow and debris around it. Earned in Natural Disasters.' },
  { id: 'lightning_back', rarity: 'epic', unlock: 'nd_quest_giant_obby', name: 'Ice Lightning Bolt', slot: 'back', earnIn: 'Giant Rainbow Obby', icon: '⚡', defaultColor: '#6fd8ff',
    colorPresets: [['Ice Blue', '#6fd8ff'], ['Volt Yellow', '#ffe14d'], ['Plasma Pink', '#ff6fd8'], ['Rainbow', 'rainbow']],
    desc: 'A crackling bolt of frozen lightning strapped to your back. It flickers and sparks. Earned in Natural Disasters.' },
  { id: 'meteor_pet', rarity: 'epic', unlock: 'nd_quest_birg_hq', name: 'Frozen Meteor Pet', slot: 'neck', earnIn: 'BIRG HQ', icon: '☄️', defaultColor: '#7fe3ff',
    colorPresets: [['Comet Ice', '#7fe3ff'], ['Ember Core', '#ff8a3d'], ['Nebula', '#c18cff'], ['Starlight', '#fff1a8']],
    desc: 'A little frozen meteor that floats by your shoulder, trailing sparkles. It survived the impact! Earned in Natural Disasters.' },
  { id: 'blizzard_hat', rarity: 'rare', unlock: 'nd_quest_frost_fields', name: 'Blizzard Cloud', slot: 'hat', earnIn: 'Frost Fields', icon: '🌨️', defaultColor: '#e9f2fa',
    colorPresets: [['Snow Cloud', '#e9f2fa'], ['Storm', '#7d8796'], ['Pink Dusk', '#f3c6da'], ['Night Sky', '#3b4566']],
    desc: 'Your own personal storm cloud, snowing softly on you wherever you go. Earned in Natural Disasters.' },
]) { const item = { ...ND, ...c }; COSMETICS.push(item); COSMETIC_BY_ID[item.id] = item; }

// ---- Natural Disasters themed shop items (buyable, not earn-only) + more icy/cozy extras.
for (const c of [
  { id: 'storm_goggles', name: 'Storm Chaser Goggles', slot: 'face', price: 200, icon: '🥽', rarity: 'rare', event: 'natural_disasters',
    kind: 'model', winter: true, customizable: true, defaultColor: '#3fd0ff',
    colorPresets: [['Radar Cyan', '#3fd0ff'], ['Warning Amber', '#ffb020'], ['Siren Red', '#ff4a4a'], ['Night Vision', '#5dff7a']],
    desc: 'Rugged storm-chaser goggles with a live radar sweep on the visor and a brow lamp. Seen any twisters lately?' },
  { id: 'hail_umbrella', name: 'Hailstone Umbrella', slot: 'hand', price: 240, icon: '☂️', rarity: 'epic', event: 'natural_disasters',
    kind: 'model', winter: true, customizable: true, defaultColor: '#3f6fd8',
    colorPresets: [['Storm Blue', '#3f6fd8'], ['Hazard Yellow', '#f2c230'], ['Cherry', '#d8344a'], ['Charcoal', '#3a3f48']],
    desc: 'A sturdy storm umbrella. Hailstones bounce right off it. Built for the worst the weather can throw.' },
  { id: 'aurora_skin', name: 'Aurora Frost Skin', slot: 'skin', price: 400, icon: '🌌', rarity: 'epic',
    kind: 'skin', winter: true, customizable: true, shimmer: true, color: '#8fe8ff', defaultColor: '#8fe8ff',
    colorPresets: [['Polar Teal', '#8fe8ff'], ['Borealis Green', '#8affc1'], ['Violet Sky', '#c4a0ff'], ['Rose Dawn', '#ffb3d1']],
    desc: 'Your skin glows with the slow, shifting shimmer of the northern lights.' },
  { id: 'ice_skates', name: 'Ice Skates', slot: 'back', price: 180, icon: '⛸️', rarity: 'common',
    kind: 'model', winter: true, customizable: true, defaultColor: '#f4f1ea',
    colorPresets: [['Classic White', '#f4f1ea'], ['Midnight Black', '#23262d'], ['Berry', '#b3245c'], ['Lake Blue', '#3f8fd0']],
    desc: 'A pair of figure skates tied together and slung over your shoulder, ready for the frozen lake.' },
  { id: 'storm_slicker', name: 'Storm Survivor Slicker', slot: 'shirt', price: 260, icon: '🧥', rarity: 'epic', event: 'natural_disasters',
    kind: 'model', winter: true, customizable: true, defaultColor: '#ff6a1a',
    colorPresets: [['Rescue Orange', '#ff6a1a'], ['Storm Yellow', '#f5c816'], ['Glacier Blue', '#3a8fd6'], ['Slate', '#4a5563']],
    desc: 'A glossy hooded rain slicker with reflective stripes, toggle buttons and a Survivor patch. Rain and frost slide right off.' },
]) { COSMETICS.push(c); COSMETIC_BY_ID[c.id] = c; }

// ---- Winterhaven: regular shop items (always for sale) + free quest-earned event rewards.
// earnOnly items are granted by Game Maker's Winterhaven quests (`unlock` = quest id) and stay hidden
// in the shop until the 'winterhaven' event is live (economy.shopVisible), like Natural Disasters.
for (const c of [
  { id: 'wh_earflap_cap', name: 'Winterhaven Earflap Cap', slot: 'hat', price: 180, icon: '🧢', rarity: 'rare',
    kind: 'model', winter: true, customizable: true, defaultColor: '#b8322f',
    colorPresets: [['Cranberry', '#b8322f'], ['Evergreen', '#2f6b45'], ['Glacier', '#5d93c9'], ['Charcoal', '#3b3f46']],
    desc: 'Winterhaven village knit with a Fair Isle band, braided earflap ties and a big fluffy pom-pom.' },
  { id: 'wh_hot_cocoa', name: 'Hot Cocoa Thermos', slot: 'hand', price: 140, icon: '☕', rarity: 'common',
    kind: 'model', winter: true, customizable: true, defaultColor: '#c0392b',
    colorPresets: [['Cabin Red', '#c0392b'], ['Forest Green', '#2e6b47'], ['Sky Blue', '#4f8fd0'], ['Cream', '#efe4cc']],
    desc: 'A trusty enamel thermos with a steaming cocoa cup-lid. Warms your hands on the walk through Winterhaven.' },
]) { COSMETICS.push(c); COSMETIC_BY_ID[c.id] = c; }

const WH = { price: 0, earnOnly: true, event: 'winterhaven', kind: 'model', winter: true, customizable: true, earnIn: 'Winterhaven' };
for (const c of [
  { id: 'wh_lantern_hat', unlock: 'wh_quest_lantern', name: 'Lantern Hat', slot: 'hat', rarity: 'rare', icon: '🏮', defaultColor: '#ffb347',
    colorPresets: [['Ember', '#ffb347'], ['Frost Blue', '#7fd8ff'], ['Holly Red', '#ff5a5a'], ['Pine Glow', '#7dffa8']],
    desc: 'A cosy knit hat with a little glowing lantern bobbing on top. Earned in Winterhaven.' },
  { id: 'wh_aurora_scarf', unlock: 'wh_quest_skate', name: 'Aurora Scarf', slot: 'neck', rarity: 'epic', icon: '🧣', defaultColor: '#2b3f6b',
    colorPresets: [['Night Sky', '#2b3f6b'], ['Midnight Plum', '#4a2b5e'], ['Frost White', '#e8eef4'], ['Pine', '#1f4a3a']],
    desc: 'A long knitted scarf with shifting northern-lights stripes and tasselled ends that sway in the wind. Earned in Winterhaven.' },
  { id: 'wh_pine_cloak', unlock: 'wh_quest_pine', name: 'Pine Cloak', slot: 'back', rarity: 'rare', icon: '🌲', defaultColor: '#2f6b45',
    colorPresets: [['Spruce', '#2f6b45'], ['Fir Blue', '#2f5d6b'], ['Snowy', '#e8eef4'], ['Winter Berry', '#8a2b3a']],
    desc: 'A woodland cloak of layered pine boughs dusted with snow. Earned in Winterhaven.' },
  { id: 'wh_crystal_pet', unlock: 'wh_quest_cave', name: 'Crystal Sprite', slot: 'neck', rarity: 'epic', icon: '💎', defaultColor: '#8fe8ff',
    colorPresets: [['Ice', '#8fe8ff'], ['Amethyst', '#c49bff'], ['Rose Quartz', '#ffb3d1'], ['Emerald', '#7dffb0']],
    desc: 'A glowing ice-crystal sprite found deep in the Winterhaven caves. It rides on your shoulder. Earned in Winterhaven.' },
  { id: 'wh_frostspire_crown', unlock: 'wh_quest_castle', name: 'Frostspire Crown', slot: 'hat', rarity: 'legendary', icon: '👑', defaultColor: '#bfe9ff',
    colorPresets: [['Ice', '#bfe9ff'], ['Aurora', '#8affc1'], ['Rose Frost', '#ffc2dc'], ['Royal Gold', '#ffd98a']],
    desc: 'The crown of the Frostspire castle: soaring ice spires and a shining heart gem. Earned in Winterhaven.' },
  { id: 'wh_blizzard_back', unlock: 'wh_quest_frostgate', name: 'Frostgate Blizzard', slot: 'back', rarity: 'epic', icon: '🌨️', defaultColor: '#9fdcff',
    colorPresets: [['Frost', '#9fdcff'], ['Storm Grey', '#8a96a8'], ['Violet Gale', '#b49bff'], ['Aurora Green', '#8affc1']],
    desc: 'A swirling ring of blizzard that orbits your back, straight from the Frostgate. Earned in Winterhaven.' },
]) { const item = { ...WH, ...c }; COSMETICS.push(item); COSMETIC_BY_ID[item.id] = item; }
