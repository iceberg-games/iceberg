-- 0020: Owner-only edit of a published game's name, description and thumbnail (Editor Update).
-- Additive: one new RPC. Touches only doc.name / doc.description / doc.thumbnail (+ the name column) of the OWNER's
-- own live game, and the same fields inside draft_doc when a draft exists, so nothing else about the game changes.
-- NOT applied to production by the agent; apply with the normal migration flow after Colin approves.
create or replace function public.update_custom_game_meta(p_game_key text, p_name text, p_description text, p_thumbnail text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_uid uuid := public._uid(); v_n int; v_name text := trim(coalesce(p_name, '')); v_desc text := coalesce(p_description, '');
        v_patch jsonb;
begin
  if public.is_banned() then raise exception 'banned' using errcode = '42501'; end if;
  if char_length(v_name) not between 1 and 40 then return jsonb_build_object('ok', false, 'reason', 'bad_name'); end if;
  if char_length(v_desc) > 120 then return jsonb_build_object('ok', false, 'reason', 'bad_description'); end if;
  if p_thumbnail is not null then
    if octet_length(p_thumbnail) > public._cfg('custom_game_thumb_max_bytes')::int then return jsonb_build_object('ok', false, 'reason', 'thumb_too_large'); end if;
    if p_thumbnail !~ '^data:image/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$' then return jsonb_build_object('ok', false, 'reason', 'bad_thumbnail'); end if;
  end if;
  v_patch := jsonb_build_object('name', v_name, 'description', v_desc) || case when p_thumbnail is null then '{}'::jsonb else jsonb_build_object('thumbnail', p_thumbnail) end;
  update public.custom_games
     set name = v_name, doc = doc || v_patch, draft_doc = case when draft_doc is null then null else draft_doc || v_patch end, updated_at = now()
   where game_key = p_game_key and owner = v_uid and published and deleted_at is null;
  get diagnostics v_n = row_count;
  return jsonb_build_object('ok', v_n > 0, 'reason', case when v_n > 0 then null else 'not_found' end);
end $$;
revoke all on function public.update_custom_game_meta(text, text, text, text) from public;
grant execute on function public.update_custom_game_meta(text, text, text, text) to authenticated;
