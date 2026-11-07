"use client";
// Order confirmation — same prototype card, now reading the persisted order.
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import OrderCard from "./OrderCard";
import { toOrderPreview } from "./orderAdapters";
import { useSession } from "@/components/auth/SessionProvider";
import { fetchOrder } from "@/lib/api/orderApi";
import { ApiClientError } from "@/lib/api/client";
import { inr } from "@/lib/shop/format";
import type { OrderDto } from "@/lib/api/orderDto";

export default function ThanksView({ id }: { id: string }) {
  const session = useSession();
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "ready" | "notfound" | "error">("loading");
  const [order, setOrder] = useState<OrderDto | null>(null);

  useEffect(() => {
    if (session.status === "guest") router.replace(`/login?next=${encodeURIComponent(`/thanks/${id}`)}`);
  }, [session.status, router, id]);

  useEffect(() => {
    if (session.status !== "authenticated" || session.user?.role !== "customer") return;
    let cancelled = false;
    fetchOrder(id)
      .then((result) => {
        if (cancelled) return;
        setOrder(result);
        setStatus("ready");
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setStatus(error instanceof ApiClientError && error.status === 404 ? "notfound" : "error");
      });
    return () => {
      cancelled = true;
    };
  }, [session.status, session.user?.id, session.user?.role, id]);

  if (session.status === "guest") return <div className="mx-auto max-w-[1200px] px-4 py-6 text-muted">Redirecting to sign in…</div>;
  if (session.status === "authenticated" && session.user?.role !== "customer") {
    return (
      <div className="mx-auto max-w-[1200px] px-4 py-6">
        <section className="rounded-xl border border-line bg-panel p-8 text-center">
          <h1 className="font-display text-2xl font-bold">Customer account required</h1>
          <p className="mt-1 text-muted">Order confirmation is only available to customer accounts.</p>
        </section>
      </div>
    );
  }
  if (status === "loading") return <div className="mx-auto max-w-[1200px] px-4 py-6 text-muted">Loading your confirmation…</div>;
  if (status === "notfound" || !order) {
    return (
      <div className="mx-auto max-w-[1200px] px-4 py-6">
        <section className="rounded-xl border border-line bg-panel p-4 text-center">
          <h1 className="font-display text-xl font-bold">Order not found</h1>
          <Link href="/" className="mt-4 inline-flex min-h-10 items-center rounded-full bg-hi px-4 font-semibold text-hiink hover:bg-hi2">Continue shopping</Link>
        </section>
      </div>
    );
  }

  const preview = toOrderPreview(order);
  return (
    <div className="mx-auto max-w-[1200px] px-4 py-4">
      <section className="rounded-xl border border-line bg-panel p-4 text-center">
        <span className="mx-auto my-3 grid h-14 w-14 place-items-center rounded-full bg-ok text-white" aria-hidden="true">
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12.5l5 5L20 7" /></svg>
        </span>
        <h1 className="font-display text-2xl font-bold">Order placed, thank you!</h1>
        <p className="mt-1">Confirmation #<b>{order.code}</b> · Total <b>{inr(Number(order.totals.total))}</b></p>
        <p className="mt-1 text-muted">Payment: {order.paymentLabel}. We will update you as each seller packs and dispatches your items.</p>
        <div className="mt-3 flex flex-wrap justify-center gap-2">
          <Button variant="yellow" onClick={() => router.push(`/orders/${order.code}`)}>Track your order</Button>
          <Link href="/" className="inline-flex min-h-10 items-center rounded-full border border-line px-4 font-semibold hover:bg-tint">Continue shopping</Link>
        </div>
      </section>
      <div className="mt-4"><OrderCard order={preview} brief /></div>
      <p className="mt-2 text-[13px] text-muted">Order total {inr(Number(order.totals.total))} · Cash on delivery.</p>
    </div>
  );
}
