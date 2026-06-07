import { TableContainer, Paper, type PaperProps } from "@mui/material";
import type { ReactNode } from "react";

interface ScrollableTableProps {
  children: ReactNode;
  elevation?: number;
  sx?: PaperProps["sx"];
}

/** Tabella con scroll orizzontale su mobile/tablet. */
export function ScrollableTable({ children, elevation = 0, sx }: ScrollableTableProps) {
  return (
    <Paper variant="outlined" elevation={elevation} sx={{ width: "100%", overflow: "hidden", ...sx }}>
      <TableContainer sx={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
        {children}
      </TableContainer>
    </Paper>
  );
}
