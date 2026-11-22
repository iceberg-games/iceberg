// Screen GUI for Studio games: buttons, labels, frames/images, and bars.
// Stored on the game doc as doc.gui[] (plain JSON) and drawn as a 2D overlay
// in the editor and in play. HUD stays fixed on screen (anchored, not in 3D).
import { translate } from './nlscript.js';

export const GUI_TYPES = ['button', 'label', 'frame', 'image', 'bar'];
export const GUI_ANCHORS = ['top-left', 'top', 'top-right', 'left', 'center', 'right', 'bottom-left', 'bottom', 'bottom-right'];

const nid = (p = 'gui') => p + '_' + Math.random().toString(36).slice(2, 10);

const DEFAULTS = {
  button: { w: 140, h: 40, text: 'Button', anchor: 'bottom' },
  label: { w: 160, h: 28, text: 'Label', anchor: 'top-right' },
  frame: { w: 280, h: 200, text: 'Panel', anchor: 'center' },
  image: { w: 96, h: 96, text: '', anchor: 'top-left' },
  bar: { w: 180, h: 18, text: 'Health', anchor: 'top-left', bind: 'health', max: 100 },
};

export function makeGuiElement(type = 'label', over = {}) {
  const t = GUI_TYPES.includes(type) ? type : 'label';
  const d = DEFAULTS[t];
  return {
    id: over.id || nid(),
    type: t,
    name: over.name || over.text || d.text || t,
    text: over.text != null ? String(over.text).slice(0, 48) : d.text,
    anchor: GUI_ANCHORS.includes(over.anchor) ? over.anchor : d.anchor,
    x: Number.isFinite(+over.x) ? +over.x : 16,
    y: Number.isFinite(+over.y) ? +over.y : 16,
    w: Math.max(24, Number.isFinite(+over.w) ? +over.w : d.w),
    h: Math.max(16, Number.isFinite(+over.h) ? +over.h : d.h),
    color: over.color || null,
    textColor: over.textColor || null,
    visible: over.visible !== false,
    bind: over.bind || d.bind || null,
    max: Number.isFinite(+over.max) ? +over.max : (d.max || 100),
    src: over.src || '',
    scriptText: over.scriptText || '',
    program: over.program || null,
    toggles: over.toggles || null,
  };
}

/** CSS position for an anchored element. x/y are offsets from the anchor in px. */
export function anchorStyle(el) {
  const x = Math.round(el.x || 0), y = Math.round(el.y || 0);
  const a = el.anchor || 'top-right';
  const size = { position: 'absolute', width: el.w + 'px', height: el.h + 'px' };
  const map = {
    'top-left': { top: y + 'px', left: x + 'px' },
    top: { top: y + 'px', left: `calc(50% + ${x}px)`, transform: 'translateX(-50%)' },
    'top-right': { top: y + 'px', right: x + 'px' },
    left: { top: `calc(50% + ${y}px)`, left: x + 'px', transform: 'translateY(-50%)' },
    center: { top: `calc(50% + ${y}px)`, left: `calc(50% + ${x}px)`, transform: 'translate(-50%, -50%)' },
    right: { top: `calc(50% + ${y}px)`, right: x + 'px', transform: 'translateY(-50%)' },
    'bottom-left': { bottom: y + 'px', left: x + 'px' },
    bottom: { bottom: y + 'px', left: `calc(50% + ${x}px)`, transform: 'translateX(-50%)' },
    'bottom-right': { bottom: y + 'px', right: x + 'px' },
  };
  return { ...size, ...(map[a] || map['top-right']) };
}

export function applyAnchorStyle(node, el) {
  const s = anchorStyle(el);
  node.style.position = s.position;
  node.style.width = s.width;
  node.style.height = s.height;
  node.style.top = s.top || '';
  node.style.right = s.right || '';
  node.style.bottom = s.bottom || '';
  node.style.left = s.left || '';
  node.style.transform = s.transform || '';
}

/** Convert a pointer delta into anchor-local x/y deltas. */
export function dragDelta(anchor, dx, dy) {
  const a = anchor || 'top-right';
  let ox = dx, oy = dy;
  if (a.includes('right')) ox = -dx;
  if (a.includes('bottom')) oy = -dy;
  return { x: ox, y: oy };
}

export function labelFor(el, vars = {}) {
  if (el.bind === 'coins') return `${el.text || 'Coins'}: ${Math.round(vars.coins ?? 0)}`;
  if (el.bind === 'points') return `${el.text || 'Score'}: ${Math.round(vars.points ?? 0)}`;
  if (el.bind === 'timer') {
    const t = vars.timer ?? 0;
    const m = Math.floor(t / 60), s = Math.floor(t % 60);
    return `${el.text || 'Time'} ${m}:${String(s).padStart(2, '0')}`;
  }
  if (el.bind === 'health') return `${el.text || 'Health'} ${Math.max(0, Math.round(vars.health ?? 100))}`;
  return el.text || el.name || '';
}

export function barValue(el, vars = {}) {
  const max = el.max || 100;
  const v = el.bind === 'timer' ? (vars.timer ?? 0) : (vars[el.bind] ?? 0);
  return Math.max(0, Math.min(1, v / max));
}

/** Turn a button action phrase into a click program (adds "when clicked" if needed). */
export function buttonProgram(text) {
  const raw = String(text || '').trim();
  if (!raw) return { text: '', program: null };
  const hasTrig = /\b(when|whenever|once|every|on click|on spawn)\b/i.test(raw);
  const src = hasTrig ? raw : `When clicked, ${raw}`;
  const r = translate(src);
  return { text: src, program: r.program, preview: r.preview, unknown: r.unknown, suggestions: r.suggestions };
}

/** Build GUI elements from a chat intent. */
export function planGui(intent) {
  const els = [];
  if (intent.type === 'label' && intent.bind === 'coins') {
    els.push(makeGuiElement('label', { text: 'Coins', bind: 'coins', anchor: intent.anchor || 'top-right', color: intent.color, name: 'Coin counter' }));
  } else if (intent.togglesPanel) {
    const btn = makeGuiElement('button', { text: intent.text || 'Shop', name: intent.text || 'Shop', anchor: intent.anchor || 'bottom', color: intent.color });
    const panel = makeGuiElement('frame', { text: intent.text || 'Shop', name: (intent.text || 'Shop') + ' Panel', anchor: 'center', visible: false, w: 300, h: 220 });
    btn.toggles = panel.id;
    els.push(btn, panel);
  } else {
    els.push(makeGuiElement(intent.type || 'label', {
      text: intent.text, bind: intent.bind, anchor: intent.anchor, color: intent.color,
      name: intent.text || intent.type,
    }));
  }
  return { ok: true, elements: els, summary: els[0].name };
}

export { DEFAULTS };

/** Play-mode HUD. Elements stay fixed on screen (CSS-anchored). */
export function mountPlayGui(host, doc, hooks) {
  const root = document.createElement('div');
  root.className = 'rt-gui';
  host.append(root);
  const nodes = new Map();

  function paintOne(el, node) {
    const vars = hooks.vars?.() || {};
    node.className = 'rt-gui-el rt-gui-' + el.type;
    node.dataset.guiId = el.id;
    applyAnchorStyle(node, el);
    node.style.display = el.visible === false ? 'none' : 'flex';
    node.style.alignItems = 'center';
    node.style.justifyContent = el.type === 'bar' ? 'flex-start' : 'center';
    node.style.boxSizing = 'border-box';
    node.style.borderRadius = el.type === 'button' ? '10px' : '8px';
    node.style.overflow = 'hidden';
    node.style.pointerEvents = el.type === 'button' ? 'auto' : 'none';
    node.style.cursor = el.type === 'button' ? 'pointer' : 'default';
    node.style.font = (el.type === 'button' ? '600 ' : '') + '14px Segoe UI, system-ui, sans-serif';
    const bg = el.color || (el.type === 'button' ? '#1e5d8f' : el.type === 'frame' ? 'rgba(20,24,30,.88)' : el.type === 'bar' ? '#22262e' : 'rgba(20,24,30,.55)');
    const fg = el.textColor || '#e4edf5';
    node.style.background = el.type === 'label' && !el.color ? 'rgba(20,24,30,.55)' : bg;
    node.style.color = fg;
    node.style.border = (el.type === 'frame' || el.type === 'image') ? '1px solid rgba(255,255,255,.2)' : '1px solid transparent';
    node.style.padding = el.type === 'frame' ? '16px' : '0';
    if (el.type === 'bar') {
      node.innerHTML = '';
      const fill = document.createElement('i');
      fill.style.cssText = `position:absolute;left:0;top:0;bottom:0;width:${barValue(el, vars) * 100}%;background:${el.color || '#2f9e6a'};pointer-events:none;`;
      const cap = document.createElement('span');
      cap.textContent = labelFor(el, vars);
      cap.style.cssText = 'position:relative;padding:0 8px;font-size:11px;z-index:1;';
      node.append(fill, cap);
    } else if (el.type === 'image') {
      node.textContent = el.src ? '' : '🖼';
      if (el.src) { node.style.backgroundImage = `url("${String(el.src).replace(/"/g, '')}")`; node.style.backgroundSize = 'cover'; }
    } else if (el.type === 'frame') {
      node.innerHTML = '';
      const title = document.createElement('div');
      title.textContent = el.text || el.name || '';
      title.style.cssText = 'font-weight:700;margin-bottom:8px;width:100%;text-align:center;';
      node.append(title);
    } else {
      node.textContent = labelFor(el, vars);
    }
  }

  function refresh() {
    const list = doc.gui || [];
    const keep = new Set();
    for (const el of list) {
      keep.add(el.id);
      let node = nodes.get(el.id);
      if (!node) {
        node = document.createElement(el.type === 'button' ? 'button' : 'div');
        if (el.type === 'button') node.type = 'button';
        node.addEventListener('click', (ev) => { ev.preventDefault(); ev.stopPropagation(); hooks.click?.(el); });
        root.append(node);
        nodes.set(el.id, node);
      }
      paintOne(el, node);
    }
    for (const [id, node] of nodes) if (!keep.has(id)) { node.remove(); nodes.delete(id); }
  }

  refresh();
  return { root, refresh };
}


/** Allow http(s), data:image, and blob URLs only — never javascript: or relative paths that could run code. */
export function isSafeImageSrc(src) {
  const s = String(src || '').trim();
  if (!s || s.length > 2_000_000) return false;
  return /^(https?:\/\/|data:image\/[a-z0-9.+-]+;|blob:)/i.test(s);
}

/** Unique images already on this project: its thumbnail, remembered textures, and GUI image srcs. */
export function collectProjectImages(doc, extras = []) {
  const out = [];
  const seen = new Set();
  const add = (src, label) => {
    const s = String(src || '').trim();
    if (!isSafeImageSrc(s) || seen.has(s)) return;
    seen.add(s);
    out.push({ src: s, label: label || 'Image' });
  };
  if (doc?.thumbnail) add(doc.thumbnail, 'Game thumbnail');
  for (const t of doc?.textures || []) add(t?.src || t, t?.name || 'Texture');
  for (const el of doc?.gui || []) if (el && el.type === 'image' && el.src) add(el.src, el.name || 'GUI image');
  for (const e of extras || []) add(e?.src || e?.thumbnail, e?.name || e?.label || 'Image');
  return out;
}

/** Remember a pasted or picked URL on the project so the picker can offer it again. */
export function rememberTexture(doc, src, name = 'Image') {
  if (!doc || !isSafeImageSrc(src)) return false;
  const s = String(src).trim();
  doc.textures = doc.textures || [];
  if (doc.textures.some((t) => (t?.src || t) === s)) return true;
  doc.textures.push({ name: name || 'Image', src: s });
  return true;
}
