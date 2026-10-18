-- Friends: requests by exact username only (no search/browse), accept/decline/remove.
create table if not exists public.friendships (
  user_a       uuid not null references public.profiles(id) on delete cascade,
  user_b       uuid not null references public.profiles(id) on delete cascade,
  requested_by uuid not null references public.profiles(id) on delete cascade,
  status       text not null default 'pending' check (status in ('pending','accepted')),
  created_at   timestamptz not null default now(),
  accepted_at  timestamptz,
  primary key (user_a, user_b),
  check (user_a < user_b),
  check (requested_by in (user_a, user_b))
);
create index if not exists friendships_b on public.friendships(user_b);
alter table public.friendships enable row level security;
revoke all on public.friendships from anon, authenticated;

insert into public.app_config (key, value) values ('max_friends', '100'), ('max_pending_out', '20')
on conflict (key) do nothing;

create or replace function public._user_by_name(p_username text) returns uuid
language sql stable security definer set search_path = public as $$ select id from public.profiles where username = lower(p_username) $$;

create or replace function public.send_friend_request(p_username text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_me uuid := public._uid(); v_them uuid := public._user_by_name(p_username);
  v_a uuid; v_b uuid; v_f public.friendships;
begin
  if v_them is null then return jsonb_build_object('ok', false, 'reason', 'no_such_user'); end if;
  if v_them = v_me then return jsonb_build_object('ok', false, 'reason', 'self'); end if;
  v_a := least(v_me, v_them); v_b := greatest(v_me, v_them);
  select * into v_f from public.friendships where user_a = v_a and user_b = v_b for update;
  if found then
    if v_f.status = 'accepted' then return jsonb_build_object('ok', true, 'status', 'friends'); end if;
    if v_f.requested_by = v_me then return jsonb_build_object('ok', true, 'status', 'pending'); end if;
    update public.friendships set status = 'accepted', accepted_at = now() where user_a = v_a and user_b = v_b;  -- they asked me first
    return jsonb_build_object('ok', true, 'status', 'friends');
  end if;
  if (select count(*) from public.friendships where requested_by = v_me and status = 'pending') >= public._cfg('max_pending_out') then
    return jsonb_build_object('ok', false, 'reason', 'too_many_pending');
  end if;
  if (select count(*) from public.friendships where status = 'accepted' and v_me in (user_a, user_b)) >= public._cfg('max_friends') then
    return jsonb_build_object('ok', false, 'reason', 'too_many_friends');
  end if;
  insert into public.friendships (user_a, user_b, requested_by) values (v_a, v_b, v_me);
  return jsonb_build_object('ok', true, 'status', 'pending');
end $$;

create or replace function public.respond_friend_request(p_username text, p_accept boolean) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_me uuid := public._uid(); v_them uuid := public._user_by_name(p_username);
begin
  if v_them is null then return jsonb_build_object('ok', false, 'reason', 'no_such_user'); end if;
  if p_accept then
    update public.friendships set status = 'accepted', accepted_at = now()
     where user_a = least(v_me, v_them) and user_b = greatest(v_me, v_them) and status = 'pending' and requested_by = v_them;
  else
    delete from public.friendships
     where user_a = least(v_me, v_them) and user_b = greatest(v_me, v_them) and status = 'pending' and requested_by = v_them;
  end if;
  if not found then return jsonb_build_object('ok', false, 'reason', 'no_request'); end if;
  return jsonb_build_object('ok', true, 'status', case when p_accept then 'friends' else 'declined' end);
end $$;

create or replace function public.remove_friend(p_username text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_me uuid := public._uid(); v_them uuid := public._user_by_name(p_username);
begin
  delete from public.friendships where user_a = least(v_me, v_them) and user_b = greatest(v_me, v_them);
  return jsonb_build_object('ok', found);
end $$;

create or replace function public.list_friends() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_me uuid := public._uid(); v_ttl bigint := public._cfg('chat_presence_ttl_s');
begin
  return (with f as (
      select fr.*, case when fr.user_a = v_me then fr.user_b else fr.user_a end as other
      from public.friendships fr where v_me in (fr.user_a, fr.user_b))
    select jsonb_build_object(
      'friends',  coalesce(jsonb_agg(x.j order by x.j->>'username') filter (where x.status = 'accepted'), '[]'::jsonb),
      'incoming', coalesce(jsonb_agg(x.j order by x.j->>'username') filter (where x.status = 'pending' and x.requested_by <> v_me), '[]'::jsonb),
      'outgoing', coalesce(jsonb_agg(x.j order by x.j->>'username') filter (where x.status = 'pending' and x.requested_by = v_me), '[]'::jsonb))
    from (select f.status, f.requested_by,
            jsonb_build_object('username', p.username, 'displayName', p.display_name,
              'online', exists (select 1 from public.chat_presence cp where cp.user_id = p.id and cp.last_seen > now() - make_interval(secs => v_ttl))) j
          from f join public.profiles p on p.id = f.other) x);
end $$;

revoke execute on function public._user_by_name(text), public.send_friend_request(text),
  public.respond_friend_request(text, boolean), public.remove_friend(text), public.list_friends()
  from public, anon, authenticated;
grant execute on function public.send_friend_request(text), public.respond_friend_request(text, boolean),
  public.remove_friend(text), public.list_friends() to authenticated;
