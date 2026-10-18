// Small event-quest panel (DOM overlay). Styles are injected and removed with the game.
import { getDeviceMode, onDeviceChange } from '../../core/device.js';

const CSS = `
.ndq{position:absolute;left:12px;top:132px;z-index:13;pointer-events:none;width:230px;background:linear-gradient(135deg,rgba(25,40,70,.88),rgba(60,30,80,.88));color:#fff;border-radius:14px;padding:8px 11px 9px;font-family:inherit;box-shadow:0 6px 20px rgba(0,0,0,.3);border:2px solid rgba(160,220,255,.55)}
.ndq .t{font-size:10px;letter-spacing:1.4px;font-weight:800;color:#9fdcff;text-transform:uppercase}
.ndq .n{font-size:15px;font-weight:900;margin:1px 0}
.ndq .d{font-size:12px;opacity:.9}
.ndq .b{height:8px;border-radius:5px;background:rgba(255,255,255,.18);margin:6px 0 4px;overflow:hidden}
.ndq .b i{display:block;height:100%;background:linear-gradient(90deg,#5fd0ff,#c27bff);transition:width .3s}
.ndq .r{font-size:11px;opacity:.95}.ndq .r code{opacity:.6;font-size:10px}
.ndq.done{border-color:#ffd34d}.ndq.done .b i{background:linear-gradient(90deg,#ffd34d,#ff9f1c)}
.ndq.mobile{top:auto;bottom:auto;top:calc(128px + env(safe-area-inset-top,0px));left:6px;width:168px;padding:5px 8px 6px}
.ndq.mobile .d{display:none}.ndq.mobile .n{font-size:12px}.ndq.mobile .r code{display:none}
`;
let refs = 0, styleEl = null;
export class QuestHud {
  constructor(quest, { top = null } = {}) {
    this.quest = quest;
    if (!refs++) { styleEl = document.createElement('style'); styleEl.textContent = CSS; document.head.append(styleEl); }
    this.el = document.createElement('div'); this.el.className = 'ndq'; this.el.id = 'nd-quest'; this.el.dataset.quest = quest.id;
    if (top != null) this.el.style.top = top + 'px';
    (document.getElementById('app') || document.body).append(this.el);
    const mode = () => this.el.classList.toggle('mobile', getDeviceMode() === 'mobile');
    mode(); this._off = onDeviceChange(mode);
  }
  update(s) {
    const q = this.quest, pct = Math.round((s.progress / s.goal) * 100);
    const status = s.claimed ? '✅ Unlocked!' : s.pending ? 'Claiming…' : s.done ? 'Complete! Reward pending server' : `${s.progress} / ${s.goal}`;
    this.el.classList.toggle('done', s.done || s.claimed);
    this.el.innerHTML = `<div class="t">🌪 Natural Disasters event</div><div class="n">${q.title}</div><div class="d">${q.description}</div><div class="b"><i style="width:${pct}%"></i></div><div class="r">${status} · 🎁 ${q.rewardName} <code>${q.rewardItemId}</code></div>`;
  }
  dispose() { this._off?.(); this.el.remove(); if (!--refs) styleEl?.remove(); }
}
