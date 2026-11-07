// Customer order history (TASK 5.3 UI, owner brief Step 2). Preview orders
// are browser-local (lib/api/orders boundary, Stage-2 REST swap documented).
import OrdersView from "@/components/cart/OrdersView";

export const metadata = { title: "Your orders" };

// Fully interactive preview page (reads the browser-local order store), no
// meaningful static shell — same `cacheComponents` situation as /seller,
// /delivery, /search and /product/[id].
export const instant = false;

export default function OrdersPage() {
  return <OrdersView />;
}
