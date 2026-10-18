-- Per-game save data in its own table (owner-only, 16 KB cap) and per-game gear
-- ownership validated on the server. Save data is NEVER used for Birg Bucks or
-- gear ownership: any "gears" key in a save blob is stripped on write and replaced
-- by the server's game_gears rows on read.

create table if not exists public.game_data (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  game_id    text not null check (game_id ~ '^[a-zA-Z0-9_-]{1,40}$'),
  data       jsonb not null default '{}'::jsonb check (octet_length(data::text) <= 16384),
  updated_at timestamptz not null default now(),
  primary key (user_id, game_id)
);

-- Gear price table, synced from each game's config (scripts/sync-catalog.mjs).
create table if not exists public.game_gear_prices (
  game_id    text not null check (game_id ~ '^[a-zA-Z0-9_-]{1,40}$'),
  gear_id    text not null check (gear_id ~ '^[a-zA-Z0-9_-]{1,40}$'),
  price      integer not null check (price >= 0),
  active     boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (game_id, gear_id)
);

create table if not exists public.game_gears (
  user_id     uuid not null references public.profiles(id) on delete cascade,
  game_id     text not null,
  gear_id     text not null,
  acquired_at timestamptz not null default now(),
  primary key (user_id, game_id, gear_id),
  foreign key (game_id, gear_id) references public.game_gear_prices(game_id, gear_id)
);

alter table public.game_data enable row level security;
alter table public.game_gear_prices enable row level security;
alter table public.game_gears enable row level security;
drop policy if exists game_data_own on public.game_data;
create policy game_data_own on public.game_data for select to authenticated using (user_id = auth.uid());
drop policy if exists gear_prices_read on public.game_gear_prices;
create policy gear_prices_read on public.game_gear_prices for select to anon, authenticated using (active);
drop policy if exists game_gears_own on public.game_gears;
create policy game_gears_own on public.game_gears for select to authenticated using (user_id = auth.uid());
revoke all on public.game_data, public.game_gear_prices, public.game_gears from anon, authenticated;
grant select on public.game_data, public.game_gears to authenticated;
grant select on public.game_gear_prices to anon, authenticated;

-- move any blobs saved by the first version (profiles.game_data) into the table
insert into public.game_data (user_id, game_id, data)
  select p.id, e.key, e.value - 'gears' from public.profiles p, jsonb_each(p.game_data) e
  where e.key ~ '^[a-zA-Z0-9_-]{1,40}$' and octet_length(e.value::text) <= 16384
on conflict do nothing;

create or replace function public._gears_json(p_uid uuid, p_game_id text) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(gear_id order by acquired_at), '[]'::jsonb) from public.game_gears where user_id = p_uid and game_id = p_game_id
$$;

-- gameData for the profile snapshot: { gameId: data + {gears: [server-owned]} }
create or replace function public._game_data_json(p_uid uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_object_agg(g.game_id, coalesce(d.data, '{}'::jsonb) || jsonb_build_object('gears', public._gears_json(p_uid, g.game_id))), '{}'::jsonb)
  from (select game_id from public.game_data where user_id = p_uid union select game_id from public.game_gears where user_id = p_uid) g
  left join public.game_data d on d.user_id = p_uid and d.game_id = g.game_id
$$;

create or replace function public._profile_json(p_uid uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'playerId', p.id, 'username', p.username, 'displayName', p.display_name,
    'coins', p.coins,
    'owned', coalesce((select jsonb_agg(i.item_id order by i.acquired_at) from public.inventory i where i.user_id = p.id), '[]'::jsonb),
    'equipped', p.equipped, 'rocketColors', p.rocket_colors, 'cosmeticColors', p.cosmetic_colors,
    'gameData', public._game_data_json(p.id),
    'lastDailyBonus', p.last_daily_bonus,
    'buildRewardDay', public._today(),
    'buildRewardToday', coalesce((select amount from public.earn_daily e where e.user_id = p.id and e.day = public._today() and e.source = 'build'), 0),
    'migrated', p.migrated_at is not null)
  from public.profiles p where p.id = p_uid
$$;

create or replace function public.save_game_data(p_game_id text, p_data jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := public._uid(); v_clean jsonb;
begin
  if p_game_id !~ '^[a-zA-Z0-9_-]{1,40}$' then return jsonb_build_object('ok', false, 'reason', 'invalid_game'); end if;
  if jsonb_typeof(p_data) is distinct from 'object' then return jsonb_build_object('ok', false, 'reason', 'not_an_object'); end if;
  v_clean := p_data - 'gears';                                   -- ownership lives in game_gears only
  if octet_length(v_clean::text) > 16384 then return jsonb_build_object('ok', false, 'reason', 'too_large'); end if;
  if not exists (select 1 from public.game_data where user_id = v_uid and game_id = p_game_id)
     and (select count(*) from public.game_data where user_id = v_uid) >= 64 then
    return jsonb_build_object('ok', false, 'reason', 'too_many_games');
  end if;
  insert into public.game_data (user_id, game_id, data, updated_at) values (v_uid, p_game_id, v_clean, now())
    on conflict (user_id, game_id) do update set data = excluded.data, updated_at = now();
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.load_game_data(p_game_id text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_uid uuid := public._uid();
begin
  return coalesce((select data from public.game_data where user_id = v_uid and game_id = p_game_id), '{}'::jsonb)
         || jsonb_build_object('gears', public._gears_json(v_uid, p_game_id));
end $$;

create or replace function public.buy_gear(p_game_id text, p_gear_id text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := public._uid(); v_price integer; v_bal bigint;
begin
  select price into v_price from public.game_gear_prices where game_id = p_game_id and gear_id = p_gear_id and active;
  if v_price is null then return jsonb_build_object('ok', false, 'reason', 'unknown_gear'); end if;
  perform 1 from public.profiles where id = v_uid for update;
  if exists (select 1 from public.game_gears where user_id = v_uid and game_id = p_game_id and gear_id = p_gear_id) then
    return jsonb_build_object('ok', false, 'reason', 'already_owned', 'coins', (select coins from public.profiles where id = v_uid), 'gears', public._gears_json(v_uid, p_game_id));
  end if;
  v_bal := public._credit(v_uid, -v_price, 'purchase', 'gear:' || p_game_id, 'Gear ' || p_gear_id, 'gear:' || p_game_id || ':' || p_gear_id);
  if v_bal is null then
    return jsonb_build_object('ok', false, 'reason', 'insufficient_funds', 'coins', (select coins from public.profiles where id = v_uid));
  end if;
  insert into public.game_gears (user_id, game_id, gear_id) values (v_uid, p_game_id, p_gear_id);
  return jsonb_build_object('ok', true, 'coins', v_bal, 'price', v_price, 'gears', public._gears_json(v_uid, p_game_id));
end $$;

-- Ownership check scoped to ONE game: a gear bought in game A is not owned in game B.
create or replace function public.owns_gear(p_game_id text, p_gear_id text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.game_gears where user_id = public._uid() and game_id = p_game_id and gear_id = p_gear_id)
$$;

-- Guest import now writes save blobs to game_data (minus any "gears": guest gears do not carry over).
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
    join public.catalog_items c on c.id = o.id and c.active and not c.premium and c.price <= public._cfg('migration_max_item_price')
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

alter table public.profiles drop column if exists game_data;

revoke execute on function public._gears_json(uuid, text), public._game_data_json(uuid), public._profile_json(uuid),
  public.save_game_data(text, jsonb), public.load_game_data(text), public.buy_gear(text, text), public.owns_gear(text, text),
  public.migrate_local_profile(jsonb)
  from public, anon, authenticated;
grant execute on function public.save_game_data(text, jsonb), public.load_game_data(text), public.buy_gear(text, text),
  public.owns_gear(text, text), public.migrate_local_profile(jsonb) to authenticated;

-- Giant Rainbow Obby pays up to 100 BB in one milestone (stage 1000).
insert into public.earn_caps (source, per_call_max, daily_cap) values ('obby_stage', 100, 500)
on conflict (source) do update set per_call_max = excluded.per_call_max, daily_cap = excluded.daily_cap;
