// Snowball Siege thumbnail (procedural canvas -> data URL).
export function drawThumb() {
  const c = document.createElement('canvas'); c.width = 480; c.height = 270; const g = c.getContext('2d');
  const bg = g.createLinearGradient(0, 0, 0, 270); bg.addColorStop(0, '#7cc6ff'); bg.addColorStop(0.55, '#d6eeff'); bg.addColorStop(1, '#ffffff'); g.fillStyle = bg; g.fillRect(0, 0, 480, 270);
  g.fillStyle = '#ffffff'; g.beginPath(); g.ellipse(240, 270, 330, 100, 0, 0, 7); g.fill();
  const fort = (x, col, flip) => {
    g.fillStyle = '#bfe6ff'; g.fillRect(x - 60, 150, 120, 50); g.fillStyle = '#ffffff'; for (let i = 0; i < 5; i++) g.fillRect(x - 60 + i * 26, 140, 16, 12);
    g.fillStyle = '#9fd0f0'; g.fillRect(x - 18, 110, 36, 90); g.fillStyle = '#fff'; g.beginPath(); g.arc(x, 104, 18, 0, 7); g.fill();
    g.strokeStyle = '#6b4423'; g.lineWidth = 3; g.beginPath(); g.moveTo(x, 90); g.lineTo(x, 50); g.stroke();
    g.fillStyle = col; g.beginPath(); g.moveTo(x, 50); g.lineTo(x + (flip ? -34 : 34), 60); g.lineTo(x, 70); g.fill();
  };
  fort(70, '#3fa8ff', false); fort(410, '#ff5d8a', true);
  const kid = (x, y, col, s = 1) => { g.fillStyle = '#ffd34d'; g.fillRect(x - 6 * s, y - 34 * s, 12 * s, 11 * s); g.fillStyle = col; g.fillRect(x - 8 * s, y - 23 * s, 16 * s, 15 * s); g.fillRect(x - 7 * s, y - 40 * s, 14 * s, 6 * s); g.fillStyle = '#2d3a5a'; g.fillRect(x - 7 * s, y - 8 * s, 6 * s, 9 * s); g.fillRect(x + 1 * s, y - 8 * s, 6 * s, 9 * s); };
  kid(180, 235, '#3fa8ff', 1.8); kid(300, 230, '#ff5d8a', 1.7);
  g.strokeStyle = 'rgba(120,180,230,.7)'; g.lineWidth = 4; g.setLineDash([6, 8]); g.beginPath(); g.moveTo(200, 180); g.quadraticCurveTo(250, 120, 292, 178); g.stroke(); g.setLineDash([]);
  g.fillStyle = '#fff'; g.strokeStyle = '#9cc9ea'; g.lineWidth = 3; g.beginPath(); g.arc(292, 180, 10, 0, 7); g.fill(); g.stroke();
  g.font = '900 30px sans-serif'; g.fillStyle = '#ffd24a'; g.strokeStyle = '#1a0f2e'; g.lineWidth = 6; g.strokeText('BONK!', 300, 150); g.fillText('BONK!', 300, 150);
  g.font = '900 44px sans-serif'; g.textAlign = 'center'; g.lineWidth = 10; g.strokeStyle = '#1d4f7a'; g.strokeText('SNOWBALL SIEGE', 240, 46); g.fillStyle = '#fff'; g.fillText('SNOWBALL SIEGE', 240, 46);
  return c.toDataURL('image/png');
}
