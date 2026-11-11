// Mobile admin navigation — same pattern as SellerBottomNav/DeliveryBottomNav.
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import AdminIcon from "./AdminIcon";
import { ADMIN_NAV, PENDING_NOTE } from "./nav";

export default function AdminBottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Admin console"
      className="fixed right-0 bottom-0 left-0 z-50 flex overflow-x-auto border-t border-white/10 bg-nav px-1 pt-1.5 pb-[calc(6px+env(safe-area-inset-bottom))] text-[10px] md:hidden"
    >
      {ADMIN_NAV.map(({ key, label, href, icon }) => {
        const active = href ? pathname?.startsWith(href) : false;
        const className = `flex min-w-[64px] flex-1 flex-col items-center gap-0.5 rounded-lg px-1 py-1 font-semibold ${
          active ? "bg-white/10 text-white" : "text-[#9BADC8]"
        }`;
        if (!href) {
          return (
            <span key={key} aria-disabled="true" title={PENDING_NOTE} className={`${className} opacity-45`}>
              <AdminIcon name={icon} size={18} />
              <span className="truncate">{label}</span>
            </span>
          );
        }
        return (
          <Link key={key} href={href} aria-current={active ? "page" : undefined} className={className}>
            <AdminIcon name={icon} size={18} />
            <span className="truncate">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
