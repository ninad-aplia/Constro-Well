// Seller Hub Payments — port of buildgrid-seller-dashboard.html's
// viewPayments() (line 373). Balances and the ledger below are computed from
// real `EscrowEntry` rows (server/orders/sellerService.ts:sellerPaymentsSummary)
// — the only persisted financial model in this schema. There is no Payout or
// Settlement model and no bank-transfer integration, so withdrawal is
// explicitly disabled rather than simulated: see the note by the disabled
// "Withdraw" button below.
"use client";

import { useEffect, useState } from "react";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Pill from "@/components/ui/Pill";
import SellerIcon from "@/components/seller/SellerIcon";
import { ApiClientError } from "@/lib/api/client";
import { fetchSellerPayments } from "@/lib/api/sellerApi";
import type { SellerPaymentsDto } from "@/lib/api/sellerOrderDto";

function inr(n: number): string {
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}

function messageOf(error: unknown): string {
  if (error instanceof ApiClientError) {
    if (error.status === 401) return "Sign in as a seller to view payments.";
    if (error.status === 403) return "This account does not have a seller profile.";
    return error.message;
  }
  return "Could not reach the payments service. Try again.";
}

const LEDGER_LABEL: Record<string, string> = {
  held: "Held in escrow",
  commission: "Platform commission",
  released: "Released to payable balance",
  refund: "Refunded to customer",
  withdrawn: "Bank transfer",
};

function downloadCsv(rows: (string | number)[][]) {
  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "constro-well-escrow-ledger.csv";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

type LoadState = "loading" | "ready" | "error";

export default function SellerPaymentsPage() {
  const [data, setData] = useState<SellerPaymentsDto | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetchSellerPayments()
      .then((d) => {
        if (cancelled) return;
        setData(d);
        setLoadState("ready");
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setLoadError(messageOf(err));
        setLoadState("error");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loadState === "loading") return <p className="text-muted">Loading payments…</p>;
  if (loadState === "error" || !data) return <p className="text-bad">{loadError}</p>;

  const available = Number(data.balance.available);

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3.5">
        <div>
          <h1 className="font-display text-[clamp(25px,3vw,34px)] font-bold">Legacy escrow</h1>
          <p className="mt-1 text-muted">Historical platform-custody escrow records from before the seller-collected COD cutover. These are pre-cutover history — they do not reflect current COD cash.</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="line"
            icon={<SellerIcon name="dl" size={16} />}
            onClick={() =>
              downloadCsv([
                ["Date", "Type", "Amount", "Order", "Shipment", "Note"],
                ...data.ledger.map((e) => [e.createdAt, e.type, e.amount, e.orderCode ?? "", e.shipmentCode ?? "", e.note]),
              ])
            }
          >
            Download statement
          </Button>
          <Button variant="yellow" disabled title="Payout withdrawal isn't available in this release — no bank-transfer integration has been built yet.">
            Withdraw {inr(available)}
          </Button>
        </div>
      </div>

      <div className="flex items-start gap-2.5 rounded-lg border border-warn/40 bg-warn/10 p-2.5 text-sm">
        <SellerIcon name="alert" size={18} />
        <div>
          Legacy escrow (pre-cutover) — these balances are the old platform-custody model and are not current COD money. Your current finance (COD collections, commission and remittances) lives in <a href="/seller/finance" className="font-semibold text-hi hover:underline">Finance</a>.
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        <Card rounded="lg" className="grid gap-1.5 p-4">
          <span className="text-[13px] font-semibold text-muted">Available to withdraw</span>
          <b className={`font-display text-[22px] font-bold ${available < 0 ? "text-bad" : ""}`}>{inr(available)}</b>
          <span className="text-[13px] text-muted">
            {available < 0 ? "Bank transfers on record exceed escrow released so far" : "Released minus bank transfers on record"}
          </span>
        </Card>
        <Card rounded="lg" className="grid gap-1.5 p-4">
          <span className="text-[13px] font-semibold text-muted">Pending release</span>
          <b className="font-display text-[22px] font-bold">{inr(Number(data.balance.pendingRelease))}</b>
          <span className="text-[13px] text-muted">Still held, order not yet settled</span>
        </Card>
        <Card rounded="lg" className="grid gap-1.5 p-4">
          <span className="text-[13px] font-semibold text-muted">Frozen by disputes</span>
          <b className={`font-display text-[22px] font-bold ${Number(data.balance.frozen) ? "text-bad" : ""}`}>{inr(Number(data.balance.frozen))}</b>
          <span className="text-[13px] text-muted">Until admin decides</span>
        </Card>
        <Card rounded="lg" className="grid gap-1.5 p-4">
          <span className="text-[13px] font-semibold text-muted">Bank account on file</span>
          <b className="text-[19px] font-bold">{data.bankRef}</b>
          <span className="text-[13px] text-muted">From your seller profile</span>
        </Card>
      </div>

      <Card rounded="lg" className="p-[18px]">
        <h2 className="mb-2 font-display text-lg font-bold">Legacy escrow ledger (pre-cutover)</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse">
            <thead>
              <tr>
                {["Date", "Type", "Order", "Amount", "Note"].map((h, i) => (
                  <th key={h} className={`border-b border-line px-3 py-2.5 text-[13px] font-semibold text-muted ${i === 3 ? "text-right" : "text-left"}`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.ledger.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-muted">
                    No escrow activity yet.
                  </td>
                </tr>
              ) : (
                data.ledger.map((entry) => (
                  <tr key={entry.id}>
                    <td className="border-b border-line px-3 py-2.5">{new Date(entry.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</td>
                    <td className="border-b border-line px-3 py-2.5">
                      <Pill tone={entry.type === "refund" ? "bad" : entry.type === "withdrawn" ? "neutral" : "ok"}>
                        {LEDGER_LABEL[entry.type] ?? entry.type}
                      </Pill>
                    </td>
                    <td className="border-b border-line px-3 py-2.5">{entry.orderCode ?? "—"}</td>
                    <td className="border-b border-line px-3 py-2.5 text-right">
                      <b>{inr(Number(entry.amount))}</b>
                    </td>
                    <td className="border-b border-line px-3 py-2.5 text-[13px] text-muted">{entry.note}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
