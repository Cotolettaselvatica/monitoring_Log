import { Chip } from "@mui/material";
import type { LogLevel } from "@/types";
import { levelLabels } from "@/utils/format";

const levelColors: Record<LogLevel, string> = {
  info: "#3AAA35",
  warning: "#F5A623",
  error: "#E2001A",
};

export function LevelChip({ level }: { level: LogLevel }) {
  return (
    <Chip
      label={levelLabels[level]}
      size="small"
      sx={{ bgcolor: levelColors[level], color: "#fff", fontWeight: 600 }}
    />
  );
}
