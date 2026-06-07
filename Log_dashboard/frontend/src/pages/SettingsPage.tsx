import { TextField, MenuItem, Button, Grid, Alert, Paper } from "@mui/material";
import { PageHeader } from "@/components/layout/PageHeader";
import { useSettings } from "@/context/SettingsContext";
import { useSaveSettings } from "@/hooks/useData";
import { RequiresApiAlert } from "@/components/common/RequiresApiAlert";
import { hasApi } from "@/services/apiClient";
import type { ThemeMode } from "@/types";

export default function SettingsPage() {
  const { draft, setDraft } = useSettings();
  const save = useSaveSettings();

  const handleSave = () => {
    save.mutate(draft, {
      onSuccess: (s) => setDraft(s),
    });
  };

  return (
    <>
      <PageHeader
        title="Impostazioni"
        subtitle="Polling, soglie operative, tema interfaccia e gateway RDP"
      />
      {!hasApi && <RequiresApiAlert />}
      {save.isSuccess && (
        <Alert severity="success" sx={{ mb: 2 }}>
          Impostazioni salvate.
        </Alert>
      )}
      {save.isError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {save.error instanceof Error ? save.error.message : "Errore salvataggio"}
        </Alert>
      )}
      <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 }, maxWidth: 720 }}>
      <Grid container spacing={2}>
        <Grid item xs={12}>
          <TextField
            fullWidth
            label="URL gateway RDP"
            value={draft.rdpGatewayUrl}
            onChange={(e) => setDraft({ ...draft, rdpGatewayUrl: e.target.value })}
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField
            fullWidth
            type="number"
            label="Intervallo polling (secondi)"
            value={draft.pollingIntervalSec}
            onChange={(e) =>
              setDraft({ ...draft, pollingIntervalSec: Number(e.target.value) || 30 })
            }
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField
            select
            fullWidth
            label="Tema"
            value={draft.themeMode}
            onChange={(e) => setDraft({ ...draft, themeMode: e.target.value as ThemeMode })}
          >
            <MenuItem value="light">Chiaro</MenuItem>
            <MenuItem value="dark">Scuro</MenuItem>
          </TextField>
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField
            fullWidth
            type="number"
            label="Soglia offline (minuti)"
            value={draft.offlineThresholdMin}
            onChange={(e) =>
              setDraft({ ...draft, offlineThresholdMin: Number(e.target.value) || 15 })
            }
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField
            fullWidth
            type="number"
            label="Soglia errori/ora"
            value={draft.errorThresholdPerHour}
            onChange={(e) =>
              setDraft({ ...draft, errorThresholdPerHour: Number(e.target.value) || 5 })
            }
          />
        </Grid>
        <Grid item xs={12}>
          <Button variant="contained" onClick={handleSave} disabled={!hasApi || save.isPending}>
            Salva impostazioni
          </Button>
        </Grid>
      </Grid>
      </Paper>
    </>
  );
}
