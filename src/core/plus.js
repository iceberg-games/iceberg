// Iceberg Plus — membership PREP. No real payments: nothing is charged, no Stripe.
// The flag is local-only (localStorage) for demo/dev. Future server field (additive,
// NOT applied): profiles.plus_until timestamptz NULL — set only by a verified payment
// webhook; the client would then read it from the profile instead of this flag.
import { bus } from './events.js';

export const PLUS = { name: 'Iceberg Plus', usdPerMonth: 9, icon: '❄️', status: 'coming_soon' };
const KEY = 'iceberg:v1:plus';

export function isPlus() { try { return JSON.parse(localStorage.getItem(KEY) || 'null')?.active === true; } catch { return false; } }
/** DEMO toggle only — never a charge. */
export function setPlusDemo(on) {
  try { localStorage.setItem(KEY, JSON.stringify({ active: !!on, source: 'demo', at: Date.now() })); } catch { /* private mode */ }
  bus.emit('plus:changed', !!on);
}
/** Perk gate: returns true when the perk is available. */
export function hasPerk(perk) { return isPlus() && (perk === 'mobileCustomColor' || perk === 'studioCustomPrefab'); }

export function plusBadge(h) { return isPlus() ? h('span.plus-badge', { title: 'Iceberg Plus member (demo)' }, PLUS.icon, ' PLUS') : null; }

/** Membership card: $9/mo, coming soon, demo toggle. onChange re-renders the host. */
export function plusCard(h, onChange) {
  const on = isPlus();
  return h('div.p-card.plus-card#plus-card',
    h('h3', PLUS.icon, ' ', PLUS.name, ' ', plusBadge(h)),
    h('p', h('b', `$${PLUS.usdPerMonth}/month`), ' — ', h('span.tag', 'Coming soon')),
    h('ul.earn', h('li', 'Plus badge on your profile'), h('li', '🎨 Custom block colors in Mobile Studio'), h('li', '🧩 Save custom prefabs in the computer Studio')),
    h('p.muted.small', 'Not available to buy yet — no card is collected and nothing is charged.'),
    h('button.btn.small' + (on ? '.secondary' : '') + '#plus-demo-toggle', { onclick: () => { setPlusDemo(!on); onChange?.(); } },
      on ? 'Turn off Plus (demo)' : 'Try Plus free (demo)'));
}
