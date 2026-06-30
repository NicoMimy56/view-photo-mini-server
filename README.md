# ViewPhoto Mini Server

Self-hosted photo and video gallery for a home mini server (Raspberry Pi, CasaOS, Tailscale). Albums are folders on disk — no database, no cloud lock-in.

![Node.js](https://img.shields.io/badge/node-%3E%3D20-brightgreen)
![Docker](https://img.shields.io/badge/docker-ready-blue)
![License: MIT](https://img.shields.io/badge/license-MIT-green)

## Features

- **Albums as folders** — tree view, create, rename, delete (only when completely empty)
- **Upload & download** — JPG, PNG, WebP, GIF, HEIC/HEIF, MP4, MOV with progress bar
- **Trash with restore** — items kept for 7 days, then typed confirmation before permanent delete
- **Lightbox** — prev/next, swipe, rename, move, batch select (ZIP download, move, delete)
- **Search & sort** — by date modified, EXIF taken date, name, or file size
- **Duplicate detection** — rename, skip, or replace on upload
- **Album covers & mobile previews** — mosaic thumbnails on folder cards
- **PWA** — installable on iPhone, iOS share target for quick uploads
- **Single shared login** — with brute-force rate limiting
- **Minimal UI** — light/dark theme, mobile-friendly browse
- **Docker ready** — runs on port **3001** by default (arm64 + amd64)

## Quick start (local development)

```bash
git clone https://github.com/NicoMimy56/view-photo-mini-server.git
cd view-photo-mini-server

cp .env.example .env
# Edit AUTH_PASSWORD in .env before going online

npm install
npm run verify   # optional: check all server files are present
npm run dev
```

Open [http://localhost:3001](http://localhost:3001)

## Deploy with Docker

```bash
cp .env.example .env
bash scripts/setup-server.sh
```

Default storage is `./Photos` next to the project. For an external USB drive or NAS:

```bash
cp docker-compose.override.example.yml docker-compose.override.yml
# Edit mount paths, then:
docker compose up -d --build
```

Full Pi guide: **[docs/deploy-casaos.md](docs/deploy-casaos.md)**

## Deploy to a remote host (e.g. Raspberry Pi)

1. Copy the deploy config template (this file is gitignored — safe for your IPs and paths):

```bash
cp scripts/deploy.env.example scripts/deploy.env
nano scripts/deploy.env
```

2. Deploy:

```bash
bash scripts/deploy-to-pi.sh
```

3. On the host, edit `.env` (`AUTH_PASSWORD`, `APP_BASE_URL`) and restart if needed.

## Configuration

| Variable | Description |
|----------|-------------|
| `APP_BASE_URL` | Public URL (Tailscale IP recommended), no trailing slash |
| `AUTH_USERNAME` / `AUTH_PASSWORD` | Shared login credentials |
| `MAX_UPLOAD_MB` | Max file size per upload (default 200) |
| `TRASH_RETENTION_DAYS` | Days before purge confirmation (default 7) |
| `TZ` | Timezone (default UTC) |

See `.env.example` for the full list.

## Remote access with Tailscale

1. Install [Tailscale](https://tailscale.com) on the Pi and your phone (same account).
2. Get the Pi Tailscale IP: `tailscale ip -4` → e.g. `100.x.y.z`
3. Set in `.env`: `APP_BASE_URL=http://100.x.y.z:3001`
4. Restart: `docker compose up -d`
5. Open the URL on your phone with Tailscale connected.
6. (Optional) Safari → Share → **Add to Home Screen** for the PWA.

> **Security:** Access via Tailscale only. Do not expose port 3001 to the public internet.

## Backup

```bash
bash scripts/backup-photos.sh /path/to/backup
```

## Project structure

```
├── public/              # Frontend (PWA)
├── server/              # Express API, auth, photo store
│   └── routes/          # API route modules (required for Docker build)
├── scripts/             # setup, deploy, backup, verify
├── docs/                # Deployment guides
├── docker-compose.yml
├── Dockerfile
└── .env.example
```

## Tech stack

- **Backend:** Node.js 20, Express 5, sharp (thumbnails + HEIC), multer
- **Frontend:** Vanilla JS modules, CSS, service worker
- **Deploy:** Docker, CasaOS compatible

## Publishing this repo

The project is ready to be public. Before switching visibility:

1. Ensure `.env` and `scripts/deploy.env` are **not** tracked (they are in `.gitignore`).
2. Do not commit personal photos (`Photos/*` is ignored except `.gitkeep`).
3. Push the latest code, then:

```bash
gh repo edit NicoMimy56/view-photo-mini-server --visibility public
```

## License

[MIT](LICENSE) — free to use, modify, and share.

## Contributing

Issues and pull requests are welcome. Please do not commit secrets, `.env`, or personal photos.
