// Admin dispute resolution form. Sends only the decision, approved amount,
// reason and evidence reference; FastAPI revalidates the cap, COD state and
// commission rate and writes the audited adjustments.
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import type { AdminDisputeResolution } from "@/lib/api/adminApi";

export default function AdminDisputeResolveForm({
  shipmentId,
  maxRefund,
  commissionRate,
  blockedReason,
  requestedAmount,
  requestedEvidence,
}: {
  shipmentId: string;
  maxRefund: string | null;
  commissionRate: string | null;
  blockedReason: string | null;
  requestedAmount: string | null;
  requestedEvidence: string | null;
}) {
  const router = useRouter();
  const [decision, setDecision] = useState<"approve" | "reject">("approve");
  const [amount, setAmount] = useState(requestedAmount ?? maxRefund ?? "");
  const [reason, setReason] = useState("");
  const [evidence, setEvidence] = useState(requestedEvidence ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<AdminDisputeResolution | null>(null);

  const rate = Number(commissionRate ?? 0);
  const preview = decision === "approve" && amount ? Number(amount) * rate : 0;
  // COD/policy state blocks an approval only; rejecting must stay possible so a
  // stuck collection cannot keep the dispute open forever.
  const disabled = Boolean(blockedReason) && decision === "approve";

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    if (reason.trim().length < 3) {
      setError("Give a resolution reason.");
      return;
    }
    if (decision === "approve") {
      if (!amount) {
        setError("Enter the approved refund amount.");
        return;
      }
      if (evidence.trim().length < 3) {
        setError("An evidence reference is required for a refund.");
        return;
      }
    }
    setBusy(true);
    try {
      const response = await fetch(`/api/admin/disputes/${encodeURIComponent(shipmentId)}/resolve`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          decision,
          ...(decision === "approve" ? { approvedAmount: amount } : {}),
          reason,
          ...(evidence.trim() ? { evidenceRef: evidence } : {}),
        }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(body?.error?.message ?? "Could not resolve this dispute.");
      }
      setResult(body as AdminDisputeResolution);
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Could not resolve this dispute.");
    } finally {
      setBusy(false);
    }
  };

  if (result) {
    return (
      <section className="grid gap-2 rounded-xl border border-ok/40 bg-ok/10 p-4 text-sm">
        <b>Resolution recorded</b>
        <p>{result.message}</p>
        <p className="text-muted">
          Refund INR {result.refundAmount} · commission reduction INR {result.commissionReduction} · shipment{" "}
          {result.shipmentStatus}
        </p>
      </section>
    );
  }

  return (
    <form onSubmit={submit} className="grid gap-3 rounded-xl border border-line bg-panel p-[18px]">
      <div>
        <h2 className="font-display text-lg font-bold">Resolve dispute</h2>
        <p className="text-[13px] text-muted">
          Refunds are seller-funded cash actions. The platform records and audits the adjustment only — it does not
          transfer money.
        </p>
      </div>

      {disabled ? (
        <p role="alert" className="rounded-lg border border-warn/45 bg-warn/10 p-3 text-[13px] font-medium">
          {blockedReason} Rejecting the claim is still allowed.
        </p>
      ) : null}

      <div className="flex flex-wrap gap-3 text-sm font-semibold">
        <label className="flex items-center gap-2">
          <input type="radio" checked={decision === "approve"} onChange={() => setDecision("approve")} disabled={busy} />
          Approve refund
        </label>
        <label className="flex items-center gap-2">
          <input type="radio" checked={decision === "reject"} onChange={() => setDecision("reject")} disabled={busy} />
          Reject claim
        </label>
      </div>

      {decision === "approve" && (
        <>
          <label className="grid gap-1 text-sm font-semibold">
            Approved amount (INR)
            <input
              type="number"
              min="0.01"
              step="0.01"
              max={maxRefund ?? undefined}
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              disabled={disabled || busy}
              className="h-10 rounded-lg border border-line bg-panel px-2.5"
            />
            <span className="text-[12px] font-normal text-muted">
              Maximum {maxRefund ? `₹${maxRefund}` : "unavailable"} · full approval closes the shipment as refunded;
              partial approval closes it as settled.
            </span>
          </label>
          <label className="grid gap-1 text-sm font-semibold">
            Evidence reference
            <input
              value={evidence}
              onChange={(event) => setEvidence(event.target.value)}
              disabled={disabled || busy}
              maxLength={200}
              placeholder="e.g. customer photo ref / support ticket"
              className="h-10 rounded-lg border border-line bg-panel px-2.5"
            />
          </label>
          <p className="text-[13px] text-muted">
            Commission reduction at {(rate * 100).toFixed(2)}%:{" "}
            <b>₹{Number.isFinite(preview) ? preview.toFixed(2) : "0.00"}</b> (calculated again server-side).
          </p>
        </>
      )}

      <label className="grid gap-1 text-sm font-semibold">
        Resolution reason
        <textarea
          rows={2}
          maxLength={500}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          disabled={disabled || busy}
          className="rounded-lg border border-line bg-panel p-2.5 text-sm font-normal"
          placeholder="What did the investigation establish?"
        />
      </label>

      {error && <p role="alert" className="rounded-lg border border-bad bg-panel p-2.5 text-[13px] font-medium text-bad">{error}</p>}
      <Button type="submit" variant="yellow" disabled={disabled || busy} className="w-fit">
        {busy ? "Recording…" : decision === "approve" ? "Approve refund" : "Reject claim"}
      </Button>
    </form>
  );
}
