import { Box, Paper } from "@mui/material";
import type { ReactNode } from "react";

interface DataGridShellProps {
  children: ReactNode;
  minHeight?: number;
}

/** Contenitore responsive per MUI DataGrid. */
export function DataGridShell({ children, minHeight = 320 }: DataGridShellProps) {
  return (
    <Paper
      variant="outlined"
      sx={{
        width: "100%",
        overflow: "hidden",
        p: { xs: 0.5, sm: 1 },
        "& .MuiDataGrid-root": { border: "none", fontSize: "0.875rem" },
        "& .MuiDataGrid-columnHeaders": {
          fontWeight: 700,
          bgcolor: (t) => (t.palette.mode === "dark" ? "rgba(255,255,255,0.04)" : "rgba(31,41,51,0.04)"),
        },
      }}
    >
      <Box sx={{ width: "100%", minWidth: 0, overflowX: "auto", minHeight }}>
        {children}
      </Box>
    </Paper>
  );
}
