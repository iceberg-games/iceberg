// Snowball Siege HUD: built once; per-frame updates only touch textContent/style (mobile-safe, no innerHTML wipes).
import { EMOTES, TEAMS, HP, AMMO } from './config.js';
const CSS = `
.sbs{position:absolute;inset:0;pointer-events:none;z-index:12;color:#eaf6ff;font-family:inherit}
.sbs button{pointer-events:auto;font-family:inherit;cursor:pointer;touch-action:none;-webkit-tap-highlight-color:transparent;user-select:none}
.sbs-top{position:absolute;top:62px;left:50%;transform:translateX(-50%);display:flex;gap:10px;align-items:center;background:linear-gradient(180deg,#fff,#dff3ff);color:#1d4f7a;border:4px solid #fff;border-radius:22px;padding:6px 14px 8px;box-shadow:0 6px 0 #9cc9ea,0 14px 30px rgba(10,30,70,.3)}
.sbs-fort{width:120px}.sbs-fort small{display:block;font-size:10px;font-weight:900;letter-spacing:2px}
.sbs-bar{height:12px;border-radius:8px;background:#cfe3f2;overflow:hidden;box-shadow:inset 0 2px 0 rgba(0,0,0,.12)}
.sbs-bar i{display:block;height:100%;transition:width .25s}
.sbs-mid{text-align:center;min-width:76px}.sbs-mid b{font-size:22px;font-weight:900;display:block}
.sbs-cap{height:8px;border-radius:6px;background:#cfe3f2;position:relative;overflow:hidden;margin-top:2px}
.sbs-cap i{position:absolute;top:0;bottom:0;transition:width .15s}
.sbs-low{color:#e0405a;animation:sbsp .5s infinite alternate}
.sbs-me{position:absolute;left:72px;bottom:16px;background:rgba(10,24,52,.7);border:3px solid rgba(255,255,255,.7);border-radius:16px;padding:8px 12px;font-weight:900;font-size:18px;display:flex;gap:14px;align-items:center}
.sbs-me span{letter-spacing:2px}
.sbs-feed{position:absolute;top:140px;left:14px;display:flex;flex-direction:column;gap:4px;font-size:14px;font-weight:800}
.sbs-feed div{background:rgba(10,24,52,.72);border-radius:10px;padding:4px 10px;animation:sbsslide .25s ease-out;transition:opacity .5s}
.sbs-score{position:absolute;top:62px;right:14px;background:rgba(10,24,52,.7);border:3px solid rgba(255,255,255,.7);border-radius:16px;padding:6px 10px;font-size:13px;font-weight:800;min-width:110px}
.sbs-score div{display:flex;justify-content:space-between;gap:8px}
.sbs-banner{position:absolute;top:32%;left:50%;transform:translate(-50%,-50%) scale(.7);opacity:0;font-size:46px;font-weight:900;text-align:center;transition:all .2s;text-shadow:0 0 22px #6cf,0 4px 0 #123;white-space:nowrap}
.sbs-banner.show{opacity:1;transform:translate(-50%,-50%) scale(1)}
.sbs-banner small{display:block;font-size:20px;color:#ffe680}
.sbs-x{position:absolute;left:50%;top:46%;width:26px;height:26px;transform:translate(-50%,-50%);border:3px solid rgba(255,255,255,.85);border-radius:50%;box-shadow:0 0 8px #6cf;transition:all .1s}
.sbs-x.lock{border-color:#ff6b9a;box-shadow:0 0 12px #ff6b9a;width:34px;height:34px}
.sbs-charge{position:absolute;left:50%;top:calc(46% + 26px);width:90px;height:8px;transform:translateX(-50%);background:rgba(0,0,0,.4);border-radius:4px;overflow:hidden;opacity:0;transition:opacity .15s}
.sbs-charge i{display:block;height:100%;width:0;background:linear-gradient(90deg,#9ff,#ffd24a,#ff5d73)}
.sbs-flash{position:absolute;inset:0;background:radial-gradient(circle,rgba(255,255,255,0) 45%,rgba(200,235,255,.75));opacity:0;transition:opacity .4s}
.sbs-flash.on{opacity:1;transition:none}
.sbs-down{position:absolute;inset:0;display:none;align-items:center;justify-content:center;flex-direction:column;background:rgba(220,240,255,.45);backdrop-filter:blur(3px);font-size:40px;font-weight:900;color:#1d4f7a;text-shadow:0 2px 0 #fff}
.sbs-down.show{display:flex}.sbs-down small{font-size:18px}
.sbs-end{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);background:linear-gradient(180deg,#fff,#dff3ff);color:#1d4f7a;border:5px solid #fff;border-radius:26px;box-shadow:0 8px 0 #9cc9ea,0 20px 50px rgba(0,0,0,.4);padding:20px 30px;text-align:center;min-width:300px;display:none;pointer-events:auto}
.sbs-end.show{display:block;animation:sbsin .3s ease-out}
.sbs-end h2{margin:0 0 4px;font-size:30px}.sbs-end .row{font-size:14px;margin:3px 0}
.sbs-end .go{margin-top:12px;border:0;border-radius:14px;padding:14px 30px;font-size:20px;font-weight:900;color:#5a2a00;background:linear-gradient(180deg,#ffd77a,#ff9a2e);box-shadow:0 6px 0 #c0641a}
.sbs-emotes{position:absolute;bottom:90px;left:14px;display:flex;flex-direction:column;gap:8px}
.sbs-emotes button{border:3px solid #fff;background:rgba(255,255,255,.88);border-radius:50%;width:46px;height:46px;font-size:22px;box-shadow:0 4px 0 #9cc9ea}
.sbs-pad{position:absolute;right:22px;bottom:190px;display:flex;flex-direction:column;align-items:flex-end;gap:12px;z-index:95}
.sbs-throw{width:104px;height:104px;border-radius:50%;border:5px solid #fff;font-size:15px;font-weight:900;color:#1d4f7a;background:radial-gradient(circle at 35% 30%,#fff,#bfe6ff);box-shadow:0 6px 0 #7fb3dd,0 10px 24px rgba(0,0,0,.35)}
.sbs-throw.hot{background:radial-gradient(circle at 35% 30%,#fff,#ffd24a)}
.sbs-reload{width:68px;height:68px;border-radius:50%;border:4px solid #fff;font-size:12px;font-weight:900;color:#1d4f7a;background:radial-gradient(circle at 35% 30%,#fff,#d8f0ff);box-shadow:0 5px 0 #7fb3dd}
.sbs-throw:active,.sbs-reload:active{transform:scale(.93)}
.sbs-help{position:absolute;top:150px;left:50%;transform:translateX(-50%);font-size:12px;opacity:.85;text-shadow:0 0 6px #000;white-space:nowrap}
@keyframes sbsp{to{transform:scale(1.12)}}@keyframes sbsin{from{transform:translate(-50%,-50%) scale(.6);opacity:0}}@keyframes sbsslide{from{transform:translateX(-30px);opacity:0}}
`;
export class SiegeUI {
  constructor(mobile, { onEmote, onThrowDown, onThrowUp, onReload }) {
    this.style = document.createElement('style'); this.style.textContent = CSS; document.head.appendChild(this.style);
    const r = this.root = document.createElement('div'); r.className = 'sbs';
    const fort = (i) => `<div class="sbs-fort"><small style="color:${TEAMS[i].dark}">${i ? '🍓' : '❄'} ${TEAMS[i].name.toUpperCase()} FORT</small><div class="sbs-bar"><i data-f${i} style="width:100%;background:${TEAMS[i].color}"></i></div></div>`;
    r.innerHTML = `<div class="sbs-top">${fort(0)}<div class="sbs-mid"><small style="font-size:10px;letter-spacing:2px;font-weight:900">TIME</small><b data-t>3:00</b><div class="sbs-cap"><i data-c0 style="left:0;background:${TEAMS[0].color}"></i><i data-c1 style="right:0;background:${TEAMS[1].color}"></i></div></div>${fort(1)}</div>
      <div class="sbs-score"><div><span>❄ Frost tags</span><b data-s0>0</b></div><div><span>🍓 Berry tags</span><b data-s1>0</b></div><div style="opacity:.8"><span>Your tags</span><b data-st>0</b></div></div>
      <div class="sbs-feed" data-fd></div>
      <div class="sbs-x" data-x></div><div class="sbs-charge" data-cg><i></i></div>
      <div class="sbs-me"><span data-hp></span><span data-am></span></div>
      <div class="sbs-flash" data-fl></div><div class="sbs-banner" data-b></div>
      <div class="sbs-down" data-dn><div>☃ SNOWED IN!</div><small data-dt>back in 3…</small></div>
      <div class="sbs-end" data-e></div>
      <div class="sbs-emotes">${EMOTES.map((e, i) => `<button data-em="${i}">${e}</button>`).join('')}</div>
      ${mobile ? '<div class="sbs-pad"><button class="sbs-reload" data-rl>🔄<br>RELOAD</button><button class="sbs-throw" data-th>❄<br>THROW</button></div>' : ''}
      <div class="sbs-help">${mobile ? 'Joystick move · Jump · hold THROW to charge · bonk the enemy fort or hold the middle ring' : 'WASD move · Space jump · Click / E throw (hold = charge) · Q reload · 1-4 emote'}</div>`;
    document.body.appendChild(r);
    const q = (k) => r.querySelector(`[data-${k}]`);
    this.el = { t: q('t'), f0: q('f0'), f1: q('f1'), c0: q('c0'), c1: q('c1'), s0: q('s0'), s1: q('s1'), st: q('st'), x: q('x'), cg: q('cg'), hp: q('hp'), am: q('am'), fl: q('fl'), b: q('b'), dn: q('dn'), dt: q('dt'), e: q('e'), fd: q('fd'), th: q('th') };
    r.querySelectorAll('[data-em]').forEach(b => b.addEventListener('pointerdown', (e) => { e.stopPropagation(); onEmote(+b.dataset.em); }));
    const th = this.el.th;
    if (th) { th.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); th.setPointerCapture?.(e.pointerId); onThrowDown(); }); ['pointerup', 'pointercancel'].forEach(n => th.addEventListener(n, (e) => { e.stopPropagation(); onThrowUp(); })); }
    const rl = q('rl'); if (rl) rl.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); onReload(); });
    this._last = {};
  }
  set(k, v) { if (this._last[k] === v) return; this._last[k] = v; this.el[k].textContent = v; }
  style_(k, prop, v) { const key = k + prop; if (this._last[key] === v) return; this._last[key] = v; this.el[k].style[prop] = v; }
  hud(s) {
    const t = Math.max(0, Math.ceil(s.time)); this.set('t', `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`);
    const low = t <= 15; if (this._last.low !== low) { this._last.low = low; this.el.t.classList.toggle('sbs-low', low); }
    this.style_('f0', 'width', `${Math.round(s.fort[0])}%`); this.style_('f1', 'width', `${Math.round(s.fort[1])}%`);
    this.style_('c0', 'width', `${Math.round(s.cap[0] * 50)}%`); this.style_('c1', 'width', `${Math.round(s.cap[1] * 50)}%`);
    this.set('s0', String(s.tags[0])); this.set('s1', String(s.tags[1])); this.set('st', String(s.myTags));
    this.set('hp', '❤'.repeat(Math.max(0, s.hp)) + '♡'.repeat(Math.max(0, HP - s.hp)));
    this.set('am', s.reloading ? 'RELOADING…' : '⚪'.repeat(s.ammo) + '·'.repeat(AMMO - s.ammo));
    const lock = !!s.lock; if (this._last.lock !== lock) { this._last.lock = lock; this.el.x.classList.toggle('lock', lock); }
    this.style_('cg', 'opacity', s.charge > 0 ? '1' : '0'); const w = `${Math.round(s.charge * 100)}%`; if (this._last.cw !== w) { this._last.cw = w; this.el.cg.firstChild.style.width = w; }
    if (this.el.th) { const hot = s.charge >= 1; if (this._last.hot !== hot) { this._last.hot = hot; this.el.th.classList.toggle('hot', hot); } }
    const down = s.down > 0; if (this._last.down !== down) { this._last.down = down; this.el.dn.classList.toggle('show', down); }
    if (down) this.set('dt', `back in ${Math.ceil(s.down)}…`);
  }
  feed(html) {
    const f = this.el.fd, d = document.createElement('div'); d.innerHTML = html; f.prepend(d);
    while (f.children.length > 5) f.lastChild.remove();
    setTimeout(() => { d.style.opacity = 0; setTimeout(() => d.remove(), 500); }, 3500);
  }
  banner(text, sub = '', ms = 1200) {
    const b = this.el.b; b.innerHTML = `${text}${sub ? `<small>${sub}</small>` : ''}`; b.classList.add('show');
    clearTimeout(this._bt); this._bt = setTimeout(() => b.classList.remove('show'), ms);
  }
  flash() { const f = this.el.fl; f.classList.add('on'); requestAnimationFrame(() => requestAnimationFrame(() => f.classList.remove('on'))); }
  showEnd(r, onRetry) {
    const e = this.el.e;
    e.innerHTML = `<h2>${r.won ? '🏆 Siege won!' : r.draw ? '🤝 Snow-stalemate!' : '☃ Siege lost'}</h2>
      <div class="row" style="font-size:16px;font-weight:900">${r.how}</div>
      <div class="row">Your tags: ${r.myTags} · Fort bonks: ${r.bonks} · Snowed in: ${r.downs}</div>
      <div class="row">Win streak: ${r.streak} · Best: ${r.bestStreak}</div>
      ${r.rewards.map(m => `<div class="row" style="color:#e07a10;font-weight:900">+${m.bb} BB · ${m.label}</div>`).join('')}
      <button class="go" data-retry>Play again ↻</button><div class="row" data-auto style="opacity:.6;font-size:11px">Space · next siege in 10</div>`;
    e.classList.add('show'); const b = e.querySelector('[data-retry]'); b.addEventListener('pointerdown', (ev) => { ev.stopPropagation(); onRetry(); });
  }
  endCountdown(n) { const a = this.el.e.querySelector('[data-auto]'); if (a) a.textContent = `Space · next siege in ${n}`; }
  hideEnd() { this.el.e.classList.remove('show'); }
  dispose() { clearTimeout(this._bt); this.root.remove(); this.style.remove(); }
}
