// DOM HUD for Natural Disaster Survival: round panel, health bar, item buttons, Bigger Storm
// picker, announcements and screen overlays. Styles are injected and removed with the game.
import { getDeviceMode, onDeviceChange } from '../../core/device.js';

const CSS = `
.nds{position:absolute;inset:0;pointer-events:none;z-index:12;font-family:inherit}
.nds button{pointer-events:auto;font-family:inherit;cursor:pointer;-webkit-tap-highlight-color:transparent}
.nds-panel{position:absolute;top:66px;left:50%;transform:translateX(-50%);min-width:280px;text-align:center;background:rgba(14,26,44,.82);color:#fff;border-radius:16px;padding:7px 18px 9px;box-shadow:0 8px 28px rgba(0,0,0,.3);border:2px solid rgba(160,220,255,.45);backdrop-filter:blur(6px)}
.nds-phase{font-size:12px;letter-spacing:2px;font-weight:800;color:#9fdcff;text-transform:uppercase}
.nds-main{font-size:24px;font-weight:900;line-height:1.15}
.nds-sub{font-size:12px;opacity:.85}
.nds-panel.danger{background:rgba(110,20,20,.85);border-color:#ff8a6a}.nds-panel.danger .nds-phase{color:#ffc2a8}
.nds-hp{position:absolute;top:150px;left:50%;transform:translateX(-50%);width:260px;height:20px;border-radius:11px;background:rgba(0,0,0,.45);border:2px solid rgba(255,255,255,.8);overflow:hidden;box-shadow:0 4px 14px rgba(0,0,0,.25)}
.nds-hp i{position:absolute;inset:0;width:100%;background:linear-gradient(180deg,#7dff6a,#2fb83a);transition:width .15s}
.nds-hp.mid i{background:linear-gradient(180deg,#ffe36a,#e0a020)}.nds-hp.low i{background:linear-gradient(180deg,#ff7a6a,#c0262a)}
.nds-hp span{position:absolute;inset:0;text-align:center;font-size:12px;font-weight:900;color:#fff;line-height:16px;text-shadow:0 1px 2px #000}
.nds-items{position:absolute;right:14px;bottom:100px;display:flex;flex-direction:column;gap:8px}
.nds-item{display:flex;align-items:center;gap:8px;min-width:170px;border:0;border-radius:14px;padding:7px 12px;background:rgba(255,255,255,.94);box-shadow:0 4px 0 rgba(14,42,69,.25),0 6px 16px rgba(0,0,0,.2);text-align:left;color:#123}
.nds-item:active{transform:translateY(2px)}
.nds-item .ic{font-size:26px}.nds-item b{display:block;font-size:14px}.nds-item small{font-size:11px;color:#4f7395}
.nds-item .pr{margin-left:auto;font-weight:900;color:#c07a00;font-size:13px;white-space:nowrap}
.nds-item.on{background:linear-gradient(180deg,#b6ffb0,#6fe07a)}.nds-item kbd{font-size:9px;padding:0 4px;margin-right:2px}
.nds-banner{position:absolute;top:34%;left:50%;transform:translate(-50%,-50%) scale(.85);opacity:0;transition:all .25s;text-align:center;font-size:44px;font-weight:900;color:#fff;-webkit-text-stroke:2px #1d2a3a;text-shadow:0 5px 0 #1d2a3a,0 0 30px rgba(255,120,60,.6);white-space:nowrap}
.nds-banner small{display:block;font-size:20px;-webkit-text-stroke:1px #1d2a3a;color:#ffe680;margin-top:4px}
.nds-banner.show{opacity:1;transform:translate(-50%,-50%) scale(1)}
.nds-flash{position:absolute;inset:0;background:radial-gradient(ellipse at center,rgba(255,0,0,0) 40%,rgba(220,0,0,.55));opacity:0;transition:opacity .4s}
.nds-flash.on{opacity:1;transition:none}
.nds-frost{position:absolute;inset:0;opacity:0;transition:opacity 1s;background:radial-gradient(ellipse at center,rgba(255,255,255,0) 45%,rgba(220,240,255,.75) 90%)}
.nds-white{position:absolute;inset:0;background:#fff;opacity:0;transition:opacity .5s}
.nds-pick{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);background:#f4fbff;border-radius:20px;padding:16px 18px;box-shadow:0 16px 50px rgba(0,0,0,.4);display:none;pointer-events:auto;width:min(440px,92vw);color:#123;text-align:center;border:3px solid #fff}
.nds-pick.show{display:block}.nds-pick h3{margin:0 0 4px;font-size:20px}.nds-pick p{margin:0 0 10px;font-size:13px;color:#4f7395}
.nds-pick .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:8px}
.nds-pick .grid button{border:0;border-radius:12px;padding:10px 6px;background:#fff;box-shadow:0 3px 0 #b9d3e6;font-weight:800;font-size:14px}
.nds-pick .grid button span{display:block;font-size:26px}
.nds-pick .x{position:absolute;right:10px;top:6px;border:0;background:none;font-size:22px}
.nds-help{position:absolute;left:12px;bottom:110px;max-width:290px;background:rgba(255,255,255,.9);border-radius:14px;padding:10px 14px;font-size:13px;color:#123;box-shadow:0 6px 18px rgba(0,0,0,.2)}
.nds.m .nds-panel{top:8px;min-width:0;width:auto;max-width:56vw;padding:4px 10px 5px}
.nds.m .nds-main{font-size:17px}.nds.m .nds-phase{font-size:9px;letter-spacing:1px}.nds.m .nds-sub{font-size:10px}
.nds.m .nds-hp{top:auto;bottom:178px;left:24px;transform:none;width:130px;height:16px}.nds.m .nds-hp span{font-size:10px;line-height:12px}
.nds.m .nds-items{right:8px;bottom:142px;gap:6px}
.nds.m .nds-item{min-width:0;padding:5px 8px;border-radius:12px}.nds.m .nds-item b,.nds.m .nds-item small,.nds.m .nds-item kbd{display:none}
.nds.m .nds-item .ic{font-size:22px}.nds.m .nds-item .pr{font-size:11px}
.nds.m .nds-banner{font-size:26px;top:30%}.nds.m .nds-banner small{font-size:14px}
.nds.m .nds-help{display:none}
`;
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };

export class DisasterUI {
  constructor({ prices, disasters, onBalloon, onApple, onStorm, onPick, onHunt }) {
    this.style = el('style'); this.style.textContent = CSS; document.head.append(this.style);
    this.root = el('div', 'nds'); this.root.id = 'nds-root';
    this.white = el('div', 'nds-white'); this.frost = el('div', 'nds-frost'); this.flashEl = el('div', 'nds-flash');
    this.panel = el('div', 'nds-panel', '<div class="nds-phase"></div><div class="nds-main"></div><div class="nds-sub"></div>'); this.panel.id = 'nds-panel';
    this.hp = el('div', 'nds-hp', '<i></i><span></span>'); this.hp.id = 'nds-hp';
    this.items = el('div', 'nds-items');
    const mk = (id, ic, name, desc, key, fn) => { const b = el('button', 'nds-item', `<span class="ic">${ic}</span><span><b>${name}</b><small>${desc}</small></span><span class="pr"></span>`); b.id = id; b.title = `${name}: ${desc}${key ? ` (key ${key})` : ''}`; b.onclick = (e) => { e.currentTarget.blur(); fn(); }; this.items.append(b); return b; };
    this.bBalloon = mk('nds-balloon', '🎈', 'Green Balloon', 'Floaty low-gravity jumps', '1', onBalloon);
    this.bApple = mk('nds-apple', '🍎', 'Apple', 'Heals 50 HP', '2', onApple);
    this.bStorm = mk('nds-storm', '🌪️', 'Bigger Storm', 'Pick & boost next disaster', '3', onStorm);
    if (onHunt) { this.bHunt = mk('nds-hunt', '🎯', 'Hunt', 'Event items · limited time', 'H', onHunt); this.bHunt.classList.add('hunt-btn'); this.bHunt.querySelector('.pr').textContent = 'EVENT'; }
    this.bApple.querySelector('.pr').textContent = `${prices.apple} BB`;
    this.bStorm.querySelector('.pr').textContent = `${prices.biggerStorm} BB`;
    this.prices = prices;
    this.pick = el('div', 'nds-pick', `<button class="x" title="Close">✕</button><h3>🌪️ Bigger Storm</h3><p>Choose next round's disaster. It hits 60% harder. ${prices.biggerStorm} BB, one round, this game only.</p><div class="grid"></div>`); this.pick.id = 'nds-storm-pick';
    this.pick.querySelector('.x').onclick = () => this.hidePick();
    const grid = this.pick.querySelector('.grid');
    for (const d of disasters) { const b = el('button', null, `<span>${d.icon}</span>${d.name}`); b.id = `nds-pick-${d.id}`; b.onclick = (e) => { e.currentTarget.blur(); onPick(d.id); }; grid.append(b); }
    this.banner = el('div', 'nds-banner');
    this.help = el('div', 'nds-help', '🌋 <b>Survive the disaster!</b> Wait in the lobby, then you\'re sent to Frostbay Island. Watch the warning, find safety: get inside, get high, or get away. Survivors earn Birg Bucks.');
    this.root.append(this.white, this.frost, this.flashEl, this.panel, this.hp, this.items, this.pick, this.banner, this.help);
    (document.getElementById('app') || document.body).append(this.root);
    const mode = () => this.root.classList.toggle('m', getDeviceMode() === 'mobile');
    mode(); this._off = onDeviceChange(mode);
    this._helpT = setTimeout(() => this.help.remove(), 14000);
  }
  setPanel(phase, main, sub, danger = false) {
    const p = this.panel; if (this._p === phase + main + sub + danger) return; this._p = phase + main + sub + danger;
    p.children[0].textContent = phase; p.children[1].textContent = main; p.children[2].textContent = sub; p.classList.toggle('danger', danger);
  }
  setHp(hp, max) {
    const f = Math.max(0, hp / max); this.hp.firstChild.style.width = `${f * 100}%`;
    this.hp.classList.toggle('mid', f <= 0.6 && f > 0.3); this.hp.classList.toggle('low', f <= 0.3);
    this.hp.lastChild.textContent = `❤ ${Math.ceil(Math.max(0, hp))} / ${max}`;
  }
  setBalloon(owned, on, price) { this.bBalloon.classList.toggle('on', !!on); this.bBalloon.querySelector('.pr').textContent = owned ? (on ? 'ON' : 'Equip') : `${price} BB`; }
  setStormQueued(name) { this.bStorm.classList.toggle('on', !!name); this.bStorm.querySelector('.pr').textContent = name ? `Next: ${name}` : `${this.prices.biggerStorm} BB`; }
  showPick() { this.pick.classList.add('show'); }
  hidePick() { this.pick.classList.remove('show'); }
  flash() { this.flashEl.classList.add('on'); requestAnimationFrame(() => requestAnimationFrame(() => this.flashEl.classList.remove('on'))); }
  whiteFlash(a = 0.8) { this.white.style.transition = 'none'; this.white.style.opacity = a; requestAnimationFrame(() => requestAnimationFrame(() => { this.white.style.transition = 'opacity .6s'; this.white.style.opacity = 0; })); }
  setFrost(a) { this.frost.style.opacity = a; }
  showBanner(title, sub = '', ms = 2800) {
    this.banner.innerHTML = `${title}${sub ? `<small>${sub}</small>` : ''}`; this.banner.classList.add('show');
    clearTimeout(this._bT); this._bT = setTimeout(() => this.banner.classList.remove('show'), ms);
  }
  dispose() { this._off?.(); clearTimeout(this._bT); clearTimeout(this._helpT); this.root.remove(); this.style.remove(); }
}
