# Frostlings — sound cue list (for Iceberg Sound Designer 2)

Game: **Frostlings** (`frostlings`, branch `game/frostlings`). Cozy creature-taming adventure: explore
Snowdrift Village + 4 areas, walk into wild Frostlings, turn-based battles, throw snares to tame them,
raise/evolve them, beat area tamers. Tone: cute, cozy, sparkly-icy (not grim). Think pocket-monster
charm with Iceberg's glassy bell palette.

Delivery: `ogg/<cue>.ogg` (+ optional `cues.json` `{ "<cue>": { "gain": 0.0-1.0, "loop": bool } }`)
at `/workspace/iceberg-audio/frostlings/ogg/`. Game loads `src/games/frostlings/sfx/<cue>.ogg`
automatically; every cue has a procedural synth fallback until the pack lands. Loops must be seamless.

## Music + ambience (loops)
| cue | len | description |
|---|---|---|
| `bgm_village` | 45–90 s loop | Snowdrift Village hub: warm, cozy, mid-tempo (~96 bpm) music-box/glock + soft pizz bass, homey "hot cocoa" feel. Plays in the village. |
| `bgm_battle_wild` | 30–60 s loop | Wild battle: upbeat, bouncy, light tension (~140 bpm), plucky lead, snappy percussion. Cute not scary. |
| `bgm_battle_tamer` | 30–60 s loop | Tamer/boss battle (Ranger Holly, Miner Quartz, Captain Brine, Sage Borealis) + Battle Ring duels: bigger, heroic, driving (~150 bpm), brass-ish synth stabs. |
| `amb_meadow` | 20–40 s loop | Pinefrost Meadow: gentle wind through pines, distant chirps, soft snow hiss. Day-friendly. |
| `amb_caverns` | 20–40 s loop | Crystal Caverns: hollow cave room tone, water drips, faint crystal hums/chimes resonating. |
| `amb_coast` | 20–40 s loop | Tidepool Coast: icy waves lapping, foam fizz, occasional far gull-ish call, cold breeze. |
| `amb_peak` | 20–40 s loop | Aurora Peak: thin high-altitude wind + shimmering aurora pad (slow evolving glassy drone). |

## Moves (one per type; pitch-jittered in game)
| cue | len | description |
|---|---|---|
| `sfx_move_snow` | 0.5–0.9 s | Snow move (Snowpuff, Frost Breath, Blizzard Burst): breathy whoosh + crystalline sparkle tail. |
| `sfx_move_crystal` | 0.5–0.9 s | Crystal move (Shard Toss, Prism Beam): bright glassy "ting" cluster, prism zing. |
| `sfx_move_tide` | 0.5–0.9 s | Tide move (Bubble, Wave Splash): bubbly blorp + splash wash. |
| `sfx_move_ember` | 0.5–0.9 s | Ember move (Spark, Flame Pounce, Inferno): cozy crackle-whoomp (campfire, not explosion). |
| `sfx_move_gale` | 0.5–0.9 s | Gale move (Gust, Cyclone): swirling wind swoosh, quick pan. |
| `sfx_move_aurora` | 0.7–1.2 s | Aurora move (Glimmer, Starfall): ethereal shimmering chord swell + twinkles. |
| `sfx_move_plain` | 0.3 s | Plain move (Bonk, Snuggle Slam): cartoon bonk/boing tackle. |

## Battle
| cue | len | description |
|---|---|---|
| `sfx_hit` | 0.25 s | Normal damage taken: soft snowy thump. |
| `sfx_hit_super` | 0.4 s | "It's super effective!": heavier thump + rising sparkle sting. |
| `sfx_faint` | 0.8 s | A Frostling faints: descending cute "wooo" + soft poof. |
| `sfx_status_chill` | 0.6 s | Chilled status applied: icy crackle freeze. |
| `sfx_status_sleep` | 0.8 s | Sleep applied: dreamy descending lullaby notes ("zzz"). |
| `sfx_status_burn` | 0.6 s | Burn applied / ticks: small sizzle. |
| `sfx_heal` | 0.7 s | Potion / heal move / Rest at the Care Den: warm rising chime sparkle. |
| `sfx_encounter` | 1.0 s | Wild Frostling appears (battle start swoosh + "!" sting). |
| `sfx_tamer_intro` | 1.5–2.5 s | Tamer/boss challenge card: dramatic drum hit + heroic stab. |
| `sfx_victory` | 2–3 s | Battle won jingle (bright fanfare). |
| `sfx_defeat` | 1.5–2 s | Party wiped / lost: gentle sad descending motif (not harsh). |

## Taming
| cue | len | description |
|---|---|---|
| `sfx_snare_throw` | 0.5 s | Snare (glowing ice ring) thrown: whoosh + soft spin hum. |
| `sfx_snare_shake` | 0.3 s | One wobble of the snare (plays up to 3×): wooden/ice "tok-wobble". |
| `sfx_catch_success` | 1.5 s | Tamed! click-lock + happy sparkle burst. |
| `sfx_catch_fail` | 0.6 s | Broke free: pop + ice shards scatter. |
| `sfx_care` | 0.6 s | Feeding a berry / petting in the Care Den: munch + happy chirp. |

## Progression
| cue | len | description |
|---|---|---|
| `sfx_level_up` | 1.2 s | Level up: quick rising arpeggio + shimmer. |
| `sfx_evolve` | 3–4 s | Evolution: building shimmering riser → bright burst/chord at the end (cinematic). |
| `sfx_frostdex_new` | 1.0 s | New Frostdex entry registered: page flip + discovery chime. |
| `sfx_quest_complete` | 1.5 s | Quest complete / rank up: bell fanfare. |

## UI
| cue | len | description |
|---|---|---|
| `ui_click` | 0.15 s | Button press (battle moves, panels, shop buy): tiny glass tink. |

Total: 35 cues.
