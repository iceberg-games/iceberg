-- Portal game tabs: Newest (published_at), Most Popular (deduped visits in the last
-- 7 days from daily buckets; ties: all-time visits, then newest),
-- Most Active Players (heartbeat in the last 90 s). Additive only.

create table if not exists public.games (
  game_id      text primary key check (game_id ~ '^[a-zA-Z0-9_-]{1,40}$'),
  published_at timestamptz not null,
  active       boolean not null default true,
  visits       bigint not null default 0,
  updated_at   timestamptz not null default now()
);

-- Daily visit buckets (UTC days). Never deleted: player-facing history.
create table if not exists public.game_visit_days (
  game_id text not null references public.games(game_id) on delete cascade,
  day     date not null,
  count   bigint not null default 0 check (count >= 0),
  primary key (game_id, day)
);

-- one row per (user, game): last counted visit, for de-duplication
create table if not exists public.game_visit_last (
  user_id  uuid not null references public.profiles(id) on delete cascade,
  game_id  text not null references public.games(game_id) on delete cascade,
  last_at  timestamptz not null,
  primary key (user_id, game_id)
);

-- one row per user: what they are playing right now (upserted by game_heartbeat)
create table if not exists public.game_presence (
  user_id   uuid primary key references public.profiles(id) on delete cascade,
  game_id   text not null references public.games(game_id) on delete cascade,
  last_seen timestamptz not null default now()
);
create index if not exists game_presence_game_seen on public.game_presence(game_id, last_seen);

insert into public.app_config (key, value) values ('visit_dedupe_minutes', '30'), ('live_window_s', '90')
on conflict (key) do nothing;

alter table public.games enable row level security;
alter table public.game_visit_last enable row level security;
alter table public.game_presence enable row level security;
alter table public.game_visit_days enable row level security;
drop policy if exists games_read on public.games;
create policy games_read on public.games for select to anon, authenticated using (active);
revoke all on public.games, public.game_visit_last, public.game_presence, public.game_visit_days from anon, authenticated;
grant select on public.games to anon, authenticated;

-- Live counts (no per-user data exposed).
create or replace view public.game_live_counts with (security_invoker = false) as
  select g.game_id, count(p.user_id)::int as playing
  from public.games g
  left join public.game_presence p on p.game_id = g.game_id
    and p.last_seen > now() - make_interval(secs => (select (value #>> '{}')::int from public.app_config where key = 'live_window_s'))
  where g.active
  group by g.game_id;
revoke all on public.game_live_counts from anon, authenticated;

-- Rolling 7-day plays (today + previous 6 UTC days) and all-time totals.
create or replace view public.game_popularity with (security_invoker = false) as
  select g.game_id, g.visits as visits_all,
         coalesce((select sum(d.count) from public.game_visit_days d
                    where d.game_id = g.game_id and d.day > public._today() - 7), 0)::bigint as visits_7d
  from public.games g where g.active;
revoke all on public.game_popularity from anon, authenticated;

create or replace function public.record_visit(p_game_id text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := public._uid(); v_win interval := make_interval(mins => public._cfg('visit_dedupe_minutes')::int); v_counted boolean := false;
begin
  if not exists (select 1 from public.games where game_id = p_game_id and active) then return jsonb_build_object('ok', false, 'reason', 'unknown_game'); end if;
  insert into public.game_visit_last (user_id, game_id, last_at) values (v_uid, p_game_id, now())
  on conflict (user_id, game_id) do update set last_at = now()
    where game_visit_last.last_at < now() - v_win
  returning true into v_counted;
  if coalesce(v_counted, false) then
    update public.games set visits = visits + 1 where game_id = p_game_id;
    insert into public.game_visit_days (game_id, day, count) values (p_game_id, public._today(), 1)
      on conflict (game_id, day) do update set count = game_visit_days.count + 1;
  end if;
  return jsonb_build_object('ok', true, 'counted', coalesce(v_counted, false), 'visits', (select visits from public.games where game_id = p_game_id));
end $$;

create or replace function public.game_heartbeat(p_game_id text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := public._uid();
begin
  if not exists (select 1 from public.games where game_id = p_game_id and active) then return jsonb_build_object('ok', false, 'reason', 'unknown_game'); end if;
  insert into public.game_presence (user_id, game_id, last_seen) values (v_uid, p_game_id, now())
    on conflict (user_id) do update set game_id = excluded.game_id, last_seen = now();
  return jsonb_build_object('ok', true, 'playing', (select playing from public.game_live_counts where game_id = p_game_id));
end $$;

create or replace function public.game_leave() returns void
language sql security definer set search_path = public as $$ delete from public.game_presence where user_id = public._uid() $$;

-- Public stats for the portal tabs (anon allowed: aggregate numbers only).
create or replace function public.list_game_stats() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('gameId', g.game_id, 'publishedAt', g.published_at,
      'visits7d', p.visits_7d, 'visitsAll', p.visits_all, 'playing', coalesce(l.playing, 0))
    order by g.published_at desc), '[]'::jsonb)
  from public.games g
  join public.game_popularity p on p.game_id = g.game_id
  left join public.game_live_counts l on l.game_id = g.game_id
  where g.active
$$;

revoke execute on function public.record_visit(text), public.game_heartbeat(text), public.game_leave(), public.list_game_stats()
  from public, anon, authenticated;
grant execute on function public.record_visit(text), public.game_heartbeat(text), public.game_leave() to authenticated;
grant execute on function public.list_game_stats() to anon, authenticated;
