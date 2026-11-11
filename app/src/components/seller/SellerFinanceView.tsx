// Seller finance — seller-collected COD statement, collections, remittances and
// customer-refund adjustments. COD is the seller's own cash (or an assigned
// driver acting as their agent); it is never Constro-Well's money. Legacy
// platform-custody escrow lives separately at /seller/payments.
"use client";

import { useCallback, useEffect, useState } from "react";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Pill from "@/components/ui/Pill";
import SellerIcon from "@/components/seller/SellerIcon";
import { ApiClientError } from "@/lib/api/client";
import {
  confirmSellerCollection,
  createSellerAdjustment,
  fetchSellerAdjustments,
  fetchSellerCollections,
  fetchSellerRemittances,
  fetchSellerStatement,
  initiateSellerRemittance,
} from "@/lib/api/sellerFinanceApi";
import type {
  CodCollectionDto,
  RemittanceDto,
  SellerAdjustmentDto,
  SellerStatementDto,
} from "@/lib/api/financeDto";
import Link from "next/link";

function inr(value: string): string {
  const negative = value.startsWith("-");
  const raw = negative ? value.slice(1) : value;
  const [whole, frac] = raw.split(".");
  const grouped = Number(whole).toLocaleString("en-IN");
  return `${negative ? "-" : ""}₹${grouped}${frac ? `.${frac}` : ""}`;
}

function messageOf(error: unknown): string {
  if (error instanceof ApiClientError) {
    if (error.status === 401) return "Sign in as a seller to view finance.";
    if (error.status === 403) return "This account does not have a seller profile.";
    return error.message;
  }
  return "Could not reach the finance service. Try again.";
}

const COLLECTION_LABEL: Record<string, string> = {
  pending: "Pending collection",
  confirmed: "Collected",
  disputed: "Disputed",
  cancelled: "Cancelled",
};

const REMITTANCE_LABEL: Record<string, string> = {
  initiated: "Initiated (not yet received)",
  received: "Received (unallocated)",
  allocated: "Allocated",
  failed: "Failed",
  returned: "Returned",
};

const COLLECTION_TONE: Record<string, "neutral" | "ok" | "bad"> = {
  pending: "neutral",
  confirmed: "ok",
  disputed: "bad",
  cancelled: "neutral",
};

type LoadState = "loading" | "ready" | "error";

export default function SellerFinanceView() {
  const [statement, setStatement] = useState<SellerStatementDto | null>(null);
  const [collections, setCollections] = useState<CodCollectionDto[]>([]);
  const [remittances, setRemittances] = useState<RemittanceDto[]>([]);
  const [adjustments, setAdjustments] = useState<SellerAdjustmentDto[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");
  const [actionOk, setActionOk] = useState("");

  const refresh = useCallback(async () => {
    const [s, c, r, a] = await Promise.all([
      fetchSellerStatement(),
      fetchSellerCollections(),
      fetchSellerRemittances(),
      fetchSellerAdjustments(),
    ]);
    setStatement(s);
    setCollections(c);
    setRemittances(r);
    setAdjustments(a);
  }, []);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetchSellerStatement(),
      fetchSellerCollections(),
      fetchSellerRemittances(),
      fetchSellerAdjustments(),
    ])
      .then(([s, c, r, a]) => {
        if (cancelled) return;
        setStatement(s);
        setCollections(c);
        setRemittances(r);
        setAdjustments(a);
        setLoadState("ready");
      })
      .catch((err) => {
        if (cancelled) return;
        setError(messageOf(err));
        setLoadState("error");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // The success message is set only after the request resolves: it must never
  // claim an action succeeded when the API rejected it.
  const run = useCallback(async (key: string, fn: () => Promise<unknown>, ok: string) => {
    setBusy(key);
    setActionError("");
    setActionOk("");
    try {
      await fn();
      setActionOk(ok);
      await refresh();
    } catch (err) {
      setActionError(messageOf(err));
    } finally {
      setBusy(null);
    }
  }, [refresh]);

  if (loadState === "loading") return <p className="text-muted">Loading finance…</p>;
  if (loadState === "error" || !statement) return <p className="text-bad">{error}</p>;

  return (
    // minmax(0,1fr) instead of the implicit auto track: an auto track sizes to
    // the widest table's max-content and pushes the whole page sideways on
    // mobile. The tables keep their own horizontal scroll.
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3.5">
        <div>
          <h1 className="font-display text-[clamp(25px,3vw,34px)] font-bold">Finance</h1>
          <p className="mt-1 text-muted">
            Customers pay you directly on delivery — this cash is yours, not Constro-Well&apos;s. What you owe the
            platform is commission, settled by remittance.
          </p>
        </div>
        <Link href="/seller/payments" className="text-[13px] font-semibold text-hi hover:underline">
          View legacy escrow (pre-cutover) →
        </Link>
      </div>

      {actionError && (
        <div className="flex items-start gap-2 rounded-lg border border-bad/40 bg-bad/10 p-2.5 text-sm text-bad">
          <SellerIcon name="alert" size={18} /> {actionError}
        </div>
      )}
      {actionOk && (
        <div className="rounded-lg border border-ok/40 bg-ok/10 p-2.5 text-sm">{actionOk}</div>
      )}

      {/* Statement summary */}
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        <Card rounded="lg" className="grid gap-1.5 p-4">
          <span className="text-[13px] font-semibold text-muted">Expected COD</span>
          <b className="font-display text-[22px] font-bold">{inr(statement.collections.expectedCod)}</b>
          <span className="text-[13px] text-muted">{statement.collections.pendingCount} pending · {statement.collections.confirmedCount} collected</span>
        </Card>
        <Card rounded="lg" className="grid gap-1.5 p-4">
          <span className="text-[13px] font-semibold text-muted">Confirmed COD</span>
          <b className="font-display text-[22px] font-bold">{inr(statement.collections.confirmedCod)}</b>
          <span className={`text-[13px] ${statement.collections.discrepancyCount ? "text-bad" : "text-muted"}`}>
            {statement.collections.discrepancyCount
              ? `${statement.collections.discrepancyCount} discrepancy (${inr(statement.collections.discrepancyAmount)})`
              : "No discrepancies"}
          </span>
        </Card>
        <Card rounded="lg" className="grid gap-1.5 p-4">
          <span className="text-[13px] font-semibold text-muted">Commission outstanding</span>
          <b className="font-display text-[22px] font-bold">{inr(statement.commission.outstanding)}</b>
          <span className="text-[13px] text-muted">Assessed {inr(statement.commission.assessed)} · remitted {inr(statement.commission.remitted)}</span>
        </Card>
        <Card rounded="lg" className="grid gap-1.5 p-4">
          <span className="text-[13px] font-semibold text-muted">Remittances received</span>
          <b className="font-display text-[22px] font-bold">{inr(statement.remittances.received)}</b>
          <span className="text-[13px] text-muted">{inr(statement.remittances.unallocated)} unallocated · {inr(statement.remittances.initiated)} initiated</span>
        </Card>
      </div>

      {/* Collections */}
      <Card rounded="lg" className="p-[18px]">
        <h2 className="mb-2 font-display text-lg font-bold">COD collections</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse">
            <thead>
              <tr>
                {["Shipment", "Status", "Expected", "Collected", "Confirm"].map((h, i) => (
                  <th key={h} className={`border-b border-line px-3 py-2.5 text-[13px] font-semibold text-muted ${i >= 2 ? "text-right" : "text-left"}`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {collections.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-muted">No COD collections yet.</td>
                </tr>
              ) : (
                collections.map((c) => (
                  <CollectionRow
                    key={c.id}
                    collection={c}
                    busy={busy === c.shipmentId}
                    onConfirm={(amount, ref) => run(
                      c.shipmentId,
                      () => confirmSellerCollection(c.shipmentId, { collectedAmount: amount, evidenceRef: ref || undefined }),
                      "Collection confirmed.",
                    )}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Remittances */}
      <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-3">
        <Card rounded="lg" className="p-[18px] lg:col-span-2">
          <h2 className="mb-2 font-display text-lg font-bold">Remittance history</h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse">
              <thead>
                <tr>
                  {["Date", "Reference", "Method", "Status", "Amount"].map((h, i) => (
                    <th key={h} className={`border-b border-line px-3 py-2.5 text-[13px] font-semibold text-muted ${i === 4 ? "text-right" : "text-left"}`}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {remittances.length === 0 ? (
                  <tr><td colSpan={5} className="p-6 text-center text-muted">No remittances yet.</td></tr>
                ) : (
                  remittances.map((r) => (
                    <tr key={r.id}>
                      <td className="border-b border-line px-3 py-2.5 text-[13px]">{new Date(r.initiatedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</td>
                      <td className="border-b border-line px-3 py-2.5">{r.reference}</td>
                      <td className="border-b border-line px-3 py-2.5 text-[13px]">{r.method}</td>
                      <td className="border-b border-line px-3 py-2.5"><Pill tone={r.status === "failed" || r.status === "returned" ? "bad" : r.status === "received" || r.status === "allocated" ? "ok" : "neutral"}>{REMITTANCE_LABEL[r.status] ?? r.status}</Pill></td>
                      <td className="border-b border-line px-3 py-2.5 text-right"><b>{inr(r.amount)}</b></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>

        <RemittanceForm busy={busy === "remittance"} onSubmit={(input) => run("remittance", () => initiateSellerRemittance(input), "Remittance submitted for verification.")} />
      </div>

      {/* Adjustments */}
      <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-3">
        <Card rounded="lg" className="p-[18px] lg:col-span-2">
          <h2 className="mb-2 font-display text-lg font-bold">Customer refunds &amp; adjustments</h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse">
              <thead>
                <tr>
                  {["Date", "Type", "Reason", "Status", "Amount"].map((h, i) => (
                    <th key={h} className={`border-b border-line px-3 py-2.5 text-[13px] font-semibold text-muted ${i === 4 ? "text-right" : "text-left"}`}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {adjustments.length === 0 ? (
                  <tr><td colSpan={5} className="p-6 text-center text-muted">No adjustments yet.</td></tr>
                ) : (
                  adjustments.map((a) => (
                    <tr key={a.id}>
                      <td className="border-b border-line px-3 py-2.5 text-[13px]">{new Date(a.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</td>
                      <td className="border-b border-line px-3 py-2.5 text-[13px]">{a.type === "customer_refund" ? "Customer refund" : a.type === "reversal" ? "Reversal" : "Adjustment"}</td>
                      <td className="border-b border-line px-3 py-2.5 text-[13px] text-muted">{a.reason}</td>
                      <td className="border-b border-line px-3 py-2.5"><Pill tone={a.status === "applied" ? "ok" : "neutral"}>{a.status}</Pill></td>
                      <td className="border-b border-line px-3 py-2.5 text-right"><b>{inr(a.amount)}</b></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>

        <RefundForm busy={busy === "refund"} onSubmit={(input) => run("refund", () => createSellerAdjustment(input), "Refund recorded for admin review.")} />
      </div>
    </div>
  );
}

function CollectionRow({
  collection,
  busy,
  onConfirm,
}: {
  collection: CodCollectionDto;
  busy: boolean;
  onConfirm: (amount: string, ref: string) => void;
}) {
  const [amount, setAmount] = useState(collection.expectedAmount);
  const [ref, setRef] = useState("");
  const discrepancy = collection.status === "confirmed" && collection.collectedAmount !== collection.expectedAmount;

  if (collection.status !== "pending") {
    return (
      <tr>
        <td className="border-b border-line px-3 py-2.5">{collection.shipmentId}</td>
        <td className="border-b border-line px-3 py-2.5"><Pill tone={COLLECTION_TONE[collection.status]}>{COLLECTION_LABEL[collection.status] ?? collection.status}</Pill></td>
        <td className="border-b border-line px-3 py-2.5 text-right">{inr(collection.expectedAmount)}</td>
        <td className="border-b border-line px-3 py-2.5 text-right">
          {collection.collectedAmount ? <b className={discrepancy ? "text-bad" : ""}>{inr(collection.collectedAmount)}</b> : "—"}
          {discrepancy && <span className="ml-1.5 text-[11px] font-semibold text-bad">differs</span>}
        </td>
        <td className="border-b border-line px-3 py-2.5 text-right text-[13px] text-muted">—</td>
      </tr>
    );
  }

  return (
    <tr>
      <td className="border-b border-line px-3 py-2.5">{collection.shipmentId}</td>
      <td className="border-b border-line px-3 py-2.5"><Pill tone="neutral">Pending</Pill></td>
      <td className="border-b border-line px-3 py-2.5 text-right">{inr(collection.expectedAmount)}</td>
      <td className="border-b border-line px-3 py-2.5">
        <input
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="w-28 rounded-md border border-line bg-bg px-2 py-1.5 text-right text-sm"
          aria-label="Collected amount"
        />
      </td>
      <td className="border-b border-line px-3 py-2.5">
        <div className="flex items-center justify-end gap-1.5">
          <input
            value={ref}
            onChange={(e) => setRef(e.target.value)}
            placeholder="Receipt ref (optional)"
            className="w-36 rounded-md border border-line bg-bg px-2 py-1.5 text-sm"
            aria-label="Evidence reference"
          />
          <Button variant="yellow" disabled={busy} onClick={() => onConfirm(amount, ref)}>
            {busy ? "Saving…" : "Confirm"}
          </Button>
        </div>
      </td>
    </tr>
  );
}

function RemittanceForm({ busy, onSubmit }: { busy: boolean; onSubmit: (input: { amount: string; method: string; reference: string }) => void }) {
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("bank_transfer");
  const [reference, setReference] = useState("");
  return (
    <Card rounded="lg" className="grid gap-3 p-[18px]">
      <h2 className="font-display text-lg font-bold">Initiate a remittance</h2>
      <p className="text-[13px] text-muted">Record a payment you&apos;ve sent to Constro-Well. It only counts as received once an admin verifies the receipt.</p>
      <label className="grid gap-1 text-[13px] font-semibold">
        Amount (₹)
        <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} className="rounded-md border border-line bg-bg px-2 py-1.5" placeholder="0.00" />
      </label>
      <label className="grid gap-1 text-[13px] font-semibold">
        Method
        <select value={method} onChange={(e) => setMethod(e.target.value)} className="rounded-md border border-line bg-bg px-2 py-1.5">
          <option value="bank_transfer">Bank transfer</option>
          <option value="upi">UPI</option>
          <option value="cheque">Cheque</option>
        </select>
      </label>
      <label className="grid gap-1 text-[13px] font-semibold">
        Reference (e.g. UTR)
        <input value={reference} onChange={(e) => setReference(e.target.value)} className="rounded-md border border-line bg-bg px-2 py-1.5" placeholder="UTR-…" />
      </label>
      <Button variant="yellow" disabled={busy || !amount || !reference} onClick={() => onSubmit({ amount, method, reference })}>
        {busy ? "Submitting…" : "Submit remittance"}
      </Button>
    </Card>
  );
}

function RefundForm({ busy, onSubmit }: { busy: boolean; onSubmit: (input: { type: "customer_refund"; amount: string; reason: string; evidenceRef?: string }) => void }) {
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [evidenceRef, setEvidenceRef] = useState("");
  return (
    <Card rounded="lg" className="grid gap-3 p-[18px]">
      <h2 className="font-display text-lg font-bold">Record a customer refund</h2>
      <p className="text-[13px] text-muted">You refund customers from your own cash; record it here for admin review. Refunds do not change your commission.</p>
      <label className="grid gap-1 text-[13px] font-semibold">
        Amount (₹)
        <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} className="rounded-md border border-line bg-bg px-2 py-1.5" placeholder="0.00" />
      </label>
      <label className="grid gap-1 text-[13px] font-semibold">
        Reason
        <input value={reason} onChange={(e) => setReason(e.target.value)} className="rounded-md border border-line bg-bg px-2 py-1.5" placeholder="e.g. goods returned" />
      </label>
      <label className="grid gap-1 text-[13px] font-semibold">
        Evidence ref (optional)
        <input value={evidenceRef} onChange={(e) => setEvidenceRef(e.target.value)} className="rounded-md border border-line bg-bg px-2 py-1.5" />
      </label>
      <Button variant="yellow" disabled={busy || !amount || !reason} onClick={() => onSubmit({ type: "customer_refund", amount, reason, evidenceRef: evidenceRef || undefined })}>
        {busy ? "Submitting…" : "Record refund"}
      </Button>
    </Card>
  );
}
