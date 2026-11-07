// Order detail + tracking (TASK 5.3 UI). Preview orders are browser-local;
// the tracker is the prototype's 5-stage stepper, driven client-side.
import OrderDetailView from "@/components/cart/OrderDetailView";

export const metadata = { title: "Order details" };

// Fully interactive preview page (tracker, cancel, reorder), no meaningful
// static shell — same `cacheComponents` situation as /seller, /delivery,
// /search and /product/[id] under this project's next.config.ts.
export const instant = false;

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // Keyed so navigating between two different order ids (client-side) gets a
  // fresh component instance — its mount-time "loading" state then applies
  // naturally, instead of the view needing an effect to reset it on an id
  // change (same keyed-remount pattern as Seller's ProductForm).
  return <OrderDetailView key={id} id={id} />;
}
