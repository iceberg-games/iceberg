import { list as listKits } from './kits/registry.js';
import { EMOTES } from './config.js';
import { getDeviceMode } from '../../core/device.js';

const TAP = 'touch-action:manipulation;-webkit-tap-highlight-color:transparent;user-select:none;-webkit-user-select:none;';

export class RimeUI {
  constructor({ onRole, onKit, onReady, onEmote, onAbility, onLobby, engine }) {
    this.handlers = { onRole, onKit, onReady, onEmote, onAbility, onLobby };
    this.engine = engine || null;
    this.mobile = getDeviceMode() === 'mobile';
    this.interactHeld = false;
    this._kit = null;
    this.root = document.createElement('div');
    this.root.id = 'rimebound-ui';
    this.root.className = this.mobile ? 'rb m' : 'rb';
    Object.assign(this.root.style, {
      position: 'fixed', inset: '0', pointerEvents: 'none', zIndex: 40,
      fontFamily: 'system-ui,Segoe UI,sans-serif', color: '#e8f4ff',
    });
    document.body.appendChild(this.root);
    this.renderLobby({ role: null, kitId: null, ready: false });
  }

  destroy() {
    this._setInteract(false);
    this.root?.remove();
    this.root = null;
  }

  _setInteract(on) {
    this.interactHeld = !!on;
    const keys = this.engine?.input?.keys;
    if (!keys) return;
    if (on) keys.add('KeyF');
    else { keys.delete('KeyF'); keys.delete('KeyE'); }
  }

  renderLobby(state) {
    if (!this.root) return;
    this._setInteract(false);
    this.root.innerHTML = '';
    const panel = document.createElement('div');
    Object.assign(panel.style, {
      pointerEvents: 'auto', position: 'absolute', left: '50%', top: this.mobile ? '8%' : '12%',
      transform: 'translateX(-50%)', width: this.mobile ? 'min(560px,96vw)' : 'min(520px,92vw)',
      maxHeight: this.mobile ? '78vh' : 'none', overflowY: this.mobile ? 'auto' : 'visible',
      padding: this.mobile ? '14px 14px 18px' : '16px 18px',
      background: 'rgba(8,18,32,.92)', border: '1px solid #3a6a9a', borderRadius: '14px',
      boxShadow: '0 12px 40px rgba(0,0,0,.45)',
    });
    panel.innerHTML = `<div style="font-size:${this.mobile ? 20 : 22}px;font-weight:700;letter-spacing:.04em">RIMEBOUND</div>
      <div style="opacity:.75;margin:4px 0 12px">${this.mobile ? 'Tap role → kit → Ready' : 'Pick role → kit → Ready → shipyard match.'}</div>`;

    const roles = document.createElement('div');
    roles.style.cssText = `display:flex;gap:8px;${TAP}`;
    for (const r of ['survivor', 'killer']) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = r === 'survivor' ? 'Survivor' : 'Killer';
      Object.assign(b.style, btn(state.role === r, this.mobile));
      b.onclick = () => this.handlers.onRole?.(r);
      roles.appendChild(b);
    }
    panel.appendChild(roles);

    if (state.role) {
      const grid = document.createElement('div');
      Object.assign(grid.style, {
        display: 'grid',
        gridTemplateColumns: this.mobile ? '1fr' : '1fr 1fr 1fr',
        gap: '8px', marginTop: '12px',
      });
      for (const k of listKits(state.role)) {
        const card = document.createElement('button');
        card.type = 'button';
        card.innerHTML = `<div style="font-weight:700">${k.name}</div><div style="font-size:11px;opacity:.7">${k.passive.name}</div>`;
        Object.assign(card.style, { ...btn(state.kitId === k.id, this.mobile), textAlign: 'left', padding: this.mobile ? '14px 12px' : '10px' });
        card.onclick = () => this.handlers.onKit?.(k.id);
        grid.appendChild(card);
      }
      panel.appendChild(grid);
    }

    if (state.kitId) {
      const kit = listKits().find(k => k.id === state.kitId) || listKits(state.role).find(k => k.id === state.kitId);
      const lore = document.createElement('div');
      lore.style.cssText = 'margin-top:10px;font-size:12px;opacity:.85;line-height:1.35';
      lore.textContent = kit?.lore || '';
      panel.appendChild(lore);
      const abs = document.createElement('div');
      abs.style.cssText = 'margin-top:8px;font-size:12px';
      abs.innerHTML = `<b>Passive:</b> ${kit.passive.name} — ${kit.passive.desc}<br>` +
        kit.actives.map(a => `<b>${a.key}</b> ${a.name}: ${a.desc}`).join('<br>');
      panel.appendChild(abs);

      const ready = document.createElement('button');
      ready.type = 'button';
      ready.textContent = state.ready ? 'READY ✓' : 'Ready up';
      Object.assign(ready.style, { ...btn(state.ready, this.mobile), marginTop: '12px', width: '100%', minHeight: this.mobile ? '52px' : '40px', fontSize: this.mobile ? '17px' : '14px' });
      ready.onclick = () => this.handlers.onReady?.(!state.ready);
      panel.appendChild(ready);
    }

    const em = document.createElement('div');
    em.style.cssText = `display:flex;flex-wrap:wrap;gap:6px;margin-top:12px;${TAP}`;
    for (const e of EMOTES) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = e.id.replace('emote_', '') + (e.musical ? ' ♪' : '');
      Object.assign(b.style, { ...btn(false, this.mobile), fontSize: '11px', padding: this.mobile ? '10px 12px' : '6px 8px' });
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
      el.style.cssText = `position:absolute;top:${this.mobile ? 10 : 14}px;left:50%;transform:translateX(-50%);max-width:94vw;background:rgba(8,18,32,.9);padding:8px 14px;border-radius:10px;border:1px solid #3a6a9a;font-size:${this.mobile ? 12 : 13}px;font-weight:700;text-align:center;z-index:2`;
      this.root.appendChild(el);
    }
    const t = Math.max(0, Math.ceil(h.timer || 0));
    const parts = [h.role === 'killer' ? 'KILLER' : 'SURVIVOR', `Cores ${h.coresDone}/${h.coresTotal}`, `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`];
    if (h.role !== 'killer') parts.push(`HP ${Math.ceil(h.hp ?? 0)}`);
    if (h.exitOpen) parts.push('EXITS OPEN');
    let line2 = h.prompt || '';
    if (h.downed) line2 = `DOWNED — ${(Math.ceil(h.downed))}s`;
    if (h.result) line2 = h.result;
    el.innerHTML = parts.join(' · ') + (line2 ? `<div style="font-size:${this.mobile ? 14 : 15}px;color:#ffd27e;margin-top:4px;font-weight:700">${line2}</div>` : '');

    // Lobby return button when match ends — never rely on Enter alone on mobile
    let lobbyBtn = this.root.querySelector('.rb-lobby-back');
    if (h.result) {
      if (!lobbyBtn) {
        lobbyBtn = document.createElement('button');
        lobbyBtn.type = 'button';
        lobbyBtn.className = 'rb-lobby-back';
        lobbyBtn.textContent = 'Back to lobby';
        Object.assign(lobbyBtn.style, {
          ...btn(true, true), pointerEvents: 'auto', position: 'absolute',
          left: '50%', top: this.mobile ? '42%' : '48%', transform: 'translate(-50%,-50%)',
          zIndex: 5, minWidth: '200px', minHeight: '52px', fontSize: '16px',
        });
        lobbyBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); });
        lobbyBtn.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); this.handlers.onLobby?.(); });
        this.root.appendChild(lobbyBtn);
      }
    } else if (lobbyBtn) {
      lobbyBtn.remove();
    }
  }

  /** Persist ability bar — update labels only. Never wipe root (fixes disappearing touch buttons). */
  renderMatch(kit, cds = {}) {
    if (!this.root || !kit) return;
    this._kit = kit;

    // Drop lobby panel once, keep hud/abil/interact
    for (const ch of [...this.root.children]) {
      if (!ch.classList.contains('rb-hud') && !ch.classList.contains('rb-abil') && !ch.classList.contains('rb-interact') && !ch.classList.contains('rb-lobby-back') && !ch.classList.contains('rb-emotes')) ch.remove();
    }

    let bar = this.root.querySelector('.rb-abil');
    if (!bar) {
      bar = document.createElement('div');
      bar.className = 'rb-abil';
      Object.assign(bar.style, {
        pointerEvents: 'auto', position: 'absolute',
        left: this.mobile ? '12px' : '50%',
        right: this.mobile ? '12px' : 'auto',
        bottom: this.mobile ? '118px' : '18px',
        transform: this.mobile ? 'none' : 'translateX(-50%)',
        display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center',
        background: 'rgba(8,18,32,.88)', padding: this.mobile ? '10px' : '10px 12px',
        borderRadius: '12px', border: '1px solid #3a6a9a', zIndex: 3,
      });
      this.root.appendChild(bar);
      // build buttons once
      const label = document.createElement('div');
      label.className = 'rb-abil-label';
      label.style.cssText = 'align-self:center;font-weight:700;margin-right:4px;width:100%;text-align:center';
      bar.appendChild(label);
      for (const a of kit.actives) {
        const b = document.createElement('button');
        b.type = 'button';
        b.dataset.abil = a.id;
        Object.assign(b.style, { ...btn(false, this.mobile), flex: this.mobile ? '1 1 40%' : '0 0 auto', minHeight: this.mobile ? '52px' : '40px', fontSize: this.mobile ? '15px' : '13px' });
        const fire = (e) => {
          e.preventDefault(); e.stopPropagation();
          if (b.disabled) return;
          this.handlers.onAbility?.(a.id);
        };
        b.addEventListener('pointerdown', fire);
        bar.appendChild(b);
      }
    }

    const label = bar.querySelector('.rb-abil-label');
    if (label) label.textContent = kit.name;
    for (const a of kit.actives) {
      const b = bar.querySelector(`[data-abil="${a.id}"]`);
      if (!b) continue;
      const left = cds[a.id] || 0;
      b.textContent = left > 0 ? `${a.name} ${Math.ceil(left)}s` : a.name;
      b.disabled = left > 0;
      b.style.opacity = left > 0 ? '0.55' : '1';
    }

    // Mobile INTERACT hold (feeds KeyF into engine.input)
    if (this.mobile) {
      let hold = this.root.querySelector('.rb-interact');
      if (!hold) {
        hold = document.createElement('button');
        hold.type = 'button';
        hold.className = 'rb-interact';
        hold.textContent = 'HOLD\nUSE';
        Object.assign(hold.style, {
          pointerEvents: 'auto', position: 'absolute', right: '18px', bottom: '28px',
          width: '86px', height: '86px', borderRadius: '50%', zIndex: 4,
          border: '2px solid #7ec8ff', background: 'rgba(30,70,110,.85)',
          color: '#e8f4ff', fontWeight: 800, fontSize: '13px', lineHeight: 1.15,
          whiteSpace: 'pre-line', ...Object.fromEntries(TAP.split(';').filter(Boolean).map(s => {
            const [k, v] = s.split(':'); return [k.replace(/-([a-z])/g, (_, c) => c.toUpperCase()).replace(/^webkit/, 'Webkit').replace(/^WebkitTapHighlightColor/, 'WebkitTapHighlightColor'), v];
          }).filter(([k]) => k)),
        });
        // simpler style merge for tap
        hold.style.touchAction = 'manipulation';
        hold.style.webkitUserSelect = 'none';
        hold.style.userSelect = 'none';

        const down = (e) => { e.preventDefault(); e.stopPropagation(); this._setInteract(true); hold.style.background = 'rgba(80,150,210,.95)'; };
        const up = (e) => { e.preventDefault(); e.stopPropagation(); this._setInteract(false); hold.style.background = 'rgba(30,70,110,.85)'; };
        hold.addEventListener('pointerdown', down);
        for (const n of ['pointerup', 'pointercancel', 'pointerleave', 'lostpointercapture']) hold.addEventListener(n, up);
        this.root.appendChild(hold);
      }
    }
  }
}

function btn(on, mobile = false) {
  return {
    cursor: 'pointer',
    touchAction: 'manipulation',
    WebkitTapHighlightColor: 'transparent',
    userSelect: 'none',
    border: on ? '1px solid #7ec8ff' : '1px solid #3a6a9a',
    background: on ? 'rgba(50,110,170,.55)' : 'rgba(20,40,70,.7)',
    color: '#e8f4ff', borderRadius: '10px',
    padding: mobile ? '12px 14px' : '8px 12px',
    fontWeight: 600,
    fontSize: mobile ? '15px' : '14px',
  };
}
