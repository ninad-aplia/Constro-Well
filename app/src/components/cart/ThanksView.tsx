"use client";
// "Order placed, thank you!" — port of buildgrid-shop.html's `VIEWS_thanks`
// (line ~577): confirmation card + the placed order card beneath it.
// Preview-only: the order stays in this browser (see lib/api/orders).
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import OrderCard from "./OrderCard";
import { useCart } from "./CartProvider";
import { getOrder } from "@/lib/api/orders";
import { inr } from "@/lib/shop/format";
import type { OrderPreview } from "@/lib/shop/types";

export default function ThanksView({ id }: { id: string }) {
  const [status, setStatus] = useState<"loading" | "ready" | "notfound" | "error">("loading");
  const [order, setOrder] = useState<OrderPreview | null>(null);
  const cart = useCart();
  const router = useRouter();

  useEffect(() => {
    getOrder(id)
      .then((o) => {
        setOrder(o);
        setStatus(o ? "ready" : "notfound");
      })
      .catch(() => setStatus("error"));
  }, [id]);

  const reorder = (pid: number, q: number) => cart.add(pid, q);

  if (status === "loading") {
    return (
      <div className="mx-auto max-w-[1200px] px-4 py-6">
        <p className="text-muted">Loading your confirmation…</p>
      </div>
    );
  }
  if (status === "notfound" || !order) {
    return (
      <div className="mx-auto max-w-[1200px] px-4 py-6">
        <section className="rounded-xl border border-line bg-panel p-4 text-center">
          <h1 className="font-display text-xl font-bold">Order not found</h1>
          <Link href="/" className="mt-4 inline-flex min-h-10 items-center rounded-full bg-hi px-4 font-semibold text-hiink hover:bg-hi2">
            Continue shopping
          </Link>
        </section>
      </div>
    );
  }
  const eta = new Date(order.eta).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" });

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-4">
      <section className="rounded-xl border border-line bg-panel p-4 text-center">
        <span className="mx-auto my-3 grid h-14 w-14 place-items-center rounded-full bg-ok text-white" aria-hidden="true">
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 12.5l5 5L20 7" />
          </svg>
        </span>
        <h1 className="font-display text-2xl font-bold">Order placed, thank you!</h1>
        <p className="mt-1">
          Confirmation #<b>{order.id}</b> · Estimated delivery <b>{eta}</b>
        </p>
        <p className="mt-1 text-muted">
          Paid with {order.pay}. We will update you as your order is packed and shipped.
        </p>
        <p className="mt-1 text-xs text-warn">
          Preview order — stored in this browser only; no payment was taken and nothing was reserved.
        </p>
        <div className="mt-3 flex flex-wrap justify-center gap-2">
          <Button variant="yellow" onClick={() => router.push(`/orders/${order.id}`)}>
            Track your order
          </Button>
          <Link href="/" className="inline-flex min-h-10 items-center rounded-full border border-line px-4 font-semibold hover:bg-tint">
            Continue shopping
          </Link>
        </div>
      </section>
      <div className="mt-4">
        <OrderCard order={order} brief onReorder={reorder} />
      </div>
      <p className="mt-2 text-[13px] text-muted">
        Order total {inr(order.t.total)} · Preview data only (D14).
      </p>
    </div>
  );
}
