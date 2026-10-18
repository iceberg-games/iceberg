#!/usr/bin/env node
// Set / extend / show a limited-time event window (public.game_events). Server time is the truth.
//
//   node scripts/event-window.mjs natural_disasters --start now --days 7            # release default
//   node scripts/event-window.mjs natural_disasters --start 2026-10-20T17:00:00Z --end 2026-10-27T17:00:00Z
//   node scripts/event-window.mjs natural_disasters --extend-days 2                  # push ends_at later
//   node scripts/event-window.mjs natural_disasters --grace-hours 48 | --off | --on   # claim grace / pause
//   node scripts/event-window.mjs natural_disasters --show
// Add --print to only print the SQL (paste into the Supabase SQL editor). Otherwise it runs via the
// Management API (SUPABASE_ACCESS_TOKEN + SUPABASE_PROJECT_REF; see scripts/supabase-mgmt.mjs).
import { pathToFileURL } from 'node:url';

const lit = (s) => `'${String(s).replace(/'/g, "''")}'`;
const tsExpr = (v) => (v === 'now' ? 'now()' : `${lit(new Date(v).toISOString())}::timestamptz`);

/** SQL for one change. Throws on bad input. */
export function eventWindowSQL(eventId, o = {}) {
  if (!/^[a-z0-9_-]{1,40}$/.test(eventId || '')) throw new Error('event id must match [a-z0-9_-]{1,40}');
  const id = lit(eventId), sets = [];
  for (const k of ['start', 'end']) if (o[k] && o[k] !== 'now' && Number.isNaN(Date.parse(o[k]))) throw new Error(`bad --${k} ${o[k]}`);
  if (o.start) {
    sets.push(`starts_at = ${tsExpr(o.start)}`);
    if (o.end) sets.push(`ends_at = ${tsExpr(o.end)}`);
    else sets.push(`ends_at = ${tsExpr(o.start)} + interval '${Number(o.days ?? 7)} days'`);
  } else if (o.end) sets.push(`ends_at = ${tsExpr(o.end)}`);
  if (o.extendDays != null) { if (!(+o.extendDays > 0)) throw new Error('--extend-days must be > 0'); sets.push(`ends_at = ends_at + interval '${+o.extendDays} days'`); }
  if (o.graceHours != null) { if (!(+o.graceHours >= 0)) throw new Error('--grace-hours must be >= 0'); sets.push(`claim_grace = interval '${+o.graceHours} hours'`); }
  if (o.active != null) sets.push(`active = ${o.active ? 'true' : 'false'}`);
  const show = `select id, title, starts_at, ends_at, claim_grace, active, public.event_status(id) as status from public.game_events where id = ${id};`;
  if (!sets.length) return show;
  return `update public.game_events set ${sets.join(', ')}, updated_at = now() where id = ${id}${o.extendDays != null ? ' and ends_at is not null' : ''};\n${show}`;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const a = process.argv.slice(2), id = a[0], val = (f) => { const i = a.indexOf(f); return i >= 0 ? a[i + 1] : undefined; };
  const sql = eventWindowSQL(id, { start: val('--start'), end: val('--end'), days: val('--days'), extendDays: val('--extend-days'),
    graceHours: val('--grace-hours'), active: a.includes('--off') ? false : a.includes('--on') ? true : undefined });
  if (a.includes('--print')) { console.log(sql); process.exit(0); }
  const { mgmtQuery } = await import('./supabase-mgmt.mjs');
  console.log(JSON.stringify(await mgmtQuery(sql), null, 2));
}
