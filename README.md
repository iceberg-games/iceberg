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
- **Create a Game:** start from a blank baseplate or an island template. You can place blocks and uploaded models, set the spawn point, drop coins, and pick the sky, ground, music and snowfall. "Save & Publish" adds it to the Games menu ("Your Games"); test, and export/import as a `.iceberg.json` file. Saved games show up under "Your Games".
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
| `wip/` (outside src) | **Unfinished, not built:** an advanced Studio (parts with move/rotate/scale gizmos, scripts, gears, R6/imported-rig animator). It is a starting point for later |

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

## Roadmap
- Multi-page portal (index / play.html?game= / studio.html in new tabs). The current build is a single page with a menu.
- Finish the advanced Studio in `wip/`.
- Accounts and a server-authoritative wallet.
- Multiplayer server (WebSocket rooms).
- Real-money BB via Stripe.
- Moderation (chat filter, model/game review, reports).
- Creator tools (publishing, sharing, sandboxed scripts).
