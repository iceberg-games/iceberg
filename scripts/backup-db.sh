#!/usr/bin/env bash
# Back up the real Supabase database (public schema) to a directory OUTSIDE the repo.
#   SUPABASE_DB_URL=postgres://...  scripts/backup-db.sh [dir]        pg_dump (schema + data)
#   SUPABASE_ACCESS_TOKEN=... SUPABASE_PROJECT_REF=... scripts/backup-db.sh [dir]
#       HTTPS fallback via the Management API when Postgres ports are blocked: JSON export of
#       every public table (restorable with jsonb_populate_recordset) + the migration list.
# Default dir: /home/box/iceberg-backups. Credentials come from env only and are never printed.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEST="${1:-${BACKUP_DIR:-/home/box/iceberg-backups}}"
mkdir -p "$DEST"; chmod 700 "$DEST"
if [ -n "${SUPABASE_DB_URL:-}" ]; then
  BACKUP_DIR="$DEST" node "$ROOT/scripts/db-backup.mjs" --remote --out "$DEST"
elif [ -n "${SUPABASE_ACCESS_TOKEN:-}" ]; then
  DEST="$DEST" node --input-type=module -e '
    import { mgmtQuery } from "'"$ROOT"'/scripts/supabase-mgmt.mjs";
    import { writeFileSync } from "node:fs";
    const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const tables = (await mgmtQuery(`select tablename from pg_tables where schemaname = $$public$$ order by 1`)).map(r => r.tablename);
    const out = { project: process.env.SUPABASE_PROJECT_REF, at: new Date().toISOString(), tables: {} };
    for (const t of tables) out.tables[t] = (await mgmtQuery(`select coalesce(jsonb_agg(x), $$[]$$::jsonb) rows from public."${t}" x`))[0].rows;
    const file = `${process.env.DEST}/iceberg-supabase-${stamp}.json`;
    writeFileSync(file, JSON.stringify(out), { mode: 0o600 });
    console.log(`remote backup (Management API): ${file} — ${tables.length} tables, ${Object.values(out.tables).reduce((n, r) => n + r.length, 0)} rows`);'
else
  echo "Set SUPABASE_DB_URL or SUPABASE_ACCESS_TOKEN + SUPABASE_PROJECT_REF" >&2; exit 1
fi
ls -la "$DEST" | tail -3
