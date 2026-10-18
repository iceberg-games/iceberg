-- Events + quests + consumables (additive). No Birg Bucks are ever granted by quests.
--   quest_defs            synced from src/games/**/quests.js (scripts/sync-catalog.mjs)
--   quest_progress        one row per (player, quest); written ONLY by quest_progress() with per-quest
--                         per-call max, minimum interval and hourly cap, inside the quest's active window
--   claim_quest_reward()  grants the reward cosmetic exactly once (inventory PK + claimed_at)
--   catalog_items.grant_only  event cosmetics: cannot be bought, not importable from guest saves
--   game_consumable_prices + buy_consumable()  paid one-use items (e.g. Apple heal, Bigger Storm),
--                         price synced from the game's config.js CONSUMABLE_PRICES_BB, idempotent per ref

alter table public.catalog_items add column if not exists grant_only boolean not null default false;

create table if not exists public.quest_defs (
  quest_id        text primary key check (quest_id ~ '^[a-z0-9_]{1,60}$'),
  game_id         text not null check (game_id ~ '^[a-zA-Z0-9_-]{1,40}$'),
  title           text not null check (char_length(title) between 1 and 80),
  goal            integer not null check (goal between 1 and 100000),
  reward_item_id  text not null references public.catalog_items(id),
  event_id        text check (event_id is null or event_id ~ '^[a-z0-9_-]{1,40}$'),
  starts_at       timestamptz,
  ends_at         timestamptz,
  max_per_call    integer not null default 1 check (max_per_call between 1 and 1000),
  min_interval_ms integer not null default 2000 check (min_interval_ms between 0 and 3600000),
  max_per_hour    integer not null default 60 check (max_per_hour between 1 and 100000),
  active          boolean not null default true,
  updated_at      timestamptz not null default now(),
  check (ends_at is null or starts_at is null or ends_at > starts_at)
);
create table if not exists public.quest_progress (
  user_id      uuid not null references public.profiles(id) on delete cascade,
  quest_id     text not null references public.quest_defs(quest_id),
  count        integer not null default 0,
  last_at      timestamptz,
  hour_start   timestamptz,
  hour_count   integer not null default 0,
  completed_at timestamptz,
  claimed_at   timestamptz,
  primary key (user_id, quest_id)
);
create table if not exists public.game_consumable_prices (
  game_id    text not null check (game_id ~ '^[a-zA-Z0-9_-]{1,40}$'),
  item_id    text not null check (item_id ~ '^[a-zA-Z0-9_-]{1,40}$'),
  price      integer not null check (price >= 0),
  active     boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (game_id, item_id)
);
create table if not exists public.game_consumable_purchases (
  id         bigserial primary key,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  game_id    text not null,
  item_id    text not null,
  price      integer not null,
  ref        text not null,
  created_at timestamptz not null default now(),
  unique (user_id, ref)
);
alter table public.quest_defs enable row level security;
alter table public.quest_progress enable row level security;
alter table public.game_consumable_prices enable row level security;
alter table public.game_consumable_purchases enable row level security;
revoke all on public.quest_defs, public.quest_progress, public.game_consumable_prices, public.game_consumable_purchases from anon, authenticated;
drop policy if exists quest_defs_read on public.quest_defs;
create policy quest_defs_read on public.quest_defs for select to anon, authenticated using (active);
drop policy if exists consumable_prices_read on public.game_consumable_prices;
create policy consumable_prices_read on public.game_consumable_prices for select to anon, authenticated using (active);
grant select on public.quest_defs, public.game_consumable_prices to anon, authenticated;
drop policy if exists quest_progress_own on public.quest_progress;
create policy quest_progress_own on public.quest_progress for select to authenticated using (user_id = auth.uid());
grant select on public.quest_progress to authenticated;     -- read own rows; writes only via RPC

-- grant-only (event) cosmetics can't be bought
create or replace function public.buy_cosmetic(p_item_id text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := public._uid(); v_item public.catalog_items; v_bal bigint;
begin
  select * into v_item from public.catalog_items where id = p_item_id and active;
  if not found then return jsonb_build_object('ok', false, 'reason', 'unknown_item'); end if;
  if v_item.grant_only then return jsonb_build_object('ok', false, 'reason', 'not_for_sale', 'coins', (select coins from public.profiles where id = v_uid)); end if;
  perform 1 from public.profiles where id = v_uid for update;     -- serialize purchases per user
  if exists (select 1 from public.inventory where user_id = v_uid and item_id = p_item_id) then
    return jsonb_build_object('ok', false, 'reason', 'already_owned', 'coins', (select coins from public.profiles where id = v_uid));
  end if;
  v_bal := public._credit(v_uid, -v_item.price, 'purchase', 'shop', 'Bought ' || v_item.name, 'buy:' || p_item_id);
  if v_bal is null then
    return jsonb_build_object('ok', false, 'reason', 'insufficient_funds', 'coins', (select coins from public.profiles where id = v_uid));
  end if;
  insert into public.inventory (user_id, item_id, source) values (v_uid, p_item_id, 'purchase');
  return jsonb_build_object('ok', true, 'coins', v_bal, 'item', p_item_id, 'price', v_item.price);
end $$;

-- guest import: same as before, but event (grant-only) items never come from a local save
create or replace function public.migrate_local_profile(p_local jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := public._uid(); v_p public.profiles;
  v_coins bigint; v_items text[]; v_bal bigint;
begin
  select * into v_p from public.profiles where id = v_uid for update;
  if v_p.migrated_at is not null then return jsonb_build_object('ok', false, 'reason', 'already_migrated', 'profile', public._profile_json(v_uid)); end if;
  if jsonb_typeof(p_local) is distinct from 'object' then p_local := '{}'::jsonb; end if;
  v_coins := 0;
  begin
    v_coins := greatest(0, floor(coalesce((p_local->>'coins')::numeric, 0)) - floor(greatest(0, coalesce((p_local->>'demoGranted')::numeric, 0))))::bigint;
  exception when others then v_coins := 0; end;
  v_coins := least(v_coins, public._cfg('migration_max_coins'));
  select coalesce(array_agg(c.id), '{}') into v_items from (
    select distinct c.id from jsonb_array_elements_text(case when jsonb_typeof(p_local->'owned') = 'array' then p_local->'owned' else '[]'::jsonb end) o(id)
    join public.catalog_items c on c.id = o.id and c.active and not c.premium and not c.grant_only and c.price <= public._cfg('migration_max_item_price')
    limit public._cfg('migration_max_items')) c;
  insert into public.inventory (user_id, item_id, source) select v_uid, unnest(v_items), 'migration' on conflict do nothing;
  update public.profiles set
    migrated_at = now(),
    equipped = public._clean_equipped(v_uid, p_local->'equipped'),
    rocket_colors = public._clean_rocket_colors(p_local->'rocketColors', rocket_colors),
    cosmetic_colors = public._clean_cosmetic_colors(p_local->'cosmeticColors'),
    updated_at = now()
  where id = v_uid;
  if jsonb_typeof(p_local->'gameData') = 'object' then
    insert into public.game_data (user_id, game_id, data)
      select v_uid, e.key, e.value - 'gears' from jsonb_each(p_local->'gameData') e
      where e.key ~ '^[a-zA-Z0-9_-]{1,40}$' and jsonb_typeof(e.value) = 'object' and octet_length((e.value - 'gears')::text) <= 16384
      limit 64
    on conflict do nothing;
  end if;
  if v_coins > 0 then v_bal := public._credit(v_uid, v_coins, 'migration', 'guest', 'Guest progress import', 'migration'); end if;
  return jsonb_build_object('ok', true, 'coins', v_coins, 'items', to_jsonb(v_items), 'profile', public._profile_json(v_uid));
end $$;

create or replace function public._quest_live(q public.quest_defs) returns boolean
language sql stable as $$ select q.active and (q.starts_at is null or now() >= q.starts_at) and (q.ends_at is null or now() < q.ends_at) $$;

create or replace function public._quest_json(q public.quest_defs, p public.quest_progress) returns jsonb
language sql stable as $$
  select jsonb_build_object('id', q.quest_id, 'gameId', q.game_id, 'title', q.title, 'goal', q.goal,
    'progress', least(coalesce(p.count, 0), q.goal), 'completed', p.completed_at is not null or coalesce(p.count, 0) >= q.goal, 'claimed', p.claimed_at is not null,
    'itemId', q.reward_item_id, 'eventId', q.event_id, 'startsAt', q.starts_at, 'endsAt', q.ends_at, 'live', public._quest_live(q))
$$;

-- Add progress. Server-side limits: delta 1..max_per_call, >= min_interval_ms between calls,
-- <= max_per_hour per rolling clock hour, only while the quest is live, capped at goal.
create or replace function public.quest_progress(p_quest_id text, p_delta integer default 1) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := public._uid(); q public.quest_defs; p public.quest_progress; v_add int; v_wait bigint;
begin
  if v_uid is null then raise exception 'not_signed_in' using errcode = '42501'; end if;
  select * into q from public.quest_defs where quest_id = p_quest_id and active;
  if not found then return jsonb_build_object('ok', false, 'reason', 'unknown_quest'); end if;
  if not public._quest_live(q) then return jsonb_build_object('ok', false, 'reason', 'not_live', 'quest', public._quest_json(q, null)); end if;
  if p_delta is null or p_delta < 1 or p_delta > q.max_per_call then return jsonb_build_object('ok', false, 'reason', 'invalid_delta', 'maxPerCall', q.max_per_call); end if;
  insert into public.quest_progress (user_id, quest_id) values (v_uid, p_quest_id) on conflict do nothing;
  select * into p from public.quest_progress where user_id = v_uid and quest_id = p_quest_id for update;
  if p.completed_at is not null or p.count >= q.goal then return jsonb_build_object('ok', true, 'added', 0, 'quest', public._quest_json(q, p)); end if;
  if p.last_at is not null and now() - p.last_at < make_interval(secs => q.min_interval_ms / 1000.0) then
    v_wait := ceil(q.min_interval_ms - extract(epoch from (now() - p.last_at)) * 1000);
    return jsonb_build_object('ok', false, 'reason', 'too_fast', 'retryAfterMs', v_wait, 'quest', public._quest_json(q, p));
  end if;
  if p.hour_start is null or now() - p.hour_start >= interval '1 hour' then p.hour_start := now(); p.hour_count := 0; end if;
  v_add := least(p_delta, q.max_per_hour - p.hour_count, q.goal - p.count);
  if v_add <= 0 then
    return jsonb_build_object('ok', false, 'reason', 'hourly_cap', 'retryAfterMs', ceil(extract(epoch from (p.hour_start + interval '1 hour' - now())) * 1000), 'quest', public._quest_json(q, p));
  end if;
  update public.quest_progress set count = count + v_add, last_at = now(), hour_start = p.hour_start, hour_count = p.hour_count + v_add,
    completed_at = case when count + v_add >= q.goal then now() else null end
  where user_id = v_uid and quest_id = p_quest_id returning * into p;
  return jsonb_build_object('ok', true, 'added', v_add, 'quest', public._quest_json(q, p));
end $$;

-- Live quests (optionally one game) with my progress. Anon: progress 0.
create or replace function public.get_quests(p_game_id text default null) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(public._quest_json(q, p) order by q.game_id, q.quest_id), '[]'::jsonb)
  from public.quest_defs q
  left join public.quest_progress p on p.quest_id = q.quest_id and p.user_id = auth.uid()   -- auth.uid(): anon gets progress 0
  where q.active and (p_game_id is null or q.game_id = p_game_id)
    and (public._quest_live(q) or ((p.completed_at is not null or p.count >= q.goal) and p.claimed_at is null))   -- finished-but-unclaimed stays visible
$$;

-- Grant the reward cosmetic once. No Birg Bucks. Works after the event ends if the quest was completed.
create or replace function public.claim_quest_reward(p_quest_id text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := public._uid(); q public.quest_defs; p public.quest_progress; v_new int;
begin
  if v_uid is null then raise exception 'not_signed_in' using errcode = '42501'; end if;
  select * into q from public.quest_defs where quest_id = p_quest_id;
  if not found then return jsonb_build_object('granted', false, 'reason', 'unknown_quest'); end if;
  select * into p from public.quest_progress where user_id = v_uid and quest_id = p_quest_id for update;
  if p.completed_at is null and coalesce(p.count, 0) >= q.goal then   -- goal lowered after progress: counts as done
    update public.quest_progress set completed_at = now() where user_id = v_uid and quest_id = p_quest_id returning * into p;
  end if;
  if p.completed_at is null then return jsonb_build_object('granted', false, 'reason', 'not_complete', 'itemId', q.reward_item_id, 'progress', coalesce(p.count, 0), 'goal', q.goal); end if;
  if p.claimed_at is not null then return jsonb_build_object('granted', false, 'alreadyClaimed', true, 'itemId', q.reward_item_id); end if;
  insert into public.inventory (user_id, item_id, source) values (v_uid, q.reward_item_id, 'quest:' || q.quest_id) on conflict do nothing;
  get diagnostics v_new = row_count;
  update public.quest_progress set claimed_at = now() where user_id = v_uid and quest_id = p_quest_id;
  return jsonb_build_object('granted', v_new = 1, 'alreadyClaimed', v_new = 0, 'itemId', q.reward_item_id, 'profile', public._profile_json(v_uid));
end $$;

-- One-use paid item (Apple heal, Bigger Storm...). p_ref makes a retry free (same purchase).
create or replace function public.buy_consumable(p_game_id text, p_item_id text, p_ref text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := public._uid(); v_price int; v_bal bigint; v_id bigint;
begin
  if v_uid is null then raise exception 'not_signed_in' using errcode = '42501'; end if;
  if p_ref is null or p_ref !~ '^[a-zA-Z0-9_:.-]{4,64}$' then return jsonb_build_object('ok', false, 'reason', 'invalid_ref'); end if;
  select price into v_price from public.game_consumable_prices where game_id = p_game_id and item_id = p_item_id and active;
  if v_price is null then return jsonb_build_object('ok', false, 'reason', 'unknown_item'); end if;
  perform 1 from public.profiles where id = v_uid for update;
  select id into v_id from public.game_consumable_purchases where user_id = v_uid and ref = p_ref;
  if v_id is not null then return jsonb_build_object('ok', true, 'duplicate', true, 'purchaseId', v_id, 'coins', (select coins from public.profiles where id = v_uid)); end if;
  v_bal := public._credit(v_uid, -v_price, 'purchase', 'consumable:' || p_game_id, 'Used ' || p_item_id, 'consumable:' || p_ref);
  if v_bal is null then return jsonb_build_object('ok', false, 'reason', 'insufficient_funds', 'coins', (select coins from public.profiles where id = v_uid)); end if;
  insert into public.game_consumable_purchases (user_id, game_id, item_id, price, ref) values (v_uid, p_game_id, p_item_id, v_price, p_ref) returning id into v_id;
  return jsonb_build_object('ok', true, 'coins', v_bal, 'price', v_price, 'purchaseId', v_id);
end $$;

revoke execute on function public._quest_live(public.quest_defs), public._quest_json(public.quest_defs, public.quest_progress),
  public.quest_progress(text, integer), public.get_quests(text), public.claim_quest_reward(text), public.buy_consumable(text, text, text),
  public.buy_cosmetic(text), public.migrate_local_profile(jsonb)
  from public, anon, authenticated;
grant execute on function public.quest_progress(text, integer), public.claim_quest_reward(text), public.buy_consumable(text, text, text),
  public.buy_cosmetic(text), public.migrate_local_profile(jsonb) to authenticated;
grant execute on function public.get_quests(text) to anon, authenticated;
