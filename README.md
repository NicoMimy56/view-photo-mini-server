# ViewPhoto Mini Server

Galleria privata per foto e video. Gira su un Raspberry Pi, un NAS o un qualsiasi computer con Docker. Gli album sono cartelle sul disco: niente database e niente cloud.

![Node.js](https://img.shields.io/badge/node-%3E%3D20-brightgreen)
![Docker](https://img.shields.io/badge/docker-ready-blue)
![License: MIT](https://img.shields.io/badge/license-MIT-green)

## Funzioni

- **Album come cartelle** — albero, crea, rinomina, elimina solo se la cartella è vuota
- **Caricamento e download** — JPG, PNG, WebP, GIF, HEIC/HEIF, MP4, MOV, con barra di avanzamento
- **Cestino** — ripristino per 7 giorni, poi conferma scritta prima della cancellazione definitiva
- **Lightbox** — avanti/indietro, swipe, rinomina, sposta, selezione multipla (ZIP, sposta, elimina)
- **Ricerca e ordinamento** — data file, data EXIF, nome o dimensione
- **Doppioni** — in caricamento puoi rinominare, saltare o sostituire
- **Copertine** — anteprima a mosaico sulle cartelle, anche da telefono
- **PWA** — si può aggiungere alla Home dell’iPhone e ricevere le foto dal menu Condividi
- **Un solo login** — con limite ai tentativi
- **Interfaccia essenziale** — tema chiaro/scuro, usabile da telefono
- **Docker** — porta **3001**, arm64 e amd64

## Scaricare e avviare

Con Git:

```bash
git clone https://github.com/NicoMimy56/view-photo-mini-server.git
cd view-photo-mini-server
```

Senza Git: sulla pagina GitHub apri **Code → Download ZIP** e scompatta lo zip.

Poi crea la configurazione e cambia `AUTH_PASSWORD` dentro `.env`:

```bash
cp .env.example .env
```

Con Docker, le foto finiscono in `Photos/` accanto al progetto:

```bash
docker compose up -d --build
```

Senza Docker, solo per provarlo sul computer:

```bash
npm install
npm run dev
```

Apri [http://localhost:3001](http://localhost:3001).

Per un disco esterno copia `docker-compose.override.example.yml` in `docker-compose.override.yml`, sostituisci `/mnt/usb` con il tuo punto di montaggio e rilancia `docker compose up -d --build`.

Per un Raspberry Pi la guida è **[docs/deploy-casaos.md](docs/deploy-casaos.md)**. Dal computer si può anche copiare il progetto sul Pi con `scripts/deploy.env` (partendo da `scripts/deploy.env.example`) e `bash scripts/deploy-to-pi.sh`.

Non pubblicare `.env`, `scripts/deploy.env`, `docker-compose.override.yml` né le cartelle `Photos/`, `thumbnails/`, `.trash/` e `data/`. Sono già in `.gitignore`.

## Configurazione

| Variabile | A cosa serve |
|-----------|----------------|
| `APP_BASE_URL` | Indirizzo con cui apri l’app, senza slash finale |
| `AUTH_USERNAME` / `AUTH_PASSWORD` | Login condiviso |
| `MAX_UPLOAD_MB` | Dimensione massima di un file (predefinito 200) |
| `TRASH_RETENTION_DAYS` | Giorni nel cestino prima della conferma di svuotamento (predefinito 7) |
| `TZ` | Fuso orario (predefinito UTC) |

L’elenco completo è in `.env.example`.

## Accesso da fuori casa con Tailscale

1. Installa [Tailscale](https://tailscale.com) sul server e sul telefono, con lo stesso account.
2. Sul server: `tailscale ip -4` (un indirizzo tipo `100.x.y.z`).
3. In `.env`: `APP_BASE_URL=http://100.x.y.z:3001`
4. Riavvia con `docker compose up -d`.
5. Apri quell’indirizzo dal telefono, con Tailscale attivo. Da Safari: Condividi → **Aggiungi a Home**.

La porta 3001 va lasciata solo su Tailscale, non aperta su internet.

## Backup

```bash
bash scripts/backup-photos.sh /path/to/backup
```

## Licenza

[MIT](LICENSE).

## Contributi

Issue e pull request sono benvenute. Non inserire password, file `.env` o foto personali.
