// Studio drafts (work in progress) + publishing.
// Local copy: backend.customGames (localStorage) is always written first so nothing is lost offline.
// Signed in: the server (custom_games, migration 0017) is the source of truth for published games;
// publish() rejects with a real error if either the local save or the server call fails.
import { backend } from '../backend/LocalBackend.js';
import { getRemote } from '../net/session.js';
const KEY = 'iceberg:v1:studioDrafts';
const read = () => { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; } };
export const drafts = {
  list: read,
  get: (id) => read().find(d => d.id === id) || null,
  save(doc) { const l = read().filter(d => d.id !== doc.id); l.push(doc); try { localStorage.setItem(KEY, JSON.stringify(l)); } catch (e) { console.warn('draft save failed', e); throw e; } },
  remove(id) { localStorage.setItem(KEY, JSON.stringify(read().filter(d => d.id !== id))); },
};

export { newGameId } from './ids.js';

const signedInRemote = () => { const r = getRemote(); return r && r.signedIn ? r : null; };
const REASONS = { too_large: 'game is too big to publish (try fewer uploaded models)', id_taken: 'this game id belongs to another player; use Save As / re-import', limit_reached: 'you reached the published game limit', bad_name: 'game needs a name (1-40 characters)', bad_doc: 'game data is invalid', bad_id: 'game id is invalid', thumb_too_large: 'thumbnail image is too big' };

/** Publish: local copy first (verified), then server when signed in. Returns { doc, remote }. Throws on failure. */
export async function publish(doc) {
  const pub = { ...doc, published: true, publishedAt: Date.now() };
  backend.saveCustomGame(pub);
  if (!backend.loadCustomGames().some(g => g.id === pub.id && g.publishedAt === pub.publishedAt)) throw new Error('could not save on this device (storage full or private mode)');
  const remote = signedInRemote();
  if (!remote) return { doc: pub, remote: false };
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
