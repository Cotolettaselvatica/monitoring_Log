import { useState } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  AppBar,
  Box,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Typography,
  Divider,
  Badge,
  Button,
  Tooltip,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import DashboardIcon from "@mui/icons-material/Dashboard";
import ListAltIcon from "@mui/icons-material/ListAlt";
import AssessmentIcon from "@mui/icons-material/Assessment";
import PrecisionManufacturingIcon from "@mui/icons-material/PrecisionManufacturing";
import NotificationsActiveIcon from "@mui/icons-material/NotificationsActive";
import BuildIcon from "@mui/icons-material/Build";
import HistoryIcon from "@mui/icons-material/History";
import SettingsIcon from "@mui/icons-material/Settings";
import RefreshIcon from "@mui/icons-material/Refresh";
import catisLogo from "@/assets/catis-logo.png";
import { useActiveAlertsCount } from "@/hooks/useData";
import { formatDateTime } from "@/utils/format";
import { DRAWER_WIDTH, CONTENT_MAX_WIDTH } from "@/constants/layout";

const navItems = [
  { label: "Dashboard", path: "/", icon: <DashboardIcon /> },
  { label: "Macchinari", path: "/machines", icon: <PrecisionManufacturingIcon /> },
  { label: "Allarmi", path: "/alerts", icon: <NotificationsActiveIcon />, badge: true },
  { label: "Manutenzione", path: "/maintenance", icon: <BuildIcon /> },
  { label: "Log", path: "/logs", icon: <ListAltIcon /> },
  { label: "Report", path: "/reports", icon: <AssessmentIcon /> },
  { label: "Audit", path: "/audit", icon: <HistoryIcon /> },
  { label: "Impostazioni", path: "/settings", icon: <SettingsIcon /> },
];

export function AppShell() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const [mobileOpen, setMobileOpen] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(new Date().toISOString());
  const navigate = useNavigate();
  const location = useLocation();
  const qc = useQueryClient();
  const activeAlerts = useActiveAlertsCount();

  const handleRefresh = () => {
    qc.invalidateQueries();
    setLastRefresh(new Date().toISOString());
  };

  const isSelected = (path: string) => {
    if (path === "/") return location.pathname === "/";
    return location.pathname.startsWith(path);
  };

  const drawer = (
    <Box sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <Box
        sx={{
          px: 2,
          py: 2,
          borderBottom: 3,
          borderColor: "primary.main",
          bgcolor: "background.paper",
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <Box component="img" src={catisLogo} alt="CATIS" sx={{ height: 40, objectFit: "contain" }} />
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="subtitle1" fontWeight={800} color="primary.main" noWrap>
              CATIS
            </Typography>
            <Typography variant="caption" color="text.secondary" display="block" noWrap>
              Cruscotto interconnessione
            </Typography>
          </Box>
        </Box>
      </Box>
      <List sx={{ flex: 1, px: 1.5, py: 2 }}>
        {navItems.map((item) => (
          <ListItemButton
            key={item.path}
            selected={isSelected(item.path)}
            onClick={() => {
              navigate(item.path);
              setMobileOpen(false);
            }}
          >
            <ListItemIcon sx={{ minWidth: 40 }}>
              {item.badge ? (
                <Badge badgeContent={activeAlerts} color="error">
                  {item.icon}
                </Badge>
              ) : (
                item.icon
              )}
            </ListItemIcon>
            <ListItemText primary={item.label} primaryTypographyProps={{ fontWeight: 500 }} />
          </ListItemButton>
        ))}
      </List>
      <Divider />
      <Typography variant="caption" color="text.secondary" sx={{ px: 2, py: 1.5 }}>
        © CATIS — Monitoraggio interconnessioni e log
      </Typography>
    </Box>
  );

  return (
    <Box sx={{ display: "flex", minHeight: "100vh", bgcolor: "background.default" }}>
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          width: { sm: `calc(100% - ${DRAWER_WIDTH}px)` },
          ml: { sm: `${DRAWER_WIDTH}px` },
        }}
      >
        <Toolbar
          sx={{
            gap: 1,
            minHeight: { xs: 56, sm: 64 },
            px: { xs: 1.5, sm: 2 },
          }}
        >
          <IconButton
            color="inherit"
            edge="start"
            onClick={() => setMobileOpen(!mobileOpen)}
            sx={{ display: { sm: "none" }, mr: 0.5 }}
            aria-label="Apri menu"
          >
            <MenuIcon />
          </IconButton>
          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            <Typography
              variant="h6"
              noWrap
              sx={{
                fontWeight: 700,
                fontSize: { xs: "0.95rem", sm: "1.1rem", md: "1.25rem" },
              }}
            >
              Monitoraggio interconnessione
            </Typography>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ display: { xs: "none", sm: "block" } }}
            >
              Piattaforma operativa macchinari
            </Typography>
          </Box>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: { xs: "none", lg: "block" }, whiteSpace: "nowrap" }}
          >
            {formatDateTime(lastRefresh)}
          </Typography>
          <Tooltip title="Aggiorna dati">
            {isMobile ? (
              <IconButton color="primary" onClick={handleRefresh} aria-label="Aggiorna">
                <RefreshIcon />
              </IconButton>
            ) : (
              <Button
                size="small"
                variant="outlined"
                color="primary"
                startIcon={<RefreshIcon />}
                onClick={handleRefresh}
              >
                Aggiorna
              </Button>
            )}
          </Tooltip>
          <Box
            component="img"
            src={catisLogo}
            alt=""
            sx={{ height: 28, display: { xs: "none", md: "block" }, ml: 0.5 }}
          />
        </Toolbar>
      </AppBar>

      <Box component="nav" sx={{ width: { sm: DRAWER_WIDTH }, flexShrink: { sm: 0 } }}>
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{
            display: { xs: "block", sm: "none" },
            "& .MuiDrawer-paper": { boxSizing: "border-box", width: DRAWER_WIDTH },
          }}
        >
          {drawer}
        </Drawer>
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: "none", sm: "block" },
            "& .MuiDrawer-paper": {
              boxSizing: "border-box",
              width: DRAWER_WIDTH,
              borderRight: 1,
              borderColor: "divider",
            },
          }}
          open
        >
          {drawer}
        </Drawer>
      </Box>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          width: { sm: `calc(100% - ${DRAWER_WIDTH}px)` },
          maxWidth: "100%",
          mt: { xs: "56px", sm: "64px" },
          minHeight: { xs: "calc(100vh - 56px)", sm: "calc(100vh - 64px)" },
        }}
      >
        <Box
          sx={{
            px: { xs: 1.5, sm: 2.5, md: 3 },
            py: { xs: 2, sm: 3 },
            maxWidth: CONTENT_MAX_WIDTH,
            mx: "auto",
            width: "100%",
            minWidth: 0,
          }}
        >
          <Outlet />
        </Box>
      </Box>
    </Box>
  );
}
