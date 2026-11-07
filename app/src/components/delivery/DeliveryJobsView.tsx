// Assigned deliveries — port of buildgrid-delivery-workflow.html's driver
// assignment list (`viewDriver()` line 315). Client Component: initial
// filter/open values come from the server-parsed URL. Jobs and every action
// are scoped to the authenticated driver by the API.
"use client";

import { useState } from "react";
import Pill from "@/components/ui/Pill";
import Button from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import PreviewDisclosure from "./PreviewDisclosure";
import DeliveryJobDrawer from "./DeliveryJobDrawer";
import { useDeliveryStore } from "./DeliveryStoreProvider";
import { ASSIGNED_FILTERS, getActiveDeliveries } from "@/lib/delivery/selectors";
import { DELIVERY_STATUS } from "@/lib/delivery/status";
import { ApiClientError } from "@/lib/api/client";

function messageOf(error: unknown): string {
  return error instanceof ApiClientError ? error.message : "Could not reach the delivery service.";
}

export default function DeliveryJobsView({ initialFilter, initialOpen }: { initialFilter: string; initialOpen: string | null }) {
  const { state, busyId, acceptJob } = useDeliveryStore();
  const toast = useToast();
  const [filter, setFilter] = useState(initialFilter);
  const [query, setQuery] = useState("");
  const [drawerId, setDrawerId] = useState<string | null>(initialOpen);

  const active = getActiveDeliveries(state);
  const activeFilter = ASSIGNED_FILTERS.find((f) => f.key === filter) || ASSIGNED_FILTERS[0];
  const q = query.trim().toLowerCase();

  let jobs = active.filter((j) => !activeFilter.statuses || activeFilter.statuses.includes(j.status));
  if (q) jobs = jobs.filter((j) => `${j.id} ${j.orderCode} ${j.productName} ${j.city} ${j.buyer}`.toLowerCase().includes(q));

  const drawerJob = state.jobs.find((j) => j.shipmentId === drawerId || j.id === drawerId) || null;

  const accept = async (job: (typeof state.jobs)[number]) => {
    try {
      await acceptJob(job);
    } catch (error) {
      toast.show(messageOf(error));
    }
  };

  return (
    <div className="grid gap-4">
      <PreviewDisclosure />

      <div>
        <h1 className="font-display text-[clamp(25px,3vw,34px)] font-bold">Assigned deliveries</h1>
        <p className="mt-1 text-muted">Shipments a seller has dispatched to you, waiting to be delivered.</p>
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
            const status = DELIVERY_STATUS[j.status];
            return (
              <div key={j.shipmentId} className="grid grid-cols-1 gap-2.5 rounded-2xl border border-line bg-panel p-3.5 md:grid-cols-[1fr_auto] md:items-center">
                <div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <b>{j.id}</b>
                    <Pill tone={status.tone}>{status.label}</Pill>
                    {j.accepted && <Pill tone="ok">Accepted</Pill>}
                  </div>
                  <div className="mt-1 text-[13px] text-muted">
                    {j.productName} · {j.qty} {j.unit} · to {j.buyer}, {j.city} {j.pin}
                  </div>
                  <div className="mt-1 text-[13px] text-muted">
                    {j.vehicleReg ? `${j.vehicleReg}${j.vehicleType ? ` · ${j.vehicleType}` : ""}` : "No vehicle"} {j.slot ? `· ${j.slot}` : ""}
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5 md:justify-end">
                  {j.status === "dispatched" && !j.accepted && (
                    <Button size="sm" variant="line" disabled={busyId === j.shipmentId} onClick={() => void accept(j)}>
                      Accept job
                    </Button>
                  )}
                  <Button size="sm" variant="yellow" onClick={() => setDrawerId(j.shipmentId)}>
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
