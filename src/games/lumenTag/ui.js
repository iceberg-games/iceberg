// Lumen Tag HUD (DOM overlay; styles injected/removed with the game).
import * as C from './config.js';
const CSS = `
.lmt{position:absolute;inset:0;pointer-events:none;z-index:12;color:#f0ecff;font-family:inherit}
.lmt button{pointer-events:auto;font-family:inherit;cursor:pointer;touch-action:none;-webkit-tap-highlight-color:transparent;user-select:none}
.lmt-top{position:absolute;top:66px;left:50%;transform:translateX(-50%);display:flex;gap:10px;align-items:center;background:rgba(14,8,40,.78);border:2px solid rgba(160,230,255,.7);border-radius:20px;padding:6px 14px 8px;box-shadow:0 0 18px rgba(120,220,255,.45),inset 0 0 14px rgba(180,120,255,.3)}
.lmt-top>div{text-align:center;font-weight:900;font-size:22px;min-width:56px;text-shadow:0 0 10px #7af2ff}
.lmt-top small{display:block;font-size:10px;letter-spacing:2px;opacity:.7;text-shadow:none}
.lmt-low{color:#ff6b9a;animation:lmtp .5s infinite alternate}
.lmt-board{position:absolute;top:66px;right:14px;background:rgba(14,8,40,.75);border:2px solid rgba(190,140,255,.6);border-radius:14px;padding:8px 10px;width:190px;font-size:13px;font-weight:800}
.lmt-board h4{margin:0 0 5px;font-size:11px;letter-spacing:2px;opacity:.75}
.lmt-row{position:relative;display:flex;gap:6px;align-items:center;padding:3px 6px;margin:2px 0;border-radius:8px;overflow:hidden}
.lmt-row .bar{position:absolute;left:0;top:0;bottom:0;opacity:.28;transition:width .25s}
.lmt-row span,.lmt-row b{position:relative}.lmt-row b{margin-left:auto}
.lmt-row.me{outline:2px solid #4fd8ff}.lmt-row.dead{opacity:.45}
.lmt-feed{position:absolute;top:150px;left:14px;display:flex;flex-direction:column;gap:4px;font-size:14px;font-weight:800}
.lmt-feed div{background:rgba(14,8,40,.78);border-radius:10px;padding:4px 10px;transition:opacity .5s;animation:lmtsl .25s ease-out}
.lmt-banner{position:absolute;top:32%;left:50%;transform:translate(-50%,-50%) scale(.7);opacity:0;font-size:48px;font-weight:900;text-align:center;transition:all .2s;text-shadow:0 0 24px #b06cff,0 0 8px #7af2ff,0 4px 0 #120828;white-space:nowrap}
.lmt-banner.show{opacity:1;transform:translate(-50%,-50%) scale(1)}
.lmt-banner small{display:block;font-size:19px;color:#ffe680}
.lmt-x{position:absolute;left:50%;top:46%;width:30px;height:30px;transform:translate(-50%,-50%)}
.lmt-x:before,.lmt-x:after{content:'';position:absolute;background:#bff6ff;box-shadow:0 0 6px #4fd8ff}
.lmt-x:before{left:14px;top:0;width:2px;height:30px}.lmt-x:after{top:14px;left:0;height:2px;width:30px}
.lmt-x.lock:before,.lmt-x.lock:after{background:#ff6b9a;box-shadow:0 0 10px #ff4f8b}
.lmt-x.lock{animation:lmtspin .6s linear infinite}
.lmt-hm{position:absolute;left:50%;top:46%;width:44px;height:44px;transform:translate(-50%,-50%) rotate(45deg);border:3px solid #fff;border-radius:6px;opacity:0;box-shadow:0 0 14px #fff}
.lmt-hm.on{animation:lmthm .35s ease-out}
.lmt-pw{position:absolute;left:50%;bottom:120px;transform:translateX(-50%);font-weight:900;font-size:16px;padding:6px 14px;border-radius:14px;background:rgba(14,8,40,.8);border:2px solid currentColor;box-shadow:0 0 14px currentColor;display:none}
.lmt-pw i{display:block;height:4px;margin-top:4px;background:currentColor;border-radius:2px}
.lmt-flash{position:absolute;inset:0;background:radial-gradient(circle,rgba(255,80,140,0) 45%,rgba(255,60,140,.5));opacity:0;transition:opacity .4s}
.lmt-flash.on{opacity:1;transition:none}
.lmt-dead{position:absolute;inset:0;display:none;align-items:center;justify-content:center;flex-direction:column;background:radial-gradient(circle,rgba(30,10,60,.25),rgba(10,0,30,.7));font-weight:900;font-size:34px;text-shadow:0 0 18px #ff4f8b}
.lmt-dead.show{display:flex}.lmt-dead small{font-size:16px;color:#bff6ff;margin-top:6px}
.lmt-end{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);background:linear-gradient(180deg,rgba(30,18,80,.96),rgba(12,6,36,.96));border:3px solid #9fe8ff;border-radius:24px;box-shadow:0 0 40px rgba(140,200,255,.5);padding:20px 30px;text-align:center;min-width:320px;display:none;pointer-events:auto}
.lmt-end.show{display:block;animation:lmtin .3s ease-out}
.lmt-end h2{margin:0 0 4px;font-size:30px;text-shadow:0 0 16px #b06cff}
.lmt-end .row{font-size:14px;margin:3px 0}
.lmt-end .pb{color:#ffe14f;font-weight:900;font-size:18px;text-shadow:0 0 10px #ffb238}
.lmt-end .go{margin-top:12px;border:0;border-radius:14px;padding:12px 26px;font-size:18px;font-weight:900;color:#1a0838;background:linear-gradient(180deg,#9ff6ff,#c08bff);box-shadow:0 0 18px #9ff6ff}
.lmt-fire{position:absolute;right:24px;bottom:190px;width:108px;height:108px;border-radius:50%;border:4px solid #bff6ff;font-size:16px;font-weight:900;color:#fff;background:radial-gradient(circle at 40% 35%,#7af2ff,#6a3cff 70%,#2a0f6a);box-shadow:0 0 24px #4fd8ff,0 6px 0 #2a0f6a;text-shadow:0 0 8px #000}
.lmt-fire.on{transform:scale(.92);box-shadow:0 0 40px #fff}
.lmt-help{position:absolute;top:128px;left:50%;transform:translateX(-50%);font-size:12px;opacity:.8;text-shadow:0 0 6px #000;white-space:nowrap}
@keyframes lmtp{to{transform:scale(1.12)}}
@keyframes lmtin{from{transform:translate(-50%,-50%) scale(.6);opacity:0}}
@keyframes lmtsl{from{transform:translateX(-30px);opacity:0}}
@keyframes lmtspin{to{transform:translate(-50%,-50%) rotate(90deg)}}
@keyframes lmthm{0%{opacity:1;width:24px;height:24px}100%{opacity:0;width:60px;height:60px}}
`;
export class LumenUI {
  constructor(mobile, { onFireDown, onFireUp }) {
    this.style = document.createElement('style'); this.style.textContent = CSS; document.head.appendChild(this.style);
    const r = this.root = document.createElement('div'); r.className = 'lmt';
    r.innerHTML = `<div class="lmt-top"><div><small>TAGS</small><span data-k>0</span></div><div><small>TIME</small><span data-t>90</span></div><div><small>PLACE</small><span data-p>-</span></div><div><small>FIRST TO</small><span>${C.TAGS_TO_WIN}</span></div></div>
      <div class="lmt-board" data-bd></div><div class="lmt-feed" data-fd></div>
      <div class="lmt-x" data-x></div><div class="lmt-hm" data-hm></div><div class="lmt-pw" data-pw></div>
      <div class="lmt-flash" data-f></div><div class="lmt-dead" data-dd></div><div class="lmt-banner" data-b></div><div class="lmt-end" data-e></div>
      ${mobile ? '<button class="lmt-fire" data-fi>✦<br>FIRE</button>' : ''}
      <div class="lmt-help">${mobile ? 'Joystick move · Jump hop · hold FIRE (auto-aim) · drag to look' : 'WASD move · Space hop · Click / hold to fire (or F) · drag to aim · R restart'}</div>`;
    document.body.appendChild(r);
    this.$ = (k) => r.querySelector(`[data-${k}]`);
    const fi = this.$('fi');
    if (fi) { fi.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); fi.classList.add('on'); onFireDown(); });
      ['pointerup', 'pointercancel', 'pointerleave'].forEach(n => fi.addEventListener(n, (e) => { e.stopPropagation(); fi.classList.remove('on'); onFireUp(); })); }
  }
  hud({ tags, time, place, lock, board, power, powerK, deadT, deadBy }) {
    this.set('k', tags); const t = Math.ceil(Math.max(0, time)); this.set('t', t); this.$('t').classList.toggle('lmt-low', t <= 10); this.set('p', place);
    this.$('x').classList.toggle('lock', !!lock);
    const pw = this.$('pw');
    if (power) { const P = C.POWERS[power]; pw.style.display = 'block'; pw.style.color = P.color; const h = `${P.icon} ${P.label} · ${P.sub}<i style="width:${Math.round(powerK * 100)}%"></i>`; if (h !== this._pw) { pw.innerHTML = h; this._pw = h; } }
    else if (pw.style.display !== 'none') { pw.style.display = 'none'; this._pw = ''; }
    const dd = this.$('dd'); dd.classList.toggle('show', deadT > 0);
    if (deadT > 0) { const h = `✦ TAGGED ✦<small>${deadBy ? `by ${deadBy} · ` : ''}back in ${deadT.toFixed(1)}s</small>`; if (h !== this._dd) { dd.innerHTML = h; this._dd = h; } }
    const html = '<h4>✦ RACE TO ' + C.TAGS_TO_WIN + '</h4>' + board.map((p, i) => `<div class="lmt-row ${p.me ? 'me' : ''} ${p.dead ? 'dead' : ''}"><i class="bar" style="width:${Math.min(100, p.score / C.TAGS_TO_WIN * 100)}%;background:${p.color}"></i><span style="color:${p.color}">${i === 0 && p.score > 0 ? '👑 ' : ''}${p.name}</span><b>${p.score}</b></div>`).join('');
    if (html !== this._bd) { this.$('bd').innerHTML = html; this._bd = html; }
  }
  set(k, v) { const e = this.$(k); if (e.textContent !== String(v)) e.textContent = v; }
  hitmark() { const h = this.$('hm'); h.classList.remove('on'); void h.offsetWidth; h.classList.add('on'); }
  feed(text) { const f = this.$('fd'), d = document.createElement('div'); d.innerHTML = text; f.prepend(d); while (f.children.length > 5) f.lastChild.remove(); setTimeout(() => { d.style.opacity = 0; setTimeout(() => d.remove(), 500); }, 3500); }
  banner(text, sub = '', ms = 1200) { const b = this.$('b'); b.innerHTML = `${text}${sub ? `<small>${sub}</small>` : ''}`; b.classList.add('show'); clearTimeout(this._bt); this._bt = setTimeout(() => b.classList.remove('show'), ms); }
  flash() { const f = this.$('f'); f.classList.add('on'); requestAnimationFrame(() => requestAnimationFrame(() => f.classList.remove('on'))); }
  showEnd(r, onRetry) {
    const e = this.$('e');
    e.innerHTML = `<h2>${r.won ? '🏆 Brightest in the cavern!' : r.place <= 3 ? '✦ Podium finish!' : '💫 Outshone this time'}</h2>
      <div class="row" style="font-size:20px;font-weight:900">Place #${r.place} of ${r.total}</div>
      <div class="row">Tags: ${r.tags} · Tagged: ${r.deaths} · Best streak: ${r.streakBest}${r.winner && !r.won ? ` · Winner: ${r.winner}` : ''}</div>
      ${r.newBest ? `<div class="pb">★ NEW PERSONAL BEST: ${r.tags} tags ★</div>` : `<div class="row">Personal best: ${r.bestTags} tags</div>`}
      ${r.rewards.map(m => `<div class="row" style="color:#ffe14f">+${m.bb} BB · ${m.label}</div>`).join('')}
      <button class="go" data-retry>Play again ↻</button><div class="row" data-auto style="opacity:.6;font-size:11px">Space / R · next round in 8</div>`;
    e.classList.add('show'); e.querySelector('[data-retry]').onclick = onRetry;
  }
  endCountdown(n) { const a = this.root.querySelector('[data-auto]'); if (a) a.textContent = `Space / R · next round in ${n}`; }
  hideEnd() { this.$('e').classList.remove('show'); }
  dispose() { clearTimeout(this._bt); this.root.remove(); this.style.remove(); }
}
