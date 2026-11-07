// /delivery/history — same Server Component shell pattern as
// app/delivery/jobs/page.tsx, so Overview's `?filter=` deep links work
// without `useSearchParams()` in the client view.
import DeliveryHistoryView from "@/components/delivery/DeliveryHistoryView";

export const instant = false;

export default async function DeliveryHistoryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const first = (v: string | string[] | undefined) => (Array.isArray(v) ? (v[0] ?? "") : (v ?? ""));

  return <DeliveryHistoryView initialFilter={first(sp.filter) || "all"} />;
}
