// Unit test: remote avatar despawn without relying on server presence (live Supabase can take 30 s+).
// node scripts/mp-liveness-test.mjs
globalThis.requestAnimationFrame = () => 0; globalThis.cancelAnimationFrame = () => {};
globalThis.document = { visibilityState: 'visible' };
await import('node:module').then(m => m.register('../tools/asset-stub-loader.mjs', import.meta.url));   // .ogg/.glb stubs (rebase onto main)
const { createMultiplayer, STALE_MS } = await import('../src/mp/multiplayer.js');
const { RealtimeClient } = await import('../src/net/realtime.js');
let T = 0; const now = () => T;
const results = []; const check = (n, ok, d = '') => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'} ${n}${ok ? '' : ' ' + d}`); };
let ch;
class FakeRT { channel() { return ch = { b: {}, p: [], sent: [], onPresence(f) { this.p.push(f); }, onBroadcast(e, f) { this.b[e] = f; }, async subscribe() {}, track() {}, send(e, x) { this.sent.push([e, x]); return true; }, async unsubscribe() {},
  presence(keys, joins = [], leaves = []) { const state = Object.fromEntries(keys.map(k => [k, [{}]])); this.p.forEach(f => f({ state, joins, leaves })); } }; } }
class FakeAvatar { constructor() { this.root = { userData: {}, visible: true, position: { set() {}, toArray: () => [0, 0, 0] }, rotation: {}, parent: null }; } applyLoadout() {} dispose() {} }
const scene = { add(r) { r.parent = this; }, remove(r) { r.parent = null; } };
const roster = [{ username: 'me' }, { username: 'a' }];
const remote = { signedIn: true, realtimeConfig: {}, mpJoin: async () => ({ ok: true, instance: 1, topic: 't', sendHz: 5, roster }), mpHeartbeat: async () => ({ ok: true, roster }), mpLeave: async () => {} };
const mp = createMultiplayer({ engine: { game: { scene }, running: false }, getRemote: () => remote, me: () => ({ username: 'me' }), AvatarClass: FakeAvatar, RealtimeImpl: FakeRT, now });
await mp.join('g');
ch.presence(['me', 'a'], ['me', 'a']);
let seq = 0; const state = () => ch.b.s({ u: 'a', s: ++seq, p: [1, 0, 1], r: 0, a: 0 });
state();
check('remote avatar spawns', mp.info.others.some(o => o.username === 'a'));
T += STALE_MS - 1000; mp._livenessTick(); state();
T += STALE_MS - 1000; mp._livenessTick();
check('keepalives keep it alive', mp.info.others.some(o => o.username === 'a'));
// hard network drop: a stops sending, presence never says leave
T += STALE_MS + 1; mp._livenessTick();
check(`silent peer despawned within ${STALE_MS} ms while still in presence`, !mp.info.others.some(o => o.username === 'a') && mp.info.present.includes('a'));
ch.presence(['me', 'a']);                                   // unrelated presence churn must not resurrect the ghost
check('ghost presence does not respawn it', !mp.info.others.some(o => o.username === 'a'));
state();
check('comes back on its next state broadcast', mp.info.others.some(o => o.username === 'a' && o.visible));
ch.b.l({ u: 'a' });
check('"bye" broadcast despawns immediately', !mp.info.others.some(o => o.username === 'a'));
ch.presence(['me', 'a'], ['a']);
check('fresh presence join respawns', mp.info.others.some(o => o.username === 'a'));
await mp.leave();
check('leave sends bye', ch.sent.some(([e, x]) => e === 'l' && x.u === 'me'));
// realtime.js: presence_state snapshot reports who vanished as leaves
const rc = new RealtimeClient('http://x', 'k', { WebSocketImpl: class {} });
const c = rc.channel('t'); let ev; c.onPresence(e => ev = e);
c._onMessage({ event: 'presence_state', payload: { a: { metas: [{}] }, b: { metas: [{}] } } });
c._onMessage({ event: 'presence_state', payload: { b: { metas: [{}] } } });
check('presence_state diffs previous keys into leaves', JSON.stringify(ev.leaves) === '["a"]', JSON.stringify(ev));
const f = results.filter(x => !x).length; console.log(`${results.length - f}/${results.length}`); process.exit(f ? 1 : 0);
