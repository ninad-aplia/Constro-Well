// Delivery Portal shell — same structure as `app/seller/layout.tsx`: fetches
// the initial preview state once via the facade, then hands it to the
// client-side DeliveryStoreProvider, which owns every subsequent mutation
// (confirm delivery / mark failed attempt are local preview state only —
// see DeliveryStoreProvider's header comment).
import DeliveryStoreProvider from "@/components/delivery/DeliveryStoreProvider";
import DeliverySidebar from "@/components/delivery/DeliverySidebar";
import DeliveryTopBar from "@/components/delivery/DeliveryTopBar";
import DeliveryBottomNav from "@/components/delivery/DeliveryBottomNav";
import { getDeliveryState } from "@/lib/api/delivery";

// Every Delivery Portal page is a fully interactive preview (filters,
// drawers, forms) with no meaningful static shell — same situation as
// /seller under this project's `cacheComponents` config.
export const instant = false;

export default async function DeliveryLayout({ children }: { children: React.ReactNode }) {
  const initialState = await getDeliveryState();

  return (
    <DeliveryStoreProvider initialState={initialState}>
      <div className="min-h-screen bg-bg text-ink md:grid md:grid-cols-[72px_minmax(0,1fr)] lg:grid-cols-[244px_minmax(0,1fr)]">
        <DeliverySidebar />
        <div className="min-w-0">
          <DeliveryTopBar />
          <main className="mx-auto max-w-[1500px] px-3.5 py-5 pb-24 md:px-6 md:pb-8" tabIndex={-1}>
            {children}
          </main>
        </div>
      </div>
      <DeliveryBottomNav />
    </DeliveryStoreProvider>
  );
}
