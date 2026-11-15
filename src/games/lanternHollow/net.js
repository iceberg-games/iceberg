// Lantern Hollow multiplayer adapter (pattern from disasterSurvival/net.js). Uses the platform mp API
// (engine.mp / window.iceberg.mp; NOT passed in ctx) with feature detection, else a local shim that is always host.
// Architecture (brief §9): host-authoritative enemies per occupied area (state keys en.<area>, boss.<area>, dun.<area>, party),
// client-authoritative own HP, personal loot rolled from host 'slain' seeds. Never grants Birg Bucks.
// QA transports (test builds only, ?lhtest=1): local shim "fake allies" (solo revive tests) and a BroadcastChannel
// two-tab transport (?lhmp=<room>&lhid=<name>) that mimics the platform API (host = earliest joined) for headless 2-client runs.
function bus() {
  const m = new Map();
  return { on(k, cb) { if (!m.has(k)) m.set(k, new Set()); m.get(k).add(cb); return () => m.get(k)?.delete(cb); },
    fire(k, ...a) { for (const cb of [...(m.get(k) || [])]) { try { cb(...a); } catch (e) { console.warn('[lh net]', e); } } } };
}
function localShim(selfId) {
  const state = new Map(), sb = bus(), eb = bus(), hb = bus(), pb = bus(), fakes = [];
  return {
    online: false, selfId, transport: 'local', fakes,
    isHost: () => true, onHostChanged: (cb) => hb.on('h', cb),
    setState(k, v) { const c = JSON.parse(JSON.stringify(v)); state.set(k, c); const meta = { key: k, from: selfId, at: Date.now() }; sb.fire(k, c, meta); sb.fire('*', c, meta); return { ok: true }; },
    onState(k, cb) { const off = sb.on(k, cb); if (k !== '*' && state.has(k)) cb(state.get(k), { key: k, from: selfId, at: Date.now() }); return off; },
    sendEvent(n, p) { const c = JSON.parse(JSON.stringify(p ?? null)); queueMicrotask(() => eb.fire(n, c, { name: n, from: selfId, at: Date.now() })); return { ok: true }; },
    onEvent: (n, cb) => eb.on(n, cb),
    players: () => [{ id: selfId, name: 'You', isLocal: true, isHost: true }, ...fakes.map(f => ({ id: f.id, name: f.name, isLocal: false, isHost: false }))],
    nearby: (r = 1e9) => fakes.map(f => ({ id: f.id, name: f.name, position: { ...f.position }, hat: null })),
    localId: () => selfId, now: () => Date.now(),
    onPlayersChanged: (cb) => pb.on('p', cb), connected: () => false,
    /** QA: a fake remote player (solo revive tests). Its events go through the same handlers as real ones. */
    addFake(f) { fakes.push(f); pb.fire('p'); return f; }, fakeEvent(id, n, p) { eb.fire(n, JSON.parse(JSON.stringify(p)), { name: n, from: id, at: Date.now() }); },
    dispose() {},
  };
}
function broadcastShim(room, selfId, getPos) {
  const ch = new BroadcastChannel(`lh-mp-${room}`), state = new Map(), sb = bus(), eb = bus(), hb = bus(), pb = bus();
  const joined = Date.now() + Math.random(), members = new Map([[selfId, { id: selfId, joined, last: Date.now(), pos: null }]]);
  let host = selfId;
  const recompute = () => { const list = [...members.values()].sort((a, b) => a.joined - b.joined || (a.id < b.id ? -1 : 1)); const h = list[0]?.id; if (h !== host) { host = h; hb.fire('h', { hostId: h, isHost: h === selfId }); } };
  const post = (m) => { try { ch.postMessage({ ...m, from: selfId }); } catch { /* */ } };
  const hello = () => { const p = getPos?.(); members.get(selfId).pos = p; post({ t: 'hi', joined, pos: p }); };
  ch.onmessage = ({ data: m }) => {
    if (!m || m.from === selfId) return;
    if (m.t === 'hi') { const known = members.has(m.from); members.set(m.from, { id: m.from, joined: m.joined, last: Date.now(), pos: m.pos }); if (!known) { recompute(); pb.fire('p'); if (host === selfId) post({ t: 'snap', kv: Object.fromEntries(state) }); hello(); } }
    else if (m.t === 'st' && m.from === host) { state.set(m.k, m.v); const meta = { key: m.k, from: m.from, at: Date.now() }; sb.fire(m.k, m.v, meta); sb.fire('*', m.v, meta); }
    else if (m.t === 'snap' && m.from === host) for (const [k, v] of Object.entries(m.kv || {})) { state.set(k, v); sb.fire(k, v, { key: k, from: m.from, at: Date.now() }); }
    else if (m.t === 'ev') eb.fire(m.n, m.p, { name: m.n, from: m.from, at: Date.now() });
    else if (m.t === 'bye') { members.delete(m.from); recompute(); pb.fire('p'); }
  };
  const iv = setInterval(() => { hello(); const now = Date.now(); let ch2 = false; for (const [id, mm] of members) if (id !== selfId && now - mm.last > 3500) { members.delete(id); ch2 = true; } if (ch2) { recompute(); pb.fire('p'); } }, 200);
  hello();
  return {
    online: true, selfId, transport: 'broadcast',
    isHost: () => host === selfId, onHostChanged: (cb) => hb.on('h', cb),
    setState(k, v) { if (host !== selfId) return { ok: false, reason: 'not_host' }; const c = JSON.parse(JSON.stringify(v)); if (JSON.stringify(c).length > 4096) { console.warn('[lh net] too_large', k); return { ok: false, reason: 'too_large' }; }
      state.set(k, c); post({ t: 'st', k, v: c }); const meta = { key: k, from: selfId, at: Date.now() }; sb.fire(k, c, meta); sb.fire('*', c, meta); return { ok: true }; },
    onState(k, cb) { const off = sb.on(k, cb); if (k !== '*' && state.has(k)) cb(state.get(k), { key: k }); return off; },
    sendEvent(n, p) { const c = JSON.parse(JSON.stringify(p ?? null)); post({ t: 'ev', n, p: c }); queueMicrotask(() => eb.fire(n, c, { name: n, from: selfId, at: Date.now() })); return { ok: true }; },
    onEvent: (n, cb) => eb.on(n, cb),
    players: () => [...members.values()].sort((a, b) => a.joined - b.joined).map(m => ({ id: m.id, name: m.id, isLocal: m.id === selfId, isHost: m.id === host })),
    nearby: (r = 1e9) => [...members.values()].filter(m => m.id !== selfId && m.pos).map(m => ({ id: m.id, name: m.id, position: m.pos, hat: null })),
    localId: () => selfId, now: () => Date.now(), onPlayersChanged: (cb) => pb.on('p', cb), connected: () => true,
    dispose() { post({ t: 'bye' }); clearInterval(iv); ch.close(); },
  };
}

export function createNet(engine, { testMode = false } = {}) {
  const q = new URLSearchParams(typeof location !== 'undefined' ? location.search : '');
  if (testMode && q.get('lhmp')) return broadcastShim(q.get('lhmp'), q.get('lhid') || `p${(Math.random() * 1e4) | 0}`, () => { const p = engine.player.pos; return { x: +p.x.toFixed(2), y: +p.y.toFixed(2), z: +p.z.toFixed(2) }; });
  const mp = engine?.mp || (typeof window !== 'undefined' && window.iceberg?.mp) || null;
  const has = (k) => mp && typeof mp[k] === 'function';
  const selfId = String((has('localId') ? mp.localId() : null) ?? 'local');
  const shim = localShim(selfId);
  // NB: the platform joins the instance AFTER create() (main.js play()), so never gate on connected() here.
  // QA runs (?lhtest=1 without ?lhnet=1) use the local shim so fake allies can be injected.
  if (!mp || !has('setState') || !has('onState') || (testMode && !q.get('lhnet'))) return shim;
  const offs = []; const keep = (off) => { if (typeof off === 'function') offs.push(off); return off; };
  return {
    get online() { return has('connected') ? !!mp.connected() : true; }, selfId, transport: 'platform',
    isHost: () => (has('isHost') ? !!mp.isHost() : true),
    onHostChanged: (cb) => (has('onHostChanged') ? keep(mp.onHostChanged(cb)) : () => {}),
    setState: (k, v) => mp.setState(k, v),
    onState: (k, cb) => keep(mp.onState(k, cb)),
    sendEvent: (n, p) => (has('sendEvent') ? mp.sendEvent(n, p) : shim.sendEvent(n, p)),
    onEvent: (n, cb) => (has('onEvent') ? keep(mp.onEvent(n, cb)) : shim.onEvent(n, cb)),
    players: () => (has('players') ? mp.players() : shim.players()),
    nearby: (r) => (has('nearby') ? mp.nearby(r) : []),
    onPlayersChanged: (cb) => (has('onPlayersChanged') ? keep(mp.onPlayersChanged(cb)) : () => {}),
    localId: () => selfId,
    now: () => (has('now') ? mp.now() : Date.now()),
    dispose: () => offs.splice(0).forEach(f => { try { f(); } catch { /* */ } }),
  };
}
