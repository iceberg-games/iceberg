// Lantern Hollow areas (brief §3): one shared coordinate space so the platform's automatic remote avatars
// land in the right place. Each area is far from the others (beyond fog + camera far plane).
export const AREAS = {
  village: { id: 'village', name: 'Frostlight Village', tier: 0, origin: [0, 0], bounds: { minX: -46, maxX: 46, minZ: -46, maxZ: 46 },
    spawn: [0, 0, 34], facing: Math.PI, fog: { color: '#1a2140', near: 30, far: 140 }, sky: '#0b1030', exposure: 1.05, power: 1 },
  caves: { id: 'caves', name: 'Glowroot Caves', tier: 1, origin: [0, -1000], bounds: { minX: -35, maxX: 35, minZ: -1075, maxZ: -925 },
    spawn: [0, 0, -930], facing: Math.PI, fog: { color: '#120a24', near: 8, far: 60 }, sky: '#06030e', exposure: 1.0, power: 1 },
  mine: { id: 'mine', name: 'Sunken Mine', tier: 2, origin: [1000, -1000], bounds: { minX: 955, maxX: 1045, minZ: -1070, maxZ: -930 },
    spawn: [1000, 0, -935], facing: Math.PI, fog: { color: '#0a1218', near: 8, far: 55 }, sky: '#04080c', exposure: 1.0, power: 5 },
  throne: { id: 'throne', name: 'Aurora Throne', tier: 3, origin: [-1000, -1000], bounds: { minX: -1030, maxX: -970, minZ: -1090, maxZ: -910 },
    spawn: [-1000, 0, -915], facing: Math.PI, fog: { color: '#1b1640', near: 25, far: 160 }, sky: '#0d0a2a', exposure: 1.1, power: 10 },
};
export const AREA_ORDER = ['village', 'caves', 'mine', 'throne'];
/** Which area a world position belongs to (host sim + remote players). null = between areas. */
export function areaAt(x, z) {
  for (const a of Object.values(AREAS)) { const b = a.bounds; if (x >= b.minX - 4 && x <= b.maxX + 4 && z >= b.minZ - 4 && z <= b.maxZ + 4) return a.id; }
  return null;
}
