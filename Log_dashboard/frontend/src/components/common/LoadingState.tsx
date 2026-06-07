import { Box, CircularProgress, Typography } from "@mui/material";

export function LoadingState({ label = "Caricamento..." }: { label?: string }) {
  return (
    <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", py: 6, gap: 2 }}>
      <CircularProgress color="primary" />
      <Typography color="text.secondary">{label}</Typography>
    </Box>
  );
}
