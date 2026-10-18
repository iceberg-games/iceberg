// Real-time multiplayer on Supabase Realtime (free plan friendly).
//
//   server (RPC, authoritative)          realtime (private channel game:<gameId>:<instance>)
//   mp_join   -> instance with room       presence: who is connected now (key = username)
//   mp_heartbeat (20 s) -> trusted roster broadcast 's': position / yaw / animation flags  (cosmetic only)
//                + send rate (budget)     broadcast 'c': "new chat message" hint -> receivers re-poll
//                + serverNow (mp.now())   broadcast 'st': shared game state from the HOST (batched, versioned)
//                                         broadcast 'sq': "send me the state snapshot" (late joiner)
//                                         broadcast 'ev': game events from any player (rate limited)
// Game-facing API: docs/MULTIPLAYER_API.md (isHost, onHostChanged, setState, onState, sendEvent, onEvent,
// players, localId, now). Host = earliest-joined player still present (server joined_at order).
//
// Trust: names, cosmetics and colours come ONLY from the server roster (mp_join / mp_heartbeat).
// Realtime Authorization (RLS on realtime.messages) lets only current members of an instance join
// its channel. Broadcasts are never trusted for anything but drawing: they are validated, rate
// limited per sender, and ignored unless the sender is in the roster AND present. Chat text never
// travels over broadcast: bubbles come from server-validated post_chat/get_chat (phrase ids).
// Economy is untouched (RPC only).
import { Avatar } from '../game/avatar.js';
import { RealtimeClient } from '../net/realtime.js';
import { bus as defaultBus } from '../core/events.js';

export const MAX_HZ = 10;                 // never send more than this
const RECV_MAX_PER_S = 15;                // drop senders above this
const KEEPALIVE_MS = 5000;                // idle players resend now and then (late joiners)
const BOUND = 5000;                       // |coordinate| sanity bound
// animation states sent in movement packets (the local avatar has idle / walk / air / fly poses)
export const ANIM = { idle: 0, walk: 1, jump: 2, fall: 3, fly: 4 };
const ANIM_NAME = Object.fromEntries(Object.entries(ANIM).map(([k, v]) => [v, k]));
const IMMEDIATE_PER_S = 3;                // jump / land / teleport packets outside the 10 Hz budget
const TELEPORT_DIST = 6;                  // a jump this big in one frame = teleport/respawn: snap, don't glide
const EXTRAPOLATE_MS = 250;               // dead-reckon with the velocity hint when packets are late
const r2 = (v) => Math.round(v * 100) / 100;
// shared state / events limits (free-tier budget)
const KEY_RE = /^[A-Za-z0-9_.:-]{1,40}$/;
const MAX_VALUE = 4096, MAX_KEYS = 32, MAX_EVENT = 1024, BATCH_MAX = 12000;
const STATE_FLUSH_MS = 200;               // <= 5 'st' messages/s, latest value per key wins
const SNAPSHOT_EVERY_MS = 10000;          // host re-sends all keys while others are present (heals losses)
const EV_RATE = 5, EV_BURST = 10;         // events per second per sender
/** Plain-JSON check + deep copy. Returns { ok, json, value } or { ok:false, reason }. */
export function plainJSON(value, max = MAX_VALUE) {
  const seen = new Set();
  const ok = (v) => {
    if (v === null || typeof v === 'string' || typeof v === 'boolean') return true;
    if (typeof v === 'number') return Number.isFinite(v);
    if (typeof v !== 'object' || seen.has(v)) return false;
    const proto = Object.getPrototypeOf(v);
    if (!Array.isArray(v) && proto !== Object.prototype && proto !== null) return false;
    seen.add(v);
    const r = Array.isArray(v) ? v.every(ok) : Object.values(v).every(x => x !== undefined && ok(x));
    seen.delete(v); return r;
  };
  if (!ok(value)) return { ok: false, reason: 'not_json' };
  const json = JSON.stringify(value);
  if (json.length > max) return { ok: false, reason: 'too_large', size: json.length };
  return { ok: true, json, value: JSON.parse(json) };
}

const PROXIMITY_MS = 200;                 // avatar.updateProximity ~5x/s (not every frame)

export function createMultiplayer({ engine, getRemote, bubbles, me: getMe, AvatarClass = Avatar, RealtimeImpl = RealtimeClient, now = () => performance.now(), getListener = null, wallNow = () => Date.now(), localName = () => 'You', bus = defaultBus }) {
  let rt = null, s = null, raf = 0;
  const stats = { sent: 0, recv: 0, dropped: 0, rejected: 0, disposed: 0, proximity: 0, immediate: 0, stateSent: 0, stateRecv: 0, events: 0 };
  let chatHint = null;
  let clockOffset = 0;                                   // server clock - local wall clock (ms)

  function realtimeFor(remote) {
    if (!rt) { const { url, anonKey } = remote.realtimeConfig; rt = new RealtimeImpl(url, anonKey, { getToken: () => remote.accessToken }); }
    return rt;
  }
  function syncClock(serverNow, t0, t1) {
    const srv = Date.parse(serverNow); if (!Number.isFinite(srv)) return;
    const off = srv - (t0 + t1) / 2;
    clockOffset = clockSamples++ ? clockOffset * 0.7 + off * 0.3 : off;
  }
  let clockSamples = 0;

  // ---------------- game-facing shared state (works offline as single-player) ----------------
  const subs = { state: new Map(), event: new Map(), host: [], players: [] };
  const state = new Map();                               // key -> { v, ver, at, from }
  const pending = new Set();                             // keys the host still has to broadcast
  let lastHost = null, lastPlayersKey = '', readyWaiters = [], joinedFor = null;
  const localId = () => s?.me.username || getMe()?.username || 'local';
  const mpNow = () => wallNow() + clockOffset;
  // subscriptions belong to the game that made them (during create() or later) and die when it unloads
  let gen = 0; bus?.on?.('game:unloaded', () => { gen++; });
  const gameTag = () => gen;
  function addSub(list, cb) {
    const e = { cb, game: gameTag() }; list.push(e);
    return () => { const i = list.indexOf(e); if (i >= 0) list.splice(i, 1); };
  }
  function live(list) {                                  // drop subscriptions of games that have been unloaded
    for (let i = list.length - 1; i >= 0; i--) if (list[i].game !== gameTag()) list.splice(i, 1);
    return list.slice();
  }
  const call = (e, ...a) => { try { e.cb(...a); } catch (err) { console.warn('[mp] callback failed', err); } };

  function playersList() {
    const meId = localId();
    if (!s) return [{ id: meId, name: getMe()?.displayName || getMe()?.username || localName(), username: meId, displayName: getMe()?.displayName || null, isLocal: true, isHost: true, joinedAt: null }];
    const ids = new Set([meId, ...[...s.present].filter(k => s.roster.has(k))]);
    const list = [...ids].map(id => { const p = s.roster.get(id) || {}; return { id, name: p.displayName || id, username: id, displayName: p.displayName || null, isLocal: id === meId, isHost: false, joinedAt: p.joinedAt || null }; });
    list.sort((a, b) => (Date.parse(a.joinedAt) || Infinity) - (Date.parse(b.joinedAt) || Infinity) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    if (list.length) list[0].isHost = true;
    return list;
  }
  const hostId = () => playersList()[0]?.id ?? localId();
  const isHost = () => hostId() === localId();
  function checkRoles() {
    const h = hostId();
    if (h !== lastHost) {
      const was = lastHost; lastHost = h;
      if (was !== null || h !== localId()) for (const e of live(subs.host)) call(e, { hostId: h, isHost: h === localId() });
      if (h === localId() && s && s.others.size) scheduleSnapshot(50);       // new host: everyone gets my copy
    }
    const pl = playersList(), key = pl.map(p => p.id + (p.isHost ? '*' : '')).join(',');
    if (key !== lastPlayersKey) { lastPlayersKey = key; for (const e of live(subs.players)) call(e, pl); }
  }
  function applyState(k, rec, { notify = true, force = false } = {}) {
    const cur = state.get(k);
    if (cur && cur.ver >= rec.ver && !force) return false;
    state.set(k, rec);
    if (notify) {
      const meta = { key: k, from: rec.from, at: rec.at };
      for (const e of live(subs.state.get(k) || [])) call(e, structuredClone(rec.v), meta);
      for (const e of live(subs.state.get('*') || [])) call(e, structuredClone(rec.v), meta);
    }
    return true;
  }
  function setState(key, value) {
    if (typeof key !== 'string' || !KEY_RE.test(key)) return { ok: false, reason: 'bad_key' };
    if (!isHost()) return { ok: false, reason: 'not_host' };
    const j = plainJSON(value);
    if (!j.ok) { console.warn(`[mp] setState('${key}') rejected: ${j.reason}${j.size ? ` (${j.size} bytes > ${MAX_VALUE})` : ''}`); return { ok: false, reason: j.reason }; }
    if (!state.has(key) && state.size >= MAX_KEYS) { console.warn(`[mp] setState('${key}') rejected: more than ${MAX_KEYS} keys`); return { ok: false, reason: 'too_many_keys' }; }
    const cur = state.get(key);
    applyState(key, { v: j.value, ver: Math.max((cur?.ver || 0) + 1, Math.floor(mpNow())), at: mpNow(), from: localId(), solo: !s || !s.presenceSeen });   // solo: set before we knew who else is here
    if (s) { pending.add(key); flushSoon(); }
    return { ok: true };
  }
  function onState(key, cb) {
    if (typeof cb !== 'function') return () => {};
    const list = subs.state.get(key) || subs.state.set(key, []).get(key);
    const off = addSub(list, cb);
    const fire = (k, rec) => call({ cb }, structuredClone(rec.v), { key: k, from: rec.from, at: rec.at });
    if (key === '*') for (const [k, rec] of state) fire(k, rec);
    else if (state.has(key)) fire(key, state.get(key));          // current snapshot right away (late subscribers too)
    return off;
  }
  // ---- events (any player) ----
  const myBucket = { tokens: EV_BURST, t: 0 };
  const take = (b, rate, burst) => { const t = now(); b.tokens = Math.min(burst, b.tokens + (b.t ? (t - b.t) / 1000 * rate : burst)); b.t = t; if (b.tokens < 1) return false; b.tokens -= 1; return true; };
  function deliverEvent(name, payload, meta) {
    for (const e of live(subs.event.get(name) || [])) call(e, structuredClone(payload), meta);
    for (const e of live(subs.event.get('*') || [])) call(e, structuredClone(payload), meta);
  }
  function sendEvent(name, payload = null) {
    if (typeof name !== 'string' || !KEY_RE.test(name)) return { ok: false, reason: 'bad_name' };
    const j = plainJSON(payload, MAX_EVENT);
    if (!j.ok) { console.warn(`[mp] sendEvent('${name}') rejected: ${j.reason}`); return { ok: false, reason: j.reason }; }
    if (!take(myBucket, EV_RATE, EV_BURST)) return { ok: false, reason: 'rate_limited' };
    const at = mpNow(), from = localId();
    if (s) { s.channel.send('ev', { u: from, n: name, d: j.value, at }); stats.events++; }
    queueMicrotask(() => deliverEvent(name, j.value, { name, from, at }));   // local echo: one code path for everyone
    return { ok: true };
  }
  function onEvent(name, cb) {
    if (typeof cb !== 'function') return () => {};
    return addSub(subs.event.get(name) || subs.event.set(name, []).get(name), cb);
  }
  // ---- host broadcast of state ----
  let flushTimer = null, snapTimer = null, lastSnapReply = 0;
  function flushSoon() { if (!flushTimer) flushTimer = setTimeout(flush, STATE_FLUSH_MS); }
  function sendBatch(keys, snap) {
    let batch = {}, size = 0;
    const out = () => { if (Object.keys(batch).length && s?.channel.send('st', { u: s.me.username, kv: batch, snap: !!snap })) stats.stateSent++; batch = {}; size = 0; };
    for (const k of keys) {
      const rec = state.get(k); if (!rec) continue;
      const n = JSON.stringify(rec.v).length + k.length + 40;
      if (size + n > BATCH_MAX) out();
      batch[k] = { v: rec.v, ver: rec.ver, at: rec.at }; size += n;
    }
    out();
  }
  function flush() {
    flushTimer = null;
    if (!s || !isHost()) { pending.clear(); return; }
    if (s.present.size <= 1) { pending.clear(); return; }               // alone: the join snapshot covers newcomers
    sendBatch([...pending], false); pending.clear();
  }
  function scheduleSnapshot(ms = 300) {
    clearTimeout(snapTimer);
    snapTimer = setTimeout(() => { if (s && isHost() && state.size) { sendBatch([...state.keys()], true); s.lastSnap = now(); } }, ms);
  }
  function onStateMsg(p) {
    if (!s || !p || typeof p.u !== 'string' || p.u === s.me.username || !s.present.has(p.u) || !s.roster.has(p.u)) { stats.dropped++; return; }
    if (p.u !== hostId()) { stats.dropped++; return; }                    // only the current host writes
    if (!p.kv || typeof p.kv !== 'object') return;
    stats.stateRecv++;
    for (const [k, r] of Object.entries(p.kv).slice(0, MAX_KEYS)) {
      if (!KEY_RE.test(k) || !r || !Number.isFinite(r.ver)) continue;
      const j = plainJSON(r.v); if (!j.ok) continue;
      if (!state.has(k) && state.size >= MAX_KEYS) continue;
      applyState(k, { v: j.value, ver: r.ver, at: Number(r.at) || mpNow(), from: p.u }, { force: !!state.get(k)?.solo });   // the real host beats single-player state
    }
    if (p.snap) { s.gotSnapshot = true; resolveReady(); }
  }
  function onSnapReq(p) {
    if (!s || !p || !s.present.has(p.u) || !isHost()) return;
    if (now() - lastSnapReply < 1000) return;                              // at most one reply per second
    lastSnapReply = now(); scheduleSnapshot(50);
  }
  const evBuckets = new Map();
  function onEventMsg(p) {
    if (!s || !p || typeof p.u !== 'string' || p.u === s.me.username || !s.present.has(p.u) || !s.roster.has(p.u)) { stats.dropped++; return; }
    if (typeof p.n !== 'string' || !KEY_RE.test(p.n)) return;
    const b = evBuckets.get(p.u) || evBuckets.set(p.u, { tokens: EV_BURST, t: 0 }).get(p.u);
    if (!take(b, EV_RATE * 2, EV_BURST * 2)) { stats.dropped++; return; }
    const j = plainJSON(p.d ?? null, MAX_EVENT); if (!j.ok) return;
    deliverEvent(p.n, j.value, { name: p.n, from: p.u, at: Number(p.at) || mpNow() });
  }
  function resolveReady() { const w = readyWaiters; readyWaiters = []; w.forEach(f => f()); }
  function ready(timeoutMs = 3000) {
    if (joinedFor && joinedFor === gameTag() && (!s || isHost() || s.gotSnapshot)) return Promise.resolve(true);
    return new Promise((res) => { readyWaiters.push(() => res(true)); setTimeout(() => res(false), timeoutMs); });
  }

  // ---------------- session ----------------
  async function join(gameId, { friend = null } = {}) {
    await leave();
    const game = gameTag();
    const remote = getRemote(); const me = getMe();
    const done = (v) => { joinedFor = game; if (!s || isHost()) resolveReady(); checkRoles(); return v; };
    if (!remote?.signedIn || !me?.username) return done(null);
    const t0 = wallNow(); const res = await remote.mpJoin(gameId, friend);
    if (!res?.ok) return done(null);
    if (res.serverNow) syncClock(res.serverNow, t0, wallNow());
    const sess = s = {
      gameId, instance: res.instance, topic: res.topic, room: `game:${gameId}:${res.instance}`, cap: res.cap, note: res.note,
      sendHz: Math.min(MAX_HZ, Number(res.sendHz) || 1), roster: new Map(), present: new Set([me.username]), others: new Map(),
      remote, me, lastSent: 0, lastState: null, timers: [], token: remote.accessToken, rosterAt: 0, wantSend: false,
      immediate: [], prevGround: null, prevPos: null, lastSnap: 0, gotSnapshot: false,
    };
    setRoster(res.roster);
    const ch = sess.channel = realtimeFor(remote).channel(res.topic, { presenceKey: me.username, private: true });
    ch.onPresence(({ state: pres, joins, leaves }) => {
      if (s !== sess) return;
      sess.presenceSeen = true;
      sess.present = new Set([me.username, ...Object.keys(pres)]);
      for (const k of leaves) removeOther(k);
      const fresh = joins.filter(k => k !== me.username);
      if (fresh.some(k => !sess.roster.has(k))) refreshRoster();
      syncOthers();
      if (fresh.length) { sess.wantSend = true; if (isHost() && state.size) scheduleSnapshot(); }   // late joiners: snapshot
      checkRoles();
    });
    ch.onBroadcast('s', onMove);
    ch.onBroadcast('st', onStateMsg);
    ch.onBroadcast('sq', onSnapReq);
    ch.onBroadcast('ev', onEventMsg);
    ch.onBroadcast('c', (p) => { if (s === sess && p && sess.roster.has(p.u) && sess.present.has(p.u)) chatHint?.(); });
    try { await ch.subscribe(); }
    catch (e) { stats.rejected++; if (s === sess) s = null; await remote.mpLeave().catch(() => {}); console.warn('multiplayer join refused', e.message); return done(null); }
    ch.track({ u: me.username });
    sess.timers.push(setInterval(sendTick, 50), setInterval(heartbeat, 20000), setInterval(proximityTick, PROXIMITY_MS),
      setInterval(() => { if (s === sess && isHost() && sess.others.size && state.size && now() - sess.lastSnap >= SNAPSHOT_EVERY_MS) scheduleSnapshot(0); }, 1000));
    // late joiner: ask the host for the snapshot (twice, in case the first ask races presence)
    for (const ms of [600, 2000, 5000]) sess.timers.push(setTimeout(() => { if (s === sess && !isHost() && !sess.gotSnapshot) ch.send('sq', { u: me.username }); }, ms));
    cancelAnimationFrame(raf); raf = requestAnimationFrame(frame);
    done(null);
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
    syncOthers(); checkRoles();
  }
  async function refreshRoster() {
    const sess = s; if (!sess) return;
    const wait = 2500 - (now() - sess.rosterAt);
    if (wait > 0) { if (!sess.rosterRetry) sess.rosterRetry = setTimeout(() => { sess.rosterRetry = null; if (s === sess) refreshRoster(); }, wait); return; }   // throttled: retry, don't drop
    sess.rosterAt = now(); await heartbeat();
  }
  async function heartbeat() {
    const sess = s; if (!sess) return;
    try {
      const t0 = wallNow(); const r = await sess.remote.mpHeartbeat(sess.gameId, sess.instance);
      if (s !== sess) return;
      if (!r?.ok) { const again = await sess.remote.mpJoin(sess.gameId, null); if (s === sess && again?.ok && again.instance === sess.instance) setRoster(again.roster); return; }
      if (r.serverNow) syncClock(r.serverNow, t0, wallNow());
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
    avatar.root.userData.remotePlayer = k;          // visuals only: never engine.player, never collides or triggers
    scene.add(avatar.root);
    try { const l = getListener?.(); if (l) avatar.attachWindAudio?.(l); } catch (e) { console.warn(e); }   // shared listener (core/audio.js)
    const o = { avatar, look: JSON.stringify([p.equipped, p.rocketColors, p.cosmeticColors]), samples: [], recv: [], gap: 100, lastT: 0, seq: -1, displayName: p.displayName || k,
      anim: 0, animsSeen: new Set(), events: { j: 0, l: 0, t: 0 }, snaps: 0 };
    s.others.set(k, o);
    bubbles?.track(k, avatar.bones?.head || avatar.root, { name: p.displayName || k, offsetY: 1.1 });
  }
  function removeOther(k) {
    const o = s?.others.get(k); if (!o) return;
    s.others.delete(k); bubbles?.untrack(k);
    o.avatar.root.parent?.remove(o.avatar.root);
    try { o.avatar.attachWindAudio?.(null); o.avatar.dispose?.(); } catch { /* */ }   // dispose stops its audio
    stats.disposed++;
  }

  const vecOk = (v, max) => Array.isArray(v) && v.length === 3 && v.every(x => Number.isFinite(x) && Math.abs(x) < max);
  function onMove(p) {
    if (!s) return;
    stats.recv++;
    const ok = p && typeof p.u === 'string' && p.u !== s.me.username && s.roster.has(p.u) && s.present.has(p.u)
      && vecOk(p.p, BOUND) && Number.isFinite(p.r) && Number.isInteger(p.a) && p.a >= 0 && p.a < 8 && Number.isInteger(p.s)
      && (p.v == null || vecOk(p.v, 200)) && (p.e == null || ['j', 'l', 't'].includes(p.e));
    const o = ok && s.others.get(p.u);
    if (!o) { stats.dropped++; return; }
    const t = now();
    o.recv = o.recv.filter(x => t - x < 1000); if (o.recv.length >= RECV_MAX_PER_S) { stats.dropped++; return; }
    o.recv.push(t);
    if (p.s <= o.seq && o.seq - p.s < 1e6) { stats.dropped++; return; }   // out of order / replay
    o.seq = p.s;
    if (o.lastT && !p.e) o.gap = o.gap * 0.8 + Math.min(2000, t - o.lastT) * 0.2;
    o.lastT = t;
    const last = o.samples[o.samples.length - 1];
    const sample = { t, x: p.p[0], y: p.p[1], z: p.p[2], r: p.r, a: p.a, v: p.v || [0, 0, 0] };
    if (p.e) o.events[p.e]++;
    if (!o.avatar.root.visible || p.e === 't' || (last && Math.hypot(sample.x - last.x, sample.y - last.y, sample.z - last.z) > TELEPORT_DIST * 2)) {
      o.samples = [{ ...sample, t: t - 2000 }, sample];                        // snap (first sight, teleport, respawn)
      o.avatar.root.visible = true; o.avatar.root.position.set(p.p[0], p.p[1], p.p[2]); o.avatar.root.rotation.y = p.r; o.snaps++;
    } else { o.samples.push(sample); if (o.samples.length > 30) o.samples.shift(); }
  }

  function localAnim() {
    const pl = engine.player;
    if (pl.flying) return ANIM.fly;
    if (!pl.onGround && !pl.mods?.carpet) return pl.vel.y > 0.5 ? ANIM.jump : ANIM.fall;
    return Math.hypot(pl.vel.x, pl.vel.z) > 0.1 ? ANIM.walk : ANIM.idle;
  }
  function localState() {
    const pl = engine.player, av = engine.avatar;
    return { p: [r2(pl.pos.x), r2(pl.pos.y), r2(pl.pos.z)], r: r2(av.root.rotation.y), a: localAnim(), v: [r2(pl.vel.x), r2(pl.vel.y), r2(pl.vel.z)] };
  }
  let seq = 0;
  function sendMove(st, e) {
    const msg = { u: s.me.username, s: ++seq, ...st }; if (e) msg.e = e;
    if (s.channel.send('s', msg)) { stats.sent++; s.lastSent = now(); s.lastState = st; s.wantSend = false; if (e) stats.immediate++; return true; }
    return false;
  }
  function sendTick() {
    if (!s || !engine.running || !engine.player || document.visibilityState === 'hidden') return;
    if (!s.others.size && !s.wantSend) return;                       // nobody to see us: send nothing
    const t = now(), minGap = 1000 / Math.min(MAX_HZ, s.sendHz);
    if (t - s.lastSent < minGap) return;
    const st = localState(), prev = s.lastState;
    const changed = !prev || prev.a !== st.a || Math.abs(prev.r - st.r) > 0.02 || st.p.some((v, i) => Math.abs(v - prev.p[i]) > 0.02);
    if (!changed && !s.wantSend && t - s.lastSent < KEEPALIVE_MS) return;
    sendMove(st);
  }
  // jump / land / teleport go out at once (outside the sendHz budget, max IMMEDIATE_PER_S)
  function watchLocal() {
    const pl = engine.player; if (!pl || !engine.running) return;
    const ground = !!(pl.onGround || pl.mods?.carpet), pos = pl.pos;
    let e = null;
    if (s.prevPos && Math.hypot(pos.x - s.prevPos.x, pos.y - s.prevPos.y, pos.z - s.prevPos.z) > TELEPORT_DIST) e = 't';
    else if (s.prevGround === true && !ground && pl.vel.y > 0.5) e = 'j';
    else if (s.prevGround === false && ground) e = 'l';
    s.prevGround = ground; s.prevPos = { x: pos.x, y: pos.y, z: pos.z };
    if (!e || !s.others.size) return;
    const t = now(); s.immediate = s.immediate.filter(x => t - x < 1000);
    if (s.immediate.length >= IMMEDIATE_PER_S && e !== 't') return;
    s.immediate.push(t); sendMove(localState(), e);
  }

  // Proximity for cosmetics (e.g. Frost Tornado Hat spin + wind): each avatar gets the positions of
  // everyone else (interpolated remote positions + the local player). ~5 Hz.
  function proximityTick() {
    if (!s || !engine.running) return;
    const vis = [...s.others.values()].filter(o => o.avatar.root.visible);
    const mine = engine.avatar?.root.getWorldPosition?.(new engine.avatar.root.position.constructor()) ?? engine.player?.pos;
    try { engine.avatar?.updateProximity?.(vis.map(o => o.avatar.root.position)); } catch (e) { console.warn(e); }
    for (const o of vis) {
      try { o.avatar.updateProximity?.([mine, ...vis.filter(x => x !== o).map(x => x.avatar.root.position)].filter(Boolean)); } catch (e) { console.warn(e); }
    }
    stats.proximity++;
  }

  let lastFrame = 0;
  function frame() {
    raf = requestAnimationFrame(frame);
    if (!s) return;
    const t = now(), dt = lastFrame ? Math.min(0.05, (t - lastFrame) / 1000) : 0.016; lastFrame = t;
    try { watchLocal(); } catch (e) { console.warn(e); }
    for (const o of s.others.values()) {
      if (!o.samples.length) continue;
      const delay = Math.min(1200, Math.max(100, o.gap * 1.5));
      const T = t - delay; const sm = o.samples;
      while (sm.length > 2 && sm[1].t <= T) sm.shift();
      let a = sm[0], b = sm[1] || sm[0];
      if (T <= a.t) b = a;
      const pos = o.avatar.root.position;
      let anim;
      if (T >= b.t) {                                                  // past the newest packet: dead-reckon briefly
        const ex = Math.min(EXTRAPOLATE_MS, T - b.t) / 1000;
        pos.set(b.x + b.v[0] * ex, b.y + Math.max(-2, b.v[1] * ex), b.z + b.v[2] * ex);
        o.avatar.root.rotation.y = b.r; anim = b.a;
      } else {
        const k = b.t > a.t ? Math.min(1, Math.max(0, (T - a.t) / (b.t - a.t))) : 1;
        pos.set(a.x + (b.x - a.x) * k, a.y + (b.y - a.y) * k, a.z + (b.z - a.z) * k);
        let d = b.r - a.r; d = Math.atan2(Math.sin(d), Math.cos(d));
        o.avatar.root.rotation.y = a.r + d * k;
        anim = (k < 0.5 ? a : b).a;
      }
      const stale = t - o.lastT > Math.max(1500, o.gap * 3);       // no news: stop walking in place
      if (stale && (anim === ANIM.walk)) anim = ANIM.idle;
      o.anim = anim; o.animsSeen.add(anim);
      o.avatar.animate(dt, { speed: anim === ANIM.walk ? 1 : 0, air: anim === ANIM.jump || anim === ANIM.fall, flying: anim === ANIM.fly });
    }
  }

  async function leave() {
    const sess = s; if (!sess) return;
    s = null; cancelAnimationFrame(raf); lastFrame = 0;
    sess.timers.forEach(x => { clearInterval(x); clearTimeout(x); }); clearTimeout(sess.rosterRetry);
    clearTimeout(flushTimer); flushTimer = null; clearTimeout(snapTimer); pending.clear(); evBuckets.clear();
    for (const k of [...sess.others.keys()]) { const o = sess.others.get(k); bubbles?.untrack(k); o.avatar.root.parent?.remove(o.avatar.root); try { o.avatar.attachWindAudio?.(null); o.avatar.dispose?.(); } catch { /* */ } stats.disposed++; }
    try { engine.avatar?.updateProximity?.([]); } catch { /* */ }   // alone again: local hat calms down
    sess.others.clear();
    state.clear();                                                  // shared state belongs to that instance
    joinedFor = null;
    checkRoles();
    await sess.channel?.unsubscribe().catch(() => {});
    await sess.remote.mpLeave().catch(() => {});
  }

  return {
    join, leave,
    // ---- game API (docs/MULTIPLAYER_API.md) ----
    isHost, onHostChanged: (cb) => addSub(subs.host, cb), setState, onState, sendEvent, onEvent,
    players: playersList, localId, now: mpNow,
    onPlayersChanged: (cb) => addSub(subs.players, cb), connected: () => !!s && s.channel?.state === 'joined', ready,
    hostId,
    /** A remote player said something (server-validated chat): bubble + mouth over their avatar. */
    speak(username, text, ms) { const o = s?.others.get(username); if (!o) return false; bubbles?.say(username, text, ms); o.avatar.talk?.(ms); return true; },
    /** Tell others "I posted a chat message" so they re-poll now (no text in the broadcast). */
    hintChat() { if (s) s.channel.send('c', { u: s.me.username }); },
    onChatHint(fn) { chatHint = fn; },
    /** Debug/test: the live Avatar object drawn for a remote player (null when not present). */
    _avatarOf(username) { return s?.others.get(username)?.avatar ?? null; },
    get info() {
      if (!s) return null;
      return { gameId: s.gameId, instance: s.instance, topic: s.topic, room: s.room, cap: s.cap, note: s.note, sendHz: s.sendHz, stats: { ...stats },
        present: [...s.present], roster: [...s.roster.keys()], host: hostId(), clockOffset: Math.round(clockOffset), stateKeys: [...state.keys()],
        others: [...s.others].map(([k, o]) => ({ username: k, wind: !!o.avatar._wind, audio: !!o.avatar._audioListener, visible: o.avatar.root.visible, pos: o.avatar.root.position.toArray().map(r2),
          inScene: !!o.avatar.root.parent && o.avatar.root.parent === engine.game?.scene, anim: ANIM_NAME[o.anim], animsSeen: [...o.animsSeen].map(a => ANIM_NAME[a]), events: { ...o.events }, snaps: o.snaps, yaw: r2(o.avatar.root.rotation.y),
          talking: !!o.avatar.isTalking?.(), equipped: o.avatar.attached ? Object.values(o.avatar.attached).map(x => x.userData.cosmeticId) : [] })) };
    },
  };
}
