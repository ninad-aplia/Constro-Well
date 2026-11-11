// Order detail drawer — same prototype layout, now driven by API shipment data.
"use client";

import Pill from "@/components/ui/Pill";
import Button from "@/components/ui/Button";
import CategoryThumb from "./CategoryThumb";
import SellerIcon from "./SellerIcon";
import { ORDER_STATUS } from "@/lib/seller/status";
import { COMMISSION_RATE, LATE_PENALTY_RATE, REVIEW_WINDOW_HOURS } from "@/lib/seller/rules";
import type { SellerOrder, Vehicle, Driver } from "@/lib/seller/types";
import type { SellerRulesDto } from "@/lib/api/sellerOrderDto";

function inr(n: number): string {
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}

export default function OrderDrawer({
  order,
  vehicles,
  drivers,
  rules,
  busy,
  onClose,
  onAccept,
  onPack,
  onReject,
  onDispatch,
  onReassign,
  onMarkMissed,
}: {
  order: SellerOrder | null;
  vehicles: Vehicle[];
  drivers: Driver[];
  rules: SellerRulesDto;
  busy: boolean;
  onClose: () => void;
  onAccept: (order: SellerOrder) => void;
  onPack: (order: SellerOrder) => void;
  onReject: (order: SellerOrder) => void;
  onDispatch: (order: SellerOrder) => void;
  onReassign: (order: SellerOrder) => void;
  onMarkMissed: (order: SellerOrder) => void;
}) {
  if (!order) return null;

  const vehicle = order.vehicleId ? vehicles.find((item) => item.id === order.vehicleId) : undefined;
  const driver = vehicle ? drivers.find((item) => item.id === vehicle.driverId) : undefined;
  const value = order.itemValue ?? order.price * order.qty;
  const delivery = value > 0 && value < Number(rules.freeAbove) ? Number(rules.fee) : 0;
  const commission = Math.round(value * COMMISSION_RATE);
  const penalty = order.late ? Math.round(value * LATE_PENALTY_RATE) : 0;
  const payout = Math.max(0, value + delivery - commission - penalty);
  const status = ORDER_STATUS[order.status];

  return (
    <>
      <div className="fixed inset-0 z-80 bg-[rgba(5,12,24,0.5)]" onClick={onClose} />
      <aside className="fixed top-0 right-0 bottom-0 z-90 flex w-[min(480px,100%)] flex-col bg-panel shadow-card">
        <div className="flex items-start justify-between gap-2.5 border-b border-line p-4">
          <div>
            <h2 className="font-display text-lg font-bold">{order.orderCode ?? order.id}</h2>
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
            {(order.lines ?? [{ id: order.productId, name: order.productName, qty: order.qty, unit: order.unit, unitPrice: order.price, lineValue: value, weightKg: order.weightKg }]).map((line) => (
              <div key={line.id} className="flex items-center gap-2.5">
                <CategoryThumb category={order.productCategory} />
                <div>
                  <b>{line.name}</b>
                  <span className="block text-[13px] text-muted">
                    {line.qty} {line.unit} · {Math.round(line.qty * line.weightKg).toLocaleString("en-IN")} kg · {inr(line.unitPrice)} each
                  </span>
                </div>
              </div>
            ))}

            {order.status === "new" && order.acceptByLabel && (
              <div className="flex items-start gap-2.5 rounded-lg border border-warn/40 bg-warn/10 p-2.5 text-sm">
                <SellerIcon name="clock" size={18} />
                <div>Accept within <b>{order.acceptByLabel}</b> or this order expires and your acceptance rate drops.</div>
              </div>
            )}
            {["accepted", "packed"].includes(order.status) && order.dispatchByLabel && (
              <div className={`flex items-start gap-2.5 rounded-lg border p-2.5 text-sm ${order.late ? "border-bad/40 bg-bad/10" : "border-link/35 bg-link/10"}`}>
                <SellerIcon name="truck" size={18} />
                <div>Dispatch {order.dispatchByLabel}. Late dispatch costs {LATE_PENALTY_RATE * 100}% of the item value.</div>
              </div>
            )}
            {order.status === "disputed" && order.issue && (
              <div className="flex items-start gap-2.5 rounded-lg border border-bad/40 bg-bad/10 p-2.5 text-sm">
                <SellerIcon name="alert" size={18} />
                <div><b>{order.issue.type}.</b> {order.issue.note} Claim {order.issue.claim ? inr(order.issue.claim) : ""}. Your payout is frozen until an admin decides.</div>
              </div>
            )}
            {order.status === "failed" && (
              <div className="flex items-start gap-2.5 rounded-lg border border-bad/40 bg-bad/10 p-2.5 text-sm">
                <SellerIcon name="alert" size={18} />
                <div>
                  <b>Delivery attempt failed{order.issue ? `: ${order.issue.note}` : "."}</b> Reassign a vehicle and driver to
                  try again, or mark the shipment as missed to restore the reserved stock.
                </div>
              </div>
            )}

            <dl className="grid grid-cols-[130px_1fr] gap-x-2.5 gap-y-1.5 text-sm">
              <dt className="text-muted">Buyer</dt>
              <dd>{order.buyer}, {order.city} {order.pin}</dd>
              <dt className="text-muted">Ordered</dt>
              <dd>{order.createdLabel}</dd>
              {order.slot && (<><dt className="text-muted">Slot</dt><dd>{order.slot}</dd></>)}
              {vehicle && (
                <>
                  <dt className="text-muted">Vehicle</dt>
                  <dd>{vehicle.regNumber}, {vehicle.type}</dd>
                  <dt className="text-muted">Driver</dt>
                  <dd>{driver?.name} <span className="text-muted">{driver?.phone}</span></dd>
                </>
              )}
              {order.docs && (
                <>
                  <dt className="text-muted">Documents</dt>
                  <dd>
                    {[order.docs.challan && "Challan", order.docs.invoice && "GST invoice", order.docs.eway && `E-way ${order.docs.eway}`, order.docs.weighbridge && `Weighbridge ${order.docs.weighbridge}`].filter(Boolean).join(", ")}
                  </dd>
                </>
              )}
            </dl>

            <div className="rounded-xl border border-line p-3.5">
              <h3 className="mb-2 font-semibold">Your payout</h3>
              <dl className="grid grid-cols-[1fr_auto] gap-y-1 text-sm">
                <dt>Items</dt><dd className="text-right">{inr(value)}</dd>
                <dt>Delivery charge</dt><dd className="text-right">{delivery ? inr(delivery) : "Free"}</dd>
                <dt>Commission ({COMMISSION_RATE * 100}%)</dt><dd className="text-right">−{inr(commission)}</dd>
                {penalty > 0 && (<><dt>Late penalty ({LATE_PENALTY_RATE * 100}%)</dt><dd className="text-right text-bad">−{inr(penalty)}</dd></>)}
                <dt><b>You receive</b></dt><dd className="text-right"><b>{inr(payout)}</b></dd>
              </dl>
              <p className="mt-2 text-[13px] text-muted">
                {order.status === "settled" ? `Released ${order.paidAtLabel}.` : `Held in escrow. Released after the customer accepts and the ${REVIEW_WINDOW_HOURS}-hour review window ends.`}
              </p>
            </div>

            <div>
              <h3 className="mb-1.5 font-semibold">Timeline</h3>
              <ol className="grid gap-1.5">
                {[...order.events].reverse().map((event, index) => (
                  <li key={`${event.at}-${index}`} className="grid grid-cols-[100px_1fr] gap-2 border-b border-dashed border-line py-1.5 text-[13px] last:border-0">
                    <small className="text-muted">{event.at}</small>
                    <span>{event.message}</span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>

        {(order.status === "new" || ["accepted", "packed"].includes(order.status) || order.status === "failed") && (
          <div className="flex flex-wrap gap-2 border-t border-line p-4">
            {order.status === "new" && (
              <>
                <Button variant="yellow" disabled={busy} onClick={() => onAccept(order)}>Accept order</Button>
                <Button variant="line" disabled={busy} onClick={() => onReject(order)}>Reject</Button>
              </>
            )}
            {order.status === "accepted" && (
              <Button variant="line" disabled={busy} onClick={() => onPack(order)}>Mark packed</Button>
            )}
            {["accepted", "packed"].includes(order.status) && (
              <Button variant="yellow" disabled={busy} onClick={() => onDispatch(order)}>Dispatch</Button>
            )}
            {order.status === "failed" && (
              <>
                <Button variant="yellow" disabled={busy} onClick={() => onReassign(order)}>Reassign</Button>
                <Button variant="line" disabled={busy} onClick={() => onMarkMissed(order)}>Mark as missed</Button>
              </>
            )}
          </div>
        )}
      </aside>
    </>
  );
}
