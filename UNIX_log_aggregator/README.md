# Contatore pezzi Raspberry Pi → PostgreSQL

Script Python da eseguire in modo permanente su Raspberry Pi collegati alle catene di produzione industriali. Ogni macchina legge un segnale GPIO, conta i pezzi prodotti e registra ogni conteggio su un database PostgreSQL nella stessa rete locale.

Lo **stesso identico script** va installato su tutti i Raspberry: l'unica differenza tra le macchine è il file di configurazione con le variabili d'ambiente.

### Repository Git

```bash
git clone https://github.com/Cotolettaselvatica/monitoring_Log.git
cd monitoring_Log
```

Struttura del repository:

```
monitoring_Log/
├── DB/
│   └── test-db.sh              # Test connessione PostgreSQL
├── UNIX_log_aggregator/        # Questo progetto (Raspberry Pi → PostgreSQL)
└── WIN_log_aggregator/         # Aggregator log Windows via SMB → PostgreSQL
```

---

## Indice

1. [Funzionamento](#funzionamento)
2. [Requisiti hardware e segnale](#requisiti-hardware-e-segnale)
3. [Struttura del progetto](#struttura-del-progetto)
4. [Database PostgreSQL](#database-postgresql)
5. [Configurazione (variabili d'ambiente)](#configurazione-variabili-dambiente)
6. [Deploy automatico (consigliato)](#deploy-automatico-consigliato)
7. [Installazione manuale su Raspberry Pi](#installazione-manuale-su-raspberry-pi)
8. [Avvio automatico con systemd](#avvio-automatico-con-systemd)
9. [Test e verifica](#test-e-verifica)
10. [Deploy su più macchine](#deploy-su-più-macchine)
11. [Troubleshooting](#troubleshooting)

---

## Funzionamento

1. Lo script resta in esecuzione continua sul Raspberry Pi.
2. Monitora il **GPIO 10** in numerazione **BCM** con **polling** (compatibile con Pi OS recente).
3. Ogni transizione rilevante sul pin viene contata **un pezzo**:
   - con `GPIO_IDLE=high` (default): fronte di discesa **1 → 0**
   - con `GPIO_IDLE=low`: fronte di salita **0 → 1**
4. Viene eseguita una `INSERT` su PostgreSQL con:
   - `nome_macchinario` — identifica la macchina
   - `nome_pezzo` — identifica il tipo di pezzo prodotto
   - `timestamp` — data/ora UTC del conteggio
5. Opzionalmente, se `PEZZO_SECONDARIO_OGNI_N` > 0, ogni **N** conteggi primari viene eseguita anche un'insert con `NOME_PEZZO_SECONDARIO` (stesso timestamp del conteggio che ha attivato la soglia).
6. In caso di errore di connessione al database, lo script tenta automaticamente la riconnessione.

---

## Requisiti hardware e segnale

| Elemento | Valore |
|----------|--------|
| Dispositivo | Raspberry Pi (con accesso GPIO) |
| Pin GPIO | **10** (numerazione BCM) |
| Evento contato | Dipende da `GPIO_IDLE`: **1→0** (default) o **0→1** |
| Pull resistor | Pull-up o pull-down interno (`PUD_UP` / `PUD_DOWN`) |
| Antirimbalzo | 200 ms (configurabile) |
| Lettura | Polling software (non interrupt hardware) |

### Collegamento tipico (GPIO_IDLE=high)

Il pin GPIO 10 e' configurato con pull-up interno: a riposo legge **1 (HIGH)**.
Quando il sensore o il contatto porta il pin a **GND**, il segnale scende a **0 (LOW)** e viene contato un pezzo.

Con `GPIO_IDLE=low` il comportamento e' invertito (riposo a 0, conteggio su salita a 1).

```
GPIO 10 ──── sensore/contatto ──── GND
         (pull-up interno attivo)
```

> **Nota:** il pin fisico corrispondente al GPIO 10 BCM dipende dal modello di Raspberry Pi. Consultare lo schema pin del proprio modello.

---

## Struttura del progetto

```
UNIX_log_aggregator/
├── piece_counter/
│   ├── __init__.py
│   ├── config.py       # Caricamento variabili d'ambiente
│   ├── db.py           # Connessione e INSERT su PostgreSQL
│   └── counter.py      # Loop principale GPIO (polling) + gestione segnali
├── sql/
│   ├── schema.sql      # Schema tabella PostgreSQL
│   └── setup-postgres.sh   # Installazione PostgreSQL su Rocky Linux
├── systemd/
│   └── piece-counter.service   # Servizio avvio automatico
├── .env.example        # Template configurazione per ogni Raspberry
├── deploy.sh           # Script di deploy automatico (consigliato)
├── watch-gpio.sh       # Monitor live del pin GPIO (debug)
├── requirements.txt    # Dipendenze Python (pip)
└── README.md
```

### Dipendenze

**Python (pip, installate da `deploy.sh`):**

```
psycopg2-binary>=2.9.9
python-dotenv>=1.0.1
```

**Sistema (apt, installate da `deploy.sh`):**

```
python3-venv python3-pip python3-rpi-lgpio
```

| Pacchetto | Uso |
|-----------|-----|
| `python3-rpi-lgpio` | Lettura GPIO (polling, compatibile con Pi OS recente) |
| `psycopg2-binary` | Connessione e query PostgreSQL |
| `python-dotenv` | Caricamento file `.env` / variabili d'ambiente |

---

## Database PostgreSQL

### Container Proxmox LXC

Se PostgreSQL gira in un **container LXC** su Proxmox, l'errore `failed with result exit-code` e' spesso causato da **systemd non funzionante** nel container (non da PostgreSQL in se').

**Opzione A — Abilita systemd nel container (Proxmox host)**

Nelle opzioni del CT su Proxmox aggiungi:

```
features: nesting=1,keyctl=1
```

Poi nel container Rocky:

```bash
cd /opt/monitoring_Log/UNIX_log_aggregator/sql
chmod +x setup-postgres.sh
sudo ./setup-postgres.sh
```

**Nota Proxmox:** assicurati che la porta 5432 del container sia raggiungibile dalla LAN (firewall Proxmox/host e IP del CT corretto per i Raspberry).

**Errore `could not bind to IPv4 0.0.0.0`:** nei container LXC non si puo' usare `listen_addresses = '*'`. Lo script imposta automaticamente l'IP del container (es. `127.0.0.1,172.20.1.84`).

### Setup automatico su Rocky Linux (consigliato)

Sul server Rocky o container Proxmox, usa **`setup-postgres.sh`** — installa, configura e avvia tutto:

```bash
cd /opt/monitoring_Log/UNIX_log_aggregator/sql
chmod +x setup-postgres.sh
sudo ./setup-postgres.sh
```

Lo script:
1. Installa `postgresql-server` via `dnf` (se mancante)
2. Inizializza il cluster e avvia il servizio
3. Configura ascolto di rete e `pg_hba.conf` (accesso da tutte le subnet)
4. Apre la porta 5432 su `firewalld` (se attivo)
5. Crea database `raspberry_counter`, utente `counter` e tabella `conteggi_pezzi`
6. Configura avvio automatico nel container LXC (se systemd non e' disponibile)

I valori di default sono definiti nello script (`DB_HOST_IP=172.20.1.84`, utente `counter`, password `CatisPg2026`). Modifica lo script prima dell'esecuzione se servono valori diversi.

### Setup manuale su Rocky Linux

```bash
# 1. Installazione
sudo dnf install -y postgresql-server postgresql-contrib
sudo postgresql-setup --initdb
sudo systemctl enable --now postgresql

# 2. Rete — modifica /var/lib/pgsql/data/postgresql.conf
#    listen_addresses = '*'

# 3. Accesso da tutte le subnet — aggiungi in /var/lib/pgsql/data/pg_hba.conf
#    host    all    all    0.0.0.0/0    scram-sha-256
#    host    all    all    ::/0         scram-sha-256

sudo systemctl restart postgresql

# 4. Firewall
sudo firewall-cmd --permanent --add-service=postgresql
sudo firewall-cmd --reload

# 5. Database e utente
sudo -u postgres psql <<'EOF'
CREATE DATABASE raspberry_counter;
CREATE USER counter WITH PASSWORD 'password_sicura';
GRANT CONNECT ON DATABASE raspberry_counter TO counter;
EOF

sudo -u postgres psql -d raspberry_counter -f schema.sql
sudo -u postgres psql -d raspberry_counter <<'EOF'
GRANT INSERT, SELECT ON conteggi_pezzi TO counter;
GRANT USAGE, SELECT ON SEQUENCE conteggi_pezzi_id_seq TO counter;
EOF
```

Verifica:

```bash
sudo systemctl status postgresql
psql -U counter -d raspberry_counter -h localhost -W
```

Oppure, da qualsiasi macchina con client `psql`:

```bash
cd /opt/monitoring_Log/DB
./test-db.sh
```

### Creazione tabella (se non usi setup-postgres.sh)

```bash
sudo -u postgres psql -d raspberry_counter -f UNIX_log_aggregator/sql/schema.sql
```

### Schema

```sql
CREATE TABLE IF NOT EXISTS conteggi_pezzi (
    id BIGSERIAL PRIMARY KEY,
    nome_macchinario TEXT NOT NULL,
    nome_pezzo TEXT NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conteggi_pezzi_macchinario_ts
    ON conteggi_pezzi (nome_macchinario, timestamp DESC);
```

### Creazione utente PostgreSQL (consigliato)

```sql
CREATE USER counter WITH PASSWORD 'password_sicura';
GRANT CONNECT ON DATABASE raspberry_counter TO counter;
GRANT INSERT, SELECT ON conteggi_pezzi TO counter;
GRANT USAGE, SELECT ON SEQUENCE conteggi_pezzi_id_seq TO counter;
```

### Query utili

Ultimi conteggi registrati:

```sql
SELECT * FROM conteggi_pezzi ORDER BY timestamp DESC LIMIT 20;
```

Conteggio pezzi per macchina oggi:

```sql
SELECT nome_macchinario, nome_pezzo, COUNT(*) AS totale
FROM conteggi_pezzi
WHERE timestamp >= CURRENT_DATE
GROUP BY nome_macchinario, nome_pezzo
ORDER BY nome_macchinario;
```

---

## Configurazione (variabili d'ambiente)

Su ogni Raspberry Pi la configurazione va in **`/etc/piece-counter.env`**.

Lo script carica le variabili in questo ordine:
1. File indicato da `PIECE_COUNTER_ENV` (se impostata)
2. `/etc/piece-counter.env` (default)
3. File `.env` nella directory corrente (fallback per test locali)

### Template (`.env.example`)

```bash
# Identificazione macchina (diversa su ogni Raspberry)
NOME_MACCHINARIO=Linea1_MacchinaA
NOME_PEZZO=ComponenteXYZ

# Pezzo secondario opzionale: ogni N conteggi primari viene inserito anche NOME_PEZZO_SECONDARIO
# Lasciare PEZZO_SECONDARIO_OGNI_N=0 (o commentare) per disabilitare
NOME_PEZZO_SECONDARIO=ComponenteXYZ_secondario
PEZZO_SECONDARIO_OGNI_N=0

# PostgreSQL sulla rete locale
DB_HOST=172.20.1.84
DB_PORT=5432
DB_NAME=raspberry_counter
DB_USER=counter
DB_PASSWORD=CatisPg2026

# GPIO BCM (default: pin 10)
GPIO_PIN=10

# Stato a riposo: high (1->0) o low (0->1)
GPIO_IDLE=high

# Antirimbalzo in millisecondi
DEBOUNCE_MS=200
```

**Esempio pezzo secondario abilitato** (insert aggiuntiva ogni 10 pezzi primari):

```bash
NOME_PEZZO=ComponenteXYZ
NOME_PEZZO_SECONDARIO=ComponenteXYZ_secondario
PEZZO_SECONDARIO_OGNI_N=10
```

Al 10°, 20°, 30°… impulso GPIO: una riga con `ComponenteXYZ` e una con `ComponenteXYZ_secondario`.

### Tabella variabili

| Variabile | Obbligatoria | Default | Descrizione |
|-----------|:------------:|---------|-------------|
| `NOME_MACCHINARIO` | sì | — | Nome univoco della macchina (es. `Linea1_MacchinaA`) |
| `NOME_PEZZO` | sì | — | Tipo di pezzo prodotto (es. `ComponenteXYZ`) |
| `NOME_PEZZO_SECONDARIO` | no | — | Nome pezzo per insert aggiuntiva periodica (richiesto se `PEZZO_SECONDARIO_OGNI_N` > 0) |
| `PEZZO_SECONDARIO_OGNI_N` | no | `0` | Ogni N conteggi primari inserisce anche `NOME_PEZZO_SECONDARIO`; `0` = disabilitato |
| `DB_HOST` | no | `localhost` | IP o hostname del server PostgreSQL |
| `DB_PORT` | no | `5432` | Porta PostgreSQL |
| `DB_NAME` | sì | — | Nome del database |
| `DB_USER` | sì | — | Utente PostgreSQL |
| `DB_PASSWORD` | sì | — | Password PostgreSQL |
| `GPIO_PIN` | no | `10` | Pin GPIO in numerazione BCM |
| `GPIO_IDLE` | no | `high` | Stato a riposo del pin: `high` (conta su 1→0) o `low` (conta su 0→1) |
| `DEBOUNCE_MS` | no | `200` | Antirimbalzo in millisecondi |
| `PIECE_COUNTER_ENV` | no | `/etc/piece-counter.env` | Percorso alternativo del file di configurazione |

### Creazione file di configurazione

```bash
sudo cp .env.example /etc/piece-counter.env
sudo nano /etc/piece-counter.env
sudo chmod 600 /etc/piece-counter.env
```

> Su ogni Raspberry cambiano **solo** `NOME_MACCHINARIO`, `NOME_PEZZO` e, se usata la feature, `NOME_PEZZO_SECONDARIO` / `PEZZO_SECONDARIO_OGNI_N`. Le credenziali DB e GPIO restano in genere identiche.

---

## Deploy automatico (consigliato)

Lo script `deploy.sh` installa tutto in un colpo solo: copia i file, crea il virtualenv, scrive la configurazione e avvia il servizio systemd.

### Modalità interattiva

Clona o copia il repository sul Raspberry, poi:

```bash
cd /opt/monitoring_Log/UNIX_log_aggregator
chmod +x deploy.sh
sudo ./deploy.sh
```

Lo script chiede:

- Nome macchinario
- Nome pezzo
- Indirizzo PostgreSQL (IP o hostname)
- Porta, nome database, utente e password
- Pin GPIO e antirimbalzo (con default 10 e 200 ms)

### Modalità con parametri (senza domande)

```bash
sudo ./deploy.sh \
  --nome-macchinario Linea1_MacchinaA \
  --nome-pezzo ComponenteXYZ \
  --db-host 172.20.1.84 \
  --db-name raspberry_counter \
  --db-user counter \
  --db-password CatisPg2026
```

Opzioni aggiuntive:

| Opzione | Default | Descrizione |
|---------|---------|-------------|
| `--db-port` | `5432` | Porta PostgreSQL |
| `--gpio-pin` | `10` | Pin GPIO BCM |
| `--gpio-idle` | `high` | Stato GPIO a riposo (`high` o `low`) |
| `--debounce-ms` | `200` | Antirimbalzo in ms |
| `--service-user` | utente `sudo` o `koman` | Utente Linux del servizio |

### Cosa fa lo script

1. Copia `piece_counter/` e `requirements.txt` in `/opt/piece-counter`
2. Crea/aggiorna il virtualenv Python e installa le dipendenze
3. Scrive `/etc/piece-counter.env` con i valori inseriti (permessi `600`)
4. **Installa e configura il servizio systemd:**
   - crea `/etc/systemd/system/piece-counter.service`
   - aggiunge l'utente al gruppo `gpio` (se presente)
   - esegue `daemon-reload`, `enable` e `start`
   - verifica che il servizio sia attivo
5. Mostra un riepilogo con comandi utili

### Aggiornamento su macchina già installata

Rilancia lo stesso comando sul Raspberry con i nuovi valori: lo script sovrascrive file e configurazione, poi riavvia il servizio.

---

## Installazione manuale su Raspberry Pi

Alternativa al deploy automatico. Eseguire i seguenti passaggi su **ogni** Raspberry Pi (dalla cartella `UNIX_log_aggregator/`).

### 1. Copia dei file

```bash
sudo mkdir -p /opt/piece-counter
sudo cp -r piece_counter requirements.txt /opt/piece-counter/
```

### 2. Virtualenv e dipendenze

```bash
cd /opt/piece-counter
python3 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
```

### 3. Configurazione macchina

```bash
sudo cp .env.example /etc/piece-counter.env
sudo nano /etc/piece-counter.env
```

Impostare almeno:

```bash
NOME_MACCHINARIO=NomeUnivocoMacchina
NOME_PEZZO=NomePezzo
# opzionale:
# NOME_PEZZO_SECONDARIO=NomePezzoSecondario
# PEZZO_SECONDARIO_OGNI_N=10
DB_HOST=192.168.x.x
DB_NAME=raspberry_counter
DB_USER=counter
DB_PASSWORD=CatisPg2026
```

---

## Avvio automatico con systemd

> **Nota:** se usi `deploy.sh`, il servizio systemd viene installato e avviato automaticamente. Questa sezione serve solo per l'installazione manuale.

Il servizio systemd mantiene lo script sempre attivo e lo riavvia automaticamente in caso di crash o reboot.

### Installazione servizio

```bash
sudo cp systemd/piece-counter.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable piece-counter.service
sudo systemctl start piece-counter.service
```

### Comandi utili

```bash
# Stato del servizio
sudo systemctl status piece-counter.service

# Log in tempo reale
journalctl -u piece-counter.service -f

# Riavvio
sudo systemctl restart piece-counter.service

# Stop
sudo systemctl stop piece-counter.service
```

### Contenuto del servizio (`systemd/piece-counter.service`)

```ini
[Unit]
Description=Contatore pezzi produzione (GPIO -> PostgreSQL)
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=koman
WorkingDirectory=/opt/piece-counter
EnvironmentFile=/etc/piece-counter.env
ExecStart=/opt/piece-counter/.venv/bin/python -m piece_counter.counter
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

> Se l'utente del Raspberry non è `koman`, modificare la riga `User=` nel file di servizio o usare `--service-user` in `deploy.sh`.

### Monitor GPIO live (debug)

```bash
cd /opt/monitoring_Log/UNIX_log_aggregator
./watch-gpio.sh
```

Legge `GPIO_PIN` e `GPIO_IDLE` da `/etc/piece-counter.env` e mostra lo stato del pin in tempo reale.

---

## Test e verifica

### Test connessione PostgreSQL

```bash
cd /opt/monitoring_Log/DB
./test-db.sh
```

### Test manuale (senza systemd)

```bash
cd /opt/piece-counter
source .venv/bin/activate
export $(grep -v '^#' /etc/piece-counter.env | xargs)
python -m piece_counter.counter
```

### Simulazione conteggio pezzo

Con lo script in esecuzione, collegare momentaneamente **GPIO 10 a GND**.
Nel log dovrebbe comparire:

```
Pezzo rilevato su GPIO 10 alle 2026-05-21T...
Insert completata: macchinario=Linea1_MacchinaA pezzo=ComponenteXYZ
```

Con pezzo secondario attivo (`PEZZO_SECONDARIO_OGNI_N=10`), al decimo impulso compare anche:

```
Insert pezzo secondario: macchinario=Linea1_MacchinaA pezzo=ComponenteXYZ_secondario (ogni 10 pezzi, conteggio=10)
```

### Verifica su database

```sql
SELECT * FROM conteggi_pezzi ORDER BY timestamp DESC LIMIT 10;
```

---

## Deploy su più macchine

Su ogni Raspberry Pi lancia `deploy.sh` cambiando solo nome macchina e pezzo (le credenziali DB restano uguali se il server è lo stesso).

```bash
# Raspberry Pi #1
sudo ./deploy.sh \
  --nome-macchinario Linea1_MacchinaA \
  --nome-pezzo ComponenteXYZ \
  --db-host 172.20.1.84 \
  --db-name raspberry_counter \
  --db-user counter \
  --db-password CatisPg2026

# Raspberry Pi #2
sudo ./deploy.sh \
  --nome-macchinario Linea1_MacchinaB \
  --nome-pezzo ComponenteXYZ \
  --db-host 172.20.1.84 \
  --db-name raspberry_counter \
  --db-user counter \
  --db-password CatisPg2026
```

| Raspberry | NOME_MACCHINARIO | NOME_PEZZO | Resto config |
|-----------|------------------|------------|--------------|
| Pi #1 | `Linea1_MacchinaA` | `ComponenteXYZ` | uguale |
| Pi #2 | `Linea1_MacchinaB` | `ComponenteXYZ` | uguale |
| Pi #3 | `Linea2_MacchinaA` | `ComponenteABC` | uguale |

Checklist per ogni macchina:

- [ ] Progetto copiato sul Raspberry
- [ ] `sudo ./deploy.sh` eseguito con nome macchina e pezzo corretti
- [ ] Servizio attivo (`systemctl status piece-counter.service`)
- [ ] Test GPIO → verifica riga in PostgreSQL
- [ ] Log puliti (`journalctl -u piece-counter.service -f`)

---

## Troubleshooting

### Lo script non parte

```bash
journalctl -u piece-counter.service -n 50
```

Cause comuni:
- Variabile d'ambiente obbligatoria mancante in `/etc/piece-counter.env`
- `PEZZO_SECONDARIO_OGNI_N` > 0 senza `NOME_PEZZO_SECONDARIO` impostato
- PostgreSQL non raggiungibile (verificare `DB_HOST` e firewall)
- Permessi GPIO: l'utente del servizio deve poter accedere ai GPIO

### PostgreSQL non raggiungibile

```bash
# Dal Raspberry, test connessione
psql -h 172.20.1.84 -U counter -d raspberry_counter

# Oppure
cd /opt/monitoring_Log/DB && ./test-db.sh
```

Verificare che PostgreSQL accetti connessioni di rete (`pg_hba.conf` con `0.0.0.0/0` e `listen_addresses = '*'` in `postgresql.conf`).

### PostgreSQL non parte (failed with exit-code)

Sul server Rocky esegui:

```bash
sudo systemctl status postgresql -l
sudo journalctl -u postgresql -n 50 --no-pager
sudo -u postgres postgres -D /var/lib/pgsql/data --check-config
```

Cause frequenti e fix:

| Errore | Soluzione |
|--------|-----------|
| Cluster non inizializzato | `sudo postgresql-setup --initdb` |
| Directory dati corrotta/vuota | `sudo rm -rf /var/lib/pgsql/data && sudo postgresql-setup --initdb` |
| `pg_hba.conf` non valido | controlla sintassi in `/var/lib/pgsql/data/pg_hba.conf` |
| Permessi errati | `sudo chown -R postgres:postgres /var/lib/pgsql` |
| SELinux | `sudo setsebool -P postgresql_can_network_connect on` |
| Porta 5432 occupata | `sudo ss -lntp \| grep 5432` |

Poi rilancia lo script aggiornato:

```bash
cd /opt/monitoring_Log/UNIX_log_aggregator/sql
sudo ./setup-postgres.sh
```

### Conteggi doppi o mancanti

- **Doppi:** aumentare `DEBOUNCE_MS` (es. `500`)
- **Mancanti:** verificare il collegamento fisico del sensore e che il segnale scenda effettivamente da 1 a 0

### Permessi GPIO

Su Raspberry Pi OS recente, aggiungere l'utente al gruppo `gpio`:

```bash
sudo usermod -aG gpio koman
```

Riavviare il servizio dopo la modifica. L'utente del servizio deve avere una home directory scrivibile (richiesto da `lgpio`).

### Aggiornamento dello script

```bash
sudo systemctl stop piece-counter.service
sudo cp -r piece_counter /opt/piece-counter/
sudo systemctl start piece-counter.service
```
