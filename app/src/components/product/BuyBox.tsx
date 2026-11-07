// Buy box — port of buildgrid-shop.html's `.buy`/`buyBox()` (CSS line 115,
// markup lines 465-475). Client component. Add to cart / Buy now are wired to
// the client cart store (Stage 1): the storefront cart is browser-side preview
// state (D14 condition 4 + Stage-1 rules), so this only touches client state
// and clearly-actionable navigation — order confirmation pages made from it
// say "Preview order" wherever they render one. Wishlist stays disabled.
//
// Deliberately omitted vs. the prototype (mock-data safety, D14 — same
// precedent as ProductCard): live stock count ("Only N left in stock"),
// delivery ETA/"FREE delivery by <date>", and the "Deliver to <pincode>"
// control (no pincode/zone feature exists in this app). Seller selection is
// static (first/official seller only) — switching sellers is deferred to
// Stage 2, documented in the handoff, to avoid any appearance that changing
// the displayed seller is a real reservation.
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Stepper from "@/components/ui/Stepper";
import Button from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { useCart } from "@/components/cart";
import { fmt } from "@/lib/shop/format";
import { bulkTier } from "@/lib/shop/pricing";

export default function BuyBox({
  id,
  price,
  unit,
  sellerName,
}: {
  id: number;
  price: number;
  unit: string;
  sellerName: string;
}) {
  const [qty, setQty] = useState(1);
  const tier = bulkTier(qty);
  const unitPrice = Math.round(price * (1 - (tier ? tier[1] : 0) / 100));
  const { add } = useCart();
  const toast = useToast();
  const router = useRouter();

  const addToCart = (goCheckout: boolean) => {
    // Offer index 0 = the official/first seller the buy box displays (seller
    // switching is Stage 2, see header comment). Stock clamp happens in the
    // cart store/layer where inventory data exists (mock-data-safety, D14 —
    // ProductDetail deliberately carries no stock).
    add(id, qty, 0);
    setQty(1);
    if (goCheckout) {
      router.push("/checkout");
      return;
    }
    toast.show("Added to cart", { label: "Go to cart", onClick: () => router.push("/cart") });
  };

  return (
    <div className="grid gap-2.5">
      <div>
        <span className="font-display text-[34px] font-bold tracking-[-0.02em]">
          <sup className="relative top-1 mr-0.5 text-base">₹</sup>
          {fmt(unitPrice)}
        </span>{" "}
        <span className="text-[13px] text-muted">per {unit}</span>
      </div>
      <p className="text-sm text-muted">
        {tier ? `Bulk price applied: ${tier[1]}% off` : "Inclusive of all taxes"}
      </p>

      <label className="flex items-center gap-2.5 font-semibold">
        Quantity
        <Stepper value={qty} onChange={setQty} min={1} />
      </label>

      <Button variant="yellow" pill wide onClick={() => addToCart(false)}>
        Add to cart
      </Button>
      <Button variant="orange" pill wide onClick={() => addToCart(true)}>
        Buy now
      </Button>

      <dl className="grid grid-cols-[70px_1fr] gap-x-2 gap-y-1 text-[13px]">
        <dt className="text-muted">Sold by</dt>
        <dd>{sellerName}</dd>
        <dt className="text-muted">Payment</dt>
        <dd>Cash on delivery only</dd>
        <dt className="text-muted">Returns</dt>
        <dd>7-day replacement for damaged items</dd>
      </dl>

      <Button variant="line" pill wide disabled title="Wishlist isn't implemented yet">
        Add to wish list
      </Button>

      <p className="text-xs text-muted">Sample listing for preview — not a live offer.</p>
    </div>
  );
}
