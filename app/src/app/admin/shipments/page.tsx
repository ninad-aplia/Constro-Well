// Admin > Deliveries. Read-only cross-seller shipment monitoring from FastAPI
// `/api/admin/shipments`; no mutations. Complements `/admin/orders/[id]`,
// which only shows one order's shipments at a time.
import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { SESSION_COOKIE } from "@/server/auth/session";
import AdminNotice from "@/components/admin/AdminNotice";
import AdminShipmentsTable from "@/components/admin/AdminShipmentsTable";
import { ADMIN_PAGE_SIZE, listPageState, parseAdminPage, pageWindow, shipmentsHref } from "@/lib/admin/pagination";
import {
  AdminApiUnavailableError,
  ApiClientError,
  fetchAdminShipments,
  type AdminShipmentsResponse,
} from "@/lib/api/adminApi";

export const metadata: Metadata = {
  title: "Deliveries — Admin — Constro Well",
};

export const instant = false;

// The real `ShipmentStatus` enum (Prisma schema) — fixed vocabulary, so a
// static list is simpler and safer than round-tripping a filter-options call.
const SHIPMENT_STATUSES = [
  "new", "accepted", "packed", "dispatched", "failed", "review",
  "disputed", "settled", "rejected", "missed", "cancelled", "refunded",
] as const;

type Outcome =
  | { kind: "ok"; data: AdminShipmentsResponse }
  | { kind: "unauthorized" }
  | { kind: "forbidden" }
  | { kind: "unconfigured" }
  | { kind: "failed" };

async function loadShipments(page: number, status: string): Promise<Outcome> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return { kind: "unauthorized" };
  try {
    const data = await fetchAdminShipments(
      page,
      ADMIN_PAGE_SIZE,
      `${SESSION_COOKIE}=${token}`,
      status || undefined,
    );
    return { kind: "ok", data };
  } catch (error) {
    if (error instanceof AdminApiUnavailableError) return { kind: "unconfigured" };
    if (error instanceof ApiClientError) {
      if (error.status === 401) return { kind: "unauthorized" };
      if (error.status === 403) return { kind: "forbidden" };
    }
    return { kind: "failed" };
  }
}

export default async function AdminShipmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string | string[]; status?: string | string[] }>;
}) {
  const params = await searchParams;
  const page = parseAdminPage(params.page);
  const rawStatus = Array.isArray(params.status) ? params.status[0] : params.status;
  const status = rawStatus && (SHIPMENT_STATUSES as readonly string[]).includes(rawStatus) ? rawStatus : "";
  const filtered = status !== "";
  const outcome = await loadShipments(page, status);

  if (outcome.kind !== "ok") {
    const copy = {
      unauthorized: {
        title: "Sign in required",
        body: "Your admin session has expired. Sign in again to view shipments.",
      },
      forbidden: {
        title: "Administrator access required",
        body: "This account is not allowed to view shipments.",
      },
      unconfigured: {
        title: "Admin service is not configured",
        body: "Set FASTAPI_BASE_URL on the server to connect the admin console. No fallback data is shown.",
      },
      failed: {
        title: "Shipments couldn't load",
        body: "The admin service is unavailable right now. Try again in a moment.",
      },
    }[outcome.kind];

    return (
      <div className="grid gap-4">
        <header>
          <h1 className="font-display text-2xl font-bold">Deliveries</h1>
        </header>
        <AdminNotice
          title={copy.title}
          body={copy.body}
          action={
            <Link
              href={outcome.kind === "unauthorized" ? "/login?next=/admin/shipments" : shipmentsHref(status, page)}
              className="mt-1 inline-flex min-h-9 items-center rounded-lg border border-line bg-panel px-3 text-[13px] font-semibold hover:bg-tint"
            >
              {outcome.kind === "unauthorized" ? "Sign in" : "Try again"}
            </Link>
          }
        />
      </div>
    );
  }

  const { shipments, pagination } = outcome.data;
  const state = listPageState(pagination.page, pagination.total, pagination.totalPages);
  const pages = pageWindow(pagination.page, pagination.totalPages);

  return (
    <div className="grid gap-4">
      <header className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="font-display text-2xl font-bold">Deliveries</h1>
          <p className="text-sm text-muted" aria-live="polite">
            {state.kind === "empty" ? (
              filtered ? "No shipments match this status." : "No shipments yet."
            ) : state.kind === "out-of-range" ? (
              `Requested page ${state.requestedPage} is outside the available range (1–${state.totalPages}); ${pagination.total} shipments in total.`
            ) : (
              <>
                {pagination.total} {pagination.total === 1 ? "shipment" : "shipments"} · page{" "}
                {state.page} of {state.totalPages} · across all sellers{filtered ? ` · filtered to "${status}"` : ""}
              </>
            )}
          </p>
        </div>
      </header>

      <form
        method="get"
        action="/admin/shipments"
        className="grid gap-2.5 rounded-xl border border-line bg-panel p-[18px] sm:grid-cols-[minmax(0,1fr)_auto_auto]"
        aria-label="Filter shipments"
      >
        <label className="grid gap-1 text-xs font-semibold text-muted">
          Status
          <select
            name="status"
            defaultValue={status}
            className="h-9 rounded-lg border border-line bg-bg px-2 text-[13px] font-normal text-ink"
          >
            <option value="">All statuses</option>
            {SHIPMENT_STATUSES.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-end gap-2">
          <button
            type="submit"
            className="inline-flex h-9 items-center rounded-lg bg-hi px-3 text-[13px] font-semibold text-hiink hover:bg-hi2"
          >
            Apply
          </button>
          <Link
            href="/admin/shipments"
            className="inline-flex h-9 items-center rounded-lg border border-line bg-panel px-3 text-[13px] font-semibold hover:bg-tint"
          >
            Clear
          </Link>
        </div>
      </form>

      <AdminShipmentsTable shipments={shipments} total={pagination.total} filtered={filtered} />

      {state.kind === "page" && pagination.totalPages > 1 && (
        <nav aria-label="Shipment pages" className="flex flex-wrap items-center justify-center gap-1.5">
          <Link
            href={shipmentsHref(status, Math.max(1, pagination.page - 1))}
            aria-disabled={pagination.page <= 1}
            tabIndex={pagination.page <= 1 ? -1 : undefined}
            className={`inline-flex min-h-8 items-center rounded-lg border border-line bg-panel px-3 text-[13px] font-semibold ${
              pagination.page <= 1 ? "pointer-events-none opacity-50" : "hover:bg-tint"
            }`}
          >
            Previous
          </Link>
          {pages.map((n) => (
            <Link
              key={n}
              href={shipmentsHref(status, n)}
              aria-current={pagination.page === n ? "page" : undefined}
              className={`inline-flex min-h-8 min-w-8 items-center justify-center rounded-lg border px-2 text-[13px] font-semibold ${
                pagination.page === n
                  ? "border-nav bg-nav text-white"
                  : "border-line bg-panel hover:bg-tint"
              }`}
            >
              {n}
            </Link>
          ))}
          <Link
            href={shipmentsHref(status, Math.min(pagination.totalPages, pagination.page + 1))}
            aria-disabled={pagination.page >= pagination.totalPages}
            tabIndex={pagination.page >= pagination.totalPages ? -1 : undefined}
            className={`inline-flex min-h-8 items-center rounded-lg border border-line bg-panel px-3 text-[13px] font-semibold ${
              pagination.page >= pagination.totalPages
                ? "pointer-events-none opacity-50"
                : "hover:bg-tint"
            }`}
          >
            Next
          </Link>
        </nav>
      )}
    </div>
  );
}
