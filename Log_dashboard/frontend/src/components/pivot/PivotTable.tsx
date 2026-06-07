import {
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  Grid,
  TextField,
  MenuItem,
  Box,
  Chip,
  Stack,
} from "@mui/material";
import { useMemo } from "react";
import type { LogRow } from "@/types";
import {
  buildPivot,
  pivotAggLabels,
  pivotColLabels,
  pivotRowLabels,
  PIVOT_PRESETS,
  type PivotConfig,
  type PivotRowField,
  type PivotColField,
  type PivotAgg,
} from "@/utils/pivot";

interface PivotTableProps {
  rows: LogRow[];
  config: PivotConfig;
  onConfigChange: (c: PivotConfig) => void;
}

function cellKey(r: string, c: string): string {
  return `${r}|||${c}`;
}

export function PivotTable({ rows, config, onConfigChange }: PivotTableProps) {
  const result = useMemo(() => buildPivot(rows, config), [rows, config]);

  const set = (patch: Partial<PivotConfig>) => onConfigChange({ ...config, ...patch });

  return (
    <Paper sx={{ p: 2 }}>
      <Typography variant="subtitle1" fontWeight={600} gutterBottom>
        Tabella pivot
      </Typography>
      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid item xs={12} sm={4}>
          <TextField
            select
            fullWidth
            size="small"
            label="Campo riga"
            value={config.rowField}
            onChange={(e) => set({ rowField: e.target.value as PivotRowField })}
          >
            {(Object.keys(pivotRowLabels) as PivotRowField[]).map((k) => (
              <MenuItem key={k} value={k}>
                {pivotRowLabels[k]}
              </MenuItem>
            ))}
          </TextField>
        </Grid>
        <Grid item xs={12} sm={4}>
          <TextField
            select
            fullWidth
            size="small"
            label="Campo colonna"
            value={config.colField}
            onChange={(e) => set({ colField: e.target.value as PivotColField })}
          >
            {(Object.keys(pivotColLabels) as PivotColField[]).map((k) => (
              <MenuItem key={k} value={k}>
                {pivotColLabels[k]}
              </MenuItem>
            ))}
          </TextField>
        </Grid>
        <Grid item xs={12} sm={4}>
          <TextField
            select
            fullWidth
            size="small"
            label="Aggregazione"
            value={config.agg}
            onChange={(e) => set({ agg: e.target.value as PivotAgg })}
          >
            {(Object.keys(pivotAggLabels) as PivotAgg[]).map((k) => (
              <MenuItem key={k} value={k}>
                {pivotAggLabels[k]}
              </MenuItem>
            ))}
          </TextField>
        </Grid>
      </Grid>

      <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mb: 2 }}>
        <Typography variant="caption" color="text.secondary" sx={{ alignSelf: "center" }}>
          Preset:
        </Typography>
        {PIVOT_PRESETS.map((p) => (
          <Chip
            key={p.name}
            label={p.name}
            size="small"
            onClick={() => onConfigChange(p.config)}
            variant="outlined"
          />
        ))}
      </Stack>

      <TableContainer>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 700 }}>
                {pivotRowLabels[config.rowField]}
              </TableCell>
              {result.colKeys.map((c) => (
                <TableCell key={c} align="right" sx={{ fontWeight: 700 }}>
                  {c}
                </TableCell>
              ))}
              <TableCell align="right" sx={{ fontWeight: 700 }}>
                Totale
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {result.rowKeys.map((r) => (
              <TableRow key={r} hover>
                <TableCell>{r}</TableCell>
                {result.colKeys.map((c) => (
                  <TableCell key={c} align="right">
                    {result.cells.get(cellKey(r, c)) ?? 0}
                  </TableCell>
                ))}
                <TableCell align="right" sx={{ fontWeight: 600 }}>
                  {result.rowTotals.get(r) ?? 0}
                </TableCell>
              </TableRow>
            ))}
            <TableRow sx={{ bgcolor: "action.hover" }}>
              <TableCell sx={{ fontWeight: 700 }}>Totale</TableCell>
              {result.colKeys.map((c) => (
                <TableCell key={c} align="right" sx={{ fontWeight: 700 }}>
                  {result.colTotals.get(c) ?? 0}
                </TableCell>
              ))}
              <TableCell align="right" sx={{ fontWeight: 700 }}>
                {result.grandTotal}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </TableContainer>

      {rows.length === 0 && (
        <Box sx={{ py: 4, textAlign: "center" }}>
          <Typography color="text.secondary">Nessun dato per il pivot selezionato</Typography>
        </Box>
      )}
    </Paper>
  );
}
