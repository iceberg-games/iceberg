// Menu thumbnail (480x270): frosty stand + a giant rainbow snowcone.
import { drawCone } from './props.js';
export function drawThumb() {
  const W = 480, H = 270, c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
  const sky = g.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, '#5aa8f0'); sky.addColorStop(0.6, '#bfe4ff'); sky.addColorStop(1, '#ffe9dc'); g.fillStyle = sky; g.fillRect(0, 0, W, H);
  g.fillStyle = '#d9ecfb'; for (const [x, h, w] of [[40, 90, 70], [120, 60, 60], [400, 100, 80], [330, 70, 60]]) { g.beginPath(); g.moveTo(x - w, 190); g.lineTo(x, 190 - h); g.lineTo(x + w, 190); g.fill(); }
  g.fillStyle = '#f3f8ff'; g.fillRect(0, 190, W, 80);
  g.fillStyle = '#c99566'; g.fillRect(0, 205, W, 40); g.fillStyle = 'rgba(80,45,20,.25)'; for (let y = 205; y < 245; y += 8) g.fillRect(0, y, W, 1);
  // stand
  g.fillStyle = '#cfeaf5'; g.fillRect(90, 90, 240, 120);
  for (let i = 0; i < 12; i++) { g.fillStyle = i % 2 ? '#ffffff' : '#2fa8e0'; g.beginPath(); g.moveTo(80 + i * 22, 80); g.lineTo(102 + i * 22, 80); g.lineTo(102 + i * 22, 112); g.arc(91 + i * 22, 112, 11, 0, Math.PI); g.fill(); }
  g.fillStyle = '#1a2a44'; g.beginPath(); g.roundRect(120, 42, 180, 36, 10); g.fill();
  g.font = '900 24px "Arial Rounded MT Bold", Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.shadowColor = '#5fe1ff'; g.shadowBlur = 14; g.fillStyle = '#e9fbff'; g.fillText('SNOWCONES', 210, 61); g.shadowBlur = 0;
  ['#2f8bff', '#ff3b5c', '#5fd94a', '#9b5cff', '#ff9a2e'].forEach((col, i) => { g.fillStyle = 'rgba(230,246,255,.6)'; g.fillRect(120 + i * 30, 128, 20, 36); g.fillStyle = col; g.fillRect(122 + i * 30, 138, 16, 24); });
  const cf = g.createLinearGradient(0, 168, 0, 212); cf.addColorStop(0, '#ffffff'); cf.addColorStop(1, '#e3f1fb'); g.fillStyle = cf; g.beginPath(); g.roundRect(80, 168, 260, 44, 8); g.fill();
  ['#2f8bff', '#ff3b5c', '#5fd94a', '#9b5cff', '#ff9a2e'].forEach((col, i) => { for (let k = 0; k < 2; k++) { g.fillStyle = col; g.beginPath(); g.arc(98 + (i * 2 + k) * 26, 212, 13, Math.PI, 0); g.fill(); } });
  // rainbow snowcone hero
  const cx = 395, cy = 150, s = 170;
  g.save(); g.translate(cx, cy); g.rotate(0.12); g.translate(-cx, -cy);
  drawCone(g, cx, cy, s, { syrup: null });
  const w = s * 0.62, r = w * 0.56;
  g.save(); g.beginPath(); g.ellipse(cx, cy + s * 0.02, r, r, 0, Math.PI, 0); g.clip();
  ['#ff3b5c', '#ff9a2e', '#ffd23f', '#5fd94a', '#2f8bff', '#9b5cff'].forEach((col, i) => { g.fillStyle = col; g.fillRect(cx - r + i * (2 * r / 6), cy - r, 2 * r / 6 + 1, r + 4); });
  g.fillStyle = 'rgba(255,255,255,.35)'; for (let i = 0; i < 30; i++) { g.beginPath(); g.arc(cx - r + Math.random() * 2 * r, cy - Math.random() * r, 2 + Math.random() * 3, 0, 7); g.fill(); }
  g.restore();
  g.fillStyle = '#d6213b'; g.beginPath(); g.arc(cx, cy - r - 6, 14, 0, 7); g.fill(); g.strokeStyle = '#3f7d2b'; g.lineWidth = 4; g.beginPath(); g.moveTo(cx, cy - r - 18); g.quadraticCurveTo(cx + 8, cy - r - 34, cx + 18, cy - r - 34); g.stroke();
  g.restore();
  for (let i = 0; i < 18; i++) { const a = i / 18 * Math.PI * 2; g.fillStyle = ['#ff6fb5', '#ffd23f', '#7fe3ff'][i % 3]; g.save(); g.translate(cx + Math.cos(a) * 110, cy - 30 + Math.sin(a) * 80); g.rotate(a); g.fillRect(-6, -2, 12, 4); g.restore(); }
  g.fillStyle = 'rgba(255,255,255,.9)'; for (let i = 0; i < 50; i++) { g.beginPath(); g.arc((i * 97) % W, (i * 53) % 200, 1 + (i % 3), 0, 7); g.fill(); }
  g.font = '900 34px "Arial Rounded MT Bold", Arial, sans-serif'; g.textAlign = 'left'; g.lineWidth = 8; g.strokeStyle = '#0f4c7a'; g.strokeText('SNOWCONE TYCOON', 14, 30);
  const tg = g.createLinearGradient(0, 12, 0, 46); tg.addColorStop(0, '#ffffff'); tg.addColorStop(1, '#8fe3ff'); g.fillStyle = tg; g.fillText('SNOWCONE TYCOON', 14, 30);
  return c.toDataURL('image/jpeg', 0.88);
}
