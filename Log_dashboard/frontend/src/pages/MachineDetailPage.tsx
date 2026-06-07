import { useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Box,
  Typography,
  Tabs,
  Tab,
  Paper,
  Grid,
  CircularProgress,
  Alert,
  Button,
  TextField,
  MenuItem,
  List,
  ListItem,
  ListItemText,
  Chip,
  IconButton,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import EditIcon from "@mui/icons-material/Edit";
import {
  useMachine,
  useMachineLogs,
  useMachineNotes,
  useCreateNote,
  useMachineMetrics,
} from "@/hooks/useData";
import { KpiCard } from "@/components/common/KpiCard";
import { catisColors } from "@/theme/catisTheme";
import { MachineStatusEditor } from "@/components/machines/MachineStatusEditor";
import { MachineAvatar } from "@/components/machines/MachineAvatar";
import { MachineImageUpload } from "@/components/machines/MachineImageUpload";
import { MachineImageEditDialog } from "@/components/machines/MachineImageEditDialog";
import { MachineAnalyticsPanel } from "@/components/machines/MachineAnalyticsPanel";
import { ReliabilityMetricsRow } from "@/components/metrics/ReliabilityMetricsRow";
import { enrichLogsForMachine } from "@/utils/logRows";
import { LogDataGrid } from "@/components/logs/LogDataGrid";
import { DataGridShell } from "@/components/common/DataGridShell";
import { RdpViewer } from "@/components/rdp/RdpViewer";
import { formatDateTime, formatRelative, noteTypeLabels } from "@/utils/format";
import type { NoteType } from "@/types";

export default function MachineDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [tab, setTab] = useState(0);
  const [noteType, setNoteType] = useState<NoteType>("ordinaria");
  const [noteText, setNoteText] = useState("");
  const [noteAuthor, setNoteAuthor] = useState("sistema");
  const [imageEditOpen, setImageEditOpen] = useState(false);

  const { data: machine, isLoading, isError } = useMachine(id);
  const { data: logs = [], isLoading: logsLoading, dataUpdatedAt: logsUpdatedAt } = useMachineLogs(id);
  const { data: notes = [] } = useMachineNotes(id);
  const createNote = useCreateNote(id ?? "");
  const { data: metrics } = useMachineMetrics(id, 7);

  const logRows = useMemo(
    () => (machine ? enrichLogsForMachine(logs, machine) : []),
    [logs, machine],
  );

  if (isLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (isError || !machine) {
    return <Alert severity="error">Macchinario non trovato</Alert>;
  }

  const handleAddNote = () => {
    if (!noteText.trim() || !id) return;
    createNote.mutate(
      { machineId: id, type: noteType, author: noteAuthor, text: noteText },
      { onSuccess: () => setNoteText("") },
    );
  };

  return (
    <Box>
      <Button startIcon={<ArrowBackIcon />} onClick={() => navigate("/")} sx={{ mb: 2 }}>
        Torna alla dashboard
      </Button>

      <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 }, mb: 3 }}>
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2, alignItems: "flex-start" }}>
          <Box
            sx={{
              width: { xs: "100%", sm: 140 },
              borderRadius: 1,
              overflow: "hidden",
              border: 1,
              borderColor: "divider",
              flexShrink: 0,
              position: "relative",
            }}
          >
            <MachineAvatar imageUrl={machine.imageUrl} alt={machine.code} variant="header" />
            <IconButton
              size="small"
              aria-label="Modifica immagine"
              onClick={() => setImageEditOpen(true)}
              sx={{
                position: "absolute",
                top: 4,
                right: 4,
                bgcolor: "background.paper",
                boxShadow: 1,
              }}
            >
              <EditIcon fontSize="small" color="primary" />
            </IconButton>
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="overline" color="primary.main" fontWeight={700}>
              {machine.code}
            </Typography>
            <Typography variant="h4" fontWeight={700} sx={{ fontSize: { xs: "1.35rem", sm: "2rem" } }}>
              {machine.name}
            </Typography>
            <Typography color="text.secondary">
              {machine.type} · {machine.location}
            </Typography>
          </Box>
          <MachineStatusEditor machine={machine} compact />
        </Box>
        <Grid container spacing={2} sx={{ mt: 2 }}>
          <Grid item xs={6} sm={3}>
            <Typography variant="caption" color="text.secondary">
              IP
            </Typography>
            <Typography fontWeight={600}>{machine.ipAddress}</Typography>
          </Grid>
          <Grid item xs={6} sm={3}>
            <Typography variant="caption" color="text.secondary">
              Ultimo contatto
            </Typography>
            <Typography fontWeight={600}>{formatRelative(machine.lastSeen)}</Typography>
          </Grid>
          <Grid item xs={6} sm={3}>
            <Typography variant="caption" color="text.secondary">
              Interconnessione
            </Typography>
            <Typography fontWeight={600}>
              {machine.interconnected ? "Attiva" : "Non attiva"}
            </Typography>
          </Grid>
          <Grid item xs={6} sm={3}>
            <Typography variant="caption" color="text.secondary">
              Timestamp completo
            </Typography>
            <Typography fontWeight={600} variant="body2">
              {formatDateTime(machine.lastSeen)}
            </Typography>
          </Grid>
        </Grid>
      </Paper>

      <MachineImageEditDialog
        open={imageEditOpen}
        onClose={() => setImageEditOpen(false)}
        machineId={machine.id}
        machineCode={machine.code}
        imageUrl={machine.imageUrl}
      />

      <Tabs
        value={tab}
        onChange={(_, v) => setTab(v)}
        variant="scrollable"
        scrollButtons="auto"
        allowScrollButtonsMobile
        sx={{ mb: 2, borderBottom: 1, borderColor: "divider" }}
      >
        <Tab label="Panoramica" />
        <Tab label="Log" />
        <Tab label="RDP" />
        <Tab label="Note manutenzione" />
        <Tab label="Affidabilità" />
      </Tabs>

      {tab === 0 && (
        <>
          <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
            <MachineImageUpload
              machineId={machine.id}
              machineCode={machine.code}
              imageUrl={machine.imageUrl}
            />
          </Paper>
          <MachineAnalyticsPanel
            machine={machine}
            logs={logs}
            logsLoading={logsLoading}
            logsUpdatedAt={logsUpdatedAt}
            metrics={metrics}
          />
        </>
      )}

      {tab === 1 && (
        <DataGridShell minHeight={480}>
          <LogDataGrid rows={logRows} loading={logsLoading} hideMachine height={520} responsive />
        </DataGridShell>
      )}

      {tab === 2 && <RdpViewer defaultUrl={machine.rdpUrl} machineCode={machine.code} />}

      {tab === 3 && (
        <Grid container spacing={2}>
          <Grid item xs={12} md={5}>
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                Nuova nota
              </Typography>
              <TextField
                select
                fullWidth
                size="small"
                label="Tipo"
                value={noteType}
                onChange={(e) => setNoteType(e.target.value as NoteType)}
                sx={{ mb: 2 }}
              >
                <MenuItem value="ordinaria">{noteTypeLabels.ordinaria}</MenuItem>
                <MenuItem value="straordinaria">{noteTypeLabels.straordinaria}</MenuItem>
              </TextField>
              <TextField
                fullWidth
                size="small"
                label="Autore"
                value={noteAuthor}
                onChange={(e) => setNoteAuthor(e.target.value)}
                sx={{ mb: 2 }}
              />
              <TextField
                fullWidth
                multiline
                rows={4}
                label="Testo nota"
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                sx={{ mb: 2 }}
              />
              <Button
                variant="contained"
                onClick={handleAddNote}
                disabled={!noteText.trim() || createNote.isPending}
              >
                Salva nota
              </Button>
            </Paper>
          </Grid>
          <Grid item xs={12} md={7}>
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                Storico note
              </Typography>
              <List>
                {notes.length === 0 && (
                  <Typography color="text.secondary">Nessuna nota registrata</Typography>
                )}
                {notes.map((n) => (
                  <ListItem key={n.id} alignItems="flex-start" divider>
                    <ListItemText
                      primary={
                        <Box sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap" }}>
                          <Chip
                            size="small"
                            label={noteTypeLabels[n.type]}
                            color={n.type === "straordinaria" ? "warning" : "default"}
                          />
                          <Typography variant="caption" color="text.secondary">
                            {formatDateTime(n.timestamp)} — {n.author}
                          </Typography>
                        </Box>
                      }
                      secondary={n.text}
                    />
                  </ListItem>
                ))}
              </List>
            </Paper>
          </Grid>
        </Grid>
      )}

      {tab === 4 && (
        metrics ? (
          <>
            <ReliabilityMetricsRow metrics={metrics} />
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6} md={3}>
                <KpiCard title="Guasti" value={metrics.failures} color={catisColors.red} />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <KpiCard title="Periodo" value={metrics.periodLabel} color={catisColors.ink} />
              </Grid>
            </Grid>
          </>
        ) : (
          <Alert severity="info">Metriche di affidabilità non disponibili per questo macchinario.</Alert>
        )
      )}
    </Box>
  );
}
