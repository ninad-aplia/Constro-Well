// Seller Hub icon set — ported from buildgrid-seller-dashboard.html's `ICON`
// map (line 121), same stroke convention as the rest of the app (viewBox 0 0
// 24 24, stroke 1.8, round caps/joins).
const PATHS: Record<string, string> = {
  grid: "M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z",
  box: "M3 7.5L12 3l9 4.5v9L12 21l-9-4.5z M3 7.5l9 4.5 9-4.5 M12 12v9",
  tag: "M3 12V4h8l10 10-8 8z",
  truck: "M2 6h11v10H2zM13 9h5l3 3v4h-8",
  wallet: "M3 6h18v14H3z M3 10h18M16 15h2",
  chart: "M4 20V4M4 20h16 M8 16v-4M12 16V8M16 16v-6",
  gear: "M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2",
  search: "M16 16l4.5 4.5",
  bell: "M6 17V11a6 6 0 0112 0v6l1.5 2h-15z M10 21h4",
  plus: "M12 5v14M5 12h14",
  minus: "M5 12h14",
  x: "M6 6l12 12M18 6L6 18",
  check: "M5 12.5l4.5 4.5L19 7.5",
  alert: "M12 3l10 18H2z M12 10v5M12 18v.5",
  clock: "M12 7v5l3 2",
  dl: "M12 4v11M7 11l5 5 5-5M5 20h14",
  star: "M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 16.9 6.8 19.7l1-5.9L3.5 9.7l5.9-.8z",
  lock: "M8 11V8a4 4 0 018 0v3",
  pin: "M12 21s7-6 7-11a7 7 0 10-14 0c0 5 7 11 7 11z",
  doc: "M6 3h8l4 4v14H6z M14 3v4h4M9 12h6M9 16h6",
  shield: "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z M9 12l2 2 4-4",
};

const CIRCLES: Partial<Record<string, { cx: number; cy: number; r: number }[]>> = {
  grid: [],
  search: [{ cx: 11, cy: 11, r: 6.5 }],
  gear: [{ cx: 12, cy: 12, r: 3 }],
  box: [],
  clock: [{ cx: 12, cy: 12, r: 9 }],
};

export default function SellerIcon({
  name,
  size = 20,
  className,
}: {
  name: keyof typeof PATHS;
  size?: number;
  className?: string;
}) {
  const circles = CIRCLES[name] ?? [];
  const rects = name === "grid" ? [
    { x: 3, y: 3, w: 7, h: 7 },
    { x: 14, y: 3, w: 7, h: 7 },
    { x: 3, y: 14, w: 7, h: 7 },
    { x: 14, y: 14, w: 7, h: 7 },
  ] : [];

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={`flex-none ${className ?? ""}`}
    >
      {name !== "grid" && <path d={PATHS[name]} />}
      {rects.map((r, i) => (
        <rect key={i} x={r.x} y={r.y} width={r.w} height={r.h} rx="1.5" />
      ))}
      {circles.map((c, i) => (
        <circle key={i} cx={c.cx} cy={c.cy} r={c.r} />
      ))}
    </svg>
  );
}
