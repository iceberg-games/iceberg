export const SHOTS = [
  { id: 'gate', name: 'Arrive at the dead shipyard', duration: 14, ease: 'inOutSine', pos: [[0, 8, 52], [0, 5, 40], [2, 3, 30]], look: [[14, 20, -18], [14, 16, -18]], fov: [50, 56] },
  { id: 'crane', name: 'Crane beacon climb', duration: 14, ease: 'inOutCubic', pos: [[22, 2, -6], [22, 14, -10], [24, 30, -6]], look: [[14, 20, -18], [14, 32, -16], [20, 4, -42]], fov: 54 },
  { id: 'freighter', name: 'Hollow Mercy hull', duration: 16, ease: 'inOutSine', pos: [[-4, 6, -30], [10, 8, -32], [30, 10, -30], [48, 12, -36]], look: [[20, 5, -42], [30, 8, -42], [40, 10, -42]], fov: 52 },
  { id: 'warehouse', name: 'Warehouse chase', duration: 12, ease: 'linear', pos: [[-22, 2.2, 24], [-22, 2, 14], [-22, 2, 4], [-22, 2.2, -6]], look: [[-22, 2, 0], [-22, 2, -10], [-10, 3, -30]], fov: 64 },
  { id: 'pier', name: 'Fog pier lighthouse', duration: 14, ease: 'inOutSine', hold: 2, pos: [[-10, 3, -20], [-10, 2.6, -36], [-10, 3, -46]], look: [[-10, 4, -56], [-10, 7, -56]], fov: [56, 44] },
];
