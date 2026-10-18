// "New Event" popup on the portal home (Games / For You). Shown only while the event is ACTIVE on the
// server (quests.eventStatus(...).active), once per account (signed in) or once per device (guest).
//   maybeShowEventPopup({ economy, getRemote, onPlay, poster }) -> Promise<{ shown, reason }>
// Event status: the server's public event_status RPC (anon for guests, signed-in for players) through
// core/quests.js createQuests().eventStatus (server clock, 60 s cache). No server (local/dev build) or a
// network error -> no popup: never before the event starts. Tests can force it: window.__icebergForceEventPopup = true.
// Seen flag: localStorage `iceberg:v1:eventSeen:<eventId>:<userId|device>`, and for accounts also the
// player's own save data (existing save_game_data RPC, pseudo game id 'iceberg-portal', { seenEvents: { id: iso } })
// so it follows the account to other devices. Additive only; nothing else in player data is touched.
import { h } from '../ui/dom.js';
import { modal } from '../ui/overlay.js';
import { createQuests } from '../core/quests.js';
import { EVENT_POSTER } from './eventPoster.js';

export const PORTAL_DATA_ID = 'iceberg-portal';
const seenKey = (eventId, uid) => `iceberg:v1:eventSeen:${eventId}:${uid || 'device'}`;
let current = null, checking = null;

export function createEventStatusSource(economy, getRemote) {
  const now = () => new Date().toISOString();
  return createQuests({
    async eventStatus(eventId) {
      const api = economy.remote || getRemote?.();
      if (!api?.eventStatus) return { eventId, active: false, noServer: true, serverNow: now() };
      try { return await api.eventStatus(eventId); }
      catch { return { eventId, active: false, error: 'network', serverNow: now() }; }
    },
  });
}

async function alreadySeen(economy, eventId, uid) {
  try { if (localStorage.getItem(seenKey(eventId, uid))) return true; } catch { /* private mode */ }
  if (!uid || !economy.remote) return false;
  try { const d = await economy.loadGameData(PORTAL_DATA_ID); return !!d?.seenEvents?.[eventId]; } catch { return false; }
}
function markSeen(economy, eventId, uid) {
  const at = new Date().toISOString();
  try { localStorage.setItem(seenKey(eventId, uid), at); } catch { /* private mode */ }
  if (!uid || !economy.remote) return;
  const cur = economy.cachedGameData(PORTAL_DATA_ID) || {};
  const { gears, ...rest } = cur;
  economy.saveGameData(PORTAL_DATA_ID, { ...rest, seenEvents: { ...(rest.seenEvents || {}), [eventId]: at } });
}

const fmtLeft = (ms) => {
  if (ms == null) return '';
  const d = Math.floor(ms / 86400e3), hr = Math.floor(ms / 3600e3) % 24;
  return d >= 1 ? `${d} day${d > 1 ? 's' : ''}${hr ? ` ${hr} h` : ''} left` : hr >= 1 ? `${hr} hour${hr > 1 ? 's' : ''} left` : 'Ends soon';
};

export function showEventPopup({ poster = EVENT_POSTER, msLeft = null, onPlay }) {
  current?.close();
  const pic = h('picture.ev-picture',
    h('source', { media: poster.phoneQuery, srcset: poster.square, type: 'image/webp', width: poster.squareSize[0], height: poster.squareSize[1] }),
    h('img.ev-poster', { src: poster.wide, alt: poster.alt, width: poster.wideSize[0], height: poster.wideSize[1], decoding: 'async' }));
  const body = h('div.ev-body', pic,
    h('div.ev-text', h('span.ev-kicker', '🌪️ Limited-time event', msLeft != null ? h('span.ev-left#event-time-left', ` · ${fmtLeft(msLeft)}`) : null),
      h('p.ev-blurb', poster.blurb)));
  current = modal({ title: poster.title, body, className: 'ev-modal', labelledBy: 'event-popup-title',
    actions: [{ label: 'Maybe later', value: 'later', className: 'ev-later' },
      { label: '▶ Play now', value: 'play', primary: true, className: 'play big ev-play', sfx: 'play', onClick: () => { onPlay?.(poster.gameId); } }] });
  current.el.id = 'event-popup';
  current.closed.then(() => { current = null; });
  return current;
}

export async function maybeShowEventPopup({ economy, getRemote, onPlay, poster = EVENT_POSTER, source = null }) {
  if (checking) return checking;
  checking = (async () => {
    const forced = typeof window !== 'undefined' && window.__icebergForceEventPopup === true;
    let st = null;
    if (!forced) {
      st = await (source || createEventStatusSource(economy, getRemote)).eventStatus(poster.eventId).catch(() => null);
      if (!st?.active || st.noServer || st.error) return { shown: false, reason: st?.noServer ? 'no_server' : st?.error ? 'error' : 'inactive' };
    }
    const uid = economy.remote?.userId || null;
    if (await alreadySeen(economy, poster.eventId, uid)) return { shown: false, reason: 'seen' };
    if (document.querySelector('.ib-backdrop')) return { shown: false, reason: 'busy' };
    markSeen(economy, poster.eventId, uid);
    showEventPopup({ poster, msLeft: st?.msLeft ?? null, onPlay });
    return { shown: true };
  })().finally(() => { checking = null; });
  return checking;
}
export const eventPopup = { get current() { return current; } };
