import { Box, Typography } from "@mui/material";

export function EmptyState({ message = "Nessun dato disponibile." }: { message?: string }) {
  return (
    <Box sx={{ py: 4, textAlign: "center" }}>
      <Typography color="text.secondary">{message}</Typography>
    </Box>
  );
}
