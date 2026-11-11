// Admin > Users. Server-rendered from FastAPI `/api/admin/users` with the
// existing `cw_session` cookie forwarded server-side. The backend enforces the
// admin role; this page only translates 401/403/5xx into honest UI states.
import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { SESSION_COOKIE } from "@/server/auth/session";
import AdminUsersTable from "@/components/admin/AdminUsersTable";
import AdminNotice from "@/components/admin/AdminNotice";
import { ADMIN_PAGE_SIZE, adminUsersHref, parseAdminPage, pageWindow } from "@/lib/admin/pagination";
import {
  AdminApiUnavailableError,
  ApiClientError,
  fetchAdminUsers,
  type AdminUsersResponse,
} from "@/lib/api/adminApi";

export const metadata: Metadata = {
  title: "Users — Admin — Constro Well",
};

export const instant = false;

type LoadOutcome =
  | { kind: "ok"; data: AdminUsersResponse }
  | { kind: "unauthorized" }
  | { kind: "forbidden" }
  | { kind: "unconfigured" }
  | { kind: "failed" };

async function loadUsers(page: number): Promise<LoadOutcome> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return { kind: "unauthorized" };
  try {
    const data = await fetchAdminUsers(page, ADMIN_PAGE_SIZE, `${SESSION_COOKIE}=${token}`);
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

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string | string[] }>;
}) {
  const params = await searchParams;
  const page = parseAdminPage(params.page);
  const outcome = await loadUsers(page);

  if (outcome.kind !== "ok") {
    const copy = {
      unauthorized: {
        title: "Sign in required",
        body: "Your admin session has expired. Sign in again to view user accounts.",
      },
      forbidden: {
        title: "Administrator access required",
        body: "This account is not allowed to view user accounts.",
      },
      unconfigured: {
        title: "Admin service is not configured",
        body: "Set FASTAPI_BASE_URL on the server to connect the admin console. No fallback data is shown.",
      },
      failed: {
        title: "Users couldn't load",
        body: "The admin service is unavailable right now. Try again in a moment.",
      },
    }[outcome.kind];

    return (
      <div className="grid gap-4">
        <header>
          <h1 className="font-display text-2xl font-bold">Users</h1>
        </header>
        <AdminNotice
          title={copy.title}
          body={copy.body}
          action={
            <Link
              href={outcome.kind === "unauthorized" ? "/login?next=/admin/users" : adminUsersHref(page)}
              className="mt-1 inline-flex min-h-9 items-center rounded-lg border border-line bg-panel px-3 text-[13px] font-semibold hover:bg-tint"
            >
              {outcome.kind === "unauthorized" ? "Sign in" : "Try again"}
            </Link>
          }
        />
      </div>
    );
  }

  const { users, pagination } = outcome.data;
  const pages = pageWindow(pagination.page, pagination.totalPages);

  return (
    <div className="grid gap-4">
      <header className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="font-display text-2xl font-bold">Users</h1>
          <p className="text-sm text-muted">
            {pagination.total} {pagination.total === 1 ? "account" : "accounts"} · page{" "}
            {pagination.page} of {Math.max(1, pagination.totalPages)} · every view is audited
          </p>
        </div>
      </header>

      <AdminUsersTable users={users} />

      {pagination.totalPages > 1 && (
        <nav aria-label="User pages" className="flex flex-wrap items-center justify-center gap-1.5">
          <Link
            href={adminUsersHref(Math.max(1, pagination.page - 1))}
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
              href={adminUsersHref(n)}
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
            href={adminUsersHref(Math.min(pagination.totalPages, pagination.page + 1))}
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
