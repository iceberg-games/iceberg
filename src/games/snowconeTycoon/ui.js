// Snowcone Tycoon HUD: shift status, held cone, station action buttons, a big
// hold-to-USE button (writes 'KeyE' into engine.input so keyboard + touch share
// one path), stand hub (Open for business, day picker, machines/upgrades shop),
// star results, banners, float text and coin arcs. Styles are scoped & removed.
import { getDeviceMode, onDeviceChange } from '../../core/device.js';
import { DAYS, FLAVORS, TOPPINGS, SHOP, DAY_CLEAR_REWARD_BB, buyCost, level, dayUnlocked, renownLevel, RENOWN_XP, STRIKES } from './config.js';

const CSS = `
.sct [hidden]{display:none!important}
.sct{position:absolute;inset:0;pointer-events:none;z-index:12;font-family:inherit;color:#163a5c}
.sct button{pointer-events:auto;font-family:inherit;cursor:pointer;touch-action:manipulation;-webkit-tap-highlight-color:transparent;user-select:none;-webkit-user-select:none;border:0}
.sct-panel{background:linear-gradient(180deg,rgba(255,255,255,.97),rgba(232,246,255,.96));border-radius:20px;box-shadow:0 10px 30px rgba(20,60,110,.25),inset 0 0 0 2px #fff}
.sct-status{position:absolute;top:66px;left:50%;transform:translateX(-50%);display:flex;align-items:center;gap:12px;padding:7px 10px;white-space:nowrap}
.sct-day{background:linear-gradient(180deg,#38b6e8,#1f86c9);color:#fff;font-weight:900;font-size:13px;border-radius:12px;padding:6px 10px}
.sct-clock{font:900 22px/1 ui-monospace,Menlo,monospace;min-width:62px;text-align:center}
.sct-clock.low{color:#ff4d5e;animation:sct-pulse .6s infinite alternate}
@keyframes sct-pulse{to{transform:scale(1.12)}}
.sct-score{display:flex;flex-direction:column;gap:3px;min-width:160px}
.sct-score b{font-size:15px;font-weight:900}
.sct-bar{position:relative;height:10px;border-radius:6px;background:#d8e9f7}
.sct-bar>i{position:absolute;left:0;top:0;bottom:0;border-radius:6px;background:linear-gradient(90deg,#7fe3ff,#ff7eb6);width:0;transition:width .35s}
.sct-bar>s{position:absolute;top:-6px;width:18px;margin-left:-9px;text-decoration:none;font-size:14px;line-height:18px;text-align:center;filter:grayscale(1) opacity(.45)}
.sct-bar>s.on{filter:none;animation:sct-pop .4s}
@keyframes sct-pop{50%{transform:scale(1.7)}}
.sct-hearts{font-size:17px}.sct-hearts .off{filter:grayscale(1) opacity(.3)}
.sct-combo{font-weight:900;color:#ff5a8a;font-size:14px;min-width:46px}
.sct-pause{background:#fff;border-radius:10px;width:34px;height:34px;font-size:15px;box-shadow:0 2px 0 #c9dced}
.sct-act{position:absolute;right:16px;bottom:24px;width:310px;padding:10px 12px 12px}
.sct.mobile .sct-act{bottom:142px;right:12px;width:min(310px,calc(100vw - 190px))}
.sct-held{display:flex;align-items:center;gap:8px;margin-bottom:6px;font-size:12px;font-weight:800;color:#4a6b8a}
.sct-held img{width:52px;height:52px;background:#e3f3ff;border-radius:14px;box-shadow:inset 0 0 0 2px #cfe6f8}
.sct-ice{flex:1;height:8px;border-radius:5px;background:#d8e9f7;overflow:hidden}.sct-ice>i{display:block;height:100%;background:linear-gradient(90deg,#bfefff,#4fd2ff);width:0}
.sct-tname{font-weight:900;font-size:15px;margin:4px 0 6px;display:flex;justify-content:space-between}
.sct-tname small{color:#6b8aa8;font-size:12px}
.sct-btns{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}
.sct-btn{display:flex;flex-direction:column;align-items:center;gap:2px;border-radius:14px;padding:6px 4px;font-weight:900;font-size:12px;color:#fff;min-height:58px;justify-content:center;
  background:linear-gradient(180deg,#4fc3f7,#1f86c9);box-shadow:0 4px 0 #156a9e;position:relative}
.sct-btn:active{transform:translateY(3px);box-shadow:0 1px 0 #156a9e}
.sct-btn.off{filter:grayscale(.8) opacity(.6)}
.sct-btn img{width:34px;height:34px;margin:-2px 0}
.sct-btn kbd{position:absolute;top:3px;left:6px;font-size:10px;opacity:.8;font-family:inherit}
.sct-btn.wide{grid-column:span 3;flex-direction:row;min-height:46px;font-size:14px;gap:8px}
.sct-btn.pink{background:linear-gradient(180deg,#ff8fc0,#e0508e);box-shadow:0 4px 0 #a8326a}
.sct-btn.gray{background:linear-gradient(180deg,#9fb3c8,#6f86a0);box-shadow:0 4px 0 #4f647c}
.sct-hint{font-size:13px;font-weight:700;color:#4a6b8a}
.sct-why{font-size:12px;font-weight:800;color:#e0334a;min-height:15px;margin-top:6px}
.sct-use{position:absolute;right:128px;bottom:34px;width:96px;height:96px;border-radius:50%;font:900 18px system-ui,sans-serif;color:#fff;
  background:radial-gradient(circle at 35% 30%,#9ff0ff,#2aa6e0 70%);box-shadow:0 6px 0 #156a9e,0 10px 24px rgba(0,60,120,.35);display:none;touch-action:none}
.sct-use.on{transform:translateY(4px) scale(.96);box-shadow:0 2px 0 #156a9e}
.sct.mobile .sct-use{display:block}
.sct-hub{position:absolute;left:14px;top:66px;width:330px;max-height:calc(100vh - 250px);overflow:auto;padding:14px;pointer-events:auto}
.sct-hub h2{margin:0;font-size:24px;font-weight:900;color:#1f6fb0}
.sct-hub .sub{font-size:11px;font-weight:900;letter-spacing:1.4px;text-transform:uppercase;color:#6b8aa8;margin-bottom:8px}
.sct-wallet{display:flex;gap:8px;margin:8px 0}
.sct-chip{flex:1;background:#fff;border-radius:14px;padding:6px 8px;font-weight:900;font-size:14px;box-shadow:inset 0 0 0 2px #d6eaf8}
.sct-chip small{display:block;font-size:10px;color:#6b8aa8;letter-spacing:.8px;text-transform:uppercase}
.sct-days{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin:8px 0}
.sct-dayb{background:#fff;border-radius:14px;padding:7px 4px;font-weight:900;font-size:12px;color:#1f6fb0;box-shadow:0 3px 0 #c9dced,inset 0 0 0 2px #e3f1fb}
.sct-dayb.sel{background:linear-gradient(180deg,#fff,#dff5ff);box-shadow:0 3px 0 #2aa6e0,inset 0 0 0 3px #4fc3f7}
.sct-dayb.lock{opacity:.5}
.sct-dayb .st{font-size:13px;letter-spacing:1px}
.sct-open{width:100%;margin:6px 0 10px;border-radius:16px;padding:12px;font-weight:900;font-size:18px;color:#fff;background:linear-gradient(180deg,#ff8fc0,#e0508e);box-shadow:0 5px 0 #a8326a;animation:sct-breathe 1.6s infinite}
.sct-open:active{transform:translateY(4px);box-shadow:0 1px 0 #a8326a}
@keyframes sct-breathe{50%{transform:scale(1.03)}}
.sct-shop h3{margin:8px 0 4px;font-size:13px;font-weight:900;color:#1f6fb0;text-transform:uppercase;letter-spacing:1px}
.sct-item{display:flex;align-items:center;gap:8px;background:#fff;border-radius:14px;padding:6px 8px;margin-bottom:6px;box-shadow:inset 0 0 0 2px #e3f1fb}
.sct-item .ic{font-size:24px;width:34px;text-align:center}
.sct-item .tx{flex:1;font-size:12px;line-height:1.25}.sct-item .tx b{font-size:13px}.sct-item .tx i{color:#6b8aa8;font-style:normal}
.sct-pips{letter-spacing:2px;color:#4fc3f7;font-size:10px}
.sct-buy{border-radius:12px;padding:7px 9px;font-weight:900;font-size:13px;color:#fff;background:linear-gradient(180deg,#5fd97a,#2fae52);box-shadow:0 3px 0 #1f7d3a;min-width:66px}
.sct-buy.no{background:linear-gradient(180deg,#c3d2e0,#9fb3c8);box-shadow:0 3px 0 #7f93a8}
.sct-buy.max{background:#e9f4fb;color:#6b8aa8;box-shadow:none}
.sct-card-wrap{position:absolute;inset:0;display:grid;place-items:center;pointer-events:none}
.sct-card{pointer-events:auto;width:min(480px,calc(100vw - 24px));max-height:calc(100vh - 200px);overflow:auto;padding:18px 20px;text-align:center}
.sct-card h2{margin:0;font-size:28px;font-weight:900;color:#1f6fb0}
.sct-card p{margin:6px 0;font-size:14px;color:#3d5f80}
.sct-stars{font-size:46px;letter-spacing:6px;margin:6px 0}
.sct-stars span{display:inline-block;filter:grayscale(1) opacity(.3);transform:scale(.6);transition:all .35s cubic-bezier(.3,1.8,.5,1)}
.sct-stars span.on{filter:none;transform:scale(1)}
.sct-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin:10px 0}
.sct-grid div{background:#fff;border-radius:12px;padding:6px;font-size:12px;font-weight:800;color:#6b8aa8}.sct-grid b{display:block;font-size:18px;color:#163a5c}
.sct-reward{background:linear-gradient(180deg,#fff6c9,#ffe27a);border-radius:14px;padding:8px;font-weight:900;color:#7a5a00;margin:8px 0}
.sct-row{display:flex;gap:8px;justify-content:center;margin-top:10px}
.sct-row button{border-radius:14px;padding:10px 16px;font-weight:900;font-size:15px;color:#fff;background:linear-gradient(180deg,#4fc3f7,#1f86c9);box-shadow:0 4px 0 #156a9e}
.sct-row button.pink{background:linear-gradient(180deg,#ff8fc0,#e0508e);box-shadow:0 4px 0 #a8326a}
.sct-banner{position:absolute;top:34%;left:50%;transform:translate(-50%,-50%);text-align:center;pointer-events:none;opacity:0;transition:opacity .2s}
.sct-banner.on{opacity:1;animation:sct-bin .35s cubic-bezier(.3,1.6,.5,1)}
@keyframes sct-bin{from{transform:translate(-50%,-50%) scale(.4)}}
.sct-banner b{display:block;font-size:54px;font-weight:900;color:#fff;-webkit-text-stroke:3px #1f6fb0;text-shadow:0 6px 0 rgba(20,60,110,.25)}
.sct-banner span{font-weight:900;color:#1f6fb0;background:rgba(255,255,255,.9);border-radius:12px;padding:4px 12px;font-size:15px}
.sct-float{position:absolute;font-weight:900;font-size:20px;color:#ffd23f;-webkit-text-stroke:1.5px #7a4a00;pointer-events:none;animation:sct-up 1.2s ease-out forwards;white-space:nowrap}
@keyframes sct-up{0%{transform:translateY(0) scale(.6);opacity:0}15%{transform:translateY(-10px) scale(1.15);opacity:1}100%{transform:translateY(-70px) scale(1);opacity:0}}
.sct-coin{position:absolute;width:22px;height:22px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#fff3a6,#ffc21a 60%,#c98a00);box-shadow:0 0 6px rgba(255,200,40,.8);pointer-events:none}
.sct-conf{position:absolute;width:10px;height:14px;pointer-events:none}
`;

export class SnowconeUI {
  constructor({ engine, icons, onAct, onPause, onOpen, onSelectDay, onBuy, onUseKey }) {
    Object.assign(this, { engine, icons, onAct, onPause, onOpen, onSelectDay, onBuy });
    this.style = document.createElement('style'); this.style.textContent = CSS; document.head.append(this.style);
    const host = document.getElementById('app') || document.body;
    this.root = document.createElement('div'); this.root.className = 'sct'; host.append(this.root);
    this.root.innerHTML = `
      <div class="sct-status sct-panel" hidden><div class="sct-day"></div><div class="sct-clock"></div>
        <div class="sct-score"><b></b><div class="sct-bar"><i></i><s>⭐</s><s>⭐</s><s>⭐</s></div></div>
        <div class="sct-combo"></div><div class="sct-hearts"></div><button class="sct-pause" title="Pause (P)">⏸</button></div>
      <div class="sct-act sct-panel" hidden><div class="sct-held"><img alt=""><div style="flex:1"><div class="sct-hl">Empty hands</div><div class="sct-ice"><i></i></div></div></div>
        <div class="sct-tname"><span></span><small></small></div><div class="sct-btns"></div><div class="sct-hint"></div><div class="sct-why"></div></div>
      <button class="sct-use">USE</button>
      <div class="sct-hub sct-panel" hidden></div>
      <div class="sct-card-wrap" hidden><div class="sct-card sct-panel"></div></div>
      <div class="sct-banner"><b></b><span></span></div>`;
    const q = (s) => this.root.querySelector(s);
    this.el = { status: q('.sct-status'), day: q('.sct-day'), clock: q('.sct-clock'), score: q('.sct-score b'), bar: q('.sct-bar>i'), stars: [...this.root.querySelectorAll('.sct-bar>s')], combo: q('.sct-combo'), hearts: q('.sct-hearts'),
      act: q('.sct-act'), heldImg: q('.sct-held img'), heldLbl: q('.sct-hl'), ice: q('.sct-ice>i'), tname: q('.sct-tname span'), tsub: q('.sct-tname small'), btns: q('.sct-btns'), hint: q('.sct-hint'), why: q('.sct-why'),
      use: q('.sct-use'), hub: q('.sct-hub'), wrap: q('.sct-card-wrap'), card: q('.sct-card'), banner: q('.sct-banner') };
    q('.sct-pause').addEventListener('pointerdown', (e) => { e.preventDefault(); this.onPause(); });
    // USE button: hold writes KeyE into the shared engine input (same path as the keyboard)
    const use = this.el.use, keys = () => this.engine?.input?.keys;
    const on = (v) => (e) => { e.preventDefault(); e.stopPropagation(); const k = keys(); if (k) v ? k.add('KeyE') : k.delete('KeyE'); use.classList.toggle('on', v); };
    use.addEventListener('pointerdown', (e) => { use.setPointerCapture?.(e.pointerId); on(true)(e); });
    for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) use.addEventListener(ev, on(false));
    this.applyDevice = () => this.root.classList.toggle('mobile', getDeviceMode() === 'mobile');
    this.applyDevice(); this.offDevice = onDeviceChange ? onDeviceChange(this.applyDevice) : null;
    window.addEventListener('device:changed', this.applyDevice);
    this.lastBtnKey = ''; this.whyT = 0; this.prevStars = 0;
  }
  // ---------- shift HUD ----------
  showShift(on) { this.el.status.hidden = !on; this.el.act.hidden = !on; }
  setStatus(shift) {
    const e = this.el, d = shift.day, left = Math.ceil(shift.left);
    e.day.textContent = `Day ${d.n} · ${d.name}`;
    e.clock.textContent = shift.closing ? 'CLOSE' : `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`; e.clock.classList.toggle('low', !shift.closing && left <= 20);
    e.score.textContent = `🪙 ${shift.score}`; const top = d.stars[2]; e.bar.style.width = `${Math.min(100, shift.score / top * 100)}%`;
    let n = 0; e.stars.forEach((s, i) => { s.style.left = `${d.stars[i] / top * 100}%`; const on = shift.score >= d.stars[i]; if (on) n++; s.classList.toggle('on', on); });
    if (n > this.prevStars) this.onStar?.(); this.prevStars = n;
    e.combo.textContent = shift.combo >= 2 ? `×${shift.combo}` : '';
    e.hearts.innerHTML = Array.from({ length: STRIKES }, (_, i) => `<span class="${i < STRIKES - shift.strikes ? '' : 'off'}">❤️</span>`).join('');
  }
  setHeld(cone) {
    const e = this.el; const img = !cone ? '' : cone.syrup ? this.icons[cone.syrup] : this.icons.ice;
    if (e.heldImg.dataset.src !== img) { e.heldImg.dataset.src = img; if (img) e.heldImg.src = img; e.heldImg.style.visibility = img ? 'visible' : 'hidden'; }
    e.heldLbl.textContent = !cone ? 'Empty hands — go shave some ice' : cone.syrup ? `${FLAVORS[cone.syrup].name}${cone.topping ? ' + ' + TOPPINGS[cone.topping].name : ''}` : cone.ice >= 1 ? 'Shaved ice — add syrup' : 'Shaving ice…';
    e.ice.style.width = `${Math.round((cone?.ice || 0) * 100)}%`;
  }
  /** target: { name, sub }, buttons: [{ key, label, img, kbd, cls, off }] */
  setActions(target, buttons, hint) {
    const e = this.el; e.tname.textContent = target ? target.name : 'Walk to a station'; e.tsub.textContent = target?.sub || '';
    e.hint.textContent = hint || '';
    const key = buttons.map(b => b.key + b.off + b.label).join('|');
    if (key !== this.lastBtnKey) {
      this.lastBtnKey = key; e.btns.innerHTML = '';
      for (const b of buttons) {
        const el = document.createElement('button'); el.className = `sct-btn ${b.cls || ''} ${b.off ? 'off' : ''}`;
        el.innerHTML = `${b.kbd ? `<kbd>${b.kbd}</kbd>` : ''}${b.img ? `<img src="${b.img}" alt="">` : ''}<span>${b.label}</span>`;
        el.addEventListener('pointerdown', (ev) => { ev.preventDefault(); ev.stopPropagation(); this.onAct(b.key); });
        e.btns.append(el);
      }
    }
    if (this.whyT && performance.now() > this.whyT) { e.why.textContent = ''; this.whyT = 0; }
  }
  flashWhy(msg) { this.el.why.textContent = msg; this.whyT = performance.now() + 2200; }
  // ---------- hub ----------
  showHub(on, state) {
    this.el.hub.hidden = !on; if (!on) return;
    const { save, selected, loading } = state, lvl = renownLevel(save.xp), nextXp = RENOWN_XP[lvl] ?? null;
    const d = DAYS[selected - 1];
    const days = DAYS.map((dd, i) => { const un = dayUnlocked(save, dd.n); return `<button class="sct-dayb ${dd.n === selected ? 'sel' : ''} ${un ? '' : 'lock'}" data-day="${dd.n}">${un ? '' : '🔒 '}Day ${dd.n}<div class="st">${'★'.repeat(save.stars[i])}${'☆'.repeat(3 - save.stars[i])}</div></button>`; }).join('');
    const items = (kind) => SHOP.filter(s => s.kind === kind).map(s => { const l = level(save, s.id), c = buyCost(save, s.id);
      return `<div class="sct-item"><div class="ic">${s.icon}</div><div class="tx"><b>${s.name}</b> <span class="sct-pips">${'●'.repeat(l)}${'○'.repeat(s.costs.length - l)}</span><br><i>${s.desc} · ${s.effect(l)}</i></div>
        <button class="sct-buy ${c == null ? 'max' : save.coins < c ? 'no' : ''}" data-buy="${s.id}">${c == null ? 'MAX' : `🪙 ${c}`}</button></div>`; }).join('');
    const reward = save.claimed.includes(selected) ? 'Birg Bucks reward claimed ✓' : `First clear: +${DAY_CLEAR_REWARD_BB[selected - 1]} Birg Bucks`;
    this.el.hub.innerHTML = `<h2>❄️ Snowcone Tycoon</h2><div class="sub">Your frosty stand</div>
      <div class="sct-wallet"><div class="sct-chip"><small>Tip-coins</small>🪙 ${save.coins}</div><div class="sct-chip"><small>Renown</small>⭐ Lv ${lvl}${nextXp != null ? ` <span style="font-size:11px;color:#6b8aa8">${save.xp}/${nextXp}</span>` : ' MAX'}</div></div>
      <div class="sct-days">${days}</div>
      <div style="font-size:13px;font-weight:700;color:#3d5f80"><b>${d.name}</b> — ${d.tip}<br><span style="color:#b07a00;font-weight:900">${reward}</span></div>
      <button class="sct-open" ${loading ? 'disabled' : ''}>${loading ? 'Loading save…' : '🍧 Open for business'}</button>
      <div class="sct-shop"><h3>Place machines</h3>${items('machine')}<h3>Stand upgrades</h3>${items('upgrade')}</div>
      <div style="font-size:11px;color:#6b8aa8;margin-top:6px">Move: WASD / joystick · USE: E / USE button · Syrups 1–6 · Pause: P</div>`;
    this.el.hub.querySelector('.sct-open').addEventListener('click', () => this.onOpen());
    this.el.hub.querySelectorAll('[data-day]').forEach(b => b.addEventListener('click', () => this.onSelectDay(+b.dataset.day)));
    this.el.hub.querySelectorAll('[data-buy]').forEach(b => b.addEventListener('click', (ev) => this.onBuy(b.dataset.buy, ev.currentTarget)));
  }
  // ---------- cards ----------
  hideCard() { this.el.wrap.hidden = true; }
  showPause({ onResume, onQuit }) {
    this.el.wrap.hidden = false; this.el.card.innerHTML = `<h2>Paused</h2><p>The guests will wait (just this once).</p><div class="sct-row"><button class="r">Resume</button><button class="pink q">Close shift</button></div>`;
    this.el.card.querySelector('.r').onclick = onResume; this.el.card.querySelector('.q').onclick = onQuit;
  }
  showResult(r, { onHub, onRetry, onNext, onStar }) {
    this.el.wrap.hidden = false;
    this.el.card.innerHTML = `<h2>${r.failed ? 'Shift over!' : r.stars ? 'Day cleared!' : 'So close!'}</h2>
      <p>Day ${r.day} · ${DAYS[r.day - 1].name}${r.newBest ? ' · <b style="color:#e0508e">New best!</b>' : ''}</p>
      <div class="sct-stars"><span>⭐</span><span>⭐</span><span>⭐</span></div>
      <div class="sct-grid"><div>Tip-coins<b>🪙 ${r.coins}</b></div><div>Served<b>🍧 ${r.served}</b></div><div>Best combo<b>×${r.combo}</b></div><div>Walked out<b>${r.lost}</b></div></div>
      ${r.reward ? `<div class="sct-reward">🎉 +${r.reward} Birg Bucks — first clear of Day ${r.day}!</div>` : ''}
      ${r.levelUp ? `<div class="sct-reward" style="background:linear-gradient(180deg,#e3f8ff,#9fe6ff);color:#0f5a85">⭐ Renown level ${r.levelUp}! +🪙 ${r.gift} gift</div>` : ''}
      <p>${r.stars ? 'Spend your tip-coins on machines and upgrades back at the stand.' : `Reach 🪙 ${DAYS[r.day - 1].stars[0]} for a star.`}</p>
      <div class="sct-row"><button class="h">Back to stand</button><button class="pink rt">${r.stars && r.day < 3 ? 'Next day' : 'Play again'}</button></div>`;
    this.el.card.querySelector('.h').onclick = onHub;
    this.el.card.querySelector('.rt').onclick = r.stars && r.day < 3 ? onNext : onRetry;
    const spans = [...this.el.card.querySelectorAll('.sct-stars span')];
    for (let i = 0; i < r.stars; i++) setTimeout(() => { spans[i]?.classList.add('on'); onStar?.(); }, 450 + i * 380);
  }
  // ---------- juice ----------
  banner(big, small = '', ms = 1200) {
    const b = this.el.banner; b.querySelector('b').textContent = big; b.querySelector('span').textContent = small; b.querySelector('span').style.display = small ? '' : 'none';
    b.classList.remove('on'); void b.offsetWidth; b.classList.add('on'); clearTimeout(this.bT); this.bT = setTimeout(() => b.classList.remove('on'), ms);
  }
  floatText(txt, x, y, color) { const d = document.createElement('div'); d.className = 'sct-float'; d.textContent = txt; d.style.left = `${x}px`; d.style.top = `${y}px`; if (color) d.style.color = color; this.root.append(d); setTimeout(() => d.remove(), 1300); }
  coinArc(x, y, n = 6) {
    const tgt = this.el.score.getBoundingClientRect(), tx = tgt.left + 14, ty = tgt.top + 8;
    for (let i = 0; i < n; i++) { const c = document.createElement('div'); c.className = 'sct-coin'; this.root.append(c);
      const sx = x + (Math.random() - 0.5) * 40, sy = y + (Math.random() - 0.5) * 20, mx = (sx + tx) / 2 + (Math.random() - 0.5) * 120, my = Math.min(sy, ty) - 80 - Math.random() * 60;
      const a = c.animate([{ transform: `translate(${sx}px,${sy}px) scale(.5)` }, { transform: `translate(${mx}px,${my}px) scale(1.1)`, offset: 0.45 }, { transform: `translate(${tx}px,${ty}px) scale(.6)`, opacity: 0.9 }], { duration: 700 + i * 60, easing: 'cubic-bezier(.4,0,.6,1)' });
      c.style.left = c.style.top = '0'; a.onfinish = () => c.remove(); }
  }
  confetti(n = 80) {
    const cs = ['#2f8bff', '#ff3b5c', '#5fd94a', '#9b5cff', '#ff9a2e', '#ffd23f', '#7fe3ff'];
    for (let i = 0; i < n; i++) { const c = document.createElement('div'); c.className = 'sct-conf'; c.style.background = cs[i % cs.length]; c.style.left = `${Math.random() * 100}%`; c.style.top = '-20px'; this.root.append(c);
      const a = c.animate([{ transform: 'translateY(0) rotate(0)' }, { transform: `translate(${(Math.random() - 0.5) * 200}px, ${innerHeight + 40}px) rotate(${Math.random() * 900}deg)` }], { duration: 1800 + Math.random() * 1600, delay: Math.random() * 400, easing: 'cubic-bezier(.2,.6,.4,1)' }); a.onfinish = () => c.remove(); }
  }
  dispose() { const k = this.engine?.input?.keys; k?.delete('KeyE'); window.removeEventListener('device:changed', this.applyDevice); if (typeof this.offDevice === 'function') this.offDevice(); this.root.remove(); this.style.remove(); }
}
