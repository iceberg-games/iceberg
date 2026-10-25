-- 0013: Winterhaven event prep (additive, UNSCHEDULED). Same patterns as natural_disasters (0008 / 0010):
--   game_events 'winterhaven' with no window (event_status inactive; shop/quests treat it as not started),
--   earn source 'winterhaven' (25 BB per call, 100 BB per player per day; global '*' cap still applies).
-- Quests (quest_defs) and items (catalog_items) arrive through the catalog sync once Game Maker's game and
-- Cosmetics' cosmetics/winterhaven are merged (reward items must exist first). Schedule later with:
--   node scripts/event-window.mjs winterhaven --start <when> --days <n>
insert into public.game_events (id, title) values ('winterhaven', 'Winterhaven') on conflict (id) do nothing;
insert into public.earn_caps (source, per_call_max, daily_cap) values ('winterhaven', 25, 100)
on conflict (source) do update set per_call_max = excluded.per_call_max, daily_cap = excluded.daily_cap;
