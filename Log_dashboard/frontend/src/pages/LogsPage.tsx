import { useMemo, useState } from "react";
import { Box, Typography, Paper, ToggleButton, ToggleButtonGroup } from "@mui/material";
import TableChartIcon from "@mui/icons-material/TableChart";
import PivotTableChartIcon from "@mui/icons-material/PivotTableChart";
import { useMachines, useLogRows } from "@/hooks/useData";
import { FilterBar } from "@/components/filters/FilterBar";
import { LogDataGrid } from "@/components/logs/LogDataGrid";
import { PivotTable } from "@/components/pivot/PivotTable";
import { DataGridShell } from "@/components/common/DataGridShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { defaultPageFilters, filterLogRows, uniqueActions, type PageFilterState } from "@/utils/filters";
import { PIVOT_PRESETS, type PivotConfig } from "@/utils/pivot";

export default function LogsPage() {
  const [filters, setFilters] = useState<PageFilterState>(defaultPageFilters);
  const [view, setView] = useState<"standard" | "pivot">("standard");
  const [pivotConfig, setPivotConfig] = useState<PivotConfig>(PIVOT_PRESETS[0].config);

  const { data: machines = [] } = useMachines();
  const { rows: allRows, isLoading } = useLogRows();

  const filtered = useMemo(
    () => filterLogRows(allRows, filters),
    [allRows, filters],
  );

  const actions = useMemo(() => uniqueActions(allRows), [allRows]);

  return (
    <>
      <PageHeader
        title="Log interconnessione"
        subtitle="Consultazione avanzata con filtri, conteggi pezzi, ping di rete e analisi pivot"
      />

      <FilterBar
        filters={filters}
        onChange={setFilters}
        machines={machines}
        actions={actions}
        fields={["dates", "machine", "department", "line", "level", "action", "search"]}
      />

      <Box
        sx={{
          display: "flex",
          flexDirection: { xs: "column", sm: "row" },
          justifyContent: "space-between",
          alignItems: { xs: "stretch", sm: "center" },
          gap: 1,
          mb: 2,
        }}
      >
        <Typography variant="body2" color="text.secondary">
          {filtered.length} eventi trovati
        </Typography>
        <ToggleButtonGroup
          size="small"
          value={view}
          exclusive
          onChange={(_, v) => v && setView(v)}
          sx={{ flexWrap: "wrap" }}
        >
          <ToggleButton value="standard">
            <TableChartIcon sx={{ mr: 0.5 }} fontSize="small" />
            Standard
          </ToggleButton>
          <ToggleButton value="pivot">
            <PivotTableChartIcon sx={{ mr: 0.5 }} fontSize="small" />
            Pivot
          </ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {view === "standard" ? (
        <DataGridShell minHeight={480}>
          <LogDataGrid rows={filtered} loading={isLoading} height={520} responsive />
        </DataGridShell>
      ) : (
        <Paper variant="outlined" sx={{ p: { xs: 1, sm: 2 }, overflow: "auto" }}>
          <PivotTable rows={filtered} config={pivotConfig} onConfigChange={setPivotConfig} />
        </Paper>
      )}
    </>
  );
}
