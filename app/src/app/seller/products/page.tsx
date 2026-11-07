// /seller/products — Server Component shell: parses searchParams
// (filter/action) server-side and hands them to the client ProductsView as
// plain props. See OrdersView's header comment for why.
import ProductsView from "@/components/seller/ProductsView";

// Reads deep-link searchParams (filter/action) — see orders/page.tsx's
// comment on why `instant = false` is needed per-page.
export const instant = false;

export default async function SellerProductsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const first = (v: string | string[] | undefined) => (Array.isArray(v) ? (v[0] ?? "") : (v ?? ""));

  return <ProductsView initialTab={first(sp.filter) === "low" ? "low" : ""} initialDialogOpen={first(sp.action) === "add"} />;
}
