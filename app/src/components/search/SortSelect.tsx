// Sort dropdown — port of buildgrid-shop.html's `.sortl`/`#sort` `<select>`
// (searchBody(), line 448). The only Client Component on this page: a native
// `<select>` can't auto-submit a GET form without JS on `onChange`. Receives
// each option's destination href precomputed by the server (via
// buildSearchHref) rather than calling `useSearchParams()` itself — that hook
// requires a <Suspense> boundary under this project's cacheComponents config;
// plain `useRouter().push()` with a server-supplied href doesn't.
"use client";

import { useRouter } from "next/navigation";
import type { SortOrder } from "@/lib/api/catalog";

export default function SortSelect({
  value,
  options,
}: {
  value: SortOrder;
  options: { value: SortOrder; label: string; href: string }[];
}) {
  const router = useRouter();

  return (
    <label className="flex items-center gap-2 font-semibold">
      Sort by
      <select
        value={value}
        onChange={(e) => {
          const next = options.find((o) => o.value === e.target.value);
          if (next) router.push(next.href);
        }}
        className="h-10 rounded-lg border border-line bg-panel px-2.5 text-sm"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
