-- Developer allowlist for the 'New Update (Developers Only)' preview button.
-- Additive only. A user is a dev if they are in public.dev_accounts OR profiles.is_admin
-- (the existing admin flag from 0006: featured games / event windows).
-- Clients can only ask "am I a dev?" (is_dev()) and read their OWN row; nobody can read
-- other rows, and only admins (set_dev_account) or the service role / SQL editor
-- (scripts/dev-access.mjs via the Management API) can write.
create table if not exists public.dev_accounts (
  user_id  uuid primary key references auth.users(id) on delete cascade,
  added_at timestamptz not null default now(),
  note     text check (note is null or char_length(note) <= 200)
);
alter table public.dev_accounts enable row level security;
revoke all on public.dev_accounts from anon, authenticated;
grant select on public.dev_accounts to authenticated;
drop policy if exists dev_accounts_read_own on public.dev_accounts;
create policy dev_accounts_read_own on public.dev_accounts for select to authenticated using (user_id = auth.uid());

-- true only for the signed-in caller when they are a dev or an admin; false for everyone else (incl. anon).
create or replace function public.is_dev() returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and (
    exists (select 1 from public.dev_accounts d where d.user_id = auth.uid())
    or coalesce((select p.is_admin from public.profiles p where p.id = auth.uid()), false))
$$;
revoke execute on function public.is_dev() from public;
grant execute on function public.is_dev() to anon, authenticated;

-- Admin-only: add/remove a dev by exact username. (Scripts use the service role / SQL editor instead.)
create or replace function public.set_dev_account(p_username text, p_on boolean, p_note text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_target uuid;
begin
  if v_uid is null or not coalesce((select is_admin from public.profiles where id = v_uid), false) then
    raise exception 'admin_only' using errcode = '42501';
  end if;
  select id into v_target from public.profiles where username = lower(trim(p_username));
  if v_target is null then return jsonb_build_object('ok', false, 'reason', 'no_such_user'); end if;
  if p_on then
    insert into public.dev_accounts (user_id, note) values (v_target, left(p_note, 200))
      on conflict (user_id) do update set note = coalesce(excluded.note, public.dev_accounts.note);
  else
    delete from public.dev_accounts where user_id = v_target;
  end if;
  return jsonb_build_object('ok', true, 'username', lower(trim(p_username)), 'dev', p_on);
end $$;
revoke execute on function public.set_dev_account(text, boolean, text) from public, anon;
grant execute on function public.set_dev_account(text, boolean, text) to authenticated;   -- body enforces is_admin
