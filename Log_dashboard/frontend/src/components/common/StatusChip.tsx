import { Chip } from "@mui/material";
import type { MachineStatus } from "@/types";
import { statusColors } from "@/theme/catisTheme";
import { statusLabels } from "@/utils/format";

export function StatusChip({ status }: { status: MachineStatus }) {
  return (
    <Chip
      label={statusLabels[status]}
      size="small"
      sx={{
        bgcolor: statusColors[status],
        color: "#fff",
        fontWeight: 600,
      }}
    />
  );
}
