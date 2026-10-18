// Tiny local wrapper for the Sound Designer's "Frost Glass" UI set.
// Uses the shared module when the Publisher's src/audio/uiSounds.js is present (feature-detected at runtime via
// window.iceberg.uiSounds / window.iceberg.playUi, so this branch builds without it); otherwise plays our copies in
// site/public/audio/nds/ui/ through DisasterAudio (the shared music output, so the site mute applies).
// The global UI listener skips the canvas on purpose, so in-game presses call playUi() explicitly.
export const UI_FILES = {
  ui_click: { files: ['ui/ui_click_1.ogg', 'ui/ui_click_1.mp3'], variants: ['ui/ui_click_2.ogg', 'ui/ui_click_3.ogg'], gain: 0.9, minIntervalMs: 35 },
  ui_play: { files: ['ui/ui_play_button.ogg', 'ui/ui_play_button.mp3'], gain: 1.0, minIntervalMs: 250 },
  ui_popup_open: { files: ['ui/ui_popup_open.ogg', 'ui/ui_popup_open.mp3'], gain: 0.85, minIntervalMs: 80 },
  ui_popup_close: { files: ['ui/ui_popup_close.ogg', 'ui/ui_popup_close.mp3'], gain: 0.8, minIntervalMs: 80 },
  ui_notification: { files: ['ui/ui_notification.ogg', 'ui/ui_notification.mp3'], gain: 0.9, minIntervalMs: 300 },
  ui_toast: { files: ['ui/ui_toast.ogg', 'ui/ui_toast.mp3'], gain: 0.85, minIntervalMs: 120 },
  ui_error: { files: ['ui/ui_error.ogg', 'ui/ui_error.mp3'], gain: 0.9, minIntervalMs: 250 },
};
const last = {};
export function makePlayUi(audio) {
  return function playUi(name) {
    if (audio.muted) return false;
    const shared = window.iceberg?.uiSounds?.playUi || window.iceberg?.playUi;
    if (typeof shared === 'function') { try { shared(name); return true; } catch { /* fall through */ } }
    const key = `ui_${name}`, f = UI_FILES[key]; if (!f) return false;
    const now = performance.now(); if (now - (last[key] || 0) < (f.minIntervalMs || 0)) return false; last[key] = now;
    if (audio.oneShot(key, 1)) return true;
    audio._load?.(key); audio.sfx(name === 'error' ? 'deny' : name === 'popup_close' ? 'close' : name === 'notification' ? 'coin' : 'click'); // procedural until loaded
    return true;
  };
}
