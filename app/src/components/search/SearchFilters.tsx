// Search sidebar — port of buildgrid-shop.html's `.filters`/`.fgroup`/
// `.flist`/`.fl`/`.chk` (CSS lines 101-104) and the filters markup in
// `searchBody()` (lines 441-446). Server component: every control is a plain
// link carrying the full next query string, so filtering needs no client JS
// at all (consistent with the rest of this page).
//
// Deviation (accessibility, reported): the prototype's Brand/Price/Deals
// filters are real `<input type="checkbox"/"radio">` elements; here they're
// links (since there's no client-side state to bind a real form control to
// without JS). Each renders a visual check/radio indicator plus a visually
// hidden "(selected)"/"(not selected)" state for screen readers, so the
// control's state is still announced correctly even though its role is
// "link" rather than "checkbox". Category/Rating were already `<button>`s in
// the prototype (not form controls), so the link swap there is a closer match.
import Link from "next/link";
import Stars from "@/components/ui/Stars";
import {
  PRICE_BUCKETS,
  RATING_OPTIONS,
  type SearchQuery,
  type SearchResult,
} from "@/lib/api/catalog";
import { buildSearchHref } from "./buildSearchHref";

export default function SearchFilters({
  query,
  result,
}: {
  query: SearchQuery;
  result: SearchResult;
}) {
  const clearHref = buildSearchHref(query, { cat: "All", brands: [], price: "", rating: 0 });

  return (
    <aside className="rounded-xl border border-line bg-panel p-3.5 max-[900px]:static md:sticky md:top-[130px]">
      <details open>
        <summary className="hidden cursor-pointer list-none text-base font-bold max-[900px]:block">
          Filters{result.activeFilters ? " (on)" : ""}
        </summary>

        <div className="mt-3">
          <div className="mb-4">
            <h3 className="mb-1.5 text-[15px] font-semibold">Category</h3>
            <ul className="m-0 list-none p-0">
              <li>
                <Link
                  href={buildSearchHref(query, { cat: "All", brands: [] })}
                  className={`flex items-center justify-between gap-2 rounded-md px-1.5 py-1 text-left hover:bg-tint ${
                    query.cat === "All" ? "bg-tint font-bold" : ""
                  }`}
                >
                  All categories <span className="text-xs text-muted">{result.allCategoriesCount}</span>
                </Link>
              </li>
              {result.categoryCounts.map(({ category, count }) => (
                <li key={category}>
                  <Link
                    href={buildSearchHref(query, { cat: category, brands: [] })}
                    className={`flex items-center justify-between gap-2 rounded-md px-1.5 py-1 text-left hover:bg-tint ${
                      query.cat === category ? "bg-tint font-bold" : ""
                    }`}
                  >
                    {category} <span className="text-xs text-muted">{count}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="mb-4">
            <h3 className="mb-1.5 text-[15px] font-semibold">Customer reviews</h3>
            {RATING_OPTIONS.map((r) => (
              <Link
                key={r}
                href={buildSearchHref(query, { rating: query.rating === r ? 0 : r })}
                className={`flex items-center gap-1.5 rounded-md px-1.5 py-1 hover:bg-tint ${
                  query.rating === r ? "bg-tint font-bold" : ""
                }`}
              >
                <Stars value={r} /> &amp; up
              </Link>
            ))}
          </div>

          {result.brandCounts.length > 1 && (
            <div className="mb-4">
              <h3 className="mb-1.5 text-[15px] font-semibold">Brand</h3>
              {result.brandCounts.map(({ brand, count }) => {
                const checked = query.brands.includes(brand);
                const nextBrands = checked
                  ? query.brands.filter((b) => b !== brand)
                  : [...query.brands, brand];
                return (
                  <Link
                    key={brand}
                    href={buildSearchHref(query, { brands: nextBrands })}
                    className="flex items-center gap-2 py-1 text-sm"
                  >
                    <span
                      aria-hidden="true"
                      className={`grid h-4 w-4 flex-none place-items-center rounded border text-[10px] ${
                        checked ? "border-nav bg-nav text-white" : "border-line"
                      }`}
                    >
                      {checked ? "✓" : ""}
                    </span>
                    {brand}
                    <span className="sr-only">{checked ? " (selected)" : " (not selected)"}</span>
                    <span className="ml-auto text-xs text-muted">{count}</span>
                  </Link>
                );
              })}
            </div>
          )}

          <div className="mb-4">
            <h3 className="mb-1.5 text-[15px] font-semibold">Price</h3>
            {PRICE_BUCKETS.map(({ value, label }) => {
              const checked = query.price === value;
              return (
                <Link
                  key={value || "any"}
                  href={buildSearchHref(query, { price: value })}
                  className="flex items-center gap-2 py-1 text-sm"
                >
                  <span
                    aria-hidden="true"
                    className={`grid h-4 w-4 flex-none place-items-center rounded-full border ${
                      checked ? "border-nav" : "border-line"
                    }`}
                  >
                    {checked && <span className="h-2 w-2 rounded-full bg-nav" />}
                  </span>
                  {label}
                  <span className="sr-only">{checked ? " (selected)" : ""}</span>
                </Link>
              );
            })}
          </div>

          <div className="mb-4">
            <h3 className="mb-1.5 text-[15px] font-semibold">Deals</h3>
            <Link href={buildSearchHref(query, { deal: !query.deal })} className="flex items-center gap-2 py-1 text-sm">
              <span
                aria-hidden="true"
                className={`grid h-4 w-4 flex-none place-items-center rounded border text-[10px] ${
                  query.deal ? "border-nav bg-nav text-white" : "border-line"
                }`}
              >
                {query.deal ? "✓" : ""}
              </span>
              Today’s deals (15%+ off)
              <span className="sr-only">{query.deal ? " (selected)" : " (not selected)"}</span>
            </Link>
          </div>

          {result.activeFilters && (
            <Link
              href={clearHref}
              className="inline-flex min-h-8 items-center justify-center rounded-lg border border-line bg-panel px-3 text-[13px] font-semibold hover:bg-tint"
            >
              Clear all filters
            </Link>
          )}
        </div>
      </details>
    </aside>
  );
}
