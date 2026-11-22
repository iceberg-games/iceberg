# Iceberg Studio — Editor AI chat + GUI builder progress

## Goal
A basic, **free**, offline corner chat in PC Studio, plus a first-drop GUI
builder. No paid AI APIs, no sign-ups, no Grok usage, no publish.

The chat is built on the existing plain-words translator
(`src/studio/nlscript.js` + `LocalRuleTranslator` in `ai.js`). A later paid
provider can plug in behind the same `{ name, reply(text, context) }`
interface. Players would pay in Birg Bucks then.

TODO: Later, players will pay for a paid AI provider with Birg Bucks (not
real money). Do not enable a paid API or sign up for anything here.

## Branch / worktree
- Worktree: `/workspace/iceberg-game-maker/wt-editor-ai-chat`
- Branch: `feature/editor-ai-chat` (local only; do not publish or push to main)
- Base: `c01dd29` (live main tip with AI scripting folded in)

Core work stays in `src/studio/`. Small hooks: `src/ui/creator.js` (mount the
chat / GUI toggle / first-person setting) and `src/engine/player.js`
(first-person camera).

## Done

### Corner chat (steps 1–3)
- Toggleable, text-only chat in the Studio corner (`#studio-ai-chat`).
  Open/close button, message bubbles, short replies, no voice.
- **Script:** "make the red part kill players" / "when touched, kill them"
  is translated and applied to the selected or named/colored part.
- **Build:** offline templates, one undoable `insertMany()` action:
  - `build a small house` (floor, walls with a door gap, roof)
  - `make a tower 10 high` (height, color, and small/large scale parsed)
  - `add 5 coins in a line` (also word numbers: "five coins")
  - `make a bridge` (deck + rails; length parsed)
  - `add a checkpoint` (also wall, platform, stairs)
- **Help:** "my door doesn't work" / "something's wrong" runs
  `scriptCheck` on the selection and replies with its suggestions.
- When it can't understand, it says so and suggests 2–3 example phrasings.
  It does not pretend (script intent requires a real script cue).

### GUI builder + first-person (step 4)
- Players can place buttons, text labels, images/frames, and bars
  (health, coins, points, timer) on a 2D overlay.
- Elements drag and resize, and anchor to corners or the center.
- HUD stays CSS-anchored (static on screen) in play via `mountPlayGui`.
- Button actions use the same translator, e.g. "when clicked, give 10
  coins", "teleport to spawn", "toggle first person". A shop button can
  open a hidden panel.
- Chat phrases: "add a coin counter top right", "make a shop button that
  opens a panel", "add a health bar", "toggle first person".
- First-person is a game setting (`#first-person-toggle`) and a script
  action (`firstPerson`). The player camera supports it.
- Elements save on `doc.gui` (included in undo snapshots) and render in
  play mode.

### Polish (same branch, items 1–5)
- **Placement:** new builds go in front of the camera (`lookPoint`) or
  beside the selection, then at the next free spot so they do not overlap.
- **Broader builder:** house now has a door and windows; also a multi-floor
  building, shop/stand, fence (optionally around a selection), ladder,
  tree, lamp post, simple car, N-jump obby, maze, and arena/walls.
  Sizes, colors, and materials are parsed. Follow-ups on the last build:
  `make it bigger`, `make it blue`, `undo that`.
- **Test-play click-through:** HUD stays fixed when the camera orbits; a
  Get coins button awards 10 coins; first-person toggle hides the avatar
  and can be toggled back. Button actions run on the click itself (not
  the next animation frame). The play HUD sits above the site dock.
- **GUI image picker:** choose from the game thumbnail, remembered
  textures, existing GUI images, or other saved-game thumbnails, or paste
  an http(s)/data image URL. Unsafe sources (`javascript:`, etc.) are
  rejected.
- **Ribbon:** `renderRibbon` no longer passes `null` to `Element.append`,
  so the Tools group is not followed by a literal "null" label.

## Tests (after polish)
- `node scripts/studio-chat-tests.mjs` — 56/56
- `node scripts/nlscript-tests.mjs` — 219/219
- `node scripts/script-check-tests.mjs` — 10/10
- `node scripts/studio-chat-smoke.mjs` (after `npm run build`) — 19/19
  at 1440×900, including the ribbon "null" check.
- `node scripts/studio-play-hud-smoke.mjs` — 16/16 (fixed HUD, coins
  button, first-person on and off).
- Screenshots:
  - `designs/editor-ai-chat/studio-chat-open.png`
  - `designs/editor-ai-chat/studio-gui-editor.png`
  - `designs/editor-ai-chat/studio-play-hud.png`

## Phrases that work
- build a small house / build a large red house / build a wooden house
- make a 3 story building
- make a 10 jump obby
- make a maze / make an arena
- add a tree / add a lamp post / add a ladder / add a fence
- make a simple car / make a shop
- make a tower 10 high
- add 5 coins in a line / add five coins in a line
- make a bridge / make a bridge 30 long
- add a checkpoint / add a wall / add a platform / add stairs
- make it bigger / make it blue / undo that
- make the red part kill players
- when touched, kill them (and other existing translator phrases)
- my door doesn't work / something's wrong
- add a coin counter top right
- add a health bar / add a timer
- make a shop button that opens a panel
- toggle first person
- Button actions: when clicked, give 10 coins; teleport to spawn;
  toggle first person

## Known gaps
- The helper is still rule-based. It will not invent buildings or GUI
  beyond the templates and translator it already knows.
- Phone Studio is unchanged (this drop is PC).
- A paid Birg Bucks provider is only a TODO behind the same interface.
- UGC accessories and custom-model visibility were not part of this drop.

Do not publish. Do not push to main. Do not sign up for or call a paid API.

## fix/ai-chat-live (hotfix off main 23212fb)
Colin reported the live chat "can't make anything" ("make me a town", "make me a house").
Reproduced with a production build (`vite build` + `vite preview`, and `build:site` + `/play/`):
- **town / city / village / "i want a house" were not understood** — no town template and no
  forgiving parser (cause of the "didn't understand" replies).
- **"make me a house" did build** in the prod build, but on non-blank templates (e.g. Glacier island)
  it was placed at the next free spot **out of view**, and on the blank baseplate the camera sat
  almost on top of it — so it looked like nothing happened. Fixed by framing the camera on every build.
- Not the cause: `me` in the phrase, prod-only bundling, wiring (chat mounts in the live PC Studio), or builder
  exceptions (none; no page errors). Phone "Mobile Studio" still has no chat (PC only, unchanged).
Fixes: TOWN template (main road + 2 cross roads, shop, 4 houses — or taller buildings for a city —
trees, lamp posts, fountain, no overlap); `fountain` template; `polish()` strips me/please/can you/
i want/a little/some; noun-only phrases ("a house"); any build request with no template falls back to the
closest one with a friendly note (never "can't"); every build now focuses the camera on the new group.
Tests: `studio-chat-tests.mjs` 71/71, `studio-chat-live-smoke.mjs` 22/22 (prod build, preview and site build).
