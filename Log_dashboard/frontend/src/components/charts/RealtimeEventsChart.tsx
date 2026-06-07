import { useEffect, useMemo, useRef, useState } from "react";
import * as d3 from "d3";
import { Box, Typography, Chip } from "@mui/material";
import FiberManualRecordIcon from "@mui/icons-material/FiberManualRecord";
import type { LogEntry } from "@/types";
import { catisColors } from "@/theme/catisTheme";
import {
  aggregateRecentMinutes,
  formatRealtimeTick,
} from "@/utils/realtimeAggregation";
import { formatDateTime } from "@/utils/format";

interface RealtimeEventsChartProps {
  logs: LogEntry[];
  lastUpdatedAt?: number;
  pollingSec?: number;
  height?: number;
}

export function RealtimeEventsChart({
  logs,
  lastUpdatedAt,
  pollingSec = 30,
  height = 220,
}: RealtimeEventsChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [width, setWidth] = useState(480);

  const points = useMemo(
    () => aggregateRecentMinutes(logs, 60, 5),
    [logs],
  );

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w && w > 0) setWidth(w);
    });
    ro.observe(el);
    setWidth(el.clientWidth || 480);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!svgRef.current || points.length === 0) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const margin = { top: 12, right: 12, bottom: 44, left: 40 };
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;

    const g = svg
      .attr("width", width)
      .attr("height", height)
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    const x = d3
      .scaleBand()
      .domain(points.map((p) => p.key))
      .range([0, innerW])
      .padding(0.2);

    const maxCount = Math.max(1, d3.max(points, (p) => p.count) ?? 1);
    const y = d3.scaleLinear().domain([0, maxCount]).nice().range([innerH, 0]);

    const tickValues =
      points.length > 8
        ? points.filter((_, i) => i % 2 === 0).map((p) => p.key)
        : points.map((p) => p.key);

    g.append("g")
      .attr("transform", `translate(0,${innerH})`)
      .call(
        d3
          .axisBottom(x)
          .tickValues(tickValues)
          .tickFormat((d) => formatRealtimeTick(d as string)),
      )
      .selectAll("text")
      .attr("transform", "rotate(-35)")
      .style("text-anchor", "end")
      .style("font-size", "10px");

    g.append("g")
      .call(d3.axisLeft(y).ticks(4).tickFormat(d3.format("d")))
      .selectAll("text")
      .style("font-size", "10px");

    const line = d3
      .line<typeof points[0]>()
      .x((d) => (x(d.key) ?? 0) + x.bandwidth() / 2)
      .y((d) => y(d.count))
      .curve(d3.curveMonotoneX);

    g.append("path")
      .datum(points)
      .attr("fill", "none")
      .attr("stroke", catisColors.green)
      .attr("stroke-width", 2.5)
      .attr("d", line);

    g.selectAll("circle")
      .data(points)
      .enter()
      .append("circle")
      .attr("cx", (d) => (x(d.key) ?? 0) + x.bandwidth() / 2)
      .attr("cy", (d) => y(d.count))
      .attr("r", 4)
      .attr("fill", catisColors.green)
      .append("title")
      .text((d) => `${formatRealtimeTick(d.key)}: ${d.count} eventi`);

    const total = d3.sum(points, (p) => p.count);
    g.append("text")
      .attr("x", innerW)
      .attr("y", -2)
      .attr("text-anchor", "end")
      .style("font-size", "11px")
      .style("fill", "#52606D")
      .text(`Ultima ora: ${total} eventi`);
  }, [points, width, height]);

  return (
    <Box ref={containerRef} sx={{ width: "100%" }}>
      <Box
        sx={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 1,
          mb: 1,
        }}
      >
        <Box>
          <Typography variant="subtitle1" fontWeight={600}>
            Eventi in tempo reale
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Ultimi 60 minuti — aggiornamento ogni {pollingSec}s
            {lastUpdatedAt
              ? ` · ${formatDateTime(new Date(lastUpdatedAt).toISOString())}`
              : ""}
          </Typography>
        </Box>
        <Chip
          size="small"
          icon={
            <FiberManualRecordIcon
              sx={{
                fontSize: 10,
                color: `${catisColors.green} !important`,
                animation: "pulse 1.5s ease-in-out infinite",
                "@keyframes pulse": {
                  "0%, 100%": { opacity: 1 },
                  "50%": { opacity: 0.35 },
                },
              }}
            />
          }
          label="Live"
          color="success"
          variant="outlined"
        />
      </Box>
      <svg ref={svgRef} style={{ width: "100%", display: "block" }} />
    </Box>
  );
}
