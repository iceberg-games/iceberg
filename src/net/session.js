// Shared sign-in plumbing for the portal and the play page (same origin => same session).
import { accountsEnabled } from './config.js';
import { SupabaseBackend } from './SupabaseBackend.js';
import { bus } from '../core/events.js';
import { registerThisSession } from './account.js';

let shared = null;
/** The SupabaseBackend for this page, or null when accounts are not configured. */
export function getRemote() {
  if (!accountsEnabled()) return null;
  return (shared ||= SupabaseBackend.fromConfig());
}

/** If a stored session exists, attach it to the economy (runs the first-login migration).
 *  Returns the remote backend, or null (guest). Never throws; falls back to guest mode. */
export async function connectStoredSession(economy, { timeoutMs = 8000 } = {}) {
  const remote = getRemote();
  if (remote && !remote.signedIn) await remote.client.restoreBackup?.().catch(() => false);   // localStorage cleared, IndexedDB copy kept
  try { navigator.storage?.persist?.(); } catch { /* best effort: ask the browser not to evict site storage */ }
  if (!remote || !remote.signedIn) return null;
  try {
    const res = await Promise.race([economy.connect(remote), new Promise((_, no) => setTimeout(() => no(new Error('timeout')), timeoutMs))]);
    if (res?.migration?.ok && (res.migration.coins || res.migration.items?.length)) {
      bus.emit('toast', { text: `Moved your guest progress to your account: +${res.migration.coins} BB, ${res.migration.items.length} items`, icon: '📦' });
    }
    registerThisSession(remote).catch(() => {});
    return remote;
  } catch (e) {
    if (e.status === 401 || e.status === 403) await remote.client.signOut();
    console.warn('Sign-in restore failed', e);
    bus.emit('toast', { text: 'Could not reach your account. Please sign in again.', icon: '⚠️' });
    return null;
  }
}
