// Crystal Spire HUD: timer + shard counter, vertical height meter with checkpoint ticks, banners,
// float text, confetti, start card (best time + one-time tiers) and summit results. Touch buttons
// write into engine.input (KeyR reset) so keyboard + touch share one path. Styles scoped + removed.
import { getDeviceMode, onDeviceChange } from '../../core/device.js';
import { TIERS, fmtTime } from './config.js';

const CSS = `
.csp [hidden]{display:none!important}
.csp{position:absolute;inset:0;pointer-events:none;z-index:12;font-family:inherit;color:#e9f6ff}
.csp button{pointer-events:auto;font-family:inherit;cursor:pointer;touch-action:manipulation;-webkit-tap-highlight-color:transparent;user-select:none;border:0}
.csp-glass{background:linear-gradient(180deg,rgba(30,54,110,.78),rgba(16,30,70,.72));border-radius:18px;box-shadow:0 8px 26px rgba(0,10,40,.4),inset 0 0 0 2px rgba(160,220,255,.35);backdrop-filter:blur(6px)}
.csp-top{position:absolute;top:66px;left:50%;transform:translateX(-50%);display:flex;gap:14px;align-items:center;padding:8px 16px;white-space:nowrap}
.csp-time{font:900 24px/1 ui-monospace,Menlo,monospace;min-width:88px;text-align:center;text-shadow:0 0 10px #7fd4ff}
.csp-shards{font-weight:900;font-size:17px}.csp-shards.pop{animation:csp-pop .35s}
.csp-cp{font-size:12px;font-weight:800;color:#bfe0ff;letter-spacing:.04em;text-transform:uppercase}
@keyframes csp-pop{50%{transform:scale(1.45);color:#ffe08a}}
.csp-meter{position:absolute;left:18px;top:50%;transform:translateY(-50%);width:14px;height:min(52vh,360px);border-radius:8px;background:rgba(20,40,90,.55);box-shadow:inset 0 0 0 2px rgba(160,220,255,.35)}
.csp-meter>i{position:absolute;left:0;right:0;bottom:0;border-radius:8px;background:linear-gradient(0deg,#7fd4ff,#c49bff,#ff8fd0,#ffe08a);height:0;transition:height .15s}
.csp-meter>b{position:absolute;left:-5px;width:24px;height:4px;margin-bottom:-2px;border-radius:2px;background:#5a6fa8}.csp-meter>b.on{background:#ffe08a;box-shadow:0 0 8px #ffe08a}
.csp-meter>em{position:absolute;left:22px;font-style:normal;font-weight:900;font-size:12px;white-space:nowrap;margin-bottom:-8px;text-shadow:0 1px 3px #0008}
.csp-meter>u{position:absolute;left:-4px;width:22px;height:22px;margin-bottom:-11px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#fff,#7fd4ff);box-shadow:0 0 10px #7fd4ff;text-decoration:none}
.csp-banner{position:absolute;top:24%;left:50%;transform:translate(-50%,-50%);text-align:center;transition:opacity .25s,transform .25s;opacity:0}
.csp-banner.on{opacity:1;transform:translate(-50%,-50%) scale(1)}
.csp-banner h2{margin:0;font-size:42px;font-weight:900;letter-spacing:.02em;background:linear-gradient(180deg,#fff,#a9e4ff 60%,#c49bff);-webkit-background-clip:text;background-clip:text;color:transparent;filter:drop-shadow(0 3px 6px #0a1a4a)}
.csp-banner p{margin:4px 0 0;font-weight:800;font-size:16px;text-shadow:0 2px 4px #0a1a4a}
.csp-float{position:fixed;font-weight:900;font-size:18px;color:#ffe08a;text-shadow:0 2px 4px #0a1a4a;animation:csp-up 1s forwards;pointer-events:none}
@keyframes csp-up{to{transform:translateY(-50px);opacity:0}}
.csp-card{position:absolute;left:50%;top:56%;transform:translate(-50%,-50%);width:min(420px,92vw);padding:20px 22px;text-align:center;pointer-events:auto}
.csp-card h1{margin:0 0 4px;font-size:32px;font-weight:900;background:linear-gradient(180deg,#fff,#a9e4ff,#c49bff);-webkit-background-clip:text;background-clip:text;color:transparent}
.csp-card .sub{color:#bfe0ff;font-weight:700;font-size:14px;margin-bottom:12px}
.csp-tiers{display:flex;gap:8px;justify-content:center;margin:10px 0 14px}
.csp-tier{flex:1;border-radius:14px;padding:8px 4px;background:rgba(255,255,255,.08);font-weight:800;font-size:12px}.csp-tier big{display:block;font-size:24px}
.csp-tier.got{background:linear-gradient(180deg,rgba(255,224,138,.35),rgba(255,224,138,.12));box-shadow:inset 0 0 0 2px #ffe08a}
.csp-tier.new{animation:csp-pop .5s 2}
.csp-go{display:inline-block;padding:12px 34px;border-radius:16px;font-size:20px;font-weight:900;color:#102a5a;background:linear-gradient(180deg,#e8fbff,#7fd4ff);box-shadow:0 5px 0 #3f88c0}
.csp-go:active{transform:translateY(3px);box-shadow:0 2px 0 #3f88c0}
.csp-go.alt{background:linear-gradient(180deg,#f0e4ff,#c49bff);box-shadow:0 5px 0 #7d5cc0;margin-left:8px}
.csp-stat{display:flex;justify-content:space-around;font-weight:800;margin:6px 0}.csp-stat b{display:block;font-size:22px}
.csp-tip{font-size:12px;color:#9fc0ee;margin-top:12px}
.csp-reset{position:absolute;top:66px;right:14px;width:46px;height:46px;border-radius:14px;font-size:20px;color:#fff;background:rgba(30,54,110,.78);box-shadow:inset 0 0 0 2px rgba(160,220,255,.4)}
.csp.mobile .csp-reset{top:120px}
.csp.mobile .csp-top{top:58px;padding:6px 12px;gap:10px}.csp.mobile .csp-time{font-size:20px}
.csp-flash{position:absolute;inset:0;background:radial-gradient(circle,rgba(255,255,255,0) 40%,rgba(196,155,255,.55));opacity:0;transition:opacity .4s}.csp-flash.on{opacity:1;transition:none}
.csp-conf{position:fixed;width:9px;height:14px;border-radius:2px;pointer-events:none;animation:csp-fall linear forwards}
@keyframes csp-fall{to{transform:translate(var(--dx),110vh) rotate(720deg)}}
`;

export class SpireUI {
  constructor({ engine, cps, height, onStart, onReset }) {
    this.engine = engine;
    this.style = document.createElement('style'); this.style.textContent = CSS; document.head.append(this.style);
    const host = document.getElementById('app') || document.body;
    this.root = document.createElement('div'); this.root.className = 'csp'; host.append(this.root);
    this.root.innerHTML = `
      <div class="csp-flash"></div>
      <div class="csp-top csp-glass" hidden><div class="csp-time">0:00.0</div><div class="csp-shards">💎 0</div><div class="csp-cp">Base Camp</div></div>
      <div class="csp-meter" hidden><i></i>${cps.map(c => `<b style="bottom:${(c.y / height * 100).toFixed(1)}%"></b>`).join('')}<em style="bottom:100%">⛰ Summit</em><u></u></div>
      <button class="csp-reset" title="Respawn at checkpoint (R)" hidden>↺</button>
      <div class="csp-banner"><h2></h2><p></p></div>
      <div class="csp-card csp-glass" hidden></div>`;
    this.$ = (s) => this.root.querySelector(s);
    this.H = height; this.onStart = onStart;
    const rb = this.$('.csp-reset');
    rb.addEventListener('pointerdown', (e) => { e.preventDefault(); engine.input.keys?.add?.('KeyR'); setTimeout(() => engine.input.keys?.delete?.('KeyR'), 120); });
    this.applyDevice = () => this.root.classList.toggle('mobile', getDeviceMode() === 'mobile'); this.applyDevice();
    this.offDevice = onDeviceChange?.(this.applyDevice);
  }
  showRun(on) { for (const s of ['.csp-top', '.csp-meter', '.csp-reset']) this.$(s).hidden = !on; }
  setRun({ time, shards, total, cpName, y, cpLevel }) {
    this.$('.csp-time').textContent = fmtTime(time);
    const sh = this.$('.csp-shards'), txt = `💎 ${shards}/${total}`; if (sh.textContent !== txt) { sh.textContent = txt; sh.classList.remove('pop'); void sh.offsetWidth; sh.classList.add('pop'); }
    this.$('.csp-cp').textContent = cpName;
    const f = Math.max(0, Math.min(1, y / this.H)) * 100; this.$('.csp-meter>i').style.height = f + '%'; this.$('.csp-meter>u').style.bottom = f + '%';
    this.root.querySelectorAll('.csp-meter>b').forEach((b, i) => b.classList.toggle('on', i <= cpLevel));
  }
  banner(title, sub = '', ms = 1400) {
    const b = this.$('.csp-banner'); b.querySelector('h2').textContent = title; b.querySelector('p').textContent = sub; b.classList.add('on');
    clearTimeout(this._bt); this._bt = setTimeout(() => b.classList.remove('on'), ms);
  }
  floatText(text, x, y, color) { const d = document.createElement('div'); d.className = 'csp-float'; d.textContent = text; d.style.left = x + 'px'; d.style.top = y + 'px'; if (color) d.style.color = color; this.root.append(d); setTimeout(() => d.remove(), 1000); }
  flash() { const f = this.$('.csp-flash'); f.classList.add('on'); requestAnimationFrame(() => requestAnimationFrame(() => f.classList.remove('on'))); }
  confetti(n = 90) { const cols = ['#7fd4ff', '#c49bff', '#ff8fd0', '#4ff0d0', '#ffe08a', '#fff'];
    for (let i = 0; i < n; i++) { const d = document.createElement('div'); d.className = 'csp-conf'; d.style.left = Math.random() * 100 + 'vw'; d.style.top = -20 - Math.random() * 120 + 'px'; d.style.background = cols[i % 6]; d.style.setProperty('--dx', (Math.random() - 0.5) * 200 + 'px'); d.style.animationDuration = 1.8 + Math.random() * 1.6 + 's'; this.root.append(d); setTimeout(() => d.remove(), 3600); } }
  tiersHtml(save, fresh = []) { return `<div class="csp-tiers">${TIERS.map(t => `<div class="csp-tier ${save.claimed.includes(t.id) ? 'got' : ''} ${fresh.includes(t.id) ? 'new' : ''}"><big>${t.icon}</big>${t.name}<br>${t.maxTime === Infinity ? 'Reach summit' : 'Under ' + fmtTime(t.maxTime).replace('.0', '')}<br>${save.claimed.includes(t.id) && !fresh.includes(t.id) ? '✓ claimed' : '+' + t.bb + ' BB'}</div>`).join('')}</div>`; }
  showStart(save, loading) {
    const c = this.$('.csp-card'); c.hidden = false;
    c.innerHTML = `<h1>Crystal Spire</h1><div class="sub">Climb the frozen needle. Race the light to the summit beacon.</div>
      <div class="csp-stat"><div><b>${fmtTime(save.best)}</b>Best time</div><div><b>${save.bestShards}</b>Best 💎</div><div><b>${save.clears}</b>Summits</div></div>
      ${this.tiersHtml(save)}
      <button class="csp-go">${loading ? 'Loading…' : 'Climb! ⛰'}</button>
      <div class="csp-tip">${getDeviceMode() === 'mobile' ? 'Joystick to move · Jump button to leap · ↺ respawns' : 'WASD move · Space jump · R respawn · Enter to start'}<br>Cyan ledges are slippery · violet panes vanish · bridges have gusts</div>`;
    c.querySelector('.csp-go').addEventListener('click', () => { if (!loading) this.onStart(); });
  }
  hideCard() { this.$('.csp-card').hidden = true; }
  showResult(r, save, { onAgain, onLobby }) {
    const c = this.$('.csp-card'); c.hidden = false;
    c.innerHTML = `<h1>${'★'.repeat(r.stars)}${'☆'.repeat(3 - r.stars)}</h1><div class="sub">${r.newBest ? '✨ New best time! ✨' : 'Summit reached!'}</div>
      <div class="csp-stat"><div><b>${fmtTime(r.time)}</b>Time</div><div><b>${r.shards}/${r.total}</b>💎 Shards</div><div><b>${r.deaths}</b>Shatters</div></div>
      ${this.tiersHtml(save, r.newTiers.map(t => t.id))}
      ${r.reward ? `<div class="sub" style="color:#ffe08a;font-size:18px">+${r.reward} Birg Bucks!</div>` : ''}
      <button class="csp-go">Climb again</button><button class="csp-go alt">Base camp</button>`;
    c.querySelector('.csp-go').addEventListener('click', onAgain); c.querySelector('.csp-go.alt').addEventListener('click', onLobby);
  }
  dispose() { clearTimeout(this._bt); this.offDevice?.(); this.root.remove(); this.style.remove(); }
}
