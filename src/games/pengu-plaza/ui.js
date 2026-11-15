// Pengu Plaza HUD — built once, updated in place. Mobile-safe: emote bar (or camera tools in camera mode) sits
// ABOVE joystick/jump, the big action button (Sit / Sip / Snap / Ride… or SHUTTER in camera mode) stays right,
// Camera + Album buttons are always visible. Nothing auto-hides.
import { EMOTES } from './config.js';
const CSS = `
.pp-root{position:fixed;inset:0;pointer-events:none;z-index:40;font-family:system-ui,'Segoe UI',sans-serif;color:#fff}
.pp-root *{box-sizing:border-box}
.pp-top{position:absolute;top:12px;left:50%;transform:translateX(-50%);display:flex;gap:8px;flex-wrap:wrap;justify-content:center;max-width:min(96vw,760px)}
.pp-chip{background:linear-gradient(#5fb6ffcc,#2d6fd1cc);border:2px solid #d6f1ff;border-radius:999px;padding:6px 14px;font-weight:800;font-size:14px;text-shadow:0 1px 0 #1a3a7a;box-shadow:0 3px 0 #1a3a7a88;white-space:nowrap}
.pp-chip.ev{background:linear-gradient(#c79bffdd,#6a4bd1dd);border-color:#efe3ff}
.pp-chip.ev:empty{display:none}
.pp-root.m .pp-chip{font-size:12px;padding:5px 10px}
.pp-emotes,.pp-tools{position:absolute;left:50%;transform:translateX(-50%);bottom:92px;display:flex;gap:10px;pointer-events:auto}
.pp-root.m .pp-emotes,.pp-root.m .pp-tools{bottom:180px}
.pp-tools{display:none}
.pp-root.cam .pp-tools{display:flex}.pp-root.cam .pp-emotes{display:none}
.pp-btn{pointer-events:auto;min-width:64px;min-height:64px;border-radius:20px;border:3px solid #e6f6ff;background:linear-gradient(#8fd8ff,#3c8be6);color:#fff;font-weight:900;font-size:13px;display:flex;flex-direction:column;align-items:center;justify-content:center;box-shadow:0 5px 0 #1d4f9a,0 8px 18px #0006;cursor:pointer;touch-action:manipulation;user-select:none;-webkit-user-select:none;transition:transform .08s;padding:4px 8px}
.pp-btn b{font-size:28px;line-height:1}
.pp-btn small{opacity:.8;font-size:11px}
.pp-btn:active,.pp-btn.press{transform:translateY(4px) scale(.95);box-shadow:0 1px 0 #1d4f9a}
.pp-act{position:absolute;right:24px;bottom:130px;min-width:110px;min-height:80px;font-size:16px;background:linear-gradient(#ffd77a,#ff9a3c);box-shadow:0 5px 0 #a8551d,0 8px 18px #0006;border-color:#fff4d6}
.pp-root.m .pp-act{right:18px;bottom:250px}
.pp-act.idle{filter:saturate(.25) brightness(.85)}
.pp-root.cam .pp-act{background:linear-gradient(#ffffff,#cfe6ff);color:#173a6e;min-width:96px;min-height:96px;border-radius:50%;box-shadow:0 5px 0 #6f8fb8,0 0 0 6px #ffffff55,0 8px 18px #0006}
.pp-side{position:absolute;top:92px;right:12px;display:flex;flex-direction:column;gap:8px;align-items:flex-end}
.pp-side .pp-btn{min-width:86px;min-height:54px;flex-direction:row;gap:6px;font-size:14px;border-radius:16px}
.pp-side .pp-btn b{font-size:22px}
.pp-camb{background:linear-gradient(#ff9ad0,#d9488f);box-shadow:0 5px 0 #8a2a5a,0 8px 18px #0006}
.pp-root.cam .pp-camb{background:linear-gradient(#7ff0b0,#2fbf78);box-shadow:0 5px 0 #1d7a4a,0 8px 18px #0006}
.pp-root.m .pp-camb{position:absolute;right:18px;bottom:345px;top:auto}
.pp-banner{position:absolute;top:22%;left:50%;transform:translate(-50%,-10px) scale(.9);opacity:0;transition:all .3s cubic-bezier(.3,1.6,.5,1);font-size:34px;font-weight:900;text-align:center;text-shadow:0 3px 0 #1a3a7a,0 0 18px #7fd6ff;width:max-content;max-width:92vw}
.pp-banner small{display:block;font-size:16px;font-weight:700}
.pp-banner.on{opacity:1;transform:translate(-50%,0) scale(1)}
.pp-root.m .pp-banner{font-size:26px}
.pp-pop{position:absolute;font-weight:900;font-size:22px;animation:pp-up 1.1s ease-out forwards;text-shadow:0 2px 0 #1a3a7a;transform:translateX(-50%)}
@keyframes pp-up{0%{opacity:0;margin-top:10px}20%{opacity:1}100%{opacity:0;margin-top:-60px}}
.pp-flash{position:absolute;inset:0;background:#fff;opacity:0}
.pp-toasts{position:absolute;left:12px;top:92px;display:flex;flex-direction:column;gap:6px;width:min(300px,62vw)}
.pp-toast{display:flex;gap:8px;align-items:center;background:#0d1f45dd;border:2px solid #9fd8ff;border-radius:14px;padding:6px 10px 6px 6px;font-size:13px;font-weight:700;animation:pp-tin .35s cubic-bezier(.3,1.5,.5,1);box-shadow:0 4px 14px #0007}
.pp-toast img{width:64px;height:40px;border-radius:6px;object-fit:cover;flex:none}
.pp-toast .ic{font-size:24px;width:40px;text-align:center;flex:none}
.pp-toast.out{opacity:0;transform:translateX(-20px);transition:all .4s}
@keyframes pp-tin{from{opacity:0;transform:translateX(-30px)}}
.pp-cam{position:absolute;inset:0;display:none}
.pp-root.cam .pp-cam{display:block}
.pp-vf{position:absolute;inset:6% 5%;border:0}
.pp-vf i{position:absolute;width:38px;height:38px;border:4px solid #ffffffcc}
.pp-vf i:nth-child(1){left:0;top:0;border-right:0;border-bottom:0;border-radius:10px 0 0 0}.pp-vf i:nth-child(2){right:0;top:0;border-left:0;border-bottom:0;border-radius:0 10px 0 0}
.pp-vf i:nth-child(3){left:0;bottom:0;border-right:0;border-top:0;border-radius:0 0 0 10px}.pp-vf i:nth-child(4){right:0;bottom:0;border-left:0;border-top:0;border-radius:0 0 10px 0}
.pp-grid{position:absolute;inset:0;background:linear-gradient(90deg,transparent calc(33.33% - 1px),#ffffff55 calc(33.33% - 1px),#ffffff55 calc(33.33% + 1px),transparent calc(33.33% + 1px),transparent calc(66.66% - 1px),#ffffff55 calc(66.66% - 1px),#ffffff55 calc(66.66% + 1px),transparent calc(66.66% + 1px)),linear-gradient(180deg,transparent calc(33.33% - 1px),#ffffff55 calc(33.33% - 1px),#ffffff55 calc(33.33% + 1px),transparent calc(33.33% + 1px),transparent calc(66.66% - 1px),#ffffff55 calc(66.66% - 1px),#ffffff55 calc(66.66% + 1px),transparent calc(66.66% + 1px))}
.pp-cam.nogrid .pp-grid{display:none}
.pp-ret{position:absolute;left:50%;top:50%;width:26px;height:26px;margin:-13px;border:2px solid #ffffffaa;border-radius:50%}
.pp-brk{position:absolute;width:86px;height:86px;margin:-43px;border:3px dashed #7fffc8;border-radius:14px;transition:left .08s,top .08s;display:none}
.pp-brk.on{display:block}.pp-brk.new{border-color:#ffd76a;animation:pp-pulse .8s infinite}
@keyframes pp-pulse{50%{transform:scale(1.12)}}
.pp-subj{position:absolute;left:50%;bottom:170px;transform:translateX(-50%);background:#0d1f45cc;border:2px solid #ffffff88;border-radius:999px;padding:6px 16px;font-weight:800;font-size:15px;white-space:nowrap}
.pp-root.m .pp-subj{bottom:258px;font-size:13px}
.pp-root.m .pp-filt{bottom:296px}
@media (max-height:520px){.pp-zoom input{height:96px}.pp-root.m .pp-zoom{bottom:200px;right:130px}.pp-root.m .pp-subj{bottom:236px}.pp-root.m .pp-filt{bottom:270px}}
.pp-subj.hit{border-color:#7fffc8;color:#eafff5}.pp-subj.new{border-color:#ffd76a;color:#fff3c4}
.pp-zoom{position:absolute;right:150px;bottom:150px;display:flex;flex-direction:column;align-items:center;gap:6px;pointer-events:auto}
.pp-root.m .pp-zoom{right:140px;bottom:240px}
.pp-zoom input{writing-mode:vertical-lr;direction:rtl;width:44px;height:170px;accent-color:#ffd76a;cursor:pointer;touch-action:none}
.pp-zoom span{font-weight:900;font-size:14px;background:#0d1f45cc;border-radius:10px;padding:2px 8px}
.pp-filt{position:absolute;left:50%;bottom:214px;transform:translateX(-50%);font-weight:800;font-size:13px;background:#0d1f45aa;border-radius:999px;padding:4px 12px}
.pp-card{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%) scale(.9);opacity:0;pointer-events:none;transition:all .25s;background:linear-gradient(#eaf7ff,#bfe3ff);color:#173a6e;border:4px solid #fff;border-radius:26px;padding:20px 26px;max-width:min(92vw,460px);text-align:center;box-shadow:0 10px 40px #0008}
.pp-card.on{opacity:1;pointer-events:auto;transform:translate(-50%,-50%) scale(1)}
.pp-card h1{margin:0 0 6px;font-size:30px}.pp-card p{margin:6px 0;font-size:15px}
.pp-go{margin-top:10px;font-size:20px;font-weight:900;padding:14px 30px;border-radius:18px;border:3px solid #fff;background:linear-gradient(#7ff0b0,#2fbf78);color:#fff;box-shadow:0 5px 0 #1d7a4a;cursor:pointer;min-height:56px}
`;
const el = (t, c, h = '') => { const e = document.createElement(t); if (c) e.className = c; e.innerHTML = h; return e; };
const tap = (b, fn) => b.addEventListener('pointerdown', (ev) => { ev.preventDefault(); ev.stopPropagation(); b.classList.add('press'); setTimeout(() => b.classList.remove('press'), 120); fn(ev); });
export class PlazaUI {
  constructor(mobile, { onEmote, onAct, onCamera, onAlbum, onZoom, onFilter, onGrid }) {
    this.mobile = mobile; this.style = el('style', '', CSS); document.head.appendChild(this.style);
    this.root = el('div', 'pp-root' + (mobile ? ' m' : '')); document.body.appendChild(this.root);
    this.top = el('div', 'pp-top'); this.zone = el('div', 'pp-chip', '🐧 Pengu Plaza'); this.stats = el('div', 'pp-chip', '☕ 0'); this.ev = el('div', 'pp-chip ev'); this.top.append(this.zone, this.stats, this.ev); this.root.appendChild(this.top);
    this.side = el('div', 'pp-side'); this.albumBtn = el('button', 'pp-btn', '<b>📖</b><span>Album</span>'); this.camBtn = el('button', 'pp-btn pp-camb', `<b>📷</b><span>Camera</span>${mobile ? '' : ' <small>C</small>'}`);
    tap(this.albumBtn, () => onAlbum()); tap(this.camBtn, () => onCamera()); this.side.append(this.albumBtn); (mobile ? this.root : this.side).appendChild(this.camBtn); this.root.appendChild(this.side);
    this.toasts = el('div', 'pp-toasts'); this.root.appendChild(this.toasts);
    // camera overlay (viewfinder, grid, reticle, subject bracket + label, zoom slider, filter name)
    this.cam = el('div', 'pp-cam', '<div class="pp-grid"></div><div class="pp-vf"><i></i><i></i><i></i><i></i></div><div class="pp-ret"></div><div class="pp-brk"></div><div class="pp-subj">Find something to photograph</div><div class="pp-filt"></div>');
    this.brk = this.cam.querySelector('.pp-brk'); this.subj = this.cam.querySelector('.pp-subj'); this.filt = this.cam.querySelector('.pp-filt');
    this.zoomBox = el('div', 'pp-zoom', '<span>1.0×</span><input type="range" min="1" max="4" step="0.05" value="1" aria-label="Zoom"><span>🔍</span>');
    this.zoomIn = this.zoomBox.querySelector('input'); this.zoomLbl = this.zoomBox.querySelector('span'); this.zoomIn.addEventListener('input', () => onZoom(+this.zoomIn.value)); ['pointerdown', 'touchstart'].forEach(k => this.zoomIn.addEventListener(k, e => e.stopPropagation(), { passive: true }));
    this.cam.appendChild(this.zoomBox); this.root.appendChild(this.cam);
    this.emotes = el('div', 'pp-emotes');
    for (const e of EMOTES) { const b = el('button', 'pp-btn', `<b>${e.icon}</b>${e.label}${mobile ? '' : ` <small>${e.key.slice(-1)}</small>`}`); tap(b, () => onEmote(e.id)); this.emotes.appendChild(b); }
    this.root.appendChild(this.emotes);
    this.tools = el('div', 'pp-tools'); const tb = (h, fn) => { const b = el('button', 'pp-btn', h); tap(b, fn); this.tools.appendChild(b); return b; };
    tb(`<b>◀</b>Filter${mobile ? '' : ' <small>R</small>'}`, () => onFilter(-1)); tb(`<b>▶</b>Filter`, () => onFilter(1)); this.gridBtn = tb(`<b>▦</b>Grid${mobile ? '' : ' <small>G</small>'}`, () => onGrid()); tb(`<b>✖</b>Exit${mobile ? '' : ' <small>C</small>'}`, () => onCamera());
    this.root.appendChild(this.tools);
    this.act = el('button', 'pp-btn pp-act idle', '<b>🐾</b>Explore'); this.act.addEventListener('pointerdown', (ev) => { ev.preventDefault(); ev.stopPropagation(); onAct(); }); this.root.appendChild(this.act);
    this.banner = el('div', 'pp-banner'); this.root.appendChild(this.banner);
    this.flashEl = el('div', 'pp-flash'); this.root.appendChild(this.flashEl);
    this.card = el('div', 'pp-card'); this.root.appendChild(this.card);
  }
  setAction(a) { const k = a ? a.icon + a.label : ''; if (k === this._ak) return; this._ak = k; this.act.innerHTML = a ? `<b>${a.icon}</b>${a.label}${this.mobile || !a.key ? '' : ` <small>${a.key}</small>`}` : '<b>🐾</b>Explore'; this.act.classList.toggle('idle', !a); }
  setZone(t) { if (t !== this._z) { this._z = t; this.zone.textContent = t; } }
  setStats(text) { if (text !== this._s) { this._s = text; this.stats.textContent = text; } }
  setEvent(text) { if (text !== this._e) { this._e = text; this.ev.textContent = text; } }
  setAlbum(pct) { const t = `<b>📖</b><span>Album ${pct}%</span>${this.mobile ? '' : ' <small>B</small>'}`; if (t !== this._ab) { this._ab = t; this.albumBtn.innerHTML = t; } }
  setCamera(on) { this.root.classList.toggle('cam', on); this.camBtn.querySelector('span').textContent = on ? 'Done' : 'Camera'; }
  setZoom(z) { this.zoomIn.value = z; this.zoomLbl.textContent = z.toFixed(1) + '×'; }
  setFilter(name) { this.filt.textContent = '🎞 ' + name; }
  setGrid(on) { this.cam.classList.toggle('nogrid', !on); }
  /** best = evaluate()[0] or null; known = already in album */
  setSubject(best, known, stars) {
    const key = best ? `${best.id}|${best.stars}|${known}|${best.bonus}` : '';
    if (best) { const x = (best.sx + 1) / 2 * innerWidth, y = (1 - best.sy) / 2 * innerHeight; this.brk.style.left = x + 'px'; this.brk.style.top = y + 'px'; }
    if (key === this._sk) return; this._sk = key;
    this.brk.classList.toggle('on', !!best); this.brk.classList.toggle('new', !!best && !known);
    if (!best) { this.subj.className = 'pp-subj'; this.subj.textContent = '🔎 Nothing in frame — find a subject'; return; }
    const st = '★'.repeat(best.stars) + '☆'.repeat(3 - best.stars), name = known ? `${best.meta.icon} ${best.meta.name}` : '❓ Something new!';
    this.subj.className = 'pp-subj ' + (known ? 'hit' : 'new'); this.subj.textContent = `${name}  ${st}${best.bonus && best.meta.bonus ? '  ✨' + best.meta.bonus : ''}${known && stars >= best.stars ? '' : known ? '  ⬆ better!' : ''}`;
  }
  toast(html, { img = null, icon = '📸', ms = 3600, border = '#9fd8ff' } = {}) {
    const t = el('div', 'pp-toast', `${img ? `<img src="${img}">` : `<span class="ic">${icon}</span>`}<div>${html}</div>`); t.style.borderColor = border; this.toasts.prepend(t);
    while (this.toasts.children.length > 4) this.toasts.lastChild.remove();
    setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 420); }, ms);
  }
  say(text, sub = '', ms = 1500) { this.banner.innerHTML = `${text}${sub ? `<small>${sub}</small>` : ''}`; this.banner.classList.add('on'); clearTimeout(this._bt); if (ms) this._bt = setTimeout(() => this.banner.classList.remove('on'), ms); }
  pop(text, x = innerWidth / 2, y = innerHeight * 0.45) { const p = el('div', 'pp-pop', text); p.style.left = x + 'px'; p.style.top = y + 'px'; this.root.appendChild(p); setTimeout(() => p.remove(), 1100); }
  flash(o = 0.9) { const f = this.flashEl; f.style.transition = 'none'; f.style.opacity = o; requestAnimationFrame(() => { f.style.transition = 'opacity .6s'; f.style.opacity = 0; }); }
  welcome(save, total, onGo) {
    const help = this.mobile ? 'Joystick to waddle · 📷 Camera to take photos · 📖 Album to see your collection' : '<b>WASD</b> waddle · <b>1–4</b> emotes · <b>E</b> act · <b>C</b> camera (click / E to snap, wheel = zoom) · <b>B</b> album';
    this.card.innerHTML = `<h1>🐧 Pengu Plaza</h1><p>${save.visits > 1 ? 'Welcome back, friend!' : 'A cozy snowy hangout. No timers, no losing — just vibes.'}</p><p>🗺 Six new places to explore past the plaza · 📸 <b>${total}</b> things to photograph — wildlife, locals, landmarks, secrets and rare moments · 📖 fill your album for rewards</p><p style="opacity:.75">${help}</p><button class="pp-go">Waddle in!</button>`;
    this.card.querySelector('button').onclick = () => { this.card.classList.remove('on'); onGo(); }; this.card.classList.add('on');
  }
  dispose() { clearTimeout(this._bt); this.root.remove(); this.style.remove(); }
}
