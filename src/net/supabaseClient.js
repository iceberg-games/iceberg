// Tiny dependency-free client for the two Supabase APIs we use:
//   GoTrue  (/auth/v1)  – username/password sign-up & sign-in, token refresh
//   PostgREST (/rest/v1/rpc/<fn>) – every game action is an RPC
// Works the same against the local dev stub (tools/db/dev-server.mjs).
const SESSION_KEY = 'iceberg:v1:session';
// IndexedDB backup of the session (same origin; cleared on sign-out). Best effort: no IndexedDB = localStorage only.
const IDB = 'iceberg-auth';
const idbOpen = () => new Promise((ok, no) => { const r = globalThis.indexedDB?.open(IDB, 1); if (!r) return no(new Error('no idb'));
  r.onupgradeneeded = () => r.result.createObjectStore('kv'); r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error); });
const idbPut = (v) => idbOpen().then(db => { const t = db.transaction('kv', 'readwrite'); v ? t.objectStore('kv').put(v, 'session') : t.objectStore('kv').delete('session'); t.oncomplete = () => db.close(); }).catch(() => {});
const idbGet = () => idbOpen().then(db => new Promise(ok => { const r = db.transaction('kv').objectStore('kv').get('session'); r.onsuccess = () => { ok(r.result || null); db.close(); }; r.onerror = () => ok(null); })).catch(() => null);

export class ApiError extends Error {
  constructor(message, { status = 0, code = null, details = null } = {}) { super(message); this.status = status; this.code = code; this.details = details; }
}

export class SupabaseClient {
  constructor({ url, anonKey, storage = globalThis.localStorage, fetchImpl = globalThis.fetch?.bind(globalThis) }) {
    if (!url || !anonKey) throw new Error('SupabaseClient needs url + anonKey');
    this.url = url.replace(/\/+$/, ''); this.anonKey = anonKey; this.storage = storage; this.fetch = fetchImpl;
    this.session = this._load(); this._seen = !!this.session;
    this._refreshing = null;
  }
  _load() { try { return JSON.parse(this.storage?.getItem(SESSION_KEY) || 'null'); } catch { return null; } }
  _store(s) {
    this.session = s; this._seen = !!s;
    try { s ? this.storage?.setItem(SESSION_KEY, JSON.stringify(s)) : this.storage?.removeItem(SESSION_KEY); } catch { /* private mode */ }
    if (this.storage === globalThis.localStorage) idbPut(s);          // backup copy (restored if localStorage gets cleared)
  }
  /** Adopt the shared stored session if another tab refreshed (rotated tokens) or signed out since we loaded it. */
  _sync() {
    const st = this._load();
    if (!st) { if (this._seen) this.session = null; return; }          // signed out in another tab
    this._seen = true;
    if (st.refresh_token !== this.session?.refresh_token && (st.expires_at || 0) >= (this.session?.expires_at || 0)) this.session = st;
  }
  /** Page start: if localStorage lost the session but the IndexedDB copy survived, put it back. */
  async restoreBackup() {
    if (this.session || this.storage !== globalThis.localStorage) return !!this.session;
    const b = await idbGet(); if (!b?.refresh_token) return false;
    this._store(b); return true;
  }
  get user() { return this.session?.user || null; }
  get signedIn() { return !!this.session?.access_token; }

  async _req(path, { method = 'POST', body, auth = true, headers = {} } = {}) {
    const h = { apikey: this.anonKey, 'Content-Type': 'application/json', ...headers };
    if (auth && this.session?.access_token) h.Authorization = `Bearer ${this.session.access_token}`;
    else h.Authorization = `Bearer ${this.anonKey}`;
    let res;
    try { res = await this.fetch(this.url + path, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) }); }
    catch (e) { throw new ApiError('network_error: ' + e.message, { status: 0, code: 'network' }); }
    const text = await res.text();
    let data = null; try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    if (!res.ok) {
      const msg = (data && (data.msg || data.message || data.error_description || data.error)) || `HTTP ${res.status}`;
      throw new ApiError(msg, { status: res.status, code: data?.code || data?.error_code || null, details: data });
    }
    return data;
  }
  _fromAuth(data) {
    if (!data?.access_token) return null;
    const s = { access_token: data.access_token, refresh_token: data.refresh_token,
      expires_at: data.expires_at || Math.floor(Date.now() / 1000) + (data.expires_in || 3600),
      user: { id: data.user?.id, username: data.user?.user_metadata?.username || null } };
    this._store(s);
    return s;
  }

  async signUp({ email, password, data }) {
    const r = await this._req('/auth/v1/signup', { body: { email, password, data }, auth: false });
    // With "Confirm email" disabled Supabase returns a session right away.
    return this._fromAuth(r) || (r?.session && this._fromAuth(r.session)) || null;
  }
  async signIn({ email, password }) {
    return this._fromAuth(await this._req('/auth/v1/token?grant_type=password', { body: { email, password }, auth: false }));
  }
  async refresh() {
    const had = this.session?.access_token;
    this._sync();
    if (!this.session?.refresh_token) return null;
    if (this.session.access_token !== had && this.session.expires_at - 60 > Date.now() / 1000) return this.session;   // another tab already refreshed
    if (!this._refreshing) {
      const used = this.session.refresh_token;
      this._refreshing = this._req('/auth/v1/token?grant_type=refresh_token', { body: { refresh_token: used }, auth: false })
        .then(r => this._fromAuth(r))
        .catch(e => {
          if (e.status === 400 || e.status === 401) {
            this._sync();                                                    // rotated by another tab meanwhile: keep that one
            if (this.session?.refresh_token && this.session.refresh_token !== used) return this.session;
            this._store(null);
          }
          throw e;
        })
        .finally(() => { this._refreshing = null; });
    }
    return this._refreshing;
  }
  async signOut() {
    try { if (this.signedIn) await this._req('/auth/v1/logout', { body: {} }); } catch { /* ignore */ }
    this._store(null);
  }
  async ensureFresh() {
    this._sync();
    if (this.session && this.session.expires_at - 60 < Date.now() / 1000) await this.refresh();
  }

  /** Call a Postgres function: POST /rest/v1/rpc/<fn> with named args. */
  async rpc(fn, args = {}, { anon = false } = {}) {
    if (!anon) await this.ensureFresh();
    try { return await this._req(`/rest/v1/rpc/${fn}`, { body: args, auth: !anon }); }
    catch (e) {
      if (e.status === 401 && !anon && this.session?.refresh_token) { await this.refresh(); return this._req(`/rest/v1/rpc/${fn}`, { body: args }); }
      throw e;
    }
  }
}
