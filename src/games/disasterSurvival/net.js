// Multiplayer adapter for NDS round flow. ONE file to change when the Publisher's final mp API names land
// (docs/MULTIPLAYER_API.md on feature/multiplayer). Uses window.iceberg.mp (or ctx.mp) when present, feature-detecting
// each method; otherwise a local single-player shim that is always host. Same interface either way:
//   Final Publisher names: isHost, onHostChanged, setState (plain JSON <= 4 KB, host only), onState (fires immediately with
//   the current snapshot), sendEvent, onEvent, players() -> [{id, name}] incl. local, localId(), now() (server-synced).
//   Adapter extras: selfId (= localId()), online, dispose()
// Quests, Birg Bucks and survival pay stay per player and local; remote players never trigger local rewards.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

function localShim(selfId) {
  const state = new Map(), sl = new Map(), el = new Map(), hl = new Set();
  const fire = (m, k, v) => { for (const cb of m.get(k) || []) { try { cb(v); } catch (e) { console.warn(e); } } };
  const on = (m, k, cb) => { if (!m.has(k)) m.set(k, new Set()); m.get(k).add(cb); return () => m.get(k)?.delete(cb); };
  return {
    online: false, selfId,
    isHost: () => true, onHostChanged: (cb) => { hl.add(cb); return () => hl.delete(cb); },
    setState(k, v) { state.set(k, v); fire(sl, k, v); },
    onState(k, cb) { const off = on(sl, k, cb); if (state.has(k)) cb(state.get(k)); return off; },
    sendEvent(n, p) { fire(el, n, { ...p, from: selfId }); },
    onEvent: (n, cb) => on(el, n, cb),
    players: () => [{ id: selfId, name: 'You' }], localId: () => selfId,
    now: () => Date.now(),
  };
}

export function createNet(ctx = {}) {
  const mp = ctx.mp || (typeof window !== 'undefined' && window.iceberg?.mp) || null;
  const selfId = String((typeof mp?.localId === 'function' ? mp.localId() : null) ?? ctx.username ?? 'you');
  const shim = localShim(selfId);
  const has = (k) => mp && typeof mp[k] === 'function';
  if (!mp || !has('setState') || !has('onState')) return shim; // no host-authoritative API yet: solo, always host
  const offs = [];
  const keep = (off) => { if (typeof off === 'function') offs.push(off); return off; };
  return {
    online: true, selfId,
    isHost: () => (has('isHost') ? !!mp.isHost() : true),
    onHostChanged: (cb) => (has('onHostChanged') ? keep(mp.onHostChanged(cb)) : () => {}),
    setState: (k, v) => mp.setState(k, v),
    onState: (k, cb) => keep(mp.onState(k, cb)),
    sendEvent: (n, p) => (has('sendEvent') ? mp.sendEvent(n, { ...p, from: selfId }) : shim.sendEvent(n, p)),
    onEvent: (n, cb) => (has('onEvent') ? keep(mp.onEvent(n, cb)) : shim.onEvent(n, cb)),
    players: () => (has('players') ? mp.players() : shim.players()),
    localId: () => selfId,
    now: () => (has('now') ? mp.now() : Date.now()),
    dispose: () => offs.splice(0).forEach(f => { try { f(); } catch { /* */ } }),
  };
}
