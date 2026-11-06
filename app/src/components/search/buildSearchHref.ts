// Builds a `/search` href from the current query plus overrides. Every
// prototype filter-change handler resets `state.s.page = 1` on change
// (buildgrid-shop.html:719-721, 756-760), so `page` resets to 1 by default
// here too — pass `page` explicitly (as Pagination does) to override that.
import type { SearchQuery } from "@/lib/api/catalog";

export function buildSearchHref(current: SearchQuery, overrides: Partial<SearchQuery>): string {
  const next: SearchQuery = { ...current, page: 1, ...overrides };
  const params = new URLSearchParams();
  if (next.q) params.set("q", next.q);
  if (next.cat !== "All") params.set("cat", next.cat);
  if (next.deal) params.set("deal", "1");
  if (next.sort !== "rel") params.set("sort", next.sort);
  if (next.page > 1) params.set("page", String(next.page));
  next.brands.forEach((brand) => params.append("brands", brand));
  if (next.price) params.set("price", next.price);
  if (next.rating) params.set("rating", String(next.rating));
  const qs = params.toString();
  return qs ? `/search?${qs}` : "/search";
}
