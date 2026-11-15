// Pengu Plaza BIG — photo album: a page per area (silhouettes for undiscovered entries, best shot + stars for found
// ones), a map page and a rewards/customise page. DOM is built once; only the open page's body re-renders.
import { TARGETS, ALBUM_PAGES, RARITY } from './targets.js';
import { REWARDS, FILTERS, FRAMES, TITLES, areaDone, totals, owned, unlockLabel } from './rewards.js';
import * as A from './set/areas.js';
const THUMBS = 'iceberg:v1:pengu-plaza:thumbs';
export function loadThumbs() { try { return JSON.parse(localStorage.getItem(THUMBS) || '{}') || {}; } catch { return {}; } }
export function saveThumbs(t) { try { localStorage.setItem(THUMBS, JSON.stringify(t)); return true; } catch { return false; } }
const CSS = `
.ppa{position:fixed;inset:0;z-index:60;display:none;align-items:center;justify-content:center;background:#06102acc;font-family:system-ui,'Segoe UI',sans-serif;color:#173a6e;pointer-events:auto}
.ppa.on{display:flex}
.ppa *{box-sizing:border-box}
.ppa-book{width:min(96vw,980px);height:min(92vh,700px);background:linear-gradient(#f6fbff,#dcefff);border:5px solid #fff;border-radius:26px;box-shadow:0 16px 60px #000a;display:flex;flex-direction:column;overflow:hidden;animation:ppa-in .3s cubic-bezier(.3,1.4,.5,1)}
@keyframes ppa-in{from{transform:scale(.9) rotateX(10deg);opacity:0}}
.ppa-hd{display:flex;align-items:center;gap:10px;padding:12px 16px 6px;flex-wrap:wrap}
.ppa-hd h2{margin:0;font-size:24px;flex:1;min-width:160px}
.ppa-pill{background:#173a6e;color:#fff;border-radius:999px;padding:5px 12px;font-weight:800;font-size:13px;white-space:nowrap}
.ppa-x{min-width:48px;min-height:48px;border-radius:14px;border:3px solid #fff;background:linear-gradient(#ff8fa8,#e0435f);color:#fff;font-size:22px;font-weight:900;cursor:pointer;box-shadow:0 4px 0 #8a2a3a}
.ppa-tabs{display:flex;gap:6px;padding:4px 12px 8px;overflow-x:auto;scrollbar-width:thin}
.ppa-tab{flex:none;border:2px solid #9fd0ff;background:#fff;color:#173a6e;border-radius:14px;padding:6px 10px;font-weight:800;font-size:13px;cursor:pointer;min-height:44px;display:flex;align-items:center;gap:5px}
.ppa-tab.on{background:linear-gradient(#8fd8ff,#3c8be6);color:#fff;border-color:#fff;box-shadow:0 3px 0 #1d4f9a}
.ppa-tab i{font-style:normal;font-size:11px;opacity:.85}
.ppa-body{flex:1;overflow-y:auto;padding:6px 16px 18px}
.ppa-pg{display:flex;align-items:center;gap:12px;margin:4px 0 10px}
.ppa-pg h3{margin:0;font-size:20px}
.ppa-bar{flex:1;height:14px;border-radius:999px;background:#c9def5;overflow:hidden;max-width:300px}
.ppa-bar b{display:block;height:100%;background:linear-gradient(90deg,#7fffc8,#2fbf78);border-radius:999px;transition:width .4s}
.ppa-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px}
.ppa-c{position:relative;background:#fff;border-radius:14px;padding:6px;box-shadow:0 3px 10px #173a6e22;border:3px solid var(--rc,#bfe3ff);min-height:150px;display:flex;flex-direction:column;gap:3px}
.ppa-c .ph{height:88px;border-radius:9px;overflow:hidden;display:grid;place-items:center;font-size:46px;background:linear-gradient(135deg,#2c4a80,#5b86d1)}
.ppa-c .ph img{width:100%;height:100%;object-fit:cover}
.ppa-c.no .ph{background:repeating-linear-gradient(45deg,#e3eefb,#e3eefb 8px,#d6e5f7 8px,#d6e5f7 16px)}
.ppa-c.no .ph span{filter:brightness(0);opacity:.28}
.ppa-c b{font-size:13px;line-height:1.15}
.ppa-c .st{color:#ffb400;font-size:14px;letter-spacing:1px}
.ppa-c .rr{position:absolute;top:10px;right:10px;font-size:10px;font-weight:900;border-radius:999px;padding:2px 7px;background:var(--rc);color:#173a6e;text-transform:uppercase}
.ppa-c .hint{font-size:11px;opacity:.75;line-height:1.2}
.ppa-c .bn{position:absolute;top:10px;left:10px;font-size:11px;background:#ffd76a;border-radius:999px;padding:1px 6px;font-weight:800}
.ppa-c.leg{box-shadow:0 0 0 2px #ffd76a,0 0 18px #ffd76a99}
.ppa-rw{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:10px}
.ppa-r{display:flex;gap:10px;align-items:center;background:#fff;border-radius:14px;padding:8px 10px;border:2px solid #cfe2f7}
.ppa-r .ic{font-size:28px}.ppa-r.got{border-color:#7fffc8;background:#effff7}.ppa-r:not(.got){opacity:.7}
.ppa-r small{display:block;font-size:11px;opacity:.75}
.ppa-sec{margin:16px 0 8px;font-size:17px}
.ppa-chips{display:flex;flex-wrap:wrap;gap:8px}
.ppa-chip{border:2px solid #9fd0ff;background:#fff;border-radius:999px;padding:8px 12px;font-weight:800;font-size:13px;cursor:pointer;min-height:40px;color:#173a6e}
.ppa-chip.on{background:#173a6e;color:#fff;border-color:#173a6e}.ppa-chip:disabled{opacity:.4;cursor:default}
.ppa-map{width:100%;max-width:620px;aspect-ratio:1;display:block;margin:0 auto;border-radius:18px;background:#e9f2ff}
@media (max-width:560px){.ppa-grid{grid-template-columns:repeat(2,1fr);gap:8px}.ppa-c .ph{height:70px}.ppa-hd h2{font-size:19px}}
`;
const el = (t, c, h = '') => { const e = document.createElement(t); if (c) e.className = c; e.innerHTML = h; return e; };
const stars = (n) => '★'.repeat(n) + '☆'.repeat(3 - n);
export class AlbumUI {
  constructor({ getSave, getThumbs, getPlayer, onSelect, onFlip, onClose }) {
    Object.assign(this, { getSave, getThumbs, getPlayer, onSelect, onFlip, onClose });
    this.style = el('style', '', CSS); document.head.appendChild(this.style);
    this.root = el('div', 'ppa'); this.root.innerHTML = '<div class="ppa-book"><div class="ppa-hd"><h2>📖 Photo Album</h2><span class="ppa-pill" data-k="tot"></span><span class="ppa-pill" data-k="ttl"></span><button class="ppa-x" aria-label="Close">✖</button></div><div class="ppa-tabs"></div><div class="ppa-body"></div></div>';
    document.body.appendChild(this.root);
    this.tabs = this.root.querySelector('.ppa-tabs'); this.body = this.root.querySelector('.ppa-body'); this.tot = this.root.querySelector('[data-k=tot]'); this.ttl = this.root.querySelector('[data-k=ttl]');
    const stop = (e) => e.stopPropagation(); ['pointerdown', 'keydown', 'wheel'].forEach(k => this.root.addEventListener(k, stop));
    this.root.querySelector('.ppa-x').addEventListener('click', () => this.close());
    this.root.addEventListener('click', (e) => { if (e.target === this.root) this.close(); });
    this.pages = [{ id: 'map', name: 'Map', icon: '🗺' }, ...ALBUM_PAGES, { id: 'rewards', name: 'Rewards', icon: '🎁' }];
    this.tabEls = this.pages.map(p => { const b = el('button', 'ppa-tab', `${p.icon} ${p.name}<i></i>`); b.addEventListener('click', () => { if (this.page !== p.id) { this.onFlip?.(); this.show(p.id); } }); this.tabs.appendChild(b); return b; });
    this.page = 'plaza'; this.isOpen = false;
  }
  open(page) { this.isOpen = true; this.root.classList.add('on'); this.show(page || this.page); }
  close() { if (!this.isOpen) return; this.isOpen = false; this.root.classList.remove('on'); this.onClose?.(); }
  refresh() { if (this.isOpen) this.show(this.page); }
  show(id) {
    this.page = id; const s = this.getSave(), T = totals(s);
    this.tot.textContent = `${T.got}/${T.total} · ${T.pct}%`; this.ttl.textContent = `🏷 ${s.title}`;
    this.pages.forEach((p, i) => { const b = this.tabEls[i]; b.classList.toggle('on', p.id === id); const d = ALBUM_PAGES.find(a => a.id === p.id) ? areaDone(s, p.id) : null; b.querySelector('i').textContent = d ? `${Math.floor(100 * d.got / d.total)}%` : ''; });
    this.body.innerHTML = ''; this.body.scrollTop = 0;
    if (id === 'map') return this._map(s);
    if (id === 'rewards') return this._rewards(s);
    this._area(s, id);
  }
  _area(s, id) {
    const page = ALBUM_PAGES.find(p => p.id === id), d = areaDone(s, id), thumbs = this.getThumbs();
    this.body.appendChild(el('div', 'ppa-pg', `<h3>${page.icon} ${page.name}</h3><div class="ppa-bar"><b style="width:${100 * d.got / d.total}%"></b></div><b>${d.got}/${d.total}</b>${s.areas.includes(id) || id === 'plaza' ? '' : '<span class="ppa-pill">not visited yet</span>'}`));
    const grid = el('div', 'ppa-grid');
    for (const t of TARGETS.filter(x => x.area === id)) {
      const e = s.album[t.id], R = RARITY[t.rarity], c = el('div', 'ppa-c' + (e ? '' : ' no') + (e && t.rarity === 'legendary' ? ' leg' : '')); c.style.setProperty('--rc', R.color);
      if (e) c.innerHTML = `<div class="ph">${thumbs[t.id] ? `<img src="${thumbs[t.id]}" alt="">` : `<span>${t.icon}</span>`}</div><span class="rr">${R.label}</span>${e[3] && t.bonus ? `<span class="bn">✨ ${t.bonus}</span>` : ''}<b>${t.icon} ${t.name}</b><span class="st">${stars(e[1])} <small style="color:#173a6e99">${e[0]} pts</small></span>`;
      else c.innerHTML = `<div class="ph"><span>${t.icon}</span></div><span class="rr">${R.label}</span><b>???</b><span class="hint">💡 ${t.hint}</span>`;
      grid.appendChild(c);
    }
    this.body.appendChild(grid);
  }
  _rewards(s) {
    const T = totals(s);
    this.body.appendChild(el('div', 'ppa-pg', `<h3>🎁 Rewards</h3><span class="ppa-pill">⭐ ${T.stars3} perfect shots</span><span class="ppa-pill">🏅 ${T.legend}/3 legendary</span>`));
    const rw = el('div', 'ppa-rw');
    for (const r of REWARDS) { const got = s.rewards.includes(r.id); rw.appendChild(el('div', 'ppa-r' + (got ? ' got' : ''), `<span class="ic">${got ? r.icon : '🔒'}</span><div><b>${r.name}</b>${r.bb ? ` · +${r.bb} BB` : ''}<small>${r.desc}</small>${r.unlock ? `<small>${unlockLabel(r.unlock)}</small>` : ''}</div>${got ? '<b style="margin-left:auto;color:#2fbf78">✓</b>' : ''}`)); }
    this.body.appendChild(rw);
    const chips = (title, list, kind, cur, label) => { this.body.appendChild(el('h4', 'ppa-sec', title)); const row = el('div', 'ppa-chips'); for (const it of list) { const id = it.id ?? it, b = el('button', 'ppa-chip' + (cur === id ? ' on' : ''), label(it)); b.disabled = !owned(s, kind, id); b.addEventListener('click', () => { this.onSelect?.(kind, id); this.show('rewards'); }); row.appendChild(b); } this.body.appendChild(row); };
    chips('🎞 Camera filter', FILTERS, 'filter', s.filter, f => f.name);
    chips('🖼 Photo frame', FRAMES, 'frame', s.frame, f => f.name);
    chips('🏷 Title', TITLES, 'title', s.title, t => t);
  }
  _map(s) {
    const T = totals(s); this.body.appendChild(el('div', 'ppa-pg', `<h3>🗺 Map</h3><span class="ppa-pill">${T.got}/${T.total} photographed</span>`));
    const cv = el('canvas', 'ppa-map'); cv.width = cv.height = 620; this.body.appendChild(cv); const g = cv.getContext('2d'), S = 620 / 260, X = (x) => 310 + x * S, Z = (z) => 310 - z * S;
    g.fillStyle = '#e9f2ff'; g.fillRect(0, 0, 620, 620); g.fillStyle = '#2f6fb3'; g.fillRect(X(A.HARBOR.shoreX), 0, 620, 620);
    g.strokeStyle = '#b8c9e6'; g.lineCap = 'round'; for (const p of A.PATHS) { g.lineWidth = p.w * S; g.beginPath(); p.pts.forEach(([x, z], i) => i ? g.lineTo(X(x), Z(z)) : g.moveTo(X(x), Z(z))); g.stroke(); }
    g.lineWidth = 2; g.strokeStyle = '#2b4a7a';
    const disc = (x, z, r, fill, label, pct, seen) => { g.fillStyle = fill; g.beginPath(); g.arc(X(x), Z(z), r * S, 0, 7); g.fill(); g.stroke(); g.fillStyle = '#173a6e'; g.font = '800 15px system-ui'; g.textAlign = 'center'; g.fillText(seen ? label : '???', X(x), Z(z) - 4); g.font = '700 13px system-ui'; g.fillText(`${pct}%`, X(x), Z(z) + 14); };
    const dPl = areaDone(s, 'plaza'); disc(0, 0, 34, '#cfe0f7', '🐧 Pengu Plaza', Math.floor(100 * dPl.got / dPl.total), true);
    for (const a of A.AREAS_BIG) { const d = areaDone(s, a.id); disc(a.x, a.z, a.r, a.id === 'grotto' ? '#b9b3e6' : a.id === 'harbor' ? '#cfe6ff' : a.id === 'village' ? '#ffe0cc' : a.id === 'woods' ? '#cfe9df' : '#dbe8ff', `${a.icon} ${a.name}`, Math.floor(100 * d.got / d.total), s.areas.includes(a.id)); }
    const p = this.getPlayer(); g.fillStyle = '#e0435f'; g.beginPath(); g.arc(X(p.x), Z(p.z), 8, 0, 7); g.fill(); g.fillStyle = '#fff'; g.font = '800 11px system-ui'; g.fillText('YOU', X(p.x), Z(p.z) - 12);
    this.body.appendChild(el('p', '', '<small>North is up — Aurora Ridge is through the plaza arch. Undiscovered places show ???.</small>'));
  }
  dispose() { this.root.remove(); this.style.remove(); }
}
