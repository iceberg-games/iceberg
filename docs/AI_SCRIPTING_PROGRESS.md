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

**Notable gaps (runtime has it, translator is weak or wrong):**
- Teleport to last / random checkpoint (`to: 'checkpoint' | 'randomCheckpoint'`
  in `runtime.js` and already described by `sayAction`) is stolen by the
  "save checkpoint" parser: "send them to the last checkpoint" currently
  *saves* a checkpoint instead of teleporting.
- A follow-up sentence starting with "Then…" becomes a new `start` rule
  instead of continuing the previous one.
- Two `when` clauses in one sentence ("when touched give 5 points and when
  clicked turn green") collapse into a single trigger.
- "plus" / "followed by" / "afterwards" are not treated as `and` / `then`.
- No script action for giving gear (`backpack.give` exists, but not in `act()`).

## Done
- Fresh worktree + branch off `origin/main` (see below). This progress note.
- **Step 1 improvement:** coins and common obby shorthand (see next section).
- 183/183 phrase tests passing (`scripts/nlscript-tests.mjs`).

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

## What's next (step 2)
Highest-value small follow-up: **multi-sentence / multi-trigger chaining.**

1. If a sentence starts with "Then" / "And then" / "Afterwards" / "After that"
   and has no trigger of its own, append its actions to the previous rule
   instead of creating a new `start` rule.
   Example: "When touched, turn red. Then wait 2 seconds and turn blue."
2. Split a sentence that contains two `when` clauses into two rules.
   Example: "When touched give 5 points and when clicked turn green."
3. Treat "plus" / "followed by" as `and` / `then` clause joiners.

Add cases to `scripts/nlscript-tests.mjs`. Keep the change local to
`nlscript.js`. After that, fix teleport-to-checkpoint being stolen by the
save-checkpoint parser.

## Branch / worktree
- Worktree: `/workspace/iceberg-game-maker/wt-studio-ai-scripting`
- Branch: `feature/studio-ai-scripting` (local only; not tracking origin)
- Base: `origin/main` `831c4c93c7994125886e5f06d04be0c5948d55cd`
- Tip: `9424bc55675d79040905a4e7ae8a9f4153f606a5` (step 1)

Do not publish. Do not push to main. Hand the finished branch to Iceberg
Publisher later, after the whole feature is tested.
