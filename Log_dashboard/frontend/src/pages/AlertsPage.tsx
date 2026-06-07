import { useMemo, useState } from "react";
import {
  Button,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Chip,
  Box,
  Typography,
  useMediaQuery,
  useTheme,
  Card,
  CardContent,
  Stack,
} from "@mui/material";
import { useAlerts, useAcknowledgeAlert, useLogAudit, useMachines } from "@/hooks/useData";
import { SYSTEM_ACTOR } from "@/constants/audit";
import { FilterBar } from "@/components/filters/FilterBar";
import { defaultPageFilters, filterAlerts, type PageFilterState } from "@/utils/filters";
import { LoadingState } from "@/components/common/LoadingState";
import { RequiresApiAlert } from "@/components/common/RequiresApiAlert";
import { ScrollableTable } from "@/components/common/ScrollableTable";
import { PageHeader } from "@/components/layout/PageHeader";
import { hasApi } from "@/services/apiClient";
import { formatDateTime } from "@/utils/format";
import type { Alert, AlertSeverity } from "@/types";

const severityColor: Record<AlertSeverity, "default" | "warning" | "error"> = {
  info: "default",
  warning: "warning",
  critical: "error",
};

function AlertCard({
  alert,
  onAck,
  ackPending,
}: {
  alert: Alert;
  onAck: (id: string) => void;
  ackPending: boolean;
}) {
  return (
    <Card variant="outlined">
      <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
        <Stack spacing={1}>
          <Box sx={{ display: "flex", justifyContent: "space-between", gap: 1, flexWrap: "wrap" }}>
            <Typography variant="caption" color="text.secondary">
              {formatDateTime(alert.triggeredAt)}
            </Typography>
            <Chip label={alert.severity} size="small" color={severityColor[alert.severity]} />
          </Box>
          <Typography variant="subtitle2" fontWeight={700}>
            {alert.machineCode} — {alert.machineName}
          </Typography>
          <Typography variant="body2">{alert.message}</Typography>
          <Typography variant="caption" color="text.secondary">
            {alert.ruleName} · {alert.status}
          </Typography>
          {alert.status === "active" && (
            <Button
              size="small"
              variant="contained"
              disabled={!hasApi || ackPending}
              onClick={() => onAck(alert.id)}
              sx={{ alignSelf: "flex-start" }}
            >
              Presa in carico
            </Button>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}

export default function AlertsPage() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const { data: alerts = [], isLoading } = useAlerts();
  const { data: machines = [] } = useMachines();
  const [filters, setFilters] = useState<PageFilterState>(defaultPageFilters);
  const ack = useAcknowledgeAlert();
  const logAudit = useLogAudit();

  const filtered = useMemo(() => filterAlerts(alerts, filters), [alerts, filters]);

  const handleAck = (id: string) => {
    ack.mutate(
      { id, operator: SYSTEM_ACTOR },
      {
        onSuccess: () =>
          logAudit.mutate({
            operator: SYSTEM_ACTOR,
            action: "ACK_ALERT",
            entityType: "alert",
            entityId: id,
            details: "Presa in carico allarme",
          }),
      },
    );
  };

  if (isLoading) return <LoadingState />;

  return (
    <>
      <PageHeader
        title="Centro allarmi"
        subtitle="Monitoraggio regole, severità e presa in carico eventi critici"
      />
      {!hasApi && <RequiresApiAlert />}
      <FilterBar
        filters={filters}
        onChange={setFilters}
        machines={machines}
        fields={["dates", "machine", "severity", "alertStatus", "search"]}
      />

      {isMobile ? (
        <Stack spacing={1.5}>
          {filtered.map((a) => (
            <AlertCard key={a.id} alert={a} onAck={handleAck} ackPending={ack.isPending} />
          ))}
        </Stack>
      ) : (
        <ScrollableTable>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell>Timestamp</TableCell>
                <TableCell>Macchinario</TableCell>
                <TableCell>Regola</TableCell>
                <TableCell>Severità</TableCell>
                <TableCell>Stato</TableCell>
                <TableCell>Messaggio</TableCell>
                <TableCell align="right">Azioni</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.map((a) => (
                <TableRow key={a.id} hover>
                  <TableCell sx={{ whiteSpace: "nowrap" }}>{formatDateTime(a.triggeredAt)}</TableCell>
                  <TableCell>
                    {a.machineCode} — {a.machineName}
                  </TableCell>
                  <TableCell>{a.ruleName}</TableCell>
                  <TableCell>
                    <Chip label={a.severity} size="small" color={severityColor[a.severity]} />
                  </TableCell>
                  <TableCell>{a.status}</TableCell>
                  <TableCell>{a.message}</TableCell>
                  <TableCell align="right">
                    {a.status === "active" && (
                      <Button
                        size="small"
                        variant="contained"
                        disabled={!hasApi || ack.isPending}
                        onClick={() => handleAck(a.id)}
                      >
                        Presa in carico
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollableTable>
      )}
    </>
  );
}
