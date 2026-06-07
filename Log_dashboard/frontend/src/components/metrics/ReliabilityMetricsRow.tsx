import { AvailabilityGauge } from "@/components/charts/AvailabilityGauge";
import { KpiCard } from "@/components/common/KpiCard";
import { MetricsGrid } from "@/components/common/MetricsGrid";
import { catisColors } from "@/theme/palette";
import type { ReliabilityMetricsBase } from "@/types";

interface ReliabilityMetricsRowProps {
  metrics: ReliabilityMetricsBase;
}

/** Uptime, downtime, MTBF e MTTR (flotta o singolo macchinario). */
export function ReliabilityMetricsRow({ metrics }: ReliabilityMetricsRowProps) {
  return (
    <MetricsGrid>
      <AvailabilityGauge value={metrics.uptimePct} />
      <KpiCard title="Downtime" value={`${metrics.downtimeMinutes} min`} color={catisColors.ink} />
      <KpiCard
        title="MTBF"
        unavailable={metrics.mtbfHours == null}
        value={metrics.mtbfHours != null ? `${metrics.mtbfHours} h` : undefined}
        color={catisColors.green}
      />
      <KpiCard
        title="MTTR"
        unavailable={metrics.mttrMinutes == null}
        value={metrics.mttrMinutes != null ? `${metrics.mttrMinutes} min` : undefined}
        color="#F5A623"
      />
    </MetricsGrid>
  );
}
