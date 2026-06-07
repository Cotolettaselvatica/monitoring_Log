import dayjs from "dayjs";
import type { MachineStatus, LogLevel, NoteType } from "@/types";

export function formatDateTime(iso: string): string {
  return dayjs(iso).format("DD/MM/YYYY HH:mm:ss");
}

export function formatRelative(iso: string): string {
  const diffMin = dayjs().diff(dayjs(iso), "minute");
  if (diffMin < 1) return "adesso";
  if (diffMin < 60) return `${diffMin} min fa`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH} h fa`;
  return `${Math.floor(diffH / 24)} g fa`;
}

export function formatDuration(ms?: number): string {
  if (ms == null) return "-";
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}m ${rem}s`;
}

export const statusLabels: Record<MachineStatus, string> = {
  online: "Online",
  offline: "Offline",
  warning: "Attenzione",
  error: "Errore",
};

export const levelLabels: Record<LogLevel, string> = {
  info: "Info",
  warning: "Avviso",
  error: "Errore",
};

export const noteTypeLabels: Record<NoteType, string> = {
  ordinaria: "Manutenzione ordinaria",
  straordinaria: "Manutenzione straordinaria",
};
