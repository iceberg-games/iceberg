// Generates supabase/seeds/studio_copies_gooberr478.sql from the exported Studio copies of BIRG HQ + Frost Fields.
// The SQL gives the copies to the player whose username is gooberr478 (published, so they show in Your Games and Studio).
// NOT a migration (never auto-applied). Run it by hand with the service role after Colin approves. Idempotent: existing rows are kept.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
const D = new URL('../designs/editor-update/studio-copies/', import.meta.url).pathname;
const OUT = new URL('../supabase/seeds/', import.meta.url).pathname; mkdirSync(OUT, { recursive: true });
let sql = `-- Studio copies of BIRG HQ and Frost Fields, owned by gooberr478 (Editor Update).
-- NOT a migration: apply by hand (service role) once Colin says yes. Idempotent (on conflict do nothing: never overwrites his edits).
-- Each game is a normal published custom game (game_key g_*_studio), so it appears in his Your Games, opens in Studio and he can republish.
-- If no profile with that username exists yet, nothing is inserted (a NOTICE is raised).
do $seed$
declare v_owner uuid;
begin
  select id into v_owner from public.profiles where lower(username) = 'gooberr478';
  if v_owner is null then raise notice 'profile gooberr478 not found; seed skipped'; return; end if;
`;
for (const f of ['birg-hq-studio', 'frost-fields-studio']) {
  const doc = JSON.parse(readFileSync(D + f + '.doc.json', 'utf8'));
  if (JSON.stringify(doc).includes('$seedjson$')) throw new Error('doc contains the quote tag');
  sql += `  insert into public.custom_games (game_key, owner, name, doc, published, published_at)
    values ('${doc.id}', v_owner, '${doc.name.replace(/'/g, "''")}', $seedjson$${JSON.stringify(doc)}$seedjson$::jsonb, true, now())
  on conflict (game_key) do nothing;
`;
}
sql += `end
$seed$;
`;
writeFileSync(OUT + 'studio_copies_gooberr478.sql', sql); console.log('wrote seed', (sql.length / 1024).toFixed(0) + ' KB');
