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
- [x] Built-in games unlisted via registry flag (see below)
- [ ] PC home: sidebar, search, hello + friends row, game rows, community on top
- [ ] Creator edit of name / thumbnail / description (migration 20261121000020, NOT applied)
- [ ] Groups screen (local only for now)
- [ ] Tiles open a new tab via deep link
- [ ] Phone gate: "Sorry, mobile is being fixed right now."
- [ ] HQ: remove leftover Winterhaven event decorations/items
- [ ] HQ + Frosted Fields editable in Studio, owned by gooberr478 (seed SQL, NOT applied)

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
