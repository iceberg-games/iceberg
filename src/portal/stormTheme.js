// Natural Disasters event theme ("stormy gray night") for the portal: body.theme-storm + portal/stormTheme.css and
// one fixed layer behind the content (pointer-events none): CSS clouds drifting, a canvas of light rain, and a
// soft lightning flash every 8-20 s at random. Only while the event is active on the SERVER:
//   createStormTheme({ source, eventId }) -> { check({ refresh }), stop(), get on }
//   source = createQuests(...) / quests (eventStatus with serverNow-based msLeft/msToStart).
// Re-checks on load, when the tab becomes visible again, and with a timer at endsAt (and startsAt) computed from
// serverNow. Saved user preferences are never touched. Low CPU: ~30 fps, DPR capped at 1.5, fewer drops on phones,
// paused while the tab is hidden; prefers-reduced-motion -> static stormy palette only (no rain, no flashes).
import { h } from '../ui/dom.js';
import './stormTheme.css';

const MAX_TIMER = 2 ** 31 - 1;
const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const phone = () => typeof matchMedia === 'function' && matchMedia('(max-width: 640px)').matches;

function createLayer() {
  const canvas = h('canvas.storm-rain', { 'aria-hidden': 'true' });
  const flash = h('div.storm-flash');
  const el = h('div.storm-layer#storm-layer', { 'aria-hidden': 'true' }, h('div.storm-clouds.far'), h('div.storm-clouds'), canvas, flash);
  let raf = 0, flashTimer = 0, drops = [], last = 0, w = 0, hgt = 0, dpr = 1;
  const g = canvas.getContext('2d');
  const stats = { frames: 0, flashes: 0, drops: 0 };
  const resize = () => {
    dpr = Math.min(1.5, devicePixelRatio || 1); w = innerWidth; hgt = innerHeight;
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(hgt * dpr);
    const n = phone() ? 40 : Math.min(110, Math.round(w * hgt / 12000));
    drops = Array.from({ length: n }, () => ({ x: Math.random() * w, y: Math.random() * hgt, l: 10 + Math.random() * 14, v: 520 + Math.random() * 380, a: 0.12 + Math.random() * 0.22 }));
    stats.drops = n;
  };
  const frame = (t) => {
    raf = requestAnimationFrame(frame);
    if (t - last < 33) return;                       // ~30 fps is plenty for light rain
    const dt = Math.min(0.1, (t - last) / 1000 || 0.033); last = t; stats.frames++;
    g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, hgt);
    g.lineWidth = 1; g.lineCap = 'round';
    for (const d of drops) {
      d.y += d.v * dt; d.x -= d.v * dt * 0.18;
      if (d.y > hgt + 20) { d.y = -20 - Math.random() * 40; d.x = Math.random() * (w + 80); }
      g.strokeStyle = `rgba(190,205,230,${d.a})`;
      g.beginPath(); g.moveTo(d.x, d.y); g.lineTo(d.x + d.l * 0.18, d.y - d.l); g.stroke();
    }
  };
  const scheduleFlash = () => {
    clearTimeout(flashTimer);
    flashTimer = setTimeout(() => {
      if (!document.hidden) { flash.style.setProperty('--fx', `${15 + Math.random() * 70}%`); flash.classList.remove('on'); void flash.offsetWidth; flash.classList.add('on'); stats.flashes++; }
      scheduleFlash();
    }, 8000 + Math.random() * 12000);
  };
  const run = () => {
    if (reduced() || document.hidden) return pause();
    if (!raf) { last = 0; raf = requestAnimationFrame(frame); }
    if (!flashTimer) scheduleFlash();
  };
  const pause = () => { cancelAnimationFrame(raf); raf = 0; clearTimeout(flashTimer); flashTimer = 0; };
  const onVis = () => (document.hidden ? pause() : run());
  const mq = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;
  return {
    el, stats,
    get running() { return !!raf; },
    start() { resize(); addEventListener('resize', resize); document.addEventListener('visibilitychange', onVis); mq?.addEventListener?.('change', run); run(); },
    stop() { pause(); removeEventListener('resize', resize); document.removeEventListener('visibilitychange', onVis); mq?.removeEventListener?.('change', run); el.remove(); },
  };
}

export function createStormTheme({ source, eventId = 'natural_disasters', parent = () => document.body } = {}) {
  let layer = null, timer = 0, on = false, stopped = false;
  const enable = () => {
    if (on) return; on = true;
    document.body.classList.add('theme-storm');
    layer = createLayer(); parent().prepend(layer.el); layer.start();
  };
  const disable = () => {
    if (!on) return; on = false;
    document.body.classList.remove('theme-storm');
    layer?.stop(); layer = null;
  };
  async function check({ refresh = false } = {}) {
    if (stopped) return on;
    let st = null;
    try { st = await source.eventStatus(eventId, { refresh }); } catch { st = null; }
    const active = !!st?.active && !st.noServer && !st.error;
    if (active) enable(); else disable();
    clearTimeout(timer); timer = 0;
    const next = active ? st.msLeft : st?.msToStart;          // server clock: msLeft = endsAt - serverNow
    if (next != null && next >= 0) timer = setTimeout(() => check({ refresh: true }), Math.min(MAX_TIMER, next + 250));
    return on;
  }
  const onVis = () => { if (!document.hidden) check({ refresh: true }); };
  document.addEventListener('visibilitychange', onVis);
  return {
    check,
    get on() { return on; },
    get layer() { return layer; },
    stop() { stopped = true; clearTimeout(timer); document.removeEventListener('visibilitychange', onVis); disable(); },
  };
}
