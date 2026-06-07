import { useState } from "react";
import { Box, Button, Typography } from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import { MachineAvatar } from "./MachineAvatar";
import { MachineImageEditDialog } from "./MachineImageEditDialog";

interface MachineImageUploadProps {
  machineId: string;
  machineCode: string;
  imageUrl?: string;
}

/** Sezione upload nel dettaglio macchinario — riusa il dialog di modifica immagine. */
export function MachineImageUpload({
  machineId,
  machineCode,
  imageUrl,
}: MachineImageUploadProps) {
  const [open, setOpen] = useState(false);

  return (
    <Box>
      <Typography variant="subtitle2" fontWeight={600} gutterBottom>
        Immagine macchinario
      </Typography>
      <Box sx={{ display: "flex", alignItems: "flex-start", gap: 2, flexWrap: "wrap" }}>
        <Box
          sx={{
            width: 160,
            borderRadius: 1,
            overflow: "hidden",
            border: 1,
            borderColor: "divider",
          }}
        >
          <MachineAvatar imageUrl={imageUrl} alt={machineCode} variant="header" />
        </Box>
        <Button
          variant="contained"
          size="small"
          startIcon={<EditIcon />}
          onClick={() => setOpen(true)}
        >
          Modifica immagine
        </Button>
      </Box>
      <MachineImageEditDialog
        open={open}
        onClose={() => setOpen(false)}
        machineId={machineId}
        machineCode={machineCode}
        imageUrl={imageUrl}
      />
    </Box>
  );
}
