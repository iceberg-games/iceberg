// Corner Bakery Rush HUD: status bar, order tickets, held items, action
// buttons (tappable on mobile), day intro/result cards, pause screen.
// Styles are injected and removed with the game (no shared CSS is touched).
import { getDeviceMode, onDeviceChange } from '../../core/device.js';
import { ITEMS, DAYS, DAY_CLEAR_REWARD_BB, HANDS } from './config.js';

const CSS = `
.cbr{position:absolute;inset:0;pointer-events:none;z-index:12;font-family:inherit;color:#2b2118}
.cbr button{pointer-events:auto;font-family:inherit;cursor:pointer;touch-action:manipulation;-webkit-tap-highlight-color:transparent;user-select:none;-webkit-user-select:none}
.cbr-status{position:absolute;top:66px;left:50%;transform:translateX(-50%);display:flex;align-items:center;gap:12px;padding:7px 10px 7px 8px;border-radius:18px;
  background:linear-gradient(180deg,#fffaf0,#f7ead3);box-shadow:0 8px 24px rgba(60,35,10,.22),inset 0 0 0 2px #fff;white-space:nowrap}
.cbr-day{background:#2f5b55;color:#fbe7b4;font-weight:900;font-size:13px;border-radius:12px;padding:6px 10px;letter-spacing:.3px}
.cbr-clock{font:900 22px/1 ui-monospace,Menlo,monospace;color:#3a2a1a;min-width:62px;text-align:center}
.cbr-clock.low{color:#d6453b;animation:cbr-pulse .6s infinite alternate}
@keyframes cbr-pulse{to{transform:scale(1.12)}}
.cbr-score{display:flex;flex-direction:column;gap:3px;min-width:170px}
.cbr-score b{font-size:15px;font-weight:900}
.cbr-bar{position:relative;height:10px;border-radius:6px;background:#eadcc2;overflow:visible}
.cbr-bar>i{position:absolute;left:0;top:0;bottom:0;border-radius:6px;background:linear-gradient(90deg,#f6b93b,#f39c12);width:0;transition:width .35s}
.cbr-bar>s{position:absolute;top:-5px;width:16px;height:16px;margin-left:-8px;text-decoration:none;font-size:14px;line-height:16px;text-align:center;filter:grayscale(1) opacity(.45)}
.cbr-bar>s.on{filter:none;animation:cbr-pop .35s}
@keyframes cbr-pop{50%{transform:scale(1.6)}}
.cbr-hearts{font-size:17px;letter-spacing:1px}
.cbr-hearts .off{filter:grayscale(1) opacity(.3)}
.cbr-pause{border:0;background:#fff;border-radius:10px;width:34px;height:34px;font-size:15px;box-shadow:0 2px 0 #e2d2b4}
.cbr-tickets{position:absolute;top:122px;left:50%;transform:translateX(-50%);display:flex;gap:8px}
.cbr-ticket{background:#fff;border-radius:12px;padding:5px 6px 7px;box-shadow:0 6px 16px rgba(60,35,10,.2);display:flex;flex-direction:column;align-items:center;gap:4px;min-width:62px;border-top:5px solid #2f5b55;transition:transform .2s}
.cbr-ticket.cake{border-top-color:#e05b9b}
.cbr-ticket.urgent{animation:cbr-shake .4s infinite}
@keyframes cbr-shake{25%{transform:rotate(-2deg)}75%{transform:rotate(2deg)}}
.cbr-ticket .its{display:flex;gap:2px}
.cbr-ticket img{width:38px;height:38px}
.cbr-ticket .it{position:relative}
.cbr-ticket .it.got img{opacity:.3}
.cbr-ticket .it.got::after{content:'✔';position:absolute;inset:0;display:grid;place-items:center;color:#2fb35a;font-weight:900;font-size:22px}
.cbr-ticket .lbl{position:absolute;bottom:-3px;left:0;right:0;text-align:center;font-size:8px;font-weight:900;color:#6b4a1e}
.cbr-ticket .pt{width:100%;height:6px;border-radius:4px;background:#eee;overflow:hidden}
.cbr-ticket .pt>i{display:block;height:100%;background:#3ccf6e}
.cbr-ticket .num{font-size:10px;font-weight:900;color:#8a7356}
.cbr-act{position:absolute;right:16px;bottom:100px;width:300px;background:rgba(255,250,240,.96);border-radius:18px;padding:10px 12px 12px;box-shadow:0 10px 30px rgba(60,35,10,.25),inset 0 0 0 2px #fff}
.cbr-hands{display:flex;align-items:center;gap:6px;margin-bottom:8px;font-size:12px;font-weight:800;color:#7a6346}
.cbr-hand{width:44px;height:44px;border-radius:12px;background:#f1e5cf;display:grid;place-items:center;box-shadow:inset 0 0 0 2px #e6d4b3}
.cbr-hand img{width:40px;height:40px}
.cbr-hand.burnt{background:#4a3a32}
.cbr-tname{font-weight:900;font-size:15px;margin-bottom:6px;display:flex;justify-content:space-between;align-items:center;gap:6px}
.cbr-tname small{font-weight:700;color:#8a7356;font-size:12px}
.cbr-btns{display:flex;flex-direction:column;gap:6px}
.cbr-btn{display:flex;align-items:center;gap:8px;border:0;border-radius:12px;padding:8px 10px;font-weight:900;font-size:14px;color:#fff;text-align:left;
  background:linear-gradient(180deg,#e88a3c,#c96a22);box-shadow:0 4px 0 #9a4d14}
.cbr-btn:active{transform:translateY(3px);box-shadow:0 1px 0 #9a4d14}
.cbr-btn.off{background:linear-gradient(180deg,#cfc4b2,#b5a993);box-shadow:0 4px 0 #8f846f;color:#f8f3ea}
.cbr-btn kbd{background:rgba(255,255,255,.28);border-radius:6px;padding:1px 6px;font-size:12px;font-family:inherit}
.cbr-btn img{width:28px;height:28px;margin:-4px 0}
.cbr-hint{font-size:13px;font-weight:700;color:#7a6346}
.cbr-why{font-size:12px;font-weight:800;color:#c0392b;min-height:16px;margin-top:6px}
.cbr-card-wrap{position:absolute;inset:0;display:grid;place-items:center;pointer-events:none;background:rgba(40,25,10,.18)}
.cbr-card{pointer-events:auto;width:min(560px,calc(100vw - 24px));max-height:calc(100vh - 150px);overflow:auto;background:linear-gradient(180deg,#fffaf0,#f6e8cf);border-radius:24px;padding:18px 20px;box-shadow:0 18px 50px rgba(40,25,10,.35),inset 0 0 0 3px #fff;text-align:center}
.cbr-card h2{margin:2px 0 2px;font-size:28px;font-weight:900;color:#2f5b55}
.cbr-card .sub{margin:0 0 12px;color:#8a6a40;font-weight:800;letter-spacing:1.5px;font-size:12px;text-transform:uppercase}
.cbr-card p{margin:6px 0;font-size:14px;color:#5a4630}
.cbr-days{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:10px 0 12px}
.cbr-dayb{border:0;border-radius:14px;padding:10px 6px;background:#fff;box-shadow:inset 0 0 0 2px #ead9ba;font-weight:900;color:#3a2a1a}
.cbr-dayb.sel{box-shadow:inset 0 0 0 3px #e88a3c;background:#fff6e8}
.cbr-dayb.lock{opacity:.5}
.cbr-dayb small{display:block;font-size:11px;color:#8a7356;font-weight:800}
.cbr-dayb .st{display:block;font-size:15px;margin-top:3px}
.cbr-menu{display:flex;flex-wrap:wrap;justify-content:center;gap:6px;margin:6px 0 10px}
.cbr-menu span{display:flex;flex-direction:column;align-items:center;font-size:10px;font-weight:800;color:#6b4a1e;width:62px}
.cbr-menu img{width:46px;height:46px}
.cbr-how{text-align:left;font-size:13px;color:#5a4630;background:#fff;border-radius:14px;padding:8px 12px;margin:8px 0}
.cbr-how li{margin:3px 0}
.cbr-go{border:0;border-radius:16px;padding:13px 28px;font-weight:900;font-size:18px;color:#fff;background:linear-gradient(180deg,#58c96b,#2e9e45);box-shadow:0 5px 0 #1f7a32,0 10px 22px rgba(0,0,0,.2);margin:6px 4px}
.cbr-go.alt{background:linear-gradient(180deg,#6aa8d8,#3d7bb9);box-shadow:0 5px 0 #2a5a8a}
.cbr-go:active{transform:translateY(3px)}
.cbr-stars{font-size:46px;margin:4px 0;letter-spacing:6px}
.cbr-stars span{display:inline-block;filter:grayscale(1) opacity(.25);transform:scale(.6);transition:all .35s cubic-bezier(.3,1.6,.5,1)}
.cbr-stars span.on{filter:none;transform:scale(1)}
.cbr-res{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin:8px 0;font-size:14px}
.cbr-res div{background:#fff;border-radius:10px;padding:6px 8px;font-weight:800;color:#5a4630}
.cbr-res b{display:block;font-size:20px;color:#2b2118}
.cbr-reward{margin:8px auto;display:inline-block;background:linear-gradient(180deg,#bfe9ff,#7cc4ec);color:#0f3a5a;font-weight:900;border-radius:14px;padding:8px 14px;box-shadow:0 4px 0 #3f8fd0}
.cbr-reward.done{background:#efe5d3;color:#8a7356;box-shadow:none}
.cbr-trophy{font-size:64px;animation:cbr-pop 1s infinite alternate}
.cbr-banner{position:absolute;top:38%;left:50%;transform:translate(-50%,-50%) scale(.7);opacity:0;transition:all .35s cubic-bezier(.3,1.5,.5,1);font-size:54px;font-weight:900;color:#fff;
  text-shadow:0 4px 0 #9a4d14,0 0 30px rgba(255,200,120,.8);white-space:nowrap;text-align:center}
.cbr-banner small{display:block;font-size:18px;letter-spacing:3px}
.cbr-banner.show{opacity:1;transform:translate(-50%,-50%) scale(1)}
.cbr-float{position:absolute;font-weight:900;font-size:20px;color:#2e9e45;text-shadow:0 2px 0 #fff,0 0 8px #fff;transition:all 1.1s ease-out;pointer-events:none;white-space:nowrap}
.cbr-confetti{position:absolute;inset:0;overflow:hidden;pointer-events:none}
.cbr-confetti i{position:absolute;top:-20px;width:9px;height:14px;border-radius:2px;animation:cbr-fall linear forwards}
@keyframes cbr-fall{to{transform:translateY(110vh) rotate(720deg)}}
.cbr-cta{position:sticky;bottom:0;background:linear-gradient(rgba(246,232,207,0),#f6e8cf 24%);padding:8px 0 4px;margin:0 -4px}
.cbr.mobile .cbr-status{top:118px}
.cbr.mobile .cbr-tickets{top:164px}
.cbr.mobile .cbr-card-wrap{padding:118px 10px 168px;box-sizing:border-box}
.cbr.mobile .cbr-card{max-height:100%;padding:10px 12px 2px;border-radius:18px}
.cbr.mobile .cbr-card h2{font-size:20px}
.cbr.mobile .cbr-card .sub{margin-bottom:4px}
.cbr.mobile .cbr-card p{font-size:13px;margin:4px 0}
.cbr.mobile .cbr-days{margin:6px 0;gap:6px}
.cbr.mobile .cbr-dayb{padding:6px 3px;font-size:13px}
.cbr.mobile .cbr-menu{gap:2px;margin:2px 0 4px}
.cbr.mobile .cbr-menu img{width:34px;height:34px}
.cbr.mobile .cbr-menu span{width:50px;font-size:9px}
.cbr.mobile .cbr-how{font-size:12px;padding:6px 10px 6px 24px;margin:4px 0}
.cbr.mobile .cbr-go{font-size:16px;padding:11px 18px;margin:4px 2px}
.cbr.mobile .cbr-reward{margin:2px auto 4px;padding:6px 12px;font-size:13px}
.cbr.mobile .cbr-stars{font-size:34px;margin:0}
.cbr.mobile .cbr-trophy{font-size:44px}
.cbr.mobile .cbr-res{margin:4px 0}.cbr.mobile .cbr-res b{font-size:17px}
.cbr.mobile .cbr-act{width:auto;left:auto;right:10px;bottom:150px;background:none;box-shadow:none;padding:0}
.cbr.mobile .cbr-tname,.cbr.mobile .cbr-hint{display:none}
.cbr.mobile .cbr-hands{justify-content:flex-end;margin-bottom:6px}
.cbr.mobile .cbr-btns{align-items:flex-end}
.cbr.mobile .cbr-btn{font-size:15px;padding:12px 14px;min-height:54px;border-radius:16px}
.cbr.mobile .cbr-btn kbd{display:none}
.cbr.mobile .cbr-why{text-align:right;text-shadow:0 1px 0 #fff}
@media (max-width:700px){
 .cbr-status{top:60px;gap:6px;padding:5px 6px;max-width:calc(100vw - 16px)}
 .cbr-day{font-size:11px;padding:4px 6px}
 .cbr-day .nm{display:none}
 .cbr-clock{font-size:17px;min-width:46px}
 .cbr-score{min-width:96px}.cbr-score b{font-size:12px}
 .cbr-hearts{font-size:13px}
 .cbr-pause{width:28px;height:28px;font-size:12px}
 .cbr-tickets{top:104px;gap:4px;max-width:calc(100vw - 12px)}
 .cbr-ticket{min-width:0;padding:3px 4px 5px}
 .cbr-ticket img{width:26px;height:26px}
 .cbr-act{right:8px;bottom:150px;width:min(250px,60vw)}
 .cbr-btn{font-size:13px}
 .cbr-hand{width:38px;height:38px}.cbr-hand img{width:34px;height:34px}
 .cbr-card{padding:12px 12px;border-radius:18px;max-height:calc(100vh - 120px)}
 .cbr-card h2{font-size:22px}
 .cbr-how{font-size:12px}
 .cbr-banner{font-size:34px}
 .cbr-stars{font-size:36px}
}
`;

const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmtTime = (s) => { s = Math.max(0, Math.ceil(s)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const STAR = '⭐';

export class BakeryUI {
  constructor({ icons, onAction, onPause, onStartDay, onMenu }) {
    this.icons = icons; this.onAction = onAction;
    this.style = el('style'); this.style.textContent = CSS; document.head.append(this.style);
    this.root = el('div', 'cbr'); this.root.id = 'cbr-root';
    // status
    this.status = el('div', 'cbr-status');
    this.status.innerHTML = `<div class="cbr-day"><span class="dn"></span><span class="nm"></span></div><div class="cbr-clock">2:30</div>
      <div class="cbr-score"><b>0</b><div class="cbr-bar"><i></i><s>${STAR}</s><s>${STAR}</s><s>${STAR}</s></div></div>
      <div class="cbr-hearts"></div>`;
    this.pauseBtn = el('button', 'cbr-pause', '⏸'); this.pauseBtn.id = 'cbr-pause'; this.pauseBtn.title = 'Pause (P)';
    this.pauseBtn.onclick = (e) => { e.currentTarget.blur(); onPause(); };
    this.status.append(this.pauseBtn);
    this.tickets = el('div', 'cbr-tickets'); this.tickets.id = 'cbr-tickets';
    // action panel
    this.act = el('div', 'cbr-act'); this.act.id = 'cbr-actions';
    this.act.innerHTML = `<div class="cbr-hands"><span class="hl">Hands</span></div><div class="cbr-tname"></div><div class="cbr-btns"></div><div class="cbr-why"></div>`;
    this.handsEl = this.act.querySelector('.cbr-hands'); this.tnameEl = this.act.querySelector('.cbr-tname');
    this.btnsEl = this.act.querySelector('.cbr-btns'); this.whyEl = this.act.querySelector('.cbr-why');
    this.banner = el('div', 'cbr-banner');
    this.cardWrap = el('div', 'cbr-card-wrap'); this.cardWrap.style.display = 'none';
    this.confetti = el('div', 'cbr-confetti');
    this.root.append(this.confetti, this.status, this.tickets, this.act, this.banner, this.cardWrap);
    document.getElementById('app').append(this.root);
    this.onStartDay = onStartDay; this.onMenu = onMenu;
    const applyMode = () => { this.mobile = getDeviceMode() === 'mobile'; this.root.classList.toggle('mobile', this.mobile); this._actKey = ''; };
    applyMode(); this._offDev = onDeviceChange(applyMode);
    this._actKey = ''; this._ticketKey = ''; this._timers = [];
  }
  img(item, cls = '') { const u = this.icons[item]; return u ? `<img class="${cls}" src="${u}" alt="${esc(ITEMS[item]?.name || item)}" draggable="false">` : `<span style="font-size:26px">${ITEMS[item]?.icon || '?'}</span>`; }

  setStatus(shift) {
    const d = shift.day;
    this.status.querySelector('.dn').textContent = `Day ${d.n}`;
    this.status.querySelector('.nm').textContent = ` · ${d.name}`;
    const clk = this.status.querySelector('.cbr-clock'); clk.textContent = fmtTime(shift.left); clk.classList.toggle('low', shift.left <= 20 && !shift.closing);
    const max = d.stars[2] * 1.08;
    this.status.querySelector('.cbr-score b').textContent = `${shift.score} coins`;
    this.status.querySelector('.cbr-bar>i').style.width = `${Math.min(100, shift.score / max * 100)}%`;
    this.status.querySelectorAll('.cbr-bar>s').forEach((s, i) => { s.style.left = `${d.stars[i] / max * 100}%`; s.classList.toggle('on', shift.score >= d.stars[i]); });
    const h = 3 - shift.strikes;
    this.status.querySelector('.cbr-hearts').innerHTML = [0, 1, 2].map(i => `<span class="${i < h ? '' : 'off'}">❤️</span>`).join('');
  }
  setTickets(customers) {
    const list = customers.filter(c => c.phase === 'wait' || (c.phase === 'in' && c.p > 0.5)).sort((a, b) => a.slot - b.slot);
    const key = list.map(c => `${c.id}:${c.got.join('')}:${Math.ceil(c.patience / c.max * 20)}`).join('|');
    if (key === this._ticketKey) return; this._ticketKey = key;
    this.tickets.innerHTML = list.map(c => {
      const f = c.patience / c.max, col = f > 0.5 ? '#3ccf6e' : f > 0.25 ? '#f6b93b' : '#ef4b4b';
      const its = c.order.map((o, i) => `<span class="it ${c.got[i] ? 'got' : ''}">${this.img(o)}${o.startsWith('donut') ? `<span class="lbl">${o === 'donut' ? 'PLAIN' : o === 'donutChoc' ? 'CHOCO' : 'SPRINKLE'}</span>` : ''}</span>`).join('');
      return `<div class="cbr-ticket ${c.order.includes('cake') ? 'cake' : ''} ${f < 0.25 ? 'urgent' : ''}" data-cust="${c.id}"><span class="num">#${c.slot + 1}</span><div class="its">${its}</div><div class="pt"><i style="width:${f * 100}%;background:${col}"></i></div></div>`;
    }).join('');
  }
  /** target: { id, name, sub } | null; actions: from Shift.actions(). */
  setActions(hands, target, actions, keyHints = true) {
    const key = `${hands.join()}|${target?.id}|${target?.sub}|${actions.map(a => a.label + a.ok).join()}|${this.mobile}`;
    if (key === this._actKey) return; this._actKey = key;
    this.handsEl.innerHTML = `<span class="hl">${this.mobile ? '' : 'Hands'}</span>` + [...Array(HANDS)].map((_, i) => hands[i] ? `<span class="cbr-hand ${hands[i] === 'burnt' ? 'burnt' : ''}" title="${esc(ITEMS[hands[i]].name)}">${this.img(hands[i])}</span>` : '<span class="cbr-hand"></span>').join('');
    if (!target) {
      this.tnameEl.innerHTML = ''; this.btnsEl.innerHTML = `<div class="cbr-hint">${hands.length ? 'Walk to a customer at the counter to serve.' : 'Walk up to an oven, the fryer, the coffee machine or the pastry case.'}</div>`;
      this.whyEl.textContent = ''; return;
    }
    this.tnameEl.innerHTML = `<span>${esc(target.name)}</span><small>${esc(target.sub || '')}</small>`;
    this.btnsEl.innerHTML = '';
    actions.forEach((a, i) => {
      const b = el('button', 'cbr-btn' + (a.ok ? '' : ' off'));
      b.dataset.action = String(i); b.id = `cbr-act-${i}`;
      b.innerHTML = `${keyHints ? `<kbd>${i === 0 ? 'E' : i + 1}</kbd>` : ''}${a.item ? this.img(a.item) : ''}<span>${esc(a.label)}</span>`;
      b.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); this.onAction(i); });
      b.addEventListener('click', (e) => { e.preventDefault(); }); // handled on pointerdown (fast taps on mobile)
      this.btnsEl.append(b);
    });
    this.whyEl.textContent = '';
  }
  flashWhy(text) { this.whyEl.textContent = text || ''; clearTimeout(this._whyT); this._whyT = setTimeout(() => { this.whyEl.textContent = ''; }, 1800); }
  showHud(on) { for (const e of [this.status, this.tickets, this.act]) e.style.display = on ? '' : 'none'; }

  banner_(title, sub = '', ms = 1600) {
    this.banner.innerHTML = `${esc(title)}${sub ? `<small>${esc(sub)}</small>` : ''}`; this.banner.classList.add('show');
    clearTimeout(this._bT); this._bT = setTimeout(() => this.banner.classList.remove('show'), ms);
  }
  floatText(text, x, y, color = '#2e9e45') {
    const f = el('div', 'cbr-float', esc(text)); f.style.left = `${x}px`; f.style.top = `${y}px`; f.style.color = color; this.root.append(f);
    requestAnimationFrame(() => { f.style.transform = 'translateY(-60px)'; f.style.opacity = '0'; });
    this._timers.push(setTimeout(() => f.remove(), 1200));
  }
  confettiBurst(n = 80) {
    const cols = ['#ff5a7a', '#ffd23f', '#4dd0e1', '#7bd389', '#b28dff', '#ff9f43'];
    for (let i = 0; i < n; i++) { const c = el('i'); c.style.left = `${Math.random() * 100}%`; c.style.background = cols[i % cols.length]; c.style.animationDuration = `${1.8 + Math.random() * 1.8}s`; c.style.animationDelay = `${Math.random() * 0.6}s`; this.confetti.append(c); }
    this._timers.push(setTimeout(() => { this.confetti.innerHTML = ''; }, 4500));
  }

  _card(html) { this.cardWrap.innerHTML = `<div class="cbr-card" id="cbr-card">${html}</div>`; this.cardWrap.style.display = ''; return this.cardWrap.firstChild; }
  hideCard() { this.cardWrap.style.display = 'none'; this.cardWrap.innerHTML = ''; }
  get cardOpen() { return this.cardWrap.style.display !== 'none'; }

  showIntro(save, selected, { loading = false } = {}) {
    const unlocked = (d) => d === 1 || save.stars[d - 2] > 0;
    const d = DAYS[selected - 1];
    const days = DAYS.map(x => `<button class="cbr-dayb ${x.n === selected ? 'sel' : ''} ${unlocked(x.n) ? '' : 'lock'}" data-day="${x.n}" id="cbr-day-${x.n}">${unlocked(x.n) ? '' : '🔒 '}Day ${x.n}<small>${esc(x.name)}</small><span class="st">${[0, 1, 2].map(i => i < save.stars[x.n - 1] ? STAR : '☆').join('')}</span></button>`).join('');
    const menuItems = [...new Set(d.menu.map(([i]) => i))].map(i => `<span>${this.img(i)}${esc(ITEMS[i].name)}</span>`).join('');
    const reward = save.claimed.includes(selected) ? `<div class="cbr-reward done">Day ${selected} reward already claimed</div>` : `<div class="cbr-reward">First clear: +${DAY_CLEAR_REWARD_BB[selected - 1]} Birg Bucks</div>`;
    const ctl = this.mobile
      ? '<li>Move with the joystick, drag to look around.</li><li>Walk up to a station and tap its orange button.</li>'
      : '<li><b>WASD</b> to move, drag to look. <b>E</b> uses the highlighted station, <b>2–4</b> pick other options. <b>P</b> pauses.</li>';
    const card = this._card(`
      <div class="sub">Corner Bakery Rush</div><h2>Day ${d.n}: ${esc(d.name)}</h2>
      <div class="cbr-days">${days}</div>
      <p>${esc(d.tip)}</p>
      <div class="cbr-menu">${menuItems}</div>
      <ul class="cbr-how">${ctl}<li>Carry up to 2 items. Serve what each customer's ticket shows before their bar runs out.</li><li>Take bread out when the oven dings, or it burns! Burnt food goes in the trash.</li><li>Score ${d.stars[0]} coins to pass (${STAR}), ${d.stars[1]} for ${STAR}${STAR}, ${d.stars[2]} for ${STAR}${STAR}${STAR}. 3 lost customers ends the day.</li></ul>
      <div class="cbr-cta">${reward}<br>
      <button class="cbr-go" id="cbr-start" ${loading || !unlocked(selected) ? 'disabled style="opacity:.6"' : ''}>${loading ? 'Loading your save…' : unlocked(selected) ? '▶ Open the shop' : '🔒 Clear the day before'}</button></div>`);
    card.querySelectorAll('.cbr-dayb').forEach(b => b.addEventListener('click', () => { const n = +b.dataset.day; this.onStartDay(n, false); }));
    card.querySelector('#cbr-start').addEventListener('click', (e) => { e.currentTarget.blur(); this.onStartDay(selected, true); });
  }

  showResult(r) {
    const d = DAYS[r.day - 1], win = r.day === 3 && r.stars > 0;
    const title = r.failed ? 'Out of hearts!' : r.stars > 0 ? (win ? 'You won the Golden Whisk!' : `Day ${r.day} cleared!`) : 'Not quite!';
    const rew = r.reward > 0 ? `<div class="cbr-reward" id="cbr-reward">🧊 +${r.reward} Birg Bucks · first clear!</div>`
      : (r.stars > 0 ? `<div class="cbr-reward done" id="cbr-reward">Reward for Day ${r.day} already claimed</div>` : `<div class="cbr-reward done" id="cbr-reward">Score ${d.stars[0]} to clear the day</div>`);
    const next = r.stars > 0 && r.day < 3 ? `<button class="cbr-go" id="cbr-next">▶ Day ${r.day + 1}</button>` : '';
    const card = this._card(`
      <div class="sub">Day ${r.day} · ${esc(d.name)}</div>
      ${win ? '<div class="cbr-trophy">🏆</div>' : ''}<h2>${esc(title)}</h2>
      <div class="cbr-stars" id="cbr-stars">${[0, 1, 2].map(() => `<span>${STAR}</span>`).join('')}</div>
      <div class="cbr-res"><div>Coins<b id="cbr-res-score">${r.score}</b></div><div>Tips<b>${r.tips}</b></div><div>Served<b>${r.served}</b></div><div>Walked out<b>${r.lost}</b></div></div>
      ${r.newBest ? '<p><b>New best score!</b></p>' : `<p>Best: ${r.best}</p>`}
      <div class="cbr-cta">${rew}<br>${next}<button class="cbr-go alt" id="cbr-retry">↺ Play again</button><button class="cbr-go alt" id="cbr-days">Days</button></div>`);
    const spans = card.querySelectorAll('.cbr-stars span');
    for (let i = 0; i < r.stars; i++) this._timers.push(setTimeout(() => { spans[i].classList.add('on'); r.onStar?.(i); }, 450 + i * 380));
    card.querySelector('#cbr-next')?.addEventListener('click', () => this.onStartDay(r.day + 1, false));
    card.querySelector('#cbr-retry').addEventListener('click', () => this.onStartDay(r.day, true));
    card.querySelector('#cbr-days').addEventListener('click', () => this.onStartDay(r.day, false));
  }
  showPause({ onResume, onQuit }) {
    const card = this._card(`<h2>Paused</h2><p>The ovens are waiting for you.</p><button class="cbr-go" id="cbr-resume">▶ Resume</button><button class="cbr-go alt" id="cbr-quit">Leave this day</button>`);
    card.querySelector('#cbr-resume').addEventListener('click', onResume);
    card.querySelector('#cbr-quit').addEventListener('click', onQuit);
  }
  dispose() {
    if (typeof this._offDev === 'function') this._offDev();
    clearTimeout(this._bT); clearTimeout(this._whyT); this._timers.forEach(clearTimeout);
    this.root.remove(); this.style.remove();
  }
}
