// Contract tests: Studio Save goes to the account/drafts store and never
// downloads a JSON file. Optional export lives under the tucked-away File menu.
// Run: node scripts/studio-save-tests.mjs
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(resolve(root, p), 'utf8');

function method(src, name) {
  const i = src.search(new RegExp(`\\n  ${name}\\([^\\n]*\\) \\{`));
  if (i < 0) throw new Error(`missing method ${name}`);
  const start = src.indexOf('{', i);
  let n = 0;
  for (let j = start; j < src.length; j++) {
    if (src[j] === '{') n++;
    else if (src[j] === '}') { n--; if (!n) return src.slice(i, j + 1); }
  }
  throw new Error(`unclosed method ${name}`);
}

const creator = read('src/ui/creator.js');
const mobile = read('src/ui/mobileStudio.js');
const cases = [
  ['desktop save() calls drafts.save and never downloads', () => {
    const s = method(creator, 'save');
    return s.includes('drafts.save') && !s.includes('downloadText') && /your account/.test(s);
  }],
  ['desktop Save button does not call downloadText', () => {
    return /#save-game.*?this\.save\(\)/s.test(method(creator, 'renderRibbon')) &&
      !/#save-game[\s\S]*downloadText/.test(method(creator, 'renderRibbon'));
  }],
  ['Export/Import are not on the Save/Test/Publish row', () => {
    const r = method(creator, 'renderRibbon');
    return !r.includes('#export-game') && !r.includes('#import-game') && r.includes('#game-file-menu') && r.includes('⋯ File');
  }],
  ['optional export lives only in the File menu', () => {
    const f = method(creator, 'toggleFileMenu');
    return f.includes('downloadText') && f.includes('#export-game') && /optional|backup|account/i.test(f);
  }],
  ['Ctrl+S triggers save(), not export', () => /KeyS.*this\.save\(\)/s.test(creator) && !/KeyS.*downloadText/.test(creator)],
  ['Mobile Studio save() calls drafts.save and never downloads', () => {
    const s = method(mobile, 'save');
    return s.includes('drafts.save') && !s.includes('downloadText') && !mobile.includes('downloadText');
  }],
];

let pass = 0, fail = 0;
for (const [name, fn] of cases) {
  let ok = false;
  try { ok = !!fn(); } catch (e) { fail++; console.log('FAIL:', name, e.message); continue; }
  if (ok) pass++; else { fail++; console.log('FAIL:', name); }
}
console.log(`${pass}/${pass + fail} studio-save tests passed`);
process.exit(fail ? 1 : 0);
