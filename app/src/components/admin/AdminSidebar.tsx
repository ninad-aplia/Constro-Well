// Admin console sidebar — same shell as the seller/driver portals (dark navy,
// sticky, icon+label, icon-only at ≤1100px, hidden at ≤760px in favour of the
// bottom nav). Only implemented destinations are links; the rest are visibly
// disabled placeholders.
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import AdminIcon from "./AdminIcon";
import { ADMIN_NAV, PENDING_NOTE } from "./nav";

export default function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 hidden h-screen flex-col gap-1 overflow-auto bg-nav p-3 text-[#E8EEF8] md:flex md:w-[72px] lg:w-[244px]">
      <div className="flex items-center gap-2.5 px-2.5 pt-0.5 pb-4">
        <span className="grid h-[34px] w-[34px] flex-none place-items-center rounded-[9px] bg-hi text-hiink">
          <AdminIcon name="shield" size={20} />
        </span>
        <div className="hidden lg:block">
          <b className="block font-display text-[21px] leading-none font-bold text-white">Constro Well</b>
          <small className="text-xs text-[#9BADC8]">Admin console</small>
        </div>
      </div>

      <nav className="flex flex-col gap-1" aria-label="Admin console">
        {ADMIN_NAV.map(({ key, label, href, icon }) => {
          const active = href ? pathname?.startsWith(href) : false;
          if (!href) {
            return (
              <span
                key={key}
                aria-disabled="true"
                title={PENDING_NOTE}
                className="flex cursor-not-allowed items-center gap-3 rounded-[10px] px-3 py-2.5 font-semibold text-[#9BADC8]/60 md:justify-center lg:justify-start"
              >
                <AdminIcon name={icon} />
                <span className="hidden lg:inline">{label}</span>
              </span>
            );
          }
          return (
            <Link
              key={key}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`relative flex items-center gap-3 rounded-[10px] px-3 py-2.5 font-semibold text-[#9BADC8] hover:bg-white/[0.07] hover:text-white md:justify-center lg:justify-start ${
                active
                  ? "bg-white/[0.11] text-white before:absolute before:top-[9px] before:bottom-[9px] before:left-[-12px] before:w-1 before:rounded-r before:bg-hi"
                  : ""
              }`}
            >
              <AdminIcon name={icon} />
              <span className="hidden lg:inline">{label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="flex-1" />

      <div className="hidden rounded-xl bg-white/[0.07] p-3 text-[13px] lg:block">
        <b className="block text-white">First admin slice</b>
        <span className="text-[#9BADC8]">User overview · audited reads</span>
      </div>
    </aside>
  );
}
