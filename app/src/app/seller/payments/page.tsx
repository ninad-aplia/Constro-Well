// Seller Hub Payments — port of buildgrid-seller-dashboard.html's
// viewPayments() (line 373): balances, settled-orders table, bank transfers,
// client-side CSV statement export (a real export of the current preview
// data, same approach as the prototype's blob download — not a backend call).
"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Pill from "@/components/ui/Pill";
import PreviewDisclosure from "@/components/seller/PreviewDisclosure";
import SellerIcon from "@/components/seller/SellerIcon";
import WithdrawDialog from "@/components/seller/WithdrawDialog";
import { useSellerStore } from "@/components/seller/SellerStoreProvider";
import { getBalance } from "@/lib/seller/selectors";
import { COMMISSION_RATE, LATE_PENALTY_RATE, deliveryFee, netPayout, orderItemValue } from "@/lib/seller/rules";

function inr(n: number): string {
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}

function downloadCsv(rows: (string | number)[][]) {
  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "constro-well-payout-statement.csv";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function SellerPaymentsPage() {
  const { state } = useSellerStore();
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const balance = getBalance(state);
  const settled = state.orders.filter((o) => o.status === "settled").sort((a, b) => (a.paidAtLabel || "").localeCompare(b.paidAtLabel || ""));

  return (
    <div className="grid gap-4">
      <PreviewDisclosure />

      <div className="flex flex-wrap items-end justify-between gap-3.5">
        <div>
          <h1 className="font-display text-[clamp(25px,3vw,34px)] font-bold">Payments</h1>
          <p className="mt-1 text-muted">Money is held in escrow, then released to you after delivery is accepted and the review window ends.</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="line"
            icon={<SellerIcon name="dl" size={16} />}
            onClick={() => {
              const rows: (string | number)[][] = [
                ["Order", "Product", "Qty", "Items", "Delivery", "Commission", "Penalty", "Net", "Status"],
                ...state.orders
                  .filter((o) => o.status === "settled")
                  .map((o) => [
                    o.id,
                    o.productName,
                    o.qty,
                    orderItemValue(o),
                    deliveryFee(o, state.rules.freeAbove, state.rules.fee),
                    Math.round(orderItemValue(o) * COMMISSION_RATE),
                    o.late ? Math.round(orderItemValue(o) * LATE_PENALTY_RATE) : 0,
                    netPayout(o, state.rules.freeAbove, state.rules.fee),
                    o.withdrawn ? "Withdrawn" : "Available",
                  ]),
              ];
              downloadCsv(rows);
            }}
          >
            Download statement
          </Button>
          <Button variant="yellow" onClick={() => setWithdrawOpen(true)}>
            Withdraw {inr(balance.available)}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        <Card rounded="lg" className="grid gap-1.5 p-4">
          <span className="text-[13px] font-semibold text-muted">Available to withdraw</span>
          <b className="font-display text-[22px] font-bold">{inr(balance.available)}</b>
          <span className="text-[13px] text-muted">Next auto payout is weekly</span>
        </Card>
        <Card rounded="lg" className="grid gap-1.5 p-4">
          <span className="text-[13px] font-semibold text-muted">Pending release</span>
          <b className="font-display text-[22px] font-bold">{inr(balance.pending)}</b>
          <span className="text-[13px] text-muted">Released after the review window</span>
        </Card>
        <Card rounded="lg" className="grid gap-1.5 p-4">
          <span className="text-[13px] font-semibold text-muted">Frozen by disputes</span>
          <b className={`font-display text-[22px] font-bold ${balance.frozen ? "text-bad" : ""}`}>{inr(balance.frozen)}</b>
          <span className="text-[13px] text-muted">Until admin decides</span>
        </Card>
        <Card rounded="lg" className="grid gap-1.5 p-4">
          <span className="text-[13px] font-semibold text-muted">Bank account</span>
          <b className="text-[19px] font-bold">{state.store.bank}</b>
          <span className="text-[13px] text-muted">Payouts arrive in 1 working day</span>
        </Card>
      </div>

      <Card rounded="lg" className="p-[18px]">
        <h2 className="mb-2 font-display text-lg font-bold">Settled orders</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse">
            <thead>
              <tr>
                {["Order", "Product", "Items", "Delivery", "Commission", "Penalty", "You received", "Status"].map((h, i) => (
                  <th key={h} className={`border-b border-line px-3 py-2.5 text-[13px] font-semibold text-muted ${i >= 2 ? "text-right" : "text-left"}`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {settled.map((o) => {
                const value = orderItemValue(o);
                const fee = deliveryFee(o, state.rules.freeAbove, state.rules.fee);
                return (
                  <tr key={o.id}>
                    <td className="border-b border-line px-3 py-2.5">
                      <b>{o.id}</b>
                      <br />
                      <span className="text-[13px] text-muted">{o.paidAtLabel}</span>
                    </td>
                    <td className="border-b border-line px-3 py-2.5">{o.productName.split(",")[0]}</td>
                    <td className="border-b border-line px-3 py-2.5 text-right">{inr(value)}</td>
                    <td className="border-b border-line px-3 py-2.5 text-right">{fee ? inr(fee) : "Free"}</td>
                    <td className="border-b border-line px-3 py-2.5 text-right">−{inr(value * COMMISSION_RATE)}</td>
                    <td className="border-b border-line px-3 py-2.5 text-right">{o.late ? `−${inr(value * LATE_PENALTY_RATE)}` : "–"}</td>
                    <td className="border-b border-line px-3 py-2.5 text-right">
                      <b>{inr(netPayout(o, state.rules.freeAbove, state.rules.fee))}</b>
                    </td>
                    <td className="border-b border-line px-3 py-2.5">
                      <Pill tone={o.withdrawn ? "neutral" : "ok"}>{o.withdrawn ? "Withdrawn" : "Available"}</Pill>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Card rounded="lg" className="p-[18px]">
        <h2 className="mb-2 font-display text-lg font-bold">Bank transfers</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] border-collapse">
            <thead>
              <tr>
                <th className="border-b border-line px-3 py-2.5 text-left text-[13px] font-semibold text-muted">Transfer</th>
                <th className="border-b border-line px-3 py-2.5 text-left text-[13px] font-semibold text-muted">Date</th>
                <th className="border-b border-line px-3 py-2.5 text-left text-[13px] font-semibold text-muted">Account</th>
                <th className="border-b border-line px-3 py-2.5 text-right text-[13px] font-semibold text-muted">Amount</th>
              </tr>
            </thead>
            <tbody>
              {state.transfers.map((t) => (
                <tr key={t.id}>
                  <td className="border-b border-line px-3 py-2.5">
                    <b>{t.id}</b>
                  </td>
                  <td className="border-b border-line px-3 py-2.5">{t.dateLabel}</td>
                  <td className="border-b border-line px-3 py-2.5">{t.bank}</td>
                  <td className="border-b border-line px-3 py-2.5 text-right">
                    <b>{inr(t.amount)}</b>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <WithdrawDialog open={withdrawOpen} onClose={() => setWithdrawOpen(false)} />
    </div>
  );
}
