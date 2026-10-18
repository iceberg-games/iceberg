// Menu-card thumbnail for Corner Bakery Rush, drawn on a canvas (480x270).
export function drawThumb() {
  const W = 480, H = 270, c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
  // dawn sky
  const sky = g.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, '#5a7cc0'); sky.addColorStop(0.55, '#f3b48c'); sky.addColorStop(1, '#ffe2b5');
  g.fillStyle = sky; g.fillRect(0, 0, W, H);
  const sun = g.createRadialGradient(70, 150, 4, 70, 150, 90); sun.addColorStop(0, 'rgba(255,240,200,1)'); sun.addColorStop(1, 'rgba(255,220,160,0)'); g.fillStyle = sun; g.fillRect(0, 40, 200, 200);
  // neighbours
  g.fillStyle = '#7f9cb4'; g.fillRect(0, 70, 70, 160); g.fillStyle = '#c96f53'; g.fillRect(410, 50, 70, 180);
  for (const [x, y] of [[12, 90], [40, 90], [12, 140], [40, 140], [422, 70], [450, 70], [422, 120], [450, 120]]) { g.fillStyle = (x + y) % 3 ? '#ffd892' : '#2a3a5c'; g.fillRect(x, y, 18, 26); }
  // bakery facade (brick)
  g.fillStyle = '#b5523f'; g.fillRect(70, 40, 340, 200);
  g.fillStyle = 'rgba(0,0,0,.08)'; for (let y = 44; y < 240; y += 10) for (let x = 70 + ((y / 10) % 2) * 12; x < 410; x += 24) g.fillRect(x, y, 22, 8);
  g.fillStyle = '#2f5b55'; g.fillRect(64, 32, 352, 12); g.fillStyle = '#f5f9ff'; g.fillRect(64, 26, 352, 7);
  // sign
  g.fillStyle = '#244a45'; g.beginPath(); g.roundRect(130, 52, 220, 44, 10); g.fill(); g.strokeStyle = '#d9b25c'; g.lineWidth = 4; g.stroke();
  g.font = '900 26px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  const tg = g.createLinearGradient(0, 58, 0, 92); tg.addColorStop(0, '#fff2bf'); tg.addColorStop(1, '#d9a33a'); g.fillStyle = tg; g.fillText('Corner Bakery', 240, 75);
  // awning stripes
  const aw = (x, w) => { for (let i = 0; i < w / 14; i++) { g.fillStyle = i % 2 ? '#fbf3e4' : '#d6453b'; g.beginPath(); g.moveTo(x + i * 14, 108); g.lineTo(x + i * 14 + 14, 108); g.lineTo(x + i * 14 + 18, 128); g.lineTo(x + i * 14 + 4, 128); g.fill(); } g.fillStyle = '#f5f9ff'; g.fillRect(x, 104, w, 5); };
  aw(84, 126); aw(270, 126); aw(220, 42);
  // glowing windows
  for (const x of [90, 276]) {
    const wg = g.createLinearGradient(0, 132, 0, 220); wg.addColorStop(0, '#ffe7b0'); wg.addColorStop(1, '#f2a85a'); g.fillStyle = wg; g.fillRect(x, 132, 114, 86);
    g.fillStyle = '#fbf6ec'; g.fillRect(x + 55, 132, 4, 86); g.fillRect(x - 4, 218, 122, 6);
    // pastries in window
    for (let k = 0; k < 4; k++) { g.fillStyle = '#c98a3e'; g.beginPath(); g.ellipse(x + 16 + k * 27, 206, 11, 6, 0, 0, 7); g.fill(); }
  }
  g.fillStyle = '#2f5b55'; g.fillRect(222, 132, 36, 98); g.fillStyle = '#ffe2a6'; g.fillRect(228, 140, 24, 50);
  // neon OPEN
  g.fillStyle = '#1b0f18'; g.beginPath(); g.roundRect(300, 142, 52, 22, 6); g.fill();
  g.font = '900 15px sans-serif'; g.shadowColor = '#ff4fa3'; g.shadowBlur = 10; g.fillStyle = '#ffd0ea'; g.fillText('OPEN', 326, 154); g.shadowBlur = 0;
  // sidewalk + snow
  g.fillStyle = '#c9ccd2'; g.fillRect(0, 230, W, 40); g.fillStyle = '#f5f9ff'; for (let i = 0; i < 16; i++) { g.beginPath(); g.ellipse(i * 34 + 10, 266, 26, 9, 0, 0, 7); g.fill(); }
  // blocky baker with chef hat holding a tray
  const bx = 392, by = 250;
  g.fillStyle = '#4a9e4a'; g.fillRect(bx - 16, by - 34, 15, 34); g.fillRect(bx + 1, by - 34, 15, 34);
  g.fillStyle = '#ffffff'; g.fillRect(bx - 16, by - 68, 32, 34); g.fillStyle = '#f5cd30'; g.fillRect(bx - 32, by - 68, 15, 30); g.fillRect(bx + 17, by - 68, 15, 30);
  g.fillRect(bx - 10, by - 90, 20, 20); g.fillStyle = '#222'; g.fillRect(bx - 6, by - 84, 3, 5); g.fillRect(bx + 3, by - 84, 3, 5);
  g.fillStyle = '#fff'; g.fillRect(bx - 11, by - 98, 22, 8); g.beginPath(); g.arc(bx - 6, by - 102, 8, 0, 7); g.arc(bx + 6, by - 102, 8, 0, 7); g.arc(bx, by - 106, 9, 0, 7); g.fill();
  // giant croissant + coffee in the foreground
  const cr = (x, y, s) => { g.fillStyle = '#d98b36'; for (const [dx, r] of [[-1.6, 0.7], [-0.8, 0.95], [0, 1.1], [0.8, 0.95], [1.6, 0.7]]) { g.beginPath(); g.ellipse(x + dx * s, y - Math.abs(dx) * -0.1 * s, r * s * 0.55, r * s * 0.75, dx * 0.4, 0, 7); g.fill(); }
    g.strokeStyle = '#a65e1d'; g.lineWidth = 2; for (const dx of [-1.2, -0.4, 0.4, 1.2]) { g.beginPath(); g.moveTo(x + dx * s, y - 0.7 * s); g.lineTo(x + dx * s, y + 0.7 * s); g.stroke(); } };
  cr(60, 238, 22);
  g.fillStyle = '#ffffff'; g.beginPath(); g.roundRect(118, 214, 34, 34, 6); g.fill(); g.fillStyle = '#7a4b26'; g.fillRect(118, 214, 34, 7); g.strokeStyle = '#fff'; g.lineWidth = 5; g.beginPath(); g.arc(156, 230, 8, -1.2, 1.2); g.stroke();
  g.strokeStyle = 'rgba(255,255,255,.8)'; g.lineWidth = 3; for (const x of [127, 140]) { g.beginPath(); g.moveTo(x, 208); g.bezierCurveTo(x - 8, 198, x + 8, 192, x, 180); g.stroke(); }
  // snowflakes
  g.fillStyle = 'rgba(255,255,255,.9)'; for (let i = 0; i < 45; i++) { g.beginPath(); g.arc((i * 97) % W, (i * 53) % 230, 1.2 + (i % 3), 0, 7); g.fill(); }
  // title ribbon
  g.font = '900 30px "Arial Rounded MT Bold", Arial, sans-serif'; g.textAlign = 'left'; g.lineWidth = 7; g.strokeStyle = '#5a2e12';
  g.strokeText('BAKERY RUSH', 14, 30); const t2 = g.createLinearGradient(0, 10, 0, 42); t2.addColorStop(0, '#fff3c4'); t2.addColorStop(1, '#f2a53a'); g.fillStyle = t2; g.fillText('BAKERY RUSH', 14, 30);
  return c.toDataURL('image/jpeg', 0.88);
}
