// Assigned deliveries — port of buildgrid-delivery-workflow.html's driver
// assignment list (`viewDriver()` line 315, list = dispatched + failed
// shipments). Client Component: initial filter/open values come from the
// server-parsed URL (see app/delivery/jobs/page.tsx) rather than
// `useSearchParams()` here, same reasoning as the Seller Hub's `OrdersView`.
"use client";

import { useState } from "react";
import Pill from "@/components/ui/Pill";
import Button from "@/components/ui/Button";
import PreviewDisclosure from "./PreviewDisclosure";
import DeliveryJobDrawer from "./DeliveryJobDrawer";
import { useDeliveryStore } from "./DeliveryStoreProvider";
import { ASSIGNED_FILTERS, getActiveDeliveries, vehicleFor, driverFor } from "@/lib/delivery/selectors";
import { DELIVERY_STATUS } from "@/lib/delivery/status";

export default function DeliveryJobsView({ initialFilter, initialOpen }: { initialFilter: string; initialOpen: string | null }) {
  const { state } = useDeliveryStore();
  const [filter, setFilter] = useState(initialFilter);
  const [query, setQuery] = useState("");
  const [drawerId, setDrawerId] = useState<string | null>(initialOpen);

  const active = getActiveDeliveries(state);
  const activeFilter = ASSIGNED_FILTERS.find((f) => f.key === filter) || ASSIGNED_FILTERS[0];
  const q = query.trim().toLowerCase();

  let jobs = active.filter((j) => !activeFilter.statuses || activeFilter.statuses.includes(j.status));
  if (q) jobs = jobs.filter((j) => `${j.id} ${j.productName} ${j.city} ${j.buyer}`.toLowerCase().includes(q));

  const drawerJob = active.find((j) => j.id === drawerId) || null;

  return (
    <div className="grid gap-4">
      <PreviewDisclosure />

      <div>
        <h1 className="font-display text-[clamp(25px,3vw,34px)] font-bold">Assigned deliveries</h1>
        <p className="mt-1 text-muted">Shipments a seller has dispatched with a vehicle from this store, waiting to be delivered.</p>
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {ASSIGNED_FILTERS.map((f) => (
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
                {f.statuses ? active.filter((j) => f.statuses!.includes(j.status)).length : active.length}
              </span>
            </button>
          ))}
        </div>
        <input
          type="search"
          placeholder="Search by order ID, product, buyer or city"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="h-10 min-w-[220px] flex-1 rounded-lg border border-line bg-panel px-3 text-sm"
          aria-label="Search assigned deliveries"
        />
      </div>

      {jobs.length === 0 ? (
        <p className="rounded-2xl border border-line bg-panel p-6 text-center text-muted">No deliveries in this view.</p>
      ) : (
        <div className="grid gap-2.5">
          {jobs.map((j) => {
            const vehicle = vehicleFor(state, j);
            const driver = driverFor(state, j);
            const status = DELIVERY_STATUS[j.status];
            return (
              <div key={j.id} className="grid grid-cols-1 gap-2.5 rounded-2xl border border-line bg-panel p-3.5 md:grid-cols-[1fr_auto] md:items-center">
                <div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <b>{j.id}</b>
                    <Pill tone={status.tone}>{status.label}</Pill>
                  </div>
                  <div className="mt-1 text-[13px] text-muted">
                    {j.productName} · {j.qty} {j.unit} · to {j.buyer}, {j.city} {j.pin}
                  </div>
                  <div className="mt-1 text-[13px] text-muted">
                    {vehicle ? `${vehicle.regNumber} · ${driver?.name ?? "No driver"}` : "No vehicle"} {j.slot ? `· ${j.slot}` : ""}
                  </div>
                </div>
                <div className="flex gap-1.5 md:justify-end">
                  <Button size="sm" variant="yellow" onClick={() => setDrawerId(j.id)}>
                    {j.status === "dispatched" ? "Complete delivery" : "Details"}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <DeliveryJobDrawer job={drawerJob} onClose={() => setDrawerId(null)} />
    </div>
  );
}
