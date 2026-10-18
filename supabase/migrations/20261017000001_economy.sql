-- Iceberg: accounts, server-authoritative Birg Bucks wallet, cosmetics catalog/inventory.
-- Every write goes through SECURITY DEFINER RPCs below; clients never write tables directly.
-- Requires Supabase's auth schema (auth.users, auth.uid()) and roles anon/authenticated.

-- ---------- helpers ----------
create or replace function public._today() returns date
language sql stable set search_path = public as $$ select (now() at time zone 'utc')::date $$;

create or replace function public._uid() returns uuid
language plpgsql stable set search_path = public as $$
declare v uuid := auth.uid();
begin
  if v is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  return v;
end $$;

create or replace function public._is_hex_color(v text) returns boolean
language sql immutable as $$ select v ~ '^#[0-9a-fA-F]{6}$' $$;

-- ---------- catalog (synced from src/data/cosmetics.js by scripts/sync-catalog.mjs) ----------
create table if not exists public.catalog_items (
  id           text primary key check (id ~ '^[a-z0-9_]{1,40}$'),
  name         text not null,
  slot         text not null,
  price        integer not null check (price >= 0),
  premium      boolean not null default false,
  customizable boolean not null default false,
  active       boolean not null default true,
  updated_at   timestamptz not null default now()
);

-- ---------- profiles ----------
create table if not exists public.profiles (
  id               uuid primary key references auth.users(id) on delete cascade,
  username         text not null unique check (username ~ '^[a-z0-9_]{3,20}$'),
  display_name     text not null check (char_length(display_name) between 1 and 24),
  coins            bigint not null default 0 check (coins >= 0),
  equipped         jsonb not null default '{}'::jsonb,
  rocket_colors    jsonb not null default '{"body":"#e8f4ff","fins":"#3f8fd0","trim":"#7fe3ff"}'::jsonb,
  cosmetic_colors  jsonb not null default '{}'::jsonb,
  game_data        jsonb not null default '{}'::jsonb,
  last_daily_bonus date,
  migrated_at      timestamptz,
  chat_muted_until timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create table if not exists public.inventory (
  user_id     uuid not null references public.profiles(id) on delete cascade,
  item_id     text not null references public.catalog_items(id),
  source      text not null default 'purchase',
  acquired_at timestamptz not null default now(),
  primary key (user_id, item_id)
);

-- Append-only wallet ledger. ref makes a credit/debit idempotent per user.
create table if not exists public.wallet_ledger (
  id            bigserial primary key,
  user_id       uuid not null references public.profiles(id) on delete cascade,
  delta         bigint not null,
  balance_after bigint not null,
  kind          text not null check (kind in ('daily','earn','spend','purchase','migration','admin')),
  source        text,
  reason        text,
  ref           text,
  created_at    timestamptz not null default now()
);
create unique index if not exists wallet_ledger_user_ref on public.wallet_ledger(user_id, ref) where ref is not null;
create index if not exists wallet_ledger_user_time on public.wallet_ledger(user_id, created_at desc);

-- Per-source earning limits. source '*' = total of all game earnings per day.
create table if not exists public.earn_caps (
  source       text primary key,
  per_call_max integer not null check (per_call_max >= 0),
  daily_cap    integer not null check (daily_cap >= 0)
);
insert into public.earn_caps (source, per_call_max, daily_cap) values
  ('*',           0,   1500),
  ('coin',        5,    300),
  ('build',       1,     50),
  ('obby_finish', 100,  200),
  ('obby_stage',  50,   500),
  ('custom_game', 50,   200),
  ('other',       25,   100)
on conflict (source) do update set per_call_max = excluded.per_call_max, daily_cap = excluded.daily_cap;

create table if not exists public.earn_daily (
  user_id uuid not null references public.profiles(id) on delete cascade,
  day     date not null,
  source  text not null,
  amount  integer not null default 0,
  primary key (user_id, day, source)
);

create table if not exists public.app_config (key text primary key, value jsonb not null);
insert into public.app_config (key, value) values
  ('daily_bonus', '100'), ('spend_per_call_max', '5000'),
  ('migration_max_coins', '2000'), ('migration_max_item_price', '600'), ('migration_max_items', '30')
on conflict (key) do nothing;

create or replace function public._cfg(k text) returns bigint
language sql stable set search_path = public as $$ select (value #>> '{}')::bigint from public.app_config where key = k $$;

-- ---------- RLS: read own profile/inventory; catalog public; everything else RPC-only ----------
alter table public.catalog_items enable row level security;
alter table public.profiles      enable row level security;
alter table public.inventory     enable row level security;
alter table public.wallet_ledger enable row level security;
alter table public.earn_caps     enable row level security;
alter table public.earn_daily    enable row level security;
alter table public.app_config    enable row level security;

drop policy if exists catalog_read on public.catalog_items;
create policy catalog_read on public.catalog_items for select to anon, authenticated using (active);
drop policy if exists profiles_read_own on public.profiles;
create policy profiles_read_own on public.profiles for select to authenticated using (id = auth.uid());
drop policy if exists inventory_read_own on public.inventory;
create policy inventory_read_own on public.inventory for select to authenticated using (user_id = auth.uid());
drop policy if exists ledger_read_own on public.wallet_ledger;
create policy ledger_read_own on public.wallet_ledger for select to authenticated using (user_id = auth.uid());
drop policy if exists caps_read on public.earn_caps;
create policy caps_read on public.earn_caps for select to anon, authenticated using (true);

revoke all on public.catalog_items, public.profiles, public.inventory, public.wallet_ledger,
  public.earn_caps, public.earn_daily, public.app_config from anon, authenticated;
grant select on public.catalog_items, public.earn_caps to anon, authenticated;
grant select on public.profiles, public.inventory, public.wallet_ledger to authenticated;

-- ---------- signup: create profile from auth metadata ----------
create or replace function public._valid_username(u text) returns boolean
language sql immutable as $$
  select u ~ '^[a-z0-9_]{3,20}$'
     and u !~ '(admin|moderator|^mod_|staff|official|support|birgstaff)'
$$;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  u text := lower(coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)));
  d text := coalesce(nullif(trim(new.raw_user_meta_data->>'display_name'), ''), u);
begin
  if not public._valid_username(u) then raise exception 'invalid_username' using errcode = '22023'; end if;
  insert into public.profiles (id, username, display_name) values (new.id, u, left(d, 24));
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.username_available(p_username text) returns boolean
language sql stable security definer set search_path = public as $$
  select public._valid_username(lower(p_username))
     and not exists (select 1 from public.profiles where username = lower(p_username))
$$;

-- ---------- profile snapshot ----------
create or replace function public._profile_json(p_uid uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'playerId', p.id, 'username', p.username, 'displayName', p.display_name,
    'coins', p.coins,
    'owned', coalesce((select jsonb_agg(i.item_id order by i.acquired_at) from public.inventory i where i.user_id = p.id), '[]'::jsonb),
    'equipped', p.equipped, 'rocketColors', p.rocket_colors, 'cosmeticColors', p.cosmetic_colors,
    'gameData', p.game_data,
    'lastDailyBonus', p.last_daily_bonus,
    'buildRewardDay', public._today(),
    'buildRewardToday', coalesce((select amount from public.earn_daily e where e.user_id = p.id and e.day = public._today() and e.source = 'build'), 0),
    'migrated', p.migrated_at is not null)
  from public.profiles p where p.id = p_uid
$$;

create or replace function public.get_my_profile() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin return public._profile_json(public._uid()); end $$;

-- ---------- wallet core (internal) ----------
create or replace function public._credit(p_uid uuid, p_delta bigint, p_kind text, p_source text, p_reason text, p_ref text)
returns bigint language plpgsql security definer set search_path = public as $$
declare v_bal bigint;
begin
  update public.profiles set coins = coins + p_delta, updated_at = now()
   where id = p_uid and coins + p_delta >= 0 returning coins into v_bal;
  if v_bal is null then return null; end if;           -- insufficient funds
  insert into public.wallet_ledger (user_id, delta, balance_after, kind, source, reason, ref)
  values (p_uid, p_delta, v_bal, p_kind, p_source, left(p_reason, 80), p_ref);
  return v_bal;
end $$;

-- ---------- daily bonus ----------
create or replace function public.claim_daily_bonus() returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := public._uid(); v_amt bigint := public._cfg('daily_bonus'); v_bal bigint;
begin
  update public.profiles set last_daily_bonus = public._today()
   where id = v_uid and (last_daily_bonus is null or last_daily_bonus < public._today());
  if not found then
    return jsonb_build_object('granted', 0, 'coins', (select coins from public.profiles where id = v_uid));
  end if;
  v_bal := public._credit(v_uid, v_amt, 'daily', 'daily', 'Daily bonus', 'daily:' || public._today());
  return jsonb_build_object('granted', v_amt, 'coins', v_bal);
end $$;

-- ---------- game earnings with per-source and total daily caps ----------
create or replace function public.game_earn(p_source text, p_amount integer, p_reason text default null, p_ref text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := public._uid();
  v_src text := coalesce(p_source, 'other');
  v_cap public.earn_caps; v_total public.earn_caps;
  v_used int; v_used_total int; v_grant int; v_bal bigint; v_ref text;
begin
  select * into v_cap from public.earn_caps where source = v_src and source <> '*';
  if not found then v_src := 'other'; select * into v_cap from public.earn_caps where source = 'other'; end if;
  select * into v_total from public.earn_caps where source = '*';
  if p_amount is null or p_amount <= 0 then
    return jsonb_build_object('granted', 0, 'coins', (select coins from public.profiles where id = v_uid), 'capped', false);
  end if;
  v_ref := case when p_ref is null then null else 'earn:' || left(p_ref, 64) end;
  if v_ref is not null and exists (select 1 from public.wallet_ledger where user_id = v_uid and ref = v_ref) then
    return jsonb_build_object('granted', 0, 'coins', (select coins from public.profiles where id = v_uid), 'duplicate', true);
  end if;
  -- lock today's counters
  insert into public.earn_daily (user_id, day, source, amount) values (v_uid, public._today(), v_src, 0), (v_uid, public._today(), '*', 0)
    on conflict do nothing;
  select amount into v_used from public.earn_daily where user_id = v_uid and day = public._today() and source = v_src for update;
  select amount into v_used_total from public.earn_daily where user_id = v_uid and day = public._today() and source = '*' for update;
  v_grant := least(p_amount, v_cap.per_call_max, v_cap.daily_cap - v_used, v_total.daily_cap - v_used_total);
  if v_grant <= 0 then
    return jsonb_build_object('granted', 0, 'coins', (select coins from public.profiles where id = v_uid), 'capped', true);
  end if;
  update public.earn_daily set amount = amount + v_grant where user_id = v_uid and day = public._today() and source in (v_src, '*');
  v_bal := public._credit(v_uid, v_grant, 'earn', v_src, p_reason, v_ref);
  return jsonb_build_object('granted', v_grant, 'coins', v_bal, 'capped', v_grant < p_amount);
end $$;

create or replace function public.game_spend(p_amount integer, p_reason text default null, p_ref text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_uid uuid := public._uid(); v_bal bigint; v_ref text;
begin
  if p_amount is null or p_amount <= 0 or p_amount > public._cfg('spend_per_call_max') then
    return jsonb_build_object('ok', false, 'reason', 'invalid_amount', 'coins', (select coins from public.profiles where id = v_uid));
  end if;
  v_ref := case when p_ref is null then null else 'spend:' || left(p_ref, 64) end;
  if v_ref is not null and exists (select 1 from public.wallet_ledger where user_id = v_uid and ref = v_ref) then
    return jsonb_build_object('ok', true, 'duplicate', true, 'coins', (select coins from public.profiles where id = v_uid));
  end if;
  v_bal := public._credit(v_uid, -p_amount, 'spend', 'game', p_reason, v_ref);
  if v_bal is null then
    return jsonb_build_object('ok', false, 'reason', 'insufficient_funds', 'coins', (select coins from public.profiles where id = v_uid));
  end if;
  return jsonb_build_object('ok', true, 'coins', v_bal);
end $$;

-- ---------- cosmetics ----------
create or replace function public.buy_cosmetic(p_item_id text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := public._uid(); v_item public.catalog_items; v_bal bigint;
begin
  select * into v_item from public.catalog_items where id = p_item_id and active;
  if not found then return jsonb_build_object('ok', false, 'reason', 'unknown_item'); end if;
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

-- Validate + store equipped / rocketColors / cosmeticColors. NULL argument = leave unchanged.
create or replace function public._clean_equipped(p_uid uuid, p_equipped jsonb) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_object_agg(c.slot, c.id), '{}'::jsonb)
  from jsonb_each_text(case when jsonb_typeof(p_equipped) = 'object' then p_equipped else '{}'::jsonb end) e(slot, item)
  join public.catalog_items c on c.id = e.item and c.slot = e.slot
  join public.inventory i on i.user_id = p_uid and i.item_id = c.id
$$;

create or replace function public._clean_rocket_colors(p jsonb, fallback jsonb) returns jsonb
language sql immutable as $$
  select fallback || coalesce((select jsonb_object_agg(k, v) from jsonb_each_text(case when jsonb_typeof(p) = 'object' then p else '{}'::jsonb end) e(k, v)
    where k in ('body','fins','trim') and public._is_hex_color(v)), '{}'::jsonb)
$$;

create or replace function public._clean_cosmetic_colors(p jsonb) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_object_agg(e.k, e.v), '{}'::jsonb)
  from jsonb_each_text(case when jsonb_typeof(p) = 'object' then p else '{}'::jsonb end) e(k, v)
  join public.catalog_items c on c.id = e.k
  where public._is_hex_color(e.v)
$$;

create or replace function public.save_loadout(p_equipped jsonb default null, p_rocket_colors jsonb default null, p_cosmetic_colors jsonb default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_uid uuid := public._uid();
begin
  update public.profiles set
    equipped        = case when p_equipped is null then equipped else public._clean_equipped(v_uid, p_equipped) end,
    rocket_colors   = case when p_rocket_colors is null then rocket_colors else public._clean_rocket_colors(p_rocket_colors, rocket_colors) end,
    cosmetic_colors = case when p_cosmetic_colors is null then cosmetic_colors else cosmetic_colors || public._clean_cosmetic_colors(p_cosmetic_colors) end,
    updated_at = now()
  where id = v_uid;
  return (select jsonb_build_object('equipped', equipped, 'rocketColors', rocket_colors, 'cosmeticColors', cosmetic_colors) from public.profiles where id = v_uid);
end $$;

-- Per-game save blobs (e.g. Giant Rainbow Obby progress). Size limited; never money.
create or replace function public.save_game_data(p_game_id text, p_data jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := public._uid(); v_gd jsonb;
begin
  if p_game_id !~ '^[a-zA-Z0-9_-]{1,40}$' then return jsonb_build_object('ok', false, 'reason', 'invalid_game'); end if;
  if octet_length(coalesce(p_data, 'null'::jsonb)::text) > 8192 then return jsonb_build_object('ok', false, 'reason', 'too_large'); end if;
  select game_data into v_gd from public.profiles where id = v_uid for update;
  if not (v_gd ? p_game_id) and (select count(*) from jsonb_object_keys(v_gd)) >= 32 then
    return jsonb_build_object('ok', false, 'reason', 'too_many_games');
  end if;
  update public.profiles set game_data = game_data || jsonb_build_object(p_game_id, p_data), updated_at = now() where id = v_uid;
  return jsonb_build_object('ok', true);
end $$;

-- ---------- one-time import of a guest (localStorage) profile on first login ----------
-- Safe by construction: coins = local coins minus demo grants, capped; only cheap,
-- non-premium catalog items carry over; equipped/colors re-validated; runs once.
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
    game_data = case when jsonb_typeof(p_local->'gameData') = 'object' and octet_length((p_local->'gameData')::text) <= 16384 then p_local->'gameData' else game_data end,
    updated_at = now()
  where id = v_uid;
  if v_coins > 0 then v_bal := public._credit(v_uid, v_coins, 'migration', 'guest', 'Guest progress import', 'migration'); end if;
  return jsonb_build_object('ok', true, 'coins', v_coins, 'items', to_jsonb(v_items), 'profile', public._profile_json(v_uid));
end $$;

-- ---------- function privileges: authenticated only (username_available also anon) ----------
-- Supabase grants EXECUTE on new public functions to anon/authenticated by default,
-- so revoke everything first, then allow only the API surface.
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function public.get_my_profile(), public.claim_daily_bonus(),
  public.game_earn(text, integer, text, text), public.game_spend(integer, text, text),
  public.buy_cosmetic(text), public.save_loadout(jsonb, jsonb, jsonb), public.save_game_data(text, jsonb),
  public.migrate_local_profile(jsonb) to authenticated;
grant execute on function public.username_available(text) to anon, authenticated;
