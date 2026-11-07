// Order detail drawer — port of buildgrid-seller-dashboard.html's `openDr()`
// (line 293) and `.dr`/`.scrim` (CSS lines 64-66): slide-in panel with
// buyer/vehicle info, payout breakdown and timeline.
"use client";

import Pill from "@/components/ui/Pill";
import Button from "@/components/ui/Button";
import CategoryThumb from "./CategoryThumb";
import SellerIcon from "./SellerIcon";
import { useSellerStore } from "./SellerStoreProvider";
import { ORDER_STATUS } from "@/lib/seller/status";
import { COMMISSION_RATE, LATE_PENALTY_RATE, REVIEW_WINDOW_HOURS, orderItemValue, deliveryFee, netPayout } from "@/lib/seller/rules";
import type { SellerOrder } from "@/lib/seller/types";

function inr(n: number): string {
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}

export default function OrderDrawer({
  order,
  onClose,
  onDispatch,
  onReject,
}: {
  order: SellerOrder | null;
  onClose: () => void;
  onDispatch: (order: SellerOrder) => void;
  onReject: (order: SellerOrder) => void;
}) {
  const { state, acceptOrder, markPacked } = useSellerStore();
  if (!order) return null;

  const vehicle = order.vehicleId ? state.vehicles.find((v) => v.id === order.vehicleId) : undefined;
  const driver = vehicle ? state.drivers.find((d) => d.id === vehicle.driverId) : undefined;
  const value = orderItemValue(order);
  const commission = Math.round(value * COMMISSION_RATE);
  const penalty = order.late ? Math.round(value * LATE_PENALTY_RATE) : 0;
  const status = ORDER_STATUS[order.status];

  return (
    <>
      <div className="fixed inset-0 z-80 bg-[rgba(5,12,24,0.5)]" onClick={onClose} />
      <aside className="fixed top-0 right-0 bottom-0 z-90 flex w-[min(480px,100%)] flex-col bg-panel shadow-card">
        <div className="flex items-start justify-between gap-2.5 border-b border-line p-4">
          <div>
            <h2 className="font-display text-lg font-bold">{order.id}</h2>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <Pill tone={status.tone}>{status.label}</Pill>
              {order.acceptByLabel && <Pill tone="warn">{order.acceptByLabel}</Pill>}
              {["accepted", "packed"].includes(order.status) && order.dispatchByLabel && (
                <Pill tone={order.late ? "bad" : "info"}>Dispatch {order.dispatchByLabel}</Pill>
              )}
              {order.status === "dispatched" && order.slot && <Pill tone="info">{order.slot}</Pill>}
              {order.status === "review" && order.reviewEndsLabel && <Pill tone="ok">Payout in {order.reviewEndsLabel}</Pill>}
              {order.status === "settled" && order.paidAtLabel && <Pill tone="ok">Paid {order.paidAtLabel}</Pill>}
              {order.status === "disputed" && <Pill tone="bad">Payout frozen</Pill>}
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="grid h-[42px] w-[42px] flex-none place-items-center rounded-xl border border-line">
            <SellerIcon name="x" />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-4">
          <div className="grid gap-3.5">
            <div className="flex items-center gap-2.5">
              <CategoryThumb category={order.productCategory} />
              <div>
                <b>{order.productName}</b>
                <span className="block text-[13px] text-muted">
                  {order.qty} {order.unit} · {Math.round(order.qty * order.weightKg).toLocaleString("en-IN")} kg · {inr(order.price)} each
                </span>
              </div>
            </div>

            {order.status === "new" && order.acceptByLabel && (
              <div className="flex items-start gap-2.5 rounded-lg border border-warn/40 bg-warn/10 p-2.5 text-sm">
                <SellerIcon name="clock" size={18} />
                <div>
                  Accept within <b>{order.acceptByLabel}</b> or this order expires and your acceptance rate drops.
                </div>
              </div>
            )}
            {["accepted", "packed"].includes(order.status) && order.dispatchByLabel && (
              <div className={`flex items-start gap-2.5 rounded-lg border p-2.5 text-sm ${order.late ? "border-bad/40 bg-bad/10" : "border-link/35 bg-link/10"}`}>
                <SellerIcon name="truck" size={18} />
                <div>
                  Dispatch {order.dispatchByLabel}. Late dispatch costs {LATE_PENALTY_RATE * 100}% of the item value.
                </div>
              </div>
            )}
            {order.status === "disputed" && order.issue && (
              <div className="flex items-start gap-2.5 rounded-lg border border-bad/40 bg-bad/10 p-2.5 text-sm">
                <SellerIcon name="alert" size={18} />
                <div>
                  <b>{order.issue.type}.</b> {order.issue.note} Claim {order.issue.claim ? inr(order.issue.claim) : ""}. Your
                  payout is frozen until an admin decides.
                </div>
              </div>
            )}

            <dl className="grid grid-cols-[130px_1fr] gap-x-2.5 gap-y-1.5 text-sm">
              <dt className="text-muted">Buyer</dt>
              <dd>
                {order.buyer}, {order.city} {order.pin}
              </dd>
              <dt className="text-muted">Ordered</dt>
              <dd>{order.createdLabel}</dd>
              {order.slot && (
                <>
                  <dt className="text-muted">Slot</dt>
                  <dd>{order.slot}</dd>
                </>
              )}
              {vehicle && (
                <>
                  <dt className="text-muted">Vehicle</dt>
                  <dd>
                    {vehicle.regNumber}, {vehicle.type}
                  </dd>
                  <dt className="text-muted">Driver</dt>
                  <dd>
                    {driver?.name} <span className="text-muted">{driver?.phone}</span>
                  </dd>
                </>
              )}
              {order.docs && (
                <>
                  <dt className="text-muted">Documents</dt>
                  <dd>
                    {[
                      order.docs.challan && "Challan",
                      order.docs.invoice && "GST invoice",
                      order.docs.eway && `E-way ${order.docs.eway}`,
                      order.docs.weighbridge && `Weighbridge ${order.docs.weighbridge}`,
                    ]
                      .filter(Boolean)
                      .join(", ")}
                  </dd>
                </>
              )}
            </dl>

            <div className="rounded-xl border border-line p-3.5">
              <h3 className="mb-2 font-semibold">Your payout</h3>
              <dl className="grid grid-cols-[1fr_auto] gap-y-1 text-sm">
                <dt>Items</dt>
                <dd className="text-right">{inr(value)}</dd>
                <dt>Delivery charge</dt>
                <dd className="text-right">{deliveryFee(order, state.rules.freeAbove, state.rules.fee) ? inr(deliveryFee(order, state.rules.freeAbove, state.rules.fee)) : "Free"}</dd>
                <dt>Commission ({COMMISSION_RATE * 100}%)</dt>
                <dd className="text-right">−{inr(commission)}</dd>
                {penalty > 0 && (
                  <>
                    <dt>Late penalty ({LATE_PENALTY_RATE * 100}%)</dt>
                    <dd className="text-right text-bad">−{inr(penalty)}</dd>
                  </>
                )}
                <dt>
                  <b>You receive</b>
                </dt>
                <dd className="text-right">
                  <b>{inr(netPayout(order, state.rules.freeAbove, state.rules.fee))}</b>
                </dd>
              </dl>
              <p className="mt-2 text-[13px] text-muted">
                {order.status === "settled"
                  ? `Released ${order.paidAtLabel}.`
                  : `Held in escrow. Released after the customer accepts and the ${REVIEW_WINDOW_HOURS}-hour review window ends.`}
              </p>
            </div>

            <div>
              <h3 className="mb-1.5 font-semibold">Timeline</h3>
              <ol className="grid gap-1.5">
                {[...order.events].reverse().map((e, i) => (
                  <li key={i} className="grid grid-cols-[100px_1fr] gap-2 border-b border-dashed border-line py-1.5 text-[13px] last:border-0">
                    <small className="text-muted">{e.at}</small>
                    <span>{e.message}</span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>

        {(order.status === "new" || ["accepted", "packed"].includes(order.status)) && (
          <div className="flex flex-wrap gap-2 border-t border-line p-4">
            {order.status === "new" && (
              <>
                <Button variant="yellow" onClick={() => acceptOrder(order.id)}>
                  Accept order
                </Button>
                <Button variant="line" onClick={() => onReject(order)}>
                  Reject
                </Button>
              </>
            )}
            {order.status === "accepted" && (
              <Button variant="line" onClick={() => markPacked(order.id)}>
                Mark packed
              </Button>
            )}
            {["accepted", "packed"].includes(order.status) && (
              <Button variant="yellow" onClick={() => onDispatch(order)}>
                Dispatch
              </Button>
            )}
          </div>
        )}
      </aside>
    </>
  );
}
