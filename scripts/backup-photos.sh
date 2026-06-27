#!/usr/bin/env bash
# Backup the Photos folder to an external destination (USB/NAS).
#
# Usage:
#   bash scripts/backup-photos.sh /mnt/backup/viewphoto
#
# Nightly cron example (3:00 AM):
#   0 3 * * * /mnt/storage/ViewPhoto/scripts/backup-photos.sh /mnt/backup/viewphoto >> /var/log/viewphoto-backup.log 2>&1

set -euo pipefail

DEST="${1:-}"
if [[ -z "$DEST" ]]; then
  echo "Usage: $0 /path/to/backup/destination"
  exit 1
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/Photos"
STAMP="$(date +%Y-%m-%d_%H%M%S)"
TARGET="$DEST/Photos-$STAMP"

mkdir -p "$DEST"

if [[ ! -d "$SRC" ]]; then
  echo "Photos folder not found: $SRC"
  exit 1
fi

echo "[$(date -Iseconds)] Backup $SRC -> $TARGET"
rsync -a --delete "$SRC/" "$TARGET/"

# Keep only the last 7 snapshots
if ls -1dt "$DEST"/Photos-* >/dev/null 2>&1; then
  ls -1dt "$DEST"/Photos-* | tail -n +8 | xargs -r rm -rf
fi

echo "[$(date -Iseconds)] Backup complete"
