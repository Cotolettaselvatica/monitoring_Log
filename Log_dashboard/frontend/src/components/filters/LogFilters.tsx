import {
  Paper,
  Grid,
  TextField,
  MenuItem,
  Typography,
  Button,
  Box,
} from "@mui/material";
import { DatePicker } from "@mui/x-date-pickers";
import type { Machine, LogLevel } from "@/types";
import type { LogFilterState } from "@/utils/filters";
import { defaultLogFilters } from "@/utils/filters";
import { levelLabels } from "@/utils/format";

interface LogFiltersProps {
  filters: LogFilterState;
  onChange: (f: LogFilterState) => void;
  machines: Machine[];
  actions: string[];
}

export function LogFilters({ filters, onChange, machines, actions }: LogFiltersProps) {
  const set = (patch: Partial<LogFilterState>) => onChange({ ...filters, ...patch });

  return (
    <Paper sx={{ p: 2, mb: 2 }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
        <Typography variant="subtitle1" fontWeight={600}>
          Filtri
        </Typography>
        <Button size="small" onClick={() => onChange(defaultLogFilters)}>
          Reset
        </Button>
      </Box>
      <Grid container spacing={2}>
        <Grid item xs={12} sm={6} md={3}>
          <DatePicker
            label="Da data"
            value={filters.dateFrom}
            onChange={(v) => set({ dateFrom: v })}
            slotProps={{ textField: { size: "small", fullWidth: true } }}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <DatePicker
            label="A data"
            value={filters.dateTo}
            onChange={(v) => set({ dateTo: v })}
            slotProps={{ textField: { size: "small", fullWidth: true } }}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <TextField
            select
            fullWidth
            size="small"
            label="Macchinario"
            value={filters.machineId}
            onChange={(e) => set({ machineId: e.target.value })}
          >
            <MenuItem value="">Tutti</MenuItem>
            {machines.map((m) => (
              <MenuItem key={m.id} value={m.id}>
                {m.code} — {m.name}
              </MenuItem>
            ))}
          </TextField>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <TextField
            select
            fullWidth
            size="small"
            label="Livello"
            value={filters.level}
            onChange={(e) => set({ level: e.target.value as LogLevel | "" })}
          >
            <MenuItem value="">Tutti</MenuItem>
            {(Object.keys(levelLabels) as LogLevel[]).map((l) => (
              <MenuItem key={l} value={l}>
                {levelLabels[l]}
              </MenuItem>
            ))}
          </TextField>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <TextField
            select
            fullWidth
            size="small"
            label="Azione"
            value={filters.action}
            onChange={(e) => set({ action: e.target.value })}
          >
            <MenuItem value="">Tutte</MenuItem>
            {actions.map((a) => (
              <MenuItem key={a} value={a}>
                {a}
              </MenuItem>
            ))}
          </TextField>
        </Grid>
        <Grid item xs={12} sm={6} md={9}>
          <TextField
            fullWidth
            size="small"
            label="Ricerca testo"
            placeholder="Messaggio, utente, codice..."
            value={filters.search}
            onChange={(e) => set({ search: e.target.value })}
          />
        </Grid>
      </Grid>
    </Paper>
  );
}
