#!/usr/bin/env bash
# Fix ownership when project files were copied as root.
#
# On the host:
#   sudo bash scripts/fix-pi-permissions.sh
#
# From another machine:
#   ssh user@host 'sudo bash /path/to/view-photo-mini-server/scripts/fix-pi-permissions.sh'

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

if [[ -f "${ROOT}/scripts/deploy.env" ]]; then
  # shellcheck disable=SC1091
  source "${ROOT}/scripts/deploy.env"
fi

TARGET_USER="${PI_USER:-${SUDO_USER:-${USER}}}"
PHOTOS_MOUNT="${PHOTOS_MOUNT:-}"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run with sudo: sudo bash $0"
  exit 1
fi

echo "==> Fixing ownership for ${TARGET_USER}"

chown -R "${TARGET_USER}:${TARGET_USER}" "${ROOT}"
echo "OK: ${ROOT}"

if [[ -n "$PHOTOS_MOUNT" && -d "$PHOTOS_MOUNT" ]]; then
  mkdir -p "${PHOTOS_MOUNT}/Photos" "${PHOTOS_MOUNT}/thumbnails" "${PHOTOS_MOUNT}/trash"
  chown -R "${TARGET_USER}:${TARGET_USER}" "$PHOTOS_MOUNT"
  echo "OK: ${PHOTOS_MOUNT}"
fi

echo ""
echo "Next: cd ${ROOT} && bash scripts/setup-server.sh"
