// Admin > Overview. Read-only aggregate dashboard built only from stored rows.
import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { SESSION_COOKIE } from "@/server/auth/session";
import AdminNotice from "@/components/admin/AdminNotice";
import Card from "@/components/ui/Card";
import { formatAuditTime } from "@/lib/admin/activity";
import { barPercent, dayLabel, maxCount } from "@/lib/admin/overview";
import { formatDateOnly } from "@/lib/admin/sellers";
import {
  AdminApiUnavailableError,
  ApiClientError,
  fetchAdminOverview,
  type AdminOverview,
} from "@/lib/api/adminApi";

export const metadata: Metadata = {
  title: "Overview — Admin — Constro Well",
};

export const instant = false;

type Outcome =
  | { kind: "ok"; data: AdminOverview }
  | { kind: "unauthorized" }
  | { kind: "forbidden" }
  | { kind: "unconfigured" }
  | { kind: "failed" };

async function loadOverview(): Promise<Outcome> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return { kind: "unauthorized" };
  try {
    return { kind: "ok", data: await fetchAdminOverview(`${SESSION_COOKIE}=${token}`) };
  } catch (error) {
    if (error instanceof AdminApiUnavailableError) return { kind: "unconfigured" };
    if (error instanceof ApiClientError) {
      if (error.status === 401) return { kind: "unauthorized" };
      if (error.status === 403) return { kind: "forbidden" };
    }
    return { kind: "failed" };
  }
}

function Kpi({ label, value, note }: { label: string; value: number; note: string }) {
  return (
    <Card className="min-w-0 p-4">
      <p className="text-xs font-semibold tracking-wide text-muted uppercase">{label}</p>
      <p className="mt-1 font-display text-3xl font-bold">{value.toLocaleString("en-IN")}</p>
      <p className="mt-1 text-xs text-muted">{note}</p>
    </Card>
  );
}

function Distribution({
  title,
  rows,
  labelKey,
  note,
}: {
  title: string;
  rows: Array<Record<string, string | number>>;
  labelKey: string;
  note: string;
}) {
  const max = maxCount(rows.map((row) => ({ count: Number(row.count) })));
  return (
    <Card className="min-w-0 p-[18px]">
      <h2 className="font-display text-lg font-bold">{title}</h2>
      <p className="mb-2 text-xs text-muted">{note}</p>
      <ul className="grid gap-1.5">
        {rows.map((row) => {
          const label = String(row[labelKey]);
          return (
            <li key={label} className="grid grid-cols-[110px_1fr_40px] items-center gap-2 text-[13px]">
              <span className="capitalize">{label.replaceAll("_", " ")}</span>
              <span className="h-2.5 overflow-hidden rounded-full bg-tint" aria-hidden="true">
                <span
                  className="block h-full w-full rounded-full bg-nav"
                  style={{ width: `${barPercent(Number(row.count), max)}%` }}
                />
              </span>
              <span className="text-right font-semibold">{Number(row.count)}</span>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

export default async function AdminOverviewPage() {
  const outcome = await loadOverview();

  if (outcome.kind !== "ok") {
    const copy = {
      unauthorized: {
        title: "Sign in required",
        body: "Your admin session has expired. Sign in again to view the dashboard.",
      },
      forbidden: {
        title: "Administrator access required",
        body: "This account is not allowed to view the admin dashboard.",
      },
      unconfigured: {
        title: "Admin service is not configured",
        body: "Set FASTAPI_BASE_URL on the server to connect the admin console. No fallback data is shown.",
      },
      failed: {
        title: "Dashboard couldn't load",
        body: "The admin service is unavailable right now. Try again in a moment.",
      },
    }[outcome.kind];

    return (
      <div className="grid gap-4">
        <header>
          <h1 className="font-display text-2xl font-bold">Overview</h1>
        </header>
        <AdminNotice
          title={copy.title}
          body={copy.body}
          action={
            <Link
              href={outcome.kind === "unauthorized" ? "/login?next=/admin" : "/admin"}
              className="mt-1 inline-flex min-h-9 items-center rounded-lg border border-line bg-panel px-3 text-[13px] font-semibold hover:bg-tint"
            >
              {outcome.kind === "unauthorized" ? "Sign in" : "Try again"}
            </Link>
          }
        />
      </div>
    );
  }

  const data = outcome.data;
  const empty = data.totals.users === 0 && data.totals.sellers === 0 && data.totals.orders === 0;

  return (
    <div className="grid gap-4">
      <header>
        <h1 className="font-display text-2xl font-bold">Overview</h1>
        <p className="text-sm text-muted">
          Counts from stored marketplace records. 30-day window starts{" "}
          {formatDateOnly(data.windows.last30DaysStart)}; daily chart starts{" "}
          {formatDateOnly(data.windows.dailyStart)}. Generated{" "}
          {formatAuditTime(data.generatedAt)}.
        </p>
      </header>

      {empty && (
        <AdminNotice
          title="No marketplace records yet"
          body="Counts and charts will populate as users, sellers and orders are created."
        />
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          label="Users"
          value={data.totals.users}
          note={`+${data.last30Days.users} created in the last 30 days`}
        />
        <Kpi
          label="Sellers"
          value={data.totals.sellers}
          note={`+${data.last30Days.sellers} created in the last 30 days`}
        />
        <Kpi
          label="Orders"
          value={data.totals.orders}
          note={`+${data.last30Days.orders} created in the last 30 days`}
        />
        <Kpi
          label="Cancelled orders"
          value={data.totals.cancelledOrders}
          note="Current-state count of orders flagged cancelled"
        />
      </div>

      <div className="grid items-start gap-4 xl:grid-cols-2">
        <Distribution
          title="Order stages"
          rows={data.orderStages}
          labelKey="stage"
          note="Current-state count per stored OrderStage value."
        />
        <Distribution
          title="Shipment statuses"
          rows={data.shipmentsByStatus}
          labelKey="status"
          note="Current-state count per seller shipment; independent of the parent order stage."
        />
      </div>

      <Card className="min-w-0 p-[18px]">
        <h2 className="font-display text-lg font-bold">Orders created per day</h2>
        <p className="mb-3 text-xs text-muted">
          Orders grouped by UTC calendar day for the last 30 days (including today).
        </p>
        <div className="flex h-28 items-end gap-1 overflow-x-auto pb-1" aria-hidden="true">
          {data.ordersPerDay.map((day) => {
            const max = maxCount(data.ordersPerDay);
            return (              <div
                key={day.date}
                title={`${day.date}: ${day.count}`}
                className="flex h-full min-w-[8px] flex-1 items-end"
              >
                <span
                  className="block w-full rounded-t bg-hi"
                  style={{ height: `${Math.max(day.count > 0 ? 4 : 1, barPercent(day.count, max))}%` }}
                />
              </div>
            );
          })}
        </div>
        <div className="mt-1 flex justify-between text-[11px] text-muted">
          <span>{dayLabel(data.ordersPerDay[0]?.date ?? "")}</span>
          <span>{dayLabel(data.ordersPerDay[data.ordersPerDay.length - 1]?.date ?? "")}</span>
        </div>
        <table className="sr-only">
          <caption>Orders created per UTC day</caption>
          <tbody>
            {data.ordersPerDay.map((day) => (
              <tr key={day.date}>
                <th scope="row">{day.date}</th>
                <td>{day.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <div className="grid items-start gap-4 xl:grid-cols-2">
        <Card className="min-w-0 p-[18px]">
          <h2 className="font-display text-lg font-bold">Legacy escrow (pre-cutover)</h2>
          <p className="mb-2 text-xs text-muted">
            Historical platform-custody escrow entries by type, all time. These are pre-cutover
            records — not current COD cash, revenue or settlement totals.
          </p>
          {data.escrowByType.length === 0 ? (
            <p className="text-sm text-muted">No escrow entries are stored yet.</p>
          ) : (
            <div className="min-w-0 overflow-x-auto">
              <table className="w-full min-w-[360px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs text-muted">
                    <th scope="col" className="py-2 pr-3 font-semibold">Type</th>
                    <th scope="col" className="px-3 py-2 font-semibold">Entries</th>
                    <th scope="col" className="px-3 py-2 font-semibold">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {data.escrowByType.map((row) => (
                    <tr key={row.type} className="border-b border-line/70 last:border-0">
                      <td className="py-2 pr-3 capitalize">{row.type}</td>
                      <td className="px-3 py-2">{row.entries}</td>
                      <td className="px-3 py-2 whitespace-nowrap font-semibold">₹{row.amount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card className="min-w-0 p-[18px]">
          <h2 className="font-display text-lg font-bold">Pending KYC checks</h2>
          <p className="mb-2 text-xs text-muted">
            Sellers with each stored KYC flag set to <code>pending</code>. There is no overall
            seller approval status in the schema.
          </p>
          <div className="grid grid-cols-3 gap-2 text-center">
            {[
              ["GST", data.kycPending.gst],
              ["PAN", data.kycPending.pan],
              ["Cheque", data.kycPending.cheque],
            ].map(([label, value]) => (
              <div key={String(label)} className="rounded-lg border border-line bg-tint p-3">
                <p className="text-xs text-muted">{label}</p>
                <p className="font-display text-xl font-bold">{value}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <p className="text-xs text-muted">
        Definitions: totals are current-state counts; “last 30 days” is a rolling 30×24-hour UTC
        window; order and shipment distributions use their own stored enums and are not converted
        into a unified status; escrow amounts are exact stored decimals. No revenue, GMV, active
        user, conversion, payout or dispute metric is shown because the schema does not support a
        defensible definition.
      </p>
    </div>
  );
}
