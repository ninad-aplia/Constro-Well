// Checkout page (TASK 5.1 UI, owner brief Step 2). COD-only per D3; the
// interactive panel is CheckoutView (client) with prototype-ported validation.
import CheckoutView from "@/components/cart/CheckoutView";

export const metadata = { title: "Checkout" };

// Fully interactive preview page, no meaningful static shell — same
// `cacheComponents` situation as /seller, /delivery, /search and /product/[id].
export const instant = false;

export default function CheckoutPage() {
  return <CheckoutView />;
}
