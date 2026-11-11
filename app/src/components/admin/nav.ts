// Admin navigation model. Only `Users` is implemented in this slice; the rest
// are visible (prototype information architecture) but disabled with an
// explicit "not available yet" title — never fake data or dead links.
export interface AdminNavItem {
  key: string;
  label: string;
  href: string | null;
  icon: "grid" | "shield" | "truck" | "wallet" | "store" | "users" | "log" | "gear" | "box";
}

export const ADMIN_NAV: AdminNavItem[] = [
  { key: "overview", label: "Overview", href: "/admin", icon: "grid" },
  { key: "approvals", label: "Approvals", href: null, icon: "shield" },
  { key: "deliveries", label: "Deliveries", href: "/admin/shipments", icon: "truck" },
  { key: "orders", label: "Orders", href: "/admin/orders", icon: "box" },  { key: "finance", label: "Finance", href: "/admin/finance", icon: "wallet" },
  { key: "sellers", label: "Sellers", href: "/admin/sellers", icon: "store" },
  { key: "users", label: "Users", href: "/admin/users", icon: "users" },
  { key: "log", label: "Activity log", href: "/admin/activity", icon: "log" },
  { key: "settings", label: "Settings", href: null, icon: "gear" },
];

export const PENDING_NOTE = "Available in a later task";
