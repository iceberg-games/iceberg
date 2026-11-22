// Groups (simple, Editor Update step 1): create / join / leave / list.
// Stored on THIS device (localStorage) for now. A shared Supabase version needs a migration (reported, not applied).
const KEY = 'iceberg:v1:groups';
const read = () => { try { const v = JSON.parse(localStorage.getItem(KEY) || '[]'); return Array.isArray(v) ? v : []; } catch { return []; } };
const write = (l) => { try { localStorage.setItem(KEY, JSON.stringify(l)); } catch { /* private mode */ } };
const clean = (s, n) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, n);

export const groups = {
  list: () => read(),
  mine: () => read().filter(g => g.joined),
  create(name, description, owner) {
    name = clean(name, 30); if (name.length < 2) throw new Error('Group name needs 2-30 characters');
    const l = read(); if (l.some(g => g.name.toLowerCase() === name.toLowerCase())) throw new Error('A group with that name already exists');
    const g = { id: 'grp_' + Math.random().toString(36).slice(2, 10), code: Math.random().toString(36).slice(2, 8).toUpperCase(), name, description: clean(description, 120), owner: owner || 'you', members: 1, joined: true, createdAt: Date.now() };
    l.push(g); write(l); return g;
  },
  /** Join by invite code or exact name. */
  join(codeOrName) {
    const q = clean(codeOrName, 30).toLowerCase(); if (!q) throw new Error('Enter an invite code or group name');
    const l = read(); const g = l.find(x => x.code.toLowerCase() === q || x.name.toLowerCase() === q);
    if (!g) throw new Error('No group with that code or name on this device yet');
    if (g.joined) throw new Error('You are already in that group');
    g.joined = true; g.members = (g.members || 0) + 1; write(l); return g;
  },
  leave(id) { const l = read(); const g = l.find(x => x.id === id); if (!g) return; g.joined = false; g.members = Math.max(0, (g.members || 1) - 1); write(l); },
  remove(id) { write(read().filter(g => g.id !== id)); },
};
