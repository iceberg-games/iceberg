// Cue name map — Sound 1 fills oggs under /workspace/iceberg-audio/rimebound/
export class RimeAudio {
  constructor(music) { this.music = music; this._last = ''; }
  play(cue) {
    this._last = cue || '';
    // Soft stub: try engine music bus if present; otherwise no-op.
    try { this.music?.playSfx?.(cue); } catch {}
  }
  last() { return this._last; }
}
