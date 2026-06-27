# Deploy on Raspberry Pi + CasaOS

Complete guide for ViewPhoto Mini Server with Docker, Tailscale, and persistent storage.

## Requirements

- Raspberry Pi (or any Linux host) with [CasaOS](https://www.casaos.io/) and Docker
- [Tailscale](https://tailscale.com) on the Pi and your phone (same account)
- Port **3001** available on the host
- Recommended: USB drive or NAS mounted at a stable path (e.g. `/mnt/storage/ViewPhoto`)

## 1. Clone the project

```bash
cd /mnt/storage
git clone https://github.com/YOUR_USERNAME/view-photo-mini-server.git ViewPhoto
cd ViewPhoto
```

Or copy the folder from your Mac with `rsync`:

```bash
rsync -av --exclude node_modules --exclude .env --exclude Photos \
  ./ViewPhotoMiniServer/ pi@100.x.y.z:/mnt/storage/ViewPhoto/
```

## 2. First-time setup (automated)

```bash
cd /mnt/storage/ViewPhoto
bash scripts/setup-server.sh
```

The script will:

1. Create data directories (`Photos`, `thumbnails`, `.trash`, `data`)
2. Copy `.env.example` → `.env` if missing
3. Validate that `AUTH_PASSWORD` is set
4. Build and start the Docker container

## 3. Configure `.env`

Edit `.env` and set at minimum:

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

## 4. Access from your phone

1. Enable Tailscale on your iPhone
2. Safari → `http://100.x.y.z:3001`
3. Log in with credentials from `.env`
4. (Optional) Share → **Add to Home Screen** for the PWA

---

## Persistent volumes

| Host folder | Container path | Content |
|-------------|----------------|---------|
| `./Photos` | `/photos` | Original photos and videos |
| `./thumbnails` | `/thumbnails` | JPEG thumbnails |
| `./.trash` | `/trash` | Trash (7-day restore window) |
| `./data` | `/data` | Album covers, EXIF metadata |

**Never delete these folders** — they contain all your data.

### Using an external disk

If you want photos on a USB drive instead of the project folder:

```bash
cp docker-compose.override.example.yml docker-compose.override.yml
nano docker-compose.override.yml   # set your mount paths
docker compose up -d --build
```

Create host directories first:

```bash
sudo mkdir -p /mnt/photos/Photos /mnt/photos/thumbnails /mnt/photos/trash
sudo chown -R "$USER:$USER" /mnt/photos
```

---

## Useful commands

```bash
# Container status
docker compose ps

# Live logs
docker compose logs -f viewphoto

# Health check
curl -s http://localhost:3001/api/health | jq

# Stop
docker compose down

# Update after git pull
git pull
docker compose up -d --build
```

---

## Backup (recommended)

Nightly backup to USB/NAS:

```bash
bash scripts/backup-photos.sh /mnt/backup/viewphoto
```

Crontab (every night at 3:00 AM):

```cron
0 3 * * * /mnt/storage/ViewPhoto/scripts/backup-photos.sh /mnt/backup/viewphoto >> /var/log/viewphoto-backup.log 2>&1
```

The script keeps the last 7 snapshots and prunes older ones.

---

## HEIC / iPhone photos

The Docker image includes `libheif` for HEIC thumbnails and browser preview.
Original HEIC files stay in `Photos/`; download returns the original file.

---

## Security checklist

- [ ] Strong `AUTH_PASSWORD` (12+ characters)
- [ ] Access only via **Tailscale** — do not port-forward 3001 to the internet
- [ ] `.env` never committed to git
- [ ] Regular backups of `./Photos`

Login rate limit: 8 attempts per 15 minutes.

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Container won't start | `docker compose logs viewphoto` |
| Health returns `503` | Ensure `Photos`, `thumbnails`, `.trash`, `data` exist |
| Session expired after restart | Normal — sessions are in-memory; log in again |
| Albums not visible | Restart container; hard refresh browser (Cmd+Shift+R) |
| Slow first build on Pi | First build takes 5–15 min (sharp + libheif); later builds are faster |
| Permission denied on volumes | `sudo chown -R $USER:$USER Photos thumbnails .trash data` |

---

## Updating

```bash
cd /mnt/storage/ViewPhoto
git pull
docker compose up -d --build
```

Volumes (`Photos`, `thumbnails`, `.trash`, `data`) are preserved across updates.
