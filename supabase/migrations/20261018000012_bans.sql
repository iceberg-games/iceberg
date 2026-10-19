-- 0012: bans (additive). A ban is keyed by user_id + username. Developers (is_dev) ban / unban by username.
-- Enforcement: BEFORE triggers on the tables the chat / multiplayer / earning RPCs write to, so every such RPC
-- (post_chat, mp_join, mp_heartbeat, game_earn, claim_daily_bonus, claim_quest_reward, ...) refuses with 'banned'.
-- Spending and leaving still work. No existing function or player row is changed.
create table if not exists public.bans (
  id         bigserial primary key,
  user_id    uuid references auth.users(id) on delete set null,
  username   text not null,
  reason     text check (reason is null or char_length(reason) <= 200),
  banned_by  uuid,
  created_at timestamptz not null default now(),
  active     boolean not null default true
);
create index if not exists bans_active_user on public.bans (user_id) where active;
alter table public.bans enable row level security;
revoke all on public.bans from anon, authenticated;
revoke all on sequence public.bans_id_seq from anon, authenticated;

create or replace function public.is_banned() returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and exists (select 1 from public.bans b where b.active and b.user_id = auth.uid())
$$;
revoke execute on function public.is_banned() from public;
grant execute on function public.is_banned() to anon, authenticated;

create or replace function public.ban_user(p_username text, p_reason text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_name text;
begin
  if not public.is_dev() then return jsonb_build_object('ok', false, 'reason', 'not_dev'); end if;
  select id, username into v_id, v_name from public.profiles where lower(username) = lower(trim(p_username));
  if v_id is null then return jsonb_build_object('ok', false, 'reason', 'no_such_user'); end if;
  if exists (select 1 from public.dev_accounts d where d.user_id = v_id) or coalesce((select is_admin from public.profiles where id = v_id), false)
    then return jsonb_build_object('ok', false, 'reason', 'cannot_ban_dev'); end if;
  if exists (select 1 from public.bans where active and user_id = v_id) then return jsonb_build_object('ok', true, 'username', v_name, 'already', true); end if;
  insert into public.bans (user_id, username, reason, banned_by) values (v_id, v_name, left(p_reason, 200), auth.uid());
  delete from public.mp_members where user_id = v_id;            -- drop them from multiplayer now
  return jsonb_build_object('ok', true, 'username', v_name);
end $$;
revoke execute on function public.ban_user(text, text) from public;
grant execute on function public.ban_user(text, text) to authenticated;

create or replace function public.unban_user(p_username text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_n int;
begin
  if not public.is_dev() then return jsonb_build_object('ok', false, 'reason', 'not_dev'); end if;
  update public.bans set active = false where active and lower(username) = lower(trim(p_username));
  get diagnostics v_n = row_count;
  return jsonb_build_object('ok', v_n > 0, 'unbanned', v_n, 'reason', case when v_n = 0 then 'not_banned' end);
end $$;
revoke execute on function public.unban_user(text) from public;
grant execute on function public.unban_user(text) to authenticated;

-- guards
create or replace function public._ban_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and exists (select 1 from public.bans b where b.active and b.user_id = auth.uid())
    then raise exception 'banned' using errcode = '42501'; end if;
  return new;
end $$;
revoke execute on function public._ban_guard() from public;
drop trigger if exists ban_guard on public.chat_messages;
create trigger ban_guard before insert on public.chat_messages for each row execute function public._ban_guard();
drop trigger if exists ban_guard on public.mp_members;
create trigger ban_guard before insert or update on public.mp_members for each row execute function public._ban_guard();
drop trigger if exists ban_guard on public.wallet_ledger;
create trigger ban_guard before insert on public.wallet_ledger for each row when (new.delta > 0) execute function public._ban_guard();
