import { EMOTES } from './config.js';

export function listEmotes() { return EMOTES.slice(); }

export function playEmote(id, audio) {
  const e = EMOTES.find(x => x.id === id);
  if (!e) return false;
  audio?.(e.cue);
  return true;
}
