-- 0014 Plus-only catalog items (additive). Iceberg Plus membership isn't live yet, so is_plus() is false for
-- everyone and buy_cosmetic refuses plus_only / wh_plus_* items with reason 'plus_only'. Models stay in the client
-- catalog for the Plus UI. When Plus ships, replace is_plus() with the real membership check.
--   catalog_items.plus_only   set by scripts/sync-catalog.mjs (cosmetics plusOnly: true, or id wh_plus_*)
--   is_plus()                 stub: false
--   buy_cosmetic              same as 0008 + the plus_only refusal (before any balance/inventory change)
-- Grants: quest rewards must be grant-only (sync validation), and guest import already excludes premium items.
alter table public.catalog_items add column if not exists plus_only boolean not null default false;
update public.catalog_items set plus_only = true where id like 'wh\_plus\_%' and not plus_only;

create or replace function public.is_plus() returns boolean
language sql stable security definer set search_path = public as $$ select false $$;
grant execute on function public.is_plus() to anon, authenticated;

create or replace function public.buy_cosmetic(p_item_id text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := public._uid(); v_item public.catalog_items; v_bal bigint; v_state text;
begin
  select * into v_item from public.catalog_items where id = p_item_id and active;
  if not found then return jsonb_build_object('ok', false, 'reason', 'unknown_item'); end if;
  if v_item.plus_only or p_item_id like 'wh\_plus\_%' then                  -- Iceberg Plus perks: members only
    if not public.is_plus() then return jsonb_build_object('ok', false, 'reason', 'plus_only', 'coins', (select coins from public.profiles where id = v_uid)); end if;
  end if;
  if v_item.grant_only then return jsonb_build_object('ok', false, 'reason', 'not_for_sale', 'coins', (select coins from public.profiles where id = v_uid)); end if;
  perform 1 from public.profiles where id = v_uid for update;     -- serialize purchases per user
  if exists (select 1 from public.inventory where user_id = v_uid and item_id = p_item_id) then
    return jsonb_build_object('ok', false, 'reason', 'already_owned', 'coins', (select coins from public.profiles where id = v_uid));
  end if;
  v_state := public._event_sale_state(v_item.event_id);           -- limited-time shop items: only while the event is live
  if v_state <> 'live' then
    return jsonb_build_object('ok', false, 'reason', v_state, 'event', v_item.event_id, 'coins', (select coins from public.profiles where id = v_uid));
  end if;
  v_bal := public._credit(v_uid, -v_item.price, 'purchase', 'shop', 'Bought ' || v_item.name, 'buy:' || p_item_id);
  if v_bal is null then
    return jsonb_build_object('ok', false, 'reason', 'insufficient_funds', 'coins', (select coins from public.profiles where id = v_uid));
  end if;
  insert into public.inventory (user_id, item_id, source) values (v_uid, p_item_id, 'purchase');
  return jsonb_build_object('ok', true, 'coins', v_bal, 'item', p_item_id, 'price', v_item.price);
end $$;
