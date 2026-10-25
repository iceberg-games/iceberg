// Winterhaven NPC roster: pure data (no THREE/DOM). `area` = AREAS id in layout.js.
// facing: radians, 0 = faces +z (same convention as cabins/anchors).
const P = Math.PI;
export const NPCS = [
  // Winter Market / Town Square
  { id: 'merchant-holloway', name: 'Merchant Holloway Frost', area: 'market', role: 'Shop merchant / quest hub', x: -15.6, z: -15.6, facing: P / 4, note: 'At the red merchant counter (ANCHORS.merchant); main quest giver' },
  { id: 'vendor-pim', name: 'Pim Tinselbright', area: 'market', role: 'Second vendor (trinkets & ornaments)', x: 15.6, z: -15.6, facing: -P / 4, note: 'At the blue stall (ANCHORS.market)' },
  { id: 'baker-marzie', name: 'Marzie Gingerloaf', area: 'market', role: 'Baker (cocoa buns, gingerbread)', x: 0, z: -22, facing: 0, note: 'Between the two stalls, facing the tree' },
  { id: 'gift-wrapper-ribbon', name: 'Ribbon Quillwick', area: 'square', role: 'Gift wrapper', x: 9, z: 6, facing: -2.2, note: 'By the presents under the tree, south-east side' },
  { id: 'town-crier-bellamy', name: 'Bellamy Chime', area: 'square', role: 'Town crier / event announcer', x: -6, z: 15, facing: P, note: 'South edge of the square, greets players coming from spawn' },
  { id: 'carolers-frostnotes', name: 'The Frostnotes', area: 'square', role: 'Carolers (trio, ambient)', x: -12, z: 3, facing: 1.8, note: 'West side of the tree; treat as one NPC group' },
  // Lantern Lane
  { id: 'innkeeper-hearth', name: 'Hettie Hearthwell', area: 'lane', role: 'Innkeeper (rest, rumours)', x: -7, z: 42, facing: P / 2, note: 'Street side, in front of the west cabin door' },
  { id: 'tinker-cogsworth', name: 'Brannick Cogsworth', area: 'lane', role: 'Blacksmith / tinker (upgrades, repairs)', x: 7, z: 64, facing: -P / 2, note: 'East side of the lane by a cabin front' },
  { id: 'kids-snowpack', name: 'Tuck & Wren', area: 'lane', role: 'Kids playing (snowball mini-quests)', x: 2, z: 82, facing: P, note: 'Middle of the street, mid-lane' },
  { id: 'lamplighter-olin', name: 'Olin Wickflame', area: 'lane', role: 'Lamp lighter (light-the-lanterns quest)', x: -4, z: 104, facing: P, note: 'South end of the lane near the last lanterns' },
  // Mirrorfrost Lake
  { id: 'skate-coach-sela', name: 'Coach Sela Glidewell', area: 'lake', role: 'Skate coach (skating trials)', x: 70, z: 12, facing: P / 2, note: 'On the ice near the west shore' },
  { id: 'ice-fisher-gruff', name: 'Old Gruff Pikeby', area: 'lake', role: 'Ice fisherman (decorative)', x: 100, z: 24, facing: -2.4, note: 'Sitting by an ice hole, east half of the lake' },
  { id: 'cocoa-seller-mallow', name: 'Mallow Brewbank', area: 'lake', role: 'Hot-cocoa seller', x: 46, z: 10, facing: P / 2, note: 'West shore benches at end of Lakeside Walk (ANCHORS.lakeShore)' },
  // Ice Bridge Creek / Frostspire Hill
  { id: 'bridge-keeper-tollan', name: 'Tollan Rimehold', area: 'creek', role: 'Bridge keeper', x: 3, z: -52, facing: P, note: 'Village end of the main ice bridge (ANCHORS.bridge)' },
  { id: 'castle-steward-aurelle', name: 'Steward Aurelle Vane', area: 'castle', role: 'Castle steward (story quests)', x: 3, z: -132, facing: 0, note: 'Just outside the castle gate (ANCHORS.castleGate)' },
  { id: 'ice-mage-isolde', name: 'Isolde Frostweaver', area: 'castle', role: 'Ice mage / architect', x: -10, z: -118, facing: 0.6, note: 'Beside the castle path below the gate' },
  { id: 'guard-halvard', name: 'Sentinel Halvard', area: 'castle', role: 'Castle guard (left)', x: -4, z: -134, facing: 0, note: 'Left of the gate; pair with guard-brynja' },
  { id: 'guard-brynja', name: 'Sentinel Brynja', area: 'castle', role: 'Castle guard (right)', x: 4, z: -134, facing: 0, note: 'Right of the gate; pair with guard-halvard' },
  // Whispering Pines
  { id: 'ranger-fennick', name: 'Ranger Fennick Moss', area: 'forest', role: 'Forest ranger (tracking quests)', x: -106, z: 46, facing: 0.5, note: 'Forest clearing on the pines loop (ANCHORS.forestClearing)' },
  { id: 'woodcutter-bram', name: 'Bram Axeholt', area: 'forest', role: 'Woodcutter (gather logs)', x: -104, z: 82, facing: 1.2, note: 'Beside the loop trail, south section' },
  { id: 'lost-traveler-nimbly', name: 'Nimbly Wanderfoot', area: 'forest', role: 'Lost traveler (escort/find quest)', x: -72, z: 108, facing: -0.8, note: 'On the loop trail near the south-east edge of the pines' },
  { id: 'spirit-whisperwisp', name: 'Whisperwisp', area: 'forest', role: 'Friendly forest spirit (hints, riddles)', x: -118, z: 20, facing: 1.0, note: 'Glowing spirit among the trees, north of the clearing' },
  // Frostgate Plaza
  { id: 'portal-keeper-quinn', name: 'Gatewarden Quinn', area: 'portal', role: 'Portal keeper / minigame greeter', x: -80, z: 24, facing: P / 2, note: 'Beside the Frostgate arch (ANCHORS.portal), faces the trail in' },
  // Frostbite Pass / Glimmer Cave
  { id: 'mountain-guide-sorrel', name: 'Sorrel Peakstride', area: 'pass', role: 'Mountain guide', x: -1, z: 160, facing: P, note: 'On the pass trail, lower switchback' },
  { id: 'crystal-miner-dunk', name: 'Dunk Glimmerpick', area: 'cave', role: 'Crystal miner (mining quests)', x: -34, z: 200, facing: -P / 2, note: 'Cave mouth, end of the Cave Spur (ANCHORS.cave)' },
  { id: 'cave-hermit-orrin', name: 'Hermit Orrin', area: 'cave', role: 'Cave hermit (lore, rare trades)', x: -45, z: 210, facing: P / 2, note: 'Just inside the cave mouth' },
  // Snowdrift Outskirts
  { id: 'farmer-tilda', name: 'Tilda Frostfield', area: 'outskirts', role: 'Farmer (winter crops, deliveries)', x: 32, z: 52, facing: -P / 2, note: 'In front of the outskirts cabin near (40,58)' },
  { id: 'sledder-zip', name: 'Zip Runnerton', area: 'outskirts', role: 'Sledder (race challenges)', x: 56, z: 70, facing: -P / 2, note: 'On the open slope east of the cabins' },
  { id: 'snowman-builder-poppy', name: 'Poppy Coalbutton', area: 'outskirts', role: 'Snowman builder', x: 30, z: 88, facing: -P / 2, note: 'Open snow between outskirts cabins' },
  { id: 'pet-pip-owl', name: 'Pip the Snow Owl', area: 'outskirts', role: 'Pet companion (owl)', x: 31, z: 89.5, facing: -P / 2, note: 'Perched by Poppy\'s snowman' },
  { id: 'courier-dash', name: 'Dash Parcelwing', area: 'outskirts', role: 'Courier (delivery quests)', x: 26, z: 110, facing: -2.4, note: 'Edge of town near the pass trailhead' },
  { id: 'guard-ewan', name: 'Watchman Ewan', area: 'outskirts', role: 'Outskirts guard', x: 62, z: 44, facing: -P / 2, note: 'Watch post on the north-east corner of the outskirts' },
];
