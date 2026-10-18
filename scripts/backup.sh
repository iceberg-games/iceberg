#!/usr/bin/env bash
# Local source backup: a tarball of the working tree (no node_modules/dist) plus a
# git bundle of all history. Nothing leaves this machine.
#   scripts/backup.sh [backup-dir]      (default /workspace/backups)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEST="${1:-${BACKUP_DIR:-/workspace/backups}}"
STAMP="$(date +%Y%m%d-%H%M%S)"
mkdir -p "$DEST"
tar --exclude=node_modules --exclude=dist --exclude=dist-site --exclude=.devdb \
    -czf "$DEST/blockworld-src-$STAMP.tgz" -C "$(dirname "$ROOT")" "$(basename "$ROOT")"
if git -C "$ROOT" rev-parse --git-dir >/dev/null 2>&1; then
  git -C "$ROOT" bundle create "$DEST/blockworld-$STAMP.bundle" --all >/dev/null 2>&1
fi
ls -la "$DEST" | grep "$STAMP"
