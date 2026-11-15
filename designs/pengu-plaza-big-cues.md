# Pengu Plaza BIG — new audio cues (GM2, branch `game/pengu-plaza-big`)

Drop files as `src/games/pengu-plaza/sfx/<cue>.ogg` (mono ok, -16 LUFS-ish, short tails).
Every cue below has a procedural WebAudio fallback in `audio.js`, so the game works before files land.
Existing Sound 2 cues (bgm_pengu-plaza, sfx_emote_*, sfx_sit, sfx_skate_*, sfx_cocoa, sfx_penguin_honk,
sfx_camera_shutter, sfx_foot_crunch, sfx_bell_chime) are reused as-is.

## Area ambience loops (seamless, 20–40 s, crossfaded by area, gain ~0.35)
| cue | area | feel |
|---|---|---|
| `amb_harbor` | Frozen Harbor | soft lapping water, distant gulls, creaky rope/wood |
| `amb_grotto` | Ice Cave Grotto | slow drips, low glassy hum, faint crystal chimes |
| `amb_woods` | Snowy Pine Woods | hushed wind in pines, occasional small bird chirps |
| `amb_ridge` | Aurora Ridge | high airy wind, shimmering pad (night-friendly) |
| `amb_village` | Igloo Village | fire crackle, muffled cheerful chatter, wind chimes |

## One-shots
| cue | when | feel / length |
|---|---|---|
| `sfx_photo_rare` | rare photo captured | sparkly 3-note sting, 1.0 s |
| `sfx_photo_legendary` | legendary photo captured | bigger magical sting + shimmer, 2.0 s |
| `sfx_photo_new` | first photo of any entry (common/uncommon) | light "ding", 0.5 s |
| `sfx_album_open` | album opened/closed | book thump + paper, 0.4 s |
| `sfx_page_flip` | album page turn | paper flip, 0.3 s |
| `sfx_reward` | area complete / milestone reward | short cozy fanfare, 1.5 s |
| `sfx_zoom` | camera zoom step | tiny lens tick, 0.08 s |
| `sfx_camera_mode` | enter/exit camera mode | lens click + whirr, 0.3 s |
| `sfx_area_discover` | first time entering an area | warm chime swell, 1.2 s |
| `sfx_whale_breach` | whale breach (harbor timer) | big splash + whale call, 2.5 s |
| `sfx_shooting_star` | shooting star event | rising shimmer/whoosh, 1.5 s |
| `sfx_sled_lift` | riding the sled lift | cable rattle + bell, 3–4 s |
| `sfx_seal_bark` | seal subject nearby | cute bark, 0.5 s |
| `sfx_puffin` | puffin subject | chirpy squawk, 0.4 s |
| `sfx_fox_yip` | arctic fox subject | tiny yip, 0.3 s |
| `sfx_owl_hoot` | snowy owl subject | soft hoot, 0.8 s |
| `sfx_crystal_chime` | touching / snapping grotto crystals | glassy chime, 1.0 s |
