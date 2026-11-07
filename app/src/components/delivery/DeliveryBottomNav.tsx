// Delivery Portal mobile bottom nav — same shell pattern as
// `components/seller/SellerBottomNav.tsx`.
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useDeliveryStore } from "./DeliveryStoreProvider";
import { getActiveDeliveries } from "@/lib/delivery/selectors";
import SellerIcon from "@/components/seller/SellerIcon";
import { DELIVERY_NAV } from "@/lib/delivery/nav";

export default function DeliveryBottomNav() {
  const pathname = usePathname();
  const { state } = useDeliveryStore();
  const active = getActiveDeliveries(state).length;

  return (
    <nav
      aria-label="Delivery Portal mobile"
      className="fixed inset-x-0 bottom-0 z-55 flex gap-0.5 overflow-x-auto bg-nav p-1.5 pb-[calc(0.375rem+env(safe-area-inset-bottom,0px))] md:hidden"
    >
      {DELIVERY_NAV.map(({ href, label, icon }) => {
        const isActive = href === "/delivery" ? pathname === "/delivery" : pathname?.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={isActive ? "page" : undefined}
            className={`relative grid flex-1 min-w-[66px] place-items-center gap-0.5 rounded-[10px] px-2 py-1.5 text-[11px] font-semibold ${
              isActive ? "bg-hi text-hiink" : "text-[#9BADC8]"
            }`}
          >
            <SellerIcon name={icon} size={20} />
            <span>{label}</span>
            {href === "/delivery/jobs" && active > 0 && (
              <span className="absolute top-0 right-1.5 rounded-[10px] bg-bad px-[5px] text-[11px] font-bold text-white">
                {active}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
