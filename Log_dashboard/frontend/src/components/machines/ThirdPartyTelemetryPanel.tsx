import {
  Box,
  Card,
  CardContent,
  Chip,
  IconButton,
  Paper,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import { SectionTitle } from "@/components/layout/SectionTitle";
import {
  VETTASOFT_TELEMETRY_URL,
  VETTASOFT_TRACKED_LABELS,
} from "@/constants/thirdPartyTelemetry";

export function ThirdPartyTelemetryPanel() {
  return (
    <Card variant="outlined" sx={{ mt: 4, mb: 2 }} id="telemetria-terze-parti">
      <CardContent sx={{ p: { xs: 1.5, sm: 2.5 } }}>
        <SectionTitle
          title="Telemetria terze parti (VettaSoft)"
          subtitle="Accesso in-page al portale di tracciamento esterno"
          action={
            <Tooltip title="Apri il portale in una nuova scheda del browser">
              <IconButton
                href={VETTASOFT_TELEMETRY_URL}
                target="_blank"
                rel="noopener noreferrer"
                component="a"
                size="small"
                aria-label="Apri telemetria VettaSoft in nuova scheda"
              >
                <OpenInNewIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          }
        />

        <Stack direction="row" flexWrap="wrap" gap={1} sx={{ mb: 2 }}>
          {VETTASOFT_TRACKED_LABELS.map((label) => (
            <Chip key={label} label={label} size="small" color="secondary" variant="outlined" />
          ))}
        </Stack>

        <Paper variant="outlined" sx={{ overflow: "hidden" }}>
          <Box
            sx={{
              bgcolor: "grey.900",
              color: "grey.100",
              px: 2,
              py: 0.75,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <Typography variant="caption">VettaSoft — login e telemetria</Typography>
            <Typography variant="caption" color="grey.400">
              Proxy same-origin (/vettasoft)
            </Typography>
          </Box>
          <Box
            component="iframe"
            src={VETTASOFT_TELEMETRY_URL}
            title="Telemetria VettaSoft — login"
            name="vettasoft-telemetry"
            sx={{
              display: "block",
              width: "100%",
              height: { xs: 520, sm: 640, md: 720 },
              border: 0,
              bgcolor: "background.default",
            }}
          />
        </Paper>
      </CardContent>
    </Card>
  );
}
