// Keyboard + mouse state. Keys are tracked by event.code (layout independent).
export class Input {
  constructor(dom) {
    this.keys = new Set();
    this.dom = dom;
    this.listeners = { keydown: [] };
    addEventListener('keydown', (e) => {
      if (e.target.closest && e.target.closest('input, textarea, select')) return;
      this.keys.add(e.code);
      if (e.code === 'Space') e.preventDefault();
      this.listeners.keydown.forEach(fn => fn(e));
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => this.keys.clear());
  }
  down(code) { return this.keys.has(code); }
  onKey(fn) { this.listeners.keydown.push(fn); }
}
