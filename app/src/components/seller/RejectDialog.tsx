// Reject dialog — port of buildgrid-seller-dashboard.html's `dReject()` (line 258).
"use client";

import { useState } from "react";
import Dialog from "@/components/ui/Dialog";
import Button from "@/components/ui/Button";
import SellerIcon from "./SellerIcon";
import { useSellerStore } from "./SellerStoreProvider";
import type { SellerOrder } from "@/lib/seller/types";

const REASONS = ["Out of stock", "Vehicle or yard fully booked", "Cannot deliver to this pincode", "Price changed"];

export default function RejectDialog({ order, onClose }: { order: SellerOrder | null; onClose: () => void }) {
  const { rejectOrder } = useSellerStore();
  const [reason, setReason] = useState(REASONS[0]);

  const close = () => {
    setReason(REASONS[0]);
    onClose();
  };

  return (
    <Dialog open={order !== null} onClose={close} title={order ? `Reject ${order.id}?` : undefined} wide>
      {order && (
        <form
          className="relative grid gap-3 p-[22px]"
          onSubmit={(e) => {
            e.preventDefault();
            rejectOrder(order.id, reason);
            close();
          }}
        >
          <button
            type="button"
            onClick={close}
            aria-label="Close"
            className="absolute top-3 right-3 grid h-[34px] w-[34px] place-items-center rounded-lg bg-tint"
          >
            <SellerIcon name="x" size={16} />
          </button>
          <h2 className="font-display text-lg font-bold">Reject {order.id}?</h2>
          <p className="text-sm text-muted">
            Rejecting lowers your acceptance rate. The order goes to admin to reassign, so only reject when you really
            cannot fulfil it.
          </p>
          <label className="grid gap-1 text-sm font-semibold">
            Reason
            <select className="h-10 rounded-lg border border-line bg-panel px-2.5" value={reason} onChange={(e) => setReason(e.target.value)}>
              {REASONS.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
          </label>
          <Button type="submit" variant="red" wide>
            Reject order
          </Button>
        </form>
      )}
    </Dialog>
  );
}
