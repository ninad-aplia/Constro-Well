"use client";
// Order history — same prototype list, now read from the authenticated
// PostgreSQL order API. No localStorage order store is used.
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import OrderCard from "./OrderCard";
import { toOrderPreview } from "./orderAdapters";
import { useSession } from "@/components/auth/SessionProvider";
import { fetchOrders } from "@/lib/api/orderApi";
import { ApiClientError } from "@/lib/api/client";
import type { OrderDto } from "@/lib/api/orderDto";

export default function OrdersView() {
  const session = useSession();
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [orders, setOrders] = useState<OrderDto[]>([]);
  const [error, setError] = useState("");
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    if (session.status === "guest") router.replace("/login?next=/orders");
  }, [session.status, router]);

  useEffect(() => {
    if (session.status !== "authenticated" || session.user?.role !== "customer") return;
    let cancelled = false;
    fetchOrders()
      .then((rows) => {
        if (cancelled) return;
        setOrders(rows);
        setStatus("ready");
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof ApiClientError ? err.message : "Could not load orders.");
        setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [session.status, session.user?.id, session.user?.role, reloadToken]);

  const retry = () => {
    setStatus("loading");
    setError("");
    setReloadToken((value) => value + 1);
  };

  if (session.status === "guest") return <div className="mx-auto max-w-[1200px] px-4 py-6 text-muted">Redirecting to sign in…</div>;
  if (session.status === "authenticated" && session.user?.role !== "customer") {
    return (
      <div className="mx-auto max-w-[1200px] px-4 py-6">
        <section className="rounded-xl border border-line bg-panel p-8 text-center">
          <h1 className="font-display text-2xl font-bold">Customer account required</h1>
          <p className="mt-1 text-muted">Orders are only available to customer accounts.</p>
        </section>
      </div>
    );
  }
  if (session.status === "loading" || status === "loading") {
    return (
      <div className="mx-auto max-w-[1200px] px-4 py-6">
        <h1 className="mb-3 font-display text-2xl font-bold">Your orders</h1>
        {[0, 1].map((index) => <div key={index} className="mb-3 h-40 animate-pulse rounded-xl border border-line bg-panel" />)}
        <p className="sr-only">Loading your orders…</p>
      </div>
    );
  }
  if (status === "error") {
    return (
      <div className="mx-auto max-w-[1200px] px-4 py-6">
        <section className="rounded-xl border border-line bg-panel p-4 text-center">
          <h1 className="font-display text-xl font-bold">Your orders couldn’t load</h1>
          <p className="mt-1 text-muted">{error}</p>
          <Button className="mt-4" onClick={retry}>Try again</Button>
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
          <Link href="/" className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-full bg-hi px-4 font-semibold text-hiink hover:bg-hi2">Start shopping</Link>
        </section>
      ) : (
        orders.map((order) => <OrderCard key={order.code} order={toOrderPreview(order)} />)
      )}
    </div>
  );
}
