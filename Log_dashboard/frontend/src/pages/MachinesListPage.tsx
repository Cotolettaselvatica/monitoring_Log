import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Box, Typography, Card, CardContent, Chip, useTheme, useMediaQuery } from "@mui/material";
import { DataGrid, type GridColDef } from "@mui/x-data-grid";
import { useMachines } from "@/hooks/useData";
import { FilterBar } from "@/components/filters/FilterBar";
import { defaultPageFilters, filterMachines, type PageFilterState } from "@/utils/filters";
import { StatusChip } from "@/components/common/StatusChip";
import { MachineAvatar } from "@/components/machines/MachineAvatar";
import { LoadingState } from "@/components/common/LoadingState";
import { DataGridShell } from "@/components/common/DataGridShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { ThirdPartyTelemetryPanel } from "@/components/machines/ThirdPartyTelemetryPanel";
import { formatRelative } from "@/utils/format";
import type { Machine } from "@/types";

export default function MachinesListPage() {
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const isTablet = useMediaQuery(theme.breakpoints.down("md"));
  const { data: machines = [], isLoading } = useMachines();
  const [filters, setFilters] = useState<PageFilterState>(defaultPageFilters);

  const filtered = useMemo(() => filterMachines(machines, filters), [machines, filters]);

  const grouped = useMemo(() => {
    const map = new Map<string, Machine[]>();
    filtered.forEach((m) => {
      const key = `${m.department ?? "—"} / ${m.line ?? "—"}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(m);
    });
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  const columns: GridColDef<Machine>[] = [
    {
      field: "imageUrl",
      headerName: "",
      width: 56,
      sortable: false,
      renderCell: ({ row }) => (
        <Box sx={{ width: 40, height: 40, borderRadius: 1, overflow: "hidden" }}>
          <MachineAvatar imageUrl={row.imageUrl} alt={row.code} size={40} />
        </Box>
      ),
    },
    { field: "code", headerName: "Codice", minWidth: 90, width: 100 },
    { field: "name", headerName: "Nome", flex: 1, minWidth: 140 },
    {
      field: "status",
      headerName: "Stato",
      width: 110,
      renderCell: ({ value }) => <StatusChip status={value} />,
    },
    { field: "department", headerName: "Reparto", width: 120 },
    { field: "line", headerName: "Linea", width: 100 },
    { field: "location", headerName: "Sede", minWidth: 140, flex: isMobile ? 0 : 1 },
    { field: "ipAddress", headerName: "IP", width: 120 },
    {
      field: "interconnected",
      headerName: "Interconn.",
      width: 100,
      valueFormatter: (v) => (v ? "Sì" : "No"),
    },
    {
      field: "lastSeen",
      headerName: "Ultimo contatto",
      width: 130,
      valueFormatter: (v) => formatRelative(String(v)),
    },
  ];

  const columnVisibilityModel = {
    department: !isTablet,
    line: !isMobile,
    location: !isMobile,
    ipAddress: !isMobile,
    interconnected: !isMobile,
    lastSeen: !isTablet,
  };

  if (isLoading) return <LoadingState />;

  return (
    <>
      <PageHeader
        title="Elenco macchinari"
        subtitle="Vista tabellare per reparto e linea produttiva"
      />
      <FilterBar
        filters={filters}
        onChange={setFilters}
        machines={machines}
        fields={["machine", "department", "line", "status", "search"]}
      />
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {filtered.length} macchinari — raggruppati per reparto / linea
      </Typography>
      {grouped.map(([group, items]) => (
        <Card key={group} variant="outlined" sx={{ mb: 2 }}>
          <CardContent sx={{ p: { xs: 1, sm: 2 }, "&:last-child": { pb: { xs: 1, sm: 2 } } }}>
            <Chip label={group} size="small" color="primary" variant="outlined" sx={{ mb: 1.5 }} />
            <DataGridShell minHeight={Math.min(360, 56 + items.length * 52)}>
              <DataGrid
                rows={items}
                columns={columns}
                columnVisibilityModel={columnVisibilityModel}
                getRowId={(r) => r.id}
                onRowClick={(p) => navigate(`/machines/${p.row.id}`)}
                hideFooter={items.length <= 10}
                pageSizeOptions={[10, 25]}
                initialState={{ pagination: { paginationModel: { pageSize: 10 } } }}
                rowHeight={52}
                sx={{ border: 0, cursor: "pointer", minWidth: isMobile ? 480 : "100%" }}
                autoHeight={items.length <= 8}
              />
            </DataGridShell>
          </CardContent>
        </Card>
      ))}

      <ThirdPartyTelemetryPanel />
    </>
  );
}
