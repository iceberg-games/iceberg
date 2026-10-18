// Starter maps for Create a Game.
import { makeInstance } from './instances.js';
import { translate } from './nlscript.js';

const script = (text) => { const r = translate(text); return { id: 's_' + Math.random().toString(36).slice(2, 8), name: 'Script', text, program: r.program, enabled: true }; };

export const TEMPLATES = {
  blank: { name: 'Baseplate', desc: 'Empty baseplate with a spawn point', make: () => ({ ground: 'baseplate', sky: 'day', snow: false, instances: [makeInstance('spawn', { pos: [0, 0.2, 0] })] }) },
  obby: { name: 'Obby starter', desc: 'Floating platforms, lava, checkpoint, coins & a gear', make: () => {
    const I = [makeInstance('spawn', { pos: [0, 10, 0] })];
    const colors = ['#e2474b', '#ff8c2a', '#f5c542', '#2f9e6a', '#3f8fd0', '#8b6cf0'];
    for (let i = 0; i < 6; i++) I.push(makeInstance('part', { name: `Stage${i + 1}`, pos: [((i % 2) * 2 - 1) * 2, 10, 7 + i * 6], size: [4, 1, 4], color: colors[i] }));
    I.push(makeInstance('part', { name: 'Lava', kill: true, material: 'lava', color: '#ff4a1c', pos: [0, 0.5, 25], size: [40, 1, 70] }));
    I.push(makeInstance('checkpoint', { pos: [0, 10, 46], order: 1 }));
    I.push(makeInstance('part', { name: 'Spinner', shape: 'cylinder', pos: [0, 10, 54], size: [8, 1, 8], color: '#bfe9ff', material: 'ice', scripts: [script('Spin slowly forever')] }));
    I.push(makeInstance('gear', { pos: [0, 10.5, 62], gearId: 'gravityCoil' }));
    I.push(makeInstance('part', { name: 'Goal', pos: [0, 10, 68], size: [6, 1, 6], color: '#f2c230', material: 'neon', scripts: [script('When touched, you win and play a win sound')] }));
    for (let i = 0; i < 5; i++) I.push(makeInstance('coin', { pos: [((i % 2) * 2 - 1) * 2, 12, 7 + i * 6] }));
    return { ground: 'void', sky: 'sunset', snow: false, instances: I };
  } },
  island: { name: 'Glacier island', desc: 'Snowy island with ice and a few starter parts', make: () => ({ ground: 'island', sky: 'day', snow: true, instances: [
    makeInstance('spawn', { pos: [0, 0.2, 0] }),
    makeInstance('part', { name: 'Iceberg', shape: 'wedge', pos: [10, 2, 6], size: [6, 4, 8], color: '#bfe9ff', material: 'ice' }),
    makeInstance('part', { name: 'Snowball', shape: 'sphere', pos: [-8, 1.5, 4], size: [3, 3, 3], color: '#ffffff', material: 'snow' }),
    makeInstance('coin', { pos: [0, 1.2, 10] }), makeInstance('coin', { pos: [4, 1.2, 12] }),
  ] }) },
};

export function newGameDoc(template = 'blank') {
  const t = TEMPLATES[template] || TEMPLATES.blank;
  return { id: 'g_' + Date.now().toString(36), version: 2, name: 'My Iceberg Game', description: '', music: 'winter', snow: false, mobile: true, starterGears: [], animations: [], ...t.make(), template, createdAt: Date.now(), updatedAt: Date.now() };
}

/** Convert v1 (voxel) docs from the old creator into v2 instances. */
export function upgradeDoc(doc) {
  if (doc.version === 2) return doc;
  const instances = [];
  for (const [x, y, z, type] of doc.blocks || []) instances.push(makeInstance('part', { pos: [x + 0.5, y + 0.5, z + 0.5], size: [1, 1, 1], color: { snow: '#f7fbff', ice: '#bfe9ff', packed: '#7cc4ec', glacier: '#3f8fd0', stone: '#8a96a3', wood: '#9a6b43', red: '#e2474b', yellow: '#f5c542', green: '#2f8f5b', purple: '#8b6cf0', black: '#22262e', frost: '#dfeefa' }[type] || '#a3a2a5', material: type === 'ice' ? 'ice' : 'plastic' }));
  for (const c of doc.coins || []) instances.push(makeInstance('coin', { pos: c }));
  if (doc.spawn) instances.push(makeInstance('spawn', { pos: [doc.spawn[0], doc.spawn[1] + 0.2, doc.spawn[2]] }));
  for (const m of doc.models || []) instances.push(makeInstance('model', { modelId: m.modelId, pos: [m.x, m.y, m.z], size: [m.scale || 1, m.scale || 1, m.scale || 1] }));
  return { ...doc, version: 2, instances, animations: [], starterGears: [], mobile: true, blocks: undefined, coins: undefined, models: undefined };
}
