// On-screen touch controls for device mode 'mobile': a move joystick (left)
// and a jump button (right). Camera drag stays on the game canvas (engine.js
// pointer handling). Shown only while getDeviceMode() === 'mobile'.
//
//   import { mountTouchControls } from './ui/touchControls.js';
//   mountTouchControls(engine);   // once, after the Engine exists
//
// Movement: if engine.input.analog exists (object with x/y), the joystick
// writes analog values there (x = right, y = forward, each -1..1). Otherwise it
// falls back to virtual WASD keys in engine.input.keys. Jump presses 'Space'.
import { getDeviceMode, onDeviceChange } from '../core/device.js';

const CSS = `
.touch-ui{position:fixed;inset:0;pointer-events:none;z-index:40;user-select:none;-webkit-user-select:none}
.touch-ui.hidden{display:none}
.touch-stick{position:absolute;left:24px;bottom:28px;width:130px;height:130px;border-radius:50%;
  background:rgba(255,255,255,.18);border:2px solid rgba(255,255,255,.45);pointer-events:auto;touch-action:none}
.touch-knob{position:absolute;left:50%;top:50%;width:56px;height:56px;margin:-28px 0 0 -28px;border-radius:50%;
  background:rgba(255,255,255,.7);box-shadow:0 2px 8px rgba(0,0,0,.25)}
.touch-jump{position:absolute;right:28px;bottom:40px;width:86px;height:86px;border-radius:50%;
  background:rgba(127,227,255,.55);border:2px solid rgba(255,255,255,.7);color:#fff;font:700 16px system-ui,sans-serif;
  display:flex;align-items:center;justify-content:center;pointer-events:auto;touch-action:none}
.touch-jump.on{background:rgba(127,227,255,.85)}`;

const DEAD = 0.25; // fallback key threshold

export function mountTouchControls(engine, { root = document.body } = {}) {
  if (!document.getElementById('touch-ui-style')) {
    const st = document.createElement('style'); st.id = 'touch-ui-style'; st.textContent = CSS; document.head.append(st);
  }
  const ui = document.createElement('div'); ui.className = 'touch-ui hidden'; ui.id = 'touch-ui';
  const stick = document.createElement('div'); stick.className = 'touch-stick'; stick.id = 'touch-stick';
  const knob = document.createElement('div'); knob.className = 'touch-knob'; stick.append(knob);
  const jump = document.createElement('div'); jump.className = 'touch-jump'; jump.id = 'touch-jump'; jump.textContent = 'JUMP';
  ui.append(stick, jump); root.append(ui);

  const input = () => engine && engine.input;
  const hasAnalog = () => { const i = input(); return !!(i && i.analog && typeof i.analog === 'object' && 'x' in i.analog && 'y' in i.analog); };
  const setKey = (code, on) => { const i = input(); if (!i || !i.keys) return; on ? i.keys.add(code) : i.keys.delete(code); };

  let x = 0, y = 0;
  function apply() {
    if (hasAnalog()) {
      input().analog.x = x; input().analog.y = y;
      ['KeyW', 'KeyA', 'KeyS', 'KeyD'].forEach(k => setKey(k, false));
    } else {
      setKey('KeyW', y > DEAD); setKey('KeyS', y < -DEAD); setKey('KeyD', x > DEAD); setKey('KeyA', x < -DEAD);
    }
  }

  let stickId = null;
  function move(e) {
    const r = stick.getBoundingClientRect(), R = r.width / 2;
    let dx = e.clientX - (r.left + R), dy = e.clientY - (r.top + R);
    const len = Math.hypot(dx, dy); if (len > R) { dx *= R / len; dy *= R / len; }
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
    x = dx / R; y = -dy / R; apply();
  }
  function release() { stickId = null; x = 0; y = 0; knob.style.transform = ''; apply(); }
  stick.addEventListener('pointerdown', (e) => { stickId = e.pointerId; stick.setPointerCapture(e.pointerId); move(e); e.preventDefault(); });
  stick.addEventListener('pointermove', (e) => { if (e.pointerId === stickId) move(e); });
  stick.addEventListener('pointerup', (e) => { if (e.pointerId === stickId) release(); });
  stick.addEventListener('pointercancel', release);

  const jumpOn = (on) => (e) => { setKey('Space', on); jump.classList.toggle('on', on); e.preventDefault(); };
  jump.addEventListener('pointerdown', jumpOn(true));
  jump.addEventListener('pointerup', jumpOn(false));
  jump.addEventListener('pointercancel', jumpOn(false));
  jump.addEventListener('pointerleave', jumpOn(false));

  function sync() {
    const mobile = getDeviceMode() === 'mobile';
    ui.classList.toggle('hidden', !mobile);
    if (!mobile) { release(); setKey('Space', false); jump.classList.remove('on'); }
  }
  const off = onDeviceChange(sync);
  sync();
  return { el: ui, sync, destroy() { off(); release(); ui.remove(); } };
}
