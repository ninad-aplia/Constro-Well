// Daily sales bar chart — port of buildgrid-seller-dashboard.html's
// `chartSvg()` (line 309). Simplified: native <title> tooltips per bar
// instead of the prototype's custom pointermove-tracked floating tooltip —
// same information, no bespoke pointer-tracking JS needed.
function formatCompact(n: number): string {
  if (n >= 1e7) return `₹${(n / 1e7).toFixed(2)} Cr`;
  if (n >= 1e5) return `₹${(n / 1e5).toFixed(2)} L`;
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}

export default function SalesChart({ data, dayLabels }: { data: number[]; dayLabels: string[] }) {
  const width = 640;
  const height = 240;
  const padLeft = 46;
  const padRight = 6;
  const padTop = 10;
  const padBottom = 26;
  const max = Math.max(...data) * 1.1;
  const barWidth = (width - padLeft - padRight) / data.length;
  const y = (v: number) => height - padBottom - (v / max) * (height - padTop - padBottom);

  const gridLines = [0, 0.5, 1].map((f) => max * f);
  const labelIdx = [0, Math.floor(data.length / 2), data.length - 1];

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={`Daily sales for the last ${data.length} days`}
      className="block w-full"
    >
      {gridLines.map((v, i) => (
        <g key={i}>
          <line x1={padLeft} x2={width - padRight} y1={y(v)} y2={y(v)} stroke="var(--line)" />
          <text x={padLeft - 6} y={y(v) + 4} textAnchor="end" className="fill-muted text-[11px]">
            {formatCompact(v)}
          </text>
        </g>
      ))}
      {data.map((v, i) => (
        <rect
          key={i}
          x={padLeft + i * barWidth + barWidth * 0.12}
          y={y(v)}
          width={Math.max(1, barWidth * 0.76)}
          height={height - padBottom - y(v)}
          rx={barWidth > 8 ? 3 : 1}
          className={i === data.length - 1 ? "fill-hi2" : "fill-link opacity-80"}
        >
          <title>{`${dayLabels[i]}: ${formatCompact(v)}`}</title>
        </rect>
      ))}
      {labelIdx.map((i) => (
        <text key={i} x={padLeft + i * barWidth + barWidth / 2} y={height - 8} textAnchor="middle" className="fill-muted text-[11px]">
          {dayLabels[i]}
        </text>
      ))}
    </svg>
  );
}
