// Seller Hub navigation — ported from buildgrid-seller-dashboard.html's `NAV`
// (line 308): shared between the desktop sidebar and the mobile bottom bar.
export const SELLER_NAV = [
  { href: "/seller", label: "Overview", icon: "grid" as const },
  { href: "/seller/orders", label: "Orders", icon: "box" as const },
  { href: "/seller/products", label: "Products", icon: "tag" as const },
  { href: "/seller/delivery", label: "Delivery", icon: "truck" as const },
  { href: "/seller/payments", label: "Payments", icon: "wallet" as const },
  { href: "/seller/performance", label: "Performance", icon: "chart" as const },
  { href: "/seller/settings", label: "Settings", icon: "gear" as const },
];
