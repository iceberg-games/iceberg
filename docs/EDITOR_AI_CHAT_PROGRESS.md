# Iceberg Studio — Editor AI chat + GUI builder progress

## Goal
A basic, **free**, offline corner chat in PC Studio, plus a first-drop GUI
builder. No paid AI APIs, no sign-ups, no Grok usage, no publish.

The chat is built on the existing plain-words translator
(`src/studio/nlscript.js` + `LocalRuleTranslator` in `ai.js`). A later paid
provider can plug in behind the same interface; players would pay in Birg
Bucks then. That path is a TODO only — it is not enabled.

## Branch / worktree
- Worktree: `/workspace/iceberg-game-maker/wt-editor-ai-chat`
- Branch: `feature/editor-ai-chat` (local only; do not publish or push to main)
- Base: `c01dd29` (live main tip with AI scripting folded in)

Keep core changes inside `src/studio/` so this merges cleanly with
`feature/editor-update` and `feature/editor-accounts`. Small hooks live in
`src/ui/creator.js` (mount the panel / first-person setting) and, for
first-person camera, `src/engine/player.js`.

## Plan
1. Offline intent router + builder + chat engine (pure, tested).
2. Toggleable Studio corner chat UI; apply scripts, builds, and help.
3. Headless 1440×900 smoke + screenshot.
4. GUI builder (buttons, labels, frames, bars), HUD in play, first-person
   setting + action, and chat phrases that create GUI.

## Status
- Scaffolded this note on `feature/editor-ai-chat` off `c01dd29`.
- Implementation follows in small commits.

Do not publish. Do not push to main. Do not sign up for or call a paid API.
