# Iceberg FEEL pack: juicy, tactile, icy one-shots

This pack makes moving, landing and collecting feel good. Every cue is a soft **body** (a low thump or puff) plus **sparkle** (glass partials or snow grains) with a short tail. The tonal cues are in **E major**, the same palette as the `ui/` set, so everything sounds related. **Original synthesis only** (numpy/scipy). `./build.sh` rebuilds everything identically.

**These are juicier replacements for the starter kit.** When you wire them in, use them instead of the matching names in `../ogg/` (`jump`, `land_snow`, `footstep_snow_1..4`, `coin_collect`, `checkpoint`→`milestone_ding`). The old files are left untouched.

Every sound is mono, as `.ogg` (primary) and `.mp3` (fallback), with 48 kHz / 24-bit masters in `wav/`.

| Name | Length | Peak (dBTP) | ogg / mp3 | Sound |
|---|---|---|---|---|
| `jump_1` | 450 ms | -4.0 | 7.4 / 5.9 KB | Springy icy whoosh + soft push-off thump + top sparkle |
| `jump_2` | 450 ms | -4.0 | 7.3 / 5.9 KB | Same, +2 semitones (alternate) |
| `land_snow_1` | 340 ms | -4.5 | 6.3 / 4.8 KB | Soft crunch + powder puff + low thud (medium) |
| `land_snow_2` | 300 ms | -4.5 | 6.1 / 4.3 KB | Lighter landing |
| `land_snow_3` | 360 ms | -4.5 | 6.5 / 4.8 KB | Heavier landing |
| `footstep_snow_1` | 180 ms | -6.0 | 5.4 / 2.9 KB | Textured crunch / squeak |
| `footstep_snow_2` | 200 ms | -6.0 | 5.4 / 3.1 KB | Textured crunch / squeak |
| `footstep_snow_3` | 170 ms | -6.0 | 5.4 / 2.9 KB | Textured crunch |
| `footstep_snow_4` | 220 ms | -6.0 | 5.7 / 3.4 KB | Textured crunch / squeak |
| `footstep_snow_5` | 190 ms | -6.0 | 5.5 / 2.9 KB | Textured crunch / squeak |
| `footstep_snow_6` | 210 ms | -6.0 | 5.5 / 3.1 KB | Textured crunch |
| `coin_collect` | 850 ms | -3.5 | 9.1 / 10.7 KB | **v2:** juicy pop + B6→E7 two-note 'got it!' ding + rising sparkle cascade |
| `move_whoosh` | 420 ms | -10.0 | 7.2 / 5.7 KB | Quiet air whoosh (sprint/slide/dash) |
| `milestone_ding` | 1700 ms | -4.0 | 13.9 / 20.6 KB | Warm rolled E chord + emotional high ding (quests/checkpoints) |
| `ui_confirm` | 240 ms | -5.0 | v2 chunky press + upward E->B 'yes' (important buttons) |
| `heal` | 900 ms | -5.0 | 11.1 / 11.3 KB | Soft touch + warm chime bloom + rising shimmer |

### UI juice (added)
| Name | Length | Peak (dBTP) | ogg / mp3 | Sound |
|---|---|---|---|---|
| `ui_click_soft_1` | 140 ms | -9.0 | v2 cozy pop: low thock + round mid pop + quiet E6 sparkle |
| `ui_click_soft_2` | 140 ms | -9.0 | Variation: lower body, G#6 sparkle |
| `ui_click_soft_3` | 140 ms | -9.0 | Variation: higher body, B6 sparkle |
| `ui_pop` | 160 ms | -8.0 | NEW soft bubble pop: toggles, small rewards, equip |
| `toast_blip` | 130 ms | -10.0 | NEW tiny friendly two-step blip for toasts |
| `ui_hover_tick` | 80 ms | -18.0 | v2 very quiet breathy blip |
| `menu_open` | 280 ms | -7.0 | 6.2 / 4.0 KB | Rising air whoosh + B-E-G# chime |
| `menu_close` | 250 ms | -7.5 | 5.8 / 3.7 KB | Falling whoosh + G#-E-B chime |

**QA** (`qa/qa_report.json`, plus spectrograms):
- No clipping, and every edge goes to zero (first and last samples ≤1e-7). DC ≤3e-4.
- Every file starts at sample 0 with a 1.5 ms fade-in and reaches -20 dB of its peak in under 2 ms. The one exception is `move_whoosh`, which is a deliberate 30 ms swell.
- The six footsteps are genuinely different from each other (max cross-correlation 0.22).

## Wiring notes (Game Maker)
Play everything through the shared SFX path: one AudioContext, decoded AudioBuffers, mute respected. `../ui/integration.js` shows the pattern. Suggested `gain`, pitch jitter and throttles are in `manifest.json`.

- **Jump:** on takeoff, pick `jump_1` or `jump_2` at random with ±3% pitch. **Layer `move_whoosh` at 0.5×** for extra lift on double jumps or launch pads.
- **Landing:** fire on `onGround` going false→true after airtime over about 0.25 s. Scale gain by impact speed (about 0.4 for a small hop, 1.0 for a big fall) and pick one of the 3 variants. For a hard fall, also play one footstep at 0.6×.
- **Footsteps:** while grounded and moving, play one every ~0.33 s walking or ~0.25 s sprinting. Pick a random index that is **never the same as the last one** (pick from the other 5), add ±6% pitch and gain jitter of 0.4-0.5. Skip a step on the frame the player lands.
- **Coin:** play on pickup. For quick combos (another coin within ~1 s), raise the pitch by 0, 2, 4, 5, 7 semitones (`comboPitchSemitones`), so chained pickups climb up the scale. This is the most satisfying trick in the pack.
- **move_whoosh:** quiet. Use it on sprint start, slide or dash (throttle to 250 ms, ±8% pitch), never every frame.
- **milestone_ding:** quests completed, checkpoints and stage reached. Duck the music about 4 dB for a second. Keep the existing `win_fanfare` for big wins.
- **ui_confirm:** important buttons only (Buy, Claim, Equip, Confirm). Every other button keeps the `ui/` click.
- **heal:** heart pickup, health regen or respawn shield.
- **Spam safety:** the tails are short and each sound has a minimum repeat interval. Cap the SFX bus at about 8 voices.
- **UI juice:**
  - **`ui_click_soft_1..3`:** the default click for every ordinary button, link and tab. Rotate them with no immediate repeat and ±1% pitch, at gain 0.8. They peak at -9 dBTP, quieter than `ui_confirm` (-5).
  - **`ui_pop`:** toggles, toasts-with-reward, equip/unequip, small rewards (gain 0.75, ±3% pitch).
  - **`toast_blip`:** toast notifications (gain 0.7, throttle 250 ms).
  - v2 (Oct 2026): all UI cues rebuilt as rounded sine pops (2 ms cosine attack, no noise tick) for an old-Roblox cozy feel.
  - **`ui_hover_tick`:** pointer-enter, mouse only, at most once per element and throttled to 90 ms.
  - **`menu_open` / `menu_close`:** panels, the shop, inventory, settings and dialogs.

  These follow the same E major palette as `../ui/` and can stand in for its click, hover and popup sounds. The `ui/integration.js` global listener works unchanged if you point its click, hover and popup names at these files.
- **Coin v2:** a short B6 grace note into a big E7 "ding", for the classic "got it!" feel, with the combo pitch climb still applied.
