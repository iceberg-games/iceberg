// Safe Chat room: a small icy 3D room where everyone present stands in an arc,
// wearing their cosmetics. Posted phrases appear as speech bubbles over the
// speaker, whose mouth animates via avatar.talk?.(ms). Leaving -> avatar.dispose?.().
import * as THREE from 'three';
import { Avatar } from '../game/avatar.js';
import { h } from '../ui/dom.js';
import { BubbleLayer } from './bubbles.js';
import { ChatChannel } from './channel.js';
import { createSafeChatMenu, bubbleMs, avatarTalk } from './safeChatMenu.js';
import './chat.css';

export function mountChatRoom(container, { remote, room = 'lobby', me = null, AvatarClass = Avatar } = {}) {
  const root = h('div.chat-room#chat-room');
  container.append(root);
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  root.append(renderer.domElement);
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xdff0fb, 18, 40);
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  camera.position.set(0, 4.2, 11); camera.lookAt(0, 2, 0);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x9fc6e8, 1.1));
  const sun = new THREE.DirectionalLight(0xffffff, 1.2); sun.position.set(4, 10, 6); scene.add(sun);
  const floor = new THREE.Mesh(new THREE.CylinderGeometry(9, 9.4, 0.6, 48), new THREE.MeshStandardMaterial({ color: 0xeaf6ff, roughness: 0.4 }));
  floor.position.y = -0.3; scene.add(floor);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(9, 0.12, 8, 64), new THREE.MeshStandardMaterial({ color: 0x9fd3f5, emissive: 0x3f9de0, emissiveIntensity: 0.3 }));
  ring.rotation.x = Math.PI / 2; scene.add(ring);
  for (let i = 0; i < 7; i++) {  // a few ice spires for atmosphere
    const s = new THREE.Mesh(new THREE.ConeGeometry(0.6 + Math.random() * 0.5, 3 + Math.random() * 3, 6), new THREE.MeshStandardMaterial({ color: 0xc6e6fa, roughness: 0.2, transparent: true, opacity: 0.9 }));
    const a = Math.PI * (0.9 + i * 0.2); s.position.set(Math.cos(a) * 11, 1.5, Math.sin(a) * 11 - 2); scene.add(s);
  }

  const bubbles = new BubbleLayer(root);
  const log = h('div.chat-log#chat-log');
  const status = h('span.chat-status#chat-status', 'Joining…');
  const menu = createSafeChatMenu({ onPick: (p) => say(p) });
  const chatBtn = h('button.btn#chat-open', { type: 'button', onclick: () => menu.toggle() }, '💬 Chat');
  root.append(log, menu.el, h('div.chat-bar', chatBtn, status));

  const members = new Map();  // username -> { avatar, look }
  const channel = new ChatChannel(remote, room);

  function layout() {
    const names = [...members.keys()].sort();
    const n = names.length, spread = Math.min(Math.PI * 0.9, 0.5 * Math.max(1, n - 1));
    names.forEach((name, i) => {
      const a = n === 1 ? 0 : -spread / 2 + (spread * i) / (n - 1);
      const m = members.get(name);
      m.avatar.root.position.set(Math.sin(a) * 4.5, 0, -Math.cos(a) * 4.5 + 3);
      m.avatar.root.rotation.y = -a * 0.6;
    });
  }
  function upsertMember(p) {
    const look = JSON.stringify([p.equipped, p.rocketColors, p.cosmeticColors]);
    let m = members.get(p.username);
    if (!m) {
      const avatar = new AvatarClass();
      scene.add(avatar.root);
      m = { avatar, look: null };
      members.set(p.username, m);
      bubbles.track(p.username, avatar.bones?.head || avatar.root, { name: p.me ? `${p.displayName} (you)` : p.displayName, offsetY: 1.1 });
    }
    if (m.look !== look) { try { m.avatar.applyLoadout?.({ equipped: p.equipped || {}, rocketColors: p.rocketColors, cosmeticColors: p.cosmeticColors || {} }); } catch (e) { console.warn(e); } m.look = look; }
  }
  function removeMember(name) {
    const m = members.get(name); if (!m) return;
    bubbles.untrack(name);
    scene.remove(m.avatar.root);
    try { m.avatar.dispose?.(); } catch { /* ignore */ }
    members.delete(name);
  }
  channel.on('members', (list) => {
    const present = new Set(list.map(p => p.username));
    for (const p of list) upsertMember(p);
    for (const name of [...members.keys()]) if (!present.has(name)) removeMember(name);
    layout();
    status.textContent = `${list.length} here · ${room === 'lobby' ? 'Lobby' : room}`;
  });
  channel.on('message', (m) => {
    const ms = bubbleMs(m.text);
    if (!members.has(m.username) && m.username) { upsertMember({ username: m.username, displayName: m.displayName || m.username, me: m.mine }); layout(); }
    bubbles.say(m.username, m.text, ms);
    avatarTalk(members.get(m.username)?.avatar, ms);
    log.append(h('div', h('b', `${m.displayName || m.username}: `), m.text));
    while (log.children.length > 40) log.firstChild.remove();
    log.scrollTop = log.scrollHeight;
  });
  channel.on('error', (e) => {
    if (e.reason === 'rate_limited') status.textContent = 'Slow down a little! ⏳';
    else if (e.reason === 'muted') status.textContent = 'Chat is paused for you right now.';
  });

  async function say(phrase) { return channel.say(phrase, me); }

  let raf = 0, last = performance.now(), alive = true;
  function frame(t) {
    if (!alive) return;
    const dt = Math.min(0.05, (t - last) / 1000); last = t;
    const w = root.clientWidth || 1, hgt = root.clientHeight || 1;
    if (renderer.domElement.width !== Math.floor(w * renderer.getPixelRatio())) { renderer.setSize(w, hgt, false); camera.aspect = w / hgt; camera.updateProjectionMatrix(); }
    for (const m of members.values()) m.avatar.animate?.(dt, { speed: 0 });
    renderer.render(scene, camera);
    bubbles.update(camera, w, hgt);
    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);
  channel.start();

  return {
    el: root, channel, members, say, menu,
    async destroy() {
      alive = false; cancelAnimationFrame(raf);
      await channel.stop();
      for (const name of [...members.keys()]) removeMember(name);
      renderer.dispose(); root.remove();
    },
  };
}
