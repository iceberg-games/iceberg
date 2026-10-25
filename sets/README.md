# Iceberg filming sets

These are 3D sets used to film trailers and videos. They are **not games**:
- They are not in `src/games/registry.js`, so players never see them in the game list.
- They are not built by `scripts/build-site.mjs`, so they are never deployed. Only pushes to `main` deploy, through `.github/workflows/deploy.yml`.
- They have no HUD, scores, pickups or timers. A set is only mood, place and camera.

## Open a set
| How | Command | URL / file |
|---|---|---|
| Dev server (live reload) | `npm run dev:sets` (or `npx vite`) | http://localhost:5173/sets/?set=winterhaven |
| Static single file (no server) | `npm run build:sets` | `dist-sets/sets/index.html?set=winterhaven` (file:// works) |
| Simple local server | `npm run build:sets && npx vite preview -c vite.sets.config.js --port 4174` | http://localhost:4174/sets/?set=winterhaven |

When you record, use a real GPU browser (Chrome/Edge). Headless software rendering works for stills, but at about 20 s per frame it is far too slow for real time.

## Keys
| Key | What it does |
|---|---|
| `1`–`5` | Play shot preset N from the start |
| `0` | Play all shots back to back (reel) |
| `Enter` | Replay the current shot |
| `L` | Loop the current shot |
| `P` | Pause/resume world time (snow, twinkle, smoke) |
| `F` | Free cam on/off. It starts from the current frame |
| Free cam: `W A S D` | Move |
| Free cam: `Q` / `E` (or `Ctrl` / `Space`) | Down / up |
| Free cam: mouse drag | Look (smoothed) |
| Free cam: mouse wheel | Speed (shown in a toast) |
| Free cam: `Shift` / `Alt` | 4× faster / 4× slower |
| `[` / `]` | Field of view −5 / +5 |
| `G` | Walk the avatar (WASD, `Space` jump, drag to orbit, wheel to zoom). `G` again goes back to free cam |
| `C` | Copy the camera pose `{pos, look, fov}` to the clipboard and the console. Paste it into `shots.js` to make a new shot |
| `B` | Snow level: off → light → medium → heavy → blizzard |
| `Shift+B` | Blizzard ramp: builds from light snow to a full whiteout over `ramp` seconds (default 12) |
| `N` | Day/night, with a smooth 4 s transition |
| `K` | 2.39:1 letterbox bars |
| `H` | Clean mode: hides all UI and the cursor |

## URL parameters
| Param | Meaning |
|---|---|
| `set=winterhaven` | Which set to load |
| `shot=N` | Start playing shot N (1-based) |
| `t=secs` | Hold shot N at this time instead of playing it |
| `clean=1` | Start with no UI (best for recording) |
| `snow=0..4` | off / light / medium (default) / heavy / blizzard |
| `blizzard=1` | Start the blizzard ramp on load |
| `ramp=secs` | Length of the blizzard ramp |
| `night=0..1` | 1 = night (default), 0 = day. Values in between give a dusk mix |
| `loop=1` | Loop the shot |
| `reel=1` | Play all shots in sequence and loop the reel |
| `free=1` | Start in free cam |
| `w=1920&h=1080` | Fixed render resolution, scaled to fit the window. Use this for exact 1080p frames |
| `bars=2.39` | Letterbox |
| `fixed=1` | Don't advance on its own. Drive frames from script (below) |

Example of a clean recording take: `…/sets/?set=winterhaven&shot=5&clean=1&w=1920&h=1080`

## Script API (DevTools / Playwright), `window.sets`
```js
sets.play(3)                        // play shot 3
sets.seek(5, 12.5, 1/30)            // pose shot 5 at 12.5 s, advance the world 1/30 s, render
sets.step(1/30)                     // advance + render one frame (with ?fixed=1 this is frame-exact capture)
sets.pose([x,y,z], [lx,ly,lz], fov) // hold any camera pose
sets.night(0|1); sets.snow(0..4); sets.weather(0..1); sets.blizzard(12)
sets.clean(true); sets.freecam(); sets.walk()
```
To capture frame by frame (deterministic, at any fps), open `?fixed=1&clean=1&w=1920&h=1080`. Then, for each frame, call `sets.seek(n, i/30, 1/30)` and grab `sets.renderer.domElement.toDataURL()`.
Stills of every preset: `npm run build:sets && node scripts/sets-shots.mjs [--at 0.1,0.5,1] [--only 2,5] [--extra]`. The stills are written to `sets/<id>/shots/`.

## Add a set
1. Create `sets/<id>/index.js` that exports `default { id, name, async create({ THREE, renderer, camera }) }`. `create` returns:
   ```js
   { scene, shots: [/* see lib/camera.js Shot */], setNight(v), setWeather(v), update(dt, t, camera),
     spawn: { pos, facing }, walkBounds, addColliders(collision),   // optional: walk mode
     wind(w), bloom(night, w) }                                       // optional: look tuning
   ```
2. Add one line to `sets/registry.js`.
3. Shared helpers live in `sets/lib/`:
   - `blocks.js`: instanced `Batch`, HDR `glowMaterial`, world-space `worldPattern` (logs, bricks, cobbles)
   - `sky.js`: night/day sky with stars, aurora and moon
   - `snow.js`: GPU snowfall
   - `camera.js`: `Shot` splines with easing, and `FreeCam`
4. The runtime (`sets/main.js`) owns the renderer and post-processing (Unreal bloom → vignette/grain grade → ACES output), the snow, cameras, keys and UI.

## Rules
- Use only Iceberg-original or CC0 assets, and credit CC0 assets in `sets/<id>/CREDITS.md`. Never use Roblox assets or logos.
- Never commit sets to `main`. Work on the `sets` branch (worktree `/workspace/blockworld-sets`).

## Winterhaven (the winter event set and future lobby)
`sets/winterhaven/`:
- `layout.js`: the data and math. It has no THREE or DOM imports.
- `index.js`: builds the scene.
- `shots.js`: the 5 trailer shots.

Night is the default and the snow starts at medium. The avatar uses an Iceberg palette.

**Future lobby / quest hub.** `layout.js` is meant for Game Maker to reuse:
- `AREAS`: named areas with shape bounds. `areaAt(x, z)` tells you which area a point is in.
- `TRAILS`: walkable paths that link every area.
- `ANCHORS`: `spawn`, `merchant`, `market`, `portal` (the minigame entrance), `castleGate`, `lakeShore`, `bridge`, `cave`, `passTop`, `forestClearing`.
- `groundHeight(x, z)`: the walkable height. It covers terrain, lake ice and creek ice.
- `cabins()`, `LAKE`, `CASTLE`, `CREEK`, `BRIDGES`, `PORTAL`, `CAVE`, `MARKET`.

Everything is scenery only, with no NPCs or mechanics. Walk mode (`G`) already walks the whole map over the terrain, and castle walls, cabins, stalls and the arch are solid.

| Area | Where | What's there |
|---|---|---|
| Town Square | origin, r 26 | Giant tree, presents, cobbles, lanterns. Spawn is just south of it on Lantern Lane |
| Winter Market | north side of the square | Merchant stall (red canopy, blank sign) at (-17,-17) and a second stall (blue) at (17,-17) |
| Lantern Lane | x ±22, z 18→122 | Main street: 12 cabins, string lights, lanterns |
| Mirrorfrost Lake | east, centre (86,14) | Reflective frozen lake, skate trails, benches. Lakeside Walk links it to the square |
| Ice Bridge Creek | z ≈ -60 | Frozen creek, two glowing ice bridges |
| Frostspire Hill | north, (0,-160), top y 28 | Ice castle with an open gate. The castle path climbs from the square |
| Whispering Pines | west, x -150→-40 | Dense forest with a trail loop |
| Frostgate Plaza | (-84,18), r 13 | Empty paved clearing with an ice archway. This is the minigame entrance spot (no effect yet) |
| Frostbite Pass | south, z 122→260 | Trail up between the ridges. The flyover comes in here |
| Glimmer Cave | (-40,205) | Rock cave mouth with glowing crystals, on a spur off the pass |
| Snowdrift Outskirts | east/south edge | Scattered cabins |

**NPCs** (`sets/winterhaven/npcs.js`, re-exported from `layout.js` as `NPCS`; pure data with x/z/facing/note; placement only, not rendered yet):

| id | name | area | role |
|---|---|---|---|
| frosty-merchant | Frosty Quill | market | Shop merchant / main quest hub |
| maple-stall | Maple Bramble | market | Second vendor (blue stall) |
| oven-mira | Oven Mira | market | Baker |
| wrap-wren | Wrap Wren | square | Gift wrapper |
| crier-bole | Crier Bole | square | Town crier |
| owl-hoot | Hoot | square | Owl companion |
| inn-hearth | Inn Hearth | lane | Innkeeper |
| tinker-cog | Tinker Cog | lane | Blacksmith / tinker |
| kids-pip | Pip | lane | Village kid |
| lamp-lumen | Lamp Lumen | lane | Lamp lighter (wh_quest_lantern) |
| courier-swift | Courier Swift | lane | Parcel courier |
| skate-sela | Skate Sela | lake | Skate coach (wh_quest_skate) |
| cocoa-kip | Cocoa Kip | lake | Hot-cocoa seller |
| ice-fisher | Glint Hook | lake | Ice fisher |
| bridge-bryn | Bridge Bryn | creek | Bridge keeper (wh_quest_bridge) |
| castle-steward | Steward Vale | castle | Castle steward (wh_quest_castle) |
| ice-architect | Prism Architect | castle | Ice mage / architect |
| guard-rim | Guard Rim | castle | Castle guard |
| guard-holt | Guard Holt | castle | Castle guard |
| pine-ranger | Ranger Ash | forest | Forest ranger (wh_quest_pine) |
| wood-cleave | Cleave | forest | Woodcutter |
| lost-lark | Lark | forest | Lost traveler |
| pine-wisp | Wisp | forest | Friendly forest spirit |
| portal-keeper | Gate Mira | portal | Minigame greeter (wh_quest_frostgate) |
| pass-guide | Guide Tor | pass | Mountain guide (wh_quest_pass) |
| crystal-miner | Shard | cave | Crystal miner (wh_quest_cave) |
| cave-hermit | Hermit Opal | cave | Cave hermit |
| outskirt-fern | Fern | outskirts | Farmer |
| pup-nimbus | Nimbus | outskirts | Wolf-pup companion |
| sled-rio | Rio | outskirts | Sledder |
| snow-builder | Puff | outskirts | Snowman builder (wh_quest_snowman) |
| kids-noll | Noll | outskirts | Village kid / snowball (wh_quest_outskirts) |
