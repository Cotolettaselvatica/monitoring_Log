import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export interface ExportColumn<T> {
  key: keyof T | string;
  header: string;
  /** Estrae il valore stampabile dalla riga (default: row[key]) */
  value?: (row: T) => string | number;
}

function cellValue<T>(row: T, col: ExportColumn<T>): string | number {
  if (col.value) return col.value(row);
  const v = (row as Record<string, unknown>)[col.key as string];
  return v == null ? "" : (v as string | number);
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportCsv<T>(
  rows: T[],
  columns: ExportColumn<T>[],
  filename: string,
): void {
  const header = columns.map((c) => `"${c.header}"`).join(";");
  const lines = rows.map((row) =>
    columns
      .map((c) => `"${String(cellValue(row, c)).replace(/"/g, '""')}"`)
      .join(";"),
  );
  const csv = "\uFEFF" + [header, ...lines].join("\n");
  triggerDownload(new Blob([csv], { type: "text/csv;charset=utf-8" }), `${filename}.csv`);
}

export function exportJson<T>(rows: T[], filename: string): void {
  const json = JSON.stringify(rows, null, 2);
  triggerDownload(
    new Blob([json], { type: "application/json" }),
    `${filename}.json`,
  );
}

export function exportExcel<T>(
  rows: T[],
  columns: ExportColumn<T>[],
  filename: string,
  sheetName = "Dati",
): void {
  const data = rows.map((row) => {
    const obj: Record<string, string | number> = {};
    columns.forEach((c) => {
      obj[c.header] = cellValue(row, c);
    });
    return obj;
  });
  const ws = XLSX.utils.json_to_sheet(data, {
    header: columns.map((c) => c.header),
  });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

export function exportPdf<T>(
  rows: T[],
  columns: ExportColumn<T>[],
  filename: string,
  title: string,
): void {
  const doc = new jsPDF({ orientation: "landscape" });

  // Intestazione CATIS
  doc.setFillColor(226, 0, 26); // rosso CATIS
  doc.rect(0, 0, doc.internal.pageSize.getWidth(), 18, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.text("CATIS", 14, 12);
  doc.setFontSize(11);
  doc.setTextColor(31, 41, 51);
  doc.text(title, 14, 26);
  doc.setFontSize(8);
  doc.text(`Generato il ${new Date().toLocaleString("it-IT")}`, 14, 32);

  autoTable(doc, {
    startY: 36,
    head: [columns.map((c) => c.header)],
    body: rows.map((row) => columns.map((c) => String(cellValue(row, c)))),
    styles: { fontSize: 7, cellPadding: 1.5 },
    headStyles: { fillColor: [58, 170, 53], textColor: 255 }, // verde CATIS
    alternateRowStyles: { fillColor: [244, 246, 248] },
  });

  doc.save(`${filename}.pdf`);
}

export type ExportFormat = "csv" | "excel" | "json" | "pdf";

export function exportData<T>(
  format: ExportFormat,
  rows: T[],
  columns: ExportColumn<T>[],
  filename: string,
  title: string,
): void {
  switch (format) {
    case "csv":
      return exportCsv(rows, columns, filename);
    case "excel":
      return exportExcel(rows, columns, filename);
    case "json":
      return exportJson(rows, filename);
    case "pdf":
      return exportPdf(rows, columns, filename, title);
  }
}
