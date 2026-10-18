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
