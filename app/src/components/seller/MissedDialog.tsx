// Give-up dialog for a shipment whose delivery attempt already failed: marks
// it "missed", restores the reserved stock and cancels the COD expectation
// (no cash was ever collected, so there is nothing to refund).
"use client";

import { useState } from "react";
import Dialog from "@/components/ui/Dialog";
import Button from "@/components/ui/Button";
import SellerIcon from "./SellerIcon";
import type { SellerOrder } from "@/lib/seller/types";

const REASONS = [
  "Customer unreachable after repeated attempts",
  "Customer declined the delivery",
  "Address could not be located",
  "Other",
];

export default function MissedDialog({
  order,
  busy,
  onClose,
  onMarkMissed,
}: {
  order: SellerOrder | null;
  busy: boolean;
  onClose: () => void;
  onMarkMissed: (reason: string) => Promise<void>;
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
    <Dialog open={order !== null} onClose={close} title={order ? `Mark ${order.orderCode ?? order.id} as missed?` : undefined} wide>
      {order && (
        <form
          className="relative grid gap-3 p-[22px]"
          onSubmit={async (event) => {
            event.preventDefault();
            setError("");
            try {
              await onMarkMissed(reason);
              close();
            } catch (err) {
              setError(err instanceof Error ? err.message : "Could not mark this shipment as missed.");
            }
          }}
        >
          <button type="button" onClick={close} aria-label="Close" className="absolute top-3 right-3 grid h-[34px] w-[34px] place-items-center rounded-lg bg-tint">
            <SellerIcon name="x" size={16} />
          </button>
          <h2 className="font-display text-lg font-bold">Mark {order.orderCode ?? order.id} as missed?</h2>
          <p className="text-sm text-muted">
            This gives up on delivering this shipment. The reserved stock is restored. No cash was collected, so there is
            nothing to refund. This cannot be undone — reassign a vehicle instead if you want to try again.
          </p>
          <label className="grid gap-1 text-sm font-semibold">
            Reason
            <select className="h-10 rounded-lg border border-line bg-panel px-2.5" value={reason} onChange={(event) => setReason(event.target.value)}>
              {REASONS.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
          {error && <p role="alert" className="rounded-lg border border-bad bg-panel p-2.5 text-[13px] font-medium text-bad">{error}</p>}
          <Button type="submit" variant="red" wide disabled={busy}>{busy ? "Marking…" : "Mark as missed"}</Button>
        </form>
      )}
    </Dialog>
  );
}
