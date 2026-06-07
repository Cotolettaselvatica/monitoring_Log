import { useMemo } from "react";
import { Box, Grid, Alert } from "@mui/material";
import HistoryIcon from "@mui/icons-material/History";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import dayjs from "dayjs";
import type { LogEntry, Machine, MachineMetrics } from "@/types";
import { useMachineChartSeries } from "@/hooks/useChartSeries";
import { KpiCard } from "@/components/common/KpiCard";
import { MetricsGrid } from "@/components/common/MetricsGrid";
import { ChartCardWithExport } from "@/components/charts/ChartCardWithExport";
import { RealtimeChartCard } from "@/components/dashboard/RealtimeChartCard";
import { ReliabilityMetricsRow } from "@/components/metrics/ReliabilityMetricsRow";
import { enrichLogsForMachine } from "@/utils/logRows";
import { LogDataGrid } from "@/components/logs/LogDataGrid";
import { DataGridShell } from "@/components/common/DataGridShell";
import { SectionTitle } from "@/components/layout/SectionTitle";
import { catisColors } from "@/theme/catisTheme";

const RECENT_LOGS = 30;

interface MachineAnalyticsPanelProps {
  machine: Machine;
  logs: LogEntry[];
  logsLoading?: boolean;
  logsUpdatedAt?: number;
  metrics?: MachineMetrics;
}

export function MachineAnalyticsPanel({
  machine,
  logs,
  logsLoading,
  logsUpdatedAt,
  metrics,
}: MachineAnalyticsPanelProps) {
  const exportSlug = machine.code.toLowerCase();
  const hourly = useMachineChartSeries(machine.id, "hour");
  const daily = useMachineChartSeries(machine.id, "day");
  const weekly = useMachineChartSeries(machine.id, "week");
  const monthly = useMachineChartSeries(machine.id, "month");
  const yearly = useMachineChartSeries(machine.id, "year");

  const kpis = useMemo(() => {
    const last24h = logs.filter((l) =>
      dayjs(l.timestamp).isAfter(dayjs().subtract(24, "hour")),
    );
    return {
      events24h: last24h.length,
      errors: logs.filter((l) => l.level === "error").length,
      warnings: logs.filter((l) => l.level === "warning").length,
      info: logs.filter((l) => l.level === "info").length,
      total: logs.length,
    };
  }, [logs]);

  const logRows = useMemo(
    () => enrichLogsForMachine(logs.slice(0, RECENT_LOGS), machine),
    [logs, machine],
  );

  return (
    <Box sx={{ width: "100%", minWidth: 0 }}>
      <SectionTitle
        title="Analitiche macchinario"
        subtitle={`Stesso dettaglio della dashboard globale, filtrato su ${machine.code}`}
      />

      <MetricsGrid>
        <KpiCard
          title="Eventi (24h)"
          value={kpis.events24h}
          icon={<HistoryIcon fontSize="large" />}
          color={catisColors.red}
        />
        <KpiCard
          title="Errori"
          value={kpis.errors}
          subtitle={`su ${kpis.total} eventi`}
          icon={<ErrorOutlineIcon fontSize="large" />}
          color={catisColors.red}
        />
        <KpiCard
          title="Avvisi"
          value={kpis.warnings}
          icon={<WarningAmberIcon fontSize="large" />}
          color="#F5A623"
        />
        <KpiCard
          title="Info"
          value={kpis.info}
          icon={<InfoOutlinedIcon fontSize="large" />}
          color={catisColors.green}
        />
      </MetricsGrid>

      {metrics && <ReliabilityMetricsRow metrics={metrics} />}

      <Grid container spacing={{ xs: 1.5, sm: 2 }} sx={{ mb: { xs: 2, sm: 3 } }}>
        <Grid item xs={12}>
          <RealtimeChartCard
            logs={logs}
            lastUpdatedAt={logsUpdatedAt}
            exportSlug={exportSlug}
          />
        </Grid>
        <Grid item xs={12}>
          {hourly.data && (
            <ChartCardWithExport
              title="Eventi interconnessione (orario)"
              subtitle={`${machine.code} — ultime 24 ore`}
              points={hourly.data}
              period="hour"
              exportSlug={`orario-${exportSlug}`}
              height={240}
            />
          )}
        </Grid>
      </Grid>

      <SectionTitle
        title="Andamento eventi"
        subtitle="Serie storiche per questo macchinario (API o aggregazione log)"
      />

      <Grid container spacing={{ xs: 1.5, sm: 2 }} sx={{ mb: { xs: 2, sm: 3 } }}>
        {daily.data && (
          <Grid item xs={12} md={6}>
            <ChartCardWithExport
              title="Giornaliero"
              subtitle="Ultimi 7 giorni"
              points={daily.data}
              period="day"
              exportSlug={`giornaliero-${exportSlug}`}
            />
          </Grid>
        )}
        {weekly.data && (
          <Grid item xs={12} md={6}>
            <ChartCardWithExport
              title="Settimanale"
              subtitle="Ultime 8 settimane"
              points={weekly.data}
              period="week"
              exportSlug={`settimanale-${exportSlug}`}
              color={catisColors.red}
            />
          </Grid>
        )}
        {monthly.data && (
          <Grid item xs={12} md={6}>
            <ChartCardWithExport
              title="Mensile"
              subtitle="Ultimi 12 mesi"
              points={monthly.data}
              period="month"
              exportSlug={`mensile-${exportSlug}`}
            />
          </Grid>
        )}
        {yearly.data && (
          <Grid item xs={12} md={6}>
            <ChartCardWithExport
              title="Annuale"
              subtitle="Ultimi 5 anni"
              points={yearly.data}
              period="year"
              exportSlug={`annuale-${exportSlug}`}
              color={catisColors.red}
            />
          </Grid>
        )}
      </Grid>

      {!hourly.data && !daily.data && logs.length === 0 && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Nessun evento registrato per questo macchinario nel periodo disponibile.
        </Alert>
      )}

      <SectionTitle
        title="Ultimi eventi"
        subtitle={`${Math.min(RECENT_LOGS, logs.length)} di ${logs.length} eventi — vedi tab Log per l'elenco completo`}
      />
      <DataGridShell minHeight={360}>
        <LogDataGrid rows={logRows} loading={logsLoading} height={400} hideMachine responsive />
      </DataGridShell>
    </Box>
  );
}
