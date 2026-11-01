// Menu thumbnail (480x270): aurora sky + faceted crystal needle with a glowing summit beacon.
export function drawThumb() {
  const W = 480, H = 270, c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
  const sky = g.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, '#0e1f4e'); sky.addColorStop(0.6, '#2c5596'); sky.addColorStop(1, '#bfe2ff'); g.fillStyle = sky; g.fillRect(0, 0, W, H);
  for (const [col, y] of [['rgba(79,240,208,.35)', 60], ['rgba(196,155,255,.3)', 90]]) { g.strokeStyle = col; g.lineWidth = 22; g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(140, y - 50, 300, y + 50, 480, y - 20); g.stroke(); }
  g.fillStyle = '#fff'; for (let i = 0; i < 60; i++) g.fillRect((i * 97) % W, (i * 53) % 120, 1.5, 1.5);
  g.fillStyle = '#7484a8'; for (const [x, h] of [[40, 80], [130, 60], [380, 95], [450, 70]]) { g.beginPath(); g.moveTo(x - 70, 240); g.lineTo(x, 240 - h); g.lineTo(x + 70, 240); g.fill(); }
  g.fillStyle = '#eef5ff'; g.fillRect(0, 232, W, 40);
  const n = g.createLinearGradient(200, 0, 280, 0); n.addColorStop(0, '#7fd4ff'); n.addColorStop(0.5, '#e6f6ff'); n.addColorStop(1, '#8fb0ff');
  g.fillStyle = n; g.beginPath(); g.moveTo(195, 240); g.lineTo(240, 26); g.lineTo(285, 240); g.fill();
  g.strokeStyle = 'rgba(255,255,255,.6)'; g.lineWidth = 2; g.beginPath(); g.moveTo(240, 26); g.lineTo(232, 240); g.stroke();
  const cols = ['#7fd4ff', '#c49bff', '#ff8fd0', '#4ff0d0'];
  for (let i = 0; i < 12; i++) { const y = 225 - i * 16, side = i % 2 ? 1 : -1, x = 240 + side * (40 - i * 2.2); g.fillStyle = cols[i % 4]; g.fillRect(x - 14, y, 28, 6); }
  const b = g.createRadialGradient(240, 24, 2, 240, 24, 40); b.addColorStop(0, '#fff'); b.addColorStop(0.3, '#ffe08a'); b.addColorStop(1, 'rgba(255,224,138,0)'); g.fillStyle = b; g.fillRect(190, -20, 100, 90);
  g.font = '900 34px "Arial Rounded MT Bold", Arial, sans-serif'; g.textAlign = 'center'; g.shadowColor = '#7fd4ff'; g.shadowBlur = 16; g.fillStyle = '#ffffff'; g.fillText('CRYSTAL SPIRE', 240, 262); g.shadowBlur = 0;
  return c.toDataURL('image/png');
}
