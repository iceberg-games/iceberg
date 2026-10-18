// 2006-style nested Safe Chat menu: a column of sections; each opens the next
// column to the right (hover on desktop, tap on touch). Picking a phrase calls onPick.
import { h, clear } from '../ui/dom.js';
import { SAFE_CHAT, phraseId } from '../data/safeChat.js';
import './chat.css';

export function createSafeChatMenu({ onPick, tree = SAFE_CHAT, anchor = 'bottom' } = {}) {
  const el = h('div.sc-menu.hidden#safe-chat-menu', { role: 'menu', 'data-anchor': anchor });
  const cols = h('div.sc-cols');
  el.append(h('div.sc-head', h('b', '💬 Safe Chat'), h('button.sc-close', { type: 'button', 'aria-label': 'Close', onclick: () => api.close() }, '✕')), cols);

  function column(items, depth) {
    // drop deeper columns
    while (cols.children.length > depth) cols.lastChild.remove();
    const col = h('div.sc-col', { 'data-depth': depth });
    for (const it of items) {
      if (typeof it === 'string') {
        col.append(h('button.sc-item.sc-phrase', { type: 'button', role: 'menuitem', 'data-phrase': phraseId(it),
          onclick: () => { onPick?.({ id: phraseId(it), text: it }); api.close(); } }, it));
      } else {
        const open = () => {
          if (btn.classList.contains('open') && cols.children.length > depth + 1) return;   // already showing (hover jitter)
          col.querySelectorAll('.sc-sub').forEach(b => b.classList.toggle('open', b === btn)); column(it.items, depth + 1);
        };
        const btn = h('button.sc-item.sc-sub', { type: 'button', role: 'menuitem', 'aria-haspopup': 'true', 'data-section': it.id || it.label,
          onclick: open,
          // hover-intent: open after a short pause so passing over items doesn't flip menus
          onmouseenter: () => { if (matchMedia('(hover: hover)').matches) { clearTimeout(btn._t); btn._t = setTimeout(open, 140); } },
          onmouseleave: () => clearTimeout(btn._t) },
          h('span', `${it.icon || ''} ${it.label}`.trim()), h('span.sc-arrow', '▸'));
        col.append(btn);
      }
    }
    cols.append(col);
    cols.scrollLeft = cols.scrollWidth;   // reveal the newest column without moving the page
    return col;
  }
  const top = SAFE_CHAT === tree ? tree : tree;
  const api = {
    el,
    open() { clear(cols); column(top, 0); el.classList.remove('hidden'); },
    close() { el.classList.add('hidden'); clear(cols); },
    toggle() { el.classList.contains('hidden') ? api.open() : api.close(); },
    get isOpen() { return !el.classList.contains('hidden'); },
  };
  addEventListener('keydown', (e) => { if (e.code === 'Escape' && api.isOpen) api.close(); });
  return api;
}

/** How long a bubble stays up for a phrase (ms). */
export const bubbleMs = (text) => Math.max(2500, Math.min(7000, 2000 + String(text).length * 70));

/** Make an avatar talk for the bubble's duration, tolerating avatars without the API. */
export function avatarTalk(avatar, ms) {
  try {
    if (typeof avatar?.talk === 'function') return avatar.talk(ms);
    if (typeof avatar?.setTalking === 'function') { avatar.setTalking(true); setTimeout(() => avatar.setTalking?.(false), ms); }
  } catch { /* cosmetic only */ }
}
