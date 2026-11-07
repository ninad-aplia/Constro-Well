// Seller Hub state-level aggregates, ported from buildgrid-seller-dashboard.html
// (`balance`, `lowStock`, `cnt`, top-products/needs-attention logic in
// `viewOverview`). Pure functions of `SellerState` — no React, no mock data
// import (the state is passed in).
import { netPayout } from "./rules";
import type { SellerOrder, SellerOrderStatus, SellerProduct, SellerState } from "./types";

export const ORDER_FILTERS: { key: string; label: string; statuses: SellerOrderStatus[] | null }[] = [
  { key: "all", label: "All", statuses: null },
  { key: "new", label: "New", statuses: ["new"] },
  { key: "todo", label: "To dispatch", statuses: ["accepted", "packed"] },
  { key: "road", label: "On the road", statuses: ["dispatched", "failed"] },
  { key: "review", label: "In review", statuses: ["review"] },
  { key: "issue", label: "Issues", statuses: ["disputed", "missed", "rejected"] },
  { key: "done", label: "Paid", statuses: ["settled"] },
];

export function orderCount(state: SellerState, statuses: SellerOrderStatus[] | null): number {
  if (!statuses) return state.orders.length;
  return state.orders.filter((o) => statuses.includes(o.status)).length;
}

export function getBalance(state: SellerState): { available: number; pending: number; frozen: number } {
  const { freeAbove, fee } = state.rules;
  const available = state.orders
    .filter((o) => o.status === "settled" && !o.withdrawn)
    .reduce((sum, o) => sum + netPayout(o, freeAbove, fee), 0);
  const pending = state.orders
    .filter((o) => ["review", "dispatched", "failed"].includes(o.status))
    .reduce((sum, o) => sum + netPayout(o, freeAbove, fee), 0);
  const frozen = state.orders
    .filter((o) => o.status === "disputed")
    .reduce((sum, o) => sum + netPayout(o, freeAbove, fee), 0);
  return { available, pending, frozen };
}

export function getLowStockProducts(state: SellerState): SellerProduct[] {
  return state.products.filter((p) => p.stock <= p.reorderLevel);
}

export function getNewOrders(state: SellerState): SellerOrder[] {
  return state.orders.filter((o) => o.status === "new");
}

export function getReadyToDispatch(state: SellerState): SellerOrder[] {
  return state.orders.filter((o) => ["accepted", "packed"].includes(o.status));
}

export function getLateOrders(state: SellerState): SellerOrder[] {
  return getReadyToDispatch(state).filter((o) => o.late);
}

export function getDisputedOrders(state: SellerState): SellerOrder[] {
  return state.orders.filter((o) => o.status === "disputed");
}

export function getNeedsAttention(state: SellerState, limit = 5): SellerOrder[] {
  return [...getNewOrders(state), ...getLateOrders(state), ...getDisputedOrders(state)].slice(0, limit);
}

export function getTopProducts(state: SellerState, limit = 5): SellerProduct[] {
  return [...state.products].sort((a, b) => b.sold - a.sold).slice(0, limit);
}

/** Sum of the last `days` entries of the daily-sales series, offset by `offset` days (prototype `rangeSum`). */
export function rangeSum(state: SellerState, days: number, offset = 0): number {
  const series = state.dailySales;
  const n = series.length;
  let sum = 0;
  for (let i = n - days - offset; i < n - offset; i++) sum += series[i] || 0;
  return sum;
}
