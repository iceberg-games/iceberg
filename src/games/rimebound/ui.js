import { list as listKits } from './kits/registry.js';
import { EMOTES } from './config.js';

export class RimeUI {
  constructor({ onRole, onKit, onReady, onEmote, onAbility }) {
    this.handlers = { onRole, onKit, onReady, onEmote, onAbility };
    this.root = document.createElement('div');
    this.root.id = 'rimebound-ui';
    Object.assign(this.root.style, {
      position: 'fixed', inset: '0', pointerEvents: 'none', zIndex: 40,
      fontFamily: 'system-ui,Segoe UI,sans-serif', color: '#e8f4ff',
    });
    document.body.appendChild(this.root);
    this._cds = {};
    this.renderLobby({ role: null, kitId: null, ready: false });
  }

  destroy() { this.root?.remove(); this.root = null; }

  renderLobby(state) {
    if (!this.root) return;
    this.root.innerHTML = '';
    const panel = document.createElement('div');
    Object.assign(panel.style, {
      pointerEvents: 'auto', position: 'absolute', left: '50%', top: '12%',
      transform: 'translateX(-50%)', width: 'min(520px,92vw)', padding: '16px 18px',
      background: 'rgba(8,18,32,.88)', border: '1px solid #3a6a9a', borderRadius: '14px',
      boxShadow: '0 12px 40px rgba(0,0,0,.45)',
    });
    panel.innerHTML = `<div style="font-size:22px;font-weight:700;letter-spacing:.04em">RIMEBOUND</div>
      <div style="opacity:.75;margin:4px 0 12px">Pick role → kit → Ready. Match loop: GM1.</div>`;

    const roles = document.createElement('div');
    roles.style.display = 'flex'; roles.style.gap = '8px';
    for (const r of ['survivor', 'killer']) {
      const b = document.createElement('button');
      b.textContent = r === 'survivor' ? 'Survivor' : 'Killer';
      Object.assign(b.style, btn(state.role === r));
      b.onclick = () => this.handlers.onRole?.(r);
      roles.appendChild(b);
    }
    panel.appendChild(roles);

    if (state.role) {
      const grid = document.createElement('div');
      Object.assign(grid.style, { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginTop: '12px' });
      for (const k of listKits(state.role)) {
        const card = document.createElement('button');
        card.innerHTML = `<div style="font-weight:700">${k.name}</div><div style="font-size:11px;opacity:.7">${k.passive.name}</div>`;
        Object.assign(card.style, { ...btn(state.kitId === k.id), textAlign: 'left', padding: '10px' });
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
      ready.textContent = state.ready ? 'READY ✓' : 'Ready up';
      Object.assign(ready.style, { ...btn(state.ready), marginTop: '12px', width: '100%' });
      ready.onclick = () => this.handlers.onReady?.(!state.ready);
      panel.appendChild(ready);
    }

    // emotes
    const em = document.createElement('div');
    em.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;margin-top:12px';
    for (const e of EMOTES) {
      const b = document.createElement('button');
      b.textContent = e.id.replace('emote_', '') + (e.musical ? ' ♪' : '');
      Object.assign(b.style, { ...btn(false), fontSize: '11px', padding: '6px 8px' });
      b.onclick = () => this.handlers.onEmote?.(e.id);
      em.appendChild(b);
    }
    panel.appendChild(em);
    this.root.appendChild(panel);
  }

  renderMatch(kit, cds = {}) {
    if (!this.root || !kit) return;
    this.root.innerHTML = '';
    const bar = document.createElement('div');
    Object.assign(bar.style, {
      pointerEvents: 'auto', position: 'absolute', left: '50%', bottom: '18px',
      transform: 'translateX(-50%)', display: 'flex', gap: '8px',
      background: 'rgba(8,18,32,.8)', padding: '10px 12px', borderRadius: '12px',
      border: '1px solid #3a6a9a',
    });
    const label = document.createElement('div');
    label.textContent = kit.name;
    label.style.cssText = 'align-self:center;font-weight:700;margin-right:8px';
    bar.appendChild(label);
    for (const a of kit.actives) {
      const b = document.createElement('button');
      const left = cds[a.id] || 0;
      b.textContent = left > 0 ? `${a.key} ${Math.ceil(left)}s` : `${a.key} ${a.name}`;
      Object.assign(b.style, btn(false));
      b.disabled = left > 0;
      b.onclick = () => this.handlers.onAbility?.(a.id);
      bar.appendChild(b);
    }
    const wait = document.createElement('div');
    wait.style.cssText = 'position:absolute;top:14px;left:50%;transform:translateX(-50%);background:rgba(8,18,32,.85);padding:8px 14px;border-radius:10px;border:1px solid #3a6a9a;font-size:13px';
    wait.textContent = 'Lobby ready — waiting for match (GM1 loop)';
    this.root.appendChild(wait);
    this.root.appendChild(bar);
  }
}

function btn(on) {
  return {
    cursor: 'pointer', border: on ? '1px solid #7ec8ff' : '1px solid #3a6a9a',
    background: on ? 'rgba(50,110,170,.55)' : 'rgba(20,40,70,.7)',
    color: '#e8f4ff', borderRadius: '10px', padding: '8px 12px', fontWeight: 600,
  };
}
