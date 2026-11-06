// /search — Search / Category Results page, port of buildgrid-shop.html's
// VIEWS_search / searchBody (lines 419-452): `.shead`/`.slayout`/`.pgrid`/
// `.pad.center` CSS (lines 53, 87, 100-101, 139). Server Component: all
// filtering, faceting, sorting and pagination happens in the `searchProducts`
// API facade (mock-data access stays there); this page only parses the URL
// and composes markup. Sidebar facets and pagination are plain links — no
// client JS needed to filter or page; only the sort control needs one.
import Link from "next/link";
import ProductCard from "@/components/home/ProductCard";
import SearchFilters from "@/components/search/SearchFilters";
import SortSelect from "@/components/search/SortSelect";
import Pagination from "@/components/search/Pagination";
import { buildSearchHref } from "@/components/search/buildSearchHref";
import { searchProducts, type SearchQuery, type SortOrder } from "@/lib/api/catalog";

// Every part of this page's content (title, filters, grid, pagination)
// depends on `searchParams`, so there's no meaningful static shell to stream
// behind a <Suspense> boundary — opting into blocking rendering (Next's own
// suggested fix for this exact case) is correct here, not a workaround.
export const instant = false;

const SORT_ORDERS: readonly SortOrder[] = ["rel", "low", "high", "rating", "deal"];

const SORT_LABELS: Record<SortOrder, string> = {
  rel: "Featured",
  low: "Price: low to high",
  high: "Price: high to low",
  rating: "Avg. customer review",
  deal: "Biggest discount",
};

type RawParam = string | string[] | undefined;

function first(value: RawParam): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

function list(value: RawParam): string[] {
  return Array.isArray(value) ? value : value ? [value] : [];
}

function parseQuery(raw: Record<string, RawParam>): SearchQuery {
  const sortRaw = first(raw.sort) as SortOrder;
  const pageRaw = Number(first(raw.page));
  // Accept both `brands` (this page's own canonical output format — every
  // link `buildSearchHref` generates uses it) and `brands[]` (the approved
  // spec's parameter name). Next.js doesn't parse `[]` as array syntax — a
  // `brands[]=A&brands[]=B` URL arrives as the literal key `"brands[]"`, so
  // both keys must be read and merged, or those links would silently lose
  // their brand filter.
  const brands = [...new Set([...list(raw.brands), ...list(raw["brands[]"])])];
  return {
    q: first(raw.q).trim(),
    cat: first(raw.cat) || "All",
    deal: first(raw.deal) === "1",
    sort: SORT_ORDERS.includes(sortRaw) ? sortRaw : "rel",
    page: Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : 1,
    brands,
    price: first(raw.price),
    rating: Number(first(raw.rating)) || 0,
  };
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, RawParam>>;
}) {
  const query = parseQuery(await searchParams);
  const result = await searchProducts(query);
  const sortOptions = SORT_ORDERS.map((value) => ({
    value,
    label: SORT_LABELS[value],
    href: buildSearchHref(query, { sort: value }),
  }));

  return (
    <div className="mx-auto max-w-[1500px] px-4 py-6">
      <div className="mb-3.5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold">{result.title}</h1>
          <p className="text-sm text-muted" aria-live="polite">
            {result.total ? `${result.from}–${result.to} of ${result.total} results` : "No results"}
          </p>
        </div>
        <SortSelect value={query.sort} options={sortOptions} />
      </div>

      <div className="grid grid-cols-[240px_minmax(0,1fr)] items-start gap-4 max-[900px]:grid-cols-1">
        <SearchFilters query={query} result={result} />

        <div>
          {result.items.length ? (
            <>
              <p className="mb-3 text-xs text-muted">
                Sample catalogue data for preview — not live prices or availability.
              </p>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(210px,1fr))] gap-3.5">
                {result.items.map((item) => (
                  <ProductCard key={item.id} {...item} layout="grid" />
                ))}
              </div>
              <Pagination query={query} page={result.page} pages={result.pages} />
            </>
          ) : (
            <section className="grid justify-items-center gap-2.5 rounded-xl border border-line bg-panel px-5 py-10 text-center">
              <h2 className="font-display text-lg font-bold">No results found</h2>
              <p className="text-muted">
                Try fewer filters or a different word, such as “cement”, “TMT” or “tiles”.
              </p>
              {result.activeFilters && (
                <Link
                  href={buildSearchHref(query, { cat: "All", brands: [], price: "", rating: 0 })}
                  className="inline-flex min-h-10 items-center justify-center rounded-full bg-hi px-[18px] font-semibold text-hiink hover:bg-hi2"
                >
                  Clear filters
                </Link>
              )}
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
