// Lantern Hollow UI ("lantern-glass": warm amber glass on deep indigo). Scoped .lh-* CSS in #app, removed on dispose.
// HUD: hearts + glow ring + dash pips + Power, embers (banked/carried) + materials, quest tracker, boss bar, area chip,
// prompts with hold-progress, damage numbers, toasts, banners, fade, hurt/low-glow/downed vignettes, ally frames.
// Modals: quest board / givers, forge & lamplighter & apothecary upgrades, hearth, waystone, journal, party, result cards.
// Touch buttons write into engine.input (same codes as the keyboard) so one input path serves desktop + mobile.
import { getDeviceMode, onDeviceChange } from '../../core/device.js';
import { MAT_INFO } from './config.js';

const CSS = `
.lh{position:absolute;inset:0;pointer-events:none;z-index:12;font-family:inherit;color:#fff4e0}
.lh [hidden]{display:none!important}
.lh button{pointer-events:auto;font-family:inherit;cursor:pointer;touch-action:manipulation;-webkit-tap-highlight-color:transparent;user-select:none;border:0;color:inherit}
.lh-glass{background:linear-gradient(180deg,rgba(46,30,74,.84),rgba(22,15,44,.8));border-radius:16px;box-shadow:0 8px 24px rgba(5,2,20,.45),inset 0 0 0 1.5px rgba(255,190,110,.38);backdrop-filter:blur(6px)}
.lh-vitals{position:absolute;top:66px;left:14px;display:flex;align-items:center;gap:10px;padding:8px 14px 8px 8px}
.lh-lamp{position:relative;width:54px;height:54px;border-radius:50%;display:grid;place-items:center;font-size:24px;background:conic-gradient(#ffb347 var(--g,100%),rgba(255,255,255,.12) 0);box-shadow:0 0 16px rgba(255,170,70,var(--gl,.55));transition:box-shadow .2s}
.lh-lamp::after{content:'';position:absolute;inset:5px;border-radius:50%;background:radial-gradient(circle at 50% 40%,#3a2858,#1e1436)}
.lh-lamp span{position:relative;z-index:1}.lh-lamp.flare{box-shadow:0 0 28px #ffd27a,0 0 6px #fff}.lh-lamp.low span{animation:lh-blink .6s infinite}
.lh-hearts{font-size:19px;letter-spacing:1px;text-shadow:0 2px 3px #0008;line-height:1.1}.lh-hearts.hit{animation:lh-shake .3s}
.lh-sub{display:flex;gap:8px;align-items:center;margin-top:3px}
.lh-power{font-size:11px;font-weight:900;letter-spacing:.08em;color:#ffcf8a;text-transform:uppercase}
.lh-dash{display:flex;gap:3px}.lh-dash i{width:16px;height:6px;border-radius:3px;background:rgba(255,255,255,.18)}.lh-dash i.on{background:linear-gradient(90deg,#9fe8ff,#fff)}
.lh-tonic{font-size:12px;font-weight:900;color:#c9ffd8}
.lh-menu{position:absolute;top:140px;left:14px;display:flex;gap:6px}
.lh-menu button{padding:7px 11px;border-radius:12px;font-size:13px;font-weight:900;position:relative}
.lh-menu button b{position:absolute;top:-5px;right:-5px;min-width:16px;height:16px;border-radius:8px;background:#ff7a3d;font-size:10px;line-height:16px;text-align:center}
.lh-allies{position:absolute;top:184px;left:14px;display:flex;flex-direction:column;gap:5px}
.lh-ally{padding:5px 10px;font-size:12px;font-weight:800;min-width:140px}.lh-ally i{display:block;height:4px;border-radius:2px;background:rgba(255,255,255,.15);margin-top:3px;overflow:hidden}.lh-ally i b{display:block;height:100%;background:#ff6a6a}
.lh-ally.down{box-shadow:inset 0 0 0 2px #ff5a5a;animation:lh-pulse 1s infinite}
.lh-embers{position:absolute;top:66px;left:50%;transform:translateX(-50%);padding:7px 16px;font-weight:900;font-size:18px;white-space:nowrap;display:flex;gap:12px;align-items:center}
.lh-embers small{font-size:12px;color:#ffcf8a;font-weight:800}.lh-embers .mat{font-size:13px;opacity:.9}.lh-embers .pop{animation:lh-pop .35s}
.lh-area{position:absolute;top:112px;left:50%;transform:translateX(-50%);font-size:11px;font-weight:900;letter-spacing:.14em;text-transform:uppercase;color:#ffd9a0;text-shadow:0 1px 4px #000}
.lh-track{position:absolute;top:130px;right:14px;width:min(250px,44vw);padding:10px 12px}
.lh-track h4{margin:0 0 4px;font-size:11px;letter-spacing:.12em;color:#ffcf8a;text-transform:uppercase}
.lh-q{font-size:13px;font-weight:800;margin:6px 0}.lh-q.ready{color:#9dffb0}.lh-q span{float:right;color:#ffcf8a}
.lh-q i{display:block;height:5px;border-radius:3px;margin-top:3px;background:rgba(255,255,255,.15);overflow:hidden}.lh-q i b{display:block;height:100%;background:linear-gradient(90deg,#ff7a3d,#ffd27a);transition:width .3s}
.lh-q.pulse{animation:lh-pop .4s}
.lh-boss{position:absolute;left:50%;bottom:118px;transform:translateX(-50%);width:min(560px,80vw);text-align:center}
.lh-boss h3{margin:0 0 4px;font-size:15px;font-weight:900;letter-spacing:.1em;text-transform:uppercase;color:#ffc6ea;text-shadow:0 2px 6px #000}
.lh-boss .bar{height:14px;border-radius:8px;background:rgba(20,8,30,.75);box-shadow:inset 0 0 0 2px rgba(255,160,220,.45);overflow:hidden;position:relative}
.lh-boss .bar b{display:block;height:100%;background:linear-gradient(90deg,#a02a8a,#ff6ad0,#ffd2f0);transition:width .25s}
.lh-boss .bar em{position:absolute;left:50%;top:0;bottom:0;width:2px;background:#fff8}.lh-boss .st{font-size:12px;font-weight:900;color:#fff08a;margin-top:3px;min-height:15px}
.lh-banner{position:absolute;top:24%;left:50%;transform:translate(-50%,-50%) scale(.96);text-align:center;opacity:0;transition:opacity .4s,transform .4s;pointer-events:none}
.lh-banner.on{opacity:1;transform:translate(-50%,-50%) scale(1)}
.lh-banner h2{margin:0;font-size:46px;font-weight:900;letter-spacing:.03em;background:linear-gradient(180deg,#fff7e6,#ffcf7a 55%,#ff8a4a);-webkit-background-clip:text;background-clip:text;color:transparent;filter:drop-shadow(0 3px 8px #12062a)}
.lh-banner p{margin:4px 0 0;font-weight:800;font-size:15px;color:#ffe2b8;text-shadow:0 2px 4px #12062a}
.lh-prompt{position:absolute;left:50%;bottom:118px;transform:translateX(-50%);padding:9px 18px;font-weight:900;font-size:16px;white-space:nowrap;display:flex;align-items:center;gap:10px}
.lh-prompt kbd{display:inline-block;min-width:26px;padding:2px 7px;border-radius:8px;background:#ffcf7a;color:#2a1c44;font:900 14px/1.4 inherit;text-align:center}
.lh-prompt .ring{width:26px;height:26px;border-radius:50%;background:conic-gradient(#9dffb0 var(--p,0%),rgba(255,255,255,.15) 0)}
.lh-toasts{position:absolute;right:14px;bottom:130px;display:flex;flex-direction:column;gap:6px;align-items:flex-end}
.lh-toast{padding:8px 14px;font-weight:800;font-size:14px;animation:lh-in .25s,lh-out .4s 2.6s forwards}
.lh-float{position:fixed;font-weight:900;font-size:19px;color:#ffe08a;text-shadow:0 2px 3px #12062a,0 0 8px rgba(0,0,0,.5);animation:lh-up .9s forwards;pointer-events:none;white-space:nowrap}
.lh-float.crit{font-size:26px;color:#ff9a3c}.lh-float.hurt{color:#ff6a6a}.lh-float.gain{color:#ffd27a;font-size:15px}.lh-float.immune{color:#b9a6ff;font-size:14px}
.lh-vig{position:absolute;inset:0;pointer-events:none;transition:opacity .3s;opacity:0}
.lh-vig.hurt{background:radial-gradient(ellipse at center,transparent 55%,rgba(255,40,40,.45))}
.lh-vig.dark{background:radial-gradient(ellipse at center,transparent 35%,rgba(5,0,15,.75))}
.lh-vig.down{background:radial-gradient(ellipse at center,rgba(40,0,10,.15) 20%,rgba(30,0,10,.8));}
.lh-downed{position:absolute;left:50%;top:40%;transform:translate(-50%,-50%);text-align:center}
.lh-downed h2{margin:0;font-size:34px;font-weight:900;color:#ffb0a0;text-shadow:0 3px 10px #000}.lh-downed p{margin:6px 0 0;font-weight:800;color:#ffe2d0}
.lh-downed .ring{width:70px;height:70px;margin:12px auto 0;border-radius:50%;background:conic-gradient(#ff7a5a var(--p,100%),rgba(255,255,255,.12) 0);display:grid;place-items:center;font-weight:900}
.lh-fade{position:absolute;inset:0;background:#07040f;opacity:0;transition:opacity .45s;pointer-events:none}.lh-fade.on{opacity:1}
.lh-modal{position:absolute;left:50%;top:52%;transform:translate(-50%,-50%);width:min(620px,94vw);max-height:min(78vh,640px);display:flex;flex-direction:column;pointer-events:auto;animation:lh-in .2s}
.lh-mh{display:flex;align-items:center;gap:12px;padding:16px 18px 10px}.lh-mh .ic{font-size:34px;filter:drop-shadow(0 2px 6px #ff9a3c88)}
.lh-mh h3{margin:0;font-size:24px;font-weight:900;color:#ffd9a0}.lh-mh p{margin:2px 0 0;font-size:13px;font-weight:700;color:#e8d4ff;opacity:.9}
.lh-mh .x{margin-left:auto;width:36px;height:36px;border-radius:12px;background:rgba(255,255,255,.08);font-size:18px;font-weight:900}
.lh-mb{padding:4px 18px 18px;overflow:auto}
.lh-say{margin:0 0 12px;padding:10px 12px;border-radius:12px;background:rgba(255,200,120,.08);font-style:italic;color:#ffe8c8;font-weight:600;line-height:1.4}
.lh-card{display:flex;gap:12px;align-items:center;padding:12px;border-radius:14px;background:rgba(255,255,255,.06);margin-bottom:8px;box-shadow:inset 0 0 0 1px rgba(255,200,140,.12)}
.lh-card.ready{box-shadow:inset 0 0 0 2px #9dffb0;background:rgba(120,255,160,.08)}.lh-card.locked{opacity:.55}.lh-card.done{opacity:.6}
.lh-card .ic{font-size:28px;width:40px;text-align:center}.lh-card .mid{flex:1;min-width:0}.lh-card h4{margin:0;font-size:16px;font-weight:900}
.lh-card .d{font-size:12.5px;color:#e8d8f8;margin-top:2px;line-height:1.35}.lh-card .meta{font-size:12px;font-weight:800;color:#ffcf8a;margin-top:4px}
.lh-pips{display:flex;gap:3px;margin-top:5px}.lh-pips i{width:18px;height:6px;border-radius:3px;background:rgba(255,255,255,.15)}.lh-pips i.on{background:linear-gradient(90deg,#ff9a3c,#ffd27a)}
.lh-chip{display:inline-block;padding:2px 8px;border-radius:9px;background:rgba(0,0,0,.25);font-size:12px;font-weight:900;margin:3px 4px 0 0}.lh-chip.no{color:#ff9a8a}.lh-chip.ok{color:#bfffc8}
.lh-pbar{height:6px;border-radius:3px;background:rgba(255,255,255,.12);margin-top:6px;overflow:hidden}.lh-pbar b{display:block;height:100%;background:linear-gradient(90deg,#ff7a3d,#ffd27a)}
.lh-btn{padding:10px 18px;border-radius:13px;font-size:15px;font-weight:900;color:#2a1c44!important;background:linear-gradient(180deg,#fff0d0,#ffb347);box-shadow:0 4px 0 #b8662a;white-space:nowrap}
.lh-btn:active{transform:translateY(3px);box-shadow:0 1px 0 #b8662a}.lh-btn[disabled]{filter:grayscale(.8) brightness(.7);cursor:default}
.lh-btn.alt{background:linear-gradient(180deg,#e9f9ff,#7fd4ff);box-shadow:0 4px 0 #3f88c0}.lh-btn.go{background:linear-gradient(180deg,#eaffef,#7dffa0);box-shadow:0 4px 0 #3aa860}
.lh-tabs{display:flex;gap:6px;margin-bottom:10px}.lh-tabs button{padding:6px 12px;border-radius:10px;background:rgba(255,255,255,.07);font-weight:900;font-size:13px}.lh-tabs button.on{background:#ffb347;color:#2a1c44}
.lh-res{text-align:center}.lh-res .big{font-size:56px}.lh-res .loot{display:flex;flex-wrap:wrap;justify-content:center;gap:6px;margin:10px 0 14px}
.lh-mopen .lh-keys{display:none}.lh-keys{position:absolute;left:14px;bottom:64px;font-size:12px;font-weight:700;color:#ffe2b8;opacity:.85;padding:7px 12px}
.lh-touch{position:absolute;right:124px;bottom:26px;width:230px;height:240px}
.lh-touch button{position:absolute;border-radius:50%;color:#fff;font-weight:900;font-size:12px;background:rgba(60,36,90,.62);box-shadow:inset 0 0 0 2px rgba(255,200,130,.6);display:grid;place-items:center}
.lh-touch button.on{background:rgba(255,160,70,.8)}
.lh-t-atk{width:88px;height:88px;right:0;bottom:100px;font-size:32px!important;background:rgba(255,140,60,.6)!important}
.lh-t-dash{width:62px;height:62px;right:98px;bottom:50px}.lh-t-flare{width:62px;height:62px;right:100px;bottom:128px}
.lh-t-act{width:60px;height:60px;right:14px;bottom:196px;font-size:18px!important}.lh-t-tonic{width:46px;height:46px;right:170px;bottom:10px;font-size:18px!important}
@keyframes lh-up{to{transform:translateY(-46px);opacity:0}}@keyframes lh-pop{50%{transform:scale(1.35)}}@keyframes lh-in{from{opacity:0;transform:translate(-50%,-46%)}}
.lh-toast{animation-name:lh-tin,lh-out}@keyframes lh-tin{from{opacity:0;transform:translateX(20px)}}@keyframes lh-out{to{opacity:0;transform:translateX(20px)}}
@keyframes lh-shake{25%{transform:translateX(-4px)}75%{transform:translateX(4px)}}@keyframes lh-blink{50%{opacity:.35}}@keyframes lh-pulse{50%{opacity:.6}}
`;
const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export const costChips = (cost, save) => Object.entries(cost).map(([k, v]) => { const have = k === 'embers' ? save.embers : save.mats[k] || 0; return `<span class="lh-chip ${have >= v ? 'ok' : 'no'}">${MAT_INFO[k][0]} ${v}</span>`; }).join('');
export const rewardChips = (r) => Object.entries(r).map(([k, v]) => `<span class="lh-chip">${k === 'charm' ? '🧿 Charm' : k === 'title' ? `🏷 “${esc(v)}”` : k === 'tonics' ? `🧪 ${v}` : k === 'oil' ? `🛢 ${v}` : `${MAT_INFO[k]?.[0] || ''} ${v}`}</span>`).join('');

export class HollowUI {
  constructor({ engine, onAct, onTap, onCloseModal }) {
    this.engine = engine; this.onAct = onAct; this.onTap = onTap; this.onCloseModal = onCloseModal;
    this.style = document.createElement('style'); this.style.textContent = CSS; document.head.append(this.style);
    const host = document.getElementById('app') || document.body;
    this.root = document.createElement('div'); this.root.className = 'lh'; host.append(this.root);
    this.root.innerHTML = `
      <div class="lh-vig hurt"></div><div class="lh-vig dark"></div><div class="lh-vig down"></div>
      <div class="lh-vitals lh-glass"><div class="lh-lamp"><span>🏮</span></div><div><div class="lh-hearts"></div><div class="lh-sub"><span class="lh-power"></span><span class="lh-dash"></span><span class="lh-tonic"></span></div></div></div>
      <div class="lh-menu"><button class="lh-glass" data-act="journal">📜 Quests<b hidden></b></button><button class="lh-glass" data-act="party">👥 Party</button></div>
      <div class="lh-allies"></div>
      <div class="lh-embers lh-glass"><span>🔥 <span class="lh-e">0</span></span><small class="lh-c"></small><span class="mat lh-m"></span></div>
      <div class="lh-area"></div>
      <div class="lh-track lh-glass"><h4>Quests</h4><div class="lh-ql"></div></div>
      <div class="lh-boss" hidden><h3></h3><div class="bar"><b></b><em></em></div><div class="st"></div></div>
      <div class="lh-banner"><h2></h2><p></p></div>
      <div class="lh-prompt lh-glass" hidden></div>
      <div class="lh-toasts"></div>
      <div class="lh-downed" hidden><h2>Your lantern gutters…</h2><p></p><div class="ring"></div></div>
      <div class="lh-modal lh-glass" hidden><div class="lh-mh"><span class="ic"></span><div><h3></h3><p></p></div><button class="x" data-act="close">✕</button></div><div class="lh-mb"></div></div>
      <div class="lh-keys lh-glass">WASD move · Click/K attack · Shift dash · hold Q flare · E interact · R tonic · J quests · P party</div>
      <div class="lh-touch" hidden><button class="lh-t-atk" data-k="KeyK">⚔</button><button class="lh-t-dash" data-k="ShiftLeft">DASH</button><button class="lh-t-flare" data-k="KeyQ">FLARE</button><button class="lh-t-act" data-k="KeyE">✋</button><button class="lh-t-tonic" data-k="KeyR">🧪</button></div>
      <div class="lh-fade"></div>`;
    const q = (s) => this.root.querySelector(s); this.q = q;
    this.el = { hearts: q('.lh-hearts'), power: q('.lh-power'), dash: q('.lh-dash'), tonic: q('.lh-tonic'), lamp: q('.lh-lamp'), embers: q('.lh-e'), carried: q('.lh-c'), mats: q('.lh-m'), area: q('.lh-area'),
      ql: q('.lh-ql'), track: q('.lh-track'), banner: q('.lh-banner'), prompt: q('.lh-prompt'), modal: q('.lh-modal'), touch: q('.lh-touch'), keys: q('.lh-keys'), boss: q('.lh-boss'), toasts: q('.lh-toasts'),
      downed: q('.lh-downed'), fade: q('.lh-fade'), allies: q('.lh-allies'), vHurt: q('.lh-vig.hurt'), vDark: q('.lh-vig.dark'), vDown: q('.lh-vig.down'), jBadge: q('.lh-menu b') };
    this.root.addEventListener('click', (e) => { const b = e.target.closest('[data-act]'); if (!b || b.disabled) return; e.stopPropagation(); const act = b.dataset.act; if (act === 'close') return this.closeModal(); this.onAct?.(act, b.dataset.v, b); });
    for (const b of this.el.touch.querySelectorAll('button')) {
      const set = (on) => (e) => { const k = b.dataset.k; if (on) { engine.input.keys.add(k); this.onTap?.(k); } else engine.input.keys.delete(k); b.classList.toggle('on', on); e.preventDefault(); };
      b.addEventListener('pointerdown', set(true)); for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) b.addEventListener(ev, set(false));
    }
    this.syncDevice(); this.offDevice = onDeviceChange(() => this.syncDevice());
  }
  syncDevice() { const m = getDeviceMode() === 'mobile'; this.el.touch.hidden = !m; this.el.keys.hidden = m; }
  _set(el, key, html) { if (this['_' + key] !== html) { this['_' + key] = html; el.innerHTML = html; } }
  setVitals({ hp, maxHp, glow, maxGlow, power, flaring, dashCharges, dashMax, tonics, title }) {
    const full = Math.floor(hp / 2), half = hp % 2, empty = Math.max(0, Math.ceil(maxHp / 2) - full - half);
    const s = '❤️'.repeat(full) + (half ? '💔' : '') + '🖤'.repeat(empty);
    if (this._h && s !== this._h && hp < this._hp) { this.el.hearts.classList.remove('hit'); void this.el.hearts.offsetWidth; this.el.hearts.classList.add('hit'); }
    this._hp = hp; if (s !== this._h) { this._h = s; this.el.hearts.textContent = s; }
    const g = glow / maxGlow; this.el.lamp.style.setProperty('--g', `${Math.round(g * 100)}%`); this.el.lamp.style.setProperty('--gl', (0.25 + g * 0.5).toFixed(2));
    this.el.lamp.classList.toggle('flare', !!flaring); this.el.lamp.classList.toggle('low', g < 0.2);
    this._set(this.el.power, 'pw', `${title ? esc(title) + ' · ' : ''}Power ${power}`);
    this._set(this.el.dash, 'dp', Array.from({ length: dashMax }, (_, i) => `<i class="${i < dashCharges ? 'on' : ''}"></i>`).join(''));
    this._set(this.el.tonic, 'tn', `🧪${tonics}`);
    this.el.vDark.style.opacity = g < 0.15 ? (0.15 - g) / 0.15 : 0;
  }
  setEmbers(banked, carried, mats) {
    if (this._eb !== banked) { this._eb = banked; this.el.embers.textContent = banked; this.el.embers.parentElement.classList.remove('pop'); void this.el.embers.offsetWidth; this.el.embers.parentElement.classList.add('pop'); }
    this._set(this.el.carried, 'ec', carried ? `+${carried} carried` : '');
    this._set(this.el.mats, 'em', Object.entries(mats).filter(([, v]) => v > 0).map(([k, v]) => `${MAT_INFO[k][0]}${v}`).join(' '));
  }
  setArea(name) { this._set(this.el.area, 'ar', esc(name)); }
  setQuests(rows, badge) {
    this._set(this.el.ql, 'q', rows.map(r => `<div class="lh-q ${r.ready ? 'ready' : ''}">${esc(r.title)} <span>${r.ready ? '✔ turn in' : `${r.p}/${r.goal}`}</span><i><b style="width:${Math.min(100, r.p / r.goal * 100)}%"></b></i></div>`).join('') || '<div class="lh-q" style="opacity:.75">Visit Elder Wick by the Quest Board</div>');
    this.el.jBadge.hidden = !badge; if (badge) this.el.jBadge.textContent = badge;
  }
  setBoss(b) { const e = this.el.boss; if (!b) { e.hidden = true; return; } e.hidden = false; this._set(e.querySelector('h3'), 'bn', esc(b.name)); e.querySelector('b').style.width = `${Math.max(0, b.hp / b.max * 100)}%`; this._set(e.querySelector('.st'), 'bs', b.status || ''); }
  setAllies(list) { this._set(this.el.allies, 'al', list.map(a => `<div class="lh-ally lh-glass ${a.down ? 'down' : ''}">${a.down ? '💀' : '🏮'} ${esc(a.name)} <span style="float:right;opacity:.8">P${a.power}</span><i><b style="width:${a.hpPct}%"></b></i></div>`).join('')); }
  banner(title, sub = '', ms = 2600) { const b = this.el.banner; b.querySelector('h2').textContent = title; b.querySelector('p').textContent = sub; b.classList.add('on'); clearTimeout(this._bt); this._bt = setTimeout(() => b.classList.remove('on'), ms); }
  prompt(text, key = 'E', progress = null) {
    const p = this.el.prompt; if (!text) { p.hidden = true; this._pr = null; return; }
    const k = getDeviceMode() === 'mobile' ? '✋' : key, h = `${progress != null ? `<span class="ring" style="--p:${Math.round(progress * 100)}%"></span>` : `<kbd>${k}</kbd>`}${esc(text)}`;
    if (h !== this._pr) { this._pr = h; p.innerHTML = h; } p.hidden = false;
  }
  toast(text, ms = 3000) { const d = document.createElement('div'); d.className = 'lh-toast lh-glass'; d.innerHTML = text; this.el.toasts.append(d); setTimeout(() => d.remove(), ms + 100); while (this.el.toasts.children.length > 4) this.el.toasts.firstChild.remove(); }
  float(text, x, y, cls = '') { if (x == null) return; const d = document.createElement('div'); d.className = `lh-float ${cls}`; d.textContent = text; d.style.left = `${x - 12 + (Math.random() - 0.5) * 30}px`; d.style.top = `${y - 20}px`; this.root.append(d); setTimeout(() => d.remove(), 950); }
  hurt() { const v = this.el.vHurt; v.style.transition = 'none'; v.style.opacity = 1; requestAnimationFrame(() => { v.style.transition = 'opacity .5s'; v.style.opacity = 0; }); }
  setDowned(on, text = '', pct = 1) { const d = this.el.downed; d.hidden = !on; this.el.vDown.style.opacity = on ? 1 : 0; if (on) { this._set(d.querySelector('p'), 'dw', esc(text)); d.querySelector('.ring').style.setProperty('--p', `${Math.round(pct * 100)}%`); } }
  fade(on) { this.el.fade.classList.toggle('on', on); }
  /** Generic modal. body = HTML; buttons inside use data-act / data-v. */
  modal(icon, title, sub, body, tag = null) { const m = this.el.modal; m.querySelector('.ic').textContent = icon; m.querySelector('h3').textContent = title; m.querySelector('.lh-mh p').textContent = sub || ''; m.querySelector('.lh-mb').innerHTML = body; m.hidden = false; this.modalTag = tag; this.root.classList.add('lh-mopen'); }
  get modalOpen() { return !this.el.modal.hidden; }
  closeModal() { if (this.el.modal.hidden) return; this.el.modal.hidden = true; this.root.classList.remove('lh-mopen'); const t = this.modalTag; this.modalTag = null; this.onCloseModal?.(t); }
  dispose() { this.offDevice?.(); clearTimeout(this._bt); this.root.remove(); this.style.remove(); for (const k of ['KeyK', 'ShiftLeft', 'KeyQ', 'KeyE', 'KeyR']) this.engine.input.keys.delete(k); }
}
export { esc };
