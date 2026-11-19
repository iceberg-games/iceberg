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
- "on spawn, give 10 points" is treated as a touch + leftover unknown "on spawn",
  not as a start-of-game rule.
- "When touched, hide for 2 seconds and then show again" hides for 2 seconds
  but leaves "show again" unknown (the hide already auto-shows after 2s, but
  the leftover is noisy).
- "toggle the light" / "flicker the light" are not understood (runtime light
  is on/off only; a toggle would need a new `act()` case or a sequenced pair).
- No script action for giving gear (`backpack.give` exists, but not in `act()`).

## Done
- Fresh worktree + branch off `origin/main` (see below). This progress note.
- **Step 1:** coins are collectibles, not Birg Bucks; obby shorthand.
- **Step 2:** multi-sentence / multi-trigger chaining + teleport-to-checkpoint.
- 200/200 phrase tests passing (`scripts/nlscript-tests.mjs`).

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

## What's next (step 3)
Highest-value small follow-up: **fix leftover common phrases that still
parse wrong**, still only in `nlscript.js`, with new test cases.

1. "on spawn, give 10 points" / "when they spawn" should be a `start` (or
   `death`/respawn if clearly "when they respawn") rule, not touch + an
   unknown "on spawn" leftover. Do not steal "every 3 seconds, spawn a ball".
2. "hide for 2 seconds and then show again" should not leave "show again"
   unknown (either drop it when hide already has a duration, or emit an
   explicit `show` after the wait).
3. If those are quick, also improve a couple of light phrases ("toggle"
   can be a clearly described limitation, or a short on/off sequence if
   that's honest).

Do not add a give-gear script action until `runtime.js` `act()` supports it.

## Branch / worktree
- Worktree: `/workspace/iceberg-game-maker/wt-studio-ai-scripting`
- Branch: `feature/studio-ai-scripting` (local only; not tracking origin)
- Base: `origin/main` `831c4c93c7994125886e5f06d04be0c5948d55cd`
- Tip: `2d91a9a0fc89b0232d62b7ee663f366035a94e54` (step 2); earlier `9424bc5` / `248922d` (step 1)

Do not publish. Do not push to main. Hand the finished branch to Iceberg
Publisher later, after the whole feature is tested.
