import { list as listKits } from './kits/registry.js';
import { EMOTES } from './config.js';
import { getDeviceMode, onDeviceChange } from '../../core/device.js';

function isMobile() {
  try {
    if (getDeviceMode() === 'mobile') return true;
    return (navigator.maxTouchPoints > 0) || ('ontouchstart' in window);
  } catch { return getDeviceMode() === 'mobile'; }
}

export class RimeUI {
  constructor({ onRole, onKit, onReady, onEmote, onAbility, onUse, onLobby }) {
    this.handlers = { onRole, onKit, onReady, onEmote, onAbility, onUse, onLobby };
    this.root = document.createElement('div');
    this.root.id = 'rimebound-ui';
    // z-index below shared #touch-ui (90) so joystick/jump never get buried
    Object.assign(this.root.style, {
      position: 'fixed', inset: '0', pointerEvents: 'none', zIndex: 35,
      fontFamily: 'system-ui,Segoe UI,sans-serif', color: '#e8f4ff',
    });
    document.body.appendChild(this.root);
    this._cds = {};
    this._lobby = { role: null, kitId: null, ready: false };
    this._off = onDeviceChange(() => {
      if (this._phase === 'match' && this._kit) this.renderMatch(this._kit, this._cds);
      else if (this._phase !== 'match') this.renderLobby(this._lobby);
    });
    this._phase = 'lobby';
    this._kit = null;
    this.renderLobby(this._lobby);
  }

  destroy() { this._off?.(); this.root?.remove(); this.root = null; }

  renderLobby(state) {
    if (!this.root) return;
    this._phase = 'lobby';
    this._lobby = { ...state };
    this.root.innerHTML = '';
    const m = isMobile();
    const panel = document.createElement('div');
    Object.assign(panel.style, {
      pointerEvents: 'auto', position: 'absolute', left: '50%', top: m ? '8%' : '12%',
      transform: 'translateX(-50%)', width: m ? 'min(560px,96vw)' : 'min(520px,92vw)',
      maxHeight: m ? '62vh' : '78vh', overflowY: 'auto', WebkitOverflowScrolling: 'touch',
      padding: m ? '14px 14px 18px' : '16px 18px',
      background: 'rgba(8,18,32,.92)', border: '1px solid #3a6a9a', borderRadius: '14px',
      boxShadow: '0 12px 40px rgba(0,0,0,.45)',
      // leave bottom clear for joystick / jump / toolbar
      marginBottom: m ? '170px' : '0',
    });
    panel.innerHTML = `<div style="font-size:${m ? 20 : 22}px;font-weight:700;letter-spacing:.04em">RIMEBOUND</div>
      <div style="opacity:.75;margin:4px 0 12px;font-size:${m ? 13 : 14}px">Pick role → kit → Ready → shipyard match.</div>`;

    const roles = document.createElement('div');
    roles.style.cssText = `display:flex;gap:10px;${m ? 'flex-direction:column' : ''}`;
    for (const r of ['survivor', 'killer']) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = r === 'survivor' ? 'Survivor' : 'Killer';
      Object.assign(b.style, btn(state.role === r, m));
      b.style.flex = '1';
      b.onclick = () => this.handlers.onRole?.(r);
      roles.appendChild(b);
    }
    panel.appendChild(roles);

    if (state.role) {
      const grid = document.createElement('div');
      Object.assign(grid.style, {
        display: 'grid',
        gridTemplateColumns: m ? '1fr' : '1fr 1fr 1fr',
        gap: '10px', marginTop: '12px',
      });
      for (const k of listKits(state.role)) {
        const card = document.createElement('button');
        card.type = 'button';
        card.innerHTML = `<div style="font-weight:700;font-size:${m ? 16 : 14}px">${k.name}</div><div style="font-size:${m ? 13 : 11}px;opacity:.7">${k.passive.name}</div>`;
        Object.assign(card.style, { ...btn(state.kitId === k.id, m), textAlign: 'left', padding: m ? '14px 16px' : '10px' });
        card.onclick = () => this.handlers.onKit?.(k.id);
        grid.appendChild(card);
      }
      panel.appendChild(grid);
    }

    if (state.kitId) {
      const kit = listKits().find(k => k.id === state.kitId) || listKits(state.role).find(k => k.id === state.kitId);
      const lore = document.createElement('div');
      lore.style.cssText = `margin-top:10px;font-size:${m ? 13 : 12}px;opacity:.85;line-height:1.35`;
      lore.textContent = kit?.lore || '';
      panel.appendChild(lore);
      const abs = document.createElement('div');
      abs.style.cssText = `margin-top:8px;font-size:${m ? 13 : 12}px`;
      abs.innerHTML = `<b>Passive:</b> ${kit.passive.name} — ${kit.passive.desc}<br>` +
        kit.actives.map(a => `<b>${a.key}</b> ${a.name}: ${a.desc}`).join('<br>');
      panel.appendChild(abs);

      const ready = document.createElement('button');
      ready.type = 'button';
      ready.textContent = state.ready ? 'READY ✓' : 'Ready up';
      Object.assign(ready.style, { ...btn(state.ready, m), marginTop: '14px', width: '100%', fontSize: m ? '18px' : '15px', padding: m ? '16px' : '10px 12px' });
      ready.onclick = () => this.handlers.onReady?.(!state.ready);
      panel.appendChild(ready);
    }

    const em = document.createElement('div');
    em.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px;margin-top:12px';
    for (const e of EMOTES) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = e.id.replace('emote_', '') + (e.musical ? ' ♪' : '');
      Object.assign(b.style, { ...btn(false, m), fontSize: m ? '13px' : '11px', padding: m ? '10px 12px' : '6px 8px' });
      b.onclick = () => this.handlers.onEmote?.(e.id);
      em.appendChild(b);
    }
    panel.appendChild(em);
    this.root.appendChild(panel);
  }

  renderHud(h = {}) {
    if (!this.root) return;
    let el = this.root.querySelector('.rb-hud');
    if (!el) {
      el = document.createElement('div');
      el.className = 'rb-hud';
      el.style.cssText = 'position:absolute;top:max(10px,env(safe-area-inset-top));left:50%;transform:translateX(-50%);background:rgba(8,18,32,.88);padding:8px 14px;border-radius:10px;border:1px solid #3a6a9a;font-size:13px;font-weight:700;max-width:94vw;text-align:center;pointer-events:none';
      this.root.appendChild(el);
    }
    const t = Math.max(0, Math.ceil(h.timer || 0));
    const parts = [h.role === 'killer' ? 'KILLER' : 'SURVIVOR', `Cores ${h.coresDone}/${h.coresTotal}`, `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`];
    if (h.role !== 'killer') parts.push(`HP ${Math.ceil(h.hp)}`);
    if (h.exitOpen) parts.push('EXITS OPEN');
    let line2 = h.prompt || '';
    if (h.downed) line2 = `DOWNED — hold for revive (${Math.ceil(h.downed)}s)`;
    if (h.result) line2 = h.result + (isMobile() ? ' — tap Lobby' : ' — press Enter for lobby');
    el.innerHTML = parts.join(' · ') + (line2 ? `<div style="font-size:15px;color:#ffd27e;margin-top:4px">${line2}</div>` : '');
    if (h.result && isMobile()) {
      let lb = this.root.querySelector('.rb-lobby-btn');
      if (!lb) {
        lb = document.createElement('button');
        lb.type = 'button';
        lb.className = 'rb-lobby-btn';
        lb.textContent = 'Back to Lobby';
        Object.assign(lb.style, { ...btn(true, true), pointerEvents: 'auto', position: 'absolute', left: '50%', top: '28%', transform: 'translateX(-50%)', zIndex: 2 });
        lb.onclick = () => this.handlers.onLobby?.();
        this.root.appendChild(lb);
      }
    }
  }

  renderMatch(kit, cds = {}) {
    if (!this.root || !kit) return;
    this._phase = 'match';
    this._kit = kit;
    this._cds = { ...cds };
    const hud = this.root.querySelector('.rb-hud');
    this.root.innerHTML = '';
    if (hud) this.root.appendChild(hud);
    const m = isMobile();

    // Ability bar — sit ABOVE joystick/jump (touch-ui bottom ~28–40px + 130px)
    const bar = document.createElement('div');
    Object.assign(bar.style, {
      pointerEvents: 'auto', position: 'absolute', left: '50%',
      bottom: m ? '168px' : '88px',
      transform: 'translateX(-50%)', display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center',
      background: 'rgba(8,18,32,.85)', padding: m ? '12px 14px' : '10px 12px', borderRadius: '14px',
      border: '1px solid #3a6a9a', maxWidth: '94vw',
    });
    const label = document.createElement('div');
    label.textContent = kit.name;
    label.style.cssText = `align-self:center;font-weight:700;margin-right:6px;font-size:${m ? 15 : 13}px`;
    bar.appendChild(label);
    for (const a of kit.actives) {
      const b = document.createElement('button');
      b.type = 'button';
      const left = cds[a.id] || 0;
      b.textContent = left > 0 ? `${a.key} ${Math.ceil(left)}s` : `${a.key} ${a.name}`;
      Object.assign(b.style, btn(false, m));
      if (m) { b.style.minWidth = '72px'; b.style.minHeight = '52px'; b.style.fontSize = '15px'; }
      b.disabled = left > 0;
      b.onclick = () => this.handlers.onAbility?.(a.id);
      bar.appendChild(b);
    }
    this.root.appendChild(bar);

    // Big USE / interact (hold) — right side above jump so mobile can thaw/strike without keyboard
    const use = document.createElement('button');
    use.type = 'button';
    use.textContent = 'USE';
    use.setAttribute('aria-label', 'Hold to use / interact');
    Object.assign(use.style, {
      ...btn(true, true),
      pointerEvents: 'auto',
      position: 'absolute',
      right: m ? '22px' : '120px',
      bottom: m ? '140px' : '40px',
      width: m ? '78px' : '64px',
      height: m ? '78px' : '64px',
      borderRadius: '50%',
      fontSize: '15px',
      padding: '0',
      touchAction: 'none',
      zIndex: 2,
    });
    const hold = (on) => (e) => {
      e.preventDefault();
      this.handlers.onUse?.(on);
    };
    use.addEventListener('pointerdown', hold(true));
    use.addEventListener('pointerup', hold(false));
    use.addEventListener('pointercancel', hold(false));
    use.addEventListener('pointerleave', hold(false));
    this.root.appendChild(use);
  }
}

function btn(on, mobile = false) {
  return {
    cursor: 'pointer',
    border: on ? '1px solid #7ec8ff' : '1px solid #3a6a9a',
    background: on ? 'rgba(50,110,170,.55)' : 'rgba(20,40,70,.7)',
    color: '#e8f4ff',
    borderRadius: '12px',
    padding: mobile ? '12px 14px' : '8px 12px',
    fontWeight: 700,
    touchAction: 'manipulation',
    WebkitTapHighlightColor: 'transparent',
    userSelect: 'none',
  };
}
