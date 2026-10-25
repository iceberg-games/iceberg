// Rimebound Mines layout + Game Maker hooks: pure data (no THREE / DOM). Procedural stub.
// Coordinates: x/z metres, y up; flat floor at y=0. facing = yaw radians (0 = -z... same convention as other sets).
export const TUNNELS = [            // [x0, z0, x1, z1] walkable carved boxes (ceiling 4.5)
  [-6, -6, 6, 6],                  // central cavern hub
  [-2, 6, 2, 40],                  // south adit (surface entrance)
  [-2, -40, 2, -6],                // north shaft gallery
  [6, -2, 40, 2],                  // east drift
  [-40, -2, -6, 2],                // west drift
  [30, -30, 40, 2],                // east -> NE loop
  [-40, -30, -30, 2],              // west -> NW loop
  [-40, -40, 40, -30],             // north crosscut
];
export const CEIL = 4.5;
export const bounds = { min: [-40, 0, -40], max: [40, CEIL, 40] };
export const walkBounds = { type: 'box', minX: -40, maxX: 40, minZ: -40, maxZ: 40 };

export const spawns = {
  survivor: [
    { pos: [-1, 0, 34], facing: Math.PI }, { pos: [1, 0, 34], facing: Math.PI },
    { pos: [-1, 0, 30], facing: Math.PI }, { pos: [1, 0, 30], facing: Math.PI },
  ],
  killer: [{ pos: [0, 0, -36], facing: 0 }],
};
export const cores = [                       // generator-style objectives (ore crushers)
  { id: 'core-hub', pos: [3, 0, -3] },
  { id: 'core-east', pos: [35, 0, -15] },
  { id: 'core-west', pos: [-35, 0, -15] },
  { id: 'core-north', pos: [0, 0, -35] },
];
export const exits = [
  { id: 'exit-adit', pos: [0, 0, 40], facing: 0 },       // surface adit (south)
  { id: 'exit-lift', pos: [38, 0, -38], facing: Math.PI / 2 }, // ore lift cage (NE)
];
export const hidingSpots = [                 // mine carts / timber alcoves
  { id: 'cart-hub', pos: [-4, 0, 4] }, { id: 'cart-east', pos: [20, 0, 1] },
  { id: 'cart-west', pos: [-20, 0, -1] }, { id: 'alcove-nw', pos: [-38, 0, -20] },
  { id: 'alcove-ne', pos: [38, 0, -6] }, { id: 'alcove-n', pos: [-20, 0, -38] },
];
export const HOOKS = { spawns, cores, exits, hidingSpots, bounds, walkBounds };
export const groundHeight = () => 0;
