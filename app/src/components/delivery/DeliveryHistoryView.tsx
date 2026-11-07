// Delivery history — shipments this store has already delivered (review,
// disputed or settled). Not present as its own screen in the prototype
// (whose driver tab only lists dispatched/failed shipments), but requested
// explicitly for this portal; built from the same `DeliveryJob[]` rather
// than inventing separate fixtures. Deliberately shows delivery outcomes
// (quantity delivered, dispute status) and not payout/commission math —
// that figure belongs to the Seller Hub's Payments tab, not duplicated here.
"use client";

import { useState } from "react";
import Pill from "@/components/ui/Pill";
import Button from "@/components/ui/Button";
import PreviewDisclosure from "./PreviewDisclosure";
import DeliveryJobDrawer from "./DeliveryJobDrawer";
import { useDeliveryStore } from "./DeliveryStoreProvider";
import { HISTORY_FILTERS, getDeliveryHistory } from "@/lib/delivery/selectors";
import { DELIVERY_STATUS } from "@/lib/delivery/status";

type SortKey = "recent" | "status";

export default function DeliveryHistoryView({ initialFilter }: { initialFilter: string }) {
  const { state } = useDeliveryStore();
  const [filter, setFilter] = useState(initialFilter);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("recent");
  const [drawerId, setDrawerId] = useState<string | null>(null);

  const history = getDeliveryHistory(state);
  const activeFilter = HISTORY_FILTERS.find((f) => f.key === filter) || HISTORY_FILTERS[0];
  const q = query.trim().toLowerCase();

  let jobs = history.filter((j) => !activeFilter.statuses || activeFilter.statuses.includes(j.status));
  if (q) jobs = jobs.filter((j) => `${j.id} ${j.productName} ${j.city} ${j.buyer}`.toLowerCase().includes(q));
  if (sort === "status") jobs = [...jobs].sort((a, b) => a.status.localeCompare(b.status));

  const drawerJob = history.find((j) => j.shipmentId === drawerId || j.id === drawerId) || null;

  return (
    <div className="grid gap-4">
      <PreviewDisclosure />

      <div>
        <h1 className="font-display text-[clamp(25px,3vw,34px)] font-bold">Delivery history</h1>
        <p className="mt-1 text-muted">Shipments this store has already delivered, whether confirmed, disputed or paid out.</p>      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {HISTORY_FILTERS.map((f) => (
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
                {f.statuses ? history.filter((j) => f.statuses!.includes(j.status)).length : history.length}
              </span>
            </button>
          ))}
        </div>
        <input
          type="search"
          placeholder="Search by order ID, product, buyer or city"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="h-10 min-w-[200px] flex-1 rounded-lg border border-line bg-panel px-3 text-sm"
          aria-label="Search delivery history"
        />
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          className="h-10 rounded-lg border border-line bg-panel px-2.5 text-sm"
          aria-label="Sort history"
        >
          <option value="recent">Most recent</option>
          <option value="status">By status</option>
        </select>
      </div>

      {jobs.length === 0 ? (
        <p className="rounded-2xl border border-line bg-panel p-6 text-center text-muted">No deliveries in this view.</p>
      ) : (        <div className="grid gap-2.5">
          {jobs.map((j) => {
            const status = DELIVERY_STATUS[j.status];
            return (
              <div key={j.shipmentId} className="grid grid-cols-1 gap-2.5 rounded-2xl border border-line bg-panel p-3.5 md:grid-cols-[1fr_auto] md:items-center">
                <div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <b>{j.id}</b>
                    <Pill tone={status.tone}>{status.label}</Pill>
                  </div>
                  <div className="mt-1 text-[13px] text-muted">
                    {j.productName} · {j.deliveredQty ?? j.qty} of {j.qty} {j.unit} · {j.buyer}, {j.city}
                  </div>
                  <div className="mt-1 text-[13px] text-muted">
                    {j.deliveredAtLabel ? `Delivered ${j.deliveredAtLabel}` : ""}
                    {j.paidAtLabel ? ` · Paid ${j.paidAtLabel}` : ""}
                  </div>
                </div>
                <Button size="sm" variant="line" onClick={() => setDrawerId(j.shipmentId)}>
                  Details
                </Button>
              </div>
            );
          })}
        </div>
      )}

      <DeliveryJobDrawer job={drawerJob} onClose={() => setDrawerId(null)} />
    </div>
  );
}
