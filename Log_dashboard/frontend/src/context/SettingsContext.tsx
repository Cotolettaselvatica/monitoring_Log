import {
  createContext,
  useContext,
  useMemo,
  useState,
  useEffect,
  type ReactNode,
} from "react";
import { useQuery } from "@tanstack/react-query";
import type { AppSettings } from "@/types";
import { settingsService } from "@/services/settingsService";
import { mockSettings } from "@/mocks/extendedData";

interface SettingsContextValue {
  settings: AppSettings;
  pollingIntervalMs: number;
  isLoading: boolean;
  draft: AppSettings;
  setDraft: (s: AppSettings) => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const { data, isLoading } = useQuery({
    queryKey: ["settings"],
    queryFn: () => settingsService.get(),
  });

  const settings = data ?? mockSettings;
  const [draft, setDraft] = useState<AppSettings>(settings);

  useEffect(() => {
    if (data) setDraft(data);
  }, [data]);

  const pollingIntervalMs = settings.pollingIntervalSec * 1000;

  const value = useMemo(
    () => ({ settings, pollingIntervalMs, isLoading, draft, setDraft }),
    [settings, pollingIntervalMs, isLoading, draft],
  );

  return (
    <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used within SettingsProvider");
  return ctx;
}

export function usePollingInterval(): number | false {
  const { pollingIntervalMs } = useSettings();
  return pollingIntervalMs > 0 ? pollingIntervalMs : false;
}
