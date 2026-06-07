import { Box } from "@mui/material";
import PrecisionManufacturingIcon from "@mui/icons-material/PrecisionManufacturing";
import { catisColors } from "@/theme/catisTheme";

interface MachineAvatarProps {
  imageUrl?: string;
  alt: string;
  size?: number;
  variant?: "card" | "inline" | "header";
}

export function MachineAvatar({
  imageUrl,
  alt,
  size = 48,
  variant = "inline",
}: MachineAvatarProps) {
  const height =
    variant === "card" ? 130 : variant === "header" ? 120 : size;
  const width = variant === "inline" ? size : "100%";

  if (imageUrl) {
    return (
      <Box
        component="img"
        src={imageUrl}
        alt={alt}
        sx={{
          width,
          height,
          objectFit: "cover",
          display: "block",
          bgcolor: "grey.100",
        }}
      />
    );
  }

  return (
    <Box
      sx={{
        width,
        height,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        bgcolor: "grey.100",
        color: catisColors.green,
      }}
    >
      <PrecisionManufacturingIcon sx={{ fontSize: variant === "inline" ? size * 0.55 : 56 }} />
    </Box>
  );
}
