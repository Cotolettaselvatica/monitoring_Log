import { useState } from "react";
import {
  Box,
  TextField,
  Button,
  Typography,
  Alert,
  Paper,
  Stack,
} from "@mui/material";
import DesktopWindowsIcon from "@mui/icons-material/DesktopWindows";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";

interface RdpViewerProps {
  defaultUrl?: string;
  machineCode: string;
}

export function RdpViewer({ defaultUrl, machineCode }: RdpViewerProps) {
  const [url, setUrl] = useState(defaultUrl ?? "");
  const [connected, setConnected] = useState(false);

  const handleConnect = () => {
    if (url.trim()) setConnected(true);
  };

  return (
    <Box>
      <Alert severity="info" sx={{ mb: 2 }}>
        Connessione remota tramite gateway web-RDP (es. Apache Guacamole). Configurare{" "}
        <code>VITE_RDP_GATEWAY_URL</code> nel file <code>.env</code>.
      </Alert>

      <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ mb: 2 }}>
        <TextField
          fullWidth
          size="small"
          label="URL gateway RDP"
          value={url}
          onChange={(e) => {
            setUrl(e.target.value);
            setConnected(false);
          }}
          placeholder={`https://guacamole.local/guacamole/#/client/${machineCode}`}
        />
        <Button
          variant="contained"
          startIcon={<DesktopWindowsIcon />}
          onClick={handleConnect}
          disabled={!url.trim()}
        >
          Connetti
        </Button>
        {url && (
          <Button
            variant="outlined"
            startIcon={<OpenInNewIcon />}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            component="a"
          >
            Apri in nuova scheda
          </Button>
        )}
      </Stack>

      {connected ? (
        <Paper variant="outlined" sx={{ overflow: "hidden" }}>
          <Box
            sx={{
              bgcolor: "grey.900",
              color: "grey.100",
              px: 2,
              py: 0.75,
              display: "flex",
              justifyContent: "space-between",
            }}
          >
            <Typography variant="caption">
              Sessione RDP — {machineCode}
            </Typography>
            <Typography variant="caption" color="success.light">
              Connesso
            </Typography>
          </Box>
          <Box
            component="iframe"
            src={url}
            title={`RDP ${machineCode}`}
            sx={{
              width: "100%",
              height: { xs: 360, md: 520 },
              border: 0,
              bgcolor: "#1a1a2e",
            }}
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          />
        </Paper>
      ) : (
        <Paper
          variant="outlined"
          sx={{
            height: 320,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            bgcolor: "grey.50",
          }}
        >
          <Typography color="text.secondary">
            Inserire l&apos;URL del gateway e premere Connetti per visualizzare il desktop remoto
          </Typography>
        </Paper>
      )}
    </Box>
  );
}
