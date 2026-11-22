// Turn a user-chosen image file into a small JPEG data URL (480x270, cover-cropped) that fits the server's
// 300 KB thumbnail cap (custom_game_thumb_max_bytes).
const MAX_BYTES = 280000;
export async function imageToThumb(file, { w = 480, h = 270 } = {}) {
  if (!/^image\/(png|jpeg|webp)$/.test(file.type)) throw new Error('Pick a PNG, JPEG or WebP image');
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => no(new Error('Could not read that image')); i.src = url; });
    const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d');
    const s = Math.max(w / img.width, h / img.height), dw = img.width * s, dh = img.height * s;
    g.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
    for (const q of [0.85, 0.7, 0.55, 0.4]) { const d = c.toDataURL('image/jpeg', q); if (d.length <= MAX_BYTES) return d; }
    throw new Error('That image is too detailed; try a simpler one');
  } finally { URL.revokeObjectURL(url); }
}
