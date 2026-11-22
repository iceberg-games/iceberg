// UGC store: drafts + published creations, and the bridge into the Catalog.
//
//   Signed in AND the 0020 migration is live -> Supabase RPCs (save_ugc_draft, list_my_ugc_drafts,
//     delete_ugc_draft, publish_ugc_item, list_ugc_items, buy_ugc_item). Server is authoritative
//     for price bounds, spec size and Birg Bucks.
//   Guest, offline, or the RPCs are missing (migration not applied yet) -> localStorage only.
//     This is what actually runs today: the migration file is NOT applied anywhere.
//
// Published items are registered into COSMETICS / COSMETIC_BY_ID as `ugc_<id>` entries
// (kind 'model', ugc: true, spec) so the existing shop/locker/equip code works unchanged;
// the avatar renders them with buildUgcObject(spec) (src/ugc/spec.js).
import { COSMETICS, COSMETIC_BY_ID } from '../data/cosmetics.js';
import { bus } from '../core/events.js';
import { getRemote } from '../net/session.js';
import { sanitizeSpec, frameFor, validateForPublish, UGC_PRICE } from './spec.js';

const NS = 'iceberg:v1:';
const K_DRAFTS = 'ugcDrafts', K_ITEMS = 'ugcItems';
const read = (k, d) => { try { const v = localStorage.getItem(NS + k); return v == null ? d : JSON.parse(v); } catch { return d; } };
const write = (k, v) => { try { localStorage.setItem(NS + k, JSON.stringify(v)); return true; } catch { return false; } };
const rid = (n = 10) => Array.from(crypto.getRandomValues(new Uint8Array(n)), b => (b % 36).toString(36)).join('');

/** 'server' when the RPCs answered for this session, 'local' otherwise (with a reason). */
export const ugcStatus = { mode: 'local', reason: 'Not signed in: creations are saved on this device.' };
let serverMissing = false;

function remote() {
  if (serverMissing) return null;
  const r = getRemote();
  return r && r.signedIn ? r : null;
}
async function rpc(fn, args, opts) {
  const r = getRemote(); if (!r || serverMissing) throw Object.assign(new Error('offline'), { local: true });
  try { const res = await r.client.rpc(fn, args, opts); ugcStatus.mode = 'server'; ugcStatus.reason = 'Saved to your account.'; return res; }
  catch (e) {
    // PostgREST 404 / PGRST202 = function not deployed (migration not applied): stay local for this session.
    if (e.status === 404 || e.code === 'PGRST202' || /could not find the function/i.test(e.message)) {
      serverMissing = true; ugcStatus.mode = 'local'; ugcStatus.reason = 'Account saving for creations is not live yet (server update pending), so this is saved on this device.';
    } else if (e.code === 'network' || e.status === 0) { ugcStatus.mode = 'local'; ugcStatus.reason = 'Offline: saved on this device.'; }
    throw Object.assign(e, { local: true });
  }
}

// ---------- catalog bridge ----------
const SLOT_ICON = { hat: '🎩', face: '🕶️', back: '🎒', neck: '🐧' };
export function toCatalogItem(it) {
  return { id: it.id, name: it.name, slot: it.slot, price: it.price, icon: SLOT_ICON[it.slot] || '✨', kind: 'model', ugc: true,
    spec: it.spec, creator: it.creator || 'a player', creatorId: it.creatorId || null, mine: !!it.mine, thumb: it.thumb || null,
    desc: `Made by ${it.creator || 'a player'} in the Accessory Editor.` };
}
/** Add/refresh UGC entries in the shared catalog arrays (idempotent). */
export function registerUgcItems(items) {
  for (const it of items) {
    if (!/^ugc_[a-z0-9_]{4,36}$/.test(it.id || '')) continue;
    const c = toCatalogItem(it);
    const old = COSMETIC_BY_ID[c.id];
    if (old) Object.assign(old, c); else { COSMETICS.push(c); COSMETIC_BY_ID[c.id] = c; }
  }
}
export const ugcCatalog = () => COSMETICS.filter(c => c.ugc);

// local published items register synchronously at import (before the avatar applies the loadout)
registerUgcItems(read(K_ITEMS, []));

// ---------- drafts ----------
export function listLocalDrafts() { return read(K_DRAFTS, []).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)); }

export async function listDrafts() {
  const local = listLocalDrafts();
  if (!remote()) return local;
  try {
    const rows = await rpc('list_my_ugc_drafts', {});
    const server = (rows || []).map(r => ({ id: r.draft_key, name: r.name, spec: r.spec, updatedAt: Date.parse(r.updated_at) || 0, server: true }));
    const byId = new Map(local.map(d => [d.id, d]));
    for (const d of server) if (!byId.has(d.id) || byId.get(d.id).updatedAt <= d.updatedAt) byId.set(d.id, d);
    return [...byId.values()].sort((a, b) => b.updatedAt - a.updatedAt);
  } catch { return local; }
}

/** Save a draft: local first (always), then the account when available. Returns { draft, where }. */
export async function saveDraft({ id, name, spec }) {
  const draft = { id: id || 'd_' + rid(12), name: String(name || 'Untitled').slice(0, 32), spec: sanitizeSpec(spec), updatedAt: Date.now() };
  const list = read(K_DRAFTS, []).filter(d => d.id !== draft.id);
  list.unshift(draft); write(K_DRAFTS, list.slice(0, 50));
  let where = 'device';
  if (remote()) { try { await rpc('save_ugc_draft', { p_draft_key: draft.id, p_name: draft.name, p_spec: draft.spec }); where = 'account'; } catch { /* stays local */ } }
  if (where === 'device' && !getRemote()?.signedIn) { ugcStatus.mode = 'local'; ugcStatus.reason = 'Not signed in: creations are saved on this device.'; }
  bus.emit('ugc:drafts', listLocalDrafts());
  return { draft, where };
}

export async function deleteDraft(id) {
  write(K_DRAFTS, read(K_DRAFTS, []).filter(d => d.id !== id));
  if (remote()) { try { await rpc('delete_ugc_draft', { p_draft_key: id }); } catch { /* local only */ } }
  bus.emit('ugc:drafts', listLocalDrafts());
}

// ---------- published items ----------
/** Pull everyone's published creations from the server (no-op locally). */
export async function refreshPublished() {
  const r = getRemote(); if (!r || serverMissing) return ugcCatalog();
  try {
    const rows = await rpc('list_ugc_items', { p_limit: 100 }, { anon: !r.signedIn });
    const me = r.signedIn ? r.userId : null;
    registerUgcItems((rows || []).map(x => ({ id: x.id, name: x.name, slot: x.slot, price: x.price_bb, spec: x.spec, creator: x.creator_name, creatorId: x.owner, mine: me && x.owner === me })));
    bus.emit('ugc:changed'); bus.emit('shop:availability');
  } catch { /* local list stays */ }
  return ugcCatalog();
}

/**
 * Publish a creation. Validates locally (the RPC re-validates). The creator owns it
 * for free (server: inventory row in publish_ugc_item; local: added to profile.owned).
 */
export async function publish({ draftId, name, spec, price, thumb }, economy) {
  const clean = sanitizeSpec(spec);
  const p = Math.round(+price);
  const errs = validateForPublish({ name, spec: clean, price: p });
  if (errs.length) return { ok: false, errors: errs };
  const creator = economy?.profile?.displayName || economy?.profile?.username || 'You';
  let item = null, where = 'device';
  if (remote()) {
    try {
      const res = await rpc('publish_ugc_item', { p_draft_key: draftId || null, p_name: name.trim(), p_spec: clean, p_price: p });
      if (res && res.ok === false) return { ok: false, errors: [String(res.reason || 'rejected').replace(/_/g, ' ')] };
      item = { id: res.id, name: name.trim(), slot: clean.slot, price: p, spec: clean, creator, mine: true, thumb, publishedAt: Date.now() };
      where = 'account';
    } catch { /* fall back below */ }
  }
  if (!item) item = { id: 'ugc_' + rid(10), name: name.trim(), slot: clean.slot, price: p, spec: clean, creator, mine: true, thumb, publishedAt: Date.now(), local: true };
  const items = read(K_ITEMS, []).filter(i => i.id !== item.id); items.unshift(item); write(K_ITEMS, items);
  registerUgcItems([item]);
  if (economy) {
    if (where === 'account') economy.resync?.().catch(() => {});
    else if (!economy.owns(item.id)) { economy.profile.owned.push(item.id); economy._save(); }
    bus.emit('inventory:changed', economy.profile);
  }
  if (draftId) write(K_DRAFTS, read(K_DRAFTS, []).map(d => d.id === draftId ? { ...d, publishedId: item.id } : d));
  bus.emit('ugc:changed', item);
  return { ok: true, item, where };
}

/** Buy someone's creation with Birg Bucks. Server: atomic buy_ugc_item; guest: the normal local purchase. */
export async function buyUgc(economy, item) {
  if (economy.owns(item.id)) return { ok: false, reason: 'Already owned' };
  if (economy.remote) {
    if (serverMissing) return { ok: false, reason: 'Buying creations with an account needs the server update. Try again soon.' };
    try {
      const res = await rpc('buy_ugc_item', { p_item_id: item.id });
      await economy.resync?.();
      if (!res?.ok) return { ok: false, reason: res?.reason === 'insufficient_funds' ? 'Not enough coins' : String(res?.reason || 'rejected').replace(/_/g, ' ') };
      return { ok: true };
    } catch (e) { return { ok: false, reason: serverMissing ? 'Buying creations with an account needs the server update. Try again soon.' : 'Could not buy right now' }; }
  }
  return economy.buy(item.id);   // guest: LocalBackend.purchase debits play-money BB + adds to owned
}

export const PRICE_HELP = `Pick ${UGC_PRICE.min}–${UGC_PRICE.max.toLocaleString()} BB. ${UGC_PRICE.default} BB is about a Snow Beanie and a half: cheap enough to impulse-buy, and roughly one daily bonus plus a short play session.`;
export { frameFor };
