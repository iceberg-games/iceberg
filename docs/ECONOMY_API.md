# Iceberg economy and data API

The server (Supabase Postgres) is the source of truth for Birg Bucks (BB), cosmetics, gears and prices. The client (`src/core/economy.js`) keeps its old **synchronous** API and applies every change optimistically. It sends each change to the server in order and adopts the balance each reply returns. Guests (not signed in) still use localStorage only, the same as before.

## Client: `economy` (one shared instance, `window.iceberg.economy` in the game)

| Method | Returns | Guest | Signed in |
|---|---|---|---|
| `earn(amount, reason, {source}?)` | amount shown now | local | `game_earn(source, amount)`, server caps apply |
| `spend(amount, reason?)` | `true/false` (local check) | local | `game_spend` |
| `claimDailyBonus()` | 100 or 0 | local | `claim_daily_bonus` (once per UTC day) |
| `rewardBlockPlaced()` | 1 or 0 | local cap 50/day | `game_earn('build', 1)` |
| `buy(itemId)` | `{ok, reason?, pending?}` | `LocalBackend.purchase` | `buy_cosmetic`; rolls back if the server refuses |
| `equip / unequip / toggleEquip(id)` | bool | local | debounced `save_loadout` (server re-checks ownership + slot) |
| `setRocketColor(part, hex)` | – | local | `save_loadout(p_rocket_colors)` |
| `setCosmeticColor(id, hex)` | – (emits `cosmetic:colors`) | `profile.cosmeticColors[id]` | `save_loadout(p_cosmetic_colors)` (merged, hex-validated) |
| `saveGameData(gameId, data)` | **Promise** | `profile.gameData[gameId]` | debounced `save_game_data` (the `gears` key is stripped) |
| `loadGameData(gameId)` | **Promise**, plus `promise.cached` (the sync value) | local | `load_game_data`; `gears` comes from the server |
| `cachedGameData(gameId)` | value or `null` | sync | sync cache |
| `buyGear(gameId, gearId, price)` | `{ok, pending?}` | local | `buy_gear` (the server charges its own price) |
| `ownsGear(gameId, gearId)` | bool, sync | local save | server list for **that game only** |
| `demoGrant(n)` | n or 0 | only in non-site builds | always 0 |
| `flush()` | Promise | – | resolves when every queued call has been answered |
| `resync()` | Promise | – | re-reads the server profile (also runs when the tab regains focus) |

**Events on `bus`:**
- `coins:changed` and `inventory:changed`: unchanged.
- `rocket:colors` and `cosmetic:colors`: unchanged.
- `profile:synced`: the server profile was adopted.
- `economy:capped {source, granted, requested}`: a server earning cap was hit.
- `economy:rejected {action: 'buy'|'spend'|'gear', reason}`: the server refused a change.
- `economy:error`: a server call failed.

**How the balance is reconciled:** shown balance = last server balance + the sum of deltas that haven't been answered yet. A cap or a rejection therefore corrects the number on screen by itself.

### Earning sources (server caps, `public.earn_caps`)

| source | from `reason` | per call | per day |
|---|---|---|---|
| `coin` | `'Pickup'` | 5 | 300 |
| `build` | `'Building'` | 1 | 50 |
| `obby_finish` | `/obby complete/i` | 100 | 200 |
| `obby_stage` | `/obby stage/i` (Giant Rainbow Obby milestones) | 100 | 500 |
| `custom_game` | `/^Reward in /` | 50 | 200 |
| `other` | anything else | 25 | 100 |
| `*` | total of all game earnings | – | 1500 |

The daily bonus (100) is separate. To pass a source explicitly: `economy.earn(10, 'My game reward', { source: 'custom_game' })`. Caps are rows in a table, so tune them with SQL, not code.

## Per-game save data and gears

- `game_data(user_id, game_id, data jsonb ≤ 16 KB)`: owner-only RLS, written only through `save_game_data`. Limit: 64 games per player.
- `game_gear_prices(game_id, gear_id, price)`: **generated** by `scripts/sync-catalog.mjs` from every `src/games/<folder>/config.js` that exports `GAME_ID` and `GEAR_PRICES_BB`. Giant Rainbow Obby: `speedCoil 75`, `gravityCoil 120`, `magicCarpet 250`.
- `game_gears(user_id, game_id, gear_id)`: written only by `buy_gear`. `owns_gear(game_id, gear_id)` is scoped to that game. A gear bought in game A is **not** owned in game B.
- **Save data is never trusted for BB or gear ownership.** `save_game_data` drops any `gears` key, and `load_game_data` / `get_my_profile.gameData[g].gears` always come from `game_gears`. Gears a guest bought do not move to an account.
- **Compatibility shim for Giant Rainbow Obby:** the game buys a gear as `economy.spend(price)` followed by `saveGameData(..., {gears: [...new]})` in the same task. When signed in, the economy cancels that spend before it is sent and calls `buy_gear` instead, so the server records ownership and charges its own price. A gear that appears in save data without a purchase is ignored.
  - Recommended hook for the Game Maker: in `src/games/giantObby/index.js` `buyGear(id)`, call `economy.buyGear?.(GAME_ID, id, g.price)` when it exists, instead of `spend` + push.

## Server RPCs (`POST /rest/v1/rpc/<name>`, signed-in role unless noted)

| RPC | Args | Returns |
|---|---|---|
| `username_available` (anon ok) | `p_username` | bool |
| `get_my_profile` | – | `{playerId, username, displayName, coins, owned[], equipped, rocketColors, cosmeticColors, gameData, lastDailyBonus, buildRewardToday, migrated}` |
| `claim_daily_bonus` | – | `{granted, coins}` |
| `game_earn` | `p_source, p_amount, p_reason?, p_ref?` | `{granted, coins, capped, duplicate?}` |
| `game_spend` | `p_amount (1..5000), p_reason?, p_ref?` | `{ok, coins, reason?}` |
| `buy_cosmetic` | `p_item_id` | `{ok, coins, price, reason?: unknown_item\|already_owned\|insufficient_funds}` |
| `save_loadout` | `p_equipped?, p_rocket_colors?, p_cosmetic_colors?` (null = unchanged) | `{equipped, rocketColors, cosmeticColors}` (cleaned) |
| `save_game_data` / `load_game_data` | `p_game_id, p_data` / `p_game_id` | `{ok, reason?}` / data + `gears` |
| `buy_gear` / `owns_gear` | `p_game_id, p_gear_id` | `{ok, coins, price, gears}` / bool |
| `migrate_local_profile` | `p_local` (guest profile) | `{ok, coins, items, profile}`; runs once per account |
| `post_chat` | `p_room ('lobby' \| 'game:<id>'), p_phrase_id` | `{ok, id, text}` or `{ok:false, reason: invalid_phrase\|invalid_room\|rate_limited\|muted, retryAfterMs}` |
| `get_chat` | `p_room, p_after_id` | last 50 messages from the past hour `[{id, username, displayName, phraseId, text, at, mine}]` |
| `chat_heartbeat` / `chat_leave` | `p_room` | players seen in the last 30 s (public avatar info only) / – |
| `send_friend_request` / `respond_friend_request` / `remove_friend` / `list_friends` | `p_username` (+ `p_accept`) | `{ok, status\|reason}` / `{friends, incoming, outgoing}` with `online` |

- `p_ref` makes a credit or debit idempotent (unique per user in `wallet_ledger`).
- Every balance change is recorded in `wallet_ledger` (append-only, with `balance_after`).
- Clients can only `select` their own profile, inventory, ledger, game data and gears. Every write goes through these `SECURITY DEFINER` functions, and the internal helpers (`_credit`, `_profile_json`, …) are not executable by `anon` or `authenticated`.

## First-login migration (guest progress → account)

This runs once per account (`profiles.migrated_at`), and a guest profile moves to only one account (`migratedTo` in localStorage):
- **Coins:** `coins − demoGranted`, capped at **2000**.
- **Items:** only active, non-premium catalog items priced ≤ **600**, at most 30. The Ice Rocket is not migrated.
- **Equipped items and colors:** re-validated.
- **Save data:** copied without `gears`.

The limits live in `public.app_config`.

## Prices are never hardcoded twice

`src/data/cosmetics.js` (items), `src/games/*/config.js` (gears) and `src/data/safeChat.js` (phrases) are the only sources. `node scripts/sync-catalog.mjs` turns them into an idempotent upsert, and items that were removed are deactivated, never deleted.
- `npm test` fails if any catalog item, gear or phrase is missing on the server, or has a different price there.
- Deploy runs `scripts/migrate.mjs --remote`, which applies the sync.

## Portal: game stats and featured banner (public, no Birg Bucks involved)

| RPC | Who | What |
|-----|-----|------|
| `list_game_stats()` | anon + signed-in | `[{gameId, publishedAt, visits7d, visitsAll, playing}]` |
| `record_visit(p_game_id)` | signed-in | +1 to the all-time total and today's bucket in `game_visit_days`, deduped per user per game per 30 min |
| `game_heartbeat(p_game_id)` / `game_leave()` | signed-in | one row per user in `game_presence`; "playing" = heartbeat within 90 s (the play page sends one every 30 s) |
| `list_featured()` | anon + signed-in | active `featured_games` rows in order: `[{gameId, blurb, image, sortOrder}]` |
| `set_featured_games(p_items)` | admins only (`profiles.is_admin`) | replace the featured list; see DEPLOY.md §4 |

Tabs: **Newest** = `publishedAt` (from `src/data/gameMeta.js`, else first git commit date);
**Most Popular** = plays in the last 7 days (sum of daily buckets; ties → all-time, then newest;
old buckets are kept); **Most Active Players** = live heartbeats. Offline/guest: local dates, this
device's plays in the last 7 days (`src/net/gameStats.js`), and "not available offline".
Featured banner offline: `site/public/featured.json`.

## Quests and event cosmetics (Natural Disasters event)

Migration `20261018000008_quests_event.sql`. Quest rewards are **cosmetics only**: claiming a quest
never moves Birg Bucks.

### Game API: `quests` (`import { quests } from '../core/quests.js'` or `window.iceberg.quests`)

| Call | Result |
|---|---|
| `quests.progress(questId, delta = 1)` | `Promise<{ ok, added, quest }>` or `{ ok:false, reason }`. Reasons are `unknown_quest`, `event_not_started` / `event_ended` (event quests; `not_live` for quests without an event), `invalid_delta` (more than `maxPerCall`), `too_fast` (with `retryAfterMs`), `hourly_cap`, and `network`. Progress stops at the goal. |
| `quests.complete(questId)` | `Promise<{ granted, itemId, alreadyClaimed, reason? }>`. You get `reason:'not_complete'` until the goal is reached. The server owns the questId→itemId mapping and the once-per-account rule, so calling it again is safe and returns `{granted:false, alreadyClaimed:true}`. |
| `quests.status(gameId?)` | `Promise<[{ id, gameId, title, goal, progress, completed, claimed, itemId }]>`. Lists live quests, plus quests that are completed but not yet claimed after their event ended. |

- The same calls also exist on economy: `economy.questProgress`, `economy.getQuests`, and `economy.claimQuestReward`.
- The bus emits `quest:progress` and `quest:reward`.
- **Guests and offline players** use a local-only copy (LocalBackend) with the same limits, read from the bundled quest files. Local rewards stay on the device. The first-login migration does **not** import grant-only items.

Example: the disaster game reports a survived round.

```js
const r = await quests.progress('nd_quest_disaster_survival');
if (r.ok && r.quest.completed) { const c = await quests.complete('nd_quest_disaster_survival'); if (c.granted) toast('Tornado Hat unlocked!'); }
```

### Quest file format (Game Maker)

Write `src/games/<dir>/quests.js`. Its `gameId` defaults to `GAME_ID` in `<dir>/config.js`. Alternatively write `src/games/<name>.quests.js` with `export const GAME_ID`.

```js
export const QUESTS = [
  { id: 'nd_quest_disaster_survival',      // ^[a-z0-9_]{3,64}$, unique
    gameId: 'natural-disaster-survival',    // optional; per-quest override (event quests in other games)
    title: 'Survive 5 disasters', goal: 5,
    rewardItemId: 'tornado_hat',            // must be a grant-only cosmetic (earnOnly: true)
    eventId: 'natural_disasters',          // must match a public.game_events id (window comes from the event)
    startsAt: '2026-10-18T00:00:00Z', endsAt: '2026-11-15T00:00:00Z',   // optional live window
    maxPerCall: 1, minIntervalMs: 2000, maxPerHour: 60 },             // anti-farm limits (these are the defaults)
];
```

- Game Maker's names are accepted too: `reward` (= `rewardItemId`), `event` (= `eventId`), `description` (≤ 200 chars, returned by `get_quests`), and `maxPerMinute`. `maxPerMinute` is a per-minute cap: going over it returns `too_fast` with `retryAfterMs`. With it, `minIntervalMs` defaults to 0 and `maxPerHour` to 60 × maxPerMinute.
- `npm run catalog:check` validates the files.
- `scripts/sync-catalog.mjs` upserts them into `public.quest_defs`. A quest removed from the code is deactivated, not deleted, so existing progress is kept.
- Pick limits that a real player can't exceed. For example, one disaster takes at least about 30 s, so `minIntervalMs: 20000` is safe.

### Grant-only cosmetics (Cosmetics)

- In `src/data/cosmetics.js`, set **`earnOnly: true`** (as the Cosmetics branch does; `eventOnly` and `unlock: 'quest'` are also accepted). `price` may be 0 or omitted. If `unlock` names a quest id, the sync checks that it matches that quest's `rewardItemId`.
- The sync stores these items as `catalog_items.grant_only = true`, and the server then refuses them in `buy_cosmetic` (`not_for_sale`) and in `migrate_local_profile`.
- `economy.buy()` refuses them on the client too.
- They can only enter an inventory through `claim_quest_reward` (or an admin).

### Limited-time shop items (Cosmetics)

- A buyable cosmetic (not `earnOnly`) with **`event: '<eventId>'`** (for example `storm_goggles`, `hail_umbrella` with `event: 'natural_disasters'`) is sold **only while that event is live**: `starts_at <= now < ends_at` and `active`. There is no claim grace for sales.
- The sync stores the tag as `catalog_items.event_id` and creates the `game_events` row if it is missing (unscheduled).
- `buy_cosmetic` refuses outside the window with `{ ok:false, reason:'event_not_started' | 'event_ended', event, coins }`. An unscheduled event (`starts_at` null) counts as not started; a paused event (`active=false`) counts as ended.
- **Owned copies are kept forever** (equip, colours, loadout all keep working). `already_owned` is checked before the window.
- Guest import (`migrate_local_profile`) brings a limited item over only from the event start until `ends_at + claim_grace`.
- Client: `economy.itemAvailability(id[, now])` is synchronous and returns `{ forSale, limited, eventId?, state?, startsAt?, endsAt?, msLeft? }`. `state` is `'live' | 'event_not_started' | 'event_ended' | 'not_for_sale' | 'unknown'`.
  - Signed in, it uses the last `event_status`, refreshed in the background every 60 s and corrected by `serverNow`. Before the first answer it is `'unknown'`, and a buy then goes to the server, which decides. Bus `shop:availability` fires when the first answer arrives.
  - Guests use the local event window.
  - `economy.buy(id)` applies the same rule and returns `{ ok:false, code:'event_not_started'|'event_ended', reason:<message> }`. A server refusal rolls back and emits `economy:rejected` with `reason` set to the server reason.
- Shop UI (Cosmetics / ui.js owner): show a "Limited time" badge with `msLeft` when `limited && forSale`. After the event, hide unowned items or show "Event ended" (`state === 'event_ended' && !economy.owns(id)`).

### Paid items in a game: gears and consumables

- **Permanent** items (e.g. the Green Balloon) are gears. Put them in `GEAR_PRICES_BB` in config.js and sell them with `economy.buyGear(gameId, gearId, price)` (the existing `buy_gear` RPC).
- **One-use** items (Apple heal, Bigger Storm boost) go in `CONSUMABLE_PRICES_BB = { apple: 10, biggerStorm: 25 }` in config.js. The sync writes them to `public.game_consumable_prices`.
  - Buy with `await economy.buyConsumable(gameId, itemId, price, ref?)` → `{ ok, coins }` or `{ ok:false, reason }`.
  - **Apply the effect only when `ok`.**
  - The server charges its own price. `ref` (`^[a-zA-Z0-9_:.-]{4,64}$`, e.g. `round12:apple:1`) makes retries free: the same ref is charged once (`duplicate:true`).
  - Reasons are `unknown_item`, `insufficient_funds`, `invalid_ref`, and `network`.

### RPCs

| RPC | Role | Notes |
|---|---|---|
| `quest_progress(p_quest_id, p_delta)` | authenticated | Applies the limits above. The progress table can only be written through this RPC. |
| `get_quests(p_game_id)` | anon or authenticated | Anon gets progress 0. |
| `claim_quest_reward(p_quest_id)` | authenticated | Idempotent. Uses the inventory PK plus `quest_progress.claimed_at`. Writes no wallet ledger row. |
| `buy_consumable(p_game_id, p_item_id, p_ref)` | authenticated | Idempotent per ref. Ledger reason `consumable:<ref>`. |
| `event_status(p_event_id)` | anon or authenticated | `{eventId, title, startsAt, endsAt, claimUntil, active, serverNow}`. An unknown id returns `active:false, unknown:true`. |
| `set_event_window(p_event_id, p_starts_at, p_ends_at, p_active?, p_claim_grace?)` | admins only (`profiles.is_admin`) | Sets or extends a window. The SQL editor or `scripts/event-window.mjs` can do the same. |

### Limited-time events (the "Hunt" menu)

Events live in `public.game_events`:

| Column | Notes |
|---|---|
| `id` | e.g. `natural_disasters` |
| `title` | |
| `starts_at` | `null` means not scheduled yet, which counts as not started |
| `ends_at` | |
| `claim_grace` | default 24 h |
| `active` | |

- Anyone can read the table. Only admins can change it (`set_event_window`, or the SQL editor via `scripts/event-window.mjs`).
- The quest sync creates any event its quests reference, unscheduled, and never overwrites existing dates.
- **Quest window:** a quest with an `eventId` uses the event's window. If the quest also has its own `startsAt`/`endsAt`, the narrower of the two applies. That effective window is what `get_quests` and `quests.status()` return.
- **Progress** outside the window is refused with `event_not_started` or `event_ended`. Quests without an event keep returning `not_live`.
- **Claiming:** a quest that was completed in time can still be claimed until `endsAt + claim_grace`. After that, `claim_quest_reward` / `quests.complete()` returns `reason:'event_ended'`.
- An item that was already granted is owned forever. Nothing is ever revoked.
- `active:false` pauses an event: no progress, but claims still work until the grace ends.
- **Listing:** `get_quests` lists upcoming event quests with `live:false`, and keeps listing finished-but-unclaimed quests until the claim window closes.

Client calls:

```js
const ev = await quests.eventStatus('natural_disasters');
// { eventId, title, startsAt, endsAt, claimUntil, active, serverNow, msLeft, msToStart }
// cached 60 s; pass { refresh: true } to force a fetch
countdown.textContent = ev.active ? fmt(ev.msLeft) : ev.msToStart ? `Starts in ${fmt(ev.msToStart)}` : 'Event over';
bus.on('event:changed', (ev) => redrawHuntMenu(ev));   // emitted when a fetch shows new dates or a new active state
```

- `serverNow` is the server's clock at the fetch, advanced by the local time elapsed since. `msLeft` (`endsAt − serverNow`) is therefore correct even if the device clock is wrong. Re-check `active` when `msLeft` reaches 0, or just call `eventStatus` again.
- **Offline / guests:** the window comes from the event's `QUESTS` `startsAt`/`endsAt`. Without dates it defaults to an active 7-day window starting from this device's first run, with the same 24 h claim grace. The result carries `local: true`.

## Multiplayer RPCs (migration `20261018000007_multiplayer.sql`)

| RPC | Notes |
|---|---|
| `mp_join(p_game_id, p_friend)` | Places you in an instance (`game:<gameId>:<n>`, cap `app_config.mp_instance_cap`, default 12). It keeps your current instance, otherwise picks the fullest one with room, otherwise creates a new one. With `p_friend` (an accepted friend) it joins the friend's instance, and returns `note:'friend_full'` and overflows if that instance is full. Returns `{ok, instance, topic, cap, sendHz, roster}`. |
| `mp_heartbeat(p_game_id, p_instance)` | Call every 20 s. Members expire after `mp_member_ttl_s` (45). Returns the fresh roster and `sendHz`, or `reason:'rejoin'`. |
| `mp_leave()` | Leave your instance. |
| `friends_playing()` | Lists friends who are in a game: `[{username, displayName, gameId, instance, full}]`. Used by the portal Join button. |

- The roster (names, cosmetics, colors) comes only from the server.
- Realtime broadcasts carry positions and a "new chat" hint and are only used for drawing.
- Chat itself stays `post_chat` / `get_chat`, with phrase ids only and the room `game:<gameId>:<n>`.
- Economy actions never travel over Realtime.
