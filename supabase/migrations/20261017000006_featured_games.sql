-- Featured-game banner on the portal home page. Public read; writes only by admins
-- (profiles.is_admin, set from the SQL editor / service role) through set_featured_games,
-- or directly by the service role. No client role can write the table.

alter table public.profiles add column if not exists is_admin boolean not null default false;
-- is_admin is never writable by clients: profiles has no update policy/grant for them,
-- and no RPC changes it.

create table if not exists public.featured_games (
  game_id    text primary key references public.games(game_id) on delete cascade,
  sort_order integer not null default 0,
  active     boolean not null default true,
  blurb      text check (blurb is null or char_length(blurb) <= 160),
  image      text check (image is null or image ~ '^[a-zA-Z0-9_./-]{1,120}$'),   -- site-relative path, e.g. featured/birg-hq.png
  updated_at timestamptz not null default now(),
  updated_by uuid
);
alter table public.featured_games enable row level security;
drop policy if exists featured_read on public.featured_games;
create policy featured_read on public.featured_games for select to anon, authenticated using (active);
revoke all on public.featured_games from anon, authenticated;
grant select on public.featured_games to anon, authenticated;
grant all on public.featured_games to service_role;

-- Initial rows come from site/public/featured.json via scripts/sync-catalog.mjs, ONLY while this
-- table is empty (first deploy). After that the list is admin-owned and never overwritten.

create or replace function public.list_featured() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('gameId', f.game_id, 'blurb', f.blurb, 'image', f.image, 'sortOrder', f.sort_order)
    order by f.sort_order, f.game_id), '[]'::jsonb)
  from public.featured_games f join public.games g on g.game_id = f.game_id and g.active
  where f.active
$$;

-- Admin-only: replace the featured list. p_items = [{gameId, blurb?, image?}] in display order.
create or replace function public.set_featured_games(p_items jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := public._uid(); v_n int := 0; it jsonb;
begin
  if not coalesce((select is_admin from public.profiles where id = v_uid), false) then
    raise exception 'admin_only' using errcode = '42501';
  end if;
  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) > 12 then
    return jsonb_build_object('ok', false, 'reason', 'invalid_list');
  end if;
  update public.featured_games set active = false, updated_at = now(), updated_by = v_uid;
  for it in select * from jsonb_array_elements(p_items) loop
    v_n := v_n + 1;
    if not exists (select 1 from public.games where game_id = it->>'gameId' and active) then
      raise exception 'unknown_game %', it->>'gameId' using errcode = '22023';
    end if;
    insert into public.featured_games (game_id, sort_order, active, blurb, image, updated_at, updated_by)
    values (it->>'gameId', v_n, true, nullif(it->>'blurb', ''), nullif(it->>'image', ''), now(), v_uid)
    on conflict (game_id) do update set sort_order = excluded.sort_order, active = true, blurb = excluded.blurb,
      image = excluded.image, updated_at = now(), updated_by = v_uid;
  end loop;
  return jsonb_build_object('ok', true, 'count', v_n, 'featured', public.list_featured());
end $$;

revoke execute on function public.list_featured(), public.set_featured_games(jsonb) from public, anon, authenticated;
grant execute on function public.list_featured() to anon, authenticated;
grant execute on function public.set_featured_games(jsonb) to authenticated;   -- body enforces is_admin
