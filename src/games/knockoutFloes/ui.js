// Knockout Floes HUD (DOM overlay, styles injected/removed with the game).
import { EMOTES } from './config.js';
const CSS = `
.kof{position:absolute;inset:0;pointer-events:none;z-index:12;color:#eaf6ff;font-family:inherit}
.kof button{pointer-events:auto;font-family:inherit;cursor:pointer;touch-action:none;-webkit-tap-highlight-color:transparent;user-select:none}
.kof-top{position:absolute;top:66px;left:50%;transform:translateX(-50%);display:flex;gap:12px;align-items:center;background:linear-gradient(180deg,#fff,#dff3ff);color:#1d4f7a;border:4px solid #fff;border-radius:22px;padding:6px 16px 8px;box-shadow:0 6px 0 #9cc9ea,0 14px 30px rgba(10,30,70,.35)}
.kof-top>div{background:#eef8ff;border-radius:14px;padding:3px 10px;text-align:center;font-weight:900;font-size:22px;min-width:52px}
.kof-top small{display:block;font-size:10px;letter-spacing:2px;opacity:.7}
.kof-low{color:#e0405a;animation:kofp .5s infinite alternate}
.kof-board{position:absolute;top:66px;right:14px;background:rgba(10,24,52,.72);border:3px solid rgba(255,255,255,.7);border-radius:16px;padding:8px 10px;min-width:150px;font-size:13px;font-weight:800}
.kof-board h4{margin:0 0 4px;font-size:11px;letter-spacing:2px;opacity:.75}
.kof-board div{display:flex;gap:6px;align-items:center;padding:2px 0}
.kof-board i{width:10px;height:10px;border-radius:50%;display:inline-block;box-shadow:0 0 6px currentColor}
.kof-board .out{opacity:.35;text-decoration:line-through}
.kof-board .me{color:#ffe680}
.kof-board b{margin-left:auto}
.kof-feed{position:absolute;top:150px;left:14px;display:flex;flex-direction:column;gap:4px;font-size:14px;font-weight:800}
.kof-feed div{background:rgba(10,24,52,.75);border-radius:10px;padding:4px 10px;animation:kofin .25s ease-out;transition:opacity .5s}
.kof-banner{position:absolute;top:34%;left:50%;transform:translate(-50%,-50%) scale(.7);opacity:0;font-size:46px;font-weight:900;text-align:center;transition:all .2s;text-shadow:0 0 22px #6cf,0 4px 0 #123;white-space:nowrap}
.kof-banner.show{opacity:1;transform:translate(-50%,-50%) scale(1)}
.kof-banner small{display:block;font-size:20px;color:#ffe680}
.kof-x{position:absolute;left:50%;top:46%;width:26px;height:26px;transform:translate(-50%,-50%);border:3px solid rgba(255,255,255,.8);border-radius:50%;box-shadow:0 0 8px #6cf}
.kof-x.lock{border-color:#ff6b7f;box-shadow:0 0 12px #ff6b7f;width:34px;height:34px}
.kof-charge{position:absolute;left:50%;top:calc(46% + 26px);width:80px;height:7px;transform:translateX(-50%);background:rgba(0,0,0,.4);border-radius:4px;overflow:hidden;opacity:0;transition:opacity .15s}
.kof-charge i{display:block;height:100%;width:0;background:linear-gradient(90deg,#9ff,#ffd24a,#ff5d73)}
.kof-flash{position:absolute;inset:0;background:radial-gradient(circle,rgba(255,80,100,0) 50%,rgba(255,60,90,.45));opacity:0;transition:opacity .4s}
.kof-flash.on{opacity:1;transition:none}
.kof-end{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);background:linear-gradient(180deg,#fff,#dff3ff);color:#1d4f7a;border:5px solid #fff;border-radius:26px;box-shadow:0 8px 0 #9cc9ea,0 20px 50px rgba(0,0,0,.4);padding:20px 30px;text-align:center;min-width:300px;display:none;pointer-events:auto}
.kof-end.show{display:block;animation:kofin .3s ease-out}
.kof-end h2{margin:0 0 4px;font-size:30px}
.kof-end .row{font-size:14px;margin:3px 0}
.kof-end .pb{color:#e07a10;font-weight:900;font-size:18px}
.kof-end .go{margin-top:12px;border:0;border-radius:14px;padding:12px 26px;font-size:18px;font-weight:900;color:#5a2a00;background:linear-gradient(180deg,#ffd77a,#ff9a2e);box-shadow:0 6px 0 #c0641a}
.kof-emotes{position:absolute;bottom:110px;left:14px;display:flex;flex-direction:column;gap:8px}
.kof-emotes button{border:3px solid #fff;background:rgba(255,255,255,.85);border-radius:50%;width:44px;height:44px;font-size:22px;box-shadow:0 4px 0 #9cc9ea}
.kof-throw{position:absolute;right:26px;bottom:200px;width:96px;height:96px;border-radius:50%;border:5px solid #fff;font-size:15px;font-weight:900;color:#1d4f7a;background:radial-gradient(circle at 35% 30%,#fff,#bfe6ff);box-shadow:0 6px 0 #7fb3dd,0 10px 24px rgba(0,0,0,.35)}
.kof-throw:active{transform:scale(.93)}
.kof-help{position:absolute;top:128px;left:50%;transform:translateX(-50%);font-size:12px;opacity:.8;text-shadow:0 0 6px #000;white-space:nowrap}
@keyframes kofp{to{transform:scale(1.12)}}
@keyframes kofin{from{transform:translate(-50%,-50%) scale(.6);opacity:0}}
.kof-feed div{animation-name:kofslide}@keyframes kofslide{from{transform:translateX(-30px);opacity:0}}
`;
export class FloesUI {
  constructor(mobile, { onEmote, onThrowDown, onThrowUp }) {
    this.style = document.createElement('style'); this.style.textContent = CSS; document.head.appendChild(this.style);
    const r = this.root = document.createElement('div'); r.className = 'kof';
    r.innerHTML = `<div class="kof-top"><div><small>ALIVE</small><span data-a>6</span></div><div><small>TIME</small><span data-t>90</span></div><div><small>KOs</small><span data-k>0</span></div><div><small>STREAK</small><span data-s>0</span></div></div>
      <div class="kof-board" data-bd></div><div class="kof-feed" data-fd></div>
      <div class="kof-x" data-x></div><div class="kof-charge" data-cg><i></i></div>
      <div class="kof-flash" data-f></div><div class="kof-banner" data-b></div><div class="kof-end" data-e></div>
      <div class="kof-emotes">${EMOTES.map((e, i) => `<button data-em="${i}">${e}</button>`).join('')}</div>
      ${mobile ? '<button class="kof-throw" data-th>❄<br>THROW</button>' : ''}
      <div class="kof-help">${mobile ? 'Joystick move · Jump to hop gaps · hold THROW to charge' : 'WASD move · Space hop · Click / E throw (hold to charge) · 1-4 emote · R rematch'}</div>`;
    document.body.appendChild(r);
    this.$ = (k) => r.querySelector(`[data-${k}]`);
    r.querySelectorAll('[data-em]').forEach(b => b.addEventListener('pointerdown', (e) => { e.stopPropagation(); onEmote(+b.dataset.em); }));
    const th = this.$('th');
    if (th) { th.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); onThrowDown(); }); ['pointerup', 'pointercancel', 'pointerleave'].forEach(n => th.addEventListener(n, (e) => { e.stopPropagation(); onThrowUp(); })); }
  }
  hud({ alive, time, kos, streak, charge, lock, board }) {
    this.set('a', alive); const t = Math.ceil(Math.max(0, time)); this.set('t', t); this.$('t').classList.toggle('kof-low', t <= 10);
    this.set('k', kos); this.set('s', streak);
    this.$('x').classList.toggle('lock', !!lock);
    const cg = this.$('cg'); cg.style.opacity = charge > 0 ? 1 : 0; cg.firstChild.style.width = `${Math.round(charge * 100)}%`;
    const html = '<h4>🏆 STANDINGS</h4>' + board.map((p, i) => `<div class="${p.out ? 'out' : ''} ${p.me ? 'me' : ''}"><i style="color:${p.color};background:${p.color}"></i>${i === 0 && !p.out && p.kos > 0 ? '👑 ' : ''}${p.name}<b>${p.kos}💥</b></div>`).join('');
    if (html !== this._bd) { this.$('bd').innerHTML = html; this._bd = html; }
  }
  set(k, v) { const e = this.$(k); if (e.textContent !== String(v)) e.textContent = v; }
  feed(text) {
    const f = this.$('fd'), d = document.createElement('div'); d.innerHTML = text; f.prepend(d);
    while (f.children.length > 5) f.lastChild.remove();
    setTimeout(() => { d.style.opacity = 0; setTimeout(() => d.remove(), 500); }, 3500);
  }
  banner(text, sub = '', ms = 1200) {
    const b = this.$('b'); b.innerHTML = `${text}${sub ? `<small>${sub}</small>` : ''}`; b.classList.add('show');
    clearTimeout(this._bt); this._bt = setTimeout(() => b.classList.remove('show'), ms);
  }
  flash() { const f = this.$('f'); f.classList.add('on'); requestAnimationFrame(() => requestAnimationFrame(() => f.classList.remove('on'))); }
  showEnd(r, onRetry) {
    const e = this.$('e');
    e.innerHTML = `<h2>${r.survived ? '⏱ Survived the clock!' : r.win ? '🏆 Last one standing!' : '💦 Splashed out'}</h2>
      <div class="row" style="font-size:20px;font-weight:900">Place #${r.place} of ${r.total}</div>
      <div class="row">Knockouts: ${r.kos} · Hits: ${r.hits}${r.by ? ` · Knocked out by ${r.by}` : ''}</div>
      ${r.newBest ? `<div class="pb">★ NEW BEST STREAK: ${r.bestStreak} ★</div>` : `<div class="row">Win streak: ${r.streak} · Best: ${r.bestStreak}</div>`}
      ${r.rewards.map(m => `<div class="row" style="color:#e07a10">+${m.bb} BB · ${m.label}</div>`).join('')}
      <button class="go" data-retry>Rematch ↻</button><div class="row" data-auto style="opacity:.6;font-size:11px">Space / R · auto-rematch in 8</div>`;
    e.classList.add('show'); e.querySelector('[data-retry]').onclick = onRetry;
  }
  endCountdown(n) { const a = this.root.querySelector('[data-auto]'); if (a) a.textContent = `Space / R · auto-rematch in ${n}`; }
  hideEnd() { this.$('e').classList.remove('show'); }
  dispose() { clearTimeout(this._bt); this.root.remove(); this.style.remove(); }
}
