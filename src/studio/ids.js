/** Random, collision-safe game id ('g_' + 32 hex/alnum chars). */
export function newGameId() {
  const u = globalThis.crypto?.randomUUID?.() || (Date.now().toString(36) + Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2));
  return 'g_' + u.replace(/-/g, '');
}
