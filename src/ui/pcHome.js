// PC home screen (Editor Update), modeled on the reference menu photo: left sidebar, top search + settings gear,
// avatar + "Hello, <name>!" + Friends row, then horizontal rows of square game tiles. PC only (menu.js gates by device mode).
import { h, clear } from './dom.js';
import { gameThumb } from './thumbs.js';
import { avatarSnapshot } from './avatarThumb.js';
import { fmt, CURRENCY } from '../core/currency.js';
import { groups } from '../core/groups.js';
import { getRemote } from '../net/session.js';
import { accountSettingsCard, securitySettingsCard } from './accountSettings.js';
import { bus } from '../core/events.js';
import './pcHome.css';

const NAV = [
  ['home', '🏠', 'Home'], ['profile', '👤', 'Profile'], ['friends', '👥', 'Friends'], ['catalog', '🛍️', 'Catalog'],
  ['inventory', '🎒', 'Inventory'], ['avatar', '🧍', 'Avatar'], ['groups', '🫂', 'Groups'], ['settings', '⚙️', 'Settings'],
];
const initial = (s) => (String(s || '?').trim()[0] || '?').toUpperCase();

/** The player's real avatar (current loadout + cosmetics) as a snapshot from the existing avatar renderer. Falls back to a plain block figure if WebGL is unavailable. */
function avatarFigure(menu) {
  const box = h('div.pc-avatar#pc-avatar');
  const draw = () => {
    const url = avatarSnapshot(menu.avatar, menu.renderer);
    clear(box);
    if (url) box.append(h('img', { src: url, alt: 'Your avatar', draggable: false }));
    else { const m = menu.avatar?.mats || {}; const c = (k, d) => (m[k]?.color ? '#' + m[k].color.getHexString() : d); const b = (cls, col) => h('i.' + cls, { style: { background: col } });
      box.append(b('head', c('skin', '#f5cd30')), h('div.body', b('arm', c('arms', '#f5cd30')), b('torso', c('torso', '#3d7bd9')), b('arm', c('arms', '#f5cd30'))), h('div.legs', b('leg', c('legs', '#4a9e4a')), b('leg', c('legs', '#4a9e4a')))); }
  };
  draw(); menu._refreshAvatar = () => { if (box.isConnected) draw(); };
  return box;
}

export function renderPcHome(menu, { custom, community }) {
  const { economy, ui } = menu;
  const signedIn = !!getRemote()?.signedIn;
  const username = (signedIn ? economy.profile.username : (economy.profile.displayName || economy.profile.username)) || 'Player';   // signed in: the account username
  const state = { view: menu.pcView || 'home', q: '' };
  const countOf = (id) => (menu.gameStats || {})[id] || 0;

  const tile = (def, { by = null, own = null } = {}) => h('div.game-card.pc-tile', { 'data-game': def.id, tabindex: 0, title: def.description || def.name,
      onclick: (e) => { if (!e.target.closest('.pc-hover button')) menu.playInTab(def); }, onkeydown: (e) => { if (e.key === 'Enter' && e.target === e.currentTarget) menu.playInTab(def); } },
    h('div.thumb', { style: { backgroundImage: `url("${gameThumb(def)}")` } },
      h('div.pc-hover', h('button.btn.play', { onclick: () => menu.playInTab(def) }, '▶ Play'), own ? h('div.row', ...own) : null)),
    h('div.gc-name', def.name),
    h('div.gc-meta', h('span.gc-count', `👥 ${countOf(def.id)}`), by ? h('span.gc-by', `by ${by}`) : null));
  const items = () => {
    const mk = (doc, isOwn) => { const def = menu.customDef(doc); return { def, doc, by: isOwn ? username : (doc.ownerName || null), own: isOwn ? menu.ownButtons(doc, def) : null }; };
    return { community: community.map(d => mk(d, false)), yours: custom.map(d => mk(d, true)), builtin: menu.listedBuiltins().map(def => ({ def, by: 'Iceberg' })) };
  };

  const row = (title, list, { id = null, note = null, empty = null, right = null } = {}) => h('section.pc-row',
    h('div.pc-row-head', h('h2', title), right || (note ? h('small', note) : null)),
    list.length ? h('div.carousel' + (id ? '#' + id : ''), list.map(x => tile(x.def, x))) : (empty ? h('div.pc-empty' + (id ? '#' + id : ''), empty) : null));
  const rowsEl = h('div.pc-rows#pc-rows');
  const drawRows = () => {
    const it = items(); const q = state.q.trim().toLowerCase();
    clear(rowsEl);
    if (q) {
      const hits = [...it.community, ...it.yours, ...it.builtin].filter(x => x.def.name.toLowerCase().includes(q) || String(x.by || '').toLowerCase().includes(q));
      rowsEl.append(row(`Search results for “${state.q.trim()}”`, hits, { id: 'search-results', note: `${hits.length} game${hits.length === 1 ? '' : 's'}`, empty: 'No games match your search. Try a game name or a creator name.' }));
      return;
    }
    const at = (x) => x.doc?.publishedAt || 0;
    const popular = [...it.community].sort((a, b) => countOf(b.def.id) - countOf(a.def.id) || at(b) - at(a));
    const recent = [...it.community].sort((a, b) => at(b) - at(a));
    const none = menu.serverError ? `Couldn't load community games: ${menu.serverError}` : 'No community games yet. Press Create, make a game and publish it!';
    rowsEl.append(
      row('Popular right now', popular, { id: 'community-games', empty: none }),
      row('Recently added', recent, { id: 'community-recent' }),
      row('Your Games', it.yours, { id: 'your-games', empty: 'No games yet. Press Create in the sidebar to start one!',
        right: h('div.row', menu.importInput(), h('button.btn.small.secondary#import-btn', { onclick: () => menu.importInput().click() }, '📥 Import (.json)')) }),
      row('Iceberg games', it.builtin, { id: 'games-carousel' }));
  };

  const friendsRow = h('div.pc-friends-row#pc-friends-row', 'No friends yet.');
  const friendsCount = h('span.pc-count#pc-friends-count', '0');
  const loadFriends = async () => {
    const remote = getRemote();
    if (!remote?.signedIn) { friendsRow.textContent = 'No friends yet.'; return; }
    try {
      const fr = (await remote.listFriends())?.friends || [];
      friendsCount.textContent = String(fr.length);
      if (!fr.length) { friendsRow.textContent = 'No friends yet.'; return; }
      clear(friendsRow).append(...fr.map(f => h('div.pc-friend' + (f.online ? '.online' : ''), { title: `@${f.username}` }, h('div.dot', initial(f.displayName || f.username)), h('span', (f.displayName || f.username).slice(0, 9)))));
    } catch { friendsRow.textContent = 'Friends are unavailable right now.'; }
  };

  const homeView = () => { drawRows(); loadFriends();
    return h('div.pc-home-view',
      h('div.pc-hero', avatarFigure(menu), h('div.pc-hello', h('h1', 'Hello, ', h('b', username), '!'), h('div.pc-friends', h('h3', 'Friends ', friendsCount), friendsRow))),
      rowsEl, h('p.pc-foot', 'Your avatar, Birg Bucks and cosmetics carry across every game.')); };
  const groupsView = () => {
    const list = h('div#groups-list'); const msg = h('p.pc-msg#groups-msg', '');
    const draw = () => { const mine = groups.mine(); clear(list).append(...(mine.length ? mine.map(g => h('div.pc-group', { 'data-group': g.id },
      h('div.gi', initial(g.name)), h('div.gw', h('b', g.name), h('small', `${g.description || 'No description'} · ${g.members} member${g.members === 1 ? '' : 's'} · code ${g.code}`)),
      h('button.btn.secondary.small', { onclick: () => { groups.leave(g.id); draw(); } }, 'Leave'))) : [h('p', 'You are not in any groups yet.')])); };
    const name = h('input#group-name', { type: 'text', placeholder: 'Group name', maxLength: 30 });
    const desc = h('input#group-desc', { type: 'text', placeholder: 'What is it about? (optional)', maxLength: 120 });
    const code = h('input#group-code', { type: 'text', placeholder: 'Invite code or group name', maxLength: 30 });
    const run = (fn, ok) => { try { fn(); msg.textContent = ok; } catch (e) { msg.textContent = e.message; } draw(); };
    draw();
    return h('div.pc-panel', h('h2', '🫂 Groups'), h('p', 'Create a group or join one with an invite code. Groups are saved on this device for now.'),
      h('div.pc-form', name, desc, h('button.btn#group-create', { onclick: () => run(() => { groups.create(name.value, desc.value, username); name.value = desc.value = ''; }, 'Group created!') }, 'Create group')),
      h('div.pc-form', code, h('button.btn.secondary#group-join', { onclick: () => run(() => { groups.join(code.value); code.value = ''; }, 'Joined!') }, 'Join group')),
      msg, h('h3', 'My groups'), list);
  };

  const profileView = () => { const pr = economy.profile; const remote = getRemote();
    return h('div.pc-panel#pc-profile', h('div.pc-profile', avatarFigure(menu), h('div', h('h2', username), h('p', remote?.signedIn ? `@${pr.username}` : 'Guest (sign in on the Iceberg site to keep your progress)'),
      h('dl', h('dt', 'Birg Bucks'), h('dd', fmt(economy.coins)), h('dt', 'Games made'), h('dd', String(custom.length)), h('dt', 'Cosmetics owned'), h('dd', String((pr.owned || []).length)))))); };
  const settingsView = () => {
    const m = menu.ui.music; const remote = getRemote();
    const vol = h('input#set-volume', { type: 'range', min: 0, max: 1, step: 0.05, value: m.volume, oninput: (e) => m.setVolume(+e.target.value) });
    const mute = h('input#set-mute', { type: 'checkbox', checked: !!m.muted, onchange: () => menu.ui.toggleMute() });
    const out = async () => { try { location.reload(); } catch { /* ignore */ } };
    return h('div.pc-panel#pc-settings-view', h('h2', '⚙️ Settings'),
      h('div.pc-form', h('label', 'Music volume'), vol, h('label', mute, ' Mute music and sounds')),
      remote?.signedIn ? h('div.pc-light.ib-settings-wrap#pc-account-settings', accountSettingsCard({ economy, remote, onSignedOut: out }), securitySettingsCard({ economy, remote, onSignedOut: out })) : h('p', 'Sign in on the Iceberg site to manage your account and security.'));
  };
  const main = h('main.pc-main#pc-main');
  const bucks = h('button.bucks', { onclick: () => ui.openDrawer('store') }, h('span.bb-ico', CURRENCY.icon), h('span.bucks-amount', fmt(economy.coins)), h('span.plus', '+'));
  const search = h('input#pc-search', { type: 'search', placeholder: 'Search games or creators', autocomplete: 'off', 'aria-label': 'Search games',
    oninput: (e) => { state.q = e.target.value; if (state.view !== 'home') { state.view = 'home'; menu.pcView = 'home'; renderMain(); setActive(); } drawRows(); } });
  const top = h('div.pc-top', h('div.pc-search', search), bucks, h('button.pc-gear#pc-settings', { title: 'Settings', 'aria-label': 'Settings', onclick: () => act.settings() }, '⚙️'));
  const renderMain = () => { clear(main).append(top, state.view === 'groups' ? groupsView() : state.view === 'profile' ? profileView() : state.view === 'settings' ? settingsView() : homeView()); if (state.q && state.view === 'home') search.value = state.q; };

  const act = {
    home: () => { state.view = 'home'; menu.pcView = 'home'; renderMain(); setActive(); },
    friends: () => menu.onFriends?.(), catalog: () => ui.openDrawer('shop'), inventory: () => ui.openDrawer('locker'), avatar: () => ui.openDrawer('locker'),
    profile: () => { state.view = 'profile'; menu.pcView = 'profile'; renderMain(); setActive(); },
    groups: () => { state.view = 'groups'; menu.pcView = 'groups'; renderMain(); setActive(); }, settings: () => { state.view = 'settings'; menu.pcView = 'settings'; renderMain(); setActive(); },
    studio: () => menu.openStudio(), create: () => menu.showCreateDialog(), download: () => menu.showInstall(),
  };
  const navBtn = ([id, ico, label, soon]) => h('button.pc-nav#' + (id === 'create' ? 'create-btn' : 'nav-' + id), { 'data-nav': id, disabled: !!soon, title: soon ? 'Coming soon' : label, onclick: () => act[id]?.() },
    h('span.pc-ico', ico), h('span.pc-lbl', label), soon ? h('span.pc-soon', 'soon') : null);
  const root = h('div.pc-home#pc-home');
  const side = h('aside.pc-side#pc-side',
    h('div.pc-brand', h('button.pc-collapse#pc-collapse', { title: 'Collapse menu', onclick: () => root.classList.toggle('collapsed') }, '✕'), h('span.pc-logo', '🧊'), h('b.pc-name', 'Iceberg')),
    ...NAV.map(navBtn), h('div.pc-spacer'), h('div.pc-sep'), navBtn(['studio', '🛠️', 'Studio']), navBtn(['create', '➕', 'Create']),
      h('button.pc-nav.ugc-entry#ugc-open-btn', { title: 'Make your own accessory (PC only)', onclick: () => bus.emit('ugc:open') }, h('span.pc-ico', '🎩'), h('span.pc-lbl', 'Accessory')),
      navBtn(['download', '⬇️', 'Download']));
  const setActive = () => side.querySelectorAll('.pc-nav').forEach(b => b.classList.toggle('on', b.dataset.nav === state.view));
  root.append(side, main); renderMain(); setActive();

  const remote = getRemote();   // live player counts, then redraw the rows once
  if (remote && !menu._statsLoading) { menu._statsLoading = true;
    remote.listGameStats().then(rows => { menu.gameStats = Object.fromEntries((rows || []).map(r => [r.gameId, r.playing || 0])); if (menu.mode === 'games' && state.view === 'home' && !state.q) drawRows(); }, () => {})
      .finally(() => setTimeout(() => { menu._statsLoading = false; }, 30000)); }
  return root;
}
