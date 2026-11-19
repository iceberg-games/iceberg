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

## What's next (step 4)
Toward "finished and tested" so this branch can be handed to Iceberg
Publisher (we still do not publish or push):

1. Studio UI smoke: type the new phrases in the script box and confirm
   the preview / cheat sheet / suggestions look right (`editor.js`,
   `templates.js`, HELP text). Update help copy only if a mention is
   stale or missing.
2. Known limitations to leave unless runtime grows new `act()` cases:
   toggle/flicker light, give-gear, conveyors.
3. If the smoke pass is clean, treat the offline translator work as
   ready to hand off — no further inventing of features.

## Branch / worktree
- Worktree: `/workspace/iceberg-game-maker/wt-studio-ai-scripting`
- Branch: `feature/studio-ai-scripting` (local only; not tracking origin)
- Base: `origin/main` `831c4c93c7994125886e5f06d04be0c5948d55cd`
- Tip: *(filled in after the step 3 commit)*

Do not publish. Do not push to main. Hand the finished branch to Iceberg
Publisher later, after the whole feature is tested.
