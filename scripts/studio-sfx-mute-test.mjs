#!/usr/bin/env node
// Studio playSfx respects the site mute (the same isMuted() as the UI sounds: window.iceberg.music.muted on the
// play page, else iceberg:v1:settings.muted). Runs in Node with a stub AudioContext that counts oscillator starts.
import assert from 'node:assert/strict';
const store = new Map();
globalThis.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
let starts = 0;
const param = () => ({ setValueAtTime() {}, exponentialRampToValueAtTime() {}, value: 0 });
class FakeCtx { currentTime = 0; destination = {};
  createGain() { return { gain: param(), connect() {} }; }
  createOscillator() { return { type: '', frequency: param(), connect() {}, start() { starts++; }, stop() {} }; } }
globalThis.window = { AudioContext: FakeCtx };
// release merge: runtime.js now pulls in cosmetics' audio assets (.ogg via avatar.js); stub asset imports in Node
await import('node:module').then(m => m.register('../tools/asset-stub-loader.mjs', import.meta.url));
const { playSfx } = await import('../src/studio/runtime.js');
const { isMuted } = await import('../src/audio/uiSounds.js');
const results = [];
const t = (name, fn) => { try { fn(); results.push(['PASS', name]); } catch (e) { results.push(['FAIL', name, e.message]); } };
const play = () => { const n = starts; playSfx('ding'); return starts - n; };

window.icebergUi = { isMuted };   // installed by initUiSounds() on the play page
t('unmuted studio game plays sfx', () => { window.iceberg = { music: { muted: false } }; assert.equal(play(), 1); });
t('muted (play page music mute) -> no sfx', () => { window.iceberg = { music: { muted: true } }; assert.equal(play(), 0); });
t('muted via saved settings (no music object) -> no sfx', () => { delete window.iceberg; localStorage.setItem('iceberg:v1:settings', JSON.stringify({ muted: true })); assert.equal(play(), 0); });
t('unmuted via saved settings -> sfx', () => { localStorage.setItem('iceberg:v1:settings', JSON.stringify({ muted: false })); assert.equal(play(), 1); });
t('without uiSounds installed: falls back to music.muted', () => { delete window.icebergUi; window.iceberg = { music: { muted: true } }; assert.equal(play(), 0); window.iceberg.music.muted = false; assert.equal(play(), 1); });
for (const r of results) console.log(r.join('  '));
const failed = results.filter(r => r[0] === 'FAIL').length;
console.log(`${results.length - failed}/${results.length} studio sfx mute tests passed`);
process.exit(failed ? 1 : 0);
