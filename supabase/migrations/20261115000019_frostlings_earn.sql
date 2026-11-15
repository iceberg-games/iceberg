-- 0019: Frostlings one-time milestones (additive; one earn_caps row, no player data touched).
--   earn source 'game:frostlings' (50 BB per call = Frostdex complete; 250 BB per player per day,
--   above the 225 BB total of all one-time milestones). Global '*' daily cap still applies.
insert into public.earn_caps (source, per_call_max, daily_cap) values ('game:frostlings', 50, 250)
on conflict (source) do update set per_call_max = excluded.per_call_max, daily_cap = excluded.daily_cap;
