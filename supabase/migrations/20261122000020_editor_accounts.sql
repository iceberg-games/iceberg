-- Editor Update (accounts drop): date of birth, deactivate/delete account, device sessions.
-- Additive only. Do not apply this to production from the client; report and apply via the usual migration path.

-- ---------- profile fields ----------
alter table public.profiles
  add column if not exists date_of_birth date,
  add column if not exists deactivated_at timestamptz;

alter table public.profiles
  drop constraint if exists profiles_date_of_birth_range;
alter table public.profiles
  add constraint profiles_date_of_birth_range
  check (date_of_birth is null or (date_of_birth >= date '1900-01-01' and date_of_birth <= public._today()));

-- Signup trigger: store date_of_birth from auth metadata when it is a valid past date.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  u text := lower(coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)));
  d text := coalesce(nullif(trim(new.raw_user_meta_data->>'display_name'), ''), u);
  v_dob date := null;
begin
  if not public._valid_username(u) then raise exception 'invalid_username' using errcode = '22023'; end if;
  begin
    if nullif(trim(new.raw_user_meta_data->>'date_of_birth'), '') is not null then
      v_dob := (new.raw_user_meta_data->>'date_of_birth')::date;
      if v_dob > public._today() or v_dob < date '1900-01-01' then v_dob := null; end if;
    end if;
  exception when others then
    v_dob := null;
  end;
  insert into public.profiles (id, username, display_name, date_of_birth) values (new.id, u, left(d, 24), v_dob);
  return new;
end $$;

-- Keep the 0004 snapshot shape and add dateOfBirth + deactivated.
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
    'migrated', p.migrated_at is not null,
    'dateOfBirth', p.date_of_birth,
    'deactivated', p.deactivated_at is not null)
  from public.profiles p where p.id = p_uid
$$;

-- Signing in again clears a deactivation (reversible). This writes, so it is no longer stable.
create or replace function public.get_my_profile() returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := public._uid();
begin
  update public.profiles set deactivated_at = null, updated_at = now()
   where id = v_uid and deactivated_at is not null;
  return public._profile_json(v_uid);
end $$;

create or replace function public.set_date_of_birth(p_dob date) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := public._uid();
begin
  if p_dob is null or p_dob > public._today() or p_dob < date '1900-01-01' then
    return jsonb_build_object('ok', false, 'reason', 'invalid_date');
  end if;
  update public.profiles set date_of_birth = p_dob, updated_at = now() where id = v_uid;
  return jsonb_build_object('ok', true, 'dateOfBirth', p_dob, 'profile', public._profile_json(v_uid));
end $$;

create or replace function public.deactivate_account() returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := public._uid();
begin
  update public.profiles set deactivated_at = now(), updated_at = now()
   where id = v_uid and deactivated_at is null;
  return jsonb_build_object('ok', true, 'deactivated', true);
end $$;

-- Permanent delete: remove the auth user so the profile (and children) cascade away.
create or replace function public.delete_account() returns jsonb
language plpgsql security definer set search_path = public, auth as $$
declare v_uid uuid := public._uid();
begin
  delete from auth.users where id = v_uid;
  return jsonb_build_object('ok', true, 'deleted', true);
end $$;

-- ---------- device sessions (GoTrue cannot list sessions for our custom client) ----------
create table if not exists public.account_sessions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  client_id     text not null check (char_length(client_id) between 8 and 80),
  user_agent    text,
  device_label  text,
  created_at    timestamptz not null default now(),
  last_active   timestamptz not null default now(),
  revoked_at    timestamptz,
  unique (user_id, client_id)
);
create index if not exists account_sessions_user_active
  on public.account_sessions (user_id, last_active desc)
  where revoked_at is null;

alter table public.account_sessions enable row level security;
drop policy if exists account_sessions_read_own on public.account_sessions;
-- RPC-only writes; users may read their own rows if needed.
create policy account_sessions_read_own on public.account_sessions
  for select to authenticated using (user_id = auth.uid());

revoke all on public.account_sessions from anon, authenticated;
grant select on public.account_sessions to authenticated;

create or replace function public._session_json(s public.account_sessions) returns jsonb
language sql immutable as $$
  select jsonb_build_object(
    'id', s.id,
    'clientId', s.client_id,
    'deviceLabel', coalesce(nullif(s.device_label, ''), 'Unknown device'),
    'userAgent', s.user_agent,
    'createdAt', s.created_at,
    'lastActive', s.last_active)
$$;

create or replace function public.register_account_session(p_client_id text, p_user_agent text default null, p_device_label text default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := public._uid();
  v_row public.account_sessions;
begin
  if p_client_id is null or char_length(p_client_id) < 8 or char_length(p_client_id) > 80 then
    return jsonb_build_object('ok', false, 'reason', 'invalid_client');
  end if;
  insert into public.account_sessions (user_id, client_id, user_agent, device_label)
  values (v_uid, p_client_id, left(coalesce(p_user_agent, ''), 300), left(coalesce(p_device_label, ''), 80))
  on conflict (user_id, client_id) do update set
    user_agent = excluded.user_agent,
    device_label = excluded.device_label,
    last_active = now(),
    revoked_at = null
  returning * into v_row;
  return jsonb_build_object('ok', true, 'session', public._session_json(v_row));
end $$;

create or replace function public.heartbeat_account_session(p_client_id text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := public._uid();
  v_row public.account_sessions;
begin
  select * into v_row from public.account_sessions
   where user_id = v_uid and client_id = p_client_id;
  if not found then return jsonb_build_object('ok', false, 'reason', 'unknown'); end if;
  if v_row.revoked_at is not null then return jsonb_build_object('ok', false, 'reason', 'revoked'); end if;
  update public.account_sessions set last_active = now() where id = v_row.id returning * into v_row;
  return jsonb_build_object('ok', true, 'session', public._session_json(v_row));
end $$;

create or replace function public.list_account_sessions() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_uid uuid := public._uid();
begin
  return coalesce((
    select jsonb_agg(public._session_json(s) order by s.last_active desc)
    from public.account_sessions s
    where s.user_id = v_uid and s.revoked_at is null
  ), '[]'::jsonb);
end $$;

create or replace function public.revoke_account_session(p_session_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := public._uid(); v_id uuid;
begin
  update public.account_sessions
     set revoked_at = now()
   where user_id = v_uid and id = p_session_id and revoked_at is null
  returning id into v_id;
  if v_id is null then return jsonb_build_object('ok', false, 'reason', 'not_found'); end if;
  return jsonb_build_object('ok', true, 'id', v_id);
end $$;

create or replace function public.revoke_other_account_sessions(p_client_id text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := public._uid(); v_n int;
begin
  update public.account_sessions
     set revoked_at = now()
   where user_id = v_uid and revoked_at is null
     and client_id is distinct from p_client_id;
  get diagnostics v_n = row_count;
  return jsonb_build_object('ok', true, 'revoked', v_n);
end $$;

grant execute on function public.set_date_of_birth(date) to authenticated;
grant execute on function public.deactivate_account() to authenticated;
grant execute on function public.delete_account() to authenticated;
grant execute on function public.register_account_session(text, text, text) to authenticated;
grant execute on function public.heartbeat_account_session(text) to authenticated;
grant execute on function public.list_account_sessions() to authenticated;
grant execute on function public.revoke_account_session(uuid) to authenticated;
grant execute on function public.revoke_other_account_sessions(text) to authenticated;
-- get_my_profile was already granted in 0001; re-grant in case the signature change needs it.
grant execute on function public.get_my_profile() to authenticated;
