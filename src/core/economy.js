// Economy: wallet, rewards, purchases, inventory/equip state.
// All persistence goes through the backend; UI listens on the bus.
//
// Two modes, same synchronous API for callers (earn/spend/buy/equip/... unchanged):
//  * Guest: LocalBackend only (localStorage), exactly as before.
//  * Signed in: connect(remote) attaches a SupabaseBackend. Every change is applied
//    optimistically to the local balance and sent to the server in order; each
//    server reply carries the authoritative balance, so the shown balance is
//    `server balance + still-unconfirmed local deltas`. Server caps/rejections
//    therefore self-correct the UI. See docs/ECONOMY_API.md.
import { bus } from './events.js';
import { COSMETIC_BY_ID } from '../data/cosmetics.js';
import { demoBucksAllowed } from '../net/config.js';
import { isPlus } from './plus.js';

export const REWARDS = {
  coinPickup: 5,
  blockPlaced: 1,
  blockDailyCap: 50,
  dailyBonus: 100,
};

const today = () => new Date().toISOString().slice(0, 10);   // UTC day, same as the server
const newRef = () => (globalThis.crypto?.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);

/** Map the free-form reasons games pass to earn() onto server earning sources (caps). */
export function earnSource(reason = '') {
  if (reason === 'Pickup') return 'coin';
  if (reason === 'Building') return 'build';
  if (/obby complete/i.test(reason)) return 'obby_finish';
  if (/obby stage/i.test(reason)) return 'obby_stage';
  if (/^Reward in /.test(reason)) return 'custom_game';
  return 'other';
}

const LOADOUT_DEBOUNCE_MS = 600;
/** Event cosmetics (earnOnly / eventOnly / unlock: 'quest') are granted by quests and never sold. Same rule as the server sync. */
/** Limited-time shop item (Cosmetics' `event: '<id>'`): buyable only while that event is live. */
export const eventOfItem = (item) => (item && (item.event ?? item.eventId)) || null;
const EVENT_SALE_MSG = { event_not_started: 'On sale when the event starts', event_ended: 'This was a limited-time item: the event has ended', plus_only: 'Iceberg Plus members only' };
export const isGrantOnly = (item) => !!(item && (item.earnOnly || item.eventOnly || item.grantOnly || item.unlock === 'quest'));

export class Economy {
  /** Live Plus membership (core/plus.js); refreshed on 'plus:changed'. */
  get isPlus() { return isPlus(); }
  constructor(backend) {
    this.backend = backend;           // LocalBackend (always: local cache / guest storage)
    this.remote = null;               // SupabaseBackend once connect() succeeds
    this.profile = backend.loadProfile();
    this._queue = Promise.resolve();
    this._unconfirmed = 0;            // sum of optimistic coin deltas not yet answered by the server
    this._pending = 0;
    this._loadoutTimer = null;
    this._gameDataTimers = {};
    this._serverGears = {};           // gameId -> gear ids the SERVER says we own (authoritative when signed in)
    this._lastSpend = null;           // { op, amount } of a spend() in the current task (gear-purchase shim)
  }
  get coins() { return this.profile.coins; }
  get signedIn() { return !!this.remote; }
  /** Resolves when every queued server call has been answered. */
  flush() { return this._queue; }

  _save() { this.backend.saveProfile(this.profile); }
  _changed(delta, reason) {
    this._save();
    bus.emit('coins:changed', { coins: this.profile.coins, delta, reason });
  }

  // ---------- server plumbing ----------
  _enqueue(localDelta, call, { onResult, onFail } = {}) {
    if (!this.remote) return null;
    const op = { cancelled: false, localDelta };
    this._unconfirmed += localDelta; this._pending++;
    this._queue = this._queue.then(async () => {
      if (op.cancelled) { this._unconfirmed -= op.localDelta; this._pending--; return; }   // replaced by another op (see _adoptSpendForGear)
      let res = null, err = null;
      try { res = await call(this.remote); } catch (e) { err = e; }
      this._unconfirmed -= localDelta; this._pending--;
      if (err) {
        onFail?.(err);
        bus.emit('economy:error', { error: err.message || String(err) });
        // Network/server failure: undo the optimistic delta locally; a later reply/resync fixes the rest.
        if (localDelta) this._setCoins(this.profile.coins - localDelta, 'Sync failed');
        return;
      }
      onResult?.(res);
      if (res && typeof res.coins === 'number') this._setCoins(res.coins + this._unconfirmed, 'Server');
    });
    return op;
  }
  _setCoins(value, reason) {
    const v = Math.max(0, Math.floor(value));
    if (v === this.profile.coins) return;
    const delta = v - this.profile.coins;
    this.profile.coins = v;
    this._changed(delta, reason);
  }

  /** Attach a signed-in SupabaseBackend: first-login migration, then adopt the server profile. */
  async connect(remote) {
    const uid = remote.userId;
    let server = await remote.loadProfile();
    if (!server) throw new Error('No profile on the server for this account');
    let migration = null;
    if (!server.migrated) {
      const guest = this.backend.loadGuestProfile();
      const already = guest.migratedTo && guest.migratedTo !== uid;   // guest progress goes to ONE account only
      const payload = already ? {} : {
        coins: guest.coins, demoGranted: guest.demoGranted || 0, owned: guest.owned, equipped: guest.equipped,
        rocketColors: guest.rocketColors, cosmeticColors: guest.cosmeticColors || {}, gameData: guest.gameData || {},
      };
      migration = await remote.migrateLocalProfile(payload);
      if (migration?.profile) server = migration.profile;
      if (!already && migration?.ok) this.backend.saveGuestProfile({ ...guest, migratedTo: uid });
    }
    this.remote = remote;
    this.backend.useProfileKey('profile:' + uid);
    this._adopt(server);
    return { profile: this.profile, migration };
  }

  /** Re-read the authoritative profile (e.g. after errors or when the tab regains focus). */
  async resync() {
    if (!this.remote) return;
    await this._queue;
    this._adopt(await this.remote.loadProfile());
  }

  disconnect() {
    this.remote = null; this._unconfirmed = 0;
    this.backend.useProfileKey('profile');
    this._adopt(this.backend.loadProfile(), { local: true });
  }

  _adopt(p, { local = false } = {}) {
    const keep = local ? {} : { demoGranted: 0 };
    this.profile = {
      ...this.backend.loadProfile(), ...p, ...keep,
      owned: [...(p.owned || [])], equipped: { ...(p.equipped || {}) },
      rocketColors: { ...(this.profile.rocketColors || {}), ...(p.rocketColors || {}) },
      cosmeticColors: { ...(p.cosmeticColors || {}) }, gameData: local ? { ...(p.gameData || {}) } : this._withServerGears(p.gameData || {}),
      lastDailyBonus: p.lastDailyBonus ? String(p.lastDailyBonus).slice(0, 10) : null,
    };
    this._save();
    bus.emit('coins:changed', { coins: this.profile.coins, delta: 0, reason: 'Sync' });
    bus.emit('inventory:changed', this.profile);
    bus.emit('rocket:colors', this.profile.rocketColors);
    bus.emit('cosmetic:colors', this.profile.cosmeticColors);
    bus.emit('profile:synced', this.profile);
  }

  // ---------- wallet ----------
  earn(amount, reason, { source } = {}) {
    if (!(amount > 0)) return 0;
    this.profile.coins += amount;
    this._changed(amount, reason);
    const src = source || earnSource(reason);
    this._enqueue(amount, (r) => r.earn(src, amount, reason, newRef()), {
      onResult: (res) => { if (res?.capped) bus.emit('economy:capped', { source: src, reason, granted: res.granted, requested: amount }); },
    });
    return amount;
  }

  spend(amount, reason = 'Spent') {
    if (!(amount > 0) || this.profile.coins < amount) return false;
    this.profile.coins -= amount;
    this._save(); bus.emit('coins:changed', { coins: this.profile.coins, delta: -amount, reason });
    const op = this._enqueue(-amount, (r) => r.spend(amount, reason, newRef()), {
      onResult: (res) => { if (res && !res.ok) bus.emit('economy:rejected', { action: 'spend', amount, reason: res.reason }); },
    });
    if (op) { this._lastSpend = { op, amount }; queueMicrotask(() => { if (this._lastSpend?.op === op) this._lastSpend = null; }); }
    return true;
  }

  claimDailyBonus() {
    if (this.profile.lastDailyBonus === today()) return 0;
    this.profile.lastDailyBonus = today();
    if (!this.remote) return this.earn(REWARDS.dailyBonus, 'Daily bonus');
    this.profile.coins += REWARDS.dailyBonus;
    this._changed(REWARDS.dailyBonus, 'Daily bonus');
    this._enqueue(REWARDS.dailyBonus, (r) => r.claimDailyBonus());
    return REWARDS.dailyBonus;
  }

  rewardBlockPlaced() {
    const d = today();
    if (this.profile.buildRewardDay !== d) { this.profile.buildRewardDay = d; this.profile.buildRewardToday = 0; }
    if (this.profile.buildRewardToday >= REWARDS.blockDailyCap) return 0;
    this.profile.buildRewardToday += REWARDS.blockPlaced;
    return this.earn(REWARDS.blockPlaced, 'Building');
  }
  buildRewardRemaining() {
    if (this.profile.buildRewardDay !== today()) return REWARDS.blockDailyCap;
    return Math.max(0, REWARDS.blockDailyCap - this.profile.buildRewardToday);
  }

  // ---------- inventory ----------
  owns(id) { return this.profile.owned.includes(id); }
  isEquipped(id) {
    const item = COSMETIC_BY_ID[id];
    return !!item && this.profile.equipped[item.slot] === id;
  }

  buy(id) {
    const item = COSMETIC_BY_ID[id];
    if (!item) return { ok: false, reason: 'Unknown item' };
    if (isGrantOnly(item)) return { ok: false, reason: item.event === 'natural_disasters' ? 'Earn this in the Natural Disasters event' : item.earnIn ? `Earn this in ${item.earnIn}` : 'Earn this in the event' };
    if (!this.owns(id)) {                                        // owned copies are kept forever; only new sales are gated
      const av = this.itemAvailability(id);
      if (!av.forSale) return { ok: false, reason: EVENT_SALE_MSG[av.state] || 'Not for sale', code: av.state };
    }
    if (!this.remote) {
      const res = this.backend.purchase(this.profile, item);
      if (res.ok) {
        bus.emit('coins:changed', { coins: this.profile.coins, delta: -item.price, reason: `Bought ${item.name}` });
        bus.emit('inventory:changed', this.profile);
      }
      return res;
    }
    if (this.owns(id)) return { ok: false, reason: 'Already owned' };
    if (this.profile.coins < item.price) return { ok: false, reason: 'Not enough coins' };
    // optimistic: the server re-prices from its own catalog and may refuse
    this.profile.coins -= item.price;
    this.profile.owned.push(id);
    this._save();
    bus.emit('coins:changed', { coins: this.profile.coins, delta: -item.price, reason: `Bought ${item.name}` });
    bus.emit('inventory:changed', this.profile);
    const rollback = (why) => {
      this.profile.owned = this.profile.owned.filter(x => x !== id);
      for (const [slot, eq] of Object.entries(this.profile.equipped)) if (eq === id) delete this.profile.equipped[slot];
      this._save();
      bus.emit('inventory:changed', this.profile);
      bus.emit('economy:rejected', { action: 'buy', item: id, reason: why });
    };
    this._enqueue(-item.price, (r) => r.purchase(id), {
      onResult: (res) => { if (!res?.ok && res?.reason !== 'already_owned') rollback(res?.reason || 'rejected'); },
      onFail: () => rollback('network'),
    });
    return { ok: true, profile: this.profile, pending: true };
  }

  equip(id) {
    const item = COSMETIC_BY_ID[id];
    if (!item || !this.owns(id)) return false;
    this.profile.equipped[item.slot] = id;
    this._save();
    bus.emit('inventory:changed', this.profile);
    this._syncLoadout();
    return true;
  }
  unequip(id) {
    const item = COSMETIC_BY_ID[id];
    if (!item || this.profile.equipped[item.slot] !== id) return false;
    delete this.profile.equipped[item.slot];
    this._save();
    bus.emit('inventory:changed', this.profile);
    this._syncLoadout();
    return true;
  }

  /** DEV/DEMO ONLY: grants play-money Birg Bucks for testing. Not a purchase.
   *  Disabled in the production site build (VITE_ICEBERG_SITE=1) and for signed-in accounts. */
  demoGrant(amount) {
    if (!demoBucksAllowed() || this.remote) {
      bus.emit('toast', { text: 'Free demo Birg Bucks are not available here.', icon: '🚫' });
      return 0;
    }
    this.profile.demoGranted = (this.profile.demoGranted || 0) + amount;
    return this.earn(amount, 'Demo grant (dev)');
  }

  setRocketColor(part, color) {
    this.profile.rocketColors = { ...this.profile.rocketColors, [part]: color };
    this._save();
    bus.emit('rocket:colors', this.profile.rocketColors);
    this._syncLoadout();
  }

  /** Persist the chosen color of a customizable cosmetic (profile.cosmeticColors[id]). */
  setCosmeticColor(id, color) {
    this.profile.cosmeticColors = { ...(this.profile.cosmeticColors || {}), [id]: color };
    this._save();
    bus.emit('cosmetic:colors', this.profile.cosmeticColors);
    this._syncLoadout();
  }

  toggleEquip(id) { return this.isEquipped(id) ? this.unequip(id) : this.equip(id); }

  // ---------- per-game save data + gears ----------
  // Server rule: save blobs are never trusted for Birg Bucks or gear ownership. When
  // signed in, gameData[gameId].gears always mirrors the server's game_gears rows.
  _withServerGears(gameData) {
    this._serverGears = {};
    const out = {};
    for (const [id, data] of Object.entries(gameData)) {
      const gears = Array.isArray(data?.gears) ? data.gears : [];
      this._serverGears[id] = [...gears];
      out[id] = { ...(data || {}), gears: [...gears] };
    }
    return out;
  }

  /** Cached (synchronous) save data for a game, or null. */
  cachedGameData(gameId) { return this.profile.gameData?.[gameId] ?? null; }

  /** Load a game's save data. Returns a Promise; `promise.cached` holds the local value right away. */
  loadGameData(gameId) {
    const cached = this.cachedGameData(gameId);
    let p;
    if (!this.remote) p = Promise.resolve(this.backend.loadGameData?.(gameId) ?? cached);
    else {
      p = this._queue.then(() => this.remote.loadGameData(gameId)).then((data) => {
        const gears = Array.isArray(data?.gears) ? data.gears : [];
        this._serverGears[gameId] = [...gears];
        this.profile.gameData = { ...(this.profile.gameData || {}), [gameId]: { ...(data || {}), gears } };
        this._save();
        return this.profile.gameData[gameId];
      }).catch(() => cached);
    }
    p.cached = cached;
    return p;
  }

  /** Save a game's data (never money / gear ownership). Returns a Promise. */
  saveGameData(gameId, data) {
    const prev = this.profile.gameData?.[gameId];
    this.profile.gameData = { ...(this.profile.gameData || {}), [gameId]: data };
    this._save();
    if (!this.remote) { this.backend.saveGameData?.(gameId, data); return Promise.resolve({ ok: true, local: true }); }
    this._adoptSpendForGear(gameId, data);
    clearTimeout(this._gameDataTimers[gameId]?.t);
    return new Promise((resolveSave) => {
      const t = setTimeout(() => {
        const { gears, ...blob } = this.profile.gameData[gameId] || {};
        this._enqueue(0, (r) => r.saveGameData(gameId, blob), { onResult: resolveSave, onFail: (e) => resolveSave({ ok: false, reason: e.message }) });
      }, LOADOUT_DEBOUNCE_MS);
      this._gameDataTimers[gameId] = { t };
    });
  }

  /** Gears bought in a game work only in that game (server: owns_gear(game_id, gear_id)). */
  ownsGear(gameId, gearId) {
    if (this.remote) return (this._serverGears[gameId] || []).includes(gearId);
    return (this.cachedGameData(gameId)?.gears || []).includes(gearId);
  }

  /** Buy a gear for one game. The server prices it from its gear table (synced from the game's config). */
  buyGear(gameId, gearId, price) {
    if (this.ownsGear(gameId, gearId)) return { ok: false, reason: 'Already owned' };
    if (!(price >= 0) || this.profile.coins < price) return { ok: false, reason: 'Not enough coins' };
    const data = { ...(this.cachedGameData(gameId) || {}) };
    data.gears = [...(data.gears || []), gearId];
    this.profile.coins -= price;
    this.profile.gameData = { ...(this.profile.gameData || {}), [gameId]: data };
    this._changed(-price, `Gear ${gearId}`);
    if (!this.remote) { this.backend.saveGameData?.(gameId, data); return { ok: true }; }
    this._queueGearBuy(gameId, gearId, -price);
    return { ok: true, pending: true };
  }

  _queueGearBuy(gameId, gearId, localDelta) {
    const pending = (this._pendingGears ||= new Set()); pending.add(gameId + '/' + gearId);
    const drop = (why) => {
      const d = this.profile.gameData?.[gameId];
      if (d?.gears) { this.profile.gameData[gameId] = { ...d, gears: d.gears.filter(g => this._serverGears[gameId]?.includes(g)) }; this._save(); }
      bus.emit('economy:rejected', { action: 'gear', gameId, gearId, reason: why });
    };
    this._enqueue(localDelta, (r) => r.buyGear(gameId, gearId), {
      onResult: (res) => {
        pending.delete(gameId + '/' + gearId);
        if (Array.isArray(res?.gears)) this._serverGears[gameId] = [...res.gears];
        if (!res?.ok && res?.reason !== 'already_owned') drop(res?.reason || 'rejected');
      },
      onFail: (e) => { pending.delete(gameId + '/' + gearId); drop('network'); },
    });
  }

  // Compatibility shim for games that buy gear as `spend(price)` + saveGameData({gears:[...new]})
  // in the same task (Giant Rainbow Obby today): the plain spend is cancelled before it is
  // sent and replaced by buy_gear, so the server records ownership and charges its own price.
  // A gear that shows up in save data WITHOUT a matching purchase is simply not owned server-side.
  _adoptSpendForGear(gameId, data) {
    const known = this._serverGears[gameId] || [];
    const pending = this._pendingGears || new Set();
    const fresh = (Array.isArray(data?.gears) ? data.gears : []).filter(g => !known.includes(g) && !pending.has(gameId + '/' + g));
    for (const gearId of fresh) {
      const last = this._lastSpend;
      if (!last || last.op.cancelled) break;
      last.op.cancelled = true; this._unconfirmed -= last.op.localDelta; last.op.localDelta = 0; this._lastSpend = null;
      this._queueGearBuy(gameId, gearId, -last.amount);
    }
  }

  // ---------- quests (event cosmetics) + consumables ----------
  // Signed in: the server owns quest definitions, progress limits and the one-time reward grant.
  // Guest: a local-only equivalent (LocalBackend) using the same quest files; local event rewards
  // are NOT carried into an account by the first-login migration (the server refuses grant-only items).

  /** Add progress to a quest. Resolves { ok, added?, reason?, retryAfterMs?, quest }. */
  async questProgress(questId, delta = 1) {
    if (this.remote) {
      try { return await this.remote.questProgress(questId, delta); }
      catch (e) { return { ok: false, reason: 'network', error: e.message }; }
    }
    return this.backend.questProgress(questId, delta);
  }
  /** Live quests (optionally for one game) with my progress: [{id, gameId, title, goal, progress, completed, claimed, itemId}]. */
  async getQuests(gameId = null) {
    if (this.remote) { try { return await this.remote.getQuests(gameId) || []; } catch { return []; } }
    return this.backend.getQuests(gameId);
  }
  /** Event window from the server ({ eventId, title, startsAt, endsAt, claimUntil, active, serverNow }); guests: local window. */
  async eventStatus(eventId) {
    if (this.remote) {
      try {
        const st = await this.remote.eventStatus(eventId);
        if (st && !st.error) {
          const prev = this._evCache?.[eventId];
          (this._evCache ||= {})[eventId] = { status: st, at: Date.now(), offset: (Date.parse(st.serverNow) || Date.now()) - Date.now() };
          if (!prev) bus.emit('shop:availability', { eventId });     // shop can re-render 'Limited time' badges
        }
        return st;
      } catch (e) { return { eventId, active: false, error: 'network', serverNow: new Date().toISOString() }; }
    }
    return this.backend.eventStatus(eventId);
  }
  /**
   * Shop availability of a cosmetic (sync; signed-in uses the last event_status, refreshed every 60 s in the background).
   * -> { forSale, limited, eventId?, state?: 'live'|'event_not_started'|'event_ended'|'unknown', startsAt?, endsAt?, msLeft? }
   * Limited items (Cosmetics' `event: '<id>'`, not earnOnly) are sold only while the event is live (no grace); the
   * server's buy_cosmetic enforces the same rule and refuses with reason 'event_not_started' / 'event_ended'.
   * Before the first fetch returns, state is 'unknown' and a buy goes to the server, which decides.
   */
  itemAvailability(id, now = Date.now()) {
    const item = COSMETIC_BY_ID[id], ev = eventOfItem(item);
    if (!item) return { forSale: false, limited: false, state: 'unknown_item' };
    // Iceberg Plus perks (wh_plus_* / plusOnly): listed only for Plus members (core/plus.js isPlus(): server plus_status
    // when signed in, demo flag for guests). Client visibility only; server buy_cosmetic still enforces is_plus().
    if ((item.plusOnly ?? id.startsWith('wh_plus_')) && !this.isPlus) return { forSale: false, limited: !!ev, eventId: ev || undefined, state: 'plus_only', hidden: true };
    if (!ev) return isGrantOnly(item) ? { forSale: false, limited: false, state: 'not_for_sale' } : { forSale: true, limited: false };
    let st, t = now;
    if (!this.remote) st = this.backend.eventStatus(ev, now);
    else {
      const c = this._evCache?.[ev];
      if (!c || now - c.at > 60000) { if (!this._evPending?.[ev]) { (this._evPending ||= {})[ev] = this.eventStatus(ev).finally(() => { delete this._evPending[ev]; }); } }
      if (!c) return { forSale: !isGrantOnly(item), limited: true, eventId: ev, state: 'unknown', hidden: true };
      st = c.status; t = now + c.offset;
    }
    const s0 = st.startsAt ? Date.parse(st.startsAt) : null, e0 = st.endsAt ? Date.parse(st.endsAt) : null;
    const evState = e0 != null && t >= e0 ? 'event_ended' : (s0 == null || t < s0) ? 'event_not_started' : st.active === false ? 'event_ended' : 'live';
    const hidden = evState === 'event_not_started';                    // unscheduled / not started: not shown in the shop at all
    if (isGrantOnly(item)) return { forSale: false, limited: true, eventId: ev, state: 'not_for_sale', eventState: evState, hidden };
    return { forSale: evState === 'live', limited: true, eventId: ev, state: evState, eventState: evState, hidden, startsAt: st.startsAt || null, endsAt: st.endsAt || null,
      msLeft: evState === 'live' && e0 != null ? e0 - t : null };
  }
  /** Shop listing rule: event items (sold or quest-earned) stay hidden until their event has started; owned items always show. */
  shopVisible(id, now = Date.now()) {
    if (this.owns(id)) return true;
    return !this.itemAvailability(id, now).hidden;
  }
  /** Grant the quest's reward cosmetic once. Resolves { granted, itemId, alreadyClaimed?, reason? }. */
  async claimQuestReward(questId) {
    let res;
    if (this.remote) {
      try { res = await this.remote.claimQuestReward(questId); } catch (e) { return { granted: false, reason: 'network', error: e.message }; }
      if (res?.granted || res?.alreadyClaimed) {
        if (res.itemId && !this.profile.owned.includes(res.itemId)) { this.profile.owned.push(res.itemId); this._save(); bus.emit('inventory:changed', this.profile); }
      }
    } else {
      res = this.backend.claimQuestReward(questId);
      if (res.granted) { this.profile = this.backend.loadProfile(); bus.emit('inventory:changed', this.profile); }
    }
    if (res?.granted) bus.emit('quest:reward', { questId, itemId: res.itemId });
    return { granted: !!res?.granted, itemId: res?.itemId ?? null, alreadyClaimed: !!res?.alreadyClaimed, ...(res?.reason ? { reason: res.reason } : {}) };
  }
  /** Pay for a one-use item (e.g. Apple heal) priced by the server from the game's CONSUMABLE_PRICES_BB.
   *  Resolves { ok, coins?, reason? }. Use the item only when ok. `price` is the client's copy for the optimistic balance. */
  async buyConsumable(gameId, itemId, price, ref = newRef()) {
    if (!(price >= 0) || this.profile.coins < price) return { ok: false, reason: 'Not enough coins' };
    if (!this.remote) {
      this.profile.coins -= price; this._changed(-price, `Used ${itemId}`);
      return { ok: true, coins: this.profile.coins, local: true };
    }
    this.profile.coins -= price; this._changed(-price, `Used ${itemId}`);
    return new Promise((ok) => {
      this._enqueue(-price, (r) => r.buyConsumable(gameId, itemId, ref), {
        onResult: (res) => ok(res?.ok ? { ok: true, coins: res.coins, price: res.price } : { ok: false, reason: res?.reason || 'rejected' }),
        onFail: (e) => ok({ ok: false, reason: 'network', error: e.message }),
      });
    });
  }

  // equipped + rocketColors + cosmeticColors -> server (debounced; server re-validates ownership/colors)
  _syncLoadout() {
    if (!this.remote) return;
    clearTimeout(this._loadoutTimer);
    this._loadoutTimer = setTimeout(() => this.syncLoadoutNow(), LOADOUT_DEBOUNCE_MS);
  }
  syncLoadoutNow() {
    if (!this.remote) return Promise.resolve();
    clearTimeout(this._loadoutTimer);
    const { equipped, rocketColors, cosmeticColors } = this.profile;
    this._enqueue(0, (r) => r.saveLoadout({ equipped, rocketColors, cosmeticColors: cosmeticColors || {} }));
    return this._queue;
  }
}
