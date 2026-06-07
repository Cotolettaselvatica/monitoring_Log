import { Box, Card, CardContent, LinearProgress, Typography } from "@mui/material";
import { catisColors } from "@/theme/catisTheme";

interface AvailabilityGaugeProps {
  value: number;
  label?: string;
}

function uptimeColor(value: number): string {
  if (value >= 95) return catisColors.green;
  if (value >= 80) return "#F5A623";
  return catisColors.red;
}

export function AvailabilityGauge({ value, label = "Uptime" }: AvailabilityGaugeProps) {
  const accent = uptimeColor(value);
  const clamped = Math.min(100, Math.max(0, value));

  return (
    <Card
      sx={{
        height: "100%",
        minHeight: { xs: 132, sm: 148 },
        borderTop: 3,
        borderTopColor: accent,
        transition: "box-shadow 0.2s ease",
        "&:hover": { boxShadow: (t) => t.shadows[4] },
      }}
    >
      <CardContent
        sx={{
          py: { xs: 2, sm: 2.5 },
          px: { xs: 2, sm: 2.5 },
          "&:last-child": { pb: { xs: 2, sm: 2.5 } },
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          minHeight: { xs: 116, sm: 124 },
        }}
      >
        <Typography
          variant="overline"
          color="text.secondary"
          sx={{ lineHeight: 1.4, mb: 0.75, fontWeight: 600, letterSpacing: 0.6 }}
        >
          {label}
        </Typography>
        <Typography
          component="p"
          sx={{
            color: accent,
            fontWeight: 800,
            fontSize: { xs: "2rem", sm: "2.25rem" },
            lineHeight: 1.1,
            m: 0,
          }}
        >
          {clamped.toFixed(1)}%
        </Typography>
        <Box sx={{ mt: 1.5, width: "100%" }}>
          <LinearProgress
            variant="determinate"
            value={clamped}
            aria-label={`${label} ${clamped.toFixed(1)}%`}
            sx={{
              height: 10,
              borderRadius: 5,
              bgcolor: "grey.200",
              "& .MuiLinearProgress-bar": {
                borderRadius: 5,
                bgcolor: accent,
              },
            }}
          />
        </Box>
      </CardContent>
    </Card>
  );
}
