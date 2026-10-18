-- Safe Chat: players can only send phrases from a fixed, reviewed catalog
-- (synced from src/data/safeChat.js). No free text ever reaches the database.

create table if not exists public.chat_phrases (
  id         text primary key check (id ~ '^[a-z0-9_.-]{1,64}$'),
  section    text not null,
  text       text not null check (char_length(text) between 1 and 80),
  active     boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists public.chat_messages (
  id         bigserial primary key,
  room       text not null,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  phrase_id  text not null references public.chat_phrases(id),
  created_at timestamptz not null default now()
);
create index if not exists chat_messages_room_id on public.chat_messages(room, id desc);
create index if not exists chat_messages_user_time on public.chat_messages(user_id, created_at desc);

create table if not exists public.chat_presence (
  user_id   uuid not null references public.profiles(id) on delete cascade,
  room      text not null,
  last_seen timestamptz not null default now(),
  primary key (user_id, room)
);

insert into public.app_config (key, value) values
  ('chat_min_interval_ms', '2000'), ('chat_max_per_minute', '10'), ('chat_presence_ttl_s', '30')
on conflict (key) do nothing;

alter table public.chat_phrases  enable row level security;
alter table public.chat_messages enable row level security;
alter table public.chat_presence enable row level security;
drop policy if exists phrases_read on public.chat_phrases;
create policy phrases_read on public.chat_phrases for select to anon, authenticated using (active);
revoke all on public.chat_phrases, public.chat_messages, public.chat_presence from anon, authenticated;
grant select on public.chat_phrases to anon, authenticated;

create or replace function public._valid_room(r text) returns boolean
language sql immutable as $$ select r = 'lobby' or r ~ '^game:[a-zA-Z0-9_-]{1,40}$' $$;

create or replace function public._public_player(p public.profiles) returns jsonb
language sql stable as $$
  select jsonb_build_object('username', p.username, 'displayName', p.display_name,
    'equipped', p.equipped, 'rocketColors', p.rocket_colors, 'cosmeticColors', p.cosmetic_colors)
$$;

create or replace function public.post_chat(p_room text, p_phrase_id text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := public._uid(); v_p public.profiles; v_text text; v_last timestamptz; v_n int; v_id bigint;
  v_gap_ms bigint := public._cfg('chat_min_interval_ms'); v_max int := public._cfg('chat_max_per_minute');
begin
  if not public._valid_room(p_room) then return jsonb_build_object('ok', false, 'reason', 'invalid_room'); end if;
  select text into v_text from public.chat_phrases where id = p_phrase_id and active;
  if v_text is null then return jsonb_build_object('ok', false, 'reason', 'invalid_phrase'); end if;
  select * into v_p from public.profiles where id = v_uid for update;     -- serializes this user's posts
  if v_p.chat_muted_until is not null and v_p.chat_muted_until > now() then
    return jsonb_build_object('ok', false, 'reason', 'muted', 'retryAfterMs', ceil(extract(epoch from (v_p.chat_muted_until - now())) * 1000));
  end if;
  select max(created_at) into v_last from public.chat_messages where user_id = v_uid;
  if v_last is not null and now() - v_last < make_interval(secs => v_gap_ms / 1000.0) then
    return jsonb_build_object('ok', false, 'reason', 'rate_limited',
      'retryAfterMs', ceil(v_gap_ms - extract(epoch from (now() - v_last)) * 1000));
  end if;
  select count(*) into v_n from public.chat_messages where user_id = v_uid and created_at > now() - interval '1 minute';
  if v_n >= v_max then return jsonb_build_object('ok', false, 'reason', 'rate_limited', 'retryAfterMs', 60000); end if;
  insert into public.chat_messages (room, user_id, phrase_id) values (p_room, v_uid, p_phrase_id) returning id into v_id;
  insert into public.chat_presence (user_id, room, last_seen) values (v_uid, p_room, now())
    on conflict (user_id, room) do update set last_seen = now();
  return jsonb_build_object('ok', true, 'id', v_id, 'phraseId', p_phrase_id, 'text', v_text);
end $$;

-- Recent messages (newest 50 after p_after_id), oldest first.
create or replace function public.get_chat(p_room text, p_after_id bigint default 0) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_uid uuid := public._uid();
begin
  if not public._valid_room(p_room) then return '[]'::jsonb; end if;
  return coalesce((select jsonb_agg(m order by (m->>'id')::bigint) from (
    select jsonb_build_object('id', c.id, 'username', p.username, 'displayName', p.display_name,
      'phraseId', c.phrase_id, 'text', ph.text, 'at', c.created_at, 'mine', c.user_id = v_uid) m
    from public.chat_messages c join public.profiles p on p.id = c.user_id join public.chat_phrases ph on ph.id = c.phrase_id
    where c.room = p_room and c.id > coalesce(p_after_id, 0) and c.created_at > now() - interval '1 hour'
    order by c.id desc limit 50) t), '[]'::jsonb);
end $$;

-- Mark me present in a room; returns everyone seen in the last TTL seconds (public avatar info only).
create or replace function public.chat_heartbeat(p_room text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := public._uid(); v_ttl bigint := public._cfg('chat_presence_ttl_s');
begin
  if not public._valid_room(p_room) then return '[]'::jsonb; end if;
  insert into public.chat_presence (user_id, room, last_seen) values (v_uid, p_room, now())
    on conflict (user_id, room) do update set last_seen = now();
  return coalesce((select jsonb_agg(public._public_player(p) || jsonb_build_object('me', p.id = v_uid) order by p.username)
    from public.chat_presence cp join public.profiles p on p.id = cp.user_id
    where cp.room = p_room and cp.last_seen > now() - make_interval(secs => v_ttl)), '[]'::jsonb);
end $$;

create or replace function public.chat_leave(p_room text) returns void
language sql security definer set search_path = public as $$
  delete from public.chat_presence where user_id = public._uid() and room = p_room
$$;

revoke execute on function public._valid_room(text), public._public_player(public.profiles),
  public.post_chat(text, text), public.get_chat(text, bigint), public.chat_heartbeat(text), public.chat_leave(text)
  from public, anon, authenticated;
grant execute on function public.post_chat(text, text), public.get_chat(text, bigint),
  public.chat_heartbeat(text), public.chat_leave(text) to authenticated;
