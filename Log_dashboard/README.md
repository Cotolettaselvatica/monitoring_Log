# Log Dashboard — Cruscotto CATIS

Dashboard web per monitorare i conteggi pezzi raccolti da **UNIX_log_aggregator** (Raspberry Pi / GPIO) e **WIN_log_aggregator** (log Windows via SMB) su PostgreSQL.

## Struttura

```
Log_dashboard/
├── frontend/     # React + Vite (repo clonata)
└── backend/      # FastAPI → PostgreSQL (conteggi_pezzi + tabelle dashboard)
```

## Database

Gli aggregator scrivono sulla tabella condivisa `conteggi_pezzi`:

| Colonna | Descrizione |
|---------|-------------|
| `nome_macchinario` | Identificativo macchina |
| `nome_pezzo` | Tipo pezzo prodotto |
| `timestamp` | Data/ora conteggio |

Il backend legge questa tabella e la espone al frontend come macchinari, log ed eventi produzione. Metadati aggiuntivi (note, manutenzione, impostazioni, …) sono in tabelle `dashboard_*`.

### Setup schema dashboard

```bash
cd backend/sql
chmod +x setup-dashboard.sh
# Con utente che ha permessi DDL (es. postgres):
DB_HOST=172.20.1.84 DB_PASSWORD=... ./setup-dashboard.sh
```

L'utente `counter` usato dagli aggregator deve avere almeno `SELECT` su `conteggi_pezzi` e `SELECT/INSERT/UPDATE/DELETE` sulle tabelle `dashboard_*`.

## Avvio backend

```bash
cd backend
cp .env.example .env   # adatta DB_HOST e credenziali
chmod +x run.sh
./run.sh
```

API: `http://localhost:8000` — health check: `GET /health`

## Avvio frontend

```bash
cd frontend
npm install
echo 'VITE_API_BASE_URL=http://localhost:8000' > .env
npm run dev
```

Apri `http://localhost:5173`.

## Mapping dati produzione → UI

| Dato PostgreSQL | UI frontend |
|-----------------|-------------|
| `nome_macchinario` distinti | Elenco macchinari (auto-discovery) |
| Righe `conteggi_pezzi` | Log evento `PIECE_COUNT` |
| Aggregazioni temporali | Grafici hourly/daily/weekly/… |
| Ultimo timestamp per macchina | `lastSeen` e stato online/offline |

Soglia offline configurabile in **Impostazioni** (`offlineThresholdMin`, default 15 min).

## Contratto API

Il frontend si aspetta l'API documentata in `frontend/README.md`. Riferimento path: `frontend/src/services/endpoints.ts`.

## Deploy produzione

Script automatico per Rocky Linux (backend systemd + build frontend + nginx):

```bash
# 1. Copia il repo sul server dashboard (dal Mac)
rsync -avz --exclude node_modules --exclude .venv --exclude dist \
  Log_dashboard/ root@172.20.1.87:/opt/log-dashboard-src/

# 2. Sul server 172.20.1.87
cd /opt/log-dashboard-src
chmod +x deploy_log_dashboard.sh
sudo ./deploy_log_dashboard.sh
```

Server produzione dashboard: **172.20.1.87** — PostgreSQL: **172.20.1.84**

Opzioni utili:

| Opzione | Descrizione |
|---------|-------------|
| `--public-host IP` | URL frontend/API (default `172.20.1.87`) |
| `--db-host IP` | PostgreSQL (default `172.20.1.84`) |
| `--skip-db-schema` | Non riesegue `setup-dashboard.sh` |
| `--skip-frontend` | Usa `frontend/dist/` già buildato |
| `--skip-nginx` | Solo backend API |

Dopo il deploy:

- Frontend: `http://172.20.1.87`
- API: `http://172.20.1.87:8000`
- Health: `GET http://172.20.1.87:8000/health`

Comandi:

```bash
sudo systemctl status log-dashboard-api
journalctl -u log-dashboard-api -f
sudo nano /etc/log-dashboard.env
```

Aggiornamento:

```bash
sudo ./deploy_log_dashboard.sh --skip-db-schema
```
