// DOM overlay for the Giant Rainbow Obby (stage panel, skip button, gear
// hotbar, death popup, banners). Styles are injected and removed with the game,
// so no shared CSS is touched.
import { getDeviceMode, onDeviceChange } from '../../core/device.js';

const CSS = `
.gro-root{position:absolute;inset:0;pointer-events:none;z-index:12;font-family:inherit}
.gro-root button{pointer-events:auto;font-family:inherit;cursor:pointer}
.gro-stage{position:absolute;top:68px;left:50%;transform:translateX(-50%);min-width:260px;text-align:center;background:rgba(255,255,255,.92);border-radius:16px;padding:8px 18px 10px;box-shadow:0 8px 28px rgba(14,42,69,.25);border:3px solid #fff}
.gro-stage .gro-num{font-size:26px;font-weight:900;letter-spacing:.5px;background:linear-gradient(90deg,#ff4d4d,#ff9f1c,#e6c200,#2fbf4f,#2f8fff,#9b5cff);-webkit-background-clip:text;background-clip:text;color:transparent}
.gro-stage .gro-sec{font-size:12px;font-weight:800;color:#355;text-transform:uppercase;letter-spacing:1.5px}
.gro-bar{height:8px;border-radius:6px;background:#e3ecf3;margin-top:6px;overflow:hidden}
.gro-bar>i{display:block;height:100%;width:0;background:linear-gradient(90deg,#ff4d4d,#ff9f1c,#ffe14d,#4dd964,#3fa9ff,#9b5cff);transition:width .3s}
.gro-skip{position:absolute;right:16px;bottom:104px;border:0;border-radius:14px;padding:12px 16px;font-weight:900;font-size:15px;color:#fff;background:linear-gradient(180deg,#58c96b,#2e9e45);box-shadow:0 5px 0 #1f7a32,0 10px 22px rgba(0,0,0,.25)}
.gro-skip:active{transform:translateY(3px);box-shadow:0 2px 0 #1f7a32}
.gro-skip small{display:block;font-size:11px;opacity:.9}
.gro-hotbar{position:absolute;left:16px;bottom:104px;display:flex;gap:8px}
.gro-slot{width:64px;height:64px;border-radius:12px;border:3px solid rgba(255,255,255,.8);background:rgba(20,30,50,.55);color:#fff;font-size:26px;position:relative;box-shadow:0 6px 18px rgba(0,0,0,.25)}
.gro-slot.on{border-color:#ffe14d;background:rgba(60,50,10,.65)}
.gro-slot kbd{position:absolute;top:2px;left:5px;font-size:11px;font-weight:900;opacity:.9}
.gro-slot span{position:absolute;bottom:2px;left:0;right:0;font-size:9px;font-weight:800}
.gro-pop{position:absolute;left:50%;bottom:110px;transform:translate(-50%,20px);opacity:0;transition:all .25s;background:#fff;border-radius:18px;padding:14px 16px;box-shadow:0 12px 40px rgba(0,0,0,.35);border:4px solid #ffcf3f;pointer-events:none;min-width:420px}
.gro-pop.show{opacity:1;transform:translate(-50%,0);pointer-events:auto}
.gro-pop h3{margin:0 0 4px;font-size:18px;font-weight:900;color:#d2471b}
.gro-pop p{margin:0 0 10px;font-size:13px;color:#456}
.gro-offers{display:flex;gap:10px}
.gro-offer{flex:1;border:0;border-radius:14px;padding:10px 8px;background:#f2f6fb;box-shadow:inset 0 0 0 2px #dbe5ef;text-align:center;font-weight:800;color:#234}
.gro-offer:hover{background:#fff7d6}
.gro-offer .ic{font-size:28px;display:block}
.gro-offer .nm{display:block;font-size:13px}
.gro-offer .pr{display:inline-block;margin-top:6px;font-size:12px;padding:3px 10px;border-radius:10px;background:#2f8fff;color:#fff}
.gro-offer.owned .pr{background:#2e9e45}
.gro-close{position:absolute;top:6px;right:8px;border:0;background:none;font-size:18px;color:#789}
.gro-flash{position:absolute;inset:0;background:radial-gradient(circle,rgba(255,80,20,0) 30%,rgba(255,60,0,.55));opacity:0;transition:opacity .5s}
.gro-flash.on{opacity:1;transition:none}
.gro-banner{position:absolute;top:30%;left:50%;transform:translate(-50%,-50%) scale(.8);opacity:0;transition:all .4s;font-size:44px;font-weight:900;color:#fff;text-shadow:0 4px 0 rgba(0,0,0,.25),0 0 30px rgba(255,255,255,.6);white-space:nowrap;text-align:center}
.gro-banner small{display:block;font-size:18px;letter-spacing:3px}
.gro-banner.show{opacity:1;transform:translate(-50%,-50%) scale(1)}
.gro-help{position:absolute;right:16px;top:76px;background:rgba(255,255,255,.85);border-radius:12px;padding:8px 12px;font-size:12px;font-weight:700;color:#345;max-width:220px}
.gro-reset{position:absolute;right:16px;bottom:170px;border:0;border-radius:12px;padding:8px 12px;font-weight:900;font-size:13px;color:#fff;background:rgba(20,30,50,.6)}
.gro-mobile .gro-slot{width:60px;height:60px}.gro-mobile .gro-skip{padding:14px 18px}.gro-mobile .gro-reset{padding:12px 14px}
.gro-mobile .gro-help{display:none}
.gro-root button{touch-action:manipulation;-webkit-tap-highlight-color:transparent}
@media (max-width:700px){
 .gro-stage{top:100px;min-width:0;width:min(70vw,260px);padding:4px 10px 6px}
 .gro-stage .gro-num{font-size:18px}.gro-stage .gro-sec{font-size:9px}
 .gro-skip{bottom:auto;top:176px;right:8px;padding:8px 10px;font-size:12px}
 .gro-reset{bottom:auto;top:232px;right:8px}
 .gro-hotbar{left:8px;bottom:auto;top:176px;flex-direction:column}
 .gro-slot{width:52px;height:52px;font-size:22px}
 .gro-pop{min-width:0;width:calc(100vw - 24px);bottom:auto;top:50%;transform:translate(-50%,-40%);padding:10px}
 .gro-pop.show{transform:translate(-50%,-50%)}
 .gro-offers{gap:6px}.gro-offer{padding:8px 4px}.gro-offer small{display:none}
 .gro-close{font-size:24px;padding:4px 8px}
 .gro-banner{font-size:28px}.gro-help{display:none}
}
`;

const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };

export class ObbyUI {
  constructor({ gears, skipCost, onSkip, onBuy, onToggleGear, onReset, total }) {
    this.gears = gears; this.total = total;
    this.style = el('style'); this.style.textContent = CSS; document.head.append(this.style);
    this.root = el('div', 'gro-root'); this.root.id = 'gro-root';
    this.panel = el('div', 'gro-stage', `<div class="gro-sec"></div><div class="gro-num"></div><div class="gro-bar"><i></i></div>`);
    this.skip = el('button', 'gro-skip', `⏭ Skip Stage<small>${skipCost} BB</small>`); this.skip.id = 'gro-skip';
    this.skip.onclick = (e) => { e.currentTarget.blur(); onSkip(); };
    this.reset = el('button', 'gro-reset', '↺ Reset'); this.reset.id = 'gro-reset'; this.reset.title = 'Respawn at checkpoint (R)';
    this.reset.onclick = (e) => { e.currentTarget.blur(); onReset?.(); };
    this.hotbar = el('div', 'gro-hotbar'); this.hotbar.id = 'gro-hotbar';
    this.flash = el('div', 'gro-flash');
    this.banner = el('div', 'gro-banner');
    this.help = el('div', 'gro-help', 'Don\'t touch the lava! 🔥<br>Push into a truss to climb it. Checkpoints save automatically.');
    this.pop = el('div', 'gro-pop'); this.pop.id = 'gro-death-popup';
    this.pop.innerHTML = `<button class="gro-close" title="Close">✕</button><h3>Oof! Need a hand?</h3><p>Gears you buy here are yours forever, but only work in this obby.</p><div class="gro-offers"></div>`;
    this.pop.querySelector('.gro-close').onclick = () => this.hidePopup();
    this.offers = this.pop.querySelector('.gro-offers');
    for (const g of gears) {
      const b = el('button', 'gro-offer'); b.dataset.gear = g.id; b.id = `gro-buy-${g.id}`;
      b.onclick = (e) => { e.currentTarget.blur(); onBuy(g.id); };
      this.offers.append(b);
    }
    this.onToggleGear = onToggleGear;
    this.root.append(this.flash, this.panel, this.help, this.skip, this.reset, this.hotbar, this.pop, this.banner);
    document.getElementById('app').append(this.root);
    const applyMode = () => this.root.classList.toggle('gro-mobile', getDeviceMode() === 'mobile');
    applyMode(); this._offDev = onDeviceChange(applyMode);
    setTimeout(() => this.help.remove(), 12000);
  }
  setStage(stage, sectionName) {
    this.panel.querySelector('.gro-num').textContent = stage >= this.total ? `🏆 FINISHED! ${stage} / ${this.total}` : `Stage ${stage} / ${this.total}`;
    this.panel.querySelector('.gro-sec').textContent = sectionName;
    this.panel.querySelector('.gro-bar>i').style.width = `${(stage / this.total) * 100}%`;
    this.skip.style.display = stage >= this.total ? 'none' : '';
  }
  refreshGears(owned, equipped) {
    this.hotbar.innerHTML = '';
    owned.forEach((id, n) => {
      const g = this.gears.find(x => x.id === id); if (!g) return;
      const b = el('button', 'gro-slot' + (equipped === id ? ' on' : ''), `<kbd>${n + 1}</kbd>${g.icon}<span>${g.name}</span>`);
      b.id = `gro-slot-${id}`; b.title = `${g.name}: ${g.desc} (key ${n + 1})`;
      b.onclick = (e) => { e.currentTarget.blur(); this.onToggleGear(id); };
      this.hotbar.append(b);
    });
    for (const b of this.offers.children) {
      const g = this.gears.find(x => x.id === b.dataset.gear), own = owned.includes(g.id);
      b.classList.toggle('owned', own);
      b.innerHTML = `<span class="ic">${g.icon}</span><span class="nm">${g.name}</span><small>${g.desc}</small><br><span class="pr">${own ? (equipped === g.id ? 'Equipped' : 'Equip') : `${g.price} BB`}</span>`;
    }
  }
  showPopup() { this.pop.classList.add('show'); clearTimeout(this._popT); this._popT = setTimeout(() => this.hidePopup(), 9000); }
  hidePopup() { this.pop.classList.remove('show'); }
  flashDeath() { this.flash.classList.add('on'); requestAnimationFrame(() => requestAnimationFrame(() => this.flash.classList.remove('on'))); }
  showBanner(title, sub = '') {
    this.banner.innerHTML = `${title}${sub ? `<small>${sub}</small>` : ''}`; this.banner.classList.add('show');
    clearTimeout(this._bT); this._bT = setTimeout(() => this.banner.classList.remove('show'), 2600);
  }
  dispose() { if (typeof this._offDev === 'function') this._offDev(); clearTimeout(this._popT); clearTimeout(this._bT); this.root.remove(); this.style.remove(); }
}
