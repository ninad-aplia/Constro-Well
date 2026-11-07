// Delivery Portal top bar — intentionally minimal: unlike the Seller Hub's
// top bar, this portal has no global search, vacation mode or notification
// feed to surface, so it's just a persistent, honest "preview" header
// (useful on mobile where the sidebar is hidden in favour of the bottom nav).
"use client";

import SellerIcon from "@/components/seller/SellerIcon";

export default function DeliveryTopBar() {
  return (
    <header className="sticky top-0 z-30 flex items-center gap-2.5 border-b border-line bg-bg/90 px-3.5 py-2.5 backdrop-blur-sm">
      <span className="grid h-9 w-9 flex-none place-items-center rounded-lg bg-nav text-hi md:hidden">
        <SellerIcon name="truck" size={18} />
      </span>
      <div>
        <b className="block leading-none">Delivery preview</b>
        <span className="text-[12px] text-muted">Sample driver workflow, not a live tracking app</span>
      </div>
    </header>
  );
}
