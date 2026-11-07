"use client";
// Order detail + tracker — port of buildgrid-shop.html's `VIEWS_order`
// (line ~592): crumb, 5-stage tracker (done/current + timestamps), the
// labelled "Simulate next update (demo)" button (prototype `simulate` — the
// honest way to demo progression without a backend), cancel-before-dispatch
// preview, address/payment/summary columns and the order card.
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import OrderCard from "./OrderCard";
import { useCart } from "./CartProvider";
import { useToast } from "@/components/ui/Toast";
import { advanceOrderStage, cancelOrder, getOrder } from "@/lib/api/orders";
import { inr } from "@/lib/shop/format";
import { ORDER_STAGES, type OrderPreview } from "@/lib/shop/types";

const dLong = (t: number): string =>
  new Date(t).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
const dStamp = (t: number): string =>
  new Date(t).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

export default function OrderDetailView({ id }: { id: string }) {
  const [status, setStatus] = useState<"loading" | "ready" | "error" | "notfound">("loading");
  const [order, setOrder] = useState<OrderPreview | null>(null);
  const cart = useCart();
  const toast = useToast();
  const router = useRouter();

  // Pure fetch, no synchronous setState before the `.then()`/`.catch()` —
  // required for react-hooks/set-state-in-effect. The mount effect below
  // relies on the initial `useState("loading")` default instead of resetting
  // it itself; the "Try again" button's `retry()` does the explicit reset,
  // but that's a plain event handler, not an effect, so it isn't subject to
  // the same rule.
  const fetchOrder = useCallback(() => {
    return getOrder(id)
      .then((o) => {
        setOrder(o);
        setStatus(o ? "ready" : "notfound");
      })
      .catch(() => setStatus("error"));
  }, [id]);

  useEffect(() => {
    fetchOrder();
  }, [fetchOrder]);

  const retry = () => {
    setStatus("loading");
    fetchOrder();
  };

  const reorder = (pid: number, q: number) => {
    cart.add(pid, q);
    toast.show("Added to cart", { label: "Go to cart", onClick: () => router.push("/cart") });
  };

  if (status === "loading") {
    return (
      <div className="mx-auto max-w-[1200px] px-4 py-6">
        <p className="text-muted">Loading order {id}…</p>
      </div>
    );
  }
  if (status === "error") {
    return (
      <div className="mx-auto max-w-[1200px] px-4 py-6">
        <section className="rounded-xl border border-line bg-panel p-4 text-center">
          <h1 className="font-display text-xl font-bold">This order couldn’t load</h1>
          <Button className="mt-4" onClick={retry}>
            Try again
          </Button>
        </section>
      </div>
    );
  }
  if (status === "notfound" || !order) {
    return (
      <div className="mx-auto max-w-[1200px] px-4 py-6">
        <section className="rounded-xl border border-line bg-panel p-4 text-center">
          <h1 className="font-display text-xl font-bold">Order not found</h1>
          <p className="mt-1 text-muted">
            Preview orders live only in this browser — the order may have been placed on another device.
          </p>
          <Link href="/orders" className="mt-4 inline-flex min-h-10 items-center rounded-full border border-line px-4 font-semibold hover:bg-tint">
            Back to your orders
          </Link>
        </section>
      </div>
    );
  }

  const headline = order.cancelled
    ? "This order was cancelled"
    : order.stage >= 4
      ? "Delivered"
      : `Arriving ${dLong(order.eta)}`;

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-4">
      <nav aria-label="Breadcrumb" className="mb-2 text-[13px] text-muted">
        <Link href="/orders" className="text-link hover:underline">
          Your orders
        </Link>{" "}
        › Order {order.id}
      </nav>
      <h1 className="mb-3 font-display text-2xl font-bold">Order details</h1>

      <section className="mb-4 rounded-xl border border-line bg-panel p-4">
        <h2 className="font-display text-lg font-bold">{headline}</h2>
        {!order.cancelled && (
          <>
            {/* prototype `.track` — numbered stages with checkmarks + timestamps */}
            <ol className="mt-3 grid gap-2 sm:grid-cols-5">
              {ORDER_STAGES.map((s, i) => (
                <li
                  key={s}
                  className={`grid gap-1 rounded-lg border p-2.5 text-[13px] ${
                    i < order.stage
                      ? "border-line bg-tint opacity-70"
                      : i === order.stage
                        ? "border-hi bg-tint"
                        : "border-line"
                  }`}
                  aria-current={i === order.stage ? "step" : undefined}
                >
                  <span className="grid place-items-center text-hiink" aria-hidden="true">
                    {i <= order.stage ? (
                      <span className="grid h-6 w-6 place-items-center rounded-full bg-hi text-xs font-bold">✓</span>
                    ) : (
                      <span className="grid h-6 w-6 place-items-center rounded-full border border-line bg-panel text-xs">{i + 1}</span>
                    )}
                  </span>
                  <b>{s}</b>
                  <small className="text-muted">{order.times[i] ? dStamp(order.times[i]) : ""}</small>
                </li>
              ))}
            </ol>
            <div className="mt-3 flex flex-wrap gap-2">
              {order.stage < 4 && (
                <Button variant="line" onClick={() => void advanceOrderStage(order.id, Date.now()).then(setOrder)}>
                  Simulate next update (demo)
                </Button>
              )}
              {order.stage < 2 && (
                <Button variant="line" onClick={() => void cancelOrder(order.id, Date.now()).then(setOrder)}>
                  Cancel order (preview)
                </Button>
              )}
            </div>
          </>
        )}
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-line bg-panel p-4">
          <h3 className="font-display text-lg font-bold">Shipping address</h3>
          <p className="mt-1">
            {order.addr.name}
            <br />
            {order.addr.line}
            <br />
            {order.addr.city}, {order.addr.state} {order.addr.pin}
            <br />
            Phone: {order.addr.phone}
          </p>
          <h3 className="mt-3 font-display text-lg font-bold">Payment method</h3>
          <p className="mt-1">{order.pay}</p>
        </section>
        <section className="rounded-xl border border-line bg-panel p-4">
          <h3 className="font-display text-lg font-bold">Order summary</h3>
          <div className="mt-1.5 grid gap-1 text-[14px]">
            <div className="flex justify-between">
              <span>Items</span>
              <b>{inr(order.t.sub)}</b>
            </div>
            <div className="flex justify-between">
              <span>Delivery</span>
              <b>{order.t.ship ? inr(order.t.ship) : "FREE"}</b>
            </div>
            {order.t.disc > 0 && (
              <div className="flex justify-between text-ok">
                <span>Coupon {order.t.code}</span>
                <b>-{inr(order.t.disc)}</b>
              </div>
            )}
            <div className="flex justify-between border-t border-line pt-1.5">
              <span className="font-bold">Grand total</span>
              <b>{inr(order.t.total)}</b>
            </div>
            <p className="text-xs text-muted">Includes GST of {inr(order.t.gst)}</p>
          </div>
        </section>
      </div>

      <div className="mt-4">
        <OrderCard order={order} brief onReorder={reorder} />
      </div>
    </div>
  );
}
