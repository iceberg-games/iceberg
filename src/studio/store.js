// Studio drafts (work in progress) + publishing.
// Local copy: backend.customGames (localStorage) is always written first so nothing is lost offline.
// Signed in: the server (custom_games, migration 0017) is the source of truth for published games;
// publish() rejects with a real error if either the local save or the server call fails.
import { backend } from '../backend/LocalBackend.js';
import { getRemote } from '../net/session.js';
import { bus } from '../core/events.js';
const KEY = 'iceberg:v1:studioDrafts';
const read = () => { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; } };
export const drafts = {
  list: read,
  get: (id) => read().find(d => d.id === id) || null,
  /** Local write is synchronous (throws if storage fails, as before). Signed in: also syncs to the server
   *  (shared saves). Returns a Promise<{ remote, ok, reason? }> that never rejects; failures emit 'drafts:sync'. */
  save(doc) {
    const l = read().filter(d => d.id !== doc.id); l.push(doc);
    try { localStorage.setItem(KEY, JSON.stringify(l)); } catch (e) { console.warn('draft save failed', e); throw e; }
    const remote = signedInRemote();
    if (!remote) return Promise.resolve({ remote: false, ok: true });
    return remote.saveCustomDraft(doc).then(r => ({ remote: true, ok: r?.ok === true, reason: r?.reason }), e => ({ remote: true, ok: false, reason: e.message }))
      .then(res => { if (!res.ok) bus.emit('drafts:sync', { id: doc.id, ...res, message: REASONS[res.reason] || res.reason }); return res; });
  },
  /** Local remove; signed in, a never-published server draft is soft-deleted (row kept). */
  remove(id) {
    localStorage.setItem(KEY, JSON.stringify(read().filter(d => d.id !== id)));
    const remote = signedInRemote();
    return remote ? remote.deleteCustomDraft(id).catch(() => null) : Promise.resolve(null);
  },
  /** Signed in: pull my server saves; a newer (or equal) server copy replaces the local draft. Returns count updated. */
  async pull() {
    const remote = signedInRemote(); if (!remote) return 0;
    const rows = await remote.listMyGames(); const l = read(); let n = 0;
    for (const g of rows || []) {
      const sd = { ...g.doc, id: g.game_key, name: g.doc?.name || g.name }; const i = l.findIndex(d => d.id === sd.id);
      if (i < 0) { l.push(sd); n++; } else if ((sd.updatedAt || 0) > (l[i].updatedAt || 0)) { l[i] = sd; n++; }
    }
    if (n) { try { localStorage.setItem(KEY, JSON.stringify(l)); } catch { /* keep server copy; local cache full */ } }
    return n;
  },
};

export { newGameId } from './ids.js';

const signedInRemote = () => { const r = getRemote(); return r && r.signedIn ? r : null; };
const REASONS = { too_large: 'game is too big to publish (try fewer uploaded models)', id_taken: 'this game id belongs to another player; use Save As / re-import', limit_reached: 'you reached the published game limit', bad_name: 'game needs a name (1-40 characters)', bad_doc: 'game data is invalid', bad_id: 'game id is invalid', thumb_too_large: 'thumbnail image is too big' };

/** Publish (signed-in only; guests get an error and keep their draft): local copy first (verified), then server. Returns { doc, remote }. Throws on failure. */
export async function publish(doc) {
  if (!signedInRemote()) throw new Error('sign in to publish (your game is saved as a draft on this device)');
  const pub = { ...doc, published: true, publishedAt: Date.now() };
  backend.saveCustomGame(pub);
  if (!backend.loadCustomGames().some(g => g.id === pub.id && g.publishedAt === pub.publishedAt)) throw new Error('could not save on this device (storage full or private mode)');
  const remote = signedInRemote();
  let r;
  try { r = await remote.publishCustomGame(pub); }
  catch (e) { throw new Error(`saved on this device, but the server publish failed: ${e.message}`); }
  if (!r || r.ok !== true) throw new Error(`saved on this device, but the server refused: ${REASONS[r?.reason] || r?.reason || 'unknown error'}`);
  pub.serverId = r.id; backend.saveCustomGame(pub);
  return { doc: pub, remote: true, modelsLocalOnly: usesUploadedModels(pub) };
}
export const isPublished = (id) => backend.loadCustomGames().some(g => g.id === id);
/** Unpublish: server soft-delete (row kept) when signed in, then remove the local list entry. The draft is kept. */
export async function unpublish(id) {
  const remote = signedInRemote();
  if (remote) { const r = await remote.unpublishCustomGame(id); if (!r?.ok && r?.reason !== 'not_found') throw new Error(r?.reason || 'unpublish failed'); }
  backend.deleteCustomGame(id);
}

const fromRow = (g) => ({ ...g.doc, id: g.game_key, name: g.name, serverId: g.id, owner: g.owner, ownerName: g.owner_name, publishedAt: Date.parse(g.published_at) || null, serverUpdatedAt: Date.parse(g.updated_at) || null, fromServer: true });
/** One published game by id (play-by-link). null when not found / accounts off. */
export async function getServerGame(id) { const r = getRemote(); if (!r) return null; const g = await r.getPublishedGame(id); return g ? fromRow(g) : null; }
/** Uploaded 3D models live in this browser only; other players see a placeholder box. */
export const usesUploadedModels = (doc) => [...(doc.models || []), ...(doc.instances || [])].some(m => m && m.modelId);
/** Signed in: when the server copy of MY game is newer (or equal), it wins over the local copy. */
export function mergeOwn(local, server, myId) {
  if (!server || !myId || server.owner !== myId) return local;
  return (server.updatedAt || 0) >= (local.updatedAt || 0) ? { ...server, fromServer: false } : local;
}
/** Published games from the server (everyone's). [] when accounts are off; throws on network errors. */
export async function listServerGames() {
  const r = getRemote(); if (!r) return [];
  const rows = await r.listPublishedGames();
  return (rows || []).map(fromRow);
}
