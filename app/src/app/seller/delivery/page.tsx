// Seller Hub Delivery setup — port of buildgrid-seller-dashboard.html's
// viewDelivery() (line 366): service-area pincode chips, delivery charges +
// slot capacity, vehicles/drivers table.
"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import PreviewDisclosure from "@/components/seller/PreviewDisclosure";
import SellerIcon from "@/components/seller/SellerIcon";
import VehicleDialog from "@/components/seller/VehicleDialog";
import { useSellerStore } from "@/components/seller/SellerStoreProvider";
import { DELIVERY_SLOTS } from "@/lib/seller/rules";

export default function SellerDeliveryPage() {
  const { state, addServiceArea, removeServiceArea, saveDeliveryRules, removeVehicle } = useSellerStore();
  const [pin, setPin] = useState("");
  const [areaError, setAreaError] = useState("");
  const [freeAbove, setFreeAbove] = useState(state.rules.freeAbove);
  const [fee, setFee] = useState(state.rules.fee);
  const [slots, setSlots] = useState(state.rules.slotsPerDay);
  const [vehicleDialogOpen, setVehicleDialogOpen] = useState(false);

  return (
    <div className="grid gap-4">
      <PreviewDisclosure />

      <div>
        <h1 className="font-display text-[clamp(25px,3vw,34px)] font-bold">Delivery setup</h1>
        <p className="mt-1 text-muted">You deliver with your own vehicles. These settings control where you sell, what you charge and how many trucks you can send.</p>
      </div>

      <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-2">
        <Card rounded="lg" className="p-[18px]">
          <div className="mb-1 flex items-center justify-between gap-3.5">
            <h2 className="font-display text-lg font-bold">Service areas</h2>
            <span className="text-[13px] text-muted">{state.serviceAreas.length} pincodes</span>
          </div>
          <p className="mb-2.5 text-[13px] text-muted">Buyers only see your products if their pincode is on this list.</p>
          <div className="flex flex-wrap gap-2">
            {state.serviceAreas.map((a) => (
              <span key={a} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-tint py-[3px] pr-[3px] pl-3 text-sm font-semibold">
                {a}
                <button
                  type="button"
                  aria-label={`Remove ${a}`}
                  onClick={() => removeServiceArea(a)}
                  className="grid h-[22px] w-[22px] place-items-center rounded-full hover:bg-line"
                >
                  <SellerIcon name="x" size={12} />
                </button>
              </span>
            ))}
          </div>
          <form
            className="mt-3.5 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              setAreaError("");
              if (!addServiceArea(pin)) {
                setAreaError(state.serviceAreas.includes(pin) ? "That pincode is already on your list" : "Enter a valid 6-digit pincode");
                return;
              }
              setPin("");
            }}
          >
            <input
              className="h-10 flex-1 rounded-lg border border-line bg-panel px-2.5"
              inputMode="numeric"
              maxLength={6}
              placeholder="Add a 6-digit pincode"
              aria-label="Pincode"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
            />
            <Button type="submit" variant="yellow">
              Add
            </Button>
          </form>
          {areaError && <span className="mt-1 block text-[13px] font-medium text-bad">{areaError}</span>}
        </Card>

        <Card rounded="lg" className="p-[18px]">
          <h2 className="mb-2 font-display text-lg font-bold">Delivery charges and capacity</h2>
          <form
            className="grid gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (freeAbove < 0 || fee < 0) return;
              saveDeliveryRules({ freeAbove, fee, slotsPerDay: slots.map((s) => Math.max(0, Math.round(s))) });
            }}
          >
            <div className="grid grid-cols-2 gap-2.5">
              <label className="grid gap-1 text-sm font-semibold">
                Free delivery above (₹)
                <input type="number" min={0} className="h-10 rounded-lg border border-line bg-panel px-2.5" value={freeAbove} onChange={(e) => setFreeAbove(Number(e.target.value))} />
              </label>
              <label className="grid gap-1 text-sm font-semibold">
                Delivery fee below that (₹)
                <input type="number" min={0} className="h-10 rounded-lg border border-line bg-panel px-2.5" value={fee} onChange={(e) => setFee(Number(e.target.value))} />
              </label>
            </div>
            <div>
              <b className="text-sm">Trucks available per slot</b>
              <div className="mt-1.5 grid grid-cols-3 gap-2.5">
                {DELIVERY_SLOTS.map((s, i) => (
                  <label key={s} className="grid gap-1 text-sm">
                    <span className="text-[13px] text-muted">{s}</span>
                    <input
                      type="number"
                      min={0}
                      className="h-10 rounded-lg border border-line bg-panel px-2.5"
                      value={slots[i]}
                      onChange={(e) => setSlots((prev) => prev.map((v, idx) => (idx === i ? Number(e.target.value) : v)))}
                    />
                  </label>
                ))}
              </div>
            </div>
            <Button type="submit" variant="yellow" className="w-fit">
              Save delivery rules
            </Button>
          </form>
        </Card>
      </div>

      <Card rounded="lg" className="p-[18px]">
        <div className="mb-2 flex items-center justify-between gap-3.5">
          <h2 className="font-display text-lg font-bold">Vehicles and drivers</h2>
          <Button variant="line" icon={<SellerIcon name="plus" size={16} />} onClick={() => setVehicleDialogOpen(true)}>
            Add vehicle
          </Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse">
            <thead>
              <tr>
                <th className="border-b border-line px-3 py-2.5 text-left text-[13px] font-semibold text-muted">Vehicle</th>
                <th className="border-b border-line px-3 py-2.5 text-left text-[13px] font-semibold text-muted">Type and capacity</th>
                <th className="border-b border-line px-3 py-2.5 text-left text-[13px] font-semibold text-muted">Driver</th>
                <th className="border-b border-line px-3 py-2.5 text-left text-[13px] font-semibold text-muted">Mobile</th>
                <th className="border-b border-line px-3 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {state.vehicles.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-muted">
                    No vehicles yet. Add one to start dispatching.
                  </td>
                </tr>
              ) : (
                state.vehicles.map((v) => {
                  const driver = state.drivers.find((d) => d.id === v.driverId);
                  return (
                    <tr key={v.id}>
                      <td className="border-b border-line px-3 py-2.5">
                        <b>{v.regNumber}</b>
                      </td>
                      <td className="border-b border-line px-3 py-2.5">{v.type}</td>
                      <td className="border-b border-line px-3 py-2.5">{driver?.name || "None"}</td>
                      <td className="border-b border-line px-3 py-2.5">{driver?.phone}</td>
                      <td className="border-b border-line px-3 py-2.5 text-right">
                        <Button size="sm" variant="line" onClick={() => removeVehicle(v.id)}>
                          Remove
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <VehicleDialog open={vehicleDialogOpen} onClose={() => setVehicleDialogOpen(false)} />
    </div>
  );
}
