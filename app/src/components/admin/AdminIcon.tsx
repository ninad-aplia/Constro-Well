// Admin console icon set — same stroke convention as the rest of the app
// (24px grid, stroke 1.8, round caps), ported from the platform-admin
// prototype's `ICON` map.
const PATHS: Record<string, string> = {
  grid: "M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z",
  shield: "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z M9 12l2 2 4-4",
  truck: "M2 6h11v10H2zM13 9h5l3 3v4h-8",
  wallet: "M3 6h18v14H3z M3 10h18M16 15h2",
  store: "M4 9h16v11H4z M3 9l2-5h14l2 5 M9 20v-6h6v6",
  users: "M8 11a4 4 0 100-8 4 4 0 000 8z M2 21v-1c0-3 3-5 6-5s6 2 6 5v1 M17 4a3 3 0 010 6 M22 21v-1c0-2.4-1.8-4.2-4-4.8",
  log: "M5 3h14v18H5z M8 8h8M8 12h8M8 16h5",
  gear: "M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2",
  box: "M3 7.5L12 3l9 4.5v9L12 21l-9-4.5z M3 7.5l9 4.5 9-4.5 M12 12v9",
  alert: "M12 3l10 18H2z M12 10v5M12 18v.5",
};

const CIRCLES: Partial<Record<string, { cx: number; cy: number; r: number }[]>> = {
  gear: [{ cx: 12, cy: 12, r: 3 }],
};

export default function AdminIcon({
  name,
  size = 20,
  className,
}: {
  name: keyof typeof PATHS;
  size?: number;
  className?: string;
}) {
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
      className={className}
    >
      <path d={PATHS[name]} />
      {(CIRCLES[name] ?? []).map((circle) => (
        <circle key={`${circle.cx}-${circle.cy}`} {...circle} />
      ))}
    </svg>
  );
}
