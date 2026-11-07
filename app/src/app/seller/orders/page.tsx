// /seller/orders — Server Component shell: parses searchParams (filter/q/open)
// server-side and hands them to the client OrdersView as plain props. See
// OrdersView's header comment for why (avoids useSearchParams()'s Suspense
// requirement for a few initial-state values).
import OrdersView from "@/components/seller/OrdersView";

// Reads deep-link searchParams (filter/q/open), so there's no meaningful
// static shell — same `instant = false` fix as /search and /product/[id].
// (The seller layout also sets this, but it doesn't cascade to this specific
// per-page diagnostic — each dynamic page needs its own.)
export const instant = false;

export default async function SellerOrdersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const first = (v: string | string[] | undefined) => (Array.isArray(v) ? (v[0] ?? "") : (v ?? ""));

  return (
    <OrdersView
      initialFilter={first(sp.filter) || "all"}
      initialQuery={first(sp.q)}
      initialOpen={first(sp.open) || null}
    />
  );
}
