import { useEffect, useRef } from "react";
import * as d3 from "d3";
import { Box, Typography } from "@mui/material";
import dayjs from "dayjs";
import { catisColors } from "@/theme/catisTheme";

interface TimelinePoint {
  hour: string;
  count: number;
}

interface InterconnectionTimelineProps {
  points: TimelinePoint[];
  width?: number;
  height?: number;
}

export function InterconnectionTimeline({
  points,
  width = 520,
  height = 220,
}: InterconnectionTimelineProps) {
  const ref = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!ref.current || points.length === 0) return;
    const svg = d3.select(ref.current);
    svg.selectAll("*").remove();

    const margin = { top: 16, right: 16, bottom: 36, left: 40 };
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;

    const g = svg
      .attr("width", width)
      .attr("height", height)
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    const x = d3
      .scaleBand()
      .domain(points.map((p) => p.hour))
      .range([0, innerW])
      .padding(0.2);

    const y = d3
      .scaleLinear()
      .domain([0, d3.max(points, (p) => p.count) ?? 1])
      .nice()
      .range([innerH, 0]);

    g.append("g")
      .attr("transform", `translate(0,${innerH})`)
      .call(d3.axisBottom(x).tickFormat((d) => dayjs(d as string).format("HH:mm")))
      .selectAll("text")
      .attr("transform", "rotate(-35)")
      .style("text-anchor", "end")
      .style("font-size", "10px");

    g.append("g").call(d3.axisLeft(y).ticks(5)).selectAll("text").style("font-size", "10px");

    const area = d3
      .area<TimelinePoint>()
      .x((d) => (x(d.hour) ?? 0) + x.bandwidth() / 2)
      .y0(innerH)
      .y1((d) => y(d.count))
      .curve(d3.curveMonotoneX);

    g.append("path")
      .datum(points)
      .attr("fill", catisColors.green)
      .attr("fill-opacity", 0.15)
      .attr("d", area);

    g.selectAll("rect")
      .data(points)
      .enter()
      .append("rect")
      .attr("x", (d) => x(d.hour) ?? 0)
      .attr("y", (d) => y(d.count))
      .attr("width", x.bandwidth())
      .attr("height", (d) => innerH - y(d.count))
      .attr("fill", catisColors.green)
      .attr("rx", 3)
      .append("title")
      .text((d) => `${dayjs(d.hour).format("DD/MM HH:mm")}: ${d.count} eventi`);
  }, [points, width, height]);

  return (
    <Box>
      <Typography variant="subtitle1" fontWeight={600} gutterBottom>
        Eventi interconnessione (ultime 24h)
      </Typography>
      <svg ref={ref} style={{ maxWidth: "100%" }} />
    </Box>
  );
}
