// LocalBackend: the ONLY module that touches persistence.
//
// Every read/write of player data goes through this interface. Today it is
// backed by localStorage; later a RemoteBackend (REST/WebSocket) can implement
// the same methods so the server becomes authoritative for coins, purchases
// and builds. Methods are synchronous here for simplicity; a remote version
// would return Promises and the callers (Economy, Building) already funnel
// all mutations through a handful of calls, so the change is contained.

import { questDefs } from '../core/questDefs.js';

const LOCAL_EVENT_DAYS = 7;                 // offline event length when the quest files give no dates
const LOCAL_CLAIM_GRACE_MS = 24 * 3600e3;  // same default as game_events.claim_grace

const NS = 'iceberg:v1:';

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(NS + key);
    return raw == null ? fallback : JSON.parse(raw);
  } catch { return fallback; }
}
function write(key, value) {
  try { localStorage.setItem(NS + key, JSON.stringify(value)); } catch { /* quota / private mode */ }
}

export const DEFAULT_PROFILE = {
  playerId: 'local-player',
  displayName: 'Player',
  coins: 0,             // Birg Bucks (BB). Starting balance is 0.
  owned: [],            // cosmetic ids
  equipped: {},         // slot -> cosmetic id
  lastDailyBonus: null, // 'YYYY-MM-DD'
  buildRewardDay: null,
  buildRewardToday: 0,
  rocketColors: { body: '#e8f4ff', fins: '#3f8fd0', trim: '#7fe3ff' },
  cosmeticColors: {},   // customizable cosmetic id -> hex color (e.g. earmuffs)
  demoGranted: 0,       // Birg Bucks granted via the DEV demo toggle (tracked separately)
};

export class LocalBackend {
  constructor() { this.profileKey = 'profile'; }
  // ---- profile / wallet ----
  // Guests use key 'profile'. When signed in, core/economy.js switches to
  // 'profile:<userId>' so the server copy is cached separately from guest progress.
  loadProfile() { return { ...DEFAULT_PROFILE, ...read(this.profileKey, {}) }; }
  saveProfile(profile) { write(this.profileKey, profile); }
  useProfileKey(key) { this.profileKey = key || 'profile'; }
  // ---- per-game save data (profile.gameData[gameId]) ----
  loadGameData(gameId) { return (this.loadProfile().gameData || {})[gameId] ?? null; }
  saveGameData(gameId, data) {
    const p = this.loadProfile();
    p.gameData = { ...(p.gameData || {}), [gameId]: data };
    this.saveProfile(p);
  }
  loadGuestProfile() { return { ...DEFAULT_PROFILE, ...read('profile', {}) }; }
  saveGuestProfile(profile) { write('profile', profile); }

  /**
   * Server-authoritative purchase hook. A real backend would validate the
   * price from its own catalog, debit the wallet, and record the receipt.
   */
  purchase(profile, item) {
    if (profile.owned.includes(item.id)) return { ok: false, reason: 'Already owned' };
    if (profile.coins < item.price) return { ok: false, reason: 'Not enough coins' };
    profile.coins -= item.price;
    profile.owned.push(item.id);
    this.saveProfile(profile);
    return { ok: true, profile };
  }

  // ---- events + quests (guest / offline only: a local mirror of the server rules, nothing leaves the device) ----
  // Local event window: from the event's QUESTS startsAt/endsAt when given, else an active 7-day window
  // from this device's first run. Same shape as the server's event_status().
  eventStatus(eventId, now = Date.now()) {
    const ev = read('events', {});
    if (!ev[eventId]) { ev[eventId] = { firstRun: now }; write('events', ev); }
    const qs = questDefs().filter(q => q.eventId === eventId);
    const starts = qs.map(q => q.startsAt && Date.parse(q.startsAt)).filter(Number.isFinite);
    const ends = qs.map(q => q.endsAt && Date.parse(q.endsAt)).filter(Number.isFinite);
    const s0 = starts.length ? Math.min(...starts) : ev[eventId].firstRun;
    const e0 = ends.length ? Math.max(...ends) : s0 + LOCAL_EVENT_DAYS * 86400e3;
    return { eventId, title: qs[0]?.eventTitle || null, startsAt: new Date(s0).toISOString(), endsAt: new Date(e0).toISOString(),
      claimUntil: new Date(e0 + LOCAL_CLAIM_GRACE_MS).toISOString(), active: now >= s0 && now < e0, serverNow: new Date(now).toISOString(), local: true };
  }
  /** Effective window: the quest's own dates narrowed by its event's (same rule as the server's _quest_eff). */
  _questEff(q, now = Date.now()) {
    let s0 = q.startsAt ? Date.parse(q.startsAt) : null, e0 = q.endsAt ? Date.parse(q.endsAt) : null, until = null;
    if (q.eventId) {
      const ev = this.eventStatus(q.eventId, now), es = Date.parse(ev.startsAt), ee = Date.parse(ev.endsAt);
      s0 = s0 == null ? es : Math.max(s0, es); e0 = e0 == null ? ee : Math.min(e0, ee); until = e0 + LOCAL_CLAIM_GRACE_MS;
    }
    const state = s0 != null && now < s0 ? 'not_started' : e0 != null && now >= e0 ? 'ended' : 'live';
    return { state, startsAt: s0 == null ? null : new Date(s0).toISOString(), endsAt: e0 == null ? null : new Date(e0).toISOString(),
      claimUntil: until == null ? null : new Date(until).toISOString(), claimable: until == null || now < until };
  }
  _questRow(id) { const all = read('quests', {}); return [all, all[id] || { count: 0 }]; }
  _questView(q, r = {}, now = Date.now()) {
    const progress = Math.min(r.count || 0, q.goal), w = this._questEff(q, now);
    return { id: q.id, gameId: q.gameId, title: q.title, description: q.description, goal: q.goal, progress, completed: progress >= q.goal,
      claimed: !!r.claimedAt, itemId: q.itemId, eventId: q.eventId, startsAt: w.startsAt, endsAt: w.endsAt, claimUntil: w.claimUntil,
      live: w.state === 'live', local: true, _w: w };
  }
  questProgress(questId, delta = 1, now = Date.now()) {
    const q = questDefs().find(x => x.id === questId);
    if (!q) return { ok: false, reason: 'unknown_quest' };
    const w = this._questEff(q, now);
    if (w.state !== 'live') return { ok: false, reason: !q.eventId ? 'not_live' : w.state === 'not_started' ? 'event_not_started' : 'event_ended' };
    delta = Math.trunc(delta);
    if (!(delta >= 1) || delta > q.maxPerCall) return { ok: false, reason: 'invalid_delta' };
    const [all, r] = this._questRow(questId);
    if (r.count >= q.goal) return { ok: true, added: 0, quest: this._view(q, r, now) };
    if (r.lastAt && now - r.lastAt < q.minIntervalMs) return { ok: false, reason: 'too_fast', retryAfterMs: q.minIntervalMs - (now - r.lastAt) };
    if (!r.hourStart || now - r.hourStart >= 3600e3) { r.hourStart = now; r.hourCount = 0; }
    if (!r.minStart || now - r.minStart >= 60e3) { r.minStart = now; r.minCount = 0; }
    if (q.maxPerMinute && r.minCount >= q.maxPerMinute) return { ok: false, reason: 'too_fast', retryAfterMs: 60e3 - (now - r.minStart) };
    const added = Math.min(delta, q.goal - r.count, q.maxPerHour - (r.hourCount || 0), q.maxPerMinute ? q.maxPerMinute - r.minCount : delta);
    if (added <= 0) return { ok: false, reason: 'hourly_cap' };
    r.count += added; r.hourCount = (r.hourCount || 0) + added; r.minCount = (r.minCount || 0) + added; r.lastAt = now;
    if (r.count >= q.goal) r.completedAt = now;
    all[questId] = r; write('quests', all);
    return { ok: true, added, quest: this._view(q, r, now) };
  }
  _view(q, r, now) { const { _w, ...v } = this._questView(q, r, now); return v; }
  getQuests(gameId = null, now = Date.now()) {
    const all = read('quests', {});
    return questDefs().filter(q => (!gameId || q.gameId === gameId))
      .map(q => this._questView(q, all[q.id], now))
      .filter(v => v._w.state !== 'ended' || (v.completed && !v.claimed && v._w.claimable))
      .map(({ _w, ...v }) => v);
  }
  claimQuestReward(questId, now = Date.now()) {
    const q = questDefs().find(x => x.id === questId);
    if (!q) return { granted: false, reason: 'unknown_quest' };
    const [all, r] = this._questRow(questId);
    if (r.claimedAt) return { granted: false, alreadyClaimed: true, itemId: q.itemId };
    if (!this._questEff(q, now).claimable) return { granted: false, reason: 'event_ended', itemId: q.itemId };
    if ((r.count || 0) < q.goal) return { granted: false, reason: 'not_complete', itemId: q.itemId, progress: r.count || 0, goal: q.goal };
    const p = this.loadProfile();
    if (q.itemId && !p.owned.includes(q.itemId)) p.owned.push(q.itemId);
    this.saveProfile(p);
    r.claimedAt = now; all[questId] = r; write('quests', all);
    return { granted: true, alreadyClaimed: false, itemId: q.itemId };
  }

  // ---- world / builds ----
  loadBuild() { return read('build', []); }       // [[x,y,z,typeId], ...]
  saveBuild(blocks) { write('build', blocks); }

  resetAll() {
    Object.keys(localStorage).filter(k => k.startsWith(NS)).forEach(k => localStorage.removeItem(k));
  }
}

export const backend = new LocalBackend();

// ---- IndexedDB store for uploaded 3D models (binary files are too big for localStorage) ----
const DB_NAME = 'iceberg-models';
const STORE = 'models';
function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function tx(mode, fn) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const store = t.objectStore(STORE);
    const out = fn(store);
    t.oncomplete = () => resolve(out && 'result' in out ? out.result : undefined);
    t.onerror = () => reject(t.error);
  });
}
export const modelStore = {
  /** record: { id, name, format: 'glb'|'gltf'|'obj', data: ArrayBuffer|string, createdAt } */
  put: (record) => tx('readwrite', s => s.put(record)),
  getAll: () => tx('readonly', s => s.getAll()),
  delete: (id) => tx('readwrite', s => s.delete(id)),
};
// Model placements / wear settings are small JSON -> localStorage
export const modelPrefs = {
  loadPlacements: () => read('modelPlacements', []), // [{modelId, x,y,z, rotY, scale}]
  savePlacements: (p) => write('modelPlacements', p),
  loadWear: () => read('modelWear', null),          // {modelId, scale, x, y, z, rotY, bone}
  saveWear: (w) => write('modelWear', w),
  loadSettings: () => read('settings', { musicVolume: 0.5, muted: false }),
  saveSettings: (s) => write('settings', s),
};

// ---- user-created games (JSON docs) ----
LocalBackend.prototype.loadCustomGames = function () { return read('customGames', []); };
LocalBackend.prototype.saveCustomGame = function (doc) {
  const list = read('customGames', []);
  const i = list.findIndex(g => g.id === doc.id);
  if (i >= 0) list[i] = doc; else list.push(doc);
  write('customGames', list);
};
LocalBackend.prototype.deleteCustomGame = function (id) { write('customGames', read('customGames', []).filter(g => g.id !== id)); };
