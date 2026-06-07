import { Typography } from "@mui/material";
import { useLogRows } from "@/hooks/useData";
import { LogDataGrid } from "@/components/logs/LogDataGrid";
import { DataGridShell } from "@/components/common/DataGridShell";
import { SectionTitle } from "@/components/layout/SectionTitle";

const RECENT_LIMIT = 50;

export function DashboardRecentLogs() {
  const { rows, isLoading } = useLogRows();
  const recent = rows.slice(0, RECENT_LIMIT);

  return (
    <section style={{ marginBottom: 24 }}>
      <SectionTitle
        title="Ultimi eventi — tutti i macchinari"
        subtitle="Aggiornamento automatico con immagine macchinario in ogni riga"
      />
      <DataGridShell minHeight={400}>
        <LogDataGrid rows={recent} loading={isLoading} height={440} responsive />
      </DataGridShell>
      <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: "block" }}>
        Mostrati i primi {RECENT_LIMIT} eventi. Per l&apos;analisi completa apri la sezione Log.
      </Typography>
    </section>
  );
}
