// Economy: wallet, rewards, purchases, inventory/equip state.
// All persistence goes through the backend; UI listens on the bus.
import { bus } from './events.js';
import { COSMETIC_BY_ID } from '../data/cosmetics.js';

export const REWARDS = {
  coinPickup: 5,
  blockPlaced: 1,
  blockDailyCap: 50,
  dailyBonus: 100,
};

const today = () => new Date().toISOString().slice(0, 10);

export class Economy {
  constructor(backend) {
    this.backend = backend;
    this.profile = backend.loadProfile();
  }
  get coins() { return this.profile.coins; }

  _save() { this.backend.saveProfile(this.profile); }
  _changed(delta, reason) {
    this._save();
    bus.emit('coins:changed', { coins: this.profile.coins, delta, reason });
  }

  earn(amount, reason) {
    if (amount <= 0) return 0;
    this.profile.coins += amount;
    this._changed(amount, reason);
    return amount;
  }

  spend(amount) {
    if (this.profile.coins < amount) return false;
    this.profile.coins -= amount;
    this._save(); bus.emit('coins:changed', { coins: this.profile.coins, delta: -amount, reason: 'Spent' });
    return true;
  }

  claimDailyBonus() {
    if (this.profile.lastDailyBonus === today()) return 0;
    this.profile.lastDailyBonus = today();
    return this.earn(REWARDS.dailyBonus, 'Daily bonus');
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

  owns(id) { return this.profile.owned.includes(id); }
  isEquipped(id) {
    const item = COSMETIC_BY_ID[id];
    return !!item && this.profile.equipped[item.slot] === id;
  }

  buy(id) {
    const item = COSMETIC_BY_ID[id];
    if (!item) return { ok: false, reason: 'Unknown item' };
    const res = this.backend.purchase(this.profile, item);
    if (res.ok) {
      bus.emit('coins:changed', { coins: this.profile.coins, delta: -item.price, reason: `Bought ${item.name}` });
      bus.emit('inventory:changed', this.profile);
    }
    return res;
  }

  equip(id) {
    const item = COSMETIC_BY_ID[id];
    if (!item || !this.owns(id)) return false;
    this.profile.equipped[item.slot] = id;
    this._save();
    bus.emit('inventory:changed', this.profile);
    return true;
  }
  unequip(id) {
    const item = COSMETIC_BY_ID[id];
    if (!item || this.profile.equipped[item.slot] !== id) return false;
    delete this.profile.equipped[item.slot];
    this._save();
    bus.emit('inventory:changed', this.profile);
    return true;
  }
  /** DEV/DEMO ONLY: grants play-money Birg Bucks for testing. Not a purchase. */
  demoGrant(amount) {
    this.profile.demoGranted = (this.profile.demoGranted || 0) + amount;
    return this.earn(amount, 'Demo grant (dev)');
  }

  setRocketColor(part, color) {
    this.profile.rocketColors = { ...this.profile.rocketColors, [part]: color };
    this._save();
    bus.emit('rocket:colors', this.profile.rocketColors);
  }

  /** Persist the chosen color of a customizable cosmetic (profile.cosmeticColors[id]). */
  setCosmeticColor(id, color) {
    this.profile.cosmeticColors = { ...(this.profile.cosmeticColors || {}), [id]: color };
    this._save();
    bus.emit('cosmetic:colors', this.profile.cosmeticColors);
  }

  toggleEquip(id) { return this.isEquipped(id) ? this.unequip(id) : this.equip(id); }
}
