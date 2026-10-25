// Winterhaven HUD (DOM overlay): area banner, quest tracker, big Talk / Enter button, NPC dialog,
// event menu with countdown, popups and the Frostgate Run HUD. Phones get a compact layout with
// large tap targets (getDeviceMode + device:changed). DOM buttons get their click sound from the
// site's global UI-sound listener; this file only plays popup/notification sounds via sfx().
import { getDeviceMode, onDeviceChange } from '../../core/device.js';

const CSS = `
.wh{position:absolute;inset:0;pointer-events:none;z-index:14;font-family:inherit;color:#fff;--ice:#9fe3ff;--gold:#ffd34d}
.wh button{pointer-events:auto;font-family:inherit;cursor:pointer;border:0;color:#fff}
.wh-area{position:absolute;left:50%;top:14%;transform:translate(-50%,-8px);text-align:center;opacity:0;transition:opacity .6s,transform .6s;text-shadow:0 3px 14px rgba(0,10,40,.8)}
.wh-area.show{opacity:1;transform:translate(-50%,0)}
.wh-area b{display:block;font-size:40px;font-weight:900;letter-spacing:1px}.wh-area small{font-size:14px;opacity:.85;letter-spacing:2px;text-transform:uppercase;color:var(--ice)}
.wh-track{position:absolute;left:12px;top:132px;width:250px;background:linear-gradient(135deg,rgba(14,30,64,.86),rgba(40,24,80,.86));border:2px solid rgba(160,225,255,.5);border-radius:14px;padding:8px 11px;box-shadow:0 6px 20px rgba(0,0,0,.3)}
.wh-track h4{margin:0 0 4px;font-size:10px;letter-spacing:1.4px;color:var(--ice);text-transform:uppercase}
.wh-track .q{font-size:13px;margin:4px 0;display:flex;gap:6px;align-items:flex-start}.wh-track .q i{font-style:normal;opacity:.75;font-size:11px;display:block}
.wh-track .q.carry b{color:var(--gold)}.wh-track .none{font-size:12px;opacity:.85}
.wh-evbtn{position:absolute;right:12px;top:132px;padding:10px 16px;border-radius:14px;font-weight:900;font-size:16px;background:linear-gradient(135deg,#3f8fd0,#7b4fd0);box-shadow:0 4px 0 #23306b,0 8px 20px rgba(0,0,0,.3)}
.wh-evbtn small{display:block;font-size:11px;font-weight:700;opacity:.9}
.wh-act{position:absolute;left:50%;bottom:120px;transform:translateX(-50%);min-width:260px;padding:16px 26px;border-radius:20px;font-size:21px;font-weight:900;background:linear-gradient(180deg,#5fd0ff,#2f7fc4);box-shadow:0 5px 0 #1c4f86,0 10px 26px rgba(0,0,0,.35);display:none}
.wh-act.on{display:block;animation:whpop .25s}.wh-act kbd{font-size:13px;background:rgba(0,0,0,.25);border-radius:6px;padding:2px 7px;margin-left:8px}
.wh-act.portal{background:linear-gradient(180deg,#b9f1ff,#6fb8ff);color:#0d2448}
.wh-dlg{position:absolute;left:50%;bottom:24px;transform:translateX(-50%);width:min(620px,94vw);background:rgba(10,22,48,.93);border:2px solid rgba(160,225,255,.6);border-radius:20px;padding:16px 18px 14px;display:none;pointer-events:auto;box-shadow:0 12px 40px rgba(0,0,0,.45)}
.wh-dlg.on{display:block;animation:whpop .2s}
.wh-dlg .who{font-weight:900;font-size:17px;color:var(--ice)}.wh-dlg .say{font-size:17px;line-height:1.4;margin:8px 0 10px}
.wh-dlg .rw{display:flex;gap:10px;align-items:center;background:rgba(255,255,255,.08);border-radius:12px;padding:8px 10px;margin-bottom:12px;font-size:14px}
.wh-dlg .rw .ic{font-size:28px}.wh-dlg .rw .r{font-size:11px;text-transform:uppercase;letter-spacing:1px;font-weight:800}
.wh-dlg .btns{display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap}
.wh-dlg .btns button{min-height:54px;min-width:130px;padding:12px 22px;border-radius:16px;font-size:18px;font-weight:900;background:#33415e}
.wh-dlg .btns .go{background:linear-gradient(180deg,#7be36b,#2f9f45);box-shadow:0 4px 0 #1d6a2c}.wh-dlg .btns .gold{background:linear-gradient(180deg,#ffd34d,#f29b1c);color:#3a2300;box-shadow:0 4px 0 #a5620c}
.wh-ev{position:absolute;inset:0;background:rgba(5,12,28,.6);display:none;align-items:center;justify-content:center;pointer-events:auto}
.wh-ev.on{display:flex}
.wh-ev .card{width:min(720px,94vw);max-height:86vh;overflow:auto;background:linear-gradient(160deg,#13284f,#2a1d55);border:2px solid rgba(160,225,255,.6);border-radius:22px;padding:18px 18px 14px;box-shadow:0 18px 60px rgba(0,0,0,.5)}
.wh-ev h2{margin:0;font-size:28px;font-weight:900}.wh-ev .cd{color:var(--ice);font-weight:800;font-size:14px;margin:2px 0 12px}
.wh-ev .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px}
.wh-ev .it{background:rgba(255,255,255,.07);border:2px solid rgba(255,255,255,.12);border-radius:16px;padding:10px;font-size:13px}
.wh-ev .it .ic{font-size:34px}.wh-ev .it b{display:block;font-size:15px}.wh-ev .it .st{margin-top:6px;font-weight:800}
.wh-ev .it.done{border-color:var(--gold);background:rgba(255,211,77,.12)}
.wh-ev .rare{color:#6fb8ff}.wh-ev .epic{color:#c27bff}.wh-ev .legendary{color:#ffb347}
.wh-dlg .rare{color:#6fb8ff}.wh-dlg .epic{color:#c27bff}.wh-dlg .legendary{color:#ffb347}
.wh-ev .x{float:right;min-width:54px;min-height:54px;border-radius:14px;background:#33415e;font-size:20px;font-weight:900}
.wh-pop{position:absolute;left:50%;top:24%;transform:translateX(-50%);text-align:center;background:rgba(10,22,48,.9);border:2px solid var(--gold);border-radius:18px;padding:12px 22px;animation:whpop .3s;box-shadow:0 10px 30px rgba(0,0,0,.4)}
.wh-pop b{display:block;font-size:22px;font-weight:900}.wh-pop small{font-size:14px;opacity:.9}.wh-pop .ic{font-size:36px}
.wh-run{position:absolute;left:50%;top:10px;transform:translateX(-50%);display:none;gap:10px;align-items:center}
.wh-run.on{display:flex}.wh-run .p{background:rgba(10,22,48,.88);border:2px solid rgba(160,225,255,.6);border-radius:14px;padding:6px 14px;font-weight:900;font-size:20px;min-width:90px;text-align:center}
.wh-run .p small{display:block;font-size:10px;letter-spacing:1px;color:var(--ice)}
.wh-run button{min-height:50px;padding:8px 16px;border-radius:14px;background:#b8323a;font-weight:900;font-size:16px}
.wh-count{position:absolute;left:50%;top:38%;transform:translate(-50%,-50%);font-size:96px;font-weight:900;text-shadow:0 6px 30px rgba(0,20,60,.9);display:none}
.wh-count.on{display:block;animation:whpop .3s}
.wh-arrow{position:absolute;left:50%;top:64px;transform:translateX(-50%);background:rgba(10,22,48,.75);border-radius:12px;padding:4px 12px;font-size:13px;font-weight:800;display:none}
.wh-arrow.on{display:block}.wh-arrow span{display:inline-block;transition:transform .1s}
@keyframes whpop{from{transform:translateX(-50%) scale(.85);opacity:0}to{transform:translateX(-50%) scale(1);opacity:1}}
.wh-count.on{animation:none}
.wh.m .wh-area b{font-size:26px}.wh.m .wh-area{top:20%}
.wh.m .wh-track{top:calc(118px + env(safe-area-inset-top,0px));left:6px;width:170px;padding:5px 8px}.wh.m .wh-track .q i{display:none}.wh.m .wh-track .q{font-size:11px}
.wh.m .wh-evbtn{top:calc(118px + env(safe-area-inset-top,0px));right:6px;padding:12px 14px;font-size:15px}
.wh.m .wh-act{bottom:150px;min-width:0;width:min(78vw,340px);padding:18px 14px;font-size:20px}.wh.m .wh-act kbd{display:none}
.wh.m .wh-dlg{bottom:8px;padding:12px}.wh.m .wh-dlg .say{font-size:15px}.wh.m .wh-dlg .btns button{flex:1;min-height:58px}
.wh.m .wh-run{top:calc(4px + env(safe-area-inset-top,0px))}.wh.m .wh-run .p{font-size:16px;min-width:70px}
.wh.m .wh-ev .grid{grid-template-columns:1fr 1fr}.wh.m .wh-ev .it .ic{font-size:26px}
`;
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export class WinterUI {
  constructor({ onAction, onAccept, onTurnIn, onCloseDialog, onEvent, onExitRun, sfx }) {
    this.cb = { onAction, onAccept, onTurnIn, onCloseDialog, onEvent, onExitRun }; this.sfx = sfx || (() => {});
    this.style = document.createElement('style'); this.style.textContent = CSS; document.head.append(this.style);
    const r = this.root = document.createElement('div'); r.className = 'wh'; r.id = 'wh-ui';
    r.innerHTML = `<div class="wh-area"><small></small><b></b></div>
      <div class="wh-track" id="wh-track"></div>
      <button class="wh-evbtn" id="wh-event">❄ Winterhaven<small id="wh-evsub">Event quests</small></button>
      <div class="wh-arrow" id="wh-arrow"></div>
      <button class="wh-act" id="wh-act"></button>
      <div class="wh-dlg" id="wh-dlg"><div class="who"></div><div class="say"></div><div class="rw"></div><div class="btns"></div></div>
      <div class="wh-ev" id="wh-ev"><div class="card"><button class="x" id="wh-ev-x" aria-label="Close">✕</button><h2>❄ Winterhaven</h2><div class="cd" id="wh-cd">Loading event…</div><div class="grid" id="wh-grid"></div></div></div>
      <div class="wh-run" id="wh-run"><div class="p"><small>TIME</small><span id="wh-rt">0:00</span></div><div class="p"><small>GATES</small><span id="wh-rg">0/8</span></div><button id="wh-exit">Exit run</button></div>
      <div class="wh-count" id="wh-count"></div>`;
    (document.getElementById('app') || document.body).append(r);
    this.$ = (s) => r.querySelector(s);
    this.$('#wh-act').addEventListener('click', () => this.cb.onAction?.());
    this.$('#wh-event').addEventListener('click', () => this.cb.onEvent?.());
    this.$('#wh-ev-x').addEventListener('click', () => this.closeEvent());
    this.$('#wh-ev').addEventListener('click', (e) => { if (e.target.id === 'wh-ev') this.closeEvent(); });
    this.$('#wh-exit').addEventListener('click', () => this.cb.onExitRun?.());
    const mode = () => r.classList.toggle('m', getDeviceMode() === 'mobile'); mode(); this._off = onDeviceChange(mode);
    this.areaTimer = null; this.dialogOpen = false; this.eventOpen = false;
  }
  get mobile() { return this.root.classList.contains('m'); }
  showArea(name, sub = 'Winterhaven') {
    const el = this.$('.wh-area'); el.querySelector('b').textContent = name; el.querySelector('small').textContent = sub; el.classList.add('show');
    clearTimeout(this.areaTimer); this.areaTimer = setTimeout(() => el.classList.remove('show'), 2600);
  }
  setTracker(rows, doneN, total) {
    const el = this.$('#wh-track');
    el.innerHTML = `<h4>❄ Quests ${doneN}/${total}</h4>` + (rows.length ? rows.map(q => `<div class="q ${q.carry ? 'carry' : ''}"><span>${q.carry ? '🎒' : '📜'}</span><div><b>${esc(q.title)}</b><i>${esc(q.hint)}</i></div></div>`).join('') : `<div class="none">${doneN >= total ? 'All quests done! ✨' : 'Talk to villagers with a <b style="color:#ffd34d">!</b> above them.'}</div>`);
  }
  setAction(text, kind = 'talk', key = 'E') {
    const b = this.$('#wh-act');
    if (!text || this.dialogOpen || this.eventOpen) { b.classList.remove('on'); b.dataset.text = ''; return; }
    if (b.dataset.text === text) return; b.dataset.text = text;
    b.className = `wh-act on ${kind}`; b.innerHTML = `${esc(text)}<kbd>${key}</kbd>`;
  }
  setArrow(text, angle) { const a = this.$('#wh-arrow'); if (!text) { a.classList.remove('on'); return; } a.classList.add('on'); a.innerHTML = `<span style="transform:rotate(${angle}rad)">⬆</span> ${esc(text)}`; }
  dialog({ who, say, reward, buttons }) {
    const d = this.$('#wh-dlg'); this.dialogOpen = true; this.setAction(null);
    d.querySelector('.who').textContent = who; d.querySelector('.say').textContent = say;
    const rw = d.querySelector('.rw'); rw.style.display = reward ? 'flex' : 'none';
    if (reward) rw.innerHTML = `<span class="ic">${reward.icon || '🎁'}</span><div><div>Reward: <b>${esc(reward.name)}</b></div><div class="r ${esc(reward.rarity)}">${esc(reward.rarity)}${reward.extra ? ' · ' + esc(reward.extra) : ''}</div></div>`;
    const bt = d.querySelector('.btns'); bt.innerHTML = '';
    for (const b of buttons) { const el = document.createElement('button'); el.textContent = b.label; el.id = b.id || ''; if (b.cls) el.className = b.cls; el.addEventListener('click', b.on); bt.append(el); }
    d.classList.add('on'); this.sfx('popup_open');
  }
  closeDialog(silent = false) { if (!this.dialogOpen) return; this.dialogOpen = false; this.$('#wh-dlg').classList.remove('on'); this.$('#wh-act').dataset.text = ''; if (!silent) this.sfx('popup_close'); }
  openEvent(render) { this.eventOpen = true; this.setAction(null); this.$('#wh-ev').classList.add('on'); render?.(); this.sfx('popup_open'); }
  closeEvent() { if (!this.eventOpen) return; this.eventOpen = false; this.$('#wh-ev').classList.remove('on'); this.$('#wh-act').dataset.text = ''; this.sfx('popup_close'); }
  renderEvent(countdown, cards) {
    this.$('#wh-cd').textContent = countdown;
    this.$('#wh-grid').innerHTML = cards.map(c => `<div class="it ${c.done ? 'done' : ''}" data-q="${esc(c.questId)}"><div class="ic">${c.icon}</div><b>${esc(c.name)}</b><span class="${esc(c.rarity)}">${esc(c.rarity)}</span> · ${esc(c.earnIn || '')}<div>${esc(c.title)}: ${esc(c.description)}</div><div class="st">${esc(c.status)}</div></div>`).join('');
  }
  setEventSub(t) { this.$('#wh-evsub').textContent = t; }
  popup({ icon = '✨', title, sub = '', ms = 2600 }) {
    const p = document.createElement('div'); p.className = 'wh-pop'; p.innerHTML = `<div class="ic">${icon}</div><b>${esc(title)}</b><small>${esc(sub)}</small>`;
    this.root.querySelectorAll('.wh-pop').forEach(o => o.remove()); this.root.append(p); this.sfx('notification');
    setTimeout(() => p.remove(), ms);
  }
  runHud(on, time = '', gates = '') { const r = this.$('#wh-run'); r.classList.toggle('on', on); this.$('#wh-track').style.display = on ? 'none' : ''; this.$('#wh-event').style.display = on ? 'none' : ''; if (on) { this.$('#wh-rt').textContent = time; this.$('#wh-rg').textContent = gates; } }
  count(text) { const c = this.$('#wh-count'); if (!text) { c.classList.remove('on'); return; } c.textContent = text; c.classList.remove('on'); void c.offsetWidth; c.classList.add('on'); }
  dispose() { this._off?.(); clearTimeout(this.areaTimer); this.root.remove(); this.style.remove(); }
}
