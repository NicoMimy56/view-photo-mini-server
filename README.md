# ViewPhotoMiniServer

Self-hosted photo gallery for your mini server (Raspberry Pi + CasaOS + Tailscale).

## Features

- Albums as folders (tree view, create, rename, delete when **completely empty**)
- Upload and download photos (JPG, PNG, WebP, GIF, HEIC) with progress bar
- Trash with restore; after 7 days you get a confirmation prompt before permanent delete
- Lightbox with prev/next, swipe, rename, move, batch select (ZIP, move, delete)
- Search, sort by date/name/size/taken (EXIF)
- Duplicate detection on upload (rename / skip / replace)
- Album cover photos
- PWA installable on iPhone + share target for uploads
- Single shared login with rate limiting
- Minimal UI with light/dark theme
- Docker ready on port **3001** (leaves **3000** free for UniStrategy)

## Quick start (local)

```bash
cp .env.example .env
# Edit AUTH_PASSWORD in .env

npm install
npm run dev
```

Open http://localhost:3001

## Deploy on Raspberry Pi (CasaOS)

```bash
cd /mnt/storage/ViewPhoto
bash scripts/setup-server.sh
# Edit .env: APP_BASE_URL, AUTH_PASSWORD
docker compose up -d --build
```

Full guide: [docs/deploy-casaos-it.md](docs/deploy-casaos-it.md)

### Persistent volumes (Docker)

| Host | Content |
|------|---------|
| `./Photos` | Original photos |
| `./thumbnails` | Thumbnail cache |
| `./.trash` | Trash / recycle bin |
| `./data` | Album covers, EXIF metadata |

### Health check

```bash
curl http://localhost:3001/api/health
```

## Tailscale

1. Install Tailscale on the Pi and your phone
2. Note the Pi Tailscale IP (`100.x.y.z`)
3. Set in `.env`: `APP_BASE_URL=http://100.x.y.z:3001`
4. Open the same URL on your phone with Tailscale connected

## Backup

```bash
bash scripts/backup-photos.sh /mnt/backup/viewphoto
```

## Safe delete rules

- Delete moves items to **trash** (restore within 7 days)
- After 7 days: banner + confirmation dialog before freeing disk space (`SVUOTA CESTINO`)
- Folders: deletable only when empty (no files, no subfolders)
- Confirmation: type the exact folder path or file name
