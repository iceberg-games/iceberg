import { list as listKits } from './kits/registry.js';
import { EMOTES } from './config.js';

export function createLobbyState() {
  return {
    role: null,          // 'survivor' | 'killer'
    kitId: null,
    ready: false,
    emoteId: null,
  };
}

export function availableKits(role) {
  return listKits(role);
}

export function pickRole(state, role) {
  state.role = role;
  state.kitId = null;
  state.ready = false;
  return state;
}

export function pickKit(state, kitId) {
  const ok = listKits(state.role).some(k => k.id === kitId);
  if (!ok) return state;
  state.kitId = kitId;
  return state;
}

export function setReady(state, ready = true) {
  if (!state.role || !state.kitId) return state;
  state.ready = !!ready;
  return state;
}

export function lobbySummary(state) {
  return { role: state.role, kitId: state.kitId, ready: state.ready, emotes: EMOTES.map(e => e.id) };
}
