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
