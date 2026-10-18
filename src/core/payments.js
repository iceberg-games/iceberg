// Payments stub — NO real money is processed in this prototype.
//
// To go live (e.g. with Stripe):
//  1. Server: create an endpoint POST /api/checkout {packId} that creates a
//     Stripe Checkout Session using a server-side price table (never trust
//     client prices) and returns session.url.
//  2. Client: implement StripeProvider.checkout() below to call that endpoint
//     and window.location = url.
//  3. Server: handle the `checkout.session.completed` webhook, verify the
//     signature, and credit Birg Bucks to the player's server-side wallet
//     (idempotently, keyed by session id). The client then just refreshes
//     its profile from the backend — it never credits itself.
//  4. Comply with platform/age rules (parental consent, refunds, taxes).

export const PACKS = [
  { id: 'bb_500',  bucks: 500,  usd: 4 },
  { id: 'bb_1000', bucks: 1000, usd: 8 },
  { id: 'bb_2500', bucks: 2500, usd: 20 },
  { id: 'bb_5000', bucks: 5000, usd: 40, tag: 'Best for big buys' },
];

class DemoProvider {
  name = 'demo';
  enabled = false;
  async checkout(pack) {
    return { ok: false, status: 'coming_soon', message: 'Payments coming soon (demo). No money was charged.' };
  }
}

// class StripeProvider {
//   name = 'stripe'; enabled = true;
//   async checkout(pack) {
//     const r = await fetch('/api/checkout', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ packId: pack.id }) });
//     const { url } = await r.json(); window.location.href = url;
//     return { ok: true, status: 'redirecting' };
//   }
// }

export const payments = new DemoProvider();
