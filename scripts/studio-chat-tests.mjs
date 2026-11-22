// Intent + apply tests for the offline Studio corner chat.
// Run: node scripts/studio-chat-tests.mjs
import { classifyIntent, EXAMPLE_PHRASES } from '../src/studio/chatIntent.js';
import { planBuild, applyBuild, aabbOf, aabbsOverlap, nextFreeOrigin, originBeside } from '../src/studio/builder.js';
import { handleChat, applyChat, sendChat } from '../src/studio/chat.js';
import { buttonProgram, planGui, makeGuiElement, isSafeImageSrc, collectProjectImages, rememberTexture } from '../src/studio/gui.js';
import { translate } from '../src/studio/nlscript.js';
import { inst } from '../src/studio/builder.js';

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
    remove(ids) {
      this.checkpoint();
      const set = new Set(Array.isArray(ids) ? ids : [ids]);
      doc.instances = doc.instances.filter((i) => !set.has(i.id) && !set.has(i.parent));
      return set.size;
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
  ['coin counter chat creates a bound label', async () => {
    const ed = mockEditor([inst('spawn')]);
    const r = await sendChat('add a coin counter top right', ed);
    const g = ed.doc.gui || [];
    return r.applied && g.length === 1 && g[0].bind === 'coins' && g[0].anchor === 'top-right' && g[0].type === 'label';
  }],
  ['shop button creates a button that toggles a hidden panel', async () => {
    const ed = mockEditor([inst('spawn')]);
    const r = await sendChat('make a shop button that opens a panel', ed);
    const g = ed.doc.gui || [];
    const btn = g.find((x) => x.type === 'button');
    const panel = g.find((x) => x.type === 'frame');
    return r.applied && btn && panel && btn.toggles === panel.id && panel.visible === false;
  }],
  ['gui add is one undo step', async () => {
    const ed = mockEditor([inst('spawn')]);
    await sendChat('add a health bar', ed);
    const n = (ed.doc.gui || []).length;
    ed.undo();
    return n >= 1 && (ed.doc.gui || []).length === 0;
  }],
  ['first-person setting toggles the game flag', async () => {
    const ed = mockEditor([inst('spawn')]);
    await sendChat('toggle first person', ed);
    return ed.doc.firstPerson === true;
  }],
  ['buttonProgram gives a click rule for give 10 coins', () => {
    const r = buttonProgram('give 10 coins');
    return r.program.rules[0].trigger.type === 'click' && r.program.rules[0].actions.some((a) => a.do === 'addVar' && a.name === 'coins' && a.amount === 10);
  }],
  ['translator understands teleport to spawn and toggle first person on click', () => {
    const a = translate('when clicked, teleport to spawn');
    const b = translate('when clicked, toggle first person');
    return a.program.rules[0].actions.some((x) => x.do === 'teleport' && x.to === 'spawn')
      && b.program.rules[0].actions.some((x) => x.do === 'firstPerson' && x.on === 'toggle');
  }],
  ['planGui health bar binds health', () => {
    const p = planGui({ kind: 'gui', type: 'bar', bind: 'health', text: 'Health', anchor: 'top-left' });
    return p.elements[0].type === 'bar' && p.elements[0].bind === 'health';
  }],
  ['second house at the same preferred origin does not overlap the first', () => {
    const a = planBuild(C('build a small house'), { origin: [0, 0, 0] });
    const b = planBuild(C('build a small house'), { origin: [0, 0, 0], existing: a.instances });
    return a.ok && b.ok && !aabbsOverlap(aabbOf(a.instances), aabbOf(b.instances), 0.4);
  }],
  ['a tower placed beside a house stays clear of it', () => {
    const house = planBuild(C('build a small house'), { origin: [0, 0, 0] });
    const tower = planBuild(C('make a tower 10 high'), { existing: house.instances, selection: house.instances });
    return !aabbsOverlap(aabbOf(house.instances), aabbOf(tower.instances), 0.4);
  }],
  ['applyChat places a second build without overlapping', () => {
    const ed = mockEditor([inst('spawn', { pos: [0, 0.2, 0] })]);
    applyChat(ed, handleChat('build a small house'), { origin: [0, 0, 0] });
    applyChat(ed, handleChat('make a tower 10 high'), { origin: [0, 0, 0] });
    const tower = ed.doc.instances.filter((i) => /Tower/.test(i.name));
    const house = ed.doc.instances.filter((i) => /House/.test(i.name));
    return house.length && tower.length && !aabbsOverlap(aabbOf(house), aabbOf(tower), 0.4);
  }],
  ['a 3 story building is a building with 3 stories', () => {
    const i = C('make a 3 story building');
    return i.template === 'building' && i.stories === 3;
  }],
  ['a 10 jump obby parses count 10', () => C('make a 10 jump obby').template === 'obby' && C('make a 10 jump obby').count === 10],
  ['tree, car, lamp, maze, arena, shop, fence, ladder classify as builds', () => {
    return ['add a tree', 'make a simple car', 'add a lamp post', 'make a maze', 'make an arena', 'make a shop', 'add a fence', 'add a ladder']
      .every((p) => C(p).kind === 'build');
  }],
  ['wooden house captures material', () => C('build a wooden house').material === 'wood'],
  ['make it bigger / make it blue / undo that are tweaks', () => {
    return C('make it bigger').kind === 'tweak' && C('make it bigger').scale > 1
      && C('make it blue').kind === 'tweak' && C('make it blue').colorName === 'blue'
      && C('undo that').kind === 'undoLast';
  }],
  ['3 story building plan has 3 floors and a roof', () => {
    const p = planBuild(C('make a 3 story building'));
    const floors = p.instances.filter((i) => /Floor/.test(i.name)).length;
    return p.ok && floors === 3 && p.instances.some((i) => /Roof/.test(i.name)) && p.instances.some((i) => /Window/.test(i.name));
  }],
  ['house plan includes a door and windows', () => {
    const names = planBuild(C('build a small house')).instances.map((i) => i.name).join(' ');
    return /Door/.test(names) && /Window/.test(names);
  }],
  ['10 jump obby has 10 jump pads and a finish', () => {
    const p = planBuild(C('make a 10 jump obby'));
    return p.instances.filter((i) => /Jump/.test(i.name)).length === 10 && p.instances.some((i) => i.type === 'checkpoint' || /Finish|Goal/.test(i.name));
  }],
  ['maze has a floor and many walls', () => {
    const p = planBuild(C('make a maze'));
    return p.instances.some((i) => /Floor/.test(i.name)) && p.instances.filter((i) => /Wall/.test(i.name)).length > 8;
  }],
  ['tree has a trunk and leaves', () => {
    const p = planBuild(C('add a tree'));
    return p.instances.some((i) => /Trunk/.test(i.name)) && p.instances.some((i) => /Leaves/.test(i.name));
  }],
  ['make it bigger scales the last build', async () => {
    const ed = mockEditor([inst('spawn')]);
    await sendChat('add a tree', ed);
    const before = ed.doc.instances.find((i) => /Trunk/.test(i.name)).size[1];
    const r = await sendChat('make it bigger', ed);
    const after = ed.doc.instances.find((i) => /Trunk/.test(i.name)).size[1];
    return r.applied && after > before * 1.2;
  }],
  ['make it blue recolors the last build', async () => {
    const ed = mockEditor([inst('spawn')]);
    await sendChat('add a lamp post', ed);
    const r = await sendChat('make it blue', ed);
    const pole = ed.doc.instances.find((i) => /Pole/.test(i.name));
    return r.applied && pole.color === '#3f8fd0';
  }],
  ['undo that removes the last build', async () => {
    const ed = mockEditor([inst('spawn')]);
    const n = ed.doc.instances.length;
    await sendChat('add a tree', ed);
    const mid = ed.doc.instances.length;
    const r = await sendChat('undo that', ed);
    return r.applied && mid > n && ed.doc.instances.length === n && !ed.doc.instances.some((i) => /Tree/.test(i.name));
  }],

  // ---- fix/ai-chat-live: polite phrasing, town template, closest-template fallback ----
  ['polite and filler house phrases all build a house', () => {
    return ['make me a house', 'build me a house', 'i want a house', 'can you make me a house', 'could you please build me a house',
      'Make me a house.', 'please make a house', 'i would like a house', 'give me a house', 'a house', 'house', 'make me a little house', 'make me some house']
      .every((p) => { const i = C(p); return i.kind === 'build' && i.template === 'house'; });
  }],
  ['"little" and "some" never block a build', () => {
    return C('make me a little village').template === 'town' && C('can you make some trees').template === 'tree' && C('i want a little tower').template === 'tower';
  }],
  ['town phrases all classify as a town', () => {
    return ['make me a town', 'can you make a town', 'make a city', 'make me a little village', 'build me a town please', 'i want a town', 'make a neighborhood']
      .every((p) => { const i = C(p); return i.kind === 'build' && i.template === 'town'; });
  }],
  ['city phrase builds a city variant', () => C('make a city').city === true && planBuild(C('make a city')).summary === 'a little city'],
  ['town plan has houses, roads, a shop, trees, lamps and a fountain', () => {
    const names = planBuild(C('make me a town')).instances.map((i) => i.name).join(' ');
    return /House1_/.test(names) && /House4_/.test(names) && /Road_/.test(names) && /Shop_/.test(names) && /Tree1_/.test(names) && /Lamp1_/.test(names) && /Fountain_/.test(names);
  }],
  ['town pieces do not overlap each other (roads are flat ground)', () => {
    const parts = planBuild(C('make me a town')).instances;
    const groups = new Map();
    for (const p of parts) { const k = p.name.split('_')[0]; if (k === 'Road') continue; (groups.get(k) || groups.set(k, []).get(k)).push(p); }
    const keys = [...groups.keys()];
    for (let a = 0; a < keys.length; a++) for (let b = a + 1; b < keys.length; b++) {
      if (aabbsOverlap(aabbOf(groups.get(keys[a])), aabbOf(groups.get(keys[b])), 0.01)) { console.log('  overlap', keys[a], keys[b]); return false; }
    }
    return keys.length >= 12;
  }],
  ['city pieces do not overlap either', () => {
    const parts = planBuild(C('make a city')).instances;
    const groups = new Map();
    for (const p of parts) { const k = p.name.split('_')[0]; if (k === 'Road') continue; (groups.get(k) || groups.set(k, []).get(k)).push(p); }
    const keys = [...groups.keys()];
    for (let a = 0; a < keys.length; a++) for (let b = a + 1; b < keys.length; b++) {
      if (aabbsOverlap(aabbOf(groups.get(keys[a])), aabbOf(groups.get(keys[b])), 0.01)) return false;
    }
    return true;
  }],
  ['a town does not overlap an existing house', () => {
    const house = planBuild(C('build a small house'), { origin: [0, 0, 0] });
    const town = planBuild(C('make me a town'), { existing: house.instances, selection: [], lookPoint: [0, 0, 0] });
    return !aabbsOverlap(aabbOf(house.instances), aabbOf(town.instances), 0.4);
  }],
  ['make me a town applies as one undo with a group', async () => {
    const ed = mockEditor([inst('spawn')]);
    const r = await sendChat('make me a town', ed);
    return r.applied && ed.doc.instances.length > 60 && /town/i.test(r.text);
  }],
  ['unknown build nouns fall back to the closest template with a friendly note', () => {
    const boat = C('make me a boat'), castle = C('i want a castle'), sky = C('make me a skyscraper'), pool = C('make me a swimming pool');
    return boat.template === 'car' && boat.note && castle.template === 'house' && sky.template === 'building' && pool.template === 'fountain';
  }],
  ['a build request we cannot name still builds something', async () => {
    const ed = mockEditor([inst('spawn')]);
    const r = await sendChat('make me a spaceship', ed);
    return r.applied && /closest/i.test(r.text) && !/can'?t|cannot|didn'?t understand/i.test(r.text);
  }],
  ['no polite build request ever says can\'t or didn\'t understand', async () => {
    for (const p of ['make me a town', 'make me a house', 'build me a house', 'can you make a town', 'make a city', 'make me a little village', 'i want a house', 'make me a pizza', 'i want a rocket']) {
      const ed = mockEditor([inst('spawn')]);
      const r = await sendChat(p, ed);
      if (!r.applied || /can'?t|cannot|didn'?t understand/i.test(r.text)) { console.log('  bad:', p, r.text); return false; }
    }
    return true;
  }],
  ['script phrases are not hijacked by the build fallback', () => {
    return C('give 10 coins when touched').kind === 'script' && C('make the red part kill players').kind === 'script'
      && C('write a poem about penguins').kind === 'unknown' && C('tell me a joke').kind === 'unknown';
  }],
  ['house with 3 stories becomes a building', () => C('make me a house with 3 stories').template === 'building'],
  ['add a fountain builds a fountain', () => C('add a fountain').template === 'fountain' && planBuild(C('add a fountain')).instances.length >= 4],
  ['isSafeImageSrc allows http(s) and data images, rejects javascript', () => {
    return isSafeImageSrc('https://example.com/icon.png')
      && isSafeImageSrc('http://example.com/a.jpg')
      && isSafeImageSrc('data:image/png;base64,aaa')
      && isSafeImageSrc('blob:https://example.com/1')
      && !isSafeImageSrc('javascript:alert(1)')
      && !isSafeImageSrc('/relative.png')
      && !isSafeImageSrc('file:///etc/passwd');
  }],
  ['collectProjectImages lists thumbnail, textures, GUI srcs, and extras', () => {
    const doc = {
      thumbnail: 'https://example.com/thumb.png',
      textures: [{ name: 'Wood', src: 'https://example.com/wood.png' }],
      gui: [
        { type: 'image', name: 'Logo', src: 'https://example.com/logo.png' },
        { type: 'image', name: 'Logo copy', src: 'https://example.com/logo.png' },
        { type: 'button', src: 'https://example.com/ignored.png' },
      ],
    };
    const list = collectProjectImages(doc, [{ thumbnail: 'https://example.com/draft.png', name: 'Other game' }]);
    const srcs = list.map((i) => i.src);
    return srcs.length === 4
      && srcs.includes('https://example.com/thumb.png')
      && srcs.includes('https://example.com/wood.png')
      && srcs.includes('https://example.com/logo.png')
      && srcs.includes('https://example.com/draft.png')
      && !srcs.includes('https://example.com/ignored.png');
  }],
  ['rememberTexture stores a safe URL once', () => {
    const doc = {};
    const ok = rememberTexture(doc, 'https://example.com/a.png', 'A');
    rememberTexture(doc, 'https://example.com/a.png', 'A again');
    const bad = rememberTexture(doc, 'javascript:alert(1)', 'Nope');
    return ok && !bad && doc.textures.length === 1 && doc.textures[0].src === 'https://example.com/a.png';
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
