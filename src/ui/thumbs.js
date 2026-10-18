// Procedurally drawn game-card thumbnails (no image assets needed).
// Plus image art for some games by id: GAME_THUMBS / gameThumb(def) (portal cards, featured banner, games menu).
// Files: src/assets/thumbnails/<game-id>.webp. Pages build (VITE_ICEBERG_PAGES=1): scripts/build-site.mjs copies them to
// <site>/thumbnails/ and they load lazily; single-file/dev builds inline them.
import ndsInline from '../assets/thumbnails/natural-disaster-survival.webp';   // Social Media's game card, 960x540
const PAGES = import.meta.env.VITE_ICEBERG_PAGES === '1';
const siteRoot = () => (typeof document !== 'undefined' && document.querySelector('meta[name="iceberg-root"]')?.content) || './';
export const GAME_THUMBS = {
  'natural-disaster-survival': PAGES ? `${siteRoot()}thumbnails/natural-disaster-survival.webp` : ndsInline,
};
/** Thumbnail URL for a game definition: its image art if any, else the procedural thumbnail. Safe for unknown/missing games. */
export function gameThumb(def) { return GAME_THUMBS[def?.id] || thumb(def?.thumbnail); }
const cache = {};
export function thumb(kind) {
  if (kind && kind.startsWith('data:')) return kind;
  if (cache[kind]) return cache[kind];
  const c = document.createElement('canvas'); c.width = 480; c.height = 270;
  const g = c.getContext('2d'), W = 480, H = 270;
  const sky = (a, b) => { const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, a); gr.addColorStop(1, b); g.fillStyle = gr; g.fillRect(0, 0, W, H); };
  const noob = (x, y, s, shirt = '#3d7bd9') => {
    g.fillStyle = '#4a9e4a'; g.fillRect(x - s * 0.5, y - s, s * 0.48, s); g.fillRect(x + s * 0.02, y - s, s * 0.48, s);
    g.fillStyle = shirt; g.fillRect(x - s * 0.5, y - 2 * s, s, s);
    g.fillStyle = '#f5cd30'; g.fillRect(x - s, y - 2 * s, s * 0.48, s); g.fillRect(x + s * 0.52, y - 2 * s, s * 0.48, s);
    g.fillRect(x - s * 0.31, y - 2.62 * s, s * 0.62, s * 0.62);
    g.fillStyle = '#222'; g.fillRect(x - s * 0.16, y - 2.45 * s, s * 0.07, s * 0.12); g.fillRect(x + s * 0.09, y - 2.45 * s, s * 0.07, s * 0.12);
  };
  const flakes = (n, col = 'rgba(255,255,255,0.9)') => { g.fillStyle = col; for (let i = 0; i < n; i++) { g.beginPath(); g.arc(Math.random() * W, Math.random() * H, 1 + Math.random() * 2, 0, 7); g.fill(); } };
  if (kind === 'frost') {
    sky('#7fb8e6', '#eaf6ff');
    g.fillStyle = '#4f8fb8'; g.fillRect(0, 160, W, 30);
    for (const [x, w, hh, col] of [[60, 120, 90, '#dff3ff'], [330, 160, 120, '#c6e8fb'], [220, 70, 50, '#eef9ff']]) { g.fillStyle = col; g.beginPath(); g.moveTo(x - w / 2, 170); g.lineTo(x - w * 0.2, 170 - hh); g.lineTo(x + w * 0.1, 170 - hh * 0.8); g.lineTo(x + w / 2, 170); g.fill(); }
    g.fillStyle = '#f6fbff'; g.beginPath(); g.ellipse(W / 2, 290, 360, 120, 0, 0, 7); g.fill();
    const blocks = [[150, 0, '#7cc4ec'], [180, 0, '#7cc4ec'], [150, 1, '#bfe9ff'], [210, 0, '#3f8fd0'], [180, 1, '#bfe9ff'], [165, 2, '#f7fbff']];
    for (const [x, y, col] of blocks) { g.fillStyle = col; g.fillRect(x, 215 - y * 30, 30, 30); g.strokeStyle = 'rgba(30,80,120,0.4)'; g.strokeRect(x, 215 - y * 30, 30, 30); }
    noob(320, 245, 30, '#f2f7fb');
    g.fillStyle = '#ffd34d'; for (const [x, y] of [[90, 225], [400, 215], [260, 200]]) { g.beginPath(); g.ellipse(x, y, 9, 12, 0, 0, 7); g.fill(); }
    flakes(60);
  } else if (kind === 'cabin') {
    sky('#0f1d38', '#3a4f78');
    g.fillStyle = '#e8f0ff'; g.beginPath(); g.ellipse(W / 2, 300, 380, 110, 0, 0, 7); g.fill();
    g.fillStyle = '#fffbe0'; g.beginPath(); g.arc(400, 50, 18, 0, 7); g.fill();
    // cabin
    g.fillStyle = '#7a4e2c'; g.fillRect(130, 110, 220, 120);
    for (let y = 114; y < 230; y += 12) { g.fillStyle = y % 24 ? '#8a5a34' : '#6b4226'; g.fillRect(130, y, 220, 6); }
    g.fillStyle = '#3a2a22'; g.beginPath(); g.moveTo(115, 115); g.lineTo(240, 45); g.lineTo(365, 115); g.fill();
    g.fillStyle = '#f4f8ff'; g.beginPath(); g.moveTo(140, 100); g.lineTo(240, 45); g.lineTo(340, 100); g.lineTo(240, 60); g.fill();
    g.fillStyle = '#6b6058'; g.fillRect(150, 50, 24, 50);
    const win = (x, y) => { const gr = g.createRadialGradient(x + 18, y + 16, 2, x + 18, y + 16, 40); gr.addColorStop(0, '#ffdf8a'); gr.addColorStop(1, '#ff8a3d'); g.fillStyle = gr; g.fillRect(x, y, 36, 32); g.fillStyle = '#3e2412'; g.fillRect(x + 16, y, 4, 32); g.fillRect(x, y + 14, 36, 4); };
    win(155, 125); win(290, 125); win(155, 180); win(290, 180);
    g.fillStyle = '#4a2e1a'; g.fillRect(222, 175, 36, 55);
    g.fillStyle = '#ffe6b0'; g.font = 'bold 20px Georgia'; g.textAlign = 'center'; g.fillText('BIRG HQ', 240, 103);
    g.fillStyle = 'rgba(200,220,255,0.6)'; for (let i = 0; i < 3; i++) { g.beginPath(); g.arc(162 + i * 6, 40 - i * 12, 6 + i * 3, 0, 7); g.fill(); }
    flakes(70);
  } else if (kind === 'creator') {
    sky('#2a4a7a', '#6fb1e3');
    g.strokeStyle = 'rgba(255,255,255,0.25)'; for (let x = 0; x < W; x += 24) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); } for (let y = 0; y < H; y += 24) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
    const cols = ['#bfe9ff', '#3f8fd0', '#f5c542', '#e2474b', '#2f8f5b', '#8b6cf0'];
    for (let i = 0; i < 14; i++) { g.fillStyle = cols[i % 6]; g.fillRect(48 + (i % 7) * 48, 168 - Math.floor(i / 7) * 48, 46, 46); }
    g.fillStyle = '#fff'; g.beginPath(); g.arc(360, 90, 46, 0, 7); g.fill();
    g.fillStyle = '#2a6fb0'; g.fillRect(352, 62, 16, 56); g.fillRect(332, 82, 56, 16);
  } else if (kind === 'obby') {
    sky('#9fd3f5', '#ffd0b0');
    g.fillStyle = '#ff4a1c'; g.fillRect(0, 200, W, 70);
    for (let i = 0; i < 9; i++) { g.fillStyle = `hsl(${i * 36},85%,55%)`; g.fillRect(20 + i * 50, 175 - (i % 3) * 18, 40, 16); }
    noob(60, 175, 22);
  } else {
    sky('#5b6fb0', '#cfe6f7');
    g.fillStyle = '#eef5fb'; g.fillRect(0, 190, W, 80);
    noob(240, 230, 34);
    flakes(40);
  }
  return (cache[kind] = c.toDataURL('image/png'));
}
