// Device picker shown at the very start (before the title screen).
// Skipped once a choice is saved; the detected device is pre-selected.
//   await showDevicePicker(root)  -> resolves 'computer' | 'mobile'
import { h } from './dom.js';
import { detectDeviceMode, getDeviceMode, hasChosenDeviceMode, setDeviceMode } from '../core/device.js';
import './device.css';

export function showDevicePicker(root = document.body, { force = false } = {}) {
  if (!force && hasChosenDeviceMode()) return Promise.resolve(getDeviceMode());
  const guess = hasChosenDeviceMode() ? getDeviceMode() : detectDeviceMode();
  return new Promise((resolve) => {
    let picked = guess;
    const opt = (mode, icon, title, sub) => h('button.device-opt' + (mode === guess ? '.selected' : ''), {
      type: 'button', 'data-mode': mode, 'aria-pressed': String(mode === guess),
      onclick: (e) => {
        picked = mode;
        el.querySelectorAll('.device-opt').forEach(b => { const on = b.dataset.mode === mode; b.classList.toggle('selected', on); b.setAttribute('aria-pressed', String(on)); });
        if (e.detail >= 2) go(); // double-click / double-tap confirms
      },
    }, h('span.device-ico', icon), h('b', title), h('span.muted.small', sub),
      mode === guess ? h('span.device-guess', 'Suggested for this device') : null);
    const go = () => { setDeviceMode(picked); el.remove(); resolve(picked); };
    const el = h('div.device-picker#device-picker', { role: 'dialog', 'aria-label': 'Choose your device' },
      h('div.device-card',
        h('div.title-logo', '🧊'),
        h('h2', 'How are you playing?'),
        h('div.device-opts',
          opt('computer', '🖥️', 'Computer', 'Keyboard + mouse. Create & Studio included.'),
          opt('mobile', '📱', 'Mobile', 'Touch joystick, jump button, drag to look.')),
        h('button.btn.big#device-go', { type: 'button', onclick: go }, 'Continue'),
        h('p.muted.small', 'You can change this later in Help (H).')));
    root.append(el);
  });
}
