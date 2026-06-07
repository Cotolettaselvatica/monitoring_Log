import { useState } from "react";
import { Button, Grid, Alert, Snackbar, Divider } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import type { Machine, MachineInput } from "@/types";
import { FilterBar } from "@/components/filters/FilterBar";
import { MachineCard } from "@/components/machines/MachineCard";
import { MachineFormDialog } from "@/components/machines/MachineFormDialog";
import { MachineDeleteDialog } from "@/components/machines/MachineDeleteDialog";
import { SectionTitle } from "@/components/layout/SectionTitle";
import { filterMachines, type PageFilterState } from "@/utils/filters";
import {
  useCreateMachine,
  useUpdateMachine,
  useDeleteMachine,
  useLogAudit,
} from "@/hooks/useData";
import { SYSTEM_ACTOR } from "@/constants/audit";

interface DashboardMachinesPanelProps {
  machines: Machine[];
  filters: PageFilterState;
  onFiltersChange: (f: PageFilterState) => void;
}

export function DashboardMachinesPanel({
  machines,
  filters,
  onFiltersChange,
}: DashboardMachinesPanelProps) {
  const [formMode, setFormMode] = useState<"create" | "edit" | null>(null);
  const [editing, setEditing] = useState<Machine | null>(null);
  const [deleting, setDeleting] = useState<Machine | null>(null);
  const [snack, setSnack] = useState<string | null>(null);

  const createMachine = useCreateMachine();
  const updateMachine = useUpdateMachine();
  const deleteMachine = useDeleteMachine();
  const logAudit = useLogAudit();

  const filtered = filterMachines(machines, filters);

  const closeForm = () => {
    setFormMode(null);
    setEditing(null);
  };

  const handleCreate = (input: MachineInput) => {
    createMachine.mutate(input, {
      onSuccess: (m) => {
        logAudit.mutate({
          operator: SYSTEM_ACTOR,
          action: "CREATE_MACHINE",
          entityType: "machine",
          entityId: m.id,
          details: m.code,
        });
        setSnack(`Macchinario ${m.code} aggiunto`);
        closeForm();
      },
    });
  };

  const handleUpdate = (input: MachineInput) => {
    if (!editing) return;
    updateMachine.mutate(
      { id: editing.id, input },
      {
        onSuccess: (m) => {
          logAudit.mutate({
            operator: SYSTEM_ACTOR,
            action: "UPDATE_MACHINE",
            entityType: "machine",
            entityId: m.id,
            details: m.code,
          });
          setSnack(`Macchinario ${m.code} aggiornato`);
          closeForm();
        },
      },
    );
  };

  const handleDelete = () => {
    if (!deleting) return;
    deleteMachine.mutate(deleting.id, {
      onSuccess: () => {
        logAudit.mutate({
          operator: SYSTEM_ACTOR,
          action: "DELETE_MACHINE",
          entityType: "machine",
          entityId: deleting.id,
          details: deleting.code,
        });
        setSnack(`Macchinario ${deleting.code} eliminato`);
        setDeleting(null);
      },
    });
  };

  const formError =
    (createMachine.error ?? updateMachine.error) instanceof Error
      ? (createMachine.error ?? updateMachine.error)?.message
      : null;

  return (
    <>
      <Divider sx={{ mb: 3 }} />
      <SectionTitle
        title="Gestione macchinari"
        subtitle="Anagrafica, IP, interconnessione e accesso RDP"
        action={
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setFormMode("create")}>
            Aggiungi macchinario
          </Button>
        }
      />

      <FilterBar
        filters={filters}
        onChange={onFiltersChange}
        machines={machines}
        fields={["machine", "department", "line", "status", "search"]}
      />

      {filtered.length === 0 && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Nessun macchinario corrisponde ai filtri. Aggiungine uno con il pulsante sopra.
        </Alert>
      )}

      <Grid container spacing={{ xs: 1.5, sm: 2 }}>
        {filtered.map((m) => (
          <Grid item xs={12} sm={6} md={4} lg={3} key={m.id}>
            <MachineCard
              machine={m}
              onEdit={() => {
                setEditing(m);
                setFormMode("edit");
              }}
              onDelete={() => setDeleting(m)}
            />
          </Grid>
        ))}
      </Grid>

      <MachineFormDialog
        open={formMode !== null}
        mode={formMode === "edit" ? "edit" : "create"}
        machine={editing ?? undefined}
        existingMachines={machines}
        onClose={closeForm}
        onSubmit={formMode === "edit" ? handleUpdate : handleCreate}
        isPending={createMachine.isPending || updateMachine.isPending}
        error={formError}
      />

      <MachineDeleteDialog
        machine={deleting}
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={handleDelete}
        isPending={deleteMachine.isPending}
        error={deleteMachine.error instanceof Error ? deleteMachine.error.message : null}
      />

      <Snackbar
        open={Boolean(snack)}
        autoHideDuration={4000}
        onClose={() => setSnack(null)}
        message={snack}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      />
    </>
  );
}
