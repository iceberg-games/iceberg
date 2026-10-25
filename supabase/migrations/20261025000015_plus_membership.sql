-- 0015 Iceberg Plus membership, server-backed (additive; no drops, no player data changed).
--   profiles.plus_until  timestamptz NULL — Plus is active while plus_until > now(). NULL for everyone on apply.
--   is_plus()            replaces the 0014 stub: true when the signed-in caller's plus_until is in the future.
--   plus_status()        caller's own {plus, plus_until} for the client badge / perk gates.
--   grant_plus(username, days, note)  DEV/ADMIN ONLY (is_dev()). Demo/comp grant — NOT a payment. days<=0 revokes.
--   plus_grants          audit log of every grant/revoke (who, whom, until, note).
-- Real purchases (Stripe etc.) are NOT wired; a verified payment webhook (service role) would set plus_until later,
-- after Colin re-confirms the payment account.
alter table public.profiles add column if not exists plus_until timestamptz;

-- Players must not be able to set their own plus_until via a direct profile update.
revoke update (plus_until) on public.profiles from anon, authenticated;

create table if not exists public.plus_grants (
  id         bigserial primary key,
  user_id    uuid references auth.users(id) on delete set null,
  username   text not null,
  plus_until timestamptz,
  granted_by uuid,
  note       text check (note is null or char_length(note) <= 200),
  created_at timestamptz not null default now()
);
alter table public.plus_grants enable row level security;
revoke all on public.plus_grants from anon, authenticated;
revoke all on sequence public.plus_grants_id_seq from anon, authenticated;

create or replace function public.is_plus() returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and coalesce((select p.plus_until > now() from public.profiles p where p.id = auth.uid()), false)
$$;
revoke execute on function public.is_plus() from public;
grant execute on function public.is_plus() to anon, authenticated;

create or replace function public.plus_status() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('plus', public.is_plus(),
    'plus_until', (select p.plus_until from public.profiles p where p.id = auth.uid()))
$$;
revoke execute on function public.plus_status() from public;
grant execute on function public.plus_status() to anon, authenticated;

create or replace function public.grant_plus(p_username text, p_days int default 30, p_note text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_name text; v_until timestamptz;
begin
  if not public.is_dev() then return jsonb_build_object('ok', false, 'reason', 'not_dev'); end if;
  select id, username into v_id, v_name from public.profiles where lower(username) = lower(trim(p_username));
  if v_id is null then return jsonb_build_object('ok', false, 'reason', 'no_such_user'); end if;
  v_until := case when coalesce(p_days, 0) <= 0 then null else now() + make_interval(days => least(p_days, 366)) end;
  update public.profiles set plus_until = v_until where id = v_id;
  insert into public.plus_grants (user_id, username, plus_until, granted_by, note)
    values (v_id, v_name, v_until, auth.uid(), left(coalesce(p_note, 'dev grant (not a payment)'), 200));
  return jsonb_build_object('ok', true, 'username', v_name, 'plus_until', v_until);
end $$;
revoke execute on function public.grant_plus(text, int, text) from public;
grant execute on function public.grant_plus(text, int, text) to authenticated;
