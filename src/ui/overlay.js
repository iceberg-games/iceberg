// Tiny reusable toast() + modal() helpers (no UI library). Styles: ui/overlay.css.
//   toast(text, icon?)  or  toast(text, { icon, kind: 'info'|'success'|'warn'|'error', timeout: 3800, place: 'corner'|'top' })
//        -> { el, dismiss() }. Slides in, stacks (max 4), auto-dismisses, click to dismiss. aria-live polite.
//   modal({ title, body, actions, className, dismissible = true, labelledBy, initialFocus, onClose })
//        -> { el, dialog, close(value), closed: Promise<value> }
//        actions: [{ label, value, primary, danger, className, sfx, onClick(close) }]  (returning false keeps it open)
//        Accessible: role=dialog + aria-modal, focus trap, Esc + backdrop click close (when dismissible),
//        focus restored on close. Scale/fade with spring-like easing; prefers-reduced-motion -> no motion.
// Sounds (audio/uiSounds.js): toast -> 'toast', modal open/close -> 'popup_open'/'popup_close'. Buttons that close
// the modal are data-sfx="none" so a close makes one sound; an action with its own `sfx` (e.g. 'play') closes silently.
//   confirmModal(text, { title, okLabel, cancelLabel, danger }) -> Promise<boolean>   (replaces window.confirm)
import { h } from './dom.js';
import './overlay.css';
import { playUi as playUiNow } from '../audio/uiSounds.js';
// Programmatic popups/toasts can come before any gesture: don't queue a sound on a suspended context.
const playUi = (n) => { if (window.icebergUi?.context?.state === 'running') playUiNow(n); };

const boxes = {};
const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

function toastBox(place) {
  if (boxes[place]?.isConnected) return boxes[place];
  const box = h(`div.ib-toasts.ib-toasts-${place}`, { 'aria-live': 'polite', role: 'status' });
  document.body.append(box);
  return (boxes[place] = box);
}

export function toast(text, opts = {}) {
  if (typeof opts === 'string') opts = { icon: opts };
  const { icon = 'ℹ️', kind = 'info', timeout = 3800, place = 'corner' } = opts;
  const box = toastBox(place);
  const el = h(`div.ib-toast.ib-${kind}`, { 'data-sfx': 'off' }, h('span.ib-toast-ico', { 'aria-hidden': 'true' }, icon), h('span.ib-toast-text', text));
  box.append(el); playUi('toast');
  while (box.children.length > 4) box.firstElementChild.remove();
  let gone = false;
  const dismiss = () => {
    if (gone) return; gone = true; clearTimeout(timer);
    if (reducedMotion()) { el.remove(); return; }
    el.classList.add('out');
    el.addEventListener('animationend', () => el.remove(), { once: true });
    setTimeout(() => el.remove(), 400);
  };
  const timer = setTimeout(dismiss, timeout);
  el.addEventListener('click', dismiss);
  return { el, dismiss };
}

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
let openCount = 0, seq = 0;

export function modal({ title = '', body = null, actions = [], className = '', dismissible = true, labelledBy = null, initialFocus = null, onClose = null } = {}) {
  const titleId = labelledBy || `ib-modal-title-${++seq}`;
  const prevFocus = document.activeElement;
  let resolveClosed, closing = false;
  const closed = new Promise((r) => { resolveClosed = r; });
  const close = (value, { silent = false } = {}) => {
    if (closing) return; closing = true;
    if (!silent) playUi('popup_close');
    document.removeEventListener('keydown', onKey, true);
    const done = () => {
      backdrop.remove();
      if (--openCount <= 0) { openCount = 0; document.documentElement.classList.remove('ib-modal-open'); }
      try { prevFocus?.focus?.({ preventScroll: true }); } catch { /* gone */ }
      onClose?.(value); resolveClosed(value);
    };
    if (reducedMotion()) return done();
    backdrop.classList.add('closing');
    let finished = false; const fin = () => { if (!finished) { finished = true; done(); } };
    dialog.addEventListener('animationend', fin, { once: true }); setTimeout(fin, 320);
  };
  const btns = actions.map((a) => h('button.btn' + (a.primary ? '' : '.secondary') + (a.danger ? '.danger' : '') + (a.className ? '.' + a.className.split(' ').join('.') : ''),
    { type: 'button', 'data-sfx': a.sfx || 'none', 'data-value': a.value ?? null, onclick: async () => { if ((await a.onClick?.(close)) === false) return; close(a.value, { silent: !!a.sfx }); } }, a.label));
  const closeBtn = dismissible ? h('button.ib-modal-x', { type: 'button', 'data-sfx': 'none', 'aria-label': 'Close', title: 'Close (Esc)', onclick: () => close(undefined) }, '✕') : null;
  const dialog = h('div.ib-modal' + (className ? '.' + className.split(' ').join('.') : ''), { role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': title || labelledBy ? titleId : null, tabindex: '-1' },
    closeBtn, title ? h('h2.ib-modal-title', { id: titleId }, title) : null,
    body == null ? null : (typeof body === 'string' ? h('p.ib-modal-text', body) : body),
    btns.length ? h('div.ib-modal-actions', btns) : null);
  const backdrop = h('div.ib-backdrop', dialog);
  backdrop.addEventListener('pointerdown', (e) => { backdrop._downOnSelf = e.target === backdrop; });
  backdrop.addEventListener('click', (e) => { if (dismissible && e.target === backdrop && backdrop._downOnSelf !== false) close(undefined); });
  function onKey(e) {
    if (!backdrop.isConnected || backdrop !== [...document.querySelectorAll('.ib-backdrop')].pop()) return;   // only the top modal
    if (e.key === 'Escape' && dismissible) { e.preventDefault(); e.stopPropagation(); close(undefined); return; }
    if (e.key !== 'Tab') return;
    const f = [...dialog.querySelectorAll(FOCUSABLE)].filter(el => el.offsetParent !== null || el === document.activeElement);
    if (!f.length) { e.preventDefault(); dialog.focus(); return; }
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) { e.preventDefault(); first.focus(); }
  }
  document.addEventListener('keydown', onKey, true);
  document.body.append(backdrop);
  openCount++; document.documentElement.classList.add('ib-modal-open'); playUi('popup_open');
  const focusTarget = (typeof initialFocus === 'string' ? dialog.querySelector(initialFocus) : initialFocus) || dialog.querySelector('.btn:not(.secondary)') || btns[0] || closeBtn || dialog;
  requestAnimationFrame(() => focusTarget.focus({ preventScroll: true }));
  return { el: backdrop, dialog, close, closed };
}

export function confirmModal(text, { title = 'Are you sure?', okLabel = 'OK', cancelLabel = 'Cancel', danger = false } = {}) {
  return modal({ title, body: text, className: 'ib-confirm',
    actions: [{ label: cancelLabel, value: false }, { label: okLabel, value: true, primary: true, danger }] }).closed.then(v => v === true);
}
