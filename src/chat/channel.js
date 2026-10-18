// Polling Safe Chat channel over the RPCs (post_chat / get_chat / chat_heartbeat).
// Emits: 'message' {id, username, displayName, text, mine}, 'members' [players], 'error' {reason}
export class ChatChannel {
  constructor(remote, room = 'lobby', { pollMs = 1500, heartbeatMs = 5000 } = {}) {
    this.remote = remote; this.room = room; this.pollMs = pollMs; this.heartbeatMs = heartbeatMs;
    this.lastId = 0; this.seen = new Set(); this.handlers = {}; this.timers = []; this.running = false; this.members = [];
  }
  on(type, fn) { (this.handlers[type] ||= []).push(fn); return this; }
  _emit(type, p) { (this.handlers[type] || []).forEach(fn => { try { fn(p); } catch (e) { console.warn(e); } }); }

  async start() {
    if (this.running) return; this.running = true;
    await this.heartbeat();
    // Only show messages from now on (history before joining stays hidden).
    try { const recent = await this.remote.getChat(this.room, 0); for (const m of recent) { this.seen.add(m.id); this.lastId = Math.max(this.lastId, m.id); } } catch { /* ignore */ }
    this.timers.push(setInterval(() => this.poll(), this.pollMs), setInterval(() => this.heartbeat(), this.heartbeatMs));
  }
  async stop() {
    this.running = false; this.timers.forEach(clearInterval); this.timers = [];
    try { await this.remote.chatLeave(this.room); } catch { /* ignore */ }
  }
  async heartbeat() {
    try { this.members = await this.remote.chatHeartbeat(this.room) || []; this._emit('members', this.members); }
    catch (e) { this._emit('error', { reason: e.message }); }
  }
  async poll() {
    if (this._polling) return; this._polling = true;
    try {
      const msgs = await this.remote.getChat(this.room, this.lastId) || [];
      for (const m of msgs) { this.lastId = Math.max(this.lastId, m.id); if (!this.seen.has(m.id)) { this.seen.add(m.id); this._emit('message', m); } }
    } catch (e) { this._emit('error', { reason: e.message }); }
    finally { this._polling = false; }
  }
  /** Send a catalog phrase. Resolves { ok, reason?, retryAfterMs? }. */
  async say(phrase, me) {
    const r = await this.remote.postChat(this.room, phrase.id);
    if (r?.ok) {
      this.seen.add(r.id); this.lastId = Math.max(this.lastId, r.id);
      this._emit('message', { id: r.id, username: me?.username, displayName: me?.displayName, text: r.text, phraseId: r.phraseId, mine: true });
    } else this._emit('error', r || { reason: 'failed' });
    return r;
  }
}
