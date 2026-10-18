// Editor side panel shown while editing a user game.
import { h, clear } from './dom.js';
import { bus } from '../core/events.js';
import { BLOCK_TYPES } from '../data/blocks.js';
import { SKIES, GROUNDS } from '../games/customGame.js';
import { MUSIC_THEMES } from '../audio/music.js';
import { backend } from '../backend/LocalBackend.js';
import { exportGameJSON, downloadText } from '../core/share.js';

export class CreatorPanel {
  constructor(root, { engine, models, ui, onTest, onExit, onReload }) {
    Object.assign(this, { root, engine, models, ui, onTest, onExit, onReload });
    this.el = h('div.creator.hidden#creator-panel');
    root.append(this.el);
    bus.on('game:loaded', ({ game }) => { if (game.editing) this.show(game); else this.hide(); });
    bus.on('game:unloaded', () => this.hide());
    bus.on('creator:tool', () => this.render());
  }
  hide() { this.el.classList.add('hidden'); }
  show(game) { this.game = game; this.el.classList.remove('hidden'); this.render(); }

  save(silent = false) {
    const doc = this.game.serialize();
    doc.thumbnail = this.engine.snapshot();
    this.game.doc = doc; Object.assign(this.game.doc, doc);
    backend.saveCustomGame(doc);
    bus.emit('games:changed');
    if (!silent) this.ui.toast(`Saved "${doc.name}" and published to the Games menu`, '💾');
    return doc;
  }

  render() {
    const g = this.game, doc = g.doc;
    const tool = (id, icon, label) => h('button.tool' + (g.tool === id ? '.sel' : ''), { 'data-tool': id, onclick: () => { g.setTool(id); this.render(); } }, h('span', icon), label);
    const sel = (id, opts, value, onchange) => h(`select#${id}`, { onchange: (e) => onchange(e.target.value) }, Object.entries(opts).map(([k, v]) => h('option', { value: k, selected: k === value }, v)));
    const models = this.models.list();
    clear(this.el).append(
      h('h3', '🛠️ Game Creator'),
      h('label.field', 'Name', h('input#game-name', { value: doc.name, maxLength: 40, oninput: (e) => { doc.name = e.target.value || 'Untitled'; } })),
      h('div.tools', tool('block', '🧱', 'Block'), tool('erase', '🧽', 'Erase'), tool('spawn', '📍', 'Spawn'), tool('coin', '🪙', 'Coin'), tool('model', '📦', 'Model')),
      g.tool === 'block' ? h('div.mini-palette', BLOCK_TYPES.map(b => h('button.swatch' + (g.building.selected === b.id ? '.sel' : ''), { 'data-block': b.id, title: b.name, onclick: () => { g.building.selected = b.id; this.render(); } }, h('span.chip', { style: { background: b.color } })))) : null,
      g.tool === 'model' ? (models.length
        ? h('div.field', sel('model-pick', Object.fromEntries(models.map(m => [m.id, m.name])), g.selectedModel || (g.selectedModel = models[0].id), (v) => { g.selectedModel = v; }))
        : h('div.muted.small', 'No models yet. ', h('button.btn.small', { onclick: () => this.ui.openDrawer('models') }, 'Upload one'))) : null,
      h('p.muted.small', { block: 'Click to place · Shift/right-click removes', erase: 'Click a block, coin or model to remove it', spawn: 'Click where players should start', coin: 'Click to drop a coin pickup (+5 BB each)', model: 'Click to place the selected model' }[g.tool]),
      h('label.field', 'Sky', sel('sky-pick', Object.fromEntries(Object.entries(SKIES).map(([k, v]) => [k, v.name])), doc.sky, (v) => { this.onReload({ ...g.serialize(), sky: v }); })),
      h('label.field', 'Ground', sel('ground-pick', Object.fromEntries(Object.entries(GROUNDS).map(([k, v]) => [k, v.name])), doc.ground, (v) => { this.onReload({ ...g.serialize(), ground: v }); })),
      h('label.field', 'Music', sel('music-pick', Object.fromEntries(MUSIC_THEMES.map(m => [m.id, m.name])), doc.music, (v) => { doc.music = v; this.engine.music.play(v); })),
      h('label.check', h('input', { type: 'checkbox', checked: doc.snow, onchange: (e) => this.onReload({ ...g.serialize(), snow: e.target.checked }) }), ' Snowfall'),
      h('div.stats.muted.small', `${g.building.count} blocks`),
      h('div.creator-actions',
        h('button.btn#save-game', { onclick: () => this.save() }, '💾 Save & Publish'),
        h('button.btn#test-game', { onclick: () => this.onTest(this.save(true)) }, '▶ Test'),
        h('button.btn.secondary#export-game', { onclick: () => { const d = this.save(true); downloadText(`${d.name.replace(/[^\w-]+/g, '_')}.iceberg.json`, exportGameJSON(d, this.models)); } }, '⤓ Export'),
        h('button.btn.secondary#exit-editor', { onclick: () => this.onExit() }, '✕ Exit')));
  }
}
