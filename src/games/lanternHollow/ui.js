// Lantern Hollow HUD ("lantern-glass" theme: warm amber glass on deep indigo). Scoped .lh-* CSS, mounted in #app,
// removed on dispose. Phase 1: hearts, glow ring + Power, embers, area banner, quest tracker, interaction prompt,
// NPC panel placeholder, mobile action cluster (writes into engine.input so keyboard + touch share one path).
import { getDeviceMode, onDeviceChange } from '../../core/device.js';

const CSS = `
.lh{position:absolute;inset:0;pointer-events:none;z-index:12;font-family:inherit;color:#fff4e0}
.lh [hidden]{display:none!important}
.lh button{pointer-events:auto;font-family:inherit;cursor:pointer;touch-action:manipulation;-webkit-tap-highlight-color:transparent;user-select:none;border:0}
.lh-glass{background:linear-gradient(180deg,rgba(44,30,70,.82),rgba(22,16,44,.78));border-radius:16px;box-shadow:0 8px 24px rgba(5,2,20,.45),inset 0 0 0 2px rgba(255,190,110,.35);backdrop-filter:blur(6px)}
.lh-vitals{position:absolute;top:66px;left:14px;display:flex;align-items:center;gap:10px;padding:8px 14px 8px 8px}
.lh-lamp{position:relative;width:52px;height:52px;border-radius:50%;display:grid;place-items:center;font-size:24px;
  background:conic-gradient(#ffb347 var(--g,100%),rgba(255,255,255,.12) 0);box-shadow:0 0 14px rgba(255,170,70,.55)}
.lh-lamp::after{content:'';position:absolute;inset:5px;border-radius:50%;background:#2a1c44}
.lh-lamp span{position:relative;z-index:1}
.lh-hearts{font-size:20px;letter-spacing:1px;text-shadow:0 2px 3px #0008}
.lh-power{font-size:11px;font-weight:900;letter-spacing:.08em;color:#ffcf8a;text-transform:uppercase}
.lh-embers{position:absolute;top:66px;left:50%;transform:translateX(-50%);padding:8px 16px;font-weight:900;font-size:18px;white-space:nowrap}
.lh-embers small{font-size:12px;color:#ffcf8a;font-weight:800;margin-left:6px}
.lh-track{position:absolute;top:130px;right:14px;width:min(250px,44vw);padding:10px 12px}
.lh-track h4{margin:0 0 6px;font-size:11px;letter-spacing:.12em;color:#ffcf8a;text-transform:uppercase}
.lh-q{font-size:13px;font-weight:800;margin:6px 0}.lh-q i{display:block;height:5px;border-radius:3px;margin-top:3px;background:rgba(255,255,255,.15);overflow:hidden}
.lh-q i b{display:block;height:100%;background:linear-gradient(90deg,#ff7a3d,#ffd27a)}
.lh-banner{position:absolute;top:22%;left:50%;transform:translate(-50%,-50%) scale(.96);text-align:center;opacity:0;transition:opacity .4s,transform .4s}
.lh-banner.on{opacity:1;transform:translate(-50%,-50%) scale(1)}
.lh-banner h2{margin:0;font-size:44px;font-weight:900;letter-spacing:.03em;background:linear-gradient(180deg,#fff7e6,#ffcf7a 55%,#ff8a4a);-webkit-background-clip:text;background-clip:text;color:transparent;filter:drop-shadow(0 3px 8px #12062a)}
.lh-banner p{margin:4px 0 0;font-weight:800;font-size:15px;color:#ffe2b8;text-shadow:0 2px 4px #12062a}
.lh-prompt{position:absolute;left:50%;bottom:110px;transform:translateX(-50%);padding:10px 18px;font-weight:900;font-size:16px;white-space:nowrap}
.lh-prompt kbd{display:inline-block;min-width:26px;padding:2px 7px;margin-right:8px;border-radius:8px;background:#ffcf7a;color:#2a1c44;font:900 14px/1.4 inherit}
.lh-panel{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:min(440px,92vw);padding:20px 22px;text-align:center;pointer-events:auto}
.lh-panel h3{margin:0 0 4px;font-size:26px;font-weight:900;color:#ffd9a0}.lh-panel p{margin:8px 0 14px;color:#ffe8c8;font-weight:700;line-height:1.4}
.lh-btn{display:inline-block;padding:11px 28px;border-radius:14px;font-size:17px;font-weight:900;color:#2a1c44;background:linear-gradient(180deg,#fff0d0,#ffb347);box-shadow:0 5px 0 #b8662a}
.lh-btn:active{transform:translateY(3px);box-shadow:0 2px 0 #b8662a}
.lh-keys{position:absolute;left:14px;bottom:64px;font-size:12px;font-weight:700;color:#ffe2b8;opacity:.85;padding:8px 12px}
.lh-touch{position:absolute;right:130px;bottom:30px;width:200px;height:200px}
.lh-touch button{position:absolute;border-radius:50%;color:#fff;font-weight:900;font-size:13px;background:rgba(60,36,90,.6);box-shadow:inset 0 0 0 2px rgba(255,200,130,.6);display:grid;place-items:center}
.lh-touch button.on{background:rgba(255,160,70,.75)}
.lh-atk{width:84px;height:84px;right:0;bottom:84px;font-size:30px!important;background:rgba(255,140,60,.55)!important}
.lh-dash{width:62px;height:62px;right:92px;bottom:40px}
.lh-flare{width:62px;height:62px;right:92px;bottom:118px}
.lh-act{width:62px;height:62px;right:10px;bottom:178px}
`;

export class HollowUI {
  constructor({ engine, onClosePanel, onTap }) {
    this.engine = engine; this.onClosePanel = onClosePanel; this.onTap = onTap;
    this.style = document.createElement('style'); this.style.textContent = CSS; document.head.append(this.style);
    const host = document.getElementById('app') || document.body;
    this.root = document.createElement('div'); this.root.className = 'lh'; host.append(this.root);
    this.root.innerHTML = `
      <div class="lh-vitals lh-glass"><div class="lh-lamp"><span>🏮</span></div><div><div class="lh-hearts"></div><div class="lh-power"></div></div></div>
      <div class="lh-embers lh-glass">🔥 <span class="lh-e">0</span><small class="lh-c"></small></div>
      <div class="lh-track lh-glass"><h4>Quests</h4><div class="lh-ql"></div></div>
      <div class="lh-banner"><h2></h2><p></p></div>
      <div class="lh-prompt lh-glass" hidden></div>
      <div class="lh-panel lh-glass" hidden><h3></h3><p></p><button class="lh-btn">OK</button></div>
      <div class="lh-keys lh-glass">WASD move · Space jump · Click/K attack · Shift dash · Q flare · E interact</div>
      <div class="lh-touch" hidden><button class="lh-atk" data-k="KeyK">⚔</button><button class="lh-dash" data-k="ShiftLeft">DASH</button><button class="lh-flare" data-k="KeyQ">FLARE</button><button class="lh-act" data-k="KeyE">E</button></div>`;
    const q = (s) => this.root.querySelector(s);
    this.el = { hearts: q('.lh-hearts'), power: q('.lh-power'), lamp: q('.lh-lamp'), embers: q('.lh-e'), carried: q('.lh-c'), ql: q('.lh-ql'), banner: q('.lh-banner'),
      prompt: q('.lh-prompt'), panel: q('.lh-panel'), touch: q('.lh-touch'), keys: q('.lh-keys') };
    q('.lh-panel .lh-btn').addEventListener('click', () => this.closePanel());
    // touch buttons press/release keys in engine.input (same path as keyboard)
    for (const b of this.el.touch.querySelectorAll('button')) {
      const set = (on) => (e) => { const k = b.dataset.k; if (on) { engine.input.keys.add(k); this.onTap?.(k); } else engine.input.keys.delete(k); b.classList.toggle('on', on); e.preventDefault(); };
      b.addEventListener('pointerdown', set(true)); for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) b.addEventListener(ev, set(false));
    }
    this.syncDevice(); this.offDevice = onDeviceChange(() => this.syncDevice());
  }
  syncDevice() { const m = getDeviceMode() === 'mobile'; this.el.touch.hidden = !m; this.el.keys.hidden = m; }
  setVitals({ hp, maxHp, glow, maxGlow, power }) {
    const full = Math.floor(hp / 2), half = hp % 2, empty = Math.max(0, Math.ceil(maxHp / 2) - full - half);
    const s = '❤️'.repeat(full) + (half ? '💔' : '') + '🖤'.repeat(empty);
    if (s !== this._h) { this._h = s; this.el.hearts.textContent = s; }
    this.el.lamp.style.setProperty('--g', `${Math.round(glow / maxGlow * 100)}%`);
    const p = `Power ${power}`; if (p !== this._p) { this._p = p; this.el.power.textContent = p; }
  }
  setEmbers(banked, carried) { this.el.embers.textContent = banked; this.el.carried.textContent = carried ? `+${carried} carried` : ''; }
  setQuests(rows) { const html = rows.map(r => `<div class="lh-q">${r.title} <span style="float:right;color:#ffcf8a">${r.p}/${r.goal}</span><i><b style="width:${Math.min(100, r.p / r.goal * 100)}%"></b></i></div>`).join('') || '<div class="lh-q" style="opacity:.7">Visit the Quest Board</div>';
    if (html !== this._q) { this._q = html; this.el.ql.innerHTML = html; } }
  banner(title, sub = '', ms = 2600) { const b = this.el.banner; b.querySelector('h2').textContent = title; b.querySelector('p').textContent = sub; b.classList.add('on'); clearTimeout(this._bt); this._bt = setTimeout(() => b.classList.remove('on'), ms); }
  prompt(text, key = 'E') { const p = this.el.prompt; if (!text) { p.hidden = true; this._pr = null; return; } const k = getDeviceMode() === 'mobile' ? '👆' : key; const h = `<kbd>${k}</kbd>${text}`; if (h !== this._pr) { this._pr = h; p.innerHTML = h; } p.hidden = false; }
  openPanel(title, body) { const p = this.el.panel; p.querySelector('h3').textContent = title; p.querySelector('p').textContent = body; p.hidden = false; }
  get panelOpen() { return !this.el.panel.hidden; }
  closePanel() { this.el.panel.hidden = true; this.onClosePanel?.(); }
  dispose() { this.offDevice?.(); clearTimeout(this._bt); this.root.remove(); this.style.remove(); for (const k of ['KeyK', 'ShiftLeft', 'KeyQ', 'KeyE']) this.engine.input.keys.delete(k); }
}
