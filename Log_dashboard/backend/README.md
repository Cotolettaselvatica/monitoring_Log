# Cruscotto CATIS — Backend

API REST FastAPI che legge i conteggi pezzi da PostgreSQL (popolato da `UNIX_log_aggregator` e `WIN_log_aggregator`) e implementa il contratto atteso dal frontend React.

## Requisiti

- Python 3.10+
- PostgreSQL con tabella `conteggi_pezzi` (schema negli aggregator)
- Tabelle `dashboard_*` (vedi `sql/schema.sql`)

## Installazione

```bash
cp .env.example .env
chmod +x run.sh sql/setup-dashboard.sh
./sql/setup-dashboard.sh   # prima volta, utente con permessi DDL
./run.sh
```

## Variabili d'ambiente

| Variabile | Default | Descrizione |
|-----------|---------|-------------|
| `DB_HOST` | `172.20.1.84` | Host PostgreSQL |
| `DB_PORT` | `5432` | Porta |
| `DB_NAME` | `raspberry_counter` | Database |
| `DB_USER` | `counter` | Utente |
| `DB_PASSWORD` | — | Password |
| `API_PORT` | `8000` | Porta API |
| `CORS_ORIGINS` | `http://localhost:5173,...` | Origini CORS frontend |
| `PUBLIC_BASE_URL` | `http://localhost:8000` | Base URL per immagini caricate |

## Endpoint principali

- `GET /machines` — macchinari (sync da `conteggi_pezzi` + metadati)
- `GET /logs` — eventi produzione da `conteggi_pezzi`
- `GET /charts/events/{hourly|daily|weekly|monthly|yearly}` — serie temporali
- `GET /metrics/fleet` — KPI flotta
- `GET/PUT /settings` — impostazioni dashboard

Elenco completo in `frontend/README.md`.
