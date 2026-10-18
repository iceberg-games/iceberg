// Minimal DOM helper: h('div.class#id', {attrs, onclick}, ...children)
export function h(sel, props = {}, ...kids) {
  if (typeof props === 'string' || props instanceof Node || Array.isArray(props)) { kids.unshift(props); props = {}; }
  const [tag, ...rest] = sel.split(/(?=[.#])/);
  const el = document.createElement(tag || 'div');
  for (const r of rest) { if (r[0] === '.') el.classList.add(r.slice(1)); else el.id = r.slice(1); }
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k in el && k !== 'list') { try { el[k] = v; } catch { el.setAttribute(k, v); } }
    else el.setAttribute(k, v);
  }
  for (const c of kids.flat()) if (c != null && c !== false) el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  return el;
}
export const clear = (el) => { while (el.firstChild) el.removeChild(el.firstChild); return el; };
