// Preview order store — the Stage-2 API boundary for order placement/reading
// (prototype `DB.orders`). Today every function is an async local-storage
// shim so the components above it read exactly like REST callers; Stage 2
// swaps these bodies for `fetch("/api/v1/orders…")` with zero component
// churn. Orders created here are PREVIEW ORDERS (D14 condition 5): they live
// only in this browser, payments are never processed (D3: COD-only) and the
// text "Preview order" is shown wherever an order is created.
//
// Phones in the caller order: place the order → saveOrder; otherwise this
// module does no price math — totals come precomputed from
// lib/shop/pricing.ts via the checkout form.
import type { OrderPreview } from "@/lib/shop/types";
import { read as readLS, write as writeLS } from "@/lib/cart/store";

const ORDERS_KEY = "cw-orders";

function list(): OrderPreview[] {
  return readLS(
    ORDERS_KEY,
    (v) => (Array.isArray(v) && v.every((o) => typeof (o as OrderPreview)?.id === "string") ? (v as OrderPreview[]) : null),
    [],
  ).sort((a, b) => b.created - a.created);
}

/** Newest first, matching the Stage-2 list endpoint contract. */
export async function getOrders(): Promise<OrderPreview[]> {
  return list();
}

export async function getOrder(id: string): Promise<OrderPreview | null> {
  return list().find((o) => o.id === id) ?? null;
}

export async function saveOrder(order: OrderPreview): Promise<void> {
  writeLS(ORDERS_KEY, [...list(), order].sort((a, b) => b.created - a.created));
}

/** Prototype `simulate` action: advances one stage and stamps the time. Marks the order delivered at the last stage. */
export async function advanceOrderStage(id: string, now: number): Promise<OrderPreview | null> {
  const next = list().map((o) => {
    if (o.id !== id || o.cancelled || o.stage >= 4) return o;
    return { ...o, stage: o.stage + 1, times: [...o.times, now] };
  });
  writeLS(ORDERS_KEY, next);
  return getOrder(id);
}

/** Cancel-before-dispatch preview (TASK 5.3: real cancel restores stock server-side in Stage 2 — here nothing to restore since the preview store never decrements catalogue stock). */
export async function cancelOrder(id: string, now: number): Promise<OrderPreview | null> {
  const next = list().map((o) => (o.id === id && o.stage < 2 ? { ...o, cancelled: true, times: [...o.times, now] } : o));
  writeLS(ORDERS_KEY, next);
  return getOrder(id);
}

/**
 * Generates a demo preview-order id, retrying on an (extremely unlikely)
 * collision with an existing preview order. Plain, pure function (no
 * component/React involved) so the impure `Math.random()` call isn't
 * attributed to any component's render purity (react-hooks/purity) — it only
 * ever runs from inside CheckoutView's `place()` event handler.
 */
export function makePreviewOrderId(taken: Set<string>): string {
  let id: string;
  do {
    id = "BG-" + (100000 + Math.floor(Math.random() * 899999));
  } while (taken.has(id));
  return id;
}
