// Iceberg Studio UI (Roblox Studio-style): ribbon, Explorer, Toolbox,
// Properties, plain-words Script editor and Animator. Talks to the editor
// instance from src/studio/editor.js (engine.game while editing).
import { h, clear } from './dom.js';
import { bus } from '../core/events.js';
import { TYPE_INFO, MATERIALS, SHAPES } from '../studio/instances.js';
import { SKIES, GROUNDS } from '../studio/world.js';
import { GEAR_LIST, GEARS } from '../studio/gears.js';
import { MUSIC_THEMES } from '../audio/music.js';
import { EXAMPLES, HELP } from '../studio/nlscript.js';
import { getScriptTranslator } from '../studio/ai.js';
import { drafts, publish, isPublished } from '../studio/store.js';
import { upgradeDoc } from '../studio/templates.js';
import { exportGameJSON, importGameJSON, downloadText } from '../core/share.js';

const num = (v) => (Math.round(v * 1000) / 1000).toString();

export class CreatorPanel {
  constructor(root, { engine, models, ui, onTest, onExit, onReload }) {
    Object.assign(this, { root, engine, models, ui, onTest, onExit, onReload });
    this.el = h('div.studio.hidden#creator-panel');
    root.append(this.el);
    this.leftTab = 'explorer'; this.scriptSel = null; this.showCode = false;
    bus.on('game:loaded', ({ game }) => { if (game.editing) this.show(game); else this.hide(); });
    bus.on('game:unloaded', () => this.hide());
    bus.on('models:changed', () => this.ed && this.renderLeft());
    bus.on('studio:changed', (what) => this._onChange(what));
    addEventListener('keydown', (e) => this._onKey(e), true);
  }
  get ed() { return this.engine.game?.editing ? this.engine.game : null; }
  hide() { this.el.classList.add('hidden'); document.body.classList.remove('studio-active'); }
  show(game) { this.game = game; this.scriptSel = null; this.el.classList.remove('hidden'); document.body.classList.add('studio-active'); this.render(); }

  _onChange(what) {
    if (!this.ed) return;
    if (what === 'animtime' || what === 'bonepose') { this.renderAnimator(true); return; }
    if (what === 'script') { this.renderScriptPreview(); this.renderLeft(); return; }
    this.renderRibbon(); this.renderLeft(); this.renderProps(); this.renderAnimator();
  }
  _onKey(e) {
    const ed = this.ed; if (!ed) return;
    if (e.target.closest?.('input, textarea, select')) return;
    const ctrl = e.ctrlKey || e.metaKey, k = e.code;
    const stop = () => { e.preventDefault(); e.stopPropagation(); };
    if (['KeyT', 'KeyL', 'KeyM', 'KeyH', 'KeyB'].includes(k) && !ctrl) { e.stopPropagation(); return; } // don't open game drawers in Studio
    if (ctrl && k === 'KeyZ') { stop(); e.shiftKey ? ed.redo() : ed.undo(); }
    else if (ctrl && k === 'KeyY') { stop(); ed.redo(); }
    else if (ctrl && k === 'KeyD') { stop(); ed.duplicate(); }
    else if (ctrl && k === 'KeyS') { stop(); this.save(); }
    else if (k === 'Delete' || k === 'Backspace') { stop(); ed.remove(); }
    else if (k === 'KeyF' && !ctrl) { ed.focus(); }
    else if (!ctrl && /^Digit[1-4]$/.test(k)) ed.setTool(['select', 'move', 'scale', 'rotate'][+k.slice(5) - 1]);
  }

  // ---------- persistence ----------
  docWithThumb() { const d = this.ed.serialize(); try { d.thumbnail = this.engine.snapshot(); } catch {} return d; }
  save(silent = false) { const d = this.docWithThumb(); try { drafts.save(d); if (!silent) this.ui.toast(`Saved draft "${d.name}"`, '💾'); } catch { this.ui.toast('Could not save (browser storage full?)', '⚠️'); } return d; }
  publishGame() { const d = this.save(true); publish(d); bus.emit('games:changed'); this.ui.toast(`Published "${d.name}" to the Games menu!`, '🚀'); this.renderProps(); return d; }

  render() {
    clear(this.el).append(
      this.ribbon = h('div.st-ribbon'),
      h('div.st-left', this.left = h('div.st-left-inner')),
      h('div.st-right', this.props = h('div.st-props')),
      this.anim = h('div.st-anim.hidden'),
      h('div.st-status', 'Right-drag: look · W A S D + Q/E: fly (Shift = fast) · Click: select · 1–4: Select/Move/Scale/Rotate · Ctrl+Z / Ctrl+Y · Ctrl+D duplicate · Del delete · F focus · Ctrl+S save'),
    );
    this.renderRibbon(); this.renderLeft(); this.renderProps(); this.renderAnimator();
  }

  renderRibbon() {
    const ed = this.ed; if (!ed) return;
    const tool = (id, icon, label, key) => h('button.st-tool' + (ed.tool === id ? '.on' : ''), { 'data-tool': id, title: `${label} (${key})`, onclick: () => ed.setTool(id) }, h('span', icon), label);
    const ins = (type, icon, label, over = {}) => h('button.st-tool', { 'data-insert': label.toLowerCase().replace(/\s+/g, '-'), onclick: () => ed.insert(type, over) }, h('span', icon), label);
    const snapSel = (key, opts, label) => h('label.st-snap', label, h('select', { 'data-snap': key, onchange: (e) => ed.setSnap(key, +e.target.value) }, opts.map(o => h('option', { value: o, selected: ed.snap[key] === o }, o === 0 ? 'Off' : (key === 'rot' ? `${o}°` : o)))));
    const importInput = h('input', { type: 'file', accept: '.json', style: { display: 'none' }, onchange: async (e) => { const f = e.target.files[0]; if (!f) return; try { const d = upgradeDoc(await importGameJSON(await f.text(), this.models)); drafts.save(d); this.ui.toast(`Imported "${d.name}"`, '📥'); this.onReload(d); } catch (err) { this.ui.toast(`Import failed: ${err.message}`, '⚠️'); } } });
    clear(this.ribbon).append(
      h('div.st-brand', '🧊', h('b', 'Iceberg Studio')),
      h('div.st-group', h('div.st-gl', 'Tools'), h('div.st-row', tool('select', '🖱️', 'Select', 1), tool('move', '✥', 'Move', 2), tool('scale', '⤢', 'Scale', 3), tool('rotate', '⟳', 'Rotate', 4)),
        h('div.st-row', snapSel('move', [0, 0.25, 0.5, 1, 2, 4], 'Move'), snapSel('rot', [0, 5, 15, 45, 90], 'Rotate'), h('button.st-mini#space-toggle', { onclick: () => ed.toggleSpace(), title: 'Move in world or local axes' }, ed.space === 'world' ? '🌐 World' : '📐 Local'))),
      h('div.st-group', h('div.st-gl', 'Insert'), h('div.st-row', ins('part', '🧱', 'Block', { shape: 'box' }), ins('part', '⚪', 'Sphere', { shape: 'sphere', size: [3, 3, 3], name: 'Sphere' }), ins('part', '🛢️', 'Cylinder', { shape: 'cylinder', size: [3, 2, 3], name: 'Cylinder' }), ins('part', '📐', 'Wedge', { shape: 'wedge', size: [4, 2, 4], name: 'Wedge' })),
        h('div.st-row', ins('spawn', '📍', 'Spawn'), ins('checkpoint', '🚩', 'Checkpoint'), ins('part', '🔥', 'Kill brick', { name: 'KillBrick', kill: true, material: 'lava', color: '#ff4a1c', size: [4, 1, 4] }), ins('coin', '🪙', 'Coin'))),
      h('div.st-group', h('div.st-gl', 'Edit'), h('div.st-row',
        h('button.st-tool#undo-btn', { disabled: !ed.canUndo(), onclick: () => ed.undo(), title: 'Undo (Ctrl+Z)' }, h('span', '↶'), 'Undo'),
        h('button.st-tool#redo-btn', { disabled: !ed.canRedo(), onclick: () => ed.redo(), title: 'Redo (Ctrl+Y)' }, h('span', '↷'), 'Redo'),
        h('button.st-tool#dup-btn', { disabled: !ed.selectedId, onclick: () => ed.duplicate() }, h('span', '⧉'), 'Duplicate'),
        h('button.st-tool#del-btn', { disabled: !ed.selectedId, onclick: () => ed.remove() }, h('span', '🗑'), 'Delete'),
        h('button.st-tool' + (ed.animator.open ? '.on' : '') + '#animator-btn', { onclick: () => ed.openAnimator(!ed.animator.open) }, h('span', '🎬'), 'Animator'))),
      h('div.st-group.st-game', h('div.st-gl', 'Game'), h('div.st-row',
        h('button.st-big.play#test-game', { onclick: () => this.onTest(this.save(true)) }, '▶ Test'),
        h('button.st-big#save-game', { onclick: () => this.save() }, '💾 Save'),
        h('button.st-big.pub#publish-game', { onclick: () => this.publishGame() }, '🚀 Publish')),
        h('div.st-row',
          h('button.st-mini#export-game', { onclick: () => { const d = this.save(true); downloadText(`${d.name.replace(/[^\w-]+/g, '_')}.iceberg.json`, exportGameJSON(d, this.models)); } }, '⤓ Export'),
          importInput, h('button.st-mini#import-game', { onclick: () => importInput.click() }, '⤒ Import'),
          h('button.st-mini#exit-editor', { onclick: () => { this.save(true); this.ed.saveCamera(); this.onExit(); } }, '✕ Exit'))),
    );
  }

  // ---------- left: explorer / toolbox ----------
  renderLeft() {
    const ed = this.ed; if (!ed) return;
    const tabs = h('div.st-tabs', ['explorer', 'toolbox'].map(t => h('button.st-tab' + (this.leftTab === t ? '.on' : ''), { 'data-tab': t, onclick: () => { this.leftTab = t; this.renderLeft(); } }, t === 'explorer' ? '🗂️ Explorer' : '🧰 Toolbox')));
    clear(this.left).append(tabs, this.leftTab === 'explorer' ? this.explorer() : this.toolbox());
  }
  explorer() {
    const ed = this.ed, doc = ed.doc;
    const rows = [h('div.st-node.root' + (!ed.selectedId ? '.sel' : ''), { 'data-node': 'workspace', onclick: () => { this.scriptSel = null; ed.select(null); } }, '🌍 Workspace', h('small', ` (${doc.instances.length})`))];
    for (const inst of doc.instances) {
      const sel = ed.selectedId === inst.id && !this.scriptSel;
      const badge = inst.kill || inst.material === 'lava' ? ' 🔥' : '';
      rows.push(h('div.st-node' + (sel ? '.sel' : ''), { 'data-node': inst.id, title: 'Click to select · double-click to rename', onclick: () => { this.scriptSel = null; ed.select(inst.id); }, ondblclick: () => { const n = prompt('Rename', inst.name); if (n) ed.setProp(inst.id, 'name', n.slice(0, 40)); } },
        h('span.ic', TYPE_INFO[inst.type]?.icon || '🧱'), inst.name + badge));
      for (const s of inst.scripts || []) rows.push(h('div.st-node.child' + (this.scriptSel === s.id ? '.sel' : ''), { 'data-script': s.id, onclick: () => { this.scriptSel = s.id; ed.select(inst.id); } }, h('span.ic', '📜'), s.text ? `Script: ${s.text.slice(0, 24)}${s.text.length > 24 ? '…' : ''}` : 'Script (empty)'));
      for (const a of (doc.animations || []).filter(a => a.rigId === inst.id)) rows.push(h('div.st-node.child', { onclick: () => { ed.select(inst.id); ed.openAnimator(true); ed.animator.animId = a.id; ed.poseAt(0); this.renderAnimator(); } }, h('span.ic', '🎞️'), `Animation: ${a.name}`));
    }
    return h('div.st-explorer', rows);
  }
  toolbox() {
    const ed = this.ed;
    const item = (icon, label, fn, attrs = {}) => h('button.st-tbx', { onclick: fn, ...attrs }, h('span', icon), label);
    const fileIn = h('input#studio-model-file', { type: 'file', accept: '.glb,.gltf,.obj', style: { display: 'none' }, onchange: async (e) => { const f = e.target.files[0]; if (!f) return; try { const r = await this.models.addFile(f); this.ui.toast(`Uploaded ${r.name}${r.isRig ? ' (rig with bones!)' : ''}`, '📦'); ed.insert('model', { modelId: r.id, name: r.name }); } catch (err) { this.ui.toast(`Could not load model: ${err.message}`, '⚠️'); } e.target.value = ''; } });
    const models = this.models.list();
    return h('div.st-toolbox',
      h('h4', 'Parts'), h('div.st-grid',
        item('🧱', 'Block', () => ed.insert('part', { shape: 'box' })), item('⚪', 'Sphere', () => ed.insert('part', { shape: 'sphere', size: [3, 3, 3], name: 'Sphere' })),
        item('🛢️', 'Cylinder', () => ed.insert('part', { shape: 'cylinder', size: [3, 2, 3], name: 'Cylinder' })), item('📐', 'Wedge', () => ed.insert('part', { shape: 'wedge', size: [4, 2, 4], name: 'Wedge' })),
        item('🔥', 'Lava (kill)', () => ed.insert('part', { name: 'Lava', kill: true, material: 'lava', color: '#ff4a1c', size: [8, 1, 8] })), item('🧊', 'Ice slab', () => ed.insert('part', { name: 'Ice', material: 'ice', color: '#bfe9ff', size: [6, 1, 6] })),
        item('💡', 'Neon', () => ed.insert('part', { name: 'Neon', material: 'neon', color: '#4dd2ff', size: [4, 1, 1] })), item('🪟', 'Glass', () => ed.insert('part', { name: 'Glass', material: 'glass', color: '#d8f0ff', size: [4, 6, 0.4] })),
        item('🦘', 'Trampoline', () => { const id = ed.insert('part', { name: 'Trampoline', shape: 'cylinder', color: '#ff7ac8', size: [4, 0.6, 4] }); ed.addScript(id, 'When touched, bounce them really high'); }),
        item('🚪', 'Door', () => { const id = ed.insert('part', { name: 'Door', color: '#8a5a34', material: 'wood', size: [4, 7, 0.5] }); ed.addScript(id, 'When touched, open like a door for 3 seconds'); }),
        item('📍', 'Spawn', () => ed.insert('spawn')), item('🚩', 'Checkpoint', () => ed.insert('checkpoint')), item('🪙', 'Coin', () => ed.insert('coin'))),
      h('h4', 'Gears'), h('p.st-hint', 'Inserts a Gear Giver. Players touch it to get the gear, then press its number to use it.'),
      h('div.st-grid', GEAR_LIST.map(g => item(g.icon, g.name, () => ed.insert('gear', { gearId: g.id, name: g.name.replace(/\s/g, '') + 'Giver' }), { 'data-gear': g.id, title: g.desc }))),
      h('h4', 'Rigs (for the Animator)'), h('div.st-grid',
        item('🧍', 'R6 Rig', () => ed.insert('rig')),
        item('👋', 'R6 + Wave', () => { const id = ed.insert('rig', { name: 'WavingRig' }); ed.animator.rigId = id; ed.openAnimator(true); ed.newAnimation('Wave', 'wave'); ed.setProp(id, 'autoplay', ed.animator.animId); ed.openAnimator(false); })),
      h('h4', 'My Models'), fileIn,
      h('button.st-big#studio-upload', { onclick: () => fileIn.click() }, '⬆️ Upload .glb / .gltf / .obj'),
      h('p.st-hint', 'Blender: File → Export → glTF 2.0 → "glTF Binary (.glb)". Rigged models (armature) can be animated.'),
      models.length ? h('div.st-grid', models.map(m => item(m.isRig ? '🦴' : '📦', m.name, () => ed.insert('model', { modelId: m.id, name: m.name }), { 'data-model': m.id }))) : h('p.st-hint', 'No models uploaded yet.'));
  }

  // ---------- right: properties ----------
  renderProps() {
    const ed = this.ed; if (!ed) return;
    const inst = ed.doc.instances.find(i => i.id === ed.selectedId);
    clear(this.props).append(inst ? (this.scriptSel && inst.scripts?.some(s => s.id === this.scriptSel) ? this.scriptEditor(inst) : this.instProps(inst)) : this.workspaceProps());
  }
  field(label, input) { return h('label.st-field', h('span', label), input); }
  vec(inst, key, step = 0.5) {
    const v = inst[key];
    return h('div.st-vec', ['X', 'Y', 'Z'].map((ax, i) => h('label', ax, h('input', { type: 'number', step, value: num(v[i]), 'data-prop': `${key}.${i}`, onchange: (e) => { const nv = [...inst[key]]; nv[i] = +e.target.value; this.ed.setProp(inst.id, key, nv); } }))));
  }
  instProps(inst) {
    const ed = this.ed, set = (k) => (e) => ed.setProp(inst.id, k, e.target.type === 'checkbox' ? e.target.checked : (e.target.type === 'range' || e.target.type === 'number' ? +e.target.value : e.target.value));
    const isPart = inst.type === 'part';
    const anims = (ed.doc.animations || []).filter(a => a.rigId === inst.id);
    const clips = ed.world.entries.get(inst.id)?.rig?.clips || [];
    return h('div',
      h('h3', TYPE_INFO[inst.type]?.icon, ' ', TYPE_INFO[inst.type]?.label || inst.type),
      this.field('Name', h('input#prop-name', { value: inst.name, maxLength: 40, onchange: set('name') })),
      h('h4', 'Transform'), this.field('Position', this.vec(inst, 'pos')), this.field('Rotation °', this.vec(inst, 'rot', 15)), this.field('Size', this.vec(inst, 'size')),
      h('h4', 'Appearance'),
      isPart ? this.field('Shape', h('select#prop-shape', { onchange: set('shape') }, SHAPES.map(s => h('option', { value: s, selected: inst.shape === s }, s[0].toUpperCase() + s.slice(1))))) : null,
      ['part', 'spawn', 'checkpoint', 'gear'].includes(inst.type) ? this.field('Color', h('input#prop-color', { type: 'color', value: inst.color, onchange: set('color') })) : null,
      ['part', 'spawn', 'checkpoint', 'gear'].includes(inst.type) ? this.field('Material', h('select#prop-material', { onchange: set('material') }, Object.entries(MATERIALS).map(([k, m]) => h('option', { value: k, selected: inst.material === k }, m.name)))) : null,
      isPart ? this.field('Transparency', h('input#prop-transparency', { type: 'range', min: 0, max: 1, step: 0.05, value: inst.transparency || 0, onchange: set('transparency') })) : null,
      h('h4', 'Behavior'),
      this.field('Anchored', h('input#prop-anchored', { type: 'checkbox', checked: inst.anchored !== false, onchange: set('anchored') })),
      inst.type !== 'coin' ? this.field('CanCollide', h('input#prop-collide', { type: 'checkbox', checked: inst.collide !== false, onchange: set('collide') })) : null,
      isPart ? this.field('Kill brick', h('input#prop-kill', { type: 'checkbox', checked: !!inst.kill, onchange: set('kill') })) : null,
      inst.type === 'checkpoint' ? this.field('Order', h('input', { type: 'number', min: 1, value: inst.order || 1, onchange: set('order') })) : null,
      inst.type === 'coin' ? this.field('Value (BB)', h('input', { type: 'number', min: 1, max: 20, value: inst.value || 5, onchange: (e) => ed.setProp(inst.id, 'value', Math.max(1, Math.min(20, +e.target.value))) })) : null,
      inst.type === 'gear' ? this.field('Gear', h('select#prop-gear', { onchange: set('gearId') }, GEAR_LIST.map(g => h('option', { value: g.id, selected: inst.gearId === g.id }, `${g.icon} ${g.name}`)))) : null,
      inst.type === 'model' ? this.field('Model', h('select', { onchange: set('modelId') }, this.models.list().map(m => h('option', { value: m.id, selected: inst.modelId === m.id }, m.name)))) : null,
      (anims.length || clips.length) ? this.field('Autoplay', h('select#prop-autoplay', { onchange: set('autoplay') }, h('option', { value: '' }, '(none)'), anims.map(a => h('option', { value: a.id, selected: inst.autoplay === a.id }, `🎞️ ${a.name}`)), clips.map(c => h('option', { value: `clip:${c.name}`, selected: inst.autoplay === `clip:${c.name}` }, `📼 ${c.name} (from .glb)`)))) : null,
      h('h4', 'Scripts'),
      (inst.scripts || []).length ? h('div', inst.scripts.map(s => h('div.st-scriptrow', h('span', '📜 ', s.text || '(empty)'), h('button.st-mini', { onclick: () => { this.scriptSel = s.id; this.renderLeft(); this.renderProps(); } }, 'Edit')))) : h('p.st-hint', 'No scripts. Add one and describe what this part should do in plain words.'),
      h('button.st-big#add-script', { onclick: () => { const sid = ed.addScript(inst.id, ''); this.scriptSel = sid; this.renderLeft(); this.renderProps(); } }, '＋ Add Script'),
      h('div.st-row.st-actions', h('button.st-mini', { onclick: () => ed.focus() }, '🎯 Focus'), h('button.st-mini', { onclick: () => ed.duplicate() }, '⧉ Duplicate'), h('button.st-mini.danger', { onclick: () => ed.remove() }, '🗑 Delete')));
  }
  scriptEditor(inst) {
    const ed = this.ed, s = inst.scripts.find(x => x.id === this.scriptSel);
    let timer;
    const ta = h('textarea#script-text', { rows: 5, placeholder: 'Describe what this part should do, e.g. "when a player touches this, kill them"', value: s.text || '', oninput: (e) => { clearTimeout(timer); timer = setTimeout(() => ed.updateScript(inst.id, s.id, e.target.value), 250); } });
    this.preview = h('div.st-preview');
    const box = h('div',
      h('h3', '📜 Script on ', h('i', inst.name)),
      h('p.st-hint', 'Write what you want in plain words. No coding needed!'),
      ta,
      h('div.st-row', h('button.st-big#script-apply', { onclick: () => { clearTimeout(timer); ed.updateScript(inst.id, s.id, ta.value); } }, '✔ Apply'), h('label.st-check', h('input#show-code', { type: 'checkbox', checked: this.showCode, onchange: (e) => { this.showCode = e.target.checked; this.renderScriptPreview(); } }), ' Show code (advanced)')),
      this.preview,
      h('h4', 'Ideas (click to use)'), h('div.st-chips', EXAMPLES.map(x => h('button.st-chip', { onclick: () => { ta.value = ta.value ? `${ta.value.replace(/\s+$/, '')}. ${x}` : x; ed.updateScript(inst.id, s.id, ta.value); } }, x))),
      h('p.st-hint', `Translator: ${getScriptTranslator().name}`),
      h('div.st-row.st-actions', h('button.st-mini', { onclick: () => { this.scriptSel = null; this.renderLeft(); this.renderProps(); } }, '← Back to part'), h('button.st-mini.danger', { onclick: () => { ed.removeScript(inst.id, s.id); this.scriptSel = null; this.renderProps(); } }, '🗑 Delete script')));
    setTimeout(() => this.renderScriptPreview(), 0);
    return box;
  }
  renderScriptPreview() {
    const ed = this.ed; if (!ed || !this.preview) return;
    const inst = ed.doc.instances.find(i => i.id === ed.selectedId); const s = inst?.scripts?.find(x => x.id === this.scriptSel); if (!s) return;
    const r = getScriptTranslator().translateSync ? getScriptTranslator().translateSync(s.text || '') : { preview: [], unknown: [] };
    clear(this.preview).append(
      h('div.st-understood', h('b', '🤖 I understood:'), r.preview.length ? h('ul#script-preview', r.preview.map(l => h('li', l))) : h('p.st-hint', s.text ? 'Nothing yet.' : 'Type something above.')),
      r.unknown.length ? h('div.st-unknown#script-unknown', h('b', '🤔 I didn\'t understand: '), r.unknown.map(u => `"${u}"`).join(', '), h('p', HELP)) : null,
      this.showCode ? h('pre.st-code#script-code', JSON.stringify(s.program, null, 2)) : null);
  }
  workspaceProps() {
    const ed = this.ed, doc = ed.doc;
    const reload = (k) => (e) => { const v = e.target.type === 'checkbox' ? e.target.checked : e.target.value; const d = ed.serialize(); d[k] = v; drafts.save(d); this.onReload(d); };
    const set = (k) => (e) => { ed.checkpoint(); doc[k] = e.target.type === 'checkbox' ? e.target.checked : e.target.value; if (k === 'music') this.engine.music.play(doc.music); this.renderProps(); };
    const pub = isPublished(doc.id);
    return h('div',
      h('h3', '🌍 Game settings'),
      this.field('Name', h('input#game-name', { value: doc.name, maxLength: 40, onchange: set('name') })),
      this.field('Description', h('input#game-desc', { value: doc.description || '', maxLength: 120, onchange: set('description') })),
      this.field('Sky', h('select#sky-pick', { onchange: reload('sky') }, Object.entries(SKIES).map(([k, v]) => h('option', { value: k, selected: doc.sky === k }, v.name)))),
      this.field('Ground', h('select#ground-pick', { onchange: reload('ground') }, Object.entries(GROUNDS).map(([k, v]) => h('option', { value: k, selected: doc.ground === k }, v.name)))),
      this.field('Music', h('select#music-pick', { onchange: set('music') }, MUSIC_THEMES.map(m => h('option', { value: m.id, selected: doc.music === m.id }, m.name)))),
      this.field('Snowfall', h('input#snow-toggle', { type: 'checkbox', checked: !!doc.snow, onchange: reload('snow') })),
      this.field('📱 Mobile-playable', h('input#mobile-toggle', { type: 'checkbox', checked: doc.mobile !== false, onchange: set('mobile') })),
      h('h4', 'Starter gears'), h('p.st-hint', 'Every player starts with these.'),
      h('div', GEAR_LIST.map(g => h('label.st-check', h('input', { type: 'checkbox', 'data-starter': g.id, checked: (doc.starterGears || []).includes(g.id), onchange: (e) => { ed.checkpoint(); const s = new Set(doc.starterGears || []); e.target.checked ? s.add(g.id) : s.delete(g.id); doc.starterGears = [...s]; } }), ` ${g.icon} ${g.name}`))),
      h('h4', 'Publishing'), h('p#publish-status', pub ? '✅ Published — it shows in the Games menu. Publish again to update it.' : '📝 Draft — only you can see it here. Press 🚀 Publish to add it to the Games menu.'),
      h('p.st-hint', `${doc.instances.length} instances · ${(doc.animations || []).length} animations`));
  }

  // ---------- animator ----------
  renderAnimator(light = false) {
    const ed = this.ed; if (!ed || !this.anim) return;
    const A = ed.animator;
    this.anim.classList.toggle('hidden', !A.open);
    if (!A.open) return;
    const a = ed.currentAnim();
    if (light && this._timeline) {
      this._timeline.value = A.time; this._timeLabel.textContent = `${A.time.toFixed(2)}s`;
      if (this._rotInputs) ed.boneRotation().forEach((v, i) => { if (document.activeElement !== this._rotInputs[i]) this._rotInputs[i].value = v; });
      return;
    }
    const rigs = ed.rigs();
    if (!rigs.length) { clear(this.anim).append(h('div.st-anim-empty', '🎬 Animator needs a rig. Insert one from the Toolbox (R6 Rig) or upload a rigged .glb from Blender.', h('button.st-mini', { onclick: () => ed.openAnimator(false) }, 'Close'))); return; }
    const rig = ed.world.entries.get(A.rigId)?.rig;
    const bones = rig ? [...rig.bones.keys()] : [];
    const anims = (ed.doc.animations || []).filter(x => x.rigId === A.rigId);
    this._timeline = h('input#anim-time', { type: 'range', min: 0, max: a?.length || 2, step: 0.01, value: A.time, oninput: (e) => { ed.poseAt(+e.target.value); this.renderAnimator(true); } });
    this._timeLabel = h('span.st-time', `${A.time.toFixed(2)}s`);
    const keys = a && A.bone ? (a.tracks[A.bone] || []) : [];
    const allKeys = a ? [...new Set(Object.values(a.tracks).flat().map(k => k.t))] : [];
    const marks = h('div.st-marks', allKeys.map(t => h('span.st-mark' + (keys.some(k => k.t === t) ? '.bone' : ''), { style: { left: `${(t / (a.length || 1)) * 100}%` }, title: `${t}s`, onclick: () => { ed.poseAt(t); this.renderAnimator(); } })));
    const rot = ed.boneRotation();
    this._rotInputs = ['X', 'Y', 'Z'].map((ax, i) => h('input', { type: 'number', step: 5, value: rot[i], 'data-rot': ax, onchange: () => { ed.setBoneRotation(this._rotInputs.map(x => +x.value)); ed.keyBone(); } }));
    clear(this.anim).append(
      h('div.st-anim-head',
        h('b', '🎬 Animator'),
        h('label', 'Rig ', h('select#anim-rig', { onchange: (e) => ed.selectRig(e.target.value) }, rigs.map(r => h('option', { value: r.id, selected: r.id === A.rigId }, `${TYPE_INFO[r.type].icon} ${r.name}`)))),
        h('label', 'Animation ', h('select#anim-pick', { onchange: (e) => { A.animId = e.target.value; ed.poseAt(0); this.renderAnimator(); } }, anims.length ? anims.map(x => h('option', { value: x.id, selected: x.id === A.animId }, x.name)) : h('option', '(none)'))),
        h('button.st-mini#anim-new', { onclick: () => { const n = prompt('Animation name', 'Animation'); if (n) ed.newAnimation(n.slice(0, 30)); } }, '＋ New'),
        a ? h('label', 'Length ', h('input', { type: 'number', min: 0.2, max: 30, step: 0.1, value: a.length, onchange: (e) => ed.setAnimProp('length', Math.max(0.2, +e.target.value)) })) : null,
        a ? h('label.st-check', h('input', { type: 'checkbox', checked: a.loop, onchange: (e) => ed.setAnimProp('loop', e.target.checked) }), ' Loop') : null,
        a ? h('button.st-mini#anim-play', { onclick: () => ed.togglePlay() }, A.playing ? '⏸ Pause' : '▶ Play') : null,
        a ? h('button.st-mini.danger', { onclick: () => ed.deleteAnimation() }, '🗑') : null,
        h('button.st-mini', { onclick: () => ed.openAnimator(false) }, '✕ Close')),
      h('div.st-anim-body',
        h('div.st-bones', h('div.st-gl', 'Joints / bones'), bones.map(b => h('button.st-bone' + (A.bone === b ? '.on' : ''), { 'data-bone': b, onclick: () => ed.selectBone(b) }, b))),
        h('div.st-timeline-wrap',
          a ? h('div', h('div.st-timeline', this._timeline, marks), this._timeLabel) : h('p.st-hint', 'Create an animation with ＋ New.'),
          a && A.bone ? h('div.st-row', h('span', `${A.bone} rotation°`), ...this._rotInputs.map((x, i) => h('label', ['X', 'Y', 'Z'][i], x)),
            h('button.st-big#anim-key', { onclick: () => ed.keyBone() }, '◆ Set keyframe'), h('button.st-mini', { onclick: () => ed.unkeyBone() }, '◇ Delete keyframe')) : (a ? h('p.st-hint', 'Pick a joint, then drag the rotate gizmo or type angles. Each change sets a keyframe at the current time.') : null),
          rig?.clips?.length ? h('div.st-row', h('span', '📼 Animations inside the .glb:'), rig.clips.map(c => h('button.st-mini' + (A.clip === c.name ? '.on' : ''), { onclick: () => ed.playClip(A.clip === c.name ? null : c.name) }, `${A.clip === c.name ? '⏹' : '▶'} ${c.name}`))) : null)));
  }
}
