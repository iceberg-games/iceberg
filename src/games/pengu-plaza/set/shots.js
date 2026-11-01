import { RINK, COCOA, PROPS, SPAWN } from './layout.js';
export const SHOTS = [
  { id: 'arrival', name: 'Arch arrival → plaza', duration: 14, ease: 'inOutSine', pos: [[0, 3, 40], [0, 4, 28], [0, 5, 18]], look: [[0, 3, 30], [0, 2, 0], [0, 1.5, -10]], fov: 55 },
  { id: 'rink', name: 'Rinkside skaters', duration: 12, ease: 'inOutSine', pos: [[14, 2, -8], [10, 1.6, -24]], look: [[RINK.x, 0.8, RINK.z], [RINK.x, 0.8, RINK.z]], fov: 48 },
  { id: 'cocoa', name: 'Cocoa stand close-up', duration: 10, ease: 'inOutSine', hold: 1, pos: [[COCOA.x - 3, 2, COCOA.z + 6], [COCOA.x - 1, 1.7, COCOA.z + 3.5]], look: [[COCOA.x, 1.3, COCOA.z], [COCOA.x, 1.4, COCOA.z]], fov: 42 },
  { id: 'ice-pengu', name: 'Giant Ice Pengu', duration: 12, ease: 'inOutSine', pos: [[-14, 2, -10], [-18, 3, -13]], look: [[PROPS.icePengu.x, 4, PROPS.icePengu.z], [PROPS.icePengu.x, 6, PROPS.icePengu.z]], fov: 52 },
  { id: 'overview', name: 'Plaza crane-up', duration: 14, ease: 'inOutSine', pos: [[20, 4, 26], [10, 18, 30], [0, 32, 26]], look: [[0, 1, 0], [0, 0, -4], [0, 0, -4]], fov: 58 },
];
