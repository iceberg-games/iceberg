// Pengu Plaza HUD — mobile-safe: emote bar sits ABOVE joystick/jump, big always-visible taps,
// context action button (Sit / Sip / Snap / Ring) right side above Jump. Nothing auto-hides.
import { EMOTES, PHOTO_SPOTS } from './config.js';
const CSS = `
.pp-root{position:fixed;inset:0;pointer-events:none;z-index:40;font-family:system-ui,'Segoe UI',sans-serif;color:#fff}
.pp-root *{box-sizing:border-box}
.pp-top{position:absolute;top:12px;left:50%;transform:translateX(-50%);display:flex;gap:8px;flex-wrap:wrap;justify-content:center}
.pp-chip{background:linear-gradient(#5fb6ffcc,#2d6fd1cc);border:2px solid #d6f1ff;border-radius:999px;padding:6px 14px;font-weight:800;font-size:14px;text-shadow:0 1px 0 #1a3a7a;box-shadow:0 3px 0 #1a3a7a88}
.pp-emotes{position:absolute;left:50%;transform:translateX(-50%);bottom:92px;display:flex;gap:10px;pointer-events:auto}
.pp-root.m .pp-emotes{bottom:180px}
.pp-btn{pointer-events:auto;min-width:64px;min-height:64px;border-radius:20px;border:3px solid #e6f6ff;background:linear-gradient(#8fd8ff,#3c8be6);color:#fff;font-weight:900;font-size:13px;display:flex;flex-direction:column;align-items:center;justify-content:center;box-shadow:0 5px 0 #1d4f9a,0 8px 18px #0006;cursor:pointer;touch-action:manipulation;user-select:none;-webkit-user-select:none;transition:transform .08s}
.pp-btn b{font-size:28px;line-height:1}
.pp-btn:active,.pp-btn.press{transform:translateY(4px) scale(.95);box-shadow:0 1px 0 #1d4f9a}
.pp-act{position:absolute;right:24px;bottom:130px;min-width:110px;min-height:80px;font-size:16px;background:linear-gradient(#ffd77a,#ff9a3c);box-shadow:0 5px 0 #a8551d,0 8px 18px #0006;border-color:#fff4d6}
.pp-root.m .pp-act{right:18px;bottom:250px}
.pp-act.idle{filter:saturate(.25) brightness(.85)}
.pp-banner{position:absolute;top:22%;left:50%;transform:translate(-50%,-10px) scale(.9);opacity:0;transition:all .3s cubic-bezier(.3,1.6,.5,1);font-size:34px;font-weight:900;text-align:center;text-shadow:0 3px 0 #1a3a7a,0 0 18px #7fd6ff}
.pp-banner small{display:block;font-size:16px;font-weight:700}
.pp-banner.on{opacity:1;transform:translate(-50%,0) scale(1)}
.pp-pop{position:absolute;font-weight:900;font-size:22px;animation:pp-up 1.1s ease-out forwards;text-shadow:0 2px 0 #1a3a7a;transform:translateX(-50%)}
@keyframes pp-up{0%{opacity:0;margin-top:10px}20%{opacity:1}100%{opacity:0;margin-top:-60px}}
.pp-flash{position:absolute;inset:0;background:#fff;opacity:0}
.pp-album{position:absolute;top:92px;right:12px;display:flex;gap:4px}
.pp-album span{width:30px;height:30px;border-radius:8px;background:#ffffff22;border:2px dashed #ffffff88;display:grid;place-items:center;font-size:15px}
.pp-album span.on{background:#ffe08a;border:2px solid #fff;animation:pp-pop .4s}
@keyframes pp-pop{50%{transform:scale(1.4)}}
.pp-card{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%) scale(.9);opacity:0;pointer-events:none;transition:all .25s;background:linear-gradient(#eaf7ff,#bfe3ff);color:#173a6e;border:4px solid #fff;border-radius:26px;padding:20px 26px;max-width:min(92vw,440px);text-align:center;box-shadow:0 10px 40px #0008}
.pp-card.on{opacity:1;pointer-events:auto;transform:translate(-50%,-50%) scale(1)}
.pp-card h1{margin:0 0 6px;font-size:30px}.pp-card p{margin:6px 0;font-size:15px}
.pp-go{margin-top:10px;font-size:20px;font-weight:900;padding:14px 30px;border-radius:18px;border:3px solid #fff;background:linear-gradient(#7ff0b0,#2fbf78);color:#fff;box-shadow:0 5px 0 #1d7a4a;cursor:pointer;min-height:56px}
`;
const el = (t, c, h = '') => { const e = document.createElement(t); if (c) e.className = c; e.innerHTML = h; return e; };
export class PlazaUI {
  constructor(mobile, { onEmote, onAct }) {
    this.mobile = mobile; this.style = el('style', '', CSS); document.head.appendChild(this.style);
    this.root = el('div', 'pp-root' + (mobile ? ' m' : '')); document.body.appendChild(this.root);
    this.top = el('div', 'pp-top'); this.zone = el('div', 'pp-chip', '🐧 Pengu Plaza'); this.stats = el('div', 'pp-chip', '☕ 0'); this.top.append(this.zone, this.stats); this.root.appendChild(this.top);
    this.album = el('div', 'pp-album', PHOTO_SPOTS.map(() => '<span>📷</span>').join('')); this.root.appendChild(this.album);
    this.emotes = el('div', 'pp-emotes');
    for (const e of EMOTES) { const b = el('button', 'pp-btn', `<b>${e.icon}</b>${e.label}${mobile ? '' : ` <small>${e.key.slice(-1)}</small>`}`); const fire = (ev) => { ev.preventDefault(); ev.stopPropagation(); b.classList.add('press'); setTimeout(() => b.classList.remove('press'), 120); onEmote(e.id); }; b.addEventListener('pointerdown', fire); this.emotes.appendChild(b); }
    this.root.appendChild(this.emotes);
    this.act = el('button', 'pp-btn pp-act idle', '<b>🐾</b>Explore'); this.act.addEventListener('pointerdown', (ev) => { ev.preventDefault(); ev.stopPropagation(); onAct(); }); this.root.appendChild(this.act);
    this.banner = el('div', 'pp-banner'); this.root.appendChild(this.banner);
    this.flashEl = el('div', 'pp-flash'); this.root.appendChild(this.flashEl);
    this.card = el('div', 'pp-card'); this.root.appendChild(this.card);
  }
  setAction(a) { const k = a ? a.icon + a.label : ''; if (k === this._ak) return; this._ak = k; this.act.innerHTML = a ? `<b>${a.icon}</b>${a.label}${this.mobile ? '' : ' <small>E</small>'}` : '<b>🐾</b>Explore'; this.act.classList.toggle('idle', !a); }
  setZone(t) { if (t !== this._z) { this._z = t; this.zone.textContent = t; } }
  setStats(save) { this.stats.textContent = `☕ ${save.cocoa}  ·  📷 ${save.photos.length}/${PHOTO_SPOTS.length}`; [...this.album.children].forEach((s, i) => { const on = save.photos.includes(PHOTO_SPOTS[i].id); if (on !== s.classList.contains('on')) { s.classList.toggle('on', on); s.textContent = on ? '🖼️' : '📷'; } }); }
  say(text, sub = '', ms = 1500) { this.banner.innerHTML = `${text}${sub ? `<small>${sub}</small>` : ''}`; this.banner.classList.add('on'); clearTimeout(this._bt); if (ms) this._bt = setTimeout(() => this.banner.classList.remove('on'), ms); }
  pop(text, x = innerWidth / 2, y = innerHeight * 0.45) { const p = el('div', 'pp-pop', text); p.style.left = x + 'px'; p.style.top = y + 'px'; this.root.appendChild(p); setTimeout(() => p.remove(), 1100); }
  flash(o = 0.9) { const f = this.flashEl; f.style.transition = 'none'; f.style.opacity = o; requestAnimationFrame(() => { f.style.transition = 'opacity .6s'; f.style.opacity = 0; }); }
  welcome(save, onGo) {
    const help = this.mobile ? 'Joystick to waddle · tap emotes · big orange button to Sit / Sip / Snap' : '<b>WASD</b> waddle · <b>1–4</b> emotes · <b>E</b> sit / sip / snap / ring';
    this.card.innerHTML = `<h1>🐧 Pengu Plaza</h1><p>${save.visits > 1 ? 'Welcome back, friend!' : 'A cozy snowy hangout. No timers, no losing — just vibes.'}</p><p>⛸ Skate the rink · ☕ grab cocoa · 🛎 ring the bell · 📷 snap all 5 landmarks for a postcard</p><p style="opacity:.75">${help}</p><button class="pp-go">Waddle in!</button>`;
    this.card.querySelector('button').onclick = () => { this.card.classList.remove('on'); onGo(); }; this.card.classList.add('on');
  }
  dispose() { clearTimeout(this._bt); this.root.remove(); this.style.remove(); }
}
