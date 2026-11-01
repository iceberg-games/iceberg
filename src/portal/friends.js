// Friends tab (portal). Signed-in only. Server is the source of truth (list_friends,
// friends_playing); actions are applied optimistically and reconciled on the next list.
// Less flaky: one refresh in flight at a time (latest wins), per-row busy lock, resync on
// tab focus / visibility, exponential backoff on errors + rate limits, readable toasts.
import { h, clear } from '../ui/dom.js';

const REASONS = {
  no_such_user: 'No player with that username.', self: "That's you!",
  too_many_pending: 'Too many requests waiting. Try again later.', too_many_friends: 'Friend list is full.',
  already_friends: 'You are already friends.', already_sent: 'Request already sent.',
  not_found: 'That request is gone (maybe already answered).', rate_limited: 'Slow down a little, then try again.',
  not_signed_in: 'Please sign in again.',
};
export function friendlyError(e) {
  const status = e?.status;
  const raw = String(e?.reason || e?.message || e || 'error');
  if (status === 429 || /rate|too many requests/i.test(raw)) return REASONS.rate_limited;
  if (status === 401 || status === 403) return REASONS.not_signed_in;
  if (/failed to fetch|network|load failed/i.test(raw)) return 'Network hiccup. Check your connection.';
  return REASONS[raw] || raw.replace(/_/g, ' ');
}
const USERNAME = /^[A-Za-z0-9_]{3,20}$/;

export function createFriendsView({ remote, toast, gameName, playUrl, me = '', needAccount }) {
  const sec = h('section.p-view#view-friends', h('h2', '🤝 Friends'));
  if (!remote) { sec.append(needAccount('add friends')); return { el: sec, destroy() {} }; }

  let data = { friends: [], incoming: [], outgoing: [] }, where = {}, loaded = false;
  let seq = 0, timer = null, failures = 0, dead = false, lastAt = 0;
  const busy = new Set();     // usernames with an action in flight (no double clicks / stuck states)

  const input = h('input#friend-name', { placeholder: 'Exact username', maxLength: 20, autocomplete: 'off', spellcheck: false });
  const addBtn = h('button.btn', { type: 'submit' }, 'Add friend');
  const msg = h('p.small.muted#friend-msg', { 'aria-live': 'polite' });
  const lists = h('div.p-friends#friends-lists', h('p.muted', 'Loading…'));
  const status = h('p.small.muted#friends-status');

  const say = (text, ok) => { msg.textContent = text; msg.className = 'small ' + (ok ? 'ok' : 'muted'); toast(text, ok ? '✅' : '⚠️'); };

  function schedule(ms) { clearTimeout(timer); if (!dead) timer = setTimeout(refresh, ms); }

  async function refresh() {
    if (dead) return;
    const my = ++seq;
    try {
      const d = await remote.listFriends();
      let playing = []; try { playing = (await remote.friendsPlaying()) || []; } catch { /* older backend */ }
      if (my !== seq || dead) return;         // a newer refresh started: drop stale result
      data = { friends: d?.friends || [], incoming: d?.incoming || [], outgoing: d?.outgoing || [] };
      where = Object.fromEntries(playing.map(p => [p.username, p]));
      loaded = true; failures = 0; lastAt = Date.now(); status.textContent = '';
      draw(); schedule(15000);
    } catch (e) {
      if (my !== seq || dead) return;
      failures++;
      const wait = Math.min(120000, 15000 * 2 ** Math.min(failures, 3));
      status.textContent = `Couldn't refresh friends (${friendlyError(e)}). Retrying in ${Math.round(wait / 1000)}s.`;
      if (!loaded) clear(lists).append(h('p.muted', friendlyError(e)), h('button.btn.small.secondary', { onclick: refresh }, 'Retry'));
      schedule(wait);
    }
  }

  // Run an action with optimistic local change; always reconcile from the server after.
  async function act(name, fn, optimistic, okText) {
    if (busy.has(name)) return;
    busy.add(name); const before = data;
    if (optimistic) { data = optimistic(data); }
    draw();
    try {
      const r = await fn();
      if (r && r.ok === false) { data = before; say(friendlyError(r.reason), false); }
      else if (okText) say(typeof okText === 'function' ? okText(r) : okText, true);
    } catch (e) { data = before; say(friendlyError(e), false); }
    finally { busy.delete(name); draw(); refresh(); }
  }
  const without = (list, name) => list.filter(f => f.username !== name);

  async function add(e) {
    e.preventDefault();
    const name = input.value.trim().replace(/^@/, '');
    if (!name) return;
    if (!USERNAME.test(name)) return say('Usernames are 3–20 letters, numbers or _.', false);
    if (me && name.toLowerCase() === me.toLowerCase()) return say(REASONS.self, false);
    const lower = name.toLowerCase(), has = (l) => l.some(f => f.username.toLowerCase() === lower);
    if (has(data.friends)) return say(REASONS.already_friends, false);
    if (has(data.outgoing)) return say(REASONS.already_sent, false);
    addBtn.disabled = true; addBtn.textContent = 'Sending…';
    try {
      await act(name, () => remote.sendFriendRequest(name), null,
        (r) => r?.status === 'friends' ? `You and ${name} are now friends!` : `Request sent to ${name}.`);
      if (!msg.className.includes('muted')) input.value = '';
    } finally { addBtn.disabled = false; addBtn.textContent = 'Add friend'; }
  }

  const btn = (label, user, onclick, cls = '') => h('button.btn.small' + cls, { type: 'button', disabled: busy.has(user), onclick }, busy.has(user) ? '…' : label);

  function joinBtn(f) {
    const p = where[f.username];
    if (p) return h('span.p-playing', h('span.muted', ` playing ${gameName(p.gameId)} `),
      h('a.btn.small.join-friend' + (p.full ? '.secondary' : ''), { href: `${playUrl(p.gameId)}&join=${encodeURIComponent(f.username)}`, target: '_blank', rel: 'noopener', 'data-join': f.username,
        title: p.full ? 'Their server is full: you will join another server of the same game' : `Join ${f.displayName || f.username} in ${gameName(p.gameId)}` }, p.full ? 'Full: play' : 'Join'));
    return h('span.muted.small.p-nojoin', { title: f.online ? 'They are online but not in a game right now' : 'They are offline' },
      f.online ? ' online · not in a game' : ' offline');
  }
  const row = (f, actions) => h('div.p-friend' + (busy.has(f.username) ? '.busy' : ''), { 'data-user': f.username },
    h('span.dot' + (f.online || where[f.username] ? '.online' : ''), { title: f.online || where[f.username] ? 'Online' : 'Offline' }),
    h('b', f.displayName || f.username), h('span.muted', ` @${f.username}`), h('span.grow'), ...actions);

  function draw() {
    if (!loaded) return;
    const isOn = (f) => (f.online || where[f.username]) ? 1 : 0;
    const friends = [...data.friends].sort((a, b) => (!!where[b.username] - !!where[a.username]) || (isOn(b) - isOn(a)) || String(a.username).localeCompare(b.username));
    const online = friends.filter(isOn).length;
    clear(lists).append(h('div.p-friend-lists',
      data.incoming.length ? h('h3', `Requests for you (${data.incoming.length})`) : null,
      data.incoming.map(f => row(f, [
        btn('Accept', f.username, () => act(f.username, () => remote.respondFriendRequest(f.username, true),
          (d) => ({ ...d, incoming: without(d.incoming, f.username), friends: [...d.friends, { ...f }] }), `You and ${f.username} are now friends!`)),
        btn('Decline', f.username, () => act(f.username, () => remote.respondFriendRequest(f.username, false),
          (d) => ({ ...d, incoming: without(d.incoming, f.username) }), 'Request declined.'), '.secondary')])),
      h('h3', `Friends (${friends.length}) · ${online} online`),
      friends.length ? friends.map(f => row(f, [joinBtn(f),
        btn('Remove', f.username, () => { if (confirm(`Remove ${f.displayName || f.username} from friends?`))
          act(f.username, () => remote.removeFriend(f.username), (d) => ({ ...d, friends: without(d.friends, f.username) }), 'Friend removed.'); }, '.secondary')]))
        : h('p.muted', 'No friends yet. Add someone by their exact username.'),
      data.outgoing.length ? h('h3', 'Waiting for them') : null,
      data.outgoing.map(f => row(f, [h('span.muted.small', ' pending '),
        btn('Cancel', f.username, () => act(f.username, () => remote.removeFriend(f.username), (d) => ({ ...d, outgoing: without(d.outgoing, f.username) }), 'Request cancelled.'), '.secondary')]))));
  }

  const onFocus = () => { if (!document.hidden && Date.now() - lastAt > 3000) { failures = 0; refresh(); } };
  window.addEventListener('focus', onFocus);
  document.addEventListener('visibilitychange', onFocus);
  window.addEventListener('online', onFocus);

  sec.append(h('form.p-card.row#friend-form', { onsubmit: add }, input, addBtn), msg, lists, status);
  refresh();
  return { el: sec, refresh, destroy() { dead = true; seq++; clearTimeout(timer);
    window.removeEventListener('focus', onFocus); document.removeEventListener('visibilitychange', onFocus); window.removeEventListener('online', onFocus); } };
}
