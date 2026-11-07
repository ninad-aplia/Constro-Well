// Dispatch dialog — port of buildgrid-seller-dashboard.html's `dDispatch()`
// (line 248) and its `fDisp` submit validation (line 431): vehicle + slot,
// mandatory challan/GST-invoice checkboxes, e-way bill >=₹50,000, weighbridge
// slip for bulk goods, late-dispatch penalty warning.
"use client";

import { useState } from "react";
import Link from "next/link";
import Dialog from "@/components/ui/Dialog";
import Button from "@/components/ui/Button";
import SellerIcon from "./SellerIcon";
import { useSellerStore, type DispatchInput } from "./SellerStoreProvider";
import { needsEwayBill, LATE_PENALTY_RATE, DELIVERY_SLOTS, orderItemValue } from "@/lib/seller/rules";
import type { SellerOrder } from "@/lib/seller/types";

export default function DispatchDialog({ order, onClose }: { order: SellerOrder | null; onClose: () => void }) {
  const { state, dispatchOrder } = useSellerStore();
  const [vehicleId, setVehicleId] = useState("");
  const [slot, setSlot] = useState(DELIVERY_SLOTS[0]);
  const [challan, setChallan] = useState(false);
  const [invoice, setInvoice] = useState(false);
  const [eway, setEway] = useState("");
  const [weighbridge, setWeighbridge] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const open = order !== null;
  const vehicle = vehicleId || state.vehicles[0]?.id || "";
  const needEway = order ? needsEwayBill(order) : false;
  const noVehicles = state.vehicles.length === 0;

  const close = () => {
    setChallan(false);
    setInvoice(false);
    setEway("");
    setWeighbridge("");
    setErrors({});
    setVehicleId("");
    onClose();
  };

  const submit = () => {
    if (!order) return;
    const next: Record<string, string> = {};
    if (!challan) next.challan = "Attach the delivery challan";
    if (!invoice) next.invoice = "Attach the GST invoice";
    if (needEway && !/^\d{12}$/.test(eway)) next.eway = "Orders of ₹50,000 or more need a 12-digit e-way bill number";
    if (order.bulk && weighbridge.length < 3) next.weighbridge = "Bulk goods need a weighbridge slip number";
    setErrors(next);
    if (Object.keys(next).length) return;
    const input: DispatchInput = { vehicleId: vehicle, slot, challan, invoice };
    if (needEway) input.eway = eway;
    if (order.bulk) input.weighbridge = weighbridge;
    dispatchOrder(order.id, input);
    close();
  };

  return (
    <Dialog open={open} onClose={close} title={order ? `Dispatch ${order.id}` : undefined} wide>
      {order && (
        <div className="relative p-[22px]">
          <button
            type="button"
            onClick={close}
            aria-label="Close"
            className="absolute top-3 right-3 grid h-[34px] w-[34px] place-items-center rounded-lg bg-tint"
          >
            <SellerIcon name="x" size={16} />
          </button>

          {noVehicles ? (
            <div className="grid gap-3">
              <h2 className="font-display text-lg font-bold">Add a vehicle first</h2>
              <p className="text-muted">You need at least one registered vehicle and driver to dispatch.</p>
              <Link href="/seller/delivery">
                <Button variant="yellow" wide onClick={close}>
                  Go to Delivery setup
                </Button>
              </Link>
            </div>
          ) : (
            <form
              className="grid gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                submit();
              }}
            >
              <h2 className="font-display text-lg font-bold">Dispatch {order.id}</h2>
              <p className="text-sm text-muted">
                {order.productName} · {order.qty} {order.unit} · {Math.round(order.qty * order.weightKg)} kg · ₹
                {orderItemValue(order).toLocaleString("en-IN")}
              </p>

              <label className="grid gap-1 text-sm font-semibold">
                Vehicle and driver
                <select
                  className="h-10 rounded-lg border border-line bg-panel px-2.5"
                  value={vehicle}
                  onChange={(e) => setVehicleId(e.target.value)}
                >
                  {state.vehicles.map((v) => {
                    const driver = state.drivers.find((d) => d.id === v.driverId);
                    return (
                      <option key={v.id} value={v.id}>
                        {v.regNumber} · {v.type} · {driver ? driver.name : "No driver"}
                      </option>
                    );
                  })}
                </select>
              </label>

              <label className="grid gap-1 text-sm font-semibold">
                Delivery slot
                <select
                  className="h-10 rounded-lg border border-line bg-panel px-2.5"
                  value={slot}
                  onChange={(e) => setSlot(e.target.value)}
                >
                  {DELIVERY_SLOTS.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </label>

              <label className="flex items-start gap-2.5 rounded-lg border border-line p-2.5 has-[:checked]:border-ink has-[:checked]:bg-tint">
                <input type="checkbox" checked={challan} onChange={(e) => setChallan(e.target.checked)} className="mt-1 accent-nav" />
                <span>
                  Attach delivery challan (demo file)
                  {errors.challan && <span className="block text-[13px] font-medium text-bad">{errors.challan}</span>}
                </span>
              </label>
              <label className="flex items-start gap-2.5 rounded-lg border border-line p-2.5 has-[:checked]:border-ink has-[:checked]:bg-tint">
                <input type="checkbox" checked={invoice} onChange={(e) => setInvoice(e.target.checked)} className="mt-1 accent-nav" />
                <span>
                  Attach GST invoice (demo file)
                  {errors.invoice && <span className="block text-[13px] font-medium text-bad">{errors.invoice}</span>}
                </span>
              </label>

              {needEway && (
                <label className="grid gap-1 text-sm font-semibold">
                  E-way bill number (required from ₹50,000)
                  <input
                    className="h-10 rounded-lg border border-line bg-panel px-2.5"
                    inputMode="numeric"
                    maxLength={12}
                    placeholder="12 digits"
                    value={eway}
                    onChange={(e) => setEway(e.target.value)}
                  />
                  {errors.eway && <span className="text-[13px] font-medium text-bad">{errors.eway}</span>}
                </label>
              )}
              {order.bulk && (
                <label className="grid gap-1 text-sm font-semibold">
                  Weighbridge slip number (required for bulk goods)
                  <input
                    className="h-10 rounded-lg border border-line bg-panel px-2.5"
                    placeholder="WB-20817"
                    value={weighbridge}
                    onChange={(e) => setWeighbridge(e.target.value)}
                  />
                  {errors.weighbridge && <span className="text-[13px] font-medium text-bad">{errors.weighbridge}</span>}
                </label>
              )}

              {order.late && (
                <div className="flex items-start gap-2.5 rounded-lg border border-warn/40 bg-warn/10 p-2.5 text-sm">
                  <SellerIcon name="alert" size={18} />
                  <div>This dispatch is late, so a {LATE_PENALTY_RATE * 100}% penalty will be deducted from your payout.</div>
                </div>
              )}

              <Button type="submit" variant="yellow" wide>
                Dispatch and send OTP to customer
              </Button>
            </form>
          )}
        </div>
      )}
    </Dialog>
  );
}
