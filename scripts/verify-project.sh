#!/usr/bin/env bash
# Verify the project has all files required before Docker build / Pi deploy.
#
# Usage: bash scripts/verify-project.sh

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

MISSING=0

check_file() {
  if [[ ! -f "$1" ]]; then
    echo "MISSING: $1"
    MISSING=$((MISSING + 1))
  fi
}

check_dir() {
  if [[ ! -d "$1" ]]; then
    echo "MISSING DIR: $1"
    MISSING=$((MISSING + 1))
  fi
}

echo "==> ViewPhoto — project integrity check"

check_file server.js
check_file server/createApp.js
check_file server/config.js
check_file package.json
check_file Dockerfile
check_file docker-compose.yml

check_dir server/routes
check_dir server/middleware
check_dir server/services
check_dir public

check_file server/routes/index.js
check_file server/routes/auth.js
check_file server/routes/health.js
check_file server/routes/folders.js
check_file server/routes/photos.js
check_file server/routes/upload.js
check_file server/routes/trash.js

check_file server/middleware/authGuard.js
check_file server/middleware/rateLimit.js
check_file server/middleware/uploadLimits.js

if ! node -e "require('./server/createApp')" >/dev/null 2>&1; then
  echo "ERROR: server/createApp.js failed to load (check server/routes/)"
  MISSING=$((MISSING + 1))
fi

if [[ "$MISSING" -gt 0 ]]; then
  echo ""
  echo "FAILED: $MISSING problem(s). Fix before deploying to the Pi."
  exit 1
fi

echo "OK — all required files present, createApp loads successfully."
