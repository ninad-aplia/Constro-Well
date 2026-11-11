// Admin > Dispute detail. Investigation context (order, seller, customer, COD,
// issue, lines, events) plus the resolution workflow. Reads and writes go
// through the audited FastAPI admin endpoints.
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { cookies } from "next/headers";
import { SESSION_COOKIE } from "@/server/auth/session";
import AdminNotice from "@/components/admin/AdminNotice";
import AdminDisputeResolveForm from "@/components/admin/AdminDisputeResolveForm";
import Card from "@/components/ui/Card";
import Pill from "@/components/ui/Pill";
import { formatDateOnly } from "@/lib/admin/sellers";
import {
  AdminApiUnavailableError,
  ApiClientError,
  fetchAdminDispute,
  type AdminDisputeDetail,
} from "@/lib/api/adminApi";

export const metadata: Metadata = { title: "Dispute - Admin - Constro Well" };
export const instant = false;

type Outcome =
  | { kind: "ok"; data: AdminDisputeDetail }
  | { kind: "unconfigured" }
  | { kind: "unauthorized" }
  | { kind: "forbidden" }
  | { kind: "not-found" }
  | { kind: "failed" };

async function loadDispute(shipmentId: string): Promise<Outcome> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return { kind: "unauthorized" };
  try {
    return { kind: "ok", data: await fetchAdminDispute(shipmentId, `${SESSION_COOKIE}=${token}`) };
  } catch (error) {
    if (error instanceof AdminApiUnavailableError) return { kind: "unconfigured" };
    if (error instanceof ApiClientError) {
      if (error.status === 401) return { kind: "unauthorized" };
      if (error.status === 403) return { kind: "forbidden" };
      if (error.status === 404) return { kind: "not-found" };
    }
    return { kind: "failed" };
  }
}

const cached = cache(loadDispute);

function blockedReason(data: AdminDisputeDetail): string | null {
  if (data.shipmentStatus !== "disputed") {
    return `This dispute is already resolved; the shipment is ${data.shipmentStatus.replaceAll("_", " ")}.`;
  }
  if (data.codStatus !== "confirmed") {
    return "The COD collection is not confirmed. Resolve the pending/disputed collection before refunding.";
  }
  if (data.commissionSource === "none" || !data.commissionRate) {
    return "No active commission policy is configured, so the required commission credit cannot be calculated.";
  }
  if (!data.maxRefund || Number(data.maxRefund) <= 0) {
    return "There is no refundable amount for this dispute.";
  }
  return null;
}

export default async function AdminDisputeDetailPage({ params }: { params: Promise<{ shipmentId: string }> }) {
  const { shipmentId } = await params;
  const outcome = await cached(shipmentId);
  if (outcome.kind === "not-found") notFound();

  if (outcome.kind !== "ok") {
    const copy = {
      unconfigured: { title: "Admin service is not configured", body: "Set FASTAPI_BASE_URL on the server to connect the admin console." },
      unauthorized: { title: "Sign in required", body: "Your admin session has expired. Sign in again to view this dispute." },
      forbidden: { title: "Administrator access required", body: "This account is not allowed to view disputes." },
      failed: { title: "Dispute couldn't load", body: "The admin service is unavailable right now. Try again in a moment." },
    }[outcome.kind];
    return (
      <div className="grid gap-4">
        <h1 className="font-display text-2xl font-bold">Dispute</h1>
        <AdminNotice
          title={copy.title}
          body={copy.body}
          action={
            <Link href="/admin/disputes" className="mt-1 inline-flex min-h-9 items-center rounded-lg border border-line bg-panel px-3 text-[13px] font-semibold hover:bg-tint">
              Back to disputes
            </Link>
          }
        />
      </div>
    );
  }

  const d = outcome.data;
  const blocked = blockedReason(d);
  const claimSource = d.claim ? `issue claim ₹${d.claim}` : "confirmed COD (no recorded claim)";

  return (
    <div className="grid gap-4">
      <header>
        <Link href="/admin/disputes" className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-line bg-panel px-3 text-[13px] font-semibold hover:bg-tint">
          ← Back to disputes
        </Link>
        <h1 className="mt-2 font-display text-2xl font-bold">Dispute {d.shipmentCode}</h1>
        <p className="text-sm text-muted">
          Order <Link href={`/admin/orders/${d.orderId}`} className="text-link hover:underline">{d.orderCode}</Link> ·{" "}
          <Link href={`/admin/sellers/${d.sellerId}`} className="text-link hover:underline">{d.sellerName}</Link> ·{" "}
          {d.customerName} ({d.customerEmail})
        </p>
      </header>

      <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-3">
        <Card rounded="lg" className="p-[18px]">
          <h2 className="mb-2 font-display text-lg font-bold">Issue</h2>
          <div className="grid gap-1.5 text-sm">
            <p><b className="capitalize">{d.issueType.replaceAll("_", " ")}</b> · {d.auto ? "system-opened" : "customer-reported"}</p>
            <p className="text-muted">{d.issueNote}</p>
            <p>Claim: <b>{d.claim ? `₹${d.claim}` : "No recorded claim"}</b></p>
            <p className="text-[13px] text-muted">Opened {formatDateOnly(d.createdAt)} · shipment {d.shipmentStatus.replaceAll("_", " ")} · disputed history is preserved after resolution.</p>
          </div>
        </Card>
        <Card rounded="lg" className="p-[18px]">
          <h2 className="mb-2 font-display text-lg font-bold">COD collection</h2>
          <div className="grid gap-1.5 text-sm">
            <p>Status: {d.codStatus ? <Pill tone={d.codStatus === "confirmed" ? "ok" : d.codStatus === "disputed" ? "bad" : "warn"}>{d.codStatus}</Pill> : "missing"}</p>
            <p>Expected: <b>₹{d.expectedAmount}</b></p>
            <p>Collected: <b>{d.collectedAmount ? `₹${d.collectedAmount}` : "—"}</b></p>
            <p className="text-[13px] text-muted">The seller/driver collects this cash; the platform never custodies COD.</p>
          </div>
        </Card>
        <Card rounded="lg" className="p-[18px]">
          <h2 className="mb-2 font-display text-lg font-bold">Refund cap & commission</h2>
          <div className="grid gap-1.5 text-sm">
            <p>Maximum refund: <b>{d.maxRefund ? `₹${d.maxRefund}` : "unavailable"}</b></p>
            <p className="text-[13px] text-muted">Cap = {claimSource}.</p>
            <p>Commission rate: <b>{d.commissionRate ? `${(Number(d.commissionRate) * 100).toFixed(2)}%` : "not configured"}</b></p>
            <p className="text-[13px] text-muted">Source: {d.commissionSource}.</p>
          </div>
        </Card>
      </div>

      {d.refundRequest && (
        <Card rounded="lg" className="p-[18px]">
          <h2 className="mb-2 font-display text-lg font-bold">Seller refund request</h2>
          <p className="text-sm">
            Requested ₹{d.refundRequest.amount} · {d.refundRequest.reason} ·{" "}
            <span className="text-muted">{d.refundRequest.evidenceRef ?? "no evidence reference"}</span>
          </p>
          <p className="text-[13px] text-muted">Status: {d.refundRequest.status}. Admin approval creates the applied refund adjustment.</p>
        </Card>
      )}

      <Card rounded="lg" className="p-[18px]">
        <h2 className="mb-2 font-display text-lg font-bold">Items</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs text-muted">
                {["Product", "Qty", "Unit price", "Line value"].map((label, i) => (
                  <th key={label} className={`px-3 py-2 font-semibold ${i > 0 ? "text-right" : ""}`}>{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {d.lines.map((line, index) => (
                <tr key={index} className="border-b border-line/70 last:border-0">
                  <td className="px-3 py-2.5">{line.name} <span className="text-muted">({line.unit})</span></td>
                  <td className="px-3 py-2.5 text-right">{line.qty}</td>
                  <td className="px-3 py-2.5 text-right">₹{line.unitPrice}</td>
                  <td className="px-3 py-2.5 text-right font-semibold">₹{line.lineValue}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <AdminDisputeResolveForm
        shipmentId={d.shipmentId}
        maxRefund={d.maxRefund}
        commissionRate={d.commissionRate}
        blockedReason={blocked}
        requestedAmount={d.refundRequest?.amount ?? null}
        requestedEvidence={d.refundRequest?.evidenceRef ?? null}
      />

      <Card rounded="lg" className="p-[18px]">
        <h2 className="mb-2 font-display text-lg font-bold">Shipment history</h2>
        <ol className="grid gap-1.5 text-sm">
          {d.events.map((event, index) => (
            <li key={index} className="grid grid-cols-[120px_1fr] gap-2 border-b border-dashed border-line py-1.5 last:border-0">
              <small className="text-muted">{formatDateOnly(event.at)}</small>
              <span>{event.message}</span>
            </li>
          ))}
        </ol>
      </Card>
    </div>
  );
}
