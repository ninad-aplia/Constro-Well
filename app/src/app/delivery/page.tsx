// Delivery Portal Overview — dashboard summary not present as its own screen
// in buildgrid-delivery-workflow.html (whose Admin tab has escrow KPIs, but
// that's a different role/portal), added here per this task's requirement
// for an overview/metrics screen. Built only from fields this portal already
// derives (status counts), not invented payout figures.
"use client";

import Link from "next/link";
import Card from "@/components/ui/Card";
import Pill from "@/components/ui/Pill";
import PreviewDisclosure from "@/components/delivery/PreviewDisclosure";
import { useDeliveryStore } from "@/components/delivery/DeliveryStoreProvider";
import { getActiveDeliveries, getOverviewStats, vehicleFor, driverFor } from "@/lib/delivery/selectors";
import { DELIVERY_STATUS } from "@/lib/delivery/status";

export default function DeliveryOverviewPage() {
  const { state } = useDeliveryStore();
  const stats = getOverviewStats(state);
  const active = getActiveDeliveries(state);

  return (
    <div className="grid gap-4">
      <PreviewDisclosure />

      <div>
        <h1 className="font-display text-[clamp(25px,3vw,34px)] font-bold">Delivery overview</h1>
        <p className="mt-1 text-muted">
          {state.storeName}&rsquo;s dispatched shipments, from pickup to proof of delivery. Deliveries appear here once a
          seller dispatches an order with a vehicle — manage dispatch itself in the Seller Hub.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        <Link href="/delivery/jobs?filter=road" className={`rounded-2xl border p-3.5 ${stats.onRoad ? "border-link/45 bg-link/[0.06]" : "border-line bg-panel"}`}>
          <span className="block font-display text-[28px] font-bold">{stats.onRoad}</span>
          <b>On the road</b>
          <small className="block text-muted">Awaiting OTP and proof of delivery</small>
        </Link>
        <Link href="/delivery/jobs?filter=failed" className={`rounded-2xl border p-3.5 ${stats.failed ? "border-bad/55 bg-bad/[0.06]" : "border-line bg-panel"}`}>
          <span className={`block font-display text-[28px] font-bold ${stats.failed ? "text-bad" : "text-muted"}`}>{stats.failed}</span>
          <b>Failed attempts</b>
          <small className="block text-muted">{stats.failed ? "Seller needs to reschedule" : "None"}</small>
        </Link>
        <Link href="/delivery/history?filter=review" className="rounded-2xl border border-line bg-panel p-3.5">
          <span className="block font-display text-[28px] font-bold text-muted">{stats.review}</span>
          <b>In review</b>
          <small className="block text-muted">Delivered, customer confirming</small>
        </Link>
        <Link href="/delivery/history?filter=disputed" className={`rounded-2xl border p-3.5 ${stats.disputed ? "border-bad/55 bg-bad/[0.06]" : "border-line bg-panel"}`}>
          <span className={`block font-display text-[28px] font-bold ${stats.disputed ? "text-bad" : "text-muted"}`}>{stats.disputed}</span>
          <b>Disputed</b>
          <small className="block text-muted">{stats.disputed ? "Payout frozen" : "None"}</small>
        </Link>
      </div>

      <Card rounded="lg" className="p-[18px]">
        <div className="mb-2 flex items-center justify-between gap-3.5">
          <h2 className="font-display text-lg font-bold">Assigned deliveries</h2>
          <Link href="/delivery/jobs" className="text-[13px] font-semibold text-link hover:underline">
            View all
          </Link>
        </div>
        {active.length === 0 ? (
          <p className="text-muted">Nothing on the road right now.</p>
        ) : (
          <div className="grid gap-2.5">
            {active.slice(0, 5).map((j) => {
              const vehicle = vehicleFor(state, j);
              const driver = driverFor(state, j);
              const status = DELIVERY_STATUS[j.status];
              return (
                <div key={j.id} className="flex items-center justify-between gap-2.5 border-b border-line pb-2.5 last:border-0">
                  <span>
                    <b>{j.id}</b> · {j.productName.split(",")[0]}
                    <small className="block text-muted">
                      {vehicle ? `${vehicle.regNumber} · ${driver?.name ?? "No driver"}` : "No vehicle"} · {j.city}
                    </small>
                  </span>
                  <span className="grid justify-items-end gap-1">
                    <Pill tone={status.tone}>{status.label}</Pill>
                    <Link href={`/delivery/jobs?open=${j.id}`} className="text-[13px] font-semibold text-link hover:underline">
                      Open
                    </Link>
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Card rounded="lg" className="p-[18px]">
        <h2 className="mb-2 font-display text-lg font-bold">Completed, this preview session</h2>
        <div className="grid grid-cols-3 gap-3.5 text-center">
          <div>
            <b className="block font-display text-2xl font-bold">{stats.settled}</b>
            <span className="text-[13px] text-muted">Paid out</span>
          </div>
          <div>
            <b className="block font-display text-2xl font-bold">{stats.review}</b>
            <span className="text-[13px] text-muted">In review</span>
          </div>
          <div>
            <b className={`block font-display text-2xl font-bold ${stats.disputed ? "text-bad" : ""}`}>{stats.disputed}</b>
            <span className="text-[13px] text-muted">Disputed</span>
          </div>
        </div>
      </Card>
    </div>
  );
}
