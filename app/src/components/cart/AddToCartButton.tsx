"use client";
// Card CTA — same action and feedback as the PDP buy box, scaled to the card.
// Rendered by the server-rendered ProductCard so only this control ships to
// the client. Availability, minimum order and stock come from the database
// via ProductCardData; the cart API re-validates all of them server-side.
import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "@/components/auth/SessionProvider";
import { useRemoteCart } from "@/components/cart/RemoteCartProvider";
import { useToast } from "@/components/ui/Toast";
import { addCardItemToCart } from "@/lib/cart/cardAddToCart";

export default function AddToCartButton({
  offerId,
  purchasable,
  minOrderQty,
}: {
  offerId?: string | null;
  purchasable?: boolean;
  minOrderQty?: number;
}) {
  const [adding, setAdding] = useState(false);
  const session = useSession();
  const cart = useRemoteCart();
  const toast = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const unavailable = !offerId || !purchasable;

  const handleClick = async () => {
    if (adding) return;
    setAdding(true);
    try {
      const result = await addCardItemToCart(
        {
          sessionStatus: session.status,
          role: session.user?.role ?? null,
          adding,
          offerId,
          purchasable,
          minOrderQty,
          nextPath: pathname,
        },
        cart.add,
      );
      if (result.status === "redirect") {
        router.push(result.href);
      } else if (result.status === "added") {
        toast.show("Added to cart", { label: "Go to cart", onClick: () => router.push("/cart") });
      } else if (result.status === "notice" || result.status === "failed") {
        toast.show(result.message);
      }
    } finally {
      setAdding(false);
    }
  };

  return (
    <button
      type="button"
      onClick={() => void handleClick()}
      disabled={adding || unavailable}
      title={unavailable ? "No seller currently has this item in stock" : undefined}
      className="mt-auto inline-flex min-h-8 items-center justify-center rounded-lg bg-hi px-3 text-[13px] font-semibold text-hiink disabled:opacity-50"
    >
      {unavailable ? "Out of stock" : adding ? "Adding…" : "Add to cart"}
    </button>
  );
}
