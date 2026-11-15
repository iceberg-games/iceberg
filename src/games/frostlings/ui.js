// Frostlings UI: HUD built once (per-frame updates only touch textContent/style), modal panels re-rendered on open,
// battle overlay (cards + option grid), cinematics (boss intro, catch, level up, evolve), toasts. Touch-sized.
import { TYPES, EMOTES } from './config.js';
const CSS = `
.fl{position:absolute;inset:0;pointer-events:none;z-index:12;color:#16325a;font-family:inherit;--glass:linear-gradient(180deg,rgba(255,255,255,.96),rgba(223,243,255,.94))}
.fl button{pointer-events:auto;font-family:inherit;cursor:pointer;touch-action:manipulation;-webkit-tap-highlight-color:transparent;user-select:none;border:0}
.fl .fl-card{background:var(--glass);border:3px solid #fff;border-radius:18px;box-shadow:0 5px 0 #9cc9ea,0 12px 26px rgba(10,30,70,.28)}
.fl-top{position:absolute;top:62px;left:14px;padding:8px 12px;min-width:200px;font-weight:800;font-size:13px}
.fl-top .area{font-size:16px;font-weight:900;display:flex;gap:6px;align-items:center}
.fl-top .row{display:flex;justify-content:space-between;gap:10px;margin-top:3px}
.fl-bar{height:8px;border-radius:6px;background:#cfe3f2;overflow:hidden;box-shadow:inset 0 2px 0 rgba(0,0,0,.1)}
.fl-bar i{display:block;height:100%;width:0;transition:width .35s ease-out}
.fl-party{position:absolute;top:150px;left:14px;display:flex;flex-direction:column;gap:6px}
.fl-pc{display:flex;gap:8px;align-items:center;padding:4px 10px 4px 4px;width:190px;font-size:12px;font-weight:800;border-radius:14px}
.fl-pc img{width:40px;height:40px;border-radius:10px;background:#e8f4ff}
.fl-pc .nm{display:flex;justify-content:space-between}
.fl-pc .fl-bar{height:6px;margin-top:2px}
.fl-pc.lead{outline:3px solid #ffd24a}
.fl-quests{position:absolute;top:118px;right:14px;width:230px;padding:8px 12px;font-size:12px;font-weight:700}
.fl-quests h4{margin:0 0 4px;font-size:13px;letter-spacing:1px}
.fl-quests .q{margin:5px 0}.fl-quests .q b{display:block;font-size:12px}
.fl-btns{position:absolute;top:62px;right:14px;display:flex;gap:6px}
.fl-btns button{width:46px;height:46px;border-radius:14px;font-size:22px;background:var(--glass);border:3px solid #fff;box-shadow:0 4px 0 #9cc9ea}
.fl-btns button:active,.fl-big:active,.fl-opt:active{transform:scale(.94)}
.fl-emotes{position:absolute;left:14px;bottom:176px;display:flex;flex-direction:column;gap:6px}
.fl-emotes button{width:42px;height:42px;border-radius:50%;font-size:20px;background:rgba(255,255,255,.9);border:3px solid #fff;box-shadow:0 3px 0 #9cc9ea}
.fl-prompt{position:absolute;left:50%;bottom:120px;transform:translateX(-50%);padding:10px 18px;font-weight:900;font-size:16px;display:none;pointer-events:auto;cursor:pointer}
.fl-prompt.show{display:block;animation:flpop .2s ease-out}
.fl-act{position:absolute;right:22px;bottom:140px;width:96px;height:96px;border-radius:50%;font-size:14px;font-weight:900;color:#1d4f7a;background:radial-gradient(circle at 35% 30%,#fff,#bfe6ff);border:5px solid #fff!important;box-shadow:0 6px 0 #7fb3dd,0 10px 24px rgba(0,0,0,.3);display:none;z-index:95}
.fl-act.show{display:block}
.fl-toasts{position:absolute;top:120px;left:50%;transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;gap:5px;font-weight:800;font-size:14px}
.fl-toasts div{background:rgba(16,30,60,.84);color:#fff;border-radius:12px;padding:6px 14px;animation:flslide .25s ease-out;transition:opacity .5s;white-space:nowrap}
.fl-banner{position:absolute;top:30%;left:50%;transform:translate(-50%,-50%) scale(.7);opacity:0;font-size:44px;font-weight:900;text-align:center;transition:all .25s;color:#fff;text-shadow:0 0 22px #6cf,0 4px 0 #123;white-space:nowrap}
.fl-banner.show{opacity:1;transform:translate(-50%,-50%) scale(1)}.fl-banner small{display:block;font-size:19px;color:#ffe680}
.fl-help{position:absolute;bottom:8px;left:50%;transform:translateX(-50%);font-size:11px;color:#fff;opacity:.8;text-shadow:0 0 6px #000;white-space:nowrap}
.fl-modal{position:absolute;inset:0;display:none;align-items:center;justify-content:center;background:rgba(10,24,52,.35);pointer-events:auto;z-index:100}
.fl-modal.show{display:flex}
.fl-panel{width:min(760px,94vw);max-height:84vh;overflow:auto;padding:16px 18px;position:relative;animation:flin .22s ease-out}
.fl-panel h2{margin:0 0 4px;font-size:24px}.fl-panel .sub{font-size:13px;opacity:.75;margin-bottom:10px}
.fl-x{position:absolute;top:10px;right:12px;width:40px;height:40px;border-radius:12px;font-size:20px;font-weight:900;background:#e8f4ff;color:#1d4f7a}
.fl-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px}
.fl-tile{background:#fff;border-radius:14px;padding:8px;text-align:center;font-size:12px;font-weight:800;border:3px solid #e1effa;position:relative}
.fl-tile img{width:96px;height:96px}.fl-tile.sil img{filter:brightness(0) opacity(.35)}.fl-tile.unk img{filter:brightness(0) opacity(.08)}
.fl-tile.sel{border-color:#ffd24a;box-shadow:0 0 0 3px #ffd24a}
.fl-tile .no{position:absolute;top:6px;left:8px;font-size:10px;opacity:.6}
.fl-type{display:inline-block;padding:1px 8px;border-radius:8px;color:#fff;font-size:11px;font-weight:900;text-shadow:0 1px 0 rgba(0,0,0,.25)}
.fl-rar{display:inline-block;padding:1px 6px;border-radius:6px;font-size:10px;font-weight:900;color:#16325a}
.fl-big{border-radius:14px!important;padding:12px 18px;font-size:16px;font-weight:900;color:#5a2a00;background:linear-gradient(180deg,#ffd77a,#ff9a2e);box-shadow:0 5px 0 #c0641a;min-height:48px}
.fl-big.blue{color:#0b2d55;background:linear-gradient(180deg,#bfe6ff,#6cb8ff);box-shadow:0 5px 0 #2f6fb8}
.fl-big.gray{color:#445;background:linear-gradient(180deg,#eef2f6,#cdd6e0);box-shadow:0 5px 0 #98a4b3}
.fl-big[disabled]{opacity:.45;filter:grayscale(.6)}
.fl-row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.fl-list .it{display:flex;justify-content:space-between;align-items:center;gap:10px;background:#fff;border-radius:12px;padding:8px 10px;margin:6px 0;border:2px solid #e1effa;font-size:13px;font-weight:700}
.fl-list .it b{font-size:14px}
.fl-tabs{display:flex;gap:6px;margin-bottom:10px}.fl-tabs button{padding:8px 14px;border-radius:12px;font-weight:900;background:#e8f4ff;color:#1d4f7a}.fl-tabs button.on{background:#1d4f7a;color:#fff}
/* battle */
.fl-bt{position:absolute;inset:0;display:none;pointer-events:none;z-index:60}
.fl-bt.show{display:block}
.fl-bc{position:absolute;display:block!important;text-align:left;padding:8px 12px;width:min(300px,44vw);font-weight:900;font-size:14px}
.fl-bc .nm{display:flex;justify-content:space-between;align-items:center;gap:6px}
.fl-bc>*{width:100%;box-sizing:border-box}.fl-bc .fl-bar{height:12px;margin-top:5px}.fl-bc .hpn{font-size:12px;text-align:right;margin-top:2px}
.fl-bc .st{font-size:11px;padding:1px 6px;border-radius:6px;color:#fff;margin-left:4px}
.fl-bc.foe{top:70px;right:16px}.fl-bc.me{bottom:200px;left:16px}
.fl-msg{position:absolute;left:50%;bottom:16px;transform:translateX(-50%);width:min(860px,96vw);min-height:58px;padding:12px 18px;font-size:17px;font-weight:800;display:block!important;text-align:left;box-sizing:border-box;z-index:2}
.fl-opts{position:absolute;right:16px;bottom:104px;width:min(520px,94vw);display:grid;grid-template-columns:1fr 1fr;gap:8px;pointer-events:auto}
.fl-opt{min-height:58px;border-radius:14px;padding:6px 10px;font-size:16px;font-weight:900;color:#fff;text-align:left;box-shadow:0 5px 0 rgba(0,0,0,.25);text-shadow:0 1px 0 rgba(0,0,0,.3);position:relative}
.fl-opt small{display:block;font-size:11px;opacity:.9;font-weight:800}
.fl-opt[disabled]{opacity:.4;filter:grayscale(.7)}
.fl-opt .tag{position:absolute;top:5px;right:8px;font-size:10px;background:rgba(0,0,0,.28);padding:1px 6px;border-radius:6px}
.fl-wipe{position:absolute;inset:0;background:radial-gradient(circle,#fff 0,#bfe6ff 60%,#4fa3ff 100%);opacity:0;pointer-events:none;transition:opacity .35s;z-index:150}
.fl-wipe.on{opacity:1}
.fl-cine{position:absolute;inset:0;display:none;align-items:center;justify-content:center;pointer-events:none;z-index:120}
.fl-cine.show{display:flex}
.fl-cine .cc{padding:18px 26px;text-align:center;min-width:280px;animation:flin .35s cubic-bezier(.2,1.6,.4,1);pointer-events:auto}
.fl-cine .cc h2{margin:2px 0;font-size:30px}.fl-cine .cc img{width:150px;height:150px}
.fl-boss{position:absolute;left:0;right:0;top:34%;padding:18px 0;color:#fff;text-align:center;animation:flboss .5s cubic-bezier(.2,1.4,.4,1)}
.fl-boss h2{margin:0;font-size:40px;text-shadow:0 4px 0 rgba(0,0,0,.3)}.fl-boss i{display:block;font-size:16px;opacity:.95;margin-top:4px}
.fl-flash{position:absolute;inset:0;background:#fff;opacity:0;pointer-events:none;z-index:130;transition:opacity .6s}
.fl-flash.on{opacity:1;transition:none}
@keyframes flin{from{transform:scale(.7);opacity:0}}@keyframes flpop{from{transform:translateX(-50%) scale(.7)}}@keyframes flslide{from{transform:translateY(-12px);opacity:0}}
@keyframes flboss{from{transform:translateX(-110%) skewX(-12deg)}}
body.fl-hidetouch #touch-ui{display:none!important}
@media (max-height:520px){.fl-bc{width:min(230px,34vw);font-size:12px;padding:6px 10px}.fl-bc.foe{top:52px;right:8px}.fl-bc.me{top:52px;bottom:auto;left:8px}.fl-opts{right:8px;bottom:8px;width:min(440px,54vw);gap:6px}.fl-opt{min-height:46px;font-size:14px;padding:4px 8px}.fl-msg{left:8px;transform:none;bottom:8px;width:calc(44vw - 20px);min-height:46px;font-size:14px;padding:8px 12px}.fl-panel{max-height:calc(100vh - 16px);padding:10px 12px}.fl-panel img.fl-st-img{width:60px!important;height:60px!important}.fl-banner{font-size:30px}}
@media (max-width:760px){.fl-quests{display:none}.fl-top{min-width:150px;font-size:11px}.fl-pc{width:150px}.fl-pc img{width:32px;height:32px}.fl-bc.me{bottom:248px}.fl-opts{left:8px;right:8px;width:auto;bottom:84px}.fl-msg{font-size:15px}.fl-banner{font-size:30px}}
`;
export const typeBadge = (t) => `<span class="fl-type" style="background:${TYPES[t].color}">${TYPES[t].icon} ${TYPES[t].name}</span>`;
export class FrostUI {
  constructor(mobile, h) {
    this.mobile = mobile; this.h = h; this._last = {};
    this.style = document.createElement('style'); this.style.textContent = CSS; document.head.appendChild(this.style);
    const r = this.root = document.createElement('div'); r.className = 'fl';
    r.innerHTML = `
      <div class="fl-top fl-card"><div class="area"><span data-tm>☀</span><span data-ar>Snowdrift Village</span></div>
        <div class="row"><span>❄ <b data-fk>0</b> flakes</span><span>Rank <b data-rk>1</b></span></div><div class="fl-bar" style="margin-top:4px"><i data-rx style="background:linear-gradient(90deg,#ffd24a,#ff9a2e)"></i></div></div>
      <div class="fl-party" data-pt></div>
      <div class="fl-btns"><button data-b="party" title="Party (P)">🐾</button><button data-b="bag" title="Bag (B)">🎒</button><button data-b="dex" title="Frostdex (X)">📖</button><button data-b="quests" title="Quests (J)">📜</button></div>
      <div class="fl-quests fl-card" data-qt><h4>📜 QUESTS</h4><div data-ql></div></div>
      <div class="fl-emotes">${EMOTES.map((e, i) => `<button data-em="${i}">${e}</button>`).join('')}</div>
      <button class="fl-prompt fl-card" data-pr></button>
      ${mobile ? '<button class="fl-act" data-ac>✋<br><span data-acl>TALK</span></button>' : ''}
      <div class="fl-toasts" data-to></div><div class="fl-banner" data-bn></div>
      <div class="fl-help">${mobile ? 'Joystick move · walk into wild Frostlings to battle · ✋ to interact' : 'WASD move · drag camera · walk into wild Frostlings to battle · E interact · P party · B bag · X Frostdex · J quests · 1-4 emote'}</div>
      <div class="fl-bt" data-bt>
        <div class="fl-bc foe fl-card" data-bf></div><div class="fl-bc me fl-card" data-bm></div>
        <div class="fl-opts" data-bo></div><div class="fl-msg fl-card" data-bg></div>
      </div>
      <div class="fl-cine" data-cn></div><div class="fl-modal" data-md></div><div class="fl-flash" data-fs></div><div class="fl-wipe" data-wp></div>`;
    document.body.appendChild(r);
    const q = (k) => r.querySelector(`[data-${k}]`);
    this.el = { tm: q('tm'), ar: q('ar'), fk: q('fk'), rk: q('rk'), rx: q('rx'), pt: q('pt'), ql: q('ql'), qt: q('qt'), pr: q('pr'), ac: q('ac'), acl: q('acl'), to: q('to'), bn: q('bn'), bt: q('bt'), bf: q('bf'), bm: q('bm'), bo: q('bo'), bg: q('bg'), cn: q('cn'), md: q('md'), fs: q('fs'), wp: q('wp') };
    const stop = (e) => { e.stopPropagation(); };
    r.querySelectorAll('[data-b]').forEach(b => b.addEventListener('click', (e) => { stop(e); h.onButton(b.dataset.b); }));
    r.querySelectorAll('[data-em]').forEach(b => b.addEventListener('pointerdown', (e) => { stop(e); h.onEmote(+b.dataset.em); }));
    this.el.pr.addEventListener('click', (e) => { stop(e); h.onInteract(); });
    this.el.ac?.addEventListener('pointerdown', (e) => { e.preventDefault(); stop(e); h.onInteract(); });
    for (const k of ['md', 'bt', 'cn']) this.el[k].addEventListener('pointerdown', stop);
    this.el.md.addEventListener('pointerdown', (e) => { if (e.target === this.el.md && this._closable) this.closeModal(); });
    this._partySig = ''; this._questSig = '';
  }
  set(k, v) { if (this._last[k] === v) return; this._last[k] = v; this.el[k].textContent = v; }
  sty(el, key, prop, v) { if (this._last[key] === v) return; this._last[key] = v; el.style[prop] = v; }
  hud(s) {
    this.set('tm', s.timeIcon); this.set('ar', s.area); this.set('fk', String(s.flakes)); this.set('rk', String(s.rank));
    this.sty(this.el.rx, 'rx', 'width', `${Math.round(s.rankFrac * 100)}%`);
    // party cards: structure rebuilt only when composition changes; bars update by style
    const sig = s.party.map(p => p.uid + ':' + p.sp + ':' + (p.hat || '')).join('|');
    if (sig !== this._partySig) {
      this._partySig = sig;
      this.el.pt.innerHTML = s.party.map((p, i) => `<div class="fl-pc fl-card${i === 0 ? ' lead' : ''}" data-u="${p.uid}"><img src="${s.portraits[p.sp] || ''}"><div style="flex:1"><div class="nm"><span data-n>${p.name}</span><span data-l>Lv${p.lv}</span></div><div class="fl-bar"><i data-h style="background:#5be37d"></i></div><div class="fl-bar" style="height:4px"><i data-x style="background:#6cb8ff"></i></div></div></div>`).join('');
      this._pcs = [...this.el.pt.children].map(c => ({ l: c.querySelector('[data-l]'), h: c.querySelector('[data-h]'), x: c.querySelector('[data-x]'), last: {} }));
    }
    s.party.forEach((p, i) => {
      const c = this._pcs[i]; if (!c) return;
      const lv = `Lv${p.lv}${p.status ? ' ' + ({ chill: '🧊', sleep: '💤', burn: '🔥' })[p.status] : ''}`; if (c.last.l !== lv) { c.last.l = lv; c.l.textContent = lv; }
      const hw = `${Math.round(p.hpFrac * 100)}%`; if (c.last.h !== hw) { c.last.h = hw; c.h.style.width = hw; c.h.style.background = p.hpFrac > 0.5 ? '#5be37d' : p.hpFrac > 0.2 ? '#ffc44a' : '#ff5d5d'; }
      const xw = `${Math.round(p.xpFrac * 100)}%`; if (c.last.x !== xw) { c.last.x = xw; c.x.style.width = xw; }
    });
    const qsig = s.quests.map(q => q.name + q.have + '/' + q.n).join('|');
    if (qsig !== this._questSig) {
      this._questSig = qsig;
      this.el.ql.innerHTML = s.quests.length ? s.quests.map(q => `<div class="q"><b>${q.name}</b>${q.desc}<div class="fl-bar" style="margin-top:3px"><i style="width:${Math.round(Math.min(1, q.have / q.n) * 100)}%;background:${q.have >= q.n ? '#5be37d' : '#6cb8ff'}"></i></div><span style="opacity:.7">${Math.min(q.have, q.n)}/${q.n}${q.have >= q.n ? ' · turn in at the board!' : ''}</span></div>`).join('') : '<div class="q" style="opacity:.7">Visit the 📜 Quest Board in the village.</div>';
    }
    const pr = s.prompt; const ptxt = pr ? `${this.mobile ? '' : 'E · '}${pr.icon} ${pr.label}` : '';
    if (this._last.pr !== ptxt) { this._last.pr = ptxt; this.el.pr.textContent = ptxt; this.el.pr.classList.toggle('show', !!pr && !this.mobile); if (this.el.ac) { this.el.ac.classList.toggle('show', !!pr); this.el.acl.textContent = pr ? pr.label.split(' ')[0].toUpperCase().slice(0, 8) : ''; } }
  }
  showWorldHud(on) { for (const k of ['pt', 'qt']) this.el[k].style.display = on ? '' : 'none'; this.root.querySelector('.fl-btns').style.display = on ? '' : 'none'; this.root.querySelector('.fl-emotes').style.display = on ? '' : 'none'; this.root.querySelector('.fl-top').style.display = on ? '' : 'none'; if (!on) { this.el.pr.classList.remove('show'); this.el.ac?.classList.remove('show'); this._last.pr = null; } }
  toast(html, ms = 3200) {
    const d = document.createElement('div'); d.innerHTML = html; this.el.to.prepend(d);
    while (this.el.to.children.length > 4) this.el.to.lastChild.remove();
    setTimeout(() => { d.style.opacity = 0; setTimeout(() => d.remove(), 500); }, ms);
  }
  banner(text, sub = '', ms = 1500) { const b = this.el.bn; b.innerHTML = `${text}${sub ? `<small>${sub}</small>` : ''}`; b.classList.add('show'); clearTimeout(this._bt); this._bt = setTimeout(() => b.classList.remove('show'), ms); }
  flash() { const f = this.el.fs; f.classList.add('on'); requestAnimationFrame(() => requestAnimationFrame(() => f.classList.remove('on'))); }
  wipe(on) { this.el.wp.classList.toggle('on', on); }
  // ---------- modal ----------
  modal(html, { closable = true, onClose = null } = {}) {
    this._closable = closable; this._onClose = onClose;
    this.el.md.innerHTML = `<div class="fl-panel fl-card">${closable ? '<button class="fl-x" data-close>✕</button>' : ''}${html}</div>`;
    this.el.md.classList.add('show'); this._touch();
    this.el.md.querySelector('[data-close]')?.addEventListener('click', () => this.closeModal());
    return this.el.md.firstChild;
  }
  get modalOpen() { return this.el.md.classList.contains('show'); }
  closeModal() { if (!this.modalOpen) return; this.el.md.classList.remove('show'); this.el.md.innerHTML = ''; this._touch(); const f = this._onClose; this._onClose = null; f?.(); this.h.onModalClosed?.(); }
  // ---------- battle ----------
  battleShow(on) { this.el.bt.classList.toggle('show', on); this.showWorldHud(!on); if (!on) this.el.bo.innerHTML = ''; this._touch(); }
  /** hide the shared joystick/JUMP while a battle or a panel is up (they would cover touch buttons) */
  _touch() { document.body.classList.toggle('fl-hidetouch', this.el.bt.classList.contains('show') || this.modalOpen); }
  battleCard(which, c, extra = '') {
    const el = which === 'foe' ? this.el.bf : this.el.bm;
    if (!el._built || el._uid !== c.key) {
      el._built = true; el._uid = c.key;
      el.innerHTML = `<div class="nm"><span>${c.name} <span data-st></span></span><span>Lv<span data-lv>${c.lv}</span></span></div><div style="margin-top:3px">${typeBadge(c.type)} ${extra}</div><div class="fl-bar"><i data-h></i></div>${which === 'me' ? '<div class="hpn" data-hn></div><div class="fl-bar" style="height:5px;margin-top:3px"><i data-x style="background:#6cb8ff"></i></div>' : ''}`;
      el._h = el.querySelector('[data-h]'); el._hn = el.querySelector('[data-hn]'); el._st = el.querySelector('[data-st]'); el._lv = el.querySelector('[data-lv]'); el._x = el.querySelector('[data-x]');
    }
    const f = Math.max(0, c.hp / c.maxHp); el._h.style.width = `${f * 100}%`; el._h.style.background = f > 0.5 ? '#5be37d' : f > 0.2 ? '#ffc44a' : '#ff5d5d';
    if (el._hn) el._hn.textContent = `${Math.ceil(c.hp)} / ${c.maxHp}`;
    el._lv.textContent = c.lv;
    if (el._x && c.xpFrac != null) el._x.style.width = `${Math.round(c.xpFrac * 100)}%`;
    const st = c.status ? { chill: ['CHILL', '#4fa3ff'], sleep: ['SLEEP', '#8a7ad8'], burn: ['BURN', '#ff6a2a'] }[c.status.id] : null;
    el._st.innerHTML = st ? `<span class="st" style="background:${st[1]}">${st[0]}</span>` : '';
  }
  battleMsg(t) { this.el.bg.innerHTML = t; }
  /** items: [{label, sub, color, tag, disabled, pick}] */
  battleOptions(items) {
    const o = this.el.bo; o.innerHTML = '';
    for (const it of items) {
      const b = document.createElement('button'); b.className = 'fl-opt'; b.style.background = it.color || '#6cb8ff';
      if (it.wide) b.style.gridColumn = 'span 2';
      b.innerHTML = `${it.label}${it.sub ? `<small>${it.sub}</small>` : ''}${it.tag ? `<span class="tag">${it.tag}</span>` : ''}`;
      if (it.disabled) b.disabled = true;
      b.addEventListener('click', (e) => { e.stopPropagation(); if (it.disabled) return; this.h.onClick?.(); it.pick(); });
      o.appendChild(b);
    }
  }
  clearOptions() { this.el.bo.innerHTML = ''; }
  // ---------- cinematics ----------
  cine(html, ms = 0, onDone = null) {
    const c = this.el.cn; c.innerHTML = html; c.classList.add('show');
    clearTimeout(this._ct); const done = () => { c.classList.remove('show'); c.innerHTML = ''; onDone?.(); };
    if (ms) this._ct = setTimeout(done, ms); else c.querySelector('[data-ok]')?.addEventListener('click', (e) => { e.stopPropagation(); this.h.onClick?.(); done(); });
    return c;
  }
  bossIntro(T, ms = 2400) { return this.cine(`<div class="fl-boss" style="background:linear-gradient(90deg,transparent,${T.color}ee 20%,${T.color}ee 80%,transparent)"><div style="font-size:14px;letter-spacing:4px;opacity:.9">${T.title.toUpperCase()}</div><h2>${T.name}</h2><i>“${T.quote}”</i></div>`, ms); }
  dispose() { document.body.classList.remove('fl-hidetouch'); clearTimeout(this._bt); clearTimeout(this._ct); this.root.remove(); this.style.remove(); }
}
