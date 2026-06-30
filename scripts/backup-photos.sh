#!/usr/bin/env bash
# Backup the Photos folder to an external destination (USB/NAS).
#
# Usage:
#   bash scripts/backup-photos.sh /path/to/backup
#
# With external storage (docker-compose.override.yml):
#   PHOTOS_MOUNT=/mnt/usb bash scripts/backup-photos.sh /path/to/backup
#
# Cron example (daily at 3:00 AM):
#   0 3 * * * /path/to/view-photo-mini-server/scripts/backup-photos.sh /path/to/backup >> /var/log/viewphoto-backup.log 2>&1

set -euo pipefail

DEST="${1:-}"
if [[ -z "$DEST" ]]; then
  echo "Usage: $0 /path/to/backup/destination"
  exit 1
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

if [[ -f "${ROOT}/scripts/deploy.env" ]]; then
  # shellcheck disable=SC1091
  source "${ROOT}/scripts/deploy.env"
fi

PHOTOS_MOUNT="${PHOTOS_MOUNT:-}"

if [[ -n "$PHOTOS_MOUNT" && -d "${PHOTOS_MOUNT}/Photos" ]]; then
  SRC="${PHOTOS_MOUNT}/Photos"
else
  SRC="${ROOT}/Photos"
fi

STAMP="$(date +%Y-%m-%d_%H%M%S)"
TARGET="${DEST}/Photos-${STAMP}"

mkdir -p "$DEST"

if [[ ! -d "$SRC" ]]; then
  echo "Photos folder not found: $SRC"
  exit 1
fi

echo "[$(date -Iseconds)] Backup $SRC -> $TARGET"
rsync -a --delete "$SRC/" "$TARGET/"

if ls -1dt "$DEST"/Photos-* >/dev/null 2>&1; then
  ls -1dt "$DEST"/Photos-* | tail -n +8 | xargs -r rm -rf
fi

echo "[$(date -Iseconds)] Backup complete"
