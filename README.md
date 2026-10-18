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
Open it from **Games → Create a Game → ✚ Create**. On a phone or tablet (device mode "mobile") the Studio is hidden.

**Layout:** the ribbon is on top (tools, snap, insert, undo/redo, Animator, Test, Save, Publish, Export/Import). The left side has the **Explorer** and **Toolbox** tabs. The right side has **Properties**.
- **Camera:** hold the right mouse button and drag to look. Use WASD to fly, Q/E to go down/up, and Shift to go faster. **F** focuses on the selection.
- **Tools:** 1 Select, 2 Move, 3 Scale, 4 Rotate. Snapping is optional (move 0/0.5/1/2/4 studs, rotate 0/15/45/90°). There is also a world/local space toggle.
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
  - Speed Coil, Gravity Coil and Magic Carpet (Space goes up, Q/C goes down).
  - Gears come from givers in the world or as starter gears (Workspace settings). Keys 1–9 equip them.
- **Shortcuts:** Ctrl+Z / Ctrl+Y undo/redo, Ctrl+D duplicate, Del delete, Ctrl+S save.
- **Workspace settings:** click "Workspace" in the Explorer. You can set the name, description, sky, ground (baseplate/island/void), music, snow, the **mobile-playable** toggle (shows the joystick and jump button on touch devices) and starter gears.
- **Save vs Publish:**
  - Save keeps a draft (localStorage `iceberg:v1:studioDrafts`).
  - Publish puts the game in "Your Games" on the Games menu.
  - Export/Import uses a `.iceberg.json` file, which includes the uploaded models.
- **Test:** plays the game with your classic R6 avatar. "Back to editor" returns to the Studio.

### Plain-words scripts
Select a part, then go to **Properties → + Add script** and type normal sentences. For example:
- "spin slowly"
- "move up and down 4 studs every 3 seconds"
- "when touched kill the player"
- "when touched give 10 points and say \"Nice!\""
- "every 2 seconds disappear for 1 second"
- "when touched teleport to 0, 10, 0"
- "when touched open like a door"
- "bounce players high"
- "change color to red when touched"
- "play a sound"

The panel shows a plain-English preview of what it understood. If it doesn't understand something, it says so and shows examples. **Show code** reveals the generated behavior JSON.

How it works:
- `nlscript.js` is an offline rule/regex parser.
- `behaviors.js` runs the result as data. There is no `eval`, and `validateProgram` whitelists every action.
- The translator sits behind an **AI provider interface** in `src/studio/ai.js`: `getScriptTranslator()` / `setScriptTranslator({name, translate(text) → Promise<{program, preview, unknown}>})`. A commented `RemoteModelTranslator` skeleton shows how to plug in a model later. Always pass its output through `validateProgram`. No API keys are used or shipped.

### Animator
1. Click **Animator**.
2. Pick a rig: an R6 Rig from the Toolbox, or an uploaded **rigged Blender .glb** (its bones are detected automatically).
3. Create an animation, choose a bone, then rotate it with the gizmo or the X/Y/Z fields. This sets a keyframe at the current time.
4. Set the length and looping.

Embedded .glb animations play with the ▶ clip buttons. In a part's properties, **Autoplay** picks the animation that plays during the game.
Blender export: File → Export → glTF 2.0 (.glb) with "Animation" and "Skinning" enabled.

### Tests
Build first with `npx vite build`, then run `node scripts/studio-e2e.mjs`. This headless test runs 42 checks: it builds a game with every part type, scripts, gears, models and an animation, then saves, publishes and plays it. `node scripts/make-fixtures.mjs` regenerates the test .glb files.

## Roadmap
- Multi-page portal (index / play.html?game= / studio.html in new tabs). The current build is a single page with a menu.
- Studio: multi-select, a real AI model behind the plain-words translator, exact collision for rotated spheres/cylinders.
- Accounts and a server-authoritative wallet.
- Multiplayer server (WebSocket rooms).
- Real-money BB via Stripe.
- Moderation (chat filter, model/game review, reports).
- Creator tools (publishing, sharing, sandboxed scripts).
