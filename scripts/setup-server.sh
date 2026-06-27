#!/usr/bin/env bash
# First-time setup for ViewPhoto Mini Server (Raspberry Pi, CasaOS, or any Docker host).
#
# Usage:
#   bash scripts/setup-server.sh           # build and start
#   bash scripts/setup-server.sh --no-start   # prepare dirs and .env only

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

NO_START=false
for arg in "$@"; do
  case "$arg" in
    --no-start) NO_START=true ;;
    -h|--help)
      echo "Usage: $0 [--no-start]"
      echo "  --no-start  Create directories and .env only, skip Docker"
      exit 0
      ;;
  esac
done

echo "==> ViewPhoto — data directory setup"
mkdir -p Photos thumbnails .trash/data data

if [[ ! -f Photos/.gitkeep ]]; then
  touch Photos/.gitkeep
fi

if [[ ! -f .env ]]; then
  cp .env.example .env
  echo "==> Created .env from .env.example"
  echo "    Edit AUTH_PASSWORD and APP_BASE_URL before going online!"
else
  echo "==> .env already exists (not overwritten)"
fi

if ! grep -qE '^AUTH_PASSWORD=.{12,}' .env 2>/dev/null; then
  echo ""
  echo "WARNING: Set a strong AUTH_PASSWORD (12+ characters) in .env"
  echo ""
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "ERROR: Docker is not installed or not in PATH."
  exit 1
fi

if [[ "$NO_START" == true ]]; then
  echo "==> Skipping Docker (--no-start)"
  echo ""
  echo "Next steps:"
  echo "  1. Edit .env (AUTH_PASSWORD, APP_BASE_URL)"
  echo "  2. docker compose up -d --build"
  exit 0
fi

echo "==> Building and starting Docker container"
docker compose up -d --build

echo ""
echo "Done. Check status:"
echo "  docker compose ps"
echo "  docker compose logs -f viewphoto"
echo ""
echo "Health: curl -s http://localhost:3001/api/health"
echo "Phone (Tailscale): http://<PI-TAILSCALE-IP>:3001"
