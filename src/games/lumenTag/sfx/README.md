# Lumen Tag SFX drop folder
Sound Designer 2: drop `<cue>.ogg` files here (names below) and optional `cues.json` `{ "<cue>": { "gain": 0.8, "loop": false } }`.
Any missing cue falls back to procedural Web Audio in `../audio.js`.

| cue | trigger |
|---|---|
| beam_fire | you/bot fire a lumen (rate ±) |
| beam_fire_prism | fire while Prism power is active (3 beams) |
| beam_hit | your beam tags someone |
| beam_block | beam strikes a crystal pillar |
| tag_out | you get tagged |
| respawn | you respawn (shimmer in) |
| power_spawn | a power crystal appears |
| power_prism / power_surge / power_shield | pickup of each power |
| shield_block | shield absorbs a hit |
| lead_take | you take 1st place |
| combo_tag | 2+ tags within 3s |
| countdown_tick / round_start | 3-2-1 / GO |
| final_seconds | last 10s tick |
| win_fanfare / defeat | end of round |
| ui_click | rematch / buttons |
| amb_crystal_cavern (loop) | cavern bed: low hum, drips, crystal chimes |
