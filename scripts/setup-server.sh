#!/usr/bin/env bash
# Primo setup ViewPhoto sul mini server (Raspberry Pi + CasaOS).
# Uso: bash scripts/setup-server.sh

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "==> ViewPhoto — setup cartelle dati"
mkdir -p Photos thumbnails .trash/data data

if [[ ! -f .env ]]; then
  cp .env.example .env
  echo "==> Creato .env — MODIFICA AUTH_PASSWORD e APP_BASE_URL prima di andare online!"
else
  echo "==> .env già presente, non sovrascritto"
fi

if ! grep -q '^AUTH_PASSWORD=.\{12,\}' .env 2>/dev/null; then
  echo "ATTENZIONE: imposta AUTH_PASSWORD lunga in .env"
fi

echo "==> Build e avvio Docker"
docker compose up -d --build

echo ""
echo "Fatto. Controlla lo stato:"
echo "  docker compose ps"
echo "  docker compose logs -f viewphoto"
echo ""
echo "Health: curl -s http://localhost:3001/api/health"
echo "Apri da telefono (Tailscale): http://<IP-TAILSCALE-PI>:3001"
