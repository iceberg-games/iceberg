// Iceberg Plus membership. No real payments: nothing is charged, no Stripe.
// Signed in: Plus comes from the SERVER (migration 0015: profiles.plus_until, plus_status() RPC);
//   devs grant it with grant_plus(username, days) — a comp/demo grant, never a charge.
// Guest / offline / older server: a local demo flag (localStorage) is the fallback.
import { bus } from './events.js';

export const PLUS = { name: 'Iceberg Plus', usdPerMonth: 9, icon: '❄️', status: 'coming_soon' };
const KEY = 'iceberg:v1:plus';

let server = null;   // null = unknown (guest/offline); else { plus, until }
function localDemo() { try { return JSON.parse(localStorage.getItem(KEY) || 'null')?.active === true; } catch { return false; } }
export function isPlus() {
  if (server) return server.plus === true && (!server.until || Date.parse(server.until) > Date.now());
  return localDemo();
}
export function plusSource() { return server ? 'server' : 'demo'; }
/** Ask the server (plus_status, 0015). Missing RPC / guest / network error => keep local fallback. */
export async function syncPlus(remote) {
  const before = isPlus();
  if (!remote?.client?.signedIn) server = null;
  else {
    try { const r = await remote.client.rpc('plus_status', {}); server = r && typeof r === 'object' ? { plus: r.plus === true, until: r.plus_until || null } : null; }
    catch { server = null; }
  }
  if (isPlus() !== before) bus.emit('plus:changed', isPlus());
  return isPlus();
}
/** Dev/admin only (server checks is_dev). Comp/demo grant, NOT a payment. days<=0 revokes. */
export async function grantPlus(remote, username, days = 30, note = null) {
  return remote.client.rpc('grant_plus', { p_username: username, p_days: days, p_note: note });
}
/** DEMO toggle only — never a charge. */
export function setPlusDemo(on) {
  try { localStorage.setItem(KEY, JSON.stringify({ active: !!on, source: 'demo', at: Date.now() })); } catch { /* private mode */ }
  bus.emit('plus:changed', !!on);
}
/** Perk gate: returns true when the perk is available. */
export function hasPerk(perk) { return isPlus() && (perk === 'mobileCustomColor' || perk === 'studioCustomPrefab'); }

export function plusBadge(h) { return isPlus() ? h('span.plus-badge', { title: plusSource() === 'server' ? 'Iceberg Plus member' : 'Iceberg Plus member (demo)' }, PLUS.icon, ' PLUS') : null; }

/** Membership card: $9/mo, coming soon, demo toggle. onChange re-renders the host. */
export function plusCard(h, onChange) {
  const on = isPlus();
  return h('div.p-card.plus-card#plus-card',
    h('h3', PLUS.icon, ' ', PLUS.name, ' ', plusBadge(h)),
    h('p', h('b', `$${PLUS.usdPerMonth}/month`), ' — ', h('span.tag', 'Coming soon')),
    h('ul.earn', h('li', 'Plus badge on your profile'), h('li', '🎨 Custom block colors in Mobile Studio'), h('li', '🧩 Save custom prefabs in the computer Studio')),
    h('p.muted.small', 'Not available to buy yet — no card is collected and nothing is charged.'),
    plusSource() === 'server'
      ? h('p.muted.small#plus-server-note', on ? 'Plus is active on your account (granted by an Iceberg developer — not a purchase).' : 'Signed in: Plus is read from your account. Purchases are coming soon.')
      : h('button.btn.small' + (on ? '.secondary' : '') + '#plus-demo-toggle', { onclick: () => { setPlusDemo(!on); onChange?.(); } },
        on ? 'Turn off Plus (demo, this device only)' : 'Try Plus free (demo, this device only)'));
}
