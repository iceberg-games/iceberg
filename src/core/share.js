// Export / import user-made games as a single self-contained JSON file
// (embeds any uploaded models the game uses, base64-encoded).
const toB64 = (buf) => { let s = ''; const b = new Uint8Array(buf); for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000)); return btoa(s); };
const fromB64 = (str) => { const s = atob(str), b = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i); return b.buffer; };

export function exportGameJSON(doc, library) {
  const ids = [...new Set([...(doc.models || []), ...(doc.instances || [])].map(m => m.modelId).filter(Boolean))];
  const models = ids.map(id => library.items.get(id)?.record).filter(Boolean).map(r => ({
    id: r.id, name: r.name, format: r.format,
    encoding: typeof r.data === 'string' ? 'text' : 'base64',
    data: typeof r.data === 'string' ? r.data : toB64(r.data),
  }));
  return JSON.stringify({ format: 'iceberg-game', version: 1, game: doc, models }, null, 0);
}

export function downloadText(filename, text) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  a.download = filename; document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

export async function importGameJSON(text, library) {
  const data = JSON.parse(text);
  if (data.format !== 'iceberg-game' || !data.game) throw new Error('Not an Iceberg game file');
  for (const m of data.models || []) {
    if (library.has(m.id)) continue;
    await library.addRecord({ id: m.id, name: m.name, format: m.format, data: m.encoding === 'base64' ? fromB64(m.data) : m.data, createdAt: Date.now() });
  }
  const doc = { ...data.game, id: 'g_' + Date.now().toString(36), importedAt: Date.now() };
  return doc;
}
