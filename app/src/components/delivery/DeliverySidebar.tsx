// Delivery Portal sidebar — same shell pattern as `components/seller/SellerSidebar.tsx`
// (sticky, dark-navy, icon+label nav, active-state accent bar), reusing the
// shared `SellerIcon` atlas rather than duplicating its SVG paths.
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useDeliveryStore } from "./DeliveryStoreProvider";
import { getActiveDeliveries } from "@/lib/delivery/selectors";
import SellerIcon from "@/components/seller/SellerIcon";
import { DELIVERY_NAV } from "@/lib/delivery/nav";

export default function DeliverySidebar() {
  const pathname = usePathname();
  const { state } = useDeliveryStore();
  const active = getActiveDeliveries(state).length;

  return (
    <aside className="sticky top-0 hidden h-screen flex-col gap-1 overflow-auto bg-nav p-3 text-[#E8EEF8] md:flex md:w-[72px] lg:w-[244px]">
      <div className="flex items-center gap-2.5 px-2.5 pt-0.5 pb-4">
        <span className="grid h-[34px] w-[34px] flex-none place-items-center rounded-[9px] bg-hi text-hiink">
          <SellerIcon name="truck" size={20} />
        </span>
        <div className="hidden lg:block">
          <b className="block font-display text-[21px] leading-none font-bold text-white">Constro Well</b>
          <small className="text-xs text-[#9BADC8]">Driver Portal</small>
        </div>
      </div>

      <nav className="flex flex-col gap-1" aria-label="Delivery Portal">
        {DELIVERY_NAV.map(({ href, label, icon }) => {
          const isActive = href === "/delivery" ? pathname === "/delivery" : pathname?.startsWith(href);
          const badge = href === "/delivery/jobs" && active ? String(active) : null;
          return (
            <Link
              key={href}
              href={href}
              aria-current={isActive ? "page" : undefined}
              className={`relative flex items-center gap-3 rounded-[10px] px-3 py-2.5 font-semibold text-[#9BADC8] hover:bg-white/[0.07] hover:text-white md:justify-center lg:justify-start ${
                isActive ? "bg-white/[0.11] text-white before:absolute before:top-[9px] before:bottom-[9px] before:left-[-12px] before:w-1 before:rounded-r before:bg-hi" : ""
              }`}
            >
              <SellerIcon name={icon} />
              <span className="hidden lg:inline">{label}</span>
              {badge && (
                <span className="ml-auto rounded-[10px] bg-hi px-[7px] text-xs font-bold text-hiink md:absolute md:top-0.5 md:right-0.5 md:ml-0 lg:static lg:ml-auto">
                  {badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="flex-1" />

      <div className="hidden rounded-xl bg-white/[0.07] p-3 text-[13px] lg:block">
        <b className="block text-white">{state.storeName}</b>
        <span className="text-[#9BADC8]">{state.driverName}</span>
      </div>
    </aside>
  );
}
