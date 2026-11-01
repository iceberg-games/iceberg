// Friends panel (QoL, mobile-first; works on desktop too).
// A floating 👥 button opens a bottom sheet: add by username, accept/decline
// requests, list friends with online / playing status, and Join a friend's
// server in-app (mp.join(gameId, { friend })). Backend: SupabaseBackend
// listFriends / sendFriendRequest / respondFriendRequest / removeFriend / friendsPlaying.
// Guests (no remote) see a sign-in hint instead. Polls only while open.
import { h, clear } from './dom.js';
import { findGame } from '../games/registry.js';
import './friendsPanel.css';

const REASONS = { no_such_user: 'No player with that username.', self: "That's you!", too_many_pending: 'Too many requests waiting.', too_many_friends: 'Friend list is full.' };

export function mountFriendsPanel({ root = document.body, getRemote, onJoin, ui }) {
  let timer = null, back = null, incomingCount = 0;
  const badge = h('span.fp-badge.hidden#friends-badge', '0');
  const btn = h('button.fp-fab#friends-btn', { type: 'button', 'aria-label': 'Friends', title: 'Friends', 'data-sfx': 'popup', onclick: () => open() }, '👥', badge);
  root.append(btn);

  const setBadge = (n) => { incomingCount = n; badge.textContent = String(n); badge.classList.toggle('hidden', !n); };

  async function load(lists, msg) {
    const remote = getRemote();
    if (!remote) { clear(lists).append(h('p.fp-muted', '🔑 Sign in (Account in the portal) to add friends and join them.')); return; }
    let data, playing = [];
    try { data = await remote.listFriends(); } catch (e) { clear(lists).append(h('p.fp-muted', `Could not load friends: ${e.message}`)); return; }
    try { playing = (await remote.friendsPlaying()) || []; } catch { /* older backend */ }
    data = { friends: [], incoming: [], outgoing: [], ...(data || {}) };
    setBadge(data.incoming.length);
    const where = Object.fromEntries(playing.map(p => [p.username, p]));
    const act = (label, fn, cls = '') => h('button.fp-btn' + cls, { type: 'button', onclick: async (e) => {
      e.currentTarget.disabled = true;
      try { await fn(); } catch (err) { msg.textContent = err.message; }
      load(lists, msg); } }, label);
    const row = (f, ...actions) => {
      const p = where[f.username];
      const status = p ? `🎮 ${findGame(p.gameId)?.name || p.gameId}` : f.online ? '🟢 Online' : '⚪ Offline';
      return h('div.fp-row', { 'data-user': f.username },
        h('span.fp-dot' + (p ? '.playing' : f.online ? '.online' : '')),
        h('div.fp-who', h('b', f.displayName || f.username), h('small', `@${f.username} · ${status}`)), ...actions);
    };
    const joinBtn = (f) => { const p = where[f.username]; if (!p) return null;
      return act(p.full ? 'Full: play' : 'Join', async () => { close(); await onJoin(p.gameId, f.username, p.full); }, '.join' + (p.full ? '.sec' : '')); };
    const friends = [...data.friends].sort((a, b) => (!!where[b.username] - !!where[a.username]) || (b.online - a.online));
    clear(lists).append(h('div',
      data.incoming.length ? h('h4', `Requests (${data.incoming.length})`) : null,
      data.incoming.map(f => row(f, act('Accept', () => remote.respondFriendRequest(f.username, true), '.ok'), act('✕', () => remote.respondFriendRequest(f.username, false), '.sec'))),
      h('h4', `Friends (${data.friends.length})`),
      friends.length ? friends.map(f => row(f, joinBtn(f), act('Remove', () => new Promise((res) => { if (confirmRemove(f)) res(remote.removeFriend(f.username)); else res(); }), '.sec'))) : h('p.fp-muted', 'No friends yet. Add someone by their exact username.'),
      data.outgoing.length ? h('h4', 'Waiting for them') : null,
      data.outgoing.map(f => row(f, act('Cancel', () => remote.removeFriend(f.username), '.sec')))));
  }
  const confirmRemove = (f) => confirm(`Remove ${f.displayName || f.username} from friends?`);

  function open() {
    close();
    const lists = h('div.fp-lists#friends-lists', h('p.fp-muted', 'Loading…'));
    const msg = h('p.fp-msg#friend-msg');
    const input = h('input#friend-name', { type: 'text', placeholder: 'Exact username', maxLength: 20, autocomplete: 'off', autocapitalize: 'none', spellcheck: false, enterkeyhint: 'send' });
    const add = async (e) => {
      e.preventDefault(); const name = input.value.trim(); const remote = getRemote(); if (!name || !remote) return;
      try {
        const r = await remote.sendFriendRequest(name);
        msg.textContent = r?.ok ? (r.status === 'friends' ? `You and ${name} are now friends! 🎉` : `Request sent to ${name}.`) : (REASONS[r?.reason] || r?.reason || 'Could not send.');
        if (r?.ok) input.value = '';
      } catch (err) { msg.textContent = err.message; }
      load(lists, msg);
    };
    back = h('div.fp-back#friends-sheet', { onclick: (e) => { if (e.target === back) close(); } },
      h('div.fp-sheet', { role: 'dialog', 'aria-label': 'Friends' },
        h('div.fp-head', h('h3', '👥 Friends'), h('button.fp-x#friends-close', { type: 'button', 'aria-label': 'Close', onclick: close }, '✕')),
        getRemote() ? h('form.fp-add#friend-form', { onsubmit: add }, input, h('button.fp-btn.ok', { type: 'submit' }, 'Add')) : null,
        msg, lists));
    root.append(back);
    load(lists, msg); timer = setInterval(() => load(lists, msg), 15000);
  }
  function close() { clearInterval(timer); timer = null; back?.remove(); back = null; }
  // background badge refresh (cheap, every 60 s) so incoming requests are noticed
  const poll = async () => { const r = getRemote(); if (!r || back) return; try { const d = await r.listFriends(); setBadge(d?.incoming?.length || 0); } catch { /* offline */ } };
  poll(); setInterval(poll, 60000);
  return { open, close, button: btn, get incoming() { return incomingCount; } };
}
