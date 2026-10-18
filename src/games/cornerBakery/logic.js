// Corner Bakery Rush: pure game rules (no Three.js, no DOM), so they can be
// unit-tested in Node and drive both the 3D scene and the HUD.
//
//   const shift = new Shift(DAYS[0], { rng });
//   shift.update(dt);                 // timers, customers, cooking
//   shift.act(targetId, actionIndex)  // the player's button / key press
//   shift.events -> [{ type, ... }]   // drained by the presentation layer
import { ITEMS, COOK_TIME, BURN_AFTER, DISPLAY_STOCK, DISPLAY_RESTOCK_EVERY, HANDS, SLOTS, STRIKES, TIP_RATE } from './config.js';

export const WALK_IN = 4.2, WALK_OUT = 4.2; // seconds a customer spends walking in / out

export function mulberry(seed = 1) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/** Station layout ids (positions live in the scene module). */
export const STATION_IDS = ['ovenA', 'ovenB', 'fryer', 'frost', 'coffee', 'display', 'trash'];

export class Shift {
  constructor(day, { rng = Math.random } = {}) {
    this.day = day; this.rng = rng;
    this.time = 0; this.left = day.length; this.score = 0; this.tips = 0; this.served = 0; this.lost = 0; this.burnt = 0;
    this.strikes = 0; this.over = false; this.failed = false; this.closing = false;
    this.hands = [];
    this.customers = []; this.nextId = 1; this.events = [];
    this.spawnIn = 2.5;
    this.cakeQueue = [...(day.cakeAt || [])];
    const st = (id, kind, extra = {}) => ({ id, kind, state: 'idle', item: null, t: 0, cook: 0, ...extra });
    this.stations = {
      ovenA: st('ovenA', 'oven'), ovenB: st('ovenB', 'oven'),
      fryer: st('fryer', 'fryer', { locked: !day.fryer }),
      frost: st('frost', 'frost', { locked: !day.fryer }),
      coffee: st('coffee', 'coffee'),
      display: st('display', 'display', { stock: Object.fromEntries(day.display.map(i => [i, DISPLAY_STOCK])), restock: 0 }),
      trash: st('trash', 'trash'),
    };
  }
  emit(type, data = {}) { this.events.push({ type, ...data }); }
  drain() { const e = this.events; this.events = []; return e; }

  // ---------- customers ----------
  freeSlot() { for (let s = 0; s < SLOTS; s++) if (!this.customers.some(c => c.slot === s && c.phase !== 'out')) return s; return -1; }
  _pick() {
    const m = this.day.menu, total = m.reduce((a, [, w]) => a + w, 0);
    let r = this.rng() * total; for (const [id, w] of m) { r -= w; if (r <= 0) return id; } return m[0][0];
  }
  makeOrder(cake = false) {
    if (cake) return this.rng() < 0.5 ? ['cake'] : ['cake', 'coffee'];
    let n = 1;
    while (n < this.day.maxItems && this.rng() < this.day.multiChance) n++;
    return Array.from({ length: n }, () => this._pick());
  }
  spawn(order = null, { cake = false } = {}) {
    const slot = this.freeSlot(); if (slot < 0) return null;
    order = order || this.makeOrder(cake);
    const extra = (order.length - 1) * 9 + (order.includes('cake') ? 22 : 0);
    const c = { id: this.nextId++, slot, order, got: order.map(() => false), phase: 'in', p: 0, patience: this.day.patience + extra, max: this.day.patience + extra, mood: 'ok', side: this.rng() < 0.5 ? -1 : 1, seed: Math.floor(this.rng() * 1e9) };
    this.customers.push(c); this.emit('spawn', { c }); return c;
  }
  _leave(c, mood) { c.phase = 'out'; c.p = 0; c.mood = mood; this.emit('leave', { c, mood }); }

  // ---------- main update ----------
  update(dt) {
    if (this.over) return;
    if (!this.closing) {
      this.time += dt; this.left = Math.max(0, this.day.length - this.time);
      if (this.left <= 0) { this.closing = true; this.emit('closing'); for (const c of this.customers) if (c.phase !== 'out') this._leave(c, 'closed'); }
    }
    // spawning
    if (!this.closing) {
      const cakeDue = this.cakeQueue.length && this.time >= this.cakeQueue[0];
      if (cakeDue && this.freeSlot() >= 0) { this.cakeQueue.shift(); this.spawn(null, { cake: true }); }
      this.spawnIn -= dt;
      if (!cakeDue && this.spawnIn <= 0 && this.left > 12) {
        if (this.spawn()) { const [a, b] = this.day.spawn; this.spawnIn = a + this.rng() * (b - a); }
        else this.spawnIn = 1.5; // counter full: try again shortly
      }
    }
    // customers
    for (const c of this.customers) {
      if (c.phase === 'in') { c.p += dt / WALK_IN; if (c.p >= 1) { c.p = 1; c.phase = 'wait'; this.emit('arrive', { c }); } }
      else if (c.phase === 'wait') {
        c.patience -= dt;
        if (c.patience <= 0) {
          c.patience = 0; this.lost++; this.strikes++; this._leave(c, 'angry'); this.emit('strike', { strikes: this.strikes });
          if (this.strikes >= STRIKES) { this.failed = true; this._end(); return; }
        }
      } else if (c.phase === 'out') c.p += dt / WALK_OUT;
    }
    this.customers = this.customers.filter(c => !(c.phase === 'out' && c.p >= 1));
    // stations
    for (const s of Object.values(this.stations)) {
      if ((s.kind === 'oven' || s.kind === 'fryer' || s.kind === 'coffee') && s.state !== 'idle') {
        s.t += dt;
        if (s.state === 'busy' && s.t >= s.cook) { s.state = 'ready'; this.emit('ready', { station: s.id, item: s.item }); }
        const burn = BURN_AFTER[s.item];
        if (s.state === 'ready' && burn != null && s.t >= s.cook + burn) { s.state = 'burnt'; this.burnt++; this.emit('burnt', { station: s.id, item: s.item }); }
      }
      if (s.kind === 'display') {
        s.restock += dt;
        if (s.restock >= DISPLAY_RESTOCK_EVERY) {
          s.restock = 0;
          const low = Object.entries(s.stock).filter(([, n]) => n < DISPLAY_STOCK).sort((a, b) => a[1] - b[1])[0];
          if (low) { s.stock[low[0]]++; this.emit('restock', { item: low[0] }); }
        }
      }
    }
    if (this.closing && !this.customers.length) this._end();
  }
  _end() { if (this.over) return; this.over = true; this.emit('end', { failed: this.failed, score: this.score }); }

  // ---------- actions ----------
  /** Available actions for a target: [{ label, item?, ok, why? }]. Index 0 is the default (E / tap). */
  actions(id) {
    const s = this.stations[id], full = this.hands.length >= HANDS;
    if (id && id.startsWith('cust:')) {
      const c = this.customers.find(x => x.id === +id.slice(5));
      if (!c || c.phase !== 'wait') return [];
      const match = this.hands.some(h => c.order.some((o, i) => !c.got[i] && o === h));
      return [{ label: 'Serve', ok: match, why: this.hands.length ? 'Not in this order' : 'Your hands are empty' }];
    }
    if (!s) return [];
    if (s.locked) return [{ label: 'Opens on Day 2', ok: false, why: 'Opens on Day 2' }];
    const take = (label) => [{ label, ok: !full, why: 'Hands full: serve or trash something' }];
    switch (s.kind) {
      case 'oven':
        if (s.state === 'idle') return this.day.oven.map(item => ({ label: `Bake ${ITEMS[item].name}`, item, ok: true }));
        if (s.state === 'busy') return [{ label: `Baking ${ITEMS[s.item].name}…`, ok: false, why: 'Still baking' }];
        if (s.state === 'ready') return take(`Take ${ITEMS[s.item].name}`);
        return take('Take out burnt');
      case 'fryer':
        if (s.state === 'idle') return [{ label: 'Fry a donut', item: 'donut', ok: true }];
        if (s.state === 'busy') return [{ label: 'Frying…', ok: false, why: 'Still frying' }];
        if (s.state === 'ready') return take('Take donut');
        return take('Take out burnt');
      case 'coffee':
        if (s.state === 'idle') return [{ label: 'Brew coffee', item: 'coffee', ok: true }];
        if (s.state === 'busy') return [{ label: 'Brewing…', ok: false, why: 'Still brewing' }];
        return take('Take coffee');
      case 'frost': {
        const has = this.hands.includes('donut');
        return [
          { label: 'Chocolate', item: 'donutChoc', ok: has, why: 'Bring a plain donut from the fryer' },
          { label: 'Sprinkles', item: 'donutSprk', ok: has, why: 'Bring a plain donut from the fryer' },
        ];
      }
      case 'display':
        return Object.entries(s.stock).map(([item, n]) => ({ label: `${ITEMS[item].name} (${n})`, item, ok: n > 0 && !full, why: n <= 0 ? 'Sold out, restocking…' : 'Hands full' }));
      case 'trash':
        return [{ label: this.hands.length ? `Trash ${ITEMS[this.hands[this.hands.length - 1]].name}` : 'Trash', ok: this.hands.length > 0, why: 'Nothing to throw away' }];
    }
    return [];
  }

  act(id, index = 0) {
    if (this.over) return { ok: false, why: 'closed' };
    const list = this.actions(id), a = list[index];
    if (!a) return { ok: false, why: 'nothing' };
    if (!a.ok) { this.emit('deny', { why: a.why, target: id }); return { ok: false, why: a.why }; }
    if (id.startsWith('cust:')) return this._serve(+id.slice(5));
    const s = this.stations[id];
    switch (s.kind) {
      case 'oven': case 'fryer': case 'coffee':
        if (s.state === 'idle') { s.state = 'busy'; s.item = a.item; s.t = 0; s.cook = COOK_TIME[a.item]; this.emit('start', { station: id, item: a.item }); return { ok: true }; }
        { const item = s.state === 'burnt' ? 'burnt' : s.item; this.hands.push(item); s.state = 'idle'; s.item = null; s.t = 0; this.emit('take', { station: id, item }); return { ok: true, item }; }
      case 'frost': {
        const i = this.hands.indexOf('donut'); this.hands[i] = a.item; this.emit('frost', { item: a.item, hand: i }); return { ok: true, item: a.item };
      }
      case 'display': s.stock[a.item]--; this.hands.push(a.item); this.emit('take', { station: id, item: a.item }); return { ok: true, item: a.item };
      case 'trash': {
        const bi = this.hands.lastIndexOf('burnt'), i = bi >= 0 ? bi : this.hands.length - 1;
        const [item] = this.hands.splice(i, 1); this.emit('trash', { item }); return { ok: true, item };
      }
    }
    return { ok: false };
  }

  _serve(cid) {
    const c = this.customers.find(x => x.id === cid);
    let gave = 0;
    for (let h = this.hands.length - 1; h >= 0; h--) {
      const i = c.order.findIndex((o, k) => !c.got[k] && o === this.hands[h]);
      if (i >= 0) { c.got[i] = true; this.hands.splice(h, 1); gave++; }
    }
    this.emit('give', { c, count: gave });
    if (c.got.every(Boolean)) {
      const value = c.order.reduce((a, o) => a + ITEMS[o].price, 0);
      const tip = Math.round(value * TIP_RATE * (c.patience / c.max));
      this.score += value + tip; this.tips += tip; this.served++;
      this._leave(c, 'happy'); this.emit('paid', { c, value, tip });
      return { ok: true, value, tip, done: true };
    }
    return { ok: true, done: false };
  }
}
