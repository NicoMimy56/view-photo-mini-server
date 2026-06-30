#!/usr/bin/env bash
# Deploy ViewPhoto from your computer to a remote host (e.g. Raspberry Pi).
#
# Setup (once):
#   cp scripts/deploy.env.example scripts/deploy.env
#   nano scripts/deploy.env
#
# Deploy:
#   bash scripts/deploy-to-pi.sh

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

DEPLOY_ENV="${ROOT}/scripts/deploy.env"
if [[ -f "$DEPLOY_ENV" ]]; then
  # shellcheck disable=SC1091
  source "$DEPLOY_ENV"
fi

PI_USER="${PI_USER:-}"
PI_HOST="${PI_HOST:-}"
PI_PATH="${PI_PATH:-}"
PHOTOS_MOUNT="${PHOTOS_MOUNT:-}"

if [[ -z "$PI_USER" || -z "$PI_HOST" || -z "$PI_PATH" ]]; then
  echo "ERROR: Set PI_USER, PI_HOST, and PI_PATH in scripts/deploy.env"
  echo ""
  echo "  cp scripts/deploy.env.example scripts/deploy.env"
  echo "  nano scripts/deploy.env"
  exit 1
fi

REMOTE="${PI_USER}@${PI_HOST}"

RSYNC_EXCLUDES=(
  --exclude node_modules
  --exclude .env
  --exclude .git
  --exclude Photos
  --exclude 'Photos/*'
  --exclude thumbnails
  --exclude .trash
  --exclude data
  --exclude .upload-temp
  --exclude docker-compose.override.yml
  --exclude scripts/deploy.env
  --exclude .DS_Store
  --exclude .cursor
)

echo "========================================"
echo " ViewPhoto — deploy to remote host"
echo " Target: ${REMOTE}:${PI_PATH}"
echo "========================================"
echo ""

echo "==> Step 1/5 — verify local project"
bash scripts/verify-project.sh
echo ""

echo "==> Step 2/5 — prepare remote directory"
ssh "$REMOTE" "mkdir -p '${PI_PATH}'"
ssh "$REMOTE" "sudo chown -R ${PI_USER}:${PI_USER} '${PI_PATH}' 2>/dev/null || true"

if [[ -n "$PHOTOS_MOUNT" ]]; then
  ssh "$REMOTE" "sudo mkdir -p '${PHOTOS_MOUNT}/Photos' '${PHOTOS_MOUNT}/thumbnails' '${PHOTOS_MOUNT}/trash' 2>/dev/null || true"
  ssh "$REMOTE" "sudo chown -R ${PI_USER}:${PI_USER} '${PHOTOS_MOUNT}' 2>/dev/null || true"
fi
echo ""

echo "==> Step 3/5 — sync files (rsync)"
rsync -avz --delete "${RSYNC_EXCLUDES[@]}" ./ "${REMOTE}:${PI_PATH}/"
echo ""

echo "==> Step 4/5 — verify remote project"
ssh "$REMOTE" "cd '${PI_PATH}' && bash scripts/verify-project.sh"
echo ""

echo "==> Step 5/5 — setup + Docker rebuild"
ssh "$REMOTE" "cd '${PI_PATH}' && bash scripts/setup-server.sh"
echo ""

echo "========================================"
echo " Deploy complete"
echo "========================================"
echo " Health:  ssh ${REMOTE} 'curl -s http://localhost:3001/api/health'"
echo " Logs:    ssh ${REMOTE} 'cd ${PI_PATH} && docker compose logs --tail 30 viewphoto'"
echo ""
echo " Remember: copy docker-compose.override.yml to the Pi if using external storage."
echo " Edit .env on the host if this is the first deploy."
