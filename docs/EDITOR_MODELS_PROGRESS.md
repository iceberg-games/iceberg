# Editor Update — shared custom models

Branch: `feature/editor-models` (off `c01dd29`)
Worktree: `/workspace/iceberg-game-maker/wt-editor-models`
Do not publish, push to main, or write to the live Supabase DB.

## Goal

Players can see each other's custom models in games: a `.glb` imported in Studio, or a custom worn avatar model, must show for every player, not only the owner.

## Investigation (c01dd29)

### Where models live today

- Uploaded `.glb` / `.gltf` / `.obj` files are stored in this browser only, in IndexedDB (`iceberg-models` / store `models`). See `src/backend/LocalBackend.js` `modelStore` and `src/game/models.js` `ModelLibrary`.
- Placements and wear settings (`modelPlacements`, `modelWear`) are small JSON in localStorage (`iceberg:v1:`).
- A Studio game doc only stores `modelId` on instances (`src/studio/instances.js`). The binary is never part of the published `custom_games.doc`.
- `publish()` in `src/studio/store.js` already returns `modelsLocalOnly: usesUploadedModels(doc)`. The Studio toast says other players see a placeholder box — and they do: `buildObject` in `instances.js` draws a pink wireframe cube when `models.instance(id)` is missing.
- Local file export (`src/core/share.js`) *does* embed models as base64, but that path is optional backup, not the server publish path.
- Game docs are capped at ~2 MB (`custom_game_max_bytes`). Embedding 25 MB GLBs in `doc` is not viable. There is no Storage bucket for models in existing migrations.

### How multiplayer syncs

- Net module: `src/mp/multiplayer.js` on top of `src/net/realtime.js`.
- Trusted roster (name, equipped catalog cosmetics, colours) comes from `mp_join` / `mp_heartbeat` → `_mp_roster` → `_public_player`. Broadcasts are cosmetic-only and must not be trusted for identity.
- Movement is broadcast event `'s'` at up to 10 Hz. Shared game state is `'st'` (host). There is no model or wear field on the roster or on movement packets.
- Remote avatars are built in `addOther()` with `applyLoadout` only. `Avatar.setCustomWear` is local (`modelPrefs.loadWear()` in `src/main.js`).

## Plan

1. A **model reference**: `{ id, name, format, hash, bytes, url }` (SHA-256 + public Storage URL). Remote clients fetch, cache (IndexedDB), validate (25 MB cap, glTF/GLB only, hash match, no external URIs, URL allow-list), then render. Placeholder while loading; existing pink box on failure.
2. **Published Studio games**: on publish, upload each used glTF to bucket `game-models` at `{userId}/{hash}.{glb|gltf}`, attach `doc.modelAssets`. Runtime/editor call `ModelLibrary.ensureAssets` and swap placeholders when ready. `.obj` stays local-only (not published).
3. **Worn custom models**: the same ref is part of what a player broadcasts (`'w'`, infrequent — not the 10 Hz move packet) and, when the migration is applied, of `profiles.custom_wear` via `save_loadout` / `_public_player`. Remotes prefer the roster field when present, otherwise a validated broadcast.
4. Local/dev: Storage stub on `tools/db/dev-server.mjs`. Migration is additive and is **not** applied to live DB from this branch.

## Commits

- (this file) investigation + plan
- core ref / hash / validate helpers + unit tests
- migration SQL + dev-server storage stub + client upload
- library fetch/cache, publish hook, placeholder swap
- multiplayer wear broadcast
- two-client test + screenshots

## Status

In progress. See later sections as commits land.
