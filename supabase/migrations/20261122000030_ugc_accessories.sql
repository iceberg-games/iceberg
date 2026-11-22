-- 0020: UGC accessories (PC Accessory Editor, src/ugc/*). Additive only; NOT applied anywhere yet.
--
--   ugc_drafts  owner-only working copies (draft_key = client id 'd_<rand>').
--   ugc_items   published creations: owner, name, slot, spec (compact JSON), price_bb, status.
--               Each published item ALSO gets a catalog_items row (id 'ugc_<rand>', grant_only = true)
--               so the existing inventory / save_loadout / _clean_equipped / get_my_profile paths work
--               unchanged. grant_only keeps buy_cosmetic and guest-save import from selling it; the only
--               way to buy is buy_ugc_item below (creator share). scripts/sync-catalog.mjs skips 'ugc_%' ids.
-- Writes only through SECURITY DEFINER RPCs (owner checked); direct table writes are revoked.
-- Spec rules mirror src/ugc/spec.js: slot in hat|face|back|neck, 1..24 parts, <= 8 KB, price 50..5000 BB.

create table if not exists public.ugc_drafts (
  owner       uuid not null references public.profiles(id) on delete cascade,
  draft_key   text not null check (draft_key ~ '^[a-zA-Z0-9_-]{1,40}$'),
  name        text not null check (char_length(name) between 1 and 32),
  spec        jsonb not null check (pg_column_size(spec) <= 16000),
  status      text not null default 'draft' check (status in ('draft', 'published', 'removed')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  primary key (owner, draft_key)
);

create table if not exists public.ugc_items (
  id           text primary key check (id ~ '^ugc_[a-z0-9]{10}$'),
  owner        uuid not null references public.profiles(id) on delete cascade,
  draft_key    text,
  name         text not null check (char_length(name) between 3 and 32),
  slot         text not null check (slot in ('hat', 'face', 'back', 'neck')),
  spec         jsonb not null check (pg_column_size(spec) <= 16000),
  price_bb     integer not null check (price_bb between 50 and 5000),
  status       text not null default 'published' check (status in ('draft', 'published', 'removed')),
  sales        integer not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  published_at timestamptz
);
create index if not exists ugc_items_listing on public.ugc_items(published_at desc) where status = 'published';
create index if not exists ugc_items_owner on public.ugc_items(owner);

insert into public.app_config (key, value) values
  ('ugc_price_min', '50'), ('ugc_price_max', '5000'), ('ugc_max_parts', '24'),
  ('ugc_creator_share_pct', '30'), ('ugc_max_published_per_user', '50')
on conflict (key) do nothing;

-- ---------- RLS ----------
alter table public.ugc_drafts enable row level security;
alter table public.ugc_items  enable row level security;
drop policy if exists ugc_drafts_own on public.ugc_drafts;
create policy ugc_drafts_own on public.ugc_drafts for select to authenticated using (owner = auth.uid());
drop policy if exists ugc_items_read_published on public.ugc_items;
create policy ugc_items_read_published on public.ugc_items for select to anon, authenticated using (status = 'published');
drop policy if exists ugc_items_read_own on public.ugc_items;
create policy ugc_items_read_own on public.ugc_items for select to authenticated using (owner = auth.uid());
revoke all on public.ugc_drafts, public.ugc_items from anon, authenticated;
grant select on public.ugc_items to anon, authenticated;
grant select on public.ugc_drafts to authenticated;

-- ---------- validation helpers ----------
-- Light name filter (mirror of nameProblem in src/ugc/spec.js): fold leetspeak, strip non-letters, blocklist.
create or replace function public._ugc_name_ok(p_name text) returns boolean
language sql immutable as $$
  select char_length(btrim(coalesce(p_name, ''))) between 3 and 32
     and btrim(p_name) ~ '^[[:alnum:] ''’!?.,&:()-]+$'
     and regexp_replace(translate(lower(p_name), '@43105$7!|', 'aaeiosstii'), '[^a-z]', '', 'g')
         !~ '(fuck|shit|bitch|cunt|dick|cock|pussy|nigg|fag|slut|whore|rape|nazi|porn|sex|kys|retard|asshole)'
$$;

-- Spec check: shape of every part, part count, slot frame (positions within ±1.6, scales 0.02..1.2), size cap.
create or replace function public._ugc_spec_ok(p_spec jsonb, p_slot text) returns boolean
language sql stable set search_path = public as $$
  select jsonb_typeof(p_spec) = 'object'
     and p_spec->>'slot' = p_slot
     and p_slot in ('hat', 'face', 'back', 'neck')
     and jsonb_typeof(p_spec->'parts') = 'array'
     and jsonb_array_length(p_spec->'parts') between 1 and public._cfg('ugc_max_parts')
     and pg_column_size(p_spec) <= 16000
     and not exists (
       select 1 from jsonb_array_elements(p_spec->'parts') part
        where jsonb_typeof(part) <> 'object'
           or coalesce(part->>'p', '') not in ('box', 'sphere', 'cylinder', 'cone', 'torus', 'wedge')
           or coalesce(part->>'m', '') not in ('matte', 'glossy', 'metal', 'ice', 'glow')
           or not public._is_hex_color(part->>'c')
           or jsonb_typeof(part->'pos') <> 'array' or jsonb_array_length(part->'pos') <> 3
           or jsonb_typeof(part->'rot') <> 'array' or jsonb_array_length(part->'rot') <> 3
           or jsonb_typeof(part->'scl') <> 'array' or jsonb_array_length(part->'scl') <> 3
           or exists (select 1 from jsonb_array_elements(part->'pos') v where jsonb_typeof(v) <> 'number' or abs(v::text::numeric) > 1.6)
           or exists (select 1 from jsonb_array_elements(part->'rot') v where jsonb_typeof(v) <> 'number' or abs(v::text::numeric) > 180)
           or exists (select 1 from jsonb_array_elements(part->'scl') v where jsonb_typeof(v) <> 'number' or v::text::numeric < 0.02 or v::text::numeric > 1.2))
$$;

-- ---------- drafts ----------
create or replace function public.save_ugc_draft(p_draft_key text, p_name text, p_spec jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := public._uid();
begin
  if p_draft_key !~ '^[a-zA-Z0-9_-]{1,40}$' then return jsonb_build_object('ok', false, 'reason', 'bad_key'); end if;
  if jsonb_typeof(p_spec) <> 'object' or pg_column_size(p_spec) > 16000
     or jsonb_array_length(coalesce(p_spec->'parts', '[]'::jsonb)) > public._cfg('ugc_max_parts') then
    return jsonb_build_object('ok', false, 'reason', 'spec_too_large');
  end if;
  if (select count(*) from public.ugc_drafts where owner = v_uid) >= 100
     and not exists (select 1 from public.ugc_drafts where owner = v_uid and draft_key = p_draft_key) then
    return jsonb_build_object('ok', false, 'reason', 'too_many_drafts');
  end if;
  insert into public.ugc_drafts (owner, draft_key, name, spec)
  values (v_uid, p_draft_key, left(coalesce(nullif(btrim(p_name), ''), 'Untitled'), 32), p_spec)
  on conflict (owner, draft_key) do update set name = excluded.name, spec = excluded.spec, updated_at = now();
  return jsonb_build_object('ok', true, 'draft_key', p_draft_key);
end $$;

create or replace function public.list_my_ugc_drafts() returns setof jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('draft_key', d.draft_key, 'name', d.name, 'spec', d.spec, 'status', d.status, 'updated_at', d.updated_at)
  from public.ugc_drafts d where d.owner = public._uid() and d.status <> 'removed' order by d.updated_at desc limit 100
$$;

create or replace function public.delete_ugc_draft(p_draft_key text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := public._uid();
begin
  update public.ugc_drafts set status = 'removed', updated_at = now() where owner = v_uid and draft_key = p_draft_key;   -- soft delete
  return jsonb_build_object('ok', found);
end $$;

-- ---------- publish (server-side validation; creator owns it for free) ----------
create or replace function public.publish_ugc_item(p_draft_key text, p_name text, p_spec jsonb, p_price integer) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := public._uid(); v_slot text := p_spec->>'slot'; v_id text; v_name text := btrim(coalesce(p_name, ''));
begin
  if not public._ugc_name_ok(v_name) then return jsonb_build_object('ok', false, 'reason', 'bad_name'); end if;
  if p_price is null or p_price < public._cfg('ugc_price_min') or p_price > public._cfg('ugc_price_max') then
    return jsonb_build_object('ok', false, 'reason', 'bad_price');
  end if;
  if not public._ugc_spec_ok(p_spec, v_slot) then return jsonb_build_object('ok', false, 'reason', 'bad_spec'); end if;
  if (select count(*) from public.ugc_items where owner = v_uid and status = 'published') >= public._cfg('ugc_max_published_per_user') then
    return jsonb_build_object('ok', false, 'reason', 'too_many_items');
  end if;
  v_id := 'ugc_' || substr(md5(gen_random_uuid()::text), 1, 10);
  insert into public.catalog_items (id, name, slot, price, premium, customizable, active, grant_only)
  values (v_id, v_name, v_slot, p_price, false, false, true, true);
  insert into public.ugc_items (id, owner, draft_key, name, slot, spec, price_bb, status, published_at)
  values (v_id, v_uid, p_draft_key, v_name, v_slot, p_spec, p_price, 'published', now());
  insert into public.inventory (user_id, item_id, source) values (v_uid, v_id, 'ugc_creator') on conflict do nothing;
  if p_draft_key is not null then
    update public.ugc_drafts set status = 'published', updated_at = now() where owner = v_uid and draft_key = p_draft_key;
  end if;
  return jsonb_build_object('ok', true, 'id', v_id, 'price', p_price);
end $$;

-- Owner (or later moderation) takes an item off sale; owned copies keep working (catalog row inactive only for sale).
create or replace function public.remove_ugc_item(p_item_id text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := public._uid();
begin
  update public.ugc_items set status = 'removed', updated_at = now() where id = p_item_id and owner = v_uid and status = 'published';
  if not found then return jsonb_build_object('ok', false, 'reason', 'not_found'); end if;
  update public.catalog_items set active = false, updated_at = now() where id = p_item_id;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.list_ugc_items(p_limit integer default 100) returns setof jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', u.id, 'owner', u.owner, 'creator_name', p.display_name, 'name', u.name, 'slot', u.slot,
                            'spec', u.spec, 'price_bb', u.price_bb, 'sales', u.sales, 'published_at', u.published_at)
  from public.ugc_items u join public.profiles p on p.id = u.owner
  where u.status = 'published' order by u.published_at desc limit least(greatest(coalesce(p_limit, 100), 1), 200)
$$;

-- ---------- buy (atomic debit + ownership + creator share) ----------
create or replace function public.buy_ugc_item(p_item_id text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := public._uid(); v_item public.ugc_items; v_bal bigint; v_share bigint;
begin
  select * into v_item from public.ugc_items where id = p_item_id and status = 'published';
  if not found then return jsonb_build_object('ok', false, 'reason', 'unknown_item'); end if;
  perform 1 from public.profiles where id = v_uid for update;     -- serialize purchases per user (same as buy_cosmetic)
  if exists (select 1 from public.inventory where user_id = v_uid and item_id = p_item_id) then
    return jsonb_build_object('ok', false, 'reason', 'already_owned', 'coins', (select coins from public.profiles where id = v_uid));
  end if;
  v_bal := public._credit(v_uid, -v_item.price_bb, 'purchase', 'ugc', 'Bought ' || v_item.name, 'buy:' || p_item_id);
  if v_bal is null then
    return jsonb_build_object('ok', false, 'reason', 'insufficient_funds', 'coins', (select coins from public.profiles where id = v_uid));
  end if;
  insert into public.inventory (user_id, item_id, source) values (v_uid, p_item_id, 'ugc_purchase');
  update public.ugc_items set sales = sales + 1 where id = p_item_id;
  -- creator share (default 30%; the rest is a Birg Bucks sink). Idempotent per (item, buyer) via the ledger ref.
  v_share := floor(v_item.price_bb * public._cfg('ugc_creator_share_pct') / 100.0);
  if v_share > 0 and v_item.owner <> v_uid then
    perform public._credit(v_item.owner, v_share, 'earn', 'ugc_sale', 'Sold ' || v_item.name, 'ugcsale:' || p_item_id || ':' || v_uid);
  end if;
  return jsonb_build_object('ok', true, 'coins', v_bal, 'item', p_item_id, 'price', v_item.price_bb);
end $$;

revoke all on function public._ugc_name_ok(text), public._ugc_spec_ok(jsonb, text) from public;
revoke all on function public.save_ugc_draft(text, text, jsonb), public.list_my_ugc_drafts(), public.delete_ugc_draft(text),
  public.publish_ugc_item(text, text, jsonb, integer), public.remove_ugc_item(text), public.buy_ugc_item(text),
  public.list_ugc_items(integer) from public;
grant execute on function public.save_ugc_draft(text, text, jsonb), public.list_my_ugc_drafts(), public.delete_ugc_draft(text),
  public.publish_ugc_item(text, text, jsonb, integer), public.remove_ugc_item(text), public.buy_ugc_item(text) to authenticated;
grant execute on function public.list_ugc_items(integer) to anon, authenticated;
