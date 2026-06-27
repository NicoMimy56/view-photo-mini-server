# Deploy su Raspberry Pi + CasaOS

Guida completa per ViewPhotoMiniServer con Docker, Tailscale e dati persistenti.

## Prerequisiti

- Raspberry Pi con CasaOS e Docker
- Tailscale installato su Pi e telefono (stesso account)
- Porta **3001** libera (UniStrategy usa **3000**)
- Consigliato: disco USB/NAS montato, es. `/mnt/storage/ViewPhoto`

## 1. Copia il progetto sul Pi

```bash
# Esempio con git
cd /mnt/storage
git clone <url-repo> ViewPhoto
cd ViewPhoto
```

Oppure copia la cartella dal Mac con `rsync` o Finder.

## 2. Primo avvio (automatico)

```bash
cd /mnt/storage/ViewPhoto
bash scripts/setup-server.sh
```

Lo script crea le cartelle dati, copia `.env.example` → `.env` se manca, e avvia Docker.

## 3. Configura `.env`

Apri `.env` e imposta almeno:

```env
APP_BASE_URL=http://100.x.y.z:3001
AUTH_USERNAME=admin
AUTH_PASSWORD=una-password-lunga-e-sicura
```

Sostituisci `100.x.y.z` con l’IP Tailscale del Pi (`tailscale ip -4`).

## 4. Riavvia dopo modifiche `.env`

```bash
docker compose up -d --build
```

## 5. Accedi da telefono

1. Attiva Tailscale su iPhone
2. Safari → `http://100.x.y.z:3001`
3. Login con le credenziali di `.env`
4. (Opzionale) Condividi → **Aggiungi a Home** per la PWA

---

## Volumi persistenti

| Cartella host | Container | Contenuto |
|---------------|-----------|-----------|
| `./Photos` | `/photos` | Foto originali |
| `./thumbnails` | `/thumbnails` | Anteprime JPEG |
| `./.trash` | `/trash` | Cestino (recupero 7 giorni) |
| `./data` | `/data` | Copertine album, metadati EXIF |

**Non cancellare** queste cartelle: contengono tutti i tuoi dati.

---

## Comandi utili

```bash
# Stato container
docker compose ps

# Log in tempo reale
docker compose logs -f viewphoto

# Health check
curl -s http://localhost:3001/api/health | jq

# Stop
docker compose down

# Aggiornamento dopo git pull
docker compose up -d --build
```

---

## Backup foto (consigliato)

Backup notturno verso USB/NAS:

```bash
bash scripts/backup-photos.sh /mnt/backup/viewphoto
```

Crontab (ogni notte alle 3:00):

```cron
0 3 * * * /mnt/storage/ViewPhoto/scripts/backup-photos.sh /mnt/backup/viewphoto >> /var/log/viewphoto-backup.log 2>&1
```

---

## HEIC / iPhone

Il container include `libheif` per anteprime e conversione browser.
L’originale HEIC resta in `Photos/`; il download restituisce il file originale.

---

## Sicurezza

- Accesso solo via **Tailscale** (rete privata) — non esporre la porta 3001 su Internet pubblico
- Password forte in `AUTH_PASSWORD`
- Rate limit login: 8 tentativi / 15 minuti
- Eliminazione: cestino con conferma prima dello svuotamento definitivo

---

## Risoluzione problemi

| Problema | Soluzione |
|----------|-----------|
| Container non parte | `docker compose logs viewphoto` |
| Health `503` | Verifica che esistano `Photos`, `thumbnails`, `.trash`, `data` |
| Sessione scaduta dopo restart | Normale: le sessioni sono in memoria, rifai login |
| Album non visibili | Riavvia container; hard refresh browser (Cmd+Shift+R) |
| Build lenta su Pi | Prima build 5–15 min (sharp + libheif), poi più veloce |

---

## Aggiornamento versione

```bash
cd /mnt/storage/ViewPhoto
git pull
docker compose up -d --build
```

I volumi `./Photos`, `./thumbnails`, `./.trash`, `./data` restano intatti.
