// "Recently viewed by you" product row — port of buildgrid-shop.html's
// `rec.length ? rowSec(...) : ""` (line 415): renders nothing until the
// visitor has actually viewed a product. Client component: recently-viewed
// IDs only exist in localStorage, which the server can't read — resolving
// them to `ProductCardData` happens via the `getRecentlyViewedCards` Server
// Action, which keeps the mock PRODUCTS array server-side (the import below
// from `catalog.ts` is type-only, so it isn't bundled into client JS either).
//
// There is currently no `/product/[id]` page to call `recordRecentlyViewed`
// from (TASK 4.3, not started), so in this app's current state the list is
// always empty and this component renders nothing — the same empty-state
// behavior the prototype itself has, just not yet exercised. It will start
// showing real history once a product-detail page records views.
"use client";

import { useEffect, useState } from "react";
import ProductRow from "./ProductRow";
import { getRecentlyViewedIds } from "@/lib/shop/recentlyViewed";
import { getRecentlyViewedCards } from "@/lib/api/recentlyViewedAction";
import type { ProductCardData } from "@/lib/api/catalog";

export default function RecentlyViewedRow() {
  const [items, setItems] = useState<ProductCardData[]>([]);

  useEffect(() => {
    let cancelled = false;
    const ids = getRecentlyViewedIds();
    if (ids.length === 0) return;
    getRecentlyViewedCards(ids).then((resolved) => {
      if (!cancelled) setItems(resolved);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (items.length === 0) return null;
  return <ProductRow title="Recently viewed by you" items={items} />;
}
