import { Alert } from "@mui/material";
import { API_WRITE_MESSAGE } from "@/services/apiClient";

export function RequiresApiAlert() {
  return (
    <Alert severity="info">
      {API_WRITE_MESSAGE}
    </Alert>
  );
}
