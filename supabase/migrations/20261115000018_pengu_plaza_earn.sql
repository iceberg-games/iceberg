-- 0018: Pengu Plaza BIG photo-album milestones (additive; one earn_caps row, no player data touched).
--   earn source 'game:pengu-plaza' (25 BB per call = largest single milestone; 150 BB per player per day,
--   above the 140 BB total of all one-time album milestones so a big session isn't clipped).
--   Global '*' daily cap still applies.
insert into public.earn_caps (source, per_call_max, daily_cap) values ('game:pengu-plaza', 25, 150)
on conflict (source) do update set per_call_max = excluded.per_call_max, daily_cap = excluded.daily_cap;
