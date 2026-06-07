import { useMemo, useState } from "react";
import { DataGrid, type GridColDef } from "@mui/x-data-grid";
import { useTheme, useMediaQuery } from "@mui/material";
import { useAuditLog } from "@/hooks/useData";
import { FilterBar } from "@/components/filters/FilterBar";
import { defaultPageFilters, filterAudit, type PageFilterState } from "@/utils/filters";
import { LoadingState } from "@/components/common/LoadingState";
import { DataGridShell } from "@/components/common/DataGridShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { formatDateTime } from "@/utils/format";
import type { AuditEntry } from "@/types";

export default function AuditPage() {
  const theme = useTheme();
  const isTablet = useMediaQuery(theme.breakpoints.down("lg"));
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const { data: entries = [], isLoading } = useAuditLog();
  const [filters, setFilters] = useState<PageFilterState>(defaultPageFilters);

  const filtered = useMemo(() => filterAudit(entries, filters), [entries, filters]);

  const columns: GridColDef<AuditEntry>[] = [
    {
      field: "timestamp",
      headerName: "Timestamp",
      minWidth: 150,
      width: isMobile ? 150 : 170,
      valueFormatter: (v) => formatDateTime(String(v)),
    },
    { field: "operator", headerName: "Operatore", width: 120 },
    {
      field: "action",
      headerName: "Azione",
      minWidth: 140,
      flex: isMobile ? 1 : undefined,
      width: isMobile ? undefined : 160,
    },
    { field: "entityType", headerName: "Entità", width: 100 },
    { field: "entityId", headerName: "ID", width: 90 },
    { field: "details", headerName: "Dettagli", flex: 1, minWidth: 160 },
  ];

  const columnVisibilityModel = {
    operator: !isTablet,
    entityType: !isMobile,
    entityId: !isMobile,
  };

  if (isLoading) return <LoadingState />;

  return (
    <>
      <PageHeader
        title="Audit trail"
        subtitle="Tracciamento azioni e modifiche sulla piattaforma"
      />
      <FilterBar filters={filters} onChange={setFilters} fields={["dates", "search"]} />
      <DataGridShell minHeight={400}>
        <DataGrid
          rows={filtered}
          columns={columns}
          columnVisibilityModel={columnVisibilityModel}
          getRowId={(r) => r.id}
          loading={isLoading}
          pageSizeOptions={[25, 50]}
          initialState={{ pagination: { paginationModel: { pageSize: 25 } } }}
          sx={{ minHeight: 400, border: 0, width: "100%" }}
          autoHeight={filtered.length <= 15}
        />
      </DataGridShell>
    </>
  );
}
