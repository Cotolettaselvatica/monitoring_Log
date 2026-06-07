import { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import { Box, Typography, Card, CardContent } from "@mui/material";
import type { MachineStatus } from "@/types";
import { statusColors } from "@/theme/catisTheme";
import { statusLabels } from "@/utils/format";

interface StatusDonutProps {
  data: { status: MachineStatus; count: number }[];
}

export function StatusDonut({ data }: StatusDonutProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState(260);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w && w > 0) setSize(Math.min(320, Math.max(200, Math.min(w, 280))));
    });
    ro.observe(el);
    setSize(Math.min(280, el.clientWidth || 260));
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!svgRef.current || data.length === 0) return;
    const width = size;
    const height = size;
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const radius = Math.min(width, height) / 2 - 10;
    const g = svg
      .attr("width", width)
      .attr("height", height)
      .append("g")
      .attr("transform", `translate(${width / 2},${height / 2})`);

    const pie = d3.pie<{ status: MachineStatus; count: number }>().value((d) => d.count);
    const arc = d3
      .arc<d3.PieArcDatum<{ status: MachineStatus; count: number }>>()
      .innerRadius(radius * 0.55)
      .outerRadius(radius);

    g.selectAll("path")
      .data(pie(data))
      .enter()
      .append("path")
      .attr("d", arc)
      .attr("fill", (d) => statusColors[d.data.status])
      .attr("stroke", "#fff")
      .attr("stroke-width", 2)
      .append("title")
      .text((d) => `${statusLabels[d.data.status]}: ${d.data.count}`);

    const total = d3.sum(data, (d) => d.count);
    g.append("text")
      .attr("text-anchor", "middle")
      .attr("dy", "-0.2em")
      .style("font-size", size < 240 ? "22px" : "28px")
      .style("font-weight", "700")
      .style("fill", "#1F2933")
      .text(total);
    g.append("text")
      .attr("text-anchor", "middle")
      .attr("dy", "1.2em")
      .style("font-size", "12px")
      .style("fill", "#52606D")
      .text("macchinari");
  }, [data, size]);

  return (
    <Card sx={{ height: "100%" }}>
      <CardContent>
        <Typography variant="subtitle1" fontWeight={600} gutterBottom>
          Distribuzione stati
        </Typography>
        <Box
          ref={containerRef}
          sx={{
            display: "flex",
            flexDirection: { xs: "column", sm: "row" },
            flexWrap: "wrap",
            gap: 2,
            alignItems: "center",
            justifyContent: "center",
            width: "100%",
          }}
        >
          <svg ref={svgRef} style={{ maxWidth: "100%", flexShrink: 0 }} />
          <Box sx={{ minWidth: { xs: "100%", sm: 140 } }}>
            {data.map((d) => (
              <Box key={d.status} sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
                <Box sx={{ width: 12, height: 12, borderRadius: "50%", bgcolor: statusColors[d.status], flexShrink: 0 }} />
                <Typography variant="body2">
                  {statusLabels[d.status]}: <strong>{d.count}</strong>
                </Typography>
              </Box>
            ))}
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}
