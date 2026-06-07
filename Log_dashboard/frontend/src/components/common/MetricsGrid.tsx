import { Box } from "@mui/material";
import type { ReactNode } from "react";

/** Griglia metriche: almeno ~220px per card, evita colonne illeggibili su viewport stretti. */
export function MetricsGrid({ children }: { children: ReactNode }) {
  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 220px), 1fr))",
        gap: { xs: 1.5, sm: 2 },
        mb: { xs: 2, sm: 3 },
      }}
    >
      {children}
    </Box>
  );
}
