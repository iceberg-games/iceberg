// 2D GUI editor overlay for PC Studio: drag, resize, and anchor screen elements.
import { h, clear } from '../ui/dom.js';
import { bus } from '../core/events.js';
import { GUI_TYPES, GUI_ANCHORS, makeGuiElement, applyAnchorStyle, dragDelta, labelFor, buttonProgram } from './gui.js';

function css(node, style) { Object.assign(node.style, style); return node; }

function paintEl(node, el, vars = {}) {
  node.className = 'st-gui-el st-gui-' + el.type + (el.visible === false ? ' hidden-el' : '');
  node.dataset.guiId = el.id;
  applyAnchorStyle(node, el);
  const bg = el.color || (el.type === 'button' ? '#1e5d8f' : el.type === 'frame' ? 'rgba(20,24,30,.92)' : el.type === 'bar' ? '#22262e' : 'transparent');
  const fg = el.textColor || (el.type === 'button' ? '#fff' : '#e4edf5');
  css(node, {
    background: el.type === 'label' && !el.color ? 'rgba(20,24,30,.55)' : bg,
    color: fg,
    border: el.type === 'frame' || el.type === 'image' ? '1px solid #4a535e' : '1px solid transparent',
    borderRadius: el.type === 'button' ? '10px' : '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: el.type === 'bar' ? 'flex-start' : 'center',
    font: (el.type === 'button' ? '600 ' : '') + '13px Segoe UI, system-ui, sans-serif',
    overflow: 'hidden',
    boxSizing: 'border-box',
    pointerEvents: 'auto',
    opacity: el.visible === false ? 0.45 : 1,
    cursor: 'move',
  });
  if (el.type === 'bar') {
    const fill = document.createElement('i');
    fill.className = 'st-gui-bar-fill';
    css(fill, { position: 'absolute', left: 0, top: 0, bottom: 0, width: (barPct(el, vars) * 100) + '%', background: el.color || '#2f9e6a', pointerEvents: 'none' });
    const cap = document.createElement('span');
    cap.textContent = labelFor(el, vars);
    css(cap, { position: 'relative', padding: '0 8px', fontSize: '11px', zIndex: 1 });
    node.style.position = node.style.position || 'absolute';
    node.append(fill, cap);
  } else if (el.type === 'image') {
    node.textContent = el.src ? '' : '🖼';
    if (el.src) css(node, { backgroundImage: `url(${CSS.escape ? el.src : el.src})`, backgroundSize: 'cover', backgroundPosition: 'center' });
  } else {
    node.textContent = labelFor(el, vars) || (el.type === 'frame' ? '' : el.name);
  }
}

function barPct(el, vars) {
  const max = el.max || 100;
  const v = el.bind === 'health' ? (vars.health ?? 100) : (vars[el.bind] ?? 0);
  return Math.max(0, Math.min(1, v / max));
}

function inspector(ed, el) {
  const set = (key, value) => { ed.updateGui(el.id, { [key]: value }); };
  const row = (label, control) => h('label.st-gui-row', h('span', label), control);
  const script = h('textarea', { rows: 2, placeholder: 'when clicked, give 10 coins', value: el.scriptText || '' });
  script.addEventListener('change', () => {
    const r = buttonProgram(script.value);
    ed.updateGui(el.id, { scriptText: r.text, program: r.program });
  });
  return h('div.st-gui-inspect#studio-gui-inspect',
    h('div.st-gui-inspect-head', h('b', `${el.type} · ${el.name}`), h('button.st-mini', { type: 'button', onclick: () => ed.removeGui(el.id) }, '🗑')),
    row('Name', h('input', { value: el.name, onchange: (e) => set('name', e.target.value) })),
    row('Text', h('input', { value: el.text || '', onchange: (e) => set('text', e.target.value) })),
    row('Anchor', h('select', { onchange: (e) => set('anchor', e.target.value) }, GUI_ANCHORS.map((a) => h('option', { value: a, selected: el.anchor === a }, a)))),
    row('Visible', h('input', { type: 'checkbox', checked: el.visible !== false, onchange: (e) => set('visible', e.target.checked) })),
    el.type === 'bar' || el.type === 'label' ? row('Bind', h('select', { onchange: (e) => set('bind', e.target.value || null) },
      [['', 'none'], ['health', 'health'], ['coins', 'coins'], ['points', 'points'], ['timer', 'timer']].map(([v, l]) => h('option', { value: v, selected: (el.bind || '') === v }, l)))) : null,
    el.type === 'button' ? h('div', h('p.st-hint', 'Button action (plain words)'), script) : null,
  );
}

function build(getPanel) {
  const stage = h('div.st-gui-stage#studio-gui-stage');
  const tools = h('div.st-gui-tools#studio-gui-tools',
    h('span.st-gl', 'GUI'),
    ...GUI_TYPES.map((t) => h('button.st-mini', { type: 'button', 'data-add-gui': t, title: 'Add ' + t }, t[0].toUpperCase() + t.slice(1))),
  );
  const inspectHost = h('div');
  const overlay = h('div.st-gui-overlay#studio-gui-overlay', stage, tools, inspectHost);
  overlay.classList.add('off');

  const toggle = h('button.st-chat-toggle#studio-gui-toggle', { type: 'button', title: 'Edit on-screen GUI (buttons, labels, bars)', 'aria-expanded': 'false' }, '🖥 GUI');
  const wrap = h('div#studio-gui-root', toggle, overlay);

  const setOpen = (open) => {
    overlay.classList.toggle('off', !open);
    toggle.classList.toggle('on', open);
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    const ed = getPanel?.()?.ed;
    if (ed) { ed.guiEdit = open; if (open) render(); }
  };
  toggle.addEventListener('click', () => setOpen(overlay.classList.contains('off')));

  tools.addEventListener('click', (e) => {
    const type = e.target.closest?.('[data-add-gui]')?.getAttribute('data-add-gui');
    const ed = getPanel?.()?.ed; if (!type || !ed) return;
    ed.addGui({ type, text: type[0].toUpperCase() + type.slice(1), anchor: type === 'bar' ? 'top-left' : 'center' });
    setOpen(true);
  });

  let drag = null;
  stage.addEventListener('pointerdown', (e) => {
    const ed = getPanel?.()?.ed; if (!ed) return;
    const handle = e.target.closest?.('.st-gui-handle');
    const node = e.target.closest?.('.st-gui-el');
    if (!node) { ed.selectGui(null); render(); return; }
    e.preventDefault(); e.stopPropagation();
    const id = node.dataset.guiId;
    ed.selectGui(id);
    const el = (ed.doc.gui || []).find((g) => g.id === id);
    if (!el) return;
    drag = { id, mode: handle ? 'resize' : 'move', x0: e.clientX, y0: e.clientY, sx: el.x, sy: el.y, sw: el.w, sh: el.h, anchor: el.anchor };
    stage.setPointerCapture(e.pointerId);
    render();
  });
  stage.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const ed = getPanel?.()?.ed; if (!ed) return;
    const dx = e.clientX - drag.x0, dy = e.clientY - drag.y0;
    if (drag.mode === 'resize') {
      ed.updateGui(drag.id, { w: Math.max(24, drag.sw + dx), h: Math.max(16, drag.sh + dy) }, { soft: true });
    } else {
      const d = dragDelta(drag.anchor, dx, dy);
      ed.updateGui(drag.id, { x: Math.round(drag.sx + d.x), y: Math.round(drag.sy + d.y) }, { soft: true });
    }
    render();
  });
  const endDrag = () => {
    if (!drag) return;
    const ed = getPanel?.()?.ed;
    if (ed?.commitGui) ed.commitGui();
    drag = null;
  };
  stage.addEventListener('pointerup', endDrag);
  stage.addEventListener('pointercancel', endDrag);

  function render() {
    const ed = getPanel?.()?.ed;
    const list = ed?.doc?.gui || [];
    const sel = ed?.selectedGui;
    clear(stage);
    for (const el of list) {
      const node = document.createElement('div');
      paintEl(node, el, { health: 100, coins: 0, points: 0, timer: 0 });
      if (el.id === sel) {
        node.classList.add('sel');
        const handle = document.createElement('i');
        handle.className = 'st-gui-handle';
        node.append(handle);
      }
      stage.append(node);
    }
    const selected = list.find((g) => g.id === sel);
    clear(inspectHost);
    if (selected) inspectHost.append(inspector(ed, selected));
  }

  bus.on('studio:changed', (what) => { if (what === 'gui' || what === 'doc') render(); });
  wrap._setOpen = setOpen;
  wrap._render = render;
  return wrap;
}

export function attachStudioGui(studioEl, getPanel) {
  if (!studioEl) return null;
  let wrap = studioEl.querySelector('#studio-gui-root') || document.getElementById('studio-gui-root');
  if (!wrap) wrap = build(getPanel);
  studioEl.append(wrap);
  wrap._render?.();
  return wrap;
}

export function refreshStudioGui() {
  document.getElementById('studio-gui-root')?._render?.();
}
