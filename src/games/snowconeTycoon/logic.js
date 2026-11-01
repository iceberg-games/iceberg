// Snowcone Tycoon: pure shift rules (no Three.js / DOM). Events are queued
// and drained by index.js for sound, particles and UI.
import { DAYS, FLAVORS, TOPPING_ORDER, ICE_FILL_TIME, POUR_TIME, BASE_PRICE, TOPPING_PRICE, TIP_RATE, STRIKES } from './config.js';

export function mulberry(a) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

export const emptyCone = () => ({ ice: 0, syrup: null, topping: null });
export const coneReady = (c) => !!c && c.ice >= 1 && !!c.syrup;
export function matches(cone, order) { return coneReady(cone) && cone.syrup === order.syrup && (cone.topping || null) === (order.topping || null); }
export const priceOf = (order) => BASE_PRICE + (order.topping ? TOPPING_PRICE : 0);

export class Shift {
  constructor(day, mods, { rng = Math.random } = {}) {
    this.day = typeof day === 'number' ? DAYS[day - 1] : day;
    this.mods = mods; this.rng = rng;
    this.time = 0; this.score = 0; this.coins = 0; this.served = 0; this.lost = 0; this.strikes = 0; this.combo = 0; this.bestCombo = 0;
    this.customers = []; this.nextId = 1; this.spawnT = 1.5; this.closing = false; this.over = false; this.failed = false;
    this.cone = null; this.events = [];
  }
  get left() { return Math.max(0, this.day.length - this.time); }
  emit(e) { this.events.push(e); }
  drain() { const e = this.events; this.events = []; return e; }
  freeSlot() { for (let s = 0; s < this.mods.slots; s++) if (!this.customers.some(c => c.slot === s && c.phase !== 'gone')) return s; return -1; }
  spawn() {
    const slot = this.freeSlot(); if (slot < 0) return false;
    const fl = this.day.flavors, r = this.rng;
    const order = { syrup: fl[Math.floor(r() * fl.length)], topping: r() < this.day.toppingChance ? TOPPING_ORDER[Math.floor(r() * TOPPING_ORDER.length)] : null };
    const patience = this.day.patience * this.mods.patience * (order.topping ? 1.1 : 1);
    const c = { id: this.nextId++, slot, order, patience, maxPatience: patience, phase: 'walk', walkT: 0, walkDur: this.mods.walk || 2.2, leaveDur: this.mods.leave || 3, seed: Math.floor(r() * 1e9) };
    this.customers.push(c); this.emit({ type: 'arrive', c });
    return true;
  }
  update(dt) {
    if (this.over) return;
    this.time += dt;
    if (!this.closing && this.time >= this.day.length) { this.closing = true; this.emit({ type: 'closing' }); }
    if (!this.closing) {
      this.spawnT -= dt;
      if (this.spawnT <= 0) { const [a, b] = this.day.spawn; this.spawnT = a + this.rng() * (b - a); if (!this.spawn()) this.spawnT = 1.2; }
    }
    for (const c of this.customers) {
      if (c.phase === 'walk') { c.walkT += dt; if (c.walkT >= c.walkDur) { c.phase = 'wait'; this.emit({ type: 'order', c }); } }
      else if (c.phase === 'wait') {
        c.patience -= dt;
        if (c.patience <= 0) { c.phase = 'leave'; c.mood = 'angry'; c.leaveT = 0; this.lost++; this.strikes++; this.combo = 0; this.emit({ type: 'timeout', c, strikes: this.strikes }); if (this.strikes >= STRIKES) { this.failed = true; this.closing = true; } }
      } else if (c.phase === 'leave') { c.leaveT += dt; if (c.leaveT > c.leaveDur) c.phase = 'gone'; }
    }
    this.customers = this.customers.filter(c => c.phase !== 'gone');
    if (this.closing && !this.customers.some(c => c.phase === 'wait' || c.phase === 'walk')) {
      if (this.failed || !this.customers.length || this.time > this.day.length + 4) { this.over = true; this.emit({ type: 'end' }); }
    }
  }
  // ----- station actions (index.js decides which station the player is at) -----
  /** Hold USE at the shaver: progress the ice. Returns true while shaving. */
  shave(dt) {
    if (!this.cone) { this.cone = emptyCone(); this.emit({ type: 'grab' }); }
    if (this.cone.ice >= 1) return false;
    if (this.cone.syrup) { this.emit({ type: 'deny', why: 'Syrup is already on — trash it to start over' }); return false; }
    const was = this.cone.ice; this.cone.ice = Math.min(1, this.cone.ice + dt * this.mods.shave / ICE_FILL_TIME);
    if (was < 1 && this.cone.ice >= 1) this.emit({ type: 'iceFull' });
    return true;
  }
  /** Tap USE at a syrup bottle. Returns pour duration (0 = instant) or -1 if refused. */
  pour(flavor) {
    if (!FLAVORS[flavor] || !this.day.flavors.includes(flavor)) { this.emit({ type: 'deny', why: 'That syrup is not on today\'s menu' }); return -1; }
    if (!this.cone || this.cone.ice < 1) { this.emit({ type: 'deny', why: 'Shave a full cone of ice first' }); return -1; }
    if (this.cone.syrup) { this.emit({ type: 'deny', why: 'Already has syrup — serve it or trash it' }); return -1; }
    this.cone.syrup = flavor; this.emit({ type: 'pour', flavor });
    return this.mods.instantPour ? 0 : POUR_TIME;
  }
  top(topping) {
    if (!this.day.toppingChance) { this.emit({ type: 'deny', why: 'Topping bar opens on Day 2' }); return false; }
    if (!coneReady(this.cone)) { this.emit({ type: 'deny', why: 'Add ice and syrup before toppings' }); return false; }
    if (this.cone.topping) { this.emit({ type: 'deny', why: 'One topping per cone' }); return false; }
    this.cone.topping = topping; this.emit({ type: 'top', topping }); return true;
  }
  trash() { if (!this.cone) return false; this.cone = null; this.combo = 0; this.emit({ type: 'trash' }); return true; }
  serve(id) {
    const c = this.customers.find(x => x.id === id && x.phase === 'wait'); if (!c) return false;
    if (!coneReady(this.cone)) { this.emit({ type: 'deny', why: 'Finish the snowcone first (ice + syrup)' }); return false; }
    if (!matches(this.cone, c.order)) { this.emit({ type: 'wrong', c }); c.patience = Math.max(0.5, c.patience - 4); return false; }
    const price = priceOf(c.order), pf = c.patience / c.maxPatience;
    this.combo++; this.bestCombo = Math.max(this.bestCombo, this.combo);
    const tip = Math.round(price * TIP_RATE * pf * this.mods.tips) + Math.min(4, Math.floor(this.combo / 3));
    this.score += price + tip; this.coins += price + tip; this.served++;
    c.phase = 'leave'; c.mood = pf > 0.5 ? 'happy' : 'ok'; c.leaveT = 0; this.cone = null;
    this.emit({ type: 'paid', c, value: price, tip, combo: this.combo });
    return true;
  }
}
