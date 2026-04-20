import { useMemo } from "react";
import type { PricePoint } from "../../data/nseData";

interface Props {
  history:   PricePoint[];
  height?:   number;
  showAxes?: boolean;
  id?:       string;  // stable caller-supplied ID to avoid gradient collision
}

export default function StockChart({ history, height = 120, showAxes = false, id = "chart" }: Props) {
  const { min, max, svgPoints, areaPoints } = useMemo(() => {
    if (history.length === 0) return { min: 0, max: 0, svgPoints: "", areaPoints: "" };

    const closes = history.map((p) => p.close);
    const minVal = Math.min(...closes);
    const maxVal = Math.max(...closes);
    const range = maxVal - minVal || 1;

    const w = 600;
    const h = height;
    const pad = showAxes ? 8 : 0;

    const coords = closes.map((c, i) => {
      const x = pad + (i / (closes.length - 1)) * (w - pad * 2);
      const y = h - pad - ((c - minVal) / range) * (h - pad * 2);
      return [x, y] as [number, number];
    });

    const line = coords.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
    const area =
      line +
      ` L${coords[coords.length - 1][0].toFixed(1)},${h} L${coords[0][0].toFixed(1)},${h} Z`;

    return { min: minVal, max: maxVal, svgPoints: line, areaPoints: area };
  }, [history, height, showAxes]);

  const isUp   = history.length >= 2 && history[history.length - 1].close >= history[0].close;
  const color  = isUp ? "#34d399" : "#f87171";
  const gradId = `grad-${id}`;

  return (
    <svg
      viewBox={`0 0 600 ${height}`}
      className="w-full h-full"
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {areaPoints && (
        <path d={areaPoints} fill={`url(#${gradId})`} />
      )}
      {svgPoints && (
        <path d={svgPoints} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
      )}
      {showAxes && (
        <>
          <text x="4" y="12" fill="#6b7280" fontSize="10" fontFamily="monospace">
            {max.toFixed(2)}
          </text>
          <text x="4" y={height - 4} fill="#6b7280" fontSize="10" fontFamily="monospace">
            {min.toFixed(2)}
          </text>
        </>
      )}
    </svg>
  );
}
