-- Multiplayer (additive): game server instances with a player cap, friend joins, trusted rosters,
-- a project-wide Realtime message budget, and Realtime Authorization for private game channels.
-- Movement/animation travel over Supabase Realtime broadcast (cosmetic only, never trusted).
-- Chat stays post_chat/get_chat (phrase ids, validated + rate-limited here). No player rows are modified.

insert into public.app_config (key, value) values
  ('mp_instance_cap', '12'),        -- players per game server instance
  ('mp_member_ttl_s', '45'),        -- a member counts while their heartbeat is newer than this
  ('mp_msg_budget', '60')           -- Realtime events/sec we allow ourselves project-wide (free plan: 100)
on conflict (key) do nothing;

-- chat rooms may now be per instance: game:<gameId>:<instance>
create or replace function public._valid_room(r text) returns boolean
language sql immutable as $$ select r = 'lobby' or r ~ '^game:[a-zA-Z0-9_-]{1,40}(:[0-9]{1,4})?$' $$;

create table if not exists public.mp_members (
  user_id     uuid primary key references public.profiles(id) on delete cascade,   -- one row per player: tiny table
  game_id     text not null check (game_id ~ '^[a-zA-Z0-9_-]{1,40}$'),
  instance_id integer not null check (instance_id between 1 and 9999),
  joined_at   timestamptz not null default now(),
  last_seen   timestamptz not null default now()
);
create index if not exists mp_members_game_idx on public.mp_members (game_id, instance_id, last_seen);
alter table public.mp_members enable row level security;
revoke all on public.mp_members from anon, authenticated;     -- RPC-only

create or replace function public._mp_topic(g text, i int) returns text
language sql immutable as $$ select 'game:' || g || ':' || i $$;

-- Recommended per-client send rate so that sum over instances of N^2 * hz stays under the budget
-- (every broadcast is 1 event sent + N-1 events delivered; Realtime counts both).
create or replace function public._mp_send_hz() returns numeric
language sql stable security definer set search_path = public as $$
  with c as (select count(*)::numeric n from public.mp_members
             where last_seen > now() - make_interval(secs => public._cfg('mp_member_ttl_s')) group by game_id, instance_id)
  select round(least(10, greatest(1, public._cfg('mp_msg_budget') / greatest(1, coalesce((select sum(n * n) from c), 1))))::numeric, 1)
$$;

create or replace function public._mp_roster(g text, i int) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(public._public_player(p) || jsonb_build_object('joinedAt', m.joined_at) order by m.joined_at, p.username), '[]'::jsonb)   -- joinedAt: host = earliest present
  from public.mp_members m join public.profiles p on p.id = m.user_id
  where m.game_id = g and m.instance_id = i and m.last_seen > now() - make_interval(secs => public._cfg('mp_member_ttl_s'))
$$;

-- Pick (or create) an instance with room. p_friend = username to join (must be an accepted friend).
create or replace function public.mp_join(p_game_id text, p_friend text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := public._uid(); v_cap int := public._cfg('mp_instance_cap'); v_ttl int := public._cfg('mp_member_ttl_s');
  v_inst int; v_friend uuid; v_note text := null; v_n int;
begin
  if v_uid is null then raise exception 'not_signed_in' using errcode = '42501'; end if;
  if p_game_id is null or p_game_id !~ '^[a-zA-Z0-9_-]{1,40}$' then return jsonb_build_object('ok', false, 'reason', 'invalid_game'); end if;
  perform pg_advisory_xact_lock(hashtext('mp:' || p_game_id));      -- serialize joins per game: the cap can't be raced
  if p_friend is not null then
    select p.id into v_friend from public.profiles p where p.username = lower(p_friend);
    if v_friend is null or not exists (select 1 from public.friendships f where f.status = 'accepted'
         and f.user_a = least(v_uid, v_friend) and f.user_b = greatest(v_uid, v_friend)) then
      v_note := 'not_friends';
    else
      select m.instance_id into v_inst from public.mp_members m
        where m.user_id = v_friend and m.game_id = p_game_id and m.last_seen > now() - make_interval(secs => v_ttl);
      if v_inst is null then v_note := 'friend_not_here';
      else
        select count(*) into v_n from public.mp_members m where m.game_id = p_game_id and m.instance_id = v_inst
          and m.user_id <> v_uid and m.last_seen > now() - make_interval(secs => v_ttl);
        if v_n >= v_cap then v_note := 'friend_full'; v_inst := null; end if;
      end if;
    end if;
  end if;
  if v_inst is null then   -- stay where I am (reload), else the fullest instance with room, else a new one
    select m.instance_id into v_inst from public.mp_members m where m.user_id = v_uid and m.game_id = p_game_id
      and m.last_seen > now() - make_interval(secs => v_ttl)
      and (select count(*) from public.mp_members o where o.game_id = p_game_id and o.instance_id = m.instance_id
           and o.user_id <> v_uid and o.last_seen > now() - make_interval(secs => v_ttl)) < v_cap;
  end if;
  if v_inst is null then
    with c as (select m.instance_id i, count(*) n from public.mp_members m
               where m.game_id = p_game_id and m.user_id <> v_uid and m.last_seen > now() - make_interval(secs => v_ttl) group by 1)
    select s.i into v_inst from generate_series(1, coalesce((select max(i) from c), 0) + 1) s(i) left join c on c.i = s.i
      where coalesce(c.n, 0) < v_cap order by coalesce(c.n, 0) desc, s.i limit 1;
  end if;
  insert into public.mp_members (user_id, game_id, instance_id, joined_at, last_seen) values (v_uid, p_game_id, v_inst, now(), now())
    on conflict (user_id) do update set game_id = excluded.game_id, instance_id = excluded.instance_id, last_seen = now(),
      joined_at = case when public.mp_members.game_id = excluded.game_id and public.mp_members.instance_id = excluded.instance_id
                       then public.mp_members.joined_at else now() end;
  return jsonb_build_object('ok', true, 'serverNow', now(), 'gameId', p_game_id, 'instance', v_inst, 'topic', public._mp_topic(p_game_id, v_inst),
    'cap', v_cap, 'sendHz', public._mp_send_hz(), 'note', v_note, 'roster', public._mp_roster(p_game_id, v_inst));
end $$;

-- Keep my membership alive (~every 20 s). Returns the trusted roster + current send rate.
create or replace function public.mp_heartbeat(p_game_id text, p_instance int) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := public._uid();
begin
  update public.mp_members set last_seen = now() where user_id = v_uid and game_id = p_game_id and instance_id = p_instance;
  if not found then return jsonb_build_object('ok', false, 'reason', 'rejoin'); end if;
  return jsonb_build_object('ok', true, 'serverNow', now(), 'sendHz', public._mp_send_hz(), 'roster', public._mp_roster(p_game_id, p_instance));
end $$;

create or replace function public.mp_leave() returns void
language sql security definer set search_path = public as $$ delete from public.mp_members where user_id = public._uid() $$;

-- Friends currently in a game server (for "Join friend" on the portal).
create or replace function public.friends_playing() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('username', p.username, 'displayName', p.display_name, 'gameId', m.game_id,
      'instance', m.instance_id,
      'full', (select count(*) from public.mp_members o where o.game_id = m.game_id and o.instance_id = m.instance_id
               and o.last_seen > now() - make_interval(secs => public._cfg('mp_member_ttl_s'))) >= public._cfg('mp_instance_cap'))
    order by p.username), '[]'::jsonb)
  from public.friendships f
  join public.profiles p on p.id = case when f.user_a = public._uid() then f.user_b else f.user_a end
  join public.mp_members m on m.user_id = p.id and m.last_seen > now() - make_interval(secs => public._cfg('mp_member_ttl_s'))
  where f.status = 'accepted' and public._uid() in (f.user_a, f.user_b)
$$;

revoke execute on function public._mp_topic(text, int), public._mp_send_hz(), public._mp_roster(text, int),
  public.mp_join(text, text), public.mp_heartbeat(text, int), public.mp_leave(), public.friends_playing()
  from public, anon, authenticated;
grant execute on function public.mp_join(text, text), public.mp_heartbeat(text, int), public.mp_leave(), public.friends_playing() to authenticated;

-- Realtime Authorization: a private channel game:<gameId>:<instance> may be joined / used (broadcast + presence)
-- only by signed-in players who are current members of that instance (so the cap holds on the socket too).
create or replace function public.mp_can_use_topic(p_topic text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.mp_members m where m.user_id = auth.uid()   -- auth.uid(): anon -> false, no exception
    and public._mp_topic(m.game_id, m.instance_id) = p_topic
    and m.last_seen > now() - make_interval(secs => public._cfg('mp_member_ttl_s')))
$$;
revoke execute on function public.mp_can_use_topic(text) from public, anon;
grant execute on function public.mp_can_use_topic(text) to authenticated;

do $rt$ begin
  if to_regclass('realtime.messages') is not null then
    execute 'drop policy if exists iceberg_mp_read on realtime.messages';
    execute 'drop policy if exists iceberg_mp_write on realtime.messages';
    execute $p$create policy iceberg_mp_read on realtime.messages for select to authenticated
      using (realtime.messages.extension in ('broadcast', 'presence') and realtime.topic() like 'game:%' and public.mp_can_use_topic(realtime.topic()))$p$;
    execute $p$create policy iceberg_mp_write on realtime.messages for insert to authenticated
      with check (realtime.messages.extension in ('broadcast', 'presence') and realtime.topic() like 'game:%' and public.mp_can_use_topic(realtime.topic()))$p$;
  end if;
end $rt$;
