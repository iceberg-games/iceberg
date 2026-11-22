# Editor Update — accounts first drop (`feature/editor-accounts`)

Branch off `c01dd29`. Do not publish. Do not push to `main`. Do not apply migrations to production from here.

## Scope (this drop)

1. **Sign-up is required** when accounts are configured (site builds with a Supabase URL + anon key). The portal and the play page show a sign-in / sign-up gate; guests cannot open games. Offline / single-file builds without a backend still work as before (so existing guest tests stay green).
2. **Sign-up asks for date of birth** (required, validated: real calendar date, not in the future, not before 1900-01-01). Stored on `profiles.date_of_birth` via signup metadata + `set_date_of_birth`. Also saved in `localStorage` so Settings still works if the server migration has not been applied yet.
3. **Settings > Account:** change date of birth; Deactivate (confirm, hides profile, signs out, signing in again clears `deactivated_at`); Delete (type username to confirm, calls `delete_account`; if the RPC is missing the UI says it is not available yet).
4. **Settings > Security & Privacy only:** change password; two-step verification (Supabase MFA / TOTP, with a graceful “not available yet” if the server does not support it); sign out of all other sessions; active sessions list (device/browser, last active, “This device” badge, sign out per other session). Sessions are tracked in `account_sessions` because the custom auth client cannot list GoTrue sessions.

Phone and PC both use these screens (portal settings are responsive). Shared chrome / home layout is left to `feature/editor-update`.

## Migrations (SQL only — not applied to production)

`supabase/migrations/20261122000020_editor_accounts.sql`

- Adds `profiles.date_of_birth` and `profiles.deactivated_at`.
- Updates `handle_new_user` to store a valid DOB from auth metadata.
- Extends `_profile_json` with `dateOfBirth` and `deactivated`.
- `get_my_profile` clears `deactivated_at` (signing in reactivates).
- RPCs: `set_date_of_birth`, `deactivate_account`, `delete_account`.
- Table `account_sessions` + RPCs: `register_account_session`, `heartbeat_account_session`, `list_account_sessions`, `revoke_account_session`, `revoke_other_account_sessions`.

## How to test

```
node tools/test-account.mjs
node tools/test-session.mjs
node tools/db/test-db.mjs
node scripts/editor-accounts-shots.mjs
npm test                # existing suite; site section now expects the gate + DOB
```

Screenshots: `designs/editor-accounts/`.

## Deferred

- Applying the migration to the live Supabase project (needs a normal ops/deploy pass, not this branch).
- Hiding a deactivated profile from every public surface (friends lists, published games, chat presence). The flag is stored and the user is signed out; a full sweep of listing RPCs can follow.
- Paying for AI / Birg Bucks chat (explicitly out of this drop).
- MFA at the sign-in prompt (challenge after password) — enrollment and management are in Settings; a forced second step on every login needs a follow-up if GoTrue AAL is enabled on the project.

## Test results (Nov 21, 2026, America/Phoenix)

- `node tools/test-account.mjs` — passed
- `node tools/test-session.mjs` — passed
- `node tools/db/test-db.mjs` — 44/45. The new accounts RPC test passed. The one failure is an existing event-catalog fixture mismatch (`sr_powder_scarf` present on the server but not in the expected list) and is unrelated to this drop.
- `node scripts/editor-accounts-shots.mjs` — 14/14 passed

## Screenshots

All under `designs/editor-accounts/`:

- `pc-1440x900-gate.png` — required sign-in / sign-up (DOB on create)
- `pc-1440x900-home-after-signin.png` — games after sign-in
- `pc-1440x900-settings-account-security.png` — Settings scrolled to Account
- `pc-1440x900-account-card.png` / `pc-1440x900-security-card.png` — Account and Security cards
- `pc-1440x900-delete-confirm.png` / `pc-1440x900-deactivate-confirm.png` — confirm dialogs
- `pc-1440x900-play-gate.png` — play page blocks guests
- `phone-390x844-gate.png` / `phone-390x844-settings-account-security.png`
- `phone-390x844-account-card.png` / `phone-390x844-security-card.png`
