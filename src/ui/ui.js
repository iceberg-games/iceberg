// In-game HUD + drawers (Shop, Locker, Get Birg Bucks, Models, Help).
import { h, clear } from './dom.js';
import { toast as showToast, confirmModal } from './overlay.js';
import { playUi } from '../audio/uiSounds.js';
import { bus } from '../core/events.js';
import { CURRENCY, fmt } from '../core/currency.js';
import { COSMETICS, COSMETIC_BY_ID } from '../data/cosmetics.js';
import { BLOCK_TYPES } from '../data/blocks.js';
import { PACKS, payments } from '../core/payments.js';
import { REWARDS } from '../core/economy.js';
import { modelPrefs } from '../backend/LocalBackend.js';

// Optional device-mode module (owned by Publisher). import.meta.glob resolves to {}
// when the file doesn't exist, so the build never breaks on its absence.
const DEVICE_MODULE = import.meta.glob('../core/device.js');
const loadDevice = () => (DEVICE_MODULE['../core/device.js'] ? DEVICE_MODULE['../core/device.js']().catch(() => null) : Promise.resolve(null));

const CATS = [
  ['all', 'All'], ['hat', 'Hats'], ['face', 'Face'], ['skin', 'Skins'], ['shirt', 'Shirts'],
  ['acc', 'Accessories'], ['winter', '❄️ Winter'], ['premium', '🚀 Premium'],
];
const SLOT_NAMES = { hat: 'Hat', face: 'Face', skin: 'Skin', shirt: 'Shirt', neck: 'Neck', back: 'Back', hand: 'Hand' };

export class UI {
  constructor(root, { engine, economy, avatar, models, music, onHome }) {
    Object.assign(this, { root, engine, economy, avatar, models, music, onHome });
    this.settings = modelPrefs.loadSettings();
    this.shopCat = 'all';
    this._buildHud();
    bus.on('coins:changed', (e) => this._onCoins(e));
    bus.on('toast', (t) => this.toast(t.text, t.icon));
    bus.on('inventory:changed', () => { this.avatar.applyLoadout(this.economy.profile); this._questStale = true; this.refreshDrawer(); });
    bus.on('rocket:colors', (c) => this.avatar.setRocketColors(c));
    bus.on('cosmetic:colors', (c) => this.avatar.setCosmeticColors(c));
    bus.on('models:changed', () => this.refreshDrawer());
    // Limited-time shop items: re-render when server time / event status arrives, and tick countdowns.
    bus.on('shop:availability', () => this.refreshDrawer());
    setInterval(() => { if (this.drawerName === 'shop') this.refreshDrawer(); }, 30000);
    bus.on('game:loaded', ({ def, game }) => this._onGameLoaded(def, game));
    bus.on('game:unloaded', () => { this.hud.classList.add('hidden'); this.closeDrawer(); this.setBuild(false); });
    engine.input.onKey((e) => this._onKey(e));
  }

  // ---------- HUD ----------
  _buildHud() {
    this.bucksEl = h('span.bucks-amount', fmt(this.economy.coins));
    this.gameNameEl = h('span.game-name', '');
    this.musicBtn = h('button.icon-btn#btn-music', { title: 'Music on/off', onclick: () => this.toggleMute() }, this.music.muted ? '🔇' : '🔊');
    this.volume = h('input.volume#music-volume', { type: 'range', min: 0, max: 1, step: 0.05, value: this.music.volume, title: 'Music volume', oninput: (e) => { this.music.setVolume(+e.target.value); this.musicBtn.textContent = '🔊'; } });
    const btn = (id, icon, label, key, fn) => h(`button.hud-btn#${id}`, { onclick: fn, title: key ? `${label} (${key})` : label }, h('span.ico', icon), h('span.lbl', label), key ? h('kbd', key) : null);
    this.buildBtn = btn('btn-build', '🔨', 'Build', 'B', () => this.setBuild(!this.engine.game?.buildMode));
    this.palette = h('div.palette.hidden#palette');
    this.rewardEl = h('div.reward-note');
    this.hud = h('div#hud.hidden',
      h('div.topbar',
        h('div.brand', h('span.logo', '🧊'), h('b', 'Iceberg'), this.gameNameEl),
        h('div.top-right',
          h('button.bucks#bucks-pill', { title: 'Get Birg Bucks', onclick: () => this.openDrawer('store') }, h('span.bb-ico', CURRENCY.icon), this.bucksEl, h('span.plus', '+')),
          h('div.music', this.musicBtn, this.volume))),
      h('div.bottombar',
        btn('btn-home', '🏠', 'Games', null, () => this.onHome()),
        this.buildBtn,
        btn('btn-shop', '🛍️', 'Shop', 'T', () => this.openDrawer('shop')),
        btn('btn-locker', '🎒', 'Locker', 'L', () => this.openDrawer('locker')),
        btn('btn-store', '💎', 'Get BB', null, () => this.openDrawer('store')),
        btn('btn-models', '📦', 'Models', 'M', () => this.openDrawer('models')),
        btn('btn-help', '❔', 'Help', 'H', () => this.toggleHelp())),
      this.palette,
      h('div.rocket-hint.hidden#rocket-hint', '🚀 Hold ', h('kbd', 'F'), ' to fly'),
    );
    this.help = h('div.help.hidden#help',
      h('h3', '❄️ Controls'),
      h('ul',
        h('li', h('kbd', 'W A S D'), ' / arrows — move'), h('li', h('kbd', 'Space'), ' — jump'),
        h('li', 'Drag mouse — orbit camera · Scroll — zoom'),
        h('li', h('kbd', 'B'), ' — build mode (Frost Fields)'), h('li', 'Click — place block · ', h('kbd', 'Shift'), '+click or right-click — remove'),
        h('li', h('kbd', '1'), '–', h('kbd', '9'), ' — pick block'), h('li', h('kbd', 'F'), ' — fly with the Ice Rocket'),
        h('li', h('kbd', 'T'), ' Shop · ', h('kbd', 'L'), ' Locker · ', h('kbd', 'M'), ' Models · ', h('kbd', 'Esc'), ' close')),
      h('p.muted', `Collect coins (+${REWARDS.coinPickup} BB), build (+${REWARDS.blockPlaced} BB/block, up to ${REWARDS.blockDailyCap}/day) and claim a daily bonus (+${REWARDS.dailyBonus} BB). Birg Bucks are play money.`),
      this._deviceRow(),
      h('button.btn', { onclick: () => this.toggleHelp(false) }, 'Got it'));
    this.drawer = h('div.drawer.hidden#drawer');
    this.toasts = h('div.toasts');
    this.root.append(this.hud, this.help, this.drawer, this.toasts);

    BLOCK_TYPES.forEach((b, i) => {
      const el = h('button.swatch', { title: `${b.name}${i < 9 ? ` (${i + 1})` : ''}`, 'data-block': b.id, onclick: () => this.selectBlock(b.id) },
        h('span.chip', { style: { background: b.color, opacity: b.transparent ? 0.7 : 1 } }), h('span.sw-name', b.name));
      this.palette.append(el);
    });
    this.palette.append(this.rewardEl);
  }

  _onGameLoaded(def, game) {
    this.hud.classList.remove('hidden');
    this.gameNameEl.textContent = '· ' + (game.editing ? `Editing: ${game.doc.name}` : def.name);
    this.buildBtn.classList.toggle('hidden', !game.supportsBuild);
    this.hud.classList.toggle('editing', !!game.editing);
    this.setBuild(false);
    this.updateRocketHint();
    if (!this._helpShown) { this._helpShown = true; this.toggleHelp(true); setTimeout(() => this.toggleHelp(false), 6000); }
  }

  _onKey(e) {
    if (!this.engine.game) return;
    const k = e.code;
    if (k === 'KeyB' && this.engine.game.supportsBuild) this.setBuild(!this.engine.game.buildMode);
    else if (k === 'KeyT') this.openDrawer('shop');
    else if (k === 'KeyL') this.openDrawer('locker');
    else if (k === 'KeyM') this.openDrawer('models');
    else if (k === 'KeyH') this.toggleHelp();
    else if (k === 'Escape') { this.closeDrawer(); this.toggleHelp(false); }
    else if (/^Digit[1-9]$/.test(k) && (this.engine.game.buildMode || this.engine.game.editing)) {
      const b = BLOCK_TYPES[+k.slice(5) - 1]; if (b) this.selectBlock(b.id);
    }
  }

  setBuild(on) {
    const g = this.engine.game;
    if (g?.setBuildMode) g.setBuildMode(on);
    this.buildBtn.classList.toggle('active', !!on);
    this.palette.classList.toggle('hidden', !on);
    if (on) { this.selectBlock(g.building.selected); this._updateReward(); }
  }
  selectBlock(id) {
    const g = this.engine.game; if (g?.building) g.building.selected = id;
    for (const el of this.root.querySelectorAll('[data-block]')) el.classList.toggle('sel', el.dataset.block === id);
  }
  _updateReward() { const r = this.economy.buildRewardRemaining(); this.rewardEl.textContent = r > 0 ? `+1 BB per block · ${r} left today` : 'Daily build reward reached'; }

  _onCoins({ coins, delta, reason }) {
    this.bucksEl.textContent = fmt(coins);
    if (delta > 0) {
      const pop = h('div.coin-pop', `+${delta.toLocaleString()} BB`); this.hud.append(pop); setTimeout(() => pop.remove(), 1100);
      if (reason && reason !== 'Pickup' && reason !== 'Building') this.toast(`${reason}: +${delta.toLocaleString()} ${CURRENCY.name}`, '🧊');
    }
    if (!this.palette.classList.contains('hidden')) this._updateReward();
    this.refreshDrawer();
  }

  toggleMute() { const m = this.music.toggleMute(); this.musicBtn.textContent = m ? '🔇' : '🔊'; }
  // ---------- Device: Computer / Mobile ----------
  _deviceRow() {
    this.deviceRow = h('div.device-row#device-toggle', { style: { display: 'flex', gap: '6px', alignItems: 'center', margin: '8px 0' } },
      h('span.toggle', '📱 Device:'),
      h('button.btn.small.secondary', { 'data-mode': 'computer', disabled: true, onclick: () => this._setDevice('computer') }, '🖥️ Computer'),
      h('button.btn.small.secondary', { 'data-mode': 'mobile', disabled: true, onclick: () => this._setDevice('mobile') }, '📱 Mobile'),
      h('small.muted.device-note', ''));
    loadDevice().then((mod) => {
      this.device = mod && typeof mod.getDeviceMode === 'function' && typeof mod.setDeviceMode === 'function' ? mod : null;
      this._syncDevice();
    });
    bus.on('device:changed', (e) => this._syncDevice(typeof e === 'string' ? e : e?.mode));
    return this.deviceRow;
  }
  _setDevice(mode) {
    if (!this.device) return;
    try { this.device.setDeviceMode(mode); } catch (err) { console.warn('setDeviceMode failed', err); }
    this._syncDevice();
  }
  _syncDevice(modeHint) {
    if (!this.deviceRow) return;
    let mode = null;
    try { mode = this.device ? this.device.getDeviceMode() : null; } catch { mode = null; }
    mode = mode || modeHint || null;
    this.deviceRow.querySelectorAll('button[data-mode]').forEach(b => {
      b.disabled = !this.device;
      const on = b.dataset.mode === mode;
      b.classList.toggle('on', on); b.classList.toggle('secondary', !on);
    });
    this.deviceRow.querySelector('.device-note').textContent = this.device ? '' : 'Device mode not available yet';
  }

  toggleHelp(force) { this.help.classList.toggle('hidden', force === undefined ? !this.help.classList.contains('hidden') : !force); }
  updateRocketHint() { this.root.querySelector('#rocket-hint').classList.toggle('hidden', !this.avatar.hasRocket()); }

  toast(text, icon = '❄️') {
    return showToast(text, { icon, place: 'top', timeout: 3000 });   // shared helper (ui/overlay.js)
  }

  // ---------- drawers ----------
  openDrawer(name) {
    if (this.drawerName === name && !this.drawer.classList.contains('hidden')) { this.closeDrawer(); return; }
    const wasOpen = !this.drawer.classList.contains('hidden');
    if (name === 'shop' || name === 'locker') this._questStale = true;   // refetch quests once per open
    this.drawerName = name; this.drawer.classList.remove('hidden'); this.drawer.dataset.panel = name;
    if (!wasOpen) playUi('popup_open');
    this.refreshDrawer();
  }
  closeDrawer() { if (!this.drawer.classList.contains('hidden')) playUi('popup_close'); this.drawer.classList.add('hidden'); this.drawerName = null; }
  refreshDrawer() {
    this.updateRocketHint();
    if (!this.drawerName || this.drawer.classList.contains('hidden')) return;
    const scroll = this.drawer.querySelector('.drawer-body')?.scrollTop || 0;
    const body = { shop: () => this._shop(), locker: () => this._locker(), store: () => this._store(), models: () => this._models() }[this.drawerName]();
    clear(this.drawer).append(body);
    const b = this.drawer.querySelector('.drawer-body'); if (b) b.scrollTop = scroll;
  }
  _frame(title, subtitle, ...content) {
    return h('div.drawer-inner',
      h('div.drawer-head', h('div', h('h2', title), subtitle ? h('div.muted', subtitle) : null),
        h('button.icon-btn.close#drawer-close', { onclick: () => this.closeDrawer(), title: 'Close (Esc)' }, '✕')),
      h('div.drawer-body', ...content));
  }

  _shop() {
    const e = this.economy;
    const filter = (c) => this.shopCat === 'all' || c.slot === this.shopCat || (this.shopCat === 'acc' && ['neck', 'back', 'hand'].includes(c.slot)) || (this.shopCat === 'winter' && c.winter) || (this.shopCat === 'premium' && c.premium);
    const tabs = h('div.tabs', CATS.map(([id, label]) => h('button.tab' + (this.shopCat === id ? '.sel' : ''), { 'data-sfx': 'tab', onclick: () => { this.shopCat = id; this.refreshDrawer(); } }, label)));
    // Release A (Colin): event items stay hidden until their event starts (economy.shopVisible; owned items always show).
    const listed = (c) => {
      if (typeof e.shopVisible === 'function') return e.shopVisible(c.id);
      if (e.owns(c.id)) return true;
      const av = this._availability(c);
      return !(av && (av.hidden || av.state === 'event_not_started'));
    };
    const cards = h('div.cards', COSMETICS.filter(filter).filter(listed).map(c => {
      const owned = e.owns(c.id), eq = e.isEquipped(c.id), afford = e.coins >= c.price;
      let action;
      const av = c.earnOnly ? null : this._availability(c);
      let limitBadge = null;
      if (owned) action = h('button.btn.equip' + (eq ? '.on' : ''), { 'data-sfx': eq ? 'unequip' : 'equip', onclick: () => { e.toggleEquip(c.id); this.toast(`${eq ? 'Unequipped' : 'Equipped'} ${c.name}`, c.icon); } }, eq ? 'Unequip' : 'Equip');
      else if (c.earnOnly) action = this._earnBadge(c);
      else if (av && av.state === 'event_ended') action = h('button.btn.disabled.event-ended', { disabled: true }, 'Event ended');
      else action = h('button.btn.buy' + (afford ? '' : '.disabled'), { 'data-sfx': 'none', onclick: () => this._buy(c) }, afford ? 'Buy' : `Need ${(c.price - e.coins).toLocaleString()}`);
      if (av && av.limited && av.forSale && !owned) limitBadge = h('div.limited-badge', { style: 'display:inline-block;margin:2px auto 4px;padding:2px 8px;border-radius:999px;background:linear-gradient(90deg,#ff7a1a,#ff3d6e);color:#fff;font-size:11px;font-weight:700' }, `⏳ Limited time${av.msLeft > 0 ? ' · ' + this._fmtLeft(av.msLeft) + ' left' : ''}`);
      return h('div.card' + (c.premium ? '.premium' : '') + (owned ? '.owned' : '') + (av?.state === 'event_ended' && !owned ? '.ended' : ''), { 'data-id': c.id, style: av?.state === 'event_ended' && !owned ? 'opacity:0.6' : null },
        limitBadge,
        h('div.card-icon', c.icon), h('div.card-name', c.name),
        c.desc ? h('div.card-desc', c.desc) : null,
        h('div.price', owned ? (eq ? '✔ Equipped' : 'Owned') : c.earnOnly ? '🎁 Free event reward' : `${CURRENCY.icon} ${c.price.toLocaleString()} BB`),
        action);
    }));
    return this._frame('🛍️ Cosmetics Shop', `You have ${fmt(e.coins)}`, tabs, cards);
  }
  // ---------- earn-only event items (Natural Disasters) ----------
  // Uses Publisher's economy.getQuests / claimQuestReward when present; never grants client-side.
  // Quests are fetched at most once per shop/locker open (or inventory change / claim), with an in-flight
  // guard; the drawer only re-renders when the fetched data actually changed (signature compare).
  _questList() {
    const e = this.economy;
    if (typeof e.getQuests !== 'function') return [];
    if (this._questStale !== false && !this._questsPending) {
      this._questStale = false;
      const apply = (q, rerender) => {
        const list = Array.isArray(q) ? q : [];
        let sig; try { sig = JSON.stringify(list); } catch { sig = String(list.length); }
        const changed = sig !== this._questSig;
        this._questCache = list; this._questSig = sig;
        if (changed && rerender) this.refreshDrawer();
      };
      try {
        const r = e.getQuests();
        if (r && typeof r.then === 'function') {
          this._questsPending = true;
          r.then(q => { this._questsPending = false; apply(q, true); }, () => { this._questsPending = false; });
        } else apply(r, false);                 // synchronous result: we're mid-render, just use it
      } catch { /* keep last cache */ }
    }
    return this._questCache || [];
  }
  _questFor(c) {
    if (!c.unlock) return null;
    return this._questList().find(q => q.id === c.unlock) || null;
  }
  _earnBadge(c) {
    const e = this.economy, q = this._questFor(c);
    const style = { background: 'linear-gradient(90deg,#3f8fd0,#7a5cf0)', color: '#fff', borderRadius: '10px', padding: '6px 10px', fontWeight: 700, fontSize: '12px', textAlign: 'center' };
    const sub = (t) => h('div', { style: { fontWeight: 500, fontSize: '11px', opacity: 0.9 } }, t);
    if (q && q.completed && !q.claimed && typeof e.claimQuestReward === 'function') {
      return h('button.btn.claim', { 'data-quest': q.id, onclick: async (ev) => {
        ev.currentTarget.disabled = true;
        try {
          const r = await e.claimQuestReward(q.id);
          if (r?.granted || r?.alreadyOwned) this.toast(`${r.alreadyOwned ? 'Already yours' : 'Unlocked'}: ${c.name}`, c.icon);
          else this.toast('Could not claim yet. Try again soon.', '⚠️');
        } catch { this.toast('Could not claim yet. Try again soon.', '⚠️'); }
        this._questStale = true; this.refreshDrawer();
      } }, `🎁 Claim ${c.name}`);
    }
    if (q) {
      const goal = Number(q.goal) || 0, prog = Math.min(Number(q.progress) || 0, goal || Infinity);
      return h('div.earn-badge', { style, 'data-quest': q.id }, `Complete ${q.title || 'the quest'} to unlock`,
        goal ? sub(`${prog} / ${goal}${c.earnIn ? ' · ' + c.earnIn : ''}`) : (c.earnIn ? sub(c.earnIn) : null),
        goal ? h('div', { style: { height: '5px', background: 'rgba(255,255,255,0.3)', borderRadius: '3px', marginTop: '4px' } }, h('div', { style: { width: `${Math.round(prog / goal * 100)}%`, height: '100%', background: '#fff', borderRadius: '3px' } })) : null);
    }
    return h('div.earn-badge', { style, title: c.earnIn ? `Complete the ${c.earnIn} quest to unlock` : 'Earned through event quests' }, '🌪️ Earn in Natural Disasters', c.earnIn ? sub(c.earnIn) : null);
  }

  // Publisher's limited-time API (guarded: older economies lack it).
  _availability(c) {
    const e = this.economy;
    if (typeof e.itemAvailability !== 'function') return null;
    try { return e.itemAvailability(c.id) || null; } catch { return null; }
  }
  _fmtLeft(ms) {
    const m = Math.floor(ms / 60000), d = Math.floor(m / 1440), hh = Math.floor((m % 1440) / 60), mm = m % 60;
    return d ? `${d}d ${hh}h` : hh ? `${hh}h ${mm}m` : `${Math.max(1, mm)}m`;
  }
  _buy(c) {
    const r = this.economy.buy(c.id) || { ok: false, reason: 'Could not buy right now' };
    if (r && typeof r.then === 'function') { r.then((x) => this._buyResult(c, x || {}), () => playUi('error') || this.toast('Could not buy right now. Try again soon.', '⚠️')); return; }
    this._buyResult(c, r);
  }
  _buyResult(c, r) {
    if (r.ok) playUi('buy'); else playUi('error');
    if (!r.ok && (r.code === 'event_ended' || r.code === 'event_not_started')) { this.toast(r.reason || (r.code === 'event_ended' ? `${c.name}: event has ended` : `${c.name}: coming soon`), '⏳'); this.refreshDrawer(); return; }
    if (r.ok) { this.economy.equip(c.id); this.toast(`Bought & equipped ${c.name}!`, c.icon); }
    else if (r.reason === 'Not enough coins') { this.toast(`Not enough ${CURRENCY.name} for ${c.name}`, '😕'); }
    else this.toast(r.reason || 'Could not buy right now', '⚠️');
  }

  _locker() {
    const e = this.economy, p = e.profile;
    const owned = COSMETICS.filter(c => e.owns(c.id));
    const sections = [];
    if (!owned.length) sections.push(h('div.empty', 'Your locker is empty. Visit the Shop to buy cosmetics with Birg Bucks!', h('br'), h('button.btn', { onclick: () => this.openDrawer('shop') }, 'Open Shop')));
    const bySlot = {};
    owned.forEach(c => (bySlot[c.slot] ||= []).push(c));
    for (const [slot, items] of Object.entries(bySlot)) {
      sections.push(h('h4', SLOT_NAMES[slot]), h('div.locker-row', items.map(c => h('button.locker-item' + (e.isEquipped(c.id) ? '.on' : ''), { 'data-id': c.id, 'data-sfx': e.isEquipped(c.id) ? 'unequip' : 'equip', onclick: () => e.toggleEquip(c.id), title: e.isEquipped(c.id) ? 'Click to unequip' : 'Click to equip' }, h('span.card-icon', c.icon), h('span', c.name), h('small', e.isEquipped(c.id) ? 'Equipped' : 'Equip')))));
    }
    if (e.owns('icerocket')) {
      const rc = p.rocketColors;
      const picker = (part, label) => h('label.color-row', label, h('input', { type: 'color', value: rc[part], 'data-part': part, oninput: (ev) => e.setRocketColor(part, ev.target.value) }));
      const presets = [['Frost', { body: '#e8f4ff', fins: '#3f8fd0', trim: '#7fe3ff' }], ['Aurora', { body: '#2b2d5c', fins: '#8b6cf0', trim: '#4dffb0' }], ['Ember', { body: '#f2f2f2', fins: '#e2474b', trim: '#ffb347' }], ['Gold', { body: '#f2c230', fins: '#22262e', trim: '#ffffff' }]];
      sections.push(h('div.rocket-custom#rocket-custom', h('h4', '🚀 Ice Rocket colors'),
        picker('body', 'Body'), picker('fins', 'Fins'), picker('trim', 'Trim & frost trail'),
        h('div.presets', presets.map(([n, c]) => h('button.btn.small', { onclick: () => { Object.entries(c).forEach(([k, v]) => e.setRocketColor(k, v)); this.refreshDrawer(); } }, n))),
        h('p.muted', e.isEquipped('icerocket') ? 'Hold F to fly!' : 'Equip it to fly with F.')));
    }
    // Natural Disasters rewards still to earn (claim button / quest progress when available)
    const toEarn = COSMETICS.filter(c => c.earnOnly && !e.owns(c.id));
    if (toEarn.length) sections.push(h('h4', '🌪️ Natural Disasters rewards'), h('div.locker-row.earn-row', toEarn.map(c => h('div.locker-item.locked', { 'data-id': c.id, style: { opacity: 1 } }, h('span.card-icon', c.icon), h('span', c.name), this._earnBadge(c)))));
    // Single-color customizable cosmetics (earmuffs, snow globe pack, cocoa mug…)
    for (const c of owned.filter(c => c.colorPresets)) {
      const cur = (p.cosmeticColors || {})[c.id] || c.defaultColor;
      sections.push(h('div.rocket-custom.cosmetic-custom', { 'data-id': c.id }, h('h4', `${c.icon} ${c.name} colors`),
        !/^#[0-9a-f]{6}$/i.test(cur) ? null : h('label.color-row', 'Color', h('input', { type: 'color', value: cur, 'data-id': c.id, oninput: (ev) => e.setCosmeticColor(c.id, ev.target.value) })),
        h('div.presets', c.colorPresets.map(([n, hex]) => h('button.btn.small' + (hex.toLowerCase() === cur.toLowerCase() ? '.on' : ''), { 'data-color': hex, onclick: () => { e.setCosmeticColor(c.id, hex); this.refreshDrawer(); } }, n))),
        e.isEquipped(c.id) ? null : h('p.muted', 'Equip it to see the color on your avatar.')));
    }
    sections.push(this._wearSection());
    return this._frame('🎒 Locker', 'Your owned items. Click to equip/unequip.', ...sections);
  }

  _wearSection() {
    const list = this.models.list();
    const wear = modelPrefs.loadWear();
    const box = h('div.wear#wear-section', h('h4', '📦 Custom model cosmetic'));
    if (!list.length) { box.append(h('p.muted', 'Upload a .glb/.gltf/.obj in Models to wear it on your avatar.')); return box; }
    const sel = h('select#wear-model', list.map(m => h('option', { value: m.id, selected: wear?.modelId === m.id }, m.name)));
    const w = wear || { modelId: list[0].id, bone: 'head', scale: 0.5, x: 0, y: 0.62, z: 0, rotY: 0 };
    const apply = () => { modelPrefs.saveWear(w); this.avatar.updateCustomWear(w); };
    const slider = (key, label, min, max, step) => h('label.slider', h('span', label), h('input', { type: 'range', min, max, step, value: w[key], 'data-key': key, oninput: (ev) => { w[key] = +ev.target.value; apply(); } }));
    const bone = h('select#wear-bone', ['head', 'torso', 'armR', 'armL'].map(b => h('option', { value: b, selected: w.bone === b }, { head: 'Head', torso: 'Back / torso', armR: 'Right hand', armL: 'Left hand' }[b])));
    bone.onchange = () => { w.bone = bone.value; apply(); };
    box.append(
      h('label.color-row', 'Model', sel), h('label.color-row', 'Attach to', bone),
      slider('scale', 'Size', 0.1, 2, 0.05), slider('x', 'Left/Right', -1.5, 1.5, 0.05), slider('y', 'Up/Down', -1.5, 1.5, 0.05), slider('z', 'Front/Back', -1.5, 1.5, 0.05), slider('rotY', 'Rotate', -3.14, 3.14, 0.05),
      h('div.row', h('button.btn#wear-btn', { onclick: () => { w.modelId = sel.value; modelPrefs.saveWear(w); this.avatar.setCustomWear(this.models.instance(w.modelId), w); this.toast('Custom cosmetic equipped', '📦'); this.refreshDrawer(); } }, wear ? 'Update model' : 'Wear model'),
        wear ? h('button.btn.secondary', { onclick: () => { modelPrefs.saveWear(null); this.avatar.setCustomWear(null); this.refreshDrawer(); } }, 'Take off') : null));
    return box;
  }

  _store() {
    const devOn = !!this.settings.devMode;
    const notice = h('div.notice#pay-notice' + (this._payMsg ? '' : '.hidden'), this._payMsg || '');
    const packs = h('div.packs', PACKS.map(p => h('div.pack', { 'data-pack': p.id },
      h('div.pack-amt', `${CURRENCY.icon} ${p.bucks.toLocaleString()}`), h('div.muted', CURRENCY.name),
      p.tag ? h('div.tag', p.tag) : null,
      h('button.btn.price-btn', { onclick: async () => {
        const r = await payments.checkout(p);
        // DEMO: no real payment happens; the pack's Birg Bucks are granted for free.
        this._payMsg = `💳 DEMO purchase: +${p.bucks.toLocaleString()} BB granted for free. ${r.message}`;
        this.economy.demoGrant(p.bucks);
        this.refreshDrawer();
      } }, `$${p.usd} (demo)`))));
    const dev = h('div.dev',
      h('label.toggle', h('input#dev-toggle', { type: 'checkbox', checked: devOn, onchange: (ev) => { this.settings.devMode = ev.target.checked; modelPrefs.saveSettings({ ...modelPrefs.loadSettings(), devMode: ev.target.checked }); this.refreshDrawer(); } }), ' 🛠️ Developer demo mode (testing only)'),
      devOn ? h('div.dev-grants', h('p.muted', 'Grants free play-money Birg Bucks for testing. Not a purchase.'),
        [500, 5000, 100000].map(n => h('button.btn.small.dev-grant', { 'data-amount': n, onclick: () => this.economy.demoGrant(n) }, `+${n.toLocaleString()} BB (demo)`))) : null);
    return this._frame('💎 Get Birg Bucks', `Balance: ${fmt(this.economy.coins)}`,
      h('p', `$4 for every 500 ${CURRENCY.name}. `, h('b', 'DEMO: buttons grant bucks for free; no money is charged.')), packs, notice,
      h('p.muted.small', 'Real payments are not connected yet. No card details are collected and nothing is charged.'),
      h('h4', 'Earn for free'), h('ul.earn', h('li', `Collect coins in games: +${REWARDS.coinPickup} BB`), h('li', `Build in Frost Fields: +${REWARDS.blockPlaced} BB/block (${REWARDS.blockDailyCap}/day)`), h('li', `Daily bonus: +${REWARDS.dailyBonus} BB`)),
      dev);
  }

  _models() {
    const g = this.engine.game;
    const input = h('input#model-file', { type: 'file', accept: '.glb,.gltf,.obj', style: { display: 'none' }, onchange: async (ev) => {
      const f = ev.target.files[0]; if (!f) return;
      try { const rec = await this.models.addFile(f); this.toast(`Uploaded ${rec.name}`, '📦'); }
      catch (err) { console.warn(err); this.toast(`Could not load model: ${err.message || err}`, '⚠️'); }
      ev.target.value = '';
    } });
    const list = this.models.list();
    const canPlace = !!g?.supportsModels || (g?.editing);
    return this._frame('📦 Your 3D Models', 'Bring your own Blender creations (.glb, .gltf, .obj)',
      input,
      h('button.btn.big#upload-btn', { onclick: () => input.click() }, '⬆️ Upload Model'),
      h('p.muted.small', 'Desktop recommended. Blender: File → Export → glTF 2.0 → format "glTF Binary (.glb)". Models are saved in this browser.'),
      list.length ? h('div.model-list', list.map(m => h('div.model-item', { 'data-model': m.id },
        h('div', h('b', m.name), h('div.muted.small', m.format.toUpperCase())),
        h('div.row',
          canPlace ? h('button.btn.small.place-model', { onclick: () => {
            if (g.editing) { g.setTool('model'); g.selectedModel = m.id; bus.emit('creator:tool', 'model'); this.toast('Click in the world to place it', '📦'); }
            else { g.setBuildMode?.(false); g.beginPlaceModel(m.id); }
            this.closeDrawer();
          } }, 'Place in world') : null,
          h('button.btn.small.wear-model', { onclick: () => {
            const w = { modelId: m.id, bone: 'head', scale: 0.5, x: 0, y: 0.62, z: 0, rotY: 0 };
            modelPrefs.saveWear(w); this.avatar.setCustomWear(this.models.instance(m.id), w); this.openDrawer('locker');
          } }, 'Wear'),
          h('button.btn.small.secondary', { onclick: async () => { if (await confirmModal(`Delete ${m.name}?`, { title: 'Delete model?', okLabel: 'Delete', danger: true })) this.models.remove(m.id); } }, '🗑')))))
        : h('div.empty', 'No models yet.'),
      canPlace ? null : h('p.muted.small', 'Tip: you can place models in Frost Fields or in your own games (Create a Game).'));
  }
}
