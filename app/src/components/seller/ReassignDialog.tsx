// Reassign dialog — same fields as DispatchDialog, offered only for a shipment
// whose delivery attempt already failed (status "failed"): a different
// vehicle/driver retries, a fresh OTP is generated, and the failed-attempt
// issue is cleared. Reuses the same dispatch-input shape/API endpoint style
// as the original dispatch (see `redispatchSellerShipment`).
"use client";

import { useState } from "react";
import Link from "next/link";
import Dialog from "@/components/ui/Dialog";
import Button from "@/components/ui/Button";
import SellerIcon from "./SellerIcon";
import { DELIVERY_SLOTS, EWAY_THRESHOLD } from "@/lib/seller/rules";
import type { SellerOrder } from "@/lib/seller/types";
import type { SellerDispatchInput } from "@/lib/api/sellerOrderApi";

export interface DispatchVehicle {
  id: string;
  regNumber: string;
  type: string;
  driverName: string | null;
}

export default function ReassignDialog({
  order,
  vehicles,
  busy,
  onClose,
  onReassign,
}: {
  order: SellerOrder | null;
  vehicles: DispatchVehicle[];
  busy: boolean;
  onClose: () => void;
  onReassign: (input: SellerDispatchInput) => Promise<void>;
}) {
  const [vehicleId, setVehicleId] = useState("");
  const [slot, setSlot] = useState(DELIVERY_SLOTS[0]);
  const [challan, setChallan] = useState(false);
  const [invoice, setInvoice] = useState(false);
  const [eway, setEway] = useState("");
  const [weighbridge, setWeighbridge] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [apiError, setApiError] = useState("");

  const open = order !== null;
  const vehicle = vehicleId || vehicles[0]?.id || "";
  const value = order?.itemValue ?? (order ? order.price * order.qty : 0);
  const needEway = value >= EWAY_THRESHOLD;
  const noVehicles = vehicles.length === 0;

  const close = () => {
    if (busy) return;
    setChallan(false);
    setInvoice(false);
    setEway("");
    setWeighbridge("");
    setErrors({});
    setApiError("");
    setVehicleId("");
    onClose();
  };

  const submit = async () => {
    if (!order || !order.shipmentId) return;
    const next: Record<string, string> = {};
    if (!challan) next.challan = "Attach the delivery challan";
    if (!invoice) next.invoice = "Attach the GST invoice";
    if (needEway && !/^\d{12}$/.test(eway)) next.eway = "Orders of ₹50,000 or more need a 12-digit e-way bill number";
    if (order.bulk && weighbridge.length < 3) next.weighbridge = "Bulk goods need a weighbridge slip number";
    if (!vehicle) next.vehicle = "Choose a vehicle";
    setErrors(next);
    if (Object.keys(next).length) return;

    setApiError("");
    try {
      await onReassign({ vehicleId: vehicle, slot, challan, invoice, ...(needEway ? { eway } : {}), ...(order.bulk ? { weighbridge } : {}) });
      close();
    } catch (error) {
      setApiError(error instanceof Error ? error.message : "Could not reassign this shipment.");
    }
  };

  return (
    <Dialog open={open} onClose={close} title={order ? `Reassign ${order.orderCode ?? order.id}` : undefined} wide>
      {order && (
        <div className="relative p-[22px]">
          <button type="button" onClick={close} aria-label="Close" className="absolute top-3 right-3 grid h-[34px] w-[34px] place-items-center rounded-lg bg-tint">
            <SellerIcon name="x" size={16} />
          </button>

          {noVehicles ? (
            <div className="grid gap-3">
              <h2 className="font-display text-lg font-bold">Add a vehicle first</h2>
              <p className="text-muted">You need at least one registered vehicle and driver to reassign a delivery.</p>
              <Link href="/seller/delivery" onClick={close}>
                <Button variant="yellow" wide>Go to Delivery setup</Button>
              </Link>
            </div>
          ) : (
            <form className="grid gap-3" onSubmit={(event) => { event.preventDefault(); void submit(); }}>
              <h2 className="font-display text-lg font-bold">Reassign {order.orderCode ?? order.id}</h2>
              <p className="text-sm text-muted">
                The previous delivery attempt failed. Pick a vehicle and driver to try again — a new customer OTP will be
                generated and the failed-attempt note is cleared.
              </p>

              <label className="grid gap-1 text-sm font-semibold">
                Vehicle and driver
                <select className="h-10 rounded-lg border border-line bg-panel px-2.5" value={vehicle} onChange={(event) => setVehicleId(event.target.value)}>
                  {vehicles.map((item) => <option key={item.id} value={item.id}>{item.regNumber} · {item.type} · {item.driverName ?? "No driver"}</option>)}
                </select>
                {errors.vehicle && <span className="text-[13px] font-medium text-bad">{errors.vehicle}</span>}
              </label>

              <label className="grid gap-1 text-sm font-semibold">
                Delivery slot
                <select className="h-10 rounded-lg border border-line bg-panel px-2.5" value={slot} onChange={(event) => setSlot(event.target.value)}>
                  {DELIVERY_SLOTS.map((item) => <option key={item}>{item}</option>)}
                </select>
              </label>

              <label className="flex items-start gap-2.5 rounded-lg border border-line p-2.5 has-[:checked]:border-ink has-[:checked]:bg-tint">
                <input type="checkbox" checked={challan} onChange={(event) => setChallan(event.target.checked)} className="mt-1 accent-nav" />
                <span>Attach delivery challan{errors.challan && <span className="block text-[13px] font-medium text-bad">{errors.challan}</span>}</span>
              </label>
              <label className="flex items-start gap-2.5 rounded-lg border border-line p-2.5 has-[:checked]:border-ink has-[:checked]:bg-tint">
                <input type="checkbox" checked={invoice} onChange={(event) => setInvoice(event.target.checked)} className="mt-1 accent-nav" />
                <span>Attach GST invoice{errors.invoice && <span className="block text-[13px] font-medium text-bad">{errors.invoice}</span>}</span>
              </label>

              {needEway && (
                <label className="grid gap-1 text-sm font-semibold">
                  E-way bill number (required from ₹50,000)
                  <input className="h-10 rounded-lg border border-line bg-panel px-2.5" inputMode="numeric" maxLength={12} placeholder="12 digits" value={eway} onChange={(event) => setEway(event.target.value)} />
                  {errors.eway && <span className="text-[13px] font-medium text-bad">{errors.eway}</span>}
                </label>
              )}
              {order.bulk && (
                <label className="grid gap-1 text-sm font-semibold">
                  Weighbridge slip number (required for bulk goods)
                  <input className="h-10 rounded-lg border border-line bg-panel px-2.5" placeholder="WB-20817" value={weighbridge} onChange={(event) => setWeighbridge(event.target.value)} />
                  {errors.weighbridge && <span className="text-[13px] font-medium text-bad">{errors.weighbridge}</span>}
                </label>
              )}

              {apiError && <p role="alert" className="rounded-lg border border-bad bg-panel p-2.5 text-[13px] font-medium text-bad">{apiError}</p>}
              <Button type="submit" variant="yellow" wide disabled={busy}>{busy ? "Reassigning…" : "Reassign shipment"}</Button>
            </form>
          )}
        </div>
      )}
    </Dialog>
  );
}
