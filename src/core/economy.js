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

export class Economy {
  constructor(backend) {
    this.backend = backend;           // LocalBackend (always: local cache / guest storage)
    this.remote = null;               // SupabaseBackend once connect() succeeds
    this.profile = backend.loadProfile();
    this._queue = Promise.resolve();
    this._unconfirmed = 0;            // sum of optimistic coin deltas not yet answered by the server
    this._pending = 0;
    this._loadoutTimer = null;
    this._gameDataTimers = {};
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
    if (!this.remote) return;
    this._unconfirmed += localDelta; this._pending++;
    this._queue = this._queue.then(async () => {
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
      cosmeticColors: { ...(p.cosmeticColors || {}) }, gameData: { ...(p.gameData || {}) },
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
    this._enqueue(-amount, (r) => r.spend(amount, reason, newRef()), {
      onResult: (res) => { if (res && !res.ok) bus.emit('economy:rejected', { action: 'spend', amount, reason: res.reason }); },
    });
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

  /** Per-game save blob (used by games such as Giant Rainbow Obby). Never money. */
  saveGameData(gameId, data) {
    this.profile.gameData = { ...(this.profile.gameData || {}), [gameId]: data };
    this._save();
    if (!this.remote) return;
    clearTimeout(this._gameDataTimers[gameId]);
    this._gameDataTimers[gameId] = setTimeout(() => this._enqueue(0, (r) => r.saveGameData(gameId, this.profile.gameData[gameId])), LOADOUT_DEBOUNCE_MS);
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
