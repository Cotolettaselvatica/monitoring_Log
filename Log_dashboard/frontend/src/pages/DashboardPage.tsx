import { useMemo, useState } from "react";
import { Grid, Alert } from "@mui/material";
import PrecisionManufacturingIcon from "@mui/icons-material/PrecisionManufacturing";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import WarningIcon from "@mui/icons-material/Warning";
import HistoryIcon from "@mui/icons-material/History";
import dayjs from "dayjs";
import { useMachines, useLogs, useFleetMetrics } from "@/hooks/useData";
import { useChartSeries } from "@/hooks/useChartSeries";
import { defaultPageFilters, type PageFilterState } from "@/utils/filters";
import { KpiCard } from "@/components/common/KpiCard";
import { MetricsGrid } from "@/components/common/MetricsGrid";
import { DashboardMachinesPanel } from "@/components/dashboard/DashboardMachinesPanel";
import { StatusDonut } from "@/components/charts/StatusDonut";
import { ChartCardWithExport } from "@/components/charts/ChartCardWithExport";
import { ReliabilityMetricsRow } from "@/components/metrics/ReliabilityMetricsRow";
import { RealtimeChartCard } from "@/components/dashboard/RealtimeChartCard";
import { DashboardRecentLogs } from "@/components/dashboard/DashboardRecentLogs";
import { LoadingState } from "@/components/common/LoadingState";
import { PageHeader } from "@/components/layout/PageHeader";
import { SectionTitle } from "@/components/layout/SectionTitle";
import { catisColors } from "@/theme/catisTheme";
import type { MachineStatus } from "@/types";

export default function DashboardPage() {
  const { data: machines = [], isLoading, isError } = useMachines();
  const { data: logs = [], dataUpdatedAt: logsUpdatedAt } = useLogs();
  const { data: fleetMetrics } = useFleetMetrics(7);
  const hourly = useChartSeries("hour");
  const daily = useChartSeries("day");
  const weekly = useChartSeries("week");
  const monthly = useChartSeries("month");
  const yearly = useChartSeries("year");
  const [filters, setFilters] = useState<PageFilterState>(defaultPageFilters);

  const kpis = useMemo(() => ({
    total: machines.length,
    online: machines.filter((m) => m.status === "online").length,
    offline: machines.filter((m) => m.status === "offline").length,
    warning: machines.filter((m) => m.status === "warning" || m.status === "error").length,
    events24h: logs.filter((l) => dayjs(l.timestamp).isAfter(dayjs().subtract(24, "hour"))).length,
  }), [machines, logs]);

  const statusData = useMemo(() => {
    const counts: Record<MachineStatus, number> = { online: 0, offline: 0, warning: 0, error: 0 };
    machines.forEach((m) => { counts[m.status] += 1; });
    return (Object.entries(counts) as [MachineStatus, number][])
      .filter(([, c]) => c > 0)
      .map(([status, count]) => ({ status, count }));
  }, [machines]);

  if (isLoading) return <LoadingState />;
  if (isError) return <Alert severity="error">Errore nel caricamento dei macchinari</Alert>;

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle="Panoramica operativa su stato, interconnessione e andamento eventi della flotta macchinari"
      />

      <MetricsGrid>
        <KpiCard title="Macchinari totali" value={kpis.total} icon={<PrecisionManufacturingIcon fontSize="large" />} color={catisColors.red} />
        <KpiCard title="Online" value={kpis.online} subtitle={`${kpis.offline} offline`} icon={<CheckCircleIcon fontSize="large" />} color={catisColors.green} />
        <KpiCard title="Attenzione / Errore" value={kpis.warning} icon={<WarningIcon fontSize="large" />} color="#F5A623" />
        <KpiCard title="Eventi (24h)" value={kpis.events24h} icon={<HistoryIcon fontSize="large" />} color={catisColors.ink} />
      </MetricsGrid>

      {fleetMetrics && <ReliabilityMetricsRow metrics={fleetMetrics} />}

      <Grid container spacing={{ xs: 1.5, sm: 2 }} sx={{ mb: { xs: 2, sm: 3 } }}>
        <Grid item xs={12}>
          <RealtimeChartCard logs={logs} lastUpdatedAt={logsUpdatedAt} />
        </Grid>
      </Grid>

      <Grid container spacing={{ xs: 1.5, sm: 2 }} sx={{ mb: { xs: 2, sm: 3 } }}>
        <Grid item xs={12} lg={5}>
          <StatusDonut data={statusData} />
        </Grid>
        <Grid item xs={12} lg={7}>
          {hourly.data && (
            <ChartCardWithExport
              title="Eventi interconnessione (orario)"
              subtitle="Ultime 24 ore — aggregato per ora"
              points={hourly.data}
              period="hour"
              exportSlug="orario"
              height={240}
            />
          )}
        </Grid>
      </Grid>

      <SectionTitle
        title="Andamento eventi interconnessione"
        subtitle="Serie storiche da API con fallback su aggregazione log in ambiente demo"
      />

      <Grid container spacing={{ xs: 1.5, sm: 2 }} sx={{ mb: { xs: 2, sm: 3 } }}>
        {daily.data && (
          <Grid item xs={12} md={6}>
            <ChartCardWithExport title="Giornaliero" subtitle="Ultimi 7 giorni" points={daily.data} period="day" exportSlug="giornaliero" />
          </Grid>
        )}
        {weekly.data && (
          <Grid item xs={12} md={6}>
            <ChartCardWithExport title="Settimanale" subtitle="Ultime 8 settimane" points={weekly.data} period="week" exportSlug="settimanale" color={catisColors.red} />
          </Grid>
        )}
        {monthly.data && (
          <Grid item xs={12} md={6}>
            <ChartCardWithExport title="Mensile" subtitle="Ultimi 12 mesi" points={monthly.data} period="month" exportSlug="mensile" />
          </Grid>
        )}
        {yearly.data && (
          <Grid item xs={12} md={6}>
            <ChartCardWithExport title="Annuale" subtitle="Ultimi 5 anni" points={yearly.data} period="year" exportSlug="annuale" color={catisColors.red} />
          </Grid>
        )}
      </Grid>

      <DashboardRecentLogs />

      <DashboardMachinesPanel machines={machines} filters={filters} onFiltersChange={setFilters} />
    </>
  );
}
