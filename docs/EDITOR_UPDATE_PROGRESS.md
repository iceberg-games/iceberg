# Iceberg Editor Update: progress note

Branch `feature/editor-update` (worktree `/workspace/iceberg-game-maker/wt-editor-update`), based on main `c01dd29`.
NOT published. Nothing here is pushed to main or applied to the production DB. Resume from the first unchecked box.

## Full update
1. PC home redesign (Vortex-style reference), community games at top, creator edits name/thumbnail/description
2. Studio GUI builder + corner AI chat (text only, paid with credits; provider/cost question goes to Colin first)
3. PC UGC accessory editor
4. Custom models visible to others in multiplayer
5. 4+ new community games

## Step 1 checklist (first drop)
- [x] Shop renamed to Catalog (labels only; ids/logic unchanged)
- [x] Built-in games unlisted via registry flag (see below); only BIRG HQ + Frost Fields listed
- [x] PC home: sidebar (Home, Profile, Friends, Catalog, Inventory, Avatar, Groups, Settings | Studio, Create, Download), search that filters by game name and creator, "Hello, <username>!" + real avatar snapshot + Friends row, rows: Popular right now, Recently added (community, at the TOP), Your Games, Iceberg games
- [x] Creator edit of name / thumbnail / description (migration 20261121000020, NOT applied; falls back to re-publish if the RPC is missing)
- [x] Groups screen (local to this device; Supabase version deferred)
- [x] Tiles open a pop-out game window (?game=<id>&popout=1&autostart=1); blocked popup -> new tab
- [x] Install Iceberg (PWA): manifest + icons in the new palette, existing sw.js reused, Download sidebar entry (beforeinstallprompt or instructions)
- [x] Phone gate: "Sorry, mobile is being fixed right now."
- [x] HQ: leftover Natural Disasters event meteor shards / quest HUD gated off
- [x] Studio copies of BIRG HQ + Frost Fields (exported from the real scenes) + seed SQL for gooberr478 (NOT applied)
- [x] Merged feature/editor-accounts (cce8633) and avatars/default-avatar-r15 (8e58769)
- [ ] Not started (later steps): Studio GUI builder + AI chat, UGC accessory editor, custom models in multiplayer, 4+ new community games

## Listing flag
`src/games/registry.js`: `UNLISTED_IDS` (a Set of game ids). Unlisted games keep all code/assets/data and still play by direct
link (`?game=<id>`); they only disappear from the Games menu and portal (`LISTED_GAMES`). To bring one back, delete its id from
the set (one line). Empty the set to list everything.

## Migrations written (not applied)
- `supabase/migrations/20261121000020_custom_game_meta.sql`: `update_custom_game_meta` RPC (owner-only name/description/thumbnail edit).
  Client falls back to re-publishing if the RPC is missing.

## Event leftovers flag
`src/games/registry.js`: `EVENT_QUESTS_ACTIVE = false` removes the Natural Disasters event quest wrappers (quest HUD + the five
meteor shards in BIRG HQ + Frost Fields / Obby trackers). Code/assets under `src/games/_event/` are untouched; set it to `true` to restore.

## Phone gate flag
`src/core/mobileGate.js`: `MOBILE_BLOCKED = true` shows "Sorry, mobile is being fixed right now." on phones (existing mobile detection
+ small screen; PC browsers in narrow windows are not blocked). Phone layout code is untouched. `?allowMobile=1` bypasses it for tests.

## Studio copies of HQ + Frost Fields
Built-in games are code scenes (procedural THREE meshes); Studio games are JSON parts. `scripts/export-builtin-to-studio.mjs` loads the
real game headlessly and converts every visible mesh to a Studio part (boxes / cylinders / spheres exact, other shapes by bounding box,
texture colors averaged) -> `designs/editor-update/studio-copies/*.iceberg.json` (use "Import (.json)" on the home to get an editable copy
under whatever account imports it) and `supabase/seeds/studio_copies_gooberr478.sql` (gives the published copies to gooberr478; NOT a
migration, apply by hand after approval). The original code scenes stay as the playable HQ / Frost Fields. Fidelity is approximate
(cones become cylinders, custom meshes become boxes, no lights/particles/interactions).

## Migrations / seeds (none applied)
- `supabase/migrations/20261121000020_custom_game_meta.sql` (this step)
- `supabase/migrations/20261122000020_editor_accounts.sql` (from feature/editor-accounts)
- `supabase/seeds/studio_copies_gooberr478.sql` (seed, by hand)
