// "Hunt" menu: the Natural Disasters limited-time event inside NDS.
// Data sources (Publisher APIs, all read-only here; the server grants items):
//   quests.eventStatus('natural_disasters') -> { eventId, title, startsAt, endsAt, active, serverNow }   (countdown)
//   quests.status()                          -> [{ id, progress, goal, completed, claimed, live, ... }] (cards)
//   quests.complete(questId)                 -> { granted, itemId, alreadyClaimed } | { reason }        (claim)
// Countdown = (endsAt - serverNow) - local time since the fetch. The device clock is never trusted.
// Item display data comes from the cosmetics catalog (src/data/cosmetics.js: name, icon, desc, earnIn,
// unlock, rarity) when the items exist there; otherwise from FALLBACK below (keyed by item id).
import { COSMETIC_BY_ID } from '../../data/cosmetics.js';
import { questApi } from '../_event/questAdapter.js';
import { getDeviceMode, onDeviceChange } from '../../core/device.js';
import { bus } from '../../core/events.js';

export const EVENT_ID = 'natural_disasters';
export const HUNT_ITEMS = [ // display order: hardest first
  { itemId: 'tornado_hat', questId: 'nd_quest_disaster_survival', hint: 'Survive 10 disasters in Natural Disaster Survival. The bunker helps, but it isn\'t safe!' },
  { itemId: 'lightning_back', questId: 'nd_quest_giant_obby', hint: 'Climb 20 new stages on foot in the Giant Rainbow Obby (skips don\'t count).' },
  { itemId: 'meteor_pet', questId: 'nd_quest_birg_hq', hint: 'Find the 5 glowing frozen meteor shards hidden around BIRG HQ.' },
  { itemId: 'blizzard_hat', questId: 'nd_quest_frost_fields', hint: 'Place 30 blocks in Frost Fields build mode to make a storm shelter.' },
];
const FALLBACK = {
  tornado_hat: { name: 'Frost Tornado Hat', icon: '🌪️', earnIn: 'Natural Disaster Survival', rarity: 'legendary', defaultColor: '#9fdcff', desc: 'A tiny icy twister spinning on your head.' },
  lightning_back: { name: 'Ice Lightning Bolt', icon: '⚡', earnIn: 'Giant Rainbow Obby', rarity: 'epic', defaultColor: '#6fd8ff', desc: 'A crackling bolt of frozen lightning on your back.' },
  meteor_pet: { name: 'Frozen Meteor Pet', icon: '☄️', earnIn: 'BIRG HQ', rarity: 'epic', defaultColor: '#7fe3ff', desc: 'A little frozen meteor that floats by your shoulder.' },
  blizzard_hat: { name: 'Blizzard Cloud', icon: '🌨️', earnIn: 'Frost Fields', rarity: 'rare', defaultColor: '#e9f2fa', desc: 'Your own personal snow cloud.' },
};
export const itemInfo = (id) => ({ ...FALLBACK[id], ...(COSMETIC_BY_ID?.[id] || {}), rarity: String(COSMETIC_BY_ID?.[id]?.rarity || FALLBACK[id]?.rarity || '').toLowerCase() });

const CSS = `
.hunt{position:fixed;inset:0;z-index:60;display:none;align-items:center;justify-content:center;background:rgba(4,14,30,.55);backdrop-filter:blur(3px);font-family:system-ui,sans-serif}
.hunt.show{display:flex}
.hunt-box{position:relative;width:min(760px,94vw);max-height:92vh;overflow:hidden auto;border-radius:22px;background:linear-gradient(180deg,#0d2a4a,#0a1f38 55%,#06304a);border:2px solid #7fd4ff;box-shadow:0 0 40px #39a8ff66;color:#eaf6ff}
.hunt-sky{position:absolute;inset:0 0 auto 0;height:150px;overflow:hidden;pointer-events:none}
.hunt-tw{position:absolute;bottom:-6px;width:56px;height:130px;animation:huntSway 3.6s ease-in-out infinite alternate;opacity:.75}
.hunt-tw i{position:absolute;left:50%;height:12px;border-radius:50%;border:3px solid #b9e6ff;border-color:#d8f2ff #9cd2f5;transform:translateX(-50%);animation:huntSpin .7s linear infinite}
@keyframes huntSpin{to{transform:translateX(-50%) rotateY(360deg)}}
@keyframes huntSway{from{transform:translateX(-14px) skewX(6deg)}to{transform:translateX(14px) skewX(-6deg)}}
.hunt-wave{position:absolute;left:0;right:0;bottom:0;height:110px;pointer-events:none}
.hunt-head{position:relative;padding:18px 22px 6px;text-align:center}
.hunt-head h2{margin:0;font-size:32px;letter-spacing:2px;text-shadow:0 2px 0 #052,0 0 18px #6fd8ff}
.hunt-head p{margin:4px 0 0;font-size:14px;opacity:.85}
.hunt-cd{display:inline-block;margin-top:8px;padding:4px 14px;border-radius:999px;background:#ff7a2f;color:#fff;font-weight:800;font-variant-numeric:tabular-nums;box-shadow:0 0 0 2px #ffd2a8 inset}
.hunt-cd.ended{background:#6b7c8f}
.hunt-x{position:absolute;right:12px;top:10px;z-index:2;width:40px;height:40px;border-radius:50%;border:0;background:#ffffff22;color:#fff;font-size:20px;cursor:pointer}
.hunt-grid{position:relative;display:grid;grid-template-columns:1fr 1fr;gap:12px;padding:14px 18px 120px}
.hunt-card{position:relative;display:flex;gap:12px;padding:12px;border-radius:16px;background:#ffffff12;border:1px solid #ffffff2a}
.hunt-card.legendary{grid-column:1/-1;background:linear-gradient(120deg,#ffb34733,#7fd4ff22);border:2px solid #ffc860;box-shadow:0 0 18px #ffb34755}
.hunt-card.epic{border:2px solid #b48cff;box-shadow:0 0 12px #b48cff44}.hunt-card.rare{border:2px solid #6fd8ff;box-shadow:0 0 10px #6fd8ff33}
.hunt-thumb{flex:0 0 76px;height:76px;border-radius:14px;display:flex;align-items:center;justify-content:center;font-size:44px;background:radial-gradient(circle at 50% 40%,var(--c),#0b2440 75%);animation:huntBob 2.4s ease-in-out infinite}
@keyframes huntBob{50%{transform:translateY(-4px)}}
.hunt-card .nm{font-weight:800;font-size:17px}.hunt-card .rar{font-size:11px;font-weight:800;letter-spacing:1px;text-transform:uppercase;padding:1px 7px;border-radius:6px;margin-left:6px;vertical-align:2px}
.rar.legendary{background:#ffc860;color:#4a2a00}.rar.epic{background:#b48cff;color:#1e0b44}.rar.rare{background:#6fd8ff;color:#06263c}
.hunt-card .hint{font-size:12.5px;opacity:.85;margin:3px 0 6px}
.hunt-bar{height:12px;border-radius:6px;background:#00000055;overflow:hidden}.hunt-bar i{display:block;height:100%;background:linear-gradient(90deg,#6fd8ff,#bdf1ff)}
.hunt-st{display:flex;justify-content:space-between;align-items:center;margin-top:5px;font-size:12px;font-weight:700}
.hunt-st button{border:0;border-radius:10px;padding:7px 14px;font-weight:800;background:#36d07a;color:#03260f;cursor:pointer;min-height:34px}
.hunt-st .col{color:#7dffb0}.hunt-st .end{color:#a8b6c6}
.hunt-cele{position:fixed;inset:0;z-index:61;display:none;align-items:center;justify-content:center;pointer-events:none}
.hunt-cele.show{display:flex}
.hunt-cele .c{padding:22px 30px;border-radius:20px;background:#0d2a4aee;border:2px solid #ffc860;text-align:center;color:#fff;animation:huntPop .5s cubic-bezier(.2,1.6,.4,1)}
.hunt-cele .c .ic{font-size:72px}.hunt-cele .c b{display:block;font-size:24px}.hunt-cele .c small{font-size:14px;opacity:.9}
.hunt-cele s{position:absolute;top:-10px;width:9px;height:14px;animation:huntFall 2.2s linear forwards;text-decoration:none}
@keyframes huntPop{from{transform:scale(.3);opacity:0}}
@keyframes huntFall{to{transform:translateY(105vh) rotate(720deg)}}
.hunt.m .hunt-grid{grid-template-columns:1fr;gap:8px;padding:10px 10px 90px}.hunt.m .hunt-head h2{font-size:22px}.hunt.m .hunt-head p{font-size:12px}
.hunt.m .hunt-thumb{flex-basis:58px;height:58px;font-size:32px}.hunt.m .hunt-sky{height:110px}.hunt.m .hunt-wave{height:70px}
@media (prefers-reduced-motion:reduce){.hunt *{animation:none!important}}
`;
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export function fmtLeft(ms) {
  if (!(ms > 0)) return '0s';
  const s = Math.floor(ms / 1000), d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60), ss = s % 60;
  return d ? `${d}d ${h}h ${m}m ${ss}s` : h ? `${h}h ${m}m ${ss}s` : `${m}m ${ss}s`;
}

export class HuntMenu {
  constructor({ sfx = () => {}, ambience = () => {}, now = () => performance.now() } = {}) {
    this.sfx = sfx; this.ambience = ambience; this.now = now; this.open = false; this.ev = null; this.list = [];
    this.style = document.createElement('style'); this.style.textContent = CSS; document.head.append(this.style);
    const root = this.root = document.createElement('div'); root.className = 'hunt'; root.id = 'nds-hunt-menu';
    const tw = (l, s, d) => `<div class="hunt-tw" style="left:${l}%;transform:scale(${s});animation-delay:${d}s">${Array.from({ length: 9 }, (_, i) => `<i style="bottom:${i * 13}px;width:${10 + i * 5.5}px;animation-delay:${-i * 0.08}s"></i>`).join('')}</div>`;
    root.innerHTML = `<div class="hunt-box" role="dialog" aria-label="Hunt"><button class="hunt-x" title="Close (H / Esc)">✕</button>
      <div class="hunt-sky">${tw(6, 0.8, 0)}${tw(80, 1, -1.3)}${tw(48, 0.55, -2.1)}</div>
      <div class="hunt-head"><h2>🌪️ THE HUNT 🌊</h2><p>Natural Disasters event: collect all 4 frozen storm items before the storm passes!</p><div class="hunt-cd" id="nds-hunt-cd"></div></div>
      <div class="hunt-grid"></div><canvas class="hunt-wave"></canvas></div>`;
    this.cele = document.createElement('div'); this.cele.className = 'hunt-cele'; this.cele.id = 'nds-hunt-cele';
    (document.getElementById('app') || document.body).append(root, this.cele);
    this.grid = root.querySelector('.hunt-grid'); this.cdEl = root.querySelector('.hunt-cd'); this.wave = root.querySelector('.hunt-wave');
    root.querySelector('.hunt-x').onclick = () => this.close();
    root.onclick = (e) => { if (e.target === root) this.close(); };
    this.grid.onclick = (e) => { const b = e.target.closest('button[data-claim]'); if (b) this.claim(b.dataset.claim, b); };
    const mode = () => root.classList.toggle('m', getDeviceMode() === 'mobile');
    mode(); this._offDev = onDeviceChange(mode);
    this._offInv = bus.on?.('inventory:changed', () => { if (this.open) this.refresh(); });
    this.render();
  }
  toggle() { return this.open ? this.close() : this.show(); }
  show() {
    if (this.open) return; this.open = true; this.root.classList.add('show'); this.sfx('open'); this.ambience(true);
    this.refresh(); this._loop();
  }
  close() {
    if (!this.open) return; this.open = false; this.root.classList.remove('show'); this.sfx('close'); this.ambience(false);
    cancelAnimationFrame(this._raf);
  }
  /** Re-fetch event status (server-cached 60 s) and quest progress every time the menu opens. */
  async refresh() {
    const api = questApi();
    try {
      if (typeof api.eventStatus === 'function') {
        const ev = await api.eventStatus(EVENT_ID);
        if (ev && ev.endsAt && ev.serverNow) this.ev = { ...ev, fetchedAt: this.now(), endMs: Date.parse(ev.endsAt) - Date.parse(ev.serverNow), startMs: ev.startsAt ? Date.parse(ev.startsAt) - Date.parse(ev.serverNow) : 0 };
        else this.ev = ev ? { ...ev, endMs: null } : null;
      } else this.ev = null; // API not available: hide the timer rather than trust the device clock
    } catch { this.ev = null; }
    try { const l = await api.status(); this.list = Array.isArray(l) ? l : []; } catch { this.list = []; }
    this.render();
  }
  get msLeft() { const e = this.ev; if (!e || e.endMs == null) return null; return e.endMs - (this.now() - e.fetchedAt); }
  get msToStart() { const e = this.ev; if (!e || e.endMs == null) return 0; return e.startMs - (this.now() - e.fetchedAt); }
  eventState() {
    if (!this.ev) return 'unknown';
    if (this.msToStart > 0) return 'not_started';
    if (this.msLeft != null && this.msLeft <= 0) return 'ended';
    return this.ev.active === false && this.msLeft == null ? 'ended' : 'active';
  }
  _tick() {
    const st = this.eventState(), cd = this.cdEl;
    cd.classList.toggle('ended', st === 'ended');
    if (st === 'unknown' || this.msLeft == null) { cd.style.display = 'none'; return; }
    cd.style.display = '';
    const txt = st === 'not_started' ? `⏳ Starts in ${fmtLeft(this.msToStart)}` : st === 'ended' ? '⛔ Event ended · completed hunts can be claimed for 24h' : `⏰ Ends in ${fmtLeft(this.msLeft)}`;
    if (cd.textContent !== txt) cd.textContent = txt;
  }
  _loop() {
    const cv = this.wave, g = cv.getContext('2d');
    let last = 0;
    const f = (ms) => {
      if (!this.open) return;
      this._raf = requestAnimationFrame(f);
      if (ms - last < 33) return; // ~30 fps is plenty for the decoration
      last = ms; this._tick(); this.ambience(true); // lets the sample take over from the placeholder once decoded
      const w = cv.clientWidth, h = cv.clientHeight; if (!w || !h) return;
      if (cv.width !== w) { cv.width = w; cv.height = h; }
      const t = ms / 1000; g.clearRect(0, 0, w, h);
      // tsunami: a big curling wave crest moving across, then layered flowing water
      const crestX = ((t * 0.12) % 1.4 - 0.2) * w;
      const layers = [['#1b6fae', 0.55, 1.0, 0.6], ['#2c95d6', 0.42, 1.6, 0.8], ['#5cc4f2', 0.3, 2.3, 1]];
      layers.forEach(([c, base, sp, a], i) => {
        g.beginPath(); g.moveTo(0, h);
        for (let x = 0; x <= w; x += 8) {
          const bump = Math.exp(-(((x - crestX) / (w * 0.12)) ** 2)) * h * (0.42 - i * 0.1);
          g.lineTo(x, h * base + Math.sin(x / 38 + t * sp + i) * 5 + Math.sin(x / 91 - t * sp * 0.6) * 7 - bump);
        }
        g.lineTo(w, h); g.closePath(); g.globalAlpha = a; g.fillStyle = c; g.fill();
      });
      g.globalAlpha = 0.85; g.fillStyle = '#eafaff'; // foam on the crest
      for (let k = 0; k < 14; k++) { const x = crestX - 40 + ((k * 37 + t * 60) % 90), y = h * 0.3 - Math.exp(-(((x - crestX) / (w * 0.12)) ** 2)) * h * 0.22 + Math.sin(k + t * 4) * 3; g.beginPath(); g.arc(x, y, 2 + (k % 3), 0, 6.3); g.fill(); }
      g.globalAlpha = 1;
    };
    this._raf = requestAnimationFrame(f);
  }
  render() {
    const byId = Object.fromEntries(this.list.map(q => [q.id, q]));
    this.grid.innerHTML = HUNT_ITEMS.map(({ itemId, questId, hint }) => {
      const info = itemInfo(itemId), q = byId[questId];
      const goal = q?.goal || 0, prog = Math.min(goal, q?.progress || 0), pct = goal ? Math.round(prog / goal * 100) : 0;
      let st;
      if (q?.claimed) st = '<span class="col">✅ Collected · in your inventory</span>';
      else if (q?.completed) st = `<button data-claim="${esc(questId)}">🎁 Claim${q.live === false ? ' (24h grace)' : ''}</button>`;
      else if (q && q.live === false) st = `<span class="end">${this.eventState() === 'not_started' ? '⏳ Not started' : '⛔ Ended'}</span>`;
      else st = `<span>${q ? `${prog} / ${goal}` : 'Progress unavailable'}</span>`;
      const color = (info.defaultColor || '#7fd4ff').replace(/[^#0-9a-fA-F]/g, '');
      return `<div class="hunt-card ${esc(info.rarity || '')}" data-item="${esc(itemId)}"><div class="hunt-thumb" style="--c:${color}">${esc(info.icon || '❄️')}</div>
        <div style="flex:1;min-width:0"><div><span class="nm">${esc(info.name || itemId)}</span>${info.rarity ? `<span class="rar ${esc(info.rarity)}">${esc(info.rarity)}</span>` : ''}</div>
        <div class="hint">${esc(hint)} <i style="opacity:.7">(${esc(info.earnIn || '')})</i></div>
        <div class="hunt-bar"><i style="width:${q?.claimed ? 100 : pct}%"></i></div><div class="hunt-st"><span>${esc(q?.title || '')}</span>${st}</div></div></div>`;
    }).join('');
    this._tick();
  }
  async claim(questId, btn) {
    if (btn) { btn.disabled = true; btn.textContent = '…'; }
    this.sfx('click');
    let r; try { r = await questApi().complete(questId); } catch { r = { granted: false, reason: 'network' }; }
    const item = HUNT_ITEMS.find(h => h.questId === questId);
    if (r?.granted || r?.alreadyClaimed) { if (r.granted) this.celebrate(r.itemId || item?.itemId); }
    else { this.sfx('deny'); bus.emit('toast', { text: r?.reason === 'event_ended' ? 'The event has ended, so this reward can no longer be claimed' : r?.reason === 'not_complete' ? 'Not finished yet. Keep going!' : 'Could not claim right now. Try again soon', icon: '😕' }); }
    await this.refresh();
  }
  /** Big "added to your inventory" moment. Called by the menu's Claim button and by quest trackers on auto-claim. */
  celebrate(itemId) {
    const info = itemInfo(itemId);
    const conf = Array.from({ length: 40 }, (_, i) => `<s style="left:${(i * 37) % 100}%;background:${['#6fd8ff', '#ffc860', '#ffffff', '#7dffb0', '#b48cff'][i % 5]};animation-delay:${(i % 10) * 0.07}s"></s>`).join('');
    this.cele.innerHTML = `${conf}<div class="c"><div class="ic">${esc(info.icon || '🎁')}</div><b>${esc(info.name || itemId)}</b><small>Added to your inventory! Equip it in the Avatar shop.</small></div>`;
    this.cele.classList.add('show'); this.sfx('big'); this.sfx('collected');
    clearTimeout(this._cT); this._cT = setTimeout(() => this.cele.classList.remove('show'), 3200);
  }
  dispose() { this.close(); this._offDev?.(); this._offInv?.(); clearTimeout(this._cT); this.root.remove(); this.cele.remove(); this.style.remove(); }
}
