import { Card, CardContent, Typography, Box } from "@mui/material";
import type { ReactNode } from "react";

interface KpiCardProps {
  title: string;
  value?: string | number;
  subtitle?: string;
  icon?: ReactNode;
  color?: string;
  unavailable?: boolean;
}

const UNAVAILABLE_LABEL = "Dato non disponibile";
const UNAVAILABLE_SHORT = "N/D";

export function KpiCard({
  title,
  value,
  subtitle,
  icon,
  color,
  unavailable,
}: KpiCardProps) {
  const accent = color ?? "primary.main";

  return (
    <Card
      sx={{
        height: "100%",
        minHeight: { xs: 132, sm: 148 },
        borderTop: 3,
        borderTopColor: unavailable ? "grey.400" : accent,
        transition: "box-shadow 0.2s ease",
        "&:hover": {
          boxShadow: (t) => t.shadows[4],
        },
      }}
    >
      <CardContent
        sx={{
          py: { xs: 2, sm: 2.5 },
          px: { xs: 2, sm: 2.5 },
          "&:last-child": { pb: { xs: 2, sm: 2.5 } },
          minHeight: { xs: 116, sm: 124 },
        }}
      >
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 1.5,
          }}
        >
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography
              variant="overline"
              color="text.secondary"
              display="block"
              sx={{ lineHeight: 1.4, mb: 0.75, fontWeight: 600, letterSpacing: 0.6 }}
            >
              {title}
            </Typography>
            {unavailable ? (
              <>
                <Typography
                  variant="h5"
                  color="text.secondary"
                  fontStyle="italic"
                  fontWeight={600}
                  sx={{ display: { xs: "none", sm: "block" }, lineHeight: 1.3 }}
                >
                  {UNAVAILABLE_LABEL}
                </Typography>
                <Typography
                  variant="h5"
                  color="text.secondary"
                  fontStyle="italic"
                  fontWeight={600}
                  sx={{ display: { xs: "block", sm: "none" } }}
                >
                  {UNAVAILABLE_SHORT}
                </Typography>
              </>
            ) : (
              <Typography
                component="p"
                sx={{
                  color: accent,
                  fontWeight: 800,
                  fontSize: { xs: "1.65rem", sm: "2rem" },
                  lineHeight: 1.15,
                  m: 0,
                  wordBreak: "break-word",
                }}
              >
                {value}
              </Typography>
            )}
            {subtitle && !unavailable && (
              <Typography
                variant="body2"
                color="text.secondary"
                display="block"
                sx={{ mt: 0.75, fontWeight: 500 }}
              >
                {subtitle}
              </Typography>
            )}
          </Box>
          {icon && !unavailable && (
            <Box
              sx={{
                color: accent,
                opacity: 0.92,
                flexShrink: 0,
                "& svg": { fontSize: { xs: 32, sm: 40 } },
              }}
            >
              {icon}
            </Box>
          )}
        </Box>
      </CardContent>
    </Card>
  );
}
