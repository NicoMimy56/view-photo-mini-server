# ViewPhoto Mini Server

Self-hosted photo and video gallery for a home mini server (Raspberry Pi, CasaOS, Tailscale). Albums are folders on disk — no database, no cloud lock-in.

![Node.js](https://img.shields.io/badge/node-%3E%3D20-brightgreen)
![Docker](https://img.shields.io/badge/docker-ready-blue)
![License: MIT](https://img.shields.io/badge/license-MIT-green)

## Features

- **Albums as folders** — tree view, create, rename, delete (only when completely empty)
- **Upload & download** — JPG, PNG, WebP, GIF, HEIC/HEIF, MP4, MOV with progress bar
- **Trash with restore** — items kept for 7 days, then a typed confirmation before permanent delete
- **Lightbox** — prev/next, swipe, rename, move, batch select (ZIP download, move, delete)
- **Search & sort** — by date modified, EXIF taken date, name, or file size
- **Duplicate detection** — rename, skip, or replace on upload
- **Album covers** — pick any photo as a folder cover
- **PWA** — installable on iPhone, iOS share target for quick uploads
- **Single shared login** — with brute-force rate limiting
- **Minimal UI** — light/dark theme, mobile-friendly browse
- **Docker ready** — runs on port **3001** by default

## Quick start (local development)

```bash
git clone https://github.com/YOUR_USERNAME/view-photo-mini-server.git
cd view-photo-mini-server

cp .env.example .env
# Edit AUTH_PASSWORD in .env before going online

npm install
npm run dev
```

Open [http://localhost:3001](http://localhost:3001)

## Deploy on Raspberry Pi (Docker + CasaOS)

```bash
git clone https://github.com/YOUR_USERNAME/view-photo-mini-server.git /mnt/storage/ViewPhoto
cd /mnt/storage/ViewPhoto

bash scripts/setup-server.sh
# Edit .env: APP_BASE_URL and AUTH_PASSWORD

docker compose ps
curl -s http://localhost:3001/api/health
```

Full guide: **[docs/deploy-casaos.md](docs/deploy-casaos.md)**

### Persistent data (Docker volumes)

| Host path | Content |
|-----------|---------|
| `./Photos` | Original photos and videos |
| `./thumbnails` | Generated thumbnail cache |
| `./.trash` | Trash / recycle bin |
| `./data` | Album covers, EXIF metadata |

These directories are created automatically by `scripts/setup-server.sh`. **Do not delete them** — they hold all your data.

### External storage (USB / NAS)

By default, photos are stored in `./Photos` next to the project. To use an external disk, copy the override template:

```bash
cp docker-compose.override.example.yml docker-compose.override.yml
# Edit paths, then restart:
docker compose up -d --build
```

## Configuration

Copy `.env.example` to `.env`. Key settings:

| Variable | Description |
|----------|-------------|
| `APP_BASE_URL` | Public URL (Tailscale IP recommended), no trailing slash |
| `AUTH_USERNAME` / `AUTH_PASSWORD` | Shared login credentials |
| `MAX_UPLOAD_MB` | Max file size per upload (default 200) |
| `TRASH_RETENTION_DAYS` | Days before purge confirmation (default 7) |
| `TZ` | Timezone (default `Europe/Rome`) |

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
bash scripts/backup-photos.sh /mnt/backup/viewphoto
```

Nightly cron example:

```cron
0 3 * * * /mnt/storage/ViewPhoto/scripts/backup-photos.sh /mnt/backup/viewphoto >> /var/log/viewphoto-backup.log 2>&1
```

## Safe delete rules

- Delete moves items to **trash** (restorable for 7 days).
- After 7 days: banner + typed confirmation (`EMPTY TRASH`) before freeing disk space.
- Folders: deletable only when empty (no files, no subfolders).
- Destructive actions require typing the exact folder path or file name.

## Health check

```bash
curl http://localhost:3001/api/health
```

## Project structure

```
├── public/           # Frontend (PWA)
├── server/           # Express API, auth, photo store
├── scripts/          # setup-server.sh, backup-photos.sh
├── docs/             # Deployment guides
├── docker-compose.yml
├── Dockerfile
└── .env.example
```

## Tech stack

- **Backend:** Node.js 20, Express 5, sharp (thumbnails + HEIC), multer
- **Frontend:** Vanilla JS modules, CSS, service worker
- **Deploy:** Docker (arm64 + amd64), CasaOS compatible

## License

[MIT](LICENSE) — free to use, modify, and share.

## Contributing

Issues and pull requests are welcome. Please do not commit `.env`, photos, or personal data.
