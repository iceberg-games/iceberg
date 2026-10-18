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
