// Toggleable corner chat for PC Studio. Text only, offline, free.
import { h, clear } from '../ui/dom.js';
import { sendChat, EXAMPLE_PHRASES } from './chat.js';

function addBubble(log, role, text) {
  const el = h('div.st-chat-bubble.' + (role === 'user' ? 'user' : 'bot'), text);
  log.append(el);
  log.scrollTop = log.scrollHeight;
  return el;
}

function build(getPanel) {
  const log = h('div.st-chat-log#studio-chat-log');
  const input = h('textarea#studio-chat-input', { rows: 2, placeholder: 'Type in plain words…', maxLength: 500 });
  const sendBtn = h('button.st-mini#studio-chat-send', { type: 'button' }, 'Send');
  const suggest = h('div.st-chat-suggest#studio-chat-suggest');
  const fillSuggest = (phrases) => {
    clear(suggest).append(...phrases.map((p) => h('button.st-chip', { type: 'button', 'data-phrase': p }, p)));
  };
  fillSuggest(EXAMPLE_PHRASES.filter((p) => !/first person|shop button|coin counter/.test(p)).slice(0, 4));

  const panel = h('div.st-chat-panel.hidden#studio-chat-panel',
    h('div.st-chat-head',
      h('b', 'Studio helper'),
      h('span.st-chat-free', 'Free · offline'),
      h('button.st-mini#studio-chat-close', { type: 'button', title: 'Close' }, '✕')),
    log,
    suggest,
    h('div.st-chat-compose', input, sendBtn),
  );
  const toggle = h('button.st-chat-toggle#studio-chat-toggle', { type: 'button', title: 'Open the free Studio helper (plain words, offline, no voice)', 'aria-expanded': 'false' }, '💬 Helper');
  const wrap = h('div#studio-ai-chat', toggle, panel);

  addBubble(log, 'assistant', "Hi — I can script parts, build simple things, check a script, or add on-screen GUI. I work offline and I'm free. Try a phrase below, or type your own.");

  const setOpen = (open) => {
    panel.classList.toggle('hidden', !open);
    toggle.classList.toggle('on', open);
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open) setTimeout(() => input.focus(), 0);
  };

  const send = async (preset) => {
    const text = (preset ?? input.value).trim();
    if (!text) return;
    input.value = '';
    addBubble(log, 'user', text);
    const host = getPanel?.();
    const ed = host?.ed;
    if (!ed) { addBubble(log, 'assistant', 'Open a game in Studio first.'); return; }
    sendBtn.disabled = true;
    try {
      const r = await sendChat(text, ed, { names: (ed.doc?.instances || []).map((i) => i.name).filter(Boolean) });
      addBubble(log, 'assistant', r.text || "I didn't understand that.");
      if (r.suggestions?.length) fillSuggest(r.suggestions);
      if (r.applied && host.ui?.toast) host.ui.toast(r.kind === 'build' ? 'Built — Ctrl+Z to undo' : 'Applied', '💬');
    } catch (err) {
      addBubble(log, 'assistant', "Something went wrong running that. I didn't apply a change.");
    } finally { sendBtn.disabled = false; }
  };

  sendBtn.addEventListener('click', () => send());
  input.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  });
  input.addEventListener('keyup', (e) => e.stopPropagation());
  panel.querySelector('#studio-chat-close').addEventListener('click', () => setOpen(false));
  toggle.addEventListener('click', () => setOpen(panel.classList.contains('hidden')));
  suggest.addEventListener('click', (e) => {
    const phrase = e.target.closest?.('[data-phrase]')?.getAttribute('data-phrase');
    if (phrase) send(phrase);
  });
  wrap._setOpen = setOpen;
  wrap._send = send;
  return wrap;
}

/** Mount (or re-attach after Studio re-render) the corner chat. History is kept. */
export function attachStudioChat(studioEl, getPanel) {
  if (!studioEl) return null;
  let wrap = studioEl.querySelector('#studio-ai-chat') || document.getElementById('studio-ai-chat');
  if (!wrap) wrap = build(getPanel);
  studioEl.append(wrap);
  return wrap;
}

export function openStudioChat(open = true) {
  const wrap = document.getElementById('studio-ai-chat');
  wrap?._setOpen?.(open);
  return wrap;
}
