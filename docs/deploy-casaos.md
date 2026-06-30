# Deploy on Raspberry Pi + CasaOS

Complete guide for ViewPhoto Mini Server with Docker, Tailscale, and persistent storage.

## Requirements

- Raspberry Pi (or Linux host) with [CasaOS](https://www.casaos.io/) and Docker
- [Tailscale](https://tailscale.com) on the Pi and your phone (same account)
- Port **3001** available
- Optional: USB drive or NAS for photo storage

## 1. Get the project on the Pi

**Option A — deploy from your computer:**

```bash
cp scripts/deploy.env.example scripts/deploy.env
nano scripts/deploy.env   # set PI_USER, PI_HOST, PI_PATH

bash scripts/deploy-to-pi.sh
```

**Option B — clone on the Pi:**

```bash
git clone https://github.com/NicoMimy56/view-photo-mini-server.git
cd view-photo-mini-server
```

**Option C — manual rsync:**

```bash
rsync -avz --delete \
  --exclude node_modules --exclude .env --exclude Photos \
  --exclude thumbnails --exclude .trash --exclude data \
  ./ user@100.x.y.z:/home/user/view-photo-mini-server/
```

## 2. First-time setup

```bash
cd /path/to/view-photo-mini-server
bash scripts/setup-server.sh
```

The script will:

1. Verify all source files (including `server/routes/`)
2. Create `./Photos`, `thumbnails`, `.trash`, `data`
3. Copy `.env.example` → `.env` if missing
4. Build and start the Docker container

If files belong to `root`:

```bash
sudo bash scripts/fix-pi-permissions.sh
```

## 3. Configure `.env`

```bash
nano .env
```

Minimum settings:

```env
APP_BASE_URL=http://100.x.y.z:3001
AUTH_USERNAME=admin
AUTH_PASSWORD=your-long-secure-password-here
```

Replace `100.x.y.z` with the Pi Tailscale IP (`tailscale ip -4`).

Restart after changes:

```bash
docker compose up -d --build
```

## 4. External storage (USB / NAS)

By default photos are stored in `./Photos`. For a USB drive:

```bash
cp docker-compose.override.example.yml docker-compose.override.yml
nano docker-compose.override.yml   # set your mount paths
```

Create host folders:

```bash
sudo mkdir -p /mnt/usb/Photos /mnt/usb/thumbnails /mnt/usb/trash
sudo chown -R "$USER:$USER" /mnt/usb
```

Optional — add to `scripts/deploy.env` on your computer:

```env
PHOTOS_MOUNT=/mnt/usb
```

Then rebuild:

```bash
docker compose up -d --build
```

## 5. Access from your phone

1. Enable Tailscale on your iPhone
2. Safari → `http://100.x.y.z:3001`
3. Log in with credentials from `.env`
4. (Optional) Share → **Add to Home Screen** for the PWA

---

## Persistent volumes

| Host folder (default) | Container | Content |
|-----------------------|-----------|---------|
| `./Photos` | `/photos` | Original photos and videos |
| `./thumbnails` | `/thumbnails` | JPEG thumbnails |
| `./.trash` | `/trash` | Trash (7-day restore window) |
| `./data` | `/data` | Album covers, EXIF metadata |

With `docker-compose.override.yml`, replace `./Photos` etc. with your USB mount paths.

**Never delete these folders** — they contain all your data.

---

## Useful commands

```bash
docker compose ps
docker compose logs -f viewphoto
curl -s http://localhost:3001/api/health
docker compose down
git pull && docker compose up -d --build
```

---

## Backup

```bash
bash scripts/backup-photos.sh /path/to/backup
```

With external storage:

```bash
PHOTOS_MOUNT=/mnt/usb bash scripts/backup-photos.sh /path/to/backup
```

---

## HEIC / iPhone photos

The Docker image includes `libheif` for HEIC thumbnails and browser preview.
Original HEIC files stay in `Photos/`; download returns the original file.

---

## Security checklist

- [ ] Strong `AUTH_PASSWORD` (12+ characters)
- [ ] Access only via **Tailscale** — do not port-forward 3001 to the internet
- [ ] `.env` never committed to git
- [ ] Regular backups of your photos folder

Login rate limit: 8 attempts per 15 minutes.

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| `Cannot find module './routes'` | Incomplete copy — redeploy with `bash scripts/deploy-to-pi.sh` |
| Container won't start | `docker compose logs viewphoto` |
| Health returns `503` | Ensure `Photos`, `thumbnails`, `.trash`, `data` exist |
| Empty gallery after update | Check `docker-compose.override.yml` paths match your USB mount |
| Permission denied | `sudo bash scripts/fix-pi-permissions.sh` |
| Slow first build on Pi | Normal (5–15 min for sharp + libheif) |

---

## Updating

```bash
git pull
bash scripts/setup-server.sh
```

Volumes are preserved across updates.
