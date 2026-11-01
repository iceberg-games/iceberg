// Portal thumbnail, drawn procedurally (480x270).
export default function drawThumb() {
  const c = document.createElement('canvas'); c.width = 480; c.height = 270; const g = c.getContext('2d');
  const bg = g.createLinearGradient(0, 0, 0, 270); bg.addColorStop(0, '#0e1d48'); bg.addColorStop(0.6, '#3d6bb5'); bg.addColorStop(1, '#2c4a80'); g.fillStyle = bg; g.fillRect(0, 0, 480, 270);
  for (let k = 0; k < 3; k++) { g.beginPath(); for (let x = 0; x <= 480; x += 8) g.lineTo(x, 50 + k * 22 + Math.sin(x / 55 + k) * 14); g.lineWidth = 18 - k * 4; g.strokeStyle = ['rgba(90,255,190,.45)', 'rgba(130,190,255,.4)', 'rgba(220,130,255,.35)'][k]; g.stroke(); }
  g.fillStyle = '#eaf3ff'; g.beginPath(); g.ellipse(240, 270, 330, 90, 0, 0, 7); g.fill();
  g.fillStyle = '#bfeaff'; g.beginPath(); g.ellipse(120, 225, 90, 22, 0, 0, 7); g.fill();
  [[60, 170], [420, 160]].forEach(([x, y]) => { const lg = g.createRadialGradient(x, y, 0, x, y, 40); lg.addColorStop(0, 'rgba(255,200,110,.95)'); lg.addColorStop(1, 'rgba(255,160,60,0)'); g.fillStyle = lg; g.fillRect(x - 40, y - 40, 80, 80); });
  const peng = (x, y, s, sc) => { g.fillStyle = '#1f2740'; g.beginPath(); g.ellipse(x, y, 22 * s, 30 * s, 0, 0, 7); g.fill(); g.beginPath(); g.arc(x, y - 36 * s, 16 * s, 0, 7); g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.ellipse(x, y + 3 * s, 15 * s, 22 * s, 0, 0, 7); g.fill(); g.beginPath(); g.ellipse(x, y - 34 * s, 11 * s, 9 * s, 0, 0, 7); g.fill(); g.fillStyle = '#ff9a2e'; g.beginPath(); g.moveTo(x - 4 * s, y - 32 * s); g.lineTo(x + 4 * s, y - 32 * s); g.lineTo(x, y - 25 * s); g.fill(); g.fillStyle = '#111'; g.fillRect(x - 6 * s, y - 39 * s, 3 * s, 3 * s); g.fillRect(x + 3 * s, y - 39 * s, 3 * s, 3 * s); g.fillStyle = sc; g.fillRect(x - 15 * s, y - 24 * s, 30 * s, 6 * s); };
  peng(250, 205, 1.6, '#ff5f7e'); peng(330, 215, 1.1, '#5fd0ff'); peng(120, 210, 0.9, '#ffd36b');
  g.font = '40px serif'; g.fillText('☕', 360, 150); g.fillText('👋', 290, 120);
  g.font = '900 40px system-ui,sans-serif'; g.lineWidth = 8; g.strokeStyle = '#0e1d48'; g.strokeText('PENGU PLAZA', 20, 50); g.fillStyle = '#fff3d6'; g.fillText('PENGU PLAZA', 20, 50);
  return c.toDataURL('image/jpeg', 0.85);
}
