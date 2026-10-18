// Studio drafts (work in progress). Published games go to the backend's
// customGames list, which the Games menu reads.
import { backend } from '../backend/LocalBackend.js';
const KEY = 'iceberg:v1:studioDrafts';
const read = () => { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; } };
export const drafts = {
  list: read,
  get: (id) => read().find(d => d.id === id) || null,
  save(doc) { const l = read().filter(d => d.id !== doc.id); l.push(doc); try { localStorage.setItem(KEY, JSON.stringify(l)); } catch (e) { console.warn('draft save failed', e); throw e; } },
  remove(id) { localStorage.setItem(KEY, JSON.stringify(read().filter(d => d.id !== id))); },
};
export function publish(doc) { const pub = { ...doc, published: true, publishedAt: Date.now() }; backend.saveCustomGame(pub); return pub; }
export const isPublished = (id) => backend.loadCustomGames().some(g => g.id === id);
export function unpublish(id) { backend.deleteCustomGame(id); }
