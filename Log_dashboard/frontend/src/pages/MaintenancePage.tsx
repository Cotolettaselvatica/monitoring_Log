import { useMemo, useState } from "react";
import {
  Button,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Grid,
  useTheme,
  useMediaQuery,
} from "@mui/material";
import {
  useMaintenance,
  useMachines,
  useCreateMaintenance,
  useLogAudit,
} from "@/hooks/useData";
import { SYSTEM_ACTOR } from "@/constants/audit";
import { FilterBar } from "@/components/filters/FilterBar";
import { defaultPageFilters, filterMaintenance, type PageFilterState } from "@/utils/filters";
import { LoadingState } from "@/components/common/LoadingState";
import { RequiresApiAlert } from "@/components/common/RequiresApiAlert";
import { ScrollableTable } from "@/components/common/ScrollableTable";
import { PageHeader } from "@/components/layout/PageHeader";
import { hasApi } from "@/services/apiClient";
import { formatDateTime, noteTypeLabels } from "@/utils/format";
import type { NoteType } from "@/types";

export default function MaintenancePage() {
  const theme = useTheme();
  const fullScreenDialog = useMediaQuery(theme.breakpoints.down("sm"));
  const { data: items = [], isLoading } = useMaintenance();
  const { data: machines = [] } = useMachines();
  const [filters, setFilters] = useState<PageFilterState>(defaultPageFilters);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    machineId: "",
    type: "ordinaria" as NoteType,
    scheduledAt: "",
    dueAt: "",
    assignee: "",
    description: "",
  });
  const create = useCreateMaintenance();
  const logAudit = useLogAudit();

  const filtered = useMemo(() => filterMaintenance(items, filters), [items, filters]);

  const handleCreate = () => {
    create.mutate(
      { ...form, assignee: form.assignee || SYSTEM_ACTOR },
      {
        onSuccess: (plan) => {
          logAudit.mutate({
            operator: SYSTEM_ACTOR,
            action: "CREATE_MAINTENANCE",
            entityType: "maintenance",
            entityId: plan.id,
            details: form.description,
          });
          setOpen(false);
        },
      },
    );
  };

  if (isLoading) return <LoadingState />;

  return (
    <>
      <PageHeader
        title="Manutenzioni"
        subtitle="Pianificazione interventi ordinari e straordinari sulla flotta"
        actions={
          <Button variant="contained" onClick={() => setOpen(true)} disabled={!hasApi}>
            Nuova pianificazione
          </Button>
        }
      />
      {!hasApi && <RequiresApiAlert />}
      <FilterBar
        filters={filters}
        onChange={setFilters}
        machines={machines}
        fields={["dates", "machine", "maintenanceStatus", "search"]}
      />
      <ScrollableTable>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell>Macchinario</TableCell>
              <TableCell>Tipo</TableCell>
              <TableCell>Programmata</TableCell>
              <TableCell>Scadenza</TableCell>
              <TableCell>Stato</TableCell>
              <TableCell>Assegnatario</TableCell>
              <TableCell>Descrizione</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filtered.map((m) => (
              <TableRow key={m.id}>
                <TableCell>
                  {m.machineCode} — {m.machineName}
                </TableCell>
                <TableCell>{noteTypeLabels[m.type]}</TableCell>
                <TableCell>{formatDateTime(m.scheduledAt)}</TableCell>
                <TableCell>{formatDateTime(m.dueAt)}</TableCell>
                <TableCell>{m.status}</TableCell>
                <TableCell>{m.assignee}</TableCell>
                <TableCell>{m.description}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </ScrollableTable>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        maxWidth="sm"
        fullWidth
        fullScreen={fullScreenDialog}
      >
        <DialogTitle>Nuova manutenzione</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={12}>
              <TextField
                select
                fullWidth
                label="Macchinario"
                value={form.machineId}
                onChange={(e) => setForm({ ...form, machineId: e.target.value })}
              >
                {machines.map((m) => (
                  <MenuItem key={m.id} value={m.id}>
                    {m.code} — {m.name}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                select
                fullWidth
                label="Tipo"
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value as NoteType })}
              >
                <MenuItem value="ordinaria">{noteTypeLabels.ordinaria}</MenuItem>
                <MenuItem value="straordinaria">{noteTypeLabels.straordinaria}</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Descrizione"
                multiline
                rows={3}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                type="datetime-local"
                label="Programmata"
                InputLabelProps={{ shrink: true }}
                value={form.scheduledAt}
                onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                type="datetime-local"
                label="Scadenza"
                InputLabelProps={{ shrink: true }}
                value={form.dueAt}
                onChange={(e) => setForm({ ...form, dueAt: e.target.value })}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Annulla</Button>
          <Button
            variant="contained"
            onClick={handleCreate}
            disabled={!form.machineId || !form.description || create.isPending}
          >
            Salva
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
