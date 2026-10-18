// Local stand-in for Supabase Realtime (Phoenix channels over WebSocket, vsn 1.0.0): broadcast,
// presence, private channels with Realtime Authorization evaluated against the REAL RLS policies on
// realtime.messages (same check Realtime does on join). STUB: one node process, no clustering, no replay.
// Counts every WebSocket event sent/delivered (that's what Supabase's per-second quota counts).
import { createHash } from 'node:crypto';
import { canUseTopic } from './harness.mjs';

const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

function frame(str) {
  const data = Buffer.from(str); const n = data.length;
  const head = n < 126 ? Buffer.from([0x81, n]) : n < 65536 ? Buffer.from([0x81, 126, n >> 8, n & 255]) : (() => { const b = Buffer.alloc(10); b[0] = 0x81; b[1] = 127; b.writeBigUInt64BE(BigInt(n), 2); return b; })();
  return Buffer.concat([head, data]);
}

export function attachRealtime(server, { db, uidForToken, anonKey }) {
  const topics = new Map();   // topic -> Set(member)  member = { sock, joinRef, key, meta, self, uid }
  const stats = { events: 0, broadcasts: 0, deliveries: 0, presence: 0, perSecond: [], joinsRejected: 0, startedAt: Date.now() };
  let bucket = { t: Math.floor(Date.now() / 1000), n: 0 };
  const count = (n = 1) => { const t = Math.floor(Date.now() / 1000); if (t !== bucket.t) { stats.perSecond.push(bucket); if (stats.perSecond.length > 600) stats.perSecond.shift(); bucket = { t, n: 0 }; } bucket.n += n; stats.events += n; };

  server.on('upgrade', (req, sock) => {
    const url = new URL(req.url, 'http://x');
    if (url.pathname !== '/realtime/v1/websocket' || url.searchParams.get('apikey') !== anonKey) { sock.end('HTTP/1.1 401 Unauthorized\r\n\r\n'); return; }
    const accept = createHash('sha1').update(req.headers['sec-websocket-key'] + GUID).digest('base64');
    sock.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`);
    const conn = { sock, joined: new Map(), token: null, alive: true };   // joined: topic -> member
    const out = (msg) => { if (!conn.alive) return; count(); try { sock.write(frame(JSON.stringify(msg))); } catch { /* closed */ } };
    conn.out = out;
    let buf = Buffer.alloc(0);
    sock.on('data', (chunk) => {
      buf = Buffer.concat([buf, chunk]);
      while (buf.length >= 2) {
        const op = buf[0] & 15, masked = buf[1] & 128; let len = buf[1] & 127, off = 2;
        if (len === 126) { if (buf.length < 4) return; len = buf.readUInt16BE(2); off = 4; }
        else if (len === 127) { if (buf.length < 10) return; len = Number(buf.readBigUInt64BE(2)); off = 10; }
        const mask = masked ? buf.subarray(off, off + 4) : null; if (masked) off += 4;
        if (buf.length < off + len) return;
        const data = Buffer.from(buf.subarray(off, off + len)); buf = buf.subarray(off + len);
        if (mask) for (let i = 0; i < data.length; i++) data[i] ^= mask[i & 3];
        if (op === 8) { close(); return; }
        if (op === 9) { sock.write(Buffer.concat([Buffer.from([0x8a, data.length]), data])); continue; }
        if (op === 1) { count(); let m; try { m = JSON.parse(data.toString()); } catch { continue; } handle(conn, m).catch(e => console.warn('[realtime-stub]', e)); }
      }
    });
    const close = () => { if (!conn.alive) return; conn.alive = false; for (const t of [...conn.joined.keys()]) leave(conn, t); try { sock.end(); } catch { /* */ } };
    sock.on('close', close); sock.on('error', close);
  });

  const presenceState = (topic) => {
    const st = {};
    for (const m of topics.get(topic) || []) if (m.meta) (st[m.key] ||= { metas: [] }).metas.push({ phx_ref: m.ref, ...m.meta });
    return st;
  };
  const fanout = (topic, msg, except = null) => { for (const m of topics.get(topic) || []) if (m !== except) { stats.deliveries++; m.conn.out({ ...msg, topic: 'realtime:' + topic, join_ref: m.joinRef }); } };

  function leave(conn, topic) {
    const m = conn.joined.get(topic); if (!m) return;
    conn.joined.delete(topic); topics.get(topic)?.delete(m);
    if (m.meta) { stats.presence++; fanout(topic, { event: 'presence_diff', payload: { joins: {}, leaves: { [m.key]: { metas: [{ phx_ref: m.ref, ...m.meta }] } } }, ref: null }); }
    if (!topics.get(topic)?.size) topics.delete(topic);
  }

  async function handle(conn, msg) {
    const { topic: full, event, payload, ref, join_ref } = msg;
    const reply = (status, response = {}) => conn.out({ topic: full, event: 'phx_reply', payload: { status, response }, ref, join_ref });
    if (full === 'phoenix' && event === 'heartbeat') return reply('ok');
    const topic = String(full || '').replace(/^realtime:/, '');
    if (event === 'phx_join') {
      const cfg = payload?.config || {}; const token = payload?.access_token || conn.token;
      conn.token = token;
      const uid = token && token !== anonKey ? uidForToken(token) : null;
      if (cfg.private) {
        const okRead = await canUseTopic(db, uid, topic, 'broadcast'), okPres = await canUseTopic(db, uid, topic, 'presence');
        if (!okRead || !okPres) { stats.joinsRejected++; return reply('error', { reason: `Unauthorized: You do not have permissions to read from this Channel topic: ${topic}` }); }
      }
      if (conn.joined.has(topic)) leave(conn, topic);
      const m = { conn, joinRef: join_ref, key: cfg.presence?.key || String(Math.random()).slice(2), meta: null, self: !!cfg.broadcast?.self, uid, priv: !!cfg.private, ref: String(Math.random()).slice(2, 12) };
      conn.joined.set(topic, m);
      if (!topics.has(topic)) topics.set(topic, new Set());
      topics.get(topic).add(m);
      reply('ok', { postgres_changes: [] });
      conn.out({ topic: full, event: 'presence_state', payload: presenceState(topic), ref: null, join_ref });
      return;
    }
    const m = conn.joined.get(topic);
    if (event === 'phx_leave') { leave(conn, topic); return reply('ok'); }
    if (event === 'access_token') { conn.token = payload?.access_token; return; }
    if (!m) return reply('error', { reason: 'unmatched topic' });
    if (event === 'broadcast') {
      stats.broadcasts++;
      if (typeof payload !== 'object' || JSON.stringify(payload).length > 256 * 1024) return;
      for (const o of topics.get(topic) || []) if (o !== m || m.self) { stats.deliveries++; o.conn.out({ topic: full, event: 'broadcast', payload, ref: null, join_ref: o.joinRef }); }
      if (ref) reply('ok');
      return;
    }
    if (event === 'presence') {
      stats.presence++;
      if (payload?.event === 'track') {
        const had = m.meta, oldRef = m.ref; m.meta = payload.payload || {}; m.ref = String(Math.random()).slice(2, 12);
        fanout(topic, { event: 'presence_diff', payload: { joins: { [m.key]: { metas: [{ phx_ref: m.ref, ...m.meta }] } }, leaves: had ? { [m.key]: { metas: [{ phx_ref: oldRef, ...had }] } } : {} }, ref: null });
      } else if (payload?.event === 'untrack' && m.meta) {
        const had = m.meta; m.meta = null;
        fanout(topic, { event: 'presence_diff', payload: { joins: {}, leaves: { [m.key]: { metas: [{ phx_ref: m.ref, ...had }] } } }, ref: null });
      }
      return reply('ok');
    }
  }

  return {
    stats,
    topicMembers: (topic) => [...(topics.get(topic) || [])].map(m => m.key),
    maxPerSecond: (sinceMs = 0) => Math.max(0, ...stats.perSecond.filter(b => b.t * 1000 >= sinceMs).map(b => b.n), bucket.t * 1000 >= sinceMs ? bucket.n : 0),
    eventsSince: (sinceMs) => stats.perSecond.filter(b => b.t * 1000 >= sinceMs).reduce((n, b) => n + b.n, 0) + (bucket.t * 1000 >= sinceMs ? bucket.n : 0),
  };
}
