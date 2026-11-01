// Menu-card thumbnail: generated procedurally at load (icy sled + power-up orbs), no binary asset.
function draw() {
  if (typeof document === 'undefined') return null;
  try {
    const c = document.createElement('canvas'); c.width = 640; c.height = 360; const g = c.getContext('2d');
    const sky = g.createLinearGradient(0, 0, 0, 360); sky.addColorStop(0, '#7fc8ff'); sky.addColorStop(0.55, '#d8f1ff'); sky.addColorStop(1, '#ffffff'); g.fillStyle = sky; g.fillRect(0, 0, 640, 360);
    g.fillStyle = '#b9dcf5'; g.beginPath(); g.moveTo(0, 210); [[90, 120], [170, 190], [260, 90], [360, 180], [450, 110], [560, 170], [640, 130], [640, 240], [0, 240]].forEach(([x, y]) => g.lineTo(x, y)); g.fill();
    g.fillStyle = '#eaf7ff'; g.beginPath(); g.moveTo(140, 360); g.quadraticCurveTo(300, 200, 330, 190); g.quadraticCurveTo(360, 200, 520, 360); g.fill();
    const orb = (x, y, r, col, t) => { const rg = g.createRadialGradient(x - r / 3, y - r / 3, 2, x, y, r); rg.addColorStop(0, '#fff'); rg.addColorStop(1, col); g.fillStyle = rg; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); g.font = `${r}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(t, x, y + 2); };
    orb(110, 90, 34, '#ffd84a', '🚀'); orb(530, 80, 30, '#7fe3ff', '🛡️'); orb(560, 250, 26, '#ff7ad9', '🧲'); orb(80, 260, 26, '#a9c8ff', '❄️');
    g.fillStyle = '#e0435f'; g.fillRect(270, 285, 100, 18); g.fillStyle = '#c0793c'; g.fillRect(278, 270, 84, 16);
    g.font = '900 54px system-ui,sans-serif'; g.textAlign = 'center'; g.lineWidth = 10; g.strokeStyle = '#2a7fd0'; g.strokeText('GLACIER DRIFT', 320, 340 - 290 + 20); g.fillStyle = '#fff'; g.fillText('GLACIER DRIFT', 320, 70);
    return c.toDataURL('image/png');
  } catch { return null; }
}
export default draw();
