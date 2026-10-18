-- 0011: multiplayer game-state API support (feature/mp-gameplay). Additive: replaces 3 functions from 0007, no tables or data.
--   _mp_roster:   each roster entry gains joinedAt; order = joined_at, username (host = earliest present player)
--   mp_join:      response gains serverNow (client clock offset for mp.now())
--   mp_heartbeat: response gains serverNow
-- Older clients ignore the extra fields. Grants from 0007 are kept (create or replace).
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

