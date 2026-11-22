// Intent + apply tests for the offline Studio corner chat.
// Run: node scripts/studio-chat-tests.mjs
import { classifyIntent, EXAMPLE_PHRASES } from '../src/studio/chatIntent.js';
import { planBuild, applyBuild } from '../src/studio/builder.js';
import { handleChat, applyChat, sendChat } from '../src/studio/chat.js';
import { inst } from '../src/studio/builder.js';
import { translate } from '../src/studio/nlscript.js';

function mockEditor(seed = []) {
  const doc = { instances: [...seed], animations: [], gui: [], firstPerson: false, updatedAt: 0 };
  const snapshots = [];
  const ed = {
    doc,
    selection: [],
    get selectedId() { return this.selection[this.selection.length - 1] || null; },
    set selectedId(id) { this.selection = id ? [id] : []; },
    checkpoint() { snapshots.push(JSON.stringify({ instances: doc.instances, gui: doc.gui, firstPerson: !!doc.firstPerson })); },
    undo() {
      if (!snapshots.length) return false;
      const o = JSON.parse(snapshots.pop());
      doc.instances = o.instances; doc.gui = o.gui; doc.firstPerson = !!o.firstPerson;
      this.selection = this.selection.filter((id) => doc.instances.some((i) => i.id === id));
      return true;
    },
    canUndo() { return snapshots.length > 0; },
    select(id) { this.selection = id ? [id] : []; },
    selectMany(ids) { this.selection = [...ids]; },
    placementPoint() { return [0, 0, 0]; },
    insertMany(instances, { groupName } = {}) {
      this.checkpoint();
      const ids = [];
      for (const inst of instances) {
        const copy = JSON.parse(JSON.stringify(inst));
        if (doc.instances.some((i) => i.name === copy.name)) copy.name = copy.name + '_' + ids.length;
        doc.instances.push(copy);
        ids.push(copy.id);
      }
      let groupId = null;
      if (groupName && ids.length > 1) {
        const g = inst('group', { name: groupName });
        for (const id of ids) doc.instances.find((i) => i.id === id).parent = g.id;
        doc.instances.push(g);
        groupId = g.id;
        this.selection = [g.id];
      } else this.selection = ids;
      return { ok: true, ids, groupId, count: ids.length };
    },
    addScript(id, text) {
      const inst = doc.instances.find((i) => i.id === id);
      if (!inst) return null;
      this.checkpoint();
      const s = { id: 's_' + Math.random().toString(36).slice(2, 8), name: 'Script', text, program: translate(text, { names: doc.instances.map((i) => i.name) }).program, enabled: true };
      (inst.scripts ||= []).push(s);
      return s.id;
    },
    addGui(intent) {
      this.checkpoint();
      const ids = [];
      const el = { id: 'gui_' + Math.random().toString(36).slice(2, 8), type: intent.type, name: intent.text || intent.type, text: intent.text || '', anchor: intent.anchor || 'top-right', x: 16, y: 16, w: 160, h: intent.type === 'bar' ? 18 : 36, bind: intent.bind || null, visible: true, color: intent.color, scriptText: '', program: null, toggles: null };
      (doc.gui ||= []).push(el); ids.push(el.id);
      if (intent.togglesPanel) {
        const panel = { id: 'gui_' + Math.random().toString(36).slice(2, 8), type: 'frame', name: `${el.text || 'Shop'} Panel`, text: el.text || 'Shop', anchor: 'center', x: 0, y: 0, w: 280, h: 200, bind: null, visible: false, color: null, scriptText: '', program: null };
        doc.gui.push(panel); el.toggles = panel.id; ids.push(panel.id);
      }
      return { id: ids[0], ids };
    },
    setGameProp(key, value) {
      this.checkpoint();
      doc[key] = value === 'toggle' ? !doc[key] : value;
    },
  };
  return ed;
}

const names = ['Gate', 'Red Door', 'LavaPad'];
const C = (text) => classifyIntent(text, { names });

const cases = [
  ['build a small house is a house build', () => C('build a small house').template === 'house' && C('build a small house').scale < 1],
  ['make a tower 10 high parses height 10', () => C('make a tower 10 high').template === 'tower' && C('make a tower 10 high').height === 10],
  ['add 5 coins in a line parses count and line', () => {
    const i = C('add 5 coins in a line');
    return i.template === 'coins' && i.count === 5 && i.line === true;
  }],
  ['make a bridge is a bridge', () => C('make a bridge').template === 'bridge'],
  ['add a checkpoint is a checkpoint build', () => C('add a checkpoint').template === 'checkpoint'],
  ['five coins uses word numbers', () => C('add five coins in a line').count === 5],
  ['red tower captures color', () => C('build a red tower').color === '#e2474b' && C('build a red tower').colorName === 'red'],
  ['make the red part kill players is a script, not a build', () => C('make the red part kill players').kind === 'script'],
  ['when touched, kill them is a script', () => C('when touched, kill them').kind === 'script'],
  ["my door doesn't work is help", () => C("my door doesn't work").kind === 'help'],
  ["something's wrong is help", () => C("something's wrong").kind === 'help'],
  ['add a coin counter top right is gui', () => {
    const i = C('add a coin counter top right');
    return i.kind === 'gui' && i.bind === 'coins' && i.anchor === 'top-right';
  }],
  ['make a shop button that opens a panel is gui with panel', () => {
    const i = C('make a shop button that opens a panel');
    return i.kind === 'gui' && i.type === 'button' && i.togglesPanel && /shop/i.test(i.text);
  }],
  ['add a health bar is a bar bound to health', () => C('add a health bar').type === 'bar' && C('add a health bar').bind === 'health'],
  ['toggle first person is a setting', () => C('toggle first person').kind === 'setting' && C('toggle first person').value === 'toggle'],
  ['unknown gets 2-3 suggestions and does not pretend', () => {
    const i = C('write a poem about penguins');
    return i.kind === 'unknown' && i.suggestions.length >= 2 && i.suggestions.length <= 3;
  }],
  ['empty text is unknown', () => C('').kind === 'unknown'],

  ['house plan has floor, walls, roof', () => {
    const p = planBuild(C('build a small house'));
    const names = p.instances.map((i) => i.name).join(' ');
    return p.ok && p.instances.length >= 6 && /Floor/.test(names) && /Wall/.test(names) && /Roof/.test(names);
  }],
  ['tower 10 high is about 10 studs tall', () => {
    const p = planBuild(C('make a tower 10 high'));
    const top = Math.max(...p.instances.map((i) => i.pos[1] + i.size[1] / 2));
    return p.ok && Math.abs(top - 10) < 0.15 && p.instances.length >= 3;
  }],
  ['five coins in a line are 5 coins along X', () => {
    const p = planBuild(C('add 5 coins in a line'));
    const xs = p.instances.map((i) => i.pos[0]).sort((a, b) => a - b);
    return p.instances.length === 5 && p.instances.every((i) => i.type === 'coin') && xs[4] - xs[0] > 0;
  }],
  ['bridge has a deck and rails', () => {
    const p = planBuild(C('make a bridge'));
    return p.instances.length === 3 && p.instances.some((i) => /Deck/.test(i.name)) && p.instances.filter((i) => /Rail/.test(i.name)).length === 2;
  }],
  ['checkpoint plan is one checkpoint', () => planBuild(C('add a checkpoint')).instances[0].type === 'checkpoint'],
  ['blue house parts use blue', () => planBuild(C('build a blue house')).instances.filter((i) => i.type === 'part').every((i) => i.color === '#3f8fd0')],

  ['build applies as one undoable action', () => {
    const ed = mockEditor([inst('spawn', { pos: [0, 0.2, 0] })]);
    const before = ed.doc.instances.length;
    const r = applyChat(ed, handleChat('build a small house', { origin: [0, 0, 0] }));
    const mid = ed.doc.instances.length;
    const grouped = ed.doc.instances.some((i) => i.type === 'group');
    const okUndo = ed.undo() && ed.doc.instances.length === before;
    return r.applied && mid > before + 4 && grouped && okUndo;
  }],
  ['script applies to the selected part', () => {
    const pad = inst('part', { name: 'Pad', color: '#a3a2a5' });
    const ed = mockEditor([pad]);
    ed.select(pad.id);
    const r = applyChat(ed, handleChat('when touched, kill them'));
    return r.applied && pad.scripts.length === 1 && pad.scripts[0].program.rules.some((rule) => rule.actions.some((a) => a.do === 'kill'));
  }],
  ['script finds the red part by color', () => {
    const red = inst('part', { name: 'Brick', color: '#e2474b' });
    const blue = inst('part', { name: 'Ice', color: '#3f8fd0' });
    const ed = mockEditor([red, blue]);
    const r = applyChat(ed, handleChat('make the red part kill players'));
    return r.applied && r.targetId === red.id && (red.scripts || []).length === 1 && !(blue.scripts || []).length;
  }],
  ['help on a bad door script reports the missing part', () => {
    const door = inst('part', { name: 'Door' });
    door.scripts = [{ id: 's1', name: 'Script', text: 'When the button is pressed, open the door called Vault', program: translate('When the button is pressed, open the door called Vault').program, enabled: true }];
    const ed = mockEditor([door]);
    ed.select(door.id);
    const r = applyChat(ed, handleChat("my door doesn't work"));
    return r.kind === 'help' && /Vault/.test(r.text) && /no part/.test(r.text);
  }],
  ['unknown reply lists example phrasings and does not apply', () => {
    const r = handleChat('asdf qwer zxcv');
    return r.kind === 'unknown' && r.applied === false && r.suggestions.length >= 2 && /didn't understand/i.test(r.text);
  }],
  ['sendChat build + undo restores the place', async () => {
    const ed = mockEditor([inst('spawn')]);
    const n = ed.doc.instances.length;
    await sendChat('add a checkpoint', ed);
    const added = ed.doc.instances.some((i) => i.type === 'checkpoint');
    ed.undo();
    return added && ed.doc.instances.length === n && !ed.doc.instances.some((i) => i.type === 'checkpoint');
  }],
  ['example phrases stay classified as something we handle', () => {
    const bad = EXAMPLE_PHRASES.filter((p) => classifyIntent(p, { names }).kind === 'unknown');
    return bad.length === 0;
  }],
];

let pass = 0, fail = 0;
for (const [name, fn] of cases) {
  let ok = false;
  try { ok = !!await fn(); } catch (e) { console.log('FAIL:', name, e.stack || e.message); fail++; continue; }
  if (ok) pass++; else { fail++; console.log('FAIL:', name); }
}
console.log(`${pass}/${pass + fail} studio-chat tests passed`);
process.exit(fail ? 1 : 0);
