// Admin > Orders. Read-only monitoring list from FastAPI; no mutations.
import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { SESSION_COOKIE } from "@/server/auth/session";
import AdminNotice from "@/components/admin/AdminNotice";
import AdminOrdersTable from "@/components/admin/AdminOrdersTable";
import { ADMIN_PAGE_SIZE, listPageState, ordersHref, pageWindow, parseAdminPage } from "@/lib/admin/pagination";
import {
  AdminApiUnavailableError,
  ApiClientError,
  fetchAdminOrders,
  type AdminOrdersResponse,
} from "@/lib/api/adminApi";

export const metadata: Metadata = {
  title: "Orders — Admin — Constro Well",
};

export const instant = false;

type Outcome =
  | { kind: "ok"; data: AdminOrdersResponse }
  | { kind: "unauthorized" }
  | { kind: "forbidden" }
  | { kind: "unconfigured" }
  | { kind: "failed" };

async function loadOrders(page: number): Promise<Outcome> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return { kind: "unauthorized" };
  try {
    return { kind: "ok", data: await fetchAdminOrders(page, ADMIN_PAGE_SIZE, `${SESSION_COOKIE}=${token}`) };
  } catch (error) {
    if (error instanceof AdminApiUnavailableError) return { kind: "unconfigured" };
    if (error instanceof ApiClientError) {
      if (error.status === 401) return { kind: "unauthorized" };
      if (error.status === 403) return { kind: "forbidden" };
    }
    return { kind: "failed" };
  }
}

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string | string[] }>;
}) {
  const params = await searchParams;
  const page = parseAdminPage(params.page);
  const outcome = await loadOrders(page);

  if (outcome.kind !== "ok") {
    const copy = {
      unauthorized: {
        title: "Sign in required",
        body: "Your admin session has expired. Sign in again to view orders.",
      },
      forbidden: {
        title: "Administrator access required",
        body: "This account is not allowed to view orders.",
      },
      unconfigured: {
        title: "Admin service is not configured",
        body: "Set FASTAPI_BASE_URL on the server to connect the admin console. No fallback data is shown.",
      },
      failed: {
        title: "Orders couldn't load",
        body: "The admin service is unavailable right now. Try again in a moment.",
      },
    }[outcome.kind];

    return (
      <div className="grid gap-4">
        <header>
          <h1 className="font-display text-2xl font-bold">Orders</h1>
        </header>
        <AdminNotice
          title={copy.title}
          body={copy.body}
          action={
            <Link
              href={outcome.kind === "unauthorized" ? "/login?next=/admin" : ordersHref(page)}
              className="mt-1 inline-flex min-h-9 items-center rounded-lg border border-line bg-panel px-3 text-[13px] font-semibold hover:bg-tint"
            >
              {outcome.kind === "unauthorized" ? "Sign in" : "Try again"}
            </Link>
          }
        />
      </div>
    );
  }

  const { orders, pagination } = outcome.data;
  const state = listPageState(pagination.page, pagination.total, pagination.totalPages);
  const pages = pageWindow(pagination.page, pagination.totalPages);

  return (
    <div className="grid gap-4">
      <header className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="font-display text-2xl font-bold">Orders</h1>
          <p className="text-sm text-muted" aria-live="polite">
            {state.kind === "empty" ? (
              "No orders yet."
            ) : state.kind === "out-of-range" ? (
              `Requested page ${state.requestedPage} is outside the available range (1–${state.totalPages}); ${pagination.total} orders in total. Use the link below to return to the first page.`
            ) : (
              <>
                {pagination.total} {pagination.total === 1 ? "order" : "orders"} · page{" "}
                {state.page} of {state.totalPages} · shipment statuses shown per seller
              </>
            )}
          </p>
        </div>
      </header>

      <AdminOrdersTable orders={orders} total={pagination.total} />

      {state.kind === "page" && pagination.totalPages > 1 && (
        <nav aria-label="Order pages" className="flex flex-wrap items-center justify-center gap-1.5">
          <Link
            href={ordersHref(Math.max(1, pagination.page - 1))}
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
              href={ordersHref(n)}
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
            href={ordersHref(Math.min(pagination.totalPages, pagination.page + 1))}
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
