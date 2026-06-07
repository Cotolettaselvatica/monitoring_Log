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
import type { Machine, LogLevel, MachineStatus, AlertSeverity, AlertStatus, MaintenanceStatus } from "@/types";
import type { PageFilterState } from "@/utils/filters";
import { defaultPageFilters, uniqueDepartments, uniqueLines } from "@/utils/filters";
import { levelLabels, statusLabels } from "@/utils/format";

export type FilterField =
  | "dates"
  | "machine"
  | "department"
  | "line"
  | "status"
  | "level"
  | "action"
  | "severity"
  | "alertStatus"
  | "maintenanceStatus"
  | "search";

const severityLabels: Record<AlertSeverity, string> = {
  info: "Info",
  warning: "Avviso",
  critical: "Critico",
};

const alertStatusLabels: Record<AlertStatus, string> = {
  active: "Attivo",
  acknowledged: "Preso in carico",
  resolved: "Risolto",
};

const maintenanceStatusLabels: Record<MaintenanceStatus, string> = {
  pianificata: "Pianificata",
  in_corso: "In corso",
  completata: "Completata",
  scaduta: "Scaduta",
};

interface FilterBarProps {
  filters: PageFilterState;
  onChange: (f: PageFilterState) => void;
  machines?: Machine[];
  actions?: string[];
  fields: FilterField[];
  title?: string;
}

export function FilterBar({
  filters,
  onChange,
  machines = [],
  actions = [],
  fields,
  title = "Filtri",
}: FilterBarProps) {
  const set = (patch: Partial<PageFilterState>) => onChange({ ...filters, ...patch });
  const departments = uniqueDepartments(machines);
  const lines = uniqueLines(machines, filters.department || undefined);

  return (
    <Paper variant="outlined" sx={{ p: { xs: 1.5, sm: 2 }, mb: 2, boxShadow: "none" }}>
      <Box
        sx={{
          display: "flex",
          flexDirection: { xs: "column", sm: "row" },
          justifyContent: "space-between",
          alignItems: { xs: "stretch", sm: "center" },
          gap: 1,
          mb: 2,
        }}
      >
        <Typography variant="subtitle1" fontWeight={600}>
          {title}
        </Typography>
        <Button size="small" variant="outlined" onClick={() => onChange(defaultPageFilters)}>
          Reset filtri
        </Button>
      </Box>
      <Grid container spacing={{ xs: 1.5, sm: 2 }}>
        {fields.includes("dates") && (
          <>
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
          </>
        )}
        {fields.includes("machine") && (
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
        )}
        {fields.includes("department") && (
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              select
              fullWidth
              size="small"
              label="Reparto"
              value={filters.department}
              onChange={(e) => set({ department: e.target.value, line: "" })}
            >
              <MenuItem value="">Tutti</MenuItem>
              {departments.map((d) => (
                <MenuItem key={d} value={d}>
                  {d}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
        )}
        {fields.includes("line") && (
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              select
              fullWidth
              size="small"
              label="Linea"
              value={filters.line}
              onChange={(e) => set({ line: e.target.value })}
            >
              <MenuItem value="">Tutte</MenuItem>
              {lines.map((l) => (
                <MenuItem key={l} value={l}>
                  {l}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
        )}
        {fields.includes("status") && (
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              select
              fullWidth
              size="small"
              label="Stato macchinario"
              value={filters.status}
              onChange={(e) => set({ status: e.target.value as MachineStatus | "" })}
            >
              <MenuItem value="">Tutti</MenuItem>
              {(Object.keys(statusLabels) as MachineStatus[]).map((s) => (
                <MenuItem key={s} value={s}>
                  {statusLabels[s]}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
        )}
        {fields.includes("level") && (
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              select
              fullWidth
              size="small"
              label="Livello log"
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
        )}
        {fields.includes("action") && (
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
        )}
        {fields.includes("severity") && (
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              select
              fullWidth
              size="small"
              label="Severità"
              value={filters.severity}
              onChange={(e) => set({ severity: e.target.value as AlertSeverity | "" })}
            >
              <MenuItem value="">Tutte</MenuItem>
              {(Object.keys(severityLabels) as AlertSeverity[]).map((s) => (
                <MenuItem key={s} value={s}>
                  {severityLabels[s]}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
        )}
        {fields.includes("alertStatus") && (
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              select
              fullWidth
              size="small"
              label="Stato allarme"
              value={filters.alertStatus}
              onChange={(e) => set({ alertStatus: e.target.value as AlertStatus | "" })}
            >
              <MenuItem value="">Tutti</MenuItem>
              {(Object.keys(alertStatusLabels) as AlertStatus[]).map((s) => (
                <MenuItem key={s} value={s}>
                  {alertStatusLabels[s]}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
        )}
        {fields.includes("maintenanceStatus") && (
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              select
              fullWidth
              size="small"
              label="Stato manutenzione"
              value={filters.maintenanceStatus}
              onChange={(e) =>
                set({ maintenanceStatus: e.target.value as MaintenanceStatus | "" })
              }
            >
              <MenuItem value="">Tutti</MenuItem>
              {(Object.keys(maintenanceStatusLabels) as MaintenanceStatus[]).map((s) => (
                <MenuItem key={s} value={s}>
                  {maintenanceStatusLabels[s]}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
        )}
        {fields.includes("search") && (
          <Grid item xs={12} md={fields.length > 4 ? 6 : 9}>
            <TextField
              fullWidth
              size="small"
              label="Ricerca testo"
              value={filters.search}
              onChange={(e) => set({ search: e.target.value })}
            />
          </Grid>
        )}
      </Grid>
    </Paper>
  );
}
