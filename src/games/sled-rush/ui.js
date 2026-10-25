// Sled Rush HUD — ICE look: frost blues/whites, chunky rounded chrome, soft pops.
// Uses shared --ice-* tokens when Cosmetics' ice-ui-skin defines them; hand-rolled fallbacks otherwise.
// Styles are injected and removed with the game (no shared CSS is touched).
import './iceTokens.css'; // Cosmetics ICE tokens (cosmetics/ice-ui-skin @ 280383a), variables only
import { STARS, FIRST_CLEAR_BB, THREE_STAR_BB } from './config.js';

const CSS = `
.sr{--deep:var(--ice-text,#0e2a45);--glass:var(--ice-panel-grad,rgba(232,244,255,.88));
  position:absolute;inset:0;pointer-events:none;z-index:12;font-family:inherit;color:var(--deep)}
.sr button{pointer-events:auto;font-family:inherit;cursor:pointer;touch-action:manipulation;-webkit-tap-highlight-color:transparent;user-select:none}
.sr-chip{background:var(--glass);border-radius:20px;border-radius:var(--ice-radius-lg,20px);box-shadow:0 6px 0 var(--ice-border-cool,#9cc6ea),var(--ice-shadow-lg),var(--ice-edge);backdrop-filter:var(--ice-frost-blur,blur(8px));border:2px solid var(--ice-border,#fff)}
.sr-top{position:absolute;top:64px;left:50%;transform:translateX(-50%);display:flex;gap:10px;align-items:center;padding:8px 14px;white-space:nowrap}
.sr-time{font:900 30px/1 ui-monospace,Menlo,monospace;min-width:104px;text-align:center}
.sr-pill{background:linear-gradient(180deg,#fff,#dcefff);border-radius:14px;padding:5px 10px;font-weight:900;font-size:14px;box-shadow:inset 0 -3px 0 #b8d8f3}
.sr-stars{font-size:20px;letter-spacing:2px}.sr-stars .off{filter:grayscale(1) opacity(.35)}
.sr-speed{position:absolute;right:18px;bottom:110px;width:120px;height:120px;border-radius:50%;display:grid;place-items:center;text-align:center;font-weight:900}
.sr-speed b{font-size:34px;line-height:1}.sr-speed small{font-size:11px;opacity:.7;display:block}
.sr-speed.boost{animation:sr-glow .35s infinite alternate}
@keyframes sr-glow{to{box-shadow:0 6px 0 #9cc6ea,0 0 40px 10px #ffe66b,inset 0 0 0 3px #fff}}
.sr-banner{position:absolute;top:30%;left:0;right:0;text-align:center;font-weight:900;font-size:84px;color:#fff;
  text-shadow:0 5px 0 #3a8fd6,0 10px 30px rgba(0,40,100,.6);opacity:0;transform:scale(.6);transition:opacity .18s,transform .25s cubic-bezier(.3,1.8,.5,1)}
.sr-banner.on{opacity:1;transform:scale(1)}.sr-banner small{display:block;font-size:22px;text-shadow:0 2px 0 #3a8fd6}
.sr-pop{position:absolute;font-weight:900;font-size:24px;color:#fff;text-shadow:0 3px 0 #2e86d1;animation:sr-float 1s ease-out forwards;white-space:nowrap}
@keyframes sr-float{0%{transform:translate(-50%,0) scale(.6);opacity:0}20%{transform:translate(-50%,-10px) scale(1.25);opacity:1}100%{transform:translate(-50%,-70px) scale(1);opacity:0}}
.sr-lines{position:absolute;inset:0;opacity:0;transition:opacity .2s;background:repeating-conic-gradient(from 0deg at 50% 45%,rgba(255,255,255,.0) 0 3deg,rgba(220,240,255,.22) 3deg 3.6deg);
  -webkit-mask:radial-gradient(circle at 50% 45%,transparent 32%,#000 70%);mask:radial-gradient(circle at 50% 45%,transparent 32%,#000 70%)}
.sr-flash{position:absolute;inset:0;background:radial-gradient(circle,rgba(255,255,255,.0) 40%,rgba(160,220,255,.55));opacity:0;transition:opacity .4s}
.sr-card{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%) scale(.9);opacity:0;transition:all .3s cubic-bezier(.3,1.6,.5,1);
  width:min(420px,92vw);padding:22px 22px 20px;text-align:center;pointer-events:auto}
.sr-card.on{opacity:1;transform:translate(-50%,-50%) scale(1)}
.sr-card h1{margin:0 0 4px;font-size:40px;font-weight:900;color:#fff;text-shadow:0 4px 0 var(--ice-accent,#3a8fd6),0 0 18px var(--ice-accent-hi,#9be3ff)}
.sr-card p{margin:6px 0;font-weight:700}
.sr-big{font-size:46px;font-weight:900;margin:6px 0}
.sr-card .stars{font-size:48px;margin:6px 0}.sr-card .stars span{display:inline-block;filter:grayscale(1) opacity(.3);transform:scale(.6);transition:all .35s cubic-bezier(.3,2,.5,1)}
.sr-card .stars span.on{filter:none;transform:scale(1.15)}
.sr-go{margin-top:14px;border:0;border-radius:18px;padding:14px 30px;font-size:22px;font-weight:900;color:#fff;
  background:var(--ice-accent-grad,#2f9bea);box-shadow:0 6px 0 var(--ice-accent-lo,#1d6fb3),var(--ice-glow);transition:transform var(--ice-dur-fast,.12s) var(--ice-spring)}
.sr-go:active{transform:translateY(4px);box-shadow:0 2px 0 #1d6fb3}
.sr-go.alt{background:linear-gradient(180deg,#fff,#dbeeff);color:var(--deep);box-shadow:0 6px 0 #9cc6ea;font-size:16px;padding:10px 18px;margin-left:8px}
.sr-reward{display:inline-block;margin:4px;padding:6px 12px;border-radius:14px;background:#fff6c9;color:var(--ice-accent-deep);border:2px solid var(--ice-gold,#ffcf4d);font-weight:900;box-shadow:inset 0 -3px 0 #f0d77a;animation:sr-bounce .5s}
@keyframes sr-bounce{50%{transform:scale(1.2)}}
.sr-help{font-size:13px;opacity:.75}
.sr-snow{position:absolute;inset:0;overflow:hidden;pointer-events:none}
`;

const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const fmt = (s) => s == null ? '—' : `${Math.floor(s / 60)}:${(s % 60).toFixed(2).padStart(5, '0')}`;

export class SledUI {
  constructor(mobile) {
    this.style = el('style', null, CSS); document.head.appendChild(this.style);
    this.root = el('div', 'sr'); document.body.appendChild(this.root);
    this.lines = el('div', 'sr-lines'); this.flashEl = el('div', 'sr-flash'); this.root.append(this.lines, this.flashEl);
    this.top = el('div', 'sr-top sr-chip', `<span class="sr-time">0:00.00</span><span class="sr-pill g">🚩 0</span><span class="sr-stars"></span>`); this.root.appendChild(this.top);
    this.speed = el('div', 'sr-speed sr-chip', '<div><b>0</b><small>km/h</small></div>'); this.root.appendChild(this.speed);
    this.banner = el('div', 'sr-banner'); this.root.appendChild(this.banner);
    this.card = el('div', 'sr-card sr-chip'); this.root.appendChild(this.card);
    this.mobile = mobile; this.showHud(false);
  }
  showHud(on) { this.top.style.display = this.speed.style.display = on ? '' : 'none'; if (!on) this.lines.style.opacity = 0; }
  setHud(time, gates, total, kmh, boosting, speedK) {
    this.top.children[0].textContent = fmt(time); this.top.children[1].textContent = `🚩 ${gates}/${total}`;
    const s = time < STARS.three ? 3 : time < STARS.two ? 2 : 1;
    if (s !== this._s) { this._s = s; this.top.children[2].innerHTML = [1, 2, 3].map(i => `<span class="${i <= s ? '' : 'off'}">⭐</span>`).join(''); }
    this.speed.querySelector('b').textContent = Math.round(kmh); this.speed.classList.toggle('boost', boosting);
    this.lines.style.opacity = Math.max(0, speedK - 0.45) * 1.8;
  }
  say(text, sub = '', ms = 900) {
    this.banner.innerHTML = `${text}${sub ? `<small>${sub}</small>` : ''}`; this.banner.classList.add('on');
    clearTimeout(this._bt); if (ms) this._bt = setTimeout(() => this.banner.classList.remove('on'), ms);
  }
  pop(text, x = innerWidth / 2, y = innerHeight * 0.55) { const p = el('div', 'sr-pop', text); p.style.left = x + 'px'; p.style.top = y + 'px'; this.root.appendChild(p); setTimeout(() => p.remove(), 1000); }
  flash(color = 'rgba(160,220,255,.55)') { this.flashEl.style.background = `radial-gradient(circle,transparent 40%,${color})`; this.flashEl.style.transition = 'none'; this.flashEl.style.opacity = 1; requestAnimationFrame(() => { this.flashEl.style.transition = 'opacity .5s'; this.flashEl.style.opacity = 0; }); }
  hideCard() { this.card.classList.remove('on'); }
  showIntro(save, onGo) {
    const help = this.mobile ? 'Joystick ← → to lean · Jump button to hop' : '<kbd>A</kbd>/<kbd>D</kbd> or ←/→ lean · <kbd>Space</kbd> hop · <kbd>S</kbd> brake · <kbd>R</kbd> restart';
    this.card.innerHTML = `<h1>🛷 Sled Rush</h1><p>Rip down Aurora Mountain. Thread the glowing gates (−${0.4}s each), hit boost pads, catch big air.</p>
      <p>Best: <b>${fmt(save.best)}</b> ${'⭐'.repeat(save.stars)}${'<span style="opacity:.3">⭐</span>'.repeat(3 - save.stars)}</p>
      <p class="sr-help">⭐⭐ under ${STARS.two}s · ⭐⭐⭐ under ${STARS.three}s${save.questDone ? '' : ' → Powder Scarf'}</p>
      ${save.cleared ? '' : `<p class="sr-help">First finish: +${FIRST_CLEAR_BB} BB</p>`}
      <p class="sr-help">${help}</p><button class="sr-go">Let's ride!</button>`;
    this.card.querySelector('button').onclick = onGo; this.card.classList.add('on');
  }
  showResult(r, onAgain, onStarSfx) {
    const msg = r.stars === 3 ? 'Legendary run!' : r.stars === 2 ? 'So close to ⭐⭐⭐!' : 'Nice ride!';
    this.card.innerHTML = `<h1>${r.newBest ? 'New best!' : 'Finish!'}</h1><div class="sr-big">${fmt(r.time)}</div>
      <div class="stars"><span>⭐</span><span>⭐</span><span>⭐</span></div><p>${msg}</p>
      <p class="sr-help">🚩 ${r.gates}/${r.total} gates · ✨ ${r.air.toFixed(1)}s air · 💥 ${r.crashes} tumbles</p>
      <div class="rw"></div>
      <button class="sr-go">One more run! ↻</button><button class="sr-go alt">Menu</button>`;
    const sp = this.card.querySelectorAll('.stars span');
    for (let i = 0; i < r.stars; i++) setTimeout(() => { sp[i].classList.add('on'); onStarSfx?.(i); }, 450 + i * 380);
    const rw = this.card.querySelector('.rw'); r.rewards.forEach((t, i) => setTimeout(() => rw.appendChild(el('span', 'sr-reward', t)), 1500 + i * 300));
    const [again, menu] = this.card.querySelectorAll('button'); again.onclick = () => onAgain(true); menu.onclick = () => onAgain(false);
    this.card.classList.add('on');
  }
  addReward(t) { const rw = this.card.querySelector('.rw'); rw?.appendChild(el('span', 'sr-reward', t)); }
  dispose() { clearTimeout(this._bt); this.root.remove(); this.style.remove(); }
}
