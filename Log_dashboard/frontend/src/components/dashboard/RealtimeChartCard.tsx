import { Card, CardContent, Box, ButtonGroup, Button } from "@mui/material";
import GridOnIcon from "@mui/icons-material/GridOn";
import TableViewIcon from "@mui/icons-material/TableView";
import DataObjectIcon from "@mui/icons-material/DataObject";
import type { LogEntry } from "@/types";
import { RealtimeEventsChart } from "@/components/charts/RealtimeEventsChart";
import { exportChartSeries } from "@/utils/exportAggregate";
import { aggregateRecentMinutes } from "@/utils/realtimeAggregation";
import { useSettings } from "@/context/SettingsContext";

interface RealtimeChartCardProps {
  logs: LogEntry[];
  lastUpdatedAt?: number;
  /** Suffisso export, es. codice macchinario CTS-001 */
  exportSlug?: string;
}

export function RealtimeChartCard({
  logs,
  lastUpdatedAt,
  exportSlug = "flotta",
}: RealtimeChartCardProps) {
  const { settings } = useSettings();
  const points = aggregateRecentMinutes(logs, 60, 5);
  const slug = `realtime-${exportSlug}`;

  return (
    <Card sx={{ height: "100%" }}>
      <CardContent sx={{ "&:last-child": { pb: 2 } }}>
        <Box
          sx={{
            display: "flex",
            flexDirection: { xs: "column", sm: "row" },
            justifyContent: "flex-end",
            gap: 1,
            mb: 1,
          }}
        >
          <ButtonGroup size="small" variant="outlined" sx={{ flexWrap: "wrap" }}>
            <Button startIcon={<GridOnIcon />} onClick={() => exportChartSeries("csv", points, "hour", slug)}>
              CSV
            </Button>
            <Button startIcon={<TableViewIcon />} onClick={() => exportChartSeries("excel", points, "hour", slug)}>
              Excel
            </Button>
            <Button startIcon={<DataObjectIcon />} onClick={() => exportChartSeries("json", points, "hour", slug)}>
              JSON
            </Button>
          </ButtonGroup>
        </Box>
        <RealtimeEventsChart
          logs={logs}
          lastUpdatedAt={lastUpdatedAt}
          pollingSec={settings.pollingIntervalSec}
          height={240}
        />
      </CardContent>
    </Card>
  );
}
