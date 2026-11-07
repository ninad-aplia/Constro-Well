// Seller Hub mobile bottom nav — port of buildgrid-seller-dashboard.html's
// `.bottom` (CSS line 83, shown only <=760px; `.side` is hidden at that width
// instead).
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSellerStore } from "./SellerStoreProvider";
import { getNewOrders } from "@/lib/seller/selectors";
import SellerIcon from "./SellerIcon";
import { SELLER_NAV } from "@/lib/seller/nav";

export default function SellerBottomNav() {
  const pathname = usePathname();
  const { state } = useSellerStore();
  const newOrders = getNewOrders(state).length;

  return (
    <nav
      aria-label="Seller Hub mobile"
      className="fixed inset-x-0 bottom-0 z-55 flex gap-0.5 overflow-x-auto bg-nav p-1.5 pb-[calc(0.375rem+env(safe-area-inset-bottom,0px))] md:hidden"
    >
      {SELLER_NAV.map(({ href, label, icon }) => {
        const active = href === "/seller" ? pathname === "/seller" : pathname?.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`relative grid flex-1 min-w-[66px] place-items-center gap-0.5 rounded-[10px] px-2 py-1.5 text-[11px] font-semibold ${
              active ? "bg-hi text-hiink" : "text-[#9BADC8]"
            }`}
          >
            <SellerIcon name={icon} size={20} />
            <span>{label}</span>
            {href === "/seller/orders" && newOrders > 0 && (
              <span className="absolute top-0 right-1.5 rounded-[10px] bg-bad px-[5px] text-[11px] font-bold text-white">
                {newOrders}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
