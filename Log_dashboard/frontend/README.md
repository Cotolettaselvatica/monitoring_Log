# Cruscotto CATIS — Frontend

Applicativo web per il monitoraggio dell'interconnessione e dello stato dei macchinari industriali.

## Avvio

```bash
npm install
npm run dev
```

Accesso diretto senza login.

## Configurazione

| Variabile | Descrizione |
|-----------|-------------|
| `VITE_API_BASE_URL` | API REST. Vuoto = lettura da mock demo. **Scritture solo con API.** |
| `VITE_RDP_GATEWAY_URL` | Gateway web-RDP (Guacamole). |

## Mock vs API

| Operazione | Senza API | Con API |
|------------|-----------|---------|
| Lettura (macchinari, log, allarmi, metriche, grafici, audit, impostazioni) | Mock | API (+ fallback mock su errore lettura) |
| CRUD macchinari, cambio stato | Mock in-memory (`mockMachineStore`) | API |
| Altre scritture (note, immagini, ack, manutenzione, template, impostazioni) | Disabilitate | Solo API |

## Pagine e route

| Route | Contenuto |
|-------|-----------|
| `/` | Dashboard, KPI, grafici flotta, CRUD macchinari, ultimi eventi |
| `/machines` | Elenco macchinari raggruppato per reparto/linea |
| `/machines/:id` | Panoramica analitica (stessi grafici/KPI del singolo macchinario), log, RDP, note, affidabilità |
| `/alerts` | Centro allarmi con acknowledge |
| `/maintenance` | Pianificazione manutenzioni |
| `/logs` | Log con filtri e pivot |
| `/reports` | Export, template salvati, schedulazioni |
| `/audit` | Audit trail |
| `/settings` | Polling, soglie, tema, gateway RDP |

## Contratto API per il backend

Base URL: valore di `VITE_API_BASE_URL` (es. `https://api.example.com`). Tutti i path sotto sono relativi a questa base.

### Macchinari (CRUD — priorità integrazione)

| Metodo | Path | Body / risposta |
|--------|------|-----------------|
| `GET` | `/machines` | `Machine[]` |
| `GET` | `/machines/:id` | `Machine` |
| `POST` | `/machines` | body `MachineInput` → `Machine` |
| `PUT` | `/machines/:id` | body `Partial<MachineInput>` → `Machine` |
| `DELETE` | `/machines/:id` | — |
| `PATCH` | `/machines/:id` | `{ "status": "online" \| "offline" \| "warning" \| "error" }` → `Machine` |
| `POST` | `/machines/:id/image` | `multipart/form-data`, campo `file` → `Machine` (aggiorna `imageUrl`) |
| `DELETE` | `/machines/:id/image` | `Machine` |

Campi `Machine` / `MachineInput`: `name`, `code`, `type`, `location?`, `department`, `line?`, `status`, `ipAddress`, `interconnected`, `rdpUrl?`, `imageUrl?`. In lettura: anche `id`, `lastSeen` (ISO 8601).

### Grafici eventi (dashboard e scheda macchina)

Risposta: `ChartSeriesPoint[]` con `{ "key": string, "count": number }` (`key` = etichetta bucket temporale, es. ora o data).

| Ambito | Path |
|--------|------|
| Flotta (dashboard `/`) | `GET /charts/events/hourly`, `/daily`, `/weekly`, `/monthly`, `/yearly` |
| Singolo macchinario | `GET /machines/:id/charts/events/hourly`, `/daily`, `/weekly`, `/monthly`, `/yearly` |

Il frontend usa gli stessi slug di periodo per flotta e macchina; in assenza di API aggrega i log mock per `machineId` quando serve.

### Metriche affidabilità

| Metodo | Path | Risposta |
|--------|------|----------|
| `GET` | `/metrics/fleet` | `FleetMetrics` (`uptimePct`, `downtimeMinutes`, `mtbfHours`, `mttrMinutes` nullable, `failures`, `machinesOnline`, `machinesTotal`) |
| `GET` | `/metrics/machines/:id` | `MachineMetrics` (stessi campi salvo contatori flotta) |

### Altri endpoint

- `GET/PUT /settings`
- `GET /logs`, `GET /machines/:id/logs`
- `GET/POST /machines/:id/notes`
- `GET /alerts`, `POST /alerts/:id/acknowledge`
- `GET/POST/PATCH/DELETE /maintenance`, `/maintenance/:id`
- `GET/POST /audit`
- `GET/POST /report-templates`, `DELETE /report-templates/:id`
- `GET/POST /report-schedules`, `DELETE /report-schedules/:id`

Riferimento path nel codice: `src/services/endpoints.ts`.

## Real-time

Polling configurabile da Impostazioni (`pollingIntervalSec`, default 30s) su macchinari e allarmi.

## Test

```bash
npm test
```

Unit test (Vitest) su utilità pure: filtri, aggregazione log, pivot, export grafici, formattazione.

## Build

```bash
npm run build
npm run preview
```

## Agent Skills (Cursor)

Skill ufficiali Anthropic + skill di progetto per guidare l'assistente su stack e convenzioni MUI.

```bash
# Prima installazione o aggiornamento skill vendor (~13 MB, non in git)
npm run skills:install

# Elenco skill attive nel progetto
npm run skills:list
```

| Percorso | Contenuto |
|----------|-----------|
| `.agents/skills/cruscotto-catis/` | Skill di progetto (versionata in git) |
| `.agents/skills/*` (altre) | Skill Anthropic — rigenerare con `skills:install` |
| `.cursor/rules/cruscotto-skills.mdc` | Regola locale su quale skill usare (non in git) |

Dopo `skills:install`, riaprire la chat Cursor per ricaricare le skill.
