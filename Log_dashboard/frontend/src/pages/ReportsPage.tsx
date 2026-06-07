import { useMemo, useState } from "react";
import {
  Box,
  Typography,
  Paper,
  Button,
  ButtonGroup,
  Divider,
  Alert,
  ToggleButton,
  ToggleButtonGroup,
  TextField,
  MenuItem,
  List,
  ListItem,
  ListItemText,
} from "@mui/material";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import TableViewIcon from "@mui/icons-material/TableView";
import DataObjectIcon from "@mui/icons-material/DataObject";
import GridOnIcon from "@mui/icons-material/GridOn";
import { useMachines, useLogRows } from "@/hooks/useData";
import { FilterBar } from "@/components/filters/FilterBar";
import { RequiresApiAlert } from "@/components/common/RequiresApiAlert";
import { hasApi } from "@/services/apiClient";
import {
  useReportTemplates,
  useReportSchedules,
  useCreateReportTemplate,
  useCreateReportSchedule,
  useLogAudit,
} from "@/hooks/useData";
import { SYSTEM_ACTOR } from "@/constants/audit";
import { PageHeader } from "@/components/layout/PageHeader";
import { PivotTable } from "@/components/pivot/PivotTable";
import { defaultPageFilters, filterLogRows, uniqueActions, type PageFilterState } from "@/utils/filters";
import type { ReportCadence } from "@/types";
import {
  exportData,
  type ExportFormat,
  type ExportColumn,
} from "@/utils/exporters";
import {
  PIVOT_PRESETS,
  pivotToExportRows,
  buildPivot,
  type PivotConfig,
} from "@/utils/pivot";
import { formatDateTime, formatDuration } from "@/utils/format";
import type { LogRow } from "@/types";

const logColumns: ExportColumn<LogRow>[] = [
  { key: "timestamp", header: "Timestamp", value: (r) => formatDateTime(r.timestamp) },
  { key: "machineCode", header: "Codice" },
  { key: "machineName", header: "Macchinario" },
  { key: "machineLocation", header: "Sede" },
  { key: "action", header: "Azione" },
  { key: "level", header: "Livello" },
  { key: "message", header: "Messaggio" },
  { key: "user", header: "Utente" },
  { key: "durationMs", header: "Durata", value: (r) => formatDuration(r.durationMs) },
];

export default function ReportsPage() {
  const [filters, setFilters] = useState<PageFilterState>(defaultPageFilters);
  const [exportView, setExportView] = useState<"standard" | "pivot">("standard");
  const [pivotConfig, setPivotConfig] = useState<PivotConfig>(PIVOT_PRESETS[0].config);
  const [templateName, setTemplateName] = useState("");
  const [scheduleTemplateId, setScheduleTemplateId] = useState("");
  const [scheduleCadence, setScheduleCadence] = useState<ReportCadence>("daily");
  const [scheduleRecipients, setScheduleRecipients] = useState("");

  const { data: machines = [] } = useMachines();
  const { rows: allRows } = useLogRows();
  const { data: templates = [] } = useReportTemplates();
  const { data: schedules = [] } = useReportSchedules();
  const createTemplate = useCreateReportTemplate();
  const createSchedule = useCreateReportSchedule();
  const logAudit = useLogAudit();
  const filtered = useMemo(() => filterLogRows(allRows, filters), [allRows, filters]);
  const actions = useMemo(() => uniqueActions(allRows), [allRows]);

  const pivotExportRows = useMemo(() => {
    const result = buildPivot(filtered, pivotConfig);
    return pivotToExportRows(result);
  }, [filtered, pivotConfig]);

  const pivotColumns: ExportColumn<{ riga: string; colonna: string; valore: number }>[] = [
    { key: "riga", header: "Riga" },
    { key: "colonna", header: "Colonna" },
    { key: "valore", header: "Valore" },
  ];

  const handleExport = (format: ExportFormat) => {
    const stamp = new Date().toISOString().slice(0, 10);
    if (exportView === "standard") {
      exportData(
        format,
        filtered,
        logColumns,
        `catis-log-${stamp}`,
        "Report log interconnessione CATIS",
      );
    } else {
      exportData(
        format,
        pivotExportRows,
        pivotColumns,
        `catis-pivot-${stamp}`,
        "Report pivot interconnessione CATIS",
      );
    }
    logAudit.mutate({
      operator: SYSTEM_ACTOR,
      action: "EXPORT_REPORT",
      entityType: "report",
      entityId: exportView,
      details: `Export ${format}`,
    });
  };

  const handleSaveTemplate = () => {
    if (!templateName.trim()) return;
    createTemplate.mutate(
      {
        name: templateName,
        filterSnapshot: filters as unknown as Record<string, unknown>,
        pivotConfig: pivotConfig as unknown as Record<string, unknown>,
        defaultFormat: "pdf",
      },
      { onSuccess: () => setTemplateName("") },
    );
  };

  const handleSaveSchedule = () => {
    if (!scheduleTemplateId) return;
    createSchedule.mutate(
      {
        templateId: scheduleTemplateId,
        cadence: scheduleCadence,
        recipients: scheduleRecipients,
        enabled: true,
      },
      { onSuccess: () => setScheduleRecipients("") },
    );
  };

  return (
    <Box>
      <PageHeader
        title="Reportistica"
        subtitle="Esportazione dati in PDF, Excel, CSV e JSON — vista standard o pivot"
      />

      <Alert severity="info" sx={{ mb: 2 }}>
        Applica i filtri desiderati, scegli la vista e seleziona il formato di export.
        {filtered.length} record disponibili.
      </Alert>

      <FilterBar
        filters={filters}
        onChange={setFilters}
        machines={machines}
        actions={actions}
        fields={["dates", "machine", "department", "line", "level", "action", "search"]}
      />

      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography variant="subtitle1" fontWeight={600} gutterBottom>
          Template e schedulazione
        </Typography>
        {!hasApi && <RequiresApiAlert />}
        <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", mb: 2 }}>
          <TextField
            size="small"
            label="Nome template"
            value={templateName}
            onChange={(e) => setTemplateName(e.target.value)}
          />
          <Button
            variant="outlined"
            disabled={!hasApi || !templateName.trim()}
            onClick={handleSaveTemplate}
          >
            Salva template (filtri + pivot)
          </Button>
        </Box>
        <List dense sx={{ mb: 2 }}>
          {templates.map((t) => (
            <ListItem key={t.id}>
              <ListItemText primary={t.name} secondary={t.description} />
            </ListItem>
          ))}
        </List>
        <Divider sx={{ my: 2 }} />
        <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", alignItems: "center" }}>
          <TextField
            select
            size="small"
            label="Template"
            value={scheduleTemplateId}
            onChange={(e) => setScheduleTemplateId(e.target.value)}
            sx={{ minWidth: 200 }}
          >
            {templates.map((t) => (
              <MenuItem key={t.id} value={t.id}>
                {t.name}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            size="small"
            label="Cadenza"
            value={scheduleCadence}
            onChange={(e) => setScheduleCadence(e.target.value as ReportCadence)}
          >
            <MenuItem value="daily">Giornaliero</MenuItem>
            <MenuItem value="weekly">Settimanale</MenuItem>
            <MenuItem value="monthly">Mensile</MenuItem>
          </TextField>
          <TextField
            size="small"
            label="Destinatari"
            value={scheduleRecipients}
            onChange={(e) => setScheduleRecipients(e.target.value)}
          />
          <Button variant="outlined" disabled={!hasApi} onClick={handleSaveSchedule}>
            Aggiungi schedulazione
          </Button>
        </Box>
        <List dense>
          {schedules.map((s) => (
            <ListItem key={s.id}>
              <ListItemText
                primary={`${s.templateName} — ${s.cadence}`}
                secondary={`Prossima esecuzione: ${s.nextRun} → ${s.recipients}`}
              />
            </ListItem>
          ))}
        </List>
      </Paper>

      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography variant="subtitle1" fontWeight={600} gutterBottom>
          Tipo export
        </Typography>
        <ToggleButtonGroup
          size="small"
          value={exportView}
          exclusive
          onChange={(_, v) => v && setExportView(v)}
          sx={{ mb: 2 }}
        >
          <ToggleButton value="standard">Vista standard (tabella log)</ToggleButton>
          <ToggleButton value="pivot">Vista pivot</ToggleButton>
        </ToggleButtonGroup>

        <Divider sx={{ my: 2 }} />

        <Typography variant="body2" color="text.secondary" gutterBottom>
          Formati disponibili
        </Typography>
        <ButtonGroup
          variant="contained"
          size="small"
          sx={{
            flexWrap: "wrap",
            "& .MuiButton-root": { flex: { xs: "1 1 45%", sm: "0 0 auto" } },
          }}
        >
          <Button startIcon={<PictureAsPdfIcon />} onClick={() => handleExport("pdf")}>
            PDF
          </Button>
          <Button startIcon={<TableViewIcon />} onClick={() => handleExport("excel")}>
            Excel
          </Button>
          <Button startIcon={<GridOnIcon />} onClick={() => handleExport("csv")}>
            CSV
          </Button>
          <Button startIcon={<DataObjectIcon />} onClick={() => handleExport("json")}>
            JSON
          </Button>
        </ButtonGroup>
      </Paper>

      {exportView === "pivot" && (
        <PivotTable rows={filtered} config={pivotConfig} onConfigChange={setPivotConfig} />
      )}
    </Box>
  );
}
