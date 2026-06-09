# Sync PostgreSQL → Supabase

Servizio di ridondanza: copia in push dal database LAN (aggregator + cruscotto) verso **Supabase Postgres**.

Gli aggregator **non cambiano**: continuano a scrivere solo sul PostgreSQL locale. Questo servizio gira sul server (o su una macchina con accesso al DB LAN) e sincronizza verso il cloud.

## Architettura

```
Raspberry / WIN  →  PostgreSQL LAN  →  sync_supabase  →  Supabase
Backend dashboard ↗
```

- **`conteggi_pezzi`**: sync incrementale su `id` (batch configurabile)
- **Tabelle `dashboard_*`**: upsert completo ogni ciclo (poche righe)
- Stato sync in **`sync_supabase_state`** solo sul DB sorgente

## Setup

### 1. Supabase — schema

```bash
cd sync_supabase
cp .env.example .env
# Modifica SUPABASE_DATABASE_URL con la password reale:
# postgresql://postgres:PASSWORD@db.davdmvtbwdvughepcslt.supabase.co:5432/postgres

chmod +x apply-supabase-schema.sh
./apply-supabase-schema.sh
```

### 2. Database sorgente — tabella stato

Sul PostgreSQL LAN (Postgres.app locale o server Rocky):

```bash
chmod +x setup-source.sh
SOURCE_DB_HOST=127.0.0.1 SOURCE_DB_USER=Tiziano ./setup-source.sh
# oppure in produzione:
# SOURCE_DB_HOST=172.20.1.84 SOURCE_DB_USER=postgres ./setup-source.sh
```

L'utente `counter` (o quello in `SOURCE_DB_*`) deve avere:
- `SELECT` su tutte le tabelle da replicare
- `INSERT/UPDATE` su `sync_supabase_state`

### 3. Avvio

```bash
./run.sh              # loop continuo (default ogni 30s)
./run.sh --once       # un solo ciclo (test)
./run.sh --once -v    # test verbose
```

## Variabili (`.env`)

| Variabile | Descrizione |
|-----------|-------------|
| `SOURCE_DB_*` | Connessione PostgreSQL LAN |
| `SUPABASE_DATABASE_URL` | URL Supabase. **Usa Session pooler** (IPv4) se `db.*.supabase.co` non si connette |
| `SYNC_INTERVAL_SEC` | Intervallo tra cicli (default 30) |
| `SYNC_BATCH_SIZE` | Righe max per ciclo su `conteggi_pezzi` (default 500) |

## Deploy produzione (systemd)

Copiare la cartella in `/opt/sync-supabase`, creare `/etc/sync-supabase.env` (permessi 600), poi:

```bash
sudo cp systemd/sync-supabase.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now sync-supabase.service
journalctl -u sync-supabase.service -f
```

## Rete IPv4 / IPv6

La connessione diretta `db.PROJECT.supabase.co` è **solo IPv6**. Molte reti (inclusa la tua) non la raggiungono.

**Soluzione:** in Dashboard → **Connect** → copia la stringa **Session pooler** (porta 5432), formato:

```
postgresql://postgres.PROJECT_REF:PASSWORD@aws-1-eu-central-1.pooler.supabase.com:5432/postgres
```

Alternativa a pagamento: add-on **IPv4** per la connessione diretta.

## Note

- Usa la **connessione diretta** Supabase (non il pooler `:6543`) per evitare problemi con transazioni lunghe.
- Se Supabase è irraggiungibile, il sync logga l'errore e riprova: **non blocca** gli aggregator.
- Allineare la sequence su Supabase dopo il primo bulk sync su `conteggi_pezzi` (automatico a ogni ciclo).
- **Non committare** `.env` con la password Supabase.

## Verifica

```bash
./run.sh --once -v
```

Poi su Supabase SQL Editor:

```sql
SELECT COUNT(*) FROM conteggi_pezzi;
SELECT * FROM dashboard_macchinari;
```
