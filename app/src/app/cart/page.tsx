// Cart page (TASK 4.4 + owner Stage-1 brief). Data/loading/error/empty
// states and all interactions live in CartView (client).
import CartView from "@/components/cart/CartView";

export const metadata = { title: "Shopping cart" };

// Fully interactive preview page, no meaningful static shell — same
// `cacheComponents` situation as /seller, /delivery, /search and /product/[id].
export const instant = false;

export default function CartPage() {
  return <CartView />;
}
