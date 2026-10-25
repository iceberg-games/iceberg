// Iceberg UI sounds: drop-in (no dependencies) from Iceberg Sound Designer (/workspace/iceberg-audio/ui/integration.js).
// Local additions (portal-polish): isMuted() export + api.isMuted (the one site mute check, also used by
// Studio playSfx via window.icebergUi.isMuted), api.stats.played (tests). Suggested home: src/audio/uiSounds.js,
// with the sound files in site/public/audio/ui/ (site build) or inlined (single-file build).
//
//   import { initUiSounds, playUi } from './audio/uiSounds.js';
//   initUiSounds();                         // once per page (portal.js and main.js)
//   playUi('popup_open'); playUi('error');  // from code: click | hover | play | popup_open |
//                                           // popup_close | notification | toast | error
//
// Markup:  data-sfx="play"   -> the big rewarding Play sound
//          data-sfx="none"   -> silence this element (and everything inside it)
//          data-sfx="<name>" -> any other sound name above
// Games / canvas: call playUi('click') (or window.icebergUi.playUi('click')) from your own
// in-game button handlers. The global listener ignores <canvas>, so camera drags stay silent.
//
// Audio graph: ONE shared AudioContext -> uiGain -> destination. By default it is the
// studio's existing window.__icebergSfx context (src/studio/runtime.js); pass { context } to use
// another one (e.g. window.iceberg.getAudioListener().context). Mute follows the platform's
// mute (window.iceberg.music.muted, or the saved 'iceberg:v1:settings'.muted on the portal).

// ICE UI skin: Sound Designer's frost-glass-ui pack (/workspace/iceberg-audio/frost-glass-ui/). Filenames live ONLY here.
// equip / unequip / tab / buy play instead of click (via data-sfx). buy is NOT bound to pointerdown: ui.js plays it after
// the purchase is confirmed (rejections -> error). reward: panel_open then success_ding ~150 ms later (playReward()).
const NAMES = {
  click: ['soft_click', 'soft_click_2', 'soft_click_3'], hover: ['hover_chime'], play: ['ui_play_button'],
  popup_open: ['panel_open'], popup_close: ['panel_close'], notification: ['ui_notification'],
  toast: ['ui_toast'], error: ['ui_error'], pop: ['soft_pop'], unequip: ['soft_pop'], tab: ['tab_switch'],
  equip: ['equip'], buy: ['buy'], success: ['success_ding'],
};
const GAIN = { click: 0.85, hover: 0.6, play: 1.0, popup_open: 0.85, popup_close: 0.8, notification: 0.9, toast: 0.85, error: 0.9,
  pop: 0.8, unequip: 0.6, tab: 0.8, equip: 0.85, buy: 0.9, success: 0.85 };
const MIN_GAP = { click: 35, hover: 90, play: 250, popup_open: 80, popup_close: 80, notification: 300, toast: 120, error: 250,
  pop: 60, unequip: 80, tab: 60, equip: 120, buy: 200, success: 250 };
const CLICKABLE = 'button, [role="button"], [role="tab"], [role="menuitem"], a[href], a, .clickable, [data-sfx], summary, '
  + 'input[type="button"], input[type="submit"], input[type="reset"], input[type="checkbox"], input[type="radio"], select, label.toggle';
// Detected Play buttons (data-sfx="play" always wins): portal + menu cards, featured banner, title Start, studio Test.
const PLAY = '.btn.play:not(.create):not(.studio-entry), .fb-play, #start-btn, #test-game';
const MAX_VOICES = 6;

let S = null;   // state singleton

function defaultBase() {
  const root = document.querySelector('meta[name="iceberg-root"]')?.content;   // site build: './' or '../'
  return (root ?? './') + 'audio/ui/';
}
/** The site-wide mute: window.iceberg.music.muted on the play page, else the saved iceberg:v1:settings.muted. */
export function isMuted() { return window.iceberg?.music ? !!window.iceberg.music.muted : settingsMuted(); }
function settingsMuted() {
  try { return !!JSON.parse(localStorage.getItem('iceberg:v1:settings') || '{}').muted; } catch { return false; }
}
function b64ToBuf(b64) { const s = atob(b64), u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u.buffer; }

/**
 * @param {object} [o]
 * @param {AudioContext} [o.context]  shared context to use (default: window.__icebergSfx, created if missing)
 * @param {string} [o.baseUrl]        folder with the .ogg/.mp3 files (default: <iceberg-root>audio/ui/)
 * @param {object} [o.inline]         UI_SOUNDS_INLINE from ui-sounds.inline.js (no fetch; for file:// builds)
 * @param {number} [o.volume=1]       UI master volume (0..1)
 * @param {() => boolean} [o.isMuted] custom mute source (default: platform mute)
 * @param {boolean} [o.hover=true]    soft hover ticks for mouse pointers
 * @param {boolean} [o.listen=true]   install the global pointerdown/keyboard listeners
 */
export function initUiSounds(o = {}) {
  if (S) return S.api;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return (S = { api: { playUi() {}, setVolume() {}, ready: Promise.resolve() } }).api;
  const ctx = o.context || (window.__icebergSfx ||= new AC());
  const out = ctx.createGain(); out.connect(ctx.destination);
  S = { ctx, out, volume: o.volume ?? 1, buffers: new Map(), last: {}, lastClick: -1, voices: 0, hoverEl: null,
        isMuted: o.isMuted || isMuted, stats: { played: 0, last: null } };

  // ---- preload (ogg if the browser can play it, mp3 otherwise / on decode failure) ----
  const probe = document.createElement('audio');
  const order = probe.canPlayType('audio/ogg; codecs="vorbis"') ? ['ogg', 'mp3'] : ['mp3', 'ogg'];
  const base = o.baseUrl ?? defaultBase();
  const load = async (file) => {
    for (const ext of order) {
      try {
        const data = o.inline ? b64ToBuf(o.inline[file][ext]) : await (await fetch(`${base}${file}.${ext}`)).arrayBuffer();
        const buf = await new Promise((res, rej) => ctx.decodeAudioData(data, res, rej));   // callback form = old Safari
        S.buffers.set(file, buf); return;
      } catch { /* try the other format */ }
    }
    console.warn('[uiSounds] could not load', file);
  };
  const ready = Promise.all([...new Set(Object.values(NAMES).flat())].map(load));

  // ---- resume on first gesture (autoplay rules) ----
  const resume = () => { if (ctx.state !== 'running') ctx.resume().catch(() => {}); };
  for (const ev of ['pointerdown', 'keydown', 'touchend']) addEventListener(ev, resume, { capture: true, passive: true });

  if (o.listen !== false) {
    // ONE document-level capture listener: runs before any app handler, so the click is instant
    // even if the handler navigates, hides the element, or opens a new tab.
    document.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;                       // primary button / touch / pen only
      const name = sfxFor(e.target);
      if (name) playUi(name);
    }, { capture: true, passive: true });
    // Keyboard activation (Enter/Space on a focused button) fires 'click' with detail 0 and no pointerdown.
    document.addEventListener('click', (e) => {
      if (e.detail !== 0) return;
      const name = sfxFor(e.target);
      if (name) playUi(name);
    }, { capture: true, passive: true });
    if (o.hover !== false) {
      document.addEventListener('pointerover', (e) => {
        if (e.pointerType !== 'mouse') return;          // no hover ticks on touch
        const el = e.target instanceof Element ? e.target.closest(CLICKABLE) : null;
        if (el === S.hoverEl) return;                   // moving inside the same button
        S.hoverEl = el;
        if (el && sfxFor(el)) playUi('hover');
      }, { capture: true, passive: true });
    }
  }
  const api = { playUi, playReward, setVolume, ready, context: ctx, isMuted: () => S.isMuted(), stats: S.stats };
  window.icebergUi = api;                               // for games without imports
  return (S.api = api);
}

/** Which sound (if any) a pointerdown on `target` should make. */
function sfxFor(target) {
  if (!(target instanceof Element) || target.closest('canvas')) return null;
  if (target.closest('[data-sfx="none"]')) return null;
  const el = target.closest(CLICKABLE);
  if (!el) return null;
  if (el.disabled || el.matches(':disabled') || el.getAttribute('aria-disabled') === 'true' || el.closest('fieldset:disabled')) return null;
  const tag = el.closest('[data-sfx]')?.dataset.sfx;
  if (tag && NAMES[tag]) return tag;
  if (el.matches(PLAY)) return 'play';
  return 'click';
}

/** Reward modal cue: panel_open, then success_ding ~150 ms later. */
export function playReward() { playUi('popup_open'); setTimeout(() => playUi('success'), 150); }

/** Play a UI sound by name: click | hover | play | popup_open | popup_close | notification | toast | error */
export function playUi(name = 'click', { volume = 1 } = {}) {
  if (!S?.ctx || !NAMES[name]) return;
  const { ctx } = S;
  const now = performance.now();
  if (now - (S.last[name] || 0) < MIN_GAP[name]) return;          // throttle repeats
  if (S.voices >= MAX_VOICES) return;
  if (S.isMuted() || S.volume <= 0) return;
  S.last[name] = now;
  let files = NAMES[name], i = 0;
  if (files.length > 1) { if (S.lastClick < 0) i = Math.floor(Math.random() * files.length); else { i = Math.floor(Math.random() * (files.length - 1)); if (i >= S.lastClick) i++; } S.lastClick = i; }  // never the same click twice in a row
  const buf = S.buffers.get(files[i]); if (!buf) return;
  if (ctx.state !== 'running') ctx.resume().catch(() => {});
  const src = ctx.createBufferSource(), g = ctx.createGain();
  src.buffer = buf;
  if (name === 'click') src.playbackRate.value = 1 + (Math.random() - 0.5) * 0.02;  // +/-1%: alive, still in tune
  g.gain.value = GAIN[name] * S.volume * volume;
  src.connect(g).connect(S.out);
  S.voices++; src.onended = () => { S.voices--; g.disconnect(); };
  src.start();
  S.stats.played++; S.stats.last = name;
}

export function setVolume(v) { if (S) S.volume = Math.max(0, Math.min(1, v)); }
