// Account settings helpers: date of birth, deactivate/delete, device sessions.
// Server RPCs live in supabase/migrations/20261122000020_editor_accounts.sql.
// If a column/RPC is not on the server yet, the UI still works from local storage
// and shows a clear "not available yet" error for delete.
const DOB_MIN = '1900-01-01';
const DOB_KEY = (uid) => `iceberg:v1:dob:${uid || 'pending'}`;
const DEVICE_SESSION_KEY = 'iceberg:v1:device-session-id';

export function validateDateOfBirth(value, { now = new Date() } = {}) {
  const raw = String(value || '').trim();
  if (!raw) return 'Enter your date of birth';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return 'Use a valid date';
  const [y, m, d] = raw.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return 'Use a valid date';
  if (raw < DOB_MIN) return 'Use a valid date';
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const iso = (dt) => dt.toISOString().slice(0, 10);
  if (iso(dt) > iso(today)) return 'Date of birth can’t be in the future';
  return null;
}

export function formatDob(value) {
  const raw = String(value || '').slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : '';
}

export function saveLocalDob(uid, dob) {
  try { if (dob) localStorage.setItem(DOB_KEY(uid), formatDob(dob)); } catch { /* private mode */ }
}

export function loadLocalDob(uid) {
  try { return formatDob(localStorage.getItem(DOB_KEY(uid)) || localStorage.getItem(DOB_KEY('pending')) || ''); } catch { return ''; }
}

export function resolveDob(profile, uid) {
  return formatDob(profile?.dateOfBirth || loadLocalDob(uid || profile?.playerId));
}

/** Map RPC / HTTP failures into a short message the settings UI can show. */
export function accountError(err, { action = 'That' } = {}) {
  const status = err?.status;
  const m = String(err?.message || err || '');
  const code = String(err?.code || '');
  if (status === 404 || code === 'PGRST202' || /PGRST202|could not find the function|schema cache|does not exist/i.test(m)) {
    return `${action} is not available yet. This update still needs to be applied on the server.`;
  }
  if (/invalid_date/i.test(m)) return 'Use a valid date';
  if (/network/i.test(m)) return 'Cannot reach the server. Check your connection.';
  return m || `${action} failed.`;
}

export function isNotAvailable(err) {
  return /not available yet/i.test(accountError(err));
}

export function deviceSessionId(storage = globalThis.localStorage) {
  try {
    let id = storage?.getItem(DEVICE_SESSION_KEY);
    if (id && id.length >= 8) return id;
    id = globalThis.crypto?.randomUUID?.() || `dev-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    storage?.setItem(DEVICE_SESSION_KEY, id);
    return id;
  } catch {
    return `dev-${Date.now()}`;
  }
}

/** A short label for the sessions list, e.g. "Chrome on Windows". */
export function deviceLabel(ua = globalThis.navigator?.userAgent || '') {
  const s = String(ua);
  const browser = /Edg\//.test(s) ? 'Edge' : /OPR\/|Opera/.test(s) ? 'Opera' : /Chrome\//.test(s) && !/Chromium/.test(s) ? 'Chrome'
    : /Firefox\//.test(s) ? 'Firefox' : /Safari\//.test(s) && !/Chrome/.test(s) ? 'Safari' : /Iceberg/i.test(s) ? 'Iceberg' : 'Browser';
  const os = /iPhone|iPad|iPod/.test(s) ? 'iOS' : /Android/.test(s) ? 'Android' : /Mac OS X/.test(s) ? 'macOS'
    : /Windows/.test(s) ? 'Windows' : /Linux/.test(s) ? 'Linux' : 'this device';
  return `${browser} on ${os}`;
}

export function formatLastActive(iso, { now = Date.now() } = {}) {
  if (!iso) return 'Unknown';
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return 'Unknown';
  const sec = Math.max(0, Math.round((now - t) / 1000));
  if (sec < 45) return 'Just now';
  if (sec < 3600) return `${Math.round(sec / 60)} min ago`;
  if (sec < 86400) return `${Math.round(sec / 3600)} hours ago`;
  const days = Math.round(sec / 86400);
  return days === 1 ? 'Yesterday' : `${days} days ago`;
}

async function rpcOrMissing(remote, fn, args) {
  try { return await remote.client.rpc(fn, args); }
  catch (e) {
    e._friendly = accountError(e, { action: 'This' });
    throw e;
  }
}

export async function saveDateOfBirth(remote, dob, { uid } = {}) {
  const err = validateDateOfBirth(dob);
  if (err) throw new Error(err);
  const value = formatDob(dob);
  saveLocalDob(uid || remote?.userId, value);
  if (!remote?.client) return { ok: true, dateOfBirth: value, localOnly: true };
  try {
    const res = await remote.client.rpc('set_date_of_birth', { p_dob: value });
    if (res?.ok === false) throw new Error(res.reason === 'invalid_date' ? 'Use a valid date' : (res.reason || 'Could not save date of birth'));
    if (res?.dateOfBirth || res?.profile?.dateOfBirth) saveLocalDob(uid || remote.userId, res.dateOfBirth || res.profile.dateOfBirth);
    return res || { ok: true, dateOfBirth: value };
  } catch (e) {
    if (e.status === 404 || e.code === 'PGRST202' || /PGRST202|could not find the function|does not exist/i.test(String(e.message))) {
      return { ok: true, dateOfBirth: value, localOnly: true };
    }
    throw new Error(accountError(e, { action: 'Saving your date of birth' }));
  }
}

export async function deactivateAccount(remote) {
  if (!remote?.client) throw new Error('You need to be signed in.');
  try {
    const res = await remote.client.rpc('deactivate_account', {});
    if (res?.ok === false) throw new Error(res.reason || 'Could not deactivate this account');
    return res || { ok: true };
  } catch (e) {
    throw new Error(accountError(e, { action: 'Deactivating your account' }));
  }
}

export async function deleteAccount(remote) {
  if (!remote?.client) throw new Error('You need to be signed in.');
  try {
    const res = await remote.client.rpc('delete_account', {});
    if (res?.ok === false) throw new Error(res.reason || 'Could not delete this account');
    return res || { ok: true };
  } catch (e) {
    throw new Error(accountError(e, { action: 'Account deletion' }));
  }
}

export async function registerThisSession(remote) {
  if (!remote?.client) return null;
  const clientId = deviceSessionId();
  try {
    return await rpcOrMissing(remote, 'register_account_session', {
      p_client_id: clientId,
      p_user_agent: (globalThis.navigator?.userAgent || '').slice(0, 300),
      p_device_label: deviceLabel(),
    });
  } catch (e) {
    if (/not available yet/i.test(e._friendly || '')) return { ok: true, localOnly: true, session: { clientId, deviceLabel: deviceLabel(), lastActive: new Date().toISOString() } };
    return null;
  }
}

export async function heartbeatThisSession(remote) {
  if (!remote?.client) return { ok: true };
  const clientId = deviceSessionId();
  try {
    return await remote.client.rpc('heartbeat_account_session', { p_client_id: clientId });
  } catch (e) {
    if (e.status === 404 || e.code === 'PGRST202') return { ok: true, localOnly: true };
    throw e;
  }
}

export async function listSessions(remote) {
  const clientId = deviceSessionId();
  const fallback = [{ id: 'local', clientId, deviceLabel: deviceLabel(), lastActive: new Date().toISOString(), current: true }];
  if (!remote?.client) return fallback;
  try {
    const rows = await remote.client.rpc('list_account_sessions', {});
    const list = Array.isArray(rows) ? rows : [];
    if (!list.length) return fallback;
    return list.map((s) => ({ ...s, current: s.clientId === clientId }));
  } catch (e) {
    if (e.status === 404 || e.code === 'PGRST202' || /PGRST202|does not exist/i.test(String(e.message))) return fallback;
    throw new Error(accountError(e, { action: 'Loading sessions' }));
  }
}

export async function revokeSession(remote, sessionId) {
  try {
    const res = await remote.client.rpc('revoke_account_session', { p_session_id: sessionId });
    if (res?.ok === false) throw new Error(res.reason === 'not_found' ? 'That session is no longer active.' : (res.reason || 'Could not sign out that session'));
    return res;
  } catch (e) {
    throw new Error(accountError(e, { action: 'Signing out that session' }));
  }
}

export async function revokeOtherSessions(remote) {
  const clientId = deviceSessionId();
  let rpcRes = null;
  try { rpcRes = await remote.client.rpc('revoke_other_account_sessions', { p_client_id: clientId }); }
  catch (e) {
    if (!(e.status === 404 || e.code === 'PGRST202')) throw new Error(accountError(e, { action: 'Signing out other sessions' }));
  }
  try { await remote.client.signOut({ scope: 'others' }); } catch { /* stub or older GoTrue may not support scope */ }
  return rpcRes || { ok: true };
}

/** Heartbeat this device's session; call onRevoked if the server says it was signed out. Returns a stop function. */
export function watchAccountSession(remote, { onRevoked, intervalMs = 60000 } = {}) {
  if (!remote?.client) return () => {};
  let stopped = false;
  const tick = async () => {
    if (stopped) return;
    try {
      const r = await heartbeatThisSession(remote);
      if (r && r.ok === false && r.reason === 'revoked') onRevoked?.(r);
    } catch { /* network / missing RPC */ }
  };
  tick();
  const id = setInterval(tick, intervalMs);
  return () => { stopped = true; clearInterval(id); };
}
