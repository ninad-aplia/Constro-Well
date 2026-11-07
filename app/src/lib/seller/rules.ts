// Seller Hub business rules, ported verbatim from buildgrid-seller-dashboard.html
// (`COMM`, `LATE`, `ACCEPT_H`, `DISP_H`, `REVIEW_H`, `EWAY`, `SLOTS`, `val`,
// `deliv`, `gross`, `net`, `needEway`, `score`, `tier`). Pure, framework- and
// mock-data-independent — same separation as `lib/shop/pricing.ts`.
import type { SellerOrder, SellerStats } from "./types";

export const COMMISSION_RATE = 0.05;
export const LATE_PENALTY_RATE = 0.02;
export const ACCEPT_WINDOW_HOURS = 4;
export const DISPATCH_WINDOW_HOURS = 24;
export const REVIEW_WINDOW_HOURS = 24;
export const EWAY_THRESHOLD = 50000;
export const MIN_WITHDRAWAL = 1000;

export const DELIVERY_SLOTS = ["Today, 2 to 6 pm", "Tomorrow, 8 am to 12", "Tomorrow, 2 to 6 pm"];

/** Line value before delivery fee or deductions (prototype `val`). */
export function orderItemValue(order: SellerOrder): number {
  return order.price * order.qty;
}

/** Delivery fee charged to the buyer (prototype `deliv`) — a seller-configurable free-above threshold. */
export function deliveryFee(order: SellerOrder, freeAbove: number, fee: number): number {
  return orderItemValue(order) >= freeAbove ? 0 : fee;
}

/** Order total the buyer paid (prototype `gross`). */
export function grossValue(order: SellerOrder, freeAbove: number, fee: number): number {
  return orderItemValue(order) + deliveryFee(order, freeAbove, fee);
}

/** Seller's net payout after commission and any late-dispatch penalty (prototype `net`). */
export function netPayout(order: SellerOrder, freeAbove: number, fee: number): number {
  const value = orderItemValue(order);
  const claim = order.status === "settled" && order.refund ? order.refund : 0;
  const keep = Math.max(0, value - claim);
  const commission = keep * COMMISSION_RATE;
  const penalty = order.late ? keep * LATE_PENALTY_RATE : 0;
  return Math.round(keep + deliveryFee(order, freeAbove, fee) - commission - penalty);
}

/** Whether this order requires an e-way bill number at dispatch (prototype `needEway`). */
export function needsEwayBill(order: SellerOrder): boolean {
  return orderItemValue(order) >= EWAY_THRESHOLD;
}

// The three score components, zero-guarded (an idle store with `offered`/
// `dispatched`/`delivered` all 0 reads as a perfect 100%, not NaN). Exported
// so the Performance page's metric bars use the exact same math as the
// score itself, instead of a second, easily-drifting copy of the ratios.
export function acceptanceRate(stats: SellerStats): number {
  return stats.offered ? stats.accepted / stats.offered : 1;
}
export function onTimeRate(stats: SellerStats): number {
  return stats.dispatched ? stats.ontime / stats.dispatched : 1;
}
export function issueFreeRate(stats: SellerStats): number {
  return stats.delivered ? 1 - stats.issues / stats.delivered : 1;
}

/** Delivery/performance score, 0-100 (prototype `score`): 30% acceptance + 40% on-time + 30% issue-free. */
export function computeScore(stats: SellerStats): number {
  const acceptance = acceptanceRate(stats);
  const onTime = onTimeRate(stats);
  const issueFree = issueFreeRate(stats);
  return Math.max(0, Math.min(100, Math.round(100 * (0.3 * acceptance + 0.4 * onTime + 0.3 * issueFree))));
}

/** Search-ranking tier for a given score (prototype `tier`). */
export function scoreTier(score: number): { label: string; tone: "ok" | "info" | "bad" } {
  if (score >= 90) return { label: "Boosted in search", tone: "ok" };
  if (score >= 80) return { label: "Normal visibility", tone: "info" };
  return { label: "Reduced visibility", tone: "bad" };
}
