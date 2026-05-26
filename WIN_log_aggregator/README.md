# WIN Log Aggregator

Servizio **Rocky Linux** (Python) che legge i log di produzione dalle **macchine Windows via SMB**, importa ogni riga come un pezzo contato e li salva su **PostgreSQL** (stesso database dei Raspberry).

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
5. `ON CONFLICT DO NOTHING` evita duplicati se una riga viene riletta.

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

### Estensione tabella

```bash
sudo -u postgres psql -d raspberry_counter -f sql/schema.sql
```

Lo script aggiunge le colonne `source_id`, `raw_line`, `imported_at` alla tabella esistente `conteggi_pezzi`.

### Schema (colonne aggiuntive WIN)

| Colonna | Descrizione |
|---------|-------------|
| `source_id` | ID sorgente da `machines.yaml` |
| `raw_line` | Riga originale del log |
| `imported_at` | Quando e' stata importata |

Le colonne `id`, `nome_macchinario`, `nome_pezzo`, `timestamp` sono condivise con i conteggi GPIO dei Raspberry.

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
| `id` | ID univoco sorgente (usato per offset e deduplica) |
| `smb_host` | IP o hostname del macchinario |
| `smb_share` | Nome share SMB |
| `log_path` | Percorso file dentro la share (es. `pezzi.log` o `logs/pezzi.log`) |
| `username` / `password` | Credenziali SMB |
| `domain` | Dominio Windows (opzionale, lasciare `""` su Raspberry) |
| `nome_macchinario` / `nome_pezzo` | Default se il log contiene solo il timestamp |

Per aggiungere un macchinario: aggiungi una voce in `machines.yaml`. Non serve riavviare il codice se usi lo stesso file; al prossimo ciclo la legge.

---

## Installazione su Rocky Linux

### Requisiti

- Rocky Linux 8/9 (o container LXC)
- Python 3.9+
- Accesso di rete alle share SMB delle macchine Windows
- PostgreSQL raggiungibile in LAN (porta 5432)

### Setup

```bash
cd WIN_log_aggregator
chmod +x install.sh run.sh
sudo ./install.sh
```

Poi modifica:
1. `/etc/win-log-aggregator.env` — credenziali PostgreSQL
2. `/opt/win-log-aggregator/config/machines.yaml` — elenco macchine Windows e share SMB

Esegui lo schema SQL su PostgreSQL (se non già fatto):

```bash
sudo -u postgres psql -d raspberry_counter -f sql/schema.sql
```

### Avvio

Il servizio parte automaticamente con `install.sh`. Comandi utili:

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
WIN_log_aggregator/
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
├── install.sh
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

| Componente | Ruolo |
|------------|-------|
| `UNIX_log_aggregator` (Raspberry) | Conta pezzi via GPIO → PostgreSQL |
| Macchine Windows | Scrivono `pezzi.log` su share SMB |
| `WIN_log_aggregator` (Rocky Linux) | Raccoglie log SMB → PostgreSQL |
| PostgreSQL `raspberry_counter` | Database centralizzato unico |
