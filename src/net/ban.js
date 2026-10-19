// Bans (migration 0012): is_banned() for the signed-in account; dev-only ban_user / unban_user.
// A missing RPC (older server) or a network error counts as not banned, so the site never locks people out by mistake.
export async function isBanned(remote) {
  if (!remote?.client) return false;
  try { return (await remote.client.rpc('is_banned', {})) === true; } catch { return false; }
}
/** Full-screen block: replaces the page (no games, chat or multiplayer start after this). */
export function showBanned() {
  window.__icebergBanned = true;
  document.body.innerHTML = '';
  const d = document.createElement('div'); d.id = 'banned-screen'; d.setAttribute('role', 'alert');
  d.style.cssText = 'position:fixed;inset:0;z-index:2147483600;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;background:linear-gradient(160deg,#0e2a45,#1d4f7a);color:#fff;font-family:system-ui,sans-serif;text-align:center;padding:24px';
  d.innerHTML = '<div style="font-size:56px">⛔</div><h1 style="margin:0;font-size:32px">You are banned</h1><p style="margin:0;max-width:420px;opacity:.85">This account has been banned from Iceberg.</p>';
  document.body.append(d);
}
export async function banUser(remote, username, reason = null) { return remote.client.rpc('ban_user', { p_username: username, p_reason: reason }); }
export async function unbanUser(remote, username) { return remote.client.rpc('unban_user', { p_username: username }); }
