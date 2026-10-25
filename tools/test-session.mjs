// Session persistence across tabs (node): shared storage, refresh-token rotation like Supabase (old token rejected).
import assert from 'node:assert/strict';
const { SupabaseClient } = await import('../src/net/supabaseClient.js');
const mem = new Map(); const storage = { getItem: k => mem.has(k) ? mem.get(k) : null, setItem: (k, v) => mem.set(k, String(v)), removeItem: k => mem.delete(k) };
let valid = 'r1', n = 1, refreshCalls = 0;
const fetchImpl = async (url, { body }) => {
  const j = body ? JSON.parse(body) : {};
  const ok = (d) => ({ ok: true, status: 200, text: async () => JSON.stringify(d) });
  if (url.includes('grant_type=refresh_token')) { refreshCalls++;
    if (j.refresh_token !== valid) return { ok: false, status: 400, text: async () => JSON.stringify({ error: 'invalid_grant' }) };
    valid = 'r' + (++n); return ok({ access_token: 'a' + n, refresh_token: valid, expires_in: 3600, user: { id: 'u', user_metadata: { username: 'p' } } }); }
  if (url.includes('/logout')) return ok({});
  return ok(true);
};
const past = Math.floor(Date.now() / 1000) - 10;
storage.setItem('iceberg:v1:session', JSON.stringify({ access_token: 'a1', refresh_token: 'r1', expires_at: past, user: { id: 'u', username: 'p' } }));
const tab1 = new SupabaseClient({ url: 'http://x', anonKey: 'k', storage, fetchImpl });
const tab2 = new SupabaseClient({ url: 'http://x', anonKey: 'k', storage, fetchImpl });
await tab1.ensureFresh();                                   // tab1 rotates r1 -> r2
assert.equal(tab1.session.refresh_token, 'r2');
await tab2.ensureFresh();                                   // tab2 still held r1: must adopt r2, not sign out
assert.equal(tab2.signedIn, true); assert.equal(tab2.session.refresh_token, 'r2'); assert.equal(refreshCalls, 1, 'no second refresh');
// stale cached copy + forced 400 path: tab2 holds an old token, storage has a newer one -> adopts it
tab2.session = { ...tab2.session, refresh_token: 'r1', access_token: 'a1', expires_at: past };
storage.setItem('iceberg:v1:session', JSON.stringify({ ...tab1.session, expires_at: past }));
valid = 'zzz';                                              // even the stored token is now rejected (revoked)
await tab2.refresh().catch(() => {});
assert.equal(tab2.signedIn, false, 'truly revoked -> signed out');
// sign-out in one tab is followed by the other
valid = 'r9'; storage.setItem('iceberg:v1:session', JSON.stringify({ access_token: 'a9', refresh_token: 'r9', expires_at: past + 9999, user: { id: 'u' } }));
const t3 = new SupabaseClient({ url: 'http://x', anonKey: 'k', storage, fetchImpl }), t4 = new SupabaseClient({ url: 'http://x', anonKey: 'k', storage, fetchImpl });
await t3.signOut(); await t4.ensureFresh();
assert.equal(t4.signedIn, false, 'sign-out propagates');
// network error on refresh keeps the session (no forced re-login offline)
storage.setItem('iceberg:v1:session', JSON.stringify({ access_token: 'a5', refresh_token: 'r5', expires_at: past, user: { id: 'u' } }));
const t5 = new SupabaseClient({ url: 'http://x', anonKey: 'k', storage, fetchImpl: async () => { throw new Error('offline'); } });
await t5.ensureFresh().catch(() => {}); assert.equal(t5.signedIn, true, 'offline keeps the session');
console.log('session persistence: all checks passed');
