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
