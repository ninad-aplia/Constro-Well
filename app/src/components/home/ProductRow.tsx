// Product row — port of buildgrid-shop.html's `rowSec()` / `.rowsec`,
// `.rowhead` (lines 83, 387). Server component: items are pre-fetched by the
// caller (TodaysDealsRow etc.) via the catalog API facade; this only composes
// markup. Horizontal scroll mechanics live in the client-only ScrollerRow.
//
// The prototype's live countdown ("Ends in --:--:--", ticking to local
// midnight) is intentionally omitted here: these are static mock-catalogue
// discounts that don't actually change at midnight, so a ticking countdown
// would falsely imply a real, expiring promotion. A one-line sample-data
// disclosure replaces it instead, applying to every row.
import Card from "@/components/ui/Card";
import ProductCard from "./ProductCard";
import ScrollerRow from "./ScrollerRow";
import type { ProductCardData } from "@/lib/api/catalog";

export default function ProductRow({
  title,
  items,
}: {
  title: string;
  items: ProductCardData[];
}) {
  if (items.length === 0) return null;

  return (
    <Card className="relative mb-4 px-[18px] pt-[18px] pb-2">
      <div className="mb-2.5 flex flex-wrap items-baseline gap-4">
        <h2 className="font-display text-xl font-bold">{title}</h2>
        <span className="text-xs text-muted">
          Catalogue data from the marketplace database.
        </span>
      </div>
      <ScrollerRow>
        {items.map((item) => (
          <ProductCard key={item.id} {...item} />
        ))}
      </ScrollerRow>
    </Card>
  );
}
