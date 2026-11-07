// Delivery Portal navigation — shared between the desktop sidebar and the
// mobile bottom bar, same pattern as `lib/seller/nav.ts`.
export const DELIVERY_NAV = [
  { href: "/delivery", label: "Overview", icon: "grid" as const },
  { href: "/delivery/jobs", label: "Deliveries", icon: "truck" as const },
  { href: "/delivery/history", label: "History", icon: "clock" as const },
  { href: "/delivery/settings", label: "Settings", icon: "gear" as const },
];
