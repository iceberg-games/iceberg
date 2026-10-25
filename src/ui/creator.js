// Iceberg Studio UI (Roblox Studio-style): ribbon, Explorer, Toolbox,
// Properties, plain-words Script editor and Animator. Talks to the editor
// instance from src/studio/editor.js (engine.game while editing).
import { h, clear } from './dom.js';
import { hasPerk } from '../core/plus.js';
import { bus } from '../core/events.js';
import { TYPE_INFO, MATERIALS, SHAPES } from '../studio/instances.js';
import { SKIES, GROUNDS } from '../studio/world.js';
import { GEAR_LIST, GEARS } from '../studio/gears.js';
import { MUSIC_THEMES } from '../audio/music.js';
import { EXAMPLES, HELP, CHEATSHEET } from '../studio/nlscript.js';
import { getScriptTranslator } from '../studio/ai.js';
import { drafts, publish, isPublished } from '../studio/store.js';
import { upgradeDoc } from '../studio/templates.js';
import { exportGameJSON, importGameJSON, downloadText } from '../core/share.js';
import { isMobile, onDeviceChange } from '../core/device.js';

const num = (v) => (Math.round(v * 1000) / 1000).toString();

export class CreatorPanel {
  constructor(root, { engine, models, ui, onTest, onExit, onReload }) {
    Object.assign(this, { root, engine, models, ui, onTest, onExit, onReload });
    this.el = h('div.studio.hidden#creator-panel');
    root.append(this.el);
    this.leftTab = 'explorer'; this.scriptSel = null; this.showCode = false; this.collapsed = new Set(); this.anchor = null;
    // Device mode 'mobile' uses the simple Mobile Studio (src/ui/mobileStudio.js) instead of this panel.
    bus.on('game:loaded', ({ game }) => { if (game.editing && !isMobile()) this.show(game); else this.hide(); });
    onDeviceChange(() => { const g = this.engine.game; if (g?.editing) (isMobile() ? this.hide() : this.show(g)); });
    bus.on('game:unloaded', () => this.hide());
    bus.on('models:changed', () => this.ed && this.renderLeft());
    bus.on('studio:changed', (what) => this._onChange(what));
    addEventListener('keydown', (e) => this._onKey(e), true);
  }
  get ed() { return this.engine.game?.editing && !isMobile() ? this.engine.game : null; }
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
    if (e.target.closest?.('input, textarea, select') || document.querySelector('#name-dialog')) return;
    const ctrl = e.ctrlKey || e.metaKey, k = e.code;
    const stop = () => { e.preventDefault(); e.stopPropagation(); };
    if (['KeyT', 'KeyL', 'KeyM', 'KeyH', 'KeyB'].includes(k) && !ctrl) { e.stopPropagation(); return; } // don't open game drawers in Studio
    if (ctrl && k === 'KeyZ') { stop(); e.shiftKey ? ed.redo() : ed.undo(); }
    else if (ctrl && k === 'KeyY') { stop(); ed.redo(); }
    else if (ctrl && k === 'KeyD') { stop(); ed.duplicate(); }
    else if (ctrl && k === 'KeyA') { stop(); this.scriptSel = null; ed.selectAll(); }
    else if (ctrl && k === 'KeyC') { stop(); const n = ed.copy(); if (n) this.ui.toast(`Copied ${n} item${n > 1 ? 's' : ''}`, '📋'); }
    else if (ctrl && k === 'KeyX') { stop(); ed.cut(); }
    else if (ctrl && k === 'KeyV') { stop(); ed.paste(); }
    else if (ctrl && k === 'KeyG') { stop(); e.shiftKey ? ed.ungroup() : ed.group(); }
    else if (k === 'Escape' && !ed.animator.open) { ed.select(null); }
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
      h('div.st-status', 'Right-drag: look · W A S D + Q/E: fly · Click: select · Shift/Ctrl+click: add · Drag on empty space: box select · Ctrl+A all · 1–4: tools · Ctrl+Z/Y · Ctrl+C/X/V · Ctrl+D duplicate · Ctrl+G group (Shift: ungroup) · Del · F focus · Ctrl+S save'),
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
        h('button.st-tool#dup-btn', { disabled: !ed.selectedId, onclick: () => ed.duplicate(), title: 'Duplicate (Ctrl+D)' }, h('span', '⧉'), 'Duplicate'),
        h('button.st-tool#del-btn', { disabled: !ed.selectedId, onclick: () => ed.remove(), title: 'Delete (Del)' }, h('span', '🗑'), 'Delete'),
        h('button.st-tool#copy-btn', { disabled: !ed.selectedId, onclick: () => ed.copy(), title: 'Copy (Ctrl+C)' }, h('span', '📋'), 'Copy'),
        h('button.st-tool#paste-btn', { disabled: !ed.hasClipboard(), onclick: () => ed.paste(), title: 'Paste (Ctrl+V)' }, h('span', '📥'), 'Paste'),
        h('button.st-tool#group-btn', { disabled: !ed.selectedId, onclick: () => ed.group(), title: 'Group into a Model (Ctrl+G)' }, h('span', '🗃️'), 'Group'),
        h('button.st-tool#ungroup-btn', { disabled: !ed.selection.some(id => ed.doc.instances.find(i => i.id === id)?.type === 'group'), onclick: () => ed.ungroup(), title: 'Ungroup (Ctrl+Shift+G)' }, h('span', '📤'), 'Ungroup'),
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
    const label = { explorer: '🗂️ Explorer', toolbox: '🧰 Toolbox', phrases: '📖 Phrases' };
    const tabs = h('div.st-tabs', Object.keys(label).map(t => h('button.st-tab' + (this.leftTab === t ? '.on' : ''), { 'data-tab': t, onclick: () => { this.leftTab = t; this.renderLeft(); } }, label[t])));
    clear(this.left).append(tabs, this.leftTab === 'explorer' ? this.explorer() : this.leftTab === 'toolbox' ? this.toolbox() : this.phrases());
  }
  explorer() {
    const ed = this.ed, doc = ed.doc;
    const rows = [h('div.st-node.root' + (!ed.selectedId ? '.sel' : ''), { 'data-node': 'workspace', onclick: () => { this.scriptSel = null; ed.select(null); } }, '🌍 Workspace', h('small', ` (${doc.instances.length})`))];
    const byId = new Map(doc.instances.map(i => [i.id, i]));
    const kids = new Map(); for (const i of doc.instances) { const p = i.parent && byId.has(i.parent) ? i.parent : null; if (!kids.has(p)) kids.set(p, []); kids.get(p).push(i); }
    const order = []; // visible rows in display order (for Shift range-select)
    const clickNode = (e, id) => {
      this.scriptSel = null;
      if (e.shiftKey && this.anchor && order.includes(this.anchor)) { const a = order.indexOf(this.anchor), b = order.indexOf(id); ed.selectMany(order.slice(Math.min(a, b), Math.max(a, b) + 1), e.ctrlKey || e.metaKey); }
      else if (e.ctrlKey || e.metaKey) { ed.toggleSelect(id); this.anchor = id; }
      else { ed.select(id); this.anchor = id; }
    };
    const walk = (parent, depth) => {
      for (const inst of kids.get(parent) || []) {
        order.push(inst.id);
        const sel = ed.isSelected(inst.id) && !this.scriptSel;
        const badge = inst.kill || inst.material === 'lava' ? ' 🔥' : '';
        const isGroup = inst.type === 'group', open = !this.collapsed.has(inst.id);
        const pad = { paddingLeft: `${6 + depth * 14}px` };
        rows.push(h('div.st-node' + (sel ? '.sel' : '') + (isGroup ? '.group' : ''), { 'data-node': inst.id, style: pad, title: 'Click to select · Shift/Ctrl+click to multi-select · double-click to rename', onclick: (e) => clickNode(e, inst.id), ondblclick: () => this.askName('Rename', inst.name).then(n => { if (n) ed.setProp(inst.id, 'name', n.slice(0, 40)); }) },
          isGroup ? h('span.st-twisty', { 'data-twisty': inst.id, onclick: (e) => { e.stopPropagation(); open ? this.collapsed.add(inst.id) : this.collapsed.delete(inst.id); this.renderLeft(); } }, open ? '▾' : '▸') : null,
          h('span.ic', TYPE_INFO[inst.type]?.icon || '🧱'), inst.name + badge, isGroup ? h('small', ` (${(kids.get(inst.id) || []).length})`) : null));
        const cpad = { paddingLeft: `${20 + depth * 14}px` };
        for (const sc of inst.scripts || []) rows.push(h('div.st-node.child' + (this.scriptSel === sc.id ? '.sel' : ''), { 'data-script': sc.id, style: cpad, onclick: () => { this.scriptSel = sc.id; ed.select(inst.id); } }, h('span.ic', '📜'), sc.text ? `Script: ${sc.text.slice(0, 24)}${sc.text.length > 24 ? '…' : ''}` : 'Script (empty)'));
        for (const a of (doc.animations || []).filter(a => a.rigId === inst.id)) rows.push(h('div.st-node.child', { style: cpad, onclick: () => { ed.select(inst.id); ed.openAnimator(true); ed.animator.animId = a.id; ed.poseAt(0); this.renderAnimator(); } }, h('span.ic', '🎞️'), `Animation: ${a.name}`));
        if (isGroup && open) walk(inst.id, depth + 1);
      }
    };
    walk(null, 0);
    return h('div.st-explorer', rows);
  }
  /** 📖 Phrases: every sentence the offline translator understands, grouped; click to use */
  phrases() {
    const ed = this.ed;
    const use = (text) => {
      const inst = ed.doc.instances.find(i => i.id === ed.selectedId && i.type !== 'group');
      if (!inst) { this.ui.toast('Select a part first, then click a phrase to give it that script.', '👆'); return; }
      const cur = this.scriptSel && inst.scripts?.find(x => x.id === this.scriptSel);
      if (cur) { const t = cur.text ? `${cur.text.replace(/[\s.]+$/, '')}. ${text}` : text; ed.updateScript(inst.id, cur.id, t); const ta = this.props.querySelector('#script-text'); if (ta) ta.value = t; }
      else { this.scriptSel = ed.addScript(inst.id, text); this.renderLeft(); this.renderProps(); }
    };
    return h('div.st-phrases',
      h('p.st-hint', 'Click a phrase to add it to the selected part\'s script (or start a new script). Change the words, numbers and names freely — e.g. "teleport them to the part called Castle". Join ideas with "and" / "then".'),
      CHEATSHEET.map(cat => h('div.st-phrase-cat', h('h4', cat.title), cat.items.map(x => h('button.st-phrase', { 'data-phrase': x, onclick: () => use(x) }, x)))));
  }
  /** in-studio text prompt (replaces window.prompt) → Promise<string|null> */
  askName(title, initial = '') {
    document.querySelector('#name-dialog')?.remove();
    return new Promise((resolve) => {
      const done = (v) => { wrap.remove(); resolve(v); };
      const input = h('input#name-dialog-input', { value: initial, maxLength: 40, onkeydown: (e) => { e.stopPropagation(); if (e.key === 'Enter') done(input.value.trim() || null); if (e.key === 'Escape') done(null); } });
      const wrap = h('div.st-dialog-back#name-dialog', { onclick: (e) => { if (e.target === wrap) done(null); } },
        h('div.st-dialog', h('b', title), input,
          h('div.st-row', h('button.st-big#name-dialog-ok', { onclick: () => done(input.value.trim() || null) }, 'OK'), h('button.st-mini#name-dialog-cancel', { onclick: () => done(null) }, 'Cancel'))));
      this.el.append(wrap); setTimeout(() => { input.focus(); input.select(); }, 0);
    });
  }
  // Iceberg Plus perk: save the selected instance as a reusable prefab (local-only). Gated on the Plus flag.
  prefabSection() {
    const ed = this.ed, KEY = 'iceberg:v1:prefabs';
    if (!hasPerk('studioCustomPrefab')) return h('p.st-hint.plus-lock#prefab-locked', '🔒 Custom prefabs are an Iceberg Plus perk (coming soon, $9/mo). Try it via Settings → Iceberg Plus (demo).');
    const list = (() => { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; } })();
    const save = () => {
      if (!hasPerk('studioCustomPrefab')) return;
      const inst = ed.doc.instances.find(i => i.id === ed.selectedId && i.type !== 'group');
      if (!inst) { this.ui.toast('Select a part first', '🧩'); return; }
      const { id, parent, ...props } = JSON.parse(JSON.stringify(inst));
      list.push({ name: props.name || 'Prefab', type: props.type || 'part', props }); localStorage.setItem(KEY, JSON.stringify(list.slice(-30)));
      this.ui.toast(`Saved prefab "${props.name || 'Prefab'}"`, '🧩'); this.renderLeft();
    };
    return h('div#prefab-section', h('button.st-big#prefab-save', { onclick: save }, '💾 Save selection as prefab'),
      list.length ? h('div.st-grid', list.map(p => h('button.st-tbx', { 'data-prefab': p.name, onclick: () => hasPerk('studioCustomPrefab') && ed.insert(p.type, { ...p.props }) }, h('span', '🧩'), p.name))) : h('p.st-hint', 'No prefabs yet.'));
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
      h('h4', '🧩 My Prefabs ', h('span.plus-badge', '❄️ PLUS')), this.prefabSection(),
      h('h4', 'My Models'), fileIn,
      h('button.st-big#studio-upload', { onclick: () => fileIn.click() }, '⬆️ Upload .glb / .gltf / .obj'),
      h('p.st-hint', 'Blender: File → Export → glTF 2.0 → "glTF Binary (.glb)". Rigged models (armature) can be animated.'),
      models.length ? h('div.st-grid', models.map(m => item(m.isRig ? '🦴' : '📦', m.name, () => ed.insert('model', { modelId: m.id, name: m.name }), { 'data-model': m.id }))) : h('p.st-hint', 'No models uploaded yet.'));
  }

  // ---------- right: properties ----------
  renderProps() {
    const ed = this.ed; if (!ed) return;
    const inst = ed.doc.instances.find(i => i.id === ed.selectedId);
    if (ed.selection.length > 1) { this.scriptSel = null; clear(this.props).append(this.multiProps()); return; }
    if (inst?.type === 'group') { clear(this.props).append(this.groupProps(inst)); return; }
    clear(this.props).append(inst ? (this.scriptSel && inst.scripts?.some(s => s.id === this.scriptSel) ? this.scriptEditor(inst) : this.instProps(inst)) : this.workspaceProps());
  }
  field(label, input) { return h('label.st-field', h('span', label), input); }
  vec(inst, key, step = 0.5) {
    const v = inst[key];
    return h('div.st-vec', ['X', 'Y', 'Z'].map((ax, i) => h('label', ax, h('input', { type: 'number', step, value: num(v[i]), 'data-prop': `${key}.${i}`, onchange: (e) => { const nv = [...inst[key]]; nv[i] = +e.target.value; this.ed.setProp(inst.id, key, nv); } }))));
  }
  /** properties shared by every selected item; editing one sets it on all of them (one undo step) */
  multiProps() {
    const ed = this.ed, list = ed.selection.map(id => ed.doc.instances.find(i => i.id === id)).filter(Boolean);
    const same = (k) => { const v = JSON.stringify(list[0][k]); return list.every(i => JSON.stringify(i[k]) === v) ? list[0][k] : undefined; };
    const has = (k, types) => list.every(i => !types || types.includes(i.type));
    const parts = list.filter(i => i.type !== 'group');
    const set = (k) => (e) => ed.setPropMany(null, k, e.target.type === 'checkbox' ? e.target.checked : (e.target.type === 'range' || e.target.type === 'number' ? +e.target.value : e.target.value));
    const mvec = (key, step) => h('div.st-vec', ['X', 'Y', 'Z'].map((ax, i) => { const vals = parts.map(p => p[key]?.[i]); const one = vals.every(v => v === vals[0]); return h('label', ax, h('input', { type: 'number', step, value: one && vals.length ? num(vals[0]) : '', placeholder: '—', 'data-mprop': `${key}.${i}`, onchange: (e) => { if (e.target.value !== '') ed.setPropMany(parts.map(p => p.id), key, +e.target.value, i); } })); }));
    const allPart = has(0, ['part']), colorable = has(0, ['part', 'spawn', 'checkpoint', 'gear']);
    return h('div#multi-props',
      h('h3', `🧩 ${list.length} items selected`),
      h('p.st-hint', 'Changes apply to every selected item. Blank (—) means they differ. Drag the gizmo to move/rotate/scale them together around their centre.'),
      parts.length ? [h('h4', 'Transform'), this.field('Position', mvec('pos', 0.5)), this.field('Rotation °', mvec('rot', 15)), this.field('Size', mvec('size', 0.5))] : null,
      colorable ? h('h4', 'Appearance') : null,
      allPart ? this.field('Shape', h('select#mprop-shape', { onchange: set('shape') }, same('shape') === undefined ? h('option', { value: '', selected: true, disabled: true }, '(mixed)') : null, SHAPES.map(sh => h('option', { value: sh, selected: same('shape') === sh }, sh[0].toUpperCase() + sh.slice(1))))) : null,
      colorable ? this.field('Color', h('input#mprop-color', { type: 'color', value: same('color') || '#888888', onchange: set('color') })) : null,
      colorable ? this.field('Material', h('select#mprop-material', { onchange: set('material') }, same('material') === undefined ? h('option', { value: '', selected: true, disabled: true }, '(mixed)') : null, Object.entries(MATERIALS).map(([k, m]) => h('option', { value: k, selected: same('material') === k }, m.name)))) : null,
      allPart ? this.field('Transparency', h('input#mprop-transparency', { type: 'range', min: 0, max: 1, step: 0.05, value: same('transparency') || 0, onchange: set('transparency') })) : null,
      h('h4', 'Behavior'),
      this.field('Anchored', h('input#mprop-anchored', { type: 'checkbox', checked: list.every(i => i.anchored !== false), onchange: set('anchored') })),
      this.field('CanCollide', h('input#mprop-collide', { type: 'checkbox', checked: list.every(i => i.collide !== false), onchange: set('collide') })),
      allPart ? this.field('Kill brick', h('input#mprop-kill', { type: 'checkbox', checked: list.every(i => i.kill), onchange: set('kill') })) : null,
      h('div.st-row.st-actions',
        h('button.st-mini#multi-group', { onclick: () => ed.group() }, '🗃️ Group'), h('button.st-mini', { onclick: () => ed.focus() }, '🎯 Focus'),
        h('button.st-mini', { onclick: () => ed.duplicate() }, '⧉ Duplicate'), h('button.st-mini', { onclick: () => ed.copy() }, '📋 Copy'), h('button.st-mini.danger', { onclick: () => ed.remove() }, '🗑 Delete')));
  }
  groupProps(g) {
    const ed = this.ed, n = ed.descendants(g.id).length;
    return h('div#group-props',
      h('h3', '🗃️ Model (group)'),
      this.field('Name', h('input#prop-name', { value: g.name, maxLength: 40, onchange: (e) => ed.setProp(g.id, 'name', e.target.value) })),
      h('p.st-hint', `${n} item${n === 1 ? '' : 's'} inside. Clicking any of them in the 3D view selects the whole Model; pick single parts in the Explorer. Moving, rotating and scaling it moves everything inside.`),
      h('h4', 'Transform'), this.field('Position', this.vec(g, 'pos')),
      h('div.st-row.st-actions', h('button.st-mini#ungroup-model', { onclick: () => ed.ungroup() }, '📤 Ungroup'), h('button.st-mini', { onclick: () => ed.focus() }, '🎯 Focus'),
        h('button.st-mini', { onclick: () => ed.duplicate() }, '⧉ Duplicate'), h('button.st-mini.danger', { onclick: () => ed.remove() }, '🗑 Delete')));
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
    const names = ed.doc.instances.map(i => i.name).filter(Boolean);
    const r = getScriptTranslator().translateSync ? getScriptTranslator().translateSync(s.text || '', { names }) : { preview: [], unknown: [], suggestions: [] };
    const useSuggestion = (x) => { const t = (s.text || '').trim(); const base = r.unknown.length ? r.unknown.reduce((acc, u) => acc.replace(u, ''), t).replace(/(\s*(,|\.|\band\b|\bthen\b)\s*)+$/i, '').trim() : t; const nt = base ? `${base.replace(/[\s.]+$/, '')}. ${x}` : x; ed.updateScript(inst.id, s.id, nt); const ta = this.props.querySelector('#script-text'); if (ta) ta.value = nt; };
    clear(this.preview).append(
      h('div.st-understood', h('b', '🤖 I understood:'), r.preview.length ? h('ul#script-preview', r.preview.map(l => h('li', l))) : h('p.st-hint', s.text ? 'Nothing yet.' : 'Type something above.')),
      r.unknown.length ? h('div.st-unknown#script-unknown', h('b', '🤔 I didn\'t understand: '), r.unknown.map(u => `"${u}"`).join(', '),
        (r.suggestions || []).length ? h('div', h('p', 'Did you mean one of these? (click to use)'), h('div.st-chips#script-suggestions', r.suggestions.map(x => h('button.st-chip.sugg', { onclick: () => useSuggestion(x) }, x)))) : h('p', HELP)) : null,
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
        h('button.st-mini#anim-new', { onclick: () => this.askName('New animation name', 'Animation').then(n => { if (n) ed.newAnimation(n.slice(0, 30)); }) }, '＋ New'),
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
