// Featured-game banner for the portal home: big image, title, blurb, Play (new tab).
// Auto-rotates (7 s) with dots + arrows; pauses on hover/focus; no auto-rotation when
// prefers-reduced-motion is set. List: server featured_games, else site featured.json.
import { h, clear } from '../ui/dom.js';
import { thumb } from '../ui/thumbs.js';

const ROTATE_MS = 7000;

export async function loadFeatured(remote) {
  if (remote) { try { const f = await remote.listFeatured(); if (Array.isArray(f) && f.length) return { items: f, source: 'server' }; } catch { /* fall back */ } }
  try { const r = await fetch('featured.json', { cache: 'no-cache' }); if (r.ok) return { items: (await r.json()).featured || [], source: 'file' }; } catch { /* offline */ }
  return { items: [], source: 'none' };
}

export function createFeaturedBanner(items, defsById, { onPlay, playUrl }) {
  const slides = items.map(f => ({ ...f, def: defsById[f.gameId] })).filter(s => s.def);
  if (!slides.length) return null;
  const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  let i = 0, timer = null, paused = false;
  const stage = h('div.fb-stage');
  const dots = h('div.fb-dots', { role: 'tablist' });
  const el = h('section.featured-banner#featured-banner', { 'aria-roledescription': 'carousel', 'aria-label': 'Featured games', 'data-reduced-motion': String(reduced) },
    stage,
    slides.length > 1 ? h('button.fb-arrow.fb-prev', { type: 'button', 'aria-label': 'Previous game', onclick: () => show(i - 1, true) }, '‹') : null,
    slides.length > 1 ? h('button.fb-arrow.fb-next', { type: 'button', 'aria-label': 'Next game', onclick: () => show(i + 1, true) }, '›') : null,
    slides.length > 1 ? dots : null);

  slides.forEach((s, k) => dots.append(h('button.fb-dot', { type: 'button', role: 'tab', 'aria-label': `Show ${s.def.name}`, onclick: () => show(k, true) })));

  function show(k, user = false) {
    i = (k + slides.length) % slides.length;
    const s = slides[i];
    const img = s.image || thumb(s.def.thumbnail);
    clear(stage).append(h('div.fb-slide' + (reduced ? '' : '.fb-anim'), { 'data-game': s.gameId },
      h('div.fb-img', { style: { backgroundImage: `url("${img}")` }, role: 'img', 'aria-label': s.def.name }),
      h('div.fb-text',
        h('span.fb-kicker', '⭐ Featured'),
        h('h2.fb-title', s.def.name),
        h('p.fb-blurb', s.blurb || s.def.tagline || s.def.description || ''),
        h('a.btn.big.fb-play', { href: playUrl(s.gameId), target: '_blank', rel: 'noopener', onclick: (e) => { e.preventDefault(); onPlay(s.gameId); } }, '▶ Play'))));
    dots.querySelectorAll('.fb-dot').forEach((d, n) => { d.classList.toggle('on', n === i); d.setAttribute('aria-selected', String(n === i)); });
    el.dataset.index = String(i);
    if (user) restart();
  }
  function restart() { clearInterval(timer); timer = null; if (!reduced && !paused && slides.length > 1) timer = setInterval(() => show(i + 1), ROTATE_MS); }
  const pause = (on) => { paused = on; el.dataset.paused = String(on); restart(); };
  el.addEventListener('mouseenter', () => pause(true));
  el.addEventListener('mouseleave', () => pause(false));
  el.addEventListener('focusin', () => pause(true));
  el.addEventListener('focusout', () => pause(false));
  show(0); restart();
  return { el, show, get index() { return i; }, get rotating() { return !!timer; }, destroy() { clearInterval(timer); } };
}
