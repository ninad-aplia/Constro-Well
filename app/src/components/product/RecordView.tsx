// Records this product view for "Recently viewed" (prototype `pushRecent`,
// buildgrid-shop.html:478) — the caller that the recently-viewed utility was
// built for but had no trigger point for yet, since this page didn't exist.
// Invisible: `recordRecentlyViewed` only touches localStorage, no mock-data
// import, no network/cart/order side effect.
"use client";

import { useEffect } from "react";
import { recordRecentlyViewed } from "@/lib/shop/recentlyViewed";

export default function RecordView({ id }: { id: number }) {
  useEffect(() => {
    recordRecentlyViewed(id);
  }, [id]);

  return null;
}
