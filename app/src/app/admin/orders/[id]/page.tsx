// Admin > Order detail. Read-only investigation page: order snapshot, items,
// per-seller shipments + recorded events, and actual escrow ledger rows.
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import Link from "next/link";
import { cookies } from "next/headers";
import { SESSION_COOKIE } from "@/server/auth/session";
import AdminNotice from "@/components/admin/AdminNotice";
import Card from "@/components/ui/Card";
import Pill from "@/components/ui/Pill";
import { formatAuditTime } from "@/lib/admin/activity";
import { formatInrAmount, orderStageTone, shipmentStatusTone } from "@/lib/admin/orders";
import { sellerDetailError } from "@/lib/admin/sellers";
import {
  AdminApiUnavailableError,
  fetchAdminOrder,
  type AdminOrderDetail,
} from "@/lib/api/adminApi";

export const instant = false;

type Outcome =
  | { kind: "ok"; data: AdminOrderDetail }
  | { kind: "unconfigured" }
  | { kind: "unauthorized" }
  | { kind: "forbidden" }
  | { kind: "not-found" }
  | { kind: "failed" };

async function loadOrder(id: string): Promise<Outcome> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return { kind: "unauthorized" };
  try {
    return { kind: "ok", data: await fetchAdminOrder(id, `${SESSION_COOKIE}=${token}`) };
  } catch (error) {
    if (error instanceof AdminApiUnavailableError) return { kind: "unconfigured" };
    return { kind: sellerDetailError(error) };
  }
}

const loadOrderCached = cache(loadOrder);

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const outcome = await loadOrderCached(id);
  if (outcome.kind === "not-found") notFound();
  return {
    title:
      outcome.kind === "ok"
        ? `${outcome.data.order.code} — Order — Admin — Constro Well`
        : "Order detail — Admin — Constro Well",
  };
}

function BackLink() {
  return (
    <Link
      href="/admin/orders"
      className="inline-flex min-h-9 w-fit items-center gap-1.5 rounded-lg border border-line bg-panel px-3 text-[13px] font-semibold hover:bg-tint"
    >
      ← Back to orders
    </Link>
  );
}

export default async function AdminOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const outcome = await loadOrderCached(id);
  if (outcome.kind === "not-found") notFound();

  if (outcome.kind !== "ok") {
    const copy = {
      unconfigured: {
        title: "Admin service is not configured",
        body: "Set FASTAPI_BASE_URL on the server to connect the admin console. No fallback data is shown.",
      },
      unauthorized: {
        title: "Sign in required",
        body: "Your admin session has expired. Sign in again to view this order.",
      },
      forbidden: {
        title: "Administrator access required",
        body: "This account is not allowed to view order details.",
      },
      failed: {
        title: "Order couldn't load",
        body: "The admin service is unavailable right now. Try again in a moment.",
      },
    }[outcome.kind];

    return (
      <div className="grid gap-4">
        <BackLink />
        <AdminNotice
          title={copy.title}
          body={copy.body}
          action={
            outcome.kind === "unauthorized" ? (
              <Link
                href="/login?next=/admin"
                className="mt-1 inline-flex min-h-9 items-center rounded-lg border border-line bg-panel px-3 text-[13px] font-semibold hover:bg-tint"
              >
                Sign in
              </Link>
            ) : outcome.kind === "failed" ? (
              <Link
                href={`/admin/orders/${encodeURIComponent(id)}`}
                className="mt-1 inline-flex min-h-9 items-center rounded-lg border border-line bg-panel px-3 text-[13px] font-semibold hover:bg-tint"
              >
                Try again
              </Link>
            ) : undefined
          }
        />
      </div>
    );
  }

  const { order, customer, money, lines, shipments, financialRecords } = outcome.data;

  return (
    <div className="grid gap-4">
      <BackLink />

      <header className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="font-display text-2xl font-bold">{order.code}</h1>
          <p className="text-sm text-muted">
            Order <span className="font-mono text-xs">{order.id}</span> · placed{" "}
            {formatAuditTime(order.createdAt)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Pill tone={orderStageTone(order.stage)}>{order.stage}</Pill>
          {order.cancelled && <Pill tone="bad">Cancelled</Pill>}
        </div>
      </header>

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <Card className="min-w-0 p-[18px]">
          <h2 className="mb-2 font-display text-lg font-bold">Order overview</h2>
          <dl className="grid grid-cols-[140px_1fr] gap-x-3 gap-y-1.5 text-sm">
            <dt className="text-muted">Order code</dt>
            <dd className="font-semibold">{order.code}</dd>
            <dt className="text-muted">Order ID</dt>
            <dd className="font-mono text-xs">{order.id}</dd>
            <dt className="text-muted">Stage</dt>
            <dd className="capitalize">{order.stage.replaceAll("_", " ")}</dd>
            <dt className="text-muted">Cancelled</dt>
            <dd>{order.cancelled ? "Yes" : "No"}</dd>
            <dt className="text-muted">Created</dt>
            <dd>{formatAuditTime(order.createdAt)}</dd>
            <dt className="text-muted">Updated</dt>
            <dd>{formatAuditTime(order.updatedAt)}</dd>
            <dt className="text-muted">Payment</dt>
            <dd>{order.paymentLabel}</dd>
          </dl>
        </Card>

        <Card className="min-w-0 p-[18px]">
          <h2 className="mb-2 font-display text-lg font-bold">Customer</h2>
          <dl className="grid grid-cols-[140px_1fr] gap-x-3 gap-y-1.5 text-sm">
            <dt className="text-muted">Name</dt>
            <dd className="font-semibold">{customer.name}</dd>
            <dt className="text-muted">Customer ID</dt>
            <dd className="font-mono text-xs">{customer.id}</dd>
            <dt className="text-muted">Email</dt>
            <dd className="break-all">{customer.email}</dd>
          </dl>
          <p className="mt-3 text-xs text-muted">
            Delivery address snapshot is stored on the order but deliberately not shown here.
          </p>
        </Card>

        <Card className="p-[18px] lg:col-span-2">
          <h2 className="mb-2 font-display text-lg font-bold">Order totals (checkout snapshot)</h2>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm sm:grid-cols-3 lg:grid-cols-5">
            <div>
              <dt className="text-xs text-muted">Item value</dt>
              <dd className="font-semibold">{formatInrAmount(money.itemValue)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Discount</dt>
              <dd className="font-semibold">{formatInrAmount(money.discount)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Delivery</dt>
              <dd className="font-semibold">{formatInrAmount(money.deliveryFee)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Tax (included)</dt>
              <dd className="font-semibold">{formatInrAmount(money.taxAmount)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Gross total</dt>
              <dd className="font-display text-lg font-bold">{formatInrAmount(money.grossTotal)}</dd>
            </div>
          </dl>
        </Card>
      </div>

      <Card className="min-w-0 p-[18px]">
        <h2 className="mb-2 font-display text-lg font-bold">Order items</h2>
        {lines.length === 0 ? (
          <p className="text-sm text-muted">No order lines are stored for this order.</p>
        ) : (
          <div className="min-w-0 overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs text-muted">
                  <th scope="col" className="py-2 pr-3 font-semibold">Product snapshot</th>
                  <th scope="col" className="px-3 py-2 font-semibold">Seller</th>
                  <th scope="col" className="px-3 py-2 font-semibold">Qty</th>
                  <th scope="col" className="px-3 py-2 font-semibold">Unit price</th>
                  <th scope="col" className="px-3 py-2 font-semibold">Line total</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line) => (
                  <tr key={line.id} className="border-b border-line/70 last:border-0">
                    <td className="py-2 pr-3">
                      <span className="block font-semibold">{line.name}</span>
                      <span className="text-xs text-muted">per {line.unit}</span>
                    </td>
                    <td className="px-3 py-2">{line.sellerName}</td>
                    <td className="px-3 py-2">{line.qty}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{formatInrAmount(line.unitPrice)}</td>
                    <td className="px-3 py-2 whitespace-nowrap font-semibold">
                      {formatInrAmount(line.lineValue)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <section className="grid gap-3" aria-label="Seller shipments">
        <h2 className="font-display text-lg font-bold">Seller shipments</h2>
        {shipments.length === 0 ? (
          <Card className="min-w-0 p-[18px]">
            <p className="text-sm text-muted">No shipments are stored for this order.</p>
          </Card>
        ) : (
          shipments.map((shipment) => (
            <Card key={shipment.id} className="p-[18px]">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="font-display text-base font-bold">
                    {shipment.code} · {shipment.sellerName}
                  </h3>
                  <p className="font-mono text-[11px] text-muted">
                    {shipment.id} · seller {shipment.sellerId}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <Pill tone={shipmentStatusTone(shipment.status)}>{shipment.status}</Pill>
                  {shipment.late && <Pill tone="warn">Late</Pill>}
                </div>
              </div>
              <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted sm:grid-cols-4">
                <div>
                  <dt>Created</dt>
                  <dd className="text-ink">{formatAuditTime(shipment.createdAt)}</dd>
                </div>
                <div>
                  <dt>Updated</dt>
                  <dd className="text-ink">{formatAuditTime(shipment.updatedAt)}</dd>
                </div>
                <div>
                  <dt>Delivered</dt>
                  <dd className="text-ink">
                    {shipment.deliveredAt ? formatAuditTime(shipment.deliveredAt) : "Not delivered"}
                  </dd>
                </div>
                <div>
                  <dt>Review ends</dt>
                  <dd className="text-ink">
                    {shipment.reviewEnds ? formatAuditTime(shipment.reviewEnds) : "—"}
                  </dd>
                </div>
              </dl>
              <div className="mt-3">
                <h4 className="mb-1 text-xs font-semibold tracking-wide text-muted uppercase">
                  Recorded events
                </h4>
                {shipment.events.length === 0 ? (
                  <p className="text-sm text-muted">
                    No event history is stored for this shipment.
                  </p>
                ) : (
                  <ol className="grid gap-1.5">
                    {shipment.events.map((event) => (
                      <li key={event.id} className="flex flex-wrap items-baseline gap-2 text-sm">
                        <span className="text-xs text-muted">{formatAuditTime(event.at)}</span>
                        <b className="text-xs capitalize">{event.actor}</b>
                        <span>{event.message}</span>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            </Card>
          ))
        )}
      </section>

      <Card className="min-w-0 p-[18px]">
        <h2 className="mb-1 font-display text-lg font-bold">Financial records</h2>
        <p className="mb-2 text-xs text-muted">
          Legacy escrow (pre-cutover) entries stored for this order. These are separate from the
          order totals above and are historical platform-custody records — not current COD cash,
          and no settlement is implied.
        </p>
        {financialRecords.length === 0 ? (
          <p className="text-sm text-muted">No financial records are stored for this order.</p>
        ) : (
          <div className="min-w-0 overflow-x-auto">
            <table className="w-full min-w-[620px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs text-muted">
                  <th scope="col" className="py-2 pr-3 font-semibold">Type</th>
                  <th scope="col" className="px-3 py-2 font-semibold">Seller</th>
                  <th scope="col" className="px-3 py-2 font-semibold">Shipment</th>
                  <th scope="col" className="px-3 py-2 font-semibold">Amount</th>
                  <th scope="col" className="px-3 py-2 font-semibold">Recorded</th>
                </tr>
              </thead>
              <tbody>
                {financialRecords.map((entry) => (
                  <tr key={entry.id} className="border-b border-line/70 last:border-0">
                    <td className="py-2 pr-3 capitalize">{entry.type}</td>
                    <td className="px-3 py-2">{entry.sellerName ?? "—"}</td>
                    <td className="px-3 py-2 font-mono text-xs">{entry.shipmentId ?? "—"}</td>
                    <td className="px-3 py-2 whitespace-nowrap font-semibold">
                      {formatInrAmount(entry.amount)}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-muted">
                      {formatAuditTime(entry.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <p className="text-xs text-muted">
        Shipment events and financial records reflect only what is stored. Missing history is not
        reconstructed, and a delivered shipment does not imply escrow has settled.
      </p>
    </div>
  );
}
