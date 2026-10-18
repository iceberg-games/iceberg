# Multiplayer API for games (`mp`)

Every game gets the same object, as **`ctx.mp`** in `create(ctx)` and as **`window.iceberg.mp`**.
Feature-detect freely (`typeof mp.setState === 'function'`); the names below are final.

Up to 12 players share one instance of a game (`game:<gameId>:<instance>` on Supabase Realtime).
Moving remote players around is automatic for every game, with **no per-game code** (see the end of this file).
This API is for **shared game state**: rounds, disasters, survivor lists, finish announcements.

**Offline / guest / alone:** everything works as single-player.
- `isHost()` is `true`.
- `players()` lists only you.
- `setState` and `sendEvent` deliver locally, so the same game code runs everywhere.

## Names

| call | returns | who |
|---|---|---|
| `mp.isHost()` | `boolean` | anyone |
| `mp.onHostChanged(cb)` | `unsubscribe()` | anyone |
| `mp.setState(key, value)` | `{ ok, reason? }` | host only |
| `mp.onState(key, cb)` | `unsubscribe()` | anyone |
| `mp.sendEvent(name, payload)` | `{ ok, reason? }` | anyone |
| `mp.onEvent(name, cb)` | `unsubscribe()` | anyone |
| `mp.players()` | `[{ id, name, ... }]` (includes you) | anyone |
| `mp.nearby(radius)` | `[{ id, name, position: { x, y, z } }]`, other players within `radius` of you, nearest first (empty when solo) | anyone |
| `mp.localId()` | `string` | anyone |
| `mp.now()` | `number` (ms since epoch, server-synced) | anyone |

Extras:
- `mp.onPlayersChanged(cb)` returns `unsubscribe()`. `cb(players())` runs on every join and leave.
- `mp.connected()` returns `boolean`: true while in a live instance.

All subscriptions are dropped automatically when the game unloads.

### Host

- The host is the **earliest-joined player still present**. The order comes from the server's `mp_members.joined_at`, with ties broken by id. Every client computes the same answer.
- When the host leaves (closes the tab, or drops longer than presence allows), the next earliest player becomes host **automatically**.
- `onHostChanged(cb)` runs `cb({ hostId, isHost })` on every client.
- The new host already holds the last state it received, so it simply continues. Re-schedule anything time-based from that state (see Time).

### State: `setState(key, value)` / `onState(key, cb)`

- **Host-authoritative, last-write-wins.** Only the current host's writes are accepted, and each client checks this against its own roster.
- `setState` from a non-host returns `{ ok:false, reason:'not_host' }`.
- **Keys:** `^[A-Za-z0-9_.:-]{1,40}$`, up to 32 keys per instance.
- **Values must be plain JSON:** objects, arrays, strings, finite numbers, booleans and null. Functions, `undefined`, NaN/Infinity, Dates, Maps, class instances and cycles are rejected.
  - Error reasons: `{ ok:false, reason:'not_json' }`, or `'too_large'` when `JSON.stringify(value)` is over **4 KB**. A console warning is also printed.
  - Values are copied on write: mutating your object afterwards changes nothing.
- `setState(key, null)` keeps the key with value `null`.
- **Delivery:** writes are coalesced per key (up to 5 sends/s; the latest value wins). Each write carries a version.
  - The host re-sends a **snapshot** of all keys whenever someone joins and every 10 s while others are present, so lost packets heal.
  - **Late joiners get the snapshot** within about a second of joining.
- **`onState(key, cb)`** calls `cb(value, { key, from, at })`, where `at` is in `mp.now()` time.
  - It fires **immediately** (synchronously) with the current value if one exists, including for subscribers added late or after joining.
  - It fires again on every change, including the host's own writes, which apply locally at once.
  - `onState('*', cb)` receives every key.

### Events: `sendEvent(name, payload)` / `onEvent(name, cb)`

- Any player can send, for example `'eliminated'`, `'survived'`, `'finished'`.
- Names follow the same pattern as keys. The payload is plain JSON up to **1 KB**.
- `cb(payload, { name, from, at })`. The sender gets its own event too (a local echo), so one code path works for everyone.
- **Fire-and-forget:** no replay for late joiners. Anything that must survive goes in state, e.g. the host keeps a `survivors` key up to date from `'survived'` events.
- **Rate limits:** up to 5 events/s per sender (bursts of 10); extra events return `{ ok:false, reason:'rate_limited' }`. Receivers also drop senders above the limit.

### Players: `players()` / `localId()`

`players()` returns
`[{ id, name, username, displayName, isLocal, isHost, joinedAt }]`, sorted by `joinedAt` (so `[0]` is the host).
- `id` = the stable account username (`localId()` for yourself). Offline it is `'local'`.
- `name` = the display name to show. `username` is an alias of `id`.
- Only players who are both in the server roster **and** connected are listed. "Alive" or "out" is game state: keep it in a state key.

### Time: `now()`

- `mp.now()` is milliseconds since the epoch on the **server's clock**: the local clock plus an offset measured from `serverNow` in `mp_join` / `mp_heartbeat`, accurate to roughly half the RPC round trip.
- Offline it is `Date.now()`.
- **Schedule by timestamp, never by "now + delay" on receipt.** Example host state: `{ round: 3, startsAt: mp.now() + 5000, disasterAt: …, seed: 12345 }`. Every client runs the round when `mp.now() >= startsAt`, so everyone sees it at the same moment.
- Derive randomness from the `seed`, never from `Math.random()` on each client.

### Example (round loop)

```js
const { mp } = ctx;
mp.onState('round', (r) => r && game.scheduleRound(r));          // every client, incl. late joiners
mp.onEvent('eliminated', (_, { from }) => game.markOut(from));
function hostTick() {
  if (!mp.isHost()) return;
  const r = game.currentRound;
  if (!r || mp.now() > r.endsAt) mp.setState('round', { n: (r?.n || 0) + 1, startsAt: mp.now() + 5000, endsAt: mp.now() + 65000,
    disaster: 'tornado', disasterAt: mp.now() + 20000, seed: (Math.random() * 2 ** 31) | 0 });
}
mp.onHostChanged(({ isHost }) => isHost && hostTick());          // migration: pick up where the old host left off
```

### Rules

- **No currency, ever.** mp state and events are not trusted for anything but gameplay display. Birg Bucks only come from the server RPCs (`economy.earn` → `game_earn` with its caps, quests, purchases).
- A malicious client can lie in its own events, or as host in state. Never grant anything from them.
- **Budget (free-tier Realtime):** movement is about 1–10 Hz per player, set by the server's `sendHz`. Keep state small and change it at round granularity, not per frame. Use events for moments, not streams.

## Automatic for every game (engine level)

- **Remote avatars:** full R6 `Avatar` with the player's equipped cosmetics and colours, taken from the server roster.
- **Animation:** the same states the local avatar has (idle, walk, run, jump, fall, climb, fly) plus facing, sent with a velocity hint.
  - Movement packets go out at `sendHz`, capped at 10 Hz.
  - Jump, land, teleport and respawn go out **immediately** as events.
  - Remote motion is interpolated, with dead-reckoning from velocity; a teleport or respawn snaps.
- **Collision:** pass-through, Roblox-style ghosting. Remote avatars are visuals only and are not `engine.player`, so they never touch your coins, checkpoints, kill bricks or wins.
- Runs in every built-in game and in Studio games, through the shared `play()` path in `src/main.js`.
  - The only exception is a game that sets `hideAvatar: true` (no avatar at all).
  - Games don't call `mp.join` themselves.
