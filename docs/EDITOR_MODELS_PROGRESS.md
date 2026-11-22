# Editor Update — shared custom models (v2)

Branch: `feature/editor-models-v2` (off `23212fb`, plus models work from `3070e6c`, plus hotfix `a137fb4`)
Worktree: `/workspace/iceberg-game-maker/wt-editor-models-v2`
Do not publish, push to main, or write to the live Supabase DB. The migration below needs Colin's OK before it is applied live.

## v2 goal

When a player imports a custom model in Studio and publishes, every other player in the multiplayer game — including late joiners — must see it. Worn models too. `.obj` files are converted to `.glb` on import when possible.

## What landed in v2

- Published Studio placements are listed on `doc.modelAssets` (hash + public Storage URL). Remotes fetch, cache (IndexedDB `assets` by hash), validate (25 MB, glTF/GLB only, hash match, no external URIs, URL allow-list), show a blue wireframe while loading, and fall back to the existing pink box on failure.
- Worn custom models: infrequent `'w'` broadcast, presence `track({wear})`, 8s resend while others are present, plus `profiles.custom_wear` on the roster once the migration is applied.
- `.obj` → `.glb` on import and on republish (`src/game/objToGlb.js`, materials/UVs dropped). Unconvertible files stay local with a clear creator warning (`unshareable`).
- Owners of already-published games get a Studio banner and a play-time toast to press Publish again so older games pick up `modelAssets`.
- Placeholder, cache, pink-box fallback, and size/validation limits are unchanged.

## Tests (after merging hotfix `a137fb4`)

- `node scripts/editor-models-unit-test.mjs` — 13/13 (hash, validate, allow-list, attach, OBJ→GLB, republish helpers)
- `node scripts/editor-models-e2e.mjs` — 7/7 (two signed-in clients vs local dev backend: upload, uid prefix, publish + fetch, customWear roster, clear, invalid payload)
- `node scripts/editor-models-two-browser.mjs` — ALL PASS against a local-only PGlite DB (migration applied locally, not live): A imports `scripts/fixtures/box.glb`, places it, publishes; B joins and loads the same hash+URL with no placeholder; late joiner C does too
- Existing smokes: studio-e2e 75/75, editor-update-e2e ALL PASS, script-check 10/10, nlscript 219/219, studio-save 6/6, studio-chat 71/71

## Screenshots

`designs/editor-models/`:

- First-drop stills: `overview.png`, `player-a.png`, `player-b-loading.png`, `player-b-loaded.png`, `player-b-fallback.png`
- v2 two-client run (local backend): `v2-client-a-studio.png`, `v2-client-a-published.png`, `v2-client-a-play.png`, `v2-client-b-play.png`, `v2-client-c-late.png`, `v2-client-a-with-others.png`, `v2-client-b-with-others.png`

## Migration / storage-bucket setup (not applied live)

File: `supabase/migrations/20261122000025_game_models.sql`

Needs Colin's OK before a live apply. Without it, other players cannot fetch models on live (no public `game-models` bucket, no roster `customWear`, and `save_loadout` has no 4th argument — the client already falls back so wear broadcasts still work).

What it changes (additive only):

- `app_config.game_model_max_bytes` = 26214400
- `profiles.custom_wear jsonb`
- `_clean_custom_wear` — validates hash/format/bytes/URL/pose, returns null if unusable
- `_public_player` includes `customWear`
- `_profile_json` includes `customWear`, and keeps account fields `dateOfBirth` / `deactivated` plus `gameData` via `_game_data_json`
- `save_loadout(..., p_custom_wear default null)` — null leaves the column unchanged; pass `{}` to clear
- When the `storage` schema exists (hosted Supabase): public bucket `game-models`, 25 MB, public read, authenticated write/update/delete only under `{auth.uid()}/{sha256}.{glb|gltf}`

Local PGlite has no storage schema; `tools/db/dev-server.mjs` stubs the same URL shape (public GET, signed-in upload only under your uid). This was applied only to a local temp DB during tests, never to live.

## Gaps

- Already-published games need the owner to publish again (prompted in Studio and when the owner plays).
- OBJ conversion keeps triangulated geometry only (materials, UVs, normals, smooth groups are dropped). Unconvertible OBJs stay local with a warning.
- The play-view screenshots use the default third-person camera, so the small placed cube can sit just ahead of the avatar and is easier to confirm in `v2-client-a-studio.png` and in the e2e assertions (`ready`, no placeholders, matching hash) than in the play stills.
- `updateGameMeta` RPC fallback publish can still omit `{ library }` (existing `modelAssets` on the doc are preserved).
- Two visible headed desktop windows were not opened on the box desktop (this executor has no computerUse/desktop-subagent tool). The two-client + late-joiner path was run headless against the local migrated backend and screenshots were saved.
- No live Storage bucket exists until this migration is applied on hosted Supabase.

---

# Editor Update — shared custom models

Branch: `feature/editor-models` (off `c01dd29`)
Tip: see `git rev-parse HEAD` (this report is for the tip after the tests/screenshots commit).
Worktree: `/workspace/iceberg-game-maker/wt-editor-models`
Do not publish, push to main, or write to the live Supabase DB.

## Goal

Players can see each other's custom models in games: a `.glb` imported in Studio, or a custom worn avatar model, must show for every player, not only the owner.

## Investigation (c01dd29)

### Where models live today (unchanged for local drafts)

- Uploaded `.glb` / `.gltf` / `.obj` files are stored in this browser only, in IndexedDB (`iceberg-models` / store `models`). See `src/backend/LocalBackend.js` `modelStore` and `src/game/models.js` `ModelLibrary`.
- Placements and wear settings (`modelPlacements`, `modelWear`) are small JSON in localStorage (`iceberg:v1:`).
- A Studio game doc only stored `modelId` on instances. The binary was never part of the published `custom_games.doc`.
- `publish()` used to return `modelsLocalOnly` and toast that other players see a placeholder box — `buildObject` draws a pink wireframe cube when `models.instance(id)` is missing.
- Local file export (`src/core/share.js`) already embeds models as base64; that path is optional backup, not the server publish path.
- Game docs are capped at ~2 MB. Embedding 25 MB GLBs in `doc` is not viable. There was no Storage bucket for models.

### How multiplayer syncs

- Net module: `src/mp/multiplayer.js` on top of `src/net/realtime.js`.
- Trusted roster (name, equipped catalog cosmetics, colours) comes from `mp_join` / `mp_heartbeat` → `_mp_roster` → `_public_player`. Broadcasts are cosmetic-only.
- Movement is broadcast event `'s'` at up to 10 Hz. Custom wear is **not** on that packet (too frequent). It now uses a separate infrequent `'w'` broadcast, plus `profiles.custom_wear` on the roster once migration 0020 is applied.

## What landed

1. **Model reference** `{ id, name, format, hash, bytes, url }` (SHA-256 + public Storage URL). Module: `src/game/modelAssets.js`.
   - Remote fetch: 25 MB cap, glTF/GLB only, hash must match, no external URIs, URL allow-list (this project's Storage host or localhost).
   - IndexedDB cache: `iceberg-models` v2 store `assets`, keyed by hash.
   - Placeholder: blue wireframe while loading; existing pink box (or red on a worn item) if it fails.

2. **Published Studio games.** On publish, each used `.glb`/`.gltf` is uploaded to bucket `game-models` at `{userId}/{hash}.{ext}` and listed on `doc.modelAssets`. Runtime and editor call `ModelLibrary.ensureAssets` and swap placeholders when `models:ready` fires. `.obj` stays local-only.

3. **Worn custom models.** Equipping a custom model uploads it (when signed in), broadcasts `'w'`, and calls `save_loadout` with `p_custom_wear`. Remotes prefer the roster field when present, otherwise the validated broadcast. If the live database has not been migrated, the 4-arg RPC is skipped and broadcast still works.

4. **Local/dev.** `tools/db/dev-server.mjs` stubs the same Storage URL shape (public GET, signed-in upload only under your uid).

## Tests

- `node scripts/editor-models-unit-test.mjs` — hash, validate, allow-list, attach, fetch+cache.
- `node scripts/editor-models-e2e.mjs` — two signed-in clients against the local dev backend: upload, rejected cross-user upload, publish with `modelAssets`, B fetches and caches, `customWear` appears on B's `mp_join` roster, clear + invalid payloads.
- Screenshots: `designs/editor-models/` (`overview.png` and the four states). Generated by `node scripts/editor-models-screenshots.mjs`.

## Migration / storage-bucket setup (not applied)

File: `supabase/migrations/20261122000020_game_models.sql`

Needs a later, approved deploy (do not run against live from this branch):

- `profiles.custom_wear jsonb`
- `_clean_custom_wear`, `_public_player` includes `customWear`, `_profile_json` includes it, `save_loadout(..., p_custom_wear default null)`
- When the `storage` schema exists (hosted Supabase): public bucket `game-models`, 25 MB, public read, authenticated write only to `{auth.uid()}/{sha256}.{glb|gltf}`

## Gaps

- Already-published games do not get `modelAssets` until the owner publishes again.
- `.obj` uploads still only show on the owner's device (remote path is glTF-only, as specified).
- Broadcast `'w'` is accepted only from a roster+present sender and only if the ref passes the same URL/hash/format checks; it is still not as authoritative as the roster field.
- The two-client test uses the local API + Storage stub (and roster RPCs), not a full two-browser Iceberg play session.
- Presence `track()` meta does not carry the wear payload (broadcast + roster only).
- No live Storage bucket exists until the migration is applied on hosted Supabase.
