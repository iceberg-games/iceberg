-- 0020: Shared custom models (published Studio placements + worn cosmetics).
-- Additive only. Do not apply to the live database from this branch; ship with a later deploy.
--
-- 1) profiles.custom_wear (roster field) + save_loadout / _public_player / _profile_json.
-- 2) Storage bucket `game-models` when the storage schema exists (hosted Supabase).
--    Path: {user_id}/{sha256}.{glb|gltf}. Public read, owner write.
-- Local PGlite (tools/db/dev-server.mjs) has no storage schema; the JS stub serves the same URL shape.

insert into public.app_config (key, value) values ('game_model_max_bytes', '26214400')
on conflict (key) do nothing;

alter table public.profiles add column if not exists custom_wear jsonb;

-- Validate a published model + wear pose. Returns null when the payload is unusable.
create or replace function public._clean_custom_wear(p jsonb) returns jsonb
language plpgsql immutable as $$
declare
  v_hash text; v_fmt text; v_url text; v_bytes int; v_bone text; v_id text; v_name text;
  v_scale double precision; v_x double precision; v_y double precision; v_z double precision; v_roty double precision;
begin
  if p is null or p = 'null'::jsonb then return null; end if;
  if jsonb_typeof(p) <> 'object' then return null; end if;
  v_hash := lower(coalesce(p->>'hash', ''));
  v_fmt := lower(coalesce(p->>'format', ''));
  v_url := p->>'url';
  begin v_bytes := (p->>'bytes')::int; exception when others then return null; end;
  if v_hash !~ '^[0-9a-f]{64}$' then return null; end if;
  if v_fmt not in ('glb', 'gltf') then return null; end if;
  if v_bytes is null or v_bytes < 1 or v_bytes > 26214400 then return null; end if;
  if v_url is null or char_length(v_url) > 500 then return null; end if;
  if v_url !~ '^https?://[A-Za-z0-9._:-]+/storage/v1/object/public/game-models/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{64}\.(glb|gltf)$' then
    return null;
  end if;
  v_bone := coalesce(p->>'bone', 'head');
  if v_bone not in ('head', 'torso', 'armL', 'armR', 'legL', 'legR') then v_bone := 'head'; end if;
  v_id := coalesce(nullif(p->>'id', ''), 'm');
  if char_length(v_id) > 80 then v_id := left(v_id, 80); end if;
  v_name := left(coalesce(p->>'name', ''), 80);
  begin v_scale := (p->>'scale')::double precision; exception when others then v_scale := 0.5; end;
  begin v_x := (p->>'x')::double precision; exception when others then v_x := 0; end;
  begin v_y := (p->>'y')::double precision; exception when others then v_y := 0; end;
  begin v_z := (p->>'z')::double precision; exception when others then v_z := 0; end;
  begin v_roty := (p->>'rotY')::double precision; exception when others then v_roty := 0; end;
  if v_scale is null or v_scale <> v_scale then v_scale := 0.5; end if;
  if v_x is null or v_x <> v_x then v_x := 0; end if;
  if v_y is null or v_y <> v_y then v_y := 0; end if;
  if v_z is null or v_z <> v_z then v_z := 0; end if;
  if v_roty is null or v_roty <> v_roty then v_roty := 0; end if;
  v_scale := least(20, greatest(0.01, v_scale));
  v_x := least(20, greatest(-20, v_x));
  v_y := least(20, greatest(-20, v_y));
  v_z := least(20, greatest(-20, v_z));
  v_roty := least(8, greatest(-8, v_roty));
  return jsonb_build_object('id', v_id, 'name', v_name, 'format', v_fmt, 'hash', v_hash, 'bytes', v_bytes,
    'url', v_url, 'bone', v_bone, 'scale', v_scale, 'x', v_x, 'y', v_y, 'z', v_z, 'rotY', v_roty);
end $$;

create or replace function public._public_player(p public.profiles) returns jsonb
language sql stable as $$
  select jsonb_build_object('username', p.username, 'displayName', p.display_name,
    'equipped', p.equipped, 'rocketColors', p.rocket_colors, 'cosmeticColors', p.cosmetic_colors,
    'customWear', p.custom_wear)
$$;

create or replace function public._profile_json(p_uid uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'playerId', p.id, 'username', p.username, 'displayName', p.display_name,
    'coins', p.coins,
    'owned', coalesce((select jsonb_agg(i.item_id order by i.acquired_at) from public.inventory i where i.user_id = p.id), '[]'::jsonb),
    'equipped', p.equipped, 'rocketColors', p.rocket_colors, 'cosmeticColors', p.cosmetic_colors,
    'customWear', p.custom_wear,
    'gameData', public._game_data_json(p.id),
    'lastDailyBonus', p.last_daily_bonus,
    'buildRewardDay', public._today(),
    'buildRewardToday', coalesce((select amount from public.earn_daily e where e.user_id = p.id and e.day = public._today() and e.source = 'build'), 0),
    'migrated', p.migrated_at is not null,
    'dateOfBirth', p.date_of_birth,
    'deactivated', p.deactivated_at is not null)
  from public.profiles p where p.id = p_uid
$$;

-- Same 3-arg calls still work (new argument has a default).
revoke all on function public.save_loadout(jsonb, jsonb, jsonb) from public;
drop function if exists public.save_loadout(jsonb, jsonb, jsonb);

create or replace function public.save_loadout(p_equipped jsonb default null, p_rocket_colors jsonb default null, p_cosmetic_colors jsonb default null, p_custom_wear jsonb default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_uid uuid := public._uid();
begin
  update public.profiles set
    equipped        = case when p_equipped is null then equipped else public._clean_equipped(v_uid, p_equipped) end,
    rocket_colors   = case when p_rocket_colors is null then rocket_colors else public._clean_rocket_colors(p_rocket_colors, rocket_colors) end,
    cosmetic_colors = case when p_cosmetic_colors is null then cosmetic_colors else cosmetic_colors || public._clean_cosmetic_colors(p_cosmetic_colors) end,
    custom_wear     = case when p_custom_wear is null then custom_wear else public._clean_custom_wear(p_custom_wear) end,
    updated_at = now()
  where id = v_uid;
  return (select jsonb_build_object('equipped', equipped, 'rocketColors', rocket_colors, 'cosmeticColors', cosmetic_colors,
           'customWear', custom_wear) from public.profiles where id = v_uid);
end $$;

revoke all on function public.save_loadout(jsonb, jsonb, jsonb, jsonb) from public;
grant execute on function public.save_loadout(jsonb, jsonb, jsonb, jsonb) to authenticated;

-- Hosted Supabase only. Local PGlite has no storage schema; tools/db/dev-server.mjs stubs the same URLs.
do $$
begin
  if not exists (select 1 from information_schema.schemata where schema_name = 'storage') then
    return;
  end if;
  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('game-models', 'game-models', true, 26214400,
      array['model/gltf-binary', 'model/gltf+json', 'application/octet-stream', 'application/json'])
    on conflict (id) do nothing;

  execute 'drop policy if exists game_models_public_read on storage.objects';
  execute 'drop policy if exists game_models_own_insert on storage.objects';
  execute 'drop policy if exists game_models_own_update on storage.objects';
  execute 'drop policy if exists game_models_own_delete on storage.objects';
  execute $p$create policy game_models_public_read on storage.objects for select using (bucket_id = ''game-models'')$p$;
  execute $p$create policy game_models_own_insert on storage.objects for insert to authenticated
      with check (bucket_id = ''game-models'' and split_part(name, ''/'', 1) = auth.uid()::text
        and name ~ ''^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{64}\.(glb|gltf)$'')$p$;
  execute $p$create policy game_models_own_update on storage.objects for update to authenticated
      using (bucket_id = ''game-models'' and split_part(name, ''/'', 1) = auth.uid()::text)
      with check (bucket_id = ''game-models'' and split_part(name, ''/'', 1) = auth.uid()::text)$p$;
  execute $p$create policy game_models_own_delete on storage.objects for delete to authenticated
      using (bucket_id = ''game-models'' and split_part(name, ''/'', 1) = auth.uid()::text)$p$;
end $$;
