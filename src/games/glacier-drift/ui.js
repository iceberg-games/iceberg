// Glacier Drift HUD — icy Roblox-cozy glass. DOM is built ONCE; per-frame updates only touch textContent/
// style/classes (never root.innerHTML). Mobile: big USE power-up button always present during races.
import { STARS, POWER, FIRST_FINISH_BB } from './config.js';

const CSS = `
.gd{--deep:#0e2a45;--glass:linear-gradient(180deg,rgba(255,255,255,.92),rgba(220,240,255,.88));
  position:absolute;inset:0;pointer-events:none;z-index:12;font-family:inherit;color:var(--deep)}
.gd button{pointer-events:auto;font-family:inherit;cursor:pointer;touch-action:manipulation;-webkit-tap-highlight-color:transparent;user-select:none;-webkit-user-select:none}
.gd-chip{background:var(--glass);border-radius:20px;box-shadow:0 6px 0 #9cc6ea,0 10px 24px rgba(20,70,130,.25);border:2px solid #fff;backdrop-filter:blur(8px)}
.gd-top{position:absolute;top:64px;left:50%;transform:translateX(-50%);display:flex;gap:10px;align-items:center;padding:8px 14px;white-space:nowrap}
.gd-time{font:900 28px/1 ui-monospace,Menlo,monospace;min-width:100px;text-align:center}
.gd-pill{background:linear-gradient(180deg,#fff,#dcefff);border-radius:14px;padding:5px 10px;font-weight:900;font-size:14px;box-shadow:inset 0 -3px 0 #b8d8f3}
.gd-stars{font-size:18px;letter-spacing:2px}.gd-stars .off{filter:grayscale(1) opacity(.35)}
.gd-place{position:absolute;top:64px;left:16px;padding:6px 16px;font-weight:900;font-size:40px;line-height:1;text-align:center;transition:transform .2s cubic-bezier(.3,2,.5,1)}
.gd-place small{display:block;font-size:12px;opacity:.7}.gd-place.bump{transform:scale(1.25)}
.gd-prog{position:absolute;left:30px;top:150px;width:22px;height:min(280px,40vh);padding:0}
.gd-prog i{position:absolute;left:50%;width:16px;height:16px;margin:-8px 0 0 -8px;border-radius:50%;border:2px solid #fff;box-shadow:0 2px 4px rgba(0,0,0,.25)}
.gd-prog i.me{width:22px;height:22px;margin:-11px 0 0 -11px;z-index:2}
.gd-prog b{position:absolute;left:-4px;right:-4px;top:2px;height:4px;background:repeating-linear-gradient(90deg,#0e2a45 0 4px,#fff 4px 8px)}
.gd-speed{position:absolute;right:18px;top:64px;width:96px;height:96px;border-radius:50%;display:grid;place-items:center;text-align:center;font-weight:900}
.gd-speed b{font-size:28px;line-height:1}.gd-speed small{font-size:10px;opacity:.7;display:block}
.gd-speed.boost{animation:gd-glow .3s infinite alternate}@keyframes gd-glow{to{box-shadow:0 6px 0 #9cc6ea,0 0 40px 10px #ffd84a}}
.gd-use{position:absolute;right:20px;bottom:200px;width:116px;height:116px;border-radius:50%;border:4px solid #fff;font-size:50px;line-height:1;z-index:95;
  background:radial-gradient(circle at 35% 30%,#fff,#cfe9ff 60%,#9cc6ea);box-shadow:0 7px 0 #6fa6d6,0 10px 22px rgba(0,40,100,.3);display:grid;place-items:center;transition:transform .12s}
.gd-use small{position:absolute;bottom:10px;left:0;right:0;font-size:12px;font-weight:900;color:var(--deep)}
.gd-use.empty{filter:grayscale(.8) opacity(.6)}.gd-use.ready{animation:gd-ready .6s infinite alternate}
.gd-use:active{transform:translateY(5px) scale(.96)}@keyframes gd-ready{to{box-shadow:0 7px 0 #6fa6d6,0 0 30px 8px var(--pc,#ffd84a)}}
.gd-desk .gd-use{bottom:24px;width:92px;height:92px;font-size:40px}
.gd-fx{position:absolute;left:50%;bottom:28px;transform:translateX(-50%);display:flex;gap:8px}
.gd-fx span{padding:6px 12px;border-radius:14px;font-weight:900;font-size:14px;background:#fff;box-shadow:inset 0 -3px 0 #b8d8f3}
.gd-banner{position:absolute;top:28%;left:0;right:0;text-align:center;font-weight:900;font-size:84px;color:#fff;
  text-shadow:0 5px 0 #3a8fd6,0 10px 30px rgba(0,40,100,.6);opacity:0;transform:scale(.6);transition:opacity .18s,transform .25s cubic-bezier(.3,1.8,.5,1)}
.gd-banner.on{opacity:1;transform:scale(1)}.gd-banner small{display:block;font-size:22px;text-shadow:0 2px 0 #3a8fd6}
.gd-pop{position:absolute;font-weight:900;font-size:24px;color:#fff;text-shadow:0 3px 0 #2e86d1;animation:gd-float 1s ease-out forwards;white-space:nowrap}
@keyframes gd-float{0%{transform:translate(-50%,0) scale(.6);opacity:0}20%{transform:translate(-50%,-10px) scale(1.25);opacity:1}100%{transform:translate(-50%,-70px) scale(1);opacity:0}}
.gd-lines{position:absolute;inset:0;opacity:0;transition:opacity .2s;background:repeating-conic-gradient(from 0deg at 50% 45%,transparent 0 3deg,rgba(220,240,255,.25) 3deg 3.6deg);
  -webkit-mask:radial-gradient(circle at 50% 45%,transparent 32%,#000 70%);mask:radial-gradient(circle at 50% 45%,transparent 32%,#000 70%)}
.gd-frost{position:absolute;inset:0;opacity:0;transition:opacity .3s;box-shadow:inset 0 0 120px 40px rgba(170,220,255,.9)}
.gd-flash{position:absolute;inset:0;opacity:0}
.gd-card{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%) scale(.9);opacity:0;transition:all .3s cubic-bezier(.3,1.6,.5,1);
  width:min(440px,92vw);max-height:88vh;overflow:auto;padding:22px;text-align:center;pointer-events:none}
.gd-card.on{opacity:1;transform:translate(-50%,-50%) scale(1);pointer-events:auto}
.gd-card h1{margin:0 0 4px;font-size:40px;font-weight:900;color:#fff;text-shadow:0 4px 0 #3a8fd6,0 0 18px #9be3ff}
.gd-card p{margin:6px 0;font-weight:700}.gd-big{font-size:44px;font-weight:900;margin:4px 0}
.gd-card .stars{font-size:48px;margin:6px 0}.gd-card .stars span{display:inline-block;filter:grayscale(1) opacity(.3);transform:scale(.6);transition:all .35s cubic-bezier(.3,2,.5,1)}
.gd-card .stars span.on{filter:none;transform:scale(1.15)}
.gd-pw{display:flex;justify-content:center;gap:8px;margin:8px 0;flex-wrap:wrap}.gd-pw span{background:#fff;border-radius:12px;padding:4px 8px;font-weight:800;font-size:13px;box-shadow:inset 0 -3px 0 #b8d8f3}
.gd-board{margin:8px auto;border-collapse:collapse;font-weight:800}.gd-board td{padding:3px 10px}.gd-board tr.me{color:#1d6fb3}
.gd-go{margin-top:12px;border:0;border-radius:18px;padding:16px 32px;min-height:56px;font-size:22px;font-weight:900;color:#fff;background:linear-gradient(180deg,#5cc0ff,#2f9bea);box-shadow:0 6px 0 #1d6fb3;transition:transform .12s}
.gd-go:active{transform:translateY(4px);box-shadow:0 2px 0 #1d6fb3}
.gd-go.alt{background:linear-gradient(180deg,#fff,#dbeeff);color:var(--deep);box-shadow:0 6px 0 #9cc6ea;font-size:17px;padding:12px 20px;margin-left:8px}
.gd-reward{display:inline-block;margin:4px;padding:6px 12px;border-radius:14px;background:#fff6c9;border:2px solid #ffcf4d;font-weight:900;animation:gd-bounce .5s}
@keyframes gd-bounce{50%{transform:scale(1.2)}}.gd-help{font-size:13px;opacity:.75}
@media (max-width:600px){.gd-top{top:56px;padding:6px 10px}.gd-time{font-size:22px;min-width:80px}.gd-speed{display:none!important}.gd-banner{font-size:64px}}
`;
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
export const fmt = (s) => s == null ? '—' : `${Math.floor(s / 60)}:${(s % 60).toFixed(2).padStart(5, '0')}`;
const ORD = ['', '1st', '2nd', '3rd', '4th'];

export class GlacierUI {
  constructor(mobile, onUse) {
    this.mobile = mobile;
    this.style = el('style', null, CSS); document.head.appendChild(this.style);
    this.root = el('div', 'gd' + (mobile ? '' : ' gd-desk')); document.body.appendChild(this.root);
    this.lines = el('div', 'gd-lines'); this.frost = el('div', 'gd-frost'); this.flashEl = el('div', 'gd-flash'); this.root.append(this.lines, this.frost, this.flashEl);
    this.top = el('div', 'gd-top gd-chip'); this.tTime = el('span', 'gd-time', '0:00.00'); this.tGates = el('span', 'gd-pill', '🚩 0'); this.tStars = el('span', 'gd-stars');
    this.top.append(this.tTime, this.tGates, this.tStars);
    this.place = el('div', 'gd-place gd-chip'); this.placeN = el('span', null, '1st'); this.place.append(this.placeN, el('small', null, 'PLACE'));
    this.prog = el('div', 'gd-prog gd-chip'); this.prog.appendChild(el('b')); this.dots = [];
    this.speed = el('div', 'gd-speed gd-chip', '<div><b>0</b><small>km/h</small></div>'); this.speedB = this.speed.querySelector('b');
    this.use = el('button', 'gd-use empty'); this.useIcon = el('span', null, '·'); this.useLbl = el('small', null, mobile ? 'USE' : 'E'); this.use.append(this.useIcon, this.useLbl);
    this.use.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); onUse?.(); });
    this.fx = el('div', 'gd-fx'); this.banner = el('div', 'gd-banner'); this.card = el('div', 'gd-card gd-chip');
    this.hud = [this.top, this.place, this.prog, this.speed, this.use, this.fx];
    this.root.append(...this.hud, this.banner, this.card);
    this._fx = ''; this.showHud(false);
  }
  setRacers(colors) { for (const d of this.dots) d.remove(); this.dots = colors.map((c, i) => { const d = el('i', i === 0 ? 'me' : ''); d.style.background = c; this.prog.appendChild(d); return d; }); }
  showHud(on) { for (const h of this.hud) h.style.display = on ? '' : 'none'; if (!on) { this.lines.style.opacity = 0; this.frost.style.opacity = 0; } }
  setHud(h) {
    this.tTime.textContent = fmt(h.time); this.tGates.textContent = `🚩 ${h.gates}/${h.total}`;
    const s = h.time < STARS.three && h.place === 1 ? 3 : h.time < STARS.two ? 2 : 1;
    if (s !== this._s) { this._s = s; this.tStars.innerHTML = [1, 2, 3].map(i => `<span class="${i <= s ? '' : 'off'}">⭐</span>`).join(''); }
    if (h.place !== this._p) { if (this._p && h.place < this._p) { this.place.classList.add('bump'); setTimeout(() => this.place.classList.remove('bump'), 220); } this._p = h.place; this.placeN.textContent = ORD[h.place]; }
    h.progress.forEach((p, i) => { if (this.dots[i]) this.dots[i].style.top = `${(1 - Math.min(1, p)) * 100}%`; });
    this.speedB.textContent = Math.round(h.kmh); this.speed.classList.toggle('boost', h.boosting);
    this.lines.style.opacity = Math.max(0, h.speedK - 0.45) * 1.8 + (h.boosting ? 0.4 : 0);
    if (h.held !== this._held) {
      const held = this._held = h.held; this.useIcon.textContent = held ? POWER[held].icon : '·';
      this.use.classList.toggle('empty', !held); this.use.classList.toggle('ready', !!held);
      if (held) this.use.style.setProperty('--pc', POWER[held].color);
      this.useLbl.textContent = held ? (this.mobile ? POWER[held].label.toUpperCase() : 'E · ' + POWER[held].label) : (this.mobile ? 'USE' : 'E');
    }
    const fx = h.active.map(([k, t]) => `${POWER[k].icon} ${t.toFixed(1)}`).join('|');
    if (fx !== this._fx) { this._fx = fx; while (this.fx.firstChild) this.fx.firstChild.remove(); for (const s2 of fx ? fx.split('|') : []) this.fx.appendChild(el('span', null, s2)); }
    this.frost.style.opacity = h.frozen ? 1 : 0;
  }
  say(text, sub = '', ms = 900) {
    this.banner.innerHTML = `${text}${sub ? `<small>${sub}</small>` : ''}`; this.banner.classList.add('on');
    clearTimeout(this._bt); if (ms) this._bt = setTimeout(() => this.banner.classList.remove('on'), ms);
  }
  pop(text, x = innerWidth / 2, y = innerHeight * 0.55) { const p = el('div', 'gd-pop', text); p.style.left = x + 'px'; p.style.top = y + 'px'; this.root.appendChild(p); setTimeout(() => p.remove(), 1000); }
  flash(color = 'rgba(160,220,255,.55)') { const f = this.flashEl; f.style.background = `radial-gradient(circle,transparent 40%,${color})`; f.style.transition = 'none'; f.style.opacity = 1; requestAnimationFrame(() => { f.style.transition = 'opacity .5s'; f.style.opacity = 0; }); }
  hideCard() { this.card.classList.remove('on'); }
  showIntro(save, onGo) {
    const help = this.mobile ? 'Joystick ← → steer · Jump to hop · big button = power-up' : '<b>A/D</b> or ←/→ steer · <b>Space</b> hop · <b>E</b>/<b>Shift</b> power-up · <b>S</b> brake · <b>R</b> restart';
    this.card.innerHTML = `<h1>🛷 Glacier Drift</h1><p>Race 3 rivals down the glacier. Grab power-ups, thread gates (−0.35s), catch air!</p>
      <div class="gd-pw">${Object.values(POWER).map(p => `<span>${p.icon} ${p.label}</span>`).join('')}</div>
      <p>Best: <b>${fmt(save.best)}</b> ${'⭐'.repeat(save.stars)}${'<span style="opacity:.3">⭐</span>'.repeat(3 - save.stars)} · 🏆 ${save.wins}</p>
      <p class="gd-help">⭐⭐ under ${STARS.two}s · ⭐⭐⭐ 1st place under ${STARS.three}s</p>
      ${save.cleared ? '' : `<p class="gd-help">First finish: +${FIRST_FINISH_BB} BB</p>`}
      <p class="gd-help">${help}</p><button class="gd-go">Let's drift! 🛷</button>`;
    this.card.querySelector('button').onclick = onGo; this.card.classList.add('on');
  }
  showResult(r, onAgain, onStar) {
    const msg = r.place === 1 ? (r.stars === 3 ? 'Glacier legend! 🏆' : 'You won! 🏆') : r.place === 2 ? 'So close — one more!' : 'Nice drift!';
    this.card.innerHTML = `<h1>${ORD[r.place]} Place!</h1><div class="gd-big">${fmt(r.time)}${r.newBest ? ' <small style="font-size:18px">NEW BEST</small>' : ''}</div>
      <div class="stars"><span>⭐</span><span>⭐</span><span>⭐</span></div><p>${msg}</p>
      <table class="gd-board">${r.board.map((b, i) => `<tr class="${b.me ? 'me' : ''}"><td>${ORD[i + 1]}</td><td style="color:${b.color}">●</td><td>${b.name}</td><td>${b.time != null ? fmt(b.time) : '…'}</td></tr>`).join('')}</table>
      <p class="gd-help">🚩 ${r.gates}/${r.total} gates · ✨ ${r.air.toFixed(1)}s air · ⚡ ${r.powers} power-ups · 💥 ${r.crashes}</p>
      <div class="rw"></div><button class="gd-go">Race again ↻</button><button class="gd-go alt">Menu</button>`;
    const sp = this.card.querySelectorAll('.stars span');
    for (let i = 0; i < r.stars; i++) setTimeout(() => { sp[i].classList.add('on'); onStar?.(i); }, 450 + i * 380);
    const rw = this.card.querySelector('.rw'); r.rewards.forEach((t, i) => setTimeout(() => rw.appendChild(el('span', 'gd-reward', t)), 1500 + i * 300));
    const [again, menu] = this.card.querySelectorAll('button'); again.onclick = () => onAgain(true); menu.onclick = () => onAgain(false);
    this.card.classList.add('on');
  }
  dispose() { clearTimeout(this._bt); this.root.remove(); this.style.remove(); }
}
