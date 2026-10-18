# Iceberg (a BlockWorld sandbox prototype)

A Roblox-style block platform that runs in the browser (Three.js + Vite). It has an icy theme, games you can play, a shared avatar with cosmetics, play-money **Birg Bucks (BB)**, and a simple game creator.

## Run it
- **Play offline:** open `dist/index.html` by double-clicking it. The build is a single self-contained file, so it works over `file://`. Chrome or Edge is recommended.
- **Develop:** `npm install`, then `npm run dev` (http://localhost:5173)
- **Build:** `npm run build`. Output is `dist/index.html`, one file that uses relative paths, so it is ready for any static host.
- **Smoke test:** `node scripts/smoke.mjs`, after `npx playwright install chromium`

## What's in it
- **Games menu** (title screen → scrollable game cards). The avatar, Birg Bucks and cosmetics are shared across all games.
- **Frost Fields:** a snowy glacier island with icebergs, ice spires and snowfall. Press **B** to build with snow/ice blocks (click places a block; Shift-click or right-click removes one). Builds are saved. You can collect coins and place uploaded models.
- **BIRG HQ:** a two-story log cabin. It has a flickering fireplace with ember particles, a couch, rug and stairs. Upstairs are a bedroom and a bathroom with a working mirror. It plays its own cozy music.
- **Rainbow Obby:** 25 rainbow stages over glowing lava, checkpoints, skip a stage for 25 BB, +100 BB for finishing.
- **Create a Game (Studio):** a Roblox Studio-style editor with an explorer, properties, move/rotate/scale gizmos, parts, spawn points, checkpoints, kill bricks, coins, gears, uploaded models, plain-words scripts, an animator, undo/redo, test-play, save, publish and export/import. See **Studio** below.
- **Economy:** you start with 0 BB. Coins are +5, building is +1 per block (up to 50 a day), and the daily bonus is +100. The cosmetics shop has 19 items, including winter items (beanie, scarf, ice crown, parka…) and the premium **Ice Rocket** (100,000 BB). You can recolor the rocket in the Locker and hold **F** to fly.
- **Get Birg Bucks** page: $4 per 500 BB packs. Payments are **not** connected: pack buttons are labeled "(demo)" and grant the bucks for free (no money charged).
- **Models:** upload .glb/.gltf/.obj files (stored in IndexedDB). You can place them in the world or wear them on the avatar using size and position sliders.
  - Blender: File → Export → glTF 2.0 → Format "glTF Binary (.glb)".
  - Only self-contained .gltf files work, meaning embedded buffers. Prefer .glb.
- **Music:** original procedural WebAudio music (winter chimes; cozy piano with fire crackle). It starts after your first click, and there is a mute/volume control in the HUD.

## Architecture (src/)
| Folder | Purpose |
|---|---|
| `main.js` | Bootstrap; wires services, engine, UI. `window.iceberg` exposes hooks for tests |
| `backend/LocalBackend.js` | **The only persistence layer** (localStorage + IndexedDB). Swap it for a RemoteBackend to add accounts/server-authoritative wallet |
| `core/` | `economy.js` (wallet, rewards, purchases, equip), `payments.js` (payment stub, see below), `events.js` (event bus), `share.js` (export/import games) |
| `engine/` | `engine.js` (renderer, loop, game loading, pointer routing), `player.js` (controller + camera), `collision.js` (boxes, voxels, circles, convex SAT) |
| `game/` | `avatar.js` (R6-style avatar + cosmetic models), `building.js`, `coins.js`, `models.js` (upload/IndexedDB), `world.js` (icy island) |
| `games/` | Game modules + `registry.js` |
| `audio/music.js` | Procedural music themes |
| `ui/` | HUD, drawers (shop/locker/store/models), menu, creator panel |
| `studio/` | The Studio: `editor.js` (camera, gizmos, selection, undo), `instances.js` (part/model/rig objects, materials, collision hulls), `world.js` (sky/ground, scene sync), `runtime.js` (play mode), `gears.js`, `animation.js` (R6 + imported rigs), `nlscript.js` + `behaviors.js` + `ai.js` (plain-words scripts), `store.js` (drafts/publish), `templates.js`, `studio.css`. The UI is `ui/creator.js`; the game modules are `games/customGame.js` |

### Adding a game
Each game is a module that exports a definition:
```js
export default {
  id: 'my-game', name: 'My Game', tagline: '…', description: '…',
  thumbnail: 'frost',          // key in ui/thumbs.js or a data: URL
  music: 'winter',             // 'winter' | 'cozy' | 'none'
  async create(ctx) {          // ctx: { engine, avatar, economy, models, music, bus, THREE }
    return { scene, collision, spawn, update(dt, t, player) {}, dispose() {} };
  },
};
```
Put it in `src/games/` (a sub-folder is fine). Then import it in `src/games/registry.js` and append it to `BUILTIN_GAMES`, one import and one array entry per game. Optional fields: `occluders`, `maxCamDist`, `supportsBuild`, `onClick`, `onHover`.

### Payments (Stripe later)
`core/payments.js` contains a `DemoProvider` and a commented `StripeProvider` outline. The steps to go live are:
1. Add a server endpoint that creates a Checkout Session from a server-side price table.
2. Credit BB only from the verified `checkout.session.completed` webhook. Do this idempotently, into a server wallet.
3. Have the client refresh its profile from the backend. Clients must never credit themselves.

## Studio
Open it from **Games → Create a Game → ✚ Create**. On a phone or tablet (device mode "mobile") the same button opens the **Mobile Studio** (below).

### Mobile Studio (phones and tablets)
A simple, touch-first studio like the first Iceberg creator (`src/ui/mobileStudio.js`). It edits the same game documents and saves/publishes through the same path as the desktop Studio, so a game made on a phone opens in the full Studio on a computer.
- **Bottom bar:** 🧱 Place, 🎨 Paint, 🗑 Remove and 📍 Spawn tools, ↶ Undo, ▶ Test, 💾 Save and ☰ More (game name, 📱 Mobile-playable, 🚀 Publish, ✕ Exit). A color palette sits above the tools (beside them in landscape). Buttons are at least 40 px. The 3D view is resized to the space above the bar, so the bar never covers it.
- **Building:** tap a surface to place a 2-stud cube in the chosen color, snapped to a grid. Tap a block to paint or remove it. With 📍 Spawn, tap where players should start. The spawn point can be moved but not removed.
- **Camera:** drag one finger to orbit, pinch to zoom, drag two fingers to pan. A mouse wheel also zooms.
- Games made on mobile are mobile-playable by default.

**Layout:** the ribbon is on top (tools, snap, insert, undo/redo, Animator, Test, Save, Publish, Export/Import). The left side has the **Explorer**, **Toolbox** and **📖 Phrases** tabs. The right side has **Properties**.
- **Camera:** hold the right mouse button and drag to look. Use WASD to fly, Q/E to go down/up, and Shift to go faster. **F** focuses on the selection.
- **Tools:** 1 Select, 2 Move, 3 Scale, 4 Rotate. Snapping is optional (move 0/0.5/1/2/4 studs, rotate 0/15/45/90°). There is also a world/local space toggle.
- **Selecting several things:**
  - Shift- or Ctrl-click in the 3D view or the Explorer to add/remove items (Shift-click in the Explorer selects a range).
  - Drag on empty space (or Shift+drag) to box-select. Ctrl+A selects everything, Esc clears.
  - With several items selected, the Move/Rotate/Scale gizmo works around the centre of the selection, and the Properties panel edits the shared properties of all of them at once (blank = values differ).
  - Duplicate, Delete, Copy (Ctrl+C), Cut (Ctrl+X) and Paste (Ctrl+V) work on the whole selection. The clipboard is also kept in localStorage (`iceberg:v1:studioClipboard`), so you can paste into another game.
- **Models (groups):** Ctrl+G groups the selection into a Model; Ctrl+Shift+G ungroups. Models show as a collapsible tree in the Explorer and can be nested. Clicking a part in the 3D view selects its whole Model; pick single parts in the Explorer. Moving, rotating or scaling a Model moves everything inside. Every operation above is one undo step.
- **Parts:** block, sphere, cylinder and wedge, placed freely.
  - Properties: name, position, rotation, size, shape, color, material (plastic, snow, ice, wood, metal, neon, glass, lava), transparency, Anchored, CanCollide and Kill.
  - Unanchored parts fall.
- **Special objects:**
  - SpawnLocation (only one per game) and Checkpoint.
  - Kill brick (lava).
  - Coin (+BB value).
  - Gear giver.
  - Uploaded .glb/.gltf/.obj models.
  - R6 rigs.
- **Gears (Toolbox):**
  - The Toolbox uses the same gear definitions as the Giant Rainbow Obby (`src/games/giantObby/gears.js`), so every gear there can be added to your own game. Studio games only check `canUseGear()` with the gears the creator placed (givers or starter gears), so creator-added gears have no purchase limits.
  - Gears come from givers in the world or as starter gears (Workspace settings). Keys 1–9 equip them.
- **Shortcuts:** Ctrl+Z / Ctrl+Y undo/redo, Ctrl+A select all, Ctrl+C / Ctrl+X / Ctrl+V copy/cut/paste, Ctrl+D duplicate, Ctrl+G group, Ctrl+Shift+G ungroup, Del delete, Esc deselect, Ctrl+S save.
- **Names:** renaming (double-click in the Explorer) and naming new animations use a small in-studio dialog, not the browser's popup.
- **Workspace settings:** click "Workspace" in the Explorer. You can set the name, description, sky, ground (baseplate/island/void), music, snow, the **mobile-playable** toggle (shows the joystick and jump button on touch devices) and starter gears.
- **Save vs Publish:**
  - Save keeps a draft (localStorage `iceberg:v1:studioDrafts`).
  - Publish puts the game in "Your Games" on the Games menu.
  - Export/Import uses a `.iceberg.json` file, which includes the uploaded models.
- **Test:** plays the game with your classic R6 avatar. "Back to editor" returns to the Studio.

### Plain-words scripts
Select a part, then go to **Properties → + Add script** and type normal sentences. The **📖 Phrases** tab lists everything it understands; click a phrase to add it to the selected part. Examples:
- Events: "when touched…", "when clicked…", "when the button is pressed…", "when a player enters/leaves this area…", "when the game starts…", "every 3 seconds…", "when the countdown ends…", "when the score reaches 50…", "when a player dies…".
- Conditions and variables: "if the player has 10 points … otherwise …", "add 1 to the counter", "set the timer to 0", "show the leaderboard", "start a 60 second countdown", "start a timer".
- Other parts by name: "open the door called Gate for 5 seconds", "teleport them to the part called Finish", "move to the part called Goal and back every 3 seconds".
- Motion: "spin 2 times a second", "move up and down 5 studs every 2 seconds", "move between 0, 5, 0 and 20, 5, 0 every 4 seconds", "act as an elevator going up 20 studs", "when touched, wait 1 second then fall and come back after 3 seconds". Players ride moving and spinning parts.
- Players: kill, take 25 damage, heal, bounce, 2 times faster / jump higher / low gravity for N seconds, save progress (checkpoint), win.
- Looks and effects: colours, "fade to purple over 3 seconds", transparency, glow, lights on/off, sparkles/fire/smoke/confetti particles, sounds, messages.
- Spawners and chance: "every 3 seconds drop a red ball", "spawn a copy of the part called Crate", "turn red or blue at random".

It understands synonyms, flexible word order, numbers written as words ("three"), units (studs, seconds, minutes) and several clauses joined with "and" / "then". The panel shows a plain-English preview of what it understood. If something isn't understood, it shows clickable suggestions of the closest phrases it does know. **Show code** reveals the generated behavior JSON.

How it works:
- `nlscript.js` is an offline rule/regex parser (`translate(text, {names})` → `{program, preview, unknown, suggestions}`).
- `behaviors.js` + `runtime.js` run the result as data. There is no `eval`, and `validateProgram` whitelists every trigger and action.
- The translator sits behind an **AI provider interface** in `src/studio/ai.js`: `getScriptTranslator()` / `setScriptTranslator({name, translate(text, context) → Promise<{program, preview, unknown}>})`. A commented `RemoteModelTranslator` skeleton shows how to plug in a model later. Always pass its output through `validateProgram`. No API keys are used or shipped.

### Animator
1. Click **Animator**.
2. Pick a rig: an R6 Rig from the Toolbox, or an uploaded **rigged Blender .glb** (its bones are detected automatically).
3. Create an animation, choose a bone, then rotate it with the gizmo or the X/Y/Z fields. This sets a keyframe at the current time.
4. Set the length and looping.

Embedded .glb animations play with the ▶ clip buttons. In a part's properties, **Autoplay** picks the animation that plays during the game.
Blender export: File → Export → glTF 2.0 (.glb) with "Animation" and "Skinning" enabled.

### Tests
- `node scripts/nlscript-tests.mjs`: 150+ phrase tests for the plain-words translator (no browser needed).
- `node scripts/collision-tests.mjs`: exact collision for rotated/stretched spheres and cylinders (GJK), including a random fuzz test.
- Build first with `npx vite build`, then run `node scripts/studio-e2e.mjs`. This headless test runs 73 checks: every part type, multi-select, box select, groups, copy/paste, the phrase panel, scripts, gears, models and an animation; then it saves, publishes and plays the game (clicks, doors, riding moving/spinning platforms, curved collision).
- `node scripts/make-fixtures.mjs` regenerates the test .glb files.

**Collision:** boxes and wedges use exact box/convex tests; spheres and cylinders (including rotated and stretched ones) use an exact GJK support-shape test in `src/engine/collision.js`.

## Roadmap
- Multi-page portal (index / play.html?game= / studio.html in new tabs). The current build is a single page with a menu.
- Studio: a real AI model behind the plain-words translator; physics for unanchored parts beyond simple falling.
- Accounts and a server-authoritative wallet.
- Multiplayer server (WebSocket rooms).
- Real-money BB via Stripe.
- Moderation (chat filter, model/game review, reports).
- Creator tools (publishing, sharing, sandboxed scripts).
