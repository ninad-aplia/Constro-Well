"use client";
// Order history — port of buildgrid-shop.html's `VIEWS_orders` (line ~585):
// order cards newest-first with the prototype empty state. Data comes from
// the preview-order boundary (lib/api/orders) — Stage 2 swaps it for the
// customer-order REST endpoints (TASK 5.3); the components don't change.
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import OrderCard from "./OrderCard";
import { useToast } from "@/components/ui/Toast";
import { useCart } from "./CartProvider";
import { getOrders } from "@/lib/api/orders";
import type { OrderPreview } from "@/lib/shop/types";

export default function OrdersView() {
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [orders, setOrders] = useState<OrderPreview[]>([]);
  const cart = useCart();
  const toast = useToast();
  const router = useRouter();

  // Pure fetch, no synchronous setState before `.then()`/`.catch()` — see
  // OrderDetailView's `fetchOrder` for the same fix/reasoning
  // (react-hooks/set-state-in-effect).
  const fetchOrders = useCallback(() => {
    return getOrders()
      .then((o) => {
        setOrders(o);
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const retry = () => {
    setStatus("loading");
    fetchOrders();
  };

  const reorder = (id: number, q: number) => {
    cart.add(id, q);
    toast.show("Added to cart", { label: "Go to cart", onClick: () => router.push("/cart") });
  };

  if (status === "loading") {
    return (
      <div className="mx-auto max-w-[1200px] px-4 py-6">
        <h1 className="mb-3 font-display text-2xl font-bold">Your orders</h1>
        {[0, 1].map((i) => (
          <div key={i} className="mb-3 h-40 animate-pulse rounded-xl border border-line bg-panel" />
        ))}
        <p className="sr-only">Loading your orders…</p>
      </div>
    );
  }
  if (status === "error") {
    return (
      <div className="mx-auto max-w-[1200px] px-4 py-6">
        <section className="rounded-xl border border-line bg-panel p-4 text-center">
          <h1 className="font-display text-xl font-bold">Your orders couldn’t load</h1>
          <Button className="mt-4" onClick={retry}>
            Try again
          </Button>
        </section>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-4">
      <h1 className="mb-3 font-display text-2xl font-bold">Your orders</h1>
      {orders.length === 0 ? (
        <section className="rounded-xl border border-line bg-panel p-4 text-center">
          <h2 className="font-display text-xl font-bold">You have no orders yet</h2>
          <p className="mt-1 text-muted">When you place an order it will show up here.</p>
          <Link href="/" className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-full bg-hi px-4 font-semibold text-hiink hover:bg-hi2">
            Start shopping
          </Link>
        </section>
      ) : (
        <>
          <p className="mb-2 text-[13px] text-muted">
            Preview orders — placed from your browser only; the real order feed arrives with the Stage-2 API.
          </p>
          {orders.map((o) => (
            <OrderCard key={o.id} order={o} onReorder={reorder} />
          ))}
        </>
      )}
    </div>
  );
}
