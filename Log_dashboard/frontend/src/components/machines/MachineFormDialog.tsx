import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import {
  Dialog,
  useMediaQuery,
  useTheme,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  MenuItem,
  Grid,
  FormControlLabel,
  Switch,
  Alert,
} from "@mui/material";
import type { Machine, MachineInput, MachineStatus } from "@/types";
import { MACHINE_TYPE_OPTIONS } from "@/constants/machineTypes";
import { statusLabels } from "@/utils/format";
import {
  emptyMachineInput,
  machineToInput,
  validateMachineInput,
  hasMachineFormErrors,
} from "@/utils/machineForm";
import { hasApi } from "@/services/apiClient";

interface MachineFormDialogProps {
  open: boolean;
  mode: "create" | "edit";
  machine?: Machine;
  existingMachines: Machine[];
  onClose: () => void;
  onSubmit: (input: MachineInput) => void;
  isPending?: boolean;
  error?: string | null;
}

export function MachineFormDialog({
  open,
  mode,
  machine,
  existingMachines,
  onClose,
  onSubmit,
  isPending,
  error,
}: MachineFormDialogProps) {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down("sm"));
  const [form, setForm] = useState<MachineInput>(emptyMachineInput());
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTouched(false);
    setForm(mode === "edit" && machine ? machineToInput(machine) : emptyMachineInput());
  }, [open, mode, machine]);

  const errors = useMemo(
    () => validateMachineInput(form, existingMachines, machine?.id),
    [form, existingMachines, machine?.id],
  );

  const handleSubmit = () => {
    setTouched(true);
    if (hasMachineFormErrors(errors)) return;
    onSubmit({
      ...form,
      code: form.code.trim().toUpperCase(),
      name: form.name.trim(),
      type: form.type.trim(),
      department: form.department.trim(),
      line: form.line?.trim() || undefined,
      ipAddress: form.ipAddress.trim(),
      rdpUrl: form.rdpUrl?.trim() || undefined,
    });
  };

  const field = (key: keyof MachineInput) => ({
    value: form[key] as string | boolean,
    onChange: (e: ChangeEvent<HTMLInputElement>) => {
      const v = e.target.type === "checkbox" ? e.target.checked : e.target.value;
      setForm((prev) => ({ ...prev, [key]: v }));
    },
  });

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="md"
      fullScreen={fullScreen}
      scroll="paper"
    >
      <DialogTitle>
        {mode === "create" ? "Aggiungi macchinario" : `Modifica ${machine?.code ?? ""}`}
      </DialogTitle>
      <DialogContent dividers>
        {!hasApi && (
          <Alert severity="info" sx={{ mb: 2 }}>
            Modalità demo: le modifiche restano attive in questa sessione. Con API collegata, i dati
            vengono salvati sul backend.
          </Alert>
        )}
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        <Grid container spacing={2} sx={{ pt: 0.5 }}>
          <Grid item xs={12} sm={6}>
            <TextField
              label="Codice"
              fullWidth
              required
              placeholder="CTS-016"
              {...field("code")}
              error={touched && Boolean(errors.code)}
              helperText={touched ? errors.code : "Identificativo univoco"}
              disabled={mode === "edit"}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              label="Nome"
              fullWidth
              required
              {...field("name")}
              error={touched && Boolean(errors.name)}
              helperText={touched ? errors.name : undefined}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField select label="Tipo" fullWidth required {...field("type")}>
              {MACHINE_TYPE_OPTIONS.map((t) => (
                <MenuItem key={t} value={t}>
                  {t}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              select
              label="Stato"
              fullWidth
              value={form.status}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, status: e.target.value as MachineStatus }))
              }
            >
              {(Object.keys(statusLabels) as MachineStatus[]).map((s) => (
                <MenuItem key={s} value={s}>
                  {statusLabels[s]}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              label="Reparto"
              fullWidth
              required
              {...field("department")}
              error={touched && Boolean(errors.department)}
              helperText={touched ? errors.department : undefined}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField label="Linea" fullWidth {...field("line")} placeholder="Linea 1" />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              label="Indirizzo IP"
              fullWidth
              required
              placeholder="10.20.1.100"
              {...field("ipAddress")}
              error={touched && Boolean(errors.ipAddress)}
              helperText={touched ? errors.ipAddress : "Per interconnessione e monitoraggio"}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              label="URL connessione RDP (opzionale)"
              fullWidth
              {...field("rdpUrl")}
              placeholder="Gateway Guacamole — vuoto = generato da codice"
            />
          </Grid>
          <Grid item xs={12}>
            <FormControlLabel
              control={
                <Switch
                  checked={form.interconnected}
                  onChange={(e) => setForm((prev) => ({ ...prev, interconnected: e.target.checked }))}
                />
              }
              label="Interconnessione attiva"
            />
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} disabled={isPending}>
          Annulla
        </Button>
        <Button variant="contained" onClick={handleSubmit} disabled={isPending}>
          {mode === "create" ? "Aggiungi" : "Salva modifiche"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
