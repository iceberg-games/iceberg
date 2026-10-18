// 'New Update (Developers Only)': asks the server (public.is_dev(), migration 0009) whether the
// signed-in account is on the dev allowlist. Anything else (guest, not a dev, RPC missing on an
// older database, network error) => false, silently. The button DOM is only created when true.
export async function isDev(remote) {
  if (!remote?.client?.signedIn) return false;
  try { return (await remote.client.rpc('is_dev', {})) === true; } catch { return false; }
}

/** The pill element (call only after isDev() === true). href is relative to the current page. */
export function devUpdateButton(h, href) {
  return h('a.dev-update#dev-update', { href, target: '_blank', rel: 'noopener', 'data-sfx': 'none',
    title: 'Opens the newest update in a separate test sandbox (test data only)' }, '🧪 New Update (Developers Only)');
}
