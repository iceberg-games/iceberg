// Speech bubbles + name tags that follow 3D anchors (avatar heads) on screen.
import * as THREE from 'three';
import { h } from '../ui/dom.js';
import './chat.css';

const v = new THREE.Vector3();

export class BubbleLayer {
  constructor(container) {
    this.el = h('div.bubble-layer');
    container.append(this.el);
    this.items = new Map();   // key -> { anchor, tag, bubble, until, offsetY }
  }
  track(key, anchor, { name = null, offsetY = 1.0 } = {}) {
    let it = this.items.get(key);
    if (!it) {
      it = { anchor, offsetY, tag: name ? h('div.name-tag', name) : null, bubble: h('div.speech-bubble.hidden'), until: 0 };
      if (it.tag) this.el.append(it.tag);
      this.el.append(it.bubble);
      this.items.set(key, it);
    }
    it.anchor = anchor; it.offsetY = offsetY;
    return it;
  }
  say(key, text, ms) {
    const it = this.items.get(key); if (!it) return false;
    it.bubble.textContent = text;
    it.bubble.classList.remove('hidden', 'pop'); void it.bubble.offsetWidth; it.bubble.classList.add('pop');
    it.until = performance.now() + ms;
    return true;
  }
  untrack(key) {
    const it = this.items.get(key); if (!it) return;
    it.tag?.remove(); it.bubble.remove(); this.items.delete(key);
  }
  isShowing(key) { const it = this.items.get(key); return !!it && performance.now() < it.until; }
  update(camera, width, height) {
    const now = performance.now();
    for (const it of this.items.values()) {
      if (!it.anchor?.getWorldPosition) continue;
      it.anchor.getWorldPosition(v); v.y += it.offsetY; v.project(camera);
      const behind = v.z > 1 || v.z < -1;
      const x = (v.x * 0.5 + 0.5) * width, y = (-v.y * 0.5 + 0.5) * height;
      const show = !behind && now < it.until;
      it.bubble.classList.toggle('hidden', !show);
      if (show) it.bubble.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%)`;
      if (it.tag) { it.tag.style.display = behind ? 'none' : ''; it.tag.style.transform = `translate(${x}px, ${y + 4}px) translate(-50%, 0)`; }
    }
  }
}
