// In-game Safe Chat: a 💬 button + nested menu on the play page. The local player's
// bubble floats over their avatar's head (projected from the game camera) and the
// mouth animates via avatar.talk?.(ms). Messages from others in the same game room
// appear in a small log, and (with multiplayer) as bubbles over the speaker's avatar via
// opts.speak(username, text, ms). Text always comes from the server (phrase ids only).
import { h } from '../ui/dom.js';
import { BubbleLayer } from './bubbles.js';
import { ChatChannel } from './channel.js';
import { createSafeChatMenu, bubbleMs, avatarTalk } from './safeChatMenu.js';
import { bus } from '../core/events.js';
import './chat.css';

export function mountGameChat({ engine, avatar, remote, me, root = document.body, speak = null, onSent = null }) {
  const bubbles = new BubbleLayer(root);
  bubbles.track('me', avatar.bones?.head || avatar.root, { offsetY: 1.1 });
  const log = h('div.chat-log.hidden#game-chat-log');
  const menu = createSafeChatMenu({ onPick: (p) => say(p) });
  const btn = h('button.btn.game-chat-btn.hidden#game-chat-btn', { type: 'button', title: 'Safe Chat (Enter)', onclick: () => menu.toggle() }, '💬');
  root.append(log, menu.el, btn);
  Object.assign(menu.el.style, { position: 'fixed' });

  let channel = null, gameId = null;
  async function join(id, room = `game:${id}`) {
    if (!remote) return;
    if (channel) await channel.stop();
    gameId = id; channel = new ChatChannel(remote, room, { pollMs: 2500, heartbeatMs: 10000 });
    channel.on('message', (m) => {
      const ms = bubbleMs(m.text);
      if (m.mine) { bubbles.say('me', m.text, ms); avatarTalk(avatar, ms); }
      else speak?.(m.username, m.text, ms);
      log.classList.remove('hidden');
      log.append(h('div', h('b', `${m.displayName || m.username}: `), m.text));
      while (log.children.length > 12) log.firstChild.remove();
      log.scrollTop = log.scrollHeight;
    });
    channel.on('error', (e) => { if (e.reason === 'rate_limited') bus.emit('toast', { text: 'Slow down a little!', icon: '⏳' }); });
    await channel.start();
  }
  async function say(p) {
    if (!channel) { // guests: local-only bubble so the feature is still fun offline
      const ms = bubbleMs(p.text); bubbles.say('me', p.text, ms); avatarTalk(avatar, ms); return { ok: true, local: true };
    }
    const r = await channel.say(p, me);
    if (r?.ok) onSent?.(r);
    return r;
  }
  function show(on) { btn.classList.toggle('hidden', !on); if (!on) { menu.close(); log.classList.add('hidden'); } }

  addEventListener('keydown', (e) => {
    if (e.code === 'Enter' && !btn.classList.contains('hidden') && !(e.target.closest && e.target.closest('input, textarea, select'))) { menu.toggle(); }
  });
  let raf = 0;
  const tick = () => { if (engine.camera) bubbles.update(engine.camera, innerWidth, innerHeight); raf = requestAnimationFrame(tick); };
  raf = requestAnimationFrame(tick);

  return {
    join, say, show, menu, bubbles,
    get room() { return channel?.room || null; },
    pollNow() { return channel?.poll(); },
    async leave() { show(false); if (channel) { await channel.stop(); channel = null; } },
    destroy() { cancelAnimationFrame(raf); channel?.stop(); btn.remove(); log.remove(); menu.el.remove(); bubbles.el.remove(); },
  };
}
