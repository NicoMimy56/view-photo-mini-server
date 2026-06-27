#!/usr/bin/env bash
# Backup cartella Photos verso destinazione esterna (USB/NAS).
# Uso: bash scripts/backup-photos.sh /mnt/backup/viewphoto
#
# Aggiungi a crontab sul Pi, es. ogni notte alle 3:00:
# 0 3 * * * /mnt/storage/ViewPhoto/scripts/backup-photos.sh /mnt/backup/viewphoto >> /var/log/viewphoto-backup.log 2>&1

set -euo pipefail

DEST="${1:-}"
if [[ -z "$DEST" ]]; then
  echo "Uso: $0 /percorso/backup"
  exit 1
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/Photos"
STAMP="$(date +%Y-%m-%d_%H%M%S)"
TARGET="$DEST/Photos-$STAMP"

mkdir -p "$DEST"

if [[ ! -d "$SRC" ]]; then
  echo "Cartella Photos non trovata: $SRC"
  exit 1
fi

echo "[$(date -Iseconds)] Backup $SRC -> $TARGET"
rsync -a --delete "$SRC/" "$TARGET/"

# Mantieni solo gli ultimi 7 snapshot (opzionale)
ls -1dt "$DEST"/Photos-* 2>/dev/null | tail -n +8 | xargs -r rm -rf

echo "[$(date -Iseconds)] Backup completato"
