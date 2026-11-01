-- 0017: Custom (Studio) games published to the server so other players can find and play them.
-- Additive only. Never hard-deletes: unpublish sets deleted_at (soft delete), rows are kept.
-- game_key = the Studio doc id (text, e.g. 'g_<uuid>'); id = server uuid.
-- Writes only through security-definer RPCs (owner checked); direct table writes are revoked.

create table if not exists public.custom_games (
  id           uuid primary key default gen_random_uuid(),
  game_key     text not null unique check (game_key ~ '^[a-zA-Z0-9_-]{1,64}$'),
  owner        uuid not null references public.profiles(id) on delete cascade,
  name         text not null check (char_length(name) between 1 and 40),
  doc          jsonb not null check (pg_column_size(doc) <= 2000000),   -- ~2 MB cap
  published    boolean not null default true,
  published_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz
);
create index if not exists custom_games_listing on public.custom_games(published_at desc) where published and deleted_at is null;
create index if not exists custom_games_owner on public.custom_games(owner);

alter table public.custom_games enable row level security;
drop policy if exists custom_games_read_published on public.custom_games;
create policy custom_games_read_published on public.custom_games for select to anon, authenticated
  using (published and deleted_at is null);
drop policy if exists custom_games_read_own on public.custom_games;
create policy custom_games_read_own on public.custom_games for select to authenticated using (owner = auth.uid());
drop policy if exists custom_games_update_own on public.custom_games;
create policy custom_games_update_own on public.custom_games for update to authenticated
  using (owner = auth.uid()) with check (owner = auth.uid());
revoke all on public.custom_games from anon, authenticated;
grant select on public.custom_games to anon, authenticated;

insert into public.app_config (key, value) values ('custom_game_max_bytes', '2000000'), ('custom_games_per_owner', '50'), ('custom_game_thumb_max_bytes', '300000')
on conflict (key) do nothing;

create or replace function public.publish_custom_game(p_game_key text, p_name text, p_doc jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := public._uid(); v_row public.custom_games; v_owner uuid;
begin
  if public.is_banned() then raise exception 'banned' using errcode = '42501'; end if;
  if p_doc is null or jsonb_typeof(p_doc) <> 'object' then return jsonb_build_object('ok', false, 'reason', 'bad_doc'); end if;
  if pg_column_size(p_doc) > public._cfg('custom_game_max_bytes')::int then return jsonb_build_object('ok', false, 'reason', 'too_large'); end if;
  if octet_length(coalesce(p_doc->>'thumbnail', '')) > public._cfg('custom_game_thumb_max_bytes')::int then return jsonb_build_object('ok', false, 'reason', 'thumb_too_large'); end if;
  if p_game_key is null or p_game_key !~ '^[a-zA-Z0-9_-]{1,64}$' then return jsonb_build_object('ok', false, 'reason', 'bad_id'); end if;
  if coalesce(char_length(trim(p_name)), 0) not between 1 and 40 then return jsonb_build_object('ok', false, 'reason', 'bad_name'); end if;
  select owner into v_owner from public.custom_games where game_key = p_game_key;
  if v_owner is not null and v_owner <> v_uid then return jsonb_build_object('ok', false, 'reason', 'id_taken'); end if;
  if v_owner is null and (select count(*) from public.custom_games where owner = v_uid and deleted_at is null) >= public._cfg('custom_games_per_owner')::int then
    return jsonb_build_object('ok', false, 'reason', 'limit_reached');
  end if;
  insert into public.custom_games (game_key, owner, name, doc, published, published_at)
    values (p_game_key, v_uid, trim(p_name), p_doc, true, now())
  on conflict (game_key) do update set name = excluded.name, doc = excluded.doc, published = true,
    published_at = coalesce(custom_games.published_at, now()), updated_at = now(), deleted_at = null
    where custom_games.owner = v_uid
  returning * into v_row;
  return jsonb_build_object('ok', true, 'id', v_row.id, 'game_key', v_row.game_key, 'published_at', v_row.published_at);
end $$;

create or replace function public.unpublish_custom_game(p_game_key text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := public._uid(); v_n int;
begin
  update public.custom_games set published = false, deleted_at = now(), updated_at = now()
    where game_key = p_game_key and owner = v_uid and deleted_at is null;
  get diagnostics v_n = row_count;
  return jsonb_build_object('ok', v_n > 0, 'reason', case when v_n > 0 then null else 'not_found' end);
end $$;

create or replace function public.list_published_games(p_limit int default 60, p_before timestamptz default null) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', g.id, 'game_key', g.game_key, 'name', g.name, 'doc', g.doc,
           'owner', g.owner, 'owner_name', p.username, 'published_at', g.published_at, 'updated_at', g.updated_at) order by g.published_at desc), '[]'::jsonb)
  from (select * from public.custom_games
         where published and deleted_at is null and (p_before is null or published_at < p_before)
         order by published_at desc limit least(greatest(coalesce(p_limit, 60), 1), 100)) g
  left join public.profiles p on p.id = g.owner
$$;

-- one published game by its Studio id (play-by-link: play/?game=<game_key>); null when missing/unpublished
create or replace function public.get_published_game(p_game_key text) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', g.id, 'game_key', g.game_key, 'name', g.name, 'doc', g.doc, 'owner', g.owner,
           'owner_name', p.username, 'published_at', g.published_at, 'updated_at', g.updated_at)
  from public.custom_games g left join public.profiles p on p.id = g.owner
  where g.game_key = p_game_key and g.published and g.deleted_at is null
$$;

revoke all on function public.get_published_game(text) from public;
grant execute on function public.get_published_game(text) to anon, authenticated;
revoke all on function public.publish_custom_game(text, text, jsonb), public.unpublish_custom_game(text), public.list_published_games(int, timestamptz) from public;
grant execute on function public.publish_custom_game(text, text, jsonb), public.unpublish_custom_game(text) to authenticated;
grant execute on function public.list_published_games(int, timestamptz) to anon, authenticated;
