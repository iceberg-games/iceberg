# Iceberg community seeds (Editor Update)

Two polished player-style games, built **only with what Iceberg Studio supports** (instances + Studio's behaviour
scripts: triggers, variables, doors, messages, timers, leaderboard, coins, gear givers). They are stored in the same
project format Studio saves (`doc.version 2`) and load through `src/studio/store.js` like any player-made game.
Creator credit: **gooberr478**.

| | Suds & Duds Laundromat | Midnight at Maple Mall |
|---|---|---|
| slug / game id | `suds-and-duds-laundromat` / `g_suds_and_duds` | `midnight-at-maple-mall` / `g_midnight_at_maple_mall` |
| genre | Tycoon · Clicker (everyday place: corner laundromat) | Adventure · Scavenger hunt (everyday place: a shopping mall after closing) |
| project JSON | `suds-and-duds-laundromat.json` (536 instances, ~186 KB) | `midnight-at-maple-mall.json` (720 instances, ~218 KB) |
| thumbnail | `suds-and-duds-laundromat.png` (960×540; a 320×180 JPEG is embedded as `doc.thumbnail`) | `midnight-at-maple-mall.png` (same) |

**Suds & Duds Laundromat** — Run the corner laundromat! Click the sorting table to wash loads, then step on glowing pads to
buy washers, dryers, a vending machine and more. Knock down the wall to expand into the Dry-Cleaning Wing and light up the
Grand Reopening sign. A cozy tycoon by gooberr478.
*Loop:* click for cash → buy detergent/cart/helper/cards (click value + passive income) → buy 12 machine/expansion pads in order
(each reveals a real machine) → pay for the expansion (the partition wall disappears) → Grand Reopening finale. Milestone
messages at lifetime-earnings thresholds; leaderboard shows Points (lifetime earned), Cash, Skill Level.

**Midnight at Maple Mall** — You fell asleep in the beanbag aisle and the mall locked up for the night! Explore the Toy Kingdom,
Pet Paradise, Arcade, Cinema and Food Court, find 6 security keycards, hunt 24 lost coins and 3 secret golden ducks, then unlock
the Loading Dock and escape before morning. An after-hours adventure by gooberr478.
*Loop:* explore a cross-shaped two-level mall (concourse, upper walkway via stairs, food-court hall, rooftop garden, loading dock);
sign/NPC hints (Gus the guard, Joan the janitor); 6 keycards each behind a small puzzle (arcade prize case needs 8 coins, secret
cinema seat opens the projection booth, service elevator needs 3 keycards, toy-block tower, hamster-crate shelf, rooftop); 24 "Lost
Change" coins (+5 bonus Vault Coins); a free Gravity Coil ("Pogo Boots") for the high ledge; the Strange Book hides a fake shelf and
opens a duck; 3 ducks open the Janitor Closet; the dock gate opens with 6 keycards; two endings (escape / escape with all ducks = "Mall Legend").
Cleaning bots bump you (tiny damage only, no respawn loop).

Machine-readable titles/descriptions: `metadata.json`.

## Files
- `scripts/community-seeds/lib.mjs` – small builder library (mirrors the Studio instance schema; validates targets/triggers).
- `scripts/community-seeds/suds.mjs`, `mall.mjs` – the two games as code (scripts are compiled behaviour programs; stored as `program`, which the runtime reads directly).
- `scripts/build-community-seeds.mjs` – regenerates `community-seeds/*.json` + `metadata.json` (embeds `<slug>.thumb.jpg` when present).
- `scripts/community-seeds-thumbs.mjs` – captures the thumbnails from the running game.
- `scripts/community-seeds-smoke.mjs` (+ `scripts/community-seeds/mall-smoke.mjs`) – Studio play-mode smoke test; screenshots + `smoke-results.txt` in `community-seeds/screenshots/`.
- `scripts/publish-community-seeds.mjs` – **publish script, gated** (below).

Rebuild: `node scripts/build-community-seeds.mjs`. Smoke (needs `npx vite --host --port 5203`): `GAME=both HEADLESS=1 node scripts/community-seeds-smoke.mjs`.
Try by hand: in Studio ▸ Import, pick a `*.json` wrapped as `{format:'iceberg-game',version:1,game:<doc>,models:[]}`, or from the console
`(await import('/src/studio/store.js')).drafts.save(doc)` then `iceberg.edit(doc)` / ▶ Test.

## Publishing (NOT done; needs Colin's approval)
`node scripts/publish-community-seeds.mjs` is a **dry run by default** (validates, prints, no network, no secrets).
Only `--yes` makes it sign in as `gooberr478` (env `GOOBERR478_PASSWORD`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) and call the
normal `publish_custom_game` RPC with `{...doc, published:true, publishedAt}` – exactly what Studio's Publish does. `--only <slug>` limits it.
**Do not run with `--yes` until Colin approves.** Rollback: Studio ▸ Unpublish as gooberr478.
