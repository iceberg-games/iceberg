// Quest log (brief §6): accept at the giver, progress from game events (kind strings like 'kill:slime'),
// turn in at the giver for rewards. Up to 3 active quests are tracked on the HUD.
import { QUESTS, questStatus, grant } from './config.js';

export class QuestLog {
  constructor(getSave, { onProgress, onReady, onTurnIn } = {}) { this.getSave = getSave; this.onProgress = onProgress; this.onReady = onReady; this.onTurnIn = onTurnIn; }
  get save() { return this.getSave(); }
  status(q) { return questStatus(this.save, q); }
  forGiver(giver) { return QUESTS.filter(q => q.giver === giver).map(q => ({ q, ...this.status(q), r: this.save.quests[q.id] })); }
  accept(id) {
    const q = QUESTS.find(x => x.id === id); if (!q || this.status(q).st !== 'available') return false;
    this.save.quests[id] = { a: true, p: 0, done: false, turnedIn: false };
    if (q.kind === 'hearth') this.emit('hearth', 0);           // absolute progress
    if (q.kind.startsWith('reveal:')) this.save.quests[id].p = Math.min(q.goal, this.save.veins.length);   // veins already found count
    if (this.save.quests[id].p >= q.goal) { this.save.quests[id].done = true; this.onReady?.(q); }
    if (this.save.tracked.length < 3) this.save.tracked.push(id);
    return true;
  }
  /** Count an event. Returns quests that progressed. */
  emit(kind, n = 1) {
    const out = [];
    for (const q of QUESTS) {
      const r = this.save.quests[q.id]; if (!r?.a || r.done || r.turnedIn) continue;
      let match = q.kind === kind;
      if (!match && (kind === 'kill:slimeBig' || kind === 'kill:slimelet')) match = q.kind === 'kill:slime';
      if (!match) continue;
      const before = r.p;
      r.p = q.kind === 'hearth' ? Math.min(q.goal, this.save.hearth) : Math.min(q.goal, r.p + n);
      if (r.p !== before) { out.push(q); this.onProgress?.(q, r); }
      if (r.p >= q.goal) { r.done = true; this.onReady?.(q); }
    }
    return out;
  }
  turnIn(id) {
    const q = QUESTS.find(x => x.id === id), r = this.save.quests[id]; if (!q || !r?.done || r.turnedIn) return false;
    r.turnedIn = true; grant(this.save, q.reward); this.save.tracked = this.save.tracked.filter(x => x !== id);
    for (const x of QUESTS) { const rr = this.save.quests[x.id]; if (this.save.tracked.length < 3 && rr?.a && !rr.turnedIn && !this.save.tracked.includes(x.id)) this.save.tracked.push(x.id); }
    this.onTurnIn?.(q); return true;
  }
  tracked() { return this.save.tracked.map(id => QUESTS.find(q => q.id === id)).filter(Boolean).map(q => ({ q, r: this.save.quests[q.id] })); }
  get allDone() { return QUESTS.every(q => this.save.quests[q.id]?.turnedIn); }
  readyCount(giver) { return QUESTS.filter(q => (!giver || q.giver === giver) && this.save.quests[q.id]?.done && !this.save.quests[q.id]?.turnedIn).length; }
  availableCount(giver) { return QUESTS.filter(q => (!giver || q.giver === giver) && this.status(q).st === 'available').length; }
}
