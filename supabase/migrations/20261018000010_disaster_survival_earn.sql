-- 0010: server earn source for Natural Disaster Survival (NDS Part One, event release).
-- Survival pay: 5 BB per round survived (src/games/disasterSurvival/config.js SURVIVE_REWARD_BB), client session cap 50.
-- Server caps: max 9 BB per game_earn call (stays under the 10 BB Apple price), 100 BB per player per day.
-- The global '*' daily cap (1500) still applies. Additive only: one earn_caps row, no player data touched.
-- Client sends it as economy.earn(pay, reason, { source: 'disaster_survival' }); without that option the
-- reason maps to 'other' (25 / 100), which still works but is the wrong bucket.
insert into public.earn_caps (source, per_call_max, daily_cap) values ('disaster_survival', 9, 100)
on conflict (source) do update set per_call_max = excluded.per_call_max, daily_cap = excluded.daily_cap;
