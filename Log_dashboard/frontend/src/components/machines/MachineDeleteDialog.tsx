import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Alert,
} from "@mui/material";
import type { Machine } from "@/types";

interface MachineDeleteDialogProps {
  machine: Machine | null;
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isPending?: boolean;
  error?: string | null;
}

export function MachineDeleteDialog({
  machine,
  open,
  onClose,
  onConfirm,
  isPending,
  error,
}: MachineDeleteDialogProps) {
  if (!machine) return null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Elimina macchinario</DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        <Typography>
          Confermi l&apos;eliminazione di <strong>{machine.code}</strong> — {machine.name}? L&apos;azione
          non è reversibile.
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={isPending}>
          Annulla
        </Button>
        <Button color="error" variant="contained" onClick={onConfirm} disabled={isPending}>
          Elimina
        </Button>
      </DialogActions>
    </Dialog>
  );
}
