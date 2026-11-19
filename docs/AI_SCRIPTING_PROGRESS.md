# Iceberg Studio — AI (plain-words) scripting progress

## Goal
Make the built-in **offline** natural-language → behavior translator smarter.
No paid AI APIs, no cards, no network model calls. Expand `src/studio/nlscript.js`
patterns, synonyms, multi-clause parsing, suggestions, and coverage of actions
and triggers the runtime already supports.

## Current baseline (origin/main @ 831c4c9)
- `src/studio/nlscript.js` — rule-based translator (~640 lines). Creators type
  plain words; it compiles to a sandboxed JSON program (`validateProgram()`).
- `src/studio/ai.js` — provider interface. Default is `LocalRuleTranslator`
  wrapping `nlscript`. `RemoteModelTranslator` is a commented skeleton only.
- Runtime: `behaviors.js` (Motion + ScriptRunner) and `runtime.js` (`act()`).
- Tests: `node scripts/nlscript-tests.mjs` (phrase cases + cheat sheet + sandbox).

## Capability inventory
**Triggers already understood:** start, touch, click, press, enter, leave,
every, countdownEnd, death, reach (a variable hits a value). Also `once` and
`if` / `otherwise` (score, coins, health, or equipped gear).

**Actions already understood:** kill, damage, heal, color, hide, show, wait,
points, bucks, setVar, addVar, multVar, message, sound, teleport, bounce,
speed, jump, gravity, transparency, collide, glow, light, particles, door,
checkpoint, win, animation, moveBy, moveTo, return, spin, stop, resume, fall,
spawn, countdown, timer, leaderboard, random.

**Continuous motion:** spin, move (bob), path, chase, wander.

**Notable remaining gaps:**
- "toggle the light" / "flicker the light" are not understood (runtime light
  is on/off only; a real toggle would need a new `act()` case).
- No script action for giving gear (`backpack.give` exists, but not in `act()`).
- Conveyor / "walk the player" force is not a runtime action.

## Done
- Fresh worktree + branch off `origin/main` (see below). This progress note.
- **Step 1:** coins are collectibles, not Birg Bucks; obby shorthand.
- **Step 2:** multi-sentence / multi-trigger chaining + teleport-to-checkpoint.
- **Step 3:** "on spawn" is start; "hide … then show again" is a timed show.
- **Step 4a:** HELP / Ideas / Phrases hint copy refresh (cheat-sheet already had the new phrases).
- **Step 5:** Toolbox script presets: Sprint pad, Vanish pad, Health pack.
- 219/219 phrase tests passing (`scripts/nlscript-tests.mjs`).

## Step 1 — what changed
Creators were accidentally awarding **Birg Bucks** (real, once-per-play
currency) when they wrote "give 5 coins" or "this is a coin". The `coins`
variable already existed for "when the player gets 100 coins", but nothing
could increment it correctly.

- "coins" now add to the in-game `coins` variable, not Birg Bucks. "Birg
  Bucks" / "bucks" / "bb" / "money" / "cash" still award Birg Bucks.
- "This is a coin" / "collect this coin" → touch once, +1 coin, coin sound,
  part stays hidden. Loops with "when the player gets 100 coins, you win".
- "add 10 to their score" now gives 10 points (was 1). "add 10 to the
  counter" increments the counter (the `their`/`his`/`her` form was missed).
- Obby shorthand: killbrick, speed pad, health pack / medkit, disappearing
  platform (hide for 3 seconds on touch).

## Step 2 — what changed
- A follow-up sentence starting with "Then" / "And then" / "Afterwards" /
  "After that" and with no trigger of its own is appended to the previous
  rule (including wait-only tails). "Then when clicked, …" still starts a
  new click rule. Door open + "Then close it after 4 seconds" stays open
  until the close.
- A sentence with two `when` clauses becomes two rules. "if" conditions
  are not treated as a second trigger.
- "plus" / "followed by" join clauses like `and` / `then`.
- "Send them to the last checkpoint" / "teleport to a random checkpoint"
  now teleport (`to: 'checkpoint' | 'randomCheckpoint'`). "Save their
  progress" / "this is a checkpoint" still save.

## Step 3 — what changed
- "On spawn", "when they spawn", "when the player spawns", "on player spawn",
  "when spawned", and "at spawn" are `start` triggers. "When they respawn"
  stays `death`. Spawn *actions* ("every 3 seconds, spawn a ball", "when
  clicked, spawn a copy") are unchanged. "Right when they spawn give them
  5 coins" now awards coins, not a spawn-part action.
- "Hide for 2 seconds and then show again" becomes hide → wait 2s → show
  (no leftover unknown). "Hide and then show again" (no duration) is
  hide-for-3-seconds, which the runtime already restores. "Show again" /
  "visible again" are show actions (not a transparency-only change).

## Step 4a — HELP / examples copy
The 📖 Phrases cheat-sheet already listed coins, on spawn, Then-chaining,
hide-then-show, and send-to-last-checkpoint. Two spots were missing those
in everyday UI:

- `HELP` now mentions "this is a coin", "on spawn, give 10 points", and a
  Then-chaining example.
- `EXAMPLES` (Ideas chips) appends those three plus "send them to the last
  checkpoint" (all already in the cheat-sheet; 4 max).
- Phrases panel hint in `src/ui/creator.js` also mentions starting the next
  sentence with "Then…". No new cheat-sheet items; no runtime features.

## Step 5 — script presets
Added three one-click Toolbox → Parts presets, same pattern as Trampoline
and Door (insert a part + attach a plain-words script):

- **Sprint pad** (`data-script=sprint-pad`): neon disc; "When touched, make
  them 2 times faster for 5 seconds".
- **Vanish pad** (`data-script=vanish-pad`): glass platform; "This is a
  disappearing platform" (hides 3 seconds on touch, then returns).
- **Health pack** (`data-script=health-pack`): green sphere; "This is a
  health pack".

Skipped killbrick / checkpoint / coin — those already exist as Lava (kill),
Checkpoint, and Coin toolbox items. Phrases already tested in
`scripts/nlscript-tests.mjs`; suite still 219/219.

## What's next
- **Step 6:** "Something's wrong?" offline checker. Suggested place: a
  button in the script editor, under the "I understood / I didn't
  understand" preview (next to Apply). Offline only: walk the current
  script (and optionally the whole place) and list issues. Start with:
  unknown leftover phrases, empty program when text isn't empty, actions
  that name a part that isn't in the game (teleport/door targets), and a
  soft warning if a script awards Birg Bucks more than once. No network,
  no paid AI.
- **Step 7:** model importer animation regression test, then final smoke
  + hand off to Iceberg Publisher (we still do not publish or push).

Known limitations to leave unless runtime grows new `act()` cases:
toggle/flicker light, give-gear, conveyors.

## Branch / worktree
- Worktree: `/workspace/iceberg-game-maker/wt-studio-ai-scripting`
- Branch: `feature/studio-ai-scripting` (local only; not tracking origin)
- Base: `origin/main` `831c4c93c7994125886e5f06d04be0c5948d55cd`
- Tip: `b96117fc5722288c62e109dbe7d3a974df38bc3a` (step 5); earlier `b2c106a` / `5610671` (step 4a)

Do not publish. Do not push to main. Hand the finished branch to Iceberg
Publisher later, after the whole feature is tested.
