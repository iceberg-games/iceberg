// Title screen + Games menu (the platform home screen).
import { h, clear } from './dom.js';
import { plusBadge } from '../core/plus.js';
import { confirmModal } from './overlay.js';
import { isMobile, onDeviceChange } from '../core/device.js';
import { gameThumb } from './thumbs.js';
import { imageToThumb } from './imageThumb.js';
import { fmt, CURRENCY } from '../core/currency.js';
import { bus } from '../core/events.js';
import { LISTED_GAMES, BUILTIN_GAMES, CREATOR } from '../games/registry.js';
import { renderPcHome } from './pcHome.js';
import { canPromptInstall, promptInstall, isInstalledApp, installInstructions, onInstallChange } from '../net/install.js';
import { TEMPLATES, newGameDoc, customGameDef } from '../games/customGame.js';
import { backend } from '../backend/LocalBackend.js';
import { exportGameJSON, importGameJSON, downloadText } from '../core/share.js';
import { listServerGames, unpublish, newGameId, mergeOwn, drafts, updateGameMeta } from '../studio/store.js';
import { getRemote } from '../net/session.js';

export class Menu {
  constructor(root, { economy, models, ui, avatar, renderer, onPlay, onEdit, onStart, onFriends }) {
    Object.assign(this, { root, economy, models, ui, avatar, renderer, onPlay, onEdit, onStart, onFriends });
    this.el = h('div#menu.screen');
    root.append(this.el);
    bus.on('coins:changed', () => { const b = this.el.querySelector('.bucks-amount'); if (b) b.textContent = fmt(this.economy.coins); });
    bus.on('drafts:sync', (e) => this.ui?.toast(`Saved on this device; cloud save failed: ${e.message || 'unknown error'}`, '⚠️'));
    for (const ev of ['inventory:changed', 'cosmetic:colors', 'profile:synced']) bus.on(ev, () => setTimeout(() => this._refreshAvatar?.(), 60));   // PC home avatar follows the loadout
    bus.on('games:changed', () => { if (this.mode === 'games') this.showGames(); });
    // Re-render on device change (mobile opens the simple Mobile Studio, computer the full Studio).
    onDeviceChange(() => { if (this.mode === 'games') this.showGames(); });
  }
  hide() { this.el.classList.add('hidden'); this.mode = null; document.body.classList.remove('pc-home-open'); }

  showTitle() {
    // PC: ONE menu. There is no separate start screen; the new home opens straight away (the first click anywhere unlocks audio).
    // Phones keep the old title screen (their layout code is intact behind MOBILE_BLOCKED).
    if (!isMobile()) {
      // Compat hook for scripted tests written against the old title screen ("click #start-btn"). It is a 1px transparent button and does nothing:
      // the home is already open and any ?game= deep link already launched.
      if (!document.getElementById('start-btn')) document.body.append(h('button#start-btn', { type: 'button', tabindex: -1, 'aria-hidden': 'true', title: '',
        style: { position: 'fixed', left: '0', top: '0', width: '1px', height: '1px', padding: '0', border: '0', opacity: '0', zIndex: '2147483647' } }));
      this.onStart?.(); this.showGames(); return;
    }
    this.mode = 'title'; document.body.classList.remove('pc-home-open');
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
    // Server-published games (everyone's), fetched async; local "Your Games" render immediately.
    if (!this._serverLoading) { this._serverLoading = true; Promise.all([listServerGames(), drafts.pull().catch(() => 0)]).then(([g]) => { this.serverGames = g; this.serverError = null; }, e => { this.serverError = e.message; })
      .finally(() => { if (this.mode === 'games') this.showGames(); setTimeout(() => { this._serverLoading = false; }, 30000); }); }
    const myId = getRemote()?.signedIn ? getRemote().userId : null;
    for (let i = 0; i < custom.length; i++) custom[i] = mergeOwn(custom[i], (this.serverGames || []).find(g => g.id === custom[i].id), myId);
    const localIds = new Set(custom.map(g => g.id));
    // My published games that live on the server but not in this browser (made on another device, or seeded for my account,
    // e.g. the Studio copies of BIRG HQ / Frost Fields) are mine: they belong in Your Games with edit buttons, not in Community.
    if (myId) for (const g of this.serverGames || []) if (g.owner === myId && !localIds.has(g.id)) { custom.push({ ...g, ownerName: g.ownerName }); localIds.add(g.id); }
    // Community = games real players published in Studio (list_published_games) only: never built-in team games.
    const community = (this.serverGames || []).filter(g => !localIds.has(g.id) && !BUILTIN_GAMES.some(b => b.id === g.id));
    if (!isMobile()) { document.body.classList.add('pc-home-open'); this._custom = custom; clear(this.el).append(renderPcHome(this, { custom, community })); return; }
    document.body.classList.remove('pc-home-open');
    const card = (def, extra = null) => h('div.game-card', { 'data-game': def.id },
      h('div.thumb', { style: { backgroundImage: `url(${gameThumb(def)})` } }),
      h('div.gc-body', h('div.gc-name', def.name), h('div.gc-tag', def.tagline || ''), h('div.gc-desc', def.description || '')),
      h('div.gc-actions', extra || h('button.btn.play', { onclick: () => this.onPlay(def) }, '▶ Play')));

    const featured = [...LISTED_GAMES.map(d => card(d)),
      card(isMobile() ? { ...CREATOR, tagline: 'Mobile Studio: place blocks, pick colors, set a spawn', description: 'Simple touch building. Open the same game on a computer for the full Studio.' } : CREATOR,
        h('button.btn.play.create.studio-entry#create-btn', { onclick: () => this.showCreateDialog() }, '✚ Create'))];
    const yours = custom.map(doc => {
      const def = customGameDef(doc);
      return card(def, h('div.row', h('button.btn.play', { onclick: () => this.onPlay(def) }, '▶ Play'), ...this.ownButtons(doc, def)));
    });
    const importInput = this.importInput();

    clear(this.el).append(h('div.games-screen',
      h('div.snowbg'),
      h('header.menu-head',
        h('div.brand.big', h('span.logo', '🧊'), h('b', 'Iceberg'), plusBadge(h)),
        h('div.menu-actions',
          h('button.bucks', { onclick: () => this.ui.openDrawer('store') }, h('span.bb-ico', CURRENCY.icon), h('span.bucks-amount', fmt(this.economy.coins)), h('span.plus', '+')),
          h('button.btn.secondary', { onclick: () => this.ui.openDrawer('shop') }, '🛍️ Catalog'),
          h('button.btn.secondary', { onclick: () => this.ui.openDrawer('locker') }, '🎒 Locker'),
          h('button.btn.secondary', { onclick: () => this.ui.openDrawer('models') }, '📦 Models'),
          isMobile() ? null : h('button.btn.secondary.ugc-entry#ugc-open-btn', { title: 'Accessory Editor (PC only)', onclick: () => bus.emit('ugc:open') }, '🛠️ Create Accessory'))),
      h('section', h('h2', 'Games'), h('div.carousel#games-carousel', featured)),
      h('section', h('div.section-head', h('h2', 'Your Games'), h('div.row', importInput, h('button.btn.small.secondary#import-btn', { onclick: () => importInput.click() }, '📥 Import game (.json)'))),
        yours.length ? h('div.carousel#your-games', yours) : h('div.empty', 'No games yet — make one with ', h('b', 'Create a Game'), '!')),
      (community.length || this.serverError) ? h('section', h('h2', 'Community Games'),
        this.serverError ? h('div.empty.small', `Couldn't load community games: ${this.serverError}`) : null,
        community.length ? h('div.carousel#community-games', community.map(doc => { const def = customGameDef(doc); def.tagline = `By ${doc.ownerName || 'a player'} · Made in Iceberg Studio`; return card(def); })) : null) : null,
      h('p.muted.small.center', 'Your avatar, Birg Bucks and cosmetics carry across every game.')));
  }

  importInput() {
    return this._importInput || (this._importInput = h('input#import-file', { type: 'file', accept: '.json', style: { display: 'none' }, onchange: async (e) => {
      const f = e.target.files[0]; if (!f) return;
      try { const doc = await importGameJSON(await f.text(), this.models); if (backend.loadCustomGames().some(g => g.id === doc.id) || this.serverGames?.some(g => g.id === doc.id)) doc.id = newGameId(); backend.saveCustomGame(doc); this.ui.toast(`Imported "${doc.name}"`, '📥'); this.showGames(); }
      catch (err) { this.ui.toast(`Import failed: ${err.message}`, '⚠️'); }
    } }));
  }
  customDef(doc) { const d = customGameDef(doc); d.tagline = `By ${doc.ownerName || 'a player'} · Made in Iceberg Studio`; return d; }
  listedBuiltins() { return LISTED_GAMES; }
  /** Buttons for a game I own (Edit in Studio, edit details, export, unpublish). Shared by the PC and phone layouts. */
  ownButtons(doc, def) {
    const signedIn = !!getRemote()?.signedIn;
    return [
      h('button.btn.small.secondary.edit-btn', { title: 'Edit in Studio', onclick: (e) => { e.stopPropagation(); this.onEdit(doc); } }, '✏️'),
      signedIn ? h('button.btn.small.secondary.details-btn', { title: 'Edit name, thumbnail and description', onclick: (e) => { e.stopPropagation(); this.showEditDetails(doc); } }, '🖼️') : null,
      h('button.btn.small.secondary', { title: 'Export as file', onclick: (e) => { e.stopPropagation(); downloadText(`${doc.name.replace(/[^\w-]+/g, '_')}.iceberg.json`, exportGameJSON(doc, this.models)); } }, '⤓'),
      h('button.btn.small.secondary', { title: 'Delete', onclick: async (e) => { e.stopPropagation(); if (await confirmModal(`Remove "${doc.name}" from Your Games? Your draft is kept, and a server copy is hidden (not erased).`, { title: 'Unpublish game?', okLabel: 'Unpublish', danger: true })) { try { await unpublish(doc.id); this.serverGames = (this.serverGames || []).filter(g => g.id !== doc.id); } catch (err) { this.ui.toast(`Unpublish failed: ${err.message}`, '⚠️'); } this.showGames(); } } }, '🗑'),
    ];
  }
  /** PC: open a game in its own pop-out window (no tab bar / toolbar) through the deep link ?game=<id>&popout=1&autostart=1.
   *  Home, game picking and profile stay in this tab. Blocked popup -> new tab; still blocked -> play in this page. */
  playInTab(def) {
    const u = new URL(location.href); u.search = ''; u.hash = ''; u.searchParams.set('game', def.id); u.searchParams.set('autostart', '1'); u.searchParams.set('popout', '1');
    const W = 1280, H = 760, left = Math.max(0, Math.round((screen.availWidth - W) / 2)), top = Math.max(0, Math.round((screen.availHeight - H) / 2));
    const feat = `popup=yes,width=${W},height=${H},left=${left},top=${top},resizable=yes,scrollbars=no,toolbar=no,location=no,menubar=no,status=no`;
    let w = null; try { w = window.open(u.toString(), 'iceberg-game-' + def.id.replace(/\W+/g, '_'), feat); } catch { /* blocked */ }
    if (w) { try { w.focus(); } catch { /* ignore */ } return; }
    u.searchParams.delete('popout'); w = window.open(u.toString(), '_blank');
    if (!w) this.onPlay(def);
  }
  /** Sidebar "Download": Install Iceberg (PWA) so games open in their own app window. */
  showInstall() {
    const note = h('p.muted.small#install-note', '');
    const body = h('div#install-body');
    const draw = () => {
      clear(body);
      if (isInstalledApp()) { body.append(h('p', '✅ Iceberg is installed on this computer. Games open in their own window.')); return; }
      if (canPromptInstall()) body.append(h('button.btn#install-btn', { onclick: async () => { const r = await promptInstall(); note.textContent = r === 'accepted' ? 'Installing…' : 'Install cancelled.'; draw(); } }, '⬇ Install Iceberg'));
      else body.append(h('p#install-help', installInstructions()));
    };
    const off = onInstallChange(draw); draw();
    const dlg = h('div.dialog-backdrop.pc-dialog#install-dialog', h('div.dialog', h('h2', '⬇ Install Iceberg'),
      h('p.muted', 'Install Iceberg as an app: it gets its own window, and every game you open pops out in a clean game window.'), body, note,
      h('div.row', { style: { marginTop: '14px' } }, h('button.btn.secondary#install-close', { onclick: () => { off(); dlg.remove(); } }, 'Close'))));
    this.root.append(dlg);
  }
  /** Sidebar "Studio": reopen the most recently edited game (local drafts + published copies), or start a blank one. */
  openStudio() {
    const all = [...drafts.list(), ...backend.loadCustomGames()].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    this.onEdit(all[0] || newGameDoc('blank'));
  }
  /** Owner-only: change a published game's name, description and thumbnail. */
  showEditDetails(doc) {
    const name = h('input#edit-name', { type: 'text', maxLength: 40, value: doc.name || '' });
    const desc = h('textarea#edit-desc', { maxLength: 120, rows: 3 }, doc.description || '');
    const prev = h('div.pc-edit-thumb#edit-thumb', { style: { backgroundImage: `url("${gameThumb(customGameDef(doc))}")` } });
    let thumbnail = null; const msg = h('p.muted.small#edit-msg', '');
    const file = h('input#edit-file', { type: 'file', accept: 'image/png,image/jpeg,image/webp', onchange: async (e) => {
      const f = e.target.files[0]; if (!f) return;
      try { thumbnail = await imageToThumb(f); prev.style.backgroundImage = `url("${thumbnail}")`; msg.textContent = ''; } catch (err) { msg.textContent = err.message; }
    } });
    const dlg = h('div.dialog-backdrop.pc-dialog#details-dialog', h('div.dialog', h('h2', '🖼️ Edit game details'),
      h('label', 'Name'), name, h('label', 'Description'), desc, h('label', 'Thumbnail'), prev, file, msg,
      h('div.row', { style: { display: 'flex', gap: '8px', marginTop: '12px' } },
        h('button.btn#edit-save', { onclick: async (e) => {
          e.target.disabled = true; msg.textContent = 'Saving…';
          try { await updateGameMeta(doc.id, { name: name.value, description: desc.value, thumbnail }); this.ui.toast('Game details saved', '✅'); dlg.remove();
            const sg = (this.serverGames || []).find(g => g.id === doc.id); if (sg) Object.assign(sg, { name: name.value.trim(), description: desc.value, ...(thumbnail ? { thumbnail } : {}) });
            this.showGames(); }
          catch (err) { msg.textContent = err.message; e.target.disabled = false; } } }, 'Save'),
        h('button.btn.secondary', { onclick: () => dlg.remove() }, 'Cancel'))));
    this.root.append(dlg);
  }
  /** Settings = the PC home's Settings view (music + Account + Security & Privacy from the accounts work). */
  showSettings() { this.pcView = 'settings'; this.showGames(); }

  showCreateDialog() {
    const dlg = h('div.dialog-backdrop#create-dialog',
      h('div.dialog',
        h('h2', '✚ Create a Game'), h('p.muted', 'Pick a starting map. You can change sky & music later.'),
        h('div.templates', Object.entries(TEMPLATES).map(([id, t]) => h('button.template', { 'data-template': id, onclick: () => { dlg.remove(); this.onEdit(newGameDoc(id)); } }, h('b', t.name), h('small', t.desc || '')))),
        h('button.btn.secondary', { onclick: () => dlg.remove() }, 'Cancel')));
    this.root.append(dlg);
  }
}
