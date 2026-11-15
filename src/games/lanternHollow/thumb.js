// Menu thumbnail (480x270): night hollow, aurora, glowing lantern held up against the dark, cave mouth.
export function drawThumb() {
  const W = 480, H = 270, c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
  const sky = g.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, '#070a24'); sky.addColorStop(0.55, '#24245a'); sky.addColorStop(1, '#3a2a5a'); g.fillStyle = sky; g.fillRect(0, 0, W, H);
  for (const [col, y, w] of [['rgba(80,255,170,.32)', 55, 26], ['rgba(190,110,255,.26)', 85, 20]]) { g.strokeStyle = col; g.lineWidth = w; g.beginPath(); g.moveTo(-10, y); g.bezierCurveTo(150, y - 45, 320, y + 45, 490, y - 15); g.stroke(); }
  g.fillStyle = '#fff'; for (let i = 0; i < 70; i++) g.fillRect((i * 89) % W, (i * 41) % 130, 1.5, 1.5);
  g.fillStyle = '#141633'; g.beginPath(); g.moveTo(0, 270); g.lineTo(0, 150); g.lineTo(90, 110); g.lineTo(170, 160); g.lineTo(250, 120); g.lineTo(360, 170); g.lineTo(480, 130); g.lineTo(480, 270); g.fill();
  g.fillStyle = '#0a0a1a'; g.beginPath(); g.ellipse(360, 205, 70, 55, 0, Math.PI, 0); g.fill();
  for (let i = 0; i < 6; i++) { g.fillStyle = ['#4ff0d0', '#c49bff'][i % 2]; g.globalAlpha = 0.8; g.beginPath(); g.arc(310 + i * 20, 195 - (i % 3) * 10, 4, 0, 6.3); g.fill(); } g.globalAlpha = 1;
  g.fillStyle = '#e9eefc'; g.fillRect(0, 222, W, 48);
  for (const [x, s] of [[30, 1], [70, 0.8], [440, 1.1], [400, 0.7]]) { g.fillStyle = '#1f4a3f'; for (let k = 0; k < 3; k++) { g.beginPath(); g.moveTo(x - 26 * s + k * 5 * s, 225 - k * 24 * s); g.lineTo(x, 175 * 1 - k * 24 * s - 10 * s); g.lineTo(x + 26 * s - k * 5 * s, 225 - k * 24 * s); g.fill(); } }
  const glow = g.createRadialGradient(190, 150, 4, 190, 150, 120); glow.addColorStop(0, 'rgba(255,220,140,.95)'); glow.addColorStop(0.25, 'rgba(255,170,70,.5)'); glow.addColorStop(1, 'rgba(255,140,60,0)');
  g.fillStyle = glow; g.fillRect(60, 30, 260, 240);
  g.fillStyle = '#c79a4a'; g.fillRect(180, 128, 20, 4); g.fillRect(180, 166, 20, 4); g.beginPath(); g.moveTo(178, 128); g.lineTo(190, 116); g.lineTo(202, 128); g.fill();
  g.fillStyle = '#fff3c4'; g.fillRect(183, 132, 14, 34);
  g.font = '900 36px "Arial Rounded MT Bold", Arial, sans-serif'; g.textAlign = 'center'; g.shadowColor = '#ff9a3c'; g.shadowBlur = 18; g.fillStyle = '#fff4dc'; g.fillText('LANTERN HOLLOW', 240, 258); g.shadowBlur = 0;
  return c.toDataURL('image/png');
}
