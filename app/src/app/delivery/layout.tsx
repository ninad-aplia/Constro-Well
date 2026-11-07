// Delivery Portal shell — same structure as `app/seller/layout.tsx`.
// Server Component: resolves the authenticated Driver, loads only that
// driver's shipments, then hands them to the client provider. Mutations go
// through /api/driver/jobs and are persisted in PostgreSQL.
import { redirect } from "next/navigation";
import DeliveryStoreProvider from "@/components/delivery/DeliveryStoreProvider";
import DeliverySidebar from "@/components/delivery/DeliverySidebar";
import DeliveryTopBar from "@/components/delivery/DeliveryTopBar";
import DeliveryBottomNav from "@/components/delivery/DeliveryBottomNav";
import DeliveryAccessNotice from "@/components/delivery/DeliveryAccessNotice";
import { toDeliveryState } from "@/components/delivery/driverAdapter";
import { listDriverJobs } from "@/server/orders/driverService";
import { resolveDriverForUser } from "@/server/auth/session";
import { getCurrentUser } from "@/server/auth/current";

export const instant = false;

export default async function DeliveryLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/delivery");
  if (user.role !== "driver") return <DeliveryAccessNotice user={user} />;

  const driver = await resolveDriverForUser(user);
  if (!driver) return <DeliveryAccessNotice user={user} />;

  const initialState = toDeliveryState(await listDriverJobs(driver.id));

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
