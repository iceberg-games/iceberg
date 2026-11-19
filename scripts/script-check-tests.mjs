// Unit tests for the offline "Something's wrong?" checker (src/studio/scriptCheck.js).
// Run: node scripts/script-check-tests.mjs
import { translate } from '../src/studio/nlscript.js';
import { checkScript } from '../src/studio/scriptCheck.js';

const names = ['Gate', 'Finish', 'Goal', 'Lamp'];
const run = (text, extra = {}) => {
  const r = translate(text, { names });
  return checkScript({ text, program: r.program, unknown: r.unknown, suggestions: r.suggestions, names, ...extra });
};
const has = (issues, sev, re) => issues.some((i) => i.severity === sev && re.test(i.message));

const cases = [
  ['empty script is an info, not an error', () => {
    const i = checkScript({ text: '', program: { rules: [], continuous: [] }, names });
    return i.length === 1 && has(i, 'info', /empty/i) && !has(i, 'error', /./);
  }],
  ['unknown leftover phrases are flagged', () => {
    const i = run('make it fly to the moon');
    return has(i, 'warning', /didn't understand/i) && i.some((x) => x.suggestion);
  }],
  ['non-empty text with no program is an error', () => {
    const i = checkScript({ text: '???', program: { rules: [], continuous: [] }, unknown: ['???'], suggestions: [] });
    return has(i, 'error', /no script was produced/i);
  }],
  ['missing teleport target is an error', () => {
    const i = run('When touched, teleport them to the part called Castle');
    return has(i, 'error', /Castle/) && has(i, 'error', /no part with that name/i);
  }],
  ['missing door target is an error', () => {
    const i = run('When the button is pressed, open the door called Vault');
    return has(i, 'error', /Vault/);
  }],
  ['existing part names are fine', () => {
    const i = run('When touched, teleport them to the part called Finish');
    return !has(i, 'error', /Finish/) && !has(i, 'error', /no part with that name/i);
  }],
  ['two Birg Bucks awards in one script warn once', () => {
    const i = run('When touched, give them 5 Birg Bucks and give them 5 Birg Bucks');
    return has(i, 'warning', /more than once/i);
  }],
  ['one Birg Bucks award does not warn by itself', () => {
    const i = run('The first time someone touches this, give them 5 Birg Bucks');
    return !has(i, 'warning', /Birg Bucks/i);
  }],
  ['place-wide second Birg Bucks script warns', () => {
    const other = translate('The first time someone touches this, give them 5 Birg Bucks', { names });
    const i = run('When touched, give them 5 Birg Bucks', { placeScripts: [{ program: other.program, label: 'Pad script' }] });
    return has(i, 'warning', /More than one script/i) && /Pad script/.test(i.find((x) => /More than one/.test(x.message)).message);
  }],
  ['a healthy kill script has no errors', () => {
    const i = run('When a player touches this, kill them');
    return !i.some((x) => x.severity === 'error');
  }],
];

let pass = 0, fail = 0;
for (const [name, fn] of cases) {
  let ok = false;
  try { ok = !!fn(); } catch (e) { console.log('FAIL:', name, e.message); fail++; continue; }
  if (ok) pass++; else { fail++; console.log('FAIL:', name); }
}
console.log(`${pass}/${pass + fail} script-check tests passed`);
process.exit(fail ? 1 : 0);
