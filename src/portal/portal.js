// Iceberg portal (site root): sign in / sign up, games (Play opens play/ in a new tab),
// Safe Chat room, friends, settings. Shares the session + economy with the play page.
import '../style.css';
import './portal.css';
import '../ui/iceSkin.css';
import { h, clear } from '../ui/dom.js';
import { plusBadge, plusCard, syncPlus, grantPlus } from '../core/plus.js';
import { backend } from '../backend/LocalBackend.js';
import { Economy } from '../core/economy.js';
import { bus } from '../core/events.js';
import { fmt, CURRENCY } from '../core/currency.js';
import { BUILTIN_GAMES } from '../games/registry.js';
import { isMobilePlayable } from '../data/gameMeta.js';
import { gameThumb } from '../ui/thumbs.js';
import { accountsEnabled, CONFIG } from '../net/config.js';
import { getRemote, connectStoredSession } from '../net/session.js';
import { signIn, signUp, validateCredentials } from '../net/auth.js';
import { getDeviceMode, setDeviceMode, onDeviceChange } from '../core/device.js';
import { registerServiceWorker } from '../net/pwa.js';
import { isDev, devUpdateButton } from '../net/devAccess.js';
import { isBanned, showBanned, banUser, unbanUser } from '../net/ban.js';
import { mountChatRoom } from '../chat/chatRoom.js';
import { loadGameStats, SORTS } from '../net/gameStats.js';
import { loadFeatured, createFeaturedBanner } from './featured.js';
import { toast as showToast } from '../ui/overlay.js';
import { initUiSounds, isMuted as soundsMuted } from '../audio/uiSounds.js';
import { uiSoundOptions } from '../audio/siteSounds.js';
import { modelPrefs } from '../backend/LocalBackend.js';
import { maybeShowEventPopup, eventPopup, createEventStatusSource } from './eventPopup.js';
import { createStormTheme } from './stormTheme.js';
import { createFriendsView } from './friends.js';

const root = document.getElementById('portal');
if (CONFIG.isSite) document.body.classList.add('iceberg-site');
document.body.classList.add('portal-page');
const economy = new Economy(backend);
let remote = null;
let dev = false;   // server says this account is on the developer allowlist (is_dev)
let view = new URLSearchParams(location.search).get('view') || 'games';
let chatRoom = null, friendsCtl = null, banner = null;
let gameSort = new URLSearchParams(location.search).get('sort') || 'newest';
let ready = false;   // stored session checked (so the event popup knows guest vs account)

const uiSounds = initUiSounds(uiSoundOptions());   // one delegated click-sound listener for the whole page
const toast = (text, icon = 'ℹ️') => showToast(text, { icon });
const eventSource = createEventStatusSource(economy, getRemote);   // server event window (quests.eventStatus semantics, 60 s cache)
const storm = createStormTheme({ source: eventSource });            // Natural Disasters theme, only while the event is active
storm.check();
const cardThumb = gameThumb;
bus.on('toast', (t) => toast(t.text, t.icon));
bus.on('coins:changed', () => { const b = document.querySelector('#p-bucks'); if (b) b.textContent = fmt(economy.coins); });

export function playUrl(id) { return `play/?game=${encodeURIComponent(id)}`; }
function openGame(id) { window.open(playUrl(id), '_blank', 'noopener'); }

function soundToggle() {
  const set = (b, m) => { b.textContent = m ? '🔇' : '🔊'; b.setAttribute('aria-pressed', String(!m)); b.title = m ? 'Sounds off (click to turn on)' : 'Sounds on (click to mute)'; b.setAttribute('aria-label', m ? 'Turn sounds on' : 'Mute sounds'); };
  // Same saved setting as the in-game 🔊 button (iceberg:v1:settings.muted): one mute for music + UI sounds.
  const b = h('button.icon-btn.p-sound#p-sound', { type: 'button', 'data-sfx': 'none', onclick: () => {
    const m = !soundsMuted(); modelPrefs.saveSettings({ ...modelPrefs.loadSettings(), muted: m }); set(b, m);
    if (!m) uiSounds.playUi('click');
  } });
  set(b, soundsMuted());
  return b;
}
function header() {
  const user = remote ? h('span.p-user#p-user', '👤 ', h('b', economy.profile.displayName || economy.profile.username), h('span.muted', ` @${economy.profile.username}`)) : null;
  return h('header.p-header',
    h('div.brand.big', h('span', '🧊'), h('b', 'ICEBERG')),
    h('div.p-right',
      h('span.bucks', h('span.bb-ico', CURRENCY.icon), h('span.bucks-amount#p-bucks', fmt(economy.coins))),
      plusBadge(h), user, soundToggle(),
      remote ? h('button.btn.small.secondary#p-signout', { onclick: signOutNow }, 'Sign out')
             : (accountsEnabled() ? h('button.btn.small#p-signin-open', { onclick: () => go('account') }, 'Sign in') : null)));
}
// Developers only: rendered directly under the username/balance row, never created for anyone else.
const devRow = () => (dev && remote ? h('div.p-dev-row', devUpdateButton(h, './preview/')) : null);
// Developers only: ban / unban by username (server checks is_dev and refuses to ban a dev)
function banPanel() {
  if (!dev || !remote) return null;
  const inp = h('input', { id: 'ban-username', placeholder: 'username', autocomplete: 'off', style: 'width:140px' });
  const act = (fn, verb) => async () => {
    const u = inp.value.trim(); if (!u) return;
    try { const r = await fn(remote, u); toast(r?.ok ? `${verb}: ${r.username || u}` : `${verb} failed: ${r?.reason || 'error'}`, r?.ok ? '✅' : '⚠️'); }
    catch (e) { toast(`${verb} failed: ${e.message}`, '⚠️'); }
  };
  return h('div.p-dev-row', { id: 'ban-panel', style: 'gap:6px;align-items:center' }, inp,
    h('button.btn.secondary', { id: 'ban-btn', onclick: act(banUser, 'Banned') }, 'Ban'),
    h('button.btn.secondary', { id: 'unban-btn', onclick: act(unbanUser, 'Unbanned') }, 'Unban'),
    h('button.btn.secondary', { id: 'grant-plus-btn', title: 'Dev comp grant: 30 days of Iceberg Plus (not a payment)', onclick: act((r, u) => grantPlus(r, u, 30, 'dev portal grant'), 'Granted Plus (30d) to') }, '❄️ Grant Plus'),
    h('button.btn.secondary', { id: 'revoke-plus-btn', onclick: act((r, u) => grantPlus(r, u, 0, 'dev portal revoke'), 'Revoked Plus for') }, 'Revoke Plus'));
}
let plusNow = null;
async function refreshDev() { const p = await syncPlus(remote); const d = remote ? await isDev(remote) : false; if (d !== dev || p !== plusNow) { dev = d; plusNow = p; render(); } }
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
    h('div.thumb', { style: { backgroundImage: `url(${cardThumb(def)})` } }),
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
  friendsCtl?.destroy();
  friendsCtl = createFriendsView({ remote, toast, playUrl, needAccount, me: economy.profile?.username || '',
    gameName: (id) => BUILTIN_GAMES.find(d => d.id === id)?.name || id });
  return friendsCtl.el;
}

function settingsView() {
  const devBtn = (mode, label) => h('button.btn.small' + (getDeviceMode() === mode ? '' : '.secondary'), { 'data-mode': mode, onclick: () => { setDeviceMode(mode); render(); } }, label);
  return h('section.p-view#view-settings', h('h2', '⚙️ Settings'),
    h('div.p-card', h('h3', 'Device'), h('div.row#portal-device', devBtn('computer', '🖥️ Computer'), devBtn('mobile', '📱 Mobile')),
      h('p.muted.small', 'Mobile shows touch controls and the simple Mobile Studio.')),
    plusCard(h, () => render()),
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
        if (await isBanned(remote)) return showBanned();
        refreshDev();
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
  economy.disconnect(); remote = null; dev = false;
  toast('Signed out', '👋'); go('games');
}

function go(v) { view = v; const u = new URL(location.href); u.searchParams.set('view', v); history.replaceState(null, '', u); render(); }

function render() {
  chatRoom?.destroy(); chatRoom = null; friendsCtl?.destroy(); friendsCtl = null; banner?.destroy(); banner = null;
  const views = { games: gamesView, chat: chatView, friends: friendsView, settings: settingsView, account: accountView };
  clear(root).append(h('div.snowbg'), h('div.p-wrap', header(), devRow(), banPanel(), nav(), (views[view] || gamesView)()));
  if (ready && (view === 'games' || !views[view])) checkEventPopup();
}
function checkEventPopup() {
  return maybeShowEventPopup({ economy, getRemote, onPlay: openGame, source: eventSource });
}

onDeviceChange(() => { if (view === 'settings' || view === 'games') render(); });
render();
(async () => {
  remote = await connectStoredSession(economy);
  if (await isBanned(remote)) return showBanned();
  ready = true;
  render();
  registerServiceWorker('./');
  refreshDev();
})();
window.icebergPortal = { economy, get remote() { return remote; }, get chatRoom() { return chatRoom; }, get banner() { return banner; }, go, render, playUrl, toast, sounds: uiSounds, eventPopup, checkEventPopup, storm, cardThumb };
