// Seller Hub sidebar — port of buildgrid-seller-dashboard.html's `.side`/`.nav`
// (CSS lines 23-30, 82). Sticky, full-height, dark-navy, icon+label nav with
// active-state left accent bar; collapses to icon-only at <=1100px (CSS
// handles the collapse, no JS breakpoint logic needed) and hides entirely at
// <=760px in favor of SellerBottomNav.
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSellerStore } from "./SellerStoreProvider";
import { getLowStockProducts, getNewOrders, getDisputedOrders } from "@/lib/seller/selectors";
import { computeScore } from "@/lib/seller/rules";
import SellerIcon from "./SellerIcon";
import { SELLER_NAV } from "@/lib/seller/nav";

export default function SellerSidebar() {
  const pathname = usePathname();
  const { state } = useSellerStore();
  const newOrders = getNewOrders(state).length;
  const lowStock = getLowStockProducts(state).length;
  const disputes = getDisputedOrders(state).length;
  const score = computeScore(state.stats);

  const badgeFor = (href: string) => {
    if (href === "/seller/orders" && newOrders) return { text: String(newOrders), tone: "bad" as const };
    if (href === "/seller/products" && lowStock) return { text: String(lowStock), tone: "neutral" as const };
    if (href === "/seller/payments" && disputes) return { text: "!", tone: "bad" as const };
    return null;
  };

  return (
    <aside className="sticky top-0 hidden h-screen flex-col gap-1 overflow-auto bg-nav p-3 text-[#E8EEF8] md:flex md:w-[72px] lg:w-[244px]">
      <div className="flex items-center gap-2.5 px-2.5 pt-0.5 pb-4">
        <span className="grid h-[34px] w-[34px] flex-none place-items-center rounded-[9px] bg-hi text-hiink">
          <SellerIcon name="box" size={20} />
        </span>
        <div className="hidden lg:block">
          <b className="block font-display text-[21px] leading-none font-bold text-white">Constro Well</b>
          <small className="text-xs text-[#9BADC8]">Seller Hub</small>
        </div>
      </div>

      <nav className="flex flex-col gap-1" aria-label="Seller Hub">
        {SELLER_NAV.map(({ href, label, icon }) => {
          const active = href === "/seller" ? pathname === "/seller" : pathname?.startsWith(href);
          const badge = badgeFor(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`relative flex items-center gap-3 rounded-[10px] px-3 py-2.5 font-semibold text-[#9BADC8] hover:bg-white/[0.07] hover:text-white md:justify-center lg:justify-start ${
                active ? "bg-white/[0.11] text-white before:absolute before:top-[9px] before:bottom-[9px] before:left-[-12px] before:w-1 before:rounded-r before:bg-hi" : ""
              }`}
            >
              <SellerIcon name={icon} />
              <span className="hidden lg:inline">{label}</span>
              {badge && (
                <span
                  className={`ml-auto rounded-[10px] px-[7px] text-xs font-bold md:absolute md:top-0.5 md:right-0.5 md:ml-0 lg:static lg:ml-auto ${
                    badge.tone === "bad" ? "bg-bad text-white" : "bg-hi text-hiink"
                  }`}
                >
                  {badge.text}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="flex-1" />

      <div className="hidden rounded-xl bg-white/[0.07] p-3 text-[13px] lg:block">
        <b className="block text-white">{state.store.name}</b>
        <span className="text-[#9BADC8]">
          {state.store.city} · Score {score}
        </span>
      </div>
    </aside>
  );
}
