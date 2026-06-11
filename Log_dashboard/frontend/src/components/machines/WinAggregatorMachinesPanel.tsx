import { useState } from "react";
import {
  Alert,
  Box,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  Grid,
  Snackbar,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import DesktopWindowsIcon from "@mui/icons-material/DesktopWindows";
import LanIcon from "@mui/icons-material/Lan";
import { SectionTitle } from "@/components/layout/SectionTitle";
import { LoadingState } from "@/components/common/LoadingState";
import { useAggregatorMachines } from "@/hooks/useData";
import { isValidRdpHost, openNativeRdpSession } from "@/utils/rdpLaunch";
import type { AggregatorMachine } from "@/types";

function formatPezzoLabel(value: string): string {
  return value.replace(/_/g, " ");
}

export function WinAggregatorMachinesPanel() {
  const { data: machines = [], isLoading, isError } = useAggregatorMachines();
  const [snackbar, setSnackbar] = useState<string | null>(null);

  const handleConnect = async (machine: AggregatorMachine) => {
    if (!machine.connected) return;
    if (!machine.username || !machine.password) {
      setSnackbar("Credenziali RDP non configurate per questa macchina.");
      return;
    }
    if (!isValidRdpHost(machine.smbHost)) {
      setSnackbar("Indirizzo host non valido per la connessione RDP.");
      return;
    }

    const { passwordCopied } = await openNativeRdpSession({
      host: machine.smbHost,
      username: machine.username,
      password: machine.password,
      domain: machine.domain,
      filename: machine.id,
    });

    setSnackbar(
      passwordCopied
        ? "File RDP scaricato — password copiata negli appunti."
        : "File RDP scaricato — incollare la password al prompt di accesso.",
    );
  };

  return (
    <Card variant="outlined" sx={{ mt: 4, mb: 2 }} id="macchine-windows-aggregator">
      <CardContent sx={{ p: { xs: 1.5, sm: 2.5 } }}>
        <SectionTitle
          title="Macchine RDP"
          subtitle="Sorgenti SMB da WIN_log_aggregator — clic per avviare RDP nativo"
        />

        {isLoading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}>
            <LoadingState label="Caricamento macchine..." />
          </Box>
        ) : isError ? (
          <Alert severity="warning">
            Impossibile caricare l&apos;elenco macchine dall&apos;API. Verificare{" "}
            <code>AGGREGATOR_MACHINES_CONFIG</code> nel backend.
          </Alert>
        ) : (
          <Grid container spacing={1.5}>
            {machines.map((machine) => {
              const offline = !machine.connected;
              const clickable = machine.connected && isValidRdpHost(machine.smbHost);

              const cardBody = (
                <CardContent sx={{ p: 1.5, "&:last-child": { pb: 1.5 } }}>
                  <Stack direction="row" spacing={1} alignItems="flex-start" sx={{ mb: 1 }}>
                    <Box
                      sx={{
                        mt: 0.25,
                        color: offline ? "text.disabled" : "primary.main",
                        display: "flex",
                      }}
                    >
                      {offline ? <LanIcon fontSize="small" /> : <DesktopWindowsIcon fontSize="small" />}
                    </Box>
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      <Typography variant="subtitle2" fontWeight={600} noWrap title={machine.nomeMacchinario}>
                        {machine.nomeMacchinario}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" display="block" noWrap>
                        {machine.smbHost}
                      </Typography>
                    </Box>
                    {offline && (
                      <Chip label="Offline" size="small" color="default" variant="outlined" sx={{ flexShrink: 0 }} />
                    )}
                  </Stack>
                  <Typography variant="body2" color="text.secondary" sx={{ minHeight: 40 }}>
                    {formatPezzoLabel(machine.nomePezzo)}
                  </Typography>
                  {machine.connected && machine.username && (
                    <Typography variant="caption" color="text.secondary">
                      Utente: {machine.domain ? `${machine.domain}\\${machine.username}` : machine.username}
                    </Typography>
                  )}
                </CardContent>
              );

              return (
                <Grid item xs={12} sm={6} md={4} lg={3} key={machine.id}>
                  <Card
                    variant="outlined"
                    sx={{
                      height: "100%",
                      opacity: offline ? 0.72 : 1,
                      bgcolor: offline ? "action.hover" : "background.paper",
                    }}
                  >
                    {clickable ? (
                      <Tooltip title="Scarica file RDP e avvia connessione remota">
                        <CardActionArea onClick={() => void handleConnect(machine)} sx={{ height: "100%" }}>
                          {cardBody}
                        </CardActionArea>
                      </Tooltip>
                    ) : (
                      cardBody
                    )}
                  </Card>
                </Grid>
              );
            })}
          </Grid>
        )}
      </CardContent>

      <Snackbar
        open={Boolean(snackbar)}
        autoHideDuration={5000}
        onClose={() => setSnackbar(null)}
        message={snackbar ?? ""}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      />
    </Card>
  );
}
