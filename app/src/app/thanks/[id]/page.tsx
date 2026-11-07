// Order confirmation preview (prototype `VIEWS_thanks`). The placed order is
// browser-local; the page states that clearly on-screen.
import ThanksView from "@/components/cart/ThanksView";

export const metadata = { title: "Order placed" };

// Fully interactive preview page, no meaningful static shell — same
// `cacheComponents` situation as /seller, /delivery, /search and /product/[id].
export const instant = false;

export default async function ThanksPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ThanksView id={id} />;
}
