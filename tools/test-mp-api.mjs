// mp game API (docs/MULTIPLAYER_API.md) in node: in-process Realtime fake, 3 clients, host migration,
// snapshot for late joiners, onState immediate fire, JSON/size limits, events + rate limit, offline mode.
import assert from 'node:assert/strict';
globalThis.document ??= { visibilityState: 'visible' };
globalThis.requestAnimationFrame ??= () => 0; globalThis.cancelAnimationFrame ??= () => {};
await import('node:module').then(m => m.register('./asset-stub-loader.mjs', import.meta.url));   // .ogg/.glb imports (tornado hat audio) stubbed in node
const { createMultiplayer, plainJSON } = await import('../src/mp/multiplayer.js');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ---- fakes ----
const hub = new Map();                           // topic -> Set(channel)
class FakeRT {
  constructor() {} setAuth() {}
  channel(topic, { presenceKey }) {
    const ch = { topic, key: presenceKey, state: 'closed', b: new Map(), p: [], meta: null,
      onPresence(f) { this.p.push(f); return this; }, onBroadcast(e, f) { (this.b.get(e) || this.b.set(e, []).get(e)).push(f); return this; },
      async subscribe() { this.state = 'joined'; (hub.get(topic) || hub.set(topic, new Set()).get(topic)).add(this); },
      track(m) { this.meta = m; emitPresence(topic, [this.key], []); },
      send(e, payload) { if (this.state !== 'joined') return false; const copy = JSON.parse(JSON.stringify(payload));
        for (const o of hub.get(topic) || []) if (o !== this) setTimeout(() => (o.b.get(e) || []).forEach(f => f(copy)), 1); return true; },
      async unsubscribe() { this.state = 'closed'; hub.get(topic)?.delete(this); emitPresence(topic, [], [this.key]); } };
    return ch;
  }
}
function emitPresence(topic, joins, leaves) {
  const set = hub.get(topic) || new Set(); const state = Object.fromEntries([...set].filter(c => c.meta).map(c => [c.key, [c.meta]]));
  for (const c of set) c.p.forEach(f => f({ state, joins, leaves }));
}
const members = [];                              // server roster order (joined_at)
function makeRemote(username) {
  return { signedIn: true, accessToken: 't', realtimeConfig: { url: 'x', anonKey: 'y' },
    async mpJoin() { if (!members.some(m => m.username === username)) members.push({ username, displayName: username.toUpperCase(), joinedAt: new Date(Date.now() + members.length).toISOString(), equipped: username === 'ana' ? { hat: 'tornado_hat' } : {} });
      return { ok: true, instance: 1, topic: 'game:g:1', cap: 12, sendHz: 10, roster: members.slice(), serverNow: new Date(Date.now() + 5000).toISOString() }; },
    async mpHeartbeat() { return { ok: true, sendHz: 10, roster: members.slice(), serverNow: new Date(Date.now() + 5000).toISOString() }; },
    async mpLeave() { const i = members.findIndex(m => m.username === username); if (i >= 0) members.splice(i, 1); } };
}
class FakeAvatar { constructor() { this.root = { visible: false, position: { x: 0, y: 0, z: 0, set(x, y, z) { this.x = x; this.y = y; this.z = z; }, toArray() { return [this.x, this.y, this.z]; } }, rotation: { y: 0 }, userData: {}, parent: null }; this.attached = {}; } applyLoadout() {} setBodyType(t) { this.bodyType = t; this.bodyTypeCalls = (this.bodyTypeCalls || 0) + 1; } animate() {} dispose() {} }
const busHandlers = {}; const bus = { on: (e, f) => (busHandlers[e] ||= []).push(f), emit: (e, x) => (busHandlers[e] || []).forEach(f => f(x)) };
function client(username) {
  const scene = { add(o) { o.parent = scene; }, remove() {} };
  const engine = { game: { scene }, running: true, player: { pos: { x: 0, y: 0, z: 0 }, vel: { x: 0, y: 0, z: 0 }, onGround: true, mods: {} }, avatar: { root: { rotation: { y: 0 } } } };
  const remote = makeRemote(username);
  const mp = createMultiplayer({ engine, getRemote: () => remote, me: () => ({ username, displayName: username.toUpperCase() }), AvatarClass: FakeAvatar, RealtimeImpl: FakeRT, bus });
  return { mp, engine, username };
}

// ---- offline: single-player ----
const solo = createMultiplayer({ engine: { game: null }, getRemote: () => null, me: () => null, AvatarClass: FakeAvatar, RealtimeImpl: FakeRT, bus, localName: () => 'Guest' });
assert.equal(solo.isHost(), true); assert.equal(solo.localId(), 'local');
assert.deepEqual(solo.players().map(p => [p.id, p.name, p.isLocal, p.isHost]), [['local', 'Guest', true, true]]);
assert.ok(Math.abs(solo.now() - Date.now()) < 50);
assert.deepEqual(solo.setState('round', { n: 1 }), { ok: true });
let got = null; solo.onState('round', (v, m) => { got = [v, m.from]; });
assert.deepEqual(got, [{ n: 1 }, 'local']);                                       // fires immediately with the snapshot
assert.equal(solo.setState('bad key!', 1).reason, 'bad_key');
assert.equal(solo.setState('f', { fn() {} }).reason, 'not_json');
assert.equal(solo.setState('d', new Date()).reason, 'not_json');
assert.equal(solo.setState('n', NaN).reason, 'not_json');
assert.equal(solo.setState('big', 'x'.repeat(4100)).reason, 'too_large');
const evs = []; solo.onEvent('boom', (d, m) => evs.push([d, m.from]));
assert.equal(solo.sendEvent('boom', { a: 1 }).ok, true); await sleep(1);
assert.deepEqual(evs, [[{ a: 1 }, 'local']]);                                      // local echo
assert.equal(solo.sendEvent('boom', 'x'.repeat(1100)).reason, 'too_large');
let limited = 0; for (let i = 0; i < 20; i++) if (solo.sendEvent('spam').reason === 'rate_limited') limited++;
assert.ok(limited >= 9, 'rate limit ' + limited);
const v = { a: [1] }; solo.setState('copy', v); v.a.push(2); let cv; solo.onState('copy', x => { cv = x; }); assert.deepEqual(cv, { a: [1] });
assert.equal(plainJSON({ a: undefined }).ok, false);

// ---- 3 clients ----
const A = client('ana'), B = client('ben');
const hostEvents = { ana: [], ben: [], cat: [] };
A.mp.onHostChanged(h => hostEvents.ana.push(h.hostId)); B.mp.onHostChanged(h => hostEvents.ben.push(h.hostId));
await A.mp.join('g'); await B.mp.join('g'); await sleep(2700);
assert.equal(A.mp.isHost(), true); assert.equal(B.mp.isHost(), false);
assert.deepEqual(B.mp.players().map(p => [p.id, p.name, p.isLocal, p.isHost]), [['ana', 'ANA', false, true], ['ben', 'BEN', true, false]]);
assert.equal(B.mp.localId(), 'ben');
// body type rides movement packets: remote avatar follows, unknown ids coerce to classic
assert.equal(B.mp._avatarOf('ana')?.bodyType, 'classic', 'default classic body for remote');
A.engine.avatar.bodyType = 'tall'; await sleep(250);
assert.equal(B.mp._avatarOf('ana').bodyType, 'tall', 'remote picks up tall');
A.engine.avatar.bodyType = 'stout'; await sleep(250);
assert.equal(B.mp._avatarOf('ana').bodyType, 'stout', 'remote picks up change to stout');
const calls = B.mp._avatarOf('ana').bodyTypeCalls; await sleep(250);
assert.equal(B.mp._avatarOf('ana').bodyTypeCalls, calls, 'no re-apply when unchanged');
A.engine.avatar.bodyType = 'giraffe'; await sleep(250);
assert.equal(B.mp._avatarOf('ana').bodyType, 'classic', 'unknown id -> classic');
A.engine.avatar.bodyType = undefined;
assert.ok(Math.abs(B.mp.now() - (Date.now() + 5000)) < 100, 'server clock offset');
assert.equal(B.mp.setState('round', 1).reason, 'not_host');
const seenB = []; B.mp.onState('round', (val, m) => seenB.push([val, m.from]));
A.mp.setState('round', { n: 1, startsAt: A.mp.now() + 5000, seed: 42 });
A.mp.setState('round', { n: 2, startsAt: A.mp.now() + 5000, seed: 43 });        // coalesced: latest wins
await sleep(300);
assert.deepEqual(seenB.at(-1), [{ n: 2, startsAt: seenB.at(-1)[0].startsAt, seed: 43 }, 'ana']);
assert.ok(seenB.length <= 2);
// events both ways
const evA = [], evB = []; A.mp.onEvent('eliminated', (d, m) => evA.push(m.from)); B.mp.onEvent('eliminated', (d, m) => evB.push(m.from));
B.mp.sendEvent('eliminated', { by: 'tornado' }); await sleep(20);
assert.deepEqual(evA, ['ben']); assert.deepEqual(evB, ['ben']);
// late joiner gets the snapshot; onState fires immediately for late subscribers once it is there
const C = client('cat'); C.mp.onHostChanged(h => hostEvents.cat.push(h.hostId));
await C.mp.join('g'); await sleep(3000);
let lateVal = null; C.mp.onState('round', (val) => { lateVal = val; });
assert.equal(lateVal?.n, 2, 'late joiner snapshot');
assert.equal(C.mp.players().length, 3);
// nearby(radius): remote players only, nearest first, {id, name, position}
assert.deepEqual(solo.nearby(50), []);
A.engine.player.pos = { x: 3, y: 0, z: 4 }; B.engine.player.pos = { x: 30, y: 0, z: 0 }; C.engine.player.pos = { x: 0, y: 0, z: 0 };
await sleep(1500);
const nb = C.mp.nearby(10);
assert.deepEqual(nb.map(p => [p.id, p.name]), [['ana', 'ANA']], 'nearby(10) ' + JSON.stringify(nb));
assert.deepEqual(nb[0].position, { x: 3, y: 0, z: 4 });
assert.equal(nb[0].hat, 'tornado_hat');                                             // from the roster loadout
assert.deepEqual(C.mp.nearby(100).map(p => [p.id, p.hat]), [['ana', 'tornado_hat'], ['ben', null]]);
assert.deepEqual(C.mp.nearby(-1), []);
// a non-host can't forge state
const forged = []; A.mp.onState('round', (val) => forged.push(val));
C.engine; for (const ch of hub.get('game:g:1')) if (ch.key === 'cat') ch.send('st', { u: 'cat', kv: { round: { v: { n: 99 }, ver: Date.now() * 2, at: 0 } } });
await sleep(20); assert.ok(!forged.some(x => x.n === 99)); assert.ok(C.mp.info.stats.stateRecv >= 1);
// host migration: ana leaves -> ben (next earliest) becomes host for everyone, keeps the state
await A.mp.leave(); await sleep(20);
assert.equal(B.mp.isHost(), true); assert.equal(C.mp.isHost(), false); assert.equal(C.mp.players()[0].id, 'ben');
assert.equal(hostEvents.ben.at(-1), 'ben'); assert.equal(hostEvents.cat.at(-1), 'ben');
let migrated; B.mp.onState('round', (val) => { migrated = val; }); assert.equal(migrated.n, 2);
B.mp.setState('round', { n: 3 }); await sleep(300);
let cNow; C.mp.onState('round', (val) => { cNow = val; }); assert.equal(cNow.n, 3);
// subscriptions die with the game
let after = 0; C.mp.onState('round', () => after++); after = 0;
bus.emit('game:unloaded'); B.mp.setState('round', { n: 4 }); await sleep(300);
assert.equal(after, 0);
await B.mp.leave(); await C.mp.leave();
assert.equal(C.mp.isHost(), true);                                                   // alone again
console.log('mp game API: all checks passed');
