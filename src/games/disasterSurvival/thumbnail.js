// Menu-card thumbnail: ONE-FILE SWAP. Social Media's NDS game card (from /workspace/iceberg-events/nds-game-card.png),
// re-encoded to 640x360 WebP (~38 KB). Vite inlines it into the single-file build. The portal shows it with
// background-size: cover; the art and title sit in the middle so they survive the crop.
// Set to null to fall back to the procedural canvas card (drawThumb in index.js).
import url from './menu-card.webp';
export default url;
