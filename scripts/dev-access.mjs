#!/usr/bin/env node
// Manage the developer allowlist (public.dev_accounts, migration 0009) that shows the
// 'New Update (Developers Only)' button and unlocks /preview/.
//
//   node scripts/dev-access.mjs add <username|synthetic email> [--note "why"]
//   node scripts/dev-access.mjs remove <username|synthetic email>
//   node scripts/dev-access.mjs list
// Add --print to only print the SQL (paste into the Supabase SQL editor). Otherwise it runs via the
// Management API as the database owner (SUPABASE_ACCESS_TOKEN + SUPABASE_PROJECT_REF; see
// scripts/supabase-mgmt.mjs). Output never contains user ids or emails.
// Admins (profiles.is_admin) are devs automatically and are listed with source 'admin'.
import { pathToFileURL } from 'node:url';

const lit = (s) => `'${String(s).replace(/'/g, "''")}'`;
const USERNAME_RE = /^[a-z0-9_]{3,20}$/;

/** username, or the synthetic "<username>@<domain>" email, -> normalized username. Throws on bad input. */
export function toUsername(who) {
  const s = String(who || '').trim().toLowerCase();
  const u = s.includes('@') ? s.slice(0, s.indexOf('@')) : s;
  if (!USERNAME_RE.test(u)) throw new Error(`not a valid Iceberg username or synthetic email: ${who}`);
  return u;
}

// Resolve by profile username, falling back to the auth user's email local part / metadata
// (covers a user whose profile row is missing). Never selects ids/emails into the output.
const target = (u) => `(select id from public.profiles where username = ${lit(u)}
     union all
     select id from auth.users where lower(split_part(email, '@', 1)) = ${lit(u)} or lower(raw_user_meta_data->>'username') = ${lit(u)}
     limit 1)`;

/** SQL for one command. Every statement ends with a result set describing what happened. */
export function devAccessSQL(cmd, who, { note } = {}) {
  const list = `select coalesce(p.username, '?') as username, 'dev_accounts' as source, d.added_at, d.note
  from public.dev_accounts d left join public.profiles p on p.id = d.user_id
  union all
  select p.username, 'admin', p.created_at, null from public.profiles p
  where p.is_admin and not exists (select 1 from public.dev_accounts d where d.user_id = p.id)
  order by 1;`;
  if (cmd === 'list') return list;
  const u = toUsername(who);
  if (note != null && String(note).length > 200) throw new Error('--note is at most 200 characters');
  if (cmd === 'add') return `with t as (select ${target(u)} as id),
  ins as (insert into public.dev_accounts (user_id, note) select id, ${note == null ? 'null' : lit(note)} from t where id is not null
          on conflict (user_id) do update set note = coalesce(excluded.note, public.dev_accounts.note) returning 1)
select ${lit(u)} as username, (select id is not null from t) as found, (select count(*) from ins) as changed, 'add' as action;`;
  if (cmd === 'remove') return `with t as (select ${target(u)} as id),
  del as (delete from public.dev_accounts where user_id = (select id from t) returning 1)
select ${lit(u)} as username, (select id is not null from t) as found, (select count(*) from del) as changed, 'remove' as action;`;
  throw new Error('usage: dev-access.mjs add|remove <username> [--note text] | list   [--print]');
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const a = process.argv.slice(2), i = a.indexOf('--note');
  const note = i >= 0 ? a[i + 1] : undefined;
  const pos = a.filter((x, j) => !x.startsWith('--') && !(i >= 0 && j === i + 1));
  let sql; try { sql = devAccessSQL(pos[0], pos[1], { note }); } catch (e) { console.error(e.message); process.exit(1); }
  if (a.includes('--print')) { console.log(sql); process.exit(0); }
  const { mgmtQuery } = await import('./supabase-mgmt.mjs');
  const rows = await mgmtQuery(sql);
  console.log(JSON.stringify(rows, null, 2));
  if (pos[0] !== 'list' && rows?.[0] && !rows[0].found) { console.error(`no user with username ${rows[0].username}`); process.exit(2); }
}
