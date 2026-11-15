// Frostlings thumbnail (procedural canvas -> data URL): three blocky Frostlings in a snowy meadow under an aurora.
export function drawThumb() {
  const c = document.createElement('canvas'); c.width = 480; c.height = 270; const g = c.getContext('2d');
  const bg = g.createLinearGradient(0, 0, 0, 270); bg.addColorStop(0, '#1c1f45'); bg.addColorStop(0.5, '#4a5aa8'); bg.addColorStop(1, '#bfe4ff'); g.fillStyle = bg; g.fillRect(0, 0, 480, 270);
  for (let i = 0; i < 3; i++) { const a = g.createLinearGradient(0, 20 + i * 18, 0, 90 + i * 18); a.addColorStop(0, 'rgba(95,255,208,0)'); a.addColorStop(0.5, i % 2 ? 'rgba(255,122,217,.45)' : 'rgba(95,255,208,.5)'); a.addColorStop(1, 'rgba(95,255,208,0)'); g.fillStyle = a; g.beginPath(); g.moveTo(0, 40 + i * 20); for (let x = 0; x <= 480; x += 20) g.lineTo(x, 40 + i * 20 + Math.sin(x * 0.02 + i) * 18); g.lineTo(480, 120 + i * 20); g.lineTo(0, 120 + i * 20); g.fill(); }
  g.fillStyle = '#fff'; for (let i = 0; i < 40; i++) g.fillRect((i * 97) % 480, (i * 53) % 110, 2, 2);
  g.fillStyle = '#f4fbff'; g.beginPath(); g.ellipse(240, 290, 330, 110, 0, 0, 7); g.fill();
  const pine = (x, y, s) => { g.fillStyle = '#2f7d5b'; for (let k = 0; k < 3; k++) { g.beginPath(); g.moveTo(x, y - (70 - k * 18) * s); g.lineTo(x - (30 - k * 6) * s, y - (20 - k * 18) * s + 20 * s); g.lineTo(x + (30 - k * 6) * s, y - (20 - k * 18) * s + 20 * s); g.fill(); } g.fillStyle = '#fff'; g.beginPath(); g.moveTo(x, y - 70 * s); g.lineTo(x - 10 * s, y - 56 * s); g.lineTo(x + 10 * s, y - 56 * s); g.fill(); };
  pine(40, 230, 1.3); pine(440, 225, 1.4); pine(90, 205, 0.9); pine(395, 200, 0.9);
  const mon = (x, y, s, body, acc, ear, tail) => {
    g.save(); g.translate(x, y); g.scale(s, s);
    g.fillStyle = 'rgba(0,0,0,.12)'; g.beginPath(); g.ellipse(0, 4, 36, 8, 0, 0, 7); g.fill();
    g.fillStyle = acc; g.fillRect(-26, -8, 14, 10); g.fillRect(12, -8, 14, 10);
    if (tail === 'flame') { g.fillStyle = '#ffcf4a'; g.fillRect(28, -52, 18, 22); g.fillStyle = '#fff3b0'; g.fillRect(32, -62, 10, 12); } else if (tail === 'fin') { g.fillStyle = acc; g.fillRect(28, -46, 8, 26); } else { g.fillStyle = '#fff'; g.fillRect(26, -42, 18, 18); }
    g.fillStyle = body; g.fillRect(-32, -58, 64, 54); g.fillRect(-28, -100, 56, 46);
    g.fillStyle = 'rgba(255,255,255,.9)'; g.fillRect(-20, -46, 40, 30);
    if (ear === 'cat') { g.fillStyle = body; g.beginPath(); g.moveTo(-28, -100); g.lineTo(-20, -122); g.lineTo(-10, -100); g.fill(); g.beginPath(); g.moveTo(28, -100); g.lineTo(20, -122); g.lineTo(10, -100); g.fill(); g.fillStyle = acc; g.fillRect(-21, -110, 6, 8); g.fillRect(15, -110, 6, 8); }
    else if (ear === 'fin') { g.fillStyle = acc; g.fillRect(-36, -96, 10, 22); g.fillRect(26, -96, 10, 22); }
    g.fillStyle = '#1a1530'; g.fillRect(-16, -86, 9, 12); g.fillRect(7, -86, 9, 12); g.fillStyle = '#fff'; g.fillRect(-12, -84, 3, 3); g.fillRect(11, -84, 3, 3);
    g.fillStyle = '#ff9fb8'; g.fillRect(-24, -72, 8, 5); g.fillRect(16, -72, 8, 5); g.fillStyle = '#1a1530'; g.fillRect(-4, -70, 8, 3);
    g.restore();
  };
  mon(130, 232, 1.0, '#ff9a5a', '#c4461a', 'cat', 'flame');
  mon(350, 232, 1.0, '#6cc0ff', '#1c5bb8', 'fin', 'fin');
  mon(240, 248, 1.3, '#eaf7ff', '#8fd8ff', 'cat', 'fluff');
  g.save(); g.translate(240, 150); g.strokeStyle = '#ff7ad9'; g.lineWidth = 5; g.shadowColor = '#ff7ad9'; g.shadowBlur = 14; g.beginPath(); g.ellipse(0, 0, 16, 16, 0, 0, 7); g.stroke(); g.restore();
  g.font = '900 52px system-ui, sans-serif'; g.textAlign = 'center'; g.lineWidth = 10; g.strokeStyle = '#1d2a6a'; g.strokeText('FROSTLINGS', 240, 62); g.fillStyle = '#fff'; g.fillText('FROSTLINGS', 240, 62);
  g.font = '800 16px system-ui, sans-serif'; g.lineWidth = 5; g.strokeText('tame · raise · battle', 240, 86); g.fillStyle = '#ffe680'; g.fillText('tame · raise · battle', 240, 86);
  return c.toDataURL('image/png');
}
