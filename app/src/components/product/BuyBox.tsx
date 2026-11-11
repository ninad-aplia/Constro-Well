// Buy box — port of buildgrid-shop.html's `.buy`/`buyBox()` (CSS line 115,
// markup lines 465-475). Client component. Add to cart / Buy now still use the
// browser-side cart preview (cart/checkout APIs are out of this task), while
// the price, stock, minimum quantity and lead time come from the selected
// PostgreSQL seller offer.
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Stepper from "@/components/ui/Stepper";
import Button from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { useSession } from "@/components/auth/SessionProvider";
import { useRemoteCart } from "@/components/cart/RemoteCartProvider";
import { ApiClientError } from "@/lib/api/client";
import { fmt } from "@/lib/shop/format";
import { bulkTier } from "@/lib/shop/pricing";

export default function BuyBox({
  id,
  offerId,
  price,
  bulkTiers,
  unit,
  sellerName,
  minOrderQty = 1,
  stock,
  leadTimeDays,
}: {
  id: number;
  offerId: string;
  price: number;
  bulkTiers?: [number, number][];
  unit: string;
  sellerName: string;
  minOrderQty?: number;
  stock?: number;
  leadTimeDays?: number;
}) {
  const [qty, setQty] = useState(minOrderQty);
  const [adding, setAdding] = useState(false);
  const tier = bulkTier(qty, bulkTiers);
  const unitPrice = Math.round(price * (1 - (tier ? tier[1] : 0) / 100));
  const cart = useRemoteCart();
  const session = useSession();
  const toast = useToast();
  const router = useRouter();

  const addToCart = async (goCheckout: boolean) => {
    if (session.status === "loading" || adding) return;
    if (!session.user) {
      router.push(`/login?next=${encodeURIComponent(`/product/${id}`)}`);
      return;
    }
    if (session.user.role !== "customer") {
      toast.show("Sign in with a customer account to add items");
      return;
    }

    setAdding(true);
    try {
      await cart.add(offerId, qty);
      setQty(minOrderQty);
      if (goCheckout) {
        router.push("/cart");
        return;
      }
      toast.show("Added to cart", { label: "Go to cart", onClick: () => router.push("/cart") });
    } catch (error) {
      toast.show(error instanceof ApiClientError ? error.message : "Could not add to cart");
    } finally {
      setAdding(false);
    }
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
      <p className="text-[13px] text-muted">
        {stock === undefined ? "Availability from seller listing" : `${stock} in stock`}
        {minOrderQty > 1 ? ` · Min order ${minOrderQty}` : ""}
        {leadTimeDays !== undefined
          ? ` · Delivery in ${leadTimeDays} day${leadTimeDays === 1 ? "" : "s"}`
          : ""}
      </p>

      <label className="flex items-center gap-2.5 font-semibold">
        Quantity
        <Stepper
          value={qty}
          onChange={setQty}
          min={minOrderQty}
          max={stock === undefined ? undefined : Math.max(stock, minOrderQty)}
        />
      </label>

      <Button variant="yellow" pill wide onClick={() => void addToCart(false)} disabled={adding}>
        {adding ? "Adding…" : "Add to cart"}
      </Button>
      <Button variant="orange" pill wide onClick={() => void addToCart(true)} disabled={adding}>
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

      <p className="text-xs text-muted">Price and availability from the seller listing.</p>
    </div>
  );
}
