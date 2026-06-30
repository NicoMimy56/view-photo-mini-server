#!/usr/bin/env bash
# First-time setup for ViewPhoto Mini Server (Docker host or Raspberry Pi).
#
# Usage:
#   bash scripts/setup-server.sh            # full setup + start
#   bash scripts/setup-server.sh --no-start   # dirs + .env only, skip Docker

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

NO_START=false
for arg in "$@"; do
  case "$arg" in
    --no-start) NO_START=true ;;
    -h|--help)
      echo "Usage: $0 [--no-start]"
      exit 0
      ;;
  esac
done

if [[ -f scripts/deploy.env ]]; then
  # shellcheck disable=SC1091
  source scripts/deploy.env
fi

PHOTOS_MOUNT="${PHOTOS_MOUNT:-}"

echo "==> ViewPhoto — setup on $(hostname)"
echo "    Project: ${ROOT}"
echo ""

if [[ ! -O "$ROOT" ]] && [[ "$(id -u)" -ne 0 ]]; then
  echo "ERROR: ${ROOT} is not owned by ${USER}."
  echo "       Run: sudo bash scripts/fix-pi-permissions.sh"
  exit 1
fi

echo "==> 1/5 Verify project files"
bash scripts/verify-project.sh
echo ""

echo "==> 2/5 Local data directories"
mkdir -p Photos thumbnails .trash/data data
touch Photos/.gitkeep 2>/dev/null || true
echo "    OK — Photos, thumbnails, .trash, data"
echo ""

echo "==> 3/5 External storage (optional)"
if [[ -n "$PHOTOS_MOUNT" ]]; then
  if [[ ! -d "$(dirname "$PHOTOS_MOUNT")" ]]; then
    echo "WARNING: parent of PHOTOS_MOUNT does not exist: ${PHOTOS_MOUNT}"
  else
    sudo mkdir -p "${PHOTOS_MOUNT}/Photos" "${PHOTOS_MOUNT}/thumbnails" "${PHOTOS_MOUNT}/trash"
    sudo chown -R "$USER:$USER" "$PHOTOS_MOUNT" 2>/dev/null || true
    echo "    OK — ${PHOTOS_MOUNT}/{Photos,thumbnails,trash}"
  fi
elif [[ -f docker-compose.override.yml ]]; then
  echo "    docker-compose.override.yml found — ensure host paths exist before starting Docker"
else
  echo "    Using ./Photos (default). For USB storage, copy docker-compose.override.example.yml"
fi
echo ""

echo "==> 4/5 Environment (.env)"
if [[ ! -f .env ]]; then
  cp .env.example .env
  echo "    Created .env — edit AUTH_PASSWORD and APP_BASE_URL!"
else
  echo "    .env already exists (kept)"
fi

if ! grep -qE '^AUTH_PASSWORD=.{12,}' .env 2>/dev/null; then
  echo ""
  echo "WARNING: Set AUTH_PASSWORD (12+ chars) in .env before going online."
  echo ""
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "ERROR: Docker not found."
  exit 1
fi

if [[ "$NO_START" == true ]]; then
  echo "==> Skipped Docker (--no-start)"
  echo "Next: docker compose up -d --build"
  exit 0
fi

echo "==> 5/5 Build and start Docker"
docker compose down 2>/dev/null || true
docker compose up -d --build

echo ""
echo "Waiting for health check..."
for i in 1 2 3 4 5 6; do
  if curl -sf http://localhost:3001/api/health >/dev/null 2>&1; then
    echo "OK — server is healthy"
    curl -s http://localhost:3001/api/health
    echo ""
    break
  fi
  sleep 5
  if [[ "$i" -eq 6 ]]; then
    echo "WARNING — health check failed. Logs:"
    docker compose logs --tail 40 viewphoto 2>/dev/null || docker compose logs --tail 40 ViewPhotoApp
    exit 1
  fi
done

echo ""
echo "Done."
echo "  Status:  docker compose ps"
echo "  Logs:    docker compose logs -f viewphoto"
echo "  Phone:   open APP_BASE_URL from .env (Tailscale required)"
