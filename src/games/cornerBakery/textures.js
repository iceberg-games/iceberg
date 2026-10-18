// Procedural canvas textures for the bakery (no image files).
import * as THREE from 'three';
import { mulberry } from './logic.js';

const made = [];
export function disposeTextures() { while (made.length) made.pop().dispose(); }

export function canvasTex(w, h, draw, { repeat = [1, 1], srgb = true, aniso = 4 } = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); t.anisotropy = aniso;
  made.push(t); return t;
}

/** Classic two-tone checker tile floor with grout and subtle wear. */
export const checkerTex = (a = '#f3ead8', b = '#3f6f6a', repeat = [9, 7]) => canvasTex(256, 256, (g, w) => {
  const r = mulberry(11), n = 4, s = w / n;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    g.fillStyle = (x + y) % 2 ? b : a; g.fillRect(x * s, y * s, s, s);
    for (let k = 0; k < 60; k++) { g.fillStyle = `rgba(${(x + y) % 2 ? '255,255,255' : '120,90,60'},${r() * 0.05})`; g.fillRect(x * s + r() * s, y * s + r() * s, 3 + r() * 10, 2 + r() * 6); }
  }
  g.strokeStyle = 'rgba(80,70,60,.35)'; g.lineWidth = 2;
  for (let i = 0; i <= n; i++) { g.beginPath(); g.moveTo(i * s, 0); g.lineTo(i * s, w); g.moveTo(0, i * s); g.lineTo(w, i * s); g.stroke(); }
}, { repeat });

/** Small square kitchen tiles. */
export const kitchenTileTex = () => canvasTex(256, 256, (g, w) => {
  const r = mulberry(5), n = 8, s = w / n;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { const v = 222 + r() * 16; g.fillStyle = `rgb(${v},${v - 4},${v - 14})`; g.fillRect(x * s, y * s, s, s); }
  g.strokeStyle = '#b9ae9c'; g.lineWidth = 2;
  for (let i = 0; i <= n; i++) { g.beginPath(); g.moveTo(i * s, 0); g.lineTo(i * s, w); g.moveTo(0, i * s); g.lineTo(w, i * s); g.stroke(); }
}, { repeat: [6, 2] });

/** White subway tiles (brick bond). */
export const subwayTex = (repeat = [6, 2]) => canvasTex(256, 256, (g, w) => {
  g.fillStyle = '#cfd6d6'; g.fillRect(0, 0, w, w);
  const r = mulberry(3), th = 32, tw = 64;
  for (let y = 0; y < w / th; y++) for (let x = -1; x < w / tw + 1; x++) {
    const ox = (y % 2) * tw / 2, px = x * tw + ox, py = y * th;
    const gr = g.createLinearGradient(0, py, 0, py + th); const v = 244 + r() * 8;
    gr.addColorStop(0, `rgb(${v},${v},${v})`); gr.addColorStop(1, `rgb(${v - 14},${v - 12},${v - 10})`);
    g.fillStyle = gr; g.beginPath(); g.roundRect(px + 2, py + 2, tw - 4, th - 4, 5); g.fill();
  }
}, { repeat });

/** Warm painted plaster. */
export const plasterTex = (base = '#f6e7cf', repeat = [4, 2]) => canvasTex(256, 256, (g, w) => {
  g.fillStyle = base; g.fillRect(0, 0, w, w);
  const r = mulberry(9);
  for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(${r() < 0.5 ? '255,255,255' : '160,120,80'},${r() * 0.05})`; g.beginPath(); g.arc(r() * w, r() * w, 2 + r() * 9, 0, 7); g.fill(); }
}, { repeat });

/** Vertical beadboard paneling. */
export const beadboardTex = (base = '#4f8a7e', repeat = [8, 1]) => canvasTex(128, 128, (g, w) => {
  g.fillStyle = base; g.fillRect(0, 0, w, w);
  for (let x = 0; x < w; x += 16) {
    g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(x, 0, 2, w);
    g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(x + 2, 0, 2, w);
  }
}, { repeat });

/** Red brick with mortar, slightly varied. */
export const brickTex = (repeat = [8, 6], hue = 0) => canvasTex(256, 256, (g, w) => {
  g.fillStyle = '#d9cfc3'; g.fillRect(0, 0, w, w);
  const r = mulberry(21 + hue), bh = 21.33, bw = 64;
  for (let y = 0; y < 12; y++) for (let x = -1; x < 5; x++) {
    const px = x * bw + (y % 2) * bw / 2, py = y * bh;
    const v = r();
    g.fillStyle = hue ? `hsl(${hue + v * 10},${32 + v * 10}%,${46 + v * 10}%)` : `hsl(${8 + v * 10},${48 + v * 12}%,${38 + v * 12}%)`;
    g.fillRect(px + 2, py + 2, bw - 4, bh - 4);
    g.fillStyle = 'rgba(0,0,0,.08)'; g.fillRect(px + 2, py + bh - 6, bw - 4, 4);
  }
}, { repeat });

/** Wood planks / grain. */
export const woodTex = (base = [150, 98, 58], repeat = [2, 1]) => canvasTex(256, 128, (g, w, h) => {
  const r = mulberry(13);
  for (let y = 0; y < h; y += 16) {
    const v = r() * 20 - 10; g.fillStyle = `rgb(${base[0] + v},${base[1] + v},${base[2] + v})`; g.fillRect(0, y, w, 16);
    g.strokeStyle = 'rgba(60,30,10,.18)';
    for (let k = 0; k < 3; k++) { g.beginPath(); const yy = y + 3 + r() * 10; g.moveTo(0, yy); g.bezierCurveTo(w * 0.3, yy + 2, w * 0.6, yy - 2, w, yy); g.stroke(); }
    g.fillStyle = 'rgba(40,20,5,.35)'; g.fillRect(0, y, w, 1);
  }
}, { repeat });

/** White marble counter top. */
export const marbleTex = () => canvasTex(256, 256, (g, w) => {
  g.fillStyle = '#f4f1ec'; g.fillRect(0, 0, w, w);
  const r = mulberry(17);
  g.lineCap = 'round';
  for (let i = 0; i < 14; i++) {
    g.strokeStyle = `rgba(140,135,130,${0.08 + r() * 0.15})`; g.lineWidth = 0.6 + r() * 1.6;
    g.beginPath(); let x = r() * w, y = r() * w; g.moveTo(x, y);
    for (let k = 0; k < 6; k++) { x += (r() - 0.3) * 60; y += (r() - 0.5) * 40; g.lineTo(x, y); } g.stroke();
  }
}, { repeat: [3, 1] });

/** Concrete sidewalk slabs with a dusting of snow. */
export const sidewalkTex = () => canvasTex(256, 256, (g, w) => {
  const r = mulberry(31);
  g.fillStyle = '#b9bcc2'; g.fillRect(0, 0, w, w);
  for (let i = 0; i < 1500; i++) { const v = 150 + r() * 70; g.fillStyle = `rgba(${v},${v},${v + 6},.35)`; g.fillRect(r() * w, r() * w, 2, 2); }
  g.strokeStyle = 'rgba(70,72,80,.5)'; g.lineWidth = 3;
  for (let i = 0; i <= 2; i++) { g.beginPath(); g.moveTo(i * 128, 0); g.lineTo(i * 128, w); g.moveTo(0, i * 128); g.lineTo(w, i * 128); g.stroke(); }
  for (let i = 0; i < 70; i++) { g.fillStyle = `rgba(255,255,255,${0.35 + r() * 0.5})`; g.beginPath(); g.ellipse(r() * w, r() * w, 6 + r() * 26, 3 + r() * 10, r() * 3, 0, 7); g.fill(); }
}, { repeat: [14, 2] });

/** Snowy asphalt with tyre tracks. */
export const roadTex = () => canvasTex(512, 256, (g, w, h) => {
  const r = mulberry(41);
  g.fillStyle = '#4b4f58'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 4000; i++) { const v = 60 + r() * 50; g.fillStyle = `rgba(${v},${v},${v + 8},.5)`; g.fillRect(r() * w, r() * h, 2, 2); }
  for (let i = 0; i < 260; i++) { g.fillStyle = `rgba(245,248,255,${0.3 + r() * 0.6})`; g.beginPath(); g.ellipse(r() * w, (r() < 0.5 ? r() * 40 : h - r() * 40), 8 + r() * 40, 3 + r() * 9, 0, 0, 7); g.fill(); }
  g.fillStyle = 'rgba(255,214,90,.8)'; for (let x = 0; x < w; x += 64) g.fillRect(x + 8, h / 2 - 3, 36, 6);
}, { repeat: [6, 1] });

export const snowTex = () => canvasTex(128, 128, (g, w) => {
  const r = mulberry(51); g.fillStyle = '#f4f8ff'; g.fillRect(0, 0, w, w);
  for (let i = 0; i < 500; i++) { const v = 225 + r() * 30; g.fillStyle = `rgba(${v - 12},${v - 4},255,.4)`; g.fillRect(r() * w, r() * w, 2, 2); }
}, { repeat: [10, 2] });

/** Red/cream awning stripes. */
export const awningTex = (a = '#d6453b', b = '#fbf3e4') => canvasTex(128, 64, (g, w, h) => {
  for (let x = 0; x < 8; x++) { g.fillStyle = x % 2 ? b : a; g.fillRect(x * 16, 0, 16, h); }
  g.fillStyle = 'rgba(0,0,0,.08)'; g.fillRect(0, h - 8, w, 8);
}, { repeat: [3, 1] });

/** Wooden shop sign with gold lettering. */
export const signTex = (text, sub) => canvasTex(1024, 256, (g, w, h) => {
  const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#2f5b55'); gr.addColorStop(1, '#1f403c');
  g.fillStyle = gr; g.beginPath(); g.roundRect(6, 6, w - 12, h - 12, 28); g.fill();
  g.lineWidth = 10; g.strokeStyle = '#d9b25c'; g.stroke();
  g.lineWidth = 3; g.strokeStyle = 'rgba(217,178,92,.6)'; g.beginPath(); g.roundRect(26, 26, w - 52, h - 52, 18); g.stroke();
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = '900 118px Georgia, "Times New Roman", serif';
  g.fillStyle = '#7a5a1c'; g.fillText(text, w / 2 + 4, h / 2 - 14 + 5);
  const tg = g.createLinearGradient(0, 40, 0, 190); tg.addColorStop(0, '#fff2bf'); tg.addColorStop(0.5, '#f1c75b'); tg.addColorStop(1, '#c08a2a');
  g.fillStyle = tg; g.fillText(text, w / 2, h / 2 - 14);
  if (sub) { g.font = '700 34px Georgia, serif'; g.fillStyle = '#f3e3b6'; g.fillText(sub, w / 2, h - 46); }
}, { repeat: [1, 1] });

/** Gold window lettering on transparent background. */
export const windowLetterTex = (text, sub) => canvasTex(1024, 512, (g, w, h) => {
  g.clearRect(0, 0, w, h);
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = 'italic 900 130px Georgia, serif';
  g.lineWidth = 10; g.strokeStyle = 'rgba(90,60,10,.85)'; g.strokeText(text, w / 2, h * 0.38);
  const tg = g.createLinearGradient(0, 120, 0, 260); tg.addColorStop(0, '#fff3c4'); tg.addColorStop(1, '#d9a33a');
  g.fillStyle = tg; g.fillText(text, w / 2, h * 0.38);
  if (sub) { g.font = '700 54px Georgia, serif'; g.fillStyle = '#f6dc93'; g.fillText(sub, w / 2, h * 0.66); }
}, { repeat: [1, 1] });

/** Neon "OPEN" sign: emissive on dark. */
export const neonTex = () => canvasTex(256, 128, (g, w, h) => {
  g.fillStyle = '#120a14'; g.beginPath(); g.roundRect(4, 4, w - 8, h - 8, 22); g.fill();
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = '900 74px "Arial Rounded MT Bold", Arial, sans-serif';
  g.shadowColor = '#ff4fa3'; g.shadowBlur = 22; g.fillStyle = '#ffd0ea'; g.fillText('OPEN', w / 2, h / 2 + 2);
  g.shadowBlur = 8; g.strokeStyle = '#ff6ab7'; g.lineWidth = 3; g.strokeText('OPEN', w / 2, h / 2 + 2);
  g.shadowBlur = 14; g.shadowColor = '#5fd4ff'; g.strokeStyle = '#8fe3ff'; g.lineWidth = 5; g.beginPath(); g.roundRect(12, 12, w - 24, h - 24, 18); g.stroke();
}, { repeat: [1, 1] });

/** Lit windows for buildings across the street. */
export const facadeTex = (base, seed, cols = 4, rows = 3) => canvasTex(256, 256, (g, w, h) => {
  const r = mulberry(seed);
  g.fillStyle = base; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 400; i++) { g.fillStyle = `rgba(0,0,0,${r() * 0.06})`; g.fillRect(r() * w, r() * h, 6, 3); }
  const cw = w / cols, rh = h / rows;
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
    const lit = r() < 0.55, px = x * cw + cw * 0.22, py = y * rh + rh * 0.2, ww = cw * 0.56, hh = rh * 0.55;
    g.fillStyle = '#e9e2d6'; g.fillRect(px - 4, py - 4, ww + 8, hh + 8);
    const gr = g.createLinearGradient(0, py, 0, py + hh);
    if (lit) { gr.addColorStop(0, '#ffe2a1'); gr.addColorStop(1, '#f2a85a'); } else { gr.addColorStop(0, '#2a3a5c'); gr.addColorStop(1, '#1a2440'); }
    g.fillStyle = gr; g.fillRect(px, py, ww, hh);
    g.fillStyle = 'rgba(255,255,255,.7)'; g.fillRect(px + ww / 2 - 1.5, py, 3, hh); g.fillRect(px, py + hh / 2 - 1.5, ww, 3);
    g.fillStyle = '#f7fbff'; g.fillRect(px - 6, py + hh + 4, ww + 12, 7); // snowy sill
  }
}, { repeat: [1, 1] });

/** The chalkboard menu (redrawn per day). */
export function drawChalkboard(g, w, h, day, items) {
  g.fillStyle = '#6b4a2c'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#26302b'; g.fillRect(16, 16, w - 32, h - 32);
  const r = mulberry(61); for (let i = 0; i < 300; i++) { g.fillStyle = `rgba(255,255,255,${r() * 0.04})`; g.beginPath(); g.arc(r() * w, r() * h, 4 + r() * 20, 0, 7); g.fill(); }
  g.textAlign = 'center'; g.fillStyle = '#fdf6e3'; g.font = '700 52px "Comic Sans MS", "Chalkboard SE", cursive';
  g.fillText(`Today's Menu`, w / 2, 78);
  g.font = '700 26px "Comic Sans MS", "Chalkboard SE", cursive'; g.fillStyle = '#ffd98a';
  g.fillText(`Day ${day.n} · ${day.name}`, w / 2, 116);
  g.textAlign = 'left'; g.font = '600 30px "Comic Sans MS", "Chalkboard SE", cursive';
  items.forEach(([name, price], i) => {
    const col = i % 2, row = Math.floor(i / 2), x = 52 + col * (w / 2 - 20), y = 172 + row * 46;
    g.fillStyle = '#fdf6e3'; g.fillText(name, x, y);
    g.fillStyle = '#9fe0c9'; g.textAlign = 'right'; g.fillText(`${price}¢`, x + w / 2 - 80, y); g.textAlign = 'left';
  });
  g.strokeStyle = 'rgba(253,246,227,.5)'; g.lineWidth = 3; g.beginPath(); g.moveTo(60, 134); g.lineTo(w - 60, 134); g.stroke();
}
