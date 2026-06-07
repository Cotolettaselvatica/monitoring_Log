import { useState } from "react";
import {
  Card,
  CardActionArea,
  CardContent,
  Typography,
  Box,
  Chip,
  IconButton,
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import SettingsIcon from "@mui/icons-material/Settings";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import LinkIcon from "@mui/icons-material/Link";
import LinkOffIcon from "@mui/icons-material/LinkOff";
import { useNavigate } from "react-router-dom";
import type { Machine } from "@/types";
import { StatusChip } from "@/components/common/StatusChip";
import { MachineAvatar } from "@/components/machines/MachineAvatar";
import { MachineImageEditDialog } from "@/components/machines/MachineImageEditDialog";
import { formatRelative } from "@/utils/format";

interface MachineCardProps {
  machine: Machine;
  onEdit?: () => void;
  onDelete?: () => void;
}

export function MachineCard({ machine, onEdit, onDelete }: MachineCardProps) {
  const navigate = useNavigate();
  const [editOpen, setEditOpen] = useState(false);

  return (
    <>
      <Card
        sx={{
          height: "100%",
          overflow: "hidden",
          borderLeft: 4,
          borderColor:
            machine.status === "online"
              ? "success.main"
              : machine.status === "warning"
                ? "warning.main"
                : machine.status === "error"
                  ? "error.main"
                  : "grey.400",
          transition: "transform 0.15s ease, box-shadow 0.15s ease",
          "&:hover": {
            boxShadow: (t) => t.shadows[6],
          },
        }}
      >
        <Box sx={{ position: "relative" }}>
          <MachineAvatar
            imageUrl={machine.imageUrl}
            alt={machine.code}
            variant="card"
          />
          <Box sx={{ position: "absolute", top: 8, right: 8, display: "flex", gap: 0.5 }}>
            {onEdit && (
              <IconButton
                size="small"
                aria-label="Modifica macchinario"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit();
                }}
                sx={{ bgcolor: "background.paper", boxShadow: 1 }}
              >
                <SettingsIcon fontSize="small" color="primary" />
              </IconButton>
            )}
            <IconButton
              size="small"
              aria-label="Modifica immagine macchinario"
              onClick={(e) => {
                e.stopPropagation();
                setEditOpen(true);
              }}
              sx={{ bgcolor: "background.paper", boxShadow: 1 }}
            >
              <EditIcon fontSize="small" color="primary" />
            </IconButton>
            {onDelete && (
              <IconButton
                size="small"
                aria-label="Elimina macchinario"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
                sx={{ bgcolor: "background.paper", boxShadow: 1 }}
              >
                <DeleteOutlineIcon fontSize="small" color="error" />
              </IconButton>
            )}
          </Box>
        </Box>

        <CardActionArea onClick={() => navigate(`/machines/${machine.id}`)}>
          <CardContent>
            <Box sx={{ display: "flex", justifyContent: "space-between", mb: 1 }}>
              <Typography variant="h5" fontWeight={800} color="primary.main">
                {machine.code}
              </Typography>
              <StatusChip status={machine.status} />
            </Box>
            <Typography variant="subtitle1" fontWeight={600} gutterBottom noWrap title={machine.name}>
              {machine.name}
            </Typography>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              {machine.type} · {machine.location}
            </Typography>
            <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", mt: 1.5 }}>
              <Chip
                size="small"
                icon={machine.interconnected ? <LinkIcon /> : <LinkOffIcon />}
                label={machine.interconnected ? "Interconnesso" : "Non interconnesso"}
                color={machine.interconnected ? "success" : "default"}
                variant="outlined"
              />
              <Chip size="small" label={machine.ipAddress} variant="outlined" />
            </Box>
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: "block" }}>
              Ultimo contatto: {formatRelative(machine.lastSeen)}
            </Typography>
          </CardContent>
        </CardActionArea>
      </Card>

      <MachineImageEditDialog
        open={editOpen}
        onClose={() => setEditOpen(false)}
        machineId={machine.id}
        machineCode={machine.code}
        imageUrl={machine.imageUrl}
      />
    </>
  );
}
