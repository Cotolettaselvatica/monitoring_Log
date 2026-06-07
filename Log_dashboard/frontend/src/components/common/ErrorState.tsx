import { Alert } from "@mui/material";

export function ErrorState({ message = "Errore nel caricamento dei dati." }: { message?: string }) {
  return <Alert severity="error">{message}</Alert>;
}
