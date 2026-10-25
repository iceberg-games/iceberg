// Starfall Lake HUD (DOM overlay, styles injected/removed with the game).
const CSS = `
.sfl-root{position:absolute;inset:0;pointer-events:none;z-index:12;font-family:inherit;color:#eaf6ff}
.sfl-top{position:absolute;top:66px;left:50%;transform:translateX(-50%);display:flex;gap:16px;align-items:center;background:linear-gradient(180deg,#ffffff,#dff3ff);color:#1d4f7a;border:4px solid #fff;border-radius:22px;padding:8px 20px 10px;box-shadow:0 6px 0 #9cc9ea,0 14px 30px rgba(10,30,70,.35),inset 0 -4px 0 rgba(120,180,230,.25)}
.sfl-top>div{background:#eef8ff;border-radius:14px;padding:4px 10px;box-shadow:inset 0 2px 0 rgba(120,170,220,.25)}
.sfl-lamp{font-size:22px;filter:drop-shadow(0 0 8px #ffb347)}
.sfl-pop{animation:sflpop .28s ease-out}
@keyframes sflpop{0%{transform:scale(1)}40%{transform:scale(1.35)}100%{transform:scale(1)}}
.sfl-score{font-size:28px;font-weight:900;min-width:110px;text-align:center;color:#1a5a92;text-shadow:0 2px 0 #fff,0 0 10px rgba(120,220,255,.6);display:inline-block}
.sfl-score small,.sfl-time small{display:block;font-size:10px;letter-spacing:2px;opacity:.7;font-weight:800}
.sfl-time{font-size:22px;font-weight:900;min-width:54px;text-align:center}
.sfl-time.low{color:#ff9fb0;animation:sflp .5s infinite alternate}
.sfl-combo{min-width:120px}
.sfl-combo b{font-size:24px;font-weight:900;color:#ff9a2e;text-shadow:0 2px 0 #fff3d6,0 0 10px rgba(255,170,60,.5);display:inline-block}
.sfl-bar{height:6px;border-radius:4px;background:#cfe6f7;overflow:hidden;margin-top:3px}
.sfl-bar i{display:block;height:100%;width:0;background:linear-gradient(90deg,#ffcf6a,#ff9a2e);box-shadow:0 0 8px #ffb347}
.sfl-con{position:absolute;top:142px;left:50%;transform:translateX(-50%);background:rgba(255,255,255,.88);color:#1d4f7a;border-radius:14px;padding:5px 14px 7px;box-shadow:0 4px 0 #9cc9ea;font-size:13px;font-weight:800;letter-spacing:1px;text-align:center;text-shadow:0 0 8px #000}
.sfl-dots{display:flex;gap:6px;justify-content:center;margin-top:4px}
.sfl-dots i{width:12px;height:12px;border-radius:50%;border:3px solid #9cc9ea;background:#fff}
.sfl-dots i.on{background:#fff6b0;border-color:#fff6b0;box-shadow:0 0 10px #ffe680}
.sfl-banner{position:absolute;top:36%;left:50%;transform:translate(-50%,-50%) scale(.8);opacity:0;font-size:44px;font-weight:900;text-align:center;transition:all .25s;text-shadow:0 0 22px #6ff,0 3px 0 #123;white-space:nowrap}
.sfl-banner.show{opacity:1;transform:translate(-50%,-50%) scale(1)}
.sfl-banner small{display:block;font-size:20px;color:#ffe680}
.sfl-flash{position:absolute;inset:0;background:radial-gradient(circle,rgba(200,255,240,.35),rgba(120,140,255,0) 70%);opacity:0;transition:opacity .5s}
.sfl-flash.on{opacity:1;transition:none}
.sfl-end{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);background:linear-gradient(180deg,#ffffff,#dff3ff);color:#1d4f7a;border:5px solid #fff;border-radius:26px;box-shadow:0 8px 0 #9cc9ea,0 20px 50px rgba(0,0,0,.4);padding:22px 30px;text-align:center;min-width:300px;display:none;pointer-events:auto}
.sfl-end.show{display:block}
.sfl-end h2{margin:0 0 6px;font-size:26px}
.sfl-end .big{font-size:46px;font-weight:900;text-shadow:0 0 18px #7ff}
.sfl-end .row{font-size:14px;opacity:.9;margin:3px 0}
.sfl-end .pb{color:#e07a10;font-weight:900;font-size:18px;margin:6px 0}
.sfl-end button{margin-top:14px;border:0;border-radius:14px;padding:12px 26px;font-size:18px;font-weight:900;color:#5a2a00;background:linear-gradient(180deg,#ffd77a,#ff9a2e);box-shadow:0 6px 0 #c0641a,0 10px 20px rgba(0,0,0,.25);cursor:pointer;font-family:inherit}
.sfl-help{position:absolute;bottom:96px;left:50%;transform:translateX(-50%);font-size:12px;opacity:.75;text-shadow:0 0 6px #000}
@keyframes sflp{to{transform:scale(1.12)}}
`;
export class StarfallUI {
  constructor(parent = document.body) {
    this.style = document.createElement('style'); this.style.textContent = CSS; document.head.appendChild(this.style);
    const r = this.root = document.createElement('div'); r.className = 'sfl-root';
    r.innerHTML = `<div class="sfl-top"><span class="sfl-lamp">🏮</span><div class="sfl-score"><small>SCORE</small><span data-s>0</span></div>
      <div class="sfl-combo"><b data-c>x1</b><div class="sfl-bar"><i data-cb></i></div></div>
      <div class="sfl-time"><small>TIME</small><span data-t>75</span></div></div>
      <div class="sfl-con"><span data-cn></span><div class="sfl-dots" data-d></div></div>
      <div class="sfl-flash" data-f></div><div class="sfl-banner" data-b></div>
      <div class="sfl-end" data-e></div>
      <div class="sfl-help">Skate under falling stars to catch them · chain catches for combo · R = restart</div>`;
    parent.appendChild(r);
    this.$ = (k) => r.querySelector(`[data-${k}]`);
  }
  hud({ score, time, combo, comboFrac, conName, conGot, conNeed }) {
    const se = this.$('s'); if (se.textContent !== score.toLocaleString()) { se.textContent = score.toLocaleString(); this.pop(se); }
    const te = this.$('t'); te.textContent = Math.ceil(Math.max(0, time)); te.parentElement.classList.toggle('low', time <= 10 && time > 0);
    const ce = this.$('c'); if (ce.textContent !== `x${combo}`) { ce.textContent = `x${combo}`; this.pop(ce); } this.$('cb').style.width = `${Math.round(comboFrac * 100)}%`;
    this.$('cn').textContent = conName ? `✦ ${conName}` : '';
    const d = this.$('d'); if (d.childElementCount !== conNeed) d.innerHTML = '<i></i>'.repeat(conNeed);
    [...d.children].forEach((el, i) => el.classList.toggle('on', i < conGot));
  }
  pop(el) { el.classList.remove('sfl-pop'); void el.offsetWidth; el.classList.add('sfl-pop'); }
  banner(text, sub = '', ms = 1300) {
    const b = this.$('b'); b.innerHTML = `${text}${sub ? `<small>${sub}</small>` : ''}`; b.classList.add('show');
    clearTimeout(this._bt); this._bt = setTimeout(() => b.classList.remove('show'), ms);
  }
  flash() { const f = this.$('f'); f.classList.add('on'); requestAnimationFrame(() => requestAnimationFrame(() => f.classList.remove('on'))); }
  showEnd(r, onRetry) {
    const e = this.$('e');
    e.innerHTML = `<h2>🌌 Night's end</h2><div class="big">${r.score.toLocaleString()}</div>
      ${r.newBest ? '<div class="pb">★ NEW PERSONAL BEST ★</div>' : `<div class="row">Best: ${r.best.toLocaleString()}</div>`}
      <div class="row">Stars caught: ${r.caught} · Missed: ${r.missed}</div>
      <div class="row">Constellations: ${r.cons} · Best combo: x${r.maxCombo}</div>
      ${r.rewards.map(m => `<div class="row" style="color:#e07a10">+${m.bb} BB · ${m.label}</div>`).join('')}
      <button data-retry>Skate again ↻</button><div class="row" style="opacity:.6;font-size:11px">or press R / Space</div>`;
    e.classList.add('show'); e.querySelector('[data-retry]').onclick = onRetry;
  }
  hideEnd() { this.$('e').classList.remove('show'); }
  dispose() { clearTimeout(this._bt); this.root.remove(); this.style.remove(); }
}
