-- LOCAL TESTING ONLY. Minimal stand-in for the parts of Supabase that the migrations
-- depend on: roles, the auth schema, auth.users and auth.uid(). Never run on Supabase.
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end $$;
create schema if not exists auth;
create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  encrypted_password text,
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
-- Same lookup order as Supabase: request.jwt.claim.sub, then request.jwt.claims->>'sub'.
create or replace function auth.uid() returns uuid language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claim.sub', true), ''),
                  (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'))::uuid
$$;
grant usage on schema auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;
-- Mirror Supabase's permissive defaults so the migrations' revokes are actually exercised.
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;

-- Minimal stub of Supabase's realtime schema (Realtime Authorization reads realtime.messages under RLS,
-- with realtime.topic() = the channel being joined). Real Supabase already has these.
create schema if not exists realtime;
create table if not exists realtime.messages (
  id bigserial primary key, topic text not null, extension text not null, payload jsonb, event text,
  private boolean default true, inserted_at timestamptz default now()
);
alter table realtime.messages enable row level security;
create or replace function realtime.topic() returns text language sql stable as $$ select nullif(current_setting('realtime.topic', true), '') $$;
grant usage on schema realtime to anon, authenticated;
grant select, insert on realtime.messages to anon, authenticated;
grant usage on all sequences in schema realtime to anon, authenticated;
