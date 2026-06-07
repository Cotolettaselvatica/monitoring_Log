import type { LogRow } from "@/types";

export type PivotRowField = "machineCode" | "machineName" | "action" | "level" | "user" | "machineLocation";
export type PivotColField = PivotRowField | "none";
export type PivotAgg = "count" | "sumDuration";

export interface PivotConfig {
  rowField: PivotRowField;
  colField: PivotColField;
  agg: PivotAgg;
}

export interface PivotCell {
  value: number;
}

export interface PivotResult {
  rowKeys: string[];
  colKeys: string[];
  cells: Map<string, number>;
  rowTotals: Map<string, number>;
  colTotals: Map<string, number>;
  grandTotal: number;
}

function key(row: string, col: string): string {
  return `${row}|||${col}`;
}

export function buildPivot(rows: LogRow[], config: PivotConfig): PivotResult {
  const cells = new Map<string, number>();
  const rowTotals = new Map<string, number>();
  const colTotals = new Map<string, number>();
  const rowSet = new Set<string>();
  const colSet = new Set<string>();
  let grandTotal = 0;

  for (const row of rows) {
    const rKey = String(row[config.rowField] ?? "-");
    const cKey =
      config.colField === "none" ? "(totale)" : String(row[config.colField as PivotRowField] ?? "-");
    rowSet.add(rKey);
    colSet.add(cKey);

    const delta =
      config.agg === "count" ? 1 : row.durationMs ?? 0;

    const k = key(rKey, cKey);
    cells.set(k, (cells.get(k) ?? 0) + delta);
    rowTotals.set(rKey, (rowTotals.get(rKey) ?? 0) + delta);
    colTotals.set(cKey, (colTotals.get(cKey) ?? 0) + delta);
    grandTotal += delta;
  }

  return {
    rowKeys: [...rowSet].sort(),
    colKeys: [...colSet].sort(),
    cells,
    rowTotals,
    colTotals,
    grandTotal,
  };
}

export const pivotRowLabels: Record<PivotRowField, string> = {
  machineCode: "Codice macchinario",
  machineName: "Nome macchinario",
  action: "Azione",
  level: "Livello",
  user: "Utente",
  machineLocation: "Sede",
};

export const pivotColLabels: Record<PivotColField, string> = {
  ...pivotRowLabels,
  none: "(nessuna)",
};

export const pivotAggLabels: Record<PivotAgg, string> = {
  count: "Conteggio eventi",
  sumDuration: "Somma durata (ms)",
};

export interface PivotExportRow {
  riga: string;
  colonna: string;
  valore: number;
}

export function pivotToExportRows(result: PivotResult): PivotExportRow[] {
  const out: PivotExportRow[] = [];
  for (const r of result.rowKeys) {
    for (const c of result.colKeys) {
      out.push({
        riga: r,
        colonna: c,
        valore: result.cells.get(key(r, c)) ?? 0,
      });
    }
  }
  return out;
}

export const PIVOT_PRESETS: { name: string; config: PivotConfig }[] = [
  { name: "Azioni per macchinario", config: { rowField: "machineCode", colField: "action", agg: "count" } },
  { name: "Livelli per sede", config: { rowField: "machineLocation", colField: "level", agg: "count" } },
  { name: "Durata per azione", config: { rowField: "action", colField: "none", agg: "sumDuration" } },
];
