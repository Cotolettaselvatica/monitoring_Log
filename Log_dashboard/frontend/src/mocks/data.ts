import type {
  Machine,
  MachineStatus,
  LogEntry,
  LogLevel,
  MachineNote,
} from "@/types";

const GATEWAY =
  (import.meta.env.VITE_RDP_GATEWAY_URL as string | undefined) ??
  "https://guacamole.local/guacamole";

// Generatore pseudo-casuale deterministico (seed fisso) per avere mock stabili.
let seed = 1337;
function rand(): number {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
}
function pick<T>(arr: T[]): T {
  return arr[Math.floor(rand() * arr.length)];
}
function randInt(min: number, max: number): number {
  return Math.floor(rand() * (max - min + 1)) + min;
}

const MACHINE_TYPES = [
  "Pressa idraulica",
  "Tornio CNC",
  "Fresatrice",
  "Centro di lavoro",
  "Robot di saldatura",
  "Linea di assemblaggio",
  "Macchina taglio laser",
  "Iniezione plastica",
];

const LOCATIONS = [
  "Reparto A - Linea 1",
  "Reparto A - Linea 2",
  "Reparto B - Linea 1",
  "Reparto B - Linea 2",
  "Reparto C - Collaudo",
  "Magazzino Logistica",
];

const STATUSES: MachineStatus[] = ["online", "online", "online", "warning", "error", "offline"];

function buildMachines(): Machine[] {
  const machines: Machine[] = [];
  for (let i = 1; i <= 15; i += 1) {
    const code = `CTS-${String(i).padStart(3, "0")}`;
    const status = pick(STATUSES);
    const lastSeenOffset =
      status === "offline" ? randInt(60, 2880) : randInt(0, 8); // minuti fa
    const location = pick(LOCATIONS);
    const [department, line] = location.includes(" - ")
      ? location.split(" - ", 2)
      : [location, ""];
    machines.push({
      id: `m-${i}`,
      name: `${pick(MACHINE_TYPES)} ${i}`,
      code,
      imageUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent(code)}&size=128&background=E2001A&color=ffffff&bold=true`,
      type: pick(MACHINE_TYPES),
      location,
      department,
      line: line || undefined,
      status,
      ipAddress: `10.20.${randInt(1, 6)}.${randInt(2, 250)}`,
      lastSeen: new Date(Date.now() - lastSeenOffset * 60_000).toISOString(),
      interconnected: status !== "offline" && rand() > 0.1,
      rdpUrl: `${GATEWAY}/#/client/${code}`,
    });
  }
  return machines;
}

const ACTIONS: { action: string; level: LogLevel; message: string }[] = [
  { action: "CONNECT", level: "info", message: "Connessione interconnessione stabilita" },
  { action: "DISCONNECT", level: "warning", message: "Interconnessione interrotta" },
  { action: "HEARTBEAT", level: "info", message: "Heartbeat ricevuto correttamente" },
  { action: "CYCLE_START", level: "info", message: "Avvio ciclo di lavorazione" },
  { action: "CYCLE_END", level: "info", message: "Ciclo di lavorazione completato" },
  { action: "ALARM", level: "error", message: "Allarme macchina: intervento richiesto" },
  { action: "WARNING_TEMP", level: "warning", message: "Temperatura sopra soglia" },
  { action: "MAINTENANCE", level: "info", message: "Modalità manutenzione attivata" },
  { action: "DATA_PUSH", level: "info", message: "Invio dati produzione a MES" },
  { action: "TIMEOUT", level: "error", message: "Timeout comunicazione con il PLC" },
];

const USERS = ["sistema", "operatore.rossi", "operatore.bianchi", "manutenzione.verdi", "plc-gateway"];

function buildLogs(machines: Machine[]): LogEntry[] {
  const logs: LogEntry[] = [];
  let id = 1;
  // Ultimi 7 giorni di eventi per ogni macchinario.
  for (const machine of machines) {
    const count = randInt(40, 90);
    for (let k = 0; k < count; k += 1) {
      const minutesAgo = randInt(0, 7 * 24 * 60);
      const a = pick(ACTIONS);
      logs.push({
        id: `l-${id++}`,
        machineId: machine.id,
        timestamp: new Date(Date.now() - minutesAgo * 60_000).toISOString(),
        action: a.action,
        level: a.level,
        message: a.message,
        user: pick(USERS),
        durationMs: a.action.startsWith("CYCLE") ? randInt(1000, 600000) : undefined,
      });
    }
  }
  return logs.sort((x, y) => y.timestamp.localeCompare(x.timestamp));
}

function buildNotes(machines: Machine[]): MachineNote[] {
  const notes: MachineNote[] = [];
  let id = 1;
  const texts = [
    "Sostituzione filtro olio e controllo livelli.",
    "Intervento straordinario su guasto al motore principale.",
    "Lubrificazione guide e taratura sensori.",
    "Aggiornamento firmware PLC e verifica interconnessione.",
    "Sostituzione cinghia di trasmissione usurata.",
    "Controllo periodico sicurezze e fine corsa.",
  ];
  for (const machine of machines) {
    const n = randInt(0, 3);
    for (let k = 0; k < n; k += 1) {
      const daysAgo = randInt(1, 60);
      notes.push({
        id: `n-${id++}`,
        machineId: machine.id,
        timestamp: new Date(Date.now() - daysAgo * 24 * 60 * 60_000).toISOString(),
        type: rand() > 0.6 ? "straordinaria" : "ordinaria",
        author: pick(["manutenzione.verdi", "tecnico.neri", "responsabile.gialli"]),
        text: pick(texts),
      });
    }
  }
  return notes.sort((x, y) => y.timestamp.localeCompare(x.timestamp));
}

export const mockMachines: Machine[] = buildMachines();
export const mockLogs: LogEntry[] = buildLogs(mockMachines);
export const mockNotes: MachineNote[] = buildNotes(mockMachines);
