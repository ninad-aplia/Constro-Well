"use client";

import { useState } from "react";
import Dialog from "@/components/ui/Dialog";
import Button from "@/components/ui/Button";
import SellerIcon from "./SellerIcon";
import type { SellerOrder } from "@/lib/seller/types";

const REASONS = ["Out of stock", "Vehicle or yard fully booked", "Cannot deliver to this pincode", "Price changed"];

export default function RejectDialog({
  order,
  busy,
  onClose,
  onReject,
}: {
  order: SellerOrder | null;
  busy: boolean;
  onClose: () => void;
  onReject: (reason: string) => Promise<void>;
}) {
  const [reason, setReason] = useState(REASONS[0]);
  const [error, setError] = useState("");

  const close = () => {
    if (busy) return;
    setReason(REASONS[0]);
    setError("");
    onClose();
  };

  return (
    <Dialog open={order !== null} onClose={close} title={order ? `Reject ${order.orderCode ?? order.id}?` : undefined} wide>
      {order && (
        <form
          className="relative grid gap-3 p-[22px]"
          onSubmit={async (event) => {
            event.preventDefault();
            setError("");
            try {
              await onReject(reason);
              close();
            } catch (err) {
              setError(err instanceof Error ? err.message : "Could not reject this shipment.");
            }
          }}
        >
          <button type="button" onClick={close} aria-label="Close" className="absolute top-3 right-3 grid h-[34px] w-[34px] place-items-center rounded-lg bg-tint">
            <SellerIcon name="x" size={16} />
          </button>
          <h2 className="font-display text-lg font-bold">Reject {order.orderCode ?? order.id}?</h2>
          <p className="text-sm text-muted">
            Rejecting lowers your acceptance rate. The reserved stock is restored and the escrow hold is refunded; only reject
            when you really cannot fulfil the shipment.
          </p>
          <label className="grid gap-1 text-sm font-semibold">
            Reason
            <select className="h-10 rounded-lg border border-line bg-panel px-2.5" value={reason} onChange={(event) => setReason(event.target.value)}>
              {REASONS.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
          {error && <p role="alert" className="rounded-lg border border-bad bg-panel p-2.5 text-[13px] font-medium text-bad">{error}</p>}
          <Button type="submit" variant="red" wide disabled={busy}>{busy ? "Rejecting…" : "Reject order"}</Button>
        </form>
      )}
    </Dialog>
  );
}
