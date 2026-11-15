// Lantern Hollow multiplayer adapter (pattern from disasterSurvival/net.js). Uses the platform mp API
// (engine.mp / window.iceberg.mp; NOT passed in ctx) with feature detection, else a local shim that is always host.
// Architecture (brief §9): host-authoritative enemies per occupied area (state keys en.<area>, boss.<area>, dun.<area>, party),
// client-authoritative own HP, personal loot rolled from host 'slain' seeds. Never grants Birg Bucks.
function localShim(selfId) {
  const state = new Map(), sl = new Map(), el = new Map(), hl = new Set();
  const fire = (m, k, ...a) => { for (const cb of m.get(k) || []) { try { cb(...a); } catch (e) { console.warn(e); } } };
  const on = (m, k, cb) => { if (!m.has(k)) m.set(k, new Set()); m.get(k).add(cb); return () => m.get(k)?.delete(cb); };
  return {
    online: false, selfId,
    isHost: () => true, onHostChanged: (cb) => { hl.add(cb); return () => hl.delete(cb); },
    setState(k, v) { const c = JSON.parse(JSON.stringify(v)); state.set(k, c); fire(sl, k, c, { key: k, from: selfId, at: Date.now() }); return { ok: true }; },
    onState(k, cb) { const off = on(sl, k, cb); if (state.has(k)) cb(state.get(k), { key: k, from: selfId, at: Date.now() }); return off; },
    sendEvent(n, p) { fire(el, n, p, { name: n, from: selfId, at: Date.now() }); return { ok: true }; },
    onEvent: (n, cb) => on(el, n, cb),
    players: () => [{ id: selfId, name: 'You', isLocal: true, isHost: true }], nearby: () => [], localId: () => selfId,
    now: () => Date.now(), onPlayersChanged: () => () => {}, dispose() {},
  };
}

export function createNet(engine) {
  const mp = engine?.mp || (typeof window !== 'undefined' && window.iceberg?.mp) || null;
  const has = (k) => mp && typeof mp[k] === 'function';
  const selfId = String((has('localId') ? mp.localId() : null) ?? 'local');
  const shim = localShim(selfId);
  if (!mp || !has('setState') || !has('onState')) return shim;
  const offs = []; const keep = (off) => { if (typeof off === 'function') offs.push(off); return off; };
  return {
    get online() { return has('connected') ? !!mp.connected() : true; }, selfId,
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

/** Pack enemies for a state snapshot: [id,type,x*10,z*10,hp%,st,atk,atkAt-base,facing*10]. ~30 B each. */
export function packEnemies(list, base) {
  return { b: base, e: list.map(e => [e.id, e.type, Math.round(e.x * 10), Math.round(e.z * 10), Math.round(e.hp / e.maxHp * 100), e.st | 0, e.atk | 0, e.atkAt ? Math.round(e.atkAt - base) : 0, Math.round(e.facing * 10)]) };
}
export function unpackEnemies(s) {
  if (!s || !Array.isArray(s.e)) return [];
  return s.e.map(([id, type, x, z, hp, st, atk, at, f]) => ({ id, type, x: x / 10, z: z / 10, hpPct: hp, st, atk, atkAt: at ? s.b + at : 0, facing: f / 10 }));
}
