// Admin > Sellers. Read-only slice: seller account + stored KYC status.
// Server-rendered from FastAPI `/api/admin/sellers` with the admin cookie
// forwarded server-side; no mock fallback and no approval actions.
import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { SESSION_COOKIE } from "@/server/auth/session";
import AdminNotice from "@/components/admin/AdminNotice";
import AdminSellersTable from "@/components/admin/AdminSellersTable";
import {
  ADMIN_PAGE_SIZE,
  listPageState,
  pageWindow,
  parseAdminPage,
  sellersHref,
} from "@/lib/admin/pagination";
import {
  AdminApiUnavailableError,
  ApiClientError,
  fetchAdminSellers,
  type AdminSellersResponse,
} from "@/lib/api/adminApi";

export const metadata: Metadata = {
  title: "Sellers — Admin — Constro Well",
};

export const instant = false;

type LoadOutcome =
  | { kind: "ok"; data: AdminSellersResponse }
  | { kind: "unauthorized" }
  | { kind: "forbidden" }
  | { kind: "unconfigured" }
  | { kind: "failed" };

async function loadSellers(page: number): Promise<LoadOutcome> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return { kind: "unauthorized" };
  try {
    const data = await fetchAdminSellers(page, ADMIN_PAGE_SIZE, `${SESSION_COOKIE}=${token}`);
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

export default async function AdminSellersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string | string[] }>;
}) {
  const params = await searchParams;
  const page = parseAdminPage(params.page);
  const outcome = await loadSellers(page);

  if (outcome.kind !== "ok") {
    const copy = {
      unauthorized: {
        title: "Sign in required",
        body: "Your admin session has expired. Sign in again to view sellers.",
      },
      forbidden: {
        title: "Administrator access required",
        body: "This account is not allowed to view seller accounts.",
      },
      unconfigured: {
        title: "Admin service is not configured",
        body: "Set FASTAPI_BASE_URL on the server to connect the admin console. No fallback data is shown.",
      },
      failed: {
        title: "Sellers couldn't load",
        body: "The admin service is unavailable right now. Try again in a moment.",
      },
    }[outcome.kind];

    return (
      <div className="grid gap-4">
        <header>
          <h1 className="font-display text-2xl font-bold">Sellers</h1>
        </header>
        <AdminNotice
          title={copy.title}
          body={copy.body}
          action={
            <Link
              href={outcome.kind === "unauthorized" ? "/login?next=/admin/sellers" : sellersHref(page)}
              className="mt-1 inline-flex min-h-9 items-center rounded-lg border border-line bg-panel px-3 text-[13px] font-semibold hover:bg-tint"
            >
              {outcome.kind === "unauthorized" ? "Sign in" : "Try again"}
            </Link>
          }
        />
      </div>
    );
  }

  const { sellers, pagination } = outcome.data;
  const state = listPageState(pagination.page, pagination.total, pagination.totalPages);
  const pages = pageWindow(pagination.page, pagination.totalPages);

  return (
    <div className="grid gap-4">
      <header className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="font-display text-2xl font-bold">Sellers</h1>
          <p className="text-sm text-muted" aria-live="polite">
            {state.kind === "empty" ? (
              <>No seller accounts yet.</>
            ) : state.kind === "out-of-range" ? (
              `Requested page ${state.requestedPage} is outside the available range (1–${state.totalPages}); ${pagination.total} sellers in total. Use the link below to return to the first page.`
            ) : (
              <>
                {pagination.total} {pagination.total === 1 ? "seller" : "sellers"} · page{" "}
                {state.page} of {state.totalPages} · KYC status is the stored verification flag
              </>
            )}
          </p>
        </div>
      </header>

      <AdminSellersTable sellers={sellers} total={pagination.total} />

      {state.kind === "page" && pagination.totalPages > 1 && (
        <nav aria-label="Seller pages" className="flex flex-wrap items-center justify-center gap-1.5">
          <Link
            href={sellersHref(Math.max(1, pagination.page - 1))}
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
              href={sellersHref(n)}
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
            href={sellersHref(Math.min(pagination.totalPages, pagination.page + 1))}
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
