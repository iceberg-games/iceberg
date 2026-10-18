// Iceberg portal (site root): sign in / sign up, games (Play opens play/ in a new tab),
// Safe Chat room, friends, settings. Shares the session + economy with the play page.
import '../style.css';
import './portal.css';
import { h, clear } from '../ui/dom.js';
import { backend } from '../backend/LocalBackend.js';
import { Economy } from '../core/economy.js';
import { bus } from '../core/events.js';
import { fmt, CURRENCY } from '../core/currency.js';
import { BUILTIN_GAMES } from '../games/registry.js';
import { isMobilePlayable } from '../data/gameMeta.js';
import { thumb } from '../ui/thumbs.js';
import { accountsEnabled, CONFIG } from '../net/config.js';
import { getRemote, connectStoredSession } from '../net/session.js';
import { signIn, signUp, validateCredentials } from '../net/auth.js';
import { getDeviceMode, setDeviceMode, onDeviceChange } from '../core/device.js';
import { registerServiceWorker } from '../net/pwa.js';
import { mountChatRoom } from '../chat/chatRoom.js';
import { loadGameStats, SORTS } from '../net/gameStats.js';
import { loadFeatured, createFeaturedBanner } from './featured.js';

const root = document.getElementById('portal');
if (CONFIG.isSite) document.body.classList.add('iceberg-site');
document.body.classList.add('portal-page');
const economy = new Economy(backend);
let remote = null;
let view = new URLSearchParams(location.search).get('view') || 'games';
let chatRoom = null, friendsTimer = null, banner = null;
let gameSort = new URLSearchParams(location.search).get('sort') || 'newest';

const toastBox = h('div.p-toasts');
function toast(text, icon = 'ℹ️') {
  const t = h('div.p-toast', `${icon} ${text}`); toastBox.append(t); setTimeout(() => t.remove(), 4200);
}
bus.on('toast', (t) => toast(t.text, t.icon));
bus.on('coins:changed', () => { const b = document.querySelector('#p-bucks'); if (b) b.textContent = fmt(economy.coins); });

export function playUrl(id) { return `play/?game=${encodeURIComponent(id)}`; }
function openGame(id) { window.open(playUrl(id), '_blank', 'noopener'); }

function header() {
  const user = remote ? h('span.p-user#p-user', '👤 ', h('b', economy.profile.displayName || economy.profile.username), h('span.muted', ` @${economy.profile.username}`)) : null;
  return h('header.p-header',
    h('div.brand.big', h('span', '🧊'), h('b', 'ICEBERG')),
    h('div.p-right',
      h('span.bucks', h('span.bb-ico', CURRENCY.icon), h('span.bucks-amount#p-bucks', fmt(economy.coins))),
      user,
      remote ? h('button.btn.small.secondary#p-signout', { onclick: signOutNow }, 'Sign out')
             : (accountsEnabled() ? h('button.btn.small#p-signin-open', { onclick: () => go('account') }, 'Sign in') : null)));
}
function nav() {
  const tab = (id, label) => h('button.p-tab' + (view === id ? '.on' : ''), { 'data-view': id, onclick: () => go(id) }, label);
  return h('nav.p-nav', tab('games', '🎮 Games'), tab('chat', '💬 Chat'), tab('friends', '🤝 Friends'), tab('settings', '⚙️ Settings'),
    !remote && accountsEnabled() ? tab('account', '🔑 Sign in') : null);
}

function gamesView() {
  const publicApi = getRemote();     // stats + featured are public: works for guests too when accounts are configured
  const bannerHolder = h('div#featured-holder');
  const grid = h('div.p-grid#games-grid', h('p.muted', 'Loading games…'));
  const note = h('p.muted.small#games-note');
  const tab = (id, label) => h('button' + (gameSort === id ? '.on' : ''), { type: 'button', 'data-sort': id, onclick: () => { gameSort = id; const u = new URL(location.href); u.searchParams.set('sort', id); history.replaceState(null, '', u); fill(); sortBar.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.sort === id)); } }, label);
  const sortBar = h('div.p-sort#games-sort', { role: 'tablist' }, tab('newest', '🆕 Newest'), tab('popular', '🔥 Most Popular'), tab('active', '👥 Most Active Players'));
  // Mobile mode: only mobile-playable games in every tab and in the featured banner.
  const shownGames = () => getDeviceMode() === 'mobile' ? BUILTIN_GAMES.filter(isMobilePlayable) : BUILTIN_GAMES;
  const defsById = Object.fromEntries(shownGames().map(d => [d.id, d]));
  loadFeatured(publicApi).then(({ items }) => {
    banner?.destroy(); banner = createFeaturedBanner(items, defsById, { onPlay: openGame, playUrl });
    if (banner) bannerHolder.append(banner.el);
  });
  let stats = null;
  async function fill() {
    if (!stats) stats = await loadGameStats(BUILTIN_GAMES, publicApi);
    const allowed = new Set(shownGames().map(d => d.id));
    const list = stats.games.filter(g => allowed.has(g.def.id));
    clear(note);
    if (gameSort === 'active' && !stats.online) note.textContent = 'Live player counts are not available offline.';
    if (gameSort === 'popular') note.textContent = stats.online ? 'Plays in the last 7 days.' : 'Your plays on this device in the last 7 days (offline).';
    list.sort(SORTS[gameSort] || SORTS.newest);
    clear(grid).append(...(list.length ? list.map(g => card(g)) : [h('p.muted', 'No mobile games yet. Switch to Computer in Settings to see everything.')]));
  }
  const card = ({ def, visits, playing, publishedAt }) => h('div.game-card', { 'data-game': def.id },
    h('div.thumb', { style: { backgroundImage: `url(${thumb(def.thumbnail)})` } }),
    h('div.gc-body', h('div.gc-name', def.name), h('div.gc-tag', def.tagline || ''), h('div.gc-desc', def.description || ''),
      h('div.gc-stats', [
        gameSort === 'newest' && publishedAt ? `🆕 ${new Date(publishedAt).toLocaleDateString()}` : null,
        gameSort === 'popular' ? `🔥 ${visits} plays (7 days)` : null,
        gameSort === 'active' ? (playing == null ? '👥 offline' : `👥 ${playing} playing now`) : null].filter(Boolean).join(' '))),
    h('div.gc-actions', h('a.btn.play', { href: playUrl(def.id), target: '_blank', rel: 'noopener', onclick: (e) => { e.preventDefault(); openGame(def.id); } }, '▶ Play')));
  fill();
  return h('section.p-view#view-games', bannerHolder,
    h('h2', 'Games'),
    h('p.muted', 'Each game opens in a new tab. Your avatar, cosmetics and Birg Bucks follow you everywhere.'),
    sortBar, note, grid,
    h('p.muted.small', getDeviceMode() === 'computer' ? 'Want to make your own? Open any game and press Create on the Games screen.' : ''));
}

function needAccount(what) {
  return h('div.p-card', h('h3', `Sign in to ${what}`), h('p.muted', 'Safe Chat and friends need an Iceberg account.'),
    accountsEnabled() ? h('button.btn', { onclick: () => go('account') }, 'Sign in or create an account')
      : h('p.muted.small', 'Accounts are not configured on this build (see DEPLOY.md).'));
}

function chatView() {
  const sec = h('section.p-view#view-chat', h('h2', '💬 Safe Chat room'),
    h('p.muted', 'Pick a phrase from the menu. Only these friendly phrases can be sent.'));
  if (!remote) { sec.append(needAccount('chat')); return sec; }
  const holder = h('div.p-chat-holder');
  sec.append(holder);
  queueMicrotask(() => { chatRoom = mountChatRoom(holder, { remote, room: 'lobby', me: { username: economy.profile.username, displayName: economy.profile.displayName } }); });
  return sec;
}

function friendsView() {
  const sec = h('section.p-view#view-friends', h('h2', '🤝 Friends'));
  if (!remote) { sec.append(needAccount('add friends')); return sec; }
  const input = h('input#friend-name', { placeholder: 'Exact username', maxLength: 20, autocomplete: 'off' });
  const lists = h('div.p-friends#friends-lists', h('p.muted', 'Loading…'));
  const msg = h('p.small.muted#friend-msg');
  const add = async (e) => {
    e.preventDefault();
    const name = input.value.trim(); if (!name) return;
    try {
      const r = await remote.sendFriendRequest(name);
      msg.textContent = r.ok ? (r.status === 'friends' ? `You and ${name} are now friends!` : `Request sent to ${name}.`)
        : ({ no_such_user: 'No player with that username.', self: "That's you!", too_many_pending: 'Too many requests waiting.', too_many_friends: 'Friend list is full.' }[r.reason] || r.reason);
      input.value = ''; refresh();
    } catch (err) { msg.textContent = err.message; }
  };
  const row = (f, actions) => h('div.p-friend', { 'data-user': f.username },
    h('span.dot' + (f.online ? '.online' : '')), h('b', f.displayName), h('span.muted', ` @${f.username}`), h('span.grow'), ...actions);
  async function refresh() {
    let data; try { data = await remote.listFriends(); } catch (e) { clear(lists).append(h('p.muted', e.message)); return; }
    let playing = []; try { playing = await remote.friendsPlaying() || []; } catch { /* older backend: no multiplayer yet */ }
    const where = Object.fromEntries(playing.map(p => [p.username, p]));
    const gameName = (id) => BUILTIN_GAMES.find(d => d.id === id)?.name || id;
    const joinBtn = (f) => { const p = where[f.username]; if (!p) return null;
      return h('span.p-playing', h('span.muted', ` playing ${gameName(p.gameId)} `),
        h('a.btn.small.join-friend' + (p.full ? '.secondary' : ''), { href: `${playUrl(p.gameId)}&join=${encodeURIComponent(f.username)}`, target: '_blank', rel: 'noopener', 'data-join': f.username,
          title: p.full ? 'Their server is full: you will join another server of the same game' : `Join ${f.displayName} in ${gameName(p.gameId)}` }, p.full ? 'Full: play' : 'Join')); };
    const act = (label, fn, cls = '') => h('button.btn.small' + cls, { onclick: async () => { await fn(); refresh(); } }, label);
    clear(lists).append(h('div.p-friend-lists',   // h() flattens arrays + drops nulls (Element.append would not)
      h('h3', `Friends (${data.friends.length})`),
      data.friends.length ? data.friends.map(f => row(f, [joinBtn(f), act('Remove', () => remote.removeFriend(f.username), '.secondary')])) : h('p.muted', 'No friends yet. Add someone by their exact username.'),
      data.incoming.length ? h('h3', 'Requests for you') : null,
      data.incoming.map(f => row(f, [act('Accept', () => remote.respondFriendRequest(f.username, true)), act('Decline', () => remote.respondFriendRequest(f.username, false), '.secondary')])),
      data.outgoing.length ? h('h3', 'Waiting for them') : null,
      data.outgoing.map(f => row(f, [act('Cancel', () => remote.removeFriend(f.username), '.secondary')]))));
  }
  sec.append(h('form.p-card.row#friend-form', { onsubmit: add }, input, h('button.btn', { type: 'submit' }, 'Add friend')), msg, lists);
  refresh(); friendsTimer = setInterval(refresh, 15000);
  return sec;
}

function settingsView() {
  const devBtn = (mode, label) => h('button.btn.small' + (getDeviceMode() === mode ? '' : '.secondary'), { 'data-mode': mode, onclick: () => { setDeviceMode(mode); render(); } }, label);
  return h('section.p-view#view-settings', h('h2', '⚙️ Settings'),
    h('div.p-card', h('h3', 'Device'), h('div.row#portal-device', devBtn('computer', '🖥️ Computer'), devBtn('mobile', '📱 Mobile')),
      h('p.muted.small', 'Mobile shows touch controls and the simple Mobile Studio.')),
    h('div.p-card', h('h3', 'Install'), h('p.muted.small', 'Use your browser menu → "Install app" / "Add to Home Screen" to keep Iceberg on your device.')),
    remote ? h('div.p-card', h('h3', 'Account'), h('p', `Signed in as @${economy.profile.username}`), h('button.btn.secondary', { onclick: signOutNow }, 'Sign out')) : null);
}

function accountView() {
  const sec = h('section.p-view#view-account', h('h2', '🔑 Your Iceberg account'));
  if (!accountsEnabled()) { sec.append(h('p.muted', 'Accounts are not configured on this build. You can still play as a guest.')); return sec; }
  const mk = (mode) => {
    const u = h('input', { name: 'username', placeholder: 'Username', autocomplete: 'username', maxLength: 20, required: true });
    const p = h('input', { name: 'password', type: 'password', placeholder: 'Password (8+ characters)', autocomplete: mode === 'up' ? 'new-password' : 'current-password', required: true });
    const d = mode === 'up' ? h('input', { name: 'display', placeholder: 'Display name (optional)', maxLength: 24 }) : null;
    const err = h('p.p-error');
    const btn = h('button.btn', { type: 'submit' }, mode === 'up' ? 'Create account' : 'Sign in');
    const form = h(`form.p-card.p-auth#form-sign${mode}`, { onsubmit: async (e) => {
      e.preventDefault(); err.textContent = '';
      const bad = mode === 'up' ? validateCredentials(u.value, p.value) : null; if (bad) { err.textContent = bad; return; }
      btn.disabled = true;
      try {
        const client = getRemote().client;
        if (mode === 'up') await signUp(client, { username: u.value, password: p.value, displayName: d.value });
        else await signIn(client, { username: u.value, password: p.value });
        remote = await connectStoredSession(economy);
        if (!remote) throw new Error('Signed in, but the profile could not be loaded.');
        toast(mode === 'up' ? 'Welcome to Iceberg!' : 'Welcome back!', '🎉');
        go('games');
      } catch (ex) { err.textContent = ex.message; }
      finally { btn.disabled = false; }
    } }, h('h3', mode === 'up' ? 'New here? Create an account' : 'Sign in'), u, p, d, btn, err);
    return form;
  };
  sec.append(h('div.p-two', mk('in'), mk('up')),
    h('p.muted.small', 'Your guest progress on this device (Birg Bucks earned by playing and items) moves to the first account you sign in with. Free demo bucks do not carry over.'));
  return sec;
}

async function signOutNow() {
  await chatRoom?.destroy(); chatRoom = null;
  await getRemote()?.client.signOut();
  economy.disconnect(); remote = null;
  toast('Signed out', '👋'); go('games');
}

function go(v) { view = v; const u = new URL(location.href); u.searchParams.set('view', v); history.replaceState(null, '', u); render(); }

function render() {
  chatRoom?.destroy(); chatRoom = null; clearInterval(friendsTimer); banner?.destroy(); banner = null;
  const views = { games: gamesView, chat: chatView, friends: friendsView, settings: settingsView, account: accountView };
  clear(root).append(h('div.snowbg'), h('div.p-wrap', header(), nav(), (views[view] || gamesView)()), toastBox);
}

onDeviceChange(() => { if (view === 'settings' || view === 'games') render(); });
render();
(async () => {
  remote = await connectStoredSession(economy);
  render();
  registerServiceWorker('./');
})();
window.icebergPortal = { economy, get remote() { return remote; }, get chatRoom() { return chatRoom; }, get banner() { return banner; }, go, render, playUrl };
