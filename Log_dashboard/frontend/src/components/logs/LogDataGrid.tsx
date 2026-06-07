import { useMemo } from "react";
import { Box, Typography, useMediaQuery, useTheme } from "@mui/material";
import { DataGrid, type GridColDef } from "@mui/x-data-grid";
import type { LogRow } from "@/types";
import { formatDateTime, formatDuration } from "@/utils/format";
import { LevelChip } from "@/components/common/LevelChip";
import { MachineAvatar } from "@/components/machines/MachineAvatar";

function buildColumns(hideMachine: boolean, compact: boolean): GridColDef<LogRow>[] {
  const cols: GridColDef<LogRow>[] = [
    {
      field: "timestamp",
      headerName: "Timestamp",
      minWidth: compact ? 130 : 150,
      width: compact ? 140 : 170,
      flex: compact ? 0 : undefined,
      valueFormatter: (v) => formatDateTime(String(v)),
    },
    {
      field: "machineCode",
      headerName: "Macchinario",
      minWidth: compact ? 160 : 200,
      flex: hideMachine ? 0 : 1,
      width: hideMachine ? 0 : undefined,
      renderCell: ({ row }) => (
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, py: 0.5, width: "100%" }}>
          <Box
            sx={{
              width: { xs: 40, sm: 44 },
              height: { xs: 40, sm: 44 },
              borderRadius: 1,
              overflow: "hidden",
              flexShrink: 0,
              border: 1,
              borderColor: "divider",
            }}
          >
            <MachineAvatar
              imageUrl={row.machineImageUrl}
              alt={row.machineCode}
              size={44}
              variant="inline"
            />
          </Box>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography variant="body2" fontWeight={600} noWrap>
              {row.machineCode}
            </Typography>
            <Typography variant="caption" color="text.secondary" noWrap display="block">
              {row.machineName}
            </Typography>
          </Box>
        </Box>
      ),
    },
    { field: "action", headerName: "Azione", minWidth: 100, width: compact ? 110 : 130 },
    {
      field: "level",
      headerName: "Livello",
      minWidth: 90,
      width: 100,
      renderCell: ({ value }) => <LevelChip level={value} />,
    },
    { field: "message", headerName: "Messaggio", flex: 1, minWidth: compact ? 120 : 180 },
    { field: "user", headerName: "Utente", minWidth: 100, width: 120 },
    {
      field: "durationMs",
      headerName: "Durata",
      minWidth: 80,
      width: 90,
      valueFormatter: (v) => formatDuration(v as number | undefined),
    },
  ];

  return hideMachine ? cols.filter((c) => c.field !== "machineCode") : cols;
}

interface LogDataGridProps {
  rows: LogRow[];
  loading?: boolean;
  height?: number;
  hideMachine?: boolean;
  /** Adatta colonne e scroll su mobile */
  responsive?: boolean;
}

export function LogDataGrid({
  rows,
  loading,
  height = 420,
  hideMachine = false,
  responsive = false,
}: LogDataGridProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const isSmall = useMediaQuery(theme.breakpoints.down("sm"));
  const compact = responsive && isMobile;

  const columns = useMemo(() => buildColumns(hideMachine, compact), [hideMachine, compact]);

  const columnVisibilityModel = useMemo(() => {
    if (!responsive) return undefined;
    return {
      user: !isSmall,
      durationMs: !isMobile,
    };
  }, [responsive, isSmall, isMobile]);

  const gridHeight = responsive
    ? isSmall
      ? Math.min(height, 360)
      : isMobile
        ? Math.min(height, 420)
        : height
    : height;

  return (
    <Box sx={{ width: "100%", minWidth: 0 }}>
      <DataGrid
        rows={rows}
        columns={columns}
        columnVisibilityModel={columnVisibilityModel}
        loading={loading}
        getRowId={(r) => r.id}
        disableRowSelectionOnClick
        pageSizeOptions={[25, 50, 100]}
        initialState={{ pagination: { paginationModel: { pageSize: 25 } } }}
        rowHeight={hideMachine ? 52 : 60}
        localeText={{ noRowsLabel: "Nessun log trovato" }}
        sx={{
          height: gridHeight,
          width: "100%",
          minWidth: responsive ? 320 : undefined,
          border: 0,
          "& .MuiDataGrid-columnHeaders": { fontSize: { xs: "0.75rem", sm: "0.875rem" } },
          "& .MuiDataGrid-cell": { fontSize: { xs: "0.75rem", sm: "0.875rem" } },
        }}
        autoHeight={false}
      />
    </Box>
  );
}
