# Deploying Iceberg (free tier: static host + Supabase)

Nothing here has been deployed yet. All of it was tested locally against real Postgres
(PGlite) and a local Supabase-compatible stub (`tools/db/dev-server.mjs`).

## What you get

| Path            | What                                                                 |
|-----------------|----------------------------------------------------------------------|
| `/`             | Portal: featured banner, games (Newest / Most Popular / Most Active), Safe Chat room, friends, settings, sign in |
| `/play/?game=…` | The game (opened in a new tab from the portal)                        |
| `/featured.json`, `/featured/*.png` | Fallback featured-banner list + images              |
| `/manifest.webmanifest`, `/sw.js`, `/icons/` | PWA (installable; the SW caches the app shell only, never auth/API) |

Every page is a single self-contained HTML file with relative URLs, so the site works
under a subpath such as `https://<user>.github.io/iceberg/`.

## 1. Supabase (free project)

1. Create a project at supabase.com (free tier). Note the **Project URL** and the **anon public key**
   (Settings → API). The anon key is public by design; Row Level Security protects data.
2. Auth → Providers → Email: keep it enabled and **turn off "Confirm email"** (usernames map to
   synthetic addresses `<username>@<VITE_USERNAME_EMAIL_DOMAIN>`, which never receive mail).
   Pick a domain you control or `users.iceberg.invalid`.
3. Apply the schema. Either:
   - Supabase CLI: `supabase link --project-ref <ref>` then `supabase db push`, then
     `node scripts/sync-catalog.mjs --out /tmp/sync.sql` and run it in the SQL editor; or
   - `SUPABASE_DB_URL='postgres://postgres:<pw>@db.<ref>.supabase.co:5432/postgres' node scripts/migrate.mjs --remote`
     (applies each migration once and runs the sync; `--dry-run` prints the plan).
4. Re-run the sync on every deploy (the example workflow does). It upserts cosmetic prices from
   `src/data/cosmetics.js`, gear prices from `src/games/*/config.js`, Safe Chat phrases from
   `src/data/safeChat.js`, and game publish dates from `src/data/gameMeta.js`. `npm test` fails if any
   catalog item is missing a server price.

## 2. Build

```bash
npm ci && (cd tools/db && npm ci)
VITE_SUPABASE_URL=https://<ref>.supabase.co \
VITE_SUPABASE_ANON_KEY=<anon key> \
VITE_USERNAME_EMAIL_DOMAIN=users.iceberg.invalid \
node scripts/build-site.mjs --out dist-site       # forces VITE_ICEBERG_SITE=1: no demo bucks / dev grants
```

Without the two Supabase variables the site still works fully offline as a guest (localStorage).

## 3. Host (pick one, both free)

- **GitHub Pages:** push the repo, Settings → Pages → Source: GitHub Actions, and copy
  `docs/deploy-workflow.example.yml` to `.github/workflows/deploy.yml`. Add repository secrets
  `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (anon key only) and (optional, for automatic migrations) `SUPABASE_DB_URL`.
- **Cloudflare Pages:** build command `npm ci && node scripts/build-site.mjs`, output `dist-site`,
  same variables as environment variables.

Then add the site URL under Supabase → Auth → URL Configuration (Site URL).

### Networks that block Postgres ports
Use HTTPS instead: `SUPABASE_ACCESS_TOKEN=<personal access token> SUPABASE_PROJECT_REF=<ref> node scripts/migrate.mjs --mgmt-api`
(and `scripts/backup-db.sh`, `node scripts/live-smoke.mjs` with the same env), or paste the generated
one-file setup SQL into the dashboard SQL editor.

## 4. Editing the featured banner (Colin / admins)

The banner at the top of the portal home page shows the active rows of `public.featured_games`
in `sort_order`. Anyone can read it; **no client can write it**, not even a signed-in player.
Only admins (via `set_featured_games`) or the service role / SQL editor can change it.

**Easiest: the Supabase dashboard (Table Editor → `featured_games`).** The dashboard uses the
service role, so you can edit rows directly:

| column       | meaning                                                                    |
|--------------|----------------------------------------------------------------------------|
| `game_id`    | id of a game in `public.games` (e.g. `giant-rainbow-obby`, `birg-hq`, `frost-fields`) |
| `sort_order` | 1 = shown first                                                            |
| `active`     | untick to hide it without deleting                                         |
| `blurb`      | short description (≤ 160 chars); empty = the game's own tagline            |
| `image`      | site-relative image path, e.g. `featured/birg-hq.png` (put the file in `site/public/featured/`); empty = the game's thumbnail |

Or in the SQL editor:

```sql
-- feature Frost Fields first
insert into public.featured_games (game_id, sort_order, blurb)
values ('frost-fields', 0, 'Race across the frozen fields and grab every coin!')
on conflict (game_id) do update set sort_order = excluded.sort_order, blurb = excluded.blurb, active = true;

-- stop featuring BIRG HQ
update public.featured_games set active = false where game_id = 'birg-hq';
```

**Make an account an admin** (once, in the SQL editor) so it can replace the whole list through the API:

```sql
update public.profiles set is_admin = true
where id = (select id from auth.users where email = 'colin@users.iceberg.invalid');  -- <username>@<domain>
```

```js
// e.g. from the browser console on the portal while signed in as that admin
await icebergPortal.remote.client.rpc('set_featured_games', { p_items: [
  { gameId: 'giant-rainbow-obby', blurb: '1000 rainbow stages!', image: 'featured/giant-rainbow-obby.png' },
  { gameId: 'birg-hq' },
] });
```

Players can't set `is_admin` themselves (profiles have no client write access; it's tested).

**Fallback list:** `site/public/featured.json` ships with the site and is used when the backend
isn't configured or can't be reached. It also seeds the table on the very first deploy (only while
the table is empty, so a re-deploy never overwrites admin edits). Keep it roughly in sync if you
want offline visitors to see the same banner.

## 5. Kid safety and security notes

- **No free text anywhere.** Chat is Safe Chat only: the server accepts phrase ids from
  `chat_phrases` (synced from `src/data/safeChat.js`), with rate limits. Usernames are restricted
  (`[a-z0-9_]`, 3–20) and display names are validated server-side.
- **Server-authoritative economy.** Birg Bucks, purchases, gears, daily bonus and game earnings go
  through security-definer RPCs with per-source daily caps and idempotent ledger refs. Tables have
  RLS; clients can't write balances, inventory, gears or featured games. `saveGameData` is never
  trusted for money or gear ownership.
- **No email is collected**, so password reset isn't possible; an admin can reset one from
  Supabase → Auth → Users. Consider COPPA/GDPR-K before collecting anything else.
- Production builds have no demo packs or dev grants (`VITE_ICEBERG_SITE=1`).
- Never put the **service role key** or the DB password in the client or in `VITE_*` variables.

## 6. Backups

- Source: `scripts/backup.sh [dir]` (tarball + git bundle, local only).
- Database: `SUPABASE_DB_URL=… node scripts/db-backup.mjs --remote` (pg_dump; the free tier has no
  point-in-time recovery, so schedule this). Local dev DB: `node scripts/db-backup.mjs --local .devdb`
  and `--restore-local <file> <dir>`.

## 7. Local development (no Supabase needed)

```bash
(cd tools/db && npm ci)
node scripts/migrate.mjs --local .devdb
VITE_SUPABASE_URL=http://localhost:54321 VITE_SUPABASE_ANON_KEY=dev-anon-key node scripts/build-site.mjs --out dist-site
node tools/db/dev-server.mjs --data .devdb --static dist-site --static-port 8080   # open http://localhost:8080/
npm test      # catalog check, PGlite DB tests, single-file game, full site e2e; screenshots in /tmp/iceberg-test/shots
```

The dev server is a stub of GoTrue/PostgREST (opaque tokens, no email flows, no auth rate
limiting) over the real migrations. Don't expose it to the internet.

## 8. Limited-time events (Natural Disasters "Hunt", 1 week)

Migration 8 seeds `public.game_events` row `natural_disasters` with **no dates**. Until they are set, the event is "not started": the Hunt menu shows no countdown and quest progress is refused.

**Release A (multiplayer/quests infrastructure, no Natural Disaster Survival): do NOT set the window.** Leave `natural_disasters` unscheduled. While it is unscheduled or not started, every event cosmetic (the buyable `event:` items and the earnOnly quest rewards) is hidden in the shop (`economy.shopVisible`), `buy_cosmetic` refuses them with `event_not_started`, and there are no quests.

**At the event release (the deploy that ships the game), set the window.** Unless Colin or Jojo give dates, it starts at deploy time and ends 7 days later:

```bash
. /workspace/iceberg-ops/load-env.sh && export SUPABASE_ACCESS_TOKEN="$SB_ACCESS_TOKEN" SUPABASE_PROJECT_REF="$SB_PROJECT_REF"
node scripts/event-window.mjs natural_disasters --start now --days 7          # default
node scripts/event-window.mjs natural_disasters --start 2026-10-20T00:00:00Z --end 2026-10-27T00:00:00Z   # given dates
node scripts/event-window.mjs natural_disasters --show                         # check (event_status shows serverNow)
```

Later changes:
- Extend: `--extend-days 2`.
- Claim grace: `--grace-hours 48` (default 24 h).
- Pause or resume: `--off` / `--on`.

Add `--print` to get the SQL to paste into the SQL editor instead of running it. An admin account can also call `set_event_window` directly.

What happens after the end:
- Progress stops.
- Completed quests can still be claimed for the claim grace.
- Owned rewards are never removed.

### Live multiplayer check (right after deploy, as part of the live smoke test)

This needs migrations 7–8 applied (after the backup). Run it with two real browsers and two real test accounts against the live site:

```bash
. /workspace/iceberg-ops/load-env.sh && export SUPABASE_ACCESS_TOKEN="$SB_ACCESS_TOKEN" SUPABASE_PROJECT_REF="$SB_PROJECT_REF" SUPABASE_URL="$SB_PROJECT_URL" SUPABASE_ANON_KEY="$SB_ANON_KEY"
node scripts/mp-two-browser.mjs --base https://iceberg-games.github.io/iceberg/ --api "$SB_PROJECT_URL" --anon "$SB_ANON_KEY" [--cap]
node scripts/live-smoke.mjs --cleanup-only      # removes ONLY zz_test_publisher_1..13 and their rows
```

`--cap` signs up 11 more test users. Supabase Auth limits sign-ups per hour, so skip it if the limit is hit; the cap logic is covered by the local run.

## 9. Multiplayer and Supabase Realtime limits (free plan)

Every game instance is one **private** Realtime channel, `game:<gameId>:<instance>`.
- RLS on `realtime.messages` (policies `iceberg_mp_read` / `iceberg_mp_write`) only lets players who are currently placed in that instance by `mp_join` read from it or write to it.
- In the Supabase dashboard → Realtime settings, keep **"Allow public access" OFF**. The client only uses private channels.

Free-plan limits ([docs](https://supabase.com/docs/guides/realtime/limits)):

| Limit | Free plan | How we stay inside it |
|---|---|---|
| Concurrent connections | 200 | One socket per playing tab, and only while in a game. |
| Messages per second (sent + delivered, whole project) | 100 | The server computes `sendHz = clamp(mp_msg_budget / Σ(players²), 1, 10)` with `mp_msg_budget = 60`. Clients send only when someone else is there and only when something changed, plus a 5 s keepalive. |
| Presence messages per second | 20 | Presence is tracked once per join. Movement goes over broadcast, not presence. |
| Channel joins per second | 100 | One join per game start. Reconnect uses backoff. |
| Broadcast payload | 256 KB | Each state message is about 80 bytes. |

What this means:
- One broadcast to an instance of N players costs N events (1 sent plus N−1 delivered), so an instance costs about N²·Hz events/s.
- On the free plan: 3 players get the full 10 Hz. 12 players in one instance get only about 1 Hz (12² = 144 > 60 at 1 Hz, so it is already slightly over budget at the floor). In total the plan supports roughly 7 players at 1 Hz across the whole site.
- Interpolation hides low rates, but movement looks laggy at 1–2 Hz.
- For real traffic, either **lower `mp_instance_cap`** (e.g. 6) or move to **Pro** (500 msg/s, then raise `mp_msg_budget` to about 400).
- Both are a single SQL update: `update app_config set value = '6' where key = 'mp_instance_cap'`.

Rate limiting and trust:
- The client sends at most 10 Hz and drops incoming messages from a sender above 15/s.
- Incoming messages are type and range checked, sequence checked, and must come from a sender in the server roster.

**Known limitation:**
- Supabase does not stamp broadcast messages with the sender's identity. A modified client that has joined an instance can therefore draw *another member's* avatar in the wrong place on other screens.
- It cannot affect coins, inventory, chat text or anything stored. Outsiders cannot join at all.
- If this becomes a problem, the fix is a server relay (an Edge Function) that stamps the sender.

## Iceberg Plus (prep only — not live)
- Planned: **$9/month** membership (badge, Mobile Studio custom colors, computer Studio custom prefabs). UI shows **Coming soon**; nothing is charged.
- Flag is local/demo only (`src/core/plus.js`, localStorage `iceberg:v1:plus`). Future server field (additive, NOT applied): `profiles.plus_until timestamptz NULL`, set only by a verified payment webhook.
- Planned economics: **$1 per purchase held for App Store / Google Play fees; remainder to cadavis84@gmail.com.**
- **Colin must re-confirm before any payment account (Stripe or otherwise) is set up.** Free/demo for now; no Stripe.

### Iceberg Plus — server-backed (migration 0015)
- Apply order: 0014 (`20261025000014_plus_only.sql`, already on main) then **`20261025000015_plus_membership.sql`**. Additive only: adds `profiles.plus_until` (NULL for all), `plus_grants` audit table, replaces `is_plus()` stub, adds `plus_status()` and dev-only `grant_plus()`. No player data changed.
- Deploy the SQL **before** the client: on an older server `plus_status` is missing and the client silently falls back to the local demo flag (guests only behaviour).
- Grant (comp/demo, not a payment): a dev/admin (`is_dev()`) uses Portal dev row → username → **❄️ Grant Plus** (30 days) / **Revoke Plus**, or SQL: `select public.grant_plus('username', 30, 'note');` while signed in as a dev. Service-role/SQL editor: `update profiles set plus_until = now() + interval '30 days' where username = '...';`. Clients cannot write `plus_until` (no update grant on profiles).
- Real purchases: **none**. $9/mo stays "Coming soon"; no Stripe. Colin must re-confirm before any payment account. Note: $1/purchase held for App Store/Play fees; rest to cadavis84@gmail.com.
- `economy.isPlus` (shop listing of wh_plus_* items) is still false client-side; server `buy_cosmetic` now honours real `is_plus()`.
