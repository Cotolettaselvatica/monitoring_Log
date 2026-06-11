# WIN Log Aggregator

Servizio **Rocky Linux** (Python) che legge i log di produzione dalle **macchine Windows via SMB**, importa ogni riga come un pezzo contato e li salva su **PostgreSQL** (stesso database dei Raspberry).

### Repository Git

```bash
git clone https://github.com/Cotolettaselvatica/monitoring_Log.git
cd monitoring_Log/WIN_log_aggregator
```

Struttura del repository:

```
monitoring_Log/
├── DB/
│   └── test-db.sh
├── UNIX_log_aggregator/        # Contatore pezzi Raspberry Pi → PostgreSQL
└── WIN_log_aggregator/         # Questo progetto (log SMB → PostgreSQL)
```

---

## Architettura

```
Macchina Windows 1                    Macchina Windows N
   pezzi.log (share SMB)                 pezzi.log (share SMB)
        \                                      /
         \                                    /
          =====  Rete locale SMB  =====
                         |
              Server Rocky Linux (questo aggregator)
                         |
                    PostgreSQL (raspberry_counter)
```

1. Ogni macchinario scrive **una riga per pezzo** in un file di log esposto in una cartella SMB.
2. L'aggregator gira in loop sul **server Rocky Linux** (default ogni 30 secondi).
3. Per ogni macchina legge solo le **righe nuove** (tiene traccia dell'offset byte in `state/offsets.json`).
4. Ogni riga valida viene inserita in PostgreSQL nella tabella `conteggi_pezzi`.
5. Gli offset in `state/offsets.json` evitano di rileggere righe gia' importate.

---

## Formato file di log

Una riga = un pezzo. Due formati supportati:

### Formato completo (consigliato)

```
2026-05-21T14:30:00+00:00|Linea1_MacchinaA|ComponenteXYZ
```

Campi separati da `|`:
- timestamp ISO 8601
- nome macchinario
- nome pezzo

### Formato breve (solo timestamp)

```
2026-05-21T14:30:00+00:00
```

In questo caso macchinario e pezzo vengono presi da `config/machines.yaml` per quella sorgente.

Righe vuote e righe che iniziano con `#` vengono ignorate.

### Esempio file `pezzi.log` su ogni macchinario

```
# Log produzione
2026-05-21T08:15:01+00:00|Linea1_MacchinaA|ComponenteXYZ
2026-05-21T08:15:04+00:00|Linea1_MacchinaA|ComponenteXYZ
2026-05-21T08:15:09+00:00|Linea1_MacchinaA|ComponenteXYZ
```

---

## Database PostgreSQL

Usa lo stesso server/database dei Raspberry (`raspberry_counter` su `172.20.1.84`).

### Schema tabella

Usa la stessa tabella `conteggi_pezzi` dei Raspberry (definita in `UNIX_log_aggregator/sql/schema.sql`):

| Colonna | Descrizione |
|---------|-------------|
| `id` | Chiave primaria |
| `nome_macchinario` | Nome macchina |
| `nome_pezzo` | Tipo pezzo |
| `timestamp` | Data/ora del conteggio |

La deduplica delle righe importate e' gestita dagli **offset byte** in `state/offsets.json`, non dal database.

### Utente

Usa lo stesso utente `counter` creato da `UNIX_log_aggregator/sql/setup-postgres.sh`.

### Query utili

```sql
SELECT * FROM conteggi_pezzi ORDER BY timestamp DESC LIMIT 20;

SELECT nome_macchinario, COUNT(*) AS totale
FROM conteggi_pezzi
WHERE timestamp::date = CURRENT_DATE
GROUP BY nome_macchinario;
```

---

## Configurazione

### 1. File `.env` (PostgreSQL e parametri globali)

Copia `.env.example` in `.env`:

```bash
DB_HOST=172.20.1.84
DB_PORT=5432
DB_NAME=raspberry_counter
DB_USER=counter
DB_PASSWORD=CatisPg2026

MACHINES_CONFIG=config/machines.yaml
STATE_FILE=state/offsets.json
POLL_INTERVAL_SEC=30
```

| Variabile | Default | Descrizione |
|-----------|---------|-------------|
| `DB_HOST` | `localhost` | Server PostgreSQL |
| `DB_PORT` | `5432` | Porta PostgreSQL |
| `DB_NAME` | — | Nome database |
| `DB_USER` | — | Utente PostgreSQL |
| `DB_PASSWORD` | — | Password PostgreSQL |
| `MACHINES_CONFIG` | `config/machines.yaml` | Elenco macchinari SMB |
| `STATE_FILE` | `state/offsets.json` | Offset lettura per sorgente |
| `POLL_INTERVAL_SEC` | `30` | Intervallo polling in secondi |

### 2. File `config/machines.yaml` (sorgenti SMB)

Copia `config/machines.example.yaml` in `config/machines.yaml`:

```yaml
machines:
  - id: linea1_macchina_a
    smb_host: 192.168.1.10
    smb_share: logs
    log_path: pezzi.log
    username: pi
    password: password_pi
    domain: ""
    nome_macchinario: Linea1_MacchinaA
    nome_pezzo: ComponenteXYZ

  - id: linea1_macchina_b
    smb_host: 192.168.1.11
    smb_share: logs
    log_path: pezzi.log
    username: pi
    password: password_pi
    domain: ""
    nome_macchinario: Linea1_MacchinaB
    nome_pezzo: ComponenteXYZ
```

| Campo | Descrizione |
|-------|-------------|
| `id` | ID univoco sorgente (usato per offset/watermark) |
| `source_type` | `smb` (default) oppure `mssql` |
| `smb_host` | IP o hostname del macchinario (solo SMB) |
| `smb_share` | Nome share SMB |
| `log_path` | Percorso file dentro la share |
| `log_dir` | Cartella log con file giornaliero (alternativa a `log_path`) |
| `log_file_prefix` | Prefisso file giornaliero |
| `log_file_date_format` | Formato data strftime |
| `username` / `password` | Credenziali SMB |
| `domain` | Dominio Windows (opzionale) |
| `mssql_*` | Connessione SQL Server (vedi sotto) |
| `nome_macchinario` / `nome_pezzo` | Default se il log/SQL non li fornisce |

Per aggiungere un macchinario: aggiungi una voce in `machines.yaml`. Al prossimo ciclo la legge.

#### Sorgente MSSQL (LMS — sostituisce trace SMB)

Per macchine con database SQL Server locale (es. LMS `10.0.0.241`, istanza `MULTIDB_2022`, porta `49543`):

1. Crea login SQL readonly su `lms_010` (vedi `DB/probe-mssql.sh`)
2. Scopri colonne tabella produzione:

```bash
cd DB
MSSQL_USER=catis_readonly MSSQL_PASSWORD='...' ./explore-mssql-lms.sh
```

3. Configura `machines.yaml`:

```yaml
  - id: LMS_asservimento_DVK_3LMS-R25-PA-AU
    source_type: mssql
    mssql_host: 10.0.0.241
    mssql_port: 49543
    mssql_database: lms_010
    mssql_user: catis_readonly
    mssql_password: "..."
    mssql_table: dbo.o02_eventi_ordini
    mssql_id_column: o02n_id
    mssql_timestamp_column: o02d_data_evento
    mssql_time_column: o02s_ora_evento
    mssql_filter_column: o02s_stato
    mssql_filter_value: "FINE LAVORAZIONE"
    mssql_lookback_hours: 168
    nome_macchinario: LMS_asservimento_DVK_3LMS-R25-PA-AU
    nome_pezzo: inserimento_corpo_sifone
```

Conta solo righe con `o02s_stato = 'FINE LAVORAZIONE'` (fine ciclo = un pezzo). Sync incrementale su `o02n_id`; data/ora in `o02d_data_evento` + `o02s_ora_evento`.

Sul server Rocky serve ODBC Driver 18: `DB/install-mssql-client-rocky.sh` e `pip install pyodbc`.

---

## Installazione su Rocky Linux

### Requisiti

- Rocky Linux 8/9 (o container LXC)
- Python 3.9+
- Accesso di rete alle share SMB **oppure** SQL Server (porta TCP, es. LMS `49543`)
- PostgreSQL raggiungibile in LAN (porta 5432)

### Setup

```bash
cd /opt/monitoring_Log/WIN_log_aggregator
chmod +x deploy_win_aggregator.sh run.sh
sudo ./deploy_win_aggregator.sh
```

Il servizio **`win-log-aggregator.service`** parte automaticamente al boot dopo il deploy.

Verifica avvio automatico:

```bash
sudo systemctl is-enabled win-log-aggregator.service
sudo systemctl status win-log-aggregator.service
```

Su container LXC senza systemd, il deploy usa **cron @reboot** come fallback.

Poi modifica:
1. `/etc/win-log-aggregator.env` — credenziali PostgreSQL
2. `/opt/win-log-aggregator/config/machines.yaml` — elenco macchine (SMB `pezzi.log` o MSSQL)

Esegui lo schema SQL su PostgreSQL (se non già fatto):

```bash
sudo -u postgres psql -d raspberry_counter -f /opt/monitoring_Log/WIN_log_aggregator/sql/schema.sql
```

### Avvio

Il servizio parte automaticamente con `deploy_win_aggregator.sh`. Comandi utili:

```bash
sudo systemctl status win-log-aggregator.service
journalctl -u win-log-aggregator.service -f
sudo systemctl restart win-log-aggregator.service
```

Avvio manuale (sviluppo):

```bash
cp .env.example .env
cp config/machines.example.yaml config/machines.yaml
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
./run.sh
```

---

## Integrazione con le macchine Windows

Ogni macchina Windows in produzione deve:

1. Scrivere una riga nel file di log ad ogni pezzo prodotto
2. Esporre la cartella del log via **condivisione SMB**

### Esempio scrittura log (Python)

```python
from datetime import datetime, timezone

def log_pezzo(path: str, macchinario: str, pezzo: str) -> None:
    ts = datetime.now(timezone.utc).isoformat()
    with open(path, "a", encoding="utf-8") as f:
        f.write(f"{ts}|{macchinario}|{pezzo}\n")
```

### Share SMB su macchina Windows

1. Crea cartella es. `C:\Logs\produzione`
2. Condividi in rete (es. share `logs`)
3. Permetti accesso in lettura all'utente configurato in `machines.yaml`
4. Verifica da Rocky Linux:

```bash
dnf install -y samba-client
smbclient //IP_WINDOWS/logs -U utente_windows
```

---

## Struttura progetto

```
monitoring_Log/
├── DB/
│   └── test-db.sh
├── UNIX_log_aggregator/
└── WIN_log_aggregator/
    ├── aggregator/
    │   ├── config.py       # .env + machines.yaml
    │   ├── parser.py       # Parsing righe log + offset
    │   ├── smb_reader.py   # Lettura file via SMB
    │   ├── db.py           # Insert su PostgreSQL
    │   └── main.py         # Loop principale
    ├── config/
    │   └── machines.example.yaml
    ├── sql/
    │   └── schema.sql
    ├── state/              # Offset lettura (generato a runtime)
    ├── .env.example
    ├── requirements.txt
    ├── systemd/
    │   └── win-log-aggregator.service
    ├── deploy_win_aggregator.sh
    ├── run.sh
    └── README.md
```

---

## Troubleshooting

### Errore connessione SMB

- Verifica IP, nome share e credenziali in `machines.yaml`
- Da Rocky Linux prova: `smbclient //IP/share -U utente`
- Controlla firewall Windows e che la share sia accessibile in rete

### Errore connessione PostgreSQL

```bash
PGPASSWORD=CatisPg2026 psql -h 172.20.1.84 -U counter -d raspberry_counter
```

Verifica che PostgreSQL accetti connessioni di rete (`pg_hba.conf` e `listen_addresses`).

### Righe non importate

- Controlla il formato riga (timestamp ISO + pipe)
- Verifica che il file non sia vuoto e che l'offset in `state/offsets.json` non sia oltre la fine file
- Per forzare una rilettura: elimina la voce relativa in `state/offsets.json`

### Log dell'aggregator

L'output va su journald:

```bash
journalctl -u win-log-aggregator.service -f
```

---

## Flusso completo Industria 5.0

| Componente | Percorso | Ruolo |
|------------|----------|-------|
| PostgreSQL | `UNIX_log_aggregator/sql/setup-postgres.sh` | Database centralizzato `raspberry_counter` |
| `UNIX_log_aggregator` | Raspberry Pi | Conta pezzi via GPIO → PostgreSQL |
| Macchine Windows | share SMB | Scrivono `pezzi.log` |
| `WIN_log_aggregator` | Rocky Linux | Raccoglie log SMB → PostgreSQL |
| `DB/test-db.sh` | qualsiasi host | Verifica connessione PostgreSQL |
