import { useRef, useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Alert,
  Stack,
} from "@mui/material";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import DeleteIcon from "@mui/icons-material/Delete";
import { useUploadMachineImage, useDeleteMachineImage } from "@/hooks/useData";
import { MachineAvatar } from "./MachineAvatar";
import { IMAGE_ACCEPT, MAX_IMAGE_SIZE_MB } from "@/utils/machineImageValidation";

interface MachineImageEditDialogProps {
  open: boolean;
  onClose: () => void;
  machineId: string;
  machineCode: string;
  imageUrl?: string;
}

export function MachineImageEditDialog({
  open,
  onClose,
  machineId,
  machineCode,
  imageUrl,
}: MachineImageEditDialogProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const upload = useUploadMachineImage(machineId);
  const remove = useDeleteMachineImage(machineId);

  const displayUrl = preview ?? imageUrl;

  const handleClose = () => {
    setPreview(null);
    setError(null);
    onClose();
  };

  const handleFile = (file: File | undefined) => {
    setError(null);
    if (!file) return;
    setPreview(URL.createObjectURL(file));
    upload.mutate(file, {
      onSuccess: () => {
        setPreview(null);
        handleClose();
      },
      onError: (e) => {
        setPreview(null);
        setError(e instanceof Error ? e.message : "Errore durante il caricamento.");
      },
    });
  };

  const handleDelete = () => {
    setError(null);
    remove.mutate(undefined, {
      onSuccess: () => handleClose(),
      onError: (e) =>
        setError(e instanceof Error ? e.message : "Errore durante la rimozione."),
    });
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth>
      <DialogTitle>Modifica immagine — {machineCode}</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Seleziona un&apos;immagine dal dispositivo. Verrà mostrata sulla card e nel dettaglio
          macchinario.
        </Typography>
        <Box
          sx={{
            borderRadius: 1,
            overflow: "hidden",
            border: 1,
            borderColor: "divider",
            mb: 2,
          }}
        >
          <MachineAvatar imageUrl={displayUrl} alt={machineCode} variant="card" />
        </Box>
        <input
          ref={inputRef}
          type="file"
          accept={IMAGE_ACCEPT}
          hidden
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        <Stack direction="row" spacing={1} flexWrap="wrap">
          <Button
            variant="contained"
            startIcon={<CloudUploadIcon />}
            onClick={() => inputRef.current?.click()}
            disabled={upload.isPending}
          >
            {upload.isPending ? "Caricamento..." : "Scegli immagine"}
          </Button>
          {imageUrl && (
            <Button
              variant="outlined"
              color="error"
              startIcon={<DeleteIcon />}
              onClick={handleDelete}
              disabled={remove.isPending}
            >
              Rimuovi
            </Button>
          )}
        </Stack>
        <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
          Max {MAX_IMAGE_SIZE_MB} MB — JPEG, PNG, WebP, GIF
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>Chiudi</Button>
      </DialogActions>
    </Dialog>
  );
}
