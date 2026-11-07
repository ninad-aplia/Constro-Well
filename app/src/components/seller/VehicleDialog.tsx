// Add-vehicle dialog — port of buildgrid-seller-dashboard.html's `dVehicle()`
// (line 271) and its `fVeh` validation (line 450-455).
"use client";

import { useState } from "react";
import Dialog from "@/components/ui/Dialog";
import Button from "@/components/ui/Button";
import SellerIcon from "./SellerIcon";
import { useSellerStore } from "./SellerStoreProvider";

export default function VehicleDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { addVehicle } = useSellerStore();
  const [regNumber, setRegNumber] = useState("");
  const [type, setType] = useState("");
  const [driverName, setDriverName] = useState("");
  const [driverPhone, setDriverPhone] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const close = () => {
    setRegNumber("");
    setType("");
    setDriverName("");
    setDriverPhone("");
    setErrors({});
    onClose();
  };

  const submit = () => {
    const next: Record<string, string> = {};
    const normalized = regNumber.toUpperCase().replace(/[\s-]/g, "");
    if (!/^[A-Z]{2}\d{2}[A-Z]{1,3}\d{4}$/.test(normalized)) next.regNumber = "Enter a valid number, like KA01AB4521";
    if (type.length < 3) next.type = "Enter the vehicle type and capacity";
    if (driverName.length < 2) next.driverName = "Enter the driver's name";
    if (!/^[6-9]\d{9}$/.test(driverPhone)) next.driverPhone = "Enter a valid 10-digit mobile number";
    setErrors(next);
    if (Object.keys(next).length) return;
    const ok = addVehicle({ regNumber, type, driverName, driverPhone });
    if (!ok) {
      setErrors({ regNumber: "This vehicle is already added" });
      return;
    }
    close();
  };

  return (
    <Dialog open={open} onClose={close} title="Add a vehicle" wide>
      <form
        className="relative grid gap-3 p-[22px]"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <button type="button" onClick={close} aria-label="Close" className="absolute top-3 right-3 grid h-[34px] w-[34px] place-items-center rounded-lg bg-tint">
          <SellerIcon name="x" size={16} />
        </button>
        <h2 className="font-display text-lg font-bold">Add a vehicle</h2>

        <label className="grid gap-1 text-sm font-semibold">
          Registration number
          <input
            className="h-10 rounded-lg border border-line bg-panel px-2.5"
            placeholder="KA01AB4521"
            autoComplete="off"
            value={regNumber}
            onChange={(e) => setRegNumber(e.target.value)}
          />
          {errors.regNumber && <span className="text-[13px] font-medium text-bad">{errors.regNumber}</span>}
        </label>
        <label className="grid gap-1 text-sm font-semibold">
          Vehicle type and capacity
          <input
            className="h-10 rounded-lg border border-line bg-panel px-2.5"
            placeholder="Tata 407, 2.5 tonne"
            value={type}
            onChange={(e) => setType(e.target.value)}
          />
          {errors.type && <span className="text-[13px] font-medium text-bad">{errors.type}</span>}
        </label>
        <div className="grid grid-cols-2 gap-2.5">
          <label className="grid gap-1 text-sm font-semibold">
            Driver name
            <input className="h-10 rounded-lg border border-line bg-panel px-2.5" value={driverName} onChange={(e) => setDriverName(e.target.value)} />
            {errors.driverName && <span className="text-[13px] font-medium text-bad">{errors.driverName}</span>}
          </label>
          <label className="grid gap-1 text-sm font-semibold">
            Driver mobile
            <input
              className="h-10 rounded-lg border border-line bg-panel px-2.5"
              inputMode="numeric"
              maxLength={10}
              value={driverPhone}
              onChange={(e) => setDriverPhone(e.target.value)}
            />
            {errors.driverPhone && <span className="text-[13px] font-medium text-bad">{errors.driverPhone}</span>}
          </label>
        </div>
        <Button type="submit" variant="yellow" wide>
          Add vehicle
        </Button>
      </form>
    </Dialog>
  );
}
