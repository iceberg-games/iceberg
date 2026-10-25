// Minimal, dependency-free client for Supabase Realtime (Phoenix channels, vsn 1.0.0):
// broadcast + presence on private channels (Realtime Authorization via the user's JWT).
// Reconnects with backoff and rejoins. Heartbeats every 15 s with a reply check: a missed reply = dead socket
// (silent network drop, no close event) -> close it, which triggers the normal reconnect + rejoin.
const HEARTBEAT_MS = 15000;
export class RealtimeClient {
  constructor(supabaseUrl, anonKey, { getToken = () => null, WebSocketImpl = globalThis.WebSocket } = {}) {
    this.url = `${supabaseUrl.replace(/^http/, 'ws').replace(/\/+$/, '')}/realtime/v1/websocket?apikey=${encodeURIComponent(anonKey)}&vsn=1.0.0`;
    this.anonKey = anonKey; this.getToken = getToken; this.WS = WebSocketImpl;
    this.hbPending = null;
    if (typeof globalThis.addEventListener === 'function') globalThis.addEventListener('online', () => this.probe());
    this.ws = null; this.ref = 0; this.channels = new Map(); this.pending = new Map(); this.backoff = 500; this.closed = false; this.hb = null;
  }
  _ref() { return String(++this.ref); }
  connect() {
    if (this.ws && this.ws.readyState <= 1) return this._open;
    this.closed = false;
    this._open = new Promise((ok, bad) => {
      const ws = this.ws = new this.WS(this.url);
      ws.onopen = () => { this.backoff = 500; this.hbPending = null; ok(); clearInterval(this.hb); this.hb = setInterval(() => this._beat(), HEARTBEAT_MS); for (const ch of this.channels.values()) if (ch.state !== 'closed') ch._rejoin(); };
      ws.onmessage = (e) => { let m; try { m = JSON.parse(e.data); } catch { return; } this._onMessage(m); };
      ws.onerror = () => bad(new Error('realtime connect failed'));
      ws.onclose = () => {
        clearInterval(this.hb);
        for (const ch of this.channels.values()) if (ch.state === 'joined') ch.state = 'errored';
        for (const [, p] of this.pending) p.bad(new Error('socket closed')); this.pending.clear();
        if (!this.closed) setTimeout(() => this.connect().catch(() => {}), this.backoff = Math.min(this.backoff * 2, 15000));
      };
    });
    return this._open;
  }
  /** Heartbeat with reply check: if the previous one was never answered, the socket is dead. */
  _beat() {
    const ws = this.ws; if (!ws || ws.readyState !== 1) return;
    if (this.hbPending) { this.hbPending = null; try { ws.close(); } catch { /* */ } return; }   // onclose -> reconnect
    this.hbPending = this._ref(); this._push({ topic: 'phoenix', event: 'heartbeat', payload: {}, ref: this.hbPending });
  }
  /** Network came back: check the socket now (zombie sockets look open) instead of waiting for the next beat. */
  probe(ms = 4000) {
    if (this.closed) return;
    if (!this.ws || this.ws.readyState > 1) { this.backoff = 500; this.connect().catch(() => {}); return; }
    const ws = this.ws; this.hbPending = null; this._beat();
    const ref = this.hbPending; setTimeout(() => { if (this.ws === ws && this.hbPending === ref) { this.hbPending = null; try { ws.close(); } catch { /* */ } } }, ms);
  }
  disconnect() { this.closed = true; clearInterval(this.hb); try { this.ws?.close(); } catch { /* */ } this.ws = null; }
  _push(msg, wantReply = false) {
    const ref = msg.ref || this._ref(); msg.ref = ref;
    if (!this.ws || this.ws.readyState !== 1) return wantReply ? Promise.reject(new Error('not connected')) : null;
    this.ws.send(JSON.stringify(msg));
    if (!wantReply) return null;
    return new Promise((ok, bad) => { this.pending.set(ref, { ok, bad }); setTimeout(() => { if (this.pending.delete(ref)) bad(new Error('timeout')); }, 10000); });
  }
  _onMessage(m) {
    if (m.topic === 'phoenix' && m.event === 'phx_reply') { if (m.ref === this.hbPending) this.hbPending = null; return; }
    if (m.event === 'phx_reply' && this.pending.has(m.ref)) { const p = this.pending.get(m.ref); this.pending.delete(m.ref); m.payload?.status === 'ok' ? p.ok(m.payload.response) : p.bad(Object.assign(new Error(m.payload?.response?.reason || 'error'), { response: m.payload?.response })); return; }
    const ch = this.channels.get(m.topic); if (ch) ch._onMessage(m);
  }
  /** Tell joined channels about a refreshed JWT. */
  setAuth(token) { for (const ch of this.channels.values()) if (ch.state === 'joined') this._push({ topic: ch.topic, event: 'access_token', payload: { access_token: token }, join_ref: ch.joinRef }); }
  channel(subTopic, { presenceKey = '', private: priv = true, self = false } = {}) {
    const ch = new Channel(this, 'realtime:' + subTopic, { config: { broadcast: { self, ack: false }, presence: { key: presenceKey, enabled: true }, private: priv, postgres_changes: [] } });
    this.channels.set(ch.topic, ch); return ch;
  }
}

class Channel {
  constructor(client, topic, params) {
    this.client = client; this.topic = topic; this.params = params; this.state = 'closed'; this.joinRef = null;
    this.handlers = { broadcast: new Map(), presence: [], error: [] }; this.presence = {}; this.meta = null;
  }
  onBroadcast(event, fn) { (this.handlers.broadcast.get(event) || this.handlers.broadcast.set(event, []).get(event)).push(fn); return this; }
  /** fn({ state, joins, leaves }) where state = { key: [meta, ...] } */
  onPresence(fn) { this.handlers.presence.push(fn); return this; }
  onError(fn) { this.handlers.error.push(fn); return this; }
  async subscribe() {
    await this.client.connect();
    this.joinRef = this.client._ref();
    const res = await this.client._push({ topic: this.topic, event: 'phx_join', payload: { config: this.params.config, access_token: this.client.getToken() || this.client.anonKey }, ref: this.joinRef, join_ref: this.joinRef }, true);
    this.state = 'joined';
    if (this.meta) this.track(this.meta);
    return res;
  }
  _rejoin() { this.subscribe().catch(e => this.handlers.error.forEach(f => f(e))); }
  track(meta) { this.meta = meta; if (this.state === 'joined') this.client._push({ topic: this.topic, event: 'presence', payload: { type: 'presence', event: 'track', payload: meta }, join_ref: this.joinRef }); }
  send(event, payload) {
    if (this.state !== 'joined') return false;
    this.client._push({ topic: this.topic, event: 'broadcast', payload: { type: 'broadcast', event, payload }, join_ref: this.joinRef });
    return true;
  }
  async unsubscribe() {
    const was = this.state; this.state = 'closed'; this.client.channels.delete(this.topic);
    if (was === 'joined') { try { await this.client._push({ topic: this.topic, event: 'phx_leave', payload: {}, join_ref: this.joinRef }, true); } catch { /* */ } }
  }
  _emitPresence(joins, leaves) { const state = Object.fromEntries(Object.entries(this.presence).map(([k, v]) => [k, v])); this.handlers.presence.forEach(f => { try { f({ state, joins, leaves }); } catch (e) { console.warn(e); } }); }
  _onMessage(m) {
    if (m.join_ref && this.joinRef && m.join_ref !== this.joinRef && m.event !== 'broadcast') return;   // stale join
    if (m.event === 'broadcast') { const p = m.payload || {}; (this.handlers.broadcast.get(p.event) || []).forEach(f => { try { f(p.payload); } catch (e) { console.warn(e); } }); return; }
    if (m.event === 'presence_state') {
      this.presence = {}; for (const [k, v] of Object.entries(m.payload || {})) this.presence[k] = (v.metas || []);
      this._emitPresence(Object.keys(this.presence), []); return;
    }
    if (m.event === 'presence_diff') {
      const { joins = {}, leaves = {} } = m.payload || {};
      const left = [];
      for (const [k, v] of Object.entries(leaves)) {
        const refs = new Set((v.metas || []).map(x => x.phx_ref));
        this.presence[k] = (this.presence[k] || []).filter(x => !refs.has(x.phx_ref));
        if (!this.presence[k].length) { delete this.presence[k]; left.push(k); }
      }
      for (const [k, v] of Object.entries(joins)) this.presence[k] = [...(this.presence[k] || []), ...(v.metas || [])];
      this._emitPresence(Object.keys(joins), left.filter(k => !this.presence[k])); return;
    }
    if (m.event === 'phx_error' || m.event === 'phx_close') { this.state = 'errored'; this.handlers.error.forEach(f => f(new Error(m.event))); }
  }
}
