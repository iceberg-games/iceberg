-- 0016: Sled Rush prep (additive, UNSCHEDULED menu game; no game_events row, no event tag).
--   earn source 'sled-rush' (25 BB per call, 100 BB per player per day; global '*' cap still applies).
-- Quest sr_quest_finish -> sr_powder_scarf arrives via catalog sync once docs/sled-rush-quests.stub.js is moved
-- into Game Maker's src/games/<sled rush>/quests.js. The game listing appears only when that folder is merged.
insert into public.earn_caps (source, per_call_max, daily_cap) values ('sled-rush', 25, 100)
on conflict (source) do update set per_call_max = excluded.per_call_max, daily_cap = excluded.daily_cap;
