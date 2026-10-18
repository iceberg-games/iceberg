// Real-time multiplayer on Supabase Realtime (free plan friendly).
//
//   server (RPC, authoritative)          realtime (private channel game:<gameId>:<instance>)
//   mp_join   -> instance with room       presence: who is connected now (key = username)
//   mp_heartbeat (20 s) -> trusted roster broadcast 's': position / yaw / animation flags  (cosmetic only)
//                + send rate (budget)     broadcast 'c': "new chat message" hint -> receivers re-poll
//
// Trust: names, cosmetics and colours come ONLY from the server roster (mp_join / mp_heartbeat).
// Realtime Authorization (RLS on realtime.messages) lets only current members of an instance join
// its channel. Broadcasts are never trusted for anything but drawing: they are validated, rate
// limited per sender, and ignored unless the sender is in the roster AND present. Chat text never
// travels over broadcast: bubbles come from server-validated post_chat/get_chat (phrase ids).
// Economy is untouched (RPC only).
import { Avatar } from '../game/avatar.js';
import { RealtimeClient } from '../net/realtime.js';

export const MAX_HZ = 10;                 // never send more than this
const RECV_MAX_PER_S = 15;                // drop senders above this
const KEEPALIVE_MS = 5000;                // idle players resend now and then (late joiners)
const BOUND = 5000;                       // |coordinate| sanity bound
const FLAG = { move: 1, air: 2, fly: 4 };
const r2 = (v) => Math.round(v * 100) / 100;

export function createMultiplayer({ engine, getRemote, bubbles, me: getMe, AvatarClass = Avatar, RealtimeImpl = RealtimeClient, now = () => performance.now() }) {
  let rt = null, s = null, raf = 0;
  const stats = { sent: 0, recv: 0, dropped: 0, rejected: 0 };
  let chatHint = null;

  function realtimeFor(remote) {
    if (!rt) { const { url, anonKey } = remote.realtimeConfig; rt = new RealtimeImpl(url, anonKey, { getToken: () => remote.accessToken }); }
    return rt;
  }

  async function join(gameId, { friend = null } = {}) {
    await leave();
    const remote = getRemote(); const me = getMe();
    if (!remote?.signedIn || !me?.username) return null;
    const res = await remote.mpJoin(gameId, friend);
    if (!res?.ok) return null;
    const sess = s = {
      gameId, instance: res.instance, topic: res.topic, room: `game:${gameId}:${res.instance}`, cap: res.cap, note: res.note,
      sendHz: Math.min(MAX_HZ, Number(res.sendHz) || 1), roster: new Map(), present: new Set(), others: new Map(),
      remote, me, lastSent: 0, lastState: null, timers: [], token: remote.accessToken, rosterAt: 0, wantSend: false,
    };
    setRoster(res.roster);
    const ch = sess.channel = realtimeFor(remote).channel(res.topic, { presenceKey: me.username, private: true });
    ch.onPresence(({ state, joins, leaves }) => {
      if (s !== sess) return;
      sess.present = new Set(Object.keys(state));
      for (const k of leaves) removeOther(k);
      const fresh = joins.filter(k => k !== me.username);
      if (fresh.some(k => !sess.roster.has(k))) refreshRoster();
      syncOthers();
      if (fresh.length) sess.wantSend = true;           // let newcomers see where we are right away
    });
    ch.onBroadcast('s', onState);
    ch.onBroadcast('c', (p) => { if (s === sess && p && sess.roster.has(p.u) && sess.present.has(p.u)) chatHint?.(); });
    try { await ch.subscribe(); }
    catch (e) { stats.rejected++; if (s === sess) s = null; await remote.mpLeave().catch(() => {}); console.warn('multiplayer join refused', e.message); return null; }
    ch.track({ u: me.username });
    sess.timers.push(setInterval(sendTick, 50), setInterval(heartbeat, 20000));
    cancelAnimationFrame(raf); raf = requestAnimationFrame(frame);
    return { instance: sess.instance, topic: sess.topic, room: sess.room, note: sess.note, cap: sess.cap };
  }

  function setRoster(list) {
    if (!s) return;
    s.roster = new Map((list || []).map(p => [p.username, p])); s.rosterAt = now();
    for (const [k, o] of s.others) {
      const p = s.roster.get(k); if (!p) { removeOther(k); continue; }
      const look = JSON.stringify([p.equipped, p.rocketColors, p.cosmeticColors]);
      if (o.look !== look) { try { o.avatar.applyLoadout({ equipped: p.equipped || {}, rocketColors: p.rocketColors, cosmeticColors: p.cosmeticColors || {} }); } catch (e) { console.warn(e); } o.look = look; }
    }
    syncOthers();
  }
  async function refreshRoster() {
    if (!s || now() - s.rosterAt < 2500) return;
    s.rosterAt = now(); await heartbeat();
  }
  async function heartbeat() {
    const sess = s; if (!sess) return;
    try {
      const r = await sess.remote.mpHeartbeat(sess.gameId, sess.instance);
      if (s !== sess) return;
      if (!r?.ok) { const again = await sess.remote.mpJoin(sess.gameId, null); if (s === sess && again?.ok && again.instance === sess.instance) setRoster(again.roster); return; }
      sess.sendHz = Math.min(MAX_HZ, Number(r.sendHz) || 1);
      setRoster(r.roster);
      const tok = sess.remote.accessToken; if (tok && tok !== sess.token) { sess.token = tok; rt?.setAuth(tok); }
    } catch { /* offline for a moment: keep going */ }
  }

  // other players appear only when they are BOTH in the trusted roster and present on the socket
  function syncOthers() {
    if (!s) return;
    for (const k of s.present) if (k !== s.me.username && s.roster.has(k) && !s.others.has(k)) addOther(k);
    for (const k of [...s.others.keys()]) if (!s.present.has(k)) removeOther(k);
  }
  function addOther(k) {
    const p = s.roster.get(k); const scene = engine.game?.scene;
    if (!scene || engine.game.hideAvatar) return;
    const avatar = new AvatarClass();
    try { avatar.applyLoadout({ equipped: p.equipped || {}, rocketColors: p.rocketColors, cosmeticColors: p.cosmeticColors || {} }); } catch (e) { console.warn(e); }
    avatar.root.visible = false;                    // until the first position arrives
    scene.add(avatar.root);
    const o = { avatar, look: JSON.stringify([p.equipped, p.rocketColors, p.cosmeticColors]), samples: [], recv: [], gap: 100, lastT: 0, seq: -1, displayName: p.displayName || k };
    s.others.set(k, o);
    bubbles?.track(k, avatar.bones?.head || avatar.root, { name: p.displayName || k, offsetY: 1.1 });
  }
  function removeOther(k) {
    const o = s?.others.get(k); if (!o) return;
    s.others.delete(k); bubbles?.untrack(k);
    o.avatar.root.parent?.remove(o.avatar.root);
    try { o.avatar.dispose?.(); } catch { /* */ }
  }

  function onState(p) {
    if (!s) return;
    stats.recv++;
    const ok = p && typeof p.u === 'string' && p.u !== s.me.username && s.roster.has(p.u) && s.present.has(p.u)
      && Array.isArray(p.p) && p.p.length === 3 && p.p.every(v => Number.isFinite(v) && Math.abs(v) < BOUND)
      && Number.isFinite(p.r) && Number.isInteger(p.a) && p.a >= 0 && p.a < 8 && Number.isInteger(p.s);
    const o = ok && s.others.get(p.u);
    if (!o) { stats.dropped++; return; }
    const t = now();
    o.recv = o.recv.filter(x => t - x < 1000); if (o.recv.length >= RECV_MAX_PER_S) { stats.dropped++; return; }
    o.recv.push(t);
    if (p.s <= o.seq && o.seq - p.s < 1e6) { stats.dropped++; return; }   // out of order / replay
    o.seq = p.s;
    if (o.lastT) o.gap = o.gap * 0.8 + Math.min(2000, t - o.lastT) * 0.2;
    o.lastT = t;
    o.samples.push({ t, x: p.p[0], y: p.p[1], z: p.p[2], r: p.r, a: p.a });
    if (o.samples.length > 30) o.samples.shift();
    if (!o.avatar.root.visible) { o.avatar.root.visible = true; o.avatar.root.position.set(p.p[0], p.p[1], p.p[2]); o.avatar.root.rotation.y = p.r; }
  }

  function localState() {
    const pl = engine.player, av = engine.avatar;
    const moving = Math.hypot(pl.vel.x, pl.vel.z) > 0.1;
    const air = !pl.onGround && !pl.mods?.carpet;
    return { p: [r2(pl.pos.x), r2(pl.pos.y), r2(pl.pos.z)], r: r2(av.root.rotation.y), a: (moving ? FLAG.move : 0) | (air ? FLAG.air : 0) | (pl.flying ? FLAG.fly : 0) };
  }
  let seq = 0;
  function sendTick() {
    if (!s || !engine.running || document.visibilityState === 'hidden') return;
    if (!s.others.size && !s.wantSend) return;                       // nobody to see us: send nothing
    const t = now(), minGap = 1000 / Math.min(MAX_HZ, s.sendHz);
    if (t - s.lastSent < minGap) return;
    const st = localState(), prev = s.lastState;
    const changed = !prev || prev.a !== st.a || Math.abs(prev.r - st.r) > 0.02 || st.p.some((v, i) => Math.abs(v - prev.p[i]) > 0.02);
    if (!changed && !s.wantSend && t - s.lastSent < KEEPALIVE_MS) return;
    if (s.channel.send('s', { u: s.me.username, s: ++seq, ...st })) { stats.sent++; s.lastSent = t; s.lastState = st; s.wantSend = false; }
  }

  let lastFrame = 0;
  function frame() {
    raf = requestAnimationFrame(frame);
    if (!s) return;
    const t = now(), dt = lastFrame ? Math.min(0.05, (t - lastFrame) / 1000) : 0.016; lastFrame = t;
    for (const o of s.others.values()) {
      if (!o.samples.length) continue;
      const delay = Math.min(1200, Math.max(120, o.gap * 1.5));
      const T = t - delay; const sm = o.samples;
      while (sm.length > 2 && sm[1].t <= T) sm.shift();
      let a = sm[0], b = sm[1] || sm[0];
      if (T <= a.t) b = a;
      const k = b.t > a.t ? Math.min(1, Math.max(0, (T - a.t) / (b.t - a.t))) : 1;
      const pos = o.avatar.root.position;
      pos.set(a.x + (b.x - a.x) * k, a.y + (b.y - a.y) * k, a.z + (b.z - a.z) * k);
      let d = b.r - a.r; d = Math.atan2(Math.sin(d), Math.cos(d));
      o.avatar.root.rotation.y = a.r + d * k;
      const f = (k < 0.5 ? a : b).a;
      const stale = t - o.lastT > Math.max(1500, o.gap * 3);       // no news: stop walking in place
      o.avatar.animate(dt, { speed: (f & FLAG.move) && !stale ? 1 : 0, air: !!(f & FLAG.air), flying: !!(f & FLAG.fly) });
    }
  }

  async function leave() {
    const sess = s; if (!sess) return;
    s = null; cancelAnimationFrame(raf); lastFrame = 0;
    sess.timers.forEach(clearInterval);
    for (const k of [...sess.others.keys()]) { const o = sess.others.get(k); bubbles?.untrack(k); o.avatar.root.parent?.remove(o.avatar.root); try { o.avatar.dispose?.(); } catch { /* */ } }
    sess.others.clear();
    await sess.channel?.unsubscribe().catch(() => {});
    await sess.remote.mpLeave().catch(() => {});
  }

  return {
    join, leave,
    /** A remote player said something (server-validated chat): bubble + mouth over their avatar. */
    speak(username, text, ms) { const o = s?.others.get(username); if (!o) return false; bubbles?.say(username, text, ms); o.avatar.talk?.(ms); return true; },
    /** Tell others "I posted a chat message" so they re-poll now (no text in the broadcast). */
    hintChat() { if (s) s.channel.send('c', { u: s.me.username }); },
    onChatHint(fn) { chatHint = fn; },
    get info() {
      if (!s) return null;
      return { gameId: s.gameId, instance: s.instance, topic: s.topic, room: s.room, cap: s.cap, note: s.note, sendHz: s.sendHz, stats: { ...stats },
        present: [...s.present], roster: [...s.roster.keys()],
        others: [...s.others].map(([k, o]) => ({ username: k, visible: o.avatar.root.visible, pos: o.avatar.root.position.toArray().map(r2), talking: !!o.avatar.isTalking?.(), equipped: o.avatar.attached ? Object.values(o.avatar.attached).map(x => x.userData.cosmeticId) : [] })) };
    },
  };
}
