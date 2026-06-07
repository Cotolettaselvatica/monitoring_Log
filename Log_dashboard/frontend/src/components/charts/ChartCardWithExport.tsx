import { Card, CardContent, Box, ButtonGroup, Button } from "@mui/material";
import GridOnIcon from "@mui/icons-material/GridOn";
import TableViewIcon from "@mui/icons-material/TableView";
import DataObjectIcon from "@mui/icons-material/DataObject";
import type { AggregatePoint } from "@/utils/logAggregation";
import type { ChartPeriod } from "@/types";
import { EventsAggregateChart } from "./EventsAggregateChart";
import { exportChartSeries } from "@/utils/exportAggregate";

interface ChartCardWithExportProps {
  title: string;
  subtitle?: string;
  points: AggregatePoint[];
  period: ChartPeriod;
  exportSlug: string;
  height?: number;
  color?: string;
}

export function ChartCardWithExport({
  title,
  subtitle,
  points,
  period,
  exportSlug,
  height,
  color,
}: ChartCardWithExportProps) {
  return (
    <Card sx={{ height: "100%" }}>
      <CardContent sx={{ "&:last-child": { pb: 2 } }}>
        <Box
          sx={{
            display: "flex",
            flexDirection: { xs: "column", sm: "row" },
            justifyContent: "flex-end",
            alignItems: { xs: "stretch", sm: "center" },
            gap: 1,
            mb: 1,
          }}
        >
          <ButtonGroup
            size="small"
            variant="outlined"
            sx={{
              flexWrap: "wrap",
              "& .MuiButton-root": { flex: { xs: "1 1 30%", sm: "0 0 auto" } },
            }}
          >
            <Button startIcon={<GridOnIcon />} onClick={() => exportChartSeries("csv", points, period, exportSlug)}>
              CSV
            </Button>
            <Button startIcon={<TableViewIcon />} onClick={() => exportChartSeries("excel", points, period, exportSlug)}>
              Excel
            </Button>
            <Button startIcon={<DataObjectIcon />} onClick={() => exportChartSeries("json", points, period, exportSlug)}>
              JSON
            </Button>
          </ButtonGroup>
        </Box>
        <EventsAggregateChart
          title={title}
          subtitle={subtitle}
          points={points}
          unit={period}
          height={height}
          color={color}
        />
      </CardContent>
    </Card>
  );
}
