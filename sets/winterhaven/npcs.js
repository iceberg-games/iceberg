// Winterhaven NPC roster: pure data (no THREE/DOM). Shared with Cosmetics + Game Maker.
// `area` = AREAS id in layout.js. facing: 0 = faces +z (same as cabins/anchors).
// Stable ids — do not rename without coordinating Cosmetics + Game Maker.
const P = Math.PI;
export const NPCS = [
  // Winter Market / Town Square
  { id: 'frosty-merchant', name: 'Frosty Quill', area: 'market', role: 'Shop merchant / main quest hub', questId: 'hub', x: -15.6, z: -15.6, facing: P / 4, note: 'ANCHORS.merchant — red stall counter' },
  { id: 'maple-stall', name: 'Maple Bramble', area: 'market', role: 'Second vendor (blue stall)', x: 15.6, z: -15.6, facing: -P / 4, note: 'ANCHORS.market' },
  { id: 'oven-mira', name: 'Oven Mira', area: 'market', role: 'Baker', x: 0, z: -22, facing: 0, note: 'Between the stalls, facing the tree' },
  { id: 'wrap-wren', name: 'Wrap Wren', area: 'square', role: 'Gift wrapper', x: 9, z: 6, facing: -2.2, note: 'By presents under the tree' },
  { id: 'crier-bole', name: 'Crier Bole', area: 'square', role: 'Town crier', questId: 'wh_quest_carol', x: -6, z: 15, facing: P, note: 'South edge of square toward spawn' },
  { id: 'owl-hoot', name: 'Hoot', area: 'square', role: 'Owl companion (pet)', x: -10, z: 4, facing: 1.2, note: 'Perched near the tree, west side' },
  // Lantern Lane
  { id: 'inn-hearth', name: 'Inn Hearth', area: 'lane', role: 'Innkeeper', x: -7, z: 42, facing: P / 2, note: 'West cabin door' },
  { id: 'tinker-cog', name: 'Tinker Cog', area: 'lane', role: 'Blacksmith / tinker', x: 7, z: 64, facing: -P / 2, note: 'East side of lane' },
  { id: 'lamp-lumen', name: 'Lamp Lumen', area: 'lane', role: 'Lamp lighter', questId: 'wh_quest_lantern', x: -4, z: 104, facing: P, note: 'South end of lane near lanterns' },
  { id: 'kids-pip', name: 'Pip', area: 'lane', role: 'Village kid', x: 2, z: 82, facing: P, note: 'Mid-lane street' },
  { id: 'courier-swift', name: 'Courier Swift', area: 'lane', role: 'Parcel courier', x: 5, z: 50, facing: -P / 2, note: 'Lane near inn' },
  // Mirrorfrost Lake
  { id: 'skate-sela', name: 'Skate Sela', area: 'lake', role: 'Skate coach', questId: 'wh_quest_skate', x: 70, z: 12, facing: P / 2, note: 'On ice near west shore' },
  { id: 'cocoa-kip', name: 'Cocoa Kip', area: 'lake', role: 'Hot-cocoa seller', x: 46, z: 10, facing: P / 2, note: 'ANCHORS.lakeShore benches' },
  { id: 'ice-fisher', name: 'Glint Hook', area: 'lake', role: 'Ice fisher (scenic)', x: 100, z: 24, facing: -2.4, note: 'East ice hole' },
  // Ice Bridge / Castle
  { id: 'bridge-bryn', name: 'Bridge Bryn', area: 'creek', role: 'Bridge keeper', questId: 'wh_quest_bridge', x: 3, z: -52, facing: P, note: 'Village end of main ice bridge' },
  { id: 'castle-steward', name: 'Steward Vale', area: 'castle', role: 'Castle steward', questId: 'wh_quest_castle', x: 3, z: -132, facing: 0, note: 'ANCHORS.castleGate' },
  { id: 'ice-architect', name: 'Prism Architect', area: 'castle', role: 'Ice mage / architect', x: -10, z: -118, facing: 0.6, note: 'Beside castle path' },
  { id: 'guard-rim', name: 'Guard Rim', area: 'castle', role: 'Castle guard', x: -4, z: -134, facing: 0, note: 'Left of gate' },
  { id: 'guard-holt', name: 'Guard Holt', area: 'castle', role: 'Castle guard', x: 4, z: -134, facing: 0, note: 'Right of gate' },
  // Whispering Pines
  { id: 'pine-ranger', name: 'Ranger Ash', area: 'forest', role: 'Forest ranger', questId: 'wh_quest_pine', x: -106, z: 46, facing: 0.5, note: 'ANCHORS.forestClearing' },
  { id: 'wood-cleave', name: 'Cleave', area: 'forest', role: 'Woodcutter', x: -104, z: 82, facing: 1.2, note: 'South section of loop trail' },
  { id: 'lost-lark', name: 'Lark', area: 'forest', role: 'Lost traveler', x: -72, z: 108, facing: -0.8, note: 'SE edge of pines' },
  { id: 'pine-wisp', name: 'Wisp', area: 'forest', role: 'Friendly forest spirit', x: -118, z: 20, facing: 1.0, note: 'North of clearing' },
  // Frostgate Plaza
  { id: 'portal-keeper', name: 'Gate Mira', area: 'portal', role: 'Minigame greeter / portal keeper', questId: 'wh_quest_frostgate', x: -80, z: 24, facing: P / 2, note: 'Beside Frostgate arch (ANCHORS.portal)' },
  // Pass / Cave
  { id: 'pass-guide', name: 'Guide Tor', area: 'pass', role: 'Mountain guide', questId: 'wh_quest_pass', x: -1, z: 160, facing: P, note: 'Lower pass trail' },
  { id: 'crystal-miner', name: 'Shard', area: 'cave', role: 'Crystal miner', questId: 'wh_quest_cave', x: -34, z: 200, facing: -P / 2, note: 'ANCHORS.cave' },
  { id: 'cave-hermit', name: 'Hermit Opal', area: 'cave', role: 'Cave hermit', x: -45, z: 210, facing: P / 2, note: 'Just inside cave mouth' },
  // Outskirts
  { id: 'outskirt-fern', name: 'Fern', area: 'outskirts', role: 'Farmer', x: 32, z: 52, facing: -P / 2, note: 'Outskirts cabin near (40,58)' },
  { id: 'sled-rio', name: 'Rio', area: 'outskirts', role: 'Sledder', x: 56, z: 70, facing: -P / 2, note: 'East slope' },
  { id: 'snow-builder', name: 'Puff', area: 'outskirts', role: 'Snowman builder', questId: 'wh_quest_snowman', x: 30, z: 88, facing: -P / 2, note: 'Open snow between cabins' },
  { id: 'kids-noll', name: 'Noll', area: 'outskirts', role: 'Village kid / snowball', questId: 'wh_quest_outskirts', x: 36, z: 96, facing: -P / 2, note: 'Outskirts play spot' },
  { id: 'pup-nimbus', name: 'Nimbus', area: 'outskirts', role: 'Wolf-pup companion (pet)', x: 31, z: 89.5, facing: -P / 2, note: 'Beside Puff' },
];
