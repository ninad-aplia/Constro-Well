// Seller Hub Orders — port of buildgrid-seller-dashboard.html's viewOrders()
// (line 346) + orderRow() (line 343). Client Component: filter/search/drawer
// state, mutating actions all come from the shared preview store. Initial
// filter/query/open values come from the server-parsed URL (see
// app/seller/orders/page.tsx) rather than `useSearchParams()` here — that
// hook forces client-only rendering and needs a <Suspense> boundary under
// this project's cacheComponents config; passing plain props avoids it.
"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";
import Pill from "@/components/ui/Pill";
import CategoryThumb from "./CategoryThumb";
import PreviewDisclosure from "./PreviewDisclosure";
import OrderDrawer from "./OrderDrawer";
import DispatchDialog from "./DispatchDialog";
import RejectDialog from "./RejectDialog";
import { useSellerStore } from "./SellerStoreProvider";
import { ACCEPT_WINDOW_HOURS, DISPATCH_WINDOW_HOURS, deliveryFee, orderItemValue } from "@/lib/seller/rules";
import { ORDER_FILTERS, orderCount } from "@/lib/seller/selectors";
import { ORDER_STATUS } from "@/lib/seller/status";
import type { SellerOrder } from "@/lib/seller/types";

function inr(n: number): string {
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}

export default function OrdersView({
  initialFilter,
  initialQuery,
  initialOpen,
}: {
  initialFilter: string;
  initialQuery: string;
  initialOpen: string | null;
}) {
  const { state, acceptOrder } = useSellerStore();
  const [filter, setFilter] = useState(initialFilter);
  const [query, setQuery] = useState(initialQuery);
  const [drawerId, setDrawerId] = useState<string | null>(initialOpen);
  const [dispatchTarget, setDispatchTarget] = useState<SellerOrder | null>(null);
  const [rejectTarget, setRejectTarget] = useState<SellerOrder | null>(null);

  const activeFilter = ORDER_FILTERS.find((f) => f.key === filter) || ORDER_FILTERS[0];
  const q = query.trim().toLowerCase();

  let orders = state.orders.filter((o) => !activeFilter.statuses || activeFilter.statuses.includes(o.status));
  if (q) orders = orders.filter((o) => `${o.id} ${o.productName} ${o.city} ${o.buyer}`.toLowerCase().includes(q));
  orders = [...orders].sort((a, b) => (a.status === "new" ? 0 : 1) - (b.status === "new" ? 0 : 1));

  const drawerOrder = state.orders.find((o) => o.id === drawerId) || null;

  return (
    <div className="grid gap-4">
      <PreviewDisclosure />

      <div>
        <h1 className="font-display text-[clamp(25px,3vw,34px)] font-bold">Orders</h1>
        <p className="mt-1 text-muted">
          Accept within {ACCEPT_WINDOW_HOURS} hours, dispatch within {DISPATCH_WINDOW_HOURS} hours, and get paid after the
          customer&rsquo;s review window.
        </p>
      </div>

      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {ORDER_FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            aria-pressed={filter === f.key}
            onClick={() => setFilter(f.key)}
            className={`flex flex-none items-center gap-1.5 rounded-[10px] border px-3.5 py-2 text-sm font-semibold whitespace-nowrap ${
              filter === f.key ? "border-nav bg-nav text-white" : "border-line bg-panel"
            }`}
          >
            {f.label}
            <span className={`rounded-[9px] px-1.5 text-xs ${filter === f.key ? "bg-white/20" : "bg-tint"}`}>
              {orderCount(state, f.statuses)}
            </span>
          </button>
        ))}
      </div>

      {q && (
        <div className="flex items-center gap-2 rounded-lg border border-link/35 bg-link/10 p-2.5 text-sm">
          Showing results for &ldquo;{query}&rdquo;.
          <button type="button" onClick={() => setQuery("")} className="font-semibold text-link hover:underline">
            Clear
          </button>
        </div>
      )}

      <section className="overflow-hidden rounded-2xl border border-line bg-panel">
        <div className="hidden grid-cols-[100px_minmax(180px,1.6fr)_110px_1fr_140px_auto] gap-3 rounded-t-2xl bg-tint px-4 py-2.5 text-[13px] font-semibold text-muted md:grid">
          <span>Order</span>
          <span>Product</span>
          <span>Value</span>
          <span>Buyer</span>
          <span>Status</span>
          <span />
        </div>
        {orders.length === 0 ? (
          <p className="p-6 text-muted">No orders in this view.</p>
        ) : (
          orders.map((o) => {
            const status = ORDER_STATUS[o.status];
            const gross = orderItemValue(o) + deliveryFee(o, state.rules.freeAbove, state.rules.fee);
            return (
              <div
                key={o.id}
                className="grid grid-cols-1 gap-2 border-b border-line p-3.5 last:border-0 md:grid-cols-[100px_minmax(180px,1.6fr)_110px_1fr_140px_auto] md:items-center md:gap-3"
              >
                <div>
                  <b>{o.id}</b>
                  <small className="block font-normal text-muted">{o.createdLabel}</small>
                </div>
                <div className="flex items-center gap-2.5">
                  <CategoryThumb category={o.productCategory} />
                  <div>
                    <b>{o.productName}</b>
                    <span className="block text-[13px] text-muted">
                      {o.qty} {o.unit} · {Math.round(o.qty * o.weightKg).toLocaleString("en-IN")} kg
                    </span>
                  </div>
                </div>
                <div>
                  <b>{inr(gross)}</b>
                  <small className="block font-normal text-muted">
                    {deliveryFee(o, state.rules.freeAbove, state.rules.fee) ? "+ delivery" : "free delivery"}
                  </small>
                </div>
                <div className="text-[13px]">
                  {o.buyer}
                  <br />
                  <span className="text-muted">
                    {o.city} {o.pin}
                  </span>
                </div>
                <div>
                  <Pill tone={status.tone}>{status.label}</Pill>
                  <div className="mt-1 text-[13px]">{o.acceptByLabel || o.dispatchByLabel || o.slot || o.reviewEndsLabel || o.paidAtLabel}</div>
                </div>
                <div className="flex flex-wrap justify-start gap-1.5 md:justify-end">
                  {o.status === "new" && (
                    <Button size="sm" variant="yellow" onClick={() => acceptOrder(o.id)}>
                      Accept
                    </Button>
                  )}
                  {["accepted", "packed"].includes(o.status) && (
                    <Button size="sm" variant="yellow" onClick={() => setDispatchTarget(o)}>
                      Dispatch
                    </Button>
                  )}
                  <Button size="sm" variant="line" onClick={() => setDrawerId(o.id)}>
                    Details
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </section>

      <OrderDrawer
        order={drawerOrder}
        onClose={() => setDrawerId(null)}
        onDispatch={(o) => setDispatchTarget(o)}
        onReject={(o) => setRejectTarget(o)}
      />
      <DispatchDialog order={dispatchTarget} onClose={() => setDispatchTarget(null)} />
      <RejectDialog order={rejectTarget} onClose={() => setRejectTarget(null)} />
    </div>
  );
}
