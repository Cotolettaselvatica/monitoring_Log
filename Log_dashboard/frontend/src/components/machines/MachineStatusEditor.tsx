import { Box, TextField, MenuItem, Alert, Tooltip } from "@mui/material";
import type { Machine, MachineStatus } from "@/types";
import { StatusChip } from "@/components/common/StatusChip";
import { hasApi } from "@/services/apiClient";
import { statusLabels } from "@/utils/format";
import { useUpdateMachineStatus } from "@/hooks/useMachineStatus";

interface MachineStatusEditorProps {
  machine: Machine;
  /** Layout compatto per intestazione scheda macchinario */
  compact?: boolean;
}

export function MachineStatusEditor({ machine, compact }: MachineStatusEditorProps) {
  const update = useUpdateMachineStatus(machine.id);

  const select = (
    <TextField
      select
      size="small"
      label={compact ? undefined : "Modifica stato"}
      value={machine.status}
      onChange={(e) =>
        update.mutate(e.target.value as MachineStatus, { onError: () => {} })
      }
      disabled={update.isPending || !hasApi}
      sx={{ minWidth: compact ? 140 : 180 }}
    >
      {(Object.keys(statusLabels) as MachineStatus[]).map((s) => (
        <MenuItem key={s} value={s}>
          {statusLabels[s]}
        </MenuItem>
      ))}
    </TextField>
  );

  return (
    <Box>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1.5,
          flexWrap: "wrap",
          mb: compact ? 0 : 2,
        }}
      >
        <StatusChip status={machine.status} />
        {hasApi ? (
          select
        ) : (
          <Tooltip title="Collegare il backend API per modificare lo stato">
            <span>{select}</span>
          </Tooltip>
        )}
      </Box>
      {update.isError && (
        <Alert severity="error" sx={{ mt: 1 }}>
          {update.error instanceof Error ? update.error.message : "Errore aggiornamento stato"}
        </Alert>
      )}
    </Box>
  );
}
