// Title screen + Games menu (the platform home screen).
import { h, clear } from './dom.js';
import { plusBadge } from '../core/plus.js';
import { confirmModal } from './overlay.js';
import { isMobile, onDeviceChange } from '../core/device.js';
import { gameThumb } from './thumbs.js';
import { fmt, CURRENCY } from '../core/currency.js';
import { bus } from '../core/events.js';
import { BUILTIN_GAMES, CREATOR, allGames } from '../games/registry.js';
import { TEMPLATES, newGameDoc, customGameDef } from '../games/customGame.js';
import { backend } from '../backend/LocalBackend.js';
import { exportGameJSON, importGameJSON, downloadText } from '../core/share.js';

export class Menu {
  constructor(root, { economy, models, ui, onPlay, onEdit, onStart }) {
    Object.assign(this, { root, economy, models, ui, onPlay, onEdit, onStart });
    this.el = h('div#menu.screen');
    root.append(this.el);
    bus.on('coins:changed', () => { const b = this.el.querySelector('.bucks-amount'); if (b) b.textContent = fmt(this.economy.coins); });
    bus.on('games:changed', () => { if (this.mode === 'games') this.showGames(); });
    // Re-render on device change (mobile opens the simple Mobile Studio, computer the full Studio).
    onDeviceChange(() => { if (this.mode === 'games') this.showGames(); });
  }
  hide() { this.el.classList.add('hidden'); this.mode = null; }

  showTitle() {
    this.mode = 'title';
    this.el.classList.remove('hidden');
    clear(this.el).append(h('div.title-screen',
      h('div.snowbg'),
      h('div.title-card',
        h('div.title-logo', '🧊'),
        h('h1.title', 'ICEBERG'),
        h('p.subtitle', 'Build · Play · Create — a frosty block platform'),
        h('button.btn.big#start-btn', { onclick: () => { this.onStart?.(); this.showGames(); } }, '▶  Start'),
        h('p.muted.small', '🎵 Music starts when you press Start'))));
  }

  showGames() {
    this.mode = 'games';
    this.el.classList.remove('hidden');
    const custom = backend.loadCustomGames();
    const card = (def, extra = null) => h('div.game-card', { 'data-game': def.id },
      h('div.thumb', { style: { backgroundImage: `url(${gameThumb(def)})` } }),
      h('div.gc-body', h('div.gc-name', def.name), h('div.gc-tag', def.tagline || ''), h('div.gc-desc', def.description || '')),
      h('div.gc-actions', extra || h('button.btn.play', { onclick: () => this.onPlay(def) }, '▶ Play')));

    const featured = [...BUILTIN_GAMES.map(d => card(d)),
      card(isMobile() ? { ...CREATOR, tagline: 'Mobile Studio: place blocks, pick colors, set a spawn', description: 'Simple touch building. Open the same game on a computer for the full Studio.' } : CREATOR,
        h('button.btn.play.create.studio-entry#create-btn', { onclick: () => this.showCreateDialog() }, '✚ Create'))];
    const yours = custom.map(doc => {
      const def = customGameDef(doc);
      return card(def, h('div.row',
        h('button.btn.play', { onclick: () => this.onPlay(def) }, '▶ Play'),
        h('button.btn.small.secondary.edit-btn', { title: 'Edit', onclick: () => this.onEdit(doc) }, '✏️'),
        h('button.btn.small.secondary', { title: 'Export as file', onclick: () => downloadText(`${doc.name.replace(/[^\w-]+/g, '_')}.iceberg.json`, exportGameJSON(doc, this.models)) }, '⤓'),
        h('button.btn.small.secondary', { title: 'Delete', onclick: async () => { if (await confirmModal(`Delete "${doc.name}"? This can't be undone.`, { title: 'Delete game?', okLabel: 'Delete', danger: true })) { backend.deleteCustomGame(doc.id); this.showGames(); } } }, '🗑')));
    });
    const importInput = h('input#import-file', { type: 'file', accept: '.json', style: { display: 'none' }, onchange: async (e) => {
      const f = e.target.files[0]; if (!f) return;
      try { const doc = await importGameJSON(await f.text(), this.models); backend.saveCustomGame(doc); this.ui.toast(`Imported "${doc.name}"`, '📥'); this.showGames(); }
      catch (err) { this.ui.toast(`Import failed: ${err.message}`, '⚠️'); }
    } });

    clear(this.el).append(h('div.games-screen',
      h('div.snowbg'),
      h('header.menu-head',
        h('div.brand.big', h('span.logo', '🧊'), h('b', 'Iceberg'), plusBadge(h)),
        h('div.menu-actions',
          h('button.bucks', { onclick: () => this.ui.openDrawer('store') }, h('span.bb-ico', CURRENCY.icon), h('span.bucks-amount', fmt(this.economy.coins)), h('span.plus', '+')),
          h('button.btn.secondary', { onclick: () => this.ui.openDrawer('shop') }, '🛍️ Shop'),
          h('button.btn.secondary', { onclick: () => this.ui.openDrawer('locker') }, '🎒 Locker'),
          h('button.btn.secondary', { onclick: () => this.ui.openDrawer('models') }, '📦 Models'))),
      h('section', h('h2', 'Games'), h('div.carousel#games-carousel', featured)),
      h('section', h('div.section-head', h('h2', 'Your Games'), h('div.row', importInput, h('button.btn.small.secondary#import-btn', { onclick: () => importInput.click() }, '📥 Import game (.json)'))),
        yours.length ? h('div.carousel#your-games', yours) : h('div.empty', 'No games yet — make one with ', h('b', 'Create a Game'), '!')),
      h('p.muted.small.center', 'Your avatar, Birg Bucks and cosmetics carry across every game.')));
  }

  showCreateDialog() {
    const dlg = h('div.dialog-backdrop#create-dialog',
      h('div.dialog',
        h('h2', '✚ Create a Game'), h('p.muted', 'Pick a starting map. You can change sky & music later.'),
        h('div.templates', Object.entries(TEMPLATES).map(([id, t]) => h('button.template', { 'data-template': id, onclick: () => { dlg.remove(); this.onEdit(newGameDoc(id)); } }, h('b', t.name), h('small', t.desc || '')))),
        h('button.btn.secondary', { onclick: () => dlg.remove() }, 'Cancel')));
    this.root.append(dlg);
  }
}
