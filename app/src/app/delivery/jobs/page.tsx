// /delivery/jobs — Server Component shell: parses searchParams (filter/open)
// server-side and hands them to the client DeliveryJobsView as plain props.
// See app/seller/orders/page.tsx's comment for why (avoids useSearchParams()'s
// Suspense requirement under this project's cacheComponents config).
import DeliveryJobsView from "@/components/delivery/DeliveryJobsView";

export const instant = false;

export default async function DeliveryJobsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const first = (v: string | string[] | undefined) => (Array.isArray(v) ? (v[0] ?? "") : (v ?? ""));

  return <DeliveryJobsView initialFilter={first(sp.filter) || "all"} initialOpen={first(sp.open) || null} />;
}
