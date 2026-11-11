// Driver decline dialog - returns a dispatched job to the seller's dispatch
// queue with a recorded reason. The order, COD expectation and stock stay
// untouched; only the assignment and the unused OTP are cleared.
"use client";

import { useState } from "react";
import Dialog from "@/components/ui/Dialog";
import Button from "@/components/ui/Button";
import SellerIcon from "@/components/seller/SellerIcon";
import type { DeliveryJob } from "@/lib/delivery/types";

const REASONS = [
  "Vehicle breakdown",
  "Route or capacity mismatch",
  "Cannot reach the pickup address",
  "Other",
];

export default function DeclineJobDialog({
  job,
  busy,
  onClose,
  onDecline,
}: {
  job: DeliveryJob | null;
  busy: boolean;
  onClose: () => void;
  onDecline: (reason: string) => Promise<void>;
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
    <Dialog open={job !== null} onClose={close} title={job ? `Decline ${job.id}?` : undefined} wide>
      {job && (
        <form
          className="relative grid gap-3 p-[22px]"
          onSubmit={async (event) => {
            event.preventDefault();
            setError("");
            try {
              await onDecline(reason);
              close();
            } catch (err) {
              setError(err instanceof Error ? err.message : "Could not decline this job.");
            }
          }}
        >
          <button type="button" onClick={close} aria-label="Close" className="absolute top-3 right-3 grid h-[34px] w-[34px] place-items-center rounded-lg bg-tint">
            <SellerIcon name="x" size={16} />
          </button>
          <h2 className="font-display text-lg font-bold">Decline {job.id}?</h2>
          <p className="text-sm text-muted">
            The shipment returns to the seller&rsquo;s dispatch queue so another driver can be assigned. The customer
            order, payment expectation and stock are unchanged. This cannot be undone by you.
          </p>
          <label className="grid gap-1 text-sm font-semibold">
            Reason
            <select className="h-10 rounded-lg border border-line bg-panel px-2.5" value={reason} onChange={(event) => setReason(event.target.value)}>
              {REASONS.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
          {error && <p role="alert" className="rounded-lg border border-bad bg-panel p-2.5 text-[13px] font-medium text-bad">{error}</p>}
          <Button type="submit" variant="red" wide disabled={busy}>{busy ? "Declining." : "Decline job"}</Button>
        </form>
      )}
    </Dialog>
  );
}
