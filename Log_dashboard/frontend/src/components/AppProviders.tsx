import { useMemo, type ReactNode } from "react";
import { ThemeProvider, CssBaseline } from "@mui/material";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { LocalizationProvider } from "@mui/x-date-pickers";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { SettingsProvider, useSettings } from "@/context/SettingsContext";
import { createCatisTheme } from "@/theme/createCatisTheme";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      refetchOnWindowFocus: true,
      retry: 1,
    },
  },
});

function ThemedApp({ children }: { children: ReactNode }) {
  const { settings } = useSettings();
  const theme = useMemo(() => createCatisTheme(settings.themeMode), [settings.themeMode]);
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {children}
    </ThemeProvider>
  );
}

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <SettingsProvider>
        <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="it">
          <ThemedApp>{children}</ThemedApp>
        </LocalizationProvider>
      </SettingsProvider>
    </QueryClientProvider>
  );
}
