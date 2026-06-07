import { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import { Box, Typography } from "@mui/material";
import { catisColors } from "@/theme/catisTheme";
import type { AggregatePoint } from "@/utils/logAggregation";
import {
  formatAggregateTick,
  formatAggregateTooltip,
} from "@/utils/logAggregation";

type BucketUnit = "hour" | "day" | "week" | "month" | "year";

interface EventsAggregateChartProps {
  title: string;
  subtitle?: string;
  points: AggregatePoint[];
  unit: BucketUnit;
  height?: number;
  color?: string;
}

export function EventsAggregateChart({
  title,
  subtitle,
  points,
  unit,
  height = 220,
  color = catisColors.green,
}: EventsAggregateChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [width, setWidth] = useState(480);

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

    const margin = { top: 12, right: 12, bottom: unit === "hour" || unit === "day" ? 48 : 40, left: 44 };
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
      .padding(unit === "hour" ? 0.15 : 0.25);

    const maxCount = d3.max(points, (p) => p.count) ?? 1;
    const y = d3.scaleLinear().domain([0, maxCount]).nice().range([innerH, 0]);

    const tickValues =
      points.length > 14
        ? points.filter((_, i) => i % Math.ceil(points.length / 10) === 0).map((p) => p.key)
        : points.map((p) => p.key);

    g.append("g")
      .attr("transform", `translate(0,${innerH})`)
      .call(
        d3
          .axisBottom(x)
          .tickValues(tickValues)
          .tickFormat((d) => formatAggregateTick(d as string, unit)),
      )
      .selectAll("text")
      .attr("transform", points.length > 8 ? "rotate(-35)" : null)
      .style("text-anchor", points.length > 8 ? "end" : "middle")
      .style("font-size", "10px");

    g.append("g")
      .call(d3.axisLeft(y).ticks(5).tickFormat(d3.format("d")))
      .selectAll("text")
      .style("font-size", "10px");

    const area = d3
      .area<AggregatePoint>()
      .x((d) => (x(d.key) ?? 0) + x.bandwidth() / 2)
      .y0(innerH)
      .y1((d) => y(d.count))
      .curve(d3.curveMonotoneX);

    g.append("path")
      .datum(points)
      .attr("fill", color)
      .attr("fill-opacity", 0.12)
      .attr("d", area);

    g.selectAll("rect")
      .data(points)
      .enter()
      .append("rect")
      .attr("x", (d) => x(d.key) ?? 0)
      .attr("y", (d) => y(d.count))
      .attr("width", x.bandwidth())
      .attr("height", (d) => Math.max(0, innerH - y(d.count)))
      .attr("fill", color)
      .attr("rx", 2)
      .append("title")
      .text((d) => formatAggregateTooltip(d.key, d.count, unit));

    const total = d3.sum(points, (p) => p.count);
    g.append("text")
      .attr("x", innerW)
      .attr("y", -2)
      .attr("text-anchor", "end")
      .style("font-size", "11px")
      .style("fill", "#52606D")
      .text(`Totale: ${total}`);
  }, [points, width, height, unit, color]);

  return (
    <Box ref={containerRef} sx={{ width: "100%" }}>
      <Typography variant="subtitle1" fontWeight={600} gutterBottom>
        {title}
      </Typography>
      {subtitle && (
        <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
          {subtitle}
        </Typography>
      )}
      <svg ref={svgRef} style={{ width: "100%", display: "block" }} />
    </Box>
  );
}
