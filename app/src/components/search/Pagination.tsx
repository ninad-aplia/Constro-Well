// Pagination — port of buildgrid-shop.html's `.pager` (CSS line 105, markup
// in searchBody() line 447). Plain links; Previous/Next are visually
// disabled and non-interactive at the bounds via aria-disabled + tabIndex.
import Link from "next/link";
import type { SearchQuery } from "@/lib/api/catalog";
import { buildSearchHref } from "./buildSearchHref";

export default function Pagination({
  query,
  page,
  pages,
}: {
  query: SearchQuery;
  page: number;
  pages: number;
}) {
  if (pages <= 1) return null;

  return (
    <nav aria-label="Pagination" className="my-5 flex flex-wrap justify-center gap-1.5">
      <Link
        href={buildSearchHref(query, { page: Math.max(1, page - 1) })}
        aria-disabled={page <= 1}
        tabIndex={page <= 1 ? -1 : undefined}
        className={`inline-flex min-h-8 items-center justify-center rounded-lg border border-line bg-panel px-3 text-[13px] font-semibold ${
          page <= 1 ? "pointer-events-none opacity-50" : "hover:bg-tint"
        }`}
      >
        Previous
      </Link>
      {Array.from({ length: pages }, (_, i) => i + 1).map((n) => (
        <Link
          key={n}
          href={buildSearchHref(query, { page: n })}
          aria-current={page === n ? "page" : undefined}
          className={`inline-flex min-h-8 items-center justify-center rounded-lg border px-3 text-[13px] font-semibold ${
            page === n ? "border-nav bg-nav text-white" : "border-line bg-panel hover:bg-tint"
          }`}
        >
          {n}
        </Link>
      ))}
      <Link
        href={buildSearchHref(query, { page: Math.min(pages, page + 1) })}
        aria-disabled={page >= pages}
        tabIndex={page >= pages ? -1 : undefined}
        className={`inline-flex min-h-8 items-center justify-center rounded-lg border border-line bg-panel px-3 text-[13px] font-semibold ${
          page >= pages ? "pointer-events-none opacity-50" : "hover:bg-tint"
        }`}
      >
        Next
      </Link>
    </nav>
  );
}
