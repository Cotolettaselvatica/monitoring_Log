import { alpha, createTheme } from "@mui/material/styles";
import { itIT } from "@mui/material/locale";
import { itIT as dataGridItIT } from "@mui/x-data-grid/locales";
import type { ThemeMode } from "@/types";
import { catisColors } from "./palette";

export function createCatisTheme(mode: ThemeMode = "light") {
  const isDark = mode === "dark";
  const paper = isDark ? "#1E1E1E" : "#FFFFFF";
  const defaultBg = isDark ? "#121212" : "#F0F2F5";
  const divider = isDark ? alpha("#FFFFFF", 0.12) : alpha(catisColors.ink, 0.08);

  return createTheme(
    {
      palette: {
        mode,
        primary: {
          main: catisColors.red,
          dark: catisColors.redDark,
          contrastText: "#FFFFFF",
        },
        secondary: {
          main: catisColors.green,
          dark: catisColors.greenDark,
          contrastText: "#FFFFFF",
        },
        background: {
          default: defaultBg,
          paper,
        },
        text: {
          primary: isDark ? "#F4F6F8" : catisColors.ink,
          secondary: isDark ? "#9AA5B1" : "#52606D",
        },
        divider,
      },
      shape: { borderRadius: 8 },
      typography: {
        fontFamily: '"Roboto", "Helvetica Neue", "Arial", sans-serif',
        h4: {
          fontWeight: 700,
          letterSpacing: "-0.02em",
          lineHeight: 1.25,
        },
        h5: { fontWeight: 700, letterSpacing: "-0.01em" },
        h6: { fontWeight: 600 },
        subtitle1: { fontWeight: 600 },
        body2: { lineHeight: 1.5 },
        button: { textTransform: "none", fontWeight: 600 },
        overline: {
          fontWeight: 700,
          letterSpacing: "0.08em",
          fontSize: "0.65rem",
        },
      },
      components: {
        MuiCssBaseline: {
          styleOverrides: {
            body: {
              backgroundColor: defaultBg,
            },
          },
        },
        MuiCard: {
          styleOverrides: {
            root: {
              border: `1px solid ${divider}`,
              boxShadow: isDark
                ? "none"
                : "0 1px 2px rgba(31,41,51,0.06), 0 4px 12px rgba(31,41,51,0.04)",
            },
          },
        },
        MuiPaper: {
          styleOverrides: {
            root: {
              backgroundImage: "none",
            },
            outlined: {
              borderColor: divider,
            },
          },
        },
        MuiAppBar: {
          styleOverrides: {
            root: {
              backgroundColor: paper,
              color: isDark ? "#F4F6F8" : catisColors.ink,
              borderBottom: `3px solid ${catisColors.red}`,
              boxShadow: "0 2px 8px rgba(31,41,51,0.06)",
            },
          },
        },
        MuiDrawer: {
          styleOverrides: {
            paper: {
              borderRight: `1px solid ${divider}`,
              backgroundColor: paper,
            },
          },
        },
        MuiListItemButton: {
          styleOverrides: {
            root: {
              borderRadius: 8,
              marginBottom: 4,
              "&.Mui-selected": {
                backgroundColor: alpha(catisColors.red, isDark ? 0.2 : 0.08),
                color: catisColors.red,
                borderLeft: `4px solid ${catisColors.red}`,
                paddingLeft: 12,
                "& .MuiListItemIcon-root": {
                  color: catisColors.red,
                },
                "&:hover": {
                  backgroundColor: alpha(catisColors.red, isDark ? 0.28 : 0.12),
                },
              },
            },
          },
        },
        MuiButton: {
          styleOverrides: {
            root: {
              borderRadius: 8,
              paddingLeft: 16,
              paddingRight: 16,
            },
            containedPrimary: {
              boxShadow: "none",
              "&:hover": { boxShadow: "0 2px 8px rgba(226,0,26,0.25)" },
            },
          },
        },
        MuiChip: {
          styleOverrides: {
            root: {
              fontWeight: 600,
            },
          },
        },
        MuiTabs: {
          styleOverrides: {
            root: {
              minHeight: 44,
            },
          },
        },
        MuiTab: {
          styleOverrides: {
            root: {
              textTransform: "none",
              fontWeight: 600,
              minHeight: 44,
            },
          },
        },
        MuiTableCell: {
          styleOverrides: {
            head: {
              fontWeight: 700,
              backgroundColor: isDark ? alpha("#FFF", 0.04) : alpha(catisColors.ink, 0.04),
            },
          },
        },
        MuiDialog: {
          styleOverrides: {
            paper: {
              borderRadius: 12,
            },
          },
        },
        MuiDivider: {
          styleOverrides: {
            root: {
              borderColor: divider,
            },
          },
        },
      },
    },
    itIT,
    dataGridItIT,
  );
}
