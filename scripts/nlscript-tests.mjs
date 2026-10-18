// Phrase tests for the offline plain-words translator (src/studio/nlscript.js).
// Run: node scripts/nlscript-tests.mjs   (exit code 1 on any failure)
import { translate, validateProgram, CHEATSHEET } from '../src/studio/nlscript.js';

const names = ['Gate', 'Finish', 'Goal', 'Crate', 'Pad2', 'Lamp', 'Bridge', 'Red Door'];
const T = (text) => translate(text, { names });
const R = (p, i = 0) => p.program.rules[i] || { trigger: {}, actions: [] };
const acts = (p, i = 0) => R(p, i).actions;
const has = (p, d, f = () => true) => p.program.rules.some(r => [...r.actions, ...(r.else || [])].some(a => (a.do === d && f(a)) || (a.do === 'random' && a.options.some(o => o.do === d && f(o)))));
const cont = (p, type) => p.program.continuous.find(c => c.type === type);
const trig = (p, type, i = 0) => R(p, i).trigger.type === type;

const cases = [
  // --- triggers & word order ---
  ['When a player touches this, kill them', p => trig(p, 'touch') && has(p, 'kill')],
  ['kill the player when they touch it', p => trig(p, 'touch') && has(p, 'kill')],
  ['If someone steps on this block they die', p => trig(p, 'touch') && has(p, 'kill')],
  ['This is lava', p => trig(p, 'touch') && has(p, 'kill')],
  ['Whenever it gets touched, play a boing sound', p => trig(p, 'touch') && has(p, 'sound', a => a.sound === 'jump')],
  ['When clicked, turn green', p => trig(p, 'click') && has(p, 'color', a => a.color === '#2f9e6a')],
  ['when somebody taps this, say hi', p => trig(p, 'click') && has(p, 'message', a => /hi/i.test(a.text))],
  ['When the button is pressed, open the door called Gate', p => trig(p, 'press') && has(p, 'door', a => a.target === 'Gate')],
  ['This is a button that opens Gate', p => trig(p, 'press') && has(p, 'door', a => a.target === 'Gate')],
  ['When a player enters this area, say "Welcome!"', p => trig(p, 'enter') && has(p, 'message', a => a.text === 'Welcome!')],
  ['When someone leaves the zone, say "Bye"', p => trig(p, 'leave') && has(p, 'message', a => a.text === 'Bye')],
  ['When the game starts, show the leaderboard', p => trig(p, 'start') && has(p, 'leaderboard')],
  ['every 3 seconds turn blue', p => trig(p, 'every') && R(p).trigger.seconds === 3 && has(p, 'color')],
  ['Every two and a half seconds, play a beep', p => trig(p, 'every') && R(p).trigger.seconds === 2.5],
  ['every second give 1 point', p => trig(p, 'every') && R(p).trigger.seconds === 1 && has(p, 'points', a => a.amount === 1)],
  ['once every minute say "A minute passed"', p => trig(p, 'every') && R(p).trigger.seconds === 60],
  ['When the countdown ends, say "Time is up!"', p => trig(p, 'countdownEnd') && has(p, 'message')],
  ['When the player dies, take away 5 points', p => trig(p, 'death') && has(p, 'points', a => a.amount === -5)],
  ['When the score reaches 50, say "Halfway there!"', p => trig(p, 'reach') && R(p).trigger.var === 'points' && R(p).trigger.value === 50],
  ['When a player gets 100 coins, you win', p => trig(p, 'reach') && R(p).trigger.var === 'coins' && has(p, 'win')],
  ['When the player touches Pad2, teleport them to Finish', p => trig(p, 'touch') && R(p).trigger.part === 'Pad2' && has(p, 'teleport', a => a.toPart === 'Finish')],
  ['The first time someone touches this, give them 5 Birg Bucks', p => R(p).once && has(p, 'bucks', a => a.amount === 5)],
  ['When touched only once, say "Secret found"', p => R(p).once && has(p, 'message')],
  // --- numbers & units ---
  ['When touched, give twenty five points', p => has(p, 'points', a => a.amount === 25)],
  ['When touched, give one hundred and fifty points', p => has(p, 'points', a => a.amount === 150)],
  ['When touched, disappear for half a second', p => has(p, 'hide', a => a.seconds === 0.5)],
  ['When touched, wait 2 minutes then say done', p => has(p, 'wait', a => a.seconds === 120)],
  ['When touched, wait 500 ms then turn red', p => has(p, 'wait', a => a.seconds === 0.5)],
  ['Move up and down ten studs every four seconds', p => cont(p, 'move')?.distance === 10 && cont(p, 'move')?.period === 4],
  ['float up and down', p => cont(p, 'move')?.axis === 'y' && cont(p, 'move')?.distance === 1],
  ['slide left and right 8 studs', p => cont(p, 'move')?.axis === 'x' && cont(p, 'move')?.distance === 8],
  ['move back and forth 6 blocks', p => cont(p, 'move')?.axis === 'z' && cont(p, 'move')?.distance === 6],
  // --- motion ---
  ['Spin slowly forever', p => cont(p, 'spin')?.speed === 35],
  ['rotate really fast', p => cont(p, 'spin')?.speed === 480],
  ['Spin 2 times a second like a wheel', p => cont(p, 'spin')?.speed === 720 && cont(p, 'spin')?.axis === 'z'],
  ['spin backwards at 45 degrees per second', p => cont(p, 'spin')?.speed === -45],
  ['Move between 0, 5, 0 and 20, 5, 0 every 4 seconds', p => cont(p, 'path')?.points.length === 2 && cont(p, 'path')?.period === 4],
  ['Move between Goal and Finish', p => JSON.stringify(cont(p, 'path')?.points) === '["Goal","Finish"]'],
  ['Move to the part called Goal and back every 3 seconds', p => cont(p, 'path')?.points[0] === 'self' && cont(p, 'path')?.points[1] === 'Goal'],
  ['Act as an elevator going up 20 studs', p => trig(p, 'touch') && has(p, 'moveBy', a => a.offset[1] === 20) && has(p, 'return')],
  ['This is a lift that goes up 15 studs and waits 3 seconds at the top', p => has(p, 'moveBy', a => a.offset[1] === 15) && has(p, 'wait', a => a.seconds === 3)],
  ['When touched, move up 10 studs over 2 seconds, wait 2 seconds, then go back', p => has(p, 'moveBy', a => a.offset[1] === 10 && a.seconds === 2) && has(p, 'return')],
  ['When clicked, move to Goal in 3 seconds', p => has(p, 'moveTo', a => a.to === 'Goal' && a.seconds === 3)],
  ['When touched, start spinning', p => has(p, 'spin')],
  ['When clicked, stop spinning', p => has(p, 'stop')],
  ['When touched, wait 1 second then fall and come back after 3 seconds', p => has(p, 'fall', a => a.seconds === 3) && has(p, 'wait', a => a.seconds === 1)],
  ['When stepped on, crumble', p => has(p, 'fall')],
  // --- players ---
  ['When touched, teleport them to the part called Finish', p => has(p, 'teleport', a => a.toPart === 'Finish')],
  ['When touched, send them to 0, 50, 0', p => has(p, 'teleport', a => JSON.stringify(a.to) === '[0,50,0]')],
  ['teleporter to Goal', p => trig(p, 'touch') && has(p, 'teleport', a => a.toPart === 'Goal')],
  ['When touched, send them back to the start', p => has(p, 'teleport', a => a.to === 'spawn')],
  ['When touched, bounce them really high', p => has(p, 'bounce', a => a.power === 55)],
  ['trampoline', p => trig(p, 'touch') && has(p, 'bounce')],
  ['When touched, make them 2 times faster for 5 seconds', p => has(p, 'speed', a => a.mult === 2 && a.seconds === 5)],
  ['When touched, set their walk speed to 32', p => has(p, 'speed', a => a.mult === 2)],
  ['When touched, slow them down', p => has(p, 'speed', a => a.mult < 1)],
  ['When touched, freeze them for 3 seconds', p => has(p, 'speed', a => a.mult === 0 && a.seconds === 3)],
  ['When touched, make them jump higher for 10 seconds', p => has(p, 'jump', a => a.mult > 1 && a.seconds === 10)],
  ['When touched, set jump power to 100', p => has(p, 'jump', a => a.mult === 2)],
  ['When touched, give them low gravity', p => has(p, 'gravity', a => a.mult < 1)],
  ['When touched, take 25 damage', p => has(p, 'damage', a => a.amount === 25)],
  ['When touched, hurt them by ten', p => has(p, 'damage', a => a.amount === 10)],
  ['When touched, heal them', p => has(p, 'heal', a => a.amount === 100)],
  ['When touched, save their progress', p => has(p, 'checkpoint')],
  ['finish line: when touched you win', p => has(p, 'win')],
  // --- looks & effects ---
  ['Every 2 seconds, turn red or blue at random', p => has(p, 'color', a => a.choices?.length === 2)],
  ['When touched, slowly fade to purple over 3 seconds', p => has(p, 'color', a => a.color === '#8b6cf0' && a.seconds === 3)],
  ['When touched, fade out', p => has(p, 'transparency', a => a.value === 1) && has(p, 'hide')],
  ['Become 50% transparent', p => has(p, 'transparency', a => a.value === 0.5)],
  ['make it invisible', p => has(p, 'transparency', a => a.value === 1)],
  ['When clicked, turn the light on', p => has(p, 'light', a => a.on)],
  ['When clicked, turn off the light called Lamp', p => has(p, 'light', a => !a.on && a.target === 'Lamp')],
  ['When touched, make sparkles and play a chime sound', p => has(p, 'particles', a => a.kind === 'sparkles') && has(p, 'sound', a => a.sound === 'chime')],
  ['When touched, explode and disappear for 3 seconds', p => has(p, 'particles', a => a.kind === 'explosion') && has(p, 'hide', a => a.seconds === 3)],
  ['When touched, shoot confetti', p => has(p, 'particles', a => a.kind === 'confetti')],
  ['Glow blue', p => has(p, 'glow', a => a.color === '#3f8fd0')],
  ['When touched, make Bridge disappear for 5 seconds', p => has(p, 'hide', a => a.target === 'Bridge' && a.seconds === 5)],
  ['When clicked, make the Red Door see-through', p => has(p, 'transparency', a => a.target === 'Red Door')],
  ['When touched, let players walk through it', p => has(p, 'collide', a => a.value === false)],
  // --- score, timers, variables ---
  ['When touched, add 1 to the counter', p => has(p, 'addVar', a => a.name === 'counter' && a.amount === 1)],
  ['When clicked, increase laps by 2', p => has(p, 'addVar', a => a.name === 'laps' && a.amount === 2)],
  ['When the game starts, set the counter to 10', p => has(p, 'setVar', a => a.name === 'counter' && a.value === 10)],
  ['When touched, reset the score', p => has(p, 'setVar', a => a.name === 'points' && a.value === 0)],
  ['When touched, if the player has 10 points, open the door called Gate, otherwise say "You need 10 points!"', p => R(p).if?.var === 'points' && R(p).if?.value === 10 && has(p, 'door', a => a.target === 'Gate') && R(p).else?.[0]?.do === 'message'],
  ['When touched, open Gate only if the score is more than 20', p => R(p).if?.op === '>' && R(p).if?.value === 20],
  ['When clicked, if the player has the speed coil, say "Zoom"', p => R(p).if?.gear === 'speedCoil'],
  ['When the game starts, start a 60 second countdown', p => has(p, 'countdown', a => a.seconds === 60)],
  ['At the start, count down from ten', p => has(p, 'countdown', a => a.seconds === 10)],
  ['When touched, start the timer', p => has(p, 'timer', a => a.start)],
  ['When touched, give a random number of points between 1 and 10', p => has(p, 'points', a => a.min === 1 && a.max === 10)],
  ['When touched, double their points', p => has(p, 'multVar', a => a.factor === 2)],
  ['When touched, show the score', p => has(p, 'message', a => /\{points\}/.test(a.text))],
  // --- spawners, random, repeat ---
  ['Every 3 seconds, drop a red ball', p => has(p, 'spawn', a => a.what === 'ball' && a.color === '#e2474b')],
  ['Every 5 seconds, spawn a deadly lava ball', p => has(p, 'spawn', a => a.kill)],
  ['When clicked, spawn a copy of the part called Crate', p => has(p, 'spawn', a => a.what === 'clone' && a.target === 'Crate')],
  ['When clicked, drop three blocks', p => has(p, 'spawn', a => a.count === 3)],
  ['When touched, randomly either teleport them to the spawn or give them 5 points', p => has(p, 'random') && acts(p)[0].options.length === 2],
  ['Turn red, wait 1 second, turn blue, wait 1 second, repeat forever', p => R(p).loop && acts(p).length === 4],
  ['When touched, flash yellow 3 times', p => acts(p).filter(a => a.do === 'color').length === 3],
  // --- multiple sentences / synonyms ---
  ['Spin slowly. When touched, give 5 points.', p => cont(p, 'spin') && has(p, 'points', a => a.amount === 5)],
  ['When the user bumps into it, eliminate them', p => trig(p, 'touch') && has(p, 'kill')],
  ['when touched: vanish, then reappear after 2 seconds', p => has(p, 'hide') && has(p, 'show')],
  ['When touched, say "Hello, World!"', p => has(p, 'message', a => a.text === 'Hello, World!')],
  // --- extra phrasings ---
  ['make a lamp that turns on when clicked', p => trig(p, 'click') && has(p, 'light', a => a.on !== false)],
  ['open the Gate when the button is pushed and close it after 4 seconds', p => has(p, 'door', a => a.target === 'Gate')],
  ['count how many times it\'s touched and show the leaderboard', p => trig(p, 'touch') && (has(p, 'addVar') || has(p, 'points')) && has(p, 'leaderboard')],
  ['If the timer runs out say Game over', p => trig(p, 'countdownEnd') && has(p, 'message', a => /game over/i.test(a.text))],
];

// unknown phrases must produce suggestions, never a crash
const unknownCases = ['make it fly to the moon', 'grow bigger and bigger', 'do a backflip and order pizza'];

let pass = 0, fail = 0;
for (const [text, check] of cases) {
  let ok = false, r;
  try { r = T(text); ok = !!check(r); } catch (e) { r = { error: e.message }; }
  if (ok) pass++; else { fail++; console.log('FAIL:', text, '\n   ', r?.error || (r.preview || []).join(' | '), r?.unknown?.length ? `unknown=${JSON.stringify(r.unknown)}` : ''); }
}
for (const text of unknownCases) {
  const r = T(text);
  if (r.unknown.length && r.suggestions.length) pass++; else { fail++; console.log('FAIL (no suggestion):', text, r); }
}
// every cheat-sheet phrase must be fully understood
for (const text of CHEATSHEET.flatMap(c => c.items)) {
  const r = T(text);
  if (!r.unknown.length && r.preview.length) pass++; else { fail++; console.log('FAIL (cheatsheet):', text, r.unknown); }
}
// sandbox: validateProgram drops anything not whitelisted
const evil = validateProgram({ continuous: [{ type: 'eval', code: 'alert(1)' }], rules: [{ trigger: { type: 'touch' }, actions: [{ do: 'eval', code: 'x' }, { do: 'kill', extra: { nested: 'obj' } }, { do: 'random', options: [{ do: 'fetch' }, { do: 'points', amount: 1e9 }] }] }] });
const evilOk = evil.continuous.length === 0 && evil.rules[0].actions.length === 2 && !('extra' in evil.rules[0].actions[0]) && evil.rules[0].actions[1].options[0].amount === 5000;
if (evilOk) pass++; else { fail++; console.log('FAIL: sandbox', JSON.stringify(evil)); }

console.log(`${pass}/${pass + fail} phrase tests passed (${cases.length} phrases + ${unknownCases.length} unknown + cheat sheet + sandbox)`);
process.exit(fail ? 1 : 0);
